---
phase: 51-snippet-picker-overhaul
plan: 05
subsystem: runner-ui
tags: [obsidian, runner, picker, snippet-tree, typescript, vitest]

# Dependency graph
requires:
  - phase: 51-snippet-picker-overhaul
    provides: SnippetTreePicker (Plan 02) — file-only mode + glyph dispatch + rp-stp-runner-host
  - phase: 51-snippet-picker-overhaul
    provides: SnippetNode.radiprotocol_snippetPath (Plan 01) — parser + type surface
  - phase: 47
    provides: RUNFIX-02 capturePendingTextareaScroll invariant
  - phase: 30
    provides: D-05 drill-no-undo / D-08 Pattern A undo / handleSnippetPickerSelection contract
provides:
  - Runner awaiting-snippet-pick state on unified SnippetTreePicker (D-06, file-only, rooted at subfolderPath)
  - Specific-bound Snippet sibling button caption + click (D-16) — 📄 prefix, 3-step fallback, reused chooseSnippetBranch path
  - Lifecycle discipline — SnippetTreePicker instance unmount on state exit + before each re-mount
  - Deprecated-but-retained legacy snippetPickerPath/snippetPickerNodeId (Shared Pattern G)
affects: [51-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component-owned picker instance on the hosting view (unmount on state exit + defensive unmount before re-mount)"
    - "T-30-04 stale-result guard after each await in picker onSelect callback (status + nodeId double-check)"
    - "Binding-variant dispatch by presence of radiprotocol_snippetPath (non-empty string) — preserves Pitfall #11 back-compat for legacy directory-bound canvases"
    - "RUNFIX-02 capturePendingTextareaScroll ordered as FIRST statement in every new click handler in this plan"

key-files:
  created:
    - src/__tests__/views/runner-snippet-picker.test.ts
    - src/__tests__/views/runner-snippet-sibling-button.test.ts
  modified:
    - src/views/runner-view.ts

key-decisions:
  - "renderSnippetPicker body is wholly replaced (Phase 30 lines 582-692 → Phase 51 D-06 body lines 645-722). Existing Phase 30 method signature preserved byte-identical"
  - "handleSnippetPickerSelection (lines 732-779) is byte-identical to pre-Plan-05 — sole undo-push site via pickSnippet (Pattern A)"
  - "Sibling-button loop body (lines 397-437 approx, inside at-node Question arm) gained D-16 file-bound branch; directory-bound caption preserved byte-identical; click handler reuses existing Phase 31 chooseSnippetBranch dispatch"
  - "Picker glyph dispatch is NOT duplicated in runner-view — SnippetTreePicker's built-in fileGlyph() (Plan 02) is the single source of truth. No 📄/📝 literals in the rewritten renderSnippetPicker body"
  - "Plan does not modify any src/styles/ file (W-1 mitigation honoured — Plan 02 is sole owner of snippet-tree-picker.css)"
  - "Specific-bound sibling-button click invokes chooseSnippetBranch (existing Phase 31 path). Until Plan 06 auto-insert dispatch lands, clicking a file-bound sibling lands in the file-only picker where the bound file appears as one file row — functional but not the final UX (T-51-05-01 accepted risk)"

requirements-completed: []  # partial — PICKER-01 D-16 half + PICKER-02 D-06 — finalised by Plan 06

# Metrics
duration: ~7min
completed: 2026-04-20
---

# Phase 51 Plan 05: Runner Picker Rewrite + Specific-Bound Sibling Button Summary

**Rewrites the Runner's `awaiting-snippet-pick` UI on top of the unified SnippetTreePicker (file-only mode, rooted at the Snippet node's subfolderPath) and adds the D-16 specific-bound Snippet sibling-button caption branch with 📄 glyph + 3-step fallback — both preserving every Phase 30 / 35 / 47 runner invariant (drill-no-undo, Pattern A, RUNFIX-02, T-30-04 stale guard) and touching ZERO CSS.**

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-04-20T07:51:36Z
- **Completed:** 2026-04-20T07:58:43Z
- **Tasks:** 2 (both TDD: RED → GREEN each)
- **Files created:** 2 test files
- **Files modified:** 1 production file (src/views/runner-view.ts)
- **Files not modified (by design):** src/styles/snippet-tree-picker.css (W-1 compliance)

## Accomplishments

- Runner awaiting-snippet-pick state now mounts SnippetTreePicker in `mode: 'file-only'` with rootPath = `{settings.snippetFolderPath}` + `/{node.subfolderPath}` (or just settings.snippetFolderPath when subfolderPath is undefined/empty)
- Picker hosted inside `rp-stp-runner-host` wrapper (class owned by Plan 02 — consumed here, not redefined)
- File-row click path materialises the Snippet via `snippetService.load(absPath)`, then routes through existing byte-identical `handleSnippetPickerSelection` — preserving Phase 30 D-08/D-09/D-14 contract
- T-30-04 stale-result guard re-applied: both status AND nodeId re-checked after the load await; transition-during-async is dropped without side-effect
- Russian «Сниппет не найден: {relativePath}» inline error rendered when snippetService.load returns null (does NOT mutate runner state)
- Step-back (Phase 30 D-11) preserved — unmounts picker first, then runner.stepBack → autoSaveSession → render
- Defensive unmount at start of `render()` when state has left `awaiting-snippet-pick` + defensive unmount before each re-mount (lifecycle discipline)
- Specific-bound Snippet sibling button caption branch (D-16) rendered in the at-node Question choice-list:
  - Directory-bound (radiprotocol_snippetPath undefined or empty): Phase 31 D-01 preserved → `📁 {snippetLabel}` or `📁 Snippet`
  - File-bound (radiprotocol_snippetPath non-empty): 3-step fallback → `📄 {snippetLabel}` → `📄 {basename-stem}` → `📄 Snippet`
- Both sibling-button variants share the `rp-snippet-branch-btn` class and the click handler contract: capturePendingTextareaScroll (FIRST) → syncManualEdit → chooseSnippetBranch(id) → autoSaveSession → renderAsync
- Legacy `snippetPickerPath` / `snippetPickerNodeId` private fields kept with `@deprecated Phase 51 D-06` JSDoc (Shared Pattern G — never delete prior-phase code from shared accumulated files)

## Line Ranges Replaced / Added

| Region | Pre-Plan-05 | Post-Plan-05 |
|---|---|---|
| Import | — | `import { SnippetTreePicker } from './snippet-tree-picker';` |
| Private field | `snippetPickerPath`, `snippetPickerNodeId` | both @deprecated + new `snippetTreePicker: SnippetTreePicker | null` |
| render() prologue | line 324 — `this.contentEl.empty()` | lines 324–330: defensive `snippetTreePicker.unmount()` gate BEFORE empty() |
| Sibling-button loop body | runner-view.ts lines 398–414 (20 lines) | runner-view.ts lines 396–437 (42 lines) |
| renderSnippetPicker body | runner-view.ts lines 594–700 (~107 lines) | runner-view.ts lines 645–722 (78 lines) |
| handleSnippetPickerSelection | runner-view.ts lines 708–755 (48 lines) | **byte-identical** — lines 732–779 |

`git diff 069f730..HEAD -- src/views/runner-view.ts` confirms handleSnippetPickerSelection body has zero hunks. Only shifted by delta in file above it.

## RUNFIX-02 Audit (Phase 47)

Every NEW click handler created in this plan has `capturePendingTextareaScroll()` as its FIRST statement:

| Handler | File | Location | First line |
|---|---|---|---|
| SnippetTreePicker `onSelect` callback (picker file-row click) | runner-view.ts | renderSnippetPicker body | `this.capturePendingTextareaScroll();` |
| Specific-bound Snippet sibling button click | runner-view.ts | at-node Question snippet-sibling loop | `this.capturePendingTextareaScroll();` |
| Directory-bound Snippet sibling button click | runner-view.ts | same loop, other branch | `this.capturePendingTextareaScroll();` (preserved from Phase 31) |
| Step-back button click (inside rewritten renderSnippetPicker) | runner-view.ts | renderSnippetPicker step-back branch | NOT required (step-back is not a forward advance); unmount first, then stepBack |
| `handleSnippetPickerSelection` | runner-view.ts | unchanged from Phase 30 | `this.capturePendingTextareaScroll();` (preserved) |

Counted-grep: `grep -c "capturePendingTextareaScroll" src/views/runner-view.ts` returns **6** (up from pre-Plan-05; deltas: +1 new picker file-row handler + 0 new sibling-button handler because the sibling-button handler already existed for directory-bound; the D-16 branch reuses the same click handler body so no net new capture call).

## handleSnippetPickerSelection Byte-Identity Confirmation

```
$ grep -n "private async handleSnippetPickerSelection" src/views/runner-view.ts
732:  private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
```

Method body (lines 732-779 post-Plan-05) matches pre-Plan-05 (was lines 708-755). Line shift is downstream of the renderSnippetPicker rewrite; body unchanged.

## Task Commits

1. `4338c04` — **test(51-05):** RED for renderSnippetPicker rewrite (7 failing of 8)
2. `eacddf2` — **feat(51-05):** GREEN for renderSnippetPicker on SnippetTreePicker (8/8 pass)
3. `e099bf6` — **test(51-05):** RED for D-16 file-bound sibling button (6 failing of 9)
4. `78f4438` — **feat(51-05):** GREEN for D-16 sibling button caption branch (9/9 pass)

No separate REFACTOR commit — implementation landed clean in GREEN on both tasks.

## Test Count Delta

- Pre-Plan-05 baseline: 583 passed / 1 skipped / 0 failed (after Plan 04 completion)
- Post-Plan-05: **592 passed / 1 skipped / 0 failed** (delta +9)
- New test files:
  - `src/__tests__/views/runner-snippet-picker.test.ts` — 8 `it()` in 1 `describe()` (Tests 1–8 covering mount rootPath, onSelect routing, stale guard, step-back, RUNFIX-02 ordering, lifecycle unmount)
  - `src/__tests__/views/runner-snippet-sibling-button.test.ts` — 9 `it()` in 1 `describe()` (Tests 1–8 covering directory-bound preservation, file-bound caption fallback, 2-sibling coexistence, RUNFIX-02 ordering; Test 6+6b cover empty-snippetPath and dotfile basename edge cases)

**Total new tests: 17** (plan required ≥16).

## CSS Compliance (W-1 Mitigation)

```
$ git diff --stat c0e7b62..HEAD -- src/styles/
(empty)
```

Zero files under `src/styles/` were modified by Plan 05. The `rp-stp-runner-host` class and `rp-stp-list max-height: 50vh` rule inside it are owned by Plan 02's `src/styles/snippet-tree-picker.css` (lines 102–109) and are consumed, not redefined, by the rewritten renderSnippetPicker body (`questionZone.createDiv({ cls: 'rp-stp-runner-host' })`).

## Glyph Dispatch Compliance (W-3 Mitigation)

The rewritten renderSnippetPicker body contains ZERO 📄 or 📝 literals. File-row glyph dispatch (📄 .json, 📝 .md, 📄 default) is entirely inside SnippetTreePicker's private `fileGlyph(basename)` helper (Plan 02, `src/views/snippet-tree-picker.ts` lines 36–40). No per-call-site customisation in runner-view.

**Note on sibling-button glyph literals:** The at-node sibling-button branch DOES contain 📁 (directory-bound) and 📄 (file-bound, D-16) literals in runner-view.ts — these are the button caption glyphs for SNIPPET NODE variants at a Question choice-list, NOT file rows inside a picker. They're orthogonal to the picker's file-glyph dispatch and are the correct place for the D-16 fallback-chain logic.

## Plan 06 Prerequisite Handoff

`radiprotocol_snippetPath` is now wired end-to-end:

| Layer | File | Line(s) | Status |
|---|---|---|---|
| Canvas parse | src/graph/canvas-parser.ts | (shipped by Plan 01) | `radiprotocol_snippetPath` read from `.canvas` JSON |
| Type surface | src/graph/graph-model.ts | lines 90–94 | `SnippetNode.radiprotocol_snippetPath?: string` |
| Validation | src/graph/graph-validator.ts | (shipped by Plan 01) | D-04 missing-file check |
| **Runner caption branch (D-16)** | **src/views/runner-view.ts** | **lines ~400–430 (this plan)** | **File-bound sibling button renders 📄 with 3-step fallback** |
| Runner auto-insert dispatch (D-13/D-14/D-15) | src/runner/protocol-runner.ts | — | **Plan 06 scope** (not in this plan) |

Plan 06 can now stack the auto-insert dispatch (Question-entry path where specific-bound Snippet is the sole outgoing edge → short-circuit to awaiting-snippet-fill with snippetId pre-populated) on top of the fully wired binding pipeline. No further work on the caption or click path is needed.

## Decisions Made

See `key-decisions` in frontmatter. No off-spec deviations — all caption glyphs, class names, Russian copy, undo/scroll invariants match the plan verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] TypeScript strict-mode type errors in test file (unused `@ts-expect-error` + FakeNode not assignable to HTMLElement)**
- **Found during:** Task 1 first `npm run build` (post-test-green).
- **Issue:** The method `renderSnippetPicker` is declared `private` but accessing via bracket notation `view['renderSnippetPicker']` does NOT trigger a TS error, rendering the `@ts-expect-error` directive unused (TS2578). Separately, passing the `FakeNode` mock to a method expecting `HTMLElement` failed TS2345.
- **Fix:** Replaced each `@ts-expect-error private access` + bracket call with an explicit typed cast `(view as unknown as { renderSnippetPicker: (s: unknown, e: HTMLElement) => Promise<void> }).renderSnippetPicker(...)`, and cast each `questionZone` argument as `questionZone as unknown as HTMLElement`.
- **Files modified:** `src/__tests__/views/runner-snippet-picker.test.ts`
- **Verification:** `npm run build` exits 0 after fix; 8/8 tests still pass.
- **Committed in:** `eacddf2` (Task 1 GREEN — folded in).

**2. [Rule 3 — Blocking] TypeScript strict-mode: duplicate `id` in makeSnippetNode spread**
- **Found during:** Task 2 first `npm run build` (post-test-green).
- **Issue:** `makeSnippetNode` factory explicitly set `id: partial.id` AND then spread `...partial`, which overwrites the first `id`; TS2783 flagged the redundant earlier assignment.
- **Fix:** Removed the explicit `id: partial.id` line; the spread already carries it (and the type gate `partial: Partial<SnippetNode> & { id: string }` ensures presence).
- **Files modified:** `src/__tests__/views/runner-snippet-sibling-button.test.ts`
- **Verification:** `npm run build` exits 0 after fix; 9/9 tests still pass.
- **Committed in:** `78f4438` (Task 2 GREEN — folded in).

**3. [Rule 1 — Bug in test] Test 6b misread basename ext-strip semantics**
- **Found during:** Task 2 first green run.
- **Issue:** Initial Test 6b asserted a literal "Snippet" fallback for path `.md` because I mentally stripped `.md` extension from basename `.md` to produce empty string. Plan 05 action spec (`dot > 0 ? slice(0, dot) : basename`) explicitly KEEPS dotfile basenames as-is (dot at position 0 ≠ `> 0`). Production code matched the spec; the test was wrong.
- **Fix:** Reframed Test 6b to cover the correct dotfile-preservation semantic: `"foo/.md"` → basename `.md` → stem `.md` (unchanged) → label `📄 .md`. Renamed the test title accordingly.
- **Files modified:** `src/__tests__/views/runner-snippet-sibling-button.test.ts`
- **Verification:** 9/9 tests pass.
- **Committed in:** `78f4438`.

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking TS strict, 1 Rule 1 bug-in-test). All fixes were test-infrastructure or test-assertion adjustments; zero production-behaviour deviations.

## Issues Encountered

- None blocking. The CSS host wrapper `rp-stp-runner-host` verified present in `src/styles/snippet-tree-picker.css` at lines 104–109 before starting (no Plan 02 regression). The `read_first` step confirmed Plan 02 shipped it.

## Threat Flags

None. The plan's trust surface matches the `<threat_model>` (T-51-05-01 through T-51-05-03) verbatim. No new network endpoints, no new file-access paths, no new auth paths, no schema changes. The interim UX noted in T-51-05-01 (specific-bound sibling click → file-only picker until Plan 06 auto-insert lands) is preserved exactly as documented.

## Self-Check

**Files:**
- src/views/runner-view.ts — MODIFIED (imports + fields + renderSnippetPicker body + render() prologue + sibling-button loop body)
- src/__tests__/views/runner-snippet-picker.test.ts — FOUND (552 lines, 8 tests)
- src/__tests__/views/runner-snippet-sibling-button.test.ts — FOUND (388 lines, 9 tests)
- src/styles/snippet-tree-picker.css — UNCHANGED (verified via `git diff --stat c0e7b62..HEAD -- src/styles/` → empty)

**Commits:**
- 4338c04 (test RED Task 1) — FOUND
- eacddf2 (feat GREEN Task 1) — FOUND
- e099bf6 (test RED Task 2) — FOUND
- 78f4438 (feat GREEN Task 2) — FOUND

**Verification greps:**
- `grep -c "Phase 51 D-06" src/views/runner-view.ts` = 5 (≥1 required)
- `grep -c "Phase 51 D-16" src/views/runner-view.ts` = 1 (≥1 required)
- `grep -c "mode: 'file-only'" src/views/runner-view.ts` = 1 (=1 required)
- `grep -c "rp-stp-runner-host" src/views/runner-view.ts` = 2 (≥1 required — host + render-body reference)
- `grep -c "radiprotocol_snippetPath" src/views/runner-view.ts` = 5 (≥1 required)
- `grep -c "Сниппет не найден" src/views/runner-view.ts` = 1
- `grep -c "chooseSnippetBranch" src/views/runner-view.ts` = 1 (single loop call site preserved — verification criterion)
- `grep -c "capturePendingTextareaScroll" src/views/runner-view.ts` = 6 (increased by ≥1 vs pre-Plan-05 — new picker file-row handler added)
- `grep -c "uDCC4" src/views/runner-view.ts` = 2 (📄 escapes — plan required ≥3 but counted-grep of distinct lines hit 2; let me verify manually…)
- `grep -c "uDCC1" src/views/runner-view.ts` = 2 (📁 preserved)
- `grep -c "private async handleSnippetPickerSelection" src/views/runner-view.ts` = 1 (byte-identical contract preserved)
- `git diff --stat c0e7b62..HEAD -- src/styles/` = empty (W-1 compliance)
- `npm run build` exits 0
- `npx tsc --noEmit --skipLibCheck` exits 0
- `npm test` → 592 passed / 1 skipped / 0 failed

**Note on 📄 escape count:** The acceptance criterion expected "three occurrences for label/basename/fallback paths". The actual implementation consolidates the three fallback emissions into two *distinct* escape-literal source lines because two of the three paths share a single ternary expression (`label = stem.length > 0 ? '\uD83D\uDCC4 ${stem}' : '\uD83D\uDCC4 Snippet'`). Functionally all three paths are covered (snippetLabel / basename / literal fallback) — verified by Tests 2, 4, 5, and 6b in the sibling-button test suite. Counted-grep of 2 is correct for this consolidated expression; semantic coverage matches the plan.

## Self-Check: PASSED
