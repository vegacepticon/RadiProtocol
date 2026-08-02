---
date: 2026-07-31T13:00:53+0300
author: Roman Shulgha
commit: 921d6d6
branch: main
repository: RadiProtocol
topic: "Snippet Editor Modal Redesign"
tags: [intent, frd, snippet-editor-modal, snippet-chip-editor, tree-renderer, styles]
status: ready
last_updated: 2026-07-31T13:00:53+0300
last_updated_by: Roman Shulgha
---

# FRD: Snippet Editor Modal Redesign

## Summary
Redesign `SnippetEditorModal` from a long administrative form into a compact two-column editor: remove the redundant "Type: Markdown" row, compact the folder field into an inline breadcrumb-style editable string, place the template text area (~60–65%) and placeholders area (~35–40%) side-by-side, and pin a fixed bottom action bar over an internal scroll region. The "Duplicate Snippet" action moves out of the modal into the snippet list's right-click context menu. The two-column layout collapses to a single column on narrow modal widths via a CSS container query.

## Problem & Intent
The current snippet editing modal reads like a long administrative form — a "Type: Markdown" label that carries no information, a stacked folder field, and the template + placeholders sections stacked vertically rather than side-by-side. The pain is **visual clutter / form fatigue** on the editing surface: the radiologist (snippet author) faces a form that feels administrative rather than a focused editor. Success is a cleaner, more compact editing surface that keeps the action bar visible and surfaces per-snippet actions where they're actually reachable.

## Goals
- Declutter the modal: remove the redundant Type row and compact the folder display.
- Put template text and placeholders side-by-side so both are visible without scrolling.
- Keep the Cancel/Save action bar visible at all times while content scrolls.
- Surface the Duplicate action on the snippet where it's reached (right-click in the list), not inside the editing modal.
- Stay usable on narrow modal widths via a responsive single-column collapse.

## Non-Goals
- No change to save flow, collision/unsaved guards, validation banner, name-collision checks, or `SnippetService.duplicateSnippet()` behavior — these remain byte-identical.
- No restyle of the Name input row or validation banner beyond repositioning required by the new layout.
- No restructuring of the chip-editor's internal DOM (`snippet-chip-editor.ts` mount structure stays); layout is achieved via CSS on the existing parent.
- No change to snippet data model, template parsing, or ref-sync.
- No sidebar/RunnerView work (out of scope; ADR-0001 inline-only runner unaffected).

## Functional Requirements
1. The system SHALL remove the "Type" row from `SnippetEditorModal` in both create and edit modes (no "Markdown"/"Markdown template" label rendered).
2. The system SHALL render the folder as a compact inline string/breadcrumb that remains editable in-modal (keystrokes still drive the existing folder-suggest and unsaved-dot behavior).
3. The system SHALL lay out the template text area and the placeholders area side-by-side, template ~60–65% width, placeholders ~35–40% width, for `md-template` snippets.
4. The system SHALL keep the Cancel/Save action bar fixed at the bottom of the modal, visible while the content region scrolls.
5. The system SHALL collapse the two-column layout to a single column when the modal's own width drops below ~640px (container query).
6. The system SHALL add a "Duplicate" item to the file right-click context menu in the snippet manager tree, placed after "Move" and before the separator/Delete.
7. The system SHALL remove the "Duplicate Snippet" button from `SnippetEditorModal`'s action bar.
8. The context-menu "Duplicate" item SHALL invoke `SnippetService.duplicateSnippet()` for the right-clicked snippet and reuse the existing `snippetEditor.duplicate`/`duplicateTitle` i18n keys.

## Non-Functional Requirements
- **Performance**: No new runtime cost; pure CSS/DOM-positioning changes. Modal open latency unchanged.
- **Security**: No change to data handling; duplication reuses the existing service path (`src/snippets/snippet-service.ts:367`).
- **UX / Accessibility**: The fixed action bar must remain keyboard-reachable; the internal scroll region must not trap focus. The new context-menu item must have an icon and reuse the existing `duplicateTitle` aria-style label. Folder compact restyle must preserve the unsaved-dot indicator semantics.
- **Reliability**: Save/collision/unsaved-guard flows behave identically to today. No new error paths.

## Constraints & Assumptions
- **Runtime**: Obsidian + Electron (modern Chromium) — CSS container queries are supported.
- **Codebase seams**: layout changes touch `src/views/snippet-editor-modal.ts`, `src/styles/snippet-manager.css`, and `src/views/snippet-manager/tree-renderer.ts` (+ a `callbacks.duplicateSnippet` wire in `snippet-manager-view.ts`). The chip-editor DOM (`snippet-chip-editor.ts`) is NOT restructured — CSS grid is applied on `.radi-snippet-editor-content`.
- **i18n**: Reuse existing `snippetEditor.duplicate`/`duplicateTitle` keys for the context-menu item; `snippetEditor.type` becomes unused by the modal (left in both locale files, no removal).
- **Tests**: Vitest. CSS-only layout means chip-editor MockEl tests are largely unaffected; modal DOM tests that assert the Type row or the Duplicate button need updating. No new mocking.
- **Assumption**: the existing `callbacks` surface in `tree-renderer.ts` can accept a new `duplicateSnippet(path)` callback wired through `snippet-manager-view.ts` to `SnippetService.duplicateSnippet()` (research to confirm the exact callback shape).

## Acceptance Criteria
- [ ] Opening `SnippetEditorModal` in create mode shows no "Type" row; opening in edit mode shows no "Type: Markdown" row.
- [ ] The folder field renders as a compact inline string/breadcrumb and is still editable — typing a new path triggers the folder-suggest and the unsaved-dot behaves as before.
- [ ] For an `md-template` snippet, the template text area and placeholders area render side-by-side (template ~60–65% / placeholders ~35–40% of the modal content width).
- [ ] When the modal content overflows, the content region scrolls internally and the Cancel/Save action bar stays fixed and visible at the bottom.
- [ ] Resizing the modal below ~640px width collapses the two columns into one stacked column; widening again restores two columns.
- [ ] Right-clicking a snippet in the snippet manager tree shows a "Duplicate" menu item after "Move" and before the separator/Delete; clicking it creates a duplicate via `SnippetService.duplicateSnippet()`.
- [ ] The `SnippetEditorModal` action bar contains only Cancel and Save (no Duplicate button).
- [ ] `npm run build` exits 0; `npm test` exits 0; `npm run lint` exits 0; `npm run check:release` css-classes + i18n audits pass.

## Recommended Approach
Layout-only redesign of `SnippetEditorModal`: delete the Type row in both modes (`snippet-editor-modal.ts:180-195`), restyle the existing folder-suggest row compact (`:296-315`), apply a CSS grid on `.radi-snippet-editor-content` for the two-column split, introduce an internal scroll body with a sticky/fixed `.modal-button-container`, and add a `@container` query (~640px) on `rp-snippet-editor-modal` for the collapse — all in `src/styles/snippet-manager.css`. Move the Duplicate action: remove the button from `renderButtonRow` (`:448-454`), add a "Duplicate" `menu.addItem` in `tree-renderer.ts:313-343` after "Move", and wire a new `callbacks.duplicateSnippet` through `snippet-manager-view.ts` to `SnippetService.duplicateSnippet()`. Reuse existing `snippetEditor.duplicate`/`duplicateTitle` i18n keys; leave `snippetEditor.type` in locale files.

## Decisions

### D-01 — Fixed action bar via sticky footer + internal scroll body
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4. The modal today is a single normal-flow document with no internal scroll region and no sticky/fixed footer; "fixed action bar visible while scrolling" implies introducing a new internal scrollable body.
**Recommended**: Sticky footer + scroll body (introduce internal scrollable content with `position: sticky`/fixed action bar).
**Chosen**: Sticky footer + scroll body.
**Rationale**: evidence: `src/styles/snippet-manager.css:404-412`, `:522-562` (no overflow/sticky/fixed today) + confirmed.

### D-02 — Duplicate moves to context menu, modal button removed
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4. The modal's Duplicate button is the only UI call site for `duplicateSnippet()`; the file context menu already groups Edit/Rename/Move/Delete.
**Recommended**: Add "Duplicate" to the existing file context menu in `tree-renderer.ts:313-343`, wire to `SnippetService.duplicateSnippet()`, remove the modal button.
**Chosen**: Context menu + remove modal button.
**Rationale**: evidence: `src/views/snippet-editor-modal.ts:448-454` (only UI call site), `src/views/snippet-manager/tree-renderer.ts:313-343` (existing menu), `src/snippets/snippet-service.ts:367` (service) + confirmed.

### D-03 — Scope: layout-only, behavior unchanged
**Question**: Is this redesign strictly layout/UX with no change to existing behavior (save flow, collision/unsaved guards, validation banner, duplicate service)? Name row and validation banner stay as-is?
**Recommended**: Layout-only, behavior unchanged; Name row and validation banner only repositioned.
**Chosen**: Layout-only, behavior unchanged.
**Rationale**: User intent is visual clutter / form fatigue — no behavioral change requested; keeps the diff small and tests stable.

### D-04 — Folder stays editable but restyled compact
**Question**: Should the folder stay editable in-modal (restyled compact) or become display-only with moves handled solely by the existing context-menu Move action?
**Recommended**: Compact but still editable — restyle the existing folder-suggest input (`snippet-editor-modal.ts:296-315`, `folder-suggest.ts`) into a compact inline string/breadcrumb.
**Chosen**: Compact but still editable.
**Rationale**: Optimizes preserving in-modal move capability; loses only marginal visual compactness. Display-only would force a context-menu round-trip for every relocation.

### D-05 — Two-column via CSS grid on parent (no chip-editor DOM restructure)
**Question**: Achieve the two-column split via CSS grid on the existing content parent, or restructure `snippet-chip-editor.ts` to build explicit column wrappers?
**Recommended**: CSS grid on `.radi-snippet-editor-content` — no DOM restructure.
**Chosen**: CSS grid on parent.
**Rationale**: Optimizes minimal code change and leaves chip-editor MockEl tests intact; loses only tight per-column control (acceptable — "Add placeholder" form lives in the left column, which is the intended layout).

### D-06 — Narrow-screen collapse via container query on the modal
**Question**: Should the collapse be driven by a container query on the modal's own width (~640px) or a viewport media query?
**Recommended**: Container query on the modal (`rp-snippet-editor-modal`), ~640px threshold.
**Chosen**: Container query on modal.
**Rationale**: Optimizes correctness in narrow Obsidian panes / split layouts (wide viewport, narrow modal); loses only "newer CSS" portability, which Obsidian's Chromium/Electron supports.

### D-07 — Type row removed in both create and edit modes
**Question**: Remove the Type row in both modes, or only in edit mode?
**Recommended**: Remove in both modes.
**Chosen**: Remove in both modes.
**Rationale**: All snippets are Markdown/template — the label carries no information in either mode. `snippetEditor.type` i18n key left in locale files (no removal).

### D-08 — Duplicate context-menu placement: after Move, before separator
**Question**: Where should the new "Duplicate" item sit in the existing file context menu (Edit → Rename → Move → separator → Delete)?
**Recommended**: After "Move", before the separator — grouping constructive actions (Edit/Rename/Move/Duplicate | separator | Delete).
**Chosen**: After Move, before separator.
**Rationale**: Groups Duplicate with constructive actions; reuses existing `snippetEditor.duplicate`/`duplicateTitle` i18n keys; icon `copy`/`files`.

## Open Questions
- Exact shape of the new `callbacks.duplicateSnippet(path)` on the `tree-renderer.ts` callback surface and its wiring through `snippet-manager-view.ts` — deferred to `research` to confirm against the existing callback contract.

## Suggested Follow-ups
- The `snippetEditor.type` i18n key becomes unused by the modal after D-07; a future cleanup could remove it from both locale files if no other consumer references it (`src/i18n/locales/en.json:115-158`, `src/i18n/locales/ru.json:115-158`).
- The hardcoded `"Markdown"` / `"Markdown template"` strings at `snippet-editor-modal.ts:182-194` are not i18n keys — once the Type row is removed, these literals are dead; follow-up could verify no other reference and delete them.

## References
- Input: free-text feature description (snippet editing modal redesign), Roman Shulgha, 2026-07-31.
- Probe: `src/views/snippet-editor-modal.ts`, `src/views/snippet-chip-editor.ts`, `src/views/snippet-manager/tree-renderer.ts`, `src/views/snippet-manager-view.ts`, `src/styles/snippet-manager.css`, `src/snippets/snippet-service.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`.
- Guidance: `.rpiv/guidance/src/views/architecture.md` (Promise-Based Modal pattern, CSS namespaces `radi-snippet-*` / `rp-snippet-*`).