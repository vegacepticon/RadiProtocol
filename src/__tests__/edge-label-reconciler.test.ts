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
  // Phase 63: snippet nodes for the snippet edge-wins arm.
  snippets?: Array<{ id: string; snippetLabel?: string; subfolderPath?: string }>;
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
  // Phase 63: emit SnippetNode entries when params.snippets is provided.
  for (const s of params.snippets ?? []) {
    nodes.set(s.id, {
      id: s.id,
      kind: 'snippet',
      snippetLabel: s.snippetLabel,
      subfolderPath: s.subfolderPath,
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    // Phase 63: kind discriminator
    expect(nodeChanges.find(c => c.nodeId === 'a1' && c.kind === 'answer')?.newLabel).toBe('Y');
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(parseResult.graph); // Phase 63: kind discriminator
    // First labeled incoming wins — e1 carries "Вариант X"
    // Phase 63: kind discriminator
    expect(nodeChanges.find(c => c.nodeId === 'n-a-shared' && c.kind === 'answer')?.newLabel).toBe('Вариант X');
    // Only e2 ("Вариант Y") needs to be re-synced to "Вариант X"
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e2');
    expect(diffs[0]!.targetLabel).toBe('Вариант X');
    expect(diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
  });

  it('displayLabel wins when no incoming edge is labeled', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' }, // no label
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    // displayLabel already 'A' → no newDisplayLabel entry
    // Phase 63: kind discriminator
    expect(nodeChanges.filter(c => c.kind === 'answer').length).toBe(0);
    // Edge must be propagated to 'A'
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
    expect(diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    expect(diffs).toHaveLength(0);
    // Phase 63: kind discriminator
    expect(nodeChanges.filter(c => c.kind === 'answer').length).toBe(0);
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    expect(diffs).toHaveLength(0);
    // Phase 63: kind discriminator
    expect(nodeChanges.filter(c => c.kind === 'answer').length).toBe(0);
  });

  it('all incoming edges empty + displayLabel present → diff propagates displayLabel onto edges', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    // displayLabel already 'A' — no change entry
    // Phase 63: kind discriminator
    expect(nodeChanges.filter(c => c.kind === 'answer').length).toBe(0);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
    expect(diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
  });

  it('all incoming edges whitespace-only label → treated as unlabeled (Phase 49 D-05 reuse)', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'A' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1', label: '   ' },
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph); // Phase 63: kind discriminator
    // Whitespace ≡ unlabeled → fallback to displayLabel "A"
    // Phase 63: kind discriminator
    expect(nodeChanges.filter(c => c.kind === 'answer').length).toBe(0);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e1');
    expect(diffs[0]!.targetLabel).toBe('A');
    expect(diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(parseResult.graph); // Phase 63: kind discriminator
    // Phase 63: kind discriminator
    expect(nodeChanges.find(c => c.nodeId === 'n-a1' && c.kind === 'answer')?.newLabel).toBe('Y');
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
    const { diffs, nodeChanges } = reconcileEdgeLabels(parseResult.graph); // Phase 63: kind discriminator
    // Phase 63: kind discriminator
    expect(nodeChanges.find(c => c.nodeId === 'n-a-shared' && c.kind === 'answer')?.newLabel).toBe('Вариант X');
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.edgeId).toBe('e2');
    expect(diffs[0]!.targetLabel).toBe('Вариант X');
    expect(diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
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
    // Phase 63: kind discriminator
    expect(resultA.nodeChanges.find(c => c.nodeId === 'a' && c.kind === 'answer')?.newLabel).toBe('FIRST');
    expect(resultA.diffs).toHaveLength(1);
    expect(resultA.diffs[0]!.edgeId).toBe('eB');
    expect(resultA.diffs[0]!.targetLabel).toBe('FIRST');
    expect(resultA.diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator

    const graphB = makeGraph({
      questions: [{ id: 'q1' }, { id: 'q2' }],
      answers: [{ id: 'a', displayLabel: 'Старое' }],
      edges: [
        { id: 'eB', fromNodeId: 'q2', toNodeId: 'a', label: 'SECOND' },
        { id: 'eA', fromNodeId: 'q1', toNodeId: 'a', label: 'FIRST' },
      ],
    });
    const resultB = reconcileEdgeLabels(graphB);
    // Phase 63: kind discriminator
    expect(resultB.nodeChanges.find(c => c.nodeId === 'a' && c.kind === 'answer')?.newLabel).toBe('SECOND');
    expect(resultB.diffs).toHaveLength(1);
    expect(resultB.diffs[0]!.edgeId).toBe('eA');
    expect(resultB.diffs[0]!.targetLabel).toBe('SECOND');
    expect(resultB.diffs[0]!.kind).toBe('answer'); // Phase 63: kind discriminator
  });
});

// Phase 63: snippet edge-wins arm (mirror of Phase 50 Answer arm).
describe('reconcileEdgeLabels — snippet edge-wins (Phase 63)', () => {
  it('picks first non-empty incoming label when snippetLabel differs', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [],
      snippets: [{ id: 's1', snippetLabel: 'Старое' }],
      edges: [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 's1', label: 'Новое' },
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph);
    // Edge label "Новое" wins — snippetLabel must be propagated to "Новое".
    expect(nodeChanges).toContainEqual(expect.objectContaining({ nodeId: 's1', kind: 'snippet', newLabel: 'Новое' }));
    expect(nodeChanges.find(c => c.nodeId === 's1' && c.kind === 'snippet')?.newLabel).toBe('Новое');
    // Edge already has "Новое" — no edge diff.
    expect(diffs.filter(d => d.kind === 'snippet')).toHaveLength(0);
  });

  it('cold-open: snippetLabel="Брюшной отдел" + edge.label=undefined → diff propagates label onto edge (D-03)', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('snippet-cold-open-migration.canvas'),
      'snippet-cold-open-migration.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const { diffs, nodeChanges } = reconcileEdgeLabels(parseResult.graph);
    const snippetDiffs = diffs.filter(d => d.kind === 'snippet');
    // Edge "e1" has no label, snippetLabel "Брюшной отдел" wins as fallback.
    expect(snippetDiffs).toHaveLength(1);
    expect(snippetDiffs[0]!).toMatchObject({ edgeId: 'e1', targetLabel: 'Брюшной отдел', kind: 'snippet' });
    expect(snippetDiffs[0]!.edgeId).toBe('e1');
    expect(snippetDiffs[0]!.targetLabel).toBe('Брюшной отдел');
    expect(snippetDiffs[0]!.kind).toBe('snippet');
    // snippetLabel already matches the picked value → no nodeChange entry for the snippet.
    expect(nodeChanges.filter(c => c.nodeId === 'n-snip1' && c.kind === 'snippet').length).toBe(0);
  });

  it('multi-incoming: edge-wins picks first labeled, resyncs sibling edges + node (Вариант X wins)', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('branching-snippet-multi-incoming.canvas'),
      'branching-snippet-multi-incoming.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const { diffs, nodeChanges } = reconcileEdgeLabels(parseResult.graph);
    const snippetDiffs = diffs.filter(d => d.kind === 'snippet');
    // First labeled incoming wins — e1 carries "Вариант X".
    // Only e2 ("Вариант Y") needs to be re-synced to "Вариант X".
    expect(snippetDiffs).toHaveLength(1);
    expect(snippetDiffs[0]!).toMatchObject({ edgeId: 'e2', targetLabel: 'Вариант X', kind: 'snippet' });
    expect(snippetDiffs[0]!.edgeId).toBe('e2');
    expect(snippetDiffs[0]!.targetLabel).toBe('Вариант X');
    expect(snippetDiffs[0]!.kind).toBe('snippet');
    // snippetLabel "Старое" diverges → must be set to "Вариант X".
    expect(nodeChanges).toContainEqual(expect.objectContaining({ nodeId: 'n-snip-shared', kind: 'snippet', newLabel: 'Вариант X' }));
    expect(nodeChanges.find(c => c.nodeId === 'n-snip-shared' && c.kind === 'snippet')?.newLabel).toBe('Вариант X');
  });

  it('mixed Answer+Snippet incoming: both kinds reconcile in one pass with correct discriminator', () => {
    // One Question fans out to one Answer + one Snippet, both with diverging incoming labels.
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      answers: [{ id: 'a1', displayLabel: 'OldAnswer' }],
      snippets: [{ id: 's1', snippetLabel: 'OldSnippet' }],
      edges: [
        { id: 'eA', fromNodeId: 'q1', toNodeId: 'a1', label: 'NewAnswer' },
        { id: 'eS', fromNodeId: 'q1', toNodeId: 's1', label: 'NewSnippet' },
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph);
    // Each arm produces its own kinded nodeChange.
    expect(nodeChanges).toContainEqual(expect.objectContaining({ nodeId: 'a1', kind: 'answer', newLabel: 'NewAnswer' }));
    expect(nodeChanges).toContainEqual(expect.objectContaining({ nodeId: 's1', kind: 'snippet', newLabel: 'NewSnippet' }));
    expect(nodeChanges.find(c => c.nodeId === 'a1' && c.kind === 'answer')?.newLabel).toBe('NewAnswer');
    expect(nodeChanges.find(c => c.nodeId === 's1' && c.kind === 'snippet')?.newLabel).toBe('NewSnippet');
    // Edges already match the picked labels → no edge diffs (only node-side updates needed).
    expect(diffs).toHaveLength(0);
  });

  it('idempotency: snippet kind contributes to D-07 short-circuit', () => {
    // Every snippet edge already matches its snippetLabel → reconciler returns
    // structurally empty result for both arms.
    const graph = makeGraph({
      questions: [{ id: 'q1' }, { id: 'q2' }],
      answers: [{ id: 'a1', displayLabel: 'AnswerOK' }],
      snippets: [{ id: 's1', snippetLabel: 'SnippetOK' }],
      edges: [
        { id: 'eA', fromNodeId: 'q1', toNodeId: 'a1', label: 'AnswerOK' },
        { id: 'eS', fromNodeId: 'q2', toNodeId: 's1', label: 'SnippetOK' },
      ],
    });
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph);
    expect(diffs.length).toBe(0);
    expect(nodeChanges.length).toBe(0);
  });
});
