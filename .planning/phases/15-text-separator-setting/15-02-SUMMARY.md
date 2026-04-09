---
phase: 15-text-separator-setting
plan: 02
subsystem: runner
tags: [typescript, runner, text-accumulator, separator, tdd, vitest]

# Dependency graph
requires:
  - phase: 15-text-separator-setting
    plan: 01
    provides: radiprotocol_separator on node interfaces; textSeparator in RadiProtocolSettings
provides:
  - appendWithSeparator(text, separator) on TextAccumulator
  - ProtocolRunnerOptions.defaultSeparator; resolveSeparator() helper in ProtocolRunner
  - All 5 append sites in ProtocolRunner use separator-aware accumulation
  - RunnerView passes plugin.settings.textSeparator as defaultSeparator on each openCanvas()
affects:
  - 15-03-editor-panel-separator-dropdown

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "appendWithSeparator(text, separator) — no-separator on empty buffer (D-01), separator prefix on non-empty"
    - "resolveSeparator(node) — node.radiprotocol_separator ?? this.defaultSeparator (D-04)"
    - "RunnerView re-constructs ProtocolRunner at openCanvas() start to pick up latest settings"

key-files:
  created: []
  modified:
    - src/runner/text-accumulator.ts
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
    - src/__tests__/runner/protocol-runner.test.ts

key-decisions:
  - "completeSnippet() looks up the TextBlockNode before nulling snippetNodeId to resolve its per-node separator (D-03)"
  - "RunnerView reconstructs ProtocolRunner at start of openCanvas() — simplest way to pick up textSeparator from settings without lazy init complexity"
  - "3 existing tests updated (RUN-05, RUN-06 3-step, LOOP-02) — their hardcoded expectations reflected pre-separator concatenation; updated to newline-separated expected strings"

patterns-established:
  - "TDD RED-GREEN: write failing tests first, implement to make them pass"
  - "Per-node separator resolved via resolveSeparator() — single resolution point prevents duplicated logic across 5 call sites"

requirements-completed:
  - SEP-01
  - SEP-02

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 15 Plan 02: Runner Separator Logic Summary

**`appendWithSeparator` on TextAccumulator + separator-aware ProtocolRunner with `defaultSeparator`/`resolveSeparator` + RunnerView wired to `plugin.settings.textSeparator`**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T06:24:33Z
- **Completed:** 2026-04-09T06:28:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `appendWithSeparator(text, separator)` to TextAccumulator — no separator prefix on empty buffer (D-01), `'\n'` or `' '` prefix on non-empty buffer
- Added `defaultSeparator` field + `resolveSeparator(node)` helper to ProtocolRunner; replaced all 5 `accumulator.append()` call sites with `appendWithSeparator()` (SEP-01, SEP-02, D-01–D-04)
- `completeSnippet()` looks up the TextBlockNode to resolve its per-node separator before the node ID is cleared (D-03)
- RunnerView reconstructs ProtocolRunner with `defaultSeparator: this.plugin.settings.textSeparator` at the start of each `openCanvas()` call
- Added 5 new separator tests (RED then GREEN via TDD); all 30 protocol-runner tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add appendWithSeparator + write failing separator tests** - `e2d21b9` (test)
2. **Task 2: Implement separator injection in ProtocolRunner and wire RunnerView** - `6a88448` (feat)

## Files Created/Modified
- `src/runner/text-accumulator.ts` — `appendWithSeparator(text, separator)` method added
- `src/runner/protocol-runner.ts` — `ProtocolRunnerOptions.defaultSeparator`; `private readonly defaultSeparator`; `resolveSeparator()` helper; all 5 `accumulator.append()` sites replaced
- `src/views/runner-view.ts` — field changed from `readonly` to mutable; `openCanvas()` reconstructs runner with `defaultSeparator` from settings
- `src/__tests__/runner/protocol-runner.test.ts` — 5 new separator tests added; 3 existing test expectations updated to reflect newline-default behavior

## Decisions Made
- `completeSnippet()` captures `pendingNodeId` and looks up the TextBlockNode before nulling `snippetNodeId` — necessary because the lookup must happen before the field is cleared, ensuring correct separator resolution (D-03).
- RunnerView reconstructs ProtocolRunner at the start of `openCanvas()` (before the canvas file is read) — this is the simplest correct approach. Every protocol run picks up the current settings value. No lazy init or settings-change observer needed.
- 3 existing tests updated as a Rule 1 deviation — their hardcoded no-separator string expectations were correct for the old behavior but become incorrect after introducing `'newline'` as the default separator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 existing tests to reflect newline-default separator behavior**
- **Found during:** Task 2 (GREEN phase — running all tests after implementing separator injection)
- **Issue:** Three existing tests had hardcoded expected strings using no-separator concatenation (`'Size: normalFindings: normal liver.'`, `'ans1ans2'`, `'LiverEnd of protocol.'`). After implementing `defaultSeparator: 'newline'`, the runner now inserts `'\n'` between chunks, making these expectations stale.
- **Fix:** Updated the 3 expected strings to use `'\n'` separator: `'Size: normal\nFindings: normal liver.'`, `'ans1\nans2'`, `'Liver\nEnd of protocol.'`
- **Files modified:** `src/__tests__/runner/protocol-runner.test.ts`
- **Verification:** All 30 protocol-runner tests pass after update
- **Committed in:** `6a88448` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale test expectations from pre-separator era)
**Impact on plan:** Required fix; the tests accurately reflected the old no-separator behavior. Updated to reflect the new correct behavior with `'newline'` as default.

## Issues Encountered
None — the pre-existing `editor-panel-view.ts` TypeScript errors and `editor-panel.test.ts` errors existed before this plan and are unrelated to this work. Zero TypeScript errors in the files this plan modifies.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Runner separator logic is complete and tested. Plan 03 (editor panel separator dropdown) can now execute.
- Plan 03 reads `radiprotocol_separator` from node interfaces (declared in Plan 01) and writes it back to canvas JSON via `pendingEdits` — no runner changes needed.

## Self-Check: PASSED

- FOUND: src/runner/text-accumulator.ts
- FOUND: src/runner/protocol-runner.ts
- FOUND: src/views/runner-view.ts
- FOUND: src/__tests__/runner/protocol-runner.test.ts
- FOUND commit: e2d21b9
- FOUND commit: 6a88448

---
*Phase: 15-text-separator-setting*
*Completed: 2026-04-09*
