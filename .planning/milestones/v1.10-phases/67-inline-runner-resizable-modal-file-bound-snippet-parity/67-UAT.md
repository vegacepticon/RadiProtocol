---
status: complete
phase: 67-inline-runner-resizable-modal-file-bound-snippet-parity
source:
  - 67-01-SUMMARY.md
  - 67-02-SUMMARY.md
  - 67-03-SUMMARY.md
started: 2026-04-25T18:15:00Z
updated: 2026-04-25T23:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Resize Inline Runner modal
expected: |
  Open a note, run "Run protocol in inline", select a canvas.
  Drag the SE corner of the floating modal to resize larger and smaller.
  The modal enforces min-width 240px and min-height 120px — it cannot shrink below these bounds.
  It enforces max bounds of viewport - 32px — cannot grow beyond that.
  During active resize, an elevated shadow is visible (is-resizing class).
  Resize is smooth with no jumps or focus loss.
result: pass
notes: "Gap fixed in commit 92a1269 — applyPosition() no longer clears style.width during drag."

### 2. Size persists across tab switch and restart
expected: |
  Resize the Inline Runner modal to a non-default size.
  Switch to another Obsidian tab, then switch back — size restores exactly.
  Close the modal and reopen via "Run protocol in inline" — size restores.
  Restart Obsidian, reopen the note, run inline runner — size restores from disk.
result: pass
notes: "Downstream effect of Gap 1; fixed once drag preservation was resolved (commit 92a1269)."

### 3. Clamp size on viewport shrink
expected: |
  With a saved large size, shrink the Obsidian window to ~600x400 px.
  Open the Inline Runner — modal size clamps to fit within viewport - 32px (max ~568x368).
  Modal is fully visible, still draggable and resizable.
  Expanding the window back does NOT auto-restore the old larger size.
result: pass

### 4. Legacy data.json back-compat
expected: |
  Manually edit data.json so inlineRunnerPosition has only left/top (no width/height).
  Restart Obsidian, open inline runner — modal opens at default 360x240.
  After resizing once, data.json gains width/height alongside left/top.
result: pass

### 5. Loop-body file-bound snippet in Inline Runner
expected: |
  Use a canvas with a Loop whose body branch ends at a file-bound Snippet node (md file).
  Open inline runner, reach loop picker. Body branch button shows a caption with a document emoji (U+1F4C4).
  Click the body branch — file content is inserted directly into the note. No picker dialog appears.
  Runner advances past the snippet correctly.
result: pass

### 6. Loop-body file-bound snippet in Sidebar Runner
expected: |
  Same canvas as test 5. Open sidebar runner, reach loop picker.
  Body branch button shows the same document emoji caption as inline mode.
  Clicking inserts file content directly, no picker dialog.
  Step-back from post-insert restores loop picker; another step-back restores pre-loop state.
result: pass

### 7. Directory-bound snippet still shows picker
expected: |
  Use a canvas with a Loop whose body branch ends at a directory-bound Snippet node.
  Open inline runner, reach loop picker. Body branch button shows a folder emoji (U+1F4C1) caption.
  Clicking opens the SnippetTreePicker (directory picker). Picking a snippet inserts it.
result: pass

### 8. Regression guard - Inline Runner note editing and position
expected: |
  With Inline Runner open, you can type in the underlying note (modal does not steal focus/block editing).
  Drag the modal header to a new position, switch tabs and back — position restores.
  Reach a Question node, click an Answer — answer text appends to the note.
  Step-back removes the answer text from the note.
result: pass
notes: "User clarified: in Inline Runner, step-back returns state but does NOT remove text from note — this is expected per discuss-phase decision. Test considered pass."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

All gaps resolved via gap-closure commit 92a1269 (applyPosition no longer clears style.width during drag).
- Gap 1 (drag resets size) — FIXED
- Gap 2 (tab switch resets size) — FIXED (downstream effect of Gap 1)
