---
phase: 38-canvas-node-creation-infrastructure
plan: 01
subsystem: canvas-node-factory
tags: [canvas, node-creation, service-layer, tdd]
dependency_graph:
  requires: [node-color-map, graph-model, canvas-internal]
  provides: [CanvasNodeFactory, CreateNodeResult]
  affects: []
tech_stack:
  added: []
  patterns: [runtime-api-probing, auto-color-from-map]
key_files:
  created:
    - src/canvas/canvas-node-factory.ts
    - src/__tests__/canvas-node-factory.test.ts
  modified:
    - src/types/canvas-internal.d.ts
decisions:
  - "Color applied via setData() not setColor() — per Research Pitfall 4"
  - "No debouncing — node creation is atomic, unlike live edits"
metrics:
  duration: 2min
  completed: 2026-04-16
  tasks: 2
  files: 3
---

# Phase 38 Plan 01: CanvasNodeFactory Service Summary

CanvasNodeFactory service with runtime API probing, auto-color from NODE_COLOR_MAP, and anchor-based positioning via createTextNode internal API.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend canvas-internal.d.ts with createTextNode types | 6eb1ec8 | src/types/canvas-internal.d.ts |
| 2 | Create CanvasNodeFactory service with TDD | c61c3c2, 11d883d | src/canvas/canvas-node-factory.ts, src/__tests__/canvas-node-factory.test.ts |

## TDD Gate Compliance

- RED gate: `test(38-01)` commit c61c3c2 -- 8 failing tests
- GREEN gate: `feat(38-01)` commit 11d883d -- all 8 tests pass
- REFACTOR gate: not needed -- implementation clean on first pass

## Implementation Details

### Task 1: Type Extensions
Extended `canvas-internal.d.ts` with:
- `CanvasNodeInternal` interface (id, x, y, width, height, color, getData, setData, setColor)
- `nodes: Map<string, CanvasNodeInternal>` on CanvasInternal
- `createTextNode(options)` method on CanvasInternal

All existing types preserved unchanged. Existing 4 canvas-live-editor tests pass.

### Task 2: CanvasNodeFactory Service
Created `canvas-node-factory.ts` (112 lines) with:
- `createNode(canvasPath, nodeKind, anchorNodeId?)` -- creates node via createTextNode API
- Runtime probing: checks canvas leaf exists AND createTextNode is a function
- Auto-color: applies `NODE_COLOR_MAP[nodeKind]` via setData (not setColor)
- Positioning: anchor.x + anchor.width + 40px gap, or (0,0) default
- `requestSave()` called after creation for disk persistence
- `destroy()` method for future cleanup

8 unit tests covering CANVAS-01, CANVAS-04, CANVAS-05 requirements.

## Decisions Made

1. **Color via setData, not setColor** -- Research Pitfall 4 indicates setData is the reliable path for persisting color alongside other metadata in a single call.
2. **No debouncing on requestSave** -- Unlike CanvasLiveEditor's rapid edit pattern, node creation is a discrete atomic action.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx vitest run src/__tests__/canvas-node-factory.test.ts` -- 8/8 pass
- `npm test` -- 367/367 pass (full suite)
- `npm run build` -- compiles without errors
