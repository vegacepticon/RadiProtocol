---
phase: 34
plan: 01
subsystem: views/snippet-manager
tags: [move, context-menu, folder-picker, canvas-ref-sync, wave-2]
requires:
  - SnippetService.moveSnippet
  - SnippetService.moveFolder
  - SnippetService.listAllFolders
  - toCanvasKey
provides:
  - FolderPickerModal
  - SnippetManagerView.openMovePicker
  - «Переместить в…» context menu items (file + folder branches)
affects:
  - src/views/folder-picker-modal.ts
  - src/views/snippet-manager-view.ts
  - src/__tests__/snippet-tree-dnd.test.ts
tech-stack:
  added: []
  patterns:
    - SuggestModal<string> picker mirroring NodePickerModal shape
    - View-layer orchestrator calling service I/O then rewriteCanvasRefs (D-01)
    - Snippet-root-relative canvas keys via toCanvasKey (D-03)
    - Expand-state prefix rewrite on folder move (D-07)
key-files:
  created:
    - src/views/folder-picker-modal.ts
  modified:
    - src/views/snippet-manager-view.ts
    - src/__tests__/snippet-tree-dnd.test.ts
decisions:
  - Async onChoose callback passed directly to FolderPickerModal — widened
    the modal's callback type to `(folder: string) => void | Promise<void>`
    so the tree view's async move orchestrator can be awaited naturally
    from tests without a fire-and-forget wrapper.
  - File-branch move issues only moveSnippet — no rewriteCanvasRefs and no
    «Обновлено канвасов» notice (D-03 следствие 2: files are canvas-invisible).
  - Folder-branch picker list excludes source + descendants at the caller,
    not inside FolderPickerModal (picker stays dumb per plan direction).
requirements: [MOVE-03, MOVE-05, RENAME-03]
metrics:
  duration: ~20m
  completed: 2026-04-15
---

# Phase 34 Plan 01: Context Menu «Переместить в…» + FolderPickerModal Summary

Discrete, non-DnD move flow for snippets and folders: «Переместить в…» item
in the file and folder context menus opens a SuggestModal listing all
snippet folders, and on selection routes through SnippetService + (for
folders) rewriteCanvasRefs with correct snippet-root-relative keys.

## What Was Built

### `src/views/folder-picker-modal.ts` (NEW, 33 lines)

`FolderPickerModal extends SuggestModal<string>` — dumb picker mirroring
`node-picker-modal.ts` structure verbatim. Placeholder «Выберите папку…»,
case-insensitive substring filter. Callback signature widened to
`(folder: string) => void | Promise<void>` so async callers can be awaited
in tests. Target-list filtering (source folder + descendants on folder
moves) happens in the caller before construction.

### `src/views/snippet-manager-view.ts` (+84 lines, 0 removed)

1. **New imports** — `FolderPickerModal`, `rewriteCanvasRefs`, `toCanvasKey`.
   Appended after the existing import block; nothing from Phase 33 touched.

2. **«Переместить в…» file-branch menu item** — inserted between
   «Редактировать» and «Удалить» in `openContextMenu`, icon `folder-input`,
   `onClick → void this.openMovePicker(node)`.

3. **«Переместить в…» folder-branch menu item** — inserted between
   «Создать подпапку» and «Удалить папку» with the same icon and handler.

4. **`openMovePicker(node)` private async method** — orchestration:
   - Calls `snippetService.listAllFolders()`; catches + Russian Notice on failure.
   - File branch: filters out `dirname(node.path)` from the folder list.
   - Folder branch: filters out `node.path` and every folder starting with
     `node.path + '/'` (self-nest guard at UI layer).
   - Constructs `FolderPickerModal` with the filtered list and an async
     `onChoose` handler.
   - **File move:** `await moveSnippet(node.path, chosen)` → Notice
     «Сниппет перемещён.» → rebuild tree. No canvas-ref-sync.
   - **Folder move:** `await moveFolder(oldPath, chosen)` → build mapping
     `new Map([[toCanvasKey(oldPath, root), toCanvasKey(newPath, root)]])`
     → `await rewriteCanvasRefs(app, mapping)` → walk
     `settings.snippetTreeExpandedPaths` rewriting entries that equal
     `oldPath` or start with `oldPath + '/'` → `saveSettings()` if mutated
     → Notice «Папка перемещена. Обновлено канвасов: N, пропущено: M.» →
     rebuild tree.
   - Try/catch around the whole move flow; Russian Notice + `console.error`
     on failure.

No existing handler, method, field, or import was removed — CLAUDE.md rule
honoured.

### `src/__tests__/snippet-tree-dnd.test.ts` (replaced 2 todos with 4 real tests)

Added a full DOM-ish mock harness mirroring `snippet-tree-view.test.ts`
(the existing Phase 33 pattern) plus spies for `rewriteCanvasRefs`,
`FolderPickerModal`, and the Obsidian Menu. Four real tests under
`describe('context menu Move to…')`:

1. **File branch** — `openMovePicker` on a file node opens the picker; on
   onChoose fire, `moveSnippet` is called with `(oldPath, chosen)` and
   `rewriteCanvasRefs` is **not** called.
2. **Folder branch** — `openMovePicker` on folder `root/a` with target
   `root/b` calls `moveFolder(root/a, root/b)` then `rewriteCanvasRefs`
   once with `Map([['a', 'b/a']])` — snippet-root-relative keys per D-03.
3. **Exclusion** — folder picker input list excludes `root/a` and
   `root/a/sub` when moving `root/a`; still contains `root` and `root/b`.
4. **Expand-state rewrite** — after folder move, `snippetTreeExpandedPaths`
   has `root/a` → `root/b/a`, `root/a/sub` → `root/b/a/sub`, `root/other`
   untouched, and `saveSettings` was called.

The remaining DnD `it.todo` items under `describe('dragstart')`,
`describe('dragover guard')`, `describe('drop')` are preserved verbatim
for Plan 02 (drag-and-drop).

## Verification

- `npx vitest run src/__tests__/snippet-tree-dnd.test.ts -t "context menu"`
  → **4 passed, 11 skipped (todos for Plan 02)**
- `npm run build` → clean (tsc -noEmit passes, esbuild copied to dev vault)
- `npm test` → **313 passed, 20 todo, 3 pre-existing failures** in
  `runner-extensions.test.ts` ("RED until Plan 02" — Phase 26 branch work,
  unrelated and pre-existing on HEAD; documented in 34-00-SUMMARY.md).
- `git diff --stat src/views/snippet-manager-view.ts` → +84 additions, 0
  deletions.

## Deviations from Plan

**[Rule 2 - correctness] Widened FolderPickerModal callback type.**
The plan called for a `(folder: string) => void` callback, but the
`openMovePicker` orchestrator is async (awaits `moveSnippet` /
`moveFolder` / `rewriteCanvasRefs` / `saveSettings`). A sync wrapper
(`(f) => { void onChoose(f); }`) would make tests unable to await the
move and immediately assert final state. Widened the callback type to
`(folder: string) => void | Promise<void>` and passed `onChoose` directly
so tests can deterministically await before assertions. This is
strictly a type widening — existing/future sync callers are unaffected.
No plan intent violated.

Otherwise plan executed exactly as written.

## Deferred Issues

- `src/__tests__/runner-extensions.test.ts` — 3 pre-existing failures
  ("RED until Plan 02") on Phase 26 branch. Confirmed already failing on
  HEAD before any Plan 01 edit. Out of scope for Phase 34.
- `src/styles.css` — uncommitted drift from a prior Phase 31 build (rules
  for `.rp-snippet-branch-list` / `.rp-snippet-branch-btn`). Per CLAUDE.md
  `styles.css` is a generated file and must never be committed manually.
  Not staged by this plan.

## Known Stubs

None. Menu wiring, picker, and move orchestration are all fully
functional with real data flow end to end.

## Self-Check

- `src/views/folder-picker-modal.ts` — FOUND (33 lines, exports `FolderPickerModal`)
- `src/views/snippet-manager-view.ts` — FOUND (modified, +84 lines)
- `src/__tests__/snippet-tree-dnd.test.ts` — FOUND (4 context-menu tests green)
- Commit `263855b` (feat 34-01 add FolderPickerModal) — FOUND
- Commit `d964740` (feat 34-01 context menu flow) — FOUND

## Self-Check: PASSED
