---
status: complete
phase: 25-snippet-node-runner-ui
source: [25-01-SUMMARY.md, 25-02-SUMMARY.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Runner halts at snippet node
expected: When a canvas protocol contains a snippet node, running it causes the runner to stop at that node and display a button labeled "Select file" (the default label). The runner does not advance past the node automatically.
result: pass
note: Button showed node's text as label ("Pick liver snippet") per D-09 fallback chain — correct behaviour

### 2. File picker opens filtered to configured folder
expected: Clicking the "Select file" button opens a fuzzy search modal titled "Search snippet files…" that lists only .md and .json files under the folder configured in Settings → Snippet Node Folder Path (recursively). Files outside that folder do not appear.
result: pass

### 3. Selecting a .md snippet file advances the runner
expected: Choosing a .md file from the picker appends the file's full contents to the accumulated protocol output and advances the runner past the snippet node to the next step.
result: pass

### 4. Selecting a .json snippet file opens the fill-in modal
expected: Choosing a .json snippet file opens the SnippetFillInModal with the template from the file. Completing the fill-in and confirming appends the rendered text to the output and advances the runner past the snippet node.
result: pass

### 5. Canceling the file picker leaves runner on the node
expected: Pressing Esc (or otherwise closing) the file picker without selecting a file dismisses the modal and the runner remains halted on the snippet node — the button is still visible and the runner has not advanced.
result: pass

### 6. Canceling the fill-in modal leaves runner on the node
expected: After selecting a .json file, canceling or closing the SnippetFillInModal (without confirming) dismisses it and the runner remains halted on the snippet node — no content is appended and the runner has not advanced.
result: pass

### 7. Notice when snippet folder is not configured
expected: When no Snippet Node Folder Path is set in Settings (and the node has no per-node folderPath override), clicking "Select file" shows an Obsidian Notice warning that no folder is configured — the file picker does not open.
result: pass

### 8. Custom button label from node
expected: A snippet node that has a radiprotocol_buttonLabel value set in its canvas data displays that custom label on the button instead of the default "Select file".
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
