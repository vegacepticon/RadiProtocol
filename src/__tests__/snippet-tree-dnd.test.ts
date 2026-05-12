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
let _lastMenuItems: CapturedMenuItem[] = [];

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
      _lastMenuItems = this.items;
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
  // Phase 51 Plan 04 D-07 — Modal instrumentation to drive the SnippetTreePicker-hosting
  // «Переместить в…» flow in tests. Captures setTitle + onOpen/onClose + open/close calls.
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    _captured: CapturedModal;
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      const captured: CapturedModal = {
        title: '',
        contentEl: this.contentEl,
        onOpenFn: null,
        onCloseFn: null,
        open: () => { captured.isOpen = true; captured.onOpenFn?.(); },
        close: () => { if (!captured.isOpen) return; captured.isOpen = false; captured.onCloseFn?.(); },
        isOpen: false,
      };
      this._captured = captured;
      modalInstances.push(captured);
    }
    setTitle(t: string): void { this._captured.title = t; this.titleEl.setText(t); }
    set onOpen(fn: () => void) { this._captured.onOpenFn = fn; }
    get onOpen(): () => void { return this._captured.onOpenFn ?? (() => {}); }
    set onClose(fn: () => void) { this._captured.onCloseFn = fn; }
    get onClose(): () => void { return this._captured.onCloseFn ?? (() => {}); }
    open(): void { this._captured.open(); }
    close(): void { this._captured.close(); }
  }
  return { ItemView, WorkspaceLeaf, Notice, setIcon, Menu, Modal, SuggestModal };
});

// Phase 51 Plan 04 D-07 — captured Modal instrumentation.
interface CapturedModal {
  title: string;
  contentEl: MockEl;
  onOpenFn: (() => void) | null;
  onCloseFn: (() => void) | null;
  open: () => void;
  close: () => void;
  isOpen: boolean;
}
const modalInstances: CapturedModal[] = [];

// Phase 51 Plan 04 D-07 — SnippetTreePicker stub capturing constructor options.
interface CapturedPicker { options: Record<string, unknown>; }
const pickerInstances: CapturedPicker[] = [];
const pickerUnmountSpy = vi.fn();
vi.mock('../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    constructor(options: Record<string, unknown>) { pickerInstances.push({ options }); }
    async mount(): Promise<void> {}
    unmount(): void { pickerUnmountSpy(); }
  },
}));

// --- Spy on rewriteCanvasRefs --------------------------------------------
const rewriteCanvasRefsSpy = vi.fn(async (_app: unknown, _mapping: Map<string, string>) => ({
  updated: ['canvas-a.canvas'],
  skipped: [],
}));
vi.mock('../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: (app: unknown, mapping: Map<string, string>) => rewriteCanvasRefsSpy(app, mapping),
}));

// --- Spy on rewriteProtocolSnippetRefs ------------------------------------
const rewriteProtocolSnippetRefsSpy = vi.fn(async (_app: unknown, _mapping: Map<string, string>) => ({
  updated: ['protocol-a.rp.json'],
  skipped: [],
}));
vi.mock('../snippets/protocol-ref-sync', () => ({
  rewriteProtocolSnippetRefs: (app: unknown, mapping: Map<string, string>) => rewriteProtocolSnippetRefsSpy(app, mapping),
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
// Phase 84 (I18N-02): plugin.i18n required by SnippetManagerView at render time.
import { I18nService } from '../i18n';

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
  if (kind === 'json') return { kind: 'json', path: p, name, template: '', placeholders: [], validationError: null };
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
    app: { vault: { on: vi.fn((_ev: string) => ({ ref: _ev })), getFiles: vi.fn(() => []) } },
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

// --- DnD helpers ---------------------------------------------------------
const MIME_FILE = 'application/x-radi-snippet-file';
const MIME_FOLDER = 'application/x-radi-snippet-folder';

interface MockDataTransfer {
  _data: Record<string, string>;
  types: string[];
  effectAllowed: string;
  dropEffect: string;
  setData: (type: string, value: string) => void;
  getData: (type: string) => string;
}

function makeDataTransfer(initial: Record<string, string> = {}): MockDataTransfer {
  const data: Record<string, string> = { ...initial };
  const dt: MockDataTransfer = {
    _data: data,
    types: Object.keys(data),
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type: string, value: string): void {
      data[type] = value;
      if (!dt.types.includes(type)) dt.types.push(type);
    },
    getData(type: string): string {
      return data[type] ?? '';
    },
  };
  return dt;
}

function makeDragEvent(type: string, dataTransfer: MockDataTransfer): any {
  let defaultPrevented = false;
  return {
    type,
    dataTransfer,
    relatedTarget: null,
    preventDefault(): void { defaultPrevented = true; },
    stopPropagation(): void {},
    get defaultPrevented() { return defaultPrevented; },
  };
}

// Find the row MockEl for a given node path inside treeRootEl.children.
function findRow(view: any, path: string): MockEl | null {
  const tree = (view as any).treeRootEl as MockEl;
  for (const child of tree.children) {
    if (child._attrs['data-path'] === path) return child;
  }
  return null;
}

// Fire a DOM event through the mock listener map.
function fire(row: MockEl, event: { type: string }): void {
  const arr = row._listeners.get(event.type) ?? [];
  for (const h of arr) h(event as unknown);
}

describe('SnippetManagerView — drag-and-drop (Phase 34 Plan 02)', () => {
  const root = '.radiprotocol/snippets';

  beforeEach(() => {
    rewriteCanvasRefsSpy.mockClear();
    rewriteProtocolSnippetRefsSpy.mockClear();
    _lastMenuItems = [];
  });

  function makeTreeView(): { plugin: any; service: MockService; view: SnippetManagerView } {
    const { plugin, service } = makePlugin({
      listings: {
        [root]: {
          folders: ['a', 'b'],
          snippets: [makeSnippet('json', `${root}/note.json`, 'note')],
        },
        [`${root}/a`]: { folders: ['sub'], snippets: [makeSnippet('json', `${root}/a/leaf.json`, 'leaf')] },
        [`${root}/a/sub`]: { folders: [], snippets: [] },
        [`${root}/b`]: { folders: [], snippets: [] },
      },
      expanded: [`${root}/a`, `${root}/a/sub`],
      allFolders: [root, `${root}/a`, `${root}/a/sub`, `${root}/b`],
    });
    const view = makeView(plugin);
    return { plugin, service, view };
  }

  describe('dragstart', () => {
    it('sets application/x-radi-snippet-file MIME on file row', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      expect(row).not.toBeNull();
      const dt = makeDataTransfer();
      const ev = makeDragEvent('dragstart', dt);
      fire(row!, ev);
      expect(dt.getData(MIME_FILE)).toBe(`${root}/note.json`);
      expect(dt.types).toContain(MIME_FILE);
      expect(dt.effectAllowed).toBe('move');
    });

    it('sets application/x-radi-snippet-folder MIME on folder row', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      expect(row).not.toBeNull();
      const dt = makeDataTransfer();
      const ev = makeDragEvent('dragstart', dt);
      fire(row!, ev);
      expect(dt.getData(MIME_FOLDER)).toBe(`${root}/a`);
      expect(dt.types).toContain(MIME_FOLDER);
    });

    it('adds is-dragging class to source row', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/note.json`);
      fire(row!, makeDragEvent('dragstart', makeDataTransfer()));
      expect(row!.classList.has('is-dragging')).toBe(true);
    });
  });

  describe('dragover guard', () => {
    it('preventDefault ONLY when our MIME is present', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const targetRow = findRow(view, `${root}/b`);
      const dt = makeDataTransfer({ [MIME_FILE]: `${root}/note.json` });
      const ev = makeDragEvent('dragover', dt);
      fire(targetRow!, ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(dt.dropEffect).toBe('move');
      expect(targetRow!.classList.has('radi-snippet-tree-drop-target')).toBe(true);
    });

    it('rejects dragover from foreign MIME (e.g. text/plain only)', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const targetRow = findRow(view, `${root}/b`);
      const dt = makeDataTransfer({ 'text/plain': 'hello' });
      const ev = makeDragEvent('dragover', dt);
      fire(targetRow!, ev);
      expect(ev.defaultPrevented).toBe(false);
      expect(targetRow!.classList.has('radi-snippet-tree-drop-target')).toBe(false);
    });

    it('adds drop-forbidden class on folder-into-self hover', async () => {
      const { view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      const dt = makeDataTransfer({ [MIME_FOLDER]: `${root}/a` });
      const ev = makeDragEvent('dragover', dt);
      fire(row!, ev);
      expect(ev.defaultPrevented).toBe(false);
      expect(row!.classList.has('radi-snippet-tree-drop-forbidden')).toBe(true);
      expect(row!.classList.has('radi-snippet-tree-drop-target')).toBe(false);
    });
  });

  describe('drop', () => {
    it('file onto folder → calls snippetService.moveSnippet', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const targetRow = findRow(view, `${root}/b`);
      const dt = makeDataTransfer({ [MIME_FILE]: `${root}/note.json` });
      const ev = makeDragEvent('drop', dt);
      fire(targetRow!, ev);
      // drop handler is async — wait for microtasks
      await Promise.resolve();
      await Promise.resolve();
      expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.json`, `${root}/b`);
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      expect(rewriteProtocolSnippetRefsSpy).toHaveBeenCalledTimes(1);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('folder onto folder → calls snippetService.moveFolder', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const targetRow = findRow(view, `${root}/b`);
      const dt = makeDataTransfer({ [MIME_FOLDER]: `${root}/a` });
      const ev = makeDragEvent('drop', dt);
      fire(targetRow!, ev);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(service.moveFolder).toHaveBeenCalledWith(`${root}/a`, `${root}/b`);
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      expect(rewriteProtocolSnippetRefsSpy).toHaveBeenCalledTimes(1);
    });

    it('folder dropped on itself → rejected, no service call', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const row = findRow(view, `${root}/a`);
      const dt = makeDataTransfer({ [MIME_FOLDER]: `${root}/a` });
      const ev = makeDragEvent('drop', dt);
      fire(row!, ev);
      await Promise.resolve();
      await Promise.resolve();
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
    });

    it('folder dropped on own descendant → rejected, no service call', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      const descRow = findRow(view, `${root}/a/sub`);
      expect(descRow).not.toBeNull();
      const dt = makeDataTransfer({ [MIME_FOLDER]: `${root}/a` });
      const ev = makeDragEvent('drop', dt);
      fire(descRow!, ev);
      await Promise.resolve();
      await Promise.resolve();
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
    });

    it('drop on file-row redirects to parent folder', async () => {
      const { service, view } = makeTreeView();
      await view.onOpen();
      // Drag root/note.json onto root/a/leaf.json → target should be dirname(leaf) = root/a
      const fileRow = findRow(view, `${root}/a/leaf.json`);
      expect(fileRow).not.toBeNull();
      const dt = makeDataTransfer({ [MIME_FILE]: `${root}/note.json` });
      const ev = makeDragEvent('drop', dt);
      fire(fileRow!, ev);
      await Promise.resolve();
      await Promise.resolve();
      expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.json`, `${root}/a`);
    });
  });

  describe('context menu Move to…', () => {
    const root = '.radiprotocol/snippets';

    beforeEach(() => {
      rewriteCanvasRefsSpy.mockClear();
      rewriteProtocolSnippetRefsSpy.mockClear();
      _lastMenuItems = [];
      // Phase 51 Plan 04 D-07 — new Modal + SnippetTreePicker instrumentation
      modalInstances.length = 0;
      pickerInstances.length = 0;
      pickerUnmountSpy.mockClear();
    });

    // Phase 51 Plan 04 D-07 helper — invoke the latest SnippetTreePicker's onSelect with
    // an absolute target path (tests express intent in absolute paths; the picker emits
    // root-relative paths, so we translate).
    async function selectAbsolute(absPath: string): Promise<void> {
      const opts = pickerInstances[pickerInstances.length - 1]!.options as {
        onSelect: (r: { kind: 'folder' | 'file'; relativePath: string }) => void;
        rootPath: string;
      };
      const rel = absPath === opts.rootPath
        ? ''
        : absPath.startsWith(opts.rootPath + '/')
          ? absPath.slice(opts.rootPath.length + 1)
          : absPath;
      opts.onSelect({ kind: 'folder', relativePath: rel });
      // handleSelect is async — flush microtasks
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    it('file branch: selecting folder in picker calls moveSnippet; rewriteCanvasRefs and rewriteProtocolSnippetRefs called', async () => {
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

      // Phase 51 D-07 — Modal + SnippetTreePicker is the picker surface
      expect(modalInstances.length).toBe(1);
      expect(modalInstances[0]!.isOpen).toBe(true);
      expect(pickerInstances.length).toBe(1);
      expect((pickerInstances[0]!.options as Record<string, unknown>).mode).toBe('folder-only');

      await selectAbsolute(`${root}/dst`);

      expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.json`, `${root}/dst`);
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      expect(rewriteProtocolSnippetRefsSpy).toHaveBeenCalledTimes(1);
      const canvasMapping = rewriteCanvasRefsSpy.mock.calls[0]![1] as Map<string, string>;
      expect(Array.from(canvasMapping.entries())).toEqual([['note', 'dst/note']]);
      const protocolMapping = rewriteProtocolSnippetRefsSpy.mock.calls[0]![1] as Map<string, string>;
      expect(Array.from(protocolMapping.entries())).toEqual([['note.json', 'dst/note.json']]);
    });

    it('folder branch: selecting target calls moveFolder then rewriteCanvasRefs and rewriteProtocolSnippetRefs with snippet-root-relative keys', async () => {
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

      await selectAbsolute(`${root}/b`);

      expect(service.moveFolder).toHaveBeenCalledWith(`${root}/a`, `${root}/b`);
      expect(rewriteCanvasRefsSpy).toHaveBeenCalledTimes(1);
      expect(rewriteProtocolSnippetRefsSpy).toHaveBeenCalledTimes(1);
      // Keys must be snippet-root-relative (D-03): oldKey 'a' → newKey 'b/a'
      const mapping = rewriteCanvasRefsSpy.mock.calls[0]![1] as Map<string, string>;
      expect(Array.from(mapping.entries())).toEqual([['a', 'b/a']]);
      // Protocol ref sync must receive the same mapping
      const protocolMapping = rewriteProtocolSnippetRefsSpy.mock.calls[0]![1] as Map<string, string>;
      expect(Array.from(protocolMapping.entries())).toEqual([['a', 'b/a']]);
    });

    it('folder branch: move-target safety guards reject source-self and descendants with Russian Notices', async () => {
      // Phase 51 D-07 — the picker is a generic widget; source-self + descendants are
      // filtered by the in-handler whitelist + explicit guard, surfacing Russian Notices
      // instead of silently failing.
      const { plugin, service } = makePlugin({
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

      // Attempt: select source itself → must be rejected
      await selectAbsolute(`${root}/a`);
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(modalInstances[0]!.isOpen).toBe(true);

      // Attempt: select a descendant of source → must be rejected
      await selectAbsolute(`${root}/a/sub`);
      expect(service.moveFolder).not.toHaveBeenCalled();
      expect(modalInstances[0]!.isOpen).toBe(true);

      // Attempt: select a valid sibling folder → allowed, performMove runs, modal closes
      await selectAbsolute(`${root}/b`);
      expect(service.moveFolder).toHaveBeenCalledWith(`${root}/a`, `${root}/b`);
      expect(modalInstances[0]!.isOpen).toBe(false);
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
      await selectAbsolute(`${root}/b`);

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
