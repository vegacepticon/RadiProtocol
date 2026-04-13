---
status: complete
phase: 29-snippet-node-model-editor-validator
source: [29-00-SUMMARY.md, 29-01-SUMMARY.md, 29-02-SUMMARY.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Snippet option in EditorPanel dropdown
expected: Open the node editor for any node. The "Kind" dropdown should include a "Snippet" option alongside existing kinds (Question, Delay, Start, End, etc.).
result: pass

### 2. Snippet form shows subfolder picker
expected: Select "Snippet" from the Kind dropdown. A "Subfolder" dropdown should appear below and automatically populate with available subfolders found under `.radiprotocol/snippets/` in your vault. If the folder doesn't exist or is empty, the dropdown should still render (with just the default empty/root option).
result: pass

### 3. Root scope — no subfolder selected
expected: With a snippet node open in the editor, leave the Subfolder picker at its default (no selection / empty). Save the node. Open the `.canvas` file in a text editor — the snippet node's JSON object should NOT have a `radiprotocol_subfolderPath` key (root scope = key absent).
result: pass

### 4. Subfolder selection updates canvas node label
expected: With a snippet node open, select a subfolder from the picker (e.g., "CT/adrenal"). Save. The canvas node's visible text label on the canvas should update to display the selected path ("CT/adrenal"). Also verify the `.canvas` JSON has `"radiprotocol_subfolderPath": "CT/adrenal"`.
result: pass

### 5. Snippet node renders in purple on canvas
expected: Open a canvas that contains a snippet-kind node (or create one via the Editor). The node should appear in purple color, visually distinct from other node kinds (which use different colors).
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
