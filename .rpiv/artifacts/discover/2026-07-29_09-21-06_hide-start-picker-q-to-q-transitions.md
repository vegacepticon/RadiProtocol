---
date: 2026-07-29T09:21:06+0300
author: Roman Shulgha
commit: cb3ac55
branch: main
repository: RadiProtocol
topic: "Hide Start from node picker; direct Question-to-Question transitions"
tags: [intent, frd, protocol-editor-view, runner, render, graph]
status: ready
last_updated: 2026-07-29T09:21:06+0300
last_updated_by: Roman Shulgha
---

# FRD: Hide Start from node picker; direct Question-to-Question transitions

## Summary
Two editor/runner ergonomics changes for the protocol author. First, hide the `start` node type from both node-type pickers (drag-to-empty-area and double-click empty area) whenever a Start node already exists on the canvas, and show it only when none exists — the Start node is created by default, so extra instances are never needed. Second, allow direct Question-to-Question edges: the Runner renders a button for each direct Question neighbor, advancing to that Question without inserting any text, using the existing edge `label` field (falling back to the target's `questionText`) as the button caption. Both changes are additive at the view/runner seam; the graph model, parser, and validator are unchanged.

## Problem & Intent
From the developer's framing: the primary person feeling the friction is the **protocol author** — reducing tedium and friction in the visual editor is the core goal. Concretely, two frustrations today:

1. The "Select node type" modal offers a Start node even though protocols are seeded with exactly one Start node by default (`protocol-document.ts:140-152`) and only one is ever required — the option is noise that can produce invalid graphs with multiple Start nodes.
2. Building branching protocols today requires intermediate **empty Answer nodes** whenever an answer option should not insert any text (a pure transition). The author has to create, position, and wire an empty Answer node just to get a clickable button that leads to the next Question. This is tedious for protocols with many branching paths. The author wants to connect Question nodes directly and specify the button label shown in the Runner for such transitions.

## Goals
- Reduce noise in the node-type pickers by never offering a redundant Start node when one already exists.
- Let the protocol author connect a Question directly to another Question and get a clickable Runner button for that transition without inserting text.
- Let the author control the Runner button caption for a direct Question-to-Question transition via the existing edge `label` field.
- Keep the change surface minimal and additive — no graph-model, parser, or validator schema change.

## Non-Goals
- Deprecating or migrating existing empty-Answer-node protocols. Empty Answer nodes continue to work identically (empty `answerText` still inserts nothing and passes through).
- Adding new validation rules for direct Question-to-Question edges (no warning or error when `edge.label` is absent; the Runner falls back to the target `questionText`).
- Changing the looped-Question behavior (looped Questions already render direct Question targets and already use `edge.label` for loop-exit captions).
- New i18n strings: button captions come from user-authored `edge.label`/`questionText` (never wrapped in `t()`); the Start picker filtering reuses existing picker strings. No new visible UI strings are required.

## Functional Requirements
1. The system SHALL hide the `start` kind from the connected node-type picker (`openNodeKindPickerAndConnectAtWorldPoint`, `protocol-editor-view.ts:782-881`) when the current graph already contains a node with `kind: 'start'`.
2. The system SHALL hide the `start` kind from the standalone node-type picker (`openNodeKindPickerAtWorldPoint`, `protocol-editor-view.ts:732-769`) when the current graph already contains a node with `kind: 'start'`.
3. The system SHALL include the `start` kind in both pickers when the current graph contains no node with `kind: 'start'` (e.g., the user deleted it).
4. The ordinary-question renderer (`render-question.ts:45-65`) SHALL render a button for every outgoing neighbor whose target node has `kind: 'question'`, in addition to existing `answer` and `snippet` buttons.
5. The Runner SHALL advance from an ordinary Question to a directly-connected Question target without appending any text to the accumulated output (no physical note write occurs because the accumulator does not grow).
6. The Runner SHALL expose a new edge-based selection method (e.g. `chooseTransition(edgeId)`) that accepts an outgoing edge ID of the current ordinary Question, follows `edge.toNodeId`, and halts at the target node — mirroring the existing `chooseLoopBranch(edgeId)` contract (`protocol-runner.ts:213-263`) minus the loop bookkeeping.
7. The Runner button caption for a direct Question-to-Question transition SHALL be `edge.label` when present, otherwise the target Question's `questionText` (falling back to the target node ID per `node-label.ts:18-23`).
8. The author SHALL set the button label for a direct Question-to-Question transition by editing the existing edge `label` field in the editor's edge properties modal (`protocol-editor-view.ts:2035-2043`); no new editor UI is added.

## Non-Functional Requirements
- **Performance**: No new constraint — the Start-existence check is a linear scan of the current graph's nodes (bounded by protocol size); the renderer already iterates neighbors once and gains one more kind branch.
- **Security**: N/A — plugin-local only, no backend/auth/cloud.
- **UX / Accessibility**: Direct Question-to-Question transitions render as standard buttons with the same keyboard/click semantics as existing answer buttons; mixed Answer + Question neighbors all appear as buttons.
- **Reliability**: Selecting a transition edge with no valid target (edge missing or `fromNodeId` not the current node) SHALL transition the Runner to its existing error state, consistent with `chooseLoopBranch` and `chooseAnswer` error handling.

## Constraints & Assumptions
- The graph model, parser, and validator already permit direct Question-to-Question edges (`graph-model.ts:119-130`, `protocol-document-parser.ts:117-143`, `graph-validator.ts:81-111`); the work is confined to `views/` (editor pickers) and `runner/` + `runner/render/` (renderer + selection method). Lower layers are not modified.
- `RPEdge.label` already exists, is parsed, and is retained (`protocol-document-parser.ts:117-135`); only the ordinary renderer currently ignores it.
- The existing editor edge-label editing UI (`protocol-editor-view.ts:2035-2043`) is reused for authoring the button caption; no new modal/field is added.
- New protocols are seeded with a Start node (`protocol-document.ts:140-152`), so in the common case the Start option is hidden in both pickers from creation onward.
- Assumption to verify in research: the Start-existence check can read the editor's current in-memory graph the same way `graph-validator.ts:46-58` counts Start nodes, without re-parsing the document.

## Acceptance Criteria
- [ ] Open a protocol that contains a Start node; drag a connection from a node to empty canvas — the resulting "Select node type" picker does NOT list Start.
- [ ] Open a protocol that contains a Start node; double-click empty canvas — the resulting node-type picker does NOT list Start.
- [ ] Delete the only Start node; double-click empty canvas — the picker lists Start again; selecting it creates a Start node.
- [ ] In a protocol with a Question node connected directly to another Question node (no intermediate Answer), running the protocol and reaching the first Question shows a button for the direct Question transition.
- [ ] Selecting that button advances the Runner to the target Question and appends NO text to the target note (the note content is unchanged by that selection).
- [ ] Setting the connecting edge's `label` field in the edge properties modal changes the Runner button caption to that label; clearing `label` makes the caption fall back to the target Question's `questionText`.
- [ ] A Question with both an Answer neighbor and a direct Question neighbor shows both as separate buttons; each behaves correctly (Answer inserts its text, Question transition inserts none).
- [ ] An existing protocol that uses empty Answer nodes (empty `answerText`) still runs identically: selecting such an Answer inserts no text and passes through.
- [ ] `npm test` exits 0 (new/updated render-question and protocol-runner tests pass; existing Start-count and traversal tests still pass).
- [ ] `npm run lint` exits 0.

## Recommended Approach
Filter the per-invocation node-kind list in both `protocol-editor-view.ts` pickers by scanning the current graph for a `kind: 'start'` node (hide `start` when one exists). In `runner/render/render-question.ts`, add a third neighbor branch for `kind: 'question'` rendering a button captioned `edge.label ?? nodeLabel(target)`; wire it through a new `onChooseTransition(edge)` render callback to a new edge-based `chooseTransition(edgeId)` method on `ProtocolRunner` (parallel to `chooseLoopBranch`, minus loop bookkeeping) that advances to `edge.toNodeId` without appending text. No graph/parser/validator changes.

## Decisions

### Filter both node-type pickers by Start existence
**Question**: Both node-type pickers (drag-to-empty at `protocol-editor-view.ts:782-881` and double-click empty area at `:732-769`) list all `EDITABLE_NODE_KINDS` including `start` (`:248-255`), with no Start-existence check in the editor today (only `graph-validator.ts:46-58` counts Start nodes). Keep this for the feature, or change it?
**Recommended**: Filter `EDITABLE_NODE_KINDS` per the current graph — hide `start` from BOTH pickers when a Start node already exists; show it in BOTH when none exists.
**Chosen**: Filter both.
**Rationale**: `evidence: src/views/protocol-editor-view.ts:248-255 + :760 + :810` — both pickers enumerate the same constant; uniform filtering matches the request and keeps both entry points consistent. Confirmed in Step 4.

### Build Question-to-Question at the renderer + runner seam
**Question**: The graph model, parser, and validator already permit direct Question-to-Question edges; the runner core already halts at a Question target without inserting text. The real gaps are the ordinary renderer filtering out Question neighbors (`render-question.ts:45-54`) and `chooseAnswer()` rejecting non-Answer IDs (`protocol-runner.ts:91-99`). Build the feature at the renderer+runner seam, or change the model?
**Recommended**: Renderer + runner only — leave graph/parser/validator untouched.
**Chosen**: Renderer + runner only.
**Rationale**: `evidence: src/graph/graph-model.ts:119-130 + src/protocol/protocol-document-parser.ts:117-143 + src/graph/graph-validator.ts:81-111` — the lower layers already permit the edge; the only missing pieces are the UI filter and the selection method. Confirmed in Step 4.

### Button caption source for direct Q-to-Q transitions
**Question**: `RPEdge.label` already exists, is parsed and retained, but is unused by the ordinary renderer (only loop-exit captions consume it, `render-loop-picker.ts:44-56`). Use `edge.label` as the caption source, or add a new dedicated edge field?
**Recommended**: `edge.label` + fallback to target `questionText`.
**Chosen**: `edge.label` + fallback to target `questionText`.
**Rationale**: `evidence: src/graph/graph-model.ts:119-130 + src/protocol/protocol-document-parser.ts:117-135` — the field exists and is round-tripped; reusing it avoids a schema change and the editor already has an edge-label edit UI (`protocol-editor-view.ts:2035-2043`). Confirmed in Step 4.

### Runner selection API for direct Q-to-Q transitions
**Question**: Shape — how should the Runner expose selecting a direct Question-to-Question transition? Today ordinary questions use node-based `chooseAnswer(answerId)` (asserts `kind==='answer'`, inserts `answerText`), while looped questions use edge-based `chooseLoopBranch(edgeId)`.
**Recommended**: Add a new edge-based method (e.g. `chooseTransition(edgeId)`) parallel to `chooseLoopBranch`, plus a second render callback `onChooseTransition(edge)`.
**Chosen**: New edge-based method.
**Rationale**: Edge-based selection is required to read `edge.label` cleanly and to mirror the proven `chooseLoopBranch` contract; keeping `chooseAnswer`'s insert-oriented contract unmuddied is worth the wider but parallel surface.

### Rendering mixed Answer + Question neighbors
**Question**: When an ordinary Question has BOTH Answer-node neighbors AND direct Question-node neighbors, how should the Runner render the buttons?
**Recommended**: Render every outgoing choice as a button (Answers with `displayLabel`/`answerText`, then Questions with `edge.label`/target `questionText`).
**Chosen**: Show all as buttons.
**Rationale**: Maximizes branching flexibility; matches the existing renderer's per-neighbor iteration; a Question can mix the two transition kinds freely.

### Backward compatibility of empty Answer nodes
**Question**: Existing protocols use empty Answer nodes as the "transition without inserting text" mechanism (`protocol-runner.ts:663-666` skips insert when `answerText` is empty). Keep those working unchanged, or deprecate empty Answer nodes?
**Recommended**: Keep empty Answers working; the new Q-to-Q path is purely additive with no migration or deprecation warning.
**Chosen**: Keep empty Answers working.
**Rationale**: Additive change preserves stability of authored protocols; two equivalent mechanisms coexist without migration churn.

### No new validation rule for direct Q-to-Q edges
**Question**: The current validator (`graph-validator.ts:81-128`) has no Q-to-Q-specific rule. Should it add any rule about the edge label (button caption falls back to `questionText` when `edge.label` is absent)?
**Recommended**: No new rule — leave the validator unchanged; a label-less Q-to-Q edge is valid.
**Chosen**: No new rule.
**Rationale**: Fallback to `questionText` is acceptable; adding a warning/error would expand scope into the validator layer (against the renderer+runner-only decision) and risk blocking existing authored protocols.

## Open Questions
None — all branches resolved.

## Suggested Follow-ups
- The ordinary renderer still ignores `edge.label` for ordinary Answer/Snippet neighbors; only loop-exit and the new Q-to-Q path consume it. A future enhancement could let `edge.label` override the Answer button caption for ordinary questions too, unifying caption semantics across all ordinary-question buttons. (`render-question.ts:45-65`, `render-loop-picker.ts:44-56`)
- The Start-existence filter is editor-local and uses the in-memory graph; the canonical Start-count check lives in `graph-validator.ts:46-58`. A shared helper could centralize "does this graph have a Start node?" to avoid two independent scans. (`graph-validator.ts:46-58`, `protocol-editor-view.ts:732-881`)

## References
- Free-text input (this session's `/skill:discover` invocation)
- `src/views/protocol-editor-view.ts` — node-type pickers and edge-label editing
- `src/runner/protocol-runner.ts` — traversal, `chooseAnswer`, `chooseLoopBranch`
- `src/runner/render/render-question.ts` — ordinary-question button rendering
- `src/graph/graph-model.ts`, `src/graph/graph-validator.ts`, `src/graph/node-label.ts`
- `src/protocol/protocol-document-parser.ts`, `src/protocol/protocol-document.ts`
- `.rpiv/guidance/src/views/architecture.md`, `.rpiv/guidance/src/graph/architecture.md`