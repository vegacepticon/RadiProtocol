// views/snippet-tree-picker.ts
// Phase 51 PICKER-02 — unified hierarchical navigator for snippet/folder selection.
// Replaces flat-list pickers in Node Editor (case 'snippet'), Snippet Manager
// («Переместить в…»), Snippet Editor («Папка»), and Runner (awaiting-snippet-pick).
//
// Design contract: `.planning/notes/snippet-node-binding-and-picker.md` (Shared Pattern H).
// Decisions: D-08 surface, D-09 mode-filtered search, D-10 substring matcher, D-11 two-line rows,
// D-12 search-row click semantics + clearing-search-restores-drillPath.
//
// File-row glyphs preserve Phase 35 MD-01: .json → 📄, .md → 📝, otherwise → 📄 (default).
// This makes the picker MD/JSON-aware in all consumer call-sites without per-site customisation.
//
// Public API: SnippetTreePicker class. Owns drill-state + search-state — reset on each mount().
// No global state. No localStorage. No singleton.

import type { App } from 'obsidian';
import type { SnippetService } from '../snippets/snippet-service';
import type { Snippet } from '../snippets/snippet-model';
import { createButton, createInput } from '../utils/dom-helpers';

// ── Constants ────────────────────────────────────────────────────────────

const SEARCH_DEBOUNCE_MS = 120;
const SELECT_FOLDER_LABEL = 'Выбрать эту папку';
const SELECT_FOLDER_COMMITTED_LABEL = '\u2713 Выбрано'; // ✓ Выбрано — Phase 56 D-10
const EMPTY_RESULTS_LABEL = 'Ничего не найдено';
const EMPTY_FOLDER_LABEL = 'Здесь пусто';
const UP_BUTTON_LABEL = 'Up';
const SEARCH_PLACEHOLDER = 'Поиск…';

// Phase 35 MD-01 preservation — extension-based glyph dispatch.
const GLYPH_FOLDER = '\uD83D\uDCC1';  // 📁
const GLYPH_JSON = '\uD83D\uDCC4';    // 📄
const GLYPH_MD = '\uD83D\uDCDD';      // 📝

/** Phase 35 MD-01 preservation — dispatch file row glyph by extension.
 *  .md → 📝, .json → 📄, otherwise → 📄 (default). Case-insensitive on extension. */
function fileGlyph(basename: string): string {
  const lower = basename.toLowerCase();
  if (lower.endsWith('.md')) return GLYPH_MD;
  return GLYPH_JSON;  // .json AND default fallback
}

function basenameOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

// ── Public surface (D-08) ────────────────────────────────────────────────

export type SnippetTreePickerMode = 'folder-only' | 'file-only' | 'both';

export interface SnippetTreePickerResult {
  kind: 'folder' | 'file';
  /** Path relative to options.rootPath (NOT vault-relative). */
  relativePath: string;
}

export interface SnippetTreePickerOptions {
  app: App;
  snippetService: SnippetService;
  container: HTMLElement;
  mode: SnippetTreePickerMode;
  /** Vault-relative root path the picker is anchored at. */
  rootPath: string;
  initialSelection?: string;
  onSelect: (result: SnippetTreePickerResult) => void;
}

// ── Implementation ───────────────────────────────────────────────────────

interface TrackedListener {
  el: HTMLElement;
  type: string;
  handler: EventListener;
}

export class SnippetTreePicker {
  private readonly options: SnippetTreePickerOptions;

  // Instance-private state — reset on each mount().
  private drillPath: string[] = [];
  private currentQuery: string = '';
  private searchDebounceTimer: number | null = null;
  private containerEl: HTMLElement | null = null;
  private listeners: TrackedListener[] = [];
  private searchInputEl: HTMLInputElement | null = null;

  /** Phase 56 D-10 (PICKER-01 follow-up): relative path (drillPath.join('/'))
   *  of the folder the user has "committed" via the «Выбрать эту папку» button.
   *  null when no commit has occurred in the current drill session, or when
   *  drillPath no longer equals this value (drilled elsewhere / navigated up). */
  private committedRelativePath: string | null = null;

  constructor(options: SnippetTreePickerOptions) {
    this.options = options;
  }

  async mount(): Promise<void> {
    this.clearContainer();
    this.drillPath = [];
    this.currentQuery = '';
    this.searchInputEl = null;
    this.committedRelativePath = null;

    const container = this.options.container;
    this.containerEl = container;
    container.empty();

    // Root wrapper.
    const root = container.createDiv({ cls: 'rp-stp-root rp-stack-lg' });

    // Search input row (always rendered above breadcrumb).
    const searchWrap = root.createDiv({ cls: 'rp-stp-search' });
    const searchInput = createInput(searchWrap, {
      cls: 'rp-stp-search-input',
      type: 'text',
    });
    searchInput.placeholder = SEARCH_PLACEHOLDER;
    this.searchInputEl = searchInput;
    this.addListener(searchInput, 'input', () => {
      const value = searchInput.value;
      this.onSearchInput(value);
    });

    // Breadcrumb + list host container. Both drill and search views render into here.
    // We keep the search input fixed above so typing never blows away focus.
    await this.renderDrillView(root);
  }

  unmount(): void {
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.removeAllListeners();
    if (this.containerEl) {
      this.containerEl.empty();
    }
    this.containerEl = null;
    this.searchInputEl = null;
    this.committedRelativePath = null;
  }

  // ── Listener tracking ─────────────────────────────────────────────────

  private addListener(el: HTMLElement, type: string, handler: EventListener): void {
    el.addEventListener(type, handler);
    this.listeners.push({ el, type, handler });
  }

  private removeAllListeners(): void {
    for (const { el, type, handler } of this.listeners) {
      el.removeEventListener(type, handler);
    }
    this.listeners = [];
  }

  private removeListenersExceptSearch(): void {
    // Keep the search-input 'input' listener across re-renders; drop all others.
    const keep: TrackedListener[] = [];
    const drop: TrackedListener[] = [];
    for (const entry of this.listeners) {
      if (entry.el === (this.searchInputEl as unknown as HTMLElement) && entry.type === 'input') {
        keep.push(entry);
      } else {
        drop.push(entry);
      }
    }
    for (const { el, type, handler } of drop) {
      el.removeEventListener(type, handler);
    }
    this.listeners = keep;
  }

  private clearContainer(): void {
    if (this.containerEl) {
      this.removeAllListeners();
      this.containerEl.empty();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  private rootEl(): HTMLElement | null {
    // The root div is the direct child of container (after clearContainer).
    const c = this.containerEl;
    if (!c) return null;
    for (const child of Array.from(c.children)) {
      if ((child as HTMLElement).classList?.contains('rp-stp-root')) {
        return child as HTMLElement;
      }
    }
    return null;
  }

  /** Current vault-relative path based on drillPath + rootPath. */
  private currentAbsPath(): string {
    if (this.drillPath.length === 0) return this.options.rootPath;
    return `${this.options.rootPath}/${this.drillPath.join('/')}`;
  }

  /** Re-render the non-search body (breadcrumb + list). Keeps the search input. */
  private async renderDrillView(root?: HTMLElement): Promise<void> {
    const host = root ?? this.rootEl();
    if (!host) return;

    // Remove any body (everything except the search wrap) + reset listeners EXCEPT the search input.
    this.removeListenersExceptSearch();
    this.removeBody(host);

    // Breadcrumb row.
    const breadcrumb = host.createDiv({ cls: 'rp-stp-breadcrumb' });
    const crumbText = this.drillPath.length === 0 ? '/' : this.drillPath.join('/');
    breadcrumb.createEl('span', { cls: 'rp-stp-breadcrumb-label', text: crumbText });

    if (this.drillPath.length > 0) {
      const upBtn = createButton(breadcrumb, {
        cls: 'rp-stp-up-btn',
        text: UP_BUTTON_LABEL,
      });
      this.addListener(upBtn, 'click', () => {
        this.drillPath.pop();
        void this.renderDrillView();
      });
    }

    // "Select this folder" button — only in folder-only / both modes, and only when drilled in
    // (we don't emit folder-of-root selection from the button; rootPath selection is not in scope).
    if (
      (this.options.mode === 'folder-only' || this.options.mode === 'both') &&
      this.drillPath.length > 0
    ) {
      const currentRel = this.drillPath.join('/');
      const isCommitted = this.committedRelativePath === currentRel;
      const selectBtn = createButton(host, {
        cls: isCommitted ? 'rp-stp-select-folder-btn is-committed' : 'rp-stp-select-folder-btn',
        text: isCommitted ? SELECT_FOLDER_COMMITTED_LABEL : SELECT_FOLDER_LABEL,
      });
      this.addListener(selectBtn, 'click', () => {
        this.committedRelativePath = currentRel;
        this.options.onSelect({
          kind: 'folder',
          relativePath: currentRel,
        });
        void this.renderDrillView();
      });
    }

    // Listing.
    const listEl = host.createDiv({ cls: 'rp-stp-list' });

    const listing = await this.options.snippetService.listFolder(this.currentAbsPath());

    // Defensive: component may have been unmounted during the await.
    if (this.containerEl === null) return;

    // Folders first (reuse existing Phase 30 D-03 convention).
    if (this.options.mode !== 'file-only' || this.options.mode === 'file-only') {
      // In file-only mode folders are still visible (for drill); folder rows do NOT call onSelect.
      for (const folderName of listing.folders) {
        this.renderFolderRow(listEl, folderName, /* isSearchResult */ false);
      }
    }

    // Files — hidden in folder-only mode.
    if (this.options.mode !== 'folder-only') {
      for (const snippet of listing.snippets) {
        this.renderFileRow(listEl, snippet, /* isSearchResult */ false);
      }
    }

    if (listEl.children.length === 0) {
      listEl.createEl('div', { cls: 'rp-stp-empty', text: EMPTY_FOLDER_LABEL });
    }
  }

  private removeBody(host: HTMLElement): void {
    // Keep only the search wrap; remove everything else.
    const children = Array.from(host.children) as HTMLElement[];
    for (const child of children) {
      if (child.classList?.contains('rp-stp-search')) continue;
      child.remove();
    }
  }

  private renderFolderRow(
    listEl: HTMLElement,
    folderName: string,
    isSearchResult: boolean,
  ): void {
    const row = createButton(listEl, { cls: 'rp-stp-folder-row' });
    const nameEl = row.createEl('div', { cls: 'rp-stp-result-name' });
    nameEl.setText(`${GLYPH_FOLDER} ${folderName}`);
    if (isSearchResult) {
      // Secondary line: full relative-from-rootPath path.
      // folderName here is the relative path from rootPath (for search-result rows).
      const pathEl = row.createEl('div', { cls: 'rp-stp-result-path' });
      pathEl.setText(folderName);
      this.addListener(row, 'click', () => {
        // Drill into the folder (D-12). Split by '/' to build drillPath.
        this.drillPath = folderName.split('/').filter((s) => s !== '');
        this.currentQuery = '';
        if (this.searchInputEl) this.searchInputEl.value = '';
        void this.renderDrillView();
      });
    } else {
      this.addListener(row, 'click', () => {
        // Drill view: click folder → drill.
        this.drillPath.push(folderName);
        void this.renderDrillView();
      });
    }
  }

  private renderFileRow(
    listEl: HTMLElement,
    snippetOrBasename: Snippet | { basename: string; relativePath: string },
    isSearchResult: boolean,
  ): void {
    let basename: string;
    let relativePath: string;
    if ('kind' in snippetOrBasename) {
      // Drill-view row: Snippet object. Basename from path. Relative path = drillPath + basename.
      basename = basenameOf(snippetOrBasename.path);
      relativePath = this.drillPath.length === 0
        ? basename
        : `${this.drillPath.join('/')}/${basename}`;
    } else {
      basename = snippetOrBasename.basename;
      relativePath = snippetOrBasename.relativePath;
    }

    const row = createButton(listEl, { cls: 'rp-stp-file-row' });
    const nameEl = row.createEl('div', { cls: 'rp-stp-result-name' });
    nameEl.setText(`${fileGlyph(basename)} ${basename}`);
    if (isSearchResult) {
      const pathEl = row.createEl('div', { cls: 'rp-stp-result-path' });
      pathEl.setText(relativePath);
    }

    const relPathAtClickTime = relativePath;
    this.addListener(row, 'click', () => {
      this.options.onSelect({ kind: 'file', relativePath: relPathAtClickTime });
    });
  }

  // ── Search handling ──────────────────────────────────────────────────

  private onSearchInput(value: string): void {
    this.currentQuery = value;
    if (this.searchDebounceTimer !== null) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = null;
      void this.applySearch();
    }, SEARCH_DEBOUNCE_MS) as unknown as number;
  }

  private async applySearch(): Promise<void> {
    const trimmed = this.currentQuery.trim();
    if (trimmed === '') {
      // Restore drill view at CURRENT drillPath (D-12) — NOT rootPath.
      await this.renderDrillView();
      return;
    }
    await this.renderSearchResults(trimmed);
  }

  private async renderSearchResults(query: string): Promise<void> {
    const host = this.rootEl();
    if (!host) return;

    this.removeListenersExceptSearch();
    this.removeBody(host);

    // Tree-wide search is rooted at options.rootPath (NOT the drill cursor).
    const { files, folders } = await this.options.snippetService.listFolderDescendants(
      this.options.rootPath,
    );

    // Defensive: component may have been unmounted.
    if (this.containerEl === null) return;

    const lowerQ = query.toLowerCase();
    const rootPrefix = `${this.options.rootPath}/`;

    // Collect matches by basename.
    const folderMatches: Array<{ basename: string; relativePath: string }> = [];
    for (const abs of folders) {
      const relative = abs.startsWith(rootPrefix) ? abs.slice(rootPrefix.length) : abs;
      if (relative === '') continue;
      const base = basenameOf(relative);
      if (base.toLowerCase().includes(lowerQ)) {
        folderMatches.push({ basename: base, relativePath: relative });
      }
    }
    const fileMatches: Array<{ basename: string; relativePath: string }> = [];
    for (const abs of files) {
      const relative = abs.startsWith(rootPrefix) ? abs.slice(rootPrefix.length) : abs;
      if (relative === '') continue;
      const base = basenameOf(relative);
      if (base.toLowerCase().includes(lowerQ)) {
        fileMatches.push({ basename: base, relativePath: relative });
      }
    }

    // Mode filter (D-09).
    const showFolders = this.options.mode !== 'file-only';
    const showFiles = this.options.mode !== 'folder-only';

    const listEl = host.createDiv({ cls: 'rp-stp-list' });

    if (showFolders) {
      for (const m of folderMatches) {
        // For search-result folder rows, folderName passed in is the relative path — the row
        // renderer uses it both as the secondary-line text AND to build drillPath on click.
        this.renderFolderRow(listEl, m.relativePath, /* isSearchResult */ true);
      }
    }
    if (showFiles) {
      for (const m of fileMatches) {
        this.renderFileRow(listEl, m, /* isSearchResult */ true);
      }
    }

    if (listEl.children.length === 0) {
      listEl.createEl('div', { cls: 'rp-stp-empty', text: EMPTY_RESULTS_LABEL });
    }
  }
}
