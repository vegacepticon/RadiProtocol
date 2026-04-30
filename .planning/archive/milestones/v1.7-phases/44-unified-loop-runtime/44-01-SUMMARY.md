---
phase: 44-unified-loop-runtime
plan: 01
subsystem: test-scaffolding
tags: [runtime, loop, test-scaffolding, fixture, wave-0]

# Dependency graph
requires:
  - phase: 43 (unified-loop-graph-model-parser-validator-migration-errors)
    provides: CanvasParser supports `radiprotocol_nodeType: "loop"` + `radiprotocol_headerText`; GraphValidator LOOP-04 contract (exactly one «выход» edge + ≥1 body edge per loop node); literal Cyrillic «выход» as exit label (D-08, 6 chars, case-sensitive, no trim)
provides:
  - "src/__tests__/fixtures/unified-loop-nested.canvas — nested-loop canvas (outer 'Organ' + inner 'Lesion') for RUN-04 picker frame-pop testing"
  - "src/__tests__/runner/protocol-runner-loop-picker.test.ts — Wave 0 skeleton with 3 it.todo entries reserving slots for RUN-01/02/03 picker state-machine tests (loaded by Plan 44-02)"
affects:
  - 44-02a / 44-02b — Wave 2 plans now have a green test file ready to accept real RUN-01..RUN-03 assertions and a nested fixture ready for RUN-04 frame-pop tests
  - 44-03 — RunnerView UI tests can also load the nested fixture if they need a multi-loop visual scenario

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 scaffolding-before-runtime: fixtures + test-file skeletons land BEFORE production runtime edits so Wave 2 commits can be pinned green from commit #1 (Nyquist validation strategy)"
    - "it.todo placeholders: vitest-native skeleton entries that compile + run + show in the test list without requiring assertions, while still being countable as Wave 0 deliverables"
    - "loadGraph() helper byte-mirrored from protocol-runner.test.ts so fixture loading is identical across the runner test corpus"

key-files:
  created:
    - src/__tests__/fixtures/unified-loop-nested.canvas — nested-loop canvas JSON (6 nodes, 7 edges)
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts — picker-test skeleton (24 lines, 3 it.todo)
  modified: []

key-decisions:
  - "Nested fixture wires inner loop's «выход» (e5) back to outer loop node (n-outer), NOT to terminal (n-end) — this is what makes the fixture genuinely 'nested' and exercises frame-pop semantics in RUN-04: exiting inner returns control to outer's picker rather than completing the protocol"
  - "Outer loop's «выход» (e3) points to terminal n-end — symmetric with unified-loop-valid.canvas exit shape; outer-frame pop completes the protocol"
  - "Test-file skeleton uses `eslint-disable-next-line @typescript-eslint/no-unused-vars` on loadGraph because Wave 0 it.todo stubs do not call it; Plan 44-02 will remove the disable when it adds real test bodies"
  - "ProtocolRunner import intentionally OMITTED at Wave 0 — the 3 it.todo entries make no assertions; Plan 44-02 adds the import alongside its first real `expect()` call"
  - "Vertical y-coordinate staggering (0/120/240/120/240/360/360) keeps the JSON readable when humans inspect the fixture; canvas coords have no semantic effect on parser/validator/runner"

patterns-established:
  - "Phase 44 Wave 0 scaffolding pattern: one fixture + one test-file skeleton per Wave 2 plan, committed independently (one commit per artifact) for atomic revert if Wave 2 redirects"
  - "Test-file naming convention: `{module-under-test}-{behaviour-cluster}.test.ts` — `protocol-runner-loop-picker.test.ts` keeps picker-state-machine tests separate from existing protocol-runner.test.ts and protocol-runner-session.test.ts (which Plan 44-02 will rewrite in place)"

requirements-completed:
  - "RUN-04 (partial — Wave 0 fixture deliverable; runtime implementation lands in Plan 44-02)"

# Metrics
duration: ~2min
completed: 2026-04-17
---

# Phase 44 Plan 01: Wave 0 Test Scaffolding Summary

**Created `src/__tests__/fixtures/unified-loop-nested.canvas` (outer 'Organ' + inner 'Lesion' loops with frame-pop semantics) and `src/__tests__/runner/protocol-runner-loop-picker.test.ts` skeleton (3 it.todo entries reserving RUN-01/02/03 slots) so Wave 2 runtime edits in Plan 44-02 can be pinned by green tests from the first commit.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T13:09:47Z
- **Completed:** 2026-04-17T13:11:21Z
- **Tasks:** 2 / 2
- **Files created:** 2 (1 fixture, 1 test skeleton)
- **Files modified:** 0
- **Production code touched:** 0

## Accomplishments

### Task 1 — Nested-loop fixture (RUN-04 scaffolding)

- Created `src/__tests__/fixtures/unified-loop-nested.canvas` (6 nodes, 7 edges)
- Outer loop **n-outer** with `radiprotocol_headerText: "Organ"` — exit edge `e3 (n-outer → n-end, label="выход")` and body edge `e2 (n-outer → n-inner, label="проверка")`
- Inner loop **n-inner** with `radiprotocol_headerText: "Lesion"` — exit edge `e5 (n-inner → n-outer, label="выход")` (frame-pop back to outer picker, NOT to terminal) and body edge `e4 (n-inner → n-inner-q, label="проверка")`
- Inner-loop body chain: `n-inner-q (question "Size?") → n-inner-a (answer "1 cm") → n-inner` (back-edge for dead-end return — exercises Plan 44-02 dead-end-helper logic)
- Both loops pass GraphValidator LOOP-04 (verified by inline `node -e` script counting exit/body edges per loop node)
- Both «выход» labels are literal 6-char Cyrillic `в-ы-х-о-д` per Phase 43 D-08 (verified by `rg -c 'выход'` returns 2)

### Task 2 — Picker-test skeleton (RUN-01..RUN-03 reservation)

- Created `src/__tests__/runner/protocol-runner-loop-picker.test.ts` (24 lines)
- Imports: `vitest` describe/it, node fs/path, CanvasParser, ProtocolGraph type — mirrors protocol-runner.test.ts header byte-for-byte
- `loadGraph(name)` helper present (eslint-disabled for unused-var because Wave 0 stubs don't call it; Plan 44-02 will remove the disable)
- Single `describe('ProtocolRunner loop picker (RUN-01, RUN-02, RUN-03)')` block with 3 `it.todo` entries:
  - RUN-01: runner halts at awaiting-loop-pick after start() on unified-loop-valid.canvas
  - RUN-02: choosing a body branch walks it; dead-end auto-returns with iteration=2
  - RUN-03: choosing «выход» pops the loop frame and advances along the exit edge
- File compiles green (`npx tsc --noEmit --skipLibCheck` exit 0)
- Vitest reports 3 todos / 0 failures (file-level skipped because all entries are todo)
- Full test suite: **388 passed + 14 skipped + 3 todo / 0 failed across 28 test files**
- Production build: **green** (`npm run build` exit 0)

## Task Commits

1. **Task 1: Create unified-loop-nested.canvas fixture for RUN-04** — `5561907` (test)
2. **Task 2: Create protocol-runner-loop-picker.test.ts skeleton** — `d86c863` (test)

## Files Created/Modified

### Created

- `src/__tests__/fixtures/unified-loop-nested.canvas` (+19 lines) — nested-loop canvas JSON
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` (+24 lines) — picker test skeleton with 3 it.todo entries

### Modified

- None — Wave 0 is strictly additive, zero production-code edits.

## Verification Results

- ✅ Fixture inline `node -e` LOOP-04 structural script: `OK`
- ✅ `rg -c 'выход' src/__tests__/fixtures/unified-loop-nested.canvas` → 2 (one per loop)
- ✅ `rg -c '"radiprotocol_nodeType": "loop"' src/__tests__/fixtures/unified-loop-nested.canvas` → 2 (outer + inner)
- ✅ `rg -c 'it.todo' src/__tests__/runner/protocol-runner-loop-picker.test.ts` → 3
- ✅ `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts` → 3 todo, 0 failures
- ✅ `npx tsc --noEmit --skipLibCheck` → exit 0
- ✅ `npm test -- --run` → 388 passed + 14 skipped + 3 todo / 0 failed (28 test files)
- ✅ `npm run build` → exit 0
- ✅ `git diff main~2 main --stat` → 2 files changed, 43 insertions(+), 0 deletions; both files inside `src/__tests__/` (no production code touched)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in one pass with no auto-fixes, no architectural questions, no auth gates.

## Handoff Notes for Plan 02 (44-02a / 44-02b)

The Wave 0 scaffolding is now in place. Wave 2 plans can:

1. **Use `unified-loop-nested.canvas` directly** — `loadGraph('unified-loop-nested.canvas')` returns a parsed graph with two loop nodes, two «выход» edges (one inner-→-outer, one outer-→-terminal), and a dead-end body chain inside the inner loop ready for RUN-02/RUN-04 dead-end-return tests.
2. **Replace the 3 `it.todo` entries** in `protocol-runner-loop-picker.test.ts` with real assertions:
   - Add `import { ProtocolRunner } from '../../runner/protocol-runner';` at the top
   - Remove the `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment above `loadGraph` once it's called
   - Each `it.todo(...)` becomes `it(...)` with a body following the rhythm of the passing tests in `protocol-runner.test.ts` (load fixture → start runner → assert state.status / state.currentNodeId / loopContextStack)
3. **Do NOT touch other test files at this commit boundary** — Plans 44-02a/02b will independently rewrite the existing `.skip` blocks in `protocol-runner.test.ts` and `protocol-runner-session.test.ts` per the phase plan map (44-PATTERNS.md).
4. **Production code is untouched** — every `src/runner/*`, `src/views/*`, `src/graph/*`, `src/sessions/*`, `src/settings.ts` file remains exactly as Phase 43 left it. Plan 44-02 owns the first production edits.

No stubs flow to UI rendering. No new threat surface introduced (test-only artifacts).

## Self-Check: PASSED

- ✅ FOUND: `src/__tests__/fixtures/unified-loop-nested.canvas`
- ✅ FOUND: `src/__tests__/runner/protocol-runner-loop-picker.test.ts`
- ✅ FOUND commit: `5561907` — `test(44-01): add unified-loop-nested fixture for RUN-04`
- ✅ FOUND commit: `d86c863` — `test(44-01): add protocol-runner-loop-picker.test.ts skeleton`
