---
phase: 48-node-editor-ux-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/editor-panel-view.ts
  - src/canvas/canvas-node-factory.ts
  - src/__tests__/canvas-node-factory.test.ts
  - src/__tests__/editor-panel-forms.test.ts
autonomous: true
requirements: [NODEUI-01, NODEUI-02, NODEUI-03, NODEUI-04]
tags: [editor-panel, canvas-factory, ux-polish, textarea-autogrow]
must_haves:
  truths:
    - "Selecting a Text block in the Node Editor shows no 'Snippet ID (optional)' input row."
    - "Saving a Text block never writes the key 'radiprotocol_snippetId' into pendingEdits."
    - "Legacy canvases carrying 'radiprotocol_snippetId' on disk still parse and still trigger the awaiting-snippet-fill runner branch (zero regression)."
    - "Clicking any quick-create button (Question/Answer/Snippet/Loop) with an anchor selected places the new node BELOW the anchor (y = anchor.y + anchor.height + 40, x = anchor.x)."
    - "In the Answer form, the Setting row 'Display label (optional)' renders BEFORE the Setting row 'Answer text'; the 'Text separator' dropdown remains the third row."
    - "In the Question form, the question-text textarea lives in a custom DOM block (label div + helper <p> + <textarea class='rp-question-textarea'>) that is NOT wrapped in Obsidian's .setting-item flex row."
    - "The Question textarea auto-grows on each 'input' event via the runner-view.ts:816-840 scrollHeight pattern (height='auto' then height=scrollHeight+'px')."
    - "Typing in the Question textarea still writes both pendingEdits['radiprotocol_questionText'] and pendingEdits['text'] and calls scheduleAutoSave()."
  artifacts:
    - path: "src/views/editor-panel-view.ts"
      provides: "text-block form without Snippet ID row; answer form with swapped field order; question form with custom-DOM auto-growing textarea"
      contains: "rp-question-textarea"
    - path: "src/canvas/canvas-node-factory.ts"
      provides: "vertical-offset anchor placement"
      contains: "anchor.y + anchor.height + NODE_GAP"
    - path: "src/__tests__/canvas-node-factory.test.ts"
      provides: "Test 5 flipped to assert vertical offset"
      contains: "y: 200 + 80 + 40"
    - path: "src/__tests__/editor-panel-forms.test.ts"
      provides: "new unit tests for NODEUI-01 negative, NODEUI-03 order, NODEUI-04 custom DOM + auto-grow"
      contains: "rp-question-textarea"
  key_links:
    - from: "editor-panel-view.ts (case 'text-block')"
      to: "pendingEdits"
      via: "textarea onChange handlers"
      pattern: "pendingEdits\\['radiprotocol_(content|separator)'\\]"
    - from: "editor-panel-view.ts (case 'question')"
      to: "scheduleAutoSave"
      via: "registerDomEvent(ta, 'input', ...)"
      pattern: "registerDomEvent\\(ta, 'input'"
    - from: "canvas-node-factory.createNode"
      to: "canvas.createTextNode"
      via: "pos computed from anchor"
      pattern: "anchor\\.y \\+ anchor\\.height \\+ NODE_GAP"
---

<objective>
Ship the TypeScript core of Phase 48: delete the obsolete "Snippet ID (optional)" row from the Text-block form (NODEUI-01, UI-only — legacy parser/runner paths stay untouched), flip `CanvasNodeFactory`'s anchor offset from horizontal `(dx, 0)` to vertical `(0, dy)` so chained quick-creates produce a vertical tree (NODEUI-02), swap the Answer form's Setting-row order so Display label renders above Answer text (NODEUI-03), and replace the Question form's `Setting.addTextArea(...)` wrapper with a custom DOM block (label div + helper p + full-width auto-growing textarea) using the proven `scrollHeight` pattern from `runner-view.ts:816-840` (NODEUI-04).

Purpose: close four of five Phase 48 success criteria in a single TypeScript-only commit set; leave CSS + toolbar DOM re-order for Plan 02. Every change is a localized composition of existing idioms — no new abstractions, no new dependencies, strictly additive tests.

Output: edited `editor-panel-view.ts`, edited `canvas-node-factory.ts`, flipped assertion in `canvas-node-factory.test.ts`, new test file `editor-panel-forms.test.ts` with five assertions covering NODEUI-01/03/04. Full `npm test` stays green (428+ currently).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/48-node-editor-ux-polish/48-RESEARCH.md
@.planning/phases/48-node-editor-ux-polish/48-PATTERNS.md
@.planning/phases/48-node-editor-ux-polish/48-VALIDATION.md

<interfaces>
<!-- Key contracts the executor must preserve or reuse. Extracted from codebase. -->

From src/views/editor-panel-view.ts (EditorPanelView class — relevant surface):
```typescript
// Field to preserve:
private pendingEdits: Record<string, unknown> = {};
// Methods to reuse:
private scheduleAutoSave(): void;
private registerDomEvent(el: HTMLElement, event: string, cb: (ev: Event) => void): void;
// Methods NOT to touch (scope fence — see <scope_fence>):
private attachCanvasListener(): void;            // lines 81-116
private canvasPointerdownHandler(...): void;     // Phase 42 double-click fix
private handleNodeClick(...): void;              // Phase 42 double-click fix
private renderNodeForm(...): void;               // Phase 42 in-memory fallback at lines 308-316
```

From src/views/runner-view.ts:816-840 (VERBATIM auto-grow pattern to copy — reference only, do NOT modify):
```typescript
const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
textarea.value = text;
textarea.style.width = '100%';
requestAnimationFrame(() => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
this.registerDomEvent(textarea, 'input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
```

From src/canvas/canvas-node-factory.ts (constants + CanvasNodeInternal shape):
```typescript
const NODE_GAP = 40;
interface CanvasNodeInternal {
  id: string; x: number; y: number; width: number; height: number;
}
// Existing anchor lookup:
const anchor = canvas.nodes.get(anchorNodeId);
```

From src/__tests__/editor-panel-loop-form.test.ts:44-103 (Setting-prototype mock — analog to copy):
```typescript
const settingCalls: { setName: string[]; setDesc: string[]; setHeading: number }
  = { setName: [], setDesc: [], setHeading: 0 };
function installSettingPrototypeMock(): void { /* full body copy from analog */ }
```

From src/__tests__/editor-panel-create.test.ts:412-429 (fakeNode recursive stub — analog to extend):
```typescript
const fakeNode = (): Record<string, unknown> => { /* createDiv/createEl recorder */ };
```
</interfaces>
</context>

<scope_fence>
DO NOT TOUCH (research-identified load-bearing code; modifying any of these is a Phase 48 regression):
- `src/graph/canvas-parser.ts:216-229` — legacy `radiprotocol_snippetId` read path.
- `src/runner/protocol-runner.ts:544-551` — legacy text-block → awaiting-snippet-fill transition.
- `src/graph/graph-model.ts` — `TextBlockNode.snippetId?: string` field declaration.
- `src/__tests__/fixtures/snippet-block.canvas` — fixture that encodes the legacy invariant.
- `src/__tests__/runner/protocol-runner.test.ts:187-195` — "awaiting-snippet-fill" assertion; MUST stay green unmodified.
- `src/views/editor-panel-view.ts:81-116` — `attachCanvasListener` / `canvasPointerdownHandler` / `handleNodeClick` (Phase 42 double-click regression fix).
- `src/views/editor-panel-view.ts:308-316` — Phase 42 in-memory fallback inside `renderNodeForm`.
- Any CSS rule in `src/styles/editor-panel.css` added by earlier phases (Plan 02 handles CSS with append-only rules).
- The `.rp-editor-create-toolbar` call sites in `renderIdle` (line 144) and `renderForm` (line 329) — Plan 02 handles NODEUI-05.
- The Separator dropdown block inside `case 'answer':` (current lines 445-460) — stays as the third row.
- The Separator dropdown block inside `case 'text-block':` (current lines 487-502) — stays (becomes second row after NODEUI-01 deletion).
- The Content textarea block inside `case 'text-block':` (current lines 466-476) — stays as first row.
- Every other `case` in `buildKindForm` (start, snippet, loop) — untouched.

The ONE authorised deletion is the 10-line `new Setting(container).setName('Snippet ID (optional)')...addText(...)` block at editor-panel-view.ts:477-486 — and nothing else.
</scope_fence>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — scaffold NODEUI-01/03/04 assertions + flip NODEUI-02 Test 5 (RED where missing, adjust where existing)</name>
  <read_first>
    - src/__tests__/editor-panel-loop-form.test.ts (lines 1-120, full Setting-prototype mock pattern to copy)
    - src/__tests__/editor-panel-create.test.ts (lines 1-100 for file boilerplate + lines 412-429 for fakeNode analog)
    - src/__tests__/canvas-node-factory.test.ts (lines 140-165 — the existing Test 5 to flip)
    - src/__mocks__/obsidian.ts (confirm Setting prototype is the same one the production code uses)
    - src/views/editor-panel-view.ts (confirm current line numbers for NODEUI-01 block 477-486, Answer form 424-444, Question form 408-418)
    - .planning/phases/48-node-editor-ux-polish/48-RESEARCH.md (Validation Architecture + Wave 0 Gaps)
    - .planning/phases/48-node-editor-ux-polish/48-PATTERNS.md (section 5 — new test file scaffold)
  </read_first>
  <behavior>
    - Test NODEUI-02 (flip): CanvasNodeFactory.createNode with anchor {x:100,y:200,width:300,height:80} calls canvas.createTextNode with pos { x: 100, y: 200 + 80 + 40 } (NOT { x: 100+300+40, y: 200 }). This test MUST fail against current code (Red) and pass after Task 2.
    - Test NODEUI-01 negative: after invoking buildKindForm(container, 'text-block', nodeRecord), settingCalls.setName MUST NOT contain the string 'Snippet ID (optional)'. MUST fail against current code (Red).
    - Test NODEUI-01 pendingEdits: after simulating the text-block form lifecycle, view['pendingEdits'] MUST NOT contain key 'radiprotocol_snippetId'. MUST fail against current code (Red).
    - Test NODEUI-03 order: after invoking buildKindForm(container, 'answer', nodeRecord), settingCalls.setName.indexOf('Display label (optional)') MUST be LESS THAN settingCalls.setName.indexOf('Answer text'). MUST fail against current code (Red).
    - Test NODEUI-04 custom DOM: after invoking buildKindForm(container, 'question', nodeRecord) with a fakeNode container, createdElements MUST contain an entry with tag 'textarea' AND cls 'rp-question-textarea'. MUST fail against current code (Red — current code creates a textarea inside Obsidian's Setting flow without the rp-question-textarea class).
    - Test NODEUI-04 label-before-textarea ordering: in createdElements, the first appearance of cls 'rp-field-label' AND the first appearance of cls 'rp-field-desc' MUST both precede the first appearance of cls 'rp-question-textarea'.
    - Test NODEUI-04 auto-grow: capture the 'input' callback passed to registerDomEvent on the textarea; simulate scrollHeight=123 on the fake textarea; invoke the callback; assert ta.style.height was written first to 'auto' then to '123px'.
  </behavior>
  <action>
    Create new test file `src/__tests__/editor-panel-forms.test.ts` with exactly the following structure (every assertion below MUST run initially RED except where noted):

    1. File header — verbatim top-of-file boilerplate, copying the import shape from `editor-panel-loop-form.test.ts:1-25`:
       ```typescript
       import { describe, it, expect, beforeEach, vi } from 'vitest';
       import { Setting } from 'obsidian';
       import { EditorPanelView } from '../views/editor-panel-view';
       import type RadiProtocolPlugin from '../main';

       vi.mock('obsidian');
       ```

    2. Shared capture state — COPY verbatim from `editor-panel-loop-form.test.ts:44-103`:
       ```typescript
       const settingCalls: { setName: string[]; setDesc: string[]; setHeading: number }
         = { setName: [], setDesc: [], setHeading: 0 };
       const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
       const textInputOnChange: { cb: ((v: string) => void) | null } = { cb: null };
       const dropdownOptions: Array<[string, string]> = [];
       function installSettingPrototypeMock(): void {
         settingCalls.setName = [];
         settingCalls.setDesc = [];
         settingCalls.setHeading = 0;
         textareaOnChange.cb = null;
         textInputOnChange.cb = null;
         dropdownOptions.length = 0;
         const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
         SettingProto.setName = vi.fn(function (this: unknown, name: string) {
           settingCalls.setName.push(name);
           return this;
         });
         SettingProto.setDesc = vi.fn(function (this: unknown, desc: string) {
           settingCalls.setDesc.push(desc);
           return this;
         });
         SettingProto.setHeading = vi.fn(function (this: unknown) {
           settingCalls.setHeading += 1;
           return this;
         });
         const mockTextArea = {
           setValue: vi.fn(function (this: unknown) { return this; }),
           onChange: vi.fn(function (this: unknown, cb: (v: string) => void) {
             textareaOnChange.cb = cb;
             return this;
           }),
         };
         SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (ta: unknown) => void) {
           cb(mockTextArea);
           return this;
         });
         const mockText = {
           setValue: vi.fn(function (this: unknown) { return this; }),
           onChange: vi.fn(function (this: unknown, cb: (v: string) => void) {
             textInputOnChange.cb = cb;
             return this;
           }),
         };
         SettingProto.addText = vi.fn(function (this: unknown, cb: (t: unknown) => void) {
           cb(mockText);
           return this;
         });
         const mockDropdown = {
           addOption: vi.fn(function (this: unknown, value: string, display: string) {
             dropdownOptions.push([value, display]);
             return this;
           }),
           setValue: vi.fn(function (this: unknown) { return this; }),
           onChange: vi.fn(function (this: unknown) { return this; }),
           selectEl: { createEl: () => ({ disabled: false }) },
         };
         SettingProto.addDropdown = vi.fn(function (this: unknown, cb: (d: unknown) => void) {
           cb(mockDropdown);
           return this;
         });
       }
       ```

    3. fakeNode stub — extend the `editor-panel-create.test.ts:412-429` pattern to capture `createEl` calls into a module-scoped array AND to make textarea children carry a settable `style` + readable `scrollHeight` + record `addEventListener` callbacks. For the Input event hookup inside EditorPanelView NODEUI-04 uses `this.registerDomEvent(ta, 'input', cb)` — and `registerDomEvent` on the real Obsidian ItemView ends up calling `el.addEventListener`; with the `vi.mock('obsidian')` the base class is stubbed. Confirm via reading `src/__mocks__/obsidian.ts` and pick whichever spy point the mock exposes. If the mock's `registerDomEvent` is a no-op, set `view['registerDomEvent']` to a spy that pushes the callback into a `textareaInputCb.cb = cb` capture:
       ```typescript
       const createdElements: Array<{ tag: string; cls?: string; text?: string; parentCls?: string }> = [];
       const textareaInputCb: { cb: (() => void) | null } = { cb: null };
       let lastTextarea: Record<string, unknown> | null = null;
       const fakeNode = (parentCls?: string): Record<string, unknown> => {
         const self: Record<string, unknown> = {
           empty: () => {},
           createDiv: (opts?: { cls?: string; text?: string }) => {
             createdElements.push({ tag: 'div', cls: opts?.cls, text: opts?.text, parentCls });
             return fakeNode(opts?.cls);
           },
           createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
             createdElements.push({ tag, cls: opts?.cls, text: opts?.text, parentCls });
             const child = fakeNode(opts?.cls);
             if (tag === 'textarea') {
               (child as Record<string, unknown>).style = { width: '', height: '' };
               (child as Record<string, unknown>).scrollHeight = 123;
               (child as Record<string, unknown>).value = '';
               lastTextarea = child;
             }
             return child;
           },
           createSpan: () => fakeNode(parentCls),
           setAttribute: () => {},
           appendText: () => {},
           addClass: () => {},
           removeClass: () => {},
           setText: () => {},
           disabled: false,
         };
         return self;
       };
       ```

    4. Helper to instantiate the view with a stubbed `contentEl = fakeNode()` and a spy `registerDomEvent` that captures the textarea's input callback into `textareaInputCb.cb`:
       ```typescript
       function makeView(): EditorPanelView {
         const leaf = {} as unknown as import('obsidian').WorkspaceLeaf;
         const plugin = {} as unknown as RadiProtocolPlugin;
         const view = new EditorPanelView(leaf, plugin);
         (view as unknown as { contentEl: unknown }).contentEl = fakeNode();
         (view as unknown as { registerDomEvent: (el: unknown, ev: string, cb: () => void) => void })
           .registerDomEvent = (el, ev, cb) => {
             if (ev === 'input' && el === lastTextarea) textareaInputCb.cb = cb;
           };
         return view;
       }
       ```

    5. Test block 1 — NODEUI-01 negative + pendingEdits:
       ```typescript
       describe('NODEUI-01: text-block form has no Snippet ID row', () => {
         beforeEach(() => { installSettingPrototypeMock(); createdElements.length = 0; });
         it('does not render a Setting row named "Snippet ID (optional)"', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'text-block');
           expect(settingCalls.setName).not.toContain('Snippet ID (optional)');
         });
         it('does not write radiprotocol_snippetId to pendingEdits when the text-block form is rendered', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'text-block');
           // simulate a user edit through whatever text-input onChange ran last;
           // for text-block after Phase 48 this is the Separator dropdown only, not Snippet ID.
           // @ts-expect-error accessing private for test
           expect(Object.keys(view['pendingEdits'])).not.toContain('radiprotocol_snippetId');
         });
       });
       ```

    6. Test block 2 — NODEUI-03 order:
       ```typescript
       describe('NODEUI-03: answer form renders Display label before Answer text', () => {
         beforeEach(() => { installSettingPrototypeMock(); createdElements.length = 0; });
         it('setName order has "Display label (optional)" before "Answer text"', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'answer');
           const labelIdx = settingCalls.setName.indexOf('Display label (optional)');
           const textIdx = settingCalls.setName.indexOf('Answer text');
           expect(labelIdx).toBeGreaterThanOrEqual(0);
           expect(textIdx).toBeGreaterThanOrEqual(0);
           expect(labelIdx).toBeLessThan(textIdx);
         });
         it('Text separator dropdown stays last (after Answer text)', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'answer');
           const sepIdx = settingCalls.setName.indexOf('Text separator');
           const textIdx = settingCalls.setName.indexOf('Answer text');
           expect(sepIdx).toBeGreaterThan(textIdx);
         });
       });
       ```

    7. Test block 3 — NODEUI-04 custom DOM + auto-grow:
       ```typescript
       describe('NODEUI-04: question form custom DOM + auto-grow textarea', () => {
         beforeEach(() => {
           installSettingPrototypeMock();
           createdElements.length = 0;
           textareaInputCb.cb = null;
           lastTextarea = null;
         });
         it('renders a <textarea class="rp-question-textarea"> NOT wrapped in a .setting-item row', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'question');
           const ta = createdElements.find(e => e.tag === 'textarea' && e.cls === 'rp-question-textarea');
           expect(ta).toBeDefined();
           // addTextArea (which would wrap inside Setting) should NOT have been the one that created the question textarea:
           const taAddedViaSetting = settingCalls.setName.some(n => n === 'Question text');
           expect(taAddedViaSetting).toBe(false);
         });
         it('label + helper description render before the textarea', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'question');
           const labelIdx = createdElements.findIndex(e => e.cls === 'rp-field-label');
           const descIdx = createdElements.findIndex(e => e.cls === 'rp-field-desc');
           const taIdx = createdElements.findIndex(e => e.tag === 'textarea' && e.cls === 'rp-question-textarea');
           expect(labelIdx).toBeGreaterThanOrEqual(0);
           expect(descIdx).toBeGreaterThanOrEqual(0);
           expect(taIdx).toBeGreaterThanOrEqual(0);
           expect(labelIdx).toBeLessThan(taIdx);
           expect(descIdx).toBeLessThan(taIdx);
         });
         it('input event on the textarea writes style.height = "auto" then = scrollHeight + "px"', () => {
           const view = makeView();
           const container = fakeNode();
           // @ts-expect-error accessing private for test
           view['buildKindForm'](container, {}, 'question');
           expect(textareaInputCb.cb).not.toBeNull();
           expect(lastTextarea).not.toBeNull();
           (lastTextarea as { style: { height: string } }).style.height = 'prev';
           textareaInputCb.cb?.();
           expect((lastTextarea as { style: { height: string } }).style.height).toBe('123px');
         });
       });
       ```

    8. Test block 4 — NODEUI-02 Test 5 FLIP — edit the existing `src/__tests__/canvas-node-factory.test.ts` in-place (not the new file):
       - Replace the current assertion at lines 156-160:
         ```typescript
         expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
           expect.objectContaining({
             pos: { x: 100 + 300 + 40, y: 200 }, // anchor.x + anchor.width + NODE_GAP
           })
         );
         ```
         with:
         ```typescript
         expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
           expect.objectContaining({
             pos: { x: 100, y: 200 + 80 + 40 }, // Phase 48 NODEUI-02: anchor.x, anchor.y + anchor.height + NODE_GAP
           })
         );
         ```
       - Update the test description at line 144 from "pos is offset from anchor" to "pos is offset BELOW anchor (Phase 48 NODEUI-02)".
       - Do NOT touch Tests 1-4 or Tests 6+.

    9. Run `npm test -- src/__tests__/editor-panel-forms.test.ts src/__tests__/canvas-node-factory.test.ts` and confirm the RED state: `canvas-node-factory.test.ts` Test 5 fails, and all new assertions in `editor-panel-forms.test.ts` fail (except the ones whose expected state matches current code — document any unexpected green in the commit message).

    Commit as `test(48-01): add Phase 48 form assertions + flip factory Test 5 (RED)`.
  </action>
  <verify>
    <automated>npm test -- src/__tests__/editor-panel-forms.test.ts src/__tests__/canvas-node-factory.test.ts 2>&1 | grep -E "(FAIL|PASS|Test Files|Tests)"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/__tests__/editor-panel-forms.test.ts` exists and imports `Setting, EditorPanelView`, calls `vi.mock('obsidian')`.
    - File `src/__tests__/editor-panel-forms.test.ts` contains at least three `describe` blocks referencing NODEUI-01, NODEUI-03, NODEUI-04.
    - File `src/__tests__/editor-panel-forms.test.ts` contains the strings `'Snippet ID (optional)'`, `'Display label (optional)'`, `'Answer text'`, `'rp-question-textarea'`, `'rp-field-label'`, `'rp-field-desc'`.
    - File `src/__tests__/canvas-node-factory.test.ts` contains the exact string `y: 200 + 80 + 40` and no longer contains `x: 100 + 300 + 40` (grep both).
    - `npm test -- src/__tests__/editor-panel-forms.test.ts` reports FAIL on at least the "setName order", "rp-question-textarea", and "label before textarea" assertions (RED state required before Task 2).
    - `npm test -- src/__tests__/canvas-node-factory.test.ts` reports FAIL on Test 5 (RED state required before Task 2).
    - No other test file is modified.
    - Commit exists with subject matching `test(48-01): add Phase 48 form assertions`.
  </acceptance_criteria>
  <done>All seven new assertions exist and run RED; Test 5 in canvas-node-factory.test.ts is flipped and runs RED; no other tests are altered; commit landed with the `test(48-01)` prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement NODEUI-01, NODEUI-02, NODEUI-03 (surgical edits — delete one block, flip one line, swap two blocks)</name>
  <read_first>
    - src/views/editor-panel-view.ts (lines 464-504 for text-block case, lines 422-462 for answer case; confirm current line numbers match)
    - src/canvas/canvas-node-factory.ts (lines 40-60, the anchor offset block at line 52)
    - src/__tests__/canvas-node-factory.test.ts (lines 140-161, to confirm Test 5 is already in RED state from Task 1)
    - src/__tests__/editor-panel-forms.test.ts (to know exact assertions that must go green)
    - .planning/phases/48-node-editor-ux-polish/48-PATTERNS.md (sections 1 and 2 — exact edits documented)
  </read_first>
  <behavior>
    - After this task, all NODEUI-01 assertions in editor-panel-forms.test.ts go GREEN.
    - After this task, all NODEUI-03 assertions in editor-panel-forms.test.ts go GREEN.
    - After this task, Test 5 in canvas-node-factory.test.ts goes GREEN.
    - NODEUI-04 assertions stay RED (Task 3 delivers them).
    - The regression test `src/__tests__/runner/protocol-runner.test.ts` — "awaiting-snippet-fill" invariant — stays GREEN (confirms scope_fence respected).
    - Full `npm test` reports ≥ prior test count; no previously-green test flips to red.
  </behavior>
  <action>
    Apply three surgical edits. Each edit is localised; do NOT touch anything else.

    1. **NODEUI-01 — delete the Snippet ID Setting block in `src/views/editor-panel-view.ts` `case 'text-block':`.**
       - Current text to delete (exactly lines 477-486 in the file as read today):
         ```typescript
               new Setting(container)
                 .setName('Snippet ID (optional)')
                 .setDesc('Snippet ID for Phase 5 dynamic snippet fill-in. Leave blank if not using snippets.')
                 .addText(t => {
                   t.setValue((nodeRecord['radiprotocol_snippetId'] as string | undefined) ?? '')
                     .onChange(v => {
                       this.pendingEdits['radiprotocol_snippetId'] = v || undefined;
                       this.scheduleAutoSave();
                     });
                 });
         ```
       - Delete those 10 lines INCLUDING the trailing closing brace-and-semicolon line. Do not leave a blank gap — remove the lines cleanly so the Content block (lines 466-476 before deletion) is immediately followed by the `// Separator override dropdown (D-05, D-06, SEP-02)` comment and its Setting block.
       - After deletion, the `case 'text-block':` body reads (verify): heading → Content textarea → Separator dropdown → `break;`.
       - Do NOT change the Content textarea. Do NOT touch `pendingEdits['radiprotocol_content']` or `pendingEdits['text']` or any other `onChange`. Do NOT alter the Separator dropdown.

    2. **NODEUI-02 — flip the anchor offset in `src/canvas/canvas-node-factory.ts` (line 52).**
       - Current line 52:
         ```typescript
               pos = { x: anchor.x + anchor.width + NODE_GAP, y: anchor.y };
         ```
       - Replace with exactly:
         ```typescript
               // Phase 48 NODEUI-02: vertical offset — place new node BELOW anchor (was rightward).
               pos = { x: anchor.x, y: anchor.y + anchor.height + NODE_GAP };
         ```
       - Do NOT alter `NODE_GAP`, the `if (anchor)` guard, the `console.warn` fallback on line 54, the `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT` constants, or any other method on this class.

    3. **NODEUI-03 — swap the two Setting blocks in `src/views/editor-panel-view.ts` `case 'answer':`.**
       - Current structure at lines 422-461: heading → Answer text block (lines 424-434) → Display label block (lines 435-444) → Separator dropdown (lines 445-460) → break.
       - Move the Display label block (lines 435-444 verbatim) to sit immediately after the heading `new Setting(container).setHeading().setName('Answer node');` and before the Answer text block. Do not change a single character inside either block — this is a pure reorder.
       - After the edit, the `case 'answer':` body reads (verify): heading → Display label block → Answer text block → Separator dropdown → break.
       - Do NOT touch the Separator dropdown.

    4. Run the quick suite to confirm the three targeted assertions go GREEN:
       ```
       npm test -- src/__tests__/editor-panel-forms.test.ts src/__tests__/canvas-node-factory.test.ts
       ```
       NODEUI-01 and NODEUI-03 blocks should pass; NODEUI-04 should still have its three RED tests (Task 3 closes those).

    5. Run the regression assertion to confirm the scope fence held:
       ```
       npm test -- src/__tests__/runner/protocol-runner.test.ts -t "awaiting-snippet-fill"
       ```
       MUST stay green.

    6. Commit as `feat(48-01): remove Snippet ID row, flip factory offset, swap answer fields (NODEUI-01/02/03)`.
  </action>
  <verify>
    <automated>npm test -- src/__tests__/editor-panel-forms.test.ts src/__tests__/canvas-node-factory.test.ts src/__tests__/runner/protocol-runner.test.ts 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `src/views/editor-panel-view.ts` no longer contains the string `'Snippet ID (optional)'` (grep -c returns 0).
    - `src/views/editor-panel-view.ts` no longer contains `pendingEdits['radiprotocol_snippetId']` (grep returns 0).
    - `src/canvas/canvas-node-factory.ts` contains the string `anchor.y + anchor.height + NODE_GAP` and no longer contains `anchor.x + anchor.width + NODE_GAP`.
    - In `src/views/editor-panel-view.ts` `case 'answer':` block, the first occurrence of `'Display label (optional)'` precedes the first occurrence of `'Answer text'` (verify by reading the file range lines 420-465).
    - `npm test -- src/__tests__/editor-panel-forms.test.ts -t "NODEUI-01"` → all green.
    - `npm test -- src/__tests__/editor-panel-forms.test.ts -t "NODEUI-03"` → all green.
    - `npm test -- src/__tests__/canvas-node-factory.test.ts -t "Test 5"` → green.
    - `npm test -- src/__tests__/runner/protocol-runner.test.ts -t "awaiting-snippet-fill"` → green (regression invariant preserved).
    - Text inside DO-NOT-TOUCH files (canvas-parser.ts, protocol-runner.ts, graph-model.ts, snippet-block.canvas fixture, attachCanvasListener region) is BYTE-IDENTICAL to pre-task state (run `git diff -- src/graph/canvas-parser.ts src/runner/protocol-runner.ts src/graph/graph-model.ts src/__tests__/fixtures/snippet-block.canvas` → empty).
    - Commit exists with subject starting `feat(48-01): remove Snippet ID row, flip factory offset, swap answer fields`.
  </acceptance_criteria>
  <done>NODEUI-01, 02, 03 implemented with three surgical diffs; five tests flip from RED to GREEN; legacy runner invariant stays GREEN; DO-NOT-TOUCH files unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement NODEUI-04 — replace Question Setting-wrapped textarea with custom-DOM auto-growing textarea</name>
  <read_first>
    - src/views/editor-panel-view.ts (lines 406-420 — current Question case)
    - src/views/runner-view.ts (lines 816-840 — auto-grow pattern to copy VERBATIM in mechanics, adjusted to editor context)
    - src/__tests__/editor-panel-forms.test.ts (NODEUI-04 describe block — the three assertions this task must satisfy)
    - src/__mocks__/obsidian.ts (confirm `registerDomEvent` / `ItemView` mock shape so the input callback capture works)
    - .planning/phases/48-node-editor-ux-polish/48-PATTERNS.md (section 1 NODEUI-04 pattern — authoritative composite snippet at lines 119-140 of PATTERNS.md)
  </read_first>
  <behavior>
    - The Question node form renders a custom DOM block, NOT a `new Setting(container)` row, for the question text input.
    - The block's first child is a `<div class="rp-question-block">` (container), whose children in creation order are: `<div class="rp-field-label">` with text "Question text", `<p class="rp-field-desc">` with text "Displayed to the user during the protocol session.", and `<textarea class="rp-question-textarea">`.
    - The textarea's initial value equals the nodeRecord's `radiprotocol_questionText` (fallback to `text`, fallback to empty string) — identical semantics to current `addTextArea(...).setValue(...)`.
    - On mount (via `requestAnimationFrame`) the textarea height is set to `'auto'` then to `scrollHeight + 'px'`.
    - On each `input` event (registered via `this.registerDomEvent(ta, 'input', cb)` — NOT `addEventListener`), the callback sets height to `'auto'` then to `scrollHeight + 'px'`, writes both `pendingEdits['radiprotocol_questionText']` AND `pendingEdits['text']` to `ta.value`, and calls `this.scheduleAutoSave()`.
    - The existing `new Setting(container).setHeading().setName('Question node')` heading at line 407 REMAINS untouched.
    - All three NODEUI-04 assertions in editor-panel-forms.test.ts go GREEN.
    - `npm test` full suite stays at least at the pre-task green count (428+). No previously-green test flips.
  </behavior>
  <action>
    1. In `src/views/editor-panel-view.ts`, locate `case 'question':` (line 406-420 as of Task 2 completion — line numbers may have shifted by +/-0 since Task 2 did not touch this case).

    2. Leave the first line untouched:
       ```typescript
         case 'question': {
           new Setting(container).setHeading().setName('Question node');
       ```

    3. Replace the ENTIRE existing Setting block (current lines 408-418 — the `new Setting(container).setName('Question text')...addTextArea(...)` block) with the following custom-DOM block. Do NOT alter the surrounding `case 'question': { ... break; }` structure or the heading line above:
       ```typescript
           // Phase 48 NODEUI-04: custom-DOM textarea with label-above + auto-grow.
           // Setting API forces label-left/control-right layout and caps textarea width;
           // here we emit the three DOM nodes directly so the textarea can be full-width
           // and auto-grow via the runner-view.ts:816-840 scrollHeight pattern.
           const qBlock = container.createDiv({ cls: 'rp-question-block' });
           qBlock.createDiv({ cls: 'rp-field-label', text: 'Question text' });
           qBlock.createEl('p', {
             cls: 'rp-field-desc',
             text: 'Displayed to the user during the protocol session.',
           });
           const qTextarea = qBlock.createEl('textarea', { cls: 'rp-question-textarea' });
           qTextarea.value =
             (nodeRecord['radiprotocol_questionText'] as string | undefined) ??
             (nodeRecord['text'] as string | undefined) ??
             '';
           requestAnimationFrame(() => {
             qTextarea.style.height = 'auto';
             qTextarea.style.height = qTextarea.scrollHeight + 'px';
           });
           this.registerDomEvent(qTextarea, 'input', () => {
             qTextarea.style.height = 'auto';
             qTextarea.style.height = qTextarea.scrollHeight + 'px';
             this.pendingEdits['radiprotocol_questionText'] = qTextarea.value;
             this.pendingEdits['text'] = qTextarea.value;
             this.scheduleAutoSave();
           });
       ```

    4. Leave the `break;` after this block untouched. Do NOT change `case 'answer':`, `case 'text-block':`, `case 'start':`, `case 'snippet':`, `case 'loop':`, or any code outside `case 'question':`.

    5. Run the quick suite — NODEUI-04 assertions must now go GREEN:
       ```
       npm test -- src/__tests__/editor-panel-forms.test.ts
       ```

    6. Run full suite to confirm no collateral damage:
       ```
       npm test
       ```

    7. Commit as `feat(48-01): replace Question textarea with custom-DOM auto-grow block (NODEUI-04)`.

    NOTE on scope: no CSS changes in this plan. The `rp-question-block` / `rp-field-label` / `rp-field-desc` / `rp-question-textarea` classes will be styled in Plan 02 (`editor-panel.css` append). Without the CSS, the textarea renders but may look visually unstyled — that is expected and will be closed in Plan 02. The functional behaviour (auto-grow, persistence) works without CSS; the unit tests pass without CSS.
  </action>
  <verify>
    <automated>npm test 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `src/views/editor-panel-view.ts` contains the literal substring `createEl('textarea', { cls: 'rp-question-textarea' })`.
    - `src/views/editor-panel-view.ts` contains the literal substring `'rp-question-block'` AND `'rp-field-label'` AND `'rp-field-desc'`.
    - `src/views/editor-panel-view.ts` contains the literal substring `this.registerDomEvent(qTextarea, 'input'`.
    - `src/views/editor-panel-view.ts` contains BOTH `this.pendingEdits['radiprotocol_questionText']` AND `this.pendingEdits['text']` in the question-textarea input handler (grep: both must be present within 5 lines of `rp-question-textarea`).
    - Inside `case 'question':`, there is NO line matching `new Setting(container).setName('Question text')` (grep returns 0).
    - `npm test -- src/__tests__/editor-panel-forms.test.ts -t "NODEUI-04"` → all green.
    - `npm test` full suite green count is ≥ the pre-Phase-48 baseline (428 per STATE.md). New tests add to the count; none flip from green.
    - `src/__tests__/runner/protocol-runner.test.ts` suite stays green (scope fence preserved).
    - Commit exists with subject starting `feat(48-01): replace Question textarea with custom-DOM auto-grow block`.
  </acceptance_criteria>
  <done>Question form emits the custom DOM block; auto-grow + pendingEdits + scheduleAutoSave wiring preserved; all NODEUI-04 unit tests green; full suite green; no DO-NOT-TOUCH file changed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI → pendingEdits → vault.modify | User-typed text on canvas node form flows into in-memory edits then to disk via WriteMutex-guarded `vault.modify` (unchanged in this plan). |
| Canvas JSON → TextBlockNode parser | Existing canvases with legacy `radiprotocol_snippetId` continue to deserialize (scope fence). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-01 | Tampering | Question textarea — user-typed content flows into `pendingEdits['text']` + `pendingEdits['radiprotocol_questionText']` | accept | Input is user-authored protocol content; no injection surface introduced vs. the existing `addTextArea.onChange` path. CLAUDE.md forbids `innerHTML`; NODEUI-04 uses `createEl('textarea')` and plain `.value` — no unsafe API used. |
| T-48-02 | Information Disclosure | Legacy `radiprotocol_snippetId` on disk becomes orphaned (UI no longer shows it) | accept | Conservative reading per RESEARCH.md A1 — existing canvases still render correctly via the parser + runner read paths; users can clear the key through direct canvas JSON edit if desired. Zero exposure of secrets; this key is user-authored protocol metadata. |
| T-48-03 | Denial of Service | Auto-grow runaway — pathological paste of megabytes of text could allocate huge textarea | accept | Same risk exists on the runner textarea (Phase 12 + 47 precedent, production-verified for 6+ months). No new DoS surface introduced by Phase 48. |
| T-48-04 | Tampering | `canvas-node-factory.ts` offset change alters node placement for every future quick-create | mitigate | Flipped assertion in `canvas-node-factory.test.ts` Test 5 plus Tests 1-4 (error paths) guarantee the new vertical offset; Tests 6+ (anchor-less default, etc.) unchanged to lock surrounding behaviour. |
</threat_model>

<verification>
After every task:
- `npm test -- src/__tests__/editor-panel-forms.test.ts src/__tests__/editor-panel-create.test.ts src/__tests__/editor-panel-loop-form.test.ts src/__tests__/canvas-node-factory.test.ts` — quick run.
- After Task 3: `npm test` — full suite, ≥ 428 passed baseline.
- After Task 3: `git diff -- src/graph/canvas-parser.ts src/runner/protocol-runner.ts src/graph/graph-model.ts src/__tests__/fixtures/snippet-block.canvas src/__tests__/runner/protocol-runner.test.ts` → MUST be empty (scope fence verification).

Regression watchlist (must stay green):
- `src/__tests__/runner/protocol-runner.test.ts` — "awaiting-snippet-fill when reaching a text-block with snippetId"
- `src/__tests__/editor-panel-create.test.ts` — all 7 quick-create harness tests
- `src/__tests__/editor-panel.test.ts` — view metadata sanity
- `src/__tests__/editor-panel-loop-form.test.ts` — loop-form Setting-mock tests
</verification>

<success_criteria>
- NODEUI-01: "Snippet ID (optional)" Setting row gone from the Text-block form; pendingEdits no longer contains `radiprotocol_snippetId`; legacy parser/runner test still green (verified by a preserved regression test).
- NODEUI-02: `CanvasNodeFactory.createNode` places the new node at `(anchor.x, anchor.y + anchor.height + NODE_GAP)` — verified by flipped `canvas-node-factory.test.ts` Test 5.
- NODEUI-03: Answer form emits `setName('Display label (optional)')` strictly before `setName('Answer text')` — verified by new order test.
- NODEUI-04: Question form emits `<textarea class="rp-question-textarea">` inside `<div class="rp-question-block">` with sibling label + helper DOM nodes; textarea auto-grows on input via `scrollHeight`; pendingEdits + scheduleAutoSave preserved — verified by new DOM-structure + input-callback test.
- Full `npm test` green; all DO-NOT-TOUCH files byte-identical; three atomic commits (`test(48-01)`, `feat(48-01): ...NODEUI-01/02/03`, `feat(48-01): ...NODEUI-04`).
</success_criteria>

<output>
After completion, create `.planning/phases/48-node-editor-ux-polish/48-01-SUMMARY.md` following the GSD summary template. Include:
- Three atomic commits with hashes.
- Changed-file list (exactly the four files in `files_modified`).
- Test count delta (prior green count → new green count).
- Explicit confirmation that DO-NOT-TOUCH files show an empty diff.
- Note that Plan 02 handles the CSS + NODEUI-05 DOM re-order (Wave 2).
</output>
