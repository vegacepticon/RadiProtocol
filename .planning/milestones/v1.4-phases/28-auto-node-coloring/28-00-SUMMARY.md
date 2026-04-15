---
phase: 28-auto-node-coloring
plan: "00"
subsystem: tests
tags: [tdd, wave-0, node-coloring, test-infrastructure]
dependency_graph:
  requires: []
  provides: [test-contract-color, makeCanvasNode-helper]
  affects: [src/__tests__/canvas-write-back.test.ts, src/__tests__/test-utils/make-canvas-node.ts]
tech_stack:
  added: []
  patterns: [tdd-red-first, test-utils-factory]
key_files:
  created:
    - src/__tests__/test-utils/make-canvas-node.ts
  modified:
    - src/__tests__/canvas-write-back.test.ts
decisions:
  - "5 RED tests added for Wave 0 TDD — expected to fail until Wave 1 implements color injection in saveNodeEdits"
  - "UNKNOWN TYPE test passes immediately — existing code already does not write color for unknown types"
  - "makeCanvasNode derives color from NODE_COLOR_MAP[type] — single source of truth prevents sync drift"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-13T13:38:23Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 28 Plan 00: Wave 0 Test Infrastructure Summary

**One-liner:** TDD Wave 0 — replaced old "color never written" contract with 5 new color-injection tests and added `makeCanvasNode` helper deriving color from `NODE_COLOR_MAP`.

---

## What Was Done

### Task 1: Updated color contract in canvas-write-back.test.ts

Replaced the old test at line 57 (`PROTECTED_FIELDS: id, x, y, width, height, type, color are never written`) with 5 new tests defining the Phase 28 contract:

| Test | Status | Notes |
|------|--------|-------|
| TYPE-CHANGE question → color '5' | RED (expected) | Wave 1 will make it green |
| TYPE-CHANGE start → color '4' | RED (expected) | Wave 1 will make it green |
| FIELD-ONLY: already-typed node gets correct color | RED (expected) | Wave 1 will make it green |
| OVERWRITE: wrong color overwritten with correct color | RED (expected) | Wave 1 will make it green |
| UNKNOWN TYPE: no color written | GREEN | Existing code already doesn't write color for unknown types |
| live-save: saveLive receives enriched edits with color | RED (expected) | Wave 1 will make it green |

Existing tests preserved: `radiprotocol_* fields are written`, `undefined values delete the key`, `un-mark cleanup`.

Live-save test updated: `mockSaveLive` assertion now expects `{ radiprotocol_nodeType: 'question', color: '5' }` (enriched edits per D-01, D-02).

**Commit:** `661cce2`

### Task 2: Created makeCanvasNode helper (NODE-COLOR-03)

Created `src/__tests__/test-utils/make-canvas-node.ts` with:
- `makeCanvasNode(type: RPNodeKind, overrides?)` — factory function
- Color auto-derived from `NODE_COLOR_MAP[type]` (D-07, D-08)
- Imports from `../../canvas/node-color-map` and `../../graph/graph-model`
- Compiles without TypeScript errors

**Commit:** `46656af`

---

## Verification

- `npm test -- --run` completes without TypeScript/compilation errors
- Test suite: 8 failed (5 new RED Phase 28 tests + 3 pre-existing runner-extensions RED stubs) | 168 passed
- `grep "color are never written" canvas-write-back.test.ts` → no match (old `it()` block removed)
- `grep -c "TYPE-CHANGE\|FIELD-ONLY\|OVERWRITE\|UNKNOWN TYPE"` → 6 matches
- `makeCanvasNode` exports verified: function, `NODE_COLOR_MAP[type]` usage, import statement

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. The 5 RED tests are intentional TDD stubs — they describe the Wave 1 contract. They are expected to be RED until `saveNodeEdits` is updated in Plan 28-01.

---

## Threat Flags

None — test-only files, no production surface changes.

---

## Self-Check: PASSED

| Item | Result |
|------|--------|
| src/__tests__/canvas-write-back.test.ts | FOUND |
| src/__tests__/test-utils/make-canvas-node.ts | FOUND |
| .planning/phases/28-auto-node-coloring/28-00-SUMMARY.md | FOUND |
| commit 661cce2 (Task 1) | FOUND |
| commit 46656af (Task 2) | FOUND |
