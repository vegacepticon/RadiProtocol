import { describe, expect, it } from 'vitest';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';
import { ProtocolRunner } from '../../runner/protocol-runner';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['seed', {
      id: 'seed', kind: 'text-block', content: 'Before',
      x: 0, y: 60, width: 100, height: 60,
    }],
    ['question', {
      id: 'question', kind: 'question', questionText: 'Choose',
      x: 0, y: 120, width: 100, height: 60,
    }],
    ['free', {
      id: 'free', kind: 'answer', answerText: 'Describe the finding', freeText: true,
      radiprotocol_separator: 'space', x: 0, y: 180, width: 100, height: 60,
    }],
    ['tail', {
      id: 'tail', kind: 'text-block', content: 'Tail', radiprotocol_separator: 'newline',
      x: 0, y: 240, width: 100, height: 60,
    }],
    ['preset', {
      id: 'preset', kind: 'answer', answerText: 'Preset', freeText: false,
      x: 120, y: 180, width: 100, height: 60,
    }],
    ['auto-free', {
      id: 'auto-free', kind: 'answer', answerText: 'Prompt only', freeText: true,
      x: 120, y: 240, width: 100, height: 60,
    }],
    ['next', {
      id: 'next', kind: 'question', questionText: 'Next',
      x: 0, y: 320, width: 100, height: 60,
    }],
  ]);
  const edges: RPEdge[] = [
    { id: 'e-start-seed', fromNodeId: 'start', toNodeId: 'seed' },
    { id: 'e-seed-question', fromNodeId: 'seed', toNodeId: 'question' },
    { id: 'e-question-free', fromNodeId: 'question', toNodeId: 'free' },
    { id: 'e-free-tail', fromNodeId: 'free', toNodeId: 'tail' },
    { id: 'e-tail-next', fromNodeId: 'tail', toNodeId: 'next' },
    { id: 'e-question-preset', fromNodeId: 'question', toNodeId: 'preset' },
    { id: 'e-preset-auto-free', fromNodeId: 'preset', toNodeId: 'auto-free' },
    { id: 'e-auto-free-next', fromNodeId: 'auto-free', toNodeId: 'next' },
  ];
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'free-text-answer.rp.json',
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

describe('ProtocolRunner free-text Answers', () => {
  it('preserves accepted whitespace, applies the Answer separator, and includes automatic output', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());

    expect(runner.chooseAnswer('free', '  custom\nvalue  ')).toBe(true);

    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before   custom\nvalue  \nTail',
    });
  });

  it.each([undefined, '', '   ', '\n\t '])(
    'rejects blank payload %p without clearing redo or mutating history/state',
    (payload) => {
      const runner = new ProtocolRunner();
      runner.start(makeGraph());
      expect(runner.chooseAnswer('preset')).toBe(true);
      runner.stepBack();
      const before = runner.getState();
      expect(before).toMatchObject({
        status: 'at-node',
        currentNodeId: 'question',
        accumulatedText: 'Before',
        canStepBack: false,
        canRedo: true,
      });

      expect(runner.chooseAnswer('free', payload)).toBe(false);
      expect(runner.getState()).toEqual(before);

      runner.redo();
      expect(runner.getState()).toMatchObject({
        status: 'at-node',
        currentNodeId: 'next',
        accumulatedText: 'Before\nPreset',
      });
    },
  );

  it('undoes and redoes the submitted payload plus automatic traversal as one snapshot', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());
    runner.chooseAnswer('free', 'finding');

    runner.stepBack();
    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'question',
      accumulatedText: 'Before',
      canRedo: true,
    });

    runner.redo();
    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before finding\nTail',
      canRedo: false,
    });
  });

  it('ignores a submitted payload for preset Answers and never inserts an auto-traversed free-text prompt', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());

    expect(runner.chooseAnswer('preset', 'Injected')).toBe(true);

    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before\nPreset',
    });
  });
});
