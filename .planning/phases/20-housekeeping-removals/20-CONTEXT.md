# Phase 20 Context: Housekeeping Removals

**Phase:** 20 — Housekeeping Removals
**Status:** Ready for planning
**Created:** 2026-04-10

---

## Phase Goal

Remove all dead code from `free-text-input` node type, `awaiting-snippet-fill` runner state, and text-block snippet insertion logic. Polish Runner textarea hover colour and Node Editor answer field size.

---

## Decisions

### free-text-input removal strategy
**Decision:** Silent skip — Option A

Canvas nodes with `radiprotocol_nodeType=free-text-input` are **excluded from the ProtocolGraph entirely** by the parser. They are not remapped to text-block, not included in adjacency lists, and generate no validator errors or warnings. Edges from/to these nodes are dropped silently. The runner never halts at them; no text is appended.

Implementation: add `'free-text-input'` to a `DEPRECATED_KINDS` set in `canvas-parser.ts`; when encountered, skip the node without adding it to the graph.

### text-block: snippetId handling
**Decision:** Append plain text — Option A

After removing snippet insertion from the text-block runner branch, the runner always appends the node's `radiprotocol_text` / `text` field and auto-advances — regardless of whether the canvas JSON still contains a `radiprotocol_snippetId` key. The parser ignores `snippetId` when parsing text-block nodes. `TextBlockNode` TypeScript interface removes the `snippetId` field.

### awaiting-snippet-fill session loading
**Decision (from STATE.md, not discussed — no ambiguity):** Sessions with `runnerStatus: "awaiting-snippet-fill"` are treated as stale. The session manager starts a fresh session from the beginning of the current canvas (same code path as sessions with missing nodeIds or unknown statuses). No error is shown.

### Runner textarea hover colour (UX-01)
**Decision (from requirements, not discussed — no ambiguity):** Add CSS override `.rp-preview-textarea:hover { background: var(--background-primary); }` to suppress Obsidian's default textarea hover background change. Focus state colour change (`:focus`) is acceptable and left as-is.

### Node Editor answer textarea size (UX-02)
**Decision (from requirements, not discussed — no ambiguity):** Set `rows` attribute to `6` on the answer textarea element in `editor-panel-view.ts`. Minimum 6 visible rows — no maximum imposed.

---

## Canonical Refs

- `.planning/REQUIREMENTS.md` — NTYPE-01–04, UX-01, UX-02 (Phase 20 requirements)
- `.planning/ROADMAP.md` — Phase 20 success criteria
- `.planning/STATE.md` — v1.3 architecture notes, critical pitfalls (especially #8, #12, #13)
- `src/graph/graph-model.ts` — RPNodeKind union, FreeTextInputNode, TextBlockNode interfaces
- `src/graph/canvas-parser.ts` — parser cases for free-text-input and text-block
- `src/graph/graph-validator.ts` — validator case for free-text-input
- `src/runner/protocol-runner.ts` — enterFreeText(), completeSnippet(), awaiting-snippet-fill, text-block runner branch
- `src/runner/runner-state.ts` — RunnerState union (awaiting-snippet-fill member)
- `src/sessions/session-model.ts` — SavedSession.runnerStatus type
- `src/views/editor-panel-view.ts` — free-text-input dropdown option, answer textarea
- `src/views/canvas-switch-modal.ts` — awaiting-snippet-fill reference
- `src/styles.css` — .rp-preview-textarea styles

---

## Deferred Ideas

None captured during discussion.

---

## Scope Boundary

Phase 20 is **removal and polish only**. It does NOT:
- Add the `snippet` node type (Phase 22)
- Add color coding (Phase 21)
- Add auto-save (Phase 23)
- Any new capability — only deletion of dead paths and two CSS/DOM polish items
