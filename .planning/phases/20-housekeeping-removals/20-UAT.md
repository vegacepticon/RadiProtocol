---
status: complete
phase: 20-housekeeping-removals
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md]
started: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Free-text-input node type absent from editor dropdown
expected: Open the editor panel for any node in a canvas. Check the node-type dropdown. "Free-text input" should NOT appear as an option — only the remaining valid node types are shown.
result: pass

### 2. Canvas with legacy free-text-input nodes loads cleanly
expected: Open (or reload) a canvas file that contains nodes of kind `free-text-input`. The canvas should parse and open without errors or crashes. Those nodes are silently skipped — the runner simply ignores them rather than breaking.
result: pass

### 3. Legacy awaiting-snippet-fill session clears on open
expected: If a persisted session exists with runnerStatus `awaiting-snippet-fill` (old format), opening that canvas should NOT restore that session. Instead the runner starts fresh — no error shown to the user, session is simply cleared.
result: pass

### 4. Answer textarea is taller (6 rows)
expected: Open the runner panel and reach a question/answer step. The answer textarea should visually be taller than before — approximately 6 lines of height rather than 2.
result: pass

### 5. Preview textarea hover does NOT change background
expected: Hover over a read-only preview textarea in the runner panel. The background should stay the same — no color shift on hover. The CSS fix overrides any default hover style that was incorrectly suggesting the field is editable.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
