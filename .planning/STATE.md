---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Loop Rework & Regression Cleanup
status: executing
stopped_at: Completed 43-04-PLAN.md (runner-state + protocol-runner + runner-view minimal surgery; build gate deferred to plan 05/07)
last_updated: "2026-04-17T09:47:18.198Z"
last_activity: 2026-04-17
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 7
  completed_plans: 4
  percent: 57
---

# RadiProtocol — Project State

**Updated:** 2026-04-17
**Milestone:** v1.7 — Loop Rework & Regression Cleanup
**Status:** Ready to execute
**Last session:** 2026-04-17T09:47:18.191Z
**Stopped at:** Completed 43-04-PLAN.md (runner-state + protocol-runner + runner-view minimal surgery; build gate deferred to plan 05/07)

---

## Current Position

Phase: 43 (unified-loop-graph-model-parser-validator-migration-errors) — EXECUTING
Plan: 5 of 7
Status: Ready to execute
Last activity: 2026-04-17

Progress: [██████░░░░] 57% (0/4 phases, 4/7 plans)

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-17)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** Phase 43 — unified-loop-graph-model-parser-validator-migration-errors

---

## v1.7 Phase Map

| Phase | Name | Requirements |
|-------|------|--------------|
| 43 | Unified Loop — Graph Model, Parser, Validator & Migration Errors | LOOP-01, LOOP-02, LOOP-03, LOOP-04, MIGRATE-01, MIGRATE-02 |
| 44 | Unified Loop Runtime | RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07 |
| 45 | Loop Editor Form, Picker & Color Map | LOOP-05, LOOP-06 |
| 46 | Free-Text-Input Removal | CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04 |

---

## Performance Metrics

**Velocity:**

- Total plans completed (v1.6): 14
- v1.6 duration: 1 day (2026-04-16 → 2026-04-17)
- Average plan size: 1–5 plans per phase

**v1.7 plan metrics:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 43    | 01   | 2min     | 1     | 1     |

---
| Phase 43 P02 | 2min | 1 tasks | 1 files |
| Phase 43 P03 | 3min | 3 tasks | 3 files |
| Phase 43 P04 | 5min | 3 tasks | 3 files |

## Accumulated Context

### v1.0–v1.6 Shipped

- v1.0: 7 phases — foundation (parser, runner, UI, editor panel, snippets, loops, sessions)
- v1.2: 8 phases — runner UX and bug fixes (layout, selectors, separators, read-back fixes)
- v1.3: 1 phase — interactive placeholder chip editor
- v1.4: 4 phases — auto node coloring, snippet node (8th kind), mixed answer+snippet branching
- v1.5: 4 phases — snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner)
- v1.6: 7 phases — dead-code audit, canvas node creation, node duplication, live canvas update

### v1.7 Design Decisions (locked during /gsd-explore)

1. Break-compatibility chosen over auto-migration — old `loop-start`/`loop-end` canvases produce a validator error, author rebuilds loops
2. Exit edge identified by edge label «выход»
3. Multiple body branches allowed; each iteration re-presents the picker
4. One-step picker combining body-branch labels + «выход»
5. `maxIterations` removed entirely; no per-loop or global cap
6. Nested loops keep working via the existing `LoopContext` stack
7. Loop node owns an editable `headerText` rendered above the picker

### Standing Pitfalls

1. Never modify `.canvas` while open in Canvas view (Strategy A) unless Pattern B live-editor is used
2. `vault.modify()` race conditions — use `WriteMutex` (async-mutex) per file path
3. No `innerHTML` — use DOM API and Obsidian helpers
4. No `require('fs')` — use `app.vault.*` exclusively
5. `loadData()` returns null on first install — always merge with defaults
6. `console.log` forbidden in production — use `console.debug()` during dev
7. CSS files are append-only per phase — edit only the relevant feature file in `src/styles/`
8. Shared files (main.ts, editor-panel-view.ts, snippet-manager-view.ts) — only modify code relevant to the current phase
9. Real-DOM vs mock-DOM parent lookup: always use `parentElement` first, `.parent` mock fallback second
10. v1.7-specific: LOOP rework must delete the old iteration cap (RUN-07) — do not carry the `maxIterations` field forward for any reason

### Known Follow-ups (non-blocking)

- Node Editor panel stale `subfolderPath` display after folder move/rename (cosmetic)
- Chip editor English labels (Phase 27 legacy)
- Nyquist VALIDATION.md draft for phases 12–19, 28–31, 32–35, 36–42

### Decisions (Phase 43)

- Plan 43-01: kept `LoopStartNode` / `LoopEndNode` names with `@deprecated` JSDoc (D-CL-05 variant b) instead of renaming to `LegacyLoop*` — simpler downstream wiring; `LoopNode` shape mirrors `QuestionNode` (`headerText: string`, parser normalizes missing to `''`).
- Plan 43-02: parser `case 'loop'` uses `getString(props, 'radiprotocol_headerText', '')` with empty-string fallback (NOT `raw.text ?? ''`) — empty header is a legitimate authored state; no silent fallback to native canvas text. Legacy parser cases `'loop-start'` / `'loop-end'` preserved unchanged (D-06) so Plan 43-03 validator can aggregate MIGRATE-01 error over `LoopStartNode`/`LoopEndNode` instances. `+13` lines additive only — zero deletions.
- Plan 43-03: `NODE_COLOR_MAP` kept legacy `'loop-start'` / `'loop-end'` keys with `@deprecated Phase 43 D-CL-05` markers — `Record<RPNodeKind, string>` exhaustiveness forces them while Plan 01 (D-CL-05 variant b) keeps legacy kinds in `RPNodeKind` union; `'loop': '1'` (red) added per D-12 at end. Correction by reality-of-types, not deviation from D-12 intent.
- Plan 43-03: `PersistedLoopContext.loopStartId` → `loopNodeId` (D-04 / D-13 break-compat); `validateSessionNodeIds` reader updated to `frame.loopNodeId` (4 reads across two loops). D-13 Option B chosen — no new load-path schema guard: legacy sessions flow through existing missing-id path (`graph.nodes.has(undefined)` → false), RunnerView clears via `sessionService.clear()`. Zero new code paths.
- Plan 43-04: `advanceThrough` `case 'loop'` = soft `transitionToError` (D-CL-04 option b) — runner enters error-state, existing RunnerView error panel renders message, no uncaught throw. Merged fall-through `case 'loop-start'`/`case 'loop-end'` kept for TS-exhaustiveness (Plan 01 D-CL-05 variant b retains legacy kinds in union) with distinct programmer-error message. `chooseLoopAction` preserved as `@deprecated` no-op stub (D-18 Surprise #2: `.skip`-ed tests in `protocol-runner.test.ts`/`protocol-runner-session.test.ts` still compile against the class shape). `getState()` `'at-node'` simplified to `loopIterationLabel: undefined` — Phase 44 owns the full label format over `LoopNode.headerText`. Inline `LoopContext`-shaped type literals in `getSerializableState`/`restoreFrom` signatures migrated `loopStartId → loopNodeId`. `runner-view.ts` `case 'loop-end'` block removed entirely (Surprise #1, ~43 lines); CSS classes in `loop-support.css` preserved for Phase 45 picker restoration (Surprise #5).

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.6 (2026-04-17)
- Current working tree: `src/styles.css` and `styles.css` modified (pre-existing, unrelated to v1.7)
