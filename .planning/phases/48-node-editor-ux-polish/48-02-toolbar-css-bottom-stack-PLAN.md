---
phase: 48-node-editor-ux-polish
plan: 02
type: execute
wave: 2
depends_on: [48-01]
files_modified:
  - src/styles/editor-panel.css
  - src/views/editor-panel-view.ts
  - src/__tests__/editor-panel-forms.test.ts
  - styles.css
  - src/styles.css
autonomous: true
requirements: [NODEUI-05]
tags: [editor-panel, css, layout, toolbar]
must_haves:
  truths:
    - "The `.rp-editor-create-toolbar` lays out as a single vertical column (flex-direction: column) with each button full-width, NOT as a wrapping row."
    - "The toolbar is the LAST child of `this.contentEl` in both idle mode (no node selected) AND form mode (node loaded) — confirmed by DOM-order unit tests."
    - "The toolbar is anchored at the BOTTOM of the Node Editor panel via `margin-top: auto` on the toolbar element inside the existing `flex-direction: column` parent chain."
    - "Phase 48 CSS is appended to `src/styles/editor-panel.css` with a `/* Phase 48: ... */` marker at EOF — every earlier phase block (Phase 4/39/40/42/42 Plan 04/45) remains byte-identical."
    - "After the CSS edit, `npm run build` has been run; `styles.css` (repo root) and `src/styles.css` contain the Phase 48 marker."
    - "Plan 01's custom DOM from NODEUI-04 (`rp-question-block`, `rp-field-label`, `rp-field-desc`, `rp-question-textarea`) now has matching CSS so the Question form looks consistent with the rest of the panel."
  artifacts:
    - path: "src/styles/editor-panel.css"
      provides: "Phase 48 NODEUI-04 + NODEUI-05 CSS appended at EOF"
      contains: "Phase 48 NODEUI-05"
    - path: "src/views/editor-panel-view.ts"
      provides: "renderToolbar call moved to the end of renderIdle and renderForm"
      contains: "// Phase 48 NODEUI-05"
    - path: "styles.css"
      provides: "regenerated bundle with Phase 48 CSS"
      contains: "Phase 48 NODEUI-05"
    - path: "src/__tests__/editor-panel-forms.test.ts"
      provides: "new NODEUI-05 DOM-order assertions + CSS-file-parse assertion"
      contains: "toolbar is last child"
  key_links:
    - from: "editor-panel-view.ts renderIdle / renderForm"
      to: "renderToolbar(this.contentEl)"
      via: "call position AFTER form body"
      pattern: "renderToolbar.*contentEl.*Phase 48"
    - from: ".rp-editor-panel (existing flex-direction: column parent)"
      to: ".rp-editor-create-toolbar { margin-top: auto }"
      via: "CSS cascade overriding Phase 39 + Phase 42 Plan 04"
      pattern: "margin-top:\\s*auto"
    - from: "src/styles/editor-panel.css"
      to: "styles.css (generated root bundle)"
      via: "npm run build (esbuild CSS concat)"
      pattern: "Phase 48 NODEUI-05"
---

<objective>
Close NODEUI-05 — the last Phase 48 success criterion — by (a) moving the `renderToolbar(this.contentEl)` call in both `renderIdle` and `renderForm` from the TOP of `contentEl` to the BOTTOM so the quick-create toolbar becomes the last child of the panel in every state, and (b) appending Phase 48 CSS blocks at the end of `src/styles/editor-panel.css` that change `.rp-editor-create-toolbar` from `flex-direction: row` + `flex-wrap: wrap` to `flex-direction: column` + `flex-wrap: nowrap` with `margin-top: auto` and full-width buttons, AND add the companion `rp-question-block` / `rp-field-label` / `rp-field-desc` / `rp-question-textarea` styling that Plan 01's NODEUI-04 custom DOM needs for visual parity with the rest of the form.

Purpose: ship the final 5th success criterion of Phase 48 with strictly-additive CSS (CLAUDE.md append-only rule) and a minimum-diff DOM re-order (two call-site moves + one comment). Previous phase CSS blocks stay byte-identical; cascade order lets Phase 48 win without deletion.

Output: edited `src/styles/editor-panel.css` with two new Phase 48 blocks appended; edited `src/views/editor-panel-view.ts` with the two `renderToolbar` calls moved; regenerated `styles.css` (root) and `src/styles.css` (convenience copy) via `npm run build`; two new NODEUI-05 assertions in `src/__tests__/editor-panel-forms.test.ts` (DOM-order + CSS-file-parse). Full `npm test` green; DO-NOT-TOUCH list from Plan 01 still respected; no earlier phase CSS block modified or deleted.
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
@.planning/phases/48-node-editor-ux-polish/48-01-editor-form-ts-core-PLAN.md
@esbuild.config.mjs

<interfaces>
<!-- Context needed to land this plan correctly. -->

From src/views/editor-panel-view.ts (two call sites to move — line numbers as shipped by Plan 01 Task 3; re-verify with grep before editing):
```typescript
// renderIdle (around line 142-150)
private renderIdle(): void {
  this.contentEl.empty();
  this.renderToolbar(this.contentEl);  // <-- Phase 39 — MUST MOVE to the end of this function
  const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
  container.createEl('p', { text: 'No node selected' });
  container.createEl('p', { text: "Right-click a canvas node..." });
}

// renderForm (around line 327-331)
private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
  this.contentEl.empty();
  this.renderToolbar(this.contentEl);  // <-- Phase 39 — MUST MOVE to the end of this function
  const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
  const formArea = panel.createDiv({ cls: 'rp-editor-form' });
  // ... form body + indicatorRow created inside `panel` ...
}
```

From src/styles/editor-panel.css (existing rules to COEXIST with Phase 48, never delete):
```css
/* Phase 39 (existing — do not touch) */
.rp-editor-create-toolbar {
  display: flex;
  flex-direction: row;    /* Phase 48 will override with `column` in a later block */
  gap: var(--size-4-2);
  padding-bottom: var(--size-4-2);
  border-bottom: 1px solid var(--background-modifier-border);
}

/* Phase 42 Plan 04 (existing — do not touch) at lines 164-168 */
.rp-editor-create-toolbar {
  flex-wrap: wrap;
  row-gap: var(--size-4-1);
}
```

From esbuild.config.mjs (CSS concat order — informational):
```js
const CSS_FILES = [
  'src/styles/runner-view.css',
  'src/styles/canvas-selector.css',
  'src/styles/editor-panel.css',      // <- this file; changes propagate to styles.css on `npm run build`
  'src/styles/snippet-manager.css',
  'src/styles/snippet-fill-modal.css',
  'src/styles/loop-support.css',
];
```
</interfaces>
</context>

<scope_fence>
DO NOT TOUCH (same fence as Plan 01, plus CSS-specific items):
- Any CSS block added by Phase 4/39/40/42/42 Plan 04/45 in `src/styles/editor-panel.css` (lines 1-198 as shipped today) — the Phase 48 override must WIN BY CASCADE, not by deletion. Zero bytes changed inside existing phase blocks.
- The existing `.rp-editor-create-toolbar { flex-direction: row; … }` rule at Phase 39 (lines ~47-57) — preserved.
- The existing `.rp-editor-create-toolbar { flex-wrap: wrap; row-gap: var(--size-4-1); }` rule at Phase 42 Plan 04 (lines 164-168) — preserved.
- `src/styles/runner-view.css`, `src/styles/canvas-selector.css`, `src/styles/snippet-manager.css`, `src/styles/snippet-fill-modal.css`, `src/styles/loop-support.css` — not touched.
- `src/views/editor-panel-view.ts` SCOPE FENCE (from Plan 01, still in force): `attachCanvasListener` / `canvasPointerdownHandler` / `handleNodeClick` (lines ~81-116); Phase 42 in-memory fallback inside `renderNodeForm` (lines ~308-316); the `buildKindForm` bodies (Plan 01 owns those edits; Plan 02 only touches `renderIdle` + `renderForm` call-site position).
- `renderToolbar` itself — its body at ~line 801 stays byte-identical. ONLY the two CALL SITES in renderIdle + renderForm move.
- Button creation order inside `renderToolbar` (Question → Answer → Snippet → Loop → Duplicate) — unchanged.
- All DO-NOT-TOUCH files from Plan 01 (`canvas-parser.ts`, `protocol-runner.ts`, `graph-model.ts`, the snippet-block fixture, the awaiting-snippet-fill test).
- `styles.css` at project root and `src/styles.css` — generated. NEVER edit directly. Must be regenerated via `npm run build` as the last step of this plan.
</scope_fence>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add NODEUI-05 assertions to editor-panel-forms.test.ts (DOM-order + CSS-file-parse, RED)</name>
  <read_first>
    - src/__tests__/editor-panel-forms.test.ts (Plan 01 Task 1 created this file; confirm fakeNode + createdElements machinery is present)
    - src/views/editor-panel-view.ts (lines 142-150 renderIdle, lines 327-331 renderForm — current call-site positions)
    - src/styles/editor-panel.css (confirm it currently ends at line 198 with the Phase 45 loop button block; no Phase 48 block yet)
    - .planning/phases/48-node-editor-ux-polish/48-VALIDATION.md (Wave 0 rows for NODEUI-05 — DOM order + CSS file parse)
  </read_first>
  <behavior>
    - Test NODEUI-05 DOM order (renderForm): after invoking `(view as any)['renderForm']({}, null)` with a fakeNode `contentEl`, the LAST entry in `createdElements` whose `parentCls` is undefined (i.e., a direct child of `contentEl`) must be the one created by `renderToolbar` — captured either by a spy on `renderToolbar` that records call timestamp, or by detecting that the toolbar-creating `createDiv` call (classname 'rp-editor-create-toolbar' if renderToolbar creates it via createDiv, OR the last top-level call if renderToolbar is spied as the last invocation) appears AFTER the `rp-editor-panel` createDiv call.
    - Test NODEUI-05 DOM order (renderIdle): after invoking `(view as any)['renderIdle']()` with a fakeNode `contentEl`, the `renderToolbar` invocation must come AFTER both `<p>` elements inside `rp-editor-idle` are created — i.e., toolbar is last.
    - Test NODEUI-05 CSS file parse: `fs.readFileSync('src/styles/editor-panel.css', 'utf8')` must contain a `/* Phase 48` marker AND, within the Phase 48 region, the literal substrings `flex-direction: column`, `flex-wrap: nowrap`, and `margin-top: auto` (all three present after Task 2 lands; RED until then).
    - All three RED until Task 2 implements the changes.
  </behavior>
  <action>
    Append three new `describe` blocks to the EXISTING `src/__tests__/editor-panel-forms.test.ts` file (created in Plan 01 Task 1). Do NOT rewrite the file; ONLY append. The shared harness (installSettingPrototypeMock, fakeNode, makeView, createdElements, etc.) is already in place.

    1. Extend the `makeView` helper (in-file edit — add a spy for `renderToolbar` so the tests can observe call order). If `makeView` already exists in Plan 01's file, extend it with an additional spy; if adding a new helper is cleaner, call it `makeViewWithToolbarSpy`:
       ```typescript
       const renderToolbarCalls: Array<{ at: number }> = [];
       let callCounter = 0;
       function makeViewWithToolbarSpy(): EditorPanelView {
         const view = makeView();
         renderToolbarCalls.length = 0;
         callCounter = 0;
         // Spy on renderToolbar — push a timestamp each call
         (view as unknown as { renderToolbar: (c: unknown) => void })['renderToolbar'] = (_c: unknown) => {
           renderToolbarCalls.push({ at: ++callCounter });
         };
         // Also stamp every createDiv/createEl so we can compare call order
         return view;
       }
       ```
       If spying `renderToolbar` directly conflicts with the Plan 01 fakeNode instrumentation, a simpler alternative is: override `renderToolbar` to push a sentinel `{ tag: '__TOOLBAR__' }` into `createdElements`, then assert `createdElements.findIndex(e => e.tag === '__TOOLBAR__')` is GREATER THAN the index of `cls: 'rp-editor-panel'` (for renderForm) and greater than the index of the two `<p>` elements in `rp-editor-idle` (for renderIdle).

    2. Append the three describes at the bottom of the test file:
       ```typescript
       import * as fs from 'fs';
       import * as path from 'path';

       describe('NODEUI-05: toolbar renders at the bottom of contentEl', () => {
         beforeEach(() => {
           installSettingPrototypeMock();
           createdElements.length = 0;
         });
         it('renderIdle: toolbar is invoked AFTER the idle container <p> elements', () => {
           const view = makeView();
           (view as unknown as { renderToolbar: (c: unknown) => void })['renderToolbar'] =
             () => { createdElements.push({ tag: '__TOOLBAR__' }); };
           // @ts-expect-error accessing private
           view['renderIdle']();
           const idleIdx = createdElements.findIndex(e => e.cls === 'rp-editor-idle');
           const toolbarIdx = createdElements.findIndex(e => e.tag === '__TOOLBAR__');
           expect(idleIdx).toBeGreaterThanOrEqual(0);
           expect(toolbarIdx).toBeGreaterThanOrEqual(0);
           expect(toolbarIdx).toBeGreaterThan(idleIdx);
         });
         it('renderForm: toolbar is invoked AFTER the .rp-editor-panel container', () => {
           const view = makeView();
           (view as unknown as { renderToolbar: (c: unknown) => void })['renderToolbar'] =
             () => { createdElements.push({ tag: '__TOOLBAR__' }); };
           // @ts-expect-error accessing private
           view['renderForm']({}, null);
           const panelIdx = createdElements.findIndex(e => e.cls === 'rp-editor-panel');
           const toolbarIdx = createdElements.findIndex(e => e.tag === '__TOOLBAR__');
           expect(panelIdx).toBeGreaterThanOrEqual(0);
           expect(toolbarIdx).toBeGreaterThanOrEqual(0);
           expect(toolbarIdx).toBeGreaterThan(panelIdx);
         });
       });

       describe('NODEUI-05: editor-panel.css has Phase 48 column-stack rules', () => {
         it('contains a /* Phase 48 */ marker with flex-direction: column + margin-top: auto + flex-wrap: nowrap', () => {
           const cssPath = path.resolve(__dirname, '../styles/editor-panel.css');
           const css = fs.readFileSync(cssPath, 'utf8');
           const phase48Idx = css.indexOf('/* Phase 48');
           expect(phase48Idx).toBeGreaterThanOrEqual(0);
           const phase48Region = css.slice(phase48Idx);
           expect(phase48Region).toContain('flex-direction: column');
           expect(phase48Region).toContain('margin-top: auto');
           expect(phase48Region).toContain('flex-wrap: nowrap');
         });
       });
       ```

    3. Run `npm test -- src/__tests__/editor-panel-forms.test.ts` — the three new assertions MUST fail (RED). Earlier Plan 01 assertions stay green.

    4. Commit as `test(48-02): add NODEUI-05 DOM-order + CSS-file-parse assertions (RED)`.
  </action>
  <verify>
    <automated>npm test -- src/__tests__/editor-panel-forms.test.ts 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `src/__tests__/editor-panel-forms.test.ts` now contains three additional `it(...)` blocks whose titles mention "toolbar" or "Phase 48".
    - The file contains the literal strings `'__TOOLBAR__'`, `'rp-editor-idle'`, `'rp-editor-panel'`, `/* Phase 48`, `'flex-direction: column'`, `'margin-top: auto'`, `'flex-wrap: nowrap'`.
    - `npm test -- src/__tests__/editor-panel-forms.test.ts -t "NODEUI-05"` reports FAIL on all three new assertions (RED state).
    - Plan 01's four NODEUI-01/03/04 describes are BYTE-IDENTICAL (no regression in test harness). Run `git diff src/__tests__/editor-panel-forms.test.ts` and confirm the diff shows ONLY additions at the end of the file (no deletions, no changes to existing lines).
    - Commit exists with subject starting `test(48-02): add NODEUI-05`.
  </acceptance_criteria>
  <done>Three NODEUI-05 assertions added (RED); existing Plan 01 assertions untouched; commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Move renderToolbar call to end of renderIdle + renderForm; append Phase 48 CSS blocks; run npm run build</name>
  <read_first>
    - src/views/editor-panel-view.ts (lines 142-150 renderIdle; lines 327-387 renderForm — the full function body so the toolbar can be placed after the last element the function creates)
    - src/styles/editor-panel.css (current EOF = line 198; confirm last block is Phase 45 loop button)
    - .planning/phases/48-node-editor-ux-polish/48-PATTERNS.md (section 3 — exact CSS block to paste)
    - .planning/phases/48-node-editor-ux-polish/48-RESEARCH.md (Anti-Patterns section — cascade override rule, no deletions allowed)
    - CLAUDE.md (CSS architecture + append-only rule; `npm run build` requirement)
    - esbuild.config.mjs (CSS concat order confirmation)
  </read_first>
  <behavior>
    - `renderIdle` in editor-panel-view.ts now calls `this.renderToolbar(this.contentEl)` as the LAST statement, not the first. Layout: empty → createDiv('rp-editor-idle') + two <p> → renderToolbar.
    - `renderForm` in editor-panel-view.ts now calls `this.renderToolbar(this.contentEl)` as the LAST statement, not the first. Layout: empty → createDiv('rp-editor-panel') + formArea + Node type dropdown + buildKindForm + saved indicator → renderToolbar.
    - `src/styles/editor-panel.css` now has two new `/* Phase 48 */` blocks appended AFTER line 198 (after the Phase 45 `.rp-create-loop-btn:disabled` block), containing: (block A) NODEUI-04 styling for `.rp-question-block`, `.rp-field-label`, `.rp-field-desc`, `.rp-question-textarea`; (block B) NODEUI-05 override for `.rp-editor-create-toolbar` (column layout, nowrap, margin-top: auto, full-width buttons).
    - Every byte of `src/styles/editor-panel.css` from line 1 through line 198 (the current EOF) is UNCHANGED.
    - After `npm run build`, both `styles.css` (project root) and `src/styles.css` (convenience copy) contain the substring `Phase 48 NODEUI-05`.
    - All three NODEUI-05 assertions from Task 1 go GREEN.
    - Full `npm test` stays green.
  </behavior>
  <action>
    1. **Edit `src/views/editor-panel-view.ts` — `renderIdle` call-site move.**
       Locate the current `renderIdle` method (around lines 142-150). The body today reads:
       ```typescript
       private renderIdle(): void {
         this.contentEl.empty();
         this.renderToolbar(this.contentEl);  // Phase 39: quick-create toolbar
         const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
         container.createEl('p', { text: 'No node selected' });
         container.createEl('p', {
           text: "Right-click a canvas node and choose 'Edit RadiProtocol properties' to open its configuration form.",
         });
       }
       ```
       Rewrite ONLY these lines exactly as:
       ```typescript
       private renderIdle(): void {
         this.contentEl.empty();
         const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
         container.createEl('p', { text: 'No node selected' });
         container.createEl('p', {
           text: "Right-click a canvas node and choose 'Edit RadiProtocol properties' to open its configuration form.",
         });
         // Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).
         this.renderToolbar(this.contentEl);
       }
       ```
       Change is net-zero in lines added vs removed (one line moved + one comment added). The two `container.createEl` calls and the `contentEl.empty()` call are BYTE-IDENTICAL in content; only their relative order vs `renderToolbar` changes.

    2. **Edit `src/views/editor-panel-view.ts` — `renderForm` call-site move.**
       Locate the current `renderForm` method (around lines 327-387). The first four lines today read:
       ```typescript
       private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
         this.contentEl.empty();
         this.renderToolbar(this.contentEl);  // Phase 39: quick-create toolbar
         const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
         const formArea = panel.createDiv({ cls: 'rp-editor-form' });
       ```
       Change the opening to:
       ```typescript
       private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
         this.contentEl.empty();
         const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
         const formArea = panel.createDiv({ cls: 'rp-editor-form' });
       ```
       And at the END of `renderForm` (immediately before the closing brace of the function — after the `indicatorRow.removeClass('is-visible');` line that ends the function body around line 386), add:
       ```typescript
         // Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).
         this.renderToolbar(this.contentEl);
       }
       ```
       Do NOT alter anything between the opening 4 lines and the closing — specifically: the Node-type dropdown block (lines ~334-367), the empty-type hint (lines ~369-375), the `kindFormSection` / `buildKindForm` call (lines ~377-379), and the saved indicator block (lines ~381-387) are all BYTE-IDENTICAL.

    3. **Append Phase 48 CSS blocks to `src/styles/editor-panel.css`.**
       Open `src/styles/editor-panel.css`. Confirm it currently ends at line 198 with `}`  closing the `.rp-create-loop-btn:disabled` rule (Phase 45). DO NOT touch any byte before that. Append EXACTLY the following text starting on a new line AFTER the current line 199 (or wherever the file currently ends — append at EOF):
       ```css

       /* Phase 48 NODEUI-04: Question textarea custom layout (label + helper above, full-width) */
       .rp-question-block {
         padding: var(--size-4-2) 0;
         border-top: 1px solid var(--background-modifier-border);
       }
       .rp-question-block .rp-field-label {
         font-size: var(--font-ui-small);
         font-weight: var(--font-semibold);
         margin-bottom: var(--size-2-1);
       }
       .rp-question-block .rp-field-desc {
         color: var(--text-muted);
         font-size: var(--font-ui-smaller);
         margin: 0 0 var(--size-4-1) 0;
       }
       .rp-question-textarea {
         width: 100%;
         min-height: 80px;
         box-sizing: border-box;
         resize: vertical;
       }

       /* Phase 48 NODEUI-05: anchor create toolbar at bottom of panel, vertical column */
       .rp-editor-create-toolbar {
         flex-direction: column;
         flex-wrap: nowrap;
         margin-top: auto;
         width: 100%;
         border-bottom: none;
         border-top: 1px solid var(--background-modifier-border);
         padding-top: var(--size-4-2);
       }
       .rp-editor-create-toolbar > button {
         width: 100%;
         justify-content: center;
       }
       ```
       Cascade note: the Phase 39 `.rp-editor-create-toolbar { flex-direction: row; ... }` at lines ~47-57 and the Phase 42 Plan 04 `.rp-editor-create-toolbar { flex-wrap: wrap; row-gap: ... }` at lines 164-168 stay in place. CSS cascade ensures this Phase 48 block (last, same specificity) wins on `flex-direction`, `flex-wrap`, and adds `margin-top: auto` + `width: 100%` + the `> button` child rule.

    4. **Run `npm run build`.**
       Execute (non-interactive):
       ```
       npm run build
       ```
       Expected: `tsc -noEmit -skipLibCheck` passes (no TypeScript errors), then esbuild runs, then the CSS concat step regenerates `styles.css` (project root) and `src/styles.css` (convenience copy). Do NOT hand-edit either generated file.

    5. **Run tests — the three NODEUI-05 assertions go GREEN.**
       ```
       npm test -- src/__tests__/editor-panel-forms.test.ts
       ```
       Then the full suite:
       ```
       npm test
       ```

    6. **Commit.**
       Stage `src/views/editor-panel-view.ts`, `src/styles/editor-panel.css`, `styles.css`, `src/styles.css` (the last two are the expected build-artifact update for the Phase 48 CSS regeneration — per CLAUDE.md they are generated but their check-in is the existing convention — confirm this by running `git log --oneline -- styles.css | head -5` before editing, which should show earlier phase CSS-only commits that included the regenerated bundle). If the repo convention turns out to NOT commit `styles.css`, adjust `files_modified` accordingly and skip those two files from `git add`.
       Commit message:
       ```
       feat(48-02): anchor create toolbar at bottom as vertical column (NODEUI-05)
       ```
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -10 && npm test 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `src/views/editor-panel-view.ts`: `renderIdle` body has `this.renderToolbar(this.contentEl);` as its LAST statement (grep the function body — the line must appear after both `container.createEl('p', ...)` calls).
    - `src/views/editor-panel-view.ts`: `renderForm` body has `this.renderToolbar(this.contentEl);` as its LAST statement (appears after `indicatorRow.removeClass('is-visible');`).
    - `src/views/editor-panel-view.ts` contains the comment `// Phase 48 NODEUI-05: toolbar moved to bottom` in at least two places.
    - `src/styles/editor-panel.css`: lines 1-198 (as shipped pre-Phase-48) are BYTE-IDENTICAL. Run `git diff src/styles/editor-panel.css` and confirm the diff consists ONLY of appended lines at the end of the file.
    - `src/styles/editor-panel.css` contains the marker strings `/* Phase 48 NODEUI-04:` and `/* Phase 48 NODEUI-05:`.
    - `src/styles/editor-panel.css` contains all of: `flex-direction: column;`, `flex-wrap: nowrap;`, `margin-top: auto;`, `.rp-question-textarea`, `.rp-question-block`.
    - `styles.css` (project root) contains the substring `Phase 48 NODEUI-05`.
    - `src/styles.css` (convenience copy) contains the substring `Phase 48 NODEUI-05`.
    - `npm run build` exits 0.
    - `npm test -- src/__tests__/editor-panel-forms.test.ts -t "NODEUI-05"` → all three green.
    - `npm test` full suite green ≥ the post-Plan-01 count.
    - `src/__tests__/runner/protocol-runner.test.ts` — "awaiting-snippet-fill" → green (Plan 01 scope fence still holds).
    - Text inside DO-NOT-TOUCH files from Plan 01's scope fence is byte-identical (run `git diff -- src/graph/canvas-parser.ts src/runner/protocol-runner.ts src/graph/graph-model.ts` → empty).
    - Commit exists with subject starting `feat(48-02): anchor create toolbar at bottom`.
  </acceptance_criteria>
  <done>Toolbar call-sites moved; Phase 48 CSS appended with zero edits to earlier blocks; bundle regenerated; all NODEUI-05 tests green; full suite green; DO-NOT-TOUCH files unchanged.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Phase 48 is complete after this checkpoint:
    - NODEUI-01: Snippet ID (optional) input gone from the Text block form (Plan 01).
    - NODEUI-02: Quick-create buttons now place new nodes BELOW the anchor (Plan 01).
    - NODEUI-03: Answer form renders Display label ABOVE Answer text (Plan 01).
    - NODEUI-04: Question textarea auto-grows with its content; label + helper stack above the textarea at full panel width (Plan 01 logic + Plan 02 CSS).
    - NODEUI-05: Quick-create toolbar is anchored at the bottom of the Node Editor panel as a single full-width vertical column (Plan 02).

    Full `npm test` green; `npm run build` succeeded; repo is ready for visual UAT in TEST-BASE vault (the same vault used for Phase 47 UAT).
  </what-built>
  <how-to-verify>
    1. Open the TEST-BASE vault in Obsidian (the vault used for Phase 47 UAT).
    2. Ensure the plugin is loaded (Settings → Community plugins → RadiProtocol enabled). If you just pulled, hit Reload app.
    3. Open any RadiProtocol `.canvas` file.
    4. Open the Node Editor panel (right-click a canvas node → "Edit RadiProtocol properties", or open it from the ribbon).
    5. **Verify NODEUI-05 — toolbar layout:**
       - With NO node selected (idle state), look at the panel. The four Create buttons (Create Question / Answer / Snippet / Loop — and the Duplicate button if visible) should be a single vertical full-width stack at the BOTTOM of the panel, NOT at the top and NOT wrapping as a row.
       - Select a node (any kind). Confirm the toolbar is still at the bottom, now below the form fields.
       - Shrink the sidebar to ~300px wide. The buttons must still stack vertically (no wrapping row behaviour).
    6. **Verify NODEUI-01 — Snippet ID field gone:**
       - Select a Text-block node (create one if needed via Create-Text-block — if no such quick-create exists, drag any node and set Node type → "Text block").
       - Confirm the form shows: Content (textarea) → Text separator (dropdown). There should be NO "Snippet ID (optional)" input anywhere.
       - Open an older canvas that still has `radiprotocol_snippetId` on a text-block node (if one exists in the test vault). Confirm the node still loads, no console error, runner still works for that node.
    7. **Verify NODEUI-03 — Answer form field order:**
       - Select an Answer node.
       - Confirm the fields in order: Display label (optional) → Answer text → Text separator.
    8. **Verify NODEUI-04 — Question textarea auto-grow + layout:**
       - Select a Question node.
       - Confirm the label "Question text" and helper text "Displayed to the user during the protocol session." both appear ABOVE the textarea (stacked, not beside).
       - Confirm the textarea is full-width (spans the panel).
       - Type ~10 lines of content. The textarea should grow smoothly with each newline; no inner scrollbar should appear until the content is unreasonably long.
       - Click away, reopen the node — content persisted (auto-save still works).
    9. **Verify NODEUI-02 — vertical quick-create placement:**
       - Select any node on the canvas.
       - Click "Create question node" in the toolbar.
       - Confirm the new Question node appears DIRECTLY BELOW the selected node (not to its right).
       - Click "Create answer node" with the new Question node selected. Confirm the Answer appears below the Question.
       - Chain a Snippet and Loop the same way. Confirm all four new nodes form a vertical tree below the original anchor.
    10. **Regression sanity:**
        - Open a previously-working protocol; run it via `/gsd-run`-equivalent in Obsidian (Ribbon → Run protocol on this canvas).
        - Step through a few choices; confirm textarea edits, scroll behaviour, button rendering from Phase 47 all still work (Phase 47 didn't regress).

    If ANY of 5–10 fails, describe the failure and revert + re-plan (do NOT approve).
  </how-to-verify>
  <resume-signal>Type "approved" if all 10 verifications pass, or describe what broke.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CSS concat build-time → Obsidian runtime | `src/styles/*.css` compiled by esbuild into root `styles.css`; loaded at plugin enable. No user input crosses this boundary; compile-time only. |
| DOM order in renderIdle / renderForm → Obsidian panel rendering | Moving `renderToolbar` call position alters DOM tree order but not event wiring; `renderToolbar` itself is unchanged. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-05 | Tampering | `src/styles/editor-panel.css` earlier-phase blocks could be accidentally rewritten during append | mitigate | Acceptance criteria includes a `git diff src/styles/editor-panel.css` check that the diff is ADDITIONS ONLY at EOF. No deletions or edits to existing bytes. |
| T-48-06 | Denial of Service | Moving `renderToolbar` to the end of `renderForm` could expose a re-entry bug if `buildKindForm` triggers a re-render before the toolbar call | accept | `renderForm` is synchronous; `buildKindForm` synchronously creates DOM nodes and does NOT re-invoke `renderForm` (Node-type dropdown's re-render is deferred via `queueMicrotask` per line 363 — outside the current call stack). DOM-order test (Task 1) asserts the invariant. |
| T-48-07 | Information Disclosure | Regenerated `styles.css` might commit user-local-only rules if build picks up stray files | accept | `esbuild.config.mjs` explicitly lists the 6 CSS files; no glob. Regeneration is deterministic. |
</threat_model>

<verification>
After every task:
- `npm test -- src/__tests__/editor-panel-forms.test.ts` — quick targeted run.
- After Task 2: `npm run build` exits 0; `styles.css` root + `src/styles.css` both contain `Phase 48 NODEUI-05`.
- After Task 2: `npm test` full suite, green count ≥ post-Plan-01 count.
- After Task 2: `git diff -- src/styles/editor-panel.css` MUST show ONLY appended lines at EOF (no edits to existing blocks).

Phase 48 gate (after Task 3 human approval):
- All five NODEUI-* requirements verified live in TEST-BASE vault.
- Full suite green.
- `.planning/phases/48-node-editor-ux-polish/48-01-SUMMARY.md` and `.planning/phases/48-node-editor-ux-polish/48-02-SUMMARY.md` both written.
</verification>

<success_criteria>
- NODEUI-05: `.rp-editor-create-toolbar` lays out as a full-width vertical column at the BOTTOM of the Node Editor panel in both idle and form modes — verified by DOM-order unit tests + CSS-file-parse test + human UAT.
- All four Phase 48 criteria from Plan 01 remain green (no regression).
- `src/styles/editor-panel.css` preserves every earlier phase block byte-for-byte; Phase 48 blocks appended at EOF with `/* Phase 48 NODEUI-04 */` and `/* Phase 48 NODEUI-05 */` markers.
- Bundle regenerated via `npm run build`; `styles.css` + `src/styles.css` contain Phase 48 marker.
- Full `npm test` green; Plan 01 scope-fence files still byte-identical.
- Human UAT approves the five visual criteria in TEST-BASE vault.
</success_criteria>

<output>
After completion, create `.planning/phases/48-node-editor-ux-polish/48-02-SUMMARY.md` following the GSD summary template. Include:
- Two atomic commits with hashes (`test(48-02)`, `feat(48-02)`).
- Changed-file list (the five files in `files_modified`, with note that `styles.css` + `src/styles.css` are generated).
- Test count delta.
- Explicit confirmation via `git diff src/styles/editor-panel.css` that only EOF additions were made — no earlier phase block touched.
- Explicit confirmation that all DO-NOT-TOUCH files from Plan 01 are still byte-identical.
- UAT result summary (10-step checklist from the checkpoint task).
- Phase 48 closure note — all five NODEUI-* requirements shipped.
</output>
