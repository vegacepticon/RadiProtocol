---
status: partial
phase: 44-unified-loop-runtime
source: [44-VERIFICATION.md]
started: 2026-04-17T17:10:00Z
updated: 2026-04-17T17:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Loop picker visual rendering in Obsidian (RUN-01)
expected: Open a canvas containing a `loop` node with `radiprotocol_headerText` set; start the protocol; verify the picker shows headerText on top, body-branch button(s) labelled with edge labels (accent-coloured), `выход` button (border-modifier neutral-coloured), and step-back button when `canStepBack` is true. Required Obsidian theme variables (`--interactive-accent`, `--background-modifier-border`, `--font-ui-medium`, etc.) must resolve correctly.
result: [pending]

### 2. Session resume across Obsidian restart (RUN-06 real-process)
expected: Start a protocol inside a loop, halt at the picker, then close Obsidian completely. Reopen Obsidian and verify the runner resumes at the same picker with the same accumulated text and same loop iteration. Automated tests simulate save/load via JSON round-trip (7 green tests) but cannot validate the actual Obsidian process restart cycle.
result: [pending]

### 3. Step-back UX after loop entry (RUN-05 visual)
expected: Start a protocol, enter the loop, pick a body branch, advance, then step back. Verify state visibly reverts to pre-loop accumulated text and the picker re-renders from the loop entry. The visual feedback (preview textarea reset, button enable/disable transitions, picker re-render flicker) requires human observation of the live ItemView.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
