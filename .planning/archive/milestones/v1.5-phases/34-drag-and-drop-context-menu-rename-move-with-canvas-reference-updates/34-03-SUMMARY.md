---
phase: 34
plan: 03
subsystem: views/snippet-manager
tags: [inline-rename, f2, context-menu, canvas-ref-sync, wave-3, tdd]
requires:
  - SnippetService.renameSnippet
  - SnippetService.renameFolder
  - toCanvasKey
provides:
  - SnippetManagerView.startInlineRename
  - SnippetManagerView.commitInlineRename
  - F2 keydown handler on every tree row
  - «Переименовать» context-menu items (file + folder branches)
affects:
  - src/views/snippet-manager-view.ts
  - src/__tests__/snippet-tree-inline-rename.test.ts
tech-stack:
  added: []
  patterns:
    - Transient `<input>` swap with raw addEventListener (short-lived,
      not part of view lifetime — registerDomEvent not applicable)
    - Closure-scoped `settled` flag (D-05) guards Enter→commit→blur
      double-commit race
    - rowLabelEls Map<path, HTMLElement> populated in renderNode so
      context-menu «Переименовать» can reach the label without DOM walk
    - Folder-rename fan-out via rewriteCanvasRefs + toCanvasKey mapping
      (snippet-root-relative keys, D-03)
    - Expand-state prefix rewrite on folder rename (D-07)
key-files:
  created: []
  modified:
    - src/views/snippet-manager-view.ts
    - src/__tests__/snippet-tree-inline-rename.test.ts
decisions:
  - Input created via `rowEl.createEl('input', ...)` so it naturally
    participates in the mock-DOM children array used by tests; label is
    not removed (only `style.display='none'`) so `cancelInlineRename`
    can restore it without rebuilding the row.
  - Listeners on the transient input attached via raw addEventListener
    (NOT registerDomEvent) because the input is manually removed inside
    cleanup and would otherwise leave a dangling entry in the view's
    `_registeredDomEvents` list — per plan <behavior> spec.
  - Blur with unchanged value (trimmed equal to initial basename) is
    treated as a cancel, not a commit. Added an extra test case
    beyond the plan stub to lock this in.
  - No manual `this.renderTree()` after commit — vault 'rename' watcher
    (Phase 33 SYNC-02) handles the 120ms-debounced redraw.
requirements: [RENAME-01, RENAME-02, RENAME-03]
metrics:
  duration: ~25m
  completed: 2026-04-15
---

# Phase 34 Plan 03: F2 Inline Rename (Files + Folders) Summary

F2 on any focused tree row now swaps the label span for a transient
`<input>` pre-populated with the basename (minus extension for files).
Enter commits the rename through `SnippetService.renameSnippet` /
`renameFolder`; Escape cancels; blur commits once via a `settled`-flag
guard that blocks the Enter→blur race. Folder renames also fan out to
`rewriteCanvasRefs` with snippet-root-relative keys and rewrite every
expand-state prefix under the old path. A matching «Переименовать»
item was added to both the file and folder context-menu branches.

## What Was Built

### `src/views/snippet-manager-view.ts` (+195 lines, -1)

1. **New private state**:
   - `currentlyRenamingPath: string | null = null` — one-rename-at-a-time
     gate mirrored on `currentlyEditingPath`.
   - `rowLabelEls: Map<string, HTMLElement>` — populated in `renderNode`
     and cleared in `renderTree`/`onClose`, so the context-menu handler
     can locate the label element for `startInlineRename` without a DOM
     walk.

2. **`renderNode` additions** (append-only; CLAUDE.md rule honoured):
   - `row.setAttribute('tabindex', '0')` so F2 keydown can fire on a
     focused row.
   - `this.rowLabelEls.set(node.path, labelEl)` after the label span
     is created.
   - `registerDomEvent(row, 'keydown', ...)` that calls
     `startInlineRename(node, labelEl)` on `F2`.

3. **`openContextMenu` additions** (append-only):
   - File branch: «Переименовать» (icon `pencil-line`) between
     «Редактировать» and «Переместить в…».
   - Folder branch: same item between «Создать подпапку» and
     «Переместить в…».
   - Both call `startInlineRename` after resolving `labelEl` from
     `rowLabelEls`.

4. **`startInlineRename(node, labelEl)`** — builds a transient
   `<input type="text" class="radi-snippet-tree-rename-input">` inside
   the row, pre-populates with basename-without-extension (file) or
   folder basename (folder), focuses + selects. Installs raw
   `keydown`/`blur` listeners on the input:
   - `Enter`: `preventDefault`; if `settled` return; set `settled=true`;
     call `commitInlineRename(node, value, cleanup)`.
   - `Escape`: `preventDefault`; if `settled` return; set `settled=true`;
     call `cleanup()`.
   - `blur`: if `settled` return; set `settled=true`; if trimmed value
     is empty OR equals the initial basename, cancel via `cleanup()`;
     otherwise commit.

   `cleanup()` removes both listeners via raw `removeEventListener`,
   detaches the input, restores label visibility, and clears
   `currentlyRenamingPath`. The listeners are intentionally attached
   raw (not via `registerDomEvent`) because the input is short-lived
   and `registerDomEvent` would leave stale entries in the view's
   `_registeredDomEvents` bookkeeping — per the plan `<behavior>` spec.

5. **`commitInlineRename(node, rawValue, cleanup)`** — trims value,
   no-ops on empty/unchanged, then either:
   - **File:** `renameSnippet(oldPath, newValue)` → Notice
     «Сниппет переименован.» (no canvas-ref-sync, D-03 следствие 2).
   - **Folder:** `renameFolder(oldPath, newValue)` → mapping
     `new Map([[toCanvasKey(oldPath, root), toCanvasKey(newPath, root)]])`
     → `rewriteCanvasRefs` → walk `snippetTreeExpandedPaths` and
     rewrite every entry that equals `oldPath` or starts with
     `oldPath + '/'` to the new prefix; `saveSettings()` if mutated →
     Notice «Папка переименована. Обновлено канвасов: N, пропущено: M.»

   Catches errors with Russian `Notice` + `console.error`; `finally`
   always runs `cleanup()`. Does NOT manually call `this.renderTree()` —
   the vault 'rename' watcher (Phase 33 SYNC-02) handles the
   debounced redraw.

6. **`onClose` addition** — `this.rowLabelEls.clear()` alongside the
   existing `contentEl.empty()`.

No existing import, handler, method, field, or CSS class was removed.
The `.radi-snippet-tree-rename-input` rule added by Plan 34-02 is
reused as-is.

### `src/__tests__/snippet-tree-inline-rename.test.ts` (511-line rewrite replacing 9 it.todo with 10 real tests)

Full harness mirroring `snippet-tree-dnd.test.ts` (mock DOM, mock
Obsidian `ItemView`/`Menu`/`SuggestModal`, spy on `rewriteCanvasRefs`).
Added `fire`, `findLabelInRow`, `findInputInRow`, `makeKeyEvent`,
`removeEventListener`/`select`/`setSelectionRange`/`replaceChild`/
`remove` to the mock element. Also a deep recursive `findRow` walker
because folder children live in nested row containers (unlike the
flat file children used by DnD tests).

Tests populated:

**enter rename (3):**
1. F2 on file row → input appears inside row with value `'note'` (no
   extension), label still present (hidden).
2. F2 on folder row → input appears with folder basename `'a'`.
3. Context-menu «Переименовать» item triggers the same flow.

**commit (4):**
4. Enter on file input → `renameSnippet` called with `(oldPath, newValue)`;
   `rewriteCanvasRefs` NOT called.
5. Enter on folder input → `renameFolder` called, `rewriteCanvasRefs`
   called exactly once with mapping `Map([['a', 'renamed']])` —
   snippet-root-relative keys per D-03.
6. Enter + synthesized subsequent blur → service called exactly once
   (settled flag locks it).
7. Folder rename → `snippetTreeExpandedPaths` has `root/renamed` and
   `root/renamed/sub`, old entries removed, `saveSettings` called.

**cancel (3):**
8. Escape → no service call, subsequent blur also no service call.
9. Blur with whitespace-only value → no service call.
10. Blur with unchanged basename → no service call.

## Verification

- `npx vitest run src/__tests__/snippet-tree-inline-rename.test.ts`
  → **10 passed, 0 failed, 0 todo** (RED→GREEN in one pass;
  zero `it.todo` remaining).
- `npm test` → **334 passed, 3 pre-existing failures** in
  `runner-extensions.test.ts` ("RED until Plan 02" — Phase 26
  `gsd/phase-26-auto-switch-to-node-editor-tab` work, confirmed
  already failing on HEAD before Plan 03 edits; documented in
  34-00, 34-01, 34-02 summaries). Passing-test count went from 324
  (post-34-02) to 334 — the 10 new inline-rename tests, no
  regressions in any other file.
- `npm run build` → clean (`tsc -noEmit -skipLibCheck` passes,
  esbuild production copied to dev vault).
- `git diff --stat src/views/snippet-manager-view.ts` →
  `1 file changed, 195 insertions(+), 1 deletion(-)` — the single
  deletion is the `row.createSpan(...)` line refactored into
  `const labelEl = row.createSpan(...); this.rowLabelEls.set(...)`.

## Deviations from Plan

None of substance. The plan's `<action>` list was executed verbatim:
1. Added `currentlyRenamingPath` field next to `currentlyEditingPath`.
2. Added `startInlineRename` / `commitInlineRename` helpers with the
   `settled` flag pattern.
3. Added `tabindex='0'` + F2 `registerDomEvent` in `renderNode`.
4. Added «Переименовать» menu items in both branches of
   `openContextMenu`, reaching the label element via the new
   `rowLabelEls` map.
5. CLAUDE.md rule honoured — all edits additive.
6. Replaced all 9 `it.todo` in `snippet-tree-inline-rename.test.ts`
   with 10 real tests (added one extra: blur-with-unchanged-value
   cancel, to lock in the "no accidental commit" semantics).

One minor implementation note (inside plan spirit, not a deviation):
the plan suggested `cancelInlineRename` as a separate method. Because
both paths (Escape + empty-blur + commit-error + commit-success) all
want the same teardown — remove listeners, detach input, restore
label, clear `currentlyRenamingPath` — I collapsed that into a single
closure-scoped `cleanup()` function inside `startInlineRename`. The
effect is identical; the code is simpler.

## Deferred Issues

- `src/__tests__/runner-extensions.test.ts` — 3 failures pre-existing
  on this branch (Phase 26 `gsd/phase-26-auto-switch-to-node-editor-tab`
  work, labelled "RED until Plan 02"). Confirmed on HEAD before Plan 03
  edits. Out of scope for Phase 34.
- `src/styles.css` — generated file not staged per CLAUDE.md.

## Known Stubs

None. Every code path is wired end-to-end against the live
`SnippetService`, `rewriteCanvasRefs`, and `saveSettings` flow.

## Self-Check

- `src/views/snippet-manager-view.ts` — FOUND (modified, +195/-1 lines)
- `src/__tests__/snippet-tree-inline-rename.test.ts` — FOUND (10 green)
- Commit `91ac2c9` (test 34-03 RED) — FOUND
- Commit `5803939` (feat 34-03 GREEN) — FOUND

## Self-Check: PASSED
