---
status: complete
phase: 10-insert-into-current-note
source: [10-01-SUMMARY.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Button visible in complete-state
expected: After a protocol run completes, the runner shows three buttons side by side — "Copy to clipboard", "Save to note", and "Insert into note" — in the output toolbar.
result: pass

### 2. Button disabled when no markdown note is active
expected: Close all markdown notes (or switch to a canvas/settings leaf), then run a protocol to completion. The "Insert into note" button is greyed out and non-interactive.
result: pass

### 3. Button enabled when a markdown note is active
expected: Open any markdown file in the editor, then run a protocol to completion. The "Insert into note" button is clickable (not disabled).
result: issue
reported: "с открытой заметкой кнопка не кликабельна, как во время проходки по сценарию канваса, так и по его завершению (как в режиме вкладки когда плагин работает, так и в режиме сайдбара)"
severity: major

### 4. Button appends text with separator and shows Notice
expected: With a non-empty markdown note active, run a protocol to completion, then press "Insert into note". The protocol text is appended to the end of the note with a horizontal rule separator (---). A Notice "Inserted into {filename}." appears briefly.
result: skipped
reason: Blocked by test 3 — button does not work

### 5. Button disabled state updates on leaf switch
expected: With a markdown note active and a completed protocol shown, switch to a canvas leaf or Settings — the button becomes disabled. Switch back to the markdown note — the button re-enables. No re-run required.
result: pass
notes: Visual disabled state updates correctly, but clicking the button with an open note produces no result (same underlying issue as test 3)

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "Clicking 'Insert into note' appends protocol text to the active markdown file"
  status: failed
  reason: "User reported: button does not work with open note — both during run and after completion, both in tab and sidebar mode"
  severity: major
  test: 3
  root_cause: "getActiveViewOfType(MarkdownView) returns null at click time because clicking the runner panel makes it the active leaf, replacing the markdown leaf as active — the same API call works for the active-leaf-change listener (which fires BEFORE focus shifts) but fails at click time (when RunnerView is already active)"
  fix: "Track last known markdown file in RunnerView via active-leaf-change listener; pass that file to insertIntoCurrentNote() instead of relying on getActiveViewOfType at click time"
  artifacts: [src/views/runner-view.ts, src/main.ts]
  missing: [lastActiveMarkdownFile tracking in RunnerView, file parameter on insertIntoCurrentNote]
