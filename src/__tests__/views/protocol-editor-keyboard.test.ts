import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtocolEditorView } from '../../views/protocol-editor-view';
import type { ProtocolDocumentV1, ProtocolNodeRecord } from '../../protocol/protocol-document';

// ── Traversable MockEl with closest / querySelector / style.setProperty ──────

interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  _value: string;
  value: string;
  _placeholder: string;
  _type: string;
  disabled: boolean;
  style: { setProperty: (prop: string, value: string) => void };
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string | number | boolean> }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> }) => MockEl;
  createSvg: (tag: string, opts?: { cls?: string; attr?: Record<string, string | number | boolean> }) => MockEl;
  empty: () => void;
  setText: (text: string) => void;
  setAttr: (name: string, value: string | number | boolean) => void;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  hasClass: (cls: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  toggleClass: (cls: string, force?: boolean) => void;
  closest: (selector: string) => MockEl | null;
  querySelector: (sel: string) => MockEl | null;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  isConnected: boolean;
  remove: () => void;
  focus: (opts?: { preventScroll?: boolean }) => void;
  select: () => void;
  toggleAttribute: (name: string, force?: boolean) => void;
}

function makeEl(tag = 'div'): MockEl {
  const children: MockEl[] = [];
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const classList = new Set<string>();
  const attrs: Record<string, string> = {};
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    children,
    parent: null,
    _text: '',
    classList,
    _attrs: attrs,
    _listeners: listeners,
    _value: '',
    value: '',
    _placeholder: '',
    _type: '',
    disabled: false,
    isConnected: true,
    style: { setProperty() {} },
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string | number | boolean> }): MockEl {
      const child = makeEl(subtag);
      child.parent = el;
      if (opts?.text !== undefined) {
        child._text = opts.text;
        child.value = opts.text;
      }
      if (opts?.cls) {
        for (const c of opts.cls.split(' ').filter(Boolean)) child.classList.add(c);
      }
      if (opts?.type) child._type = opts.type;
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) {
          child._attrs[k] = String(v);
          if (k === 'value') child.value = String(v);
        }
      }
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> }): MockEl {
      return el.createEl('div', opts as { text?: string; cls?: string; attr?: Record<string, string | number | boolean> } | undefined);
    },
    createSvg(tag: string, opts?: { cls?: string; attr?: Record<string, string | number | boolean> }): MockEl {
      const child = makeEl(tag);
      child.parent = el;
      if (opts?.cls) for (const c of opts.cls.split(' ').filter(Boolean)) child.classList.add(c);
      if (opts?.attr) for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = String(v);
      children.push(child);
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return el.createEl('span', opts as { text?: string; cls?: string } | undefined);
    },
    empty(): void { children.length = 0; },
    setText(text: string): void { el._text = text; },
    setAttr(name: string, value: string | number | boolean): void { attrs[name] = String(value); },
    addClass(cls: string): void { classList.add(cls); },
    removeClass(cls: string): void { classList.delete(cls); },
    hasClass(cls: string): boolean { return classList.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type) ?? [];
      arr.push(handler);
      listeners.set(type, arr);
    },
    toggleClass(cls: string, force?: boolean): void {
      if (force === true) classList.add(cls);
      else if (force === false) classList.delete(cls);
      else if (classList.has(cls)) classList.delete(cls);
      else classList.add(cls);
    },
    closest(selector: string): MockEl | null {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        let cur: MockEl | null = el;
        while (cur !== null) {
          if (cur.classList.has(cls)) return cur;
          cur = cur.parent ?? null;
        }
      }
      return null;
    },
    querySelector(selector: string): MockEl | null {
      const stack: MockEl[] = [el];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (selector.startsWith('.')) {
          if (cur.classList.has(selector.slice(1))) return cur;
        }
        for (const child of cur.children) stack.push(child);
      }
      return null;
    },
    focus: vi.fn(),
    select: vi.fn(),
    toggleAttribute(name: string, force?: boolean): void {
      const enabled = force ?? !attrs[name];
      if (enabled) attrs[name] = '';
      else delete attrs[name];
      if (name === 'disabled') el.disabled = enabled;
    },
    remove(): void {
      const markDisconnected = (node: MockEl): void => {
        node.isConnected = false;
        for (const child of node.children) markDisconnected(child);
      };
      markDisconnected(el);
      if (el.parent) {
        const idx = el.parent.children.indexOf(el);
        if (idx >= 0) el.parent.children.splice(idx, 1);
        el.parent = null;
      }
    },
  };
  return el;
}

function findAllByClass(root: MockEl, cls: string): MockEl[] {
  const results: MockEl[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.classList.has(cls)) results.push(cur);
    for (const child of cur.children) stack.push(child);
  }
  return results;
}

function findAllByTag(root: MockEl, tagName: string): MockEl[] {
  const results: MockEl[] = [];
  const normalized = tagName.toUpperCase();
  const stack = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.tagName === normalized) results.push(cur);
    for (const child of cur.children) stack.push(child);
  }
  return results;
}

function dispatchKeyDown(el: MockEl, key: string, target?: MockEl): void {
  const handlers = el._listeners.get('keydown') ?? [];
  for (const handler of handlers) {
    handler({ key, target: target ?? el, preventDefault: () => {}, stopPropagation: () => {} });
  }
}

// ── Mock dom-helpers ───────────────────────────────────────────────────────

vi.mock('../../utils/dom-helpers', () => ({
  createButton: (parent: MockEl, opts: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> } = {}): MockEl => {
    return parent.createEl('button', { cls: opts.cls, text: opts.text, attr: opts.attr });
  },
  createInput: (parent: MockEl, opts: { cls?: string; type?: string; placeholder?: string; value?: string; attr?: Record<string, string | number | boolean> } = {}): MockEl => {
    const input = parent.createEl('input', {
      cls: opts.cls,
      type: opts.type,
      attr: { ...opts.attr ?? {}, ...(opts.placeholder ? { placeholder: opts.placeholder } : {}) },
    });
    input._value = opts.value ?? '';
    input.value = opts.value ?? '';
    input._placeholder = opts.placeholder ?? '';
    input._type = opts.type ?? 'text';
    return input;
  },
}));

// ── Mock obsidian ──────────────────────────────────────────────────────────

vi.mock('obsidian', () => ({
  ItemView: class {
    leaf = {};
    containerEl = makeEl('div');
    contentEl = makeEl('div');
    constructor() {}
    getViewType() { return ''; }
    getDisplayText() { return ''; }
    getIcon() { return ''; }
    onOpen() {}
    onClose() {}
    registerDomEvent() {}
  },
  Modal: class {
    contentEl = makeEl('div');
    title = '';
    setTitle(title: string): void { this.title = title; }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  },
  WorkspaceLeaf: class {},
  Notice: class { constructor() {} },
  setIcon: () => {},
  App: class {},
  TFile: class { path = ''; extension = ''; basename = ''; constructor(p = '') { this.path = p; } },
}));;

// ── Mock SnippetTreePicker (imported by protocol-editor-view) ────────────────
const pickerSpies = vi.hoisted(() => ({
  ctor: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
  instances: [] as Array<{ options: any }>,
}));

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    constructor(options: any) {
      pickerSpies.ctor(options);
      pickerSpies.instances.push({ options });
    }
    mount() { pickerSpies.mount(); return Promise.resolve(); }
    unmount() { pickerSpies.unmount(); }
  },
}));

// ── Mock plugin i18n ───────────────────────────────────────────────────────

const t = (key: string, _params?: Record<string, string>): string => {
  const map: Record<string, string> = {
    'protocolEditor.displayText': 'Protocol editor',
    'protocolEditor.untyped': 'untyped',
    'protocolEditor.inputPortLabel': 'Input port',
    'protocolEditor.outputPortLabel': 'Output port',
    'protocolEditor.resizeNodeLabel': 'Resize node',
    'protocolEditor.editNode': 'Edit Node',
    'protocolEditor.close': 'Close',
    'protocolEditor.kindLabel': 'Kind',
    'protocolEditor.save': 'Save',
    'protocolEditor.cancel': 'Cancel',
    'protocolEditor.delete': 'Delete',
    'protocolEditor.nodeKind.start': 'Start',
    'protocolEditor.nodeKind.question': 'Question',
    'protocolEditor.nodeKind.answer': 'Answer',
    'protocolEditor.nodeKind.text-block': 'Text block',
    'protocolEditor.nodeKind.loop': 'Loop',
    'protocolEditor.nodeKind.snippet': 'Snippet',
    'protocolEditor.questionTextLabel': 'Question text',
    'protocolEditor.answerTextLabel': 'Answer text',
    'protocolEditor.headerTextLabel': 'Header text',
    'protocolEditor.contentLabel': 'Content',
    'protocolEditor.snippetSeparatorLabel': 'Separator',
    'protocolEditor.noNodes': 'No nodes',
    'protocolEditor.snippetNodeLabelLabel': 'Snippet label',
    'protocolEditor.startPointEnabledLabel': 'Start point',
    'selfCheck.title': 'Self-check',
    'protocolEditor.toggleMinimap': 'Minimap',
    'protocolEditor.autoLayoutVertical': 'Vertical layout',
    'protocolEditor.autoLayoutHorizontal': 'Horizontal layout',
    'protocolEditor.noEditableFields': 'No editable fields',
    'protocolEditor.openPickerPlaceholder': 'Open…',
    'protocolEditor.edgeFromLabel': 'From',
    'protocolEditor.edgeToLabel': 'To',
    'protocolEditor.edgeLabelLabel': 'Label',
    'protocolEditor.edgeLabelPlaceholder': 'Label',
    'protocolEditor.answerButtonLabelLabel': 'Answer label',
    'protocolEditor.snippetTargetLabel': 'Snippet target',
    'protocolEditor.browseSnippetTarget': 'Browse',
    'protocolEditor.browseSnippetTargetTitle': 'Browse snippet target',
    'protocolEditor.noSnippetTarget': 'No target',
    'protocolEditor.snippetTargetHelp': 'Choose a folder or snippet',
    'protocolEditor.snippetFolderTarget': 'Folder',
    'protocolEditor.snippetFileTarget': 'Snippet',
    'protocolEditor.snippetFolderPlaceholder': 'Folder',
    'protocolEditor.snippetFilePlaceholder': 'File',
    'protocolEditor.clearSnippetTarget': 'Clear',
    'protocolEditor.chooseNodeType': 'Choose node type',
    'protocolEditor.minimapLabel': 'Minimap — click or drag to pan',
    'protocolEditor.useGlobalSeparator': 'Use global',
    'settings.newline': 'Newline',
    'settings.space': 'Space',
  };
  return map[key] ?? key;
};

// ── Test helper: create a minimally-wired view ──────────────────────────────

function createTestView(): { view: ProtocolEditorView; surfaceEl: MockEl; openEditModalCalls: ProtocolNodeRecord[] } {
  const openEditModalCalls: ProtocolNodeRecord[] = [];

  const mockPlugin = {
    i18n: { t },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    protocolDocumentStore: {},
  } as any;

  const leaf = {} as any;
  const view = new ProtocolEditorView(leaf, mockPlugin);

  (view as any).openEditModal = (node: ProtocolNodeRecord) => openEditModalCalls.push(node);

  const surfaceEl = makeEl('div');
  const svgEl = makeEl('svg');
  const viewportEl = makeEl('div');
  const rootEl = makeEl('div');

  (view as any).surfaceEl = surfaceEl;
  (view as any).svgEl = svgEl;
  (view as any).viewportEl = viewportEl;
  (view as any).rootEl = rootEl;
  (view as any).protocolPath = 'test.rp.json';
  (view as any).zoom = 1;

  const doc: ProtocolDocumentV1 = {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'test-doc',
    title: 'Test Protocol',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    nodes: [
      {
        id: 'node-1',
        kind: 'question',
        x: 100,
        y: 100,
        width: 200,
        height: 80,
        text: 'Where is the pain?',
        fields: { questionText: 'Where is the pain?' },
      },
    ],
    edges: [],
  };
  (view as any).doc = doc;

  return { view, surfaceEl, openEditModalCalls };
}

// Helper: create a view with a start node that has no explicit text label
function createStartNodeView(): { view: ProtocolEditorView; surfaceEl: MockEl } {
  const mockPlugin = {
    i18n: { t },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    protocolDocumentStore: {},
  } as any;

  const leaf = {} as any;
  const view = new ProtocolEditorView(leaf, mockPlugin);

  const surfaceEl = makeEl('div');
  const svgEl = makeEl('svg');
  const viewportEl = makeEl('div');
  const rootEl = makeEl('div');

  (view as any).surfaceEl = surfaceEl;
  (view as any).svgEl = svgEl;
  (view as any).viewportEl = viewportEl;
  (view as any).rootEl = rootEl;
  (view as any).protocolPath = 'test.rp.json';
  (view as any).zoom = 1;

  const doc: ProtocolDocumentV1 = {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'test-doc',
    title: 'Test Protocol',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    nodes: [
      {
        id: 'node-start',
        kind: 'start',
        x: 100,
        y: 100,
        width: 160,
        height: 60,
        text: undefined as any,
        fields: {},
      },
    ],
    edges: [],
  };
  (view as any).doc = doc;

  return { view, surfaceEl };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProtocolEditorView: node keyboard activation', () => {
  it('opens edit modal on keydown Enter', () => {
    const { view, surfaceEl, openEditModalCalls } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    expect(nodes.length).toBeGreaterThanOrEqual(1);

    dispatchKeyDown(nodes[0]!, 'Enter');
    expect(openEditModalCalls.length).toBe(1);
    expect(openEditModalCalls[0]!.id).toBe('node-1');
  });

  it('opens edit modal on keydown Space', () => {
    const { view, surfaceEl, openEditModalCalls } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    dispatchKeyDown(nodes[0]!, ' ');

    expect(openEditModalCalls.length).toBe(1);
    expect(openEditModalCalls[0]!.id).toBe('node-1');
  });

  it('does not open edit modal when keydown originates from a port element', () => {
    const { view, surfaceEl, openEditModalCalls } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    const ports = findAllByClass(surfaceEl, 'rp-protocol-editor-port');
    expect(ports.length).toBeGreaterThanOrEqual(1);

    dispatchKeyDown(nodes[0]!, 'Enter', ports[0]!);
    expect(openEditModalCalls.length).toBe(0);
  });

  it('does not open edit modal for unrelated keys', () => {
    const { view, surfaceEl, openEditModalCalls } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    dispatchKeyDown(nodes[0]!, 'Tab');
    dispatchKeyDown(nodes[0]!, 'Escape');
    dispatchKeyDown(nodes[0]!, 'a');

    expect(openEditModalCalls.length).toBe(0);
  });

  it('renders node with tabindex=0 for keyboard focus', () => {
    const { view, surfaceEl } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    expect(nodes[0]!._attrs['tabindex']).toBe('0');
  });

  it('renders node with role=group', () => {
    const { view, surfaceEl } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    expect(nodes[0]!._attrs['role']).toBe('group');
  });

  it('renders node with aria-label from node title', () => {
    const { view, surfaceEl } = createTestView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    expect(nodes[0]!._attrs['aria-label']).toBe('Where is the pain?');
  });

  it('start node without explicit text does not render the default i18n key as label', () => {
    const { view, surfaceEl } = createStartNodeView();
    (view as any).renderDocument();

    const nodes = findAllByClass(surfaceEl, 'rp-protocol-editor-node');
    expect(nodes.length).toBe(1);
    const titles = findAllByClass(nodes[0]!, 'rp-protocol-editor-node-title');
    expect(titles.length).toBe(0);
    const kinds = findAllByClass(nodes[0]!, 'rp-protocol-editor-node-kind');
    expect(kinds.length).toBe(1);
  });
});

describe('ProtocolEditorView: floating action button aria-labels', () => {
  let savedWindow: unknown;
  let savedRAF: unknown;
  beforeEach(() => {
    savedWindow = (globalThis as any).window;
    savedRAF = (globalThis as any).requestAnimationFrame;
    (globalThis as any).window = globalThis;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });
  afterEach(() => {
    (globalThis as any).window = savedWindow;
    (globalThis as any).requestAnimationFrame = savedRAF;
  });

  function createShellView(): { view: ProtocolEditorView; rootEl: MockEl } {
    const mockPlugin = {
      i18n: { t },
      settings: { snippetFolderPath: '.radiprotocol/snippets' },
      protocolDocumentStore: {},
    } as any;

    const leaf = {} as any;
    const view = new ProtocolEditorView(leaf, mockPlugin);

    const containerEl = makeEl('div');
    containerEl.createDiv({ cls: 'nav-region' });
    const contentArea = containerEl.createDiv({ cls: 'content-area' });
    (view as any).containerEl = containerEl;

    const doc: ProtocolDocumentV1 = {
      schema: 'radiprotocol.protocol',
      version: 1,
      id: 'test-doc',
      title: 'Test Protocol',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      nodes: [],
      edges: [],
    };
    (view as any).doc = doc;
    (view as any).protocolPath = 'test.rp.json';
    (view as any).zoom = 1;

    (view as any).renderShell();
    const rootEl = contentArea.children.find((c: MockEl) => c.classList.has('rp-protocol-editor'))!;
    return { view, rootEl };
  }

  it('self-check floating button has localized aria-label', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const floatingActions = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-floating-actions'))!;
    const buttons = floatingActions.children.filter((c: MockEl) => c.tagName === 'BUTTON');
    const selfCheckBtn = buttons.find((b: MockEl) => b._attrs['aria-label'] === 'Self-check')!;
    expect(selfCheckBtn._attrs['aria-label']).toBe('Self-check');
  });

  it('minimap toggle floating button has localized aria-label', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const floatingActions = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-floating-actions'))!;
    const buttons = floatingActions.children.filter((c: MockEl) => c.tagName === 'BUTTON');
    const minimapBtn = buttons.find((b: MockEl) => b._attrs['aria-label'] === 'Minimap')!;
    expect(minimapBtn._attrs['aria-label']).toBe('Minimap');
  });

  it('auto-layout floating buttons have localized aria-labels', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const floatingActions = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-floating-actions'))!;
    const buttons = floatingActions.children.filter((c: MockEl) => c.tagName === 'BUTTON');
    const verticalBtn = buttons.find((b: MockEl) => b._attrs['aria-label'] === 'Vertical layout')!;
    expect(verticalBtn._attrs['aria-label']).toBe('Vertical layout');
    const horizontalBtn = buttons.find((b: MockEl) => b._attrs['aria-label'] === 'Horizontal layout')!;
    expect(horizontalBtn._attrs['aria-label']).toBe('Horizontal layout');
  });

  it('minimap element has localized aria-label', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const minimap = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-minimap'))!;
    expect(minimap).toBeDefined();
    expect(minimap!._attrs['aria-label']).toBe('Minimap — click or drag to pan');
    expect(minimap!._attrs['role']).toBe('button');
  });

  it('minimap element has tabindex=0 for keyboard focus', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const minimap = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-minimap'))!;
    expect(minimap!._attrs['tabindex']).toBe('0');
  });

  it('Enter key on minimap toggles visibility', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const minimap = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-minimap'))!;
    expect(minimap!.classList.has('is-hidden')).toBe(false);
    dispatchKeyDown(minimap!, 'Enter');
    expect(minimap!.classList.has('is-hidden')).toBe(true);
    dispatchKeyDown(minimap!, 'Enter');
    expect(minimap!.classList.has('is-hidden')).toBe(false);
  });

  it('Space key on minimap toggles visibility and prevents default', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const minimap = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-minimap'))!;
    let prevented = false;
    const handlers = minimap!._listeners.get('keydown') ?? [];
    for (const handler of handlers) {
      handler({ key: ' ', target: minimap!, preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
    }
    expect(prevented).toBe(true);
    expect(minimap!.classList.has('is-hidden')).toBe(true);
  });
});

// ── Regression: empty answer text must not fall back to stale node.text ─────

describe('openEditModal — empty multiline field regression (1.22.0 bug)', () => {
  let savedWindow: unknown;
  let savedRAF: unknown;
  let savedDocument: unknown;
  beforeEach(() => {
    savedWindow = (globalThis as any).window;
    savedRAF = (globalThis as any).requestAnimationFrame;
    savedDocument = (globalThis as any).document;
    (globalThis as any).window = globalThis;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });
  afterEach(() => {
    (globalThis as any).window = savedWindow;
    (globalThis as any).requestAnimationFrame = savedRAF;
    (globalThis as any).document = savedDocument;
  });

  it('saves empty answerText as empty string, not undefined', async () => {
    // Reproduces the 1.22.0 bug: clearing answerText kept the stale node.text (' ')
    // because multiline inputs used `|| undefined` — empty string was coerced to undefined
    // and then the field was deleted, causing the parser/runner to fall back to node.text.
    const t = (key: string): string => key;

    const savedNodes: ProtocolNodeRecord[] = [];

    const mockStore = {
      async update(_path: string, mutator: (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1): Promise<ProtocolDocumentV1> {
        const doc: ProtocolDocumentV1 = {
          schema: 'radiprotocol.protocol', version: 1, id: 'test', title: 'T',
          createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
          nodes: [{
            id: 'a1', kind: 'answer', x: 0, y: 0, width: 200, height: 80,
            text: ' ',
            fields: { answerText: ' ' },
          }],
          edges: [],
        };
        const result = mutator(doc);
        savedNodes.push(...result.nodes);
        return result;
      },
      async read() { return null; },
    };

    const mockPlugin = { i18n: { t }, settings: {}, protocolDocumentStore: mockStore } as any;
    const leaf = {} as any;
    const view = new ProtocolEditorView(leaf, mockPlugin);

    const surfaceEl = makeEl('div');
    const viewportEl = makeEl('div');
    // openEditModal checks viewportEl.isConnected before restoring focus
    Object.defineProperty(viewportEl, 'isConnected', { value: true, writable: true });

    (view as any).surfaceEl = surfaceEl;
    (view as any).svgEl = makeEl('svg');
    (view as any).viewportEl = viewportEl;
    (view as any).rootEl = makeEl('div');
    (view as any).protocolPath = 'test.rp.json';
    (view as any).zoom = 1;
    (view as any).doc = {
      schema: 'radiprotocol.protocol', version: 1, id: 'test', title: 'T',
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
      nodes: [{
        id: 'a1', kind: 'answer', x: 0, y: 0, width: 200, height: 80,
        text: ' ',
        fields: { answerText: ' ' },
      }],
      edges: [],
    } as ProtocolDocumentV1;
    (view as any).loadProtocol = vi.fn(async () => {});

    // openEditModal uses document.body.createDiv — point it at surfaceEl
    (globalThis as any).document = {
      body: {
        createDiv: () => surfaceEl,
      },
      activeElement: null,
    };

    (view as any).openEditModal((view as any).doc.nodes[0]);

    const allTextareas = findAllByTag(surfaceEl, 'textarea');
    const answerTextTA = allTextareas.length >= 2 ? allTextareas[1] : allTextareas[allTextareas.length - 1];
    expect(answerTextTA).toBeDefined();
    answerTextTA!.value = '';

    // Click save — find the Save button
    let saveBtn: MockEl | null = null;
    const stack2 = [surfaceEl];
    while (stack2.length > 0) {
      const cur = stack2.pop()!;
      if (cur._text === 'protocolEditor.save') {
        saveBtn = cur;
        break;
      }
      for (const child of cur.children) stack2.push(child);
    }

    // Trigger click handlers
    if (saveBtn) {
      const handlers = saveBtn._listeners.get('click') ?? [];
      for (const h of handlers) await h({});
    }

    // Verify: answerText must be empty string, not undefined
    const savedAnswer = savedNodes.find(n => n.id === 'a1');
    expect(savedAnswer).toBeDefined();
    expect(savedAnswer!.fields['answerText']).toBe('');
  });
});

describe('openEditModal — snippet target picker lifecycle', () => {
  let savedDocument: unknown;
  let savedWindow: unknown;
  let savedHTMLElement: unknown;

  beforeEach(() => {
    savedDocument = (globalThis as any).document;
    savedWindow = (globalThis as any).window;
    savedHTMLElement = (globalThis as any).HTMLElement;
    pickerSpies.ctor.mockClear();
    pickerSpies.mount.mockClear();
    pickerSpies.unmount.mockClear();
    pickerSpies.instances.length = 0;
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
    (globalThis as any).window = savedWindow;
    (globalThis as any).HTMLElement = savedHTMLElement;
  });

  function clickText(root: MockEl, text: string): MockEl {
    const button = findAllByTag(root, 'button').find(el => el._text === text);
    expect(button).toBeDefined();
    for (const handler of button!._listeners.get('click') ?? []) handler({ target: button });
    return button!;
  }

  async function save(root: MockEl): Promise<void> {
    const saveBtn = findAllByTag(root, 'button').find(el => el._text === 'Save')!;
    for (const handler of saveBtn._listeners.get('click') ?? []) await handler({ target: saveBtn });
  }

  function openSnippetModal(initialFields: Record<string, unknown> = {}) {
    const documentBody = makeEl('body');
    const savedNodes: ProtocolNodeRecord[] = [];
    const node: ProtocolNodeRecord = { id: 's1', kind: 'snippet', x: 0, y: 0, width: 200, height: 80, fields: initialFields };
    const mockStore = {
      async update(_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1) {
        const doc: ProtocolDocumentV1 = {
          schema: 'radiprotocol.protocol', version: 1, id: 'test', title: 'T',
          createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
          nodes: [node], edges: [],
        };
        const result = mutator(doc);
        savedNodes.push(...result.nodes);
        return result;
      },
    };
    const view = new ProtocolEditorView({} as any, {
      i18n: { t },
      settings: { snippetFolderPath: '.radiprotocol/snippets' },
      snippetService: {},
      protocolDocumentStore: mockStore,
    } as any);
    (view as any).protocolPath = 'test.rp.json';
    (view as any).viewportEl = makeEl('div');
    (view as any).loadProtocol = vi.fn(async () => {});
    (globalThis as any).document = { body: documentBody, activeElement: null };
    (globalThis as any).window = {
      setTimeout: (fn: () => void) => { fn(); return 0; },
      requestAnimationFrame: (fn: () => void) => { fn(); return 0; },
    };
    (globalThis as any).HTMLElement = class HTMLElement {};
    (view as any).openEditModal(node);
    return { documentBody, savedNodes };
  }

  it('selecting a folder persists subfolderPath only', async () => {
    const { documentBody, savedNodes } = openSnippetModal();
    clickText(documentBody, 'Browse');
    pickerSpies.instances[0]!.options.onSelect({ kind: 'folder', relativePath: 'abdomen/ct' });
    await save(documentBody);
    const saved = savedNodes[savedNodes.length - 1]!;
    expect(saved.fields.subfolderPath).toBe('abdomen/ct');
    expect(saved.fields.snippetPath).toBeUndefined();
  });

  it('selecting a file persists snippetPath only', async () => {
    const { documentBody, savedNodes } = openSnippetModal({ subfolderPath: 'old' });
    clickText(documentBody, 'Browse');
    pickerSpies.instances[0]!.options.onSelect({ kind: 'file', relativePath: 'abdomen/ct/report.md' });
    await save(documentBody);
    const saved = savedNodes[savedNodes.length - 1]!;
    expect(saved.fields.snippetPath).toBe('abdomen/ct/report.md');
    expect(saved.fields.subfolderPath).toBeUndefined();
  });

  it('cancelling the picker preserves the existing target', async () => {
    const { documentBody, savedNodes } = openSnippetModal({ subfolderPath: 'existing/folder' });
    clickText(documentBody, 'Browse');
    const pickerClose = findAllByClass(documentBody, 'rp-protocol-editor-modal-close').find(el => el.closest('.rp-protocol-editor-snippet-target-picker-shell'))!;
    for (const handler of pickerClose._listeners.get('click') ?? []) handler({ target: pickerClose });
    await save(documentBody);
    const saved = savedNodes[savedNodes.length - 1]!;
    expect(saved.fields.subfolderPath).toBe('existing/folder');
    expect(saved.fields.snippetPath).toBeUndefined();
  });

  it('closing the parent while the picker is open unmounts and removes the picker overlay', () => {
    const { documentBody } = openSnippetModal();
    clickText(documentBody, 'Browse');
    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(1);
    const parentCloseBtn = findAllByClass(documentBody, 'rp-protocol-editor-modal-close').find(el => !el.closest('.rp-protocol-editor-snippet-target-picker-shell'))!;
    for (const handler of parentCloseBtn._listeners.get('click') ?? []) handler({ target: parentCloseBtn });
    expect(pickerSpies.unmount).toHaveBeenCalledTimes(1);
    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(0);
  });

  it('Escape closes the picker before the parent and restores focus to Browse', () => {
    const { documentBody } = openSnippetModal();
    const browseBtn = clickText(documentBody, 'Browse');
    const pickerBackdrop = findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')[0]!;
    dispatchKeyDown(pickerBackdrop, 'Escape');
    expect(pickerSpies.unmount).toHaveBeenCalledTimes(1);
    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(0);
    expect(browseBtn.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(findAllByClass(documentBody, 'rp-protocol-editor-modal')).toHaveLength(1);
  });
});

describe('ProtocolEditorView: node-kind creation picker omits text-block (Phase 3)', () => {
  function nodeKindsInPicker(root: MockEl): string[] {
    const kinds: string[] = [];
    const stack: MockEl[] = [root];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const k = cur.getAttribute('data-node-kind');
      if (k !== null) kinds.push(k);
      // Push children in reverse so document order is preserved.
      for (let i = cur.children.length - 1; i >= 0; i--) stack.push(cur.children[i]!);
    }
    return kinds;
  }

  function openPickerDocument(): MockEl {
    const documentBody = makeEl('body');
    (globalThis as any).document = { body: documentBody, activeElement: null };
    return documentBody;
  }

  it('openNodeKindPickerAtWorldPoint offers start/question/answer/loop/snippet and NOT text-block', () => {
    const { view } = createTestView();
    const documentBody = openPickerDocument();
    (view as any).openNodeKindPickerAtWorldPoint(0, 0);
    const kinds = nodeKindsInPicker(documentBody);
    expect(kinds).toEqual(['start', 'question', 'answer', 'loop', 'snippet']);
    expect(kinds).not.toContain('text-block');
  });

  it('openNodeKindPickerAndConnectAtWorldPoint offers the same set and NOT text-block', () => {
    const { view } = createTestView();
    const documentBody = openPickerDocument();
    (view as any).openNodeKindPickerAndConnectAtWorldPoint('node-1', 0, 0);
    const kinds = nodeKindsInPicker(documentBody);
    expect(kinds).toEqual(['start', 'question', 'answer', 'loop', 'snippet']);
    expect(kinds).not.toContain('text-block');
  });
});
