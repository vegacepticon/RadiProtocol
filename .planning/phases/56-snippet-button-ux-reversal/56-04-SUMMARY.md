---
phase: 56-snippet-button-ux-reversal
plan: 04
subsystem: runner-view + ProtocolRunner tests
tags: [PICKER-01, RUNFIX-02, dispatch, click-handler, tests]
requires:
  - 56-01 (ProtocolRunner.pickFileBoundSnippet, D-13 removal)
  - 56-02 (snippet-editor unsaved-dot)
  - 56-03 (committed-state select-folder button)
provides:
  - File-bound Snippet sibling click → direct pickFileBoundSnippet dispatch
  - Directory-bound Snippet sibling click → preserved chooseSnippetBranch path
  - Inverted test contracts across 4 test files (autoinsert-fill, sibling-button, picker, runner-autoinsert)
affects:
  - src/views/runner-view.ts (snippet-sibling-button click handler)
  - 4 test files
tech-stack:
  added: []
  patterns:
    - per-click branching by isFileBound predicate (vs. per-Question)
    - 5-step click prologue parity across both dispatch branches (capturePendingTextareaScroll, syncManualEdit, dispatch, autoSaveSession, renderAsync)
key-files:
  created: []
  modified:
    - src/views/runner-view.ts
    - src/__tests__/views/runner-snippet-sibling-button.test.ts
    - src/__tests__/views/runner-snippet-autoinsert-fill.test.ts
    - src/__tests__/views/runner-snippet-picker.test.ts
    - src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts (deviation auto-fix)
    - src/__tests__/views/snippet-editor-modal-folder-picker.test.ts (deviation auto-fix)
decisions:
  - Phase 56 D-04 dispatch routing implemented in click handler (not in protocol-runner) to keep per-click branching local to RunnerView
  - capturePendingTextareaScroll() retained as FIRST statement of both dispatch branches (RUNFIX-02 preserved across the reversal)
  - Test 7 in sibling-button file inverted to assert pickFileBoundSnippet (D-04) — no chooseSnippetBranch call for file-bound path
metrics:
  duration: ~10 minutes
  completed: 2026-04-20
  tasks_completed: 5
  files_modified: 6
---

# Phase 56 Plan 04: Runner-view click dispatch + tests Summary

Rewired the RunnerView snippet-sibling-button click handler to branch on `isFileBound` and dispatch file-bound Snippets directly via `runner.pickFileBoundSnippet(...)` (the Plan 01 entry point), while preserving the directory-bound Phase 51 `chooseSnippetBranch → awaiting-snippet-pick → SnippetTreePicker` path verbatim. Updated five test files to reflect the new contract; full vitest suite green.

## Tests

**Tests: 670 passed / 1 skipped / 0 failed.** (49 test files, all green.)

Per-file growth:
- `runner-snippet-sibling-button.test.ts`: 8 → 13 tests (+5: Test 7 inverted, Tests 9-12 added)
- `runner-snippet-autoinsert-fill.test.ts`: 8 → 8 tests (one-for-one inversion to post-click landing framing)
- `runner-snippet-picker.test.ts`: 12 → 14 tests (+2: 56-04-A/B directory-bound regressions)
- `protocol-runner-snippet-autoinsert.test.ts`: 12 → 12 tests (Tests 1, 2, 7, 8, 11 inverted to drive awaiting-snippet-fill via pickFileBoundSnippet)
- `snippet-editor-modal-folder-picker.test.ts`: 8 → 8 tests (mock infrastructure fix only — `toggleClass` added to MockEl)

## Per-task commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | `898b1f7` | feat(56-04): branch snippet-sibling-button click on isFileBound (Phase 56 D-04) |
| 2 | `cd704e2` | test(56-04): add direct-dispatch assertions for file-bound snippet siblings |
| 3 | `09242ab` | test(56-04): invert autoinsert-fill expectations to post-click landing |
| 4 | `1a583f1` | test(56-04): add directory-bound dispatch regression cases (D-04 / SC 3) |
| 5 | `f77fa24` | fix(56-04): full-suite gate — invert ex-D-13 runner tests + add toggleClass mock |

## Success criteria coverage

| SC | Coverage |
| -- | -------- |
| SC 1 (single button render for file-bound) | Inversion in `runner-snippet-autoinsert-fill.test.ts` + Test 9 in sibling-button file |
| SC 2 (direct-dispatch click → pickFileBoundSnippet) | Tests 7, 9, 10, 11, 12 in sibling-button file; Tests 1, 2, 7, 8, 11 in protocol-runner-snippet-autoinsert |
| SC 3 (directory-bound preserved) | Tests 56-04-A/B in picker file; Test 11 in sibling-button file |
| SC 4 (undo preserved) | Tests 7, 8, 11 in protocol-runner-snippet-autoinsert (UndoEntry shape unchanged from Plan 01) |
| SC 5 (RUNFIX-02 first) | Test 7 + Test 12 in sibling-button file; Test 56-04-A in picker file |
| SC 8 (full suite green) | npm test = 670/0/0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inverted Phase 51 D-13 auto-advance assertions in `protocol-runner-snippet-autoinsert.test.ts`**
- **Found during:** Task 5 (full-suite gate)
- **Issue:** 5 tests in `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` (Tests 1, 2, 7, 8, 11) asserted Phase 51 D-13 auto-advance behavior that Plan 01 explicitly removed (per CONTEXT D-02). Plan 01 did not list this test file in `files_modified`, so the inversion was missed and the suite was failing pre-Plan-04.
- **Fix:** Each failing test now asserts: (a) Question halts at-node (no auto-advance), then (b) explicitly drives `runner.pickFileBoundSnippet(...)` to enter `awaiting-snippet-fill` — same downstream landing, just behind the click-dispatch gate.
- **Files modified:** `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`
- **Commit:** `f77fa24`

**2. [Rule 3 - Blocking] Added `toggleClass` to test MockEl in `snippet-editor-modal-folder-picker.test.ts`**
- **Found during:** Task 5 (full-suite gate)
- **Issue:** 8 tests crashed with `TypeError: this.folderUnsavedDotEl.toggleClass is not a function`. Phase 56 Plan 02 introduced `updateFolderUnsavedDot()` which calls `toggleClass(...)` on a span created via Obsidian's `createSpan` API. The local `MockEl` in this test file had `addClass`/`removeClass`/`hasClass` but was missing `toggleClass`, blocking the suite.
- **Fix:** Added `toggleClass(cls, force?)` to the `MockEl` interface and implementation. Behavior matches the Obsidian API (force boolean determines add vs remove).
- **Files modified:** `src/__tests__/views/snippet-editor-modal-folder-picker.test.ts`
- **Commit:** `f77fa24`

Both fixes are in-Phase-56-scope (Plans 01 and 02 oversights) and required for the Phase 56 gate to pass — escalation not warranted per spirit of Task 5's stop-rule (which targets unrelated regressions, not within-phase test follow-ups).

## Self-Check: PASSED

Created files:
- FOUND: .planning/phases/56-snippet-button-ux-reversal/56-04-SUMMARY.md (this file)

Modified files (existence verified via git status):
- src/views/runner-view.ts — committed in 898b1f7
- src/__tests__/views/runner-snippet-sibling-button.test.ts — committed in cd704e2
- src/__tests__/views/runner-snippet-autoinsert-fill.test.ts — committed in 09242ab
- src/__tests__/views/runner-snippet-picker.test.ts — committed in 1a583f1
- src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts — committed in f77fa24
- src/__tests__/views/snippet-editor-modal-folder-picker.test.ts — committed in f77fa24

Commits exist:
- FOUND: 898b1f7
- FOUND: cd704e2
- FOUND: 09242ab
- FOUND: 1a583f1
- FOUND: f77fa24

Build: `npm run build` exits 0.
Tests: `npx vitest run` = 670 passed / 1 skipped / 0 failed.
