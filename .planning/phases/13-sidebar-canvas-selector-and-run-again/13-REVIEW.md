---
phase: 13-sidebar-canvas-selector-and-run-again
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/styles.css
  - src/views/runner-view.ts
  - src/__tests__/RunnerView.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three source files were reviewed for Phase 13 (Sidebar Canvas Selector and Run Again). The new `CanvasSelectorWidget` integration in `runner-view.ts` is structurally sound and the null-safety concern in `handleSelectorSelect` turned out to be benign (the widget's `setSelectedPath` already accepts `string | null`). No critical security or correctness bugs were found. Three warnings identify a session-clear side-effect inside `render()` that contradicts the file's own Pitfall 6 rule, an unguarded non-null assertion, and an inconsistent DOM event listener that bypasses Obsidian's lifecycle cleanup. Three info items cover a vacuous test, a stale rAF callback, and empty CSS rules.

## Warnings

### WR-01: `sessionService.clear()` called inside `render()` — violates Pitfall 6

**File:** `src/views/runner-view.ts:396-399`

**Issue:** The `complete` branch of `render()` fires `void this.plugin.sessionService.clear(this.canvasFilePath)`. Line 469 of the same file contains an explicit Pitfall 6 warning: "Do NOT call this inside render()". `render()` is called on every state transition and can be called more than once after the `complete` state is reached (e.g., the view is re-opened, layout restores, or future code paths call `render()` without going through `openCanvas()`). Each call fires a concurrent async `clear()`, which is redundant and could race with a subsequent `openCanvas()` that writes a new session.

**Fix:** Move the clear call out of `render()` and into `openCanvas()` after `this.runner.start(graph)`, where it executes exactly once per fresh run. Alternatively, guard with a boolean flag:

```typescript
// In render(), complete branch — REMOVE:
// void this.plugin.sessionService.clear(this.canvasFilePath);

// In openCanvas(), after this.runner.start(graph):
if (this.canvasFilePath !== null) {
  void this.plugin.sessionService.clear(this.canvasFilePath);
}
this.runner.start(graph);
this.render();
```

---

### WR-02: Non-null assertion `this.canvasFilePath!` without null guard

**File:** `src/views/runner-view.ts:408`

**Issue:** The `complete` branch uses `this.canvasFilePath!` to pass the path to `openCanvas`. TypeScript types `canvasFilePath` as `string | null`. The assertion is correct under normal flow (the `complete` state requires `openCanvas` to have succeeded), but any test stub, future refactor, or edge-case that drives the runner to `complete` without setting `canvasFilePath` will produce a runtime `TypeError` without a clear error message.

**Fix:** Add a null guard that disables the button or renders a message when the path is unexpectedly null:

```typescript
const runAgainBtn = questionZone.createEl('button', {
  cls: 'rp-run-again-btn',
  text: 'Run again',
});
if (this.canvasFilePath === null) {
  runAgainBtn.disabled = true;
} else {
  const path = this.canvasFilePath; // narrow to string
  this.registerDomEvent(runAgainBtn, 'click', () => {
    void this.openCanvas(path);
  });
}
```

---

### WR-03: `textarea.addEventListener` bypasses Obsidian's lifecycle cleanup

**File:** `src/views/runner-view.ts:508-511`

**Issue:** The `input` listener on the preview textarea is registered with the native `addEventListener` rather than `this.registerDomEvent`. Every other DOM listener in the file uses `registerDomEvent`, which Obsidian automatically removes when the view closes. If the textarea element is kept alive (e.g., cached in `this.previewTextarea`), this native listener is never removed. It is a minor inconsistency that could cause confusion during debugging or future maintenance.

**Fix:** Replace with `registerDomEvent` to match the rest of the file:

```typescript
// Replace:
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});

// With:
this.registerDomEvent(textarea, 'input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
```

---

## Info

### IN-01: Vacuous test always passes regardless of code state

**File:** `src/__tests__/RunnerView.test.ts:61-62`

**Issue:** The test `SIDEBAR-01: CanvasSelectorWidget mock is registered` asserts `expect(true).toBe(true)`. The comment explains this is a structural import guard, but a vacuous assertion provides no signal — it passes even if the import is deleted from `runner-view.ts`. If the mock were removed from the test file and the real module were imported, Vitest would fail for a different reason, not this test.

**Fix:** Either remove the test (the `vi.mock` at the top already ensures the import resolves) or replace the assertion with something observable:

```typescript
it('SIDEBAR-01: CanvasSelectorWidget class is importable (mock guard)', async () => {
  const { CanvasSelectorWidget } = await import('../views/canvas-selector-widget');
  expect(CanvasSelectorWidget).toBeDefined();
});
```

---

### IN-02: `requestAnimationFrame` callback may run against a detached element

**File:** `src/views/runner-view.ts:504-507`

**Issue:** `requestAnimationFrame` captures `textarea` and applies height styles after layout. If `render()` is called again before the frame fires (quick state transitions are possible), the callback runs against a detached DOM element. The mutation is silent and harmless in practice, but it produces dead work and can be confusing when debugging layout.

**Fix:** Cancel the rAF handle at the start of the next `render()` call:

```typescript
// Add a field:
private previewTextareaRafHandle: number | null = null;

// At the top of render(), before contentEl.empty():
if (this.previewTextareaRafHandle !== null) {
  cancelAnimationFrame(this.previewTextareaRafHandle);
  this.previewTextareaRafHandle = null;
}

// In renderPreviewZone():
this.previewTextareaRafHandle = requestAnimationFrame(() => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  this.previewTextareaRafHandle = null;
});
```

---

### IN-03: Empty CSS rules for `.rp-selector-folder-row` and `.rp-selector-file-row`

**File:** `src/styles.css:540-546`

**Issue:** Both `.rp-selector-folder-row` and `.rp-selector-file-row` are empty rules containing only a comment that says they inherit `.rp-selector-row`. These rules add no styles and produce minor stylesheet bloat. They also create a false impression that the classes have distinct styling.

**Fix:** Remove the empty rules. The comment intent can be preserved in the HTML or kept as an inline code comment in `canvas-selector-widget.ts` if needed:

```css
/* Remove: */
.rp-selector-folder-row {
  /* inherits .rp-selector-row */
}

.rp-selector-file-row {
  /* inherits .rp-selector-row */
}
```

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
