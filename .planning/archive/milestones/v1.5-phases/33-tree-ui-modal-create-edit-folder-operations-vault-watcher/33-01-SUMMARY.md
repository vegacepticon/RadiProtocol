---
phase: 33
plan: 01
subsystem: snippets
tags: [service, folder-ops, settings, wave-0-stubs]
provides:
  - SnippetService.createFolder(path): Promise<void>
  - SnippetService.deleteFolder(path): Promise<void>
  - SnippetService.listFolderDescendants(path): { files, folders, total }
  - RadiProtocolSettings.snippetTreeExpandedPaths: string[]
  - Wave 0 test stubs for TREE / MODAL / SYNC requirements
requires:
  - SnippetService.assertInsideRoot (Phase 32)
  - WriteMutex (Phase 7)
  - ensureFolderPath (utils/vault-utils)
affects: []
tech-stack:
  added: []
  patterns: [path-safety-gate, write-mutex, adapter.list recursion]
key-files:
  created:
    - src/__tests__/snippet-tree-view.test.ts
    - src/__tests__/snippet-editor-modal.test.ts
    - src/__tests__/snippet-vault-watcher.test.ts
  modified:
    - src/snippets/snippet-service.ts
    - src/settings.ts
    - src/__tests__/snippet-service.test.ts
decisions:
  - D-17 deleteFolder does NOT call rewriteCanvasRefs — broken refs are accepted
  - listFolderDescendants uses BFS queue + adapter.list for recursive walk
metrics:
  completed: 2026-04-15
  duration_minutes: 3
---

# Phase 33 Plan 01: Service Folder Operations + Wave 0 Scaffolds Summary

**One-liner:** Added path-gated `createFolder` / `deleteFolder` / `listFolderDescendants` to SnippetService, the `snippetTreeExpandedPaths` setting, and three Wave 0 test stub files so later waves have real `<automated>` targets.

## What Changed

### `src/snippets/snippet-service.ts`
Three new methods appended after `exists()`, no existing code touched:

- `createFolder(path)` — path-safety gate → throws on unsafe; otherwise `mutex.runExclusive(normalized, () => ensureFolderPath(vault, normalized))`. Idempotent.
- `deleteFolder(path)` — silent no-op on unsafe/missing; otherwise `mutex.runExclusive(normalized, () => vault.trash(folder, false))`. Single recursive trash call. Does NOT rewrite canvas refs per D-17 refined.
- `listFolderDescendants(path)` — BFS queue walk via `vault.adapter.list`, collects vault-relative file + folder paths, returns `{ files, folders, total }`. Unsafe path → empty.

### `src/settings.ts`
- Added `snippetTreeExpandedPaths: string[]` to `RadiProtocolSettings`.
- Added default `[]` in `DEFAULT_SETTINGS`.

### `src/__tests__/snippet-service.test.ts`
- Added `snippetTreeExpandedPaths: []` to the shared test `settings` fixture (needed to satisfy the new required field).
- Three new `describe` blocks with 8 tests total covering: happy path, idempotency, unsafe-path rejection, missing folder no-op, vault.trash argument shape, descendants BFS, descendants unsafe-path guard.

### New Wave 0 stub files (three)
Each contains `it.skip` placeholders tagged by requirement ID — collected by vitest as skipped so Plans 03/04 can attach real assertions without creating the files:
- `src/__tests__/snippet-tree-view.test.ts` — TREE-01..04
- `src/__tests__/snippet-editor-modal.test.ts` — MODAL-01..08
- `src/__tests__/snippet-vault-watcher.test.ts` — SYNC-01..03

## Verification

- `npx vitest run src/__tests__/snippet-service.test.ts` → 56 passed
- Full suite: 269 passed, 15 skipped, 3 pre-existing failures in `runner-extensions.test.ts` (documented tech debt — out of scope per SCOPE BOUNDARY rule)
- `npm run build` → tsc + esbuild green

## Deviations from Plan

**[Rule 3 — Blocking] Added `snippetTreeExpandedPaths` to test fixture.**
- **Found during:** Task 2 build step
- **Issue:** `RadiProtocolSettings.snippetTreeExpandedPaths` became required; existing `settings` fixture in `snippet-service.test.ts` lacked the field → TS2345 errors in 2 call sites.
- **Fix:** Added `snippetTreeExpandedPaths: [] as string[]` to the shared fixture.
- **Commit:** 9690917

**[Scope boundary] Pre-existing failures in `runner-extensions.test.ts`.**
PROJECT.md lists "3 RED test stubs in runner-extensions.test.ts" as known tech debt. These tests fail on the same assertions they did before this plan. Not related to snippet service changes. Not fixed.

## Commits

- `61a4e30` feat(33-01): add createFolder/deleteFolder/listFolderDescendants to SnippetService
- `9690917` feat(33-01): add snippetTreeExpandedPaths setting + Wave 0 test scaffolds

## Acceptance Criteria

- [x] `async createFolder` / `async deleteFolder` / `async listFolderDescendants` each match exactly once in snippet-service.ts
- [x] All three new methods call `assertInsideRoot`
- [x] `vault.trash` call count in service ≥ 2 (legacy delete + deleteFolder)
- [x] `rewriteCanvasRefs` still 0 matches (deleteFolder does not call it)
- [x] `snippetTreeExpandedPaths` present in interface + defaults
- [x] Three stub files exist with it.skip placeholders per requirement ID
- [x] `npm run build` exits 0
- [x] Service tests pass; stubs collected as skipped

## Self-Check: PASSED

- FOUND: src/snippets/snippet-service.ts (modified)
- FOUND: src/settings.ts (modified)
- FOUND: src/__tests__/snippet-service.test.ts (modified)
- FOUND: src/__tests__/snippet-tree-view.test.ts (created)
- FOUND: src/__tests__/snippet-editor-modal.test.ts (created)
- FOUND: src/__tests__/snippet-vault-watcher.test.ts (created)
- FOUND commit: 61a4e30
- FOUND commit: 9690917
