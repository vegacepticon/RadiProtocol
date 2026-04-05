# Requirements: RadiProtocol

**Project:** RadiProtocol
**Type:** Obsidian community plugin (TypeScript)
**Version:** v1
**Last updated:** 2026-04-05

---

## Functional Requirements

### Module: Canvas Parser (PARSE)

| ID | Requirement | Priority |
|----|-------------|----------|
| PARSE-01 | Parse any `.canvas` JSON file into a typed `ProtocolGraph` (Map-based adjacency list) using `vault.read()` — never `require('fs')` | Must have |
| PARSE-02 | Recognise and parse all seven RadiProtocol node kinds from `radiprotocol_nodeType` custom properties: `start`, `question`, `answer`, `free-text-input`, `text-block`, `loop-start`, `loop-end` | Must have |
| PARSE-03 | Silently skip plain canvas nodes that lack `radiprotocol_nodeType` so mixed-content canvases remain valid | Must have |
| PARSE-04 | Store all RadiProtocol metadata on canvas nodes using `radiprotocol_`-namespaced properties only — no collisions with native canvas fields | Must have |
| PARSE-05 | Parse canvas file exactly once at session start; build graph model in memory; never modify the canvas file during a protocol session | Must have |
| PARSE-06 | `CanvasParser` is a pure module with zero Obsidian API imports — receives JSON string, returns `ProtocolGraph` | Must have |
| PARSE-07 | `GraphValidator` runs before every session start and checks: exactly one start node, reachability from start, unintentional cycles (three-color DFS), dead-end questions, loop-start/loop-end pairing, snippet reference existence | Must have |
| PARSE-08 | All six validation errors are reported in plain English before the session opens (not as code exceptions) | Must have |

### Module: Protocol Runner (RUN)

| ID | Requirement | Priority |
|----|-------------|----------|
| RUN-01 | Open any `.canvas` file as a guided protocol session via an Obsidian command | Must have |
| RUN-02 | Present one question at a time; never show multiple questions simultaneously | Must have |
| RUN-03 | Support preset-text answer buttons: clicking a button appends the answer's `answerText` to the accumulated protocol text and advances to the next node | Must have |
| RUN-04 | Support free-text input nodes: user types text which is optionally wrapped with `prefix`/`suffix` strings, then appended to the accumulated protocol text | Must have |
| RUN-05 | Support text-block nodes: static text is automatically appended when the node is reached, with no user interaction required | Must have |
| RUN-06 | Implement step-back (undo last answer): revert both the navigation state and the accumulated protocol text to the previous snapshot | Must have |
| RUN-07 | `TextAccumulator` uses full snapshots (not diffs) for each undo entry so that revert is O(1) and cannot partially corrupt text | Must have |
| RUN-08 | The runner state machine uses a discriminated union with five states: `idle`, `at-node`, `awaiting-snippet-fill`, `complete`, `error` | Must have |
| RUN-09 | Enforce a configurable hard maximum iteration count (default 50) on loop nodes to prevent infinite hangs from user-built cyclic protocols | Must have |
| RUN-10 | Allow starting a protocol session from a specific node chosen by the user, not only from the designated start node | Should have |
| RUN-11 | Protocol accumulated text is editable inline by the user at any point during the session | Should have |

### Module: Runner UI — ItemView (UI)

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-01 | `RunnerView` is an `ItemView` displayed in the right sidebar | Must have |
| UI-02 | Live protocol preview is always visible during a session — accumulated text updates in real time after every answer | Must have |
| UI-03 | Render all node types appropriately: question text + answer buttons, free-text input field, text-block auto-advance, loop "again / done" prompt | Must have |
| UI-04 | Display validation errors before session start in plain language with actionable guidance | Must have |
| UI-05 | Output to clipboard button — one click copies the complete accumulated text | Must have |
| UI-06 | Output to new note button — creates a note in the configured output folder | Must have |
| UI-07 | `RunnerView` implements `getState()` / `setState()` storing only the session ID (not full session data) for workspace layout persistence | Must have |
| UI-08 | All DOM construction uses Obsidian's `createEl` / `createDiv` helpers exclusively — no `innerHTML` | Must have |
| UI-09 | All event listeners registered via `registerDomEvent()` — no raw `addEventListener()` calls | Must have |
| UI-10 | Settings tab with configurable output destination: clipboard, new note, or both | Must have |
| UI-11 | Configurable output folder path when "new note" output is selected | Must have |
| UI-12 | Node color-coding legend visible in the runner or settings so users understand the canvas color conventions | Should have |

### Module: Canvas Node Editor Side Panel (EDIT)

| ID | Requirement | Priority |
|----|-------------|----------|
| EDIT-01 | `EditorPanelView` is an `ItemView` side panel that displays per-node configuration forms when a canvas node is selected | Must have |
| EDIT-02 | Forms expose all `radiprotocol_*` fields for each node kind using labeled input fields — users never touch raw JSON | Must have |
| EDIT-03 | Node type selector allows changing a node's kind (e.g., from plain text to question) | Must have |
| EDIT-04 | Write-back to `.canvas` JSON file requires the canvas file to be closed first, OR uses undocumented Canvas view internals with explicit Obsidian version guards and try/catch — never silently corrupts an open canvas | Must have |
| EDIT-05 | Context menu integration on canvas nodes to open the editor panel for that node | Should have |

### Module: Snippet System (SNIP)

| ID | Requirement | Priority |
|----|-------------|----------|
| SNIP-01 | `SnippetService` provides full CRUD for snippet files stored as individual JSON files in `.radiprotocol/snippets/` inside the vault | Must have |
| SNIP-02 | Support four placeholder types: `free-text`, `choice` (single select), `multi-choice` (multi-select with join), `number` (with optional unit) | Must have |
| SNIP-03 | Every placeholder has a human-readable label; raw placeholder syntax is never exposed to the user | Must have |
| SNIP-04 | `SnippetFillInModal` presents all placeholders as labeled input fields with tab-navigation between fields | Must have |
| SNIP-05 | `SnippetFillInModal` shows a live preview of the rendered snippet text as the user fills in placeholder values | Must have |
| SNIP-06 | Runner integration: when a `TextBlockNode` with a `snippetId` is reached, the runner transitions to `awaiting-snippet-fill` state and opens the fill-in modal | Must have |
| SNIP-07 | `WriteMutex` (per-file async lock using `async-mutex`) wraps every `vault.modify()` call on snippet and session files to prevent race-condition data corruption | Must have |
| SNIP-08 | Snippet folder (`.radiprotocol/snippets/`) is created automatically on first run and before every write — never assume it exists | Must have |
| SNIP-09 | Choice placeholder fields always allow free-text override — no field is strictly locked to its predefined options | Should have |

### Module: Loop Support (LOOP)

| ID | Requirement | Priority |
|----|-------------|----------|
| LOOP-01 | `LoopStartNode` and `LoopEndNode` are fully supported in the parser, validator, and runner | Must have |
| LOOP-02 | Loop-start node has two outgoing edges: `continue` (into loop body) and `exit` (past the loop) — user sees a "loop again / done" prompt at the loop-end node | Must have |
| LOOP-03 | Loop context stack tracks current iteration number, and text accumulated before loop entry, for correct undo across loop boundaries | Must have |
| LOOP-04 | Iteration counter is displayed in the runner UI (e.g., "Lesion 2 of ?") | Must have |
| LOOP-05 | Undo entries snapshot the full loop context stack — stepping back across a loop boundary restores the previous iteration state | Must have |
| LOOP-06 | Validator detects orphaned loop-end nodes (no matching loop-start) and accidental cycles not passing through a loop-end node | Must have |

### Module: Mid-Session Save and Resume (SESSION)

| ID | Requirement | Priority |
|----|-------------|----------|
| SESSION-01 | `SessionService` auto-saves a `PersistedSession` JSON file in `.radiprotocol/sessions/` after every step | Must have |
| SESSION-02 | On protocol launch, check for an existing incomplete session for that canvas file and offer to resume | Must have |
| SESSION-03 | On resume, validate that all saved node IDs still exist in the current canvas file before restoring | Must have |
| SESSION-04 | On resume, check canvas file `mtime` against the saved timestamp and warn if the canvas has been modified since the session was saved | Must have |
| SESSION-05 | Snippet content is snapshotted at save time — session uses the captured text, not the current snippet file, to avoid drift | Must have |
| SESSION-06 | Graceful degradation: if resume validation fails, offer the user a clear choice — start fresh or attempt best-effort resume with a warning | Must have |
| SESSION-07 | Session files use `Array` serialization for any `Set` values (JSON does not support `Set`) | Must have |

### Module: Dev Workflow (DEV)

| ID | Requirement | Priority |
|----|-------------|----------|
| DEV-01 | Hot-reload script: `npm run dev` builds with esbuild in watch mode and the built files are served to the dev vault plugin directory automatically | Must have |
| DEV-02 | `eslint-plugin-obsidianmd` (all 27 rules) configured from the first commit | Must have |
| DEV-03 | Additional ESLint rules enabled: `no-console` (allow warn/error/debug), `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises`, `no-restricted-syntax` for `innerHTML` and `outerHTML` | Must have |
| DEV-04 | Vitest configured to run against `src/engine/` (or equivalent pure-logic directory) with zero Obsidian API imports | Must have |
| DEV-05 | A test vault with representative `.canvas` files covering at minimum: linear protocol, branching protocol, dead-end error case, and unintentional cycle error case | Must have |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | The protocol runner engine (`graph/`, `runner/`, `snippets/`, `sessions/`) has zero Obsidian API imports and is independently unit-testable with Vitest |
| NFR-02 | `main.js` bundle size stays within community plugin norms — no React; plain DOM + Obsidian helpers for v1 |
| NFR-03 | `minAppVersion` set to `"1.5.7"` (minimum version providing `onExternalSettingsChange()`) |
| NFR-04 | Plugin passes `eslint-plugin-obsidianmd` lint with zero warnings before submission |
| NFR-05 | All UI text uses sentence case (e.g., "Run protocol", not "Run Protocol") |
| NFR-06 | All command IDs omit the plugin name prefix (Obsidian prepends it automatically) |
| NFR-07 | No `require('fs')`, `require('path')`, or any direct Node.js built-in module imports |
| NFR-08 | Settings loaded with defaults guard: `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` |
| NFR-09 | All async operations are awaited or explicitly marked `void` — no floating promises |
| NFR-10 | Repository includes a `LICENSE` file (MIT) and has GitHub Issues enabled before community submission |
| NFR-11 | Plugin handles UTF-8 medical text correctly, including Unicode characters (measurement symbols, degree signs, accented characters) |

---

## Constraints

| Constraint | Detail |
|------------|--------|
| Canvas format compatibility | Must stay compatible with the JSON Canvas v1.0 spec; never break existing canvas files; namespace all custom properties with `radiprotocol_` |
| Canvas runtime API | Obsidian provides no official Canvas runtime API — plugin must be read-only with respect to canvas files during a protocol session |
| Canvas write safety | Never call `vault.modify()` on a `.canvas` file that is currently open in the Canvas view |
| No innerHTML | Using `innerHTML`, `outerHTML`, or `insertAdjacentHTML` is a community review rejection — use `createEl()` and `sanitizeHTMLToDom()` only |
| No Node.js fs | `require('fs')` and all direct Node.js built-in modules are forbidden — use Obsidian Vault API only |
| No console.log | Production code must not contain `console.log()` — use `console.warn()`, `console.error()`, or `console.debug()` |
| No any types | `@typescript-eslint/no-explicit-any` is enforced — explicit unknown/typed casts required |
| Snippet file safety | Snippet files are never silently deleted or overwritten by plugin updates — always user-owned vault files |
| UI language | English only for v1; i18n deferred |

---

## Out of Scope (v1)

| Feature | Reason |
|---------|--------|
| AI/LLM-generated text | Radiologists require traceable output; Cannoli already covers the LLM-on-canvas niche |
| PACS/RIS direct integration | Requires HL7/DICOM/FHIR compliance and hospital IT approval; clipboard output is sufficient |
| Mobile support (Obsidian mobile) | Canvas authoring is unsupported on mobile; desktop-first until canvas authoring stabilises on mobile |
| Multi-user / shared vault editing | Single-user local vault; real-time collaboration would require a server |
| Version history for snippets | File system and Obsidian Sync handle backups |
| Snippet manager full UI | Snippets can be created as JSON files manually in v1; full CRUD UI is Phase 5 |
| Node templates (reusable structures) | Useful for power users; deferred until core authoring workflow is validated |
| Linked placeholders across report sections | Nice-to-have; deferred after core snippet system is validated |
| Optional sections in snippets | Deferred to v2 |
| Automatic impression generation | Requires NLP/AI; out of scope |
| Mandatory field enforcement in runner | Plugin should warn, never block; enforcement policy deferred |

---

## Assumptions Requiring User Confirmation

These design decisions are flagged in ARCHITECTURE.md as assumed — not yet validated with the intended user.

| # | Assumption | Location | Impact if Wrong |
|---|------------|----------|-----------------|
| A1 | Loop-start node has **two outgoing edges**: one labeled `continue` (enters loop body) and one labeled `exit` (bypasses loop). The "loop again / done" choice appears at the loop-end node. Alternative: a dedicated "loop-decision" node. | ARCHITECTURE.md §2 | Changes graph model, validator rules, and runner transitions for Phase 6 |
| A2 | Session files are stored in `.radiprotocol/sessions/` inside the vault root. Alternative: in the same folder as the canvas file, or in the plugin data directory. | ARCHITECTURE.md §7 | Changes `SessionService` file paths and user-facing file organisation |
| A3 | Snippet placeholder syntax uses labeled fields with no raw syntax visible to users — choice field options are comma-separated strings in the snippet JSON. No VS Code-style `${1\|opt1,opt2\|}` syntax is exposed. | ARCHITECTURE.md §5 | Changes snippet file format and fill-in modal UI |
| A4 | Canvas write-back strategy for the node editor (Phase 4): require canvas to be **closed before editing** (simple, safe) vs. use undocumented Canvas view internals with version guards (seamless but fragile). Decision deferred to Phase 4 planning. | SUMMARY.md Phase 4 | Architecture of `EditorPanelView` write-back path |
| A5 | `minAppVersion` is set to `"1.5.7"`. If any required API was introduced later, this must be raised. | STACK.md §1 | `manifest.json` value; affects which users can install the plugin |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 1 | Pending |
| PARSE-02 | Phase 1 | Pending |
| PARSE-03 | Phase 1 | Pending |
| PARSE-04 | Phase 1 | Pending |
| PARSE-05 | Phase 1 | Pending |
| PARSE-06 | Phase 1 | Pending |
| PARSE-07 | Phase 1 | Pending |
| PARSE-08 | Phase 1 | Pending |
| DEV-01 | Phase 1 | Pending |
| DEV-02 | Phase 1 | Pending |
| DEV-03 | Phase 1 | Pending |
| DEV-04 | Phase 1 | Pending |
| DEV-05 | Phase 1 | Pending |
| NFR-01 | Phase 1 | Pending |
| NFR-02 | Phase 1 | Pending |
| NFR-03 | Phase 1 | Pending |
| NFR-04 | Phase 1 | Pending |
| NFR-05 | Phase 1 | Pending |
| NFR-06 | Phase 1 | Pending |
| NFR-07 | Phase 1 | Pending |
| NFR-08 | Phase 1 | Pending |
| NFR-09 | Phase 1 | Pending |
| NFR-10 | Phase 1 | Pending |
| NFR-11 | Phase 1 | Pending |
| RUN-01 | Phase 2 | Pending |
| RUN-02 | Phase 2 | Pending |
| RUN-03 | Phase 2 | Pending |
| RUN-04 | Phase 2 | Pending |
| RUN-05 | Phase 2 | Pending |
| RUN-06 | Phase 2 | Pending |
| RUN-07 | Phase 2 | Pending |
| RUN-08 | Phase 2 | Pending |
| RUN-09 | Phase 2 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| UI-10 | Phase 3 | Pending |
| UI-11 | Phase 3 | Pending |
| RUN-10 | Phase 3 | Pending |
| RUN-11 | Phase 3 | Pending |
| UI-12 | Phase 3 | Pending |
| EDIT-01 | Phase 4 | Pending |
| EDIT-02 | Phase 4 | Pending |
| EDIT-03 | Phase 4 | Pending |
| EDIT-04 | Phase 4 | Pending |
| EDIT-05 | Phase 4 | Pending |
| SNIP-01 | Phase 5 | Pending |
| SNIP-02 | Phase 5 | Pending |
| SNIP-03 | Phase 5 | Pending |
| SNIP-04 | Phase 5 | Pending |
| SNIP-05 | Phase 5 | Pending |
| SNIP-06 | Phase 5 | Pending |
| SNIP-07 | Phase 5 | Pending |
| SNIP-08 | Phase 5 | Pending |
| SNIP-09 | Phase 5 | Pending |
| LOOP-01 | Phase 6 | Pending |
| LOOP-02 | Phase 6 | Pending |
| LOOP-03 | Phase 6 | Pending |
| LOOP-04 | Phase 6 | Pending |
| LOOP-05 | Phase 6 | Pending |
| LOOP-06 | Phase 6 | Pending |
| SESSION-01 | Phase 7 | Pending |
| SESSION-02 | Phase 7 | Pending |
| SESSION-03 | Phase 7 | Pending |
| SESSION-04 | Phase 7 | Pending |
| SESSION-05 | Phase 7 | Pending |
| SESSION-06 | Phase 7 | Pending |
| SESSION-07 | Phase 7 | Pending |
