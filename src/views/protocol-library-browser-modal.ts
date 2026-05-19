// src/views/protocol-library-browser-modal.ts
// Browse and install protocols from an external protocol library.
import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';

export class ProtocolLibraryBrowserModal extends Modal {
  private readonly plugin: RadiProtocolPlugin;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText(this.plugin.i18n.t('protocolLibrary.title'));

    const index = await this.plugin.protocolLibraryService.fetchIndex();
    if (index === null) {
      this.contentEl.createEl('p', {
        text: this.plugin.i18n.t('protocolLibrary.loadError'),
        cls: 'rp-library-error',
      });
      return;
    }

    if (index.protocols.length === 0) {
      this.contentEl.createEl('p', {
        text: this.plugin.i18n.t('protocolLibrary.empty'),
        cls: 'rp-library-empty',
      });
      return;
    }

    for (const entry of index.protocols) {
      this.renderProtocolRow(entry);
    }
  }

  private renderProtocolRow(entry: ProtocolLibraryEntry): void {
    const row = this.contentEl.createDiv({ cls: 'rp-library-entry rp-protocol-library-entry' });
    const info = row.createDiv({ cls: 'rp-library-entry-info' });
    info.createEl('div', {
      text: entry.title,
      cls: 'rp-library-entry-name',
    });

    const metaParts: string[] = [];
    if (entry.description) metaParts.push(entry.description);
    if (typeof entry.nodes === 'number') metaParts.push(this.plugin.i18n.t('protocolLibrary.nodes', { count: String(entry.nodes) }));
    if (typeof entry.edges === 'number') metaParts.push(this.plugin.i18n.t('protocolLibrary.edges', { count: String(entry.edges) }));
    if (metaParts.length > 0) {
      info.createEl('div', {
        text: metaParts.join(' · '),
        cls: 'rp-library-entry-desc',
      });
    }

    const installBtn = row.createEl('button', {
      cls: 'mod-cta rp-library-install-btn',
    });
    installBtn.setText(this.plugin.i18n.t('protocolLibrary.install'));
    installBtn.addEventListener('click', () => {
      installBtn.setText(this.plugin.i18n.t('protocolLibrary.installing'));
      installBtn.disabled = true;
      void this.plugin.protocolLibraryService.installProtocol(entry).then((targetPath) => {
        if (targetPath !== null) {
          new Notice(this.plugin.i18n.t('protocolLibrary.installed', { title: entry.title }));
          installBtn.setText(this.plugin.i18n.t('protocolLibrary.installedLabel'));
          void this.plugin.activateProtocolEditorView(targetPath);
        } else {
          installBtn.setText(this.plugin.i18n.t('protocolLibrary.installFailed'));
          installBtn.disabled = false;
        }
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
