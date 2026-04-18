---
phase: 46-free-text-input-removal
plan: 01
subsystem: graph-model
tags: [removal, migration-error, parser, validator, typescript-discriminated-union]

# Dependency graph
requires:
  - phase: 43-unified-loop
    provides: "MIGRATE-01 pattern (Russian parseError surfaced through existing RunnerView error panel) reused for CLEAN-02"
provides:
  - "RPNodeKind union without 'free-text-input' member"
  - "FreeTextInputNode interface deleted from graph-model.ts"
  - "RPNode discriminated union without FreeTextInputNode arm"
  - "CanvasParser.parse() returns { success: false, error } with Russian rejection when kind === 'free-text-input'"
  - "GraphValidator nodeLabel() switch no longer handles 'free-text-input' (exhaustiveness-enforced)"
  - "free-text.canvas fixture repurposed from RUN-04 happy-path to CLEAN-02 rejection fixture (content unchanged)"
  - "New src/__tests__/free-text-input-migration.test.ts with 3 green rejection tests"
affects:
  - "46-02-runner-views-color-map-PLAN (closes 10 downstream TS errors in src/canvas/node-color-map.ts + src/runner/protocol-runner.ts + src/views/editor-panel-view.ts + src/views/runner-view.ts)"
  - "46-03-test-cleanup-PLAN (closes 4 downstream TS errors in src/__tests__/runner/protocol-runner.test.ts + src/__tests__/node-picker-modal.test.ts)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parse-time rejection with typed-union removal — kind excised from RPNodeKind + dedicated Russian parseError branch BEFORE validKinds.includes() check (D-46-01-A2)"
    - "Fixture repurposing — physical canvas file retained; SEMANTIC ROLE flips from happy-path to rejection proof via new test file"

key-files:
  created:
    - "src/__tests__/free-text-input-migration.test.ts"
  modified:
    - "src/graph/graph-model.ts"
    - "src/graph/canvas-parser.ts"
    - "src/graph/graph-validator.ts"

key-decisions:
  - "D-46-01-A: hard-delete 'free-text-input' from RPNodeKind (not @deprecated-keep like Phase 43 loop-start/loop-end) because free-text has no replacement kind that downstream needs to switch on"
  - "D-46-01-A2: rejection lives at PARSE time, not validate() time — since the kind is absent from RPNodeKind, GraphValidator receives a ProtocolGraph that structurally cannot contain a free-text-input node; parser returns a parseError surfaced through the existing success:false path"
  - "D-46-01-B: Russian error text contains three mandatory tokens — «устаревший» (rejection vocabulary), «free-text-input» (literal kind), and the raw node id as author-facing locator"
  - "D-46-01-C: free-text.canvas fixture retained on disk; semantic role flipped from RUN-04 happy-path to CLEAN-02 rejection fixture"
  - "D-46-01-D: nodeLabel() 'free-text-input' arm deletion is forced by TS exhaustiveness after RPNodeKind shrinks — not a separate manual step"

patterns-established:
  - "When removing a discriminated-union kind with no downstream replacement: excise from the union (not @deprecated-keep), rely on TS exhaustiveness to propagate compile errors, handle parse-time rejection with a dedicated branch before the generic validKinds check"
  - "Russian parseError pattern for break-compatibility migrations — mirrors Phase 43 MIGRATE-01 vocabulary («устаревший») and the existing parser's { success: false; error } surface"

requirements-completed: [CLEAN-01, CLEAN-02]

# Metrics
duration: ~4min
completed: 2026-04-18
---

# Phase 46 Plan 01: Graph Model, Parser, Validator — Free-Text-Input Excision Summary

**Excised FreeTextInputNode from RPNodeKind + RPNode union + parser case arm + validator nodeLabel switch; CanvasParser now rejects legacy `radiprotocol_nodeType = "free-text-input"` at parse-time with a Russian rebuild instruction containing «устаревший», the literal «free-text-input» token, and the offending node id.**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-04-18T12:30:00Z (approx.)
- **Completed:** 2026-04-18T12:36:50Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 3 source + 1 test created

## Accomplishments

- CLEAN-01 closed: `free-text-input` gone from `RPNodeKind`; `FreeTextInputNode` interface deleted; `RPNode` union shrunk
- CLEAN-02 closed: parser returns `{ success: false, error }` with Russian rejection for any canvas carrying `radiprotocol_nodeType = "free-text-input"`
- New migration test file with 3 green tests (fixture rejection, inline JSON rejection, negative-control happy-path)
- Fixture `free-text.canvas` repurposed from RUN-04 happy-path to CLEAN-02 rejection proof without changing on-disk content
- Downstream TS breakage catalogued with precise error count + file list for Plan 46-02 / 46-03 baseline

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing CLEAN-02 rejection tests** — `0ea6616` (test)
2. **Task 2 (GREEN): excise free-text-input type; parser Russian rejection** — `8185dbb` (feat)

## Files Created/Modified

- `src/__tests__/free-text-input-migration.test.ts` (new, 55 lines) — 3 vitest tests asserting Russian parseError contains «устаревший» + «free-text-input» + node id; negative control on text-block.canvas
- `src/graph/graph-model.ts` — 3 deletions (union member line 13, interface lines 46-52, RPNode arm line 121)
- `src/graph/canvas-parser.ts` — 3 deletions (import line 13, validKinds entry, case arm lines 210-226) + 1 addition (Russian rejection branch with 3-line comment block immediately before `validKinds.includes()` check)
- `src/graph/graph-validator.ts` — 1 deletion (nodeLabel() `case 'free-text-input'` arm at former line 243, TS-exhaustiveness-forced)

## Verification Grep Gates (all pass)

| Criterion | Expected | Actual |
|---|---|---|
| `grep -c "free-text-input" src/graph/graph-model.ts` | 0 | 0 |
| `grep -c "FreeTextInputNode" src/graph/graph-model.ts` | 0 | 0 |
| `grep -c "FreeTextInputNode" src/graph/canvas-parser.ts` | 0 | 0 |
| `grep -c "free-text-input" src/graph/canvas-parser.ts` | 2-4 | 3 |
| `grep -c "устаревший" src/graph/canvas-parser.ts` | 1 | 1 |
| `grep -c "free-text-input" src/graph/graph-validator.ts` | 0 | 0 |
| `grep -rn "FreeTextInputNode" src/graph/` | 0 matches | 0 |

## Migration Test Contents

Three tests in `src/__tests__/free-text-input-migration.test.ts`:

1. `rejects src/__tests__/fixtures/free-text.canvas with Russian error containing the node id and the literal «free-text-input» token` — parses fixture, asserts `result.success === false` and error contains `устаревший`, `free-text-input`, `n-ft1`.
2. `rejects an inline canvas JSON with one start + one free-text-input node; error contains all three tokens` — asserts same three tokens with inline id `ft-x`.
3. `negative control: text-block.canvas (no free-text-input) still parses cleanly` — asserts `result.success === true` on `text-block.canvas` to prove the rejection branch is narrowly scoped.

All three assertion tokens («устаревший», «free-text-input», node id) mandated by D-46-01-B are enforced by Tests 1 and 2.

## Decisions Made

All five Plan-frontmatter decisions confirmed at execution time:

- **D-46-01-A** (hard-delete from union): applied. RPNodeKind now has 8 kinds (start, question, answer, text-block, loop-start@deprecated, loop-end@deprecated, snippet, loop).
- **D-46-01-A2** (parse-time rejection, not validate()): applied. No change to `GraphValidator.validate()` — it cannot detect free-text-input canvases because the parser drops them at `success: false` before a ProtocolGraph is ever constructed.
- **D-46-01-B** (Russian error text): applied verbatim — `Узел "${raw.id}" использует устаревший тип "free-text-input". Этот тип был удалён. Замените узел на question или text-block и перестройте ветвь вручную.`
- **D-46-01-C** (fixture semantic repurposing): applied — `src/__tests__/fixtures/free-text.canvas` content unchanged; only role flipped via new test consumption.
- **D-46-01-D** (nodeLabel() deletion via TS-exhaustiveness): applied — the `case 'free-text-input': return node.promptLabel || node.id;` line in `graph-validator.ts` was the only free-text arm in an exhaustive switch and had to go; no other validator changes were necessary.

## Deviations from Plan

None — plan executed exactly as written. All 5 decisions from the plan's `<decisions>` section were locked at planning time and applied verbatim.

## Downstream Breakage Baseline (for Plan 46-02 and 46-03)

`npx tsc --noEmit --skipLibCheck` exits non-zero with **13 errors** across **6 files** — exactly the Plan 46-02 + 46-03 scope:

### Plan 46-02 scope (runtime + views + color map — 9 errors across 4 files):

- `src/canvas/node-color-map.ts:16` — 1 error (TS2353: `'free-text-input'` not in `Record<RPNodeKind, string>`)
- `src/runner/protocol-runner.ts:225` — 1 error (TS2367: comparison with removed kind)
- `src/runner/protocol-runner.ts:238` — 1 error (TS2339: `.prefix` on never)
- `src/runner/protocol-runner.ts:239` — 1 error (TS2339: `.suffix` on never)
- `src/runner/protocol-runner.ts:515` — 1 error (TS2694: no exported `FreeTextInputNode`)
- `src/runner/protocol-runner.ts:595` — 1 error (TS2678: switch case mismatch)
- `src/views/editor-panel-view.ts:463` — 1 error (TS2678: switch case mismatch)
- `src/views/runner-view.ts:399` — 1 error (TS2678: switch case mismatch)
- `src/views/runner-view.ts:401` — 1 error (TS2339: `.promptLabel` on never)

### Plan 46-03 scope (test cleanup — 4 errors across 2 files):

- `src/__tests__/node-picker-modal.test.ts:17` — 1 error (TS2305: import removed member)
- `src/__tests__/runner/protocol-runner.test.ts:127` — 1 error (TS2322: inline graph with free-text-input)
- `src/__tests__/runner/protocol-runner.test.ts:415` — 1 error (TS2322: inline graph)
- `src/__tests__/runner/protocol-runner.test.ts:751` — 1 error (TS2769: Map constructor overload mismatch)

All 13 errors are **intentional and expected** — `<success_criteria>` in PLAN.md explicitly documents "build red downstream as expected (wave-2 closes it)".

`npm test` (full suite) would also fail because of the same compile-time breakage plus a runtime failure in the legacy `describe('enterFreeText() — free-text input node (RUN-04)')` block — also handed off to Plan 46-03 (CLEAN-04), which **deletes** those tests rather than migrating them (free-text has no replacement).

The migration test itself (`src/__tests__/free-text-input-migration.test.ts`) runs in isolation green: `npm test -- src/__tests__/free-text-input-migration.test.ts --run` → `3/3 passed`.

## Issues Encountered

None. Two minor operational notes:

- Edit tool's read-before-edit hook re-fired after each successful `Edit` to `graph-model.ts` / `canvas-parser.ts` / `graph-validator.ts` despite the files already having been Read at session start — each edit nonetheless landed correctly (verified by post-edit Grep). No content loss; no retry needed.
- `Bash` heredoc with Cyrillic text in a multi-line pipeline failed with exit 1 on the first combined verification sweep — replaced with individual `Grep` tool calls which read the same files cleanly. No impact on correctness of the verification.

## TDD Gate Compliance

- **RED gate** (`0ea6616`) — `test(46-01): RED - ...` — confirmed failing (2/3 tests failed before Task 2 edits).
- **GREEN gate** (`8185dbb`) — `feat(46-01): GREEN - ...` — confirmed passing (3/3 tests passed after Task 2 edits).
- **REFACTOR gate** — not applicable; GREEN code is already minimal (single if-branch + 3 deletions).

Per-task TDD execution flow followed the plan's `tdd="true"` directive on both Task 1 and Task 2.

## User Setup Required

None — no external service configuration required. CLEAN-02 rejection is purely a parser-level behaviour change.

## Next Phase Readiness

- **Plan 46-02 ready to start:** clear scope (4 downstream files, 9 TS errors); no architectural decisions needed because TS exhaustiveness mechanically identifies every site that must drop its `free-text-input` handling.
- **Plan 46-03 ready to start in parallel with 46-02:** test-cleanup scope (2 files, 4 TS errors) is fully independent of 46-02's source changes — the two can run as a parallel wave.
- **Migration canvas in the wild:** Users who upgrade with a persisted canvas containing a `free-text-input` node will see the Russian parseError (T-46-01-01 threat register disposition — accept/documented). The error tells them which node id and how to rebuild. No data loss.

## Self-Check: PASSED

Verified via Grep / Bash:

- `src/__tests__/free-text-input-migration.test.ts` — FOUND (55 lines)
- Commit `0ea6616` — FOUND (RED)
- Commit `8185dbb` — FOUND (GREEN)
- 3 source files (graph-model.ts, canvas-parser.ts, graph-validator.ts) — modified as described
- All acceptance grep gates from PLAN.md `<acceptance_criteria>` — pass
- Migration test — 3/3 green in isolation

---

*Phase: 46-free-text-input-removal*
*Plan: 01 (wave 1)*
*Completed: 2026-04-18*
