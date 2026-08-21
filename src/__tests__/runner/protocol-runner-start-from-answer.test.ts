// protocol-runner-start-from-answer.test.ts
// Start-from-node contract for Answer nodes:
//   - a preset Answer chosen as the explicit start node auto-appends its
//     answerText and advances (host flushes the initial buffer to the note);
//   - a free-text Answer chosen as the explicit start node HALTS at at-node so
//     the radiologist submits the report text; chooseAnswer accepts it.
import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';

const base = { x: 0, y: 0, width: 10, height: 10 };

function graph(nodes: RPNode[], edges: RPEdge[], startNodeId = 'start'): ProtocolGraph {
  const map = new Map<string, RPNode>();
  for (const n of nodes) map.set(n.id, n);
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.fromNodeId);
    if (list === undefined) adjacency.set(e.fromNodeId, [e.toNodeId]);
    else list.push(e.toNodeId);
  }
  return {
    canvasFilePath: 'test.rp.json',
    nodes: map,
    edges,
    adjacency,
    reverseAdjacency: new Map(),
    startNodeId,
  };
}

describe('ProtocolRunner.start with an explicit Answer start node', () => {
  it('preset Answer: appends answerText and halts at the next node', () => {
    const g = graph(
      [
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'a1', kind: 'answer', answerText: 'ANSWER_VALUE', displayLabel: 'A1' },
        { ...base, id: 'q1', kind: 'question', questionText: 'Q1' },
      ],
      [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'a1', toNodeId: 'q1' },
      ],
    );
    const runner = new ProtocolRunner();
    runner.start(g, 'a1');
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('ANSWER_VALUE');
  });

  it('free-text Answer: HALTS on the answer itself instead of passing through', () => {
    const g = graph(
      [
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'a1', kind: 'answer', answerText: 'Prompt text', displayLabel: 'A1', freeText: true },
        { ...base, id: 'q1', kind: 'question', questionText: 'Q1' },
      ],
      [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'a1', toNodeId: 'q1' },
      ],
    );
    const runner = new ProtocolRunner();
    runner.start(g, 'a1');
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    // Halted ON the answer, accumulator still empty — prompt not appended.
    expect(state.currentNodeId).toBe('a1');
    expect(state.accumulatedText).toBe('');
  });

  it('free-text Answer start: chooseAnswer accepts submitted text and advances past the answer', async () => {
    const g = graph(
      [
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'a1', kind: 'answer', answerText: 'Prompt text', displayLabel: 'A1', freeText: true },
        { ...base, id: 'q1', kind: 'question', questionText: 'Q1' },
      ],
      [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'a1', toNodeId: 'q1' },
      ],
    );
    const runner = new ProtocolRunner();
    runner.start(g, 'a1');
    const accepted = runner.chooseAnswer('a1', 'Submitted conclusion');
    expect(accepted).toBe(true);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('Submitted conclusion');
  });

  it('normal flow is unaffected: a free-text Answer mid-chain still passes through silently', () => {
    const g = graph(
      [
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'a1', kind: 'answer', answerText: 'Prompt', displayLabel: 'A1', freeText: true },
        { ...base, id: 'q1', kind: 'question', questionText: 'Q1' },
      ],
      [
        { id: 'e1', fromNodeId: 'start', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'a1', toNodeId: 'q1' },
      ],
    );
    const runner = new ProtocolRunner();
    runner.start(g); // default start — no explicit answer start node
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('');
  });
});
