---
phase: "04-canvas-node-editor-side-panel"
plan: "00"
subsystem: "editor-panel"
tags: ["tdd", "test-stubs", "wave-0", "red-tests"]
dependency_graph:
  requires: []
  provides:
    - "src/__tests__/editor-panel.test.ts — RED test stubs for EditorPanelView (EDIT-01, EDIT-02)"
    - "src/__tests__/canvas-write-back.test.ts — RED test stubs for saveNodeEdits write-back (EDIT-03, EDIT-04)"
  affects:
    - "src/views/editor-panel-view.ts — tested by editor-panel.test.ts (Plan 01 must make GREEN)"
tech_stack:
  added: []
  patterns:
    - "vi.mock('obsidian') with resolve.alias in vitest.config.ts for Obsidian API isolation"
    - "Plain object mock leaf (no DOM required in node environment)"
key_files:
  created:
    - "src/__tests__/editor-panel.test.ts"
    - "src/__tests__/canvas-write-back.test.ts"
  modified: []
decisions:
  - "Use plain object for mock WorkspaceLeaf instead of document.createElement to avoid jsdom in node environment"
  - "5 canvas-write-back tests all fail RED because saveNodeEdits is not a function (stub has no such method) — canvas-open guard test also RED for this reason, acceptable per plan"
metrics:
  duration_seconds: 163
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 04 Plan 00: Wave 0 Test Stubs Summary

**One-liner:** RED test stubs establishing EditorPanelView and canvas write-back API contracts before any Wave 1 implementation begins.

## What Was Built

Two failing test files that define the expected contract for Phase 04 Wave 1 implementation:

1. `src/__tests__/editor-panel.test.ts` — 7 tests, 5 RED, 2 GREEN
2. `src/__tests__/canvas-write-back.test.ts` — 5 tests, 5 RED

### editor-panel.test.ts Results

| Test | Status | Notes |
|------|--------|-------|
| EDITOR_PANEL_VIEW_TYPE === 'radiprotocol-editor-panel' | GREEN | Constant already correct in stub |
| getViewType() returns EDITOR_PANEL_VIEW_TYPE | GREEN | Already correct in stub |
| getDisplayText() returns 'RadiProtocol node editor' | RED | Stub returns 'Radiprotocol node editor' (lowercase r) |
| getIcon() returns 'pencil' | RED | Not implemented in stub |
| loadNode method exists | RED | Not implemented in stub |
| loadNode accepts (filePath, nodeId) without throwing | RED | Not implemented in stub |
| saveNodeEdits method exists | RED | Not implemented in stub |

### canvas-write-back.test.ts Results

| Test | Status | Notes |
|------|--------|-------|
| PROTECTED_FIELDS not written | RED | saveNodeEdits is not a function on stub |
| radiprotocol_* fields written via vault.modify() | RED | saveNodeEdits is not a function on stub |
| undefined values delete key from node | RED | saveNodeEdits is not a function on stub |
| canvas-open guard prevents vault.modify() | RED | saveNodeEdits is not a function on stub |
| un-mark cleanup removes all radiprotocol_* fields | RED | saveNodeEdits is not a function on stub |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `6a5ab15` | test(04-00): add failing test stubs for EditorPanelView (EDIT-01, EDIT-02) |
| Task 2 | `340ed9b` | test(04-00): add failing test stubs for canvas write-back (EDIT-03, EDIT-04) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored vitest.config.ts resolve.alias for obsidian mock**

- **Found during:** Task 1 verification — tests failed with "Failed to resolve entry for package obsidian"
- **Issue:** Working tree had older vitest.config.ts missing `resolve.alias: { obsidian: path.resolve(__dirname, 'src/__mocks__/obsidian.ts') }` — the target commit (cafff0f) already had the correct config but the worktree's reset left the stale version
- **Fix:** Restored vitest.config.ts from the target commit via `git checkout cafff0f -- vitest.config.ts`
- **Files modified:** `vitest.config.ts`
- **Commit:** Included in Task 1 commit (6a5ab15) as a restored file

**2. [Rule 1 - Bug] Used plain object mock leaf instead of document.createElement**

- **Found during:** Task 1 implementation — plan template used `document.createElement('div')` for the mock WorkspaceLeaf containerEl, but vitest environment is `node` (not jsdom)
- **Issue:** `document` is not available in node environment
- **Fix:** Replaced `{ containerEl: document.createElement('div') }` with `{ containerEl: {} }` — the ItemView mock constructor does not use the containerEl, so a plain object is sufficient
- **Files modified:** `src/__tests__/editor-panel.test.ts`, `src/__tests__/canvas-write-back.test.ts`

## Known Stubs

These test files contain stubs by design — they are the Wave 0 RED stubs that Wave 1 plans must make GREEN:

| File | Stub Reason |
|------|------------|
| `src/__tests__/editor-panel.test.ts` | Tests import `src/views/editor-panel-view.ts` which is a Phase 4 stub — Plan 01 makes these GREEN |
| `src/__tests__/canvas-write-back.test.ts` | Tests `saveNodeEdits()` which does not exist yet — Plan 02 Task 1 makes these GREEN |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only.

## Self-Check

Checking created files exist and commits are present.
