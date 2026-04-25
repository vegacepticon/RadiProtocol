---
phase: 67-inline-runner-resizable-modal-file-bound-snippet-parity
plan: GAPS
subsystem: inline-runner
tags: [inline-runner, layout, persistence, resize, drag, gap-closure]

# Dependency graph
requires:
  - phase: 67-01
    provides: ResizeObserver wiring, debounced save, applyLayout / clampInlineRunnerLayout infrastructure
  - phase: 67-03
    provides: UAT feedback that identified the 2 major + 1 minor gaps
provides:
  - "getAppliedLayout() replaces getAppliedPosition() — reads width/height from inline styles with default fallback"
  - "dragUpHandler now saves full layout (left, top, width, height) instead of position-only"
  - "reclampCurrentPosition guards against hidden element (is-hidden early return) and reads size from inline styles instead of getBoundingClientRect"
  - "Default modal size increased from 360×240 to 420×320"
  - "2 new test assertions + 1 new test for hidden-element reclamp guard"
affects:
  - 67-03 UAT re-run (gaps 1 and 2 should now pass)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getAppliedLayout pattern: parseFloat on inline styles for width/height with Number.isFinite + >0 guard"
    - "Hidden-element guard: early return in reclampCurrentPosition when container has is-hidden class"
    - "Default constant bump: INLINE_RUNNER_DEFAULT_WIDTH/HEIGHT changed from 360/240 to 420/320"

key-files:
  created: []
  modified:
    - src/views/inline-runner-modal.ts
    - src/__tests__/views/inline-runner-position.test.ts
    - src/__tests__/inline-runner-layout.test.ts

key-decisions:
  - "GAPS-D-01: Combined 2 planned commits into 1 because test updates for the fix and default-size change are interdependent (both affect FakeElement rect-derived assertions)"
  - "GAPS-D-02: Added hasClass() to FakeElement in both test files to match production HTMLElement API used by reclampCurrentPosition"
  - "GAPS-D-03: handleResizeDebounceExpire simplified to use getAppliedLayout() directly — width/height are already rounded integers because applyLayout sets them via Math.round()"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-04-25
---

# Phase 67 Gap Closure Plan Summary

**Fixed 2 major UAT gaps + 1 minor enhancement:** drag-resets-size, tab-switch-resets-size, and default-size-too-small.

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-25T19:15:00Z
- **Tasks:** 6 (combined into 1 commit)
- **Files modified:** 3 (1 source + 2 test)

## Accomplishments

- **GAPS-01: `getAppliedPosition()` → `getAppliedLayout()`.** The helper now parses `containerEl.style.width` and `containerEl.style.height` alongside `left`/`top`, falling back to `INLINE_RUNNER_DEFAULT_WIDTH/HEIGHT` when inline styles are missing or non-finite. This ensures every save path persists the full 4-field layout.
- **GAPS-02: `dragUpHandler` saves full layout.** Drag-end now calls `saveInlineRunnerPosition` with `{ left, top, width, height }` instead of `{ left, top }`. Resizing then dragging no longer loses dimensions.
- **GAPS-03: `reclampCurrentPosition` hidden-element guard.** Early return when `containerEl.hasClass('is-hidden')` prevents reading `getBoundingClientRect()` on a hidden element (which returns 0×0 and would overwrite saved dimensions with defaults). Size now reads from inline styles or the saved layout instead of the live rect.
- **GAPS-04: Default size increased to 420×320.** Addresses the minor enhancement request: typical question + 3 answers no longer causes a scrollbar.
- **GAPS-05: Tests updated.** Drag-save assertion now expects full layout payload. Added hidden-element reclamp guard test asserting no save and no style mutation when `is-hidden` is present.

## Task Commits

1. **`4d221a3`** — `fix(inline-runner): drag and tab-switch preserve resized dimensions, default size 420x320`

## Files Created/Modified

- `src/views/inline-runner-modal.ts` — `getAppliedLayout()` added; `dragUpHandler`, `reclampCurrentPosition`, `handleResizeDebounceExpire` updated; default constants bumped; `enableDragging` caller updated.
- `src/__tests__/views/inline-runner-position.test.ts` — drag-save assertion updated for full layout payload; default-position expectations updated for 420×320; `hasClass()` added to `FakeElement`.
- `src/__tests__/inline-runner-layout.test.ts` — default assertions updated for 420×320; hidden-element reclamp guard test added; `hasClass()` added to `FakeElement`.

## Deviations from Plan

### 1. Combined 2 planned commits into 1

- **Found during:** Task 5 (test updates).
- **Issue:** The plan suggested 2 commits (fix commit + style commit). However, the test updates for Tasks 1–3 (fix) and Task 4 (default size) are interdependent: `FakeElement` default rect (360×240) drives `getContainerSize()`, which drives `getDefaultPosition()`, which affects the exact left/top values asserted in drag tests. Updating only the fix without the default size would leave tests asserting stale default values. Updating both requires touching the same test files in the same commit.
- **Fix:** Combined all source and test changes into a single commit with a compound message.
- **Impact:** No functional difference. Commit history is slightly less granular.

### 2. Added `hasClass()` to `FakeElement` in both test harnesses

- **Found during:** Task 6 (test run).
- **Issue:** `reclampCurrentPosition` now calls `this.containerEl.hasClass('is-hidden')`. `FakeElement` in `inline-runner-position.test.ts` and `inline-runner-layout.test.ts` did not implement `hasClass()`, causing `TypeError`.
- **Fix:** Added `hasClass(cls: string): boolean { return this.classList.contains(cls); }` to both `FakeElement` classes.
- **Verification:** `npm test` 806 passed | 1 skipped.

---

**Total deviations:** 2 (1 commit-combination, 1 test-harness fix)
**Impact on plan:** None. All 6 tasks completed; all tests green; build clean.

## Issues Encountered

- `FakeElement.hasClass` missing in 2 test harnesses — auto-fixed (see Deviation 2 above).

## User Setup Required

None — pure code changes.

## Next Phase Readiness

- Gap closure complete. Ready for **67-03 UAT re-run** — scenarios 1 (resize + drag) and 2 (tab-switch persistence) should now pass.
- 806 tests passing | 1 skipped, build green, `tsc` clean.

## Self-Check: PASSED

- `grep -c "getAppliedLayout" src/views/inline-runner-modal.ts` = 4 (definition + 3 callers) ✓
- `grep -c "saveInlineRunnerPosition(finalLayout)" src/views/inline-runner-modal.ts` = 1 (dragUpHandler) ✓
- `grep -c "is-hidden" src/views/inline-runner-modal.ts` = 3 (hide, show, reclamp guard) ✓
- `grep -c "INLINE_RUNNER_DEFAULT_WIDTH = 420" src/views/inline-runner-modal.ts` = 1 ✓
- `grep -c "INLINE_RUNNER_DEFAULT_HEIGHT = 320" src/views/inline-runner-modal.ts` = 1 ✓
- `npm test` 806 passed | 1 skipped | 0 failed ✓
- `npm run build` exit 0 ✓

---
*Phase: 67-inline-runner-resizable-modal-file-bound-snippet-parity*
*Completed: 2026-04-25*
