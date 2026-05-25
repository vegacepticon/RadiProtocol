// views/library-admin/move-snippet-modal.ts
// Move snippet modal for library admin.
import { App, Modal, Notice } from 'obsidian';
import { createButton } from '../../utils/dom-helpers';
import type { LibraryAdminService } from '../../snippets/library-admin';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { I18nFn } from './types';

export class MoveSnippetModal extends Modal {
  private readonly admin: LibraryAdminService;
  private readonly entry: LibrarySnippetEntry;
  private readonly t: I18nFn;
  private readonly onComplete: () => void;

  private selectedPath: string;
  private currentParent: string;

  constructor(
    app: App,
    admin: LibraryAdminService,
    entry: LibrarySnippetEntry,
    t: I18nFn,
    onComplete: () => void,
  ) {
    super(app);
    this.admin = admin;
    this.entry = entry;
    this.t = t;
    this.onComplete = onComplete;
    this.currentParent = entry.path.substring(0, entry.path.lastIndexOf('/')) || 'snippets';
    this.selectedPath = this.currentParent;
  }

  async onOpen(): Promise<void> {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.t('admin.moveSnippet', { name: this.entry.name }));
    contentEl.empty();

    const hint = contentEl.createDiv({ cls: 'rp-admin-move-hint' });
    hint.setText(this.t('admin.moveSnippetHint', { current: this.currentParent }));

    const body = contentEl.createDiv({ cls: 'rp-admin-move-body' });
    const dirs = await this.admin.listSnippetDirectories();
    this.renderFolders(body, dirs);
  }

  private renderFolders(host: HTMLElement, allDirs: string[]): void {
    host.empty();

    const header = host.createDiv({ cls: 'rp-admin-move-path' });
    header.setText(this.selectedPath === 'snippets'
      ? 'snippets /'
      : this.selectedPath.replace('snippets/', 'snippets / '));

    const list = host.createDiv({ cls: 'rp-admin-move-folder-list' });

    if (this.currentParent !== 'snippets') {
      const parentDir = this.currentParent.substring(0, this.currentParent.lastIndexOf('/')) || 'snippets';
      const backItem = list.createDiv({ cls: 'rp-admin-move-folder-item rp-admin-move-folder-back' });
      backItem.createEl('span', { text: '← ..', cls: 'rp-admin-move-folder-back-label' });
      backItem.addEventListener('click', () => {
        this.currentParent = parentDir;
        this.selectedPath = parentDir;
        this.renderFolders(host, allDirs);
      });
    }

    const parentPrefix = this.currentParent === 'snippets' ? 'snippets/' : `${this.currentParent}/`;
    const subDirs = allDirs.filter(dir =>
      dir !== this.currentParent &&
      dir.startsWith(parentPrefix) &&
      !dir.substring(parentPrefix.length).includes('/')
    );

    for (const dir of subDirs) {
      const item = list.createDiv({ cls: 'rp-admin-move-folder-item' });
      if (dir === this.selectedPath) item.addClass('is-selected');

      item.createEl('span', { text: '📁', cls: 'rp-admin-move-folder-glyph' });
      item.createEl('span', {
        text: dir.replace('snippets/', '').split('/').join(' › '),
        cls: 'rp-admin-move-folder-name',
      });

      item.addEventListener('click', () => {
        this.selectedPath = dir;
        this.currentParent = dir;
        this.renderFolders(host, allDirs);
      });
    }

    if (subDirs.length === 0) {
      list.createDiv({ cls: 'rp-admin-move-empty', text: this.t('admin.emptyFolder') });
    }

    const btnRow = host.createDiv({ cls: 'modal-button-container' });
    createButton(btnRow, { text: this.t('confirm.cancel') })
      .addEventListener('click', () => this.close());

    const moveBtn = createButton(btnRow, { text: this.t('admin.moveConfirm'), cls: 'mod-cta' });
    moveBtn.setAttribute('aria-label', this.t('admin.moveConfirm'));
    moveBtn.addEventListener('click', async () => {
      const entryParent = this.entry.path.substring(0, this.entry.path.lastIndexOf('/')) || 'snippets';
      if (this.selectedPath === entryParent) {
        new Notice(this.t('admin.moveToSameError', { name: this.entry.name }));
        return;
      }
      const result = await this.admin.moveSnippetToDirectory(this.entry, this.selectedPath);
      if (result) this.onComplete();
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}