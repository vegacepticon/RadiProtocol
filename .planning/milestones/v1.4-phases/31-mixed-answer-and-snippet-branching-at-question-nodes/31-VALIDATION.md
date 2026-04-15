---
phase: 31
slug: mixed-answer-and-snippet-branching-at-question-nodes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 31 — Validation Strategy

> Per-phase validation contract. Tests live alongside source under `src/__tests__/`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/__tests__/runner/protocol-runner.test.ts src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds full, ~3 seconds quick |

---

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** full suite command
- **Before `/gsd-verify-work`:** full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

Filled by planner. Each task touching state machine, validator, parser, or accumulator must reference at least one test file under `src/__tests__/` and supply a grep-verifiable acceptance criterion.

---

## Wave 0 Requirements

Existing test files cover all affected modules; no new test scaffolding required:

- [x] `src/__tests__/runner/protocol-runner.test.ts` — runner state machine tests
- [x] `src/__tests__/runner/protocol-runner-session.test.ts` — session resume tests
- [x] `src/__tests__/canvas-parser.test.ts` — parser tests
- [x] `src/__tests__/graph-validator.test.ts` — validator tests

---

## Coverage Targets

- Mixed branching state machine: cover `chooseSnippetBranch`, transition into `awaiting-snippet-pick`, `currentNodeId` correctness
- Step-back from branch-entered picker: pre/post state assertions, undoStack `returnToBranchList` flag
- Per-node separator: assert `completeSnippet` honors snippet-node `snippetSeparator`, falls back to global setting
- Validator: positive tests for question→snippet edges and snippet-only question branches
- Parser: round-trip `radiprotocol_snippetLabel` and `radiprotocol_snippetSeparator`
- Session resume: round-trip undoStack with `returnToBranchList` flag set

---

## Nyquist Exceptions (view-form tasks)

Some tasks in this phase modify Node Editor form code (`src/views/editor-panel-view.ts`) — pure UI wiring of Setting controls into `pendingEdits` + `scheduleAutoSave`. These tasks have **no unit-test harness** for `editor-panel-view` in the current repo (grep: no `editor-panel-view.test.ts` exists), and the behavior is trivially observable via UAT (open Node Editor, change field, confirm autoSave fires and value round-trips through parser).

**Accepted exceptions** (build-only automated verify, UAT-validated behavior):

| Plan | Task | Rationale |
|------|------|-----------|
| 31-02 | Task 1 (Add `snippetLabel` + `snippetSeparator` controls to snippet form) | Pure view-form wiring. No existing test harness for `editor-panel-view.ts`. Automated verify is `npm run build` — TS strict mode catches interface mismatches against the `SnippetNode` fields added in Plan 01 (this is why Plan 02 was bumped to wave 2, depends_on `31-01`). Behavioral verification happens in Phase UAT: open snippet node → edit Branch label → reopen canvas → value persists via parser round-trip. |

For all OTHER tasks in this phase (state machine, parser, validator, session), Nyquist compliance is enforced: each must include an `<automated>` test command referencing a file under `src/__tests__/`.
