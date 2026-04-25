# Debug Session: inline-runner-tab-switch-resets-size

**Phase:** 67
**Gap:** Test 2 — Inline Runner modal size should persist across tab switches and new note opens
**Severity:** major

## Symptoms

After resizing the Inline Runner modal, switching to another Obsidian tab (especially opening a new tab and then switching back) causes the modal size to revert to default. Switching between already-open tabs sometimes preserves the size.

## Investigation

### Code Path Analysis

1. `handleActiveLeafChange()` (`inline-runner-modal.ts:589`) hides the modal (`is-hidden` / `display: none`) when the target note is not active, and shows it again when returning.
2. `reclampCurrentPosition()` (`inline-runner-modal.ts:721`) is registered on `layout-change` and `window-resize`. It re-clamps and re-applies the current layout.
3. `restoreOrDefaultPosition()` (`inline-runner-modal.ts:687`) is called on modal open and reads the last saved layout from plugin settings.

### Critical Chain

The tab-switch symptom is a **downstream effect of the drag bug** (see `inline-runner-drag-resets-size.md`):

1. User resizes the modal → `style.width`/`style.height` are updated by the browser's `resize: both`.
2. **User drags the modal** (or dragging occurred earlier in the session).
3. During drag, `applyPosition()` clears `style.width`. `dragUpHandler` saves a corrupted layout with **default width** (360 px) but preserved height.
4. Later, when switching tabs, `reclampCurrentPosition()` or `restoreOrDefaultPosition()` reads the corrupted saved state.
5. `reclampCurrentPosition()` also reads `style.width` directly. If the modal was not resized again after the drag, `style.width` is still empty (never restored after being cleared by `applyPosition`). It falls back to the corrupted saved width → default.
6. `applyLayout()` is called with the default width, visually resetting the modal.

### Why "new tab" triggers it more reliably

Opening a new tab fires Obsidian's `layout-change` event. This calls `reclampCurrentPosition(true)`, which forces an `applyLayout()` with the corrupted saved dimensions. Switching between existing tabs may not fire `layout-change`, so the reset is delayed until the next reclamp event.

### Root Cause

Same root cause as Gap 1: `applyPosition()` clears `style.width` during drag, corrupting persisted state. Tab switching merely surfaces the corrupted state.

### Files Involved

- `src/views/inline-runner-modal.ts` — `applyPosition()`, `dragMoveHandler`, `reclampCurrentPosition()`.

### Fix Direction

Fix the drag handler so it no longer strips `style.width`. Once the saved state is no longer corrupted, tab-switching will naturally preserve the correct size because `reclampCurrentPosition()` will read valid `style.width` / saved values.

No separate tab-switch fix is required.
