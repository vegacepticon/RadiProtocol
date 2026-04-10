---
phase: 20-housekeeping-removals
plan: "01"
subsystem: tests
tags: [tdd, wave-0, red-tests, nyquist]
dependency_graph:
  requires: []
  provides: [wave-0-red-tests]
  affects: [20-02-PLAN, 20-03-PLAN]
tech_stack:
  added: []
  patterns: [red-green-refactor, prototype-spy, vi.mock-factory]
key_files:
  created:
    - src/__tests__/fixtures/deprecated-free-text.canvas
  modified:
    - src/__tests__/canvas-parser.test.ts
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/editor-panel.test.ts
    - src/__tests__/RunnerView.test.ts
    - src/__mocks__/obsidian.ts
decisions:
  - "Used vi.mock factory pattern for ResumeSessionModal/CanvasSelectorWidget/CanvasSwitchModal to prevent openCanvas() from hanging in Node environment"
  - "Extended MockTextComponent.inputEl with rows:2 default so UX-02 test can assert rows===6 after Plan 03"
  - "NTYPE-04 RunnerView test uses 'resume' modal mock so current code calls restoreFrom() with awaiting-snippet-fill — test asserts clear() called (RED)"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
---

# Phase 20 Plan 01: Wave 0 Test Scaffolding Summary

Wave 0 RED test scaffolding for housekeeping removals (free-text-input node type removal, snippet system removal, UX row fix). All new tests fail against current code and will turn GREEN when Plans 02 and 03 implement the corresponding changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create deprecated-free-text.canvas fixture and canvas-parser DEPRECATED_KINDS tests | 1736596 | `fixtures/deprecated-free-text.canvas`, `canvas-parser.test.ts` |
| 2 | Rewrite protocol-runner awaiting-snippet-fill block, add NTYPE-03/04 tests | ca0d02a | `protocol-runner.test.ts` |
| 3 | Add UX-02 answer-rows test and NTYPE-04 session degradation test | 5d62f86 | `editor-panel.test.ts`, `RunnerView.test.ts`, `obsidian.ts` mock |

## New RED Tests (Wave 0)

| Test | File | Requirement | Why RED |
|------|------|-------------|---------|
| `silently skips free-text-input node` | canvas-parser.test.ts | NTYPE-01 | free-text-input still in validKinds — nodes.has('n-ft1') returns true |
| `drops edges to deprecated nodes` | canvas-parser.test.ts | NTYPE-02 | edge still present (edges.length === 1, not 0) |
| `getSerializableState() never returns awaiting-snippet-fill` | protocol-runner.test.ts | NTYPE-04 | snippetId field still present in serializable state |
| `answer textarea inputEl.rows is 6` | editor-panel.test.ts | UX-02 | rows not explicitly set — mock default is 2, not 6 |
| `starts fresh session for awaiting-snippet-fill` | RunnerView.test.ts | NTYPE-04 | no degradation guard — clear() never called |

## Removed Tests (Pre-Plan-02 Cleanup)

- `awaiting-snippet-fill state (RUN-08, D-06, D-07)` describe block — tests completeSnippet() which is being deleted
- `enterFreeText() — free-text input node (RUN-04)` describe block — tests method being deleted
- `D-02: enterFreeText separator` test — tests deleted method
- `D-03: completeSnippet inserts separator` test — tests deleted method

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock auto-mock broke Setting.prototype.setHeading chain**
- **Found during:** Task 3 (UX-02 test)
- **Issue:** `vi.mock('obsidian')` auto-mocks all methods returning undefined; `setHeading()` returned undefined causing TypeError on `.setName()` chain
- **Fix:** Used `mockImplementation` on the auto-mocked `Setting.prototype` methods to return `this` for chaining, and intercept `addTextArea` to capture `rows`
- **Files modified:** `src/__tests__/editor-panel.test.ts`

**2. [Rule 3 - Blocking] RunnerView test required full DOM and Obsidian Component method stubs**
- **Found during:** Task 3 (NTYPE-04 RunnerView test)
- **Issue:** `openCanvas()` calls `render()` which deeply traverses DOM; also calls `registerDomEvent`, `requestAnimationFrame` — none available in Node
- **Fix:** Injected recursive mock DOM element (`makeMockDomEl`), stubbed `registerDomEvent`/`registerEvent`/`register`, added `requestAnimationFrame` global stub, mocked `ResumeSessionModal` to resolve immediately, mocked `CanvasSelectorWidget`/`CanvasSwitchModal`/`SnippetFillInModal`
- **Files modified:** `src/__tests__/RunnerView.test.ts`

**3. [Rule 2 - Missing functionality] obsidian mock missing `rows` on MockTextComponent.inputEl**
- **Found during:** Task 3 (UX-02 test design)
- **Issue:** `MockTextComponent.inputEl` had no `rows` property; needed to capture the value Plan 03 will set
- **Fix:** Added `rows: 2` default to `MockTextComponent.inputEl` in `src/__mocks__/obsidian.ts`
- **Files modified:** `src/__mocks__/obsidian.ts`

## Test Run Summary

```
Tests:  8 failed | 127 passed (135)
```

New failing tests (8): 2 canvas-parser NTYPE-01/02, 1 protocol-runner NTYPE-04, 1 editor-panel UX-02, 1 RunnerView NTYPE-04, plus 3 pre-existing runner-extensions RED stubs (unchanged from before this plan).

Pre-existing tests: 127 passing — no regressions.

## Known Stubs

None — this plan only creates test scaffolding, no production code stubs.

## Self-Check: PASSED
