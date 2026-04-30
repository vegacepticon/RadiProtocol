---
phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
plan: 04
subsystem: snippets
tags: [tests, snippet-service, canvas-ref-sync, MD-05, DEL-01, D-05, D-06, D-09, D-10]
dependency_graph:
  requires: [32-01, 32-02, 32-03]
  provides: [snippet-service-tests, canvas-ref-sync-tests, canvas-multi-fixtures]
  affects: []
tech_stack:
  added: []
  patterns: [vitest, in-memory-mock-vault, fixture-based-canvas-tests]
key_files:
  created:
    - src/__tests__/canvas-ref-sync.test.ts
    - src/__tests__/fixtures/snippet-node-multi-a.canvas
    - src/__tests__/fixtures/snippet-node-multi-b.canvas
    - src/__tests__/fixtures/snippet-node-broken.canvas
    - .planning/phases/32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync/deferred-items.md
  modified:
    - src/__tests__/snippet-service.test.ts
decisions:
  - "Test suite rebuilt around shared makeVault() factory that records trash spy"
  - "Serialisation ordering used as WriteMutex proof (instead of runExclusive spy)"
  - "Broken canvas fixture validated via meta-check test (JSON.parse throws)"
metrics:
  duration_seconds: 189
  completed_date: 2026-04-15
---

# Phase 32 Plan 04: SnippetService + canvas-ref-sync Unit Tests Summary

One-liner: Locks in extension routing (MD-05), vault.trash delete (DEL-01), path-safety gate (D-10), JSON/MD coexistence (D-09), and canvas-ref-sync exact/prefix/best-effort/no-op semantics (D-05/D-06) via 58 new vitest assertions across two test files and three new canvas fixtures.

## What Shipped

### Task 1 — snippet-service.test.ts (commit `eb164b6`)

Rewrote the test file with a shared `makeVault()` factory (files + folders + abstractFiles map, `trash: vi.fn()`). Resulting suite: 48 tests across 8 `describe` blocks.

- **API surface** — presence check + explicit absence of legacy `list()`.
- **listFolder happy paths** — retained from Phase 30 (sorted, missing folder, corrupt skip, sibling-prefix rejection). Adapter-read count assertion updated to match new .md-aware behaviour.
- **listFolder extension routing (MD-05)** — returns `JsonSnippet` for `.json`, `MdSnippet` for `.md` with raw content, both kinds when `foo.json` and `foo.md` coexist (D-09), skips unrelated extensions.
- **load(path) routing** — JSON / MD / missing / corrupt / unsafe-path null.
- **save(Snippet) branching** — JSON serialisation strips runtime-only `kind`/`path`/`id` fields; MD writes raw content verbatim; sanitise strips control chars; unsafe path throws; **concurrent saves on the same path serialise (WriteMutex D-11)** — proven by recording start/end ordering around a delayed writer.
- **delete(path) (DEL-01, D-08)** — asserts `vault.trash(file, false)` called exactly once (the `false` is load-bearing); no-op on missing file; trash NOT called for unsafe path.
- **exists(path)** — true / false / unsafe-path short-circuit.
- **Parameterised path-safety gate (D-10)** — 4 unsafe paths × 5 methods (load, save, delete, exists, listFolder) = 20 parameterised rejections.

All 48 tests pass.

### Task 2 — canvas-ref-sync.test.ts + fixtures (commit `ce3b25f`)

Created three new fixtures under `src/__tests__/fixtures/`:
- `snippet-node-multi-a.canvas` — one snippet node with `subfolderPath='a/b'` + one question node + edge.
- `snippet-node-multi-b.canvas` — one snippet node with `subfolderPath='a/b/sub'` (prefix case) + one snippet node with `subfolderPath=''` (WR-02 root sentinel).
- `snippet-node-broken.canvas` — literal invalid JSON `{ "nodes": [ { not json`.

Created `src/__tests__/canvas-ref-sync.test.ts` with 10 tests driven by an in-memory `makeApp()` mock exposing `getFiles/read/modify/getAbstractFileByPath`:

1. Meta-check: broken fixture is genuinely invalid JSON (`JSON.parse` throws).
2. Exact-match rename (`a/b` → `a/c`) — writes updated canvas, `updated` contains path.
3. Prefix folder-move — `a/b/sub` becomes `a/c/sub`.
4. WR-02 empty-string preservation — root-sentinel node untouched.
5. No mapping hit — canvas untouched, `vault.modify` never called.
6. No-op early return — canvas without any snippet nodes never written.
7. Best-effort broken JSON skip — `skipped[0]` has `reason` matching `/JSON|invalid/i`, other canvases still processed.
8. Multi-canvas in one pass — both fixtures updated with their respective (exact vs prefix) mappings.
9. Empty mapping — short-circuits before calling `vault.read`.
10. Non-.canvas files filtered out of the scan.

All 10 tests pass.

## Verification

- `npm test -- snippet-service` → 48/48 pass
- `npm test -- canvas-ref-sync` → 10/10 pass
- `npm test` (full suite) → 261 pass, **3 pre-existing failures in `runner-extensions.test.ts` unrelated to Phase 32** (see Deferred Issues)

### Requirement Coverage

- **MD-05** (markdown snippet support) → `listFolder extension routing` describe block, `load(path) routing` MD case, `save(Snippet) branching` MD case.
- **DEL-01** (trash delete) → `delete(path) uses Obsidian trash` — literal `expect(system).toBe(false)` assertion.
- **D-10** (path-safety gate) → parameterised 20-test matrix.
- **D-09** (JSON+MD coexistence) → explicit `foo.json`+`foo.md` coexistence test.
- **D-05/D-06** (canvas rewrite exact/prefix/best-effort/no-op) → 8 of 10 `canvas-ref-sync` tests.

## Deviations from Plan

None. Plan executed exactly as written. The plan's hint about "spy on a shared mutex" was resolved by the alternative option the plan itself allowed ("or by verifying serialisation ordering for two concurrent calls to the same path") — chosen because `WriteMutex` is a private field and a concrete ordering assertion is stronger than a call spy.

### Pre-existing test fixes rolled in

The Phase 30 listFolder tests that were already failing on disk before Plan 32-04 started (3 tests) were silently corrected as part of the Task 1 rewrite:
- `non-.json files are filtered out` — updated read-count expectation (the `.md` file is now read as an MdSnippet rather than filtered out).
- `rejects path with .. segments` / `rejects absolute path outside root` — updated log message regex from `/listFolder rejected unsafe path/` to `/snippet-service rejected unsafe path/` to match the Phase 32 helper consolidation from Plan 32-01.

These are test corrections, not behaviour changes — the production code already logged the new message.

## Deferred Issues

**`src/__tests__/runner-extensions.test.ts` — 3 pre-existing failures**
- Scoped as out-of-plan by deviation rule (scope boundary).
- Test names include "RED until Plan 02" — these are TDD RED-state tests from a future `ProtocolRunner` extension phase (RUN-11), left over from an earlier planning iteration.
- Confirmed failing on the base tree via `git stash` before Plan 32-04 work.
- Tracked in `.planning/phases/32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync/deferred-items.md`.

## Threat Flags

None — tests introduce no new surface; fixtures are static and local to `__tests__/fixtures`.

## Self-Check: PASSED

**Files exist:**
- FOUND: `src/__tests__/snippet-service.test.ts`
- FOUND: `src/__tests__/canvas-ref-sync.test.ts`
- FOUND: `src/__tests__/fixtures/snippet-node-multi-a.canvas`
- FOUND: `src/__tests__/fixtures/snippet-node-multi-b.canvas`
- FOUND: `src/__tests__/fixtures/snippet-node-broken.canvas`

**Commits exist:**
- FOUND: `eb164b6` — test(32-04): extend snippet-service suite for new API
- FOUND: `ce3b25f` — test(32-04): add canvas-ref-sync suite + 3 fixtures
