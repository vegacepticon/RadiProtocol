// src/views/protocol-picker-modal.ts
// Suggest modals for choosing or creating .rp.json protocol documents.
//
// Slice 8 — component-level library-managed indicator: both SuggestModals
// accept an optional LibraryPickerContext and render a badge for library-
// managed protocols when provided. Runtime wiring (passing listInstalled() +
// the protocol root) is done by the caller in Slice 9 (main.ts). When the
// context is omitted the pickers behave exactly as before.

import { SuggestModal, TFile, type App } from 'obsidian';
import type { Translator } from '../i18n';
import type { InstalledRecord } from '../library/library-model';
import { isLibraryManagedPath, findInstalledRecordForPath } from '../library/library-paths';

export type ProtocolPickerSuggestion = { file: TFile; name: string };

export type ProtocolEditorPickerSuggestion =
  | { kind: 'existing'; file: TFile; name: string }
  | { kind: 'create'; title: string };

/** Slice 8 — context for the library-managed indicator badge on picker
 *  suggestions. Optional; when omitted the picker behaves as before.
 *  Runtime wiring is done by the caller in Slice 9 (main.ts). */
export interface LibraryPickerContext {
  /** Vault-relative protocol root (e.g. 'Protocols') for managed-path detection. */
  protocolRoot: string;
  /** Current installed records (from LibraryService.listInstalled()). */
  installedRecords: readonly InstalledRecord[];
}

export function protocolDisplayName(file: TFile): string {
  return file.basename.replace(/\.rp$/, '');
}

export function protocolDocumentId(): string {
  return `protocol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ProtocolPickerSuggestModal extends SuggestModal<ProtocolPickerSuggestion> {
  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly onChoose: (item: ProtocolPickerSuggestion) => void,
    private readonly libraryContext?: LibraryPickerContext,
    private readonly t?: Translator,
  ) {
    super(app);
  }

  getSuggestions(query: string): ProtocolPickerSuggestion[] {
    const q = query.toLowerCase();
    return this.protocolFiles
      .map(f => ({ file: f, name: protocolDisplayName(f) }))
      .filter(item => item.name.toLowerCase().includes(q));
  }

  renderSuggestion(item: ProtocolPickerSuggestion, el: HTMLElement): void {
    el.createEl('div', { text: item.name });
    this.renderLibraryBadge(item.file.path, el);
  }

  onChooseSuggestion(item: ProtocolPickerSuggestion): void {
    this.onChoose(item);
  }

  private renderLibraryBadge(path: string, el: HTMLElement): void {
    if (this.libraryContext === undefined || this.t === undefined) return;
    if (!isLibraryManagedPath(path, this.libraryContext.protocolRoot)) return;
    const record = findInstalledRecordForPath(this.libraryContext.installedRecords, path);
    const badge = el.createEl('span', { cls: 'radi-library-managed-badge' });
    const label = this.t('library.managedBadge');
    badge.setText(record !== null ? `${label} · ${record.packageId} @ ${record.releaseVersion}` : label);
  }
}

export class ProtocolEditorPickerModal extends SuggestModal<ProtocolEditorPickerSuggestion> {
  private lastQuery = '';

  constructor(
    app: App,
    private readonly protocolFiles: TFile[],
    private readonly t: (key: string, vars?: Record<string, string>) => string,
    private readonly onOpenExisting: (file: TFile) => void,
    private readonly onCreate: (title: string) => void,
    private readonly libraryContext?: LibraryPickerContext,
  ) {
    super(app);
    this.setPlaceholder(this.t('protocolEditor.openPickerPlaceholder'));
  }

  getSuggestions(query: string): ProtocolEditorPickerSuggestion[] {
    this.lastQuery = query.trim();
    const q = this.lastQuery.toLowerCase();
    const existing = this.protocolFiles
      .map(file => ({ kind: 'existing' as const, file, name: protocolDisplayName(file) }))
      .filter(item => item.name.toLowerCase().includes(q));

    if (this.lastQuery === '') return existing;
    if (existing.some(item => item.name.toLowerCase() === q)) return existing;
    return [{ kind: 'create', title: this.lastQuery }, ...existing];
  }

  renderSuggestion(item: ProtocolEditorPickerSuggestion, el: HTMLElement): void {
    if (item.kind === 'create') {
      el.createEl('div', { text: this.t('protocolEditor.createProtocolSuggestion', { title: item.title }) });
      el.createEl('small', { text: this.t('protocolEditor.createProtocolHint') });
      return;
    }
    el.createEl('div', { text: item.name });
    el.createEl('small', { text: item.file.path });
    this.renderLibraryBadge(item.file.path, el);
  }

  onChooseSuggestion(item: ProtocolEditorPickerSuggestion): void {
    if (item.kind === 'create') {
      this.onCreate(item.title);
      return;
    }
    this.onOpenExisting(item.file);
  }

  private renderLibraryBadge(path: string, el: HTMLElement): void {
    if (this.libraryContext === undefined) return;
    if (!isLibraryManagedPath(path, this.libraryContext.protocolRoot)) return;
    const record = findInstalledRecordForPath(this.libraryContext.installedRecords, path);
    const badge = el.createEl('span', { cls: 'radi-library-managed-badge' });
    const label = this.t('library.managedBadge');
    badge.setText(record !== null ? `${label} · ${record.packageId} @ ${record.releaseVersion}` : label);
  }
}
