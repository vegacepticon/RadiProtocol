# Architecture

**Analysis Date:** 2026-04-16

## Pattern Overview

**Overall:** Plugin-based MVC with a pure-core / Obsidian-shell separation

**Key Characteristics:**
- Pure TypeScript core (graph parsing, protocol runner, models) with zero Obsidian API imports -- fully unit-testable in Node.js
- Obsidian ItemView subclasses serve as the view/controller layer, owning DOM rendering and user interaction
- State machine (ProtocolRunner) drives protocol execution; views read state via `getState()` discriminated union
- Canvas JSON files are the protocol source-of-truth; snippets and sessions are persisted as JSON files in `.radiprotocol/`
- Write concurrency is managed by per-path `WriteMutex` (wraps `async-mutex`)

## Layers

**Graph Layer (Pure):**
- Purpose: Parse Obsidian canvas JSON into a typed directed graph and validate it
- Location: `src/graph/`
- Contains: `graph-model.ts` (types), `canvas-parser.ts` (parser), `graph-validator.ts` (validator)
- Depends on: Nothing (zero imports from Obsidian)
- Used by: `RunnerView` (parse + validate on canvas open), `ProtocolRunner` (traverses the graph)

**Runner Layer (Pure):**
- Purpose: State machine that walks the protocol graph, accumulates text, manages undo
- Location: `src/runner/`
- Contains: `protocol-runner.ts` (state machine), `runner-state.ts` (state types), `text-accumulator.ts` (text buffer)
- Depends on: `src/graph/graph-model.ts` (types only)
- Used by: `RunnerView` (drives the UI)

**Snippet Layer:**
- Purpose: CRUD for snippet files (JSON with placeholders, Markdown verbatim) and canvas reference sync
- Location: `src/snippets/`
- Contains: `snippet-model.ts` (types + render function), `snippet-service.ts` (CRUD), `canvas-ref-sync.ts` (vault-wide ref rewrite)
- Depends on: `src/utils/`, Obsidian `App` (via constructor injection)
- Used by: `RunnerView` (snippet picker), `SnippetManagerView` (CRUD UI), `SnippetEditorModal`

**Session Layer:**
- Purpose: Persist and restore in-progress protocol sessions as JSON
- Location: `src/sessions/`
- Contains: `session-model.ts` (types), `session-service.ts` (CRUD + node ID validation)
- Depends on: `src/utils/`, `src/graph/graph-model.ts` (types only), Obsidian `App`
- Used by: `RunnerView` (auto-save after every mutation, resume on canvas open)

**Canvas Layer:**
- Purpose: Live-edit canvas nodes via Obsidian's internal Canvas API (Pattern B) and map node types to colors
- Location: `src/canvas/`
- Contains: `canvas-live-editor.ts` (live getData/setData/requestSave), `node-color-map.ts` (RPNodeKind -> palette color)
- Depends on: `src/types/canvas-internal.d.ts`, Obsidian `App`
- Used by: `EditorPanelView` (save node edits live), `RunnerView` (read live canvas JSON)

**View Layer (Obsidian-dependent):**
- Purpose: UI rendering, user interaction, Obsidian workspace integration
- Location: `src/views/`
- Contains: `RunnerView`, `EditorPanelView`, `SnippetManagerView`, modals, widgets
- Depends on: All other layers
- Used by: Plugin main class registers these as Obsidian views

**Utilities:**
- Purpose: Shared helpers for vault I/O safety
- Location: `src/utils/`
- Contains: `vault-utils.ts` (ensureFolderPath), `write-mutex.ts` (per-path async lock)
- Depends on: `async-mutex` (npm), Obsidian `Vault` type
- Used by: `SnippetService`, `SessionService`, `RadiProtocolPlugin`

## Data Flow

**Protocol Execution (main flow):**

1. User clicks ribbon icon or runs "Run protocol" command -> `RadiProtocolPlugin.activateRunnerView()`
2. `RunnerView.openCanvas(filePath)` reads canvas JSON (live via `CanvasLiveEditor.getCanvasJSON()` if open, else `vault.read()`)
3. `CanvasParser.parse()` converts raw JSON into `ProtocolGraph` (nodes Map, adjacency Map, edges array)
4. `GraphValidator.validate()` checks: exactly one start node, reachability, no unintentional cycles, no dead-end questions, loop integrity
5. `SessionService.load()` checks for a saved session; if found, shows `ResumeSessionModal` (resume/start-over)
6. `ProtocolRunner.start(graph)` or `ProtocolRunner.restoreFrom(session)` initializes the state machine
7. `RunnerView.render()` reads `runner.getState()` and renders the appropriate UI for the current status
8. User interactions (`chooseAnswer`, `enterFreeText`, `chooseLoopAction`, `chooseSnippetBranch`, `pickSnippet`, `completeSnippet`) mutate runner state
9. Each mutation is followed by `autoSaveSession()` (fire-and-forget) and `render()`
10. On `status: 'complete'`, output toolbar enables Copy/Save/Insert actions

**Node Editing (editor panel flow):**

1. User clicks a canvas node -> `EditorPanelView.attachCanvasListener()` detects selection via internal `canvas.selection` Set
2. `handleNodeClick()` flushes any pending debounced save, then calls `loadNode()`
3. `renderNodeForm()` reads the raw canvas JSON node and builds a Settings-based form
4. User edits trigger `scheduleAutoSave()` (800ms debounce)
5. `saveNodeEdits()` attempts Pattern B (live `CanvasLiveEditor.saveLive()`) first; falls back to Strategy A (`vault.modify()`) if canvas is closed
6. Node color is auto-injected based on `NODE_COLOR_MAP[nodeType]`

**Snippet Fill-in Flow:**

1. Runner reaches a snippet node (or text-block with snippetId) -> status becomes `awaiting-snippet-pick`
2. `RunnerView.renderSnippetPicker()` lists folders and snippets via `SnippetService.listFolder()`
3. User picks a snippet -> `runner.pickSnippet(id)` -> status becomes `awaiting-snippet-fill`
4. If JSON snippet has placeholders: `SnippetFillInModal` opens; user fills values; `renderSnippet()` produces final text
5. If JSON snippet has no placeholders: template text used directly (no modal)
6. If MD snippet: raw content inserted verbatim (no modal, no placeholder substitution)
7. `runner.completeSnippet(renderedText)` appends to accumulator, advances to next node

**State Management:**

- **ProtocolRunner** is the single source of truth for protocol execution state
- State is exposed as a discriminated union (`RunnerState`) with 6 variants: `idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-snippet-fill`, `complete`, `error`
- Undo is implemented via an explicit `undoStack` of `UndoEntry` snapshots (node ID + full text snapshot + loop context snapshot)
- Every user action pushes an undo entry BEFORE mutation (undo-before-mutate invariant)
- `TextAccumulator` is an append-only string buffer with O(1) snapshot/restore
- Loop state is tracked via a `loopContextStack` (push on loop-start, pop on loop-done)
- Session persistence serializes the full runner state (status, nodeId, text, undoStack, loopContextStack) to JSON

## Key Abstractions

**ProtocolGraph:**
- Purpose: Directed graph of protocol nodes with adjacency lists
- Defined in: `src/graph/graph-model.ts`
- Contains: `nodes` (Map<string, RPNode>), `edges` (RPEdge[]), `adjacency` / `reverseAdjacency` (Map<string, string[]>), `startNodeId`
- Created by: `CanvasParser.parse()`

**RPNode (discriminated union):**
- Purpose: Represents a single node in the protocol graph
- Defined in: `src/graph/graph-model.ts`
- Variants: `StartNode`, `QuestionNode`, `AnswerNode`, `FreeTextInputNode`, `TextBlockNode`, `LoopStartNode`, `LoopEndNode`, `SnippetNode`
- Discriminant field: `kind` (RPNodeKind)

**RunnerState (discriminated union):**
- Purpose: Read-only snapshot of current protocol execution state
- Defined in: `src/runner/runner-state.ts`
- Variants: `IdleState`, `AtNodeState`, `AwaitingSnippetPickState`, `AwaitingSnippetFillState`, `CompleteState`, `ErrorState`
- Discriminant field: `status` (RunnerStatus)
- Pattern: Views call `runner.getState()` and switch on `status`

**Snippet (discriminated union):**
- Purpose: Represents a reusable text template (JSON with placeholders or MD verbatim)
- Defined in: `src/snippets/snippet-model.ts`
- Variants: `JsonSnippet` (template + placeholders), `MdSnippet` (raw content)
- Discriminant field: `kind`

**PersistedSession:**
- Purpose: Full serializable snapshot of an in-progress protocol session
- Defined in: `src/sessions/session-model.ts`
- Contains: version, canvasFilePath, runner status, currentNodeId, accumulatedText, undoStack, loopContextStack, snippetId/snippetNodeId

## Entry Points

**Plugin Entry Point:**
- Location: `src/main.ts`
- Triggers: Obsidian loads the plugin on startup
- Responsibilities: Instantiates services (`CanvasParser`, `SnippetService`, `SessionService`, `CanvasLiveEditor`), registers views (`RunnerView`, `EditorPanelView`, `SnippetManagerView`), registers commands and context menu, manages settings

**RunnerView (primary user-facing view):**
- Location: `src/views/runner-view.ts`
- Triggers: Ribbon icon click, "Run protocol" command, `activateRunnerView()`
- Responsibilities: Canvas selection, protocol execution UI, snippet picker, output toolbar (copy/save/insert), session auto-save/restore

**EditorPanelView (authoring view):**
- Location: `src/views/editor-panel-view.ts`
- Triggers: Canvas node click (auto-switch), context menu "Edit RadiProtocol properties", "Open node editor" command
- Responsibilities: Node property editing form with auto-save, live canvas writes via Pattern B

**SnippetManagerView (library view):**
- Location: `src/views/snippet-manager-view.ts`
- Triggers: "Open snippet manager" command
- Responsibilities: Recursive folder tree, snippet CRUD, drag-and-drop reordering, rename/move/delete with canvas ref sync

## Error Handling

**Strategy:** Never-throw for parsers and validators; return result types or error arrays. Services degrade gracefully (return null on corrupt data). Views show error UI panels.

**Patterns:**
- `CanvasParser.parse()` returns `ParseResult` (success with graph OR failure with error string) -- never throws
- `GraphValidator.validate()` returns `string[]` of human-readable error messages -- never throws
- `SessionService.load()` catches JSON.parse errors and returns null for corrupt sessions
- `SnippetService` methods catch I/O errors and skip corrupt files silently
- `CanvasLiveEditor.saveLive()` rolls back to original canvas data if setData/requestSave throws
- `RunnerView.renderError()` displays a structured error panel with selector bar preserved
- `ProtocolRunner` transitions to `'error'` status on unrecoverable conditions (iteration cap, missing nodes)

## Cross-Cutting Concerns

**Logging:** `console.debug()` for plugin lifecycle, `console.error()` for failures. No structured logging framework.

**Validation:** Graph validation via `GraphValidator` (structural). Path safety via `SnippetService.assertInsideRoot()` (prevents directory traversal). Input sanitization via `sanitizeJson()` (strips control characters).

**Authentication:** Not applicable (local Obsidian plugin, no network auth).

**Concurrency:** `WriteMutex` (per-path async locks) wraps all vault write operations. `CanvasLiveEditor` uses debounced `requestSave()` (500ms per canvas). `EditorPanelView` uses debounced auto-save (800ms).

**Canvas Interop:** Two strategies for writing to canvas files:
- **Pattern B (preferred):** Live in-memory edit via `canvas.getData()`/`setData()`/`requestSave()` when canvas is open
- **Strategy A (fallback):** Direct `vault.modify()` of the canvas JSON file when canvas is closed

---

*Architecture analysis: 2026-04-16*
