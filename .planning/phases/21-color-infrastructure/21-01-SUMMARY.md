---
phase: 21-color-infrastructure
plan: "01"
subsystem: canvas/color-infrastructure
tags: [color, node-color-map, tdd, test-contracts]
dependency_graph:
  requires: []
  provides: [NODE_COLOR_MAP, node-color-map-tests, canvas-write-back-color-contract, canvas-live-editor-color-contract]
  affects: [21-02]
tech_stack:
  added: []
  patterns: [Record<string, string> for node type→palette mapping]
key_files:
  created:
    - src/canvas/node-color-map.ts
    - src/__tests__/node-color-map.test.ts
  modified:
    - src/__tests__/canvas-write-back.test.ts
    - src/__tests__/canvas-live-editor.test.ts
decisions:
  - "Record<string, string> used for NODE_COLOR_MAP (not Record<RPNodeKind, string>) — 'snippet' not yet in RPNodeKind; Phase 22 adds it (D-02)"
  - "New unmark-clears-color test in canvas-write-back.test.ts is RED until Plan 02 removes 'color' from Strategy A PROTECTED_FIELDS — documented by design"
  - "Two new canvas-live-editor tests are RED until Plan 02 removes 'color' from live PROTECTED_FIELDS — they are the test contract Plan 02 must satisfy"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-11"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 21 Plan 01: Color Infrastructure Constant and Test Scaffold Summary

**One-liner:** NODE_COLOR_MAP constant (7 type→palette entries per D-01) with full TDD test scaffold; test contracts for Plan 02 integration established in RED state.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create node-color-map.ts and Vitest tests (TDD) | b1e9eec | src/canvas/node-color-map.ts (new), src/__tests__/node-color-map.test.ts (new) |
| 2 | Update existing tests — invert PROTECTED_FIELDS color assertion, add unmark-clears-color test | ca4db41 | src/__tests__/canvas-write-back.test.ts, src/__tests__/canvas-live-editor.test.ts |

---

## What Was Built

### Task 1: NODE_COLOR_MAP constant (TDD GREEN)

`src/canvas/node-color-map.ts` exports `NODE_COLOR_MAP: Record<string, string>` with all 7 node type→palette string mappings per D-01:

| Node Type | Palette | Color |
|-----------|---------|-------|
| start | '4' | green |
| question | '5' | cyan |
| answer | '2' | orange |
| text-block | '3' | yellow |
| snippet | '6' | purple (pre-declared per D-02) |
| loop-start | '1' | red |
| loop-end | '1' | red (intentional share with loop-start) |

4 Vitest tests in `node-color-map.test.ts` all pass (covering COLOR-01, COLOR-03).

### Task 2: Test contracts for Plan 02 (mixed GREEN/RED)

**canvas-write-back.test.ts:**
- Updated PROTECTED_FIELDS test title: removed 'color' from the "never written" list
- Added new test: `unmark path: color field is deleted from canvas JSON when nodeType is cleared (COLOR-02)` — currently **RED** because Strategy A PROTECTED_FIELDS in `editor-panel-view.ts` still contains `'color'`; Plan 02 fixes this

**canvas-live-editor.test.ts:**
- Added new describe block: `CanvasLiveEditor.saveLive() — color write contract` with 2 tests:
  1. `color field is written to canvas node when passed in edits (not PROTECTED)` — RED
  2. `color field is deleted from canvas node on unmark path (COLOR-02, D-06)` — RED
  Both fail because `'color'` is still in `PROTECTED_FIELDS` in `canvas-live-editor.ts`; Plan 02 removes it

---

## Test Status After Plan 01

| Suite | Passing | Failing | Notes |
|-------|---------|---------|-------|
| node-color-map | 4 | 0 | All GREEN |
| canvas-write-back | 5 | 1 | 1 new RED test — Plan 02 makes it GREEN |
| canvas-live-editor | 4 | 2 | 2 new RED tests — Plan 02 makes them GREEN |

Previously passing tests all remain GREEN (no regressions).

---

## Deviations from Plan

None — plan executed exactly as written. The RED tests in canvas-write-back and canvas-live-editor are expected by design (plan explicitly states this).

---

## Known Stubs

None. `NODE_COLOR_MAP` is a complete, fully-populated constant. No placeholder values.

---

## Threat Flags

None. Plan 01 introduces only compile-time constants and test files. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

---

## Self-Check: PASSED

| Item | Result |
|------|--------|
| src/canvas/node-color-map.ts exists | FOUND |
| src/__tests__/node-color-map.test.ts exists | FOUND |
| 21-01-SUMMARY.md exists | FOUND |
| Commit b1e9eec (Task 1) | FOUND |
| Commit ca4db41 (Task 2) | FOUND |
