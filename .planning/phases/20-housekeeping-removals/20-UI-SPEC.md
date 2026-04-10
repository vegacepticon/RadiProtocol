---
status: draft
phase: 20
phase_name: housekeeping-removals
created: "2026-04-10"
---

# UI-SPEC: Phase 20 — Housekeeping Removals

## Overview

Phase 20 is a removal and polish phase. There are exactly two UI-visible changes:

1. **UX-01** — Suppress hover background change on the Protocol Runner preview textarea
2. **UX-02** — Expand the Node Editor answer textarea to 6 visible rows

No new components, layouts, or interactions are introduced. All design decisions are
pre-populated from CONTEXT.md and REQUIREMENTS.md — no open questions remain.

---

## Design System

**Tool:** None (Obsidian plugin — no shadcn, no Tailwind, no React)

**Styling approach:** Plain CSS via `src/styles.css` using Obsidian CSS custom properties
(`var(--...)` tokens). All new rules must follow the existing pattern of using Obsidian
variables rather than hard-coded values.

**Registry safety gate:** Not applicable — no shadcn, no third-party registries.

---

## Spacing

**Scale:** Obsidian 4-point scale via CSS variables (do not use raw pixel values)

| Variable | Resolved value | Use |
|----------|---------------|-----|
| `var(--size-2-1)` | 4px | Tight gaps, small padding |
| `var(--size-4-1)` | 8px | Standard gaps, section padding |
| `var(--size-4-2)` | 16px | Panel padding, textarea padding |
| `var(--size-4-3)` | 24px | Large section separation |

**Phase 20 exceptions:** None. The textarea hover fix adds no new spacing. The `rows`
attribute on the answer textarea is a DOM property, not a CSS spacing decision.

---

## Typography

**Source:** Pre-populated from `src/styles.css` (verified 2026-04-10)

| Token | Resolved size | Weight token | Line height | Use |
|-------|--------------|-------------|-------------|-----|
| `var(--font-smaller)` | 13px | `var(--font-semibold)` (600) | 1.4 | Labels, headings, badges |
| `var(--font-text-size)` | 14px | `var(--font-normal)` (400) | 1.5 | Body text, textarea content, buttons |
| `var(--font-ui-small)` | varies | `var(--font-semibold)` (600) | — | Loop labels, action buttons |
| `var(--font-ui-medium)` | 16px | `var(--font-semibold)` (600) | — | Section headings |

**Phase 20 changes:** None. Typography is unchanged.

---

## Color

**Source:** Pre-populated from `src/styles.css` and Obsidian design system

| Role | Token | Use |
|------|-------|-----|
| Dominant surface (60%) | `var(--background-primary)` | Main panel backgrounds, textarea backgrounds |
| Secondary surface (30%) | `var(--background-secondary)` | Question zone, sidebar, selector trigger |
| Accent (10%) | `var(--interactive-accent)` | Run Again button, Loop Again button |
| Accent hover | `var(--interactive-accent-hover)` | Hover state of accent buttons |
| Borders | `var(--background-modifier-border)` | All borders, dividers |
| Hover modifier | `var(--background-modifier-hover)` | Interactive row hover |
| Muted text | `var(--text-muted)` | Empty states, placeholders, secondary labels |
| Warning | `var(--text-warning)` | Orphan badges |

**UX-01 color contract (new rule):**

The `.rp-preview-textarea` must display `var(--background-primary)` at rest AND on
`:hover`. The Obsidian default stylesheet applies a different background on `textarea:hover`
which causes an unwanted flash. The override rule suppresses this.

```css
.rp-preview-textarea:hover {
  background: var(--background-primary);
}
```

- Focus state (`:focus`) retains Obsidian's default — no override.
- No `!important` is the preferred approach. If Obsidian's selector is class-level and
  has higher specificity, escalate to `.rp-preview-textarea.rp-preview-textarea:hover`
  before using `!important`.

---

## Component Inventory

### Modified components (Phase 20 only)

#### 1. `.rp-preview-textarea` (Protocol Runner — `src/styles.css`)

**Change:** Add `:hover` override rule immediately after the existing
`.rp-preview-textarea` rule block.

**Exact rule to add:**
```css
.rp-preview-textarea:hover {
  background: var(--background-primary);
}
```

**States after change:**

| State | Background |
|-------|-----------|
| Rest | `var(--background-primary)` |
| Hover | `var(--background-primary)` (same — no visual change) |
| Focus | Obsidian default (unchanged) |
| Disabled | Not applicable |

#### 2. Answer textarea — `buildKindForm()` case `'answer'` (`src/views/editor-panel-view.ts`)

**Change:** Set `ta.inputEl.rows = 6` before `setValue()` inside the `addTextArea`
callback.

**Exact DOM property:**
```typescript
.addTextArea(ta => {
  ta.inputEl.rows = 6;
  ta.setValue(...)
    .onChange(...);
});
```

**Dimensions contract:**

| Property | Value |
|----------|-------|
| rows | 6 (minimum visible rows) |
| resize | Obsidian default (vertical resize permitted) |
| max-rows | None imposed |
| width | 100% (inherits from Obsidian `Setting` layout) |

### Removed components (Phase 20)

The following UI elements are deleted. No replacement is needed — they served dead code paths.

| Element | Location | Removal reason |
|---------|----------|---------------|
| `free-text-input` option in node type dropdown | `editor-panel-view.ts` `renderForm()` | NTYPE-01: type removed |
| `buildKindForm()` case `'free-text-input'` form block | `editor-panel-view.ts` | NTYPE-01: type removed |
| "Snippet ID (optional)" `Setting` block in text-block form | `editor-panel-view.ts` | NTYPE-03: snippetId removed |
| `awaiting-snippet-fill` render branch in RunnerView | `runner-view.ts` `render()` | NTYPE-04: state retired |
| `.rp-free-text-input` CSS class | `src/styles.css` (line 116–124) | NTYPE-01: dead rule after type removal |

Note on `.rp-free-text-input`: This class is declared in `styles.css` at lines 116–124
and was used by the free-text-input runner render branch. After Phase 20 removes that
branch, the CSS class becomes dead. It should be removed to keep the stylesheet clean,
but it is a low-risk item — leaving it causes no visual regression.

---

## Interaction Contract

### UX-01: Textarea hover stability

**Before:** Mousing over the preview textarea causes the background to flicker to
Obsidian's default `textarea:hover` colour (typically `var(--background-modifier-hover)`
or similar), creating an unintended visual change on a read/edit area.

**After:** Mouse hover produces no background change. The textarea background is stable
at `var(--background-primary)` at rest and on hover.

**Interaction states to verify:**
- Rest → no hover: background = `var(--background-primary)`
- Hover: background = `var(--background-primary)` (same — no flash)
- Hover → focus: Obsidian default focus ring appears (acceptable)
- Focus: Obsidian default focus styles (acceptable, no override)

### UX-02: Answer textarea multi-line input

**Before:** The answer textarea renders at Obsidian's default 1–2 row height, making it
difficult to author or review multi-line answer text.

**After:** The textarea renders with 6 visible rows of input height by default.

**Interaction states to verify:**
- Initial render: 6 rows visible
- Content overflow: textarea height is fixed at 6 rows (user can resize vertically via
  Obsidian default `resize: vertical` if Obsidian sets it; no explicit resize CSS change)
- Keyboard input: multi-line accepted; scroll within textarea if content exceeds 6 rows

---

## Copywriting Contract

Phase 20 does not add new user-facing strings. All existing strings are preserved as-is.

No new CTAs, empty states, error messages, or confirmation dialogs are introduced.

**Removed strings (no replacement needed):**

| String | Location | Reason |
|--------|----------|--------|
| "Free Text Input" (dropdown option) | Node Editor type dropdown | NTYPE-01 |
| "Snippet ID (optional)" (field label) | Node Editor text-block form | NTYPE-03 |
| Any UI shown during `awaiting-snippet-fill` state | Runner render branch | NTYPE-04 |

**Session degradation (NTYPE-04):** When a legacy `awaiting-snippet-fill` session is
detected at load time, the session is silently cleared and a fresh session starts. No
Notice, no toast, no error message is shown to the user. This is the locked decision
from CONTEXT.md.

---

## Accessibility

No changes to keyboard navigation, focus order, ARIA roles, or screen reader behaviour.

The `rows="6"` change on the answer textarea does not affect accessibility — it is a
visual sizing change. The textarea already accepts keyboard input and has a label
rendered by Obsidian's `Setting` component.

---

## Design Tokens — Quick Reference

All tokens used in Phase 20 changes:

| Token | Resolved | Purpose |
|-------|---------|---------|
| `var(--background-primary)` | Theme-dependent | Textarea rest and hover background |
| `ta.inputEl.rows = 6` | 6 rows | Answer textarea minimum height |

---

## Registry

Not applicable. This project is an Obsidian plugin using plain TypeScript, esbuild, and
Obsidian's built-in CSS variable system. No component registry, no shadcn, no npm UI
library.

---

## Source Traceability

| Decision | Source |
|----------|--------|
| CSS hover fix exact rule | CONTEXT.md — "Runner textarea hover colour (UX-01)" |
| `rows=6` on answer textarea | CONTEXT.md — "Node Editor answer textarea size (UX-02)"; REQUIREMENTS.md — UX-02 |
| Silent session degradation (no Notice) | CONTEXT.md — "awaiting-snippet-fill session loading" |
| `.rp-free-text-input` dead class removal | Derived from NTYPE-01 (free-text-input removed); low-risk cleanup |
| Obsidian CSS variable token names | `src/styles.css` — verified 2026-04-10 |
| CSS specificity strategy | RESEARCH.md — Pitfall 6; CONTEXT.md decision is authoritative |

---

## Out of Scope

The following are explicitly excluded from Phase 20's UI-SPEC:

- Canvas node color coding (Phase 21)
- Snippet node UI in Runner (Phase 25)
- Auto-save "Saved" indicator (Phase 23)
- Drag-and-drop placeholder chips (Phase 27)
- Any new form fields, modals, or interactive components
