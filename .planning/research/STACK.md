# Technology Stack — v1.3 Node Editor Overhaul & Snippet Node

**Project:** RadiProtocol
**Milestone:** v1.3 Node Editor Overhaul & Snippet Node
**Researched:** 2026-04-10
**Overall confidence:** HIGH (all findings verified against official Obsidian API source or canvas spec)

---

## Stack Summary

No new runtime dependencies. All four v1.3 research areas are solved using Obsidian built-ins or native browser APIs that integrate cleanly with the existing plain-DOM / `registerDomEvent` pattern.

---

## Existing Stack (Unchanged)

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | 6.0.2 | Language |
| obsidian (npm package) | 1.12.3 | Plugin API types + runtime |
| esbuild | 0.28.0 | Bundler |
| Vitest | ^4.1.2 | Unit test runner |
| eslint-plugin-obsidianmd | 0.1.9 | Lint rules |

No version bumps needed for v1.3.

---

## Research Area 1: Drag-and-Drop for Placeholder Chips (Snippet Editor)

### Decision: Native HTML5 Drag-and-Drop API — no library

**Rationale:** The reorder use case is a flat list of `<div>` chip elements inside `SnippetManagerView`. The HTML5 Drag-and-Drop API handles this with five events on the container: `dragstart`, `dragover`, `dragenter`, `dragleave`, `drop`, and `dragend`. This is fewer than 60 lines of plain DOM code and integrates directly with `registerDomEvent()`. No React, no Sortable.js, no external package.

**Why not Sortable.js / dragula / dnd-kit:**
- All require either a framework runtime (React for dnd-kit) or a bundled ~20-30 KB library (Sortable.js, dragula) added as a runtime `dependencies` entry.
- The existing plugin has zero runtime dependencies besides `obsidian` itself. Adding a drag library for one chip list contradicts the stated constraint "TypeScript + Obsidian Plugin API + esbuild; zero framework overhead."
- For a simple vertical reorder within a single container, the native API is fully sufficient.

**Implementation pattern (verified against MDN and multiple 2024-2025 tutorials):**

```typescript
// On each chip element:
chip.draggable = true;
this.registerDomEvent(chip, 'dragstart', (e: DragEvent) => {
  e.dataTransfer?.setData('text/plain', index.toString());
  chip.addClass('rp-chip-dragging');
});
this.registerDomEvent(chip, 'dragend', () => {
  chip.removeClass('rp-chip-dragging');
});

// On the container:
this.registerDomEvent(container, 'dragover', (e: DragEvent) => {
  e.preventDefault(); // required to allow drop
});
this.registerDomEvent(container, 'drop', (e: DragEvent) => {
  e.preventDefault();
  const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') ?? '-1', 10);
  const toIndex = getDropIndex(e, container); // compute from e.clientY + child rects
  if (fromIndex !== -1 && fromIndex !== toIndex) {
    reorderArray(draft.placeholders, fromIndex, toIndex);
    this.renderChips(draft, container);
  }
});
```

`getDropIndex` inspects `container.children` and uses `getBoundingClientRect()` to find which slot `e.clientY` falls into. This is the standard 15-line helper used in all vanilla drag-to-reorder tutorials.

**ESLint compliance:** No `innerHTML`, no `any`, no console — uses `registerDomEvent` for all event binding. The `draggable = true` property assignment is allowed (no ESLint rule prohibits it in the obsidianmd ruleset).

**Confidence:** HIGH — HTML5 Drag-and-Drop API is part of the browser standard; MDN source.

---

## Research Area 2: Canvas Node Color Coding

### Decision: Write palette string `"1"`–`"6"` to `node.color` via existing `CanvasLiveEditor.saveLive()`

**How Obsidian's color field works (HIGH confidence — verified against `obsidianmd/obsidian-api` canvas.d.ts and canvas-spec):**

The canvas JSON format defines:
```typescript
export type CanvasColor = string;
```

The `color` field on `CanvasNodeData` is `color?: CanvasColor`. It accepts two value shapes:

1. **Palette string `"1"`–`"6"`** — references a theme-defined CSS variable (`--canvas-color-1` … `--canvas-color-6`). Colors adapt to light/dark theme. Mapping:
   - `"1"` = Red
   - `"2"` = Orange
   - `"3"` = Yellow
   - `"4"` = Green
   - `"5"` = Cyan
   - `"6"` = Purple

2. **Hex string `"#RRGGBB"`** — direct color, does not adapt to theme. Should be avoided for node-type coding because it ignores the user's theme.

**Use palette strings, not hex.** Palette strings are the native canvas UI color picker values; they survive theme switches and are what users expect to see when they manually color a node.

**Current blocker in the codebase:** `PROTECTED_FIELDS` in `canvas-live-editor.ts` (line 14) currently includes `'color'`:
```typescript
const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type', 'color']);
```
This prevents `saveLive()` from writing color. The duplicate `PROTECTED_FIELDS` constant inside `editor-panel-view.ts` (line 181) also blocks it via Strategy A.

**Required change:** Remove `'color'` from `PROTECTED_FIELDS` in both files. Then the color-coding call becomes:

```typescript
await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, {
  color: colorForKind(kind),   // e.g. "4" for start, "2" for question
});
```

**No new API, no new types.** `CanvasInternal.setData()` already writes the full node record including `color`. `requestSave()` persists it. The debounce timer already handles rapid successive saves.

**When to trigger:** In `EditorPanelView.handleNodeClick()` immediately after determining the node's `radiprotocol_nodeType`. Fire as a side-effect write alongside the form load. Wrap in the existing try/catch pattern (D-03).

**Suggested node-type to color mapping (for requirements writer to confirm):**
- `start` → `"4"` (green — entry point)
- `question` → `"2"` (orange — decision)
- `answer` → `"5"` (cyan — response)
- `text-block` → `"3"` (yellow — content)
- `snippet` → `"6"` (purple — dynamic content)
- `loop-start` → `"1"` (red — loop boundary)
- `loop-end` → `"1"` (red — loop boundary)
- unset / plain canvas node → omit color field (do not overwrite)

**Confidence:** HIGH — CanvasColor type confirmed in official obsidian-api canvas.d.ts; color-to-number mapping confirmed in canvas-spec.md.

---

## Research Area 3: Auto-Switch to Node Editor Tab When Canvas Node Selected

### Decision: `workspace.revealLeaf()` on the existing `EditorPanelView` leaf

**Obsidian API (HIGH confidence — verified against obsidian-api obsidian.d.ts):**

```typescript
workspace.revealLeaf(leaf: WorkspaceLeaf): Promise<void>
```

`revealLeaf` brings the leaf to the foreground. If the leaf is in a collapsed sidebar, it uncollapses the sidebar. If the leaf is in a tab group with other leaves, it makes the leaf's tab active. This is the public documented API — no undocumented internals needed.

**Current state:** `activateEditorPanelView()` in `main.ts` already calls `workspace.revealLeaf(activeLeaf)`. The EDITOR-01 auto-load feature fires `handleNodeClick()` → `loadNode()`, but if the Runner tab is in front of the Editor tab in the same sidebar tab group, the node form loads silently in the background. The tab does not switch.

**Required change:** At the end of `handleNodeClick()` in `editor-panel-view.ts`, after `this.loadNode(filePath, nodeId)`:

```typescript
const editorLeaves = this.plugin.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
const editorLeaf = editorLeaves[0];
if (editorLeaf !== undefined) {
  void this.plugin.app.workspace.revealLeaf(editorLeaf);
}
```

Three lines using the public API. The `EDITOR_PANEL_VIEW_TYPE` constant is already in scope in `editor-panel-view.ts`.

**Ordering constraint:** `revealLeaf` must be called AFTER `loadNode()` completes synchronous form construction. `loadNode()` calls `renderNodeForm()` via `void` (async), so the form may not be fully rendered when `revealLeaf` is called — this is acceptable because the tab switch is a UX signal, not dependent on form readiness.

**Confidence:** HIGH — `revealLeaf` is a documented public Obsidian API method, confirmed in obsidian-api obsidian.d.ts.

---

## Research Area 4: File Picker for Snippet Node (`.md` and JSON files)

### Decision: `FuzzySuggestModal<TFile>` with folder + extension filter

**Obsidian API (HIGH confidence — verified against official obsidian-api obsidian.d.ts and docs.obsidian.md):**

`FuzzySuggestModal<T>` is a public abstract class. Three methods must be implemented:

```typescript
abstract class FuzzySuggestModal<T> extends SuggestModal<FuzzyMatch<T>> {
  abstract getItems(): T[];
  abstract getItemText(item: T): string;
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
}
```

**Implementation for snippet file picker:**

```typescript
// new file: src/views/snippet-file-picker-modal.ts
import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class SnippetFilePicker extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly folderPath: string,
    private readonly onSelect: (file: TFile) => void,
  ) {
    super(app);
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter(f => {
      const inFolder = this.folderPath === '' || f.path.startsWith(this.folderPath + '/');
      const validExt = f.extension === 'md' || f.extension === 'json';
      return inFolder && validExt;
    });
  }

  getItemText(file: TFile): string {
    return file.path; // full path for disambiguation across subfolders
  }

  onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(file);
  }
}
```

**`vault.getFiles()`** returns `TFile[]` — all files in the vault as a flat array. Filtering by `f.path.startsWith(folderPath + '/')` scopes to a subfolder. `f.extension` is a built-in `TFile` property (no suffix dot — value is `'md'` or `'json'`, not `'.md'`).

**Folder configuration:** Add `snippetFolderPath: string` to `RadiProtocolSettings` with default `""` (empty = search vault root, i.e., no folder restriction). The per-node override stores `radiprotocol_snippetFolder` in the canvas node data, resolved at runtime.

**How the runner uses the picked file:**
- If `file.extension === 'md'`: read with `vault.read(file)` and insert the raw markdown text as the snippet body (no rendering, no placeholder fill).
- If `file.extension === 'json'`: parse as `SnippetFile` and route through the existing `SnippetFillInModal` for placeholder fill.
- This distinction is made in the runner's `snippet` node handler by checking `file.extension`.

**No new modal superclass needed.** `FuzzySuggestModal` already provides keyboard navigation, fuzzy search, and the Obsidian-native suggester chrome.

**Confidence:** HIGH — `FuzzySuggestModal` is a public documented API. `vault.getFiles()` + `TFile.extension` filtering is confirmed in official docs and is the standard pattern used by multiple community plugins.

---

## What NOT to Add

| What | Why Not |
|------|---------|
| Sortable.js / dragula / @dnd-kit | Runtime dep for a single flat-list reorder; native HTML5 DnD is sufficient and zero-cost |
| React / Preact | Contradicts project constraint; entire plugin uses plain DOM |
| SuggestModal with custom fuzzy logic | `FuzzySuggestModal` already handles fuzzy matching; extending it is idiomatic |
| Hex color values for node coding | Palette strings `"1"`–`"6"` are theme-adaptive; hex bypasses the user's theme |
| New esbuild plugin or bundler config | No new file formats or transforms needed |
| `ensureSideLeaf` (internal API) | Not needed; `revealLeaf` on the existing leaf is the correct public API |
| `async-mutex` version bump | `WriteMutex` not touched by v1.3 features |

---

## Integration Points Summary

| Feature | API / Method | Files to Change |
|---------|-------------|----------------|
| Drag-and-drop chip reorder | HTML5 DnD (`dragstart`, `dragover`, `drop`) via `registerDomEvent` | `snippet-manager-view.ts` |
| Node color coding | Remove `'color'` from `PROTECTED_FIELDS`; call `saveLive()` with palette string | `canvas-live-editor.ts`, `editor-panel-view.ts` |
| Auto-switch to Editor tab | `workspace.revealLeaf(editorLeaf)` after `loadNode()` in `handleNodeClick()` | `editor-panel-view.ts` |
| Snippet file picker | New `SnippetFilePicker extends FuzzySuggestModal<TFile>` | new `src/views/snippet-file-picker-modal.ts` |
| Snippet folder setting | New `snippetFolderPath: string` in `RadiProtocolSettings` | `settings.ts` |
| Snippet node type | New `'snippet'` case in `RPNodeKind`, graph model, parser, runner, editor form | `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `editor-panel-view.ts` |

---

## Sources

- Obsidian official canvas type definitions: https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts
- Obsidian official TypeScript API (obsidian.d.ts): https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
- Canvas color mapping 1–6: https://github.com/axtonliu/axton-obsidian-visual-skills/blob/main/obsidian-canvas-creator/references/canvas-spec.md
- Canvas color system and CanvasColor type: https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system
- FuzzySuggestModal: https://docs.obsidian.md/Reference/TypeScript+API/FuzzySuggestModal
- Workspace.revealLeaf: https://docs.obsidian.md/Reference/TypeScript+API/Workspace/revealLeaf
- vault.getFiles(): https://docs.obsidian.md/Reference/TypeScript+API/Vault/getFiles
- HTML5 Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
