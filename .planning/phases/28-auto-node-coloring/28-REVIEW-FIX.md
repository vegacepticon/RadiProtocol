---
phase: 28-auto-node-coloring
fixed_at: 2026-04-13T14:04:39Z
review_path: .planning/phases/28-auto-node-coloring/28-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-04-13T14:04:39Z
**Source review:** .planning/phases/28-auto-node-coloring/28-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-03: Logically dead sub-condition in fallback type-resolution guard

**Files modified:** `src/views/editor-panel-view.ts`
**Commit:** 7da6f6f
**Applied fix:** Changed `if (!isTypeChange && !isUnmarkingType)` to `if (!isTypeChange)` at the D-04 fallback type-resolution guard (line 211). Added a comment explaining the invariant: `isUnmarkingType` implies `isTypeChange`, so `!isTypeChange` already covers `!isUnmarkingType`. The redundant sub-condition was removed for clarity.

### WR-02: Duplicate color injection in `onTypeDropdownChange` — divergence risk

**Files modified:** `src/views/editor-panel-view.ts`
**Commit:** 0754870
**Applied fix:** Removed the `NODE_COLOR_MAP` lookup block and `edits['color'] = undefined` unmark path from `onTypeDropdownChange` (previously lines 597–608). Color injection and color-clearing for all paths (type change, unmark, field-only save) are now handled exclusively inside `saveNodeEdits`, which already covered all cases. Added a comment documenting the single-responsibility contract. Build verified clean after this change.

### WR-01: Live-save unmark path sends `color: undefined` — canvas API may ignore it

**Files modified:** `src/views/editor-panel-view.ts`
**Commit:** 0754870 (resolved by WR-02 fix)
**Applied fix:** WR-01 and WR-02 share the same root cause and were resolved together. The `color: undefined` entry that WR-01 flagged originated from the duplicate color-injection block in `onTypeDropdownChange` (the `else if` branch that set `edits['color'] = undefined`). Removing that block (WR-02 fix) eliminates the `color: undefined` value from reaching `saveLive`.

Additionally, `CanvasLiveEditor.saveLive` (canvas-live-editor.ts lines 95–107) independently detects the unmark case via its own `isUnmarking` flag (checking `radiprotocol_nodeType` in edits) and does `delete node['color']` — so the live path correctly clears color on unmark regardless of what `edits['color']` contains. No additional sentinel value or contract change was needed.

---

_Fixed: 2026-04-13T14:04:39Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
