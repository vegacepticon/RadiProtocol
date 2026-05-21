// views/library-admin-modal.ts
// Admin UI for managing the local RadiProtocol-Library repo.
// Import from vault, edit metadata, delete, validate, regenerate indexes.
import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { LibraryAdminService } from '../snippets/library-admin';
import type { LibrarySnippetEntry } from '../snippets/library-model';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';

type TabId = 'snippets' | 'protocols';

export class LibraryAdminModal extends Modal {
  private plugin: RadiProtocolPlugin;
  private admin: LibraryAdminService | null = null;
  private currentTab: TabId = 'snippets';
  private statusEl: HTMLElement;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app);
    this.plugin = plugin;
    this.containerEl.addClass('rp-library-admin-modal');
    this.modalEl.addClass('rp-library-admin-modal-container');
    this.statusEl = document.createElement('div');
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Check maintainer mode and repo path
    if (!this.plugin.settings.libraryMaintainerMode) {
      contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
      contentEl.createEl('p', { text: this.plugin.i18n.t('admin.maintainerModeDisabled') });
      contentEl.createEl('p', { text: this.plugin.i18n.t('admin.enableInSettings') });
      return;
    }

    const repoPath = this.plugin.settings.libraryRepoPath?.trim();
    if (!repoPath) {
      contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
      contentEl.createEl('p', { text: this.plugin.i18n.t('admin.noRepoPath') });
      contentEl.createEl('p', { text: this.plugin.i18n.t('admin.setRepoInSettings') });
      return;
    }

    this.admin = new LibraryAdminService(repoPath, this.plugin.i18n.t.bind(this.plugin.i18n));

    // Validate repo path
    void this.admin.validateRepoPath().then((result) => {
      if (!result.valid) {
        contentEl.empty();
        contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
        contentEl.createEl('p', { text: this.plugin.i18n.t('admin.invalidRepo') });
        contentEl.createEl('p', { text: result.error ?? 'Unknown error', cls: 'rp-admin-error' });
        return;
      }
      this.renderAdmin(contentEl);
    });
  }

  private renderAdmin(contentEl: HTMLElement): void {
    contentEl.empty();

    // Title
    contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });

    // Toolbar: Pull + Validate + Regenerate + Copy commands
    const toolbar = contentEl.createDiv({ cls: 'rp-admin-toolbar' });

    new Setting(toolbar)
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.pullLatest'))
        .onClick(() => { void this.handlePullLatest(); }))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.resetToRemote'))
        .onClick(() => { void this.handleResetToRemote(); }))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.validateAll'))
        .onClick(() => { void this.handleValidate(); }))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.regenerateIndexes'))
        .onClick(() => { void this.handleRegenerate(); }))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.copyGitCommands'))
        .onClick(() => { void this.handleCopyGitCommands(); }));

    // Status area
    this.statusEl = contentEl.createDiv({ cls: 'rp-admin-status' });

    // Tab selector
    const tabContainer = contentEl.createDiv({ cls: 'rp-admin-tabs' });
    const snippetTab = tabContainer.createEl('button', {
      text: this.plugin.i18n.t('admin.snippetsTab'),
      cls: 'rp-admin-tab' + (this.currentTab === 'snippets' ? ' rp-admin-tab-active' : ''),
    });
    snippetTab.addEventListener('click', () => {
      this.currentTab = 'snippets';
      this.renderAdminContent(contentEl);
    });

    const protocolTab = tabContainer.createEl('button', {
      text: this.plugin.i18n.t('admin.protocolsTab'),
      cls: 'rp-admin-tab' + (this.currentTab === 'protocols' ? ' rp-admin-tab-active' : ''),
    });
    protocolTab.addEventListener('click', () => {
      this.currentTab = 'protocols';
      this.renderAdminContent(contentEl);
    });

    // Content area
    contentEl.createDiv({ cls: 'rp-admin-content', attr: { id: 'rp-admin-content' } });

    this.renderAdminContent(contentEl);
  }

  private renderAdminContent(contentEl: HTMLElement): void {
    const contentArea = contentEl.querySelector('#rp-admin-content') as HTMLElement;
    if (!contentArea) return;
    contentArea.empty();

    // Update tab active states
    const tabs = contentEl.querySelectorAll('.rp-admin-tab');
    tabs.forEach((tab) => {
      tab.removeClass('rp-admin-tab-active');
    });
    const activeIdx = this.currentTab === 'snippets' ? 0 : 1;
    tabs[activeIdx]?.addClass('rp-admin-tab-active');

    if (this.currentTab === 'snippets') {
      this.renderSnippetsTab(contentArea);
    } else {
      this.renderProtocolsTab(contentArea);
    }
  }

  private renderSnippetsTab(contentArea: HTMLElement): void {
    // Import button
    new Setting(contentArea)
      .setName(this.plugin.i18n.t('admin.importSnippet'))
      .setDesc(this.plugin.i18n.t('admin.importSnippetDesc'))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.importSnippetBtn'))
        .onClick(() => { void this.handleImportSnippet(); }));

    // List snippets
    void this.admin!.readSnippetIndex().then((index) => {
      if (!index || index.snippets.length === 0) {
        contentArea.createEl('p', { text: this.plugin.i18n.t('admin.noSnippets'), cls: 'rp-admin-empty' });
        return;
      }

      const list = contentArea.createDiv({ cls: 'rp-admin-list' });

      // Group by category
      const byCategory = new Map<string, LibrarySnippetEntry[]>();
      for (const entry of index.snippets) {
        const cat = entry.category || 'General';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(entry);
      }

      for (const [category, entries] of byCategory) {
        list.createEl('h4', { text: category, cls: 'rp-admin-category' });
        for (const entry of entries) {
          const row = list.createDiv({ cls: 'rp-admin-entry' });
          const info = row.createDiv({ cls: 'rp-admin-entry-info' });
          info.createEl('span', { text: entry.name, cls: 'rp-admin-entry-name' });
          info.createEl('span', { text: entry.path, cls: 'rp-admin-entry-path' });

          const actions = row.createDiv({ cls: 'rp-admin-entry-actions' });
          actions.createEl('button', {
            text: this.plugin.i18n.t('admin.edit'),
            cls: 'rp-admin-btn rp-admin-btn-edit',
          }).addEventListener('click', () => {
            this.openEditSnippetModal(entry);
          });
          actions.createEl('button', {
            text: this.plugin.i18n.t('admin.delete'),
            cls: 'rp-admin-btn rp-admin-btn-delete',
          }).addEventListener('click', () => {
            void this.handleDeleteSnippet(entry);
          });
        }
      }
    });
  }

  private renderProtocolsTab(contentArea: HTMLElement): void {
    // Import button
    new Setting(contentArea)
      .setName(this.plugin.i18n.t('admin.importProtocol'))
      .setDesc(this.plugin.i18n.t('admin.importProtocolDesc'))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.importProtocolBtn'))
        .onClick(() => { void this.handleImportProtocol(); }));

    // List protocols
    void this.admin!.readProtocolIndex().then((index) => {
      if (!index || index.protocols.length === 0) {
        contentArea.createEl('p', { text: this.plugin.i18n.t('admin.noProtocols'), cls: 'rp-admin-empty' });
        return;
      }

      const list = contentArea.createDiv({ cls: 'rp-admin-list' });
      for (const entry of index.protocols) {
        const row = list.createDiv({ cls: 'rp-admin-entry' });
        const info = row.createDiv({ cls: 'rp-admin-entry-info' });
        info.createEl('span', { text: entry.title, cls: 'rp-admin-entry-name' });
        info.createEl('span', {
          text: `${entry.nodes ?? 0} nodes · ${entry.edges ?? 0} edges`,
          cls: 'rp-admin-entry-meta',
        });
        info.createEl('span', { text: entry.path, cls: 'rp-admin-entry-path' });

        const actions = row.createDiv({ cls: 'rp-admin-entry-actions' });
        actions.createEl('button', {
          text: this.plugin.i18n.t('admin.edit'),
          cls: 'rp-admin-btn rp-admin-btn-edit',
        }).addEventListener('click', () => {
          this.openEditProtocolModal(entry);
        });
        actions.createEl('button', {
          text: this.plugin.i18n.t('admin.delete'),
          cls: 'rp-admin-btn rp-admin-btn-delete',
        }).addEventListener('click', () => {
          void this.handleDeleteProtocol(entry);
        });
      }
    });
  }

  // ─── Snippet actions ────────────────────────────────────────────────

  private async handleImportSnippet(): Promise<void> {
    // List snippet files in vault
    const folder = this.plugin.settings.snippetFolderPath;
    const files = this.listVaultSnippetFiles(folder);
    if (files.length === 0) {
      new Notice(this.plugin.i18n.t('admin.noVaultSnippets'));
      return;
    }

    // Show picker
    const modal = new ImportSnippetPickerModal(this.app, files, this.plugin, async (file) => {
      try {
        const content = await this.app.vault.read(file);
        const parsed = JSON.parse(content);
        const name = typeof parsed.name === 'string' && parsed.name.trim() !== ''
          ? parsed.name.trim()
          : file.basename;
        // Prompt for category and description
        this.openImportSnippetDetailsModal(content, name);
      } catch {
        new Notice(this.plugin.i18n.t('admin.readFailed'));
      }
    });
    modal.open();
  }

  private listVaultSnippetFiles(folderPath: string): TFile[] {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return [];
    const out: TFile[] = [];
    const walk = (f: TFolder): void => {
      for (const child of f.children) {
        if (child instanceof TFolder) walk(child);
        else if (child instanceof TFile && child.extension === 'json' && !child.path.includes('Library')) {
          out.push(child);
        }
      }
    };
    walk(folder);
    return out;
  }

  private openImportSnippetDetailsModal(content: string, suggestedName: string): void {
    const modal = new ImportDetailsModal(
      this.app,
      this.plugin.i18n.t('admin.importSnippetDetails'),
      suggestedName,
      async (details) => {
        if (!this.admin) return;
        const result = await this.admin.importSnippetFromVault(
          content,
          details.category,
          details.name || suggestedName,
          undefined,
          details.description || undefined,
        );
        if (result) {
          void this.refreshAdmin();
        }
      },
      this.plugin,
    );
    modal.open();
  }

  private openEditSnippetModal(entry: LibrarySnippetEntry): void {
    const modal = new EditSnippetMetadataModal(this.app, entry, this.plugin, async (updates) => {
      if (!this.admin) return;
      const result = await this.admin.updateSnippetMetadata(entry, updates);
      if (result) {
        void this.refreshAdmin();
      }
    });
    modal.open();
  }

  private async handleDeleteSnippet(entry: LibrarySnippetEntry): Promise<void> {
    if (!this.admin) return;
    if (!confirm(this.plugin.i18n.t('admin.confirmDeleteSnippet', { name: entry.name }))) return;
    const ok = await this.admin.deleteSnippet(entry);
    if (ok) {
      void this.refreshAdmin();
    }
  }

  // ─── Protocol actions ───────────────────────────────────────────────

  private async handleImportProtocol(): Promise<void> {
    const folder = this.plugin.settings.protocolFolderPath;
    if (!folder) {
      new Notice(this.plugin.i18n.t('admin.noProtocolFolder'));
      return;
    }

    const files = this.listVaultProtocolFiles(folder);
    if (files.length === 0) {
      new Notice(this.plugin.i18n.t('admin.noVaultProtocols'));
      return;
    }

    const modal = new ImportProtocolPickerModal(this.app, files, this.plugin, async (file) => {
      try {
        const content = await this.app.vault.read(file);
        const parsed = JSON.parse(content);
        const title = typeof parsed.title === 'string' && parsed.title.trim() !== ''
          ? parsed.title.trim()
          : file.basename;
        this.openImportProtocolDetailsModal(content, title);
      } catch {
        new Notice(this.plugin.i18n.t('admin.readFailed'));
      }
    });
    modal.open();
  }

  private listVaultProtocolFiles(folderPath: string): TFile[] {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return [];
    const out: TFile[] = [];
    const walk = (f: TFolder): void => {
      for (const child of f.children) {
        if (child instanceof TFolder) walk(child);
        else if (child instanceof TFile && child.extension === 'json' && child.name.endsWith('.rp.json')) {
          out.push(child);
        }
      }
    };
    walk(folder);
    return out;
  }

  private openImportProtocolDetailsModal(content: string, suggestedTitle: string): void {
    const modal = new ImportDetailsModal(
      this.app,
      this.plugin.i18n.t('admin.importProtocolDetails'),
      suggestedTitle,
      async (details) => {
        if (!this.admin) return;
        const result = await this.admin.importProtocolFromVault(
          content,
          details.category,
          details.description || undefined,
        );
        if (result) {
          void this.refreshAdmin();
        }
      },
      this.plugin,
      true, // isProtocol
    );
    modal.open();
  }

  private openEditProtocolModal(entry: ProtocolLibraryEntry): void {
    const modal = new EditProtocolMetadataModal(this.app, entry, this.plugin, async (updates) => {
      if (!this.admin) return;
      const result = await this.admin.updateProtocolMetadata(entry, updates);
      if (result) {
        void this.refreshAdmin();
      }
    });
    modal.open();
  }

  private async handleDeleteProtocol(entry: ProtocolLibraryEntry): Promise<void> {
    if (!this.admin) return;
    if (!confirm(this.plugin.i18n.t('admin.confirmDeleteProtocol', { title: entry.title }))) return;
    const ok = await this.admin.deleteProtocol(entry);
    if (ok) {
      void this.refreshAdmin();
    }
  }

  // ─── Toolbar actions ────────────────────────────────────────────────

  private async handlePullLatest(): Promise<void> {
    if (!this.admin) return;
    this.setStatus(this.plugin.i18n.t('admin.pullingLatest'));
    const result = await this.admin.gitPull();
    if (result.success) {
      const output = result.output.trim();
      this.setStatus(output || this.plugin.i18n.t('admin.upToDate'));
      new Notice(this.plugin.i18n.t('admin.upToDate'));
    } else {
      this.setStatus(result.output);
      new Notice(result.output, 8000);
    }
    this.refreshAdmin();
  }

  private async handleResetToRemote(): Promise<void> {
    if (!this.admin) return;
    const message = this.plugin.i18n.t('admin.confirmResetToRemote');
    if (!confirm(message)) return;
    this.setStatus(this.plugin.i18n.t('admin.resettingToRemote'));
    const result = await this.admin.gitResetToOriginMain();
    if (result.success) {
      this.setStatus(result.output || this.plugin.i18n.t('admin.resetSuccess'));
      new Notice(this.plugin.i18n.t('admin.resetSuccess'));
    } else {
      this.setStatus(result.output);
      new Notice(result.output, 8000);
    }
    this.refreshAdmin();
  }

  private async handleValidate(): Promise<void> {
    if (!this.admin) return;
    this.setStatus(this.plugin.i18n.t('admin.validating'));
    const result = await this.admin.validateSnippets();
    if (result.valid) {
      this.setStatus(this.plugin.i18n.t('admin.validationPassed'));
    } else {
      this.setStatus(this.plugin.i18n.t('admin.validationFailed') + '\n' + result.errors.join('\n'));
    }
  }

  private async handleRegenerate(): Promise<void> {
    if (!this.admin) return;
    this.setStatus(this.plugin.i18n.t('admin.regenerating'));
    try {
      await this.admin.regenerateIndexes();
      this.setStatus(this.plugin.i18n.t('admin.regenerateSuccess'));
    } catch (err) {
      this.setStatus(this.plugin.i18n.t('admin.regenerateFailed', { error: String(err) }));
    }
  }

  private async handleCopyGitCommands(): Promise<void> {
    if (!this.admin) return;
    const commands = this.admin.getGitPushCommands();
    await navigator.clipboard.writeText(commands);
    new Notice(this.plugin.i18n.t('admin.copiedToClipboard'));
  }

  private setStatus(text: string): void {
    this.statusEl.setText(text);
  }

  private refreshAdmin(): void {
    this.renderAdmin(this.contentEl);
  }
}

// ─── Helper modals ────────────────────────────────────────────────────

class ImportSnippetPickerModal extends Modal {
  constructor(
    app: App,
    private files: TFile[],
    private plugin: RadiProtocolPlugin,
    private onSelect: (file: TFile) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.selectSnippet') });

    for (const file of this.files) {
      new Setting(contentEl)
        .setName(file.basename)
        .setDesc(file.path)
        .addButton(btn => btn
          .setButtonText(this.plugin.i18n.t('admin.select'))
          .onClick(() => {
            this.close();
            this.onSelect(file);
          }));
    }
  }
}

class ImportProtocolPickerModal extends Modal {
  constructor(
    app: App,
    private files: TFile[],
    private plugin: RadiProtocolPlugin,
    private onSelect: (file: TFile) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.selectProtocol') });

    for (const file of this.files) {
      new Setting(contentEl)
        .setName(file.basename)
        .setDesc(file.path)
        .addButton(btn => btn
          .setButtonText(this.plugin.i18n.t('admin.select'))
          .onClick(() => {
            this.close();
            this.onSelect(file);
          }));
    }
  }
}

class ImportDetailsModal extends Modal {
  private nameInput: string;
  private categoryInput: string;
  private descriptionInput: string;

  constructor(
    app: App,
    title: string,
    suggestedName: string,
    private onSubmit: (details: { name: string; category: string; description: string }) => void,
    private plugin: RadiProtocolPlugin,
    private isProtocol = false,
  ) {
    super(app);
    this.nameInput = suggestedName;
    this.categoryInput = '';
    this.descriptionInput = '';
    this.titleEl.setText(title);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.nameLabel'))
      .addText(text => text
        .setValue(this.nameInput)
        .onChange(v => { this.nameInput = v; }));

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.categoryLabel'))
      .addText(text => text
        .setPlaceholder(this.isProtocol ? 'e.g. CT, X-ray' : 'e.g. ГМ, Грудная клетка')
        .onChange(v => { this.categoryInput = v; }));

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.descriptionLabel'))
      .addText(text => text
        .setPlaceholder(this.plugin.i18n.t('admin.descriptionPlaceholder'))
        .onChange(v => { this.descriptionInput = v; }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.importConfirm'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit({
            name: this.nameInput,
            category: this.categoryInput,
            description: this.descriptionInput,
          });
        }));
  }
}

class EditSnippetMetadataModal extends Modal {
  private categoryInput: string;
  private descriptionInput: string;

  constructor(
    app: App,
    private entry: LibrarySnippetEntry,
    private plugin: RadiProtocolPlugin,
    private onSubmit: (updates: { category?: string; description?: string }) => void,
  ) {
    super(app);
    this.categoryInput = entry.category;
    this.descriptionInput = entry.description;
    this.titleEl.setText(plugin.i18n.t('admin.editSnippet', { name: entry.name }));
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.nameLabel'))
      .setDesc(this.entry.name)
      .setDisabled(true);

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.categoryLabel'))
      .addText(text => text
        .setValue(this.categoryInput)
        .onChange(v => { this.categoryInput = v; }));

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.descriptionLabel'))
      .addText(text => text
        .setValue(this.descriptionInput)
        .onChange(v => { this.descriptionInput = v; }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.save'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit({
            category: this.categoryInput,
            description: this.descriptionInput,
          });
        }));
  }
}

class EditProtocolMetadataModal extends Modal {
  private descriptionInput: string;

  constructor(
    app: App,
    private entry: ProtocolLibraryEntry,
    private plugin: RadiProtocolPlugin,
    private onSubmit: (updates: { description?: string }) => void,
  ) {
    super(app);
    this.descriptionInput = entry.description ?? '';
    this.titleEl.setText(plugin.i18n.t('admin.editProtocol', { title: entry.title }));
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.nameLabel'))
      .setDesc(this.entry.title)
      .setDisabled(true);

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.descriptionLabel'))
      .addText(text => text
        .setValue(this.descriptionInput)
        .onChange(v => { this.descriptionInput = v; }));

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.save'))
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit({ description: this.descriptionInput });
        }));
  }
}