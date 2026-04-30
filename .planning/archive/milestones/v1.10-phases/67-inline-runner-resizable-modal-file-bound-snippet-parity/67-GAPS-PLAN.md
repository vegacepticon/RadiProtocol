# Phase 67 Gap Closure Plan

## Context

UAT found 2 major issues after Phase 67 execution. Diagnosis reveals both share a single root cause in the current codebase.

| Gap | Severity | Root Cause |
|-----|----------|------------|
| Drag resets size after resize | major | `applyPosition()` clears `style.width` during drag. `getAppliedLayout()` reads `NaN`, falls back to default width, and `dragUpHandler` persists the corrupted layout. |
| Tab switch resets size | major | Downstream effect: after drag corrupts saved width to default, `reclampCurrentPosition()` / `restoreOrDefaultPosition()` read the corrupted saved state and apply it. |

## Files to Modify

- `src/views/inline-runner-modal.ts` — fix drag handler

## Diagnosis Summary

### Current code state (already partially refactored from earlier plan)

- `getAppliedLayout()` exists and correctly reads `width`/`height` from inline styles.
- `dragUpHandler` already calls `getAppliedLayout()` and saves the full layout.
- `reclampCurrentPosition()` already reads from inline styles (not `getBoundingClientRect`) and has the `is-hidden` guard.

### The remaining bug

In `enableDragging()` (`inline-runner-modal.ts:744`), `dragMoveHandler` calls:

```typescript
if (next !== null) this.applyPosition(next);
```

`applyPosition()` (`inline-runner-modal.ts:662`) sets `left`/`top` and **clears** `style.width` (and `style.maxWidth`):

```typescript
this.containerEl.style.width = '';
```

This was correct in Phase 60 (bottom-bar panel, width controlled by CSS), but in Phase 67 the modal is explicitly sized via `resize: both`. Clearing `style.width` strips the user's resized width.

On drag end, `getAppliedLayout()` reads the now-empty `style.width`, gets `NaN`, and falls back to `INLINE_RUNNER_DEFAULT_WIDTH` (360px). `dragUpHandler` saves this corrupted default width.

Once saved state is corrupted, any subsequent `reclampCurrentPosition()` or `restoreOrDefaultPosition()` applies the default width, making tab switches appear to reset the size.

## Tasks

### Task 1: Fix `applyPosition()` to not clear explicit width

**In `src/views/inline-runner-modal.ts`:**

In `applyPosition()` (`inline-runner-modal.ts:662`), remove the `style.width` reset:

```typescript
private applyPosition(position: InlineRunnerLayout): void {
  if (this.containerEl === null) return;
  this.containerEl.style.left = `${Math.round(position.left)}px`;
  this.containerEl.style.top = `${Math.round(position.top)}px`;
  this.containerEl.style.right = '';
  this.containerEl.style.bottom = '';
  // Phase 67: do NOT clear style.width — the modal is resizable and width must persist
  // this.containerEl.style.width = '';
  this.containerEl.style.maxWidth = '';
  this.containerEl.style.transform = '';
}
```

**Rationale:**
- `applyPosition()` was written in Phase 60 when the Inline Runner was a bottom-bar panel whose width was controlled by CSS. Clearing `style.width` allowed CSS rules to own the width.
- In Phase 67, the modal uses `resize: both` and `style.width`/`style.height` are explicitly managed. Clearing `style.width` during drag strips the user's resized width.
- The only other caller is `applyLayout()`, which immediately sets `style.width` after calling `applyPosition()`. Removing the clear is therefore harmless for that path.
- This is the minimal, highest-performance fix: the drag handler continues to call `applyPosition(next)` on every pointermove, but now the resized dimensions are preserved.

### Task 2: Build & verify

Run:
```bash
npm run build
npm test
```

## Verification Criteria

- [ ] Resize modal to non-default size, drag header — modal moves without changing size.
- [ ] After dragging, switch Obsidian tabs and back — size persists.
- [ ] Close modal and reopen via "Run protocol in inline" — size restores.
- [ ] All existing tests pass.
- [ ] `npm run build` succeeds.

## Commits

1. `fix(inline-runner): drag preserves resized dimensions`
