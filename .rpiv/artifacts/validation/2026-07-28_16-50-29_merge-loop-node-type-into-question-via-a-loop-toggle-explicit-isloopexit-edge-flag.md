---
template_version: 1
date: 2026-07-28T16:50:29+0300
author: Roman Shulgha
commit: 122d2ae
branch: main
repository: RadiProtocol
topic: "Validation of Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag"
status: ready
verdict: fail
parent: ".rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md"
tags: [validation, graph, protocol, runner, render, editor, picker, i18n, migration]
last_updated: 2026-07-28T16:50:29+0300
---

## Validation Report: Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag

### Implementation Status

- ⚠️ Phase 1: Graph types + label utilities — Partially implemented (stale unified-loop terminology remains)
- ✓ Phase 2: Parser + edge reconstruction — Fully implemented
- ✓ Phase 3: Migration transform + store wiring — Fully implemented
- ✓ Phase 4: Validator + test graph-construction — Fully implemented
- ⚠️ Phase 5: Runner core — Partially implemented (stale loop-node and `+`-exit terminology remains)
- ✓ Phase 6: Render loop picker — Fully implemented
- ✓ Phase 7: Editor — Fully implemented
- ⚠️ Phase 8: Node picker + i18n cleanup — Partially implemented (picker JSDoc contradicts its option surface)
- ✓ Phase 9: Cross-cutting tests + grep audit — Fully implemented

### Automated Verification Results

- ✓ Phase 1 focused tests: `npx vitest run src/__tests__/graph/node-label.test.ts` — 8 tests passed
- ✓ Phase 2 focused tests: `npx vitest run src/__tests__/protocol-document-parser.test.ts` — 23 tests passed
- ✓ Phase 3 focused tests: `npx vitest run src/__tests__/protocol-document-migration.test.ts src/__tests__/protocol-document-store.test.ts src/__tests__/views/inline-runner-modal.test.ts` — 59 tests passed
- ✓ Phase 4 focused tests: `npx vitest run src/__tests__/graph-validator.test.ts` — 32 tests passed
- ✓ Phase 5 focused tests: `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` — 37 tests passed
- ✓ Phase 6 focused tests: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts` — 11 tests passed
- ✓ Phase 7 focused tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts` — 67 tests passed
- ✓ Phase 8 focused tests: `npx vitest run src/__tests__/node-picker-modal.test.ts src/__tests__/runner-commands.test.ts` — 13 tests passed
- ✓ Phase 9 focused tests: `npx vitest run src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` — 8 tests passed
- ✓ Structural grep audit — all required symbols are present; forbidden standalone-loop dispatch and prefix-helper paths are absent
- ✓ Project baseline: `npm run check` — build and lint passed; 58 test files / 749 tests passed; planning, consistency, and agent-doc checks passed. The consistency script emitted its existing Knip advisory warning.
- ✓ `git diff --check` — no whitespace errors
- ✓ No functional regressions detected by the automated suite

### Code Review Findings

#### Matches Plan:

- `src/graph/graph-model.ts:29-43,109-130` — `QuestionNode.loop` and `RPEdge.isLoopExit` are optional canonical fields; standalone `LoopNode` is absent from `RPNode`.
- `src/protocol/protocol-document-parser.ts:54-66,126-135,198-209` — optional booleans preserve three states, edge reconstruction accepts only explicit `true`, and standalone legacy Loop is rejected outside migration.
- `src/protocol/protocol-document-migration.ts:39-94` — migration is pure, exact-discriminator scoped, defensive, lossless through layered spreads, and idempotent.
- `src/protocol/protocol-document-store.ts:35-57` and `src/views/inline-runner-modal.ts:145-167` — migration persists before return, and direct inline execution crosses the store seam before raw parsing.
- `src/graph/graph-validator.ts:102-130,214-225` — loop invariants and cycle exemption use looped Questions and structural `isLoopExit` metadata.
- `src/runner/protocol-runner.ts:242-288,693-740,769-784` — ordinary/looped Question behavior, re-entry, selected exit, and quick exit preserve the existing loop stack.
- `src/runner/render/render-loop-picker.ts:28-64` — renderer uses `questionText`, structural exit classification, verbatim exit labels, and a target-derived accessible name for unlabeled exits.
- `src/views/protocol-editor-view.ts:951-955,2043-2112,2188-2196` — editor provides the loop badge/toggle and persists `isLoopExit` independently while retaining save/reload behavior.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:903-1042` — the prior validation's missing toggle-persistence and badge regression coverage is now implemented.
- `src/views/node-picker-modal.ts:8-149` — standalone Loop is removed from picker types; looped Questions remain Question options.
- `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` — relevant key sets are symmetric; standalone Loop keys are removed.

#### Deviations from Plan:

- `src/graph/graph-model.ts:96,100` — `LoopContext` JSDoc still says “unified loop node,” violating Phase 1's manual criterion that stale unified-Loop comments be removed.
- `src/runner/protocol-runner.ts:249` — the runtime error still says “current loop node” rather than “current looped question.”
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:229,252-253,298,404-408` — test names/comments still describe `+`-prefixed exits even though Phase 5 requires structural `isLoopExit` terminology and removal of stale prefix-convention commentary.
- `src/views/node-picker-modal.ts:151-153` — `NodePickerModal` JSDoc claims it presents only Question and text-block nodes, while the implemented surface contains Start, Question, Answer, Text block, and Snippet options.

#### Pattern Conformance:

- ✓ Pure graph, parser, migration, and runner modules retain zero Obsidian dependencies.
- ✓ Store tests use local `makeVault()`/`makeApp()` factories and assert both returned and persisted state.
- ✓ Runner tests construct `ProtocolRunner` directly; render tests use local `MockEl` elements and `vi.fn()` host callbacks.
- ✓ Editor controls follow existing checkbox/save patterns, retain `this.doc = updated` plus `loadProtocol()`, and use the `rp-protocol-editor-*` CSS namespace.
- ✓ English and Russian locale key sets are synchronized.

### Manual Testing Required:

1. Legacy migration:
   - [ ] Open a legacy `.rp.json` containing standalone Loop nodes and `+` exits; confirm one rewrite to looped Questions and `isLoopExit: true`.
   - [ ] Reopen it and confirm no second migration write occurs.
2. Editor authoring:
   - [ ] Create a Question, enable Loop, and confirm the accessible canvas badge appears.
   - [ ] Save/reopen exits targeting Question, Answer, Text block, and Snippet nodes; confirm flags and captions persist without changing Snippet labels.
3. Runtime behavior:
   - [ ] Exercise ordinary and looped Questions, body re-entry, selected exit, quick exit, nested loops, stepBack, and redo.
   - [ ] Confirm output remains flat and unlabeled exit controls retain an accessible name.
4. Validation and picker UX:
   - [ ] Verify zero-edge, no-exit, no-body, ordinary-cycle, and looped-cycle diagnostics.
   - [ ] Confirm looped Questions appear as Question options and no standalone Loop option remains.

### Recommendations:

- Replace the remaining unified/current-loop-node and `+`-exit terminology with looped-Question and `isLoopExit` wording, then re-run validation.
- Correct `NodePickerModal` JSDoc to describe all five supported option kinds.
- Non-blocking: consider moving `adapter.exists()` inside `ProtocolDocumentStore.read()`'s `try` boundary and testing probe rejection.
- Non-blocking and outside this plan's documentation scope: refresh stale `.rpiv/guidance` detail files before relying on them for future implementation work.
