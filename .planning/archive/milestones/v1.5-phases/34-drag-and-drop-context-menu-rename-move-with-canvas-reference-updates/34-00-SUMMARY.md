---
phase: 34
plan: 00
subsystem: snippets/service
tags: [move, rename, service-layer, wave-0, tdd]
requires: []
provides:
  - SnippetService.renameSnippet
  - SnippetService.moveSnippet
  - SnippetService.renameFolder
  - SnippetService.moveFolder
  - SnippetService.listAllFolders
  - toCanvasKey (exported pure helper)
affects:
  - src/snippets/snippet-service.ts
  - src/__tests__/snippet-service-move.test.ts
  - src/__tests__/snippet-tree-dnd.test.ts
  - src/__tests__/snippet-tree-inline-rename.test.ts
tech-stack:
  added: []
  patterns:
    - WriteMutex.runExclusive per normalized source path
    - assertInsideRoot gate on source AND destination
    - Pre-flight collision check via adapter.exists before any mutation
    - Self-descendant guard via startsWith(old + '/') on folder moves
key-files:
  created:
    - src/__tests__/snippet-service-move.test.ts
    - src/__tests__/snippet-tree-dnd.test.ts
    - src/__tests__/snippet-tree-inline-rename.test.ts
  modified:
    - src/snippets/snippet-service.ts
decisions:
  - Followed D-01 Option A — service stays I/O-only, no canvas-sync inside new methods
  - toCanvasKey exported from snippet-service.ts (not canvas-ref-sync.ts) — keeps the
    canvas-ref module free of snippet-root coupling and makes it reusable by view
    callers translating vault paths into mapping keys
  - moveFolder rejects both target==source and target==descendant AND final==source/descendant
    to defensively cover every self-nest edge case
requirements: [MOVE-01, MOVE-02, MOVE-05, RENAME-03]
metrics:
  duration: ~25m
  completed: 2026-04-15
---

# Phase 34 Plan 00: SnippetService Move/Rename API + Wave 0 Test Scaffolding Summary

Service-layer foundation for Phase 34 — adds four new vault-I/O methods
(`renameSnippet`, `moveSnippet`, `renameFolder`, `moveFolder`) plus the
exported `toCanvasKey` helper and `listAllFolders` convenience wrapper, all
with full unit coverage and Wave 0 test stubs for downstream DnD and inline
rename plans.

## What Was Built

### `src/snippets/snippet-service.ts` (+176 lines, 0 removed)

1. **Exported pure helper `toCanvasKey(vaultPath, snippetRoot)`** — strips the
   snippet-root prefix and trailing `.json`/`.md` extension. Returns `''` for
   the root itself. This is the single source of truth for translating
   vault-relative paths into the snippet-root-relative keys that
   `rewriteCanvasRefs` consumes (D-03). Downstream callers use it both to
   build mappings and to inspect on-disk `radiprotocol_subfolderPath` values.

2. **`renameSnippet(oldPath, newBasename)`** — renames a file in place,
   preserving its extension. Rejects slash-containing / empty basenames.
   No-op when the normalized old and new paths are identical. Collision
   check runs before any I/O, and the rename is wrapped in
   `mutex.runExclusive`.

3. **`moveSnippet(oldPath, newFolder)`** — moves a file into another folder
   under the snippet root. Calls `ensureFolderPath` for the destination before
   renaming so drops into freshly created folders succeed without a separate
   precreate step.

4. **`renameFolder(oldPath, newBasename)`** — same shape as `renameSnippet`
   but operates on a `TFolder`. Defensive self-descendant check even though
   the parent is fixed.

5. **`moveFolder(oldPath, newParent)`** — includes a CRITICAL self-descendant
   guard: rejects when `newParent === oldPath` OR `newParent.startsWith(oldPath + '/')`,
   and also rejects the computed `newPath` against the same condition. Without
   this guard a user could drag `root/a` into `root/a/sub` and create an
   infinite loop in the vault.

6. **`listAllFolders()`** — returns the sorted, deduped list of every folder
   under the snippet root (root included), via `listFolderDescendants`. This
   is the new single source for folder-option lists consumed by
   `FolderPickerModal` (plan 02) and the existing `SnippetEditorModal`
   (plan 04 regression).

No existing method, import, or field was removed — CLAUDE.md rule honoured.

### `src/__tests__/snippet-service-move.test.ts` (NEW, 29 tests, all green)

Full coverage for every branch of Task 1:

- `toCanvasKey` — 6 cases: `.json` strip, `.md` strip, folder path unchanged,
  root-equals-root empty string, nested folder no-extension, prefix miss.
- `renameSnippet` — happy path, extension preservation, slash rejection,
  whitespace rejection, unsafe source, no-op identity, destination collision,
  WriteMutex serialization via concurrent double-call.
- `moveSnippet` — happy path, ensure-folder-path call, collision, outside-root.
- `renameFolder` — happy path, slash rejection, collision.
- `moveFolder` — happy path, ensure-parent call, self guard (`a → a`),
  descendant guard (`a → a/sub`), collision, outside-root.
- `listAllFolders` — sorted output with root, root-only case.

### `src/__tests__/snippet-tree-dnd.test.ts` (NEW, 13 it.todo)

Wave 0 contract stub enumerating every DnD scenario Plan 02 must implement:
dragstart MIME payload, dragover guard, drop outcomes (file→folder,
folder→folder, self/descendant rejection, file-row → parent redirect), and
Move-to-… context menu integration with `FolderPickerModal`.

### `src/__tests__/snippet-tree-inline-rename.test.ts` (NEW, 9 it.todo)

Wave 0 contract stub for Plan 03's F2 inline rename: entry points (F2,
context menu), basename-without-extension selection, Enter commit via
service, Escape/blur cancellation, and the `settled` flag that prevents
Enter+blur double-commits.

## Verification

- `npx vitest run src/__tests__/snippet-service-move.test.ts` → **29/29 passing**
- `npx vitest run src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
  → **22/22 todo** (as intended — downstream plans will populate)
- `npm run build` → clean (tsc -noEmit passes, esbuild copies to dev vault)
- `git diff --stat src/snippets/snippet-service.ts` → **176 additions, 0 deletions**

## Deviations from Plan

None — plan executed exactly as written. Order of operations: I wrote the
test file first (RED), ran it against the unmodified service to confirm it
failed, then implemented the four methods + helper (GREEN), and finally the
stubs (Task 3). Committed as two atomic units (feat+test for tasks 1-2,
test for task 3).

## Deferred Issues

Pre-existing failures in `src/__tests__/runner-extensions.test.ts` (3 failing
tests labeled "RED until Plan 02") belong to Phase 26's auto-switch branch
and are unrelated to Phase 34. Confirmed present on `HEAD` prior to any of
this plan's edits. Out of scope — no action taken.

## Self-Check

- `src/snippets/snippet-service.ts` — FOUND (modified, 492 lines)
- `src/__tests__/snippet-service-move.test.ts` — FOUND (29 tests passing)
- `src/__tests__/snippet-tree-dnd.test.ts` — FOUND (13 todo)
- `src/__tests__/snippet-tree-inline-rename.test.ts` — FOUND (9 todo)
- Commit `a837c89` (feat 34-00 service + tests) — FOUND
- Commit `3978dfe` (test 34-00 stubs) — FOUND

## Self-Check: PASSED
