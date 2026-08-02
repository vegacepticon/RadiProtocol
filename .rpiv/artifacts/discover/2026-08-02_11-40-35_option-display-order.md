---
date: 2026-08-02T11:40:35+0300
author: Roman Shulgha
commit: 8e3ab6b
branch: main
repository: RadiProtocol
topic: "Author-configurable selection-option display order in the Runner"
tags: [intent, frd, runner, protocol, views]
status: ready
last_updated: 2026-08-02T11:40:35+0300
last_updated_by: Roman Shulgha
---

# FRD: Author-configurable selection-option display order in the Runner

## Summary
Protocol authors can control the display order of a question's selection options in the Runner. In the Question node edit modal, the labels of the node's outgoing connections appear as draggable chips; reordering them persists an optional per-question `optionOrder` (edge-id list) in the `.rp.json`, and the Runner renders options in that global order. Questions without an explicit order keep today's edges-array rendering unchanged.

## Problem & Intent
The developer's framing: the problem spans **both sides** — authors need tooling to express a meaningful option order, and radiologists (the end users running protocols) benefit from options appearing in a clinically sensible order (severity, chronology, anatomy). Today the display order is an accident of the `.rp.json` `edges` array order, grouped answers → question-transitions → snippets, with no authoring surface to change it. The developer's proposed shape: *"in the Question node settings, the labels of outgoing connections would be displayed as chips that can be dragged and dropped, thereby determining the display order."*

## Goals
- Authors can set an explicit display order for a question's options by dragging chips in the Question node edit modal, without editing JSON.
- The Runner renders options top-to-bottom in the authored order across all labeled outgoing-connection kinds (answers, question→question transitions, snippet branches, loop exits).
- Existing protocols without order metadata render byte-identical to today — backward compatible, no schema-version bump.

## Non-Goals
- No reordering of the `.rp.json` `edges` array or the canvas layout — order is metadata only, applied at render time.
- No global ordering rules (alphabetical, by kind, by recency) — explicit per-question order only, plus the existing fallback.
- No new dependencies — no sortable library; the HTML5 DnD chip pattern already in the codebase is reused.
- No changes to the loop picker's visual design — it only respects the authored order for its buttons.
- No runner-state / FSM changes — this is a pure render-order and metadata feature.

## Functional Requirements
1. The question-node record SHALL support an optional `optionOrder: string[]` field — outgoing edge ids in display order. Absence of the field means "no explicit order" (fallback).
2. The pure parser SHALL extract `optionOrder` into the runtime graph model without throwing (never-throw `ParseResult` convention); entries referencing unknown/deleted edges are preserved in the document and ignored downstream.
3. The Question node edit modal SHALL display one chip per currently-outgoing connection of the question, ordered by `optionOrder` when present, else by edges-array order.
4. Chip labels SHALL derive from the existing edge-label logic (`deriveProtocolEditorEdgeLabel`, `nodeLabel`, `snippetBranchLabel`) covering all four connection kinds.
5. Chips SHALL be draggable to reorder, reusing the HTML5 DnD chip pattern from `snippet-chip-editor.ts` (drag handle, `dragstart`/`dragover`/`drop`, splice-based reorder); the reorder updates the draft `optionOrder` and persists on save via `protocolDocumentStore.update`.
6. A new outgoing edge added to an ordered question SHALL append to the end of the chip list and of the persisted `optionOrder` automatically.
7. The Runner SHALL render a question's options in the authored global order when `optionOrder` is present — answers, question→question transitions, and snippet branches in `render-question.ts`, loop-picker buttons in `render-loop-picker.ts` — interleaving kinds as authored. When absent, today's grouped edges-array rendering is unchanged.
8. The Runner's Skip auto-advance SHALL select the first answer option in authored order when `optionOrder` is present; adjacency-order behavior remains the fallback.
9. Stale `optionOrder` entries SHALL be silently ignored at render and never throw; the editor chip list shows only currently-outgoing edges.
10. The on-disk document doc comment stating "Order is not semantically significant" SHALL be updated to reflect that edges of a question node may carry display-order semantics.

## Non-Functional Requirements
- **Performance**: No specific constraint — option lists are small; ordering is a linear pass at render time.
- **Security**: No new surface — plugin-local data; `optionOrder` is inert data, not executable or path-like.
- **UX / Accessibility**: Chips follow the `snippet-chip-editor` pattern — visible drag handle, `aria-label` on drag affordance, `drag-over` feedback; user-authored labels (edge captions) are never wrapped in `t()`.
- **Reliability**: Never-throw parser/validator convention preserved; stale ids tolerated; write path goes through `WriteMutex` via `protocolDocumentStore.update`.

## Constraints & Assumptions
- `PROTOCOL_VERSION` stays 1 — adding an optional field is backward-compatible (per the protocol-layer convention for optional node fields).
- Dependency direction preserved: `graph-model.ts` owns the runtime field; `protocol/` owns the on-disk schema + parser; `views/` owns the chip UI; `runner/render/` owns ordered rendering; lower layers never import `views/` (documented exception unchanged).
- Assumption: chip-label derivation covers all four kinds (answers, transitions, snippets, loop exits) with existing helpers — research should verify against `deriveProtocolEditorEdgeLabel` (`protocol-editor-view.ts:318-333`).
- Assumption: the loop picker can accept an ordered button list without structural changes.

## Acceptance Criteria
- [ ] Running `npm test` exits 0 with new suites covering: parser round-trips `optionOrder`; `render-question.ts` renders in authored global order (incl. interleaved kinds); Skip follows authored order; editor modal persists a drag-reorder through `protocolDocumentStore.update`.
- [ ] Opening an existing `.rp.json` without `optionOrder` and running it produces the same option order and grouping as before the feature (fallback intact).
- [ ] In the Question node edit modal, dragging a chip to a new position and saving rewrites `optionOrder` in the `.rp.json` such that reopening the modal shows the same order.
- [ ] With `optionOrder` present, the Runner displays options top-to-bottom exactly as authored — e.g., a snippet branch between two answers renders in that position.
- [ ] A looped question with ordered loop-exit labels shows its loop-picker buttons in the authored order.
- [ ] Deleting an edge referenced by `optionOrder` and running the protocol does not error; the missing entry is ignored.
- [ ] Adding a new answer branch to an ordered question and running it shows the new option at the end of the list.

## Recommended Approach
Add an optional per-question `optionOrder: string[]` (edge-id list) to the question node — runtime type in `graph/graph-model.ts`, on-disk field on `ProtocolNodeRecord.fields`, extraction in `protocol-document-parser.ts`; editor UI as a draggable chip list in the Question node edit modal reusing the `snippet-chip-editor` DnD pattern; runner render as a single ordered pass in `render-question.ts` (+ `render-loop-picker.ts`) with per-kind button styling, falling back to today's grouped edges-array rendering when `optionOrder` is absent; `skip()` uses the authored first-answer order. Pure-layer changes are testable without Obsidian mocks.

## Decisions

### Feature intent — who the feature serves
**Question**: "What problem is this solving, and who experiences the pain of the current fixed order today?" (`intent` question)
**Recommended**: n/a — `intent` question (open framing)
**Chosen**: "Both sides" — authors need the tooling to express order, radiologists benefit from the sensible result at run time
**Rationale**: The problem spans authoring and execution; the authoring surface (chips in Question node settings) is the means to the clinical-order end.

### Default order fallback
**Question**: "From the probe I inferred — option display order today is the order of edges in the .rp.json `edges` array, grouped answers → question-transitions → snippets, with no sorting anywhere. Keep this as the fallback for questions with no explicit order set?" (Pre-resolved from codebase evidence — confirmed)
**Recommended**: Keep as fallback
**Chosen**: Keep as fallback
**Rationale**: `evidence: src/runner/render/render-question.ts:47-66,72-75,84-96 + src/protocol/protocol-document-parser.ts:137-139 + confirmed` — backward compatible; existing protocols render exactly as today until an author sets an order.

### Schema mechanism
**Question**: "From the probe I inferred — no order field exists today … Adding order therefore means a schema extension. Proceed with an optional metadata field?" (Pre-resolved from codebase evidence — confirmed)
**Recommended**: Optional metadata field
**Chosen**: Optional metadata field
**Rationale**: `evidence: src/protocol/protocol-document.ts:103-129,36-38 + confirmed` — existing files without it parse and run unchanged; `PROTOCOL_VERSION` stays 1.

### DnD widget
**Question**: "From the probe I inferred — a reusable HTML5 drag-and-drop chip-reorder widget already exists … and package.json has no sortable library. Reuse this pattern?" (Pre-resolved from codebase evidence — confirmed)
**Recommended**: Reuse chip pattern
**Chosen**: Reuse chip pattern
**Rationale**: `evidence: src/views/snippet-chip-editor.ts:287-338 + confirmed` — no new dependency; splice-based reorder maps directly to the per-question list storage.

### Editor home
**Question**: "From the probe I inferred — Question node settings are edited in the node edit modal, whose question branch currently renders only the question text. Put the draggable chip list there as you envisioned?" (Pre-resolved from codebase evidence — confirmed)
**Recommended**: Node edit modal
**Chosen**: Node edit modal
**Rationale**: `evidence: src/views/protocol-editor-view.ts:2372-2374 + confirmed` — matches the developer's stated vision of "Question node settings"; outgoing connections are not shown there today.

### Kinds covered
**Question**: "Which outgoing-connection kinds should the author be able to order?" (`scope`)
**Recommended**: All labeled connections
**Chosen**: All labeled connections
**Rationale**: Matches the "labels of outgoing connections" vision; loop picker (`render-loop-picker.ts:43-44`) also respects the authored order.

### Grouping semantics
**Question**: "When an explicit order is set, should it be a single global order across the kind groups, or applied within each kind group only?" (`scope`)
**Recommended**: Single global order
**Chosen**: Single global order
**Rationale**: One chip list is one order; interleaving kinds is allowed; no order set → today's grouped rendering remains.

### Storage shape
**Question**: "Where should the order metadata live in the .rp.json schema?" (`shape` — per-edge number vs per-question edge-id list)
**Recommended**: Per-question edge-id list
**Chosen**: Per-question edge-id list (`optionOrder: string[]` in question node fields)
**Rationale**: Atomic authoring (one array, drag = splice — the exact model of `snippet-chip-editor.ts:333-334`); presence = explicit order gives clean fallback semantics; stale ids ignorable at render.

### Skip button behavior
**Question**: "When the author reorders options, should the Runner's Skip button (auto-advance) follow the authored order, or keep today's adjacency-order behavior?" (`detail`)
**Recommended**: Follow authored order
**Chosen**: Follow authored order
**Rationale**: Display and auto-advance must not diverge; adjacency-order behavior remains the fallback (`protocol-runner.ts:146-151`).

### New edges added later
**Question**: "If a new outgoing edge is added to a question that already has an explicit order, where does it appear?" (`detail`)
**Recommended**: Append at end
**Chosen**: Append at end
**Rationale**: Least-surprise default; the author can drag it into place — no blocking validation.

### Stale optionOrder entries
**Question**: "How should stale optionOrder entries (edge id no longer exists) be handled?" (`detail`)
**Recommended**: Silently ignore
**Chosen**: Silently ignore
**Rationale**: Consistent with the never-throw validator convention (`src/graph/graph-validator.ts`); the editor chip list shows only currently-outgoing edges.

## Open Questions
None — no items were deferred during the interview.

## Suggested Follow-ups
- Remaining adjacency-order-dependent auto-advance paths beyond `skip()` — `firstNeighbour()` returns `neighbors[0]` (`src/runner/protocol-runner.ts:923-927`); audit whether it should follow authored order for consistency.
- The document header comment "Order is not semantically significant" (`src/protocol/protocol-document.ts:36-38`) becomes misleading once `optionOrder` exists — surfaced here so `research`/`implement` remember to update it (noted in FR-10).

## References
- Skill input: "I would like to add the ability to configure the display order of selection options in the Runner … chips that can be dragged and dropped" (free-text feature description)
- Probe evidence: `src/runner/render/render-question.ts`, `src/runner/render/render-loop-picker.ts`, `src/runner/protocol-runner.ts`, `src/protocol/protocol-document.ts`, `src/protocol/protocol-document-parser.ts`, `src/views/protocol-editor-view.ts`, `src/views/snippet-chip-editor.ts`
