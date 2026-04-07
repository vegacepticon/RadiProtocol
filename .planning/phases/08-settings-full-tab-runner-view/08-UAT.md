---
status: testing
phase: 08-settings-full-tab-runner-view
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings Tab — Four Groups Visible
expected: Open Obsidian Settings → RadiProtocol. The settings pane should show four labeled groups: Runner, Output, Protocol engine, Storage — with their respective controls fully rendered. The old placeholder text "Settings UI coming in phase 3." should NOT appear anywhere.
result: pass

### 2. Runner View Mode Dropdown Present
expected: In Settings → RadiProtocol → Runner group, a "Runner View Mode" dropdown is visible. It should have two options: "Sidebar" and "Tab". The currently selected value should be "Sidebar" for an existing install (or first-time default).
result: pass

### 3. Invalid maxLoopIterations Shows Notice
expected: In Settings → RadiProtocol → Protocol engine group, type a non-numeric value (e.g., "abc") or zero/negative number (e.g., "-1") into the Max Loop Iterations field and press Enter or click away. A brief Obsidian Notice should appear informing you the value is invalid. The field should revert to or retain the last valid value.
result: pass

### 4. Open Runner in Sidebar Mode (Default)
expected: With Runner View Mode set to "Sidebar" (default), trigger the runner (e.g., via ribbon icon or command palette). The RadiProtocol runner panel should open in the right sidebar — same as before phase 8. No tab opens in the main editor area.
result: issue
reported: "при нажатии на иконку выскакивает справа сверху надпись 'Radiprotocol loaded. Open a canvas file to run a protocol', даже если .canvas открыт. Если выбираю командой Run protocol - боковая панель справа открывается."
severity: major

### 5. Open Runner in Tab Mode
expected: Change Runner View Mode to "Tab" in settings. Trigger the runner. The RadiProtocol runner should open as a tab in the main workspace editor tab strip (not in the sidebar).
result: pass

### 6. No Duplicate on Second Invocation
expected: With the runner already open (sidebar or tab), trigger it again without changing any settings. The existing runner view should come to focus — no second copy/tab/pane should be created.
result: pass

### 7. Mode Change Reopens in New Location
expected: With the runner open in one mode (e.g., Sidebar), change Runner View Mode to the other mode (e.g., Tab) in settings, then trigger the runner again. The old runner view should close and a new one should open in the correct new location (main tab strip or sidebar).
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clicking the ribbon icon with a canvas file open should open the runner in sidebar (same as Run protocol command)"
  status: failed
  reason: "User reported: при нажатии на иконку выскакивает 'Radiprotocol loaded. Open a canvas file to run a protocol', даже если .canvas открыт. Команда Run protocol работает корректно."
  severity: major
  test: 4
  root_cause: "Ribbon icon handler in main.ts was a Phase 3 stub — showed a hardcoded Notice instead of calling activateRunnerView(). The Run protocol command was wired correctly but the ribbon was never updated."
  artifacts:
    - path: "src/main.ts"
      issue: "addRibbonIcon callback showed Notice stub instead of calling activateRunnerView()"
  missing:
    - "Replace stub with: void this.activateRunnerView()"
  fix_applied: "Replaced stub body with `void this.activateRunnerView()` — matches Run protocol command handler"
  debug_session: ""
