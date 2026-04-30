---
phase: 34
plan: 04
subsystem: snippets/views
tags: [move, modal, cleanup, wave-4, regression-guard]
requires:
  - SnippetService.moveSnippet
provides:
  - SnippetEditorModal.handleSave (atomic move branch)
affects:
  - src/views/snippet-editor-modal.ts
  - src/__tests__/snippet-editor-modal.test.ts
tech-stack:
  added: []
  patterns:
    - "Atomic rename via snippetService.moveSnippet instead of save+delete"
    - "View-layer skips canvas-ref-sync on file-only moves (D-03: folder-only refs)"
key-files:
  created: []
  modified:
    - src/views/snippet-editor-modal.ts
    - src/__tests__/snippet-editor-modal.test.ts
decisions:
  - Follow plan literally — save at oldPath first then moveSnippet. Simultaneous
    rename+move preserves old basename (plan-authorized behavior; rename-in-move
    is out of scope for Phase 34, D-10).
  - Removed rewriteCanvasRefs import entirely (only one call site in this file).
requirements: [MOVE-04]
metrics:
  duration: ~15m
  completed: 2026-04-15
---

# Phase 34 Plan 04: Modal Move-on-Save Cleanup Summary

Fixes the Phase 33 debt called out in D-03 and D-10: the modal's `handleSave`
move-on-save branch now uses the atomic `snippetService.moveSnippet` service
method instead of save+delete+placebo-canvas-sync, and the misleading
«Обновлено канвасов: N» Notice is removed from the file-only-move branch.

## What Was Built

### `src/views/snippet-editor-modal.ts`

- **Removed** the `rewriteCanvasRefs` import (no longer used in this file).
- **Removed** the placebo `rewriteCanvasRefs(new Map([[oldPath, newPath]]))`
  call — per D-03, canvas refs are snippet-root-relative and extension-less,
  so passing vault-relative paths with `.json`/`.md` could never match.
- **Removed** the misleading Notice «Сниппет перемещён. Обновлено канвасов: N,
  пропущено: M.» from the file-only-move branch (value N was always 0).
- **Replaced** the Phase 33 save+delete pipeline with:
  1. `snippetService.save(draftAtOldPath)` — writes any name/content changes
     to the existing location.
  2. `const finalPath = await snippetService.moveSnippet(oldPath, newFolder)`
     — atomic rename to the new folder.
  3. `new Notice('Сниппет перемещён.')` — clean, no canvas-count claim.
  4. Resolve `{ saved: true, snippet: finalDraft, movedFrom: oldPath }` with
     `path = finalPath`.
- **Unchanged:** create mode, simple-save mode (oldPath === newPath), error
  handling (`showSaveError` surfaces a Russian error Notice inside the modal
  and leaves it open), unsaved-changes guard, collision pre-flight.
- Updated the file-level comment block to reflect the new pipeline.

### `src/__tests__/snippet-editor-modal.test.ts`

- Extended `MockSnippetService` with a `moveSnippet` spy (default impl
  mirrors the real service behavior — preserves basename under `newFolder`).
- **Rewrote** the D-09 pipeline test into a Phase 34 MOVE-04 regression:
  asserts that `moveSnippet(oldPath, newFolder)` is called and that
  `delete` + `rewriteCanvasRefs` are NOT called from the modal's move branch.
- **Added** a Notice-text regression test: captures `Notice` messages via a
  scoped swap of the mocked `obsidian.Notice` class, verifies the exact text
  `Сниппет перемещён.` appears and no message contains `Обновлено канвасов`.
- **Added** a collision regression test: when `moveSnippet` throws, the
  modal's in-modal save-error element shows «Не удалось сохранить …», the
  result promise stays unresolved (modal open), and neither `delete` nor
  `rewriteCanvasRefs` are called.
- All 11 pre-existing Phase 33 tests (MODAL-01..08 + D-09 rewrite, collision,
  MD-save) still pass — no existing test was removed per CLAUDE.md.

## Verification

- `npx vitest run src/__tests__/snippet-editor-modal.test.ts` — **13/13 pass**
  (8 MODAL-* + 1 collision + 1 MD save + 3 new Phase 34 MOVE-04 regressions).
- `npm run build` — **clean** (tsc + esbuild production).
- `npm test` (full suite) — 336/339 pass. The 3 pre-existing failures are in
  `runner-extensions.test.ts` (explicitly labeled "RED until Plan 02") and are
  completely unrelated to this plan — out of scope per executor rules.
- `grep rewriteCanvasRefs src/views/snippet-editor-modal.ts` → **no matches**
  (import and the single call site both removed).
- `grep "Обновлено канвасов" src/views/snippet-editor-modal.ts` → **no matches**.

## Deviations from Plan

None — plan executed exactly as written.

CLAUDE.md compliance: the plan explicitly authorized the removal of the
placebo `rewriteCanvasRefs` call and the «Обновлено канвасов» Notice (plan
frontmatter `must_haves.truths`), so those targeted deletions are not a
violation of the "never remove code you didn't add" rule.

## Known Stubs

None.

## Self-Check: PASSED

- `src/views/snippet-editor-modal.ts` — modified (commit 1de3f6a)
- `src/__tests__/snippet-editor-modal.test.ts` — modified (commit 1de3f6a)
- Commit `1de3f6a` present in `git log`
- `rewriteCanvasRefs` no longer appears anywhere in the modified source file
- `Обновлено канвасов` no longer appears in the modified source file
