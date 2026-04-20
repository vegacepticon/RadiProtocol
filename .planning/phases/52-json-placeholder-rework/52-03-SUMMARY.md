---
phase: 52-json-placeholder-rework
plan: 03
subsystem: snippets
tags: [tdd, green-phase, ui-narrowing, unified-choice, phase-52]

# Dependency graph
requires:
  - phase: 52-json-placeholder-rework
    plan: 02
    provides: "Narrowed SnippetPlaceholder['type']='free-text'|'choice' + JsonSnippet.validationError non-optional + LegacyPlaceholder tsc-tolerance alias in two view files awaiting removal"
  - phase: 52-json-placeholder-rework
    plan: 01
    provides: "10 Wave-3-owned RED tests (A1/A3/A4/A5 chip-editor + D-05/D-06/D-09 fill-in-modal)"
provides:
  - Chip editor speaks the 2-type contract: PH_COLOR narrowed, mini + expanded selects narrowed, separator binding, renderNumberExpanded deleted
  - Fill-in modal dispatch narrowed to 2 branches; renderChoiceField renders checkboxes only; reads placeholder.separator
  - Full removal of Wave 2 LegacyPlaceholder alias + `as unknown as LegacyPlaceholder` casts from both view files
  - 10 Plan 01 RED tests flipped GREEN (3 chip-editor A1/A3/A4 + 7 fill-in-modal D-05/D-06/D-09)
  - A5 PH_COLOR probe flipped GREEN as side-effect
affects: 52-04 (banner surface + runner error-panel — the only remaining RED tests belong here; Plan 04 is unblocked)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mechanical removal of tsc-tolerance alias: grep LegacyPlaceholder returned 0 in src/views/ after the 2 targeted edits"
    - "renderChoiceField signature dropped isMulti parameter; checkbox-only rendering is now unconditional"
    - "Chip editor `Разделитель` section now runs for every `choice` placeholder (unified-choice — 0/1/many checks all use the same separator path)"

key-files:
  created: []
  modified:
    - src/views/snippet-chip-editor.ts
    - src/views/snippet-fill-in-modal.ts

key-decisions:
  - "Russian «Разделитель» label chosen for the separator field (per CONTEXT's Claude's Discretion — existing project UI surface for this field is user-facing and Russian per Phase 50.1 precedent)."
  - "renderField: unknown types render nothing (defensive silence). Plan 04 banner guards upstream via validationError — matches threat T-52-08 disposition."
  - "Dropped `isMulti` parameter from renderChoiceField entirely (RESEARCH-preferred option). Callsite in renderField passes only (container, placeholder). Simplifies dispatch + eliminates the radio branch unreachable code."
  - "recomputeValue: removed the `else if (isMulti)` / `else` fork. Empty-state D-09 (`''`) is now an emergent property of `checkboxEls.filter(cb=>cb.checked).map(...).join(sep)` returning `[].join(sep) === ''`."

patterns-established:
  - "LegacyPlaceholder alias tracking worked: `grep LegacyPlaceholder src/views/` gave Plan 03 the exact unwind map. After this plan the grep returns 0 across src/."

requirements-completed: []  # PHLD-01 is multi-plan; Plan 03 flips UI tier but Plan 04 closes banner+runner.

# Metrics
duration: ~4m
completed: 2026-04-20
---

# Phase 52 Plan 03: Chip Editor and Fill-In Modal Narrowing Summary

**TDD GREEN-phase wave: narrowed the snippet UI tier (chip editor + fill-in modal) to the 2-type contract — PH_COLOR / type selects / renderField dispatch all collapsed to `free-text`+`choice`, renderNumberExpanded and renderNumberField deleted, every Wave 2 `LegacyPlaceholder` tsc-tolerance alias and `as unknown as` cast removed, 10 Plan 01 RED tests flipped GREEN.**

## Performance

- **Started:** 2026-04-20T15:33Z
- **Completed:** 2026-04-20T15:36Z (~4 min including verification)
- **Tasks:** 2 (Task 01: chip editor narrowing; Task 02: fill-in modal narrowing)
- **Commits:** 2
- **Files modified:** 2 (exactly the plan's `files_modified` scope — zero leakage)

## Accomplishments

- **snippet-chip-editor.ts** narrowed:
  - `PH_COLOR` now `Record<SnippetPlaceholder['type'], string>` with exactly 2 keys (`'free-text'` + `'choice'`).
  - Mini-form type-select (`phTypes`) renders exactly 2 options: Free text, Choice.
  - Expanded-chip type-select (`phTypesLocal`) renders exactly 2 options.
  - New-placeholder factory drops the `multi-choice`/`number` spreads; only adds `options: []` for `choice`.
  - Chip-click expand dispatch simplified to a single `renderExpandedPlaceholder(...)` call (no `number` fork).
  - `renderNumberExpanded` function **deleted in full**.
  - Expanded type-change handler: on `free-text` drops `options` + `separator`; on `choice` ensures `options = options ?? []`.
  - Разделитель section now renders for **all** `choice` placeholders (not gated on `multi-choice`), binds `ph.separator`, label text «Разделитель».
  - `LegacyPlaceholder` alias + every `as unknown as LegacyPlaceholder` cast removed.
- **snippet-fill-in-modal.ts** narrowed:
  - `renderField` dispatch collapsed to exactly 2 branches (`free-text` → `renderFreeTextField`, `choice` → `renderChoiceField`). Unknown types render nothing.
  - `renderNumberField` method **deleted in full**.
  - `renderChoiceField` lost its `isMulti` parameter; always renders `type: 'checkbox'` controls.
  - `recomputeValue` reads `placeholder.separator ?? ', '` (not `joinSeparator`); single join path handles 0/1/many checked checkboxes naturally.
  - D-06 Custom free-text override behaviour preserved byte-identical (clear-on-check, clear-on-type, precedence when non-empty).
  - `LegacyPlaceholder` alias + every `as unknown as LegacyPlaceholder` cast removed.
- **Plan 01 RED tests flipped:**
  - `snippet-chip-editor.test.ts`: A1 (mini-form 2 options), A3 (expanded 2 options), A4 (separator binding + «Разделитель» label), A5 (PH_COLOR orange for choice) — 4 now GREEN. A2 (SC 2 regression guard) remains GREEN as before. Total 5/5.
  - `snippet-fill-in-modal.test.ts`: all 9 tests GREEN (6 D-05 + 2 D-06 + 1 free-text).
- **Zero regressions:** 635 passed vs 625 baseline → +10 delta exactly matching Plan 01 prediction.

## Task Commits

1. **Task 01 (chip editor narrowing):** `7d17039` — feat(52-03): narrow snippet-chip-editor to 2-type contract
2. **Task 02 (fill-in modal narrowing):** `9f1f23d` — feat(52-03): narrow snippet-fill-in-modal to unified-choice dispatch

## Files Modified

### In plan `files_modified` (authoritative scope)
- `src/views/snippet-chip-editor.ts` — −110/+21 lines net after counting removals; PH_COLOR / phTypes / phTypesLocal / factory / chip-click / type-change handler / separator section / renderNumberExpanded deletion all landed in the 2-type narrowed contract.
- `src/views/snippet-fill-in-modal.ts` — −81/+17 lines net; renderField dispatch / renderNumberField deletion / renderChoiceField simplification all landed.

### Out of scope
None. Test files unchanged (Wave 2 fixture updates were sufficient; the 10 target tests already construct snippets with the narrowed 2-type contract).

## Before/After Test Counts

| Metric | Baseline (pre-Plan-03, post-Plan-02) | After Plan 03 | Delta |
|---|---|---|---|
| Passed | 625 | 635 | +10 |
| Failed | 14 | 4 | −10 |
| Skipped | 1 | 1 | 0 |
| Total | 640 | 640 | 0 |
| Test files failing | 3 | 1 | −2 |

### Remaining RED (per plan — Plan 04 will flip)

| File | RED count | Owner plan | Why still RED |
|---|---|---|---|
| src/__tests__/views/snippet-editor-modal-banner.test.ts | 4 (B1, B2, B3, B4) | Plan 04 | No banner DOM surface for `validationError` exists yet; Plan 04 adds it. |

Chip-editor and fill-in-modal test files are **fully GREEN**. `npm test` ends with `4 failed | 635 passed | 1 skipped (640)` — exactly matching the plan's `<verification>` prediction.

## Decisions Made

- **Russian «Разделитель» label** chosen for the separator field (CONTEXT explicitly flagged this as Claude's Discretion — English «Join separator» was acceptable but Russian matches the broader Phase 50.1 surface pattern for user-facing labels).
- **Dropped `isMulti` parameter entirely from `renderChoiceField`** rather than hardcoding `true` at the callsite. Cleaner signature, impossible to accidentally pass `false`, and the internal code path simplifies to a single join branch.
- **renderField unknown-type arm = defensive silence**. No `throw`, no `console.warn`. Plan 04 adds the banner guard upstream so any snippet that would reach `renderField` with a non-2-type placeholder is already blocked by validationError at the modal/runner layer.
- **Empty-state behaviour for 0-checked + empty-Custom = `''`** emerges naturally from `[].join(sep) === ''`. No explicit branch needed. Matches D-09 contract.

## Deviations from Plan

None. Plan executed exactly as written. All 8 patches (6 in chip-editor + 2 in fill-in-modal) applied without deviation. Zero Rule 1/2/3 auto-fixes needed. Zero Rule 4 escalations.

## Issues Encountered

None.

## TDD Gate Compliance

- **RED commit (Wave 1):** `6382186` (Plan 01 Task 03 — snippet-fill-in-modal.test.ts) and the surrounding Plan 01 commits that established the A1/A3/A4/A5 probes in snippet-chip-editor.test.ts.
- **GREEN commits (Wave 3):** `7d17039` + `9f1f23d` — both target files now speak the narrowed contract, all 10 Plan 01 RED tests GREEN.
- **REFACTOR gate:** not applicable — Plan 03 is still feature-GREEN closing. Plan 04 continues on this baseline.

## Next Phase Readiness

- **Plan 04 unblocked.** The only remaining RED tests (B1-B4) are all in `snippet-editor-modal-banner.test.ts` — exactly Plan 04's scope. No `LegacyPlaceholder` / `joinSeparator` / `'multi-choice'` / `'number'` references remain anywhere in src/ (the Wave 2 tsc-tolerance pollution is fully cleaned).
- **No cross-plan blockers.** Plan 04 can proceed immediately.

## Threat Flags

No new threat surface introduced. T-52-07 (separator input writes to ph.separator) accepted per threat register — Phase 32 V5 `sanitizeJson` is the existing control. T-52-08 (checkbox dispatch for legacy-typed placeholder) mitigated as planned: `renderField`'s narrowed dispatch has no arm for `number`/`multi-choice`, so unknown-type placeholders render nothing (defensive silence).

## Self-Check: PASSED

- Commits exist:
  - `7d17039` FOUND (Task 01)
  - `9f1f23d` FOUND (Task 02)
- Plan `files_modified` scope check:
  - `src/views/snippet-chip-editor.ts` — modified ✓
  - `src/views/snippet-fill-in-modal.ts` — modified ✓
- Out-of-scope production edits: **none** ✓
- LegacyPlaceholder / tsc-tolerance cleanup: `grep LegacyPlaceholder src/` returns 0 ✓
- `grep "as unknown as"` in both target files returns 0 ✓
- Grep acceptance criteria — `src/views/snippet-chip-editor.ts`:
  - `'multi-choice'` count = 0 ✓
  - `'number'` count = 0 ✓
  - `joinSeparator` count = 0 ✓
  - `renderNumberExpanded` count = 0 ✓
  - `ph.unit` count = 0 ✓
  - `ph.separator` count = 3 (≥ 2) ✓
  - `'free-text'` count = 4 (≥ 4) ✓
  - `'choice'` count = 6 (≥ 5) ✓
- Grep acceptance criteria — `src/views/snippet-fill-in-modal.ts`:
  - `renderNumberField` count = 0 ✓
  - `joinSeparator` count = 0 ✓
  - `placeholder.unit` count = 0 ✓
  - `'multi-choice'` count = 0 ✓
  - `'number'` count = 0 ✓
  - `type === 'choice'` count = 1 (≥ 1) ✓
  - `placeholder.separator` count = 1 (= 1) ✓
  - `type: 'checkbox'` count = 1 (≥ 1) ✓
  - `isMulti` count = 0 ✓
- `npx tsc --noEmit --skipLibCheck` exits 0 ✓
- `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts` → 5/5 PASS ✓
- `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` → 9/9 PASS ✓
- `npm test` → 635 passed / 4 failed / 1 skipped; all 4 failing tests are in `snippet-editor-modal-banner.test.ts` (Plan 04 scope) ✓

---
*Phase: 52-json-placeholder-rework*
*Plan: 03 (Chip Editor and Fill-In Modal Narrowing, TDD GREEN)*
*Completed: 2026-04-20*
