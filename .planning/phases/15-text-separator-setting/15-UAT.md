---
status: complete
phase: 15-text-separator-setting
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md]
started: 2026-04-09T06:35:00Z
updated: 2026-04-09T07:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Global text separator setting in Settings tab
expected: Open Obsidian Settings → RadiProtocol plugin tab. Under the "Runner" section you should see two fields: "Max loop iterations" and a "Text separator" dropdown. The dropdown should default to "Newline" (or show "newline" as the selected value).
result: pass
note: Passed, but user noticed regression — previously existing settings (Runner view mode, Output, Storage) are missing from the tab. See Gaps.

### 2. Per-node separator dropdown appears for answer / free-text-input / text-block nodes
expected: Open the EditorPanel for a node of kind "answer", "free-text-input", or "text-block". Near the bottom of the form you should see a "Text separator" dropdown with three options: "Use global (default)", "Newline", and "Space". If no per-node separator is saved yet, it should default to the "Use global" option.
result: pass

### 3. Separator dropdown absent on other node types
expected: Open the EditorPanel for a node of kind "start", "question", "loop-start", or "loop-end". No "Text separator" dropdown should appear anywhere in the form for these node types.
result: pass

### 4. Global separator affects protocol run output
expected: Change the "Text separator" setting to "Space" in the Settings tab and run a multi-node protocol (at least two answer or text-block nodes that produce output). The accumulated text in the result area should have a single space between each chunk (e.g. "chunk1 chunk2") rather than a newline.
result: pass
note: Passed, but user reported 4 additional regressions discovered during run. See Gaps.

### 5. Per-node separator overrides the global setting
expected: Leave the global separator as "Newline". Open an answer node in the EditorPanel, set its "Text separator" to "Space", and save. Run a protocol that exercises that node. The output for that specific node should be joined with a space, while other nodes (without a per-node override) continue to use newlines.
result: issue
reported: "Если выбираю в настройках newline, а на узле space - при выполнении сценария все равно результат вставляется всегда на новых строчках. Per-node separator не переопределяет глобальный."
severity: major

## Summary

total: 5
passed: 4
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Settings tab shows all previously implemented controls: Runner view mode (sidebar/tab), Output destination, Output folder, Max loop iterations, Snippet folder, Session folder — in addition to the new Text separator"
  status: failed
  reason: "User reported: settings tab rewrite in 15-01 only rendered Runner section (maxLoopIterations + textSeparator). All other sections (Output, Storage) were dropped from display(). Additionally runnerViewMode field was removed from the settings interface entirely — field existed since Phase 08 (commit fb89000)."
  severity: blocker
  test: 1
  artifacts: [src/settings.ts]
  missing: [runnerViewMode field in interface + DEFAULT_SETTINGS, Output section in display(), Storage section in display()]

- truth: "Protocol Runner shows a text field (editable area) below the report preview for manual editing or copying output"
  status: failed
  reason: "User reported: text field under report preview in Protocol Runner has regressed/disappeared"
  severity: blocker
  test: 4
  artifacts: [src/views/runner-view.ts]
  missing: []

- truth: "Protocol Runner sidebar contains a button to select/open a canvas file to run"
  status: failed
  reason: "User reported: canvas selection button in the sidebar has disappeared"
  severity: blocker
  test: 4
  artifacts: [src/views/runner-view.ts]
  missing: []

- truth: "Protocol Runner shows 'Run again' and 'Insert in note' buttons after a protocol completes"
  status: failed
  reason: "User reported: 'Run again' and 'Insert in note' buttons have disappeared from the runner UI"
  severity: blocker
  test: 4
  artifacts: [src/views/runner-view.ts]
  missing: []

- truth: "EditorPanel allows saving node changes without closing the canvas (save button or equivalent)"
  status: failed
  reason: "User reported: ability to save node changes without closing the canvas has disappeared"
  severity: blocker
  test: 4
  artifacts: [src/views/editor-panel-view.ts]
  missing: []

- truth: "Per-node radiprotocol_separator value on a node overrides the global textSeparator setting when runner accumulates text for that node"
  status: failed
  reason: "User reported: setting node separator to 'space' while global is 'newline' has no effect — output always uses newlines regardless of per-node override"
  severity: major
  test: 5
  artifacts: [src/runner/protocol-runner.ts, src/views/runner-view.ts]
  missing: [resolveSeparator() reading radiprotocol_separator from canvas node data, or pendingEdits not persisting to canvas JSON before runner reads it]
