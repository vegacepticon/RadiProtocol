---
status: complete
phase: 48-node-editor-ux-polish
source:
  - .planning/phases/48-node-editor-ux-polish/48-01-SUMMARY.md
  - .planning/phases/48-node-editor-ux-polish/48-02-SUMMARY.md
started: 2026-04-19T07:17:00Z
updated: 2026-04-19T07:27:00Z
---

## Current Test

[testing complete]

## Tests

### 1. NODEUI-01 — Snippet ID row removed from Text-block form
expected: Open the Node Editor panel on a Text-block node. The form shows Kind, Text content, and any other existing Text-block fields, but there is NO "Snippet ID (optional)" input row.
result: pass

### 2. NODEUI-01 — Legacy canvases with snippetId still load
expected: Open a canvas that already contains a text-block node with a saved `radiprotocol_snippetId`. The canvas opens without errors; running the protocol still triggers the snippet-fill flow (awaiting-snippet-fill) for that node — i.e., on-disk snippet IDs continue to work even though the UI no longer edits them.
result: pass

### 3. NODEUI-02 — Quick-create places new nodes BELOW anchor
expected: Select any node and click one of the quick-create buttons (e.g. add Text-block / Question / Answer). The new node appears directly BELOW the selected anchor node (same x, y = anchor.y + anchor.height + gap), not to the right of it.
result: pass

### 4. NODEUI-03 — Answer form shows Display label ABOVE Answer text
expected: Open the Node Editor on an Answer node. The form field order is: (1) Display label (optional), (2) Answer text, (3) Text separator — Display label renders ABOVE Answer text.
result: pass

### 5. NODEUI-04 — Question form uses custom-DOM textarea block
expected: Open the Node Editor on a Question node. The Question text block shows: a bold "Question text" label on top, a muted helper/description line below the label, and a full-width textarea below the helper (not Obsidian's default Setting row layout).
result: pass

### 6. NODEUI-04 — Question textarea auto-grows and persists
expected: Type several lines into the Question textarea. The textarea height grows automatically as content overflows (no inner scrollbar for normal lengths). Click away to another node and reopen the Question node — the typed content is preserved.
result: pass

### 7. NODEUI-05 — Idle toolbar anchored at bottom as vertical column
expected: Open the Node Editor with no node selected (idle state). The quick-create toolbar is rendered at the BOTTOM of the panel as a full-width vertical stack of buttons (one button per row), not as a horizontal row at the top.
result: pass
follow_up: "User reported large fixed gap between form fields and bottom-anchored toolbar; requested buttons be placed closer to form content. Tracked in Gaps section as cosmetic follow-up."

### 8. NODEUI-05 — Form-state toolbar stays at bottom
expected: Select a node to enter form state. The quick-create toolbar remains at the BOTTOM of the panel, below all form fields, as a full-width vertical stack.
result: pass

### 9. NODEUI-05 — Narrow sidebar: buttons stack vertically without wrap
expected: Resize the Node Editor sidebar to roughly 300px wide. The toolbar buttons remain a clean vertical column — each button full-width, no horizontal wrapping, no overflow.
result: pass

### 10. Regression — existing protocol runs unaffected
expected: Open a previously-working protocol canvas and run it end-to-end. Navigation, text-block display, question prompts, answer capture, and snippet fill all behave the same as before Phase 48 — no regressions.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "Quick-create toolbar should sit closer to form content (smaller gap between last form field and toolbar)"
  status: follow_up
  reason: "User feedback during UAT Test 7: 'большой фиксированный разрыв, можно их подвинуть ближе?' — bottom-anchor via margin-top:auto pushes toolbar all the way to panel bottom, leaving a large visible empty gap when form content is short"
  severity: cosmetic
  test: 7
  artifacts: []
  missing: []
