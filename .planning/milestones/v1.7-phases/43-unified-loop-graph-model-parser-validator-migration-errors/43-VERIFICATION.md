---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
verified: 2026-04-17T13:30:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
requirements_verified:
  - LOOP-01
  - LOOP-02
  - LOOP-03
  - LOOP-04
  - MIGRATE-01
  - MIGRATE-02
---

# Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors Verification Report

**Phase Goal:** The canvas format, graph model, parser, and validator all speak the new unified `loop` node — and any canvas that still uses the old `loop-start`/`loop-end` pair is clearly rejected with rebuild instructions before the runner is touched.

**Verified:** 2026-04-17T13:30:00Z
**Status:** passed
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parsing a canvas whose `radiprotocol_nodeType = "loop"` yields a `LoopNode` in the graph with its `headerText` populated from the canvas JSON (LOOP-01, LOOP-02, LOOP-03) | VERIFIED | `src/graph/graph-model.ts:67-70` declares `LoopNode { kind: 'loop'; headerText: string }`; `src/graph/canvas-parser.ts:283-293` constructs `LoopNode` with `headerText: getString(props, 'radiprotocol_headerText', '')`; `'loop'` present in `validKinds` (line 163); fixture `unified-loop-valid.canvas` exercises the path; test `unified-loop-valid.canvas passes LOOP-04 checks` in `graph-validator.test.ts:202` passes. |
| 2 | Validator surfaces a clear error when a `loop` node is missing its «выход» edge or has no body-branch outgoing edges (LOOP-04) | VERIFIED | `src/graph/graph-validator.ts:91-124` implements three sub-checks (missing «выход», duplicate «выход» with edge IDs, no body); error messages contain required Russian lexemes («выход», «не имеет ребра», «не имеет ни одной body-ветви», «имеет несколько рёбер»); three fixtures (`unified-loop-missing-exit.canvas`, `unified-loop-duplicate-exit.canvas`, `unified-loop-no-body.canvas`) + tests at `graph-validator.test.ts:217-249` all pass. |
| 3 | Opening a canvas that still contains a `loop-start` or `loop-end` node produces a plain-language validator error naming the obsolete node type and instructing the author to rebuild the loop with the unified `loop` node (MIGRATE-01) | VERIFIED | `src/graph/graph-validator.ts:36-52` implements Migration Check with early-return; error message dословно contains `loop-start/loop-end`, `узлом loop`, «выход», and «устаревшие»; `nodeLabel()` at line 245-246 preserves legacy arms so enumeration works; tests `legacy loop-body.canvas returns migration-error` and `legacy loop-start.canvas returns migration-error` at `graph-validator.test.ts:257, 273` verify required literals; D-CL-02 order test (line 288) confirms migration fires BEFORE LOOP-04 «выход» error. |
| 4 | The migration error appears in the existing RunnerView error panel using the same layout used for other `GraphValidator` error classes — not in a Notice or console (MIGRATE-02) | VERIFIED | `src/views/runner-view.ts:96-99` calls `this.renderError(validationErrors)` — same code path as for any other validator error (reachability, cycles, dead-ends); `renderError()` at line 817-830 renders a `<ul class="rp-error-list">` inside `rp-validation-panel` — layout shared across all validator error classes; no branch for migration-specific rendering exists. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/graph/graph-model.ts` | `LoopNode` interface + `'loop'` literal in RPNodeKind + `LoopContext.loopNodeId` | VERIFIED | Lines 9-18 contain `RPNodeKind` with `'loop'`; lines 67-70 define `LoopNode { kind: 'loop'; headerText: string }`; lines 107-116 define `LoopContext.loopNodeId`; legacy `LoopStartNode` / `LoopEndNode` retained with `@deprecated` JSDoc (D-CL-05 variant b). |
| `src/graph/canvas-parser.ts` | `case 'loop'` in parseNode + `'loop'` in validKinds | VERIFIED | Line 18 imports `LoopNode`; line 163 adds `'loop'` to `validKinds`; lines 283-293 implement `case 'loop'` constructing `LoopNode` with `headerText` normalized to `''`; legacy `case 'loop-start'` / `case 'loop-end'` retained (lines 241-262) for migration-error parsing path. |
| `src/graph/graph-validator.ts` | Migration Check + three LOOP-04 sub-checks + updated cycle detection + nodeLabel switch | VERIFIED | Migration Check at lines 36-52 with early-return; LOOP-04 at lines 91-124 with three distinct `errors.push` sites; `detectUnintentionalCycles` at line 196 switched to `kind === 'loop'`; `nodeLabel()` at line 248 has `case 'loop': return node.headerText || node.id`. |
| `src/views/runner-view.ts` | `case 'loop-end'` switch-arm removed; error panel path unchanged | VERIFIED | `case 'loop-end'` deleted (grep: 0 matches); `case 'question'`, `case 'free-text-input'`, `default` preserved; `renderError()` path at line 817 unchanged; `src/styles/loop-support.css` preserved (git diff clean). |
| `src/runner/protocol-runner.ts` | `case 'loop'` soft stub + merged `case 'loop-start'/'loop-end'` legacy stub + `chooseLoopAction` @deprecated stub | VERIFIED | Lines 558-573 contain both cases with `transitionToError`; `chooseLoopAction` at line 297-302 is `@deprecated Phase 43 D-14, D-18` stub; `default` at line 580-586 with `_exhaustive: never` guard. |
| `src/runner/runner-state.ts` | `AtNodeState.loopIterationLabel` + `isAtLoopEnd` marked `@deprecated` | VERIFIED | Lines 24-32 both fields annotated `@deprecated Phase 43 D-14`. |
| `src/sessions/session-model.ts` | `PersistedLoopContext.loopNodeId` (renamed from loopStartId) | VERIFIED | Line 14: `loopNodeId: string`; JSDoc at lines 9-10 documents Phase 43 D-04 / D-13 rename. |
| `src/sessions/session-service.ts` | `validateSessionNodeIds` reads `frame.loopNodeId` | VERIFIED | Lines 137, 138, 145, 146 all read `frame.loopNodeId`; phase-marker comment at line 122. Stale JSDoc at lines 112-113 still says "loopStartIds" (see IN-03 note below). |
| `src/canvas/node-color-map.ts` | `NODE_COLOR_MAP` includes `'loop': '1'` | VERIFIED | Line 21: `'loop': '1'`; legacy keys preserved with `@deprecated` markers (lines 18-19). |
| `src/__tests__/fixtures/unified-loop-valid.canvas` | Happy-path fixture with loop, «выход», body, back-edge | VERIFIED | 5 nodes, 5 edges; `n-loop → n-end` labelled «выход»; `n-loop → n-q1` body; `n-a1 → n-loop` back-edge; `radiprotocol_headerText: "Lesion loop"`. |
| `src/__tests__/fixtures/unified-loop-missing-exit.canvas` | Loop without «выход» edge | VERIFIED | 0 occurrences of «выход»; loop has body-branch and back-edge only. |
| `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` | Loop with ≥2 «выход» edges | VERIFIED | 2 «выход» edges (e3→n-end1, e4→n-end2); one body branch present. |
| `src/__tests__/fixtures/unified-loop-no-body.canvas` | Loop with only «выход», no body | VERIFIED | 1 «выход» edge, no body edges. |
| `src/__tests__/graph-validator.test.ts` | Phase 43 describe block with LOOP-04 + MIGRATE-01 + D-09 tests | VERIFIED | Line 199 opens `describe('GraphValidator — Phase 43: unified loop + migration (LOOP-04, MIGRATE-01)')` with 9 tests; all 20 tests in the file pass. |
| `src/__tests__/session-service.test.ts` | loopStartId renamed to loopNodeId + D-20 graceful-reject test | VERIFIED | 0 occurrences of `loopStartId`; new test `gracefully returns missing legacy loop node ID without throwing (D-20, D-13)` at line 144-163; 18 tests pass. |
| `src/__tests__/runner/protocol-runner.test.ts` | `.skip` on loop-related describe blocks | VERIFIED | `describe.skip('loop-start missing continue edge (RUN-08)')` and `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)')` present; `iteration cap (RUN-09, D-08)` describe still active. |
| `src/__tests__/runner/protocol-runner-session.test.ts` | `.skip` on SESSION-05 loop-context round-trip | VERIFIED | `describe.skip('Loop context stack survives session round-trip (SESSION-05)')` present; three additional `it.skip` markers at lines 50, 66, 88. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `canvas-parser.ts` | `graph-model.ts` | `import type { LoopNode, ... }` | WIRED | Line 18: `LoopNode, // Phase 43 D-05` in import block. |
| `graph-validator.ts` | `graph-model.ts` | `node.kind === 'loop'` narrowing | WIRED | Lines 97, 198, 248 use `node.kind === 'loop'` discriminants. |
| `graph-validator.ts` | RunnerView error panel | `errors[]` return value | WIRED | `runner-view.ts:96-99` calls `this.validator.validate(...)` then `this.renderError(validationErrors)` — MIGRATE-02 satisfied without view-side changes. |
| `node-color-map.ts` | `graph-model.ts` | `Record<RPNodeKind, string>` exhaustiveness | WIRED | TypeScript-enforced; compile green with `'loop'` present and legacy keys retained. |
| `session-service.ts` | `session-model.ts` | `frame.loopNodeId` access | WIRED | Lines 137, 138, 145, 146 read `frame.loopNodeId`; type alignment with `PersistedLoopContext.loopNodeId` at session-model.ts:14. |
| `protocol-runner.ts` | `graph-model.ts` | `LoopContext.loopNodeId` + RPNodeKind exhaustiveness | WIRED | `advanceThrough` switch exhaustive over all RPNodeKinds including merged legacy stub (lines 558-573); inline `LoopContext`-shaped literals in `getSerializableState` / `restoreFrom` use `loopNodeId` (lines 376, 377, 433, 434). |
| `runner-view.ts` | `graph-validator.ts` | `validationErrors` passed to `renderError` | WIRED | Line 98 `this.renderError(validationErrors)` — migration errors flow through the same channel as reachability/cycle errors. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| `LoopNode.headerText` in parser | `node.headerText` | `getString(props, 'radiprotocol_headerText', '')` reads canvas JSON props | Yes — reads actual canvas JSON; empty-string fallback only when field missing | FLOWING |
| Migration error string in RunnerView | `validationErrors` | `GraphValidator.validate(graph).errors[]` populated from Migration Check `errors.push(...)` | Yes — real error string built from real canvas content (legacy node labels via `nodeLabel()`) | FLOWING |
| LOOP-04 error strings | `errors` array | `graph.edges.filter(e => e.fromNodeId === id)` over real parsed edges | Yes — real edges from canvas JSON; real labels compared against `'выход'` | FLOWING |
| Cycle detection marker | `cycleNodes` → `passesViaLoopNode` | Real graph.nodes lookup by kind | Yes — DFS over parsed ProtocolGraph | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript whole-project compile succeeds | `npx tsc --noEmit --skipLibCheck` | exit 0, zero errors | PASS |
| Full test suite passes | `npm test` | 28 test files / 391 passed / 11 skipped / 0 failed | PASS |
| graph-validator tests pass (Phase 43 describe block) | `npx vitest run src/__tests__/graph-validator.test.ts` | 1 file / 20 tests passed | PASS |
| session-service tests pass (D-20 graceful-reject + loopNodeId rename) | `npx vitest run src/__tests__/session-service.test.ts` | 1 file / 18 tests passed | PASS |
| Fixtures parse as valid JSON | `node -e "JSON.parse(fs.readFileSync(...))"` × 4 | All 4 unified-loop fixtures parse | PASS |
| Migration-error contains required literals | Source inspection of `graph-validator.ts:47-49` | String contains `loop-start`, `loop-end`, `loop`, `«выход»`, and `устаревшие` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOOP-01 | 43-01, 43-02, 43-03, 43-04 | Graph model exposes a single `loop` node kind | SATISFIED | `RPNodeKind` includes `'loop'`; `LoopNode` interface in place; all consumers (parser, validator, color map, session, runner) wired. **Note:** REQUIREMENTS.md literally says "`loop-start` and `loop-end` are removed from the `RPNodeKind` discriminated union" but Plan 01 D-CL-05 variant (b) retained them with `@deprecated` JSDoc so the validator can enumerate legacy nodes for MIGRATE-01. REQUIREMENTS.md nevertheless marks LOOP-01 as `[x]` complete; the operative phase goal (graph model speaks the unified `loop` node; legacy canvases rejected) is fully satisfied. Final removal is tracked for Phase 46/CLEAN-*. |
| LOOP-02 | 43-01, 43-02 | `LoopNode` carries editable `headerText` | SATISFIED | `LoopNode { headerText: string }`; parser reads `radiprotocol_headerText`. Runtime prompt header rendering is Phase 44 scope (RUN-01). |
| LOOP-03 | 43-02, 43-06 | Parser materializes `LoopNode` with `headerText` | SATISFIED | `case 'loop'` in parser; 4 fixtures; test `unified-loop-valid.canvas passes LOOP-04 checks` exercises end-to-end. |
| LOOP-04 | 43-05, 43-06, 43-07 | Validator requires exactly one «выход» edge + ≥1 body edge | SATISFIED | Three sub-checks (D-08.1/2/3) implemented; four fixtures + nine Phase 43 tests validate contract. |
| MIGRATE-01 | 43-05, 43-07 | Canvas with `loop-start`/`loop-end` fails with rebuild guidance | SATISFIED | Migration Check with early-return + Russian message containing all required literals; two migration tests against legacy fixtures; D-CL-02 order test proves migration fires before LOOP-04. |
| MIGRATE-02 | 43-05 | Migration error surfaces in RunnerView panel using same layout as other validator errors | SATISFIED | `renderError(validationErrors)` is the shared code path; no separate rendering branch exists; Notice/console not used for validator errors. |

All six Phase 43 requirement IDs from the PLAN frontmatters (43-01 through 43-07) are accounted for and each is satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/sessions/session-service.ts` | 112-113 | Stale JSDoc: "all loopStartIds in undoStack loopContextStacks, and all loopStartIds in the top-level loopContextStack" | Info | Documentation drift — function body correctly reads `frame.loopNodeId`, but JSDoc still names the old field. Low risk; 43-REVIEW.md WR-03 flagged this for the developer. |
| `src/__tests__/runner/protocol-runner-session.test.ts` | 110-127, 129-146, 152-179 | Three tests call `loadGraph('loop-body.canvas')` + `runner.start(graph)` then rely on `if (savedState === null) return;` to pass vacuously after the legacy-loop stub kicks in | Warning | Test effectiveness: the tests now always pass without exercising the intended SESSION-05 / round-trip behaviour. 43-REVIEW.md WR-01 recommended marking them `.skip` (consistent with nearby tests at lines 50, 66, 88 which ARE `.skip`'d) or changing the guard to `expect(savedState).not.toBeNull();`. Does not block Phase 43 goal — the broken runtime path is intentional (Phase 44 scope). |
| `src/runner/protocol-runner.ts` | 598-607 | Private `edgeByLabel()` helper has no remaining call-sites after Plan 04 removed legacy loop-start runtime | Info | Dead code. 43-REVIEW.md WR-02 recommended deletion or JSDoc refresh. Kept intentionally for Phase 44 reuse per plan notes. |
| `src/runner/protocol-runner.ts` | ~315 | `const loopIterationLabel: string | undefined = undefined;` is a dead local that only feeds the returned object | Info | 43-REVIEW.md IN-01 — minor polish. |
| `src/graph/graph-validator.ts` | 104-122 | LOOP-04 error messages are English prefix (`Loop node "..."`) + Russian body | Info | Mixed-language; grep-ability vs consistency trade-off. Documented in 43-REVIEW.md IN-03. |

None of the above is a blocker. All are tracked in the standalone code review (`43-REVIEW.md`) with explicit non-blocker status (`critical: 0`).

### Human Verification Required

None. All four Phase 43 Success Criteria are verifiable programmatically through source inspection + fixture-driven validator tests + the shared `renderError` code path. No visual / interactive / real-time behaviour is in scope for this phase (runtime picker UI is Phase 44 / RUN-01).

### Gaps Summary

No gaps. All four Success Criteria are satisfied end-to-end: the graph model and parser speak the unified `loop` node (SC 1); the validator enforces the «выход» / body-branch contract with clear Russian error text (SC 2); legacy canvases are rejected with a plain-language migration instruction naming `loop-start`/`loop-end`/`loop`/«выход» and recommending the unified node (SC 3); and the migration error rides the existing `renderError` path in RunnerView — same layout used for reachability/cycle/dead-end errors — not a Notice or console output (SC 4). Whole-project TypeScript compile is clean and `npm test` reports 391 passed / 11 skipped / 0 failed across 28 test files.

Three tracked-but-non-blocking issues from the standalone 43-REVIEW.md remain for the developer to address separately: (WR-01) three SESSION-05 / round-trip tests in `protocol-runner-session.test.ts` pass vacuously via an early `return` when the legacy-loop-body fixture puts the runner into error state — adding `.skip` with a Phase 44 TODO marker is recommended for consistency with the other loop-runtime tests; (WR-02) dead `private edgeByLabel()` helper in `protocol-runner.ts` retained for possible Phase 44 reuse; (WR-03) stale JSDoc in `validateSessionNodeIds` still references the old `loopStartId` field name while the body correctly uses `loopNodeId`. None of these affect the Phase 43 goal, which concerns the graph model, parser, validator, and RunnerView error-panel wiring for unified-loop adoption and legacy rejection.

---

_Verified: 2026-04-17T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
