---
phase: 53-runner-skip-close-buttons
plan: 01
subsystem: runner
tags: [runner, state-machine, undo-stack, tdd]
requires:
  - phase-44-loop-runtime
  - phase-50.1-plus-prefix-exit
provides:
  - protocol-runner-skip-method
  - runner-requirement-ids
affects:
  - src/runner/protocol-runner.ts
  - src/__tests__/runner/protocol-runner-skip.test.ts
  - .planning/REQUIREMENTS.md
tech-stack:
  added: []
  patterns:
    - "Undo-before-mutate (Pitfall 3)"
    - "First-answer-neighbor walk (mirrors chooseAnswer)"
    - "Capture-before-advance (BUG-01 at caller)"
key-files:
  created:
    - src/__tests__/runner/protocol-runner-skip.test.ts
  modified:
    - src/runner/protocol-runner.ts
    - .planning/REQUIREMENTS.md
decisions:
  - "skip() is placed immediately after chooseAnswer() (line 112+) as its semantic Skip-analog"
  - "Skip reuses advanceOrReturnToLoop() for dead-end / loop-return semantics — same contract as chooseAnswer"
  - "Zero-answer no-op is enforced at the runner layer (defence in depth) in addition to UI-level button hiding planned for 53-02"
  - "UndoEntry carries plain snapshot (no returnToBranchList flag) — stepBack restores question at at-node with empty answer list re-rendered"
metrics:
  completed: 2026-04-20
  duration_minutes: "~10"
  tasks: 2
  commits: 3
  test_delta: "642 → 648 (+6)"
---

# Phase 53 Plan 01: Skip Method & Requirement IDs Summary

Introduced the pure state-machine `ProtocolRunner.skip()` method and registered
the 6 Phase-53 requirement IDs (`RUNNER-SKIP-01..03`, `RUNNER-CLOSE-01..03`) in
REQUIREMENTS.md, while reassigning BRAT-01 from Phase 53 → Phase 55 per the
current ROADMAP. This is the engine-layer foundation Plan 53-02 (Skip UI) and
Plan 53-03 (Close UI) will build on.

## What shipped

### 1. REQUIREMENTS.md additions (Task 1 — commit `f832ddd`)

- New `### Runner Skip & Close (RUNNER)` subsection inserted between
  `### JSON Snippet Placeholders (PHLD)` and `### Distribution (BRAT)`.
- 6 new requirement bullets (source + signal annotated):
  - **RUNNER-SKIP-01** — Skip icon-button render preconditions (D-01/D-04/D-05/D-07/D-08)
  - **RUNNER-SKIP-02** — 5-step click handler + no-accumulator-append invariant (D-08/D-09/D-11)
  - **RUNNER-SKIP-03** — Recordable step (UndoEntry push) + stepBack roundtrip (D-10)
  - **RUNNER-CLOSE-01** — Close icon-button render conditions (D-02/D-04/D-05/D-06/D-12)
  - **RUNNER-CLOSE-02** — 4-status confirmation predicate reuse (D-13/D-15)
  - **RUNNER-CLOSE-03** — 5-step teardown order (D-14/D-16)
- 6 new Traceability rows + BRAT-01 row phase flipped from Phase 53 → Phase 55.
- Zero deletions anywhere else — PHLD-01, EDGE-03, PICKER-*, etc. rows all
  byte-identical (CLAUDE.md append-only compliance).

### 2. `ProtocolRunner.skip()` method (Task 2 GREEN — commit `2ceae8d`)

Method inserted at `src/runner/protocol-runner.ts:112-156` (44 lines), immediately
after the closing brace of `chooseAnswer()` (pre-edit line 111). Five clauses:

1. **Status guard (D-07):** `if (this.runnerStatus !== 'at-node') return;`
2. **Graph/cursor guard:** `if (this.graph === null || this.currentNodeId === null) return;`
3. **Kind guard (D-07):** `if (currentNode.kind !== 'question') return;`
4. **Target resolution (D-08/D-09):** iterate `adjacency.get(currentNodeId)` picking the
   FIRST `kind === 'answer'` neighbor; snippet / text-block neighbors ignored.
   Zero-answer case returns before any mutation (defence in depth — UI gate planned
   in Plan 53-02 via RUNNER-SKIP-01 button-render gate).
5. **Undo push + advance (D-10 + D-08):** push `UndoEntry { nodeId, textSnapshot,
   loopContextStack }` BEFORE any mutation (Pitfall 3), then walk via
   `advanceThrough(answer-first-neighbor)` or `advanceOrReturnToLoop(undefined)`
   on answer dead-end — the accumulator is NEVER touched (the Skip invariant).

JSDoc explicitly names BUG-01 / D-11 as enforced at the caller (RunnerView click
handler) via `syncManualEdit()` before invoking `skip()`.

Pre-existing methods (`chooseAnswer`, `chooseSnippetBranch`, `chooseLoopBranch`,
`stepBack`, `pickSnippet`, `completeSnippet`, `syncManualEdit`, `getState`,
`getSerializableState`, `setGraph`, `restoreFrom`, all private helpers) are all
byte-identical — grep-confirmed 1/1/1 on the acceptance strings.

### 3. `protocol-runner-skip.test.ts` (Task 2 RED — commit `8aa912f`)

New test file, 291 lines, 6 tests across 1 describe block. Inline
`makeQuestionGraph()` factory mirrors the `makeLoopGraph()` pattern in
`protocol-runner-loop-picker.test.ts` — all 6 required `ProtocolGraph` fields
populated (`canvasFilePath`, `nodes`, `edges: []`, `adjacency`,
`reverseAdjacency`, `startNodeId`). Six tests:

| # | Contract | Coverage |
|---|----------|----------|
| 1 | D-07 status guard | `skip()` while `idle` is a full no-op; `getSerializableState()` stays `null` |
| 2 | D-07 kind guard | `skip()` at `awaiting-snippet-pick` is a no-op (status guard trips first; kind guard is the defence in depth under it) |
| 3 | D-08 happy path | Two-answer question — `skip()` advances past answer-0, accumulator does NOT contain `'A0'`, step-back restores pre-skip snapshot |
| 4 | D-09 snippet-ignore | `[snippet-0, answer-1]` adjacency order — `skip()` targets `answer-1`, NOT `snippet-0`; accumulator does NOT contain `'A1'`; runner does NOT enter `awaiting-snippet-pick` |
| 5 | Zero-answer no-op | `[snippet-0, snippet-1]` adjacency — `skip()` returns before undo push; `currentNodeId` + accumulator + `undoStack.length` all byte-identical |
| 6 | D-10 step-back roundtrip | Single-answer question — `skip()` → `stepBack()` restores `currentNodeId=q1`, `status=at-node`, accumulator = pre-skip snapshot |

RED proof: all 6 failed with `TypeError: runner.skip is not a function` before
the Task 2 GREEN commit landed (screenshot-equivalent captured in session log).

## Test baseline delta

- **Pre-plan:** 642 passed / 1 skipped / 0 failed (47 test files, Phase 52 baseline).
- **Post-plan:** 648 passed / 1 skipped / 0 failed (48 test files).
- **Delta:** +6 greens (all new), zero regressions, zero skipped changes.

`npx tsc --noEmit --skipLibCheck` exit 0 at HEAD `2ceae8d`.

## TDD gate sequence (for auditors)

1. **RED** — `8aa912f` `test(53-01): RED — skip() method 6 failing specs`
2. **GREEN** — `2ceae8d` `feat(53-01): GREEN — skip() method on ProtocolRunner`
3. No REFACTOR commit needed — implementation is minimal-correct and matches
   CONTEXT.md / PATTERNS.md guidance verbatim.

Ordering invariant satisfied: RED precedes GREEN in `git log --oneline`.

## Deviations from Plan

None — both tasks executed exactly as the `<action>` blocks specified.

- Rule 1 (bug fix): not triggered.
- Rule 2 (missing critical functionality): not triggered.
- Rule 3 (blocking issue): not triggered.
- Rule 4 (architectural): not triggered.

One documentation-level note worth flagging for Plan 02: Test 2 documents that
the D-07 kind-guard is in practice dominated by the status guard (there is no
public-API path to reach `at-node` at a non-question node in the current
runner). Plan 53-02 button-render gate (`RUNNER-SKIP-01`) is thus the primary
user-facing enforcement of "Skip is question-only"; the kind-guard on the
runner is defence-in-depth.

## Commits landed

| Commit | Message |
|--------|---------|
| `f832ddd` | `docs(53-01): add 6 RUNNER-* requirements + reassign BRAT-01 to Phase 55` |
| `8aa912f` | `test(53-01): RED — skip() method 6 failing specs` |
| `2ceae8d` | `feat(53-01): GREEN — skip() method on ProtocolRunner` |

## Known Stubs

None — plan delivers a complete engine-layer contract. UI-layer surfaces
(`rp-skip-btn`, `rp-close-btn`, `handleClose()`) are deferred to Plans 53-02 /
53-03 as tracked in the phase plan and REQUIREMENTS.md.

## Self-Check: PASSED

- Files claimed created — `src/__tests__/runner/protocol-runner-skip.test.ts`: FOUND
- Files claimed modified — `src/runner/protocol-runner.ts`: contains `skip(): void`
- Files claimed modified — `.planning/REQUIREMENTS.md`: contains 6 RUNNER-* IDs + BRAT-01→Phase 55
- Commits claimed:
  - `f832ddd`: FOUND in git log
  - `8aa912f`: FOUND in git log (RED precedes GREEN)
  - `2ceae8d`: FOUND in git log
- Test delta 642 → 648: confirmed by vitest output
- tsc exit 0: confirmed
