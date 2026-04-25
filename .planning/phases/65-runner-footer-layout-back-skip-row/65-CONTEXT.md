# Phase 65: Runner Footer Layout - Back/Skip Row - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 65 is a presentation-only rework of Runner runtime navigation controls for `RUNNER-02` across all three runner modes: sidebar, tab, and inline.

It renames the visible Step back control to `Back`, renders Skip as a visible text button `Skip`, and moves Skip out of the mixed answer/snippet branch area into a dedicated footer row alongside Back. It does not change Skip semantics, step-back behavior, runner state machine rules, graph traversal, snippet behavior, loop behavior, or output toolbar actions.

**In scope:** DOM placement, visible labels, responsive footer styling, helper/render pattern reuse across `RunnerView` and `InlineRunnerModal`, tests that prove Skip no longer appears between answer and snippet branch groups.

**Out of scope:** new Skip destinations, Skip in snippet/loop states, step-back reliability fixes, scroll pinning, output toolbar redesign, new runner states, keyboard shortcuts.

</domain>

<decisions>
## Implementation Decisions

### Footer Placement

- **D-01:** Runtime navigation controls live in a dedicated footer row below all branch/picker UI inside the question zone and above the output toolbar. On mixed answer+snippet questions, render order must be: question text, answer buttons, snippet branch buttons, footer row, output toolbar.
- **D-02:** Skip must never render between `rp-answer-list` and `rp-snippet-branch-list`. This intentionally supersedes Phase 53 D-01, where Skip lived as a sibling below the answer list inside `rp-question-zone`.
- **D-03:** The output toolbar remains only for output actions such as Copy/Save/Insert. Do not move Back or Skip into `rp-output-toolbar`; Phase 53 D-03 remains valid.

### Responsive Footer Row

- **D-04:** The footer row uses a horizontal flex layout with `flex-wrap: wrap`. Back and Skip sit on the same row at normal widths, but may wrap to a second line at narrow sidebar widths rather than clipping off-screen.
- **D-05:** The footer row should stay compact and secondary to answer/snippet choices. It should not become a full-width vertical stack unless wrapping is required by available width.

### Button Copy and Visual Treatment

- **D-06:** Visible button labels are Sentence case: `Back` and `Skip`. This is an intentional clarification over roadmap lowercase wording (`back`/`skip`). Downstream agents should implement and test `Back`/`Skip` exactly.
- **D-07:** Skip is text-only. Remove the icon-only Phase 53 treatment and do not retain `skip-forward` as visible decoration. Accessibility labels/titles may remain descriptive, but the visible control must be text.
- **D-08:** Step back copy is fully retired in all runner modes and states. No visible `Step back` text should remain in `RunnerView` or `InlineRunnerModal`.

### Cross-State Row Rules

- **D-09:** Back-only states still use the same footer row pattern. If `state.canStepBack` is true and Skip is not valid, render a footer row containing only `Back`.
- **D-10:** Skip remains available only for `at-node` question states with at least one answer-kind neighbor, inheriting Phase 53 D-07/D-08. Do not add Skip to `awaiting-snippet-pick`, `awaiting-snippet-fill`, `awaiting-loop-pick`, complete, error, or idle states.
- **D-11:** Skip behavior is unchanged: first answer neighbor in adjacency order, no text append, undo entry pushed by `runner.skip()`, caller captures manual edit before `skip()`. Phase 65 only moves and relabels the control.

### Shared Render Pattern

- **D-12:** A shared render/helper pattern is required so sidebar/tab (`RunnerView`) and inline (`InlineRunnerModal`) cannot drift. Planner may choose the exact shape, but the plan must specify one reusable contract for creating the footer row and wiring Back/Skip handlers.
- **D-13:** Shared CSS classes should be used for the footer row and buttons across modes. Inline mode may keep scoped overrides under `.rp-inline-runner-content`, but the base structure should match the main runner.
- **D-14:** Tests should assert both DOM placement and copy: Skip appears after snippet branch buttons on mixed questions, Back/Skip labels are visible, old `Step back` text is absent, and Back-only footer rows render in picker states where `canStepBack` is true.

### the agent's Discretion

- Exact helper name and location, as long as the helper pattern prevents behavior drift between `RunnerView` and `InlineRunnerModal`.
- Exact CSS selector names for the footer row, with preference for a clear shared class such as `rp-runner-footer-row`.
- Whether the helper accepts pre-bound callbacks or receives runner state and constructs handlers internally.
- Exact spacing tokens, border treatment, and hover/focus styling, as long as controls remain readable, accessible, and visually secondary to branch choices.
- Whether `aria-label`/`title` use `Back`/`Skip` or more descriptive text such as `Go back one step` / `Skip this question`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 65 Requirements

- `.planning/ROADMAP.md` §Phase 65 — goal and success criteria for Runner Footer Layout: Back/Skip Row.
- `.planning/REQUIREMENTS.md` RUNNER-02 — v1.10 requirement defining Back/Skip placement and mixed-branch constraint.
- `.planning/PROJECT.md` Current Milestone / Runner UX — milestone-level statement of Back/Skip footer expectations.

### Prior Decisions

- `.planning/milestones/v1.8-phases/53-runner-skip-close-buttons/53-CONTEXT.md` — existing Skip behavior, visibility gates, undo semantics, capture-before-advance requirement; Phase 65 supersedes only icon-only visual treatment and placement.
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-CONTEXT.md` — inline runner parity expectations and command/modal constraints.
- `.planning/notes/inline-protocol-mode.md` — inline mode uses the note as buffer and must preserve runner parity without adding textarea/output behavior.
- `.planning/notes/snippet-node-binding-and-picker.md` — mixed answer+snippet branch behavior and file-bound/directory-bound snippet branch presentation.

### Current Code Touchpoints

- `src/views/runner-view.ts` — main sidebar/tab runner render path; current Skip is created in the question branch before snippet branches, and Step back buttons appear in multiple states.
- `src/views/inline-runner-modal.ts` — inline runner render path; duplicates current Skip and Step back placement/copy and must be updated in parallel.
- `src/runner/protocol-runner.ts` — `skip()` semantics; Phase 65 should not change this method except tests if needed.
- `src/styles/runner-view.css` — base runner CSS. Append Phase 65 footer/button rules here and regenerate `styles.css` via build.
- `src/styles/inline-runner.css` — inline scoped sizing overrides. Append only if inline needs mode-specific footer sizing.
- `CLAUDE.md` — CSS append-only and generated `styles.css` build rule.

### Test Surface

- `src/__tests__/views/runner-snippet-sibling-button.test.ts` — mixed answer+snippet branch rendering tests; likely best place to assert Skip is not between branch groups.
- `src/__tests__/views/runner-snippet-picker.test.ts` — existing Step-back rendering in snippet picker; should be updated for Back-only footer row and copy.
- `src/__tests__/views/inline-runner-modal.test.ts` — inline runner UI parity; should assert `Back`/`Skip` copy and footer placement.
- `src/__tests__/runner/protocol-runner-skip.test.ts` — skip engine behavior; should stay green without semantic changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `ProtocolRunner.skip()` in `src/runner/protocol-runner.ts` already implements the correct semantic behavior: question-only, first answer neighbor, no text append, undo-before-mutate.
- Existing click handlers in `RunnerView` already perform the correct capture-before-advance sequence before `runner.skip()`.
- Existing `rp-step-back-btn` and `rp-skip-btn` classes can be retained or extended, but current `.rp-skip-btn` CSS is icon-only and must be superseded by Phase 65 text-button styling.
- Inline mode already uses the same class names inside `.rp-inline-runner-content`, which can support shared footer CSS with scoped overrides.

### Established Patterns

- Runner UI is plain DOM via Obsidian `createEl` / `createDiv`; `RunnerView` uses `registerDomEvent`, while `InlineRunnerModal` currently uses direct `addEventListener` inside the modal lifecycle.
- CSS source of truth is `src/styles/runner-view.css` and `src/styles/inline-runner.css`; root `styles.css` is generated and must not be manually edited.
- Runtime navigation is distinct from output actions. Phase 53 explicitly kept Skip out of the output toolbar; Phase 65 keeps that separation.
- Sidebar and tab modes share `RunnerView`; inline mode has a separate `InlineRunnerModal` implementation and has already drifted in small behavior/copy details, so helper reuse is important.

### Integration Points

- In `RunnerView.render()`, the `case 'question'` branch currently creates Skip before snippet branches. That must move to footer creation after all branch lists.
- In `RunnerView.render()`, Step back buttons currently appear in `at-node`, `awaiting-loop-pick`, and `renderSnippetPicker`; all should route through the new footer row and visible copy `Back`.
- In `InlineRunnerModal.render()`, the `case 'question'`, `awaiting-loop-pick`, and `renderSnippetPicker` paths mirror the same issues and must be updated consistently.
- The helper should allow Back-only and Back+Skip configurations. It should not expose Skip in non-question states.

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose discussion in Russian, but the plugin UI remains English-only per project decision; button labels should be English `Back` and `Skip`.
- User chose `Back`/`Skip` Sentence case despite roadmap lowercase wording. Treat this as the locked implementation decision for Phase 65.
- User wants footer row below all branches/pickers, not in the output toolbar and not between answer and snippet groups.
- User wants responsive wrapping over clipping at narrow sidebar widths.

</specifics>

<deferred>
## Deferred Ideas

- Skip in snippet picker, snippet fill, or loop picker states — out of scope; Phase 65 preserves Phase 53 question-only Skip semantics.
- Step-back reliability, double-click behavior, Processing hang, loop undo correctness, and scroll pinning — Phase 66.
- Keyboard shortcuts for Back/Skip — future phase if needed.
- Output toolbar redesign — future phase if needed.

</deferred>

---

*Phase: 65-runner-footer-layout-back-skip-row*
*Context gathered: 2026-04-25*
