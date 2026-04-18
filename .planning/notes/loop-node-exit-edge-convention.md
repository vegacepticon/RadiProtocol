---
title: "Loop-node exit edge convention"
date: 2026-04-18
context: design
---

## Rule

For a loop-node, outgoing edges are interpreted by their label state:

- **Exactly one labeled outgoing edge** = the loop exit. Its label becomes the text of the exit button shown in Protocol Runner.
- **All unlabeled outgoing edges** = loop body branches. User can pick any of them during iteration; when that branch reaches its end, control returns to the loop-node (current behavior, unchanged).

## Validation

Saving / running a canvas with a loop-node must fail if:

- **Zero labeled outgoing edges** → error: "Loop node has no exit — label exactly one outgoing edge as the exit."
- **Two or more labeled outgoing edges** → error: "Loop node must have exactly one exit — only one outgoing edge may have a label."

## Why

Previous behavior: the exit button in Runner always read "выход" (hardcoded), regardless of semantics. This made it impossible to express custom exit wording per protocol, and required separate UI to mark an edge as "the exit". Reusing the label as both the selector ("this is the exit") and the display text (button caption) eliminates a concept.

## How to apply

- Node Editor / canvas validation: run this check on save and before starting a Runner session.
- Runner: for a loop-node, render the exit button using the label of the single labeled outgoing edge (no longer fall back to a hardcoded string).
- Error messages should point the user to the offending loop-node.
