# Stack Research: RadiProtocol

**Domain:** Obsidian community plugin (TypeScript + esbuild toolchain)
**Researched:** 2026-04-05 (v1.0); updated 2026-04-07 (v1.1 additions)
**Overall confidence:** HIGH for toolchain, ESLint, Canvas format, hot-reload. MEDIUM for UI framework recommendation, testing strategy. MEDIUM for Canvas internal API (undocumented, reverse-engineered from community plugins).

---

## v1.1 Stack Additions

This section documents the new API surface and patterns required for v1.1 features. The existing v1.0 stack (esbuild, TypeScript, Vitest, async-mutex, plain DOM) is unchanged. No new npm dependencies are required for the v1.1 features.

---

### 1. Full-Tab Runner View

**Feature:** Open the protocol runner as a main editor tab, not a sidebar leaf.

**Why:** `ItemView` is already the base class for the runner. The only change is which leaf it gets mounted to. Currently the runner uses `workspace.getRightLeaf(false)`, which always places it in the right sidebar. Opening in the main tab area requires using `workspace.getLeaf('tab')`.

**Relevant API (PUBLIC — stable):**

```typescript
// Workspace.getLeaf overloads (from obsidian.d.ts):
getLeaf(newLeaf?: PaneType | boolean): WorkspaceLeaf;
getLeaf(newLeaf?: 'split', direction?: SplitDirection): WorkspaceLeaf;

// Where PaneType = 'tab' | 'split' | 'window'
```

`getLeaf('tab')` creates a new leaf in the main editor tab group (not the sidebar). This is the correct call for a full-tab view. [MEDIUM confidence — `PaneType` string literal overload sourced from `marcusolsson/obsidian-plugin-docs` obsidian.d.ts, consistent with forum examples and community plugin code]

**Pattern for opening a custom view as a main tab:**

```typescript
async openRunnerTab(): Promise<void> {
  // Find existing leaf of this type to avoid duplicates
  const existing = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
  if (existing.length > 0) {
    this.app.workspace.revealLeaf(existing[0]);
    return;
  }
  // Create new tab in main editor area
  const leaf = this.app.workspace.getLeaf('tab');
  await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
  this.app.workspace.revealLeaf(leaf);
}
```

**Signatures (PUBLIC, from obsidian.d.ts):**

```typescript
// WorkspaceLeaf
setViewState(viewState: ViewState, options?: SetViewStateOptions): Promise<void>;

// ViewState interface
interface ViewState {
  type: string;
  state?: Record<string, unknown>;
  active?: boolean;
  popstate?: boolean;
}

// Workspace
getLeavesOfType(type: string): WorkspaceLeaf[];
revealLeaf(leaf: WorkspaceLeaf): Promise<void>;
```

[HIGH confidence — sourced from raw obsidian.d.ts via GitHub]

**Implementation notes:**
- The `RunnerView` class itself (`ItemView` subclass) does not change. The only change is the leaf acquisition call.
- `getState()` / `setState()` workspace persistence already implemented in v1.0 will work identically in a tab leaf.
- `getLeaf('tab')` can throw `"Error: No tab group found"` if called before the workspace layout is ready. Wrap in `onLayoutReady` if called during plugin load.
- The Settings tab should expose a toggle: "Open runner as tab / sidebar panel". Store in plugin settings. On command invocation, branch between `getLeaf('tab')` and `getRightLeaf(false)`.

---

### 2. Canvas Selector Dropdown

**Feature:** A dropdown in the runner view that lists `.canvas` files from the vault so the user can pick one without re-invoking the open-runner command.

**Relevant API (PUBLIC — stable):**

```typescript
// Get all canvas files from the vault
const canvasFiles: TFile[] = this.app.vault.getFiles()
  .filter(f => f.extension === 'canvas');

// OR use the more efficient metadata approach
const canvasFiles: TFile[] = this.app.vault
  .getMarkdownFiles()  // does NOT include .canvas — use getFiles() instead
  
// Correct approach:
this.app.vault.getFiles().filter(f => f.extension === 'canvas')
```

**Alternative using AbstractInputSuggest (preferred for UX):**

The `eslint-plugin-obsidianmd` rule `prefer-abstract-input-suggest` flags manual suggest implementations. Use `AbstractInputSuggest<TFile>` for the canvas picker:

```typescript
class CanvasFileSuggest extends AbstractInputSuggest<TFile> {
  getSuggestions(query: string): TFile[] {
    return this.app.vault.getFiles()
      .filter(f => f.extension === 'canvas' && 
                   f.path.toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('div', { text: file.basename });
    el.createEl('small', { text: file.path, cls: 'rp-path-hint' });
  }
  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.close();
  }
}
```

No new dependency needed. This is entirely within the existing Obsidian API.

---

### 3. Live Canvas Node Editing

**Feature:** Edit RadiProtocol node data while the `.canvas` file is open in Canvas View — without requiring the canvas to be closed first (replacing v1.0 Strategy A).

**This is the highest-risk feature of v1.1.** The Canvas runtime API is entirely undocumented and internal. It is reverse-engineered from community plugins (Advanced Canvas, Enchanted Canvas, Link-Nodes-In-Canvas). It can change or break without notice in any Obsidian update.

#### 3a. How to Access the Live Canvas Object

```typescript
// Pattern used by all Canvas-manipulating community plugins:
// Source: Quorafind/Obsidian-Link-Nodes-In-Canvas (verified from raw source)
const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
if (canvasView?.getViewType() === 'canvas') {
  const canvas = (canvasView as CanvasView).canvas;
  // canvas is now the live Canvas object
}

// Alternative: find any open canvas by path
const leaves = this.app.workspace.getLeavesOfType('canvas');
const targetLeaf = leaves.find(l => {
  const view = l.view as CanvasView;
  return view.file?.path === targetCanvasPath;
});
const canvas = targetLeaf ? (targetLeaf.view as CanvasView).canvas : null;
```

Where `CanvasView` and `Canvas` are NOT in the public `obsidian` package. They must be declared locally as a type definition file.

#### 3b. Internal Canvas Interface (UNDOCUMENTED)

Source: `Developer-Mike/obsidian-advanced-canvas` src/@types/Canvas.d.ts — verified from raw GitHub. This is the most comprehensive community-maintained type definition for the internal Canvas API.

**Canvas interface (key methods for RadiProtocol):**

```typescript
interface Canvas {
  app: App;
  view: CanvasView;
  data: CanvasData;              // current in-memory CanvasData (read)
  getData(): CanvasData;         // returns deep copy of current state
  setData(data: CanvasData): void; // replaces all canvas data in memory
  nodes: Map<string, CanvasNode>; // live Map of rendered node objects
  edges: Map<string, CanvasEdge>;
  requestSave(): void;           // queues a debounced save to disk
}

interface CanvasView extends ItemView {
  canvas: Canvas;
  file: TFile;                   // the .canvas file backing this view
}

interface CanvasNode {
  id: string;
  getData(): CanvasNodeData;     // returns this node's serialized data
  setData(data: AnyCanvasNodeData, addHistory?: boolean): void; // update node in-place
  // DOM elements (useful for forcing re-render)
  nodeEl: HTMLElement;
  contentEl: HTMLElement;
}
```

[MEDIUM confidence — sourced from community plugin type definitions, consistent across multiple plugins, but UNDOCUMENTED by Obsidian team]

#### 3c. Two Strategies for Live Edit Write-Back

**Strategy B1: Per-node setData (preferred for targeted edits)**

Edit individual nodes without touching the full canvas data:

```typescript
async editNodeLive(canvas: Canvas, nodeId: string, newData: Partial<AnyCanvasNodeData>): Promise<void> {
  const node = canvas.nodes.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found in live canvas`);
  
  const current = node.getData();
  node.setData({ ...current, ...newData }, true); // addHistory=true for undo support
  canvas.requestSave();
}
```

**Strategy B2: Full getData/setData round-trip**

Replace entire canvas data. Simpler but loses in-memory node state (selection, scroll position may reset):

```typescript
async editCanvasData(canvas: Canvas, mutate: (data: CanvasData) => void): Promise<void> {
  const data = canvas.getData();
  mutate(data);
  canvas.setData(data);
  canvas.requestSave();
}
```

**Recommendation:** Use Strategy B1 (per-node `setData`) for the `EditorPanelView` use case. It is more surgical, preserves the rest of the canvas state, and supports Obsidian's built-in undo history via `addHistory: true`.

#### 3d. Type Declaration File

Create `src/types/canvas-internal.d.ts` to hold these type declarations. Do NOT attempt to import from `obsidian` — cast via `as unknown as CanvasView` or use the import-free declaration pattern:

```typescript
// src/types/canvas-internal.d.ts
// INTERNAL/UNDOCUMENTED Obsidian Canvas API
// Source: reverse-engineered from Developer-Mike/obsidian-advanced-canvas
// These types may break on any Obsidian update.

import type { App, ItemView, TFile } from 'obsidian';
import type { CanvasData, AllCanvasNodeData } from 'obsidian/canvas';

export interface Canvas {
  app: App;
  view: CanvasView;
  data: CanvasData;
  getData(): CanvasData;
  setData(data: CanvasData): void;
  nodes: Map<string, CanvasNode>;
  edges: Map<string, CanvasEdge>;
  requestSave(): void;
}

export interface CanvasView extends ItemView {
  canvas: Canvas;
  file: TFile;
}

export interface CanvasNode {
  id: string;
  getData(): AllCanvasNodeData;
  setData(data: AllCanvasNodeData, addHistory?: boolean): void;
  nodeEl: HTMLElement;
  contentEl: HTMLElement;
}
```

Note: `obsidian/canvas` (the public data-shape types) IS a real importable path. The `Canvas` runtime interface above is what is NOT exported by Obsidian.

#### 3e. Fragility and Fallback

This API has been stable across community plugin observations from 2023–2025 but is subject to breakage. The mitigation plan:

1. Wrap all canvas live-edit calls in a try/catch with graceful fallback to Strategy A (require canvas closed before editing).
2. Add a runtime guard: before calling `node.setData`, verify the node object has a `setData` method.
3. Gate the feature with a settings toggle "Enable live canvas editing (experimental)" — off by default in v1.1, on by default once validated.

```typescript
function isLiveEditSupported(canvas: unknown): canvas is Canvas {
  return (
    canvas !== null &&
    typeof canvas === 'object' &&
    typeof (canvas as Record<string, unknown>).requestSave === 'function' &&
    (canvas as Record<string, unknown>).nodes instanceof Map
  );
}
```

---

### 4. Insert Into Current Note

**Feature:** A new output destination mode that appends the finished protocol report to the currently active Markdown note.

**Two sub-cases:**

**Case A: A Markdown note is open and focused**

Use the `Editor` API (operates on the in-memory editor buffer; does not require a vault.modify write):

```typescript
// Source: obsidian.d.ts (HIGH confidence)
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) {
  const editor = view.editor;
  // Append at cursor position:
  editor.replaceSelection(reportText);
  
  // OR append at end of document:
  const lastLine = editor.lastLine();
  const lastCh = editor.getLine(lastLine).length;
  editor.replaceRange('\n\n' + reportText, { line: lastLine, ch: lastCh });
}
```

`editor.replaceSelection(text)` inserts at the current cursor. `editor.replaceRange(text, from, to?)` inserts at an explicit position.

**Signatures (PUBLIC, from obsidian.d.ts):**

```typescript
abstract replaceSelection(replacement: string, origin?: string): void;
abstract replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition, origin?: string): void;
abstract lastLine(): number;
abstract getLine(line: number): string;
```

**Case B: No Markdown note is active (canvas is focused, or runner tab is active)**

Fall back to `vault.append()` on a user-specified file, or prompt the user to focus a note first. `vault.append()` adds to the end of the file:

```typescript
// Signature (PUBLIC, from obsidian.d.ts):
append(file: TFile, data: string, options?: DataWriteOptions): Promise<string>;
```

**Implementation choice:** Show a notice ("Click into a note to insert, or use Save to Note instead") if no MarkdownView is active. This avoids the complexity of a file-picker modal for the common case.

**Settings integration:** Add `'insert-current'` as a new `OutputDestination` enum value alongside existing `'clipboard'` and `'new-note'`. The existing settings tab needs a new radio option.

---

### 5. Node Templates

**Feature:** Save and reload node structure presets (a saved CanvasNodeData object for each RadiProtocol node type).

**No new API needed.** Store template data as JSON files in `.radiprotocol/templates/` using the existing `vault.read` / `vault.modify` / `vault.create` pattern. Apply the existing `WriteMutex` pattern.

**File format:**

```json
{
  "id": "tpl_question_abc123",
  "name": "Two-choice question",
  "createdAt": 1712345678000,
  "nodeKind": "question",
  "data": {
    "radiprotocol_nodeType": "question",
    "text": "Is the lesion > 1cm?"
  }
}
```

**UI:** A new `TemplateManagerView` (ItemView) or a `TemplatePickerModal` — pattern identical to existing `SnippetManagerView` and `NodePickerModal`. No new library or API.

---

### 6. Community Submission

**No new technical stack.** Submission is a documentation and manifest task.

**Required deliverables (from obsidian-releases submission guide):**

| Artifact | Requirement |
|----------|-------------|
| `README.md` | Must describe plugin purpose and usage. No template filler text. |
| `LICENSE` | Must be present. MIT is standard. |
| `manifest.json` | All required fields; no "obsidian" prefix in ID; version matches GitHub release tag. |
| GitHub Release | Must include `main.js` + `manifest.json` as release assets (not just source zip). |
| `community-plugins.json` | PR to `obsidianmd/obsidian-releases` adding entry at end of file. |

**manifest.json required fields:**

```json
{
  "id": "radiprotocol",
  "name": "RadiProtocol",
  "version": "1.1.0",
  "minAppVersion": "1.5.7",
  "description": "Canvas-based guided protocol runner for medical imaging reports.",
  "author": "Roman Shulgha",
  "isDesktopOnly": true
}
```

`isDesktopOnly: true` is correct — the plugin is desktop-first (per PROJECT.md) and the Canvas view is not available on Obsidian mobile.

`minAppVersion: "1.5.7"` — this version introduced `onExternalSettingsChange`, which was recommended in the v1.0 STACK.md. Raise if v1.1 features require newer APIs (none identified so far).

**ESLint compliance before submission:**

All existing ESLint rules (23 `eslint-plugin-obsidianmd` rules) must pass. The `validate-manifest` rule will catch manifest.json errors. The `no-innerHTML` pattern is already enforced. The automated GitHub Actions validator will re-check these on PR submission.

**Forbidden patterns (will cause review rejection):**
- `innerHTML` / `outerHTML` direct assignment — already blocked by eslint config
- `eval()` or `new Function()` — not used
- `console.log` (must use `console.warn/error/debug`) — already blocked
- Remote network requests without user consent — plugin uses only local vault files, no network calls
- Storing sensitive user data — not applicable

---

## No New npm Dependencies

| Feature | Approach | Dependency needed? |
|---------|----------|--------------------|
| Full-tab view | `getLeaf('tab')` — already in obsidian API | No |
| Canvas selector | `vault.getFiles()` + `AbstractInputSuggest` | No |
| Live canvas editing | Internal Canvas API via type declarations | No (type-only) |
| Insert into note | `Editor.replaceSelection/replaceRange` — already in obsidian API | No |
| Node templates | JSON files via existing vault.read/modify pattern | No |
| Community submission | Documentation task | No |

The existing stack (`obsidian@1.12.3`, `async-mutex`, `esbuild`, `typescript`, `vitest`) is sufficient for all v1.1 features.

---

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|------------|--------|-------|
| `getLeaf('tab')` signature | MEDIUM | marcusolsson/obsidian-plugin-docs obsidian.d.ts | Consistent with forum examples and community plugin code; not in official rendered docs (site is SPA, unfetchable) |
| `setViewState`, `ViewState` | HIGH | Raw obsidian.d.ts from GitHub | Verified verbatim |
| `getLeavesOfType`, `revealLeaf` | HIGH | Raw obsidian.d.ts from GitHub | Verified verbatim |
| `Editor.replaceSelection` | HIGH | Raw obsidian.d.ts from GitHub | Verified verbatim |
| `vault.append` | HIGH | Raw obsidian.d.ts from GitHub | Verified verbatim |
| Canvas `getData/setData` | MEDIUM | Developer-Mike/advanced-canvas @types/Canvas.d.ts | Community-maintained type file; consistent with multiple independent plugins; undocumented by Obsidian |
| `canvas.requestSave()` | MEDIUM | Multiple community plugins (enchanted-canvas, link-nodes-in-canvas) | Widely used, no official docs |
| `canvas.nodes: Map<string, CanvasNode>` | MEDIUM | Developer-Mike/advanced-canvas @types/Canvas.d.ts | Consistent with console introspection technique from forum |
| `CanvasNode.setData(data, addHistory?)` | MEDIUM | Developer-Mike/advanced-canvas @types/Canvas.d.ts | Less widely verified than requestSave; needs runtime guard |
| Community submission requirements | HIGH | obsidian-releases DeepWiki guide + sample-plugin manifest.json | Cross-verified |

---

## Sources

### HIGH confidence
- `github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts` — raw TypeScript definitions, verified 2026-04-07
- `github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts` — public CanvasData schema (serialized format, not runtime)
- `github.com/obsidianmd/obsidian-sample-plugin/blob/master/manifest.json` — required manifest fields
- `deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide` — submission checklist

### MEDIUM confidence
- `github.com/marcusolsson/obsidian-plugin-docs/blob/main/obsidian.d.ts` — getLeaf PaneType overload
- `github.com/Developer-Mike/obsidian-advanced-canvas` src/@types/Canvas.d.ts — internal Canvas API type declarations
- `github.com/Quorafind/Obsidian-Link-Nodes-In-Canvas` — canvas access pattern, getData/setData/requestSave usage
- `github.com/borolgs/enchanted-canvas` — canvas.requestSave, canvas.createTextNode usage confirmed

### LOW confidence (not independently verified)
- `getLeaf('tab')` string literal behavior vs `getLeaf(true)` — forum examples imply 'tab' = new tab in main area; boolean true = legacy behavior; but not confirmed from official docs
