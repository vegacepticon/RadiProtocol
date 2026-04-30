---
phase: 33
phase_name: "Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher"
depends_on: [32]
created: 2026-04-15
---

# Phase 33 — Implementation Context

## Phase Boundary

**Goal:** Replace the legacy master-detail `SnippetManagerView` with a collapsible folder-tree view backed by a single create/edit modal, add per-folder create and delete operations, and keep the tree synchronized with the vault via live watchers.

**In scope:**
- New folder-tree view (replaces `snippet-manager-view.ts` entirely — TREE-02)
- `SnippetEditorModal` (unified create+edit, Obsidian `Modal` subclass)
- Folder create/delete operations from context menu + hover actions
- Vault watchers (`create`/`delete`/`rename`) with prefix filter + teardown
- Confirm modals for destructive actions (snippet delete, folder delete)
- Minimum canvas-ref-sync wiring for the edit-modal «Папка» change path (uses existing `rewriteCanvasRefs` from Phase 32)

**Out of scope (owned by later phases):**
- Drag-and-drop snippet/folder reorganization → Phase 34
- Inline F2 rename → Phase 34
- Context-menu "Move to…" folder picker → Phase 34
- `.md` snippets in the Protocol Runner picker → Phase 35
- Nested-folder snippet browsing in runner picker (already works via `listFolder(path)`; no new wiring this phase)

## Carrying Forward from Prior Phases

### Phase 32 (locked)
- **Path = identity (D-02):** snippets have no stable `id`; `snippet.path` is authoritative.
- **Discriminated union (D-01):** `Snippet = JsonSnippet | MdSnippet`; `kind` field routes behavior.
- **`SnippetService` path-based API:** `listFolder(folderPath)`, `load(path)`, `save(Snippet)`, `delete(path)`, `exists(path)`. All go through `assertInsideRoot` path-safety gate.
- **Delete = `vault.trash(file, false)`** (D-08) — Obsidian's `.trash/`, never permanent.
- **WriteMutex per-path** wraps every write and delete (D-11).
- **`canvas-ref-sync.ts` module exists** from Phase 32 (`rewriteCanvasRefs(app, Map<oldPath, newPath>) → CanvasSyncResult`). Module is foundation only; Phase 33 provides the **first wiring** (edit-modal «Папка» change). Drag-drop/rename wiring lands in Phase 34.
- **Legacy `SnippetManagerView` with id-based semantics** was patched during Phase 32 UAT (commit `358dbf7`) but is **deleted wholesale in this phase** (TREE-02).

### Phase 32 bug observed during UAT (carry-forward as cautionary note)
The legacy view's `handleSave`/`handleDelete` built on-disk path from `draft.id ?? draft.name`, which silently broke when the name was edited (since listFolder no longer sets `id`). Root cause: path derivation was not grounded in the authoritative `draft.path`. Phase 33's new code must use `snippet.path` / `draft.path` as the sole source of truth for on-disk location — never reconstruct a path from id+settings when the snippet was loaded from disk.

<decisions>
## Implementation Decisions

### D-01: Tree — custom DOM from scratch
Build the tree as a recursive DOM renderer in vanilla TypeScript, consistent with other RadiProtocol views (`runner-view`, `node-editor-view`). No third-party tree library, no dependency on Obsidian's file-explorer internals (undocumented, breaks on Obsidian updates).

### D-02: Expand/collapse state persisted in plugin settings
Persist the set of open folder paths in `data.json` (`settings.snippetTreeExpandedPaths: string[]`). Read on view open, update on expand/collapse, write through `plugin.saveSettings()`. Survives Obsidian reload and leaf close/reopen. Root snippet folder is implicitly always expanded.

### D-03: Type indicator = lucide icon
Use Obsidian's built-in lucide icons before the file name: `file-json` for JSON snippets, `file-text` for Markdown. Consistent with the rest of Obsidian UI. No text badge, no color-only indicator.

### D-04: Sort order = folders first, then files, both alphabetical
Inside each folder: folders in A–Z, then files in A–Z. Matches standard file-explorer mental model. Drag-to-reorder is explicitly Phase 34 scope.

### D-05: Unified SnippetEditorModal with mode flag
One class `SnippetEditorModal extends Modal` with a `mode: 'create' | 'edit'` parameter. Shared render of chip editor / textarea, shared save pipeline; differences limited to title copy ("Новый сниппет" vs "Редактирование: {name}") and the JSON/MD toggle availability (create only). Reduces duplication and keeps the editor in one place for Phase 34 additions.

### D-06: JSON↔MD toggle is create-only
On edit the toggle is disabled/hidden and the type is locked to what's on disk (by extension). Rationale: converting JSON to MD would need to serialize chip placeholders into textual content (lossy + ambiguous); converting MD to JSON would need to parse free text into placeholders (impossible without a schema). Users who want to convert delete the old and create anew.

### D-07: Modal layout = wide Obsidian Modal (~800px max-width)
Standard `Modal` subclass with `modalEl.style.maxWidth = '800px'` so the chip editor fits comfortably. Obsidian handles close-on-Esc, click-outside, and focus trap natively.

### D-08: Unsaved-changes guard = nested ConfirmModal
On Esc/close-button, if `hasUnsavedChanges === true`, open a nested `ConfirmModal` with "Discard / Cancel / Save" buttons. Consistent with rest of UI, keyboard navigable, survives accidental click-outside.

### D-09: «Папка» dropdown on edit = move-on-save + canvas-ref-sync
When the user changes the «Папка» value on an existing snippet and clicks Save, the save flow is:
1. `service.save(snippet)` at new path
2. `service.delete(oldPath)` (vault.trash)
3. `rewriteCanvasRefs(app, Map([[oldPath, newPath]]))` — uses the existing Phase 32 module
4. Show `Notice` summarizing canvas sync result (X canvases updated, Y skipped)

All four steps in the save pipeline, single WriteMutex-protected boundary. This is the first production wiring of `canvas-ref-sync` — Phase 34 adds the drag-drop and F2 call sites for the same helper. Phase 33 deliberately does not implement drag-drop / F2 / "Move to…" context menu — those stay in Phase 34 scope.

### D-10: Default folder on global "+ New" = snippetFolderPath root
Global header button always pre-fills «Папка» to the snippet folder root. Per-folder hover "+ New" (FOLDER-03) pre-fills to that specific folder. No "last used" memory state — keeps behavior predictable and testable.

### D-11: Filename derivation = slugifyLabel(name) + extension
Reuse the existing `slugifyLabel` from `snippet-model.ts` (already unit-tested, consistent with the legacy view before replacement). File extension comes from the type toggle (`.json` or `.md`). User does not see a separate filename field — filename is derived on save.

### D-12: Name/path collision = block save with inline error
On save, pre-flight `service.exists(candidatePath)`. If true, show inline error under the Name field ("Файл с таким именем уже существует в этой папке") and disable the Save button until the name changes. No auto-suffix, no overwrite-with-confirm. User resolves explicitly.

### D-13: Vault watcher = full re-list + debounced redraw
On `vault.on('create' | 'delete' | 'rename')` events:
1. Filter: only act if the affected path starts with `settings.snippetFolderPath + '/'` or equals the root (SYNC-02).
2. Schedule a debounced redraw (100–150ms window). Multiple events in the window collapse to one redraw.
3. Debounced redraw calls a new helper `buildTreeModel(root)` that recursively walks via `listFolder` and returns the tree data. Then re-renders the DOM, preserving expand-state from settings.
4. Cleanup: all three event refs unregistered in `onClose()` (SYNC-03).

Full re-list on redraw is intentionally simpler than surgical patching — given the snippet folder is bounded (dozens, not thousands of entries) and the debounce collapses bursts.

### D-14: Empty folders via `vault.createFolder`
Obsidian on desktop persists empty folders created via `vault.createFolder(path)` — `adapter.list` returns them in `folders[]`. No `.keep` sentinel files, no filtering logic. This matches TREE-04 without adding hidden state. (If future testing reveals the mobile platform loses empty folders, add a sentinel then — not now.)

### D-15: Folder delete confirm = list first ~10 + count
Recursively walk the folder to collect all contained files and subfolders. Confirm modal shows:
- Header: "Удалить папку {name}?"
- Body: up to 10 paths verbatim, then "…и ещё N элементов" if more
- Buttons: Delete / Cancel
On Delete, call `vault.trash(folder, false)` — Obsidian handles recursive trash in one operation (D-16). Single WriteMutex boundary.

### D-16: Folder delete IO = `vault.trash(folder, false)` recursive
Obsidian's `vault.trash` accepts a `TFolder` and moves the whole subtree to `.trash/` atomically. One call, one undoable operation, consistent with D-08 snippet delete. No per-file loop.

### D-17: SnippetService additions for folder ops
Add two new path-gated methods to `SnippetService`:
- `createFolder(path: string): Promise<void>` — `assertInsideRoot` + `ensureFolderPath` (idempotent)
- `deleteFolder(path: string): Promise<CanvasSyncResult | null>` — `assertInsideRoot` + collect descendants (for confirm list) + `vault.trash(folder, false)` + call `rewriteCanvasRefs` with a Map of every descendant's old path → null… **but** since the files are being deleted (not moved), canvas-sync is NOT called from deleteFolder. Canvas nodes that reference a deleted snippet remain in the canvas as broken refs — handled by the runner's existing missing-snippet path. Phase 34 will add "orphan cleanup" if needed.

Actually, refine D-17: `deleteFolder` returns `void`. Canvas-ref-sync is only invoked on **moves**, not deletes. Deleted snippets stay referenced in canvases until the user manually removes them — this matches the behavior the user already lives with (deleting a snippet from the legacy view doesn't touch canvas nodes either).

### D-18: Watcher filter = prefix match with `/` boundary
`file.path === root || file.path.startsWith(root + '/')`. The `/` boundary prevents matching sibling folders like `.radiprotocol-backup/` when root is `.radiprotocol`. Same pattern as `canvas-ref-sync.applyMapping` longest-prefix logic.

### Claude's Discretion (not pre-decided — planner picks)
- Exact debounce window (100 vs 150ms) — planner picks based on observed responsiveness.
- Lucide icon names for JSON vs MD (any sensible pair from the lucide catalog available in Obsidian).
- Modal max-width exact px (recommended ~800, adjustable).
- ConfirmModal button ordering (Discard/Cancel/Save vs Cancel/Discard/Save — whichever matches existing Obsidian convention).
- Per-folder hover button positioning (right-aligned in row, or overlay).
- Keyboard shortcuts within the tree (up/down, enter, space) — nice-to-have, not required.

</decisions>

## Canonical References

### Roadmap / requirements
- `.planning/ROADMAP.md` — Phase 33 definition (success criteria lines 104–109)
- `.planning/REQUIREMENTS.md` — TREE-01..04, MODAL-01..08, FOLDER-01..03, SYNC-01..03, DEL-02/03
- `.planning/phases/32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync/32-CONTEXT.md` — Path = identity, discriminated union, trash semantics
- `.planning/phases/32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync/32-UAT.md` — documents the id-vs-path bug pattern the new view must avoid

### Existing code to read/modify
- `src/snippets/snippet-service.ts` — extend with `createFolder` / `deleteFolder`
- `src/snippets/snippet-model.ts` — `Snippet`, `JsonSnippet`, `MdSnippet`, `slugifyLabel`
- `src/snippets/canvas-ref-sync.ts` — `rewriteCanvasRefs`, `CanvasSyncResult`
- `src/views/snippet-manager-view.ts` — **deleted** in this phase (TREE-02)
- `src/settings.ts` — add `snippetTreeExpandedPaths: string[]` with `[]` default
- `src/main.ts` — register new view class, ensure view-type unchanged (`SNIPPET_MANAGER_VIEW_TYPE`)
- `src/utils/vault-utils.ts` — `ensureFolderPath` (existing)
- `src/utils/write-mutex.ts` — `WriteMutex` (existing, already used via SnippetService)

### New files to create (tentative)
- `src/views/snippet-manager-view.ts` — rewritten as tree view (same filename, same view-type constant to preserve workspace layout)
- `src/views/snippet-editor-modal.ts` — create/edit modal
- `src/views/confirm-modal.ts` — generic confirm (may be co-located inside editor modal file if only used here)
- `src/styles/snippet-manager.css` — replace legacy master-detail rules with tree styles (append per CLAUDE.md "append-only per phase" for any carried selectors)

### Obsidian API
- `Modal` — `src/views/snippet-editor-modal.ts` base class
- `ItemView` — tree view base class (existing pattern)
- `vault.on('create' | 'delete' | 'rename')` — watcher registration, returns `EventRef`
- `vault.offref(ref)` — watcher teardown
- `vault.createFolder(path)` — empty folder creation
- `vault.trash(TFile | TFolder, false)` — delete to `.trash/`
- `vault.getAbstractFileByPath(path)` — resolve TFile/TFolder for trash
- `setIcon(el, name)` — lucide icon insertion

## Existing Code Insights

### Reusable Assets
- `snippetService.listFolder` / `load` / `save` / `delete` / `exists` — path-based, tested.
- `rewriteCanvasRefs(app, mapping)` — ready to call on «Папка» change.
- `slugifyLabel(name)` — filename derivation.
- `ensureFolderPath(vault, path)` — recursive parent creation (used in save today).
- `WriteMutex` — for new folder-level writes.
- Snippet chip editor UI (currently inside `snippet-manager-view.ts`) — **extract before deleting** the legacy view, move into the new modal. This is load-bearing per MODAL-06.

### Established Patterns
- Views extend `ItemView` (`runner-view.ts`, `node-editor-view.ts`).
- CSS per feature file under `src/styles/` (CLAUDE.md — append-only).
- Settings persisted via `plugin.loadSettings()` / `saveSettings()` with typed `RadiProtocolSettings` interface.
- Tests use in-memory mock vault + vitest; new folder ops should follow the `makeVault()` factory pattern from `snippet-service.test.ts`.

### Integration Points
- `main.ts` view registration — same `SNIPPET_MANAGER_VIEW_TYPE` constant to keep open layouts working after update.
- Protocol Runner snippet picker (`runner-view.ts`) — unchanged; calls `listFolder` which already returns the right shape. DEL-03 is satisfied transitively: picker re-lists on each open.
- No changes needed to `canvas-ref-sync.ts` — Phase 33 only adds a new caller.

## Specific Ideas

- **Test plan target:** parity tests for the rewritten view (render shape + tree interaction + watcher round-trip), plus new `SnippetService.createFolder` / `deleteFolder` unit tests in the existing snippet-service suite. Canvas-ref-sync on «Папка» move gets one end-to-end test using the existing multi-canvas fixtures.
- **Extraction first:** extract chip-editor + placeholder-chip rendering from the legacy `snippet-manager-view.ts` into a reusable helper (or directly into the new modal) **before** deleting the legacy view — otherwise the cleanest diff sequence is hard to land.
- **Phase 34 hand-off:** leaving a clean `moveSnippet(oldPath, newPath)` helper inside the new modal (or as a SnippetService method) that Phase 34 can reuse for drag-drop and F2 rename is worth a small refactor.

## Deferred Ideas (out of Phase 33)

- Drag-and-drop snippets and folders → Phase 34
- Inline F2 rename for files and folders → Phase 34
- "Move to…" context menu (folder picker) → Phase 34
- `.md` snippet insertion in the Runner → Phase 35
- Keyboard shortcuts inside the tree (arrow navigation, Enter-to-edit) — nice-to-have; add if planner has budget
- Orphan-cleanup of canvas nodes referencing a deleted snippet — currently leaves broken refs; not a regression, but future polish
- Tree virtualization for very large snippet folders (hundreds+) — not needed at current scale
