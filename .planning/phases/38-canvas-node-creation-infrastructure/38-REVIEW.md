---
phase: 38-canvas-node-creation-infrastructure
reviewed: 2026-04-16T12:32:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/canvas/canvas-node-factory.ts
  - src/__tests__/canvas-node-factory.test.ts
  - src/types/canvas-internal.d.ts
  - src/main.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-04-16T12:32:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 38 introduces `CanvasNodeFactory`, a clean service for programmatic canvas node creation. The implementation is well-structured: runtime API probing guards against missing internal APIs, positioning is anchor-relative, and color assignment uses the existing `NODE_COLOR_MAP`. The plugin wiring in `main.ts` follows the established pattern (instantiate in `onload`, destroy in `onunload`). All 8 tests pass, and the build compiles cleanly with `tsc -noEmit`.

No critical or security issues found. One warning about silent fallback when an anchor node ID is invalid, and two minor informational items.

**Verdict: CONDITIONAL PASS** -- ship after addressing WR-01 (add a console.warn for invalid anchor IDs).

## Warnings

### WR-01: Silent fallback to origin when anchorNodeId is invalid

**File:** `src/canvas/canvas-node-factory.ts:49-53`
**Issue:** When `anchorNodeId` is provided but the node is not found in `canvas.nodes`, the position silently falls back to `{ x: 0, y: 0 }`. This could place a new node on top of an existing node at the origin, with no indication to the caller that the anchor was not found. Callers (Phase 39 Quick-Create, Phase 40 Duplication) may pass a stale or deleted node ID and get unexpected positioning without any feedback.
**Fix:** At minimum, log a warning so callers can detect stale anchor references during development:
```typescript
if (anchorNodeId) {
  const anchor = canvas.nodes.get(anchorNodeId);
  if (anchor) {
    pos = { x: anchor.x + anchor.width + NODE_GAP, y: anchor.y };
  } else {
    console.warn(`[RadiProtocol] Anchor node '${anchorNodeId}' not found — using default position.`);
  }
}
```

## Info

### IN-01: Mixed null/undefined return convention

**File:** `src/canvas/canvas-node-factory.ts:45,81`
**Issue:** `getCanvasWithCreateAPI` returns `CanvasInternal | undefined` (line 81), while `createNode` returns `CreateNodeResult | null` (line 42). The falsy check on line 45 (`if (!canvas)`) works correctly, but the mixed convention is a minor inconsistency. The public API returning `null` is the better choice for intentional absence.
**Fix:** No action required. If desired for consistency, change `getCanvasWithCreateAPI` to return `CanvasInternal | null` and use `return null` instead of `return undefined`.

### IN-02: Test assertion tightly coupled to mock return value

**File:** `src/__tests__/canvas-node-factory.test.ts:111-114`
**Issue:** Test 2 asserts `setData` is called with exactly `{ radiprotocol_nodeType: 'question', color: '5' }`. The production code spreads `...nodeData` before these fields (line 65-69 of the factory). The test passes because the mock `getData` returns `{}`, so the spread adds nothing. If the mock returned realistic data (e.g., `{ id: 'new-node-1', type: 'text' }`), the assertion would fail. This coupling is acceptable for a unit test but worth noting.
**Fix:** No action required. Alternatively, use `expect.objectContaining()` for a more resilient assertion:
```typescript
expect(fakeNode.setData).toHaveBeenCalledWith(
  expect.objectContaining({
    radiprotocol_nodeType: 'question',
    color: '5',
  })
);
```

---

_Reviewed: 2026-04-16T12:32:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
