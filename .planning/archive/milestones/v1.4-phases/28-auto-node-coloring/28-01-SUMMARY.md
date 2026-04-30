---
phase: 28-auto-node-coloring
plan: "01"
subsystem: editor
tags: [node-coloring, saveNodeEdits, color-injection, pattern-b, strategy-a]
dependency_graph:
  requires: [28-00]
  provides: [color-injection-saveNodeEdits]
  affects: [src/views/editor-panel-view.ts]
tech_stack:
  added: []
  patterns: [enriched-edits-spread, fallback-type-resolution]
key_files:
  created: []
  modified:
    - src/views/editor-panel-view.ts
decisions:
  - "enrichedEdits spread created at top of saveNodeEdits — single injection point before Pattern B / Strategy A fork"
  - "Two-priority type resolution: edits['radiprotocol_nodeType'] first, then existing canvas node's type for field-only saves"
  - "isTypeChange flag drives fallback resolution — avoids redundant lookups on type-change path"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-13T13:41:41Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 28 Plan 01: Color Injection in saveNodeEdits Summary

**One-liner:** Color injection via enrichedEdits spread in saveNodeEdits — resolves type from edit or existing node and writes NODE_COLOR_MAP color to both Pattern B (saveLive) and Strategy A (vault.modify) paths.

---

## What Was Done

### Task 1: Added color injection in saveNodeEdits

Modified `src/views/editor-panel-view.ts` — `saveNodeEdits` method only. Added ~31 lines.

**Changes (in order of execution):**

1. **Phase 28 injection block** — At the start of `saveNodeEdits`, before the `try/saveLive` block:
   - `enrichedEdits = { ...edits }` spread to avoid mutating caller's object
   - `isTypeChange` / `isUnmarkingType` flags derived from presence and value of `radiprotocol_nodeType` key
   - D-04 priority 1: if type is explicitly set and known, inject `enrichedEdits['color']` from `NODE_COLOR_MAP`

2. **Pattern B path** — `saveLive(filePath, nodeId, enrichedEdits)` now receives the color-enriched payload

3. **D-04 fallback block** — After `canvasData.nodes.findIndex()`, before the PROTECTED_FIELDS write loop:
   - Only runs when `!isTypeChange` (field-only save)
   - Reads `existingNode['radiprotocol_nodeType']` from parsed canvas JSON
   - Injects `enrichedEdits['color']` if type is known in `NODE_COLOR_MAP`

4. **Strategy A write loop** — All `edits` references replaced with `enrichedEdits`:
   - `nodeTypeEdit = enrichedEdits['radiprotocol_nodeType']`
   - `'radiprotocol_nodeType' in enrichedEdits` guard for unmark path
   - `for...of Object.entries(enrichedEdits)` write loop

**Preserved:** `delete node['color']` on unmark path (D-06 compliance).

**Commit:** `f741dd7`

---

## Verification

- `npm run build` — completed without TypeScript errors
- `npm test -- --run` — 173 passed, 3 failed (pre-existing RED stubs in runner-extensions.test.ts, unchanged from Wave 0)

Canvas-write-back tests (all green):

| Test | Result |
|------|--------|
| TYPE-CHANGE: question → color '5' | PASS |
| TYPE-CHANGE: start → color '4' | PASS |
| FIELD-ONLY: already-typed node gets correct color | PASS |
| OVERWRITE: wrong color overwritten with correct | PASS |
| UNKNOWN TYPE: no color written | PASS |
| radiprotocol_* fields written via vault.modify() | PASS |
| undefined values delete the key | PASS |
| live-save: saveLive receives enriched edits with color | PASS |
| un-mark cleanup: radiprotocol_* and color removed | PASS |

Grep acceptance checks:
- `NODE_COLOR_MAP` in editor-panel-view.ts: 4 matches (import + 2 usage sites)
- `enrichedEdits` in editor-panel-view.ts: 9 matches
- `saveLive.*enrichedEdits`: 1 match (Pattern B path confirmed)
- `delete node['color']`: 1 match (unmark path preserved)

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. All Wave 0 RED tests are now green. The 3 pre-existing RED stubs in `runner-extensions.test.ts` are out of scope for Phase 28.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Color injection uses only hardcoded palette strings from `NODE_COLOR_MAP` (T-28-01-01 accepted).

---

## Self-Check: PASSED

| Item | Result |
|------|--------|
| src/views/editor-panel-view.ts modified | FOUND |
| enrichedEdits in editor-panel-view.ts (>=4) | 9 — FOUND |
| saveLive receives enrichedEdits | FOUND |
| delete node['color'] preserved | FOUND |
| commit f741dd7 | FOUND |
| npm build — no errors | PASSED |
| npm test — canvas-write-back all green | PASSED |
