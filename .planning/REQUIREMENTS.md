# Requirements: RadiProtocol — Milestone v1.8

**Defined:** 2026-04-18
**Milestone:** v1.8 UX Polish & Snippet Picker Overhaul
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

**Milestone Goal:** Polish the Node Editor + Protocol Runner UX, close regressions uncovered during v1.7 use, overhaul the Snippet node picker with hierarchical navigation + specific-snippet binding, unify JSON snippet placeholders, and prepare the repo for BRAT installation.

---

## v1.8 Requirements

### Runner Regressions (RUNFIX)

- [x] **RUNFIX-01**: Manual textarea edits made before advancing through a loop node are preserved across every loop transition — entering a body branch, exiting via «выход», or re-entering the loop on dead-end return — so the user never loses hand-typed edits. ✅ Closed by Phase 47 Plan 01 (2026-04-18).
  - **Source:** `.planning/todos/pending/bug-runner-textarea-edits-lost-on-loop-transition.md`
  - **Signal:** capture-before-advance (BUG-01 pattern) must fire on every loop-node state transition, not only on step-advance.

- [x] **RUNFIX-02**: After selecting a choice button in the Runner, the textarea scroll position is preserved (or scrolled to the point of insertion) — it never jumps back to the top. ✅ Closed by Phase 47 Plan 02 (2026-04-18).
  - **Source:** `.planning/todos/pending/runner-textarea-preserve-scroll-on-insert.md`
  - **Signal:** `scrollTop` captured before insert and restored (or advanced to insertion point) after the content update.

- [ ] **RUNFIX-03**: Choice button text has visible horizontal and vertical padding so long, wrapping content never clips descenders, brackets, or other glyphs that hang below the baseline (e.g. «р», "(", ")").
  - **Source:** `.planning/todos/pending/runner-choice-button-text-padding.md`
  - **Signal:** the choice-button CSS applies adequate `padding` + `line-height` so descenders render inside the button box at every wrap count.

### Node Editor UX (NODEUI)

- [ ] **NODEUI-01**: The Node Editor settings for a Text block no longer display the obsolete "Snippet ID (optional)" field. The field is gone from both the form and any underlying model/save path.
  - **Source:** `.planning/todos/pending/remove-snippet-id-from-text-block.md`
  - **Signal:** selecting a Text block in Node Editor shows no "Snippet ID" input; the underlying `radiprotocol_snippetId` property on Text blocks is either ignored or removed on save.

- [ ] **NODEUI-02**: Creating a new node through a Node Editor quick-create button positions the new node **below** the anchor (last-selected) node on the canvas, not to its right, producing a vertical tree by default.
  - **Source:** `.planning/todos/pending/new-nodes-placed-below-last.md`
  - **Signal:** `CanvasNodeFactory` offset calculation changed from `(dx, 0)` right-offset to `(0, dy)` down-offset; applies to all four quick-create buttons (question, answer, snippet, loop).

- [ ] **NODEUI-03**: In the Node Editor's Answer form, the "Display label (optional)" field is rendered **above** the "Answer text" field. Both labels and helper text accompany their respective inputs in the new order.
  - **Source:** `.planning/todos/pending/swap-answer-fields-order.md`
  - **Signal:** visual inspection shows Display label first, Answer text second.

- [ ] **NODEUI-04**: In the Node Editor's Question form, the "Question text" textarea auto-grows with its content, and its label + helper description ("Displayed to the user during the protocol session") render **above** the textarea so the full panel width is available for input.
  - **Source:** `.planning/todos/pending/question-textarea-autogrow.md`
  - **Signal:** textarea height recomputes on input; label block stacked above textarea (not beside it).

- [ ] **NODEUI-05**: The Node Editor's quick-create buttons (Create question / answer / snippet / loop node) are relocated to the **bottom** of the panel and arranged as a single **vertical** column, each button full-width.
  - **Source:** `.planning/todos/pending/node-editor-create-buttons-bottom-stack.md`
  - **Signal:** `.rp-editor-create-toolbar` sits at the panel bottom; flex-direction column; `flex-wrap` constraint no longer relevant because buttons are single-column.

### Edge Semantics (EDGE)

- [ ] **EDGE-01**: A loop node's outgoing edges follow a new convention: **exactly one** labeled edge is the loop exit (its label becomes the exit button caption in Runner); all unlabeled outgoing edges are body branches. `GraphValidator` rejects loop nodes with zero or two-or-more labeled outgoing edges with clear Russian error messages naming the offending node.
  - **Source:** `.planning/todos/pending/loop-node-exit-from-edge-label.md` + `.planning/notes/loop-node-exit-edge-convention.md`
  - **Signal:** Runner's exit button text equals the labeled edge's label (no hardcoded «выход»); validation catches both error cases; unlabeled-edges iteration behaviour unchanged.
  - **Migration note:** this supersedes the v1.7 convention of matching the literal label «выход» as the exit discriminator. A migration step may be needed for canvases that relied on the old convention.

- [ ] **EDGE-02**: `Answer.displayLabel` and every incoming Question→Answer edge label are bound to the same source of truth: editing either side updates the other. On the canvas, edge labels on Question→Answer connections render from `Answer.displayLabel`. Per-edge label overrides are not supported in this milestone.
  - **Source:** `.planning/todos/pending/sync-answer-displaylabel-with-edge-label.md` + `.planning/notes/answer-label-edge-sync.md`
  - **Signal:** editing Display label in Node Editor updates every incoming edge's rendered label; editing any incoming edge label updates `Answer.displayLabel` and re-syncs the other incoming edges.
  - **Trade-off:** multi-incoming Answer nodes always display the same label on every incoming edge (user confirmed no current multi-incoming topologies).

### Snippet Node & Picker (PICKER)

- [ ] **PICKER-01**: A Snippet node may bind to either a directory (existing behaviour) **or** a specific snippet file (new). When the Runner reaches a specific-bound Snippet node:
  - if it is the sole option at the step → insert the snippet text automatically (no click required);
  - if it sits among sibling options → render as a single clickable choice button;
  - the placeholder fill-in modal still runs before insertion for `.json` snippets with placeholders in both paths.
  - **Source:** `.planning/todos/pending/snippet-node-bind-to-specific-snippet.md` + `.planning/notes/snippet-node-binding-and-picker.md`
  - **Signal:** existing directory-bound Snippet nodes keep working unchanged; new binding variant co-exists.

- [ ] **PICKER-02**: The Node Editor's target-selection widget for Snippet nodes is a **hierarchical navigator** (tree drill-down with breadcrumb) with a search field at the top that filters across the whole tree by name. The picker can select either a folder (directory binding) or a specific snippet file (specific binding).
  - **Source:** `.planning/todos/pending/hierarchical-snippet-picker.md` + `.planning/notes/snippet-node-binding-and-picker.md`
  - **Signal:** flat-list directory picker is gone; a unified hierarchical picker component is reused wherever a snippet or folder is chosen. Pure UI change: stored path shape on the node is unchanged and existing saved protocols still load.

### JSON Snippet Placeholders (PHLD)

- [ ] **PHLD-01**: JSON snippet placeholder types are collapsed to exactly two: `free text` and a unified `choice`. The `number` and `multichoice` types are removed. The unified `choice` renders as multi-select in the Runner fill-in modal; selecting a single option inserts that value, selecting multiple joins them with a separator (default `", "`, overridable via an optional per-placeholder `separator` field). The snippet editor's options-list UI works correctly — adding, editing, reordering, and removing options persists. Loading a `.json` snippet that declares a removed type is a hard validation error surfaced in the snippet editor and blocks Runner use.
  - **Source:** `.planning/todos/pending/json-snippet-placeholder-rework.md` + `.planning/notes/json-snippet-placeholder-rework.md`
  - **Signal:** placeholder schema updated; snippet editor type selector shows two options; existing `choice`/`multichoice` options-editor bug is fixed; no automatic migration of legacy snippets (user confirmed none exist).

### Distribution (BRAT)

- [ ] **BRAT-01**: The repository is prepared for installation through BRAT (Beta Reviewers Auto-update Tester). `manifest.json` `version`, `versions.json` mapping, and git tag/release naming are aligned; a GitHub **Release** exists with `manifest.json`, `main.js`, and `styles.css` attached as downloadable assets. Installing via BRAT with identifier `vegacepticon/RadiProtocol` succeeds in a fresh Obsidian vault.
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
| RUNFIX-03 | Phase 47 | planned |
| NODEUI-01 | Phase 48 | planned |
| NODEUI-02 | Phase 48 | planned |
| NODEUI-03 | Phase 48 | planned |
| NODEUI-04 | Phase 48 | planned |
| NODEUI-05 | Phase 48 | planned |
| EDGE-01   | Phase 49 | planned |
| EDGE-02   | Phase 50 | planned |
| PICKER-01 | Phase 51 | planned |
| PICKER-02 | Phase 51 | planned |
| PHLD-01   | Phase 52 | planned |
| BRAT-01   | Phase 53 | planned |

*Phase assignments filled in by the roadmapper on 2026-04-18.*
