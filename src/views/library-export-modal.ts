// src/views/library-export-modal.ts
// Export-package modal (FR-6/D3): collects a destination folder (FolderSuggest) +
// filename + packageId/releaseVersion/author, calls LibraryService.buildLocalPackage
// (FR-5) → writePackageExport (single JSON in the vault). Promise-based Modal with
// safeResolve double-guard, modeled after LibraryItemDetailModal + SnippetEditorModal
// (create-mode). Surfaces the FR-7 collision warning (informational) + proceeds.

import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { FolderSuggest } from './folder-suggest';
import type { BuildResult } from '../library/library-service';
import { DEFAULT_REGISTRY_URL } from '../library/registry-client';
import { LibrarySubmitModal } from './library-submit-modal';

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
  private fileName = '';
  private packageId = '';
  private releaseVersion = '';
  private authorDisplayName = '';
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

    const folderRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    folderRow.createEl('label', { text: t('library.exportDestination'), attr: { for: 'radi-library-export-folder' } });
    const folderInput = folderRow.createEl('input', { cls: 'radi-library-export-folder', attr: { type: 'text' } });
    folderInput.placeholder = t('library.exportFolderPlaceholder');
    new FolderSuggest(this.app, folderInput);
    folderInput.addEventListener('input', () => { this.folderPath = folderInput.value; this.scheduleCollisionCheck(); });

    const nameRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    nameRow.createEl('label', { text: t('library.exportFilename'), attr: { for: 'radi-library-export-name' } });
    const nameInput = nameRow.createEl('input', { cls: 'radi-library-export-name', attr: { type: 'text' } });
    nameInput.placeholder = t('library.exportFilenamePlaceholder');
    nameInput.addEventListener('input', () => { this.fileName = nameInput.value; this.scheduleCollisionCheck(); });

    const pkgRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    pkgRow.createEl('label', { text: t('library.exportPackageId'), attr: { for: 'radi-library-export-pkgid' } });
    const pkgInput = pkgRow.createEl('input', { cls: 'radi-library-export-pkgid', attr: { type: 'text' } });
    pkgInput.placeholder = 'Example: chest-ct';
    pkgInput.addEventListener('input', () => { this.packageId = pkgInput.value; this.updateExportEnabled(); });

    const verRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    verRow.createEl('label', { text: t('library.exportReleaseVersion'), attr: { for: 'radi-library-export-version' } });
    const verInput = verRow.createEl('input', { cls: 'radi-library-export-version', attr: { type: 'text' } });
    verInput.placeholder = 'Example: 1.0.0';
    verInput.addEventListener('input', () => { this.releaseVersion = verInput.value; this.updateExportEnabled(); });

    const authorRow = contentEl.createDiv({ cls: 'radi-library-export-field' });
    authorRow.createEl('label', { text: t('library.exportAuthor'), attr: { for: 'radi-library-export-author' } });
    const authorInput = authorRow.createEl('input', { cls: 'radi-library-export-author', attr: { type: 'text' } });
    authorInput.placeholder = t('library.exportAuthorPlaceholder');
    authorInput.addEventListener('input', () => { this.authorDisplayName = authorInput.value; });

    this.statusEl = contentEl.createDiv({ cls: 'radi-library-export-status' });

    const actions = contentEl.createDiv({ cls: 'radi-library-export-actions' });
    this.exportBtn = actions.createEl('button', { cls: 'radi-library-detail-install mod-cta', attr: { 'aria-label': t('library.exportLabel') } });
    this.exportBtn.setText(t('library.exportLabel'));
    this.exportBtn.disabled = true;
    this.exportBtn.addEventListener('click', () => { void this.handleExport(); });
    // Variant B: submit the built package straight to the Community Library moderation
    // queue (/api/submit → PR). Shares the export preflight (packageId/version required);
    // builds its own bundle so it works even when the file write collides.
    this.submitBtn = actions.createEl('button', { cls: 'radi-library-detail-install', attr: { 'aria-label': t('library.submitLabel') } });
    this.submitBtn.setText(t('library.submitLabel'));
    this.submitBtn.disabled = true;
    this.submitBtn.addEventListener('click', () => { void this.handleSubmitToCommunity(); });
    const cancelBtn = actions.createEl('button', { cls: 'radi-library-detail-cancel', attr: { 'aria-label': t('library.cancel') } });
    cancelBtn.setText(t('library.cancel'));
    cancelBtn.addEventListener('click', () => { this.safeResolve({ exported: false }); this.close(); });
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
    const name = this.fileName.trim();
    if (name === '') return null;
    const safeName = name.endsWith('.json') ? name : `${name}.json`;
    return folder === '' ? safeName : `${folder}/${safeName}`;
  }

  private updateExportEnabled(): void {
    const destPath = this.computeDestPath();
    const metaReady = this.packageId.trim() !== '' && this.releaseVersion.trim() !== '';
    this.exportBtn.disabled = !(metaReady && destPath !== null && !this.hasFileCollision);
    // Submit shares the metadata preflight but not the file-collision one (nothing is
    // written to the vault).
    if (this.submitBtn !== undefined) this.submitBtn.disabled = !metaReady;
  }

  /** Build the bundle fresh and open the submit modal (Variant B moderation flow). */
  private async handleSubmitToCommunity(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.submitBtn.disabled = true;
    const build: BuildResult = await this.plugin.libraryService.buildLocalPackage(this.protocolPath, {
      packageId: this.packageId.trim(),
      releaseVersion: this.releaseVersion.trim(),
      author: this.authorDisplayName.trim() === '' ? undefined : { displayName: this.authorDisplayName.trim() },
    });
    if (build.status === 'failed') {
      this.statusEl.setText(t('library.exportError', { reason: build.reason }));
      this.updateExportEnabled();
      return;
    }
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
    const build: BuildResult = await this.plugin.libraryService.buildLocalPackage(this.protocolPath, {
      packageId: this.packageId.trim(),
      releaseVersion: this.releaseVersion.trim(),
      author: this.authorDisplayName.trim() === '' ? undefined : { displayName: this.authorDisplayName.trim() },
    });
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
}