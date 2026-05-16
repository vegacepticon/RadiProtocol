import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import { unifiedLoopValidGraph } from '../fixtures/protocol-document-fixtures';


/** Phase 66 D-01: between sync stepBack calls, flush the microtask so _stepBackInFlight resets. */
async function backOnce(runner: ProtocolRunner): Promise<void> {
  runner.stepBack();
  await Promise.resolve();
}

describe('Phase 66 D-08 — back × N roundtrip over canonical unified-loop-valid sequence', () => {
  // canonical forward sequence (length 3) over unified-loop-valid.canvas:
  // 0: start -> halt at awaiting-loop-pick (n-loop)
  // 1: chooseLoopBranch('e2')   -> at-node n-q1
  // 2: chooseAnswer('n-a1')     -> awaiting-loop-pick iter=2
  // 3: chooseLoopBranch('e3')   -> complete (exit edge)
  // Honest scope: this is a single deterministic sequence, not a property
  // over arbitrary forward paths.

  const FORWARD_STEPS: Array<(r: ProtocolRunner) => void> = [
    (r) => r.chooseLoopBranch('e2'),
    (r) => r.chooseAnswer('n-a1'),
    (r) => r.chooseLoopBranch('e3'),
  ];

  it('Test I: back × N restores accumulated text to initial empty string for N in {1, 2, 3}', async () => {
    for (const N of [1, 2, 3]) {
      const runner = new ProtocolRunner();
      runner.start(unifiedLoopValidGraph());
      for (let i = 0; i < N; i++) FORWARD_STEPS[i]!(runner);
      for (let i = 0; i < N; i++) await backOnce(runner);
      const state = runner.getState();
      // Always halts at the same place as post-start (awaiting-loop-pick @ n-loop)
      expect(state.status).toBe('awaiting-loop-pick');
      if (state.status !== 'awaiting-loop-pick') return;
      expect(state.accumulatedText).toBe('');
      expect(state.nodeId).toBe('n-loop');
    }
  });

  it('Test J: back × 3 then forward × 3 reaches the same final state as forward × 3', async () => {
    // First pass: forward × 3 → snapshot
    const r1 = new ProtocolRunner();
    r1.start(unifiedLoopValidGraph());
    for (const step of FORWARD_STEPS) step(r1);

    // Second pass: forward × 3 → back × 3 → forward × 3 → compare
    const r2 = new ProtocolRunner();
    r2.start(unifiedLoopValidGraph());
    for (const step of FORWARD_STEPS) step(r2);
    for (let i = 0; i < 3; i++) await backOnce(r2);
    for (const step of FORWARD_STEPS) step(r2);

    // Phase 66 D-08 — defensive assertion: confirm both runners reached
    // 'complete' BEFORE the deep-equal so a forward-sequence divergence
    // fails with a readable message rather than an opaque toEqual diff.
    expect(r1.getState().status).toBe('complete');
    expect(r2.getState().status).toBe('complete');

    // After exit edge `e3`, the runner is in 'complete' — getSerializableState returns null.
    // For the final equivalence check, compare getState() instead.
    expect(r1.getState()).toEqual(r2.getState());
  });

  it('Test K: back × (N+1) from a fully-rewound runner is a no-op past N', async () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopValidGraph());
    for (const step of FORWARD_STEPS) step(runner);
    // back × 4 fully rewinds (1 loop-entry undo + 3 user-action undos)
    for (let i = 0; i < 4; i++) await backOnce(runner);
    const stateAfter4 = runner.getState();
    // 5th back is a no-op (undoStack empty)
    await backOnce(runner);
    const stateAfter5 = runner.getState();
    expect(stateAfter5).toEqual(stateAfter4);
  });
});
