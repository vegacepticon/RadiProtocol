---
phase: 66-runner-step-back-reliability-scroll-pinning
plan: 04
subsystem: runner
tags: [test, loop, step-back, roundtrip, deterministic]
dependency_graph:
  requires:
    - 66-01 (restoreStatus + _stepBackInFlight guard)
    - src/__tests__/fixtures/unified-loop-valid.canvas
    - src/__tests__/fixtures/unified-loop-nested.canvas
  provides:
    - D-08 deterministic roundtrip invariant over canonical loop sequence
    - D-13 four scripted loop-boundary scenarios
  affects:
    - src/runner/protocol-runner.ts (deep-copy bug fix for loopContextStack snapshots)
tech_stack:
  added: []
  patterns:
    - hand-rolled deterministic test sequences (no fast-check)
    - backOnce microtask-flushing helper for _stepBackInFlight guard
key_files:
  created:
    - src/__tests__/runner/protocol-runner-step-back-roundtrip.test.ts
  modified:
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts
    - src/runner/protocol-runner.ts
decisions:
  - "Test K corrected: back × 4 fully rewinds (1 loop-entry + 3 user actions), 5th back is no-op"
  - "All undo push sites changed from shallow spread [...this.loopContextStack] to deep copy this.loopContextStack.map(f => ({...f})) to prevent frame mutation from corrupting snapshots"
metrics:
  duration: ~8 minutes
  completed_date: 2026-04-25
---

# Phase 66 Plan 04: Loop-Boundary Step-Back Roundtrip Tests Summary

**One-liner:** Hand-rolled deterministic roundtrip and four scripted loop-boundary scenarios prove `stepBack` correctness across loop entry, exit, dead-end auto-return, and nested picker boundaries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hand-rolled deterministic roundtrip suite (D-08) | `170fd3e` | `src/__tests__/runner/protocol-runner-step-back-roundtrip.test.ts` |
| 2 | Four scripted scenarios (D-13) | `004c263` | `src/__tests__/runner/protocol-runner-loop-picker.test.ts`, `src/runner/protocol-runner.ts` |

## Test Inventory

### New File: `protocol-runner-step-back-roundtrip.test.ts` (3 tests)
- **Test I:** `back × N` restores accumulated text to `''` for N ∈ {1,2,3} over the canonical `unified-loop-valid` sequence.
- **Test J:** `forward × 3 → back × 3 → forward × 3` yields the same final state as `forward × 3` alone (defensive `complete` pre-assertion before deep-equal).
- **Test K:** `back × 5` from a fully-rewound runner is a no-op (undoStack empty after 4 pops).

### Appended to `protocol-runner-loop-picker.test.ts` (4 tests)
- **D-13 Scenario 1:** Back from inside loop body iteration N restores `awaiting-loop-pick` with the loop frame preserved (iteration = 2).
- **D-13 Scenario 2:** Back through `+exit` edge restores `awaiting-loop-pick` with the popped frame reinstated on the stack.
- **D-13 Scenario 3:** Back undoes a dead-end body auto-loop-back, restoring iteration to 1 and clearing accumulated text.
- **D-13 Scenario 4:** Back from a nested inner picker returns to the inner picker, not the outer; outer frame is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Fixed shallow-copy loopContextStack snapshot corruption**
- **Found during:** Task 2 (Scenario 3)
- **Issue:** All undo push sites in `protocol-runner.ts` used `[...this.loopContextStack]` (shallow array spread). Because `LoopContext` frames are objects, the snapshot held live references to the same frame instances. When `advanceOrReturnToLoop` or the B1 re-entry guard mutated `frame.iteration += 1`, the undo snapshot saw the mutation. This caused `stepBack` to restore the post-mutation iteration value instead of the pre-mutation snapshot value.
- **Fix:** Changed all 7 undo push sites to deep-copy frames with `this.loopContextStack.map(f => ({ ...f }))`.
- **Files modified:** `src/runner/protocol-runner.ts` (lines 96, 145, 201, 241, 320, 361, 714)
- **Commit:** `004c263`

### Test Adjustments

**Test K off-by-one correction**
- The plan's draft code asserted that `back × 4` after `forward × 3` was a no-op, but the runner pushes 4 undo entries (1 loop-entry + 3 user actions). The test was corrected to `back × 4` fully rewinding, then `back × 5` as the no-op.

## Known Stubs

None — all assertions are wired to actual runner state; no placeholder text or hardcoded empty values flow to UI rendering.

## Threat Flags

None — this is a test-only plan with no new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- [x] `src/__tests__/runner/protocol-runner-step-back-roundtrip.test.ts` exists and contains 3 passing tests
- [x] `src/__tests__/runner/protocol-runner-loop-picker.test.ts` contains `Phase 66 D-13` describe block with 4 passing `it(...)` blocks
- [x] `src/__tests__/runner/protocol-runner-step-back-roundtrip.test.ts` does NOT contain `fast-check`
- [x] Test J pre-asserts `complete` status before `toEqual`
- [x] `npm test` exits 0 (784 passed, 1 skipped)
- [x] Original RUN-01..RUN-05 and W4 tests remain untouched
- [x] Commits `170fd3e` and `004c263` are in git history
