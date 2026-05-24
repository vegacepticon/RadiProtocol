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
  remove: () => void;
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
    _placeholder: '',
    _type: '',
    disabled: false,
    style: { setProperty() {} },
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string | number | boolean> }): MockEl {
      const child = makeEl(subtag);
      child.parent = el;
      if (opts?.text !== undefined) child._text = opts.text;
      if (opts?.cls) {
        for (const c of opts.cls.split(' ').filter(Boolean)) child.classList.add(c);
      }
      if (opts?.type) child._type = opts.type;
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = String(v);
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
    remove(): void {
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
  WorkspaceLeaf: class {},
  Notice: class { constructor() {} },
  setIcon: () => {},
  App: class {},
  TFile: class { path = ''; extension = ''; basename = ''; constructor(p = '') { this.path = p; } },
}));

// ── Mock SnippetTreePicker (imported by protocol-editor-view) ────────────────

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class { constructor() {} mount() { return Promise.resolve(); } unmount() {} },
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
    'protocolEditor.autoLayout': 'Auto layout',
    'protocolEditor.noEditableFields': 'No editable fields',
    'protocolEditor.openPickerPlaceholder': 'Open…',
    'protocolEditor.edgeFromLabel': 'From',
    'protocolEditor.edgeToLabel': 'To',
    'protocolEditor.edgeLabelLabel': 'Label',
    'protocolEditor.edgeLabelPlaceholder': 'Label',
    'protocolEditor.answerButtonLabelLabel': 'Answer label',
    'protocolEditor.snippetTargetLabel': 'Snippet target',
    'protocolEditor.snippetFolderPlaceholder': 'Folder',
    'protocolEditor.snippetFilePlaceholder': 'File',
    'protocolEditor.clearSnippetTarget': 'Clear',
    'protocolEditor.chooseNodeType': 'Choose node type',
    'protocolEditor.minimapLabel': 'Minimap — click or drag to pan',
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

  it('auto-layout floating button has localized aria-label', () => {
    const { rootEl } = createShellView();
    const workspace = rootEl.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-workspace'))!;
    const floatingActions = workspace.children.find((c: MockEl) => c.classList.has('rp-protocol-editor-floating-actions'))!;
    const buttons = floatingActions.children.filter((c: MockEl) => c.tagName === 'BUTTON');
    const autoLayoutBtn = buttons.find((b: MockEl) => b._attrs['aria-label'] === 'Auto layout')!;
    expect(autoLayoutBtn._attrs['aria-label']).toBe('Auto layout');
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
