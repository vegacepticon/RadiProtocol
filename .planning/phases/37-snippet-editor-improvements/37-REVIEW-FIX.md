---
phase: 37-snippet-editor-improvements
fixed_at: 2026-04-16T11:10:00Z
review_path: .planning/phases/37-snippet-editor-improvements/37-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-04-16T11:10:00Z
**Source review:** .planning/phases/37-snippet-editor-improvements/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Subfolder name validation does not reject `..` (path traversal at view layer)

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 4c02d7a
**Applied fix:** Extended the regex validation in `handleCreateSubfolder` to also reject `..` and `.` as subfolder names. Updated the user-facing Notice message to list the additional forbidden values.

### WR-02: Duplicated expand-state prefix rewrite logic in two methods

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 7b17ed2
**Applied fix:** Extracted the duplicated expand-state prefix rewrite loop into a shared private method `rewriteExpandState(oldPath, newPath)`. Replaced both inline copies (in `performMove` and `commitInlineRename`) with calls to the new method.

### WR-03: `readDragSource` returns `{ path: '', kind: 'file' }` when getData returns empty string

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 92311d6
**Applied fix:** Added an early return in `isDropForbidden` that treats an empty source path as "not forbidden" (returns `false`). This allows correct drag-over visual feedback when browsers restrict `getData()` during `dragover` events, while the actual drop still reads the real path correctly.

---

_Fixed: 2026-04-16T11:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
