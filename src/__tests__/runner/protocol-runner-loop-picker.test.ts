import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../../runner/protocol-runner';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';
import { unifiedLoopLabeledBodyGraph, unifiedLoopLongBodyGraph, unifiedLoopNestedGraph, unifiedLoopValidGraph } from '../fixtures/protocol-document-fixtures';


// Phase 44 (RUN-01..RUN-05) — picker state-machine coverage.
// Each test pins a specific behaviour from Plan 02a runtime:
//   B1 — re-entry guard (top-of-stack check before frame push)
//   B2 — previousCursor threading (canStepBack=true even at first halt)
//   I1 — strengthened iteration-stack-length check (loopContextStack.length === 1)
//   W4 — long-body integration test (Pitfall 10 cycle-guard per-call reset)
describe('ProtocolRunner loop picker (RUN-01..RUN-05)', () => {

  it('RUN-01: halts at awaiting-loop-pick with loop node id after start() on unified-loop-valid.canvas', () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopValidGraph());
    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('');
  });

  it('RUN-02: body-branch walks the branch; back-edge re-entry increments top frame iteration to 2 via the B1 guard WITHOUT pushing a second frame (B1 + I1 — single-point-increment semantic)', () => {
    const graph = unifiedLoopValidGraph();
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
    runner.start(unifiedLoopValidGraph());
    // e3 is the «выход» edge (n-loop → n-end, text-block terminal)
    runner.chooseLoopBranch('e3');
    const state = runner.getState();
    expect(state.status).toBe('complete');
    const serialized = runner.getSerializableState();
    // After complete, getSerializableState returns null — verify via getState shape only
    expect(serialized).toBeNull();
  });

  it('RUN-04: nested loops — inner «выход» returns to outer picker with SINGLE outer frame (B1 — loopContextStack.length === 1, not 2)', () => {
    const graph = unifiedLoopNestedGraph();
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
    const graph = unifiedLoopValidGraph();
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
    const graph = unifiedLoopLongBodyGraph();
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

  // Loop-dispatch regression guards — the runtime dispatch MUST key on the
  // explicit edge.isLoopExit flag, NOT a literal compare against «выход» and NOT
  // a label-prefix predicate. These tests construct an inline graph whose exit
  // edge carries isLoopExit: true and verify (a) the exit edge pops the frame /
  // advances, (b) an unlabeled body edge re-enters the picker without popping.
  // If someone reverts the predicate to a literal «выход» compare or a label
  // prefix check, both tests fail.
  function makeLoopGraph(): ProtocolGraph {
    return {
      canvasFilePath: 'test:phase-49-d05.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 200, height: 60 }],
        ['n-loop',  { id: 'n-loop',  kind: 'question',  x: 0, y: 120, width: 200, height: 60, questionText: 'Loop', loop: true }],
        ['n-body',  { id: 'n-body',  kind: 'text-block', x: 260, y: 120, width: 200, height: 60, content: 'Body' }],
        ['n-end',   { id: 'n-end',   kind: 'text-block', x: 0, y: 240, width: 200, height: 60, content: 'End' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop',  toNodeId: 'n-body' },                    // unlabeled body
        { id: 'e3', fromNodeId: 'n-loop',  toNodeId: 'n-end',  label: 'готово', isLoopExit: true },  // explicit exit flag
        { id: 'e4', fromNodeId: 'n-body',  toNodeId: 'n-loop' },                    // body → back-edge
      ],
      adjacency: new Map<string, string[]>([
        ['n-start', ['n-loop']],
        ['n-loop',  ['n-body', 'n-end']],
        ['n-body',  ['n-loop']],
        ['n-end',   []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['n-start', []],
        ['n-loop',  ['n-start', 'n-body']],
        ['n-body',  ['n-loop']],
        ['n-end',   ['n-loop']],
      ]),
      startNodeId: 'n-start',
    };
  }

  it('isLoopExit edge ("готово") pops the loop frame', () => {
    // Regression guard — if someone reverts the exit predicate to a label-prefix
    // check OR re-introduces a literal `'выход'` compare, this test fails: only
    // edges with isLoopExit === true are exits, and the "готово" edge must still
    // pop the loop frame.
    const runner = new ProtocolRunner();
    runner.start(makeLoopGraph());
    // Runner reaches n-loop → awaiting-loop-pick
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    // Choose the exit edge — frame must pop + complete at n-end
    runner.chooseLoopBranch('e3'); // isLoopExit exit → complete
    expect(runner.getState().status).toBe('complete');
  });

  it('Phase 50.1 D-10: unlabeled body edge does NOT pop the loop frame (picker re-entry)', () => {
    // Same graph shape as above, but pick the body edge first.
    const runner = new ProtocolRunner();
    runner.start(makeLoopGraph());
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    runner.chooseLoopBranch('e2');   // unlabeled body — walk n-body → back-edge → picker
    // After walking the body and hitting the back-edge, we should be at the picker again, NOT complete.
    expect(runner.getState().status).toBe('awaiting-loop-pick');
  });

  it('isLoopExit exit coexists with a labeled body edge — Runner dispatches both correctly', () => {
    // Fixture: n-loop has two outgoing edges:
    //  - isLoopExit exit
    //  - labeled body edge (Phase 50 reconciler-synced displayLabel of target Answer node)
    // The body edge is NOT marked isLoopExit, so the runner classifies it as a body;
    // the picker renders one exit + one body button.
    const graph = unifiedLoopLabeledBodyGraph();
    const runner = new ProtocolRunner();
    runner.start(graph);
    // Reach the loop picker
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    // Identify edges defensively — the fixture assigns e3 as the isLoopExit exit and e2
    // as the labeled body per Plan 04 SUMMARY; this test reads them from the graph
    // to survive fixture renumbering.
    const loopOut = graph.edges.filter(e => e.fromNodeId === 'n-loop');
    const exitEdge = loopOut.find(e => e.isLoopExit === true);
    const bodyEdge = loopOut.find(e => !e.isLoopExit);
    expect(exitEdge).toBeDefined();
    expect(bodyEdge).toBeDefined();
    if (exitEdge === undefined || bodyEdge === undefined) return;
    // Body-branch dispatch → back-edge → picker re-entry (NOT complete)
    runner.chooseLoopBranch(bodyEdge.id);
    // The body walks into n-q1 (a question) and halts at-node; the back-edge
    // re-entry is exercised in RUN-02 style. For this test the key assertion is
    // that body dispatch does NOT complete (exit predicate returned false).
    expect(runner.getState().status).not.toBe('complete');
    // Now drive a fresh runner to exit-dispatch test (can't reuse above — state advanced).
    const runner2 = new ProtocolRunner();
    runner2.start(graph);
    expect(runner2.getState().status).toBe('awaiting-loop-pick');
    runner2.chooseLoopBranch(exitEdge.id);
    expect(runner2.getState().status).toBe('complete');
  });

  it('RUN-QUICK-EXIT: answer inside loop body wired to the same target as an isLoopExit exit edge pops the frame and completes', () => {
    // Graph: start → loop → (body: answer 'n-a1' → n-end) / (exit: isLoopExit 'done' → n-end)
    // Choosing body branch auto-advances through n-a1 (pass-through), quick-exit pops frame,
    // and runner completes at n-end instead of returning to loop picker.
    const graph: ProtocolGraph = {
      canvasFilePath: 'test:quick-exit.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
        ['n-loop',  { id: 'n-loop',  kind: 'question',  x: 0, y: 100, width: 100, height: 60, questionText: 'Loop', loop: true }],
        ['n-a1',    { id: 'n-a1',    kind: 'answer', x: 100, y: 100, width: 100, height: 60, answerText: 'Quick' }],
        ['n-end',   { id: 'n-end',   kind: 'text-block', x: 0, y: 200, width: 100, height: 60, content: 'Done' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop',  toNodeId: 'n-a1' },
        { id: 'e3', fromNodeId: 'n-loop',  toNodeId: 'n-end',  label: 'done', isLoopExit: true },
        { id: 'e4', fromNodeId: 'n-a1',    toNodeId: 'n-end' },
      ],
      adjacency: new Map<string, string[]>([
        ['n-start', ['n-loop']],
        ['n-loop',  ['n-a1', 'n-end']],
        ['n-a1',    ['n-end']],
        ['n-end',   []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['n-start', []],
        ['n-loop',  ['n-start']],
        ['n-a1',    ['n-loop']],
        ['n-end',   ['n-loop', 'n-a1']],
      ]),
      startNodeId: 'n-start',
    };
    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.getState().status).toBe('awaiting-loop-pick');

    // Body branch auto-advances: n-a1 (answer pass-through) → n-end (text-block) → complete
    // Quick-exit pops the loop frame at n-a1 so runner completes instead of returning to picker.
    runner.chooseLoopBranch('e2');
    const state = runner.getState();
    expect(state.status).toBe('complete');
    if (state.status !== 'complete') return;
    expect(state.finalText).toContain('Quick');
    expect(state.finalText).toContain('Done');
  });

  it('RUN-MULTI-EXIT: loop picker supports multiple distinct isLoopExit exit branches', () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'test:multi-exit.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
        ['n-loop',  { id: 'n-loop',  kind: 'question',  x: 0, y: 100, width: 100, height: 60, questionText: 'Loop', loop: true }],
        ['n-body',  { id: 'n-body',  kind: 'text-block', x: 120, y: 100, width: 100, height: 60, content: 'Body' }],
        ['n-end-a', { id: 'n-end-a', kind: 'text-block', x: 0, y: 200, width: 100, height: 60, content: 'Exit A' }],
        ['n-end-b', { id: 'n-end-b', kind: 'text-block', x: 120, y: 200, width: 100, height: 60, content: 'Exit B' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop', toNodeId: 'n-body' },
        { id: 'e3', fromNodeId: 'n-loop', toNodeId: 'n-end-a', label: 'primary', isLoopExit: true },
        { id: 'e4', fromNodeId: 'n-loop', toNodeId: 'n-end-b', label: 'secondary', isLoopExit: true },
        { id: 'e5', fromNodeId: 'n-body', toNodeId: 'n-loop' },
      ],
      adjacency: new Map<string, string[]>([
        ['n-start', ['n-loop']],
        ['n-loop', ['n-body', 'n-end-a', 'n-end-b']],
        ['n-body', ['n-loop']],
        ['n-end-a', []],
        ['n-end-b', []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['n-start', []],
        ['n-loop', ['n-start', 'n-body']],
        ['n-body', ['n-loop']],
        ['n-end-a', ['n-loop']],
        ['n-end-b', ['n-loop']],
      ]),
      startNodeId: 'n-start',
    };

    const runnerA = new ProtocolRunner();
    runnerA.start(graph);
    runnerA.chooseLoopBranch('e3');
    const stateA = runnerA.getState();
    expect(stateA.status).toBe('complete');
    if (stateA.status !== 'complete') return;
    expect(stateA.finalText).toContain('Exit A');

    const runnerB = new ProtocolRunner();
    runnerB.start(graph);
    runnerB.chooseLoopBranch('e4');
    const stateB = runnerB.getState();
    expect(stateB.status).toBe('complete');
    if (stateB.status !== 'complete') return;
    expect(stateB.finalText).toContain('Exit B');
  });

  it('stepBack then redo restores AWAITING_LOOP_PICK and the loop stack on a looped question', () => {
    const runner = new ProtocolRunner();
    runner.start(makeLoopGraph());
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    const before = runner.getSerializableState();
    expect(before?.loopContextStack.length).toBe(1);
    runner.stepBack();
    runner.redo();
    const after = runner.getState();
    expect(after.status).toBe('awaiting-loop-pick');
    const afterSer = runner.getSerializableState();
    expect(afterSer?.loopContextStack.length).toBe(1);
    expect(afterSer?.loopContextStack[0]?.iteration).toBe(before?.loopContextStack[0]?.iteration);
  });
});

// Phase 66 D-13 — four scripted loop-boundary scenarios for stepBack correctness.
describe('Phase 66 D-13 — scripted loop-boundary scenarios for stepBack', () => {
  /** Flush microtask between sync stepBack calls so _stepBackInFlight resets. */
  async function backOnce(runner: ProtocolRunner): Promise<void> {
    runner.stepBack();
    await Promise.resolve();
  }

  // D-13 Scenario 1 — Back from inside loop body iteration N
  it('D-13 Scenario 1: back from inside loop body iteration N restores awaiting-loop-pick with iteration preserved', async () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopValidGraph());
    // Iteration 1: enter body, answer, back-edge re-entry → iter=2 picker
    runner.chooseLoopBranch('e2');
    runner.chooseAnswer('n-a1');
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    // Iteration 2: enter body again
    runner.chooseLoopBranch('e2');
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    // Back should restore the iter=2 picker state
    await backOnce(runner);
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('1 cm');
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(1);
    expect(serialized.loopContextStack[0]?.iteration).toBe(2);
  });

  // D-13 Scenario 2 — Back through isLoopExit exit edge
  it('D-13 Scenario 2: back through isLoopExit exit edge restores awaiting-loop-pick with frame restored', async () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopValidGraph());
    runner.chooseLoopBranch('e3'); // isLoopExit exit → complete
    expect(runner.getState().status).toBe('complete');
    // Back restores the loop picker with the popped frame back on the stack
    await backOnce(runner);
    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('');
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(1);
    expect(serialized.loopContextStack[0]?.loopNodeId).toBe('n-loop');
    expect(serialized.loopContextStack[0]?.iteration).toBe(1);
  });

  // D-13 Scenario 3 — Dead-end body auto-loop-back undone by Back
  it('D-13 Scenario 3: back undoes a dead-end body auto-loop-back', async () => {
    // Inline graph: start → loop → dead-end text-block (no outgoing edges)
    const graph: ProtocolGraph = {
      canvasFilePath: 'test:dead-end-loop.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
        ['n-loop', { id: 'n-loop', kind: 'question', x: 0, y: 100, width: 100, height: 60, questionText: 'Loop', loop: true }],
        ['n-dead', { id: 'n-dead', kind: 'text-block', x: 0, y: 200, width: 100, height: 60, content: 'dead' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop', toNodeId: 'n-dead' },
      ],
      adjacency: new Map<string, string[]>([
        ['n-start', ['n-loop']],
        ['n-loop', ['n-dead']],
        ['n-dead', []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['n-start', []],
        ['n-loop', ['n-start']],
        ['n-dead', ['n-loop']],
      ]),
      startNodeId: 'n-start',
    };
    const runner = new ProtocolRunner();
    runner.start(graph);
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    // Enter body — walks to dead-end text-block, auto-returns to picker with iter=2
    runner.chooseLoopBranch('e2');
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('dead');
    let serialized = runner.getSerializableState();
    expect(serialized?.loopContextStack[0]?.iteration).toBe(2);
    // Back undoes the body-branch click (including the auto-return cascade)
    await backOnce(runner);
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.accumulatedText).toBe('');
    serialized = runner.getSerializableState();
    expect(serialized?.loopContextStack[0]?.iteration).toBe(1);
  });

  // D-13 Scenario 4 — Nested loops: back from inner picker stays in inner
  it('D-13 Scenario 4: back from nested-inner picker returns to inner, not outer', async () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopNestedGraph());
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-outer');
    // Enter outer body → inner loop picker
    runner.chooseLoopBranch('e2');
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-inner');
    // Enter inner body → at-node on n-inner-q
    runner.chooseLoopBranch('e4');
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-inner-q');
    // Back restores inner picker, both frames intact, outer unchanged
    await backOnce(runner);
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-inner');
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.loopContextStack.length).toBe(2);
    expect(serialized.loopContextStack[0]?.loopNodeId).toBe('n-outer');
    expect(serialized.loopContextStack[0]?.iteration).toBe(1);
    expect(serialized.loopContextStack[1]?.loopNodeId).toBe('n-inner');
    expect(serialized.loopContextStack[1]?.iteration).toBe(1);
  });
});

// Phase 47 RUNFIX-01 — manual textarea edits made while the runner is halted at an
// `awaiting-loop-pick` state must survive every loop-node transition (body-branch entry,
// «выход» exit, dead-end return via back-edge to picker, undo snapshot capture).
//
// Root cause: syncManualEdit() gate was `runnerStatus !== 'at-node'` only — so the call
// from the host handler (fired BEFORE chooseLoopBranch) was a silent no-op while halted
// at the loop picker. The undo snapshot captured inside chooseLoopBranch (line 190) then
// recorded the pre-edit accumulator text, and every post-transition render showed stale text.
//
// Fix: extend the valid-state set to include 'awaiting-loop-pick'. See protocol-runner.ts
// syncManualEdit() JSDoc for the full rationale.
describe('ProtocolRunner RUNFIX-01 — manual edits survive loop transitions', () => {

  it('RUNFIX-01 Test 1: body-branch entry preserves manual edit made at awaiting-loop-pick', () => {
    const runner = new ProtocolRunner();
    runner.start(unifiedLoopValidGraph());
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
    runner.start(unifiedLoopValidGraph());
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
    runner.start(unifiedLoopValidGraph());
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
    runner.start(unifiedLoopValidGraph());
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
    // Phase 66 D-05: chooseLoopBranch pushes restoreStatus: 'awaiting-loop-pick',
    // so stepBack restores to the loop picker (not 'at-node').
    // What matters for RUNFIX-01 is the restored accumulatedText: it must equal
    // 'PRE_EXIT_EDIT' (the value written by syncManualEdit right before
    // chooseLoopBranch took the snapshot).
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    // The undo entry's restored snapshot must equal the post-edit accumulator — proving the
    // snapshot in chooseLoopBranch captured the manual edit, not the pre-edit value.
    expect(state.accumulatedText).toBe('PRE_EXIT_EDIT');
  });
  it('v1.17.3: step-back from a start-from-loop picker does not leave an invalid loop-pick state', async () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'test:start-from-loop.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 200, height: 60 }],
        ['n-loop', { id: 'n-loop', kind: 'question', x: 0, y: 120, width: 200, height: 60, questionText: 'Loop', loop: true }],
        ['n-body', { id: 'n-body', kind: 'text-block', x: 260, y: 120, width: 200, height: 60, content: 'Body' }],
        ['n-end', { id: 'n-end', kind: 'text-block', x: 0, y: 240, width: 200, height: 60, content: 'End' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop', toNodeId: 'n-body' },
        { id: 'e3', fromNodeId: 'n-loop', toNodeId: 'n-end', label: 'exit', isLoopExit: true },
      ],
      adjacency: new Map<string, string[]>([
        ['n-start', ['n-loop']],
        ['n-loop', ['n-body', 'n-end']],
        ['n-body', []],
        ['n-end', []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['n-start', []],
        ['n-loop', ['n-start']],
        ['n-body', ['n-loop']],
        ['n-end', ['n-loop']],
      ]),
      startNodeId: 'n-start',
    };
    const runner = new ProtocolRunner();
    runner.start(graph, 'n-loop');

    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.canStepBack).toBe(true);

    runner.stepBack();
    await Promise.resolve();
    state = runner.getState();
    expect(state.status).not.toBe('error');
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('n-loop');
    expect(state.canStepBack).toBe(false);
  });

  it('v1.17.3: back after a non-isLoopExit body branch exits a loop through the loop exit target without loop-node-not-found errors', async () => {
    const graph: ProtocolGraph = {
      canvasFilePath: 'test:loop-answer-quick-exit.canvas',
      nodes: new Map<string, RPNode>([
        ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 60 }],
        ['loop', { id: 'loop', kind: 'question', x: 0, y: 100, width: 200, height: 80, questionText: 'Loop', loop: true }],
        ['answer', { id: 'answer', kind: 'answer', x: 260, y: 100, width: 200, height: 80, answerText: 'Answer' }],
        ['after', { id: 'after', kind: 'question', x: 520, y: 100, width: 200, height: 80, questionText: 'After loop' }],
      ]),
      edges: [
        { id: 'e-start', fromNodeId: 'start', toNodeId: 'loop' },
        { id: 'e-body', fromNodeId: 'loop', toNodeId: 'answer', label: 'body' },
        { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'after', label: 'exit', isLoopExit: true },
        { id: 'e-answer-exit', fromNodeId: 'answer', toNodeId: 'after' },
      ],
      adjacency: new Map<string, string[]>([
        ['start', ['loop']],
        ['loop', ['answer', 'after']],
        ['answer', ['after']],
        ['after', []],
      ]),
      reverseAdjacency: new Map<string, string[]>([
        ['start', []],
        ['loop', ['start']],
        ['answer', ['loop']],
        ['after', ['loop', 'answer']],
      ]),
      startNodeId: 'start',
    };

    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.getState().status).toBe('awaiting-loop-pick');

    runner.chooseLoopBranch('e-body');
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('after');

    runner.stepBack();
    await Promise.resolve();
    state = runner.getState();
    expect(state.status).not.toBe('error');
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('loop');
    expect(state.canStepBack).toBe(true);
  });
});

/**
 * Free-text Answer as a DIRECT loop body/exit branch target (the loop picker
 * renders a free-text row for these edges). Graph:
 *   start → loop(loop:true) → e2 body → free(freeText) → e4 back-edge → loop
 *                        └── e3 exit (isLoopExit) → end(text-block 'Done')
 */
function freeTextLoopGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['loop', { id: 'loop', kind: 'question', x: 0, y: 100, width: 100, height: 60, questionText: 'Loop', loop: true }],
    ['free', {
      id: 'free', kind: 'answer', x: 120, y: 100, width: 100, height: 60,
      answerText: 'Describe', freeText: true, radiprotocol_separator: 'space',
    }],
    ['end', { id: 'end', kind: 'text-block', x: 0, y: 200, width: 100, height: 60, content: 'Done' }],
  ]);
  const edges: RPEdge[] = [
    { id: 'e1', fromNodeId: 'start', toNodeId: 'loop' },
    { id: 'e2', fromNodeId: 'loop', toNodeId: 'free' },
    { id: 'e3', fromNodeId: 'loop', toNodeId: 'end', label: 'done', isLoopExit: true },
    { id: 'e4', fromNodeId: 'free', toNodeId: 'loop' },
  ];
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'test:free-text-loop.canvas',
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

describe('ProtocolRunner free-text Answer as a direct loop branch target', () => {
  it('accepts submitted text on a free-text body branch and re-enters the picker with iteration incremented', () => {
    const runner = new ProtocolRunner();
    runner.start(freeTextLoopGraph());
    expect(runner.getState().status).toBe('awaiting-loop-pick');

    expect(runner.chooseLoopBranch('e2', 'custom finding')).toBe(true);

    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('loop');
    expect(state.accumulatedText).toBe('custom finding');
    const serialized = runner.getSerializableState();
    expect(serialized?.loopContextStack[0]?.iteration).toBe(2);
  });

  it.each([undefined, '', '   ', '\n\t '])(
    'rejects blank payload %p on a free-text loop branch without mutating state or history',
    (payload) => {
      const runner = new ProtocolRunner();
      runner.start(freeTextLoopGraph());
      const before = runner.getSerializableState();
      expect(before?.loopContextStack[0]?.iteration).toBe(1);

      expect(runner.chooseLoopBranch('e2', payload as string | undefined)).toBe(false);

      const state = runner.getState();
      expect(state.status).toBe('awaiting-loop-pick');
      if (state.status !== 'awaiting-loop-pick') return;
      expect(state.accumulatedText).toBe('');
      expect(runner.getSerializableState()).toEqual(before);
    },
  );

  it('appends submitted text then downstream text with the authored separators', () => {
    // free → tail text-block (newline separator) → dead-end → picker
    const graph = freeTextLoopGraph();
    const tail: RPNode = {
      id: 'tail', kind: 'text-block', x: 240, y: 100, width: 100, height: 60, content: 'Tail',
    };
    graph.nodes.set('tail', tail);
    graph.edges.push({ id: 'e5', fromNodeId: 'free', toNodeId: 'tail' });
    graph.adjacency.set('free', ['tail']);
    graph.adjacency.set('tail', []);
    graph.reverseAdjacency.set('tail', ['free']);

    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.chooseLoopBranch('e2', 'finding')).toBe(true);

    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.accumulatedText).toBe('finding\nTail');
  });

  it('preserves the loop quick-exit when the free-text answer targets the exit destination', () => {
    const graph = freeTextLoopGraph();
    const after: RPNode = {
      id: 'after', kind: 'question', x: 240, y: 100, width: 100, height: 60, questionText: 'After',
    };
    graph.nodes.set('after', after);
    // free → after (matching the exit edge target) → frame pops, no picker return
    graph.edges.push({ id: 'e5', fromNodeId: 'free', toNodeId: 'after' });
    graph.adjacency.set('free', ['after']);
    graph.adjacency.set('after', []);
    graph.reverseAdjacency.set('after', ['free', 'loop']);

    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.chooseLoopBranch('e2', 'finding')).toBe(true);

    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('after');
    expect(state.accumulatedText).toBe('finding');
  });

  it('undoes and redoes a free-text loop branch as one snapshot', async () => {
    const runner = new ProtocolRunner();
    runner.start(freeTextLoopGraph());
    expect(runner.chooseLoopBranch('e2', 'finding')).toBe(true);

    runner.stepBack();
    await Promise.resolve();
    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.accumulatedText).toBe('');
    expect(state.canRedo).toBe(true);
    const undone = runner.getSerializableState();
    expect(undone?.loopContextStack[0]?.iteration).toBe(1);

    runner.redo();
    state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.accumulatedText).toBe('finding');
    expect(runner.getSerializableState()?.loopContextStack[0]?.iteration).toBe(2);
  });

  it('ignores an accidental submitted payload for a preset answer loop branch', () => {
    const graph = freeTextLoopGraph();
    graph.nodes.set('free', {
      id: 'free',
      kind: 'answer',
      x: 120,
      y: 100,
      width: 100,
      height: 60,
      answerText: 'Preset body',
      freeText: false,
    });

    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.chooseLoopBranch('e2', 'Injected')).toBe(true);

    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.accumulatedText).toBe('Preset body');
  });

  it('accepts free text on an isLoopExit edge targeting a free-text answer and pops the frame', () => {
    const graph = freeTextLoopGraph();
    const after: RPNode = {
      id: 'after', kind: 'question', x: 240, y: 100, width: 100, height: 60, questionText: 'After',
    };
    graph.nodes.set('after', after);
    // e3 becomes an exit targeting the free-text answer; answer dead-ends into after
    graph.edges[2] = { id: 'e3', fromNodeId: 'loop', toNodeId: 'free', label: 'finish', isLoopExit: true };
    graph.edges.push({ id: 'e5', fromNodeId: 'free', toNodeId: 'after' });
    graph.adjacency.set('loop', ['free']);
    graph.adjacency.set('free', ['after']);
    graph.adjacency.set('after', []);
    graph.reverseAdjacency.set('after', ['free']);
    graph.reverseAdjacency.set('free', ['loop']);

    const runner = new ProtocolRunner();
    runner.start(graph);
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    expect(runner.chooseLoopBranch('e3', 'final note')).toBe(true);

    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('after');
    expect(state.accumulatedText).toBe('final note');
    expect(runner.getSerializableState()?.loopContextStack).toHaveLength(0);
  });
});
