---
status: complete
phase: 14-node-editor-auto-switch-and-unsaved-guard
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md]
started: 2026-04-09T10:00:00Z
updated: 2026-04-09T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Click a canvas node to load it in the editor
expected: Open the RadiProtocol plugin. With a canvas open, click any node (a single node, not a group or edge). The EditorPanelView should load that node's content on the FIRST click — its fields/properties should appear in the editor panel on the right immediately, without needing a second click.
result: pass

### 2. Click same node again — no reload
expected: With a node already loaded in the editor panel, click that same node on the canvas again. Nothing should change — no flicker, no reload, no clearing of the editor. The panel stays exactly as-is.
result: pass

### 3. Multi-select is silently ignored
expected: Select two or more nodes simultaneously on the canvas (e.g., drag-select a region). The editor panel should NOT change — it should keep showing whatever was loaded before (or stay empty if nothing was loaded). No error, no flash, no update.
result: pass

### 4. Guard modal appears when switching with unsaved edits
expected: Load a node into the editor panel and make a change to one of its fields (so there are pending/unsaved edits). Then click a different node on the canvas. A modal dialog should appear asking if you want to discard your changes — it should have two buttons: one to discard and one to cancel/keep editing.
result: pass

### 5. Guard modal Discard — loads new node
expected: With the unsaved-changes guard modal open (from test 4), click the "Discard" button ONCE. The modal should close immediately and the editor panel should load the newly clicked node's content. No repeated clicking required.
result: pass

### 6. Guard modal Keep Editing — stays on current node
expected: With the unsaved-changes guard modal open (from test 4), click "Keep editing" (or "Cancel") ONCE. The modal should close immediately and the editor panel should remain on the original node with your unsaved edits still intact. The newly clicked node is NOT loaded. No repeated clicking required.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
