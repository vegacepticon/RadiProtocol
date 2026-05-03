// Phase 34 Plan 03 — F2 inline rename tests.
// Covers the enter/commit/cancel cycle for both file and folder rows, the
// settled flag that prevents Enter+blur double-commit, and the folder-rename
// fan-out via rewriteCanvasRefs + expand-state prefix rewrite.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Browser globals stub (identical shape to snippet-tree-dnd.test.ts) ---
(globalThis as any).window = globalThis;
(globalThis as any).document = {
  createElement: (tag: string) => makeEl(tag),
};

// --- Minimal DOM-ish mock element ----------------------------------------
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  textContent: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  dataset: Record<string, string>;
  value: string;
  placeholder: string;
  style: Record<string, string>;
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
  closest: (sel: string) => MockEl | null;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  focus: () => void;
  select: () => void;
  setSelectionRange: (start: number, end: number) => void;
  replaceChild: (n: MockEl, o: MockEl) => MockEl;
  remove: () => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const classSet = new Set<string>();
  const children: MockEl[] = [];
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    children,
    parent: null,
    _text: '',
    textContent: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _listeners: listeners,
    dataset,
    value: '',
    placeholder: '',
    style,
    createEl(t, opts): MockEl {
      const child = makeEl(t);
      child.parent = el;
      if (opts?.text !== undefined) { child._text = opts.text; child.textContent = opts.text; }
      if (opts?.cls) {
        for (const c of opts.cls.split(/\s+/)) child.classList.add(c);
      }
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = v;
      }
      if (opts?.type) child._attrs['type'] = opts.type;
      children.push(child);
      return child;
    },
    createDiv(opts): MockEl { return el.createEl('div', opts); },
    createSpan(opts): MockEl { return el.createEl('span', opts); },
    empty(): void { children.length = 0; },
    setText(text): void { el._text = text; el.textContent = text; },
    appendChild(child): MockEl {
      child.parent = el;
      children.push(child);
      return child;
    },
    addClass(cls): void { classSet.add(cls); },
    removeClass(cls): void { classSet.delete(cls); },
    setAttribute(k, v): void { attrs[k] = v; },
    getAttribute(k): string | null { return attrs[k] ?? null; },
    addEventListener(type, handler): void {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    removeEventListener(type, handler): void {
      const arr = listeners.get(type);
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event): void {
      const arr = listeners.get(event.type) ?? [];
      for (const h of arr) h(event);
    },
    closest(_sel): MockEl | null { return null; },
    querySelector(_sel): MockEl | null { return null; },
    querySelectorAll(_sel): MockEl[] { return []; },
    focus(): void {},
    select(): void {},
    setSelectionRange(_s, _e): void {},
    replaceChild(n, o): MockEl {
      const i = children.indexOf(o);
      if (i >= 0) { children[i] = n; n.parent = el; }
      return o;
    },
    remove(): void {
      if (el.parent) {
        const pc = el.parent.children;
        const i = pc.indexOf(el);
        if (i >= 0) pc.splice(i, 1);
      }
    },
  };
  return el;
}

// --- vi.mock('obsidian', ...) --------------------------------------------
vi.mock('obsidian', () => {
  class ItemView {
    leaf: unknown;
    contentEl: MockEl;
    app: { vault: { on: (ev: string, cb: unknown) => { ref: string } } };
    _registeredEvents: Array<{ ref: string }> = [];
    _registeredDomEvents: Array<{ el: MockEl; type: string; handler: (ev: unknown) => void }> = [];
    constructor(leaf: unknown) {
      this.leaf = leaf;
      this.contentEl = makeEl('div');
      this.app = { vault: { on: vi.fn((_ev: string, _cb: unknown) => ({ ref: _ev })) } };
    }
    registerEvent(ref: { ref: string }): void { this._registeredEvents.push(ref); }
    registerDomEvent(el: MockEl, type: string, handler: (ev: unknown) => void): void {
      this._registeredDomEvents.push({ el, type, handler });
      el.addEventListener(type, handler);
    }
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
  }
  class WorkspaceLeaf {}
  class Notice {
    message: string;
    constructor(msg: string) { this.message = msg; }
  }
  const setIcon = vi.fn((_el: unknown, _icon: string) => {});
  interface CapturedMenuItem { title: string; icon?: string; cb: () => void }
  class Menu {
    items: CapturedMenuItem[] = [];
    addItem(cb: (item: { setTitle: (t: string) => any; setIcon: (i: string) => any; onClick: (c: () => void) => any }) => void): this {
      const state: CapturedMenuItem = { title: '', cb: () => {} };
      const api = {
        setTitle: (t: string) => { state.title = t; return api; },
        setIcon: (i: string) => { state.icon = i; return api; },
        onClick: (c: () => void) => { state.cb = c; return api; },
      };
      cb(api);
      this.items.push(state);
      lastMenuItems = this.items;
      return this;
    }
    addSeparator(): this { return this; }
    showAtMouseEvent(_ev: unknown): void {}
  }
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    setPlaceholder(_s: string): void {}
    open(): void {}
    close(): void {}
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(_item: T, _el: unknown): void {}
    onChooseSuggestion(_item: T, _evt: unknown): void {}
  }
  return { ItemView, WorkspaceLeaf, Notice, setIcon, Menu, SuggestModal };
});

interface CapturedMenuItem { title: string; icon?: string; cb: () => void }
let lastMenuItems: CapturedMenuItem[] = [];

// --- Spy on rewriteCanvasRefs --------------------------------------------
const rewriteCanvasRefsSpy = vi.fn(async (_app: unknown, _mapping: Map<string, string>) => ({
  updated: ['canvas-a.canvas'],
  skipped: [],
}));
vi.mock('../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: (app: unknown, mapping: Map<string, string>) => rewriteCanvasRefsSpy(app, mapping),
}));

// --- Stub modal imports --------------------------------------------------
vi.mock('../views/snippet-editor-modal', () => ({
  SnippetEditorModal: class {
    readonly result = Promise.resolve({ saved: false });
    constructor(_a: unknown, _p: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
vi.mock('../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result = Promise.resolve('cancel' as const);
    constructor(_a: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
// --- Module under test ---------------------------------------------------
import { SnippetManagerView } from '../views/snippet-manager-view';
import type { Snippet } from '../snippets/snippet-model';
// Phase 84 (I18N-02): plugin.i18n required by SnippetManagerView/tree-renderer.
import { I18nService } from '../i18n';

function makeSnippet(kind: 'json' | 'md', p: string, name: string): Snippet {
  if (kind === 'json') return { kind: 'json', path: p, name, template: '', placeholders: [], validationError: null };
  return { kind: 'md', path: p, name, content: '' };
}

interface MockService {
  listFolder: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteFolder: ReturnType<typeof vi.fn>;
  createFolder: ReturnType<typeof vi.fn>;
  listFolderDescendants: ReturnType<typeof vi.fn>;
  listAllFolders: ReturnType<typeof vi.fn>;
  moveSnippet: ReturnType<typeof vi.fn>;
  moveFolder: ReturnType<typeof vi.fn>;
  renameSnippet: ReturnType<typeof vi.fn>;
  renameFolder: ReturnType<typeof vi.fn>;
}

function makePlugin(opts: {
  listings?: Record<string, { folders: string[]; snippets: Snippet[] }>;
  expanded?: string[];
  renameSnippetImpl?: (oldPath: string, newBasename: string) => Promise<string>;
  renameFolderImpl?: (oldPath: string, newBasename: string) => Promise<string>;
} = {}): { plugin: any; service: MockService } {
  const listings = opts.listings ?? { '.radiprotocol/snippets': { folders: [], snippets: [] } };
  const service: MockService = {
    listFolder: vi.fn((p: string) => Promise.resolve(listings[p] ?? { folders: [], snippets: [] })),
    load: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    listFolderDescendants: vi.fn().mockResolvedValue({ files: [], folders: [], total: 0 }),
    listAllFolders: vi.fn().mockResolvedValue(['.radiprotocol/snippets']),
    moveSnippet: vi.fn().mockResolvedValue(''),
    moveFolder: vi.fn().mockResolvedValue(''),
    renameSnippet: vi.fn(opts.renameSnippetImpl ?? (async (oldPath: string, newBase: string) => {
      const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
      const ext = oldPath.endsWith('.md') ? '.md' : '.json';
      return `${parent}/${newBase}${ext}`;
    })),
    renameFolder: vi.fn(opts.renameFolderImpl ?? (async (oldPath: string, newBase: string) => {
      const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
      return `${parent}/${newBase}`;
    })),
  };
  const plugin = {
    app: { vault: { on: vi.fn((_ev: string) => ({ ref: _ev })) } },
    settings: {
      snippetFolderPath: '.radiprotocol/snippets',
      snippetTreeExpandedPaths: opts.expanded ?? [],
    },
    snippetService: service,
    saveSettings: vi.fn().mockResolvedValue(undefined),
    i18n: new I18nService('en'),
  };
  return { plugin, service };
}

function makeView(plugin: any): SnippetManagerView {
  const leaf = {} as any;
  const view = new SnippetManagerView(leaf, plugin);
  (view as any).app = plugin.app;
  return view;
}

function findRow(view: any, path: string): MockEl | null {
  const tree = (view as any).treeRootEl as MockEl;
  function walk(nodes: MockEl[]): MockEl | null {
    for (const child of nodes) {
      if (child._attrs['data-path'] === path) return child;
      const hit = walk(child.children);
      if (hit !== null) return hit;
    }
    return null;
  }
  return walk(tree.children);
}

function findLabelInRow(row: MockEl): MockEl | null {
  for (const c of row.children) {
    if (c.classList.has('radi-snippet-tree-label')) return c;
  }
  return null;
}

function findInputInRow(row: MockEl): MockEl | null {
  for (const c of row.children) {
    if (c.tagName === 'INPUT') return c;
  }
  return null;
}

function fire(el: MockEl, event: { type: string; [k: string]: unknown }): void {
  const arr = el._listeners.get(event.type) ?? [];
  for (const h of arr) h(event as unknown);
}

function makeKeyEvent(type: string, key: string): any {
  let prevented = false;
  return {
    type,
    key,
    preventDefault(): void { prevented = true; },
    stopPropagation(): void {},
    get defaultPrevented() { return prevented; },
  };
}

// --- Tests ---------------------------------------------------------------
describe('SnippetManagerView — F2 inline rename (Phase 34 Plan 03)', () => {
  const root = '.radiprotocol/snippets';

  beforeEach(() => {
    rewriteCanvasRefsSpy.mockClear();
    lastMenuItems = [];
  });

  function makeTreeView(): { plugin: any; service: MockService; view: SnippetManagerView } {
    const { plugin, service } = makePlugin({
      listings: {
        [root]: {
          folders: ['a'],
          snippets: [makeSnippet('json', `${root}/note.json`, 'note')],
        },
        [`${root}/a`]: { folders: ['sub'], snippets: [makeSnippet('md', `${root}/a/leaf.md`, 'leaf')] },
        [`${root}/a/sub`]: { folders: [], snippets: [] },
      },
      expanded: [`${root}/a`, `${root}/a/sub`],
    });
    const view = makeView(plugin);
    return { plugin, service, view };
  }

  describe('enter rename', () => {
    it('F2 on focused file row replaces label span with input and focuses it', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      expect(row).not.toBeNull();
      // Before: label span present, no input
      expect(findLabelInRow(row!)).not.toBeNull();
      expect(findInputInRow(row!)).toBeNull();
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!);
      expect(input).not.toBeNull();
      // basename without extension
      expect(input!.value).toBe('note');
    });

    it('F2 on focused folder row replaces label span with input', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      expect(row).not.toBeNull();
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!);
      expect(input).not.toBeNull();
      expect(input!.value).toBe('a');
    });

    it('context menu Переименовать triggers same inline-rename flow', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      // Open context menu on the file row via the delegated treeRenderer
      (view as any).treeRenderer['openContextMenu']({ preventDefault() {}, stopPropagation() {} }, {
        kind: 'file', path: `${root}/note.json`, name: 'note', snippetKind: 'json',
      });
      const renameItem = lastMenuItems.find((i) => i.title === 'Rename');
      expect(renameItem).toBeDefined();
      renameItem!.cb();
      const input = findInputInRow(row!);
      expect(input).not.toBeNull();
      expect(input!.value).toBe('note');
    });
  });

  describe('commit', () => {
    it('Enter commits via snippetService.renameSnippet (file)', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = 'renamed';
      fire(input, makeKeyEvent('keydown', 'Enter'));
      await Promise.resolve();
      await Promise.resolve();
      expect(service.renameSnippet).toHaveBeenCalledWith(`${root}/note.json`, 'renamed');
      expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
    });

    it('Enter commits via snippetService.renameFolder (folder) and fires rewriteCanvasRefs with snippet-root-relative keys', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = 'renamed';
      fire(input, makeKeyEvent('keydown', 'Enter'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(service.renameFolder).toHaveBeenCalledWith(`${root}/a`, 'renamed');
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      const mapping = rewriteCanvasRefsSpy.mock.calls[0]![1] as Map<string, string>;
      // toCanvasKey('.radiprotocol/snippets/a', root) === 'a'
      // toCanvasKey('.radiprotocol/snippets/renamed', root) === 'renamed'
      expect(Array.from(mapping.entries())).toEqual([['a', 'renamed']]);
    });

    it('settled flag prevents Enter+blur double-commit', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = 'renamed';
      fire(input, makeKeyEvent('keydown', 'Enter'));
      // Synthesize a blur AFTER Enter — should not re-trigger
      fire(input, { type: 'blur' });
      await Promise.resolve();
      await Promise.resolve();
      expect(service.renameSnippet).toHaveBeenCalledTimes(1);
    });

    it('folder rename: expand-state paths are prefix-rewritten', async () => {
      const { plugin, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = 'renamed';
      fire(input, makeKeyEvent('keydown', 'Enter'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const expanded: string[] = plugin.settings.snippetTreeExpandedPaths;
      expect(expanded).toContain(`${root}/renamed`);
      expect(expanded).toContain(`${root}/renamed/sub`);
      expect(expanded).not.toContain(`${root}/a`);
      expect(expanded).not.toContain(`${root}/a/sub`);
      expect(plugin.saveSettings).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('Escape cancels without calling service', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = 'renamed';
      fire(input, makeKeyEvent('keydown', 'Escape'));
      // Subsequent blur must not re-trigger either
      fire(input, { type: 'blur' });
      await Promise.resolve();
      expect(service.renameSnippet).not.toHaveBeenCalled();
    });

    it('blur with empty value reverts without service call', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      input.value = '   ';
      fire(input, { type: 'blur' });
      await Promise.resolve();
      expect(service.renameSnippet).not.toHaveBeenCalled();
    });

    it('blur with unchanged value does not call service', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeKeyEvent('keydown', 'F2'));
      const input = findInputInRow(row!)!;
      // value already 'note' (basename without ext)
      fire(input, { type: 'blur' });
      await Promise.resolve();
      expect(service.renameSnippet).not.toHaveBeenCalled();
    });
  });
});
