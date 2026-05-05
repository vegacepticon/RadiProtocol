// src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts
// Phase 56 Plan 01 Task 2 (D-03 / PICKER-01 reversal) —
// pickFileBoundSnippet click-driven entry point.
//
// Covered semantics (D-03):
//   1. Guard: runnerStatus === 'at-node' AND currentNodeId === questionNodeId.
//   2. Push UndoEntry (D-15 undo-before-mutate, identical shape to pickSnippet).
//   3. Set snippetId, snippetNodeId, currentNodeId.
//   4. Flip runnerStatus to 'awaiting-snippet-fill'.
//   5. stepBack() restores Question + pre-pick accumulator (existing path, no new branch).
//
// Pure-runner tests — no Obsidian API, no view host. Mirrors the inline-graph
// factory pattern used in protocol-runner-snippet-autoinsert.test.ts.

import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type {
  ProtocolGraph,
  RPNode,
  RPEdge,
  QuestionNode,
  SnippetNode,
  StartNode,
} from '../../graph/graph-model';

// ── Graph factory helpers ────────────────────────────────────────────────

function makeStart(id = 'n-start'): StartNode {
  return { kind: 'start', id, x: 0, y: 0, width: 50, height: 50 };
}

function makeQuestion(id: string, text = 'q?'): QuestionNode {
  return { kind: 'question', id, questionText: text, x: 0, y: 0, width: 100, height: 40 };
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

/**
 * Standard fixture: start → q1 (Question) → sn (file-bound Snippet).
 * After Phase 56 D-02 removal, runner.start() halts at q1 in 'at-node'.
 */
function buildStdFixture(): { runner: ProtocolRunner; qid: string; sid: string; path: string } {
  const path = 'abdomen/ct.md';
  const graph = buildGraph(
    [
      makeStart('n-start'),
      makeQuestion('q1'),
      makeSnippet('sn', { radiprotocol_snippetPath: path }),
    ],
    [
      ['n-start', 'q1'],
      ['q1', 'sn'],
    ],
    'n-start',
  );
  const runner = new ProtocolRunner();
  runner.start(graph);
  return { runner, qid: 'q1', sid: 'sn', path };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Phase 56 Plan 01 Task 2 — ProtocolRunner.pickFileBoundSnippet (D-03)', () => {
  it('Test 1: from at-node + matching qid → flips to awaiting-snippet-fill with snippet fields populated', () => {
    const { runner, qid, sid, path } = buildStdFixture();
    // Sanity: D-02 removal — runner halts at the Question, not auto-advances.
    const pre = runner.getState();
    expect(pre.status).toBe('at-node');
    if (pre.status !== 'at-node') return;
    expect(pre.currentNodeId).toBe(qid);

    runner.pickFileBoundSnippet(qid, sid, path);

    const post = runner.getState();
    expect(post.status).toBe('awaiting-snippet-fill');
    if (post.status !== 'awaiting-snippet-fill') return;
    expect(post.snippetId).toBe(path);
    expect(post.nodeId).toBe(sid);

    // Verify currentNodeId moved to the snippet node via the serialisable view.
    const serialised = runner.getSerializableState();
    expect(serialised).not.toBeNull();
    if (serialised === null) return;
    expect(serialised.currentNodeId).toBe(sid);
    expect(serialised.snippetId).toBe(path);
    expect(serialised.snippetNodeId).toBe(sid);
  });

  it('Test 2: pushes UndoEntry BEFORE mutation (D-15 undo-before-mutate; nodeId=qid; textSnapshot=pre-pick accumulator)', () => {
    const { runner, qid, sid, path } = buildStdFixture();

    const preSerialised = runner.getSerializableState();
    expect(preSerialised).not.toBeNull();
    if (preSerialised === null) return;
    const preLen = preSerialised.undoStack.length;
    const preText = preSerialised.accumulatedText;

    runner.pickFileBoundSnippet(qid, sid, path);

    const postSerialised = runner.getSerializableState();
    expect(postSerialised).not.toBeNull();
    if (postSerialised === null) return;
    expect(postSerialised.undoStack.length).toBe(preLen + 1);

    const newEntry = postSerialised.undoStack[postSerialised.undoStack.length - 1]!;
    expect(newEntry.nodeId).toBe(qid);
    expect(newEntry.textSnapshot).toBe(preText);
  });

  it('Test 3: no-op when runnerStatus !== at-node (e.g. after pick — second call is rejected)', () => {
    const { runner, qid, sid, path } = buildStdFixture();
    runner.pickFileBoundSnippet(qid, sid, path); // first call → awaiting-snippet-fill
    const mid = runner.getState();
    expect(mid.status).toBe('awaiting-snippet-fill');

    const midSerialised = runner.getSerializableState();
    expect(midSerialised).not.toBeNull();
    if (midSerialised === null) return;
    const undoLenAfterFirst = midSerialised.undoStack.length;

    // Second call from awaiting-snippet-fill — must be rejected, no mutation.
    runner.pickFileBoundSnippet(qid, sid, path);
    const post = runner.getState();
    expect(post.status).toBe('awaiting-snippet-fill'); // unchanged

    const postSerialised = runner.getSerializableState();
    expect(postSerialised).not.toBeNull();
    if (postSerialised === null) return;
    expect(postSerialised.undoStack.length).toBe(undoLenAfterFirst); // no extra push
  });

  it('Test 4: no-op when questionNodeId does not match currentNodeId', () => {
    const { runner, sid, path } = buildStdFixture();
    const preSerialised = runner.getSerializableState();
    expect(preSerialised).not.toBeNull();
    if (preSerialised === null) return;
    const preUndoLen = preSerialised.undoStack.length;

    runner.pickFileBoundSnippet('not-the-current-question', sid, path);

    const post = runner.getState();
    expect(post.status).toBe('at-node'); // still halted at q1
    if (post.status !== 'at-node') return;
    expect(post.currentNodeId).toBe('q1');

    const postSerialised = runner.getSerializableState();
    expect(postSerialised).not.toBeNull();
    if (postSerialised === null) return;
    expect(postSerialised.undoStack.length).toBe(preUndoLen);
  });

  it('Test 5: stepBack() after pickFileBoundSnippet restores Question + pre-pick accumulator (existing path)', () => {
    const { runner, qid, sid, path } = buildStdFixture();
    const preSerialised = runner.getSerializableState();
    expect(preSerialised).not.toBeNull();
    if (preSerialised === null) return;
    const preText = preSerialised.accumulatedText;

    runner.pickFileBoundSnippet(qid, sid, path);
    expect(runner.getState().status).toBe('awaiting-snippet-fill');

    runner.stepBack();
    const post = runner.getState();
    expect(post.status).toBe('at-node');
    if (post.status !== 'at-node') return;
    expect(post.currentNodeId).toBe(qid);
    expect(post.accumulatedText).toBe(preText);
  });
});
