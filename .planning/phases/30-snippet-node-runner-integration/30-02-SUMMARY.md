---
phase: 30-snippet-node-runner-integration
plan: 02
subsystem: runner
tags: [runner, state-machine, snippet-node, session, tdd]

# Dependency graph
requires:
  - phase: 30-snippet-node-runner-integration
    provides: "Plan 30-01 SnippetService.listFolder (available, unused in this plan)"
  - phase: 29-snippet-node-schema
    provides: "SnippetNode + canvas-parser snippet case"
provides:
  - "RunnerStatus 'awaiting-snippet-pick' + AwaitingSnippetPickState"
  - "ProtocolRunner.pickSnippet(snippetId) method (undo-before-mutate)"
  - "advanceThrough case 'snippet' halts in awaiting-snippet-pick"
  - "Session serialize/restore support for awaiting-snippet-pick (D-22)"
  - "Two snippet-node fixtures (with-exit, terminal) reusable by later plans"
affects: [30-03 RunnerView picker UI, session auto-save, snippet-fill flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern A: undo-before-mutate in user-action methods (mirror of chooseAnswer)"
    - "Discriminated-union widening with compile-time exhaustiveness enforcement"
    - "State-derived data (subfolderPath) computed at read time from graph, not persisted"

key-files:
  created:
    - src/__tests__/fixtures/snippet-node-with-exit.canvas
    - src/__tests__/fixtures/snippet-node-terminal.canvas
  modified:
    - src/runner/runner-state.ts
    - src/runner/protocol-runner.ts
    - src/sessions/session-model.ts
    - src/views/runner-view.ts
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/runner/protocol-runner-session.test.ts

key-decisions:
  - "subfolderPath is re-derived from the graph at getState() time rather than stored as a runner field — keeps session payload unchanged and avoids duplicate state (D-22)"
  - "Fixtures include a question+answer prelude before the snippet node so chooseAnswer pushes an undo entry, allowing tests to verify stepBack from awaiting-snippet-pick reverts to a real at-node (the engine's undoStack is otherwise empty after a pure auto-advance from start)"
  - "runner-view.ts received a placeholder 'awaiting-snippet-pick' case to satisfy TypeScript exhaustiveness; Plan 30-03 replaces it with the real picker UI"

patterns-established:
  - "Undo-before-mutate: any new runner method that mutates state MUST push UndoEntry with a spread copy of loopContextStack BEFORE assignment"
  - "State-shape widening flow: RunnerStatus union → interface → RunnerState union → getState case → getSerializableState guard+return type → restoreFrom parameter type → PersistedSession field → runner-view switch case"

requirements-completed:
  - SNIPPET-NODE-03
  - SNIPPET-NODE-05
  - SNIPPET-NODE-06
  - SNIPPET-NODE-07

# Metrics
duration: ~25min
completed: 2026-04-14
---

# Phase 30 Plan 02: Runner State Machine for Snippet Nodes Summary

**ProtocolRunner now halts at snippet nodes in a new 'awaiting-snippet-pick' state with pickSnippet() routing into the existing awaiting-snippet-fill/completeSnippet flow, complete with session round-trip support.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-14T08:45:00Z
- **Completed:** 2026-04-14T08:50:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 6 (plus 2 new fixtures)

## Accomplishments

- New `'awaiting-snippet-pick'` RunnerStatus + `AwaitingSnippetPickState` interface exported from runner-state.ts
- `ProtocolRunner.pickSnippet(snippetId)` — mirrors chooseAnswer's undo-before-mutate pattern, transitions to awaiting-snippet-fill
- `advanceThrough` case 'snippet' replaced (was Phase 29 'at-node' placeholder)
- `getState` case re-derives `subfolderPath` from the current snippet graph node at read time
- `getSerializableState`/`restoreFrom` + `PersistedSession.runnerStatus` all widened; no new payload fields (D-22)
- Two new fixtures (with-exit, terminal) driving comprehensive test coverage
- 8 new runner test cases + 2 session round-trip cases, all green
- Full test suite: 195/198 passing (the 3 failures are unrelated pre-existing RED tests in `runner-extensions.test.ts`, out of scope)

## Task Commits

1. **Task 1: Failing tests + fixtures for awaiting-snippet-pick** — `56d0f95` (test)
2. **Task 2: Implement state + pickSnippet + session support** — `99241e7` (feat)

## Files Created/Modified

- `src/runner/runner-state.ts` — new status literal, new interface, union extended
- `src/runner/protocol-runner.ts` — pickSnippet method, new getState case, extended getSerializableState + restoreFrom, replaced advanceThrough snippet case
- `src/sessions/session-model.ts` — `PersistedSession.runnerStatus` widened
- `src/views/runner-view.ts` — placeholder case for the new status (Plan 30-03 will replace)
- `src/__tests__/runner/protocol-runner.test.ts` — new describe block with 8 cases + startAtSnippet helper
- `src/__tests__/runner/protocol-runner-session.test.ts` — serialize/restore round-trip cases
- `src/__tests__/fixtures/snippet-node-with-exit.canvas` — start → question → answer → snippet → text-block
- `src/__tests__/fixtures/snippet-node-terminal.canvas` — start → question → answer → snippet (no outgoing edge)

## Decisions Made

1. **Fixtures include a question+answer prelude.** The plan's originally-sketched `start → snippet` fixture makes the undoStack empty when the runner lands at the snippet node, which contradicts the plan's own test expectations (`canStepBack === true`, stepBack reverts to a real at-node). Adding a question+answer prelude causes chooseAnswer to push one undo entry before the runner reaches the snippet node, satisfying the stepBack semantics.
2. **subfolderPath is re-derived, not persisted.** Per the plan's D-22, the runner does NOT store subfolderPath as a field; `getState()` reads it from `graph.nodes.get(currentNodeId)` on demand. This keeps session payload unchanged.
3. **Placeholder case in runner-view.ts.** Required to restore TypeScript exhaustiveness after the union widened. The placeholder simply renders "Snippet picker — coming in Plan 30-03"; Plan 30-03 replaces it with the real picker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated runner-view.ts and session-model.ts to carry the widened union**

- **Found during:** Task 2 typecheck
- **Issue:** Widening `RunnerStatus` to include `'awaiting-snippet-pick'` broke two downstream consumers: (a) `runner-view.ts` render switch lost exhaustiveness (`_exhaustive: never` fell through), and (b) `PersistedSession.runnerStatus` in `session-model.ts` still only accepted `'at-node' | 'awaiting-snippet-fill'`, causing a type mismatch in `autoSaveSession`.
- **Fix:**
  - Added a `case 'awaiting-snippet-pick'` placeholder in `runner-view.ts` that renders a "Plan 30-03" stub and the preview zone — zero new behaviour, preserves exhaustiveness.
  - Widened `PersistedSession.runnerStatus` to `'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill'` to match the runner's serialize/restore types.
- **Files modified:** `src/views/runner-view.ts`, `src/sessions/session-model.ts`
- **Verification:** `npm test -- src/__tests__/runner/ --run` → 62/62 green; `npx tsc --noEmit` → project sources clean.
- **Committed in:** `99241e7` (Task 2 commit)

**2. [Rule 1 - Test expectation] Adjusted two test assertions to match verified engine behaviour**

- **Found during:** Task 2 GREEN run
- **Issue:** Two initially-drafted assertions didn't match the engine contract: (a) the "halts at snippet node" test asserted `accumulatedText === ''`, but the question+answer prelude correctly appends "A1"; (b) the "completeSnippet advances to outgoing neighbour" test asserted `status === 'at-node'` at `n-tb1`, but `n-tb1` is a text-block that auto-appends and has no outgoing edge, so the runner correctly transitions to `complete`.
- **Fix:**
  - Accumulated text check now expects `'A1'`.
  - Outgoing-neighbour test now expects `status === 'complete'` with `finalText` containing both `'rendered text'` and `'after snippet'`, validating the full auto-advance chain.
- **Files modified:** `src/__tests__/runner/protocol-runner.test.ts`
- **Verification:** All 62 runner tests pass.
- **Committed in:** `99241e7`

---

**Total deviations:** 2 auto-fixed (1 blocking type propagation, 1 test-expectation calibration)
**Impact on plan:** No scope creep. Deviation 1 was required to keep the project compiling after widening a shared union; deviation 2 merely aligned assertions with the engine's existing auto-advance semantics (not a behaviour change).

## Issues Encountered

- **Pre-existing failing tests in `src/__tests__/runner-extensions.test.ts`.** Three tests labelled "RED until Plan 02" assert APIs that Plan 30-02 does NOT implement (`setAccumulatedText`, `start(graph, startNodeId)`). These are unrelated to the awaiting-snippet-pick state machine and are explicitly out of scope per user instruction ("leave them alone unless the plan explicitly says otherwise"). They remain RED — not a regression caused by this plan.

## User Setup Required

None — pure engine work.

## Next Phase Readiness

- **Plan 30-03 (RunnerView picker UI) is unblocked.** RunnerView can:
  - Inspect `state.status === 'awaiting-snippet-pick'` and `state.subfolderPath` to filter the snippet list.
  - Call `runner.pickSnippet(id)` to transition into the existing snippet-fill flow.
  - Call `runner.completeSnippet(text)` to advance past the snippet node with no engine changes needed.
- Session auto-save already handles the new status end-to-end.
- The `runner-view.ts` placeholder case is the only code Plan 30-03 MUST replace.

---
*Phase: 30-snippet-node-runner-integration*
*Plan: 02*
*Completed: 2026-04-14*

## Self-Check: PASSED

**Files verified on disk:**
- `src/__tests__/fixtures/snippet-node-with-exit.canvas` — FOUND
- `src/__tests__/fixtures/snippet-node-terminal.canvas` — FOUND
- `src/runner/runner-state.ts` — FOUND (contains `awaiting-snippet-pick`)
- `src/runner/protocol-runner.ts` — FOUND (contains `pickSnippet`)

**Commits verified in git log:**
- `56d0f95` — Task 1 (test fixtures + RED tests)
- `99241e7` — Task 2 (GREEN implementation)
