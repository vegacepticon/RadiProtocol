# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-15

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12–19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- ✅ **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28–31 (shipped 2026-04-15)
- 🔄 **v1.5 Snippet Editor Refactoring** — Phases 32–35 (in progress — 3/4 phases complete)

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

<details>
<summary>✅ v1.4 Snippets and Colors, Colors and Snippets (Phases 28–31) — SHIPPED 2026-04-15</summary>

- [x] Phase 28: Auto Node Coloring (2/2 plans) — completed 2026-04-13
- [x] Phase 29: Snippet Node — Model, Editor, Validator (3/3 plans) — completed 2026-04-13
- [x] Phase 30: Snippet Node — Runner Integration (3/3 plans) — completed 2026-04-14
- [x] Phase 31: Mixed Answer + Snippet Branching at Question Nodes (4/4 plans) — completed 2026-04-15

Full details: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details open>
<summary>🔄 v1.5 Snippet Editor Refactoring (Phases 32–35) — IN PROGRESS</summary>

- [x] **Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync** — completed 2026-04-15
- [x] **Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher** — completed 2026-04-15
- [x] **Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates** — completed 2026-04-15 (UAT approved by Роман)
- [ ] **Phase 35: Markdown Snippets in Protocol Runner** — `.md` files in picker, as-is insertion, mixed branching compatible

### Phase Details

### Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync
**Goal**: SnippetService exposes a folder-tree data model, recognizes `.md` snippets as a first-class type, deletes via `vault.trash()`, and ships a vault-wide utility that rewrites Canvas `SnippetNode.subfolderPath` references when a snippet folder is renamed or moved.
**Depends on**: Phase 31 (SnippetNode model and references)
**Requirements**: MD-05, DEL-01
**Success Criteria** (what must be TRUE):
  1. `SnippetService.listFolder()` returns entries discriminated by extension — JSON snippets with placeholders vs MD snippets with raw content (MD-05).
  2. `SnippetService.load()` returns the correct typed model (`JsonSnippet` vs `MdSnippet`) based on file extension (MD-05).
  3. Calling the new delete method removes a snippet via `vault.trash()` (Obsidian trash, not permanent delete) and the file disappears from the vault (DEL-01).
  4. A Canvas-reference-sync utility can scan every `.canvas` in the vault and rewrite SnippetNode `subfolderPath` references (D-07 — SnippetNode does not store a filename field) given an old → new folder-path mapping, without corrupting other node data.
  5. Unit tests cover extension routing, trash delete, and the Canvas rewrite utility with single- and multi-canvas fixtures.
**Plans**: 5 plans
  - [x] 32-00-PLAN.md — snippet-model: Snippet = JsonSnippet | MdSnippet discriminated union
  - [x] 32-01-PLAN.md — SnippetService API refactor: listFolder / load / save / delete(path) / exists + assertInsideRoot + vault.trash
  - [x] 32-02-PLAN.md — canvas-ref-sync module: rewriteCanvasRefs(app, mapping) with prefix match + WriteMutex + best-effort
  - [x] 32-03-PLAN.md — Callsite updates (runner-view, snippet-fill-in-modal, snippet-manager-view) minimal build-fixing only
  - [x] 32-04-PLAN.md — Test suite: snippet-service extension routing / trash / path-safety + canvas-ref-sync fixtures
**UI hint**: no

### Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher
**Goal**: SnippetManagerView is a folder-tree view. Snippets are created and edited in a modal with JSON/Markdown type toggle. Folders can be created, deleted, and quickly populated. The tree stays in sync with the vault when files change from outside.
**Depends on**: Phase 32
**Requirements**: TREE-01, TREE-02, TREE-03, TREE-04, MODAL-01, MODAL-02, MODAL-03, MODAL-04, MODAL-05, MODAL-06, MODAL-07, MODAL-08, FOLDER-01, FOLDER-02, FOLDER-03, SYNC-01, SYNC-02, SYNC-03, DEL-02, DEL-03
**Success Criteria** (what must be TRUE):
  1. Opening SnippetManagerView shows a collapsible folder tree rooted at `.radiprotocol/snippets/`; each file shows its type indicator (JSON/MD); empty folders render explicitly; the old master-detail layout is gone (TREE-01/02/04).
  2. Clicking a file opens the edit modal; clicking "+ New" (global or per-folder hover button) opens the create modal with the target folder pre-filled and a JSON/Markdown type toggle; JSON mode shows the v1.3 chip editor, MD mode shows an inline textarea; closing with unsaved changes prompts a guard (TREE-03, MODAL-01..08, FOLDER-03).
  3. Context menu on a folder offers "New subfolder" and "Delete folder" — delete prompts with a list of contents before confirming (FOLDER-01, FOLDER-02).
  4. Deleting a snippet prompts a confirm modal showing the name, then the file disappears from both the tree and the Protocol Runner snippet picker on next open (DEL-02, DEL-03).
  5. Creating, renaming, or deleting a file in `.radiprotocol/snippets/` from outside the view (e.g., from Obsidian file explorer) causes the tree to redraw; events from other vault paths are ignored; the watcher is torn down in `onClose()` (SYNC-01..03).
**Plans**: 5 plans
  - [x] 33-01-PLAN.md — SnippetService folder ops (createFolder/deleteFolder/listFolderDescendants) + settings.snippetTreeExpandedPaths + Wave 0 test stubs
  - [x] 33-02-PLAN.md — Extract chip editor into snippet-chip-editor.ts + generic ConfirmModal (2/3-button variants)
  - [x] 33-03-PLAN.md — SnippetEditorModal (unified create/edit, JSON↔MD toggle, «Папка» dropdown, D-09 move-on-save → rewriteCanvasRefs, unsaved-changes guard, collision pre-flight)
  - [x] 33-04-PLAN.md — Rewrite SnippetManagerView as folder-tree ItemView (context menus, hover + New, vault watcher 120ms debounced redraw, expand-state persistence, tree+modal CSS)
  - [x] 33-05-PLAN.md — Full suite + build gates + human verification checkpoint (44-step UAT in a real Obsidian vault)
**UI hint**: yes

### Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates — COMPLETE
**Goal**: Users can reorganize snippets and folders by dragging, via "Move to…" context menu, or via the modal folder field. Inline rename works via F2 and context menu. Every rename and move automatically rewrites the matching SnippetNode references in every Canvas in the vault.
**Depends on**: Phase 33
**Requirements**: MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, RENAME-01, RENAME-02, RENAME-03 — ALL MET
**Success Criteria** (what must be TRUE):
  1. Dragging a snippet file onto a folder in the tree moves it in the vault; dragging a folder onto another folder moves the whole subtree (MOVE-01, MOVE-02). ✅
  2. Context menu on a snippet or folder offers "Move to…" which opens a folder picker; the edit modal's "Папка" field moves the snippet on save (MOVE-03, MOVE-04). ✅
  3. Pressing F2 on a snippet or folder (or using context-menu "Rename") enters inline rename; pressing Enter commits, Escape cancels (RENAME-01, RENAME-02). ✅
  4. After any move or rename, all `.canvas` files in the vault that reference the affected SnippetNode(s) are updated so their `subfolderPath`/filename match the new location; opening one of those canvases in the runner resolves the snippet without error (MOVE-05, RENAME-03). ✅
  5. Moves and renames across nested subfolders preserve snippet content byte-for-byte and survive an Obsidian reload. ✅
**Plans**: 6 plans (00..05)
  - [x] 34-00-PLAN.md — SnippetService move/rename API + toCanvasKey helper
  - [x] 34-01-PLAN.md — FolderPickerModal + «Переместить в…» context menu flow
  - [x] 34-02-PLAN.md — HTML5 drag-and-drop lifecycle on snippet tree rows + CSS
  - [x] 34-03-PLAN.md — F2 inline rename for files and folders
  - [x] 34-04-PLAN.md — Atomic moveSnippet in modal move-on-save, remove canvas-sync placebo
  - [x] 34-05-PLAN.md — Full gates + UAT checklist + human verify (UAT approved 2026-04-15 after post-UAT fixes 77b62c1, fd0d50d)
**UAT:** Approved 2026-04-15 by Роман.
**Follow-up (non-blocking):** Node Editor panel stale `subfolderPath` display after folder move/rename — cosmetic panel-refresh gap in adjacent Node Editor component, see `.planning/phases/34-.../34-VERIFICATION.md` § Follow-up work.
**UI hint**: yes

### Phase 35: Markdown Snippets in Protocol Runner
**Goal**: `.md` snippets appear in the Runner snippet picker alongside `.json` snippets, insert their content as-is without a fill-in modal, and work transparently inside `awaiting-snippet-pick` and mixed answer+snippet branching.
**Depends on**: Phase 32 (service-layer MD support), Phase 34 (reference sync stability)
**Requirements**: MD-01, MD-02, MD-03, MD-04
**Success Criteria** (what must be TRUE):
  1. The Runner snippet picker lists both `.md` and `.json` files in the target folder, with a type indicator so the user can tell them apart (MD-01).
  2. Selecting a `.md` snippet appends its raw file content directly to the accumulated protocol text — no fill-in modal opens — and the runner advances as if the snippet completed normally (MD-02).
  3. `.md` snippets work inside the full `awaiting-snippet-pick` drill-down (subfolder navigation, step-back) exactly like JSON snippets (MD-03).
  4. A question node with mixed answer + snippet branches (Phase 31 flow) can route to a `.md` snippet branch; selecting it inserts content and follows any terminal/non-terminal edge from the snippet node (MD-04).
  5. Session save/resume correctly serializes and restores an in-progress protocol that has already inserted `.md` snippet content.
**Plans**: TBD
**UI hint**: yes

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–7 | v1.0 | 28/28 | Complete | 2026-04-07 |
| 12–19 | v1.2 | 15/15 | Complete | 2026-04-10 |
| 27 | v1.3 | 1/1 | Complete | 2026-04-12 |
| 28. Auto Node Coloring | v1.4 | 2/2 | Complete | 2026-04-13 |
| 29. Snippet Node — Model, Editor, Validator | v1.4 | 3/3 | Complete | 2026-04-13 |
| 30. Snippet Node — Runner Integration | v1.4 | 3/3 | Complete | 2026-04-14 |
| 31. Mixed Answer + Snippet Branching at Question Nodes | v1.4 | 4/4 | Complete | 2026-04-15 |
| 32. SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync | v1.5 | 5/5 | Complete | 2026-04-15 |
| 33. Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher | v1.5 | 5/5 | Complete | 2026-04-15 |
| 34. Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates | v1.5 | 6/6 | Complete | 2026-04-15 |
| 35. Markdown Snippets in Protocol Runner | v1.5 | 0/0 | Not started | — |
