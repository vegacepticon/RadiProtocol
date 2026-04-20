// Phase 33 Plan 04 — SnippetTreeView tests (TREE-01..04, FOLDER-01..03,
// DEL-02/03, MODAL-04).
//
// Strategy: We mock 'obsidian' locally so ItemView exposes a DOM-ish
// contentEl and registerDomEvent/registerEvent spies. We also mock
// snippet-editor-modal and confirm-modal so we can observe constructor args
// without running their internals.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Stub browser globals used by snippet-manager-view.ts
// (document.createElement for modal form bodies; window.setTimeout/clearTimeout
// for debounced redraw).
(globalThis as any).window = globalThis;
(globalThis as any).document = {
  createElement: (_tag: string) => makeEl(_tag),
};

// --- Minimal DOM-ish mock element ----------------------------------------
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  textContent: string;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  dataset: Record<string, string>;
  value: string;
  placeholder: string;
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
  style: Record<string, string>;
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
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      el._text = text;
      el.textContent = text;
    },
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

// Collect every row ever created during render (deep walk)
function walkRows(root: MockEl, acc: MockEl[] = []): MockEl[] {
  for (const c of root.children) {
    if (c.classList.has('radi-snippet-tree-row')) acc.push(c);
    walkRows(c, acc);
  }
  return acc;
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
      // Capture vault.on registrations so tests can fire them later.
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
    items: Array<{ title: string; icon?: string; cb: () => void }> = [];
    addItem(cb: (item: { setTitle: (t: string) => any; setIcon: (i: string) => any; onClick: (c: () => void) => any }) => void): this {
      const state: { title: string; icon?: string; cb: () => void } = { title: '', cb: () => {} };
      const api = {
        setTitle: (t: string) => { state.title = t; return api; },
        setIcon: (i: string) => { state.icon = i; return api; },
        onClick: (c: () => void) => { state.cb = c; return api; },
      };
      cb(api);
      this.items.push(state);
      return this;
    }
    addSeparator(): this { return this; }
    showAtMouseEvent(_ev: unknown): void {}
  }
  // Phase 34: SuggestModal stub — folder-picker-modal.ts imports it transitively
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    setPlaceholder(_p: string): void {}
    getSuggestions(_q: string): T[] | Promise<T[]> { return []; }
    renderSuggestion(_v: T, _el: unknown): void {}
    onChooseSuggestion(_v: T, _ev: unknown): void {}
    open(): void {}
    close(): void {}
  }
  return { ItemView, WorkspaceLeaf, Notice, setIcon, Menu, SuggestModal };
});

// --- Mock SnippetEditorModal & ConfirmModal ------------------------------
const snippetEditorModalCtorSpy = vi.fn();
let snippetEditorModalNextResult: { saved: boolean } = { saved: false };
vi.mock('../views/snippet-editor-modal', () => ({
  SnippetEditorModal: class {
    readonly result: Promise<{ saved: boolean }>;
    constructor(app: unknown, plugin: unknown, options: unknown) {
      snippetEditorModalCtorSpy(app, plugin, options);
      this.result = Promise.resolve(snippetEditorModalNextResult);
    }
    open(): void {}
    close(): void {}
  },
}));

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

// --- Now import the module under test ------------------------------------
import { SnippetManagerView } from '../views/snippet-manager-view';
import type { Snippet } from '../snippets/snippet-model';

// --- Mock plugin factory --------------------------------------------------
interface MockService {
  listFolder: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteFolder: ReturnType<typeof vi.fn>;
  createFolder: ReturnType<typeof vi.fn>;
  listFolderDescendants: ReturnType<typeof vi.fn>;
}

function makeSnippet(kind: 'json' | 'md', p: string, name: string): Snippet {
  if (kind === 'json') {
    return { kind: 'json', path: p, name, template: '', placeholders: [], validationError: null };
  }
  return { kind: 'md', path: p, name, content: '' };
}

function makePlugin(opts: {
  listings?: Record<string, { folders: string[]; snippets: Snippet[] }>;
  expanded?: string[];
  descendants?: { files: string[]; folders: string[]; total: number };
} = {}): { plugin: any; service: MockService } {
  const listings = opts.listings ?? {
    '.radiprotocol/snippets': { folders: [], snippets: [] },
  };
  const service: MockService = {
    listFolder: vi.fn((p: string) => Promise.resolve(listings[p] ?? { folders: [], snippets: [] })),
    load: vi.fn((p: string) => {
      for (const l of Object.values(listings)) {
        const found = l.snippets.find((s) => s.path === p);
        if (found) return Promise.resolve(found);
      }
      return Promise.resolve(null);
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    listFolderDescendants: vi
      .fn()
      .mockResolvedValue(opts.descendants ?? { files: [], folders: [], total: 0 }),
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
  // The mocked ItemView constructor wires contentEl + app (a local vault mock).
  // Replace view.app with our plugin.app so vault.on handlers use the plugin's
  // vault spy.
  (view as any).app = plugin.app;
  return view;
}

// ============================================================================
// TREE-01..04, FOLDER-01..03, DEL-02/03, MODAL-04
// ============================================================================
describe('SnippetManagerView — tree rendering and interactions', () => {
  beforeEach(() => {
    snippetEditorModalCtorSpy.mockClear();
    confirmModalCtorSpy.mockClear();
    snippetEditorModalNextResult = { saved: false };
    confirmModalNextResult = 'cancel';
  });

  it('TREE-01: renders a row per folder and file at the root level', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin } = makePlugin({
      listings: {
        [root]: {
          folders: ['fldA'],
          snippets: [makeSnippet('json', `${root}/a.json`, 'a'), makeSnippet('md', `${root}/b.md`, 'b')],
        },
        [`${root}/fldA`]: { folders: [], snippets: [] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();

    const rows = walkRows((view as any).contentEl as MockEl);
    expect(rows.length).toBeGreaterThanOrEqual(3); // fldA + a.json + b.md
    const paths = rows.map((r) => r._attrs['data-path']).filter(Boolean);
    expect(paths).toContain(`${root}/fldA`);
    expect(paths).toContain(`${root}/a.json`);
    expect(paths).toContain(`${root}/b.md`);
  });

  it('TREE-02: legacy master-detail layout is absent from the source file', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'views', 'snippet-manager-view.ts'),
      'utf8',
    );
    expect(source).not.toContain('rp-snippet-manager');
    expect(source).not.toContain('rp-snippet-list-panel');
    expect(source).not.toContain('rp-snippet-list-item');
    expect(source).not.toContain('renderListPanel');
    expect(source).not.toContain('renderFormPanel');
    // And must contain the new tree class marker
    expect(source).toContain('radi-snippet-tree-row');
  });

  it('TREE-03: clicking a file row opens SnippetEditorModal in edit mode', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin } = makePlugin({
      listings: {
        [root]: {
          folders: [],
          snippets: [makeSnippet('json', `${root}/hi.json`, 'hi')],
        },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();

    const rows = walkRows((view as any).contentEl as MockEl);
    const fileRow = rows.find((r) => r._attrs['data-path'] === `${root}/hi.json`);
    expect(fileRow).toBeDefined();
    fileRow!.dispatchEvent({ type: 'click', target: fileRow });
    // Allow the async chain (load → new modal → await result)
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(snippetEditorModalCtorSpy).toHaveBeenCalled();
    const call = snippetEditorModalCtorSpy.mock.calls[0]!;
    const options = call[2];
    expect((options as any).mode).toBe('edit');
    expect((options as any).snippet.path).toBe(`${root}/hi.json`);
  });

  it('TREE-04: expanded empty folders render an explicit «(пусто)» placeholder', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin } = makePlugin({
      listings: {
        [root]: { folders: ['empty'], snippets: [] },
        [`${root}/empty`]: { folders: [], snippets: [] },
      },
      expanded: [`${root}/empty`],
    });
    const view = makeView(plugin);
    await view.onOpen();

    const rows = walkRows((view as any).contentEl as MockEl);
    const placeholder = rows.find((r) => r.classList.has('radi-snippet-tree-empty-placeholder'));
    expect(placeholder).toBeDefined();
    // Its child span should read «(пусто)»
    const label = placeholder!.children.find((c) => c._text === '(пусто)');
    expect(label).toBeDefined();
  });

  it('FOLDER-01: confirming the «Создать подпапку» flow calls service.createFolder with parent + name', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin, service } = makePlugin({
      listings: {
        [root]: { folders: ['parent'], snippets: [] },
        [`${root}/parent`]: { folders: [], snippets: [] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();

    // Directly invoke the private handler via cast (context menu → item onClick)
    const handleCreateSubfolder = (view as any).handleCreateSubfolder.bind(view);
    confirmModalNextResult = 'confirm';
    // Synchronously patch the next ConfirmModal construction so that the
    // input inside the body is pre-filled with 'sub' before the confirm
    // result resolves. Our ConfirmModal mock captures `options` via spy —
    // the input MockEl is body's first input child.
    const original = confirmModalCtorSpy;
    original.mockImplementationOnce((options: any) => {
      // Walk options.body children to find the input we created
      const body = options.body as MockEl;
      const input = body.children.find((c: MockEl) => c.tagName === 'LABEL')?.children.find((c: MockEl) => c.tagName === 'INPUT');
      if (input) input.value = 'sub';
    });

    await handleCreateSubfolder(`${root}/parent`);
    expect(service.createFolder).toHaveBeenCalledWith(`${root}/parent/sub`);
  });

  it('HEADER-FOLDER: header contains a "Папка" button with folder-plus icon that wires to handleCreateSubfolder', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin } = makePlugin({
      listings: {
        [root]: { folders: [], snippets: [] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();

    // Find header element
    const contentEl = (view as any).contentEl as MockEl;
    const header = contentEl.children.find((c: MockEl) => c.classList.has('radi-snippet-tree-header'));
    expect(header).toBeDefined();

    // Find all buttons in header
    const buttons = header!.children.filter((c: MockEl) => c.tagName === 'BUTTON');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    // Second button should be the folder button (no mod-cta)
    const folderBtn = buttons.find((b: MockEl) => !b.classList.has('mod-cta'));
    expect(folderBtn).toBeDefined();
    expect(folderBtn!.classList.has('radi-snippet-tree-new-btn')).toBe(true);
    expect(folderBtn!.classList.has('mod-cta')).toBe(false);

    // Check icon span has radi-snippet-tree-new-icon class
    const iconSpan = folderBtn!.children.find((c: MockEl) => c.classList.has('radi-snippet-tree-new-icon'));
    expect(iconSpan).toBeDefined();

    // Check label text
    const labelSpan = folderBtn!.children.find((c: MockEl) => c._text === 'Папка');
    expect(labelSpan).toBeDefined();
  });

  it('FOLDER-02: folder delete confirm body lists first 10 descendants + «…и ещё N» tail', async () => {
    const root = '.radiprotocol/snippets';
    const files: string[] = [];
    for (let i = 0; i < 12; i++) files.push(`${root}/big/f${i}.json`);
    const { plugin, service } = makePlugin({
      descendants: { files, folders: [], total: 12 },
      listings: {
        [root]: { folders: ['big'], snippets: [] },
        [`${root}/big`]: { folders: [], snippets: [] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();
    confirmModalNextResult = 'confirm';

    const handleDeleteFolder = (view as any).handleDeleteFolder.bind(view);
    await handleDeleteFolder(`${root}/big`, 'big');

    // ConfirmModal was constructed with a body containing up to 10 items + tail
    expect(confirmModalCtorSpy).toHaveBeenCalled();
    const options = confirmModalCtorSpy.mock.calls[0]![0] as any;
    expect(options.title).toContain('big');
    expect(options.destructive).toBe(true);
    const bodyText = JSON.stringify(collectTextNodes(options.body as MockEl));
    expect(bodyText).toContain('…и ещё 2 элементов.');
    // First 10 items listed
    for (let i = 0; i < 10; i++) {
      expect(bodyText).toContain(`f${i}.json`);
    }
    // Service was called on confirm
    expect(service.deleteFolder).toHaveBeenCalledWith(`${root}/big`);
  });

  it('FOLDER-03: hover-action «+» button opens SnippetEditorModal in create mode pre-filled to folder path', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin } = makePlugin({
      listings: {
        [root]: { folders: ['sub'], snippets: [] },
        [`${root}/sub`]: { folders: [], snippets: [] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();

    // Directly invoke openCreateModal(sub) — the code path triggered by the
    // hover «+» button. We test the outcome (modal constructed with correct
    // options) rather than re-simulating the full listener chain.
    const openCreateModal = (view as any).openCreateModal.bind(view);
    await openCreateModal(`${root}/sub`);
    expect(snippetEditorModalCtorSpy).toHaveBeenCalled();
    const call = snippetEditorModalCtorSpy.mock.calls[0]!;
    const options = call[2];
    expect((options as any).mode).toBe('create');
    expect((options as any).initialFolder).toBe(`${root}/sub`);
  });

  it('DEL-02: deleting a snippet opens ConfirmModal then calls service.delete on confirm', async () => {
    const root = '.radiprotocol/snippets';
    const { plugin, service } = makePlugin({
      listings: {
        [root]: { folders: [], snippets: [makeSnippet('json', `${root}/gone.json`, 'gone')] },
      },
    });
    const view = makeView(plugin);
    await view.onOpen();
    confirmModalNextResult = 'confirm';

    const handleDeleteSnippet = (view as any).handleDeleteSnippet.bind(view);
    await handleDeleteSnippet(`${root}/gone.json`, 'gone');

    expect(confirmModalCtorSpy).toHaveBeenCalled();
    const options = confirmModalCtorSpy.mock.calls[0]![0] as any;
    expect(options.title).toBe('Удалить сниппет?');
    expect(String(options.body)).toContain('gone');
    expect(options.destructive).toBe(true);
    expect(service.delete).toHaveBeenCalledWith(`${root}/gone.json`);
  });

  it('DEL-03: after delete, rebuild omits the deleted path from listFolder results', async () => {
    const root = '.radiprotocol/snippets';
    const listings: Record<string, { folders: string[]; snippets: Snippet[] }> = {
      [root]: { folders: [], snippets: [makeSnippet('json', `${root}/x.json`, 'x')] },
    };
    const { plugin, service } = makePlugin({ listings });
    // Service.delete mutates the fixture to emulate disk-level removal.
    service.delete.mockImplementation(async (p: string) => {
      const bucket = listings[root]!;
      bucket.snippets = bucket.snippets.filter((s) => s.path !== p);
    });
    const view = makeView(plugin);
    await view.onOpen();
    confirmModalNextResult = 'confirm';

    await (view as any).handleDeleteSnippet(`${root}/x.json`, 'x');
    // After the handler, service.listFolder should no longer see the path.
    const listing = (await (service.listFolder as unknown as (p: string) => Promise<{ folders: string[]; snippets: Snippet[] }>)(root));
    expect(listing.snippets.find((s: Snippet) => s.path === `${root}/x.json`)).toBeUndefined();
    // And the rendered tree should not include it either
    const rows = walkRows((view as any).contentEl as MockEl);
    expect(rows.find((r) => r._attrs['data-path'] === `${root}/x.json`)).toBeUndefined();
  });

  it('MODAL-04: global "+ Новый" opens create modal pre-filled to snippetFolderPath (root)', async () => {
    const { plugin } = makePlugin();
    const view = makeView(plugin);
    await view.onOpen();
    const openCreateModal = (view as any).openCreateModal.bind(view);
    await openCreateModal(plugin.settings.snippetFolderPath);
    expect(snippetEditorModalCtorSpy).toHaveBeenCalled();
    const call = snippetEditorModalCtorSpy.mock.calls[0]!;
    const options = call[2];
    expect((options as any).mode).toBe('create');
    expect((options as any).initialFolder).toBe('.radiprotocol/snippets');
  });
});

// Walk a MockEl subtree and flatten visible text (_text + child recursion).
function collectTextNodes(root: MockEl): string[] {
  const out: string[] = [];
  const walk = (el: MockEl): void => {
    if (el._text) out.push(el._text);
    if ((el as any).textContent && !el._text) out.push((el as any).textContent);
    for (const c of el.children) walk(c);
  };
  walk(root);
  return out;
}
