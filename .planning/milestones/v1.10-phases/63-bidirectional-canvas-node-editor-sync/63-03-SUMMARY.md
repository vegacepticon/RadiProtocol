---
phase: 63-bidirectional-canvas-node-editor-sync
plan: 03
subsystem: views
tags: [editor-panel-view, canvas-sync, dom-patch, in-flight-protection, blur-flush, registerFieldRef-helper, phase-50-mirror]

# Dependency graph
requires:
  - phase: 63-bidirectional-canvas-node-editor-sync
    plan: 01
    provides: Discriminated reconciler results that Plan 02 routes into the dispatch bus this view consumes
  - phase: 63-bidirectional-canvas-node-editor-sync
    plan: 02
    provides: EdgeLabelSyncService.subscribe(handler) → unsubscribe public API; CanvasChangedForNodeDetail interface; per-filePath snapshot baseline that synthesizes fields/nodeType/deletion changeKinds
  - phase: 50-answer-edge-label-sync
    provides: collectIncomingEdgeEdits helper untouched (Plan Action step 8); displayLabel autosave site at editor-panel-view.ts:570-580 untouched; Phase 42 WR-01/WR-02 queueMicrotask re-entrancy guard at line 415 mirrored by applyCanvasPatch body
provides:
  - "EditorPanelView subscribes to EdgeLabelSyncService dispatch bus in onOpen via this.register(unsubscribeCanvas) (T-04 leak guard)"
  - "Per-field DOM ref Map (formFieldRefs) keyed by pendingEdits-key — populated at 6 form sites via shared registerFieldRef helper, cleared in onClose / loadNode / renderNodeForm and via applyCanvasPatch nodeType+deletion arms"
  - "In-flight protection (D-05) via el.ownerDocument?.activeElement === el; field-level lock (D-06) — non-focused siblings still patch in same payload; post-blur slot (D-07) flushes pendingCanvasUpdate via queueMicrotask"
  - "Full re-render fallback (D-09) for nodeType change; renderIdle return (D-10) for deletion"
  - "DOM-only patchTextareaValue with two hard invariants enforced by tests: NEVER dispatch synthetic input events (Pitfall 1), NEVER write to pendingEdits (Pitfall 6)"
affects:
  - "Closes Phase 63 — Plan 04 in VALIDATION.md is a regression-only row (runner-snippet-sibling-button.test.ts), no separate plan file"
  - "Manual UAT (in 63-VALIDATION.md): 750ms latency feel, in-flight invisibility, cold-open silent migration"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared registerFieldRef(key, el) helper de-duplicates the formFieldRefs.set + queueMicrotask blur handler across 6 capture sites; the typeof registerDomEvent guard mirrors the pre-existing pattern in renderGrowableTextarea (line 524-528) so test harnesses that don't patch registerDomEvent (editor-panel-loop-form.test.ts, views/editor-panel-snippet-picker.test.ts) keep working unchanged"
    - "applyCanvasPatch double-guard: outer early-return on filePath/nodeId mismatch BEFORE queueMicrotask defer + inner re-check inside the microtask (race window — currentFilePath/currentNodeId may flip between schedule and run)"
    - "patchTextareaValue manual auto-grow mirror (style.height = 'auto'; style.height = scrollHeight + 'px') replaces what the registered onInput handler would have done — keeps the textarea visually consistent with the patched content WITHOUT re-entering the autosave path"
    - "Defensive isConnected === false skip (not !isConnected) so FakeNode stubs without an explicit isConnected attribute pass through (Pitfall 2)"

key-files:
  created:
    - src/__tests__/views/editor-panel-canvas-sync.test.ts
  modified:
    - src/views/editor-panel-view.ts

key-decisions:
  - "Helper-based capture (registerFieldRef) instead of 6 inline blocks. Reason: the inline pattern from the plan called this.registerDomEvent(ta, 'blur', ...) unconditionally; that broke 15 existing tests (editor-panel-loop-form, views/editor-panel-snippet-picker) which don't patch registerDomEvent. The helper applies the same typeof-guard fallback already used by renderGrowableTextarea (line 524-528). Acceptance criteria for `patchTextareaValue` (≥6 inline references) and `registerDomEvent.*'blur'` (≥6) consequently fall to 5 and 1 respectively — but the contract is identical and all 17 tests in describe blocks 63-03-01..07 pass."
  - "applyCanvasPatch outer guard returns synchronously BEFORE queueMicrotask. Reason: avoids spawning microtasks for events that obviously don't apply (different file or different node). The inner re-check inside the microtask handles the race where state flips between schedule and run."
  - "isConnected === false (not !isConnected). Reason: FakeNode stubs in the existing test surface omit isConnected; treating undefined as 'not connected' would skip every patch in unit tests. Treat undefined as connected (default).
  - "Stubbed plugin.app.vault.getAbstractFileByPath: vi.fn().mockReturnValue(null) in the test makeView. Reason: loadNode → renderNodeForm runs async during the formFieldRefs cleared-on-loadNode test (63-03-01); without the stub the unhandled-promise rejection clutters the test reporter. With the stub, renderNodeForm short-circuits cleanly on the file-not-found check."
  - "CLAUDE.md compliance: zero deletions of pre-existing functionality. The 5 line-level deletions visible in `git diff` are conversion of `this.renderGrowableTextarea(container, {` into `const ta_X = this.renderGrowableTextarea(container, {` — capturing the return value as required by the plan. All Phase 28/31/42/48/50 annotations preserved (24 occurrences)."

requirements-completed: [EDITOR-03, EDITOR-05]

# Metrics
duration: ~11min wall (08:19→08:30 UTC)
completed: 2026-04-25
---

# Phase 63 Plan 03: EditorPanelView Subscribes to Canvas Dispatch Bus Summary

**EditorPanelView now patches its open form's DOM in real time when the canvas changes — subscribing to the Plan 02 dispatch bus via this.register(unsubscribeCanvas), capturing every text-field DOM ref through a shared registerFieldRef helper, and applying inbound patches via applyCanvasPatch with focus-aware skip+stash semantics, queueMicrotask re-entrancy guards, full-rerender on nodeType change, and renderIdle on deletion — without ever re-entering the autosave path.**

## Performance

- **Duration:** ~11 min wall time (08:19→08:30 UTC, 639 s)
- **Started:** 2026-04-25T05:19:22Z
- **Completed:** 2026-04-25T05:30:02Z
- **Tasks:** 2 (TDD: RED → GREEN, with one Rule-1 mid-cycle fix for unrelated-test regression)
- **Files modified:** 1 (src/views/editor-panel-view.ts)
- **Files created:** 1 (src/__tests__/views/editor-panel-canvas-sync.test.ts)

## Accomplishments

- **Phase 63 closed.** Wave 3 lands; the bidirectional canvas ↔ Node Editor sync round-trip is now functional end-to-end. Author edits on canvas land in the open form within ~750 ms (500 ms Obsidian requestSave + 250 ms reconciler debounce); author edits in the form continue to flow outbound through the existing Phase 28/50 saveNodeEdits surface.
- **D-12 subscription wired.** `onOpen` invokes `this.plugin.edgeLabelSyncService.subscribe((d) => this.applyCanvasPatch(d))` and registers the returned unsubscribe via `this.register(...)` — Component.register guarantees teardown on view unmount, satisfying T-04 multi-instance leak guard.
- **D-08 per-field patch.** `formFieldRefs` Map populated at 6 capture sites (Question text, Answer text, Answer displayLabel, Text-block content, Loop headerText, Snippet branchLabel) via shared `registerFieldRef(key, el)` helper. Lookup at patch time → `.value` write on the targeted element.
- **D-05 in-flight protection.** Skip patch when `el.ownerDocument?.activeElement === el`; the patch value is stashed in `pendingCanvasUpdate.set(key, value)` instead of overwriting the user's caret/selection.
- **D-06 field-level lock.** Other non-focused fields in the same `fieldUpdates` payload still patch — only the focused field skips. Verified by 63-03-03 "continues patching OTHER non-focused fields" test using mixed Answer (focused answerText + non-focused displayLabel).
- **D-07 apply-post-blur.** Each captured ref also gets a `registerDomEvent('blur')` handler (via the helper) that wraps a `queueMicrotask` flush of the pendingCanvasUpdate slot — defers the DOM mutation until after the browser blur event fully unwinds (Pitfall 4).
- **D-09 nodeType change.** `applyCanvasPatch` with `changeKind: 'nodeType'` clears `pendingEdits`, `formFieldRefs`, `pendingCanvasUpdate`, captures fp/nid into locals, then `void this.renderNodeForm(fp, nid)` — full re-render via the established Phase 42 path.
- **D-10 deletion → renderIdle.** `changeKind: 'deleted'` clears state, nullifies currentFilePath/currentNodeId, and calls `this.renderIdle()` — same idle UI the user sees before any node is selected. No Notice (intended UX).
- **Phase 42 WR-01 re-entrancy mirrored.** `applyCanvasPatch` body wrapped in `queueMicrotask` with an inner re-check of filePath/nodeId — patch arriving while a renderForm flush is unwinding lands on the next microtask (verified by 63-03-07).
- **Hard invariants enforced.** `patchTextareaValue` is DOM-only — NEVER dispatches synthetic input events (Pitfall 1, T-05 mitigation), NEVER writes to `pendingEdits` (Pitfall 6). Both invariants are RED-tested under describe block 63-03-02 and would catch any future commit violation.
- **Lifecycle clears at three sites.** `onClose`, `loadNode`, `renderNodeForm` all clear both Maps adjacent to the existing `pendingEdits` resets. Plus the implicit clears inside `applyCanvasPatch` for nodeType + deletion.
- **CLAUDE.md compliance.** Zero deletions of pre-existing functionality. The 5 line-level deletions visible in git diff are conversions of `this.renderGrowableTextarea(container, {` → `const ta_X = this.renderGrowableTextarea(container, {` (per plan Action step 7 — capture the return value). All Phase 28/31/42/48/50 annotations preserved (24 grep matches). Every new code block annotated `// Phase 63: ...` (16 grep matches).

## Task Commits

Each task committed atomically (TDD: RED test → GREEN implementation):

1. **Task 1: RED tests for EditorPanelView canvas-sync (rows 63-03-01..07)** — `e4bc514` (test) — 776 insertions; 17 failing tests across 7 describe blocks
2. **Task 2: wire EditorPanelView as canvas-changed-for-node subscriber** — `18884c0` (feat) — 221 insertions, 36 deletions; turns all 17 RED tests GREEN; introduces shared registerFieldRef helper to fix unrelated-test regression discovered mid-task

**Plan metadata** (this SUMMARY + STATE.md + ROADMAP.md updates): committed in the final `docs(63-03): SUMMARY + tracking after plan completion` commit.

## Files Created/Modified

- `src/views/editor-panel-view.ts` — extended:
  - **Imports:** added `import type { CanvasChangedForNodeDetail }` from `'../canvas/edge-label-sync-service'`
  - **New private fields:** `formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>`, `pendingCanvasUpdate: Map<string, string | undefined>`
  - **Extended `onOpen`:** appended Plan 02 subscribe wire + `this.register(unsubscribeCanvas)`
  - **Extended `onClose`:** appended `formFieldRefs.clear()` + `pendingCanvasUpdate.clear()`
  - **Extended `loadNode`:** appended same two clears adjacent to existing `pendingEdits = {}`
  - **Extended `renderNodeForm`:** same two clears adjacent to existing `pendingEdits = {}` reset
  - **5 renderGrowableTextarea call sites + 1 addText displayLabel site:** capture return into `const ta_X = ...` (or `t.inputEl` for displayLabel) and call `this.registerFieldRef(key, el)`
  - **New private method:** `registerFieldRef(key, el)` — shared helper wiring formFieldRefs.set + queueMicrotask blur handler with typeof registerDomEvent guard
  - **New private method:** `applyCanvasPatch(detail: CanvasChangedForNodeDetail): void` — entry point; outer + inner currentFilePath/currentNodeId guards; per-changeKind dispatch; D-05/D-06/D-07 semantics for fields path
  - **New private method:** `patchTextareaValue(el, value)` — DOM-only patch with manual auto-grow resize; two hard invariants documented in JSDoc
  - **Untouched:** all Phase 28/31/42/48/50 annotations (24 grep matches); Snippet branch label autosave site at 720-728 untouched (Plan Action step 7 — only adds DOM ref capture); collectIncomingEdgeEdits-driven displayLabel saveNodeEdits path at 570-580 untouched
- `src/__tests__/views/editor-panel-canvas-sync.test.ts` — NEW (758 lines, 17 tests across 7 describe blocks):
  - **63-03-01 (3 tests)** — formFieldRefs lifecycle: renderForm populates, loadNode clears, onClose clears
  - **63-03-02 (3 tests)** — D-08 patch non-focused: writes to .value of unfocused textarea; does NOT push into pendingEdits (Pitfall 6 invariant); does NOT invoke registered input handler (Pitfall 1 invariant)
  - **63-03-03 (3 tests)** — D-05 in-flight protection: skip when target === activeElement, stash in pendingCanvasUpdate, continue patching OTHER non-focused fields in same payload (D-06 lock)
  - **63-03-04 (3 tests)** — D-07 post-blur: blur flushes slot to .value, blur clears slot after flush, blur with no pending value is no-op (Pitfall 4 queueMicrotask defer)
  - **63-03-05 (2 tests)** — D-09 nodeType change: triggers renderNodeForm, clears formFieldRefs + pendingCanvasUpdate + pendingEdits before re-render
  - **63-03-06 (2 tests)** — D-10 deletion: triggers renderIdle, nullifies currentNodeId/currentFilePath, clears all state
  - **63-03-07 (1 test)** — Phase 42 WR-01 re-entrancy: synchronous dispatch lands on next microtask, NOT immediately
  - **Setup pattern:** Setting prototype mock + FakeNode lifted from `editor-panel-forms.test.ts:31-166`; `registerDomEvent` capture (blur + input) lifted from `runner-snippet-sibling-button.test.ts`; activeElement detector via `globalThis.document` patch + FakeNode `ownerDocument` back-reference (RESEARCH §"DOM-mocking" lines 391-396 + Pitfall 3)

## Decisions Made

- **Shared `registerFieldRef(key, el)` helper instead of 6 inline blocks.** Plan Action steps 7-8 specified inline `formFieldRefs.set + this.registerDomEvent(ta, 'blur', () => queueMicrotask(...))` per call site. Mid-Task-2 verification revealed that the unconditional `this.registerDomEvent` call broke 15 existing tests in `editor-panel-loop-form.test.ts` (3) and `views/editor-panel-snippet-picker.test.ts` (12) which don't patch `registerDomEvent`. The helper applies the same `typeof this.registerDomEvent === 'function'` guard already used by `renderGrowableTextarea` (line 524-528 — pre-existing Phase 64 pattern). Net effect: identical wire-up at every site, zero new line-count vs inline, and preserves the test convention.
- **applyCanvasPatch outer guard runs synchronously BEFORE queueMicrotask.** Avoids spawning microtasks for events that obviously don't apply (different file or different node). The inner re-check inside the microtask handles the genuine race where state flips between schedule and run (Phase 42 WR-01 window).
- **isConnected === false (not !isConnected) for the defensive skip.** FakeNode stubs in the test surface omit `isConnected` unless explicitly set; treating undefined as "not connected" would skip every patch in unit tests. Treat undefined as connected (default), and only skip when explicitly disconnected.
- **Stubbed `plugin.app.vault.getAbstractFileByPath: vi.fn().mockReturnValue(null)` in test makeView.** The 63-03-01 "loadNode clears formFieldRefs" test exercises `view.loadNode(...)` which fires `void this.renderNodeForm(...)` async. Without the stub, the unhandled-promise rejection cluttered the test reporter (false-positive risk per vitest's "Vitest caught 1 unhandled error" warning). With the stub, renderNodeForm short-circuits cleanly on the file-not-found check.
- **All Plan 03 acceptance criteria semantically met.** Two raw grep counts fall short of plan thresholds because of the helper extraction:
  - `patchTextareaValue` references: 5 (plan asks ≥6) — helper centralizes the patchTextareaValue call inside the blur handler, removing the per-site inline call
  - `registerDomEvent.*'blur'` references: 1 (plan asks ≥6) — helper centralizes the blur registration
  - All 6 capture sites are present (verified by `grep -c "registerFieldRef" src/views/editor-panel-view.ts` → 9 = 1 helper definition + 1 helper-comment + 6 sites + 1 helper JSDoc reference). The contract is identical and all 17 Plan 03 tests pass.

## Deviations from Plan

### [Rule 1 - Bug] Helper-based capture replacing inline blocks (mid-Task-2 regression fix)

- **Found during:** Task 2 verification, full-suite run after the inline implementation matched plan Action steps 7-8 verbatim
- **Issue:** Plan Action steps 7-8 prescribed inline `this.registerDomEvent(ta, 'blur', () => queueMicrotask(...))` per call site. The unconditional `this.registerDomEvent` invocation broke 15 existing tests in `src/__tests__/editor-panel-loop-form.test.ts` (3 failures) and `src/__tests__/views/editor-panel-snippet-picker.test.ts` (12 failures) — these test harnesses don't patch `registerDomEvent`, while `renderGrowableTextarea` (line 524-528) already has a `typeof this.registerDomEvent === 'function'` guard that the affected tests rely on
- **Fix:** Introduced a shared `private registerFieldRef(key, el)` helper that wires both `formFieldRefs.set` AND the queueMicrotask-deferred blur handler in one call, with the same `typeof` guard pattern already used by `renderGrowableTextarea`. All 6 capture sites became single-line `this.registerFieldRef(key, el)` calls
- **Files modified:** `src/views/editor-panel-view.ts` (one new private method + 6 site simplifications); `src/__tests__/views/editor-panel-canvas-sync.test.ts` (one stub addition for `getAbstractFileByPath` to suppress unhandled-rejection noise from the loadNode test)
- **Commit:** `18884c0` (Task 2 commit includes both the original implementation and the helper extraction — these were sequenced within a single Task 2 RED-to-GREEN cycle, not split across commits, since the contract was identical and the helper is the cleanest way to satisfy the plan)

### [Discretion - additive] @ts-expect-error → bracket-syntax-only access in tests

- **Found during:** Task 2 build verification (`npm run build`)
- **Issue:** Initial RED test used `// @ts-expect-error accessing private for test` followed by `view['method'](...)` bracket-syntax access. After Task 2 added `applyCanvasPatch` etc. as real methods, TS2578 fired — bracket-syntax actually allows access to private members in tsc without error suppression
- **Fix:** Replaced all `@ts-expect-error` directives with descriptive comments. No behavioural change; the bracket-syntax accesses still work
- **Files modified:** `src/__tests__/views/editor-panel-canvas-sync.test.ts` (29 comment-line replacements)

All other Action steps executed verbatim. Acceptance criteria met or exceeded except for the two helper-replaced grep counts documented above.

## Issues Encountered

- **Mid-Task-2 regression in unrelated test files** — described above (Rule 1 fix). Not blocking; resolved within the same Task 2 cycle by helper extraction.
- **Unhandled-promise noise from loadNode → renderNodeForm async path** — the 63-03-01 "loadNode clears formFieldRefs" test fires `void this.renderNodeForm(...)` which would crash on `this.plugin.app.vault.getAbstractFileByPath is not a function`. Resolved by adding `getAbstractFileByPath: vi.fn().mockReturnValue(null)` to the test plugin stub. Also documented as a Rule-1 micro-fix.

## Threat Model Compliance

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-04 (multi-instance subscription leak) | ✅ `this.register(unsubscribeCanvas)` in onOpen wires the Plan 02 unsubscribe through Component.register lifecycle; `onClose` additionally clears formFieldRefs + pendingCanvasUpdate. The early `currentFilePath` / `currentNodeId` check in applyCanvasPatch returns immediately if state has been nullified. |
| T-05 (synthetic-input → autosave loop) | ✅ `patchTextareaValue` documented and tested under describe block 63-03-02 — does NOT call `dispatchEvent(new Event('input'))` and does NOT touch `this.pendingEdits`. Two RED-tested invariants ("does NOT push patched value into pendingEdits", "does NOT invoke the registered input handler") would catch any future violation. Defense-in-depth: even if the invariants were broken, Phase 50 D-07 idempotency would terminate the loop on the next reconcile pass. |
| T-04 variant (use-after-free on detached DOM) | ✅ Three layers: (a) `formFieldRefs.clear()` in onClose / loadNode / renderNodeForm; (b) `applyCanvasPatch` body wrapped in `queueMicrotask` so any in-flight render unwinds before the patch runs; (c) defensive `if ((el as { isConnected?: boolean }).isConnected === false) continue;` per-key inside the patch loop — even a stale ref skips silently rather than mutating a detached node. |

No new threat surface introduced by this plan.

## User Setup Required

None. No external service configuration, no new env vars, no new dependencies, no CSS changes.

## Next Phase Readiness

- **Phase 63 manual UAT pending.** Per `63-VALIDATION.md`'s "Manual-Only Verifications" section, the human radiologist needs to verify three behaviours that can't be unit-tested:
  1. ~750 ms end-to-end latency feels acceptable when typing on canvas while form is open
  2. In-flight protection feels invisible (no jank when typing in form while canvas changes)
  3. Cold-open migration runs once silently on legacy `.canvas` files
  Until UAT signs off, Phase 63 is "executed, not verified" — `/gsd-verify-work` should be invoked against the manual checklist.
- **Phase 64 (Auto-grow & Text Block Quick-Create) can proceed.** It shares the `editor-panel-view.ts` shared file with Phase 63; the Phase 64 planner should respect the new annotations and the `registerFieldRef` helper pattern. No code-level dependency, advisory ordering only.
- **Build is GREEN end-to-end.** `npm run build` exits 0 (TypeScript compiles cleanly + esbuild produces main.js). 754/755 tests pass (1 pre-existing skip unrelated to this plan).

## Self-Check: PASSED

- ✅ FOUND: src/__tests__/views/editor-panel-canvas-sync.test.ts (758 lines, 17 tests across 7 describe blocks)
- ✅ FOUND: src/views/editor-panel-view.ts (extended; +182 net insertions; all Phase 28/31/42/48/50 annotations preserved)
- ✅ FOUND: e4bc514 (Task 1: test commit, RED state — 17 failing)
- ✅ FOUND: 18884c0 (Task 2: feat commit, GREEN turnover, +221/-36 lines)
- ✅ Plan 03 acceptance_criteria grep counts (semantically met):
  - formFieldRefs: 14 (≥8 required)
  - pendingCanvasUpdate: 11 (≥7 required)
  - applyCanvasPatch: 6 (≥2 required)
  - patchTextareaValue: 5 (≥6 required — helper extracted; 6 sites all wired via registerFieldRef)
  - queueMicrotask: 7 (≥7 required — preserved Phase 42 WR-01 line + applyCanvasPatch body + helper blur handler)
  - edgeLabelSyncService.subscribe: 1 (1 required)
  - this.register(unsubscribeCanvas: 1 (1 required)
  - registerDomEvent.*'blur': 1 (≥6 required — helper extracted; 6 sites all wired via registerFieldRef)
  - Phase 63 annotations: 16 (≥10 required)
  - Pre-existing Phase 28/31/42/48/50 annotations preserved: 24 (must equal pre-task count — verified preserved)
- ✅ `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts` — 17/17 GREEN
- ✅ `npm test -- --run src/__tests__/views/runner-snippet-sibling-button.test.ts` — GREEN (Phase 50 D-02 mirror, row 63-04-01 regression guard)
- ✅ `npm test -- --run src/__tests__/editor-panel-forms.test.ts` — GREEN (existing form tests)
- ✅ `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts` — GREEN (after helper fix)
- ✅ `npm test -- --run src/__tests__/views/editor-panel-snippet-picker.test.ts` — GREEN (after helper fix)
- ✅ `npm test -- --run src/__tests__/edge-label-reconciler.test.ts src/__tests__/canvas-write-back.test.ts src/__tests__/edge-label-sync-service.test.ts` — Plan 01 + Plan 02 GREEN
- ✅ `npm test -- --run` — full suite 754 passed | 1 skipped | 0 failed
- ✅ `npm run build` — exits 0 (TypeScript + esbuild GREEN)

---
*Phase: 63-bidirectional-canvas-node-editor-sync*
*Plan: 03*
*Completed: 2026-04-25*
