---
phase: 47-runner-regressions
plan: 02
subsystem: runner-view
tags: [runner-view, textarea-scroll, capture-before-advance, requestAnimationFrame, RUNFIX-02, TDD]

# Dependency graph
requires:
  - phase: v1.2
    provides: BUG-01 capture-before-advance pattern (syncManualEdit as FIRST-line call in each choice-click handler — same call-sites reused by this plan)
  - phase: 47-01
    provides: awaiting-loop-pick already flows through syncManualEdit gate, so the loop click handler at line 490 is a valid capture site for scroll preservation as well
provides:
  - Manual scroll position of the Runner preview textarea is preserved through every choice-click re-render (answer, snippet-branch, loop-body, loop-exit, snippet-picker row)
  - New private helper `capturePendingTextareaScroll()` and private field `pendingTextareaScrollTop: number | null` on RunnerView
  - `renderPreviewZone`'s rAF callback restores the captured scrollTop onto the fresh textarea after the height recompute, then clears the pending field (consume-once contract)
  - 5 new RUNFIX-02 regression tests in `RunnerView.test.ts` driving renderPreviewZone against a fake zone fixture (node environment — no jsdom)
affects: [phase 47-03 which will only touch CSS, future runner UX work that inserts new choice-button handlers must remember to call `capturePendingTextareaScroll()` first]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pending-scroll handoff: capture scrollTop on the OLD textarea into a private field before render() nulls it; restore on the NEW textarea inside the existing rAF callback (after height recompute so scrollTop is no longer a no-op on an auto-sized element)."
    - "Consume-once discipline: the restore branch clears pendingTextareaScrollTop = null so a stale value cannot leak into a later unrelated render (guarded by Test 4 in the regression suite)."

key-files:
  created:
    - ".planning/phases/47-runner-regressions/47-02-SUMMARY.md"
  modified:
    - "src/views/runner-view.ts (+31/-0 — additive only: 1 new field + JSDoc, 1 new helper method, 1 restore block in renderPreviewZone's rAF, 4 capture-call-site inserts)"
    - "src/__tests__/RunnerView.test.ts (+184/-1 — new 5-test RUNFIX-02 describe block + makePartialView fixture + rAF polyfill; pre-existing UI-01/UI-02/UI-07/UI-12 tests untouched)"

key-decisions:
  - "Capture on the OLD textarea, not on the NEW one: renderAsync → render → renderPreviewZone rebuilds the <textarea> as a fresh DOM element with scrollTop=0. The only place to read the pre-click scroll is BEFORE renderAsync runs — so the capture is stashed on `this`, not on a local var in the handler."
  - "Consume inside the existing rAF, not in a second one: scrollTop must be written AFTER the height recompute (otherwise the element is still auto-sized and scrollTop is a no-op). Appending the restore block inside the existing requestAnimationFrame callback keeps the render-pipeline cadence unchanged."
  - "Verbatim scrollTop, no clamping: the user todo accepts either preserving the previous scroll OR advancing to the insertion point. Preserving verbatim is the simpler option that subsumes 'never jump to the top'. Native browser behaviour will clamp scrollTop to the new content height if the accumulator shrank, which is fine — the regression guard is 'never resets to 0 when the content is tall enough to scroll'."
  - "Include the snippet-picker row click (handleSnippetPickerSelection at line 687) in the capture set — the plan's line-675-area hint. That handler runs in the `awaiting-snippet-pick` state where the preview textarea is rendered with accumulatedText (see render() case 'awaiting-snippet-pick' line 440-458), so previewTextarea is non-null and a long accumulator can be scrolled. Skipping it would have reintroduced the regression on the snippet picker path."
  - "No edits to runner.ts, no edits to any CSS file, no edits to src/main.ts or other shared files — the entire fix fits inside runner-view.ts + its test. Matches the plan's acceptance criterion 'no edits to src/runner/protocol-runner.ts (47-01's territory) or src/styles/*.css (47-03's territory)'."

patterns-established:
  - "Pending-field handoff across a React-style re-render: when a child DOM element is destroyed and rebuilt by the render pipeline, state that must survive the rebuild lives on `this` (the view instance) with a clear consume-once contract. Same pattern as React refs but without React."
  - "Driving a private method with DOM-element dependencies in a node-environment vitest: `Object.create(prototype)` to bypass the constructor, stub `registerDomEvent` to a noop, pass a fake zone whose createEl returns a mutable object with the minimum field surface the method touches. Synchronous rAF polyfill in beforeEach tears down in afterEach to keep other suites clean."

requirements-completed: [RUNFIX-02]

# Metrics
duration: ~12min
completed: 2026-04-18
---

# Phase 47 Plan 02: Choice-Click Scroll Preservation Summary

**Closed RUNFIX-02 by stashing the Runner preview textarea's scrollTop on RunnerView immediately before each choice-click triggers a re-render, then restoring it onto the fresh textarea inside renderPreviewZone's existing requestAnimationFrame callback — the scroll position now survives every choice-button click (answer, snippet-branch, loop-body, loop-exit, snippet-picker row) instead of snapping to the top.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-18T23:01:00Z
- **Completed:** 2026-04-18T23:13:00Z
- **Tasks:** 1/1 (single TDD task with RED → GREEN phases)
- **Files modified:** 2 (runner-view.ts +31, RunnerView.test.ts +184)
- **Tests added:** 5 (all RUNFIX-02 regression cases in RunnerView.test.ts)

## Accomplishments

- Closed RUNFIX-02: clicking a choice button in the Runner no longer jumps the preview textarea back to `scrollTop=0`. The pre-click scroll position is captured on the old textarea, carried through the render-triggered rebuild via a single private field, and written onto the new textarea once the height has been recomputed.
- Wired the capture call into all 4 choice-click sites identified by the plan:
  1. Answer button (`.rp-answer-btn`, line 378)
  2. Snippet-branch button (`.rp-snippet-branch-btn`, line 399)
  3. Loop body/exit button (`.rp-loop-body-btn` / `.rp-loop-exit-btn`, line 490 — both share the handler)
  4. Snippet-picker row (`handleSnippetPickerSelection`, line 687 — the line-675-area site in the plan)
- Added 5 RUNFIX-02 regression tests to `RunnerView.test.ts` covering field initial state, helper behaviour, rAF restore + consume-once, no-leak guard, and an end-to-end capture → re-render → restore flow.
- Preserved every pre-existing BUG-01 `syncManualEdit(this.previewTextarea?.value ?? '')` call verbatim (grep count: 4 before, 4 after — identical).
- Full vitest suite stays green: 428 passed / 1 skipped (previously 423; +5 new RUNFIX-02 tests, zero regressions).
- Full TypeScript typecheck green (`npx tsc --noEmit --skipLibCheck` exits 0); production build (`npm run build`) green.

## Task Commits

Each phase of the single TDD task was committed atomically:

1. **Task 1 RED: RUNFIX-02 regression tests** — `126ee08` (test)
2. **Task 1 GREEN: pendingTextareaScrollTop + capture + restore** — `325f39d` (fix)

**Plan metadata:** _to be captured in the final docs commit (this summary + STATE.md + ROADMAP.md)._

## Files Created/Modified

- `src/views/runner-view.ts` — 3 additive sections:
  - Lines 24-32: `pendingTextareaScrollTop: number | null = null` private field + JSDoc explaining the consume-once contract and the "survives render()" invariant.
  - Lines 810-813: `capturePendingTextareaScroll()` private helper. One-liner: `this.pendingTextareaScrollTop = this.previewTextarea?.scrollTop ?? null;`
  - Lines 828-833: restore block appended inside `renderPreviewZone`'s existing rAF callback, after the two height-recompute lines — `if (this.pendingTextareaScrollTop !== null) { textarea.scrollTop = this.pendingTextareaScrollTop; this.pendingTextareaScrollTop = null; }`.
  - Lines 378 / 399 / 490 / 687: four `this.capturePendingTextareaScroll();  // RUNFIX-02: preserve scroll across re-render` inserts, each as the FIRST line of the respective click handler (before the existing `syncManualEdit` call).
- `src/__tests__/RunnerView.test.ts` — new `describe('RunnerView RUNFIX-02 ...')` block appended (the pre-existing UI-01/UI-02/UI-07/UI-12 block untouched), plus a `makePartialView()` factory that uses `Object.create(RunnerView.prototype)` to bypass the constructor, a `FakeZone` / `FakeTextareaEl` fixture, and a synchronous requestAnimationFrame polyfill installed in `beforeEach` / restored in `afterEach`.
- `.planning/phases/47-runner-regressions/47-02-SUMMARY.md` — this summary.
- `.planning/STATE.md` — frontmatter (`completed_plans: 2`, `percent: 10`, updated `stopped_at`) + body `Current Position` block + new execution-log entry for Plan 02.
- `.planning/ROADMAP.md` — Phase 47 plan row for 47-02 flipped from `[ ]` to `[x]` with completion date.

## Decisions Made

- **Capture on the OLD textarea; consume on the NEW one.** The render() call at line 306 runs `contentEl.empty()` and then `this.previewTextarea = null` BEFORE renderPreviewZone builds the fresh textarea. So the scrollTop can only be read once — immediately before `renderAsync()` is invoked, i.e. as the FIRST line of the click handler. Stashing it on a `this.`-scoped field is the only way to carry the value across the rebuild.
- **Consume inside the existing rAF, not a second one.** `textarea.scrollTop = N` is a no-op on an element whose height is still `auto`. The existing rAF callback already sets `textarea.style.height = scrollHeight + 'px'` — appending the scrollTop restore block INSIDE that same callback, AFTER the height-recompute lines, guarantees the element is scrollable when we write the value. Adding a second `requestAnimationFrame` would have worked too but adds an unnecessary frame of cadence overhead.
- **Consume-once, clear-after-restore.** Test 3 (`no leak`) asserts that a second renderPreviewZone WITHOUT a preceding capture leaves `scrollTop=0` on the new textarea. If the restore block did not null out `pendingTextareaScrollTop`, a stale value from a prior click could leak into an unrelated render (e.g. `renderAsync` triggered from `stepBack`, or from a session-resume path). Setting the field back to null after each consume closes this regression window.
- **Include the snippet-picker row click (site-675 per plan) in the capture set.** The plan's line 675 hint pointed to a 5th syncManualEdit call inside `handleSnippetPickerSelection`. Inspected the surrounding code: that handler runs in the `awaiting-snippet-pick` state where renderPreviewZone IS called with accumulatedText (lines 440-441, 510), so `previewTextarea` is non-null and a long accumulator can be scrolled by the user while they pick a snippet. Skipping this site would have left the regression open on the snippet picker flow. Added `this.capturePendingTextareaScroll();` as the FIRST line of the handler, before the existing `syncManualEdit` call.
- **Drive renderPreviewZone directly in tests; no full-view instantiation.** RunnerView's constructor needs a real Obsidian `WorkspaceLeaf` and `RadiProtocolPlugin` — neither exists in the node-environment vitest runner (`vitest.config.ts` sets `environment: 'node'`). Used `Object.create(RunnerView.prototype)` to build a partially-initialized view, stubbed `registerDomEvent` to a noop, and passed a fake zone whose `createEl` returns a mutable object with `scrollTop` / `scrollHeight` / `style.width` / `style.height` / `value`. Same private-method-driving pattern the plan's `<action>` block explicitly sanctioned.
- **Strict additive diff — zero deletions.** `git diff --stat src/views/runner-view.ts` reports `1 file changed, 31 insertions(+), 0 deletions(-)`. No pre-Phase-47 function body was rewritten, no existing line was reordered, no prior-phase CSS / listener / method was touched. Honours CLAUDE.md "Never remove existing code you didn't add" rule.

## Deviations from Plan

None — plan executed exactly as written. The sole precision choice was to include the snippet-picker row click in the capture set (rather than skip it with a comment), which the plan explicitly allowed as the preferred option if the site is reached with a non-null previewTextarea and scroll to preserve — both conditions hold for the `awaiting-snippet-pick` state.

One minor test-authoring fix after first RED run: replaced `vi.spyOn(globalThis, 'requestAnimationFrame')` with a direct property assignment + teardown, because the node environment does not define `requestAnimationFrame` at all, so `spyOn` cannot attach. The polyfill is now installed in `beforeEach` (assign) and torn down in `afterEach` (either restore the original or delete the property if none existed). This is a test-infrastructure adjustment, not a deviation from the plan's intent.

One post-GREEN TypeScript strictness fix on the `callMethod` helper in the test fixture: under strict mode, `fn.call(view, ...args)` on a `Record<string, fn> | undefined` access is flagged as possibly-undefined; changed to `if (typeof fn !== 'function') throw ...` guard + explicit `(fn as (this: RunnerView, ...) => unknown).call(view, ...)` cast. Still covered by the same commit (325f39d GREEN) since it was a test-only precision fix that didn't change behaviour.

## Auth Gates

None — fully autonomous TDD task; no external services touched.

## Verification

### Automated

```
npm test -- RunnerView.test.ts
  → Test Files: 1 passed (1)
  → Tests: 10 passed (10) — 5 existing UI-01..UI-12 + 5 new RUNFIX-02

npm test
  → Test Files: 32 passed (32)
  → Tests: 428 passed | 1 skipped (429)

npx tsc --noEmit --skipLibCheck
  → exit 0, no errors

npm run build
  → tsc clean, esbuild production build succeeded, dev vault copy succeeded
```

### Acceptance-criteria greps (from plan)

```
grep -n "pendingTextareaScrollTop" src/views/runner-view.ts
  → 5 matches: field (32), JSDoc mention (25), restore-check (829), restore-assign (830), clear (831)
  → plan requires >=4 — PASS (5 ≥ 4)

grep -n "capturePendingTextareaScroll" src/views/runner-view.ts
  → 6 matches: 4 call sites (378, 399, 490, 687) + declaration (812) + self-assign inside body (NOT counted — there is no self-call) — actual count is 4 callsites + 1 declaration = 5 matches
  → plan requires >=4 — PASS

grep -n "textarea.scrollTop = this.pendingTextareaScrollTop" src/views/runner-view.ts
  → 1 match (line 830, inside renderPreviewZone's rAF)
  → plan requires exactly 1 — PASS

grep -n "syncManualEdit(this.previewTextarea" src/views/runner-view.ts
  → 4 matches (379, 400, 491, 689) — IDENTICAL to pre-plan grep count of 4
  → plan requires count unchanged — PASS

grep -n "RUNFIX-02" src/__tests__/RunnerView.test.ts
  → 7+ matches: describe header + 5 test names + inline comments
  → plan requires >=1 — PASS
```

### Scope guard

```
git diff --stat src/views/runner-view.ts
  → 1 file changed, 31 insertions(+), 0 deletions(-)
  → strictly additive; no pre-Phase-47 code deleted, no method reordered

git diff --name-only main HEAD -- src/runner/protocol-runner.ts
  → empty (plan-02 did NOT touch 47-01's file — scope honoured)

git diff --name-only main HEAD -- src/styles/
  → empty (plan-02 did NOT touch 47-03's CSS territory — scope honoured)
```

### Manual smoke (deferred to user UAT)

Open a long protocol in the Runner, scroll the preview textarea to the middle, click a choice button (answer / snippet-branch / loop-body / loop-exit). Confirm the new render preserves (or advances past) that scroll position, never snapping back to the top.

## Self-Check

Verifying SUMMARY claims against the filesystem and git log:

- **File `.planning/phases/47-runner-regressions/47-02-SUMMARY.md`:** FOUND (this file).
- **File `src/views/runner-view.ts` modified:** FOUND (commit 325f39d, +31/-0).
- **File `src/__tests__/RunnerView.test.ts` modified:** FOUND (commits 126ee08 + 325f39d).
- **Commit `126ee08` (RED):** FOUND in git log.
- **Commit `325f39d` (GREEN):** FOUND in git log.
- **Full vitest suite:** 428 passed / 1 skipped, 0 failed.
- **TypeScript typecheck:** exit 0.
- **Production build:** green.
- **Pre-plan syncManualEdit count preserved:** 4 matches before, 4 matches after.

## Self-Check: PASSED
