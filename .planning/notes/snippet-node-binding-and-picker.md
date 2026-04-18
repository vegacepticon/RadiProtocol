---
title: "Snippet node: binding model and picker UX"
date: 2026-04-18
context: design
---

## Binding model

Snippet node can be bound to either:

- **A directory** — Runner presents all snippets from that directory as choices (current behavior).
- **A specific snippet file** — new; Runner treats this node as a single choice resolving to that one snippet.

## Runner behavior for specific-snippet binding

- If the Snippet node is the sole option at the current step → **auto-insert** the snippet text without requiring a button click.
- If the Snippet node sits among sibling options (other Answer nodes, or another directory-bound Snippet node) → render as a single clickable button; user must click it to pick.
- **Placeholder modal always runs before insertion** for `.json` snippets with placeholders, regardless of auto-insert vs. click path (same modal as today's flow).

## Picker UX

Today: choosing a directory for a Snippet node shows one huge flat list containing every folder (parents and children mixed).

New: a **hierarchical navigator**, one unified widget used for both cases:

- Entry shows top-level folders (and, optionally, top-level snippet files).
- Click a folder → descend into it; breadcrumb at top for going back up.
- **Search field at the top** of the navigator — typing filters across the whole tree (not just current level), so user can jump directly to a known folder or snippet by name.
- Selection mode is determined by the Snippet node's current binding intent:
  - Selecting a **folder** → node binds to that directory.
  - Selecting a **snippet file** → node binds to that specific snippet.
  - Both are possible in the same picker; user chooses whichever.

## Safety / compatibility

This is a pure UI-layer change. The stored value on the node (directory path / snippet path) keeps the same shape. Existing saved protocols do not break.

## How to apply

- Reuse the same navigator component wherever we need to pick a snippet or folder.
- Wire the Node Editor's Snippet node settings to use this picker for its "target" field.
- In Runner, branch on `node.target` type (directory vs file) to decide between "list all from dir" and "single specific snippet" flows.
