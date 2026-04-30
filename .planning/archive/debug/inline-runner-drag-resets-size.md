# Debug Session: inline-runner-drag-resets-size

**Phase:** 67
**Gap:** Test 1 — Inline Runner modal size should persist after resize and not reset when dragging the modal
**Severity:** major

## Symptoms

After resizing the Inline Runner modal via the native CSS resize handle, dragging the modal header causes both width and height to immediately revert to their initial/default values.

## Investigation

### Code Path Analysis

1. **Dragging is initiated** in `enableDragging()` (`inline-runner-modal.ts:744`).
2. On each `pointermove`, `dragMoveHandler` calculates a new position via `clampInlineRunnerPosition()` and applies it:
   ```typescript
   if (next !== null) this.applyPosition(next);
   ```
3. **`applyPosition()`** (`inline-runner-modal.ts:662`) sets `left`/`top` and **clears several inline styles**, including:
   ```typescript
   this.containerEl.style.width = '';
   this.containerEl.style.maxWidth = '';
   ```
   It does **not** clear `style.height`.
4. When the drag ends, `dragUpHandler` calls:
   ```typescript
   const finalLayout = this.getAppliedLayout();
   ```
5. **`getAppliedLayout()`** (`inline-runner-modal.ts:705`) reads `style.width` via `Number.parseFloat`. Because `applyPosition` cleared `style.width` during the drag, `parseFloat('')` returns `NaN`. The helper falls back to `INLINE_RUNNER_DEFAULT_WIDTH` (360 px).
6. `dragUpHandler` then saves this corrupted layout (with default width) to plugin settings via `saveInlineRunnerPosition()`.

### Root Cause

`applyPosition()` was written in Phase 60 when the Inline Runner was a bottom-bar panel whose width was controlled by CSS (anchored to note width). Clearing `style.width` was correct then. In Phase 67, the modal is resizable and `style.width`/`style.height` must be preserved. Calling `applyPosition()` during drag strips the resized width, and the save path then persists the fallback default.

### Files Involved

- `src/views/inline-runner-modal.ts` — `applyPosition()` clears width; `dragMoveHandler` calls it directly.

### Fix Direction

Do not clear `style.width` in `applyPosition()`, or change `dragMoveHandler` to call `applyLayout()` with the original width/height preserved from drag start.

The minimal fix is to remove the `style.width = ''` line from `applyPosition()` because:
- `applyLayout()` (the only other caller) immediately re-sets width anyway.
- In Phase 67 the modal is always explicitly sized, so clearing width is never desired.
