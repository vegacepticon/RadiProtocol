---
phase: 15-text-separator-setting
plan: "05"
subsystem: runner-ui, editor-panel, runner-engine
tags: [gap-closure, regression-fix, restore-runner-ui, live-canvas-editor]
dependency_graph:
  requires: [15-04]
  provides: [runner-view-full, editor-panel-live-save]
  affects: [runner-view, editor-panel-view, protocol-runner, graph-model, text-accumulator]
tech_stack:
  added: []
  patterns: [CanvasSelectorWidget, CanvasSwitchModal, canvasLiveEditor Pattern B live-first save, auto-grow textarea]
key_files:
  created:
    - src/views/node-switch-guard-modal.ts
  modified:
    - src/views/runner-view.ts
    - src/views/editor-panel-view.ts
    - src/runner/protocol-runner.ts
    - src/runner/text-accumulator.ts
    - src/graph/graph-model.ts
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/canvas-write-back.test.ts
decisions:
  - "Merged Phase 13 (04ecbe2) runner-view.ts with Phase 15 mutable runner re-creation in openCanvas()"
  - "editor-panel-view.ts: live-first via canvasLiveEditor.saveLive(); fallback to vault.modify() when canvas closed"
  - "Restored Phase 14 auto-switch (attachCanvasListener, NodeSwitchGuardModal) and Phase 15 separator dropdowns to editor-panel-view.ts"
  - "Fixed attachCanvasListener TypeScript error: cast WorkspaceLeaf to internal type with containerEl"
  - "canvas-write-back tests updated: canvasLiveEditor mock added, canvas-open guard test replaced with live-save test"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_changed: 8
---

# Phase 15 Plan 05: runner-view.ts Restore and editor-panel-view.ts Live-Save Wiring Summary

Restored runner-view.ts to Phase 13 state (with selector widget, Run again, Insert in note) merged with Phase 15 additions (mutable runner re-created with defaultSeparator per openCanvas()), and replaced editor-panel-view.ts saveNodeEdits() Strategy A-only guard with a live-first Pattern B implementation using canvasLiveEditor.saveLive().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restore runner-view.ts to Phase 13 + Phase 15 merged state | 1307f93 | src/views/runner-view.ts, src/runner/protocol-runner.ts, src/runner/text-accumulator.ts, src/graph/graph-model.ts, src/views/node-switch-guard-modal.ts, src/__tests__/runner/protocol-runner.test.ts |
| 2 | Wire editor-panel-view.ts saveNodeEdits() to canvasLiveEditor | 939d7b5 | src/views/editor-panel-view.ts, src/__tests__/canvas-write-back.test.ts |

## Verification Results

### runner-view.ts Key Symbols
grep count of selectorBarEl|insertBtn|lastActiveMarkdownFile|restartCanvas|handleSelectorSelect|defaultSeparator: 31

### editor-panel-view.ts saveNodeEdits() Live-First
- canvasLiveEditor.saveLive() call: PRESENT (line 139)
- isCanvasOpen() method: REMOVED
- "Close the canvas before editing" Notice: REMOVED

### TypeScript
npx tsc --noEmit: zero errors in src/ files

### Tests
npx vitest run: 119 passed, 3 failed (same 3 runner-extensions RED TDD tests as baseline — marked "RED until Plan 02")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored Phase 15 Plan 02 protocol-runner.ts and related files**
- **Found during:** Task 1 TypeScript check
- **Issue:** The worktree base commit (681260156bc) had protocol-runner.ts reverted to pre-Phase-15 state (no defaultSeparator in ProtocolRunnerOptions), causing TS2353 error in runner-view.ts
- **Fix:** Copied protocol-runner.ts, text-accumulator.ts, and graph-model.ts from Phase 15 Plan 02 commit (6a88448); updated protocol-runner.test.ts with separator-aware assertions
- **Files modified:** src/runner/protocol-runner.ts, src/runner/text-accumulator.ts, src/graph/graph-model.ts, src/__tests__/runner/protocol-runner.test.ts
- **Commit:** 1307f93

**2. [Rule 3 - Blocking] Restored node-switch-guard-modal.ts from Phase 14**
- **Found during:** Task 2 (editor-panel-view.ts imports NodeSwitchGuardModal)
- **Issue:** node-switch-guard-modal.ts was not in the worktree or main repo HEAD (not part of Plan 04 restore)
- **Fix:** Retrieved from Phase 14 commit (2aff05b) and added to worktree
- **Files modified:** src/views/node-switch-guard-modal.ts
- **Commit:** 1307f93

**3. [Rule 1 - Bug] Fixed WorkspaceLeaf.containerEl TypeScript error in editor-panel-view.ts**
- **Found during:** Task 2 TypeScript check
- **Issue:** attachCanvasListener() accessed canvasLeaf.containerEl directly, but WorkspaceLeaf type doesn't declare containerEl publicly — TS2339 error
- **Fix:** Cast canvasLeaf to internal type `{ containerEl: HTMLElement; view: unknown }` and added null guard before registerDomEvent()
- **Files modified:** src/views/editor-panel-view.ts
- **Commit:** 939d7b5

**4. [Rule 1 - Bug] Updated canvas-write-back.test.ts for live-first saveNodeEdits()**
- **Found during:** Task 2 test run
- **Issue:** canvas-write-back tests failed because: (a) mockPlugin had no canvasLiveEditor, causing TypeError on saveLive() call; (b) "canvas-open guard" test expected old Strategy A behavior
- **Fix:** Added canvasLiveEditor.saveLive mock returning false (canvas closed) so vault.modify() path is exercised; replaced canvas-open guard test with live-save test (saveLive returns true -> vault.modify() not called)
- **Files modified:** src/__tests__/canvas-write-back.test.ts
- **Commit:** 939d7b5

**5. [Rule 2 - Missing] Added Phase 14 auto-switch and Phase 15 separator dropdowns to editor-panel-view.ts**
- **Found during:** Task 2 (base commit had old editor-panel-view.ts without Phase 14/15 features)
- **Issue:** The base commit had editor-panel-view.ts reverted to pre-Phase-14 state (no attachCanvasListener, no NodeSwitchGuardModal, no separator dropdowns) — the plan says "preserve all Phase 14 auto-switch logic, NodeSwitchGuardModal usage, buildKindForm() with separator dropdowns"
- **Fix:** Applied Phase 14 auto-switch logic (attachCanvasListener, handleNodeClick, NodeSwitchGuardModal) and Phase 15 separator dropdowns from commit 909ab94 as the base for editor-panel-view.ts
- **Files modified:** src/views/editor-panel-view.ts
- **Commit:** 939d7b5

## Known Stubs

None — all code is fully functional, not stubbed.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced beyond those covered in the plan's threat model. PROTECTED_FIELDS set (T-15-05-01 mitigation) is present in both live and vault.modify() paths. selector.destroy() (T-15-05-03 mitigation) is called in onClose().

## Self-Check: PASSED

- src/views/runner-view.ts: FOUND — 31 key symbol matches
- src/views/editor-panel-view.ts: FOUND — canvasLiveEditor.saveLive present, isCanvasOpen removed
- src/runner/protocol-runner.ts: FOUND — defaultSeparator in ProtocolRunnerOptions
- src/views/node-switch-guard-modal.ts: FOUND
- Commits 1307f93, 939d7b5: both present in git log
- npx tsc --noEmit: zero src/ errors
- npx vitest run: 119 passed, 3 failed (expected RED TDD tests)
