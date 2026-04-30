---
phase: 47-runner-regressions
plan: 01
subsystem: runner
tags: [protocol-runner, loop, capture-before-advance, syncManualEdit, RUNFIX-01, TDD]

# Dependency graph
requires:
  - phase: v1.2
    provides: BUG-01 capture-before-advance pattern (syncManualEdit injects textarea edit before advance action; undo snapshot captures the edit)
  - phase: 43-44 (v1.7 Unified Loop)
    provides: awaiting-loop-pick state + chooseLoopBranch with undo-before-mutate snapshot (the site where the missing gate bit away the user's manual edits)
provides:
  - Manual textarea edits made at awaiting-loop-pick survive every loop-node transition (body-branch entry, «выход» exit, back-edge re-entry)
  - Undo snapshot captured inside chooseLoopBranch now reflects post-edit accumulator text
  - Four new RUNFIX-01 regression tests exercising each transition flavour plus undo-snapshot guard
affects: [phase 47-02, phase 47-03, future runner UX work that calls syncManualEdit from additional picker states]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extended v1.2 BUG-01 capture-before-advance to awaiting-loop-pick state (additive gate relaxation — no new state surface, no new method)"

key-files:
  created:
    - ".planning/phases/47-runner-regressions/47-01-SUMMARY.md"
  modified:
    - "src/runner/protocol-runner.ts (syncManualEdit gate + JSDoc only; 10+/2- lines)"
    - "src/__tests__/runner/protocol-runner-loop-picker.test.ts (new RUNFIX-01 describe block with 4 tests)"

key-decisions:
  - "Gate relaxation over new method: extend syncManualEdit's valid-state set to {at-node, awaiting-loop-pick} rather than introduce a loop-specific sync method — preserves the single capture-before-advance touch-point documented in runner-view.ts:479."
  - "Do NOT widen the gate to awaiting-snippet-pick/awaiting-snippet-fill: those states own picker UIs with no textarea; RUNFIX-01 scope is explicitly loop transitions only."
  - "Do NOT touch runner-view.ts: the view already calls syncManualEdit before chooseLoopBranch (line 479); the bug was purely in the runtime gate, so the view stays untouched."
  - "Test 4 (undo snapshot) asserts step-back lands at at-node (predecessor restored via generic undo contract) but accumulatedText equals the post-edit value — this is the load-bearing invariant, and the status is a by-product of the separately-correct stepBack semantics."

patterns-established:
  - "TDD RED→GREEN on a single-line runtime fix: four failing tests committed first (test commit 7603bc5), then the gate line + JSDoc committed second (fix commit bdb227f) — both commits independently meaningful in git log."
  - "Additive state-gate extension: adding an OR clause to an existing gate is always strictly monotone for callers; behavioural regression surface is zero for states outside the set."

requirements-completed: [RUNFIX-01]

# Metrics
duration: ~18min
completed: 2026-04-18
---

# Phase 47 Plan 01: Loop Transition Capture-Before-Advance Summary

**Extended the v1.2 BUG-01 capture-before-advance pattern to the awaiting-loop-pick state by relaxing a single state-gate in ProtocolRunner.syncManualEdit, so manual textarea edits made while halted at a loop picker are now captured in the undo snapshot taken inside chooseLoopBranch and therefore survive every loop-node transition.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-18T22:56:00Z
- **Completed:** 2026-04-18T23:00:00Z
- **Tasks:** 1/1 (single TDD task with RED → GREEN phases)
- **Files modified:** 2 (protocol-runner.ts, protocol-runner-loop-picker.test.ts)

## Accomplishments

- Closed RUNFIX-01: manual textarea edits entered at an awaiting-loop-pick halt now persist through body-branch entry, «выход» exit, and back-edge re-entry — matching the user-expected behaviour that the v1.2 BUG-01 fix established for regular at-node transitions.
- Added 4 RUNFIX-01 regression tests covering the transition matrix: body-branch entry, «выход» exit, at-node non-regression (back-edge re-entry), and undo-snapshot-contents guard. All pass post-fix; full 423-test vitest suite stays green.
- Preserved the one-call-site capture-before-advance discipline: runner-view.ts:479 is unchanged; only the runtime gate was relaxed.

## Task Commits

Each task was committed atomically (TDD cycle — two commits for one task):

1. **Task 1 RED: RUNFIX-01 regression tests** — `7603bc5` (test)
2. **Task 1 GREEN: syncManualEdit gate extension** — `bdb227f` (fix)

**Plan metadata:** _to be captured in the final docs commit_

## Files Created/Modified

- `src/runner/protocol-runner.ts` — syncManualEdit (lines 301-316): gate widened from `runnerStatus !== 'at-node'` to `runnerStatus !== 'at-node' && runnerStatus !== 'awaiting-loop-pick'`; JSDoc extended with a Phase 47 RUNFIX-01 paragraph explaining the invariant and the bug it closes.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — new describe block `ProtocolRunner RUNFIX-01 — manual edits survive loop transitions` with 4 tests (Test 1 body-branch, Test 2 «выход» exit, Test 3 at-node non-regression, Test 4 undo snapshot).
- `.planning/phases/47-runner-regressions/47-01-SUMMARY.md` — this summary.

## Decisions Made

- **Gate relaxation, not a new method.** Introducing a `syncManualEditAtLoopPick` would have duplicated the 2-line body and forced runner-view.ts to branch on runner state before the advance — strictly worse than an OR clause in the runtime gate. Chose the OR clause (see key-decisions above for full rationale).
- **Scope limited to awaiting-loop-pick.** Plan explicitly excluded awaiting-snippet-pick / awaiting-snippet-fill because those picker states own the UI and have no textarea. Respecting that scope keeps the attack-surface delta at zero for states outside the loop transition.
- **Test 4's stepBack assertion lands at at-node (not awaiting-loop-pick).** During RED I discovered the generic stepBack contract restores predecessor + at-node status via the undo entry (protocol-runner.ts:219-242). The load-bearing invariant is `accumulatedText === 'PRE_EXIT_EDIT'`, not the status — adjusted the test assertion accordingly with an inline comment explaining why. This is a test-authoring precision fix, not a deviation from the plan's intent.

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None — fully autonomous TDD task; no external services touched.

## Verification

### Automated
```
npm test -- protocol-runner-loop-picker.test.ts
  → 10 passed (6 existing RUN-01..RUN-05 + W4, 4 new RUNFIX-01)
npm test
  → Test Files: 32 passed (32)
  → Tests: 423 passed | 1 skipped (424)
```

### Acceptance criteria greps (from plan)
```
grep "this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick'" src/runner/protocol-runner.ts
  → 1 match (line 316 inside syncManualEdit)
grep "RUNFIX-01" src/runner/protocol-runner.ts
  → 1 match (JSDoc paragraph)
grep "RUNFIX-01" src/__tests__/runner/protocol-runner-loop-picker.test.ts
  → 7 matches (describe header + 4 test names + 2 inline comments)
```

### Scope guard
```
git diff src/runner/protocol-runner.ts
  → 10 insertions / 2 deletions, confined to syncManualEdit JSDoc (6 new lines) and gate line (1 replace)
  → No other method, field, or import touched
  → No code from earlier phases removed (CLAUDE.md "Never remove existing code you didn't add" honoured)
```

## Self-Check

Verifying SUMMARY.md claims against the filesystem and git log:

- **File `.planning/phases/47-runner-regressions/47-01-SUMMARY.md`**: FOUND (just written by this task)
- **File `src/runner/protocol-runner.ts`**: FOUND (modified in commit bdb227f)
- **File `src/__tests__/runner/protocol-runner-loop-picker.test.ts`**: FOUND (modified in commit 7603bc5)
- **Commit `7603bc5` (RED)**: FOUND in git log
- **Commit `bdb227f` (GREEN)**: FOUND in git log
- **Full vitest suite**: 423 passed / 1 skipped, 0 failed

## Self-Check: PASSED
