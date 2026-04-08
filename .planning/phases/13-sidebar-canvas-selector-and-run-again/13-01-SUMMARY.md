---
phase: 13
plan: 01
subsystem: runner-ui
tags: [css, runner-view, sidebar, ux]
dependency_graph:
  requires: []
  provides: [rp-selector-css, run-again-button]
  affects: [src/styles.css, src/views/runner-view.ts, src/__tests__/RunnerView.test.ts]
tech_stack:
  added: []
  patterns: [obsidian-createEl, registerDomEvent, css-token-variables]
key_files:
  created: []
  modified:
    - src/styles.css
    - src/views/runner-view.ts
    - src/__tests__/RunnerView.test.ts
decisions:
  - "CSS-only fix for sidebar selector parity — no code changes to CanvasSelectorWidget needed"
  - "Run again button placed in questionZone after complete heading, calls openCanvas(canvasFilePath!)"
  - "registerDomEvent used for Run again click handler (not raw addEventListener) per Obsidian conventions"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-08"
  tasks_completed: 3
  files_modified: 3
---

# Phase 13 Plan 01: Sidebar Canvas Selector and Run Again Summary

**One-liner:** CSS-only sidebar selector parity (14 rp-selector-* classes added) plus Run again button in complete branch calling openCanvas(canvasFilePath!).

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rp-selector-* and rp-run-again-btn CSS | 8393cf6 | src/styles.css |
| 2 | Add Run again button to complete branch | 3d67442 | src/views/runner-view.ts |
| 3 | Add Phase 13 SIDEBAR-01 and RUNNER-01 tests | 35fd4f4 | src/__tests__/RunnerView.test.ts |

---

## What Was Built

### SIDEBAR-01 — Selector parity in sidebar mode

All `rp-selector-*` CSS classes were absent from `src/styles.css`. This caused the `CanvasSelectorWidget` (already mounted unconditionally in `headerEl`) to be invisible in sidebar mode. Added a Phase 13 CSS section with 14 classes:

- `.rp-selector-wrapper` — block-level full-width container in headerEl
- `.rp-selector-trigger` — full-width button with label + chevron
- `.rp-selector-trigger-label`, `.rp-selector-placeholder`, `.rp-selector-chevron` — trigger internals
- `.rp-selector-popover` — absolute-positioned dropdown with z-index 999
- `.rp-selector-row` — flex list item with hover state
- `.rp-selector-row-icon`, `.rp-selector-row-label`, `.rp-selector-row-arrow` — row internals
- `.rp-selector-back-row`, `.rp-selector-folder-row`, `.rp-selector-file-row` — row variants
- `.rp-selector-empty-hint` — muted italic empty state

No changes were needed to `CanvasSelectorWidget` — the widget already applied all these class names in its `render()` and `renderPopoverContent()` methods.

### RUNNER-01 — Run again button

In the `case 'complete':` branch of `render()`, a "Run again" button is now rendered in `questionZone` immediately after the "Protocol complete" h2 heading. The click handler calls `void this.openCanvas(this.canvasFilePath!)`. Uses `registerDomEvent` per Obsidian conventions. `canvasFilePath` is guaranteed non-null in this branch (protocol cannot complete without a canvas loaded).

---

## Decisions Made

1. **CSS-only fix** — `CanvasSelectorWidget` was already correct; only CSS was missing. No structural change needed.
2. **Run again placement** — In `questionZone` after the heading, consistent with other action elements (step-back button, loop buttons).
3. **No null guard in click handler** — `canvasFilePath` is guaranteed non-null in the `complete` branch; explicit `!` assertion is safe and matches the threat model acceptance.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all CSS classes are wired to real widget behavior; Run again button calls live `openCanvas()`.

---

## Threat Flags

No new threat surface introduced beyond what the plan's threat model already covers.

---

## Self-Check: PASSED

Files exist:
- FOUND: src/styles.css (contains rp-selector-wrapper, rp-run-again-btn)
- FOUND: src/views/runner-view.ts (contains rp-run-again-btn, openCanvas(this.canvasFilePath!))
- FOUND: src/__tests__/RunnerView.test.ts (contains Phase 13 describe block)

Commits exist:
- FOUND: 8393cf6 feat(13-01): add rp-selector-* and rp-run-again-btn CSS
- FOUND: 3d67442 feat(13-01): add Run again button to complete branch
- FOUND: 35fd4f4 test(13-01): add Phase 13 SIDEBAR-01 and RUNNER-01 structural tests

Tests: 12/12 RunnerView tests pass. Pre-existing 3 failures in runner-extensions.test.ts are unrelated to this plan.
