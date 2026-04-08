---
phase: 14-node-editor-auto-switch-and-unsaved-guard
plan: "02"
subsystem: canvas-node-editor
tags: [editor-panel, canvas-internal, auto-switch, unsaved-guard, pointerdown]
dependency_graph:
  requires:
    - phase: 14-01
      provides: [NodeSwitchGuardModal, canvas-internal-selection-type]
  provides:
    - EditorPanelView.attachCanvasListener — pointerdown listener on active canvas leaf
    - EditorPanelView.handleNodeClick — auto-switch with dirty guard
  affects: [src/views/editor-panel-view.ts]
tech_stack:
  added: []
  patterns: [setTimeout-deferred-selection-read, Promise-boolean-guard-modal, registerDomEvent-auto-cleanup, active-leaf-change-reattach]
key_files:
  created: []
  modified:
    - src/views/editor-panel-view.ts
key_decisions:
  - "attachCanvasListener nulls out bookkeeping fields and registers a fresh pointerdown via registerDomEvent on each call — old listeners on detached elements are cleaned by Obsidian component unload (no accumulation)"
  - "handleNodeClick is async private — called via void this.handleNodeClick() from the pointerdown callback to satisfy no-floating-promises convention"
  - "Guard condition: currentNodeId !== null AND pendingEdits non-empty — idle state (null currentNodeId) bypasses guard per EDITOR-02 spec"
requirements-completed: [EDITOR-01, EDITOR-02]
duration: 8min
completed: "2026-04-08"
---

# Phase 14 Plan 02: EditorPanelView Auto-Switch + Unsaved Guard Summary

EditorPanelView extended with attachCanvasListener() and handleNodeClick() to deliver EDITOR-01 (click-to-load) and EDITOR-02 (dirty-state guard modal) without modifying any other files.

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-04-08
- **Tasks:** 1 of 2 automated (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- `attachCanvasListener()` registers a `pointerdown` listener on the active canvas leaf container, defers selection read via `setTimeout(0)`, and silently ignores multi-select
- `handleNodeClick()` implements same-node no-op, Promise-based guard modal (EDITOR-02), and `loadNode()` dispatch
- `onOpen()` wired to call `attachCanvasListener()` on open and re-attach on `active-leaf-change` events
- All 7 tests in `node-switch-guard-modal.test.ts` now GREEN (previously-RED `handleNodeClick` prototype test turns GREEN)
- Full test suite: 120 passing, 3 intentional RED (runner-extensions — different plan)

## Task Commits

1. **Task 1: Add auto-switch + unsaved guard to EditorPanelView** - `47cdbfe` (feat)

## Files Created/Modified

- `src/views/editor-panel-view.ts` — added NodeSwitchGuardModal import, two private bookkeeping fields, attachCanvasListener(), handleNodeClick(), updated onOpen()

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Worktree missing Plan 01 files**
- **Found during:** Task 1 setup
- **Issue:** The worktree branch was reset to the merge commit HEAD but the working tree files reflected the pre-Plan-01 state. `node-switch-guard-modal.ts`, `node-switch-guard-modal.test.ts`, `canvas-internal.d.ts` were absent and `vitest.config.ts` was missing the obsidian alias (same fix as Plan 01 deviation 1).
- **Fix:** `git checkout HEAD -- src/views/node-switch-guard-modal.ts src/__tests__/node-switch-guard-modal.test.ts src/types/canvas-internal.d.ts vitest.config.ts` to restore all Plan 01 deliverables from the merge commit.
- **Files modified:** vitest.config.ts, src/views/node-switch-guard-modal.ts, src/__tests__/node-switch-guard-modal.test.ts, src/types/canvas-internal.d.ts
- **Commit:** included in 47cdbfe

## Known Stubs

None — attachCanvasListener and handleNodeClick are fully implemented with real logic.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Canvas selection is read-only internal state; no data leaves the plugin (confirmed by plan threat model T-14-03 through T-14-06).

## Self-Check

- [x] `src/views/editor-panel-view.ts` contains `import { NodeSwitchGuardModal } from './node-switch-guard-modal'`
- [x] `src/views/editor-panel-view.ts` contains `private handleNodeClick`
- [x] `src/views/editor-panel-view.ts` contains `private attachCanvasListener`
- [x] `src/views/editor-panel-view.ts` contains `this.currentNodeId !== null && Object.keys(this.pendingEdits).length > 0`
- [x] `src/views/editor-panel-view.ts` contains `if (!confirmed) return`
- [x] `src/views/editor-panel-view.ts` contains `setTimeout(() => {`
- [x] `src/views/editor-panel-view.ts` contains `selection.size !== 1`
- [x] `src/views/editor-panel-view.ts` contains `Array.from(selection)[0]`
- [x] `src/views/editor-panel-view.ts` contains `this.registerDomEvent(`
- [x] `src/views/editor-panel-view.ts` contains `active-leaf-change`
- [x] Commit 47cdbfe — exists

## Self-Check: PASSED
