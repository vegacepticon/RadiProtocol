# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-18

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1-7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12-19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- ✅ **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28-31 (shipped 2026-04-15)
- ✅ **v1.5 Snippet Editor Refactoring** — Phases 32-35 (shipped 2026-04-16)
- ✅ **v1.6 Polish & Canvas Workflow** — Phases 36-42 (shipped 2026-04-17)
- ✅ **v1.7 Loop Rework & Regression Cleanup** — Phases 43-46 (shipped 2026-04-18)

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

<details>
<summary>✅ v1.6 Polish & Canvas Workflow (Phases 36-42) — SHIPPED 2026-04-17</summary>

- [x] Phase 36: Dead Code Audit and Cleanup (2/2 plans) — completed 2026-04-16
- [x] Phase 37: Snippet Editor Improvements (2/2 plans) — completed 2026-04-16
- [x] Phase 38: Canvas Node Creation Infrastructure (2/2 plans) — completed 2026-04-16
- [x] Phase 39: Quick-Create UI in Node Editor (2/2 plans) — completed 2026-04-16
- [x] Phase 40: Node Duplication (1/1 plans) — completed 2026-04-16
- [x] Phase 41: Live Canvas Update on Folder Rename (1/1 plans) — completed 2026-04-16
- [x] Phase 42: Snippet Node Quick-Create Button & Double-Click Node Selection Fix (4/4 plans) — completed 2026-04-17

Full details: `.planning/milestones/v1.6-ROADMAP.md`

</details>

<details>
<summary>✅ v1.7 Loop Rework & Regression Cleanup (Phases 43-46) — SHIPPED 2026-04-18</summary>

- [x] Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors (7/7 plans) — completed 2026-04-17
- [x] Phase 44: Unified Loop Runtime (5/5 plans) — completed 2026-04-17
- [x] Phase 45: Loop Editor Form, Picker & Color Map (3/3 plans) — completed 2026-04-18
- [x] Phase 46: Free-Text-Input Removal (3/3 plans) — completed 2026-04-18

Full details: `.planning/milestones/v1.7-ROADMAP.md`

</details>

---

## Phase Details

<details>
<summary>Archived phase details (v1.0–v1.7) — see milestone archives for full context</summary>

### Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors
**Goal**: The canvas format, graph model, parser, and validator all speak the new unified `loop` node — and any canvas that still uses the old `loop-start`/`loop-end` pair is clearly rejected with rebuild instructions before the runner is touched.
**Depends on**: Nothing (foundation for all later v1.7 phases)
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, MIGRATE-01, MIGRATE-02
**Success Criteria** (what must be TRUE):
  1. Parsing a canvas whose `radiprotocol_nodeType = "loop"` yields a `LoopNode` in the graph with its `headerText` populated from the canvas JSON (LOOP-01, LOOP-02, LOOP-03)
  2. Validator surfaces a clear error when a `loop` node is missing its «выход» edge or has no body-branch outgoing edges (LOOP-04)
  3. Opening a canvas that still contains a `loop-start` or `loop-end` node produces a plain-language validator error naming the obsolete node type and instructing the author to rebuild the loop with the unified `loop` node (MIGRATE-01)
  4. The migration error appears in the existing RunnerView error panel using the same layout used for other `GraphValidator` error classes — not in a Notice or console (MIGRATE-02)
**Plans:** 3 plans

Plans:
- [ ] 45-01-node-picker-modal-rewrite-PLAN.md — Extend NodePickerModal to 4 kinds with Russian badges + exhaustive unit tests
- [ ] 45-02-editor-panel-loop-button-and-lockin-PLAN.md — Loop quick-create button + CSS + Phase 44 UAT-fix form lock-in tests
- [ ] 45-03-start-from-node-command-PLAN.md — Register start-from-node command; plumb optional startNodeId through RunnerView + ProtocolRunner

### Phase 44: Unified Loop Runtime
**Goal**: Running a protocol that contains a unified `loop` node produces the agreed single-step picker UX, walks branches correctly, returns to the loop on dead-ends, follows «выход» to leave, preserves nested-loop behaviour, and survives step-back and session restart — all without any iteration cap.
**Depends on**: Phase 43 (needs the `LoopNode` model and validator rules in place)
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07
**Success Criteria** (what must be TRUE):
  1. When the runner reaches a `loop` node the user sees a single picker listing every body-branch edge label plus «выход», rendered underneath the node's `headerText` (RUN-01)
  2. Choosing a body branch walks that branch and — when the branch dead-ends (no outgoing edges) — automatically returns the user to the same loop's picker for another iteration (RUN-02)
  3. Choosing «выход» advances along the «выход» edge and the loop frame is removed from the internal context stack; a nested-loop protocol ends with each outer loop's «выход» still reachable in order (RUN-03, RUN-04)
  4. Step-back from the loop picker restores the node and accumulated text that existed immediately before the loop was entered (RUN-05); closing and reopening Obsidian mid-loop resumes the session at the same picker with the same accumulated text (RUN-06)
  5. No loop run in any canvas is capped by `maxIterations`; the settings tab no longer exposes a "max loop iterations" control and the `LoopStartNode.maxIterations` field no longer exists in the model (RUN-07)
**Plans:** 5/5 plans complete

Plans:
- [x] 44-01-PLAN.md — Wave 0 test scaffolding: nested-loop fixture + protocol-runner-loop-picker.test.ts skeleton
- [x] 44-02a-PLAN.md — Runtime state machine: AwaitingLoopPickState, chooseLoopBranch, dead-end return, B1 re-entry guard, B2 previousCursor threading, session union widening, remove chooseLoopAction stub
- [x] 44-02b-PLAN.md — Test rewrites for the runtime: rewrite 7 skipped loop-support tests, fill protocol-runner-loop-picker.test.ts with RUN-01..05 + W4 long-body integration test
- [x] 44-03-PLAN.md — RunnerView picker UI + Phase 44 CSS + regenerate styles.css + rewrite 7 skipped session round-trip tests
- [x] 44-04-PLAN.md — RUN-07 excision: delete settings.maxLoopIterations, LoopStartNode.maxIterations, parser site, legacy editor-panel forms; keep ProtocolRunner.maxIterations (RUN-09) intact

### Phase 45: Loop Editor Form, Picker & Color Map
**Goal**: Authors can create and edit unified `loop` nodes with the Node Editor and the Start-From-Node picker, and those nodes are coloured consistently on the canvas.
**Depends on**: Phase 43 (needs the `LoopNode` kind in the graph model and parser)
**Requirements**: LOOP-05, LOOP-06
**Success Criteria** (what must be TRUE):
  1. Selecting a `loop` node in the Node Editor shows a form where the author can edit `headerText`; the form contains no `maxIterations` control (LOOP-05)
  2. Saving the Node Editor form writes the updated `headerText` back to the canvas JSON and colours the node with the `loop`-kind colour from `NODE_COLOR_MAP` (LOOP-06)
  3. `NodePickerModal` (Start-From-Node) lists `loop` as a first-class node kind alongside question, answer, snippet, and text-block (LOOP-06)
**Plans:** 3/3 plans complete

Plans:
- [x] 45-01-node-picker-modal-rewrite-PLAN.md — Extend NodePickerModal to 4 kinds with Russian badges + exhaustive unit tests
- [x] 45-02-editor-panel-loop-button-and-lockin-PLAN.md — Loop quick-create button + CSS + Phase 44 UAT-fix form lock-in tests
- [x] 45-03-start-from-node-command-PLAN.md — Register start-from-node command; plumb optional startNodeId through RunnerView + ProtocolRunner

### Phase 46: Free-Text-Input Removal
**Goal**: The `free-text-input` node kind is gone from every layer of the plugin — model, parser, validator, runner, editor, picker, colour map, and test fixtures — restoring the original v1.0 decision after the v1.2 regression.
**Depends on**: Nothing (independent of the loop rework; can run in parallel with Phases 43-45 but scheduled last to keep loop work isolated)
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. The TypeScript graph model no longer exports `FreeTextInputNode` and `free-text-input` is absent from `RPNodeKind`; build is green with no broken imports (CLEAN-01)
  2. Parsing a canvas node whose `radiprotocol_nodeType = "free-text-input"` produces a validator error — it is no longer silently accepted as a runnable node kind (CLEAN-02)
  3. `EditorPanelView`, `NodePickerModal`, `NODE_COLOR_MAP`, and the runner state machine contain no remaining references to `free-text-input`; the Node Editor type dropdown no longer offers it (CLEAN-03)
  4. `src/__tests__/fixtures/free-text.canvas` and every free-text-input-specific test case are removed or rewritten; `npm test` is green with no skipped or orphaned free-text-input tests (CLEAN-04)
**Plans:** 3 plans

Plans:
- [x] 46-01-graph-model-parser-validator-PLAN.md — Excise FreeTextInputNode + RPNodeKind member + parser case arm; parser emits Russian rejection for legacy canvases (CLEAN-01, CLEAN-02)
- [x] 46-02-runner-views-color-map-PLAN.md — TS-exhaustiveness-driven cleanup of runner, views, color map, CSS; deletes enterFreeText method + runner-view render arm + editor-panel form branch (CLEAN-03)
- [x] 46-03-test-cleanup-PLAN.md — Delete free-text-input test scenarios in protocol-runner.test.ts + rewrite picker exclusion test (CLEAN-04)

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 28/28 | Complete | 2026-04-07 |
| 12-19 | v1.2 | 15/15 | Complete | 2026-04-10 |
| 27 | v1.3 | 1/1 | Complete | 2026-04-12 |
| 28-31 | v1.4 | 12/12 | Complete | 2026-04-15 |
| 32-35 | v1.5 | 18/18 | Complete | 2026-04-16 |
| 36-42 | v1.6 | 14/14 | Complete | 2026-04-17 |
| 43 | v1.7 | 7/7 | Complete    | 2026-04-17 |
| 44 | v1.7 | 5/5 | Complete   | 2026-04-17 |
| 45 | v1.7 | 3/3 | Complete | 2026-04-18 |
| 46 | v1.7 | 3/3 | Complete | 2026-04-18 |
