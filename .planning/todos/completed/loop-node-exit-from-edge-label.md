---
title: "Derive loop-node exit from edge label; validate exactly one labeled edge"
date: 2026-04-18
priority: high
---

Implement the convention described in `.planning/notes/loop-node-exit-edge-convention.md`:

- Protocol Runner: for loop-node, render the exit button using the label of the sole labeled outgoing edge (instead of hardcoded "выход" / "exit").
- Validation on canvas save and before Runner start:
  - Zero labeled outgoing edges from a loop-node → error "Loop node has no exit — label exactly one outgoing edge as the exit."
  - Two or more labeled outgoing edges → error "Loop node must have exactly one exit — only one outgoing edge may have a label."
- Error messages should identify which loop-node is invalid.
- Unlabeled outgoing edges remain loop body branches (current iteration behavior unchanged).
