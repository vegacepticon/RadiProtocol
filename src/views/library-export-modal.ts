// src/views/library-export-modal.ts
// Export-package modal (FR-6/D3, simplified UX 2026-08-23): package metadata is
// derived automatically (packageId from the protocol title slug, release version
// from settings bookkeeping +0.0.1 per packageId, file name `<id>-<ver>.json`)
// and shown as a read-only summary line instead of manual text fields. Two
// explicitly labeled sections: local export to the vault vs. submission to the
// Community Library moderation queue. The last export folder persists in
// settings. Calls LibraryService.buildLocalPackage (FR-5) → writePackageExport
// or opens LibrarySubmitModal. Promise-based Modal with safeResolve
// double-guard.

import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { FolderSuggest } from './folder-suggest';
import type { BuildResult } from '../library/library-service';
import { DEFAULT_REGISTRY_URL } from '../library/registry-client';
import { LibrarySubmitModal } from './library-submit-modal';
import { derivePackageId, nextReleaseVersion } from '../library/package-metadata';

export type LibraryExportResult =
  | { exported: true; path: string }
  | { exported: false };

export class LibraryExportModal extends Modal {
  readonly result: Promise<LibraryExportResult>;
  private resolve!: (value: LibraryExportResult) => void;
  private resolved = false;

  private readonly plugin: RadiProtocolPlugin;
  private readonly protocolPath: string;
  private folderPath = '';
  private packageId = '';
  private releaseVersion = '';
  private exportBtn!: HTMLButtonElement;
  private submitBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private collisionTimer: number | null = null;
  private hasFileCollision = false;

  constructor(app: App, plugin: RadiProtocolPlugin, protocolPath: string) {
    super(app);
    this.plugin = plugin;
    this.protocolPath = protocolPath;
    this.result = new Promise<LibraryExportResult>((res) => { this.resolve = res; });
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass('radi-library-export');
    this.titleEl.setText(t('library.exportTitle'));

    // Auto-derived package identity. The author field stays optional; the id
    // comes from the protocol title, the version from settings bookkeeping.
    let authorDisplayName = '';
    try {
      const docRaw = await this.app.vault.adapter.read(this.protocolPath);
      const parsedDoc = JSON.parse(docRaw) as { title?: unknown };
      const title = typeof parsedDoc.title === 'string' ? parsedDoc.title : '';
      this.packageId = derivePackageId(title || this.protocolPath);
    } catch {
      this.packageId = derivePackageId(this.protocolPath);
    }
    const lastVersion = this.plugin.settings.libraryLastSubmittedVersions?.[this.packageId];
    this.releaseVersion = nextReleaseVersion(lastVersion);

    // Identity summary (read-only — replaces the former id/version/filename inputs).
    const summary = contentEl.createDiv({ cls: 'radi-library-submit-summary' });
    summary.createDiv({
      cls: 'radi-library-submit-summary-row',
      text: t('library.exportSummaryIdentity', { packageId: this.packageId, version: this.releaseVersion }),
    });

    // Author stays an editable, optional field.
    const authorRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    authorRow.createEl('label', { text: t('library.exportAuthor'), attr: { for: 'radi-library-export-author' } });
    const authorInput = authorRow.createEl('input', { cls: 'radi-library-export-author', attr: { type: 'text' } });
    authorInput.placeholder = t('library.exportAuthorPlaceholder');
    authorInput.addEventListener('input', () => { authorDisplayName = authorInput.value; });

    // ── Section 1: save the package locally into the vault. ──
    const localSection = contentEl.createDiv({ cls: 'radi-library-export-section' });
    localSection.createEl('h3', { text: t('library.exportLocalSection') });
    localSection.createEl('p', {
      cls: 'radi-library-section-hint',
      text: t('library.exportLocalHint'),
    });
    const folderRow = localSection.createDiv({ cls: 'radi-library-export-field' });
    folderRow.createEl('label', { text: t('library.exportDestination'), attr: { for: 'radi-library-export-folder' } });
    const folderInput = folderRow.createEl('input', { cls: 'radi-library-export-folder', attr: { type: 'text' } });
    folderInput.placeholder = t('library.exportFolderPlaceholder');
    // Default: last used export folder → the configured protocol folder → empty.
    folderInput.value = this.plugin.settings.libraryLastExportFolder?.trim() !== ''
      ? this.plugin.settings.libraryLastExportFolder ?? ''
      : this.plugin.settings.protocolFolderPath ?? '';
    this.folderPath = folderInput.value;

    const actions = localSection.createDiv({ cls: 'radi-library-export-actions' });
    this.exportBtn = actions.createEl('button', { cls: 'radi-library-detail-install mod-cta' });
    this.exportBtn.setText(t('library.exportLabel'));
    this.exportBtn.addEventListener('click', () => { void this.handleExport(); });

    // ── Section 2: submit to the Community Library (public, moderated). ──
    const submitSection = contentEl.createDiv({ cls: 'radi-library-export-section' });
    submitSection.createEl('h3', { text: t('library.exportSubmitSection') });
    submitSection.createEl('p', {
      cls: 'radi-library-section-hint',
      text: t('library.exportSubmitHint'),
    });
    const submitActions = submitSection.createDiv({ cls: 'radi-library-export-actions' });
    this.submitBtn = submitActions.createEl('button', { cls: 'radi-library-detail-install mod-cta' });
    this.submitBtn.setText(t('library.submitLabel'));
    this.submitBtn.addEventListener('click', () => { void this.handleSubmitToCommunity(authorDisplayName); });

    this.statusEl = contentEl.createDiv({ cls: 'radi-library-export-status' });

    const cancelRow = contentEl.createDiv({ cls: 'radi-library-export-actions' });
    const cancelBtn = cancelRow.createEl('button', { cls: 'radi-library-detail-cancel' });
    cancelBtn.setText(t('library.cancel'));
    cancelBtn.addEventListener('click', () => { this.safeResolve({ exported: false }); this.close(); });

    new FolderSuggest(this.app, folderInput);
    folderInput.addEventListener('input', () => {
      this.folderPath = folderInput.value;
      this.plugin.settings.libraryLastExportFolder = this.folderPath.trim();
      void this.plugin.saveSettings();
      this.scheduleCollisionCheck();
    });
    this.updateExportEnabled();
    void this.checkFileCollision();
  }

  onClose(): void {
    this.safeResolve({ exported: false });
    this.contentEl.empty();
  }

  private safeResolve(value: LibraryExportResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }

  private scheduleCollisionCheck(): void {
    if (this.collisionTimer !== null) window.clearTimeout(this.collisionTimer);
    this.collisionTimer = window.setTimeout(() => { this.collisionTimer = null; void this.checkFileCollision(); }, 150);
  }

  private async checkFileCollision(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.statusEl.empty();
    const destPath = this.computeDestPath();
    if (destPath === null) { this.hasFileCollision = false; this.updateExportEnabled(); return; }
    const exists = await this.app.vault.adapter.exists(destPath);
    this.hasFileCollision = exists;
    if (exists) this.statusEl.setText(t('library.exportCollisionFile', { path: destPath }));
    this.updateExportEnabled();
  }

  private computeDestPath(): string | null {
    const folder = this.folderPath.trim();
    const safeName = exportBundleFileName(this.packageId, this.releaseVersion);
    return folder === '' ? safeName : `${folder}/${safeName}`;
  }

  private updateExportEnabled(): void {
    const destPath = this.computeDestPath();
    this.exportBtn.disabled = !(destPath !== null && !this.hasFileCollision);
    // Submit shares no vault preflight (nothing is written to the vault).
    if (this.submitBtn !== undefined) this.submitBtn.disabled = false;
  }

  /** Build the bundle fresh and open the submit modal (Variant B moderation flow). */
  private async handleSubmitToCommunity(authorDisplayName: string): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.submitBtn.disabled = true;
    const build: BuildResult = await this.buildBundle(authorDisplayName);
    if (build.status === 'failed') {
      this.statusEl.setText(t('library.exportError', { reason: build.reason }));
      this.submitBtn.disabled = false;
      return;
    }
    this.rememberSubmittedVersion();
    // Empty override → the submit modal falls back to DEFAULT_REGISTRY_URL
    // (the bundled primary mirror) via its own normalizeRegistryUrl default.
    const registryBaseUrl = this.plugin.settings.libraryRegistryUrl?.trim() || DEFAULT_REGISTRY_URL;
    new LibrarySubmitModal(this.app, this.plugin, build.bundle, { registryBaseUrl }).open();
  }

  private async handleExport(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const destPath = this.computeDestPath();
    if (destPath === null) return;
    this.exportBtn.disabled = true;
    const build: BuildResult = await this.buildBundle('');
    if (build.status === 'failed') {
      this.statusEl.setText(t('library.exportError', { reason: build.reason }));
      this.exportBtn.disabled = false;
      return;
    }
    if (build.collisionWith !== undefined) {
      // FR-7: informational warning — a same-slug package is installed (post-fix they coexist).
      this.statusEl.setText(t('library.exportCollisionWarning', { existing: build.collisionWith }));
    }
    try {
      await this.plugin.libraryService.writePackageExport(build.bundle, destPath);
      new Notice(t('library.exportedNotice', { path: destPath }));
      this.safeResolve({ exported: true, path: destPath });
      this.close();
    } catch (e) {
      this.statusEl.setText(t('library.exportError', { reason: (e as Error)?.message ?? String(e) }));
      this.exportBtn.disabled = false;
    }
  }

  private async buildBundle(authorDisplayName: string): Promise<BuildResult> {
    return this.plugin.libraryService.buildLocalPackage(this.protocolPath, {
      packageId: this.packageId,
      releaseVersion: this.releaseVersion,
      author: authorDisplayName.trim() === '' ? undefined : { displayName: authorDisplayName.trim() },
    });
  }

  /** Persist `<packageId>: <version>` so the next open suggests +0.0.1. */
  private rememberSubmittedVersion(): void {
    const versions = this.plugin.settings.libraryLastSubmittedVersions ?? {};
    versions[this.packageId] = this.releaseVersion;
    this.plugin.settings.libraryLastSubmittedVersions = versions;
    void this.plugin.saveSettings();
  }
}

/** `<slug(packageId)>-<slug(version)>.json` — mirrors package-metadata.exportFileName. */
function exportBundleFileName(packageId: string, version: string): string {
  return `${derivePackageId(packageId)}-${version}.json`;
}
