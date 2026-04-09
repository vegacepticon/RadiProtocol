---
phase: 16-runner-textarea-edit-preservation
plan: "01"
subsystem: runner
tags: [bug-fix, tdd, accumulator, runner-view, undo]
dependency_graph:
  requires: []
  provides:
    - TextAccumulator.overwrite(text)
    - ProtocolRunner.syncManualEdit(text)
    - capture-before-advance pattern in runner-view.ts
  affects:
    - src/runner/text-accumulator.ts
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
tech_stack:
  added: []
  patterns:
    - capture-before-advance (syncManualEdit before each advance action)
    - overwrite() semantically distinct from restoreTo() for clarity
key_files:
  created: []
  modified:
    - src/runner/text-accumulator.ts
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
    - src/__tests__/runner/text-accumulator.test.ts
    - src/__tests__/runner/protocol-runner.test.ts
decisions:
  - capture-before-advance pattern: read textarea value and call syncManualEdit before each advance action so undo snapshot includes manual edit
  - overwrite() semantically separate from restoreTo() for clarity (restoreTo = undo revert; overwrite = inject caller's text)
  - live textarea read in complete-state toolbar (D-03): handlers use this.previewTextarea?.value ?? capturedText instead of stale closure
metrics:
  duration: "~15 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 16 Plan 01: Runner Textarea Edit Preservation Summary

**One-liner:** Capture-before-advance pattern using `TextAccumulator.overwrite()` and `ProtocolRunner.syncManualEdit()` to preserve manual textarea edits on step advance (BUG-01).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add overwrite() and syncManualEdit() (TDD) | d5790e9 | text-accumulator.ts, protocol-runner.ts, text-accumulator.test.ts, protocol-runner.test.ts |
| 2 | Wire syncManualEdit into advance handlers + fix complete-state toolbar | f0f94e8 | runner-view.ts |

## What Was Built

### TextAccumulator.overwrite(text)
New method in `src/runner/text-accumulator.ts` that replaces the buffer with the given text. Semantically distinct from `restoreTo()`: `restoreTo()` is for undo revert operations (restoring a previously captured snapshot), while `overwrite()` is for injecting caller-controlled text (the manual textarea edit) before an advance action. Both are O(1) string assignments.

### ProtocolRunner.syncManualEdit(text)
New public method in `src/runner/protocol-runner.ts` that calls `this.accumulator.overwrite(text)`. Guards on `runnerStatus !== 'at-node'` to be a no-op in all other states. Contains no Obsidian API imports (NFR-01 compliant). Must be called before the advance action so the undo snapshot captured inside the action includes the manual edit.

### runner-view.ts: 4 advance handlers
Each advance handler now calls `this.runner.syncManualEdit(this.previewTextarea?.value ?? '')` immediately before firing the runner action:
1. Answer button click — before `chooseAnswer()`
2. Free-text submit click — before `enterFreeText()`
3. Loop "again" click — before `chooseLoopAction('again')`
4. Loop "done" click — before `chooseLoopAction('done')`

### runner-view.ts: complete-state toolbar (D-03)
Copy, Save, and Insert button handlers now read `this.previewTextarea?.value ?? capturedText` instead of the stale closure pattern that previously read from `runner.getState()`. This ensures that any final edits made in the textarea while in complete state are honoured by the output actions.

## Verification

- All 43 tests in `text-accumulator.test.ts` and `protocol-runner.test.ts` pass (43/43)
- Full test suite: 126/129 pass; 3 failures are pre-existing intentional RED stubs in `runner-extensions.test.ts` (explicitly marked "RED until Plan 02")
- TSC: no errors in source files; pre-existing `moduleResolution` errors in vitest node_modules are unrelated to this plan
- `syncManualEdit` appears exactly 4 times in `runner-view.ts` (one per advance handler)
- `this.previewTextarea?.value ?? capturedText` appears exactly 3 times in `renderOutputToolbar()` (one per output button)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Cleanup] Removed unused CompleteState import from runner-view.ts**
- **Found during:** Task 2 — after replacing the toolbar handlers the `CompleteState` type import was no longer referenced
- **Fix:** Removed `import type { CompleteState } from '../runner/runner-state';` from runner-view.ts
- **Files modified:** src/views/runner-view.ts
- **Commit:** f0f94e8

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED
