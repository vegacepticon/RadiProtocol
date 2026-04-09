---
phase: 15-text-separator-setting
plan: "04"
subsystem: settings, canvas-editor, runner-ui
tags: [gap-closure, regression-fix, restore-deleted-files]
dependency_graph:
  requires: []
  provides: [canvas-live-editor, canvas-selector-widget, canvas-switch-modal, settings-8-fields, main-canvas-live-editor]
  affects: [runner-view, editor-panel-view, settings-tab]
tech_stack:
  added: []
  patterns: [CanvasLiveEditor Pattern B, WriteMutex per-file locking, runnerViewMode-aware leaf management]
key_files:
  created:
    - src/canvas/canvas-live-editor.ts
    - src/views/canvas-selector-widget.ts
    - src/views/canvas-switch-modal.ts
    - src/types/canvas-internal.d.ts
  modified:
    - src/settings.ts
    - src/main.ts
    - src/__tests__/snippet-service.test.ts
    - vitest.config.ts
decisions:
  - "Restored all 3 files verbatim from git commit 04ecbe2 — no content changes needed"
  - "settings.ts: used 04ecbe2 base + inserted textSeparator dropdown in Runner section"
  - "main.ts: merged 04ecbe2 activateRunnerView/insertIntoCurrentNote with Phase 14 context-menu wiring"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-09"
  tasks_completed: 3
  files_changed: 8
---

# Phase 15 Plan 04: Restore Deleted Canvas Support Files and Repair Settings/Main Summary

Restored canvas-live-editor.ts, canvas-selector-widget.ts, canvas-switch-modal.ts (deleted by commit 47cdbfe) and repaired settings.ts (8 fields + full display()) and main.ts (CanvasLiveEditor, insertMutex, runnerViewMode-aware activateRunnerView, insertIntoCurrentNote) while preserving all Phase 14 context-menu wiring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restore deleted canvas support files | 67b8ea8 | src/canvas/canvas-live-editor.ts, src/views/canvas-selector-widget.ts, src/views/canvas-switch-modal.ts, src/types/canvas-internal.d.ts |
| 2 | Repair settings.ts | 6066c96 | src/settings.ts |
| 3 | Repair main.ts | b260e20 | src/main.ts, src/__tests__/snippet-service.test.ts, vitest.config.ts |

## Verification Results

### Files Restored
- src/canvas/canvas-live-editor.ts — CanvasLiveEditor class with saveLive(), isLiveAvailable(), destroy()
- src/views/canvas-selector-widget.ts — CanvasSelectorWidget class
- src/views/canvas-switch-modal.ts — CanvasSwitchModal class
- src/types/canvas-internal.d.ts — ambient CanvasViewInternal type declarations

### Settings Interface
All 8 fields present: outputDestination, outputFolderPath, maxLoopIterations, snippetFolderPath, sessionFolderPath, runnerViewMode, protocolFolderPath, textSeparator.
display() renders: Runner (runnerViewMode + textSeparator), Protocol, Output, Protocol engine, Storage sections.

### Main.ts Key Symbols
grep count of canvasLiveEditor|insertMutex|insertIntoCurrentNote|runnerViewMode: 9

### TypeScript
npx tsc --noEmit: zero errors in src/settings.ts, src/main.ts, src/canvas/canvas-live-editor.ts

### Tests
npx vitest run: 113 passed, 3 failed (same 3 runner-extensions RED TDD tests that were already failing in baseline — marked "RED until Plan 02")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored src/types/canvas-internal.d.ts**
- **Found during:** Task 1
- **Issue:** canvas-live-editor.ts imports from '../types/canvas-internal' — this file was staged for deletion in the worktree alongside the 3 target files
- **Fix:** Restored canvas-internal.d.ts from git HEAD (same content as main repo)
- **Files modified:** src/types/canvas-internal.d.ts
- **Commit:** 67b8ea8

**2. [Rule 1 - Bug] Fixed snippet-service.test.ts settings fixture**
- **Found during:** Task 3 TypeScript check
- **Issue:** Test fixture used 5-field settings object; settings interface now has 8 required fields, causing TS2345 errors
- **Fix:** Added runnerViewMode, protocolFolderPath, textSeparator to the inline settings const in the test
- **Files modified:** src/__tests__/snippet-service.test.ts
- **Commit:** b260e20

**3. [Rule 3 - Blocking] Restored obsidian alias in vitest.config.ts**
- **Found during:** Task 3 test run
- **Issue:** Worktree vitest.config.ts was missing the `resolve.alias` for obsidian, causing settings-tab.test.ts to fail with "Failed to resolve entry for package obsidian"
- **Fix:** Added path alias `obsidian -> src/__mocks__/obsidian.ts` matching main repo config
- **Files modified:** vitest.config.ts
- **Commit:** b260e20

## Known Stubs

None — all restored code is fully functional, not stubbed.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. Files restored verbatim from prior commit. T-15-04-01 (PROTECTED_FIELDS) and T-15-04-02 (destroy() timer cleanup) mitigations are both present in the restored canvas-live-editor.ts.

## Self-Check: PASSED

- src/canvas/canvas-live-editor.ts: FOUND
- src/views/canvas-selector-widget.ts: FOUND
- src/views/canvas-switch-modal.ts: FOUND
- src/types/canvas-internal.d.ts: FOUND
- src/settings.ts: 8 fields verified
- src/main.ts: 9 key symbol matches
- Commits 67b8ea8, 6066c96, b260e20: all present in git log
