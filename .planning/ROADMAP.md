# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Milestone:** v1 — Community Plugin Release
**Last updated:** 2026-04-06
**Total phases:** 7
**Granularity:** Standard

---

## Phases

- [ ] **Phase 1: Project Scaffold and Canvas Parsing Foundation** - Verified plugin scaffold, pure graph model, full validation suite, test infrastructure, and dev toolchain
- [x] **Phase 2: Core Protocol Runner Engine** - Fully unit-tested traversal state machine with step-back, text accumulation, and undo — no UI required to verify
- [ ] **Phase 3: Runner UI (ItemView)** - End-to-end demonstrable plugin: open a canvas, run a protocol, see live preview, copy output
- [ ] **Phase 4: Canvas Node Editor Side Panel** - Protocol authoring without touching raw JSON: per-node forms write back to the canvas file
- [ ] **Phase 5: Dynamic Snippets** - Placeholder fill-in modal integrated into the runner; snippet CRUD backed by per-file vault storage
- [ ] **Phase 6: Loop Support** - Multi-iteration protocol sections with correct undo, iteration display, and exit UX
- [ ] **Phase 7: Mid-Session Save and Resume** - Auto-save after every step; resume-session prompt; validation on resume against modified canvases

---

## Phase Details

### Phase 1: Project Scaffold and Canvas Parsing Foundation

**Goal**: The plugin compiles, installs, and can parse any canvas file into a validated typed graph model — all pure engine code is under test before any UI work begins.

**Depends on**: Nothing (first phase)

**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08, DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-08, NFR-09, NFR-10, NFR-11

**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` builds `main.js`, copies it to the dev vault plugin directory, and the plugin loads in Obsidian without errors — confirmed by ribbon icon and command palette entries appearing
  2. `CanvasParser.parse()` correctly produces a `ProtocolGraph` with the right node kinds and adjacency maps from a representative canvas JSON fixture — confirmed by Vitest passing
  3. `GraphValidator` catches all six error classes (no start node, multiple start nodes, unreachable nodes, unintentional cycle, dead-end question, orphaned loop-end) and returns human-readable error messages — confirmed by Vitest passing
  4. `eslint` runs with zero errors against all source files from the first commit
  5. A canvas file with mixed RadiProtocol and plain cards parses without error; plain cards are silently skipped

**Plans**: 6 plans

Plans:
- [x] 01-00-PLAN-wave0-test-infrastructure.md — Vitest config, four canvas fixtures, stub test files (RED)
- [x] 01-01-PLAN-plugin-scaffold.md — package.json, tsconfig, esbuild+.env copy, manifest, LICENSE
- [x] 01-02-PLAN-directory-structure-stubs.md — full src/ tree with typed stubs for all 7 modules
- [x] 01-03-PLAN-canvas-parser.md — CanvasParser.parse() implementation, tests GREEN
- [x] 01-04-PLAN-graph-validator.md — GraphValidator.validate() six error classes, tests GREEN
- [x] 01-05-PLAN-eslint-and-build.md — ESLint config, zero errors, integrated lint+test+build check

**Risk flags**:
- Custom `radiprotocol_*` properties may be stripped by future Obsidian major-version canvas editor upgrades. Mitigate: validate property round-trip in test vault early; namespace strictly.
- `noUncheckedIndexedAccess` in tsconfig means `array[0]` returns `T | undefined` — new contributors will be surprised. Document this in the project README.

---

### Phase 2: Core Protocol Runner Engine

**Goal**: The traversal engine correctly steps through all node types, accumulates protocol text, and reverts both navigation and text on step-back — verified entirely with unit tests, no Obsidian UI required.

**Depends on**: Phase 1

**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07, RUN-08, RUN-09

**Success Criteria** (what must be TRUE):
  1. `ProtocolRunner` traverses a linear protocol (start → question → answer → text-block → complete) and the accumulated text matches the expected output — confirmed by Vitest
  2. `ProtocolRunner` traverses a branching protocol and follows the correct branch based on the chosen answer — confirmed by Vitest
  3. `stepBack()` reverts both the current node ID and the accumulated text to the state before the last answer — confirmed by Vitest with a 3-step protocol
  4. A protocol with a loop body (even without full loop-start/loop-end node support) correctly handles the iteration cap: after `maxIterations` steps, the runner transitions to `error` state with a clear message — confirmed by Vitest
  5. All five discriminated union states (`idle`, `at-node`, `awaiting-snippet-fill`, `complete`, `error`) are reachable and transition correctly — confirmed by Vitest state-machine tests

**Plans**: 3 plans

Plans:
- [x] 02-00-PLAN.md — Wave 0: four canvas fixtures + failing test stubs for TextAccumulator and ProtocolRunner (RED)
- [x] 02-01-PLAN.md — RunnerState discriminated union (5 states + UndoEntry) + TextAccumulator implementation (tests GREEN)
- [x] 02-02-PLAN.md — ProtocolRunner full state machine implementation (all runner tests GREEN)

**Risk flags**:
- Step-back must revert **both** navigation state and accumulated text. Using text diffs instead of full snapshots can introduce partial-revert bugs under edge cases (e.g., free-text input with embedded newlines). Snapshots are the correct approach.
- The `awaiting-snippet-fill` state will have no real trigger until Phase 5. Design the transition points now so the runner does not need structural changes in Phase 5.

---

### Phase 3: Runner UI (ItemView)

**Goal**: A radiologist can open any valid canvas as a protocol, step through all question types in the right sidebar, see their report forming in real time, and copy it to the clipboard with one click.

**Depends on**: Phase 2

**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, RUN-10, RUN-11, UI-12

**Success Criteria** (what must be TRUE):
  1. Running "Run protocol" from the command palette on a valid canvas opens `RunnerView` in the right sidebar, shows the first question, and displays answer buttons — confirmed by manual test against test vault
  2. Answering several questions causes the live preview panel to update after each answer, showing the exact accumulated text — confirmed by manual test
  3. Clicking "Step back" returns to the previous question and the preview panel reverts to the text before that answer was chosen — confirmed by manual test
  4. Clicking "Copy to clipboard" after completing a protocol copies the full report text — confirmed by pasting into a text editor
  5. Running "Run protocol" on an invalid canvas (e.g., no start node) shows a validation error panel with plain-language guidance before any session opens — confirmed by manual test
  6. Closing and reopening Obsidian restores `RunnerView` to its idle state without errors (workspace persistence via `getState`/`setState`) — confirmed by manual test

**Plans**: 5 plans

Plans:
- [ ] 03-00-PLAN.md — Wave 0: four failing test stubs (RunnerView, runner-extensions, runner-commands, settings-tab)
- [ ] 03-01-PLAN.md — RunnerView full skeleton: two-zone layout, render dispatcher, getState/setState, legend, styles.css
- [ ] 03-02-PLAN.md — ProtocolRunner extensions (setAccumulatedText, optional startNodeId) + copy/save/inline-edit wiring
- [ ] 03-03-PLAN.md — NodePickerModal for start-from-node command (SuggestModal, buildNodeOptions)
- [ ] 03-04-PLAN.md — main.ts full wiring + settings tab three controls + human verification checkpoint

**UI hint**: yes

**Risk flags**:
- `ItemView` state loss on workspace restore if `getState()`/`setState()` are not implemented in this phase. Implement immediately — do not defer.
- Memory leaks from DOM event listeners if `registerDomEvent()` is not used. The ESLint plugin does not catch all cases — code review required.
- `workspace.activeLeaf` is deprecated. Use `workspace.getActiveViewOfType()` or `workspace.getMostRecentLeaf()`.
- Answer button layout may need adjustment for questions with many options (e.g., 8+ laterality/classification choices). Test with a real-world protocol.

---

### Phase 4: Canvas Node Editor Side Panel

**Goal**: A radiologist can select any node on the canvas and configure all its RadiProtocol properties through labeled form fields in a side panel — no raw JSON editing required.

**Depends on**: Phase 3

**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05

**Success Criteria** (what must be TRUE):
  1. Clicking a canvas node and opening the editor panel shows a form with the correct fields pre-populated for that node's current kind — confirmed by manual test
  2. Changing field values in the form and saving writes the updated `radiprotocol_*` properties to the canvas JSON file — confirmed by inspecting the file in a text editor after saving
  3. The canvas file is not corrupted after the editor writes to it — confirmed by re-opening the canvas in Obsidian's native Canvas view and verifying all nodes and edges are intact
  4. Attempting to write to an open canvas either (a) prompts the user to close it first, or (b) uses a guarded undocumented API path with a clear version-warning notice — confirmed by attempting an edit with the canvas open

**Plans**: TBD

**UI hint**: yes

**Risk flags**:
- **Highest-risk phase in the project.** Writing to an open canvas file will be silently overwritten by the Canvas view's auto-save. The write-back strategy (require closed vs. undocumented internals) must be decided and spiked before implementation begins. See Assumption A4 in REQUIREMENTS.md.
- The undocumented `app.workspace.getLeavesOfType('canvas')[0].view.canvas` API path can break on any Obsidian update. If this path is chosen, implement explicit version guards and try/catch with graceful fallback to "please close the canvas first."
- Context menu integration may require `workspace.on('file-menu', ...)` or canvas-specific event hooks — both need investigation.

---

### Phase 5: Dynamic Snippets

**Goal**: Protocol authors can attach reusable text snippets with labeled placeholder fields to any text-block node; during a session, the runner opens a fill-in modal with live preview and the completed text is appended to the report.

**Depends on**: Phase 4

**Requirements**: SNIP-01, SNIP-02, SNIP-03, SNIP-04, SNIP-05, SNIP-06, SNIP-07, SNIP-08, SNIP-09

**Success Criteria** (what must be TRUE):
  1. A snippet JSON file created in `.radiprotocol/snippets/` is loaded by `SnippetService` and its placeholders are correctly parsed — confirmed by Vitest unit test
  2. When the runner reaches a `TextBlockNode` with a `snippetId`, it transitions to `awaiting-snippet-fill` and opens the fill-in modal — confirmed by manual test
  3. The fill-in modal shows each placeholder as a labeled field; tabbing between fields works; the live preview panel updates as each field is filled — confirmed by manual test
  4. Completing the modal appends the rendered snippet text (with placeholder values substituted) to the accumulated protocol text and the runner advances — confirmed by manual test
  5. Concurrent snippet file writes (simulated by rapid save operations) do not produce corrupted JSON — confirmed by write-mutex unit test or stress test

**Plans**: TBD

**UI hint**: yes

**Risk flags**:
- Inline fill-in within an `ItemView` vs. a `Modal` — the `Modal` pattern is simpler to implement but breaks the flow of the runner panel. Decide which approach to use before implementation; a short design spike is recommended.
- Write mutex must wrap every `vault.modify()` on snippet files. Missing even one call site will allow silent race-condition corruption.
- Snippet folder may not exist on first run or after deletion. `ensureFolder()` must be called before every write operation.

---

### Phase 6: Loop Support

**Goal**: Protocol authors can mark a section of the canvas as a repeating loop; during a session, the runner correctly iterates the loop body, tracks each iteration's text, and exits when the user chooses "done" — with full undo support across loop boundaries.

**Depends on**: Phase 5

**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06

**Success Criteria** (what must be TRUE):
  1. A canvas with a `loop-start` / `loop-end` node pair parses correctly and the loop pairing is validated — confirmed by Vitest
  2. Running a loop-containing protocol presents the loop body once, then offers "Loop again / Done" at the loop-end node — confirmed by manual test with a 3-lesion scenario
  3. The iteration counter ("Lesion 2") displays correctly in the runner UI as the user progresses through iterations — confirmed by manual test
  4. Stepping back from the second iteration of a loop correctly reverts to the last question of the first iteration (not to before the loop started) — confirmed by manual test
  5. A canvas with an accidental cycle (not through a loop-end node) is rejected by the validator with a clear error before the session starts — confirmed by manual test

**Plans**: TBD

**UI hint**: yes

**Risk flags**:
- **Highest-complexity phase.** Loop context stack, undo across loop boundaries, and iteration text formatting all interact. Build and test the runner changes in isolation before touching the UI.
- The "loop again / done" UX and multi-iteration text formatting have no direct Obsidian precedent. A design spike (prototype with a 3-lesion abdominal CT protocol) is recommended before full implementation. See SUMMARY.md Phase 6 research flag.
- Accidental cycles vs. intentional loops: the three-color DFS must correctly distinguish them. A back-edge that passes through a `loop-end` node is intentional; all others are errors.
- Undo entries must snapshot the full `loopContextStack`, not just `currentNodeId` and `accumulatedText`. Missing this will produce incorrect step-back behavior across loop boundaries.

---

### Phase 7: Mid-Session Save and Resume

**Goal**: A radiologist can close Obsidian mid-protocol and resume the exact session later — the runner restores their position, accumulated text, and answer history, and warns them if the canvas was modified in the interim.

**Depends on**: Phase 6

**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06, SESSION-07

**Success Criteria** (what must be TRUE):
  1. After answering three questions in a protocol and closing Obsidian, reopening and running the same protocol offers a "Resume session" prompt — confirmed by manual test
  2. Resuming restores the runner to the exact node, accumulated text, and undo history from before closing — confirmed by manual test
  3. Resuming a session when the canvas file has been modified since the save shows a clear warning and offers "Start over" or "Try to resume" — confirmed by manual test with a deliberately modified canvas
  4. Resuming a session when a referenced node ID no longer exists in the canvas shows an error with a "Start over" option — confirmed by manual test
  5. `SessionService` correctly serializes and deserializes the full loop context stack including any in-progress loop iteration — confirmed by Vitest unit test

**Plans**: TBD

**Risk flags**:
- `Set` values in session state cannot be directly serialized to JSON. All `Set` fields must be converted to `Array` before `JSON.stringify()` and restored on `JSON.parse()`. One missed conversion will silently produce `{}` in the session file.
- Canvas `mtime` check is necessary but not sufficient — a file can be modified and then reverted to the same mtime (e.g., by git checkout). Accept this limitation; the check is a best-effort safeguard.
- Snippet content must be snapshotted at save time, not referenced by ID only. If the snippet file is later edited, the in-progress session would produce different output than the user expects without the snapshot.
- Sync service conflicts: session JSON files modified on two devices may produce invalid JSON on merge. Validate JSON on load and fail gracefully with a "Start over" option.

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Scaffold and Canvas Parsing Foundation | 0/6 | Not started | - |
| 2. Core Protocol Runner Engine | 0/3 | Planning complete | - |
| 3. Runner UI (ItemView) | 0/5 | Planning complete | - |
| 4. Canvas Node Editor Side Panel | 0/? | Not started | - |
| 5. Dynamic Snippets | 0/? | Not started | - |
| 6. Loop Support | 0/? | Not started | - |
| 7. Mid-Session Save and Resume | 0/? | Not started | - |
