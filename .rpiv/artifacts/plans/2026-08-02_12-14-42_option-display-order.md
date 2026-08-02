---
date: 2026-08-02T12:14:42+0300
author: Roman Shulgha
commit: 8e3ab6b
branch: main
repository: RadiProtocol
topic: option-display-order
tags: [plan, runner, protocol, views, graph, parser]
status: ready
parent: .rpiv/artifacts/research/2026-08-02_11-56-59_option-display-order.md
phase_count: 6
unresolved_phase_count: 0
phases:
  - { n: 1, title: Data model + parser foundation, files: [src/graph/graph-model.ts, src/protocol/protocol-document.ts, src/protocol/protocol-document-parser.ts, src/__tests__/protocol-document-parser.test.ts], depends_on: [] }
  - { n: 2, title: edge-order projection module, files: [src/graph/edge-order.ts, src/__tests__/graph/edge-order.test.ts], depends_on: [1] }
  - { n: 3, title: Runner render ordering, files: [src/runner/render/render-question.ts, src/runner/render/render-loop-picker.ts, src/__tests__/runner/render-question.test.ts, src/__tests__/runner/render-loop-picker.test.ts], depends_on: [2] }
  - { n: 4, title: Skip authored order, files: [src/runner/protocol-runner.ts, src/__tests__/runner/protocol-runner-skip.test.ts], depends_on: [2] }
  - { n: 5, title: Editor chip module + i18n + modal mount, files: [src/views/option-order-chip-editor.ts, src/views/protocol-editor-view.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/views/option-order-chip-editor.test.ts, src/styles/protocol-editor.css], depends_on: [1] }
  - { n: 6, title: FR-6 edge-append integration, files: [src/views/protocol-editor-view.ts, src/__tests__/views/protocol-editor-keyboard.test.ts], depends_on: [5] }
last_updated: 2026-08-02T12:14:42+0300
last_updated_by: Roman Shulgha
---

# Author-configurable selection-option display order in the Runner — Implementation Plan

## Overview
Thread an optional per-question `optionOrder: string[]` (outgoing edge-id list) through four layers — runtime type, on-disk field + pure parser getter, a shared pure `src/graph/edge-order.ts` ordered-projection helper, and ordered rendering in `render-question.ts` + `render-loop-picker.ts` — plus an authored-order Skip auto-advance and a draggable chip list in the Question node edit modal (new `src/views/option-order-chip-editor.ts`). When `optionOrder` is absent, every consumer keeps today's grouped edges-array rendering byte-for-byte (backward compatible, no schema-version bump).

## Requirements
- Per-question optional `optionOrder: string[]` (outgoing edge ids in display order) on the runtime `QuestionNode` and on-disk `ProtocolNodeRecord.fields` (FR-1, FR-2).
- Pure parser extracts `optionOrder` without throwing (never-throw `ParseResult`); unknown/deleted edge ids preserved in the document, ignored downstream (FR-2, FR-9).
- Question node edit modal shows one draggable chip per currently-outgoing connection, ordered by `optionOrder` when present else edges-array order; chip labels derive from existing edge-label logic (FR-3, FR-4).
- Chips drag-to-reorder (HTML5 DnD splice pattern); persists via `protocolDocumentStore.update` (FR-5).
- A new outgoing edge appended to an ordered question appends to the end of `optionOrder` atomically in the same mutator (FR-6).
- Runner renders options in authored global order across all labeled kinds (interleaved) when `optionOrder` present; loop picker respects the order; fallback unchanged (FR-7).
- Skip selects the first answer in authored order when `optionOrder` present; adjacency-order fallback (FR-8).
- Stale entries silently ignored, never throw (FR-9).
- On-disk "Order is not semantically significant" doc comment updated (FR-10).
- Acceptance: `npm test` exits 0 with new suites; existing protocols without `optionOrder` render identically; drag-save-reopen round-trips; interleaved kinds render in authored position; loop picker ordered; stale ids ignored; new answer appends at end.

## Current State Analysis
The display order today is an accident of the `.rp.json` `edges` array order: `render-question.ts:47-56` derives answers/snippets from `graph.adjacency` (adjacency order == edges-array order per source node), `:72-77` derives question transitions from `graph.edges.filter(...)` (edges-array order), and `render-loop-picker.ts:44-46` filters `graph.edges` for outgoing edges. There is no authoring surface to change this order. `skip()` (`protocol-runner.ts:147-152`) scans adjacency for the first answer-kind neighbor. The `QuestionNode.loop` optional field (`graph-model.ts:44`) is the direct precedent for adding an optional per-question field across all layers; `getOptionalBoolean` (`protocol-document-parser.ts:64-67`) is the 3-state getter template (absent/valid/invalid → `undefined`, explicit values preserved). The HTML5 DnD chip-reorder pattern lives in `snippet-chip-editor.ts:286-340` (splice-based reorder at `:333-334`, tracked-listener `destroy()` at `:494-500`).

### Key Discoveries
- `mountChipEditor` (`snippet-chip-editor.ts:75-79`) is snippet-placeholder-specific — its signature takes an `EditableTemplateSnippet` draft (name/template/placeholders) and renders a full editor with add/expand/remove. The optionOrder chip list is simpler (one chip per outgoing edge, drag handle + label, no add/remove/expand), so it cannot be reused verbatim; a focused new `option-order-chip-editor.ts` mirrors its DnD/destroy structure.
- Two-pass parser (`protocol-document-parser.ts:99-107` nodes, `:117-139` edges): `parseNode` is edge-id-blind at extraction time, so stale/deleted edge ids **cannot** be validated in the parser. They are preserved losslessly and become inert in a post-parse projection over `graph.edges`.
- `ProtocolGraph.edges` preserves document edge order; `adjacency`/`reverseAdjacency` are pushed in the same edge order, so adjacency order == edges-array order per source node — the fallback basis.
- Edge-id dispatch is the canonical selection contract: `chooseQuestionBranch` (`protocol-runner.ts:250`) and `chooseLoopBranch` (`:297`) re-find by `edge.id`; ordering is display-only by construction and never enters traversal.
- FR-6 atomicity precedent: the edge-modal save mutator rewrites a node `fields.snippetLabel` inside an edge-lifecycle `update()` (`protocol-editor-view.ts:2106-2118`); the `{ ...existing }` spread preserves unrelated metadata; `WriteMutex` serializes the write.
- The `textControls` read-later loop (`protocol-editor-view.ts:2419-2423`) deletes keys whose `value()` reads `undefined` — the seam for the empty-draft → omit-key normalization.

## Desired End State
A protocol author opens a Question node in the editor and sees a "Display order" chip list of its outgoing connections. Dragging a snippet chip between two answers and saving persists `fields.optionOrder: ["edge-a","edge-s","edge-b"]`. Reopening the modal shows the same order. Running the protocol renders the snippet branch between the two answers in that position. The loop picker for a looped ordered question renders its body/exit buttons in the authored order. Clicking Skip advances through the first answer in the authored order. A protocol saved before this feature (no `optionOrder`) renders and skips identically to before. Adding a new answer edge to an ordered question appends it at the end of the chip list and the runner list. Deleting an edge leaves a stale id in `optionOrder` that is silently ignored at render.

```jsonc
// .rp.json question node (excerpt)
{
  "id": "q1", "kind": "question",
  "fields": { "questionText": "Findings?", "optionOrder": ["e-snippet","e-answer-a","e-answer-b"] }
}
```

## What We're NOT Doing
- No `PROTOCOL_VERSION` bump — adding an optional field is backward-compatible.
- No reordering of the `.rp.json` `edges` array or the canvas layout — order is metadata only, applied at render time.
- No global ordering rules (alphabetical, by kind, by recency) — explicit per-question order only, plus the existing fallback.
- No new dependencies — no sortable library; the in-codebase HTML5 DnD pattern is reused.
- No changes to the loop picker's visual design — it only respects authored order for its buttons.
- No runner-state / FSM changes — pure render-order + metadata + a skip-scan indirection.
- No `firstNeighbour()` consistency audit (`protocol-runner.ts:921-927` and its `advanceThrough` call sites) — deferred to a separate follow-up; this feature scopes Skip only.
- No generalization of `snippet-chip-editor.ts` — it stays snippet-specific; optionOrder gets its own focused module.
- No edge deletion scrub of `optionOrder` — stale ids are filtered on read, never cleaned on write.

## Decisions

### D1: Runtime type — `optionOrder?: string[]` on `QuestionNode`
Slots beside `loop` (`graph-model.ts:44`), the direct optional-field precedent. `RPNode` union untouched. No type-union changes. Evidence: `src/graph/graph-model.ts:32-45`.

### D2: On-disk schema — `fields.optionOrder` key, `PROTOCOL_VERSION` stays 1
One more camelCase key in `ProtocolNodeRecord.fields` (`protocol-document.ts:87`, `Record<string, unknown>`). Unknown fields parse silently; old files untouched. Evidence: `src/protocol/protocol-document.ts:63-88`, `:36-38`.

### D3: Parser extraction — new `getOptionalStringArray`, 3-state model
Modeled after `getOptionalBoolean` (`protocol-document-parser.ts:64-67`): absent → `undefined`; valid `string[]` → verbatim (including unknown/deleted ids, preserved for round-trip); `[]` → `[]` (distinct from `undefined`); non-array or array-with-non-string-elements → `undefined` (whole-field type violation). Never a `parseError`, never a throw. Stale-id filtering is deferred to the post-parse projection (two-pass parser is edge-id-blind). Evidence: `src/protocol/protocol-document-parser.ts:36-67`, `:95-143`, `:203-211`.

### D4: Ordered-edge projection — new pure module `src/graph/edge-order.ts`
Developer-decided (research Q/A). Pure read-time helper `orderedOutgoingEdges(graph, questionId): RPEdge[]`: when `node.optionOrder === undefined`, return `graph.edges.filter(e => e.fromNodeId === questionId)` (today's edges-array order); when present, iterate `optionOrder`, emit listed entries that are current outgoing edges (drop non-string, stale, non-outgoing, duplicates), then append unlisted current outgoing edges at the end in edges-array order. Importable by runner core + render without dependency violations; unit-testable without Obsidian. Modeled after `src/graph/node-label.ts` (pure helper module). Evidence: `src/graph/node-label.ts:18-46`, `src/runner/render/render-loop-picker.ts:44-46`.

### D5: Render — interleaved single-stack when present, verbatim fallback when absent
`render-question.ts`: `if (node.optionOrder === undefined)` runs today's three-group code verbatim (byte-identical fallback); else iterate the projection's ordered edges, dispatch each target kind to the **same** per-kind button construction (`rp-answer-btn`/`rp-question-transition-btn`/`rp-snippet-branch-btn` — CSS class, caption source, callback payload preserved byte-for-byte) inside a single `rp-option-list rp-stack` container. `render-loop-picker.ts`: reorder the `outgoing` array via the projection before the per-edge loop. Both renderers dispatch by `edge.id`, so ordering is display-only. Evidence: `src/runner/render/render-question.ts:47-118`, `src/runner/render/render-loop-picker.ts:44-65`.

### D6: Skip — authored first-answer order, adjacency fallback
`skip()`: when `node.optionOrder` present, resolve ordered outgoing edges via the projection, filter targets with `kind === 'answer'`, take the first; if none, fall back to today's adjacency scan (`protocol-runner.ts:147-152`). Stale ids yield no target and are skipped silently. Modeled after the `graph.edges.find(e => e.id === entryId)` pattern in `chooseLoopBranch` (`protocol-runner.ts:297`). Evidence: `src/runner/protocol-runner.ts:139-173`.

### D7: Editor chip UI — new `src/views/option-order-chip-editor.ts`
Developer-decided (Step 4 checkpoint). Focused `mountOptionOrderChips(container, items, onChange): ChipEditorHandle` mirroring `snippet-chip-editor.ts`'s tracked-listener + `destroy()` + splice-DnD structure (drag handle `⠿`, `dragstart`/`dragover`/`drop`, splice reorder). Items carry edge id + label (labels from `deriveProtocolEditorEdgeLabel`/`nodeLabel`-equivalent logic computed by the caller in `protocol-editor-view.ts`, operating on on-disk records — no views→runner import). No add/remove/expand — chips are 1:1 with current outgoing edges. Evidence: `src/views/snippet-chip-editor.ts:75-104`, `:286-340`, `:494-500`, `src/views/protocol-editor-view.ts:290-343`.

### D8: Modal save — `textControls` read-later entry, empty → omit key
A closure-held `let draftOptionOrder: string[]` + a `textControls` entry `{ key: 'optionOrder', value: () => draftOptionOrder.length > 0 ? [...draftOptionOrder] : undefined }`. The save loop (`protocol-editor-view.ts:2419-2423`) deletes undefined-valued keys, so disk stays clean and absence == fallback. The fresh `[...draft]` copy prevents DOM mutation of the persisted array. Evidence: `src/views/protocol-editor-view.ts:2176-2224`, `:2417-2487`.

### D9: FR-6 — append new edge id inside the same `update()` mutator
At both `addNodeAndConnectAtWorldPoint` (`:866`) and `finishConnectionDrag` (`:1473`), when the source question node already has `fields.optionOrder`, append the new edge id to it inside the same `protocolDocumentStore.update` mutator that appends the edge — atomic in one `WriteMutex`-protected write. Only when `optionOrder` already exists (no order → new edge falls back to edges-array end naturally). The `{ ...existing }` spread preserves unrelated metadata. Evidence: `src/views/protocol-editor-view.ts:850-892`, `:1428-1484`, `:2106-2118`.

### D10: Stale-id inertness — filter on read, never throw
Consistent with the never-throw validator convention. The projection drops stale/non-outgoing/duplicate ids; the editor chip list shows only currently-outgoing edges; deleting an edge never scrubs `optionOrder`. Evidence: `src/graph/graph-validator.ts` (convention), `src/protocol/protocol-document-parser.ts:125`.

### D11: FR-10 — update "Order is not semantically significant" doc comment
`protocol-document.ts:36-38` becomes misleading once `optionOrder` exists; update it to note that a question node's outgoing edges may carry display-order semantics via its `fields.optionOrder`.

## Ordering Constraints
- **Phase 1 (foundation) first** — runtime type + on-disk field + parser extraction; every later phase reads `node.optionOrder` or `fields.optionOrder`.
- **Phase 2 (edge-order) after Phase 1** — the projection reads `QuestionNode.optionOrder`.
- **Phase 3 (render) after Phase 2** — render consumes the projection.
- **Phase 4 (skip) after Phase 2** — skip consumes the projection; independent of Phase 3 (skip never renders).
- **Phase 5 (chip module + modal) after Phase 1** — operates on the on-disk `fields.optionOrder`; no dependency on Phases 2-4.
- **Phase 6 (FR-6 appends) after Phase 5** — same file (`protocol-editor-view.ts`) as Phase 5; emits an incremental subsection. No code dependency on the chip mount, but file-ordering requires it after Phase 5.
- **No parallelism** — phases run sequentially per the slice-by-slice generation contract. Phase 4 may run parallel with Phase 3 conceptually (different files), but generation is sequential.

## Verification Notes
- **Parser round-trip** (FR-2): absent → `undefined`; `["e1","e2"]` → verbatim; `[]` → `[]`; `42`/`"e1,e2"`/`null`/object → `undefined`; array with non-string element → `undefined`; unknown/deleted ids preserved verbatim (projection drops them later).
- **Fallback intact** (acceptance): a graph without `optionOrder` renders the exact three-group child order, captions, and callback payloads pinned by `render-question.test.ts:101-161` and the loop-picker baseline `render-loop-picker.test.ts:197-238`. Re-run existing tests unchanged.
- **Authored order render** (FR-7): with `optionOrder: [snippet-edge, answer-edge, answer-edge2]`, `render-question.ts` emits one `rp-option-list` container with buttons in that order, per-kind CSS classes preserved, captions byte-identical to the per-kind builders, `onChooseAnswer`/`onChooseQuestionBranch`/`onChooseSnippetBranch` payloads unchanged. Loop picker emits buttons in authored order.
- **Skip authored order** (FR-8): `optionOrder` present → skip advances through the first answer in authored order, no text appended; present-but-answerless `optionOrder` → adjacency-scan fallback; stale ids skipped silently.
- **Editor persist round-trip** (FR-5, acceptance): drag a chip, save → `optionOrder` rewritten in `.rp.json`; reopen modal → same order; `npm run check` and the editor keyboard test pass.
- **Save/reopen staleness** (precedent `f5850c0`, `c0bb6ee`): after save, `loadProtocol` reloads; reopen shows the persisted order — mandatory regression check.
- **FR-6 append** (acceptance): add a new answer edge to an ordered question → new edge id appears at the end of `optionOrder` and at the end of the runner list.
- **Stale-id inertness** (FR-9, acceptance): delete an edge referenced by `optionOrder`, run the protocol → no error; missing entry ignored.
- **DnD click-handler edge cases** (precedent `9900a56`): drag handle clicks do not corrupt the chip; `stopPropagation` on inner controls if any.
- **i18n** (convention): new keys added to BOTH `en.json` and `ru.json`; user-authored chip labels (edge captions) never wrapped in `t()`.
- **Whole-plan gate** (terminal phase): `npm run check` + `npm test` exit 0.

## Performance Considerations
Option lists are small (a question rarely has > 10 outgoing edges). The projection is a linear pass: one `filter` + one `Map` build + one iterate-and-append — O(E) per render/skip. No caching needed; computed fresh on each render (the runner re-renders on every state transition anyway). No N+1 risk: the projection reads `graph.edges` and `graph.nodes` directly. Chip rendering is a one-time DOM build on modal open.

## Migration Notes
No persisted schema migration. `PROTOCOL_VERSION` stays 1; `isProtocolDocumentV1` is unchanged (it checks schema/version sentinels only, not per-node fields). Existing `.rp.json` files without `optionOrder` parse and run identically. The only on-disk documentation change is the `protocol-document.ts:36-38` doc comment (FR-10). Rollback: removing the feature leaves `optionOrder` keys on disk as inert unknown fields that parse silently (the parser drops unknown fields that aren't extracted — but `optionOrder` is extracted; removing extraction would make it ignored, which is safe).

## Pattern References
- `src/graph/node-label.ts:18-46` — pure graph-helper module pattern (template for `edge-order.ts`).
- `src/protocol/protocol-document-parser.ts:64-67` — `getOptionalBoolean` 3-state getter (template for `getOptionalStringArray`).
- `src/views/snippet-chip-editor.ts:75-104`, `:286-340`, `:494-500` — HTML5 DnD chip pattern + tracked-listener `destroy()` (template for `option-order-chip-editor.ts`).
- `src/runner/render/render-question.ts:47-118` — per-kind button builders (reused byte-for-byte in the interleaved path).
- `src/runner/protocol-runner.ts:147-152`, `:293-336` — skip adjacency scan + edge.id dispatch pattern.
- `src/views/protocol-editor-view.ts:2106-2118` — node `fields` write inside an edge-lifecycle mutator (FR-6 precedent).
- `src/views/protocol-editor-view.ts:2176-2224`, `:2417-2487` — `textControls` read-later + save loop (chip mount + empty→omit seam).

## Developer Context
- **Step 4 checkpoint (chip UI home)** — Question: "The research says reuse the chip DnD pattern, but `mountChipEditor` (`snippet-chip-editor.ts:75-79`) is snippet-placeholder-specific — its signature takes an `EditableTemplateSnippet` draft and renders a full editor; the optionOrder chip list is simpler (one chip per outgoing edge, drag handle + label, no add/remove/expand), so `mountChipEditor` cannot be called verbatim with a `string[]`. Where should the new optionOrder chip-list code live?" Answer: **New module** — `src/views/option-order-chip-editor.ts` with `mountOptionOrderChips(container, items, onChange): ChipEditorHandle`, mirroring `snippet-chip-editor.ts`'s tracked-listener + `destroy()` + splice-DnD structure; independently unit-testable; keeps `openEditModal` from growing.
- **Inherited research Q/As** (recorded as Decisions D1-D11): feature serves both sides; fallback kept; optional metadata field; reuse chip DnD pattern; node edit modal home; all labeled kinds; single global order; per-question edge-id list; skip follows authored order; new edges append at end; stale ids silently ignored; `edge-order.ts` in `graph/`; empty draft → omit key; present-but-answerless `optionOrder` → adjacency fallback.

- **Phase 6 micro-checkpoint (Step 6.3)** — Slice 6/6 approved. Surfed slice-verifier Research WARNING (not a VIOLATION): the FR-5 drag→save→reopen integration test (in `protocol-editor-keyboard.test.ts`) reads the in-memory mutated `view.doc` on reopen (the `updateSpy` mutator output IS the persisted doc; `loadProtocol` is stubbed). A full disk round-trip is covered by the existing `protocol-document-store` tests; this test verifies the editor-reflects-saved-state-on-reopen staleness invariant at the in-memory level. Accepted as a known, documented limitation.
- **Phase 5/6 MockEl enhancement** — the heavy `makeEl` in `protocol-editor-keyboard.test.ts` was extended (textContent getter/setter, dataset, getAttr, querySelectorAll in-order, contains, removeEventListener) so the Phase 5 chip module renders + destroys cleanly in the view-test harness; `restoreEditorFocus` stubbed to avoid the Node-env `instanceof HTMLElement` throw.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source   | plan-loc                       | codebase-loc                          | severity | dimension             | finding                                                                                                                                                                                                   | recommendation                                                                                                                                                                          | resolution         |
| -------- | ------------------------------ | ------------------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| coverage | ## Verification Notes §6        | <n/a>                                 | blocker  | verification-coverage | Note "after save, `loadProtocol` reloads; reopen shows the persisted order — mandatory regression check" — criteria NOT FOUND: the cited store tests only verify generic read/write; the FR-5 integration test stubs `loadProtocol` and reopens in-memory mutated `view.doc`. | Add a Phase 6 automated test that saves reordered `optionOrder` through `ProtocolDocumentStore`, reloads via unstubbed `loadProtocol`, and asserts the reopened modal order.              | deferred: optionOrder disk round-trip covered by Phase 1 parser tests + existing protocol-document-store tests; `loadProtocol` is a thin store.read→parse→set-doc wrapper; in-memory FR-5 covers the editor-reflects-saved-state staleness invariant. A full editor+real-store+loadProtocol test deferred to a follow-up. |
| code     | Phase 5 §1                     | src/styles/snippet-manager.css:52-100 | concern  | codebase-fit          | The new `.rp-option-order-chip*`, help, list, and `drag-over` classes have no CSS; the sibling chip implementation relies on dedicated layout/handle/truncation/drop-target styles.                      | Add a Phase 5 §6 for `src/styles/protocol-editor.css` defining the option-order chip styles.                                                                                           | applied: added Phase 5 §6 with option-order chip styles in `src/styles/protocol-editor.css` (mirrors the snippet placeholder chip pattern). |
| code     | Phase 5 §2                     | src/views/protocol-editor-view.ts:2417-2423 | concern  | code-quality     | The proposed control always returns all outgoing IDs when the draft is non-empty, so merely saving a legacy question with no `optionOrder` activates the interleaved renderer and changes its previously grouped output without any reorder action. | Track whether `optionOrder` originally existed and whether DnD changed the draft; return `undefined` when both are false.                                                            | applied: Phase 5 §2 `addOptionOrderChips` now persists `optionOrder` only when the user reordered (modified) OR it was already present; a legacy no-reorder save omits the key (grouped fallback preserved). |
| code     | Phase 5 §2                     | src/views/protocol-editor-view.ts:2417-2423 | concern  | code-quality     | The proposal says "Stale ids are dropped here" and rebuilds the persisted field solely from visible chips, so saving the node deletes stale IDs despite the plan's requirement that unknown/deleted IDs remain preserved on disk. | Preserve the original stale IDs when merging the reordered live-edge IDs into the saved `optionOrder`.                                                                                  | applied: on reorder, the save appends original stale ids (not in current outgoing) after the reordered live ids — stale ids filtered at render, never cleaned on write (FR-9). |
| code     | Phase 5 §2                     | src/graph/node-label.ts:18-46         | concern  | codebase-fit          | `optionOrderChipLabel` falls back only through `questionText`, `text`, `id`, so an unlabeled loop-body edge targeting a text-block with `fields.content` but no `text` shows its raw ID while the live loop picker's `nodeLabel` shows the content. | Add kind-aware on-disk fallbacks mirroring `nodeLabel`, including text-block content and snippet binding labels.                                                                       | applied: `optionOrderChipLabel` extended with kind-aware on-disk fallbacks (question text, text-block content slice, loop-label) mirroring `nodeLabel`. |
| coverage | ## Verification Notes §9       | <n/a>                                 | concern  | verification-coverage | Note "drag handle clicks do not corrupt the chip; `stopPropagation` on inner controls if any" — no Success Criteria bullet exercises clicks and no test or click guard mirrors the mechanism.                | Add a Phase 5 chip-editor test that clicks the drag handle and asserts draft order and chip contents remain unchanged.                                                                 | applied: added a Phase 5 chip-module test dispatching click on the chip and drag handle, asserting the draft is unchanged (reorder-only — no click handler). |

## Plan History
- Phase 1: Data model + parser foundation — approved as generated
- Phase 2: edge-order projection module — approved as generated
- Phase 3: Runner render ordering — approved as generated
- Phase 4: Skip authored order — approved as generated
- Phase 5: Editor chip module + i18n + modal mount — approved as generated; revised at Step 9 (CSS + backward-compat save logic + stale-id preservation + kind-aware label fallback + DnD click test)
- Phase 6: FR-6 edge-append integration — approved as generated

## References
- Research: `.rpiv/artifacts/research/2026-08-02_11-56-59_option-display-order.md`
- FRD: `.rpiv/artifacts/discover/2026-08-02_11-40-35_option-display-order.md`
- Related research: `.rpiv/artifacts/research/2026-07-29_09-38-38_hide-start-picker-q-to-q-transitions.md`, `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`

---

## Phase 1: Data model + parser foundation

### Overview
Add the `optionOrder` runtime field to `QuestionNode`, document the on-disk `fields.optionOrder` key (and update the FR-10 "order is not semantically significant" comment), and extract it in the parser via a new `getOptionalStringArray` getter. Foundation phase — every later phase reads this field.

### Changes Required:

#### 1. src/graph/graph-model.ts
**File**: src/graph/graph-model.ts
**Changes**: MODIFY — add `optionOrder?: string[]` to `QuestionNode` beside `loop`, with JSDoc.

```typescript
export interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
  /**
   * Loop toggle. When `true`, this question behaves as a loop node: the runner
   * halts at a branch picker over its outgoing edges, supports nested re-entry,
   * and pops the loop frame on an `isLoopExit` edge. Absent or `false` = ordinary
   * question that halts at `at-node` awaiting `chooseAnswer`. Migrated from the
   * removed standalone `LoopNode` (legacy `headerText` → `questionText`,
   * `kind: 'loop'` → `kind: 'question'` + `loop: true`).
   */
  loop?: boolean;
  /**
   * Author-configured display order for this question's outgoing selection
   * options — an explicit list of outgoing edge ids in the order the options
   * should be presented (interleaving answer / question-transition /
   * snippet-branch kinds). Absent or `undefined` = no explicit order → the
   * Runner falls back to its default grouped edges-array rendering (backward
   * compatible). Stale ids (deleted/reassigned/non-outgoing edges) and
   * duplicates are silently ignored by downstream consumers; unlisted current
   * outgoing edges are appended at the end. An empty array `[]` is distinct
   * from `undefined` — it yields all current outgoing edges in default order,
   * ungrouped.
   */
  optionOrder?: string[];
}
```

#### 2. src/protocol/protocol-document.ts
**File**: src/protocol/protocol-document.ts
**Changes**: MODIFY — update the `nodes`/`edges` doc comment (FR-10) and the `fields` JSDoc to mention `optionOrder`.

```typescript
// Edit A — `edges` doc comment (FR-10). Replace the existing
//   /** All protocol edges. Order is not semantically significant. */
//   edges: ProtocolEdgeRecord[];
// with:
  /**
   * All protocol edges. Order is not semantically significant for traversal;
   * however, a question node's `fields.optionOrder` may reference edge ids to
   * express a display order for that question's outgoing selection options
   * (see ProtocolNodeRecord.fields.optionOrder).
   */
  edges: ProtocolEdgeRecord[];

// Edit B — `ProtocolNodeRecord.fields` JSDoc key list. Add `optionOrder`:
   * Typed node fields. Keys are camelCase without prefix:
   * - questionText, answerText, displayLabel, content, separator,
   *   loop, optionOrder, subfolderPath, snippetLabel, snippetSeparator, snippetPath.
   *
   * Parser validates field presence/absence per node kind.
// (The `nodes` doc comment is left as-is — node order genuinely is not significant.)
```
**File**: src/protocol/protocol-document-parser.ts
**Changes**: MODIFY — add `getOptionalStringArray` getter (3-state) and extract `optionOrder` in the question case.

```typescript
// Add this getter after `getOptionalBoolean` (after line 67):

/**
 * Optional string array with three distinct outcomes: a verbatim `string[]`
 * (including `[]` and arrays containing unknown/deleted ids — preservation is
 * at the document level), and `undefined` (absent, or non-array, or an array
 * containing any non-string element). Whole-field type reading: a single
 * non-string element collapses the entire field to `undefined`, mirroring
 * `getOptionalBoolean`'s non-boolean → undefined behaviour. Stale-id
 * filtering is deferred to a post-parse projection over the completed graph
 * (the two-pass parser is edge-id-blind at extraction time).
 */
function getOptionalStringArray(obj: Record<string, unknown>, key: string, legacyKey?: string): string[] | undefined {
  const v = getCompatValue(obj, key, legacyKey);
  if (!Array.isArray(v)) return undefined;
  for (const item of v) {
    if (typeof item !== 'string') return undefined;
  }
  return v;
}

// Question case (currently lines 203-211) — add the `optionOrder` line:
      case 'question': {
        const node: QuestionNode = {
          ...base,
          kind: 'question',
          questionText: getString(fields, 'questionText', raw.text ?? '', 'radiprotocol_questionText'),
          loop: getOptionalBoolean(fields, 'loop', 'radiprotocol_loop'),
          optionOrder: getOptionalStringArray(fields, 'optionOrder'),
        };
        return node;
      }
```
**File**: src/__tests__/protocol-document-parser.test.ts
**Changes**: MODIFY — add `optionOrder` round-trip cases (absent/valid/empty/non-array/non-string-element/unknown-ids-preserved).

```typescript
// Add a new top-level describe block (e.g. before the 'edges and adjacency' block):

describe('ProtocolDocumentParser — optionOrder', () => {
  function docWithQuestion(fields: Record<string, unknown>): ProtocolDocumentV1 {
    return validDoc({
      nodes: [
        { id: 'n-start', kind: 'start', x: 0, y: 0, width: 250, height: 60, fields: {} },
        { id: 'n-q', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields },
      ],
    });
  }

  it('absent optionOrder → undefined', () => {
    const result = parser.parse(JSON.stringify(docWithQuestion({ questionText: 'Q?' })), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.graph.nodes.get('n-q') as any).optionOrder).toBeUndefined();
    }
  });

  it('valid string[] → verbatim (unknown ids preserved for round-trip)', () => {
    const result = parser.parse(JSON.stringify(docWithQuestion({
      questionText: 'Q?', optionOrder: ['e1', 'e2', 'e-stale'],
    })), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.graph.nodes.get('n-q') as any).optionOrder).toEqual(['e1', 'e2', 'e-stale']);
    }
  });

  it('empty array [] → [] (distinct from undefined)', () => {
    const result = parser.parse(JSON.stringify(docWithQuestion({
      questionText: 'Q?', optionOrder: [],
    })), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.graph.nodes.get('n-q') as any).optionOrder).toEqual([]);
    }
  });

  it('non-array values → undefined (42, "e1,e2", null, object)', () => {
    const cases: Array<Record<string, unknown>> = [
      { questionText: 'Q?', optionOrder: 42 },
      { questionText: 'Q?', optionOrder: 'e1,e2' },
      { questionText: 'Q?', optionOrder: null },
      { questionText: 'Q?', optionOrder: { e1: true } },
    ];
    for (const fields of cases) {
      const result = parser.parse(JSON.stringify(docWithQuestion(fields)), 'test.rp.json');
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.graph.nodes.get('n-q') as any).optionOrder).toBeUndefined();
      }
    }
  });

  it('array with a non-string element → undefined (whole-field type violation)', () => {
    const result = parser.parse(JSON.stringify(docWithQuestion({
      questionText: 'Q?', optionOrder: ['e1', 42, 'e3'],
    })), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.graph.nodes.get('n-q') as any).optionOrder).toBeUndefined();
    }
  });

  it('coexists with loop toggle', () => {
    const result = parser.parse(JSON.stringify(docWithQuestion({
      questionText: 'Q?', loop: true, optionOrder: ['e1', 'e2'],
    })), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n-q') as any;
      expect(node.loop).toBe(true);
      expect(node.optionOrder).toEqual(['e1', 'e2']);
    }
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Parser optionOrder tests pass: `npx vitest run src/__tests__/protocol-document-parser.test.ts`
- [x] Existing parser tests still pass (fallback intact): `npx vitest run src/__tests__/protocol-document-parser.test.ts`

#### Manual Verification:
- [ ] A question node with `fields.optionOrder: ["e1","e2"]` parses to `node.optionOrder === ["e1","e2"]` including unknown ids
- [ ] A question node without `optionOrder` parses to `node.optionOrder === undefined` (fallback)

---

## Phase 2: edge-order projection module

### Overview
New pure `src/graph/edge-order.ts` with `orderedOutgoingEdges(graph, questionId): RPEdge[]` — the shared ordered projection consumed by render and skip. Depends on Phase 1 (reads `QuestionNode.optionOrder`).

### Changes Required:

#### 1. src/graph/edge-order.ts
**File**: src/graph/edge-order.ts
**Changes**: NEW — pure ordered-projection helper.

```typescript
// graph/edge-order.ts
// Pure ordered-projection helper for a question's outgoing edges.
// Zero Obsidian imports (NFR-01) — fully unit-testable in plain Node.js.
//
// Shared by render-question, render-loop-picker, and skip across the runner
// layer. When a QuestionNode carries an `optionOrder: string[]` (outgoing edge
// ids in display order), this module projects the current outgoing edges into
// that order, dropping stale/non-outgoing/duplicate ids and appending any
// unlisted current outgoing edges at the end (FR-6 read-path counterpart). When
// `optionOrder` is absent (`undefined`), the projection is the edges-array order
// of outgoing edges — today's fallback — so consumers can call this helper
// unconditionally and the absent case is byte-identical to prior behavior.

import type { ProtocolGraph, RPEdge } from './graph-model';

/**
 * Return the outgoing edges of `questionId` in display order.
 *
 * - `optionOrder` absent (`undefined`) → outgoing edges in `graph.edges` array
 *   order (the never-authored fallback; adjacency order agrees per source node).
 * - `optionOrder` present (including `[]`) → emit each listed id that resolves
 *   to a CURRENT outgoing edge, in listed order, skipping stale ids (edge
 *   deleted or reassigned to another source), non-outgoing ids, and duplicates;
 *   then append any unlisted current outgoing edges at the end in edges-array
 *   order so every reachable edge stays reachable even in hand-edited files.
 *
 * Never throws; a missing/non-question `questionId` yields the edges-array
 * outgoing order (defensive — callers already guard kind).
 */
export function orderedOutgoingEdges(graph: ProtocolGraph, questionId: string): RPEdge[] {
  const outgoing = graph.edges.filter((e) => e.fromNodeId === questionId);
  const node = graph.nodes.get(questionId);
  const optionOrder = node?.kind === 'question' ? node.optionOrder : undefined;
  if (optionOrder === undefined) return outgoing;

  const byId = new Map<string, RPEdge>();
  for (const e of outgoing) byId.set(e.id, e);

  const ordered: RPEdge[] = [];
  const seen = new Set<string>();
  for (const id of optionOrder) {
    // Parser guarantees string elements, but a hand-edited runtime graph could
    // carry malformed entries — skip them silently (never-throw convention).
    if (typeof id !== 'string') continue;
    const edge = byId.get(id);
    if (edge === undefined) continue;  // stale or non-outgoing
    if (seen.has(id)) continue;        // duplicate
    seen.add(id);
    ordered.push(edge);
  }
  // Append unlisted current outgoing edges at the end, in edges-array order.
  for (const e of outgoing) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    ordered.push(e);
  }
  return ordered;
}
```

#### 2. src/__tests__/graph/edge-order.test.ts
**File**: src/__tests__/graph/edge-order.test.ts
**Changes**: NEW — projection unit tests (absent→edges-array order; present→ordered with stale/dup/non-outgoing dropped + unlisted appended; empty→all appended).

```typescript
// src/__tests__/graph/edge-order.test.ts
// Unit tests for the ordered-edge projection shared by render and skip.

import { describe, it, expect } from 'vitest';
import { orderedOutgoingEdges } from '../../graph/edge-order';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';

const baseRect = { x: 0, y: 0, width: 200, height: 60 };

function q(id: string, optionOrder?: string[]): RPNode {
  return { id, kind: 'question', questionText: `Q ${id}`, ...(optionOrder !== undefined ? { optionOrder } : {}), ...baseRect } as RPNode;
}
function a(id: string): RPNode {
  return { id, kind: 'answer', answerText: `A ${id}`, ...baseRect } as RPNode;
}

function makeGraph(nodes: RPNode[], edges: RPEdge[], questionId: string): ProtocolGraph {
  const nodeMap = new Map<string, RPNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  return {
    canvasFilePath: 'test.rp.json',
    nodes: nodeMap,
    edges,
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: questionId,
  };
}

describe('orderedOutgoingEdges', () => {
  it('optionOrder absent → outgoing in edges-array order', () => {
    const graph = makeGraph(
      [q('q1'), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('optionOrder present → ordered; stale id dropped; unlisted appended at end', () => {
    const graph = makeGraph(
      [q('q1', ['e2', 'e-stale', 'e3']), a('a1'), a('a2'), a('a3')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
        { id: 'e3', fromNodeId: 'q1', toNodeId: 'a3' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
  });

  it('optionOrder fully orders all outgoing edges (no unlisted)', () => {
    const graph = makeGraph(
      [q('q1', ['e3', 'e1', 'e2']), a('a1'), a('a2'), a('a3')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
        { id: 'e3', fromNodeId: 'q1', toNodeId: 'a3' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e3', 'e1', 'e2']);
  });

  it('empty optionOrder [] → all outgoing appended in edges-array order', () => {
    const graph = makeGraph(
      [q('q1', []), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('duplicate ids in optionOrder → deduped (first occurrence wins)', () => {
    const graph = makeGraph(
      [q('q1', ['e2', 'e2', 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e2', 'e1']);
  });

  it('non-outgoing (reassigned) id in optionOrder → dropped', () => {
    const graph = makeGraph(
      [q('q1', ['e-other', 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e-other', fromNodeId: 'a1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1']);
  });

  it('all optionOrder ids stale → falls back to outgoing edges-array order', () => {
    const graph = makeGraph(
      [q('q1', ['e-x', 'e-y']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('non-string entry in optionOrder (hand-edited runtime) → skipped silently', () => {
    const graph = makeGraph(
      [q('q1', [42 as unknown as string, 'e1']), a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('missing question node → outgoing edges-array order (defensive)', () => {
    const graph = makeGraph(
      [a('a1'), a('a2')],
      [
        { id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' },
        { id: 'e2', fromNodeId: 'q1', toNodeId: 'a2' },
      ],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('non-question node → outgoing edges-array order (defensive)', () => {
    const graph = makeGraph(
      [a('q1'), a('a1')],
      [{ id: 'e1', fromNodeId: 'q1', toNodeId: 'a1' }],
      'q1',
    );
    expect(orderedOutgoingEdges(graph, 'q1').map((e) => e.id)).toEqual(['e1']);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] edge-order tests pass: `npx vitest run src/__tests__/graph/edge-order.test.ts`

#### Manual Verification:
- [ ] `orderedOutgoingEdges` drops stale/duplicate/non-outgoing ids and appends unlisted edges at the end
- [ ] absent optionOrder returns edges-array order (fallback byte-identical)

---

## Phase 3: Runner render ordering

### Overview
`render-question.ts` gains an `optionOrder` branch (interleaved single-stack via the projection, fallback verbatim) and `render-loop-picker.ts` reorders its `outgoing` array via the projection. Depends on Phase 2.

### Changes Required:

#### 1. src/runner/render/render-question.ts
**File**: src/runner/render/render-question.ts
**Changes**: MODIFY — import `orderedOutgoingEdges`; branch on `node.optionOrder`; interleaved single-stack path reusing per-kind button builders; fallback verbatim.

```typescript
// Add import after the `node-label` import:
import { orderedOutgoingEdges } from '../../graph/edge-order';

// Add three module-local helpers (after the `QuestionBranchHost` interface,
// before `renderQuestionAtNode`). Shared by the grouped fallback and the
// interleaved authored-order path so construction (CSS class, caption source,
// callback payload) is byte-for-byte identical — only the container/iteration
// order differs between the two render paths.
function appendAnswerButton(parent: HTMLElement, answerNode: AnswerNode, host: QuestionBranchHost): void {
  const btn = createButton(parent, {
    cls: 'rp-answer-btn',
    text: answerNode.displayLabel ?? answerNode.answerText,
  });
  host.bindClick(btn, () => {
    void host.onChooseAnswer(answerNode);
  });
}

function appendQuestionTransitionButton(parent: HTMLElement, edge: RPEdge, graph: ProtocolGraph, host: QuestionBranchHost): void {
  const target = graph.nodes.get(edge.toNodeId);
  const fallbackCaption = target !== undefined
    ? nodeLabel(target).trim() || edge.toNodeId
    : edge.toNodeId;
  const caption = edge.label !== undefined && edge.label.trim() !== ''
    ? edge.label
    : fallbackCaption;
  const btn = createButton(parent, {
    cls: 'rp-question-transition-btn',
    text: caption,
  });
  host.bindClick(btn, () => {
    void host.onChooseQuestionBranch(edge);
  });
}

function appendSnippetBranchButton(parent: HTMLElement, snippetNode: SnippetNode, host: QuestionBranchHost): void {
  const isFileBound = isFileBoundSnippetNode(snippetNode);
  const btn = createButton(parent, {
    cls: 'rp-snippet-branch-btn',
    text: snippetBranchLabel(snippetNode),
  });
  host.bindClick(btn, () => {
    void host.onChooseSnippetBranch(snippetNode, isFileBound);
  });
}

// Replace the `renderQuestionAtNode` body (from `textZone.createEl('p', ...)`
// through `return 'rendered';`) with:
  textZone.createEl('p', {
    text: node.questionText,
    cls: 'rp-question-text',
  });

  // Authored display order: when the question carries an `optionOrder`, render
  // its outgoing options as a single interleaved stack in that order (answers,
  // question transitions, snippet branches interleaved). Per-kind button
  // construction is byte-for-byte identical to the grouped fallback below via
  // the shared append*Button helpers — only the container/iteration order
  // changes. When `optionOrder` is absent, the grouped edges-array fallback runs
  // unchanged (backward compatible).
  if (node.optionOrder !== undefined) {
    const orderedEdges = orderedOutgoingEdges(graph, state.currentNodeId);
    if (orderedEdges.length > 0) {
      const optionList = actionZone.createDiv({ cls: 'rp-option-list rp-stack' });
      optionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
      for (const edge of orderedEdges) {
        const target = graph.nodes.get(edge.toNodeId);
        if (target === undefined) continue;
        if (target.kind === 'answer') {
          appendAnswerButton(optionList, target, host);
        } else if (target.kind === 'question') {
          appendQuestionTransitionButton(optionList, edge, graph, host);
        } else if (target.kind === 'snippet') {
          appendSnippetBranchButton(optionList, target, host);
        }
      }
    }
    return 'rendered';
  }

  // Phase 31: partition outgoing neighbors into answer + snippet branches.
  const neighborIds = graph.adjacency.get(state.currentNodeId) ?? [];
  const answerNeighbors: AnswerNode[] = [];
  const snippetNeighbors: SnippetNode[] = [];
  for (const nid of neighborIds) {
    const neighbor = graph.nodes.get(nid);
    if (neighbor === undefined) continue;
    if (neighbor.kind === 'answer') answerNeighbors.push(neighbor);
    else if (neighbor.kind === 'snippet') snippetNeighbors.push(neighbor);
  }

  if (answerNeighbors.length > 0) {
    const answerList = actionZone.createDiv({ cls: 'rp-answer-list rp-stack' });
    answerList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    for (const answerNode of answerNeighbors) {
      appendAnswerButton(answerList, answerNode, host);
    }
  }

  // Direct Question transitions are edge-sensitive: preserve persisted edge
  // order, caption, and identity rather than reducing them to adjacency IDs.
  const questionEdges = graph.edges.filter((edge) => {
    if (edge.fromNodeId !== state.currentNodeId) return false;
    return graph.nodes.get(edge.toNodeId)?.kind === 'question';
  });

  if (questionEdges.length > 0) {
    const transitionList = actionZone.createDiv({ cls: 'rp-question-transition-list' });
    if (answerNeighbors.length === 0) {
      transitionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const edge of questionEdges) {
      appendQuestionTransitionButton(transitionList, edge, graph, host);
    }
  }

  if (snippetNeighbors.length > 0) {
    // Phase 31 D-02: snippet branches render below answers, visually distinct.
    const snippetList = actionZone.createDiv({ cls: 'rp-snippet-branch-list' });
    if (answerNeighbors.length === 0) {
      snippetList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const snippetNode of snippetNeighbors) {
      appendSnippetBranchButton(snippetList, snippetNode, host);
    }
  }

  return 'rendered';
// (Guards before `textZone.createEl` — graph null, node missing, kind !== 'question' — unchanged.)
```

#### 2. src/runner/render/render-loop-picker.ts
**File**: src/runner/render/render-loop-picker.ts
**Changes**: MODIFY — reorder `outgoing` via `orderedOutgoingEdges` before the per-edge loop.

```typescript
// Add import after the `node-label` import:
import { orderedOutgoingEdges } from '../../graph/edge-order';

// Replace the outgoing-edge line:
  // RUN-01: one button per outgoing edge (Pitfall 4 — filter edges, not adjacency).
  const outgoing = orderedOutgoingEdges(graph, state.nodeId);
// (everything else — the per-edge loop, isLoopExit classification, captions,
//  callbacks — is unchanged.)
```

#### 3. src/__tests__/runner/render-question.test.ts
**File**: src/__tests__/runner/render-question.test.ts
**Changes**: MODIFY — add authored-order + interleaved-kinds test; assert fallback unchanged.

```typescript
// Add inside the existing `describe('shared question branch renderer', ...)` block:

  it('renders an interleaved single stack in authored optionOrder (per-kind buttons preserved)', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const onChooseAnswer = vi.fn();
    const onChooseSnippetBranch = vi.fn();
    const onChooseQuestionBranch = vi.fn();

    const q = baseNode('q', 'question', { questionText: 'Pick one', optionOrder: ['e-snippet', 'e-a1', 'e-q2'] });
    const nodes = new Map<string, RPNode>();
    nodes.set('q', q);
    nodes.set('a1', baseNode('a1', 'answer', { answerText: 'Raw answer', displayLabel: 'Shown answer' }));
    nodes.set('s-file', baseNode('s-file', 'snippet', { radiprotocol_snippetPath: 'Chest/report.json' }));
    nodes.set('q2', baseNode('q2', 'question', { questionText: 'Next question' }));
    const graph: ProtocolGraph = {
      canvasFilePath: 'test.canvas',
      nodes,
      edges: [
        { id: 'e-a1', fromNodeId: 'q', toNodeId: 'a1' },
        { id: 'e-q2', fromNodeId: 'q', toNodeId: 'q2', label: 'Go to q2' },
        { id: 'e-snippet', fromNodeId: 'q', toNodeId: 's-file' },
      ],
      adjacency: new Map([['q', ['a1', 'q2', 's-file']]]),
      reverseAdjacency: new Map(),
      startNodeId: 'q',
    };

    const result = renderQuestionAtNode(asHtml(textZone), asHtml(actionZone), graph, {
      status: 'at-node', currentNodeId: 'q', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseAnswer,
      onChooseSnippetBranch,
      onChooseQuestionBranch,
    });

    expect(result).toBe('rendered');
    expect(actionZone.children.map((c) => c.cls)).toEqual(['rp-option-list rp-stack']);
    const buttons = actionZone.children[0]!.children;
    expect(buttons.map((b) => b.cls)).toEqual(['rp-snippet-branch-btn', 'rp-answer-btn', 'rp-question-transition-btn']);
    expect(buttons.map((b) => b.text)).toEqual(['📄 report', 'Shown answer', 'Go to q2']);

    buttons[0]!.clickHandler?.({} as MouseEvent);
    buttons[1]!.clickHandler?.({} as MouseEvent);
    buttons[2]!.clickHandler?.({} as MouseEvent);
    expect(onChooseSnippetBranch.mock.calls[0]?.[0].id).toBe('s-file');
    expect(onChooseSnippetBranch.mock.calls[0]?.[1]).toBe(true);
    expect(onChooseAnswer.mock.calls[0]?.[0].id).toBe('a1');
    expect(onChooseQuestionBranch.mock.calls[0]?.[0].id).toBe('e-q2');
  });
```

#### 4. src/__tests__/runner/render-loop-picker.test.ts
**File**: src/__tests__/runner/render-loop-picker.test.ts
**Changes**: MODIFY — add authored-order loop-picker test.

```typescript
// Add inside the existing `describe('shared loop picker renderer', ...)` block:

  it('renders body/exit buttons in authored optionOrder when present', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const bodyEdge = { id: 'e-body', fromNodeId: 'loop', toNodeId: 'body' };
    const exitEdge = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: 'finish', isLoopExit: true };
    const onChooseLoopBranch = vi.fn();

    // Authored order: exit first, then body (reverse of edges-array order).
    const orderedGraph: ProtocolGraph = {
      ...graph([bodyEdge, exitEdge]),
      nodes: new Map<string, RPNode>([
        ['loop', node('loop', 'question', { questionText: 'Repeat?', loop: true, optionOrder: ['e-exit', 'e-body'] })],
        ['body', node('body', 'answer', { answerText: 'Body answer', displayLabel: 'Body label' })],
        ['exit', node('exit', 'text-block', { content: 'Done' })],
      ]),
    };

    renderLoopPicker(asHtml(textZone), asHtml(actionZone), orderedGraph, {
      status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 0,
    }, {
      bindClick: (el, handler) => { (el as unknown as MockEl).clickHandler = handler; },
      renderError: vi.fn(),
      onChooseLoopBranch,
    });

    const list = findByClass(actionZone, 'rp-loop-picker-list')[0]!;
    expect(list.children.map((b) => b.cls)).toEqual(['rp-loop-exit-btn', 'rp-loop-body-btn']);
    expect(list.children.map((b) => b.text)).toEqual(['finish', 'Body label']);
  });
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] render-question tests pass: `npx vitest run src/__tests__/runner/render-question.test.ts`
- [x] render-loop-picker tests pass: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts`

#### Manual Verification:
- [ ] optionOrder present → single `rp-option-list` container with buttons in authored order, per-kind CSS classes/captions/callbacks preserved (shared helpers)
- [ ] optionOrder absent → three-group fallback renders byte-identical (existing tests unchanged)
- [ ] loop picker renders body/exit buttons in authored order when optionOrder present

---

## Phase 4: Skip authored order

### Overview
`protocol-runner.ts` `skip()` uses the projection when `optionOrder` is present (first answer in authored order, adjacency-scan fallback if answerless). Depends on Phase 2.

### Changes Required:

#### 1. src/runner/protocol-runner.ts
**File**: src/runner/protocol-runner.ts
**Changes**: MODIFY — import `orderedOutgoingEdges`; in `skip()`, when `optionOrder` present, find first answer-kind target via the projection, fall back to adjacency scan if none.

```typescript
// Add import after the `graph-model` import
// (`import type { ProtocolGraph, LoopContext } from '../graph/graph-model';`):
import { orderedOutgoingEdges } from '../graph/edge-order';

// Replace the selection-scan block inside `skip()` (the
// `// D-08 / D-09: first ANSWER-kind neighbor...` block through
// `if (skipTargetId === undefined) return;`) with:
    // FR-8 / D-08 / D-09: select the first answer-kind option. When the question
    // carries an authored `optionOrder`, resolve its outgoing edges in display
    // order and pick the first whose target is an answer; stale ids yield no
    // target and are skipped silently. If `optionOrder` is absent OR yields no
    // answer edge, fall back to today's adjacency-order scan.
    let skipTargetId: string | undefined;
    if (currentNode.optionOrder !== undefined) {
      const orderedEdges = orderedOutgoingEdges(this.graph, this.currentNodeId);
      for (const edge of orderedEdges) {
        const target = this.graph.nodes.get(edge.toNodeId);
        if (target !== undefined && target.kind === 'answer') { skipTargetId = edge.toNodeId; break; }
      }
    }
    if (skipTargetId === undefined) {
      const neighborIds = this.graph.adjacency.get(this.currentNodeId) ?? [];
      for (const nid of neighborIds) {
        const n = this.graph.nodes.get(nid);
        if (n !== undefined && n.kind === 'answer') { skipTargetId = nid; break; }
      }
    }
    if (skipTargetId === undefined) return;  // no answer neighbor — UI hides the button, this is defence in depth
// (The downstream hop — `const answerNeighbors = this.graph.adjacency.get(skipTargetId);`
//  ... advanceThrough(next) — is unchanged.)
```

#### 2. src/__tests__/runner/protocol-runner-skip.test.ts
**File**: src/__tests__/runner/protocol-runner-skip.test.ts
**Changes**: MODIFY — add authored-order skip test, answerless-fallback test, stale-id skip test.

```typescript
// Change the import to add `RPEdge`:
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';

// Append a new describe block at the end of the file:

describe('ProtocolRunner.skip() — optionOrder (FR-8/FR-9)', () => {
  function makeOrderedQuestionGraph(opts: {
    optionOrder: string[];
    edges: Array<{ id: string; toNodeId: string; toKind: 'answer' | 'snippet' | 'text-block' }>;
    answerDownstream?: Record<string, string>;
  }): ProtocolGraph {
    const nodes = new Map<string, RPNode>();
    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    const edges: RPEdge[] = [];

    nodes.set('n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 200, height: 60 });
    nodes.set('q1', {
      id: 'q1', kind: 'question',
      x: 0, y: 120, width: 200, height: 60,
      questionText: 'Q?',
      optionOrder: opts.optionOrder,
    } as RPNode);
    adjacency.set('n-start', ['q1']);

    const qNeighbors: string[] = [];
    for (const e of opts.edges) {
      if (e.toKind === 'answer') {
        nodes.set(e.toNodeId, { id: e.toNodeId, kind: 'answer', x: 260, y: 0, width: 200, height: 60, answerText: `A:${e.toNodeId}` } as RPNode);
      } else if (e.toKind === 'snippet') {
        nodes.set(e.toNodeId, { id: e.toNodeId, kind: 'snippet', x: 260, y: 0, width: 200, height: 60, subfolderPath: 'sub' } as RPNode);
      } else {
        nodes.set(e.toNodeId, { id: e.toNodeId, kind: 'text-block', x: 260, y: 0, width: 200, height: 60, content: `T:${e.toNodeId}` } as RPNode);
      }
      edges.push({ id: e.id, fromNodeId: 'q1', toNodeId: e.toNodeId });
      qNeighbors.push(e.toNodeId);
    }
    adjacency.set('q1', qNeighbors);

    for (const [answerId, content] of Object.entries(opts.answerDownstream ?? {})) {
      const tbId = `tb-${answerId}`;
      nodes.set(tbId, { id: tbId, kind: 'text-block', x: 520, y: 0, width: 200, height: 60, content } as RPNode);
      adjacency.set(answerId, [tbId]);
      adjacency.set(tbId, []);
    }
    for (const nid of qNeighbors) {
      if (!adjacency.has(nid)) adjacency.set(nid, []);
    }

    return {
      canvasFilePath: 'test:option-order-skip.canvas',
      nodes, edges, adjacency, reverseAdjacency,
      startNodeId: 'n-start',
    };
  }

  it('FR-8: optionOrder present → skip picks the first answer in authored order (not adjacency order)', () => {
    const runner = new ProtocolRunner();
    // Adjacency order: [a1, a2, s0]. Authored order: [s0, a2, a1].
    // First answer in authored order = a2 (adjacency-first would be a1).
    const graph = makeOrderedQuestionGraph({
      optionOrder: ['e-snippet', 'e-a2', 'e-a1'],
      edges: [
        { id: 'e-a1', toNodeId: 'a1', toKind: 'answer' },
        { id: 'e-a2', toNodeId: 'a2', toKind: 'answer' },
        { id: 'e-snippet', toNodeId: 's0', toKind: 'snippet' },
      ],
      answerDownstream: { a1: 'DS1', a2: 'DS2' },
    });
    runner.start(graph);
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q1');

    runner.skip();

    state = runner.getState();
    let finalText = '';
    if (state.status === 'complete') finalText = state.finalText;
    else if (state.status === 'at-node') finalText = state.accumulatedText;
    expect(finalText).toContain('DS2');
    expect(finalText).not.toContain('DS1');
    expect(finalText).not.toContain('A:a1');
    expect(finalText).not.toContain('A:a2');
  });

  it('FR-9: stale id in optionOrder → skipped silently, first real answer picked', () => {
    const runner = new ProtocolRunner();
    const graph = makeOrderedQuestionGraph({
      optionOrder: ['e-stale', 'e-a1'],
      edges: [
        { id: 'e-a1', toNodeId: 'a1', toKind: 'answer' },
      ],
      answerDownstream: { a1: 'DS1' },
    });
    runner.start(graph);
    runner.skip();
    const state = runner.getState();
    const finalText = state.status === 'complete' ? state.finalText : '';
    expect(finalText).toContain('DS1');
  });

  it('FR-8 fallback: optionOrder present but no answer edges → skip no-op', () => {
    const runner = new ProtocolRunner();
    const graph = makeOrderedQuestionGraph({
      optionOrder: ['e-snippet'],
      edges: [
        { id: 'e-snippet', toNodeId: 's0', toKind: 'snippet' },
      ],
    });
    runner.start(graph);
    const stateBefore = runner.getState();
    const undoBefore = runner.getSerializableState()?.undoStack.length ?? 0;
    runner.skip();
    const stateAfter = runner.getState();
    expect(stateAfter.status).toBe('at-node');
    if (stateAfter.status === 'at-node') {
      expect(stateAfter.currentNodeId).toBe('q1');
      expect(stateAfter.accumulatedText).toBe(stateBefore.status === 'at-node' ? stateBefore.accumulatedText : '');
    }
    expect(runner.getSerializableState()?.undoStack.length ?? 0).toBe(undoBefore);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] skip tests pass: `npx vitest run src/__tests__/runner/protocol-runner-skip.test.ts`

#### Manual Verification:
- [ ] optionOrder present → skip picks first answer in authored order (a2 over adjacency-first a1)
- [ ] stale id in optionOrder → skipped silently, real answer picked
- [ ] optionOrder present but no answer edges → skip no-op (adjacency fallback also finds none)

---

## Phase 5: Editor chip module + i18n + modal mount

### Overview
New `src/views/option-order-chip-editor.ts` (`mountOptionOrderChips` with DnD splice + `destroy()`); i18n keys in en+ru; mount the chip list in the `openEditModal` question case with a `textControls` entry (empty → omit key). Depends on Phase 1 (on-disk field).

### Changes Required:

#### 1. src/views/option-order-chip-editor.ts
**File**: src/views/option-order-chip-editor.ts
**Changes**: NEW — focused reorderable chip-list module.

```typescript
// views/option-order-chip-editor.ts
// Focused reorderable chip list for a Question node's outgoing connections.
// Caller owns the `draft` (an ordered array of {id, label} items); this helper
// mutates it in place on DnD reorder and calls `onChange()` after every
// user-visible mutation. Mirrors the tracked-listener + destroy() + splice-DnD
// structure of snippet-chip-editor.ts (Phase 33 MODAL-06), reduced to the
// simple reorder-only case (no add/remove/expand — chips are 1:1 with current
// outgoing edges). Zero plugin/view state; pure DOM + draft mutation.

import { defaultT, type Translator } from '../i18n';

export interface OptionOrderChipItem {
  /** Edge id (stable selection identity). */
  id: string;
  /** Display label for the chip (edge caption / target label). User-authored content — never wrapped in t(). */
  label: string;
}

export interface OptionOrderChipEditorHandle {
  /** Detach event listeners and clear the container. Called on modal close. */
  destroy(): void;
}

interface MountOptionOrderChipsOptions {
  /** Translator for the section heading, help text, and drag aria label. */
  t?: Translator;
}

type ListenerTuple = {
  el: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
};

export function mountOptionOrderChips(
  container: HTMLElement,
  draft: OptionOrderChipItem[],
  onChange: () => void,
  options: MountOptionOrderChipsOptions = {},
): OptionOrderChipEditorHandle {
  container.empty();
  const listeners: ListenerTuple[] = [];
  const t: Translator = options.t ?? defaultT;

  const onRaw = (el: EventTarget, type: string, handler: EventListener): void => {
    el.addEventListener(type, handler);
    listeners.push({ el, type, handler });
  };

  const field = container.createDiv({ cls: 'rp-protocol-editor-modal-field rp-option-order-field' });
  field.createEl('label', { text: t('protocolEditor.optionOrderLabel') });
  field.createDiv({ cls: 'rp-option-order-help', text: t('protocolEditor.optionOrderHelp') });
  const list = field.createDiv({ cls: 'rp-option-order-chip-list' });

  function renderList(): void {
    list.empty();
    for (let i = 0; i < draft.length; i++) {
      const item = draft[i];
      if (item === undefined) continue;
      renderChip(item, i);
    }
  }

  function renderChip(item: OptionOrderChipItem, index: number): void {
    const chip = list.createDiv({ cls: 'rp-option-order-chip' });
    chip.setAttribute('draggable', 'true');
    chip.dataset['dragIndex'] = String(index);

    const handle = chip.createSpan({ cls: 'rp-option-order-chip-handle' });
    handle.textContent = '⠿'; // non-translatable drag-handle glyph
    handle.setAttribute('aria-label', t('protocolEditor.optionOrderDragAria', { label: item.label }));

    const labelSpan = chip.createSpan({ cls: 'rp-option-order-chip-label' });
    labelSpan.textContent = item.label; // user-authored content, not a UI string

    onRaw(chip, 'dragstart', ((e: DragEvent) => {
      e.dataTransfer?.setData('text/plain', chip.dataset['dragIndex'] ?? String(index));
    }) as EventListener);
    onRaw(chip, 'dragover', ((e: DragEvent) => {
      e.preventDefault();
      chip.addClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'dragenter', ((e: DragEvent) => {
      e.preventDefault();
      chip.addClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'dragleave', ((e: DragEvent) => {
      if (chip.contains(e.relatedTarget as Node | null)) return;
      chip.removeClass('drag-over');
    }) as EventListener);
    onRaw(chip, 'drop', ((e: DragEvent) => {
      e.preventDefault();
      chip.removeClass('drag-over');
      const fromStr = e.dataTransfer?.getData('text/plain');
      const from = fromStr !== undefined ? parseInt(fromStr, 10) : -1;
      const to = parseInt(chip.dataset['dragIndex'] ?? '-1', 10);
      if (isNaN(from) || isNaN(to) || from === to || from < 0 || to < 0) return;
      if (from >= draft.length || to >= draft.length) return;
      const [moved] = draft.splice(from, 1);
      if (moved !== undefined) draft.splice(to, 0, moved);
      renderList();
      onChange();
    }) as EventListener);
    onRaw(chip, 'dragend', (() => {
      list.querySelectorAll('.drag-over').forEach((el) => (el as HTMLElement).removeClass('drag-over'));
    }) as EventListener);
  }

  renderList();

  return {
    destroy(): void {
      for (const { el, type, handler } of listeners) {
        el.removeEventListener(type, handler);
      }
      listeners.length = 0;
      container.empty();
    },
  };
}
```

#### 2. src/views/protocol-editor-view.ts
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — import `mountOptionOrderChips`; in the `openEditModal` question case, build the chip list (labels from existing edge-label helpers) on a closure-held draft + `textControls` entry; `destroy()` on modal close.

```typescript
// Add import (near the other `./` view imports):
import { mountOptionOrderChips, type OptionOrderChipItem } from './option-order-chip-editor';

// Add two module-local helpers (near `deriveProtocolEditorEdgeLabel`):
function optionOrderChipLabel(
  edge: ProtocolEdgeRecord,
  targetNode: ProtocolNodeRecord | undefined,
): string {
  // Authored non-blank edge label wins for all kinds; answer/snippet targets get
  // their default label via deriveProtocolEditorEdgeLabel. Question/text-block/
  // loop targets fall back to kind-aware on-disk fields mirroring `nodeLabel`
  // (node-label.ts) so chip captions match the runner's per-kind captions.
  // Labels are user-authored — never wrapped in t().
  const derived = deriveProtocolEditorEdgeLabel(targetNode, edge.label);
  if (derived !== undefined && derived.trim() !== '') return derived;
  if (targetNode === undefined) return edge.toNodeId;
  const kind = targetNode.kind;
  if (kind === 'question') {
    const qt = targetNode.fields['questionText'];
    if (typeof qt === 'string' && qt.trim() !== '') return qt;
  } else if (kind === 'text-block') {
    const content = targetNode.fields['content'];
    if (typeof content === 'string' && content.trim() !== '') return content.slice(0, 30);
  } else if (kind === 'loop-start') {
    const ll = targetNode.fields['loopLabel'];
    if (typeof ll === 'string' && ll.trim() !== '') return ll;
  }
  if (typeof targetNode.text === 'string' && targetNode.text.trim() !== '') return targetNode.text;
  return targetNode.id;
}

// Order on-disk outgoing-edge items by the question's `fields.optionOrder`.
// Mirrors `orderedOutgoingEdges` (src/graph/edge-order.ts) but operates on a
// generic `{ id }` item list (the editor works with on-disk records, not the
// runtime ProtocolGraph). Listed ids emit in order (stale + duplicates dropped);
// unlisted items append at the end in original order; absent `optionOrder`
// returns items unchanged (fallback). Stale ids are dropped here so the chip
// list shows only currently-outgoing edges (FR-3/FR-9); the on-disk field is
// rebuilt from the chip draft on save.
function orderItemsByOptionOrder<T extends { id: string }>(items: T[], optionOrder: string[] | undefined): T[] {
  if (optionOrder === undefined) return items;
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of optionOrder) {
    if (typeof id !== 'string') continue;
    const item = byId.get(id);
    if (item === undefined || seen.has(id)) continue;
    seen.add(id);
    ordered.push(item);
  }
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ordered.push(item);
  }
  return ordered;
}

// In `openEditModal`, WIDEN the `textControls` declaration to accept `string[]`:
  const textControls: Array<{ key: string; value: () => string | boolean | string[] | undefined }> = [];

// After `let closeActiveSnippetTargetPicker: (() => void) | null = null;` add:
    let optionOrderChipHandle: { destroy(): void } | null = null;

// In `closeModal`, before `modalEl.remove();` add:
      optionOrderChipHandle?.destroy();
      optionOrderChipHandle = null;

// Add the `addOptionOrderChips` closure (right after `addLoopToggle`):
    const addOptionOrderChips = (nodeRecord: ProtocolNodeRecord) => {
      const outgoing = (this.doc?.edges ?? []).filter((e) => e.fromNodeId === nodeRecord.id);
      const nodeById = new Map((this.doc?.nodes ?? []).map((n) => [n.id, n] as [string, ProtocolNodeRecord]));
      const items: OptionOrderChipItem[] = outgoing.map((e) => ({
        id: e.id,
        label: optionOrderChipLabel(e, nodeById.get(e.toNodeId)),
      }));
      const optionOrderRaw = nodeRecord.fields['optionOrder'];
      const originalOptionOrder = Array.isArray(optionOrderRaw)
        ? optionOrderRaw.filter((v): v is string => typeof v === 'string')
        : undefined;
      const originallyPresent = originalOptionOrder !== undefined;
      const draft = orderItemsByOptionOrder(items, originalOptionOrder);
      // FR-5/FR-9/backward-compat: persist only when the user reordered (modified)
      // OR the question already had an optionOrder — so saving a legacy question
      // without reordering does NOT activate the interleaved renderer (existing
      // protocols keep their grouped rendering) and does NOT scrub the field.
      // When the user reorders, preserve any original stale ids (edges since
      // deleted/reassigned) appended after the reordered live ids — stale ids are
      // filtered at render, never cleaned on write (FR-9).
      let modified = false;
      const container = body.createDiv({ cls: 'rp-option-order-chip-host' });
      optionOrderChipHandle = mountOptionOrderChips(container, draft, () => { modified = true; }, { t });
      textControls.push({
        key: 'optionOrder',
        value: () => {
          if (!modified && !originallyPresent) return undefined;     // legacy save, no reorder → omit (fallback preserved)
          if (!modified) return originalOptionOrder;                 // originally present, untouched → preserve verbatim (incl. stale ids)
          const draftIds = draft.map((i) => i.id);
          const liveIds = new Set(draftIds);
          const stale = (originalOptionOrder ?? []).filter((id) => !liveIds.has(id));
          return [...draftIds, ...stale];                            // reordered: live ids + preserved stale
        },
      });
    };

// In the `switch (node.kind)` question case, add the call after `addLoopToggle(node)`:
      case 'question':
        addInput('questionText', t('protocolEditor.questionTextLabel'), node.fields['questionText'] ?? node.text, true);
        addLoopToggle(node);
        addOptionOrderChips(node);
        break;
```

#### 3. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add `protocolEditor.optionOrder*` keys (section heading, help, drag aria).

```json
// Add inside the `protocolEditor` object, after `loopBadgeAriaLabel`:
    "loopBadgeAriaLabel": "Loop question",
    "optionOrderLabel": "Display order",
    "optionOrderHelp": "Drag chips to reorder this question's options as they appear in the Runner.",
    "optionOrderDragAria": "Drag to reorder {label}"
  },
```

#### 4. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the same `protocolEditor.optionOrder*` keys in Russian.

```json
// Add inside the `protocolEditor` object, after `loopBadgeAriaLabel`:
    "loopBadgeAriaLabel": "Циклический вопрос",
    "optionOrderLabel": "Порядок отображения",
    "optionOrderHelp": "Перетащите чипы, чтобы изменить порядок вариантов этого вопроса в Runner.",
    "optionOrderDragAria": "Перетащите, чтобы переупорядочить {label}"
  },
```

#### 5. src/__tests__/views/option-order-chip-editor.test.ts
**File**: src/__tests__/views/option-order-chip-editor.test.ts
**Changes**: NEW — chip render + DnD reorder + destroy unit tests.

```typescript
// src/__tests__/views/option-order-chip-editor.test.ts
// Unit tests for the reorderable option-order chip list.

import { describe, it, expect, vi } from 'vitest';
import { mountOptionOrderChips, type OptionOrderChipItem } from '../../views/option-order-chip-editor';

class MockEl {
  children: MockEl[] = [];
  cls = '';
  textContent = '';
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  private listeners = new Map<string, EventListener[]>();

  constructor(readonly tag: string) {}

  empty(): void { this.children = []; }

  createDiv(opts?: { cls?: string; text?: string }): MockEl {
    const child = new MockEl('div');
    child.cls = opts?.cls ?? '';
    child.textContent = opts?.text ?? '';
    this.children.push(child);
    return child;
  }
  createEl(tag: string, opts?: { cls?: string; text?: string }): MockEl {
    const child = new MockEl(tag);
    child.cls = opts?.cls ?? '';
    child.textContent = opts?.text ?? '';
    this.children.push(child);
    return child;
  }
  createSpan(opts?: { cls?: string }): MockEl {
    const child = new MockEl('span');
    child.cls = opts?.cls ?? '';
    this.children.push(child);
    return child;
  }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value); }
  addClass(c: string): void { if (!this.cls.split(/\s+/).includes(c)) this.cls = (this.cls + ' ' + c).trim(); }
  removeClass(c: string): void { this.cls = this.cls.split(/\s+/).filter((x) => x !== c).join(' ').trim(); }
  contains(_node: Node | null): boolean { return false; }
  querySelectorAll(selector: string): MockEl[] {
    const want = selector.replace(/^\./, '');
    const out: MockEl[] = [];
    const visit = (el: MockEl): void => {
      if (el.cls.split(/\s+/).includes(want)) out.push(el);
      for (const child of el.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return out;
  }
  querySelector(selector: string): MockEl | undefined { return this.querySelectorAll(selector)[0]; }
  addEventListener(type: string, handler: EventListener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(handler);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, handler: EventListener): void {
    const arr = this.listeners.get(type);
    if (arr) this.listeners.set(type, arr.filter((h) => h !== handler));
  }
  dispatch(type: string, event: unknown): void {
    for (const h of this.listeners.get(type) ?? []) (h as EventListener)(event as Event);
  }
}

function asHtml(el: MockEl): HTMLElement { return el as unknown as HTMLElement; }

function makeDataTransfer(): { setData: (k: string, v: string) => void; getData: (k: string) => string } {
  const store: Record<string, string> = {};
  return { setData: (k, v) => { store[k] = v; }, getData: (k) => store[k] ?? '' };
}
function makeEvent(dt: { setData: (k: string, v: string) => void; getData: (k: string) => string }): unknown {
  return { dataTransfer: dt, preventDefault: () => {}, relatedTarget: null };
}

const t = (key: string, params?: Record<string, string>): string =>
  key === 'protocolEditor.optionOrderDragAria' ? `Drag ${params?.['label'] ?? ''}` : key;

describe('mountOptionOrderChips', () => {
  it('renders one chip per draft item with its label and draggable attr', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'Answer A' },
      { id: 'e2', label: 'Snippet B' },
    ];
    mountOptionOrderChips(asHtml(container), draft, () => {}, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    expect(chips.length).toBe(2);
    expect(chips.map((c) => c.querySelector('rp-option-order-chip-label')?.textContent)).toEqual(['Answer A', 'Snippet B']);
    expect(chips.map((c) => c.attrs.get('draggable'))).toEqual(['true', 'true']);
  });

  it('DnD drop reorders the draft in place and calls onChange', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
      { id: 'e3', label: 'C' },
    ];
    const onChange = vi.fn();
    mountOptionOrderChips(asHtml(container), draft, onChange, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    const dt = makeDataTransfer();
    chips[0]!.dispatch('dragstart', makeEvent(dt));  // from = 0
    chips[2]!.dispatch('drop', makeEvent(dt));        // to = 2
    expect(draft.map((d) => d.id)).toEqual(['e2', 'e3', 'e1']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores a drop with no transferred data (no reorder, no onChange)', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
    ];
    const onChange = vi.fn();
    mountOptionOrderChips(asHtml(container), draft, onChange, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    chips[1]!.dispatch('drop', makeEvent(makeDataTransfer()));  // empty dataTransfer → from = NaN
    expect(draft.map((d) => d.id)).toEqual(['e1', 'e2']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('destroy empties the container', () => {
    const container = new MockEl('div');
    const handle = mountOptionOrderChips(asHtml(container), [{ id: 'e1', label: 'A' }], () => {}, { t });
    expect(container.children.length).toBeGreaterThan(0);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });

  it('clicking a chip or its drag handle does not corrupt the draft (reorder-only — no click handler)', () => {
    const container = new MockEl('div');
    const draft: OptionOrderChipItem[] = [
      { id: 'e1', label: 'A' },
      { id: 'e2', label: 'B' },
    ];
    mountOptionOrderChips(asHtml(container), draft, () => {}, { t });
    const chips = container.querySelectorAll('rp-option-order-chip');
    const handles = container.querySelectorAll('rp-option-order-chip-handle');
    // Chips are reorder-only (no expand/toggle); no 'click' listener is registered,
    // so a stray click cannot corrupt the draft (DnD click-guard precedent 9900a56).
    chips[0]!.dispatch('click', {});
    handles[0]!.dispatch('click', {});
    expect(draft.map((d) => d.id)).toEqual(['e1', 'e2']);
  });
});
```

#### 6. src/styles/protocol-editor.css
**File**: src/styles/protocol-editor.css
**Changes**: MODIFY — add option-order chip list styles (mirrors the snippet placeholder chip pattern; reorder-only — no expand/badge/remove).

```css
/* FR optionOrder — draggable display-order chip list in the Question node modal. */
.rp-option-order-field {
  margin-top: var(--size-4-2);
}

.rp-option-order-help {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  margin-bottom: var(--size-4-2);
}

.rp-option-order-chip-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-4-1);
}

.rp-option-order-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--size-4-1);
  padding: 0 var(--size-4-1);
  border-left: 4px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  min-height: 32px;
}

.rp-option-order-chip.drag-over {
  background: var(--background-modifier-hover);
  outline: 1px dashed var(--interactive-accent);
}

.rp-option-order-chip-handle {
  cursor: grab;
  width: 24px;
  flex: 0 0 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-text-size);
  color: var(--text-muted);
  user-select: none;
}

.rp-option-order-chip-handle:active {
  cursor: grabbing;
}

.rp-option-order-chip-label {
  flex: 1 1 auto;
  font-size: var(--font-text-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Chip editor tests pass: `npx vitest run src/__tests__/views/option-order-chip-editor.test.ts`
- [x] Stylelint passes on the new CSS: `npx stylelint src/styles/protocol-editor.css`

#### Manual Verification:
- [ ] Question node edit modal shows a "Display order" chip list of its outgoing connections (kind-aware labels)
- [ ] Dragging a chip reorders the draft; saving persists `optionOrder`; reopening the modal shows the same order (editor drag→save→persist integration test is in Phase 6's `protocol-editor-keyboard.test.ts`)
- [ ] Saving a legacy question (no `optionOrder`) without reordering does NOT persist `optionOrder` (grouped rendering preserved); stale ids are preserved on disk when reordering

---

## Phase 6: FR-6 edge-append integration

### Overview
Append the new edge id to the source question's `fields.optionOrder` inside the same `protocolDocumentStore.update` mutator that appends the edge, at both `addNodeAndConnectAtWorldPoint` and `finishConnectionDrag` (only when `optionOrder` already exists). Depends on Phase 5 (same file).

### Changes Required:

#### 1. src/views/protocol-editor-view.ts
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — in both edge-append mutators, when the source node has `fields.optionOrder`, append the new edge id to it inside the same `update()`.

```typescript
// Add this exported helper near the Phase 5 `optionOrderChipLabel`/`orderItemsByOptionOrder`
// helpers (do NOT modify the Phase 5 helpers):

// FR-6: when a new outgoing edge is appended to a question that already has an
// authored `fields.optionOrder`, append the new edge id to the end of that list
// inside the same `protocolDocumentStore.update` mutator that appends the edge
// (atomic — one WriteMutex-protected write). No-op when the source is not a
// question or has no array optionOrder. Returns a new nodes array; the source
// node is shallow-copied with an updated `fields` object so unrelated metadata
// is preserved by the `{ ...n.fields }` spread. Exported for unit testing.
export function appendEdgeIdToOptionOrder(
  nodes: ProtocolNodeRecord[],
  sourceNodeId: string,
  edgeId: string,
): ProtocolNodeRecord[] {
  return nodes.map((n) => {
    if (n.id !== sourceNodeId || n.kind !== 'question') return n;
    const existingOrder = n.fields['optionOrder'];
    if (!Array.isArray(existingOrder)) return n;
    return {
      ...n,
      fields: { ...n.fields, optionOrder: [...existingOrder, edgeId] },
    };
  });
}

// In `addNodeAndConnectAtWorldPoint`, replace the mutator's edges/nodes/return
// block (currently ~lines 876-891) with:
      const edgeAdded = canCreateProtocolEditorEdge(existing.edges, fromNodeId, newNode.id) === 'ok';
      const edges = edgeAdded ? [...existing.edges, newEdge] : existing.edges;
      const baseNodes = [...existing.nodes, newNode];
      const nodes = edgeAdded ? appendEdgeIdToOptionOrder(baseNodes, fromNodeId, newEdge.id) : baseNodes;
      return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };

// In `finishConnectionDrag`, replace the mutator's return (currently ~line 1476) with:
        if (currentDecision !== 'ok') return existing;
        const nodes = appendEdgeIdToOptionOrder(existing.nodes, state.fromNodeId, newEdge.id);
        return { ...existing, nodes, edges: [...existing.edges, newEdge], viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
```

#### 2. src/__tests__/views/protocol-editor-keyboard.test.ts
**File**: src/__tests__/views/protocol-editor-keyboard.test.ts
**Changes**: MODIFY — add FR-6 append-on-create and append-on-connect persistence tests + FR-5 drag→save→reopen test + heavy-MockEl enhancements for the Phase 5 chip module.

```typescript
// Add `appendEdgeIdToOptionOrder` to the existing import:
import { ProtocolEditorView, appendEdgeIdToOptionOrder } from '../../views/protocol-editor-view';

// Add 6 members to the `MockEl` interface (near the others):
  textContent: string;
  dataset: Record<string, string>;
  getAttr: (name: string) => string | null;
  querySelectorAll: (selector: string) => MockEl[];
  contains: (node: Node | null) => boolean;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;

// Add to the `makeEl` returned object: a `textContent` getter/setter (delegating
// to `el._text`), `dataset`, `getAttr` (after `getAttribute`), `querySelectorAll`
// + `contains` (after `getAttr`), and `removeEventListener` (after `addEventListener`):
    get textContent(): string { return el._text; },
    set textContent(value: string) { el._text = value; },
    dataset: {} as Record<string, string>,
    // ... getAttribute unchanged ...
    getAttr(name: string): string | null { return attrs[name] ?? null; },
    querySelectorAll(selector: string): MockEl[] {
      const want = selector.startsWith('.') ? selector.slice(1) : selector;
      const out: MockEl[] = [];
      const visit = (e: MockEl): void => {
        if (e.classList.has(want)) out.push(e);
        for (const c of e.children) visit(c);
      };
      for (const c of children) visit(c);
      return out;
    },
    contains(_node: Node | null): boolean { return false; },
    // ... addEventListener unchanged ...
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type);
      if (arr) listeners.set(type, arr.filter((h) => h !== handler));
    },

// Append a new describe block at the end of the file:

describe('ProtocolEditorView: optionOrder FR-6 append + FR-5 drag-persist', () => {
  let savedWindow: unknown;
  let savedRAF: unknown;
  let savedDocument: unknown;
  beforeEach(() => {
    savedWindow = (globalThis as any).window;
    savedRAF = (globalThis as any).requestAnimationFrame;
    savedDocument = (globalThis as any).document;
    (globalThis as any).window = globalThis;
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
  });
  afterEach(() => {
    (globalThis as any).window = savedWindow;
    (globalThis as any).requestAnimationFrame = savedRAF;
    (globalThis as any).document = savedDocument;
  });

  function createOptionOrderView(): { view: ProtocolEditorView; documentBody: MockEl; updateSpy: ReturnType<typeof vi.fn> } {
    const documentBody = makeEl('body');
    (globalThis as any).document = { body: documentBody, activeElement: null };
    const holder: { view: ProtocolEditorView | null } = { view: null };
    const updateSpy = vi.fn(async (_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1): Promise<ProtocolDocumentV1> => {
      const current = (holder.view as any).doc as ProtocolDocumentV1;
      const updated = mutator(current);
      (holder.view as any).doc = updated;
      return updated;
    });
    const mockPlugin = { i18n: { t }, settings: { snippetFolderPath: '.radiprotocol/snippets' }, protocolDocumentStore: { update: updateSpy } } as any;
    const view = new ProtocolEditorView({} as any, mockPlugin);
    holder.view = view;
    (view as any).surfaceEl = makeEl('div');
    (view as any).svgEl = makeEl('svg');
    (view as any).viewportEl = makeEl('div');
    (view as any).rootEl = makeEl('div');
    (view as any).protocolPath = 'test.rp.json';
    (view as any).zoom = 1;
    (view as any).loadProtocol = vi.fn(async () => {});
    (view as any).restoreEditorFocus = vi.fn();
    const doc: ProtocolDocumentV1 = {
      schema: 'radiprotocol.protocol', version: 1, id: 'test-doc', title: 'Test',
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
      nodes: [
        { id: 'node-q', kind: 'question', x: 100, y: 100, width: 200, height: 80, text: 'Pick', fields: { questionText: 'Pick', optionOrder: ['e-a'] } },
        { id: 'node-a', kind: 'answer', x: 300, y: 100, width: 200, height: 80, text: 'A', fields: { answerText: 'A' } },
      ],
      edges: [{ id: 'e-a', fromNodeId: 'node-q', toNodeId: 'node-a' }],
    };
    (view as any).doc = doc;
    return { view, documentBody, updateSpy };
  }

  it('FR-6: appendEdgeIdToOptionOrder appends to a question optionOrder; no-op otherwise; immutable', () => {
    const nodes: ProtocolNodeRecord[] = [
      { id: 'q1', kind: 'question', x: 0, y: 0, width: 1, height: 1, fields: { questionText: 'Q', optionOrder: ['e1'] } },
      { id: 'a1', kind: 'answer', x: 0, y: 0, width: 1, height: 1, fields: { answerText: 'A' } },
    ];
    const updated = appendEdgeIdToOptionOrder(nodes, 'q1', 'e2');
    expect(updated[0]!.fields['optionOrder']).toEqual(['e1', 'e2']);
    expect(appendEdgeIdToOptionOrder(nodes, 'a1', 'e2')[0]!.fields['optionOrder']).toEqual(['e1']);
    const noOrder: ProtocolNodeRecord[] = [{ id: 'q2', kind: 'question', x: 0, y: 0, width: 1, height: 1, fields: { questionText: 'Q2' } }];
    expect(appendEdgeIdToOptionOrder(noOrder, 'q2', 'e3')[0]!.fields['optionOrder']).toBeUndefined();
    expect(updated).not.toBe(nodes);
    expect(updated[0]).not.toBe(nodes[0]);
    expect(nodes[0]!.fields['optionOrder']).toEqual(['e1']);
  });

  it('FR-6: addNodeAndConnectAtWorldPoint appends the new edge id to an ordered question', async () => {
    const { view } = createOptionOrderView();
    (view as any).applyCreatedProtocolDocument = vi.fn((updated: ProtocolDocumentV1, id: string) => updated.nodes.find((n) => n.id === id) ?? null);
    (view as any).openEditModal = vi.fn();
    (view as any).addNodeAndConnectAtWorldPoint('node-q', 'answer', 200, 200);
    await new Promise((r) => setTimeout(r, 0));
    const doc = (view as any).doc as ProtocolDocumentV1;
    const newEdge = doc.edges.find((e) => e.fromNodeId === 'node-q' && e.toNodeId !== 'node-a');
    expect(newEdge).toBeDefined();
    expect(doc.nodes.find((n) => n.id === 'node-q')!.fields['optionOrder']).toEqual(['e-a', newEdge!.id]);
  });

  it('FR-6: finishConnectionDrag appends the new edge id to an ordered question', async () => {
    const { view } = createOptionOrderView();
    (view as any).doc.nodes.push({ id: 'node-a2', kind: 'answer', x: 0, y: 0, width: 1, height: 1, fields: { answerText: 'A2' } });
    (view as any).connectionDragState = { fromNodeId: 'node-q', previewPath: makeEl('path') };
    const portEl = makeEl('div');
    portEl.setAttr('data-node-id', 'node-a2');
    (view as any).findInputPortAt = vi.fn(() => portEl);
    (view as any).finishConnectionDrag({ clientX: 0, clientY: 0 } as MouseEvent);
    await new Promise((r) => setTimeout(r, 0));
    const doc = (view as any).doc as ProtocolDocumentV1;
    const newEdge = doc.edges.find((e) => e.fromNodeId === 'node-q' && e.toNodeId === 'node-a2');
    expect(newEdge).toBeDefined();
    expect(doc.nodes.find((n) => n.id === 'node-q')!.fields['optionOrder']).toEqual(['e-a', newEdge!.id]);
  });

  it('FR-5: dragging a chip and saving rewrites optionOrder; reopening shows the same order', async () => {
    const { view, documentBody } = createOptionOrderView();
    (view as any).doc.nodes.push({ id: 'node-a2', kind: 'answer', x: 300, y: 200, width: 200, height: 80, text: 'A2', fields: { answerText: 'A2' } });
    (view as any).doc.edges.push({ id: 'e-b', fromNodeId: 'node-q', toNodeId: 'node-a2' });
    (view as any).doc.nodes.find((n: ProtocolNodeRecord) => n.id === 'node-q').fields['optionOrder'] = ['e-a', 'e-b'];

    (view as any).openEditModal((view as any).doc.nodes.find((n: ProtocolNodeRecord) => n.id === 'node-q'));
    let chips = documentBody.querySelectorAll('.rp-option-order-chip');
    expect(chips.length).toBe(2);
    // DOM order is [e-a (idx 0), e-b (idx 1)]. Drag e-a onto e-b: from=0 → to=1 → [e-b, e-a].
    const dt = { store: {} as Record<string, string>, setData(k: string, v: string) { this.store[k] = v; }, getData(k: string) { return this.store[k] ?? ''; } };
    for (const h of chips[0]!._listeners.get('dragstart') ?? []) h({ dataTransfer: dt, preventDefault() {} });
    for (const h of chips[1]!._listeners.get('drop') ?? []) h({ dataTransfer: dt, preventDefault() {}, relatedTarget: null });

    const saveBtn = findAllByTag(documentBody, 'button').find((b) => b._text === 'Save')!;
    for (const handler of saveBtn._listeners.get('click') ?? []) await handler({});

    const persisted = (view as any).doc as ProtocolDocumentV1;
    expect(persisted.nodes.find((n) => n.id === 'node-q')!.fields['optionOrder']).toEqual(['e-b', 'e-a']);

    // Reopen: chips in DOM order reflect the persisted optionOrder (e-b→A2, e-a→A).
    (view as any).openEditModal((view as any).doc.nodes.find((n: ProtocolNodeRecord) => n.id === 'node-q'));
    chips = documentBody.querySelectorAll('.rp-option-order-chip');
    expect(chips.map((c) => c.querySelector('.rp-option-order-chip-label')?._text)).toEqual(['A2', 'A']);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Editor keyboard tests pass (FR-6 helper + append-on-create + append-on-connect + FR-5 drag-persist+reopen): `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] Whole-plan gate: `npm run check` and `npm test` exit 0

#### Manual Verification:
- [ ] Adding a new answer edge to an ordered question (create or connect) appends its id to `optionOrder` atomically with the edge append; the new option appears at the end of the Runner list
- [ ] Dragging a chip and saving rewrites `optionOrder`; reopening the modal shows the same order (FR-5 integration test covers render→DnD→save→persist→reopen; disk round-trip covered by the existing `protocol-document-store` tests)