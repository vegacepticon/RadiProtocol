---
phase: 06-loop-support
plan: 01
subsystem: testing
tags: [vitest, canvas, loop, fixtures, tdd]

# Dependency graph
requires:
  - phase: 02-core-protocol-runner-engine
    provides: ProtocolRunner, ProtocolGraph, CanvasParser, GraphValidator — all used in new tests
  - phase: 05-dynamic-snippets
    provides: runner-extensions test infrastructure and existing test patterns
provides:
  - loop-body.canvas fixture with full loop graph structure (start→loop-start→question→answer→loop-end→text-block)
  - 6 RED failing test cases in protocol-runner.test.ts covering LOOP-02 through LOOP-05 and RUN-09
  - 1 GREEN test case in graph-validator.test.ts confirming LOOP-01 (validator already handles loop graphs)
affects: [06-02-PLAN (engine implementation must make the 6 RED runner tests GREEN)]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD RED phase — write failing tests before implementation; fixture-driven testing via loadGraph()]

key-files:
  created:
    - src/__tests__/fixtures/loop-body.canvas
  modified:
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/graph-validator.test.ts

key-decisions:
  - "LOOP-01 graph-validator test is GREEN (not RED) — GraphValidator already handles loop graphs correctly from prior phase; test still provides coverage"
  - "chooseLoopAction() called via dynamic property access in tests since method not yet on ProtocolRunner — tests will pass once Plan 02 adds the method"

patterns-established:
  - "reachLoopEnd() helper pattern: start runner + chooseAnswer to reach loop-end before asserting loop state"
  - "Dynamic method access via (runner as unknown as Record<string, unknown>)['chooseLoopAction'] for testing not-yet-implemented methods"

requirements-completed: [LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06]

# Metrics
duration: 12min
completed: 2026-04-07
---

# Phase 06 Plan 01: Loop Support — Test Fixture and RED Test Cases

**Full loop-body.canvas fixture created plus 6 RED runner tests and 1 GREEN validator test establishing the TDD baseline for Phase 6 loop engine implementation.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-07T04:43:00Z
- **Completed:** 2026-04-07T04:55:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

### Task 1: loop-body.canvas fixture

Created `src/__tests__/fixtures/loop-body.canvas` — a complete loop protocol graph:

- `n-start` → `n-ls1` (loop-start, loopLabel="Lesion", exitLabel="Done", maxIterations=5)
- `n-ls1` --[continue]--> `n-q1` (question, questionText="Site?")
- `n-q1` → `n-a1` (answer, answerText="Liver")
- `n-a1` → `n-le1` (loop-end, loopStartId="n-ls1")
- `n-ls1` --[exit]--> `n-tb1` (text-block, content="End of protocol.", terminal)

Edge labels "continue" and "exit" are correctly set for loop-start routing. The `loop-end` node references its `loop-start` via `radiprotocol_loopStartId`. The fixture parses correctly via `CanvasParser`.

### Task 2: RED test cases

Added `describe('loop support (LOOP-01 through LOOP-05, RUN-09)')` to `protocol-runner.test.ts` with 6 test cases — all RED against the current Phase 2 stub. The exact failure mode is: runner enters error state with message "Loop nodes are not yet supported — upgrade to Phase 6".

Added `describe('loop validation (LOOP-01, LOOP-06)')` to `graph-validator.test.ts` with 1 test case that is GREEN — the `GraphValidator` already validates loop graphs correctly from prior implementation.

## Test Results

| Test | Status | Failure Reason |
|------|--------|----------------|
| LOOP-02: runner halts at loop-end | RED | `error` state instead of `at-node` (loop stub) |
| LOOP-02/03: chooseLoopAction('again') increments iteration | RED | chooseLoopAction not implemented; error state |
| LOOP-02: chooseLoopAction('done') completes protocol | RED | chooseLoopAction not implemented; error state |
| LOOP-04: loopIterationLabel='Lesion 1' at loop-end | RED | error state; no loopIterationLabel on state |
| LOOP-05: stepBack() restores iteration 1 loop-end | RED | chooseLoopAction not implemented |
| RUN-09: maxIterations cap error on 6th 'again' | RED | wrong error message ("not yet supported" vs "Maximum iterations") |
| LOOP-01: valid loop-body passes validation | GREEN | GraphValidator already handles loops correctly |

Pre-existing tests: 80 passed, 3 pre-existing RED (runner-extensions.test.ts — labeled "RED until Plan 02").

## Deviations from Plan

### Deviation: LOOP-01 validator test is GREEN, not RED

**Found during:** Task 2
**Issue:** The plan stated all 7 new tests should be RED. The `GraphValidator` was fully implemented to handle loop graphs in Phase 2 (cycle detection already exempts cycles through loop-end nodes, orphaned loop-end detection already checks loopStartId validity).
**Action:** Test was kept as-is — it correctly documents LOOP-01 behavior and provides regression coverage. The test passing GREEN is desirable (it means the implementation was already correct and doesn't need to be done in Plan 02).
**Files modified:** None — no change needed.

### Deviation: chooseLoopAction() accessed via dynamic property in tests

**Found during:** Task 2
**Issue:** The plan's test code called `runner.chooseLoopAction('again')` directly, but `chooseLoopAction` does not exist on `ProtocolRunner` yet (Plan 02 adds it). TypeScript would reject direct calls.
**Action:** Used `(runner as unknown as Record<string, unknown>)['chooseLoopAction']?.('again')` for dynamic access. Tests compile and run — they fail because the method returns `undefined` or the runner is in error state, producing the expected RED failures.
**Files modified:** `src/__tests__/runner/protocol-runner.test.ts`

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1: loop-body.canvas fixture | `17e06f5` | test(06-01): add loop-body.canvas fixture |
| Task 2: RED test cases | `e5667b3` | test(06-01): add RED loop test cases to runner and validator tests |

## Known Stubs

None — this plan creates test files only. No production stubs introduced.

## Threat Flags

None — test fixtures and test files only; no new network endpoints, auth paths, or trust boundary changes.

## Self-Check: PASSED

- [x] `src/__tests__/fixtures/loop-body.canvas` — exists
- [x] `src/__tests__/runner/protocol-runner.test.ts` — contains 'loop support' describe block with 6 tests
- [x] `src/__tests__/graph-validator.test.ts` — contains 'loop validation' describe block with 1 test
- [x] Commit `17e06f5` — exists
- [x] Commit `e5667b3` — exists
- [x] 6 runner loop tests RED, 1 validator loop test GREEN, all pre-existing tests unchanged
