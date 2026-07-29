---
template_version: 1
date: 2026-07-29T11:19:27+0300
author: Roman Shulgha
commit: 91fcbdb
branch: main
repository: RadiProtocol
topic: "Validation of Hide Start from node picker; direct Question-to-Question transitions"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-07-29_10-01-42_hide-start-picker-q-to-q-transitions.md"
tags: [validation, blueprint, protocol-editor-view, runner, render, graph]
last_updated: 2026-07-29T11:19:27+0300
---

## Validation Report: Hide Start from node picker; direct Question-to-Question transitions

### Implementation Status

- ✓ Phase 1: Runner transition contract — Fully implemented
- ✓ Phase 2: Transition rendering and host wiring — Fully implemented
- ✓ Phase 3: Editor authoring correctness — Fully implemented

### Automated Verification Results

- ✓ Focused runner transition tests: `npx vitest run src/__tests__/runner/protocol-runner-question-branch.test.ts` — 1 file, 9 tests passed
- ✓ Existing runner tests: `npx vitest run src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-redo.test.ts` — 3 files, 79 tests passed
- ✓ Renderer and host integration tests: `npx vitest run src/__tests__/runner/render-question.test.ts src/__tests__/views/inline-runner-modal.test.ts` — 2 files, 27 tests passed
- ✓ Transition selector stylelint: `npx stylelint "src/styles/inline-runner.css"` — passed with no findings
- ✓ Editor helper and view regression tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts` — 2 files, 71 tests passed
- ✓ Complete project gate: `npm run check` — build, lint, 59 test files/765 tests, planning, consistency, and agent-doc checks passed; the existing non-blocking Knip advisory remained reported by the consistency check
- ✓ No regressions detected

### Code Review Findings

#### Matches Plan:

- `src/runner/protocol-runner.ts:238-276` — validates ordinary source Question, concrete edge origin, and Question target before clearing redo or pushing one undo snapshot; accumulated text is not mutated.
- `src/runner/protocol-runner.ts:790-808` — suppresses the automatic loop-entry snapshot for a direct transition while retaining loop context, so a looped target remains one undoable user action.
- `src/runner/render/render-question.ts:72-100` — renders concrete outgoing Question edges in persisted order, preserves edge identity, and resolves captions from nonblank edge label to trimmed target label to target ID.
- `src/runner/render/render-question.ts:58-118` and `src/styles/inline-runner.css:149-200` — place distinct transition controls after Answers and before Snippets with dedicated navigation styling.
- `src/views/inline-runner-modal.ts:470-473` — delegates the selected edge ID directly to the runner and rerenders without entering the Answer/note-write path; the integration test confirms zero `vault.modify` calls.
- `src/views/protocol-editor-view.ts:313-335` — preserves nonblank ordinary Q-to-Q labels while retaining existing Answer, Snippet, loop-exit, and hidden loop-body policies.
- `src/views/protocol-editor-view.ts:769-827` — both picker methods derive Start availability from the current document without mutating `EDITABLE_NODE_KINDS`.
- `src/views/protocol-editor-view.ts:2485-2500` — applies a successful deletion result to `this.doc` only after protocol-path/load-generation guards and before the asynchronous reload.
- `src/__tests__/runner/protocol-runner-question-branch.test.ts:58-176` — covers text preservation, undo/redo, redo clearing, loop targets, invalid edges/targets, and looped-source rejection.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:907-1264` — covers both picker states, immediate Start availability after deletion, stale deletion completion, and Q-to-Q label save/reopen behavior.

#### Deviations from Plan:

None. Implementation is a faithful realization of the plan.

#### Pattern Conformance:

- ✓ Edge-ID lookup and history sequencing follow the existing `chooseLoopBranch()`/`chooseSnippetBranch()` runner patterns.
- ✓ Concrete-edge rendering and callback identity follow the loop-picker precedent; renderer and view tests use established MockEl and Vitest host-spy conventions.
- ✓ `src/__tests__/runner/runner-renderer-host-fixtures.ts:40-116` adds the narrowly required `setCssProps` mock capability used by the transition list. The extra inline spacing call mirrors existing renderer spacing behavior and is an acceptable variation, not a deviation.
- ✓ Editor deletion guards follow existing protocol-path/load-generation store-update conventions.

### Manual Testing Required:

1. Node-kind pickers:
   - [ ] With a Start node present, open both the empty-canvas and connected-node pickers and confirm Start is absent.
   - [ ] Delete Start and immediately reopen both pickers before reload completion; confirm Start is available.
2. Q-to-Q label persistence:
   - [ ] Enter a padded label on an ordinary Q-to-Q edge, save, reopen the edge modal, and confirm the trimmed label remains visible.
3. Mixed runner branches:
   - [ ] Run a protocol containing Answer, direct Q-to-Q, looped-Q target, and Snippet choices; confirm Answers render first, transitions second, and Snippets last.
   - [ ] Click direct transitions to ordinary and looped Questions; confirm the displayed state changes, report text is preserved, and the active note is not modified.
   - [ ] Exercise Back and Redo after both direct-transition forms and confirm one-step round trips without regressing Answer, Snippet, empty-Answer, or loop behavior.

### Recommendations:

- Ready to commit — implementation is complete and validated.
