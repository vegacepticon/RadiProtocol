# Milestones

## v1.5 Snippet Editor Refactoring (Shipped: 2026-04-16)

**Phases completed:** 4 phases (32–35), 18 plans
**Timeline:** 2026-04-15 → 2026-04-16 (2 days)
**Git:** 73 commits, 90 files changed, +19518/-1034 LOC

**Key accomplishments:**

- Phase 32: SnippetService refactored — `Snippet = JsonSnippet | MdSnippet` discriminated union, `listFolder`/`load`/`save`/`delete` extension routing, `vault.trash()` delete, `rewriteCanvasRefs` vault-wide canvas reference sync utility with WriteMutex (MD-05, DEL-01)
- Phase 33: SnippetManagerView rewritten as recursive folder tree — SnippetEditorModal (unified create/edit, JSON↔MD toggle, folder dropdown, D-09 move-on-save pipeline, unsaved-changes guard), folder CRUD (create/delete with contents listing), vault watcher (create/delete/rename events with 120ms debounce + prefix filter) — 20 requirements satisfied (TREE-01..04, MODAL-01..08, FOLDER-01..03, SYNC-01..03, DEL-02..03)
- Phase 34: Drag-and-drop + context menu "Move to…" + modal folder field for snippet/folder reorganization; F2/context-menu inline rename for files and folders; all move/rename operations auto-rewrite SnippetNode `subfolderPath` in every Canvas via `rewriteCanvasRefs` — UAT approved by Роман (MOVE-01..05, RENAME-01..03)
- Phase 35: `.md` snippets in Protocol Runner picker with glyph prefix differentiation; click-to-insert inserts content verbatim without fill-in modal; works in subfolder drill-down and mixed answer+snippet branching — 7/7 verification truths passed (MD-01..04)
- All 34 v1.5 requirements satisfied; milestone audit passed with tech_debt status (no blockers); 5/5 cross-phase E2E flows verified; 20/20 integration points connected
- Known deferred items: Node Editor stale subfolderPath display (cosmetic), chip editor English labels (Phase 27 legacy), 3 Phase 26 RED test stubs, Nyquist validation draft for all 4 phases

**Archive:** `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-REQUIREMENTS.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.4 Snippets and Colors, Colors and Snippets (Shipped: 2026-04-15)

**Phases completed:** 4 phases (28–31), 12 plans
**Timeline:** 2026-04-13 → 2026-04-15 (3 days)
**Git:** 54 commits, 66 files changed, +8753/-110 LOC (`46656af` → `d6c6280`)

**Key accomplishments:**

- Phase 28: Auto node coloring — single injection point in `saveNodeEdits` writes the correct canvas color on every save across both Pattern B (canvas open) and Strategy A (canvas closed) paths; test helper `makeCanvasNode` auto-derives color from `radiprotocol_nodeType` (NODE-COLOR-01/02/03)
- Phase 29: Snippet node model — 8th node kind in discriminated union; canvas-parser recognizes `radiprotocol_nodeType = "snippet"`; graph-validator warns on missing subfolder path; EditorPanel form with BFS-based subfolder picker under `.radiprotocol/snippets/` (SNIPPET-NODE-01/02/08)
- Phase 30: Runner snippet integration — new `awaiting-snippet-pick` runner state, `ProtocolRunner.pickSnippet()` routing into the existing fill-in flow, session serialize/restore support, `SnippetService.listFolder` with pre-I/O path-safety gate (rejects `..`, absolute paths, sibling-prefix matches), RunnerView picker with subfolder drill-down (SNIPPET-NODE-03/04/05/06/07)
- Phase 31: Mixed answer + snippet branching — question nodes can route to both answer and snippet nodes simultaneously; `chooseSnippetBranch` runner API with undo-before-mutate and `returnToBranchList` flag; per-node `snippetLabel` + separator override editable in Node Editor; RunnerView partitions branches into two render loops
- All 11 v1.4 requirements satisfied; milestone audit re-passed after Phase 30 retroactive verification + Phase 29 live-vault UAT closure + Phase 31 UAT 5/5
- Known deferred tech debt: Nyquist VALIDATION.md still in draft for phases 28–31 (matches existing v1.2 retroactive-Nyquist backlog entry)

**Archive:** `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`, `.planning/milestones/v1.4-MILESTONE-AUDIT.md`, `.planning/milestones/v1.4-phases/`

---

## v1.3 Interactive Placeholder Editor (Shipped: 2026-04-12)

**Phases completed:** 1 phase (27), 1 plan  
**Timeline:** 2026-04-12 (single day, ~3.5 hours)  
**Git:** 17 commits, 2 source files, +266 lines (snippet-manager-view.ts +172, styles.css +94)

**Key accomplishments:**

- Phase 27: Replaced expandable row list with chip-based placeholder UI — type-coloured left bar (PH_COLOR), human-readable label, type badge, drag handle, remove button (CHIP-01)
- Phase 27: HTML5 native drag-and-drop reorder with 6-event DnD per chip, correct splice pattern, dragleave child-flicker guard (CHIP-02)
- Phase 27: `autoSaveAfterDrop()` persists reordered array via `snippetService.save()` — SnippetFillInModal tab order follows persisted order at zero modal changes (CHIP-03)
- Phase 27: UUID guard in `autoSaveAfterDrop()` prevents saving unsaved drafts; 25 automated Vitest tests cover DnD guard conditions, splice algorithm, and UUID guard
- Code review found 5 issues (WR-01–05); all fixed and verified; 5/5 UAT passed in live Obsidian

**Archive:** `.planning/milestones/v1.3-ROADMAP.md`, `.planning/milestones/v1.3-MILESTONE-AUDIT.md`

---

## v1.2 Runner UX & Bug Fixes (Shipped: 2026-04-10)

**Phases completed:** 8 phases (12–19), 11 plans  
**Timeline:** 2026-04-07 → 2026-04-10 (3 days)  
**Git:** ~200 commits, ~7K LOC TypeScript in src/

**Key accomplishments:**

- Phase 12: Redesigned RunnerView layout — auto-grow textarea, correct zone ordering, equal-size buttons, legend removed (LAYOUT-01–04)
- Phase 13: Canvas selector widget in sidebar + Run Again button after protocol completion (SIDEBAR-01, RUNNER-01)
- Phase 14: Click-to-load node auto-switch in EditorPanel + unsaved edit guard modal (EDITOR-01, EDITOR-02)
- Phase 15–16: Global + per-node text separator settings; manual textarea edits preserved across step advances (SEP-01, SEP-02, BUG-01)
- Phase 17: Fixed free-text-input/text-block node type read-back when canvas open; fixed Add button in snippet placeholder mini-form (BUG-02, BUG-03, BUG-04)
- Phase 18–19: Closed 3 CSS styling gaps; wrote retroactive VERIFICATION.md for Phases 12–14; 8/8 UAT passed in live Obsidian

**Archive:** `.planning/milestones/v1.2-ROADMAP.md`, `.planning/milestones/v1.2-MILESTONE-AUDIT.md`

---

## v1.0 Community Plugin Release (Shipped: 2026-04-07)

**Phases completed:** 7 phases, 28 plans  
**Timeline:** 2026-04-05 → 2026-04-07 (3 days)  
**Git:** 158 commits, 167 files, ~43K LOC

**Key accomplishments:**

- Phase 1: Plugin scaffold with esbuild, strict TypeScript, hot-reload dev script, and full ESLint flat config (23 obsidianmd rules) — all 14 tests green
- Phase 2: Pure traversal state machine with discriminated union (5 states), TextAccumulator with snapshot undo, ProtocolRunner covering all node types and iteration cap — all runner tests green
- Phase 3: End-to-end RunnerView ItemView — two-zone live preview layout, all question types rendered, copy/save output, NodePickerModal, main.ts fully wired — UAT approved on all 13 checks
- Phase 4: EditorPanelView side panel with per-node forms for all 7 node kinds, canvas write-back with closed-canvas guard, context menu integration — UAT approved, all 7 tests passed
- Phase 5: Full snippet system — SnippetService CRUD, WriteMutex, SnippetManagerView master-detail UI, SnippetFillInModal with live preview, runner awaiting-snippet-fill integration — UAT approved
- Phase 6: Loop engine with LoopContext stack, undo across loop boundaries, RunnerView loop-end UI with iteration label and loop again/done buttons — 3-lesion protocol confirmed end-to-end
- Phase 7: SessionService auto-save/resume, ResumeSessionModal, canvas mtime check, snippet content snapshot, Set→Array serialization, onLayoutReady deferral fix — all SESSION requirements verified

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
