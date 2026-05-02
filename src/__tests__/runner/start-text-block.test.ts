import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { ProtocolGraph } from '../../graph/graph-model';

describe('BUG: start -> text-block -> question', () => {
  it('should NOT skip text-block after start — text content must be accumulated', () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'start-tb-q.canvas',
      nodes: new Map([
        ['s', { id: 's', kind: 'start' as const, x: 0, y: 0, width: 100, height: 60 }],
        ['tb1', { id: 'tb1', kind: 'text-block' as const, content: 'Hello from text-block', x: 0, y: 60, width: 100, height: 60 }],
        ['q1', { id: 'q1', kind: 'question' as const, questionText: 'Q1', x: 0, y: 120, width: 100, height: 60 }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 's', toNodeId: 'tb1' },
        { id: 'e2', fromNodeId: 'tb1', toNodeId: 'q1' },
      ],
      adjacency: new Map([
        ['s', ['tb1']],
        ['tb1', ['q1']],
      ]),
      reverseAdjacency: new Map([
        ['tb1', ['s']],
        ['q1', ['tb1']],
      ]),
      startNodeId: 's',
    };

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('Hello from text-block');
  });

  it('should NOT skip text-block after start even with two text-blocks', () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'start-tb-tb-q.canvas',
      nodes: new Map([
        ['s', { id: 's', kind: 'start' as const, x: 0, y: 0, width: 100, height: 60 }],
        ['tb1', { id: 'tb1', kind: 'text-block' as const, content: 'First block', x: 0, y: 60, width: 100, height: 60 }],
        ['tb2', { id: 'tb2', kind: 'text-block' as const, content: 'Second block', x: 0, y: 120, width: 100, height: 60 }],
        ['q1', { id: 'q1', kind: 'question' as const, questionText: 'Q1', x: 0, y: 180, width: 100, height: 60 }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 's', toNodeId: 'tb1' },
        { id: 'e2', fromNodeId: 'tb1', toNodeId: 'tb2' },
        { id: 'e3', fromNodeId: 'tb2', toNodeId: 'q1' },
      ],
      adjacency: new Map([
        ['s', ['tb1']],
        ['tb1', ['tb2']],
        ['tb2', ['q1']],
      ]),
      reverseAdjacency: new Map([
        ['tb1', ['s']],
        ['tb2', ['tb1']],
        ['q1', ['tb2']],
      ]),
      startNodeId: 's',
    };

    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('First block\nSecond block');
  });

  it('start with explicit startNodeId pointing at text-block should still append text-block content', () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'start-tb-q-explicit.canvas',
      nodes: new Map([
        ['s', { id: 's', kind: 'start' as const, x: 0, y: 0, width: 100, height: 60 }],
        ['tb1', { id: 'tb1', kind: 'text-block' as const, content: 'Explicit start', x: 0, y: 60, width: 100, height: 60 }],
        ['q1', { id: 'q1', kind: 'question' as const, questionText: 'Q1', x: 0, y: 120, width: 100, height: 60 }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 's', toNodeId: 'tb1' },
        { id: 'e2', fromNodeId: 'tb1', toNodeId: 'q1' },
      ],
      adjacency: new Map([
        ['s', ['tb1']],
        ['tb1', ['q1']],
      ]),
      reverseAdjacency: new Map([
        ['tb1', ['s']],
        ['q1', ['tb1']],
      ]),
      startNodeId: 's',
    };

    const runner = new ProtocolRunner();
    runner.start(graph, 'tb1'); // explicit start from text-block
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');
    expect(state.accumulatedText).toBe('Explicit start');
  });
});
