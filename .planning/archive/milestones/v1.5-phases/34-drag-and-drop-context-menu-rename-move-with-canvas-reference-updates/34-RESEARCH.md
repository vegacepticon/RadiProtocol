# Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates — Research

**Researched:** 2026-04-15
**Domain:** Obsidian ItemView DOM interaction (HTML5 DnD, keyboard events, contentEditable), Vault file/folder rename, Canvas-reference rewriting
**Confidence:** HIGH

## Summary

Phase 34 extends the folder-tree `SnippetManagerView` shipped in Phase 33 with three overlapping user flows: drag-and-drop reorganization, a "Move to…" context menu with folder picker, and inline F2 rename (plus context-menu "Rename") — all for both files and folders. Every move and every folder rename must fan out to rewrite `radiprotocol_subfolderPath` in every `.canvas` in the vault via the existing Phase 32 `rewriteCanvasRefs` utility.

**The one load-bearing insight** that changes how this phase is scoped: Canvas `SnippetNode`s only store a **folder** (`radiprotocol_subfolderPath`) — never a filename. The runner picks a specific snippet from that folder at run time. This means:

- **File rename** is canvas-invisible — no canvas-ref-sync needed for RENAME-01 / RENAME-03 on file-level renames. [VERIFIED: `src/snippets/canvas-ref-sync.ts:71-82`, `src/graph/canvas-parser.ts:262`, `src/views/runner-view.ts:566` as noted in 33-RESEARCH.md open question #1]
- **File move** between folders is also canvas-invisible in terms of the source folder (other snippets still live there) — but Phase 33's `SnippetEditorModal` already unconditionally calls `rewriteCanvasRefs(new Map([[oldPath, newPath]]))` on every «Папка» save. That call is a **placebo** — `applyMapping` uses the mapping key as a prefix against `subfolderPath` (folder), and a file path with `.json` extension never matches any folder. Phase 34 should make the callsites consistent by: skipping the call on pure-file moves (correct behavior), and actually calling it with folder-relative paths on folder renames/moves (the only place where the prefix-match logic pays off).
- **Folder rename or folder move** is the only case where canvas-ref-sync is load-bearing. The mapping entry must be `(oldFolderRelToSnippetRoot) → (newFolderRelToSnippetRoot)` so that `applyMapping`'s longest-prefix-with-`/`-boundary rewrite lands on every canvas node whose `subfolderPath` starts with the old folder.

**Primary recommendation:** Use `app.fileManager.renameFile(file, newPath)` as the single IO primitive for both file rename and folder rename/move (it handles TFile and TFolder atomically, recursively for folders, and also updates cross-file markdown links which is a free bonus the plugin doesn't rely on). Wrap every rename in a `moveSnippet` / `moveFolder` helper inside `SnippetService` that also computes the correct old→new folder-rel mapping for `rewriteCanvasRefs`. Use HTML5 DnD with custom `x-radi-snippet-tree/*` MIME types on tree rows — the vault watcher will auto-redraw on the resulting `rename` event, so the tree UI state update is free.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Drag-and-drop interaction (start/over/drop) | `SnippetManagerView` (DOM) | — | DnD is pure DOM event wiring on tree rows; no service logic needed for the gesture itself |
| Context menu "Move to…" / "Rename" | `SnippetManagerView` (DOM) | `MoveTargetModal` (new), inline rename helper | Menu is already a DOM concern; picker/rename are UI components that delegate IO |
| Inline F2 rename UI | `SnippetManagerView` (DOM) | — | Swap `<span>` label for `<input>`, commit on Enter, revert on Escape — pure view state |
| Move file (vault IO) | `SnippetService.moveSnippet(old, new)` | `app.fileManager.renameFile` | Service already owns path-safety (`assertInsideRoot`) and WriteMutex; new helper keeps that discipline |
| Move/rename folder (vault IO) | `SnippetService.moveFolder(old, new)` | `app.fileManager.renameFile`, `rewriteCanvasRefs` | Single service method encapsulates the two-step "rename + canvas sync" atomically |
| Rewrite canvas `subfolderPath` refs | `canvas-ref-sync.rewriteCanvasRefs` (Phase 32) | — | Existing, tested, WriteMutex-protected; Phase 34 only adds callsites |
| Tree redraw after move/rename | `SnippetManagerView` vault watcher (Phase 33) | — | Already debounced at 120ms; move/rename fires `vault.on('rename')` naturally |

## <user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 34 yet (phase not yet discussed). The additional context block in the research prompt supplied the in-scope/out-of-scope split and the canonical open questions. Planner should trigger `/gsd-discuss-phase` before `/gsd-plan-phase` to lock decisions, or use this research's recommendations as defaults.

### Locked Decisions
*(none — no CONTEXT.md)*

### Claude's Discretion
All implementation details are open. See `## Open Questions` below for the decisions the planner must make.

### Deferred Ideas (OUT OF SCOPE)
- Bulk multi-select DnD → v1.5 deferred backlog (REQUIREMENTS.md `Future Requirements`)
- Tree keyboard navigation (arrows, Enter to open) beyond the F2 hotkey — nice-to-have, skip unless budget
- Tag-based organization, snippet search, markdown preview → all deferred
- Orphan-canvas-node cleanup (nodes pointing to a now-deleted folder) — documented as Phase 33 non-regression; still out of scope here
</user_constraints>

## <phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| MOVE-01 | Drag-and-drop snippet file onto folder moves file | HTML5 DnD pattern + `fileManager.renameFile(TFile, newPath)` [VERIFIED obsidian.d.ts:2778] |
| MOVE-02 | Drag-and-drop folder onto folder moves whole subtree | `fileManager.renameFile(TFolder, newPath)` handles recursive subtree atomically [VERIFIED obsidian.d.ts:2778 — accepts `TAbstractFile`] |
| MOVE-03 | Context menu "Move to…" opens folder picker | New `MoveTargetModal` or reuse `SnippetEditorModal.buildFolderOptions` pattern with a plain `Modal` subclass listing all folders under snippet root |
| MOVE-04 | Edit modal "Папка" field moves snippet on save | **Already implemented in Phase 33** (`snippet-editor-modal.ts:455-469`, D-09 move-on-save). Phase 34 only needs to **fix** the placebo `rewriteCanvasRefs` call — for single-file moves the call should be skipped, not made with mismatched semantics. |
| MOVE-05 | Move updates all canvas refs | Load-bearing only for folder moves; call `rewriteCanvasRefs(app, Map([[oldFolderRel, newFolderRel]]))` where paths are relative to `settings.snippetFolderPath` |
| RENAME-01 | F2 / context menu renames snippet inline | `keydown` listener on tree root with `event.key === 'F2'`, swap label span for `<input>`, commit on Enter via `fileManager.renameFile`, revert on Escape. Canvas-ref sync is **not** needed for file rename (canvases don't reference filenames). |
| RENAME-02 | F2 / context menu renames folder inline | Same pattern as RENAME-01; canvas-ref sync **IS** needed — folder path changes must fan out |
| RENAME-03 | Rename updates all canvas refs | For folder rename only. Mapping: `oldFolderRelToSnippetRoot → newFolderRelToSnippetRoot`. For file rename: no-op (correct). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `obsidian` (API) | existing | `Modal`, `ItemView`, `fileManager.renameFile`, `vault.on('rename')`, `Menu`, `setIcon`, `Notice` | Only plugin API used — all functionality available, no new deps [VERIFIED: `node_modules/obsidian/obsidian.d.ts:2778, 6493, 2757`] |
| Native HTML5 DnD (`dragstart` / `dragover` / `dragleave` / `drop`) | platform | Tree row DnD interactions | Obsidian's own file explorer uses HTML5 DnD; no third-party library exists in this repo and none is needed [ASSUMED — repo grep returns zero DnD callsites under `src/views/` beyond the chip editor's in-form use] |
| `WriteMutex` (`src/utils/write-mutex.ts`) | existing | Serialize rename + canvas-sync per file path | Already used by `SnippetService` and `canvas-ref-sync`; prevents interleaved vault writes (Phase 32 D-11) |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `ConfirmModal` (existing, Phase 33 Plan 02) | existing | Collision confirmation, destructive-move warning if needed | Reuse; don't rebuild |
| `SnippetEditorModal` (Phase 33) | existing | «Папка» edit save flow (MOVE-04) | **Existing code satisfies MOVE-04** — Phase 34 only fixes the rewriteCanvasRefs mis-call |
| `slugifyLabel` (`snippet-model.ts`) | existing | Validate/normalize new filename on F2 rename | Same normalization used on create/edit — consistent identity |
| `rewriteCanvasRefs` (`canvas-ref-sync.ts`) | existing | Folder-rename fan-out | New callsite from `moveFolder` / `moveSnippet`; mapping entries are folder-rel paths |
| `app.fileManager.renameFile(file, newPath)` | Obsidian | Move file, move folder subtree, rename file, rename folder | **Preferred over `vault.rename`** — obsidian.d.ts:2786 explicitly tells plugins to use `renameFile`. Handles link updates and is safe with other plugins listening on rename. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `fileManager.renameFile` | `vault.rename` | Lower level, doesn't update markdown links, but otherwise equivalent. `renameFile` is the documented-preferred API — use it. |
| Native HTML5 DnD | Pointer events + manual drag-simulation | HTML5 DnD has worse visual feedback control but is dramatically simpler and is what Obsidian file explorer uses. Keep simple. |
| Inline `<input>` swap for F2 | `contentEditable` span | `contentEditable` is harder to reason about with IME, clipboard, and undo. Swap pattern is standard in Obsidian file explorer and in our own `snippet-chip-editor.ts`. |
| Separate `MoveTargetModal` | Reuse `SnippetEditorModal` with `mode: 'edit'` (user changes «Папка» dropdown and saves) | Reusing the editor modal for a pure move is heavy — it re-renders the entire chip editor just to change one field. A thin picker is faster and more discoverable from the context menu. |

**Installation:** None. No new packages. `[VERIFIED: package.json scan — all dependencies already in place from Phases 29/32/33]`

**Version verification:** Not applicable — Obsidian API version is controlled by the user's Obsidian install, and `node_modules/obsidian` type definitions are already present and used by existing code.

## Architecture Patterns

### System Architecture Diagram

```
          ┌──────────────────────────────────────────────────────┐
          │               SnippetManagerView (tree)              │
          │                                                      │
          │  ┌─ Row (file/folder) ─────────────────────────────┐ │
          │  │  • draggable=true                                │ │
          │  │  • keydown F2 → enterInlineRename(path)         │ │
          │  │  • contextmenu → Menu + "Rename" / "Move to…"   │ │
          │  │  • dragstart/over/drop → moveCandidate          │ │
          │  └──────────────────────────────────────────────────┘ │
          └────────────┬─────────────┬─────────────┬──────────────┘
                       │             │             │
             drop      │       F2    │       ctx   │
             gesture   │       key   │       menu  │
                       ▼             ▼             ▼
          ┌──────────────────────────────────────────────────────┐
          │          Rename / Move coordinator (inside view)      │
          │  computes newPath, runs pre-flight checks             │
          └──────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
          ┌──────────────────────────────────────────────────────┐
          │           SnippetService.moveSnippet(old, new)        │
          │           SnippetService.moveFolder(old, new)         │
          │  • assertInsideRoot(old) && assertInsideRoot(new)     │
          │  • collision check via exists()                       │
          │  • WriteMutex.runExclusive(old) + (new) serialized    │
          │  • fileManager.renameFile(TFile|TFolder, newPath)    │
          │  • on folder move: rewriteCanvasRefs(map) ◀──┐       │
          └──────────┬──────────────────────────────────┼────────┘
                     │                                  │
                     ▼                                  │
          ┌─────────────────────────────┐               │
          │  app.fileManager.renameFile │               │
          │  (vault IO, atomic)         │               │
          └────────────┬────────────────┘               │
                       │                                │
                       │ fires                          │
                       ▼                                │
          ┌────────────────────────────┐                │
          │  vault.on('rename') event  │                │
          │  → SYNC-01..03 watcher     │                │
          │  → 120ms debounced redraw  │                │
          └────────────────────────────┘                │
                                                        │
                                                        │
          ┌────────────────────────────┐                │
          │  rewriteCanvasRefs(app,    │ ◀──────────────┘
          │    Map(oldFolder, newFolder)) │
          │  • longest-prefix match    │
          │  • best-effort per canvas  │
          │  • WriteMutex per canvas   │
          │  • returns CanvasSyncResult│
          └────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── views/
│   ├── snippet-manager-view.ts   # add: DnD handlers, F2 keydown, inline rename, "Move to…" menu item
│   ├── move-target-modal.ts      # NEW: flat folder picker, returns selected folder path
│   └── snippet-editor-modal.ts   # patch: remove placebo rewriteCanvasRefs call on file-only moves
├── snippets/
│   └── snippet-service.ts        # add: moveSnippet(old,new), moveFolder(old,new)
├── styles/
│   └── snippet-manager.css       # append Phase 34: .is-dragging, .drop-target, .is-renaming
└── __tests__/
    ├── snippet-service-move.test.ts       # NEW: moveSnippet/moveFolder + collision + canvas-sync
    ├── snippet-tree-dnd.test.ts           # NEW: DnD handler unit tests (logic, not DOM)
    └── snippet-tree-inline-rename.test.ts # NEW: F2 flow, enter commit, escape cancel
```

### Pattern 1: HTML5 DnD on Tree Rows

**What:** Native `draggable=true` + `dragstart`/`dragover`/`drop` with a custom MIME type so we don't collide with Obsidian's own file explorer DnD.

**When to use:** Every tree row (files and folders) gets both draggable source and drop target capability. Folders are drop targets; files are not.

**Example:**
```typescript
// Source: DOM Drag-and-Drop API (MDN) + Obsidian ItemView conventions from src/views/snippet-manager-view.ts
const MIME_FILE = 'application/x-radi-snippet-file';
const MIME_FOLDER = 'application/x-radi-snippet-folder';

// In renderNode — make row draggable
row.setAttribute('draggable', 'true');

this.registerDomEvent(row, 'dragstart', (ev: DragEvent) => {
  if (!ev.dataTransfer) return;
  const mime = node.kind === 'file' ? MIME_FILE : MIME_FOLDER;
  ev.dataTransfer.setData(mime, node.path);
  ev.dataTransfer.setData('text/plain', node.path); // fallback for debug
  ev.dataTransfer.effectAllowed = 'move';
  row.addClass('is-dragging');
});

this.registerDomEvent(row, 'dragend', () => {
  row.removeClass('is-dragging');
});

// Folders accept drops
if (node.kind === 'folder') {
  this.registerDomEvent(row, 'dragover', (ev: DragEvent) => {
    if (!ev.dataTransfer) return;
    const hasFile = ev.dataTransfer.types.includes(MIME_FILE);
    const hasFolder = ev.dataTransfer.types.includes(MIME_FOLDER);
    if (!hasFile && !hasFolder) return;
    ev.preventDefault(); // required to allow drop
    ev.dataTransfer.dropEffect = 'move';
    row.addClass('radi-snippet-tree-drop-target');
  });
  this.registerDomEvent(row, 'dragleave', () => {
    row.removeClass('radi-snippet-tree-drop-target');
  });
  this.registerDomEvent(row, 'drop', (ev: DragEvent) => {
    ev.preventDefault();
    row.removeClass('radi-snippet-tree-drop-target');
    const filePath = ev.dataTransfer?.getData(MIME_FILE) ?? '';
    const folderPath = ev.dataTransfer?.getData(MIME_FOLDER) ?? '';
    if (filePath) void this.handleDropFile(filePath, node.path);
    else if (folderPath) void this.handleDropFolder(folderPath, node.path);
  });
}
```

**Critical details:**
- `preventDefault()` on `dragover` is **mandatory** — without it, the `drop` event never fires. This is the #1 DnD bug on the web.
- Use `dataTransfer.types.includes(...)` (not `getData` — on `dragover`, browsers hide the payload for security; only the type list is visible). The actual `getData` call works on `drop`.
- Use a custom MIME type, not `text/plain`, so we don't accept drops from random external sources (e.g., files dragged from OS file explorer).
- `registerDomEvent` (Obsidian helper) auto-cleans listeners in `onClose()` — use it for every DOM event, matching the existing Phase 33 pattern.

### Pattern 2: F2 Inline Rename

**What:** Swap the `<span class="radi-snippet-tree-label">` for an `<input>`, focus + select-all, commit on Enter, revert on Escape.

**When to use:** F2 keydown while a row is "selected", and context-menu "Rename".

**Example:**
```typescript
// Source: adapted from Obsidian file-explorer convention + src/views/snippet-chip-editor.ts rename pattern

private enterInlineRename(node: TreeNode, labelEl: HTMLElement): void {
  const oldName = node.kind === 'file'
    ? basenameNoExt(node.path)
    : node.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.addClass('radi-snippet-tree-rename-input');
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;
  const commit = async () => {
    if (settled) return;
    settled = true;
    const next = input.value.trim();
    if (next === '' || next === oldName) {
      this.renderTree(); // revert
      return;
    }
    try {
      if (node.kind === 'file') {
        await this.plugin.snippetService.renameSnippet(node.path, next);
      } else {
        await this.plugin.snippetService.renameFolder(node.path, next);
      }
      // Watcher will redraw — no manual render needed
    } catch (e) {
      new Notice('Не удалось переименовать: ' + ((e as Error).message ?? ''));
      this.renderTree();
    }
  };
  const cancel = () => {
    if (settled) return;
    settled = true;
    this.renderTree();
  };

  input.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') { ev.preventDefault(); void commit(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', () => { void commit(); });
}
```

### Pattern 3: Row Selection for F2

F2 needs a **selected row** concept — the current Phase 33 tree doesn't track selection. Add a `selectedPath: string | null` field to `SnippetManagerView`, set on `click`, and render with `data-selected="true"`. Bind `keydown` on `treeRootEl` (with `tabindex="0"` so it can accept focus). This is the lightest-weight state to add.

### Pattern 4: Folder Rename via `fileManager.renameFile`

```typescript
// Source: obsidian.d.ts:2778 + canvas-ref-sync.ts:39-107

async renameFolder(oldPath: string, newBasename: string): Promise<CanvasSyncResult> {
  const normalized = this.assertInsideRoot(oldPath);
  if (normalized === null) throw new Error('rename rejected unsafe path');
  const parent = normalized.slice(0, normalized.lastIndexOf('/'));
  const newPath = parent + '/' + newBasename;

  // Collision pre-flight
  if (await this.app.vault.adapter.exists(newPath)) {
    throw new Error('Папка с таким именем уже существует');
  }

  return this.mutex.runExclusive(normalized, async () => {
    const folder = this.app.vault.getAbstractFileByPath(normalized);
    if (folder === null) throw new Error('Папка не найдена');

    // One atomic call — Obsidian handles recursive subtree rename
    await this.app.fileManager.renameFile(folder, newPath);

    // Compute folder-rel paths for canvas-ref-sync
    const root = this.settings.snippetFolderPath;
    const oldRel = normalized.startsWith(root + '/') ? normalized.slice(root.length + 1) : '';
    const newRel = newPath.startsWith(root + '/') ? newPath.slice(root.length + 1) : '';
    if (oldRel === '' || newRel === '') return { updated: [], skipped: [] };

    return await rewriteCanvasRefs(this.app, new Map([[oldRel, newRel]]));
  });
}
```

### Anti-Patterns to Avoid
- **Don't call `rewriteCanvasRefs` with file paths as mapping keys.** The existing `SnippetEditorModal.handleSave` does this; it's a no-op but confusing. Phase 34 should either remove that call for file-only moves, or leave it and add a comment making clear it's intentionally a no-op placeholder. Recommend removing.
- **Don't hand-roll recursive folder move** by walking children and renaming each. `fileManager.renameFile` is atomic on folders. A hand-rolled loop is slower, racey, and will desynchronize the watcher's 120ms debounce (it'll fire N events and coalesce unpredictably).
- **Don't try to update the tree manually after rename.** The Phase 33 vault watcher already redraws on `vault.on('rename')` with a 120ms debounce. Any manual `renderTree()` call immediately after rename will race with the debounced one. Let the watcher handle it.
- **Don't forget to preserve the folder's expanded state** when a folder is renamed. The `settings.snippetTreeExpandedPaths` array stores absolute paths — after rename, the old path is dead. Either (a) migrate the array in `renameFolder` by mapping any prefix-match old→new, or (b) accept that the renamed folder collapses after rename (minor UX regression). Recommend (a).
- **Don't let drop targets accept a parent folder dropped onto its own descendant.** Pre-flight check in `handleDropFolder`: reject if `targetPath === sourcePath` or `targetPath.startsWith(sourcePath + '/')`. Without this, the move call will throw deep inside the vault with a confusing error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Recursive folder move | Manual `listFolderDescendants` + per-file `fileManager.renameFile` loop | `app.fileManager.renameFile(TFolder, newPath)` | Obsidian does this atomically; one API call, one undo step, one debounced watcher redraw |
| Canvas file scanning + JSON rewrite | A new per-phase canvas walker | `rewriteCanvasRefs` from `src/snippets/canvas-ref-sync.ts` | Already tested (`src/__tests__/canvas-ref-sync.test.ts`), already WriteMutex-protected, already best-effort |
| Path normalization / traversal guard | Custom string logic in the view | `SnippetService.assertInsideRoot` (private today — promote to protected or add wrapper methods) | Prevents directory traversal; used consistently by Phase 32/33 |
| Confirm modal for destructive moves | New inline dialog | `ConfirmModal` from Phase 33 Plan 02 | Already covers 2-button and 3-button variants |
| Folder picker UI | Custom tree-inside-modal | Flat sorted list of `listFolderDescendants(root).folders` in a basic `Modal` subclass (`MoveTargetModal`), with a text filter input | Simpler, matches existing dropdown semantics in `SnippetEditorModal.buildFolderOptions`, no new tree rendering logic |
| DnD library | `react-dnd`, `interact.js`, etc. | Native HTML5 DnD | Zero deps, platform-native, sufficient for single-item drag with folder drop targets |

**Key insight:** Every piece Phase 34 needs is already in the codebase. This phase is almost entirely about **wiring** — it's a UX phase, not an infrastructure phase. The risk is NOT in building the wrong thing; it's in misreading the canvas-ref-sync semantics and shipping broken fan-out for folder renames.

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | `.canvas` files across the vault with `radiprotocol_subfolderPath` string fields pointing at folders under `settings.snippetFolderPath`. `rewriteCanvasRefs` handles these. [VERIFIED: `src/snippets/canvas-ref-sync.ts:71-82`] | Data migration on folder rename/move — call `rewriteCanvasRefs` with folder-rel mapping |
| Stored data | `settings.snippetTreeExpandedPaths: string[]` in `data.json` — list of absolute folder paths currently expanded in the tree. After a folder rename, any entry starting with the old path becomes stale. [VERIFIED: `src/views/snippet-manager-view.ts:228, 312-322, 447-451, 523-527`] | Code edit in `moveFolder`: walk the expanded list and rewrite any entry with the old prefix to the new prefix, then `plugin.saveSettings()` |
| Stored data | `SnippetEditorModal.options.snippet.path` captured at modal open. If the tree is rebuilt mid-edit due to an external rename, the stale path may be used on save. [ASSUMED — not observed in testing, worth a Notice] | No action needed for Phase 34 — Phase 33 modal still uses oldPath correctly; external rename during edit is a rare edge case |
| Live service config | None — the plugin has no external service config. Protocol Runner reads from the vault each time it opens a canvas. | None |
| OS-registered state | None — Obsidian plugin runs inside Obsidian; no Task Scheduler, pm2, launchd, or systemd state. | None |
| Secrets / env vars | None — plugin has no secrets. | None |
| Build artifacts | `main.js` and `styles.css` are generated by esbuild; any source edit requires `npm run build`. `styles.css` is generated, never edit directly (CLAUDE.md). | Run `npm run build` after touching `src/` or `src/styles/` |

**Canonical question answered:** After every file in the repo is updated, the `.canvas` files in the vault and the `snippetTreeExpandedPaths` setting in `data.json` are the only pieces of runtime state that reference renamed-folder paths by string. Both have targeted mitigations documented above.

## Common Pitfalls

### Pitfall 1: `rewriteCanvasRefs` called with file-path mapping entries
**What goes wrong:** Mapping keys are matched against `radiprotocol_subfolderPath` (a folder). A file path like `.radiprotocol/snippets/CT/adrenal/greeting.json` will never equal or be a prefix of any folder path — the call is a silent no-op.
**Why it happens:** D-09 in Phase 33 was originally interpreted as "call canvas-ref-sync on every save/move." The resolved Phase 33 code (`snippet-editor-modal.ts:455-469`) passes file paths, which are the wrong shape.
**How to avoid:** Phase 34 adds two service methods (`moveSnippet`, `moveFolder`) that compute the correct mapping shape. Remove the existing placebo call from `SnippetEditorModal.handleSave` (or leave with a comment explaining it's intentionally no-op; planner decides).
**Warning signs:** Tests that assert `rewriteCanvasRefs` was called but don't assert anything changed. Users reporting "canvas still references the old folder" after a single-snippet move — which is actually **correct behavior**, but confusing copy.

### Pitfall 2: Drop not firing because `dragover` didn't `preventDefault`
**What goes wrong:** Drop event silently does not fire; nothing happens on release.
**Why it happens:** HTML5 DnD requires `event.preventDefault()` in `dragover` to mark an element as a valid drop target. Without it, the browser treats the element as non-droppable.
**How to avoid:** Always call `ev.preventDefault()` inside the `dragover` handler when the drag carries one of our MIME types. Example in Pattern 1 above.
**Warning signs:** DnD "works" in browser DevTools but not in a real session; drops silently fail.

### Pitfall 3: Folder dropped onto its own descendant
**What goes wrong:** `fileManager.renameFile` throws a cryptic error; the tree enters an inconsistent state.
**Why it happens:** No pre-flight check on the drop target.
**How to avoid:** Reject if `targetFolderPath === sourceFolderPath` or `targetFolderPath.startsWith(sourceFolderPath + '/')`. Use the same `/`-boundary check pattern as `canvas-ref-sync.applyMapping` and `SnippetManagerView.shouldHandle`.
**Warning signs:** Dragging folder A onto A/B appears to do nothing or throws. Test explicitly.

### Pitfall 4: Inline rename loses focus from `blur` → `commit` race
**What goes wrong:** User hits Enter; commit runs; meanwhile `blur` from the input losing focus during the async rename triggers a second commit. Race condition produces a duplicate rename or a "rename to same name" error.
**Why it happens:** Enter and blur both fire commit.
**How to avoid:** Use a `settled: boolean` flag (see Pattern 2). First of `{Enter, Escape, blur}` wins; subsequent events short-circuit.
**Warning signs:** Flaky test failures on "rename via Enter"; Notices showing "already exists" after a successful rename.

### Pitfall 5: Watcher redraw races with post-rename manual render
**What goes wrong:** After `renameSnippet`, code calls `renderTree()` immediately. 120ms later the watcher also calls `renderTree()`. The two renders interleave — if state updates between them, the first render shows stale data that flashes.
**Why it happens:** Manual render on top of already-debounced watcher.
**How to avoid:** **Don't** call `renderTree()` after a successful rename. Let the watcher handle it. The user perceives the 120ms debounce as instant.
**Warning signs:** Tree flicker after rename; subtle off-by-one errors in test snapshots.

### Pitfall 6: `snippetTreeExpandedPaths` holds stale paths after folder rename
**What goes wrong:** After renaming `CT/adrenal` to `CT/glands`, the `['CT/adrenal']` entry in settings is dead. Next reload, the tree doesn't re-expand `CT/glands`. Worse: if the user renames to a path that happens to match an unrelated stale entry, the wrong folder expands.
**Why it happens:** Expand list is path-indexed; rename invalidates keys.
**How to avoid:** In `moveFolder`, before/after the rename, scan `settings.snippetTreeExpandedPaths`; rewrite any entry where `entry === old || entry.startsWith(old + '/')` by replacing the `old` prefix with `new`. Save settings.
**Warning signs:** Folder collapses unexpectedly after rename; user reports "my tree state got lost."

### Pitfall 7: Context menu "Move to…" folder picker includes the snippet's current folder
**What goes wrong:** User can "move" a file to the folder it's already in. Save pipeline runs through the entire save→delete→sync path redundantly.
**Why it happens:** No filter in the picker.
**How to avoid:** Filter out the current parent folder from the picker options. Match `SnippetEditorModal.renderFolderDropdown` but skip the current folder.
**Warning signs:** Spurious move confirmations with identical source/destination in logs.

## Code Examples

### Example 1: `SnippetService.moveSnippet` (file-only move)
```typescript
// New in Phase 34 — add to src/snippets/snippet-service.ts
// File move. No canvas-ref-sync (canvases don't reference filenames).
async moveSnippet(oldPath: string, newPath: string): Promise<void> {
  const oldNorm = this.assertInsideRoot(oldPath);
  const newNorm = this.assertInsideRoot(newPath);
  if (oldNorm === null || newNorm === null) {
    throw new Error('[RadiProtocol] move rejected unsafe path');
  }
  if (oldNorm === newNorm) return;
  if (await this.app.vault.adapter.exists(newNorm)) {
    throw new Error('Файл с таким именем уже существует в целевой папке');
  }
  await this.mutex.runExclusive(oldNorm, async () => {
    const file = this.app.vault.getAbstractFileByPath(oldNorm);
    if (file === null) throw new Error('Сниппет не найден');
    // Ensure destination parent folder exists
    const parent = newNorm.slice(0, newNorm.lastIndexOf('/'));
    if (parent !== '') await ensureFolderPath(this.app.vault, parent);
    await this.app.fileManager.renameFile(file, newNorm);
  });
  // Intentionally NO rewriteCanvasRefs — SnippetNode.subfolderPath is a folder,
  // and the file's old folder still contains other snippets (the node stays valid).
}
```

### Example 2: `SnippetService.moveFolder` (folder move with canvas-ref-sync)
```typescript
// Source: adapted from canvas-ref-sync.ts:39 + fileManager.renameFile semantics (obsidian.d.ts:2778)
async moveFolder(oldPath: string, newPath: string): Promise<CanvasSyncResult> {
  const oldNorm = this.assertInsideRoot(oldPath);
  const newNorm = this.assertInsideRoot(newPath);
  if (oldNorm === null || newNorm === null) {
    throw new Error('[RadiProtocol] moveFolder rejected unsafe path');
  }
  if (oldNorm === newNorm) return { updated: [], skipped: [] };
  // Pitfall 3: reject parent-into-descendant
  if (newNorm === oldNorm || newNorm.startsWith(oldNorm + '/')) {
    throw new Error('Нельзя переместить папку внутрь её собственной подпапки');
  }
  if (await this.app.vault.adapter.exists(newNorm)) {
    throw new Error('Папка с таким именем уже существует в целевом расположении');
  }
  return this.mutex.runExclusive(oldNorm, async () => {
    const folder = this.app.vault.getAbstractFileByPath(oldNorm);
    if (folder === null) throw new Error('Папка не найдена');
    const parent = newNorm.slice(0, newNorm.lastIndexOf('/'));
    if (parent !== '') await ensureFolderPath(this.app.vault, parent);
    await this.app.fileManager.renameFile(folder, newNorm);

    // Canvas-ref fan-out — mapping is folder-REL to snippet root
    const root = this.settings.snippetFolderPath;
    const oldRel = oldNorm === root ? '' : oldNorm.slice(root.length + 1);
    const newRel = newNorm === root ? '' : newNorm.slice(root.length + 1);
    if (oldRel === '') return { updated: [], skipped: [] };
    return await rewriteCanvasRefs(this.app, new Map([[oldRel, newRel]]));
  });
}
```

### Example 3: `SnippetService.renameSnippet` / `renameFolder`
```typescript
// Thin wrappers that compose a new path from a new basename and delegate.
async renameSnippet(oldPath: string, newBasename: string): Promise<void> {
  const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const ext = oldPath.slice(oldPath.lastIndexOf('.'));
  const slug = slugifyLabel(newBasename);
  if (slug === '') throw new Error('Имя не может быть пустым');
  const newPath = `${parent}/${slug}${ext}`;
  await this.moveSnippet(oldPath, newPath);
}

async renameFolder(oldPath: string, newBasename: string): Promise<CanvasSyncResult> {
  if (newBasename.trim() === '') throw new Error('Имя не может быть пустым');
  if (/[\\/]/.test(newBasename)) throw new Error('Имя не должно содержать «/» или «\\»');
  const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const newPath = `${parent}/${newBasename.trim()}`;
  return this.moveFolder(oldPath, newPath);
}
```

### Example 4: MoveTargetModal skeleton
```typescript
// New file: src/views/move-target-modal.ts
import { App, Modal } from 'obsidian';

export class MoveTargetModal extends Modal {
  readonly result: Promise<string | null>;
  private resolveResult!: (value: string | null) => void;
  private options: string[];
  private currentFolder: string;

  constructor(app: App, options: string[], currentFolder: string) {
    super(app);
    // Filter out the current folder so "move to same" is impossible
    this.options = options.filter((f) => f !== currentFolder).sort();
    this.currentFolder = currentFolder;
    this.result = new Promise((res) => { this.resolveResult = res; });
  }
  onOpen(): void {
    this.titleEl.setText('Переместить в…');
    const { contentEl } = this;
    contentEl.empty();
    const filter = contentEl.createEl('input', { type: 'text', placeholder: 'Поиск папки…' });
    const list = contentEl.createEl('ul', { cls: 'radi-move-target-list' });
    const render = (q: string) => {
      list.empty();
      for (const f of this.options) {
        if (q !== '' && !f.toLowerCase().includes(q.toLowerCase())) continue;
        const li = list.createEl('li');
        li.setText(f);
        li.addEventListener('click', () => {
          this.resolveResult(f);
          this.close();
        });
      }
    };
    filter.addEventListener('input', () => render(filter.value));
    render('');
    setTimeout(() => filter.focus(), 0);
  }
  onClose(): void {
    this.resolveResult(null); // treat close-without-select as cancel
    this.contentEl.empty();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `vault.rename(file, newPath)` | `fileManager.renameFile(file, newPath)` | Obsidian 0.11.0+ | Plugin-land consensus: use `FileManager` for rename/move so link updates fire. We don't need link updates (no markdown cross-refs), but using the documented-preferred API avoids future breakage. [VERIFIED: obsidian.d.ts:2778, 6486] |
| Master-detail with id-based path derivation | Path-as-identity tree view | Phase 32 (D-02) | Phase 34 must never derive a path from id; always use the authoritative `snippet.path` / `node.path`. |
| Unconditional `rewriteCanvasRefs(new Map([[oldPath, newPath]]))` on save | Conditional call: only on folder rename/move, with folder-rel keys | Phase 34 (this research) | Fixes the Phase 33 placebo call. |

**Deprecated/outdated:**
- Direct `vault.rename` — still works, but obsidian.d.ts:6486 explicitly directs plugins to `FileManager.renameFile` instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `fileManager.renameFile` handles folder subtree atomically (single vault event burst) | Pattern 4, Example 2 | Low. If it fires per-descendant events, the watcher's 120ms debounce still coalesces them. Worst case: up to ~N events within the debounce window, still one redraw. [ASSUMED from API doc; not runtime-verified this session] |
| A2 | HTML5 DnD with custom MIME types does not collide with Obsidian's own file explorer DnD | Pattern 1 | Low. Custom MIME (`application/x-radi-snippet-*`) is our namespace; Obsidian's explorer uses different types. Worst case: cross-drag between our tree and the explorer fails, which is acceptable. [ASSUMED — not verified against running explorer instance] |
| A3 | `fileManager.renameFile` on a TFolder into a path whose parent doesn't exist will succeed if we call `ensureFolderPath` first | Example 2 | Low. `ensureFolderPath` is the existing vault utility used by every Phase 32/33 writer. [ASSUMED — pattern matches existing save/create codepaths] |
| A4 | `vault.on('rename')` fires for each renamed descendant of a folder rename (not just the top) | Pitfall 5 | Medium. If it only fires once at the top, the debounce still triggers one redraw — safe. If it fires per descendant, 120ms debounce coalesces them. Either way, the watcher path is fine. [ASSUMED — Obsidian API doc does not specify] |
| A5 | The Phase 33 placebo `rewriteCanvasRefs` call in `SnippetEditorModal.handleSave` is safe to remove without breaking MOVE-04 | Pitfall 1, Anti-Patterns | Low. MOVE-04 is satisfied by the save + delete pipeline (the file physically moves). Canvas refs are unchanged by single-file moves because nodes reference folders, not files. [VERIFIED via source read of canvas-ref-sync.ts + 33-RESEARCH.md open question #1] |
| A6 | No deferred SnippetNode "filename" field exists anywhere in the canvas schema | Summary, MOVE-05/RENAME-03 interpretation | **High if wrong**. The entire "file rename is canvas-invisible" argument depends on this. [VERIFIED: grep for `radiprotocol_(subfolderPath|snippetName|snippetPath|filename)` returns ONLY `radiprotocol_subfolderPath` — no filename field exists] |
| A7 | Plugin should NOT introduce orphan-cleanup for canvas nodes pointing to deleted folders (Phase 33 D-17 stance) | Deferred Ideas | Low. Matches the existing Phase 33 behavior; Phase 34 does not regress. |

## Open Questions

1. **Fix the Phase 33 placebo `rewriteCanvasRefs` call — or leave it?**
   - What we know: `SnippetEditorModal.handleSave:459-462` calls `rewriteCanvasRefs(app, Map([[oldPath, newPath]]))` with file paths. The call is a no-op against all current canvas data.
   - What's unclear: whether the planner/user prefers removing the call (clean) or leaving it with a comment (preserves an "in case the schema ever gains a filename field" hook).
   - Recommendation: **remove it** and replace the "Сниппет перемещён. Обновлено канвасов: X" notice with just "Сниппет перемещён." The current notice lies to the user about canvas updates that didn't happen.

2. **Move-via-"Папка"-dropdown in `SnippetEditorModal` — does it count as MOVE-04 already, or does Phase 34 need to modify anything?**
   - What we know: MOVE-04 says "the edit modal's «Папка» field moves the snippet on save" — Phase 33 already ships this.
   - What's unclear: whether Phase 34 should add a dedicated "Move" button or leave the save-driven flow.
   - Recommendation: MOVE-04 is **already satisfied** by Phase 33 code. Phase 34 only needs to fix the placebo call (Q1) and add the context-menu "Move to…" path (MOVE-03) and DnD paths (MOVE-01, MOVE-02). No new button in the modal.

3. **Drop-onto-file semantics.**
   - What we know: dragging a file onto another file could mean "place next to" (reorder) or "move into the target's folder."
   - What's unclear: whether to accept file→file drops at all.
   - Recommendation: **reject** file→file drops (drop target is folders only). D-04 in Phase 33 explicitly says drag-to-reorder is out of scope; manual sort order is unused. Keeps the interaction model simple.

4. **Inline rename for files: show/hide the `.json`/`.md` extension in the input?**
   - What we know: `basenameNoExt` strips the extension for display; `slugifyLabel` + `ext` recomputes it on commit.
   - What's unclear: should the input show `greeting` (cleaner) or `greeting.json` (explicit)?
   - Recommendation: **show basename without extension**, consistent with how the tree label is rendered. Extension stays locked.

5. **Inline rename keyboard shortcut scope.**
   - What we know: F2 is standard in Windows/Linux file explorers; Obsidian desktop uses F2 too.
   - What's unclear: should we also accept `Enter` on a selected row? (macOS Finder uses Enter.)
   - Recommendation: F2 only for Phase 34. Cross-platform rename shortcut hygiene can be a v1.6 polish pass.

6. **Expanded-paths settings migration on folder rename — in-place edit or settings migration step?**
   - What we know: `snippetTreeExpandedPaths: string[]` is a plain array in `data.json`.
   - What's unclear: whether to walk-and-rewrite inside `moveFolder` or offer a dedicated helper.
   - Recommendation: walk-and-rewrite inside `moveFolder`, same transaction. Tiny code, no helper needed.

7. **Confirm-before-move prompt or silent move?**
   - What we know: Obsidian's own file explorer moves silently on drop. Phase 33 folder-delete uses a confirm dialog because delete is destructive.
   - What's unclear: is moving across folders "destructive enough" to warrant a confirm?
   - Recommendation: **silent** for files (common operation, undo via rename). **Confirm** for folders (large blast radius if the user dragged the wrong thing and N snippets move). Show canvas-sync result as a `Notice` after the move completes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `obsidian` (API types) | All code | ✓ | `node_modules/obsidian` (existing) | — |
| `vitest` | All tests | ✓ | existing config, passing suites | — |
| `esbuild` | Build | ✓ | existing config | — |
| Lucide icons (`folder`, `folder-open`, `pencil`, `move` or `arrow-right-left`, `plus`, `trash`) | Context menu, DnD drop target highlight | ✓ | ships with Obsidian runtime | — |
| `app.fileManager.renameFile` | Move/rename IO | ✓ | obsidian.d.ts:2778 | `vault.rename` — lower level, acceptable |
| `app.vault.getAbstractFileByPath` | Look up TFile / TFolder by path | ✓ | existing usage in `snippet-service.ts:211, 255` | — |

No external dependencies. Nothing to install. [VERIFIED: package.json scan unchanged since Phase 33]

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` (project root — existing) |
| Quick run command | `npx vitest run src/__tests__/snippet-service.test.ts src/__tests__/canvas-ref-sync.test.ts src/__tests__/snippet-service-move.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| MOVE-01 | `moveSnippet(old, new)` relocates file in vault; collision rejected | unit | `npx vitest run src/__tests__/snippet-service-move.test.ts -t "moveSnippet"` | ❌ Wave 0 |
| MOVE-02 | `moveFolder(old, new)` relocates subtree via single `fileManager.renameFile` | unit | `npx vitest run src/__tests__/snippet-service-move.test.ts -t "moveFolder subtree"` | ❌ Wave 0 |
| MOVE-02 | `moveFolder` rejects parent-into-descendant | unit | `... -t "rejects self-descendant"` | ❌ Wave 0 |
| MOVE-03 | Context menu "Move to…" opens picker; selected target triggers `moveSnippet`/`moveFolder` | integration | `npx vitest run src/__tests__/snippet-tree-dnd.test.ts -t "move-to menu"` | ❌ Wave 0 |
| MOVE-04 | Already covered by Phase 33 `snippet-editor-modal.test.ts` — regression only | unit | existing | ✅ existing |
| MOVE-05 | `moveFolder` calls `rewriteCanvasRefs` with folder-rel mapping; canvas subfolderPath updated | integration | `... -t "canvas refs after folder move"` | ❌ Wave 0 |
| MOVE-05 | `moveSnippet` does NOT call `rewriteCanvasRefs` (no-op for file-only move) | unit | `... -t "moveSnippet does not invoke canvas sync"` | ❌ Wave 0 |
| RENAME-01 | F2 on selected file enters inline rename; Enter commits via `renameSnippet` | unit (DOM) | `npx vitest run src/__tests__/snippet-tree-inline-rename.test.ts -t "file F2"` | ❌ Wave 0 |
| RENAME-01 | Escape cancels; content unchanged | unit (DOM) | `... -t "file Escape cancels"` | ❌ Wave 0 |
| RENAME-02 | F2 on selected folder enters inline rename; Enter commits via `renameFolder` | unit (DOM) | `... -t "folder F2"` | ❌ Wave 0 |
| RENAME-03 | Folder rename calls `rewriteCanvasRefs`; file rename does NOT | integration | `npx vitest run src/__tests__/snippet-service-move.test.ts -t "rename canvas fan-out"` | ❌ Wave 0 |
| RENAME-03 | `snippetTreeExpandedPaths` gets prefix-rewritten on folder rename | unit | `... -t "expanded paths migrate on folder rename"` | ❌ Wave 0 |
| DnD-pitfall-2 | `dragover` handler calls `preventDefault` only when drag carries our MIME | unit (DOM) | `... snippet-tree-dnd.test.ts -t "dragover guards"` | ❌ Wave 0 |
| DnD-pitfall-3 | Drop of folder onto own descendant rejected | unit | `... snippet-service-move.test.ts -t "rejects self-descendant"` | ❌ Wave 0 |
| Pitfall-4 | Inline rename `settled` flag prevents double-commit from Enter+blur race | unit | `... snippet-tree-inline-rename.test.ts -t "settled guard"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/snippet-service-move.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + `npm run build` clean + human UAT in real Obsidian vault covering MOVE-01..05 + RENAME-01..03 round-trip with a `.canvas` fixture that references a snippet folder, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/__tests__/snippet-service-move.test.ts` — NEW (covers MOVE-01/02/05, RENAME-03, collision + self-descendant pitfalls, canvas sync fan-out using fixtures from `src/__tests__/fixtures/snippet-node*.canvas`)
- [ ] `src/__tests__/snippet-tree-dnd.test.ts` — NEW (covers DnD handler logic: MIME acceptance, `dragover.preventDefault`, drop target highlight classes, "Move to…" menu flow)
- [ ] `src/__tests__/snippet-tree-inline-rename.test.ts` — NEW (covers F2 entry, Enter commit, Escape cancel, `settled` race guard, both file and folder rows)
- [ ] No framework install needed — vitest already configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | n/a (local Obsidian plugin) |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | `SnippetService.assertInsideRoot` must gate `moveSnippet`, `moveFolder`, `renameSnippet`, `renameFolder` on BOTH source and destination paths |
| V5 Input Validation | yes | `slugifyLabel` for filename-from-user-input, reject `/` and `\` in folder-basename renames, reject empty/whitespace-only names, reject `.` and `..` segments via `assertInsideRoot` |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Path traversal via user-entered rename target (`../../etc/passwd`) | Tampering | `assertInsideRoot` rejects `..` segments and absolute paths; tested in Phase 32 suite. New methods MUST run the gate on both `oldPath` and `newPath`. |
| Move folder into own descendant (DoS / inconsistent vault state) | Tampering | Pre-flight check: `newPath === oldPath || newPath.startsWith(oldPath + '/')` → throw |
| Silent overwrite on name collision | Tampering | Pre-flight `vault.adapter.exists(newPath)` check; throw with user-visible error |
| DnD payload from external source (OS file explorer, another plugin) injecting a non-snippet file | Tampering | Custom MIME type (`application/x-radi-snippet-*`); `dragover` handler only calls `preventDefault` if our MIME is present |
| Concurrent rename race (two renames of the same file) | Tampering | `WriteMutex.runExclusive(oldNorm)` serializes per-path |
| XSS via snippet/folder name in inline rename input | Injection | All DOM writes via `createEl` / `setText` / `input.value`; no `innerHTML` (CLAUDE.md) |
| Canvas-sync writes unrelated canvases | Tampering | `rewriteCanvasRefs` only touches nodes with `radiprotocol_nodeType === 'snippet'` and skips canvases with no matching nodes (`mutated` flag). Verified in `canvas-ref-sync.ts:71-85`. |

No new security surface beyond what Phase 32/33 already protects. Every new method reuses existing gates; no new attack surface is introduced.

## Sources

### Primary (HIGH confidence)
- `Z:/projects/RadiProtocolObsidian/node_modules/obsidian/obsidian.d.ts:2757-2800` — `FileManager.renameFile` signature verified
- `Z:/projects/RadiProtocolObsidian/node_modules/obsidian/obsidian.d.ts:6483-6494` — `Vault.rename` deprecation hint in favor of `FileManager.renameFile`
- `Z:/projects/RadiProtocolObsidian/src/snippets/canvas-ref-sync.ts` — full read, `applyMapping` prefix semantics, subfolderPath-only field target
- `Z:/projects/RadiProtocolObsidian/src/snippets/snippet-service.ts` — full read, `assertInsideRoot`, WriteMutex per-path, existing `createFolder`/`deleteFolder`/`listFolderDescendants`
- `Z:/projects/RadiProtocolObsidian/src/snippets/snippet-model.ts` — full read, discriminated union, `slugifyLabel`
- `Z:/projects/RadiProtocolObsidian/src/views/snippet-manager-view.ts` — full read, tree render, context menu, watcher, expanded-paths persistence
- `Z:/projects/RadiProtocolObsidian/src/views/snippet-editor-modal.ts` — full read, the existing (placebo) `rewriteCanvasRefs` call at lines 459-462
- `Z:/projects/RadiProtocolObsidian/.planning/phases/33-.../33-RESEARCH.md:420-555` — Phase 33's own "CRITICAL NUANCE" block on canvas-ref-sync semantics (this was the key hint)
- `Z:/projects/RadiProtocolObsidian/.planning/phases/33-.../33-CONTEXT.md` — Phase 33 decisions D-01..D-18, in-scope/out-of-scope split
- `Z:/projects/RadiProtocolObsidian/.planning/REQUIREMENTS.md` — MOVE-01..05, RENAME-01..03
- `Z:/projects/RadiProtocolObsidian/.planning/ROADMAP.md` — Phase 34 success criteria (lines 122-127)
- `Z:/projects/RadiProtocolObsidian/CLAUDE.md` — CSS append-only, never-delete-unrelated-code, esbuild build, `styles.css` generated

### Secondary (MEDIUM confidence)
- MDN HTML5 Drag and Drop API — standard `preventDefault` on `dragover` requirement (not re-fetched this session; documented in platform specs since 2010)
- `Z:/projects/RadiProtocolObsidian/src/__tests__/canvas-ref-sync.test.ts` — confirms the prefix-match with `/` boundary behavior
- `Z:/projects/RadiProtocolObsidian/src/graph/canvas-parser.ts:262` — confirms SnippetNode only reads `radiprotocol_subfolderPath`, never a filename field

### Tertiary (LOW confidence)
- `vault.on('rename')` event fan-out semantics for folder rename (one event or N events) — not verified against a running Obsidian. Either behavior is safe under the 120ms debounce. [A4 in Assumptions Log]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every API verified in `obsidian.d.ts`; no new dependencies.
- Architecture: HIGH — every pattern has a Phase 33 precedent; new methods are thin wrappers around existing service discipline.
- Pitfalls: HIGH — Pitfalls 1, 2, 3, 6 are derived directly from source reads; Pitfall 4 is a standard web DnD / input race condition.
- Canvas-ref-sync semantics: HIGH — verified by full read of the module plus its own test file, plus the Phase 33 research's identical open question.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — Obsidian API is stable; canvas schema is internal and unlikely to change between now and Phase 34 execution)

## RESEARCH COMPLETE

**Phase:** 34 - Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates
**Confidence:** HIGH

### Key Findings
- Canvas `SnippetNode`s store only `radiprotocol_subfolderPath` (folder), never a filename. File rename/move is canvas-invisible; only folder rename/move needs `rewriteCanvasRefs` — and the mapping keys must be folder paths **relative to the snippet root**.
- The Phase 33 `SnippetEditorModal.handleSave` call to `rewriteCanvasRefs` with file-path keys is a placebo (no-op). Phase 34 should remove it and replace the misleading "Обновлено канвасов: N" notice.
- Obsidian's `app.fileManager.renameFile(TAbstractFile, newPath)` handles both file and folder moves atomically, including recursive subtree for folders. This is the single IO primitive Phase 34 needs. `vault.rename` is explicitly deprecated in favor of it.
- All infrastructure (path-safety gate, WriteMutex, canvas-ref-sync, ConfirmModal, vault watcher with 120ms debounce) already exists. Phase 34 is a pure wiring phase: add two SnippetService methods (`moveSnippet`, `moveFolder`) + DnD/F2/context-menu UI + one new `MoveTargetModal`.
- `snippetTreeExpandedPaths` setting must be prefix-rewritten on folder rename inside `moveFolder` to preserve tree state.

### File Created
`Z:/projects/RadiProtocolObsidian/.planning/phases/34-drag-and-drop-context-menu-rename-move-with-canvas-reference-updates/34-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|---|---|---|
| Standard Stack | HIGH | Every API verified in `obsidian.d.ts` |
| Architecture | HIGH | Every pattern has a Phase 33 precedent |
| Pitfalls | HIGH | Derived from source reads + standard web DnD gotchas |
| Canvas-ref-sync semantics | HIGH | Full-read verified, cross-checked with tests and Phase 33 open question |

### Open Questions
See `## Open Questions` section — 7 items. Most critical: **Q1 (remove placebo call?) and Q2 (is MOVE-04 already done by Phase 33?)**. Recommend the planner drive `/gsd-discuss-phase` before `/gsd-plan-phase` to lock these.

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
