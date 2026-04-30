# Phase 34: Drag-and-Drop, Context Menu, Rename, Move — Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 7
**Analogs found:** 6 / 7 (one greenfield — `vault.rename`/`fileManager.renameFile` has no prior use)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/views/snippet-manager-view.ts` (modify) | view | event-driven UI | `src/views/snippet-chip-editor.ts` (DnD) + self (Phase 33 tree) | exact |
| `src/snippets/snippet-service.ts` (modify) | service | file-I/O CRUD | self — `createFolder` / `deleteFolder` / `delete` | exact |
| `src/snippets/canvas-ref-sync.ts` (verify only) | utility | batch transform | self — already supports folder-prefix | exact (no code change expected) |
| `src/views/folder-picker-modal.ts` (NEW) | modal | request-response | `src/views/node-picker-modal.ts` | exact |
| `src/views/snippet-editor-modal.ts` (verify) | modal | file-I/O | self — `handleSave` D-09 pipeline | exact |
| `src/styles/snippet-manager.css` (append) | style | n/a | self — `.radi-snippet-tree-row` + `.rp-placeholder-chip.drag-over` | exact |
| `src/__tests__/snippet-service.test.ts` + `canvas-ref-sync.test.ts` (extend) | test | n/a | self | exact |

---

## Pattern Assignments

### `src/views/snippet-manager-view.ts` (view, event-driven UI)

Phase 33 already built the tree. Phase 34 adds DnD + F2 + context-menu enrichments on existing `renderNode`.

**Analog for DnD: `src/views/snippet-chip-editor.ts` lines 234–285** — complete HTML5 drag/drop lifecycle (dragstart / dragover / dragenter / dragleave / drop / dragend) with `drag-over` CSS class toggling and `dataTransfer.setData('text/plain', …)` payload.

Key excerpt (chip-editor DnD skeleton — adapt to tree rows):
```typescript
chip.setAttribute('draggable', 'true');
chip.dataset['dragIndex'] = String(index);

onRaw(chip, 'dragstart', ((e: DragEvent) => {
  e.dataTransfer?.setData('text/plain', chip.dataset['dragIndex'] ?? String(index));
}) as EventListener);
onRaw(chip, 'dragover', ((e: DragEvent) => {
  e.preventDefault();             // MUST preventDefault to enable drop
  chip.addClass('drag-over');
}) as EventListener);
onRaw(chip, 'dragenter', ((e: DragEvent) => { e.preventDefault(); chip.addClass('drag-over'); }) as EventListener);
onRaw(chip, 'dragleave', ((e: DragEvent) => {
  if (chip.contains(e.relatedTarget as Node | null)) return;  // ignore child enter/leave
  chip.removeClass('drag-over');
}) as EventListener);
onRaw(chip, 'drop', ((e: DragEvent) => {
  e.preventDefault();
  chip.removeClass('drag-over');
  const fromStr = e.dataTransfer?.getData('text/plain');
  // …move logic…
}) as EventListener);
onRaw(chip, 'dragend', (() => {
  placeholderList.querySelectorAll('.drag-over').forEach(el =>
    (el as HTMLElement).removeClass('drag-over'));
}) as EventListener);
```

**For the tree, use `this.registerDomEvent(row, 'dragstart', …)`** (already the pattern in `snippet-manager-view.ts`; lines 275, 287) — this auto-unregisters on view close, whereas chip-editor uses custom `onRaw` because it lives inside a modal.

**Row rendering insertion point (self, lines 232–292):** extend `renderNode()` to:
- set `row.setAttribute('draggable', 'true')` for both file and folder rows
- set `row.dataset['path'] = node.path` (already exists, line 234)
- register `dragstart`/`dragover`/`drop` next to existing click (line 275) and contextmenu (line 287) handlers

**Drop-target validation rules (domain):**
- file dropped on folder → move file into that folder (`dirname(src) !== dstFolder`)
- folder dropped on folder → refuse if `dst === src` or `dst.startsWith(src + '/')` (would nest folder inside itself)
- file/folder dropped on file-row → use `dirname(fileRow.path)` as target folder

**F2 inline rename — no existing analog in this codebase.** Pattern to implement:
1. Register `keydown` on `this.treeRootEl` (or each row via registerDomEvent) checking `ev.key === 'F2'` on the focused/hovered row
2. Replace `radi-snippet-tree-label` span with a transient `<input>` in-place; select text minus extension
3. On Enter → commit via new `snippetService.renameSnippet()` / `renameFolder()`; on Escape → restore span
4. CSS: new class `radi-snippet-tree-label-input` (see CSS section below)

Track the renaming row the same way `currentlyEditingPath` is tracked (self, line 68) — add `currentlyRenamingPath: string | null`.

**Context menu — extend existing `openContextMenu` (lines 327–365):**

Current file-branch menu has "Редактировать" + "Удалить". Add between them:
```typescript
menu.addItem((item) =>
  item.setTitle('Переименовать').setIcon('pencil-line')
    .onClick(() => { this.startInlineRename(node.path); }),
);
menu.addItem((item) =>
  item.setTitle('Переместить в…').setIcon('folder-input')
    .onClick(() => { void this.openMovePicker(node); }),
);
```
Same two items in the folder branch (lines 343–363), after "Создать подпапку" / before "Удалить папку".

**Menu API:** `Menu` from 'obsidian', already imported line 9. Usage pattern is exactly the existing `menu.addItem(item => item.setTitle(...).setIcon(...).onClick(...))` at lines 330–362.

---

### `src/snippets/snippet-service.ts` (service, file-I/O)

Add four new methods. All four follow the **identical skeleton** already used by `createFolder` (lines 233–241) and `deleteFolder` (lines 249–258):

**Canonical method skeleton (self, lines 233–241):**
```typescript
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

**New methods to add** (each MUST call `assertInsideRoot` on BOTH source and destination, and wrap writes in `this.mutex.runExclusive`):

1. **`renameSnippet(oldPath: string, newBasename: string): Promise<string>`** — rename a file in place (same folder). Returns new path.
2. **`moveSnippet(oldPath: string, newFolder: string): Promise<string>`** — move file to another folder. Returns new path.
3. **`renameFolder(oldPath: string, newBasename: string): Promise<string>`** — rename folder in place. Returns new path.
4. **`moveFolder(oldPath: string, newParent: string): Promise<string>`** — move folder to another parent. Returns new path.

**GREENFIELD API note:** the codebase does not currently call `vault.rename`, `fileManager.renameFile`, or `adapter.rename` anywhere (confirmed via grep across `src/`). The Obsidian API for rename/move is:
```typescript
// Preferred — updates all internal links in markdown (does NOT touch .canvas node metadata)
await this.app.fileManager.renameFile(tFile, newPath);
// Lower-level — renames only, no link update
await this.app.vault.rename(tFile, newPath);
```

For snippet JSON/MD + folders, use **`vault.rename(abstractFile, newPath)`** — snippets are not referenced by markdown links (they are referenced via `radiprotocol_subfolderPath` in `.canvas` nodes, which is handled separately by `rewriteCanvasRefs`). Calling `fileManager.renameFile` would be harmless but unnecessary.

**Pre-flight checks (derive from `assertInsideRoot` style, lines 30–46):**
- Both old and new normalized paths MUST be inside `snippetFolderPath`
- Destination MUST NOT already exist (`adapter.exists`)
- For folder rename/move: `newParent !== oldPath` and `!newParent.startsWith(oldPath + '/')` (no self-nest)

**Method skeleton pattern (derived, follow to the letter):**
```typescript
async renameSnippet(oldPath: string, newBasename: string): Promise<string> {
  const normalizedOld = this.assertInsideRoot(oldPath);
  if (normalizedOld === null) throw new Error(`unsafe old path: ${oldPath}`);
  // basename safety: no slashes
  if (/[\\/]/.test(newBasename) || newBasename.trim() === '') {
    throw new Error('Имя не может быть пустым и не должно содержать «/» или «\\».');
  }
  const parent = normalizedOld.slice(0, normalizedOld.lastIndexOf('/'));
  const ext = normalizedOld.endsWith('.md') ? '.md' : '.json';
  const newPath = `${parent}/${newBasename}${ext}`;
  const normalizedNew = this.assertInsideRoot(newPath);
  if (normalizedNew === null) throw new Error(`unsafe new path: ${newPath}`);
  if (normalizedOld === normalizedNew) return normalizedNew;
  if (await this.app.vault.adapter.exists(normalizedNew)) {
    throw new Error(`Файл уже существует: ${normalizedNew}`);
  }
  await this.mutex.runExclusive(normalizedOld, async () => {
    const file = this.app.vault.getAbstractFileByPath(normalizedOld);
    if (file === null) throw new Error(`Файл не найден: ${normalizedOld}`);
    await this.app.vault.rename(file, normalizedNew);
  });
  return normalizedNew;
}
```

`moveSnippet` is the same but builds `newPath = newFolder + '/' + basename(normalizedOld)` and `ensureFolderPath(newFolder)` first.

Folder rename/move are structurally identical — operate on the `TFolder` returned by `getAbstractFileByPath`, and validate no self-nest.

**Important: who calls `rewriteCanvasRefs`?**
Phase 33's `SnippetEditorModal.handleSave` (self-analog below) calls `rewriteCanvasRefs` AFTER the file-system mutation succeeds. Phase 34 has a choice:
- **Option A:** `snippet-service.ts` stays I/O-only; callers (view / context menu handlers) orchestrate `rename → rewriteCanvasRefs`.
- **Option B:** service method takes optional `syncRefs: boolean` flag.

Existing convention (Phase 33 — see `SnippetEditorModal.handleSave` lines 446–469) is **Option A**: service does I/O, the caller builds the mapping and invokes `rewriteCanvasRefs`. Stay consistent.

---

### `src/snippets/canvas-ref-sync.ts` (verify only — no code change needed)

**Folder-prefix mapping is ALREADY supported.** Documented at lines 19–23 and implemented in `applyMapping` lines 114–132:

```typescript
// Lines 114–132: exact match wins; longest prefix wins on ties; prefix match uses "/" boundary
function applyMapping(current: string, mapping: Map<string, string>): string | null {
  const exact = mapping.get(current);
  if (exact !== undefined) return exact;
  let bestKey: string | null = null;
  for (const key of mapping.keys()) {
    if (current.startsWith(key + '/')) {
      if (bestKey === null || key.length > bestKey.length) bestKey = key;
    }
  }
  if (bestKey === null) return null;
  const newPrefix = mapping.get(bestKey)!;
  return newPrefix + current.slice(bestKey.length);
}
```

Public signature (self, lines 39–42):
```typescript
export async function rewriteCanvasRefs(
  app: App,
  mapping: Map<string, string>,
): Promise<CanvasSyncResult>
```

**Path-format contract** (self, lines 34–37, reinforced by `handleSave` comment lines 429–433):
The keys/values of `mapping` are `radiprotocol_subfolderPath` values, which are **relative to `settings.snippetFolderPath`** (NOT vault-relative), no leading slash.

**Phase 34 caller translation step (CRITICAL):**
`snippet-service` deals in vault-relative paths (e.g. `.radiprotocol/snippets/a/b.json`), but `canvas-ref-sync` expects snippet-folder-relative values (e.g. `a/b`). Phase 34 callers must strip:
1. `settings.snippetFolderPath + '/'` prefix
2. trailing `.json` / `.md` extension

before building the mapping. For folder moves, strip only the root prefix (no extension).

**Existing correct example — `handleSave` lines 456–462** passes **vault-relative file paths with extension** because the Phase 33 decision (D-09 resolved, comment lines 429–433) was that canvas refs stored those. Phase 34 MUST re-verify this. Evidence to check at implementation time: inspect a fresh `.canvas` file and confirm whether `radiprotocol_subfolderPath` contains `.radiprotocol/snippets/a/b.json` (vault-relative w/ ext) or `a/b` (root-relative no ext). `canvas-ref-sync.ts` comments say root-relative no ext; `snippet-editor-modal.ts` comments say exact file paths. **This is an inconsistency in Phase 33's docs that Phase 34 MUST resolve before writing the folder-mapping code.** Flag to the planner as a pre-plan research step.

**Tests that already cover folder-prefix:** `src/__tests__/canvas-ref-sync.test.ts` lines 70 (exact-match), 91 (prefix folder-move `a → a/c` rewrites `a/sub` to `a/c/sub`), 108 (WR-02 empty preserved). Folder-move behavior is already regression-locked.

---

### `src/views/folder-picker-modal.ts` (NEW, modal, request-response)

**Analog: `src/views/node-picker-modal.ts` (entire file, 76 lines).**

Copy the class structure verbatim, replace `NodeOption` with `string` (folder path) or `{ path: string; display: string }`.

**Full template to copy (from `node-picker-modal.ts` lines 3, 50–75):**
```typescript
import { App, SuggestModal } from 'obsidian';

export class FolderPickerModal extends SuggestModal<string> {
  private readonly folders: string[];
  private readonly onChooseCb: (folder: string) => void;

  constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
    super(app);
    this.folders = folders;
    this.onChooseCb = onChoose;
    this.setPlaceholder('Выберите папку…');
  }

  getSuggestions(query: string): string[] {
    if (query.trim() === '') return this.folders;
    const q = query.toLowerCase();
    return this.folders.filter(f => f.toLowerCase().includes(q));
  }

  renderSuggestion(folder: string, el: HTMLElement): void {
    el.createEl('div', { text: folder });
  }

  onChooseSuggestion(folder: string, _evt: MouseEvent | KeyboardEvent): void {
    this.onChooseCb(folder);
  }
}
```

**Source for the folder list — already exists in `snippet-editor-modal.ts` lines 264–270 (`buildFolderOptions`):**
```typescript
private async buildFolderOptions(): Promise<string[]> {
  const root = this.plugin.settings.snippetFolderPath;
  const descendants = await this.plugin.snippetService.listFolderDescendants(root);
  const folders = new Set<string>([root]);
  for (const f of descendants.folders) folders.add(f);
  return Array.from(folders).sort((a, b) => a.localeCompare(b));
}
```

Hoist this helper somewhere shared (e.g. a new utility, or a `snippetService.listAllFolders()` method) so both the editor and the picker consume it.

**Excluding invalid targets:** when moving a folder, the caller must filter out the source folder and all its descendants before passing the list to `FolderPickerModal`.

---

### `src/views/snippet-editor-modal.ts` (verify-only)

**Move-on-save pipeline already implemented (lines 446–475) — reference pattern for Phase 34 context-menu handlers:**

```typescript
if (this.options.mode === 'create' || oldPath === null || oldPath === newPath) {
  await this.plugin.snippetService.save(draftToSave);
  this.safeResolve({ saved: true, snippet: draftToSave, movedFrom: null });
  super.close();
  return;
}

// Move-on-save pipeline (D-09)
await this.plugin.snippetService.save(draftToSave);
await this.plugin.snippetService.delete(oldPath);
// Phase 33 (D-09 resolved): single-file mapping — exact oldPath → newPath.
const syncResult = await rewriteCanvasRefs(
  this.app,
  new Map([[oldPath, newPath]]),
);
new Notice(
  'Сниппет перемещён. Обновлено канвасов: ' + syncResult.updated.length +
    ', пропущено: ' + syncResult.skipped.length + '.',
);
```

**Phase 34 move-by-rename pipeline should be preferred (atomic) rather than save-then-delete:**
```typescript
// Phase 34: atomic rename instead of save+delete
const oldPath = /* current path */;
const newPath = await this.plugin.snippetService.moveSnippet(oldPath, targetFolder);
const syncResult = await rewriteCanvasRefs(this.app, new Map([[oldPath, newPath]]));
new Notice(`Сниппет перемещён. Обновлено канвасов: ${syncResult.updated.length}, пропущено: ${syncResult.skipped.length}.`);
```

For folder moves, build a **multi-entry mapping** — the service must return both old-root and new-root, and the caller builds `new Map([[oldFolder, newFolder]])` (a single entry is enough because `applyMapping` handles the prefix expansion internally for all descendants).

**Phase 34 should NOT modify `handleSave` unless Phase 33's D-09 contract is wrong.** The verify step is: confirm the `mapping` key format is consistent with `canvas-ref-sync.ts`'s documented contract (see the "CRITICAL" note above in the canvas-ref-sync section).

---

### `src/styles/snippet-manager.css` (append-only per phase — see CLAUDE.md)

**Existing Phase 33 tree row rules to reuse unchanged** (lines 221–311). New Phase 34 rules go at the bottom with the comment `/* Phase 34: drag-and-drop, inline rename */`.

**Analog A — chip-editor drag-over state, line 106:**
```css
.rp-placeholder-chip.drag-over { /* …existing Phase 27 rule… */ }
```
Mirror this as `.radi-snippet-tree-row.radi-dnd-drop-target`.

**Analog B — hover state, self lines 234–236:**
```css
.radi-snippet-tree-row:hover {
  background: var(--background-modifier-hover);
}
```

**Analog C — editing highlight, self lines 243–246:**
```css
.radi-snippet-tree-row[data-editing="true"] {
  border-left: 2px solid var(--interactive-accent);
  background: var(--background-modifier-active-hover);
}
```

**Rules to add (at bottom of `src/styles/snippet-manager.css`):**
```css
/* Phase 34: drag-and-drop, inline rename */

/* Row being dragged */
.radi-snippet-tree-row.radi-dnd-dragging {
  opacity: 0.5;
}

/* Valid drop target (hovered during drag) */
.radi-snippet-tree-row.radi-dnd-drop-target {
  background: var(--background-modifier-active-hover);
  outline: 2px dashed var(--interactive-accent);
  outline-offset: -2px;
}

/* Invalid drop target (e.g. folder into itself) */
.radi-snippet-tree-row.radi-dnd-drop-forbidden {
  cursor: not-allowed;
  outline: 2px dashed var(--text-error);
  outline-offset: -2px;
}

/* Inline rename input replacing the label span */
.radi-snippet-tree-label-input {
  flex: 1 1 auto;
  font-size: inherit;
  padding: 0 var(--size-2-1);
  border: 1px solid var(--interactive-accent);
  border-radius: var(--radius-s);
  background: var(--background-primary);
  color: var(--text-normal);
}
```

**CRITICAL (CLAUDE.md rule):** after every CSS change run `npm run build`. Never edit `styles.css` in the repo root directly.

---

### Tests

**Extend `src/__tests__/snippet-service.test.ts`** — add `describe('renameSnippet')`, `describe('moveSnippet')`, `describe('renameFolder')`, `describe('moveFolder')`. Existing tests for `createFolder`, `deleteFolder`, `delete` are the template. Key scenarios:
- happy path
- `assertInsideRoot` rejects `..`, absolute, outside-root
- destination collision → throws, source untouched
- self-nest (`moveFolder('a', 'a/b')`) → throws
- WriteMutex is awaited (use the mutex spy pattern already in snippet-service tests)

**Extend `src/__tests__/canvas-ref-sync.test.ts`** (folder-prefix already covered at lines 91–106). Add:
- Multi-folder mapping with overlapping prefixes → longest wins (already implicitly covered by `applyMapping` logic at lines 122–127, but a dedicated test would cement it)
- File rename within same folder → exact-match path (extension + basename change)

---

## Shared Patterns

### Path safety
**Source:** `src/snippets/snippet-service.ts` lines 30–46 (`assertInsideRoot`)
**Apply to:** EVERY new rename/move method. Both source AND destination must be gated. Unsafe path → throw, never silent success.

### WriteMutex wrapping
**Source:** `src/snippets/snippet-service.ts` line 17 (`private readonly mutex = new WriteMutex()`), lines 176, 209, 238, 252 (all I/O methods wrap in `this.mutex.runExclusive(normalizedPath, async () => { … })`).
**Apply to:** every new rename/move method. Key is the normalized source path.

### Obsidian event registration in ItemView
**Source:** `src/views/snippet-manager-view.ts` lines 96, 108–122 (`this.registerDomEvent`, `this.registerEvent`).
**Apply to:** all new dragstart/dragover/drop/keydown handlers in the tree view. Prefer `registerDomEvent` over `addEventListener` for auto-cleanup on view close.

### Notice + console.error on recoverable failure
**Source:** `src/views/snippet-manager-view.ts` lines 150–152, 454–456, 475–477, 531–533.
```typescript
try { … } catch (e) {
  new Notice('Не удалось …: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
}
```
**Apply to:** all rename/move/DnD error paths in the view. Service methods throw; view catches + notices. **User-facing Notice text MUST be in Russian** (`response_language: ru`; reinforced by CLAUDE.md memory).

### ConfirmModal for destructive/validated actions
**Source:** `src/views/snippet-manager-view.ts` lines 422–432, 460–469, 508–517 (`new ConfirmModal(this.app, { title, body, confirmLabel, cancelLabel, destructive })` then `await modal.result`).
**Apply to:** the "Move here? this will rewrite N canvas references" confirmation if Phase 34 adds a pre-move confirm dialog (check CONTEXT.md — may not be required). At minimum, a confirm step is warranted for folder-drag operations that affect many canvas files.

### Menu API for context menus
**Source:** `src/views/snippet-manager-view.ts` lines 327–365.
```typescript
import { Menu } from 'obsidian';
const menu = new Menu();
menu.addItem((item) => item.setTitle('…').setIcon('…').onClick(() => { … }));
menu.addSeparator();
menu.showAtMouseEvent(ev);
```
**Apply to:** enriched context menu with Rename / Move to… items.

### Localization
**Language:** Russian (per user memory + Phase 33 convention). All new `Notice`, context-menu titles, modal titles/bodies, placeholder text, and error messages MUST be in Russian. Existing examples: lines 332 `'Редактировать'`, 346 `'Создать сниппет здесь'`, 425 `'Создать'`, 462 `'Сниппет «${name}» будет перемещён в корзину Obsidian…'`.

---

## No Analog Found

| File / Concern | Reason |
|---|---|
| `vault.rename` / `fileManager.renameFile` call | No prior use in `src/`. Phase 34 is the first caller. Use `app.vault.rename(abstractFile, newPath)` — the lower-level API — and rely on `rewriteCanvasRefs` for `.canvas` reference updates (Obsidian's `fileManager.renameFile` only touches markdown links, which snippets don't use). |
| F2 inline-rename input-in-place UI | No prior inline-edit pattern in this plugin. Implementation is greenfield: replace label span with `<input>`, commit on Enter / rollback on Escape. |

---

## Metadata

**Analog search scope:** `src/views/`, `src/snippets/`, `src/styles/`, `src/__tests__/`, `src/__mocks__/`, `src/utils/`
**Files scanned:** 15+ (full Phase 33 tree view, full snippet service, full canvas-ref-sync, node-picker-modal, snippet-editor-modal, snippet-chip-editor DnD section, snippet-manager.css tree rules, canvas-ref-sync and snippet-service tests)
**Pattern extraction date:** 2026-04-15

**Pre-plan open question for the planner to resolve (HIGH priority):**
Phase 33's `SnippetEditorModal.handleSave` (lines 429–433, 456–462) passes **vault-relative paths with `.json`/`.md` extensions** to `rewriteCanvasRefs`, but `canvas-ref-sync.ts` JSDoc (lines 34–37) says values are **snippet-root-relative without extension**. One of these is wrong — the planner MUST inspect an actual `.canvas` file (or the tests at `canvas-ref-sync.test.ts` lines 60–130) to determine the true on-disk format of `radiprotocol_subfolderPath` before writing the folder-move code, otherwise folder-drag will silently corrupt zero canvas refs (mapping will never match).
