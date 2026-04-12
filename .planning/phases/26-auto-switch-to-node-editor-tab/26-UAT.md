---
status: complete
phase: 26-auto-switch-to-node-editor-tab
source: [26-01-SUMMARY.md, 26-02-SUMMARY.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Auto-switch to Node Editor tab on canvas node click
expected: Open a canvas file and click any node. The Node Editor panel (right sidebar tab) should automatically come to the foreground — even if another tab is active in that sidebar pane. No manual tab-switching required.
result: pass

### 2. Auto-save on field edit
expected: While in the Node Editor panel, change any field value (e.g., edit a question or answer text). After ~800 ms of inactivity, a brief "Saved ✓" indicator appears and the change is persisted — no Save button press needed.
result: pass

### 3. Type dropdown change triggers immediate save with color update
expected: In the Node Editor, change the node type via the type dropdown. The save happens immediately (no 800 ms wait), the "Saved ✓" indicator appears, and the canvas node's color updates to match the new type.
result: issue
reported: "нет, почему-то цвета перестали меняться при выборе того или иного типа узла"
severity: major

### 4. Silent flush on node switch — no modal
expected: Edit a field in Node Editor (triggering a pending auto-save), then immediately click a different canvas node. No modal or dialog appears. The pending edits from the first node are saved silently, and the editor loads the second node.
result: pass

### 5. Save button removed — only "Saved ✓" indicator
expected: The Node Editor form no longer has an explicit "Save" button. Instead, a "Saved ✓" indicator appears briefly after each auto-save, then fades out.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Changing node type in the dropdown immediately updates the canvas node's color to match the new type"
  status: fixed
  reason: "User reported: цвета перестали меняться при выборе того или иного типа узла"
  severity: major
  test: 3
  root_cause: "'color' was in PROTECTED_FIELDS in both canvas-live-editor.ts and editor-panel-view.ts, silently skipping color on every save path"
  fix_commit: "0539332"
  verified: true
