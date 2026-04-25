// src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts
// Phase 67 D-14 / D-18 Test Layer #3 — InlineRunnerModal regression for
// loop-body → file-bound Snippet → awaiting-snippet-fill dispatch.
//
// Reproduces the user bug report in inline mode: a loop body whose target is
// a file-bound Snippet (radiprotocol_snippetPath set) should render with the
// file-bound caption (📄 …) and clicking it should drive the runner into
// 'awaiting-snippet-fill' (NOT the directory picker — Phase 30 D-07 path).
// The view-layer code (case 'awaiting-snippet-fill' arm at inline-runner-modal.ts:520-528)
// is unchanged per D-16 — this test enforces that the runner-core fix (D-14)
// routes loop-body traversals correctly into the existing arm.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ───── MockEl harness mirrors inline-runner-modal.test.ts ─────
interface MockEl {
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
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      (el as unknown as { _text: string })._text = text;
    },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      const want = on ?? !classSet.has(cls);
      if (want) classSet.add(cls);
      else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
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
    prepend(child: MockEl): void {
      children.unshift(child);
      child.parent = el as unknown as MockEl;
    },
    style,
  } as unknown as MockEl;

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

function findByClass(root: MockEl, cls: string): MockEl[] {
  return walk(root, '.' + cls);
}

// ───── Mock obsidian ─────
vi.mock('obsidian', () => {
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
});

// Mock SnippetTreePicker — file-bound dispatch must NOT mount it.
const snippetTreePickerMountSpy = vi.fn();
vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {
      snippetTreePickerMountSpy();
    }
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

// Mock SnippetFillInModal — capture instances to assert it was opened with the file-bound path.
vi.mock('../../views/snippet-fill-in-modal', () => {
  const instances: Array<{
    snippet: unknown;
    result: Promise<string | null>;
    __resolve: (v: string | null) => void;
    open: () => void;
    close: () => void;
    opened: boolean;
  }> = [];
  class SnippetFillInModal {
    result: Promise<string | null>;
    private resolveFn!: (v: string | null) => void;
    opened = false;
    closed = false;
    readonly snippet: unknown;
    constructor(_app: unknown, snippet: unknown) {
      this.snippet = snippet;
      this.result = new Promise<string | null>(res => { this.resolveFn = res; });
      const self = this;
      instances.push({
        snippet,
        result: this.result,
        __resolve: (v: string | null) => this.resolveFn(v),
        open: () => { self.opened = true; },
        close: () => { self.closed = true; },
        get opened() { return self.opened; },
      } as any);
    }
    open(): void { this.opened = true; }
    close(): void { this.closed = true; }
  }
  return { SnippetFillInModal, __fillModalInstances: instances };
});

// Import after mocks are installed.
import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { ProtocolRunner } from '../../runner/protocol-runner';
import { TFile } from 'obsidian';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  StartNode,
  LoopNode,
  SnippetNode,
  TextBlockNode,
} from '../../graph/graph-model';

// ── Graph factory helpers ────────────────────────────────────────────────

function makeStart(id = 'n-start'): StartNode {
  return { kind: 'start', id, x: 0, y: 0, width: 50, height: 50 };
}

function makeLoop(id: string, headerText = 'iter'): LoopNode {
  return { kind: 'loop', id, headerText, x: 0, y: 0, width: 100, height: 40 };
}

function makeSnippet(id: string, partial: Partial<SnippetNode> = {}): SnippetNode {
  return { kind: 'snippet', id, x: 0, y: 0, width: 100, height: 40, ...partial } as SnippetNode;
}

function makeTextBlock(id: string, content = 'tail'): TextBlockNode {
  return { kind: 'text-block', id, content, x: 0, y: 0, width: 100, height: 40 };
}

function buildGraph(
  nodes: RPNode[],
  edgeList: Array<[string, string, string?]>,
  startNodeId: string,
): ProtocolGraph {
  const nodeMap = new Map<string, RPNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  const edges: RPEdge[] = edgeList.map(([from, to, label], i) => ({
    id: `e-${i}`,
    fromNodeId: from,
    toNodeId: to,
    ...(label !== undefined ? { label } : {}),
  }));
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.fromNodeId)) adjacency.set(e.fromNodeId, []);
    adjacency.get(e.fromNodeId)!.push(e.toNodeId);
    if (!reverseAdjacency.has(e.toNodeId)) reverseAdjacency.set(e.toNodeId, []);
    reverseAdjacency.get(e.toNodeId)!.push(e.fromNodeId);
  }
  return {
    canvasFilePath: 'test.canvas',
    nodes: nodeMap,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId,
  };
}

// ── Harness mounting ─────────────────────────────────────────────────────

function makeTargetNote(): TFile {
  return new (TFile as any)('notes/target.md');
}

function makePlugin(): any {
  return {
    settings: {
      textSeparator: 'newline',
      snippetFolderPath: 'Snippets',
      protocolFolderPath: 'Protocols',
    },
    snippetService: {
      load: vi.fn(async (_absPath: string) => null),
    },
    insertMutex: {
      runExclusive: vi.fn(async (_path: string, fn: () => Promise<void>) => fn()),
    },
    activateRunnerView: vi.fn(),
    canvasLiveEditor: { getCanvasJSON: () => null },
    _vaultModifyCalls: [] as Array<[string, string]>,
  };
}

function makeApp(plugin: any): any {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(async () => ''),
      modify: vi.fn(async (file: TFile, content: string) => {
        plugin._vaultModifyCalls.push([file.path, content]);
      }),
      getFiles: vi.fn(() => []),
    },
    workspace: {
      on: vi.fn(() => ({})),
      getActiveFile: vi.fn(() => null),
      iterateAllLeaves: vi.fn(() => {}),
    },
  };
}

interface Harness {
  modal: InlineRunnerModal;
  runner: ProtocolRunner;
  contentEl: MockEl;
  handleSnippetFillSpy: ReturnType<typeof vi.fn>;
  app: any;
}

function mountWithGraph(graph: ProtocolGraph): Harness {
  const targetNote = makeTargetNote();
  const plugin = makePlugin();
  const app = makeApp(plugin);
  const modal = new InlineRunnerModal(
    app as any,
    plugin as any,
    'test.canvas',
    targetNote,
  );

  // Bypass full open() — install fields directly so we can drive render() with our graph.
  const contentEl = makeEl('div');
  (modal as unknown as { contentEl: MockEl }).contentEl = contentEl;
  (modal as unknown as { graph: ProtocolGraph }).graph = graph;

  // Install a real ProtocolRunner against the graph so D-14 dispatch is exercised.
  const runner = new ProtocolRunner();
  runner.start(graph);
  (modal as unknown as { runner: ProtocolRunner }).runner = runner;

  // Spy handleSnippetFill — D-16: this arm of the view is unchanged; we just verify it is invoked.
  const handleSnippetFillSpy = vi.fn(async (_snippetId: string, _questionZone: unknown) => {});
  (modal as unknown as { handleSnippetFill: typeof handleSnippetFillSpy }).handleSnippetFill =
    handleSnippetFillSpy;

  // Stub appendAnswerToNote so handleLoopBranchClick's accumulator-diff append doesn't blow up.
  (modal as unknown as { appendAnswerToNote: (t: string) => Promise<void> }).appendAnswerToNote =
    async () => {};

  // Trigger initial render.
  (modal as unknown as { render: () => void }).render();

  return { modal, runner, contentEl, handleSnippetFillSpy, app };
}

beforeEach(() => {
  snippetTreePickerMountSpy.mockClear();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 67 D-14 / D-18 Test Layer #3 — InlineRunnerModal loop-body → file-bound Snippet parity', () => {
  it('renders body branch with 📄 caption (D-15) and click drives runner into awaiting-snippet-fill → handleSnippetFill', async () => {
    const path = 'abdomen/ct.md';
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('n-loop', 'iter'),
        makeSnippet('sn', { radiprotocol_snippetPath: path, snippetLabel: 'Abd CT' }),
        makeTextBlock('n-end', 'done'),
      ],
      [
        ['n-start', 'n-loop'],            // e-0
        ['n-loop', 'sn', 'body'],          // e-1 — body edge → file-bound snippet
        ['n-loop', 'n-end', '+exit'],      // e-2 — exit edge
        ['sn', 'n-loop'],                  // e-3 — back-edge for loop semantics
      ],
      'n-start',
    );

    const h = mountWithGraph(graph);

    // RUN-01: render shows loop picker with body button caption '📄 Abd CT' (D-15).
    const bodyBtns = findByClass(h.contentEl, 'rp-loop-body-btn');
    expect(bodyBtns.length).toBe(1);
    expect((bodyBtns[0] as unknown as { _text: string })._text).toBe('📄 Abd CT');

    // Click body button — exercises handleLoopBranchClick → chooseLoopBranch → advanceThrough → case 'snippet' (D-14).
    bodyBtns[0]!.dispatchEvent({ type: 'click' });
    // Allow microtask flush — handleLoopBranchClick is async.
    await new Promise(r => setTimeout(r, 10));

    // After re-render, runner state is awaiting-snippet-fill and view dispatched handleSnippetFill.
    const state = h.runner.getState();
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe(path);
    expect(state.nodeId).toBe('sn');

    // D-16 contract: existing case 'awaiting-snippet-fill' arm dispatches handleSnippetFill(snippetId, …).
    expect(h.handleSnippetFillSpy).toHaveBeenCalled();
    expect(h.handleSnippetFillSpy.mock.calls[0]![0]).toBe(path);

    // Phase 30 D-07 directory picker MUST NOT have been mounted for the file-bound traversal.
    expect(snippetTreePickerMountSpy).not.toHaveBeenCalled();
  });

  it('directory-bound snippet via loop body still routes to picker (Phase 30 D-07 preserved)', async () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('n-loop', 'iter'),
        makeSnippet('sn', { subfolderPath: 'Findings/Chest' }),  // directory-bound
        makeTextBlock('n-end', 'done'),
      ],
      [
        ['n-start', 'n-loop'],
        ['n-loop', 'sn', 'body'],
        ['n-loop', 'n-end', '+exit'],
        ['sn', 'n-loop'],
      ],
      'n-start',
    );

    const h = mountWithGraph(graph);

    const bodyBtns = findByClass(h.contentEl, 'rp-loop-body-btn');
    expect(bodyBtns.length).toBe(1);
    // D-15 directory-bound back-compat — caption is the legacy 'snippet (Findings/Chest)' string.
    expect((bodyBtns[0] as unknown as { _text: string })._text).toBe('snippet (Findings/Chest)');

    bodyBtns[0]!.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 10));

    const state = h.runner.getState();
    // Directory-bound: Phase 30 D-07 picker path preserved.
    expect(state.status).toBe('awaiting-snippet-pick');
    // handleSnippetFill MUST NOT have been called — directory-bound goes through the picker.
    expect(h.handleSnippetFillSpy).not.toHaveBeenCalled();
  });
});
