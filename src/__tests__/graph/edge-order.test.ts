// src/__tests__/graph/edge-order.test.ts
// Unit tests for the ordered-edge projection shared by render and skip.

import { describe, it, expect } from 'vitest';
import { orderedOutgoingEdges } from '../../graph/edge-order';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';

const baseRect = { x: 0, y: 0, width: 200, height: 60 };

function q(id: string, optionOrder?: string[]): RPNode {
  return { id, kind: 'question', questionText: `Q ${id}`, ...(optionOrder !== undefined ? { optionOrder } : {}), ...baseRect } as RPNode;
}
function a(id: string): RPNode {
  return { id, kind: 'answer', answerText: `A ${id}`, ...baseRect } as RPNode;
}

function makeGraph(nodes: RPNode[], edges: RPEdge[], questionId: string): ProtocolGraph {
  const nodeMap = new Map<string, RPNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  return {
    canvasFilePath: 'test.rp.json',
    nodes: nodeMap,
    edges,
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: questionId,
  };
}

describe('orderedOutgoingEdges', () => {
  it('optionOrder absent → outgoing in edges-array order', () => {
    const graph = makeGraph(
      [q('q1'), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('optionOrder present → ordered; stale id dropped; unlisted appended at end', () => {
    const graph = makeGraph(
      [q('q1', ['e2', 'e-stale', 'e3']), a('a1'), a('a2'), a('a3')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
        { id: 'e3', fromNodeId: 'q1', toNodeId: 'a3' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('optionOrder fully orders all outgoing edges (no unlisted)', () => {
    const graph = makeGraph(
      [q('q1', ['e3', 'e1', 'e2']), a('a1'), a('a2'), a('a3')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
        { id: 'e3', fromNodeId: 'q1', toNodeId: 'a3' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e3', 'e1', 'e2']);
  });

  it('empty optionOrder [] → all outgoing appended in edges-array order', () => {
    const graph = makeGraph(
      [q('q1', []), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('duplicate ids in optionOrder → deduped (first occurrence wins)', () => {
    const graph = makeGraph(
      [q('q1', ['e2', 'e2', 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('non-outgoing (reassigned) id in optionOrder → dropped', () => {
    const graph = makeGraph(
      [q('q1', ['e-other', 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e-other', fromNodeId: 'a1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1']);
  });

  it('all optionOrder ids stale → falls back to outgoing edges-array order', () => {
    const graph = makeGraph(
      [q('q1', ['e-x', 'e-y']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('non-string entry in optionOrder (hand-edited runtime) → skipped silently', () => {
    const graph = makeGraph(
      [q('q1', [42 as unknown as string, 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('missing question node → outgoing edges-array order (defensive)', () => {
    const graph = makeGraph(
      [a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('non-question node → outgoing edges-array order (defensive)', () => {
    const graph = makeGraph(
      [a('q1'), a('a1')],
      [{ id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' }],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1']);
  });
});
