---
status: complete
phase: 13-sidebar-canvas-selector-and-run-again
source: [13-VERIFICATION.md]
started: 2026-04-08T19:05:00Z
updated: 2026-04-08T20:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar selector visual appearance
expected: Trigger button is visible and styled in sidebar mode
result: issue
reported: "Кнопки не вижу в сайдбаре"
severity: major

### 2. Selector interaction
expected: Click trigger opens popover, browse, select canvas, protocol loads
result: blocked
blocked_by: prior-phase
reason: "Не могу проверить так как не вижу кнопку"

### 3. Run again button visibility
expected: "Run again" button appears below "Protocol complete" heading after protocol finishes
result: pass

### 4. Run again behavior
expected: Clicking "Run again" restarts the protocol from the first node
result: issue
reported: "Сразу после нажатия появляется модалка предлагающая либо resume, либо start over. Модалка не нужна, пусть сразу происходит start over. Resume странно работает — откатывает на шаг назад вместо возобновления."
severity: major

## Summary

total: 4
passed: 1
issues: 2
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Trigger button is visible and styled in sidebar mode"
  status: diagnosed
  reason: "User reported: Кнопки не вижу в сайдбаре"
  severity: major
  test: 1
  root_cause: "CanvasSelectorWidget is mounted into headerEl — Obsidian's native title bar row. In sidebar mode this is a constrained flex row (~32px tall, overflow:hidden) with existing header controls. The injected rp-selector-wrapper becomes a flex-item in that row and is visually crushed/hidden. CSS rules are correct but cannot override Obsidian's layout constraints on headerEl."
  artifacts:
    - path: "src/views/runner-view.ts"
      issue: "onOpen() mounts CanvasSelectorWidget into headerEl (Obsidian native title bar) — hostile parent in sidebar mode"
    - path: "src/views/canvas-selector-widget.ts"
      issue: "Widget renders correctly but is placed in a container it cannot control"
  missing:
    - "Mount CanvasSelectorWidget into contentEl (top of content area) instead of headerEl"
    - "Create a persistent rp-selector-bar div as first child of contentEl in onOpen()"

- truth: "Clicking Run again restarts the protocol immediately from the first node without any modal"
  status: diagnosed
  reason: "User reported: появляется модалка resume/start over — она не нужна. Resume откатывает на шаг назад. Run again должен сразу делать start over."
  severity: major
  test: 4
  root_cause: "openCanvas() calls sessionService.load() which finds an existing session file (saved during the completed run). The 'Run again' click handler does not clear the session before calling openCanvas(), so openCanvas() sees a non-null session and shows ResumeSessionModal unconditionally. The 'resume' path restores to last mid-run saved state (not final state), explaining the apparent step-back."
  artifacts:
    - path: "src/views/runner-view.ts"
      issue: "Run again click handler calls openCanvas(path) without clearing session first. openCanvas() unconditionally shows ResumeSessionModal when session exists."
  missing:
    - "Clear session before calling openCanvas in Run again handler (await sessionService.clear(path) then openCanvas)"
    - "Or add a direct restartCanvas() method that bypasses the resume modal"
