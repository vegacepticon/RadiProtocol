# Phase 18: CSS Gap Fixes - Research

**Researched:** 2026-04-10
**Domain:** CSS / Obsidian plugin styles.css
**Confidence:** HIGH

---

## Summary

Phase 18 closes three concrete CSS gaps identified by the v1.2 milestone audit. All three gaps are omissions: runtime code already emits the CSS class names, but `styles.css` has no matching rules. The widgets are functional but render unstyled or with incorrect proportions.

The fix scope is pure CSS additions to `src/styles.css`. No TypeScript changes are needed. The three gaps are independent and can be addressed in a single plan with one commit.

The existing style patterns in `src/styles.css` are consistent and established: Obsidian CSS variables (`--size-*`, `--background-*`, `--font-*`, `--radius-s`) throughout, flex layout for toolbars and rows, and a phase-comment section header for each feature area. New rules should follow the same conventions.

**Primary recommendation:** Add three CSS blocks to `src/styles.css` — `.rp-insert-btn { flex: 1 }`, a full selector-bar layout block, and an `.rp-run-again-btn` rule — using the same variable conventions as the existing file.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-03 | Copy/Save/Insert buttons equal in size | `.rp-insert-btn` is already emitted at runner-view.ts:568 but has no flex rule; adding `flex: 1` to the existing `.rp-copy-btn, .rp-save-btn` selector group (or as a separate rule) closes the gap [VERIFIED: codebase] |
| SIDEBAR-01 | Canvas selector in sidebar mode visually styled | `rp-selector-bar`, `rp-selector-wrapper`, `rp-selector-trigger`, `rp-selector-popover`, `rp-selector-row` are all emitted by canvas-selector-widget.ts but absent from styles.css [VERIFIED: codebase] |
| RUNNER-01 | "Run Again" button after completion styled | `rp-run-again-btn` is emitted at runner-view.ts:438 inside the `complete` branch but has no CSS rule [VERIFIED: codebase] |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Plain CSS | N/A | styles.css — already the project's single stylesheet | Project constraint: zero framework overhead; community review forbids PostCSS or preprocessors |
| Obsidian CSS variables | N/A (host-provided) | Theming tokens (`--size-*`, `--background-*`, `--font-*`, `--radius-s`) | Required for theme compatibility; all existing rules use them [VERIFIED: codebase] |

### No npm installs needed
This phase is a pure CSS edit. No new packages.

---

## Architecture Patterns

### Existing File Layout (src/styles.css)

```
/* Phase 3: RunnerView ──── */
  .rp-runner-view
  .rp-question-zone
  .rp-preview-zone / .rp-preview-textarea
  .rp-output-toolbar
  .rp-copy-btn, .rp-save-btn    ← LAYOUT-03: .rp-insert-btn missing here
  .rp-legend (dead CSS — do not remove, low priority)
  .rp-question-text / .rp-answer-btn / .rp-free-text-input
  .rp-step-back-btn
  .rp-complete-heading          ← RUNNER-01: .rp-run-again-btn goes after this

/* Phase 4: EditorPanelView ── */
/* Phase 5: SnippetManagerView / SnippetFillInModal ── */
/* Phase 6: Loop Support ──── */
```

New rules should be inserted into Phase 3's RunnerView section, with a new `/* Phase 13: CanvasSelectorWidget ── */` comment block added before the Phase 4 comment for the selector rules.

### Pattern 1: Equal-width toolbar buttons (LAYOUT-03)

**What:** The output toolbar uses `display: flex; flex-direction: row` (`.rp-output-toolbar`, line 54–59). Copy and Save already have `flex: 1` (lines 61–64). Insert needs the same.

**Fix options:**
- Option A (minimal): extend the existing selector to a three-selector group
- Option B (separate rule): add `.rp-insert-btn { flex: 1; }` as its own rule immediately below

Both are valid. Option A is cleaner (single declaration for all three).

**Preferred:**
```css
/* Source: src/styles.css lines 61–64 — extend existing selector */
.rp-copy-btn,
.rp-save-btn,
.rp-insert-btn {
  flex: 1;
}
```

### Pattern 2: CanvasSelectorWidget layout (SIDEBAR-01)

**What:** The widget structure (from canvas-selector-widget.ts) is:

```
div.rp-selector-bar          ← outermost, injected into contentEl
  div.rp-selector-wrapper    ← wraps trigger + popover
    button.rp-selector-trigger
      span.rp-selector-trigger-label
      span.rp-selector-chevron   (setIcon: 'chevron-down')
    div.rp-selector-popover  ← absolutely positioned dropdown
      div.rp-selector-row rp-selector-back-row   (conditionally)
      div.rp-selector-row rp-selector-folder-row
      div.rp-selector-row rp-selector-file-row
        span.rp-selector-row-icon
        span.rp-selector-row-label
        span.rp-selector-row-arrow   (folders only)
      div.rp-selector-empty-hint
      div.rp-selector-row.is-selected
```

**Required CSS rules (audit specified):** `rp-selector-bar`, `rp-selector-wrapper`, `rp-selector-trigger`, `rp-selector-popover`, `rp-selector-row`

**Recommended block:**
```css
/* Phase 13: CanvasSelectorWidget ─────────────────────────────────────────── */

.rp-selector-bar {
  flex: 0 0 auto;
  padding: var(--size-2-1) var(--size-4-2);
  border-bottom: 1px solid var(--background-modifier-border);
}

.rp-selector-wrapper {
  position: relative;
  width: 100%;
}

.rp-selector-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--size-2-1);
  padding: var(--size-2-1) var(--size-4-1);
  font-size: var(--font-text-size);
  text-align: left;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  cursor: pointer;
}

.rp-selector-trigger:hover {
  background: var(--background-modifier-hover);
}

.rp-selector-trigger-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-selector-placeholder {
  color: var(--text-muted);
}

.rp-selector-chevron {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.rp-selector-popover {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  box-shadow: var(--shadow-s);
  max-height: 240px;
  overflow-y: auto;
  margin-top: 2px;
}

.rp-selector-row {
  display: flex;
  align-items: center;
  gap: var(--size-2-1);
  padding: var(--size-2-1) var(--size-4-1);
  min-height: 32px;
  cursor: pointer;
  font-size: var(--font-text-size);
}

.rp-selector-row:hover {
  background: var(--background-modifier-hover);
}

.rp-selector-row.is-selected {
  background: var(--background-modifier-active-hover);
  font-weight: var(--font-semibold);
}

.rp-selector-row-icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  color: var(--text-muted);
}

.rp-selector-row-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-selector-row-arrow {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  color: var(--text-muted);
}

.rp-selector-empty-hint {
  padding: var(--size-4-1) var(--size-4-2);
  color: var(--text-muted);
  font-size: var(--font-text-size);
  font-style: italic;
}
```

### Pattern 3: Run Again button (RUNNER-01)

**What:** `rp-run-again-btn` is rendered in the `complete` state at runner-view.ts:437–452, immediately after the "Protocol complete" heading. The existing loop-again-btn (`.rp-loop-again-btn`) uses accent color styling and is a close stylistic parallel. The run-again button should be similarly prominent.

**Recommended:**
```css
/* Add after .rp-complete-heading in the Phase 3 section */

.rp-run-again-btn {
  margin-top: var(--size-4-1);
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: var(--radius-s);
  padding: var(--size-2-2) var(--size-4-2);
  cursor: pointer;
  font-size: var(--font-ui-small);
  width: 100%;
}

.rp-run-again-btn:hover {
  background: var(--interactive-accent-hover);
}

.rp-run-again-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Note: `runner-view.ts:441` sets `runAgainBtn.disabled = true` when `canvasFilePath === null`. The `:disabled` rule above handles that case gracefully.

### Anti-Patterns to Avoid

- **Hard-coded colours (`#hex`, `rgb()`):** All existing rules use Obsidian variables. Hardcoding colours breaks theme compatibility and will fail community review [VERIFIED: STATE.md critical pitfalls].
- **`innerHTML`:** The critical pitfalls list explicitly forbids `innerHTML`. This phase is CSS-only so no DOM risk, but note for general awareness.
- **Modifying TS files:** The three gaps are pure CSS omissions — no TypeScript changes are needed or appropriate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover z-index management | Custom JS overlay manager | CSS `position: absolute` + `z-index: 100` on `.rp-selector-popover` | The widget already wires outside-click-close in JS; CSS just needs the stacking context [VERIFIED: canvas-selector-widget.ts] |
| Theme-compatible colours | Hard-coded colours | Obsidian CSS variables (`--interactive-accent`, `--background-modifier-hover`, etc.) | Required for dark/light/custom theme support; already the project pattern |

---

## Common Pitfalls

### Pitfall 1: Modifying `styles.css` at root instead of `src/styles.css`
**What goes wrong:** The project root has `styles.css` (currently single-comment placeholder) but the real stylesheet consumed by the build is `src/styles.css`.
**Why it happens:** Both files exist; root `styles.css` is the Obsidian plugin manifest output.
**How to avoid:** Edit `src/styles.css` only — that is the source file. The build (esbuild.config.mjs) copies it.
**Warning signs:** Changes don't appear in the built `main.js`; styles.css at root still reads as a one-liner.

**Evidence:** [VERIFIED: codebase] — `styles.css` at root has 1 line; `src/styles.css` has 492 lines of actual rules.

### Pitfall 2: Forgetting the `rp-selector-bar` padding
**What goes wrong:** The selector bar renders flush against the view edges (no breathing room).
**Why it happens:** `rp-runner-view` uses `padding: var(--size-4-2)` on its content, but the selector bar is injected into `contentEl` directly (before `rp-runner-view`), bypassing that padding.
**How to avoid:** Add `padding: var(--size-2-1) var(--size-4-2)` to `.rp-selector-bar`.

**Evidence:** [VERIFIED: runner-view.ts lines 158, 294] — selectorBarEl is prepended to contentEl, not inside rp-runner-view.

### Pitfall 3: Missing `:disabled` state on `rp-run-again-btn`
**What goes wrong:** When no canvas is loaded, the Run Again button is disabled (runner-view.ts:441) but without a CSS rule it looks identical to an enabled button — confusing UX.
**How to avoid:** Include `.rp-run-again-btn:disabled { opacity: 0.5; cursor: not-allowed; }`.

### Pitfall 4: Extending the wrong selector group for LAYOUT-03
**What goes wrong:** Adding `.rp-insert-btn` to the selector at lines 61–64 but missing that `.rp-copy-btn, .rp-save-btn { flex: 1; }` already closes for the full width split. Only adding it separately works too, but the existing two-selector group should become three-selector for consistency.
**How to avoid:** Verify the final `.rp-output-toolbar` has `display: flex` (line 54) — it does. Confirm all three buttons get `flex: 1`.

---

## Code Examples

### Current gap (LAYOUT-03) — verified codebase state
```css
/* src/styles.css lines 61–64 — CURRENT (missing rp-insert-btn) */
.rp-copy-btn,
.rp-save-btn {
  flex: 1;
}
```

```typescript
// src/views/runner-view.ts lines 560–570 — all three buttons emitted
const copyBtn = toolbar.createEl('button', { cls: 'rp-copy-btn', text: 'Copy to clipboard' });
const saveBtn = toolbar.createEl('button', { cls: 'rp-save-btn', text: 'Save to note' });
const insertBtn = toolbar.createEl('button', { cls: 'rp-insert-btn', text: 'Insert into note' });
```

### Current gap (RUNNER-01) — verified codebase state
```typescript
// src/views/runner-view.ts lines 436–452 — emitted but unstyled
const runAgainBtn = questionZone.createEl('button', {
  cls: 'rp-run-again-btn',
  text: 'Run again',
});
if (this.canvasFilePath === null) {
  runAgainBtn.disabled = true;
}
```

### Current gap (SIDEBAR-01) — verified class inventory
All of the following are emitted by `canvas-selector-widget.ts` with no corresponding CSS rules:
- `rp-selector-bar` (runner-view.ts:158)
- `rp-selector-wrapper` (canvas-selector-widget.ts:53)
- `rp-selector-trigger` (canvas-selector-widget.ts:55)
- `rp-selector-trigger-label` (canvas-selector-widget.ts:70)
- `rp-selector-placeholder` (canvas-selector-widget.ts:78)
- `rp-selector-chevron` (canvas-selector-widget.ts:80)
- `rp-selector-popover` (canvas-selector-widget.ts:86)
- `rp-selector-row` (canvas-selector-widget.ts:146, 172, 187)
- `rp-selector-row-icon`, `rp-selector-row-label`, `rp-selector-row-arrow`
- `rp-selector-empty-hint`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No selector-bar CSS | Selector renders unstyled (functional) | Milestone audit 2026-04-10 identified gap | Phase 18 adds the missing rules |
| Insert button narrower than Copy/Save | All three buttons equal width | Phase 12 coded buttons, forgot CSS | Phase 18 adds flex: 1 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/styles.css` is the source stylesheet used by the build; the root `styles.css` is the build output copy | Pitfall 1, Standard Stack | If wrong, edits to `src/styles.css` would not be picked up — but esbuild.config.mjs can be checked to confirm before commit |
| A2 | No existing CSS outside `src/styles.css` provides partial rules for the gap classes (e.g., in a theme or snippet) | Standard Stack | Possible a user theme provides defaults, but the audit showed unstyled rendering, so no theme override is present in test conditions |

---

## Open Questions

1. **Exact `rp-selector-bar` height / padding preference**
   - What we know: The bar sits above `rp-runner-view` inside `contentEl`; `rp-runner-view` has `padding: var(--size-4-2)` (16px).
   - What's unclear: Whether a border-bottom separator is desired or purely padding-based separation.
   - Recommendation: Add `border-bottom: 1px solid var(--background-modifier-border)` for visual separation — consistent with how Obsidian sidebar panels separate header from content. Planner can adjust if user prefers no divider.

2. **`rp-selector-bar` in the runner-view flex column**
   - What we know: `rp-runner-view` is a flex-column and is created *after* `selectorBarEl` is prepended (i.e., selectorBarEl is a sibling above rp-runner-view inside contentEl, not a child of it).
   - What's unclear: Whether contentEl needs a flex-column declaration so selectorBarEl and rp-runner-view stack correctly.
   - Recommendation: Check contentEl's computed layout. If contentEl already flows block-direction, no change needed. If not, `.rp-selector-bar` with `display: block` (default) and `width: 100%` should stack naturally above the flex runner-view div. This is low risk — Obsidian leaf content areas are block-level containers.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is a pure CSS file edit with no build step changes, CLI tools, or services).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-03 | `.rp-insert-btn` has `flex: 1` rule in styles.css | manual visual / grep assertion | `grep -n "rp-insert-btn" src/styles.css` | N/A — CSS, not unit-testable |
| SIDEBAR-01 | `rp-selector-bar`, `rp-selector-wrapper`, `rp-selector-trigger`, `rp-selector-popover`, `rp-selector-row` rules present | manual visual / grep assertion | `grep -n "rp-selector" src/styles.css` | N/A — CSS, not unit-testable |
| RUNNER-01 | `rp-run-again-btn` rule present | manual visual / grep assertion | `grep -n "rp-run-again-btn" src/styles.css` | N/A — CSS, not unit-testable |

**Note:** CSS rules are not unit-tested by Vitest (Vitest tests pure TypeScript engine modules). Verification for this phase is:
1. `grep` assertions confirm rule presence (automated, quick)
2. Visual UAT in Obsidian developer mode confirms rendering (manual, required for acceptance)

The existing Vitest suite (`npm test`) should continue passing unchanged since no TypeScript is modified.

### Sampling Rate

- **Per task commit:** `npm test` (confirms no TypeScript regressions)
- **Per wave merge:** `npm test`
- **Phase gate:** Vitest green + visual UAT confirming all three CSS gaps closed

### Wave 0 Gaps

None — no new test files needed. Verification is grep-based + visual UAT.

---

## Security Domain

This phase modifies only `src/styles.css`. No DOM manipulation, no data processing, no authentication, no input handling, no cryptography. ASVS categories V2–V6 do not apply.

No security controls are required for a CSS-only change.

---

## Sources

### Primary (HIGH confidence)
- `src/styles.css` — full file read; confirmed existing rule patterns, confirmed absence of `rp-insert-btn`, `rp-selector-*`, `rp-run-again-btn` [VERIFIED: codebase]
- `src/views/runner-view.ts` — confirmed class names emitted at lines 158, 438, 560–568 [VERIFIED: codebase]
- `src/views/canvas-selector-widget.ts` — full file read; confirmed all `rp-selector-*` class names emitted [VERIFIED: codebase]
- `.planning/v1.2-MILESTONE-AUDIT.md` — audit findings, exact CSS gaps described [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `package.json`, `vitest.config.ts` — confirmed test setup, framework version [VERIFIED: codebase]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure CSS edit, no library choices needed
- Architecture: HIGH — CSS class inventory verified against actual source code; patterns taken from existing styles.css conventions
- Pitfalls: HIGH — root vs. src/styles.css gap verified by reading both files; disabled state verified from runner-view.ts source

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable — no external dependencies; only risk is if styles.css is modified by another phase before Phase 18 executes)
