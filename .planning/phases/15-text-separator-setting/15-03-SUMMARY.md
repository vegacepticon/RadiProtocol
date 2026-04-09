---
phase: 15-text-separator-setting
plan: 03
subsystem: ui
tags: [typescript, editor-panel, vitest, tdd, obsidian-setting]

# Dependency graph
requires:
  - phase: 15-text-separator-setting
    provides: radiprotocol_separator?: 'newline' | 'space' on AnswerNode, FreeTextInputNode, TextBlockNode (Plan 01)
provides:
  - separator addDropdown in buildKindForm() for answer, free-text-input, text-block cases
  - pendingEdits['radiprotocol_separator'] write-back on onChange
  - 8 new editor-panel tests (SEP-02, D-05, D-06) all passing
affects:
  - any future EditorPanel UI plans that read pendingEdits

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.spyOn(Setting.prototype, 'setName') with any cast to capture Setting names in TDD tests"
    - "Remove vi.mock('obsidian') when manual mock alias already provides proper chaining"

key-files:
  created: []
  modified:
    - src/views/editor-panel-view.ts
    - src/__tests__/editor-panel.test.ts

key-decisions:
  - "Removed vi.mock('obsidian') from editor-panel.test.ts — the vitest.config.ts alias to src/__mocks__/obsidian.ts already provides the manual mock with proper method chaining; vi.mock() was auto-mocking it and breaking setHeading() chaining"
  - "Used any casts on mockImplementation parameters to satisfy Obsidian's string | DocumentFragment union type in spy callbacks"

patterns-established:
  - "Separator dropdown block: setValue uses (nodeRecord['radiprotocol_separator'] as string | undefined) ?? '' to pre-select existing value"
  - "onChange maps '' to undefined (removes property on save) and any other value to 'newline' | 'space'"

requirements-completed:
  - SEP-02

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 15 Plan 03: EditorPanel Separator Dropdown Summary

**`addDropdown` Text separator field added to `buildKindForm()` for answer, free-text-input, and text-block cases with full TDD coverage (8 tests, RED-GREEN cycle)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T06:24:54Z
- **Completed:** 2026-04-09T06:29:27Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Added `Text separator` `addDropdown` to `buildKindForm()` for `answer`, `free-text-input`, and `text-block` cases
- Dropdown options: "Use global (default)" (`''` → `undefined`), "Newline" (`'newline'`), "Space" (`'space'`) per D-06
- `onChange` writes `pendingEdits['radiprotocol_separator'] = value === '' ? undefined : value` — "Use global" removes the property from canvas JSON on save
- Initial value pre-selected from `nodeRecord['radiprotocol_separator']` (existing canvas data)
- 8 new tests (A–H) in `describe('Separator dropdown (SEP-02, D-05, D-06)')` — all pass
- `start`, `question`, `loop-start`, `loop-end` cases have no separator field (verified by Tests D and E)

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for separator dropdown** - `ffa123e` (test)
2. **GREEN: Separator dropdown implementation** - `909ab94` (feat)

## Files Created/Modified

- `src/views/editor-panel-view.ts` — separator `addDropdown` block added at end of `answer`, `free-text-input`, `text-block` cases in `buildKindForm()`
- `src/__tests__/editor-panel.test.ts` — 8 new separator dropdown tests; removed `vi.mock('obsidian')` (deviation fix)

## Decisions Made

- Removed `vi.mock('obsidian')` from the test file — the `vitest.config.ts` `resolve.alias` for `obsidian` already points to `src/__mocks__/obsidian.ts` which has proper `setHeading(): this { return this; }` chaining. `vi.mock()` was auto-mocking the module and replacing the manual mock, causing `setHeading()` to return `undefined` and breaking the spy tests.
- Used `any` casts in spy `mockImplementation` callbacks to satisfy Obsidian's `string | DocumentFragment` union type for `setName` and `DropdownComponent` type for `addDropdown` — the actual runtime values are always `string` / mock drop objects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed vi.mock('obsidian') to restore manual mock chaining**
- **Found during:** Task 1 (RED phase — tests crashed with "Cannot read properties of undefined (reading 'setName')")
- **Issue:** `vi.mock('obsidian')` auto-mocked the aliased manual mock, making all Setting methods (including `setHeading()`) return `undefined`. This caused `new Setting(container).setHeading().setName(...)` to throw in `buildKindForm()`.
- **Fix:** Removed `vi.mock('obsidian')` call; added comment explaining why the alias alone is sufficient.
- **Files modified:** `src/__tests__/editor-panel.test.ts`
- **Verification:** Tests ran with proper Setting chaining; all 15 pass.
- **Committed in:** `909ab94` (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — vi.mock conflicting with manual mock alias)
**Impact on plan:** Required fix for test infrastructure; no scope creep. Implementation unchanged.

## Issues Encountered

None — pre-existing TypeScript errors in `editor-panel-view.ts` (lines 57, 68, 84 — `containerEl` and `registerDomEvent` null issues) and the pre-existing unhandled rejection in the `loadNode` test (`vault.getAbstractFileByPath` not in mock) existed before this plan and were not introduced or affected by this work.

The 3 "RED until Plan 02" failures in `runner-extensions.test.ts` are intentional stubs from Plan 15-02 and remain as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEP-02 complete. Per-node separator dropdown writes `radiprotocol_separator` to canvas JSON via `pendingEdits` on save.
- Plans 01, 02, and 03 are all complete. Phase 15 is done.
- The runner separator logic (Plan 02) reads `radiprotocol_separator` from nodes — that plan's implementation is independent of this EditorPanel work.

## Self-Check: PASSED

- FOUND: src/views/editor-panel-view.ts
- FOUND: src/__tests__/editor-panel.test.ts
- FOUND: .planning/phases/15-text-separator-setting/15-03-SUMMARY.md
- FOUND commit: ffa123e (RED — failing tests)
- FOUND commit: 909ab94 (GREEN — implementation)
- FOUND commit: 9b7e89b (docs — SUMMARY + STATE + ROADMAP)

---
*Phase: 15-text-separator-setting*
*Completed: 2026-04-09*
