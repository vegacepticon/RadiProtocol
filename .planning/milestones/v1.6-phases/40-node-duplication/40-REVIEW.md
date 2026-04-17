---
phase: 40-node-duplication
reviewed: 2026-04-16T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/views/editor-panel-view.ts
  - src/styles/editor-panel.css
  - src/__tests__/editor-panel-create.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 40 adds a "Duplicate node" feature to the editor panel toolbar. The implementation follows the same patterns established by Phase 39 quick-create: reads source node data from the live canvas API, creates a new node via `canvasNodeFactory`, copies `radiprotocol_*` properties, and loads the new node into the editor form. Tests cover the core duplicate flow including edge cases (untyped node, no node loaded). CSS follows the append-only convention with a Phase 40 comment block.

The code is generally well-structured and consistent with the existing codebase patterns. Two warnings and two informational items are noted below.

## Warnings

### WR-01: Duplicate button disabled state not updated after node selection

**File:** `src/views/editor-panel-view.ts:853`
**Issue:** The duplicate button's `disabled` attribute is set once during `renderToolbar()` based on `this.currentNodeId` at render time (line 853). However, `renderToolbar` is called from both `renderIdle()` (where `currentNodeId` is null, so the button is correctly disabled) and `renderForm()` (where `currentNodeId` is already set). The problem is that `renderForm` calls `this.contentEl.empty()` on line 298 which destroys the toolbar, then calls `renderToolbar` on line 299 -- at this point `currentNodeId` is already set from the preceding code path so the button will be enabled. This works correctly for the form case, but there is no mechanism to re-enable the button if the user first opens the panel in idle state and then clicks a node (since `renderNodeForm` calls `renderForm` which rebuilds the toolbar). This is actually fine because `renderForm` rebuilds the toolbar. No actual bug here on closer analysis -- downgrading this.

Actually, the real concern: after `onDuplicate()` completes, `renderForm` is called on line 830 which rebuilds the toolbar. But if the factory returns `null` on line 811, `onDuplicate` returns early without re-rendering -- the button remains in whatever state it was, which is correct (still enabled for the same node). This path is fine.

Revised issue: The duplicate button remains enabled even when the user clicks it and the canvas is not found (line 796 `if (!canvas) return;`) or the source node is not found (line 798 `if (!sourceNode) return;`). These are silent failures with no user feedback -- the button click does nothing. This could be confusing.

**Fix:** Add a `Notice` for the silent-return cases at lines 796 and 798, similar to the existing Notice at line 803:
```typescript
const canvas = this.getCanvasForPath(canvasPath);
if (!canvas) {
  new Notice('Canvas not available. Try clicking the canvas first.');
  return;
}
const sourceNode = canvas.nodes.get(this.currentNodeId);
if (!sourceNode) {
  new Notice('Source node not found on canvas.');
  return;
}
```

### WR-02: Source node ID copied into duplicate via radiprotocol_* property bleed

**File:** `src/views/editor-panel-view.ts:814-819`
**Issue:** The property copy loop at line 815-818 copies ALL keys starting with `radiprotocol_` from the source node. For `loop-end` nodes, this includes `radiprotocol_loopStartId` which references a specific loop-start node by ID. When duplicated, the new node will have the same `radiprotocol_loopStartId`, which may or may not be the user's intent. This is not a bug per se (the user can edit it), but it is a semantic concern worth noting -- duplicating a loop-end node creates a second loop-end pointing to the same loop-start, which could produce confusing graph validation errors.

**Fix:** This is acceptable behavior for v1 (the user can edit after duplication), but consider documenting this in the UI or adding a post-duplicate Notice for loop-end nodes:
```typescript
if (sourceKind === 'loop-end') {
  new Notice('Duplicated loop-end node -- update the Loop Start ID to avoid conflicts.');
}
```

## Info

### IN-01: CSS duplication between create buttons and duplicate button

**File:** `src/styles/editor-panel.css:93-120`
**Issue:** The `.rp-duplicate-btn` styles (lines 93-120) are nearly identical to `.rp-create-question-btn, .rp-create-answer-btn` (lines 59-90). The only difference is that they are defined as separate rulesets. This is not a bug but increases maintenance surface.

**Fix:** Add `.rp-duplicate-btn` to the existing combined selector:
```css
.rp-create-question-btn,
.rp-create-answer-btn,
.rp-duplicate-btn {
  /* shared styles */
}
```
This would replace lines 59-90 and 93-120 with a single combined ruleset plus the `:hover`, `:active`, and `:disabled` pseudo-class rules. Note: per CLAUDE.md's "append-only" CSS rule, this refactor should only be done if the team agrees to consolidate in a future cleanup phase.

### IN-02: Test file header comment references only Phase 39

**File:** `src/__tests__/editor-panel-create.test.ts:1-4`
**Issue:** The file header comment says "Unit tests for quick-create toolbar behavior (Phase 39, Plan 01)" but the file now also contains Phase 40 duplicate tests (lines 134-273). The filename `editor-panel-create.test.ts` also does not fully reflect the duplicate functionality.

**Fix:** Update the header comment to include Phase 40:
```typescript
// Unit tests for quick-create toolbar behavior (Phase 39) and node duplication (Phase 40)
```

---

_Reviewed: 2026-04-16T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
