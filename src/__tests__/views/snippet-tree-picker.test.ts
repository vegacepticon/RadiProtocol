// src/__tests__/views/snippet-tree-picker.test.ts
// Phase 51 PICKER-02 (Plan 02) — SnippetTreePicker unit tests.
//
// Covers:
//   D-08  three-mode surface (folder-only | file-only | both) + onSelect dispatch
//   D-09  mode-filtered search
//   D-10  case-insensitive substring matcher
//   D-11  two-line result rows (primary basename + secondary full-relative-path)
//   D-12  search-row click semantics + clearing-search-restores-drillPath
//   Phase 35 MD-01 preservation: extension-based file-glyph dispatch (📄 / 📝)
//
// Strategy: we install a local `vi.mock('obsidian', ...)` stub with a hand-rolled
// MockEl compatible with the SnippetTreePicker's DOM API (createEl / createDiv /
// empty / addEventListener). SnippetService is a plain vi.fn mock. No happy-dom.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal DOM-ish mock element (mirrors src/__tests__/snippet-tree-view.test.ts)
// ---------------------------------------------------------------------------

interface MockClassList {
  add: (cls: string) => void;
  remove: (cls: string) => void;
  contains: (cls: string) => boolean;
  has: (cls: string) => boolean;
}

interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  textContent: string;
  classList: MockClassList;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  dataset: Record<string, string>;
  value: string;
  placeholder: string;
  style: Record<string, string>;
  type: string;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (text: string) => void;
  appendChild: (child: MockEl) => MockEl;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: unknown }) => void;
  remove: () => void;
  focus: () => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const classSet = new Set<string>();
  const classList: MockClassList = {
    add: (c: string) => { classSet.add(c); },
    remove: (c: string) => { classSet.delete(c); },
    contains: (c: string) => classSet.has(c),
    has: (c: string) => classSet.has(c),
  };
  const children: MockEl[] = [];
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    children,
    parent: null,
    _text: '',
    textContent: '',
    classList,
    _attrs: attrs,
    _style: style,
    _listeners: listeners,
    dataset,
    value: '',
    placeholder: '',
    style,
    type: '',
    createEl(t: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
      const child = makeEl(t);
      child.parent = el;
      if (opts?.text !== undefined) { child._text = opts.text; child.textContent = opts.text; }
      if (opts?.cls) {
        for (const c of opts.cls.split(/\s+/)) child.classList.add(c);
      }
      if (opts?.type !== undefined) { child.type = opts.type; }
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = v;
      }
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return el.createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return el.createEl('span', opts);
    },
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      el._text = text;
      el.textContent = text;
    },
    appendChild(child: MockEl): MockEl {
      child.parent = el;
      children.push(child);
      return child;
    },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type);
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
    dispatchEvent(event: { type: string; target?: unknown }): void {
      const arr = listeners.get(event.type) ?? [];
      for (const h of arr) h(event);
    },
    remove(): void {
      const p = el.parent;
      if (!p) return;
      const idx = p.children.indexOf(el);
      if (idx >= 0) p.children.splice(idx, 1);
      el.parent = null;
    },
    focus(): void {},
  };
  return el;
}

// --- vi.mock('obsidian', ...) --- (override the default alias mock) --------
vi.mock('obsidian', () => {
  class ItemView {}
  class WorkspaceLeaf {}
  class Modal {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(_v: T, _el: unknown): void {}
    onChooseSuggestion(_v: T, _ev: unknown): void {}
    setPlaceholder(_p: string): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_c: unknown) {}
    setName() { return this; }
    setDesc() { return this; }
    setHeading() { return this; }
    addText(_cb: unknown) { return this; }
    addTextArea(_cb: unknown) { return this; }
    addDropdown(_cb: unknown) { return this; }
    addButton(_cb: unknown) { return this; }
  }
  class Notice { constructor(_m: string) {} }
  class TFile { path = ''; }
  class Plugin { app: unknown = {}; manifest: unknown = {}; }
  return { ItemView, WorkspaceLeaf, Modal, SuggestModal, Setting, Notice, TFile, Plugin };
});

// --- Now import the module under test ------------------------------------
import {
  SnippetTreePicker,
  type SnippetTreePickerOptions,
  type SnippetTreePickerResult,
  type SnippetTreePickerMode,
} from '../../views/snippet-tree-picker';
import type { Snippet } from '../../snippets/snippet-model';

// --- Test helpers --------------------------------------------------------

interface FakeSnippetService {
  listFolder: ReturnType<typeof vi.fn>;
  listFolderDescendants: ReturnType<typeof vi.fn>;
}

function makeFakeSnippetService(): FakeSnippetService {
  return {
    listFolder: vi.fn(async (_p: string) => ({ folders: [] as string[], snippets: [] as Snippet[] })),
    listFolderDescendants: vi.fn(async (_p: string) => ({ files: [] as string[], folders: [] as string[], total: 0 })),
  };
}

function jsonSnippet(path: string, name?: string): Snippet {
  return {
    kind: 'json',
    path,
    name: name ?? path.split('/').pop()!.replace(/\.json$/, ''),
    template: '',
    placeholders: [],
  };
}

function mdSnippet(path: string, name?: string): Snippet {
  return {
    kind: 'md',
    path,
    name: name ?? path.split('/').pop()!.replace(/\.md$/, ''),
    content: '',
  };
}

const ROOT = 'snippets';
const APP = {} as unknown as SnippetTreePickerOptions['app'];

function makePicker(
  overrides: Partial<SnippetTreePickerOptions>,
  svc: FakeSnippetService,
): { picker: SnippetTreePicker; container: MockEl; onSelect: ReturnType<typeof vi.fn> } {
  const container = makeEl('div');
  const onSelect = vi.fn((_r: SnippetTreePickerResult) => {});
  const base: SnippetTreePickerOptions = {
    app: APP,
    snippetService: svc as unknown as SnippetTreePickerOptions['snippetService'],
    container: container as unknown as HTMLElement,
    mode: 'both',
    rootPath: ROOT,
    onSelect,
    ...overrides,
  };
  const picker = new SnippetTreePicker(base);
  return { picker, container, onSelect };
}

function findFirst(root: MockEl | undefined, predicate: (el: MockEl) => boolean): MockEl | null {
  if (!root) return null;
  // DFS in document order.
  function walk(el: MockEl): MockEl | null {
    if (predicate(el)) return el;
    for (const c of el.children) {
      const r = walk(c);
      if (r) return r;
    }
    return null;
  }
  return walk(root);
}

function findAll(root: MockEl, predicate: (el: MockEl) => boolean): MockEl[] {
  const out: MockEl[] = [];
  // DFS in document order: visit self, then recurse into children left-to-right.
  function walk(el: MockEl): void {
    if (predicate(el)) out.push(el);
    for (const c of el.children) walk(c);
  }
  walk(root);
  return out;
}

function findByClass(root: MockEl, cls: string): MockEl[] {
  return findAll(root, (el) => el.classList.has(cls));
}

function triggerClick(el: MockEl | undefined): void {
  if (!el) throw new Error('triggerClick: element is undefined');
  el.dispatchEvent({ type: 'click', target: el });
}

function triggerInput(inputEl: MockEl | undefined, value: string): void {
  if (!inputEl) throw new Error('triggerInput: element is undefined');
  inputEl.value = value;
  inputEl.dispatchEvent({ type: 'input', target: inputEl });
}

async function flushDebounce(): Promise<void> {
  // Debounce = 120ms in the component (SEARCH_DEBOUNCE_MS). Use real timers + a brief wait.
  await new Promise((resolve) => setTimeout(resolve, 180));
  // Allow microtasks (the debounced handler awaits listFolderDescendants) to flush.
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

// =========================================================================
// Tests
// =========================================================================

describe('Mode discriminator (D-08, D-09)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('folder-only mode hides files in drill view', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const fileRows = findByClass(container, 'rp-stp-file-row');
    const folderRows = findByClass(container, 'rp-stp-folder-row');
    expect(fileRows.length).toBe(0);
    expect(folderRows.length).toBe(1);
  });

  it('folder-only mode hides files in search results', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/report.json`, `${ROOT}/abdomen/ct.md`],
      folders: [`${ROOT}/abdomen`],
      total: 3,
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'report');
    await flushDebounce();

    expect(findByClass(container, 'rp-stp-file-row').length).toBe(0);
    // No folder matches on "report" either — empty state.
    const emptyOrNoFiles = findByClass(container, 'rp-stp-empty');
    const folderRows = findByClass(container, 'rp-stp-folder-row');
    expect(folderRows.length + emptyOrNoFiles.length).toBeGreaterThan(0);
  });

  it('folder-only mode emits onSelect via Выбрать эту папку button only', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    // Drill in.
    const folderRow = findByClass(container, 'rp-stp-folder-row')[0];
    triggerClick(folderRow);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // The select-folder button should be present now.
    const selectBtn = findFirst(container, (el) => el.classList.has('rp-stp-select-folder-btn'));
    expect(selectBtn).not.toBeNull();
    triggerClick(selectBtn!);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'folder', relativePath: 'abdomen' });
  });

  it('file-only mode shows folders (drill) + files (select) in drill view', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    expect(findByClass(container, 'rp-stp-folder-row').length).toBe(1);
    expect(findByClass(container, 'rp-stp-file-row').length).toBe(1);
  });

  it('file-only mode hides folders in search results', async () => {
    // Both a folder named "match" and a file named "match-report.md" exist.
    // Query "match" hits both — file-only mode must show the file row and hide the folder row.
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/match-report.md`],
      folders: [`${ROOT}/match`],
      total: 2,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'match');
    await flushDebounce();

    expect(findByClass(container, 'rp-stp-folder-row').length).toBe(0);
    expect(findByClass(container, 'rp-stp-file-row').length).toBe(1);
  });

  it('file-only mode emits onSelect with kind: file on file row click', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const fileRow = findByClass(container, 'rp-stp-file-row')[0];
    triggerClick(fileRow);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'file', relativePath: 'report.json' });
  });

  it('both mode shows folders + files in drill view', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [jsonSnippet(`${ROOT}/r.json`)],
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    expect(findByClass(container, 'rp-stp-folder-row').length).toBe(1);
    expect(findByClass(container, 'rp-stp-file-row').length).toBe(1);
  });

  it('both mode shows folders + files in search results, folders first', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/a/ct-file.md`, `${ROOT}/ct-report.json`],
      folders: [`${ROOT}/ct-folder`, `${ROOT}/a`],
      total: 4,
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    const rows = findAll(container, (el) =>
      el.classList.has('rp-stp-folder-row') || el.classList.has('rp-stp-file-row'),
    );
    // Should have at least one of each.
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Folders must come before files.
    const firstFolderIdx = rows.findIndex((r) => r.classList.has('rp-stp-folder-row'));
    const firstFileIdx = rows.findIndex((r) => r.classList.has('rp-stp-file-row'));
    expect(firstFolderIdx).toBeGreaterThanOrEqual(0);
    expect(firstFileIdx).toBeGreaterThanOrEqual(0);
    expect(firstFolderIdx).toBeLessThan(firstFileIdx);
  });
});

describe('Drill navigation (D-08)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('mount() at empty drillPath calls listFolder(rootPath) and renders top-level entries', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    expect(svc.listFolder).toHaveBeenCalledWith(ROOT);
    expect(findByClass(container, 'rp-stp-folder-row').length).toBe(2);
  });

  it('click folder row pushes drillPath and re-renders deeper listing', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct', 'mri'], snippets: [] });

    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const folderRow = findByClass(container, 'rp-stp-folder-row')[0];
    triggerClick(folderRow);
    // Let the re-render's async listFolder settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(svc.listFolder).toHaveBeenNthCalledWith(2, `${ROOT}/abdomen`);
    expect(findByClass(container, 'rp-stp-folder-row').length).toBe(2);
  });

  it('Up button visible when drillPath.length > 0; click pops drillPath', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: [], snippets: [] })
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] });

    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    // At root: no up button.
    expect(findByClass(container, 'rp-stp-up-btn').length).toBe(0);

    triggerClick(findByClass(container, 'rp-stp-folder-row')[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // After drill: up button visible.
    const upBtn = findFirst(container, (el) => el.classList.has('rp-stp-up-btn'));
    expect(upBtn).not.toBeNull();

    triggerClick(upBtn!);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Back at root: no up button again.
    expect(findByClass(container, 'rp-stp-up-btn').length).toBe(0);
  });

  it('breadcrumb at root reads /', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const crumb = findFirst(container, (el) => el.classList.has('rp-stp-breadcrumb-label'));
    expect(crumb?.textContent).toBe('/');
  });

  it('breadcrumb at depth-2 reads abdomen/ct', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct'], snippets: [] })
      .mockResolvedValueOnce({ folders: [], snippets: [] });

    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    triggerClick(findByClass(container, 'rp-stp-folder-row')[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    triggerClick(findByClass(container, 'rp-stp-folder-row')[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    const crumb = findFirst(container, (el) => el.classList.has('rp-stp-breadcrumb-label'));
    expect(crumb?.textContent).toBe('abdomen/ct');
  });
});

describe('Tree-wide search (D-09, D-10, D-11)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('non-empty query switches to search view rooted at rootPath (NOT drillPath)', async () => {
    // Start at root; drill in one level; then search.
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })  // root
      .mockResolvedValueOnce({ folders: [], snippets: [] });           // abdomen
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/x.json`],
      folders: [],
      total: 1,
    });

    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    triggerClick(findByClass(container, 'rp-stp-folder-row')[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'x');
    await flushDebounce();

    expect(svc.listFolderDescendants).toHaveBeenCalledWith(ROOT);
  });

  it('case-insensitive substring match on basename — query CT matches ct-routine.md', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/ct-routine.md`, `${ROOT}/mri-liver.md`],
      folders: [],
      total: 2,
    });

    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'CT');
    await flushDebounce();

    const files = findByClass(container, 'rp-stp-file-row');
    expect(files.length).toBe(1);
    // Primary row text contains the basename 'ct-routine.md'.
    const name = findFirst(files[0], (el) => el.classList.has('rp-stp-result-name'));
    expect(name?.textContent).toContain('ct-routine.md');
  });

  it('result row primary text = basename with extension', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/report.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'report');
    await flushDebounce();

    const name = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(name?.textContent).toContain('report.md');
  });

  it('result row secondary text = full relative path from rootPath', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct/ct-routine.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    const pathEl = findFirst(container, (el) => el.classList.has('rp-stp-result-path'));
    expect(pathEl?.textContent).toBe('abdomen/ct/ct-routine.md');
  });

  it('empty results shows Ничего не найдено', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({ files: [], folders: [], total: 0 });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'zzzzzz');
    await flushDebounce();

    const empty = findFirst(container, (el) => el.classList.has('rp-stp-empty'));
    expect(empty?.textContent).toBe('Ничего не найдено');
  });
});

describe('File glyph dispatch (Phase 35 MD-01 preservation)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('file row for .md file renders 📝 prefix in primary text (drill view, file-only mode)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [mdSnippet(`${ROOT}/report.md`)],
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const name = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(name?.textContent).toContain('📝');
    expect(name?.textContent).toContain('report.md');
  });

  it('file row for .json file renders 📄 prefix in primary text (drill view, file-only mode)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const name = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(name?.textContent).toContain('📄');
    expect(name?.textContent).toContain('report.json');
  });

  it('search results show 📝 for .md matches AND 📄 for .json matches in mixed-extension fixture (both mode)', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/a.md`, `${ROOT}/a.json`],
      folders: [],
      total: 2,
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'a');
    await flushDebounce();

    const names = findAll(container, (el) => el.classList.has('rp-stp-result-name')).map((e) => e.textContent);
    const hasMd = names.some((t) => t.includes('📝') && t.includes('a.md'));
    const hasJson = names.some((t) => t.includes('📄') && t.includes('a.json'));
    expect(hasMd).toBe(true);
    expect(hasJson).toBe(true);
  });

  it('case-insensitive extension dispatch — .MD file renders 📝 (verifies lowercased ext check)', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/report.MD`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'report');
    await flushDebounce();

    const name = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(name?.textContent).toContain('📝');
  });
});

describe('Search row click (D-12)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('file row click in search results commits selection (calls onSelect with kind: file)', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/report.md`],
      folders: [],
      total: 1,
    });
    const { picker, container, onSelect } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'report');
    await flushDebounce();

    const fileRow = findByClass(container, 'rp-stp-file-row')[0];
    triggerClick(fileRow);

    expect(onSelect).toHaveBeenCalledWith({ kind: 'file', relativePath: 'abdomen/report.md' });
  });

  it('folder row click in search results drills into folder AND clears query (re-mounts drill view at folder)', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: [], snippets: [] })              // root before search
      .mockResolvedValueOnce({ folders: [], snippets: [] });              // after drill via search
    svc.listFolderDescendants.mockResolvedValue({
      files: [],
      folders: [`${ROOT}/abdomen`],
      total: 1,
    });

    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))! ;
    triggerInput(input, 'abdomen');
    await flushDebounce();

    const folderRow = findByClass(container, 'rp-stp-folder-row')[0];
    triggerClick(folderRow);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // onSelect NOT called — folder click drills (D-12).
    expect(onSelect).not.toHaveBeenCalled();
    // Drill happened: listFolder called with abdomen path.
    expect(svc.listFolder).toHaveBeenCalledWith(`${ROOT}/abdomen`);
    // Search input cleared.
    const inputAfter = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    expect(inputAfter.value).toBe('');
    // Breadcrumb at drill path.
    const crumb = findFirst(container, (el) => el.classList.has('rp-stp-breadcrumb-label'));
    expect(crumb?.textContent).toBe('abdomen');
  });

  it('manually clearing search input restores drill view at CURRENT drillPath, NOT rootPath', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })     // root
      .mockResolvedValueOnce({ folders: [], snippets: [jsonSnippet(`${ROOT}/abdomen/r.json`)] })  // abdomen after drill
      .mockResolvedValueOnce({ folders: [], snippets: [jsonSnippet(`${ROOT}/abdomen/r.json`)] }); // abdomen after clearing search
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/r.json`],
      folders: [],
      total: 1,
    });

    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    // Drill into abdomen.
    triggerClick(findByClass(container, 'rp-stp-folder-row')[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Search.
    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'r');
    await flushDebounce();

    // Clear search.
    triggerInput(input, '');
    await flushDebounce();

    // Breadcrumb should still read 'abdomen', NOT '/'.
    const crumb = findFirst(container, (el) => el.classList.has('rp-stp-breadcrumb-label'));
    expect(crumb?.textContent).toBe('abdomen');
  });
});

describe('Lifecycle', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('constructor does not mount automatically (container remains untouched until mount() called)', () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    const container = makeEl('div');
    // Place a child before constructor — expect it to remain.
    container.createEl('div', { text: 'pre-existing' });
    const onSelect = vi.fn();
    new SnippetTreePicker({
      app: APP,
      snippetService: svc as unknown as SnippetTreePickerOptions['snippetService'],
      container: container as unknown as HTMLElement,
      mode: 'folder-only',
      rootPath: ROOT,
      onSelect,
    });
    expect(container.children.length).toBe(1);
    expect(container.children[0]?._text).toBe('pre-existing');
  });

  it('mount() empties container before re-rendering', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    container.createEl('div', { text: 'stale' });
    await picker.mount();
    // 'stale' child must be gone, replaced by picker DOM (root + search).
    expect(findFirst(container, (el) => el._text === 'stale')).toBeNull();
    expect(findFirst(container, (el) => el.classList.has('rp-stp-root'))).not.toBeNull();
  });

  it('unmount() empties container and removes event listeners (verified by re-firing a click on a captured row — handler should not fire)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    // Capture a row before unmount.
    const capturedRow = findByClass(container, 'rp-stp-folder-row')[0];
    expect(capturedRow).toBeDefined();

    picker.unmount();
    expect(container.children.length).toBe(0);

    // Dispatching click on the captured (detached) row must NOT invoke onSelect.
    triggerClick(capturedRow);
    await Promise.resolve();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
