---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
plan: 01
subsystem: graph-model
tags: [typescript, discriminated-union, graph-model, loop-node]

# Dependency graph
requires:
  - phase: v1.0 (foundation)
    provides: LoopStartNode / LoopEndNode / LoopContext.loopStartId baseline types
provides:
  - Unified `LoopNode` interface with kind:'loop' + headerText:string
  - `'loop'` literal added to RPNodeKind union
  - `LoopContext.loopNodeId` (renamed from `loopStartId`)
  - Legacy LoopStartNode / LoopEndNode interfaces retained with @deprecated JSDoc for migration-error parsing path (MIGRATE-01)
affects:
  - 43-02 (canvas-parser: add `case 'loop'`; retain legacy cases per D-06)
  - 43-03 (graph-validator: Migration Check + LOOP-04 sub-checks + nodeLabel update)
  - 43-04 (node-color-map: add 'loop' entry; keep legacy keys while legacy kinds exist)
  - 43-05 (session-model + session-service: propagate loopNodeId rename + D-13 graceful reject)
  - 43-06 (runner-state + protocol-runner: propagate loopNodeId + stub loop runtime for Phase 44)
  - 43-07 (runner-view: remove dead `case 'loop-end'` arm)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union exhaustiveness as scavenger-hunt: adding/renaming kinds forces TS to surface every switch/Record use-site"
    - "Legacy-kind preservation with @deprecated JSDoc — break-compat at validator layer, not at parser layer (D-CL-05 variant b)"

key-files:
  created: []
  modified:
    - src/graph/graph-model.ts — RPNodeKind union, LoopNode interface, LoopContext rename, legacy interfaces @deprecated

key-decisions:
  - "D-CL-05 variant (b): kept LoopStartNode / LoopEndNode names (not renamed to LegacyLoop*) with @deprecated JSDoc — simpler downstream wiring; nodeLabel/parser/editor-panel continue to work without rename sweep"
  - "`'loop'` literal placed AFTER `'snippet'` in RPNodeKind union (not inside legacy group) — signals it is the new first-class kind; legacy `'loop-start'` / `'loop-end'` left in their historical positions with inline `@deprecated` comments"
  - "LoopNode shape mirrors QuestionNode (one string payload, always defined) rather than SnippetNode (optional string) — header text is always present semantically, parser normalizes undefined → '' per D-05"

patterns-established:
  - "Phase-marker comments: every new/modified block carries `// Phase 43 D-<N>: <brief>` marker, original per-phase markers (Phase 29, Phase 31 D-01/D-04) are untouched"
  - "JSDoc @deprecated on retired-but-retained types: preferred over deletion when downstream parsing path still needs the type definition"

requirements-completed:
  - LOOP-01
  - LOOP-02

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 43 Plan 01: Unified Loop — Graph Model Summary

**Unified `LoopNode` (kind:'loop' + headerText:string) added to `src/graph/graph-model.ts`, `LoopContext.loopStartId` renamed to `loopNodeId`, legacy `LoopStartNode`/`LoopEndNode` retained with `@deprecated` JSDoc so parser/validator can still process legacy canvases for MIGRATE-01 error emission.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T09:23:12Z
- **Completed:** 2026-04-17T09:25:20Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Added `'loop'` literal to `RPNodeKind` union (LOOP-01)
- Defined new `LoopNode` interface with `kind: 'loop'` + `headerText: string` (LOOP-02) mirroring `QuestionNode` shape
- Renamed `LoopContext.loopStartId` → `loopNodeId` (D-04) with updated JSDoc referencing the unified loop node
- Preserved `LoopStartNode` / `LoopEndNode` interface declarations (D-CL-05 variant b) annotated with `@deprecated` JSDoc citing D-03 + MIGRATE-01
- Added `LoopNode` member to `RPNode` discriminated union; retained legacy members so legacy canvas JSON still parses into typed nodes that the validator can then flag with migration-error
- File is internally self-consistent (TypeScript compiles `graph-model.ts` with zero own-file errors); downstream files (`canvas-parser.ts`, `graph-validator.ts`, `node-color-map.ts`, `protocol-runner.ts`, `runner-state.ts`, `session-service.ts`, `session-model.ts`, `runner-view.ts`) emit the expected exhaustiveness / missing-field errors that plans 43-02..07 will repair

## Task Commits

1. **Task 1: Rebuild RPNodeKind + RPNode union, add LoopNode interface, rename LoopContext.loopStartId → loopNodeId, mark LoopStartNode/LoopEndNode @deprecated** — `58d8f2f` (feat)

## Files Created/Modified

- `src/graph/graph-model.ts` — Extended `RPNodeKind`, added `LoopNode` interface, renamed `LoopContext.loopStartId`, annotated legacy interfaces `@deprecated`, added `LoopNode` to `RPNode` union. `RPNodeBase`, `StartNode`, `QuestionNode`, `AnswerNode`, `FreeTextInputNode`, `TextBlockNode`, `SnippetNode`, `RPEdge`, `ProtocolGraph`, `ParseResult` left untouched per CLAUDE.md never-remove-existing-code.

## Decisions Made

- **D-CL-05 variant (b) chosen:** kept `LoopStartNode` / `LoopEndNode` names with `@deprecated` JSDoc instead of renaming to `LegacyLoopStartNode` / `LegacyLoopEndNode`. Rationale: downstream editor-panel-view, protocol-runner, validator already reference these type names; renaming would force mechanical updates in every plan 43-02..07 without functional gain. The `@deprecated` marker is sufficient signal for future removal (post-v1.7).
- **Union ordering:** `'loop'` placed at the END of `RPNodeKind` after `'snippet'` — preserves historical ordering of prior kinds, marks the new unified kind as the most-recent addition; legacy `'loop-start'` / `'loop-end'` stay in their v1.0 positions so downstream cases that iterate the union in source order see the familiar shape.
- **`LoopNode.headerText` non-optional (`string`, not `string | undefined`):** mirrors `QuestionNode.questionText` and `TextBlockNode.content`, which are always defined with parser normalizing missing to `''`. This avoids `node.headerText ?? ''` sprinkling across validator/runtime in later plans.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; this is a pure type-model edit with no runtime or security surface.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `LoopNode` type and `LoopContext.loopNodeId` are now the canonical shape for all downstream Phase 43 plans
- Downstream plans 43-02..07 will have their TypeScript errors surfaced automatically by the discriminated-union exhaustiveness mechanism (23 errors currently emitted by `tsc --noEmit` across parser/validator/node-color-map/runner/session/view — this is expected wave-1 scavenger-hunt output)
- No blockers: plans 43-02..07 can proceed in the dependency order defined by `.planning/ROADMAP.md`

## Self-Check: PASSED

**Files verified exist:**
- FOUND: `src/graph/graph-model.ts`

**Commits verified:**
- FOUND: `58d8f2f` (feat(43-01): introduce unified LoopNode + loopNodeId in graph-model)

**Acceptance criteria verified:**
- `grep -q "| 'loop';" src/graph/graph-model.ts` → PASS
- `grep -q "export interface LoopNode extends RPNodeBase" src/graph/graph-model.ts` → PASS
- `grep -q "headerText: string;" src/graph/graph-model.ts` → PASS
- `grep -q "loopNodeId: string;" src/graph/graph-model.ts` → PASS
- `grep -q "| LoopNode" src/graph/graph-model.ts` → PASS
- `LoopStartNode` / `LoopEndNode` have `@deprecated` JSDoc immediately above → PASS
- `FreeTextInputNode` / `SnippetNode` Phase 31 markers intact → PASS
- `tsc --noEmit` emits 0 errors mentioning `graph-model.ts` (23 downstream errors are expected per plan) → PASS

---
*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Completed: 2026-04-17*
