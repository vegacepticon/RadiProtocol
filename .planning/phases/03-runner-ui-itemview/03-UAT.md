---
status: partial
phase: 03-runner-ui-itemview
source: [03-00-SUMMARY.md, 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-04-06T00:00:00Z
updated: 2026-04-06T12:00:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing paused — 13 items blocked on prior-phase: plan 04 not yet executed]

## Tests

### 1. Vitest test suite
expected: Run `npx vitest run` in the project root. Expect 52 tests to pass with exactly 1 pre-existing RED stub (node-picker-modal dynamic import, now GREEN after plan 03). All runner-extensions tests (3), runner-commands tests (2), settings-tab tests (4), and RunnerView basic tests (4) should be GREEN. Exit code 0.
result: pass

### 2. TypeScript compiles clean
expected: Run `npx tsc --noEmit --skipLibCheck`. Expect 0 errors. (Plan 00 RED stubs introduced 2 TS errors from Wave 0 intentional stubs — after plans 01–03 these should all be resolved.)
result: issue
reported: "src/__tests__/runner-extensions.test.ts:35:5 - error TS2722: Cannot invoke an object which is possibly 'undefined'. The dynamic property access `(runner as unknown as Record<string, (t: string) => void>)['setAccumulatedText']` causes a TS error."
severity: minor

### 3. Two-zone layout
expected: Open the RadiProtocol runner view in Obsidian (requires plan 04 to be executed first — if not done, mark blocked). The view shows two vertical zones: a question zone at the top and a preview/output zone below it with a textarea and output toolbar (Copy/Save buttons).
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 4. Collapsible legend
expected: At the bottom of the runner view, a "Legend" disclosure element is visible. Clicking it expands to show 7 rows describing node types (start, question, answer, text-block, end, dead-end, loop). Clicking again collapses it.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 5. Open canvas file
expected: With the runner view open, trigger the "Run protocol" command (or openCanvas programmatically). The view loads a .canvas file, displays the first question node's text in the question zone, and shows answer buttons below it.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 6. Answer buttons advance the runner
expected: After loading a canvas, the question zone shows the current question text and one button per answer branch. Clicking an answer button advances to the next node and re-renders the question zone with the new node's content.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 7. Accumulated text in preview
expected: As the runner advances through nodes, the preview textarea accumulates the text output of each node. The textarea content grows as you progress through the protocol.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 8. Copy button behavior
expected: With some text in the preview textarea, click the Copy button. The text is copied to the clipboard. The button label briefly changes to "Copied!" then reverts to "Copy" after ~1.5 seconds.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 9. Save button creates a note
expected: With some text in the preview textarea, click the Save button. A new note appears in the configured output folder (default: "RadiProtocol Output/") with a timestamped filename (e.g. "2026-04-06T…-protocol.md"). A toast notification shows the path. The note contains the accumulated text.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 10. Manual text edit updates runner state
expected: Edit the text in the preview textarea manually. Then trigger Copy or Save. The copied/saved content reflects your edits, not the original accumulated text.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 11. Button visibility follows output destination setting
expected: Open Settings → RadiProtocol. Change "Output destination" to "Clipboard only" — the Save button disappears from the runner view. Change to "New note only" — the Copy button disappears. Change to "Both" — both buttons are visible.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 12. Buttons disabled when textarea is empty
expected: With the runner in idle state (or textarea empty/whitespace-only), the Copy and Save buttons are visually disabled and non-interactive. Once the textarea has text, the buttons become enabled.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 13. Node picker modal opens
expected: Run the "Start protocol from node" command. A fuzzy-search modal appears titled with a placeholder. The modal lists all question and text-block nodes from the currently loaded canvas (questions first, then text-blocks, each group alphabetically).
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 14. Node picker fuzzy search
expected: With the node picker modal open, type part of a node label. The list filters to show only matching nodes. Clearing the input shows all nodes again.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

### 15. Start protocol from specific node
expected: Select a node in the picker modal. The runner view immediately renders that node as the current position, bypassing the normal start node. The question zone shows the selected node's content.
result: blocked
blocked_by: prior-phase
reason: "plan 04 not yet executed — view not accessible in Obsidian"

## Summary

total: 15
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 13

## Gaps

- truth: "npx tsc --noEmit --skipLibCheck exits with 0 errors"
  status: failed
  reason: "User reported: src/__tests__/runner-extensions.test.ts:35:5 - error TS2722: Cannot invoke an object which is possibly 'undefined'."
  severity: minor
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
