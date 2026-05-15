import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { Snippet } from '../snippets/snippet-model';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import { SnippetTreePicker } from './snippet-tree-picker';

export class InsertSnippetModal extends Modal {
  readonly result: Promise<string | null>;
  private resolve!: (value: string | null) => void;
  private resolved = false;
  private picker: SnippetTreePicker | null = null;

  constructor(app: App, private readonly plugin: RadiProtocolPlugin) {
    super(app);
    this.result = new Promise<string | null>((res) => {
      this.resolve = res;
    });
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
    titleEl.setText(this.plugin.i18n.t('insertSnippet.title'));

    const rootPath = this.plugin.settings.snippetFolderPath.trim();
    if (rootPath === '') {
      contentEl.createEl('p', { text: this.plugin.i18n.t('insertSnippet.setSnippetFolderFirst') });
      return;
    }

    const pickerHost = contentEl.createDiv({ cls: 'rp-insert-snippet-picker-host' });
    this.picker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost,
      mode: 'file-only',
      rootPath,
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
      onSelect: (result) => {
        void this.handleSelect(rootPath, result.relativePath);
      },
    });
    void this.picker.mount();
  }

  onClose(): void {
    this.picker?.unmount();
    this.picker = null;
    this.safeResolve(null);
    this.contentEl.empty();
  }

  private async handleSelect(rootPath: string, relativePath: string): Promise<void> {
    const path = relativePath === '' ? rootPath : `${rootPath}/${relativePath}`;
    const snippet = await this.plugin.snippetService.load(path);
    if (snippet === null) {
      new Notice(this.plugin.i18n.t('insertSnippet.notFound', { path }));
      return;
    }
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(this.plugin.i18n.t('insertSnippet.cannotBeUsed', { path, error: snippet.validationError }));
      return;
    }

    const rendered = await this.renderSnippetForInsert(snippet);
    if (rendered === null) return;
    this.safeResolve(rendered);
    super.close();
  }

  private async renderSnippetForInsert(snippet: Snippet): Promise<string | null> {
    if (snippet.kind === 'md') return snippet.content;
    if (snippet.placeholders.length === 0) return snippet.template;

    const fillModal = new SnippetFillInModal(this.app, snippet);
    fillModal.open();
    return fillModal.result;
  }

  private safeResolve(value: string | null): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(value);
  }
}
