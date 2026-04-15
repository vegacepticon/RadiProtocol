---
phase: 28-auto-node-coloring
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/__tests__/test-utils/make-canvas-node.ts
  - src/__tests__/canvas-write-back.test.ts
  - src/views/editor-panel-view.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed for Phase 28 (auto node coloring). The core color-injection logic in `saveNodeEdits` is sound and the test contracts are well-specified. No security vulnerabilities or data-loss risks were found.

Three warnings were identified: a live-path color-clearing gap where `undefined` is forwarded to `saveLive` (which may silently no-op on the canvas API), a redundant pre-injection in `onTypeDropdownChange` that duplicates work already done inside `saveNodeEdits` (creating a maintainability hazard), and a logically dead sub-condition in the fallback type-resolution guard. Two info items cover a non-deterministic test fixture ID and a re-derived variable that duplicates an earlier computed value.

---

## Warnings

### WR-01: Live-save unmark path sends `color: undefined` — canvas API may ignore it

**File:** `src/views/editor-panel-view.ts:604-608`

**Issue:** In `onTypeDropdownChange`, when the user clears the node type, line 606 sets `edits['color'] = undefined` then passes `edits` to `saveNodeEdits`. On the live-save path (when `saveLive` returns `true`), `saveNodeEdits` forwards `enrichedEdits` directly to `canvasLiveEditor.saveLive()` (line 169). Because `isUnmarkingType` is `true`, no color key is actively injected into `enrichedEdits`; instead, the `color: undefined` entry propagated from `onTypeDropdownChange` lands in `enrichedEdits` and is sent to `saveLive`.

Whether `saveLive` / the internal canvas API interprets a key with value `undefined` as "delete this property" or silently ignores it is not enforced by these files. If the canvas live editor iterates entries and skips `undefined` values, the color will not be cleared on open canvases when a node is unmarked via the dropdown.

The Strategy-A (vault.modify) path handles this correctly by explicitly `delete node['color']` at line 236, so the bug only surfaces on the live path.

**Fix:**
```typescript
// In saveNodeEdits, after the isUnmarkingType check block and before calling saveLive,
// strip undefined values from enrichedEdits so saveLive never receives them.
// Better: handle color clearing explicitly for the live path:

if (!isUnmarkingType && editedType) {
  const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[editedType];
  if (mapped !== undefined) {
    enrichedEdits['color'] = mapped;
  }
}
// NEW: explicit color-clear signal for live path on unmark
if (isUnmarkingType) {
  enrichedEdits['color'] = ''; // empty string signals canvas to remove color, or
  // coordinate with CanvasLiveEditor to treat '' as delete — document the contract
}
```

Alternatively, define a sentinel value (e.g., empty string `''`) that `CanvasLiveEditor.saveLive` is documented to handle as "delete the field", and use that instead of `undefined`.

---

### WR-02: Duplicate color injection in `onTypeDropdownChange` — divergence risk

**File:** `src/views/editor-panel-view.ts:597-602`

**Issue:** `onTypeDropdownChange` looks up `NODE_COLOR_MAP[selectedType]` and injects `edits['color']` (lines 599–602) before calling `saveNodeEdits`. Inside `saveNodeEdits`, the same lookup runs again (lines 160–163) whenever `editedType` is present and not an unmark. The second injection overwrites the first with the identical value today.

This is redundant code with a maintenance hazard: if the color injection logic in `saveNodeEdits` is ever updated (e.g., to handle unknown types differently), `onTypeDropdownChange`'s copy will silently diverge and produce inconsistent behavior only for the type-dropdown change path.

**Fix:** Remove the color injection block from `onTypeDropdownChange` and rely solely on `saveNodeEdits` for color injection. `saveNodeEdits` already handles all cases (type change, field-only save, unmark). The only exception is the unmark/`color: undefined` case described in WR-01, which should be resolved there instead.

```typescript
private onTypeDropdownChange(value: string): void {
  this.pendingEdits['radiprotocol_nodeType'] = value || undefined;
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }
  if (this.currentFilePath && this.currentNodeId) {
    const edits = { ...this.pendingEdits };
    // Remove the duplicate NODE_COLOR_MAP lookup block here — saveNodeEdits handles it
    void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits)
      .then(() => { this.showSavedIndicator(); })
      .catch(err => {
        console.error('[RadiProtocol] type-change save failed:', err);
      });
  }
}
```

---

### WR-03: Logically dead sub-condition in fallback type-resolution guard

**File:** `src/views/editor-panel-view.ts:211`

**Issue:** The condition is:
```typescript
if (!isTypeChange && !isUnmarkingType) {
```

`isUnmarkingType` is defined as `isTypeChange && (editedType === '' || editedType === undefined)` (line 156). Therefore `isUnmarkingType === true` implies `isTypeChange === true`. Consequently, `!isTypeChange === true` already implies `!isUnmarkingType === true` — the `&& !isUnmarkingType` sub-expression is always `true` when `!isTypeChange` is `true`, making it a dead condition. While this is not a runtime bug, it signals a misunderstanding of the invariant and will mislead future readers into thinking `!isTypeChange` alone is insufficient.

**Fix:**
```typescript
// Replace:
if (!isTypeChange && !isUnmarkingType) {

// With the logically equivalent and clearer:
if (!isTypeChange) {
```

---

## Info

### IN-01: Non-deterministic node ID in `makeCanvasNode` test utility

**File:** `src/__tests__/test-utils/make-canvas-node.ts:22`

**Issue:** `id: \`node-${Math.random().toString(36).slice(2, 9)}\`` generates a random ID on every call. If a future test using this helper needs to assert on the node's ID (e.g., verifying a specific node was updated in a multi-node canvas), the random ID makes the assertion impossible without capturing the returned value. The helper is not yet used by `canvas-write-back.test.ts` (which defines its own inline fixture), but as adoption grows the non-determinism could cause subtle test fragility.

**Fix:** Accept an optional `id` override through the existing `overrides` parameter — no code change is needed since `overrides` already spreads over defaults. Document in the JSDoc that callers should pass `id` when they need a stable, assertable identifier:

```typescript
// Usage when ID needs to be asserted:
const node = makeCanvasNode('question', { id: 'node-q1' });
```

---

### IN-02: `isUnmarking` re-derived from `enrichedEdits` — duplicates `isUnmarkingType`

**File:** `src/views/editor-panel-view.ts:224-225`

**Issue:** Lines 224–225 re-derive an `isUnmarking` local variable:
```typescript
const nodeTypeEdit = enrichedEdits['radiprotocol_nodeType'];
const isUnmarking = nodeTypeEdit === '' || nodeTypeEdit === undefined;
```

This duplicates the already-computed `isUnmarkingType` from line 156. The two variables express the same predicate on the same data (`enrichedEdits['radiprotocol_nodeType']`), but are named differently and defined 68 lines apart. If the unmark condition is ever widened (e.g., to also treat `null` as unmark), one of the two will be missed.

**Fix:** Replace `isUnmarking` at line 225 with `isUnmarkingType`:
```typescript
// Remove lines 224-225, then at line 229:
if (isUnmarkingType && 'radiprotocol_nodeType' in enrichedEdits) {
```

The guard `'radiprotocol_nodeType' in enrichedEdits` on line 229 is already correct since the `in` operator was used to compute `isTypeChange` at line 155.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
