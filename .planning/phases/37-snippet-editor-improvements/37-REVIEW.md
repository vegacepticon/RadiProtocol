---
phase: 37-snippet-editor-improvements
reviewed: 2026-04-16T12:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/views/snippet-manager-view.ts
  - src/__tests__/snippet-tree-view.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-04-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the snippet manager tree view (987 lines) and its test file (575 lines). No security vulnerabilities or critical bugs found. The service layer provides defense-in-depth path traversal guards. Three warnings relate to missing input validation at the view layer, duplicated expand-state rewrite logic, and a drag-source read that silently returns an empty path. Three info items cover code duplication, unused utility, and test mock fidelity.

## Warnings

### WR-01: Subfolder name validation does not reject `..` (path traversal at view layer)

**File:** `src/views/snippet-manager-view.ts:533-536`
**Issue:** The `handleCreateSubfolder` validator rejects `/` and `\` in the subfolder name but does not reject `..`. While the service layer (`SnippetService.createFolder`) has a path-safety guard that catches traversal, rejecting `..` at the view layer provides earlier, clearer user feedback and follows defense-in-depth.
**Fix:**
```typescript
if (/[\\/]/.test(trimmed) || trimmed === '..' || trimmed === '.') {
  new Notice('Имя подпапки не должно содержать «/», «\\», «.» или «..».');
  return;
}
```

### WR-02: Duplicated expand-state prefix rewrite logic in two methods

**File:** `src/views/snippet-manager-view.ts:703-717` and `src/views/snippet-manager-view.ts:944-956`
**Issue:** The expand-state prefix rewrite loop (lines 703-717 in `performMove` and 944-956 in `commitInlineRename`) is identical. If one is updated and the other is not, they will diverge and cause bugs with persisted expanded-path state after move vs rename operations. This is a maintenance hazard.
**Fix:** Extract a shared private method:
```typescript
private async rewriteExpandState(oldPath: string, newPath: string): Promise<void> {
  const expanded = this.plugin.settings.snippetTreeExpandedPaths;
  let mutated = false;
  for (let i = 0; i < expanded.length; i++) {
    const entry = expanded[i]!;
    if (entry === oldPath) {
      expanded[i] = newPath;
      mutated = true;
    } else if (entry.startsWith(oldPath + '/')) {
      expanded[i] = newPath + entry.slice(oldPath.length);
      mutated = true;
    }
  }
  if (mutated) await this.plugin.saveSettings();
}
```

### WR-03: `readDragSource` returns `{ path: '', kind: 'file' }` when getData returns empty string

**File:** `src/views/snippet-manager-view.ts:757-759`
**Issue:** During `dragover`, browsers restrict `getData()` to return `''` for security (only `dragstart` and `drop` can read the actual data). The code correctly checks for MIME type presence in `types`, but then falls through to return `{ path: '', kind: 'file' }` with an empty path. Callers like `handleDragOver` then call `isDropForbidden('', 'file', target)` which computes `dirname('') === ''` -- this means dropping on the root folder will incorrectly show as "forbidden" (no-op detected) during dragover. The actual drop in `handleDrop` reads the real path correctly, so the move itself works, but the visual feedback is wrong for root-level targets.
**Fix:** In `readDragSource`, when the path is empty (dragover scenario), return an object with a sentinel that callers can check, or simply allow the dragover for empty-path sources:
```typescript
if (hasFile) {
  const p = ev.dataTransfer?.getData(MIME_FILE) ?? '';
  return { path: p, kind: 'file' as const };
}
```
And in `isDropForbidden`, treat empty source path as "unknown, allow drop":
```typescript
if (srcPath === '') return false; // dragover — path unknown, allow visual feedback
```

## Info

### IN-01: `basename` utility declared but only silenced via `void basename`

**File:** `src/views/snippet-manager-view.ts:55-57, 991`
**Issue:** The `basename` function is defined but never called. It is kept alive only by `void basename;` at line 991 with a comment explaining it silences lint warnings. If it has no consumers, it should be removed rather than suppressed.
**Fix:** Remove the `basename` function (lines 55-57) and the `void basename;` statement (line 991) if no future phase needs it. If it is planned for Phase 37, keep it.

### IN-02: Duplicated canvas-ref rewrite + Notice pattern across `performMove` and `commitInlineRename`

**File:** `src/views/snippet-manager-view.ts:694-724` and `src/views/snippet-manager-view.ts:935-963`
**Issue:** Beyond the expand-state rewrite (WR-02), the full canvas-ref mapping + rewrite + Notice pattern is also duplicated between these two methods. This increases maintenance cost. Consider extracting a `rewriteRefsAndNotify(oldPath, newPath)` helper.

### IN-03: Test mock `MockEl.removeEventListener` is not implemented

**File:** `src/__tests__/snippet-tree-view.test.ts:109-123`
**Issue:** The `MockEl` interface declares `removeEventListener` in the type but the `makeEl` factory does not implement it. The `startInlineRename` cleanup code calls `removeEventListener` on the input element (line 868-870 of the view). Since the view wraps the call in try/catch, tests pass, but the cleanup is silently failing in tests -- event listeners on the transient input are never actually removed in the test environment. This reduces test fidelity for inline rename scenarios.
**Fix:** Add `removeEventListener` to the mock:
```typescript
removeEventListener(type: string, handler: (ev: unknown) => void): void {
  const arr = listeners.get(type);
  if (arr) {
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  }
},
```

---

_Reviewed: 2026-04-16T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
