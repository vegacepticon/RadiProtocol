# Phase 53: Runner Skip & Close Buttons - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add two new Runner controls:

1. **Skip** — advances past the current node without inserting anything into the Runner textarea. Operates only when a question node is active. Traverses the first outgoing answer edge (graph order) to the next node WITHOUT emitting the answer's text. Skip is itself a recordable step (pushes an `UndoEntry`); step-back returns the user to the question's answer list as if the choice were never made.

2. **Close** — unloads the currently loaded canvas. When the runner is in-progress (`at-node` / `awaiting-snippet-pick` / `awaiting-snippet-fill` / `awaiting-loop-pick`), the existing `CanvasSwitchModal` (same modal used for D-12 mid-session switch confirmation) is shown first; confirmation clears the active session via `sessionService.clear()` and resets the view. When idle / complete / error, Close skips the modal and resets directly. The end state is identical to fresh plugin open: selector returns to its placeholder, `runnerStatus` is `idle`, no canvas is loaded.

**Out of scope (belongs in other phases):** new runner states, new graph-level edge conventions for Skip (author-defined "skip" edge), keyboard shortcuts for Skip/Close, Skip behavior in `awaiting-snippet-pick` / `awaiting-snippet-fill` / `awaiting-loop-pick`.

</domain>

<decisions>
## Implementation Decisions

### UI Placement (D-01 … D-03)

- **D-01:** Skip button lives in the **question zone**, rendered below `rp-answer-list` (same container that holds the answer buttons). It is part of the "runtime navigation" surface, not the output toolbar.
- **D-02:** Close button lives in the **selector bar** (the existing `selectorBarEl` row that hosts `CanvasSelectorWidget`). It is a canvas-level action, semantically distinct from runtime actions.
- **D-03:** The output toolbar (`rp-output-toolbar`) is NOT touched — Copy/Save/Insert remain as-is. No new runtime controls are added there.

### Visual Treatment (D-04 … D-06)

- **D-04:** Both Skip and Close are **icon-only** buttons rendered via Obsidian's `setIcon(el, name)` helper. Text labels live in `aria-label` + `title` (tooltip) for accessibility and hover discoverability.
- **D-05:** Suggested lucide icons (planner confirms availability):
  - Skip → `skip-forward` (matches the semantic of "advance past")
  - Close → `x` (standard close glyph across Obsidian)
- **D-06:** Close uses **neutral styling** — no `mod-warning` class, no destructive red. The confirmation modal (when shown) carries the warning semantics, not the button itself.

### Skip Semantics (D-07 … D-11)

- **D-07:** Skip is active **only** when `runner.getState().status === 'at-node'` AND the current node's `kind === 'question'`. In every other state (`idle` / `at-node` with `text-block` / `awaiting-snippet-pick` / `awaiting-snippet-fill` / `awaiting-loop-pick` / `complete` / `error`), the Skip button is not rendered.
- **D-08:** On Skip click the runner advances to the **first answer neighbor in adjacency order** (`graph.adjacency.get(currentNodeId)[0]` filtered to `kind === 'answer'`) without appending the answer's `answerText` to the accumulator.
  - If the question has no answer neighbors but has snippet neighbors, Skip is disabled (no natural target) — planner will confirm whether this degenerate case needs a user-visible message.
  - If the question has zero outgoing edges, Skip is disabled.
- **D-09:** Skip does NOT traverse any snippet neighbor. Mixed `answer + snippet` branches (Phase 31) — Skip still picks the first *answer* neighbor, ignoring snippet branches entirely.
- **D-10:** Skip **is a full choice** — it pushes an `UndoEntry` (same pattern as answer click). Step-back returns to the question node with answers re-rendered and an unchanged accumulator.
- **D-11:** Skip MUST call `this.runner.syncManualEdit(this.previewTextarea?.value ?? '')` **before** advancing (capture-before-advance pattern, BUG-01). Manual textarea edits preceding Skip must survive into the undo snapshot.

### Close Semantics (D-12 … D-16)

- **D-12:** Close is rendered whenever `canvasFilePath !== null` (i.e., any canvas is loaded — including `complete` / `error` states). It is NOT rendered when the runner is at the fresh "no canvas selected" state.
- **D-13:** On Close click, check the runner state. The "needs confirmation" set is the same one used in `handleSelectorSelect` (D-12/D-13 logic):
  - `at-node` / `awaiting-snippet-pick` / `awaiting-snippet-fill` / `awaiting-loop-pick` → open `CanvasSwitchModal`; only proceed on `true` result.
  - `idle` / `complete` / `error` → proceed directly, no modal.
- **D-14:** On confirmed close (or no-confirmation path), perform in this order:
  1. `await this.plugin.sessionService.clear(this.canvasFilePath)` — drop persisted session.
  2. Tear down runner-local state: `this.runner = null` (or re-init to the null-canvas state the constructor produces), `this.graph = null`, `this.canvasFilePath = null`, `this.previewTextarea = null`.
  3. Reset `this.selector` label back to its placeholder via `selector.setSelectedPath(null)` (or equivalent — planner confirms the widget API).
  4. Re-render. The resulting view MUST be visually identical to a fresh plugin open with no canvas ever selected (same `idle` branch of `render()`).
- **D-15:** The `CanvasSwitchModal` is reused as-is — no new modal. Its existing copy ("Switch protocol canvas? / The active session will be reset.") is acceptable for the Close path because the user-visible outcome is the same (session reset). Planner may propose a copy tweak if reuse feels misleading, but reuse is the default.
- **D-16:** Close does NOT leave any selector "memory" of the previously loaded canvas. Full reset — the selector starts empty, as at first plugin open.

### Claude's Discretion

- Exact lucide icon choice (D-05) — planner may substitute another lucide name if `skip-forward` isn't available in Obsidian's bundled icon set.
- Button DOM structure — whether Skip sits inside `rp-answer-list` as a sibling `<button>` or in a new `rp-runner-nav` sub-container under the answer list is a planner/executor call. Ditto Close placement inside the existing `selectorBarEl` flex row.
- The "disabled vs hidden" decision when Skip has no valid target (degenerate question with no answer neighbors) — planner picks one, noting the trade-off inline.
- CSS phase-comment scope — new rules land at the bottom of `src/styles/runner-view.css` with a `/* Phase 53: Skip & Close buttons */` header per `CLAUDE.md` append-only rule.
- Whether to add an `aria-label` / `role="toolbar"` wrapper around Skip for a11y — planner discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Runner state machine & dispatch

- `src/runner/runner-state.ts` — discriminated union of `RunnerState`; all 7 status values Skip/Close must reason about.
- `src/runner/protocol-runner.ts` — `advanceThrough`, `syncManualEdit`, `stepBack`, `UndoEntry` shape. Skip must push a compatible `UndoEntry`; reference `choose()` and the answer-click path as the model.

### Runner view & confirmation modal

- `src/views/runner-view.ts` — `render()` branches per status; `handleSelectorSelect()` contains the reference D-12/D-13 confirmation pattern Close must mirror; `renderOutputToolbar()` and the `selectorBarEl` construction show where buttons attach.
- `src/views/canvas-switch-modal.ts` — `CanvasSwitchModal` reused verbatim by Close.
- `src/views/canvas-selector-widget.ts` (implicit) — `selector.setSelectedPath(...)` API used to reset the selector label on Close.

### Styling

- `src/styles/runner-view.css` — append-only per phase (CLAUDE.md rule). Existing classes of interest: `.rp-runner-view`, `.rp-question-zone`, `.rp-answer-list`, `.rp-answer-btn`, `.rp-output-toolbar`.
- `esbuild.config.mjs` — `CSS_FILES` list; no new CSS files needed for Phase 53 (changes live in `runner-view.css`).

### Prior decisions that apply

- `.planning/phases/43-loop-runtime-model/43-CONTEXT.md` (if present) — «выход» edge convention for loop exit (informs D-09: Skip is deliberately NOT a «выход»-style named edge).
- `.planning/phases/49-loop-exit-edge-convention/49-CONTEXT.md` — confirms the project's stance on deriving exits from graph edges rather than inventing new node-level flags.
- `CLAUDE.md` — "never remove existing code you didn't add" + CSS append-only rule apply in full.

### Project-level

- `.planning/PROJECT.md` — Key Decisions: "capture-before-advance pattern (BUG-01)" (D-11), "Live textarea read in complete-state toolbar" (informs Close teardown ordering).
- `.planning/REQUIREMENTS.md` — will receive new Phase 53 requirement IDs (RUNNER-SKIP-* / RUNNER-CLOSE-*) during planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CanvasSwitchModal`** — reused verbatim for Close confirmation (D-15). Zero changes.
- **`sessionService.clear(path)`** — already invoked by `handleSelectorSelect` and `restartCanvas`. Close uses the same call.
- **`runner.syncManualEdit(text)`** — capture-before-advance path (BUG-01). Skip click handler MUST call it before `advanceThrough` (D-11).
- **`selector.setSelectedPath(path | null)`** — already used in `handleSelectorSelect` to revert on cancel. Close uses `setSelectedPath(null)` (or equivalent API) to return the selector to its placeholder state.
- **Obsidian `setIcon(el, name)`** — standard plugin helper for icon buttons; matches Obsidian native affordances.

### Established Patterns

- **Capture-before-advance (BUG-01):** every forward-advance click handler in RunnerView calls `this.runner.syncManualEdit(this.previewTextarea?.value ?? '')` as its first line. Skip follows this rule (D-11).
- **Confirmation-before-destructive (D-12/D-13):** `handleSelectorSelect` is the canonical reference. Close mirrors the same branching on `state.status` (D-13).
- **Append-only CSS per phase:** new rules at the bottom of the relevant feature file with a phase comment (CLAUDE.md). Applies here.
- **`registerDomEvent` for all DOM listeners:** no raw `addEventListener`. Applies to Skip/Close button handlers.

### Integration Points

- **Skip button DOM:** appended as sibling of `rp-answer-list` (or sibling under `questionZone`) in the `case 'question'` branch of `render()`. Only rendered when `kind === 'question'` (D-07).
- **Close button DOM:** appended into `selectorBarEl` next to the existing `CanvasSelectorWidget` mount point. Visibility gated on `canvasFilePath !== null` (D-12). `selectorBarEl` already survives `contentEl.empty()` via the `prepend` trick — Close attaches there once in `onOpen` and lives alongside re-renders.
- **Undo stack integration:** `protocol-runner.ts` currently pushes `UndoEntry` inside `choose()` and `pickSnippet()`. A new `skip()` method (or an extended `advance()` variant) is the cleanest attach point — planner decides naming.
- **Session persistence:** Skip itself doesn't change the persisted schema (runner status remains `at-node` → `at-node` with a different `currentNodeId`). Close triggers `sessionService.clear()` before teardown — no schema impact.

</code_context>

<specifics>
## Specific Ideas

- The user described Skip as **"пропустить текущий узел и перейти к следующему узлу по сценарию"** — emphasis on "по сценарию" (along the script) is what drives D-08: Skip follows the graph's first answer edge rather than ending the protocol or asking the author to draw a special skip-edge.
- The user explicitly chose **"До следующего merge point"** when branching is ambiguous — acknowledging that with multiple parallel answers, Skip picks the first-in-adjacency path and is acceptable for the v1.8 UX goals. If future protocols have non-merging parallel branches, re-evaluation can happen in a later phase.
- The user preferred **Obsidian-native icon buttons** over Russian text labels — consistent with Phase 45's 4-kind Russian badges being the exception for NodePickerModal, not the runner itself.
- Close reuses the same confirmation modal as canvas switch — the user implicitly accepted "Switch protocol canvas?" copy for Close by choosing the "reuse existing modal" path (D-15).

</specifics>

<deferred>
## Deferred Ideas

- **Skip in snippet picker / loop picker / snippet-fill modal** — user restricted Skip to `at-node` question only (D-07). If later a "skip this snippet" or "skip this loop iteration" UX is needed, it's a separate phase with its own semantics (snippet cancel already exists; loop «выход» already exists).
- **Author-defined "skip"-edge convention** (option 3 in the initial branching question) — explicitly rejected for this phase. If future protocols need predictable Skip destinations beyond "first adjacency", reintroduce as a dedicated graph-convention phase.
- **Keyboard shortcuts for Skip/Close** (e.g., `S` / `Esc`) — out of scope; the phase is UI-addition only.
- **"Close" styled as destructive (mod-warning) with variable visibility** — user chose neutral, always-visible (D-06 / D-12). If UX testing reveals accidental closes, revisit in a polish phase.
- **Selector "memory" after Close** (re-surface last canvas as a quick-run hint) — explicitly rejected (D-16). Could return as an ergonomics phase post-v1.8.
- **Skip as one-way non-undoable action** — explicitly rejected (D-10). If future protocols introduce "commit point" semantics where some choices must be irreversible, that's a separate engine-level feature.

</deferred>

---

*Phase: 53-runner-skip-close-buttons*
*Context gathered: 2026-04-20*
