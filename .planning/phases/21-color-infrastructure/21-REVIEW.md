---
phase: 21-color-infrastructure
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/canvas/node-color-map.ts
  - src/__tests__/node-color-map.test.ts
  - src/__tests__/canvas-write-back.test.ts
  - src/__tests__/canvas-live-editor.test.ts
  - src/canvas/canvas-live-editor.ts
  - src/views/editor-panel-view.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files were reviewed covering the color-infrastructure phase: the `NODE_COLOR_MAP` constant, `CanvasLiveEditor` (live Pattern B save path), `EditorPanelView` (save orchestration and form rendering), and three test suites. The implementation is generally well-structured with clear documentation ties to design decisions. No security vulnerabilities or data-loss bugs were found.

Three warnings were identified:

1. `getData()` is called twice in `saveLive()` but the two copies share the same in-memory objects — the "rollback snapshot" is not a true deep copy and will reflect mutations applied to the working copy.
2. In `renderForm()`, the dropdown `onChange` sets `radiprotocol_nodeType` to `undefined` when cleared, but the save-button handler uses `'radiprotocol_nodeType' in edits` as the signal to execute the unmark path; an `undefined` value satisfies `in` so the paths are correct — however the unmark logic in `saveNodeEdits()` (Strategy A) checks `nodeTypeEdit === '' || nodeTypeEdit === undefined` without guarding on `'radiprotocol_nodeType' in edits`, meaning a caller passing `{}` (no key at all) would silently trigger full radiprotocol_* removal.
3. The `free-text-input` node type appears in the dropdown in `renderForm()` and has a full `buildKindForm()` case, but is absent from `NODE_COLOR_MAP` — so saving a `free-text-input` node writes `color: undefined` (which then calls the unmark color-delete path), instead of a defined palette string.

---

## Warnings

### WR-01: Rollback snapshot in `saveLive()` is not a true deep copy — mutations bleed into "original"

**File:** `src/canvas/canvas-live-editor.ts:84-86`

**Issue:** `originalData` and `updatedData` are both obtained from `view.canvas.getData()`. The type declarations state `getData()` returns "a deep copy", but this relies entirely on Obsidian's internal implementation. If the internal API ever returns a shallow copy (or if nested objects — e.g., node arrays — are shared), mutations to `updatedData.nodes[i]` (lines 101–116) will be reflected in `originalData` as well, making the rollback at line 127 a no-op: `setData(originalData)` would restore the already-mutated state.

The bug is latent and depends on Obsidian internals, but the code comment at line 83 explicitly promises rollback correctness ("Get pristine snapshot for rollback"), making this a correctness contract that is not locally enforced.

**Fix:** Explicitly deep-clone `originalData` immediately after obtaining it so the rollback is guaranteed independent of Obsidian's copy semantics:

```typescript
// Get a truly independent rollback snapshot
const originalData: CanvasData = JSON.parse(JSON.stringify(view.canvas.getData())) as CanvasData;
// Get the working copy to mutate
const updatedData: CanvasData = view.canvas.getData();
```

---

### WR-02: `saveNodeEdits()` unmark guard missing `'radiprotocol_nodeType' in edits` check (Strategy A path)

**File:** `src/views/editor-panel-view.ts:184-185`

**Issue:** The isUnmarking check on the Strategy A (vault.modify) path is:

```typescript
const nodeTypeEdit = edits['radiprotocol_nodeType'];
const isUnmarking = nodeTypeEdit === '' || nodeTypeEdit === undefined;
```

This evaluates to `true` when the caller passes `{}` (an object with no `radiprotocol_nodeType` key at all), because `edits['radiprotocol_nodeType']` returns `undefined` for a missing key. The subsequent `if (isUnmarking && 'radiprotocol_nodeType' in edits)` guard at line 189 does protect the delete loop — but only the `radiprotocol_*` removal is gated; the unconditional `delete node['color']` on line 196 executes whenever `isUnmarking` is true, even for callers who pass edits that have nothing to do with nodeType.

In the current call chain this cannot be triggered by the UI (the save button always includes `radiprotocol_nodeType`), but the public `saveNodeEdits()` API provides no documented precondition, making this a maintainability hazard.

**Fix:** Align the `isUnmarking` definition with the live-path contract by requiring the key to be present:

```typescript
const isUnmarking =
  'radiprotocol_nodeType' in edits &&
  (edits['radiprotocol_nodeType'] === '' || edits['radiprotocol_nodeType'] === undefined);
```

Then simplify the subsequent conditional (the `&& 'radiprotocol_nodeType' in edits` inner guard becomes redundant):

```typescript
if (isUnmarking) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('radiprotocol_')) delete node[key];
  }
  delete node['color'];
}
```

---

### WR-03: `free-text-input` is absent from `NODE_COLOR_MAP` — color write silently becomes color delete

**File:** `src/canvas/node-color-map.ts:13-21` / `src/views/editor-panel-view.ts:307-313`

**Issue:** `RPNodeKind` includes `'free-text-input'` and the editor panel dropdown offers it as an option (line 272 of `editor-panel-view.ts`). However `NODE_COLOR_MAP` has no entry for `'free-text-input'`. The save-button handler (lines 307–313 of `editor-panel-view.ts`) does:

```typescript
if (selectedType && selectedType !== '') {
  edits['color'] = NODE_COLOR_MAP[selectedType];   // → undefined
}
```

`NODE_COLOR_MAP['free-text-input']` returns `undefined`. The edits object then carries `color: undefined`. In `saveLive()` and `saveNodeEdits()` an `undefined` value triggers `delete node['color']`, so saving a `free-text-input` node removes its palette color instead of assigning one. Any pre-existing color is silently erased on every save.

This is a logic error: the assign path (type is set) accidentally executes the unmark behavior (delete color) for `free-text-input`.

**Fix:** Add a `free-text-input` entry to `NODE_COLOR_MAP`. Choose a palette color per the UI-SPEC Semantic Color Contract — based on existing semantics, cyan (`'5'`) is currently `question`, but `free-text-input` is also informational; if the spec leaves this open, `'3'` (yellow, passive content) is the least-conflicting choice:

```typescript
export const NODE_COLOR_MAP: Record<string, string> = {
  'start':           '4',
  'question':        '5',
  'answer':          '2',
  'text-block':      '3',
  'free-text-input': '3',  // yellow — user input prompt (passive content variant)
  'snippet':         '6',
  'loop-start':      '1',
  'loop-end':        '1',
};
```

Alternatively, guard the save-button handler to treat a `undefined` lookup result as "no color change" rather than "delete color":

```typescript
const paletteColor = NODE_COLOR_MAP[selectedType];
if (paletteColor !== undefined) {
  edits['color'] = paletteColor;
}
// omit else — leave existing color untouched when no mapping exists
```

Both fixes should be applied: the map entry is the primary fix; the guard is a defensive fallback.

---

## Info

### IN-01: `PROTECTED_FIELDS` defined twice — once as module constant and once inline

**File:** `src/canvas/canvas-live-editor.ts:14` / `src/views/editor-panel-view.ts:182`

**Issue:** `PROTECTED_FIELDS` is declared as a module-level `const` in `canvas-live-editor.ts` (line 14) and then re-declared as a local `const` inside `saveNodeEdits()` in `editor-panel-view.ts` (line 182) with identical contents. The duplication means any future change to the protected-fields contract must be applied in two places.

**Fix:** Export `PROTECTED_FIELDS` from `canvas-live-editor.ts` and import it in `editor-panel-view.ts`:

```typescript
// canvas-live-editor.ts
export const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type']);

// editor-panel-view.ts
import { CanvasLiveEditor, PROTECTED_FIELDS } from '../canvas/canvas-live-editor';
```

---

### IN-02: `free-text-input` absent from `node-color-map.test.ts` coverage

**File:** `src/__tests__/node-color-map.test.ts:8`

**Issue:** The test on line 8 enumerates 7 types to verify against `NODE_COLOR_MAP`, but that list does not include `'free-text-input'`. Combined with WR-03, this means the missing mapping would not be caught by the test suite. The test title says "7 node types" — there are currently 7 entries in the map, but `RPNodeKind` has 7 kinds too (including `free-text-input`) and the map omits it.

**Fix:** After resolving WR-03, update the test to include `'free-text-input'` in the types array (and adjust the count in the test name):

```typescript
const types = ['start', 'question', 'answer', 'free-text-input', 'text-block', 'snippet', 'loop-start', 'loop-end'];
```

Note: `snippet` is also in the list but not in `RPNodeKind` (it is pre-declared for Phase 22 per D-02), making the true "all mapped types" list 8 entries.

---

### IN-03: `canvas-write-back.test.ts` PROTECTED_FIELDS test silently passes when `vault.modify` is not called

**File:** `src/__tests__/canvas-write-back.test.ts:57-80`

**Issue:** The test "PROTECTED_FIELDS: structural fields ... are never written" at line 57 wraps its assertions in `if (mockVaultModify.mock.calls.length > 0)`. Because `saveLive()` is mocked to return `false` by default, but the test does not assert that `mockVaultModify` was actually called, the entire assertion block is skipped when the stub `saveNodeEdits` is not yet fully implemented (the comment on line 69 acknowledges this: "With stub: vault.modify() never called — test documents the contract for Plan 02"). This means the test passes vacuously and provides no regression protection until the implementation is complete.

**Fix:** Unconditionally assert that `mockVaultModify` was called (which it should be, given `mockSaveLive` returns `false`), then assert the field values:

```typescript
expect(mockVaultModify).toHaveBeenCalled();
const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as { nodes: Array<Record<string, unknown>> };
const node = written.nodes[0];
expect(node?.['id']).toBe('node-1');
expect(node?.['x']).toBe(10);
// ... etc.
```

If the implementation is genuinely not yet complete for this case, mark the test with `it.todo` rather than leaving it as a silently-passing vacuous test.

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
