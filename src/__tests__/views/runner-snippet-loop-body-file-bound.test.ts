// src/__tests__/views/runner-snippet-loop-body-file-bound.test.ts
// Phase 67 D-14 / D-18 Test Layer #2 — sidebar RunnerView regression for
// loop-body → file-bound Snippet → awaiting-snippet-fill dispatch.
//
// Reproduces the user bug report in sidebar mode: a loop body whose target is
// a file-bound Snippet (radiprotocol_snippetPath set) should render with the
// file-bound caption (📄 …) and clicking it should drive the runner into
// 'awaiting-snippet-fill' (NOT the directory picker — Phase 30 D-07 path).
// The view-layer code (case 'awaiting-snippet-fill' arm at runner-view.ts:674-684)
// is unchanged per D-17 — this test enforces that the runner-core fix (D-14)
// routes loop-body traversals correctly into the existing arm.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('obsidian');

// Mock SnippetTreePicker to fail loudly if picker is mounted (file-bound must NOT mount it).
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

import { RunnerView } from '../../views/runner-view';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type RadiProtocolPlugin from '../../main';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  StartNode,
  LoopNode,
  SnippetNode,
  TextBlockNode,
} from '../../graph/graph-model';

// ── FakeNode — DOM-ish stub mirroring runner-snippet-sibling-button.test.ts ─

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  createDiv: (opts?: { cls?: string; text?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string; type?: string }) => FakeNode;
  createSpan: (opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setText: (t: string) => void;
  setAttribute: (name: string, value: string) => void;
  prepend: (el: FakeNode) => void;
  _clickHandler?: () => void;
  _attrs?: Record<string, string>;
  disabled: boolean;
  value: string;
  style: Record<string, string>;
  scrollTop: number;
  scrollHeight: number;
}

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    createDiv(opts?: { cls?: string; text?: string }): FakeNode {
      const child = makeFakeNode('div', opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string; type?: string }): FakeNode {
      const child = makeFakeNode(t, opts?.cls, opts?.text);
      node.children.push(child);
      if (opts?.type !== undefined) {
        (child as unknown as { type: string }).type = opts.type;
      }
      return child;
    },
    createSpan(opts?: { cls?: string; text?: string }): FakeNode {
      return node.createEl('span', opts);
    },
    empty(): void {
      node.children.length = 0;
    },
    setText(t: string): void {
      node.text = t;
    },
    setAttribute(name: string, value: string): void {
      if (node._attrs === undefined) node._attrs = {};
      node._attrs[name] = value;
    },
    prepend(_el: FakeNode): void {},
    disabled: false,
    value: '',
    style: {},
    scrollTop: 0,
    scrollHeight: 0,
  };
  return node;
}

function findByClass(root: FakeNode, cls: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.cls === cls) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

// ── Graph factory helpers (inline-built, mirroring pure-runner test) ───────

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

function makePlugin(): RadiProtocolPlugin {
  return {
    settings: { snippetFolderPath: '.radiprotocol/snippets', textSeparator: 'newline' },
    snippetService: {
      load: vi.fn(),
      listFolder: vi.fn(async () => ({ folders: [], snippets: [] })),
      listFolderDescendants: vi.fn(async () => ({ files: [], folders: [] })),
    },
    app: { vault: { getAbstractFileByPath: () => null } },
    sessionService: { save: vi.fn(), load: vi.fn(), clear: vi.fn() },
    canvasLiveEditor: { getCanvasJSON: () => null },
    canvasParser: { parse: vi.fn() },
    saveOutputToNote: vi.fn(),
    insertIntoCurrentNote: vi.fn(),
  } as unknown as RadiProtocolPlugin;
}

interface Harness {
  view: RunnerView;
  runner: ProtocolRunner;
  handleSnippetFillSpy: ReturnType<typeof vi.fn>;
  contentEl: FakeNode;
}

/**
 * Mount a RunnerView with a real ProtocolRunner driving the graph.
 * `handleSnippetFill` is replaced with a spy so we can assert it is invoked
 * with the file-bound snippet's path (the D-14 contract — runner state is
 * `awaiting-snippet-fill` with `snippetId = radiprotocol_snippetPath`).
 */
function mountWithGraph(graph: ProtocolGraph): Harness {
  const plugin = makePlugin();
  const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
  const view = new RunnerView(leaf, plugin);
  const contentEl = makeFakeNode();
  (view as unknown as { contentEl: FakeNode }).contentEl = contentEl;

  // Real runner driving the graph — D-14 fix lives in protocol-runner.ts.
  const runner = new ProtocolRunner();
  runner.start(graph);
  (view as unknown as { runner: ProtocolRunner }).runner = runner;
  (view as unknown as { graph: ProtocolGraph }).graph = graph;

  // Stub registerDomEvent to capture click handlers on body buttons.
  (view as unknown as { registerDomEvent: unknown }).registerDomEvent = (
    el: FakeNode,
    type: string,
    handler: () => void,
  ) => {
    if (type === 'click') el._clickHandler = handler;
  };

  // Stub I/O / async surfaces so render() runs synchronously without Obsidian.
  (view as unknown as { autoSaveSession: () => Promise<void> }).autoSaveSession =
    async () => {};
  (view as unknown as { renderAsync: () => Promise<void> }).renderAsync = async () => {
    (view as unknown as { render: () => void }).render();
  };
  (view as unknown as { renderPreviewZone: () => void }).renderPreviewZone = () => {};
  (view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};

  // Spy handleSnippetFill — D-17: this arm of the view is unchanged; we just verify it is invoked.
  const handleSnippetFillSpy = vi.fn(async (_snippetId: string, _questionZone: unknown) => {});
  (view as unknown as { handleSnippetFill: typeof handleSnippetFillSpy }).handleSnippetFill =
    handleSnippetFillSpy;

  // Initial render — RunnerView halts at awaiting-loop-pick (Phase 44 RUN-01).
  (view as unknown as { render: () => void }).render();

  return { view, runner, handleSnippetFillSpy, contentEl };
}

beforeEach(() => {
  snippetTreePickerMountSpy.mockClear();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 67 D-14 / D-18 Test Layer #2 — sidebar RunnerView loop-body → file-bound Snippet parity', () => {
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
    expect(bodyBtns[0]!.text).toBe('📄 Abd CT');

    // Click body button — exercises chooseLoopBranch → advanceThrough → case 'snippet' (D-14).
    bodyBtns[0]!._clickHandler?.();
    // renderAsync is async (microtask) — flush it.
    await Promise.resolve();
    await Promise.resolve();

    // After re-render, runner state is awaiting-snippet-fill and view dispatched handleSnippetFill.
    const state = h.runner.getState();
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe(path);
    expect(state.nodeId).toBe('sn');

    // D-17 contract: existing case 'awaiting-snippet-fill' arm dispatches handleSnippetFill(snippetId, …).
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
    expect(bodyBtns[0]!.text).toBe('snippet (Findings/Chest)');

    bodyBtns[0]!._clickHandler?.();
    await Promise.resolve();
    await Promise.resolve();

    const state = h.runner.getState();
    // Directory-bound: Phase 30 D-07 picker path preserved.
    expect(state.status).toBe('awaiting-snippet-pick');
    // handleSnippetFill MUST NOT have been called — directory-bound goes through the picker.
    expect(h.handleSnippetFillSpy).not.toHaveBeenCalled();
  });
});
