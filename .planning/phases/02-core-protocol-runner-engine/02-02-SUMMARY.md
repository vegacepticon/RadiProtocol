---
phase: "02"
plan: "02"
subsystem: runner
tags: [protocol-runner, state-machine, tdd, pure-typescript, undo-stack]
dependency_graph:
  requires:
    - "02-01 (runner-state.ts — RunnerState, UndoEntry; text-accumulator.ts — TextAccumulator)"
    - "01-03 (canvas-parser — CanvasParser used in test helpers)"
    - "01-04 (graph-validator — ProtocolGraph type from graph-model.ts)"
  provides:
    - "ProtocolRunner class — full state machine traversal engine"
    - "ProtocolRunnerOptions interface — maxIterations option"
  affects:
    - "Phase 3 UI (calls start/chooseAnswer/enterFreeText/stepBack/completeSnippet/getState)"
    - "Phase 5 (calls completeSnippet after snippet modal)"
    - "Phase 6 (replaces loop-start/loop-end stubs in advanceThrough)"
tech_stack:
  added: []
  patterns:
    - "Discriminated union state machine: runnerStatus field drives all getState() return shapes"
    - "UndoEntry pushed before mutation — snapshot-before-write guarantees correct revert"
    - "advanceThrough() loop: pure auto-advance with iteration cap; never pushes UndoEntry"
    - "completeSnippet() advances from snippetNodeId not currentNodeId (different nodes)"
key_files:
  created: []
  modified:
    - src/runner/protocol-runner.ts
decisions:
  - "advanceThrough() handles answer nodes as pass-through (append + follow edge) — enables answer→text-block→question chains"
  - "stepBack() resets runnerStatus to at-node unconditionally — stepBack from complete/error both restore correctly"
  - "completeSnippet() saves snippetNodeId before clearing it, then advances from saved value"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-06"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  tests_green: 24
---

# Phase 02 Plan 02: ProtocolRunner Full State Machine Summary

**One-liner:** ProtocolRunner state machine with advanceThrough() loop, snapshot-before-write undo stack, iteration cap guard, and awaiting-snippet-fill state — all 24 runner tests GREEN.

## What Was Built

**`src/runner/protocol-runner.ts`** — The complete traversal engine for RadiProtocol sessions. Implements the locked public API (D-01/D-02):

- `start(graph)` — resets all state, auto-advances from start node via `advanceThrough()`
- `chooseAnswer(answerId)` — validates answer node, pushes UndoEntry before mutation, appends answerText, advances
- `enterFreeText(text)` — validates free-text-input node, pushes UndoEntry before mutation, wraps with prefix/suffix, advances
- `stepBack()` — pops UndoEntry, restores nodeId and text buffer, resets status to at-node
- `completeSnippet(renderedText)` — appends rendered text, advances from snippetNodeId
- `getState()` — returns typed discriminated union snapshot; no internal state exposed

**Key internal design:**

- `advanceThrough(nodeId)` — while-loop processes start/text-block/answer nodes automatically; halts at question/free-text-input; transitions to error on loop-start/loop-end or iteration cap exceeded
- Iteration cap: `steps > maxIterations` (not `>=`) — with maxIterations=3 and 5 text-blocks, cap is hit at step 4
- `UndoEntry` pushed as the FIRST operation inside `chooseAnswer()` and `enterFreeText()` — before any `accumulator.append()` call
- Zero Obsidian API imports — fully unit-testable in pure Node.js via Vitest

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| text-accumulator.test.ts | 6/6 | GREEN |
| protocol-runner.test.ts | 18/18 | GREEN |
| **Runner total** | **24/24** | **GREEN** |
| canvas-parser.test.ts | 8/8 | GREEN (no regression) |
| graph-validator.test.ts | 6/6 | GREEN (no regression) |
| **Full suite** | **38/38** | **GREEN** |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| f4fcf52 | Task 1 | feat(02-02): implement ProtocolRunner full state machine traversal engine |

## Acceptance Criteria Verification

- [x] `npx vitest run src/__tests__/runner/` exits 0 — 24 passed
- [x] `npx vitest run` exits 0 — 38/38 passed (full suite)
- [x] `grep -n "from 'obsidian'" src/runner/protocol-runner.ts` — no output
- [x] `export class ProtocolRunner` present
- [x] `export interface ProtocolRunnerOptions` present
- [x] `completeSnippet(renderedText: string)` present (D-07 coverage)
- [x] Exact string `Loop nodes are not yet supported — upgrade to Phase 6` present (D-05)
- [x] `maxIterations` appears 5 times (field, constructor, guard, error message, default comment)
- [x] `npx tsc --noEmit --skipLibCheck` exits 0 — zero TypeScript errors

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The loop-start/loop-end error path is an intentional Phase 2 placeholder (D-05), documented in the code with a comment: `// D-05: Phase 2 stub — this exact block is replaced in Phase 6`. This is not a stub that prevents the plan's goal — it is the specified behavior for Phase 2.

## Threat Surface

All mitigations from the threat model are implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-02-01 | Iteration cap via `steps > maxIterations` → error state | Implemented |
| T-02-02-02 | answerId validated against `graph.nodes.get(answerId)` with kind check | Implemented |
| T-02-02-03 | Unbounded free-text length — accepted (single-user local vault) | N/A |
| T-02-02-04 | accumulatedText exposure — accepted (user's own report text) | N/A |
| T-02-02-05 | completeSnippet arbitrary text — accepted (trusted modal in Phase 5) | N/A |
| T-02-02-06 | Read-only graph access — accepted (no write-back) | N/A |

No new security-relevant surface introduced beyond what the threat model covers.

## Phase 3 Readiness

Phase 3 (UI) can integrate immediately:
- Call `runner.start(graph)` to begin a session
- Narrow state with `switch(state.status)` or `if (state.status !== 'at-node') return`
- Call `chooseAnswer(nodeId)` / `enterFreeText(text)` for user actions
- Call `stepBack()` for undo button
- Call `completeSnippet(renderedText)` from snippet modal (Phase 5)
- Runner internals are fully encapsulated — no field access needed

---
*Phase: 02-core-protocol-runner-engine*
*Completed: 2026-04-06*

## Self-Check: PASSED

- [x] `src/runner/protocol-runner.ts` exists with 326 lines
- [x] Commit f4fcf52 exists
- [x] `npx vitest run` → 38 passed
- [x] `npx tsc --noEmit --skipLibCheck` → no errors
- [x] No Obsidian imports in protocol-runner.ts
- [x] `export class ProtocolRunner` — confirmed
- [x] `export interface ProtocolRunnerOptions` — confirmed
- [x] `Loop nodes are not yet supported — upgrade to Phase 6` — confirmed
- [x] `maxIterations` — 5 occurrences confirmed
