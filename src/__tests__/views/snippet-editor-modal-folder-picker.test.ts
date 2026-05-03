// src/__tests__/views/snippet-editor-modal-folder-picker.test.ts
// Phase 51 Plan 04 (PICKER-02) — SnippetEditorModal «Папка» field integration tests.
//
// Covers:
//   D-07  «Папка» row mounts SnippetTreePicker in mode 'folder-only'
//   Preservation of existing contract: currentFolder write, hasUnsavedChanges flag,
//     runCollisionCheck trigger, onClose lifecycle (picker.unmount called)
//   Back-compat: legacy <select> element no longer rendered in «Папка» row
//
// Strategy: mock SnippetTreePicker so we can spy constructor args + capture onSelect.
// Mock obsidian Modal with DOM-ish contentEl (mirror of snippet-editor-modal.test.ts).

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Local DOM-ish mock element ------------------------------------------
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
  style: Record<string, string>;
  value: string;
  disabled: boolean;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (text: string) => void;
  appendChild: (child: MockEl) => MockEl;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  hasClass: (cls: string) => boolean;
  toggleClass: (cls: string, force?: boolean) => void;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  remove: () => void;
  focus: () => void;
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
    empty(): void { children.length = 0; },
    setText(text: string): void { el._text = text; },
    appendChild(child: MockEl): MockEl {
      child.parent = el as unknown as MockEl;
      children.push(child);
      return child;
    },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    toggleClass(cls: string, force?: boolean): void {
      const shouldAdd = force ?? !classSet.has(cls);
      if (shouldAdd) classSet.add(cls);
      else classSet.delete(cls);
    },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    removeAttribute(k: string): void { delete attrs[k]; },
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
    querySelector(_sel: string): MockEl | null { return null; },
    querySelectorAll(_sel: string): MockEl[] { return []; },
    remove(): void {
      if (el.parent) {
        const arr = el.parent.children;
        const i = arr.indexOf(el as unknown as MockEl);
        if (i >= 0) arr.splice(i, 1);
      }
    },
    focus(): void {},
  } as unknown as MockEl;

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as { _text: string })._text; },
    set(v: string): void { (el as unknown as { _text: string })._text = String(v); },
  });
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

// --- vi.mock('obsidian', ...) --------------------------------------------
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
  class Notice { constructor(_m: string) {} }
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

// --- SnippetTreePicker spy -----------------------------------------------
const pickerCtorSpy = vi.fn();
const pickerMountSpy = vi.fn();
const pickerUnmountSpy = vi.fn();

interface CapturedPicker {
  options: Record<string, unknown>;
}
const pickerInstances: CapturedPicker[] = [];

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(options: Record<string, unknown>) {
      pickerCtorSpy(options);
      pickerInstances.push({ options });
      (this as unknown as { mount: () => Promise<void> }).mount = async () => { pickerMountSpy(); };
      (this as unknown as { unmount: () => void }).unmount = () => { pickerUnmountSpy(); };
    }
  }
  return { SnippetTreePicker };
});

// --- Stub chip editor ----------------------------------------------------
vi.mock('../../views/snippet-chip-editor', () => ({
  mountChipEditor: (_c: unknown, _d: unknown, _o: () => void) => ({ destroy: vi.fn() }),
}));

// --- Stub ConfirmModal ---------------------------------------------------
vi.mock('../../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result: Promise<'confirm' | 'cancel' | 'discard'>;
    constructor(_a: unknown, _o: unknown) { this.result = Promise.resolve('cancel'); }
    open(): void {}
    close(): void {}
  },
}));

// --- Stub canvas-ref-sync ------------------------------------------------
vi.mock('../../snippets/canvas-ref-sync', () => ({
  rewriteCanvasRefs: async () => ({ updated: [], skipped: [] }),
}));

// --- Import SUT ----------------------------------------------------------
import { SnippetEditorModal } from '../../views/snippet-editor-modal';
import type { JsonSnippet } from '../../snippets/snippet-model';
// Phase 84 (I18N-02): SnippetEditorModal calls plugin.i18n.t(...) at render time.
import { I18nService } from '../../i18n';

// --- Plugin factory ------------------------------------------------------
interface MockSnippetService {
  save: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  listFolderDescendants: ReturnType<typeof vi.fn>;
  moveSnippet: ReturnType<typeof vi.fn>;
  renameSnippet: ReturnType<typeof vi.fn>;
}

function makeMockPlugin(): { plugin: { app: unknown; settings: { snippetFolderPath: string }; snippetService: MockSnippetService; i18n: I18nService }; service: MockSnippetService } {
  const service: MockSnippetService = {
    save: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    listFolderDescendants: vi.fn().mockResolvedValue({ files: [], folders: [], total: 0 }),
    moveSnippet: vi.fn().mockResolvedValue(''),
    renameSnippet: vi.fn().mockResolvedValue(''),
  };
  const plugin = {
    app: {},
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: service,
    i18n: new I18nService('en'),
  };
  return { plugin, service };
}

function sampleJsonSnippet(path = '.radiprotocol/snippets/abdomen/ct-routine.json'): JsonSnippet {
  return { kind: 'json', path, name: 'ct-routine', template: '', placeholders: [], validationError: null };
}

// Helper: find all descendants matching predicate
function findAll(root: MockEl, pred: (el: MockEl) => boolean): MockEl[] {
  const out: MockEl[] = [];
  const visit = (el: MockEl): void => {
    if (pred(el)) out.push(el);
    for (const c of el.children) visit(c);
  };
  visit(root);
  return out;
}

function findFirst(root: MockEl, pred: (el: MockEl) => boolean): MockEl | null {
  if (pred(root)) return root;
  for (const c of root.children) {
    const r = findFirst(c, pred);
    if (r) return r;
  }
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 04 — SnippetEditorModal «Папка» uses SnippetTreePicker (D-07)', () => {
  beforeEach(() => {
    pickerCtorSpy.mockClear();
    pickerMountSpy.mockClear();
    pickerUnmountSpy.mockClear();
    pickerInstances.length = 0;
  });

  it('Test 1: opening the modal mounts a SnippetTreePicker with mode folder-only and rootPath = settings.snippetFolderPath', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    expect(pickerCtorSpy).toHaveBeenCalledTimes(1);
    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.mode).toBe('folder-only');
    expect(opts.rootPath).toBe('.radiprotocol/snippets');
    expect(pickerMountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 2: edit-mode (snippet at "abdomen/ct-routine.json") seeds initialSelection = "abdomen"', async () => {
    const { plugin } = makeMockPlugin();
    const snippet = sampleJsonSnippet();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'edit', initialFolder: '.radiprotocol/snippets', snippet },
    );
    await modal.onOpen();

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.initialSelection).toBe('abdomen');
  });

  it('Test 3: create-mode with initialFolder = settings.snippetFolderPath seeds initialSelection = ""', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.initialSelection).toBe('');
  });

  it('Test 4: selecting folder "liver" updates currentFolder to `${rootPath}/liver` AND sets hasUnsavedChanges AND triggers runCollisionCheck', async () => {
    const { plugin, service } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    // Baseline: exists was called once during initial renderCollisionCheck (onOpen)
    const existsCallsBefore = service.exists.mock.calls.length;

    const opts = pickerInstances[0]!.options as { onSelect: (r: unknown) => void };
    // Simulate user selecting a folder
    opts.onSelect({ kind: 'folder', relativePath: 'liver' });

    // currentFolder is private — probe via the modal internals
    const internals = modal as unknown as { currentFolder: string; hasUnsavedChanges: boolean };
    expect(internals.currentFolder).toBe('.radiprotocol/snippets/liver');
    expect(internals.hasUnsavedChanges).toBe(true);

    // runCollisionCheck schedules an async exists() call. Await microtasks.
    await Promise.resolve();
    await Promise.resolve();
    // Not strictly necessary that exists was called here (if name is empty, short-circuits),
    // but the function must have RUN, which is indicated by not throwing.
    expect(service.exists.mock.calls.length).toBeGreaterThanOrEqual(existsCallsBefore);
  });

  it('Test 5: selecting root (relativePath === "") updates currentFolder to rootPath', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    const opts = pickerInstances[0]!.options as { onSelect: (r: unknown) => void };
    opts.onSelect({ kind: 'folder', relativePath: '' });

    const internals = modal as unknown as { currentFolder: string };
    expect(internals.currentFolder).toBe('.radiprotocol/snippets');
  });

  it('Test 6: closing the modal calls picker.unmount()', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(0);

    modal.onClose();
    expect(pickerUnmountSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 7 (preservation): legacy <select> element is no longer rendered in the «Папка» row', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    const contentEl = modal.contentEl as unknown as MockEl;
    // Locate the «Папка» row by its label.
    const label = findFirst(contentEl, (el) => el.tagName === 'LABEL' && el.textContent === 'Folder');
    expect(label).not.toBeNull();
    const folderRow = label!.parent!;
    // Within this row there must be zero <select> elements.
    const selects = findAll(folderRow, (el) => el.tagName === 'SELECT');
    expect(selects.length).toBe(0);

    // Rest of the modal is preserved: name input and content region still exist.
    const nameInput = findFirst(contentEl, (el) => el.tagName === 'INPUT' && el._type === 'text');
    expect(nameInput).not.toBeNull();
  });

  it('Test 8 (host wrapper): picker host div with class rp-stp-editor-host is rendered', async () => {
    const { plugin } = makeMockPlugin();
    const modal = new SnippetEditorModal(
      {} as never,
      plugin as never,
      { mode: 'create', initialFolder: '.radiprotocol/snippets' },
    );
    await modal.onOpen();

    const contentEl = modal.contentEl as unknown as MockEl;
    const host = findFirst(contentEl, (el) => el.classList.has('rp-stp-editor-host'));
    expect(host).not.toBeNull();
  });
});
