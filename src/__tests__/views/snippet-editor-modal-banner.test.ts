// src/__tests__/views/snippet-editor-modal-banner.test.ts
// Phase 52 Plan 01 (D-04 RED) — SnippetEditorModal banner + disabled Save for
// broken snippets (validationError !== null).
//
// RED at Plan 01 commit time. Plan 04 wires the banner rendering logic and
// flips B1-B4 GREEN. B5 is the control baseline (valid snippet → no banner).

import { describe, it, expect, vi } from 'vitest';

// ───── Minimal MockEl (borrowed style from snippet-editor-modal.test.ts) ─────
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  id: string;
  name: string;
  htmlFor: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  readOnly: boolean;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  appendChild: (c: MockEl) => MockEl;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  focus: () => void;
  contains: (other: MockEl | null) => boolean;
  remove: () => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const children: MockEl[] = [];
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const classSet = new Set<string>();
  const dataset: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _value: '',
    _disabled: false,
    _type: '',
    _listeners: listeners,
    id: '',
    name: '',
    htmlFor: '',
    dataset,
    readOnly: false,
    style,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) (child as unknown as { _text: string })._text = opts.text;
      if (opts?.cls) child.classList.add(opts.cls);
      if (opts?.type) (child as unknown as { _type: string })._type = opts.type;
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
    setText(text: string): void { (el as unknown as { _text: string })._text = text; },
    appendChild(child: MockEl): MockEl {
      child.parent = el as unknown as MockEl;
      children.push(child);
      return child;
    },
    addClass(c: string): void { classSet.add(c); },
    removeClass(c: string): void { classSet.delete(c); },
    toggleClass(c: string, on?: boolean): void {
      const want = on ?? !classSet.has(c);
      if (want) classSet.add(c);
      else classSet.delete(c);
    },
    hasClass(c: string): boolean { return classSet.has(c); },
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
    querySelector(sel: string): MockEl | null {
      const all = walk(el as unknown as MockEl, sel);
      return all[0] ?? null;
    },
    querySelectorAll(sel: string): MockEl[] {
      return walk(el as unknown as MockEl, sel);
    },
    focus(): void {},
    contains(_o: MockEl | null): boolean { return false; },
    remove(): void {
      if (el.parent) {
        const arr = el.parent.children;
        const i = arr.indexOf(el as unknown as MockEl);
        if (i >= 0) arr.splice(i, 1);
      }
    },
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

function walk(root: MockEl, sel: string): MockEl[] {
  const out: MockEl[] = [];
  const match = buildMatcher(sel);
  const stack: MockEl[] = [...root.children];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (match(cur)) out.push(cur);
    for (const c of cur.children) stack.push(c);
  }
  return out;
}

function buildMatcher(sel: string): (el: MockEl) => boolean {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  return (el) => el.tagName === sel.toUpperCase();
}

// ───── Mock obsidian (real Modal + Setting) ─────
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
    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice { message: string; constructor(m: string) { this.message = m; } }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(): void {}
    onChooseSuggestion(): void {}
    setPlaceholder(): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_e: unknown) {}
    setName(): this { return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addText(_cb?: (t: unknown) => void): this {
      if (_cb) _cb({
        inputEl: { type: '', min: '' },
        setValue: (): unknown => ({}),
        onChange: (): unknown => ({}),
      });
      return this;
    }
    addTextArea(_cb?: (t: unknown) => void): this { return this; }
    addDropdown(_cb?: (t: unknown) => void): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile { path: string; constructor(p = '') { this.path = p; } }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile };
});

// Stub dependencies the modal pulls in
vi.mock('../../views/snippet-chip-editor', () => ({
  mountChipEditor: vi.fn(() => ({ destroy: vi.fn() })),
}));
vi.mock('../../views/confirm-modal', () => ({
  ConfirmModal: class {
    constructor(_app: unknown, _opts: unknown) {}
    open(): void {}
  },
}));
vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    constructor(_opts: unknown) {}
    mount(): Promise<void> { return Promise.resolve(); }
    unmount(): void {}
  },
}));

import { SnippetEditorModal } from '../../views/snippet-editor-modal';
import type { JsonSnippet } from '../../snippets/snippet-model';
// Phase 84 (I18N-02): SnippetEditorModal now reads plugin.i18n.t(...) for copy.
import { I18nService } from '../../i18n';

type BrokenSnippet = JsonSnippet & { validationError: string | null };

function makeBrokenSnippet(validationError: string | null): BrokenSnippet {
  return {
    kind: 'json',
    path: 'Protocols/Snippets/broken.json',
    name: 'broken',
    template: 'V: {{v}}',
    placeholders: [{ id: 'v', label: 'V', type: 'choice', options: [] }],
    validationError,
  } as BrokenSnippet;
}

function makePlugin() {
  return {
    settings: {
      snippetFolderPath: 'Protocols/Snippets',
      snippetTreeExpandedPaths: [],
      sessionFolderPath: '.radiprotocol/sessions',
    },
    snippetService: {
      exists: vi.fn().mockResolvedValue(false),
      listFolderDescendants: vi.fn().mockResolvedValue({ folders: [], files: [], total: 0 }),
      save: vi.fn(),
      moveSnippet: vi.fn(),
      renameSnippet: vi.fn(),
    },
    i18n: new I18nService('en'),
  } as unknown as ConstructorParameters<typeof SnippetEditorModal>[1];
}

async function openModal(snippet: BrokenSnippet) {
  const app = {} as never;
  const plugin = makePlugin();
  const modal = new SnippetEditorModal(
    app,
    plugin as never,
    {
      mode: 'edit',
      initialFolder: 'Protocols/Snippets',
      snippet: snippet as unknown as JsonSnippet,
    },
  );
  // SnippetEditorModal.onOpen is async — allow microtasks to flush
  void modal.onOpen();
  await Promise.resolve();
  await Promise.resolve();
  return modal;
}

describe('SnippetEditorModal Phase 52 D-04 — broken snippet banner + disabled Save (RED)', () => {
  it('B1: opening a broken snippet in edit mode renders a validation banner element', async () => {
    const snippet = makeBrokenSnippet(
      'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    );
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const banner =
      contentEl.querySelector('.radi-snippet-editor-validation-banner') ??
      contentEl.querySelector('.rp-validation-banner');
    expect(banner).not.toBeNull();
  });

  it('B2: Save button is disabled when snippet has validationError', async () => {
    const snippet = makeBrokenSnippet(
      'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
    );
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const saveBtn = contentEl
      .querySelectorAll('button')
      .find((b) => (b as unknown as { _text: string })._text === 'Save');
    expect(saveBtn).toBeTruthy();
    expect((saveBtn as unknown as { _disabled: boolean })._disabled).toBe(true);
  });

  it('B3: banner textContent contains the snippet validationError string verbatim', async () => {
    const errText =
      'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.';
    const snippet = makeBrokenSnippet(errText);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const banner =
      contentEl.querySelector('.radi-snippet-editor-validation-banner') ??
      contentEl.querySelector('.rp-validation-banner');
    expect(banner).not.toBeNull();
    expect((banner as unknown as { _text: string })._text).toContain(errText);
  });

  it('B4: banner renders error via textContent (T-52-03 XSS guard)', async () => {
    // Inject a <script> substring. If the banner safely uses textContent, the
    // substring is rendered as literal text (present in _text) and no child
    // <script> element is created.
    const errText =
      'Плейсхолдер "v" <script>alert(1)</script> типа "choice" не содержит ни одного варианта.';
    const snippet = makeBrokenSnippet(errText);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const banner =
      contentEl.querySelector('.radi-snippet-editor-validation-banner') ??
      contentEl.querySelector('.rp-validation-banner');
    expect(banner).not.toBeNull();
    expect((banner as unknown as { _text: string })._text).toContain('<script>');
    expect(banner?.querySelector('script')).toBeNull();
  });

  // ───── Phase 56 D-08: unsaved-folder dot indicator ─────
  // The five behaviour cases below mirror the five behaviours in the plan:
  //   D1 — initial open: dot exists, NOT visible (savedFolder === currentFolder)
  //   D2 — picker onSelect different folder: dot becomes visible (.is-visible)
  //   D3 — successful save commits new baseline: dot hides again
  //   D4 — selecting back to the saved folder: dot hides
  //   D5 — dot is a <span> child of the «Папка» label, not in the modal header

  it('D1: opening edit modal — unsaved-folder dot exists but is hidden (savedFolder === currentFolder)', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot).not.toBeNull();
    expect(dot!.classList.has('is-visible')).toBe(false);
  });

  it('D2: SnippetTreePicker onSelect → folder differs → dot becomes visible', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    // Simulate a folder change: write currentFolder to a new value and trigger
    // updateFolderUnsavedDot via the same channel the onSelect callback uses.
    const m = modal as unknown as {
      currentFolder: string;
      updateFolderUnsavedDot: () => void;
    };
    m.currentFolder = 'Protocols/Snippets/Subfolder';
    m.updateFolderUnsavedDot();
    const dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot).not.toBeNull();
    expect(dot!.classList.has('is-visible')).toBe(true);
  });

  it('D3: after save commits the new folder as savedFolder baseline, dot hides', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const m = modal as unknown as {
      currentFolder: string;
      savedFolder: string;
      updateFolderUnsavedDot: () => void;
    };
    // Step 1: differ → visible
    m.currentFolder = 'Protocols/Snippets/Subfolder';
    m.updateFolderUnsavedDot();
    let dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot!.classList.has('is-visible')).toBe(true);
    // Step 2: save commits baseline
    m.savedFolder = m.currentFolder;
    m.updateFolderUnsavedDot();
    dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot!.classList.has('is-visible')).toBe(false);
  });

  it('D4: selecting the same folder as savedFolder hides the dot', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const m = modal as unknown as {
      currentFolder: string;
      savedFolder: string;
      updateFolderUnsavedDot: () => void;
    };
    // Differ first
    m.currentFolder = 'Protocols/Snippets/Other';
    m.updateFolderUnsavedDot();
    let dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot!.classList.has('is-visible')).toBe(true);
    // Now revert to saved
    m.currentFolder = m.savedFolder;
    m.updateFolderUnsavedDot();
    dot = contentEl.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dot!.classList.has('is-visible')).toBe(false);
  });

  it('D5: dot is a <span> child of the «Папка» label element (not in modal header)', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    // Locate the «Папка» label among all rendered <label> nodes.
    const labels = contentEl.querySelectorAll('label');
    const folderLabel = labels.find(
      (l) => (l as unknown as { _text: string })._text === 'Folder',
    );
    expect(folderLabel).toBeTruthy();
    const dotInLabel = folderLabel!.querySelector('.rp-snippet-editor-unsaved-dot');
    expect(dotInLabel).not.toBeNull();
    expect(dotInLabel!.tagName).toBe('SPAN');
    // titleEl must NOT contain the dot
    const titleEl = (modal as unknown as { titleEl: MockEl }).titleEl;
    expect(titleEl.querySelector('.rp-snippet-editor-unsaved-dot')).toBeNull();
  });

  it('B5: valid snippet (validationError: null) renders NO banner and Save enabled (control)', async () => {
    const snippet = makeBrokenSnippet(null);
    const modal = await openModal(snippet);
    const contentEl = (modal as unknown as { contentEl: MockEl }).contentEl;
    const banner =
      contentEl.querySelector('.radi-snippet-editor-validation-banner') ??
      contentEl.querySelector('.rp-validation-banner');
    expect(banner).toBeNull();
    const saveBtn = contentEl
      .querySelectorAll('button')
      .find((b) => (b as unknown as { _text: string })._text === 'Save');
    if (saveBtn) {
      // The snippet is valid so Save must NOT be disabled due to validation.
      // (Collision error may still disable Save; for B5 we assert the known
      // baseline where no banner is present.)
      expect((saveBtn as unknown as { _disabled: boolean })._disabled).toBe(false);
    }
  });
});
