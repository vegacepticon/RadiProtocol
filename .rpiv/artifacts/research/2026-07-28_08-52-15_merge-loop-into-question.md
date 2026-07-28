---
date: 2026-07-28T08:52:15+0300
author: Roman Shulgha
commit: fa80090
branch: main
repository: RadiProtocol
topic: "Merge Loop node type into Question via a loop toggle"
tags: [research, codebase, graph, protocol, runner, editor, migration]
status: ready
last_updated: 2026-07-28T08:52:15+0300
last_updated_by: Roman Shulgha
---

# Research: Merge Loop node type into Question via a loop toggle

## Research Question
How can the standalone `Loop` node be folded into `Question` through `loop?: boolean`, with explicit `isLoopExit?: boolean` edges and lossless one-time migration, while preserving the existing validator, runner, picker, undo/redo, editor, and inline-output behavior?

## Summary
The current implementation has a separate `LoopNode`, stores its prompt in `headerText`, and derives loop exits exclusively from a leading `+` in the edge label (`src/graph/graph-model.ts:53-63`, `src/graph/node-label.ts:65-101`). The existing runtime is already reusable after loop entry: `AwaitingLoopPickState` stores only a node ID, `LoopContext` stores primitive frame data, and branch selection, re-entry, dead-end return, nested-loop behavior, stepBack, and redo are independent of `LoopNode.headerText` (`src/runner/runner-state.ts:43-58`, `src/graph/graph-model.ts:95-113`, `src/runner/protocol-runner.ts:243-361,763-879`).

The clean canonical shape is a Question with one prompt field and an optional loop flag, plus an edge-level exit flag. The parser must preserve `true`, explicit `false`, and absence separately; its current helpers normalize only strings and separators, so no boolean normalization exists yet (`src/protocol/protocol-document-parser.ts:38-55`). Legacy `'loop'` must remain readable only at the raw document compatibility boundary: the V1 envelope guard does not validate individual node kinds, even though `ProtocolNodeRecord.kind` is statically typed as `RPNodeKind | null` (`src/protocol/protocol-document.ts:63-88,149-164`).

Migration should run in `ProtocolDocumentStore.read()`, as selected at the developer checkpoint. It is the common seam for editor load and start-from-node selection, and persistence there ensures the inline runner's later raw vault read sees the migrated document (`src/protocol/protocol-document-store.ts:34-49`, `src/views/protocol-editor-view.ts:561-580`, `src/main.ts:266-289`, `src/views/inline-runner-modal.ts:147-180`). The transform is idempotent when triggered only by exact legacy `kind === 'loop'` records and classifies `+` edges only when they originate from those captured legacy node IDs. Repository code contains no alternate standalone-Loop exit encoding.

## Detailed Findings

### Canonical model and serialization boundary
- `RPNodeKind` currently includes standalone `'loop'` alongside deprecated Canvas-only `'loop-start'` and `'loop-end'`; these are distinct compatibility surfaces (`src/graph/graph-model.ts:9-20,53-85`).
- `QuestionNode` currently has only `questionText`; `LoopNode` separately has `headerText`; `RPNode` includes both (`src/graph/graph-model.ts:36-40,53-63,112-120`). The merged runtime model needs no second prompt field or second node union member.
- `RPEdge` and `ProtocolEdgeRecord` currently persist only IDs, endpoints, and an optional label (`src/graph/graph-model.ts:122-128`, `src/protocol/protocol-document.ts:91-103`). `isLoopExit` therefore has to cross both the serialized and runtime edge shapes.
- `ProtocolNodeRecord.fields` is already an open `Record<string, unknown>`, so `loop` can be stored without adding a dedicated record property; its field documentation still names `headerText` (`src/protocol/protocol-document.ts:63-88`).
- The parser reconstructs edges instead of spreading raw records, so a new edge flag is lost unless explicitly copied where the runtime `RPEdge` is created (`src/protocol/protocol-document-parser.ts:105-138`).
- The Question parser currently applies modern-key, legacy-key, then fallback precedence for `questionText`; the standalone Loop parser separately normalizes `headerText` (`src/protocol/protocol-document-parser.ts:188-201,231-238`). Consolidation must preserve the former Loop prompt as `questionText`, not carry `headerText` into the canonical graph.
- Optional booleans have three meaningful parser outcomes: `true`, `false`, and `undefined` for absent or non-boolean input. Truthiness coercion would collapse explicit `false` into absence; the existing typed-helper pattern shows where normalization belongs but has no boolean equivalent (`src/protocol/protocol-document-parser.ts:38-55`).

### Legacy acceptance and migration
- `isProtocolDocumentV1()` validates only schema/version, top-level identity/timestamps, and that `nodes`/`edges` are arrays; it does not inspect node kinds or record fields (`src/protocol/protocol-document.ts:149-164`). Raw V1 JSON containing `'loop'` can therefore reach migration after `'loop'` is removed from `RPNodeKind`.
- The current parser gate is typed as `RPNodeKind[]` and explicitly contains `'loop'`; simply deleting that literal would reject old files before compatibility conversion (`src/protocol/protocol-document-parser.ts:27-36,155-170`). The compatibility boundary must distinguish a legacy wire kind from the canonical runtime kind set.
- The exact legacy node discriminator is `'loop'`. Deprecated `'loop-start'`/`'loop-end'` represent the older Canvas pair model and remain separately rejected by validator migration handling (`src/graph/graph-model.ts:66-85`, `src/graph/graph-validator.ts:64-81`). Prefix matching on node kinds would conflate the two formats.
- `ProtocolDocumentStore.read()` parses unknown JSON, applies the shallow envelope guard, catches all failures, and returns `null` on missing/invalid data (`src/protocol/protocol-document-store.ts:34-49`). Both editor and start-from-node callers already stop and show a load failure on `null` (`src/views/protocol-editor-view.ts:568-572`, `src/main.ts:266-278`).
- Store-level migration covers both known `ProtocolDocumentStore.read()` callers. It must persist a changed document before returning because `InlineRunnerModal` subsequently rereads raw vault text and parses that text directly (`src/main.ts:280-289`, `src/views/inline-runner-modal.ts:147-180`).
- Idempotency can be based on whether exact legacy Loop records exist. Capture their IDs before rewriting; only their outgoing `+`-prefixed edges are legacy exits. This prevents unrelated user labels beginning with `+` from being reinterpreted.
- Losslessness requires preserving document metadata, node/edge IDs, endpoints, geometry, colors, raw text, unrelated fields, viewport, layout direction, and unknown extension fields. The canonical records expose those preservation surfaces (`src/protocol/protocol-document.ts:19-103`).
- `write()` serializes one complete document under the per-path write mutex (`src/protocol/protocol-document-store.ts:54-68`). `update()` calls `read()` and then `write()` (`src/protocol/protocol-document-store.ts:73-82`), so a first update of a legacy file can cause a migration write followed by the requested update write unless the design accounts for that interaction.
- The repository-wide production sweep found no alternate standalone-Loop exit encoding beyond `isExitEdge()`'s `+` predicate and its consumers (`src/graph/node-label.ts:79-81`, `src/graph/graph-validator.ts:123-149`, `src/runner/protocol-runner.ts:265-269,743-754`). The developer confirmed no in-the-wild alternate.

### Exit-edge semantics and validation
- `isExitEdge()` currently treats any trimmed label beginning with `+` as an exit, while `stripExitPrefix()` removes the control prefix for display (`src/graph/node-label.ts:65-101`). Labels and control flow are therefore coupled today.
- The validator partitions loop edges into exit, legacy-labeled, and body groups through `isExitEdge()` and `isLabeledEdge()`, then validates prefix-specific hints and caption content (`src/graph/graph-validator.ts:112-158`). With explicit metadata, the legacy-label hint and post-prefix caption validation have no semantic basis.
- After prefix-specific validator branches disappear, `isLabeledEdge()` has no other current production consumer beyond this loop-validation block (`src/graph/node-label.ts:53-61`, `src/graph/graph-validator.ts:7,123-149`).
- Dead-end validation currently applies to every Question, while standalone Loop validation is a separate pass (`src/graph/graph-validator.ts:102-158`). A looped Question must skip the generic dead-end check or a zero-edge node would receive both generic and loop-specific errors.
- Intentional-cycle detection currently exempts cycles containing `kind === 'loop'` (`src/graph/graph-validator.ts:232-268`). The equivalent merged predicate is the loop-enabled Question; an ordinary Question in the same topology must remain an unintentional cycle.
- Existing multi-exit behavior remains compatible with explicit flags: validation requires at least one exit and one body but does not impose a single-exit limit (`src/graph/graph-validator.ts:112-158`).
- Prefix-specific English and Russian validator messages are colocated and structurally synchronized; `loopNoExitWithLegacy`, `loopExitNoLabel`, and wording in `loopNoExit`, `loopNoBody`, and `unintentionalCycle` currently name the old convention (`src/i18n/locales/en.json:287-297`, `src/i18n/locales/ru.json:287-297`).

### Runner state machine and picker rendering
- `AwaitingLoopPickState` contains only `nodeId`, accumulated text, and undo/redo metadata; no new runner status is needed (`src/runner/runner-state.ts:43-58`).
- `LoopContext` contains `loopNodeId`, one-based `iteration`, and `textBeforeLoop`; all are primitive values and remain valid when the owner is a Question (`src/graph/graph-model.ts:95-113`).
- `chooseLoopBranch()` is already state- and edge-ID-driven. The only exit coupling is its `isExitEdge(edge)` check before popping the top frame (`src/runner/protocol-runner.ts:243-288`). The renderer-provided exit boolean is not trusted by the runner.
- Ordinary Questions halt at `AT_NODE`; standalone Loops perform re-entry detection, frame creation, and transition to `AWAITING_LOOP_PICK` in a separate switch arm (`src/runner/protocol-runner.ts:715-725,763-807`). The merged recognition point is therefore localized, while non-loop Questions retain their current branch.
- Quick exit checks the top frame's owner and an exit edge to the Answer's next target before popping the frame (`src/runner/protocol-runner.ts:739-759`). Dead-end return increments the top frame and restores its picker independently of node kind (`src/runner/protocol-runner.ts:855-881`).
- Nested-loop behavior depends on top-frame identity: re-entry increments when the top frame owner equals the cursor, and exit pops only the top frame (`src/runner/protocol-runner.ts:265-269,763-807`). The node merge does not alter this stack discipline.
- Loop entry and branch selection record `restoreStatus: AWAITING_LOOP_PICK`; `stepBack()` restores it, and redo restores the captured status and loop stack (`src/runner/protocol-runner.ts:258-361,785-806`). Ordinary Question undo entries continue to fall back to `AT_NODE`.
- `renderLoopPicker()` currently guards for `kind === 'loop'`, renders `headerText`, enumerates edge objects, classifies via the prefix predicate, uses stripped edge labels for exits, and target `nodeLabel()` values for bodies (`src/runner/render/render-loop-picker.ts:16-64`). The edge-object iteration must remain because adjacency lacks edge IDs and metadata.
- The inline host routes the picker callback to `chooseLoopBranch(edge.id)`, computes one accumulator suffix after traversal, appends that suffix to the note, and rerenders (`src/views/inline-runner-modal.ts:501-519,805-844`). This preserves flat output across iterations without adding grouping state.

### Editor and node-picker authoring
- `NODE_KIND_DEFAULTS` and `EDITABLE_NODE_KINDS` currently define Loop separately; both node-creation grids consume the shared editable-kind list (`src/views/protocol-editor-view.ts:246-270,767-832`). Removing the shared Loop entry removes it from both authoring grids.
- New nodes copy their kind's default fields, so the Question toggle uses the existing generic field persistence path (`src/views/protocol-editor-view.ts:676-695`).
- `renderNode()` is the single canvas-node rendering seam and already assigns role, keyboard focus, and an accessible node label (`src/views/protocol-editor-view.ts:929-984`). It is the natural location for a loop badge with translated tooltip/ARIA text.
- The node edit modal stores controls as string/boolean producers, copies existing fields, applies or deletes control values, and persists the updated node (`src/views/protocol-editor-view.ts:2176-2206,2399-2451`). The current Question arm has only `questionText`; the current Loop arm edits `headerText` (`src/views/protocol-editor-view.ts:2348-2363`).
- The edge modal strips `+` for display, derives checkbox state from the prefix, and shows the checkbox only for a standalone Loop source (`src/views/protocol-editor-view.ts:2040-2061`). Its save path re-encodes the checkbox into the label and also uses prefix detection to suppress snippet-label synchronization (`src/views/protocol-editor-view.ts:2077-2112`). All of these must use source `fields.loop` plus `edge.isLoopExit` instead.
- `shouldDisplayProtocolEditorEdgeLabel()` has a special Loop/prefix branch added to prevent exit labels from being dropped for non-Loop targets (`src/views/protocol-editor-view.ts:313-335`). Explicit exit metadata must preserve that behavior without stripping an ordinary leading `+`.
- `NodePickerModal` includes Loop in its type union, labels, order, runtime graph branch, and protocol-record fallback to `headerText` (`src/views/node-picker-modal.ts:4-63,90-141`). Migrated looped Questions naturally follow the existing Question branch.
- English and Russian currently expose standalone Loop node-kind/default text, `headerText`, node-picker Loop, and the existing exit checkbox (`src/i18n/locales/en.json:45-106,256-260`, `src/i18n/locales/ru.json:45-106,256-260`). The exit-checkbox concept remains; standalone Loop labels are replaced by synchronized toggle and badge strings.

### Test surface
- Parser tests currently assert that both prefixed legacy `headerText` and canonical `headerText` produce a runtime `LoopNode`; these become compatibility-to-Question and optional-boolean round-trip tests (`src/__tests__/protocol-document-parser.test.ts:125-185`).
- Store tests already provide an in-memory vault and assert read/write side effects; this is the direct seam for first-read write-once, second-read no-write, and failure-without-rewrite coverage (`src/__tests__/protocol-document-store.test.ts:113-195`).
- Validator tests comprehensively pin `+` exit classification, legacy hints, empty captions, multiple exits, body classification, cycle exemption, and zero-edge errors (`src/__tests__/graph-validator.test.ts:203-389`). These fixtures must be recast around looped Questions and explicit edge flags.
- Editor helper tests pin plus insertion/removal and exit-label preservation across target kinds (`src/__tests__/protocol-editor-helpers.test.ts:101-113,204-235`). They are the direct regression surface for independent label and flag persistence.
- Runner tests pin prefix dispatch, body re-entry, caption stripping, quick exit, nested stacks, stepBack, and redo (`src/__tests__/runner/protocol-runner-loop-picker.test.ts:156-270`). Render tests exercise the picker with a `LoopNode` and should instead assert the looped-Question guard, Question prompt, explicit exit styling, and verbatim exit label (`src/__tests__/runner/render-loop-picker.test.ts:65-76`).

## Code References
- `src/graph/graph-model.ts:9-20` — Node-kind union containing canonical Loop and deprecated Canvas pair kinds.
- `src/graph/graph-model.ts:36-63` — Separate Question and Loop runtime interfaces.
- `src/graph/graph-model.ts:95-128` — Reusable loop frame, runtime node union, and edge model.
- `src/protocol/protocol-document.ts:63-103` — Canonical node fields and serialized edge record.
- `src/protocol/protocol-document.ts:149-164` — Shallow V1 envelope guard that admits raw legacy records.
- `src/protocol/protocol-document-parser.ts:27-55` — Kind gate and typed field-normalization helpers.
- `src/protocol/protocol-document-parser.ts:85-138` — Document-to-graph conversion and explicit edge reconstruction.
- `src/protocol/protocol-document-parser.ts:155-245` — Semantic kind gate and per-kind runtime conversion.
- `src/protocol/protocol-document-store.ts:34-82` — Common read seam, mutex-protected write, and read-then-write update.
- `src/graph/node-label.ts:53-101` — Label predicate, `+` exit predicate, and prefix stripping.
- `src/graph/graph-validator.ts:102-158` — Question dead-end and Loop exit/body checks.
- `src/graph/graph-validator.ts:232-268` — Intentional-cycle exemption keyed to standalone Loop.
- `src/runner/protocol-runner.ts:243-361` — Branch choice plus stepBack/redo snapshot behavior.
- `src/runner/protocol-runner.ts:715-807` — Ordinary Question halt and standalone Loop entry/re-entry.
- `src/runner/protocol-runner.ts:855-881` — Node-kind-independent dead-end return to loop picker.
- `src/runner/render/render-loop-picker.ts:16-64` — Picker node guard, prompt, captions, styles, and callback.
- `src/views/protocol-editor-view.ts:246-335` — Node defaults, editable kinds, plus-label helpers, and label-display policy.
- `src/views/protocol-editor-view.ts:561-580` — Editor's direct store-load boundary.
- `src/views/protocol-editor-view.ts:929-984` — Canvas node rendering and accessibility attributes.
- `src/views/protocol-editor-view.ts:2025-2112` — Edge modal's current prefix facade and save/reload flow.
- `src/views/protocol-editor-view.ts:2127-2451` — Generic node-edit controls and field persistence.
- `src/views/node-picker-modal.ts:4-141` — Standalone Loop option surfaces for graph and protocol records.
- `src/views/inline-runner-modal.ts:147-180` — Raw vault reread and parser invocation.
- `src/views/inline-runner-modal.ts:501-519,805-844` — Picker host wiring and flat note-delta append.

## Integration Points

### Inbound References
- `src/views/protocol-editor-view.ts:561-580` — Loads editor documents through `ProtocolDocumentStore.read()` and assigns editor state only after a non-null result.
- `src/main.ts:266-289` — Loads protocol records through the same store before constructing start-from-node options and opening the runner.
- `src/views/inline-runner-modal.ts:147-180` — Rereads the persisted file directly and sends raw JSON through `ProtocolDocumentParser`.
- `src/views/inline-runner-modal.ts:501-519` — Renders `AWAITING_LOOP_PICK` through `renderLoopPicker()`.
- `src/views/node-picker-modal.ts:90-141` — Converts runtime graphs and serialized records into startable-node options.

### Outbound Dependencies
- `src/protocol/protocol-document.ts:9` — Serialized node kinds depend on the graph-layer `RPNodeKind` type.
- `src/protocol/protocol-document-parser.ts:5-24` — Parser constructs graph-layer runtime types and uses injected i18n.
- `src/protocol/protocol-document-store.ts:5-15` — Store depends on Obsidian vault APIs, `WriteMutex`, vault utilities, and the document envelope guard.
- `src/graph/graph-validator.ts:6-8` — Validator depends on shared label predicates and injected translation.
- `src/runner/protocol-runner.ts:6` — Runner currently imports the label-derived exit predicate.
- `src/runner/render/render-loop-picker.ts:3-6` — Picker depends on graph edges, shared labels, runner state, and DOM helpers.

### Infrastructure Wiring
- `src/main.ts:32-54` — Plugin owns and constructs the singleton `ProtocolDocumentStore` used by views and commands.
- `src/protocol/protocol-document-store.ts:22-28` — Store owns its per-path `WriteMutex`.
- `src/views/protocol-editor-view.ts:2426-2451` — Node saves use store `update()` and then reload the protocol.
- `src/views/protocol-editor-view.ts:2077-2112` — Edge saves use store `update()` and reload after persistence, preserving the prior stale-state fix.

## Architecture Insights
- Canonical and compatibility types must be separate. `'loop'` can disappear from `RPNodeKind` while remaining an accepted raw V1 wire literal at migration/parser boundaries because the top-level guard is intentionally shallow.
- Parser compatibility and durable migration serve different roles: the pure parser can normalize legacy input without side effects, while the store-level migration makes the canonical form durable before any later raw vault read.
- The migration discriminator should be the exact legacy node shape, not document version or label syntax. Version remains `1`, and global `+` scanning would reinterpret unrelated user-authored labels.
- One structural predicate should define each concept across layers: `Question.loop === true` identifies loop behavior; `edge.isLoopExit === true` identifies exit behavior. Keeping a prefix fallback would create two sources of truth.
- The loop FSM is reusable because state and frames carry IDs and primitives rather than node-specific prompt data. The merge changes recognition, not the state topology.
- Editor authoring and migration must converge on the same serialized shapes so reopened migrated records behave exactly like newly authored looped Questions.
- The selected store-level migration introduces a read side effect and interacts with `update()`'s read-then-write behavior. This is the main persistence detail for downstream design to make explicit.
- User-authored question text and edge labels remain direct content. Only toggle/badge/control labels and validator messages belong in i18n.

## Precedents & Lessons
Four similar change families were analyzed.

### Precedent: Excise a node type across layers
**Commit(s)**: `8185dbb` — "feat(46-01): GREEN - excise free-text-input type; parser rejects legacy canvases with Russian error" (2026-04-18); `8b8b5e5` — "feat(46-02): CLEAN-03 - excise free-text-input from color map, runner, views, picker (6 files)" (2026-04-18)

**Blast radius**: 9 files across graph, parsing, validation, runner, views, and picker surfaces.

**Follow-up fixes**:
- `1dadc67` — "refactor: remove legacy loop-start/loop-end and free-text-input from ProtocolDocumentParser" (2026-05-13) — parser cleanup landed weeks after the initial type removal.
- `6229b6d` — "fix(writer): remove legacy loop-start/loop-end cases, add default fallback" — a then-existing writer path also retained stale cases; no protocol writer exists in the current tree.

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md` — current feature intent and migration constraints.

**Takeaway**: Node-kind removal requires an exhaustive production-and-test symbol sweep; model removal alone does not expose stale parser/view branches.

### Precedent: Introduce and propagate the `+` exit convention
**Commit(s)**: `4fce768` — "feat(49-01): add shared node-label module with isLabeledEdge/isExitEdge" (2026-04-19); `e531216` — "feat(50.1-01): redefine isExitEdge + add stripExitPrefix (GREEN)" (2026-04-19); `f4effe5` — "refactor(49-02): rewire LOOP-04 to isLabeledEdge + delegate nodeLabel to shared util" (2026-04-19); `98df8ee` — "refactor(49-03): swap ProtocolRunner.chooseLoopBranch dispatch to isExitEdge()" (2026-04-19)

**Blast radius**: initially 3 core files, then editor, render, and tests as the convention propagated.

**Follow-up fixes**:
- `50a7fcb` — "Fix: preserve '+'-prefixed loop exit edge labels regardless of target node kind" (2026-05-17) — save logic could drop the label and thereby remove control-flow meaning.
- `f5850c0` — "Fix: re-render protocol editor after edge save so saved label/exit state is visible on re-open" (2026-05-18) — stale editor state required a reload after save; that reload remains at `src/views/protocol-editor-view.ts:2112`.
- `0ff2587` — "fix: loop edge label save, inline runner layout, font consistency" (2026-05-17) — another loop label persistence correction.

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md` — explicit decision to decouple control flow from labels.

**Takeaway**: Replacing the overloaded label removes a demonstrated failure class, but every validator, runner, render, editor-save, and test consumer must move together.

### Precedent: Add loop-exit editor UI and multiple exits
**Commit(s)**: `8de1582` — "fix: protocol editor edge interaction, labels, loop exit UI, and canvas scrollbars (for beta.6)" (2026-05-12); `f0fdec9` — "chore: release 1.16.0-beta.7 — loop-exit UI, multiple loop exits, infinite canvas, minimap" (2026-05-12)

**Blast radius**: views, styles, both locale files, validator, runner, and loop-picker tests.

**Follow-up fixes**:
- `50a7fcb`, `f5850c0`, and `0ff2587` corrected save, reload, and label-preservation regressions.

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md` — reuses the existing edge checkbox rather than introducing a second exit control.

**Takeaway**: Preserve the existing edge-modal interaction and reload behavior, but bind it to structural metadata and retest save/reopen state.

### Precedent: Quick-exit through a body Answer
**Commit(s)**: `478af29` — "fix: button text wrap + quick-exit from loop via answer wired to exit target" (2026-05-05)

**Blast radius**: runner core, runner tests, inline styles, and release metadata.

**Follow-up fixes**: none identified for the quick-exit algorithm itself.

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md` — requires quick-exit behavior to remain unchanged.

**Takeaway**: Generalize the existing top-frame/exit-target test rather than replacing quick exit with a new traversal path.

### Composite Lessons
- Type removal is complete only when type unions, parsers, validators, state machines, renderers, editor defaults/modals, pickers, locale keys, fixtures, and source-regression tests agree (`8185dbb`, `1dadc67`).
- Overloading label text as control metadata produced repeated persistence bugs (`50a7fcb`, `f5850c0`, `0ff2587`); explicit edge state is the safer canonical source.
- Save/reopen tests are load-bearing because editor rendering previously retained stale edge state (`f5850c0`).
- Behavior-preserving runner changes should extend the existing quick-exit, nested-loop, and undo suites rather than introduce parallel state (`478af29`).
- English and Russian changes landed together in the prior loop-exit UI precedent and must remain synchronized (`8de1582`).

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md` — FRD for the Loop-to-Question merge.
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md` — prior runner/editor cleanup research.
- `.rpiv/artifacts/plans/2026-07-27_17-12-43_runner-cleanup-nodes-snippets-modal-ux.md` — prior runner/editor cleanup plan.

## Developer Context
**Q (discover: Preserve current Loop behaviors (flat output, user-driven exit, body = graph edges)): Which Loop behaviors remain unchanged?**
A: Preserve flat output, user-driven exit, and ordinary outgoing graph edges as the body; replace the `+` exit-label convention separately.

**Q (discover: Replace `+`-prefix exit labels with explicit `isLoopExit` edge property): How are loop exits represented?**
A: Use explicit `isLoopExit: boolean`; migrate `+`-prefixed outgoing legacy Loop edges and strip the prefix from their displayed labels.

**Q (discover: Backward compatibility / migration strategy): How are existing `.rp.json` documents handled?**
A: Auto-migrate on open and remove standalone `loop` from the canonical `RPNodeKind`.

**Q (discover: Loop toggle data model + prompt field consolidation): How is looping represented on Question?**
A: Add `loop?: boolean`; use `questionText` as the only prompt; remove `LoopNode` and `headerText`; migrate `headerText` into `questionText`.

**Q (discover: Author-facing loop UI (checkbox vs icon)): How does an author enable and recognize looping?**
A: Provide a Question edit-panel checkbox and a canvas icon/badge.

**Q (discover: Validator keyed on loop flag): How does loop validation identify nodes?**
A: Reuse the existing exit/body validation for Questions whose loop flag is true; non-loop Questions skip it.

**Q (discover: Reuse runner state + render for looped Questions): Does the merge add runner state?**
A: No. Reuse `awaiting-loop-pick`, `LoopContext`, and `render-loop-picker.ts`, keyed on the Question loop flag.

**Q (discover: Remove `+`-prefix convention fully): Is a prefix fallback retained?**
A: No. Remove prefix helpers and rewire all consumers; migration is the only legacy bridge.

**Q (discover: Node picker + i18n (en + ru)): What authoring/i18n cleanup is required?**
A: Remove standalone Loop from node pickers and add matching loop-toggle/canvas-icon strings to both locales.

**Q (`src/views/protocol-editor-view.ts:561-580`, `src/main.ts:266-289`, `src/views/inline-runner-modal.ts:147-180`): Where should migration run so every read path sees the canonical document?**
A: Run it in `ProtocolDocumentStore.read()` and persist before returning.

**Q (`src/graph/node-label.ts:79-81`, `src/graph/graph-validator.ts:123-149`, `src/runner/protocol-runner.ts:265-269,743-754`): Are any in-the-wild standalone-Loop exit encodings known besides the `+` prefix?**
A: No alternate encoding is known; migrate only the `+` convention and retain no fallback.

## Related Research
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md`

## Open Questions
None. Both discover-stage open questions were resolved during the developer checkpoint.
