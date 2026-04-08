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
  status: failed
  reason: "User reported: Кнопки не вижу в сайдбаре"
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Clicking Run again restarts the protocol immediately from the first node without any modal"
  status: failed
  reason: "User reported: появляется модалка resume/start over — она не нужна. Resume откатывает на шаг назад. Run again должен сразу делать start over."
  severity: major
  test: 4
  artifacts: []
  missing: []
