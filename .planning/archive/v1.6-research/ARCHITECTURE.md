# Architecture Patterns

**Domain:** Programmatic Canvas Node Creation/Duplication for Obsidian Plugin (RadiProtocol v1.6)
**Researched:** 2026-04-16

## Recommended Architecture

### Overview

Node creation and duplication integrate into the existing `EditorPanelView` + `CanvasLiveEditor` architecture as a **new capability layer** on top of Pattern B (live canvas internal API). No changes to Strategy A (file-based write-back) are needed for node creation -- creation inherently requires an open canvas to position nodes visually.

```
EditorPanelView (UI)
  |-- "Quick Create" toolbar (NEW)         -- buttons for each RPNodeKind
  |-- "Duplicate Node" button (NEW)        -- clones current node with offset
  |
  v
CanvasNodeFactory (NEW service)
  |-- createNode(kind, position, canvas)   -- creates + stamps radiprotocol_* props
  |-- duplicateNode(sourceId, canvas)      -- clones all props with position offset
  |
  v
CanvasLiveEditor (EXISTING - extended)
  |-- getCanvasView() (existing)           -- probes for Pattern B API
  |-- NEW: getCanvasInternal()             -- exposes canvas object for createTextNode
  |
  v
Obsidian Internal Canvas API (Pattern B)
  |-- canvas.createTextNode({pos, size, text, save, focus})
  |-- canvas.requestSave()
  |-- canvas.getData() / canvas.setData()  -- for post-creation property stamping
```

### Component Boundaries

| Component | Responsibility | Communicates With | Status |
|-----------|---------------|-------------------|--------|
| `EditorPanelView` | Renders quick-create toolbar + duplicate button; handles user intent | `CanvasNodeFactory`, `CanvasLiveEditor` | MODIFY |
| `CanvasNodeFactory` | Encapsulates node creation logic, default property stamping, position calculation | `CanvasLiveEditor`, `NODE_COLOR_MAP` | NEW |
| `CanvasLiveEditor` | Provides access to live canvas internal API; applies property edits | Obsidian internal Canvas API | MODIFY (minor) |
| `canvas-internal.d.ts` | Type declarations for undocumented Canvas API | N/A (ambient types) | MODIFY |
| `node-color-map.ts` | Maps RPNodeKind to canvas palette color | N/A (pure data) | NO CHANGE |
| `graph-model.ts` | RPNode type definitions | N/A (pure types) | NO CHANGE |

### Data Flow: Create Node

```
1. User clicks "Create [kind]" button in EditorPanelView toolbar
2. EditorPanelView calls CanvasNodeFactory.createNode(kind, canvasFilePath)
3. CanvasNodeFactory:
   a. Gets CanvasViewInternal via CanvasLiveEditor.getCanvasInternal(filePath)
   b. Reads current viewport center via canvas bounding box or selection position
   c. Calls canvas.createTextNode({ pos, size, text: kindLabel, save: false, focus: false })
   d. Returned CanvasNode has .id -- use it to stamp radiprotocol_* properties
   e. Stamps properties via canvas.getData() / setData() (existing Pattern B path)
      OR directly via node.setData() on the returned CanvasNode object
   f. Calls canvas.requestSave() (debounced)
4. EditorPanelView auto-loads the new node for editing (reuse handleNodeClick flow)
```

### Data Flow: Duplicate Node

```
1. User clicks "Duplicate" button while a node is loaded in EditorPanelView
2. EditorPanelView calls CanvasNodeFactory.duplicateNode(filePath, sourceNodeId)
3. CanvasNodeFactory:
   a. Reads source node data from canvas.getData().nodes.find(n => n.id === sourceNodeId)
   b. Copies all radiprotocol_* properties + color + text
   c. Calculates offset position: source.x + source.width + 40, source.y (right of source)
   d. Calls canvas.createTextNode({ pos: offsetPos, size: {width, height}, text, save: false, focus: false })
   e. Stamps radiprotocol_* properties onto new node via getData/setData
   f. Calls canvas.requestSave()
4. EditorPanelView loads the duplicated node for editing
```

### Data Flow: Duplicate Node with Edges (deferred)

Edge duplication is complex (which edges? remap targets?) and is explicitly out of scope for v1.6. Duplicate creates a standalone node with all properties but no edges.

## New Component: CanvasNodeFactory

### Location

`src/canvas/canvas-node-factory.ts` -- same directory as `canvas-live-editor.ts` and `node-color-map.ts`.

### Interface

```typescript
// src/canvas/canvas-node-factory.ts
import type { App } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type { CanvasLiveEditor } from './canvas-live-editor';

export type CreateNodeResult =
  | { success: true; nodeId: string }
  | { success: false; reason: string };

export class CanvasNodeFactory {
  constructor(
    private readonly app: App,
    private readonly liveEditor: CanvasLiveEditor
  ) {}

  /** Create a new canvas text node pre-stamped with radiprotocol_* properties. */
  createNode(filePath: string, kind: RPNodeKind): CreateNodeResult;

  /** Duplicate an existing node: clone all radiprotocol_* props, offset position. */
  duplicateNode(filePath: string, sourceNodeId: string): CreateNodeResult;
}
```

### Why a Separate Service (Not Inline in EditorPanelView)

1. **Testability** -- CanvasNodeFactory can be unit-tested with mocked CanvasLiveEditor
2. **Single responsibility** -- EditorPanelView already has 740 lines; adding creation logic would bloat it further
3. **Reusability** -- Context menu "Create node here" or future command palette actions can reuse the same factory
4. **Consistent with existing patterns** -- CanvasLiveEditor is already a separate service instantiated in main.ts

## Modifications to Existing Components

### CanvasLiveEditor (minor extension)

Add a method to expose the raw internal canvas object for `createTextNode()` calls:

```typescript
/** Returns the internal Canvas object for direct API calls (createTextNode, etc.).
 *  Returns undefined if canvas is closed or Pattern B API unavailable. */
getCanvasObject(filePath: string): CanvasInternal | undefined {
  const view = this.getCanvasView(filePath);
  return view?.canvas;
}
```

Rationale: `saveLive()` operates on getData/setData which is sufficient for editing existing nodes, but node creation requires `canvas.createTextNode()` -- a method not currently exposed.

Alternative considered: Put createTextNode call inside CanvasLiveEditor itself. Rejected because CanvasLiveEditor's responsibility is "edit existing nodes" -- creation is a distinct concern.

### canvas-internal.d.ts (extend types)

Add the `createTextNode` method and supporting types:

```typescript
export interface CreateTextNodeOptions {
  pos: { x: number; y: number };
  size: { width: number; height: number };
  text?: string;
  focus?: boolean;
  save?: boolean;
}

export interface CanvasNodeInternal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  /** Sets the text content of the canvas node card. */
  setText?(text: string): void;
  /** Returns node-level data (similar to getData on canvas). */
  getData?(): CanvasNodeData;
  /** Writes node-level data. */
  setData?(data: Partial<CanvasNodeData>): void;
}

// Add to CanvasInternal interface:
export interface CanvasInternal {
  // ... existing methods ...
  
  /** Creates a new text node on the canvas. Returns the created node object.
   *  API shape confirmed via obsidian-advanced-canvas Canvas.d.ts and
   *  obsidian-canvas-presentation usage. */
  createTextNode(options: CreateTextNodeOptions): CanvasNodeInternal;
  
  /** Map of all canvas nodes by ID. */
  nodes?: Map<string, CanvasNodeInternal>;
}
```

**Confidence: MEDIUM** -- The createTextNode API is used by multiple community plugins (obsidian-advanced-canvas, obsidian-canvas-presentation, enchanted-canvas) but is undocumented. The options shape changed between Obsidian versions (pre-1.1.10 used positional args; 1.1.10+ uses options object). Runtime probing is essential.

### EditorPanelView (add toolbar)

Add a "Quick Create" toolbar at the top of the panel (above node type dropdown) when a canvas is active:

```
+----------------------------------+
|  Quick Create:                   |
|  [Q] [A] [T] [F] [S] [Ls] [Le] |  <- one button per kind
|  [Duplicate Current Node]        |  <- only when node loaded
+----------------------------------+
|  Node type: [dropdown]           |  <- existing form
|  ...                             |
```

The toolbar is rendered:
- Always when canvas is open (for create buttons)
- "Duplicate" button only when `currentNodeId` is set

### main.ts (wire factory)

```typescript
// In onload():
this.canvasNodeFactory = new CanvasNodeFactory(this.app, this.canvasLiveEditor);

// Expose as plugin property:
canvasNodeFactory!: CanvasNodeFactory;
```

## Patterns to Follow

### Pattern 1: Runtime API Probing (Critical)

**What:** Before calling any internal canvas method, probe for its existence at runtime.
**When:** Every call to `createTextNode`, `canvas.nodes`, or any undocumented API.
**Example:**
```typescript
const canvas = this.liveEditor.getCanvasObject(filePath);
if (!canvas || typeof canvas.createTextNode !== 'function') {
  return { success: false, reason: 'Canvas API unavailable -- open the canvas first' };
}
```
**Why:** The internal API is undocumented and can change between Obsidian versions. This is the same pattern used by `CanvasLiveEditor.getCanvasView()` (line 42: `typeof view.canvas?.getData !== 'function'`).

### Pattern 2: Post-Creation Property Stamping via getData/setData

**What:** After `createTextNode()` returns a node, stamp `radiprotocol_*` properties using the existing getData/setData Pattern B flow.
**When:** Every node creation.
**Example:**
```typescript
const newNode = canvas.createTextNode({ pos, size, text: label, save: false, focus: false });
// Now stamp radiprotocol properties
const data = canvas.getData();
const nodeData = data.nodes.find(n => n.id === newNode.id);
if (nodeData) {
  nodeData.radiprotocol_nodeType = kind;
  nodeData.color = NODE_COLOR_MAP[kind];
  // Set kind-specific defaults
  canvas.setData(data);
  canvas.requestSave();
}
```
**Why:** createTextNode only creates a vanilla canvas text node. RadiProtocol properties must be applied separately. Using getData/setData is the proven Pattern B path already validated in `CanvasLiveEditor.saveLive()`.

### Pattern 3: Position Calculation from Viewport/Selection

**What:** Place new nodes intelligently -- near existing selection or at viewport center.
**When:** Every `createNode` call.
**Example:**
```typescript
function getCreatePosition(
  canvas: CanvasInternal,
  sourceNode?: CanvasNodeData
): { x: number; y: number } {
  if (sourceNode) {
    // Place right of source with 40px gap
    return { x: sourceNode.x + sourceNode.width + 40, y: sourceNode.y };
  }
  // Fallback: center of viewport (requires canvas.tx, canvas.ty internals)
  // Or fixed offset from origin
  return { x: 0, y: 0 };
}
```

### Pattern 4: Reuse Existing loadNode for Post-Creation UX

**What:** After creating a node, call `EditorPanelView.loadNode(filePath, newNodeId)` to immediately open it for editing.
**When:** Every successful node creation/duplication.
**Why:** Consistent UX -- user sees the property form for the just-created node. No new UI flow needed.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct vault.modify() for Node Creation

**What:** Creating nodes by reading canvas JSON, appending a node object, and writing back via vault.modify().
**Why bad:** Fails when canvas is open (Strategy A requires canvas closed). Node creation inherently needs the canvas open for visual feedback. Using vault.modify() on an open canvas causes data loss -- Obsidian's in-memory state overwrites the file on next auto-save.
**Instead:** Use Pattern B internal API (`canvas.createTextNode()`) exclusively. If canvas is closed, show a Notice asking user to open it.

### Anti-Pattern 2: Edge Duplication on Node Duplicate

**What:** Automatically duplicating all edges connected to the source node.
**Why bad:** Edge targets become ambiguous (should they point to the same destinations? should they be remapped?). Creates invalid graph states. Users will connect edges manually on canvas.
**Instead:** Duplicate node only -- no edges. Let user draw connections visually.

### Anti-Pattern 3: Generating Random IDs for Nodes

**What:** Generating your own UUID/random ID for the new canvas node.
**Why bad:** Obsidian's `createTextNode()` generates the node ID internally. Using a conflicting ID scheme causes silent collisions or orphaned nodes.
**Instead:** Always use the ID returned by `createTextNode()`.

### Anti-Pattern 4: Attempting Node Creation with Canvas Closed

**What:** Trying to create nodes via vault.modify() when no canvas view is open.
**Why bad:** There is no visual context for node placement. User cannot see the result. May conflict with closed-canvas JSON state.
**Instead:** Require canvas to be open. Show `Notice('Open the canvas to create nodes.')`.

## Integration with Existing Architecture

### What Does NOT Change

| Component | Why Unchanged |
|-----------|--------------|
| `CanvasParser` | Pure read-only parser -- does not care how nodes were created |
| `GraphValidator` | Validates graph structure regardless of creation method |
| `ProtocolRunner` | Runs protocols from parsed graphs -- source of nodes irrelevant |
| `RunnerView` | Displays protocol sessions -- no creation concern |
| `SnippetService` | Manages snippet files -- orthogonal to canvas nodes |
| `SessionService` | Session persistence -- orthogonal |
| `graph-model.ts` | Type definitions stable -- all 8 node kinds already defined |
| `node-color-map.ts` | Color mapping stable -- used by factory, not modified |

### What Changes (Summary)

| Component | Change | Size |
|-----------|--------|------|
| `canvas-node-factory.ts` | NEW file | ~150 lines |
| `canvas-internal.d.ts` | Add createTextNode types | ~25 lines |
| `canvas-live-editor.ts` | Add getCanvasObject() method | ~10 lines |
| `editor-panel-view.ts` | Add quick-create toolbar + duplicate button | ~80 lines |
| `main.ts` | Wire CanvasNodeFactory | ~3 lines |
| `src/styles/editor-panel.css` | Quick-create toolbar styling | ~30 lines |

### Default Property Templates per Kind

When creating a node of a given kind, stamp these default properties:

| Kind | Default Properties |
|------|-------------------|
| `start` | `radiprotocol_nodeType: 'start'`, `text: 'Start'` |
| `question` | `radiprotocol_nodeType: 'question'`, `radiprotocol_questionText: ''`, `text: 'Question'` |
| `answer` | `radiprotocol_nodeType: 'answer'`, `radiprotocol_answerText: ''`, `text: 'Answer'` |
| `free-text-input` | `radiprotocol_nodeType: 'free-text-input'`, `radiprotocol_promptLabel: ''`, `text: 'Free text'` |
| `text-block` | `radiprotocol_nodeType: 'text-block'`, `radiprotocol_content: ''`, `text: 'Text block'` |
| `loop-start` | `radiprotocol_nodeType: 'loop-start'`, `radiprotocol_loopLabel: 'Loop'`, `radiprotocol_exitLabel: 'Done'`, `radiprotocol_maxIterations: 50`, `text: 'Loop start'` |
| `loop-end` | `radiprotocol_nodeType: 'loop-end'`, `radiprotocol_loopStartId: ''`, `text: 'Loop end'` |
| `snippet` | `radiprotocol_nodeType: 'snippet'`, `text: 'Snippet'` |

All kinds also get `color: NODE_COLOR_MAP[kind]`.

## Suggested Build Order

Based on dependency analysis:

1. **Phase A: Type definitions + CanvasLiveEditor extension** (no UI, no new files beyond types)
   - Extend `canvas-internal.d.ts` with `createTextNode`, `CanvasNodeInternal`, `CreateTextNodeOptions`
   - Add `getCanvasObject()` to `CanvasLiveEditor`
   - Verify runtime API availability with manual dev-console test

2. **Phase B: CanvasNodeFactory** (new service, depends on Phase A)
   - Implement `createNode()` with runtime probing + default property templates
   - Implement `duplicateNode()` with property cloning + position offset
   - Wire in `main.ts`
   - Unit tests with mocked canvas API

3. **Phase C: EditorPanelView toolbar** (UI, depends on Phase B)
   - Add quick-create toolbar rendering
   - Add duplicate button (conditional on currentNodeId)
   - CSS for toolbar in `src/styles/editor-panel.css`
   - Integration test: create node -> auto-load in editor

This order ensures each phase is independently testable and the core service is validated before UI integration.

## Scalability Considerations

| Concern | Current (v1.6) | Future |
|---------|---------------|--------|
| Node creation rate | Single node at a time, user-initiated | Batch creation (templates) could use loop over createTextNode |
| API stability | Runtime probe on every call | Consider caching probe result per session with version check |
| Edge creation | Manual by user on canvas | Future: auto-connect new node to selected source node |

## Sources

- [obsidian-advanced-canvas Canvas.d.ts](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/@types/Canvas.d.ts) -- MEDIUM confidence: community type definitions for undocumented internal API
- [Obsidian-Canvas-Presentation createTextNode usage](https://github.com/Quorafind/Obsidian-Canvas-Presentation/blob/master/canvasPresentationIndex.ts) -- MEDIUM confidence: real plugin using createTextNode with both API variants
- [Official canvas.d.ts (data schema only)](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- HIGH confidence: official file format types
- [Obsidian Forum: Canvas API discussion](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- LOW confidence: community discussion, no official endorsement
- Existing codebase: `CanvasLiveEditor`, `EditorPanelView`, `canvas-internal.d.ts` -- HIGH confidence: proven patterns in production
