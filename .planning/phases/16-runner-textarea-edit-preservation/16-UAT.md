---
status: complete
phase: 16-runner-textarea-edit-preservation
source: [16-01-SUMMARY.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Manual edit preserved — Answer button
expected: Open a protocol in the runner that reaches a choice node. Manually edit the preview textarea (type or change some text). Click the Answer button to advance. Undo (Ctrl+Z) the step. The textarea should restore to what you had typed — not the original pre-edit text.
result: pass

### 2. Manual edit preserved — Free-text submit
expected: Open a protocol in the runner that reaches a free-text input node. Manually edit the preview textarea before submitting. Click the free-text submit button. Undo. The textarea should restore to your manually typed text.
result: pass
note: Retested after phase 17 fixed free-text input node type support.

### 3. Manual edit preserved — Loop "again"
expected: Open a protocol in the runner at a loop node. Manually edit the preview textarea. Click the "again" button to loop. Undo. The textarea should restore to your manually typed text.
result: pass

### 4. Manual edit preserved — Loop "done"
expected: Open a protocol in the runner at a loop node. Manually edit the preview textarea. Click the "done" button to exit the loop. Undo. The textarea should restore to your manually typed text.
result: pass

### 5. Complete-state toolbar uses live textarea value
expected: Run a protocol to completion. In the complete state, manually edit the textarea (change some text). Click Copy, Save, or Insert. The action should use your edited text — not the text that was there when the complete state was first rendered.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
