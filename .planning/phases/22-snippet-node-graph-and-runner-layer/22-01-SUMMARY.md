---
phase: 22-snippet-node-graph-and-runner-layer
plan: "01"
subsystem: graph-model, canvas-parser, runner-state, protocol-runner, session-model
tags: [dead-code-removal, regression-fix, wave-0-gate]
dependency_graph:
  requires: []
  provides: [clean-RPNodeKind-without-free-text-input, DEPRECATED_KINDS-silent-skip, clean-RunnerState-without-awaiting-snippet-fill]
  affects: [22-02-PLAN, 22-03-PLAN]
tech_stack:
  added: []
  patterns: [DEPRECATED_KINDS-set-pattern, silent-skip-guard]
key_files:
  created: []
  modified:
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/runner/runner-state.ts
    - src/runner/protocol-runner.ts
    - src/sessions/session-model.ts
    - src/__tests__/canvas-parser.test.ts
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/runner/protocol-runner-session.test.ts
decisions:
  - "DEPRECATED_KINDS set in canvas-parser.ts silently skips free-text-input nodes — consistent with NTYPE-01/NTYPE-02 pattern for future deprecated kinds"
  - "snippetId removed from TextBlockNode — old Phase 5 mechanism fully excised; snippet integration will be redesigned in Wave 1"
  - "6 dead-code tests removed (enterFreeText x2, awaiting-snippet-fill x2, D-02, D-03); 1 new DEPRECATED_KINDS test added"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-11T09:44:10Z"
  tasks_completed: 2
  files_modified: 9
---

# Phase 22 Plan 01: Dead Code Removal (D-08 Regression) Summary

Restored Phase 20 changes lost during Phase 21 merge. Removed all dead code related to `free-text-input` node kind, `awaiting-snippet-fill` runner status, and the old Phase 5 snippet fill mechanism from six production files and three test files.

## One-liner

Excised free-text-input/awaiting-snippet-fill/enterFreeText/completeSnippet dead code from graph-model, canvas-parser, runner-state, protocol-runner, and session-model; added DEPRECATED_KINDS silent-skip guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove dead code from production files | c23a2b1 | graph-model.ts, canvas-parser.ts, graph-validator.ts, runner-state.ts, protocol-runner.ts, session-model.ts |
| 2 | Update tests for cleaned-up API | ea65b63 | canvas-parser.test.ts, protocol-runner.test.ts, protocol-runner-session.test.ts |

## Verification Results

- `npx vitest run`: 133 passed, 3 failed (pre-existing RED stubs in runner-extensions.test.ts labeled "RED until Plan 02")
- `grep "awaiting-snippet-fill" src/graph/ src/runner/ src/sessions/ src/__tests__/runner/`: empty
- `grep "enterFreeText\|completeSnippet" src/graph/ src/runner/ src/sessions/`: empty (JSDoc refs cleaned)
- `grep "free-text-input" src/graph/graph-model.ts`: empty
- `grep "DEPRECATED_KINDS" src/graph/canvas-parser.ts`: present with `new Set<string>(['free-text-input'])` and silent-skip guard
- `grep "free-text-input" src/graph/graph-validator.ts`: empty
- `grep "runnerStatus" src/sessions/session-model.ts`: `runnerStatus: 'at-node'` (no awaiting-snippet-fill)

## Decisions Made

1. **DEPRECATED_KINDS pattern**: Added `const DEPRECATED_KINDS = new Set<string>(['free-text-input'])` before `CanvasParser` class in canvas-parser.ts. This set-based approach is extensible for future deprecated node kinds without requiring code changes to `parseNode()` switch.

2. **snippetId removed from TextBlockNode**: The old Phase 5 mechanism wired `text-block` nodes with `snippetId` to trigger `awaiting-snippet-fill`. Since the entire snippet fill integration is being redesigned in Wave 1 (Plan 02/03), `snippetId` was fully removed from the graph model. The `radiprotocol_snippetId` canvas property will no longer be parsed.

3. **6 test removals, 1 test addition**: Removed tests for `enterFreeText()`, `completeSnippet()`, `awaiting-snippet-fill` state, and two separator tests that depended on those methods. Added `DEPRECATED_KINDS silent skip` test verifying the new guard behavior.

## Deviations from Plan

None — plan executed exactly as written. All six production files and three test files updated per specification.

## Known Stubs

None. All removed code paths are fully replaced or cleanly deleted.

## Threat Flags

None. All changes are pure TypeScript refactoring with no new I/O, network endpoints, or auth paths.

## Self-Check

- [x] `src/graph/graph-model.ts` — FreeTextInputNode removed, RPNodeKind is 6-member, TextBlockNode has no snippetId
- [x] `src/graph/canvas-parser.ts` — DEPRECATED_KINDS set present, no free-text-input case, no FreeTextInputNode import
- [x] `src/graph/graph-validator.ts` — no free-text-input case in nodeLabel()
- [x] `src/runner/runner-state.ts` — RunnerStatus is 4-member, AwaitingSnippetFillState removed, RunnerState union is 4-member
- [x] `src/runner/protocol-runner.ts` — no snippetId/snippetNodeId fields, no enterFreeText/completeSnippet, no awaiting-snippet-fill case
- [x] `src/sessions/session-model.ts` — runnerStatus: 'at-node' only, no snippetId/snippetNodeId fields
- [x] Commits c23a2b1 and ea65b63 exist in git log
- [x] vitest: 133 passed, 3 pre-existing RED

## Self-Check: PASSED
