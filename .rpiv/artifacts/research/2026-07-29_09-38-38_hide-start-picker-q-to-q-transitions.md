---
date: 2026-07-29T09:38:38+0300
author: Roman Shulgha
commit: cb3ac55
branch: main
repository: RadiProtocol
topic: "Hide Start from node picker; direct Question-to-Question transitions"
tags: [research, codebase, protocol-editor-view, runner, render, graph]
status: ready
last_updated: 2026-07-29T09:38:38+0300
last_updated_by: Roman Shulgha
---

# Research: Hide Start from node picker; direct Question-to-Question transitions

## Research Question
How should the existing editor and runner seams support two additive authoring improvements: hide the Start kind from both node-creation pickers whenever a Start node exists, and let an ordinary Question expose direct edges to other Questions as labeled, no-text transition buttons?

## Summary
The graph model and parser already carry everything needed for direct Question transitions: ordered `RPEdge` records retain stable IDs, endpoints, and optional labels, while traversal already halts when it reaches either an ordinary or looped Question (`src/graph/graph-model.ts:119-140`, `src/protocol/protocol-document-parser.ts:117-143`, `src/runner/protocol-runner.ts:727-763`). No graph schema, parser, validator, new runner state, or new editor field is required.

The missing runtime surfaces are the ordinary Question renderer, its host contract, and a runner choice operation. `renderQuestionAtNode()` currently partitions adjacency targets into Answer and Snippet nodes and ignores Question targets (`src/runner/render/render-question.ts:45-54`). Direct transitions are edge-sensitive because their button caption and callback identity come from `RPEdge`; the existing loop picker establishes the ordered edge-based rendering precedent (`src/runner/render/render-loop-picker.ts:44-64`). A successful strict Q-to-Q selection can preserve the accumulator, push one ordinary undo snapshot, clear redo, traverse to the target, and rerender without calling the physical note-write sink.

Research found two view-layer corrections to the discover premise. First, ordinary Q-to-Q labels are currently discarded on save: `shouldDisplayProtocolEditorEdgeLabel()` returns false outside Answer/Snippet targets and loop exits, and `openEdgeModal()` converts that result into `label: undefined` (`src/views/protocol-editor-view.ts:312-326`, `src/views/protocol-editor-view.ts:2076-2103`). Second, node deletion awaits persistence but discards the returned document before launching an unawaited reload, leaving a short stale-`this.doc` window in which Start filtering can be wrong (`src/views/protocol-editor-view.ts:2466-2476`). The developer expanded scope to cover both corrections.

## Detailed Findings

### Editor node-kind pickers
- `EDITABLE_NODE_KINDS` is a single ordered list: Start, Question, Answer, Snippet (`src/views/protocol-editor-view.ts:255`).
- Both picker methods guard on a non-null current document and construct a fresh modal for each invocation (`src/views/protocol-editor-view.ts:732-760`, `src/views/protocol-editor-view.ts:782-810`). This makes current `this.doc.nodes` the available per-invocation source for Start existence.
- The standalone picker is reached from a filtered empty-canvas double click (`src/views/protocol-editor-view.ts:1706-1719`). The connected picker is reached when a connection drag ends without an input-port target (`src/views/protocol-editor-view.ts:1410-1427`).
- Both picker loops currently enumerate every editable kind with no Start-existence condition (`src/views/protocol-editor-view.ts:760-775`, `src/views/protocol-editor-view.ts:810-825`).
- Existing DOM tests collect `data-node-kind` attributes in document order. Their fixture has one Question and no Start, so the current exact-array assertions already cover the “Start absent” case (`src/__tests__/views/protocol-editor-keyboard.test.ts:324-373`, `src/__tests__/views/protocol-editor-keyboard.test.ts:864-900`).
- The successful node-deletion update removes the node and incident edges but does not assign the returned document to `this.doc`; it launches `loadProtocol()` without awaiting it (`src/views/protocol-editor-view.ts:2466-2476`). The next picker can therefore observe stale node state until reload completes.

### Edge-label authoring and persistence
- `normalizeProtocolEditorEdgeLabel()` trims authored text and only maps an empty result to `undefined` (`src/views/protocol-editor-view.ts:272-275`). Normalization is not the loss point.
- `shouldDisplayProtocolEditorEdgeLabel()` currently accepts labels for Answer/Snippet targets and marked exits from looped Questions, then returns false for all other edges (`src/views/protocol-editor-view.ts:312-326`). Existing helper tests encode that restrictive policy (`src/__tests__/protocol-editor-helpers.test.ts:197-241`).
- The edge modal computes `nextLabel` from the display-policy result. For an ordinary Q-to-Q edge, the false result makes `nextLabel` undefined, and that value is persisted to the edge (`src/views/protocol-editor-view.ts:2076-2103`).
- The lower layers are already label-capable: `RPEdge.label` is optional in the model, and the parser retains any string value on accepted edges (`src/graph/graph-model.ts:119-130`, `src/protocol/protocol-document-parser.ts:117-135`).
- This is an editor display/persistence-policy issue, not a need for a dedicated label field or new UI control.

### Edge-aware ordinary Question rendering
- The current host contract exposes node-based Answer and Snippet callbacks only (`src/runner/render/render-question.ts:12-17`).
- The renderer resolves target IDs from adjacency, silently skips missing nodes, partitions Answer and Snippet targets, renders all Answers first, then renders Snippets (`src/runner/render/render-question.ts:45-86`). Question targets are ignored.
- `ProtocolGraph` stores both ordered concrete edges and target-only adjacency (`src/graph/graph-model.ts:133-140`). The parser populates both in source edge order, but only the edge array retains each edge ID and label (`src/protocol/protocol-document-parser.ts:117-143`).
- Adjacency is insufficient for direct transition identity: duplicate edges to the same target collapse to repeated target IDs with no way to associate the selected button with a particular edge ID or label.
- The loop picker is the existing edge-aware precedent: it filters ordered outgoing `graph.edges`, derives a target caption, and passes the exact `RPEdge` to its host callback (`src/runner/render/render-loop-picker.ts:44-64`).
- `nodeLabel()` returns a Question’s `questionText`, falling back to its node ID (`src/graph/node-label.ts:18-22`). Therefore an absent edge label already has the required target-caption fallback.
- Current renderer tests construct an adjacency-only Answer/Snippet graph with `edges: []` and assert distinct captions and callback arguments (`src/__tests__/runner/render-question.test.ts:74-134`). That fixture is the regression seam for preserving existing branches while adding concrete edges and Question choices.

### Runner transition contract
- `chooseAnswer()` shows the ordinary forward-action history order: state guard, validation, redo clearing, undo snapshot before mutation, then traversal (`src/runner/protocol-runner.ts:91-125`).
- `chooseSnippetBranch()` establishes explicit current-Question, target-kind, and direct-branch validation before history mutation (`src/runner/protocol-runner.ts:184-220`).
- `chooseLoopBranch()` establishes stable edge-ID lookup, exact source-edge validation, redo clearing, deep-copied loop-context snapshot, and edge-target traversal (`src/runner/protocol-runner.ts:242-281`).
- For the direct-transition contract, the current source must be an ordinary Question in `AT_NODE`; the selected edge must exist and originate at that node; and its resolved target must have `kind: 'question'`. Both ordinary and looped Question targets are valid because they share the same graph kind (`src/graph/graph-model.ts:27-42`).
- Traversal to an ordinary target sets `currentNodeId`, remains in `AT_NODE`, and returns without appending text. Traversal to a looped target follows the existing loop-entry path and halts in `AWAITING_LOOP_PICK` (`src/runner/protocol-runner.ts:727-763`).
- Ordinary undo restoration defaults to `AT_NODE`; redo restores the exact captured post-action state rather than replaying traversal (`src/runner/protocol-runner.ts:291-353`). No new runner status or serialization shape follows from the ordinary transition action itself.
- Runtime error is terminal: it sets status and message only (`src/runner/protocol-runner.ts:878-880`). Existing choice methods validate before clearing redo or pushing undo, so rejected selections do not create history entries.

### Host wiring and the no-write invariant
- `InlineRunnerModal.render()` is the sole production host for ordinary Question rendering. Its Answer callback delegates to an async delta-aware handler; its Snippet callback mutates the runner and rerenders directly (`src/views/inline-runner-modal.ts:459-479`).
- `handleAnswerClick()` reaches note persistence only when accumulated text grows monotonically (`src/views/inline-runner-modal.ts:748-768`).
- The physical note mutation occurs only in `appendAnswerToNote()`, which reads and modifies the target note under the insertion mutex (`src/views/inline-runner-modal.ts:778-788`).
- A strict direct Q-to-Q transition enters a halting Question without an Answer or text-block pass-through, so the accumulator is unchanged (`src/runner/protocol-runner.ts:676-763`). Its host path can therefore mutate runner state and rerender without invoking the note sink.
- Empty Answers remain compatible: `appendAnswerText()` explicitly returns for empty text, preventing a standalone separator, while the existing Answer traversal continues unchanged (`src/runner/protocol-runner.ts:663-665`, `src/runner/protocol-runner.ts:110-125`).

## Code References
- `src/views/protocol-editor-view.ts:255` — Shared ordered editable node-kind list.
- `src/views/protocol-editor-view.ts:312-326` — Edge-label visibility policy that currently excludes ordinary Q-to-Q edges.
- `src/views/protocol-editor-view.ts:732-830` — Standalone and connected node-kind picker construction.
- `src/views/protocol-editor-view.ts:2067-2110` — Edge modal label normalization, policy gate, persistence, and reload.
- `src/views/protocol-editor-view.ts:2460-2481` — Node delete-confirm persistence and stale-document window.
- `src/graph/graph-model.ts:119-140` — Edge identity/label fields and graph edge/adjacency containers.
- `src/protocol/protocol-document-parser.ts:117-143` — Ordered edge parsing and adjacency construction.
- `src/graph/node-label.ts:18-22` — Question caption fallback.
- `src/runner/render/render-question.ts:12-88` — Ordinary Question host contract and current Answer/Snippet partition.
- `src/runner/render/render-loop-picker.ts:44-64` — Edge-aware button/callback precedent.
- `src/runner/protocol-runner.ts:91-125` — Ordinary choice history and traversal pattern.
- `src/runner/protocol-runner.ts:242-281` — Edge-based loop choice precedent.
- `src/runner/protocol-runner.ts:727-763` — Looped and ordinary Question traversal outcomes.
- `src/views/inline-runner-modal.ts:459-479` — Production ordinary-Question host wiring.
- `src/views/inline-runner-modal.ts:748-788` — Accumulator-delta gate and physical note-write sink.
- `src/__tests__/runner/render-question.test.ts:74-158` — Existing renderer fixture and host-spy pattern.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:864-900` — Existing exact-order picker coverage.
- `src/__tests__/protocol-editor-helpers.test.ts:197-241` — Current edge-label visibility policy coverage.

## Integration Points

### Inbound References
- `src/views/protocol-editor-view.ts:1706-1719` — Empty-canvas double click invokes the standalone node-kind picker.
- `src/views/protocol-editor-view.ts:1410-1427` — Connection drag to empty canvas invokes the connected picker.
- `src/views/inline-runner-modal.ts:459-479` — `AT_NODE` rendering supplies the sole production `QuestionBranchHost`.
- `src/__tests__/runner/render-question.test.ts:94-158` — Render tests call `renderQuestionAtNode()` directly with injected host spies.

### Outbound Dependencies
- `src/runner/render/render-question.ts:3-6` — Ordinary rendering depends on graph types, runner state, snippet-label helpers, and DOM button creation.
- `src/graph/node-label.ts:18-22` — Supplies the target Question caption fallback.
- `src/runner/protocol-runner.ts:676-763` — Existing traversal resolves the selected edge target and halts in the correct Question state.
- `src/views/inline-runner-modal.ts:778-788` — Physical note persistence remains outside the runner and renderer.

### Infrastructure Wiring
- `src/protocol/protocol-document-parser.ts:117-143` — Converts persisted edge records into ordered runtime edges and adjacency maps.
- `src/views/protocol-editor-view.ts:2085-2109` — `ProtocolDocumentStore.update()` persists edge edits and refreshes editor state.
- `src/views/protocol-editor-view.ts:2466-2476` — `ProtocolDocumentStore.update()` persists node deletion before editor reload.

## Architecture Insights
- The feature remains additive at existing seams: editor state/persistence, pure runner state machine, pure DOM renderer, and Obsidian-aware host. Lower graph/parser/validator contracts already admit Q-to-Q edges.
- Edge identity is load-bearing whenever captions or selection semantics belong to an edge. Adjacency remains appropriate for node-kind-only Answer/Snippet classification, but cannot identify labeled direct transitions.
- Every accepted user-driven runner action follows validation before history mutation and undo-before-mutate with a deep copy of loop frames.
- The no-note-write guarantee is split across layers: the runner preserves accumulated text; the host omits or gates access to the note sink.
- Editor display policy currently doubles as persistence policy. That coupling is why a visible generic label input can still discard a valid graph-model label.
- Per-invocation filtering is only as current as `this.doc`; mutation paths that rely on asynchronous reload create observable stale-state windows.

## Precedents & Lessons
3 precedent clusters covering 6 relevant commits were analyzed.

### Precedent: Merge Loop into Question with structural edge metadata
**Commit(s)**: `1dd1f78` — "feat: merge standalone loop node type into question via loop toggle and explicit isLoopExit edge flag" (2026-07-28)
**Blast radius**: 46 files across graph, parser, migration, validator, runner, render, editor, picker, i18n, CSS, and tests.

**Follow-up fixes**:
- Validation found restore-status serialization, whitespace-caption accessibility, and stale-test-language gaps before the final pass.

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md` — edge identity, render classification, and state restoration are cross-layer invariants.
- `.rpiv/artifacts/validation/2026-07-28_17-12-07_merge-loop-node-type-into-question-via-a-loop-toggle-explicit-isloopexit-edge-flag.md` — final validation record for the merge.

**Takeaway**: Keep branch identity structural and verify state/history behavior at the exact selection seam.

### Precedent: Seed Start and deprecate Text-block creation
**Commit(s)**: `b895736` — "feat: drop JSON snippets, deprecate Text block creation, seed Start node, and refine runner/insert-modal UX" (2026-07-27)
**Blast radius**: 40 files across protocol, runner, views, render, localization, and tests.

**Follow-up fixes**:
- No Start-seeding follow-up fix was identified.

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md` — creation availability can change while legacy model/runtime support remains intact.
- `.rpiv/artifacts/validation/2026-07-27_19-22-50_runner-cleanup-nodes-snippets-modal-ux.md` — validation record for seeded Start and picker changes.

**Takeaway**: Picker visibility is independent of whether a node kind remains parseable, editable, and runnable.

### Precedent: Edge-label persistence regressions
**Commit(s)**: `50a7fcb` — "Fix: preserve '+'-prefixed loop exit edge labels regardless of target node kind" (2026-05-17); `0ff2587` — "fix: loop edge label save, inline runner layout, font consistency" (2026-05-17); `f5850c0` — "Fix: re-render protocol editor after edge save so saved label/exit state is visible on re-open" (2026-05-18); `478af29` — "fix: button text wrap + quick-exit from loop via answer wired to exit target" (2026-05-05)
**Blast radius**: editor label policy, save/reload behavior, runner traversal, render behavior, and tests.

**Follow-up fixes**:
- Three separate commits corrected label preservation and save/reopen behavior around the same editor edge-label surface.

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md` — prior label-overloading regressions motivated structural `isLoopExit` metadata.

**Takeaway**: A Q-to-Q caption must be tested through save and reopen, not only at parser or renderer level.

### Composite Lessons
- Preserve concrete edge identity from authoring through rendering and runner selection; target-only adjacency is insufficient for labeled choices.
- Treat `shouldDisplayProtocolEditorEdgeLabel()` and editor refresh behavior as a known regression hotspot (`50a7fcb`, `0ff2587`, `f5850c0`).
- Preserve runner history discipline even when an action inserts no text: validation, redo clearing, snapshot, mutation, restoration.
- Keep the change additive: direct transitions coexist with empty Answer pass-through protocols and existing looped Questions.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-07-29_09-21-06_hide-start-picker-q-to-q-transitions.md` — source feature requirements and initial decisions.
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md` — prior research on Question/loop consolidation and edge identity.
- `.rpiv/artifacts/designs/2026-07-28_09-09-24_merge-loop-into-question.md` — prior design for merged Question/loop behavior.
- `.rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md` — prior implementation plan for the merged loop model.
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md` — prior research covering seeded Start and node creation surfaces.
- `.rpiv/artifacts/plans/2026-07-27_17-12-43_runner-cleanup-nodes-snippets-modal-ux.md` — prior plan covering Start seeding and picker behavior.
- `.rpiv/artifacts/validation/2026-07-27_19-22-50_runner-cleanup-nodes-snippets-modal-ux.md` — validation of seeded Start and related cleanup.
- `.rpiv/artifacts/validation/2026-07-28_17-12-07_merge-loop-node-type-into-question-via-a-loop-toggle-explicit-isloopexit-edge-flag.md` — validation of merged looped-Question behavior.

## Developer Context
**Q (discover: Filter both node-type pickers by Start existence): Both picker loops enumerate `EDITABLE_NODE_KINDS` at `src/views/protocol-editor-view.ts:760` and `src/views/protocol-editor-view.ts:810`. Which picker entry points should filter Start?**
A: Filter both; show Start only when the current document has no Start node.

**Q (discover: Build Question-to-Question at the renderer + runner seam): The lower graph/parser contracts already carry unrestricted edges at `src/graph/graph-model.ts:119-140` and `src/protocol/protocol-document-parser.ts:117-143`. Should they change?**
A: Keep the graph model, parser, and validator unchanged; build on the renderer and runner seams, with the researched editor persistence corrections.

**Q (discover: Button caption source for direct Q-to-Q transitions): `RPEdge.label` exists at `src/graph/graph-model.ts:119-123`, and `nodeLabel()` supplies the Question fallback at `src/graph/node-label.ts:18-22`. What caption source should be canonical?**
A: Use `edge.label`, falling back to the target Question’s `questionText`, then target ID.

**Q (discover: Runner selection API for direct Q-to-Q transitions): Existing ordinary choices are node-based at `src/runner/protocol-runner.ts:91-125`, while loop choices are edge-based at `src/runner/protocol-runner.ts:242-281`. What API shape should direct transitions use?**
A: Add a new edge-based transition method and an edge-based render callback; do not broaden `chooseAnswer()`.

**Q (discover: Rendering mixed Answer + Question neighbors): The current renderer partitions branches at `src/runner/render/render-question.ts:45-86`. How should mixed branch kinds appear?**
A: Show all available Answer and direct Question choices as buttons; preserve existing Snippet branch behavior.

**Q (discover: Backward compatibility of empty Answer nodes): Empty Answer text is skipped at `src/runner/protocol-runner.ts:663-665`. Should existing pass-through protocols change?**
A: Keep empty Answer nodes working unchanged; direct Q-to-Q is additive.

**Q (discover: No new validation rule for direct Q-to-Q edges): The runtime graph already accepts Q-to-Q edges, and Question caption fallback exists. Should validator rules change?**
A: No new validation rule; a label-less direct transition remains valid.

**Q (`src/views/protocol-editor-view.ts:312-326`): Ordinary Q-to-Q typed labels are rejected by display policy and persisted as undefined at `src/views/protocol-editor-view.ts:2076-2103`. Should scope expand?**
A: Expand the view-layer scope to preserve ordinary Q-to-Q labels and cover the helper/save path; still no new UI, schema, parser, or validator work.

**Q (`src/views/protocol-editor-view.ts:2466-2476`): Node deletion leaves `this.doc` stale until an unawaited reload completes. Should successful deletion synchronize in-memory state immediately?**
A: Yes. Synchronize `this.doc` from the successful delete result so the next picker invocation immediately reflects Start deletion.

**Q (`src/graph/graph-model.ts:27-42`): Looped and ordinary Questions share `kind: 'question'`, but traversal halts in different states at `src/runner/protocol-runner.ts:727-763`. Should direct transitions allow looped targets?**
A: Allow both ordinary and looped Question targets; existing traversal determines whether the result is `AT_NODE` or `AWAITING_LOOP_PICK`.

## Related Research
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md`

## Open Questions
None — all discover branches and research checkpoint ambiguities were resolved.
