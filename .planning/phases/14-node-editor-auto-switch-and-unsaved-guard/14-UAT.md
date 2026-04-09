---
status: complete
phase: 14-node-editor-auto-switch-and-unsaved-guard
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T09:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Click a canvas node to load it in the editor
expected: Open the RadiProtocol plugin. With a canvas open, click any node (a single node, not a group or edge). The EditorPanelView should load that node's content — its fields/properties should appear in the editor panel on the right.
result: issue
reported: "Да, загрузка происходит, но узлы переключаются только после второго нажатия (т.е. я сначала выделяю узел, а потом вторым нажатием только открываю его настройки в сайдбаре)"
severity: major

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
expected: With the unsaved-changes guard modal open (from test 4), click the "Discard" button. The modal should close and the editor panel should load the newly clicked node's content. Your unsaved changes to the previous node are gone.
result: issue
reported: "После того как нажимаю Discard - модалка остается, приходится нажать несколько раз (насчитал 12 раз в одной попытке, в другой почему-то 14) чтобы модалка пропала и только тогда она пропадает и выделяется с открытием настроек другой узел."
severity: blocker

### 6. Guard modal Keep Editing — stays on current node
expected: With the unsaved-changes guard modal open (from test 4), click "Keep editing" (or "Cancel"). The modal should close and the editor panel should remain on the original node with your unsaved edits still intact. The newly clicked node is NOT loaded.
result: issue
reported: "Нажимаю, сразу ничего не происходит, также как и в предыдущем тесте, приходится нажать много раз на кнопку прежде чем закроется модалка, с каждой попыткой будто бы добавляется два нажатия к общему количеству требуемых нажатий, но в итоге остается выделенным прежний узел и открыты его настройки"
severity: blocker

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Clicking a canvas node should immediately load it in the EditorPanelView on the first click."
  status: failed
  reason: "User reported: node requires two clicks — first click selects/highlights the node, second click loads it in the sidebar editor."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Clicking Discard in the guard modal should close the modal immediately and load the new node in one click."
  status: failed
  reason: "User reported: modal stays open after clicking Discard, requires 12–14 clicks before it finally closes and the new node loads."
  severity: blocker
  test: 5
  artifacts: []
  missing: []

- truth: "Clicking Keep Editing in the guard modal should close the modal immediately and keep the original node loaded."
  status: failed
  reason: "User reported: modal does not close on first click, requires many clicks; each attempt seems to add ~2 more required clicks. Correct node is preserved after eventual close."
  severity: blocker
  test: 6
  artifacts: []
  missing: []
