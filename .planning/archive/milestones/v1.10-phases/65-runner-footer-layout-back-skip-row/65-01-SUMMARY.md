---
phase: 65-runner-footer-layout-back-skip-row
plan: 01
subsystem: testing
tags: [vitest, runner-view, inline-runner, runner-footer, RUNNER-02]

requires:
  - phase: 53-runner-skip-close-buttons
    provides: Existing Skip semantics and click prologue contracts
  - phase: 54-inline-protocol-display-mode
    provides: InlineRunnerModal render surface for parity coverage
provides:
  - RED regression coverage for RUNNER-02 Back/Skip footer placement and labels
  - DOM-order assertions proving Skip cannot remain between mixed answer/snippet branches
  - Inline parity assertions for at-node, loop picker, and snippet picker Back copy
affects: [65-runner-footer-layout-back-skip-row, runner-view, inline-runner-modal]

tech-stack:
  added: []
  patterns: [Focused Vitest fake-DOM render harnesses for private runner render paths]

key-files:
  created:
    - src/__tests__/views/runner-footer-layout.test.ts
  modified: []

key-decisions:
  - "Plan 65-01 intentionally stops at RED tests so Plan 65-02 must satisfy RUNNER-02 by changing render structure, not by weakening assertions."
  - "RunnerView and InlineRunnerModal are covered in one focused file to preserve the shared Back+Skip ordering contract across modes."

patterns-established:
  - "RUNNER-02 fake-DOM harness checks DOM order directly: answer list → snippet list → footer row."
  - "Footer controls are verified by visible text, not source-string checks or aria-only labels."

requirements-completed: [RUNNER-02]

duration: 20 min
completed: 2026-04-25
---

# Phase 65 Plan 01: Runner Footer Layout RED Tests Summary

**Vitest RED coverage now locks Back/Skip footer row ordering and visible labels across RunnerView and InlineRunnerModal.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-25T09:20:00Z
- **Completed:** 2026-04-25T09:40:46Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `RUNNER-02` regression tests for `RunnerView` mixed answer+snippet rendering, requiring a dedicated `.rp-runner-footer-row` after both branch lists.
- Asserted visible `Back` and `Skip` copy exactly, including the footer ordering `Back` before `Skip`.
- Extended the same contract to `InlineRunnerModal`, including mixed branch placement plus Back-only loop/snippet picker states.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RunnerView footer layout RED tests** - `3c16e4e` (test)
2. **Task 2: Add InlineRunnerModal footer layout RED tests** - `75db900` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `src/__tests__/views/runner-footer-layout.test.ts` - Focused fake-DOM Vitest coverage for RUNNER-02 footer row placement, labels, and inline parity.

## Verification

- `npx vitest run src/__tests__/views/runner-footer-layout.test.ts` — RED as intended: 6/6 tests fail on current implementation because `.rp-runner-footer-row` is absent, RunnerView still inserts Skip between answer and snippet lists, and existing controls still render `Step back`/icon-only Skip.

## Decisions Made

- Kept this plan as RED-only. The failing tests are the deliverable for Plan 65-01; implementation belongs to Plan 65-02.
- Used DOM-order assertions as the primary proof for placement so future implementation cannot pass by only changing button text.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial RunnerView assertions dereferenced a missing footer row and produced harness TypeErrors. Fixed the test harness to fail with explicit expectation failures instead, preserving RED quality.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 65-02 can now implement the shared footer row in `RunnerView` and `InlineRunnerModal`, append any required CSS, rebuild generated assets, and use this focused test file as the GREEN target.

## Self-Check: PASSED

- Verified `src/__tests__/views/runner-footer-layout.test.ts` exists.
- Verified task commits `3c16e4e` and `75db900` exist in git history.
- Verified focused RED command reaches expectation failures tied to current Back/Skip labels/order/footer class, not harness setup errors.

---
*Phase: 65-runner-footer-layout-back-skip-row*
*Completed: 2026-04-25*
