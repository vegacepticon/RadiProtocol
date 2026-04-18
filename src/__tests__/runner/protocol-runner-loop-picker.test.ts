import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../../graph/canvas-parser';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { ProtocolGraph } from '../../graph/graph-model';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function loadGraph(name: string): ProtocolGraph {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

// Phase 44 (RUN-01..RUN-05) — picker state-machine coverage.
// Each test pins a specific behaviour from Plan 02a runtime:
//   B1 — re-entry guard (top-of-stack check before frame push)
//   B2 — previousCursor threading (canStepBack=true even at first halt)
//   I1 — strengthened iteration-stack-length check (loopContextStack.length === 1)
//   W4 — long-body integration test (Pitfall 10 cycle-guard per-call reset)
describe('ProtocolRunner loop picker (RUN-01..RUN-05)', () => {

  it('RUN-01: halts at awaiting-loop-pick with loop node id after start() on unified-loop-valid.canvas', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('');
  });

  it('RUN-02: body-branch walks the branch; back-edge re-entry increments top frame iteration to 2 via the B1 guard WITHOUT pushing a second frame (B1 + I1 — single-point-increment semantic)', () => {
    const graph = loadGraph('unified-loop-valid.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    // Pick the body edge e2 ("проверка") — walks to n-q1
    runner.chooseLoopBranch('e2');
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    // Answer n-a1 → e5 back-edge → re-enter n-loop → B1 re-entry guard fires
    runner.chooseAnswer('n-a1');
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    // B1 invariant: ONLY one frame on the stack — re-entry did NOT push a second frame.
    // I1 strengthened: stack length assertion alongside iteration assertion.
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(1);
    expect(serialized.loopContextStack[0]?.iteration).toBe(2);
  });

  it('RUN-03: choosing «выход» pops frame and advances along exit edge', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    // e3 is the «выход» edge (n-loop → n-end, text-block terminal)
    runner.chooseLoopBranch('e3');
    const state = runner.getState();
    expect(state.status).toBe('complete');
    const serialized = runner.getSerializableState();
    // After complete, getSerializableState returns null — verify via getState shape only
    expect(serialized).toBeNull();
  });

  it('RUN-04: nested loops — inner «выход» returns to outer picker with SINGLE outer frame (B1 — loopContextStack.length === 1, not 2)', () => {
    const graph = loadGraph('unified-loop-nested.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-outer');
    // After first-halt at outer, exactly 1 frame on stack
    let serialized = runner.getSerializableState();
    expect(serialized?.loopContextStack.length).toBe(1);
    // Enter outer body (e2: n-outer → n-inner, «проверка»)
    runner.chooseLoopBranch('e2');
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-inner');
    // After walking into inner, 2 frames on stack (outer + inner).
    serialized = runner.getSerializableState();
    expect(serialized?.loopContextStack.length).toBe(2);
    // Inner «выход» (e5) points back to n-outer — inner frame pops, advanceThrough re-enters
    // n-outer, B1 re-entry guard fires on the existing outer frame (iteration increments).
    runner.chooseLoopBranch('e5');
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-outer');
    // B1 invariant: a single outer frame (NOT 2 — no duplicate outer from re-entry).
    serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(1);
    expect(serialized.loopContextStack[0]?.loopNodeId).toBe('n-outer');
    // Re-entry incremented outer's iteration to 2 (first entry: iteration=1; after re-entry: 2)
    expect(serialized.loopContextStack[0]?.iteration).toBe(2);
    // Outer «выход» (e3) → n-end → complete
    runner.chooseLoopBranch('e3');
    state = runner.getState();
    expect(state.status).toBe('complete');
  });

  it('RUN-05: step-back from loop picker restores pre-loop currentNodeId and accumulatedText; canStepBack=true via B2 even at first halt', () => {
    const graph = loadGraph('unified-loop-valid.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    // B2: first halt after start() on a loop — canStepBack is true because the loop-entry
    // pushes an undo entry regardless of previousCursor. (previousCursor was 'n-start' here
    // because start-node auto-advances through — but even in a start→loop-direct edge case
    // the entry would be pushed with nodeId=cursor as a no-op.)
    const picker = runner.getState();
    expect(picker.status).toBe('awaiting-loop-pick');
    if (picker.status !== 'awaiting-loop-pick') return;
    expect(picker.canStepBack).toBe(true);
    // Step back → restores to pre-loop state, loopContextStack cleared
    runner.stepBack();
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(0);
    expect(serialized.accumulatedText).toBe('');
  });

  // W4 — long-body integration test. Exercises Pitfall 10 (per-advanceThrough steps counter
  // resets each picker halt). 10 iterations × 10 text-blocks body should NOT trip the RUN-09
  // guard (ProtocolRunner.maxIterations default — typically 50). Each picker-halt round-trip
  // is one advanceThrough call; steps ≈ 11 per call (loop re-entry + 10 text-blocks) — well
  // under the 50 threshold because the steps counter resets every time advanceThrough is
  // re-entered via chooseLoopBranch.
  it('W4: long-body loop iterates 10 times without tripping RUN-09 auto-advance guard', () => {
    const graph = loadGraph('unified-loop-long-body.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    // Initial halt — iteration=1 (first loop-entry).
    // Iterate 10 times via chooseLoopBranch('e2') = the body branch.
    // Each call: body walk → 10 text-blocks auto-append → back-edge e13 → B1 re-entry → picker.
    // B1 increments iteration each re-entry; chooseLoopBranch body-branch does NOT increment.
    // After i picks: iteration = i + 1 (1 from initial entry + i increments from re-entries).
    for (let i = 1; i <= 10; i++) {
      runner.chooseLoopBranch('e2');
      state = runner.getState();
      expect(state.status).toBe('awaiting-loop-pick');
      if (state.status !== 'awaiting-loop-pick') return;
      // B1 invariant throughout — single frame only
      const serialized = runner.getSerializableState();
      expect(serialized?.loopContextStack.length).toBe(1);
      // Single-point-increment semantic — iteration = i + 1 after i picks.
      expect(serialized?.loopContextStack[0]?.iteration).toBe(i + 1);
    }
    // Exit cleanly on «выход» (e3)
    runner.chooseLoopBranch('e3');
    state = runner.getState();
    expect(state.status).toBe('complete');
  });
});

// Phase 47 RUNFIX-01 — manual textarea edits made while the runner is halted at an
// `awaiting-loop-pick` state must survive every loop-node transition (body-branch entry,
// «выход» exit, dead-end return via back-edge to picker, undo snapshot capture).
//
// Root cause: syncManualEdit() gate was `runnerStatus !== 'at-node'` only — so the call
// from runner-view.ts:479 (fired BEFORE chooseLoopBranch) was a silent no-op while halted
// at the loop picker. The undo snapshot captured inside chooseLoopBranch (line 190) then
// recorded the pre-edit accumulator text, and every post-transition render showed stale text.
//
// Fix: extend the valid-state set to include 'awaiting-loop-pick'. See protocol-runner.ts
// syncManualEdit() JSDoc for the full rationale.
describe('ProtocolRunner RUNFIX-01 — manual edits survive loop transitions', () => {

  it('RUNFIX-01 Test 1: body-branch entry preserves manual edit made at awaiting-loop-pick', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    // Halted at n-loop picker with empty accumulator
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.accumulatedText).toBe('');

    // Inject a manual textarea edit while halted at the picker
    runner.syncManualEdit('MANUAL_EDIT_TEXT');
    // Walk body branch (e2: n-loop → n-q1); after advanceThrough halts at n-q1 question
    runner.chooseLoopBranch('e2');

    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    // Accumulator must still contain the manual edit — the body branch walks question →
    // (no auto-append before the halt) so accumulatedText should equal 'MANUAL_EDIT_TEXT'.
    expect(state.accumulatedText).toContain('MANUAL_EDIT_TEXT');
  });

  it('RUNFIX-01 Test 2: «выход» exit preserves manual edit made at awaiting-loop-pick', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');

    runner.syncManualEdit('EXIT_EDIT');
    // e3 is the «выход» edge → n-end (text-block "Done") → complete
    runner.chooseLoopBranch('e3');

    state = runner.getState();
    // n-end auto-appends 'Done' then completes
    expect(state.status).toBe('complete');
    if (state.status !== 'complete') return;
    expect(state.finalText).toContain('EXIT_EDIT');
    // Separator + appended text from n-end text-block
    expect(state.finalText).toContain('Done');
  });

  it('RUNFIX-01 Test 3: back-edge re-entry to picker preserves a manual edit made at at-node (non-regression guard)', () => {
    // This test exercises the already-working at-node gate — it protects the existing
    // BUG-01 contract: manual edits at at-node (question) must survive back-edge re-entry
    // into the picker via B1. A regression here would mean syncManualEdit no longer
    // writes through at at-node.
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    // Halted at n-loop picker — walk body branch to reach n-q1 at-node
    runner.chooseLoopBranch('e2');
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');

    // User types a manual edit at the question at-node (pre-existing at-node gate path)
    runner.syncManualEdit('DEADEND_EDIT');
    // Answer n-a1 → back-edge e5 → n-loop → B1 re-entry → halt at picker
    runner.chooseAnswer('n-a1');

    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    // The manual edit survives the back-edge re-entry; chooseAnswer's undo snapshot captured
    // 'DEADEND_EDIT' and then appended the answer text '1 cm'.
    expect(state.accumulatedText).toContain('DEADEND_EDIT');
    expect(state.accumulatedText).toContain('1 cm');
  });

  it('RUNFIX-01 Test 4: undo snapshot captured inside chooseLoopBranch contains the manual edit, not the pre-edit text', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');

    runner.syncManualEdit('PRE_EXIT_EDIT');
    // e2 is body branch — going through so we have an at-node to step back from; but
    // actually the clean assertion is: step back from the POST-transition state to the
    // undo entry that was pushed INSIDE chooseLoopBranch. That entry's textSnapshot must
    // contain 'PRE_EXIT_EDIT' (not empty pre-edit text).
    runner.chooseLoopBranch('e2');
    state = runner.getState();
    expect(state.status).toBe('at-node');

    runner.stepBack();
    state = runner.getState();
    // stepBack restores currentNodeId=n-loop via the undo entry pushed inside
    // chooseLoopBranch and sets runnerStatus='at-node' (generic undo contract — see
    // ProtocolRunner.stepBack). What matters for RUNFIX-01 is the restored
    // accumulatedText: it must equal 'PRE_EXIT_EDIT' (the value written by
    // syncManualEdit right before chooseLoopBranch took the snapshot).
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    // The undo entry's restored snapshot must equal the post-edit accumulator — proving the
    // snapshot in chooseLoopBranch captured the manual edit, not the pre-edit value.
    expect(state.accumulatedText).toBe('PRE_EXIT_EDIT');
  });
});
