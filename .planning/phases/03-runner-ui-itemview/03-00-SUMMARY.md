---
phase: 03-runner-ui-itemview
plan: "00"
subsystem: test-infrastructure
tags: [tdd, wave-0, test-stubs, red-phase]
dependency_graph:
  requires: []
  provides:
    - src/__tests__/RunnerView.test.ts
    - src/__tests__/runner-extensions.test.ts
    - src/__tests__/runner-commands.test.ts
    - src/__tests__/settings-tab.test.ts
    - src/__mocks__/obsidian.ts
    - src/__tests__/fixtures/two-questions.canvas
  affects:
    - vitest.config.ts
tech_stack:
  added:
    - obsidian alias mock (src/__mocks__/obsidian.ts) via vitest resolve.alias
  patterns:
    - TDD RED stubs — test files that fail until implementation plans turn them GREEN
    - Dynamic import for module-not-found RED test (NodePickerModal)
key_files:
  created:
    - src/__tests__/RunnerView.test.ts
    - src/__tests__/runner-extensions.test.ts
    - src/__tests__/runner-commands.test.ts
    - src/__tests__/settings-tab.test.ts
    - src/__mocks__/obsidian.ts
    - src/__tests__/fixtures/two-questions.canvas
  modified:
    - vitest.config.ts
decisions:
  - "Obsidian mock (src/__mocks__/obsidian.ts) added to allow vitest to import modules that extend ItemView/PluginSettingTab without a live Obsidian runtime"
  - "two-questions.canvas fixture created to make D-07 startNodeId test reliably RED — linear.canvas only has one question so start(graph, nodeId) would coincidentally pass"
  - "vitest.config.ts alias maps obsidian to src/__mocks__/obsidian.ts for all test runs"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
requirements:
  - UI-01
  - UI-02
  - UI-03
  - UI-04
  - UI-05
  - UI-06
  - UI-07
  - UI-08
  - UI-09
  - UI-10
  - UI-11
  - UI-12
  - RUN-10
  - RUN-11
---

# Phase 03 Plan 00: Wave-0 RED Test Stubs Summary

**One-liner:** Four failing test stub files establish the Phase 3 Nyquist contract — vitest RED stubs for RunnerView, ProtocolRunner extensions, NodePickerModal, and settings tab defaults.

---

## What Was Built

Four test stub files were created under `src/__tests__/` to define the full test surface for Phase 3 implementation plans. These files fail at assertion (or import resolution) for all features not yet implemented, while passing cleanly for pre-existing code.

### Test Files Created

| File | Requirements | RED tests | GREEN tests |
|------|-------------|-----------|-------------|
| `RunnerView.test.ts` | UI-01, UI-02, UI-07, UI-12 | `openCanvas` not on prototype | 4 (RUNNER_VIEW_TYPE, getViewType, getDisplayText, getState) |
| `runner-extensions.test.ts` | RUN-11/D-04, D-05, D-07 | 3 (setAccumulatedText, undo clear, startNodeId) | 0 |
| `runner-commands.test.ts` | RUN-10, UI-04 | 1 (NodePickerModal import) | 1 (GraphValidator dead-end) |
| `settings-tab.test.ts` | UI-10, UI-11, D-10 | 0 | 4 (all DEFAULT_SETTINGS values + display method) |

### RED Tests (must turn GREEN in subsequent plans)

| Test | Plan that turns it GREEN | Requirement |
|------|--------------------------|-------------|
| `RunnerView has openCanvas method` | Plan 01 | UI-02 |
| `ProtocolRunner has setAccumulatedText method` | Plan 02 | RUN-11/D-04 |
| `setAccumulatedText clears the undo stack` | Plan 02 | D-05 |
| `start() accepts optional startNodeId parameter` | Plan 02 | D-07 |
| `node-picker-modal exports NodePickerModal` | Plan 03 | RUN-10 |

### Full Suite Results

- Pre-existing tests: 38 passing (canvas-parser, graph-validator, protocol-runner, text-accumulator)
- New GREEN tests: 9 (settings defaults, graph validator, RunnerView basic existence checks)
- New RED tests: 5 (as expected for Wave 0 stubs)
- Total: 47 passing / 5 failing (non-zero exit code confirmed)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Obsidian API mock for vitest**
- **Found during:** Task 1 — `RunnerView.test.ts` imports `RunnerView` which extends `ItemView` from `obsidian`. The `obsidian` npm package contains only `.d.ts` type declarations (no `main` entry); importing it at runtime throws `ERR_MODULE_NOT_FOUND` or returns an empty module.
- **Fix:** Created `src/__mocks__/obsidian.ts` with minimal stubs for `ItemView`, `WorkspaceLeaf`, `PluginSettingTab`, `Plugin`, `Modal`, `SuggestModal`, `Notice`, and `Setting`. Added `resolve.alias` in `vitest.config.ts` to redirect `obsidian` imports to this mock during test runs.
- **Files modified:** `src/__mocks__/obsidian.ts` (created), `vitest.config.ts` (modified)
- **Commit:** 39b93f9

**2. [Rule 1 - Bug] Fixed D-07 test to reliably fail RED**
- **Found during:** Task 1 — The plan's D-07 test used `linear.canvas` (one question node `n-q1`) and searched for the first question node. Normal `start(graph)` auto-advances from start → `n-q1`, so `start(graph, 'n-q1')` coincidentally passed (both land on `n-q1`). The test was GREEN when it must be RED.
- **Fix:** Created `src/__tests__/fixtures/two-questions.canvas` with a two-question chain (start → Q1 → A1 → Q2 → A2). The test now starts from `n-q2` — a node unreachable via normal traversal from start. Without the `startNodeId` feature, the runner lands on `n-q1` not `n-q2`, causing the assertion to fail as required.
- **Files modified:** `src/__tests__/fixtures/two-questions.canvas` (created), `src/__tests__/runner-extensions.test.ts` (updated)
- **Commit:** 39b93f9

### Import Path Corrections

The plan template used paths like `'../../views/runner-view'` and `'../../runner/protocol-runner'` which would be correct for files in `src/__tests__/runner/` but not for files in `src/__tests__/` directly. All imports were corrected to `'../views/runner-view'`, `'../runner/protocol-runner'`, `'../graph/canvas-parser'`, `'../settings'`, and `'../views/node-picker-modal'`.

---

## Known Stubs

The following tests are intentional stubs that cannot be verified in vitest (manual-only per plan):

| Stub | File | Reason |
|------|------|--------|
| UI-08: clipboard API | `RunnerView.test.ts` | `navigator.clipboard` unavailable in Node environment |
| UI-03: private `render()` method | `RunnerView.test.ts` | Not represented in test; render is private implementation detail |
| UI-05: clipboard copy behavior | `runner-commands.test.ts` | Not present; clipboard is manual-only per plan |

These omissions are intentional per the plan's design — full clipboard and DOM behavior tests require a live Obsidian environment.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/__tests__/RunnerView.test.ts` | FOUND |
| `src/__tests__/runner-extensions.test.ts` | FOUND |
| `src/__tests__/runner-commands.test.ts` | FOUND |
| `src/__tests__/settings-tab.test.ts` | FOUND |
| `src/__mocks__/obsidian.ts` | FOUND |
| `src/__tests__/fixtures/two-questions.canvas` | FOUND |
| Commit 39b93f9 | FOUND |
| Commit 1274d32 | FOUND |
