---
phase: 11-live-canvas-editing
plan: "01"
subsystem: canvas
tags: [canvas, live-edit, typescript, tdd, internal-api]
dependency_graph:
  requires:
    - "src/types/canvas-internal.d.ts (new — created in this plan)"
  provides:
    - "src/canvas/canvas-live-editor.ts — CanvasLiveEditor class (LIVE-01)"
    - "src/types/canvas-internal.d.ts — ambient TypeScript declarations (LIVE-02)"
    - "src/__tests__/canvas-live-editor.test.ts — 8 unit tests, all GREEN"
  affects:
    - "Plan 11-02 (EditorPanelView integration) — imports CanvasLiveEditor from src/canvas/canvas-live-editor"
tech_stack:
  added: []
  patterns:
    - "Pattern B: view.canvas.getData()/setData()/requestSave() — deep-copy write-back pattern"
    - "Two-step cast: as unknown as CanvasViewInternal (no any)"
    - "500ms debounce per filePath via Map<string, ReturnType<typeof setTimeout>>"
    - "TDD: test file created first (RED), implementation brings to GREEN"
key_files:
  created:
    - src/types/canvas-internal.d.ts
    - src/canvas/canvas-live-editor.ts
    - src/__tests__/canvas-live-editor.test.ts
  modified: []
decisions:
  - "Used Pattern B (canvas.getData/setData) not Pattern A (view.data in-place mutation) — confirmed stable by multiple community plugin sources"
  - "Two getData() calls: first for pristine rollback snapshot, second for mutation — eliminates key-by-key restoration"
  - "Test mock uses mockImplementation returning shallow copies per call to simulate deep-copy behavior of real API"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 11 Plan 01: CanvasLiveEditor Module Summary

**One-liner:** TypeScript ambient declarations and CanvasLiveEditor class implementing Pattern B (getData/setData/requestSave) live canvas node mutation with 500ms debounce, PROTECTED_FIELDS guard, un-mark cleanup, and rollback on failure.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/types/canvas-internal.d.ts | 4ea957e | src/types/canvas-internal.d.ts |
| 2 | Implement src/canvas/canvas-live-editor.ts (TDD) | 5940b76 | src/canvas/canvas-live-editor.ts, src/__tests__/canvas-live-editor.test.ts |

---

## What Was Built

### Task 1: canvas-internal.d.ts (LIVE-02)

Created `src/types/canvas-internal.d.ts` with four exported interfaces:

- `CanvasNodeData` — node shape with id, x, y, width, height, type, color, and `[key: string]: unknown` index signature for radiprotocol_* fields
- `CanvasData` — container with `nodes: CanvasNodeData[]` and `edges: unknown[]`
- `CanvasInternal` — the canvas sub-object with `getData(): CanvasData`, `setData(data: CanvasData): void`, `requestSave(): void`
- `CanvasViewInternal` — the leaf view shape with `file?: { path: string }` and `canvas: CanvasInternal`

No `tsconfig.json` changes needed — TypeScript picks up `.d.ts` files automatically from `include` globs.

### Task 2: canvas-live-editor.ts (LIVE-01)

Created `src/canvas/canvas-live-editor.ts` exporting `CanvasLiveEditor` class:

**Key methods:**
- `getCanvasView(filePath)` — private; probes for Pattern B API (`typeof view.canvas?.getData === 'function'`); returns `CanvasViewInternal | undefined`
- `isLiveAvailable(filePath)` — public; returns boolean for callers to check before live save
- `saveLive(filePath, nodeId, edits)` — async; returns `true` on success, `false` for fallback to Strategy A, throws on write failure (callers show Notice per D-03)
- `debouncedRequestSave(filePath, view)` — private; 500ms debounce per filePath via `Map<string, ReturnType<typeof setTimeout>>`
- `destroy()` — clears all timers; must be called from plugin `onunload()`

**Security mitigations applied (from threat model):**
- T-11-01: `PROTECTED_FIELDS` set (`id`, `x`, `y`, `width`, `height`, `type`, `color`) checked on every write
- T-11-02: Un-mark path (`radiprotocol_nodeType === ''`) deletes all `radiprotocol_*` keys from node copy
- T-11-03: 500ms debounce prevents rapid-fire `requestSave()` calls
- T-11-04: `destroy()` clears all timers on plugin unload

**Pattern B write sequence:**
1. `originalData = view.canvas.getData()` — deep copy for rollback
2. `updatedData = view.canvas.getData()` — deep copy to mutate
3. Apply edits to node in `updatedData`
4. `view.canvas.setData(updatedData)` — commit mutation
5. `debouncedRequestSave()` → `view.canvas.requestSave()` after 500ms
6. On catch: `view.canvas.setData(originalData)` (rollback), then re-throw

---

## Test Results

```
src/__tests__/canvas-live-editor.test.ts: 8/8 PASSED
  ✓ saveLive returns true when canvas.getData is function and node found by id
  ✓ saveLive returns false when canvas.getData is not a function (D-01 fallback)
  ✓ saveLive returns false when no canvas leaf found (canvas closed)
  ✓ saveLive returns false when node id not found in getData().nodes
  ✓ PROTECTED_FIELDS (id, x, y, width, height, type, color) are not in committed setData() call
  ✓ un-mark path: radiprotocol_nodeType="" removes all radiprotocol_* keys from node before setData()
  ✓ rollback: if setData() or requestSave() throws, canvas.setData(originalData) is called with pre-edit data
  ✓ destroy() clears all pending debounce timers
```

Pre-existing failures (unchanged): `canvas-write-back.test.ts`, `editor-panel.test.ts`, `RunnerView.test.ts`, `settings-tab.test.ts`, `runner-commands.test.ts` (obsidian mock resolution issues unrelated to Phase 11), `runner-extensions.test.ts` (RED until Plans 02/03 per comments).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock getData() returned shared object references not deep copies**
- **Found during:** Task 2 GREEN phase — test 7 (rollback) failed with `expected 'test' to be undefined`
- **Issue:** `vi.fn().mockReturnValue({ nodes: [fakeNode], edges: [] })` returns the same `fakeNode` reference on every call. When `saveLive()` mutated `updatedData.nodes[0]`, it also mutated `originalData.nodes[0]` (same reference). The rollback test then saw the mutated value instead of the original.
- **Fix:** Changed `mockReturnValue` to `mockImplementation(() => ({ nodes: [{ ...fakeNode }], edges: [] }))` to simulate the deep-copy behavior of the real Obsidian Canvas API.
- **Files modified:** `src/__tests__/canvas-live-editor.test.ts`
- **Commit:** 5940b76

**2. [Rule 3 - Blocking] Plan 00 (Wave 0 test stubs) was not executed — test file missing**
- **Found during:** Task 2 setup — `src/__tests__/canvas-live-editor.test.ts` did not exist
- **Issue:** Plan 01 is a TDD plan that `depends_on: ["11-00"]`. Plan 00 creates the test file as RED stubs. Since Plan 00 was not executed, the test file was absent.
- **Fix:** Created `canvas-live-editor.test.ts` inline as part of the TDD flow (RED then GREEN). Test shape uses Pattern B fakeLeaf structure (per plan's `<interfaces>` section note about updating old Pattern A shapes). This covers all 8 required test cases.
- **Files modified:** `src/__tests__/canvas-live-editor.test.ts` (created)
- **Commit:** 5940b76

---

## Known Stubs

None — all implemented behavior is fully wired. `canvas-live-editor.ts` is a self-contained module with no placeholder code.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what was modeled in the plan's threat register.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/types/canvas-internal.d.ts | FOUND |
| src/canvas/canvas-live-editor.ts | FOUND |
| src/__tests__/canvas-live-editor.test.ts | FOUND |
| Commit 4ea957e (canvas-internal.d.ts) | FOUND |
| Commit 5940b76 (canvas-live-editor.ts + tests) | FOUND |
