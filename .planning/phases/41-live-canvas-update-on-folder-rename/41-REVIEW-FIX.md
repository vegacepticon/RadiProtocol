---
phase: 41-live-canvas-update-on-folder-rename
fixed_at: 2026-04-17T06:33:00Z
review_path: .planning/phases/41-live-canvas-update-on-folder-rename/41-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-04-17T06:33:00Z
**Source review:** .planning/phases/41-live-canvas-update-on-folder-rename/41-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — critical+warning scope)
- Fixed: 3
- Skipped: 0
- Info findings (out of scope): IN-01..IN-04 (4 items, not touched)

## Fixed Issues

### WR-02: `node['id'] as string` is unchecked

**Files modified:** `src/snippets/canvas-ref-sync.ts`
**Commit:** b1a9241
**Applied fix:** Added `typeof id !== 'string' || id === ''` guard before pushing the node to
`editsToApply`. Malformed canvas nodes (missing/non-string `id`) are now skipped in the
live-path collection loop, so `saveLive`/`saveLiveBatch` can no longer receive `undefined`
and accidentally mutate the first id-less node (or silently return false and trigger the
WR-01 fallback semantics). The disk path did not need this guard because it mutates the
node object directly without dereferencing `id`.

### WR-01: Mid-iteration live→disk fallback write-order race

**Files modified:** `src/canvas/canvas-live-editor.ts`, `src/snippets/canvas-ref-sync.ts`, `src/__tests__/canvas-ref-sync.test.ts`
**Commit:** 555809b (combined with WR-03 — the two changes touch the same per-file loop body)
**Applied fix:** Approach (a) from the review — single atomic live write per canvas.
1. Added `CanvasLiveEditor.saveLiveBatch(filePath, nodeEdits[])` which performs ONE
   `getData → locate all targets → mutate all → setData → debouncedRequestSave` cycle.
   If any target `nodeId` is missing, the method returns `false` WITHOUT calling `setData`,
   so the live view is pristine on failure (no partial mutation, no stray pending debounce
   timer to race `vault.modify`).
2. Updated `rewriteCanvasRefs` live branch to call `saveLiveBatch` once per canvas instead
   of looping `saveLive` per node. On `false` return the fallback to `vault.modify` now
   begins from a clean view.
3. The existing single-node `CanvasLiveEditor.saveLive` method is preserved (still used by
   `EditorPanelView`).
4. Updated the six Phase 41 live-path tests to assert the new batched contract:
   a single `saveLiveBatch` call per canvas carrying all matching node edits, with
   `saveLiveResult: false` triggering the fallback path.

**Requires human verification:** The batched semantics match the review's approach (a),
but the exact rollback-on-partial-failure behaviour (no `setData` when any target node is
absent) differs slightly from the per-node `saveLive` rollback (which throws only on
`setData` errors). The developer should confirm this stricter semantics is what they want.

### WR-03: Live path not guarded by per-file write mutex

**Files modified:** `src/snippets/canvas-ref-sync.ts`
**Commit:** 555809b (combined with WR-01)
**Applied fix:** Wrapped the entire per-file iteration (both the live path and the
`vault.modify` fallback) in a single `canvasMutex.runExclusive(file.path, async () => { ... })`
block. The outer `try/catch` was moved inside the mutex callback. Control flow uses
`return` (instead of the previous `continue`) to early-exit the callback — the outer
`for` loop still iterates through every canvas. This restores the invariant
"one writer per canvas path" to the module regardless of whether the writer is
`saveLiveBatch` or `vault.modify`, matching the review's recommended fix.

## Verification

- `npm test -- --run` — 385/385 tests pass (28 files).
- `npm run build` — production build succeeds (`tsc -noEmit -skipLibCheck` + esbuild clean).
- No TypeScript errors in the three modified source files (`npx tsc --noEmit` ran clean for
  `src/canvas/canvas-live-editor.ts`, `src/snippets/canvas-ref-sync.ts`, and
  `src/__tests__/canvas-ref-sync.test.ts`; only pre-existing `node_modules` type-resolution
  noise under `vite/module-runner`).

## Out-of-scope (info-level) findings

IN-01 (live-path error handling masks reason), IN-02 (tests use `as any`),
IN-03 (mid-iteration test does not assert exact saveLive call count),
IN-04 (duplicate live-vs-disk node-walking logic) were NOT touched because
`fix_scope` is `critical_warning`. Note that IN-03's underlying concern is now moot —
the batched API asserts the exact invariant (one `saveLiveBatch` call, carrying every
expected edit) in the updated tests.

---

_Fixed: 2026-04-17T06:33:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
