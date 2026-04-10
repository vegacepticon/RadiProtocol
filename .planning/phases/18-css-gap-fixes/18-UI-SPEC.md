---
phase: 18
phase_name: css-gap-fixes
status: approved
reviewed_at: "2026-04-10"
design_system: obsidian-css-variables
tool: none
created: "2026-04-10"
---

# UI-SPEC — Phase 18: CSS Gap Fixes

## Overview

Phase 18 closes three CSS omissions identified by the v1.2 milestone audit. No new UI
surfaces are introduced. The existing TypeScript already emits the correct class names —
these gaps are purely missing rules in `src/styles.css`.

**Scope:** Three targeted CSS additions to `src/styles.css`:
1. **LAYOUT-03** — extend the flex-button group to include `.rp-insert-btn`
2. **SIDEBAR-01** — add full `rp-selector-*` block for the canvas selector widget
3. **RUNNER-01** — add `.rp-run-again-btn` styled after the completion state

No TypeScript changes. No new modals, panels, or layout regions.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | None |
| Preset | Not applicable |
| Component library | Plain DOM API (Obsidian `createEl`, `createDiv`) |
| Icon library | Obsidian built-in (`setIcon`) |
| Font | Inherited from Obsidian host theme |

**Styling approach:** Obsidian CSS variables exclusively. Hard-coded hex/rgb values are
forbidden — community review requirement already established in STATE.md.

---

## Spacing Scale

All values use existing Obsidian tokens. No new spacing values are introduced.

| Token | Value | Usage in Phase 18 |
|-------|-------|-------------------|
| `var(--size-2-1)` | 4px | `rp-selector-bar` vertical padding, `rp-selector-trigger` gap, `rp-selector-row` gap and padding |
| `var(--size-4-1)` | 8px | `rp-run-again-btn` margin-top, `rp-selector-bar` horizontal padding, `rp-selector-trigger` horizontal padding, `rp-selector-row` horizontal padding |
| `var(--size-4-2)` | 16px | `rp-run-again-btn` horizontal padding, `rp-selector-bar` horizontal outer padding, `rp-selector-empty-hint` padding |
| `var(--size-2-2)` | 4px | `rp-run-again-btn` vertical padding |

Exceptions: `margin-top: 2px` on `.rp-selector-popover` (sub-grid gap for tight
popover alignment — not a spacing token, intentional micro-adjustment).

---

## Typography

No new typography values. All sizes and weights are inherited from established patterns.

| Role | Token | Effective value | Weight |
|------|-------|----------------|--------|
| Selector trigger label | `var(--font-text-size)` | 14px | `var(--font-normal)` = 400 |
| Selector row label | `var(--font-text-size)` | 14px | `var(--font-normal)` = 400 |
| Selector empty hint | `var(--font-text-size)` | 14px | `var(--font-normal)` = 400, italic |
| Selector selected row | `var(--font-text-size)` | 14px | `var(--font-semibold)` = 600 |
| Run again button | `var(--font-ui-small)` | ~12px | `var(--font-normal)` = 400 |

---

## Color

60 / 30 / 10 split — same semantic tokens as all prior phases.

| Role | Token | Phase 18 usage |
|------|-------|---------------|
| Dominant surface (60%) | `var(--background-primary)` | `rp-selector-popover` background |
| Secondary surface (30%) | `var(--background-secondary)` | `rp-selector-trigger` default background |
| Hover surface | `var(--background-modifier-hover)` | `rp-selector-trigger:hover`, `rp-selector-row:hover` |
| Active surface | `var(--background-modifier-active-hover)` | `rp-selector-row.is-selected` background |
| Border | `var(--background-modifier-border)` | `rp-selector-bar` border-bottom, `rp-selector-trigger` border, `rp-selector-popover` border |
| Accent (10%) | `var(--interactive-accent)` | `rp-run-again-btn` background |
| Accent hover | `var(--interactive-accent-hover)` | `rp-run-again-btn:hover` background |
| Accent text | `var(--text-on-accent)` | `rp-run-again-btn` text color |
| Muted text | `var(--text-muted)` | `rp-selector-row-icon`, `rp-selector-row-arrow`, `rp-selector-empty-hint` |
| Destructive | N/A | No destructive actions in this phase |
| Shadow | `var(--shadow-s)` | `rp-selector-popover` box-shadow |

**Accent reserved for:** `rp-run-again-btn` exclusively. The canvas selector trigger
and rows use secondary and hover backgrounds — no accent treatment.

---

## Component Inventory

### LAYOUT-03 — Insert Button Equal Width

**Change:** Extend the existing two-selector group at `src/styles.css` lines 61–64 to
a three-selector group.

**Before:**
```css
.rp-copy-btn,
.rp-save-btn {
  flex: 1;
}
```

**After:**
```css
.rp-copy-btn,
.rp-save-btn,
.rp-insert-btn {
  flex: 1;
}
```

**Visual contract:** All three buttons in `.rp-output-toolbar` render at equal width.
Parent toolbar has `display: flex; flex-direction: row` — adding `flex: 1` to
`.rp-insert-btn` makes all three buttons share the available width equally.

**States:** No hover, focus, or disabled states are needed — Copy, Save, and Insert
already inherit Obsidian's default button styles. Only the flex sizing is missing.

---

### SIDEBAR-01 — Canvas Selector Widget

**New CSS block** inserted as a new section before the Phase 4 comment in
`src/styles.css`. Section header: `/* Phase 13: CanvasSelectorWidget ── */`

**DOM structure (from canvas-selector-widget.ts):**
```
div.rp-selector-bar            ← injected into contentEl, above rp-runner-view
  div.rp-selector-wrapper
    button.rp-selector-trigger
      span.rp-selector-trigger-label
      span.rp-selector-chevron    (setIcon: chevron-down)
    div.rp-selector-popover       ← absolute dropdown
      div.rp-selector-row rp-selector-back-row
      div.rp-selector-row rp-selector-folder-row
        span.rp-selector-row-icon
        span.rp-selector-row-label
        span.rp-selector-row-arrow
      div.rp-selector-row rp-selector-file-row
        span.rp-selector-row-icon
        span.rp-selector-row-label
      div.rp-selector-empty-hint
      div.rp-selector-row.is-selected
```

**Visual contracts per selector:**

| Selector | Contract |
|----------|----------|
| `.rp-selector-bar` | `flex: 0 0 auto`, padding 4px 16px, border-bottom 1px solid border |
| `.rp-selector-wrapper` | `position: relative`, `width: 100%` |
| `.rp-selector-trigger` | Full width, flex row, space-between, gap 4px, padding 4px 8px, font-text-size, background-secondary, border, radius-s, cursor pointer |
| `.rp-selector-trigger:hover` | background-modifier-hover |
| `.rp-selector-trigger-label` | `flex: 1 1 auto`, overflow hidden, text-overflow ellipsis, white-space nowrap |
| `.rp-selector-placeholder` | color text-muted |
| `.rp-selector-chevron` | `flex: 0 0 auto`, flex center |
| `.rp-selector-popover` | `position: absolute`, top 100%, left/right 0, z-index 100, background-primary, border, radius-s, shadow-s, max-height 240px, overflow-y auto, margin-top 2px |
| `.rp-selector-row` | flex row, gap 4px, padding 4px 8px, min-height 32px, cursor pointer, font-text-size |
| `.rp-selector-row:hover` | background-modifier-hover |
| `.rp-selector-row.is-selected` | background-modifier-active-hover, font-semibold |
| `.rp-selector-row-icon` | `flex: 0 0 auto`, flex center, color text-muted |
| `.rp-selector-row-label` | `flex: 1 1 auto`, overflow hidden, text-overflow ellipsis, white-space nowrap |
| `.rp-selector-row-arrow` | `flex: 0 0 auto`, flex center, color text-muted |
| `.rp-selector-empty-hint` | padding 8px 16px, color text-muted, font-text-size, font-style italic |

**Popover z-index note:** z-index: 100 is sufficient. The widget already handles
outside-click-to-close in TypeScript — CSS only provides the stacking context.

---

### RUNNER-01 — Run Again Button

**Placement:** After `.rp-complete-heading` in the Phase 3 RunnerView section of
`src/styles.css`. The button is rendered at `runner-view.ts:436–452` inside the
`complete` branch of the question zone.

**Visual contract:** Accent-background full-width button matching the established
`.rp-loop-again-btn` pattern (Phase 6).

| State | Visual |
|-------|--------|
| Default | `var(--interactive-accent)` background, `var(--text-on-accent)` text, full width, border-radius radius-s |
| Hover | `var(--interactive-accent-hover)` background |
| Disabled | opacity 0.5, cursor not-allowed — fires when `canvasFilePath === null` (runner-view.ts:441) |

**Disabled state is required:** `runner-view.ts:441` sets `runAgainBtn.disabled = true`
when no canvas is loaded. Without the `:disabled` CSS rule, the button looks active
when it is not — misleading UX.

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Run again button label | "Run again" | `runner-view.ts:437` — already in code, no change |
| Selector trigger placeholder | "Select a canvas…" | `canvas-selector-widget.ts:78` — already in code |
| Selector empty hint | "No canvases found" | `canvas-selector-widget.ts:130` — already in code |

No new copy is introduced in this phase. All labels are already set by existing TypeScript.

---

## Registry Safety

Not applicable. No shadcn, no third-party component registries. This is a plain CSS edit
to a single file (`src/styles.css`) using only Obsidian CSS variables.

---

## Interaction States Summary

### Insert button (LAYOUT-03)

| State | Visual |
|-------|--------|
| Default | Same width as Copy and Save buttons (flex: 1) |
| All other states | Inherited from Obsidian default button styles — no CSS needed |

### Canvas selector trigger (SIDEBAR-01)

| State | Visual |
|-------|--------|
| Default | background-secondary, border, radius-s |
| Hover | background-modifier-hover |
| Open | Popover visible (JS-controlled class/visibility — no CSS state needed) |

### Canvas selector row (SIDEBAR-01)

| State | Visual |
|-------|--------|
| Default | background transparent |
| Hover | background-modifier-hover |
| Selected | background-modifier-active-hover, font-semibold |

### Run again button (RUNNER-01)

| State | Visual |
|-------|--------|
| Default | Accent background, accent text, full width |
| Hover | Accent-hover background |
| Disabled | opacity 0.5, cursor not-allowed |

---

## CSS Insertion Points

| Gap | File | Insertion point |
|-----|------|----------------|
| LAYOUT-03 | `src/styles.css` | Extend selector at lines 61–64 (`.rp-copy-btn, .rp-save-btn`) |
| SIDEBAR-01 | `src/styles.css` | New section before Phase 4 comment, after Phase 3 RunnerView block |
| RUNNER-01 | `src/styles.css` | After `.rp-complete-heading` rule in Phase 3 section |

**Critical:** Edit `src/styles.css` only — NOT the root `styles.css`. The root file is
the build output copy (1 line). `src/styles.css` is the source (492 lines).

---

## What This Phase Does NOT Change

- No TypeScript changes
- No new layout regions or panels
- No new modals
- No Settings tab changes
- No changes to EditorPanelView
- No changes to existing runner flow or typography
- No new color tokens (all tokens already used in prior phases)

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG (non-blocking — no explicit focal point; accent color on run-again button provides implicit hierarchy)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS (2px popover margin declared as exception with justification)
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-10
