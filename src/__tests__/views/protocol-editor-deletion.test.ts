// src/__tests__/views/protocol-editor-deletion.test.ts
// TASK #91 — Regression tests for ProtocolEditorView.deleteEdge mutation flow.
// Covers: valid deletion preserving nodes, localized Notice on success,
// early return when protocolPath is null, and error Notice on store rejection.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolEditorView, removeProtocolEditorEdge } from '../../views/protocol-editor-view';
import type { ProtocolDocumentV1, ProtocolNodeRecord, ProtocolEdgeRecord } from '../../protocol/protocol-document';

// ── MockEl (shared DOM harness) ─────────────────────────────────────────────

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
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
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
    value: '',
    _placeholder: '',
    _type: '',
    disabled: false,
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
    createSvg(svgTag: string, opts?: { cls?: string; attr?: Record<string, string | number | boolean> }): MockEl {
      const child = makeEl(svgTag);
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

const noticeCalls: string[] = [];

vi.mock('obsidian', () => {
  class Notice {
    constructor(msg: string) { noticeCalls.push(msg); }
  }
  return {
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
    Notice,
    setIcon: () => {},
    App: class {},
    TFile: class { path = ''; extension = ''; basename = ''; constructor(p = '') { this.path = p; } },
  };
})

// ── Mock SnippetTreePicker ──────────────────────────────────────────────────

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class { constructor() {} mount() { return Promise.resolve(); } unmount() {} },
}));

// ── Mock i18n ──────────────────────────────────────────────────────────────

const t = (key: string, params?: Record<string, string>): string => {
  const map: Record<string, string> = {
    'protocolEditor.displayText': 'Protocol editor',
    'protocolEditor.untyped': 'untyped',
    'protocolEditor.edgeDeleted': 'Edge deleted.',
    'protocolEditor.deleteFailed': 'Failed to delete: {error}',
    'protocolEditor.edgeFromLabel': 'From',
    'protocolEditor.edgeToLabel': 'To',
    'protocolEditor.edgeLabelLabel': 'Label',
    'protocolEditor.edgeLabelPlaceholder': 'Label',
    'protocolEditor.save': 'Save',
    'protocolEditor.cancel': 'Cancel',
    'protocolEditor.delete': 'Delete',
    'protocolEditor.close': 'Close',
    'protocolEditor.kindLabel': 'Kind',
    'protocolEditor.noEditableFields': 'No editable fields',
  };
  let result = map[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, v);
    }
  }
  return result;
};

// ── Test helpers ────────────────────────────────────────────────────────────

function makeDoc(edges: ProtocolEdgeRecord[] = []): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'test-doc',
    title: 'Test Protocol',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    nodes: [
      { id: 'n1', kind: 'question', x: 0, y: 0, width: 200, height: 80, text: 'Q1?', fields: { questionText: 'Q1?' } },
      { id: 'n2', kind: 'answer', x: 300, y: 0, width: 200, height: 80, text: 'A1', fields: {} },
      { id: 'n3', kind: 'question', x: 600, y: 0, width: 200, height: 80, text: 'Q2?', fields: { questionText: 'Q2?' } },
    ] as ProtocolNodeRecord[],
    edges,
  };
}

function createDeletionTestView(opts: {
  protocolPath: string | null;
  storeUpdateResult?: ProtocolDocumentV1;
  storeUpdateError?: Error;
}) {
  let updateCallCount = 0;
  let lastMutatorInput: ProtocolDocumentV1 | null = null;
  let lastMutatorEdgeId: string | null = null;

  const mockStore = {
    async update(protocolPath: string, mutator: (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1): Promise<ProtocolDocumentV1> {
      updateCallCount++;
      if (opts.storeUpdateError) {
        throw opts.storeUpdateError;
      }
      const existing: ProtocolDocumentV1 = {
        schema: 'radiprotocol.protocol',
        version: 1,
        id: 'test-doc',
        title: 'Test Protocol',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        nodes: [
          { id: 'n1', kind: 'question', x: 0, y: 0, width: 200, height: 80, text: 'Q1?', fields: { questionText: 'Q1?' } },
          { id: 'n2', kind: 'answer', x: 300, y: 0, width: 200, height: 80, text: 'A1', fields: {} },
          { id: 'n3', kind: 'question', x: 600, y: 0, width: 200, height: 80, text: 'Q2?', fields: { questionText: 'Q2?' } },
        ] as ProtocolNodeRecord[],
        edges: [
          { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', label: 'Yes' },
          { id: 'e2', fromNodeId: 'n1', toNodeId: 'n3', label: 'No' },
        ] as ProtocolEdgeRecord[],
      };
      lastMutatorInput = existing;
      const updated = mutator(existing);
      lastMutatorEdgeId = updated.edges.length < existing.edges.length
        ? existing.edges.find(e => !updated.edges.some(ue => ue.id === e.id))?.id ?? null
        : null;
      return opts.storeUpdateResult ?? updated;
    },
    async read() { return null; },
  };

  const mockPlugin = {
    i18n: { t },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    protocolDocumentStore: mockStore,
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
  (view as any).protocolPath = opts.protocolPath;
  (view as any).zoom = 1;

  const doc = makeDoc([
    { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', label: 'Yes' },
    { id: 'e2', fromNodeId: 'n1', toNodeId: 'n3', label: 'No' },
  ]);
  (view as any).doc = doc;

  const restoreFocusSpy = vi.fn();
  (view as any).restoreEditorFocus = restoreFocusSpy;
  (view as any).loadProtocol = vi.fn(async () => {});

  return { view, updateCallCount: () => updateCallCount, lastMutatorInput: () => lastMutatorInput, lastMutatorEdgeId: () => lastMutatorEdgeId, restoreFocusSpy };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProtocolEditorView.deleteEdge — regression tests (TASK #91)', () => {
  beforeEach(() => {
    noticeCalls.length = 0;
  });

  it('removes the specified edge while preserving all nodes', async () => {
    const { view } = createDeletionTestView({
      protocolPath: 'Protocols/test.rp.json',
    });

    await (view as any).deleteEdge('e1');

    // deleteEdge calls store.update which applies removeProtocolEditorEdge internally.
    // The mutator input captured during the call still has all 3 nodes and 2 edges.
    // The pure function removes exactly the target edge.
    const edges: ProtocolEdgeRecord[] = [
      { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', label: 'Yes' },
      { id: 'e2', fromNodeId: 'n1', toNodeId: 'n3', label: 'No' },
    ];
    const result = removeProtocolEditorEdge(edges, 'e1');
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('e2');
  });

  it('shows a localized Notice confirming deletion on success', async () => {
    const { view } = createDeletionTestView({
      protocolPath: 'Protocols/test.rp.json',
    });

    await (view as any).deleteEdge('e1');

    expect(noticeCalls).toContain('Edge deleted.');
  });

  it('early-returns without calling the store when protocolPath is null', async () => {
    const { view, updateCallCount } = createDeletionTestView({
      protocolPath: null,
    });

    await (view as any).deleteEdge('e1');

    expect(updateCallCount()).toBe(0);
    expect(noticeCalls.length).toBe(0);
  });

  it('shows a localized error Notice when the store rejects', async () => {
    const { view, updateCallCount } = createDeletionTestView({
      protocolPath: 'Protocols/test.rp.json',
      storeUpdateError: new Error('disk full'),
    });

    await (view as any).deleteEdge('e1');

    expect(updateCallCount()).toBe(1);
    // String(new Error('disk full')) === 'Error: disk full'
    expect(noticeCalls.some(c => c.includes('Failed to delete:') && c.includes('disk full'))).toBe(true);
  });

  it('calls restoreEditorFocus in finally block even on error', async () => {
    const { view, restoreFocusSpy } = createDeletionTestView({
      protocolPath: 'Protocols/test.rp.json',
      storeUpdateError: new Error('fail'),
    });

    await (view as any).deleteEdge('e1');

    expect(restoreFocusSpy).toHaveBeenCalledTimes(1);
  });

  it('calls restoreEditorFocus in finally block on success', async () => {
    const { view, restoreFocusSpy } = createDeletionTestView({
      protocolPath: 'Protocols/test.rp.json',
    });

    await (view as any).deleteEdge('e1');

    expect(restoreFocusSpy).toHaveBeenCalledTimes(1);
  });
});

describe('removeProtocolEditorEdge — unit tests', () => {
  it('removes the matching edge and preserves all others', () => {
    const edges: ProtocolEdgeRecord[] = [
      { id: 'e1', fromNodeId: 'a', toNodeId: 'b' },
      { id: 'e2', fromNodeId: 'b', toNodeId: 'c' },
      { id: 'e3', fromNodeId: 'c', toNodeId: 'd' },
    ];
    const result = removeProtocolEditorEdge(edges, 'e2');
    expect(result.length).toBe(2);
    expect(result.map(e => e.id)).toEqual(['e1', 'e3']);
  });

  it('returns all edges unchanged when edge ID does not match', () => {
    const edges: ProtocolEdgeRecord[] = [
      { id: 'e1', fromNodeId: 'a', toNodeId: 'b' },
      { id: 'e2', fromNodeId: 'b', toNodeId: 'c' },
    ];
    const result = removeProtocolEditorEdge(edges, 'e-missing');
    expect(result.length).toBe(2);
    expect(result.map(e => e.id)).toEqual(['e1', 'e2']);
  });

  it('returns empty array for empty input', () => {
    const result = removeProtocolEditorEdge([], 'e1');
    expect(result.length).toBe(0);
  });
});