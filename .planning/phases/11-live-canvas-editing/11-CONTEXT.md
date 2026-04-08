# Phase 11: Live Canvas Editing — Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade `EditorPanelView.saveNodeEdits()` to write node property changes directly into the live Canvas view state using the internal Canvas View API (`canvas.data` + `canvas.requestSave()`), eliminating the Strategy A requirement that the canvas be closed before editing.

Scope:
- Add a `CanvasLiveEditor` module (`src/canvas/canvas-live-editor.ts`) that probes for the internal Canvas API and performs live node updates
- Add a TypeScript ambient declaration file (`src/types/canvas-internal.d.ts`) for the undocumented internal API shape
- Modify `EditorPanelView.saveNodeEdits()` to use `CanvasLiveEditor` when the canvas is open; fall back to the existing `vault.modify()` path (Strategy A) when the canvas is closed
- Remove the Strategy A guard (`isCanvasOpen()` → Notice "Close the canvas…") — it is replaced by the live path

Out of scope:
- New node types or new form fields in EditorPanelView
- Any UI indicator of live vs. offline edit mode
- Changes to ProtocolRunner, CanvasParser, GraphValidator, SnippetService, SessionService

</domain>

<decisions>
## Implementation Decisions

### D-01: API Detection — Silent Fallback
Probe for the internal Canvas API by checking that `canvas.data` (array) and `canvas.requestSave` (function) both exist on the active canvas view before attempting a live save. If either is absent, silently fall back to Strategy A (require canvas closed, existing `vault.modify()` path). **No Notice is shown when falling back** — the editor form is unchanged either way.

Detection pseudocode:
```typescript
const leaf = app.workspace.getLeavesOfType('canvas')
  .find(l => (l.view as { file?: { path: string } }).file?.path === filePath);
const canvas = leaf?.view as CanvasViewInternal | undefined;
const hasLiveApi = Array.isArray(canvas?.data) && typeof canvas?.requestSave === 'function';
```

### D-02: Live Save Path
When the internal API is confirmed available:
1. Find the target node in `canvas.data` by `id`
2. Merge edits into the node object in-place
3. Call `canvas.requestSave()` — debounced 500ms (per STATE.md standing reminder)
4. No `vault.modify()` call — the canvas view owns the file write

### D-03: Failure Handling
If `canvas.requestSave()` throws an exception:
- Show a Notice: `"Save failed — close the canvas and try again."`
- The node object is **not mutated** (or mutation is reverted before the error Notice) — the canvas state remains as before
- No automatic retry, no fallback to `vault.modify()` over the open canvas

### D-04: Strategy A Removal
Remove the `isCanvasOpen()` block in `saveNodeEdits()` that currently shows "Close the canvas before editing node properties." and returns early. Replace with the `CanvasLiveEditor` call that handles both the open-canvas (live) and closed-canvas (Strategy A) paths.

### D-05: Editor Panel — No Visual Change
`EditorPanelView` form looks identical whether the canvas is open or closed. No indicator, no badge, no label change. Live editing is transparent — it simply works.

### D-06: Debounce on requestSave
`canvas.requestSave()` is debounced 500ms in `CanvasLiveEditor` to avoid triggering Obsidian's dirty cycle on rapid consecutive saves (noted in STATE.md pitfall #9).

### Claude's Discretion
- Exact TypeScript interface shape for `CanvasViewInternal` and `CanvasNodeData`
- Whether to use a class or a standalone function for `CanvasLiveEditor`
- Exact debounce implementation (lodash vs inline setTimeout)
- Notice wording for save failure (English)
- Whether `canvas.requestSave()` must be awaited or is fire-and-forget

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Change Files
- `src/views/editor-panel-view.ts` — `saveNodeEdits()` method and `isCanvasOpen()` helper: replace Strategy A guard with `CanvasLiveEditor` call
- `src/main.ts` — plugin entry point; check if `CanvasLiveEditor` needs to be wired through the plugin instance

### New Files to Create
- `src/canvas/canvas-live-editor.ts` — `CanvasLiveEditor`: API detection + live node update + requestSave with 500ms debounce
- `src/types/canvas-internal.d.ts` — ambient declarations for `CanvasViewInternal`, `CanvasNodeData`

### Patterns to Follow
- `WriteMutex` (async-mutex) for the Strategy A fallback path — see `src/sessions/session-service.ts`
- `getLeavesOfType('canvas')` — already used in `isCanvasOpen()` in `editor-panel-view.ts`
- `vault.read()` + `vault.modify()` — already used in `saveNodeEdits()` for the Strategy A path (keep as-is for fallback)

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Strategy A Guard (to be replaced)
In `src/views/editor-panel-view.ts`, `saveNodeEdits()`:
```typescript
// EDIT-04: Strategy A — require canvas closed before writing
if (this.isCanvasOpen(filePath)) {
  new Notice('Close the canvas before editing node properties.');
  return;
}
```
`isCanvasOpen()` uses `getLeavesOfType('canvas')` — same probe used in `CanvasLiveEditor` detection.

### Integration Points
- `EditorPanelView.saveNodeEdits()` (~line 59) — main change site
- `EditorPanelView.isCanvasOpen()` — repurposed or replaced by `CanvasLiveEditor.isAvailable()`
- No changes to `renderNodeForm()`, `loadNode()`, or form rendering code

### No New npm Dependencies
`async-mutex` already installed (used in snippet/session services). No additional packages needed.

</code_context>
