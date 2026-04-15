# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-13

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12–19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- 🔄 **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28–30 (active)

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

<details>
<summary>✅ v1.3 Interactive Placeholder Editor (Phase 27) — SHIPPED 2026-04-12</summary>

- [x] Phase 27: Interactive Placeholder Editor (1/1 plans) — completed 2026-04-12

Full details: `.planning/milestones/v1.3-ROADMAP.md`

</details>

### v1.4 Snippets and Colors, Colors and Snippets (Phases 28–30) — ACTIVE

- [x] **Phase 28: Auto Node Coloring** — Color written on every save via EditorPanel (both paths) and programmatic canvas creation (completed 2026-04-13)
- [x] **Phase 29: Snippet Node — Model, Editor, Validator** — 8th node kind in parser/model; EditorPanel subfolder picker form; GraphValidator check (completed 2026-04-13)
- [ ] **Phase 30: Snippet Node — Runner Integration** — Runner folder picker UI, state machine extension, SnippetFillInModal wiring, terminal/non-terminal behavior

---

## Phase Details

### Phase 28: Auto Node Coloring
**Goal**: Saving any node type always writes the correct color to the canvas node, regardless of prior state
**Depends on**: Nothing new (extends existing EditorPanel + canvas write paths)
**Requirements**: NODE-COLOR-01, NODE-COLOR-02, NODE-COLOR-03
**Success Criteria** (what must be TRUE):
  1. User saves a node via EditorPanel with canvas open (Pattern B) and the node's color immediately reflects its type
  2. User saves a node via EditorPanel with canvas closed (Strategy A) and the written canvas JSON contains the correct color field
  3. User saves a node that already had a different color set — the color is overwritten to match the current node type
  4. Programmatically created test canvases include the correct color field for every node based on its radiprotocol_nodeType
**Plans**: 2 plans
Plans:
- [x] 28-00-PLAN.md — Wave 0: тест-инфраструктура (обновить контракт + makeCanvasNode helper)
- [x] 28-01-PLAN.md — Wave 1: инъекция цвета в saveNodeEdits (Pattern B + Strategy A)

### Phase 29: Snippet Node — Model, Editor, Validator
**Goal**: The snippet node type exists as a first-class 8th node kind that authors can configure in EditorPanel with a subfolder path
**Depends on**: Phase 28 (color will be applied to snippet nodes automatically)
**Requirements**: SNIPPET-NODE-01, SNIPPET-NODE-02, SNIPPET-NODE-08
**Success Criteria** (what must be TRUE):
  1. CanvasParser recognizes radiprotocol_nodeType = "snippet" and produces a typed SnippetNode in the graph model
  2. EditorPanel shows a dedicated form for snippet nodes with a subfolder picker that lets the user browse and select a path under .radiprotocol/snippets/
  3. Saving a snippet node via EditorPanel writes radiprotocol_nodeType = "snippet" and the configured subfolder path to the canvas JSON
  4. Missing subfolderPath is valid — absence means root fallback at runtime (D-12 supersedes success criterion 4)
**Plans**: 3 plans
Plans:
- [x] 29-00-PLAN.md — Wave 0: TDD fixtures + failing tests для парсера и валидатора
- [x] 29-01-PLAN.md — Wave 1: graph-model + node-color-map + canvas-parser + graph-validator
- [x] 29-02-PLAN.md — Wave 2: EditorPanel subfolder picker form (buildKindForm case snippet)

### Phase 30: Snippet Node — Runner Integration
**Goal**: A radiologist running a protocol that hits a snippet node can browse and select a snippet from the configured folder, fill in any placeholders, and have the result appended to the report
**Depends on**: Phase 29 (snippet node type must exist in graph model)
**Requirements**: SNIPPET-NODE-03, SNIPPET-NODE-04, SNIPPET-NODE-05, SNIPPET-NODE-06, SNIPPET-NODE-07
**Success Criteria** (what must be TRUE):
  1. Runner presents a list of snippets from the snippet node's configured subfolder when the state machine reaches a snippet node
  2. User can navigate into subfolders within the configured folder to find snippets nested deeper
  3. Selecting a snippet that has placeholders opens SnippetFillInModal; after confirmation the filled text is appended to the protocol textarea
  4. Selecting a snippet with no placeholders appends its text directly to the protocol textarea without opening any modal
  5. After snippet insertion, a snippet node with outgoing edges advances to the next node; a snippet node with no outgoing edges terminates the protocol
**Plans**: 3 plans
Plans:
- [x] 30-01-PLAN.md — SnippetService.listFolder + path safety (D-18..D-21, T-30-01)
- [x] 30-02-PLAN.md — Runner state machine: awaiting-snippet-pick + pickSnippet + session support (D-06..D-12, D-22, D-23)
- [ ] 30-03-PLAN.md — RunnerView picker rendering + CSS + UAT (D-01..D-05, D-09, D-13..D-17)
**UI hint**: yes

---

## Backlog

### Phase 999.1: Canvas selector dropdown in runner view (BACKLOG)

**Goal:** Let users choose which canvas/scenario to run from within the plugin panel via a dropdown or similar UX — without having to close the panel and invoke the command again on a different canvas.
**Plans:** 2/3 plans executed

### Phase 999.2: Full-tab runner view (BACKLOG)

**Goal:** Open the protocol runner as a full editor tab (like a new note) instead of a sidebar panel — full-width layout for better readability and UX.
**Plans:** 0 plans

### Phase 999.3: Mixed answer+snippet branching at question nodes (BACKLOG)

**Goal:** Allow a question node to have outgoing edges to both answer nodes and snippet nodes simultaneously. The runner presents all branches side-by-side as selectable options at the question step. Picking an answer inserts the answer text (current behavior); picking a snippet opens the snippet picker/fill-in modal and inserts only that snippet's rendered text into the accumulator. Today snippet nodes must be chained after an answer, which forces one snippet per branch and is inflexible. Captured from Phase 30 UAT.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

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
| 27. Interactive Placeholder Editor | v1.3 | 1/1 | Complete | 2026-04-12 |
| 28. Auto Node Coloring | v1.4 | 2/2 | Complete   | 2026-04-13 |
| 29. Snippet Node — Model, Editor, Validator | v1.4 | 3/3 | Complete   | 2026-04-13 |
| 30. Snippet Node — Runner Integration | v1.4 | 2/3 | In Progress|  |
