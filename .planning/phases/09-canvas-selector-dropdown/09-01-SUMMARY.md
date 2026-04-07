---
phase: 09-canvas-selector-dropdown
plan: "01"
subsystem: settings + canvas-selector-widget
tags: [settings, widget, dropdown, ui, canvas-selector]
dependency_graph:
  requires: []
  provides:
    - protocolFolderPath setting in RadiProtocolSettings
    - CanvasSelectorWidget class (drill-down dropdown)
    - rp-selector-* CSS classes
  affects:
    - src/settings.ts
    - src/views/canvas-selector-widget.ts
    - src/styles.css
tech_stack:
  added: []
  patterns:
    - DOM-only widget (createEl/createDiv/createSpan — no innerHTML)
    - Outside-click document listener with lifecycle destroy()
    - Obsidian vault API for folder/file traversal (TFolder/TFile)
    - setIcon() for all icons (Obsidian built-in)
key_files:
  created:
    - src/views/canvas-selector-widget.ts
  modified:
    - src/settings.ts
    - src/styles.css
    - src/__tests__/snippet-service.test.ts
decisions:
  - "protocolFolderPath defaults to empty string — empty disables the selector (D-02, D-03)"
  - "Reset currentPath to [] on each popover open so drill-down state is fresh (D-10)"
  - "All text content via setText()/text: property — no innerHTML, no XSS vector (T-09-03)"
metrics:
  duration_minutes: 20
  completed_date: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 9 Plan 01: Settings Field + CanvasSelectorWidget Summary

**One-liner:** `protocolFolderPath` setting added to RadiProtocolSettings plus a self-contained `CanvasSelectorWidget` that drill-navigates a vault folder tree and selects `.canvas` files.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add protocolFolderPath to settings | ea2ad50 | src/settings.ts |
| 2 | Implement CanvasSelectorWidget with CSS | e3a251c | src/views/canvas-selector-widget.ts, src/styles.css |

---

## What Was Built

### Task 1 — Settings field
- Added `protocolFolderPath: string` to `RadiProtocolSettings` interface with JSDoc comment referencing SELECTOR-01
- Added `protocolFolderPath: ''` to `DEFAULT_SETTINGS`
- Inserted "Protocol" settings group (Group 2) between Runner and Output groups in `RadiProtocolSettingsTab.display()`
- Renumbered Output → Group 3, Protocol engine → Group 4, Storage → Group 5

### Task 2 — CanvasSelectorWidget
- `src/views/canvas-selector-widget.ts` created — full drill-down dropdown widget
  - `constructor(app, plugin, container, onSelect)` renders trigger button into container
  - `destroy()` removes document click listener on view unmount
  - `setSelectedPath(filePath | null)` updates trigger label from outside
  - `rebuildIfOpen()` for vault file-event refresh
  - Popover opens at root of `plugin.settings.protocolFolderPath` on each open (fresh state)
  - Shows "Set a protocol folder in Settings to get started." hint when path is empty or folder missing
  - Sorts: subfolders first (alphabetical), then `.canvas` files (alphabetical)
  - Back row shown at top when drilled into a subfolder
  - Selected file row marked with `is-selected` CSS class
  - Outside-click closes popover via document listener (cleaned up on close)
- `src/styles.css` — appended Phase 9 section with 13 `rp-selector-*` CSS classes using Obsidian CSS variables throughout

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock missing new required settings field**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** `src/__tests__/snippet-service.test.ts` constructed a `RadiProtocolSettings` mock object without `protocolFolderPath`, causing TS2345 type error after the interface was extended
- **Fix:** Added `protocolFolderPath: ''` to the inline mock object on line 23
- **Files modified:** src/__tests__/snippet-service.test.ts
- **Commit:** e3a251c (included in Task 2 commit)

---

## Known Stubs

None — both outputs are complete and self-contained. `protocolFolderPath` is wired into the widget's folder lookup. The widget's `onSelect` callback will be wired into `RunnerView` by Plan 03.

---

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary schema changes introduced. The widget uses `app.vault.getAbstractFileByPath()` (constrained to vault root by Obsidian API) and renders all text via `setText()`/`text:` property (no XSS vector). Consistent with threat model T-09-01 and T-09-03 mitigations in the plan.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/views/canvas-selector-widget.ts exists | FOUND |
| src/settings.ts exists | FOUND |
| src/styles.css exists | FOUND |
| 09-01-SUMMARY.md exists | FOUND |
| Commit ea2ad50 (Task 1) | FOUND |
| Commit e3a251c (Task 2) | FOUND |
| protocolFolderPath in settings.ts | FOUND |
| CanvasSelectorWidget export | FOUND |
| rp-selector-trigger CSS class | FOUND |
| Phase 9 CSS comment | FOUND |
