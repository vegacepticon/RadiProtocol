---
template_version: 1
date: 2026-07-28T17:12:07+0300
author: Roman Shulgha
commit: 122d2ae
branch: main
repository: RadiProtocol
topic: "Validation of Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag"
status: ready
verdict: fail
parent: ".rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md"
tags: [validation, graph, protocol, runner, render, editor, picker, i18n, migration]
last_updated: 2026-07-28T17:12:07+0300
---

## Validation Report: Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag

### Implementation Status

- ✓ Phase 1: Graph types + label utilities — Fully implemented
- ✓ Phase 2: Parser + edge reconstruction — Fully implemented
- ✓ Phase 3: Migration transform + store wiring — Fully implemented
- ✓ Phase 4: Validator + test graph-construction — Fully implemented
- ⚠️ Phase 5: Runner core — Partially implemented (see Findings)
- ✓ Phase 6: Render loop picker — Fully implemented
- ✓ Phase 7: Editor — Fully implemented
- ✓ Phase 8: Node picker + i18n cleanup — Fully implemented
- ✓ Phase 9: Cross-cutting tests + grep audit — Fully implemented except for one stale prefix-convention test title

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
- ✓ Structural grep audit — all plan-prescribed symbol checks passed; standalone runtime Loop arms and prefix-helper paths are absent, and allowed migration/rejection references were inspected
- ✓ Project baseline: `npm run check` — build and lint passed; 58 test files / 749 tests passed; planning, consistency, and agent-doc checks passed. The consistency script emitted its existing Knip advisory warning.
- ✓ `git diff --check` — no whitespace errors
- ✓ No functional regressions detected by the automated suite

### Code Review Findings

#### Matches Plan:

- `src/graph/graph-model.ts:7-15,29-43,93-130` — standalone `LoopNode` is removed; optional `QuestionNode.loop` and `RPEdge.isLoopExit` are canonical, and prior stale LoopContext terminology is corrected.
- `src/protocol/protocol-document-parser.ts:21-29,51-66,126-135,185-192` — parser rejects standalone Loop, preserves the loop boolean's three states, and reconstructs only explicit `isLoopExit: true`.
- `src/protocol/protocol-document-migration.ts:39-98` — migration is pure, idempotent, defensively handles both legacy prompt keys, scopes `+` conversion to captured legacy Loop IDs, and preserves records through layered spreads.
- `src/protocol/protocol-document-store.ts:33-59` and `src/views/inline-runner-modal.ts:147-165` — migrated documents persist before return, and direct inline execution crosses the migration seam before raw parsing.
- `src/graph/graph-validator.ts:101-130,208-224` — dead-end, loop body/exit, and cycle checks use looped Questions and structural edge metadata.
- `src/runner/protocol-runner.ts:242-273,725-753,769-781` — first entry, re-entry, explicit exit, nested-stack, and quick-exit behavior use the merged model; the prior “current loop node” error text is corrected.
- `src/runner/render/render-loop-picker.ts:29-70` — renderer uses `questionText`, structural exit classification, verbatim captions, and an accessible fallback for empty exit labels.
- `src/views/protocol-editor-view.ts:950-955,2043-2109,2187-2195` — editor supplies the loop badge/toggle and persists `isLoopExit` independently while retaining immediate edge-state assignment and reload.
- `src/views/node-picker-modal.ts:8-14,54-71,88-137` — the picker exposes five canonical startable kinds; looped Questions remain Question options and legacy loop-start/loop-end records stay excluded.
- `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` — relevant editor, picker, and validator keys are synchronized and standalone Loop keys are removed.

#### Deviations from Plan:

- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:671` — one regression title still says “non-plus answer branch.” This is stale label-prefix terminology after exit semantics moved to `isLoopExit`, and it leaves the prior validation finding only partially resolved.

#### Pattern Conformance:

- ✓ Pure graph, parser, migration, and runner modules retain zero Obsidian dependencies.
- ✓ Store tests use local vault/app factories and verify both return values and persisted backing state.
- ✓ Runner tests construct `ProtocolRunner` directly; render tests use local DOM stubs and injected host spies.
- ✓ Editor controls follow existing checkbox, CSS namespace, save, and reload patterns.
- ✓ English and Russian locale key sets remain symmetric.

#### Potential Issues:

- `src/runner/protocol-runner.ts:559-585,617-633` — serializable undo entries omit `restoreStatus`. A loop branch pushes `restoreStatus: 'awaiting-loop-pick'`, but a save/restore round trip drops it, so a later `stepBack()` falls back to `at-node` instead of restoring the loop picker. Current loop serialization tests cover state restoration but not this restored-session undo path.
- `src/runner/render/render-loop-picker.ts:53-59` — the accessible-name fallback checks `caption === ''`; an externally authored whitespace-only exit label renders as a visually blank button without the target-derived `aria-label`.

### Manual Testing Required:

1. Legacy migration:
   - [ ] Open a legacy `.rp.json` containing standalone Loop nodes and `+` exits; confirm one rewrite to looped Questions and `isLoopExit: true`.
   - [ ] Reopen it and confirm no second sequential migration write occurs.
2. Editor authoring:
   - [ ] Create a Question, enable Loop, and confirm the accessible canvas badge appears.
   - [ ] Save/reopen exits targeting Question, Answer, Text block, and Snippet nodes; confirm flags and captions persist without changing Snippet labels.
3. Runtime behavior:
   - [ ] Exercise ordinary and looped Questions, body re-entry, selected exit, quick exit, nested loops, stepBack, redo, and a save/restore followed by stepBack.
   - [ ] Confirm output remains flat and empty or whitespace-only exit controls retain an accessible name.
4. Validation and picker UX:
   - [ ] Verify zero-edge, no-exit, no-body, ordinary-cycle, and looped-cycle diagnostics.
   - [ ] Confirm looped Questions appear as Question options and no standalone Loop option remains.

### Recommendations:

- Replace “non-plus answer branch” with structural `isLoopExit` wording.
- Preserve `UndoEntry.restoreStatus` through `getSerializableState()` / `restoreFrom()` and add a JSON round-trip + stepBack regression.
- Treat trimmed-empty exit captions as unlabeled when assigning the target-derived `aria-label`.
- Re-run `/skill:validate` after these localized fixes.
