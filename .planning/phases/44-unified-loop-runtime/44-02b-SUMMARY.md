---
phase: 44-unified-loop-runtime
plan: 02b
subsystem: runner-tests
tags: [runtime, loop, test-rewrites, fixture, wave-3]

# Dependency graph
requires:
  - plan: 44-01 (Wave 0 scaffolding) — provides `protocol-runner-loop-picker.test.ts` skeleton with 3 it.todo entries + `unified-loop-nested.canvas` fixture
  - plan: 44-02a (state machine) — provides `chooseLoopBranch(edgeId)`, `AwaitingLoopPickState`, B1 re-entry guard, B2 previousCursor threading, `advanceOrReturnToLoop` helper, dead-end semantics, `getSerializableState` widened to include `'awaiting-loop-pick'`
  - plan: 44-04 (iteration-cap excision) — confirms `ProtocolRunner.maxIterations` (RUN-09 cycle guard, default 50) intact for W4 long-body test assertion
  - phase: 43 — provides `unified-loop-valid.canvas` fixture, literal Cyrillic «выход» exit label, GraphValidator LOOP-04 enforcement
provides:
  - "src/__tests__/fixtures/unified-loop-long-body.canvas — 13-node fixture (start + loop + 10 text-blocks + terminal) with back-edge n-t10→n-loop for W4 long-body integration test"
  - "src/__tests__/runner/protocol-runner-loop-picker.test.ts — 6 passing tests pinning Plan 02a runtime: RUN-01 (halt), RUN-02 (body+back-edge B1+I1), RUN-03 («выход» pops + completes), RUN-04 (nested B1 invariant), RUN-05 (step-back B2), W4 (long-body Pitfall 10)"
  - "src/__tests__/runner/protocol-runner.test.ts — single remaining describe.skip is RUN-08 (Phase 45 scope per user decision 3); the 'loop support (LOOP-01..05, RUN-09)' describe.skip block deleted with its TODO Phase 44 comment header (B3 scope)"
affects:
  - 44-03 — RunnerView picker UI can land knowing the runtime contract is now pinned green; tests guarantee any UI work that doesn't break the state machine stays green
  - Phase 44 verifier — all 5 RUN-0x picker behaviours + W4 cycle-guard pin now have green test coverage; only Plan 03 (UI) remains for Phase 44 closure

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "B1 invariant assertion (stack-length check) — every test that walks a back-edge or a nested exit asserts loopContextStack.length stays at 1 (single-loop) or shrinks correctly (nested); guarantees re-entry guard never pushes a duplicate frame"
    - "Single-point-increment semantic — only the B1 re-entry guard increments iteration; chooseLoopBranch body-branch arm does NOT. Encoded in W4 formula `iteration = i + 1` after i picks (initial entry + i back-edge re-entries)"
    - "B2 canStepBack=true at first halt — RUN-05 asserts step-back is enabled even on the first picker halt after start(), proving the previousCursor threading + fallback works symmetrically"
    - "Pitfall 10 cycle-guard per-call reset — W4 runs 10 iterations × 10-text-block body (≈110 nodes total) without tripping ProtocolRunner.maxIterations=50, because the steps counter resets on each chooseLoopBranch → advanceThrough re-entry"
    - "B3 deletion scope — when removing a deprecated describe.skip block, also delete the preceding TODO comment block (1-3 lines) that explains why it was skipped; otherwise the grep gate on 'TODO Phase N' returns >0 and signals stale state"

key-files:
  created:
    - src/__tests__/fixtures/unified-loop-long-body.canvas — 13-node, 13-edge fixture for W4 long-body test
  modified:
    - src/__tests__/runner/protocol-runner.test.ts — Step A: RUN-08 comment marker 'TODO Phase 44' → 'TODO Phase 45'; Step B: deleted entire describe.skip('loop support (LOOP-01..05, RUN-09)') block + its preceding TODO Phase 44 comment lines (B3 scope) — net -88 lines
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts — replaced 3 it.todo entries with 6 concrete tests; added ProtocolRunner import + expect import; removed eslint-disable on loadGraph (now used) — net +146 lines

key-decisions:
  - "RUN-08 preservation per user decision 3 — describe.skip body byte-identical, only the 4-line TODO comment header retargeted from 'Phase 44' to 'Phase 45'. RUN-08 is not in Phase 44 requirement list; GraphValidator LOOP-04 already covers the equivalent contract"
  - "B3 done-criterion 'grep TODO Phase 44 returns 0' is the canonical gate — deleting the describe.skip body alone leaves the comment header and fails the gate. The plan's instruction explicitly required deleting the comment block AND describe.skip together"
  - "W4 iteration formula `iteration = i + 1` — initial start() halt contributes iteration=1; each chooseLoopBranch('e2') triggers exactly one back-edge re-entry → exactly one B1 increment. After i picks, iteration = 1 + i. Body-branch arm of chooseLoopBranch does NOT increment (single-point-increment semantic from Plan 02a Step D)"
  - "RUN-03 serialized-state assertion — after transitioning to 'complete', getSerializableState() returns null (only at-node / awaiting-snippet-pick / awaiting-snippet-fill / awaiting-loop-pick are serializable). Test asserts `serialized).toBeNull()` not `loopContextStack.length === 0` because the saved-state shape is gone entirely at complete"
  - "RUN-04 nested test threads through 4 picker halts in sequence: outer-entry → inner-entry → outer-re-entry → outer-exit → complete. Each halt asserts both nodeId AND loopContextStack length to fully pin the B1 stack-mutation contract through the nested journey"
  - "Helper deletion in protocol-runner.test.ts — the `reachLoopEnd` helper inside the deleted describe.skip block went with the block. No callers remain; Plan 03 will not need it because picker UI tests live in protocol-runner-loop-picker.test.ts (not protocol-runner.test.ts)"

patterns-established:
  - "Plan 02a runtime + Plan 02b tests as a sealed contract — every Plan 02a behaviour (B1, B2, dead-end helper, chooseLoopBranch dispatch, getSerializableState widening) has at least one passing assertion in protocol-runner-loop-picker.test.ts. Future plans that touch ProtocolRunner must keep these tests green or document the contract change"
  - "Phase-cycle TODO retargeting — when a skip block is preserved across phases, retarget the TODO marker to the next owning phase (Phase 44 → Phase 45) so grep-based phase-completeness checks (`grep TODO Phase N`) accurately reflect what's outstanding for the current phase"

requirements-completed:
  - "RUN-01 (test half — runtime halts at awaiting-loop-pick over loop node, asserted by RUN-01 test)"
  - "RUN-02 (test half — body branch walks; back-edge re-entry increments iteration to 2 with stack.length=1, asserted by RUN-02 test)"
  - "RUN-03 (test half — chooseLoopBranch with «выход» pops frame and completes via terminal, asserted by RUN-03 test)"
  - "RUN-04 (test half — nested loops with B1 single-frame invariant through inner-exit re-entry, asserted by RUN-04 test)"
  - "RUN-05 (test half — step-back from picker restores empty stack; canStepBack=true at first halt via B2, asserted by RUN-05 test)"

# Metrics
duration: ~3min
completed: 2026-04-17
---

# Phase 44 Plan 02b: Runner Test Rewrites Summary

**Replaced the 3 `it.todo` entries in `protocol-runner-loop-picker.test.ts` with 5 concrete RUN-0x picker tests + 1 long-body integration test (W4) against the new `unified-loop-long-body.canvas` fixture, deleted the obsolete 7-test `describe.skip('loop support (LOOP-01..05, RUN-09)')` block (and its preceding `TODO Phase 44` comment header per B3 scope) from `protocol-runner.test.ts`, and retargeted the preserved `RUN-08 describe.skip` comment marker from `Phase 44` to `Phase 45` per user-locked decision 3. Full suite: 395 passed + 8 skipped / 0 failed (was 389 + 14 skipped at Plan 02a baseline — net +6 passing, -6 skipped).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T13:37:30Z
- **Completed:** 2026-04-17T13:40:57Z
- **Tasks:** 2 / 2
- **Files created:** 1 (unified-loop-long-body.canvas fixture)
- **Files modified:** 2 (protocol-runner.test.ts: Step A + B; protocol-runner-loop-picker.test.ts: Step C)
- **Production code touched:** 0

## Accomplishments

### Task 1 — Create `unified-loop-long-body.canvas` fixture

- 13 nodes: `n-start` (start), `n-loop` (loop with `headerText: "Long body"`), `n-t01`..`n-t10` (10 text-blocks with content `T01`..`T10`), `n-end` (terminal text-block with content `Done`)
- 13 edges: `e1` (n-start → n-loop unlabeled), `e2` (n-loop → n-t01 «проверка» — body branch), `e3` (n-loop → n-end «выход» — sole exit), `e4..e12` (text-block chain), `e13` (n-t10 → n-loop unlabeled — back-edge triggers B1 re-entry on each iteration)
- Inline node script verified: 1 loop node, 11 text-blocks (10 body + 1 end), 1 «выход» edge, back-edge from n-t10 to n-loop present

### Task 2 — Rewrite tests

**Step A — RUN-08 marker retarget in protocol-runner.test.ts:**
- 4-line `// TODO Phase 44` comment header above `describe.skip('loop-start missing continue edge (RUN-08)')` replaced with new 4-line `// TODO Phase 45` comment explaining GraphValidator LOOP-04 already covers the contract and RUN-08 is not in Phase 44 requirement list
- describe.skip body unchanged (byte-identical)

**Step B — Delete obsolete loop-support describe.skip in protocol-runner.test.ts:**
- Deleted 4-line `// TODO Phase 44` comment header
- Deleted entire `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)')` block (87 lines including helper `reachLoopEnd` + 6 inner `it` tests calling deleted `chooseLoopAction` API + reading deleted `loopIterationLabel` / `isAtLoopEnd` fields)
- Net deletion: 88 lines from protocol-runner.test.ts

**Step C — Fill protocol-runner-loop-picker.test.ts with 6 concrete tests:**
- Added `import { ProtocolRunner } from '../../runner/protocol-runner';` + `expect` import; removed `eslint-disable-next-line @typescript-eslint/no-unused-vars` on `loadGraph` (now called)
- Renamed describe block to `'ProtocolRunner loop picker (RUN-01..RUN-05)'`
- 6 tests:
  - **RUN-01** (halt) — `runner.start(unified-loop-valid.canvas)` → `state.status === 'awaiting-loop-pick'` AND `state.nodeId === 'n-loop'` AND `state.accumulatedText === ''`
  - **RUN-02** (body + back-edge B1+I1) — pick `e2` (body), assert at-node n-q1, `chooseAnswer('n-a1')` → back-edge e5 → re-enter loop → assert `loopContextStack.length === 1` AND `iteration === 2`
  - **RUN-03** («выход» exit) — pick `e3` («выход») → `state.status === 'complete'`, `getSerializableState()` returns null
  - **RUN-04** (nested B1) — outer-entry (stack.length=1) → enter inner (length=2) → inner «выход» (length=1, nodeId='n-outer', iteration=2 from B1 re-entry) → outer «выход» → complete
  - **RUN-05** (step-back B2) — first halt has `canStepBack === true`; after `stepBack()` `loopContextStack.length === 0` AND `accumulatedText === ''`
  - **W4** (long-body cycle-guard pin) — `unified-loop-long-body.canvas`; loop 10 iterations via `chooseLoopBranch('e2')`, assert each iteration `loopContextStack.length === 1` AND `iteration === i + 1`; final `chooseLoopBranch('e3')` completes

## Task Commits

1. **Task 1: Create unified-loop-long-body.canvas fixture for W4 long-body integration test** — `1a2cf27` (test)
2. **Task 2: Rewrite skipped loop tests + fill picker test file with 6 RUN-0x tests** — `02ee321` (test)

## Files Created/Modified

### Created

- `src/__tests__/fixtures/unified-loop-long-body.canvas` (+32 lines) — 13-node, 13-edge fixture

### Modified

- `src/__tests__/runner/protocol-runner.test.ts` — Step A (4 comment lines retargeted) + Step B (-88 lines: 4 comment + 84 describe.skip block); net -88 lines
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — Step C complete rewrite from 24-line skeleton to 170-line concrete tests file; net +146 lines

## Verification Results

### Plan-level done criteria (all green)

- ✅ `grep -cE 'describe\.skip|it\.skip|it\.todo' src/__tests__/runner/protocol-runner.test.ts` → **1** (RUN-08 only — preserved per user decision 3)
- ✅ `grep -c 'TODO Phase 45' src/__tests__/runner/protocol-runner.test.ts` → **1** (new marker on RUN-08 skip)
- ✅ **B3 done-criterion:** `grep -c 'TODO Phase 44' src/__tests__/runner/protocol-runner.test.ts` → **0**
- ✅ `grep -c 'chooseLoopAction' src/__tests__/runner/protocol-runner.test.ts` → **0** (deleted along with the skip block)
- ✅ `grep -c 'chooseLoopBranch' src/__tests__/runner/protocol-runner-loop-picker.test.ts` → **10** (≥5 ✓ — RUN-02/03/04 use it; RUN-04 uses 3×; W4 loop body)
- ✅ `grep -cE "\bit\(" src/__tests__/runner/protocol-runner-loop-picker.test.ts` → **6** (RUN-01..05 + W4)
- ✅ **I1 done-criterion:** `grep -c 'loopContextStack.length' src/__tests__/runner/protocol-runner-loop-picker.test.ts` → **8** (≥4 ✓ — RUN-02 + 3× RUN-04 + RUN-05 + W4 loop)
- ✅ `grep -c 'unified-loop-long-body.canvas' src/__tests__/runner/protocol-runner-loop-picker.test.ts` → **1**
- ✅ `npx vitest run src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts` → 50 passed + 1 skipped / 0 failed
- ✅ RUN-09 iteration cap test still passes: `npx vitest run -t "iteration cap"` → 2 passed
- ✅ `grep -rn 'chooseLoopAction\|loopIterationLabel\|isAtLoopEnd' src/runner/ src/views/ src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts` → 0 matches

### Full-plan verification

- ✅ `npx tsc --noEmit --skipLibCheck` → exit 0 (clean compile)
- ✅ `npm test -- --run` → **395 passed + 8 skipped / 0 failed** (29 test files; +6 passing vs Plan 04 baseline of 389/14 — net 6 new tests + 6 fewer skipped because we replaced the 7-test describe.skip block with 6 inline new tests, then 7-1=6 skipped reduction)
- ✅ `npm run build` → exit 0 (production bundle generated; dev vault copy succeeded)
- ✅ `git diff --diff-filter=D --name-only HEAD~2 HEAD` → empty (no file deletions)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single pass:
- No Rule 1 (bug fixes) — pre-existing runtime behaved exactly as Plan 02a Handoff described
- No Rule 2 (missing critical functionality) — no new security/correctness gaps surfaced
- No Rule 3 (blocking issues) — TS compile stayed clean throughout
- No Rule 4 (architectural changes) — no design choices needed
- No auth gates — fully autonomous test-only execution

## Handoff Notes for Plan 03 (RunnerView picker UI)

1. **Runtime + tests are live and green.** The `awaiting-loop-pick` state-machine contract is fully pinned by 5 RUN-0x tests + W4 long-body. Plan 03 can refactor the RunnerView `case 'awaiting-loop-pick':` arm (currently a Plan 02a Rule 3 stub returning placeholder paragraph + accumulated text + output toolbar) to the real picker render without fear of breaking the state machine.
2. **Pattern:** `state.nodeId` lookup against `graph.edges.filter(e => e.fromNodeId === state.nodeId)` — every outgoing edge becomes a button, dispatch via `runner.chooseLoopBranch(edge.id)`. Mirror `case 'awaiting-snippet-pick':` arm shape (runner-view.ts:434-450) for halt-state skeleton; mirror at-node question button-per-neighbour pattern for the picker buttons.
3. **Header:** render `LoopNode.headerText` above the picker if non-empty (the loop's editable header).
4. **Step-back button:** copy from `case 'at-node'` arm — `state.canStepBack` gate, click handler does `runner.stepBack() + autoSaveSession() + render()`.
5. **Click handler:** `syncManualEdit(preview.value ?? '') + chooseLoopBranch(edge.id) + autoSaveSession() + renderAsync()` — Pattern 3 (BUG-01 + autosave fire-and-forget).
6. **CSS:** new classes go in `src/styles/loop-support.css` under a `/* Phase 44: Unified loop picker (RUN-01) */` marker (CLAUDE.md append-only). Phase 6 block above stays untouched.
7. **Session round-trip integration test (RUN-06):** Plan 03 still owns the rewrites of the 6 `it.skip` + 1 `describe.skip` blocks in `protocol-runner-session.test.ts` per the original phase plan. Plan 02b explicitly did NOT touch session tests.

## Known Stubs

None introduced by this plan. Plan 02a's `runner-view.ts` `case 'awaiting-loop-pick':` placeholder remains (acknowledged stub awaiting Plan 03 picker UI).

## Threat Flags

None — test-only artifacts (1 fixture + test rewrites). No new network surface, auth path, file access pattern, or schema change at trust boundaries.

## Self-Check: PASSED

- ✅ FOUND: `src/__tests__/fixtures/unified-loop-long-body.canvas`
- ✅ FOUND: `src/__tests__/runner/protocol-runner.test.ts` (modified — Steps A + B applied)
- ✅ FOUND: `src/__tests__/runner/protocol-runner-loop-picker.test.ts` (modified — Step C complete rewrite)
- ✅ FOUND commit: `1a2cf27` — `test(44-02b): add unified-loop-long-body fixture for W4 long-body integration test`
- ✅ FOUND commit: `02ee321` — `test(44-02b): rewrite skipped loop tests + fill picker test file with 6 RUN-0x tests`
