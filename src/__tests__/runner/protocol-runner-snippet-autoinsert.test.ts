// src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts
// Phase 51 Plan 06 (PICKER-01, D-13 / D-14 / D-15) — auto-insert dispatch.
//
// D-13 trigger (narrow — ALL must hold):
//   - Current node advanced INTO is kind === 'question'
//   - Question adjacency length === 1
//   - The sole neighbour is kind === 'snippet'
//   - The neighbour has radiprotocol_snippetPath set (non-empty string)
//   - The neighbour has radiprotocol_subfolderPath ABSENT (undefined or empty)
// When ALL hold → runner auto-advances into awaiting-snippet-fill with
// snippetId = neighbour.radiprotocol_snippetPath (full vault-relative path,
// extension kept per D-03), snippetNodeId = neighbour.id, currentNodeId =
// neighbour.id, runnerStatus = 'awaiting-snippet-fill'. Undo entry pushed
// BEFORE any mutation (D-15 — Pattern A) with nodeId = question id and
// returnToBranchList omitted (falls through standard stepBack restoration).
//
// Pure-runner tests — no Obsidian API, no RunnerView. Mirror the inline-graph
// factory pattern used in protocol-runner.test.ts & runner-snippet-sibling-button.test.ts.

import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  QuestionNode,
  AnswerNode,
  SnippetNode,
  TextBlockNode,
  StartNode,
  LoopNode,
} from '../../graph/graph-model';

// ── Graph factory helpers ────────────────────────────────────────────────

function makeStart(id = 'n-start'): StartNode {
  return { kind: 'start', id, x: 0, y: 0, width: 50, height: 50 };
}

function makeQuestion(id: string, text = 'q?'): QuestionNode {
  return { kind: 'question', id, questionText: text, x: 0, y: 0, width: 100, height: 40 };
}

function makeAnswer(id: string, answerText = 'A'): AnswerNode {
  return { kind: 'answer', id, answerText, x: 0, y: 0, width: 100, height: 40 };
}

function makeTextBlock(id: string, content = 'TB'): TextBlockNode {
  return { kind: 'text-block', id, content, x: 0, y: 0, width: 100, height: 40 };
}

function makeSnippet(id: string, partial: Partial<SnippetNode> = {}): SnippetNode {
  return {
    kind: 'snippet',
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    ...partial,
  } as SnippetNode;
}

function makeLoop(id: string, headerText = 'Цикл'): LoopNode {
  return { kind: 'loop', id, headerText, x: 0, y: 0, width: 150, height: 80 };
}

/** Build a minimal ProtocolGraph from a list of nodes + ordered edges. */
function buildGraph(nodes: RPNode[], edgeList: Array<[string, string, string?]>, startNodeId: string): ProtocolGraph {
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

// ── Tests ────────────────────────────────────────────────────────────────

describe('Phase 51 Plan 06 — ProtocolRunner D-13/D-14/D-15 auto-insert dispatch', () => {

  it('Test 1: positive D-13 — Question with single edge → file-bound .md Snippet auto-advances to awaiting-snippet-fill', () => {
    // start → q1 (question) → sn (snippet, snippetPath:"abdomen/ct.md")
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe('abdomen/ct.md');
    expect(state.nodeId).toBe('sn');
    expect(state.canStepBack).toBe(true);
  });

  it('Test 2: positive D-13 — Question with single edge → file-bound .json Snippet auto-advances; snippetId keeps full path with ext', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'liver/r.json' }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe('liver/r.json');
    expect(state.nodeId).toBe('sn');
  });

  it('Test 3: D-13 negative — directory-bound Snippet (subfolderPath set, no snippetPath) halts at Question with at-node', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', { subfolderPath: 'abdomen' }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
  });

  it('Test 4: D-13 negative — Question with TWO outgoing edges (Snippet + Answer) halts at Question', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
        makeAnswer('a1', 'Yes'),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
        ['q1', 'a1'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
  });

  it('Test 5: D-13 negative — Question with single edge → Answer halts at Question (no snippet involved)', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeAnswer('a1', 'Yes'),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'a1'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
  });

  it('Test 6: D-13 negative — Question with single edge → text-block halts at Question', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeTextBlock('tb1', 'static text'),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'tb1'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
  });

  it('Test 7: D-15 undo — stepBack from auto-insert state returns to Question with pre-insertion accumulator', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    // pre-state: awaiting-snippet-fill
    const pre = runner.getState();
    expect(pre.status).toBe('awaiting-snippet-fill');

    runner.stepBack();
    const post = runner.getState();
    expect(post.status).toBe('at-node');
    if (post.status !== 'at-node') return;
    expect(post.currentNodeId).toBe('q1');
    expect(post.accumulatedText).toBe('');
  });

  it('Test 8: D-15 undo after completeSnippet — stepBack from subsequent node restores pre-insertion accumulator', () => {
    // start → tb-pre (appends "preceding text") → q1 → sn (snippetPath) → tb-post
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeTextBlock('tb-pre', 'preceding text'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
        makeTextBlock('tb-post', 'tail'),
      ],
      [
        ['n-start', 'tb-pre'],
        ['tb-pre', 'q1'],
        ['q1', 'sn'],
        ['sn', 'tb-post'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    // State = awaiting-snippet-fill, accumulator = "preceding text"
    const mid = runner.getState();
    expect(mid.status).toBe('awaiting-snippet-fill');
    if (mid.status !== 'awaiting-snippet-fill') return;
    expect(mid.accumulatedText).toBe('preceding text');

    // Complete the snippet — inserts snippet text and advances through sn to tb-post (auto-appends "tail"), completes
    runner.completeSnippet('snippet text');
    let after = runner.getState();
    // Should reach complete state because tb-post is terminal
    expect(after.status).toBe('complete');
    if (after.status !== 'complete') return;
    expect(after.finalText).toBe('preceding text\nsnippet text\ntail');

    // A second stepBack chain: restart and stepBack from awaiting-snippet-fill directly
    const runner2 = new ProtocolRunner();
    runner2.start(graph);
    runner2.stepBack();
    const s = runner2.getState();
    expect(s.status).toBe('at-node');
    if (s.status !== 'at-node') return;
    expect(s.currentNodeId).toBe('q1');
    // Accumulator restored to pre-insertion snapshot = "preceding text"
    expect(s.accumulatedText).toBe('preceding text');
  });

  it('Test 9: D-13 exclusion — Snippet-as-start (start edge directly to file-bound Snippet, no Question) does NOT auto-insert', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
      ],
      [
        ['n-start', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    // existing case 'snippet' arm halts at awaiting-snippet-pick
    expect(state.status).toBe('awaiting-snippet-pick');
  });

  it('Test 10: D-13 exclusion — linear chain Answer → file-bound Snippet does NOT auto-insert', () => {
    // start → q1 (question) → a1 (answer, terminal-before-snippet) → sn (file-bound)
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeAnswer('a1', 'A1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'a1'],
        ['a1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    // Halts at q1 because q1 has a single edge → a1 (an Answer, not a Snippet)
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');

    // Now pick a1 — runner should advance through answer → snippet, halts at awaiting-snippet-pick
    // (NOT auto-insert; D-13 trigger is Question-rooted only)
    runner.chooseAnswer('a1');
    const after = runner.getState();
    expect(after.status).toBe('awaiting-snippet-pick');
  });

  it('Test 11: loop integration — Question inside loop body with single edge → file-bound Snippet auto-inserts; stepBack returns to Question with loop context restored', () => {
    // start → loop → (body: q1 → sn → back-edge to loop) / (exit: end)
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('loop'),
        makeQuestion('q1'),
        makeSnippet('sn', { radiprotocol_snippetPath: 'abdomen/ct.md' }),
        makeTextBlock('end', 'exit text'),
      ],
      [
        ['n-start', 'loop'],
        ['loop', 'q1'],                  // body (no "+" label)
        ['loop', 'end', '+выход'],       // exit
        ['q1', 'sn'],
        ['sn', 'loop'],                  // back-edge
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    let state = runner.getState();
    // first halt is the loop picker
    expect(state.status).toBe('awaiting-loop-pick');

    // Pick the body branch (e-1, which is loop → q1)
    runner.chooseLoopBranch('e-1');
    state = runner.getState();
    // Should land directly in awaiting-snippet-fill (auto-insert through Question q1)
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe('abdomen/ct.md');

    // stepBack — return to the Question node with loop context preserved
    runner.stepBack();
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    // loopContextStack should still contain the outer loop frame
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(1);
    expect(serialized.loopContextStack[0]?.loopNodeId).toBe('loop');
  });

  it('Test 12: D-13 defensive negative — Snippet with BOTH snippetPath AND subfolderPath set does NOT auto-insert (falls through to picker click path)', () => {
    // Malformed/externally-edited canvas — BOTH fields set. D-13 requires subfolderPath ABSENT.
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeQuestion('q1'),
        makeSnippet('sn', {
          radiprotocol_snippetPath: 'abdomen/ct.md',
          subfolderPath: 'abdomen',
        }),
      ],
      [
        ['n-start', 'q1'],
        ['q1', 'sn'],
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
  });

});
