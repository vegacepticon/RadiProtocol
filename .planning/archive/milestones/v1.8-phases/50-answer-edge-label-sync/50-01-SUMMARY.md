---
phase: 50-answer-edge-label-sync
plan: 01
subsystem: types
tags: [typescript, canvas-internal, type-def, edge-label-sync]

# Dependency graph
requires:
  - phase: 49-loop-exit-edge-convention
    provides: shared node-label.ts with isLabeledEdge/isExitEdge (available for reconciler in Plan 02)
provides:
  - Exported CanvasEdgeData interface in src/types/canvas-internal.d.ts
  - Typed CanvasData.edges (was unknown[], now CanvasEdgeData[])
  - Compile-time contract for edge.id / fromNode / toNode / label across the canvas write stack
affects:
  - Plan 50-02 (reconciler — consumes CanvasEdgeData for diff application)
  - Plan 50-03 (CanvasLiveEditor.saveLiveEdges — mutates updatedData.edges with typed access)
  - Plan 50-04 (editor-panel-view Display-label atomic write via extended saveLiveBatch)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror parser raw-shape interfaces for internal Obsidian Canvas types (RawCanvasEdge → CanvasEdgeData)"
    - "Index signature ([key: string]: unknown) as forward-compat escape hatch on Canvas DTOs"

key-files:
  created: []
  modified:
    - src/types/canvas-internal.d.ts

key-decisions:
  - "CanvasEdgeData field names mirror RawCanvasEdge (canvas-parser.ts:36-41) verbatim — single source of truth for edge shape"
  - "Index signature kept on CanvasEdgeData for forward-compat with fromSide/toSide/color without churn"
  - "Local loose-edge type in editor-panel-view.ts:215 intentionally left as unknown[] per PATTERNS.md §3 ripple-audit"

patterns-established:
  - "Shared Pattern G (CLAUDE.md append-only): insert new interface between existing interfaces; touch only the targeted type on the modified line"

requirements-completed: [EDGE-02]

# Metrics
duration: ~5min
completed: 2026-04-19
---

# Phase 50 Plan 01: CanvasEdgeData Type-Lift Summary

**Lifted `CanvasData.edges` from `unknown[]` to a typed `CanvasEdgeData[]` (mirrors `RawCanvasEdge` with forward-compat index signature), unblocking Wave 2 (`saveLiveEdges` + reconciler) compile-time edge field access.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-19T12:55:00Z
- **Completed:** 2026-04-19T12:57:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `export interface CanvasEdgeData` to `src/types/canvas-internal.d.ts` with `id`, `fromNode`, `toNode`, optional `label`, plus `[key: string]: unknown` index signature.
- Typed `CanvasData.edges` as `CanvasEdgeData[]` (was `unknown[]`) — single-line in-place change on line 33.
- Verified zero downstream breakage: the sole external consumer of `CanvasData` (`canvas-live-editor.ts:12`) continues to compile without modification; the intentionally-loose local type at `editor-panel-view.ts:215` left as-is per ripple-audit.
- Tsc clean, 466/1/0 vitest baseline preserved.

## Task Commits

1. **Task 1: Добавить CanvasEdgeData и типизировать CanvasData.edges** — `f920522` (feat)

## Files Created/Modified

- `src/types/canvas-internal.d.ts` — Added `CanvasEdgeData` interface between `CanvasNodeData` and `CanvasData`; changed `edges: unknown[]` → `edges: CanvasEdgeData[]`. Diff: +14/-1. No other interfaces touched (`CanvasNodeInternal`, `CanvasInternal`, `CanvasViewInternal` byte-identical).

## Decisions Made

- **CanvasEdgeData field shape:** mirrored `RawCanvasEdge` (`canvas-parser.ts:36-41`) verbatim — keeps the internal TS model and the parser's runtime shape in lockstep; prevents drift when Wave 2 writes use both sides.
- **Index signature:** kept `[key: string]: unknown` on `CanvasEdgeData` analogous to `CanvasNodeData` so future Obsidian edge fields (`fromSide`, `toSide`, `color`) do not require a type churn wave.
- **Scope discipline:** did NOT touch `editor-panel-view.ts:215` local type (`{ nodes: ...; edges: unknown[] }`) — PATTERNS.md §3 «Ripple-audit targets» explicitly leaves it as-is for Plan 01; if Plan 04 needs a tighter type there it will make that call in scope.

## Deviations from Plan

None — plan executed exactly as written.

- All 11 acceptance criteria passed on first run.
- Zero auto-fixes (Rule 1/2/3), zero architectural escalations (Rule 4).
- Zero CSS changes (Phase 50 is CSS-free per PATTERNS.md / CONTEXT.md).
- Diff is strictly additive (+14) plus a single in-place type swap on one line (-1/+1 net, counted as +1 insertion in the stat because of the inline comment annotation).

## Issues Encountered

None.

## User Setup Required

None — type-only change, no configuration, no new dependencies, no runtime impact.

## Verification

| Check | Expected | Actual |
|---|---|---|
| `grep -c "interface CanvasEdgeData" src/types/canvas-internal.d.ts` | 1 | 1 ✅ |
| `grep -c "edges: unknown\[\]" src/types/canvas-internal.d.ts` | 0 | 0 ✅ |
| `grep -c "edges: CanvasEdgeData\[\]" src/types/canvas-internal.d.ts` | 1 | 1 ✅ |
| `grep -c "answer-label-edge-sync.md" src/types/canvas-internal.d.ts` | ≥1 | 1 ✅ |
| `npx tsc --noEmit --skipLibCheck` | exit 0 | exit 0 ✅ |
| `npm test` | 466 passed / 1 skipped / 0 failed | 466 / 1 / 0 ✅ |

## Self-Check: PASSED

- File exists: `src/types/canvas-internal.d.ts` ✅
- Commit exists: `f920522` ✅
- All acceptance criteria (11/11) satisfied ✅

## Next Plan Readiness

Plan 50-02 (reconciler) and Plan 50-03 (`saveLiveEdges` on `CanvasLiveEditor`) may now `import type { CanvasEdgeData, CanvasData } from '../types/canvas-internal'` and treat `data.edges[].id / label / fromNode / toNode` as fully-typed fields. Wave 2 unblocked per PLAN `<success_criteria>`.

---
*Phase: 50-answer-edge-label-sync*
*Completed: 2026-04-19*
