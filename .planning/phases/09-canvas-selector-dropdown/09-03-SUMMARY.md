---
phase: 09-canvas-selector-dropdown
plan: "03"
subsystem: runner-ui
tags: [runner-view, canvas-selector, integration, vault-events, modal, session-management]
dependency_graph:
  requires:
    - 09-01 (CanvasSelectorWidget + protocolFolderPath setting)
    - 09-02 (CanvasSwitchModal)
  provides:
    - RunnerView wired with CanvasSelectorWidget in headerEl
    - Mid-session canvas switch confirmation via CanvasSwitchModal
    - Vault file-event listeners keeping selector current
    - Idle-state UX updated to "Select a protocol above"
  affects:
    - src/views/runner-view.ts
tech_stack:
  added: []
  patterns:
    - Cast to unknown to access undocumented runtime DOM element (headerEl)
    - Vault event listeners registered via this.registerEvent() (auto-cleaned on view close)
    - Promise-based modal with await modal.result pattern
    - Optional-chaining on selector (CanvasSelectorWidget | null) for safety
key_files:
  created: []
  modified:
    - src/views/runner-view.ts
decisions:
  - "headerEl accessed via (this as unknown as { headerEl: HTMLElement }).headerEl — not in Obsidian public types but present at runtime on every ItemView; cast is minimal and localized"
  - "TFolder import added to obsidian import but not used in vault event handlers (TFile check is sufficient for .canvas files) — no-op, harmless"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
requirements:
  - SELECTOR-01
  - SELECTOR-02
  - SELECTOR-03
  - SELECTOR-04
---

# Phase 9 Plan 03: RunnerView Integration Summary

**One-liner:** `RunnerView` wired with `CanvasSelectorWidget` in headerEl, three vault file-event listeners, `handleSelectorSelect()` with D-12/D-13 mid-session confirmation, and idle-state UX updated to match the dropdown-first flow.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Wire CanvasSelectorWidget into RunnerView.onOpen() with vault events | 87c6fea | src/views/runner-view.ts |
| 2 | Sync openCanvas() selector label and replace idle-state UX | 6f31ea4 | src/views/runner-view.ts |

---

## What Was Built

### Task 1 — CanvasSelectorWidget integration + vault events

**Imports added:**
- `TFolder` added to the existing obsidian import line
- `CanvasSelectorWidget` imported from `./canvas-selector-widget`
- `CanvasSwitchModal` imported from `./canvas-switch-modal`

**Private field added:**
- `private selector: CanvasSelectorWidget | null = null`

**`onOpen()` replaced:**
- Creates `CanvasSelectorWidget` into `headerEl` (accessed via type cast — see Deviations)
- Syncs label if `canvasFilePath` is already set (workspace state restore path)
- Registers three vault event listeners via `this.registerEvent()` for `create`, `delete`, and `rename` — each calls `this.selector?.rebuildIfOpen()` when a `.canvas` file is involved
- Calls `this.render()` at the end (unchanged)

**`onClose()` updated:**
- Calls `this.selector?.destroy()` before setting `selector = null` and emptying `contentEl`

**`handleSelectorSelect()` added** (private async method after `openCanvas()`):
- No-op if user selects the already-active canvas (`newPath === this.canvasFilePath`)
- Checks `runner.getState().status` — if `at-node` or `awaiting-snippet-fill`, opens `CanvasSwitchModal` and awaits `modal.result`
- On cancel: reverts selector label to previous canvas via `setSelectedPath(this.canvasFilePath)`, returns
- On confirm: clears the active session via `sessionService.clear(this.canvasFilePath)` before switching
- For idle/complete states: falls through directly without a modal
- Calls `selector.setSelectedPath(newPath)` then `openCanvas(newPath)` to complete the switch

### Task 2 — Selector sync in openCanvas() + idle UX

**`openCanvas()` updated:**
- `this.selector?.setSelectedPath(filePath)` added immediately after `this.canvasFilePath = filePath`
- Ensures external callers (e.g. `activateRunnerView()` in main.ts) keep the trigger label current

**Idle-state UX updated:**
- Removed `h2` heading ("Open a canvas file to start") and `p` command palette hint
- Replaced with single `p` element: "Select a protocol above to get started."
- `cls: 'rp-empty-state-body'` retained for consistent styling

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Source files out of sync after worktree reset**
- **Found during:** Pre-task setup
- **Issue:** `git reset --soft` to target commit left working tree files from before Plan 01 commits — `src/settings.ts`, `src/main.ts`, `src/styles.css`, test files were all missing Plan 01's `protocolFolderPath` additions, causing TS2339 errors
- **Fix:** `git checkout HEAD -- <files>` for all non-runner-view source files to restore HEAD state
- **Files modified:** src/settings.ts, src/main.ts, src/styles.css, src/__tests__/settings-tab.test.ts, src/__tests__/snippet-service.test.ts
- **Commit:** Included in Task 1 commit (87c6fea — 2 files changed shows the settings.ts restoration)

**2. [Rule 1 - Bug] headerEl not in Obsidian public type definitions**
- **Found during:** Task 1 TypeScript compilation (TS2339: Property 'headerEl' does not exist on type 'RunnerView')
- **Issue:** `this.headerEl` is a real DOM element on every Obsidian ItemView at runtime but is absent from the official `obsidian.d.ts` type declarations
- **Fix:** Access via `(this as unknown as { headerEl: HTMLElement }).headerEl` with an explanatory comment; cast is localized to one line in `onOpen()`
- **Files modified:** src/views/runner-view.ts
- **Commit:** 87c6fea

---

## Known Stubs

None — all four SELECTOR requirements (SELECTOR-01 through SELECTOR-04) are now fully wired end-to-end. The `onSelect` callback stub from Plan 01 is resolved.

---

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The `handleSelectorSelect()` method routes through existing `sessionService.clear()` (WriteMutex-guarded) and `openCanvas()` (vault-read only). Threat mitigations from the plan's threat register are implemented:

| Threat | Status |
|--------|--------|
| T-09-07: session clear only after confirmed === true | Mitigated — guard in handleSelectorSelect() |
| T-09-08: rapid vault events / rebuildIfOpen DoS | Accepted — rebuildIfOpen() is no-op when popover closed |
| T-09-09: needsConfirmation uses runner state directly | Mitigated — no client-supplied data |
| T-09-10: file paths in selector callback | Accepted — vault-relative paths, no external exposure |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/views/runner-view.ts modified | FOUND |
| Commit 87c6fea (Task 1) | FOUND |
| Commit 6f31ea4 (Task 2) | FOUND |
| import CanvasSelectorWidget | FOUND (line 12) |
| import CanvasSwitchModal | FOUND (line 13) |
| private selector field | FOUND (line 24) |
| new CanvasSelectorWidget in onOpen() | FOUND (line 139) |
| handleSelectorSelect method | FOUND (line 188) |
| rebuildIfOpen (3 vault event handlers) | FOUND (lines 156, 163, 170) |
| selector?.destroy() in onClose() | FOUND (line 179) |
| setSelectedPath(filePath) in openCanvas() | FOUND (line 56) |
| "Select a protocol above" in idle case | FOUND (line 238) |
| "Open a canvas file to start" removed | CONFIRMED absent |
| innerHTML usage | CONFIRMED absent |
| npx tsc --noEmit (src errors) | 0 errors |
