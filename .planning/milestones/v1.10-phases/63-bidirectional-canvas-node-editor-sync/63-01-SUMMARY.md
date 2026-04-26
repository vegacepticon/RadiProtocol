---
phase: 63-bidirectional-canvas-node-editor-sync
plan: 01
subsystem: graph
tags: [reconciler, edge-label-sync, discriminated-union, snippet-node, tdd, pure-module]

# Dependency graph
requires:
  - phase: 50-answer-edge-label-sync
    provides: Phase 50 single-arm reconcileEdgeLabels (Answer kind only) — the byte-identical template the snippet arm mirrors
provides:
  - Discriminated EdgeLabelDiff with kind: 'answer' | 'snippet'
  - NodeLabelChange interface replacing legacy newDisplayLabelByAnswerId map
  - reconcileEdgeLabels snippet edge-wins arm reading SnippetNode.snippetLabel
  - Cold-open D-03 auto-migration on first reconcile pass (snippetLabel seeds undefined edge.label)
  - 2 fixtures (snippet-cold-open-migration.canvas, branching-snippet-multi-incoming.canvas) for downstream test reuse
  - saveLiveBatch snippet-kind nodeEdits routing coverage in canvas-write-back.test.ts
affects:
  - 63-02 (EdgeLabelSyncService writer consumes the new nodeChanges shape; subscriber bus dispatches snippet-kind diffs)
  - 63-03 (EditorPanelView receives snippet-kind fieldUpdates via the Plan 02 bus)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-arm pure reconciler: replace 'if (kind !== answer) continue' early-return with parallel if/else-if branches that stamp the kind discriminator on every emitted diff and node change"
    - "Discriminated union for divergent label sources: single nodeChanges[] array carries both Answer (radiprotocol_displayLabel) and Snippet (radiprotocol_snippetLabel) updates, routed by kind at the writer layer"
    - "Cold-open D-03 auto-migration: when node.snippetLabel is set but the incoming edge has no label, the reconciler emits one edgeDiff propagating the node-side label onto the edge with no nodeChange (idempotent first-pass migration)"

key-files:
  created:
    - src/__tests__/fixtures/snippet-cold-open-migration.canvas
    - src/__tests__/fixtures/branching-snippet-multi-incoming.canvas
  modified:
    - src/graph/edge-label-reconciler.ts
    - src/__tests__/edge-label-reconciler.test.ts
    - src/__tests__/canvas-write-back.test.ts

key-decisions:
  - "Discretion choice: Option B (discriminated NodeLabelChange[] replacing newDisplayLabelByAnswerId map) over Option A (parallel newSnippetLabelBySnippetId map). Eliminates the two-parallel-maps smell; the writer in Plan 02 maps once over a single list and routes by kind"
  - "Build-wide compile intentionally broken at end of plan. edge-label-sync-service.ts still references the removed newDisplayLabelByAnswerId — Plan 02 (next wave) repairs in one pass. Documented in 63-01-PLAN.md <verification>"
  - "Phase 50 JSDoc on reconcileEdgeLabels preserved verbatim; appended a Phase 63 D-04 paragraph explaining the snippet pass and the T-01 'never throw' invariant per CLAUDE.md never-delete rule"
  - "D-18 pure-module invariant preserved: zero Obsidian imports in edge-label-reconciler.ts (verified via grep on '^import.*obsidian')"

patterns-established:
  - "Snippet edge-wins follows Phase 50 D-04 1:1: first non-empty incoming label wins, fallback to trimmed node-side label, propagate divergence to nodeChanges, re-sync diverging edges"
  - "Migrating Phase 50 Answer-arm test assertions to the discriminated shape: result.newDisplayLabelByAnswerId.get(id) becomes result.nodeChanges.find(c => c.nodeId === id && c.kind === 'answer')?.newLabel; every diff assertion gains expect(diff.kind).toBe('answer')"
  - "Test fixture naming convention: <scenario>-<topology>.canvas (e.g. snippet-cold-open-migration.canvas, branching-snippet-multi-incoming.canvas) — symmetric with Phase 50 displayLabel-edge-mismatch.canvas"

requirements-completed: [EDITOR-03]

# Metrics
duration: ~3min wall (commits 07:34→07:36)
completed: 2026-04-25
---

# Phase 63 Plan 01: Pure Reconciler — Snippet Edge-Wins Arm Summary

**Pure reconciler now handles Question→Snippet incoming edges with edge-wins reconciliation symmetric to the Phase 50 Question→Answer arm, exposed through a discriminated `EdgeLabelDiff`/`NodeLabelChange` shape that the service writer (Plan 02) and view subscriber (Plan 03) consume without re-architecture.**

## Performance

- **Duration:** ~3 min wall time (commit timestamps)
- **Started:** 2026-04-25T07:34:23+03:00
- **Completed:** 2026-04-25T07:36:40+03:00
- **Tasks:** 3 (all TDD)
- **Files modified:** 3
- **Files created:** 2 (fixtures)

## Accomplishments

- Reconciler reads `SnippetNode.snippetLabel` and reconciles incoming Question→Snippet edges with the same edge-wins rule as Question→Answer (D-01, D-02, D-04)
- `EdgeLabelDiff` is now a discriminated union (`kind: 'answer' | 'snippet'`); `ReconcileResult.newDisplayLabelByAnswerId: Map` replaced by `nodeChanges: NodeLabelChange[]` carrying both kinds
- Cold-open D-03 migration: legacy canvases with `radiprotocol_snippetLabel` on the node but no edge label auto-migrate on the first reconcile pass — no migration utility, no user action
- All Phase 50 Answer-arm tests migrated to the discriminated shape and remain GREEN
- 5 new snippet describe-block tests + 2 new canvas-write-back tests all GREEN
- D-18 pure-module invariant preserved: zero Obsidian imports in `edge-label-reconciler.ts`

## Task Commits

Each task committed atomically (TDD: RED test → GREEN impl → GREEN supplementary):

1. **Task 1: RED snippet describe block + 2 fixtures + Phase 50 assertion migration** — `cfe890c` (test)
2. **Task 2: snippet edge-wins arm + discriminated `EdgeLabelDiff` / `NodeLabelChange` shape** — `e7dd721` (feat)
3. **Task 3: saveLiveBatch snippet-kind nodeEdits routing + undefined-strip symmetry** — `0f9a033` (test)

**Plan metadata** (this SUMMARY + tracking): committed alongside the SUMMARY in `docs(63-01): SUMMARY + tracking after plan completion`.

## Files Created/Modified

- `src/graph/edge-label-reconciler.ts` — added `NodeLabelChange` interface; extended `EdgeLabelDiff` with `kind` discriminator; replaced `newDisplayLabelByAnswerId: Map` with `nodeChanges: NodeLabelChange[]` in `ReconcileResult`; replaced single-arm filter with parallel Answer/Snippet branches; appended Phase 63 D-04 paragraph to JSDoc (12 `Phase 63:` annotations, 3 `kind: 'snippet'` literal occurrences)
- `src/__tests__/edge-label-reconciler.test.ts` — extended `MakeGraphParams` + `makeGraph` with optional `snippets[]`; migrated Phase 50 Answer-arm assertions to discriminated shape; appended `describe('reconcileEdgeLabels — snippet edge-wins (Phase 63)')` block with 5 tests covering edge-wins, cold-open, multi-incoming, mixed Answer+Snippet, idempotency
- `src/__tests__/canvas-write-back.test.ts` — appended 2 tests inside the existing PHASE-50 CanvasLiveEditor describe block: `saveLiveBatch routes snippet-kind nodeChanges to radiprotocol_snippetLabel (Phase 63 D-04)` and `saveLiveBatch strips radiprotocol_snippetLabel when value is undefined (D-08 symmetry)`
- `src/__tests__/fixtures/snippet-cold-open-migration.canvas` — NEW. SnippetNode has `radiprotocol_snippetLabel: "Брюшной отдел"`, single incoming edge has no label → reconciler propagates label onto edge in one diff, zero nodeChanges
- `src/__tests__/fixtures/branching-snippet-multi-incoming.canvas` — NEW. Two Question nodes both incoming on `n-snip-shared` with edge labels "Вариант X" and "Вариант Y"; `snippetLabel: "Старое"` diverges → edge-wins picks "Вариант X" (first labeled), emits one diff for `e2`, one nodeChange for `n-snip-shared`

## Decisions Made

- **Option B over Option A for the return shape (Discretion)**. PATTERNS.md offered both: (A) parallel `newSnippetLabelBySnippetId: Map` alongside the legacy answer map, or (B) replace the answer map with a single discriminated `nodeChanges: NodeLabelChange[]` array. Picked B — single source of truth for both kinds, eliminates the two-parallel-maps smell, makes the writer in Plan 02 a single `nodeChanges.map(c => ({ nodeId, edits: c.kind === 'answer' ? {...} : {...} }))` instead of two iteration loops.
- **Intentionally broke `npm run build` at plan end**. Plan 01 changes the reconciler return shape; `edge-label-sync-service.ts:96-108` still imports and reads the removed `newDisplayLabelByAnswerId`. Plan 02 (Wave 2) repairs in one pass. This is documented in `63-01-PLAN.md <verification>` as the expected end-state — no test command in this plan asserts a green build.
- **Preserved Phase 50 JSDoc verbatim**, appended a new paragraph explaining the Phase 63 D-04 snippet pass and the T-01 "never throw" invariant. Per CLAUDE.md never-delete rule on this accumulated shared file.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria from each task verified via the listed grep / test commands. No auto-fixes triggered.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 (Wave 2) can proceed immediately. The discriminated `nodeChanges` shape it consumes is in place; `EdgeLabelDiff.kind` discriminator is in place; both fixtures it reuses (`snippet-cold-open-migration.canvas`, `branching-snippet-multi-incoming.canvas`) exist.
- **Build will return to GREEN** when Plan 02 lands — Plan 02 Task 2 step 6.b replaces the obsolete destructure `const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph)` with `const { diffs, nodeChanges } = reconcileEdgeLabels(graph)` and rebuilds `nodeEdits` from the discriminated shape.
- 32/32 tests GREEN across `edge-label-reconciler.test.ts` and `canvas-write-back.test.ts` (verified via `npm test -- --run` on those two files).

---
*Phase: 63-bidirectional-canvas-node-editor-sync*
*Plan: 01*
*Completed: 2026-04-25*
