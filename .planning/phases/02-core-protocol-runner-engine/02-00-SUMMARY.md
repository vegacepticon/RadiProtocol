---
phase: 02-core-protocol-runner-engine
plan: "00"
subsystem: testing
tags: [vitest, canvas-fixtures, tdd, protocol-runner, text-accumulator]

# Dependency graph
requires:
  - phase: 01-project-scaffold-and-canvas-parsing-foundation
    provides: CanvasParser, graph-model types, canvas fixture format reference
provides:
  - Four canvas fixture files covering text-block, snippet-block, free-text, loop-start scenarios
  - RED stub tests for TextAccumulator (6 tests) defining append/snapshot/restoreTo contract
  - RED stub tests for ProtocolRunner (18 tests) defining full RUN-01..RUN-09 contract
  - src/__tests__/runner/ directory with both test files
affects: [02-01-text-accumulator-implementation, 02-02-protocol-runner-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED phase: test files written before implementation to define exact API contracts
    - Inline ProtocolGraph construction: tests build graphs directly via Map/array for edge cases without fixtures
    - Discriminated union guard: status checks with `if (state.status !== 'at-node') return` before accessing narrowed fields

key-files:
  created:
    - src/__tests__/fixtures/text-block.canvas
    - src/__tests__/fixtures/snippet-block.canvas
    - src/__tests__/fixtures/free-text.canvas
    - src/__tests__/fixtures/loop-start.canvas
    - src/__tests__/runner/text-accumulator.test.ts
    - src/__tests__/runner/protocol-runner.test.ts
  modified: []

key-decisions:
  - "Test files reference stub class exports that exist (no import errors) but methods not yet implemented (TypeError RED)"
  - "protocol-runner.test.ts uses inline ProtocolGraph construction for multi-step and edge-case tests to avoid fixture proliferation"
  - "loop-start.canvas triggers D-05 error path by having start→loop-start with no further traversal logic"

patterns-established:
  - "Canvas fixture JSON style: flat nodes array, no trailing commas, integer x/y/width/height, radiprotocol_-prefixed fields"
  - "Test file structure: describe blocks per requirement group (RUN-NN labels in describe names), loadGraph() helper function"

requirements-completed:
  - RUN-01
  - RUN-02
  - RUN-03
  - RUN-04
  - RUN-05
  - RUN-06
  - RUN-07
  - RUN-08
  - RUN-09

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 02 Plan 00: Wave 0 — Canvas Fixtures and RED Test Stubs Summary

**Four canvas fixture files and 24 fully-specified RED test cases defining the complete ProtocolRunner and TextAccumulator API contract for Plans 02-01 and 02-02**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T07:45:00Z
- **Completed:** 2026-04-06T08:00:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created four canvas fixture JSON files in `src/__tests__/fixtures/` covering text-block, snippet-block (snippetId), free-text-input, and loop-start scenarios
- Wrote `text-accumulator.test.ts` with 6 tests covering full append/snapshot/restoreTo contract including Unicode (NFR-11)
- Wrote `protocol-runner.test.ts` with 18 tests covering RUN-01..RUN-09: start traversal, chooseAnswer, enterFreeText, stepBack, awaiting-snippet-fill, loop-start error, and iteration cap
- All 23 tests fail RED (method/property TypeErrors on stubs) with no import errors or syntax errors
- Zero Obsidian imports in any test file — pure Node.js vitest environment confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create four canvas fixture files** - `e07489d` (feat)
2. **Task 2: Write stub test files (RED — failing by design)** - `a5f46c0` (test)

## Files Created/Modified
- `src/__tests__/fixtures/text-block.canvas` - start → question → answer → text-block (terminal)
- `src/__tests__/fixtures/snippet-block.canvas` - identical to text-block but with snippetId on text-block for awaiting-snippet-fill state
- `src/__tests__/fixtures/free-text.canvas` - start → free-text-input node with prefix/suffix (terminal)
- `src/__tests__/fixtures/loop-start.canvas` - start → loop-start (triggers D-05 error path)
- `src/__tests__/runner/text-accumulator.test.ts` - 6 RED tests: current property, append, snapshot, restoreTo, Unicode
- `src/__tests__/runner/protocol-runner.test.ts` - 18 RED tests: full contract for all 9 runner requirements

## Decisions Made
- Used inline `ProtocolGraph` construction (Map/array) for multi-step stepBack tests and edge cases to avoid creating additional fixture files
- Verified stub imports compile without error (classes exist, but methods not implemented) — failures are `TypeError: method is not a function` not `Cannot find module`
- The one passing test (`typeof ProtocolRunner === 'function'`) confirms the NFR-01 import check works correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None — this plan intentionally creates test stub files, not implementation stubs. The RED state is the expected outcome for Wave 0.

## Next Phase Readiness
- All RED test contracts are complete; Plans 02-01 (TextAccumulator) and 02-02 (ProtocolRunner) can implement against these tests
- `src/__tests__/runner/text-accumulator.test.ts` defines the exact API: `current` getter, `append(text)`, `snapshot()`, `restoreTo(snap)`
- `src/__tests__/runner/protocol-runner.test.ts` defines: constructor accepts `{ maxIterations }`, `start(graph)`, `getState()` returns discriminated union on `status`, `chooseAnswer(nodeId)`, `enterFreeText(text)`, `stepBack()`, `completeSnippet(renderedText)`
- Fixture JSON format is established — future fixture files should follow the same `radiprotocol_`-prefixed field pattern

---
*Phase: 02-core-protocol-runner-engine*
*Completed: 2026-04-06*

## Self-Check: PASSED

- FOUND: src/__tests__/fixtures/text-block.canvas
- FOUND: src/__tests__/fixtures/snippet-block.canvas
- FOUND: src/__tests__/fixtures/free-text.canvas
- FOUND: src/__tests__/fixtures/loop-start.canvas
- FOUND: src/__tests__/runner/text-accumulator.test.ts
- FOUND: src/__tests__/runner/protocol-runner.test.ts
- FOUND: .planning/phases/02-core-protocol-runner-engine/02-00-SUMMARY.md
- FOUND commit: e07489d (feat: canvas fixtures)
- FOUND commit: a5f46c0 (test: RED stub tests)
