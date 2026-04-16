---
status: diagnosed
phase: 37-snippet-editor-improvements
source: [37-01-SUMMARY.md]
started: 2026-04-16T12:10:00Z
updated: 2026-04-16T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Header "Папка" button creates a root-level folder
expected: In the snippet editor panel, a "Папка" button with a folder-plus icon is visible in the header bar, positioned after the "Новый" button. The button appears as secondary (no accent color). Clicking it opens a modal prompting for a folder name. After entering a name and confirming, the folder appears under .radiprotocol/snippets/ in the tree without manual refresh.
result: pass

### 2. Directory rename updates canvas SnippetNode references (SYNC-01)
expected: Rename a snippet folder in the tree (via inline rename). Any canvas file that references snippets in that folder via SnippetNode subfolderPath is automatically updated to the new folder path. No manual canvas editing required.
result: issue
reported: "В сайбаре Node Editor'а название subfolder path папки меняется на новое, но на самом узле канваса остается старое название папки, остается даже после перезапуска Obsidian"
severity: major

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Renaming a snippet folder in the tree updates all canvas SnippetNode subfolderPath references so the canvas node displays the new folder name"
  status: diagnosed
  reason: "User reported: В сайбаре Node Editor'а название subfolder path папки меняется на новое, но на самом узле канваса остается старое название папки, остается даже после перезапуска Obsidian"
  severity: major
  test: 2
  root_cause: "rewriteCanvasRefs in src/snippets/canvas-ref-sync.ts line 80 updates radiprotocol_subfolderPath but NOT the node text field. Canvas nodes store the folder path in both text and radiprotocol_subfolderPath (confirmed via fixture snippet-node.canvas). Obsidian renders text visually, so old name persists."
  artifacts:
    - src/snippets/canvas-ref-sync.ts
  missing:
    - "node['text'] update in rewriteCanvasRefs when text matches old subfolderPath"
