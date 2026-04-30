---
phase: 41-live-canvas-update-on-folder-rename
plan: 01
subsystem: snippets/canvas-sync
tags: [canvas, live-update, pattern-b, folder-rename]
dependency_graph:
  requires: [canvas-live-editor, canvas-ref-sync, snippet-manager-view]
  provides: [live-canvas-ref-rewrite]
  affects: [snippet-manager-view, canvas-ref-sync]
tech_stack:
  added: []
  patterns: [pattern-b-live-first-fallback-to-disk]
key_files:
  created: []
  modified:
    - src/snippets/canvas-ref-sync.ts
    - src/views/snippet-manager-view.ts
    - src/__tests__/canvas-ref-sync.test.ts
decisions:
  - Live path uses per-node saveLive calls with fallback to vault.modify on any failure
  - No mutex needed for live path (saveLive operates on in-memory state)
metrics:
  duration: 2min
  completed: 2026-04-16
  tasks: 2
  files: 3
---

# Phase 41 Plan 01: Live Canvas Update on Folder Rename Summary

Hybrid live+disk rewriteCanvasRefs with Pattern B saveLive for open canvases and vault.modify fallback for closed ones.

## What Was Done

### Task 1: Add unit tests for live canvas update path (TDD RED)
- Added `makeLiveEditor` mock factory with configurable `liveFiles`, `canvasData`, and `saveLiveResult`
- Added 6 new test cases in `describe('rewriteCanvasRefs with CanvasLiveEditor')` block:
  1. Live path: saveLive called, vault.modify skipped
  2. Fallback: isLiveAvailable false uses vault.modify
  3. Mid-iteration fallback: saveLive returns false triggers vault.modify
  4. Multi-node live: all matching nodes get saveLive
  5. Mixed open/closed canvases
  6. Backward compat: no liveEditor param
- Commit: `5b960be`

### Task 2: Implement hybrid live+disk path (TDD GREEN)
- Added `import type { CanvasLiveEditor }` to canvas-ref-sync.ts
- Extended `rewriteCanvasRefs` signature with optional `canvasLiveEditor` parameter
- Added live path block before existing vault.read: checks `isLiveAvailable`, parses live JSON, collects matching node edits, calls `saveLive` per node
- If any `saveLive` returns false, falls through to vault.modify for entire file (no dual-write)
- Updated both call sites in snippet-manager-view.ts (performMove line 700, commitInlineRename line 945) to pass `this.plugin.canvasLiveEditor`
- All 385 tests pass, build clean
- Commit: `79b4361`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm run build`: exits 0
- `npm test -- --run`: 385 tests pass (28 test files)
- `npx vitest run src/__tests__/canvas-ref-sync.test.ts`: 18 tests pass (12 existing + 6 new)
- `grep -c "canvasLiveEditor" src/snippets/canvas-ref-sync.ts`: 4 (import + param + isLiveAvailable + saveLive)
- `grep -c "this.plugin.canvasLiveEditor" src/views/snippet-manager-view.ts`: 2 (both call sites)

## TDD Gate Compliance

- RED gate: `test(41-01)` commit `5b960be` - 4 tests failing as expected
- GREEN gate: `feat(41-01)` commit `79b4361` - all 18 tests passing
- REFACTOR gate: not needed, implementation is clean

## Known Stubs

None.

## Self-Check: PASSED
