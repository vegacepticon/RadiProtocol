---
phase: 49-loop-exit-edge-convention
verified: 2026-04-19T11:32:28Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 49: Loop Exit Edge Convention — Verification Report

**Phase Goal:** A loop node's outgoing edges follow the new label-based exit convention — exactly one labeled edge is the exit, its label becomes the Runner button caption, and validator rejects ambiguous configurations with plain-language Russian errors.
**Verified:** 2026-04-19T11:32:28Z
**Status:** passed
**Re-verification:** No — initial verification
**Requirement closed:** EDGE-01

---

## Goal Achievement

### Observable Truths

Merged from ROADMAP Success Criteria + per-plan `must_haves.truths`:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GraphValidator emits D-01 Russian error for zero labeled outgoing edges | VERIFIED | `graph-validator.ts:107-108` emits `Loop-узел "${label}" не имеет выхода. Пометьте ровно одно исходящее ребро — его метка станет подписью кнопки выхода.` verbatim |
| 2 | GraphValidator emits D-02 Russian error for ≥2 labeled outgoing edges (with comma-joined edge ids) | VERIFIED | `graph-validator.ts:112-117` emits `Loop-узел "${label}" имеет несколько помеченных исходящих рёбер: ${dupIds}. Должно быть ровно одно выходное ребро — снимите метки с остальных.` verbatim; `dupIds = exitEdges.map(e => e.id).join(', ')` |
| 3 | GraphValidator emits D-03 Russian error for zero unlabeled (body) edges | VERIFIED | `graph-validator.ts:119-124` emits `Loop-узел "${label}" не имеет тела — добавьте исходящее ребро без метки.` verbatim |
| 4 | Runner exit-button caption reads the sole labeled outgoing edge's label verbatim (no hardcoded «выход» in RunnerView) | VERIFIED | `runner-view.ts:489-496`: `caption = (edge.label ?? '').trim()` when `isExitEdge(edge)` true; no literal «выход» anywhere in src/views |
| 5 | Body-branch button caption uses shared `nodeLabel(target)` (D-11/D-12) | VERIFIED | `runner-view.ts:494-495`: `caption = target !== undefined ? nodeLabel(target) : edge.toNodeId` |
| 6 | ProtocolRunner.chooseLoopBranch dispatches via `isExitEdge(edge)` — no literal «выход» comparison | VERIFIED | `protocol-runner.ts:195`: `if (isExitEdge(edge))` pops loop frame |
| 7 | Shared `node-label.ts` module exports `nodeLabel`, `isLabeledEdge`, `isExitEdge` (D-13) | VERIFIED | `src/graph/node-label.ts` — 3 named exports; `isExitEdge` aliased to `isLabeledEdge` (D-07); all 8 kind arms in nodeLabel switch |
| 8 | `isLabeledEdge` treats null / undefined / empty / whitespace-only labels as NOT labeled (D-05) | VERIFIED | `node-label.ts:40-42`: `edge.label != null && edge.label.trim() !== ''`; 12 `it.each` cases in `node-label.test.ts` assert exact D-05 semantics |
| 9 | Legacy canvases using the literal «выход» label continue to work (no migration needed) | VERIFIED | «выход» is a non-empty label → D-05 treats it as labeled → old v1.7 canvases still dispatch through the same code path; UAT Scenario 3 in 49-05-SUMMARY confirms in TEST-BASE |
| 10 | Stray-body-label fixture exercises D-02 error with both edge ids | VERIFIED | `unified-loop-stray-body-label.canvas` has `e2 label=проверка` + `e3 label=выход` → 2 labeled edges on n-loop; `graph-validator.test.ts` asserts both ids appear in D-02 error |
| 11 | Fixture corpus honours D-05 (unlabeled = body) and D-20 (stray labels stripped from valid-intent fixtures) | VERIFIED | `unified-loop-valid.canvas`, `unified-loop-nested.canvas`, `unified-loop-long-body.canvas`, `unified-loop-missing-exit.canvas` — zero `"label": "проверка"` instances; `"label": "выход"` retained only on exit-meant edges |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/graph/node-label.ts` | 3 exports (nodeLabel, isLabeledEdge, isExitEdge), zero Obsidian imports | VERIFIED | 2567 bytes; `import type { RPNode, RPEdge } from './graph-model'` only; all 8 nodeLabel switch arms present; `isExitEdge = isLabeledEdge` alias per D-07 |
| `src/graph/graph-validator.ts` | LOOP-04 uses `isLabeledEdge`; emits D-01/D-02/D-03 verbatim; delegates nodeLabel to shared util | VERIFIED | `import { nodeLabel as sharedNodeLabel, isLabeledEdge } from './node-label'` at line 5; LOOP-04 block uses `isLabeledEdge(e)` twice (lines 101, 102); `this.nodeLabel` at line 242 returns `sharedNodeLabel(node)`; three Russian strings each present exactly once |
| `src/runner/protocol-runner.ts` | chooseLoopBranch dispatches via `isExitEdge(edge)` | VERIFIED | `import { isExitEdge } from '../graph/node-label'` at line 6; `if (isExitEdge(edge))` at line 195 (only call site of loopContextStack.pop()); zero literal «выход» in the file |
| `src/views/runner-view.ts` | Loop picker uses `isExitEdge` + `nodeLabel`; exit caption = trimmed label; body caption = nodeLabel(target) | VERIFIED | `import { isExitEdge, nodeLabel } from '../graph/node-label'` at line 14; awaiting-loop-pick arm (lines 483-500) uses both; click-handler ordering `capturePendingTextareaScroll → syncManualEdit → chooseLoopBranch → autoSaveSession → renderAsync` preserved (lines 501-507) |
| `src/__tests__/fixtures/unified-loop-stray-body-label.canvas` | New D-02 fixture (2 labeled outgoing edges) | VERIFIED | 1295 bytes; `"fromNode": "n-loop"` appears twice (e2 label=проверка, e3 label=выход) |
| `src/__tests__/fixtures/unified-loop-valid.canvas` | Stray body label stripped (D-20) | VERIFIED | `e2` is `{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1" }` — no label; `e3` retains `"label": "выход"` (sole exit) |
| `src/__tests__/graph/node-label.test.ts` | 20+ unit tests for D-05 trim semantics + all 8 nodeLabel kind arms | VERIFIED | 5897 bytes; vitest run green (part of 466 total passes) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/graph/node-label.ts` | `src/graph/graph-model.ts` | `import type { RPNode, RPEdge }` | WIRED | Line 7 |
| `src/graph/graph-validator.ts` | `src/graph/node-label.ts` | `import { nodeLabel as sharedNodeLabel, isLabeledEdge }` | WIRED | Line 5; both imports consumed (LOOP-04 filters + line 242 delegation) |
| `src/runner/protocol-runner.ts` | `src/graph/node-label.ts` | `import { isExitEdge }` | WIRED | Line 6; used at line 195 in chooseLoopBranch dispatch |
| `src/views/runner-view.ts` | `src/graph/node-label.ts` | `import { isExitEdge, nodeLabel }` | WIRED | Line 14; both consumed in awaiting-loop-pick arm |
| `src/__tests__/graph-validator.test.ts` | `unified-loop-stray-body-label.canvas` | `parseFixture('unified-loop-stray-body-label.canvas')` | WIRED | Fixture loaded + D-02 substring asserted + `e2` + `e3` ids asserted |

---

### Data-Flow Trace (Level 4)

For runtime dispatch and view rendering artifacts:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `runner-view.ts` awaiting-loop-pick arm | `outgoing` edges list | `this.graph.edges.filter(e => e.fromNodeId === state.nodeId)` — real canvas parse output | Yes — real graph edges (verified by UAT Scenario 1: Runner rendered `выполнено` + `Шаг 1` captions from real canvas) | FLOWING |
| `runner-view.ts` body-button caption | `target` node lookup | `this.graph.nodes.get(edge.toNodeId)` — real graph map | Yes — UAT Scenario 1 shows `Шаг 1` (target text-block's first 30 chars) | FLOWING |
| `protocol-runner.ts` chooseLoopBranch dispatch | `edge` | Graph edge selected by `edgeId` param from user click | Yes — test `protocol-runner-loop-picker.test.ts` `Phase 49 D-05` cases prove `готово` edge pops frame, unlabeled edge does not | FLOWING |
| `graph-validator.ts` LOOP-04 filters | `exitEdges` / `bodyEdges` | `outgoing.filter(e => isLabeledEdge(e))` / complement | Yes — validator tests for missing-exit / duplicate-exit / no-body / stray-body all produce expected error strings | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npx vitest run` | `Test Files 34 passed (34) · Tests 466 passed · 1 skipped (467)` | PASS |
| Shared module exports | file read + grep on `export function nodeLabel`, `export function isLabeledEdge`, `export const isExitEdge` | 3 named exports verified | PASS |
| Zero runtime literal «выход» in src/graph, src/runner, src/views | `Grep pattern: edge\.label === 'выход'` | No matches (only 1 hit in test file narrative comment) | PASS |
| D-01 / D-02 / D-03 strings in validator | grep on each Russian string | exactly 1 each in graph-validator.ts | PASS |
| Fixture JSON validity + stray-body contract | Read fixture | 2 labeled outgoing edges on n-loop (e2 проверка, e3 выход); parseable JSON | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EDGE-01 | 49-01, 49-02, 49-03, 49-04, 49-05 (all five plans declare `requirements: [EDGE-01]`) | A loop node's outgoing edges follow a new convention: exactly one labeled edge is the loop exit; GraphValidator rejects loop nodes with zero or two-or-more labeled outgoing edges with clear Russian error messages | SATISFIED | (1) Shared util in `src/graph/node-label.ts` implements D-05 trim-based labeled predicate; (2) Validator LOOP-04 rewritten to use `isLabeledEdge`, emits D-01/D-02/D-03 verbatim; (3) ProtocolRunner dispatch via `isExitEdge`; (4) RunnerView caption via trimmed label + nodeLabel(target); (5) REQUIREMENTS.md line 113 marks EDGE-01 complete 2026-04-19; (6) UAT PASS in TEST-BASE vault on 2026-04-19 confirmed all three scenarios |

**Orphan scan:** REQUIREMENTS.md Traceability table maps only EDGE-01 to Phase 49. All five plans' frontmatter declares `requirements: [EDGE-01]`. No orphaned or unclaimed requirement IDs.

---

### Anti-Patterns Found

Scanned all 9 modified source files (per 49-05-SUMMARY rollup metrics).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No blockers found | — | — |

**Notes on acceptable narrative uses of «выход»:**

- `graph-validator.ts:49` — migration-error string for legacy `loop-start`/`loop-end` canvases; intentional per D-15 (locked decision).
- `graph-validator.ts:93, 108` — narrative inside the new Russian error text ("подпись кнопки выхода"); part of D-01 error copy.
- `runner-state.ts:38`, `protocol-runner.ts:315, 582` — JSDoc/inline narrative comments describing legacy-equivalent behaviour for future readers; no runtime comparison.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:173` — narrative comment explaining what the regression test guards against (`edge.label === 'выход'` re-introduction).

None of the above are runtime comparisons. Zero stubs, zero TODO/FIXME, zero hardcoded empty placeholders introduced by Phase 49.

---

### Human Verification Required

**No further human verification is required.**

The only human-verifiable items — visual confirmation of the non-«выход» exit button caption, D-01/D-02/D-03 error panel rendering, and legacy «выход» canvas regression — were already executed in the Phase 49 Plan 05 UAT checkpoint on 2026-04-19 in TEST-BASE vault. User reply `"approved"` covered all three scenarios. This is documented in `49-05-SUMMARY.md` §Task 2 and in REQUIREMENTS.md line 51 (EDGE-01 closed 2026-04-19).

---

## Gaps Summary

**No gaps.** All 11 merged must-haves (3 ROADMAP Success Criteria + 8 plan-specific truths) are verified against the codebase. The shared util is the single source of truth for label extraction and exit discrimination. All three runtime consumers (validator, runner, view) import from it. Zero runtime literal-«выход» comparisons survive. Error copy matches D-01/D-02/D-03 verbatim. Fixture corpus aligns with D-05/D-20. UAT in a real Obsidian vault confirmed the three observable behavioural changes.

Phase 49 achieves its goal. EDGE-01 closed. Phase is shippable; ROADMAP tick can propagate to the progress table.

---

*Verified: 2026-04-19T11:32:28Z*
*Verifier: Claude (gsd-verifier)*
