---
phase: 06-loop-support
plan: 02
subsystem: runner
tags: [vitest, loop, state-machine, tdd, protocol-runner, undo-stack]

# Dependency graph
requires:
  - phase: 02-core-protocol-runner-engine
    provides: ProtocolRunner class, UndoEntry, AtNodeState, advanceThrough() — all extended in this plan
  - phase: 06-01
    provides: loop-body.canvas fixture, 6 RED runner loop tests, 1 GREEN validator loop test

provides:
  - LoopContext interface in graph-model.ts (loopStartId, iteration, textBeforeLoop)
  - Extended UndoEntry with loopContextStack snapshot field
  - Extended AtNodeState with loopIterationLabel? and isAtLoopEnd? optional fields
  - Full loop-start/loop-end handling in advanceThrough()
  - chooseLoopAction('again'|'done') public method with per-loop maxIterations cap
  - edgeByLabel() private helper for label-based edge routing
  - Extended stepBack() that restores loopContextStack from snapshot
  - Extended getState() at-node branch computing loopIterationLabel and isAtLoopEnd
  - All 45 tests GREEN (6 previously RED loop tests now pass)

affects: [06-03-PLAN (RunnerView loop UI — reads isAtLoopEnd and loopIterationLabel to render loop-end prompt)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loop frame push on loop-start entry: loopContextStack.push({loopStartId, iteration: 1, textBeforeLoop})"
    - "Spread snapshot invariant: always [...this.loopContextStack] in undoStack.push — never live reference"
    - "edgeByLabel() for label-based routing: never use positional firstNeighbour() for loop-start edges"
    - "Per-loop maxIterations cap enforced in chooseLoopAction before re-entry, independent of global advanceThrough cap"
    - "UndoEntry.loopContextStack restored via spread in stepBack(): [...entry.loopContextStack]"

key-files:
  created: []
  modified:
    - src/graph/graph-model.ts
    - src/runner/runner-state.ts
    - src/runner/protocol-runner.ts
    - src/__tests__/runner/protocol-runner.test.ts

key-decisions:
  - "Tasks 1 and 2 implemented in one pass — tightly coupled types and implementation cannot be separated without TypeScript errors"
  - "Phase 2 stub test updated to expect new malformed-graph error message rather than 'not yet supported' — correct behavior now produces a different error for loop-start with no continue edge"
  - "loopContextStack field stores only primitives — shallow spread copy in UndoEntry is sufficient for correct snapshot isolation (T-06-02-01 mitigation)"

patterns-established:
  - "chooseLoopAction invariant: push undo entry BEFORE any mutation — same pattern as chooseAnswer and enterFreeText"
  - "Loop re-entry via chooseLoopAction not advanceThrough recursion — safe because chooseLoopAction is outside the advanceThrough while loop"

requirements-completed: [LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06]

# Metrics
duration: 20min
completed: 2026-04-07
---

# Phase 06 Plan 02: Loop Support — Full Loop Engine Implementation

**Complete loop traversal state machine: LoopContext frame stack, chooseLoopAction() with maxIterations cap, label-based edge routing via edgeByLabel(), and snapshot-based undo — turns all 6 RED loop tests GREEN with zero regressions.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-07T07:58:00Z
- **Completed:** 2026-04-07T08:01:00Z
- **Tasks:** 2 (executed in one pass due to tight TypeScript coupling)
- **Files modified:** 4

## Accomplishments

- Added `LoopContext` interface with `loopStartId`, `iteration`, and `textBeforeLoop` fields
- Extended `UndoEntry` with required `loopContextStack: LoopContext[]` snapshot field
- Extended `AtNodeState` with `loopIterationLabel?` and `isAtLoopEnd?` optional display fields
- Replaced Phase 2 `loop-start`/`loop-end` stub with full state machine cases in `advanceThrough()`
- Implemented `chooseLoopAction('again'|'done')` with per-loop `maxIterations` cap enforcement
- Added `edgeByLabel()` private helper for label-based routing ("continue"/"exit")
- Extended `stepBack()` to restore `loopContextStack` from undo snapshot (LOOP-05 / T-06-02-01)
- Extended `getState()` at-node branch to compute `loopIterationLabel` and `isAtLoopEnd`
- All 45 tests GREEN (6 RED loop tests now pass, 39 pre-existing tests unaffected)

## Task Commits

Tasks 1 and 2 were implemented together (plan noted they are tightly coupled and cannot be separated without TypeScript errors):

1. **Tasks 1+2: Loop engine implementation** — `b6c978f` (feat)

## Files Created/Modified

- `src/graph/graph-model.ts` — Added `LoopContext` interface after `LoopEndNode`, before `RPNode` union
- `src/runner/runner-state.ts` — Added `LoopContext` import; extended `UndoEntry` and `AtNodeState`
- `src/runner/protocol-runner.ts` — Full loop engine: new field, start() reset, updated undoStack pushes, loop-start/loop-end cases, `chooseLoopAction()`, `edgeByLabel()`, extended `stepBack()` and `getState()`
- `src/__tests__/runner/protocol-runner.test.ts` — Updated Phase 2 stub test to expect new malformed-graph error message

## Decisions Made

- Tasks 1 and 2 combined in a single edit pass — `UndoEntry.loopContextStack` is required, so all existing push sites needed updating simultaneously to avoid TypeScript errors mid-edit.
- Phase 2 stub test (checking for "Loop nodes are not yet supported") updated: now that loop support is implemented, a loop-start with no `continue` edge correctly produces a malformed-graph error. The test description and assertion updated to match new correct behavior.
- `loopContextStack` stores only primitives (string, number) — shallow spread copy in `UndoEntry` is sufficient for snapshot isolation (addresses T-06-02-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated obsolete Phase 2 stub test to match new correct error message**
- **Found during:** Task verification (after implementing loop engine)
- **Issue:** Pre-existing test `'transitions to error state with message when loop-start node is reached'` asserted the exact Phase 2 stub error message `"Loop nodes are not yet supported — upgrade to Phase 6"`. After implementing loop support, the same graph (loop-start with no `continue` edge) now correctly produces `"Loop-start node 'n-ls1' has no 'continue' edge."` — a more accurate malformed-graph error.
- **Fix:** Updated test description to `'transitions to error state when loop-start has no continue edge'` and changed assertion to `expect(state.message).toMatch(/Loop-start node.*has no 'continue' edge/)`.
- **Files modified:** `src/__tests__/runner/protocol-runner.test.ts`
- **Verification:** All 45 tests GREEN after fix.
- **Committed in:** `b6c978f` (combined task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — obsolete stub test updated to match correct behavior)
**Impact on plan:** Necessary correctness fix. The stub test was explicitly documenting temporary Phase 2 behavior (D-05) that no longer exists. Updating it maintains correct test coverage without changing any production logic.

## Issues Encountered

None — implementation matched plan specification exactly. The tight coupling between Tasks 1 and 2 was anticipated by the plan and handled correctly.

## Known Stubs

None — all loop engine functionality is fully implemented. `chooseLoopAction()` is a complete public API method.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. All threat mitigations from the plan's threat register are implemented:
- T-06-02-01: Spread copy invariant applied in all 3 `undoStack.push()` sites and in `stepBack()`
- T-06-02-02: `maxIterations` cap enforced in `chooseLoopAction()` before re-entry; global cap in `advanceThrough()` independently guards loop body traversal
- T-06-02-03: `edgeByLabel()` always uses explicit label string — never positional index
- T-06-02-04: `getState()` exposes only `loopIterationLabel` string — no internal `LoopContext` frame data

## Next Phase Readiness

- Loop engine is complete and fully tested — `RunnerView` (Phase 06-03) can now read `isAtLoopEnd` and `loopIterationLabel` from `getState()` to render the loop-end prompt UI
- `chooseLoopAction()` is a clean public API: `runner.chooseLoopAction('again')` or `runner.chooseLoopAction('done')`
- No blockers for Phase 06-03

## Self-Check: PASSED

- [x] `src/graph/graph-model.ts` exports `LoopContext` interface — exists
- [x] `src/runner/runner-state.ts` `UndoEntry` has `loopContextStack: LoopContext[]` — exists
- [x] `src/runner/runner-state.ts` `AtNodeState` has `loopIterationLabel?` and `isAtLoopEnd?` — exists
- [x] `src/runner/protocol-runner.ts` has `chooseLoopAction` public method — exists
- [x] `src/runner/protocol-runner.ts` has `edgeByLabel` private method — exists
- [x] `src/runner/protocol-runner.ts` `stepBack()` contains `this.loopContextStack = [...entry.loopContextStack]` — exists
- [x] Phase 2 stub "Loop nodes are not yet supported" no longer present in protocol-runner.ts — confirmed
- [x] Commit `b6c978f` — exists
- [x] `npx vitest run` exits 0 with all 45 tests GREEN — confirmed

---
*Phase: 06-loop-support*
*Completed: 2026-04-07*
