---
title: "Allow Snippet node to bind to a specific snippet file"
date: 2026-04-18
priority: high
---

See `.planning/notes/snippet-node-binding-and-picker.md` for full design.

- Extend Snippet node config so it can reference either a directory (current) or a specific snippet file (new).
- In Protocol Runner:
  - If this Snippet node is the sole option at the current step → auto-insert the snippet text without a button click.
  - If it sits next to sibling options → render as a single clickable choice button.
  - Placeholder modal for `.json` snippets with placeholders must still run before insertion in both paths.
- Preserve backward compatibility: existing directory-bound Snippet nodes keep working unchanged.
