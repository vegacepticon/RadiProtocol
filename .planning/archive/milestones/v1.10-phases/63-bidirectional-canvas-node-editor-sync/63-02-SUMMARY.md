---
phase: 63-bidirectional-canvas-node-editor-sync
plan: 02
subsystem: canvas
tags: [edge-label-sync, dispatch-bus, snapshot-baseline, eventtarget, snippet-routing, phase-50-preserved]

# Dependency graph
requires:
  - phase: 63-bidirectional-canvas-node-editor-sync
    plan: 01
    provides: Discriminated EdgeLabelDiff/NodeLabelChange shape consumed by the writer; cold-open D-03 migration fixture re-used in dispatch tests
  - phase: 50-answer-edge-label-sync
    provides: Phase 50 D-01..D-14 JSDoc surface preserved verbatim; vault.on('modify') subscription + 250ms debounce + Pattern B / Strategy A fork re-used as the broadcaster scaffold
provides:
  - "EdgeLabelSyncService.subscribe(handler) → unsubscribe public API for canvas-changed-for-node events"
  - "Per-filePath lastSnapshotByFilePath baseline diffing node text fields (questionText/answerText/displayLabel/content/headerText/snippetLabel) + RPNodeKind + deletions"
  - "Discriminated nodeEdits routing: answer-kind → radiprotocol_displayLabel; snippet-kind → radiprotocol_snippetLabel"
  - "vault.on('rename'/'delete') snapshot purges (T-02 leak prevention)"
  - "destroy() extension clearing lastSnapshotByFilePath alongside debounceTimers"
  - "Hoisted exported interfaces: NodeFieldsSnapshot, CanvasChangedForNodeDetail"
affects:
  - 63-03 (EditorPanelView subscribes via service.subscribe(...) and patches the open form's DOM in real time)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EventTarget-backed broadcast bus with subscribe(handler) → () => void teardown contract — service stays in single ownership of the channel; consumers wire the unsubscribe through Obsidian's Component.register lifecycle (T-04 leak guard)"
    - "Per-filePath snapshot baseline + first-pass-silent seeding pattern: cold-open builds the snapshot but skips per-node fields dispatches to avoid flooding the bus when a canvas is opened; subsequent passes diff against the baseline"
    - "Synthesize reconciler-driven nodeChanges into 'fields' dispatches with merge semantics: nodeChange + concurrent snapshot field-delta on the same node combine into one dispatch entry — view receives a single coherent payload per node per reconcile"
    - "Five-category D-07 short-circuit predicate (extends Phase 50): edge diffs + nodeChanges + field deltas + nodeType deltas + deletions all empty → no write, no dispatch, but snapshot still seeded so next pass has the latest baseline"

key-files:
  created:
    - src/__tests__/edge-label-sync-service.test.ts
  modified:
    - src/canvas/edge-label-sync-service.ts

key-decisions:
  - "Synthesize nodeChange → fields dispatch (rather than emitting a separate 'edge' changeKind). Reason: Plan 03 view only patches form fields by key; an extra changeKind would bloat the consumer's switch with no behavioural difference. Merge into existing 'fields' dispatch on the same nodeId."
  - "First-pass-silent baseline seeding (per Plan Action step 6.b). On cold open, snapshot is populated but per-node fields dispatches are suppressed; reconciler-driven nodeChanges (e.g. cold-open D-03 migration) STILL broadcast because they ride on a separate code path (the synthesized 'fields' dispatch from nodeChanges, not from the snapshot diff)."
  - "Dispatch + snapshot persistence happen AFTER write success (both Pattern B and Strategy A paths). On write failure, snapshot is NOT updated so the next pass rebuilds correctly (T-01 idempotency)."
  - "All Phase 50 D-01..D-14 JSDoc annotations preserved verbatim per CLAUDE.md never-delete rule. The collectIncomingEdgeEdits helper at lines 345-359 is untouched per Plan Action step 8 (snippet outbound rides on the reconciler path, not on saveNodeEdits)."

requirements-completed: [EDITOR-03, EDITOR-05]

# Metrics
duration: ~6min wall (commits 08:09→08:13)
completed: 2026-04-25
---

# Phase 63 Plan 02: EdgeLabelSyncService Writer + Dispatch Bus Summary

**EdgeLabelSyncService now broadcasts canvas-changed-for-node events on a public EventTarget bus after every successful reconcile — routing snippet-kind nodeChanges to radiprotocol_snippetLabel, detecting node text field deltas via per-filePath snapshot baseline, and emitting nodeType / deletion changeKinds — all while preserving the Phase 50 displayLabel surface and repairing the intentionally-broken Plan 01 build.**

## Performance

- **Duration:** ~6 min wall time (commit timestamps)
- **Started:** 2026-04-25T05:07:53Z (Task 1 file creation)
- **Completed:** 2026-04-25T05:13:41Z (Task 2 GREEN + final verification)
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 1 (src/canvas/edge-label-sync-service.ts)
- **Files created:** 1 (src/__tests__/edge-label-sync-service.test.ts)

## Accomplishments

- **Build returns to GREEN.** Plan 01 intentionally broke `npm run build` by changing the reconciler return shape (replaced `newDisplayLabelByAnswerId: Map` with `nodeChanges: NodeLabelChange[]`). This plan repairs the call sites in `edge-label-sync-service.ts` in one pass — `tsc -noEmit` now exits 0.
- **Discriminated writer.** `nodeEdits` now built via `nodeChanges.map(c => ({ ... edits: c.kind === 'answer' ? { radiprotocol_displayLabel } : { radiprotocol_snippetLabel } }))` — single iteration replaces the Phase 50 two-loop / two-map shape.
- **Public dispatch bus.** `subscribe(handler) → () => void` API backed by a private `EventTarget`. Plan 03's `EditorPanelView` will wire the unsubscribe through `Component.register(...)` so the lifecycle is tied to view unmount.
- **Per-filePath snapshot baseline (EDITOR-05 inbound).** `lastSnapshotByFilePath: Map<filePath, Map<nodeId, NodeFieldsSnapshot>>` diffs the freshly-parsed graph against the previous baseline. Detects per-node field deltas (questionText/answerText/displayLabel/content/headerText/snippetLabel), RPNodeKind deltas, and deletions. First-pass seeding is silent (no flood on cold open).
- **D-07 short-circuit extended across five categories.** Edge diffs + nodeChanges + field deltas + nodeType deltas + deletions all empty → no write, no dispatch. Snapshot is still updated so the next pass has the latest baseline.
- **Snapshot lifetime bounded (T-02).** `vault.on('rename')` + `vault.on('delete')` purge stale entries. `destroy()` clears the entire map on plugin unload.
- **Phase 50 surface preserved.** `displayLabel-edge-mismatch.canvas` reconcile still writes `radiprotocol_displayLabel`, still uses `saveLiveBatch`, still falls back to Strategy A. The dispatch test using this fixture is the regression guard.
- **CLAUDE.md compliance.** All Phase 50 D-01..D-14 JSDoc annotations preserved verbatim (11 occurrences of `Phase 50 D-` / `D-XX:` patterns). The `collectIncomingEdgeEdits` helper untouched. Every new code block annotated with `// Phase 63: ...` (22 occurrences).

## Task Commits

Each task committed atomically (TDD: RED test → GREEN implementation):

1. **Task 1: RED tests for dispatch + snapshot + cleanup** — `4409191` (test) — 10 failing tests across 3 describe blocks
2. **Task 2: discriminated writer + dispatch bus + snapshot baseline + cleanup** — `c208250` (feat) — 202 insertions, 14 deletions; turns all 10 RED tests GREEN

**Plan metadata** (this SUMMARY + tracking): committed in the final `docs(63-02): SUMMARY + tracking after plan completion` commit.

## Files Created/Modified

- `src/canvas/edge-label-sync-service.ts` — extended:
  - **Imports**: added `NodeLabelChange` (Plan 01 export); added `RPNodeKind` from graph-model
  - **Hoisted interfaces**: `NodeFieldsSnapshot` + `CanvasChangedForNodeDetail` (both exported)
  - **New private fields**: `bus = new EventTarget()`, `lastSnapshotByFilePath = new Map(...)`
  - **Extended `register()`**: appended `vault.on('rename')` + `vault.on('delete')` handlers (T-02 cleanup)
  - **Extended `reconcile()`**: discriminated destructuring; per-pass snapshot build + diff; five-category short-circuit; kind-aware nodeEdits builder; dispatch + snapshot-persist AFTER write success on both Pattern B and Strategy A paths; nodeChange → 'fields' dispatch synthesis with merge
  - **New public method**: `subscribe(handler): () => void`
  - **New private method**: `dispatchChange(detail): void`
  - **Extended `destroy()`**: appended `lastSnapshotByFilePath.clear()` per T-02 leak prevention
  - **Untouched**: `collectIncomingEdgeEdits` helper (Plan Action step 8); all Phase 50 D-XX JSDoc annotations
- `src/__tests__/edge-label-sync-service.test.ts` — NEW. Three describe blocks:
  - **Dispatch contract (3 tests)**: Phase 50 displayLabel regression guard via `displayLabel-edge-mismatch.canvas`; D-07 idempotency no-op; snippet-kind routing to `radiprotocol_snippetLabel`
  - **Snapshot diff (4 tests)**: questionText delta detection; no-dispatch on byte-identical pass; nodeType change → `changeKind: 'nodeType'` + `newKind`; deletion → `changeKind: 'deleted'`
  - **Snapshot cleanup (3 tests)**: `vault.on('rename')` purges old path; `vault.on('delete')` purges deleted path; `destroy()` clears all snapshots and timers (T-02)
  - **Setup pattern**: `buildService(content)` helper exposes `setCanvas(next)` for two-pass tests; tests drive reconcile via `(service as any).reconcile('test.canvas')` directly to bypass the TFile-instanceof gate (per 63-PATTERNS.md "Gotcha")

## Decisions Made

- **Synthesize nodeChange → 'fields' dispatch (rather than a separate 'edge' changeKind).** The Plan 03 view only patches form fields by key — an extra `changeKind` would bloat the consumer's switch with no behavioural difference. Merge with any existing 'fields' dispatch on the same nodeId so the view receives one coherent payload per node per reconcile.
- **First-pass-silent baseline seeding.** On cold open, snapshot is populated but per-node fields dispatches are suppressed (per Plan Action step 6.b "build snapshot but skip the per-node fieldUpdates dispatch (otherwise every canvas open floods the bus)"). Reconciler-driven nodeChanges (e.g. cold-open D-03 migration) STILL broadcast because they ride on the synthesized-from-nodeChanges code path, not on the snapshot diff.
- **Dispatch + snapshot persistence happen AFTER write success.** Both Pattern B (`if (savedLive) ...`) and Strategy A (`await this.app.vault.modify(...)`) paths persist the snapshot and dispatch only on success. On write failure, snapshot is NOT updated so the next pass rebuilds correctly (T-01 idempotency / T-03 livelock guard).
- **CLAUDE.md compliance.** All Phase 50 D-01..D-14 JSDoc annotations preserved verbatim (11 occurrences after the change). The `collectIncomingEdgeEdits` helper at lines 345-359 untouched (per Plan Action step 8). Every new code block annotated `// Phase 63: ...` (22 occurrences).

## Deviations from Plan

None substantive — plan executed as written. One micro-deviation worth recording:

- **[Discretion - additive] Synthesized nodeChange → 'fields' dispatch loop added between the `edgeEdits` builder and the Pattern B try block.** This was implicit in Plan Action step 6.f ("dispatch for every nodeId that has fieldUpdates / nodeType change / deletion / both edge-induced and snapshot-induced changes") but the exact merge semantic was not spelled out. Chose: merge into existing 'fields' dispatch entry for the same nodeId if one exists; otherwise append fresh. This makes the regression-guard test pass on first pass when the snapshot baseline is empty, and is the cleanest read for Plan 03's consumer (single payload per node).

All other Action steps executed verbatim. Acceptance criteria grep counts all met or exceeded.

## Issues Encountered

None blocking. The first GREEN run revealed 2/10 still RED (the two regression-guard tests using `displayLabel-edge-mismatch.canvas` and the snippet-divergence test) — both expected reconciler-driven nodeChange dispatches on first pass. Fixed by adding the synthesized 'fields' dispatch loop documented above. Second GREEN run: 10/10 pass.

## Threat Model Compliance

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-01 (parse failure poisoning baseline) | ✅ Pre-existing Phase 50 guard at line 147 (`if (!parsed.success) return;`) preserved. Snapshot NOT updated on parse failure. |
| T-02 (snapshot map unbounded growth) | ✅ Three cleanup paths: `vault.on('rename')` purges old path; `vault.on('delete')` purges deleted path; `destroy()` clears the entire map. All three covered by Task 1 unit tests. |
| T-03 (infinite reconcile livelock) | ✅ Dispatch moved AFTER write success. D-07 short-circuit predicate now covers all five categories of change (edge diffs + nodeChanges + fieldUpdates + nodeType deltas + deletions). The "does not dispatch when reconcile is a no-op" test is the regression guard. |
| T-04 (subscriber leak through subscribe()) | ✅ `subscribe(handler)` returns an unsubscribe `() => void` that Plan 03 will wire through `Component.register(...)`. Internal EventTarget has no other handle. Dispatch via `new CustomEvent(...)` constructed in-place — no shared state escapes the dispatch site. |
| T-05 (synthetic re-entry from view writeback) | ⚠️ Defense-in-depth — primary mitigation lives in Plan 03 (`applyCanvasPatch` MUST NOT write to `pendingEdits`). Even if it did, Phase 50 D-07 idempotency would catch the second pass. |

No new threat surface introduced by this plan.

## User Setup Required

None. No external service configuration, no new env vars, no new dependencies, no CSS changes.

## Next Phase Readiness

- **Plan 03 (Wave 3) can proceed immediately.** All public APIs Plan 03 consumes are in place:
  - `EdgeLabelSyncService.subscribe((detail) => ...)` returns unsubscribe
  - `CanvasChangedForNodeDetail` exported with `changeKind: 'fields' | 'nodeType' | 'deleted'`, `fieldUpdates: Partial<Record<form-key, string | undefined>>`, `newKind?: RPNodeKind | null`
  - The dispatch contract is validated by 10 unit tests covering all changeKind variants
- **Build is GREEN end-to-end.** `npm run build` exits 0 (TypeScript compiles cleanly + esbuild produces main.js). 737/738 tests pass (1 pre-existing skip unrelated to this plan).
- **Phase 50 surface preserved.** The `displayLabel-edge-mismatch.canvas` regression test in this plan is the canonical guard — any future plan that breaks it will fail this test.

## Self-Check: PASSED

- ✅ FOUND: src/__tests__/edge-label-sync-service.test.ts (375 lines, 10 tests across 3 describe blocks)
- ✅ FOUND: src/canvas/edge-label-sync-service.ts (extended; 360 lines; all Phase 50 D-XX annotations preserved)
- ✅ FOUND: 4409191 (Task 1: test commit, RED state)
- ✅ FOUND: c208250 (Task 2: feat commit, GREEN turnover, +202/-14 lines)
- ✅ All Plan 02 acceptance_criteria grep counts met or exceeded:
  - canvas-changed-for-node: 5 (≥2 required)
  - lastSnapshotByFilePath: 8 (≥4 required)
  - subscribe(handler:: 1 (≥1 required)
  - vault.on('rename'/delete): 3 (1+1 required)
  - kind === 'answer' ?: 1 (1 required)
  - radiprotocol_snippetLabel + displayLabel: 7 (≥1 each)
  - Phase 63 annotations: 22 (≥5 required)
  - Phase 50 D-XX preserved: 11 (≥3 required)
- ✅ `npm test -- --run src/__tests__/edge-label-sync-service.test.ts` — 10/10 GREEN
- ✅ `npm test -- --run src/__tests__/edge-label-reconciler.test.ts src/__tests__/canvas-write-back.test.ts` — Plan 01 still GREEN (32/32)
- ✅ `npm test -- --run` — full suite 737 passed | 1 skipped (no regressions)
- ✅ `npm run build` — exits 0 (TypeScript + esbuild GREEN; build returned from intentionally-broken Plan 01 state)

---
*Phase: 63-bidirectional-canvas-node-editor-sync*
*Plan: 02*
*Completed: 2026-04-25*
