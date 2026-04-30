---
phase: 47-runner-regressions
reviewed: 2026-04-18T20:51:31Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/runner/protocol-runner.ts
  - src/__tests__/runner/protocol-runner-loop-picker.test.ts
  - src/views/runner-view.ts
  - src/__tests__/RunnerView.test.ts
  - src/styles/runner-view.css
  - src/styles/loop-support.css
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-04-18T20:51:31Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 47 ships three small, well-scoped runner regressions:

- **RUNFIX-01** (`protocol-runner.ts`): extends the `syncManualEdit()` gate from `{'at-node'}` to `{'at-node', 'awaiting-loop-pick'}` so manual textarea edits made while halted at the loop picker survive the subsequent `chooseLoopBranch()` call. The fix is minimal, well-commented, and covered by four new tests in `protocol-runner-loop-picker.test.ts` that pin body-branch entry, «выход» exit, back-edge re-entry (non-regression), and undo-snapshot content.
- **RUNFIX-02** (`runner-view.ts`): introduces `pendingTextareaScrollTop` + `capturePendingTextareaScroll()` + a restore block inside `renderPreviewZone`'s `requestAnimationFrame` callback, wired into four click handlers. Correctly ordered (capture BEFORE `renderAsync()`; restore AFTER the height recompute). Covered by five new tests in `RunnerView.test.ts` that drive `renderPreviewZone` directly with a fake zone/textarea fixture.
- **RUNFIX-03** (CSS): appends three sequential override blocks per file (three revisions of the same selector `.rp-answer-btn, .rp-snippet-branch-btn` and `.rp-loop-body-btn, .rp-loop-exit-btn`). Functionally correct (last declaration wins in the cascade) and complies with CLAUDE.md's append-only rule, but leaves a substantial amount of dead/superseded declarations inline.

No critical bugs or security issues. The most notable finding is CSS maintainability: three append-only revisions of the same selector within a single phase left two generations of overridden `padding` declarations in both files. One pre-existing latent bug adjacent to RUNFIX-01 (manual edits dropped when a user edits the textarea while halted at `awaiting-snippet-pick` or `awaiting-snippet-fill`) is called out for information — it is out of scope for Phase 47 but the gate extension pattern makes it newly visible.

## Warnings

### WR-01: Dead CSS declarations — three revisions of same selector left inline

**File:** `src/styles/runner-view.css:234-269`, `src/styles/loop-support.css:97-132`

**Issue:** Both CSS files contain three back-to-back rule blocks targeting the identical selector within the same phase. Because the selectors and specificity are identical, CSS cascade keeps only the last declaration for each property — every other declaration is dead code.

In `runner-view.css` (`.rp-answer-btn, .rp-snippet-branch-btn`):
- `padding` is declared three times (`--size-4-2 --size-4-2` → `--size-4-2 --size-4-3` → `--size-4-2 --size-4-4`). Only the last wins; the first two are dead.
- `white-space: normal` is declared twice (existing block + Block 3) — second one is redundant.
- `min-height: 40px` (pre-existing at `runner-view.css:89`) vs. `min-height: 44px` (Block 1) — also fine, but adds to the noise.

In `loop-support.css` (`.rp-loop-body-btn, .rp-loop-exit-btn`):
- `padding` is declared three times (same three variants as above). Only the last wins.
- `white-space: normal` is declared twice (Block 1 + Block 3).

This is functionally correct and CLAUDE.md's append-only rule authorizes it ("Add new rules at the bottom of that file with a phase comment … Never rewrite existing sections"). However, the rule is intended for **later phases** appending to **earlier phases'** rules — it does not require three consecutive revisions **within the same phase** to be preserved as separate blocks. A future reader maintaining these buttons now has to trace three phase-47 blocks to understand which padding actually applies. The SUMMARY file (`47-03-SUMMARY.md`, 24KB) already captures the debugging history.

Additionally, the Block 2 comment block in `runner-view.css:241-245` now lies to the reader: it says "Bump horizontal padding to --size-4-3 (12px)" but Block 3 immediately below bumps it to `--size-4-4`. A future maintainer reading Block 2 out of context will conclude horizontal padding is 12px when it is actually 16px.

**Fix:** Consolidate the three Phase-47 blocks in each file into a single block whose comment header summarises the three attempts' findings. The final property set is identical:

```css
/* Phase 47: RUNFIX-03 — choice-button typography + narrow-sidebar overflow + Obsidian
 * default-button defeat. Three successive revisions (tight padding → sidebar overflow →
 * Obsidian's base `button { height: var(--input-height); align-items: center;
 * white-space: nowrap }` clipping wrapped labels) converged on the declarations below.
 * Do NOT compress further without testing Cyrillic descenders in a narrow sidebar. */
.rp-answer-btn,
.rp-snippet-branch-btn {
  height: auto;
  align-items: flex-start;
  box-sizing: border-box;
  padding: var(--size-4-2) var(--size-4-4); /* 8px vertical, 16px horizontal */
  line-height: 1.55;
  min-height: 44px;
  white-space: normal;
  overflow-wrap: anywhere;
  max-width: 100%;
}
```

(and the parallel consolidation in `loop-support.css` adds `width: 100%; min-width: 0;` which those selectors need but the answer buttons don't.) If the team prefers to preserve revision history in source for traceability, keeping the current form is defensible — but then at least update the Block 2 comment in `runner-view.css:241-245` to explicitly note that the 12px value is superseded by Block 3.

## Info

### IN-01: `syncManualEdit` silently drops edits made at `awaiting-snippet-pick` / `awaiting-snippet-fill`

**File:** `src/runner/protocol-runner.ts:315-318`, `src/views/runner-view.ts:689`

**Issue:** Not a Phase 47 regression; pre-existing and left untouched by RUNFIX-01. Mentioned here because the RUNFIX-01 gate extension makes the asymmetry more visible.

RUNFIX-01 extends the gate to `{'at-node', 'awaiting-loop-pick'}` only. However:

1. The preview textarea is rendered and remains editable while halted at `awaiting-snippet-pick` (runner-view.ts:443-457, 511) and `awaiting-snippet-fill` (runner-view.ts:521).
2. `handleSnippetPickerSelection` (runner-view.ts:687-689) calls `this.capturePendingTextareaScroll(); this.runner.syncManualEdit(this.previewTextarea?.value ?? '');` — but at that moment `runnerStatus === 'awaiting-snippet-pick'`, so `syncManualEdit` returns at the gate and the user's manual edits to the textarea are silently discarded before `pickSnippet` takes the undo snapshot.

This is the exact same class of bug RUNFIX-01 fixes for the loop picker. It is out of Phase 47 scope, but the expanded gate should be treated as a convention: any click handler that calls `syncManualEdit(…)` implicitly expects that call to succeed in the runner's current state. If it does not, the capture-before-advance invariant documented in the BUG-01 comment (runner-view.ts:379, 400, 491) is violated.

**Fix:** Track as a separate phase. Either (a) extend the gate further to include `awaiting-snippet-pick` and `awaiting-snippet-fill`, or (b) disable the textarea for these states so user expectations match runtime behaviour. Option (a) is consistent with how the loop picker behaves post-RUNFIX-01.

### IN-02: Step-back click handlers do not preserve textarea scroll position

**File:** `src/views/runner-view.ts:430-434`, `src/views/runner-view.ts:504-508`, `src/views/runner-view.ts:670-676`

**Issue:** RUNFIX-02 wires `capturePendingTextareaScroll()` into four *forward* handlers (answer click, snippet-branch click, loop-branch click, snippet-picker-row click) but not into the three *step-back* handlers. Step-back also goes through `render()` and thus re-creates the textarea — so a long report with the user scrolled halfway down will snap back to the top on step-back, the exact bug RUNFIX-02 describes.

Whether this is intentional is a product decision (step-back = "go back in time" could arguably reset scroll), but the inconsistency is unobvious from the code and is not called out in 47-02-SUMMARY.md. If unintentional, it is a latent RUNFIX-02 gap.

**Fix:** Add `this.capturePendingTextareaScroll();` as the first line of each of the three step-back handlers at lines 430, 504, 670 — same pattern as the forward handlers. If intentionally omitted, add a one-line comment at each site explaining why step-back diverges from forward.

### IN-03: Test 4 assertion is tighter than the test docstring suggests

**File:** `src/__tests__/runner/protocol-runner-loop-picker.test.ts:277`

**Issue:** Test 4 asserts `expect(state.accumulatedText).toBe('PRE_EXIT_EDIT')` (strict equality, not `toContain`). This works for `unified-loop-valid.canvas` because e2 walks `n-loop → n-q1` (a question node), and questions halt *before* any auto-append — so the accumulator contains only `'PRE_EXIT_EDIT'` verbatim. If the fixture ever changes to route e2 through a text-block first, this assertion breaks.

The docstring at line 275 is looser ("The undo entry's restored snapshot must equal the post-edit accumulator") which is a stronger invariant. The current assertion ties the test to a specific graph topology.

**Fix:** Either (a) add a comment above the assertion explaining the `toBe` choice depends on n-q1 being a question halt, or (b) relax to `toContain('PRE_EXIT_EDIT')` to match the other three tests' idiom and survive fixture changes.

### IN-04: `pendingTextareaScrollTop` leaks across renders if a capture is never consumed

**File:** `src/views/runner-view.ts:812-814`, `src/views/runner-view.ts:829-832`

**Issue:** `capturePendingTextareaScroll()` writes to `this.pendingTextareaScrollTop`, and `renderPreviewZone`'s `rAF` callback consumes + clears it. The JSDoc at runner-view.ts:24-31 correctly notes "Survives render() — render() nulls previewTextarea but MUST leave this field alone so the consume inside the new textarea's rAF can still run."

Edge case: if a capture happens but no subsequent `renderPreviewZone` call executes the consume (e.g., `render()` takes the `error` branch at runner-view.ts:548-550 which calls `renderError` and returns without rendering a textarea), the pending value persists. The next time `renderPreviewZone` IS called (after the user navigates out of the error state), it will apply the stale scroll value to a fresh textarea showing unrelated content. Browser clamps scrollTop to scrollHeight, so worst case is a spurious jump to the bottom of the new content.

In practice error-state recovery always goes through another `openCanvas → start() → render()` path that creates a fresh textarea with `scrollTop = 0` default — so the leak is bounded. Still, defensive cleanup would be cheap.

**Fix:** Add a clear in `renderError` (runner-view.ts:900) so any pending capture is discarded when entering the error state: `this.pendingTextareaScrollTop = null;` after `this.contentEl.empty()`. Alternatively, clear at the top of `render()` itself when the `state.status === 'error'` branch is taken.

### IN-05: Test fixture `scrollTop` assertion is permissive — `toBeGreaterThanOrEqual(500)` vs `toBe(500)`

**File:** `src/__tests__/RunnerView.test.ts:161`, `src/__tests__/RunnerView.test.ts:207`

**Issue:** Two assertions use `expect(created!.scrollTop).toBeGreaterThanOrEqual(500)` where the production code writes `textarea.scrollTop = this.pendingTextareaScrollTop` (a direct numeric assignment). The fake textarea in `makeFakeZone()` is a plain object — its `scrollTop` is a simple number field with no clamping. The only way this assertion could pass with a value > 500 is if the production code changed to write something larger than the captured value, which would itself be a bug the test should catch.

`toBeGreaterThanOrEqual(500)` is therefore strictly weaker than `toBe(500)` without any benefit. The docstring at line 161 ("Preserved (or advanced) — never reset to 0 when tall content remains") suggests the author wanted flexibility for a real browser's clamp behaviour, but jsdom is not in play here and the fake doesn't clamp.

**Fix:** Tighten both assertions to `expect(created!.scrollTop).toBe(500)` so the test fails loudly if RUNFIX-02 is ever silently weakened to write a different value (or no value). If browser-clamping semantics are desired in a future jsdom run, add a comment explaining.

---

_Reviewed: 2026-04-18T20:51:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
