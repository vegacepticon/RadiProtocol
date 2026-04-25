// src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts
// Phase 67 D-14 / D-18 Test Layer #1 — pure-runner regression for loop-body → file-bound snippet.
//
// Reproduces the user bug report: a loop body whose target is a file-bound Snippet
// (radiprotocol_snippetPath set) should land in 'awaiting-snippet-fill' with
// snippetId pre-populated — NOT in 'awaiting-snippet-pick' (the picker fallback).

import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  LoopNode,
  SnippetNode,
  StartNode,
  TextBlockNode,
} from '../../graph/graph-model';

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

describe('Phase 67 D-14 — advanceThrough case snippet routes file-bound to awaiting-snippet-fill', () => {
  it('loop-body → file-bound snippet → awaiting-snippet-fill with pre-populated snippetId', () => {
    const path = 'abdomen/ct.md';
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('n-loop', 'iter'),
        makeSnippet('sn', { radiprotocol_snippetPath: path }),
        makeTextBlock('n-end', 'done'),
      ],
      [
        ['n-start', 'n-loop'],            // e-0
        ['n-loop', 'sn', 'body'],          // e-1 — body branch (this is what chooseLoopBranch dispatches)
        ['n-loop', 'n-end', '+exit'],      // e-2 — exit edge (Phase 50.1 +-prefix)
        ['sn', 'n-loop'],                  // e-3 — back-edge for loop semantics
      ],
      'n-start',
    );

    const runner = new ProtocolRunner();
    runner.start(graph);

    // After start(), runner halts at 'n-loop' in 'awaiting-loop-pick' (Phase 44 RUN-01).
    const initialState = runner.getState();
    expect(initialState.status).toBe('awaiting-loop-pick');

    // Pick the body branch — this flows through chooseLoopBranch → advanceThrough → case 'snippet'.
    runner.chooseLoopBranch('e-1');

    const state = runner.getState();
    // FIX-07: file-bound dispatch — runner is in awaiting-snippet-fill with snippetId set.
    expect(state.status).toBe('awaiting-snippet-fill');
    if (state.status !== 'awaiting-snippet-fill') return;
    expect(state.snippetId).toBe(path);
    expect(state.nodeId).toBe('sn');
  });

  it('loop-body → directory-bound snippet → awaiting-snippet-pick (Phase 30 D-07 picker preserved)', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('n-loop', 'iter'),
        makeSnippet('sn', { subfolderPath: 'Findings/Chest' }),    // directory-bound: NO radiprotocol_snippetPath
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

    const runner = new ProtocolRunner();
    runner.start(graph);
    runner.chooseLoopBranch('e-1');

    const state = runner.getState();
    // Directory-bound snippet still halts at the picker — Phase 30 D-07 preserved.
    expect(state.status).toBe('awaiting-snippet-pick');
  });

  it('loop-body → file-bound snippet with empty path string → falls through to picker (gate is !== \'\')', () => {
    const graph = buildGraph(
      [
        makeStart('n-start'),
        makeLoop('n-loop', 'iter'),
        makeSnippet('sn', { radiprotocol_snippetPath: '' }),       // empty string ⇒ NOT file-bound (D-14 gate)
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

    const runner = new ProtocolRunner();
    runner.start(graph);
    runner.chooseLoopBranch('e-1');

    const state = runner.getState();
    expect(state.status).toBe('awaiting-snippet-pick');           // empty path → picker fallback
  });
});
