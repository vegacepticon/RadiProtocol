---
phase: 48-node-editor-ux-polish
plan: "01"
subsystem: editor-panel
tags: [editor-panel, canvas-factory, ux-polish, textarea-autogrow, tdd]
dependency_graph:
  requires: []
  provides: [NODEUI-01, NODEUI-02, NODEUI-03, NODEUI-04]
  affects: [src/views/editor-panel-view.ts, src/canvas/canvas-node-factory.ts]
tech_stack:
  added: []
  patterns:
    - requestAnimationFrame + scrollHeight auto-grow (reused from runner-view.ts:816-840)
    - Custom DOM label-above-textarea (createDiv label + createEl p + createEl textarea)
    - Setting-prototype mock (reused from editor-panel-loop-form.test.ts:44-103)
    - fakeNode recursive stub extended with style + scrollHeight for textarea
key_files:
  created:
    - src/__tests__/editor-panel-forms.test.ts
  modified:
    - src/views/editor-panel-view.ts
    - src/canvas/canvas-node-factory.ts
    - src/__tests__/canvas-node-factory.test.ts
    - src/__tests__/editor-panel-create.test.ts
decisions:
  - "Conservative NODEUI-01: UI removal only — parser/runner/fixture load paths for radiprotocol_snippetId left untouched per scope fence"
  - "requestAnimationFrame polyfill pattern reused verbatim from RunnerView.test.ts:114-134 for both editor-panel-forms.test.ts and editor-panel-create.test.ts"
  - "registerDomEvent no-op stub added to editor-panel-create.test.ts double-click describe block — obsidian mock does not provide it"
metrics:
  duration: "6m 7s"
  completed: "2026-04-19"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
  tests_before: 428
  tests_after: 435
---

# Phase 48 Plan 01: Editor Form TypeScript Core Summary

One-liner: Deleted Snippet ID row, flipped factory offset to vertical, swapped Answer field order, and replaced Question Setting-textarea with custom-DOM auto-grow block — four surgical TypeScript edits with full TDD RED/GREEN cycle.

## What Was Built

Plan 01 closes NODEUI-01, NODEUI-02, NODEUI-03, and NODEUI-04 in three atomic commits. All changes are TypeScript-only; CSS and NODEUI-05 are deferred to Plan 02 (Wave 2).

### NODEUI-01 — Remove Snippet ID row from Text-block form

Deleted the 10-line `new Setting(container).setName('Snippet ID (optional)').addText(...)` block from `case 'text-block':` in `buildKindForm`. The `pendingEdits` map no longer receives `radiprotocol_snippetId` from the UI. Legacy canvases with this key on disk continue to parse and trigger `awaiting-snippet-fill` in the runner (scope fence preserved).

### NODEUI-02 — Vertical anchor offset in CanvasNodeFactory

Changed `canvas-node-factory.ts` line 52 from:
```
pos = { x: anchor.x + anchor.width + NODE_GAP, y: anchor.y };
```
to:
```
pos = { x: anchor.x, y: anchor.y + anchor.height + NODE_GAP };
```
Quick-create buttons now place new nodes below the anchor rather than to the right.

### NODEUI-03 — Display label before Answer text in Answer form

Swapped the two `new Setting(container)` blocks in `case 'answer':` so `Display label (optional)` renders first, `Answer text` second. The `Text separator` dropdown remains third. Pure block reorder — no content changed inside either block.

### NODEUI-04 — Custom-DOM auto-grow textarea for Question form

Replaced `new Setting(container).setName('Question text').addTextArea(...)` with a custom DOM block:
- `container.createDiv({ cls: 'rp-question-block' })`
- `qBlock.createDiv({ cls: 'rp-field-label', text: 'Question text' })`
- `qBlock.createEl('p', { cls: 'rp-field-desc', text: '...' })`
- `qBlock.createEl('textarea', { cls: 'rp-question-textarea' })`

Auto-grow uses the proven `scrollHeight` pattern from `runner-view.ts:816-840` (rAF on mount + `input` listener). `pendingEdits['radiprotocol_questionText']`, `pendingEdits['text']`, and `scheduleAutoSave()` are all preserved in the input handler — semantically identical to the removed `onChange`.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| cc46b5e | test(48-01) | Add Phase 48 form assertions + flip factory Test 5 (RED) |
| 824296f | feat(48-01) | Remove Snippet ID row, flip factory offset, swap answer fields (NODEUI-01/02/03) |
| d0b4409 | feat(48-01) | Replace Question textarea with custom-DOM auto-grow block (NODEUI-04) |

## Test Count Delta

| Metric | Value |
|--------|-------|
| Tests before Phase 48 | 428 passed, 1 skipped |
| Tests after Plan 01 | 435 passed, 1 skipped |
| New tests added | 7 (in editor-panel-forms.test.ts) |
| Flipped assertion | canvas-node-factory.test.ts Test 5 |

## Changed Files

| File | Change |
|------|--------|
| `src/__tests__/editor-panel-forms.test.ts` | CREATED — 7 new assertions for NODEUI-01/03/04 |
| `src/__tests__/canvas-node-factory.test.ts` | MODIFIED — Test 5 assertion flipped to vertical offset |
| `src/__tests__/editor-panel-create.test.ts` | MODIFIED — requestAnimationFrame polyfill + registerDomEvent stub + textarea style stub added to 'double-click fallback' describe block |
| `src/views/editor-panel-view.ts` | MODIFIED — NODEUI-01 deletion, NODEUI-03 block swap, NODEUI-04 custom DOM replacement |
| `src/canvas/canvas-node-factory.ts` | MODIFIED — NODEUI-02 one-line offset flip |

## DO-NOT-TOUCH Files — Scope Fence Verification

```
git diff -- src/graph/canvas-parser.ts src/runner/protocol-runner.ts \
  src/graph/graph-model.ts src/__tests__/fixtures/snippet-block.canvas \
  src/__tests__/runner/protocol-runner.test.ts
```
Output: empty (byte-identical). All five scope-fence files are unchanged.

Regression assertion `awaiting-snippet-fill when reaching a text-block with snippetId` in `protocol-runner.test.ts` stays GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] requestAnimationFrame not defined in vitest/Node.js environment**
- **Found during:** Task 3 GREEN phase
- **Issue:** `buildKindForm('question')` calls `requestAnimationFrame` which is not available in the Node.js test environment used by vitest. Three NODEUI-04 tests and one existing test in `editor-panel-create.test.ts` threw `ReferenceError: requestAnimationFrame is not defined`.
- **Fix:** Added synchronous `requestAnimationFrame` polyfill (`cb(0); return 0`) to `beforeEach` + teardown in `afterEach` of both the NODEUI-04 describe block (`editor-panel-forms.test.ts`) and the "double-click fallback" describe block (`editor-panel-create.test.ts`). Exact same pattern as `RunnerView.test.ts:114-134`.
- **Files modified:** `src/__tests__/editor-panel-forms.test.ts`, `src/__tests__/editor-panel-create.test.ts`
- **Commit:** d0b4409

**2. [Rule 1 - Bug] registerDomEvent not provided by obsidian ItemView mock**
- **Found during:** Task 3 GREEN phase (after fixing Rule 1 deviation 1)
- **Issue:** `buildKindForm('question')` calls `this.registerDomEvent(qTextarea, 'input', ...)` but the obsidian mock's `ItemView` does not implement `registerDomEvent`. The "double-click fallback" test threw `TypeError: this.registerDomEvent is not a function`.
- **Fix:** Added `view.registerDomEvent = () => {}` no-op stub in the `beforeEach` of the "double-click fallback" describe block in `editor-panel-create.test.ts`.
- **Files modified:** `src/__tests__/editor-panel-create.test.ts`
- **Commit:** d0b4409

**3. [Rule 1 - Bug] Textarea child missing style property in editor-panel-create.test.ts fakeNode**
- **Found during:** Task 3 GREEN phase (after fixing deviation 2)
- **Issue:** The local `fakeNode()` in the "renderForm does NOT emit .rp-editor-type-hint when currentKind is set" test returned a plain recursive stub without a `style` property for textarea children. The synchronous `requestAnimationFrame` polyfill tried to set `style.height` and threw `TypeError: Cannot set properties of undefined`.
- **Fix:** Updated that test's local `fakeNode.createEl` to attach `style = { height: '' }`, `scrollHeight = 0`, and `value = ''` when `tag === 'textarea'`.
- **Files modified:** `src/__tests__/editor-panel-create.test.ts`
- **Commit:** d0b4409

### TDD Gate Compliance

All three TDD gates satisfied:

1. RED gate: `test(48-01)` commit cc46b5e — 6 assertions failing (NODEUI-01 setName, NODEUI-03 order, all 3 NODEUI-04, factory Test 5)
2. GREEN gate: `feat(48-01)` commits 824296f + d0b4409 — all assertions flipped to GREEN
3. REFACTOR gate: Not needed — no cleanup required after GREEN

**Note:** NODEUI-01 pendingEdits assertion was GREEN at RED-phase commit because `pendingEdits` is only populated via `onChange` callbacks (never at form render time). This is the correct behavior and the test correctly validates the key is absent after render.

## Plan 02 Scope (NOT in this plan)

- CSS for `.rp-question-block`, `.rp-field-label`, `.rp-field-desc`, `.rp-question-textarea` — `src/styles/editor-panel.css` append
- NODEUI-05 — `.rp-editor-create-toolbar` anchored at bottom as vertical column; `renderToolbar` call sites moved to after form body in `renderIdle`/`renderForm`

The `rp-question-textarea` and associated classes render without CSS styling in the current state — functionally correct (auto-grow and persistence work), visually unstyled until Plan 02.

## Self-Check: PASSED

Files exist:
- src/__tests__/editor-panel-forms.test.ts — FOUND
- src/views/editor-panel-view.ts — FOUND (contains `rp-question-textarea`, `rp-question-block`, `rp-field-label`, `rp-field-desc`)
- src/canvas/canvas-node-factory.ts — FOUND (contains `anchor.y + anchor.height + NODE_GAP`)

Commits exist:
- cc46b5e — FOUND (test RED)
- 824296f — FOUND (feat NODEUI-01/02/03)
- d0b4409 — FOUND (feat NODEUI-04)

Scope fence: git diff on 5 DO-NOT-TOUCH files — empty (PASSED)

Full suite: 435 passed, 1 skipped (>=428 baseline — PASSED)
