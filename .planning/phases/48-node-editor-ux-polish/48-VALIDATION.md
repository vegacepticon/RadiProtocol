---
phase: 48
slug: node-editor-ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `48-RESEARCH.md` → Validation Architecture section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.2 |
| **Config file** | none (default discovery) — `vi.mock('obsidian')` pattern via `src/__mocks__/obsidian.ts` |
| **Quick run command** | `npm test -- src/__tests__/editor-panel.test.ts src/__tests__/editor-panel-create.test.ts src/__tests__/editor-panel-loop-form.test.ts src/__tests__/canvas-node-factory.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8–12 seconds quick; ~30s full |

---

## Sampling Rate

- **After every task commit:** quick run command (4 editor/factory test files)
- **After every plan wave:** full suite command (`npm test`)
- **Before `/gsd-verify-work`:** full suite must be green + manual UAT in TEST-BASE vault
- **Max feedback latency:** ~12 seconds for quick runs

---

## Per-Task Verification Map

> Exact task IDs are assigned by the planner. The map below is organized by requirement; planner must attach each row to the task that produces the behavior.

| Requirement | Secure Behavior / Acceptance | Test Type | Automated Command | File Exists | Status |
|-------------|------------------------------|-----------|-------------------|-------------|--------|
| NODEUI-01 | Text-block form does not render a `Setting` row with name "Snippet ID (optional)" | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "text-block"` | ❌ W0 | ⬜ pending |
| NODEUI-01 | Save path pendingEdits does not contain `radiprotocol_snippetId` after text-block form lifecycle | unit | same file | ❌ W0 | ⬜ pending |
| NODEUI-01 (regression) | Existing canvases with `radiprotocol_snippetId` still parse + runner awaiting-snippet-fill transition still green | unit | `npm test -- src/__tests__/runner/protocol-runner.test.ts -t "awaiting-snippet-fill"` | ✅ | ⬜ pending |
| NODEUI-02 | `CanvasNodeFactory.createNode` offsets new node to `{ x: anchor.x, y: anchor.y + anchor.height + NODE_GAP }` | unit | `npm test -- src/__tests__/canvas-node-factory.test.ts -t "Test 5"` | ✅ (flip assertion) | ⬜ pending |
| NODEUI-03 | Answer form `setName('Display label (optional)')` is called BEFORE `setName('Answer text')` | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "answer"` | ❌ W0 | ⬜ pending |
| NODEUI-04 | Question form emits `<textarea class="rp-question-textarea">` NOT inside a `.setting-item` wrapper | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "question"` | ❌ W0 | ⬜ pending |
| NODEUI-04 | Simulated `input` event on the captured textarea writes `element.style.height = scrollHeight + 'px'` | unit | same file | ❌ W0 | ⬜ pending |
| NODEUI-04 | Label + helper text render as sibling DOM nodes BEFORE the textarea (not inside `.setting-item-info`) | unit | same file | ❌ W0 | ⬜ pending |
| NODEUI-05 | `src/styles/editor-panel.css` contains `flex-direction: column` + `margin-top: auto` rule for `.rp-editor-create-toolbar` under a `/* Phase 48 */` marker | unit (file parse) | `npm test -- src/__tests__/editor-panel.test.ts -t "toolbar anchor"` or grep-based | ❌ W0 | ⬜ pending |
| NODEUI-05 | `renderToolbar` is invoked AFTER the form body in both `renderIdle` and `renderForm` (toolbar is last child of `contentEl`) | unit | same file | ❌ W0 | ⬜ pending |
| NODEUI-05 (regression) | Existing quick-create button tests still pass | unit | `npm test -- src/__tests__/editor-panel-create.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add negative-assertion test for NODEUI-01 in `src/__tests__/editor-panel.test.ts` (or new `editor-panel-forms.test.ts`): text-block form does NOT render "Snippet ID (optional)" Setting row, and pendingEdits does not contain `radiprotocol_snippetId`.
- [ ] Add order-assertion for NODEUI-03: answer-form Setting names ordered Display label → Answer text.
- [ ] Add custom-DOM assertion for NODEUI-04: question form emits `textarea.rp-question-textarea` NOT inside `.setting-item`, and label+desc siblings render before the textarea.
- [ ] Add input-event auto-grow test for NODEUI-04: simulated `input` triggers `style.height = scrollHeight + 'px'` write on the captured textarea.
- [ ] Add CSS file-parse assertion for NODEUI-05: `.rp-editor-create-toolbar` rule under `/* Phase 48 */` marker contains `flex-direction: column` + `margin-top: auto`.
- [ ] Add DOM-order assertion for NODEUI-05: `.rp-editor-create-toolbar` is the last child of `contentEl` after `renderForm` and after `renderIdle`.
- [ ] Flip assertion in `src/__tests__/canvas-node-factory.test.ts` Test 5 (lines 155-160): expected `pos: { x: 100, y: 200 + 80 + 40 }`.

**Framework install:** not needed — vitest already installed.

**Reuse patterns (from RESEARCH.md):**
- Setting-prototype capture pattern at `editor-panel-loop-form.test.ts:52-90` → use for NODEUI-01 / NODEUI-03 name-order assertions.
- `fakeNode()` recursive stub at `editor-panel-create.test.ts:412-429` → use for NODEUI-04 / NODEUI-05 DOM-order assertions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Question textarea visually grows as the author types multi-line content and never shows a scrollbar until it hits a reasonable cap | NODEUI-04 | Auto-grow is a visual/ergonomic check; assertion on `style.height = scrollHeight + 'px'` covers mechanics but not feel. | Open TEST-BASE vault → Node Editor → select Question node → type ~10 lines; verify textarea grows smoothly, no scrollbar until cap. |
| Quick-create toolbar renders as a full-width vertical stack pinned to the bottom of the Node Editor panel across Runner and standalone layouts | NODEUI-05 | CSS layout correctness across panel widths is a visual check | Open TEST-BASE vault → Node Editor (both in idle mode and form mode) at 300px and 600px panel widths → verify four buttons stack vertically full-width at the bottom. |
| Chained quick-creates produce a vertical tree downward from the anchor | NODEUI-02 | Canvas layout verification beyond unit offset check | Open TEST-BASE vault → pick any node → click Create-Question then Create-Answer then Create-Snippet → verify each new node appears directly below the previous one, not to the right. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (NODEUI-01/03/04/05 unit tests + Test 5 flip)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 15s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter before phase gate

**Approval:** pending
