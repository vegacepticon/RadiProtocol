# Architecture: v1.3 Node Editor Overhaul & Snippet Node

**Project:** RadiProtocolObsidian
**Researched:** 2026-04-10
**Confidence:** HIGH — all findings derived directly from source code inspection

---

## Current Architecture Map

```
main.ts (RadiProtocolPlugin)
  ├── CanvasParser          (pure, no Obsidian imports)
  ├── CanvasLiveEditor      (Pattern B: getData/setData/requestSave)
  ├── SnippetService        (CRUD for .radiprotocol/snippets/)
  ├── SessionService        (CRUD for .radiprotocol/sessions/)
  ├── EditorPanelView       (ItemView, right sidebar)
  │     ├── pendingEdits{}  (dirty dict, Save button)
  │     └── attachCanvasListener()  (click -> handleNodeClick)
  ├── RunnerView            (ItemView, right sidebar or tab)
  │     ├── ProtocolRunner  (pure state machine)
  │     └── CanvasSelectorWidget
  └── SnippetManagerView    (ItemView, right sidebar)

graph/
  ├── graph-model.ts        (RPNode discriminated union, 7 kinds)
  ├── canvas-parser.ts      (pure: JSON -> ProtocolGraph)
  └── graph-validator.ts    (pure: validates connections)

runner/
  ├── protocol-runner.ts    (state machine: idle/at-node/awaiting-snippet-fill/complete/error)
  ├── runner-state.ts       (RunnerState union types)
  └── text-accumulator.ts   (append/snapshot/restore)
```

---

## Feature Integration Analysis

### Feature 1: Node Editor Auto-Save

**Current mechanism:**
- `EditorPanelView.pendingEdits: Record<string, unknown>` accumulates field onChange deltas
- Single "Save changes" button calls `saveNodeEdits(currentFilePath, currentNodeId, {...pendingEdits})`
- `NodeSwitchGuardModal` fires on node switch when `pendingEdits` is non-empty

**Required changes — EditorPanelView only:**
- Replace `pendingEdits` + Save button with: each field onChange debounces then calls `saveNodeEdits()` with the current full field state
- Add save-in-progress flag: `private isSaving = false`; disable fields during save; show transient indicator
- Remove `NodeSwitchGuardModal` — no dirty state exists to guard
- The `pendingEdits` dict is removed. Each form field stores its own current value via closure

**Save-in-progress pattern:**
```
onChange -> clearTimeout(debounceTimer) -> debounceTimer = setTimeout(async () => {
  isSaving = true
  await saveNodeEdits(filePath, nodeId, fullFieldValues)
  isSaving = false
}, 600)
```

**Interaction with CanvasLiveEditor:** No change. `saveNodeEdits()` already calls `canvasLiveEditor.saveLive()` with Strategy A fallback. The 500ms `debouncedRequestSave` inside `CanvasLiveEditor` rate-limits the actual disk write independently.

**Files modified:** `editor-panel-view.ts` only. `NodeSwitchGuardModal` deleted if no other callers.

---

### Feature 2: Canvas Node Color Coding by NodeKind

**Current blocker:** `PROTECTED_FIELDS` in `canvas-live-editor.ts` line 14 includes `'color'`, causing `saveLive()` to silently drop color edits. The Strategy A fallback in `editor-panel-view.ts` line 181 has its own local `PROTECTED_FIELDS` const also including `'color'`.

**Rollback safety analysis:** The rollback in `canvas-live-editor.ts` captures `originalData = view.canvas.getData()` before any mutation and calls `view.canvas.setData(originalData)` on failure. This is atomic at the whole-canvas-data level. Removing `'color'` from `PROTECTED_FIELDS` does not affect rollback — if `setData(updatedData)` throws, `setData(originalData)` restores all fields including color. Zero rollback risk.

**Two changes needed:**
1. `canvas-live-editor.ts` line 14: remove `'color'` from the `PROTECTED_FIELDS` Set
2. `editor-panel-view.ts` line 181: remove `'color'` from the local `PROTECTED_FIELDS` Set

**Color map (new constant):**
```typescript
// src/canvas/node-color-map.ts  (new file, pure, no Obsidian imports)
export const NODE_KIND_COLOR: Partial<Record<RPNodeKind, string>> = {
  'start':       '5',   // purple
  'question':    '3',   // red
  'answer':      '4',   // green
  'text-block':  '1',   // red-orange
  'loop-start':  '2',   // orange
  'loop-end':    '2',   // orange (same loop family)
  'snippet':     '6',   // pink
};
```

Canvas color values 1-6 are Obsidian's native node palette values. Hex strings also work but 1-6 are stable documented values in the JSON Canvas spec.

**When color is applied:** In `EditorPanelView`, when the node-type dropdown onChange fires with a new RPNodeKind, include `color: NODE_KIND_COLOR[newKind]` in the save edits alongside `radiprotocol_nodeType`. On unmark (empty kind), skip color — leave user-set color as-is.

**Files new:** `src/canvas/node-color-map.ts`
**Files modified:** `canvas-live-editor.ts`, `editor-panel-view.ts`

---

### Feature 3: Auto-Switch to Node Editor Tab on Canvas Node Selection

**Detection method — confirmed from existing EditorPanelView.attachCanvasListener():**

The v1.2 implementation already uses the correct pattern:
1. `workspace.getLeavesOfType('canvas')` to find canvas leaves
2. Cast leaf as `{ containerEl: HTMLElement }` (undocumented but stable internal)
3. Register `'click'` DOM event on `containerEl`
4. Inside handler, read `canvasView.canvas?.selection` (a Set)

The `canvas-internal.d.ts` comment notes: selection must be read after `setTimeout(0)` inside a `pointerdown` handler. Using `'click'` (which fires after `pointerup`) means selection is already updated when the handler runs — confirmed working in v1.2 UAT.

**The problem:** When RunnerView is the active sidebar tab and EditorPanelView is behind it, `handleNodeClick()` updates the form silently in the background — the user never sees it.

**Solution — `workspace.revealLeaf()`:**
```typescript
// In handleNodeClick(), before loadNode():
const editorLeaves = this.plugin.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
if (editorLeaves.length > 0) {
  this.plugin.app.workspace.revealLeaf(editorLeaves[0]);
} else {
  // EditorPanel not open — open it first
  await this.plugin.activateEditorPanelView();
}
this.loadNode(filePath, nodeId);
```

`workspace.revealLeaf()` is documented Obsidian API. It brings the leaf's tab to the front in its container — the exact "switch tabs" behavior needed. Already used in `main.ts` `activateEditorPanelView()`.

**Files modified:** `editor-panel-view.ts` (handleNodeClick only), no new files

---

### Feature 4: Remove free-text-input Node Type

**All call sites:**

| File | Change |
|------|--------|
| `graph-model.ts` | Remove `FreeTextInputNode` interface; remove `'free-text-input'` from `RPNodeKind` and `RPNode` unions |
| `canvas-parser.ts` | Remove `'free-text-input'` from `validKinds[]`; change the unknown-kind error path to silently skip `'free-text-input'` specifically (deprecated-skip, not error) |
| `protocol-runner.ts` | Remove `case 'free-text-input'` from `advanceThrough()`; remove `enterFreeText()` method; remove from `resolveSeparator()` type union |
| `runner-view.ts` | Remove `case 'free-text-input'` branch from at-node render switch |
| `editor-panel-view.ts` | Remove `'free-text-input'` from node-type dropdown; remove `case 'free-text-input'` from `buildKindForm()` |
| `graph-validator.ts` | Audit and remove any free-text-input-specific validation rules |

**Parser behavior:** Nodes with `radiprotocol_nodeType: 'free-text-input'` must silently skip (return null), not produce a parse error. Add `'free-text-input'` to a `DEPRECATED_KINDS` set that maps to null return — backwards-compatible, no error surfaced to users with old canvases.

**Session compatibility:** Existing sessions referencing a free-text-input node will fail `validateSessionNodeIds()` — node no longer in graph. Correct path: session cleared, user starts fresh. No special handling needed.

**Files modified:** `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `runner-view.ts`, `editor-panel-view.ts`, `graph-validator.ts`

---

### Feature 5: text-block — Remove Snippet Insertion Logic

**Current behavior:** In `advanceThrough()`, a text-block node with `node.snippetId !== undefined` transitions to `awaiting-snippet-fill` state and halts.

**Changes:**
- `graph-model.ts`: Remove `snippetId?: string` from `TextBlockNode`
- `canvas-parser.ts`: Remove `snippetId` field parsing from `case 'text-block'`
- `protocol-runner.ts`: Remove the `if (node.snippetId !== undefined)` branch in `advanceThrough()` case `'text-block'`
- `editor-panel-view.ts`: Remove "Snippet ID (optional)" field from `case 'text-block'` in `buildKindForm()`

The entire `awaiting-snippet-fill` state, `completeSnippet()`, `snippetId`, and `snippetNodeId` runner fields become dead code after this — see "awaiting-snippet-fill retirement" section below.

**Files modified:** `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `editor-panel-view.ts`

---

### Feature 6: New Snippet Node Type

**Graph model additions:**
```typescript
// graph-model.ts
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  buttonLabel?: string;         // label on the runner button; falls back to file name
  snippetFolder?: string;       // per-node folder override; vault-relative
  radiprotocol_separator?: 'newline' | 'space';
}

// RPNodeKind: add 'snippet'
// RPNode: add SnippetNode
```

**Runner: new method `chooseSnippet()`**

Snippet nodes halt in `at-node` state (like question nodes). RunnerView handles the file picker and calls `chooseSnippet()` with the rendered text:

```typescript
// protocol-runner.ts
chooseSnippet(renderedText: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;
  const node = this.graph.nodes.get(this.currentNodeId);
  if (node === undefined || node.kind !== 'snippet') return;

  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  this.accumulator.appendWithSeparator(renderedText, this.resolveSeparator(node));
  const neighbors = this.graph.adjacency.get(this.currentNodeId);
  const next = neighbors !== undefined ? neighbors[0] : undefined;
  if (next === undefined) { this.transitionToComplete(); return; }
  this.advanceThrough(next);
}
```

`advanceThrough()` case `'snippet'`:
```typescript
case 'snippet': {
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;  // halt — RunnerView handles file picker
}
```

**Where snippet file picker state lives — RunnerView, not a new service:**

RunnerView already has `plugin.snippetService`, `plugin.app.vault`, and modal-opening capability. No new service class is needed.

Execution flow:
```
RunnerView.render() [at-node, node.kind === 'snippet']
  renders "Choose snippet" button (node.buttonLabel ?? 'Choose snippet')
  click -> SnippetPickerModal(app, resolvedFolder)
  user selects TFile
  if file.extension === 'json':
    SnippetService.load(file.basename) -> RPSnippet
    if snippet has placeholders: SnippetFillInModal -> renderedText
    else: renderedText = snippet content (no placeholders)
  if file.extension === 'md':
    vault.read(file) -> renderedText (no placeholder processing)
  runner.chooseSnippet(renderedText)
  autoSaveSession()
  render()
```

**SnippetPickerModal (new component):**
- `src/views/snippet-picker-modal.ts`
- Extends `FuzzySuggestModal<TFile>` (documented Obsidian API — built-in fuzzy search, keyboard nav)
- Constructor: `(app: App, folderPath: string)`
- `getItems()`: `vault.getFiles()` filtered by path prefix and extension in `['.json', '.md']`
- `getItemText(file)`: `file.basename`
- `onChooseItem(file)`: resolves modal Promise with chosen TFile
- Same Promise-wrapping pattern as `ResumeSessionModal`

**Snippet folder config:**
- Global setting: add `snippetNodeFolderPath: string` to `RadiProtocolSettings` (default: same as `snippetFolderPath`)
- Per-node override: `radiprotocol_snippetFolder` on canvas node -> `SnippetNode.snippetFolder`
- Resolution in RunnerView: `node.snippetFolder ?? plugin.settings.snippetNodeFolderPath`

**`resolveSeparator()` update:** Add `SnippetNode` to the parameter type union in `protocol-runner.ts`.

**Files new:** `src/views/snippet-picker-modal.ts`
**Files modified:** `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `runner-view.ts`, `editor-panel-view.ts`, `settings.ts`

---

### Feature 7: Interactive Placeholder Editor in SnippetManagerView

**Pattern:** Pure DOM `contenteditable` div with chip injection. No external library.

**New component:** `src/views/snippet-placeholder-editor.ts`
- Wraps a `<div contenteditable="true">`
- On input: parse content for `[[...]]` tokens, replace with non-editable `<span class="rp-chip">` elements
- `getValue(): string` serializes DOM back to plain `[[...]]` template string
- `setValue(template: string)` parses and renders chips
- Drag: `draggable="true"` on chip spans + `dragover`/`drop` handlers on container

**Integration:** Replace textarea in `SnippetManagerView` with `SnippetPlaceholderEditor`.

**Risk flag:** contenteditable chip editors are brittle with cursor position and IME. Safer scope for v1.3: render chips in a read-only preview div next to a plain textarea, with real-time sync. Full inline editing within contenteditable is a post-v1.3 refinement if needed.

**Files new:** `src/views/snippet-placeholder-editor.ts`
**Files modified:** `src/views/snippet-manager-view.ts`

---

## New vs Modified Components Summary

### New Files

| File | Role |
|------|------|
| `src/canvas/node-color-map.ts` | Pure constant: RPNodeKind -> canvas color string. No Obsidian imports. Vitest-testable. |
| `src/views/snippet-picker-modal.ts` | FuzzySuggestModal for picking .md or .json files from a vault folder. Used by RunnerView at snippet nodes. |
| `src/views/snippet-placeholder-editor.ts` | Chip-based editor for [[placeholder]] template syntax. Used by SnippetManagerView. |

### Modified Files

| File | Nature of Change |
|------|-----------------|
| `src/graph/graph-model.ts` | Add SnippetNode; add 'snippet' to unions; remove FreeTextInputNode; remove 'free-text-input' from unions; remove snippetId from TextBlockNode |
| `src/graph/canvas-parser.ts` | Add snippet parse case; deprecated-skip free-text-input; remove snippetId from text-block case |
| `src/graph/graph-validator.ts` | Remove free-text-input rules; add snippet node validation |
| `src/runner/protocol-runner.ts` | Add chooseSnippet(); add snippet halt case; remove free-text-input/enterFreeText; remove awaiting-snippet-fill state; update resolveSeparator type |
| `src/runner/runner-state.ts` | Remove awaiting-snippet-fill from RunnerState union |
| `src/canvas/canvas-live-editor.ts` | Remove 'color' from PROTECTED_FIELDS |
| `src/views/editor-panel-view.ts` | Auto-save debounce; remove pendingEdits/Save button; remove NodeSwitchGuardModal usage; add snippet to dropdown/buildKindForm; apply color on type change; revealLeaf() on node click |
| `src/views/runner-view.ts` | Add snippet case to at-node render; add handleSnippetNodeClick(); remove handleSnippetFill(); call chooseSnippet() |
| `src/views/snippet-manager-view.ts` | Replace textarea with SnippetPlaceholderEditor |
| `src/settings.ts` | Add snippetNodeFolderPath; add Settings UI entry |

### Deleted Files

| File | Reason |
|------|--------|
| `src/views/node-switch-guard-modal.ts` | Dirty guard removed with auto-save; confirm no other callers before deleting |

---

## awaiting-snippet-fill State Retirement

After Feature 5 removes the text-block snippet branch (the only trigger), `awaiting-snippet-fill` is dead. Remove:
- `protocol-runner.ts`: remove `runnerStatus = 'awaiting-snippet-fill'` assignments; remove `completeSnippet()`; remove `snippetId` and `snippetNodeId` fields; remove from `getSerializableState()` and `restoreFrom()`
- `runner-state.ts`: remove `awaiting-snippet-fill` from RunnerState union
- `runner-view.ts`: remove `case 'awaiting-snippet-fill'` and `handleSnippetFill()`

**Session compatibility:** Persisted sessions with `runnerStatus: 'awaiting-snippet-fill'` become unresumable. In `RunnerView.openCanvas()`, treat unknown `runnerStatus` values in loaded sessions as stale — clear and start fresh. Same code path as missing node IDs.

---

## Canvas Node Selection Detection — Confirmed Method

From `canvas-internal.d.ts` and `editor-panel-view.ts` `attachCanvasListener()`:

```typescript
// containerEl — undocumented but stable WorkspaceLeaf internal
const canvasLeafInternal = canvasLeaf as unknown as { containerEl: HTMLElement };

// 'click' fires after 'pointerup' — canvas.selection is already updated
this.registerDomEvent(containerEl, 'click', () => {
  const selection = canvasView.canvas?.selection;  // Set<{id, ...}>
  if (!selection || selection.size !== 1) return;
  const node = Array.from(selection)[0];
  // node.id valid here
});
```

De-duplication guard already present: `watchedCanvasContainer` comparison prevents listener accumulation on repeated `active-leaf-change` events.

---

## Programmatic Sidebar Tab Switch — Confirmed Method

`workspace.revealLeaf(leaf)` is documented Obsidian API used in `main.ts` already. When the target leaf is in a sidebar tab group, it becomes the active (visible) tab.

```typescript
// In EditorPanelView.handleNodeClick():
const editorLeaves = this.plugin.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
if (editorLeaves.length > 0) {
  this.plugin.app.workspace.revealLeaf(editorLeaves[0]);
} else {
  await this.plugin.activateEditorPanelView();
}
```

---

## Removing color from PROTECTED_FIELDS — Safety Confirmation

The rollback in `canvas-live-editor.ts`:
```
originalData = view.canvas.getData()   // full snapshot BEFORE edit
updatedData  = view.canvas.getData()   // copy to mutate
// ... apply edits including color ...
view.canvas.setData(updatedData)
// if throws:
view.canvas.setData(originalData)      // restores ALL fields including color
```

Rollback is atomic at the whole-node level. PROTECTED_FIELDS only gates which fields are written forward — it has no role in rollback. Removing 'color' is safe.

The Strategy A path (vault.modify, canvas closed) has no rollback mechanism — it never writes if it errors. Also safe.

Both PROTECTED_FIELDS locations must be updated together or color writes will silently fail on whichever path uses the stale copy.

---

## Suggested Build Order

Dependencies: graph model -> parser -> runner -> views. Color map is a leaf with no dependencies.

### Phase 1: Housekeeping removals (pure subtraction)
Remove free-text-input and text-block snippet logic. Shrinks surface area before adding snippet node. Tests for removed functionality deleted cleanly.

Touches: `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `runner-view.ts`, `editor-panel-view.ts`, `graph-validator.ts`

Also retire `awaiting-snippet-fill`: `runner-state.ts`, remove from `protocol-runner.ts` and `runner-view.ts`

Testable: Parser silently skips free-text-input nodes. Text-block never triggers snippet flow. Runner has no enterFreeText or completeSnippet.

### Phase 2: Color infrastructure
Pure constant, zero UI risk.

New: `src/canvas/node-color-map.ts`
Modified: `canvas-live-editor.ts` (remove 'color' from PROTECTED_FIELDS), `editor-panel-view.ts` (remove 'color' from local PROTECTED_FIELDS)

Testable: saveLive() with color edit writes the value through.

### Phase 3: Snippet node type (graph + runner layer)
Extend model before wiring UI.

Modified: `graph-model.ts` (SnippetNode, union updates), `canvas-parser.ts` (snippet case), `graph-validator.ts` (snippet rules), `protocol-runner.ts` (chooseSnippet, snippet halt case, resolveSeparator update)

Testable: Parser produces SnippetNode from canvas JSON. Runner halts at snippet node in at-node state. chooseSnippet() appends text and advances correctly. Undo works across snippet choices.

### Phase 4: Node Editor auto-save + color coding on type change
These share the EditorPanelView onChange pipeline.

Modified: `editor-panel-view.ts` (remove pendingEdits/Save button, add debounced auto-save per field, apply color on type change, add snippet form fields)
New: snippet form case in buildKindForm for buttonLabel, snippetFolder, separator

Testable: Form auto-saves without Save button. Node color updates when type changes via dropdown. Snippet form fields appear and save.

### Phase 5: Settings — snippet node folder
Modified: `settings.ts` (add snippetNodeFolderPath, add Settings UI)

Testable: Setting persists. Default value is same as snippetFolderPath.

### Phase 6: Snippet node Runner UI
New: `src/views/snippet-picker-modal.ts`
Modified: `runner-view.ts` (snippet case in at-node branch, handleSnippetNodeClick, chooseSnippet call)

Testable: Runner shows "Choose snippet" button at snippet nodes. SnippetPickerModal opens with correct folder. JSON snippet -> SnippetFillInModal if placeholders. MD file -> raw content. Text appended. Undo reverts snippet choice.

### Phase 7: Auto-switch to Node Editor tab
Modified: `editor-panel-view.ts` (handleNodeClick: add revealLeaf call)

Testable: Clicking canvas node while Runner tab is active brings Editor tab to front. Clicking when Editor panel not open creates it.

### Phase 8: Interactive placeholder editor
New: `src/views/snippet-placeholder-editor.ts`
Modified: `src/views/snippet-manager-view.ts`

Testable: [[token]] renders as chip. getValue() returns correct template string. Chips draggable.

### Phase 9: UX polish
- Remove hover color on runner textarea (CSS only)
- Larger answer textarea in Node Editor (CSS + textarea rows attribute)

---

## Key Integration Points for Roadmap

1. **PROTECTED_FIELDS has two copies** — `canvas-live-editor.ts` and `editor-panel-view.ts`. Both must be updated in the same phase or color writes silently fail on the Strategy A path.

2. **awaiting-snippet-fill retirement is a breaking session format change** — requires handling in session load path for stale sessions with this status value. Handle in Phase 1 alongside removal.

3. **free-text-input removal changes parser error behavior** — old canvases with these nodes must silent-skip, not error. Add to deprecated-skip list in parser.

4. **SnippetPickerModal resolves to TFile, not snippetId** — RunnerView must branch on file extension (`.json` vs `.md`) after picker resolves. Two different content pipelines.

5. **Auto-save debounce (600ms) and CanvasLiveEditor debounce (500ms) are independent** — EditorPanelView debounces calling saveNodeEdits; CanvasLiveEditor debounces calling requestSave. Do not collapse. They serve different purposes.

6. **revealLeaf() is documented API** — safe to use. `containerEl` on WorkspaceLeaf and `canvas.selection` are undocumented internals already runtime-probed in existing v1.2 code.

7. **chooseSnippet() needs syncManualEdit() call pattern** — same as chooseAnswer() call sites in runner-view.ts. Add `runner.syncManualEdit(this.previewTextarea?.value ?? '')` before `runner.chooseSnippet()` to match BUG-01 fix pattern.

---

## Component Boundaries After v1.3

```
Pure modules (zero Obsidian imports, Vitest-testable):
  graph-model.ts
  canvas-parser.ts
  graph-validator.ts
  protocol-runner.ts
  text-accumulator.ts
  runner-state.ts
  node-color-map.ts        [NEW]

Canvas API layer (Obsidian internal API, runtime-probed):
  canvas-live-editor.ts

Obsidian views and modals:
  editor-panel-view.ts
  runner-view.ts
  snippet-manager-view.ts
  snippet-picker-modal.ts  [NEW]
  snippet-placeholder-editor.ts  [NEW]
  snippet-fill-in-modal.ts (unchanged)
  resume-session-modal.ts  (unchanged)
  node-switch-guard-modal.ts  [DELETED]

Services:
  snippet-service.ts  (unchanged)
  session-service.ts  (unchanged)
```

---

## Sources

All findings are HIGH confidence — derived directly from source code inspection at commit `5308b1d` (main branch, 2026-04-10).

- `src/canvas/canvas-live-editor.ts`: PROTECTED_FIELDS, rollback mechanism, debouncedRequestSave
- `src/types/canvas-internal.d.ts`: canvas.selection timing note, Pattern B API shape
- `src/views/editor-panel-view.ts`: attachCanvasListener, pendingEdits pattern, local PROTECTED_FIELDS
- `src/graph/graph-model.ts`: RPNodeKind union, TextBlockNode.snippetId
- `src/runner/protocol-runner.ts`: awaiting-snippet-fill state, advanceThrough, completeSnippet
- `src/views/runner-view.ts`: handleSnippetFill, autoSaveSession, at-node render branches
- `src/main.ts`: activateEditorPanelView, revealLeaf usage, workspace API patterns
- `src/settings.ts`: RadiProtocolSettings interface, folder path settings
