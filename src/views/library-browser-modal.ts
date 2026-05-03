// views/library-browser-modal.ts
// Phase 86 (TEMPLATE-LIB-02): browse and install snippets from an external library.
import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { LibrarySnippetEntry } from '../snippets/library-model';

export class LibraryBrowserModal extends Modal {
  private readonly plugin: RadiProtocolPlugin;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText(this.plugin.i18n.t('library.title'));

    const index = await this.plugin.libraryService.fetchIndex();
    if (index === null) {
      this.contentEl.createEl('p', {
        text: this.plugin.i18n.t('library.loadError'),
        cls: 'rp-library-error',
      });
      return;
    }

    // Group by category
    const byCategory = new Map<string, LibrarySnippetEntry[]>();
    for (const entry of index.snippets) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }

    for (const [category, entries] of byCategory) {
      this.contentEl.createEl('h3', {
        text: category,
        cls: 'rp-library-category-heading',
      });
      for (const entry of entries) {
        const row = this.contentEl.createDiv({ cls: 'rp-library-entry' });
        const info = row.createDiv({ cls: 'rp-library-entry-info' });
        info.createEl('div', {
          text: entry.name,
          cls: 'rp-library-entry-name',
        });
        if (entry.description) {
          info.createEl('div', {
            text: entry.description,
            cls: 'rp-library-entry-desc',
          });
        }
        const installBtn = row.createEl('button', {
          cls: 'mod-cta rp-library-install-btn',
        });
        installBtn.setText(this.plugin.i18n.t('library.install'));
        installBtn.addEventListener('click', () => {
          installBtn.setText(this.plugin.i18n.t('library.installing'));
          installBtn.disabled = true;
          void this.plugin.libraryService.installSnippet(entry).then((ok) => {
            if (ok) {
              new Notice(this.plugin.i18n.t('library.installed', { name: entry.name }));
              installBtn.setText(this.plugin.i18n.t('library.installedLabel'));
            } else {
              installBtn.setText(this.plugin.i18n.t('library.installFailed'));
              installBtn.disabled = false;
            }
          });
        });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
