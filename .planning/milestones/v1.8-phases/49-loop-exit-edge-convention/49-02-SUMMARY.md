---
phase: 49
plan: 02
subsystem: graph
tags: [phase-49, loop-exit-edge-convention, graph, validator, tdd]
requires:
  - src/graph/node-label.ts (Plan 49-01 — nodeLabel, isLabeledEdge, isExitEdge)
  - src/graph/graph-model.ts (RPNode, RPEdge, ProtocolGraph type shapes)
provides:
  - GraphValidator LOOP-04 check rewired to isLabeledEdge() + D-01/D-02/D-03 Russian error copy
  - GraphValidator.nodeLabel() delegating to sharedNodeLabel()
  - Test coverage for five LOOP-04 scenarios (happy path + D-01 + D-02 duplicate + D-02 stray + D-03)
affects:
  - src/graph/graph-validator.ts — LOOP-04 block (lines 92-125) + private nodeLabel() body (lines 236-243)
  - src/__tests__/graph-validator.test.ts — Phase 43 LOOP-04 describe block (lines 199-270) + D-CL-02 order test (lines 304-319)
tech-stack:
  added: []
  patterns:
    - "Shared predicate delegation: validator LOOP-04 filter uses isLabeledEdge from src/graph/node-label.ts (single source of truth for D-05 trim semantics)"
    - "Private-method delegating wrapper: this.nodeLabel() keeps call-site stability while the switch body lives in the shared module (D-13)"
key-files:
  created: []
  modified:
    - src/graph/graph-validator.ts
    - src/__tests__/graph-validator.test.ts
decisions:
  - "D-13 delegation style: kept private this.nodeLabel() wrapper calling sharedNodeLabel(node) — minimal diff churn, existing callers at :42 / :65 / :103 / :206 unchanged"
  - "Migration-error block at lines 47-50 left unchanged per D-15 — literal «выход» inside the legacy loop-start/loop-end repair guidance is still correct for that legacy-canvas message"
  - "D-CL-02 order test (line 305) updated to assert Phase 49 D-01 wording absent instead of the old «не имеет ребра «выход»» — preserves the original intent (migration check early-returns before LOOP-04) while speaking the new error copy"
metrics:
  duration: ~6 minutes (wall clock 12:07Z → 12:13Z)
  completed: 2026-04-19
  tasks: 2/2
  files_created: 0
  files_modified: 2
  commits: 2
  tests_added: 1 (new D-02 stray-body-label test)
  tests_modified: 5 (4 LOOP-04 assertion updates + 1 D-CL-02 wording update)
---

# Phase 49 Plan 02: Validator LOOP-04 Rewire Summary

**One-liner:** Rewrote the LOOP-04 check in `src/graph/graph-validator.ts` to use `isLabeledEdge()` from the shared `src/graph/node-label.ts` module and emit D-01/D-02/D-03 Russian error strings verbatim; delegated `GraphValidator.nodeLabel()` to the shared `sharedNodeLabel()` (D-13) eliminating the duplicated switch body; updated 4 existing LOOP-04 tests to new error copy + added 1 new stray-body-label test.

---

## What Changed

### Modified — `src/graph/graph-validator.ts`

**Import added (line 5):**

```typescript
import { nodeLabel as sharedNodeLabel, isLabeledEdge } from './node-label';
```

**LOOP-04 block rewritten (lines 92-125):**

- Filter changed from `e.label === 'выход'` / `e.label !== 'выход'` → `isLabeledEdge(e)` / `!isLabeledEdge(e)` — whitespace-only labels are now correctly classified as unlabeled (D-05).
- Error copy updated to D-01 / D-02 / D-03 verbatim from 49-CONTEXT.md:
  - **D-01** (0 labeled): `Loop-узел "{label}" не имеет выхода. Пометьте ровно одно исходящее ребро — его метка станет подписью кнопки выхода.`
  - **D-02** (≥2 labeled): `Loop-узел "{label}" имеет несколько помеченных исходящих рёбер: {edgeIds}. Должно быть ровно одно выходное ребро — снимите метки с остальных.`
  - **D-03** (0 unlabeled): `Loop-узел "{label}" не имеет тела — добавьте исходящее ребро без метки.`
- Comment header updated — references Phase 49 EDGE-01, D-01/D-02/D-03, D-05, and the shared module path.
- `{edgeIds}` interpolation unchanged: `exitEdges.map(e => e.id).join(', ')` — same shape as pre-Phase-49 line 111.

**Private `nodeLabel()` delegated (lines 236-243):**

```typescript
private nodeLabel(node: RPNode): string {
  return sharedNodeLabel(node);
}
```

12-line switch body replaced with 1-line delegation. All 4 existing callers (`:42` / `:65` / `:103` / `:206`) continue to call `this.nodeLabel(...)` — no call-site churn.

### Unchanged (explicitly preserved)

- **Migration-error block (lines 47-50)** — still says `метка «выход» на одном из исходящих рёбер обозначает ветвь выхода, остальные исходящие рёбра — тело цикла`. Per D-15 ("No migration pass"), this legacy wording is the author-facing repair guidance for a v1.7 canvas with `loop-start`/`loop-end` nodes; it describes the target convention in v1.7 language. Safe to leave — is NOT on the LOOP-04 code path.
- **Cycle detection (lines 172-232)** — untouched.
- **Dead-end question check (lines 79-89)** — untouched.
- **BFS reachability (lines 54-71, 146-164)** — untouched.
- **`bfsReachable`, `detectUnintentionalCycles`** — bodies unchanged.

### Modified — `src/__tests__/graph-validator.test.ts`

Inside `describe('GraphValidator — Phase 43: unified loop + migration (LOOP-04, MIGRATE-01)')`:

- **LOOP-04 happy path (`unified-loop-valid.canvas`, lines 201-213):** Asserts NONE of D-01/D-02/D-03 error substrings appear; migration-error also absent. Phase-49 wording.
- **D-01 missing-exit test (`unified-loop-missing-exit.canvas`, lines 215-226):** Asserts `не имеет выхода` + `Пометьте ровно одно исходящее ребро` + `Lesion loop`. Phase-49 wording.
- **D-02 duplicate-exit test (`unified-loop-duplicate-exit.canvas`, lines 228-243):** Asserts `несколько помеченных исходящих рёбер` + all three ids (`e2`, `e3`, `e4`) + `снимите метки с остальных`. Note: fixture has three labeled edges under D-05 (e2=проверка, e3=выход, e4=выход) — all three trigger D-02.
- **D-03 no-body test (`unified-loop-no-body.canvas`, lines 245-255):** Asserts `не имеет тела` + `добавьте исходящее ребро без метки`. Phase-49 wording.
- **NEW D-02 stray-body-label test (`unified-loop-stray-body-label.canvas`, lines 257-270):** References the fixture Plan 04 will create; asserts `несколько помеченных исходящих рёбер` + mentions of both `e2` and `e3`.
- **D-CL-02 order test (lines 304-319):** Updated — assertion `не имеет ребра «выход»` → `не имеет выхода` + added a negative guard `не имеет ребра` to prove the old wording is gone. Preserves original test intent (migration check runs before LOOP-04 and early-returns).

Untouched: MIGRATE-01 tests (lines 272-302), D-09 tests (lines 321-340), all `describe('valid protocols'...)` / `describe('error detection (PARSE-07, PARSE-08)'...)` / `describe('GraphValidator — Phase 31...')` / `describe('GraphValidator — snippet node (Phase 29, D-12)')` blocks above line 196.

---

## Verification

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit --skipLibCheck` | **exit 0** (clean) |
| Full test suite | `npx vitest run` | **461 passed / 1 skipped / 3 failed** (34 files) |
| Target test file | `npx vitest run src/__tests__/graph-validator.test.ts` | **18 passed / 3 failed** (expected — Plan 04 dependencies) |
| `grep -c "from './node-label'" graph-validator.ts` | | **1** ✓ |
| `grep -c "isLabeledEdge" graph-validator.ts` | | **4** (≥2) ✓ |
| `grep -c "e.label === 'выход'" graph-validator.ts` | | **0** ✓ |
| `grep -c "e.label !== 'выход'" graph-validator.ts` | | **0** ✓ |
| `grep -c "не имеет выхода" graph-validator.ts` | | **1** ✓ |
| `grep -c "несколько помеченных исходящих рёбер" graph-validator.ts` | | **1** ✓ |
| `grep -c "не имеет тела" graph-validator.ts` | | **1** ✓ |
| `grep -c "не имеет ребра «выход»" graph-validator.ts` | | **0** ✓ |
| `grep -c "return sharedNodeLabel(node);" graph-validator.ts` | | **1** ✓ |
| `grep -c "не имеет выхода" graph-validator.test.ts` | | **6** (≥2) ✓ |
| `grep -c "несколько помеченных исходящих рёбер" graph-validator.test.ts` | | **5** (≥4) ✓ |
| `grep -c "не имеет тела" graph-validator.test.ts` | | **3** (≥2) ✓ |
| `grep -c "unified-loop-stray-body-label.canvas" graph-validator.test.ts` | | **2** (test-desc + parseFixture call) ✓ |
| `grep -c "не имеет ребра «выход»" graph-validator.test.ts` | | **1** (comment only — assertion rewired to Phase 49 wording) ✓ |
| `grep -c "legacy loop-body.canvas returns migration-error" graph-validator.test.ts` | | **1** ✓ |

### Expected failures (Plan-04-dependent — documented in plan's `<verify>` block)

1. `unified-loop-valid.canvas passes LOOP-04 checks` — fails because `e2` still carries `label: "проверка"` (pre-Plan-04 fixture shape); under new D-05 it's labeled → D-02 fires. Plan 04 strips the label (D-20), test goes green.
2. `unified-loop-missing-exit.canvas flags zero labeled outgoing edges` — fails because `e2` still carries `label: "проверка"`; under new D-05 it IS labeled, so D-01 does NOT fire. Plan 04 strips the label; D-01 fires; test goes green.
3. `unified-loop-stray-body-label.canvas flags a second labeled edge` — fails with ENOENT because fixture doesn't exist yet. Plan 04 creates it (D-16); test goes green.

These three are the Plan 05 combined-gate deliverable. Baseline before Plan 02: 463 passed. After Plan 02: 461 passed + 1 new test awaiting fixture = net `–2 previously-green, +1 new-red-awaiting-fixture = 3 red`, all locked-in to Plan 04 dependencies.

---

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `f4effe5` | refactor | refactor(49-02): rewire LOOP-04 to isLabeledEdge + delegate nodeLabel to shared util |
| 2 | `a9c9fa8` | test | test(49-02): update LOOP-04 assertions to Phase 49 D-01/D-02/D-03 + add stray-body-label test |

---

## Decisions Made

1. **Delegation via `this.nodeLabel()` private wrapper (D-13 "Claude's Discretion")** — kept rather than inlining `sharedNodeLabel(node)` at every call site. Rationale: the class has 4 callers (`:42`, `:65`, `:103`, `:206`); replacing the method body with a 1-line delegation is less churn than rewriting 4 call sites and preserves the encapsulation convention used by `bfsReachable` / `detectUnintentionalCycles`. The private method remains a valid unit of validator semantics — D-13 explicitly permits either approach.

2. **Migration-error text left verbatim (D-15)** — lines 47-50 still reference `метка «выход»` inside the legacy loop-start/loop-end repair guidance. This is the correct author-facing message for a v1.7 canvas that hasn't yet been manually repaired; the message describes the target convention using the literal an author would remember from v1.7. Phase 49's job is to rewrite the *LOOP-04* check, not the migration-error wording. Zero user-facing regression.

3. **D-CL-02 order test updated to Phase 49 wording** (plan gave freedom between "update" or "leave as strict old-wording guard"). Chose to update to `не имеет выхода` because (a) the test's intent is "LOOP-04 doesn't run on legacy canvases" and LOOP-04 now emits D-01 wording; (b) kept `не имеет ребра` as a negative guard to prove the old literal is gone from the whole validator. Best-of-both-worlds.

4. **Duplicate-exit test asserts all three ids (`e2`, `e3`, `e4`)** — pre-Phase-49 this test only asserted `e3` and `e4` because `e2`'s `проверка` label didn't trigger the old `=== 'выход'` check. Under new D-05 semantics, `e2` is labeled too → D-02 error must list all three. Test updated to reflect the expanded semantics (still a subset of the plan's behavior expectation).

---

## Deviations from Plan

### Rule 2 — Auto-added missing critical functionality

**1. D-CL-02 order test: added negative guard `не имеет ребра`**
- **Found during:** Task 2 acceptance verification.
- **Issue:** The plan offered a choice between updating the `не имеет ребра «выход»` assertion to new wording OR leaving it as a "strict old-wording gone" guard. Strict choice would erode test semantics (the test name mentions LOOP-04 error suppression, so it should assert *current* LOOP-04 wording is absent). But dropping the old-wording guard loses the regression protection against anyone accidentally re-introducing the pre-Phase-49 literal.
- **Fix:** Did both — primary assertion updated to `не имеет выхода` (Phase 49 D-01), plus added a sibling assertion `expect(errors.some(e => e.includes('не имеет ребра'))).toBe(false)` to guard the stem of the old literal.
- **Files modified:** `src/__tests__/graph-validator.test.ts` (within Task 2 commit `a9c9fa8`).
- **Commit:** `a9c9fa8`.
- **Rule:** Rule 2 (correctness — test coverage should both speak the current wording AND guard against regression to the old one).

No other deviations. Task 1 and Task 2 executed as the plan's `<action>` blocks specified.

---

## Deferred Issues

None. No out-of-scope findings were logged.

---

## Known Stubs

None. Plan 49-02's scope is complete end-to-end per the `<output>` spec:
- ✓ LOOP-04 rewrite lines documented
- ✓ Migration-error block unchanged confirmation
- ✓ `this.nodeLabel()` delegation choice documented
- ✓ Test count (5 LOOP-04 tests shipped — 4 updated + 1 new; MIGRATE-01 block preserved)

Three red tests are expected deferral to Plan 04, not stubs. The validator itself is fully wired.

---

## Threat Model Coverage

Both STRIDE threats from the plan's `<threat_model>` are addressed:

- **T-49-02-01 (Tampering / DoS, LOOP-04 rewrite):** New filter uses `isLabeledEdge` (D-05 trim-based), so whitespace-only labels cannot sneak past the uniqueness rule. Edge-ids in D-02 come from parser-normalised `edge.id` strings (schema-validated by CanvasParser); validator output is consumed by stdout / RunnerView text nodes — no HTML interpolation risk.
- **T-49-02-02 (Elevation of Privilege):** n/a — accepted per plan. Validator is pure-function returning `string[]`; no privilege surface introduced.

No threat flags surfaced during implementation — no new trust boundaries, no new network/auth/file-access surface.

---

## Self-Check: PASSED

- `src/graph/graph-validator.ts` — FOUND (modified)
- `src/__tests__/graph-validator.test.ts` — FOUND (modified)
- Commit `f4effe5` — FOUND (git log)
- Commit `a9c9fa8` — FOUND (git log)
- TypeScript `--noEmit` exit 0 ✓
- All grep acceptance criteria pass ✓
- 461 passed / 1 skipped / 3 failed — 3 failures are plan-documented Plan-04 dependencies ✓
- No unintended file deletions (`git diff --diff-filter=D --name-only f4effe5~1 HEAD` → empty) ✓
