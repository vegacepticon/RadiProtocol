---
status: complete
phase: 30-snippet-node-runner-integration
source:
  - 30-01-SUMMARY.md
  - 30-02-SUMMARY.md
  - 30-03-SUMMARY.md
started: 2026-04-14T00:00:00Z
updated: 2026-04-15T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Runner halts at snippet node and shows picker
expected: |
  Canvas with snippet node → start runner → reaches snippet node →
  picker appears with breadcrumb, folders (📁 prefix) first, then
  snippets, sorted alphabetically. Runner does not auto-advance.
result: pass
note: |
  Initially tested on test.canvas where snippet node was wired as a
  sibling of an answer (dead branch), so picker never appeared.
  After rewiring (answer → snippet → next), picker appears correctly.
  See Gaps: user requested mixed answer+snippet branching as a feature.

### 2. Drill-down into subfolder updates breadcrumb
expected: |
  Click a folder row in the picker. Breadcrumb updates to include
  the folder name, an "Up" button appears, and the list shows the
  folder's contents (sub-folders first, then snippets). Clicking
  "Up" returns to the parent folder.
result: pass

### 3. Empty folder shows empty-state message
expected: |
  Navigate into a folder that contains no .json snippets and no
  sub-folders. The picker shows a message "No snippets found in
  {path}" instead of an empty list.
result: pass

### 4. Selecting a zero-placeholder snippet advances runner
expected: |
  Pick a snippet whose template has no {{placeholders}}. The
  SnippetFillInModal does NOT open. The template text is inserted
  into the runner output verbatim and the runner advances to the
  next node (or completes if the snippet node was terminal).
result: pass

### 5. Selecting a snippet with placeholders opens fill-in modal
expected: |
  Pick a snippet whose template has one or more {{placeholders}}.
  The SnippetFillInModal opens, pre-focused on the first placeholder
  input. Submitting the modal inserts the rendered template into the
  runner output and advances to the next node. Cancelling the modal
  inserts an empty string and advances.
result: pass

### 6. Step-back from picker reverts to previous node
expected: |
  While the picker is open at a snippet node, click the step-back
  button. The runner reverts to the previous node (e.g., the
  question that preceded the snippet node), the picker closes, and
  the previous node's UI is shown.
result: pass

### 7. Session resume restores picker state
expected: |
  Start a protocol, reach a snippet node so the picker appears,
  then close the runner view (or reload Obsidian). Reopen the
  session. The runner resumes at the same snippet node with the
  picker visible (drill-down path is view-local and may reset to
  the node's base subfolderPath — that is acceptable).
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

- feature-request: "Mixed answer+snippet branching at question nodes"
  status: backlog-candidate
  reason: |
    User wants a question node to support outgoing edges to BOTH answers
    and snippet nodes simultaneously, shown side-by-side in the runner as
    selectable options. Picking a snippet variant inserts only that
    snippet's text into the accumulator (same as picking an answer).
    Current behavior: question branches go to answers only; snippet
    nodes must be chained after an answer.
  severity: enhancement
  test: 1
  action: capture via /gsd-add-backlog after UAT completes
