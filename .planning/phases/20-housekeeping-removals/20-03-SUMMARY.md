---
phase: 20-housekeeping-removals
plan: "03"
subsystem: views
tags: [housekeeping, dead-code, runner-view, editor-panel, css, ntype-04, ux]
dependency_graph:
  requires: ["20-02"]
  provides: ["NTYPE-04", "UX-01", "UX-02"]
  affects: ["src/views/runner-view.ts", "src/views/editor-panel-view.ts", "src/styles.css"]
tech_stack:
  added: []
  patterns:
    - "raw-string cast guard pattern for legacy session degradation (session as unknown as { runnerStatus: string })"
key_files:
  modified:
    - src/views/runner-view.ts
    - src/views/editor-panel-view.ts
    - src/styles.css
decisions:
  - "Raw-string cast for legacy session status detection — avoids TypeScript narrowing before guard fires, per RESEARCH.md pattern"
  - "Pre-existing test file tsc errors (RunnerView.test.ts lines 96, 126) are Wave 1 artifacts; cannot modify test files per plan constraint"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  files_modified: 3
---

# Phase 20 Plan 03: View Layer Dead-Code Removal Summary

**One-liner:** Removed awaiting-snippet-fill and free-text-input dead code from view layer; added NTYPE-04 legacy session guard and UX polish (hover fix, answer rows=6).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Clean runner-view.ts — remove awaiting-snippet-fill branch, add legacy session guard | `8f1e570` | src/views/runner-view.ts |
| 2 | Clean editor-panel-view.ts and styles.css — remove dead form cases, add rows and hover fix | `5d5ce33` | src/views/editor-panel-view.ts, src/styles.css |

## Changes Applied

### runner-view.ts (commit 8f1e570)

- Removed `import { SnippetFillInModal }` (only used in deleted method)
- Added NTYPE-04 legacy session degradation guard in `openCanvas()`: detects `runnerStatus: 'awaiting-snippet-fill'` via raw-string cast, clears session, falls through to fresh start silently
- Removed `case 'awaiting-snippet-fill'` from render() outer switch
- Removed `case 'free-text-input'` from render() at-node node.kind inner switch
- Removed `handleSnippetFill()` private method entirely
- Simplified `handleSelectorSelect()` needsConfirmation to `state.status === 'at-node'` only

### editor-panel-view.ts (commit 5d5ce33)

- Removed `.addOption('free-text-input', 'Free-text input')` from renderForm() dropdown
- Removed entire `case 'free-text-input'` block from buildKindForm() switch
- Removed "Snippet ID (optional)" Setting block from text-block form (dead field after snippet system retirement from node type)
- Added `ta.inputEl.rows = 6` before `ta.setValue()` in answer textarea (UX-02)

### styles.css (commit 5d5ce33)

- Added `.rp-preview-textarea:hover { background: var(--background-primary); }` immediately after the `.rp-preview-textarea` rule block (UX-01)
- Removed `.rp-free-text-input` dead CSS rule block entirely

## Test Results

```
npm test — 17 test files
  1 failed (runner-extensions.test.ts — 3 pre-existing RED stubs, labeled "RED until Plan 02")
  16 passed
  132 tests passing
  3 tests failing (pre-existing, out of scope)
```

All Wave 0 / Plan 01 tests GREEN:
- NTYPE-04 legacy session degradation test: PASS
- UX-02 answer textarea rows=6 test: PASS
- All other RunnerView and EditorPanel tests: PASS

## TypeScript (tsc --noEmit)

Non-node_modules errors after our changes: **2** (down from 3 before Task 2)

Remaining 2 errors are both in `src/__tests__/RunnerView.test.ts` (Wave 1 test file, cannot modify):
- Line 96: `Type '"awaiting-snippet-fill"' is not assignable to type '"at-node"'` — intentional legacy session shape in test
- Line 126: `Expected 0 arguments, but got 1` — TFile mock constructor call

Our changes eliminated the pre-existing `editor-panel-view.ts(371)` error by removing the `case 'free-text-input'` that referenced a no-longer-valid RPNodeKind.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The NTYPE-04 legacy session guard (T-20-03-01) was implemented as specified: raw-string cast detects `awaiting-snippet-fill`, calls `sessionService.clear()`, falls through to fresh start with no user-facing error disclosure.

## Self-Check: PASSED

Files exist:
- src/views/runner-view.ts — FOUND
- src/views/editor-panel-view.ts — FOUND
- src/styles.css — FOUND

Commits exist:
- 8f1e570 — FOUND
- 5d5ce33 — FOUND
