---
phase: 34
plan: 02
subsystem: views/snippet-manager
tags: [drag-and-drop, move, tree-view, wave-3, html5-dnd]
requires:
  - SnippetService.moveSnippet
  - SnippetService.moveFolder
  - toCanvasKey
  - openMovePicker (Plan 01)
provides:
  - SnippetManagerView.performMove (shared move orchestrator)
  - HTML5 DnD lifecycle on every tree row (dragstart/over/leave/drop/end)
  - MIME_FILE / MIME_FOLDER custom DataTransfer types
affects:
  - src/views/snippet-manager-view.ts
  - src/styles/snippet-manager.css
  - src/__tests__/snippet-tree-dnd.test.ts
tech-stack:
  added: []
  patterns:
    - HTML5 DataTransfer custom MIME (application/x-radi-snippet-file/folder)
    - dragover.preventDefault gated on `dataTransfer.types.includes(MIME)` (D-04)
    - Self/descendant guard thrown before any vault I/O
    - Shared private orchestrator `performMove` reused by two UI entry points
    - registerDomEvent for auto-cleanup on ItemView close
key-files:
  created: []
  modified:
    - src/views/snippet-manager-view.ts
    - src/styles/snippet-manager.css
    - src/__tests__/snippet-tree-dnd.test.ts
decisions:
  - Extracted `performMove(srcPath, srcKind, dstFolder)` as the single funnel
    for both the context-menu «Переместить в…» flow and the DnD drop handler.
    openMovePicker now only does list filtering + picker wiring + error
    notification; all service calls, canvas-ref-sync, expand-state rewrite,
    and Notice building live in performMove.
  - `readDragSource` reads MIME via `Array.from(types).includes(...)` to be
    tolerant of both real DOMStringList and mock `string[]` types arrays.
  - dragover on an invalid drop target (self / descendant / same-folder)
    sets `.radi-snippet-tree-drop-forbidden` but does NOT preventDefault —
    this lets the browser render "not-allowed" cursor and prevents the drop
    from being accepted at all, without touching the service.
  - dragend cleans up stray `.radi-snippet-tree-drop-target` /
    `.radi-snippet-tree-drop-forbidden` classes via `treeRootEl.querySelectorAll`,
    belt-and-braces in case a late dragleave was skipped.
  - File-row drop target is `dirname(fileRow.path)` so users can drop onto
    any file inside the destination folder rather than hunting for empty space.
requirements: [MOVE-01, MOVE-02, MOVE-05]
metrics:
  duration: ~20m
  completed: 2026-04-15
---

# Phase 34 Plan 02: HTML5 Drag-and-Drop on Snippet Tree Summary

Wave-3 direct spatial move for snippets and folders: every row in the
`SnippetManagerView` tree is now draggable, and every row is a drop target
that either accepts (valid), refuses (invalid — self/descendant/no-op), or
ignores (foreign drag — OS files, chip-editor, etc.) drop attempts. Both
DnD and the Plan 01 context-menu flow funnel through a single new
`performMove` orchestrator so canvas-ref-sync and expand-state rewrite
happen in exactly one place.

## What Was Built

### `src/views/snippet-manager-view.ts` (+187 lines, -44 lines net refactor)

1. **Module-private MIME constants** at the top of the file:
   ```ts
   const MIME_FILE = 'application/x-radi-snippet-file';
   const MIME_FOLDER = 'application/x-radi-snippet-folder';
   ```

2. **`performMove(srcPath, srcKind, dstFolder)` — shared orchestrator.**
   Extracted the entire move pipeline from `openMovePicker`:
   - File branch: no-op when `dirname(srcPath) === dstFolder`, otherwise
     `moveSnippet` + Notice. No canvas-ref-sync (D-03 следствие 2).
   - Folder branch: throws
     `'Нельзя переместить папку внутрь самой себя.'` before any I/O when
     `srcPath === dstFolder || dstFolder.startsWith(srcPath + '/')`.
     Otherwise `moveFolder` → build `toCanvasKey` mapping →
     `rewriteCanvasRefs` → expand-state prefix rewrite → Notice.
   - Rebuilds the tree and re-renders on success.
   - Callers wrap in try/catch and surface a Russian Notice + `console.error`
     on failure.

3. **`openMovePicker` (Plan 01) refactored** to call `performMove` — the
   filtering and picker wiring stay, but the move pipeline moved into the
   shared helper. Plan 01's 4 context-menu tests still pass byte-identical.

4. **HTML5 DnD handlers** — five new private methods:
   - `handleDragStart(row, node, ev)` — sets MIME, `effectAllowed='move'`,
     adds `is-dragging` to source row.
   - `handleDragOver(row, node, ev)` — reads source via `readDragSource`,
     returns immediately if no snippet MIME present (D-04). Otherwise
     computes target folder via `computeDropTarget` (folder row → row.path;
     file row → dirname(row.path)), checks `isDropForbidden`, then either
     sets `.radi-snippet-tree-drop-forbidden` (no preventDefault) or
     preventDefaults + sets `dropEffect='move'` + `.radi-snippet-tree-drop-target`.
   - `handleDragLeave(row, ev)` — removes both drop classes; ignores child
     enter/leave noise if `relatedTarget` is inside the row.
   - `handleDrop(node, row, ev)` — reads source, preventDefaults, removes
     drop classes, awaits `performMove`, catches and shows Russian Notice.
   - `handleDragEnd(row)` — removes `is-dragging`, walks `treeRootEl` for
     any stray drop-target/drop-forbidden classes as belt-and-braces cleanup.

5. **`renderNode` wiring** — after the existing context-menu handler
   (byte-identical) the method now adds `row.setAttribute('draggable', 'true')`
   and registers all five DnD lifecycle events via `registerDomEvent`.
   **No existing handler was removed** (CLAUDE.md rule honoured; Phase 33
   click + contextmenu + hover-button handlers are intact).

### `src/styles/snippet-manager.css` (+28 lines, append-only)

New rules appended at the very bottom under `/* Phase 34: drag-and-drop,
inline rename */`:
- `.radi-snippet-tree-row.is-dragging` — opacity 0.5 on source row
- `.radi-snippet-tree-row.radi-snippet-tree-drop-target` — dashed accent
  outline + background tint
- `.radi-snippet-tree-row.radi-snippet-tree-drop-forbidden` — dashed
  error-colour outline + not-allowed cursor
- `.radi-snippet-tree-rename-input` — prepped for Plan 03 inline rename

`npm run build` regenerated `styles.css`; per CLAUDE.md the generated
root file is NOT staged manually.

### `src/__tests__/snippet-tree-dnd.test.ts` (+11 real tests, -8 it.todo)

New helpers: `makeDataTransfer`, `makeDragEvent`, `findRow`, `fire`.
Plus a `beforeEach` that resets `rewriteCanvasRefsSpy` so cross-test state
no longer bleeds.

Real tests populated in the three DnD describe blocks:

- **`dragstart` (3 tests)** — file row gets MIME_FILE with its path; folder
  row gets MIME_FOLDER; source row gets `.is-dragging`.
- **`dragover guard` (3 tests)** — preventDefault only fires when our MIME
  is present; foreign MIME (`text/plain` only) is passed through without
  preventDefault or drop-target class; dragging a folder onto itself sets
  `drop-forbidden` without preventDefault.
- **`drop` (5 tests)** — file onto folder → `moveSnippet` + no
  `rewriteCanvasRefs`; folder onto folder → `moveFolder` + exactly one
  `rewriteCanvasRefs` call; folder onto itself → no service call; folder
  onto its own descendant (`root/a` → `root/a/sub`) → no service call; drop
  onto file-row redirects to `dirname(file-row.path)`.

Plan 01 context-menu tests were not touched; they still pass unchanged
because the refactor to `performMove` is behaviour-preserving.

## Verification

- `npx vitest run src/__tests__/snippet-tree-dnd.test.ts --reporter=default`
  → **15 passed** (3 dragstart + 3 dragover + 5 drop + 4 context-menu;
  zero `it.todo` remaining in dragstart/dragover/drop blocks).
- `npm test` → **324 passed, 9 todo, 3 pre-existing failures** in
  `runner-extensions.test.ts` (Phase 26 "RED until Plan 02" branch work —
  unrelated and already failing on the base commit; documented in both
  34-00-SUMMARY.md and 34-01-SUMMARY.md).
- `npm run build` → clean (tsc -noEmit passes, esbuild production copied
  to dev vault, `styles.css` regenerated).
- `git diff --stat src/views/snippet-manager-view.ts` → additions + a
  behaviour-preserving refactor of `openMovePicker`'s tail; no existing
  handler or import deleted.
- `git diff src/styles/snippet-manager.css` → only the 28 appended lines
  under the `/* Phase 34: ... */` comment; every Phase 33 rule untouched.

## Deviations from Plan

None. The plan's `<action>` list was executed verbatim:
1. `performMove` extracted from `openMovePicker` — behaviour preserved,
   Plan 01 tests green.
2. MIME constants added at module top.
3. `renderNode` extended with `draggable='true'` + five DnD listeners.
4. CSS appended under the Phase 34 comment, build re-ran.
5. DnD test stubs filled in with 11 real tests.

One minor implementation nicety (not a deviation — within plan spirit):
`dragend` walks `treeRootEl` for stray drop classes via `querySelectorAll`,
used as belt-and-braces cleanup. The mock's `querySelectorAll` returns
`[]`, so the test behaviour is unaffected; in real Obsidian it guards
against a corner case where a rapid drag-out-of-viewport leaves state
dangling.

## Deferred Issues

- `src/__tests__/runner-extensions.test.ts` — 3 failures pre-existing on
  this branch (Phase 26 `gsd/phase-26-auto-switch-to-node-editor-tab`
  work, labelled "RED until Plan 02" in their test names). Confirmed on
  HEAD before this plan's edits; not in scope for Phase 34.
- `styles.css` modification from `npm run build` is a generated artifact
  and explicitly NOT committed per CLAUDE.md rule.

## Known Stubs

None. Every DnD code path is wired end-to-end to the live
`SnippetService` / `rewriteCanvasRefs` / `saveSettings` flow.

## Self-Check

- `src/views/snippet-manager-view.ts` — FOUND (modified, +187 lines)
- `src/styles/snippet-manager.css` — FOUND (modified, +28 appended lines)
- `src/__tests__/snippet-tree-dnd.test.ts` — FOUND (15 tests green)
- Commit `e4b07bf` (feat 34-02 DnD lifecycle + performMove refactor) — FOUND
- Commit `66f5993` (feat 34-02 CSS append) — FOUND

## Self-Check: PASSED
