---
phase: 42-snippet-node-creation-button-and-double-click-node-selection-fix
fixed_at: 2026-04-17T08:38:30Z
review_path: .planning/phases/42-snippet-node-creation-button-and-double-click-node-selection-fix/42-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 42: Code Review Fix Report

**Fixed at:** 2026-04-17T08:38:30Z
**Source review:** `.planning/phases/42-snippet-node-creation-button-and-double-click-node-selection-fix/42-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning only; 4 Info findings deferred)
- Fixed: 2
- Skipped: 0

Both warnings targeted the same dropdown `onChange` code region in `src/views/editor-panel-view.ts:333-348`. WR-02's fix (deferring the full re-render via `queueMicrotask`) naturally eliminates WR-01's double-rebuild problem once the redundant inline `kindFormSection.empty() / buildKindForm(...)` block is dropped. WR-01 also flagged a stale-`nodeRecord`-closure concern, addressed by merging `pendingEdits` into the record copy passed to the deferred `renderForm`. All three changes are load-bearing for the correctness of the fix, so they were landed as a single consolidated commit rather than two separate commits against overlapping lines.

## Fixed Issues

### WR-01: Double render + stale `nodeRecord` closure when user changes node type

**Files modified:** `src/views/editor-panel-view.ts`
**Commit:** `bddfd3f`
**Applied fix:**
- Removed the now-redundant inline `this.kindFormSection.empty(); this.buildKindForm(...)` block. The deferred `renderForm` below is the single rebuild path.
- Replaced the direct pass of the outer-closure `nodeRecord` with a merged copy: `const mergedRecord = { ...nodeRecord, ...this.pendingEdits };`. This ensures `buildKindForm`, when re-invoked by the deferred `renderForm`, sees the newly picked `radiprotocol_nodeType` (and any in-flight field edits) rather than stale data from the original `nodeRecord` captured when the form was first rendered.

### WR-02: Re-entrancy hazard — `renderForm` called from inside a handler registered by `renderForm`

**Files modified:** `src/views/editor-panel-view.ts`
**Commit:** `bddfd3f`
**Applied fix:**
- Wrapped the `this.renderForm(...)` call in `queueMicrotask(() => { ... })` so the dropdown `onChange` handler fully unwinds (and the live `<select>` / `_savedIndicatorEl` references stay valid for the synchronous tail of `onTypeDropdownChange`) before `contentEl.empty()` tears down the subtree that owns the firing element.
- Captured `value` and the derived `nextKind` into local consts outside the deferred closure so the closure is a stable snapshot of the change event, not dependent on the surrounding scope's mutation.

## Verification

- Tier 1 (re-read): Confirmed edit landed at lines 333-348 of `src/views/editor-panel-view.ts`; surrounding code (Setting construction, empty-type hint block, kindFormSection creation) intact.
- Tier 2 (TypeScript): `npx tsc --noEmit` reports zero errors in `src/` (only pre-existing `node_modules/vitest` moduleResolution warnings, unrelated to this edit).
- Tier 2 (build): `npm run build` completed successfully (tsc -noEmit -skipLibCheck followed by esbuild production bundle, copied to dev vault).
- Tier 2 (tests): `npm test` — 28 files, 390 tests, all passing. No test exercised the dropdown `onChange` callback directly, so the `queueMicrotask` deferral does not require test updates.

## Notes

- Info-level findings (IN-01 through IN-04) were out of scope for this `critical_warning` iteration. They remain documented in `42-REVIEW.md` for a future iteration or manual cleanup.
- Consolidated commit rationale: the WR-01 and WR-02 fixes both rewrite the same 15-line `.onChange` block. Splitting them into two commits would have required either (a) an intermediate state where WR-01 is fixed with a still-re-entrant synchronous `renderForm` call, or (b) an intermediate state where WR-02 defers but still double-rebuilds. Both intermediate states are strictly worse than the status quo, so a single commit was preferred.

---

_Fixed: 2026-04-17T08:38:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
