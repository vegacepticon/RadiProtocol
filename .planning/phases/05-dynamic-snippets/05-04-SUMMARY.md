---
phase: 05-dynamic-snippets
plan: "04"
subsystem: runner-view
tags: [runner, snippet-fill-in, main-wiring, itemview]
dependency_graph:
  requires:
    - 05-01  # SnippetService (snippetService.load)
    - 05-02  # SnippetManagerView (registered in main.ts)
    - 05-03  # SnippetFillInModal (opened in awaiting-snippet-fill branch)
  provides:
    - RunnerView full implementation (idle/at-node/awaiting-snippet-fill/complete/error)
    - main.ts fully wired for Phase 5 (RunnerView, SnippetService, SnippetManagerView)
  affects:
    - src/views/runner-view.ts
    - src/main.ts
tech_stack:
  added: []
  patterns:
    - ItemView state machine rendering (switch on runner.getState().status)
    - registerDomEvent for all event listeners (zero innerHTML)
    - Async modal result pattern (await modal.result: Promise<string | null>)
    - Plugin as service locator (this.plugin.snippetService)
key_files:
  created: []
  modified:
    - src/views/runner-view.ts
    - src/main.ts
decisions:
  - "Store graph on view (this.graph) after openCanvas parse+validate — needed for node lookup in at-node render branch"
  - "Cancel fill-in resolves to completeSnippet('') — runner advances without appending text (D-11)"
  - "activateRunnerView auto-opens canvas if a canvas leaf is already open in workspace"
metrics:
  duration_seconds: 306
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 2
---

# Phase 05 Plan 04: RunnerView + main.ts Wiring — Summary

**One-liner:** Full RunnerView state machine with SnippetFillInModal integration wired into awaiting-snippet-fill branch; main.ts updated with RunnerView registration, activateRunnerView(), and saveOutputToNote().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement full RunnerView with awaiting-snippet-fill branch | `86e66ab` | src/views/runner-view.ts |
| 2 | Wire main.ts — SnippetService, SnippetManagerView, commands | `807301c` | src/main.ts |
| 3 | Human verification — Phase 5 end-to-end UAT | — | (checkpoint — awaiting human) |

## What Was Built

### Task 1 — RunnerView (src/views/runner-view.ts)

Replaced the Phase 3 stub with a complete `RunnerView` ItemView:

- **Constructor:** `(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin)` — plugin reference for snippetService and canvasParser access
- **openCanvas(filePath):** reads canvas file → parses with canvasParser → validates with GraphValidator → starts runner → renders (UI-02, T-5-13)
- **getState()/setState():** persists `canvasFilePath` for workspace restore; setState re-opens the canvas on restore (UI-07)
- **render() state machine:** full switch on `runner.getState().status`:
  - `idle`: empty-state heading + muted body text
  - `at-node`: question→answer buttons or free-text-input→textarea+submit; step-back button if canStepBack
  - `awaiting-snippet-fill`: shows "Loading snippet..." then async loads snippet via `snippetService.load()`, opens `SnippetFillInModal`, awaits result (SNIP-06, D-17)
  - `complete`: "Protocol complete" heading + enabled copy/save toolbar
  - `error`: validation panel with error list
- **Cancel behavior:** null modal result → `completeSnippet('')` — runner advances without appending text (D-11)
- **Missing snippet:** null from `snippetService.load()` shows error in question zone without opening modal
- **Output toolbar:** copy-to-clipboard (navigator.clipboard) and save-to-note buttons; disabled except in complete state
- **Legend:** color swatches for all node kinds (UI-12)
- **DOM rules:** zero innerHTML; all events via `registerDomEvent`

### Task 2 — main.ts (src/main.ts)

Surgical additions to wire the plugin fully:

- Import `RunnerView`, `RUNNER_VIEW_TYPE`, `TFile`
- `registerView(RUNNER_VIEW_TYPE, ...)` — ItemView registration (UI-01)
- `run-protocol` command updated to call `activateRunnerView()` (removed placeholder Notice)
- `activateRunnerView()` — reveals existing leaf or opens new right leaf; auto-calls `openCanvas()` if a canvas is already open in the workspace
- `saveOutputToNote(text)` — creates timestamped `.md` note in `settings.outputFolderPath`; opens in new tab (UI-06, T-5-14)
- All existing Phase 5 wiring (SnippetService, SnippetManagerView, open-snippet-manager command) was already present from earlier agents

## Verification

```
npx vitest run src/__tests__/RunnerView.test.ts  → 5/5 passed
npx vitest run                                    → 80/83 passed (3 pre-existing RED stubs)
npx tsc --noEmit                                  → 0 errors in src/
```

The 3 failing tests (`runner-extensions.test.ts`) are intentional RED stubs planted in a prior wave ("RED until Plan 02" labels) — not caused by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CanvasParser.parse() requires two arguments**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `canvasParser.parse(content)` called with 1 argument; signature is `parse(jsonString, canvasFilePath)` — TypeScript error TS2554
- **Fix:** Changed to `this.plugin.canvasParser.parse(content, filePath)` — passes the canvas file path as required
- **Files modified:** src/views/runner-view.ts
- **Commit:** 86e66ab

**2. [Rule 1 - Bug] Import collision — ProtocolGraph imported from wrong module**
- **Found during:** Task 1 implementation review
- **Issue:** Initial draft imported `ProtocolGraph` from `runner-state.ts` (which doesn't export it) alongside a second alias import from `graph-model.ts`; also had a leftover `_graph` field duplicate
- **Fix:** Rewrote file cleanly using single import `type { ProtocolGraph } from '../graph/graph-model'` and a single `private graph: ProtocolGraph | null = null` field set in `openCanvas()`
- **Files modified:** src/views/runner-view.ts
- **Commit:** 86e66ab

## Known Stubs

None — all runner states are fully implemented. `saveOutputToNote` is wired end-to-end (creates real vault file). No placeholder text in user-visible paths.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: path-traversal | src/main.ts | saveOutputToNote() uses settings.outputFolderPath directly — mitigated: Obsidian vault API scopes all paths to vault root; no `..` traversal possible (T-5-14 accepted) |

## Self-Check: PASSED

- src/views/runner-view.ts — FOUND
- src/main.ts — FOUND
- .planning/phases/05-dynamic-snippets/05-04-SUMMARY.md — FOUND
- Commit 86e66ab — FOUND
- Commit 807301c — FOUND
