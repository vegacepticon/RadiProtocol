---
phase: 07-mid-session-save-and-resume
plan: "00"
subsystem: session-persistence
tags: [tdd, red-tests, session, vitest]
dependency_graph:
  requires: []
  provides:
    - RED test contracts for SessionService (SESSION-01 to SESSION-07)
    - RED test contracts for ProtocolRunner session methods (getSerializableState, restoreFrom, setGraph)
    - PersistedSession type stub (session-model.ts)
  affects:
    - src/sessions/session-service.ts (Wave 1 must make tests GREEN)
    - src/runner/protocol-runner.ts (Wave 1 must add getSerializableState/restoreFrom/setGraph)
tech_stack:
  added: []
  patterns:
    - TDD RED phase — tests written before implementation
    - Vault mock factory pattern (mirrors snippet-service.test.ts)
    - loadGraph fixture helper (mirrors protocol-runner.test.ts)
key_files:
  created:
    - src/__tests__/session-service.test.ts
    - src/__tests__/runner/protocol-runner-session.test.ts
    - src/sessions/session-model.ts
  modified: []
decisions:
  - Created session-model.ts as a stub module so test imports resolve without compilation errors; PersistedSession type fully defined to enable typed test fixtures
  - SESSION-04 (mtime comparison) and SESSION-07 (JSON round-trip audit) tests pass immediately — they are pure arithmetic/data tests that require no implementation
metrics:
  duration: "~8 minutes"
  completed: "2026-04-07T06:52:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 7 Plan 00: Wave 0 RED Test Stubs Summary

**One-liner:** Vitest RED test contracts for SessionService and ProtocolRunner session persistence — 27 tests covering SESSION-01 through SESSION-07 before any implementation begins.

## What Was Built

Two test files define the behavioral contracts for Phase 7's mid-session save/resume feature:

1. **`src/__tests__/session-service.test.ts`** — 18 tests covering:
   - SESSION-01: SessionService API surface (save/load/clear/hasSession methods exist)
   - SESSION-01: save() write behavior (vault.create vs vault.adapter.write)
   - SESSION-02: hasSession() returns correct boolean based on vault.adapter.exists
   - SESSION-03: validateSessionNodeIds() — pure function that returns missing node IDs
   - SESSION-04: mtime comparison logic (pure arithmetic — passes immediately)
   - SESSION-06: load() graceful degradation (null on corrupt JSON, missing file, missing version)
   - SESSION-07: PersistedSession JSON round-trip audit (no Set objects, arrays survive)

2. **`src/__tests__/runner/protocol-runner-session.test.ts`** — 9 tests covering:
   - getSerializableState() returns null in idle/complete states, non-null at 'at-node'
   - All required fields present in serialized state
   - restoreFrom() restores currentNodeId, accumulatedText, and canStepBack
   - Full JSON round-trip: getSerializableState → JSON.stringify → JSON.parse → restoreFrom → identical getState()
   - Loop context stack survives round-trip and restoreFrom() correctly reflects loopIterationLabel

3. **`src/sessions/session-model.ts`** — Type stub with `PersistedSession` interface (enables typed test fixtures without breaking imports).

## Test Results (RED State Confirmed)

```
session-service.test.ts:           15 failed | 3 passed (18 total)
protocol-runner-session.test.ts:    9 failed | 0 passed  (9 total)
```

All failures are `TypeError: svc.X is not a function` or `expected 'undefined' to be 'function'` — NOT `Cannot find module` or compilation errors. This is correct RED state: modules import cleanly, types resolve, but method implementations are absent.

The 3 passing tests in session-service.test.ts are pure arithmetic/data tests (SESSION-04 mtime comparison, SESSION-07 serialization audit) that correctly pass without any implementation.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED stubs for SessionService | 5fe2709 | src/__tests__/session-service.test.ts, src/sessions/session-model.ts |
| 2 | RED stubs for ProtocolRunner session methods | 77dd8f7 | src/__tests__/runner/protocol-runner-session.test.ts |

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Created session-model.ts stub**
- **Found during:** Task 1
- **Issue:** Test imports `PersistedSession` from `src/sessions/session-model.ts` but this file did not exist; without it, the test would fail with "Cannot find module" (compilation error, not RED state)
- **Fix:** Created `session-model.ts` with the full `PersistedSession` interface as a type-only stub — no class methods, no runtime code
- **Files modified:** src/sessions/session-model.ts (created)
- **Commit:** 5fe2709

## Known Stubs

- `src/sessions/session-service.ts` — empty class body; Wave 1 (07-01) implements all methods
- `src/sessions/session-model.ts` — type definitions only; used as-is in Wave 1 implementation
- `src/runner/protocol-runner.ts` — missing `getSerializableState()`, `restoreFrom()`, `setGraph()`; Wave 1 adds these

## Threat Flags

None — this plan creates test files only. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced.

## Self-Check: PASSED

Files exist:
- src/__tests__/session-service.test.ts: FOUND
- src/__tests__/runner/protocol-runner-session.test.ts: FOUND
- src/sessions/session-model.ts: FOUND

Commits exist:
- 5fe2709: FOUND
- 77dd8f7: FOUND
