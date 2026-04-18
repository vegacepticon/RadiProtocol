---
title: "Bi-directional sync of Answer displayLabel and Question→Answer edge label"
date: 2026-04-18
priority: high
---

Implement the convention described in `.planning/notes/answer-label-edge-sync.md`:

- Treat `Answer.displayLabel` as the single source of truth for the label shown on every incoming Question→Answer edge.
- Editing `Answer.displayLabel` in Node Editor updates the label on all incoming edges.
- Editing an edge label on canvas updates `Answer.displayLabel` and re-syncs to all other incoming edges on that Answer.
- Remove any storage of per-edge label override for these edges.

**Known constraint (document in code comment):** if an Answer has multiple incoming edges from different Question nodes, they all share the same label. User accepts this trade-off; if a per-edge override is ever needed, create separate Answer nodes.
