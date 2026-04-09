---
phase: 05-dynamic-snippets
plan: "00"
subsystem: testing
tags: [vitest, async-mutex, tdd, snippets, mocks]

# Dependency graph
requires:
  - phase: 04-canvas-node-editor-side-panel
    provides: obsidian.ts mock baseline (Modal, ItemView, Setting, etc.)
provides:
  - async-mutex installed as production dependency
  - Modal mock extended with titleEl field and lifecycle stubs
  - Four RED test suites defining behavioral contracts for SNIP-01, SNIP-02, SNIP-07, SNIP-08
affects: [05-01, 05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: [async-mutex@0.5.0]
  patterns: [TDD RED stubs — tests exist before implementation; vault mock pattern with adapter.exists + createFolder]

key-files:
  created:
    - src/__tests__/snippet-model.test.ts
    - src/__tests__/snippet-service.test.ts
    - src/__tests__/write-mutex.test.ts
    - src/__tests__/vault-utils.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/__mocks__/obsidian.ts

key-decisions:
  - "async-mutex added to dependencies (not devDependencies) — WriteMutex uses it at runtime in plugin code"
  - "Modal mock extended with titleEl before SnippetFillInModal implementation — avoids runtime crash in wave 3 tests"
  - "vault-utils tests use vault as never cast to bypass current single-arg stub signature — correct RED behavior"

patterns-established:
  - "Vault mock pattern: { adapter: { exists }, createFolder } — minimal surface for ensureFolderPath tests"
  - "App mock pattern: makeAppMock() wraps vault mock — used in SnippetService tests"

requirements-completed: [SNIP-01, SNIP-02, SNIP-07, SNIP-08]

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 05 Plan 00: Wave 0 — async-mutex install + RED test stubs

**async-mutex@0.5.0 installed, Modal mock extended with titleEl, four RED test suites establish behavioral contracts for SnippetService CRUD, WriteMutex serialization, ensureFolderPath idempotency, and renderSnippet/slugifyLabel**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T16:00:00Z
- **Completed:** 2026-04-06T16:12:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- async-mutex@0.5.0 added to production dependencies (required for WriteMutex implementation in wave 1)
- Modal mock class extended with `titleEl` field and `onOpen`/`onClose` stubs — prepares mock for SnippetFillInModal (wave 3)
- Four failing test suites created covering 19 tests across SNIP-01 (SnippetService), SNIP-02 (renderSnippet/slugifyLabel), SNIP-07 (WriteMutex), SNIP-08 (ensureFolderPath)
- All failures are assertion-level (not import errors), confirming RED state is correct and implementation stubs are importable

## Task Commits

Each task was committed atomically:

1. **Task 1: Install async-mutex and extend obsidian mock with titleEl** - `5be9ece` (chore)
2. **Task 2: Create four RED test stubs** - `7869ee2` (test)

## Files Created/Modified

- `package.json` — added async-mutex@0.5.0 to dependencies
- `package-lock.json` — lockfile updated after npm install
- `src/__mocks__/obsidian.ts` — Modal class extended: added titleEl field, constructor init, onOpen/onClose stubs
- `src/__tests__/snippet-model.test.ts` — RED tests: SnippetPlaceholder optional fields (options, unit, joinSeparator), renderSnippet substitution and unit suffix, slugifyLabel
- `src/__tests__/snippet-service.test.ts` — RED tests: SnippetService CRUD method existence (list, load, save, delete, exists)
- `src/__tests__/write-mutex.test.ts` — RED tests: WriteMutex.runExclusive existence and serialization ordering
- `src/__tests__/vault-utils.test.ts` — RED tests: ensureFolderPath idempotency (no-op when folder exists, createFolder call when absent)

## Decisions Made

- async-mutex placed in `dependencies` (not `devDependencies`) because WriteMutex imports it in production plugin code, not just tests
- Modal mock titleEl added proactively before wave 3 to avoid fixture setup in that plan
- `as never` cast in vault-utils tests is intentional — bypasses TypeScript on the stub signature without modifying the stub

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The following source files remain stubs — they are the implementation targets for subsequent waves:

| File | Stub | Resolved In |
|------|------|-------------|
| `src/snippets/snippet-model.ts` | No `renderSnippet` or `slugifyLabel` exports, no optional fields on `SnippetPlaceholder` | Plan 05-01 |
| `src/snippets/snippet-service.ts` | Empty class — no methods | Plan 05-01 |
| `src/utils/write-mutex.ts` | Empty class — no `runExclusive` | Plan 05-01 |
| `src/utils/vault-utils.ts` | Wrong signature — only accepts `(path: string)` not `(vault, folderPath)` | Plan 05-01 |

These stubs are intentional — Wave 0 by design creates RED tests before GREEN implementation.

## Self-Check: PASSED

- `src/__tests__/snippet-model.test.ts` — exists, contains `renderSnippet`
- `src/__tests__/snippet-service.test.ts` — exists, contains `SnippetService`
- `src/__tests__/write-mutex.test.ts` — exists, contains `WriteMutex`
- `src/__tests__/vault-utils.test.ts` — exists, contains `ensureFolderPath`
- Commit `5be9ece` — exists (chore: async-mutex + Modal titleEl)
- Commit `7869ee2` — exists (test: four RED stubs)
- `npm list async-mutex` — returns `async-mutex@0.5.0`
- `src/__mocks__/obsidian.ts` Modal class has `titleEl` at line 113
