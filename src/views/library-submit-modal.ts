// src/views/library-submit-modal.ts
// Submit-to-Community-Library modal (Variant B): takes an already-built ReleaseBundle
// (from LibraryService.buildLocalPackage — the same bundle the export modal writes),
// collects optional submission metadata (title/description/categories/note), shows a
// patient-data warning, and POSTs { release, meta } to the registry's /api/submit proxy.
// The proxy opens a PR in the backend repo; moderation = PR review + merge.
//
// Transport: injected `postJson` seam (D2 pattern from RegistryClient) so tests never
// touch the network. The endpoint defaults to <registry>/api/submit; failures are explicit
// results, never throws. Promise-based Modal with safeResolve double-guard, modeled after
// LibraryExportModal.

import { App, Modal, Notice, requestUrl } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { ReleaseBundle } from '../library/library-model';
import { normalizeRegistryUrl } from '../library/registry-client';
import { LIBRARY_SUBMISSION_CATEGORIES } from '../library/package-metadata';

export type LibrarySubmitResult =
  | { submitted: true; prUrl: string }
  | { submitted: false };

/** Injectable transport seam (D2). Returns parsed JSON + status; never throws. */
export type SubmitTransport = (
  url: string,
  body: string,
) => Promise<{ status: number; bodyText: string }>;

/** Production transport over Obsidian's requestUrl.
 *  Static import (NOT `await import('obsidian')`): esbuild leaves dynamic imports
 *  unresolved in the bundle, and the virtual 'obsidian' module only resolves for
 *  static imports — a dynamic one throws "Failed to resolve module specifier". */
export const requestUrlSubmitTransport: SubmitTransport = async (url, body) => {
  const res = await requestUrl({ url, method: 'POST', contentType: 'application/json', body });
  return { status: res.status, bodyText: res.text };
};

export interface LibrarySubmitModalOptions {
  /** Registry base URL (settings override or bundled default). '' → submit unavailable. */
  registryBaseUrl: string;
  transport?: SubmitTransport;
}

export class LibrarySubmitModal extends Modal {
  readonly result: Promise<LibrarySubmitResult>;
  private resolve!: (value: LibrarySubmitResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly bundle: ReleaseBundle;
  private readonly options: LibrarySubmitModalOptions;
  private title = '';
  private description = '';
  private readonly selectedCategories = new Set<string>();
  private note = '';
  private submitBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private inFlight = false;

  constructor(
    app: App,
    plugin: RadiProtocolPlugin,
    bundle: ReleaseBundle,
    options: LibrarySubmitModalOptions,
  ) {
    super(app);
    this.plugin = plugin;
    this.bundle = bundle;
    this.options = options;
    this.result = new Promise<LibrarySubmitResult>((res) => { this.resolve = res; });
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('radi-library-submit');
    this.titleEl.setText(t('library.submitTitle'));

    const manifest = this.bundle.manifest;

    // Summary block — what is being submitted (package id/version/snippet count).
    const summary = contentEl.createDiv({ cls: 'radi-library-submit-summary' });
    summary.createDiv({ cls: 'radi-library-submit-summary-row', text: t('library.submitSummaryPackage', { packageId: manifest.packageId, version: manifest.releaseVersion }) });
    summary.createDiv({ cls: 'radi-library-submit-summary-row', text: t('library.submitSummarySnippets', { count: String(manifest.snippetFiles.length) }) });

    // Patient-data warning (the registry is PUBLIC).
    const warning = contentEl.createDiv({ cls: 'radi-library-submit-warning' });
    warning.setText(t('library.submitWarning'));

    const titleRow = contentEl.createDiv({ cls: 'radi-library-submit-field' });
    titleRow.createEl('label', { text: t('library.submitCatalogTitle'), attr: { for: 'radi-library-submit-title' } });
    const titleInput = titleRow.createEl('input', { cls: 'radi-library-submit-title', attr: { type: 'text' } });
    titleInput.value = manifest.protocolDoc.title;
    titleInput.addEventListener('input', () => { this.title = titleInput.value; });

    const descRow = contentEl.createDiv({ cls: 'radi-library-submit-field' });
    descRow.createEl('label', { text: t('library.submitDescription'), attr: { for: 'radi-library-submit-desc' } });
    const descInput = descRow.createEl('textarea', { cls: 'radi-library-submit-desc' });
    descInput.rows = 2;
    descInput.addEventListener('input', () => { this.description = descInput.value; });

    // Categories — fixed taxonomy as checkboxes (one or more required).
    const catRow = contentEl.createDiv({ cls: 'radi-library-submit-field' });
    catRow.createEl('label', { text: t('library.submitCategories') });
    const catList = catRow.createDiv({ cls: 'radi-library-submit-categories' });
    for (const categoryId of LIBRARY_SUBMISSION_CATEGORIES) {
      const optionRow = catList.createEl('label', { cls: 'radi-library-submit-category-option' });
      const checkbox = optionRow.createEl('input', { attr: { type: 'checkbox' } });
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selectedCategories.add(categoryId);
        else this.selectedCategories.delete(categoryId);
        this.updateSubmitEnabled();
      });
      // Localized display label; the stable id goes to the API.
      const labelKey = `library.category.${categoryId}`;
      optionRow.createEl('span', { text: t(labelKey, undefined, categoryId) });
    }

    const noteRow = contentEl.createDiv({ cls: 'radi-library-submit-field' });
    noteRow.createEl('label', { text: t('library.submitNote'), attr: { for: 'radi-library-submit-note' } });
    const noteInput = noteRow.createEl('textarea', { cls: 'radi-library-submit-note' });
    noteInput.rows = 2;
    noteInput.placeholder = t('library.submitNotePlaceholder');
    noteInput.setCssProps({ height: 'auto' });
    noteInput.addEventListener('input', () => { this.note = noteInput.value; });

    this.statusEl = contentEl.createDiv({ cls: 'radi-library-submit-status' });

    // Buttons carry visible text; no aria-label — Obsidian would surface it
    // as a duplicate hover tooltip.
    const actions = contentEl.createDiv({ cls: 'radi-library-submit-actions' });
    this.submitBtn = actions.createEl('button', { cls: 'radi-library-detail-install mod-cta' });
    this.submitBtn.setText(t('library.submitLabel'));
    this.submitBtn.disabled = !this.endpointAvailable() || !this.canSubmit();
    if (!this.endpointAvailable()) this.statusEl.setText(t('library.submitUnavailable'));
    this.submitBtn.addEventListener('click', () => { void this.handleSubmit(); });
    const cancelBtn = actions.createEl('button', { cls: 'radi-library-detail-cancel' });
    cancelBtn.setText(t('library.cancel'));
    cancelBtn.addEventListener('click', () => { this.safeResolve({ submitted: false }); this.close(); });
  }

  onClose(): void {
    this.safeResolve({ submitted: false });
    this.contentEl.empty();
  }

  private safeResolve(value: LibrarySubmitResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }

  private endpointAvailable(): boolean {
    return normalizeRegistryUrl(this.options.registryBaseUrl) !== '';
  }

  /** At least one category must be selected before submission is allowed. */
  private canSubmit(): boolean {
    return this.selectedCategories.size > 0;
  }

  private updateSubmitEnabled(): void {
    if (this.submitBtn === undefined) return;
    this.submitBtn.disabled = !this.endpointAvailable() || !this.canSubmit() || this.inFlight;
  }

  private endpoint(): string {
    return `${normalizeRegistryUrl(this.options.registryBaseUrl)}/api/submit`;
  }

  private handleSubmit(): void {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const transport = this.options.transport ?? requestUrlSubmitTransport;
    this.inFlight = true;
    this.submitBtn.disabled = true;
    this.statusEl.setText(t('library.submitting'));
    const payload = JSON.stringify({
      release: this.bundle,
      meta: {
        title: this.title.trim() || this.bundle.manifest.protocolDoc.title,
        description: this.description.trim(),
        categories: LIBRARY_SUBMISSION_CATEGORIES.filter((c) => this.selectedCategories.has(c)),
        authorDisplayName: this.bundle.manifest.author?.displayName ?? '',
        note: this.note.trim(),
      },
    });
    void transport(this.endpoint(), payload)
      .then((res) => {
        let parsed: { ok?: boolean; prUrl?: string; error?: string } = {};
        try { parsed = JSON.parse(res.bodyText) as typeof parsed; } catch { /* non-JSON error page */ }
        if (res.status === 200 && parsed.ok === true && typeof parsed.prUrl === 'string') {
          new Notice(t('library.submittedNotice'));
          this.statusEl.setText(t('library.submitSuccessPr', { prUrl: parsed.prUrl }));
          this.safeResolve({ submitted: true, prUrl: parsed.prUrl });
          this.close();
          return;
        }
        this.statusEl.setText(t('library.submitError', { reason: parsed.error ?? `HTTP ${res.status}` }));
        this.submitBtn.disabled = false;
        this.inFlight = false;
      })
      .catch((e: unknown) => {
        this.statusEl.setText(t('library.submitError', { reason: (e as Error)?.message ?? String(e) }));
        this.submitBtn.disabled = false;
        this.inFlight = false;
      });
  }
}
