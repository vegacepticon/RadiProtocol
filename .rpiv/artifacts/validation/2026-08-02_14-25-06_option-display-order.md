---
template_version: 1
date: 2026-08-02T14:25:06+0300
author: Roman Shulgha
commit: 8e3ab6b
branch: main
repository: RadiProtocol
topic: "Validation of option-display-order"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-08-02_12-14-42_option-display-order.md"
tags: [validation, plan, runner, protocol, views, graph, parser]
last_updated: 2026-08-02T14:25:06+0300
---

## Validation Report: option-display-order

### Implementation Status

- ✓ Phase 1: Data model + parser foundation — Fully implemented
- ✓ Phase 2: edge-order projection module — Fully implemented
- ✓ Phase 3: Runner render ordering — Fully implemented
- ✓ Phase 4: Skip authored order — Fully implemented
- ✓ Phase 5: Editor chip module + i18n + modal mount — Fully implemented
- ✓ Phase 6: FR-6 edge-append integration — Fully implemented

All six phases are marked `- [x]` in the plan and verified against the working-tree code. The plan carries no `risks:` frontmatter array, so no risk rulings apply. No `--goal`/`--baseline` flags were provided, so goal-conformance and baseline-scoped criteria do not apply.

### Automated Verification Results

- ✓ Type check: `npx tsc --noEmit` — clean, exit 0
- ✓ Parser tests: `src/__tests__/protocol-document-parser.test.ts` — pass (optionOrder block: absent/valid/`[]`/non-array/non-string-element/loop-coexistence)
- ✓ edge-order tests: `src/__tests__/graph/edge-order.test.ts` — pass (9 scenarios: absent/ordered/stale/duplicates/reassigned/empty/all-stale/non-string/missing & non-question node)
- ✓ render-question tests: `src/__tests__/runner/render-question.test.ts` — pass (interleaved single-stack authored-order test + unchanged fallback tests)
- ✓ render-loop-picker tests: `src/__tests__/runner/render-loop-picker.test.ts` — pass (authored-order body/exit buttons test + unchanged baseline)
- ✓ skip tests: `src/__tests__/runner/protocol-runner-skip.test.ts` — pass (FR-8 authored order, FR-9 stale id, answerless no-op)
- ✓ chip editor tests: `src/__tests__/views/option-order-chip-editor.test.ts` — pass (render/DnD-reorder/no-data-drop/destroy/click-guard)
- ✓ Stylelint: `npx stylelint src/styles/protocol-editor.css` — clean, exit 0
- ✓ Editor keyboard tests: `src/__tests__/views/protocol-editor-keyboard.test.ts` — pass (FR-6 unit + append-on-create + append-on-connect + FR-5 drag-persist-reopen)
- ✓ Whole-plan gate: `npm test` — 61 files, 826 tests, exit 0
- ✓ Whole-plan gate: `npm run check` — exit 0 (build via `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`, eslint `--max-warnings 0`, stylelint, 826 tests, planning freshness, consistency, agent-docs)
- ✓ No regressions detected — existing suites (render-question fallback pins, loop-picker baseline, parser fallback, store tests) all pass unchanged

### Code Review Findings

#### Matches Plan:

- `src/graph/graph-model.ts:44-63` — `QuestionNode.optionOrder?: string[]` beside `loop` with JSDoc covering stale-id/duplicate semantics and `[]` vs `undefined` (D1).
- `src/protocol/protocol-document.ts:38-45,94` — `edges` doc comment rewritten for FR-10 (order insignificant for traversal; `fields.optionOrder` may carry display-order semantics); `fields` JSDoc key list includes `optionOrder` (D2).
- `src/protocol/protocol-document-parser.ts:70-83,244` — `getOptionalStringArray` 3-state getter (verbatim `string[]` incl. `[]`/unknown ids; `undefined` for absent/non-array/non-string element; never a parseError); question case extracts `optionOrder` (D3).
- `src/graph/edge-order.ts` (new) — `orderedOutgoingEdges(graph, questionId)`: absent → edges-array outgoing order; present → listed ids resolved to current outgoing edges with stale/non-outgoing/duplicate drop, unlisted appended; never throws (D4).
- `src/runner/render/render-question.ts:7,24-58,82-105` — `orderedOutgoingEdges` import; shared `appendAnswerButton`/`appendQuestionTransitionButton`/`appendSnippetBranchButton` used byte-identically by both paths; interleaved single `rp-option-list rp-stack` branch when `optionOrder !== undefined`; grouped fallback (lines 107-152) unchanged when absent (D5).
- `src/runner/render/render-loop-picker.ts:48` — `outgoing` derived via `orderedOutgoingEdges(graph, state.nodeId)`; exit/body classification untouched (D5).
- `src/runner/protocol-runner.ts:147-163` — `skip()`: optionOrder present → projection, first answer-kind target; otherwise adjacency-scan fallback; guard return (D6).
- `src/views/option-order-chip-editor.ts` (new) — `mountOptionOrderChips` with tracked-listener `destroy()`, splice-based HTML5 DnD, `⠿` glyph non-translatable, chip labels never wrapped in `t()` (D7).
- `src/views/protocol-editor-view.ts:347-373,382-401,2294-2332,2255,2235-2236,2490` — `optionOrderChipLabel` kind-aware fallbacks (questionText / text-block content slice / loopLabel); `orderItemsByOptionOrder`; `addOptionOrderChips` with modified/originallyPresent save logic (legacy no-reorder save omits key; reorder preserves original stale ids appended after reordered live ids — FR-9); `textControls` widened to `string[]`; `destroy()` on modal close; question case wiring (D8).
- `src/views/protocol-editor-view.ts:410-426,965,1552` — exported `appendEdgeIdToOptionOrder` (immutable, no-op for non-question/non-array) called inside both `addNodeAndConnectAtWorldPoint` and `finishConnectionDrag` update mutators — FR-6 atomic append (D9).
- `src/i18n/locales/en.json:109-111` + `src/i18n/locales/ru.json:109-111` — `protocolEditor.optionOrderLabel/Help/DragAria` in BOTH locales (i18n convention).
- `src/styles/protocol-editor.css:889-943` — `.rp-option-order-*` chip styles (field/help/list/chip/drag-over/handle/label) mirroring the snippet-chip pattern.
- Review resolutions from the plan's Step 8 all applied: backward-compat save logic (no interleaved activation on legacy saves), stale-id preservation on write, kind-aware label fallbacks, DnD click-guard test, chip CSS, MockEl enhancements in `protocol-editor-keyboard.test.ts` (textContent/dataset/getAttr/querySelectorAll/contains/removeEventListener).

#### Deviations from Plan:

None. Implementation is a faithful realization of the plan, including the applied Step 8 review resolutions.

#### Pattern Conformance:

- ✓ `edge-order.ts` mirrors the `node-label.ts` pure graph-helper pattern: zero Obsidian imports, NFR-01 header citation, JSDoc'd single export, `import type` same-dir import.
- ✓ `option-order-chip-editor.ts` mirrors `snippet-chip-editor.ts`: tracked-listener destroy, DnD splice-reorder, `rp-` kebab class namespace, i18n discipline (t() for UI strings, raw user content never wrapped).
- ✓ Import conventions, test naming (`describe('Module — feature')`), MockEl + `vi.fn()` spy patterns, and no-mocking rule for pure modules all conform.
- ✓ CSS uses the sibling file's `var(--size-*)`/`var(--radius-*)`/`var(--font-*)` tokens.
- ✓ i18n keys follow `componentName.stringName` and exist in both locales.
- Minor observation (acceptable variation, not a deviation): `OptionOrderChipEditorHandle` (`option-order-chip-editor.ts:19`) is exported but consumed only as the module's own return type — `knip` flags it as an unused export, exactly like 12 pre-existing peers (`CssClass`, `RunnerStatus`, `LoopPickerHost`, `QuestionBranchHost`, …). `npm run knip` exits 0; the `check:consistency` knip "Command failed" warning is a 60s `execSync` timeout artifact of the advisory probe, not a finding (direct run completes, exit 0).

### Manual Testing Required:

1. Editor chip list (Phase 5):
   - [ ] Open a Question node in the editor → "Display order" chip list shows its outgoing connections with kind-aware labels (edge caption / question text / text-block content / answer or snippet label).
   - [ ] Drag a chip to reorder, save → `fields.optionOrder` rewritten in the `.rp.json`; reopen the modal → same order.
   - [ ] Save a legacy question (no `optionOrder`) without reordering → the key is NOT persisted; grouped rendering preserved.
2. Runner rendering (Phase 3):
   - [ ] Protocol with `optionOrder` → single interleaved option list in authored order (answers / question transitions / snippet branches), per-kind styling intact.
   - [ ] Protocol without `optionOrder` → identical grouped rendering to before the feature.
   - [ ] Looped ordered question → loop picker body/exit buttons in authored order.
3. Skip (Phase 4):
   - [ ] `optionOrder` present → Skip advances through the first answer in authored order (not adjacency order); no text appended.
   - [ ] Delete an edge referenced by `optionOrder`, run the protocol → no error, stale entry ignored.
4. FR-6 edge append (Phase 6):
   - [ ] Add a new answer edge to an ordered question (via node-add or drag-connect) → new edge id appended at the end of `optionOrder`; new option appears at the end of the Runner list.

### Recommendations:

- Ready to commit — implementation is complete and validated. `npm run check` and `npm test` both exit 0.
- Note: the `user-intention.md` deletion in the working tree is unrelated to this plan's file list — exclude it from the optionOrder commit.
- Optional, non-blocking: the knip unused-export flag on `OptionOrderChipEditorHandle` is consistent with existing peer types; leave as-is or import the type in `protocol-editor-view.ts` if a future cleanup pass addresses the other 12 flags.
