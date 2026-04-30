---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
plan: 06
subsystem: testing
tags: [fixtures, canvas, unified-loop, cyrillic, json]

# Dependency graph
requires:
  - phase: 43-01
    provides: LoopNode interface + 'loop' literal in RPNodeKind + radiprotocol_headerText property
  - phase: 43-02
    provides: canvas-parser `case 'loop'` recognises radiprotocol_nodeType="loop" + builds LoopNode
provides:
  - unified-loop-valid.canvas — happy-path fixture for LOOP-03 + LOOP-04 (validator passes)
  - unified-loop-missing-exit.canvas — fixture for D-08.1 (loop without «выход»)
  - unified-loop-duplicate-exit.canvas — fixture for D-08.2 (≥2 «выход» edges)
  - unified-loop-no-body.canvas — fixture for D-08.3 (only «выход», no body)
affects:
  - 43-07 (unit tests via parseFixture('unified-loop-*.canvas') — migration errors + LOOP-04 sub-checks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture-based test authoring: one `.canvas` file per validator sub-check, minimum-viable-structure principle (mirror existing linear.canvas / branching.canvas shape)"
    - "Cyrillic edge labels as literal JSON strings (no escape sequences): UTF-8 file + double-quoted value with raw Cyrillic bytes"
    - "Legacy fixtures preserved untouched as separate migration-test-path (D-16) — never rewrite an old fixture when a new one serves a new contract"

key-files:
  created:
    - src/__tests__/fixtures/unified-loop-valid.canvas
    - src/__tests__/fixtures/unified-loop-missing-exit.canvas
    - src/__tests__/fixtures/unified-loop-duplicate-exit.canvas
    - src/__tests__/fixtures/unified-loop-no-body.canvas
  modified: []

key-decisions:
  - "All 4 fixtures use Cyrillic «выход» literal (5 chars в-ы-х-о-д) as the exit-edge label per D-08.1 contract — case-sensitive, no whitespace variations"
  - "unified-loop-valid.canvas back-edges through the loop node itself (n-a1 → n-loop, not through a separate loop-end node) — relies on Plan 43-03 D-09 cycle-through-loop marker change (kind === 'loop' instead of kind === 'loop-end')"
  - "Every fixture carries exactly one start-node — without it, validator Check 1 (no-start) would fire before LOOP-04 sub-checks, masking the intended test target"
  - "Wrote files via the Write tool (not bash heredoc) to preserve UTF-8 without BOM — confirmed via node fs byte-check"
  - "Legacy loop-start.canvas / loop-body.canvas left untouched per D-16 — they remain the canonical migration-error test fixtures for Plan 43-07"

patterns-established:
  - "Phase 43 fixture-naming convention: `unified-loop-<aspect>.canvas` kebab-case (D-CL-03) — parallel to `snippet-node-<variant>.canvas` pattern from Phase 29"
  - "Minimum-viable structure: every fixture is as small as possible while still exercising all preconditions (start node, loop node with headerText, edges under test)"

requirements-completed:
  - LOOP-03
  - LOOP-04

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 43 Plan 06: Unified-Loop Fixtures Summary

**Four new `.canvas` fixtures under `src/__tests__/fixtures/` (unified-loop-valid / missing-exit / duplicate-exit / no-body) giving Plan 43-07 deterministic test cases for LOOP-03 parsing + LOOP-04 sub-checks D-08.1/2/3; legacy loop-start.canvas and loop-body.canvas preserved untouched for D-16 migration-error path.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T09:49:43Z
- **Completed:** 2026-04-17T09:51:40Z
- **Tasks:** 1 / 1
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- Created `unified-loop-valid.canvas` — happy-path: `n-start → n-loop`; `n-loop -(«проверка»)→ n-q1 → n-a1 → n-loop` (body + back-edge through loop); `n-loop -(«выход»)→ n-end` (terminal text-block)
- Created `unified-loop-missing-exit.canvas` — loop with body branch + back-edge but zero «выход» edges → D-08.1 trigger
- Created `unified-loop-duplicate-exit.canvas` — loop with body branch + back-edge + TWO «выход» edges (to n-end1 and n-end2) → D-08.2 trigger
- Created `unified-loop-no-body.canvas` — loop with only a «выход» edge, no body branches → D-08.3 trigger
- All 4 fixtures carry exactly one `radiprotocol_nodeType: "start"` node and one `radiprotocol_nodeType: "loop"` node with `radiprotocol_headerText: "Lesion loop"`
- All 4 fixtures are valid JSON (verified via `node -e "JSON.parse(...)"`)
- All 4 fixtures written as UTF-8 without BOM (verified via node `fs.readFileSync` byte-check)
- Legacy `loop-start.canvas` and `loop-body.canvas` untouched (verified via `git diff --quiet`)

## Task Commits

1. **Task 1: Create 4 unified-loop fixture files** — `df647bd` (test)

## Files Created/Modified

- `src/__tests__/fixtures/unified-loop-valid.canvas` — 5 nodes (start, loop, question, answer, text-block), 5 edges (one «выход», one «проверка», three unlabeled). Happy-path graph that will pass Plan 43-03 validator (LOOP-03 parsing + LOOP-04 checks + D-09 cycle-marker).
- `src/__tests__/fixtures/unified-loop-missing-exit.canvas` — 4 nodes (start, loop, question, answer), 4 edges (one «проверка», three unlabeled — back-edge from n-a1 to n-loop closes the body; zero «выход»). Target: D-08.1 «не имеет ребра «выход»».
- `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` — 6 nodes (start, loop, question, answer, two text-blocks n-end1/n-end2), 6 edges (one «проверка», TWO «выход», three unlabeled). Target: D-08.2 «несколько рёбер «выход»».
- `src/__tests__/fixtures/unified-loop-no-body.canvas` — 3 nodes (start, loop, text-block), 2 edges (one unlabeled start→loop, one «выход» loop→end). Target: D-08.3 «не имеет ни одной body-ветви».

Total: 59 insertions, 0 deletions; zero modifications to existing files (fully additive).

## Decisions Made

- **Used Plan-provided JSON content verbatim** — the plan specified the exact JSON body for each fixture; executor applied it byte-for-byte via the Write tool. No creative reinterpretation. This preserves the careful structural decisions the planner made (back-edge topology, cycle-through-loop pattern, node positioning, id naming scheme).
- **Back-edge topology in unified-loop-valid:** `n-a1 → n-loop` (not through a separate loop-end or back to n-q1) — exercises D-09 (`detectUnintentionalCycles` now marks cycles through `kind === 'loop'` as intentional) already shipped in Plan 43-03.
- **Single `radiprotocol_headerText: "Lesion loop"` value across all 4 fixtures** — consistency lets Plan 43-07 reuse the expected-string literal across multiple `expect(errors.some(...))` assertions; no need for per-fixture custom header names.
- **Zero edits to any existing fixture file** — `git diff --stat` on the commit confirms only the 4 new files changed; legacy `loop-start.canvas` / `loop-body.canvas` remain byte-identical so Plan 43-07 migration-error tests can point at them and get the guaranteed legacy canvas JSON.
- **LF line endings on commit (git CRLF warning noted)** — git warned `LF will be replaced by CRLF the next time Git touches it` on Windows. This is environmental (git `core.autocrlf`) and does not affect JSON parseability (the parser reads via `node fs.readFileSync('…','utf-8')` which accepts either line-ending convention). No action taken; CRLF vs LF is a working-copy concern only.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; this is a pure fixture-authoring task with zero runtime/security surface, no TypeScript compilation, no runtime validation to wire.

## Issues Encountered

None. All 10 acceptance-criteria checks from the plan passed on first run:

1. 4 files exist — PASS
2. All 4 parse as JSON — PASS
3. Exactly 1 start + 1 loop node per fixture — PASS
4. `radiprotocol_headerText` present in each loop node — PASS
5. unified-loop-valid has exactly 1 «выход» + «проверка» present — PASS
6. unified-loop-missing-exit contains no «выход» — PASS
7. unified-loop-duplicate-exit has ≥2 «выход» — PASS (exactly 2)
8. unified-loop-no-body has exactly 1 label total, which is «выход» — PASS
9. Legacy loop-start.canvas / loop-body.canvas untouched (`git diff --quiet`) — PASS
10. UTF-8 encoding, no BOM — PASS

## User Setup Required

None — fixture authoring requires no external service configuration, no credentials, no env vars.

## Next Phase Readiness

- Plan 43-07 can immediately consume the 4 new fixtures via the existing `parseFixture(name)` helper at `src/__tests__/graph-validator.test.ts:13`. Expected test shape:
  ```ts
  it('returns no errors for unified-loop-valid.canvas (LOOP-03 + LOOP-04)', () => {
    const graph = parseFixture('unified-loop-valid.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors).toHaveLength(0);
  });
  it('flags missing «выход» edge (D-08.1)', () => {
    const graph = parseFixture('unified-loop-missing-exit.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('«выход»'))).toBe(true);
  });
  // ...etc for duplicate-exit / no-body
  ```
- Plan 43-07 can point migration-error tests at the pre-existing `loop-start.canvas` / `loop-body.canvas` fixtures, which remain byte-identical (D-16 contract).
- No blockers: Plan 43-07 is ready to run.

## Self-Check: PASSED

**Files verified exist:**
- FOUND: `src/__tests__/fixtures/unified-loop-valid.canvas`
- FOUND: `src/__tests__/fixtures/unified-loop-missing-exit.canvas`
- FOUND: `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas`
- FOUND: `src/__tests__/fixtures/unified-loop-no-body.canvas`

**Commits verified:**
- FOUND: `df647bd` (test(43-06): add unified-loop fixtures for LOOP-03/LOOP-04)

**Acceptance criteria verified (10/10):**
- Files exist — PASS
- Valid JSON parse — PASS
- Exactly 1 start + 1 loop per fixture — PASS
- radiprotocol_headerText present — PASS
- unified-loop-valid: 1 «выход» + «проверка» — PASS
- unified-loop-missing-exit: no «выход» — PASS
- unified-loop-duplicate-exit: 2 «выход» — PASS
- unified-loop-no-body: 1 label, which is «выход» — PASS
- Legacy fixtures unchanged (`git diff --quiet`) — PASS
- UTF-8 without BOM — PASS

**Additive-only verification:**
- `git log -1 --stat` → 4 files changed, 59 insertions(+), 0 deletions(-) — PASS (no file deletions, no modifications to pre-existing fixtures)

---
*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Completed: 2026-04-17*
