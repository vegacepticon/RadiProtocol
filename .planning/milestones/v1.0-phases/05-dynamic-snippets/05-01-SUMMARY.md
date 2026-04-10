---
phase: 05-dynamic-snippets
plan: "01"
subsystem: snippets-data-layer
tags: [snippets, crud, async-mutex, write-mutex, vault-utils, tdd, settings]

# Dependency graph
requires:
  - phase: 05-00
    provides: async-mutex installed, four RED test suites
provides:
  - SnippetPlaceholder with options, unit, joinSeparator fields
  - renderSnippet pure function for template substitution
  - slugifyLabel pure function for id generation
  - WriteMutex per-file async lock (async-mutex backed)
  - ensureFolderPath idempotent vault folder guard
  - SnippetService CRUD (list/load/save/delete/exists)
  - settings.snippetFolderPath defaulting to .radiprotocol/snippets
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - WriteMutex.runExclusive(path, fn) — per-file mutex wrapping every vault write
    - ensureFolderPath(vault, path) — adapter.exists guard before createFolder
    - SnippetService sanitize() — control char stripping before JSON.stringify
    - split/join token replacement — replaceAll alternative for ES6 targets

key-files:
  created: []
  modified:
    - src/snippets/snippet-model.ts
    - src/utils/write-mutex.ts
    - src/utils/vault-utils.ts
    - src/snippets/snippet-service.ts
    - src/settings.ts

key-decisions:
  - "split/join used for token replacement in renderSnippet — avoids replaceAll (ES2021+) incompatibility with ES6 target"
  - "SnippetService.delete() uses instanceof Object + 'stat' in file guard — avoids dynamic TFile import while remaining type-safe"
  - "SnippetService.save() calls vault.create() for new files, vault.adapter.write() for updates — matches vault API semantics"
  - "tsc --noEmit errors in node_modules/vitest are pre-existing (moduleResolution: node incompatibility) — src/ files compile clean"

# Metrics
duration: ~8min
completed: 2026-04-06
---

# Phase 05 Plan 01: Wave 1 — Data Layer Implementation

**SnippetPlaceholder extended with options/unit/joinSeparator, renderSnippet + slugifyLabel implemented, WriteMutex per-file lock, ensureFolderPath idempotent guard, SnippetService full CRUD, snippetFolderPath added to settings — 19 tests across 4 suites GREEN**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-06T19:14:46Z
- **Completed:** 2026-04-06T19:18:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `SnippetPlaceholder` interface extended with three optional fields: `options?: string[]`, `unit?: string`, `joinSeparator?: string` (D-16, SNIP-02)
- `renderSnippet(snippet, values)` implemented with number+unit suffix handling and split/join token replacement (ES6 compatible)
- `slugifyLabel(label)` implemented converting "Patient age" → "patient-age", "Size (mm)" → "size-mm" (D-04)
- `WriteMutex` implemented using `async-mutex` Mutex, per-file keyed lock map (SNIP-07, T-5-02)
- `ensureFolderPath(vault, folderPath)` implemented with `adapter.exists()` guard before `createFolder()` (SNIP-08, T-5-03)
- `SnippetService` full CRUD: list(), load(), save(), delete(), exists() backed by vault adapter (SNIP-01, D-14)
- `SnippetService.save()` wraps write in `WriteMutex.runExclusive()` and calls `ensureFolderPath()` before every write
- `SnippetService.save()` includes `sanitize()` that strips U+0000–U+001F, U+007F control chars from all string fields (T-5-01)
- `settings.ts` `RadiProtocolSettings` extended with `snippetFolderPath: string` defaulting to `.radiprotocol/snippets` (D-15)
- All 4 Vitest suites GREEN: snippet-model (9), write-mutex (2), vault-utils (3), snippet-service (5) = 19 total

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend snippet-model.ts — renderSnippet, slugifyLabel, SnippetPlaceholder fields** — `c08d79a` (feat)
2. **Task 2: WriteMutex, ensureFolderPath, SnippetService, settings update** — `9ce1c05` (feat)

## Files Modified

| File | Change |
|------|--------|
| `src/snippets/snippet-model.ts` | Added `options?`, `unit?`, `joinSeparator?` to `SnippetPlaceholder`; added `renderSnippet` and `slugifyLabel` exports |
| `src/utils/write-mutex.ts` | Full `WriteMutex` implementation with `async-mutex` Mutex, per-path lock map |
| `src/utils/vault-utils.ts` | `ensureFolderPath(vault, folderPath)` with `adapter.exists()` guard before `createFolder()` |
| `src/snippets/snippet-service.ts` | Full `SnippetService` CRUD class with `WriteMutex`, `ensureFolderPath`, `sanitize()` |
| `src/settings.ts` | Added `snippetFolderPath: string` to interface and `DEFAULT_SETTINGS` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules empty in worktree — npm install required**
- **Found during:** Task 2 (first test run)
- **Issue:** The worktree's `node_modules` directory was empty (no packages installed). `async-mutex` was declared in `package.json` and `package-lock.json` from Wave 0, but the worktree needed its own `npm install` to populate the directory.
- **Fix:** Ran `npm install` in the worktree root — 353 packages installed in 7s. All test suites then passed.
- **Files modified:** `node_modules/` (not committed — gitignored)
- **Commit:** N/A (runtime dependency, not source change)

**2. [Rule 1 - Bug] SnippetService.delete() — avoided dynamic import of TFile**
- **Found during:** Task 2 implementation
- **Issue:** The plan's suggested `delete()` implementation used a dynamic `import('obsidian')` to get the `TFile` class for instanceof check. This pattern is unusual for this codebase and unnecessary since the vault mock in tests returns null from `getAbstractFileByPath()` anyway.
- **Fix:** Used `instanceof Object && 'stat' in file` duck-type guard instead of `instanceof TFileClass`. This avoids the dynamic import entirely while remaining safe and compatible with the test environment.
- **Files modified:** `src/snippets/snippet-service.ts`

## Known Stubs

None. All stubs from Wave 0 are now fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, or external trust boundaries introduced. All file access goes through vault adapter (already in threat model). The `sanitize()` method was implemented as required by T-5-01.

## Self-Check: PASSED

- `src/snippets/snippet-model.ts` — exists, contains `renderSnippet`, `slugifyLabel`, `options?: string[]`, `unit?: string`, `joinSeparator?: string`
- `src/utils/write-mutex.ts` — exists, contains `WriteMutex`, `import { Mutex } from 'async-mutex'`, `private locks = new Map`
- `src/utils/vault-utils.ts` — exists, contains `ensureFolderPath`, `vault.adapter.exists`, `vault.createFolder`
- `src/snippets/snippet-service.ts` — exists, contains `SnippetService`, `mutex.runExclusive`, `ensureFolderPath`, `sanitize`
- `src/settings.ts` — contains `snippetFolderPath: string` in interface and `'.radiprotocol/snippets'` in DEFAULT_SETTINGS
- Commit `c08d79a` — exists (feat: snippet-model)
- Commit `9ce1c05` — exists (feat: WriteMutex + SnippetService + settings)
- All 19 tests GREEN across 4 suites
- `src/` files compile with no TypeScript errors (node_modules/vitest errors are pre-existing)
