---
status: complete
phase: 21-color-infrastructure
source: [21-01-SUMMARY.md, 21-02-SUMMARY.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T01:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Color written to canvas node when type is assigned
expected: |
  Open a canvas with a RadiProtocol node. Open that node in the editor panel.
  Select a node type (e.g. "question") from the dropdown and save.
  Inspect the canvas JSON (or open the .canvas file) — the node entry should have
  a "color" field set to the palette string for that type:
    start → "4", question → "5", answer → "2", text-block → "3",
    snippet → "6", loop-start → "1", loop-end → "1"
result: pass

### R1. Regression: Protocol Runner textarea hover color change
expected: |
  In Protocol Runner, hovering over a textarea should NOT change its background
  color — it should remain dark/consistent at all times.
result: issue
reported: "При наведении мышкой на textarea в Protocol Runner меняется цвет с тёмного на сероватый — отвлекает"
severity: minor

### 2. Color changes when node type is switched
expected: |
  With a node already marked as one type (e.g. "answer", color "2"), open the
  editor panel and switch to a different type (e.g. "start"). Save.
  The canvas node's "color" field should now read "4" (start's palette) — the old
  value is gone and the new one is in place.
result: pass

### 3. Color deleted from canvas node when type is cleared
expected: |
  With a node that has a type assigned (and therefore has a "color" field), open
  the editor panel and clear / unmark the node type (set it back to empty / none).
  Save. Inspect the canvas JSON — the "color" field should be completely absent
  from that node's entry (not empty string, not null — removed entirely).
result: pass

### 4. Color is applied in real-time (saveLive path) while canvas is open
expected: |
  With the canvas file open in Obsidian alongside the editor panel, select a node
  type and save. Without closing and reopening the canvas, the node's color should
  update immediately in the canvas view — you should see the node tile change color
  right away, not only after a reload.
result: pass

## Summary

total: 4
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "In Protocol Runner, hovering over a textarea should not change its background color"
  status: failed
  reason: "User reported: hover on textarea changes color from dark to grayish — distracting"
  severity: minor
  test: R1
  artifacts: []
  missing: []
