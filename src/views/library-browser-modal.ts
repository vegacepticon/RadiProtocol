// views/library-browser-modal.ts
// Phase 86 (TEMPLATE-LIB-02): browse and install snippets from an external library.
import { App, Modal, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { LibrarySnippetEntry } from '../snippets/library-model';
import { createButton, createInput } from '../utils/dom-helpers';

const SEARCH_DEBOUNCE_MS = 120;
const GLYPH_FOLDER = '\uD83D\uDCC1'; // 📁
const GLYPH_JSON = '\uD83D\uDCC4'; // 📄

export interface LibraryTreeNode {
  name: string;
  path: string;
  children: Map<string, LibraryTreeNode>;
  entries: LibrarySnippetEntry[];
}

function normaliseLibrarySegment(segment: string): string {
  return segment.trim();
}

function categorySegments(entry: LibrarySnippetEntry): string[] {
  const segments = entry.category
    .split('/')
    .map(normaliseLibrarySegment)
    .filter((segment) => segment !== '');
  return segments.length > 0 ? segments : ['Uncategorized'];
}

function nodePath(parentPath: string, name: string): string {
  return parentPath === '' ? name : `${parentPath}/${name}`;
}

export function buildLibraryTree(entries: LibrarySnippetEntry[]): LibraryTreeNode {
  const root: LibraryTreeNode = { name: '', path: '', children: new Map(), entries: [] };
  for (const entry of entries) {
    let node = root;
    for (const segment of categorySegments(entry)) {
      const existing = node.children.get(segment);
      if (existing) {
        node = existing;
      } else {
        const child: LibraryTreeNode = {
          name: segment,
          path: nodePath(node.path, segment),
          children: new Map(),
          entries: [],
        };
        node.children.set(segment, child);
        node = child;
      }
    }
    node.entries.push(entry);
  }
  sortLibraryTree(root);
  return root;
}

function sortLibraryTree(node: LibraryTreeNode): void {
  node.entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const sortedChildren = [...node.children.values()].sort((a, b) => (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ));
  node.children = new Map(sortedChildren.map((child) => [child.name, child]));
  for (const child of node.children.values()) {
    sortLibraryTree(child);
  }
}

export function collectLibraryEntries(node: LibraryTreeNode): LibrarySnippetEntry[] {
  const entries = [...node.entries];
  for (const child of node.children.values()) {
    entries.push(...collectLibraryEntries(child));
  }
  return entries;
}

export function filterLibraryEntries(entries: LibrarySnippetEntry[], query: string): LibrarySnippetEntry[] {
  const lower = query.trim().toLowerCase();
  if (lower === '') return entries;
  return entries.filter((entry) => {
    const haystack = `${entry.name}\n${entry.category}\n${entry.description ?? ''}\n${entry.path}`.toLowerCase();
    return haystack.includes(lower);
  });
}

function findNodeByPath(root: LibraryTreeNode, path: string[]): LibraryTreeNode {
  let node = root;
  for (const segment of path) {
    const child = node.children.get(segment);
    if (!child) return node;
    node = child;
  }
  return node;
}

export class LibraryBrowserModal extends Modal {
  private readonly plugin: RadiProtocolPlugin;
  private tree: LibraryTreeNode | null = null;
  private allEntries: LibrarySnippetEntry[] = [];
  private drillPath: string[] = [];
  private currentQuery = '';
  private searchDebounceTimer: number | null = null;
  private bodyEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private busy = false;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText(this.plugin.i18n.t('library.title'));
    this.contentEl.empty();
    this.contentEl.addClass('rp-library-modal');

    const index = await this.plugin.libraryService.fetchIndex();
    if (index === null) {
      this.contentEl.createEl('p', {
        text: this.plugin.i18n.t('library.loadError'),
        cls: 'rp-library-error',
      });
      return;
    }

    this.allEntries = [...index.snippets];
    this.tree = buildLibraryTree(this.allEntries);
    this.drillPath = [];
    this.currentQuery = '';

    const root = this.contentEl.createDiv({ cls: 'rp-library-root rp-stack-lg' });
    this.renderToolbar(root);
    this.bodyEl = root.createDiv({ cls: 'rp-library-body' });
    this.renderBody();
  }

  onClose(): void {
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.contentEl.empty();
    this.tree = null;
    this.allEntries = [];
    this.drillPath = [];
    this.currentQuery = '';
    this.bodyEl = null;
    this.searchInputEl = null;
    this.busy = false;
  }

  private renderToolbar(root: HTMLElement): void {
    const searchWrap = root.createDiv({ cls: 'rp-library-search' });
    const searchInput = createInput(searchWrap, {
      cls: 'rp-library-search-input',
      type: 'text',
      placeholder: this.plugin.i18n.t('library.searchPlaceholder'),
    });
    this.searchInputEl = searchInput;
    searchInput.addEventListener('input', () => {
      this.currentQuery = searchInput.value;
      if (this.searchDebounceTimer !== null) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.searchDebounceTimer = null;
        this.renderBody();
      }, SEARCH_DEBOUNCE_MS) as unknown as number;
    });

    const actions = root.createDiv({ cls: 'rp-library-actions' });
    const installAllBtn = createButton(actions, {
      cls: 'mod-cta rp-library-install-all-btn',
      text: this.plugin.i18n.t('library.installAll'),
    });
    installAllBtn.addEventListener('click', () => {
      void this.installEntries(this.allEntries, installAllBtn, this.plugin.i18n.t('library.installAll'));
    });

    const installFolderBtn = createButton(actions, {
      cls: 'rp-library-install-folder-btn',
      text: this.plugin.i18n.t('library.installCurrentFolder'),
    });
    installFolderBtn.addEventListener('click', () => {
      const entries = this.currentFolderEntries();
      void this.installEntries(entries, installFolderBtn, this.plugin.i18n.t('library.installCurrentFolder'));
    });
  }

  private renderBody(): void {
    if (!this.bodyEl || !this.tree) return;
    this.bodyEl.empty();

    const query = this.currentQuery.trim();
    this.renderBreadcrumb(this.bodyEl);

    if (query !== '') {
      this.renderSearchResults(this.bodyEl, query);
      return;
    }

    this.renderDirectory(this.bodyEl, this.currentNode());
  }

  private renderBreadcrumb(host: HTMLElement): void {
    const breadcrumb = host.createDiv({ cls: 'rp-library-breadcrumb' });
    const rootBtn = createButton(breadcrumb, {
      cls: this.drillPath.length === 0 ? 'rp-library-crumb is-current' : 'rp-library-crumb',
      text: this.plugin.i18n.t('library.root'),
    });
    rootBtn.addEventListener('click', () => {
      this.drillPath = [];
      this.clearSearch();
      this.renderBody();
    });

    this.drillPath.forEach((segment, index) => {
      breadcrumb.createEl('span', { cls: 'rp-library-crumb-separator', text: '/' });
      const crumb = createButton(breadcrumb, {
        cls: index === this.drillPath.length - 1 ? 'rp-library-crumb is-current' : 'rp-library-crumb',
        text: segment,
      });
      crumb.addEventListener('click', () => {
        this.drillPath = this.drillPath.slice(0, index + 1);
        this.clearSearch();
        this.renderBody();
      });
    });
  }

  private renderDirectory(host: HTMLElement, node: LibraryTreeNode): void {
    const meta = host.createDiv({ cls: 'rp-library-directory-meta' });
    const count = collectLibraryEntries(node).length;
    meta.setText(this.plugin.i18n.t('library.directoryCount', { count: String(count) }));

    const listEl = host.createDiv({ cls: 'rp-library-list' });
    for (const child of node.children.values()) {
      this.renderFolderRow(listEl, child);
    }
    for (const entry of node.entries) {
      this.renderEntryRow(listEl, entry, false);
    }
    if (listEl.children.length === 0) {
      listEl.createEl('div', { cls: 'rp-library-empty', text: this.plugin.i18n.t('library.empty') });
    }
  }

  private renderSearchResults(host: HTMLElement, query: string): void {
    const matches = filterLibraryEntries(this.allEntries, query);
    const meta = host.createDiv({ cls: 'rp-library-directory-meta' });
    meta.setText(this.plugin.i18n.t('library.searchResults', { count: String(matches.length) }));

    const listEl = host.createDiv({ cls: 'rp-library-list' });
    for (const entry of matches) {
      this.renderEntryRow(listEl, entry, true);
    }
    if (listEl.children.length === 0) {
      listEl.createEl('div', { cls: 'rp-library-empty', text: this.plugin.i18n.t('library.emptyResults') });
    }
  }

  private renderFolderRow(listEl: HTMLElement, node: LibraryTreeNode): void {
    const row = createButton(listEl, { cls: 'rp-library-folder-row' });
    const nameEl = row.createEl('div', { cls: 'rp-library-entry-name' });
    nameEl.createEl('span', { cls: 'rp-library-row-glyph', text: GLYPH_FOLDER });
    nameEl.createEl('span', { cls: 'rp-library-row-title', text: node.name });
    row.createEl('div', {
      cls: 'rp-library-entry-desc',
      text: this.plugin.i18n.t('library.directoryCount', { count: String(collectLibraryEntries(node).length) }),
    });
    row.addEventListener('click', () => {
      this.drillPath.push(node.name);
      this.clearSearch();
      this.renderBody();
    });
  }

  private renderEntryRow(listEl: HTMLElement, entry: LibrarySnippetEntry, showPath: boolean): void {
    const row = listEl.createDiv({ cls: 'rp-library-entry' });
    const info = row.createDiv({ cls: 'rp-library-entry-info' });
    const nameEl = info.createEl('div', { cls: 'rp-library-entry-name' });
    nameEl.createEl('span', { cls: 'rp-library-row-glyph', text: GLYPH_JSON });
    nameEl.createEl('span', { cls: 'rp-library-row-title', text: entry.name });
    if (showPath) {
      info.createEl('div', { text: entry.category, cls: 'rp-library-entry-path' });
    }
    if (entry.description) {
      info.createEl('div', { text: entry.description, cls: 'rp-library-entry-desc' });
    }
    const installBtn = createButton(row, { cls: 'mod-cta rp-library-install-btn' });
    installBtn.setText(this.plugin.i18n.t('library.install'));
    installBtn.addEventListener('click', () => {
      void this.installSingleEntry(entry, installBtn);
    });
  }

  private async installSingleEntry(entry: LibrarySnippetEntry, installBtn: HTMLButtonElement): Promise<void> {
    installBtn.setText(this.plugin.i18n.t('library.installing'));
    installBtn.disabled = true;
    const ok = await this.plugin.libraryService.installSnippet(entry);
    if (ok) {
      new Notice(this.plugin.i18n.t('library.installed', { name: entry.name }));
      installBtn.setText(this.plugin.i18n.t('library.installedLabel'));
    } else {
      installBtn.setText(this.plugin.i18n.t('library.installFailed'));
      installBtn.disabled = false;
    }
  }

  private async installEntries(entries: LibrarySnippetEntry[], button: HTMLButtonElement, idleLabel: string): Promise<void> {
    if (this.busy) return;
    if (entries.length === 0) {
      new Notice(this.plugin.i18n.t('library.emptyInstallSelection'));
      return;
    }
    this.busy = true;
    button.disabled = true;
    button.setText(this.plugin.i18n.t('library.installingCount', { count: String(entries.length) }));
    const result = await this.plugin.libraryService.installSnippets(entries);
    this.busy = false;
    button.disabled = false;
    button.setText(idleLabel);
    if (result.failed === 0) {
      new Notice(this.plugin.i18n.t('library.installedCount', { count: String(result.installed) }));
    } else {
      new Notice(this.plugin.i18n.t('library.installCountFailed', {
        installed: String(result.installed),
        failed: String(result.failed),
      }));
    }
  }

  private currentNode(): LibraryTreeNode {
    if (!this.tree) return { name: '', path: '', children: new Map(), entries: [] };
    return findNodeByPath(this.tree, this.drillPath);
  }

  private currentFolderEntries(): LibrarySnippetEntry[] {
    return collectLibraryEntries(this.currentNode());
  }

  private clearSearch(): void {
    this.currentQuery = '';
    if (this.searchInputEl) {
      this.searchInputEl.value = '';
    }
  }
}
