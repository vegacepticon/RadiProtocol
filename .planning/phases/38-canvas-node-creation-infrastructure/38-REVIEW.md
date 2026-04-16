---
phase: 38-canvas-node-creation-infrastructure
reviewed: 2026-04-16T12:25:00Z
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
  info: 1
  total: 2
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-04-16T12:25:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 38 introduces `CanvasNodeFactory`, a service that programmatically creates typed RadiProtocol nodes on an open Obsidian canvas using the internal `createTextNode()` API. The implementation is clean, well-structured, and follows established project patterns (mirrors `CanvasLiveEditor` lifecycle). Type declarations in `canvas-internal.d.ts` are properly extended, integration into `main.ts` follows the existing service instantiation and teardown pattern, and all 8 tests pass.

One warning-level issue found regarding fallback positioning when an `anchorNodeId` is provided but does not exist in the canvas nodes map. One informational item about the `destroy()` method placeholder.

## Warnings

### WR-01: Silent fallback to origin when anchorNodeId is invalid

**File:** `src/canvas/canvas-node-factory.ts:49-53`
**Issue:** When `anchorNodeId` is provided but the node is not found in `canvas.nodes`, the position silently falls back to `{ x: 0, y: 0 }`. This could place a new node on top of an existing node at the origin, with no indication to the caller that the anchor was not found. Callers (Phase 39 Quick-Create, Phase 40 Duplication) may pass a stale or deleted node ID and get unexpected positioning without any feedback.
**Fix:** Return `null` (or show a Notice) when the caller explicitly requests anchoring to a node that does not exist, so the caller can handle the failure. Alternatively, at minimum log a warning:
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

### IN-01: Empty destroy() method

**File:** `src/canvas/canvas-node-factory.ts:109-111`
**Issue:** The `destroy()` method is a no-op placeholder. While the comment explains it is reserved for future cleanup, this is dead code in the current implementation.
**Fix:** Acceptable as-is given the project pattern (mirrors `CanvasLiveEditor.destroy()`). No action needed unless it remains empty after Phase 39/40 integration.

---

_Reviewed: 2026-04-16T12:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
