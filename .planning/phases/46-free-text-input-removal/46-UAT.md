---
status: complete
phase: 46-free-text-input-removal
source:
  - 46-01-graph-model-parser-validator-SUMMARY.md
  - 46-02-runner-views-color-map-SUMMARY.md
  - 46-03-test-cleanup-SUMMARY.md
started: 2026-04-18T13:07:10Z
updated: 2026-04-18T13:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Legacy canvas rejection panel
expected: RunnerView shows Russian error with «устаревший», «free-text-input», and the offending node id when the canvas carries a `free-text-input` node.
result: pass

### 2. Node picker excludes free-text-input
expected: In the protocol editor, open the "+ Add node" picker (NodePickerModal). The list shows question / text-block / snippet / loop (and any other kept kinds), with NO `free-text-input` option anywhere.
result: pass

### 3. Editor panel kind dropdown excludes free-text-input
expected: Open the Node Editor panel for any node and inspect the "Kind" dropdown. Options are: start, question, answer, text-block, snippet, loop. `free-text-input` is NOT in the list.
result: pass

### 4. Clean build and test suite
expected: `npm run build` exits 0 and `npm test -- --run` reports 419 passed + 1 skipped / 0 failed.
result: pass
evidence: |
  npm run build → exit 0; copied to dev vault.
  npm test -- --run → Test Files 32 passed (32); Tests 419 passed | 1 skipped (420).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
