---
date: 2026-07-28T08:28:48+0300
author: Roman Shulgha
commit: fa80090
branch: main
repository: RadiProtocol
topic: "Merge Loop node type into Question via a loop toggle"
tags: [intent, frd, graph, protocol, runner, render, views, i18n]
status: ready
last_updated: 2026-07-28T08:28:48+0300
last_updated_by: Roman Shulgha
---

# FRD: Merge Loop node type into Question via a loop toggle

## Summary
Remove the standalone `Loop` node type and fold its behavior into `Question` via a boolean `loop` flag. A looped Question reuses the existing loop runner state machine, loop-context frames, and picker renderer, and is configured in the editor by a checkbox in the node edit panel plus a canvas icon indicator. Loop exit edges stop using the `+`-prefix label convention and instead carry an explicit `isLoopExit` edge property, bound to the existing "Exit loop" checkbox in the edge-edit modal. Existing `.rp.json` documents are auto-migrated on open in the editor.

## Problem & Intent
The friction is during protocol execution: radiologists running a study experience two node types for what feels like one "ask and maybe ask again" action. In the developer's words, the goal is to "remove the 'Loop' node type and transfer its functions to the 'Question' node, so that — using a checkbox or icon — we can turn a 'Question' node into a looped question that allows for multiple answer options (similar to how the current 'Loop' node works). It's important that these nodes are easy for users to configure and use."

## Goals
- One node kind (`question`) covers both single-shot questions and looped/repeatable questions, selectable via a toggle.
- Loop behavior is preserved: repeatable body traversal through graph edges, user-driven exit, flat Markdown output.
- Loop exit edges are identified by an explicit edge property, not by overloading the user-facing label text.
- Existing protocols containing `loop` nodes keep working transparently (auto-migrate on open).
- Authoring looped Questions is easy and discoverable (checkbox + at-a-glance canvas icon).

## Non-Goals
- Per-iteration output grouping (bulleted lists, arrays, per-iteration records) — confirmed non-goal; output stays flat concatenated Markdown.
- Fixed iteration count, maximum-iterations, or automatic termination condition on looped Questions — confirmed non-goal; exit stays user-driven.
- Owned child subgraph for loops — confirmed non-goal; loop body stays ordinary outgoing graph edges.
- Building a general versioned document-migration framework (chosen approach migrates on editor open, not a schema-version pipeline).
- New sidebar/RunnerView (ADR-0001 keeps the runner inline-only).

## Functional Requirements
1. The system SHALL add an optional `loop: boolean` field to `QuestionNode` (`src/graph/graph-model.ts`) and the serialized `ProtocolNodeRecord` (`src/protocol/protocol-document.ts`); `LoopNode` and its `headerText` field SHALL be removed from the runtime model and the canonical record.
2. The system SHALL add an optional `isLoopExit: boolean` field to `RPEdge` (`src/graph/graph-model.ts:125-130`) and the serialized `ProtocolEdgeRecord` (`src/protocol/protocol-document.ts:91-103`); the parser SHALL copy it through at `src/protocol/protocol-document-parser.ts:120-126`.
3. The system SHALL remove `loop` from `VALID_KINDS` and `RPNodeKind`; the node-picker-modal SHALL offer only `question` (and other non-loop kinds), not `loop`.
4. The node edit panel SHALL expose a "loop this question" checkbox that sets `QuestionNode.loop`; the canvas SHALL render an icon/badge on nodes whose `loop` is true so looped Questions are visible at a glance.
5. The edge-edit modal's existing "Exit loop" checkbox (`src/views/protocol-editor-view.ts:2048-2052`) SHALL bind to `edge.isLoopExit` instead of mutating the edge label; it SHALL be shown when the source node is a looped Question (not only a legacy `loop` kind).
6. The validator SHALL apply loop validation (≥1 `isLoopExit:true` exit edge and ≥1 body edge) to Question nodes whose `loop` is true, and SHALL skip loop validation for non-loop Questions.
7. The runner SHALL reuse the `'awaiting-loop-pick'` status, `LoopContext` frames, `chooseLoopBranch`, quick-exit, dead-end-return, and stepBack behavior for looped Questions, keyed on `loop` rather than `kind === 'loop'`; non-loop Questions SHALL behave exactly as today.
8. `render-loop-picker.ts` SHALL render the picker for any looped node keyed on the `loop` flag (generalized from `kind === 'loop'`); exit/body classification and exit captions SHALL read `isLoopExit` and the ordinary (prefix-free) label.
9. The `+`-prefix label convention SHALL be removed: `isExitEdge`, `stripExitPrefix`, `normalizeProtocolEditorEdgeLabel`, `displayProtocolEditorEdgeLabel`, `isProtocolEditorLoopExitLabel`, and their consumers SHALL be deleted or rewired to `isLoopExit`.
10. On opening a legacy `.rp.json` in the editor, the system SHALL auto-migrate: each `loop` node becomes a `question` with `loop: true` and `questionText` set from the former `headerText`; each outgoing edge whose label began with `+` becomes `isLoopExit: true` with the `+` prefix stripped from the displayed label; the migrated document SHALL be written back to the vault.
11. The system SHALL add i18n strings for the loop toggle and canvas icon to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`; user-authored content (question text, labels) SHALL NOT be wrapped in `t()`.

## Non-Functional Requirements
- **Performance**: No specific latency target. Auto-migration runs once per legacy document on open and must not perceptibly delay editor load for typical protocols. Runner/render performance for looped Questions SHALL match current Loop behavior (no new traversal cost).
- **Security**: No backend/auth/cloud involvement (plugin-local only). Migration writes back to the vault via the existing `ProtocolDocumentStore.write()` path; no data leaves the vault.
- **UX / Accessibility**: The loop toggle checkbox SHALL be keyboard-accessible and labeled (mirrors the existing edge "Exit loop" checkbox a11y). The canvas icon SHALL have a tooltip/aria label. Loop behavior for radiologists during execution SHALL be visually identical to today's Loop picker.
- **Reliability**: Migration must be idempotent (re-opening an already-migrated document performs no rewrite) and lossless (question text, edge labels, graph topology preserved). A migration failure SHALL not corrupt the document — fall back to leaving the document unmodified and surface an error rather than writing a partial transform.

## Constraints & Assumptions
- **Technical**: TypeScript + esbuild + Vitest; Obsidian plugin. Pure-vs-Obsidian layer split (NFR-01): `graph/` all-pure, `protocol/` parser pure, `runner/` core pure, `runner/render/` + `views/` Obsidian. Pure modules receive Obsidian capabilities via constructor injection. Dependency direction `views → lower`, no reverse dependency.
- **Editor loads directly from the store**, not through `ProtocolDocumentParser` (`src/views/protocol-editor-view.ts:561-579`), so migration MUST run in the editor load path (or store read), not only in the parser — assumed and to be verified in research.
- **No migration framework exists today**: `version` is reserved but unused (`src/protocol/protocol-document.ts:5-9`); only version `1` exists; `ProtocolDocumentStore.read()` does not transform. Migration code is net-new.
- **Existing "Exit loop" checkbox is a UI facade** over the `+`-prefix convention today (`src/views/protocol-editor-view.ts:2048-2052`, `:273-285`); rewiring it to `isLoopExit` is mostly rebinding, not new UI.
- **Inline-only runner** (ADR-0001): no sidebar/RunnerView; all render changes land in `runner/render/` + `views/inline-runner-modal.ts`.
- **i18n**: en + ru locale files must stay in sync.
- Assumption: existing protocols in the wild use the `+`-prefix exit convention as the only exit marker; research should confirm no other in-the-wild exit encodings exist.

## Acceptance Criteria
- [ ] `npm run build` exits 0 with `LoopNode`/`headerText` removed from `src/graph/graph-model.ts` and `loop` removed from `VALID_KINDS`/`RPNodeKind`.
- [ ] `npm test` exits 0, including updated/new tests: parser round-trips `loop:true` on Question and `isLoopExit:true` on edges; validator accepts a looped Question with one exit + one body edge and rejects zero exits / zero body; runner renders a looped Question picker and supports repeat + exit + stepBack; render-loop-picker renders a looped Question keyed on the loop flag.
- [ ] A legacy fixture `.rp.json` containing a `loop` node with `headerText` and a `+`-prefixed exit edge, when opened in the editor, is rewritten as a `question` node with `loop:true`, `questionText` equal to the former `headerText`, and an edge with `isLoopExit:true` and the `+` prefix stripped from its label.
- [ ] Re-opening the already-migrated document performs no further write (migration is idempotent).
- [ ] The node-picker-modal no longer offers `loop`; only `question` (and other non-loop kinds) is offered.
- [ ] In the editor, checking "loop this question" on a Question shows a loop icon on the canvas node; the edge-edit modal's "Exit loop" checkbox appears for edges whose source is a looped Question and sets `edge.isLoopExit`.
- [ ] `rg "isExitEdge|stripExitPrefix|normalizeProtocolEditorEdgeLabel|isProtocolEditorLoopExitLabel"` returns no production-code references (only removed/rewired).
- [ ] `npm run lint` exits 0; `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` both contain the new loop-toggle and canvas-icon keys.
- [ ] Running a looped Question in the inline runner produces flat concatenated Markdown across iterations (no grouping), terminates via the `isLoopExit` edge, and supports stepBack to the picker — matching today's Loop behavior.

## Recommended Approach
Add `loop?: boolean` to `QuestionNode` and `isLoopExit?: boolean` to `RPEdge` (+ serialized records), remove `LoopNode`/`headerText` and the `+`-prefix label utilities, rewire the existing edge "Exit loop" checkbox and a new node "loop this question" checkbox + canvas icon to the new fields, generalize the loop validator/runner/render branches to key on `loop` instead of `kind === 'loop'`, and add a one-time auto-migration in the editor load path (`src/views/protocol-editor-view.ts:561-579`) that transforms legacy `loop` nodes and `+`-prefixed edges and writes back via `ProtocolDocumentStore.write()`. Downstream `research` should verify the migration placement (editor load vs store read), the full set of `+`-prefix consumers to rewire, and the idempotency/losslessness of the transform.

## Decisions

### Preserve current Loop behaviors (flat output, user-driven exit, body = graph edges)
**Question**: Pre-resolved from codebase evidence — select Loop behaviors to PRESERVE unchanged in the looped Question.
**Recommended**: Preserve all four inferred behaviors (flat output, user-driven exit, body = graph edges, `+`-prefix exit labels).
**Chosen**: Preserve flat output (no per-iteration grouping), user-driven exit (no count/condition), and body = graph edges (no owned child subgraph). Revisit the `+`-prefix exit-label convention (see next decision).
**Rationale**: evidence: `src/runner/text-accumulator.ts`, `src/views/inline-runner-modal.ts:805-841`, `src/graph/node-label.ts:69-92`, `src/graph/graph-validator.ts:112-162`, `src/runner/protocol-runner.ts:769-807` + confirmed. Behavior-preserving merge minimizes radiologist-facing change.

### Replace `+`-prefix exit labels with explicit `isLoopExit` edge property
**Question**: Keep the `+`-prefix edge-label convention for looped Questions, or replace it?
**Recommended**: Keep the `+`-prefix convention (preserve behavior).
**Chosen**: Replace with an explicit `isLoopExit: boolean` edge property + an "Exit loop" toggle in the edge settings UI; auto-migrate existing `+`-prefixed edges to `isLoopExit: true` with the prefix stripped from the displayed label.
**Rationale**: Developer correction — coupling internal control-flow semantics to user-facing label text is unclear and unreliable; an explicit property decouples them. The "Exit loop" checkbox already exists in the edge modal (`src/views/protocol-editor-view.ts:2048-2052`) and only needs rebinding.

### Backward compatibility / migration strategy
**Question**: How should backward compatibility be handled for existing `.rp.json` documents with `loop` nodes and `+`-prefixed edges?
**Recommended**: Auto-migrate on open.
**Chosen**: Auto-migrate on open — when the editor loads a legacy `.rp.json`, transform each `loop` node → looped Question and each `+`-prefixed edge → `isLoopExit: true`, then write back. Remove `loop` from `RPNodeKind` entirely (no legacy-readable kind retained).
**Rationale**: Optimizes a clean end-state model and transparent UX for existing protocols. Accepted risk (migration bug could rewrite docs) mitigated by idempotency + losslessness + fallback-on-error (see NFRs). Note: editor loads directly from the store, not the parser (`src/views/protocol-editor-view.ts:561-579`), so migration must run in the editor load path.

### Loop toggle data model + prompt field consolidation
**Question**: How should the loop toggle be represented on `QuestionNode`, and what happens to `headerText` vs `questionText`?
**Recommended**: Boolean flag.
**Chosen**: Add `loop?: boolean` to `QuestionNode`; `questionText` becomes the single prompt field; `LoopNode` and `headerText` removed; migrated Loop nodes map `headerText` → `questionText` and set `loop: true`.
**Rationale**: Optimizes simplicity and a clean single-prompt, single-node-kind model. Count/condition are confirmed non-goals, so a flat boolean suffices and avoids speculative `LoopConfig` structure (YAGNI).

### Author-facing loop UI (checkbox vs icon)
**Question**: How should an author enable looping on a Question in the visual editor?
**Recommended**: Checkbox + canvas icon.
**Chosen**: A "loop this question" checkbox in the node edit panel (mirrors the existing edge "Exit loop" checkbox pattern) PLUS a canvas icon/badge on looped Question nodes for at-a-glance visibility.
**Rationale**: Optimizes discoverability + configurability together. The checkbox reuses an existing editor convention; the canvas icon addresses the radiologist-execution-friction intent by making looped Questions visible without opening the node.

### Validator keyed on loop flag
**Question**: Pre-resolved from evidence — confirm looped Questions reuse loop validation keyed on the `loop` flag.
**Recommended**: Reuse the existing loop validation (≥1 exit edge, ≥1 body edge) keyed on `loop` instead of `kind === 'loop'`; non-loop Questions skip it.
**Chosen**: Confirmed.
**Rationale**: evidence: `src/graph/graph-validator.ts:112-158` + confirmed. Avoids duplicating validation logic for the merged node.

### Reuse runner state + render for looped Questions
**Question**: Pre-resolved from evidence — confirm looped Questions reuse `'awaiting-loop-pick'` + `LoopContext` + `render-loop-picker.ts`.
**Recommended**: Reuse the existing runner status, loop-context frames, and picker renderer, generalized to key on the `loop` flag; no new runner state.
**Chosen**: Confirmed.
**Rationale**: evidence: `src/runner/runner-state.ts:50-53`, `src/graph/graph-model.ts:100-113`, `src/runner/render/render-loop-picker.ts:16-63` + confirmed. Behavior-preserving merge; avoids parallel traversal code.

### Remove `+`-prefix convention fully
**Question**: Pre-resolved from evidence — remove the `+`-prefix label convention entirely after migration (no fallback)?
**Recommended**: Delete `isExitEdge`/`stripExitPrefix`/`normalizeProtocolEditorEdgeLabel`/`isProtocolEditorLoopExitLabel` and rewire consumers; no fallback.
**Chosen**: Confirmed.
**Rationale**: evidence: `src/graph/node-label.ts:64-100`, `src/views/protocol-editor-view.ts:273-285` + confirmed. Auto-migrate handles legacy edges, so the convention can be fully removed — clean end state, no dual-path.

### Node picker + i18n (en + ru)
**Question**: Pre-resolved from evidence — remove Loop from node-picker-modal and add loop-toggle/canvas-icon strings to both locales?
**Recommended**: Remove `loop` from `node-picker-modal`; add new i18n keys to BOTH `en.json` and `ru.json`.
**Chosen**: Confirmed.
**Rationale**: evidence: `src/views/node-picker-modal.ts:22-29` + confirmed; project i18n rule requires both locale files in sync; user-authored content stays unwrapped.

## Open Questions
- Migration trigger placement: should migration run in the editor load path (`src/views/protocol-editor-view.ts:561-579`) or in `ProtocolDocumentStore.read()`? The decision assumes editor-load path because the editor bypasses the parser, but research should confirm which location reaches all read paths (editor, runner, validator) without double-migrating.
- Whether any in-the-wild protocols encode loop exits by a means other than the `+`-prefix (assumed no; research should verify there is no alternate legacy encoding).

## Suggested Follow-ups
- StepBack today restores runner traversal state but does not reverse already-appended Markdown in the note (`src/views/inline-runner-modal.ts:572-580`, `:767-777`) — observed for both Question and Loop. Out of scope for this merge but worth a separate follow-up to make undo reverse the note append.
- `maxIterations` on `ProtocolRunnerOptions` (default 50) guards per-`advanceThrough()` step count, not total loop iterations (`src/runner/protocol-runner.ts:10-14`, `:677-688`) — unrelated to the merge; leave as-is.
- Edge color editing does not exist today (`RPEdge` has no color field, modal has no color control, `src/views/protocol-editor-view.ts:2025-2060`) — unrelated observation; out of scope.

## References
- Input: developer free-text request (discover skill invocation, 2026-07-28).
- Codebase probe: `codebase-locator` + `codebase-analyzer` reports on Loop/Question node types and edge model (this session).
- `.rpiv/guidance/` shadow tree: `src/graph/`, `src/protocol/`, `src/runner/`, `src/runner/render/`, `src/views/` architecture.md files.