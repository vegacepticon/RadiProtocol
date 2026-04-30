# Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher — Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 8 (1 rewrite + 4 new + 3 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/snippet-manager-view.ts` (REWRITE) | ItemView / tree renderer | event-driven + request-response | `src/views/runner-view.ts` (vault event wiring) + `src/views/editor-panel-view.ts` (ItemView + registerDomEvent) + legacy `src/views/snippet-manager-view.ts` (extraction source only) | exact role / same data flow |
| `src/views/snippet-editor-modal.ts` (NEW) | Obsidian Modal | request-response (Promise<Result>) | `src/views/snippet-fill-in-modal.ts` | exact |
| `src/views/confirm-modal.ts` (NEW) | Obsidian Modal | request-response (Promise<boolean>) | `src/views/node-switch-guard-modal.ts` | exact |
| `src/views/snippet-chip-editor.ts` (NEW — extraction helper) | DOM helper / UI fragment | transform (draft in, draft mutation out) | legacy `src/views/snippet-manager-view.ts` lines 160–606 | extraction (same code, new home) |
| `src/snippets/snippet-service.ts` (EXTEND) | service / data-layer | CRUD + file-I/O | self — existing `save` / `delete` methods | exact (self-extension) |
| `src/settings.ts` (EXTEND) | config | transform | self — existing `snippetFolderPath` field | exact (self-extension) |
| `src/main.ts` (MODIFY) | plugin registration | wiring | self — existing `registerView` call for `SNIPPET_MANAGER_VIEW_TYPE` | exact (self-extension, no behavior change) |
| `src/styles/snippet-manager.css` (REPLACE rules) | CSS (feature file) | — | self — per CLAUDE.md append-only | self |
| `esbuild.config.mjs` (NO CHANGE expected) | build config | — | existing `CSS_FILES` array | no-op — reuses existing `snippet-manager` entry |
| `src/__tests__/snippet-service.test.ts` (EXTEND) | test | test | self — existing `makeVault` factory | exact (self-extension) |

**Note on esbuild.config.mjs:** Phase 33 reuses the existing `snippet-manager.css` feature file (the tree replaces the master-detail UI within the same feature), so **no CSS_FILES edit is required**. If the planner decides to split the tree styles into a separate file (e.g. `snippet-tree.css`), it must add that entry to `CSS_FILES` — see pattern at `esbuild.config.mjs:31-38`.

## Pattern Assignments

### `src/views/snippet-manager-view.ts` (REWRITE — ItemView tree)

**Primary analog:** `src/views/editor-panel-view.ts` (ItemView lifecycle + registerEvent) and `src/views/runner-view.ts` (vault.on wiring).

**ItemView skeleton pattern** — `src/views/editor-panel-view.ts:8-51`:
```typescript
export const EDITOR_PANEL_VIEW_TYPE = 'radiprotocol-editor-panel';

export class EditorPanelView extends ItemView {
  private plugin: RadiProtocolPlugin;
  // ... state fields ...

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return EDITOR_PANEL_VIEW_TYPE; }
  getDisplayText(): string { return 'RadiProtocol node editor'; }
  getIcon(): string { return 'pencil'; }

  async onOpen(): Promise<void> {
    this.renderIdle();
    this.attachCanvasListener();
    this.registerEvent(/* ... */);
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
```

**IMPORTANT:** keep the existing constant `SNIPPET_MANAGER_VIEW_TYPE = 'radiprotocol-snippet-manager'` (legacy `src/views/snippet-manager-view.ts:7`) unchanged so `main.ts:62` registration and `main.ts:161-165` leaf-open logic keep working with zero changes to `main.ts`.

**Vault watcher pattern (SYNC-01, SYNC-03)** — `src/views/runner-view.ts:178-202`:
```typescript
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (file instanceof TFile && file.extension === 'canvas') {
      this.selector?.rebuildIfOpen();
    }
  })
);
this.registerEvent(
  this.app.vault.on('delete', (file) => { /* ... */ })
);
this.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => { /* ... */ })
);
```

**Copy this shape verbatim** for the three watchers in the new tree view, adapting:
1. Replace the `.canvas` filter with the D-18 prefix filter: `file.path === root || file.path.startsWith(root + '/')` where `root = this.plugin.settings.snippetFolderPath`.
2. Instead of calling a widget, schedule a trailing-debounced redraw (120ms per UI-SPEC). Store the timer on `this._redrawTimer`, clear on each new event, also clear in `onClose`.
3. `this.registerEvent(...)` auto-unregisters on view teardown — SYNC-03 is satisfied by using `registerEvent` (no manual `offref` needed).

**DOM event registration pattern** — `src/views/editor-panel-view.ts:93-99`:
```typescript
this.registerDomEvent(
  this.watchedCanvasContainer,
  'click',
  this.canvasPointerdownHandler
);
```

Use `this.registerDomEvent` for every tree row click / hover / context-menu trigger so Obsidian auto-detaches on `onClose`.

**Imports block** (compose from analogs):
```typescript
import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon, TFile, TFolder, TAbstractFile } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { Snippet } from '../snippets/snippet-model';
import { SnippetEditorModal } from './snippet-editor-modal';
import { ConfirmModal } from './confirm-modal';
```

**Sort pattern (D-04)** — reuse `.localeCompare`, see `src/snippets/snippet-service.ts:91` and `127`:
```typescript
folders.sort((a, b) => a.localeCompare(b));
snippets.sort((a, b) => a.name.localeCompare(b.name));
```

---

### `src/views/snippet-editor-modal.ts` (NEW)

**Analog:** `src/views/snippet-fill-in-modal.ts`.

**Class skeleton + Promise result pattern** — `src/views/snippet-fill-in-modal.ts:25-83`:
```typescript
import { Modal, App } from 'obsidian';

export class SnippetFillInModal extends Modal {
  private readonly snippet: JsonSnippet;
  private resolve!: (value: string | null) => void;
  private resolved = false;
  readonly result: Promise<string | null>;

  constructor(app: App, snippet: JsonSnippet) {
    super(app);
    this.snippet = snippet;
    this.result = new Promise<string | null>(res => { this.resolve = res; });
  }

  onOpen(): void {
    this.titleEl.setText(this.snippet.name);
    this.contentEl.addClass('rp-snippet-modal');
    // ... render fields ...
  }

  onClose(): void {
    this.safeResolve(null);
    this.contentEl.empty();
  }

  private safeResolve(value: string | null): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(value);
    }
  }
}
```

**Adapt for Phase 33:**
- Constructor signature: `(app: App, plugin: RadiProtocolPlugin, mode: 'create' | 'edit', initial: { folder: string; snippet?: Snippet })`
- Result shape: `Promise<{ saved: true; snippet: Snippet } | { saved: false }>` (so the caller can refresh the tree)
- In `onOpen`, set `this.modalEl.style.maxWidth = '800px'` per D-07 / UI-SPEC
- Use `this.titleEl.setText('Новый сниппет')` (create) or `'Редактирование: ' + snippet.name` (edit)
- Button row pattern from `snippet-fill-in-modal.ts:236-253` (button creation + click → safeResolve + close)

**Save pipeline (D-09)** — compose from `snippet-service.ts:171-198` + `canvas-ref-sync.ts:39`:
```typescript
// Inside handleSave() after validating:
await this.plugin.snippetService.save(draft);
if (mode === 'edit' && oldPath !== null && oldPath !== draft.path) {
  await this.plugin.snippetService.delete(oldPath);
  const result = await rewriteCanvasRefs(
    this.app,
    new Map([[oldPath, draft.path]]),
  );
  new Notice(
    `Сниппет перемещён. Обновлено канвасов: ${result.updated.length}, пропущено: ${result.skipped.length}.`,
  );
}
```

**Unsaved-changes guard (MODAL-08)** — delegate to `ConfirmModal`:
```typescript
onClose(): void {
  // But only if hasUnsavedChanges is false — otherwise intercept via close button / Esc
}
// Override close button handler to open ConfirmModal first; await result before calling super.close()
```

**Filename derivation (D-11)** — import from `src/snippets/snippet-model.ts`:
```typescript
import { slugifyLabel } from '../snippets/snippet-model';
const candidatePath = `${folder}/${slugifyLabel(name)}.${kind === 'json' ? 'json' : 'md'}`;
```

**Collision check (D-12)** — call `service.exists(candidatePath)` before enabling save; pattern identical to `snippet-service.ts:221-225`.

---

### `src/views/confirm-modal.ts` (NEW)

**Analog:** `src/views/node-switch-guard-modal.ts` — exact pattern, generalise the strings + buttons.

**Full template to adapt** — `src/views/node-switch-guard-modal.ts:15-70`:
```typescript
import { App, Modal } from 'obsidian';

export class NodeSwitchGuardModal extends Modal {
  readonly result: Promise<boolean>;
  private resolve!: (value: boolean) => void;
  private resolved = false;

  constructor(app: App) {
    super(app);
    this.result = new Promise<boolean>(res => { this.resolve = res; });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Unsaved changes' });
    contentEl.createEl('p', {
      text: 'You have unsaved changes. They will be lost.',
      cls: 'mod-warning',
    });
    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });
    const stayBtn = btnRow.createEl('button', { text: 'Stay' });
    stayBtn.addEventListener('click', () => { this.confirm(false); });
    const discardBtn = btnRow.createEl('button', {
      text: 'Discard and switch',
      cls: 'mod-cta',
    });
    discardBtn.addEventListener('click', () => { this.confirm(true); });
  }

  onClose(): void {
    if (!this.resolved) { this.resolve(false); this.resolved = true; }
    this.contentEl?.empty();
  }

  private confirm(value: boolean): void {
    if (!this.resolved) { this.resolve(value); this.resolved = true; }
    this.close();
  }
}
```

**Generalise to `ConfirmModal` taking options:**
```typescript
interface ConfirmModalOptions {
  title: string;
  body: string | HTMLElement;       // string for snippet-delete, rich element for folder-delete list
  confirmLabel: string;              // 'Удалить' | 'Удалить папку' | 'Сохранить'
  cancelLabel: string;               // 'Отмена'
  destructive?: boolean;             // true → confirm button uses 'mod-warning' instead of 'mod-cta'
  extraButton?: { label: string; value: 'discard' };  // for unsaved-changes 3-button variant
}
```

Use `modal-button-container` class (Obsidian-native) for the button row, same as `node-switch-guard-modal.ts:38`. Keep the `safeResolve` double-guard pattern.

Folder-delete body pattern (D-15): receive a pre-walked descendant list, render up to 10 paths as `<code>` in a `<ul>`, then `…и ещё {N} элементов.` as muted text.

---

### `src/views/snippet-chip-editor.ts` (NEW — extraction)

**Source:** legacy `src/views/snippet-manager-view.ts` lines 160–606 (roughly the entire `renderFormPanel` + `renderPlaceholderList` + `renderPlaceholderChip` + `renderExpandedPlaceholder` + `renderNumberExpanded` region).

**Extraction contract (RESEARCH.md line 189):**
```typescript
export interface ChipEditorHandle {
  destroy(): void;
  // draft is mutated in-place; caller reads it after modal save
}

export function mountChipEditor(
  container: HTMLElement,
  draft: JsonSnippet,
  onChange: () => void,
): ChipEditorHandle;
```

**What to copy verbatim from legacy file:**
- `insertAtCursor` helper (`snippet-manager-view.ts:10-17`)
- `PH_COLOR` constant (`snippet-manager-view.ts:19-25`)
- The name input + template textarea + "+ Add placeholder" mini-form (`snippet-manager-view.ts:174-291`)
- All chip render / edit / delete logic (further down in the legacy file)

**What to strip during extraction:**
- Plugin/vault references (`this.plugin.*`) — replace with pure DOM + `draft` mutation
- `registerDomEvent` calls — replace with raw `addEventListener` (the modal owner manages lifecycle via its `contentEl.empty()` in `onClose`)
- The list panel and save/delete buttons — those belong to the tree view / modal footer now, not the chip editor

**Critical:** per CLAUDE.md "Never remove existing code you didn't add," **only delete the extracted regions of the legacy file in the same commit** that introduces the extraction; rename / rewrite the rest into the new tree view.

---

### `src/snippets/snippet-service.ts` (EXTEND — add `createFolder`, `deleteFolder`)

**Analog (self):** existing `save` (lines 171-198) and `delete` (lines 206-215) methods.

**`createFolder` pattern to copy** — adapted from `save` at `snippet-service.ts:171-198`:
```typescript
/**
 * Phase 33 (D-17): Create an empty folder inside the snippet root.
 * Idempotent via ensureFolderPath. Path-safety gate rejects unsafe paths.
 */
async createFolder(path: string): Promise<void> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) {
    throw new Error(`[RadiProtocol] createFolder rejected unsafe path: ${path}`);
  }
  await this.mutex.runExclusive(normalized, async () => {
    await ensureFolderPath(this.app.vault, normalized);
  });
}
```

**`deleteFolder` pattern to copy** — adapted from `delete` at `snippet-service.ts:206-215`:
```typescript
/**
 * Phase 33 (D-17, D-16): Trash a folder (recursive) inside the snippet root.
 * Single vault.trash(folder, false) call — Obsidian handles recursion.
 * Canvas-ref-sync is NOT called (deletes leave broken refs, matches legacy).
 */
async deleteFolder(path: string): Promise<void> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) return;
  await this.mutex.runExclusive(normalized, async () => {
    const folder = this.app.vault.getAbstractFileByPath(normalized);
    if (folder === null) return;
    // D-16: recursive trash — TFolder is a valid TAbstractFile
    await this.app.vault.trash(folder, false);
  });
}
```

**For the folder-delete confirm (D-15) — descendant walk helper:**
The view needs a list of descendants (up to 10 + count). Add this either as a SnippetService method (`walkFolder(path): Promise<{ files: string[]; folders: string[]; total: number }>`) or inline in the view. Recommended: new service method for symmetry with `listFolder`, using `app.vault.adapter.list` recursively (pattern at `snippet-service.ts:79-89`).

**Imports — already in place** (lines 1-7); no new imports needed for `createFolder` / `deleteFolder`.

**Path-safety gate:** every new method MUST start with `assertInsideRoot` (lines 30-46). This is non-negotiable — D-17 explicitly requires it.

**WriteMutex:** every new write-path method MUST wrap its side effects in `this.mutex.runExclusive(normalized, async () => { ... })`. Pattern at lines 176, 209.

---

### `src/settings.ts` (EXTEND)

**Analog (self):** existing `snippetFolderPath` at `settings.ts:11`.

**Addition:**
```typescript
// In RadiProtocolSettings interface (after snippetFolderPath at line 11):
snippetTreeExpandedPaths: string[];

// In DEFAULT_SETTINGS (after snippetFolderPath at line 26):
snippetTreeExpandedPaths: [],
```

**Usage pattern:** read on view `onOpen`, mutate on expand/collapse toggle, then `await this.plugin.saveSettings()` (settings.ts:150-152 shows the existing field-update pattern used in the settings tab).

---

### `src/main.ts` (NO NEW CODE — just keep existing wiring)

**Existing lines to preserve** (no edits needed if constant name unchanged):
- Line 8: `import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';`
- Line 62: `this.registerView(SNIPPET_MANAGER_VIEW_TYPE, (leaf) => new SnippetManagerView(leaf, this));`
- Lines 161-165: workspace detach / setViewState loop for the view type

**IMPORTANT per CLAUDE.md "Never remove existing code you didn't add":** do not touch any other `src/main.ts` lines. The rewritten view keeps the same class name `SnippetManagerView` and same view-type constant, so the registration point is zero-diff.

If the planner prefers a new class name like `SnippetTreeView`, they must also update lines 8 and 62 — but the CONTEXT.md wording ("rewritten in-place, same filename, same view-type") favours keeping the class name `SnippetManagerView` for a minimal main.ts diff.

---

### `src/styles/snippet-manager.css` (REPLACE legacy rules with tree rules)

**Append-only note from CLAUDE.md:** the rule applies *within* a phase to carried rules. Since the legacy master-detail view is being **deleted wholesale** (TREE-02), the legacy `rp-snippet-manager-*` / `rp-snippet-list-*` / `rp-snippet-form-*` selectors become dead code in the same phase that deletes their only consumers — those specific selectors may be removed along with the view.

**Strategy:**
1. Remove only the CSS rules whose selectors are referenced exclusively by the deleted legacy code paths (grep the rewritten view + new modal to prove no remaining consumers).
2. Append new `radi-snippet-tree-*` rules at the bottom of the file with a phase header: `/* Phase 33: tree view */`.
3. Append new `radi-snippet-modal-*` rules under: `/* Phase 33: snippet editor modal */`.
4. Keep any chip-editor selectors that the extracted chip editor still uses (`rp-placeholder-*`, `rp-add-placeholder-form`, etc. — see legacy lines 249-287) — these are carried, not new.

**Token usage:** follow UI-SPEC strictly — only Obsidian CSS variables, no hex literals. The existing `snippet-manager.css` already uses `var(--size-*)` / `var(--text-*)` / `var(--background-*)` — continue that convention.

---

### `src/__tests__/snippet-service.test.ts` (EXTEND)

**Analog (self):** existing `makeVault` factory at lines 15-71.

**Reusable mock vault pattern** — lines 15-71:
```typescript
function makeVault(opts: MockVaultOptions = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  // ...
  const vault = {
    adapter: { exists, read, write, list },
    create,
    createFolder: vi.fn(async (p: string) => { folderSet.add(p); }),
    getAbstractFileByPath: vi.fn((p: string) => p in abstractFiles ? abstractFiles[p] : null),
    trash: vi.fn(async (_file: unknown, _system: boolean) => { /* spy only */ }),
  };
  return { vault, files, folderSet, abstractFiles };
}
```

**Already has everything `createFolder` / `deleteFolder` tests need:**
- `vault.createFolder` is already mocked (line 59-61)
- `vault.trash` is already mocked (line 65-67)
- `vault.getAbstractFileByPath` returns a TFolder-ish stub when path is registered in `opts.abstractFiles` or `opts.folders`

**New tests to add (compose from existing test pattern):**
- `describe('createFolder', ...)`:
  - happy path: `createFolder(root + '/sub')` calls `vault.createFolder` once, idempotent on second call
  - path-safety: `createFolder('../escape')` throws
  - nested: `createFolder(root + '/a/b/c')` creates parents via ensureFolderPath

- `describe('deleteFolder', ...)`:
  - happy path: `deleteFolder(root + '/sub')` calls `vault.trash(folder, false)` once
  - path-safety: `deleteFolder('../escape')` → no-op (silent)
  - missing folder: `deleteFolder(root + '/missing')` → no-op

- Canvas-ref-sync integration test: use `rewriteCanvasRefs` with a fake vault containing one `.canvas` file referencing a snippet subfolder, call via edit-modal save pipeline end-to-end (may belong in a separate file; planner discretion).

---

## Shared Patterns

### Path safety
**Source:** `src/snippets/snippet-service.ts:30-46` (`assertInsideRoot`)
**Apply to:** every new service method (`createFolder`, `deleteFolder`, `walkFolder` if added)
```typescript
const normalized = this.assertInsideRoot(path);
if (normalized === null) { /* return safe empty */ }
```

### WriteMutex wrapping
**Source:** `src/snippets/snippet-service.ts:176, 209`
**Apply to:** every new write-path method
```typescript
await this.mutex.runExclusive(normalized, async () => { /* I/O */ });
```

### Obsidian-native event registration
**Source:** `src/views/runner-view.ts:178-202`, `src/views/editor-panel-view.ts:40-47`, `editor-panel-view.ts:93-99`
**Apply to:** all tree-view event wiring (vault events + DOM events)
- Use `this.registerEvent(this.app.vault.on(...))` for vault → auto-detach on `onClose`
- Use `this.registerDomEvent(el, type, handler)` for DOM → auto-detach on `onClose`
- Never call `vault.on` without `registerEvent` — causes listener leaks (per SYNC-03 and the Phase 23 leak fix referenced in `runner-view.ts:215-219`)

### Modal Promise-result pattern
**Source:** `src/views/snippet-fill-in-modal.ts:25-83`, `src/views/node-switch-guard-modal.ts:15-70`
**Apply to:** both new modals (`SnippetEditorModal`, `ConfirmModal`)
- `readonly result: Promise<T>` field
- `private resolved = false` guard
- `safeResolve(value)` helper — never double-resolve
- `onClose` always calls `safeResolve(defaultValue)` then `contentEl.empty()`
- External callers: `const m = new Modal(app, ...); m.open(); const r = await m.result;`

### Lucide icons via setIcon
**Source:** implied usage throughout Obsidian plugin. Use `setIcon(el: HTMLElement, name: string)` imported from `obsidian`.
**Apply to:** tree rows (`folder` / `folder-open` / `file-json` / `file-text`), chevrons (`chevron-right` / `chevron-down`), action buttons (`plus`, `trash`, `folder-plus`, `x`). Exact icon names locked in UI-SPEC §Lucide icon assignments.

### Russian copy
**Source:** UI-SPEC §Copywriting Contract (exhaustive string table)
**Apply to:** every user-facing string. No English in UI. Match the UI-SPEC table verbatim (including `«»` quotes and Russian punctuation).

### Notice usage
**Source:** `src/views/editor-panel-view.ts:1` (Notice import), standard pattern throughout codebase
**Apply to:** post-save canvas-sync summary, post-delete confirm, watcher error
```typescript
new Notice(`Сниппет перемещён. Обновлено канвасов: ${n}, пропущено: ${m}.`);
```

---

## No Analog Found

None. Every file in Phase 33 has a close analog in the existing codebase — this phase is largely a **recomposition** of existing patterns (ItemView + Modal + vault events + SnippetService CRUD), not the introduction of new paradigms.

The **only novel wiring** in Phase 33 is the first production call site for `rewriteCanvasRefs` from `canvas-ref-sync.ts` — the module exists, tested, from Phase 32, but this phase is the first caller. There is no analog caller to copy from; the caller pattern is dictated by `canvas-ref-sync.ts:39-46` (module-level function, takes `app + Map`, returns `CanvasSyncResult`). D-09 specifies the exact call shape.

---

## Metadata

**Analog search scope:**
- `src/views/` (all 9 existing view files)
- `src/snippets/` (all 3 files)
- `src/utils/` (vault-utils, write-mutex)
- `src/main.ts`, `src/settings.ts`
- `src/__tests__/snippet-service.test.ts`
- `esbuild.config.mjs`

**Files scanned:** ~18
**Pattern extraction date:** 2026-04-15
