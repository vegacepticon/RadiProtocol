---
phase: 39-quick-create-ui-in-node-editor
reviewed: 2026-04-16T14:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/__tests__/editor-panel-create.test.ts
  - src/views/editor-panel-view.ts
  - src/styles/editor-panel.css
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-04-16T14:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 39 adds a quick-create toolbar to the Node Editor panel with two buttons (Create question node, Create answer node). The implementation is clean and well-structured: `onQuickCreate` correctly flushes pending debounce saves before creating, delegates to `CanvasNodeFactory.createNode`, and loads the newly created node into the editor form. CSS follows project conventions (appended to `editor-panel.css` with phase comment, uses Obsidian CSS variables). Tests cover the key contract points (factory delegation, anchor passing, null-return guard, Notice on missing canvas, debounce flush). The previous review's WR-01 (raw `addEventListener` instead of `registerDomEvent`) has been fixed.

One warning about a timing-based race condition and two informational items remain.

## Warnings

### WR-01: Race condition with hardcoded 150ms delay after node creation

**File:** `src/views/editor-panel-view.ts:744`
**Issue:** `onQuickCreate` uses `await new Promise(resolve => setTimeout(resolve, 150))` to wait for `canvas.requestSave()` to flush the new node to disk before calling `loadNode()`. This is a race condition: if the save takes longer than 150ms (e.g., large canvas file, slow disk, or system under load), `loadNode` will call `vault.read()` and get stale JSON that does not contain the newly created node, causing a "Node not found in canvas" error shown to the user via `renderError`.
**Fix:** If `CanvasNodeFactory.createNode()` can be modified to return a promise that resolves after `requestSave()` completes, that would eliminate the race. Alternatively, add a retry in `renderNodeForm` when the node is not found:
```typescript
// In renderNodeForm, after nodeRecord lookup fails on line 287:
if (!nodeRecord && this._createRetries < 2) {
  this._createRetries++;
  await new Promise(resolve => setTimeout(resolve, 200));
  return this.renderNodeForm(filePath, nodeId);
}
this._createRetries = 0;
```

## Info

### IN-01: Duplicated canvas-leaf resolution logic

**File:** `src/views/editor-panel-view.ts:706-711`
**Issue:** `getActiveCanvasPath()` duplicates the canvas-leaf resolution pattern from `attachCanvasListener()` (lines 54-57). Both use `getLeavesOfType('canvas')` + `getMostRecentLeaf()` + fallback to first. If the resolution strategy changes, both sites must be updated in lockstep.
**Fix:** Extract a shared `private getActiveCanvasLeaf()` helper that both methods call. Low priority -- the duplication is small (3 lines).

### IN-02: renderError omits toolbar

**File:** `src/views/editor-panel-view.ts:698-702`
**Issue:** `renderError()` does not call `renderToolbar()`, unlike `renderIdle()` (line 127) and `renderForm()` (line 298). When the user encounters an error state, the quick-create buttons disappear until a node is re-selected or the panel is re-opened. This creates a minor UX inconsistency where the toolbar is available in idle and form states but not in error states.
**Fix:** Add `this.renderToolbar(this.contentEl);` before the error div in `renderError()` if the toolbar should persist across all view states. Optional -- the error state is transient.

---

_Reviewed: 2026-04-16T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
