---
date: 2026-08-02T11:56:59+0300
author: Roman Shulgha
commit: 8e3ab6b
branch: main
repository: RadiProtocol
topic: "Author-configurable selection-option display order in the Runner"
tags: [research, codebase, runner, protocol, views, graph]
status: ready
last_updated: 2026-08-02T11:56:59+0300
last_updated_by: Roman Shulgha
---

# Research: Author-configurable selection-option display order in the Runner

## Research Question
Protocol authors need tooling to express a meaningful display order for a question's selection options (clinically sensible order: severity, chronology, anatomy), and radiologists benefit from options appearing in that order in the Runner. Today the display order is an accident of the `.rp.json` `edges` array order, grouped answers → question-transitions → snippets, with no authoring surface to change it. The FRD (`.rpiv/artifacts/discover/2026-08-02_11-40-35_option-display-order.md`) fixes the shape: an optional per-question `optionOrder: string[]` (outgoing edge-id list), a draggable chip list in the Question node edit modal, and ordered rendering in the Runner with today's grouped edges-array rendering as the fallback.

## Summary
The feature threads one optional field through four layers, and every layer already contains the exact mechanism needed — this is an additive feature with no new dependencies and no schema-version bump.

- **Runtime type**: `QuestionNode.optionOrder?: string[]` in `graph/graph-model.ts:32-45`; the existing optional field `loop` (`:44`) is the direct precedent for the getter/extraction/test pattern.
- **On-disk schema**: `optionOrder` is one more key in `ProtocolNodeRecord.fields` (`src/protocol/protocol-document.ts:87`, a `Record<string, unknown>` of flat camelCase keys). `PROTOCOL_VERSION` stays 1; unknown fields already parse silently, so old files are untouched.
- **Parser**: a new `getOptionalStringArray` getter beside the existing family (`protocol-document-parser.ts:36-67`). **Structural constraint**: `parseDocument()` is two-pass (nodes `:99-107`, edges `:117-139`), so `parseNode()` is edge-id-blind at extraction time — unknown/deleted edge ids **cannot** be validated in the parser. They are preserved losslessly in the document and become inert only in a post-parse projection over `graph.edges`.
- **Ordered projection** (developer-decided: new pure module in `graph/`, e.g. `src/graph/edge-order.ts`): `optionOrder` + `graph.edges` + questionId → ordered outgoing `RPEdge[]`, dropping stale/non-outgoing/duplicated/malformed ids and appending unlisted current edges at the end. This unifies the one inconsistency in today's render: answers/snippets are adjacency-keyed (`render-question.ts:48-56`) while question-transitions are edge-keyed (`:72-77`).
- **Runner render**: a branch on `node.optionOrder` presence in `render-question.ts` (interleaved single-stack pass reusing per-kind button construction byte-for-byte) and a reorder of the already-edge-keyed `outgoing` array in `render-loop-picker.ts:44-46`. Both renderers dispatch by `edge.id` (never position), so ordering is display-only by construction.
- **Skip**: `skip()` currently scans adjacency for the first answer-kind neighbor (`protocol-runner.ts:147-152`). With `optionOrder` present it resolves each entry through `graph.edges.find` (same pattern as `:250`, `:297`), kind-filters `answer`, and takes the first hit; per developer decision, a present-but-answerless `optionOrder` falls back to today's adjacency scan.
- **Editor UI**: reuse `mountChipEditor` from `snippet-chip-editor.ts:75-104` (in-place draft mutation, splice-based DnD at `:333-334`, `destroy()` at `:494-500`) inside the Question node modal's `textControls` read-later closure (`protocol-editor-view.ts:2176-2224`), persisting through the existing save mutator (`:2417-2487`) → `protocolDocumentStore.update`. Chip labels come from `deriveProtocolEditorEdgeLabel`/`defaultProtocolEditorEdgeLabelForTarget` (`protocol-editor-view.ts:290-343`) which operate on on-disk `ProtocolNodeRecord` — **no views→runner import needed**, the dependency rule holds.
- **Persistence**: `protocolDocumentStore.update` (`protocol-document-store.ts:86-94`) is read-modify-write; `write()` (`:67-79`) serializes per-path via `WriteMutex`. FR-6 (append new edges) mutates the source question's `fields` **inside the same mutator** that appends the edge; the `{ ...existing }` spread preserves all unrelated metadata.

## Detailed Findings

### Runtime type — `QuestionNode` (`src/graph/graph-model.ts`)
- `QuestionNode` at `graph-model.ts:32-45`: `kind: 'question'` (`:33`), `questionText: string` (`:34`), `loop?: boolean` (`:44`). `optionOrder?: string[]` slots beside `loop` with no type-union changes (`RPNode` union untouched).
- `ProtocolGraph` at `graph-model.ts:133-140`: `edges: RPEdge[]` preserves document edge order (`:136`), `adjacency`/`reverseAdjacency` (`:137-138`) are target-node-id arrays pushed in the same edge order. Both orders agree — adjacency order == edges-array order per source node.
- `ParseResult` at `graph-model.ts:141-143`: `{ success: true; graph } | { success: false; error: string }` — the never-throw contract; consumers check `success` before `.graph`.

### On-disk schema (`src/protocol/protocol-document.ts`)
- `ProtocolNodeRecord` at `protocol-document.ts:63-88`; `fields: Record<string, unknown>` at `:87` with JSDoc enumerating today's keys (`:80-86`) — `optionOrder` joins this list. Flat camelCase, no prefix.
- `ProtocolDocumentV1.nodes`/`.edges` doc comment "order is not semantically significant" at `protocol-document.ts:36-38` — **FR-10 target**: must be updated once `optionOrder` exists.
- `isProtocolDocumentV1` validates schema/version/sentinels only — a `fields.optionOrder` array passes untouched.

### Parser extraction (`src/protocol/protocol-document-parser.ts`)
- Getter family at `protocol-document-parser.ts:36-67`: `getCompatValue` (`:36-40`, `!== undefined` test — explicit value suppresses legacy `radiprotocol_*` fallback), `getString` (`:42-45`), `getOptionalString` (`:47-50`), `getSeparator` (`:52-55`), `getOptionalBoolean` (`:64-67`, three outcomes `true`/`false`/`undefined` — the semantic model for a new `getOptionalStringArray`).
- Question case at `protocol-document-parser.ts:203-211`: `questionText` (`:207`), `loop` (`:208`). A new getter call beside these.
- State mapping for `fields.optionOrder`:
  - **absent** → `undefined` (no explicit order → fallback), indistinguishable from never-having-the-field;
  - **valid `string[]`** → array verbatim, **including unknown/deleted ids** (preservation is at the document level; the parser is read-only, so the on-disk entry always survives);
  - **`[]`** → `[]` (distinct from `undefined` — round-trip fidelity; explicit empty is a present value);
  - **non-array** (`42`, `"e1,e2"`, object, `null`) → `undefined` (whole-field type violation, mirroring `getOptionalBoolean`'s non-boolean → undefined at `:64-67`);
  - **array with non-string elements** → `undefined` (strict whole-field reading, consistent with the getter family) — never a `parseError`, never a throw.
- Two-pass structure at `protocol-document-parser.ts:99-107` (node loop) then `:117-139` (edge loop, `edges.push` at `:126-131`, adjacency append at `:133-135`, reverse at `:137-139`). `parseNode` therefore cannot resolve ids against edges — **the projection must be a post-pass over the completed graph** (architectural, not incidental).
- Never-throw chain: `parse()` wraps `JSON.parse` in try/catch (`:80-86`), schema gate `:88-90`, `parseNode` returns `null` (untyped `:167`) or `{ parseError }` (`:170`, `:177`, `:181`), collected into `parseErrors[]` (`:102-111`).
- Parser test anchors (`src/__tests__/protocol-document-parser.test.ts`): `:85` absence baseline (must assert `optionOrder` is `undefined`), `:191-206` loop 3-state template (asserts `true`/`false`/absent/`'true'`-string → undefined), `:123` legacy-key preference, `:176` looped question coexistence, `:273` adjacency-in-edge-order (the fallback basis), `:283` edges-referencing-missing-nodes skipped (the stale-id inertness model).

### Ordered-edge projection (new `graph/` module — developer decision)
Pure read-time helper: take `optionOrder?: string[]`, `graph.edges`, questionId →
1. collect current outgoing edges in edges-array order (`graph.edges.filter(e => e.fromNodeId === questionId)` — identical to the existing filters at `render-loop-picker.ts:45` and `render-question.ts:74-77`);
2. index by id into a `Map`;
3. iterate `optionOrder`: emit listed entries in order, dropping non-string entries (malformed), ids not in the map (stale **and** non-outgoing in one test), and duplicates;
4. append unlisted current edges at the end, in edges-array order — the read-path counterpart of FR-6 ("append at end"), guaranteeing every current outgoing edge stays reachable even in hand-edited files.
- `optionOrder: []` with edges present degenerates to "everything appended, ungrouped" — the one state where `[]` vs absent visibly differ at render.
- `undefined` (absent) → skip the projection entirely; every consumer keeps today's code path verbatim (byte-identical fallback).

### Runner render — ordinary questions (`src/runner/render/render-question.ts`)
- `renderQuestionAtNode` at `render-question.ts:21-121` (`:21-27` signature `(textZone, actionZone, graph, state, host)`; guards `graph === null` `:28-31`, node missing `:33-37`, `kind !== 'question'` `:38-40`). `QuestionBranchHost` contract `:13-19`.
- Question text `:42-45` (textZone, unaffected by ordering).
- Answers/snippets from adjacency at `:47-56`: `graph.adjacency.get(currentNodeId) ?? []` (`:48`), partitioned by neighbor kind into `answerNeighbors`/`snippetNeighbors` (`:51-56`). Node-id keyed, adjacency order.
- Question transitions from edges at `:72-77`: `graph.edges.filter(...)` preserving `graph.edges` array order — the comment at `:72-73` states the invariant ("preserve persisted edge order, caption, and identity").
- Three grouped DOM blocks (the fallback structure): answers `:58-70` (`rp-answer-list rp-stack`, `rp-answer-btn`, caption `displayLabel ?? answerText`, `onChooseAnswer(answerNode)` full node); transitions `:79-100` (`rp-question-transition-list`, `rp-question-transition-btn`, caption `edge.label` else `nodeLabel(target).trim() || edge.toNodeId`, `onChooseQuestionBranch(edge)` full edge); snippets `:102-118` (`rp-snippet-branch-list`, `rp-snippet-branch-btn`, caption `snippetBranchLabel(snippetNode)`, `onChooseSnippetBranch(snippetNode, isFileBound)`).
- Interleaved path (optionOrder present): iterate the projection's ordered edge list, dispatch each edge's target kind to the **same** per-kind button construction (`:62-68` answers, `:85-98` transitions, `:109-116` snippets) — CSS class, caption source, and callback payload preserved byte-for-byte; only the container/iteration order changes. The three-group list divs and margin-top rules (`:60`, `:81-83`, `:105-107`) are the structural artifacts an interleaved single-stack rendering replaces.
- Branch point: `if (node.optionOrder === undefined)` must run the current code verbatim.
- Caption helpers: `snippetBranchLabel` at `src/runner/snippet-label.ts:11-26` (`isFileBoundSnippetNode` `:5-9`; `📄`/`📁` prefixes, stem fallback); `nodeLabel` at `src/graph/node-label.ts:18-46` (question arm `:21` `questionText || id`, answer arm `:22` `(displayLabel ?? answerText) || id`).
- Baseline pinned by `src/__tests__/runner/render-question.test.ts:101-161`: exact three-group child `cls` order `:135-139`, captions `:140-149`, callback payloads `:152-160` (`onChooseQuestionBranch` called with edges in `graph.edges` order).

### Runner render — loop picker (`src/runner/render/render-loop-picker.ts`)
- `renderLoopPicker` at `render-loop-picker.ts:18-67`; `LoopPickerHost` `:12-16`. Guards: graph null `:25-28`, node missing / not question / `!node.loop` `:30-34` (with `renderError`).
- Single ordering hook at `:44-46`: `const outgoing = graph.edges.filter(e => e.fromNodeId === state.nodeId)` (comment `:44` documents "Pitfall 4 — filter edges, not adjacency") into one `rp-loop-picker-list rp-stack-md` container. Reordering `outgoing` by the projection before the `for` loop at `:47` reorders buttons and nothing else — the FRD "no visual design change" holds because there is no body/exit grouping to break.
- Per-edge rendering `:47-65`: `isLoopExit` classification `:52` (edge metadata only), body caption `nodeLabel(target)` `:54`, `aria-label` fallback for blank captions `:55`, exit caption verbatim `edge.label ?? ''` `:56`, cls `rp-loop-exit-btn`/`rp-loop-body-btn` `:58`, `aria-label` attr when caption blank `:60`, callback `onChooseLoopBranch(edge, exit)` `:62-64`. All per-edge and position-independent.
- Dispatch: `ProtocolRunner.chooseLoopBranch` at `protocol-runner.ts:293-336` re-finds by `edge.id` (`:297`, doc comment `:287-289`: "Only edgeId is unambiguous"), validates `fromNodeId` (`:298-303`), pops loop frame on `isLoopExit` (`:315-319`), then `advanceThrough(edge.toNodeId)` (`:333-335`). Loop-frame increment happens in `advanceThrough`'s `case 'question'` (loop === true) at `protocol-runner.ts:781-800`.
- Baseline pinned by `src/__tests__/runner/render-loop-picker.test.ts:197-238` (button order = `outgoing` array order, call order at `:227-228`) and `:277-306` (blank-label accessibility: unlabeled exit → visible `''` + `aria-label` from `nodeLabel`; whitespace label preserved verbatim).

### Skip auto-advance (`src/runner/protocol-runner.ts`)
- `skip()` at `protocol-runner.ts:139-173`: guards status `AT_NODE` (`:140`), graph/node (`:141`), kind question (`:143-144`); **selection scan** `:147-152` — iterate `graph.adjacency.get(currentNodeId) ?? []` (`:147`), first target whose node `kind === 'answer'` (`:151`), else no-op (`:153`). No `graph.edges`, no `firstNeighbour`.
- Downstream hop `:166-167`: `adjacency.get(skipTargetId)?.[0]` — the same inlined first-neighbor idiom as `chooseAnswer()` (`:104-110`) and `completeSnippet()` (~`:417-423`). Not kind-filtered; dead-end → `advanceOrReturnToLoop(undefined)` (`:168-170`, defined `:901-919`).
- FR-8 implementation (optionOrder present): resolve each entry via `graph.edges.find(e => e.id === entryId)` (same pattern as `:250` in `chooseQuestionBranch` and `:297` in `chooseLoopBranch`), take `toNodeId`, filter `kind === 'answer'`, plus a `fromNodeId === currentNodeId` guard (mirrors `:251`); stale ids yield no `toNodeId` and are skipped silently. **Developer decision**: if the authored order yields zero answer edges, fall back to today's adjacency scan (`:147-152`) rather than no-op.
- `firstNeighbour()` at `protocol-runner.ts:921-927`: private, returns `adjacency.get(nodeId)?.[0]`, called only from `advanceThrough()` — `case 'start'` `:758`, `case 'text-block'` `:773`, `case 'answer'` `:823`. **Unrelated to skip** (skip never calls it); adjacency-order-dependent auto-advance paths flagged by the FRD's Suggested Follow-ups for a separate consistency audit.
- Skip button visibility at `src/views/inline-runner-modal.ts:494-501` re-implements the answer-existence check on adjacency — the authored-order change to `skip()` does not affect button gating.
- Skip suite `src/__tests__/runner/protocol-runner-skip.test.ts:97-281`: `:98` idle no-op, `:112` wrong-status no-op, `:171` first-answer-in-adjacency + no text append, `:216` snippet-ignore (kind override), `:247` zero-answer no-op, `:270` step-back roundtrip. The test factory builds graphs with `edges: []` (`:91`) so no existing test constructs transitions or an `optionOrder`.

### Editor chips — labels (`src/views/protocol-editor-view.ts`)
- `defaultProtocolEditorEdgeLabelForTarget(node)` at `protocol-editor-view.ts:290-303`: answer arm `:292-294` (`displayLabel`, `answerText`, `text` — first non-empty, trimmed), snippet arm `:295-297` (`snippetLabel`, `text`), question/other → `undefined` (`:298-302`). Operates on `ProtocolNodeRecord`; never calls `t()`.
- `deriveProtocolEditorEdgeLabel(targetNode, currentLabel)` at `:338-343`: authored non-blank `edge.label` wins (`:340-341`), else delegate to `defaultProtocolEditorEdgeLabelForTarget` (`:343`). Used for canvas SVG labels (`:1081-1082`), edge creation (`:870`, `:1460`), and save-time auto-refresh (`:2451-2464`).
- `shouldDisplayProtocolEditorEdgeLabel` at `:312-336` — loop-exit edges always displayed (`:321-325`), loop-body edges hidden (`:326-334`).
- Chip caption per kind: answers → `defaultProtocolEditorEdgeLabelForTarget` answer arm; question transitions → authored label, else question-derived fallback (`fields['questionText'] ?? text ?? id` — the `nodeLabel` question arm equivalent); snippet branches → raw `snippetLabel`/`text` (the un-prefixed value the editor persists onto the edge); loop bodies → hidden on canvas but a chip falls back to question-derived; loop exits → authored label else `undefined` → blank chip (matching runner's `edge.label ?? ''`).
- **No forbidden dependency**: `snippetBranchLabel` (runner layer) is emoji-decoration over the persisted label; the editor stores and reads the raw value, so views never import runner. `nodeLabel` lives in the graph layer and is importable from views anyway. `openEditModal` receives the on-disk record (`:2142`) and `this.doc.edges` is in scope — outgoing edges are `doc.edges.filter(e => e.fromNodeId === node.id)` (same shape as `render-loop-picker.ts:45`).

### Editor chips — interaction (`src/views/snippet-chip-editor.ts`)
- `mountChipEditor(container, draft, onChange, options): ChipEditorHandle` at `snippet-chip-editor.ts:75-79`; caller-owned draft mutated **in place** (module contract `:1-13`), `onChange()` after every user-visible mutation; `options` carries `skipName`/`t` (`:51-73`); handle exposes only `destroy()` (`:38-41`, impl `:494-500`) which detaches tracked listeners and empties the container.
- Listener tracking via `on`/`onRaw` closures (`:86-99`) pushing `{el, type, handler}` tuples.
- DnD sequence at `:286-340`: chip `draggable='true'` + drag handle span `:291-293` (glyph `⠿`, `aria-label` from `t('snippetEditor.dragReorderAria', { label })` — `en.json:143`); `dragstart` `:310-311` (`dataTransfer.setData('text/plain', dragIndex)`); `dragover`/`dragenter` `:313-318` (`preventDefault` + `.drag-over` class); `dragleave` `:321-322` (guarded by `contains(relatedTarget)`); `drop` `:325-336` (splice-based reorder `:333-334`, then rerender `:335` + `onChange` `:336`); `dragend` cleanup `:338-340`.
- Adaptation into the Question modal: a closure-held draft (`let draftOptionOrder: string[]`) + a `textControls` entry `{ key: 'optionOrder', value: () => draftOptionOrder.length > 0 ? [...draftOptionOrder] : undefined }` inside `openEditModal`'s read-later pattern (`protocol-editor-view.ts:2176-2224`, `addInput` at `:2178-2196`). **Developer decision**: empty draft → omit key on save (the `textControls` loop at `:2419-2423` deletes keys whose value reads `undefined`). The fresh `[...draft]` copy prevents DOM mutation of the persisted array.
- Modal lifecycle: `switch (node.kind)` at `protocol-editor-view.ts:2371-2394` (question → `questionText` input `:2373` + `addLoopToggle` `:2374`; chips slot into the `question` case only); teardown via `modalEl.remove()` (`:2158`) — or a reused `mountChipEditor` handle's `destroy()`.

### Edge lifecycle & persistence (`src/views/protocol-editor-view.ts`, `src/protocol/protocol-document-store.ts`)
- `edgeUid()` at `protocol-editor-view.ts:351-353`: `` `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` `` — pure nonce, no node/content participation. Ids survive edge-source reassignment (edge modal rewrites in place by id at `:2119-2121`), which is why `optionOrder` is an **edge-id** list, not a target-id list.
- Edge append mutators (all read-modify-write inside `protocolDocumentStore.update`):
  - `addNodeAndConnectAtWorldPoint` at `:850-892` (`update` at `:866`, `newEdge` `:876-881`, append `:883`, `{ ...existing, nodes, edges, viewport, updatedAt }` `:885-891`);
  - `finishConnectionDrag` at `:1428-1484` (`update` at `:1473-1477`, pre-check uses stale `this.doc` `:1448` but mutator re-validates `:1475-1476`; `loadProtocol` reload after write `:1480`).
  - **FR-6**: append the new edge id to the source question's `fields.optionOrder` **inside the same mutator** that appends the edge (both sites above), so edge + order delta commit atomically in one write. The `{ ...existing }` spread preserves every other node/edge/metadata field.
- Edge modal save at `:2086-2129` — contains the **sole existing precedent for a node `fields` write inside an edge-lifecycle mutator**: snippet-target `fields.snippetLabel` rewrite at `:2106-2118` (`fields: { ...candidate.fields, snippetLabel: typedLabel }`). Source-reassignment (`:2119-2121`) keeps the edge id stable; a reassigned edge id already in the old source's `optionOrder` is deliberately retained (stale-id retention is the default — FR-9).
- Removal: `removeProtocolEditorEdge` `:374-378` (pure id filter), `deleteEdge` `:1296-1307` (mutator, never touches node `fields`); node deletion `:2488-2493` (removes node + incident edges, no `optionOrder` scrub). Stale ids are **filtered on read**, never cleaned on write.
- Persistence: `ProtocolDocumentStore.update` at `protocol-document-store.ts:86-94` (read `:90` → mutator `:91` → write `:92`); `write()` at `:67-79` runs `ensureFolderPath` (`:70-73`) + `JSON.stringify(doc, null, 2) + '\n'` (`:76`) inside `this.mutex.runExclusive` (`:68`). `WriteMutex` (`src/utils/write-mutex.ts:13-24`) is a per-path `Map<string, Mutex>` → `async-mutex` `runExclusive` — disk writes for a path are serialized, never torn. `read()` may itself trigger a migration write (`protocol-document-store.ts:52-55`) — `update()` can do two mutex-protected writes.
- Known race (pre-existing, mostly theoretical): the node-modal save replaces the whole node record from a modal-open snapshot (`protocol-editor-view.ts:2418`, `:2448`), so a concurrent edge-append that rewrites the **same** question node's `fields` while the modal is open would be clobbered — but the modal backdrop blocks drag/create today, and the viewport debounce save (`:2005-2019`) only touches `viewport`. FR-6 mutator work keeps the window unchanged.
- Regression map: `src/__tests__/protocol-document-store.test.ts:257-265` (mutex serialization), `:268-292` (update applies mutator); `src/__tests__/views/protocol-editor-keyboard.test.ts:694-1076` (fields persistence incl. loop-toggle `fields.loop === true` at `:1008+`); parser/render/skip suites as cited above.

## Code References
- `src/graph/graph-model.ts:32-45` — `QuestionNode` runtime type; `optionOrder?: string[]` slots beside `loop` (`:44`)
- `src/graph/graph-model.ts:133-140` — `ProtocolGraph.edges`/`adjacency`/`reverseAdjacency` (document edge order)
- `src/graph/graph-model.ts:141-143` — `ParseResult` never-throw union
- `src/protocol/protocol-document.ts:63-88` — `ProtocolNodeRecord` + `fields: Record<string, unknown>` (`:87`)
- `src/protocol/protocol-document.ts:36-38` — "Order is not semantically significant" doc comment (FR-10 target)
- `src/protocol/protocol-document-parser.ts:36-67` — getter family; `getOptionalBoolean` 3-state model (`:64-67`) is the `getOptionalStringArray` template
- `src/protocol/protocol-document-parser.ts:95-143` — two-pass `parseDocument` (nodes `:99-107`, edges `:117-139`)
- `src/protocol/protocol-document-parser.ts:203-211` — question node case (optionOrder extraction point)
- `src/runner/render/render-question.ts:21-121` — `renderQuestionAtNode`; grouped answers `:58-70` / transitions `:79-100` / snippets `:102-118`
- `src/runner/render/render-question.ts:47-56` — adjacency-derived answer/snippet neighbors
- `src/runner/render/render-question.ts:72-77` — edge-derived `questionEdges` (persisted edge order)
- `src/runner/render/render-loop-picker.ts:44-46` — outgoing-edge filter + list container (single ordering hook)
- `src/runner/render/render-loop-picker.ts:47-65` — per-edge button rendering (isLoopExit `:52`, caption `:54-56`, aria `:60`, callback `:62-64`)
- `src/runner/protocol-runner.ts:139-173` — `skip()` selection scan `:147-152`, downstream hop `:166-167`
- `src/runner/protocol-runner.ts:293-336` — `chooseLoopBranch` edge-id dispatch (`:297`), loop-frame pop `:315-319`
- `src/runner/protocol-runner.ts:921-927` — `firstNeighbour()` (flagged follow-up; unrelated to skip)
- `src/runner/snippet-label.ts:11-26` — `snippetBranchLabel` (runner-side snippet caption)
- `src/graph/node-label.ts:18-46` — `nodeLabel` shared caption switch
- `src/views/protocol-editor-view.ts:290-303` — `defaultProtocolEditorEdgeLabelForTarget` (chip caption source)
- `src/views/protocol-editor-view.ts:338-343` — `deriveProtocolEditorEdgeLabel`
- `src/views/protocol-editor-view.ts:351-353` — `edgeUid()` (edge identity)
- `src/views/protocol-editor-view.ts:2142-2508` — `openEditModal` (question case `:2371-2394`, save mutator `:2417-2487`)
- `src/views/protocol-editor-view.ts:2176-2224` — `textControls` read-later closure pattern
- `src/views/protocol-editor-view.ts:850-892` — `addNodeAndConnectAtWorldPoint` (FR-6 append site A)
- `src/views/protocol-editor-view.ts:1428-1484` — `finishConnectionDrag` (FR-6 append site B)
- `src/views/protocol-editor-view.ts:2106-2121` — edge-modal mutator: snippetLabel fields write precedent + source reassignment
- `src/views/snippet-chip-editor.ts:75-104` — `mountChipEditor` signature/draft/onChange contract
- `src/views/snippet-chip-editor.ts:286-340` — chip DnD sequence (splice reorder `:333-334`)
- `src/views/snippet-chip-editor.ts:494-500` — `destroy()` listener cleanup
- `src/protocol/protocol-document-store.ts:67-79` — `write()` per-path mutex + serialization
- `src/protocol/protocol-document-store.ts:86-94` — `update()` read-modify-write
- `src/utils/write-mutex.ts:13-24` — per-path `Map<string, Mutex>` → `runExclusive`

## Integration Points

### Inbound References
- `src/views/inline-runner-modal.ts:461` — `at-node` render dispatch → `renderQuestionAtNode`
- `src/views/inline-runner-modal.ts:517` — `awaiting-loop-pick` render dispatch → `renderLoopPicker`
- `src/views/inline-runner-modal.ts:494-501` — Skip button gating (adjacency answer scan; unaffected by optionOrder)
- `src/views/inline-runner-modal.ts:611` — Skip button click → `this.runner.skip()`
- `src/views/inline-runner-modal.ts:752-756` — answer click → `chooseAnswer`; `:469-473` transition click → `chooseQuestionBranch(edge.id)`; `:821-858` loop branch → `chooseLoopBranch(edge.id)`
- `src/views/protocol-editor-view.ts:2142` — Question node edit modal (chip list home)
- `src/protocol/protocol-document-parser.ts:95-143` — parses `fields.optionOrder` into runtime graph

### Outbound Dependencies
- `render-question.ts` → `graph.adjacency` / `graph.edges` / `nodeLabel` / `snippetBranchLabel` (all lower layers — no violation)
- `render-loop-picker.ts` → `graph.edges` / `nodeLabel`
- `protocol-runner.ts` → `graph.adjacency` / `graph.edges`
- `protocol-editor-view.ts` → `protocolDocumentStore.update` (chips + FR-6 appends)
- `snippet-chip-editor.ts` — reusable, no new deps (HTML5 DnD only)

### Infrastructure Wiring
- `src/protocol/protocol-document-store.ts:86-94` — the single persistence seam for chip-order and edge-append mutations
- `src/utils/write-mutex.ts:13-24` — per-path serialization guarantee
- `src/protocol/protocol-document-parser.ts:141-143` — `ParseResult` contract for never-throw extraction
- New module `src/graph/edge-order.ts` (developer decision) — pure ordered-projection helper shared by render-question, render-loop-picker, and skip

## Architecture Insights
- **Two-pass parser forces a post-pass projection** — `parseNode` is edge-id-blind by construction; stale/duplicate/non-outgoing filtering cannot live in the parser and must live in the shared graph-layer projection. This is architectural, not a parser shortcoming.
- **`getOptionalBoolean` 3-state model is the extraction template** — absent/valid/invalid → `undefined` collapse, explicit values preserved; `[]` stays distinct from `undefined` for round-trip fidelity.
- **Edge-id dispatch is the canonical selection contract** — both `chooseQuestionBranch` (`protocol-runner.ts:250-256`) and `chooseLoopBranch` (`:297`) re-find by `edge.id`; ordering never enters dispatch, so reordered display cannot alter traversal.
- **The render keying split is the one real inconsistency** — answers/snippets adjacency-keyed (`render-question.ts:48-56`) vs transitions edge-keyed (`:72-77`); the projection unifies both under edge-keying, which is exactly what enables the interleaved single pass.
- **Views never need a runner import for chip labels** — `deriveProtocolEditorEdgeLabel`/`defaultProtocolEditorEdgeLabelForTarget` operate on on-disk records; `snippetBranchLabel`'s emoji prefix is applied only at runner render time. The documented `render-snippet-picker.ts` exception stays the only cross-layer exception.
- **FR-6 atomicity = mutate fields inside the same `update()` as the edge append** — the `{ ...existing }` spread pattern preserves all unrelated metadata; `WriteMutex` guarantees the payload lands uncorrupted.
- **No runner-state/FSM changes** — the feature is metadata + render-order + a skip-scan indirection only; `ProtocolRunnerOptions` and `RunnerState` are untouched.
- **Stale-id inertness is free** — the parser drops edges referencing missing nodes (`protocol-document-parser.ts:125`) and all consumers filter live edges/adjacency; retained document entries never throw anywhere.

## Precedents & Lessons
5 similar past changes analyzed.

### Precedent: optional per-question fields across all layers (loop merge)
**Commit(s)**: `1dd1f78` — "feat: merge standalone loop node type into question via loop toggle and explicit isLoopExit edge flag" (2026-07-28)
**Blast radius**: ~30 files across 7 layers — `QuestionNode.loop`, `RPEdge.isLoopExit`, `ProtocolEdgeRecord` field, parser `getOptionalBoolean`, migration + store seam, runner runtime, render-loop-picker, editor modal checkbox, i18n, CSS, fixtures/tests.

**Follow-up fixes**:
- `073ed62` (2026-07-29), `519b1bb` (2026-07-31) — UX polish, no schema bugs

**Lessons from docs**:
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md` — save/reopen tests are load-bearing; editor retained stale edge state after save (`f5850c0`); EN+RU locales must change together

**Takeaway**: an optional field still demands parser + editor modal + runner render + tests to move as one atomic sweep; store `update()` is read-then-write, so persistence side effects must be explicit.

### Precedent: chip renderer + HTML5 DnD + auto-save
**Commit(s)**: `bf322c9` (2026-04-12, snippet-manager-view); `ddff1d2` — "feat(33-02): extract placeholder chip editor into reusable module" (2026-04-15, created snippet-chip-editor.ts)

**Follow-up fixes**:
- `9900a56` (2026-04-20) — chip click guard: clicks on inner inputs/detach controls bubbled up and collapsed the chip; needed `stopPropagation` + `closest('.rp-placeholder-expanded')` bail
- `d06c2da` (2026-05-01) — style migration fix; `7d17039` (2026-04-20) — narrowed chip editor to 2-type contract

**Takeaway**: splice-based reorder is the proven pattern, but drag/drop + click-handler edge cases (expanded regions, inner controls) bit once already — test them.

### Precedent: node-field additions/removals in graph-model/parser
**Commit(s)**: `02a2262` — "feat(31-01): extend SnippetNode with snippetLabel + separator" (2026-04-15); `b40a07f` — "feat(44-04): excise legacy maxIterations from graph-model, parser, editor-panel" (2026-04-17)

**Follow-up fixes**:
- `1dadc67` (2026-05-13) — parser cleanup landed weeks after type removal left stale branches

**Takeaway**: field changes leak stale parser/view/test branches; add sweep tests.

### Precedent: edge-label persistence regressions
**Commit(s)**: `0ff2587`, `50a7fcb` (2026-05-17), `f5850c0` (2026-05-18) — three consecutive fixes: label save dropped meaning, editor re-render stale after edge save.

**Takeaway**: optionOrder chips derive labels from edge-label logic — reload-after-save and save/reopen tests are mandatory.

### Precedent: picker/UX redesign regressions
**Commit(s)**: `b49d6cd` redesign (2026-06-14); `c0bb3ee` — "fix: address snippet-selection UX regressions" (2026-06-14). Plan: `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md`.

**Takeaway**: modal ownership/lifecycle regressions follow picker redesigns; keep the picker owned by the open node modal.

### Composite Lessons
- Save/reopen staleness is the #1 recurring failure — after any editor change persisting metadata, re-render/reload must be tested (`f5850c0`, `c0bb3ee`).
- Field changes propagate as one atomic sweep across parser, model, editor modal, runner render, tests — partial sweeps leave stale branches (`1dadc67`, `8185dbb`).
- DnD chip UI has proven click-handler edge cases (`9900a56`) — bail on expanded regions, stopPropagation on inner controls.
- Never-throw parser convention + silently ignoring stale ids keeps backward compatibility (matching validator precedent).

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-08-02_11-40-35_option-display-order.md` — the FRD for this exact feature: shape, goals, decisions, acceptance criteria
- `.rpiv/artifacts/research/2026-07-29_09-38-38_hide-start-picker-q-to-q-transitions.md` — why concrete `RPEdge` identity and persisted edge order matter for question-to-question transitions
- `.rpiv/artifacts/plans/2026-07-29_10-01-42_hide-start-picker-q-to-q-transitions.md` — plan for the above
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md` — loop-merge research (the closest cross-layer optional-field precedent)
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md` — snippet-selection UX regressions

## Developer Context
**Q (discover: Feature intent — who the feature serves): What problem is this solving, and who experiences the pain of the current fixed order today?**
A: "Both sides" — authors need the tooling to express order, radiologists benefit from the sensible result at run time.

**Q (discover: Default order fallback): Keep today's grouped edges-array rendering as fallback?**
A: Keep as fallback — `render-question.ts:47-66,72-75,84-96`; backward compatible.

**Q (discover: Schema mechanism): Proceed with an optional metadata field?**
A: Optional metadata field — `protocol-document.ts:103-129,36-38`; `PROTOCOL_VERSION` stays 1.

**Q (discover: DnD widget): Reuse the existing HTML5 chip-reorder pattern?**
A: Reuse chip pattern — `snippet-chip-editor.ts:287-338`; no new dependency.

**Q (discover: Editor home): Put the draggable chip list in the Question node edit modal?**
A: Node edit modal — `protocol-editor-view.ts:2372-2374`.

**Q (discover: Kinds covered): Which outgoing-connection kinds should the author be able to order?**
A: All labeled connections; loop picker (`render-loop-picker.ts:43-44`) also respects the authored order.

**Q (discover: Grouping semantics): Single global order across kind groups, or per-group?**
A: Single global order — one chip list is one order; interleaving kinds allowed.

**Q (discover: Storage shape): Per-edge number vs per-question edge-id list?**
A: Per-question edge-id list (`optionOrder: string[]` in question node fields) — atomic authoring, drag = splice (`snippet-chip-editor.ts:333-334`).

**Q (discover: Skip button behavior): Should Skip follow authored order or keep adjacency order?**
A: Follow authored order; adjacency-order behavior remains the fallback (`protocol-runner.ts:146-151`).

**Q (discover: New edges added later): Where does a new outgoing edge appear in an ordered question?**
A: Append at end — least-surprise default; no blocking validation.

**Q (discover: Stale optionOrder entries): How should stale entries be handled?**
A: Silently ignore — consistent with the never-throw validator convention (`src/graph/graph-validator.ts`).

**Q (`src/graph/edge-order.ts` — where should the shared ordered-edge projection live?): Needed by render-question, render-loop-picker, and skip across 2 layers.**
A: New pure module in `graph/` (e.g. `src/graph/edge-order.ts`) — importable by runner core and render without dependency violations; unit-testable without Obsidian.

**Q (`protocol-editor-view.ts:2419-2423` — how should the modal save an empty chip draft?): Parser keeps `[]` distinct from absence.**
A: Normalize empty → omit key (`length > 0 ? [...draft] : undefined`) — the `textControls` loop deletes undefined-valued keys; disk stays clean, absence == fallback.

**Q (`protocol-runner.ts:147-153` — FR-8 with a present-but-answerless `optionOrder`): Fall back to adjacency scan or no-op?**
A: Fall back to adjacency scan — "adjacency-order behavior remains the fallback" covers this case; Skip stays functional.

## Related Research
- `.rpiv/artifacts/research/2026-07-29_09-38-38_hide-start-picker-q-to-q-transitions.md`
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`

## Open Questions
- **`firstNeighbour()` consistency audit** (carried from the FRD's Suggested Follow-ups, unresolved): `firstNeighbour()` (`protocol-runner.ts:921-927`) and its three `advanceThrough` call sites (`:758` start, `:773` text-block, `:823` answer) remain adjacency-order-dependent auto-advance paths. The FRD scopes this feature to `skip()` only; whether answer-pass-through traversal should also follow authored order is a separate decision for a follow-up, not this feature.
