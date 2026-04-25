---
title: "BUG: Textarea edits lost on any loop-node transition after Snippet-node insert"
date: 2026-04-18
priority: high
---

## Reproduction

1. Snippet-node fires and inserts text into Protocol Runner's textarea.
2. User edits the inserted text manually in the textarea.
3. Next node in the flow is a loop-node.
4. User triggers **any** transition from the loop-node — "выход" or entering any loop body branch.
5. Protocol advances correctly, **but the user's manual edits to the textarea are lost** (textarea reverts to the pre-edit state / loses the edited content).

User confirmed: the bug reproduces on every transition out of the loop-node, not only on exit.

## Expected behavior

Manual edits to the textarea must persist across node transitions. Advancing through a loop-node (entering body or exiting) must not discard textarea state.

## Investigation hint

Because the loss happens on any transition (not only exit), the cause is likely in the general loop-node transition handler or a shared snapshot/rehydration step that runs whenever the loop-node activates — not in the exit-specific code path. Start there rather than in the exit handler.
