// Shared host fixtures for inline runner modal tests.
import { vi } from 'vitest';
import { I18nService } from '../../i18n';

// MockEl harness
export interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  dataset: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  prepend: (el: MockEl) => void;
}

export function makeEl(tag = 'div'): MockEl {
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
    _style: style,
    _value: '',
    _disabled: false,
    _type: '',
    _checked: false,
    _listeners: listeners,
    name: '',
    inputMode: '',
    readOnly: false,
    dataset,
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
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      if (on ?? !classSet.has(cls)) classSet.add(cls); else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type); if (!arr) return;
      const i = arr.indexOf(handler); if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type); if (!arr) return;
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(sel: string): MockEl | null { return walk(el as unknown as MockEl, sel)[0] ?? null; },
    querySelectorAll(sel: string): MockEl[] { return walk(el as unknown as MockEl, sel); },
    prepend(child: MockEl): void { children.unshift(child); child.parent = el as unknown as MockEl; },
    style,
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
  Object.defineProperty(el, 'checked', {
    get(): boolean { return (el as unknown as { _checked: boolean })._checked; },
    set(v: boolean): void { (el as unknown as { _checked: boolean })._checked = Boolean(v); },
  });

  return el;
}

export function walk(root: MockEl, sel: string): MockEl[] {
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

export function buildMatcher(sel: string): (el: MockEl) => boolean {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]+)"\]$/.exec(sel);
  if (tagAttrMatch) {
    const [, tag, attr, val] = tagAttrMatch;
    return (el) => {
      if (el.tagName !== tag!.toUpperCase()) return false;
      if (attr === 'type') return (el as unknown as { _type: string })._type === val;
      return el.getAttribute(attr!) === val;
    };
  }
  return (el) => el.tagName === sel.toUpperCase();
}

export function findByClass(root: MockEl, cls: string): MockEl[] {
  return walk(root, '.' + cls);
}

// Module mock factories

export function createObsidianModuleMock(): Record<string, unknown> {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
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
    constructor(public app: unknown) {}
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
    addText(): this { return this; }
    addTextArea(): this { return this; }
    addDropdown(): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile {
    path: string;
    extension: string;
    basename: string;
    constructor(p = '') {
      this.path = p;
      const parts = p.split('/');
      const leaf = parts[parts.length - 1] ?? '';
      const dot = leaf.lastIndexOf('.');
      this.extension = dot >= 0 ? leaf.slice(dot + 1) : '';
      this.basename = dot >= 0 ? leaf.slice(0, dot) : leaf;
    }
  }
  class TFolder {
    path: string;
    name: string;
    children: Array<TFile | TFolder>;
    constructor(p = '', children: Array<TFile | TFolder> = []) {
      this.path = p;
      this.name = p.split('/').pop() ?? '';
      this.children = children;
    }
  }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile, TFolder };
}

// ───── SnippetFillInModal mock ─────────────────────────────────────────────

export interface FillModalInstance {
  snippet: unknown;
  result: Promise<string | null>;
  __resolve: (v: string | null) => void;
  open: () => void;
  close: () => void;
  opened: boolean;
}

const fillModalInstances: FillModalInstance[] = [];

export function getFillModalInstances(): FillModalInstance[] {
  return fillModalInstances;
}

export function resetFillModalInstances(): void {
  fillModalInstances.length = 0;
}

export function createSnippetFillInModalMock(): Record<string, unknown> {
  class SnippetFillInModal {
    result: Promise<string | null>;
    private resolveFn!: (v: string | null) => void;
    opened = false;
    closed = false;
    readonly snippet: unknown;
    constructor(_app: unknown, snippet: unknown) {
      this.snippet = snippet;
      this.result = new Promise<string | null>(res => { this.resolveFn = res; });
      fillModalInstances.push(this as unknown as FillModalInstance);
    }
    __resolve(v: string | null): void { this.resolveFn(v); }
    open(): void { this.opened = true; }
    close(): void { this.closed = true; }
  }
  return { SnippetFillInModal, __fillModalInstances: fillModalInstances };
}

// SnippetTreePicker mock
export function createSnippetTreePickerMock(mountSpy: () => void): Record<string, unknown> {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> { mountSpy(); }
    unmount(): void {}
  }
  return { SnippetTreePicker };
}

// InlineRunnerModal harness helpers

export function makeBasePlugin(opts: { textSeparator?: string; snippetFolderPath?: string } = {}) {
  // Phase 85 INLINE-MULTI-01: shared registry backing the registerInlineRunner /
  // unregisterInlineRunner / getInlineRunner / getOpenInlineRunners mocks. Tests
  // can inspect `plugin.inlineRunners` directly to assert registry state.
  const inlineRunners = new Map<string, unknown>();
  return {
    settings: {
      textSeparator: opts.textSeparator ?? 'newline',
      snippetFolderPath: opts.snippetFolderPath ?? 'Snippets',
      protocolFolderPath: 'Protocols',
      locale: 'ru',
    },
    snippetService: { load: vi.fn(async (_absPath: string) => null) },
    insertMutex: { runExclusive: vi.fn(async (_path: string, fn: () => Promise<void>) => fn()) },
    activateRunnerView: vi.fn(),
    canvasLiveEditor: { getCanvasJSON: () => null },
    _vaultModifyCalls: [] as Array<[string, string]>,
    // Phase 84 I18N-02: real I18nService so InlineRunnerModal/RunnerView constructors'
    // `this.plugin.i18n.t.bind(this.plugin.i18n)` does not throw.
    i18n: new I18nService('ru'),
    // Phase 85 INLINE-MULTI-01: registry mock methods.
    inlineRunners,
    registerInlineRunner: vi.fn((key: string, modal: unknown) => { inlineRunners.set(key, modal); }),
    unregisterInlineRunner: vi.fn((key: string) => { inlineRunners.delete(key); }),
    getInlineRunner: vi.fn((key: string) => inlineRunners.get(key) ?? null),
    getOpenInlineRunners: vi.fn(() => Array.from(inlineRunners.values())),
  };
}

export function makeBaseApp(plugin: ReturnType<typeof makeBasePlugin>, opts: { vaultContent?: string } = {}) {
  const vaultContent = opts.vaultContent ?? '';
  const modifyCalls: Array<[string, string]> = [];
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(async () => vaultContent),
      modify: vi.fn(async (file: { path: string }, content: string) => {
        modifyCalls.push([file.path, content]);
        plugin._vaultModifyCalls.push([file.path, content]);
      }),
      getFiles: vi.fn(() => []),
    },
    workspace: {
      on: vi.fn(() => ({})),
      getActiveFile: vi.fn(() => null),
      iterateAllLeaves: vi.fn(() => {}),
    },
    _modifyCalls: modifyCalls,
  };
}
