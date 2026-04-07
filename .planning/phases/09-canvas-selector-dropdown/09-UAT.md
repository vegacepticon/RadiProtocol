---
status: complete
phase: 09-canvas-selector-dropdown
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Protocol Folder Setting visible in Settings
expected: Open Obsidian Settings → RadiProtocol. A "Protocol" group appears between the Runner and Output groups, containing a folder-path field. Field is empty by default.
result: pass

### 2. Canvas Selector button appears in Runner header
expected: Open the RadiProtocol Runner panel. A trigger button/dropdown is visible in the view's header (top bar). With no protocol folder set it shows a hint like "Set a protocol folder in Settings to get started." when clicked.
result: pass

### 3. Drill-down folder navigation in the selector
expected: Set a protocol folder (Settings → RadiProtocol → Protocol folder). Open the Runner, click the selector trigger. A popover lists subfolders first (alphabetically) then .canvas files. Clicking a subfolder drills into it and shows a "Back" row at the top. Clicking Back returns to the parent level.
result: issue
reported: "дропдаун падает, вижу файлы в той папке которую указал в настройках плагина, но когда перехожу по вложенной папке - дропдаун сворачивается, ничего не выбирается - содержимое поэтому не видно, в том числе вложенных папок и кнопки назад получается что тоже"
severity: major
fixed: b6afe89
fix_verified: true

### 4. Selecting a canvas file via the dropdown
expected: In the selector popover, click a .canvas file row. The popover closes, the trigger button label updates to the selected filename, and the canvas loads in the Runner (same behaviour as opening via command palette).
result: pass

### 5. Idle-state message after protocol folder is set but no canvas selected
expected: With protocol folder set but no canvas chosen yet, the Runner content area shows "Select a protocol above to get started." (no "Open a canvas file" heading or command-palette hint).
result: pass

### 6. Mid-session canvas switch shows confirmation modal
expected: Start a protocol session so the runner is at-node or awaiting snippet fill. Then pick a different canvas from the selector. A modal dialog appears asking to confirm the switch ("Switch protocol canvas?" or similar). Clicking Cancel keeps the current canvas running; clicking Continue switches to the new canvas and clears the session.
result: pass

### 7. Selector label stays in sync when canvas opened externally
expected: Open a canvas through the command palette (or any method other than the selector). The selector trigger label in the Runner header updates to reflect the newly opened canvas filename.
result: pass

### 8. Selector reflects vault changes while popover is open
expected: With the selector popover open, create or rename a .canvas file inside the protocol folder (in another pane or via the file explorer). The popover list refreshes to show the change without needing to close and reopen it.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking a subfolder drills into it and shows its contents (subfolders + .canvas files) with a Back row at the top"
  status: fixed
  reason: "User reported: дропдаун падает, вижу файлы в той папке которую указал в настройках плагина, но когда перехожу по вложенной папке - дропдаун сворачивается, ничего не выбирается"
  severity: major
  test: 3
  root_cause: "click event bubbled to outsideClickHandler after renderPopoverContent() emptied the popover DOM — detached target caused popover.contains() to return false, triggering closePopover()"
  artifacts:
    - path: "src/views/canvas-selector-widget.ts"
      issue: "missing e.stopPropagation() on folder row and Back row click handlers"
  missing:
    - "e.stopPropagation() added to folder row handler (line ~177)"
    - "e.stopPropagation() added to Back row handler (line ~150)"
  fix_commit: b6afe89
  fix_verified: true
