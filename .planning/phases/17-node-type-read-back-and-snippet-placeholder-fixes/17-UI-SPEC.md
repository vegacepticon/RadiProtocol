---
phase: 17
phase_name: node-type-read-back-and-snippet-placeholder-fixes
status: draft
design_system: obsidian-css-variables
tool: none
created: "2026-04-09"
---

# UI-SPEC — Phase 17: Node Type Read-Back and Snippet Placeholder Fixes

## Overview

Phase 17 fixes three bugs: BUG-02 and BUG-03 (free-text-input and text-block nodes not
rendering correctly in the runner when canvas is open during Node Editor save), and BUG-04
(the "Add" button in the snippet placeholder mini-form has no effect).

**No new UI surfaces are introduced.** This phase exclusively restores existing,
already-designed interaction contracts to their correct working state. Every class,
token, color, and layout rule below already exists in `src/styles.css`. The design
contract here serves as the source of truth for what "correct" looks like, so
executor and auditor can verify the bugs are fixed without introducing visual drift.

---

## Design System

**Tool:** None (no shadcn, no Tailwind). The project is an Obsidian plugin.
**Styling approach:** Obsidian CSS variables consumed in `src/styles.css`.
**Component library:** Plain DOM API via Obsidian `ItemView`, `createEl`, `createDiv`.
**No third-party registries.**

---

## Spacing

Scale: multiples of 4px only, expressed via Obsidian tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `var(--size-2-1)` | 4px | Tight gaps within a row (option list items, mini-form internal gap) |
| `var(--size-4-1)` | 8px | Standard gaps between form sections and button rows |
| `var(--size-4-2)` | 16px | Panel padding, textarea padding |
| `var(--size-2-2)` | 4px | Loop button vertical padding (established in Phase 6; resolves to 4px per Obsidian developer docs — obsidian-developer-docs Spacing reference, 2-pixel grid system) |
| `var(--size-2-3)` | 8px | Loop iteration row margin (established in Phase 6) |

No new spacing values are introduced in this phase.

---

## Typography

Four sizes, two weights — all inherited from prior phases.

| Role | Token | Effective value | Weight |
|------|-------|----------------|--------|
| Body / inputs / buttons | `var(--font-text-size)` | 14px | `var(--font-normal)` = 400 |
| Labels / headings | `var(--font-smaller)` | 13px | `var(--font-semibold)` = 600 |
| Complete heading | `var(--font-ui-medium)` | 16px | `var(--font-semibold)` = 600 |
| Loop label | `var(--font-ui-small)` | ~12px | `var(--font-semibold)` = 600 |

Line-heights: 1.5 for body and textarea content, 1.4 for labels and headings.
Monospace font (`var(--font-monospace)`) applies to preview textareas and protocol
output textarea only — not to form inputs or buttons.

---

## Color

60 / 30 / 10 split using Obsidian semantic variables.

| Role | Token | Coverage |
|------|-------|---------|
| Dominant surface (60%) | `var(--background-primary)` | Main panel backgrounds, textarea backgrounds |
| Secondary surface (30%) | `var(--background-secondary)` | Sidebar list panel, question zone, add-placeholder-form |
| Accent (10%) | `var(--interactive-accent)` | `.mod-cta` buttons exclusively — "Add", "Save snippet", "Run again" |
| Accent hover | `var(--interactive-accent-hover)` | Hover state of `.mod-cta` buttons |
| Accent text | `var(--text-on-accent)` | Text on accent-background buttons |
| Borders | `var(--background-modifier-border)` | All borders: panels, textareas, placeholder rows, dividers |
| Muted text | `var(--text-muted)` | Empty-state copy, idle editor copy, text-block indicator, placeholder type badge |
| Warning | `var(--text-warning)` | Orphan placeholder badge only |
| Destructive | `var(--color-red)` | No destructive actions in this phase |

Accent is reserved exclusively for the primary action button in each context
(mini-form "Add", snippet "Save snippet"). Cancel and secondary buttons receive
no accent treatment.

---

## Component Inventory

### BUG-02 / BUG-03: Runner — free-text-input and text-block nodes

These node types already have CSS defined. The fix is behavioral (data source fix),
not visual. Confirm these classes render on screen when runner reaches these node types.

**free-text-input node:**
- Container: `.rp-question-zone` (background-secondary, border-radius radius-s, padding 16px)
- Question text: `.rp-question-text` (13px, semibold, 600, margin-bottom 8px)
- Input element: `.rp-free-text-input` (width 100%, padding 16px, font-text-size 14px,
  line-height 1.5, resize vertical, box-sizing border-box)
- Step back button: `.rp-step-back-btn` (margin-top 8px, flex row, gap 4px)

**text-block node:**
- Container: `.rp-question-zone`
- Indicator: `.rp-text-block-indicator` (italic, color text-muted, font-text-size 14px)
  — displayed while the runner auto-advances through the text-block
- Step back button: `.rp-step-back-btn`

Neither node type should display answer buttons (`.rp-answer-list` / `.rp-answer-btn`).
The question zone must not be empty or absent when these node types are encountered.

### BUG-04: Snippet Manager — placeholder mini-form "Add" button

The mini-form is already styled. The fix is behavioral (event handler). Confirm
the interaction contract works end-to-end.

**Add placeholder mini-form:**
- Container: `.rp-add-placeholder-form` (flex column, gap 4px, padding 8px,
  background-secondary, border 1px solid border-color, border-radius radius-s)
- Label input: plain text input, width 100%
- Type select: plain select element
- Action row: flex row, gap 8px, containing Add button and Cancel button
- Add button: `button.mod-cta` with text "Add" — accent background, accent text
- Cancel button: plain `button` with text "Cancel" — no accent

**Interaction contract for Add button (what "fixed" looks like):**
1. User enters a non-empty label in the label input field
2. User clicks "Add"
3. Click handler fires (not suppressed by form submit or propagation)
4. Slug is derived from label via `slugifyLabel()`
5. Placeholder is appended to `draft.placeholders`
6. `{{slug}}` is inserted into the template textarea at cursor position
7. Mini-form is hidden (`display: none`)
8. Label input is cleared
9. Placeholder list below re-renders showing the new entry

**Cancel button contract:**
1. User clicks "Cancel"
2. Mini-form is hidden
3. No placeholder is added, no textarea insertion occurs

**Empty label guard:**
If label is empty or slug derivation produces empty string, focus returns to
the label input and no side effects occur. No error message is displayed —
the focus shift is the only feedback.

---

## Copywriting

### Runner — free-text-input node

- Prompt label: derived from `node.content` set in Node Editor (no default copy)
- Submit button: "Next" or "Continue" — existing convention from runner-view.ts
  (no change in this phase)

### Runner — text-block node

- Indicator text: existing `.rp-text-block-indicator` copy — "Adding text block..."
  or equivalent established in prior phases
  (source: runner-view.ts; no change in this phase)

### Snippet Manager — placeholder mini-form

| Context | Copy |
|---------|------|
| Add button | "Add" |
| Cancel button | "Cancel" |
| Label input placeholder | existing value from prior phase (no change) |
| Type select label | existing value (no change) |

### Empty state

No new empty states introduced. The existing `.rp-empty-state-body` copy
(color: text-muted, font-text-size 14px) is unchanged.

### Error states

No new error states introduced. The empty-label guard (focus-return only) is
silent — no visible error message, no red border. This matches the established
pattern in this codebase.

---

## Interaction States

### Add button — state machine

| State | Visual | Trigger |
|-------|--------|---------|
| Default | Accent background, "Add" label, cursor pointer | Form visible |
| Clicked (empty label) | No change; focus returns to label input | Empty value |
| Clicked (valid label) | Form hidden, placeholder list updated | Non-empty slug |

### text-block node — runner state

| State | Visual | Trigger |
|-------|--------|---------|
| Node reached | `.rp-text-block-indicator` visible in question zone | Runner advances to node |
| Auto-advancing | Indicator remains during brief async delay (if any) | Immediately after render |
| Completed | Question zone clears, next node loads | Auto-advance fires |

### free-text-input node — runner state

| State | Visual | Trigger |
|-------|--------|---------|
| Node reached | Question text + `.rp-free-text-input` visible | Runner advances to node |
| Input focused | Native focus ring (Obsidian default) | User taps input |
| Submitted | Input area clears, next node loads | User confirms entry |

---

## CSS Classes — Phase 17 Scope

No new CSS classes are introduced in this phase. The following existing classes
must function correctly after the fix:

**Runner (BUG-02 / BUG-03):**
- `.rp-question-zone` — must render for free-text-input and text-block nodes
- `.rp-question-text` — must render with node content as text
- `.rp-free-text-input` — must render for free-text-input nodes
- `.rp-text-block-indicator` — must render for text-block nodes
- `.rp-step-back-btn` — must remain available on both node types

**Snippet manager (BUG-04):**
- `.rp-add-placeholder-form` — must show/hide correctly
- `.mod-cta` on `miniAddBtn` — must fire click handler
- `.rp-placeholder-list` — must re-render after successful Add

---

## Registry

Not applicable. No shadcn, no third-party component registries.

---

## Accessibility

No new accessibility requirements introduced. Existing conventions apply:
- Focus management: after Add button fires successfully, focus is not explicitly
  moved (mini-form hides). This is acceptable for the fix scope.
- After empty-label guard fires, `miniLabelInput.focus()` is called — this is
  the correct pattern, already in the existing handler.
- `button` elements must have `type="button"` explicitly if they are inside any
  form-like container, to prevent default submit behavior. The BUG-04 fix MUST
  ensure `miniAddBtn` has `type="button"` if this is the root cause identified
  during research.

---

## Source References

| Artifact | Source |
|----------|--------|
| Spacing tokens | `src/styles.css` — all phases |
| `--size-2-2` resolved value | Obsidian developer docs — Spacing reference (2-pixel grid system, value: 4px) |
| Typography tokens | `src/styles.css` — Phase 3 `.rp-preview-textarea`, Phase 5 `.rp-snippet-form-section label` |
| Color tokens | `src/styles.css` — Phase 3 `.rp-question-zone`, Phase 5 `.rp-add-placeholder-form` |
| free-text-input CSS | `src/styles.css` line 115–122 `.rp-free-text-input` |
| text-block CSS | `src/styles.css` line 131–135 `.rp-text-block-indicator` |
| Add button handler | `src/views/snippet-manager-view.ts` lines 243–265 |
| Phase decisions | `.planning/phases/17-.../17-CONTEXT.md` D-01 through D-11 |

---

## What This Phase Does NOT Change

- No new layout regions
- No new colors or tokens
- No new typography sizes or weights
- No new modals or panels
- No changes to Settings tab
- No changes to EditorPanelView visual contract
- No changes to loop UI
- No changes to canvas selector dropdown
