# Phase 12 Context: Runner Layout Overhaul

**Phase**: 12 — Runner Layout Overhaul
**Goal**: Output grows with content, controls stay below it, action buttons are uniform, node legend is gone
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04
**Date**: 2026-04-08

---

## Canonical Refs

- `src/views/runner-view.ts` — RunnerView: render(), renderPreviewZone(), renderOutputToolbar(), renderLegend()
- `src/styles.css` — All `.rp-*` CSS classes
- `.planning/REQUIREMENTS.md` — LAYOUT-01 through LAYOUT-04 definitions

---

## Decisions

### LAYOUT-01: Textarea auto-grow behavior
**Decision**: Textarea grows without any height cap — no `max-height`, no internal scrollbar.

The outer Obsidian sidebar panel scrolls when content exceeds viewport. The textarea itself must never clip content — `overflow: hidden` with height driven by content (not flex fill). For an empty or short protocol the textarea is small; for a long protocol it is tall and the panel scrolls.

**Implementation note**: Replace `flex: 1 1 auto` on `.rp-preview-textarea` with height driven by content. The standard approach is a hidden `<div>` mirror or a `rows` recalculation on input. Since the textarea is read-only (user doesn't type in it between steps), the simpler approach is: set `height: auto; overflow: hidden` and resize via `scrollHeight` after setting `.value`. No `resize: none` override needed since it will auto-size.

### LAYOUT-02: Zone order (DOM order)
**Decision**: `previewZone → questionZone → outputToolbar`

The `<hr>` divider is removed. The three zones stack with CSS `gap` between them:
1. `rp-preview-zone` (textarea, full width, auto-height)
2. `rp-question-zone` (question text + answer buttons + step-back button)
3. `rp-output-toolbar` (Copy / Save / Insert)

The `render()` method in `runner-view.ts` must be updated — currently appends `questionZone` first, then divider, then `previewZone`, then `outputToolbar`. Reorder to: `previewZone` → `questionZone` → `outputToolbar`. Remove the `root.createEl('hr', ...)` call.

### LAYOUT-03: Equal button sizes
**Decision**: All three output buttons (Copy, Save, Insert) use `flex: 1`.

Currently `.rp-copy-btn, .rp-save-btn` have `flex: 1` but `.rp-insert-btn` does not. Add `rp-insert-btn` to the existing CSS rule so all three flex equally within the toolbar row.

### LAYOUT-04: Remove node legend
**Decision**: Delete the legend entirely — no replacement, no alternative.

Remove the `renderLegend(root)` call at the bottom of `render()`. Remove the entire `renderLegend()` private method. Remove the associated CSS classes: `.rp-legend`, `.rp-legend-row`, `.rp-legend-swatch`.

### "Report preview" heading
**Decision**: Remove the "Report preview" `<p>` element above the textarea.

Currently `renderPreviewZone()` renders a `<p>Report preview</p>` label before the textarea. With the legend gone and layout reordered, the heading is redundant — the textarea is self-evident in context. Remove the `zone.createEl('p', { text: 'Report preview', ... })` line. The `.rp-preview-heading` CSS class can also be removed.

---

## Unchanged Constraints

- All DOM via `createEl`/`createDiv` — no innerHTML (v1.0 rule)
- Canvas selector lives in `headerEl`, not `contentEl` — untouched by this phase
- `insertBtn` instance ref pattern for leaf-change sync — unchanged
- `renderError()` has its own DOM path — not affected by layout reorder

---

## Out of Scope for This Phase

- "Run again" button after completion — Phase 13
- Canvas selector in sidebar — Phase 13
- Manual textarea edit preservation — Phase 16
