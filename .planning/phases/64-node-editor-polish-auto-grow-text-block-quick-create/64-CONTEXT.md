# Phase 64 — Node Editor Polish: Auto-grow & Text Block Quick-Create — CONTEXT

**Gathered:** 2026-04-25
**Status:** Ready for UI-SPEC and planning
**Source:** Codebase-first assumptions analysis plus user decision on toolbar layout

**Goal (from ROADMAP):** Every multi-line text input in the Node Editor grows with its content (no fixed-height boxes with inner scrollbars), and the toolbar exposes a fifth quick-create button for text-block nodes alongside the existing four.

**Requirements:** EDITOR-04, EDITOR-06

**Depends on:** Phase 63 is advisory only; Phase 64 may share textarea initialization code with sync work, but this phase can be planned around the current `EditorPanelView` form rendering patterns.

---

## Prior State Loaded

- Phase 48 already implemented Question textarea auto-grow using custom DOM, `requestAnimationFrame`, and the `height = auto` then `height = scrollHeight + px` pattern in `src/views/editor-panel-view.ts`.
- Phase 48 also moved the Node Editor quick-create toolbar to the bottom as a full-width vertical button stack in `src/styles/editor-panel.css`.
- Phase 39/42/45 established quick-create buttons for Question, Answer, Snippet, and Loop via `EditorPanelView.onQuickCreate(...)` and `CanvasNodeFactory.createNode(...)`.
- `CanvasNodeFactory` already supports any `RPNodeKind`; `NODE_COLOR_MAP` already includes `'text-block': '3'`.
- Existing tests cover Question auto-grow behavior, quick-create factory calls, and text-block factory placement.

---

## Locked Decisions

### D1 — Auto-grow Behaviour
All Node Editor text-entry fields that can contain authored node text should use the same behavior as the existing Question textarea: size on form load, grow on typing/paste, shrink when content is deleted, and avoid inner scrollbars.

- **Applies to:** Question text, Answer text, Text block content, Loop header text, and Snippet branch label.
- **Why:** EDITOR-04 explicitly names these fields and the roadmap says to match the Phase 48 Question behavior.
- **How to apply:** Reuse or extract the current Question textarea sizing sequence rather than inventing a parallel implementation.

### D2 — Snippet Branch Label Is Included
The Snippet branch label must become a growable text field even though it is currently implemented with `Setting.addText`.

- **Why:** EDITOR-04 explicitly lists “Snippet node branch label.” Leaving it single-line would fail the requirement even if the other `addTextArea` fields are fixed.
- **How to apply:** Preserve the existing save target (`radiprotocol_snippetLabel`) and empty-string-to-`undefined` behavior.

### D3 — Quick-Create Uses Existing Factory Path
The new “Create text block” button must call the same `onQuickCreate(...)` and `CanvasNodeFactory.createNode(...)` path as the existing four quick-create buttons.

- **Why:** This keeps node ID generation, anchor placement, color assignment, live in-memory form loading, save timing, and Notices consistent.
- **How to apply:** Widen the quick-create kind union to include `'text-block'`; do not add a second creation pipeline.

### D4 — Preserve Current Bottom Vertical Toolbar
The quick-create toolbar should remain a bottom, full-width vertical stack. Add “Create text block” as the fifth full-width button in that stack.

- **Why:** User chose “Keep vertical stack” during Phase 64 context capture. This preserves the Phase 48 UX decision and avoids reverting shipped layout.
- **Roadmap wording note:** Phase 64 success criterion 4 mentions Phase 42 wrap behavior. For this phase, interpret the intent as “all five controls remain reachable at narrow sidebar widths”; the accepted current solution is a vertical full-width stack, not the older horizontal wrap layout.

### D5 — Styling Stays in `src/styles/editor-panel.css`
Any CSS needed for the new text-block button or textarea behavior belongs at the bottom of `src/styles/editor-panel.css` under a Phase 64 comment.

- **Why:** `CLAUDE.md` requires feature CSS to stay in the relevant source CSS file and forbids editing generated `styles.css` directly.
- **How to apply:** Append only. Run `npm run build` after CSS changes to regenerate `styles.css`.

### D6 — Tests Extend Existing Coverage
Phase 64 should extend the current targeted tests rather than replacing them.

- **Auto-grow tests:** Extend `src/__tests__/editor-panel-forms.test.ts` to prove the new fields size on load and resize on input.
- **Quick-create tests:** Extend `src/__tests__/editor-panel-create.test.ts` to prove text-block calls the factory with `'text-block'` and renders the new node form from in-memory data.
- **Factory tests:** Do not duplicate factory placement/color tests unless implementation changes `CanvasNodeFactory`.

---

## Implementation Hints for Planner

- The current Question custom DOM block in `EditorPanelView.buildKindForm` is the best reference for label/description order and auto-grow mechanics.
- `Setting.addTextArea` may not expose enough DOM control for reliable sizing tests; planner should consider a small local helper in `EditorPanelView` for growable text blocks if it reduces duplication.
- Preserve pending edit keys exactly:
  - Question: `radiprotocol_questionText` and `text`
  - Answer: `radiprotocol_answerText` and `text`
  - Text block: `radiprotocol_content` and `text`
  - Loop: `radiprotocol_headerText` and `text`
  - Snippet branch label: `radiprotocol_snippetLabel`
- The new button should use Obsidian `setIcon` like the existing toolbar buttons. Choose an icon consistent with passive text/content, not a new visual language.
- Do not alter generated `styles.css` directly.

---

## Canonical References

Downstream agents must read these before planning or implementing:

- `.planning/ROADMAP.md` — Phase 64 goal and success criteria.
- `.planning/REQUIREMENTS.md` — EDITOR-04 and EDITOR-06.
- `src/views/editor-panel-view.ts` — Node Editor form rendering and quick-create toolbar logic.
- `src/styles/editor-panel.css` — current bottom vertical toolbar and Question textarea CSS.
- `src/canvas/canvas-node-factory.ts` — canonical new-node creation path.
- `src/canvas/node-color-map.ts` — text-block color mapping.
- `src/__tests__/editor-panel-forms.test.ts` — existing Question auto-grow and toolbar CSS assertions.
- `src/__tests__/editor-panel-create.test.ts` — existing quick-create tests.
- `src/__tests__/canvas-node-factory.test.ts` — existing text-block factory placement coverage.

---

## Deferred / Out of Scope

- No new node kinds.
- No redesign of the Node Editor beyond the auto-grow fields and the fifth quick-create button.
- No change to quick-create placement behavior; new nodes continue to be placed below the anchor through `CanvasNodeFactory`.
- No Runner UI changes.
