---
status: draft
phase: 05
phase_name: dynamic-snippets
created: "2026-04-06"
design_system: obsidian-native (no shadcn — plain DOM + Obsidian CSS variables)
---

# UI-SPEC: Phase 05 — Dynamic Snippets

## Purpose

This document is the visual and interaction contract for Phase 05. It governs two
new surfaces: `SnippetManagerView` (authoring) and `SnippetFillInModal` (runtime
fill-in). All downstream agents — planner, executor, checker, and auditor — consume
this document as the single source of design truth.

---

## Design System

**Tool:** None (no shadcn, no Tailwind, no React).

**Approach:** Plain DOM using Obsidian's `createEl`/`createDiv`/`createSpan` helpers,
styled exclusively via Obsidian CSS custom properties (tokens) and plugin-local CSS
classes added to `src/styles.css`. No `innerHTML`. No inline `style` attribute
assignments.

**Pattern precedent:** Phases 3 and 4 CSS classes (`rp-runner-view`, `rp-editor-panel`,
etc.) define the project's established visual language. Phase 5 classes must follow
the same naming convention (`rp-` prefix) and token usage.

---

## Spacing

**Scale:** 4-point multiples only, using Obsidian spacing tokens.

| Token | Value | Use |
|-------|-------|-----|
| `var(--size-2-1)` | 4px | Tight gaps within a group (answer list, option list, placeholder row list) |
| `var(--size-4-1)` | 8px | Between sibling form sections, dividers, toolbar button gap |
| `var(--size-4-2)` | 16px | Panel padding, card padding, modal content padding |
| `var(--size-4-3)` | 24px | Between major layout zones (list column ↔ form column gap) |
| `var(--size-4-4)` | 32px | Top-level modal vertical padding |

**Touch targets:** All interactive buttons minimum 32px height. The primary [Confirm]
button in `SnippetFillInModal` must be minimum 36px height.

**Exceptions:** Inline [×] remove buttons on option rows may be 24×24px — they sit
adjacent to a full-height input field and are not standalone touch targets.

---

## Typography

All font values use Obsidian CSS tokens. Do not hardcode numeric sizes.

| Role | Token | Computed value | Weight token | Line-height |
|------|-------|----------------|--------------|-------------|
| Body / form labels / field values | `var(--font-text-size)` | ~14px | `var(--font-normal)` = 400 | 1.5 |
| Small labels / section headings | `var(--font-smaller)` | ~13px | `var(--font-semibold)` = 600 | 1.4 |
| Modal section heading | `var(--font-ui-medium)` | ~16px | `var(--font-semibold)` = 600 | 1.2 |
| Muted / idle / hint text | `var(--font-text-size)` | ~14px | `var(--font-normal)` = 400 | 1.5 |

**Rule:** Exactly two weights are used — `var(--font-normal)` (400) for body and field
content, `var(--font-semibold)` (600) for headings, labels, and section titles. No
bold (700) or light (300).

**NFR-05 applies:** All UI text is sentence case. "Add placeholder", "Save snippet",
"Confirm", "Custom" — never "Add Placeholder", "Save Snippet", "CONFIRM".

---

## Color

This plugin does not define a custom color palette. All colors come from Obsidian's
semantic CSS variables, which automatically adapt to light/dark mode.

**60% dominant surface:** `var(--background-primary)` — main content area, modal
interior, live preview textarea background.

**30% secondary surface:** `var(--background-secondary)` — left column list panel in
`SnippetManagerView`, section headers, fieldset backgrounds.

**10% accent — reserved for these specific elements only:**
- The active/selected snippet row in the list panel
- The [Confirm] button in `SnippetFillInModal` (use Obsidian's `.mod-cta` button class)
- The orphaned-placeholder warning badge (use `var(--color-orange)` or
  `var(--text-warning)`)

**Destructive accent:** `var(--color-red)` / `var(--text-error)` — used only for the
[Delete] button in `SnippetManagerView` and delete confirmation state. Applied via
Obsidian's `.mod-warning` button class.

**Borders:** `var(--background-modifier-border)` — column dividers, section dividers,
form field outlines. Consistent with Phases 3 and 4.

**Text muted:** `var(--text-muted)` — empty-state prompts, idle state messages, hint
text below fields.

---

## Copywriting Contract

### Primary CTA labels

| Surface | Label | Notes |
|---------|-------|-------|
| `SnippetManagerView` — save action | "Save snippet" | Sentence case; no ellipsis |
| `SnippetManagerView` — create action | "+ New snippet" | Leading + is conventional for list-create actions |
| `SnippetManagerView` — add placeholder | "+ Add placeholder" | Inline button below template textarea |
| `SnippetManagerView` — add option | "+ Add option" | Inside expanded choice/multi-choice row |
| `SnippetFillInModal` — confirm action | "Confirm" | Last tab stop; `.mod-cta` styling |
| `SnippetFillInModal` — cancel action | "Cancel" | Standard dismiss; no `.mod-cta` |

### Empty states

| Surface | Empty state text |
|---------|-----------------|
| `SnippetManagerView` right column (no selection) | "Select a snippet to edit, or click + New snippet to create one." |
| `SnippetManagerView` left column (no snippets exist) | "No snippets yet. Click + New snippet to create your first one." |
| `SnippetFillInModal` live preview (no placeholders filled) | Show template text as-is with unfilled `{{id}}` tokens visible — no separate message needed |

### Error states

| Error condition | Message | Location |
|----------------|---------|----------|
| Save failed (vault write error) | "Failed to save snippet. Check that the vault is writable and try again." | Shown as a notice (`new Notice(...)`) — not inline |
| Delete failed (vault error) | "Failed to delete snippet. Try again." | Notice |
| Snippet folder creation failed | "Could not create snippet folder at {path}. Check vault permissions." | Notice |
| Corrupt snippet JSON on load | "Snippet file '{name}' could not be loaded — the file may be corrupted. Edit or delete it manually." | Notice on plugin load / manager open |
| Orphaned placeholder in template | Warning badge on the affected placeholder row: "Template still contains {{id}} — remove from template or re-add this placeholder." | Inline badge in manager form |

### Destructive action: Delete snippet

Confirmation approach: **inline two-step** — clicking [Delete] replaces the button
label with "Confirm delete?" and shows a secondary [Cancel] link inline (no modal).
Clicking "Confirm delete?" a second time executes the delete. Clicking anywhere else
cancels. This follows the Phase 4 precedent (no confirmation modals for single-item
deletes).

---

## Component Inventory

### SnippetManagerView

**Layout:** Master-detail two-column layout inside an `ItemView`.

**Left column (list panel):**
- CSS class: `rp-snippet-list-panel`
- Background: `var(--background-secondary)`
- Width: fixed 200px, non-resizable for v1
- Contains: `[+ New snippet]` button at top, scrollable list of snippet name rows
- Selected row: highlighted with `var(--background-modifier-active-hover)` or
  Obsidian's `.is-active` class equivalent
- Row height: 32px minimum; text is `var(--font-text-size)`, weight `var(--font-normal)`
- No icons — name only

**Right column (edit form):**
- CSS class: `rp-snippet-form`
- Background: `var(--background-primary)`
- Padding: `var(--size-4-2)` on all sides
- Sections in order:
  1. **Name field** — single `<input>` with label "Snippet name"
  2. **Template textarea** — label "Template", `resize: vertical`, minimum 80px,
     monospace font (`var(--font-monospace)`) so `{{id}}` tokens are visually distinct
  3. **[+ Add placeholder] button** — below the textarea, full-width
  4. **Placeholders list** — vertically stacked rows, one per placeholder
  5. **Action row** — `[Save snippet]` (`.mod-cta`) and `[Delete]` (`.mod-warning`)
     side by side, pinned to bottom of the form column

**Placeholder row (collapsed):**
- CSS class: `rp-placeholder-row`
- Shows: label text, type badge (e.g., "choice"), inline `[×]` remove button
- Tap/click on row expands options inline

**Placeholder row (expanded — choice/multi-choice):**
- CSS class: `rp-placeholder-row.is-expanded`
- Shows: label input, type dropdown, options list (one `<input>` per option with `[×]`),
  `[+ Add option]` button, join separator field (multi-choice only)

**Placeholder row (expanded — number):**
- Shows: label input, type dropdown, unit input field (placeholder text: "e.g. mm")

**Placeholder row (expanded — free-text):**
- Shows: label input, type dropdown only (no additional fields)

**Inline add-placeholder mini-form:**
- CSS class: `rp-add-placeholder-form`
- Appears below the `[+ Add placeholder]` button, inline (not a modal)
- Fields: Label input (autofocused), Type dropdown
- Buttons: `[Add]` (confirm) and `[Cancel]` inline
- On [Add]: slugifies label → inserts `{{slug}}` at textarea cursor, appends row to
  list, collapses the form

### SnippetFillInModal

**Container:** Obsidian `Modal` subclass. Width follows Obsidian modal default
(~480px). No custom width override.

**Header:** Modal title set to snippet name via `this.titleEl.setText(snippet.name)`.

**Body layout (top to bottom):**
1. **Placeholder fields** — one field per placeholder, in `placeholders[]` array order
2. **[Confirm] button and [Cancel] button** — last tab stop

**Per-placeholder field — free-text:**
- Label: `var(--font-smaller)`, `var(--font-semibold)`, sentence case
- Input: standard `<input type="text">` or `<textarea>` (textarea if multi-line)
- Full width

**Per-placeholder field — choice:**
- Label above the option group
- Radio buttons for predefined options (one per option)
- Final option row: "Custom:" label + `<input type="text">` inline
- Selecting custom input auto-clears the radio selection

**Per-placeholder field — multi-choice:**
- Label above the option group
- Checkboxes for predefined options (one per option)
- Final option row: "Custom:" label + `<input type="text">` inline
- Custom value is added to the selection set independently

**Per-placeholder field — number:**
- Label above
- `<input type="number">` (or `type="text"` with numeric validation — no native
  spinners; `type="number"` removes them with `appearance: none`)
- Unit shown as inline suffix text if `placeholder.unit` is set (e.g., " mm")

**Live preview:**
- CSS class: `rp-snippet-preview`
- Read-only `<textarea>` at the bottom of the modal body
- Label: "Preview" (`var(--font-smaller)`, `var(--font-semibold)`)
- Font: `var(--font-monospace)`, `var(--font-text-size)`, line-height 1.5
- Background: `var(--background-primary)`
- Border: `1px solid var(--background-modifier-border)`
- Min-height: 80px; `resize: none`
- Updated on every `input` event across all fields

**Tab order:** Label → field 1 → field 2 → … → field N → [Confirm] → [Cancel]

**Button row:**
- `[Confirm]` uses `.mod-cta` — primary action, right-aligned or full-width (follow
  Obsidian modal conventions — right-aligned button row)
- `[Cancel]` standard button, left of [Confirm]

---

## Interaction Contracts

### SnippetManagerView interactions

| Trigger | Response |
|---------|----------|
| Click snippet row in list | Loads that snippet's data into right form; previously unsaved edits are discarded silently (no dirty-state warning in v1) |
| Click [+ New snippet] | Creates unsaved draft row labeled "Untitled" in list, selects it, focuses Name input |
| Type in Name input | Updates list row label in real time |
| Click [+ Add placeholder] | Expands inline add-placeholder mini-form below button |
| Type Label + select Type + click [Add] | Slugifies label; inserts `{{slug}}` at cursor in template textarea; appends collapsed placeholder row; collapses mini-form |
| Click [×] on placeholder row | Removes row from list; does NOT remove `{{id}}` from template; if template still contains `{{id}}`, shows orphan warning badge on that row (row remains as warning target until template is fixed or row is re-added) |
| Click placeholder row (choice/multi-choice/number) | Expands inline options form |
| Click [Save snippet] | Calls `snippetService.save(draft)`; disables button while saving; restores on completion; shows `new Notice("Snippet saved.")` on success |
| Click [Delete] | Replaces button with "Confirm delete?" + [Cancel]; no action yet |
| Click "Confirm delete?" | Calls `snippetService.delete(id)`; removes row from list; clears right form to empty state; shows `new Notice("Snippet deleted.")` |
| Click [Cancel] (delete confirm) | Restores [Delete] button, no action |

### SnippetFillInModal interactions

| Trigger | Response |
|---------|----------|
| Field input event (any field) | Re-renders live preview textarea |
| Custom text input (choice/multi-choice) | Clears radio/checkbox selection for that field; custom value is used |
| Radio/checkbox selection | Clears custom text input for that field |
| Tab key | Advances to next field in DOM order |
| Click [Confirm] | Closes modal; returns fully-rendered snippet string to caller |
| Click [Cancel] | Closes modal; returns null (runner skips snippet, no text appended) |
| Press Escape | Same as [Cancel] — modal closes, null returned |

---

## CSS Class Inventory (Phase 5 additions to src/styles.css)

All new classes follow the `rp-` prefix convention established in Phases 3 and 4.

```
rp-snippet-manager          — SnippetManagerView root container
rp-snippet-list-panel       — Left column (list)
rp-snippet-list-item        — Individual snippet row in list
rp-snippet-list-item.is-active  — Selected snippet row highlight
rp-snippet-form             — Right column (edit form)
rp-snippet-form-section     — Wraps each labeled section (name, template, placeholders)
rp-snippet-action-row       — Bottom row with [Save] and [Delete]
rp-add-placeholder-form     — Inline mini-form for adding a placeholder
rp-placeholder-list         — Container for all placeholder rows
rp-placeholder-row          — Individual placeholder row (collapsed)
rp-placeholder-row.is-expanded  — Expanded state for rows with options
rp-placeholder-orphan-badge — Warning badge shown when {{id}} is orphaned in template
rp-option-list              — Container for choice/multi-choice option inputs
rp-option-row               — Individual option input + [×] row
rp-snippet-modal            — SnippetFillInModal content container
rp-snippet-modal-field      — Per-placeholder field wrapper
rp-snippet-modal-label      — Label above each placeholder field
rp-snippet-modal-options    — Wrapper for radio/checkbox option group
rp-snippet-modal-custom-row — "Custom:" input row inside option group
rp-snippet-preview          — Live preview textarea at bottom of modal
rp-snippet-preview-label    — "Preview" heading above preview textarea
```

---

## Accessibility

- All `<input>` and `<textarea>` elements have associated visible `<label>` elements
  (not just `placeholder` attributes).
- Radio and checkbox groups are wrapped in `<fieldset>` with `<legend>` equal to the
  placeholder label. Use `createEl('fieldset')` + `createEl('legend')`.
- Tab order follows DOM source order — no `tabindex` overrides needed.
- [×] remove buttons carry `aria-label="Remove {option text}"` and
  `aria-label="Remove placeholder {label}"` respectively.
- The live preview textarea has `aria-label="Snippet preview"` and `readonly` attribute.
- The orphan warning badge includes `role="alert"` so screen readers announce it when
  it appears.
- The delete confirmation state change updates `aria-label` on the button to
  "Confirm delete snippet {name}?".

---

## Registry

Not applicable. This project uses no shadcn, no third-party component registries, and
no external UI libraries. No registry vetting gate needed.

---

## Pre-Population Sources

| Field | Source | Value |
|-------|--------|-------|
| Design system | RESEARCH.md / STACK.md | Plain DOM + Obsidian CSS variables — confirmed |
| Spacing tokens | src/styles.css (Phases 3+4) | `--size-2-1` through `--size-4-4` — extended from existing |
| Typography tokens | src/styles.css (Phases 3+4) | `--font-text-size`, `--font-smaller`, `--font-ui-medium`, `--font-normal`, `--font-semibold` |
| Color tokens | src/styles.css (Phases 3+4) | `--background-primary/secondary`, `--background-modifier-border`, `--text-muted` |
| Layout pattern | CONTEXT.md D-01 | Master-detail two-column (locked decision) |
| Empty state copy | CONTEXT.md D-02 | "Select a snippet to edit, or click + New snippet to create one." |
| New snippet draft | CONTEXT.md D-03 | Draft labeled "Untitled", immediately selected |
| Add-placeholder flow | CONTEXT.md D-04 | Inline mini-form, cursor insert, slug generation |
| Orphan warning | CONTEXT.md D-05 | Badge on row, no auto-remove from template |
| Choice options input | CONTEXT.md D-06 | Individual fields + [×] — no textarea/comma approach |
| Join separator | CONTEXT.md D-07 | Visible only for multi-choice type |
| Number unit field | CONTEXT.md D-08 | Optional unit suffix, renders as `{value} {unit}` |
| Free-text override | CONTEXT.md D-09 | "Custom:" input below all options, clears radio/checkbox |
| Modal class | CONTEXT.md D-10 | Extends Obsidian `Modal`; zero runner knowledge |
| Cancel = skip | CONTEXT.md D-11 | Null return → runner skips snippet |
| Tab order | CONTEXT.md D-12 | Array order → [Confirm] last |
| Live preview | CONTEXT.md D-13 | Read-only textarea, updates every keystroke |
| Sentence case | REQUIREMENTS.md NFR-05 | All UI strings sentence case |
| No innerHTML | REQUIREMENTS.md UI-08 | `createEl()` only |
| registerDomEvent | REQUIREMENTS.md UI-09 | No raw `addEventListener` |

---

## Out of Scope (this phase)

Per CONTEXT.md deferred section — do NOT implement:
- Linked placeholders across report sections
- Optional/conditional sections in snippets
- Snippet preview with sample values in `SnippetManagerView` (only in modal)
- Drag-to-reorder placeholder rows
- Mandatory field enforcement / blocking on empty fields

---

*Phase: 05-dynamic-snippets*
*UI-SPEC authored: 2026-04-06*
*Status: draft — awaiting checker validation*
