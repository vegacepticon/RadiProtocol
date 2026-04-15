// Phase 34 Plan 00 — Wave 0 contract stub.
// Plan 02 MUST replace every remaining `it.todo` below with a real `it`
// test covering the enumerated scenario. Plan 05's verification asserts
// zero `it.todo` remain in this file before the phase can be marked
// complete.
//
// Plan 01 populated the «context menu Move to…» describe block with real
// tests for `openMovePicker` (file + folder branches), folder-exclusion on
// the picker input, and expand-state prefix rewrite after folder move.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Browser globals stub (identical shape to snippet-tree-view.test.ts) --
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
  dispatchEvent: (event: { type: string; target?: unknown }) => void;
  closest: (sel: string) => MockEl | null;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  focus: () => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const classSet = new Set<string>();
  const children: MockEl[] = [];
  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
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
    createEl(t: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
      const child = makeEl(t);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) { child._text = opts.text; child.textContent = opts.text; }
      if (opts?.cls) {
        for (const c of opts.cls.split(/\s+/)) child.classList.add(c);
      }
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = v;
      }
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void { children.length = 0; },
    setText(text: string): void { el._text = text; el.textContent = text; },
    appendChild(child: MockEl): MockEl {
      child.parent = el as unknown as MockEl;
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
    dispatchEvent(event: { type: string; target?: unknown }): void {
      const arr = listeners.get(event.type) ?? [];
      for (const h of arr) h(event);
    },
    closest(_sel: string): MockEl | null { return null; },
    querySelector(_sel: string): MockEl | null { return null; },
    querySelectorAll(_sel: string): MockEl[] { return []; },
    focus(): void {},
  };
  return el;
}

// --- vi.mock('obsidian', ...) — capture Menu items for introspection -----
interface CapturedMenuItem { title: string; icon?: string; cb: () => void }
let lastMenuItems: CapturedMenuItem[] = [];

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

// --- Spy on rewriteCanvasRefs --------------------------------------------
const rewriteCanvasRefsSpy = vi.fn(async (_app: unknown, _mapping: Map<string, string>) => ({
  updated: ['canvas-a.canvas'],
  skipped: [],
}));
vi.mock('../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: (app: unknown, mapping: Map<string, string>) => rewriteCanvasRefsSpy(app, mapping),
}));

// --- Spy on FolderPickerModal construction -------------------------------
interface FolderPickerCall {
  folders: string[];
  onChoose: (folder: string) => void;
}
const folderPickerCtorSpy = vi.fn();
let lastPickerCall: FolderPickerCall | null = null;
vi.mock('../views/folder-picker-modal', () => ({
  FolderPickerModal: class {
    constructor(_app: unknown, folders: string[], onChoose: (folder: string) => void) {
      folderPickerCtorSpy(folders, onChoose);
      lastPickerCall = { folders, onChoose };
    }
    open(): void {}
  },
}));

// --- Stub other modal imports referenced in snippet-manager-view ---------
vi.mock('../views/snippet-editor-modal', () => ({
  SnippetEditorModal: class {
    readonly result = Promise.resolve({ saved: false });
    constructor(_app: unknown, _plugin: unknown, _options: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
vi.mock('../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result = Promise.resolve('cancel' as const);
    constructor(_app: unknown, _options: unknown) {}
    open(): void {}
    close(): void {}
  },
}));

// --- Module under test ---------------------------------------------------
import { SnippetManagerView } from '../views/snippet-manager-view';
import type { Snippet } from '../snippets/snippet-model';

// --- Plugin factory ------------------------------------------------------
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
}

function makeSnippet(kind: 'json' | 'md', p: string, name: string): Snippet {
  if (kind === 'json') return { kind: 'json', path: p, name, template: '', placeholders: [] };
  return { kind: 'md', path: p, name, content: '' };
}

function makePlugin(opts: {
  listings?: Record<string, { folders: string[]; snippets: Snippet[] }>;
  expanded?: string[];
  allFolders?: string[];
  moveSnippetImpl?: (oldPath: string, newFolder: string) => Promise<string>;
  moveFolderImpl?: (oldPath: string, newParent: string) => Promise<string>;
} = {}): { plugin: any; service: MockService } {
  const listings = opts.listings ?? { '.radiprotocol/snippets': { folders: [], snippets: [] } };
  const service: MockService = {
    listFolder: vi.fn((p: string) => Promise.resolve(listings[p] ?? { folders: [], snippets: [] })),
    load: vi.fn(() => Promise.resolve(null)),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    listFolderDescendants: vi.fn().mockResolvedValue({ files: [], folders: [], total: 0 }),
    listAllFolders: vi.fn().mockResolvedValue(opts.allFolders ?? ['.radiprotocol/snippets']),
    moveSnippet: vi.fn(opts.moveSnippetImpl ?? (async (oldPath: string, newFolder: string) => {
      const base = oldPath.slice(oldPath.lastIndexOf('/') + 1);
      return `${newFolder}/${base}`;
    })),
    moveFolder: vi.fn(opts.moveFolderImpl ?? (async (oldPath: string, newParent: string) => {
      const base = oldPath.slice(oldPath.lastIndexOf('/') + 1);
      return `${newParent}/${base}`;
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
  };
  return { plugin, service };
}

function makeView(plugin: any): SnippetManagerView {
  const leaf = {} as any;
  const view = new SnippetManagerView(leaf, plugin);
  (view as any).app = plugin.app;
  return view;
}

describe('SnippetManagerView — drag-and-drop (Phase 34 Plan 02)', () => {
  describe('dragstart', () => {
    it.todo('sets application/x-radi-snippet-file MIME on file row');
    it.todo('sets application/x-radi-snippet-folder MIME on folder row');
    it.todo('adds is-dragging class to source row');
  });
  describe('dragover guard', () => {
    it.todo('preventDefault ONLY when our MIME is present');
    it.todo('rejects dragover from foreign MIME (e.g. text/plain only)');
    it.todo('adds drop-target class on valid hover');
  });
  describe('drop', () => {
    it.todo('file onto folder → calls snippetService.moveSnippet');
    it.todo('folder onto folder → calls snippetService.moveFolder');
    it.todo('folder dropped on itself → rejected, no service call');
    it.todo('folder dropped on own descendant → rejected, no service call');
    it.todo('drop on file-row redirects to parent folder');
  });

  describe('context menu Move to…', () => {
    const root = '.radiprotocol/snippets';

    beforeEach(() => {
      folderPickerCtorSpy.mockClear();
      rewriteCanvasRefsSpy.mockClear();
      lastPickerCall = null;
      lastMenuItems = [];
    });

    it('file branch: selecting folder in picker calls moveSnippet; rewriteCanvasRefs NOT called', async () => {
      const { plugin, service } = makePlugin({
        listings: {
          [root]: { folders: ['dst'], snippets: [makeSnippet('json', `${root}/note.json`, 'note')] },
          [`${root}/dst`]: { folders: [], snippets: [] },
        },
        allFolders: [root, `${root}/dst`],
      });
      const view = makeView(plugin);
      await view.onOpen();

      const node = { kind: 'file' as const, path: `${root}/note.json`, name: 'note', snippetKind: 'json' as const };
      await (view as any).openMovePicker(node);

      expect(folderPickerCtorSpy).toHaveBeenCalled();
      expect(lastPickerCall).not.toBeNull();

      // Invoke the picker callback as if the user selected `${root}/dst`
      await lastPickerCall!.onChoose(`${root}/dst`);

      expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.json`, `${root}/dst`);
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
    });

    it('folder branch: selecting target calls moveFolder then rewriteCanvasRefs with snippet-root-relative keys', async () => {
      const { plugin, service } = makePlugin({
        listings: {
          [root]: { folders: ['a', 'b'], snippets: [] },
          [`${root}/a`]: { folders: [], snippets: [] },
          [`${root}/b`]: { folders: [], snippets: [] },
        },
        allFolders: [root, `${root}/a`, `${root}/b`],
      });
      const view = makeView(plugin);
      await view.onOpen();

      const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', children: [] };
      await (view as any).openMovePicker(node);

      expect(lastPickerCall).not.toBeNull();
      await lastPickerCall!.onChoose(`${root}/b`);

      expect(service.moveFolder).toHaveBeenCalledWith(`${root}/a`, `${root}/b`);
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      // Keys must be snippet-root-relative (D-03): oldKey 'a' → newKey 'b/a'
      const mapping = rewriteCanvasRefsSpy.mock.calls[0]![1] as Map<string, string>;
      expect(Array.from(mapping.entries())).toEqual([['a', 'b/a']]);
    });

    it('folder branch: picker folders list EXCLUDES source folder and its descendants', async () => {
      const { plugin } = makePlugin({
        listings: {
          [root]: { folders: ['a', 'b'], snippets: [] },
          [`${root}/a`]: { folders: ['sub'], snippets: [] },
          [`${root}/a/sub`]: { folders: [], snippets: [] },
          [`${root}/b`]: { folders: [], snippets: [] },
        },
        allFolders: [root, `${root}/a`, `${root}/a/sub`, `${root}/b`],
      });
      const view = makeView(plugin);
      await view.onOpen();

      const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', children: [] };
      await (view as any).openMovePicker(node);

      expect(lastPickerCall).not.toBeNull();
      const folders = lastPickerCall!.folders;
      expect(folders).not.toContain(`${root}/a`);
      expect(folders).not.toContain(`${root}/a/sub`);
      expect(folders).toContain(root);
      expect(folders).toContain(`${root}/b`);
    });

    it('folder branch: expand-state paths are prefix-rewritten after folder move', async () => {
      const { plugin } = makePlugin({
        listings: {
          [root]: { folders: ['a', 'b'], snippets: [] },
          [`${root}/a`]: { folders: ['sub'], snippets: [] },
          [`${root}/a/sub`]: { folders: [], snippets: [] },
          [`${root}/b`]: { folders: [], snippets: [] },
        },
        expanded: [`${root}/a`, `${root}/a/sub`, `${root}/other`],
        allFolders: [root, `${root}/a`, `${root}/a/sub`, `${root}/b`, `${root}/other`],
      });
      const view = makeView(plugin);
      await view.onOpen();

      const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', children: [] };
      await (view as any).openMovePicker(node);
      await lastPickerCall!.onChoose(`${root}/b`);

      const expanded: string[] = plugin.settings.snippetTreeExpandedPaths;
      // Source entries rewritten
      expect(expanded).toContain(`${root}/b/a`);
      expect(expanded).toContain(`${root}/b/a/sub`);
      // Old source entries removed
      expect(expanded).not.toContain(`${root}/a`);
      expect(expanded).not.toContain(`${root}/a/sub`);
      // Unrelated entries untouched
      expect(expanded).toContain(`${root}/other`);
      // Settings persisted
      expect(plugin.saveSettings).toHaveBeenCalled();
    });
  });
});
