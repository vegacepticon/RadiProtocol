---
status: partial
phase: 63-bidirectional-canvas-node-editor-sync
source:
  - 63-01-SUMMARY.md
  - 63-02-SUMMARY.md
  - 63-03-SUMMARY.md
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

## Current Test

[testing paused — 2 gaps diagnosed, fix plans ready for execution]

## Tests

### 1. Snippet edge label syncs to open form
expected: Editing a Question→Snippet edge label on canvas updates the branch label field in the open Node Editor within ~1 second
result: pass

### 2. Answer edge label syncs to open form
expected: Editing a Question→Answer edge label on canvas updates the display label field in the open Node Editor within ~1 second
result: pass

### 3. In-flight protection while typing
expected: Focus a text field in the Node Editor and start typing. While you are typing, have a collaborator (or another pane) change the same field via canvas. Your typing continues uninterrupted, caret/selection stays in place, and the field does not jump or flash
result: issue
reported: "User redirected to two other issues: (a) Snippet branch label outbound does not update edge label, and (b) canvas node text edits do not sync inbound to form fields. In-flight protection status itself not verified."
severity: major

### 4. Post-blur flush of pending canvas update
expected: Focus a field in the Node Editor. Change that same field from the canvas (it should be blocked while focused). Blur the field (click elsewhere or Tab away). The canvas update now appears in the field you just left
result: [pending]

### 5. Node type change triggers full re-render
expected: Open the Node Editor on a node. Change that node's type on the canvas (e.g., Question → Text block). The Node Editor form fully re-renders to show the correct fields for the new node type
result: [pending]

### 6. Node deletion clears the editor
expected: Open the Node Editor on a node. Delete that node on the canvas. The Node Editor switches to its idle/empty state (no form shown)
result: [pending]

### 7. Cold-open silent migration
expected: Open a pre-Phase-63 canvas that has radiprotocol_snippetLabel on a node but NO label on the incoming Question→Snippet edge. Make any small edit on the canvas. The edge automatically gets a label matching the node's snippetLabel. No Notice or popup is shown to the user
result: [pending]

## Summary

total: 7
passed: 2
issues: 1
pending: 4
skipped: 0

## Gaps

- truth: "Snippet branch label edited in Node Editor should update the incoming Question→Snippet edge label on canvas (outbound sync)"
  status: failed
  reason: "User reported: typing into Snippet branch label field does not change edge label; on blur the field reverts to edge label because reconciler edge-wins overwrites it back. Missing collectIncomingEdgeEdits equivalent for snippet kind."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Editing node text directly on canvas should sync inbound to open Node Editor form fields (questionText, answerText, content, headerText)"
  status: failed
  reason: "User reported: changing text directly on canvas nodes does not update the corresponding form fields. Obsidian canvas writes to the generic 'text' property, but the snapshot baseline only diffs the canonical radiprotocol_* fields which take precedence over 'text' in the parser."
  severity: major
  test: 3
  artifacts: []
  missing: []
