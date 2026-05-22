// views/library-admin-modal.ts
// Admin UI for managing the local RadiProtocol-Library repo.
// Import from vault, edit metadata, delete, validate, regenerate indexes.
import { AbstractInputSuggest, App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { LibraryAdminService } from '../snippets/library-admin';
import type { LibraryAdminDirectoryEntry, LibraryAdminSection } from '../snippets/library-admin';
import type { LibrarySnippetEntry } from '../snippets/library-model';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';
import { createButton, createInput } from '../utils/dom-helpers';
import { SnippetTreePicker } from './snippet-tree-picker';

type TabId = LibraryAdminSection;
type AdminEntry = LibrarySnippetEntry | ProtocolLibraryEntry;

const SEARCH_DEBOUNCE_MS = 120;
const GLYPH_FOLDER = '\uD83D\uDCC1';
const GLYPH_JSON = '\uD83D\uDCC4';

interface AdminTreeNode {
  /** Filesystem slug (e.g. "gm", "obp") */
  name: string;
  /** Human-readable display name (e.g. "ГМ", "ОБП") */
  displayName: string;
  /** Full relative path (e.g. "snippets/gm") */
  path: string;
  children: Map<string, AdminTreeNode>;
  entries: AdminEntry[];
}

function entryTitle(entry: AdminEntry): string {
  return 'title' in entry ? entry.title : entry.name;
}

function nodePath(parentPath: string, name: string): string {
  return parentPath === '' ? name : `${parentPath}/${name}`;
}

export class LibraryAdminModal extends Modal {
  private plugin: RadiProtocolPlugin;
  private admin: LibraryAdminService | null = null;
  private currentTab: TabId = 'snippets';
  private statusEl: HTMLElement;
  private drillPath: string[] = [];
  private currentQuery = '';
  private searchInputEl: HTMLInputElement | null = null;
  private searchDebounceTimer: number | null = null;

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

    // Toolbar: Reset to remote + Update instructions
    const toolbar = contentEl.createDiv({ cls: 'rp-admin-toolbar' });

    new Setting(toolbar)
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.resetToRemote'))
        .onClick(() => { void this.handleResetToRemote(); }))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.updateInstructions'))
        .onClick(() => { void this.handleShowUpdateInstructions(); }));

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
      this.drillPath = [];
      this.clearSearch();
      this.renderAdminContent(contentEl);
    });

    const protocolTab = tabContainer.createEl('button', {
      text: this.plugin.i18n.t('admin.protocolsTab'),
      cls: 'rp-admin-tab' + (this.currentTab === 'protocols' ? ' rp-admin-tab-active' : ''),
    });
    protocolTab.addEventListener('click', () => {
      this.currentTab = 'protocols';
      this.drillPath = [];
      this.clearSearch();
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
    new Setting(contentArea)
      .setName(this.plugin.i18n.t('admin.importSnippet'))
      .setDesc(this.plugin.i18n.t('admin.importSnippetDesc'))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.importSnippetBtn'))
        .onClick(() => { void this.handleImportSnippet(); }));

    void this.renderTreeTab(contentArea, 'snippets');
  }

  private renderProtocolsTab(contentArea: HTMLElement): void {
    new Setting(contentArea)
      .setName(this.plugin.i18n.t('admin.importProtocol'))
      .setDesc(this.plugin.i18n.t('admin.importProtocolDesc'))
      .addButton(btn => btn
        .setButtonText(this.plugin.i18n.t('admin.importProtocolBtn'))
        .onClick(() => { void this.handleImportProtocol(); }));

    void this.renderTreeTab(contentArea, 'protocols');
  }

  private async renderTreeTab(contentArea: HTMLElement, section: LibraryAdminSection): Promise<void> {
    if (!this.admin) return;
    const treeHost = contentArea.createDiv({ cls: 'rp-admin-tree-root' });
    this.renderTreeToolbar(treeHost, section);

    const [directories, entries] = await Promise.all([
      this.admin.listDirectories(section),
      this.readSectionEntries(section),
    ]);

    // Read _meta.json display names for each directory
    const metaDisplayNameBySlug = new Map<string, string>();
    await Promise.all(directories.map(async (dir) => {
      const absPath = this.admin!.resolveRepoPathPublic(dir.path);
      const metaName = await this.admin!.readDirectoryDisplayName(absPath);
      if (metaName !== null) {
        // Key by the trailing slug segment for ensureNode lookup
        const slug = dir.name;
        metaDisplayNameBySlug.set(slug, metaName);
      }
    }));

    const tree = this.buildAdminTree(section, directories, entries, metaDisplayNameBySlug);
    const body = treeHost.createDiv({ cls: 'rp-admin-tree-body' });
    this.renderBreadcrumb(body, section);

    const query = this.currentQuery.trim();
    if (query !== '') {
      this.renderSearchResults(body, section, entries, query);
    } else {
      this.renderDirectory(body, section, this.findNodeByDrillPath(tree));
    }
  }

  private renderTreeToolbar(host: HTMLElement, section: LibraryAdminSection): void {
    const toolbar = host.createDiv({ cls: 'rp-admin-tree-toolbar' });
    const searchInput = createInput(toolbar, {
      cls: 'rp-admin-search-input',
      type: 'text',
      placeholder: this.plugin.i18n.t('admin.searchPlaceholder'),
      value: this.currentQuery,
    });
    this.searchInputEl = searchInput;
    searchInput.addEventListener('input', () => {
      this.currentQuery = searchInput.value;
      if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        this.renderAdminContent(this.contentEl);
      }, SEARCH_DEBOUNCE_MS) as unknown as number;
    });

    const newFolderBtn = createButton(toolbar, {
      cls: 'rp-admin-btn rp-admin-create-folder-btn',
      text: this.plugin.i18n.t('admin.createFolder'),
    });
    newFolderBtn.addEventListener('click', () => { void this.handleCreateDirectory(section); });
  }

  private renderBreadcrumb(host: HTMLElement, section: LibraryAdminSection): void {
    const breadcrumb = host.createDiv({ cls: 'rp-admin-breadcrumb' });
    const rootBtn = createButton(breadcrumb, {
      cls: this.drillPath.length === 0 ? 'rp-admin-crumb is-current' : 'rp-admin-crumb',
      text: section === 'snippets' ? this.plugin.i18n.t('admin.snippetsTab') : this.plugin.i18n.t('admin.protocolsTab'),
    });
    rootBtn.addEventListener('click', () => {
      this.drillPath = [];
      this.clearSearch();
      this.renderAdminContent(this.contentEl);
    });

    this.drillPath.forEach((segment, index) => {
      breadcrumb.createEl('span', { cls: 'rp-admin-crumb-separator', text: '/' });
      const crumb = createButton(breadcrumb, {
        cls: index === this.drillPath.length - 1 ? 'rp-admin-crumb is-current' : 'rp-admin-crumb',
        text: segment,
      });
      crumb.addEventListener('click', () => {
        this.drillPath = this.drillPath.slice(0, index + 1);
        this.clearSearch();
        this.renderAdminContent(this.contentEl);
      });
    });
  }

  private renderDirectory(host: HTMLElement, section: LibraryAdminSection, node: AdminTreeNode): void {
    host.createDiv({
      cls: 'rp-admin-directory-meta',
      text: this.plugin.i18n.t('admin.directoryCount', { count: String(this.collectEntries(node).length) }),
    });

    // Folder tiles in a grid
    if (node.children.size > 0) {
      const grid = host.createDiv({ cls: 'rp-admin-folder-grid' });
      for (const child of node.children.values()) this.renderFolderTile(grid, section, child);
    }

    // Entry rows below the folder grid
    const list = host.createDiv({ cls: 'rp-admin-list rp-admin-tree-list' });
    for (const entry of node.entries) this.renderEntryRow(list, section, entry, false);
    if (node.children.size === 0 && list.children.length === 0) {
      list.createEl('div', { cls: 'rp-admin-empty', text: this.plugin.i18n.t('admin.emptyFolder') });
    }
  }

  private renderSearchResults(host: HTMLElement, section: LibraryAdminSection, entries: AdminEntry[], query: string): void {
    const matches = this.filterEntries(entries, query);
    host.createDiv({ cls: 'rp-admin-directory-meta', text: this.plugin.i18n.t('admin.searchResults', { count: String(matches.length) }) });
    const list = host.createDiv({ cls: 'rp-admin-list rp-admin-tree-list' });
    for (const entry of matches) this.renderEntryRow(list, section, entry, true);
    if (list.children.length === 0) {
      list.createEl('div', { cls: 'rp-admin-empty', text: this.plugin.i18n.t('admin.emptyResults') });
    }
  }

  private renderFolderTile(grid: HTMLElement, section: LibraryAdminSection, node: AdminTreeNode): void {
    const tile = grid.createDiv({ cls: 'rp-admin-folder-tile' });
    const openBtn = tile.createDiv({ cls: 'rp-admin-folder-tile-open' });
    const nameEl = openBtn.createEl('span', { cls: 'rp-admin-entry-name' });
    nameEl.createEl('span', { cls: 'rp-admin-row-glyph', text: GLYPH_FOLDER });
    nameEl.createEl('span', { cls: 'rp-admin-row-title', text: node.displayName });
    if (node.displayName !== node.name) {
      openBtn.createEl('span', { cls: 'rp-admin-entry-path', text: node.name });
    }
    openBtn.createEl('span', {
      cls: 'rp-admin-entry-meta',
      text: this.plugin.i18n.t('admin.directoryCount', { count: String(this.collectEntries(node).length) }),
    });
    openBtn.addEventListener('click', () => {
      this.drillPath.push(node.name);
      this.clearSearch();
      this.renderAdminContent(this.contentEl);
    });

    const actions = tile.createDiv({ cls: 'rp-admin-folder-tile-actions' });
    createButton(actions, { cls: 'rp-admin-btn rp-admin-btn-edit', text: this.plugin.i18n.t('admin.rename') })
      .addEventListener('click', () => { void this.handleRenameDirectory(section, node.path, node.displayName); });
    createButton(actions, { cls: 'rp-admin-btn rp-admin-btn-delete', text: this.plugin.i18n.t('admin.delete') })
      .addEventListener('click', () => { void this.handleDeleteDirectory(section, node.path); });
  }

  private renderEntryRow(list: HTMLElement, section: LibraryAdminSection, entry: AdminEntry, showPath: boolean): void {
    const row = list.createDiv({ cls: 'rp-admin-entry' });
    const info = row.createDiv({ cls: 'rp-admin-entry-info' });
    const nameEl = info.createEl('span', { cls: 'rp-admin-entry-name' });
    nameEl.createEl('span', { cls: 'rp-admin-row-glyph', text: GLYPH_JSON });
    nameEl.createEl('span', { cls: 'rp-admin-row-title', text: entryTitle(entry) });
    if (section === 'protocols' && 'nodes' in entry) {
      info.createEl('span', {
        text: this.plugin.i18n.t('admin.protocolMeta', { nodes: String(entry.nodes ?? 0), edges: String(entry.edges ?? 0) }),
        cls: 'rp-admin-entry-meta',
      });
    }
    info.createEl('span', { text: showPath ? entry.path : entry.path.split('/').pop() ?? entry.path, cls: 'rp-admin-entry-path' });

    const actions = row.createDiv({ cls: 'rp-admin-entry-actions' });
    createButton(actions, { text: this.plugin.i18n.t('admin.edit'), cls: 'rp-admin-btn rp-admin-btn-edit' })
      .addEventListener('click', () => {
        if (section === 'snippets') this.openEditSnippetModal(entry as LibrarySnippetEntry);
        else this.openEditProtocolModal(entry as ProtocolLibraryEntry);
      });
    createButton(actions, { text: this.plugin.i18n.t('admin.delete'), cls: 'rp-admin-btn rp-admin-btn-delete' })
      .addEventListener('click', () => {
        if (section === 'snippets') void this.handleDeleteSnippet(entry as LibrarySnippetEntry);
        else void this.handleDeleteProtocol(entry as ProtocolLibraryEntry);
      });
  }

  private async readSectionEntries(section: LibraryAdminSection): Promise<AdminEntry[]> {
    if (!this.admin) return [];
    if (section === 'snippets') return (await this.admin.readSnippetIndex())?.snippets ?? [];
    return (await this.admin.readProtocolIndex())?.protocols ?? [];
  }

  private buildAdminTree(section: LibraryAdminSection, directories: LibraryAdminDirectoryEntry[], entries: AdminEntry[], metaDisplayNameBySlug?: Map<string, string>): AdminTreeNode {
    const rootName = section === 'snippets' ? 'snippets' : 'protocols';
    const root: AdminTreeNode = { name: rootName, displayName: rootName, path: rootName, children: new Map(), entries: [] };

    // Build slug → human-readable name map from index entries
    const categoryBySlug = new Map<string, string>();
    if (section === 'snippets') {
      for (const entry of entries) {
        const s = entry as LibrarySnippetEntry;
        if (s.category) {
          const dirPart = s.path.split('/')[1] ?? '';
          if (dirPart && !categoryBySlug.has(dirPart)) categoryBySlug.set(dirPart, s.category);
        }
      }
    }

    const ensureNode = (relPath: string): AdminTreeNode => {
      const parts = relPath.split('/').filter(Boolean).slice(1);
      let node = root;
      for (const part of parts) {
        let child = node.children.get(part);
        if (!child) {
          // Priority: _meta.json displayName > index category > slug-based name
          const readableName = metaDisplayNameBySlug?.get(part) ?? categoryBySlug.get(part) ?? this.slugToDisplayName(part);
          child = { name: part, displayName: readableName, path: nodePath(node.path, part), children: new Map(), entries: [] };
          node.children.set(part, child);
        }
        node = child;
      }
      return node;
    };
    for (const directory of directories) ensureNode(directory.path);
    for (const entry of entries) ensureNode(entry.path.split('/').slice(0, -1).join('/')).entries.push(entry);
    this.sortTree(root);
    return root;
  }

  private sortTree(node: AdminTreeNode): void {
    node.entries.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b), undefined, { sensitivity: 'base' }));
    const sortedChildren = [...node.children.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
    node.children = new Map(sortedChildren.map(child => [child.name, child]));
    for (const child of node.children.values()) this.sortTree(child);
  }

  private slugToDisplayName(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map(part => part.length > 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
      .join(' ');
  }

  private findNodeByDrillPath(root: AdminTreeNode): AdminTreeNode {
    let node = root;
    const validPath: string[] = [];
    for (const segment of this.drillPath) {
      const child = node.children.get(segment);
      if (!child) break;
      validPath.push(segment);
      node = child;
    }
    this.drillPath = validPath;
    return node;
  }

  private collectEntries(node: AdminTreeNode): AdminEntry[] {
    const entries = [...node.entries];
    for (const child of node.children.values()) entries.push(...this.collectEntries(child));
    return entries;
  }

  private filterEntries(entries: AdminEntry[], query: string): AdminEntry[] {
    const lower = query.trim().toLowerCase();
    if (lower === '') return entries;
    return entries.filter((entry) => `${entryTitle(entry)}\n${entry.path}\n${entry.description ?? ''}`.toLowerCase().includes(lower));
  }

  /** Collect display names of top-level directories under a library section for autocomplete. */
  private async collectLibraryCategoryNames(section: LibraryAdminSection): Promise<string[]> {
    if (!this.admin) return [];
    const names = new Set<string>();
    if (section === 'snippets') {
      const index = await this.admin.readSnippetIndex();
      if (index) {
        for (const entry of index.snippets) {
          if (entry.category) names.add(entry.category);
        }
      }
    } else {
      const directories = await this.admin.listDirectories(section);
      for (const dir of directories) {
        // Only top-level (one depth below section root)
        const parts = dir.path.split('/').filter(Boolean);
        if (parts.length === 2) {
          const absPath = this.admin.resolveRepoPathPublic(dir.path);
          const metaName = await this.admin.readDirectoryDisplayName(absPath);
          names.add(metaName ?? dir.name);
        }
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
  }

  // ─── Snippet actions ────────────────────────────────────────────────

  private async handleImportSnippet(): Promise<void> {
    const folder = this.plugin.settings.snippetFolderPath;
    if (!folder) {
      new Notice(this.plugin.i18n.t('admin.noVaultSnippets'));
      return;
    }

    const vaultFolder = this.app.vault.getAbstractFileByPath(folder);
    if (!(vaultFolder instanceof TFolder)) {
      new Notice(this.plugin.i18n.t('admin.noVaultSnippets'));
      return;
    }

    // Show picker with drill-down navigation
    const modal = new ImportSnippetPickerModal(this.app, folder, this.plugin, async (file) => {
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

  private openImportSnippetDetailsModal(content: string, suggestedName: string): void {
    // Collect existing category names for autocomplete
    void this.collectLibraryCategoryNames('snippets').then((categories) => {
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
        false, // isProtocol
        categories,
      );
      modal.open();
    });
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

  // ─── Directory actions ──────────────────────────────────────────────

  private async handleCreateDirectory(section: LibraryAdminSection): Promise<void> {
    if (!this.admin) return;
    const name = await TextPromptModal.prompt(this.app, {
      title: this.plugin.i18n.t('admin.createFolder'),
      label: this.plugin.i18n.t('admin.createFolderPrompt'),
      confirmText: this.plugin.i18n.t('admin.createFolder'),
      cancelText: this.plugin.i18n.t('common.cancel'),
    });
    if (name === null) return;
    const parentPath = this.currentDirectoryPath(section);
    const created = await this.admin.createDirectory(section, parentPath, name);
    if (created) void this.refreshAdmin();
  }

  private async handleRenameDirectory(section: LibraryAdminSection, dirPath: string, currentDisplayName: string): Promise<void> {
    if (!this.admin) return;
    const name = await TextPromptModal.prompt(this.app, {
      title: this.plugin.i18n.t('admin.rename'),
      label: this.plugin.i18n.t('admin.renameFolderPrompt'),
      initialValue: currentDisplayName,
      confirmText: this.plugin.i18n.t('admin.rename'),
      cancelText: this.plugin.i18n.t('common.cancel'),
    });
    if (name === null) return;
    const renamed = await this.admin.renameDirectory(section, dirPath, name);
    if (renamed) {
      this.drillPath = renamed.path.split('/').filter(Boolean).slice(1);
      void this.refreshAdmin();
    }
  }

  private async handleDeleteDirectory(section: LibraryAdminSection, dirPath: string): Promise<void> {
    if (!this.admin) return;
    if (!confirm(this.plugin.i18n.t('admin.confirmDeleteFolder', { path: dirPath }))) return;
    const ok = await this.admin.deleteDirectory(section, dirPath);
    if (ok) {
      const deletedPath = dirPath.split('/').filter(Boolean).slice(1);
      if (this.drillPath.join('/') === deletedPath.join('/')) this.drillPath = deletedPath.slice(0, -1);
      void this.refreshAdmin();
    }
  }

  private currentDirectoryPath(section: LibraryAdminSection): string {
    return [section, ...this.drillPath].join('/');
  }

  private clearSearch(): void {
    this.currentQuery = '';
    if (this.searchInputEl) this.searchInputEl.value = '';
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  // ─── Toolbar actions ────────────────────────────────────────────────

  private async handleResetToRemote(): Promise<void> {
    if (!this.admin) return;
    // Use an Obsidian modal for confirmation instead of window.confirm
    const confirmed = await new Promise<boolean>((resolve) => {
      const modal = new ConfirmModal(
        this.app,
        this.plugin.i18n.t('admin.confirmResetToRemote'),
        () => resolve(true),
        () => resolve(false),
      );
      modal.open();
    });
    if (!confirmed) return;
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

  private handleShowUpdateInstructions(): void {
    const modal = new UpdateInstructionsModal(this.app);
    modal.open();
  }

  private setStatus(text: string): void {
    this.statusEl.setText(text);
  }

  private refreshAdmin(): void {
    this.renderAdmin(this.contentEl);
  }

  onClose(): void {
    this.clearSearch();
    this.contentEl.empty();
  }
}

// ─── Helper modals ────────────────────────────────────────────────────

/** Confirmation dialog using an Obsidian modal instead of window.confirm(). */
class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly message: string,
    private readonly onConfirm: () => void,
    private readonly onCancel: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('p', { text: this.message });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('OK')
        .setCta()
        .onClick(() => {
          this.close();
          this.onConfirm();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
          this.onCancel();
        }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Modal showing instructions for updating the library via git. */
class UpdateInstructionsModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Инструкция по обновлению библиотеки' });

    const steps = [
      '1. Актуализируйте локальную копию:\n   cd <путь-к-RadiProtocol-Library>\n   git checkout main\n   git pull origin main',
      '2. Создайте новую ветку для изменений:\n   git checkout -b my-changes',
      '3. Внесите изменения через панель администрания\n   (создание папок, импорт сниппетов/протоколов, редактирование метаданных).\n   Индексы пересобираются автоматически.',
      '4. Проверьте изменения:\n   git status\n   git diff',
      '5. Закоммитьте и отправьте:\n   git add .\n   git commit -m "описание изменений"\n   git push origin my-changes',
      '6. Создайте Pull Request на GitHub:\n   Перейдите на страницу репозитория → ' +
        'вкладка Pull Requests → New pull request → выберите вашу ветку.',
    ];

    for (const step of steps) {
      contentEl.createEl('pre', { text: step, cls: 'rp-admin-instructions-step' });
    }

    contentEl.createEl('hr');
    contentEl.createEl('p', {
      text: 'Для сброса локальной копии к состоянию GitHub используйте кнопку «Сбросить к remote».',
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class TextPromptModal extends Modal {
  private result: string | null = null;
  private didSubmit = false;

  static prompt(
    app: App,
    opts: { title: string; label: string; initialValue?: string; confirmText: string; cancelText: string },
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new TextPromptModal(app, opts, resolve);
      modal.open();
    });
  }

  private constructor(
    app: App,
    private readonly opts: { title: string; label: string; initialValue?: string; confirmText: string; cancelText: string },
    private readonly resolve: (value: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.opts.title });

    const setting = new Setting(contentEl)
      .setName(this.opts.label);

    let value = this.opts.initialValue ?? '';
    setting.addText(text => {
      text.setValue(value);
      text.onChange(next => { value = next; });
      setTimeout(() => text.inputEl.focus(), 0);
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(this.opts.confirmText)
        .setCta()
        .onClick(() => {
          this.didSubmit = true;
          this.result = value.trim();
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText(this.opts.cancelText)
        .onClick(() => {
          this.didSubmit = true;
          this.result = null;
          this.close();
        }));
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve(this.didSubmit ? this.result : null);
  }
}

class ImportSnippetPickerModal extends Modal {
  private picker: SnippetTreePicker | null = null;

  constructor(
    app: App,
    private rootPath: string,
    private plugin: RadiProtocolPlugin,
    private onSelect: (file: TFile) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.selectSnippet') });

    const pickerHost = contentEl.createDiv();
    this.picker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost,
      mode: 'file-only',
      rootPath: this.rootPath,
      onSelect: (result) => {
        if (result.kind !== 'file') return;
        const vaultPath = result.relativePath
          ? `${this.rootPath}/${result.relativePath}`
          : this.rootPath;
        const file = this.app.vault.getAbstractFileByPath(vaultPath);
        if (file instanceof TFile) {
          this.close();
          this.onSelect(file);
        }
      },
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
    });
    void this.picker.mount();
  }

  onClose(): void {
    this.picker?.unmount();
    this.picker = null;
    this.contentEl.empty();
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
    private existingCategories: string[] = [],
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
      .addText(text => {
        text
          .setPlaceholder(this.isProtocol ? 'e.g. CT, X-ray' : 'e.g. ГМ, Грудная клетка')
          .onChange(v => { this.categoryInput = v; });
        // Attach category suggest for autocomplete
        if (this.existingCategories.length > 0) {
          new LibraryCategorySuggest(this.app, text.inputEl, this.existingCategories);
        }
      });

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

/** Autocomplete suggest for library category (directory display names). */
class LibraryCategorySuggest extends AbstractInputSuggest<string> {
  private readonly inputElRef: HTMLInputElement;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private categories: string[],
  ) {
    super(app, inputEl);
    this.inputElRef = inputEl;
  }

  protected getSuggestions(query: string): string[] {
    const lower = query.trim().toLowerCase();
    if (lower === '') return this.categories.slice(0, 20);
    return this.categories
      .filter(c => c.toLowerCase().includes(lower))
      .slice(0, 20);
  }

  renderSuggestion(category: string, el: HTMLElement): void {
    el.createEl('div', { text: category });
  }

  selectSuggestion(category: string, evt: MouseEvent | KeyboardEvent): void {
    this.setValue(category);
    this.inputElRef.dispatchEvent(new Event('input', { bubbles: true }));
    super.selectSuggestion(category, evt);
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