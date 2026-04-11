---
phase: 23-node-editor-auto-save-and-color-on-type-change
plan: "01"
subsystem: node-editor
tags: [tdd, red-phase, auto-save, css, cleanup]
dependency_graph:
  requires: []
  provides: [auto-save test contract, saved-indicator CSS, guard-modal removal]
  affects: [src/__tests__/editor-panel.test.ts, src/styles.css, src/views/editor-panel-view.ts]
tech_stack:
  added: []
  patterns: [TDD red phase, private-member test via cast, fake timers]
key_files:
  created: []
  modified:
    - src/__tests__/editor-panel.test.ts
    - src/styles.css
    - src/views/editor-panel-view.ts
  deleted:
    - src/views/node-switch-guard-modal.ts
decisions:
  - "Remove NodeSwitchGuardModal import from editor-panel-view.ts immediately (not deferred to Plan 02) to unblock test runner"
  - "Used 'as unknown as typeof view.saveNodeEdits' cast to resolve vi.fn() type mismatch on saveNodeEdits assignment"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-11T11:53:38Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 23 Plan 01: TDD Red Phase — Auto-Save Test Contract Summary

**One-liner:** TDD red phase establishing 7 failing auto-save tests and CSS saved-indicator rule, with NodeSwitchGuardModal deleted.

## What Was Built

- **7 failing unit tests** in `describe('auto-save behaviour')` covering AUTOSAVE-01 through AUTOSAVE-04
- **CSS rule** `.rp-editor-saved-indicator` with `opacity: 0` / `transition: opacity 150ms ease-out` / `color: var(--interactive-accent)` and `.is-visible` variant
- **Deleted** `src/views/node-switch-guard-modal.ts` (D-05 requirement)

## Task Outcomes

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing auto-save tests (RED) | b24576d | src/__tests__/editor-panel.test.ts |
| 2 | Add CSS + delete guard-modal | 2c73bb5 | src/styles.css, src/views/node-switch-guard-modal.ts, src/views/editor-panel-view.ts |

## Test Results

- **Existing tests:** 7 passed (green — untouched)
- **New auto-save tests:** 7 failed (red — `scheduleAutoSave`, `onTypeDropdownChange`, `showSavedIndicator` not yet implemented)
- **Expected RED errors:** `TypeError: view.scheduleAutoSave is not a function` etc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed NodeSwitchGuardModal import from editor-panel-view.ts**
- **Found during:** Task 2 verification
- **Issue:** After deleting `node-switch-guard-modal.ts`, the `import { NodeSwitchGuardModal }` in `editor-panel-view.ts` caused Vitest to fail to import the module — ALL 14 tests became uncollectable (0 tests ran)
- **Fix:** Removed the import and replaced the guard-modal usage in `handleNodeClick` with a comment placeholder (`// Plan 02 will implement scheduleAutoSave / flush logic here`)
- **Files modified:** `src/views/editor-panel-view.ts`
- **Commit:** 2c73bb5

**2. [Rule 2 - Type correctness] Added cast for vi.fn() saveNodeEdits assignment**
- **Found during:** Task 2 tsc verification
- **Issue:** `view.saveNodeEdits = mockSaveNodeEdits` produced TS2322 — vi.fn() return type not assignable to the method signature
- **Fix:** Added `as unknown as typeof view.saveNodeEdits` cast
- **Files modified:** `src/__tests__/editor-panel.test.ts`
- **Commit:** 2c73bb5

## Acceptance Criteria Verification

- [x] `src/__tests__/editor-panel.test.ts` contains `describe('auto-save behaviour'`
- [x] Tests 23-01-01 through 23-01-07 all exist and fail (RED)
- [x] Existing 7 tests remain green
- [x] `src/views/node-switch-guard-modal.ts` does NOT exist
- [x] `src/styles.css` contains `.rp-editor-saved-indicator` with `opacity: 0`, `transition: opacity 150ms ease-out`, `color: var(--interactive-accent)`
- [x] `src/styles.css` contains `.rp-editor-saved-indicator.is-visible` with `opacity: 1`
- [x] `src/styles.css` still contains `.rp-editor-save-row` (not deleted)
- [x] `tsc --noEmit` only shows pre-existing vitest type errors + expected guard-modal import error (fixed inline)

## Self-Check

### Files Exist
- `src/__tests__/editor-panel.test.ts` — FOUND (modified)
- `src/styles.css` — FOUND (modified)
- `src/views/node-switch-guard-modal.ts` — DELETED (confirmed)

### Commits Exist
- b24576d — FOUND
- 2c73bb5 — FOUND

## Self-Check: PASSED
