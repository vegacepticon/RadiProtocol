---
phase: 12-runner-layout-overhaul
plan: "00"
subsystem: runner-ui
tags: [layout, css, tdd, runner-view]
dependency_graph:
  requires: []
  provides: [LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04]
  affects: [src/views/runner-view.ts, src/styles.css]
tech_stack:
  added: []
  patterns: [scrollHeight auto-grow, DOM creation order, CSS flex cleanup]
key_files:
  created: [src/__tests__/RunnerView.test.ts (LAYOUT tests added)]
  modified:
    - src/views/runner-view.ts
    - src/styles.css
    - vitest.config.ts
decisions:
  - "Add obsidian resolve alias to vitest.config.ts so Obsidian-dependent view tests can run without Obsidian runtime"
  - "LAYOUT-01/LAYOUT-02 tests use structural guards (method-exists checks) — DOM-level assertions rely on UAT since jsdom scrollHeight is always 0"
  - "LAYOUT-04 test is the required RED test — renderLegend existed on prototype before implementation"
metrics:
  duration: ~15min
  completed: 2026-04-08
  tasks_completed: 2
  files_modified: 3
---

# Phase 12 Plan 00: Runner Layout Overhaul Summary

One-liner: DOM zone reorder (preview-first), textarea scrollHeight auto-grow, equal flex output buttons, and complete legend deletion applied to RunnerView via TDD.

## What Was Implemented

All four LAYOUT requirements applied in a single TDD cycle across two tasks:

### LAYOUT-01 — Textarea auto-grow
- Removed `flex: 1 1 auto` and `min-height: 80px` from `.rp-preview-textarea`
- Added `overflow: hidden` and `height: auto` to CSS
- In `renderPreviewZone()`: removed "Report preview" `<p>` heading; after setting `textarea.value`, sets `textarea.style.height = 'auto'` then `textarea.style.height = textarea.scrollHeight + 'px'`
- Textarea now grows to show all content without internal scrollbar; outer panel scrolls

### LAYOUT-02 — Zone reorder
- In `render()`: changed creation order from `questionZone → <hr> → previewZone → outputToolbar` to `previewZone → questionZone → outputToolbar`
- Deleted `root.createEl('hr', { cls: 'rp-zone-divider' })` line
- Deleted `.rp-zone-divider` CSS block
- Removed `overflow-y: auto` from `.rp-question-zone`
- Changed `.rp-runner-view` from `height: 100%` to `min-height: 100%` with `gap: var(--size-4-1)` replacing the divider spacing
- Removed `flex: 1 1 auto` and `min-height: 0` from `.rp-preview-zone`

### LAYOUT-03 — Equal output buttons
- Added `.rp-insert-btn` to the `flex: 1` CSS rule alongside `.rp-copy-btn` and `.rp-save-btn`
- No change needed in runner-view.ts — `rp-insert-btn` button was already created by phase 10

### LAYOUT-04 — Legend deletion
- Deleted `this.renderLegend(root)` call and its comment from `render()`
- Deleted entire `private renderLegend(root: HTMLElement): void { ... }` method (16 lines)
- Deleted `.rp-legend`, `.rp-legend-row`, `.rp-legend-swatch` CSS blocks (24 lines)

## Deviation: vitest.config.ts obsidian alias (Rule 3 — blocking issue)

**Found during:** Task 1 (writing RED tests)

**Issue:** `RunnerView.test.ts` (and several other test files) failed at the file-import level because vitest could not resolve the `obsidian` package. The `__mocks__/obsidian.ts` file existed but the mock was not being applied — vitest requires either `vi.mock('obsidian')` per-file or a global resolve alias.

**Fix:** Added `resolve.alias` to `vitest.config.ts` mapping `obsidian` to `src/__mocks__/obsidian.ts`. Added `vi.mock()` calls in `RunnerView.test.ts` for all non-pure imports.

**Side effect:** Fixed pre-existing file-level test failures in `RunnerView.test.ts`, `settings-tab.test.ts`, `canvas-write-back.test.ts`, and `editor-panel.test.ts` — these files now run and their tests pass (except intentional RED stubs).

**Files modified:** `vitest.config.ts`, `src/__tests__/RunnerView.test.ts`

## Test Results

```
Test Files  1 failed | 16 passed (17)
Tests       3 failed | 130 passed (133)
```

The 3 failing tests are pre-existing intentional RED stubs in `runner-extensions.test.ts` (labelled "RED until Plan 02"). All LAYOUT tests are GREEN.

LAYOUT-04 was confirmed RED before implementation (renderLegend existed on prototype → `typeof ... === 'function'` vs expected `'undefined'`), then turned GREEN after implementation.

## UAT Checklist (Manual Verification Required)

The following behaviors require live Obsidian testing (jsdom cannot simulate scrollHeight):

- [ ] Open runner in sidebar mode; load a protocol with 5+ answers; verify textarea shows all accumulated text without an internal scrollbar
- [ ] Verify the protocol text (textarea) appears above the question/answer zone in the runner panel
- [ ] Verify Copy, Save, and Insert buttons are visually equal width in the output toolbar
- [ ] Verify no node type legend appears in runner view (neither sidebar nor tab mode)
- [ ] Verify panel-level scrolling works when protocol text is long (outer sidebar scrolls, not textarea)
- [ ] Verify "Report preview" heading is absent from the panel

## Self-Check

### Files exist:
- `.planning/phases/12-runner-layout-overhaul/12-00-SUMMARY.md` — this file

### Commits:
- `ab291f0` — test(12-00): add failing LAYOUT tests for renderLegend, zone order, textarea auto-grow
- `0e1dc7e` — feat(12-00): implement LAYOUT-01 through LAYOUT-04 runner layout overhaul
