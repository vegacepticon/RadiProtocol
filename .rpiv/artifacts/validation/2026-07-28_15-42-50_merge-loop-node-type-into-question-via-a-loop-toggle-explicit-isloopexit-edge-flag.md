---
template_version: 1
date: 2026-07-28T15:42:50+0300
author: Roman Shulgha
commit: 122d2ae
branch: main
repository: RadiProtocol
topic: "Validation of Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag"
status: ready
verdict: fail
parent: ".rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md"
tags: [validation, graph, protocol, runner, render, editor, picker, i18n, migration]
last_updated: 2026-07-28T15:42:50+0300
---

## Validation Report: Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag

### Implementation Status

- ✓ Phase 1: Graph types + label utilities — Fully implemented
- ✓ Phase 2: Parser + edge reconstruction — Fully implemented
- ✓ Phase 3: Migration transform + store wiring — Fully implemented
- ⚠️ Phase 4: Validator + test graph-construction — Partially implemented (stale standalone-loop terminology remains)
- ⚠️ Phase 5: Runner core — Partially implemented (stale `case 'loop'` comments remain)
- ✓ Phase 6: Render loop picker — Fully implemented
- ⚠️ Phase 7: Editor — Partially implemented (planned loop-toggle authoring regression test is missing)
- ⚠️ Phase 8: Node picker + i18n cleanup — Partially implemented (picker documentation contradicts the implemented option surface/order)
- ⚠️ Phase 9: Cross-cutting tests + grep audit — Partially implemented (the documented `headerText` whitelist is not exact)

### Automated Verification Results

- ✓ Phase 1 focused tests: `npx vitest run src/__tests__/graph/node-label.test.ts` — 8 tests passed
- ✓ Phase 2 focused tests: `npx vitest run src/__tests__/protocol-document-parser.test.ts` — 23 tests passed
- ✓ Phase 3 focused tests: `npx vitest run src/__tests__/protocol-document-migration.test.ts src/__tests__/protocol-document-store.test.ts src/__tests__/views/inline-runner-modal.test.ts` — 59 tests passed
- ✓ Phase 4 focused tests: `npx vitest run src/__tests__/graph-validator.test.ts` — 32 tests passed
- ✓ Phase 5 focused tests: `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` — 37 tests passed
- ✓ Phase 6 focused tests: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts` — 11 tests passed
- ✓ Phase 7 focused tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts` — 63 tests passed
- ✓ Phase 8 focused tests: `npx vitest run src/__tests__/node-picker-modal.test.ts src/__tests__/runner-commands.test.ts` — 13 tests passed
- ✓ Phase 9 focused tests: `npx vitest run src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` — 8 tests passed
- ✓ Structural grep audit — forbidden helpers, standalone `case 'loop'`, `FakeLoopNode`, canonical `LoopNode`, and production `headerText` paths are absent; required positive symbols are present. The `headerText` whitelist wording has the test-fixture deviation noted below.
- ✓ Project baseline: `npm run check` — build and lint passed; 58 test files / 745 tests passed; planning, consistency, and agent-doc checks passed. The consistency script emitted its existing Knip advisory warning.
- ✓ `git diff --check` — no whitespace errors
- ✓ No functional regressions detected by the automated suite

### Code Review Findings

#### Matches Plan:

- `src/graph/graph-model.ts:30-43,119-131` — loop behavior and exit semantics are optional fields on Questions and edges; standalone `LoopNode` is removed from the canonical union.
- `src/protocol/protocol-document-parser.ts:64-66,203-208` — parser preserves the three optional-boolean states and rejects standalone legacy Loop outside migration.
- `src/protocol/protocol-document-migration.ts:39-94` — migration is pure, exact-discriminator scoped, lossless through layered spreads, legacy-key compatible, and idempotent.
- `src/protocol/protocol-document-store.ts:35-59` and `src/views/inline-runner-modal.ts:152-160` — migration persists before return, and direct inline execution crosses the store seam before raw parsing.
- `src/graph/graph-validator.ts:102-130,214-225` — loop validation and cycle exemption use looped Questions and structural `isLoopExit` metadata.
- `src/runner/protocol-runner.ts:261-267,726-790` — entry, re-entry, selected exit, and quick exit use the existing loop stack and explicit exit flag.
- `src/runner/render/render-loop-picker.ts:28-66` — renderer uses `questionText`, structural exit classification, verbatim exit captions, and an accessible fallback for unlabeled exits.
- `src/views/protocol-editor-view.ts:951-955,2044-2109,2188-2196` — editor provides the loop badge/toggle and persists exit state independently while retaining save/reload behavior.
- `src/views/node-picker-modal.ts:8-60,90-149` — standalone Loop is removed from picker types and looped Questions remain Question options.
- `src/i18n/locales/en.json:107-108,285-293` and `src/i18n/locales/ru.json:107-108,285-293` — new loop-toggle/badge and validator keys are synchronized; removed standalone keys are absent.

#### Deviations from Plan:

- `src/__tests__/views/protocol-editor-keyboard.test.ts:884-902` — Phase 7 requires “loop-toggle authoring coverage,” but the suite only verifies creation-grid kinds. It does not open a Question editor, toggle Loop, assert persisted `fields.loop`, or verify the canvas badge. This is an actionable regression-coverage gap.
- `src/runner/protocol-runner.ts:269-273,841-854` — comments still identify the re-entry dispatch as `case 'loop'` and describe a “loop node,” contrary to Phase 5’s required stale-comment rewrite.
- `src/graph/graph-validator.ts:97-98,191-217` — cycle-validation comments still use “unified loop node,” contrary to the looped-Question terminology required by Phases 1 and 4.
- `src/views/node-picker-modal.ts:44-46,64-71` — JSDoc says Question-first ordering and says Start/Answer are excluded, while `KIND_ORDER` and `buildNodeOptions` include both and place Start first. The implementation/tests agree with each other, but the documentation is stale.
- Phase 9’s stated `headerText` whitelist omits `src/__tests__/protocol-document-store.test.ts:159-183` and `src/__tests__/views/inline-runner-modal.test.ts:591`. Those are legitimate legacy migration fixtures explicitly required by Phase 3, so this is a plan-audit wording mismatch rather than canonical runtime leakage.

#### Pattern Conformance:

- ✓ Pure modules retain zero Obsidian dependencies, parser compatibility helpers follow existing modern-key-first conventions, and store tests use local vault/app factories.
- ✓ Runner tests construct `ProtocolRunner` directly with typed graph maps; render tests use local `MockEl` elements and host spies.
- ✓ Editor persistence retains the established `this.doc = updated` followed by `loadProtocol()` pattern; CSS classes follow the `rp-protocol-editor-*` namespace.
- Minor observation: Russian `nodePicker.rootSnippets` and `searchPlaceholder` wording differs from the plan’s literal examples, but keys are synchronized and the meanings remain valid; acceptable variation, not a deviation requiring action.

#### Potential Issues:

- `src/protocol/protocol-document-store.ts:33-36` — `adapter.exists()` remains outside `read()`’s `try` block, so a rejected existence probe escapes instead of returning `null`. This behavior predates the migration-specific transform/persistence contract, but a defensive test and catch would make the read contract consistently failure-safe.

### Manual Testing Required:

1. Legacy migration:
   - [ ] Open a legacy `.rp.json` with standalone Loop and `+` exits; confirm one canonical rewrite with `loop: true` and `isLoopExit: true`.
   - [ ] Reopen it and confirm no second write occurs.
2. Editor authoring:
   - [ ] Create a Question, enable Loop, and confirm the canvas badge.
   - [ ] Mark exits targeting question, answer, and text-block nodes; save/reopen and confirm flags and captions persist independently.
3. Runtime behavior:
   - [ ] Exercise ordinary and looped Questions, body re-entry, selected exit, quick exit, nested loops, stepBack, and redo.
   - [ ] Confirm output remains flat and picker captions/accessibility are correct.
4. Validation and picker UX:
   - [ ] Verify zero-edge, no-exit, no-body, ordinary-cycle, and looped-cycle diagnostics.
   - [ ] Confirm looped Questions appear as Question options and no standalone Loop option remains.

### Recommendations:

- Add the missing editor regression test for loop-toggle persistence and badge rendering.
- Replace stale `case 'loop'`, “loop node,” and “unified loop node” comments with looped-Question terminology; correct node-picker JSDoc.
- Align Phase 9’s `headerText` whitelist with its required migration-boundary tests.
- Consider moving the store existence probe inside `read()`’s failure boundary and testing rejection.
- Re-run `/skill:validate` after these localized fixes.
