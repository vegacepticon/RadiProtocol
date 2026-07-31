---
date: 2026-07-31T09:45:07+0300
author: Roman Shulgha
commit: 8d2f9bb
branch: main
repository: RadiProtocol
topic: "Protocol Editor visual polish — dotted grid, consolidated auto-layout button, snippet tooltip removal"
tags: [intent, frd, protocol-editor, snippet-manager, styles, i18n, views]
status: ready
last_updated: 2026-07-31T09:45:07+0300
last_updated_by: Roman Shulgha
---

# FRD: Protocol Editor visual polish — dotted grid, consolidated auto-layout button, snippet tooltip removal

## Summary
Three visual de-clutter changes to the Protocol Editor for first-impression polish: replace the 1px line-grid canvas background with a subtle two-layer dotted grid (fine + coarse dots) at ~25% opacity; consolidate the two separate auto-layout buttons into one button that opens a small Obsidian Menu with the existing left-to-right / top-to-bottom options; and remove the snippet-pane hover tooltips while preserving screen-reader pane identification via visually-hidden headings. CSS + small view-layer edits only; no new dependencies or i18n strings.

## Problem & Intent
First-impression polish — new users opening the Protocol Editor for the first time find it looks busy/unprofessional. The goal is a cleaner, more refined default appearance: the heavy checkered/line grid, the redundant pair of auto-layout buttons, and the hover tooltips over the Snippets section ("Папки сниппетов" / "Сниппеты") all add unnecessary visual clutter. (Developer's framing, in their own words: "First-impression polish — the goal is a cleaner, more refined default appearance.")

## Goals
- A cleaner, more refined default appearance for first-time users of the Protocol Editor.
- Reduce visual clutter: replace heavy grid lines with subtle dots, consolidate redundant auto-layout buttons into one menu button, remove tooltip noise over the Snippets panes.
- Stay theme-aware (light/dark) by deriving dot color from existing Obsidian CSS variables.
- Preserve accessibility — screen readers must still identify the two snippet panes.

## Non-Goals
- The minimap, self-check button, node/card styling, edge styling, zoom behavior, and the inline runner UI are all out of scope.
- The dagre layout algorithm and its parameters (`PROTOCOL_EDITOR_LAYOUT_CONFIG`) are unchanged — only the button that triggers layout is consolidated.
- Other Protocol Editor or Snippet Manager UI elements beyond the three described changes.
- No new user-facing i18n strings (existing labels are reused).

## Functional Requirements
1. The Protocol Editor viewport (`.rp-protocol-editor-viewport`) SHALL render a dotted background using two overlapping `radial-gradient` dot layers — one fine, closely-spaced dot grid and one coarser, widely-spaced dot grid — instead of the current 1px line grid (`src/styles/protocol-editor.css:18-30`).
2. Both dot grids SHALL scale with the existing `--rp-protocol-editor-zoom` CSS variable so they stay aligned at every zoom level.
3. The dots SHALL render at ~25% of the current grid-line color via `color-mix(in srgb, var(--background-modifier-border) 25%, transparent)`, remaining theme-aware (light/dark).
4. The floating-actions toolbar SHALL expose a single auto-layout button (icon `layout`) that, on click, opens an Obsidian `Menu` containing exactly two items, labeled with the existing `protocolEditor.autoLayoutVertical` and `protocolEditor.autoLayoutHorizontal` i18n keys, invoking the existing `autoLayoutNodes('TB')` and `autoLayoutNodes('LR')` handlers respectively.
5. The two separate auto-layout buttons (`autoLayoutVerticalBtn` / `autoLayoutHorizontalBtn` at `src/views/protocol-editor-view.ts:612-630`) SHALL be removed.
6. The snippet manager folder and snippet pane containers SHALL NOT carry a hover tooltip — the `aria-label` attributes at `src/views/snippet-manager-view.ts:125-131` SHALL be removed.
7. Each snippet pane SHALL retain a screen-reader accessible name ("Snippet folders" / "Snippets") via a visually-hidden heading (`<h2>` with an sr-only class) inserted as the first child of the pane, using the existing `snippetManager.folderPaneAria` / `snippetManager.snippetPaneAria` i18n values.

## Non-Functional Requirements
- **Performance**: Two `radial-gradient` background layers + two added `<h2>` DOM nodes — negligible; no per-frame work, no change to render loops.
- **Security**: N/A — UI/CSS-only, no data, auth, or network surface.
- **UX / Accessibility**: Remove hover tooltips on the snippet panes while preserving screen-reader pane identification via visually-hidden headings; the consolidated auto-layout menu uses Obsidian `Menu` semantics (keyboard-navigable); dots must be subtle enough not to compete with node content for attention.
- **Reliability**: No behavior change to the layout/persistence path — `autoLayoutNodes` and `layoutDirection` persistence remain untouched; pure visual change.

## Constraints & Assumptions
- Grid change is CSS-only in the stylelint-governed `src/styles/protocol-editor.css`, reusing the existing `--rp-protocol-editor-zoom` variable and Obsidian theme variables.
- Obsidian's `Menu` API is available and idiomatic in this plugin (research to confirm existing usage precedent).
- A shared visually-hidden / sr-only utility class may not yet exist in `src/styles/`; assumption — introduce one (research to confirm whether a `.sr-only` / visually-hidden class already exists).
- `color-mix()` CSS function is supported in the Obsidian/Electron/Chromium version targeted by this plugin (research to verify; fallback: rgba with a theme-derived color if unsupported).
- Existing i18n keys are reused — no new strings added to `en.json` / `ru.json`.

## Acceptance Criteria
- [ ] Opening a protocol in the Protocol Editor shows a subtle dotted background (two dot sizes) instead of 1px grid lines; the dots are clearly fainter than the previous lines (~25% of `--background-modifier-border`).
- [ ] Zooming the editor in/out scales both dot grids together with no misalignment or moiré.
- [ ] The floating-actions toolbar shows exactly ONE auto-layout button (down from two); clicking it opens a small menu with exactly two items, labeled per the active locale ("Вертикальное размещение" / "Горизонтальное размещение" in ru).
- [ ] Choosing either menu item performs the same layout as before (TB / LR) and persists `layoutDirection` to the protocol document exactly as today.
- [ ] Hovering over empty space in the Snippets folder pane and snippet pane shows NO native/browser tooltip.
- [ ] Inspecting the DOM: the two pane container divs no longer carry `aria-label`; each pane's first child is a visually-hidden `<h2>` whose text is the localized pane name (screen readers still announce "Snippet folders" / "Snippets").
- [ ] `npm run build`, `npm run lint` (ESLint + Stylelint), and `npm test` all exit 0.

## Recommended Approach
Pure CSS change for the dotted grid in `src/styles/protocol-editor.css` (replace the two `linear-gradient` line layers with two `radial-gradient` dot layers using `color-mix` on `--background-modifier-border` at 25%); a small `src/views/protocol-editor-view.ts` edit replacing the two auto-layout buttons with one `layout`-icon button that opens an Obsidian `Menu`; and a `src/views/snippet-manager-view.ts` edit removing the two container `aria-label`s and inserting visually-hidden `<h2>` headings as the first child of each pane (plus an sr-only utility class in `src/styles/` if none exists). No new dependencies; all i18n keys reused.

## Decisions

### Intent — first-impression polish
**Question**: What problem are you solving with these Protocol Editor visual changes, and who experiences it today?
**Recommended**: n/a — `intent` question
**Chosen**: First-impression polish — new users opening the editor for the first time find it looks busy/unprofessional; the goal is a cleaner, more refined default appearance.
**Rationale**: developer's own framing (intent question).

### Snippets tooltip — keep accessibility, drop the visual tooltip
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4. The snippets "tooltips" are actually `aria-label` accessibility labels on the pane containers (`src/views/snippet-manager-view.ts:125-131`), not `title` attributes — removing them also removes screen-reader pane identification. Keep accessibility while removing only the visual tooltip, or remove the labels entirely?
**Recommended**: Keep a11y, drop tooltip (remove visible hover tooltip but preserve screen-reader pane identification)
**Chosen**: Keep a11y, drop tooltip
**Rationale**: evidence: `src/views/snippet-manager-view.ts:125-131` + confirmed (grep found no `title` attributes or custom tooltip CSS in the snippet manager — the container `aria-label` is the tooltip source).

### Grid pattern — two overlapping dot grids
**Question**: For the dotted background: a single dot grid, or two overlapping grids (small closely-spaced dots + larger widely-spaced dots)?
**Recommended**: Two overlapping dot grids
**Chosen**: Two overlapping dot grids
**Rationale**: a fine + coarse dot pair gives a refined, designed "graph-paper" feel that directly serves the first-impression-polish intent; richer visual hierarchy than a single grid.

### Dot opacity — 25% via color-mix
**Question**: What opacity for the dots relative to the current grid-line color (`var(--background-modifier-border)`, currently full opacity)?
**Recommended**: 25% via `color-mix(in srgb, var(--background-modifier-border) 25%, transparent)`
**Chosen**: 25% via color-mix
**Rationale**: midpoint of the developer's stated 20–30% range; `color-mix` keeps dots theme-aware (light/dark) on the existing border variable.

### Auto-layout menu — Obsidian Menu popover
**Question**: How should the consolidated auto-layout button expose its two options (left-to-right / top-to-bottom)?
**Recommended**: Obsidian Menu popover
**Chosen**: Obsidian Menu popover
**Rationale**: Obsidian idiom; reuses existing i18n labels (`autoLayoutVertical` / `autoLayoutHorizontal`) and the existing `autoLayoutNodes('TB'/'LR')` handlers at `src/views/protocol-editor-view.ts:612-630`.

### a11y mechanism — visually-hidden heading
**Question**: How should the two snippet panes keep their screen-reader name ("Snippet folders" / "Snippets") once the container `aria-label` is removed?
**Recommended**: Visually-hidden heading (sr-only `<h2>` as first child of each pane, remove container `aria-label`)
**Chosen**: Visually-hidden heading
**Rationale**: an sr-only `<h2>` is announced when entering the pane; because no attribute names the hoverable container div, no hover tooltip is produced — satisfying "drop tooltip" while keeping a11y.

### Scope — these three only
**Question**: Confirm the scope boundary: should this feature stay limited to the three editor visual changes, or also touch other Protocol Editor / Snippet UI elements?
**Recommended**: These three only
**Chosen**: These three only
**Rationale**: scope kept tight to the three described changes; minimap, self-check button, node/edge styling, zoom, and runner UI explicitly excluded.

## Open Questions
- (none — no items were deferred during the interview)

## Suggested Follow-ups
- The minimap and self-check floating-action buttons remain as-is; if further de-clutter is desired later, their grouping/visibility/labels could be revisited (`src/views/protocol-editor-view.ts:591-611`).
- The `protocolEditor.autoLayout` i18n key ("Авторазмещение" / "Auto-layout") appears unused by the current buttons (only `autoLayoutVertical` / `autoLayoutHorizontal` are used) — it could label the new consolidated button (`src/i18n/locales/{en,ru}.json:74-77`).

## References
- Input: free-text feature description (this `/skill:discover` invocation).
- Codebase evidence: `src/styles/protocol-editor.css:18-30`, `src/views/protocol-editor-view.ts:591-640` & `:1804-1886`, `src/views/snippet-manager-view.ts:124-131`, `src/i18n/locales/{en,ru}.json`.