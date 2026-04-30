// src/__tests__/views/snippet-manager-folder-picker.test.ts
// Phase 51 Plan 04 (PICKER-02) — Snippet Manager «Переместить в…» integration tests.
//
// Covers D-07:
//   - openMovePicker opens a Modal whose content hosts a SnippetTreePicker (folder-only)
//   - Selecting a folder closes the modal AND calls performMove with the correct absolute target
//   - Selecting root (relativePath === '') calls performMove with rootPath
//   - Cancelling the modal (close without selection) does NOT call performMove
//   - Selecting source folder itself → Russian Notice, performMove NOT called
//   - Selecting a descendant of the source folder → Russian Notice, performMove NOT called
//
// Strategy: stub SnippetTreePicker + Obsidian Modal to capture construction, open/close,
// and onSelect. Stub other modals too.

import { describe, it, expect, beforeEach, vi } from 'vitest';

(globalThis as unknown as { window: unknown }).window = globalThis;

// --- Minimal DOM-ish mock element ----------------------------------------
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  textContent: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  value: string;
  placeholder: string;
  style: Record<string, string>;
  dataset: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string }) => void;
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
    _listeners: listeners,
    value: '',
    placeholder: '',
    style,
    dataset,
    createEl(t: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
      const child = makeEl(t);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) { child._text = opts.text; child.textContent = opts.text; }
      if (opts?.cls) for (const c of opts.cls.split(/\s+/)) child.classList.add(c);
      if (opts?.attr) for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = v;
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
    setText(t: string): void { el._text = t; el.textContent = t; },
    addClass(c: string): void { classSet.add(c); },
    removeClass(c: string): void { classSet.delete(c); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    dispatchEvent(event: { type: string }): void {
      const arr = listeners.get(event.type) ?? [];
      for (const h of arr) h(event as unknown);
    },
    querySelector(_sel: string): MockEl | null { return null; },
    querySelectorAll(_sel: string): MockEl[] { return []; },
    focus(): void {},
  };
  return el;
}

// --- obsidian mock with Modal instrumentation ---------------------------
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
let lastNoticeMessage = '';

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
    constructor(msg: string) { this.message = msg; lastNoticeMessage = msg; }
  }
  const setIcon = vi.fn((_el: unknown, _icon: string) => {});
  class Menu {
    items: Array<{ title: string; cb: () => void }> = [];
    addItem(cb: (item: { setTitle: (t: string) => unknown; setIcon: (i: string) => unknown; onClick: (c: () => void) => unknown }) => void): this {
      const state: { title: string; cb: () => void } = { title: '', cb: () => {} };
      const api = {
        setTitle: (t: string) => { state.title = t; return api; },
        setIcon: (_i: string) => api,
        onClick: (c: () => void) => { state.cb = c; return api; },
      };
      cb(api);
      this.items.push(state);
      return this;
    }
    addSeparator(): this { return this; }
    showAtMouseEvent(_ev: unknown): void {}
  }
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    private _captured: CapturedModal;
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
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    setPlaceholder(_s: string): void {}
    open(): void {}
    close(): void {}
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(_i: T, _e: unknown): void {}
    onChooseSuggestion(_i: T, _e: unknown): void {}
  }
  return { ItemView, WorkspaceLeaf, Notice, setIcon, Menu, Modal, SuggestModal };
});

// --- SnippetTreePicker stub ---------------------------------------------
interface CapturedPicker {
  options: Record<string, unknown>;
}
const pickerInstances: CapturedPicker[] = [];
const pickerMountSpy = vi.fn();
const pickerUnmountSpy = vi.fn();

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    private readonly opts: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.opts = options;
      pickerInstances.push({ options });
    }
    async mount(): Promise<void> { pickerMountSpy(); }
    unmount(): void { pickerUnmountSpy(); }
  },
}));

// --- Stub other modal imports ------------------------------------------
vi.mock('../../views/snippet-editor-modal', () => ({
  SnippetEditorModal: class {
    readonly result = Promise.resolve({ saved: false });
    constructor(_a: unknown, _p: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
vi.mock('../../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result = Promise.resolve('cancel' as const);
    constructor(_a: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
vi.mock('../../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: async () => ({ updated: [], skipped: [] }),
}));

// --- Import SUT --------------------------------------------------------
import { SnippetManagerView } from '../../views/snippet-manager-view';

// --- Plugin factory ----------------------------------------------------
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

function makePlugin(opts: {
  allFolders?: string[];
  moveSnippetImpl?: (oldPath: string, newFolder: string) => Promise<string>;
  moveFolderImpl?: (oldPath: string, newParent: string) => Promise<string>;
} = {}): { plugin: unknown; service: MockService } {
  const service: MockService = {
    listFolder: vi.fn(() => Promise.resolve({ folders: [], snippets: [] })),
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
      snippetTreeExpandedPaths: [],
    },
    snippetService: service,
    saveSettings: vi.fn().mockResolvedValue(undefined),
  };
  return { plugin, service };
}

function makeView(plugin: unknown): SnippetManagerView {
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  return new SnippetManagerView(leaf, plugin as never);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 04 — SnippetManager «Переместить в…» uses SnippetTreePicker (D-07)', () => {
  const root = '.radiprotocol/snippets';

  beforeEach(() => {
    pickerInstances.length = 0;
    pickerMountSpy.mockClear();
    pickerUnmountSpy.mockClear();
    modalInstances.length = 0;
    lastNoticeMessage = '';
  });

  it('Test 1: openMovePicker opens a Modal containing a SnippetTreePicker in folder-only mode', async () => {
    const { plugin } = makePlugin({ allFolders: [root, `${root}/dst`] });
    const view = makeView(plugin);

    const node = { kind: 'file' as const, path: `${root}/note.json`, name: 'note', snippetKind: 'json' as const };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    // A Modal was opened
    expect(modalInstances.length).toBe(1);
    expect(modalInstances[0]!.isOpen).toBe(true);
    expect(modalInstances[0]!.title).toBe('Переместить в…');

    // A SnippetTreePicker was mounted inside the modal
    expect(pickerInstances.length).toBe(1);
    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.mode).toBe('folder-only');
    expect(opts.rootPath).toBe(root);
    expect(pickerMountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 2: selecting folder "abdomen" closes the modal AND calls performMove with the correct absolute target', async () => {
    const { plugin, service } = makePlugin({ allFolders: [root, `${root}/abdomen`] });
    const view = makeView(plugin);

    const node = { kind: 'file' as const, path: `${root}/note.json`, name: 'note', snippetKind: 'json' as const };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    const onSelect = (pickerInstances[0]!.options as { onSelect: (r: unknown) => void }).onSelect;
    // User selects «abdomen»
    onSelect({ kind: 'folder', relativePath: 'abdomen' });
    // Await microtasks — handleSelect is async
    await Promise.resolve();
    await Promise.resolve();

    expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.json`, `${root}/abdomen`);
    // Modal closed
    expect(modalInstances[0]!.isOpen).toBe(false);
  });

  it('Test 3: selecting root (relativePath === "") calls performMove with rootPath', async () => {
    const { plugin, service } = makePlugin({ allFolders: [root, `${root}/sub`] });
    const view = makeView(plugin);

    // Source is a file under /sub → root is a valid destination (not current parent)
    const node = { kind: 'file' as const, path: `${root}/sub/note.json`, name: 'note', snippetKind: 'json' as const };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    const onSelect = (pickerInstances[0]!.options as { onSelect: (r: unknown) => void }).onSelect;
    onSelect({ kind: 'folder', relativePath: '' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/sub/note.json`, root);
  });

  it('Test 4: cancelling the modal (close without selection) does NOT call performMove', async () => {
    const { plugin, service } = makePlugin({ allFolders: [root, `${root}/abdomen`] });
    const view = makeView(plugin);

    const node = { kind: 'file' as const, path: `${root}/note.json`, name: 'note', snippetKind: 'json' as const };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    // User closes without selecting
    modalInstances[0]!.close();
    await Promise.resolve();

    expect(service.moveSnippet).not.toHaveBeenCalled();
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 5: selecting the source folder itself → Russian Notice, performMove NOT called', async () => {
    const { plugin, service } = makePlugin({ allFolders: [root, `${root}/a`, `${root}/b`] });
    const view = makeView(plugin);

    const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', children: [] };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    const onSelect = (pickerInstances[0]!.options as { onSelect: (r: unknown) => void }).onSelect;
    // User tries to select the SOURCE folder itself
    onSelect({ kind: 'folder', relativePath: 'a' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.moveFolder).not.toHaveBeenCalled();
    // Modal stays open
    expect(modalInstances[0]!.isOpen).toBe(true);
    // A Russian Notice was fired
    expect(lastNoticeMessage.length).toBeGreaterThan(0);
    expect(/[А-Яа-я]/.test(lastNoticeMessage)).toBe(true);
  });

  it('Test 6: selecting a descendant of the source folder → Russian Notice, performMove NOT called', async () => {
    const { plugin, service } = makePlugin({
      allFolders: [root, `${root}/a`, `${root}/a/sub`, `${root}/b`],
    });
    const view = makeView(plugin);

    const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', children: [] };
    await (view as unknown as { openMovePicker: (n: unknown) => Promise<void> }).openMovePicker(node);

    const onSelect = (pickerInstances[0]!.options as { onSelect: (r: unknown) => void }).onSelect;
    // User selects descendant folder «a/sub»
    onSelect({ kind: 'folder', relativePath: 'a/sub' });
    await Promise.resolve();
    await Promise.resolve();

    expect(service.moveFolder).not.toHaveBeenCalled();
    expect(modalInstances[0]!.isOpen).toBe(true);
    expect(lastNoticeMessage.length).toBeGreaterThan(0);
    expect(/[А-Яа-я]/.test(lastNoticeMessage)).toBe(true);
  });
});
