# Phase 3: Runner UI (ItemView) - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A radiologist can open any valid canvas as a protocol, step through all question types in the
right sidebar, see their report forming in real time, and copy it to the clipboard with one click.
`RunnerView` (ItemView) connects the fully-implemented Phase 2 `ProtocolRunner` engine to Obsidian UI.
No new engine logic in this phase — only wiring, DOM construction, settings tab, and output actions.

All three "Should have" requirements are included: RUN-10 (start from specific node),
RUN-11 (inline text editing), UI-12 (color legend).

</domain>

<decisions>
## Implementation Decisions

### Panel Layout
- **D-01:** RunnerView uses a **vertical two-zone split**: question/interaction zone fixed at the top,
  live preview zone scrollable at the bottom. A CSS flex column with `flex: 0 0 auto` on the top
  zone and `flex: 1 1 auto; overflow-y: auto` on the bottom zone. Both zones are independent —
  scrolling the preview does not scroll the question area.
- **D-02:** The question zone itself scrolls independently if answer buttons overflow (many options).
  This keeps the divider stable regardless of answer count.

### Answer Button Style
- **D-03:** Answer options render as a **vertical list of full-width buttons** — one button per line,
  spanning the full panel width. No truncation of label text; buttons wrap if needed. No grid layout.
  This accommodates long anatomical labels (e.g., "Правый надпочечник") without clipping and supports
  an unlimited number of answer options.

### Should-Have: Inline Text Editing (RUN-11)
- **D-04:** The live preview zone is a `textarea` element (not a `div` with `contenteditable`).
  When the user types in it, the runner's accumulated text is updated immediately via a new
  `setAccumulatedText(text: string)` method added to `ProtocolRunner`. This keeps accumulated text
  as a single source of truth in the runner, not split across runner state and view state.
- **D-05:** `setAccumulatedText()` replaces the current text buffer and **clears the undo stack**
  (manual edits cannot be undone via "Step back" — step back is for question navigation, not text
  edits). This is the simplest correct behaviour; a separate "undo text edit" is out of scope.

### Should-Have: Start from Specific Node (RUN-10)
- **D-06:** "Start from specific node" is exposed as a **second command**: `start-protocol-from-node`
  (separate from `run-protocol`). When invoked, it opens a `SuggestModal` listing all `question`
  and `text-block` nodes by their label. The user picks one; the runner's `start()` is called with
  that node as the entry point. This keeps the default "Run protocol" command clean and avoids a
  picker inside the panel idle state.
- **D-07:** `ProtocolRunner.start()` needs an optional `startNodeId?: string` parameter added.
  When provided, traversal begins from that node instead of `graph.startNodeId`. (Small Phase 2
  extension — zero behaviour change for existing callers that omit the parameter.)

### Should-Have: Color Legend (UI-12)
- **D-08:** A **collapsible "Legend" section** is added at the bottom of RunnerView (below the
  preview zone), collapsed by default. It lists the 7 node type colours used in the Canvas:
  start (green), question (blue), answer (white/default), free-text-input (yellow), text-block
  (purple), loop-start/loop-end (orange). One row per node type: colour swatch + type name +
  one-line description. Authored users can collapse it permanently; new authors benefit from
  seeing it on first use.

### getState / setState (UI-07)
- **D-09:** In Phase 3 (no SessionService yet), `getState()` stores `{ canvasFilePath: string | null }`.
  On workspace restore, `setState()` reloads the canvas path into RunnerView's idle state but does
  NOT resume the session (that requires Phase 7 SessionService). The view opens idle with the
  canvas preselected, ready for the user to re-run. This satisfies UI-07's "no full session data"
  requirement without depending on Phase 7 code. The `sessionId` field is added in Phase 7.

### Settings Tab (UI-10, UI-11)
- **D-10:** The settings tab implements three controls:
  1. **Output destination** — `DropdownComponent` with options: "Clipboard only", "New note only",
     "Both clipboard and new note". Maps to `outputDestination: 'clipboard' | 'new-note' | 'both'`.
  2. **Output folder path** — `TextComponent` shown/hidden based on destination selection.
     Visible only when destination is `new-note` or `both`. Maps to `outputFolderPath`.
  3. **Max loop iterations** — `SliderComponent` (range 10–200, step 10, default 50) with a
     text display of current value. Maps to `maxLoopIterations`.

### Plugin Wiring (main.ts)
- **D-11:** `main.ts` `onload()` is updated to:
  - Register `RunnerView` via `this.registerView(RUNNER_VIEW_TYPE, leaf => new RunnerView(leaf, this))`
  - Update `run-protocol` command to call `this.activateRunnerView()` (opens right sidebar)
  - Add `start-protocol-from-node` command that opens the node picker modal
  - Update ribbon icon to open RunnerView

### Claude's Discretion
- Exact CSS class names and visual styling (Obsidian theme variables preferred where available)
- Validation error panel layout (ordered list vs. card-per-error)
- Free-text input node UI (textarea height, placeholder text)
- Text-block auto-advance animation (if any)
- "Step back" button placement within the question zone
- Output button placement (toolbar at top or below preview zone)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Requirements (Phase 3 scope)
- `.planning/REQUIREMENTS.md` §UI-01 through UI-12 — all Runner UI requirements
- `.planning/REQUIREMENTS.md` §RUN-10, RUN-11 — should-have runner requirements included in this phase
- `.planning/REQUIREMENTS.md` §NFR-02 — no React; plain DOM + Obsidian helpers
- `.planning/REQUIREMENTS.md` §NFR-05 — sentence case for all UI text
- `.planning/REQUIREMENTS.md` §NFR-08 — settings loaded with defaults guard

### Architecture
- `.planning/research/ARCHITECTURE.md` §1 — component architecture; `RunnerView` registered in `onload()`
- `.planning/research/ARCHITECTURE.md` §10 — `getState()`/`setState()` pattern for ItemView persistence
- `.planning/research/ARCHITECTURE.md` §11 — command and entry point patterns; `activateRunnerView()` snippet

### Runner Engine (Phase 2 output — already implemented)
- `src/runner/protocol-runner.ts` — `ProtocolRunner` public API: `start()`, `chooseAnswer()`,
  `enterFreeText()`, `stepBack()`, `completeSnippet()`, `getState()`
- `src/runner/runner-state.ts` — `RunnerState` discriminated union: `idle | at-node | awaiting-snippet-fill | complete | error`
- `src/views/runner-view.ts` — current stub (Phase 3 replaces the stub implementation)
- `src/main.ts` — current stub commands (Phase 3 wires up the real view and commands)
- `src/settings.ts` — `RadiProtocolSettings` interface and `DEFAULT_SETTINGS` (already has all Phase 3 fields)

### Pitfalls
- `.planning/research/PITFALLS.md` — no `innerHTML`, `registerDomEvent()` for all listeners,
  `workspace.activeLeaf` is deprecated (use `getActiveViewOfType`), memory leaks from raw
  `addEventListener()`, `loadData()` null guard

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/runner/protocol-runner.ts` — full Phase 2 implementation; `getState()` returns typed
  discriminated union snapshot; all 5 states are fully handled
- `src/runner/runner-state.ts` — `AtNodeState` carries `currentNodeId`, `accumulatedText`,
  `canStepBack`; UI reads these directly for rendering
- `src/settings.ts` — `RadiProtocolSettings` already defines `outputDestination`, `outputFolderPath`,
  `maxLoopIterations`; `DEFAULT_SETTINGS` is ready; `RadiProtocolSettingsTab.display()` is a stub
- `src/graph/canvas-parser.ts` and `src/graph/graph-validator.ts` — fully implemented in Phase 1;
  Phase 3 calls `validator.validate(graph)` before starting a session to get human-readable errors

### Established Patterns
- All DOM construction: `createEl()` / `createDiv()` exclusively — no `innerHTML` (UI-08)
- All event listeners: `this.registerDomEvent(el, 'click', handler)` — no raw `addEventListener` (UI-09)
- `noUncheckedIndexedAccess` enabled — all `Map.get()` results are `T | undefined`; null-checks required
- Settings tab: extend the existing stub in `src/settings.ts`, not a new file

### Integration Points
- `RunnerView` receives `plugin: RadiProtocolPlugin` in its constructor → accesses
  `plugin.settings`, `plugin.canvasParser`, and the vault via `plugin.app.vault`
- `main.ts` `onload()` must call `this.registerView()` and update the two commands
- `ProtocolRunner` instance: created fresh per session inside `RunnerView.openCanvas()`;
  not a singleton on the plugin (one runner per active session)
- `CanvasParser.parse()` + `GraphValidator.validate()` called in sequence at session start;
  validation errors displayed before `runner.start()` is called
- `setAccumulatedText(text)` must be added to `ProtocolRunner` (small Phase 2 extension, D-04)
- `start(graph, startNodeId?)` optional second parameter must be added (D-07)

</code_context>

<specifics>
## Specific Ideas

- Preview zone is a `textarea` (not a styled `div`) so inline editing (RUN-11) works natively
  without `contenteditable` complexity.
- Answer buttons: full-width, one per row — no grid, no truncation. Labels can be long anatomical names.
- "Start from specific node" uses Obsidian's `SuggestModal` pattern (standard plugin pattern for
  fuzzy search pickers) — consistent with how other plugins expose node/file pickers.
- Color legend: collapsible, collapsed by default. New authors see it; experienced authors hide it.

</specifics>

<deferred>
## Deferred Ideas

- Session resume on workspace restore — deferred to Phase 7 (SessionService not yet built)
- Snippet fill-in modal integration — deferred to Phase 5 (runner enters `awaiting-snippet-fill`
  state but Phase 3 shows a "snippet support coming soon" placeholder message)
- Context menu on canvas nodes to open RunnerView for that node — deferred to Phase 4
  (canvas interaction is Phase 4's domain)
- Progress indicator ("Question 3 of ~12") — would require graph pre-traversal to count nodes;
  deferred to backlog

</deferred>

---

*Phase: 03-runner-ui-itemview*
*Context gathered: 2026-04-06*
