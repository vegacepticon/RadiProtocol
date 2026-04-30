---
status: complete
phase: 35-markdown-snippets-in-protocol-runner
source: 35-01-SUMMARY.md, 35-02-PLAN.md
started: 2026-04-16T12:00:00Z
updated: 2026-04-16T12:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. MD and JSON snippets visible in picker
expected: Open a canvas with a snippet-pick node, reach the snippet picker. Both JSON (📄) and MD (📝) files appear in the list with distinct glyph prefixes. Folders show 📁 as before.
result: pass

### 2. MD click inserts verbatim (no modal)
expected: Click a 📝 MD snippet row. No fill-in modal opens. The MD file content appears verbatim in accumulated text. Runner advances past the snippet-pick state.
result: pass

### 3. Step back after MD insert
expected: After inserting an MD snippet, click Step Back. Accumulated text reverts to pre-MD state. Snippet picker reopens on the same folder.
result: pass

### 4. Subfolder drill-down with MD
expected: Click 📁 subfolder in the picker. Nested MD files appear with 📝 prefix. Click one — content inserts verbatim. Breadcrumb / Up navigation works.
result: pass

### 5. Empty MD file click
expected: Click 📝 empty (a 0-byte .md file). No errors in console. Runner advances. Accumulated text unchanged (empty string inserted).
result: pass

### 6. Session save/resume with MD content
expected: After inserting an MD snippet, reload Obsidian or the plugin. Open saved sessions. The session with MD content restores correctly — accumulated text contains the previously inserted MD content byte-for-byte.
result: pass

### 7. No console errors
expected: Throughout all operations, DevTools Console shows no errors or warnings related to snippet picker or runner-view.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
