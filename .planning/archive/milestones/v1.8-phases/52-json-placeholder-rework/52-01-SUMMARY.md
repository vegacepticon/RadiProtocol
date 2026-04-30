---
phase: 52-json-placeholder-rework
plan: 01
subsystem: testing
tags: [tdd, red-phase, vitest, snippet-placeholder, mockel, type-narrowing]

# Dependency graph
requires:
  - phase: 51-snippet-picker-overhaul
    provides: runner-snippet-picker.test.ts baseline + SnippetTreePicker mode="file-only"
  - phase: 33-snippet-editor-modal
    provides: SnippetEditorModal + snippet-chip-editor mountChipEditor API
  - phase: 32-snippet-model-refactor
    provides: Snippet discriminated union (JsonSnippet | MdSnippet) on 'kind'
provides:
  - 4 new test files pinning the Phase 52 two-type union contract (D-01..D-09)
  - 2 existing test files updated with validationError + separator forward-compat
  - 20 RED tests ready for Plans 02-04 to flip GREEN
  - Inline MockEl infrastructure replicated across 3 new view-level test files
    (vitest env='node'; jsdom not available)
affects: 52-02 (model narrow), 52-03 (chip + fill-in rewire), 52-04 (banner + runner surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MockEl inline per-file (pattern copied from snippet-editor-modal.test.ts): lightweight DOM-ish element supporting querySelector/All, classList, event dispatch, textContent/value/disabled/type accessors"
    - "Forward-compat casts (`as unknown as T & { newField: ... }`) for fixtures that carry Plan-02/03 fields (validationError, separator) before the interface narrows"
    - "vi.mock('obsidian', ...) factory per file installing Modal with MockEl contentEl — enables modal tests to run without jsdom"
    - "Russian error copy locked verbatim in banner_and_error_copy (Text A/B/C/D) mirrored into test assertions"

key-files:
  created:
    - src/__tests__/snippet-service-validation.test.ts
    - src/__tests__/views/snippet-fill-in-modal.test.ts
    - src/__tests__/views/snippet-chip-editor.test.ts
    - src/__tests__/views/snippet-editor-modal-banner.test.ts
  modified:
    - src/__tests__/snippet-model.test.ts
    - src/__tests__/views/runner-snippet-picker.test.ts

key-decisions:
  - "Inline MockEl per file instead of extracting a shared helper — each test file is self-contained and independently mountable; Plans 02-04 can rewrite production code without rippling into test-infra files"
  - "Forward-compat casts (`as unknown as ...`) instead of `satisfies` — tsc strict mode required the double-cast for excess-property tolerance on JsonSnippet.validationError and SnippetPlaceholder.separator"
  - "A5 PH_COLOR probe tests runtime color rather than the dictionary keys — less brittle, allows Plan 03 to decide between PH_COLOR narrowing vs leaving dead-code keys"
  - "B5 control test (valid snippet → no banner) asserts Save is NOT disabled; collision-error path may still disable Save so the assertion is gated on saveBtn presence"

patterns-established:
  - "Per-file inline MockEl: avoid cross-file test coupling for view-level TDD"
  - "Double-cast forward-compat: `{ ...new-fields } as unknown as T & { field: ... }` is the canonical way to author tests that precede interface narrowing"
  - "T-52-01 / T-52-03 acceptance: `grep -rn 'innerHTML' <new-files>` returns zero across all 4 new files"

requirements-completed: []  # PHLD-01 is multi-plan; this plan alone does not close it (RED phase only)

# Metrics
duration: ~35m
completed: 2026-04-20
---

# Phase 52 Plan 01: Wave 0 Test Scaffolding Summary

**RED-phase TDD baseline: 20 failing tests across 4 new files + 2 updated files pin the D-01..D-09 two-type-union contract so Plans 02-04 can flip them GREEN without shape drift.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-20T17:58Z (baseline test count)
- **Completed:** 2026-04-20T18:15Z
- **Tasks:** 5 (all autonomous; one post-commit tsc fix)
- **Files modified:** 6 (exactly as plan frontmatter `files_modified` specifies)

## Accomplishments

- **snippet-model.test.ts updated** — 2 existing describes adjusted, 2 deleted, 1 rewritten: zero `'number'`, zero `'multi-choice'`, zero `joinSeparator`, zero `unit:` literals. Two SnippetFile fixtures carry `validationError: null` forward-compat.
- **runner-snippet-picker.test.ts** — appended Phase 52 D-04 describe block with broken-snippet fixture (file had zero `kind: 'json'` fixtures so no in-place edits were needed).
- **snippet-service-validation.test.ts (NEW)** — 9 RED tests covering SnippetService.load / listFolder + D-03 validationError contract for 'number' / 'multichoice' / 'multi-choice' / 'choice'-with-empty-options + silent-skip preservation + MdSnippet unaffected.
- **snippet-fill-in-modal.test.ts (NEW)** — 9 tests covering D-05 unified checkbox rendering, default/override separator, array-order preservation, D-06 Custom override, D-09 empty-state, free-text unchanged.
- **snippet-chip-editor.test.ts (NEW)** — 5 tests: A1/A3 (two-option type-selector RED), A2 (SC 2 options-list regression GREEN — D-08 bug non-reproducible per RESEARCH), A4 (Разделитель label RED), A5 (PH_COLOR probe GREEN).
- **snippet-editor-modal-banner.test.ts (NEW)** — 5 tests: B1-B3 banner rendering RED, B4 XSS textContent-guard RED, B5 valid-snippet no-banner control GREEN.
- **T-52-01 / T-52-03 compliance:** zero `innerHTML` references in all four new files.
- **tsc exit 0** after a post-commit `as unknown as` cast tightening in snippet-model.test.ts.

## Task Commits

1. **Task 01: Update snippet-model.test.ts fixtures** — `e33b99a` (test)
2. **Task 02: Append Phase 52 describe to runner-snippet-picker.test.ts** — `0ee9100` (test)
3. **Task 03: Create snippet-service-validation.test.ts** — `6382186` (test)
4. **Task 04: Create snippet-fill-in-modal.test.ts** — `08af83c` (test)
5. **Task 05: Create snippet-chip-editor.test.ts + snippet-editor-modal-banner.test.ts** — `384c65d` (test)
6. **Post-commit tsc fix: forward-compat casts in snippet-model.test.ts** — `63b2e96` (fix)

## Files Created/Modified

- `src/__tests__/snippet-model.test.ts` — Phase-52 fixtures; drops `'number'`/`'multi-choice'`/`joinSeparator`/`unit:`; adds `validationError: null` + `separator`
- `src/__tests__/views/runner-snippet-picker.test.ts` — append-only Phase 52 D-04 describe + broken-snippet fixture
- `src/__tests__/snippet-service-validation.test.ts` (NEW) — 9 RED tests, D-03 contract
- `src/__tests__/views/snippet-fill-in-modal.test.ts` (NEW) — 9 tests, D-05/D-06/D-09 RED
- `src/__tests__/views/snippet-chip-editor.test.ts` (NEW) — 5 tests, narrowing probes + SC 2 regression guard
- `src/__tests__/views/snippet-editor-modal-banner.test.ts` (NEW) — 5 tests, D-04 banner + XSS guard

## Decisions Made

- **Inline MockEl per file, not shared helper.** Each test file owns its own MockEl factory. Plans 02-04 rewriting production code won't ripple into a shared test-infra file; reduces merge-conflict risk if plans run in parallel later.
- **`as unknown as T & { newField: ... }` for forward-compat fixtures.** The naive single-cast (`as T`) triggers TS18048 / TS2352 for excess properties (`validationError`, `separator`). Double-cast via `unknown` is the canonical tolerance path and becomes redundant-but-harmless once Plan 02 narrows the interfaces.
- **A5 tests runtime color, not PH_COLOR dictionary directly.** `PH_COLOR` isn't exported — the test asserts the rendered chip's `style['borderLeftColor']` contains `orange` for a `choice` placeholder. Plan 03 can independently decide whether to narrow the dictionary or leave dead keys; this test only cares about the observable post-narrow behaviour.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] runner-snippet-picker.test.ts has no `kind: 'json'` fixtures**
- **Found during:** Task 02
- **Issue:** Plan task text asserted fixtures at `:316` and `:479` are `kind: 'json'` — the actual file (561 lines) has only `kind: 'md'` fixtures at those line numbers. Acceptance criterion `grep -c "validationError: null" >= N where N = count of "kind: 'json'"` resolves to N=0 (trivially satisfied).
- **Fix:** Skipped Step-1 in-place edits (no matching targets). Proceeded with Step-2 appended Phase 52 D-04 describe block verbatim. Added acceptance-criterion note in commit message.
- **Files modified:** src/__tests__/views/runner-snippet-picker.test.ts
- **Verification:** `grep -c "describe('Phase 52 D-04"` returns 1; vitest passes 9 tests (was 8 + 1 new).
- **Committed in:** `0ee9100`

**2. [Rule 3 - Blocking] vitest environment is 'node' (no jsdom installed)**
- **Found during:** Task 04 (snippet-fill-in-modal.test.ts infrastructure)
- **Issue:** Plan action block suggested `jsdom` DOM + `modal.contentEl.querySelectorAll`. Project has `environment: 'node'` in `vitest.config.ts`, and neither `jsdom` nor `happy-dom` is in `package.json`. The standard `src/__mocks__/obsidian.ts` Modal.contentEl returns a mock with no `querySelector` support.
- **Fix:** Adopted the inline MockEl pattern from `src/__tests__/snippet-editor-modal.test.ts` (already in the codebase). Each of the 3 new view-level test files carries its own MockEl factory + a local `vi.mock('obsidian', …)` override installing the DOM-ish Modal.
- **Files modified:** snippet-fill-in-modal.test.ts, snippet-chip-editor.test.ts, snippet-editor-modal-banner.test.ts
- **Verification:** All 3 files run; A2 / B5 GREEN (control), all other view-level tests RED for the intended Phase-52 production-code reasons (radios still render for 'choice', 4-option type-select, no banner yet).
- **Scope check:** MockEl adds ~130 lines per file but stays inside the 6 files allowed by plan. Zero touches to production code, zero changes to package.json/vitest.config.ts.

**3. [Rule 1 - Bug] B4 test name contained literal "innerHTML" string, violating T-52-01 grep guard**
- **Found during:** post-Task-05 acceptance re-check (`grep -rn "innerHTML"` must return zero).
- **Issue:** B4 test was named `'...never innerHTML (T-52-03 guard)'`; grep-based acceptance guard flagged the literal.
- **Fix:** Renamed to `'B4: banner renders error via textContent (T-52-03 XSS guard)'`. Test body unchanged.
- **Files modified:** snippet-editor-modal-banner.test.ts
- **Verification:** `grep -c innerHTML` across all 4 new files = 0.
- **Committed in:** `384c65d` (combined with Task 05)

**4. [Rule 1 - tsc] snippet-model.test.ts excess-property errors on separator / validationError**
- **Found during:** post-Task-05 `npx tsc --noEmit --skipLibCheck` (success criterion requires exit 0).
- **Issue:** TS2339 on `p.separator` and TS2352 on `{ ... } as SnippetFile` with a fixture carrying `validationError` and a placeholder carrying `separator`. The single-cast approach hit the "types don't sufficiently overlap" guard.
- **Fix:** Switched to double-cast `as unknown as T & { newField: ... }` for the SnippetPlaceholder fixture and `as unknown as SnippetFile` for the two SnippetFile fixtures.
- **Files modified:** src/__tests__/snippet-model.test.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` exits 0; all 8 tests still pass.
- **Committed in:** `63b2e96` (separate fix commit)

---

**Total deviations:** 4 auto-fixed (1 Rule 1 test-name fix, 1 Rule 1 tsc fix, 2 Rule 3 blocking-infra)
**Impact on plan:** All four deviations were infra-level (MockEl, tsc casts, minor text). None touched production code or the Phase 52 contract under test. The plan's TDD-RED goal — failing tests that Plan 02-04 will flip — is fully satisfied (20 RED / 7 new GREEN).

## Issues Encountered

- **Win32 CRLF warnings on every `git add`** — documented behaviour, no action needed; autocrlf handles normalisation on commit.
- **A5 test passes GREEN pre-Plan-03** — this is per-plan expected ("A5 TBD"). The current production `PH_COLOR['choice']` already returns `var(--color-orange)`, so the runtime probe passes without Plan-03 narrowing the dictionary. Flag for Plan 03 to explicitly narrow `PH_COLOR` keys (or document as harmless dead code).

## TDD Gate Compliance

- **Plan-level RED gate satisfied:** 20 new RED tests across the 4 new test files (snippet-service-validation: 6; snippet-fill-in-modal: 7; snippet-chip-editor: 3; snippet-editor-modal-banner: 4).
- **Baseline preservation:** pre-existing 612 tests all remain GREEN. Suite totals: 619 passed / 1 skipped / 20 failed (640 total) vs baseline 612 / 1 / 0 (613). Delta: +27 tests, of which +20 RED (new Phase-52 contract) and +7 GREEN (fixture-update GREENs + regression-guard + controls).
- **GREEN gate:** not applicable — this is the RED-only wave. Plans 02-04 own the GREEN commits.
- **No passing-RED surprise:** zero Phase 52 narrowing probes accidentally pass (all intended-RED tests fail for the documented reason: type selector still has 4 options, renderField dispatches to radios for 'choice', no banner rendering, validationError field absent from JsonSnippet).

## Threat Flags

No new threat surface introduced. Threat-model items T-52-01 / T-52-02 / T-52-03 from PLAN.md are asserted by the tests themselves (zero `innerHTML` references; textContent-based banner assertion; crafted `<script>` substring test in B4).

## Self-Check: PASSED

- Files created confirmed:
  - `src/__tests__/snippet-service-validation.test.ts` FOUND
  - `src/__tests__/views/snippet-fill-in-modal.test.ts` FOUND
  - `src/__tests__/views/snippet-chip-editor.test.ts` FOUND
  - `src/__tests__/views/snippet-editor-modal-banner.test.ts` FOUND
- Commits exist:
  - `e33b99a` FOUND
  - `0ee9100` FOUND
  - `6382186` FOUND
  - `08af83c` FOUND
  - `384c65d` FOUND
  - `63b2e96` FOUND
- `grep -rn innerHTML` across the 4 new files returns 0 matches.
- `npx tsc --noEmit --skipLibCheck` exits 0.
- Baseline non-Phase-52 tests: 619 passed (612 baseline + 7 Phase 52 GREEN) — zero regressions.
- Exactly 6 test files modified under src/ (matches `files_modified` frontmatter).

## Next Phase Readiness

- **Plan 02 unblocked:** model + service narrowing can proceed against a committed RED baseline. Expected GREEN flips: snippet-model.test.ts fixtures already accept `validationError: null` / `separator`; snippet-service-validation.test.ts will turn GREEN as SnippetService.load/listFolder return `validationError`.
- **Plan 03 unblocked:** chip-editor + fill-in modal rewire; expected GREEN flips: A1/A3/A4 (two-option type-select + Разделитель label), all 7 RED tests in snippet-fill-in-modal.test.ts (checkbox-only rendering + separator logic).
- **Plan 04 unblocked:** banner + runner error surface; expected GREEN flips: B1-B4 + the broken-snippet fixture in runner-snippet-picker.test.ts appended describe.
- **No blockers.** Plan 02 may run immediately; Plans 03/04 depend on Plan 02's interface narrowing.

---
*Phase: 52-json-placeholder-rework*
*Plan: 01 (Wave 0 Test Scaffolding, TDD RED)*
*Completed: 2026-04-20*
