# Phase 12: Runner Layout Overhaul - Research

**Researched:** 2026-04-08
**Domain:** Obsidian plugin UI — DOM layout, CSS flexbox, textarea auto-grow
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LAYOUT-01: Textarea auto-grow behavior**
Textarea grows without any height cap — no `max-height`, no internal scrollbar. The outer Obsidian sidebar panel scrolls when content exceeds viewport. The textarea itself must never clip content — `overflow: hidden` with height driven by content (not flex fill). For an empty or short protocol the textarea is small; for a long protocol it is tall and the panel scrolls. Implementation: replace `flex: 1 1 auto` on `.rp-preview-textarea` with height driven by content. Since the textarea is read-only between steps, use `height: auto; overflow: hidden` and resize via `scrollHeight` after setting `.value`. No `resize: none` override needed since it will auto-size.

**LAYOUT-02: Zone order (DOM order)**
`previewZone → questionZone → outputToolbar`. The `<hr>` divider is removed. The three zones stack with CSS `gap` between them:
1. `rp-preview-zone` (textarea, full width, auto-height)
2. `rp-question-zone` (question text + answer buttons + step-back button)
3. `rp-output-toolbar` (Copy / Save / Insert)

The `render()` method must be updated — currently appends `questionZone` first, then divider, then `previewZone`, then `outputToolbar`. Reorder to: `previewZone` → `questionZone` → `outputToolbar`. Remove the `root.createEl('hr', ...)` call.

**LAYOUT-03: Equal button sizes**
All three output buttons (Copy, Save, Insert) use `flex: 1`. Currently `.rp-copy-btn, .rp-save-btn` have `flex: 1` but `.rp-insert-btn` does not. Add `rp-insert-btn` to the existing CSS rule.

**LAYOUT-04: Remove node legend**
Delete the legend entirely — no replacement, no alternative. Remove the `renderLegend(root)` call at the bottom of `render()`. Remove the entire `renderLegend()` private method. Remove the associated CSS classes: `.rp-legend`, `.rp-legend-row`, `.rp-legend-swatch`.

**"Report preview" heading**
Remove the `<p>Report preview</p>` element above the textarea. Remove the `zone.createEl('p', { text: 'Report preview', ... })` line from `renderPreviewZone()`. Remove the `.rp-preview-heading` CSS class.

### Claude's Discretion
None defined — all implementation details are locked.

### Deferred Ideas (OUT OF SCOPE)
- "Run again" button after completion — Phase 13
- Canvas selector in sidebar — Phase 13
- Manual textarea edit preservation — Phase 16
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-01 | Protocol text area auto-grows in height as text accumulates (full width, height determined by content) | CSS `height: auto; overflow: hidden` + JS `scrollHeight` assignment after setting `.value` |
| LAYOUT-02 | Question and answer controls appear below the text area (never above or interleaved) | DOM order change in `render()`: create `previewZone` before `questionZone`; remove `<hr>` |
| LAYOUT-03 | Copy to clipboard, Save to note, and Insert into note buttons are equal in size | Add `.rp-insert-btn` to the existing `flex: 1` CSS rule alongside `.rp-copy-btn, .rp-save-btn` |
| LAYOUT-04 | Node type legend is removed from runner view (both tab and sidebar modes) | Delete `renderLegend()` call, method, and three CSS classes |
</phase_requirements>

---

## Summary

Phase 12 is a focused CSS and DOM-order surgery on a single file pair: `src/views/runner-view.ts` and `src/styles.css`. All four requirements have been analysed and locked in CONTEXT.md. No new libraries are needed. No architectural decisions are open.

The core work is four independent, non-overlapping changes: (1) swap the DOM creation order inside `render()` and remove the `<hr>`, (2) fix the textarea to size itself by content instead of flex-filling the container, (3) extend the flex-1 rule to the third button, and (4) delete the legend method and its CSS classes. The changes do not interact with each other and can be executed as a single plan.

The textarea auto-grow is the most nuanced change. The textarea is read-only from the user's perspective during protocol execution — text is set programmatically via `textarea.value`. The safe pattern is: apply `height: auto; overflow: hidden` in CSS (removing `flex: 1 1 auto` and `min-height`), then after setting `.value` in `renderPreviewZone()` assign `textarea.style.height = textarea.scrollHeight + 'px'`. This is the standard technique for programmatically-filled read-only textareas [ASSUMED — well-established browser behaviour, but scrollHeight timing is environment-specific; see Pitfall 1].

The `.rp-runner-view` container currently has `height: 100%` and uses flex-column. After the layout change the container should no longer force itself to fill the full panel height — it should grow with content. This requires removing `height: 100%` from `.rp-runner-view` (or replacing with `min-height: 100%` if we want padding at the bottom). The outer panel's scroll is handled by Obsidian's sidebar scroll container, not by our flex root.

**Primary recommendation:** Execute all four changes in a single plan wave: DOM reorder + `<hr>` removal, textarea CSS + JS resize, button rule extension, legend deletion.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Plugin source language | Already used throughout project [VERIFIED: package.json] |
| Obsidian API | 1.12.3 | `createEl`, `createDiv`, DOM helper | Project constraint — no innerHTML [VERIFIED: package.json, STATE.md] |
| CSS custom properties | — | Obsidian design tokens (`--size-*`, `--font-*`, etc.) | Already used throughout styles.css [VERIFIED: src/styles.css] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.2 | Unit test runner | Existing test suite; DOM tests via `RunnerView.test.ts` [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `scrollHeight` assignment | ResizeObserver / mutation observer | `scrollHeight` is simpler and sufficient for programmatic fills; observer adds complexity with no benefit here |
| `height: auto + scrollHeight` | `rows` attribute recalculation | `scrollHeight` approach is more reliable for multi-line content with custom line-height and padding |

**Installation:** No new packages required.

---

## Architecture Patterns

### Affected Files
```
src/
├── views/runner-view.ts    # DOM order, textarea resize, legend deletion
└── styles.css              # CSS layout changes
src/__tests__/
└── RunnerView.test.ts      # Existing test file — extend with layout assertions
```

### Pattern 1: Textarea Auto-Grow (programmatic fill)
**What:** After setting `textarea.value`, force the element to report its natural content height via `scrollHeight`, then assign that as an explicit pixel height.
**When to use:** Read-only textareas whose content is set by code, not user typing.
**Implementation:**
```typescript
// In renderPreviewZone() — after textarea.value = text
textarea.style.height = 'auto';           // collapse to allow shrink
textarea.style.height = textarea.scrollHeight + 'px'; // expand to fit content
```
Combined with CSS:
```css
.rp-preview-textarea {
  /* Remove: flex: 1 1 auto; min-height: 80px; */
  width: 100%;
  resize: none;
  overflow: hidden;
  height: auto;
  /* keep font, padding, border, box-sizing */
}
```
**Source:** [ASSUMED — standard browser technique; scrollHeight is synchronous after value assignment in DOM environments]

### Pattern 2: DOM Order Change
**What:** In `render()`, create zones in the correct order so visual stacking matches DOM order (no CSS `order` tricks needed).
**Current order:** `questionZone` → `hr` → `previewZone` → `outputToolbar`
**Target order:** `previewZone` → `questionZone` → `outputToolbar`

```typescript
// render() after change:
const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
const previewZone = root.createDiv({ cls: 'rp-preview-zone' });   // FIRST
const questionZone = root.createDiv({ cls: 'rp-question-zone' }); // SECOND
const outputToolbar = root.createDiv({ cls: 'rp-output-toolbar' });// THIRD
// NO hr.createEl call
```
[VERIFIED: src/views/runner-view.ts lines 244-248 show current (wrong) order]

### Pattern 3: Equal-Width Flex Buttons
**What:** Extend the existing `flex: 1` rule to include `.rp-insert-btn`.
**Current CSS (lines 61-64):**
```css
.rp-copy-btn,
.rp-save-btn {
  flex: 1;
}
```
**Target CSS:**
```css
.rp-copy-btn,
.rp-save-btn,
.rp-insert-btn {
  flex: 1;
}
```
[VERIFIED: src/styles.css lines 61-64]

### Pattern 4: Legend Deletion
**What:** Remove method, call site, and CSS classes entirely.
**Deletions in runner-view.ts:**
- Line 421: `this.renderLegend(root);`
- Lines 588–603: entire `renderLegend()` method

**Deletions in styles.css:**
- Lines 66–88: `.rp-legend`, `.rp-legend-row`, `.rp-legend-swatch` blocks
[VERIFIED: src/views/runner-view.ts lines 421, 588-603; src/styles.css lines 66-88]

### Container Layout Fix
**What:** `.rp-runner-view` currently sets `height: 100%` to fill the panel. After the textarea switches to auto-grow, this constraint fights content-driven sizing. The container should be changed to `min-height: 100%` so it still fills short content areas but can grow beyond the viewport for long protocols.

```css
.rp-runner-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;        /* was: height: 100% */
  padding: var(--size-4-2);
  box-sizing: border-box;
  gap: var(--size-4-2);    /* add gap between zones (replaces hr spacing) */
}
```

**Also update `.rp-preview-zone`:** Remove `flex: 1 1 auto` and `min-height: 0` since it no longer needs to fill remaining flex space.

```css
.rp-preview-zone {
  /* Remove: flex: 1 1 auto; min-height: 0; */
  display: flex;
  flex-direction: column;
  gap: var(--size-2-1);
}
```
[VERIFIED: src/styles.css lines 3-9 and 25-31 show current values to change]

### Anti-Patterns to Avoid
- **Using `max-height` on the textarea:** Locked decision explicitly forbids this. The panel scrolls, not the textarea.
- **Using CSS `order` property to reorder zones:** Change DOM creation order directly instead — simpler and correct.
- **Keeping `flex: 1 1 auto` on `.rp-preview-zone`:** With auto-grow textarea, the zone no longer needs to flex-fill. Leaving it causes height to be constrained by the container rather than content.
- **Calling `textarea.style.height = textarea.scrollHeight + 'px'` before setting `.value`:** Must set value first, then assign height. Always do `height = 'auto'` before `height = scrollHeight + 'px'` to allow shrinking when text decreases.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Textarea auto-grow | Custom resize observer or polling loop | `scrollHeight` assignment after value set | scrollHeight is synchronous, no observer needed for programmatic fills |
| Equal button widths | JavaScript width calculation | `flex: 1` CSS | Pure CSS, no JS needed |

---

## Common Pitfalls

### Pitfall 1: `scrollHeight` Returns 0 or Incorrect Value in Test Environment
**What goes wrong:** In jsdom (the vitest test environment), `scrollHeight` is always 0 because jsdom does not perform layout calculations. Assertions on `textarea.style.height` will fail if they check for a pixel value derived from `scrollHeight`.
**Why it happens:** jsdom has no layout engine.
**How to avoid:** In unit tests, assert that the textarea has `overflow: hidden` and that the resize call was made (by checking `style.height !== ''`), not that it equals a specific pixel value. Alternatively, test the behavior at the integration/UAT level. The existing `RunnerView.test.ts` tests are all structural (method existence) — extend with the same style of structural check.
**Warning signs:** Test assertion `expect(textarea.style.height).toBe('120px')` — will always fail in jsdom.

### Pitfall 2: `height: 100%` on Container Traps Textarea
**What goes wrong:** Leaving `height: 100%` on `.rp-runner-view` while the textarea is `height: auto` creates a flex container with a fixed height. The textarea auto-sizes to scrollHeight but the container is capped — the panel does not scroll and content clips.
**Why it happens:** `height: 100%` resolves to the viewport height of the pane. Flex children cannot overflow the explicit height of the flex parent unless the parent itself can grow.
**How to avoid:** Change `.rp-runner-view` from `height: 100%` to `min-height: 100%`.
**Warning signs:** Textarea appears to auto-grow in dev tools inspector but the panel does not scroll.

### Pitfall 3: `overflow-y: auto` on `.rp-question-zone` Clips Growing Content
**What goes wrong:** `.rp-question-zone` currently has `overflow-y: auto`. If the question zone's content (many answer buttons) grows taller than the available space, it clips and scrolls internally rather than pushing the rest of the layout down.
**Why it happens:** The zone was designed to scroll when inside a fixed-height flex layout. After the layout change to content-driven height, the zone should grow naturally.
**How to avoid:** Remove `overflow-y: auto` from `.rp-question-zone`. The outer panel handles scrolling.
**Warning signs:** Long answer lists scroll inside a small box instead of growing the panel.

### Pitfall 4: DOM Variable Order Mismatch After Reorder
**What goes wrong:** In `render()`, `questionZone` is currently created first (line 245) and its variable is used throughout the switch statement. If the developer reorders the `createDiv` calls but forgets the variable names map to the new zones, bugs arise silently (e.g., controls rendered into the wrong zone).
**Why it happens:** Variable name `questionZone` is bound to a DOM element at creation time — changing creation order does not change variable names.
**How to avoid:** Move `const previewZone = root.createDiv(...)` to line 245 and `const questionZone = root.createDiv(...)` to line 246. The variable names remain correct — only the creation (and therefore DOM insertion) order changes.
**Warning signs:** Question controls appear in the textarea zone visually.

### Pitfall 5: `resize: none` Missing Causes Browser Drag Handle
**What goes wrong:** The current CSS includes `resize: none` on `.rp-preview-textarea`. If that line is accidentally removed during the edit, browsers show a resize drag handle in the bottom-right corner of the textarea, which conflicts with the auto-grow behavior.
**Why it happens:** `resize: none` suppresses the native drag handle. The CONTEXT.md note says "No `resize: none` override needed since it will auto-size" — this is about not needing a separate override for the resize direction, but `resize: none` should be kept to prevent the drag handle.
**How to avoid:** Keep `resize: none` in `.rp-preview-textarea`. Only remove `flex: 1 1 auto` and `min-height: 80px`.

---

## Code Examples

Verified from existing source:

### Current `render()` zone creation (lines 244–248) — to be changed
```typescript
// Source: src/views/runner-view.ts lines 244-248
const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
const questionZone = root.createDiv({ cls: 'rp-question-zone' });
root.createEl('hr', { cls: 'rp-zone-divider' });
const previewZone = root.createDiv({ cls: 'rp-preview-zone' });
const outputToolbar = root.createDiv({ cls: 'rp-output-toolbar' });
```

### Current `renderPreviewZone()` — to be changed
```typescript
// Source: src/views/runner-view.ts lines 492-497
private renderPreviewZone(zone: HTMLElement, text: string): void {
  zone.createEl('p', { text: 'Report preview', cls: 'rp-preview-heading' });
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  this.previewTextarea = textarea;
}
```

### Target `renderPreviewZone()` — after change
```typescript
private renderPreviewZone(zone: HTMLElement, text: string): void {
  // 'Report preview' heading removed (locked decision)
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  // Auto-grow: collapse then expand to content height
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  this.previewTextarea = textarea;
}
```

### Current `.rp-preview-textarea` CSS (lines 39–52) — to be changed
```css
/* Source: src/styles.css lines 39-52 */
.rp-preview-textarea {
  flex: 1 1 auto;        /* REMOVE */
  width: 100%;
  resize: none;
  font-family: var(--font-monospace);
  font-size: var(--font-text-size);
  font-weight: var(--font-normal);
  line-height: 1.5;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  padding: var(--size-4-2);
  box-sizing: border-box;
  min-height: 80px;      /* REMOVE */
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed flex-fill textarea | Content-driven auto-grow textarea | Phase 12 | Textarea no longer clips long protocols |
| questionZone above textarea | previewZone above questionZone | Phase 12 | Controls always below output |
| Only Copy+Save flex:1 | Copy+Save+Insert all flex:1 | Phase 12 | Visual parity across action buttons |
| Legend visible in runner | Legend removed | Phase 12 | Cleaner UI, less visual noise |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `scrollHeight` assignment after `textarea.value = text` correctly sizes the textarea in Obsidian's Electron/Chromium environment | Pattern 1, Pitfall 1 | Textarea may not grow; fallback is using a hidden mirror div |
| A2 | Obsidian sidebar panels allow their content to scroll when `overflow-y` is unset on the content container | Summary, Pitfall 2 | Panel may not scroll; would require explicit `overflow-y: auto` on outer wrapper |

**Both assumptions are standard browser/Electron behavior with high confidence — tagged ASSUMED because not verified in Obsidian's specific Electron build this session.**

---

## Open Questions

1. **Does the Obsidian sidebar panel scroll automatically when content height exceeds the pane height?**
   - What we know: STATE.md notes that the canvas selector is rendered in `headerEl` not `contentEl` specifically because of rendering constraints. The Obsidian API docs do not explicitly describe sidebar scroll behavior.
   - What's unclear: Whether `contentEl` inside a sidebar leaf gets `overflow-y: auto` automatically from Obsidian's shell CSS, or whether we need to add it explicitly.
   - Recommendation: UAT step — open as sidebar, run a long protocol, verify panel scrolls. If it doesn't, add `overflow-y: auto` to `.rp-runner-view` or its parent.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is pure CSS and TypeScript DOM changes within the existing plugin project).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | `renderPreviewZone()` sets `textarea.style.height` (not empty) after value assignment | unit | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) |
| LAYOUT-02 | `render()` creates previewZone before questionZone in DOM | unit | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) |
| LAYOUT-03 | `.rp-insert-btn` class is in the flex:1 CSS rule | unit / manual | manual CSS inspection | ✅ `src/styles.css` (no separate test needed — change is trivial) |
| LAYOUT-04 | `renderLegend` method does not exist on RunnerView prototype | unit | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) |

**Note on testability:** The existing `RunnerView.test.ts` constructs `RunnerView` without instantiation (checks prototype methods). New tests for LAYOUT-01 and LAYOUT-02 would require a DOM environment. Since vitest runs in `node` environment (not `jsdom`), DOM-dependent tests require `// @vitest-environment jsdom` annotation or are better validated via UAT. The structural checks (method absent, DOM order) can be done with jsdom.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (including no regressions) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `src/__tests__/RunnerView.test.ts` with LAYOUT assertions — add `@vitest-environment jsdom` block for DOM checks

*(Existing test infrastructure covers the framework; only test additions needed, no new files required)*

---

## Security Domain

This phase makes no changes to data handling, authentication, input validation, vault I/O, or network calls. It is a pure DOM layout and CSS change. ASVS categories V2, V3, V4, V6 do not apply. V5 (input validation) is not affected — the textarea is read-only and no user input flows through this change.

Security domain: **NOT APPLICABLE** to this phase.

---

## Sources

### Primary (HIGH confidence)
- `src/views/runner-view.ts` — full source read; all line number references verified in session
- `src/styles.css` — full source read; all CSS rule references verified in session
- `.planning/phases/12-runner-layout-overhaul/12-CONTEXT.md` — locked decisions
- `package.json` — verified dependency versions
- `vitest.config.ts` — verified test configuration
- `src/__tests__/RunnerView.test.ts` — verified existing test structure

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — requirement definitions for LAYOUT-01 through LAYOUT-04
- `.planning/STATE.md` — critical pitfalls and accumulated project context

### Tertiary (LOW confidence / ASSUMED)
- A1: `scrollHeight` auto-grow behavior in Electron/Chromium — standard technique, not verified against Obsidian's specific Electron build
- A2: Obsidian sidebar panel scroll behavior — assumed from plugin ecosystem knowledge

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing project files verified directly
- Architecture: HIGH — all change sites identified with exact line numbers from verified source
- Pitfalls: MEDIUM — pitfalls 1–4 derived from verified source analysis; pitfall 5 from ASSUMED browser behavior
- Test strategy: MEDIUM — framework verified; jsdom requirement for DOM tests is ASSUMED standard

**Research date:** 2026-04-08
**Valid until:** Stable — CSS and DOM patterns do not change; review only if Obsidian API version bumps past 1.12.x
