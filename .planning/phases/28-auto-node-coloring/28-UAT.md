---
status: complete
phase: 28-auto-node-coloring
source: [28-00-SUMMARY.md, 28-01-SUMMARY.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Set node type → canvas color written
expected: Open the Node Editor for an untyped canvas node. Select "question" as the type and save. Open the .canvas file (or reload it in Obsidian) — the node's JSON should have `"color": "5"` (cyan).
result: pass

### 2. Different type → correct color
expected: Set a different node type — e.g. "start". After saving, the node JSON should have `"color": "4"` (green). Each type maps to its own palette color: answer/free-text-input → "2" (orange), text-block → "3" (yellow), loop-start/loop-end → "1" (red).
result: pass

### 3. Field-only save preserves color
expected: On a node already typed as "question" (color "5"), edit a field (e.g. label text) WITHOUT changing the type. After saving, the node's color in the .canvas file should still be "5" — it doesn't get wiped.
result: pass

### 4. Wrong color corrected on save
expected: Manually edit the .canvas file to give a "question" node an incorrect color (e.g. "1"). Reopen in Obsidian, open the Node Editor for that node and save any change. The color in the file should now read "5" (the correct value for "question"), not "1".
result: pass

### 5. Unmark node type → color removed
expected: On a node typed as "start" (color "4"), clear / unmark its type in the Node Editor and save. The node's JSON in the .canvas file should no longer contain a `"color"` key at all.
result: pass

### 6. Unknown type → no color written
expected: If somehow a node carries an unrecognized type string (not in NODE_COLOR_MAP), saving it through the Node Editor should NOT write a color key — the node JSON stays without `"color"`.
result: skipped
reason: hard to trigger manually

## Summary

total: 6
passed: 5
issues: 0
pending: 0
skipped: 1

## Gaps

[none yet]
