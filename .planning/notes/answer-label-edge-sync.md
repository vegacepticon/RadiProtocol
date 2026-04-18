---
title: "Answer displayLabel ↔ incoming edge label sync"
date: 2026-04-18
context: design
---

## Rule

`Answer.displayLabel` and the label of every incoming edge (Question → Answer) are bound to a single value. Editing either side updates the other.

## Behavior

- Edit `Answer.displayLabel` in Node Editor → every incoming edge's label updates to match.
- Edit the label of an incoming edge → `Answer.displayLabel` updates, and all **other** incoming edges re-sync to the new value.
- Canvas: edge labels on Question → Answer connections are rendered from this single source of truth.

## Multi-incoming edge case

An Answer node can technically have multiple incoming edges (from different Question nodes). Under this rule, all incoming edges to the same Answer always share the same label. If the user needs different wording per branch, they must create separate Answer nodes — we don't support per-edge override.

This trade-off is acceptable because the user does not currently use multi-incoming Answer topologies. Flag this constraint in the todo so it's visible to future maintainers if that workflow appears.

## Why

Users work visually on the canvas and textually in Node Editor. Keeping two separate fields for "what this edge is called" and "what this answer is called" creates a diff between the two views and extra bookkeeping. Unifying them means whichever view the user edits, the other stays consistent.

## How to apply

- Store the label once (on the Answer node's `displayLabel`). Edge label on Question → Answer edges is a derived view of that value.
- Node Editor edit handlers for both fields write to the same underlying property and trigger canvas re-render.
- Initial creation: if the user labels a new edge in canvas, that label becomes `Answer.displayLabel`.
