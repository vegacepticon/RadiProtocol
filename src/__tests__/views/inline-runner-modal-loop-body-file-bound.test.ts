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
//
// Phase 75 plan 06 — MockEl harness, obsidian mock, and SnippetFillInModal /
// SnippetTreePicker mocks moved to runner-renderer-host-fixtures.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type MockEl, makeEl, findByClass } from '../runner/runner-renderer-host-fixtures';

const { snippetTreePickerMountSpy } = vi.hoisted(() => ({ snippetTreePickerMountSpy: vi.fn() }));

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});

vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock(snippetTreePickerMountSpy);
});

vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { ProtocolRunner } from '../../runner/protocol-runner';
import { TFile } from 'obsidian';
import { makeBaseApp, makeBasePlugin } from '../runner/runner-renderer-host-fixtures';
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

interface Harness {
  modal: InlineRunnerModal;
  runner: ProtocolRunner;
  contentEl: MockEl;
  handleSnippetFillSpy: ReturnType<typeof vi.fn>;
  app: ReturnType<typeof makeBaseApp>;
}

function mountWithGraph(graph: ProtocolGraph): Harness {
  const targetNote = makeTargetNote();
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote);

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
