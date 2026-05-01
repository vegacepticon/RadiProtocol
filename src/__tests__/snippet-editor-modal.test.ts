// Phase 33 Plan 03 — MODAL-01..08 + D-09 pipeline tests.
//
// Testing strategy:
//   - The standard src/__mocks__/obsidian.ts Modal has a trivial contentEl
//     without DOM semantics. We override `obsidian` with a local factory that
//     installs a minimal DOM-ish contentEl/titleEl on Modal instances — enough
//     for the SnippetEditorModal to render into.
//   - We stub `./snippet-chip-editor` and `./confirm-modal` via vi.mock so we
//     can assert call signatures without pulling their real DOM code.
//   - A `SpyService` acts as plugin.snippetService, capturing save/delete/exists.
//   - `rewriteCanvasRefs` is spied via vi.mock on '../snippets/canvas-ref-sync'.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Local DOM-ish mock element -------------------------------------------
// Tracks children, classes, styles, value, listeners, and supports a minimal
// subset of the Obsidian HTMLElement extensions used by the modal under test.

interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  textContent: string;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  dataset: Record<string, string>;
  _type: string;
  placeholder: string;
  rows: number;
  inputMode: string;
  selectionStart: number;
  selectionEnd: number;
  // DOM-like methods
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (text: string) => void;
  appendChild: (child: MockEl) => MockEl;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  toggleClass: (cls: string, on?: boolean) => void;
  hasClass: (cls: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  contains: (other: MockEl | null) => boolean;
  remove: () => void;
  focus: () => void;
  style: Record<string, string>;
  // Extras
  htmlFor: string;
  id: string;
  name: string;
  value: string;
  disabled: boolean;
  readOnly: boolean;
  textAreaDispatch: () => void;
  // polymorphic accessors via Object.defineProperty
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const classSet = new Set<string>();
  const children: MockEl[] = [];

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _value: '',
    _disabled: false,
    _listeners: listeners,
    dataset,
    _type: '',
    placeholder: '',
    rows: 0,
    inputMode: '',
    selectionStart: 0,
    selectionEnd: 0,
    htmlFor: '',
    id: '',
    name: '',
    readOnly: false,
    style,
    createEl(
      subtag: string,
      opts?: { text?: string; cls?: string; type?: string },
    ): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) child.textContent = opts.text;
      if (opts?.cls) child.classList.add(opts.cls);
      if (opts?.type) child._type = opts.type;
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      el._text = text;
    },
    appendChild(child: MockEl): MockEl {
      child.parent = el as unknown as MockEl;
      children.push(child);
      return child;
    },
    addClass(cls: string): void {
      classSet.add(cls);
    },
    removeClass(cls: string): void {
      classSet.delete(cls);
    },
    toggleClass(cls: string, on?: boolean): void {
      const want = on ?? !classSet.has(cls);
      if (want) classSet.add(cls);
      else classSet.delete(cls);
    },
    hasClass(cls: string): boolean {
      return classSet.has(cls);
    },
    setAttribute(k: string, v: string): void {
      attrs[k] = v;
    },
    getAttribute(k: string): string | null {
      return attrs[k] ?? null;
    },
    removeAttribute(k: string): void {
      delete attrs[k];
    },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type);
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type);
      if (!arr) return;
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(_sel: string): MockEl | null {
      return null;
    },
    querySelectorAll(_sel: string): MockEl[] {
      return [];
    },
    contains(_other: MockEl | null): boolean {
      return false;
    },
    remove(): void {
      if (el.parent) {
        const arr = el.parent.children;
        const i = arr.indexOf(el as unknown as MockEl);
        if (i >= 0) arr.splice(i, 1);
      }
    },
    focus(): void {},
    textAreaDispatch(): void {
      el.dispatchEvent({ type: 'input' });
    },
  } as unknown as MockEl;

  // textContent accessor pair
  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as { _text: string })._text; },
    set(v: string): void { (el as unknown as { _text: string })._text = String(v); },
  });
  // value / disabled / type pass-through
  Object.defineProperty(el, 'value', {
    get(): string { return (el as unknown as { _value: string })._value; },
    set(v: string): void { (el as unknown as { _value: string })._value = String(v); },
  });
  Object.defineProperty(el, 'disabled', {
    get(): boolean { return (el as unknown as { _disabled: boolean })._disabled; },
    set(v: boolean): void { (el as unknown as { _disabled: boolean })._disabled = Boolean(v); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as unknown as { _type: string })._type; },
    set(v: string): void { (el as unknown as { _type: string })._type = String(v); },
  });

  return el;
}

// --- vi.mock('obsidian', ...) to swap Modal.contentEl with our MockEl -----
// We mock just the identifiers used by snippet-editor-modal.ts and the chip
// editor it no longer pulls (chip-editor is itself mocked below).
vi.mock('obsidian', () => {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    scope: { register: (mods: string[], key: string, cb: (e: unknown) => boolean) => void };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
      this.scope = { register: (): void => {} };
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice {
    message: string;
    constructor(msg: string) { this.message = msg; }
  }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(_i: T, _e: unknown): void {}
    onChooseSuggestion(_i: T, _e: unknown): void {}
    setPlaceholder(_p: string): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_e: unknown) {}
    setName(): this { return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addText(): this { return this; }
    addTextArea(): this { return this; }
    addDropdown(): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile { path: string; constructor(p = '') { this.path = p; } }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile };
});

// --- Stub chip editor: records calls, returns a destroy() spy -------------
const mountChipEditorSpy = vi.fn();
vi.mock('../views/snippet-chip-editor', () => ({
  mountChipEditor: (container: MockEl, draft: unknown, onChange: () => void) => {
    mountChipEditorSpy(container, draft, onChange);
    return { destroy: vi.fn() };
  },
}));

// --- Stub ConfirmModal: records constructor args + auto-cancels by default --
const confirmModalCtorSpy = vi.fn();
let confirmModalNextResult: 'confirm' | 'cancel' | 'discard' = 'cancel';
vi.mock('../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result: Promise<'confirm' | 'cancel' | 'discard'>;
    constructor(_app: unknown, options: unknown) {
      confirmModalCtorSpy(options);
      this.result = Promise.resolve(confirmModalNextResult);
    }
    open(): void {}
    close(): void {}
  },
}));

// --- Stub canvas-ref-sync ---
const rewriteCanvasRefsSpy = vi.fn();
vi.mock('../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: (app: unknown, mapping: Map<string, string>) => {
    rewriteCanvasRefsSpy(app, mapping);
    return Promise.resolve({ updated: ['canvas-a.canvas'], skipped: [] });
  },
}));

// --- Stub SnippetTreePicker (Phase 51 Plan 04 D-07) ---
// The real picker traverses real DOM (element.classList.contains); our MockEl uses
// Set-based classList without .contains(). Stub it here and capture the latest onSelect
// callback so existing tests that used to drive «Папка» change via the legacy <select>
// can now drive the new picker via the captured callback. The new SnippetEditorModal
// folder-picker behaviour is also covered by
// src/__tests__/views/snippet-editor-modal-folder-picker.test.ts.
let lastPickerOnSelect: ((result: { kind: 'folder' | 'file'; relativePath: string }) => void) | null = null;
vi.mock('../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    constructor(opts: { onSelect: (r: { kind: 'folder' | 'file'; relativePath: string }) => void }) {
      lastPickerOnSelect = opts.onSelect;
    }
    async mount(): Promise<void> {}
    unmount(): void {}
  },
}));

// --- Now import the module under test -------------------------------------
import { SnippetEditorModal } from '../views/snippet-editor-modal';
import type { JsonSnippet, MdSnippet, Snippet } from '../snippets/snippet-model';

// --- Factories ------------------------------------------------------------

interface MockSnippetService {
  save: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  listFolderDescendants: ReturnType<typeof vi.fn>;
  moveSnippet: ReturnType<typeof vi.fn>;
}

function makeMockPlugin(opts: {
  existsReturns?: (path: string) => boolean;
  descendants?: { files: string[]; folders: string[]; total: number };
  moveSnippetImpl?: (oldPath: string, newFolder: string) => Promise<string>;
} = {}): { plugin: { app: unknown; settings: { snippetFolderPath: string }; snippetService: MockSnippetService }; service: MockSnippetService } {
  const defaultMove = async (oldPath: string, newFolder: string): Promise<string> => {
    const basename = oldPath.slice(oldPath.lastIndexOf('/') + 1);
    return newFolder === '' ? basename : `${newFolder}/${basename}`;
  };
  const service: MockSnippetService = {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockImplementation((p: string) => {
      return Promise.resolve(opts.existsReturns ? opts.existsReturns(p) : false);
    }),
    listFolderDescendants: vi
      .fn()
      .mockResolvedValue(opts.descendants ?? { files: [], folders: [], total: 0 }),
    moveSnippet: vi.fn().mockImplementation(opts.moveSnippetImpl ?? defaultMove),
  };
  const plugin = {
    app: {},
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: service,
  };
  return { plugin, service };
}

function sampleJsonSnippet(path = '.radiprotocol/snippets/sample.json'): JsonSnippet {
  return {
    kind: 'json',
    path,
    name: 'sample',
    template: 'Hello {{who}}',
    placeholders: [{ id: 'who', label: 'Who', type: 'free-text' }],
    validationError: null,
  };
}

function sampleMdSnippet(path = '.radiprotocol/snippets/doc.md'): MdSnippet {
  return { kind: 'md', path, name: 'doc', content: '# hi' };
}

// Helper: find the first child of `root` whose text matches `predicate`
function findEl(root: MockEl, predicate: (el: MockEl) => boolean): MockEl | null {
  if (predicate(root)) return root;
  for (const c of root.children) {
    const r = findEl(c, predicate);
    if (r) return r;
  }
  return null;
}

function findAll(root: MockEl, predicate: (el: MockEl) => boolean): MockEl[] {
  const out: MockEl[] = [];
  const visit = (el: MockEl): void => {
    if (predicate(el)) out.push(el);
    for (const c of el.children) visit(c);
  };
  visit(root);
  return out;
}

// --- Tests ----------------------------------------------------------------

describe('SnippetEditorModal', () => {
  beforeEach(() => {
    mountChipEditorSpy.mockClear();
    confirmModalCtorSpy.mockClear();
    rewriteCanvasRefsSpy.mockClear();
    confirmModalNextResult = 'cancel';
    lastPickerOnSelect = null;
  });

  it('MODAL-01: create mode sets «Новый сниппет» title and renders type toggle', async () => {
    const { plugin } = makeMockPlugin();
     
    const modal = new SnippetEditorModal(
      {} as any,  
      plugin as any,  
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();
    // Title
    expect((modal.titleEl as unknown as MockEl)._text).toBe('Новый сниппет');
    // Type toggle buttons (JSON + Markdown) exist
    const toggleBtns = findAll(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el.getAttribute('role') === 'radio',
    );
    expect(toggleBtns.length).toBe(2);
    expect(toggleBtns.map((b) => b.getAttribute('data-kind')).sort()).toEqual(['json', 'md']);
  });

  it('MODAL-02: edit mode sets «Редактирование: {name}» title and pre-fills name input', async () => {
    const { plugin } = makeMockPlugin();
    const snippet = sampleJsonSnippet();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'edit',
      initialFolder: '.radiprotocol/snippets',
      snippet,
    });
    await modal.onOpen();
    expect((modal.titleEl as unknown as MockEl)._text).toBe('Редактирование: sample');
    const input = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'INPUT' && (el as MockEl)._type === 'text',
    );
    expect(input).not.toBeNull();
    expect(input!.value).toBe('sample');
  });

  it('MODAL-03: edit mode does NOT render the JSON/MD radio toggle (type locked)', async () => {
    const { plugin } = makeMockPlugin();
    const snippet = sampleJsonSnippet();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'edit',
      initialFolder: '.radiprotocol/snippets',
      snippet,
    });
    await modal.onOpen();
    const toggleBtns = findAll(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el.getAttribute('role') === 'radio',
    );
    expect(toggleBtns.length).toBe(0);
    // But a static type label still appears
    const staticLabel = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.classList.has('radi-snippet-editor-type-static'),
    );
    expect(staticLabel).not.toBeNull();
    expect(staticLabel!._text).toBe('JSON');
  });

  it('MODAL-04: create mode seeds the «Папка» picker to initialFolder', async () => {
    const { plugin } = makeMockPlugin({
      descendants: {
        files: [],
        folders: ['.radiprotocol/snippets/custom', '.radiprotocol/snippets/other'],
        total: 2,
      },
    });
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets/custom',
    });
    await modal.onOpen();
    // Phase 51 D-07 — currentFolder is seeded from initialFolder; the picker is a
    // SnippetTreePicker (stubbed in this suite). Probe the internal state.
    const internals = modal as unknown as { currentFolder: string };
    expect(internals.currentFolder).toBe('.radiprotocol/snippets/custom');
  });

  it('MODAL-05: changing «Папка» (via picker) and saving produces a snippet path under the new folder', async () => {
    const { plugin, service } = makeMockPlugin({
      descendants: {
        files: [],
        folders: ['.radiprotocol/snippets/a', '.radiprotocol/snippets/b'],
        total: 2,
      },
    });
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets/a',
    });
    await modal.onOpen();
    // Type a name
    const nameInput = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'INPUT' && (el as MockEl)._type === 'text',
    )!;
    nameInput.value = 'note';
    nameInput.dispatchEvent({ type: 'input' });
    // Phase 51 D-07 — change the folder via the picker's onSelect callback.
    expect(lastPickerOnSelect).not.toBeNull();
    lastPickerOnSelect!({ kind: 'folder', relativePath: 'b' });
    // Click Save button (find button with text "Создать")
    const saveBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Создать',
    )!;
    saveBtn.dispatchEvent({ type: 'click' });
    // Let microtasks settle
    await new Promise((r) => setTimeout(r, 20));
    expect(service.save).toHaveBeenCalled();
    const saved = service.save.mock.calls[0]?.[0] as Snippet;
    expect(saved.path).toBe('.radiprotocol/snippets/b/note.json');
  });

  it('MODAL-06: JSON create mode mounts the chip editor with a JsonSnippet draft', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets',
      initialKind: 'json',
    });
    await modal.onOpen();
    expect(mountChipEditorSpy).toHaveBeenCalledTimes(1);
    const [, draftArg] = mountChipEditorSpy.mock.calls[0] as [unknown, { kind: string }, unknown];
    expect(draftArg.kind).toBe('json');
  });

  it('MODAL-07: switching to MD swaps the chip editor for a textarea', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets',
      initialKind: 'json',
    });
    await modal.onOpen();
    expect(mountChipEditorSpy).toHaveBeenCalledTimes(1);
    // Click the Markdown toggle
    const mdBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el.getAttribute('data-kind') === 'md',
    )!;
    mdBtn.dispatchEvent({ type: 'click' });
    const textarea = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'TEXTAREA',
    );
    expect(textarea).not.toBeNull();
    // No new chip editor mount fired (still one total)
    expect(mountChipEditorSpy).toHaveBeenCalledTimes(1);
  });

  it('MODAL-08: unsaved-changes guard opens a 3-button ConfirmModal with discardLabel', async () => {
    const { plugin } = makeMockPlugin();
    const snippet = sampleJsonSnippet();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'edit',
      initialFolder: '.radiprotocol/snippets',
      snippet,
    });
    await modal.onOpen();
    // Mutate the name input to fire hasUnsavedChanges
    const nameInput = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'INPUT' && (el as MockEl)._type === 'text',
    )!;
    nameInput.value = 'edited';
    nameInput.dispatchEvent({ type: 'input' });
    // Click «Отмена»
    const cancelBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Отмена',
    )!;
    cancelBtn.dispatchEvent({ type: 'click' });
    await new Promise((r) => setTimeout(r, 20));
    expect(confirmModalCtorSpy).toHaveBeenCalled();
    const opts = confirmModalCtorSpy.mock.calls[0]?.[0] as {
      title: string;
      discardLabel: string;
      confirmLabel: string;
      cancelLabel: string;
    };
    expect(opts.title).toBe('Несохранённые изменения');
    expect(opts.discardLabel).toBe('Не сохранять');
    expect(opts.confirmLabel).toBe('Сохранить');
    expect(opts.cancelLabel).toBe('Отмена');
  });

  it('Phase 34 MOVE-04: edit-mode save with folder change calls moveSnippet (atomic), NOT delete+rewriteCanvasRefs', async () => {
    const { plugin, service } = makeMockPlugin({
      descendants: {
        files: [],
        folders: ['.radiprotocol/snippets/a', '.radiprotocol/snippets/b'],
        total: 2,
      },
    });
    // Seed an edit-mode snippet at folder /a
    const snippet: JsonSnippet = {
      kind: 'json',
      path: '.radiprotocol/snippets/a/note.json',
      name: 'note',
      template: 'x',
      placeholders: [],
      validationError: null,
    };
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'edit',
      initialFolder: '.radiprotocol/snippets/a',
      snippet,
    });
    await modal.onOpen();
    // Phase 51 D-07 — change folder via picker onSelect callback
    expect(lastPickerOnSelect).not.toBeNull();
    lastPickerOnSelect!({ kind: 'folder', relativePath: 'b' });
    // Click «Сохранить»
    const saveBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Сохранить',
    )!;
    saveBtn.dispatchEvent({ type: 'click' });
    await new Promise((r) => setTimeout(r, 20));
    // Save-at-old-path first
    expect(service.save).toHaveBeenCalled();
    const savedArg = service.save.mock.calls[0]?.[0] as Snippet;
    expect(savedArg.path).toBe('.radiprotocol/snippets/a/note.json');
    // Atomic moveSnippet replaces save+delete pipeline
    expect(service.moveSnippet).toHaveBeenCalledWith(
      '.radiprotocol/snippets/a/note.json',
      '.radiprotocol/snippets/b',
    );
    // Phase 34 cleanup: no delete, no rewriteCanvasRefs from the modal move branch
    expect(service.delete).not.toHaveBeenCalled();
    expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
  });

  it('Phase 34 MOVE-04: move-on-save Notice is exactly «Сниппет перемещён.» (no canvas-count suffix)', async () => {
    const noticeMessages: string[] = [];
    // Re-hook Notice constructor to capture messages
     
    const obsidianMod = await import('obsidian');
    const OrigNotice = (obsidianMod as unknown as { Notice: new (msg: string) => unknown }).Notice;
    (obsidianMod as unknown as { Notice: new (msg: string) => unknown }).Notice = class {
      constructor(msg: string) {
        noticeMessages.push(msg);
      }
    };

    try {
      const { plugin } = makeMockPlugin({
        descendants: {
          files: [],
          folders: ['.radiprotocol/snippets/a', '.radiprotocol/snippets/b'],
          total: 2,
        },
      });
      const snippet: JsonSnippet = {
        kind: 'json',
        path: '.radiprotocol/snippets/a/note.json',
        name: 'note',
        template: 'x',
        placeholders: [],
        validationError: null,
      };
      const modal = new SnippetEditorModal({} as never, plugin as never, {
        mode: 'edit',
        initialFolder: '.radiprotocol/snippets/a',
        snippet,
      });
      await modal.onOpen();
      // Phase 51 D-07 — change folder via picker onSelect callback
      expect(lastPickerOnSelect).not.toBeNull();
      lastPickerOnSelect!({ kind: 'folder', relativePath: 'b' });
      const saveBtn = findEl(
        modal.contentEl as unknown as MockEl,
        (el) => el.tagName === 'BUTTON' && el._text === 'Сохранить',
      )!;
      saveBtn.dispatchEvent({ type: 'click' });
      await new Promise((r) => setTimeout(r, 20));
      expect(noticeMessages).toContain('Сниппет перемещён.');
      expect(noticeMessages.some((m) => m.includes('Обновлено канвасов'))).toBe(false);
    } finally {
      (obsidianMod as unknown as { Notice: new (msg: string) => unknown }).Notice = OrigNotice;
    }
  });

  it('Phase 34 MOVE-04: moveSnippet collision → error Notice shown, modal remains open', async () => {
    const { plugin, service } = makeMockPlugin({
      descendants: {
        files: [],
        folders: ['.radiprotocol/snippets/a', '.radiprotocol/snippets/b'],
        total: 2,
      },
      moveSnippetImpl: async () => {
        throw new Error('Путь уже существует: .radiprotocol/snippets/b/note.json');
      },
    });
    const snippet: JsonSnippet = {
      kind: 'json',
      path: '.radiprotocol/snippets/a/note.json',
      name: 'note',
      template: 'x',
      placeholders: [],
      validationError: null,
    };
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'edit',
      initialFolder: '.radiprotocol/snippets/a',
      snippet,
    });
    await modal.onOpen();
    // Spy on super.close via resolved flag: subscribe to result promise
    let resolved = false;
    void modal.result.then(() => {
      resolved = true;
    });
    // Phase 51 D-07 — change folder via picker onSelect callback
    expect(lastPickerOnSelect).not.toBeNull();
    lastPickerOnSelect!({ kind: 'folder', relativePath: 'b' });
    const saveBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Сохранить',
    )!;
    saveBtn.dispatchEvent({ type: 'click' });
    await new Promise((r) => setTimeout(r, 20));
    // moveSnippet was attempted
    expect(service.moveSnippet).toHaveBeenCalled();
    // An error is surfaced via the in-modal save-error element
    const errorEl = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.classList.has('radi-snippet-editor-save-error'),
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl!._text).toContain('Не удалось сохранить');
    expect(errorEl!.style['display']).not.toBe('none');
    // Modal has NOT resolved (still open — result promise unresolved)
    expect(resolved).toBe(false);
    // No delete, no rewriteCanvasRefs from the failed move branch
    expect(service.delete).not.toHaveBeenCalled();
    expect(rewriteCanvasRefsSpy).not.toHaveBeenCalled();
  });

  it('Name collision disables Save and shows the inline error', async () => {
    const { plugin } = makeMockPlugin({
      existsReturns: (p: string) => p === '.radiprotocol/snippets/dup.json',
    });
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets',
    });
    await modal.onOpen();
    const nameInput = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'INPUT' && (el as MockEl)._type === 'text',
    )!;
    nameInput.value = 'dup';
    nameInput.dispatchEvent({ type: 'input' });
    // Wait out the 150ms debounce
    await new Promise((r) => setTimeout(r, 220));
    const saveBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Создать',
    )!;
    expect(saveBtn.disabled).toBe(true);
    const errorEl = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.classList.has('radi-snippet-editor-collision-error'),
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl!._text).toBe('Файл с таким именем уже существует в этой папке.');
    // Error should be shown, not display:none
    expect(errorEl!.style['display']).not.toBe('none');
  });

  it('MD mode: editing the textarea marks the draft as unsaved and routes to MD save', async () => {
    void sampleMdSnippet; // touch to avoid unused-import pruning in strict builds
    const { plugin, service } = makeMockPlugin();
    const modal = new SnippetEditorModal({} as never, plugin as never, {
      mode: 'create',
      initialFolder: '.radiprotocol/snippets',
      initialKind: 'md',
    });
    await modal.onOpen();
    const ta = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'TEXTAREA',
    )!;
    ta.value = 'Hello markdown';
    ta.dispatchEvent({ type: 'input' });
    // Provide a name
    const nameInput = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'INPUT' && (el as MockEl)._type === 'text',
    )!;
    nameInput.value = 'doc';
    nameInput.dispatchEvent({ type: 'input' });
    // Save
    const saveBtn = findEl(
      modal.contentEl as unknown as MockEl,
      (el) => el.tagName === 'BUTTON' && el._text === 'Создать',
    )!;
    saveBtn.dispatchEvent({ type: 'click' });
    await new Promise((r) => setTimeout(r, 20));
    expect(service.save).toHaveBeenCalled();
    const saved = service.save.mock.calls[0]?.[0] as MdSnippet;
    expect(saved.kind).toBe('md');
    expect(saved.path).toBe('.radiprotocol/snippets/doc.md');
    expect(saved.content).toBe('Hello markdown');
  });
});
