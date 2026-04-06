import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../runner/protocol-runner';
import { CanvasParser } from '../graph/canvas-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, 'fixtures');
function loadGraph(name: string) {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

describe('ProtocolRunner extensions (RUN-11, D-04, D-05, D-07)', () => {
  it('RUN-11 / D-04: ProtocolRunner has setAccumulatedText method (RED until Plan 02)', () => {
    expect(typeof (ProtocolRunner.prototype as unknown as Record<string, unknown>)['setAccumulatedText']).toBe('function');
  });

  it('D-05: setAccumulatedText clears the undo stack (RED until Plan 02)', () => {
    const graph = loadGraph('linear.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    // Navigate one step to create an undo entry
    const state = runner.getState();
    if (state.status === 'at-node') {
      const node = graph.nodes.get(state.currentNodeId);
      if (node?.kind === 'question') {
        const answerIds = graph.adjacency.get(state.currentNodeId) ?? [];
        if (answerIds[0] !== undefined) runner.chooseAnswer(answerIds[0]);
      }
    }
    // Now call setAccumulatedText — should clear undo
    ((runner as unknown as Record<string, unknown>)['setAccumulatedText'] as (t: string) => void)('Custom text');
    const afterState = runner.getState();
    if (afterState.status === 'at-node') {
      expect(afterState.canStepBack).toBe(false);
    }
    expect(runner.getState().status).not.toBe('idle');
  });

  it('D-07: start() accepts optional startNodeId parameter (RED until Plan 02)', () => {
    // Use two-questions fixture: normal traversal lands on n-q1, but we want to start from n-q2.
    // Without the startNodeId feature, runner.start(graph, 'n-q2') ignores 'n-q2' and
    // lands on n-q1 — causing currentNodeId !== 'n-q2' → assertion failure (RED).
    const graph = loadGraph('two-questions.canvas');
    const runner = new ProtocolRunner();
    const startNodeId = 'n-q2'; // Second question — unreachable without startNodeId support
    ((runner as unknown as Record<string, unknown>)['start'] as (g: typeof graph, s: string) => void)(graph, startNodeId);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status === 'at-node') {
      expect(state.currentNodeId).toBe(startNodeId);
    }
  });
});
