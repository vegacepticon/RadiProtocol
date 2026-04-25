---
title: "Hierarchical snippet/folder picker with search"
date: 2026-04-18
priority: high
---

See `.planning/notes/snippet-node-binding-and-picker.md` for full design.

Replace the current flat "pick a directory" list in Snippet node settings with a hierarchical navigator:

- Shows top-level folders (and snippet files) on entry.
- Click a folder to descend; breadcrumb at top for going back up.
- Search field at the top filters across the entire tree (not just the current level) by name.
- Single unified picker supports selecting either a folder or a specific snippet file — caller decides which types are valid for its context.
- Use this picker in Node Editor for Snippet node's target field (covers both the directory-binding and specific-snippet-binding flows from the sibling todo).

Pure UI change — stored path shape is unchanged, existing protocols unaffected.
