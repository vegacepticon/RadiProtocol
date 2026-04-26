---
status: complete
phase: 66-runner-step-back-reliability-scroll-pinning
source:
  - 66-01-SUMMARY.md
  - 66-02-SUMMARY.md
  - 66-03-SUMMARY.md
  - 66-04-SUMMARY.md
requirements:
  - RUNNER-03
  - RUNNER-04
started: 2026-04-25T17:30:00Z
updated: 2026-04-25T17:43:00Z
---

## Manual-Only Verifications

These scenarios cover the parts of RUNNER-03 (visible Back disable-on-click) and RUNNER-04 (preview textarea scroll pinning) that jsdom cannot faithfully reproduce. Run all in a real Obsidian vault built from the latest `npm run build` output.

## Current Test

[testing complete]

## Tests

### 1. Sidebar — file-bound snippet insert pins preview to bottom (RUNNER-04 SC4, D-09, D-12)
expected: |
  Open a canvas containing a Question node with at least one file-bound Snippet branch (📄). Drive the runner forward through enough answers to fill the preview textarea past one screen height of accumulated text (you should see a vertical scrollbar inside the preview). Click the file-bound Snippet branch button. After the runner re-renders, the preview textarea must be scrolled to the BOTTOM — the most recently inserted snippet content is visible at the bottom edge of the textarea, with no upward jump.
result: pass

### 2a. Sidebar — Back from at-node (post-Answer) pins preview to bottom (RUNNER-04 SC5, D-09)
expected: |
  Continuing from scenario 1 (or starting fresh and accumulating enough text to scroll), drive the runner forward by clicking an Answer branch on a Question. The runner halts at the next at-node. Click Back. After the re-render, the preview textarea must be scrolled to the BOTTOM.
result: pass

### 2b. Sidebar — Back from awaiting-snippet-pick pins preview to bottom (RUNNER-04 SC5, D-09)
expected: |
  Drive the runner to a Question with a directory-bound Snippet branch and click that branch. The runner halts at `awaiting-snippet-pick`. Click Back. After the re-render, the preview textarea must be scrolled to the BOTTOM.
result: pass

### 2c. Sidebar — Back from awaiting-loop-pick pins preview to bottom (RUNNER-04 SC5, D-09)
expected: |
  Drive the runner into a loop body iteration and back to the loop picker (e.g. via `unified-loop-valid.canvas` style fixture: pick body branch → answer → re-enters picker at iter=2). Click Back from the iter=2 picker. After the re-render, the preview textarea must be scrolled to the BOTTOM.
result: pass

### 3. Tab-mode runner — file-bound snippet insert + Back both pin to bottom (RUNNER-04 SC4 + SC5, D-12)
expected: |
  Open the runner in a tab leaf instead of the sidebar (right-click the runner tab header → "Move to new pane" or similar Obsidian gesture, OR use the existing tab-host mechanism). Repeat scenarios 1 and 2a (the most representative Back path). Both must produce the same scroll-to-bottom behaviour as the sidebar mode. The visible preview is the same `<textarea class="rp-preview-textarea">` in both hosts.
result: pass

### 4. Sidebar — Back is single-click guaranteed (RUNNER-03 SC1, D-01 + D-02)
expected: |
  With the runner advanced past at least one user action (so Back is enabled), perform a quick double-click on the Back button. Visually confirm: the Back button visibly transitions to a disabled state on the first click (mouse cursor changes, button greyed out per the browser's standard disabled-button visual). The runner advances backwards by exactly ONE step — not two. Repeat at five different runner states (at-node post-Answer, at-node post-Skip, awaiting-loop-pick, awaiting-snippet-pick, after a chooseLoopBranch). In every state, double-click → exactly one step back.
result: pass

### 5. Sidebar — `Processing...` placeholder is never visible (RUNNER-03 SC2, D-07)
expected: |
  Drive the runner through every reachable state (idle, at-node question, at-node post-Answer transition, awaiting-snippet-pick, awaiting-snippet-fill, awaiting-loop-pick, complete, error if a broken canvas is loaded). At no point during forward advance OR Back should the literal text "Processing..." appear in the question zone. If you see it, capture a screenshot and the canvas filename — that's a regression.
result: pass

### 6. Inline runner — Back is single-click guaranteed (RUNNER-03 SC1, D-01 + D-02)
expected: |
  Open a canvas via the "Run protocol in inline" command. Advance past at least one user action so Back is enabled. Double-click Back. The button visibly disables on the first click; the runner advances backwards by exactly one step. Verify in at-node and awaiting-loop-pick inline states.
result: pass

### 7. Sidebar — repeated Back across loop boundaries does not corrupt accumulated text (RUNNER-03 SC3, D-08)
expected: |
  Open `src/__tests__/fixtures/unified-loop-valid.canvas` (or an equivalent loop-bearing canvas in your test vault). Drive forward: pick the body branch, answer the question inside the body, return to the loop picker (now iter=2), pick the body branch again, answer again, exit via «выход». Now click Back six times in a row (slowly, single-click each time). At each step the preview text and runner state must move back by exactly one step — no jumps, no duplicate text, no missing text. Final state after six Backs: awaiting-loop-pick at the loop node, accumulated text is empty.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet — populated only if a scenario fails]
