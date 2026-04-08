---
plan: 13-02
phase: 13-sidebar-canvas-selector-and-run-again
status: completed
completed_at: 2026-04-08
---

# Plan 13-02 Summary: Gap Closure — SIDEBAR-01 and RUNNER-01

## What Was Built

Closed two UAT-diagnosed behavioral gaps in `RunnerView`:

### SIDEBAR-01: Canvas Selector Visible in Sidebar Mode

`CanvasSelectorWidget` was previously mounted into `headerEl` — Obsidian's native 32px title bar row with `overflow:hidden`. In sidebar mode this crushed the widget to invisible.

**Fix:** Created a persistent `rp-selector-bar` div inside `contentEl` in `onOpen()`, stored as `this.selectorBarEl`. Both `render()` and `renderError()` re-prepend this element at the start of each call (after `contentEl.empty()`) so the selector bar survives all DOM resets. `onClose()` nullifies the reference.

### RUNNER-01: Run Again Skips ResumeSessionModal

The "Run again" button called `openCanvas(path)` while a completed-run session still existed on disk. `openCanvas()` unconditionally shows `ResumeSessionModal` when a session is found, so the user was always prompted with "Resume or start over?" even for an intentional restart.

**Fix:** Added `restartCanvas(filePath)` private async method that calls `sessionService.clear(filePath)` before `openCanvas(filePath)`. The "Run again" click handler now calls `restartCanvas()` so `openCanvas()` finds no session and skips the modal entirely.

## Key Files

### Modified
- `src/views/runner-view.ts` — All changes in this file only

## Key Links

- `onOpen()` → `contentEl` via `selectorBarEl` persistent div (`rp-selector-bar`)
- `render()` and `renderError()` → re-prepend `selectorBarEl` after `contentEl.empty()`
- "Run again" handler → `restartCanvas()` → `sessionService.clear()` → `openCanvas()`

## Verification

- TypeScript compiles (pre-existing vitest type errors in `node_modules` are unrelated)
- `headerEl` cast removed from `onOpen()` — only appears in comment
- `rp-selector-bar` / `selectorBarEl` present in `onOpen()`, `render()`, `renderError()`, `onClose()`
- `restartCanvas()` defined; called by "Run again" handler; `sessionService.clear()` called before `openCanvas()` inside it

## Self-Check: PASSED

All success criteria met:
- [x] No TypeScript compile errors (in source files)
- [x] CanvasSelectorWidget mounted into `rp-selector-bar` div in `contentEl`, not `headerEl`
- [x] `selectorBarEl` re-prepended in `render()` after `contentEl.empty()`
- [x] `selectorBarEl` re-prepended in `renderError()` after `contentEl.empty()`
- [x] `restartCanvas()` clears session then calls `openCanvas()` — Run again never triggers ResumeSessionModal
- [x] Both SIDEBAR-01 and RUNNER-01 fully addressed
