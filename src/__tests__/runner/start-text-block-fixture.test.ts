import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import { startTextBlockGraph } from '../fixtures/protocol-document-fixtures';

describe('BUG: start -> text-block (raw.text fallback) -> question', () => {
  it('text-block without radiprotocol_content uses raw.text and is not skipped', () => {
    const graph = startTextBlockGraph();
    const runner = new ProtocolRunner();
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    expect(state.accumulatedText).toBe('Hello from text-block');
  });
});