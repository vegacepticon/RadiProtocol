---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
plan: 03
subsystem: node-color-map + session-model + session-service
tags: [typescript, node-color-map, session-persistence, unified-loop, exhaustiveness-closure]

# Dependency graph
requires:
  - phase: 43-01
    provides: RPNodeKind union with 'loop' + legacy 'loop-start'/'loop-end' retained; LoopContext.loopNodeId rename; LoopNode interface
provides:
  - NODE_COLOR_MAP exhaustive over updated RPNodeKind — 'loop' entry added, legacy keys marked @deprecated (red palette "1" preserved)
  - PersistedLoopContext.loopNodeId aligned with runtime LoopContext shape (Plan 01 D-04)
  - validateSessionNodeIds reads frame.loopNodeId — old sessions surface as missing, cleared via existing RunnerView flow (D-13 Option B)
affects:
  - 43-04 (runner-state / protocol-runner propagation of loopNodeId uses PersistedLoopContext / LoopContext unified shape)
  - 43-05 (graph-validator — orthogonal; uses RPNode, NODE_COLOR_MAP unchanged)
  - 43-06 (runner-view dead-code removal for `case 'loop-end'` — unaffected by this plan)
  - 43-07 (session-service.test.ts inline literals will need update per D-18/D-20 in Plan 07)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record<RPNodeKind, string> exhaustiveness closure: union changes auto-surface all static maps; map mirrors union membership (legacy kinds kept because D-CL-05 variant b keeps them in union)"
    - "Cross-layer shape rename (runtime LoopContext.loopNodeId ↔ persisted PersistedLoopContext.loopNodeId) carried through all reader call-sites to maintain structural identity"
    - "Graceful-reject via existing missing-id flow (Option B from PATTERNS.md): no new load-path guard added — validator already catches canvas, validateSessionNodeIds catches session, RunnerView already clears"

key-files:
  created: []
  modified:
    - src/canvas/node-color-map.ts — added 'loop' entry; annotated 'loop-start'/'loop-end' @deprecated (legacy kept for Record exhaustiveness)
    - src/sessions/session-model.ts — PersistedLoopContext.loopStartId → loopNodeId; JSDoc documents rename + graceful-reject flow
    - src/sessions/session-service.ts — validateSessionNodeIds: 4 frame.loopStartId reads → frame.loopNodeId; Phase 43 D-04/D-13 marker comment added at function top

key-decisions:
  - "D-12 reality reconciliation: planner D-12 text said 'удалить loop-start/loop-end из map', but Plan 01 (D-CL-05 variant b) retained those kinds in RPNodeKind union — Record<RPNodeKind, string> then forces the map to keep them. Kept legacy entries with @deprecated comment. No functional deviation: color for legacy kinds is unused (validator catches them via MIGRATE-01 before any render); the entries satisfy TS exhaustiveness only."
  - "D-04 rename applied only to session layer fields this plan owns — PersistedLoopContext.loopNodeId (model) + 4 reads in validateSessionNodeIds (service). Runtime LoopContext.loopNodeId was already renamed in Plan 01; downstream plans 04+ will update protocol-runner use-sites."
  - "D-13 graceful reject Option B chosen (no new load-path schema check): legacy sessions with stale field names decode via JSON.parse into objects whose loopNodeId is undefined; validateSessionNodeIds reads undefined from frame.loopNodeId, graph.nodes.has(undefined) returns false, the undefined ID becomes a missing entry, RunnerView.sessionService.clear() fires — zero new code paths."

patterns-established:
  - "Phase-marker comments in this plan: @deprecated Phase 43 D-CL-05 on legacy color-map entries; Phase 43 D-12 on new loop entry; Phase 43 D-04/D-13 on session-model JSDoc + session-service function comment. Phase 29 D-11 marker on snippet color preserved untouched."
  - "CLAUDE.md never-remove-existing-code respected: session-service.ts async methods (load/save/clear/hasSession), WriteMutex usage, ensureFolderPath, vault.adapter.* calls, SESSION-07 dedup filter, session.currentNodeId check — all untouched. Only the two inner loops over loopContextStack were modified, field by field."

requirements-completed:
  - LOOP-01

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 43 Plan 03: Exhaustiveness Closure for Node Color Map + Session Layer Summary

**Three structurally-dependent files closed against Plan 01's `RPNodeKind` + `LoopContext` changes: `NODE_COLOR_MAP` gained `'loop': '1'` (legacy keys retained with `@deprecated` — D-CL-05 variant b keeps them in the union); `PersistedLoopContext.loopStartId` renamed to `loopNodeId` (Phase 43 D-04 / D-13); `validateSessionNodeIds` reads `frame.loopNodeId` in both loops, with a phase-marker comment explaining the graceful-reject (Option B) path.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T09:33:17Z
- **Completed:** 2026-04-17T09:35:53Z
- **Tasks:** 3 / 3
- **Files modified:** 3

## Accomplishments

- **Task 1 (node-color-map.ts):** Added `'loop': '1'` (red — the same palette slot as legacy loop boundary markers, per D-12). Legacy `'loop-start'` and `'loop-end'` entries kept with updated `@deprecated Phase 43 D-CL-05` comments because Plan 01 retained those kinds in `RPNodeKind` union, so `Record<RPNodeKind, string>` exhaustiveness demands their presence. Phase 29 D-11 snippet marker preserved unchanged.
- **Task 2 (session-model.ts):** Renamed `PersistedLoopContext.loopStartId` → `loopNodeId`. Extended JSDoc with `Phase 43 D-04 / D-13` marker documenting the break-compat rationale and the graceful-reject path. `PersistedUndoEntry` (contains `loopContextStack: PersistedLoopContext[]`) and `PersistedSession` inherit the new field transitively without direct edits.
- **Task 3 (session-service.ts):** Replaced both `frame.loopStartId` accesses with `frame.loopNodeId` (four reads total — two `has()` checks, two `push()` calls across the `undoStack` loop and the top-level `loopContextStack` loop). Added a four-line `Phase 43 D-04 / D-13` comment at the top of `validateSessionNodeIds` explaining the flow: legacy sessions surface as missing via existing path, RunnerView calls `sessionService.clear()`. Async `load`/`save`/`clear`/`hasSession`, `WriteMutex`, `ensureFolderPath`, `vault.adapter.*`, SESSION-07 dedup filter — untouched per CLAUDE.md.
- Plan-level TypeScript check passes: `npx tsc --noEmit --skipLibCheck` emits **zero** errors referencing any of the three modified files. Downstream errors in `protocol-runner.ts`, `runner-state.ts`, `graph-validator.ts`, `runner-view.ts`, and session-layer tests remain — this is the expected wave-2 scavenger-hunt output for plans 43-04..07 to repair.

## Task Commits

1. **Task 1: Add `'loop'` entry, mark legacy keys `@deprecated` in `NODE_COLOR_MAP`** — `5e54a91` (feat)
2. **Task 2: Rename `PersistedLoopContext.loopStartId` → `loopNodeId`** — `10d3f39` (refactor)
3. **Task 3: Update `validateSessionNodeIds` to read `frame.loopNodeId`** — `8f5a7a8` (refactor)

## Files Created/Modified

- `src/canvas/node-color-map.ts` — `+3, -2` lines: new `'loop': '1'` entry at the end of the `NODE_COLOR_MAP` initializer; comments on `'loop-start'`/`'loop-end'` rewritten to carry `@deprecated Phase 43 D-CL-05`. Import line and all other entries (start, question, answer, free-text-input, text-block, snippet) untouched.
- `src/sessions/session-model.ts` — `+6, -2` lines: JSDoc above `PersistedLoopContext` extended with `Phase 43 D-04 / D-13` rationale; field `loopStartId` → `loopNodeId`. `PersistedUndoEntry`, `PersistedSession` not touched.
- `src/sessions/session-service.ts` — `+10, -6` lines: 4-line phase-marker comment inserted at the top of `validateSessionNodeIds`; all four `frame.loopStartId` reads replaced with `frame.loopNodeId`; inline comments in the two loops updated to say "loopNodeIds" instead of "loopStartIds". Class body (`save`, `load`, `clear`, `hasSession`, `sessionFilePath`, `mutex`, `ensureFolderPath`) completely untouched.

## Decisions Made

- **D-12 reality reconciliation — kept legacy keys in `NODE_COLOR_MAP`:** The planner's D-12 text asked for removal of `'loop-start'` / `'loop-end'` keys, but this was written in the hypothetical where `RPNodeKind` no longer contains those literals. Plan 01 (D-CL-05 variant b) chose to keep them in the union with `@deprecated` JSDoc. Consequently, `Record<RPNodeKind, string>` exhaustiveness requires the keys to remain in the map. This is a correction by reality-of-types, not a deviation from D-12 intent: the *semantic* goal (unified loop has its own color entry; legacy entries are marked as deprecated) is met in full.
- **D-13 Option B — no new load-path guard:** Legacy sessions whose JSON still uses `loopStartId` already flow through `validateSessionNodeIds` to the missing-id branch: `JSON.parse` produces an object whose `loopNodeId` is `undefined`, `graph.nodes.has(undefined)` returns `false`, `missing.push(undefined)` adds the (post-dedup) undefined value to the list, and the RunnerView clears the session via its existing missing-id handler. Option A (an explicit schema guard in `load()`) would duplicate this behavior with extra code and a separate failure mode; Option B reuses the exact same flow that the PATTERNS.md map recommended.
- **Phase-marker comment placement in `validateSessionNodeIds`:** Added a single 4-line comment at the top of the function body rather than near each field access, because (a) the comment documents one consolidated change (the rename), (b) a single block is easier to keep in sync if a later plan touches these lines, and (c) placing it at the top (before the `currentNodeId` check) makes it discoverable to anyone reading the function for any reason.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed. The only judgment call was at Task 1, where the plan itself anticipated the D-12 / reality discrepancy and explicitly instructed retaining the legacy keys (see `<action>` paragraph in Task 1 and the plan's `<objective>` preamble). Both the planner and the executor converged on the same interpretation.

## Issues Encountered

- Three `PreToolUse:Edit` read-before-edit reminders fired (one per file), even though each file had been read in-session as part of the initial context load. The reminders were non-blocking — all three `Edit` operations applied successfully, as confirmed by immediate post-edit `Read` calls and `grep` verifications. This matches the harmless behaviour documented in the Plan 02 summary ("Issues Encountered" section).
- `grep -P` flag rejected with "supports only unibyte and UTF-8 locales" on the Windows shell when running Perl-compatible regex checks (Task 1 acceptance grep commands). Worked around by falling back to plain `grep` without `-P` — all acceptance predicates are simple literal substrings, no PCRE features needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `NODE_COLOR_MAP` is now structurally consistent with `RPNodeKind` post-Plan 01; no other color-map call-sites exist in the codebase.
- `PersistedLoopContext` shape matches runtime `LoopContext` shape — future session-layer code can deep-copy a `LoopContext[]` into `PersistedLoopContext[]` as an identity operation (the existing `loopContextStack: [...this.loopContextStack]` snapshots in `protocol-runner.ts` will continue to work once Plan 04 propagates `loopNodeId` into the runner).
- `validateSessionNodeIds` reader is aligned with the new persistence shape; Plan 07 Task 1 (D-18 cleanup) will update `session-service.test.ts` inline fixtures at lines 137, 195, 197 from `loopStartId:` literals to `loopNodeId:`.
- Remaining wave-2 / wave-3 TypeScript errors live exclusively in `runner-state.ts`, `protocol-runner.ts`, `graph-validator.ts`, `runner-view.ts`, and the session-service / protocol-runner test files — all slated for plans 43-04..07.
- No blockers: plans 43-04 (runner), 43-05 (validator) can proceed in parallel per wave 2 / wave 3 dependency graph.

## Self-Check: PASSED

**Files verified exist:**
- FOUND: `src/canvas/node-color-map.ts`
- FOUND: `src/sessions/session-model.ts`
- FOUND: `src/sessions/session-service.ts`

**Commits verified:**
- FOUND: `5e54a91` (feat(43-03): add 'loop' to NODE_COLOR_MAP, mark legacy keys @deprecated)
- FOUND: `10d3f39` (refactor(43-03): rename PersistedLoopContext.loopStartId to loopNodeId)
- FOUND: `8f5a7a8` (refactor(43-03): update validateSessionNodeIds to use frame.loopNodeId)

**Acceptance criteria verified:**

Task 1:
- `grep -q "'loop':" src/canvas/node-color-map.ts` → PASS
- `grep -q "Phase 43 D-12" src/canvas/node-color-map.ts` → PASS
- `grep -q "'loop-start':" src/canvas/node-color-map.ts` → PASS (legacy preserved)
- `grep -q "'loop-end':" src/canvas/node-color-map.ts` → PASS (legacy preserved)
- `grep -q "@deprecated Phase 43" src/canvas/node-color-map.ts` → PASS
- `grep -q "Phase 29, D-11" src/canvas/node-color-map.ts` → PASS (existing marker intact)
- `tsc --noEmit --skipLibCheck` emits 0 errors mentioning `node-color-map.ts` → PASS

Task 2:
- `grep -q "loopNodeId: string" src/sessions/session-model.ts` → PASS
- No `loopStartId: string` field present → PASS (substring only in JSDoc documenting the rename)
- `grep -q "Phase 43 D-04" src/sessions/session-model.ts` → PASS
- `tsc --noEmit --skipLibCheck` emits 0 errors mentioning `session-model.ts` → PASS

Task 3:
- `! grep "frame\.loopStartId" src/sessions/session-service.ts` → PASS (zero matches)
- `grep -q "frame\.loopNodeId" src/sessions/session-service.ts` → PASS
- `grep -q "Phase 43 D-04" src/sessions/session-service.ts` → PASS
- `grep -q "async load("`, `"async save("`, `"async clear("`, `"async hasSession("` → all PASS (methods preserved)
- `tsc --noEmit --skipLibCheck` emits 0 errors mentioning `session-service.ts` → PASS

**Plan-level criteria:**
- Commit contains exactly three files across three commits — node-color-map.ts (Task 1), session-model.ts (Task 2), session-service.ts (Task 3) → PASS
- No unintended deletions in any commit (`git diff --diff-filter=D HEAD~3 HEAD` returned empty) → PASS

---
*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Completed: 2026-04-17*
