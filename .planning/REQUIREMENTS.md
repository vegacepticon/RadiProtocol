# Requirements: RadiProtocol v1.4

**Milestone:** v1.4 — Snippets and Colors, Colors and Snippets  
**Created:** 2026-04-13  
**Status:** Active

---

## v1 Requirements

### NODE-COLOR — Auto Node Coloring

- [ ] **NODE-COLOR-01:** User sees that saving a node type via EditorPanel always writes the corresponding color to the canvas node (Pattern B path when canvas is open, Strategy A path when canvas is closed)
- [ ] **NODE-COLOR-02:** User sees that color is always overwritten on every save, regardless of whether a color was previously set on the node
- [ ] **NODE-COLOR-03:** User sees that programmatically created test canvases include the correct `color` field for each node based on its `radiprotocol_nodeType`

### SNIPPET-NODE — Snippet Node Type

- [ ] **SNIPPET-NODE-01:** Parser and graph model recognize `snippet` as a valid 8th node kind alongside the existing 7 types
- [ ] **SNIPPET-NODE-02:** EditorPanel form for snippet node includes a subfolder picker that lets the user select a subfolder path within `.radiprotocol/snippets/`
- [ ] **SNIPPET-NODE-03:** Runner presents snippet node as a selectable list of snippets from the configured subfolder (analogous to how Answer nodes are presented)
- [ ] **SNIPPET-NODE-04:** User can navigate into subfolders within the configured folder directly from the Runner snippet picker
- [ ] **SNIPPET-NODE-05:** After selecting a snippet with placeholders, SnippetFillInModal opens; the filled result is appended to the protocol textarea
- [ ] **SNIPPET-NODE-06:** After selecting a snippet without placeholders, snippet text is appended directly to the protocol textarea without opening a modal
- [ ] **SNIPPET-NODE-07:** Snippet node with outgoing edges transitions to the next node after snippet insertion; snippet node without outgoing edges terminates the protocol
- [ ] **SNIPPET-NODE-08:** GraphValidator warns when a snippet node has no subfolder path configured (missing required field)

---

## Future Requirements

- Canvas selector dropdown in runner view — choose protocol without reopening command
- Full-tab runner view — open as editor tab instead of sidebar panel
- Protocol authoring documentation / example canvases for community submission
- Community plugin submission checklist (README, LICENSE, manifest review, plugin review)
- Node templates — save frequently-used node structures for reuse
- Configurable output destination: insert into current note
- UI hint when global separator change requires canvas reopen to take effect
- Retroactive Nyquist VALIDATION.md for phases 12–19 (tech debt)

---

## Out of Scope (v1.4)

- Snippet node with branching (different paths per snippet selection) — deferred; snippet node always continues to a single next node or terminates
- Folder creation from within Runner — user must create folders externally
- Snippet search/filter within Runner — browse/navigate only
- Snippet preview before selection — not in v1.4

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| NODE-COLOR-01 | Phase 28 | Complete |
| NODE-COLOR-02 | Phase 28 | Complete |
| NODE-COLOR-03 | Phase 28 | Complete |
| SNIPPET-NODE-01 | Phase 29 | Pending |
| SNIPPET-NODE-02 | Phase 29 | Pending |
| SNIPPET-NODE-08 | Phase 29 | Pending |
| SNIPPET-NODE-03 | Phase 30 | Pending |
| SNIPPET-NODE-04 | Phase 30 | Pending |
| SNIPPET-NODE-05 | Phase 30 | Pending |
| SNIPPET-NODE-06 | Phase 30 | Pending |
| SNIPPET-NODE-07 | Phase 30 | Pending |
