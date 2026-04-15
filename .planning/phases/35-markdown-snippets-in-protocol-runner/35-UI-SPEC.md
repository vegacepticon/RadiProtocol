---
phase: 35
slug: markdown-snippets-in-protocol-runner
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-15
---

# Phase 35 — UI Design Contract

> Visual and interaction contract for adding `.md` snippet rows to the Protocol Runner snippet picker. Scope is a tiny UI delta (one emoji prefix + one click branch reuse) on top of the existing Phase 30 picker. All tokens, layout, spacing, typography and colour are **inherited unchanged** from the existing `src/styles/runner-view.css` Phase 30 rules.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Obsidian plugin — no web component library) |
| Preset | not applicable |
| Component library | none (hand-rolled DOM via Obsidian `createEl`) |
| Icon library | Unicode emoji (consistent with existing `📁` folder rows) |
| Font | Obsidian theme default (inherited via `--font-interface`) |

Rationale: RadiProtocol is an Obsidian plugin. It does not ship a web design system, shadcn, Tailwind, or any component library. All styling lives in per-feature CSS files in `src/styles/` and inherits Obsidian theme variables (`--background-primary`, `--text-normal`, `--interactive-hover`, etc.). Phase 35 introduces **zero new design tokens** and **zero new CSS classes** — it reuses the existing `.rp-snippet-item-row` rule from Phase 30.

---

## Spacing Scale

**Inherited unchanged** from existing `src/styles/runner-view.css` Phase 30 rules (`.rp-snippet-picker-list`, `.rp-snippet-folder-row`, `.rp-snippet-item-row`). Phase 35 declares no new spacing tokens.

| Token | Value | Usage |
|-------|-------|-------|
| (inherited) | Phase 30 picker row padding | Unchanged — MD rows reuse `.rp-snippet-item-row` |

Exceptions: none. Phase 35 MUST NOT introduce new padding/margin rules. If a plan task tries to add new spacing, the checker/auditor should reject it.

---

## Typography

**Inherited unchanged** from Obsidian theme + existing `.rp-snippet-item-row` rules. Phase 35 declares no typographic changes.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Picker row label | inherited (Obsidian `--font-ui-small`) | inherited | inherited |

No H1 extraction, no subtitle rows, no two-line layouts — display name is `mdSnippet.name` (basename without extension), rendered as a single-line label identical to JSON rows per D-05.

---

## Color

**Inherited unchanged** from Obsidian theme variables and existing Phase 30 picker rules. Phase 35 declares no colour changes.

| Role | Value | Usage |
|------|-------|-------|
| Row background | `var(--background-primary)` (inherited) | Unchanged |
| Row hover | `var(--interactive-hover)` (inherited) | Unchanged |
| Row text | `var(--text-normal)` (inherited) | Unchanged |

Accent reserved for: nothing new — MD rows use the same neutral palette as existing JSON rows. Type differentiation is carried **exclusively by the emoji prefix** (`📄` vs `📝`), never by colour. This preserves accessibility (colour-blind users) and avoids dependency on Obsidian theme palette variance.

---

## Copywriting Contract

Phase 35 adds **no new user-facing strings**. The only textual change is the emoji prefix in picker row labels.

| Element | Copy |
|---------|------|
| JSON picker row label | `📄 {snippet.name}` (basename without extension) |
| MD picker row label | `📝 {snippet.name}` (basename without extension) |
| Folder row label | `📁 {folderName}` (inherited from Phase 30, unchanged) |
| Empty MD pick | no copy — click commits silently, runner advances (per D-03) |
| Error state | none — MD content is inserted verbatim, no validation, no Notice |
| Destructive confirmation | not applicable — picking a snippet is non-destructive and reversible via `Step back` |

**Locked label conventions (per CONTEXT.md D-01, D-05):**
- Emoji is a literal prefix followed by a single space, then the basename.
- Basename is `snippet.name` as already provided by `SnippetService.listFolder()` — no re-derivation from path, no extension stripping in the view layer.
- No tooltip, no title attribute, no aria-label deviation from the visible text (per D-04 — no preview of any kind).

---

## Interaction Contract

This section is the load-bearing part of the Phase 35 UI-SPEC — it documents the click paths the planner and executor must wire.

### Row rendering (in `renderSnippetPicker`)

For each entry returned by `SnippetService.listFolder()`:

| Entry kind | Prefix | Row class | On click |
|------------|--------|-----------|----------|
| Folder | `📁 ` | `.rp-snippet-folder-row` (existing) | Drill into subfolder (existing behaviour, unchanged) |
| `snippet.kind === 'json'` | `📄 ` | `.rp-snippet-item-row` (existing) | Existing JSON path: modal if placeholders, else zero-placeholder `completeSnippet(template)` |
| `snippet.kind === 'md'` | `📝 ` | `.rp-snippet-item-row` (existing, reused) | `completeSnippet(snippet.content)` directly — no modal, no preview |

**The `if (snippet.kind !== 'json') continue;` filter at runner-view.ts:625 is removed.** MD entries flow through the same row-creation code path as JSON entries; only the prefix character and the click handler branch differ.

### Click affordance

- Hover feedback: inherited from `.rp-snippet-item-row:hover` (Phase 30) — unchanged.
- Cursor: inherited — unchanged.
- No distinct hover style between JSON and MD rows. Visual differentiation is prefix-only.
- No disabled state for empty/whitespace-only MD files (per D-03). The row is always clickable; clicking a zero-byte `.md` commits `''` and advances the runner.

### Step-back symmetry (per D-06)

After an MD pick:
- `Step back` button (already present in runner view) reverts `accumulatedText` and `currentNodeId` identically to a JSON zero-placeholder pick.
- The picker re-opens at the same folder-drilldown level that was active at the time of the MD click.
- No MD-specific UI affordance is added to the step-back button.

### Drill-down symmetry

- MD files appearing inside a subfolder behave identically to JSON files in that subfolder: they are rendered with the `📝` prefix in the drilled-in list, and the breadcrumb/`Up` button behaviour (Phase 30) is unchanged.
- Sort order within a folder: inherited from `SnippetService.listFolder()` return order. Phase 35 does NOT introduce kind-based grouping or sorting (out of scope per CONTEXT.md Scope boundary).

---

## Visual States

Phase 35 introduces no new visual states. MD rows use the same three states as existing JSON rows (all inherited from Phase 30):

| State | Source | MD-specific override |
|-------|--------|----------------------|
| Default | `.rp-snippet-item-row` | none |
| Hover | `.rp-snippet-item-row:hover` | none |
| Focus/keyboard (if present in Phase 30) | inherited | none |

There is no "empty MD" state, no "loading MD content" state, no "MD parse error" state — content is read once at listFolder time and inserted verbatim.

---

## Component Inventory (delta only)

Phase 35 touches exactly these DOM/view surfaces:

| Surface | File | Change |
|---------|------|--------|
| Picker row creation loop | `src/views/runner-view.ts` `renderSnippetPicker` | Remove `kind !== 'json'` filter; add `kind`-aware prefix + click branch |
| Click handler | `src/views/runner-view.ts` `handleSnippetPickerSelection` | Widen signature from `JsonSnippet` to `Snippet`; add MD branch calling `completeSnippet(content)` |
| CSS | `src/styles/runner-view.css` | **No changes.** If a plan task proposes CSS, it violates this contract. |

---

## CSS Architecture Compliance

Per `./CLAUDE.md` rules:
- Phase 35 CSS changes: **none expected**.
- If the executor discovers a legitimate need to visually differentiate MD rows beyond the emoji (e.g. a modifier class `.rp-snippet-item-row--md`), it MUST be **appended** to the bottom of `src/styles/runner-view.css` under a `/* Phase 35: ... */` comment, never inserted into Phase 30 rules.
- Under NO circumstances may the executor modify, remove, or rewrite any existing rule in `src/styles/runner-view.css`. The append-only rule from `./CLAUDE.md` is absolute.
- `styles.css` at project root is generated by esbuild and MUST NOT be edited directly.

---

## Accessibility

- Emoji prefix is part of the visible text node, so screen readers announce it as-is (e.g. "page facing up json-name" / "memo md-name"). This is acceptable for Phase 35 — the picker is a power-user workflow and the user has explicitly chosen emoji as the differentiator (D-01).
- Colour-blind safety: preserved — differentiation is shape/glyph-based, not colour-based.
- Keyboard navigation: inherited from Phase 30 picker (no regression, no enhancement).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable — no component library, no registry in this project |

No third-party component source is introduced. No `npx shadcn view` required.

---

## Out of Scope (do not implement)

Per CONTEXT.md Scope boundary — re-stated here as a UI contract guard:

- Preview of MD content (hover, tooltip, expand, side panel) — forbidden by D-04.
- H1/title extraction or subtitle rows — forbidden by D-05.
- Frontmatter stripping, markdown rendering, separators — forbidden by D-02.
- New colour for MD rows — forbidden (differentiation is emoji-only).
- New CSS variables, new design tokens, new spacing values — forbidden (proportional-scope rule).
- Disabled/greyed-out state for empty MD files — forbidden by D-03.
- Sort/filter/group by kind in picker — out of phase scope.

If the checker or auditor finds any of the above in the plan or implementation, it is a contract violation.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS (only new strings are `📄 ` / `📝 ` prefixes; all other copy inherited)
- [ ] Dimension 2 Visuals: PASS (no new components, no new DOM structure beyond prefix character)
- [ ] Dimension 3 Color: PASS (no new colours; differentiation is glyph-based)
- [ ] Dimension 4 Typography: PASS (no typographic changes)
- [ ] Dimension 5 Spacing: PASS (no new spacing rules; all layout inherited from Phase 30)
- [ ] Dimension 6 Registry Safety: PASS (no registry, not applicable)

**Approval:** pending
