import { describe, expect, it } from 'vitest';
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';
import { ProtocolRunner } from '../../runner/protocol-runner';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['prior', { id: 'prior', kind: 'text-block', content: 'Prior', x: 0, y: 60, width: 100, height: 60 }],
    ['q-source', { id: 'q-source', kind: 'question', questionText: 'Source?', x: 0, y: 120, width: 100, height: 60 }],
    ['q-target', { id: 'q-target', kind: 'question', questionText: 'Target?', x: 0, y: 180, width: 100, height: 60 }],
    ['q-loop', { id: 'q-loop', kind: 'question', questionText: 'Repeat?', loop: true, x: 0, y: 240, width: 100, height: 60 }],
    ['answer', { id: 'answer', kind: 'answer', answerText: 'Answer', x: 0, y: 300, width: 100, height: 60 }],
  ]);
  return {
    canvasFilePath: 'question-branch.rp.json',
    nodes,
    edges: [
      { id: 'e-start', fromNodeId: 'start', toNodeId: 'prior' },
      { id: 'e-prior', fromNodeId: 'prior', toNodeId: 'q-source' },
      { id: 'e-target', fromNodeId: 'q-source', toNodeId: 'q-target', label: 'Continue' },
      { id: 'e-loop', fromNodeId: 'q-source', toNodeId: 'q-loop' },
      { id: 'e-answer', fromNodeId: 'q-source', toNodeId: 'answer' },
      { id: 'e-wrong-source', fromNodeId: 'q-target', toNodeId: 'q-source' },
      { id: 'e-missing-target', fromNodeId: 'q-source', toNodeId: 'missing' },
      { id: 'e-loop-source', fromNodeId: 'q-loop', toNodeId: 'q-target' },
    ],
    adjacency: new Map([
      ['start', ['prior']],
      ['prior', ['q-source']],
      ['q-source', ['q-target', 'q-loop', 'answer']],
      ['q-target', ['q-source']],
      ['q-loop', ['q-target']],
    ]),
    reverseAdjacency: new Map([
      ['prior', ['start']],
      ['q-source', ['prior', 'q-target']],
      ['q-target', ['q-source', 'q-loop']],
      ['q-loop', ['q-source']],
      ['answer', ['q-source']],
    ]),
    startNodeId: 'start',
  };
}

function startAtSource(): ProtocolRunner {
  const runner = new ProtocolRunner();
  runner.start(makeGraph());
  const state = runner.getState();
  expect(state.status).toBe('at-node');
  if (state.status === 'at-node') {
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
  }
  return runner;
}

describe('ProtocolRunner — direct Question transition', () => {
  it('selects an edge by ID, preserves text, and captures one undo snapshot', () => {
    const runner = startAtSource();

    runner.chooseQuestionBranch('e-target');

    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-target');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
    expect(state.canStepBack).toBe(true);
  });

  it('round-trips the selected transition through stepBack and redo', async () => {
    const runner = startAtSource();
    runner.chooseQuestionBranch('e-target');

    runner.stepBack();
    await Promise.resolve();
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.canRedo).toBe(true);

    runner.redo();
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-target');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
  });

  it('clears redo history after a new direct transition', () => {
    const runner = startAtSource();
    runner.chooseQuestionBranch('e-target');
    runner.stepBack();
    const rewound = runner.getState();
    expect(rewound.status).toBe('at-node');
    if (rewound.status !== 'at-node') return;
    expect(rewound.canRedo).toBe(true);

    runner.chooseQuestionBranch('e-loop');

    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.canRedo).toBe(false);
  });

  it('enters a looped Question as one undoable user action', async () => {
    const runner = startAtSource();

    runner.chooseQuestionBranch('e-loop');

    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('q-loop');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
    expect(runner.getSerializableState()?.loopContextStack).toEqual([
      { loopNodeId: 'q-loop', iteration: 1, textBeforeLoop: 'Prior' },
    ]);

    runner.stepBack();
    await Promise.resolve();
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
    expect(runner.getSerializableState()?.loopContextStack).toEqual([]);
  });

  it.each(['missing-edge', 'e-wrong-source', 'e-answer', 'e-missing-target'])(
    'rejects invalid selection %s before clearing redo or pushing undo',
    (edgeId) => {
      const runner = startAtSource();
      runner.chooseQuestionBranch('e-target');
      runner.stepBack();
      const rewound = runner.getState();
      expect(rewound.status).toBe('at-node');
      if (rewound.status !== 'at-node') return;
      expect(rewound.canRedo).toBe(true);
      expect(rewound.undoStackSize).toBe(0);

      runner.chooseQuestionBranch(edgeId);
      expect(runner.getState().status).toBe('error');

      runner.redo();
      const restored = runner.getState();
      expect(restored.status).toBe('at-node');
      if (restored.status !== 'at-node') return;
      expect(restored.currentNodeId).toBe('q-target');
      expect(restored.undoStackSize).toBe(1);
    },
  );

  it('rejects an at-node snapshot whose current source is looped', () => {
    const graph = makeGraph();
    const runner = new ProtocolRunner();
    runner.setGraph(graph);
    runner.restoreFrom({
      runnerStatus: 'at-node',
      currentNodeId: 'q-loop',
      accumulatedText: 'Prior',
      undoStack: [],
      loopContextStack: [],
      snippetId: null,
      snippetNodeId: null,
    });

    runner.chooseQuestionBranch('e-loop-source');

    expect(runner.getState().status).toBe('error');
  });
});