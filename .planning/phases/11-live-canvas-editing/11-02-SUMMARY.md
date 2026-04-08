---
phase: 11-live-canvas-editing
plan: "02"
subsystem: canvas
tags: [canvas, live-edit, editor-panel, typescript, tdd, wave-2]

# Dependency graph
requires:
  - "src/canvas/canvas-live-editor.ts (created in Plan 01)"
  - "src/__tests__/canvas-write-back.test.ts RED stubs (created in Plan 00)"
provides:
  - "src/views/editor-panel-view.ts — saveNodeEdits() wired to CanvasLiveEditor.saveLive()"
  - "src/main.ts — CanvasLiveEditor instantiated in onload(); destroy() called in onunload()"
  - "vitest.config.ts — obsidian alias resolves module for vi.mock() in all test suites"
  - "src/__tests__/canvas-write-back.test.ts — 8/8 GREEN (3 new LIVE-03/LIVE-04 tests + 5 pre-existing)"
affects:
  - "Phase 11 user-visible outcome: users can now edit canvas node properties while the canvas is open"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-first save with Strategy A fallback: try saveLive() first; if false, fall through to vault.modify()"
    - "Threat model T-11-06: explicit early return after saveLive()=true prevents dual-write"
    - "Threat model T-11-07: catch block has explicit return to prevent Strategy A on thrown error"
    - "vitest alias for obsidian: resolve.alias maps 'obsidian' to src/__mocks__/obsidian.ts"

key-files:
  created: []
  modified:
    - src/main.ts
    - src/views/editor-panel-view.ts
    - src/__tests__/canvas-write-back.test.ts
    - vitest.config.ts

key-decisions:
  - "Removed isCanvasOpen() from EditorPanelView — replaced by CanvasLiveEditor.isLiveAvailable() internals; no caller-side check needed"
  - "vitest alias fix applied as Rule 3 blocking deviation — obsidian package has empty main field, vi.mock('obsidian') failed without alias"
  - "Updated canvas-open guard test to reflect new LIVE-03 contract (mockSaveLive.mockResolvedValue(true))"
  - "Dropped virtual: true from vi.mock — canvas-live-editor.ts now exists (Plan 01 created it)"

# Metrics
duration_minutes: 20
completed_date: "2026-04-08"
tasks_completed: 2
tasks_total: 2
files_created: 0
files_modified: 4
---

# Phase 11 Plan 02: EditorPanelView Live Wiring Summary

**One-liner:** Wired CanvasLiveEditor into EditorPanelView.saveNodeEdits() with live-first/Strategy-A-fallback pattern; removed the "Close the canvas" guard; fixed vitest obsidian alias so all Obsidian-dependent test suites now pass.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire CanvasLiveEditor into EditorPanelView.saveNodeEdits() and main.ts | cfb9638 | src/main.ts, src/views/editor-panel-view.ts, src/__tests__/canvas-write-back.test.ts, vitest.config.ts |
| 2 | Full build verification | (no commit — verification only) | — |

---

## What Was Built

### Task 1: main.ts changes (LIVE-04)

- Added `import { CanvasLiveEditor } from './canvas/canvas-live-editor'`
- Added `canvasLiveEditor!: CanvasLiveEditor` public property to `RadiProtocolPlugin` class
- Instantiated in `onload()` after `sessionService`: `this.canvasLiveEditor = new CanvasLiveEditor(this.app)`
- Added `this.canvasLiveEditor.destroy()` in `onunload()` before `console.debug` — clears debounce timers (T-11-08)

### Task 1: editor-panel-view.ts changes (LIVE-03)

- Removed `private isCanvasOpen(filePath: string): boolean` method entirely (D-04)
- Replaced Strategy A guard block in `saveNodeEdits()` with:
  ```typescript
  try {
    const savedLive = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, edits);
    if (savedLive) {
      new Notice('Node properties saved.');
      return;  // T-11-06: explicit return prevents dual-write
    }
  } catch {
    new Notice('Save failed \u2014 close the canvas and try again.');  // D-03
    return;  // T-11-07: explicit return prevents Strategy A on thrown error
  }
  // saveLive() returned false → fall through to Strategy A (vault.modify())
  ```
- The `vault.read → JSON.parse → node patch → vault.modify` Strategy A path is unchanged

### Task 1: test + config fixes

- `vitest.config.ts`: added `resolve.alias` mapping `obsidian` → `src/__mocks__/obsidian.ts` — fixes `vi.mock('obsidian')` resolution failure across all Obsidian-dependent test suites
- `canvas-write-back.test.ts`: added `canvasLiveEditor: { saveLive: mockSaveLive }` to `mockPlugin`
- `canvas-write-back.test.ts`: dropped `{ virtual: true }` from `vi.mock('../canvas/canvas-live-editor')` — module now exists
- `canvas-write-back.test.ts`: updated `canvas-open guard` test to mock `saveLive.mockResolvedValue(true)` and verify new LIVE-03 contract

---

## Test Results

```
src/__tests__/canvas-live-editor.test.ts: 8/8 PASSED (unchanged from Plan 01)
src/__tests__/canvas-write-back.test.ts: 8/8 PASSED
  ✓ PROTECTED_FIELDS: id, x, y, width, height, type, color are never written
  ✓ radiprotocol_* fields are written to canvas JSON via vault.modify()
  ✓ undefined values delete the key from the node
  ✓ canvas-open guard: vault.modify() not called when canvas is open and live save succeeds
  ✓ un-mark cleanup: removing nodeType (empty string) removes all radiprotocol_* fields
  ✓ live path: when canvas is open and saveLive returns true, vault.modify is NOT called
  ✓ live path: no "Close the canvas before" Notice when canvas is open and live API available
  ✓ fallback path: when saveLive returns false, vault.modify IS called (Strategy A)

Overall: 127 passing, 3 failing (pre-existing runner-extensions.test.ts RED stubs — unrelated to Phase 11)
```

### Build verification

- `npx tsc --noEmit` (source files): 0 errors
- `npm run build`: exits 0; output copied to dev vault
- Total test files: 17 (16 passed, 1 failed with pre-existing stubs)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest cannot resolve obsidian package (empty main field)**
- **Found during:** Task 1 verification — `canvas-write-back.test.ts` failed with "Failed to resolve entry for package 'obsidian'"
- **Issue:** The `obsidian` npm package has `"main": ""` in its package.json. `vi.mock('obsidian')` needs the package resolvable before applying the manual mock. No `resolve.alias` was set.
- **Fix:** Added `resolve.alias` to `vitest.config.ts` mapping `obsidian` to `src/__mocks__/obsidian.ts`. This also fixed `editor-panel.test.ts`, `RunnerView.test.ts`, `settings-tab.test.ts`, and `runner-commands.test.ts` which had the same failure.
- **Files modified:** `vitest.config.ts`
- **Commit:** cfb9638

**2. [Rule 1 - Bug] vi.mock 3-arg form with { virtual: true } not supported in vitest 4.x**
- **Found during:** Task 1 TypeScript check — `canvas-write-back.test.ts:10` error TS2554: Expected 1-2 arguments, but got 3
- **Issue:** Wave 0 used `vi.mock(path, { virtual: true }, factory)` for a module that didn't exist yet. vitest 4.x `ModuleMockOptions` only has `{ spy?: boolean }` — no `virtual` key. Also, `canvas-live-editor.ts` now exists (Plan 01 created it), so `virtual: true` is no longer needed.
- **Fix:** Changed to `vi.mock('../canvas/canvas-live-editor', () => ({...}))` — 2-arg form.
- **Files modified:** `src/__tests__/canvas-write-back.test.ts`
- **Commit:** cfb9638

**3. [Rule 1 - Bug] mockPlugin missing canvasLiveEditor property**
- **Found during:** Task 1 RED test analysis — test mock `mockPlugin` had no `canvasLiveEditor` property, causing `this.plugin.canvasLiveEditor.saveLive()` to throw TypeError at runtime in tests
- **Fix:** Added `canvasLiveEditor: { saveLive: mockSaveLive }` to `mockPlugin` in `beforeEach`
- **Files modified:** `src/__tests__/canvas-write-back.test.ts`
- **Commit:** cfb9638

**4. [Rule 1 - Bug] canvas-open guard test incompatible with new contract**
- **Found during:** Task 1 test run — 7/8 tests passed; old `canvas-open guard` test expected `vault.modify` NOT called when canvas is open, but new implementation calls vault.modify when `saveLive` returns false (Strategy A fallback)
- **Issue:** The old guard test did not mock `mockSaveLive`, so it returned undefined (falsy), causing fallthrough to vault.modify
- **Fix:** Updated test to mock `mockSaveLive.mockResolvedValue(true)` and updated test name to reflect new LIVE-03 contract. The plan notes "(The existing 'canvas-open guard' test is replaced by the 3 new tests above)" — this update aligns with that intent.
- **Files modified:** `src/__tests__/canvas-write-back.test.ts`
- **Commit:** cfb9638

---

## Known Stubs

None — all LIVE-03 and LIVE-04 contracts are fully implemented and tested.

---

## Threat Flags

None — all trust boundary mitigations from the plan's threat register were applied:
- T-11-06: `if (savedLive) { ... return; }` — explicit return prevents dual-write
- T-11-07: catch block has explicit `return` — Strategy A only runs when `saveLive()` returns false
- T-11-08: `destroy()` called from `onunload()` — timer leak prevented

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/main.ts contains `canvasLiveEditor` | FOUND |
| src/views/editor-panel-view.ts contains `saveLive` | FOUND |
| src/views/editor-panel-view.ts does NOT contain `Close the canvas before editing` | CONFIRMED ABSENT |
| src/views/editor-panel-view.ts does NOT contain `isCanvasOpen` | CONFIRMED ABSENT |
| src/views/editor-panel-view.ts contains `Save failed` | FOUND |
| vitest.config.ts contains obsidian alias | FOUND |
| Commit cfb9638 | FOUND |
| canvas-write-back.test.ts 8/8 GREEN | CONFIRMED |
| canvas-live-editor.test.ts 8/8 GREEN | CONFIRMED |
| npm run build exits 0 | CONFIRMED |
