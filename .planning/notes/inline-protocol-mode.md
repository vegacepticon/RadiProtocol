---
title: "Inline protocol mode: design decisions from exploration"
date: 2026-04-20
context: design
---

## Summary

A third display mode for the Protocol Runner — in addition to sidebar and tab — that runs the protocol as a floating modal over the currently open note, writing answers directly into that note instead of into an internal textarea.

## Design decisions locked during `/gsd-explore` (2026-04-20)

These four decisions are settled; they should NOT be reopened in discuss-phase. Discuss-phase should build on them and resolve the remaining open questions listed below.

### 1. Output destination: append to end of the note

Every answer selection appends directly to the **end** of the note. Not at cursor position, not at a marker, not via per-node override.

Rationale: removes the entire class of "where does the cursor point now / what if the user moved it / what if they're typing elsewhere" problems. The note behaves like an append-only log for the duration of the protocol.

### 2. Protocol is bound to the source note

The protocol is tied to the note where it was launched. If the user switches to a different note, the modal closes or freezes until they return — the output never silently redirects to another note.

Rationale: prevents the surprising case where a user switches context and subsequent choices land in the wrong file. A single protocol run = a single target note.

### 3. Launch is command-driven only (for now)

Entry point: a new command in the Obsidian command palette — `Run protocol in inline`.

Flow:
1. User opens the note they want to fill.
2. User runs `Run protocol in inline` from the palette.
3. A canvas picker appears, listing available protocol canvases from the `Protocol` folder.
4. User selects a canvas; the modal appears over the active note and starts at the first node.

Sidebar and tab display modes are unchanged. Inline is only available via this command — no per-canvas preference, no global setting, no auto-binding.

### 4. No textarea in inline mode — note IS the buffer

The Runner's internal textarea does not exist in inline mode. The note itself is the buffer. Each selection = immediate append. No staging area, no "commit all at once" step, no edit-before-save.

Rationale: simplest possible UX. User wanting to undo uses Obsidian's native undo on the note.

## Open questions for discuss-phase

These were not settled during `/gsd-explore` and should be probed in discuss-phase:

- **Modal positioning & drag/resize** — fixed corner? Draggable? Position remembered per session / per canvas / not at all?
- **Behavior when the target note's tab is closed** mid-protocol — freeze like note-switch? Close the modal? Prompt?
- **Interaction with snippet fill-in modal (Phase 27) and loop iteration UI** — does the inline modal host them inside itself, or spawn a secondary modal on top?
- **Per-node append formatting** — new line per choice? Configurable separator? Follow the node's existing Runner formatting rules?
- **What happens on loop nodes** — each iteration appends again; is any visual separator added between iterations?
- **Visual indication on the note** — any marker showing "protocol is running against this note"? Or purely in-modal?
- **Cancel / abort semantics** — does closing the modal mid-run leave the partial output in the note (and the user cleans up manually), or is there an "undo everything" escape hatch?

## Out of scope (for the first pass)

- Per-canvas `preferredDisplayMode` attribute.
- Global setting for default display mode.
- Inline mode launched from the canvas selector UI (only via command palette in v1).
- Insertion anywhere other than end-of-note (no cursor-aware insertion, no marker-based insertion).
- Mid-protocol target-note switching.
