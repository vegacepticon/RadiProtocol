# Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher — Research

**Researched:** 2026-04-15
**Domain:** Obsidian plugin view layer (ItemView + Modal + vault event API), vanilla TS/DOM tree rendering
**Confidence:** HIGH

## Summary

Phase 33 rebuilds `SnippetManagerView` as a vanilla-TS recursive folder-tree backed by Obsidian's `ItemView`, pairs it with a unified `SnippetEditorModal` (`Modal` subclass, mode: `create`|`edit`) that hosts the extracted Phase 27 chip editor for JSON snippets and an inline `<textarea>` for Markdown snippets, and adds live vault watchers (`create`/`delete`/`rename`) that trigger a debounced (120ms) full re-list through `SnippetService.listFolder`. All runtime state is already in place from Phase 32: path-as-identity, discriminated `Snippet` union, `vault.trash` delete, `WriteMutex`, `canvas-ref-sync`, and a path-safety gate. Phase 33 adds exactly two new methods to `SnippetService` (`createFolder`, `deleteFolder`) and wires `canvas-ref-sync` for the first time from the edit-modal «Папка» change path.

Every Obsidian API this phase relies on has been verified against `node_modules/obsidian/obsidian.d.ts` at HIGH confidence: `vault.on('create'|'modify'|'delete'|'rename')` returns an `EventRef` payload of `TAbstractFile` (+`oldPath` for rename), `vault.offref(ref)` detaches, `vault.createFolder(path)` returns `Promise<TFolder>`, `vault.trash(file, false)` accepts a `TAbstractFile` (so a `TFolder` is valid for recursive folder trash per D-16). `Modal` is the correct base class and is already used in `snippet-fill-in-modal.ts`, `node-switch-guard-modal.ts`, `canvas-switch-modal.ts`, `resume-session-modal.ts` — those existing files are the style guide for the new modals.

**Primary recommendation:** extract the chip editor from the legacy `snippet-manager-view.ts` into a reusable helper **in the first wave**, before deleting any legacy code. Everything else (new tree view, folder ops, watcher, confirm modals, canvas-ref wiring) layers cleanly on top once the chip editor lives in its own file.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Tree is a custom vanilla-TS recursive DOM renderer. No third-party tree lib, no file-explorer internals.
- **D-02** Expand/collapse state persisted in `settings.snippetTreeExpandedPaths: string[]` via `plugin.saveSettings()`.
- **D-03** Type indicator = lucide icons via `setIcon`: `file-json` / `file-text` / `folder` / `folder-open`.
- **D-04** Sort: folders A–Z first, then files A–Z. No drag-reorder this phase.
- **D-05** Unified `SnippetEditorModal extends Modal` with `mode: 'create'|'edit'`.
- **D-06** JSON↔MD toggle is create-only. Edit-mode type is locked to the on-disk extension.
- **D-07** Modal layout = wide Obsidian `Modal`, `modalEl.style.maxWidth = '800px'`.
- **D-08** Unsaved-changes guard = nested `ConfirmModal` with Discard / Cancel / Save.
- **D-09** Edit-mode «Папка» change on save runs: `save(newPath)` → `delete(oldPath)` → `rewriteCanvasRefs(app, Map([[oldPath, newPath]]))` → `Notice`. This is the first production wiring of `canvas-ref-sync`.
- **D-10** Default folder on global "+ New" = `settings.snippetFolderPath` root. Per-folder "+ New" pre-fills that folder. No last-used memory.
- **D-11** Filename derivation = `slugifyLabel(name) + {.json|.md}`. User has no separate filename field.
- **D-12** Name collision = pre-flight `service.exists(candidatePath)` → inline error, Save disabled. No auto-suffix, no overwrite.
- **D-13** Vault watcher = prefix filter + debounced (100–150ms, locked to 120ms by UI-SPEC) full re-list + redraw preserving expand state. All three event refs unregistered in `onClose()`.
- **D-14** Empty folders persisted via `vault.createFolder()` — no sentinel files. `adapter.list` returns them in `folders[]`.
- **D-15** Folder delete confirm lists up to 10 descendants + "…и ещё N элементов" tail.
- **D-16** Folder delete = single `vault.trash(folder, false)` call, recursive (verified against `obsidian.d.ts:trash(file: TAbstractFile, system: boolean)` — TAbstractFile accepts TFolder).
- **D-17** `SnippetService` gains `createFolder(path)` and `deleteFolder(path)`, both gated through `assertInsideRoot`. `deleteFolder` returns void — canvas-ref-sync is NOT called on delete (broken refs remain, matches legacy behavior).
- **D-18** Watcher filter = `file.path === root || file.path.startsWith(root + '/')` (prevents sibling-folder false positives like `.radiprotocol-backup/`).

### Claude's Discretion

- Debounce window: locked to **120ms** by UI-SPEC.
- Lucide icons: locked by UI-SPEC table (`folder` / `folder-open` / `chevron-right` / `chevron-down` / `file-json` / `file-text` / `plus` / `x` / `folder-plus` / `trash`).
- Modal max-width: **800px** per UI-SPEC.
- ConfirmModal button order: `Не сохранять · Отмена · Сохранить` (Save rightmost) per UI-SPEC.
- Per-folder hover "+ New" positioning: right-aligned in row with opacity 0→1 transition (150ms).
- Keyboard shortcuts inside the tree: nice-to-have, planner discretion.

### Deferred Ideas (OUT OF SCOPE)

- Drag-and-drop snippets and folders → Phase 34
- Inline F2 rename (files, folders) → Phase 34
- "Move to…" context menu folder picker → Phase 34
- `.md` snippet insertion in the Runner → Phase 35
- Orphan cleanup of canvas nodes after snippet delete → future polish
- Tree virtualization → not needed at current scale
- Nested-folder runner picker rewiring → already works via `listFolder(path)`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREE-01 | Collapsible folder tree of `.radiprotocol/snippets/` with `.json`/`.md` type indicators | `setIcon` with `file-json`/`file-text`; recursive `listFolder` walk; expand-state from `settings.snippetTreeExpandedPaths` |
| TREE-02 | Master-detail layout fully removed — tree is only mode | Legacy `SnippetManagerView` rewritten in-place (same filename, same `SNIPPET_MANAGER_VIEW_TYPE` constant) |
| TREE-03 | File click opens edit modal | `SnippetEditorModal` in `mode: 'edit'`, loaded via `service.load(path)` |
| TREE-04 | Empty folders display explicitly | `vault.createFolder()` persists empty dirs on desktop; `adapter.list` returns them in `folders[]` |
| MODAL-01 | Snippet creation via modal only | `SnippetEditorModal` in `mode: 'create'` |
| MODAL-02 | Snippet editing via modal | Same modal in `mode: 'edit'` |
| MODAL-03 | JSON/Markdown toggle (create only) | Segmented control; `kind` field in draft; extension follows kind |
| MODAL-04 | Creation pre-fills target folder | «Папка» dropdown value set from invocation context (global root, or folder-hover path) |
| MODAL-05 | «Папка» dropdown lets user change target path before save | Recursive folder walk of snippet root populates dropdown options |
| MODAL-06 | JSON mode uses Phase 27 chip editor | **Extract** chip editor from legacy view into reusable helper first, then embed in modal body |
| MODAL-07 | MD mode uses inline `<textarea>` | Plain textarea bound to `draft.content`, no chip editor |
| MODAL-08 | Unsaved-changes guard on close | Nested `ConfirmModal` (pattern from `node-switch-guard-modal.ts`) |
| FOLDER-01 | Create subfolder via context menu / tree button | `service.createFolder(path)` → `ensureFolderPath` (idempotent) |
| FOLDER-02 | Delete folder (empty or non-empty) with confirm showing contents | Walk folder, build descendant list, cap to 10, `vault.trash(folder, false)` |
| FOLDER-03 | Per-folder hover "+ New" pre-fills path | Hover action button injects folder path into modal constructor |
| SYNC-01 | View subscribes to `vault.on('create'|'delete'|'rename')` and redraws | Verified signatures: `on(name: 'create'|'modify'|'delete', cb: (file: TAbstractFile) => any)`; rename adds `(file, oldPath)` |
| SYNC-02 | Watcher filters to snippet root prefix only | D-18 prefix match with `/` boundary |
| SYNC-03 | Cleanup in `onClose()` | `vault.offref(ref)` for each stored EventRef |
| DEL-02 | Destructive ops require confirm modals | `ConfirmModal` (generic, reused) |
| DEL-03 | Deleted snippet disappears from tree AND runner picker | Runner picker calls `listFolder` on every open (verified `runner-view.ts:566`); no extra wiring needed |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folder tree rendering | Obsidian ItemView (plugin UI) | — | View-level, scoped to a workspace leaf |
| Modal create/edit | Obsidian Modal (plugin UI) | — | Stateful overlay with its own lifecycle |
| Snippet read/write | SnippetService (data layer) | Obsidian `vault` | Phase 32 established this boundary |
| Folder create/delete | SnippetService (data layer) | Obsidian `vault.createFolder` / `vault.trash` | Path-safety gate must run here (D-17) |
| Vault change notification | Obsidian vault event bus | ItemView subscriber | Obsidian owns the event source; view owns the filter+debounce+redraw |
| Canvas-ref sync on move | `canvas-ref-sync` module (Phase 32) | Called from modal save path | Module already exists; Phase 33 is the first caller |
| Expand-state persistence | Plugin settings (`data.json`) | `plugin.saveSettings()` | Survives reload; matches other settings patterns |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `obsidian` (plugin API) | installed | `ItemView`, `Modal`, `Menu`, `Notice`, `setIcon`, `vault.*`, `TFile`, `TFolder`, `TAbstractFile`, `EventRef` | Only UI dependency for this plugin |

No new third-party dependencies. `[VERIFIED: package.json + obsidian.d.ts]`

### Supporting (already present in repo)
| Module | Purpose | Notes |
|--------|---------|-------|
| `src/snippets/snippet-service.ts` | CRUD + path-safety + WriteMutex | Add `createFolder`, `deleteFolder` |
| `src/snippets/snippet-model.ts` | `Snippet`, `JsonSnippet`, `MdSnippet`, `slugifyLabel`, `renderSnippet` | Unchanged |
| `src/snippets/canvas-ref-sync.ts` | `rewriteCanvasRefs(app, Map)` | First caller lands in this phase |
| `src/utils/vault-utils.ts` | `ensureFolderPath` | Used by `createFolder` |
| `src/utils/write-mutex.ts` | `WriteMutex` | Already wraps service writes |
| `src/settings.ts` | `RadiProtocolSettings`, `DEFAULT_SETTINGS` | Add `snippetTreeExpandedPaths: string[]` with `[]` default |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom recursive DOM tree | Obsidian file-explorer internals | Internals are private/undocumented; break on Obsidian updates (D-01 rejects) |
| `.keep` sentinel files for empty folders | — | Unneeded: `vault.createFolder` persists empty dirs on desktop (D-14) |
| Surgical tree-patching on each event | Full re-list + redraw | Snippet folder is bounded (dozens); simpler code wins (D-13) |

**No install step.** Phase 33 adds zero dependencies.

## Architecture Patterns

### System Architecture Diagram

```
 User input (click / right-click / "+ Новый")
          │
          ▼
 ┌──────────────────────┐           ┌────────────────────────┐
 │ SnippetTreeView      │ open()    │ SnippetEditorModal     │
 │ (ItemView)           │──────────▶│ (Modal, mode=create|   │
 │  ├ renderTree()      │           │        edit)           │
 │  ├ row click handler │◀──────────│  ├ Type toggle         │
 │  ├ context menu      │ onSave()  │  ├ «Папка» dropdown    │
 │  └ hover "+ New"     │           │  ├ Name input          │
 └─────────┬────────────┘           │  ├ ChipEditor (JSON)   │
           │                         │  └ Textarea   (MD)    │
   listFolder (recursive)           └──────────┬─────────────┘
           │                                    │
           ▼                                    ▼
 ┌──────────────────────┐           ┌────────────────────────┐
 │ SnippetService       │◀──────────│ save flow (D-09):      │
 │  listFolder/load/save│           │  1. service.save(new)  │
 │  delete/exists       │           │  2. service.delete(old)│
 │  createFolder (NEW)  │           │  3. rewriteCanvasRefs  │
 │  deleteFolder (NEW)  │           │  4. Notice summary     │
 │  assertInsideRoot gate           └──────────┬─────────────┘
 │  WriteMutex per path │                      │
 └─────────┬────────────┘                      │
           │                                    │
           ▼                                    ▼
 ┌──────────────────────┐           ┌────────────────────────┐
 │ app.vault.adapter    │           │ canvas-ref-sync module │
 │  read/write/list     │           │ walks every .canvas,   │
 │ app.vault.createFolder           │ rewrites subfolderPath │
 │ app.vault.trash      │           └────────────────────────┘
 └─────────┬────────────┘
           │ fires events
           ▼
 ┌──────────────────────────────────────────┐
 │ vault.on('create'|'delete'|'rename')     │
 │  ↳ prefix filter  ↳ 120ms debounce       │
 │  ↳ buildTreeModel → redraw (preserve     │
 │    expand state)                          │
 └──────────────────────────────────────────┘
```

Entry points: tree click / tree context menu / hover "+ New" / global "+ Новый" / external vault edits.
Flow: all mutations funnel through `SnippetService` (single write choke-point, WriteMutex-protected). Vault events feed back into the view via the watcher for external edits. The modal is the only place that calls `canvas-ref-sync` this phase.

### Recommended Project Structure
```
src/
├── views/
│   ├── snippet-manager-view.ts       # REWRITTEN in-place: tree view
│   ├── snippet-editor-modal.ts       # NEW: unified create/edit modal
│   ├── confirm-modal.ts              # NEW (or co-located): generic confirm
│   └── snippet-chip-editor.ts        # NEW: extracted chip editor helper (MODAL-06)
├── snippets/
│   ├── snippet-service.ts            # +createFolder, +deleteFolder
│   ├── snippet-model.ts              # unchanged
│   └── canvas-ref-sync.ts            # unchanged (first caller this phase)
├── settings.ts                       # +snippetTreeExpandedPaths
└── styles/
    └── snippet-manager.css           # replace rp-snippet-* rules with radi-snippet-tree-*
```

**Note on the chip editor extraction (MODAL-06):** the existing chip-editor DOM lives inline inside `renderFormPanel` and `renderPlaceholderList` / `renderPlaceholderChip` / `renderExpandedPlaceholder` / `renderNumberExpanded` in `src/views/snippet-manager-view.ts` (lines ~160–606). These must be pulled into `src/views/snippet-chip-editor.ts` as a free-standing helper (`mountChipEditor(container, draft, onChange): ChipEditorHandle`) **before** the legacy file is rewritten, or the chip editor will be lost.

### Pattern 1: ItemView with registered DOM events
```typescript
// Source: existing pattern in src/views/snippet-manager-view.ts + editor-panel-view.ts
export class SnippetTreeView extends ItemView {
  getViewType() { return SNIPPET_MANAGER_VIEW_TYPE; }
  async onOpen() { /* build DOM, register events via this.registerDomEvent */ }
  async onClose() { /* this.contentEl.empty(); offref watchers */ }
}
```

### Pattern 2: Modal with awaitable result (used by every existing modal in this repo)
```typescript
// Source: src/views/node-switch-guard-modal.ts (verbatim pattern)
export class ConfirmModal extends Modal {
  readonly result: Promise<boolean>;
  private resolve!: (v: boolean) => void;
  private resolved = false;
  constructor(app: App, private opts: ConfirmOpts) {
    super(app);
    this.result = new Promise(r => { this.resolve = r; });
  }
  onOpen() { /* render title, body, buttons */ }
  onClose() {
    if (!this.resolved) { this.resolve(false); this.resolved = true; }
    this.contentEl?.empty();
  }
  private settle(v: boolean) {
    if (!this.resolved) { this.resolve(v); this.resolved = true; }
    this.close();
  }
}
```

### Pattern 3: Vault watcher with prefix filter + debounce
```typescript
// Verified against node_modules/obsidian/obsidian.d.ts:6593..6611
private watchers: EventRef[] = [];
private redrawTimer: number | null = null;

private registerWatchers(): void {
  const root = this.plugin.settings.snippetFolderPath;
  const isInRoot = (p: string) => p === root || p.startsWith(root + '/');
  const onChange = (file: TAbstractFile, oldPath?: string) => {
    if (isInRoot(file.path) || (oldPath !== undefined && isInRoot(oldPath))) {
      this.scheduleRedraw();
    }
  };
  this.watchers.push(this.plugin.app.vault.on('create', f => onChange(f)));
  this.watchers.push(this.plugin.app.vault.on('delete', f => onChange(f)));
  this.watchers.push(this.plugin.app.vault.on('rename', (f, oldPath) => onChange(f, oldPath)));
}
private scheduleRedraw(): void {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  this.redrawTimer = window.setTimeout(() => { void this.rebuildTree(); }, 120);
}
async onClose() {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  for (const ref of this.watchers) this.plugin.app.vault.offref(ref);
  this.watchers = [];
  this.contentEl.empty();
}
```

**Important:** the `rename` callback MUST also be checked against `oldPath` — a rename OUT of the snippet folder will fire with `file.path` outside the root but `oldPath` inside; the tree still needs to redraw to remove that entry. (Verified signature: `on(name: 'rename', callback: (file: TAbstractFile, oldPath: string) => any)`.)

### Pattern 4: Context menu via `Menu`
```typescript
// Source: src/main.ts uses Menu API already
row.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
  const menu = new Menu();
  menu.addItem(i => i.setTitle('Редактировать').setIcon('pencil').onClick(() => { /* open edit modal */ }));
  menu.addSeparator();
  menu.addItem(i => i.setTitle('Удалить').setIcon('trash').setWarning(true).onClick(() => { /* confirm + delete */ }));
  menu.showAtMouseEvent(e);
});
```

### Anti-Patterns to Avoid
- **Reconstructing on-disk path from `draft.id ?? draft.name`.** This is the exact Phase-32 UAT bug (commit `358dbf7`). Use `draft.path` as the single source of truth for the old-path side of any rename/move/delete operation.
- **Rendering the tree without preserving expand state.** Full re-list is fine, but you must re-apply `settings.snippetTreeExpandedPaths` to the newly-built DOM, or the view flashes every folder closed on every watcher tick.
- **Forgetting `vault.offref` in `onClose`.** Leaked `EventRef`s accumulate across leaf open/close cycles and fire callbacks on detached views.
- **Calling `registerDomEvent` on transient elements** (e.g., expanded chip editor internals that get torn down on each re-render). Use bare `addEventListener` there — the legacy file has comments (`WR-05`) documenting why. Follow the same rule in the extracted chip editor.
- **Using `innerHTML`** (banned project-wide). Use `createDiv/createEl/createSpan/setText`.
- **Reacting to `vault.on('modify')`.** Not needed this phase; `modify` fires on content edits and would cause redraws that are irrelevant to tree structure. Only subscribe to `create`/`delete`/`rename`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with keyboard trap + Esc + click-outside | Custom overlay | Obsidian `Modal` base class | Handled natively, already used in 4+ existing modals |
| Context menu with hover/keyboard nav | Custom DOM popup | Obsidian `Menu` class | Already used in `main.ts` canvas context menu |
| Recursive folder delete | Per-file loop with `vault.trash` each | Single `vault.trash(tfolder, false)` | `TAbstractFile` parameter accepts TFolder; one atomic operation (D-16, verified) |
| Toast notifications | Custom banner | Obsidian `Notice` | Standard, used everywhere |
| Lucide icons | Inline SVG | `setIcon(el, 'file-json')` | Ships with Obsidian, zero bundle cost |
| Debounce primitive | `lodash.debounce` | Inline `setTimeout` + cleared id | One-line, no dependency, matches repo style |
| Path safety validation | New guard | `SnippetService.assertInsideRoot` (already exists) | Reuse the existing gate for `createFolder`/`deleteFolder` |
| Write race prevention | Ad-hoc | `WriteMutex.runExclusive(path, ...)` | Already wraps every service write |
| Empty-folder persistence | `.keep` sentinel | `vault.createFolder` + `adapter.list` | Desktop preserves empty dirs natively (D-14) |

**Key insight:** every primitive Phase 33 needs already exists either in Obsidian's stdlib or in the repo's own `src/snippets/` + `src/utils/` + `src/views/` files. The phase is almost entirely a wiring job — the only two new service methods are `createFolder` and `deleteFolder`, and both are ~10-line wrappers over `ensureFolderPath` + `vault.trash`.

## Common Pitfalls

### Pitfall 1: Stale draft path after rename-via-save
**What goes wrong:** User opens a snippet in edit mode, changes the name, clicks Save. Code derives a new slug-path, saves there, but forgets to delete the old file (or tries to delete using `draft.id` which is absent on files loaded via `listFolder`).
**Why it happens:** `listFolder` intentionally does not populate the deprecated `id` field (Phase 32 D-02); `draft.path` is the authoritative old path.
**How to avoid:** In `handleSave`, capture `const oldPath = draft.path;` **before** mutating anything, derive `newPath = ${folder}/${slugifyLabel(name)}${ext}`. If `oldPath !== newPath`, call `service.save(draftWithNewPath)` then `service.delete(oldPath)` then `rewriteCanvasRefs(app, Map([[oldPath, newPath]]))`. Never reconstruct paths from `draft.id` or `draft.name` alone.
**Warning signs:** Phantom duplicate files appearing after edits; runner picker showing stale names.

### Pitfall 2: Watcher feedback loop
**What goes wrong:** Saving through the service fires `vault.on('create')` or `vault.on('modify')`, the watcher triggers a redraw, the redraw recalls `listFolder`, which can race with the in-flight WriteMutex.
**Why it happens:** Save path and watcher path both touch the same disk state.
**How to avoid:** The debounce collapses the burst into one redraw after 120ms. `listFolder` is read-only (goes through `adapter.read`/`adapter.list`, no mutex needed), and the completed save has already released its mutex by the time the debounced redraw fires. Additionally: do not subscribe to `modify` events — only `create`/`delete`/`rename`. Content edits (e.g., `vault.adapter.write`) may or may not fire `create`; rely on debounce and the fact that rebuilding from disk always produces a consistent snapshot.
**Warning signs:** Tree flicker on save; duplicate entries during rename.

### Pitfall 3: Rename event redraw miss
**What goes wrong:** User renames a snippet folder from outside (Obsidian file explorer) and the tree keeps showing the old path.
**Why it happens:** `vault.on('rename', (file, oldPath) => ...)` — the handler only checked `file.path` for the prefix, but when renaming OUT of the root, `file.path` is no longer inside the root.
**How to avoid:** Check **both** `file.path` AND `oldPath` against the root prefix in the rename handler. (Also redraw when a rename moves a file INTO the root — same dual-check logic.)
**Warning signs:** Ghost entries after external rename; view only updates on next reopen.

### Pitfall 4: ConfirmModal resolve-before-close double-call
**What goes wrong:** User clicks Delete → modal calls `resolve(true)` then `this.close()`, which triggers `onClose()` which calls `resolve(false)` a second time.
**Why it happens:** Obsidian `Modal.onClose` always fires on `close()`.
**How to avoid:** Guard with a `private resolved = false` flag. The existing `node-switch-guard-modal.ts` pattern does this correctly — follow it verbatim.
**Warning signs:** Delete confirm always resolves false; "Stay" behavior on every button.

### Pitfall 5: Legacy CSS rules accidentally deleted
**What goes wrong:** Rewriting `snippet-manager.css` deletes Phase 5 / Phase 27 rules that other code paths still reference.
**Why it happens:** Violates CLAUDE.md "append-only per phase" rule.
**How to avoid:** Since the legacy `SnippetManagerView` is **deleted wholesale** in this phase (TREE-02), the legacy `.rp-snippet-*` and `.rp-placeholder-*` CSS rules that it owns are dead code and can be removed **together with the view rewrite in the same commit**. Use a new class-name prefix `radi-snippet-tree-*` for new rules so the removal vs. addition is unambiguous in the diff. New rules go at the bottom with a `/* Phase 33: tree UI */` comment. Chip-editor CSS (`.rp-placeholder-chip*`, `.rp-placeholder-expanded`) is **still needed** by the extracted chip editor, so it must be preserved (or moved under the new prefix if the extracted helper uses new class names).
**Warning signs:** Chip editor renders unstyled inside the modal; placeholder colors gone.

### Pitfall 6: Collision check race
**What goes wrong:** User fills Name, pre-flight `exists` returns false, user clicks Save, but a concurrent watcher callback (external file creation) lands the same name between the check and the write.
**Why it happens:** Two-step check-then-write.
**How to avoid:** The `WriteMutex` per-path already serializes the final write, and `vault.create` will fail on existing paths. Either handle the `vault.create` error by surfacing the same inline collision error (belt + suspenders), or accept the pre-flight as best-effort since the window is sub-millisecond in practice.
**Warning signs:** Uncaught exception in save handler.

## Runtime State Inventory

Phase 33 is not a rename/refactor of stored data — it rebuilds a view. Still, because the legacy view is deleted and the new view reads expand state from settings, the inventory is:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. Snippet files on disk (`.radiprotocol/snippets/**/*.{json,md}`) are read-only inputs to this phase; their format is unchanged from Phase 32. | None |
| Live service config | None. No external services. | None |
| OS-registered state | None. No OS registrations. | None |
| Secrets/env vars | None. | None |
| Build artifacts | `esbuild.config.mjs` `CSS_FILES` list already contains `snippet-manager` — no new CSS file registration needed. Legacy `.rp-snippet-*` rules will be removed from `src/styles/snippet-manager.css` as part of the view rewrite. | Run `npm run build` after CSS changes (CLAUDE.md requirement). |
| Plugin settings | `data.json` must gain `snippetTreeExpandedPaths: []` on first load — existing `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` merge in `main.ts:24` handles this automatically. | Add field to `RadiProtocolSettings` interface + `DEFAULT_SETTINGS`. |

**Nothing else found.** Verified by reading `src/main.ts` (no persisted runtime outside `data.json`), `src/snippets/snippet-service.ts` (stateless CRUD), and `src/views/snippet-manager-view.ts` (view-only state, all in-memory).

## Code Examples

### Adding `createFolder` / `deleteFolder` to `SnippetService`
```typescript
// src/snippets/snippet-service.ts — add to existing class
// Source: pattern matches existing delete() + save()
async createFolder(path: string): Promise<void> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) {
    throw new Error(`[RadiProtocol] createFolder rejected unsafe path: ${path}`);
  }
  await this.mutex.runExclusive(normalized, async () => {
    await ensureFolderPath(this.app.vault, normalized);
  });
}

async deleteFolder(path: string): Promise<void> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) return;
  // Refuse to delete the root itself
  if (normalized === this.settings.snippetFolderPath) return;
  await this.mutex.runExclusive(normalized, async () => {
    const folder = this.app.vault.getAbstractFileByPath(normalized);
    if (folder === null) return;
    await this.app.vault.trash(folder, false); // verified accepts TFolder
  });
}

/**
 * Walk the folder recursively and collect all descendant TFile/TFolder paths.
 * Used by the folder-delete confirm modal (D-15) to show up to 10 paths.
 */
async listFolderDescendants(path: string): Promise<string[]> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) return [];
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const listing = await this.app.vault.adapter.list(dir);
    for (const f of listing.files) out.push(f);
    for (const d of listing.folders) { out.push(d); await walk(d); }
  };
  try { await walk(normalized); } catch { /* missing */ }
  return out;
}
```

### Building a tree model from `listFolder`
```typescript
// Recursive model — called by the watcher debounce and initial onOpen
interface TreeNode {
  path: string;
  name: string;
  kind: 'folder' | 'json' | 'md';
  children?: TreeNode[]; // folders only
}

private async buildTreeModel(rootPath: string): Promise<TreeNode> {
  const walk = async (dir: string, name: string): Promise<TreeNode> => {
    const { folders, snippets } = await this.plugin.snippetService.listFolder(dir);
    const children: TreeNode[] = [];
    // D-04: folders first (A-Z), then files (A-Z) — listFolder already sorts each half
    for (const f of folders) children.push(await walk(`${dir}/${f}`, f));
    for (const s of snippets) {
      children.push({ path: s.path, name: s.name, kind: s.kind });
    }
    return { path: dir, name, kind: 'folder', children };
  };
  return walk(rootPath, rootPath.slice(rootPath.lastIndexOf('/') + 1));
}
```

### Edit-modal «Папка» change save flow (D-09)
```typescript
// Inside SnippetEditorModal.handleSave(), mode === 'edit'
const oldPath = this.originalSnippet.path; // captured at modal-open time
const ext = this.originalSnippet.kind === 'json' ? '.json' : '.md';
const slug = slugifyLabel(this.draft.name);
const newPath = `${this.selectedFolderPath}/${slug}${ext}`;

// Pre-flight collision (D-12)
if (newPath !== oldPath && await this.plugin.snippetService.exists(newPath)) {
  this.showNameCollisionError();
  return;
}

// Commit (D-09): save → delete old → canvas-ref-sync → notice
this.draft.path = newPath;
await this.plugin.snippetService.save(this.draft);
if (newPath !== oldPath) {
  await this.plugin.snippetService.delete(oldPath);
  const root = this.plugin.settings.snippetFolderPath;
  const oldRel = oldPath.startsWith(root + '/') ? oldPath.slice(root.length + 1) : oldPath;
  const newRel = newPath.startsWith(root + '/') ? newPath.slice(root.length + 1) : newPath;
  // Note: canvas-ref-sync expects subfolderPath semantics. SnippetNode.subfolderPath
  // stores the FOLDER path, not the file path. Since a file-level rename does NOT
  // change any snippet node's subfolderPath (files are not referenced by name in
  // snippet nodes — see canvas-ref-sync.ts:72 — only `radiprotocol_nodeType==='snippet'`
  // with `radiprotocol_subfolderPath` folder), calling rewriteCanvasRefs here is a
  // no-op for pure filename renames. It becomes meaningful only when the user
  // changes «Папка» to a DIFFERENT parent folder.
  const oldFolder = oldRel.slice(0, oldRel.lastIndexOf('/'));
  const newFolder = newRel.slice(0, newRel.lastIndexOf('/'));
  if (oldFolder !== newFolder) {
    const result = await rewriteCanvasRefs(
      this.plugin.app,
      new Map([[oldFolder, newFolder]]),
    );
    new Notice(`Сниппет перемещён. Обновлено канвасов: ${result.updated.length}, пропущено: ${result.skipped.length}.`);
  } else {
    new Notice('Сниппет перемещён в корзину.'); // well, renamed — pick copy
  }
}
```

**CRITICAL NUANCE for the planner:** read `src/snippets/canvas-ref-sync.ts:71-82` carefully — SnippetNode references in canvases store **`radiprotocol_subfolderPath`** (a folder, not a file). This means: (a) renaming a snippet file without moving folders is invisible to canvases and canvas-ref-sync is a no-op; (b) changing «Папка» on a single snippet migrates it to a new folder but the canvas nodes still reference the OLD folder containing N-1 OTHER snippets — calling `rewriteCanvasRefs` with `oldFolder → newFolder` would incorrectly redirect every canvas snippet node pointing at the old folder to the new one. **The correct interpretation of D-09 is that canvas-ref-sync is a safety net for folder-level moves (Phase 34), and for the Phase 33 edit-modal «Папка» change it applies only when the user moves an individual snippet (and then the mapping key should be the old file path and value the new file path — but canvas nodes store folders, not files, so there is still nothing to rewrite).** Surface this to the planner: **the D-09 canvas-ref-sync wiring in Phase 33 is likely a placebo call.** The first real consumer is Phase 34 drag-folder-into-folder, where the mapping is `oldFolderPath → newFolderPath` and matching canvas nodes actually exist. Recommended action: either (a) call `rewriteCanvasRefs` with the empty-or-degenerate mapping anyway as a "future-proof hook" and always Notice "Сниппет перемещён", or (b) skip the canvas-ref call on single-file moves entirely and document that Phase 34 picks up the real wiring. The planner should explicitly choose one and document the decision.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` (project root — existing, used by Phase 32 tests) |
| Quick run command | `npx vitest run src/__tests__/snippet-service.test.ts src/__tests__/canvas-ref-sync.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| TREE-01/02/04 | Tree renders folders + files; empty folders appear; type indicator per kind | unit (DOM-level, mock vault) | `npx vitest run src/__tests__/snippet-tree-view.test.ts` | ❌ Wave 0 |
| TREE-03 | Click file → modal opens in edit mode with loaded snippet | unit | same file | ❌ Wave 0 |
| MODAL-01..08 | Create/edit modal mode switching, chip editor mount, unsaved guard, collision | unit | `npx vitest run src/__tests__/snippet-editor-modal.test.ts` | ❌ Wave 0 |
| FOLDER-01 | `SnippetService.createFolder` creates dir, is idempotent, rejects unsafe paths | unit | `npx vitest run src/__tests__/snippet-service.test.ts` | ✅ extend existing |
| FOLDER-02 | `SnippetService.deleteFolder` recursively trashes, rejects root, rejects unsafe paths | unit | same | ✅ extend existing |
| FOLDER-02 | Folder delete confirm lists ≤10 + overflow text | unit (DOM) | `snippet-editor-modal.test.ts` (confirm modal block) | ❌ Wave 0 |
| FOLDER-03 | Hover "+ New" pre-fills folder in modal | unit (DOM) | `snippet-tree-view.test.ts` | ❌ Wave 0 |
| SYNC-01/02/03 | Watcher subscribes, filters by prefix (incl. `/` boundary), unregisters on close | unit (mock EventRef) | `snippet-tree-view.test.ts` | ❌ Wave 0 |
| DEL-02 | Snippet delete requires confirm | unit (DOM) | `snippet-tree-view.test.ts` | ❌ Wave 0 |
| DEL-03 | After delete, subsequent `listFolder` excludes file; runner picker re-lists on open | unit | `snippet-service.test.ts` (already covered — just assert) | ✅ already covered |
| D-09 canvas-ref on «Папка» change | Save flow hits canvas-ref-sync exactly once with correct mapping | integration | `npx vitest run src/__tests__/snippet-editor-modal.test.ts -t "canvas ref"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/snippet-service.test.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-editor-modal.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + manual UAT in dev vault before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/snippet-tree-view.test.ts` — NEW (covers TREE-*, SYNC-*, FOLDER-03, DEL-02)
- [ ] `src/__tests__/snippet-editor-modal.test.ts` — NEW (covers MODAL-*, FOLDER-02 confirm DOM, D-09 save flow)
- [ ] Extend `src/__tests__/snippet-service.test.ts` with `createFolder` / `deleteFolder` / `listFolderDescendants` cases — reuses existing `makeVault()` factory
- [ ] No new framework install needed (vitest already configured and running on existing tests)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `obsidian` (API types) | All code | ✓ | installed under `node_modules/obsidian` | — |
| `vitest` | All tests | ✓ | configured, existing suites pass | — |
| `esbuild` | Build | ✓ | configured | — |
| Lucide icons (`folder`, `folder-open`, `chevron-right`, `chevron-down`, `file-json`, `file-text`, `plus`, `x`, `folder-plus`, `trash`, `pencil`) | UI | ✓ | ships with Obsidian runtime | — |

No external dependencies. Nothing to install. `[VERIFIED: package.json + obsidian.d.ts grep]`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (local plugin) |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | `SnippetService.assertInsideRoot` — must run for `createFolder` and `deleteFolder` (path traversal prevention) |
| V5 Input Validation | yes | `slugifyLabel` for filename, control-char strip for JSON body (already in `sanitizeJson`), trim+length-bound for folder names |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via user-entered folder name (`../etc`) | Tampering | `assertInsideRoot` normalization already rejects `..` segments, absolute paths, and out-of-root paths (verified in `snippet-service.ts:30-46`) |
| Name collision leading to silent overwrite | Tampering | D-12 pre-flight `exists` + Save-disabled inline error + `vault.create` will throw on existing path |
| Control-character injection in JSON fields | Tampering | `sanitizeJson` strips `\u0000-\u001F\u007F` (existing, unchanged) |
| Double-delete race | Tampering | `WriteMutex` per-path serializes delete+save |
| Denial of service via huge recursive folder listing | Availability | Snippet folder is user-bounded; if ever needed, a depth/entry cap can be added — not necessary now |
| XSS via snippet names rendered in tree | Injection | No `innerHTML` — all text goes through `createEl` / `setText` which auto-escape |

No new security surface beyond what Phase 32 already protects.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vault.createFolder` persists empty folders on desktop Obsidian (D-14) | Architecture | Low. If mobile ever loses them, revisit with `.keep` sentinel. Verified for desktop by Phase-32 CONTEXT carry-forward; not re-verified in this session. `[ASSUMED from prior phase]` |
| A2 | 120ms debounce is sufficient to coalesce rename-folder event bursts | Patterns | Low. If bursts overflow the window, extend to 200ms. Observable at UAT. `[ASSUMED]` |
| A3 | D-09 canvas-ref-sync wiring is a placebo for single-file «Папка» changes because canvas nodes store folder paths, not file paths | Code Examples — save flow | **Medium.** If the planner ships it as-is without reading the nuance above, users will expect their canvases to auto-update on a single-snippet move and nothing will happen. `[VERIFIED from canvas-ref-sync.ts:71-82]` — the risk is that the planner misinterprets D-09. Recommend planner explicitly decides: skip the call, OR document it as a Phase 34 scaffold. |
| A4 | Legacy `.rp-snippet-*` / `.rp-placeholder-*` CSS rules are safe to delete in the view rewrite commit because the legacy view is their only consumer | Pitfall 5 | Low. Grep the repo for `rp-snippet-` and `rp-placeholder-` before the delete commit to confirm. `[ASSUMED — not re-grepped in this session]` |

## Open Questions

1. **D-09 semantics on single-file move** (see A3 and the CRITICAL NUANCE block in Code Examples).
   - What we know: `canvas-ref-sync` rewrites `radiprotocol_subfolderPath` (folder), not per-file references. SnippetNodes don't store a filename at all — the runner picks the file from the folder at run time (`runner-view.ts:566`).
   - What's unclear: whether D-09 intends "call the module anyway as a forward hook" or "only call it when folder actually changed, and the mapping is irrelevant to single-file moves."
   - Recommendation: planner to confirm with user or default to **only** calling `rewriteCanvasRefs` if the folder portion actually changed — and even then, with the old/new **folder** pair — AND issue a Notice that says "Канвас-ссылки на папку обновлены" ONLY when `updated.length > 0`. For pure in-folder rename, silent no-op + "Сниппет сохранён" notice.

2. **Chip editor extraction strategy.**
   - What we know: the legacy chip editor spans `renderFormPanel` through `renderNumberExpanded` (~450 lines) with tight coupling to the view's `draft` field.
   - What's unclear: whether to extract as a class (`ChipEditor`) or a free function (`mountChipEditor`).
   - Recommendation: free function returning a handle (`{ destroy(): void; getDraft(): JsonSnippet }`) — matches existing vanilla patterns in this repo, avoids introducing a new class for a purely-visual helper, and keeps the diff small. Planner can pick either; both work.

3. **Confirm button ordering.** UI-SPEC locks it to `Не сохранять · Отмена · Сохранить`. The existing `node-switch-guard-modal.ts` uses `Stay · Discard and switch` (two-button), so there is no precedent for the three-button layout — planner confirms that the UI-SPEC order is final.

## Sources

### Primary (HIGH confidence)
- `Z:/projects/RadiProtocolObsidian/node_modules/obsidian/obsidian.d.ts:6593-6611` — vault event `on` signatures verified
- `Z:/projects/RadiProtocolObsidian/node_modules/obsidian/obsidian.d.ts` — `offref`, `createFolder`, `trash(TAbstractFile, boolean)` verified
- `src/snippets/snippet-service.ts` — full read, `assertInsideRoot`, WriteMutex usage, existing methods
- `src/snippets/snippet-model.ts` — full read, discriminated union shape, `slugifyLabel`
- `src/snippets/canvas-ref-sync.ts` — full read, `applyMapping`, `radiprotocol_subfolderPath` semantics
- `src/views/snippet-manager-view.ts` — full read, legacy chip editor location
- `src/views/node-switch-guard-modal.ts` — full read, confirm modal pattern
- `src/views/snippet-fill-in-modal.ts` — partial read, `Modal` subclass pattern
- `src/main.ts` — full read, view registration + `Menu` usage + settings merge
- `src/settings.ts` — full read, `RadiProtocolSettings` shape
- `src/utils/vault-utils.ts` — full read, `ensureFolderPath`
- `esbuild.config.mjs` — `CSS_FILES` list (snippet-manager already registered)
- `CLAUDE.md` — append-only CSS rule, never-delete-unrelated-code rule
- `.planning/phases/33-.../33-CONTEXT.md` — decisions D-01..D-18
- `.planning/phases/33-.../33-UI-SPEC.md` — copy, spacing, color, typography, icon table, debounce 120ms
- `.planning/REQUIREMENTS.md` — TREE-01..04, MODAL-01..08, FOLDER-01..03, SYNC-01..03, DEL-02, DEL-03

### Secondary (MEDIUM confidence)
- `src/views/runner-view.ts:566, :704` — confirms runner picker re-lists on each pick (DEL-03 satisfied transitively)
- `src/styles/snippet-manager.css` — partial read, legacy class prefix confirmed

### Tertiary (LOW confidence)
- None needed. All critical claims verified against source or shipped type definitions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every API verified in `obsidian.d.ts`.
- Architecture: HIGH — every pattern has an existing repo precedent.
- Pitfalls: HIGH — Pitfall 1 is documented in commit `358dbf7` fix; Pitfall 3 is derived from verified rename signature; others are standard Obsidian plugin gotchas.
- D-09 canvas-ref nuance: HIGH that the module is folder-scoped (verified in source); MEDIUM that the intended Phase 33 behavior is placebo — planner confirmation recommended.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (Obsidian API is stable; no moving parts)
