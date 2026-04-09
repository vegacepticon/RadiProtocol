---
phase: 17
plan: "01"
subsystem: canvas-live-editor, runner-view
tags: [bug-fix, tdd, live-canvas, read-back]
dependency_graph:
  requires: []
  provides: [getCanvasJSON, live-data-fallback-in-openCanvas]
  affects: [src/canvas/canvas-live-editor.ts, src/views/runner-view.ts]
tech_stack:
  added: []
  patterns: [getData-before-vault-read fallback]
key_files:
  created:
    - src/__tests__/canvas-live-editor.test.ts
  modified:
    - src/canvas/canvas-live-editor.ts
    - src/views/runner-view.ts
    - vitest.config.ts
decisions:
  - getCanvasJSON() is public on CanvasLiveEditor so RunnerView can access it without going through undocumented internals directly
  - Live data takes strict precedence over vault.read() when canvas is open — canonical in-memory state wins
  - vitest.config.ts updated to add obsidian alias (worktree had older config without alias)
metrics:
  duration: "~12 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 4
---

# Phase 17 Plan 01: Live Canvas Read-Back for Runner (BUG-02, BUG-03) Summary

**One-liner:** Add `getCanvasJSON()` to `CanvasLiveEditor` and use it as a priority data source in `openCanvas()` so the runner always sees the latest Node Editor state when the canvas is open.

## What Was Built

Fixed BUG-02 and BUG-03: free-text-input and text-block nodes configured via Node Editor were silently absent from the runner's parsed graph when the canvas was open during save.

**Root cause:** `openCanvas()` called `vault.read()` which reads the on-disk file. When `saveLive()` used the Pattern B path (`setData` + debounced `requestSave`), the disk file might not reflect the latest canvas state within the 500ms debounce window. The parser received stale JSON without `radiprotocol_nodeType`, silently skipped the node, and the runner could not find it in the graph.

**Fix:**
- Added `getCanvasJSON(filePath: string): string | null` to `CanvasLiveEditor` — returns `JSON.stringify(view.canvas.getData())` when the canvas view is open and the internal API is available; returns `null` otherwise
- Updated `openCanvas()` in `RunnerView` to call `getCanvasJSON()` first; if non-null, uses that string as content for parsing; if null (canvas closed), falls back to `vault.read()` as before

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — failing tests for getCanvasJSON and live-data openCanvas path | 4adfd0f | src/__tests__/canvas-live-editor.test.ts, vitest.config.ts |
| 2 | GREEN — implement getCanvasJSON and live-data fallback in openCanvas | 7aa29f9 | src/canvas/canvas-live-editor.ts, src/views/runner-view.ts |

## Verification Results

- `canvas-live-editor.test.ts`: 4 tests, all GREEN
- `canvas-write-back.test.ts`: 5 tests, all GREEN (no regression)
- `canvas-parser.test.ts`: 5 tests, all GREEN (no regression)
- Full suite: 120 tests — 117 passed, 3 failed (pre-existing in runner-extensions.test.ts, unrelated to this plan)

Structural checks:
- `getCanvasJSON` appears at lines 64-68 in `canvas-live-editor.ts`
- `liveJson` and `getCanvasJSON` appear at lines 62-64 in `runner-view.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated vitest.config.ts to add obsidian module alias**
- **Found during:** Task 1 (RED)
- **Issue:** Worktree's `vitest.config.ts` was older — missing the `resolve.alias` entry for obsidian that the main project's config has. Tests failed with "Failed to resolve entry for package 'obsidian'" when trying to import `RunnerView`.
- **Fix:** Added `resolve: { alias: { obsidian: path.resolve(__dirname, 'src/__mocks__/obsidian.ts') } }` to match the main project config.
- **Files modified:** `vitest.config.ts`
- **Commit:** 4adfd0f (included in RED commit)

**2. [Rule 3 - Blocking] Restored missing worktree source files after git reset --soft**
- **Found during:** Task 1 setup
- **Issue:** The worktree branch was created from an older base commit. After `git reset --soft 94a5977`, the index moved but working tree was missing `src/canvas/`, `src/types/`, and some `src/views/` files that were added in later commits.
- **Fix:** `git checkout HEAD -- src/canvas/ src/types/ src/views/canvas-selector-widget.ts src/views/canvas-switch-modal.ts src/views/node-switch-guard-modal.ts` to restore missing files.
- **Files restored:** `src/canvas/canvas-live-editor.ts`, `src/types/canvas-internal.d.ts`, `src/views/canvas-selector-widget.ts`, `src/views/canvas-switch-modal.ts`, `src/views/node-switch-guard-modal.ts`

## Known Stubs

None — `getCanvasJSON()` is fully wired. `openCanvas()` uses it when available.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `getCanvasJSON()` is a read-only in-process call — same trust level as `vault.read()`. All threat register entries (T-17-01 through T-17-04) are accounted for in the plan's threat model.

## Self-Check: PASSED

- `src/__tests__/canvas-live-editor.test.ts` exists: FOUND
- `src/canvas/canvas-live-editor.ts` contains `getCanvasJSON`: FOUND (line 64)
- `src/views/runner-view.ts` contains `liveJson`/`getCanvasJSON`: FOUND (lines 62-64)
- RED commit `4adfd0f`: FOUND
- GREEN commit `7aa29f9`: FOUND
