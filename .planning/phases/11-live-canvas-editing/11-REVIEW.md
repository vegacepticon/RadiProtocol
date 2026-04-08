---
phase: 11-live-canvas-editing
reviewed: 2026-04-08T12:30:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/__tests__/canvas-live-editor.test.ts
  - src/__tests__/canvas-write-back.test.ts
  - src/canvas/canvas-live-editor.ts
  - src/main.ts
  - src/types/canvas-internal.d.ts
  - src/views/editor-panel-view.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-08T12:30:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase introduces `CanvasLiveEditor` (Pattern B: `getData`/`setData`/`requestSave`) and wires it into `EditorPanelView.saveNodeEdits` as the primary write path when a canvas is open. The implementation is solid overall: the fallback strategy, rollback on failure, debounce cleanup, and protected-field guards are all present.

Four warnings were found — the most impactful is a silent rollback failure path that can leave the canvas in an inconsistent state with no user feedback. A logic inconsistency in the un-mark guard between the two write paths (live vs. vault) and a vacuous test assertion (PROTECTED_FIELDS contract never enforced when stub is active) are the other substantive concerns.

---

## Warnings

### WR-01: Rollback `setData()` failure is silently swallowed

**File:** `src/canvas/canvas-live-editor.ts:108-112`

**Issue:** When `view.canvas.setData(updatedData)` throws, the catch block calls `view.canvas.setData(originalData)` to roll back. If the rollback call itself throws, the original error is re-thrown (because the rollback exception propagates out of the catch block before `throw err` runs), swallowing the original error and leaving the canvas in an unknown state. Callers (and the user) receive no indication that rollback failed.

```typescript
try {
  view.canvas.setData(updatedData);
  this.debouncedRequestSave(filePath, view);
  return true;
} catch (err) {
  // If setData(originalData) throws, err is lost and rollback failure is silent
  view.canvas.setData(originalData);
  throw err;
}
```

**Fix:** Wrap the rollback in its own try/catch so the original error is preserved and the rollback failure is logged:

```typescript
try {
  view.canvas.setData(updatedData);
  this.debouncedRequestSave(filePath, view);
  return true;
} catch (err) {
  try {
    view.canvas.setData(originalData);
  } catch (rollbackErr) {
    console.error('[RadiProtocol] Canvas rollback failed — canvas may be in inconsistent state:', rollbackErr);
  }
  throw err;
}
```

---

### WR-02: Un-mark guard logic divergence between live path and vault path

**File:** `src/canvas/canvas-live-editor.ts:81-83` vs. `src/views/editor-panel-view.ts:106-110`

**Issue:** The two code paths that implement the un-mark behavior (removing all `radiprotocol_*` keys when `nodeType` is set to empty string) use slightly different guard structures.

- **Live path** (`canvas-live-editor.ts` line 81-83): `isUnmarking` is only true when `'radiprotocol_nodeType' in edits` (the key must be present) AND its value is `''` or `undefined`. This is correct.
- **Vault path** (`editor-panel-view.ts` line 106): `isUnmarking` is `nodeTypeEdit === '' || nodeTypeEdit === undefined`, which evaluates to `true` when `radiprotocol_nodeType` is NOT in `edits` at all (absent key → `undefined`). The subsequent guard `&& 'radiprotocol_nodeType' in edits` at line 110 fixes it, but this is a fragile two-step pattern. If the guard at line 110 is ever removed or the condition is copy-pasted without it, all saves with `edits` that don't include `radiprotocol_nodeType` would incorrectly trigger a full strip of all `radiprotocol_*` keys.

**Fix:** Align the vault path to match the clearer single-expression guard from the live path:

```typescript
// editor-panel-view.ts — replace lines 105-110 with:
const isUnmarking =
  'radiprotocol_nodeType' in edits &&
  (edits['radiprotocol_nodeType'] === '' || edits['radiprotocol_nodeType'] === undefined);
```

Then the outer `if (isUnmarking)` needs no secondary `&& 'radiprotocol_nodeType' in edits` guard, removing the fragility.

---

### WR-03: Vacuous PROTECTED_FIELDS test — assertion never executes with current stub

**File:** `src/__tests__/canvas-write-back.test.ts:63-86`

**Issue:** The test "PROTECTED_FIELDS: id, x, y, width, height, type, color are never written" wraps its entire assertion block in `if (mockVaultModify.mock.calls.length > 0)`. The comment acknowledges that `vault.modify()` is never called with the stub, meaning the critical PROTECTED_FIELDS assertion is dead code — the test always passes vacuously regardless of whether the implementation strips protected fields or not. This gives false confidence in the safety contract.

```typescript
// Lines 76-85 — the entire assertion is never reached:
if (mockVaultModify.mock.calls.length > 0) {
  const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) ...
  expect(node?.['id']).toBe('node-1');
  // ...
}
```

**Fix:** The test should fail when `vault.modify` is not called, not silently pass. Either:
1. Add `expect(mockVaultModify).toHaveBeenCalled()` before the conditional block to enforce the contract once Plan 02 is implemented, OR
2. Split this into two tests: one that documents the "stub RED" state explicitly, and one that enforces the contract when the implementation is complete.

The companion test at line 63 in `canvas-live-editor.test.ts` ("PROTECTED_FIELDS ... are not in committed setData() call") does assert this correctly for the live path — the vault path should have equivalent coverage.

---

### WR-04: `saveNodeEdits` catch block silently discards errors without logging

**File:** `src/views/editor-panel-view.ts:57-67`

**Issue:** The catch block for `saveLive()` failures swallows the error with no logging:

```typescript
} catch {
  // D-03: requestSave() threw — canvas state has been rolled back by CanvasLiveEditor.
  new Notice('Save failed \u2014 close the canvas and try again.');
  return;
}
```

The error object is not logged to the console, making it impossible to diagnose what went wrong when a user reports the "Save failed" notice. This is a systemic pattern in this file (the `vault.read`, `JSON.parse`, and `vault.modify` catch blocks on lines 81-134 also discard errors silently).

**Fix:** Log the caught error at minimum in the live-save catch block:

```typescript
} catch (err) {
  console.error('[RadiProtocol] saveLive threw — canvas state rolled back:', err);
  new Notice('Save failed \u2014 close the canvas and try again.');
  return;
}
```

Apply the same pattern to the other empty catch blocks in `saveNodeEdits` and `renderNodeForm`.

---

## Info

### IN-01: `onunload` is declared `async` but performs no async operations

**File:** `src/main.ts:119-122`

**Issue:** `onunload` is marked `async` but only calls `this.canvasLiveEditor.destroy()` which is synchronous. The `async` keyword adds unnecessary overhead and signals a contract that is not fulfilled.

```typescript
async onunload(): Promise<void> {
  this.canvasLiveEditor.destroy();
  console.debug('[RadiProtocol] Plugin unloaded');
}
```

**Fix:**

```typescript
onunload(): void {
  this.canvasLiveEditor.destroy();
  console.debug('[RadiProtocol] Plugin unloaded');
}
```

---

### IN-02: `destroy()` uses `.entries()` when `.values()` is sufficient

**File:** `src/canvas/canvas-live-editor.ts:133`

**Issue:** The `for...of` loop in `destroy()` uses `this.debounceTimers.entries()` and discards the key with a blank destructuring slot `[, timer]`. The Map key (file path) is not used in the loop body.

```typescript
for (const [, timer] of this.debounceTimers.entries()) {
  clearTimeout(timer);
}
```

**Fix:** Use `.values()` directly:

```typescript
for (const timer of this.debounceTimers.values()) {
  clearTimeout(timer);
}
```

---

### IN-03: `console.debug` in `onload` / `onunload` — production artifact

**File:** `src/main.ts:116, 121`

**Issue:** Debug log statements (`console.debug('[RadiProtocol] Plugin loaded'` and `Plugin unloaded`) are present in the production plugin entry point. These are low-severity since `console.debug` is typically hidden in production devtools, but they are noise in the console.

**Fix:** Remove or gate them behind a debug flag if verbose logging is needed during development:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.debug('[RadiProtocol] Plugin loaded');
}
```

Or simply remove them if they have no diagnostic value in production.

---

### IN-04: Test file comments reference stub/RED state — should be updated after Plan 02 lands

**File:** `src/__tests__/canvas-write-back.test.ts:93, 144`

**Issue:** Multiple test bodies contain comments like `// Stub never calls vault.modify() — RED` (lines 93-94, 143-144). These are useful during development but will become misleading once Plan 02 is complete and the tests are expected to be green. Leaving them in can confuse future reviewers about whether the code is intentionally incomplete.

**Fix:** Remove or update these comments once the implementation is wired up and the tests pass. A simple CI enforcement note (or a `TODO(phase-11-plan-02):` prefix) would make the lifecycle of these comments explicit.

---

_Reviewed: 2026-04-08T12:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
