---
phase: 03-runner-ui-itemview
plan: "03"
subsystem: ui
tags: [obsidian, suggest-modal, node-picker, fuzzy-search, typescript]

# Dependency graph
requires:
  - phase: 03-runner-ui-itemview/03-02
    provides: ProtocolRunner with startNodeId parameter (D-07) already implemented
  - phase: 02-core-protocol-runner-engine
    provides: ProtocolGraph, QuestionNode, TextBlockNode types
provides:
  - NodePickerModal class (SuggestModal<NodeOption>) for start-from-specific-node command
  - buildNodeOptions helper to extract picker options from ProtocolGraph
  - NodeOption interface (id, label, kind)
affects:
  - 03-04 (main.ts wiring — imports NodePickerModal for start-protocol-from-node command)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SuggestModal<T> subclass pattern for fuzzy node pickers
    - Dynamic import test pattern (vitest) to isolate module-not-found errors

key-files:
  created:
    - src/views/node-picker-modal.ts
  modified:
    - src/__mocks__/obsidian.ts

key-decisions:
  - "Standalone modal — receives options and onChoose from caller; zero dependency on RunnerView or main.ts (D-06)"
  - "setPlaceholder added to SuggestModal mock to support constructor call without runtime error"
  - "buildNodeOptions sorts questions first then text-blocks, each group alphabetically by label"

patterns-established:
  - "Pattern: SuggestModal subclass receives pre-built NodeOption[] array; caller controls data sourcing"
  - "Pattern: Dynamic import test verifies module resolves and exports required property (RED→GREEN)"

requirements-completed: [RUN-10]

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 03 Plan 03: NodePickerModal Summary

**NodePickerModal SuggestModal<NodeOption> with fuzzy label search and buildNodeOptions helper extracting question/text-block nodes sorted questions-first**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-06T10:35:00Z
- **Completed:** 2026-04-06T10:43:22Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `src/views/node-picker-modal.ts` implementing `NodePickerModal` (extends `SuggestModal<NodeOption>`) with fuzzy label filtering, `renderSuggestion` using `createEl` only (no innerHTML), and `onChooseSuggestion` delegating to caller-supplied callback
- Implemented `buildNodeOptions(graph)` helper that extracts only `question` and `text-block` nodes, labels question nodes by `questionText` and text-block nodes by first 60 chars of `content`, sorts questions before text-blocks with alphabetical ordering within each group
- Turned RUN-10 runner-commands test GREEN: `NodePickerModal` dynamic import test now resolves and has the `NodePickerModal` property
- Added `setPlaceholder` stub to `SuggestModal` mock in `src/__mocks__/obsidian.ts` so the constructor call does not throw in the test environment

## Task Commits

1. **Task 1: Implement NodePickerModal** - `79ce61e` (feat)

## Files Created/Modified

- `src/views/node-picker-modal.ts` — NodePickerModal, buildNodeOptions, NodeOption (75 lines)
- `src/__mocks__/obsidian.ts` — Added setPlaceholder stub to SuggestModal mock

## Decisions Made

- Standalone modal with no RunnerView or main.ts dependency — caller supplies options and callback (D-06)
- Used `setPlaceholder` directly (real Obsidian API) with corresponding mock stub added; avoids unsafe indexed property invocation
- Private callback field named `onChooseCb` to avoid conflict with inherited `onChooseSuggestion` method name

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added setPlaceholder to SuggestModal mock**
- **Found during:** Task 1 (TypeScript compile)
- **Issue:** `SuggestModal` mock in `src/__mocks__/obsidian.ts` lacked `setPlaceholder` method; calling it in the constructor would throw in test environment
- **Fix:** Added `setPlaceholder(_placeholder: string): void {}` to the mock class
- **Files modified:** src/__mocks__/obsidian.ts
- **Committed in:** 79ce61e

---

**Total deviations:** 1 auto-fixed (missing mock method)
**Impact on plan:** Essential for correct test operation. No scope creep.

## Known Stubs

None — `NodePickerModal` and `buildNodeOptions` are fully implemented. The `onChooseCb` is wired from caller at construction time. Plan 04 (main.ts) will supply the actual callback that calls `runnerView.openCanvas(canvasPath, opt.id)`.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| Reviewed T-03-03-01 | src/views/node-picker-modal.ts | `renderSuggestion` uses `createEl` exclusively — no innerHTML. Mitigation applied as specified. |

No new threat surface introduced beyond the plan's threat model.

## Self-Check: PASSED

- `src/views/node-picker-modal.ts` exists: FOUND
- `src/__mocks__/obsidian.ts` updated: FOUND
- Commit `79ce61e` exists: FOUND
- `export class NodePickerModal`: 1 match
- `export function buildNodeOptions`: 1 match
- `export interface NodeOption`: 1 match
- `extends SuggestModal`: 1 match
- `innerHTML`/`outerHTML`: 0 matches
- Line count: 75 (>= 50 minimum)
- Tests: 2/2 GREEN in runner-commands.test.ts
