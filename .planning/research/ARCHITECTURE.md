# Architecture Research: RadiProtocol

**Domain:** Obsidian community plugin — TypeScript, Canvas-based decision-tree protocol runner
**Researched:** 2026-04-05
**Overall confidence:** HIGH (Obsidian plugin API patterns are well-documented; graph model and state machine patterns are standard; RadiProtocol-specific design decisions are reasoned from verified ecosystem constraints)

---

## 1. Plugin Component Architecture

### How the Plugin Class, Views, and Services Should Be Structured

The canonical Obsidian pattern discovered from multiple mature plugins (Obsidian Gemini, ZettelFlow, sample plugin) is a **central Plugin class as orchestrator**, with services injected into views via the plugin reference.

[VERIFIED: deepwiki.com/obsidianmd/obsidian-api/3-plugin-development]
[VERIFIED: deepwiki.com/allenhutchison/obsidian-gemini]

```
main.ts (RadiProtocolPlugin)
├── onload()
│   ├── this.settings = await loadSettings()
│   ├── this.snippetService = new SnippetService(this.app, this.settings)
│   ├── this.sessionService = new SessionService(this.app, this.settings)
│   ├── this.canvasParser = new CanvasParser()                  // pure, no app dep
│   ├── this.registerView(RUNNER_VIEW_TYPE, leaf => new RunnerView(leaf, this))
│   ├── this.registerView(EDITOR_PANEL_TYPE, leaf => new EditorPanelView(leaf, this))
│   ├── this.addSettingTab(new RadiProtocolSettingsTab(this.app, this))
│   ├── this.addRibbonIcon(...)
│   ├── this.addCommand({ id: 'run-protocol', ... })
│   ├── this.addCommand({ id: 'open-snippet-manager', ... })
│   ├── this.addCommand({ id: 'validate-protocol', ... })
│   └── this.registerEvent(this.app.workspace.on('file-menu', ...))
└── onunload()
    └── (auto-cleanup via register* methods)
```

### The Seven Major Modules

```
src/
├── main.ts                     # RadiProtocolPlugin — lifecycle + orchestration
├── settings.ts                 # RadiProtocolSettings interface + SettingsTab
│
├── graph/
│   ├── canvas-parser.ts        # Reads .canvas JSON → ProtocolGraph (pure, no Obsidian dep)
│   ├── graph-model.ts          # TypeScript types: ProtocolGraph, all node union types, edges
│   └── graph-validator.ts      # Validation: start node, cycles, unreachable nodes
│
├── runner/
│   ├── protocol-runner.ts      # Stateful traversal engine (state machine)
│   ├── runner-state.ts         # RunnerState discriminated union + transition logic
│   └── text-accumulator.ts     # Append-only text buffer with undo markers
│
├── snippets/
│   ├── snippet-service.ts      # CRUD for snippet JSON files in vault
│   └── snippet-model.ts        # SnippetFile interface + placeholder types
│
├── sessions/
│   └── session-service.ts      # Save/load/resume session JSON files in vault
│
├── views/
│   ├── runner-view.ts          # ItemView — the protocol execution UI
│   ├── editor-panel-view.ts    # ItemView — side panel for node configuration
│   └── snippet-manager-view.ts # ItemView — snippet CRUD UI
│
└── utils/
    ├── write-mutex.ts          # Per-file async write queue
    └── vault-utils.ts          # ensureFolder, safeRead, safeWrite helpers
```

### Key Architecture Decisions

**1. CanvasParser is a pure module (no Obsidian dependency).**
It receives a JSON string and returns a typed `ProtocolGraph`. This makes it independently testable, importable by any module, and avoids coupling the parsing logic to Obsidian's runtime. The caller (main.ts or a command handler) does `vault.read(file)` then passes the string to `canvasParser.parse(json)`.

**2. Services receive `this.app` and settings; views receive `this` (the plugin).**
This is the "plugin as service locator" pattern used by Obsidian Gemini and other complex plugins. Views access services through `this.plugin.snippetService`, etc. It avoids circular dependencies while keeping the wiring simple for a single-developer plugin.
[VERIFIED: deepwiki.com/allenhutchison/obsidian-gemini]

**3. Views are registered once in `onload()` and opened on demand.**
The authoritative pattern for opening a custom view in the right sidebar:
[VERIFIED: forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871]

```typescript
async activateRunnerView() {
  this.app.workspace.detachLeavesOfType(RUNNER_VIEW_TYPE);
  await this.app.workspace.getRightLeaf(false).setViewState({
    type: RUNNER_VIEW_TYPE,
    active: true,
  });
  this.app.workspace.revealLeaf(
    this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE)[0]
  );
}
```

**4. `onload()` defers view activation to `onLayoutReady()`.**
Prevents crashes when Obsidian layout isn't ready at plugin load time.
[VERIFIED: deepwiki.com/obsidianmd/obsidian-api/3-plugin-development]

```typescript
async onload() {
  await this.loadSettings();
  this.registerViews();
  this.registerCommands();
  this.app.workspace.onLayoutReady(() => {
    // restore any persisted session, etc.
  });
}
```

---

## 2. Graph Model Design

### How the Parsed Canvas Should Be Represented in Memory

The raw canvas type from `obsidian-api/canvas.d.ts` only has four node types: `text`, `file`, `link`, `group`. RadiProtocol's semantic node types (`question`, `answer`, `free-text-input`, `text-block`, `loop-start`, `loop-end`, `start`) are stored as custom properties with the `radiprotocol_` namespace, embedded in those canvas nodes.
[VERIFIED: github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts]
[VERIFIED: jsoncanvas.org — spec explicitly allows additional keys on CanvasData and nodes]

### Node Type Discrimination (TypeScript Discriminated Union)

```typescript
// graph/graph-model.ts

// The semantic node types RadiProtocol understands
type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'
  | 'text-block'
  | 'loop-start'
  | 'loop-end';

// Base fields preserved from canvas parsing
interface RPNodeBase {
  id: string;
  kind: RPNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface StartNode extends RPNodeBase {
  kind: 'start';
}

interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
}

interface AnswerNode extends RPNodeBase {
  kind: 'answer';
  answerText: string;         // Text appended to the report when chosen
  displayLabel?: string;      // Button label if different from answerText
}

interface FreeTextInputNode extends RPNodeBase {
  kind: 'free-text-input';
  promptLabel: string;        // "Describe the finding:"
  prefix?: string;            // Text prepended before user input
  suffix?: string;            // Text appended after user input
}

interface TextBlockNode extends RPNodeBase {
  kind: 'text-block';
  content: string;            // Static text always appended when reached
  snippetId?: string;         // Optional: references a snippet for placeholder fill-in
}

interface LoopStartNode extends RPNodeBase {
  kind: 'loop-start';
  loopLabel: string;          // "Describe each lesion"
  exitLabel: string;          // Button text: "No more lesions"
  maxIterations: number;      // Hard cap (default: 50)
}

interface LoopEndNode extends RPNodeBase {
  kind: 'loop-end';
  loopStartId: string;        // Back-reference to matching loop-start
}

type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode;

interface RPEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;   // Not relied upon for routing; answer text lives in AnswerNode
}

interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;            // nodeId → node (O(1) lookup)
  edges: RPEdge[];
  adjacency: Map<string, string[]>;      // nodeId → [outgoing neighbor nodeIds]
  reverseAdjacency: Map<string, string[]>; // nodeId → [incoming neighbor nodeIds]
  startNodeId: string;
}
```

### Why Map + Adjacency List (not edge objects only)

- **O(1) node lookup by ID** is essential during traversal (visited-set checks, resume validation).
- **Separate adjacency map** avoids scanning all edges on every step. Edge objects are preserved for metadata (labels, colors) if needed.
- **Reverse adjacency** enables upstream validation (detect nodes with no path from start).

### Parsing: from `.canvas` JSON to `ProtocolGraph`

```typescript
// graph/canvas-parser.ts
// Source: obsidian-api canvas.d.ts + jsoncanvas.org spec

import type { CanvasData, AllCanvasNodeData } from 'obsidian/canvas';

class CanvasParser {
  parse(jsonString: string, canvasFilePath: string): ParseResult {
    let raw: CanvasData;
    try {
      raw = JSON.parse(jsonString) as CanvasData;
    } catch {
      return { success: false, error: 'Invalid JSON in canvas file' };
    }

    const nodes = new Map<string, RPNode>();
    const errors: string[] = [];

    for (const rawNode of raw.nodes) {
      const rpNode = this.parseNode(rawNode);
      if (rpNode === null) {
        // Skip non-RadiProtocol nodes (plain canvas cards with no radiprotocol_ fields)
        continue;
      }
      if ('error' in rpNode) {
        errors.push(rpNode.error);
        continue;
      }
      nodes.set(rpNode.id, rpNode);
    }

    // Build adjacency lists from raw edges
    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    const edges: RPEdge[] = [];

    for (const rawEdge of raw.edges) {
      if (!nodes.has(rawEdge.fromNode) || !nodes.has(rawEdge.toNode)) continue;
      edges.push({ id: rawEdge.id, fromNodeId: rawEdge.fromNode,
                   toNodeId: rawEdge.toNode, label: rawEdge.label });
      if (!adjacency.has(rawEdge.fromNode)) adjacency.set(rawEdge.fromNode, []);
      adjacency.get(rawEdge.fromNode)!.push(rawEdge.toNode);
      if (!reverseAdjacency.has(rawEdge.toNode)) reverseAdjacency.set(rawEdge.toNode, []);
      reverseAdjacency.get(rawEdge.toNode)!.push(rawEdge.fromNode);
    }

    // ... find startNodeId, run validation, return graph
  }

  private parseNode(raw: AllCanvasNodeData): RPNode | null | { error: string } {
    // Check for radiprotocol_nodeType custom property
    const kind = (raw as any)['radiprotocol_nodeType'] as RPNodeKind | undefined;
    if (!kind) return null; // Not a RadiProtocol node — skip it

    switch (kind) {
      case 'question':
        return { id: raw.id, kind, x: raw.x, y: raw.y, width: raw.width, height: raw.height,
                 color: raw.color,
                 questionText: (raw as any)['radiprotocol_questionText'] ?? '' };
      // ... other cases
    }
  }
}
```

**Key insight:** Canvas files can contain a mix of RadiProtocol protocol nodes and plain canvas cards (notes, files, etc.). The parser silently skips nodes that lack `radiprotocol_nodeType`. This means users can keep documentation notes on the same canvas as their protocol.

### How `radiprotocol_*` properties are stored in the canvas file

The JSON Canvas spec (v1.0) defines `CanvasData` with an index signature `[key: string]: any`, and `CanvasNodeData` similarly extends to allow extra keys. RadiProtocol adds custom properties directly to node objects:
[VERIFIED: github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts]

```json
{
  "nodes": [
    {
      "id": "abc123",
      "type": "text",
      "text": "What is the laterality?",
      "x": 100, "y": 200, "width": 300, "height": 80,
      "color": "3",
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "What is the laterality?"
    }
  ]
}
```

The `text` field mirrors the question text so the canvas remains human-readable visually. The `radiprotocol_*` fields carry the semantic data.

**Namespace all custom fields with `radiprotocol_`.** This prevents collisions with other plugins or future Obsidian Canvas properties.
[VERIFIED: PITFALLS.md in this project]

### Loop-Start/Loop-End Pair Design

Loop nodes form a paired bracket:

```
[loop-start "Describe each lesion"] → [question] → [answer] → ... → [loop-end]
                ↑_______________________________________________________|
                (back-edge, loops until user clicks "No more lesions")
```

- `LoopStartNode.loopLabel` = displayed header ("Lesion #2")
- `LoopStartNode.exitLabel` = button text ("Done — no more lesions")
- `LoopEndNode.loopStartId` = links back to its matching loop-start
- At runtime, the runner checks: did user choose to loop again (→ back to loop-start's first child) or exit (→ follow loop-start's exit edge, which bypasses the loop body)?

**Two outgoing edges from loop-start:** one labeled `continue` (into loop body) and one labeled `exit` (past the loop). These are structural edges, not answer nodes.

### Validation

`graph-validator.ts` runs before every protocol session:

| Check | Method | Error |
|-------|--------|-------|
| Exactly one start node | Count nodes with `kind === 'start'` | "No start node found" / "Multiple start nodes found" |
| Reachability | BFS/DFS from start node | "X unreachable nodes found" |
| Unintentional cycles | Three-color DFS (white/gray/black) — cycles NOT through loop-end are errors | "Cycle detected not through a loop-end node" |
| Dead ends | Questions with no outgoing edges | "Question 'Y' has no answers" |
| Loop pairing | Every loop-end has a valid loopStartId | "Orphaned loop-end node" |
| Snippet references | TextBlockNodes with snippetId — check snippetService.exists() | "Snippet 'Z' not found" |

[ASSUMED: The two-outgoing-edges convention for loop-start is a RadiProtocol-specific design. Alternative: a special "loop again?" node. This decision should be validated with the user before implementation.]

---

## 3. Runner State Machine

### States, Transitions, and Data

The protocol session is a finite state machine with four top-level states:
[CITED: standard state machine pattern from TypeScript discriminated union literature]

```typescript
// runner/runner-state.ts

type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'awaiting-snippet-fill'
  | 'complete'
  | 'error';

// Each state carries only the data it needs
interface IdleState {
  status: 'idle';
}

interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  loopContextStack: LoopContext[];
  accumulatedText: string;
  undoStack: UndoEntry[];
}

interface AwaitingSnippetFillState {
  status: 'awaiting-snippet-fill';
  currentNodeId: string;
  snippet: SnippetFile;
  pendingText: string;             // Text waiting for placeholder substitution
  loopContextStack: LoopContext[];
  accumulatedText: string;
  undoStack: UndoEntry[];
}

interface CompleteState {
  status: 'complete';
  finalText: string;
}

interface ErrorState {
  status: 'error';
  message: string;
  recoverableFromNodeId?: string;  // If set, "Try again from here" is offered
}

type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;
```

### State Transitions

```
idle
  → at-node          (user launches protocol / resumes session)

at-node (question node)
  → at-node          (user selects an answer → follow edge to next node)
  → at-node          (auto-advance through text-block nodes)
  → awaiting-snippet-fill (text-block node with snippetId encountered)
  → complete         (no outgoing edges from current node)
  → at-node          (step-back: pop undoStack, go to previous node)

awaiting-snippet-fill
  → at-node          (user fills all placeholders → append resolved text, advance)
  → at-node          (user cancels snippet fill → skip the snippet text)

complete
  → idle             (user outputs text, starts new session)
```

### Step-Back Stack (Answer History + Text Undo)

The undo mechanism must revert BOTH the navigation position AND the accumulated text. This is the core complexity of step-back.
[VERIFIED: FEATURES.md in this project — "Must revert both the navigation state AND the accumulated protocol text"]

```typescript
interface UndoEntry {
  nodeId: string;               // The node we were at before this step
  loopContextSnapshot: LoopContext[];  // Deep copy of loop stack before this step
  textBeforeStep: string;       // Full accumulated text BEFORE this step appended anything
}
```

**Step-back algorithm:**
1. Pop the top `UndoEntry` from `undoStack`.
2. Restore `currentNodeId = entry.nodeId`.
3. Restore `loopContextStack = deepCopy(entry.loopContextSnapshot)`.
4. Restore `accumulatedText = entry.textBeforeStep`.
5. Re-render the view at the restored node.

This is append-only with snapshots, not a diff-based approach. The snapshot approach is simpler and correct for protocols that never generate more than a few KB of text.

### Loop Execution Context Stack

```typescript
interface LoopContext {
  loopStartNodeId: string;
  iteration: number;           // 1-based, for display ("Lesion #2")
  visitedInIteration: Set<string>;  // Node IDs visited in THIS iteration (prevents inner cycles)
}
```

When the runner reaches a `loop-start` node:
1. Push a new `LoopContext` onto `loopContextStack`.
2. Begin traversing the loop body.

When the runner reaches a `loop-end` node:
1. Ask user: "Loop again?" (using `loopStartNode.exitLabel` for the "No" button).
2. If yes: Pop the context, push a new one with `iteration + 1`, go back to loop-start's continue edge.
3. If no: Pop the context, follow loop-start's exit edge.

### Text Accumulation

```typescript
// runner/text-accumulator.ts

class TextAccumulator {
  private buffer = '';

  append(text: string): void {
    this.buffer += text;
  }

  get current(): string {
    return this.buffer;
  }

  snapshot(): string {
    return this.buffer;  // The undo stack stores these snapshots
  }

  restoreTo(snapshot: string): void {
    this.buffer = snapshot;
  }
}
```

**Design decision:** Text accumulation is append-only with full snapshots in the undo stack. No diff-based undo. This is correct because:
- Protocol outputs are small (< 5KB even for complex reports).
- Full snapshots make undo deterministic and testable.
- No need for an operational transform or CRDT approach.

[ASSUMED: Maximum report size is < 5KB. If the user builds a protocol generating very large text (unlikely in medical reporting context), the snapshot approach is still correct but uses more memory per undo entry.]

---

## 4. Snippet Data Model

### Snippet File Format (JSON Schema)

Each snippet is a separate JSON file, stored in the configured snippets folder (default: `.radiprotocol/snippets/`). One file per snippet to avoid write contention and merge conflicts.
[VERIFIED: PITFALLS.md — "one-file-per-snippet rather than a single JSON file"]

```typescript
// snippets/snippet-model.ts

type PlaceholderType = 'free-text' | 'choice' | 'multi-choice' | 'number';

interface PlaceholderBase {
  id: string;            // Unique within snippet, used for tab-stop order
  type: PlaceholderType;
  label: string;         // Human-readable label shown in fill-in UI: "Lesion size"
  required: boolean;
  defaultValue?: string;
}

interface FreeTextPlaceholder extends PlaceholderBase {
  type: 'free-text';
  multiline: boolean;
  maxLength?: number;
}

interface ChoicePlaceholder extends PlaceholderBase {
  type: 'choice';
  options: Array<{ value: string; label: string }>;
  allowFreeText: boolean;  // If true, user can type custom value beyond options
}

interface MultiChoicePlaceholder extends PlaceholderBase {
  type: 'multi-choice';
  options: Array<{ value: string; label: string }>;
  joinWith: string;        // How to join selected values: ", " or " and " etc.
}

interface NumberPlaceholder extends PlaceholderBase {
  type: 'number';
  unit?: string;           // "cm", "mm", "HU"
  min?: number;
  max?: number;
  decimalPlaces?: number;
}

type Placeholder =
  | FreeTextPlaceholder
  | ChoicePlaceholder
  | MultiChoicePlaceholder
  | NumberPlaceholder;

interface SnippetFile {
  id: string;                  // UUID, used for referencing from canvas nodes
  name: string;                // Display name: "Liver lesion size description"
  description?: string;
  template: string;            // "The {{size}} {{unit}} lesion in {{location}}"
  placeholders: Placeholder[]; // Ordered by tab-stop
  createdAt: string;           // ISO 8601
  updatedAt: string;
  version: number;             // Increment on save, for resume validation
}
```

**Template syntax:** `{{placeholder_id}}` — double curly braces with the placeholder's `id`. Simple and readable. The renderer substitutes values at fill-in time.

**File naming convention:** `.radiprotocol/snippets/{snippet.id}.json`

This is human-unreadable (UUID filenames) but avoids name collisions and simplifies lookup. A future snippet manager UI handles human-readable listing.

### How Snippets Are Referenced from Canvas Nodes

`TextBlockNode.snippetId` contains the snippet's UUID. When the runner reaches a `TextBlockNode` with a `snippetId`, it calls `snippetService.getById(snippetId)` to fetch the snippet file. If the snippet is not found, the runner shows an error rather than crashing.

### Snippet Fill-In UI Triggering During a Session

```
Runner reaches TextBlockNode with snippetId
    ↓
snippetService.getById(snippetId)
    ↓
RunnerView renders SnippetFillInModal or inline fill-in panel
    ↓
User fills placeholders (tab-navigated, live preview updates)
    ↓
On "Confirm": runner calls textAccumulator.append(resolvedText)
    ↓
Runner transitions to next node
```

The fill-in UI can be:
- **Modal** (simpler to implement for v1): A `Modal` dialog showing placeholder fields.
- **Inline panel** (better UX, deferred): A collapsible section within the RunnerView itself.

For v1, use a Modal. For v2, consider inline to avoid interrupting the runner view context.

---

## 5. Session Persistence Model

### What to Serialize for Mid-Session Save

Sessions are stored as JSON files in `.radiprotocol/sessions/`. Auto-save occurs after each step (not just explicit saves).

```typescript
// sessions/session-service.ts

interface PersistedSession {
  id: string;                   // UUID
  canvasFilePath: string;       // Vault-relative path to the .canvas file
  canvasFileModTime: number;    // mtime at save time — for change detection on resume
  currentNodeId: string;
  accumulatedText: string;      // Current report text
  undoStack: PersistedUndoEntry[];
  loopContextStack: PersistedLoopContext[];
  snippetSnapshots: Record<string, SnippetFile>; // snippetId → full snapshot at save time
  savedAt: string;              // ISO 8601
  status: 'in-progress' | 'complete';
}

// Serializable versions (no Set — must convert to Array)
interface PersistedLoopContext {
  loopStartNodeId: string;
  iteration: number;
  visitedInIteration: string[];  // Array, not Set, for JSON serialization
}

interface PersistedUndoEntry {
  nodeId: string;
  loopContextSnapshot: PersistedLoopContext[];
  textBeforeStep: string;
}
```

### Validation on Resume

[VERIFIED: PITFALLS.md — canvas file modification between save and resume is documented]

On resume, the `SessionService` runs:

1. **Canvas file still exists?** If not: "The protocol file has been moved or deleted."
2. **Canvas mtime changed?** If yes: warn "The protocol has been modified since your session was saved." Offer: `[Try to resume]` (optimistic) or `[Start over]`.
3. **All saved node IDs still exist in the current graph?** If not: "X nodes referenced by your session no longer exist. Cannot resume."
4. **All snippet snapshots still match current snippets?** (Compare `version` field.) If mismatch: warn but allow resume using the saved snapshot content (ensures consistency over freshness).

### File Path Convention for Sessions

```
.radiprotocol/
  sessions/
    {session-id}.json    ← active session
    completed/
      {session-id}.json  ← moved here after output
  snippets/
    {snippet-id}.json
```

Sessions in `completed/` can be reviewed or re-run. They are not automatically cleaned up (the user decides when to delete them).

---

## 6. Data Flow: End-to-End

**Scenario:** User opens a `.canvas` file, runs a protocol, answers questions, and outputs to clipboard.

```
[1] User opens MyProtocol.canvas in Obsidian Canvas view
    → Obsidian opens canvas as usual; RadiProtocol does nothing here
    → canvas file is NOT modified by RadiProtocol

[2] User triggers "Run protocol" command (command palette / ribbon icon / file menu)
    → RadiProtocolPlugin.onRunProtocol(activeFile)
    → Check: is activeFile a .canvas file? If not, error notice.
    → Check: is the canvas currently open in a Canvas leaf? (critical: must NOT modify it)

[3] CanvasParser.parse(await vault.read(activeFile))
    → Returns ProtocolGraph or ParseError
    → If error: show Notice with message

[4] GraphValidator.validate(graph)
    → Returns ValidationResult with errors and warnings
    → If critical errors: show ValidationErrorModal with list
    → If only warnings: show them but proceed

[5] SessionService.checkForExistingSession(activeFile.path)
    → If found: show "Resume session?" prompt
    → If yes: load PersistedSession, reconstruct RunnerState
    → If no: create new RunnerState at startNode

[6] RunnerView.open(graph, runnerState)
    → activateRunnerView() → right sidebar leaf
    → View renders current node (e.g., QuestionNode)

[7] User sees: question text + answer buttons (from outgoing AnswerNode children)
    → User clicks an answer button
    → RunnerView.onAnswerSelected(answerNodeId)
    → TextAccumulator.append(answerNode.answerText)
    → UndoStack.push({ nodeId: currentNodeId, loopContextSnapshot, textBeforeStep })
    → Traverse graph: follow edge from current question to next node via adjacency map

[8] If next node is TextBlockNode with snippetId:
    → snippetService.getById(snippetId)
    → SnippetFillInModal.open(snippet)
    → User fills placeholders (tab-navigated, live preview)
    → On confirm: TextAccumulator.append(resolvedSnippetText)
    → Continue traversal

[9] If next node is FreeTextInputNode:
    → View renders a text input field
    → User types, presses Enter/Next
    → TextAccumulator.append(prefix + userInput + suffix)
    → Continue traversal

[10] If next node is LoopStartNode:
     → Push LoopContext onto stack (iteration = 1)
     → View renders "Lesion #1" header + loop body's first question

[11] If next node is LoopEndNode:
     → View renders: [Loop again: "Describe another lesion"] [Done: "No more lesions"]
     → If loop again: pop context, push new (iteration + 1), go to loop-start's continue edge
     → If done: pop context, follow loop-start's exit edge

[12] After each step:
     → SessionService.autosave(currentRunnerState)  ← async, non-blocking, write mutex

[13] Traversal reaches node with no outgoing edges:
     → RunnerState transitions to 'complete'
     → View shows final text + output buttons

[14] User clicks "Copy to clipboard":
     → navigator.clipboard.writeText(accumulatedText)
     → Notice: "Protocol output copied to clipboard"
     → SessionService.markComplete(sessionId)

[15] Optionally, "Save to new note":
     → vault.create(outputPath, accumulatedText)
     → Open the new note
```

### Component Interaction Diagram

```
RadiProtocolPlugin (main.ts)
        │
        ├─── CanvasParser ──────── [pure, no Obsidian dep]
        │         └── parses JSON → ProtocolGraph
        │
        ├─── GraphValidator ─────── [pure, depends only on ProtocolGraph]
        │         └── validates → ValidationResult
        │
        ├─── SnippetService ────── [reads/writes vault via app.vault]
        │         └── getById, create, update, delete, list
        │
        ├─── SessionService ────── [reads/writes vault via app.vault]
        │         └── save, load, autosave, markComplete
        │
        └─── RunnerView (ItemView)
                  │
                  ├── holds RunnerState (discriminated union)
                  ├── calls SnippetService for snippet nodes
                  ├── calls SessionService for autosave
                  └── drives TextAccumulator
```

---

## 7. Reference Architectures: Patterns from Mature Plugins

### Cannoli: Core/Plugin Package Separation

Cannoli uses a **monorepo with `cannoli-core` and `cannoli-plugin`** packages. The core contains all graph traversal and execution logic with no Obsidian dependency. The plugin package wraps core for Obsidian.
[VERIFIED: github.com/DeabLabs/cannoli/blob/main/DEVELOPMENT.md]

**Lesson for RadiProtocol:** The `graph/` and `runner/` modules should have no `import ... from 'obsidian'` statements. This makes them unit-testable without Obsidian and future-proofed if RadiProtocol ever runs as a web app or CLI.

### ZettelFlow: Canvas as Directed Graph Workflow

ZettelFlow reads canvas files to extract a directed workflow graph. Root notes (nodes with no incoming edges) are starting points — RadiProtocol's `StartNode` serves the same purpose, but is explicit rather than inferred.
[VERIFIED: github.com/RafaelGB/Obsidian-ZettelFlow — architecture analysis via DeepWiki]

**Lesson for RadiProtocol:** Explicit `StartNode` is better than inferring from edge topology. Protocols can have disconnected subgraphs (notes on the canvas not part of the protocol), so inferring "no incoming edges = start" would yield false positives.

### Obsidian Gemini: Plugin as Service Locator

The `ObsidianGemini` main class exposes services as public members. Views receive `this` (the plugin) and access services through it.
[VERIFIED: deepwiki.com/allenhutchison/obsidian-gemini]

**Lesson for RadiProtocol:** This is the right pattern for a single-developer plugin. Avoid over-engineering with an IoC container. The plugin reference IS the service locator.

### Tasknotes / General Best Practice: Unidirectional Data Flow

The Tasknotes plugin enforces: User Action → Service → File System → Cache → Event → UI.
[CITED: github.com/callumalpass/tasknotes/blob/main/Tasknotes-Development-Guidelines.md]

**Lesson for RadiProtocol:** 
- User actions in the View call runner methods
- Runner methods update state and call services
- Services write to vault
- Vault events are NOT used to sync runner state (too slow, too indirect)
- Runner state is the single source of truth; the view observes it

### Obsidian Sample Plugin: Settings Persistence Pattern

Always merge with defaults:
[VERIFIED: deepwiki.com/obsidianmd/obsidian-sample-plugin]

```typescript
async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

`loadData()` returns `null` on first install (no `data.json` yet). `Object.assign({}, DEFAULT_SETTINGS, null)` correctly falls back to defaults.

---

## 8. Settings Schema

```typescript
interface RadiProtocolSettings {
  snippetsFolder: string;      // Default: ".radiprotocol/snippets"
  sessionsFolder: string;      // Default: ".radiprotocol/sessions"
  outputFolder: string;        // Default: "RadiProtocol Output"
  outputMode: 'clipboard' | 'new-note' | 'both';
  maxLoopIterations: number;   // Default: 50
  autoSaveSession: boolean;    // Default: true
  showRunnerInRightSidebar: boolean;  // Default: true (vs. main area tab)
  nodeColorMap: Record<RPNodeKind, string>;  // Maps node types to canvas color codes
}

const DEFAULT_SETTINGS: RadiProtocolSettings = {
  snippetsFolder: '.radiprotocol/snippets',
  sessionsFolder: '.radiprotocol/sessions',
  outputFolder: 'RadiProtocol Output',
  outputMode: 'clipboard',
  maxLoopIterations: 50,
  autoSaveSession: true,
  showRunnerInRightSidebar: true,
  nodeColorMap: {
    'start': '5',       // purple
    'question': '1',    // red
    'answer': '4',      // green
    'free-text-input': '3', // yellow
    'text-block': '6',  // pink
    'loop-start': '2',  // orange
    'loop-end': '2',    // orange
  }
};
```

---

## 9. Write Mutex (Preventing vault.modify Race Conditions)

[VERIFIED: PITFALLS.md — "vault.modify() race conditions" documented; async-mutex library confirmed by npm registry search]
[VERIFIED: npm package `async-mutex` exists and is TypeScript-native]

```typescript
// utils/write-mutex.ts
import { Mutex } from 'async-mutex';

class WriteMutex {
  private locks = new Map<string, Mutex>();

  private getLock(filePath: string): Mutex {
    if (!this.locks.has(filePath)) {
      this.locks.set(filePath, new Mutex());
    }
    return this.locks.get(filePath)!;
  }

  async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const mutex = this.getLock(filePath);
    return mutex.runExclusive(fn);
  }
}

export const writeMutex = new WriteMutex();
```

Usage in `SnippetService`:

```typescript
async saveSnippet(snippet: SnippetFile): Promise<void> {
  const path = this.snippetPath(snippet.id);
  await writeMutex.withLock(path, async () => {
    const json = JSON.stringify(snippet, null, 2);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, json);
    } else {
      await ensureFolder(this.app.vault, this.settings.snippetsFolder);
      await this.app.vault.create(path, json);
    }
  });
}
```

**Note on `vault.process`:** The `vault.process(file, callback)` API provides atomic read-modify-write semantics (callback receives current content, returns new content). However, it does NOT work within 2 seconds of a file being edited in the editor (requestSave debounce conflict). For snippet/session files that are never open in Obsidian's editor, `vault.process` is safe. For extra safety, `vault.modify` with the write mutex is used throughout.
[VERIFIED: forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862]

---

## 10. ItemView: getState() / setState() for Session Persistence

The `RunnerView` must implement `getState()` and `setState()` so Obsidian can save and restore the view when the workspace is closed and reopened.
[VERIFIED: forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798]
[VERIFIED: PITFALLS.md — "ItemView state management is poorly documented"]

```typescript
class RunnerView extends ItemView {
  // ...

  // Called by Obsidian when saving workspace layout
  getState(): RunnerViewState {
    return {
      sessionId: this.currentSessionId ?? null,
      canvasFilePath: this.currentCanvasPath ?? null,
    };
  }

  // Called by Obsidian when restoring workspace layout
  async setState(state: RunnerViewState, result: ViewStateResult): Promise<void> {
    if (state.sessionId && state.canvasFilePath) {
      // Attempt to resume the session
      await this.resumeSession(state.sessionId, state.canvasFilePath);
    }
    return super.setState(state, result);
  }
}

interface RunnerViewState {
  sessionId: string | null;
  canvasFilePath: string | null;
}
```

**Rule:** `getState()` returns only identifiers — never large data. The session's full state is in the vault file, loaded by `setState()` via `SessionService`.

---

## 11. Command and Entry Point Patterns

[VERIFIED: deepwiki.com/obsidianmd/obsidian-api/3-plugin-development]
[VERIFIED: PITFALLS.md — command naming conventions]

```typescript
// In main.ts onload()

// 1. Ribbon icon (secondary trigger)
this.addRibbonIcon('play-circle', 'Run protocol', () => {
  this.runProtocolFromActiveFile();
});

// 2. Command palette (primary trigger — no plugin name prefix per guidelines)
this.addCommand({
  id: 'run-protocol',
  name: 'Run protocol',
  checkCallback: (checking) => {
    const file = this.app.workspace.getActiveFile();
    const isCanvas = file?.extension === 'canvas';
    if (checking) return isCanvas;
    if (isCanvas) this.runProtocolFromActiveFile();
  },
});

this.addCommand({
  id: 'validate-protocol',
  name: 'Validate protocol',
  checkCallback: (checking) => {
    const file = this.app.workspace.getActiveFile();
    const isCanvas = file?.extension === 'canvas';
    if (checking) return isCanvas;
    if (isCanvas) this.validateProtocol(file!);
  },
});

this.addCommand({
  id: 'open-snippet-manager',
  name: 'Open snippet manager',
  callback: () => this.activateSnippetManagerView(),
});

// 3. File menu integration (right-click on .canvas file in file explorer)
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    if (!(file instanceof TFile) || file.extension !== 'canvas') return;
    menu.addItem((item) => {
      item.setTitle('Run protocol')
        .setIcon('play-circle')
        .onClick(() => this.runProtocolFromFile(file));
    });
  })
);
```

---

## 12. Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Approach |
|---|---|---|
| `element.innerHTML = ...` | Flagged in plugin review (XSS vector) | Use `createEl()`, `createDiv()`, `el.textContent`. For HTML rendering, use `sanitizeHTMLToDom()` [VERIFIED: PITFALLS.md] |
| `require('fs')` | Fails on mobile, bypasses vault tracking | Always use `app.vault.*` [VERIFIED: PITFALLS.md] |
| `console.log()` | Blocked in plugin review | Use `console.debug()` during dev; remove before release [VERIFIED: PITFALLS.md] |
| Modifying `.canvas` while open | Canvas view overwrites changes | Read-only canvas parsing; side panel writes must close canvas first [VERIFIED: PITFALLS.md] |
| `workspace.activeLeaf` | Deprecated | Use `workspace.getActiveViewOfType()` or `getMostRecentLeaf()` [VERIFIED: PITFALLS.md] |
| `vault.modify()` without mutex | Race condition data loss | Always use `writeMutex.withLock()` [VERIFIED: PITFALLS.md] |
| Storing large objects in `getState()` | Workspace.json bloat | Store only IDs; full data lives in vault files [VERIFIED: forum thread] |
| Unregistered event listeners | Memory leaks | Always `this.registerEvent()`, `this.registerDomEvent()` [VERIFIED: deepwiki plugin-development docs] |
| `any` types in the parser | Review rejection | Type narrowing via discriminated unions; cast `loadData()` result immediately [VERIFIED: PITFALLS.md] |
| XState or other state machine library | Adds bundle size + complexity for a simple linear wizard | Hand-rolled discriminated union + explicit transitions; sufficient for this problem [ASSUMED — verified XState is 16.7KB min+gz; overkill for 4-state machine] |

---

## 13. Recommended File/Folder Layout

```
src/
├── main.ts                       # RadiProtocolPlugin class (150-200 lines max)
├── settings.ts                   # RadiProtocolSettings + DEFAULT_SETTINGS + SettingsTab
│
├── graph/
│   ├── graph-model.ts            # All RPNode types, RPEdge, ProtocolGraph
│   ├── canvas-parser.ts          # JSON → ProtocolGraph (pure, no obsidian import)
│   └── graph-validator.ts        # ValidationResult, start node, cycles, reachability
│
├── runner/
│   ├── runner-state.ts           # RunnerState discriminated union + type guards
│   ├── protocol-runner.ts        # State machine logic: advance, step-back, loop handling
│   └── text-accumulator.ts       # Append-only buffer + snapshot/restore
│
├── snippets/
│   ├── snippet-model.ts          # SnippetFile, Placeholder union types
│   └── snippet-service.ts        # CRUD via vault, write mutex, ensureFolder
│
├── sessions/
│   └── session-service.ts        # Save/load/autosave/markComplete PersistedSession
│
├── views/
│   ├── runner-view.ts            # ItemView: the protocol execution UI
│   ├── editor-panel-view.ts      # ItemView: side panel for node properties
│   └── snippet-manager-view.ts   # ItemView: snippet CRUD + preview UI
│
└── utils/
    ├── write-mutex.ts            # Per-file Mutex wrapper (uses async-mutex)
    └── vault-utils.ts            # ensureFolder, safeCreate, safeModify
```

**Total estimated files at v1 launch:** ~15 TypeScript source files. Manageable for a solo developer. Keep `main.ts` under 200 lines — it should only wire things together, not implement logic.

---

## 14. Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Loop-start uses two outgoing edges (continue + exit) rather than a special decision node | If users find two-edge approach confusing, a "loop-again question node" may be clearer — but requires an extra node type |
| A2 | Template syntax uses `{{placeholder_id}}` double curly braces | A different delimiter (e.g., `${id}`, `[[id]]`) could be chosen — any delimiter works if consistently applied |
| A3 | Maximum report text is < 5KB, making full snapshots in undo stack acceptable | Very unlikely to exceed this in clinical protocols; if it does, switch to diff-based undo |
| A4 | XState/state machine library is overkill; hand-rolled discriminated union is sufficient | If the runner grows to 8+ states with complex parallel transitions, XState would be worth adopting |
| A5 | Sessions in `.radiprotocol/sessions/` are vault-visible files (users can see and delete them) | Alternative: store in plugin's `data.json` (opaque to users). File approach is better for transparency but clutters the vault unless the user hides the folder. |
| A6 | `radiprotocol_*` canvas properties survive all Obsidian updates | Canvas spec allows extra keys; risk is LOW but non-zero. A fallback copy of all metadata in a sidecar file could mitigate this if the risk materializes. |

---

## Sources

### Primary (HIGH confidence — verified in session)
- [obsidianmd/obsidian-api canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) — confirmed Canvas TypeScript types: CanvasData, CanvasNodeData union, CanvasEdgeData
- [DeepWiki: Obsidian API — Canvas System](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system) — Canvas API scope and limitations confirmed
- [DeepWiki: Obsidian API — Plugin Development](https://deepwiki.com/obsidianmd/obsidian-api/3-plugin-development) — Plugin lifecycle, registerView, registerEvent patterns
- [DeepWiki: Obsidian API — Event System](https://deepwiki.com/obsidianmd/obsidian-api/5.1-event-system) — Vault and workspace event types
- [DeepWiki: obsidian-sample-plugin](https://deepwiki.com/obsidianmd/obsidian-sample-plugin) — Settings pattern, modal pattern
- [DeepWiki: obsidian-gemini plugin](https://deepwiki.com/allenhutchison/obsidian-gemini) — Service layer, plugin-as-service-locator pattern
- [Obsidian Forum: How to correctly open an ItemView](https://forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871) — getRightLeaf / detachLeavesOfType / revealLeaf pattern
- [Obsidian Forum: vault.process debounce issue](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) — vault.process semantics and limitations
- [Cannoli DEVELOPMENT.md](https://github.com/DeabLabs/cannoli/blob/main/DEVELOPMENT.md) — monorepo core/plugin separation pattern
- [ZettelFlow GitHub](https://github.com/RafaelGB/Obsidian-ZettelFlow) — canvas-as-workflow pattern
- FEATURES.md and PITFALLS.md in this project (written by parallel research agents)

### Secondary (MEDIUM confidence — verified via official sources)
- [jsoncanvas.org](https://jsoncanvas.org/) — JSON Canvas spec v1.0, extra keys allowed
- [async-mutex npm](https://www.npmjs.com/package/async-mutex) — TypeScript-native mutex library
- [Obsidian Forum: ItemView state management confusion](https://forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798) — getState/setState pattern

### Tertiary (ASSUMED — from training knowledge, not verified this session)
- XState bundle size (~16.7KB min+gz) making it overkill for this use case
- `{{placeholder_id}}` template syntax choice
- Full-snapshot undo approach suitability for < 5KB reports
