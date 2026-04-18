---
phase: 47-runner-regressions
verified: 2026-04-18T23:55:00Z
status: human_needed
score: 3/3 must-haves verified (code-level); 1 UAT already done for RUNFIX-03, 2 manual smoke tests still recommended for RUNFIX-01/02
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Manual smoke — RUNFIX-01 in live Obsidian vault"
    expected: "Open a canvas with a Loop node reachable via a Snippet node. Run the protocol to the loop picker. Type manual edits into the preview textarea. Click a body-branch button → verify edit survives in the next at-node render. Repeat for «выход» exit and for a dead-end return back to the picker. No edit loss on any of the four transition flavours (body entry, «выход» exit, dead-end return, B1 re-entry)."
    why_human: "Requires real DOM, real Obsidian runtime, and a live canvas — unit tests cover the runner state machine but do not exercise the RunnerView click-handler → runner transition end-to-end."
  - test: "Manual smoke — RUNFIX-02 in live Obsidian vault"
    expected: "Open a long protocol in the Runner. Scroll the preview textarea to the middle. Click a choice button (answer, snippet-branch, loop-body, loop-exit, snippet-picker row). Textarea scroll position is retained (or advances to insertion point) — never snaps back to scrollTop=0."
    why_human: "Requires real browser scroll clamping + real rAF cadence. Unit tests use a fake textarea without clamping semantics (see code-review IN-05)."
---

# Phase 47: Runner Regressions Verification Report

**Phase Goal:** Three user-facing runner bugs reported during v1.7 use are closed so manual textarea edits, scroll position, and button typography behave correctly end-to-end.

**Verified:** 2026-04-18T23:55:00Z
**Status:** human_needed (code-level verification PASSED; 2 manual smoke-tests recommended; RUNFIX-03 UAT already completed in TEST-BASE vault)
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                           | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Manual textarea edits at `awaiting-loop-pick` survive every loop transition (body-branch entry, «выход» exit, dead-end return, B1 re-entry) — RUNFIX-01 | ✓ VERIFIED | `src/runner/protocol-runner.ts:316` gate relaxed to `runnerStatus !== 'at-node' && runnerStatus !== 'awaiting-loop-pick'`. JSDoc at :305-314 documents the invariant. View already calls `syncManualEdit` before `chooseLoopBranch` at `src/views/runner-view.ts:491`. Four regression tests in `protocol-runner-loop-picker.test.ts:179-290` cover all four transition flavours + undo snapshot content. All 428 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | Choice-button click preserves textarea scroll position (or advances past it); never snaps to scrollTop=0 — RUNFIX-02                            | ✓ VERIFIED | `src/views/runner-view.ts:32` adds `pendingTextareaScrollTop: number \| null = null`. Helper `capturePendingTextareaScroll()` at :812-814 captures old textarea's scrollTop. Four choice-click sites (378 answer, 399 snippet-branch, 490 loop-body/exit, 687 snippet-picker row) each call the helper as first line before `syncManualEdit`. Restore block at :829-832 inside `renderPreviewZone`'s rAF (after height recompute) writes scrollTop and consumes-once (clears to null). Five regression tests in `RunnerView.test.ts:113-225` cover field default, capture, restore-and-consume, no-leak, and end-to-end flow. Pre-existing BUG-01 `syncManualEdit(this.previewTextarea?.value ?? '')` count preserved verbatim (4 matches — same as before). |
| 3   | Choice buttons render Cyrillic descenders («р», «у», «ц») and parentheses «(», «)» fully inside the button box at every wrap count — RUNFIX-03   | ✓ VERIFIED | Three appended Phase 47 blocks in `src/styles/runner-view.css:229-269` (answer + snippet-branch buttons) and `src/styles/loop-support.css:92-132` (loop body + exit buttons). Final cascade: `height: auto`, `align-items: flex-start`, `box-sizing: border-box`, `padding: var(--size-4-2) var(--size-4-4)` (8px/16px), `line-height: 1.55`, `min-height: 44px`, `white-space: normal`, `overflow-wrap: anywhere`, `max-width: 100%` (plus `width: 100%` + `min-width: 0` on loop buttons). Root `styles.css` regenerated — contains 12 matches of Phase 47 markers / line-height / height:auto / align-items:flex-start. UAT approved by user in TEST-BASE vault with narrow sidebar + tab-mode layout at commit d23aaff (Task 2 human-verify checkpoint).                                                                                              |

**Score:** 3/3 truths verified at code level. RUNFIX-03 has additional UAT approval; RUNFIX-01 and RUNFIX-02 have comprehensive automated coverage but benefit from live-Obsidian smoke as sanity check.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ------- | ------ | ------- |
| `src/runner/protocol-runner.ts` | syncManualEdit accepts awaiting-loop-pick; contains pattern `runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-loop-pick'` | ✓ VERIFIED | Match at line 316 (exactly 1 occurrence). Phase 47 RUNFIX-01 JSDoc block at :305-314. |
| `src/__tests__/runner/protocol-runner-loop-picker.test.ts` | RUNFIX-01 regression coverage (4 tests) | ✓ VERIFIED | Describe block at :179. Tests at :181 (body-branch), :204 («выход» exit), :223 (back-edge re-entry non-regression), :251 (undo-snapshot content). 4 tests, all passing. |
| `src/views/runner-view.ts` | pendingTextareaScrollTop + capture + restore | ✓ VERIFIED | Field at :32, helper at :812, 4 call sites at :378/:399/:490/:687, restore at :829-832. Strictly additive diff (+31/-0). |
| `src/__tests__/RunnerView.test.ts` | RUNFIX-02 regression coverage | ✓ VERIFIED | 5 tests in describe block at :113-225, all passing. |
| `src/styles/runner-view.css` | Phase 47 padding/line-height rules for answer + snippet-branch buttons | ✓ VERIFIED | 3 appended blocks at :229, :241, :254 (all below last pre-Phase 47 rule at :228). Strictly additive. |
| `src/styles/loop-support.css` | Phase 47 padding/line-height rules for loop-body + loop-exit buttons | ✓ VERIFIED | 3 appended blocks at :92, :106, :120 (all below last pre-Phase 47 rule at :91). Strictly additive. |
| `styles.css` | Regenerated build artifact containing Phase 47 markers | ✓ VERIFIED | Regenerated by `npm run build`; contains 12 matches of Phase 47 / line-height: 1.55 / height: auto / align-items: flex-start tokens concatenated from both source CSS feature files. |

### Key Link Verification

| From                                      | To                              | Via                                                                   | Status | Details                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------- | --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `runner-view.ts:491`                      | `ProtocolRunner.syncManualEdit` | click handler on loop-pick button (body + exit)                       | WIRED  | `this.runner.syncManualEdit(this.previewTextarea?.value ?? '')` confirmed at :491 (inside loop-branch click handler); runner gate now accepts this state.                                                          |
| `ProtocolRunner.syncManualEdit`           | `TextAccumulator.overwrite`     | accumulator mutation before `chooseLoopBranch` snapshots undo entry   | WIRED  | `this.accumulator.overwrite(text)` at :317, inside the gated method — writes through for both at-node and awaiting-loop-pick. `chooseLoopBranch` takes undo snapshot from accumulator state at :190 (per plan).    |
| RunnerView choice click handlers          | `renderPreviewZone` restore     | capture before renderAsync, restore inside rAF after height recompute | WIRED  | 4 capture calls at :378, :399, :490, :687; restore block at :829-832 consumes and clears. Order correct (capture → renderAsync → render() empties → renderPreviewZone builds new textarea → rAF → height → restore). |
| `src/styles/runner-view.css`              | `styles.css`                    | esbuild concatenation via CSS_FILES                                   | WIRED  | 12 Phase 47/line-height/override token matches in regenerated root styles.css — both source files concatenated per esbuild.config.mjs.                                                                             |
| `src/styles/loop-support.css`             | `styles.css`                    | esbuild concatenation                                                 | WIRED  | Same — 3 blocks per source file, both present in generated output.                                                                                                                                                  |

### Behavioral Spot-Checks

| Behavior                                         | Command                                         | Result                                   | Status |
| ------------------------------------------------ | ----------------------------------------------- | ---------------------------------------- | ------ |
| Full test suite passes (regression baseline)     | `npm test`                                      | 428 passed / 1 skipped / 0 failed        | ✓ PASS |
| Phase 47 markers in regenerated styles.css       | `grep -c "Phase 47\|line-height: 1.55\|height: auto\|align-items: flex-start" styles.css` | 12 matches                               | ✓ PASS |
| RUNFIX-01 gate relaxation in source              | `grep "awaiting-loop-pick" src/runner/protocol-runner.ts` in syncManualEdit | Match at line 316                        | ✓ PASS |
| RUNFIX-02 capture wired to all four click sites  | `grep "capturePendingTextareaScroll" src/views/runner-view.ts` | 5 matches (4 call sites + 1 declaration + 3 field accesses) | ✓ PASS |
| All 11 Phase 47 commits present in git log       | `git log --oneline -15`                         | All expected commits found: 7603bc5, bdb227f, eb6b336, 126ee08, 325f39d, 2abe6d7, 3f7f628, 84adf10, d23aaff, 92f67b8, 11a24b8 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                              | Status       | Evidence                                                                                                                                                           |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RUNFIX-01   | 47-01       | Manual textarea edits survive every loop transition (body, «выход», dead-end, re-entry)                   | ✓ SATISFIED  | Gate relaxation + 4 regression tests. All tests green.                                                                                                             |
| RUNFIX-02   | 47-02       | Choice click preserves textarea scroll — never snaps to top                                              | ✓ SATISFIED  | pendingTextareaScrollTop + helper + restore + 5 regression tests. All tests green.                                                                                 |
| RUNFIX-03   | 47-03       | Choice buttons render Cyrillic descenders + parentheses inside button box at every wrap count             | ✓ SATISFIED  | 3-revision CSS blocks in 2 source files; regenerated styles.css; user UAT approved in narrow-sidebar + tab-mode at commit d23aaff.                                   |

No orphaned requirements. REQUIREMENTS.md traceability matrix confirms all three RUNFIX-0x flipped to ✅ complete (2026-04-18).

### Anti-Patterns Found

| File                                                             | Line | Pattern                       | Severity | Impact                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ---- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/runner-view.css:234-269`, `src/styles/loop-support.css:97-132` | multiple | Three stacked override blocks for same selector | ℹ️ Info / ⚠️ Warning (WR-01 per code review) | Dead/superseded declarations: `padding` declared 3 times per selector with only the last winning. Block 2 comment still says "Bump horizontal padding to --size-4-3" but Block 3 bumps to --size-4-4 — stale comment. Functionally correct (last-wins cascade); defensible under CLAUDE.md append-only rule. Recommended to either consolidate or update Block 2 comment.  |
| `src/views/runner-view.ts:689` (`handleSnippetPickerSelection`) | 689  | syncManualEdit called in awaiting-snippet-pick state | ℹ️ Info (IN-01 per code review) | `syncManualEdit` returns at gate when status is `awaiting-snippet-pick` — edits typed while the snippet picker is up are silently discarded. Pre-existing latent bug exposed by RUNFIX-01's gate pattern. Out of Phase 47 scope; not a regression introduced by this phase. |
| `src/views/runner-view.ts:430-434`, `:504-508`, `:670-676`         | — | Step-back handlers don't call capturePendingTextareaScroll | ℹ️ Info (IN-02 per code review) | Step-back triggers renderAsync → render() → new textarea but without scroll capture, reset to scrollTop=0. Product decision (step-back = "go back") may be intentional but not documented. Inconsistency with RUNFIX-02 forward handlers. Not a regression; not declared in RUNFIX-02's scope (plan explicitly scoped to forward choice clicks). |
| `src/__tests__/runner/protocol-runner-loop-picker.test.ts:277`  | 277  | Test 4 uses strict `toBe('PRE_EXIT_EDIT')` while docstring suggests `toContain` | ℹ️ Info (IN-03 per code review) | Fixture-topology-dependent assertion; fragile to future canvas changes. Cosmetic test-authoring tightness, not a goal failure. |
| `src/views/runner-view.ts:812-814`, `:829-832`                    | — | pendingTextareaScrollTop leak on error-branch render | ℹ️ Info (IN-04 per code review) | If capture occurs but subsequent render takes the error branch (`renderError`), pending value persists and could apply to unrelated later textarea. Bounded by `start() → render()` resetting via fresh textarea with scrollTop=0 default. Cheap defensive cleanup recommended but not goal-blocking. |
| `src/__tests__/RunnerView.test.ts:161`, `:207`                    | — | `toBeGreaterThanOrEqual(500)` where strict `toBe(500)` would be tighter | ℹ️ Info (IN-05 per code review) | Assertion strictly weaker than strict equality without browser clamping benefit in node-env fake DOM. Cosmetic. |

**Severity summary:** 0 blockers, 1 warning (WR-01 — CSS maintainability; defensible under append-only rule), 5 info. All non-blocking for Phase 47 goal achievement.

### Human Verification Required

Two live-Obsidian smoke tests recommended (RUNFIX-03 already has UAT approval recorded at commit d23aaff):

1. **RUNFIX-01 — manual edits across loop transitions (live vault smoke)**
   - **Test:** Open a canvas with a Loop node reachable via a Snippet node. Run the protocol to the loop picker. Type manual edits into the preview textarea. Click a body-branch button → verify edit survives in the next at-node render. Repeat for «выход» exit and for a dead-end return back to the picker.
   - **Expected:** No edit loss on any of the four transition flavours (body entry, «выход» exit, dead-end return, B1 re-entry).
   - **Why human:** Requires real DOM, real Obsidian runtime, and a live canvas — unit tests cover the runner state machine but do not exercise the RunnerView click-handler → runner transition end-to-end.

2. **RUNFIX-02 — scroll preservation across choice clicks (live vault smoke)**
   - **Test:** Open a long protocol in the Runner. Scroll the preview textarea to the middle. Click a choice button (answer, snippet-branch, loop-body, loop-exit, snippet-picker row).
   - **Expected:** Textarea scroll position is retained (or advances to insertion point) — never snaps back to scrollTop=0.
   - **Why human:** Requires real browser scroll clamping + real rAF cadence. Unit tests use a fake textarea without clamping semantics (see code-review IN-05).

RUNFIX-03 UAT was already performed by the user in TEST-BASE vault with narrow sidebar + tab-mode layout at commit d23aaff — final revision approved.

### Gaps Summary

No gaps blocking the phase goal. All three RUNFIX-0x requirements satisfied at the code level with comprehensive regression coverage (9 new tests total: 4 for RUNFIX-01, 5 for RUNFIX-02; CSS changes driven by human UAT per the plan's checkpoint task). The full test suite is green (428 passed / 1 skipped — unchanged from pre-phase baseline except for the 9 added tests, so actually 419 → 428 passed, net +9 as expected).

One code-review warning (WR-01 — CSS stacked override blocks with stale Block 2 comment) is a maintainability concern, not a goal failure — the final cascade applies the correct property set and human UAT approved the visual outcome. The plan explicitly anticipated revision iteration under the append-only rule. Recommend tracking as non-blocking tech debt or fixing with a small follow-up commit (consolidate blocks or update Block 2 comment).

Five code-review info items (IN-01 through IN-05) are either out-of-scope pre-existing latent bugs (IN-01 snippet picker syncManualEdit drop, IN-02 step-back scroll), defensive-cleanup opportunities (IN-04 pendingTextareaScrollTop leak), or cosmetic test-tightness items (IN-03, IN-05). None block Phase 47 goal.

**Final verdict:** All three Phase 47 Success Criteria achieved end-to-end in the codebase; one user UAT already recorded (RUNFIX-03); two live-vault smokes recommended (RUNFIX-01/02) as belt-and-suspenders before closing the phase — hence `human_needed` rather than outright `passed`.

---

*Verified: 2026-04-18T23:55:00Z*
*Verifier: Claude (gsd-verifier)*
