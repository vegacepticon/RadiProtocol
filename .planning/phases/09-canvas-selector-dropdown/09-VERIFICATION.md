---
phase: 09-canvas-selector-dropdown
verified: 2026-04-07T18:35:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open RunnerView in sidebar and confirm the selector dropdown button appears in the header bar (above contentEl), not inside the content area"
    expected: "A 'Select a protocol...' button with a chevron icon is visible in the panel header"
    why_human: "headerEl is an undocumented runtime property accessed via type-cast — automated checks confirm the code path exists but cannot confirm the DOM element renders at the right position in a live Obsidian window"
  - test: "Set Protocol canvas folder to a vault folder containing .canvas files. Click the trigger button and verify the popover lists those files by basename (no .canvas extension)"
    expected: "Popover opens showing .canvas filenames without extension, with a folder icon for subfolders and a file icon for canvas files"
    why_human: "Vault traversal and icon rendering require a live Obsidian environment"
  - test: "Drill into a subfolder; verify a 'Back' row appears at the top. Click Back and confirm the root-level contents are shown again"
    expected: "Back row with left-arrow icon appears at top of popover when inside a subfolder; clicking it returns to root"
    why_human: "Drill-down navigation state is runtime DOM behavior"
  - test: "Start a protocol session (reach at-node or awaiting-snippet-fill state). Open the selector and pick a different canvas. Verify the 'Switch protocol canvas?' modal appears"
    expected: "Modal shows heading 'Switch protocol canvas?', warning text, Cancel and Continue buttons"
    why_human: "Requires a live session in-progress and modal rendering"
  - test: "In the confirmation modal, click Cancel. Verify the selector reverts to showing the original canvas name and the session continues"
    expected: "Trigger button label reverts to the previously active canvas; session is unaffected"
    why_human: "Requires observable UI state revert and session persistence check"
  - test: "In the confirmation modal, click Continue. Verify the session clears and the new canvas loads"
    expected: "Runner resets to idle/first-question of new canvas; session file for old canvas removed"
    why_human: "Session file deletion and canvas reload require live vault I/O"
  - test: "With runner idle, pick a canvas from the selector — confirm no modal appears and the canvas loads directly"
    expected: "Canvas loads immediately; idle state replaced by first question or new idle prompt from selected canvas"
    why_human: "Conditional modal path depends on runner state at runtime"
  - test: "In idle state, verify the content area shows 'Select a protocol above to get started.' with no h2 heading and no command palette hint"
    expected: "Only one paragraph element with the new idle text; old 'Open a canvas file to start' and command palette hint are absent"
    why_human: "Visual rendering check on live Obsidian panel"
---

# Phase 09: Canvas Selector Dropdown — Verification Report

**Phase Goal:** Users can choose which canvas/protocol to run from within the runner panel via a dropdown, without invoking the command palette again.
**Verified:** 2026-04-07T18:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All must-haves from all three plans (09-01, 09-02, 09-03) are verified against the actual source files.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RadiProtocolSettings has a protocolFolderPath field with default value '' | VERIFIED | `src/settings.ts` line 17: `protocolFolderPath: string`; line 27: `protocolFolderPath: ''` |
| 2 | CanvasSelectorWidget renders a trigger button in the given container element | VERIFIED | `canvas-selector-widget.ts` lines 53–56: `createDiv` wrapper + `createEl('button')` trigger; full `render()` implementation |
| 3 | Clicking the trigger button opens a popover panel with folder/file rows | VERIFIED | `openPopover()` at line 84 creates `.rp-selector-popover` div and calls `renderPopoverContent()`; folder/file rows built at lines 170–199 |
| 4 | Clicking a subfolder drills into it and shows a Back row at the top | VERIFIED | Lines 144–153: Back row shown when `currentPath.length > 0`; folder click at line 177 pushes to `currentPath` and re-renders |
| 5 | Clicking a .canvas file selects it, closes the popover, and updates the trigger label | VERIFIED | Lines 193–198: `selectedFilePath = file.path`, `updateTriggerLabel()`, `closePopover()`, `onSelect(file.path)` |
| 6 | Popover closes when clicking outside (document click listener) | VERIFIED | Lines 91–96 in `openPopover()`: document listener checks `!popover.contains(e.target)` and calls `closePopover()` |
| 7 | When protocolFolderPath is empty the popover shows only the hint text | VERIFIED | Lines 116–119: `if (folderPath === '') { createDiv hint; return; }` |
| 8 | CanvasSwitchModal opens with a warning message and two buttons: Continue and Cancel | VERIFIED | `canvas-switch-modal.ts` lines 27–50: `onOpen()` creates h2, warning p, Cancel btn, Continue btn with `mod-cta` |
| 9 | Clicking Continue resolves the modal result promise with true | VERIFIED | Line 48: `continueBtn.addEventListener('click', () => { this.confirm(true); })` |
| 10 | Clicking Cancel resolves the modal result promise with false | VERIFIED | Line 41: `cancelBtn.addEventListener('click', () => { this.confirm(false); })` |
| 11 | Pressing Escape closes the modal and resolves with false | VERIFIED | Lines 53–58: `onClose()` resolves with false when `!this.resolved`; Obsidian Modal base fires `onClose()` on Escape |
| 12 | RunnerView.onOpen() renders CanvasSelectorWidget into this.headerEl | VERIFIED | `runner-view.ts` lines 134–177: `onOpen()` creates widget via cast `(this as unknown as { headerEl: HTMLElement }).headerEl`; widget stored in `this.selector` |
| 13 | Selecting a canvas from the dropdown calls openCanvas(filePath) on the view | VERIFIED | `handleSelectorSelect()` at line 189; line 218: `await this.openCanvas(newPath)` |
| 14 | When runner state is at-node or awaiting-snippet-fill, selecting a different canvas shows CanvasSwitchModal | VERIFIED | Lines 194–213: `needsConfirmation` check; `new CanvasSwitchModal(this.app)` opened and awaited |
| 15 | Confirming the modal clears the session and opens the new canvas | VERIFIED | Lines 210–211: `sessionService.clear(this.canvasFilePath)`; line 218: `openCanvas(newPath)` |
| 16 | Cancelling the modal reverts the selector to the previously selected canvas | VERIFIED | Lines 203–207: `!confirmed` branch calls `selector?.setSelectedPath(this.canvasFilePath)` and returns |
| 17 | When runner state is idle or complete, canvas switch happens without a modal | VERIFIED | Lines 194–213: `needsConfirmation` is only true for `at-node` / `awaiting-snippet-fill`; idle/complete fall through directly to line 217 |
| 18 | Vault create/delete/rename events targeting .canvas files rebuild the selector | VERIFIED | Lines 154–174: three `this.registerEvent(this.app.vault.on(...))` handlers; each checks `file instanceof TFile && file.extension === 'canvas'` and calls `selector?.rebuildIfOpen()` |
| 19 | Idle state shows 'Select a protocol above' instead of old h2 heading and command palette hint | VERIFIED | Line 237–240: `case 'idle'` renders only `<p>Select a protocol above to get started.</p>`; old text confirmed absent (grep returned nothing) |

**Score:** 19/19 truths verified (exceeds the 16 explicitly tracked in frontmatter — additional truths from Plans 02 and 03 cross-verified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/settings.ts` | protocolFolderPath field in interface and DEFAULT_SETTINGS | VERIFIED | Field at line 17 with JSDoc; default at line 27; settings tab group at lines 58–75 |
| `src/views/canvas-selector-widget.ts` | CanvasSelectorWidget class with drill-down dropdown | VERIFIED | 209-line implementation; full drill-down, back navigation, outside-click, rebuild-if-open |
| `src/styles.css` | rp-selector-* CSS classes (13 classes) | VERIFIED | Phase 9 section starts at line 493; all 13 classes present: wrapper, trigger, trigger:hover, trigger-label, placeholder, chevron, popover, row, row:hover, row.is-selected, back-row, row-icon, row-label, row-arrow, empty-hint |
| `src/views/canvas-switch-modal.ts` | CanvasSwitchModal class extending Modal | VERIFIED | 69-line implementation with resolved guard, confirm(), onClose() safe default |
| `src/views/runner-view.ts` | RunnerView updated with selector wiring, vault events, idle UX | VERIFIED | Imports at lines 12–13; selector field at line 24; full onOpen() at lines 134–177; handleSelectorSelect() at lines 189–219 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `canvas-selector-widget.ts` | `src/settings.ts` | reads `protocolFolderPath` | WIRED | Line 113: `this.plugin.settings.protocolFolderPath.trim()` |
| `canvas-selector-widget.ts` | `app.vault` | `getAbstractFileByPath()` + TFolder/TFile | WIRED | Line 122: `this.app.vault.getAbstractFileByPath(folderPath)`; `TFolder`/`TFile` instanceof guards throughout |
| `RunnerView.onOpen()` | `CanvasSelectorWidget` | `new CanvasSelectorWidget(this.app, this.plugin, headerEl, onSelect)` | WIRED | Lines 140–145: constructor call with all required args |
| `onSelect callback` | `CanvasSwitchModal + sessionService.clear + openCanvas` | check runner state, maybe show modal, then call openCanvas | WIRED | `handleSelectorSelect()` lines 189–219: full D-12/D-13 logic |
| `vault events` | `selector.rebuildIfOpen()` | `this.registerEvent(this.app.vault.on('create'|'delete'|'rename', ...))` | WIRED | Lines 154–174: three registered event handlers each calling `selector?.rebuildIfOpen()` |
| `runner-view.ts` | `canvas-switch-modal.ts` | import + open modal and await result | WIRED | Line 13 import; line 199–201: `new CanvasSwitchModal`, `modal.open()`, `await modal.result` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `CanvasSelectorWidget` | `plugin.settings.protocolFolderPath` | `RadiProtocolPlugin.settings` (loaded from vault via `loadData()`) | Yes — user-configured vault path | FLOWING |
| `CanvasSelectorWidget` | `currentFolder.children` | `app.vault.getAbstractFileByPath()` → `TFolder.children` | Yes — live vault file tree | FLOWING |
| `RunnerView.handleSelectorSelect` | `runner.getState().status` | `ProtocolRunner.getState()` (live state machine) | Yes — real runner discriminated union | FLOWING |
| `RunnerView.handleSelectorSelect` | `modal.result` | `CanvasSwitchModal` promise resolved by user button click | Yes — user interaction event | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation (all 3 plans) | `npx tsc --noEmit` | 0 errors (no output) | PASS |
| No innerHTML usage in widget | `grep "innerHTML" src/views/canvas-selector-widget.ts` | 0 matches | PASS |
| No innerHTML usage in modal | `grep "innerHTML" src/views/canvas-switch-modal.ts` | 0 matches | PASS |
| No innerHTML usage in runner-view | `grep "innerHTML" src/views/runner-view.ts` | 0 matches | PASS |
| CanvasSelectorWidget exports correctly | `grep "export class CanvasSelectorWidget"` | Found at line 14 | PASS |
| CanvasSwitchModal exports correctly | `grep "export class CanvasSwitchModal"` | Found at line 14 | PASS |
| Old idle text absent | `grep "Open a canvas file to start"` in runner-view.ts | 0 matches | PASS |
| Old idle text absent | `grep "Use the.*Run protocol.*command"` in runner-view.ts | 0 matches | PASS |
| Three vault event listeners registered | `grep "registerEvent\|vault.on"` | Lines 154, 161, 168 (3 listeners) | PASS |
| All Phase 9 commits verified in git | `git log --oneline ea2ad50 ef1abf2 e3a251c 87c6fea 6f31ea4` | All 5 commits found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SELECTOR-01 | 09-01, 09-03 | protocolFolderPath setting + widget reads it | SATISFIED | `protocolFolderPath` in interface/defaults; widget reads it at runtime for folder scan |
| SELECTOR-02 | 09-01, 09-03 | Canvas selector dropdown in RunnerView header | SATISFIED | CanvasSelectorWidget wired into headerEl in `onOpen()` |
| SELECTOR-03 | 09-02, 09-03 | Mid-session confirmation dialog | SATISFIED | CanvasSwitchModal used in `handleSelectorSelect()` for at-node/awaiting-snippet-fill states |
| SELECTOR-04 | 09-03 | Vault file-event listeners keep selector current | SATISFIED | Three vault event listeners (create/delete/rename) registered in `onOpen()` via `registerEvent()` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/views/runner-view.ts` | 139 | `(this as unknown as { headerEl: HTMLElement }).headerEl` — type-cast to access undocumented runtime property | Info | Not a code smell; documented in SUMMARY.md as intentional (D-05). `headerEl` is present on every Obsidian ItemView at runtime; the cast is localized to one line with an explanatory comment. No safer alternative exists given the missing Obsidian type definition. |

No TODO/FIXME/placeholder comments found. No stub `return null` / `return []` / `return {}` patterns found in Phase 9 files. No console.log in production paths.

### Human Verification Required

#### 1. Selector placement in headerEl

**Test:** Open Obsidian with the plugin loaded. Open the RunnerView (sidebar or tab). Observe the panel header area above the content zone.
**Expected:** A button labeled "Select a protocol..." with a downward chevron icon appears in the header strip, not in the content area.
**Why human:** `headerEl` is accessed via a type-cast to an undocumented runtime property. Code is correct, but visual placement confirmation requires a live Obsidian window.

#### 2. Popover content from vault folder

**Test:** In Settings, set "Protocol canvas folder" to a vault folder that contains .canvas files (and optionally subfolders). Click the selector button.
**Expected:** A popover appears below the trigger button listing subfolders (folder icon + chevron) and .canvas files (file icon, basename without .canvas extension), sorted with folders first then files alphabetically.
**Why human:** Vault traversal and Obsidian `setIcon()` rendering require a live environment.

#### 3. Subfolder drill-down navigation

**Test:** With a multi-level folder structure, click a subfolder row in the popover.
**Expected:** Popover content replaces with the subfolder's contents; a "Back" row with a left-arrow icon appears at the top.
**Why human:** Drill-down state is runtime DOM behavior.

#### 4. Mid-session confirmation modal appearance

**Test:** Open a canvas, advance the session to at-node or awaiting-snippet-fill state. Open the selector dropdown and click a different canvas file.
**Expected:** A modal appears with heading "Switch protocol canvas?", warning paragraph "The active session will be reset. Any unsaved progress will be lost.", and two buttons — "Cancel" (default) and "Continue" (primary/mod-cta).
**Why human:** Requires live session in-progress; modal DOM rendering is visual.

#### 5. Modal Cancel reverts selector label

**Test:** In the confirmation modal, click Cancel.
**Expected:** Modal closes; selector trigger button reverts to showing the previously active canvas basename; session continues uninterrupted.
**Why human:** Observable UI state revert requires live runtime.

#### 6. Modal Continue clears session and loads new canvas

**Test:** In the confirmation modal, click Continue.
**Expected:** Modal closes; runner resets and loads the newly selected canvas (shows its first question or idle state); session file for old canvas is removed from vault.
**Why human:** Session file deletion and canvas reload require live vault I/O verification.

#### 7. Idle-to-canvas switch without modal

**Test:** With runner in idle state (no canvas loaded), use the selector to pick a canvas.
**Expected:** Canvas loads immediately with no confirmation dialog.
**Why human:** Conditional code path verification (modal skipped for idle) requires live runner state.

#### 8. Idle state visual — new copy

**Test:** Open RunnerView with no canvas selected (fresh idle state).
**Expected:** Content area shows only "Select a protocol above to get started." in muted text. No h2 heading "Open a canvas file to start". No "Use the 'Run protocol' command from the command palette." text.
**Why human:** Visual rendering confirmation of the new idle UX.

---

## Summary

Phase 09 (canvas-selector-dropdown) is **structurally complete**. All 19 observable truths across Plans 01–03 pass automated verification:

- `protocolFolderPath` added correctly to settings interface, defaults, and settings tab UI
- `CanvasSelectorWidget` is a full 209-line drill-down implementation with outside-click handling, vault traversal, back-navigation, and `rebuildIfOpen()` for vault events
- `CanvasSwitchModal` follows the established promise-based modal pattern with a double-resolution guard
- `RunnerView` is wired end-to-end: widget in `headerEl` (via documented type-cast), three vault event listeners, `handleSelectorSelect()` with D-12/D-13 mid-session confirmation logic, selector label sync in `openCanvas()`
- TypeScript compilation: **0 errors**
- No `innerHTML` usage anywhere
- Old idle state text ("Open a canvas file to start") fully replaced with "Select a protocol above to get started."
- All 5 Phase 9 feature commits verified in git history

The only remaining items are **8 human UAT checks** covering visual placement, vault traversal rendering, modal interaction flows, and the idle UX — none of which can be verified programmatically without a live Obsidian environment. No gaps or deferred items were identified.

---

_Verified: 2026-04-07T18:35:00Z_
_Verifier: Claude (gsd-verifier)_
