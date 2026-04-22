---
phase: 50-answer-edge-label-sync
plan: 03
subsystem: canvas/live-editor
tags: [typescript, pattern-b, canvas-live-editor, edge-label-sync, tdd, atomicity]

# Dependency graph
requires:
  - plan: 50-01
    provides: CanvasEdgeData typed interface on CanvasData.edges (unlocks typed updatedData.edges.find(e => e.id === ...) in this plan)
provides:
  - CanvasLiveEditor.saveLiveEdges(filePath, edgeEdits) — Pattern B write for edge-label-only changes (D-12)
  - CanvasLiveEditor.saveLiveBatch extended with optional 3rd edgeEdits param (D-14) — atomic node+edges single-setData
  - 5 new write-back integration tests proving D-08 strip-key + D-14 atomicity + first-pass-validate rejection + back-compat
affects:
  - Plan 50-04 (EdgeLabelSyncService wire-up + editor-panel-view Display-label atomic write) — consumes both methods as its Pattern B call-sites
  - Plan 50-05 (Strategy A fallback for closed canvases) — mirrors the D-08 undefined-deletes-key semantics on the vault.modify() path

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern B edge-label write (D-12): getData → first-pass-validate → mutate → setData → debouncedRequestSave, mirroring saveLive/saveLiveBatch structure"
    - "D-14 atomicity: single updatedData object mutated for node + edges together, ONE setData call commits both — prevents WR-01 race"
    - "D-08 strip-key semantics: `label === undefined` → `delete edge.label` (never write null or empty string) — symmetric with canvas-parser.ts:207-209"
    - "Optional-parameter extension pattern: saveLiveBatch gets optional 3rd arg with default-undefined → existing 2-arg call-sites behave bit-identically"

key-files:
  created: []
  modified:
    - src/canvas/canvas-live-editor.ts
    - src/__tests__/canvas-write-back.test.ts

key-decisions:
  - "saveLiveBatch extension chosen over parallel saveLiveEdgesBatch — D-14 atomicity demands node + edges in ONE setData; separate methods would require callers to choreograph two Pattern B calls and re-introduce the WR-01 race"
  - "First-pass-validate for edges added as a separate loop between node-validate and node-mutate — keeps the fail-fast semantic uniform (any missing target → bail with false, no partial mutation)"
  - "No PROTECTED_FIELDS list needed for edges — only the 'label' field is writable via this API; Obsidian-owned fields (id, fromNode, toNode) are never passed by callers"
  - "saveLiveEdges short-circuits on empty edgeEdits (mirrors saveLiveBatch's nodeEdits.length === 0 short-circuit) — cheap no-op for callers that compute an empty diff"

patterns-established:
  - "TDD gate sequence enforced: RED commit (failing tests on non-existent saveLiveEdges + unsupported 3-arg saveLiveBatch) → GREEN commit (implementation) — never collapsed"
  - "Shared Pattern G (CLAUDE.md append-only) replicated on both files: saveLiveBatch extended via 4 targeted in-place edits (signature, no-op condition, first-pass-edge-validate, second-pass-edge-mutate) + one appended method; test file gets one appended describe with 5 tests, pre-existing 10 tests byte-identical"

requirements-completed: [EDGE-02]

# Metrics
duration: ~3min
completed: 2026-04-19
---

# Phase 50 Plan 03: saveLiveEdges + saveLiveBatch edgeEdits Summary

**Shipped Pattern B writers for edge-label changes — `saveLiveEdges(filePath, edgeEdits)` for edge-only writes (D-12), and an optional `edgeEdits` 3rd parameter on `saveLiveBatch` (D-14) that commits node + incoming-edge updates in ONE `setData` + ONE `debouncedRequestSave` cycle; five new write-back tests prove D-08 strip-key, D-14 atomicity, and first-pass-validate bail-before-mutation.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T13:08:31Z
- **Completed:** 2026-04-19T13:11:09Z
- **Tasks:** 2 (tests RED → implementation GREEN)
- **Files modified:** 2
- **Lines added:** 218 (+90 impl, +128 tests) / −2 (signature + no-op condition)

## Accomplishments

- Added `CanvasLiveEditor.saveLiveEdges(filePath, edgeEdits)` (Phase 50 D-12) — Pattern B write for edge-label-only changes. Same `getData → validate → mutate → setData → debouncedRequestSave` shape as `saveLive` (lines 75-133). Rollback-on-throw preserved verbatim from Shared Pattern F.
- Extended `CanvasLiveEditor.saveLiveBatch` with optional `edgeEdits?: Array<{ edgeId; label }>` 3rd parameter (D-14). First-pass validates BOTH node AND edge targets; second-pass mutates both; single `setData` + single `debouncedRequestSave` cycle ≡ D-14 atomicity. Existing 2-arg call-sites bit-identical (optional param defaults `undefined` → `!edgeEdits` branch short-circuits exactly as before).
- D-08 strip-key semantics applied uniformly: `label === undefined` → `delete (edge as Record<string, unknown>)['label']` in both new method and saveLiveBatch edge-branch. Matches `canvas-parser.ts:207-209` normalisation.
- First-pass-validate reject: any missing `edgeId` → return `false` BEFORE any mutation (mirrors `saveLiveBatch:161-165` node validate pattern). Proven by dedicated test `'saveLiveBatch first-pass-validate rejects entire batch if an edgeId is missing (no partial mutation)'` — assertion `expect(setDataSpy).not.toHaveBeenCalled()`.
- Added 5 write-back integration tests in new describe block `'PHASE-50 CanvasLiveEditor edge writes (D-08 / D-12 / D-14)'` at tail of `canvas-write-back.test.ts`. Uses hand-rolled `CanvasViewInternal` mock via `buildMockLiveEditor` helper — no dependency on `EditorPanelView` (the wire-up lives in Plan 04, not in scope here).
- TDD gates committed atomically: RED `91e4121` (4 failing + 1 vacuously-passing back-compat test) → GREEN `dec2474` (implementation + all 5 green). Build clean, full suite 484/1/0.

## Task Commits

| Task | Name | Gate | Commit |
|---|---|---|---|
| 2 | Write-back integration tests (failing pre-impl) | RED | `91e4121` (test) |
| 1 | saveLiveEdges + saveLiveBatch edgeEdits impl | GREEN | `dec2474` (feat) |

## Files Created/Modified

- **`src/canvas/canvas-live-editor.ts`** (MODIFIED, +90 / −2):
  - saveLiveBatch signature extended with optional `edgeEdits` param (+7 lines: signature + 4-line doc-comment).
  - saveLiveBatch no-op short-circuit condition extended to cover both empty-arrays: `if (nodeEdits.length === 0 && (!edgeEdits || edgeEdits.length === 0)) return true;` (−1/+1 in-place).
  - saveLiveBatch first-pass-validate-edges block appended after node-validate loop, before second-pass-mutate comment (+7 lines).
  - saveLiveBatch second-pass-mutate-edges block appended after node-mutate loop, before try-block (+12 lines).
  - saveLiveEdges method appended between saveLiveBatch and debouncedRequestSave (+63 lines incl. full doc-comment).
  - Untouched: `PROTECTED_FIELDS`, `getCanvasView`, `isLiveAvailable`, `getCanvasJSON`, `saveLive`, `debouncedRequestSave`, `destroy`.
- **`src/__tests__/canvas-write-back.test.ts`** (MODIFIED, +128 / −0):
  - Added `CanvasLiveEditor` import at top (+1 line, single in-place addition to import block).
  - Appended new `describe('PHASE-50 CanvasLiveEditor edge writes ...')` at tail with `buildMockLiveEditor` helper + 5 tests. Pre-existing 10 tests byte-identical — Shared Pattern G respected.

## Decisions Made

- **saveLiveBatch extension over parallel saveLiveEdgesBatch.** D-14 atomicity requires node + edge mutations in a single `setData` call; a separate `saveLiveEdgesBatch` method would force callers to choreograph two Pattern B calls back-to-back and re-create the exact WR-01 race the phase closes (`canvas-live-editor.ts:138-148` doc-comment explains the lesson verbatim). Extending the existing method with an optional edge param is the minimum-intrusion path that preserves back-compat AND atomicity.
- **No PROTECTED_FIELDS enforcement for edge label writes.** The node-side `PROTECTED_FIELDS` set (`id`, `x`, `y`, `width`, `height`, `type`) guards against callers accidentally mutating geometry; the edge-side API only accepts `{ edgeId, label }` tuples — there is no surface where a caller could write `id`/`fromNode`/`toNode`. Adding a symmetric PROTECTED_FIELDS list here would be dead code.
- **Separate first-pass-validate loop for edges (not fused with node-validate).** Kept the two loops independent so a future plan can add edge-specific pre-validation (e.g., "label must not exceed N characters") without touching node validation. Each loop has a single responsibility; bail-on-miss semantics identical.
- **saveLiveEdges short-circuits on empty edgeEdits returning `true`.** Mirrors `saveLiveBatch:155` no-op pattern — reconciler callers in Plan 04 will routinely compute empty diffs (D-07 idempotency); a cheap `return true` avoids spinning up a `getData()`/`setData()` round-trip for zero mutations.

## Deviations from Plan

None — plan executed exactly as written.

- Both TDD gates committed atomically in the prescribed order (RED then GREEN); zero auto-fixes needed.
- Zero architectural escalations (Rule 4).
- Zero CSS changes (Phase 50 is CSS-free per PATTERNS.md / CONTEXT.md).
- One micro-observation for transparency: the 5th test ("back-compat: saveLiveBatch with only nodeEdits") passed vacuously at the RED stage because it exercises the unchanged 2-arg signature; it genuinely served as a regression-guard once the signature was extended. Recorded here to explain why the RED run showed 4 failed + 1 passed among the new tests rather than 5 failed.

## Threat Flags

None. The plan adds two Pattern B writers that share transport / rollback / debounce machinery with existing `saveLive` / `saveLiveBatch` — no new network endpoints, no new auth paths, no new file-access patterns. The `edgeEdits` shape is validated structurally before any mutation (first-pass loop); callers cannot trigger partial writes.

## Issues Encountered

None blocking. Baseline tests unchanged (479 → 484, +5 = exactly the 5 new tests); no other file touched.

## User Setup Required

None — append-only additions to the live-editor API, no runtime side effects until Plan 04 wires these into the reconciler + Display-label handler. No configuration, no dependencies.

## Verification

| Check | Expected | Actual |
|---|---|---|
| `grep -c "async saveLiveEdges(" src/canvas/canvas-live-editor.ts` | 1 | 1 |
| `grep -c "edgeEdits?: Array<{ edgeId: string; label: string \| undefined }>" src/canvas/canvas-live-editor.ts` | 1 | 1 |
| `grep -c "Phase 50 D-12" src/canvas/canvas-live-editor.ts` | ≥1 | 1 |
| `grep -c "Phase 50 D-14" src/canvas/canvas-live-editor.ts` | ≥2 | 3 |
| `grep -c "D-08 strip-key" src/canvas/canvas-live-editor.ts` | ≥2 | 2 |
| `grep -c "answer-label-edge-sync.md" src/canvas/canvas-live-editor.ts` | ≥1 | 2 |
| `grep -c "console.error.*Canvas rollback failed" src/canvas/canvas-live-editor.ts` | 3 | 3 |
| `grep -c "edgeEdits" src/canvas/canvas-live-editor.ts` | ≥6 | 11 |
| `grep -c "PHASE-50 CanvasLiveEditor edge writes" src/__tests__/canvas-write-back.test.ts` | 1 | 1 |
| `grep -c "saveLiveEdges" src/__tests__/canvas-write-back.test.ts` | ≥3 | 5 |
| `grep -c "saveLiveBatch" src/__tests__/canvas-write-back.test.ts` | ≥3 | 7 |
| `grep -c "setDataSpy).toHaveBeenCalledTimes(1)" src/__tests__/canvas-write-back.test.ts` | ≥2 | 3 |
| `grep -c "setDataSpy).not.toHaveBeenCalled" src/__tests__/canvas-write-back.test.ts` | 1 | 1 |
| `npx tsc --noEmit --skipLibCheck` | exit 0 | exit 0 |
| `npx vitest run src/__tests__/canvas-write-back.test.ts` | 14 passed | 14 passed |
| `npm test` | ≥484 passed / 1 skipped / 0 failed | 484 / 1 / 0 |
| `npm run build` | exit 0 (tsc + esbuild) | exit 0 |

Baseline was 479 passed after Plan 02. +5 new write-back tests = 484 — matches exactly.

## TDD Gate Compliance

- **RED commit:** `91e4121` — `test(50-03): add failing CanvasLiveEditor edge-write tests (RED)`. 4 of 5 new tests proven-failing (saveLiveEdges undefined on CanvasLiveEditor, saveLiveBatch 3-arg unsupported → edge mutations never applied). 5th test (back-compat 2-arg saveLiveBatch) passed vacuously at RED — documented in Deviations.
- **GREEN commit:** `dec2474` — `feat(50-03): add saveLiveEdges + extend saveLiveBatch edgeEdits (GREEN)`. All 5 tests pass; full suite 479 → 484.
- **REFACTOR:** not needed — GREEN implementation is minimum-viable and matches the final shape; code duplication between saveLiveEdges and saveLiveBatch edge-branch is intentional (D-14 atomicity prohibits extracting a shared helper that would force two setData calls).

Gate sequence satisfied: RED before GREEN, committed separately, both in the same plan.

## Self-Check: PASSED

- File exists: `src/canvas/canvas-live-editor.ts` — FOUND
- File exists: `src/__tests__/canvas-write-back.test.ts` — FOUND
- File exists: `.planning/phases/50-answer-edge-label-sync/50-03-SUMMARY.md` — FOUND
- Commit exists: `91e4121` — FOUND
- Commit exists: `dec2474` — FOUND

## Next Plan Readiness

Plan 50-04 (`EdgeLabelSyncService` wire-up + editor-panel-view Display-label atomic write) can now call `canvasLiveEditor.saveLiveEdges(filePath, diffs.map(d => ({ edgeId: d.edgeId, label: d.targetLabel })))` to land reconciler diffs onto the open canvas, AND call `canvasLiveEditor.saveLiveBatch(filePath, [{ nodeId: answerId, edits: { radiprotocol_displayLabel: newLabel } }], incomingEdgeEdits)` from the Display-label handler for atomic node+edges writes. D-14 race-free and D-08 strip-key semantics are proven by the write-back tests; wire-up consumers can trust both contracts.

---
*Phase: 50-answer-edge-label-sync*
*Completed: 2026-04-19*
