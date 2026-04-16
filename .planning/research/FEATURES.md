# Feature Research: v1.6 Canvas Workflow & Polish

**Domain:** Obsidian plugin -- programmatic canvas node creation, node duplication, sidebar-based canvas management, and polish items
**Researched:** 2026-04-16
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that v1.6 must ship to feel like a coherent release. These are polish and workflow improvements that address known friction.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dead code cleanup | Tech debt from 5 milestones; `.rp-legend*` CSS, 3 RED test stubs, stale imports accumulate. Known debt documented in PROJECT.md. | LOW | Grep-based audit of unused exports, dead CSS selectors, stale test stubs. No architectural risk. |
| Fix "ТипJSON" spacing bug | Visual defect in snippet create/edit modal -- label "Тип" renders concatenated with badge text "JSON" without spacing. | LOW | Likely a missing space or CSS gap between the label element and the type badge/toggle. Located in `snippet-editor-modal.ts` lines 145/206. Pure cosmetic fix. |
| Snippet editor "Create folder" button | SnippetManagerView header only has "+ Новый" (create snippet). No way to create folders from the header -- must use context menu on existing folder. Missing discoverability for new users. | LOW | Add a second button (folder icon + "Папка") next to the existing "+ Новый" button in the `radi-snippet-tree-header` strip. Reuses existing `FOLDER-01` folder-create logic already in the context menu handler. |
| Canvas node path sync on directory rename | When a snippet folder is renamed via SnippetManagerView (Phase 34 RENAME-03), canvas refs sync. But when a directory is renamed via Obsidian's native file explorer, the sync does not fire. This creates stale `radiprotocol_subfolderPath` references. | MEDIUM | Hook `vault.on('rename')` for directories under `snippetFolderPath`. Reuses existing `rewriteCanvasRefs()` from `canvas-ref-sync.ts`. The tricky part: computing the old-to-new mapping from Obsidian's rename event (`newPath` + `oldPath`) and converting to snippet-relative paths. |

### Differentiators (Competitive Advantage)

Features that accelerate canvas authoring workflow. No other Obsidian Canvas plugin provides a node-type-aware sidebar editor with quick-create buttons.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Quick node creation buttons in EditorPanelView | One-click creation of pre-typed RadiProtocol nodes from the sidebar. Currently the author must: (1) manually add a canvas node, (2) click it, (3) set node type in EditorPanel. Quick-create buttons collapse this to one click. Massively accelerates protocol authoring. | HIGH | Uses Canvas internal API `canvas.createTextNode()` -- undocumented but stable, used by enchanted-canvas, canvas-llm-extender, advanced-canvas. Must probe API availability at runtime (same pattern as existing `CanvasLiveEditor.getCanvasView()`). Needs position calculation (place near selected node or viewport center), ID generation (16-char hex), and `radiprotocol_*` property injection + color via `NODE_COLOR_MAP`. |
| Duplicate node with preserved settings | Clone a selected node's RadiProtocol properties (type, text, label, separator overrides, snippet config) into a new adjacent node. Saves massive time when building repetitive protocol structures (e.g., 10 similar question-answer chains). | MEDIUM-HIGH | Read selected node's data via `canvas.selection` + `node.getData()`, extract all `radiprotocol_*` fields, call `canvas.createTextNode()` with offset position, apply properties. Shares infrastructure with quick-create. Edge duplication is explicitly NOT in scope -- only node properties. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Edge creation from sidebar | "Let me wire up nodes without touching the canvas" | Edge routing is spatial -- users need to see source/target visually. Sidebar-driven edge creation would require a complex node picker UI and produce edges with arbitrary connection sides. Canvas native edge creation (drag from node edge) is already intuitive. | Keep edge creation canvas-native. Focus sidebar on node property management only. |
| Batch node creation (create N nodes at once) | "Create 10 answer nodes for a question" | Node positioning for N arbitrary nodes is a layout algorithm problem. Overlap detection, spacing, and user expectations vary wildly. Building a layout engine is a large scope expansion. | Single-node quick-create with smart positioning is sufficient. User clicks repeatedly for multiples. Each new node avoids overlap with existing nodes. |
| Full canvas authoring from sidebar | "Build protocols entirely from the sidebar" | Defeats Obsidian Canvas's core UX. Users chose Canvas for visual editing. A pure form-based protocol builder would be a different product entirely. | Sidebar accelerates canvas authoring, does not replace it. |
| Live canvas node preview in sidebar | "Show me what the node looks like on canvas" | Requires rendering canvas node HTML outside the canvas context. Obsidian's canvas renderer is tightly coupled to the canvas view internals. Would be fragile and version-dependent. | Node type dropdown + color preview badge is sufficient visual feedback. |
| Auto-layout / auto-arrange nodes | "Organize my canvas automatically" | Destroys user's intentional spatial layout. Protocol canvases encode semantic meaning in spatial arrangement (left-to-right flow, grouped sections). Auto-layout erases this authorial intent. | Smart positioning for newly created/duplicated nodes only (near selected node, non-overlapping). Never rearrange existing nodes. |
| Node creation via Strategy A (vault.modify) | "Support creating nodes when canvas is closed" | The user cannot see the result. Canvas must be open for creation to make spatial sense. vault.modify would also conflict with the open canvas view's in-memory state if canvas IS open. | Quick-create buttons are disabled/hidden when no canvas is open. Show informational message instead. |

## Feature Dependencies

```
[Dead code cleanup]
    (no dependencies -- can run first or in parallel)

[Fix "ТипJSON" spacing]
    (no dependencies -- isolated CSS/label fix)

[Create folder button in SnippetManagerView]
    (no dependencies -- reuses existing folder-create logic from FOLDER-01)

[Canvas node path sync on directory rename]
    └──requires──> [rewriteCanvasRefs utility] (already exists from Phase 32/34)

[Quick node creation buttons]
    └──requires──> [Canvas internal API types extension] (extend canvas-internal.d.ts with createTextNode)
    └──requires──> [Node position calculation utility] (new: find non-overlapping position near reference point)
    └──requires──> [CanvasNodeFactory or CanvasLiveEditor extension] (runtime API probe + create flow)
    └──enhances──> [EditorPanelView] (buttons added to idle state and/or form header)

[Duplicate node]
    └──requires──> [Quick node creation infrastructure] (shares createTextNode API + positioning)
    └──requires──> [Node property extraction] (read all radiprotocol_* from selected node via getData())
```

### Dependency Notes

- **Duplicate node requires Quick node creation infrastructure:** Both features need the same Canvas internal API integration (`createTextNode`, position calculation, ID generation). Build the creation infrastructure first; duplication is then a thin wrapper that copies `radiprotocol_*` properties from the source node.
- **Canvas node path sync requires rewriteCanvasRefs:** Already exists and is battle-tested from Phase 34 (handles exact match, prefix match with `/` boundary, WriteMutex per canvas file). The new work is the vault event listener hookup and path mapping computation.
- **Quick node creation enhances EditorPanelView:** Buttons appear in the sidebar when a canvas is open. The idle state ("No node selected") is a natural place for "Create new node" buttons. When a node IS selected, a "Duplicate" button can appear in the form header.
- **All cleanup/polish items are independent:** Dead code cleanup, ТипJSON fix, and folder button can ship in any order or in parallel.

## v1.6 Phase Recommendation

### Phase Group A: Cleanup & Polish (can be a single phase, parallelizable work items)

- Dead code audit and cleanup
- Fix "ТипJSON" spacing
- Create folder button in snippet editor header

### Phase Group B: Canvas Ref Sync

- Vault rename listener for directory rename sync -- extends existing `rewriteCanvasRefs` with native file explorer coverage

### Phase Group C: Canvas Node Creation (sequential, must follow A/B)

- Canvas internal API extension (createTextNode types, node factory, position calculation utility)
- Quick-create buttons in EditorPanelView
- Duplicate node button

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dead code cleanup | LOW (invisible to user, improves maintainability) | LOW | P2 |
| Fix "ТипJSON" spacing | LOW (cosmetic) | LOW | P1 |
| Create folder button | MEDIUM (discoverability improvement) | LOW | P1 |
| Canvas node path sync on dir rename | MEDIUM (data integrity, prevents broken refs) | MEDIUM | P1 |
| Quick node creation buttons | HIGH (headline workflow acceleration) | HIGH | P1 |
| Duplicate node | HIGH (headline workflow acceleration) | MEDIUM-HIGH | P1 |

**Priority key:**
- P1: Must have for v1.6
- P2: Should have, do early for hygiene

## Technical Context: Canvas Internal API for Node Creation

**Confidence: MEDIUM** -- based on reverse-engineering from 3 community plugins (enchanted-canvas, canvas-llm-extender, advanced-canvas) plus existing `CanvasLiveEditor` runtime probing patterns already proven in the codebase.

### API Shape (verified from enchanted-canvas `shared/types.ts` and canvas-llm-extender `obsidian-canvas-utils.ts`)

```typescript
// canvas.createTextNode -- creates a new text node, returns the live CanvasNode object
canvas.createTextNode(args: {
  pos: { x: number; y: number };
  text?: string;
  size?: { width: number; height: number };
  focus?: boolean;
  save?: boolean;        // canvas-llm-extender passes this
}) => CanvasNode;

// canvas.nodes -- Map<string, CanvasNode> of all live nodes
canvas.nodes: Map<string, CanvasNode>;

// canvas.removeNode(node) -- removes a node
canvas.removeNode(node: CanvasNode): void;

// canvas.requestSave() -- triggers debounced file write (already in our canvas-internal.d.ts)
canvas.requestSave(): void;

// CanvasNode runtime object (distinct from CanvasNodeData in file JSON)
interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  nodeEl: HTMLDivElement;
  canvas: Canvas;
  getData(): AllCanvasNodeData;        // returns a COPY of the node's serialized data
  setColor(color: string): void;       // sets node color visually + in data
  moveTo(pos: { x: number; y: number }): void;
  resize(size: { width: number; height: number }): void;
  setIsEditing(isEditing: boolean): void;
  attach(): void;
  render(): void;
}
```

### ID Generation Pattern

All observed plugins use the same 16-char random hex pattern, which matches Obsidian's native node ID format:

```typescript
function generateNodeId(): string {
  const t = [];
  for (let n = 0; n < 16; n++) {
    t.push((16 * Math.random() | 0).toString(16));
  }
  return t.join('');
}
```

IDs only need file-level uniqueness (not globally unique). Confirmed by Obsidian Forum discussion.

### Node Position Strategy

**For quick-create:** Place below the currently selected node with a 30px vertical gap, matching enchanted-canvas "add-next-node" pattern. If no node is selected, place at the canvas viewport center (accessible via `canvas.pointer` or viewport bounds). Run overlap detection against all `canvas.nodes.values()`.

**For duplicate:** Place to the right of the source node with a 30px horizontal gap, matching the common "paste with offset" pattern. Copy the source node's width and height.

**Overlap detection:** Simple AABB (axis-aligned bounding box) check, as used by canvas-llm-extender. If the preferred position overlaps, try alternative positions (right, left, above) before falling back to the preferred position anyway.

### Integration with Existing Architecture

The project already has:
- `CanvasLiveEditor` with `getCanvasView()` that probes for the internal API at runtime
- `CanvasViewInternal` and `CanvasInternal` type declarations in `canvas-internal.d.ts`
- `saveLive()` with Pattern B (getData/setData/requestSave) and rollback on failure
- `NODE_COLOR_MAP` for type-to-color mapping
- `EditorPanelView.attachCanvasListener()` that watches for canvas node selection

**Recommended approach:** Extend `CanvasLiveEditor` (or create a sibling `CanvasNodeFactory` class) that exposes:
1. `createNode(type: RPNodeKind, referencePos?: {x,y}): string | null` -- creates node, returns new node ID or null if API unavailable
2. `duplicateNode(sourceNodeId: string): string | null` -- clones properties, returns new node ID

These methods:
1. Probe for canvas view (same `getCanvasView()` pattern)
2. Call `canvas.createTextNode()` for the new node
3. Apply `radiprotocol_*` properties via getData/setData flow
4. Inject color via `NODE_COLOR_MAP`
5. Call `canvas.requestSave()`
6. Return the new node ID so `EditorPanelView` can auto-load it in the form

### Write-Back Path

Node creation MUST go through the live Canvas API (Pattern B) -- Strategy A (vault.modify with canvas closed) is NOT viable because:
1. The user needs to see the node appear on the canvas immediately
2. The canvas must be open for spatial creation to make sense
3. vault.modify would conflict with the open canvas view's in-memory state

Quick-create buttons should be **disabled or hidden** when no canvas is open. The EditorPanelView idle state should show an informational message like "Open a canvas to create nodes."

### Workspace Events for Canvas Awareness

From enchanted-canvas `WorkspaceWithCanvas` type, Obsidian fires undocumented workspace events:
- `canvas:node-menu` -- when node context menu opens (already used by RadiProtocol)
- `canvas:creation-menu` -- when the canvas creation menu opens (could hook into this for custom node types)
- `canvas:node:initialize` -- when a new node is created (could use to auto-set properties)
- `canvas:selection-menu` -- when selection context menu opens

These events could be used to provide alternative integration points (e.g., hook into the native canvas creation menu to add "Create RadiProtocol node" options), but the sidebar button approach is simpler and more discoverable.

## Sources

- [enchanted-canvas source code](https://github.com/borolgs/enchanted-canvas) -- Canvas internal API type definitions (`Canvas`, `CanvasNode`, `CanvasEdge`, `WorkspaceWithCanvas` events), `createTextNode` usage with position/size/color -- **HIGH confidence** (read source directly)
- [obsidian-canvas-llm-extender source code](https://github.com/Phasip/obsidian-canvas-llm-extender) -- `createTextNode` with save/focus flags, `generate_id()` 16-char hex, `findEmptySpace()` position calculation, `overlaps()` AABB detection, `createEdge()` via constructor hack -- **HIGH confidence** (read source directly)
- [obsidian-advanced-canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- Largest canvas plugin, validates that canvas internal API is stable across Obsidian versions -- **MEDIUM confidence** (confirmed usage, did not read source)
- [Obsidian Forum: Creating a canvas programmatically](https://forum.obsidian.md/t/creating-a-canvas-programmatically/101850) -- Confirms node IDs only need file-level uniqueness, any unique string works -- **MEDIUM confidence**
- [Official canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- Official type definitions for canvas DATA format (CanvasData, CanvasNodeData, CanvasEdgeData) -- not runtime API -- **HIGH confidence**
- [DeepWiki: Canvas System](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system) -- Confirms canvas API covers data schema only, runtime API is undocumented -- **MEDIUM confidence**
- Existing codebase: `canvas-live-editor.ts`, `canvas-internal.d.ts`, `editor-panel-view.ts`, `snippet-manager-view.ts`, `canvas-ref-sync.ts`, `snippet-editor-modal.ts` -- **PRIMARY source** for integration decisions and dependency analysis

---
*Feature research for: RadiProtocol v1.6 Canvas Workflow & Polish*
*Researched: 2026-04-16*
