---
phase: 44-unified-loop-runtime
plan: 02a
subsystem: runner-state-machine
tags: [runtime, loop, state-machine, picker, session, wave-2]

# Dependency graph
requires:
  - plan: 44-01 (Wave 0 scaffolding) — provides nested fixture + picker test skeleton
  - phase: 43 (graph-model + parser + validator + migration errors) — provides LoopNode kind, LOOP-04 contract, literal Cyrillic «выход» exit label, loopNodeId rename
provides:
  - "AwaitingLoopPickState — sixth RunnerState discriminant carrying loop nodeId, accumulatedText, canStepBack"
  - "ProtocolRunner.chooseLoopBranch(edgeId: string): void — public picker-exit method dispatching by edge.label === 'выход'"
  - "ProtocolRunner case 'loop' real runtime — B1 re-entry guard (top-of-stack check before new-frame push) + B2 previousCursor undo threading + first-entry frame push"
  - "ProtocolRunner.advanceOrReturnToLoop(next) private helper — dead-end-inside-loop returns to top-frame's picker with iteration++; outside loop calls transitionToComplete"
  - "PersistedSession.runnerStatus widened to include 'awaiting-loop-pick' (RUN-06 type half — round-trip lives in Plan 03)"
  - "getSerializableState / restoreFrom signatures widened to accept 'awaiting-loop-pick'"
  - "getState() new awaiting-loop-pick arm + cleaned at-node arm (no deprecated fields)"
affects:
  - 44-02b — test rewrites can now run green against this runtime (RUN-01..RUN-05 + W4 long-body integration)
  - 44-03 — RunnerView picker UI can render `state.nodeId` lookup against `graph.edges.filter(e => e.fromNodeId === state.nodeId)`; awaiting-loop-pick exhaustiveness arm exists as placeholder ready for real implementation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "B1 re-entry guard: top-of-loopContextStack check before frame push — distinguishes first loop entry (push frame + halt) from re-entry via back-edge / inner-выход (increment top frame iteration in-place + halt)"
    - "B2 previousCursor threading: tracks pre-cursor predecessor through advanceThrough so loop-entry undo can snapshot nodeId=predecessor; falls back to nodeId=cursor when previousCursor=null (start() lands directly on loop) preserving symmetric canStepBack semantics"
    - "advanceOrReturnToLoop helper: extracts the firstNeighbour-undefined dead-end check from 3 cases (start/text-block-non-snippet/answer); inside a loop frame increments iteration + halts at picker; outside completes — iteration semantic 'EVERY return to picker from a body pass increments iteration exactly once'"
    - "chooseLoopBranch dispatch by literal Cyrillic 'выход' (no trim, no lowercase) — body branch does NOT increment iteration (B1 owns increment) so iteration count = number of times user has seen the picker"
    - "Discriminated-union exhaustiveness as compile-time enforcement — adding AwaitingLoopPickState to RunnerState forced fixes in getState() switch, getSerializableState gate, restoreFrom signature, and runner-view render switch (latter Plan 03 owns)"

key-files:
  created: []
  modified:
    - src/runner/runner-state.ts (+10 / -13 net) — added AwaitingLoopPickState interface, extended RunnerState union, deleted deprecated AtNodeState fields loopIterationLabel + isAtLoopEnd
    - src/sessions/session-model.ts (+2 / -2) — widened PersistedSession.runnerStatus union
    - src/runner/protocol-runner.ts (+126 / -47 net) — case 'loop' runtime, chooseLoopBranch method, advanceOrReturnToLoop helper, B2 previousCursor threading, getState arms, getSerializableState/restoreFrom signatures, deleted chooseLoopAction stub, deleted Phase 43 D-14 comment block in at-node arm
    - src/__tests__/runner/protocol-runner.test.ts (+10 / -8) — Rule 3 cast deferral inside describe.skip block
    - src/__tests__/runner/protocol-runner-session.test.ts (+3 / -2) — Rule 3 cast deferral inside describe.skip block
    - src/views/runner-view.ts (+12 / 0) — Rule 3 minimal awaiting-loop-pick exhaustiveness arm

key-decisions:
  - "Iteration increment happens ONLY in case 'loop' B1 re-entry guard and in advanceOrReturnToLoop — chooseLoopBranch deliberately does NOT increment for body branches. Rationale: 'iteration = number of times user has seen the picker for this loop node'. Without this rule both chooseLoopBranch AND B1 would increment, giving 2N+1 iterations after N picks (confusing + breaks Plan 02b RUN-02 expect(iteration).toBe(2))"
  - "B2 previousCursor=null fallback: when start() lands directly on a loop node, push undo with nodeId=loopNode itself. Step-back becomes a logical no-op (re-running advanceThrough re-halts at picker) but UI step-back button shows enabled symmetrically across all picker states. RUN-05 Plan 02b assertion confirms canStepBack=true even on first loop"
  - "advanceOrReturnToLoop returns 'continue' | 'halted'. On 'halted' the helper has already mutated currentNodeId + runnerStatus; caller just returns. On 'continue', caller does previousCursor = cursor + cursor = next!. The next! non-null assertion is safe because 'continue' implies next !== undefined"
  - "Rule 3 deviation in tests: existing describe.skip blocks at protocol-runner.test.ts:458 and protocol-runner-session.test.ts:336 reference deleted chooseLoopAction/loopIterationLabel/isAtLoopEnd. Replaced with `(runner as unknown as { chooseLoopAction(...): void }).chooseLoopAction(...)` casts to keep TS compile green. Bodies preserved verbatim for Plan 02b reference. Plan 02b will rewrite these blocks against unified-loop-valid.canvas"
  - "Rule 3 deviation in runner-view.ts: added minimal awaiting-loop-pick exhaustiveness arm with placeholder paragraph text 'Loop picker (Phase 44 Plan 03 will render this).'. CLAUDE.md never-delete rule honoured — only added. Plan 03 will replace this arm with the real picker render (headerText + edge buttons + step-back)"
  - "Step C cycle-guard reset comment: documented at top of advanceThrough that steps counter resets per call (RUN-09 maxIterations cap remains intact). No behavioural change. W4 long-body integration test in Plan 02b Task 2 will exercise the cap with realistic body sizes"
  - "Legacy `case 'loop-start' | case 'loop-end'` defensive transitionToError arm in advanceThrough left UNTOUCHED — still required for TS exhaustiveness (Phase 43 D-CL-05 variant b kept legacy kinds in RPNodeKind union). Phase 46 owns full legacy-kind removal"

patterns-established:
  - "Rule 3 deferred-compile-fix idiom: when Plan A removes a public API that Plan B will rewrite tests for, the executor adds `(target as unknown as { method(...): void }).method(...)` casts in Plan A so TS stays green between plans. Test bodies remain verbatim for Plan B reference"
  - "B1/B2 fix tagging in code comments: complex multi-step fixes (B1 = re-entry guard, B2 = previousCursor threading) get an inline `// B1 …` / `// B2 …` marker comment so future readers can locate the design rationale via grep"

requirements-completed:
  - "RUN-01 (state-machine half — runtime halts at awaiting-loop-pick over loop node; picker UI lives in Plan 03)"
  - "RUN-02 (dead-end body returns to picker via advanceOrReturnToLoop; back-edge body re-enters via case 'loop' B1 guard; both increment iteration once)"
  - "RUN-03 (chooseLoopBranch dispatches edge.label === 'выход' → loopContextStack.pop + advance along exit edge)"
  - "RUN-04 (nested loops — outer frame survives inner loop because B1 guard increments-in-place when inner-выход lands on outer; loopContextStack as natural nested-safe data structure)"
  - "RUN-05 (step-back from picker — undo entry pushed BEFORE frame push captures pre-loop state; existing stepBack() restores via spread copy; B2 fallback ensures canStepBack=true even on first-after-start loop)"
  - "RUN-06 (state-machine type widening — runnerStatus union extended in PersistedSession + getSerializableState + restoreFrom; round-trip integration test belongs to Plan 03)"

requirements-deferred:
  - "RUN-07 (no iteration cap — settings.maxLoopIterations + LoopStartNode.maxIterations field deletion + editor-panel cleanup) — owned by Plan 04 per phase plan map. Confirmed: ProtocolRunner.maxIterations (RUN-09 cycle guard, default 50) remains intact and untouched in this plan"

# Metrics
duration: ~7min
completed: 2026-04-17
---

# Phase 44 Plan 02a: Unified Loop Runtime Summary

**Replaced the Phase 43 `transitionToError` stub at `case 'loop'` with a real loop-entry sequence (B1 re-entry guard + B2 previousCursor undo threading), added public `chooseLoopBranch(edgeId)` dispatching by literal Cyrillic «выход», extracted `advanceOrReturnToLoop` helper for dead-end-inside-loop returns, widened all session-serialization signatures to include `'awaiting-loop-pick'`, deleted Phase 43 D-14 deprecated relics (`chooseLoopAction` stub + `loopIterationLabel` + `isAtLoopEnd`), and kept `ProtocolRunner.maxIterations` (RUN-09 cycle guard) untouched. Runtime satisfies RUN-01..RUN-05 at the pure-logic level; UI picker render belongs to Plan 03 and test rewrites belong to Plan 02b.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-17T13:15:00Z
- **Completed:** 2026-04-17T13:22:07Z
- **Tasks:** 2 / 2
- **Files modified:** 6 (3 production: runner-state.ts, session-model.ts, protocol-runner.ts; 2 test: protocol-runner.test.ts, protocol-runner-session.test.ts; 1 view: runner-view.ts — Rule 3 deferred fix)
- **Files created:** 0

## Accomplishments

### Task 1 — AwaitingLoopPickState + session union widening + Phase 43 deprecated field removal

- `src/runner/runner-state.ts`:
  - Deleted `AtNodeState.loopIterationLabel?: string` and `AtNodeState.isAtLoopEnd?: boolean` (both Phase 43 D-14 `@deprecated` placeholders + their JSDoc blocks)
  - Added new `AwaitingLoopPickState` interface mirroring `AwaitingSnippetPickState` shape: `status: 'awaiting-loop-pick'`, `nodeId: string`, `accumulatedText: string`, `canStepBack: boolean`
  - Extended `RunnerState` discriminated union — `| AwaitingLoopPickState` inserted between `AwaitingSnippetPickState` and `AwaitingSnippetFillState` so picker-variants stay adjacent
- `src/sessions/session-model.ts`:
  - Widened `PersistedSession.runnerStatus` literal union to append `| 'awaiting-loop-pick'`
  - Refreshed JSDoc text to list 'awaiting-loop-pick' among valid resume states

### Task 2 — Replace 'loop' stub with real runtime + chooseLoopBranch + dead-end helper + re-entry guard + previousCursor threading

**Step A (B2 + B1 fix in advanceThrough):**
- Added `let previousCursor: string | null = null;` at top of `advanceThrough` with documenting comment
- Added Step C cycle-guard reset comment above `let steps = 0;`
- Replaced the Phase 43 stub `case 'loop'` with:
  - **B1 re-entry guard:** `const top = this.loopContextStack[this.loopContextStack.length - 1]; if (top !== undefined && top.loopNodeId === cursor) { top.iteration += 1; ... }` — handles back-edge re-entry (e.g. `e5: n-a1 → n-loop`) AND inner-«выход» landing on outer loop node
  - **First-entry path:** undo-before-mutate push using B2 `previousCursor !== null ? previousCursor : cursor`, then `loopContextStack.push({ loopNodeId, iteration: 1, textBeforeLoop })`, halt at `awaiting-loop-pick`

**Step B (dead-end helper + 3-site refactor):**
- Added private `advanceOrReturnToLoop(next: string | undefined): 'continue' | 'halted'` immediately above `firstNeighbour`
- Refactored `case 'start'`, `case 'text-block'` (non-snippet branch), `case 'answer'` to call the helper + thread `previousCursor = cursor` before `cursor = next!`

**Step D (chooseLoopBranch public method):**
- Inserted immediately after `chooseSnippetBranch` (before `enterFreeText`)
- Validates `runnerStatus === 'awaiting-loop-pick'`, `graph !== null`, `currentNodeId !== null`, edge exists with `fromNodeId === currentNodeId`
- Pushes undo entry, then dispatches: `edge.label === 'выход'` → `loopContextStack.pop()`; otherwise → no iteration mutation (B1 guard owns it on re-entry)
- Calls `advanceThrough(edge.toNodeId)` to walk the chosen edge

**Step E (delete chooseLoopAction):**
- Deleted entire `chooseLoopAction(action: 'again' | 'done')` method + its JSDoc block (Phase 43 D-14, D-18 stub no longer needed)
- Refreshed `syncManualEdit` JSDoc reference from `chooseLoopAction` → `chooseLoopBranch`

**Step F + G (getState arms):**
- Cleaned `at-node` arm — removed `loopIterationLabel` + `isAtLoopEnd` properties + Phase 43 D-14 comment block
- Added `awaiting-loop-pick` arm between `awaiting-snippet-pick` and `awaiting-snippet-fill` returning `{ status, nodeId, accumulatedText, canStepBack }`

**Step H (session signature widening — three sites):**
- `getSerializableState()` return type `runnerStatus` literal: append `| 'awaiting-loop-pick'`
- `getSerializableState()` status gate: add 4th condition `&& this.runnerStatus !== 'awaiting-loop-pick'`
- `restoreFrom()` parameter type `runnerStatus` literal: append `| 'awaiting-loop-pick'`
- Deep-copy body of either method UNCHANGED (currentNodeId + accumulatedText + loopContextStack already carry picker state)

## Task Commits

1. **Task 1: Add AwaitingLoopPickState + widen session union, remove deprecated fields** — `2e46c77` (feat)
2. **Task 2: Replace 'loop' stub with real runtime + chooseLoopBranch + dead-end helper** — `b5668a0` (feat)

## Files Created/Modified

### Modified

- `src/runner/runner-state.ts` (+10 / -13 net) — AwaitingLoopPickState + RunnerState union; deleted loopIterationLabel + isAtLoopEnd
- `src/sessions/session-model.ts` (+2 / -2) — runnerStatus union widening
- `src/runner/protocol-runner.ts` (+126 / -47) — case 'loop' runtime, chooseLoopBranch, advanceOrReturnToLoop, B2 threading, getState arms, getSerializableState/restoreFrom widening, deleted chooseLoopAction
- `src/__tests__/runner/protocol-runner.test.ts` (+10 / -8) — Rule 3 cast deferral inside describe.skip
- `src/__tests__/runner/protocol-runner-session.test.ts` (+3 / -2) — Rule 3 cast deferral inside describe.skip
- `src/views/runner-view.ts` (+12 / 0) — Rule 3 minimal exhaustiveness arm

### Created

- None — Plan 02a is purely production-code edits + cascading deferred-fix patches.

## Verification Results

- `npx tsc --noEmit --skipLibCheck` — exit 0 (clean compile, all sites widened)
- `npm test -- --run` — 388 passed + 14 skipped + 3 todo / 0 failed (28 test files) — same baseline as Plan 01
- `npm run build` — exit 0 (production bundle generated; dev vault copy succeeded)
- `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "iteration cap"` — 2 passed (RUN-09 cycle guard intact)
- Grep targets:
  - `awaiting-loop-pick` in protocol-runner.ts: **11** (≥5 ✓ — getState arm, getSerializableState return type, status gate, restoreFrom param, case 'loop' first-entry halt + re-entry halt + comments)
  - `chooseLoopBranch` in protocol-runner.ts: **3** (≥1 ✓)
  - `chooseLoopAction` in protocol-runner.ts: **0** ✓ (stub deleted; doc reference refreshed)
  - `loopIterationLabel | isAtLoopEnd` in protocol-runner.ts: **0** ✓
  - `advanceOrReturnToLoop` in protocol-runner.ts: **4** (≥4 ✓ — declaration + 3 call sites)
  - `previousCursor` in protocol-runner.ts: **11** (≥5 ✓ — declaration + 3 threading sites + B2 use inside case 'loop' + comment refs)
  - `B1` marker in protocol-runner.ts: **9** (≥1 ✓ — re-entry guard comment + interaction notes)
  - `this.maxIterations` in protocol-runner.ts: **3** (≥3 ✓ — constructor assignment + cycle-guard comparison + error message; RUN-09 intact)
- `awaiting-loop-pick` in runner-state.ts: **1** (AwaitingLoopPickState.status literal)
- `awaiting-loop-pick` in session-model.ts: **2** (JSDoc list + runnerStatus union)
- `git diff --diff-filter=D --name-only HEAD~2 HEAD` — empty (no file deletions)

## Deviations from Plan

### Rule 3 — Deferred-plan compile fixes

The plan's verify clause requires `npx tsc --noEmit --skipLibCheck` exit 0 after Task 2. Removing `chooseLoopAction` from `protocol-runner.ts` and adding `AwaitingLoopPickState` to `RunnerState` cascades into compile errors at three places that subsequent plans (02b, 03) own:

**1. [Rule 3 - Blocking] `chooseLoopAction` references inside test `describe.skip` blocks**
- **Found during:** Task 2 verify (npx tsc reported 7 errors in protocol-runner.test.ts and protocol-runner-session.test.ts)
- **Issue:** Phase 43 preserved test bodies inside `describe.skip` blocks for Plan 02b reference. Deleting `chooseLoopAction` + `loopIterationLabel` + `isAtLoopEnd` broke TS compile of those bodies even though they don't run
- **Fix:** Replaced offending calls with `(runner as unknown as { chooseLoopAction(a: 'again' | 'done'): void }).chooseLoopAction(...)` casts and `(state as unknown as { loopIterationLabel?: string }).loopIterationLabel` field-access casts. Test bodies preserved verbatim. Plan 02b will rewrite these blocks against `unified-loop-valid.canvas`
- **Files modified:**
  - `src/__tests__/runner/protocol-runner.test.ts` (lines 479, 484, 491, 505, 506, 513, 520, 529, 533)
  - `src/__tests__/runner/protocol-runner-session.test.ts` (lines 344, 363)
- **Commit:** `b5668a0`

**2. [Rule 3 - Blocking] `runner-view.ts` exhaustiveness break**
- **Found during:** Task 2 verify (npx tsc reported `Type 'AwaitingLoopPickState' is not assignable to type 'never'` at runner-view.ts:491 — the `_exhaustive: never = state` assertion)
- **Issue:** Adding `AwaitingLoopPickState` to `RunnerState` triggered the discriminated-union exhaustiveness check in the render switch. Plan 03 owns the real picker UI; Plan 02a needed a minimal stub to keep TS compile green
- **Fix:** Added `case 'awaiting-loop-pick'` arm before the `default:` block with a placeholder paragraph text 'Loop picker (Phase 44 Plan 03 will render this).' + `renderPreviewZone` + `renderOutputToolbar` calls (so the user sees accumulated text + output toolbar even at this intermediate state). CLAUDE.md never-delete rule honoured — only added
- **Files modified:** `src/views/runner-view.ts` (+12 / 0)
- **Commit:** `b5668a0`

These are textbook Rule 3 fixes (blocking issue preventing task completion) — the cascade is a direct consequence of the runner-state union extension Task 1 introduced, and the plan's explicit Step E note ("Plan 02b depends on 02a so the delete-order is correct (delete here, rewrite tests there)") acknowledged the test cascade was expected.

### Auto-fixed Issues

None — no Rule 1 (bugs) or Rule 2 (missing critical functionality) deviations occurred. The runtime executes exactly as the plan prescribed.

### Architectural Decisions

None — no Rule 4 (architectural change) checkpoints needed.

### Auth Gates

None — fully autonomous execution.

## Handoff Notes

### For Plan 02b (test rewrites)

1. **Runtime is live and TS-clean** — every `chooseLoopBranch`, `advanceOrReturnToLoop`, `case 'loop'` path is callable from Vitest tests
2. **Replace cast-deferred describe.skip bodies** at:
   - `src/__tests__/runner/protocol-runner.test.ts:458` — `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)')` — 5 tests + helper. Cast deferrals at lines 479, 484, 491, 505, 506, 513, 520, 529, 533 should be removed when test bodies are rewritten
   - `src/__tests__/runner/protocol-runner-session.test.ts:336` — `describe.skip('Loop context stack survives session round-trip (SESSION-05)')` — 1 test. Cast deferrals at lines 344, 363
3. **Fixtures ready:** `unified-loop-valid.canvas` (Phase 43) and `unified-loop-nested.canvas` (Plan 01)
4. **Runtime contract for tests:**
   - `runner.start(loadGraph('unified-loop-valid.canvas'))` → `runner.getState().status === 'awaiting-loop-pick'` and `state.nodeId === 'n-loop'` (RUN-01)
   - After `chooseLoopBranch('e2')` walks to `n-q1`, `chooseAnswer('n-a1')` → back-edge `e5` re-enters n-loop → B1 guard increments → `loopContextStack[0].iteration === 2` AND `loopContextStack.length === 1` (RUN-02 + I1 strengthened assertion)
   - `chooseLoopBranch('e3')` (the «выход» edge) → `loopContextStack.length === 0` and state transitions to `'complete'` (RUN-03)
   - On nested fixture, inner «выход» (e5: `n-inner → n-outer`) → frame popped + B1 guard fires on outer + state remains `awaiting-loop-pick` with `nodeId === 'n-outer'` AND `loopContextStack.length === 1` (RUN-04)
   - Step-back from first picker after `runner.start(unified-loop-valid)` is enabled (`canStepBack === true`) — B2 fallback push with `nodeId=loopNode` (RUN-05)
   - `getSerializableState()` at `awaiting-loop-pick` returns non-null with `runnerStatus === 'awaiting-loop-pick'` (RUN-06 round-trip half)
5. **W4 long-body integration:** add a fixture/test pairing 10 text-blocks × 10 iterations ≈ 110 nodes-per-call to confirm `ProtocolRunner.maxIterations=50` cap does NOT trip in realistic loop bodies (per-call counter resets between picker halts)

### For Plan 03 (RunnerView picker UI)

1. **Replace the placeholder exhaustiveness arm** at `src/views/runner-view.ts:489-499` (the `case 'awaiting-loop-pick':` block added by this plan as a Rule 3 stub) with the real picker render
2. **Pattern:** `state.nodeId` lookup against `graph.edges.filter(e => e.fromNodeId === state.nodeId)` — every outgoing edge becomes a button, dispatch via `runner.chooseLoopBranch(edge.id)`. Mirror `awaiting-snippet-pick` arm shape (lines 434-450) for halt-state skeleton + button-per-neighbour render pattern from `at-node` question arm
3. **Header:** render `LoopNode.headerText` above picker if non-empty (the loop's editable header)
4. **Step-back button:** copy from `case 'at-node'` arm — `state.canStepBack` gate, click handler does `runner.stepBack() + autoSaveSession() + render()`
5. **Click handler:** `syncManualEdit(preview.value ?? '') + chooseLoopBranch(edge.id) + autoSaveSession() + renderAsync()` — Pattern 3 (BUG-01 + autosave fire-and-forget)
6. **CSS:** new classes go in `src/styles/loop-support.css` under a `/* Phase 44: Unified loop picker (RUN-01) */` marker (CLAUDE.md append-only). Phase 6 block above stays untouched

### For Plan 04 (RUN-07 — maxIterations excision)

`ProtocolRunner.maxIterations` (constructor option, default 50, RUN-09 cycle guard) is INTACT and untouched. Plan 04 ONLY removes:
- `RadiProtocolSettings.maxLoopIterations` field (settings.ts)
- `DEFAULT_SETTINGS.maxLoopIterations` (settings.ts)
- "Max loop iterations" Setting in display() (settings-tab)
- D-10 test (settings-tab.test.ts)
- `LoopStartNode.maxIterations` field (graph-model.ts)
- editor-panel `case 'loop-start'`/`case 'loop-end'` form arms (editor-panel-view.ts)

Do NOT touch `ProtocolRunner.maxIterations` — it is a different field, the per-call auto-advance cycle guard.

## Known Stubs

- `src/views/runner-view.ts` `case 'awaiting-loop-pick'` arm renders only a placeholder paragraph + accumulated text + output toolbar. This is intentional and explicitly handed off to Plan 03 (RunnerView picker UI) — the goal of Plan 02a is the state-machine half. Without this stub, TS exhaustiveness breaks compile.

## Threat Flags

None — no new network surface, auth path, file access pattern, or schema change at trust boundaries. State-machine refactor strictly internal.

## Self-Check: PASSED

- ✅ FOUND: `src/runner/runner-state.ts` (modified — added AwaitingLoopPickState, deleted deprecated fields)
- ✅ FOUND: `src/sessions/session-model.ts` (modified — widened runnerStatus union)
- ✅ FOUND: `src/runner/protocol-runner.ts` (modified — full Task 2 runtime)
- ✅ FOUND: `src/__tests__/runner/protocol-runner.test.ts` (modified — Rule 3 deferral)
- ✅ FOUND: `src/__tests__/runner/protocol-runner-session.test.ts` (modified — Rule 3 deferral)
- ✅ FOUND: `src/views/runner-view.ts` (modified — Rule 3 stub exhaustiveness arm)
- ✅ FOUND commit: `2e46c77` — `feat(44-02a): add AwaitingLoopPickState + widen session union, remove deprecated fields`
- ✅ FOUND commit: `b5668a0` — `feat(44-02a): replace 'loop' stub with real runtime + chooseLoopBranch + dead-end helper`
