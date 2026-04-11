---
phase: 23-node-editor-auto-save-and-color-on-type-change
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/__tests__/editor-panel.test.ts
  - src/styles.css
  - src/views/editor-panel-view.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 23 implementation covering auto-save debounce, flush-on-node-switch, and color-on-type-change for `EditorPanelView`. The core logic is sound — snapshot-at-schedule-time is correctly implemented, the flush-before-switch guard is correct, and the saved indicator lifecycle is clean.

Three warnings were found: two unhandled promise rejections in the auto-save flow (which will surface as uncaught errors in the console), and a potential `undefined` color assignment that silently deletes the color field instead of setting it for an unrecognized node type. Three informational items cover a debounce duration mismatch between the implementation and test description, duplicated CSS rules, and a dead guard.

---

## Warnings

### WR-01: Unhandled promise rejection in `scheduleAutoSave` timer callback

**File:** `src/views/editor-panel-view.ts:500`

**Issue:** The debounce timer fires `void this.saveNodeEdits(...).then(() => { this.showSavedIndicator(); })`. There is no `.catch()`. If `saveNodeEdits` rejects (e.g., vault write error), the rejection is unhandled — it propagates as an uncaught promise rejection and will appear as a console error or crash in some environments. The `.then()` handler also means `showSavedIndicator` is never called on failure, which is correct, but the rejection itself must be swallowed explicitly.

**Fix:**
```typescript
this._debounceTimer = setTimeout(() => {
  this._debounceTimer = null;
  void this.saveNodeEdits(filePath, nodeId, edits)
    .then(() => { this.showSavedIndicator(); })
    .catch(err => {
      console.error('[RadiProtocol] auto-save failed:', err);
    });
}, 800);
```

---

### WR-02: Unhandled promise rejection in `onTypeDropdownChange`

**File:** `src/views/editor-panel-view.ts:523`

**Issue:** `void this.saveNodeEdits(...).then(() => { this.showSavedIndicator(); })` on the type-change save path has no `.catch()`, for the same reason as WR-01. An error from `saveNodeEdits` (e.g., vault permission failure) will be an unhandled rejection.

**Fix:**
```typescript
void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits)
  .then(() => { this.showSavedIndicator(); })
  .catch(err => {
    console.error('[RadiProtocol] type-change save failed:', err);
  });
```

---

### WR-03: `NODE_COLOR_MAP` lookup may return `undefined`, silently deleting `color` instead of setting it

**File:** `src/views/editor-panel-view.ts:518`

**Issue:** `edits['color'] = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType]` — if `selectedType` is a valid non-empty string that is not present in `NODE_COLOR_MAP` (e.g., a future node type added to the dropdown before the map is updated), the lookup returns `undefined`. In `saveNodeEdits`, a key with value `undefined` triggers `delete node[key]` (line 211), so the color field gets deleted rather than set. The user sees no error, but the node silently loses its color.

**Fix:** Guard against undefined before assigning:
```typescript
const mappedColor = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType];
if (mappedColor !== undefined) {
  edits['color'] = mappedColor;
}
// else: no color assignment — leaves existing color intact for unknown types
```

---

## Info

### IN-01: Debounce duration is 800ms in implementation but tests describe it as 1000ms

**File:** `src/views/editor-panel-view.ts:503` and `src/__tests__/editor-panel.test.ts:114`

**Issue:** `scheduleAutoSave` uses a 800ms timeout. The test `23-01-01` is named "fires saveNodeEdits after 1000ms" and advances timers by 1000ms. The tests still pass because 1000ms > 800ms, but the stated contract ("1000ms debounce") in test names and comments (`vi.advanceTimersByTimeAsync(1000)`) does not match the actual implementation. Any future test that checks the timer has NOT fired before 800ms (e.g., advancing by 900ms and asserting no call) would pass incorrectly because the timer actually fired at 800ms.

**Fix:** Either change the implementation debounce to 1000ms to match the described contract, or update the test descriptions and advance amounts to 800ms. Whichever is the intended debounce window, the two should agree.

---

### IN-02: Duplicate CSS rule declarations for `.rp-snippet-preview-label` and `.rp-snippet-preview`

**File:** `src/styles.css:549` and `src/styles.css:580`

**Issue:** `.rp-snippet-preview-label` is declared at lines 549–552 and again at lines 580–585. `.rp-snippet-preview` is declared at lines 554–566 and again at lines 587–599. The second declarations fully override the first, making the first instances dead code. The second instances add `margin-bottom` and `padding: var(--size-4-2)` respectively that are absent from the first.

**Fix:** Remove the first (earlier) duplicate declarations at lines 549–566 and keep only the more complete second declarations at lines 580–599. Verify the removed `min-height: 80px` from the first `.rp-snippet-preview` block (line 561) is present in the surviving declaration (it is, at line 598 — `min-height: 80px`).

---

### IN-03: Dead guard `if (!this.contentEl)` in `renderNodeForm`

**File:** `src/views/editor-panel-view.ts:229`

**Issue:** `ItemView.contentEl` is initialized by Obsidian's `ItemView` constructor and is always an `HTMLElement` — it can never be falsy. The guard `if (!this.contentEl) return;` is dead code and will never execute.

**Fix:** Remove the guard. The comment "contentEl may not be initialized if the view is not yet mounted" is incorrect for `ItemView` subclasses.

```typescript
// Remove these two lines:
// if (!this.contentEl) return;
```

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
