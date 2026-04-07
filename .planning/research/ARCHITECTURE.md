# Architecture Research: RadiProtocol v1.1 Integration

**Domain:** Obsidian community plugin — TypeScript, Canvas-based decision-tree protocol runner
**Researched:** 2026-04-07
**Scope:** v1.1 UX & Community Release — integration of six new features into the existing codebase
**Overall confidence:** HIGH for items verified against obsidian.d.ts and code; MEDIUM for live canvas write strategy (undocumented internal API)

---

## 0. Verified API Facts (from node_modules/obsidian/obsidian.d.ts)

These answers come directly from the installed type definitions, not web search.

```
workspace.getLeaf('tab')    → WorkspaceLeaf  [PaneType | boolean overload, since 0.16.0]
workspace.getLeaf('split')  → WorkspaceLeaf  [adjacent split]
workspace.getLeaf('window') → WorkspaceLeaf  [popout window]
workspace.getLeaf(false)    → WorkspaceLeaf  [reuse existing navigable leaf]
```

`getLeaf('tab')` creates a new leaf in **the root split (main editor area)**, not the sidebar.
`ItemView` inherits from `View` and accepts any `WorkspaceLeaf` — it places itself wherever the leaf is located.
Therefore: `getLeaf('tab').setViewState({ type: RUNNER_VIEW_TYPE })` will open `RunnerView` as an editor tab, not the sidebar. No new view type is required.

```
workspace.getActiveFile(): TFile | null
workspace.getActiveViewOfType<T extends View>(type): T | null
vault.getFiles(): TFile[]
```

These are public API and useful for the canvas selector and "insert into current note" features.

---

## 1. Feature Integration Analysis

### 1.1 Full-Tab Runner View

**Question:** Can RunnerView be opened as an editor tab with `getLeaf('tab')`? Or does a separate view type need to be created?

**Answer:** No separate view type is needed. `RunnerView extends ItemView` already works in any leaf. The only change required is in `main.ts#activateRunnerView()`.

**Current flow (`activateRunnerView` in main.ts:149-175):**
1. Checks for existing leaf of `RUNNER_VIEW_TYPE` — if found, reveals it.
2. Otherwise: `workspace.getRightLeaf(false)` → sidebar leaf → `setViewState`.
3. After opening, auto-loads the active canvas file.

**New flow (tab mode):**
1. Check settings for preferred opening mode: `'sidebar'` (current) or `'tab'` (new).
2. If `'tab'`: use `workspace.getLeaf('tab')` instead of `workspace.getRightLeaf(false)`.
3. Everything else (auto-load canvas, `setState`/`getState` persistence) works unchanged.

**Modification required:** `main.ts#activateRunnerView()` — add a branch on `this.settings.runnerViewMode`.

**Settings change:** Add `runnerViewMode: 'sidebar' | 'tab'` to `RadiProtocolSettings` + `DEFAULT_SETTINGS` in `settings.ts`. Add a UI control in `RadiProtocolSettingsTab.display()`.

**Risk:** `getState()`/`setState()` workspace persistence is currently tested and working. Tab-mode leaves persist state identically to sidebar leaves — no regression expected.

**Risk (low):** User opens runner as tab and also opens it as sidebar from a second invocation. The existing `getLeavesOfType` guard in `activateRunnerView` checks for any existing leaf regardless of position, so duplicate opens are already prevented.

---

### 1.2 Canvas Selector Dropdown

**Question:** Where does the dropdown live and how does it coexist with the existing "open canvas via command" flow?

**Current flow:**
- `activateRunnerView()` in `main.ts` auto-loads the currently active canvas leaf's file.
- `RunnerView` `setState()` restores the canvas path on workspace reload.
- The `'run-protocol'` command opens the runner view; if a canvas is active, it auto-loads.
- The runner idle state shows: "Use the 'Run protocol' command from the command palette."

**Proposed integration:**

The dropdown belongs in `RunnerView` itself, rendered at the top of `contentEl` before the question zone. It is always visible (not only in idle state) so the user can switch canvases mid-session.

**Implementation approach:**
1. In `RunnerView.render()`, always render a header section above `rp-question-zone` containing:
   - A `<select>` (or Obsidian `DropdownComponent`) listing all `.canvas` files in the vault.
   - The currently loaded canvas is pre-selected.
   - `onChange` calls `this.openCanvas(selectedPath)`, which replaces the session resume flow.
2. Canvas files are enumerated via `this.app.vault.getFiles().filter(f => f.extension === 'canvas')`.
3. The existing command flow remains intact: `activateRunnerView()` can still call `view.openCanvas(path)` — the dropdown just reflects the selected path via `this.canvasFilePath`.

**Coexistence with command flow:**
The command and the dropdown are both wiring into the same `openCanvas(path)` method. The command is the entry point for keyboard users; the dropdown is for mouse users who want to switch mid-use. No conflict.

**New private field:** `RunnerView` needs a reference to the dropdown/select element so `openCanvas()` can keep it in sync after a command-driven load. Add `private canvasSelector: HTMLSelectElement | null = null`.

**Files modified:** `runner-view.ts` only.

**Render position:** Render the selector in `onOpen()` and keep it out of the `render()` re-draw cycle — or render it in a persistent header `div` that `render()` does not call `.empty()` on. This prevents the dropdown from resetting on every state change.

**Architectural note on render cycle:** Currently `render()` calls `this.contentEl.empty()` at the top (line 141). A persistent header requires either: (a) move the selector above `contentEl.empty()` scope into its own `headerEl` div rendered once in `onOpen`, or (b) always re-render selector in `render()` and re-set its value. Option (a) is cleaner and avoids re-enumerating vault files on every runner step.

---

### 1.3 Live Canvas Editing

**Question:** What needs to change in `EditorPanelView` and what new service/abstraction is needed to safely write to an open canvas?

**Current Strategy A (line 64-68, editor-panel-view.ts):**
```typescript
if (this.isCanvasOpen(filePath)) {
  new Notice('Close the canvas before editing node properties.');
  return;
}
```
Strategy A blocks writes entirely when the canvas is open. It works safely but creates UX friction.

**Live editing problem:**
Obsidian's canvas view holds its own in-memory JSON state. When `vault.modify()` is called on a `.canvas` file that is currently open, the write completes on disk, but:
- The canvas view may not pick up the change immediately (no guaranteed `onChange` hook).
- Worse: if the user makes a canvas edit after our write but before the canvas view syncs, the canvas view's save will overwrite our changes (the "requestSave debounce race", confirmed from forum research).
- There is no public Obsidian API for modifying a canvas's in-memory state directly.

**What the internal Canvas API does expose (undocumented, confirmed by community research):**
```
app.workspace.getLeavesOfType('canvas')[0].view.canvas
```
This returns the internal canvas controller object. Community plugins have found methods including `canvas.requestSave()`, `node.setData()`, and direct mutation of `canvas.nodes` (a Map). However:
- These are not in `obsidian.d.ts` — they require `as unknown as CanvasView` casting.
- The internal API has changed across Obsidian versions without notice.
- There is no official event to signal when the canvas has re-rendered after an external write.

**Recommended Strategy B (live write via internal API with safety guards):**

Create `src/canvas/canvas-live-editor.ts` — a narrow service that encapsulates all undocumented canvas access behind a safe interface:

```typescript
// canvas/canvas-live-editor.ts
export interface CanvasLiveEditor {
  /** Returns true if the canvas view is open and the live API is available */
  isLiveEditPossible(filePath: string): boolean;
  /** Patches radiprotocol_* fields on a node in the live canvas in-memory state,
   *  then calls canvas.requestSave() to flush to disk. */
  patchNodeLive(filePath: string, nodeId: string, edits: Record<string, unknown>): boolean;
}
```

`patchNodeLive` implementation:
1. Walk `workspace.getLeavesOfType('canvas')` to find the leaf whose `view.file.path === filePath`.
2. Cast to `unknown` then extract `(view as any).canvas` — isolated to this file only.
3. Find the node in `canvas.nodes` (a Map keyed by node id).
4. Mutate the node's data fields (`radiprotocol_*` only — NEVER touch `x`, `y`, `width`, `height`).
5. Call `canvas.requestSave()` to trigger the canvas view's own debounced save.
6. Return `true` on success, `false` if the canvas object or node was not found.

**Why isolate this into a separate file:** All `any`-casts and undocumented API access is contained in one module. The rest of the plugin remains fully typed. When Obsidian changes the internal API, there is exactly one file to fix.

**Strategy selection in EditorPanelView:**
```typescript
async saveNodeEdits(filePath, nodeId, edits): Promise<void> {
  if (this.isCanvasOpen(filePath)) {
    const success = this.plugin.canvasLiveEditor.patchNodeLive(filePath, nodeId, edits);
    if (!success) {
      new Notice('Live edit failed — close the canvas and try again.');
    }
    return;
  }
  // existing Strategy A path (vault.modify on closed canvas)
  ...
}
```

**New field on plugin:** `canvasLiveEditor: CanvasLiveEditor` instantiated in `main.ts#onload()`.

**Risk:** `requestSave` is debounced; if the user edits a node in canvas within ~2 seconds of the plugin's write, the user's edit wins (expected, correct). Warn users about this in the UI.

**Fallback:** If `isLiveEditPossible` returns false (canvas API changed), fall back to Strategy A behavior — show notice to close canvas first.

---

### 1.4 Insert into Current Note

**Question:** This is a new output destination in RunnerView. Where does it integrate?

**Current output flow:**
- `settings.outputDestination: 'clipboard' | 'new-note' | 'both'`
- `renderOutputToolbar()` in `runner-view.ts` renders Copy and Save buttons.
- `plugin.saveOutputToNote()` in `main.ts` creates a timestamped file in `outputFolderPath`.

**New destination: `'insert-current-note'`**

`workspace.getActiveFile()` returns the most recently active `TFile`. When output destination is `'insert-current-note'`:
1. Get active file via `this.app.workspace.getActiveFile()`.
2. If null, show Notice: "No active note to insert into. Open a note first."
3. If found, read the file, append the report text, and call `vault.modify()`.
4. Optional: respect a user-configured insertion point (e.g., end of file vs. at cursor). For v1.1, end-of-file append is sufficient.

**Files modified:**
- `settings.ts` — add `'insert-current-note'` to the union type and update `DEFAULT_SETTINGS`.
- `runner-view.ts#renderOutputToolbar()` — add "Insert into note" button when mode is set.
- `main.ts` — add `insertOutputIntoNote(text: string): Promise<void>` method (parallel to `saveOutputToNote`).

**Note on active-note detection:** The runner view occupies the active leaf when in sidebar mode; when in tab mode (feature 1.1), the runner tab becomes active when clicked. In both cases, `getActiveFile()` returns the file the user last interacted with *before* switching to the runner — which is the right semantic for "insert into current note." No special handling needed.

---

### 1.5 Node Templates

**Question:** This is a new `TemplateService` + UI inside `EditorPanelView`. How does it integrate?

**Scope:** Save a node's `radiprotocol_*` fields as a named template; load a template to pre-fill the form.

**New module:** `src/templates/template-service.ts` (mirrors `SnippetService` pattern):
- Storage: `.radiprotocol/templates/` — one JSON file per template, same vault-visible pattern as snippets.
- CRUD: `save(template)`, `load(id)`, `list()`, `delete(id)`.
- Uses `WriteMutex` from `src/utils/write-mutex.ts` (same as snippets and sessions).

**Integration with EditorPanelView:**
- Add a "Templates" section to the form: a dropdown of saved templates + "Load" button to pre-fill `pendingEdits`.
- Add a "Save as template" button that takes current form state + a name input and calls `templateService.save()`.
- No change to the save-node flow; templates only affect `pendingEdits` initialization.

**New plugin field:** `templateService: TemplateService` in `main.ts`.

**Settings addition:** `templateFolderPath: string` with default `.radiprotocol/templates`.

---

### 1.6 Community Submission Artifacts

**No architecture changes.** This is documentation, example files, and `manifest.json` field completions. No new TypeScript modules. Not analyzed further here.

---

## 2. New Files vs Modified Files

### New Files

| File | Purpose | Depends On |
|------|---------|-----------|
| `src/canvas/canvas-live-editor.ts` | Encapsulates all undocumented canvas internal API access; `patchNodeLive()` + `isLiveEditPossible()` | Obsidian internal canvas (untyped); `obsidian` workspace API |
| `src/templates/template-service.ts` | CRUD for node template JSON files in `.radiprotocol/templates/` | `WriteMutex`, `vault`, `settings.templateFolderPath` |
| `docs/README.md` | Community plugin README | — |
| `examples/*.canvas` | Example canvas files for the community listing | — |

### Modified Files

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `runnerViewMode: 'sidebar' \| 'tab'`; add `outputDestination: 'insert-current-note'` to union; add `templateFolderPath: string` |
| `src/main.ts` | `activateRunnerView()` branching on `runnerViewMode`; add `insertOutputIntoNote()`; instantiate `canvasLiveEditor` and `templateService`; add `templateFolderPath` to settings initialization |
| `src/views/runner-view.ts` | Add canvas selector header (persistent, outside `render()` re-draw cycle); update `renderOutputToolbar()` for insert-into-note button |
| `src/views/editor-panel-view.ts` | Replace Strategy A hard block with Strategy B (`canvasLiveEditor.patchNodeLive`); add template load/save UI in `buildKindForm` |
| `manifest.json` | Complete all fields for community submission |

### Unchanged Files (confirmed)

| File | Reason |
|------|--------|
| `src/runner/protocol-runner.ts` | Pure engine; no UI or Obsidian API changes touch it |
| `src/graph/canvas-parser.ts` | Read-only parser; live editing bypasses it |
| `src/graph/graph-validator.ts` | Unchanged |
| `src/snippets/snippet-service.ts` | Unchanged; template service is a parallel module |
| `src/sessions/session-service.ts` | Unchanged |
| `src/utils/write-mutex.ts` | Shared utility; no changes needed |

---

## 3. Data Flow Changes

### Runner View — Canvas Selector Flow (new)

```
User opens RunnerView (tab or sidebar)
  → RunnerView.onOpen() renders persistent header with <select>
  → vault.getFiles().filter('.canvas') populates options
  → User selects canvas OR command calls view.openCanvas(path)
  → canvasSelector.value syncs to this.canvasFilePath
  → openCanvas(path) runs (unchanged internals)
```

### EditorPanelView — Live Edit Flow (new Strategy B path)

```
User clicks "Save changes"
  → saveNodeEdits(filePath, nodeId, edits)
  → if isCanvasOpen(filePath):
      canvasLiveEditor.patchNodeLive(filePath, nodeId, edits)
        → getLeavesOfType('canvas') → find matching leaf
        → (view as any).canvas.nodes.get(nodeId)
        → mutate radiprotocol_* fields
        → canvas.requestSave()
      → if false: Notice + fall back to Strategy A message
  → else: existing vault.modify() path (unchanged)
```

### Output — Insert Into Note (new)

```
User clicks "Insert into note"
  → plugin.insertOutputIntoNote(text)
  → workspace.getActiveFile() → TFile or null
  → if null: Notice
  → else: vault.read(file) + append text + vault.modify(file, appended)
```

---

## 4. Component Boundaries After v1.1

```
main.ts (RadiProtocolPlugin)
├── Services (instantiated in onload)
│   ├── canvasParser: CanvasParser           [pure, unchanged]
│   ├── snippetService: SnippetService       [unchanged]
│   ├── sessionService: SessionService       [unchanged]
│   ├── canvasLiveEditor: CanvasLiveEditor   [NEW — encapsulates undocumented API]
│   └── templateService: TemplateService     [NEW — mirrors SnippetService pattern]
│
├── Views
│   ├── RunnerView                           [modified — canvas selector header, tab mode, insert-to-note]
│   ├── EditorPanelView                      [modified — Strategy B live edit, template UI]
│   └── SnippetManagerView                   [unchanged]
│
└── Settings
    └── RadiProtocolSettings                 [modified — runnerViewMode, insert-current-note, templateFolderPath]
```

---

## 5. Suggested Build Order

The features have the following dependency graph:

```
settings.ts changes (runnerViewMode, outputDestination, templateFolderPath)
    ↓
Phase 1: Full-tab runner view
    → Depends on: settings.runnerViewMode
    → Modifies: main.ts#activateRunnerView
    → Risk: LOW — pure API call change, confirmed against obsidian.d.ts

Phase 2: Canvas selector dropdown
    → Depends on: RunnerView (existing)
    → Modifies: runner-view.ts (persistent header + canvasSelector field)
    → Risk: LOW-MEDIUM — render cycle refactor (header vs body) needs care
    → Must be done AFTER Phase 1 (the new tab-mode leaf needs to render the selector too)

Phase 3: Insert into current note
    → Depends on: settings.outputDestination updated, main.ts#insertOutputIntoNote
    → Modifies: runner-view.ts#renderOutputToolbar, main.ts
    → Risk: LOW — uses public API only (getActiveFile, vault.modify)
    → Can be done in parallel with Phase 2

Phase 4: Node templates
    → Depends on: template-service.ts (new), settings.templateFolderPath
    → Modifies: editor-panel-view.ts (template UI section)
    → Risk: LOW — mirrors SnippetService pattern exactly
    → Fully independent; can be built any time after settings changes

Phase 5: Live canvas editing
    → Depends on: canvas-live-editor.ts (new), editor-panel-view.ts Strategy B switch
    → Modifies: editor-panel-view.ts#saveNodeEdits, main.ts (instantiate canvasLiveEditor)
    → Risk: MEDIUM-HIGH — relies on undocumented internal API; needs manual UAT across Obsidian versions
    → Build last; if it can't be validated, it can ship as a follow-up without blocking other features

Phase 6: Community submission artifacts
    → Depends on: all features stable
    → No TypeScript changes
    → Risk: LOW
```

**Rationale for this order:**
- Settings changes are a prerequisite for all other phases — do them first.
- Full-tab (Phase 1) changes how the view is opened; Canvas selector (Phase 2) changes what's rendered inside — Phase 1 must precede Phase 2.
- Insert-to-note (Phase 3) is independent of the canvas selector and can be built in parallel.
- Templates (Phase 4) are fully isolated; they don't touch the runner or the live edit path.
- Live canvas editing (Phase 5) is the highest-risk feature due to the undocumented internal API. It should be the last feature implemented so that its instability does not block other features from shipping.

---

## 6. Risk Register

| Risk | Severity | Feature | Mitigation |
|------|----------|---------|-----------|
| Canvas internal API (`(view as any).canvas`) breaks in a future Obsidian update | HIGH | Live canvas editing | Isolate in `canvas-live-editor.ts`; add `isLiveEditPossible()` guard that falls back gracefully |
| `requestSave` debounce race: user canvas edit within 2s of plugin write overwrites plugin data | MEDIUM | Live canvas editing | Document the limitation; consider adding a 2.5s delay or waiting for `vault.on('modify')` event confirmation |
| `getActiveFile()` returns the runner tab itself (when in tab mode) instead of the last edited note | MEDIUM | Insert into current note | Test: `getActiveFile()` returns the most recently active *file* (not view), so it should be the correct note. Verify in UAT. |
| Canvas selector dropdown lists all canvases, including ones with no RadiProtocol nodes | LOW | Canvas selector | Show validation errors inline after selection — existing `openCanvas()` already handles this |
| Persistent selector header breaks existing `render()` pattern (contentEl.empty on re-draw) | MEDIUM | Canvas selector | Use `onOpen()` to create a separate `headerEl` div that lives outside the `contentEl.empty()` scope; documented in section 1.2 |
| Full-tab runner + sidebar runner coexisting (user opens both) | LOW | Full-tab runner | Existing `getLeavesOfType` guard in `activateRunnerView` already prevents duplicates regardless of leaf type |

---

## 7. Confidence Assessment

| Area | Confidence | Basis |
|------|-----------|-------|
| `getLeaf('tab')` for tab-mode runner | HIGH | Verified in installed `obsidian.d.ts` — `PaneType | boolean` overload confirmed |
| No new view type needed for tab mode | HIGH | `ItemView` accepts any leaf; verified from type definitions |
| Canvas selector placement and render cycle | MEDIUM | Pattern is sound; exact `onOpen` vs `render` boundary needs implementation testing |
| Live canvas internal API (`view.canvas`, `requestSave`) | MEDIUM | Community confirmed existence; not in official API; behavior may vary across versions |
| Template service (SnippetService mirror) | HIGH | Identical pattern to existing `SnippetService` which is tested and shipped |
| Insert-into-note (`getActiveFile` + `vault.modify`) | HIGH | Both are public documented API; pattern used by many community plugins |
| `requestSave` debounce race condition | MEDIUM | Confirmed from forum research; exact timing window is approximately 2 seconds |

---

## Sources

- Installed `node_modules/obsidian/obsidian.d.ts` — `getLeaf`, `ItemView`, `getActiveFile`, `getFiles` signatures (HIGH confidence, authoritative)
- `src/views/runner-view.ts`, `src/views/editor-panel-view.ts`, `src/main.ts`, `src/settings.ts` — current implementation (HIGH confidence, ground truth)
- Obsidian Forum: "Any details on the canvas API?" — internal canvas object discovery via `getLeavesOfType('canvas')[0].view.canvas`
- Obsidian Forum: "`vault.process` and `vault.modify` don't work when there is a `requestSave` debounce event`" — timing race risk for live edits
- DeepWiki obsidianmd/obsidian-api/4.1-canvas-system — canvas data schema; confirms no public live-edit API exists
