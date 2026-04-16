---
phase: 41-live-canvas-update-on-folder-rename
reviewed: 2026-04-16T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/snippets/canvas-ref-sync.ts
  - src/views/snippet-manager-view.ts
  - src/__tests__/canvas-ref-sync.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-04-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 41 adds a "Pattern B" live canvas update path to `rewriteCanvasRefs`, allowing in-memory canvas mutations via `CanvasLiveEditor.saveLive()` when a canvas is open, with fallback to `vault.modify()` when the canvas is closed or the live API fails. The integration points in `snippet-manager-view.ts` correctly pass `this.plugin.canvasLiveEditor` as the third argument. Tests cover the key scenarios (live success, fallback on closed canvas, mid-iteration fallback, multi-node, mixed open/closed, backward compat). Overall the implementation is solid and well-structured.

Two warnings relate to edge-case robustness in the live path of `canvas-ref-sync.ts`.

## Warnings

### WR-01: Unchecked `node['id']` cast to string before passing to `saveLive`

**File:** `src/snippets/canvas-ref-sync.ts:82`
**Issue:** `node['id'] as string` is cast without validating that the `id` property is actually a string. If a canvas node has a missing, numeric, or otherwise non-string `id`, this passes an invalid value to `canvasLiveEditor.saveLive()`, which then fails to find the node (returns false) and triggers the vault.modify fallback. While the fallback makes this non-crashing, it silently degrades live updates for the entire canvas file on one malformed node.
**Fix:**
```typescript
const nodeId = node['id'];
if (typeof nodeId !== 'string' || nodeId === '') continue;
// ...
editsToApply.push({ nodeId, edits: nodeEdits });
```

### WR-02: Partial live edits are not rolled back on mid-iteration `saveLive` failure

**File:** `src/snippets/canvas-ref-sync.ts:88-102`
**Issue:** When `saveLive` succeeds for some nodes but fails for a later node (returns false), the code falls through to the `vault.modify` path. The vault.modify path reads the file from disk (line 111), which may still contain the old values if `requestSave` has not yet flushed (it is debounced at 500ms). This means the vault.modify path rewrites ALL matching nodes from the stale disk content, while the live canvas already has some nodes updated via `setData`. The result is correct (both paths converge to the same new value), but the inconsistency window -- where live state and disk state differ for already-updated nodes -- could cause issues if another consumer reads the canvas during that window. Additionally, if `requestSave` HAS flushed before the vault.read, the disk content is partially updated, and the vault.modify path only rewrites the remaining nodes -- which is also correct. The behavior is safe but fragile and hard to reason about.
**Fix:** Consider reading live JSON (via `getCanvasJSON`) instead of `vault.read` when falling through from a partial live failure, so the vault.modify path operates on the same data the live path was working with:
```typescript
if (!liveFailed) {
  updated.push(file.path);
  continue;
}
// liveFailed: use live JSON as the source for vault.modify fallback
// (skip the vault.read below, use liveJson which was already parsed)
```
Alternatively, document the invariant that `applyMapping` is idempotent (mapping `a/c` when the mapping is `a/b -> a/c` returns null), which makes the double-apply safe. A code comment explaining this would suffice if a code change is not desired.

## Info

### IN-01: `console.error` on live path exception could be `console.warn`

**File:** `src/snippets/canvas-ref-sync.ts:107`
**Issue:** The live path catch block logs at `console.error` level, but this is an expected fallback scenario (not an actual error). The vault.modify path will handle the file correctly. Using `console.warn` would better communicate that this is a graceful degradation, not a failure.
**Fix:**
```typescript
console.warn('[RadiProtocol] canvas-ref-sync live path unavailable, falling back:', file.path, (e as Error).message);
```

---

_Reviewed: 2026-04-16T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
