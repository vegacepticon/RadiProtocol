// src/__tests__/edge-label-reconciler.test.ts
// Phase 50: pure-module tests for edge-label reconciler (D-04/D-07/D-08/D-09/D-18).
// Fixture-loader pattern mirrors canvas-parser.test.ts:1-10.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';
import { reconcileEdgeLabels } from '../graph/edge-label-reconciler';
import type { ProtocolGraph, RPNode, RPEdge } from '../graph/graph-model';

const fixturesDir = path.join(__dirname, 'fixtures');
const loadFixture = (n: string) => fs.readFileSync(path.join(fixturesDir, n), 'utf-8');

type MakeGraphParams = {
  answers: Array<{ id: string; displayLabel?: string; answerText?: string }>;
  questions?: Array<{ id: string; text?: string }>;
  edges: RPEdge[];
};

function makeGraph(params: MakeGraphParams): ProtocolGraph {
  const nodes = new Map<string, RPNode>();
  nodes.set('start', {
    id: 'start',
    kind: 'start',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
  });
  for (const q of params.questions ?? []) {
    nodes.set(q.id, {
      id: q.id,
      kind: 'question',
      questionText: q.text ?? q.id,
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
  }
  for (const a of params.answers) {
    nodes.set(a.id, {
      id: a.id,
      kind: 'answer',
      answerText: a.answerText ?? a.id,
      displayLabel: a.displayLabel,
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    });
  }
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const e of params.edges) {
    if (!adjacency.has(e.fromNodeId)) adjacency.set(e.fromNodeId, []);
    adjacency.get(e.fromNodeId)!.push(e.toNodeId);
    if (!reverseAdjacency.has(e.toNodeId)) reverseAdjacency.set(e.toNodeId, []);
    reverseAdjacency.get(e.toNodeId)!.push(e.fromNodeId);
  }
  return {
    canvasFilePath: 'test.canvas',
    nodes,
    edges: params.edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

describe('reconcileEdgeLabels — D-04 edge-wins', () => {
  it('picks first non-empty incoming label when displayLabel differs', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'X' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1', label: 'Y' },
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    expect(newDisplayLabelByAnswerId.get('a1')).toBe('Y');
    // Edge already has "Y" — no edge diff needed
    expect(diffs).toHaveLength(0);
  });

  it('multi-incoming: re-syncs every OTHER incoming edge to picked label', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('branching-multi-incoming.canvas'),
      'branching-multi-incoming.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(parseResult.graph);
    // First labeled incoming wins — e1 carries "Вариант X"
    expect(newDisplayLabelByAnswerId.get('n-a-shared')).toBe('Вариант X');
    // Only e2 ("Вариант Y") needs to be re-synced to "Вариант X"
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e2');
    expect(diffs[0]!.targetLabel).toBe('Вариант X');
  });

  it('displayLabel wins when no incoming edge is labeled', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' }, // no label
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    // displayLabel already 'A' → no newDisplayLabel entry
    expect(newDisplayLabelByAnswerId.size).toBe(0);
    // Edge must be propagated to 'A'
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
  });
});

describe('reconcileEdgeLabels — D-07 idempotency', () => {
  it('returns empty diffs + empty map when all labels already match', () => {
    // two-questions.canvas: each Answer has its own incoming edge (no label set)
    // AND a displayLabel. Under the D-04 fallback rule, pickedLabel = displayLabel,
    // but the incoming edge currently has no label → diff propagates displayLabel onto it.
    // So this is NOT zero-diff. We build a purpose-built zero-diff graph instead.
    const graph = makeGraph({
      questions: [{ id: 'q1' }, { id: 'q2' }],
      answers: [
        { id: 'a1', displayLabel: 'One' },
        { id: 'a2', displayLabel: 'Two' },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1', label: 'One' },
        { id: 'e2', fromNodeId: 'q2', toNodeId: 'a2', label: 'Two' },
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    expect(diffs).toHaveLength(0);
    expect(newDisplayLabelByAnswerId.size).toBe(0);
  });
});

describe('reconcileEdgeLabels — D-08 / D-09 clearing', () => {
  it('all incoming edges empty + displayLabel empty → fully idempotent (empty diff)', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1' }], // displayLabel undefined
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' }, // no label
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    expect(diffs).toHaveLength(0);
    expect(newDisplayLabelByAnswerId.size).toBe(0);
  });

  it('all incoming edges empty + displayLabel present → diff propagates displayLabel onto edges', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    // displayLabel already 'A' — no change entry
    expect(newDisplayLabelByAnswerId.size).toBe(0);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
  });

  it('all incoming edges whitespace-only label → treated as unlabeled (Phase 49 D-05 reuse)', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1', label: '   ' },
      ],
    });
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);
    // Whitespace ≡ unlabeled → fallback to displayLabel "A"
    expect(newDisplayLabelByAnswerId.size).toBe(0);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
  });
});

describe('reconcileEdgeLabels — fixture: displayLabel-edge-mismatch', () => {
  it('cold-open: edge.label "Y" beats displayLabel "X" — picks Y', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('displayLabel-edge-mismatch.canvas'),
      'displayLabel-edge-mismatch.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(parseResult.graph);
    expect(newDisplayLabelByAnswerId.get('n-a1')).toBe('Y');
    // Edge already "Y" → no edge diff
    expect(diffs).toHaveLength(0);
  });
});

describe('reconcileEdgeLabels — fixture: branching-multi-incoming', () => {
  it('three-way conflict: displayLabel "Старое" vs edges "Вариант X" and "Вариант Y" → edge-wins picks X, resyncs Y→X', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('branching-multi-incoming.canvas'),
      'branching-multi-incoming.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(parseResult.graph);
    expect(newDisplayLabelByAnswerId.get('n-a-shared')).toBe('Вариант X');
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e2');
    expect(diffs[0]!.targetLabel).toBe('Вариант X');
  });
});

describe('reconcileEdgeLabels has zero Obsidian API imports (D-18)', () => {
  it('module can be imported without Obsidian runtime', () => {
    expect(typeof reconcileEdgeLabels).toBe('function');
  });
});

describe('reconcileEdgeLabels — deterministic iteration order', () => {
  it('uses graph.edges array order (not Set order) for first-non-empty pick', () => {
    // Same two incoming edges, differing insertion order in graph.edges[] — pick changes.
    const graphA = makeGraph({
      questions: [{ id: 'q1' }, { id: 'q2' }],
      answers: [{ id: 'a', displayLabel: 'Старое' }],
      edges: [
        { id: 'eA', fromNodeId: 'q1', toNodeId: 'a', label: 'FIRST' },
        { id: 'eB', fromNodeId: 'q2', toNodeId: 'a', label: 'SECOND' },
      ],
    });
    const resultA = reconcileEdgeLabels(graphA);
    expect(resultA.newDisplayLabelByAnswerId.get('a')).toBe('FIRST');
    expect(resultA.diffs).toHaveLength(1);
    expect(resultA.diffs[0]!.edgeId).toBe('eB');
    expect(resultA.diffs[0]!.targetLabel).toBe('FIRST');

    const graphB = makeGraph({
      questions: [{ id: 'q1' }, { id: 'q2' }],
      answers: [{ id: 'a', displayLabel: 'Старое' }],
      edges: [
        { id: 'eB', fromNodeId: 'q2', toNodeId: 'a', label: 'SECOND' },
        { id: 'eA', fromNodeId: 'q1', toNodeId: 'a', label: 'FIRST' },
      ],
    });
    const resultB = reconcileEdgeLabels(graphB);
    expect(resultB.newDisplayLabelByAnswerId.get('a')).toBe('SECOND');
    expect(resultB.diffs).toHaveLength(1);
    expect(resultB.diffs[0]!.edgeId).toBe('eA');
    expect(resultB.diffs[0]!.targetLabel).toBe('SECOND');
  });
});
