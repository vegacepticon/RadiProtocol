import { describe, expect, it } from 'vitest';
import { buildProtocolEditorOutline } from '../../views/protocol-editor-outline';
import type { ProtocolEdgeRecord, ProtocolNodeRecord } from '../../protocol/protocol-document';

function node(id: string, kind: ProtocolNodeRecord['kind'], x = 0, y = 0): ProtocolNodeRecord {
  return {
    id,
    kind,
    x,
    y,
    width: 200,
    height: 80,
    fields: {},
    ...(kind === 'question' ? { questionText: `Q ${id}` } : {}),
    ...(kind === 'answer' ? { answerText: `A ${id}` } : {}),
    text: `${id} title`,
  };
}

function edge(id: string, from: string, to: string): ProtocolEdgeRecord {
  return { id, fromNodeId: from, toNodeId: to };
}

const titleOf = (n: ProtocolNodeRecord) => n.text ?? n.id;

describe('buildProtocolEditorOutline', () => {
  it('returns empty for an empty document', () => {
    expect(buildProtocolEditorOutline([], [], titleOf)).toEqual([]);
  });

  it('orders rows BFS from the start with increasing depth', () => {
    const nodes = [
      node('s', 'start'),
      node('q1', 'question'),
      node('a1', 'answer'),
      node('q2', 'question'),
      node('a2', 'answer'),
    ];
    const edges = [
      edge('e1', 's', 'q1'),
      edge('e2', 'q1', 'a1'),
      edge('e3', 'a1', 'q2'),
      edge('e4', 'q2', 'a2'),
    ];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    expect(outline.map((e) => e.nodeId)).toEqual(['s', 'q1', 'a1', 'q2', 'a2']);
    expect(outline.map((e) => e.depth)).toEqual([0, 1, 2, 3, 4]);
    // hasChildren mirrors outgoing degree
    expect(outline.map((e) => e.hasChildren)).toEqual([true, true, true, true, false]);
  });

  it('emits each branch subtree directly under its parent (DFS)', () => {
    const nodes = [
      node('s', 'start'),
      node('q1', 'question'),
      node('q2', 'question'),
      node('a1', 'answer'),
      node('a2', 'answer'),
      node('end', 'text-block'),
    ];
    const edges = [
      edge('e1', 's', 'q1'),
      edge('e2', 's', 'q2'),
      edge('e3', 'q1', 'a1'),
      edge('e4', 'q2', 'a2'),
      edge('e5', 'a1', 'end'),
      edge('e6', 'a2', 'end'), // join — folded into the first visit
    ];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    // First branch (q1 → a1) completes before the second branch starts;
    // the shared successor `end` appears inside the first branch only.
    expect(outline.map((e) => e.nodeId)).toEqual(['s', 'q1', 'a1', 'end', 'q2', 'a2']);
    expect(new Set(outline.map((e) => e.nodeId)).size).toBe(6);
  });

  it('folds joins and cycles into the first visit (each node exactly once)', () => {
    const nodes = [
      node('s', 'start'),
      node('q1', 'question'),
      node('q2', 'question'),
      node('a1', 'answer'),
    ];
    const edges = [
      edge('e1', 's', 'q1'),
      edge('e2', 'q1', 'q2'),
      edge('e3', 'q2', 'a1'),
      edge('e4', 'a1', 'q1'), // cycle back
      edge('e5', 'q2', 'q1'), // join back
    ];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    const ids = outline.map((e) => e.nodeId).sort();
    expect(ids).toEqual(['a1', 'q1', 'q2', 's']);
    // No duplicates
    expect(new Set(outline.map((e) => e.nodeId)).size).toBe(outline.length);
  });

  it('appends unreachable fragments after reachable nodes', () => {
    const nodes = [
      node('orphanA', 'text-block'),
      node('s', 'start'),
      node('orphanB', null),
      node('q1', 'question'),
    ];
    const edges = [edge('e1', 's', 'q1')];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    expect(outline.slice(0, 2).map((e) => e.nodeId)).toEqual(['s', 'q1']);
    expect(outline.slice(2).map((e) => e.nodeId)).toEqual(['orphanA', 'orphanB']);
  });

  it('falls back to the first node when there is no start node', () => {
    const nodes = [node('q1', 'question'), node('a1', 'answer')];
    const edges = [edge('e1', 'q1', 'a1')];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    expect(outline[0]!.nodeId).toBe('q1');
    expect(outline[0]!.depth).toBe(0);
  });

  it('ignores dangling edges referencing missing nodes', () => {
    const nodes = [node('s', 'start'), node('q1', 'question')];
    const edges = [
      edge('e1', 's', 'missing'),
      edge('e2', 'ghost', 'q1'),
    ];
    const outline = buildProtocolEditorOutline(nodes, edges, titleOf);
    expect(outline.map((e) => e.nodeId)).toEqual(['s', 'q1']);
    expect(outline[0]!.hasChildren).toBe(false);
  });
});
