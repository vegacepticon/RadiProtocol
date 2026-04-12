---
status: complete
phase: 27-interactive-placeholder-editor
source: [27-01-SUMMARY.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Chip appearance
expected: Open a snippet with placeholders in SnippetManagerView (the snippet editor panel). Each placeholder renders as a horizontal chip — not the old expandable row. The chip has: a coloured left bar matching the placeholder's type, a human-readable label (never raw {{id}} syntax), a type badge, a ⠿ drag handle on the left, and a × remove button on the right.
result: pass

### 2. Click-to-expand chip
expected: Click anywhere on a chip body (not on the ⠿ handle, not on the × remove button). The chip expands to reveal its editable fields (the detail form). Clicking again collapses it. Clicking directly on the handle or remove button does NOT trigger expand.
result: pass

### 3. Drag-and-drop reorder
expected: Grab a chip by its ⠿ handle and drag it to a different position in the list. When you release, the chip moves to the dropped position and the list updates immediately to reflect the new order.
result: pass

### 4. Auto-save notice after drop
expected: After completing a drag-and-drop reorder (dropping the chip), a "Snippet saved." notice appears briefly in the Obsidian UI. The reordered list remains visible with the new order intact.
result: pass

### 5. FillInModal tab order follows persisted order
expected: After reordering placeholders via drag-and-drop (and seeing the save notice), open the SnippetFillInModal for that snippet (run the snippet). The input fields appear in the same order as the reordered chip list — the modal's tab order now matches what you set in the editor.
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
