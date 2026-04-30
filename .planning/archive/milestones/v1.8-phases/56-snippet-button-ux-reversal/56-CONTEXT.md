# Phase 56: Snippet Button UX Reversal — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 56 reverses two Phase 51 design decisions so every file-bound Snippet node in the Runner renders as a click-button (never auto-advances, never routes through a picker), and strengthens folder-selection feedback in SnippetEditorModal. Specifically:

1. **Runner (PICKER-01 reversal):** a Question node whose only outgoing edge is a file-bound Snippet must render a single choice button (not auto-advance). Any click on a file-bound Snippet sibling button (single or multi) dispatches the snippet-fill path **directly** — `.md` inserts immediately, `.json` with placeholders opens SnippetFillInModal before insertion, `.json` without placeholders inserts template immediately — without going through `chooseSnippetBranch → awaiting-snippet-pick → picker`. Reverses Phase 51 D-13 (`src/runner/protocol-runner.ts:~580-613`) and D-16 click routing (`src/views/runner-view.ts:~452-459` / ~558-564).
2. **Directory-bound preserved:** nodes with only `radiprotocol_subfolderPath` (no `radiprotocol_snippetPath`) keep the existing button → SnippetTreePicker drill-down flow. Zero regression.
3. **Undo / scroll invariants preserved:** D-15 undo-before-mutate ordering and Phase 47 RUNFIX-02 `capturePendingTextareaScroll()` as FIRST line of every new/modified click handler.
4. **SnippetEditorModal folder-selection feedback (new):** visible "unsaved changes" indicator next to the «Папка» label whenever current selection differs from saved value (cleared on save/reset), and a persistent "committed" visual state on the «Выбрать эту папку» button immediately after click.

**In scope:** all source files listed in D-10. Success Criteria 1–8 from ROADMAP.md.
**Out of scope:**
- Changes to `radiprotocol_snippetLabel` / `radiprotocol_snippetSeparator` semantics.
- SnippetTreePicker internal API reshape — component is used as-is (folder-only / file-only modes unchanged).
- Picker component visual overhaul.
- Any touching of PICKER-02 / tree-wide search semantics (Phase 51 D-09..D-12).
- Placeholder schema changes (handled by Phase 52).

</domain>

<decisions>
## Implementation Decisions

### Single-edge file-bound rendering (SC 1)

- **D-01:** When a Question node has exactly one outgoing edge terminating at a file-bound Snippet, the Runner renders **one** choice button using **the same CSS class and caption grammar as the sibling-button path** — `.rp-snippet-branch-btn` + Phase 51 D-16 three-step caption fallback (`📄 {snippetLabel}` → `📄 {basename stem}` → `📄 Snippet`). One code-path handles both "sole outgoing" and "one of many" shapes. Rationale: uniform user gesture (always a button), single code path to maintain, single CSS surface.
- **D-02:** The Phase 51 D-13 auto-insert block in `protocol-runner.ts` case `'question'` (~lines 580-613) is **removed**. The default Question behaviour (halt at `at-node` with `runnerStatus='at-node'` and `currentNodeId=cursor`) becomes the only path; RunnerView then renders the snippet sibling-button list per D-01. The new unused branch and its comment block are deleted entirely — CLAUDE.md "never remove code you didn't add" does NOT prohibit removing code you **are** explicitly reversing by phase decision; this is the phase's mandate.

### Click dispatch path (SC 2)

- **D-03:** Introduce a new public method on `ProtocolRunner`:
  ```
  pickFileBoundSnippet(questionNodeId: string, snippetNodeId: string, snippetPath: string): void
  ```
  Semantics (mirrors Phase 51 D-14/D-15 exactly, but triggered from click instead of auto-advance):
  1. Assert current state is `at-node` + Question node id matches.
  2. Push `UndoEntry` keyed on the Question node (textSnapshot = accumulator.snapshot(); loopContextStack copy) BEFORE mutation — D-15 undo-before-mutate.
  3. Set `this.snippetId = snippetPath`, `this.snippetNodeId = snippetNodeId`, `this.currentNodeId = snippetNodeId`.
  4. Set `this.runnerStatus = 'awaiting-snippet-fill'`.
  5. Return (no traversal loop run — next render hits the existing `awaiting-snippet-fill` arm which handles .md / .json fork via `handleSnippetFill`).
- **D-04:** RunnerView sibling-button click handler branches on binding kind BEFORE dispatching:
  - `isFileBound` (D-01 predicate) → call `pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetNode.radiprotocol_snippetPath!)` — NEVER through `chooseSnippetBranch`.
  - Directory-bound → existing Phase 51 path: `chooseSnippetBranch(snippetNode.id)` → `awaiting-snippet-pick` → picker (unchanged).
  Every new handler keeps the canonical 5-step prologue: `capturePendingTextareaScroll()` FIRST → `syncManualEdit()` → dispatch → `autoSaveSession()` → `renderAsync()`.
- **D-05:** `chooseSnippetBranch` and `pickSnippet` remain unchanged in the runner. Only `runner-view.ts` dispatch routing changes for the file-bound branch.

### Undo semantics (SC 4)

- **D-06:** `stepBack()` from `awaiting-snippet-fill` (before user clicks insert / before SnippetFillInModal commit) restores the Question node with the pre-insertion accumulator — same entry shape as Phase 51 D-15, works by construction because D-03 pushes the same `UndoEntry` variant. No new branch in `stepBack`.
- **D-07:** `stepBack()` from post-insertion (runner moved past the Snippet node) behaves identically to existing Phase 51 D-15 semantics — exercise via test case in SC 8.

### Unsaved-change indicator (SC 6)

- **D-08:** SnippetEditorModal shows a small dot/bullet indicator (•) immediately adjacent to the «Папка» field label when the in-modal `pendingFolderPath` differs from the saved snippet's stored folder path. Indicator is an inline `<span>` with a dedicated CSS class (e.g. `.rp-snippet-editor-unsaved-dot`) styled with the Obsidian accent colour variable (`var(--interactive-accent)`). Indicator appears on every change that creates a diff (including picker selection, manual edit, or drilling to a different folder and clicking «Выбрать эту папку»). Indicator disappears when:
  - the user clicks save (modal commits) — pending becomes saved, diff = 0;
  - the user resets to original (if a reset control exists) or cancels the modal.
- **D-09:** Global modal header badge / border-colouring alternatives are **not** used — SC 6 is satisfied by the inline label dot alone.

### Committed-state for «Выбрать эту папку» button (SC 7)

- **D-10:** After click, the «Выбрать эту папку» button transitions to a **persistent committed visual state**:
  - Background → `var(--interactive-accent)` (Obsidian accent);
  - Text colour → `var(--text-on-accent)`;
  - Label swaps from «Выбрать эту папку» to «✓ Выбрано» (checkmark U+2713 + Russian word).
  The state persists for the lifetime of the current drill session at that folder. State resets (button returns to default label + neutral colour) when:
  - the user drills into a different folder (`drillPath` changes) — new folder is unselected;
  - the user navigates up out of the currently-selected folder;
  - the picker is unmounted / re-mounted.
  Implementation hook: `SnippetTreePicker` tracks `committedRelativePath: string | null` internally; `renderDrillView()` compares `drillPath.join('/')` to `committedRelativePath` and renders the button accordingly.

### File-touch map (in-phase)

- **D-11:** Files modified:
  - `src/runner/protocol-runner.ts` — remove D-13 block (D-02); add `pickFileBoundSnippet` (D-03).
  - `src/views/runner-view.ts` — rewrite sibling-button click dispatch branching (D-04); single-edge case already flows through the existing snippetNeighbors path once D-02 removes the auto-insert short-circuit, so no new render branch is needed.
  - `src/views/snippet-editor-modal.ts` — add unsaved-change dot element + diff computation (D-08).
  - `src/views/snippet-tree-picker.ts` — add `committedRelativePath` state + button label/colour swap (D-10).
  - `src/styles/snippet-tree-picker.css` — append-only CSS for committed button state (D-10) under `/* Phase 56: committed-state ... */` comment.
  - `src/styles/snippet-manager.css` (or wherever `snippet-editor-modal` styles live — planner verifies which file; likely a new CSS feature file `src/styles/snippet-editor-modal.css` registered per CLAUDE.md). Append the `.rp-snippet-editor-unsaved-dot` rule.
- **D-12:** Files NOT modified (safety sentinel per CLAUDE.md shared-file discipline):
  - `src/graph/graph-model.ts`, `src/graph/canvas-parser.ts`, `src/graph/graph-validator.ts` — storage shape unchanged; D-04 validator logic from Phase 51 remains.
  - `src/snippets/snippet-service.ts` — unchanged.
  - `src/views/editor-panel-view.ts` — unchanged.

### Test strategy (SC 8)

- **D-13:** Extend existing Phase 51 test files rather than create Phase-56-scoped new files:
  - `src/__tests__/views/runner-snippet-sibling-button.test.ts` — add direct-insert path assertions (file-bound sibling click → `pickFileBoundSnippet` called, NOT `chooseSnippetBranch`; .md inserts; .json-with-placeholders opens modal; .json-without-placeholders inserts).
  - `src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` — **invert expectation**: single-edge file-bound no longer auto-advances; now renders one button whose click takes the direct-insert path.
  - `src/__tests__/views/runner-snippet-picker.test.ts` — add regression test that directory-bound single-edge and sibling still route through picker (unchanged).
  - `src/__tests__/views/snippet-editor-modal-banner.test.ts` — extend with unsaved-dot visibility tests (appears on change, disappears on save/reset).
  - `src/__tests__/views/snippet-tree-picker.test.ts` — add test for committed-state button label/style transitions on click and on drill change.
- **D-14:** Add a new ProtocolRunner unit test file if none covers `pickFileBoundSnippet` — Claude's discretion during planning.

### Claude's Discretion

- Exact CSS values (dot size, spacing to label) for the unsaved indicator — planner picks conservative values consistent with Obsidian's native unsaved-file dot.
- Whether to introduce `src/styles/snippet-editor-modal.css` as a new feature file in CLAUDE.md CSS Architecture or append to an existing file — planner decides after verifying where current SnippetEditorModal styles live.
- Exact method signature refinements on `pickFileBoundSnippet` (e.g. whether it also accepts the validated `SnippetNode` directly) — planner decides.
- Test-assertion granularity for committed-state transitions — planner decides how to observe `SnippetTreePicker` internal state from outside.

### Folded Todos

None — phase scope is fully specified by ROADMAP SC 1–8.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design notes & prior decisions (primary)
- `.planning/notes/snippet-node-binding-and-picker.md` — canonical Phase 51 design note; Phase 56 explicitly **reverses** the D-13 auto-insert and D-16 click-routing portions of this note. Planner must cite the reversal in module headers.
- `.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md` — Phase 51 decisions; D-13, D-14, D-15, D-16 are the subject of the reversal; D-01..D-12 remain intact.
- `.planning/phases/51-snippet-picker-overhaul/51-HUMAN-UAT.md` — UAT Tests 3 and 4 `design_reversal` sections document the user's reasoning for this reversal.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — `PICKER-01` (binding variants) continues to apply; Phase 56 refines its runtime dispatch to always-button-never-auto-advance for file-bound. `PICKER-02` unaffected.
- `.planning/ROADMAP.md` §Phase 56 — Goal + 8 Success Criteria (SC 1 single-button render, SC 2 direct-dispatch click, SC 3 directory-bound preserved, SC 4 undo preserved, SC 5 RUNFIX-02 scroll capture, SC 6 unsaved indicator, SC 7 committed-state button, SC 8 tests green).
- `.planning/STATE.md` §Standing Pitfalls #11 (stored canvas shape unchanged — satisfied natively, no migration).

### Existing code touched
- `src/runner/protocol-runner.ts` lines ~580-613 — D-13 auto-insert block (to remove in Phase 56).
- `src/views/runner-view.ts` lines ~452-459 (snippet sibling click dispatch) and ~524-566 (snippet-branch-list render) — click routing rewrite (D-04).
- `src/views/snippet-editor-modal.ts` — add unsaved-change dot (D-08).
- `src/views/snippet-tree-picker.ts` lines ~218-234 — select-folder button region; adds committed-state (D-10).
- `src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` — expectations invert (D-13).
- `src/__tests__/views/runner-snippet-sibling-button.test.ts` — add direct-dispatch cases (D-13).
- `src/__tests__/views/snippet-editor-modal-banner.test.ts` — add unsaved-dot cases (D-13).
- `src/__tests__/views/snippet-tree-picker.test.ts` — add committed-state cases (D-13).

### New files (possibly)
- `src/styles/snippet-editor-modal.css` — only if planner decides editor-modal styles deserve their own feature file; must be registered in `esbuild.config.mjs` `CSS_FILES`.

### Project rules
- `CLAUDE.md` — **CSS Architecture** (per-feature file under `src/styles/`, registered in `esbuild.config.mjs`; `styles.css` is generated — do not edit), **CSS files: append-only per phase**, **Never remove existing code you didn't add** (applies with the explicit exception that Phase 56's mandate is precisely to remove the D-13 auto-insert block — planner documents this in the PLAN and every commit message).
- `.planning/STATE.md` §Standing Pitfalls — maintain back-compat of stored canvas shape (Pitfall #11).

### User memory (project-level)
- `memory/project_snippet_node_ux.md` — the reversal direction is locked: file-bound = always button + direct insert; directory-bound = button → picker. All Phase 56 decisions must be consistent with this memory.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ProtocolRunner.pickSnippet`** (`protocol-runner.ts:256`) — canonical example of undo-before-mutate + set snippetId/snippetNodeId/currentNodeId + state transition. `pickFileBoundSnippet` (D-03) models its body on this structure.
- **`RunnerView.snippetNeighbors` render block** (`runner-view.ts:524-566`) — already partitions and renders sibling-button with `isFileBound`/Directory-bound caption branching from Phase 51 D-16. The **render side is already correct** — only the click handler's dispatch target changes (D-04).
- **`RunnerView` awaiting-snippet-fill arm** (`runner-view.ts:~530-540` and `handleSnippetFill`) — handles both .md (insert + advance) and .json (SnippetFillInModal → insert + advance). `pickFileBoundSnippet` simply transitions into this arm; no render work in the arm changes.
- **Canonical click-handler prologue** — 5 steps: `capturePendingTextareaScroll()` → `syncManualEdit()` → dispatch → `autoSaveSession()` → `renderAsync()`. All new/modified handlers follow this exactly.
- **`SnippetTreePicker` mount lifecycle** — component re-renders `drillPath` on each navigation; committed-state flag (D-10) fits naturally as an instance field compared against `drillPath.join('/')` inside `renderDrillView()`.

### Established Patterns
- **Undo-before-mutate in ProtocolRunner** (Pitfall 1) — all state-mutating methods push `UndoEntry` **before** any field mutation. D-03 conforms.
- **Append-only CSS per feature file** (CLAUDE.md) — new Phase 56 CSS rules go under a `/* Phase 56: ... */` comment at the end of the relevant `src/styles/*.css` file; `styles.css` is regenerated by `npm run build`.
- **RUNFIX-02 scroll capture** — first line of every click handler in `runner-view.ts`. D-04 enforces this.
- **Obsidian theme variables** — `var(--interactive-accent)`, `var(--text-on-accent)`, `var(--text-muted)` are used throughout existing styles; Phase 56 uses these rather than hard-coded colours for D-08 / D-10.

### Integration Points
- **`protocol-runner.ts` case `'question'`** — where D-13 auto-insert block is deleted (D-02). Default "halt at Question" path remains.
- **`runner-view.ts` snippet sibling-button click handler** — the single site where dispatch branching on `isFileBound` is added (D-04).
- **`snippet-editor-modal.ts` «Папка» field construction** — single site where the unsaved dot is appended next to the label (D-08).
- **`snippet-tree-picker.ts` select-folder button render** (~lines 218-234) — single site where committed-state label/CSS swap is applied (D-10).

</code_context>

<specifics>
## Specific Ideas

- Persistent committed state with swapped label («✓ Выбрано») is deliberately chosen over a flash animation — users have complained in prior phases (memory `project_snippet_node_ux.md`) that short-lived signals are missed during blink-and-you-miss-it interactions. Persistent accent + explicit label change gives an unambiguous anchor.
- The unsaved dot pattern mirrors Obsidian's own "unsaved file" indicator in the tab bar — intentional visual vocabulary alignment so users recognise the semantics without a legend.
- File-bound vs directory-bound click dispatch branches at the handler level (D-04), not at the runner API level — keeps `ProtocolRunner` free of UI concerns and makes the per-branch test surface trivial.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-select folder commit** — selecting several folders at once in SnippetEditorModal. Not requested; not in SC.
- **Global "unsaved changes" badge in modal header** — considered but rejected in favour of the localised dot (D-08/D-09). Revisit if future fields in SnippetEditorModal need the same treatment and a unified surface becomes justified.
- **Flash-and-return committed animation** — rejected in D-10; can be revisited if a future design system decision changes direction.
- **Moving D-13 auto-insert into a settings toggle** — considered as a middle-ground (let power users restore auto-advance). Rejected: user memory is explicit that file-bound should always render a button; adding a toggle reintroduces the rejected behaviour under a flag.
- **Runner UI variant for mixed sibling buttons (specific + directory-bound at same Question)** — already flagged Out-of-Scope in REQUIREMENTS.md; continues deferred.

</deferred>

---

*Phase: 56-snippet-button-ux-reversal*
*Context gathered: 2026-04-21*
