# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-20 (Phase 52 complete)

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1-7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12-19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- ✅ **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28-31 (shipped 2026-04-15)
- ✅ **v1.5 Snippet Editor Refactoring** — Phases 32-35 (shipped 2026-04-16)
- ✅ **v1.6 Polish & Canvas Workflow** — Phases 36-42 (shipped 2026-04-17)
- ✅ **v1.7 Loop Rework & Regression Cleanup** — Phases 43-46 (shipped 2026-04-18)
- ⏳ **v1.8 UX Polish & Snippet Picker Overhaul** — Phases 47-55

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

### v1.8 UX Polish & Snippet Picker Overhaul (Phases 47-53)

- [x] **Phase 47: Runner Regressions** — ✅ Complete. RUNFIX-01/02/03 closed; code review (0 critical), verification, and live UAT all PASS (2026-04-19). RUNFIX-02 revised post-UAT to scroll-to-insertion-point (commit 95e7d0b).
- [ ] **Phase 48: Node Editor UX Polish** — Remove obsolete Snippet ID field, re-anchor new nodes below last, reorder Answer fields, auto-grow Question textarea, relocate quick-create buttons to bottom vertical column
- [x] **Phase 48.1: Toolbar Gap Tighten (INSERTED)** — ✅ Complete. Replaced `margin-top: auto` with `var(--size-4-3)` + overrode `.rp-editor-panel { height: auto }` (Phase 48.1b) to keep the form panel from pushing the toolbar off-screen. Live UAT PASS (2026-04-19). Commits: 25ab41f, f23b841.
- [x] **Phase 49: Loop Exit Edge Convention** — ✅ Complete 2026-04-19. EDGE-01 closed by human UAT (non-«выход» exit label verbatim, D-01/D-02/D-03 error panel text, legacy «выход» canvases regress-free in TEST-BASE). Tests: 466 passed / 0 failed / 1 skipped (+26 vs Phase 48.1 baseline). Zero runtime `edge.label === 'выход'` in src/. gsd-verifier: 11/11 must-haves verified, status `passed`.
- [x] **Phase 50: Answer ↔ Edge Label Sync** — ✅ Complete 2026-04-19. EDGE-02 closed by human UAT PASS (5/5 scenarios in TEST-BASE: canvas-open Pattern B D-14 atomic write, canvas-closed Strategy A single vault.modify, D-04 inbound reconcile with D-07 self-termination, multi-incoming sibling re-sync, clearing symmetry 5a+5b). Tests: 484 passed / 1 skipped / 0 failed (+18 vs Phase 49 baseline). gsd-verifier: 37/37 must-haves verified (commit 62dd212), status `passed`. Follow-up captured as Phase 50.1 (INSERTED).
- [x] **Phase 50.1: Loop Exit `+` Prefix Convention (INSERTED)** — ✅ Complete 2026-04-19. `isExitEdge` redefined to `label.trim().startsWith('+')`; `stripExitPrefix` added; LOOP-04 validator emits 5 locked Russian errors (D-04..D-08); RunnerView exit caption uses `stripExitPrefix`; 10 loop-canvas fixtures migrated/created. EDGE-03 added to REQUIREMENTS.md; EDGE-01 superseded. Tests: 506 passed / 1 skipped / 0 failed (+22 vs Phase 50 baseline). gsd-verifier: 37/37 must-haves verified, status `passed`. UAT PASS in TEST-BASE (3/3 scenarios).
- [ ] **Phase 51: Snippet Picker Overhaul** — Add specific-snippet binding on Snippet nodes + replace flat folder list with unified hierarchical picker (tree drill-down, breadcrumb, tree-wide search)
- [x] **Phase 52: JSON Placeholder Rework** — ✅ Complete 2026-04-20. PHLD-01 closed by UAT PASS 5/5 (D-08 options roundtrip, D-02 separator rename, D-05 unified choice multi-select, D-04 editor banner, D-04 runner error). Tests: 642/1/0. One mid-UAT gap closure applied to chip-editor click handler (latent bug since Phase 33).
- [ ] **Phase 53: BRAT Distribution Readiness** — Align `manifest.json` / `versions.json` / git tags; publish first GitHub Release with `manifest.json` + `main.js` + `styles.css` assets; verify BRAT install end-to-end
- [ ] **Phase 56: Snippet Button UX Reversal** — Откат Phase 51 D-13/D-16: file-bound Snippet всегда рендерится как кнопка + клик даёт прямую вставку (без picker); UI indicators для folder selection в SnippetEditorModal (unsaved marker + button color feedback)

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

### Phase 47: Runner Regressions
**Goal**: Three user-facing runner bugs reported during v1.7 use are closed so manual textarea edits, scroll position, and button typography behave correctly end-to-end.
**Depends on**: Nothing (independent bug-fix cluster scoped to `runner-view.ts` + `src/styles/runner-view.css`)
**Requirements**: RUNFIX-01, RUNFIX-02, RUNFIX-03
**Success Criteria** (what must be TRUE):
  1. Manual textarea edits entered before advancing through a `loop` node survive every loop transition — body-branch entry, «выход»/labeled-exit advance, and dead-end re-entry — with no edit loss, by extending the v1.2 capture-before-advance (BUG-01) pattern to every loop-node state transition (RUNFIX-01)
  2. Clicking a choice button in the Runner preserves the textarea scroll position (or advances to the insertion point); it never snaps back to the top, as verified by inserting content below the visible viewport and re-reading `scrollTop` after the DOM update (RUNFIX-02)
  3. Choice buttons show adequate horizontal and vertical padding plus `line-height` so Cyrillic descenders («р», «у», «ц») and parentheses `(`, `)` render fully inside the button box at every wrap count, verified by rendering a multi-line choice with descender-heavy text (RUNFIX-03)
**Plans:** 3 plans

Plans:
- [x] 47-01-loop-transition-capture-before-advance-PLAN.md — Relax ProtocolRunner.syncManualEdit gate to include awaiting-loop-pick + add RUNFIX-01 regression tests (body-branch, «выход», dead-end, undo) — completed 2026-04-18
- [x] 47-02-choice-click-preserve-scroll-PLAN.md — Capture textarea scrollTop before renderAsync; restore inside renderPreviewZone rAF; wire into all four choice-button click handlers — completed 2026-04-18
- [x] 47-03-choice-button-padding-line-height-PLAN.md — Append Phase 47 CSS blocks to runner-view.css + loop-support.css (padding, line-height: 1.55, min-height: 44px, box-sizing/overflow-wrap revision, height:auto + align-items:flex-start override of Obsidian default button); regenerate styles.css via npm run build; UAT-approved after 2 revisions — completed 2026-04-18

### Phase 48: Node Editor UX Polish
**Goal**: The Node Editor panel presents the forms and quick-create buttons in the agreed cleaner layout — Snippet ID field gone, new-node anchor is vertical, Answer form reads label-first, Question textarea auto-grows, and create buttons form a bottom vertical stack.
**Depends on**: Nothing (all changes land in `editor-panel-view.ts` + `src/styles/editor-panel.css`; independent of phases 47/49–53)
**Requirements**: NODEUI-01, NODEUI-02, NODEUI-03, NODEUI-04, NODEUI-05
**Success Criteria** (what must be TRUE):
  1. Selecting a Text block in the Node Editor shows no "Snippet ID (optional)" input; the Text block save path no longer writes `radiprotocol_snippetId`, and the field is ignored (or removed) if present on existing canvases (NODEUI-01)
  2. Every quick-create button (question, answer, snippet, loop) now positions the new canvas node **below** the anchor node — `CanvasNodeFactory`'s offset is `(0, dy)` rather than `(dx, 0)` — so chained quick-creates produce a vertical tree by default (NODEUI-02)
  3. In the Answer form, "Display label (optional)" renders above "Answer text"; both labels and helper text accompany their inputs in the new order (NODEUI-03)
  4. In the Question form, the "Question text" textarea auto-grows on input, and its label + helper description ("Displayed to the user during the protocol session") stack **above** the textarea so full panel width is available (NODEUI-04)
  5. The `.rp-editor-create-toolbar` is anchored at the bottom of the Node Editor panel and lays out as a single full-width vertical column of four buttons; the v1.6 `flex-wrap` row-wrapping rule is no longer needed because each button is its own row (NODEUI-05)
**Plans:** 2 plans

Plans:
- [x] 48-01-editor-form-ts-core-PLAN.md — Remove Snippet ID row from Text-block form (NODEUI-01), flip CanvasNodeFactory anchor offset from horizontal to vertical (NODEUI-02), swap Answer form Display-label above Answer-text (NODEUI-03), replace Question Setting.addTextArea with custom-DOM auto-growing textarea using runner-view.ts:816-840 scrollHeight pattern (NODEUI-04); add Wave 0 assertions in new editor-panel-forms.test.ts + flip canvas-node-factory.test.ts Test 5
- [ ] 48-02-toolbar-css-bottom-stack-PLAN.md — Move renderToolbar call-site to the end of renderIdle + renderForm so toolbar becomes the last child of contentEl (NODEUI-05); append Phase 48 CSS blocks to src/styles/editor-panel.css (NODEUI-04 rp-question-block visuals + NODEUI-05 flex-direction:column + margin-top:auto override); run npm run build to regenerate styles.css; human-verify checkpoint UAT in TEST-BASE vault
**UI hint**: yes

### Phase 48.1: Toolbar Gap Tighten (INSERTED)
**Goal**: Shrink the large empty vertical gap between the Node Editor form body and the bottom-anchored `.rp-editor-create-toolbar` so the quick-create buttons sit closer to the form content while keeping NODEUI-05 invariants (bottom anchor, full-width column, no wrap on narrow sidebar).
**Depends on**: Phase 48 (touches the same `src/styles/editor-panel.css` Phase 48 NODEUI-05 block + potentially `renderIdle` / `renderForm` call-site in `editor-panel-view.ts`)
**Requirements**: UAT-originated cosmetic follow-up — see `.planning/phases/48-node-editor-ux-polish/48-UAT.md` Gaps section (Test 7 feedback, severity: cosmetic)
**Success Criteria** (what must be TRUE):
  1. In both idle and form states the visual gap between the last form/idle content and the first toolbar button is reduced to a small fixed spacing (approx. `--size-4-3` / `--size-4-4`) instead of the current `margin-top: auto` fill-to-bottom gap
  2. NODEUI-05 invariants are preserved: toolbar is still the last child of the panel's content element (below form fields), remains a full-width vertical column, and does not wrap horizontally on a ~300px-wide sidebar
  3. All 3 existing Phase 48 NODEUI-05 tests in `src/__tests__/editor-panel-forms.test.ts` (DOM-order × 2 + CSS-file-parse × 1) stay green; the CSS-file-parse assertion updates if the CSS rule changes, but the toolbar-after-content ordering and flex-column+nowrap layout assertions stay intact
**Plans**: None — shipped as a direct 2-commit CSS fix (25ab41f Phase 48.1 `margin-top` tighten + f23b841 Phase 48.1b `.rp-editor-panel { height: auto }` form-state fix). UAT pass 2026-04-19.
**UI hint**: yes

### Phase 49: Loop Exit Edge Convention
**Goal**: A loop node's outgoing edges follow the new label-based exit convention — exactly one labeled edge is the exit, its label becomes the Runner button caption, and validator rejects ambiguous configurations with plain-language Russian errors.
**Depends on**: Phase 43 (needs the unified `LoopNode` model + `GraphValidator` scaffolding from v1.7) and Phase 44 (needs the loop picker rendering path in `RunnerView` that Phase 49 rewires)
**Requirements**: EDGE-01
**Success Criteria** (what must be TRUE):
  1. `GraphValidator` emits a clear Russian error naming the offending `loop` node when its outgoing edges have **zero** labeled edges ("нет выхода") or **two or more** labeled edges ("должен быть ровно один выход"), per `.planning/notes/loop-node-exit-edge-convention.md` (EDGE-01)
  2. In the Runner, the loop picker's exit button caption reads the label of the sole labeled outgoing edge verbatim — the hardcoded «выход» fallback in `RunnerView` is removed; body-branch iteration behaviour over unlabeled edges is unchanged (EDGE-01)
  3. A canvas that happened to use the literal label «выход» under the v1.7 convention continues to work because «выход» is still a valid label for the sole labeled edge; canvases with multiple labeled edges now surface the new validator error by design (no automatic migration, per REQUIREMENTS.md Out-of-Scope row 3)
**Plans:** 5 plans

Plans:
- [x] 49-01-PLAN.md — Shared node-label util (nodeLabel + isLabeledEdge + isExitEdge) + unit tests — ✅ 2026-04-19 (commits 4fce768, c39876f; +23 tests)
- [ ] 49-02-PLAN.md — GraphValidator LOOP-04 rewrite (D-01/D-02/D-03 error copy) + graph-validator test updates
- [ ] 49-03-PLAN.md — ProtocolRunner dispatch + RunnerView loop picker rewire + non-«выход» regression tests
- [ ] 49-04-PLAN.md — Fixture audit: strip stray body-edge labels; add unified-loop-stray-body-label.canvas
- [ ] 49-05-PLAN.md — Build + full test gate + UAT checkpoint (human-verify)

### Phase 50: Answer ↔ Edge Label Sync
**Goal**: `Answer.displayLabel` is the single source of truth for every incoming Question→Answer edge label — edits to either side propagate through the canvas save path, Node Editor form, and edge label rendering so both views stay consistent.
**Depends on**: Nothing new from v1.8 (touches independent areas from Phase 49; schedulable in parallel)
**Requirements**: EDGE-02
**Success Criteria** (what must be TRUE):
  1. Editing "Display label (optional)" in the Node Editor Answer form writes `Answer.displayLabel` and updates the rendered label on every incoming edge across the canvas (Pattern B live write when canvas open, Strategy A on save when closed), per `.planning/notes/answer-label-edge-sync.md` (EDGE-02)
  2. Editing the label of any incoming edge on the canvas writes back to `Answer.displayLabel` and re-syncs every **other** incoming edge to the new value; new edges created with a label seed `Answer.displayLabel` (EDGE-02)
  3. Multi-incoming Answer topologies render the same label on every incoming edge — per-edge override is explicitly out of scope for v1.8 (per REQUIREMENTS.md Out-of-Scope row 1), with the constraint documented in code comments for future maintainers (EDGE-02)
**Plans:** 5 plans

Plans:
- [x] 50-01-PLAN.md — Type-lift CanvasData.edges to CanvasEdgeData[] (D-15 prerequisite) — ✅ f920522 (2026-04-19)
- [x] 50-02-PLAN.md — Pure edge-label-reconciler module + unit tests + multi-incoming and mismatch fixtures (D-04/D-07/D-08/D-09/D-17/D-18) — ✅ f8d08c7+b6489db+31d1322+39d3c7e (2026-04-19)
- [x] 50-03-PLAN.md — Extend CanvasLiveEditor: saveLiveEdges + saveLiveBatch(edgeEdits) + write-back integration tests (D-12/D-14) — ✅ 91e4121+dec2474 (2026-04-19)
- [x] 50-04-PLAN.md — EdgeLabelSyncService + main.ts wire-up + editor-panel-view Display-label atomic write (D-01/D-06/D-10/D-13/D-14) — ✅ 3cf8bd2+00690e2+fd7c78b (2026-04-19)
- [x] 50-05-PLAN.md — Build + full test gate + human UAT checkpoint (5 scenarios) — ✅ 95a5f15 + rollup (2026-04-19; UAT PASS in TEST-BASE)
**UI hint**: yes

### Phase 50.1: Loop Exit `+` Prefix Convention (INSERTED)
**Goal**: Replace Phase 49 D-07 convention (exit edge = any labeled edge) with a `+`-prefix marker so loop nodes can have multiple labeled body edges without ambiguity, while keeping exactly one (or more, TBD in discuss) `+`-prefixed exit edge. Resolves the conflict identified post-Phase-50 UAT between Phase 49 loop-exit convention and Phase 50 auto-sync of shared Answer.displayLabel labels on multi-incoming topologies.
**Depends on**: Phase 49 (rewires its `isExitEdge` contract), Phase 50 (preserves its sync semantics on Answer.displayLabel — out-of-scope for this phase)
**Requirements**: EDGE-03 (new; supersedes EDGE-01 from Phase 49)
**Success Criteria** (what must be TRUE — locked by Phase 50.1 CONTEXT + plan-phase):
  1. `isExitEdge(edge)` returns true iff `edge.label?.trim().startsWith('+')` — the Phase 49 alias to `isLabeledEdge` is removed; body edges with non-`+` labels are NOT exits (D-10)
  2. LOOP-04 validator emits five distinct Russian error texts (D-04..D-08) with locked verbatim strings: clean zero-exit, legacy-hint with candidate `{edgeIds}`, ≥2 `+`-edges, empty caption post-strip (per-edge), and no-body — in that order (D-04/D-05 → D-06 → D-08 → D-07); exactly one `+`-edge allowed per loop node (D-01)
  3. ProtocolRunner.chooseLoopBranch dispatches via `isExitEdge` (unchanged call site, new predicate semantics); RunnerView exit-button caption uses `stripExitPrefix` to strip `+` and any following whitespace (D-09/D-11/D-12); body-button caption stays `nodeLabel(target)` byte-identical to Phase 49; click-handler ordering preserved character-for-character
  4. All seven existing `unified-loop-*.canvas` Phase 49 fixtures migrated in-place to `+`-prefix labels (D-13); three new fixtures added (D-14): `unified-loop-legacy-vyhod` (D-05), `unified-loop-labeled-body` (Phase 49↔50 conflict regression), `unified-loop-empty-plus` (D-08); NO auto-migration — legacy bare-«выход» canvases surface D-05 hard validation error (D-02/D-03)
  5. Full-suite tests green (target: ≥484 preserved + ≥15 new Phase 50.1 tests); `node-label.test.ts` covers the D-15 input matrix (`+выход`, `+ выход`, `+ выход`, `"  +выход  "`, `"+"`, `"+ "`, `"++foo"`, `"foo+"`, `""`, `null`) plus the alias-removal regression `expect(isExitEdge).not.toBe(isLabeledEdge)`; Phase 50 reconciler tests stay green untouched; zero runtime literal-«выход» comparison outside the preserved Phase 43 MIGRATE-01 block
**Plans**: 5 plans
Plans:
- [x] 50.1-01-PLAN.md — node-label.ts redefine isExitEdge + add stripExitPrefix + node-label tests + EDGE-03 in REQUIREMENTS.md (Wave 1) — ✅ 92b9772+e531216+e825fa4 (2026-04-19)
- [x] 50.1-02-PLAN.md — graph-validator.ts LOOP-04 rewrite (D-04..D-08) + graph-validator tests (Wave 2) — ✅ d23af70+2e29540 (2026-04-19)
- [x] 50.1-03-PLAN.md — runner-view caption via stripExitPrefix + protocol-runner JSDoc + runner-loop-picker tests (incl. Phase 49↔50 conflict regression) (Wave 2) — ✅ 90e3b88+2c1b932 (2026-04-19)
- [x] 50.1-04-PLAN.md — migrate 7 existing unified-loop-*.canvas fixtures + 3 new fixtures (legacy-vyhod, labeled-body, empty-plus) (Wave 1) — ✅ 7975f34+6737380 (2026-04-19)
- [x] 50.1-05-PLAN.md — build + full test gate + regression-protection audits + canonical-note rewrite + human UAT (Wave 3) — ✅ 67d0786 + UAT PASS in TEST-BASE (2026-04-19)
**UI hint**: yes (runtime exit-button caption rendering changes)

### Phase 51: Snippet Picker Overhaul
**Goal**: Snippet nodes can bind to either a directory (existing) or a specific snippet file (new), and every snippet/folder selection in the plugin is driven by one reusable hierarchical navigator with search, replacing the flat directory list.
**Depends on**: Nothing new from v1.8 (the v1.4 Snippet node model and the v1.5 Snippet tree primitives already exist; Phase 51 adds a binding discriminant + a new picker widget that both Node Editor and Runner consume)
**Requirements**: PICKER-01, PICKER-02
**Success Criteria** (what must be TRUE):
  1. A Snippet node bound to a specific snippet file **auto-inserts** its content when it is the sole option at the current step, and renders as a single clickable choice button when it sits among sibling options — for `.json` snippets with placeholders the fill-in modal still runs before insertion on both paths, per `.planning/notes/snippet-node-binding-and-picker.md` (PICKER-01)
  2. A hierarchical navigator widget (tree drill-down with breadcrumb + tree-wide search field at the top) replaces the flat-list folder picker wherever Node Editor selects a snippet target; selecting a **folder** binds the node to that directory (legacy shape) and selecting a **snippet file** binds to that specific path (new shape) — the widget is reused in both directory and specific flows (PICKER-02)
  3. Existing directory-bound Snippet nodes continue to load and run unchanged from saved canvases — the stored canvas shape stays backward-compatible per v1.8 Standing Pitfall #11 in STATE.md; the new binding variant co-exists under a stored discriminant (PICKER-01)
  4. Opening an existing protocol that uses the v1.4 directory-bound Snippet picker in Runner still shows the same drill-down picker (now implemented via the unified hierarchical component) — no saved canvas requires editing for the UI change (PICKER-02)
**Plans:** 6 plans

Plans:
- [ ] 51-01-PLAN.md — SnippetNode model field + canvas-parser arm + GraphValidator D-04 missing-file check (PICKER-01)
- [ ] 51-02-PLAN.md — SnippetTreePicker component (modes folder-only/file-only/both) + new src/styles/snippet-tree-picker.css + esbuild CSS_FILES registration (PICKER-02)
- [ ] 51-03-PLAN.md — Node Editor inline SnippetTreePicker integration (mode both) replacing flat dropdown in case 'snippet' arm (PICKER-02)
- [ ] 51-04-PLAN.md — SnippetEditorModal «Папка» + Snippet Manager «Переместить в…» migration to SnippetTreePicker (mode folder-only); FolderPickerModal preserved as @deprecated (PICKER-02)
- [ ] 51-05-PLAN.md — Runner renderSnippetPicker rewrite on SnippetTreePicker (mode file-only) + specific-bound sibling button caption + click (D-16) (PICKER-01 + PICKER-02)
- [ ] 51-06-PLAN.md — Runner auto-insert dispatch (D-13/D-14/D-15): single-edge Question → file-bound Snippet skips picker and lands directly in awaiting-snippet-fill (PICKER-01)
**UI hint**: yes

### Phase 52: JSON Placeholder Rework
**Goal**: JSON snippet placeholders are reduced to exactly two types (`free text` + unified `choice`), the broken options-list editor is fixed, the Runner fill-in modal renders unified `choice` as multi-select with a joinable separator, and legacy snippet files declaring removed types fail loudly instead of silently.
**Depends on**: Nothing (independent schema + UI rework in the snippet editor, fill-in modal, and snippet validation paths; schedulable in parallel with Phases 47–51)
**Requirements**: PHLD-01
**Success Criteria** (what must be TRUE):
  1. The JSON snippet placeholder schema defines exactly two types — `"free text"` and `"choice"` — where `choice` carries `options: string[]` and an optional `separator: string` (default `", "`), per `.planning/notes/json-snippet-placeholder-rework.md`; `number` and `multichoice` are removed from the type union and from the snippet editor's type selector (PHLD-01)
  2. The snippet editor's options-list UI works end-to-end — users can add, edit, reorder, and remove option values on a `choice` placeholder and the changes persist to the `.json` file; the existing bug where option entries cannot be edited is fixed (PHLD-01)
  3. The Runner fill-in modal renders a unified `choice` placeholder as multi-select; selecting a single option inserts that value verbatim, selecting multiple joins them using the placeholder's `separator` (default `", "`) (PHLD-01)
  4. Loading a `.json` snippet that declares `number`, `multichoice`, or an unreadable legacy `choice` schema surfaces a hard validation error in the snippet editor and blocks its use in Runner — no automatic migration runs (per REQUIREMENTS.md Out-of-Scope row 2) (PHLD-01)
**Plans**: 5 plans

Plans:
- [x] 52-01-wave0-test-scaffolding-PLAN.md — Wave 0 RED test scaffolding: 4 new test files + fixture updates (20 RED tests) — ✅ e33b99a/0ee9100/6382186/08af83c/384c65d/63b2e96/9a02327 (2026-04-20)
- [x] 52-02-model-and-service-narrowing-PLAN.md — Narrow SnippetPlaceholder union to 2 types; rename joinSeparator → separator; drop unit; add validationError + validatePlaceholders (D-01/D-02/D-03/D-07) — ✅ fb3c8d1/b8c7e01/a218b2a (2026-04-20)
- [x] 52-03-chip-editor-and-fill-in-modal-PLAN.md — Chip editor narrowed to 2-type selector; fill-in modal checkbox-only dispatch (D-05/D-06/D-09) — ✅ 7d17039/9f1f23d/892ea8f (2026-04-20)
- [x] 52-04-banner-and-runner-error-surface-PLAN.md — SnippetEditorModal validation banner + RunnerView validationError guards + CSS appended (D-04) — ✅ 794a922/611f4ff/f7baa6a/55f7c6a (2026-04-20)
- [x] 52-05-uat-and-regression-gate-PLAN.md — Full test + build gate; 10 static audits; dev-vault UAT 5/5 PASS + mid-UAT chip-editor gap closure; STATE/ROADMAP/REQUIREMENTS rollup — ✅ b7459bd/9900a56 + rollup (2026-04-20)
**UI hint**: yes

### Phase 53: Runner Skip & Close Buttons
**Goal**: Add two new buttons to the Protocol Runner UI — **Skip** advances past the current node without inserting anything into the Runner textarea, and **Close** unloads the current canvas (with the same confirmation dialog used when switching canvases mid-run) and returns the Runner to the "no canvas selected" state.
**Depends on**: Nothing (pure Runner UI addition; schedulable independently of other v1.8 phases)
**Requirements**: RUNNER-SKIP-01, RUNNER-SKIP-02, RUNNER-SKIP-03, RUNNER-CLOSE-01, RUNNER-CLOSE-02, RUNNER-CLOSE-03
**Success Criteria** (what must be TRUE):
  1. A **Skip** button is visible in the Runner while a node is active — clicking it advances to the next node per the existing dispatch logic without appending anything to the Runner textarea and without emitting a choice/edge traversal that would fail non-skip expectations downstream
  2. A **Close** button is visible in the Runner while a canvas is loaded — clicking it shows the existing mid-run switch confirmation prompt; on confirm, the active canvas is unloaded and the Runner returns to the "no canvas selected" state (same state as on fresh plugin open / post-canvas-clear)
  3. Both buttons do nothing (or are disabled/hidden) when no canvas is loaded, and skip is only operative when a node is currently active (not during terminal / empty-buffer states)
**Plans**: 4 plans

Plans:
- [x] 53-01-PLAN.md — Add RUNNER-SKIP-* / RUNNER-CLOSE-* to REQUIREMENTS.md + ProtocolRunner.skip() method + 6 unit tests (D-07..D-11) — ✅ f832ddd/8aa912f/2ceae8d (2026-04-20)
- [x] 53-02-PLAN.md — Skip button UI in RunnerView question-zone (icon-only setIcon + 5-step click prologue) + Phase 53 CSS block append (D-01/D-04/D-05/D-07/D-08/D-11) — ✅ 247a70a/6447ac5 (2026-04-20)
- [x] 53-03-PLAN.md — Close button in selectorBarEl + handleClose() with D-14 teardown + visibility toggle + Close CSS (D-02/D-12..D-16) — ✅ 631b2e6/f6bc1b4 (2026-04-21)
- [ ] 53-04-PLAN.md — Automated gate (10 audits + 5 counter-checks) + human UAT in TEST-BASE (3 scenarios mapped to SC-1/2/3) + rollup commit
**UI hint**: yes

### Phase 54: Inline Protocol Display Mode
**Goal**: Introduce a third Runner display mode — **inline** — where the protocol appears as a floating, non-blocking modal over the active note and each answer selection is appended directly to the end of that note, replacing the Runner's internal textarea with the note itself. Launched only via a new command palette entry `Run protocol in inline`, which prompts the user to pick a canvas from the `Protocol` folder and then opens the modal on the currently active note.
**Depends on**: Nothing strictly (touches Runner display layer + new command; parallel to Phase 51/52/53). Design decisions locked in `.planning/notes/inline-protocol-mode.md` — discuss-phase should build on those, not reopen them.
**Requirements**: TBD (to be allocated in discuss-phase)
**Success Criteria** (what must be TRUE):
  1. A new command `Run protocol in inline` is registered in the Obsidian command palette; executing it with an active note opens a canvas picker (scoped to the `Protocol` folder), and selecting a canvas spawns a floating modal anchored over that note, starting at the canvas's entry node, per `.planning/notes/inline-protocol-mode.md`
  2. The floating modal does not block editing of the underlying note — the user can continue to type / edit the note while the modal is visible; selecting an answer option appends the resulting text to the **end** of that specific note (never cursor position, never another note)
  3. The Runner's internal textarea is not used in inline mode — the note itself is the buffer; there is no "commit all at once" step and no staging area; Obsidian's native undo is the only rollback path
  4. The protocol is bound to the source note for the duration of the run — if the user switches to a different note, the modal closes or freezes (discuss-phase picks one) and output never silently redirects elsewhere; on return to the source note the run resumes or is shown as ended (discuss-phase picks one)
  5. The existing `sidebar` and `tab` display modes are unchanged — no regression in their behavior; inline is strictly additive and reachable only through the new command, not through settings, canvas attributes, or the existing Runner launch paths
**Plans**: TBD
**UI hint**: yes

### Phase 55: BRAT Distribution Readiness
**Goal**: The repository is shippable via BRAT — `manifest.json`, `versions.json`, and git tags align on one version, and a GitHub Release exists with the three required assets so users can install through BRAT with identifier `vegacepticon/RadiProtocol`.
**Depends on**: Phases 47–54 + 56 (release asset must reflect a shippable build; this phase is scheduled last and does not touch TypeScript source)
**Requirements**: BRAT-01
**Success Criteria** (what must be TRUE):
  1. `manifest.json` `version`, `versions.json` mapping (min-Obsidian per version), and the git tag naming scheme all agree on the v1.8 release version; `npm run build` produces a clean `main.js` + `styles.css` against that manifest version (BRAT-01)
  2. `gh release list` shows at least one GitHub Release whose assets include `manifest.json`, `main.js`, and `styles.css` as individually downloadable files at the root of the release (not inside a zip) (BRAT-01)
  3. Installing the plugin in a fresh Obsidian vault via BRAT with identifier `vegacepticon/RadiProtocol` succeeds end-to-end — plugin appears in Community Plugins list, enables, and opens the Runner view (BRAT-01)
**Plans**: TBD

### Phase 56: Snippet Button UX Reversal
**Goal**: Reverse Phase 51 D-13/D-16 design decisions so every file-bound Snippet node renders as a click-button (never auto-inserts, never leads through picker): clicking the button directly inserts the snippet content (or opens SnippetFillInModal for `.json` with placeholders). Directory-bound Snippet nodes keep the current button→picker flow. Additionally add visible indicators in SnippetEditorModal for folder-selection state (unsaved-change marker + «Выбрать эту папку» button colour feedback after click).
**Depends on**: Phase 51 (overturns D-13 in `protocol-runner.ts` case `'question'` auto-insert dispatch and D-16 sibling-button routing in `runner-view.ts`; preserves Phase 51 picker component + directory-bound code paths untouched)
**Requirements**: Follow-up to PICKER-01; PICKER-02 unaffected
**Success Criteria** (what must be TRUE — to be locked during discuss/plan):
  1. A Question → single-edge → file-bound Snippet path renders a single choice button (with 📄 glyph + D-16 three-step caption fallback preserved) instead of auto-advancing to awaiting-snippet-fill (reverses Phase 51 D-13 in `protocol-runner.ts:~580-613`)
  2. Clicking any file-bound Snippet button (single-edge or sibling) dispatches the snippet fill path directly — `.md` inserts content immediately, `.json` with placeholders opens SnippetFillInModal before insertion, `.json` without placeholders inserts template immediately — without routing through `chooseSnippetBranch → awaiting-snippet-pick` (reverses Phase 51 D-16 in `runner-view.ts:~452-459`)
  3. Directory-bound Snippet nodes (no `radiprotocol_snippetPath`, only `radiprotocol_subfolderPath`) continue to render button → SnippetTreePicker drill-down identically to Phase 51; zero regression on directory-bound UX
  4. Undo (stepBack) semantics preserved: pressing Undo from awaiting-snippet-fill (or from post-insertion state) returns to the Question with the pre-insertion accumulator snapshot; D-15 undo-before-mutate ordering retained at every new click handler
  5. RUNFIX-02 `capturePendingTextareaScroll()` remains the FIRST line of every new/modified click handler in `runner-view.ts`
  6. SnippetEditorModal «Папка» row shows a visible "unsaved changes" indicator (badge/marker near the field or in the modal header) whenever the current folder selection differs from the saved value; indicator clears on save/reset
  7. The «Выбрать эту папку» button inside SnippetTreePicker (in SnippetEditorModal + Snippet Manager contexts) transitions to a "committed" colour state immediately after click so the user has visual confirmation that the selection was recorded
  8. Full-suite tests green including new Phase 56 tests covering: single-edge file-bound button rendering (previously absent in Phase 51), direct-insert click path for .md and .json (with and without placeholders), back-compat of directory-bound → picker flow, and visual-state transitions for folder-select indicators
**Plans**: TBD

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
| 47 | v1.8 | 3/3 | In progress | - |
| 48 | v1.8 | 0/0 | Not started | - |
| 48.1 | v1.8 | 1/1 | Complete (INSERTED) | 2026-04-19 |
| 49 | v1.8 | 5/5 | Complete | 2026-04-19 |
| 50 | v1.8 | 5/5 | Complete | 2026-04-19 |
| 50.1 | v1.8 | 5/5 | Complete (INSERTED) | 2026-04-19 |
| 51 | v1.8 | 0/6 | Planned | - |
| 52 | v1.8 | 5/5 | Complete | 2026-04-20 |
| 53 | v1.8 | 1/4 | In progress | - |
| 54 | v1.8 | 0/0 | Not started | - |
| 55 | v1.8 | 0/0 | Not started | - |
