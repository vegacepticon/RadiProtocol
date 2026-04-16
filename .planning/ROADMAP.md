# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-16

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1-7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12-19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- ✅ **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28-31 (shipped 2026-04-15)
- ✅ **v1.5 Snippet Editor Refactoring** — Phases 32-35 (shipped 2026-04-16)
- 🚧 **v1.6 Polish & Canvas Workflow** — Phases 36-42 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 Community Plugin Release (Phases 1-7) — SHIPPED 2026-04-07</summary>

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
<summary>✅ v1.2 Runner UX & Bug Fixes (Phases 12-19) — SHIPPED 2026-04-10</summary>

- [x] Phase 12: Runner Layout Overhaul — completed 2026-04-08
- [x] Phase 13: Sidebar Canvas Selector and Run Again — completed 2026-04-08
- [x] Phase 14: Node Editor Auto-Switch and Unsaved Guard — completed 2026-04-09
- [x] Phase 15: Text Separator Setting — completed 2026-04-09
- [x] Phase 16: Runner Textarea Edit Preservation — completed 2026-04-09
- [x] Phase 17: Node Type Read-Back and Snippet Placeholder Fixes — completed 2026-04-09
- [x] Phase 18: CSS Gap Fixes (INSERTED) — completed 2026-04-10
- [x] Phase 19: Phase 12-14 Formal Verification — completed 2026-04-10

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v1.3 Interactive Placeholder Editor (Phase 27) — SHIPPED 2026-04-12</summary>

- [x] Phase 27: Interactive Placeholder Editor (1/1 plans) — completed 2026-04-12

Full details: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 Snippets and Colors, Colors and Snippets (Phases 28-31) — SHIPPED 2026-04-15</summary>

- [x] Phase 28: Auto Node Coloring (2/2 plans) — completed 2026-04-13
- [x] Phase 29: Snippet Node — Model, Editor, Validator (3/3 plans) — completed 2026-04-13
- [x] Phase 30: Snippet Node — Runner Integration (3/3 plans) — completed 2026-04-14
- [x] Phase 31: Mixed Answer + Snippet Branching at Question Nodes (4/4 plans) — completed 2026-04-15

Full details: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Snippet Editor Refactoring (Phases 32-35) — SHIPPED 2026-04-16</summary>

- [x] Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync (5/5 plans) — completed 2026-04-15
- [x] Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher (5/5 plans) — completed 2026-04-15
- [x] Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates (6/6 plans) — completed 2026-04-15
- [x] Phase 35: Markdown Snippets in Protocol Runner (2/2 plans) — completed 2026-04-16

Full details: `.planning/milestones/v1.5-ROADMAP.md`

</details>

### v1.6 Polish & Canvas Workflow (In Progress)

**Milestone Goal:** Clean up dead code, fix UI bugs, add snippet editor improvements, and accelerate canvas authoring with programmatic node creation from the node editor sidebar.

- [x] **Phase 36: Dead Code Audit and Cleanup** — Remove unused TypeScript exports, dead CSS, stale test stubs; fix spacing bug in snippet modal (completed 2026-04-16)
- [x] **Phase 37: Snippet Editor Improvements** — Create folder button in snippet editor header; canvas path sync on directory rename (UAT gap closure in progress)
- [x] **Phase 38: Canvas Node Creation Infrastructure** — CanvasNodeFactory service with runtime API probing, type extensions, auto-color on created nodes (completed 2026-04-16)
- [x] **Phase 39: Quick-Create UI in Node Editor** — Toolbar buttons to create question and answer nodes from the sidebar (completed 2026-04-16)
- [ ] **Phase 40: Node Duplication** — Duplicate selected node with all RadiProtocol properties preserved
- [ ] **Phase 41: Live Canvas Update on Folder Rename** — Use canvasLiveEditor Pattern B to update snippet node text in real-time during folder rename
- [ ] **Phase 42: Snippet Node Quick-Create Button & Double-Click Node Selection Fix** — Add "Create snippet node" button; fix double-click-created nodes not loading in editor panel

---

## Phase Details

### Phase 36: Dead Code Audit and Cleanup
**Goal**: The codebase is clean — all unused exports, dead CSS rules, and stale test stubs are removed; the spacing bug in the snippet modal is fixed
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. Running Knip (or equivalent dead code analysis) against the project reports zero unused TypeScript exports or functions that are not Obsidian callback registrations
  2. All dead CSS rules (including `.rp-legend*` and any other orphaned selectors) are removed and `npm run build` produces a clean `styles.css`
  3. The 3 RED test stubs in `runner-extensions.test.ts` (Phase 26 legacy) are either implemented or removed
  4. The snippet create/edit modal displays "Тип JSON" with a space between the Cyrillic word and "JSON" (not "ТипJSON")
  5. Full test suite (`npm test`) passes after all removals with zero regressions
**Plans**: 2 plans
Plans:
- [x] 36-01-PLAN.md — Dead code audit: Knip analysis, unused TS export removal, dead CSS removal, RED test stub removal
- [x] 36-02-PLAN.md — Fix spacing bug in snippet create/edit modal type row

### Phase 37: Snippet Editor Improvements
**Goal**: Users can create folders directly from the snippet editor header, and renaming a directory in the snippet editor automatically updates all canvas SnippetNode references
**Depends on**: Phase 36
**Requirements**: CLEAN-03, SYNC-01
**Success Criteria** (what must be TRUE):
  1. A "Create folder" button is visible next to the "Create snippet" button in the snippet editor header bar
  2. Clicking the "Create folder" button prompts for a folder name, creates the folder under `.radiprotocol/snippets/`, and the folder appears in the tree without manual refresh
  3. Renaming a directory in the snippet editor tree updates every canvas file's SnippetNode `subfolderPath` that referenced the old directory name
  4. After a directory rename, opening a canvas that had SnippetNodes pointing to the old path correctly resolves snippets from the new path
**Plans**: 2 plans
Plans:
- [x] 37-01-PLAN.md — Add "Create folder" header button, verify SYNC-01 existing coverage
- [x] 37-02-PLAN.md — Gap fix: sync canvas node text field on folder rename (SYNC-01)
**UI hint**: yes

### Phase 38: Canvas Node Creation Infrastructure
**Goal**: A CanvasNodeFactory service exists that can programmatically create typed RadiProtocol nodes on an open canvas with correct properties, auto-color, and position offset
**Depends on**: Phase 36
**Requirements**: CANVAS-01, CANVAS-04, CANVAS-05
**Success Criteria** (what must be TRUE):
  1. `CanvasNodeFactory` can create a text node on the active canvas via Pattern B (`createTextNode` internal API) with runtime API probing — if the API is unavailable, the user sees a clear Notice explaining the limitation
  2. Newly created nodes receive the correct `radiprotocol_nodeType` property and the matching auto-color from the node coloring system (Phase 28)
  3. When no canvas is open, attempting to create a node shows a clear Obsidian Notice telling the user to open a canvas first
  4. Created nodes are positioned adjacent to the selected node (offset by width+gap) without overlapping existing nodes
  5. The `canvas-internal.d.ts` type declarations are extended to cover `createTextNode`, `CanvasNodeInternal`, and the `nodes` map
**Plans**: 2 plans
Plans:
- [x] 38-01-PLAN.md — TDD: Type extensions + CanvasNodeFactory service with unit tests
- [x] 38-02-PLAN.md — Wire CanvasNodeFactory into plugin lifecycle (main.ts)

### Phase 39: Quick-Create UI in Node Editor
**Goal**: Users can create new question and answer nodes directly from the node editor sidebar with one click
**Depends on**: Phase 38
**Requirements**: CANVAS-02, CANVAS-03
**Success Criteria** (what must be TRUE):
  1. The node editor sidebar shows a "Create question node" button that creates a new question node on the canvas adjacent to the currently selected node
  2. The node editor sidebar shows a "Create answer node" button that creates a new answer node linked to the current question node on the canvas
  3. After creating a node, the new node is automatically loaded in the editor panel for immediate editing
  4. Quick-create buttons are disabled (or hidden) with a tooltip/notice when no canvas is open
**Plans**: 1 plan
Plans:
- [x] 39-01-PLAN.md — Quick-create toolbar buttons + unit tests + CSS
**UI hint**: yes

### Phase 40: Node Duplication
**Goal**: Users can duplicate any selected canvas node with all RadiProtocol properties preserved, positioned adjacent to the original
**Depends on**: Phase 38
**Requirements**: DUP-01, DUP-02
**Success Criteria** (what must be TRUE):
  1. User can duplicate the currently selected canvas node — the copy appears on the canvas with a new ID and offset position
  2. The duplicated node preserves all `radiprotocol_*` properties (nodeType, separator, subfolderPath, snippetLabel, etc.) from the original
  3. The duplicated node does NOT copy any edges — the user draws connections manually
  4. After duplication, the new node is loaded in the editor panel for immediate editing
**Plans**: 1 plan
Plans:
- [ ] 40-01-PLAN.md — Duplicate button + onDuplicate method + property copy + unit tests
**UI hint**: yes

### Phase 41: Live Canvas Update on Folder Rename

**Goal:** Use `canvasLiveEditor.saveLive()` Pattern B path (same as Node Editor) to update snippet node `text` field in real-time when a folder is renamed, instead of requiring canvas to be closed
**Requirements**: TBD
**Depends on:** Phase 40
**Plans:** 2/2 plans complete

Plans:
- [ ] TBD (run /gsd-plan-phase 41 to break down)

### Phase 42: Snippet Node Quick-Create Button & Double-Click Node Selection Fix
**Goal**: Add a "Create snippet node" quick-create button alongside existing question/answer buttons; fix double-click-created nodes not loading in editor panel
**Depends on**: Phase 39
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. The node editor sidebar shows a "Create snippet node" button alongside existing "Create question node" and "Create answer node" buttons
  2. When a node is created by double-clicking on the canvas and then selected, the editor panel loads the node correctly (no "Node not found in canvas" error)
  3. Selecting a freshly double-click-created empty node opens the editor panel with node type selection
**Plans**: 0 plans
Plans:
- [ ] TBD (run /gsd-plan-phase 42 to break down)
**UI hint**: yes

---

## Progress

**Execution Order:**
Phases execute in numeric order: 36 -> 37 -> 38 -> 39 -> 40 -> 41 -> 42

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 28/28 | Complete | 2026-04-07 |
| 12-19 | v1.2 | 15/15 | Complete | 2026-04-10 |
| 27 | v1.3 | 1/1 | Complete | 2026-04-12 |
| 28-31 | v1.4 | 12/12 | Complete | 2026-04-15 |
| 32-35 | v1.5 | 18/18 | Complete | 2026-04-16 |
| 36. Dead Code Audit and Cleanup | v1.6 | 2/2 | Complete    | 2026-04-16 |
| 37. Snippet Editor Improvements | v1.6 | 2/2 | Complete   | 2026-04-16 |
| 38. Canvas Node Creation Infrastructure | v1.6 | 2/2 | Complete    | 2026-04-16 |
| 39. Quick-Create UI in Node Editor | v1.6 | 2/2 | Complete   | 2026-04-16 |
| 40. Node Duplication | v1.6 | 0/1 | Not started | - |
| 41. Live Canvas Update on Folder Rename | v1.6 | 0/? | Not started | - |
| 42. Snippet Node Quick-Create & Double-Click Fix | v1.6 | 0/? | Not started | - |
