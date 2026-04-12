---
phase: 26-auto-switch-to-node-editor-tab
plan: "02"
subsystem: node-editor
tags: [auto-save, debounce, editor-panel, node-color-map, ux]
dependency_graph:
  requires: [26-01]
  provides: [scheduleAutoSave, onTypeDropdownChange, showSavedIndicator, flush-on-switch, NODE_COLOR_MAP]
  affects: [handleNodeClick, loadNode, saveNodeEdits, renderForm, buildKindForm]
tech_stack:
  added: []
  patterns: [debounce-timer-snapshot, flush-before-switch, saved-indicator-opacity]
key_files:
  created:
    - src/canvas/node-color-map.ts
  modified:
    - src/views/editor-panel-view.ts
    - styles.css
    - src/styles.css
  deleted:
    - src/views/node-switch-guard-modal.ts
decisions:
  - "Snapshot edits at schedule time in scheduleAutoSave() — not at fire time — to prevent stale-closure corruption (T-26-04)"
  - "flush save failure in handleNodeClick() is silent — does not block node navigation (T-26-05)"
  - "free-text-input added to NODE_COLOR_MAP with orange ('2') — same family as answer; RPNodeKind gained this value in Phase 25 after Phase 23 wrote the original map"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-12"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 26 Plan 02: Restore Auto-Save and Remove NodeSwitchGuardModal Summary

**One-liner:** Phase 23 auto-save restored in EditorPanelView — 800 ms debounce with flush-on-switch, immediate type-change save with color mapping, Saved indicator replacing Save button; NodeSwitchGuardModal removed.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Restore node-color-map.ts and add saved-indicator CSS | 14a92e8 | src/canvas/node-color-map.ts, styles.css, src/styles.css |
| 2 | Restore full Phase 23 auto-save in editor-panel-view.ts | 9803c4d | src/views/editor-panel-view.ts, src/canvas/node-color-map.ts, src/views/node-switch-guard-modal.ts (deleted) |

---

## What Was Built

### `node-color-map.ts` — src/canvas/node-color-map.ts (restored)

`NODE_COLOR_MAP` covering all 8 `RPNodeKind` values (including `free-text-input` added in Phase 25 and `snippet` added in Phase 22). Maps each kind to an Obsidian canvas palette color string `"1"`–`"6"`.

### Auto-save fields — EditorPanelView

Three new private fields:
- `_debounceTimer` — holds the pending auto-save timeout handle
- `_savedIndicatorEl` — reference to the "Saved ✓" indicator DOM element
- `_indicatorTimer` — holds the indicator fade-out timeout handle

### `scheduleAutoSave()` — debounced 800 ms save

Snapshots `filePath`, `nodeId`, and `pendingEdits` at schedule time (not fire time). Called from every `onChange` in `buildKindForm()` — 15 call sites across question, answer, free-text-input, text-block, loop-start, loop-end cases.

### `onTypeDropdownChange()` — immediate type+color save

Cancels any pending debounce, looks up `NODE_COLOR_MAP[selectedType]`, writes color into the edits snapshot, then calls `saveNodeEdits()` immediately. Clears color on unmark path.

### `showSavedIndicator()` — brief "Saved ✓" feedback

Adds `is-visible` class to the indicator element; schedules `removeClass` after 2000 ms. Null-guards against rapid node switches (T-26-07 accepted disposition).

### `handleNodeClick()` flush block

Replaced `NodeSwitchGuardModal` dirty-guard with debounce flush: if `_debounceTimer !== null`, clears it and `await saveNodeEdits()` with a snapshot before proceeding to `loadNode()`. Flush failure is silent (try/catch) and does not block navigation (T-26-05 accepted disposition).

### `loadNode()` safety net

Clears any stale `_debounceTimer` at the start of `loadNode()` before setting `currentFilePath`, covering callers outside `handleNodeClick()`.

### CSS changes

- `.rp-editor-save-row` removed from `styles.css` and `src/styles.css`
- `.rp-editor-saved-indicator` added: `opacity: 0`, `transition: opacity 0.2s ease`
- `.rp-editor-saved-indicator.is-visible` added: `opacity: 1`

### Deleted

`src/views/node-switch-guard-modal.ts` — no remaining consumers after the import was replaced in `editor-panel-view.ts`.

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Snapshot edits at schedule time in scheduleAutoSave() | Prevents stale-closure bug: if pendingEdits mutates between schedule and fire, the wrong data would be saved (T-26-04 mitigation) |
| flush save failure is silent | A save error during node switch should not prevent the user from navigating to the next node (T-26-05 accepted) |
| free-text-input orange ('2') in NODE_COLOR_MAP | RPNodeKind gained this value in Phase 25; same "user action" family as answer; duplicate palette colors are allowed by Obsidian canvas |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added free-text-input to NODE_COLOR_MAP**
- **Found during:** Task 2 (TypeScript build)
- **Issue:** `Record<RPNodeKind, string>` requires all 8 members; Phase 25 added `free-text-input` to `RPNodeKind` after Phase 23 wrote the original map. The plan's interface spec listed only 7 entries, omitting `free-text-input`.
- **Fix:** Added `'free-text-input': '2'` (orange — same family as answer) to `node-color-map.ts`.
- **Files modified:** src/canvas/node-color-map.ts
- **Commit:** 9803c4d (included in Task 2 commit)

---

## Known Stubs

None.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All threat register items (T-26-04 through T-26-07) were addressed as specified.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/canvas/node-color-map.ts exists | FOUND |
| src/views/editor-panel-view.ts exists | FOUND |
| src/views/node-switch-guard-modal.ts deleted | CONFIRMED |
| styles.css has .rp-editor-saved-indicator | FOUND |
| src/styles.css has .rp-editor-saved-indicator | FOUND |
| Commit 14a92e8 exists | FOUND |
| Commit 9803c4d exists | FOUND |
| npm run build exits 0 | PASSED |
| npm test — 3 pre-existing failures only, no new failures | PASSED |
