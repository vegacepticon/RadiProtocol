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
