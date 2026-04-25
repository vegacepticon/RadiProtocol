# Phase 67 Gap Closure Plan

## Context

UAT found 2 major issues + 1 enhancement request after Phase 67 execution:

| Gap | Severity | Root Cause |
|-----|----------|------------|
| Drag resets size after resize | major | `getAppliedPosition()` reads only `left`/`top`; `dragUpHandler` saves position-only, overwriting saved width/height |
| Tab switch resets size | major | `reclampCurrentPosition()` uses `getBoundingClientRect()` on hidden element (`is-hidden` → `display:none` → 0×0), falls back to defaults, and persists them |
| Default size too small | minor | `INLINE_RUNNER_DEFAULT_WIDTH=360, HEIGHT=240` causes scrollbar with typical content |

## Files to Modify

- `src/views/inline-runner-modal.ts` — all fixes
- `src/__tests__/views/inline-runner-position.test.ts` — update drag-save assertion for layout payload
- `src/__tests__/inline-runner-layout.test.ts` — add test for hidden-element reclamp guard

## Tasks

### Task 1: Replace `getAppliedPosition` with `getAppliedLayout`

**In `src/views/inline-runner-modal.ts`:**

1. Rename `getAppliedPosition()` → `getAppliedLayout()`.
2. Read `width` and `height` from `containerEl.style.width` / `containerEl.style.height` (parseFloat, fallback to defaults if not finite).
3. Return `InlineRunnerLayout | null` instead of `InlineRunnerLayout | null` with only `left`/`top`.
4. Update all callers:
   - `dragUpHandler` → use `getAppliedLayout()`
   - `reclampCurrentPosition` → use `getAppliedLayout()` for `currentPosition`
   - `handleResizeDebounceExpire` → use `getAppliedLayout()` for `appliedPosition`
   - `restoreOrDefaultPosition` — no change (reads from plugin settings)

### Task 2: Fix `dragUpHandler` to save full layout

**In `src/views/inline-runner-modal.ts`:**

Replace:
```ts
const finalPosition = this.getAppliedPosition();
this.removeDragListeners();
if (finalPosition !== null) {
  void this.plugin.saveInlineRunnerPosition(finalPosition);
}
```

With:
```ts
const finalLayout = this.getAppliedLayout();
this.removeDragListeners();
if (finalLayout !== null) {
  void this.plugin.saveInlineRunnerPosition(finalLayout);
}
```

### Task 3: Fix `reclampCurrentPosition` to avoid reading from hidden element

**In `src/views/inline-runner-modal.ts`:**

Change size reading from:
```ts
const rect = this.containerEl.getBoundingClientRect();
const current: InlineRunnerLayout = {
  left: currentPosition.left,
  top: currentPosition.top,
  width: rect.width > 0 ? rect.width : INLINE_RUNNER_DEFAULT_WIDTH,
  height: rect.height > 0 ? rect.height : INLINE_RUNNER_DEFAULT_HEIGHT,
};
```

To read width/height from **inline styles** (or saved layout) instead of `getBoundingClientRect`:
```ts
const saved = this.plugin.getInlineRunnerPosition();
const styleWidth = Number.parseFloat(this.containerEl.style.width);
const styleHeight = Number.parseFloat(this.containerEl.style.height);
const current: InlineRunnerLayout = {
  left: currentPosition.left,
  top: currentPosition.top,
  width: Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : (saved?.width ?? INLINE_RUNNER_DEFAULT_WIDTH),
  height: Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : (saved?.height ?? INLINE_RUNNER_DEFAULT_HEIGHT),
};
```

Also add early return if element is hidden:
```ts
if (this.containerEl.hasClass('is-hidden')) return;
```

### Task 4: Increase default size

**In `src/views/inline-runner-modal.ts`:**

Change:
```ts
const INLINE_RUNNER_DEFAULT_WIDTH = 360;
const INLINE_RUNNER_DEFAULT_HEIGHT = 240;
```

To:
```ts
const INLINE_RUNNER_DEFAULT_WIDTH = 420;
const INLINE_RUNNER_DEFAULT_HEIGHT = 320;
```

### Task 5: Update tests

**In `src/__tests__/views/inline-runner-position.test.ts`:**
- Update drag-save assertion: expect `{ left, top, width, height }` payload instead of `{ left, top }`.

**In `src/__tests__/inline-runner-layout.test.ts`:**
- Add test: when container is hidden (`display:none`), `reclampCurrentPosition` must NOT fallback to defaults and must NOT call save.

### Task 6: Build & verify

Run:
```bash
npm run build
npm test
```

## Verification Criteria

- [ ] Resize modal, drag it — size stays as resized (not reset to default).
- [ ] Resize modal, switch to new note tab, switch back — size persists.
- [ ] Default size for new users is 420×320 (no scrollbar for typical question + 3 answers).
- [ ] All existing tests pass (805+).
- [ ] `npm run build` succeeds.

## Commits

1. `fix(inline-runner): drag and tab-switch preserve resized dimensions`
2. `style(inline-runner): increase default modal size to 420x320`
