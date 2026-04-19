---
phase: 50-answer-edge-label-sync
plan: 02
subsystem: graph/reconciler
tags: [typescript, pure-module, reconciler, edge-label-sync, tdd]

# Dependency graph
requires:
  - phase: 49-loop-exit-edge-convention
    provides: isLabeledEdge from src/graph/node-label.ts (reused verbatim by the reconciler — D-05 whitespace ≡ unlabeled semantics)
  - plan: 50-01
    provides: CanvasEdgeData typed interface on CanvasData.edges (downstream writer dependency; reconciler itself does not touch CanvasData, but the wave 2 writer in plan 50-03 will)
provides:
  - Exported reconcileEdgeLabels(graph) → { diffs, newDisplayLabelByAnswerId } in src/graph/edge-label-reconciler.ts
  - Exported EdgeLabelDiff + ReconcileResult interfaces (the contract Plan 04 wire-up consumes)
  - Two new test fixtures (branching-multi-incoming, displayLabel-edge-mismatch) that Plan 03/04 reuse
affects:
  - Plan 50-03 (CanvasLiveEditor.saveLiveEdges — applies EdgeLabelDiff[])
  - Plan 50-04 (editor-panel-view Display-label atomic write — reads newDisplayLabelByAnswerId + diffs from the same reconciler)
  - Plan 50-05 (EdgeLabelSyncService wire-up — hooks reconcileEdgeLabels into vault.on('modify') via Pattern B / Strategy A fork)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure reconciler module (Shared Pattern A): zero Obsidian imports, import-only type dependencies, canonical design-note reference in header"
    - "Content-diff idempotency (D-07): empty diff + empty map signals no-op to caller → vault.on('modify') loop self-terminates without mutable suppress flags"
    - "Reuse, do-not-reshape (CLAUDE.md Shared Pattern G): isLabeledEdge imported from node-label.ts instead of re-implementing the trim predicate"
    - "Deterministic iteration order: reconciler filters graph.edges[] (array order), not reverseAdjacency Set, so the 'first non-empty' pick is reproducible across runs"

key-files:
  created:
    - src/graph/edge-label-reconciler.ts
    - src/__tests__/edge-label-reconciler.test.ts
    - src/__tests__/fixtures/branching-multi-incoming.canvas
    - src/__tests__/fixtures/displayLabel-edge-mismatch.canvas
  modified:
    - src/__tests__/canvas-parser.test.ts

key-decisions:
  - "pickedLabel formula: first-labeled incoming edge (trimmed) ?? trimmed displayLabel ?? undefined — covers D-04 edge-wins, D-09 edge-initiated clearing, and D-11 new-edge seeding in one expression"
  - "diff.currentLabel returned raw (not trimmed) so the caller can distinguish 'was whitespace' from 'was already correct label'; diff.targetLabel is always trimmed-or-undefined"
  - "newDisplayLabelByAnswerId keyed by answer.id with string | undefined value — undefined means 'strip the radiprotocol_displayLabel key' (symmetric to canvas-parser.ts:207-209 normalisation and editor-panel-view.ts:448 'v || undefined')"
  - "Iteration via graph.nodes.values() filtered by node.kind === 'answer' — Map insertion order preserved; this is the single determinism anchor for multi-Answer canvases"

patterns-established:
  - "Shared Pattern A (pure-module header) replicated in src/graph/edge-label-reconciler.ts"
  - "TDD gate sequence enforced: RED commit (test-only, proven-failing) → GREEN commit (implementation-only) — never collapsed"
  - "Test file co-locates fixture-loader + inline makeGraph() helper; inline graphs cover invariant tests, .canvas fixtures cover round-trip CanvasParser → reconcileEdgeLabels chains"

requirements-completed: [EDGE-02]

# Metrics
duration: ~4min
completed: 2026-04-19
---

# Phase 50 Plan 02: Pure Edge-Label Reconciler Summary

**Encapsulated the D-04 edge-wins bi-directional sync rule in a pure `reconcileEdgeLabels(graph)` function with D-07 content-diff idempotency as the loop-guard; eleven unit tests plus two new .canvas fixtures cover D-04/D-07/D-08/D-09/D-18 invariants and prove the loop self-terminates after one re-entry.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-19T13:00:24Z
- **Completed:** 2026-04-19T13:04:08Z
- **Tasks:** 3
- **Files created:** 4 (reconciler module + test file + 2 fixtures)
- **Files modified:** 1 (canvas-parser.test.ts — append-only)
- **Lines added:** 461 (+0 deleted)

## Accomplishments

- Created `src/graph/edge-label-reconciler.ts` — pure function with zero Obsidian imports (D-18 verified by the structural test + `grep -c "from 'obsidian'"` = 0).
- Implemented D-04 edge-wins rule: `pickedLabel = first-labeled-incoming (trimmed) ?? displayLabel (trimmed) ?? undefined`, covering cold-open mismatch, multi-incoming three-way conflict, and edge-initiated clearing in one expression.
- D-07 idempotency guarantee: structurally-empty return (`diffs.length === 0 && newDisplayLabelByAnswerId.size === 0`) when nothing needs to change — proven by the dedicated test case that feeds already-synced incoming edges + matching displayLabel.
- Reused `isLabeledEdge` from `src/graph/node-label.ts` via `import` (not reshaped per CONTEXT §code_context + CLAUDE.md never-reshape rule). `node-label.ts` byte-identical (0-byte diff).
- Added two test fixtures — `branching-multi-incoming.canvas` (multi-incoming + three-way conflict) and `displayLabel-edge-mismatch.canvas` (cold-open edge.label ≠ displayLabel) — without touching any Phase 49 `unified-loop-*.canvas` fixture (D-17 verified: `ls unified-loop-*.canvas | wc -l` = 7 before and after).
- Appended 2 tests to `canvas-parser.test.ts` confirming both fixtures parse cleanly with RPEdge.label + AnswerNode.displayLabel preserved — regression-guards the reconciler's inputs.
- TDD gate sequence committed atomically: RED (failing test) → GREEN (implementation) — never collapsed.

## Task Commits

| Task | Name | Gate | Commit |
|---|---|---|---|
| 1 | Test fixtures — multi-incoming + label-mismatch | (RED prerequisite) | `f8d08c7` (test) |
| 2a | Reconciler test file (failing — module absent) | RED | `b6489db` (test) |
| 2b | Reconciler implementation | GREEN | `31d1322` (feat) |
| 3 | CanvasParser tests for Phase 50 fixtures | (follow-on) | `39d3c7e` (test) |

## Files Created/Modified

- `src/graph/edge-label-reconciler.ts` (NEW, 92 lines) — pure reconciler. Exports `reconcileEdgeLabels`, `EdgeLabelDiff`, `ReconcileResult`. Header cites `.planning/notes/answer-label-edge-sync.md` per Shared Pattern H + D-10 + D-16. Imports `ProtocolGraph`, `RPEdge`, `AnswerNode` as `import type` from `./graph-model` and `isLabeledEdge` from `./node-label` (runtime import — the whole module must still be pure, and `node-label.ts` is itself pure per Phase 49 D-13).
- `src/__tests__/edge-label-reconciler.test.ts` (NEW, 259 lines) — 7 describe blocks, 11 it() assertions covering D-04 edge-wins (3), D-07 idempotency (1), D-08/D-09 clearing (3), mismatch fixture (1), multi-incoming fixture (1), D-18 pure-import guard (1), deterministic iteration order (1). Inline `makeGraph()` helper builds minimum-viable `ProtocolGraph` for invariant-only tests; fixture-based tests round-trip through `CanvasParser`.
- `src/__tests__/fixtures/branching-multi-incoming.canvas` (NEW) — two Questions → one shared Answer; edges labeled "Вариант X" and "Вариант Y"; displayLabel "Старое" (three-way conflict).
- `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` (NEW) — one Q → one A; displayLabel "X"; edge label "Y" (cold-open mismatch).
- `src/__tests__/canvas-parser.test.ts` (MODIFIED, +37 / −0) — appended one new `describe` block with 2 tests. Strictly append-only per CLAUDE.md Shared Pattern G; pre-existing 15 tests unchanged byte-for-byte.

## Decisions Made

- **pickedLabel as `edgePick ?? displayTrim`.** The plan's `<behavior>` listed "labeled incoming wins, else undefined" in step 2 of the prose but clarified in the next paragraph that PATTERNS.md §1 authoritatively extends it with a displayLabel fallback. I implemented the PATTERNS.md version (displayLabel fallback) — this is what covers D-11 "new edge seeds displayLabel" behaviour and lets the `all-edges-empty-but-displayLabel-present` test express real-world cold-open semantics.
- **currentLabel in diff returned raw (not trimmed).** Lets the caller distinguish "was '   ' whitespace" from "was 'Y'" when logging or displaying in diagnostics — and the caller (Plan 03 saveLiveEdges) writes whatever the target is; the current value is metadata only. `targetLabel` is always the trimmed-or-undefined canonical form.
- **Inline `makeGraph()` helper rather than parsing a fixture for invariant tests.** D-08/D-09 clearing cases require edges without `label` keys and Answers with/without `displayLabel` — expressing these as fixtures proliferates .canvas files. An inline helper keeps those invariant tests co-located with the assertions that motivate them; fixture tests remain for the two canonical multi-incoming and mismatch scenarios D-17 explicitly names.
- **Filter `graph.edges` by `e.toNodeId === answer.id` instead of consulting `graph.reverseAdjacency`.** `reverseAdjacency` returns source node IDs (not edge IDs), so a second lookup would still be needed to resolve the actual edges. Iterating `graph.edges[]` once in array order is simpler and gives the deterministic "first non-empty" pick the test for iteration order asserts.
- **Deleted the half-written D-07 two-questions.canvas assertion.** The plan suggested using `two-questions.canvas` as the idempotency fixture, but that fixture has unlabeled incoming edges + non-empty displayLabel — under the D-04 fallback that is NOT zero-diff (the reconciler propagates displayLabel onto the edges). I replaced it with an inline graph where edges and displayLabels are already in sync, keeping the idempotency invariant genuinely provable.

## Deviations from Plan

None that affect contract or behaviour. Two micro-adjustments from pure plan transcription:

1. **D-07 fixture swap.** Plan suggested `two-questions.canvas` as the "all labels match" fixture; that fixture would not actually produce an empty diff under D-04's displayLabel-fallback rule (unlabeled edges + labeled displayLabel → edges get propagated). Replaced with an inline graph that genuinely has all labels matching. Test intent preserved; assertion strengthened (diffs.length === 0 AND newDisplayLabelByAnswerId.size === 0, both proven simultaneously).

2. **[Rule 3 — Blocking issue] TS strict-null in Phase 50 parser test.** `npx tsc --noEmit --skipLibCheck` after Task 3 flagged TS18048 (`'answer' is possibly 'undefined'`) on the `answer!.kind` non-null-assertion pattern. Runtime behaviour identical (vitest passed either way) but tsc refused the narrowing. Fixed inline by collapsing `expect(answer!.kind)...if (answer!.kind !== 'answer') return` to `if (!answer || answer.kind !== 'answer') return` — the same guard expressed in a form tsc accepts. Single-hunk edit, no other files touched. Final commit `39d3c7e` contains the corrected form.

## Threat Flags

None. The reconciler is a pure function with no new network, auth, file-access, or schema surface beyond what Plan 01's `CanvasEdgeData` typing already established.

## Issues Encountered

None blocking. The one tsc nit (Rule 3) was fixed inline in under a minute before the Task 3 commit landed.

## User Setup Required

None — pure-module change, no runtime side effects until Plan 04 wire-up, no new dependencies, no configuration.

## Verification

| Check | Expected | Actual |
|---|---|---|
| `grep -c "// Pure module — zero Obsidian API imports" src/graph/edge-label-reconciler.ts` | 1 | 1 |
| `grep -c "answer-label-edge-sync.md" src/graph/edge-label-reconciler.ts` | ≥1 | 1 |
| `grep -c "export function reconcileEdgeLabels" src/graph/edge-label-reconciler.ts` | 1 | 1 |
| `grep -c "export interface EdgeLabelDiff" src/graph/edge-label-reconciler.ts` | 1 | 1 |
| `grep -c "export interface ReconcileResult" src/graph/edge-label-reconciler.ts` | 1 | 1 |
| `grep -c "from 'obsidian'" src/graph/edge-label-reconciler.ts` | 0 | 0 |
| `grep -cE "import.*isLabeledEdge.*from.*['\"]./node-label['\"]" src/graph/edge-label-reconciler.ts` | 1 | 1 |
| `grep -c "describe(" src/__tests__/edge-label-reconciler.test.ts` | ≥7 | 7 |
| `grep -cE "^  it\(" src/__tests__/edge-label-reconciler.test.ts` | ≥9 | 11 |
| `grep -c "Phase 50 fixtures" src/__tests__/canvas-parser.test.ts` | 1 | 2 (marker + describe-name) |
| `ls src/__tests__/fixtures/unified-loop-*.canvas \| wc -l` | 7 | 7 |
| `git diff HEAD~4 HEAD -- src/graph/node-label.ts src/graph/graph-model.ts \| wc -l` | 0 | 0 |
| `npx tsc --noEmit --skipLibCheck` | exit 0 | exit 0 |
| `npm test` | ≥475 passed / 1 skipped / 0 failed | 479 passed / 1 skipped / 0 failed |

Baseline was 466 tests (post-Plan 01). +11 reconciler tests + 2 canvas-parser tests = 479 — matches exactly.

## TDD Gate Compliance

- **RED commit:** `b6489db` — `test(50-02): add failing edge-label-reconciler unit tests (RED)`. Proven to fail via `npx vitest run src/__tests__/edge-label-reconciler.test.ts` before the reconciler module existed (error: `Cannot find module '../graph/edge-label-reconciler'`).
- **GREEN commit:** `31d1322` — `feat(50-02): implement pure edge-label-reconciler (GREEN)`. All 11 previously-failing tests pass; full suite 477 → 479 passed.
- **REFACTOR:** not needed — the GREEN implementation already matches the final shape; no cleanup commit emitted.

Gate sequence satisfied: RED before GREEN, committed separately, both in the same plan.

## Self-Check: PASSED

- File exists: `src/graph/edge-label-reconciler.ts` — FOUND
- File exists: `src/__tests__/edge-label-reconciler.test.ts` — FOUND
- File exists: `src/__tests__/fixtures/branching-multi-incoming.canvas` — FOUND
- File exists: `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` — FOUND
- Commit exists: `f8d08c7` — FOUND
- Commit exists: `b6489db` — FOUND
- Commit exists: `31d1322` — FOUND
- Commit exists: `39d3c7e` — FOUND

## Next Plan Readiness

Plan 50-03 (`CanvasLiveEditor.saveLiveEdges` + extended `saveLiveBatch`) can now `import type { EdgeLabelDiff } from '../graph/edge-label-reconciler'` and receive the full diff list as its input-shape contract. Plan 50-04 (Node Editor Display-label atomic write) will consume the same reconciler to enumerate incoming edges for a given Answer without re-parsing canvas JSON. Plan 50-05 wire-up hooks `reconcileEdgeLabels(graph)` into `vault.on('modify')` — D-07's empty-diff self-termination is already proven, so the wire-up can trust it without adding suppress flags.

---
*Phase: 50-answer-edge-label-sync*
*Completed: 2026-04-19*
