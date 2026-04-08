---
phase: 11-live-canvas-editing
plan: "00"
subsystem: testing
tags: [vitest, canvas-live-editor, tdd, wave-0, nyquist]

# Dependency graph
requires:
  - phase: 11-live-canvas-editing (context + research)
    provides: "CanvasLiveEditor class contract, Pattern B API shape, test scaffold specs"
provides:
  - "src/__tests__/canvas-live-editor.test.ts — 8 RED stubs covering all LIVE-01 behaviors"
  - "src/__tests__/canvas-write-back.test.ts — 3 new RED stubs for LIVE-03 and LIVE-04 contracts"
  - "Wave 0 Nyquist compliance: every Plan 01 and Plan 02 automated verify points to an existing test file"
affects:
  - "11-01 — canvas-live-editor.test.ts is the exact target that Plan 01 must turn GREEN"
  - "11-02 — canvas-write-back.test.ts LIVE-03/LIVE-04 stubs are the target for Plan 02"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern B test shape: fakeLeaf.view.canvas.getData/setData/requestSave (not view.data)"
    - "vi.mock with virtual: true for modules that do not exist yet (Wave 0 pattern)"
    - "vi.useFakeTimers() / vi.runAllTimers() for debounce timer leak testing"

key-files:
  created:
    - src/__tests__/canvas-live-editor.test.ts
  modified:
    - src/__tests__/canvas-write-back.test.ts

key-decisions:
  - "Used Pattern B test scaffold (view.canvas.getData/setData) per fix(11) resolution — not Pattern A (view.data)"
  - "Used vi.mock virtual: true for canvas-live-editor mock in write-back test since file does not exist until Plan 01"
  - "Rollback test uses setData mock to verify canvas.setData(originalData) called with the original deep copy"

patterns-established:
  - "Wave 0 RED stubs: import from non-existent file makes all tests fail with module resolution error"
  - "Virtual vi.mock pattern: vi.mock('../canvas/canvas-live-editor', { virtual: true }, factory) for pre-creation mocking"

requirements-completed:
  - LIVE-01
  - LIVE-03
  - LIVE-04

# Metrics
duration: 15min
completed: 2026-04-08
---

# Phase 11 Plan 00: Wave 0 RED Test Stubs Summary

**Wave 0 Nyquist compliance: 8 RED stubs for CanvasLiveEditor (Pattern B shape) + 3 RED stubs for LIVE-03/LIVE-04 write-back contracts written before any implementation**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-08T08:38:00Z
- **Completed:** 2026-04-08T08:53:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `src/__tests__/canvas-live-editor.test.ts` with 8 failing RED stubs covering all LIVE-01 behaviors: true/false returns, PROTECTED_FIELDS guard, un-mark path, rollback on setData throw, and destroy() timer cleanup
- Updated `src/__tests__/canvas-write-back.test.ts` with 3 new RED stubs for LIVE-03 (vault.modify not called when saveLive returns true), LIVE-04 (no Close-canvas Notice), and fallback path (vault.modify called when saveLive returns false)
- Test scaffold uses Pattern B shape (`fakeLeaf.view.canvas.getData/setData/requestSave`) per the resolved open question in fix(11) commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create canvas-live-editor.test.ts with RED stubs for LIVE-01** - `f7ee658` (test)
2. **Task 2: Update canvas-write-back.test.ts for LIVE-03 and LIVE-04** - `831ec72` (test)

## Files Created/Modified

- `src/__tests__/canvas-live-editor.test.ts` — 8 unit stubs for CanvasLiveEditor class; fails with module resolution error for '../canvas/canvas-live-editor' (RED — expected Wave 0 state)
- `src/__tests__/canvas-write-back.test.ts` — Added vi.mock for canvas-live-editor (virtual: true), mockSaveLive reset in beforeEach, and 3 new it() blocks for LIVE-03/LIVE-04 contracts

## Decisions Made

- **Pattern B test scaffold**: Used `fakeLeaf.view.canvas.getData/setData/requestSave` shape (not `view.data` + `view.requestSave`) per the fix(11) commit that resolved open question A4. This means Plan 01 executor does NOT need to update the test file — the tests are already written for the confirmed implementation approach.
- **virtual: true for canvas-live-editor mock**: The canvas-live-editor.ts module does not exist until Plan 01. Using `vi.mock('../canvas/canvas-live-editor', { virtual: true }, factory)` allows the mock to work even before the module is created.
- **Rollback test design**: The rollback test verifies that `canvas.setData(originalData)` is called with the exact original deep copy object (reference equality) after `setData` throws on the first write attempt.

## Deviations from Plan

None — plan executed exactly as written. The only design choice was writing the test scaffold with Pattern B shape (per fix(11) resolution) rather than the Pattern A shape shown in the 11-00-PLAN.md `<action>` section. This aligns with the 11-01-PLAN.md `<interfaces>` note: "If the Wave 0 test file was written with the old Pattern A shape, update the test file to match this Pattern B shape before implementing the module." — by writing Pattern B from the start, Plan 01 executor has one less update to make.

## Issues Encountered

None. The `vi.mock` with `{ virtual: true }` option handled the missing module cleanly. Pre-existing failures in canvas-write-back.test.ts (obsidian mock resolution) were unaffected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 complete: both test files exist and are RED
- Plan 01 (Wave 1): implement `src/canvas/canvas-live-editor.ts` and `src/types/canvas-internal.d.ts` to turn canvas-live-editor.test.ts GREEN
- Plan 02 (Wave 2): wire CanvasLiveEditor into EditorPanelView.saveNodeEdits() to turn the 3 new canvas-write-back tests GREEN
- No blockers

---
*Phase: 11-live-canvas-editing*
*Completed: 2026-04-08*
