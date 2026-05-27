// src/views/protocol-picker-modal.ts
// Suggest modals for choosing or creating .rp.json protocol documents.

import { SuggestModal, TFile, type App } from 'obsidian';

export type ProtocolPickerSuggestion = { file: TFile; name: string };

export type ProtocolEditorPickerSuggestion =
  | { kind: 'existing'; file: TFile; name: string }
  | { kind: 'create'; title: string };

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
  }

  onChooseSuggestion(item: ProtocolPickerSuggestion): void {
    this.onChoose(item);
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
  }

  onChooseSuggestion(item: ProtocolEditorPickerSuggestion): void {
    if (item.kind === 'create') {
      this.onCreate(item.title);
      return;
    }
    this.onOpenExisting(item.file);
  }
}
