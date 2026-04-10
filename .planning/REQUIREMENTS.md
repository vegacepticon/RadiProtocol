# Requirements: RadiProtocol v1.3

**Milestone:** v1.3 — Node Editor Overhaul & Snippet Node  
**Status:** Active  
**Created:** 2026-04-10

---

## v1.3 Requirements

### UX — Runner & Editor Polish

- [ ] **UX-01**: Protocol Runner textarea does not change colour on mouse hover (stable colour at all times)
- [ ] **UX-02**: Answer text field in Node Editor is large enough for multi-line input (min 6 rows)

### AUTOSAVE — Node Editor Auto-Save

- [ ] **AUTOSAVE-01**: Node Editor auto-saves changes with ~1s debounce — Save button removed
- [ ] **AUTOSAVE-02**: Node type dropdown change saves immediately (no debounce)
- [ ] **AUTOSAVE-03**: NodeSwitchGuardModal (dirty guard) removed — node switching requires no confirmation
- [ ] **AUTOSAVE-04**: Auto-save timer captures nodeId and edits snapshot at schedule time (not at fire time) to prevent cross-node writes

### COLOR — Canvas Node Color Coding

- [ ] **COLOR-01**: Assigning a node type automatically sets the canvas node's colour to the type's fixed palette string ("1"–"6")
- [ ] **COLOR-02**: Removing a node type clears the canvas node's colour field
- [ ] **COLOR-03**: Colours are fixed per type — start, question, answer, text-block, snippet, loop-start, loop-end each have a distinct palette colour
- [ ] **COLOR-04**: Colour coding applies in real-time via CanvasLiveEditor (no canvas close required)

### TAB — Auto-Switch to Node Editor

- [ ] **TAB-01**: Selecting a canvas node while the Runner is open in the sidebar automatically activates the Node Editor tab

### NTYPE — Node Type Overhaul

- [ ] **NTYPE-01**: free-text-input node type is removed from the plugin
- [ ] **NTYPE-02**: Existing canvas nodes with `radiprotocol_nodeType=free-text-input` are treated as text-block — no validator errors
- [ ] **NTYPE-03**: text-block auto-advances and inserts plain text only — all snippet insertion logic removed from its runner branch
- [ ] **NTYPE-04**: Runner state `awaiting-snippet-fill` is retired; sessions persisted with this status load without errors

### SNIPPET — Snippet Node Type

- [ ] **SNIPPET-01**: `snippet` type exists in the plugin's node type system (NodeKind, parser, validator, Node Editor form)
- [ ] **SNIPPET-02**: Snippet node renders as a choice button in Protocol Runner (same visual pattern as Answer)
- [ ] **SNIPPET-03**: Pressing the snippet button opens a FuzzySuggestModal filtered to files in the configured folder
- [ ] **SNIPPET-04**: Selecting a `.md` file inserts its plain-text content into the Protocol Runner textarea
- [ ] **SNIPPET-05**: Selecting a JSON snippet opens SnippetFillInModal for placeholder fill; result is inserted into the Protocol Runner textarea
- [ ] **SNIPPET-06**: Global snippet node folder path setting added to plugin Settings tab
- [ ] **SNIPPET-07**: Per-node folder override available in the Node Editor form for snippet nodes

### CHIP — Interactive Placeholder Editor

- [ ] **CHIP-01**: Snippet Editor displays placeholders as coloured chips (not raw `{{syntax}}`)
- [ ] **CHIP-02**: User can drag-and-drop chips to reorder placeholders in the list
- [ ] **CHIP-03**: Reordering chips updates `draft.placeholders[]` order, which changes tab order in SnippetFillInModal

---

## Future Requirements (Deferred)

- Canvas selector dropdown in runner view
- Full-tab runner view
- Protocol authoring documentation / example canvases
- Community plugin submission checklist
- Node templates
- Configurable output destination: insert into current note
- UI hint when global separator change requires canvas reopen
- Retroactive Nyquist VALIDATION.md for phases 12–19
- In-textarea placeholder chip overlay (requires rich-text framework)

---

## Out of Scope (v1.3)

- In-textarea chip overlay — deferred; requires rich-text framework infrastructure
- User-controlled canvas node colours — colours are fully managed by node type; no manual override
- AI/LLM-generated text
- PACS/RIS direct integration
- Mobile support
- Multi-user / shared vaults

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| UX-01 | Phase 20 |
| UX-02 | Phase 20 |
| AUTOSAVE-01 | Phase 23 |
| AUTOSAVE-02 | Phase 23 |
| AUTOSAVE-03 | Phase 23 |
| AUTOSAVE-04 | Phase 23 |
| COLOR-01 | Phase 21 |
| COLOR-02 | Phase 21 |
| COLOR-03 | Phase 21 |
| COLOR-04 | Phase 21 |
| TAB-01 | Phase 26 |
| NTYPE-01 | Phase 20 |
| NTYPE-02 | Phase 20 |
| NTYPE-03 | Phase 20 |
| NTYPE-04 | Phase 20 |
| SNIPPET-01 | Phase 22 |
| SNIPPET-02 | Phase 25 |
| SNIPPET-03 | Phase 25 |
| SNIPPET-04 | Phase 25 |
| SNIPPET-05 | Phase 25 |
| SNIPPET-06 | Phase 24 |
| SNIPPET-07 | Phase 25 |
| CHIP-01 | Phase 27 |
| CHIP-02 | Phase 27 |
| CHIP-03 | Phase 27 |
