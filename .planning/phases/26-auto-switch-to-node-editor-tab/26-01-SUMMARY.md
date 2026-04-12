---
phase: 26-auto-switch-to-node-editor-tab
plan: "01"
subsystem: node-editor
tags: [auto-switch, tab-reveal, ux, editor-panel]
dependency_graph:
  requires: []
  provides: [ensureEditorPanelVisible]
  affects: [handleNodeClick, loadNode]
tech_stack:
  added: []
  patterns: [getLeavesOfType-revealLeaf, non-destructive-leaf-open]
key_files:
  created: []
  modified:
    - src/main.ts
    - src/views/editor-panel-view.ts
decisions:
  - "ensureEditorPanelVisible uses getLeavesOfType+revealLeaf (non-destructive) — never calls detachLeavesOfType"
  - "ensureEditorPanelVisible call placed after dirty-guard block so guard still fires before reveal"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-12"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 26 Plan 01: Auto-Switch to Node Editor Tab Summary

**One-liner:** Non-destructive `ensureEditorPanelVisible()` added to RadiProtocolPlugin; wired into `handleNodeClick()` so every canvas node click brings the Node Editor tab to the foreground.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add ensureEditorPanelVisible() to main.ts and wire into handleNodeClick() | 9ad227e | src/main.ts, src/views/editor-panel-view.ts |

---

## What Was Built

### `ensureEditorPanelVisible()` — src/main.ts (line 141)

Public async method on `RadiProtocolPlugin`. Two-path logic:

1. **Leaf exists** — `getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)[0]` found → `revealLeaf()` only. No destruction of existing state.
2. **No leaf** — `getRightLeaf(false)` + `setViewState` + `revealLeaf`. Same creation pattern as `activateSnippetManagerView`.

`activateEditorPanelView()` is untouched. The new method is strictly non-destructive (`detachLeavesOfType` not called).

### `handleNodeClick()` — src/views/editor-panel-view.ts (line 113)

`await this.plugin.ensureEditorPanelVisible()` inserted immediately before `this.loadNode(filePath, nodeId)`. The same-node guard and dirty-guard modal block above it are left in place (dirty-guard removal is Plan 02 scope).

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Place `ensureEditorPanelVisible()` call after dirty-guard | Dirty-guard must still fire for unsaved edits before tab switch; placing reveal after guard is semantically correct |
| Do not modify `activateEditorPanelView()` | Destructive method stays for the explicit "open-node-editor" command; new method is narrowly scoped to auto-reveal |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. `ensureEditorPanelVisible()` only operates on leaves this plugin created (EDITOR_PANEL_VIEW_TYPE filter), consistent with T-26-03 accepted disposition.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/main.ts exists | FOUND |
| src/views/editor-panel-view.ts exists | FOUND |
| 26-01-SUMMARY.md exists | FOUND |
| Commit 9ad227e exists | FOUND |
