---
phase: 12-runner-layout-overhaul
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/__tests__/RunnerView.test.ts
  - src/styles.css
  - src/views/runner-view.ts
  - styles.css
  - vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the runner layout overhaul files: the main view (`runner-view.ts`), its test suite (`RunnerView.test.ts`), the component stylesheet (`src/styles.css`), the root stylesheet placeholder (`styles.css`), and the Vitest config. No critical security vulnerabilities were found. Two warnings were identified: a functional auto-grow bug where `scrollHeight` is read before the element is laid out (always yields 0), and a DOM ordering issue where the preview zone is rendered above the question zone. Three informational items cover duplicate tests, a misleading test name/description, and a redundant `contentEl.empty()` call.

---

## Warnings

### WR-01: `scrollHeight` read before element is attached to DOM — auto-grow always sets height to 0px

**File:** `src/views/runner-view.ts:492-493`

**Issue:** `renderPreviewZone` creates a `<textarea>` via `zone.createEl(...)`, then immediately reads `textarea.scrollHeight` to set its height. At this point the element is appended to `zone`, but `zone` itself may not yet be painted/laid out by the browser engine. `scrollHeight` will return `0` in practice before the first layout pass, causing `textarea.style.height` to be set to `'0px'` on every render — the textarea will appear collapsed. The CSS rule `height: auto` on `.rp-preview-textarea` is never effective because the inline style overrides it.

**Fix:** Remove the synchronous `scrollHeight` read and instead trigger auto-grow after the element is rendered using a `requestAnimationFrame` (or equivalent post-layout callback):

```typescript
private renderPreviewZone(zone: HTMLElement, text: string): void {
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  // scrollHeight is only valid after layout — defer until next frame
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
  this.previewTextarea = textarea;
}
```

Alternatively, drop the inline height manipulation entirely and rely solely on the CSS `height: auto` with `overflow: hidden` already defined on `.rp-preview-textarea`, using a CSS-only auto-grow approach (e.g., `field-sizing: content` for modern browsers, or a CSS grid trick).

---

### WR-02: DOM order places preview zone above question zone — conflicts with conventional UI flow

**File:** `src/views/runner-view.ts:244-247`

**Issue:** In `render()`, `previewZone` is created and appended to `root` before `questionZone`:

```typescript
const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
const previewZone = root.createDiv({ cls: 'rp-preview-zone' });   // line 245 — first child
const questionZone = root.createDiv({ cls: 'rp-question-zone' }); // line 246 — second child
```

The flex column layout in `.rp-runner-view` renders children top-to-bottom in DOM order. This means the preview textarea appears above the active question, placing output above input. If the design intent for phase 12 is "question on top, preview below", the creation order must be swapped. If "preview on top" is intentional (as a phase 12 layout change), this warning can be dismissed — but it should be explicitly confirmed against the UAT spec.

**Fix (if question-first is intended):**

```typescript
const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
const questionZone = root.createDiv({ cls: 'rp-question-zone' });
const outputToolbar = root.createDiv({ cls: 'rp-output-toolbar' });
const previewZone = root.createDiv({ cls: 'rp-preview-zone' });
```

Or, if preview-first is intentional, add a CSS comment to `.rp-runner-view` documenting the chosen order to prevent future "correction."

---

## Info

### IN-01: Duplicate test assertions under different names (LAYOUT-01 and LAYOUT-02)

**File:** `src/__tests__/RunnerView.test.ts:43-49`

**Issue:** Tests `LAYOUT-02` (lines 43–45) and `LAYOUT-01` (lines 47–49) both assert exactly the same condition — that `renderPreviewZone` exists on `RunnerView.prototype`. They carry different spec IDs and descriptions but execute identical `expect` calls.

**Fix:** Remove the duplicate. If LAYOUT-01 and LAYOUT-02 cover distinct acceptance criteria, give each a distinct assertion (e.g., LAYOUT-02 could test DOM order by constructing a minimal view with a stub leaf, while LAYOUT-01 tests method existence).

---

### IN-02: Test description `UI-12` claims a specific return value that is never asserted

**File:** `src/__tests__/RunnerView.test.ts:23-26`

**Issue:** The test is named `"UI-12: getDisplayText returns RadiProtocol runner"` but only checks `typeof RunnerView.prototype.getDisplayText === 'function'`. The actual implementation at `runner-view.ts:34` returns `'Protocol runner'` (not `'RadiProtocol runner'`). The value discrepancy is masked by the stub-only assertion, making the test misleading as a specification guard.

**Fix:** Either assert the return value directly (by constructing a stub leaf and calling `getDisplayText()`), or rename the test to match what it actually checks (`"UI-12: RunnerView has getDisplayText method"`). If `'RadiProtocol runner'` is the intended display text, update `runner-view.ts:34` accordingly.

---

### IN-03: Redundant `contentEl.empty()` in `onClose`

**File:** `src/views/runner-view.ts:199`

**Issue:** `onClose()` calls `this.contentEl.empty()` explicitly. Obsidian's `ItemView` base class already empties `contentEl` as part of its standard close lifecycle. The call is harmless but adds noise and could confuse maintainers into thinking it is necessary.

**Fix:** Remove the explicit `this.contentEl.empty()` from `onClose()` and rely on the base class behaviour, retaining only the selector teardown:

```typescript
async onClose(): Promise<void> {
  this.selector?.destroy();
  this.selector = null;
}
```

---

_Reviewed: 2026-04-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
