---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
plan: 04
subsystem: runner-state + protocol-runner + runner-view
tags: [typescript, discriminated-union, runner-state-machine, deprecation-stub, dead-code-removal]

# Dependency graph
requires:
  - phase: 43-01
    provides: RPNodeKind union with 'loop' + legacy kinds retained; LoopNode interface; LoopContext.loopNodeId rename
  - phase: 43-03
    provides: PersistedLoopContext.loopNodeId aligned runtime-side; no shape drift between session and runtime layers
provides:
  - ProtocolRunner.advanceThrough unified loop stub — 'loop' case transitionToError (Phase 44 soft-stub)
  - ProtocolRunner.advanceThrough legacy merged fall-through — 'loop-start'/'loop-end' case transitionToError (defensive — validator should have rejected canvas)
  - ProtocolRunner.chooseLoopAction — @deprecated stub retained for .skip test compile (D-18 Surprise #2)
  - ProtocolRunner.getSerializableState / restoreFrom — inline LoopContext shape migrated to loopNodeId
  - AtNodeState.loopIterationLabel / isAtLoopEnd — @deprecated (compile-compat only; always undefined in Phase 43)
  - RunnerView switch(node.kind) — case 'loop-end' removed (Surprise #1); CSS classes preserved in loop-support.css for Phase 45
affects:
  - 43-05 (graph-validator — orthogonal; uses ProtocolGraph, still has its own tsc errors to resolve in nodeLabel switch + Check 6 removal)
  - 43-06 (runner-view error-panel rendering unchanged; MIGRATE-02 string display pipeline intact)
  - 43-07 (session-service.test.ts + protocol-runner.test.ts + protocol-runner-session.test.ts updates — inline loopStartId literals + it.skip markers on loop-runner-tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deprecated-but-retained method stub: `chooseLoopAction` kept as public no-op with `void action` + `transitionToError` body to preserve compile-compat for `.skip`-ed tests that still reference it (Surprise #2 from PATTERNS.md)"
    - "Merged fall-through legacy switch cases: `case 'loop-start': case 'loop-end': { ... }` with separate programmer-error message distinct from unified loop stub — TypeScript exhaustiveness forces both to remain, but semantically they should never reach runtime (validator gate upstream)"
    - "Soft stub via `transitionToError` chosen over `throw new Error` (D-CL-04 option b): runner sets error-state, RunnerView renders error panel via existing pipeline, no uncaught throw leaks into UI"
    - "Dead-code removal in UI discriminated switch: `case 'loop-end'` removed outright; fall-through to `default` with 'Processing...' is safe because runner transitionToErrors before reaching render"

key-files:
  created: []
  modified:
    - src/runner/runner-state.ts — AtNodeState.loopIterationLabel and .isAtLoopEnd annotated @deprecated Phase 43 D-14 (fields preserved for .skip test compile)
    - src/runner/protocol-runner.ts — advanceThrough case 'loop' + merged case 'loop-start'/'loop-end' stubs; chooseLoopAction converted to @deprecated no-op; getState() 'at-node' simplified; inline LoopContext literals in getSerializableState/restoreFrom signatures renamed loopStartId → loopNodeId
    - src/views/runner-view.ts — case 'loop-end' block removed entirely (Surprise #1); Phase 43 D-14 marker comment added

key-decisions:
  - "D-CL-04 option (b) chosen: `transitionToError` soft-stub instead of `throw new Error` — keeps runner in error-state (caught by existing RunnerView error panel render pipeline), zero new UI code, no uncaught exception leak"
  - "D-CL-05 reaffirmed: legacy kinds retained in RPNodeKind union (Plan 01 D-CL-05 variant b) forced exhaustiveness in `advanceThrough` switch to preserve separate arms for 'loop-start'/'loop-end'. Merged fall-through with single body keeps message distinct from unified 'loop' arm — different failure modes get different user-visible errors"
  - "chooseLoopAction preserved as stub (D-18 / Surprise #2 realization): .skip-ed tests in protocol-runner.test.ts (lines 467, 479, 505, 521, 525) and protocol-runner-session.test.ts (line 320) still compile their bodies against the class shape. Deleting the method would break compile; converting to no-op stub is the minimum viable surgery"
  - "getState() 'at-node' label assembly collapsed to `loopIterationLabel: undefined` rather than attempting to read `LoopNode.headerText`. Phase 44 (RUN-01..RUN-07) owns the full label format — Phase 43 does the minimum required to keep compile green"
  - "Inline type literals in getSerializableState / restoreFrom method signatures migrated loopStartId → loopNodeId. These were compile-blocking: runner-view.ts restoreFrom call-site (line 138) and autoSaveSession call-site (line 764) passed PersistedLoopContext / expected-PersistedLoopContext shapes that would not unify with old inline literals. Inline literals match Plan 01/03 LoopContext/PersistedLoopContext shape now"

patterns-established:
  - "Phase-marker comments: every new/modified block carries `// Phase 43 D-14` or `@deprecated Phase 43 D-14[, D-18]` marker. Phase 29 D-01/D-02 markers on TextBlockNode normalization, Phase 31 D-04/D-08 markers on chooseSnippetBranch/resolveSeparator, Phase 30 markers on pickSnippet/awaiting-snippet-pick — all untouched per CLAUDE.md"
  - "CLAUDE.md never-remove respected: `syncManualEdit`, `chooseSnippetBranch`, `pickSnippet`, `completeSnippet`, `stepBack`, `setGraph`, `restoreFrom`, `getSerializableState`, `enterFreeText`, `chooseAnswer`, `start`, `resolveSeparator`, `advanceThrough` non-loop cases, `firstNeighbour`, `edgeByLabel`, `transitionToComplete`, `transitionToError` — all untouched. Only loop-specific surgery applied"
  - "runner-view: `case 'question'`, `case 'free-text-input'`, `default`, `stepBackBtn` creation, `chooseSnippetBranch`/`pickSnippet` flow, error panel render, `autoSaveSession`, `renderAsync`, `registerDomEvent` — all untouched. CSS `rp-loop-btn-row`, `rp-loop-again-btn`, `rp-loop-done-btn`, `rp-loop-iteration-label` in loop-support.css preserved for Phase 45 picker UI"

requirements-completed:
  - LOOP-01

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 43 Plan 04: Runner + View Stub for Unified Loop Summary

**Three files surgically updated to close TypeScript compile gaps introduced by the unified `LoopNode` model: `runner-state.ts` marks the two loop-related `AtNodeState` fields `@deprecated Phase 43 D-14` (preserved for `.skip`-test compile-compat); `protocol-runner.ts` gets a unified `case 'loop'` soft-stub plus a merged legacy `case 'loop-start'/case 'loop-end'` defensive stub in `advanceThrough`, a `@deprecated` no-op body for `chooseLoopAction` (D-18 Surprise #2), a simplified `getState()` `'at-node'` branch, and `loopStartId → loopNodeId` rename in inline `LoopContext` type literals; `runner-view.ts` loses the entire `case 'loop-end'` switch-arm (Surprise #1, ~43 lines) — CSS classes and all other switch arms preserved.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T09:39:45Z
- **Completed:** 2026-04-17T09:44:37Z
- **Tasks:** 3 / 3
- **Files modified:** 3

## Accomplishments

- **Task 1 (runner-state.ts):** `AtNodeState.loopIterationLabel` and `AtNodeState.isAtLoopEnd` annotated with `@deprecated Phase 43 D-14` JSDoc. Fields kept as `undefined`-only for Phase 43 so `.skip`-ed tests that reference `state.loopIterationLabel` / `state.isAtLoopEnd` continue to compile. `IdleState`, `AwaitingSnippetPickState`, `AwaitingSnippetFillState`, `CompleteState`, `ErrorState`, `RunnerState` union, `UndoEntry` (Phase 31 D-08 marker intact) — all untouched.
- **Task 2 (protocol-runner.ts):** Five coordinated changes in one commit:
  1. `advanceThrough` switch: replaced `case 'loop-start'` (push frame, follow continue edge) and `case 'loop-end'` (halt for LOOP-02 prompt) with two new arms — new `case 'loop':` with soft `transitionToError('Loop runtime ещё не реализован (запланировано в Phase 44 — см. ROADMAP v1.7).')`; merged fall-through `case 'loop-start': case 'loop-end': { ... }` with distinct programmer-error message noting validator should have rejected the canvas upstream.
  2. `chooseLoopAction` method: body replaced with `void action;` + `transitionToError('chooseLoopAction устарел (Phase 43 D-18). Loop runtime реализуется в Phase 44.');`. Signature `chooseLoopAction(action: 'again' | 'done'): void` preserved for Surprise #2 (`.skip` tests in `protocol-runner.test.ts:467,479,505,521,525` and `protocol-runner-session.test.ts:320` still type-check).
  3. `getState()` `'at-node'` branch: removed reads of `topFrame.loopStartId`, `loopStartNode.loopLabel`, and `(this.currentNodeId...)?.kind === 'loop-end'`. Simplified to `const loopIterationLabel: string | undefined = undefined;` and `isAtLoopEnd: undefined`. Phase 44 will reconstruct a full label over `LoopNode.headerText`.
  4. `getSerializableState` return-type and `restoreFrom` parameter-type: inline `LoopContext`-shaped literals renamed `loopStartId: string` → `loopNodeId: string` on two method signatures (four total type-literal occurrences). This closes compile errors on lines 446, 452, 495, 501 from the pre-Plan-04 baseline `tsc` output.
  5. All other public methods (`syncManualEdit`, `chooseSnippetBranch`, `pickSnippet`, `completeSnippet`, `stepBack`, `setGraph`, `restoreFrom` method body, `enterFreeText`, `chooseAnswer`, `start`) — untouched. Private helpers `firstNeighbour`, `edgeByLabel`, `resolveSeparator`, `transitionToComplete`, `transitionToError` — untouched. `ProtocolRunnerOptions.maxIterations` (auto-advance cap, NOT loop-specific) — untouched.
- **Task 3 (runner-view.ts):** Entire `case 'loop-end'` block (lines 402-444, ~43 lines) deleted. It referenced removed fields (`node.loopStartId`, `matchingStart.loopLabel`, `matchingStart.exitLabel`) and the now-deprecated `chooseLoopAction`; TypeScript compile-error without removal (Surprise #1 per PATTERNS.md). Replacement: single four-line Phase 43 D-14 marker comment at the deletion site. `case 'question'`, `case 'free-text-input'`, `default`, `stepBackBtn` creation logic — all untouched. CSS file `src/styles/loop-support.css` — `git diff --quiet` returns clean (zero changes; CSS classes preserved for Phase 45 picker restoration per Surprise #5).
- **Plan-level TypeScript check:** `npx tsc --noEmit --skipLibCheck` emits zero errors in any of the three files modified by this plan. Only four remaining errors in the whole project: three in `src/__tests__/session-service.test.ts` (inline `loopStartId:` literals — Plan 07 D-18 scope) and one in `src/graph/graph-validator.ts` (`nodeLabel()` lacks return for `'loop'` — Plan 05 D-11 scope). Plan 04's own success criteria (plan-file lines 493-501) met in full.

## Task Commits

1. **Task 1: Mark AtNodeState loop-related fields `@deprecated` (Phase 43 D-14)** — `002a4c2` (refactor)
2. **Task 2: Stub unified loop runtime + deprecate `chooseLoopAction` (Phase 43 D-14)** — `ad60eb3` (refactor)
3. **Task 3: Remove `case 'loop-end'` switch-arm from RunnerView (Phase 43 D-14)** — `4cb24af` (refactor)

## Files Created/Modified

- `src/runner/runner-state.ts` — `+8, -2` lines. Two JSDoc blocks added above `loopIterationLabel` and `isAtLoopEnd` in `AtNodeState`; fields themselves preserved verbatim. All other interfaces (`IdleState`, `AwaitingSnippetPickState`, `AwaitingSnippetFillState`, `CompleteState`, `ErrorState`, `RunnerState` union, `UndoEntry` with Phase 31 D-08 marker) untouched.
- `src/runner/protocol-runner.ts` — `+33, -88` lines (net `-55`). Most of the deletion comes from removing the ~50-line `chooseLoopAction` body (replaced with 4-line stub) and the two loop switch arms in `advanceThrough` (replaced with two shorter arms). Inline type-literal rename `loopStartId → loopNodeId` edited in 4 spots via `replace_all`. All non-loop-surgery areas (public/private methods listed above) untouched.
- `src/views/runner-view.ts` — `+3, -43` lines (net `-40`). `case 'loop-end'` block deleted; one 4-line marker comment inserted. All other switch arms, stepBack button, snippet-picker flow, error panel render, autoSave, lifecycle hooks — untouched. `src/styles/loop-support.css` verified untouched via `git diff --quiet`.

## Decisions Made

- **D-CL-04 option (b) — `transitionToError` soft-stub over `throw new Error`:** Chosen because (a) runner's private `transitionToError` helper already exists and sets `runnerStatus = 'error' + errorMessage`, (b) the existing RunnerView error-panel render pipeline handles `ErrorState` without new code, (c) no uncaught exception can leak to Obsidian workspace event loop (hard-to-diagnose for users), (d) lets users step-back out of the error if they accidentally loaded a legacy canvas (error-state `canStepBack` honours `undoStack` contents). Option (a) `throw` would have meant surrounding `advanceThrough` callers with try/catch in unrelated places — significantly larger scope than "minimal surgery".
- **D-CL-05 variant (b) ripple — merged fall-through legacy stub:** Plan 01 kept `LoopStartNode` / `LoopEndNode` in the `RPNodeKind` union with `@deprecated` markers. `advanceThrough`'s exhaustive switch therefore *requires* arms for `'loop-start'` and `'loop-end'`. Merged fall-through `case 'loop-start': case 'loop-end': { ... }` satisfies exhaustiveness with minimal lines; distinct error message from the unified `'loop'` arm makes user-visible semantics clear: "loop" = "not implemented yet, Phase 44", whereas "loop-start/loop-end" = "programmer error, validator should have caught this". Collapsing all three into one arm was tempting but would have lost the diagnostic distinction.
- **D-18 Surprise #2 resolution — `chooseLoopAction` kept as no-op stub (not deleted):** PATTERNS.md flagged that `.skip`-ed tests still compile. Deleting the method would have triggered compile errors in `protocol-runner.test.ts:467..525` and `protocol-runner-session.test.ts:320` (plan 07 marks these `.skip`, but `.skip` runs type-checking). Converting body to `void action; transitionToError(...)` is the minimal surgery that keeps test files compiling. JSDoc documents the temporary nature, and plan 07 (D-18) will mark the test blocks `.skip` so runtime never executes them.
- **Inline `LoopContext` type literals migrated:** `getSerializableState`'s return type and `restoreFrom`'s parameter type declare `LoopContext`-shaped inline object literals, not `LoopContext` directly. Plan 01 renamed `LoopContext.loopStartId` → `loopNodeId` but left these inline literals untouched (they were not directly `LoopContext`). Task 2 migrated them in lock-step with the assignment sites (`this.loopContextStack.map(f => ({ ...f }))` — the spread produces an object with whatever field names the source has). This closes the 4 compile errors on lines 446, 452, 495, 501 from the baseline `tsc` run.
- **runner-view.ts — `case 'loop-end'` removed, no `case 'loop'` added:** PATTERNS.md explicitly recommended this. Rationale: (a) runner's `advanceThrough` transitionToErrors before reaching render, so `RunnerView.render()` never sees `at-node` with a `'loop'` `node.kind`; the switch falls through to `default` "Processing..." safely if it ever did. (b) Adding `case 'loop'` placeholder would have introduced dead UI code for Phase 45 to redesign. (c) Phase 43 CONTEXT.md's "views не меняется" hint was about the error-panel at the top of `render()`, not the mid-function discriminated switch — PATTERNS.md Surprise #1 disambiguated this correctly.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were required beyond what the plan explicitly anticipated:

- **Plan Task 2 already anticipated the inline-literal rename** in `getSerializableState` / `restoreFrom` signatures: the action text said "Любые остальные use-sites `.loopStartId` — обновить на `.loopNodeId`". The 4 inline-type-literal occurrences on lines 429, 430, 486, 487 (pre-edit) were part of this umbrella instruction. They became compile-blocking errors after Task 2's `this.loopContextStack` rename and had to be fixed in the same commit.
- **Plan acceptance criterion "npm run build → exit 0":** The full `npm run build` still fails because `tsc -noEmit` runs project-wide and catches 4 errors outside Plan 04's scope — 3 in `session-service.test.ts` (Plan 07 D-18 scope) and 1 in `graph-validator.ts` (Plan 05 D-11 scope). The objective explicitly scoped Plan 04 to `runner-state/protocol-runner/runner-view` only ("remaining errors are expected in graph-validator until plan 43-05"). Plan 04 files compile clean individually. This is consistent with how Plan 01 reported 23 downstream errors outside its scope, Plan 02 reported residual validator errors, and Plan 03 reported residual test-file errors — each plan closes its own surface while the discriminated-union exhaustiveness scavenger-hunt propagates forward.

## Issues Encountered

- Three `PreToolUse:Edit` read-before-edit reminders fired during task execution (one per file), even though each file was read as part of the initial context load. All three `Edit` operations applied successfully and verification passed — matches the non-blocking behaviour documented in Plans 02 and 03 summaries.
- `npm run build` (project-wide) fails by design: `tsc -noEmit` front-halfof the build catches Plan 05/07 errors. `esbuild` back-half would succeed if tsc were isolated to Plan 04 files. Per objective, this is expected; Plan 05 + Plan 07 will progressively drain the error list.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `src/runner/runner-state.ts` — shape stable for Phase 44. `loopIterationLabel` and `isAtLoopEnd` fields can be repurposed (or replaced with explicit picker-state fields) without breaking compile-compat with preserved `.skip` tests, because Plan 07 will rewrite those test bodies entirely.
- `src/runner/protocol-runner.ts` — `chooseLoopAction` stub and `advanceThrough` `case 'loop'` stub are the primary Phase 44 touchpoints. `edgeByLabel` helper retained for Phase 44's exit-edge resolution. `loopContextStack: LoopContext[]` runtime field shape is aligned with `LoopContext.loopNodeId` (Plan 01) and `PersistedLoopContext.loopNodeId` (Plan 03) — no further shape drift to resolve.
- `src/views/runner-view.ts` — `case 'question'`, `case 'free-text-input'`, and `default` are intact. Phase 44 (RUN-01) will add a new `case 'loop'` with the unified picker UI using the preserved CSS classes in `src/styles/loop-support.css`.
- Remaining wave-2/3 TypeScript errors: exactly 4, all in plan-05 or plan-07 scope. No new errors introduced by Plan 04.
- No blockers: Plan 05 (graph-validator — Migration Check + LOOP-04 sub-checks + nodeLabel update) can now proceed, followed by Plan 06 (fixtures) and Plan 07 (test updates + Surprise #7 cleanup).

## Self-Check: PASSED

**Files verified exist:**
- FOUND: `src/runner/runner-state.ts`
- FOUND: `src/runner/protocol-runner.ts`
- FOUND: `src/views/runner-view.ts`
- FOUND: `src/styles/loop-support.css` (untouched, `git diff --quiet` returned 0)

**Commits verified:**
- FOUND: `002a4c2` (refactor(43-04): mark AtNodeState loop-related fields @deprecated)
- FOUND: `ad60eb3` (refactor(43-04): stub unified loop runtime + deprecate chooseLoopAction)
- FOUND: `4cb24af` (refactor(43-04): remove case 'loop-end' switch-arm from RunnerView)

**Acceptance criteria verified:**

Task 1:
- `grep -B3 "loopIterationLabel?: string" runner-state.ts` shows `@deprecated Phase 43 D-14` → PASS
- `grep -B3 "isAtLoopEnd?: boolean" runner-state.ts` shows `@deprecated Phase 43 D-14` → PASS
- `grep -q "export interface IdleState" runner-state.ts` → PASS
- `grep -q "export interface AwaitingSnippetFillState" runner-state.ts` → PASS
- `grep -q "export interface UndoEntry" runner-state.ts` → PASS
- `grep -q "Phase 31 D-08" runner-state.ts` → PASS
- `tsc --noEmit --skipLibCheck` emits 0 errors mentioning `runner-state.ts` → PASS

Task 2:
- `grep -n "case 'loop':" protocol-runner.ts` → line 558 (PASS)
- `grep -n "case 'loop-start':" + "case 'loop-end':"` → adjacent lines 564, 565 (fall-through — PASS)
- `case 'loop':` body contains `Phase 44` literal → PASS
- Merged fall-through body contains `устаревш` literal → PASS
- `grep -q "chooseLoopAction(action: 'again' | 'done'): void"` → PASS (signature preserved)
- `grep -q "@deprecated Phase 43 D-14, D-18"` → PASS
- `grep "\.loopStartId" protocol-runner.ts` → 0 matches (PASS)
- `grep -qE "_exhaustive: never|assertNever|default:"` → PASS (both `default:` and `_exhaustive: never` present)
- `grep -q "syncManualEdit\|chooseSnippetBranch\|pickSnippet\|completeSnippet\|stepBack\|setGraph\|getSerializableState"` aggregated → 27 matches (PASS — well above the 7-method baseline)
- `tsc --noEmit --skipLibCheck` emits 0 errors mentioning `protocol-runner.ts` → PASS

Task 3:
- `! grep "case 'loop-end':" runner-view.ts` → PASS (0 matches)
- `! grep "matchingStart\.loopLabel\|matchingStart\.exitLabel\|node\.loopStartId\|chooseLoopAction" runner-view.ts` → PASS (0 matches)
- `grep -q "case 'question':"` → PASS
- `grep -q "case 'free-text-input':"` → PASS
- `grep -q "default:"` → PASS (two `default:` occurrences at lines 406 and 489)
- `git diff --quiet src/styles/loop-support.css` → PASS (exit 0 — CSS untouched)
- `grep -q "Phase 43 D-14" runner-view.ts` → PASS

**Plan-level criteria:**
- Three task commits (one per file) — PASS
- No file deletions in any commit (`git diff --diff-filter=D HEAD~3 HEAD` returned empty) — PASS
- Plan 04 source files compile clean (`npx tsc --noEmit --skipLibCheck` → 0 errors mentioning runner-state/protocol-runner/runner-view) — PASS
- Remaining project tsc errors (3 in session-service.test.ts for Plan 07, 1 in graph-validator.ts for Plan 05) are scoped out of Plan 04 — PASS (matches plan's objective statement: "remaining errors are expected in graph-validator until plan 43-05")

---
*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Completed: 2026-04-17*
