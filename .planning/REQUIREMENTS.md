# Requirements: RadiProtocol — Milestone v1.8

**Defined:** 2026-04-18
**Milestone:** v1.8 UX Polish & Snippet Picker Overhaul
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

**Milestone Goal:** Polish the Node Editor + Protocol Runner UX, close regressions uncovered during v1.7 use, overhaul the Snippet node picker with hierarchical navigation + specific-snippet binding, unify JSON snippet placeholders, and prepare the repo for BRAT installation.

---

## v1.8 Requirements

## Coverage Summary (as of 2026-04-21)

- **Requirements closed:** 23 of 26 (88%) — RUNFIX-01..03, NODEUI-01..05, EDGE-01/02/03, PHLD-01, PICKER-01/02, RUNNER-SKIP-01..03, BRAT-01, INLINE-01..05
- **Deferred to Phase 58 (verification-artifact backfill):** RUNNER-CLOSE-01..03 — UAT PASS 2026-04-21, awaiting `53-VERIFICATION.md` before traceability flip
- **Historical / superseded:** EDGE-01 (Phase 49 closure preserved as historical milestone; EDGE-03 at Phase 50.1 is the active contract for the loop-exit discriminator)

### Runner Regressions (RUNFIX)

- [x] **RUNFIX-01**: Manual textarea edits made before advancing through a loop node are preserved across every loop transition — entering a body branch, exiting via «выход», or re-entering the loop on dead-end return — so the user never loses hand-typed edits. ✅ Closed by Phase 47 Plan 01 (2026-04-18).
  - **Source:** `.planning/todos/pending/bug-runner-textarea-edits-lost-on-loop-transition.md`
  - **Signal:** capture-before-advance (BUG-01 pattern) must fire on every loop-node state transition, not only on step-advance.

- [x] **RUNFIX-02**: After selecting a choice button in the Runner, the textarea scroll position is preserved (or scrolled to the point of insertion) — it never jumps back to the top. ✅ Closed by Phase 47 Plan 02 (2026-04-18).
  - **Source:** `.planning/todos/pending/runner-textarea-preserve-scroll-on-insert.md`
  - **Signal:** `scrollTop` captured before insert and restored (or advanced to insertion point) after the content update.

- [x] **RUNFIX-03**: Choice button text has visible horizontal and vertical padding so long, wrapping content never clips descenders, brackets, or other glyphs that hang below the baseline (e.g. «р», "(", ")"). ✅ Closed by Phase 47 Plan 03 (2026-04-18).
  - **Source:** `.planning/todos/pending/runner-choice-button-text-padding.md`
  - **Signal:** the choice-button CSS applies adequate `padding` + `line-height` so descenders render inside the button box at every wrap count.

### Node Editor UX (NODEUI)

- [x] **NODEUI-01**: The Node Editor settings for a Text block no longer display the obsolete "Snippet ID (optional)" field. The field is gone from both the form and any underlying model/save path. ✅ Closed by Phase 48 (2026-04-19).
  - **Source:** `.planning/todos/pending/remove-snippet-id-from-text-block.md`
  - **Signal:** selecting a Text block in Node Editor shows no "Snippet ID" input; the underlying `radiprotocol_snippetId` property on Text blocks is either ignored or removed on save.

- [x] **NODEUI-02**: Creating a new node through a Node Editor quick-create button positions the new node **below** the anchor (last-selected) node on the canvas, not to its right, producing a vertical tree by default. ✅ Closed by Phase 48 (2026-04-19).
  - **Source:** `.planning/todos/pending/new-nodes-placed-below-last.md`
  - **Signal:** `CanvasNodeFactory` offset calculation changed from `(dx, 0)` right-offset to `(0, dy)` down-offset; applies to all four quick-create buttons (question, answer, snippet, loop).

- [x] **NODEUI-03**: In the Node Editor's Answer form, the "Display label (optional)" field is rendered **above** the "Answer text" field. Both labels and helper text accompany their respective inputs in the new order. ✅ Closed by Phase 48 (2026-04-19).
  - **Source:** `.planning/todos/pending/swap-answer-fields-order.md`
  - **Signal:** visual inspection shows Display label first, Answer text second.

- [x] **NODEUI-04**: In the Node Editor's Question form, the "Question text" textarea auto-grows with its content, and its label + helper description ("Displayed to the user during the protocol session") render **above** the textarea so the full panel width is available for input. ✅ Closed by Phase 48 (2026-04-19).
  - **Source:** `.planning/todos/pending/question-textarea-autogrow.md`
  - **Signal:** textarea height recomputes on input; label block stacked above textarea (not beside it).

- [x] **NODEUI-05**: The Node Editor's quick-create buttons (Create question / answer / snippet / loop node) are relocated to the **bottom** of the panel and arranged as a single **vertical** column, each button full-width. ✅ Closed by Phase 48 (2026-04-19).
  - **Source:** `.planning/todos/pending/node-editor-create-buttons-bottom-stack.md`
  - **Signal:** `.rp-editor-create-toolbar` sits at the panel bottom; flex-direction column; `flex-wrap` constraint no longer relevant because buttons are single-column.

### Edge Semantics (EDGE)

- [x] **EDGE-01**: A loop node's outgoing edges follow a new convention: **exactly one** labeled edge is the loop exit (its label becomes the exit button caption in Runner); all unlabeled outgoing edges are body branches. `GraphValidator` rejects loop nodes with zero or two-or-more labeled outgoing edges with clear Russian error messages naming the offending node. ✅ Closed by Phase 49 Plans 01-05 (2026-04-19; UAT PASS in TEST-BASE: non-«выход» exit labels, D-01/D-02/D-03 error panel, legacy «выход» regression-free).
  - **Source:** `.planning/todos/pending/loop-node-exit-from-edge-label.md` + `.planning/notes/loop-node-exit-edge-convention.md`
  - **Signal:** Runner's exit button text equals the labeled edge's label (no hardcoded «выход»); validation catches both error cases; unlabeled-edges iteration behaviour unchanged.
  - **Migration note:** this supersedes the v1.7 convention of matching the literal label «выход» as the exit discriminator. A migration step may be needed for canvases that relied on the old convention.
  - **Superseded by EDGE-03 (Phase 50.1):** the Phase 49 convention (any labeled edge = exit) is replaced by a "+"-prefix convention so loop nodes can carry labeled body edges unambiguously — EDGE-01 is superseded by EDGE-03 as the active contract. EDGE-01's Phase 49 closure stays valid as a historical milestone; EDGE-03 is the active contract for the exit discriminator.

- [x] **EDGE-02**: `Answer.displayLabel` and every incoming Question→Answer edge label are bound to the same source of truth: editing either side updates the other. On the canvas, edge labels on Question→Answer connections render from `Answer.displayLabel`. Per-edge label overrides are not supported in this milestone. ✅ Closed by Phase 50 Plans 01-05 (2026-04-19; UAT PASS in TEST-BASE: Pattern B atomic node+edges write on canvas-open, Strategy A single vault.modify on canvas-closed, multi-incoming sibling re-sync deterministic, D-08/D-09 clearing symmetry both directions).
  - **Source:** `.planning/todos/pending/sync-answer-displaylabel-with-edge-label.md` + `.planning/notes/answer-label-edge-sync.md`
  - **Signal:** editing Display label in Node Editor updates every incoming edge's rendered label; editing any incoming edge label updates `Answer.displayLabel` and re-syncs the other incoming edges.
  - **Trade-off:** multi-incoming Answer nodes always display the same label on every incoming edge (user confirmed no current multi-incoming topologies).

- [x] **EDGE-03**: Loop nodes use a "+"-prefix convention on outgoing edge labels to distinguish exit edges from body edges. Exactly one outgoing edge per loop node may carry a label whose trimmed value starts with `+`; the text after the `+` (with following whitespace stripped) is the Runner exit-button caption. All other outgoing edges — labeled or unlabeled — are body branches. Canvases using the Phase 49 convention (a bare `label: "выход"` without `+`) surface a dedicated Russian validation error directing the author to add the `+` prefix manually; no auto-migration.
  - **Source:** `.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` + `.planning/notes/loop-node-exit-edge-convention.md`
  - **Signal:** `isExitEdge(edge) === edge.label?.trim().startsWith('+')`; `stripExitPrefix` lives in `src/graph/node-label.ts`; validator emits five Russian error texts (D-04..D-08) for zero-`+`, ≥2-`+`, legacy-labeled-non-`+`, no-body, and empty-caption-post-strip cases.
  - **Supersedes:** EDGE-01 (Phase 49) — EDGE-01 closure stays as historical record; EDGE-03 is the active convention.

### Snippet Node & Picker (PICKER)

- [x] **PICKER-01**: A Snippet node may bind to either a directory (existing behaviour) **or** a specific snippet file (new). When the Runner reaches a specific-bound Snippet node:
  - if it is the sole option at the step → insert the snippet text automatically (no click required);
  - if it sits among sibling options → render as a single clickable choice button;
  - the placeholder fill-in modal still runs before insertion for `.json` snippets with placeholders in both paths. ✅ Closed by Phase 51 (2026-04-20).
  - **Source:** `.planning/todos/pending/snippet-node-bind-to-specific-snippet.md` + `.planning/notes/snippet-node-binding-and-picker.md`
  - **Signal:** existing directory-bound Snippet nodes keep working unchanged; new binding variant co-exists.

- [x] **PICKER-02**: The Node Editor's target-selection widget for Snippet nodes is a **hierarchical navigator** (tree drill-down with breadcrumb) with a search field at the top that filters across the whole tree by name. The picker can select either a folder (directory binding) or a specific snippet file (specific binding). ✅ Closed by Phase 51 (2026-04-20).
  - **Source:** `.planning/todos/pending/hierarchical-snippet-picker.md` + `.planning/notes/snippet-node-binding-and-picker.md`
  - **Signal:** flat-list directory picker is gone; a unified hierarchical picker component is reused wherever a snippet or folder is chosen. Pure UI change: stored path shape on the node is unchanged and existing saved protocols still load.

### JSON Snippet Placeholders (PHLD)

- [x] **PHLD-01**: JSON snippet placeholder types are collapsed to exactly two: `free text` and a unified `choice`. The `number` and `multichoice` types are removed. The unified `choice` renders as multi-select in the Runner fill-in modal; selecting a single option inserts that value, selecting multiple joins them with a separator (default `", "`, overridable via an optional per-placeholder `separator` field). The snippet editor's options-list UI works correctly — adding, editing, reordering, and removing options persists. Loading a `.json` snippet that declares a removed type is a hard validation error surfaced in the snippet editor and blocks Runner use. ✅ Closed by Phase 52 (2026-04-20). Union narrowed to {free-text, choice}; joinSeparator renamed to separator; unit removed; validatePlaceholders helper emits hard-validation error for legacy types; editor banner + runner error panel surface the error; UAT PASS 5/5 in TEST-BASE.
  - **Source:** `.planning/todos/pending/json-snippet-placeholder-rework.md` + `.planning/notes/json-snippet-placeholder-rework.md`
  - **Signal:** placeholder schema updated; snippet editor type selector shows two options; existing `choice`/`multichoice` options-editor bug is fixed; no automatic migration of legacy snippets (user confirmed none exist).

### Runner Skip & Close (RUNNER)

- [x] **RUNNER-SKIP-01**: The Runner renders a **Skip** icon-button (lucide `skip-forward`) inside the question zone (sibling of `rp-answer-list`) whenever `runnerStatus === 'at-node'` AND the current node is a question AND at least one outgoing answer-kind neighbor exists. The button is NOT rendered at `idle` / `awaiting-snippet-pick` / `awaiting-snippet-fill` / `awaiting-loop-pick` / `complete` / `error` or when the question has no answer neighbors. ✅ Closed by Phase 53 (2026-04-21).
  - **Source:** `.planning/phases/53-runner-skip-close-buttons/53-CONTEXT.md` D-01, D-04, D-05, D-07, D-08
  - **Signal:** `rp-skip-btn` present in the DOM only under the D-07 preconditions; `aria-label` + `title` carry the human label; `setIcon(btn, 'skip-forward')` renders the icon.

- [x] **RUNNER-SKIP-02**: Clicking **Skip** at a question node advances the runner to the first answer neighbor in `graph.adjacency` order WITHOUT appending the answer's text to the accumulator. Skip does NOT traverse any snippet neighbor — mixed answer+snippet branches (Phase 31) still pick the first *answer* neighbor. The click handler calls `capturePendingTextareaScroll()` → `syncManualEdit(previewTextarea.value)` → `runner.skip()` → `autoSaveSession()` → `renderAsync()` in that exact order (BUG-01 / RUNFIX-02 invariants preserved). ✅ Closed by Phase 53 (2026-04-21).
  - **Source:** 53-CONTEXT.md D-08, D-09, D-11
  - **Signal:** accumulator text is byte-identical before and after Skip; `currentNodeId` transitions via the answer to the answer's first neighbor.

- [x] **RUNNER-SKIP-03**: **Skip is a recordable step** — it pushes an `UndoEntry` (same shape as `chooseAnswer`) BEFORE advancing. Pressing Step back after Skip returns the user to the question node with its answer buttons re-rendered and the accumulator unchanged from pre-Skip. ✅ Closed by Phase 53 (2026-04-21).
  - **Source:** 53-CONTEXT.md D-10
  - **Signal:** `undoStack.length` grows by exactly 1 per Skip click; `stepBack()` restores `currentNodeId` to the question and `runnerStatus` to `at-node`.

- [ ] **RUNNER-CLOSE-01**: The Runner renders a **Close** icon-button (lucide `x`) inside `selectorBarEl` (next to `CanvasSelectorWidget`) whenever `canvasFilePath !== null`. When no canvas is loaded the Close button is hidden (via class toggle or `display: none`). The button is neutral-styled — NO `mod-warning`, NO destructive red (D-06).
  - **Source:** 53-CONTEXT.md D-02, D-04, D-05, D-06, D-12
  - **Signal:** `rp-close-btn` present in `selectorBarEl` exactly once (attached in `onOpen` so the `contentEl.empty()` + `prepend(selectorBarEl)` survive pattern carries it across renders — same lifetime as the selector).

- [ ] **RUNNER-CLOSE-02**: Clicking **Close** branches on `runner.getState().status`: for `at-node | awaiting-snippet-pick | awaiting-snippet-fill | awaiting-loop-pick` it opens the existing `CanvasSwitchModal` and only proceeds on `true`; for `idle | complete | error` it proceeds directly without modal. The `needsConfirmation` predicate is byte-identical to `handleSelectorSelect` (53-PATTERNS.md §Analog #2).
  - **Source:** 53-CONTEXT.md D-13, D-15
  - **Signal:** grep `needsConfirmation` in `runner-view.ts` finds 2 call-sites with the same 4-status union; `CanvasSwitchModal` is NOT modified.

- [ ] **RUNNER-CLOSE-03**: On confirmed (or no-confirmation) Close, the Runner performs in this exact order: (1) `await sessionService.clear(canvasFilePath)` if path non-null; (2) re-create `this.runner = new ProtocolRunner({ defaultSeparator: plugin.settings.textSeparator })`; (3) null out `graph`, `canvasFilePath`, `previewTextarea`; (4) `selector.setSelectedPath(null)` to reset the widget to its placeholder; (5) `render()`. The resulting view is visually identical to a fresh plugin open — selector shows "Select a protocol…" and the `idle` branch of `render()` runs.
  - **Source:** 53-CONTEXT.md D-14, D-16
  - **Signal:** after Close, `canvasFilePath === null`, `getState().status === 'idle'`, selector label matches the placeholder string `'Select a protocol\u2026'`.

### Inline Protocol Display Mode (INLINE)

- [x] **INLINE-01**: A new command `Run protocol in inline` is registered in the Obsidian command palette; executing it with an active note opens a canvas picker (scoped to the `Protocol` folder), and selecting a canvas spawns a floating modal anchored over that note, starting at the canvas's entry node, per `.planning/notes/inline-protocol-mode.md`. ✅ Closed by Phase 54 (2026-04-21).
  - **Source:** `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`
  - **Signal:** command registered; canvas picker scoped to `Protocol/`; selecting a canvas opens a floating modal over the active note.

- [x] **INLINE-02**: The floating modal does not block editing of the underlying note — the user can continue to type / edit the note while the modal is visible; selecting an answer option appends the resulting text to the **end** of that specific note (never cursor position, never another note). ✅ Closed by Phase 54 (2026-04-21).
  - **Source:** `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`
  - **Signal:** floating modal is non-blocking; answer selection appends to the end of the source note only.

- [x] **INLINE-03**: The Runner's internal textarea is not used in inline mode — the note itself is the buffer; there is no "commit all at once" step and no staging area; Obsidian's native undo is the only rollback path. ✅ Closed by Phase 54 (2026-04-21).
  - **Source:** `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`
  - **Signal:** note-as-buffer (no staging area); rollback routed through Obsidian's native undo.

- [x] **INLINE-04**: The protocol is bound to the source note for the duration of the run — if the user switches to a different note, the modal closes or freezes (discuss-phase picks one) and output never silently redirects elsewhere; on return to the source note the run resumes or is shown as ended (discuss-phase picks one). ✅ Closed by Phase 54 (2026-04-21).
  - **Source:** `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`
  - **Signal:** source-note binding enforced; output never redirects to another note even on active-note switch.

- [x] **INLINE-05**: The existing `sidebar` and `tab` display modes are unchanged — no regression in their behavior; inline is strictly additive and reachable only through the new command, not through settings, canvas attributes, or the existing Runner launch paths. ✅ Closed by Phase 54 (2026-04-21).
  - **Source:** `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`
  - **Signal:** inline mode is additive; sidebar/tab launch paths untouched.

### Distribution (BRAT)

- [x] **BRAT-01**: The repository is prepared for installation through BRAT (Beta Reviewers Auto-update Tester). `manifest.json` `version`, `versions.json` mapping, and git tag/release naming are aligned; a GitHub **Release** exists with `manifest.json`, `main.js`, and `styles.css` attached as downloadable assets. Installing via BRAT with identifier `vegacepticon/RadiProtocol` succeeds in a fresh Obsidian vault. ✅ Closed by Phase 55 (2026-04-21).
  - **Source:** `.planning/todos/pending/prepare-repo-for-brat-install.md`
  - **Signal:** `gh release list` shows at least one release with the three assets; BRAT install end-to-end verified in a fresh vault.

---

## Out of Scope (explicit)

| Feature | Reason |
|---------|--------|
| Per-edge label override on Question→Answer edges (different wording per incoming edge pointing to the same Answer) | User has no current multi-incoming topologies; adding per-edge override would double the model complexity for an unused case. If needed later, user will create separate Answer nodes. |
| Automatic migration of legacy `.json` snippets using removed placeholder types (`number`, old `choice`, `multichoice`) | User confirmed no such snippets exist; implementing migration code for a zero-user path is pure overhead. Removed types surface as validation errors instead. |
| Automatic migration of canvases relying on v1.7's literal «выход» label convention for loop exits | The new EDGE-01 convention (any label works, as long as exactly one edge is labeled) subsumes the old convention — canvases that used «выход» will keep working unchanged because «выход» is still a valid label. Canvases with multiple labeled edges will fail validation by design. |
| BRAT automation in CI (auto-release on tag push) | Tracked for a later milestone; this milestone only delivers the manual process + first Release. |
| Runner UI for picking between sibling specific-bound Snippet nodes vs. directory-bound Snippet nodes | Covered incidentally by PICKER-01's click-vs-auto-insert rule; no dedicated multi-variant picker widget. |
| Placeholder `separator` configurability in the Runner fill-in modal (user choosing separator at fill time) | Separator is author-defined on the snippet; user doesn't pick it per-session. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUNFIX-01 | Phase 47 | ✅ complete (2026-04-18) |
| RUNFIX-02 | Phase 47 | ✅ complete (2026-04-18) |
| RUNFIX-03 | Phase 47 | ✅ complete (2026-04-18) |
| NODEUI-01 | Phase 48 | ✅ complete (2026-04-19) |
| NODEUI-02 | Phase 48 | ✅ complete (2026-04-19) |
| NODEUI-03 | Phase 48 | ✅ complete (2026-04-19) |
| NODEUI-04 | Phase 48 | ✅ complete (2026-04-19) |
| NODEUI-05 | Phase 48 | ✅ complete (2026-04-19) |
| EDGE-01   | Phase 49 | ⚠ historical (Phase 49 UAT PASS 2026-04-19) — superseded by EDGE-03 (Phase 50.1) as active contract |
| EDGE-02   | Phase 50 | ✅ complete (2026-04-19) |
| EDGE-03   | Phase 50.1 | ✅ complete (2026-04-19) |
| PICKER-01 | Phase 51 (+ Phase 56 reversal) | ✅ complete (2026-04-20) |
| PICKER-02 | Phase 51 | ✅ complete (2026-04-20) |
| PHLD-01   | Phase 52 | ✅ complete (2026-04-20) |
| RUNNER-SKIP-01  | Phase 53 | ✅ complete (2026-04-21) |
| RUNNER-SKIP-02  | Phase 53 | ✅ complete (2026-04-21) |
| RUNNER-SKIP-03  | Phase 53 | ✅ complete (2026-04-21) |
| RUNNER-CLOSE-01 | Phase 53 | UAT PASS 2026-04-21 — pre-checked without VERIFICATION.md backing; reset per audit, pending Phase 58 |
| RUNNER-CLOSE-02 | Phase 53 | UAT PASS 2026-04-21 — pre-checked without VERIFICATION.md backing; reset per audit, pending Phase 58 |
| RUNNER-CLOSE-03 | Phase 53 | UAT PASS 2026-04-21 — pre-checked without VERIFICATION.md backing; reset per audit, pending Phase 58 |
| INLINE-01       | Phase 54 | ✅ complete (2026-04-21) |
| INLINE-02       | Phase 54 | ✅ complete (2026-04-21) |
| INLINE-03       | Phase 54 | ✅ complete (2026-04-21) |
| INLINE-04       | Phase 54 | ✅ complete (2026-04-21) |
| INLINE-05       | Phase 54 | ✅ complete (2026-04-21) |
| BRAT-01   | Phase 55 | ✅ complete (2026-04-21) |

*Phase assignments filled in by the roadmapper on 2026-04-18. Gap-closure annotations added 2026-04-21 after `.planning/v1.8-MILESTONE-AUDIT.md`; Phase 57 introduces INLINE-01..05 and flips stale checkboxes, Phase 58 authors the missing VERIFICATION.md artefacts.*
