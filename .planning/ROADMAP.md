# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-10

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12–19 (shipped 2026-04-10)
- 🔄 **v1.3 Node Editor Overhaul & Snippet Node** — Phases 20–27 (active)

---

## Phases

<details>
<summary>✅ v1.0 Community Plugin Release (Phases 1–7) — SHIPPED 2026-04-07</summary>

- [x] Phase 1: Project Scaffold and Canvas Parsing Foundation (6/6 plans) — completed 2026-04-06
- [x] Phase 2: Core Protocol Runner Engine (3/3 plans) — completed 2026-04-06
- [x] Phase 3: Runner UI (ItemView) (5/5 plans) — completed 2026-04-06
- [x] Phase 4: Canvas Node Editor Side Panel (3/3 plans) — completed 2026-04-06
- [x] Phase 5: Dynamic Snippets (5/5 plans) — completed 2026-04-06
- [x] Phase 6: Loop Support (3/3 plans) — completed 2026-04-07
- [x] Phase 7: Mid-Session Save and Resume (3/3 plans) — completed 2026-04-07

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Runner UX & Bug Fixes (Phases 12–19) — SHIPPED 2026-04-10</summary>

- [x] Phase 12: Runner Layout Overhaul — completed 2026-04-08
- [x] Phase 13: Sidebar Canvas Selector and Run Again — completed 2026-04-08
- [x] Phase 14: Node Editor Auto-Switch and Unsaved Guard — completed 2026-04-09
- [x] Phase 15: Text Separator Setting — completed 2026-04-09
- [x] Phase 16: Runner Textarea Edit Preservation — completed 2026-04-09
- [x] Phase 17: Node Type Read-Back and Snippet Placeholder Fixes — completed 2026-04-09
- [x] Phase 18: CSS Gap Fixes (INSERTED) — completed 2026-04-10
- [x] Phase 19: Phase 12–14 Formal Verification — completed 2026-04-10

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### v1.3 Node Editor Overhaul & Snippet Node (Phases 20–27) — ACTIVE

- [x] **Phase 20: Housekeeping Removals** — completed 2026-04-11 — Remove free-text-input type, retire awaiting-snippet-fill state, strip text-block snippet logic, polish Runner textarea
- [x] **Phase 21: Color Infrastructure** — Canvas node color coding by type via CanvasLiveEditor, node-color-map constant, both PROTECTED_FIELDS copies updated (completed 2026-04-11)
- [ ] **Phase 22: Snippet Node — Graph and Runner Layer** — Add snippet to RPNodeKind, parser, validator, and runner halt/advance logic
- [ ] **Phase 23: Node Editor Auto-Save and Color-on-Type-Change** — Debounced auto-save replaces Save button, color written/cleared on type assignment, dirty guard removed
- [ ] **Phase 24: Settings — Snippet Node Folder** — Global snippetNodeFolderPath setting added to plugin Settings tab
- [ ] **Phase 25: Snippet Node Runner UI** — FuzzySuggestModal picker, .md/.json dispatch, per-node folder override wired into runner
- [ ] **Phase 26: Auto-Switch to Node Editor Tab** — revealLeaf() on canvas node click brings Node Editor tab to front
- [ ] **Phase 27: Interactive Placeholder Editor** — Drag-and-drop chip reorder in SnippetManagerView updates placeholder list order

---

## Phase Details

### Phase 20: Housekeeping Removals
**Goal**: The codebase contains no dead code from free-text-input, awaiting-snippet-fill, or text-block snippet logic; existing canvas files and sessions degrade gracefully; Runner textarea has stable hover colour
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: NTYPE-01, NTYPE-02, NTYPE-03, NTYPE-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Opening a canvas that contains nodes with `radiprotocol_nodeType=free-text-input` starts a session without validator errors or warnings — those nodes are silently skipped
  2. Loading a saved session file whose `runnerStatus` is `awaiting-snippet-fill` launches a fresh session rather than erroring or hanging
  3. Running a text-block node advances automatically and inserts plain text only — no snippet selection UI appears
  4. The Protocol Runner textarea shows the same background colour at rest and on mouse hover
  5. The answer text field in Node Editor accepts multi-line input (at least 6 visible rows)
**Plans**: TBD

### Phase 21: Color Infrastructure
**Goal**: Every canvas node whose type is assigned by the plugin displays the correct palette colour in real-time; clearing a node's type removes the colour; both PROTECTED_FIELDS copies permit color writes
**Depends on**: Phase 20
**Requirements**: COLOR-01, COLOR-02, COLOR-03, COLOR-04
**Success Criteria** (what must be TRUE):
  1. Assigning any node type in the Node Editor immediately changes the canvas node's colour without closing or reopening the canvas
  2. Each of the seven node types (start, question, answer, text-block, snippet, loop-start, loop-end) displays a distinct palette colour — no two types share the same colour
  3. Removing a node's type (unmarking it) immediately clears its colour back to the default canvas node colour
  4. Vitest tests for src/canvas/node-color-map.ts confirm all seven type-to-palette mappings and the unmark-clears-color path
**Plans**: 2 plans
Plans:
- [x] 21-01-PLAN.md — Create node-color-map.ts constant and test scaffold (TDD + test updates)
- [x] 21-02-PLAN.md — Wire color into PROTECTED_FIELDS and editor-panel-view.ts save path
**UI hint**: yes

### Phase 22: Snippet Node — Graph and Runner Layer
**Goal**: The snippet node type exists throughout the pure graph layer — model, parser, validator, and runner — with TypeScript exhaustive-switch coverage and correct undo behaviour; no UI wiring yet
**Depends on**: Phase 20
**Requirements**: SNIPPET-01
**Success Criteria** (what must be TRUE):
  1. `tsc --noEmit` passes with zero errors after adding `snippet` to the RPNodeKind union
  2. A canvas file with a snippet-type node parses without errors and appears in the ProtocolGraph
  3. The graph validator accepts a snippet node connected in a valid protocol graph and rejects one that violates graph rules
  4. The protocol runner halts at a snippet node in the `at-node` state (does not auto-advance and does not error)
**Plans**: 3 plans
Plans:
- [ ] 22-01-PLAN.md — Phase 20 recovery: purge free-text-input dead code, DEPRECATED_KINDS, test cleanup (Wave 0)
- [ ] 22-02-PLAN.md — Add SnippetNode to graph-model, canvas-parser, graph-validator, node-color-map, fixture, tests
- [ ] 22-03-PLAN.md — Runner halt at snippet node, AtNodeState.isAtSnippetNode, runner tests

### Phase 23: Node Editor Auto-Save and Color-on-Type-Change
**Goal**: Node Editor changes save automatically without a Save button; the colour of the canvas node updates whenever its type changes; the dirty-guard modal is gone; the auto-save timer is immune to cross-node write corruption
**Depends on**: Phase 21, Phase 22
**Requirements**: AUTOSAVE-01, AUTOSAVE-02, AUTOSAVE-03, AUTOSAVE-04
**Success Criteria** (what must be TRUE):
  1. Editing any field in the Node Editor and waiting approximately one second saves the change to the canvas file — no Save button press required
  2. Switching node types in the dropdown saves immediately (no debounce delay) and updates the canvas node colour in real-time
  3. Switching from one canvas node to another while a debounced save is pending writes the first node's edits to the first node's ID, not the second node's ID
  4. Switching between canvas nodes requires no confirmation modal — the Node Editor loads the new node immediately
  5. A transient "Saved" indicator appears inline in the editor after each successful auto-save
**Plans**: TBD
**UI hint**: yes

### Phase 24: Settings — Snippet Node Folder
**Goal**: Users can configure a global vault folder path that the snippet node file picker will scope to
**Depends on**: Phase 20
**Requirements**: SNIPPET-06
**Success Criteria** (what must be TRUE):
  1. The plugin Settings tab contains a "Snippet node folder" text field; entering a folder path and reloading Obsidian preserves the value
  2. Leaving the field empty does not break plugin load or existing features — a configuration notice is shown when a snippet node button is pressed without a folder configured
**Plans**: TBD

### Phase 25: Snippet Node Runner UI
**Goal**: Pressing a snippet node button in the Protocol Runner opens a scoped file picker; selecting a file inserts its content into the report textarea; .md and .json files are handled correctly; per-node folder override is respected
**Depends on**: Phase 22, Phase 24
**Requirements**: SNIPPET-02, SNIPPET-03, SNIPPET-04, SNIPPET-05, SNIPPET-07
**Success Criteria** (what must be TRUE):
  1. At a snippet node, the Protocol Runner displays a button styled identically to an answer button
  2. Pressing the snippet button opens a fuzzy search modal listing only files inside the configured folder (global setting or per-node override, whichever applies)
  3. Selecting a `.md` file appends its plain-text content to the protocol report textarea and advances the runner
  4. Selecting a `.json` snippet file opens SnippetFillInModal; after filling placeholders and confirming, the filled text is appended to the report textarea and the runner advances
  5. The per-node folder path set in the Node Editor form takes precedence over the global setting when both are configured
**Plans**: TBD
**UI hint**: yes

### Phase 26: Auto-Switch to Node Editor Tab
**Goal**: Clicking a canvas node while the Runner tab is active brings the Node Editor tab to the foreground automatically — no manual tab switch required
**Depends on**: Phase 23
**Requirements**: TAB-01
**Success Criteria** (what must be TRUE):
  1. Clicking a canvas node while the Protocol Runner tab is visible and active switches the sidebar to the Node Editor tab and loads that node's form
  2. If the Node Editor panel is not yet open (e.g. first launch), it is created and brought to front before loading the node form
**Plans**: TBD
**UI hint**: yes

### Phase 27: Interactive Placeholder Editor
**Goal**: Placeholders in the Snippet Editor are displayed as coloured chips and can be reordered by dragging; reordering updates the tab order in SnippetFillInModal
**Depends on**: Phase 20
**Requirements**: CHIP-01, CHIP-02, CHIP-03
**Success Criteria** (what must be TRUE):
  1. Opening any snippet in Snippet Editor shows each placeholder as a distinct coloured chip — the raw `{{syntax}}` text is not visible in the chips list
  2. Dragging a placeholder chip to a new position in the list and releasing updates the visual order immediately
  3. After reordering chips, opening SnippetFillInModal for that snippet presents the input fields in the new order (tab key moves through fields in reordered sequence)
**Plans**: TBD
**UI hint**: yes

---

## Backlog

### Phase 999.1: Canvas selector dropdown in runner view (BACKLOG)

**Goal:** Let users choose which canvas/scenario to run from within the plugin panel via a dropdown or similar UX — without having to close the panel and invoke the command again on a different canvas.
**Plans:** 2/2 plans complete

### Phase 999.2: Full-tab runner view (BACKLOG)

**Goal:** Open the protocol runner as a full editor tab (like a new note) instead of a sidebar panel — full-width layout for better readability and UX.
**Plans:** 0 plans

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffold and Canvas Parsing Foundation | v1.0 | 6/6 | Complete | 2026-04-06 |
| 2. Core Protocol Runner Engine | v1.0 | 3/3 | Complete | 2026-04-06 |
| 3. Runner UI (ItemView) | v1.0 | 5/5 | Complete | 2026-04-06 |
| 4. Canvas Node Editor Side Panel | v1.0 | 3/3 | Complete | 2026-04-06 |
| 5. Dynamic Snippets | v1.0 | 5/5 | Complete | 2026-04-06 |
| 6. Loop Support | v1.0 | 3/3 | Complete | 2026-04-07 |
| 7. Mid-Session Save and Resume | v1.0 | 3/3 | Complete | 2026-04-07 |
| 12. Runner Layout Overhaul | v1.2 | 2/2 | Complete | 2026-04-08 |
| 13. Sidebar Canvas Selector and Run Again | v1.2 | 2/2 | Complete | 2026-04-08 |
| 14. Node Editor Auto-Switch and Unsaved Guard | v1.2 | 1/1 | Complete | 2026-04-09 |
| 15. Text Separator Setting | v1.2 | 2/2 | Complete | 2026-04-09 |
| 16. Runner Textarea Edit Preservation | v1.2 | 2/2 | Complete | 2026-04-09 |
| 17. Node Type Read-Back and Snippet Placeholder Fixes | v1.2 | 2/2 | Complete | 2026-04-09 |
| 18. CSS Gap Fixes (INSERTED) | v1.2 | 1/1 | Complete | 2026-04-10 |
| 19. Phase 12–14 Formal Verification | v1.2 | 3/3 | Complete | 2026-04-10 |
| 20. Housekeeping Removals | v1.3 | 0/? | Not started | - |
| 21. Color Infrastructure | v1.3 | 2/2 | Complete   | 2026-04-11 |
| 22. Snippet Node — Graph and Runner Layer | v1.3 | 0/3 | In progress | - |
| 23. Node Editor Auto-Save and Color-on-Type-Change | v1.3 | 0/? | Not started | - |
| 24. Settings — Snippet Node Folder | v1.3 | 0/? | Not started | - |
| 25. Snippet Node Runner UI | v1.3 | 0/? | Not started | - |
| 26. Auto-Switch to Node Editor Tab | v1.3 | 0/? | Not started | - |
| 27. Interactive Placeholder Editor | v1.3 | 0/? | Not started | - |
