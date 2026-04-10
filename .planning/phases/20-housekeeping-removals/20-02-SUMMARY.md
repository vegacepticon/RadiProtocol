---
phase: 20-housekeeping-removals
plan: "02"
subsystem: engine
tags: [housekeeping, type-removal, dead-code, canvas-parser, protocol-runner]
dependency_graph:
  requires: ["20-01"]
  provides: ["clean-engine-layer"]
  affects: ["20-03"]
tech_stack:
  added: []
  patterns: ["DEPRECATED_KINDS silent-skip pattern for canvas parser"]
key_files:
  created: []
  modified:
    - src/graph/graph-model.ts
    - src/runner/runner-state.ts
    - src/sessions/session-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/runner/protocol-runner.ts
    - src/__tests__/runner/protocol-runner-session.test.ts
    - src/__tests__/session-service.test.ts
decisions:
  - "DEPRECATED_KINDS as module-scope Set constant for O(1) silent-skip in canvas-parser.ts"
  - "PersistedSession.runnerStatus narrowed to literal 'at-node' — no union needed"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  files_modified: 8
---

# Phase 20 Plan 02: Engine Layer Dead-Code Removal Summary

**One-liner:** Removed `free-text-input` node type and `awaiting-snippet-fill` runner state from all pure engine files — graph-model, runner-state, session-model, canvas-parser, graph-validator, protocol-runner — via DEPRECATED_KINDS silent-skip pattern and exhaustive TypeScript narrowing.

## Objective Achieved

All NTYPE-01 through NTYPE-04 requirements addressed at the TypeScript engine layer:
- `RPNodeKind` no longer contains `'free-text-input'`
- `FreeTextInputNode` interface deleted from graph-model.ts
- `TextBlockNode.snippetId` field removed
- `RunnerStatus` no longer contains `'awaiting-snippet-fill'`
- `AwaitingSnippetFillState` interface deleted from runner-state.ts
- `PersistedSession.runnerStatus` narrowed to `'at-node'` literal only
- `PersistedSession.snippetId` and `snippetNodeId` fields deleted
- `DEPRECATED_KINDS` constant added to canvas-parser.ts — silent-skip pattern for legacy nodes
- `enterFreeText()` and `completeSnippet()` methods deleted from protocol-runner.ts
- `getSerializableState()` and `restoreFrom()` signatures updated to match new shape

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Purge free-text-input from type model files | a633de8 | graph-model.ts, runner-state.ts, session-model.ts |
| 2 | Update canvas-parser, graph-validator, protocol-runner | 9861db2 | canvas-parser.ts, graph-validator.ts, protocol-runner.ts, test files |

## Test Results

```
npm test -- canvas-parser protocol-runner graph-validator
Test Files  4 passed (4)
     Tests  56 passed (56)
```

All canvas-parser tests (including NTYPE-01/NTYPE-02 DEPRECATED_KINDS tests from Plan 01) GREEN.
All protocol-runner tests (including NTYPE-03/NTYPE-04 tests from Plan 01) GREEN.
All graph-validator tests GREEN.

## TypeScript Verification

```
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "runner-view\|editor-panel\|node_modules"
```
Zero errors. Remaining errors are only in `runner-view.ts` and `editor-panel-view.ts` — expected, handled in Plan 03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale snippetId/snippetNodeId fields in session-service.test.ts fixture**
- **Found during:** Task 2
- **Issue:** `makeSession()` helper in session-service.test.ts included `snippetId: null` and `snippetNodeId: null` fields that no longer exist in `PersistedSession`
- **Fix:** Removed those two fields from the `makeSession()` fixture helper
- **Files modified:** `src/__tests__/session-service.test.ts`
- **Commit:** 9861db2

**2. [Rule 1 - Bug] Fixed stale snippetId assertion in protocol-runner-session.test.ts**
- **Found during:** Task 2 (test run)
- **Issue:** Test at line 74 asserted `'snippetId' in serialized` was `true` — now correctly asserts `false` post-removal (NTYPE-04)
- **Fix:** Updated assertion to verify snippetId/snippetNodeId are NOT in serialized state
- **Files modified:** `src/__tests__/runner/protocol-runner-session.test.ts`
- **Commit:** 9861db2

## Known Stubs

None — all engine code is complete and wired to actual data sources.

## Threat Flags

No new security-relevant surface introduced. The DEPRECATED_KINDS set is a module-scope constant (T-20-02-01: accepted). Removing `enterFreeText()` and `completeSnippet()` reduces API surface (T-20-02-03: accepted).

## Self-Check: PASSED

All files confirmed present on disk. Both task commits confirmed in git log.
- FOUND: src/graph/graph-model.ts
- FOUND: src/runner/runner-state.ts
- FOUND: src/sessions/session-model.ts
- FOUND: src/graph/canvas-parser.ts
- FOUND: src/graph/graph-validator.ts
- FOUND: src/runner/protocol-runner.ts
- FOUND commit: a633de8 (Task 1)
- FOUND commit: 9861db2 (Task 2)
