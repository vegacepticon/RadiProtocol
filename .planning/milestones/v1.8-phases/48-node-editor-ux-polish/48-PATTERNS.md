# Phase 48: Node Editor UX Polish — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 5 change sites (2 source + 1 CSS + 2 test)
**Analogs found:** 5 / 5 (all in-repo, high match quality)

Source of truth: `.planning/phases/48-node-editor-ux-polish/48-RESEARCH.md`. No CONTEXT.md for this phase; requirements come from ROADMAP.md success criteria + REQUIREMENTS.md + five pending TODO files. Phase 48 is pure composition of existing idioms — no new abstractions, no new dependencies.

---

## File Classification

| Change Site | Role | Data Flow | Closest Analog | Match Quality |
|-------------|------|-----------|----------------|---------------|
| `src/views/editor-panel-view.ts` (form edits) | Obsidian `ItemView` — form renderer | event-driven (pendingEdits → debounced autosave) | self (Phase 42/44/45 edits to same file) | exact |
| `src/canvas/canvas-node-factory.ts` (offset flip) | service — canvas mutator | request-response (sync call returns `CreateNodeResult`) | self (no better analog) | exact |
| `src/styles/editor-panel.css` (NODEUI-04/05 CSS) | per-feature CSS file | build-time (esbuild concat) | same file — Phase 42 Plan 04 responsive toolbar block (lines 164-168), Phase 45 loop button block (lines 170-198) | exact |
| `src/__tests__/canvas-node-factory.test.ts` (Test 5 flip) | vitest unit test — assertion flip | — | self (same test file) | exact |
| `src/__tests__/editor-panel.test.ts` OR new `editor-panel-forms.test.ts` | vitest unit test — new NODEUI-01/03/04/05 assertions | — | `src/__tests__/editor-panel-loop-form.test.ts` (Setting-prototype mock) + `src/__tests__/editor-panel-create.test.ts` (fakeNode recursive stub) | role-match (two analogs composed) |

**Scope fence (from RESEARCH.md Pitfalls 1-3, 6):** the following files MUST remain untouched — the plan should call them out as DO NOT TOUCH:
- `src/graph/canvas-parser.ts:216-229` (legacy `radiprotocol_snippetId` read path)
- `src/runner/protocol-runner.ts:544-551` (legacy runner branch)
- `src/graph/graph-model.ts` (`TextBlockNode.snippetId?` field)
- `src/__tests__/fixtures/snippet-block.canvas` + `protocol-runner.test.ts:187-195`
- `src/views/editor-panel-view.ts:81-116` (`attachCanvasListener` + `canvasPointerdownHandler` + `handleNodeClick` — Phase 42 double-click regression fix)
- `src/views/editor-panel-view.ts:308-316` (Phase 42 in-memory fallback inside `renderNodeForm`)

---

## Pattern Assignments

### 1. `src/views/editor-panel-view.ts` — Text-block form, Answer form, Question form, Toolbar call sites

**Analog:** itself — existing `buildKindForm` switch at lines 396-504; existing `renderIdle` (142-150) and `renderForm` (327-331) toolbar call sites.

#### NODEUI-01 change site — delete block (editor-panel-view.ts:477-486)

Exact block to remove (the ONLY deletion authorised by the phase; everything around it stays):

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

Pre/post invariants: `case 'text-block':` must still open with the `setHeading().setName('Text-block node')` on line 465, keep the Content `addTextArea` (lines 466-476), and keep the Separator dropdown (lines 487-502). The `onChange` handler for the Content textarea still writes `pendingEdits['radiprotocol_content']` + `pendingEdits['text']` — do not touch.

#### NODEUI-03 pattern — re-order two `Setting` blocks in `case 'answer':` (editor-panel-view.ts:424-444)

Current order (Answer text first, Display label second). Desired order: Display label first, Answer text second. Separator dropdown stays third (lines 445-460). The move is literal: cut lines 435-444 and paste them above line 424; body of each block unchanged. Obsidian's `Setting` API renders label+desc adjacent to its own control, so re-ordering the JS blocks is sufficient — no CSS needed.

Source excerpt (the two blocks to swap):

```typescript
// BLOCK A — currently lines 424-434 (must become SECOND)
new Setting(container)
  .setName('Answer text')
  .setDesc('Appended to the accumulated report text when this answer is chosen.')
  .addTextArea(ta => {
    ta.setValue((nodeRecord['radiprotocol_answerText'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
      .onChange(v => {
        this.pendingEdits['radiprotocol_answerText'] = v;
        this.pendingEdits['text'] = v;
        this.scheduleAutoSave();
      });
  });

// BLOCK B — currently lines 435-444 (must become FIRST)
new Setting(container)
  .setName('Display label (optional)')
  .setDesc('Short label shown in the runner button if set. Leave blank to use answer text.')
  .addText(t => {
    t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
      .onChange(v => {
        this.pendingEdits['radiprotocol_displayLabel'] = v || undefined;
        this.scheduleAutoSave();
      });
  });
```

#### NODEUI-04 pattern — custom DOM block replacing `Setting.addTextArea` for Question (editor-panel-view.ts:408-418)

**Analog for auto-grow:** `src/views/runner-view.ts:816-840` (`renderPreviewZone`, Phase 12 LAYOUT-01, re-verified Phase 47). Copy this pattern verbatim minus the Phase 47 RUNFIX-02 scroll-to-bottom flag (not needed for an editor textarea).

Canonical auto-grow excerpt from `runner-view.ts:816-840`:

```typescript
private renderPreviewZone(zone: HTMLElement, text: string): void {
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  // Force width inline so theme/app CSS cannot override it
  textarea.style.width = '100%';
  // Defer height calculation until the element has layout
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    // ... Phase 47 RUNFIX-02 scroll-preservation block (NOT needed for editor) ...
  });
  this.registerDomEvent(textarea, 'input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
  // ...
}
```

**Analog for label-above custom DOM:** `editor-panel-view.ts:145-149` (createDiv + createEl for the idle panel) and the Phase 42 type-hint pattern referenced at lines 370-374 in RESEARCH.md. Use `container.createDiv({ cls: 'rp-question-block' })` → `.createDiv({ cls: 'rp-field-label', text: 'Question text' })` → `.createEl('p', { cls: 'rp-field-desc', text: '...' })` → `.createEl('textarea', { cls: 'rp-question-textarea' })`.

**Proposed composite (from RESEARCH.md Pattern 2, authoritative):**

```typescript
const qBlock = container.createDiv({ cls: 'rp-question-block' });
qBlock.createDiv({ cls: 'rp-field-label', text: 'Question text' });
qBlock.createEl('p', {
  cls: 'rp-field-desc',
  text: 'Displayed to the user during the protocol session.',
});
const ta = qBlock.createEl('textarea', { cls: 'rp-question-textarea' });
ta.value = (nodeRecord['radiprotocol_questionText'] as string | undefined)
  ?? (nodeRecord['text'] as string | undefined) ?? '';
requestAnimationFrame(() => {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
});
this.registerDomEvent(ta, 'input', () => {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
  this.pendingEdits['radiprotocol_questionText'] = ta.value;
  this.pendingEdits['text'] = ta.value;
  this.scheduleAutoSave();
});
```

Invariants to preserve: the Question node's `setHeading().setName('Question node')` (line 407) remains a `new Setting(container)` call. Only the `new Setting(container).setName('Question text')...addTextArea(...)` row (lines 408-418) is replaced by the custom block above. `pendingEdits['radiprotocol_questionText']` and `pendingEdits['text']` are both still written on input — identical to the existing `onChange` semantics.

`registerDomEvent` usage precedent — lifecycle-managed (view tears down all registered handlers on `onunload`). Already used in editor-panel-view.ts at lines 102, 111, 808, 814, 823, 832, 840 (every toolbar button). Use it for the textarea's `input` listener — NOT a direct `addEventListener`.

#### NODEUI-05 pattern — toolbar DOM re-order (editor-panel-view.ts:144, 329)

Two call sites are semantically identical — both must change together (Pitfall 6):

```typescript
// editor-panel-view.ts:142-150 (renderIdle)
private renderIdle(): void {
  this.contentEl.empty();
  this.renderToolbar(this.contentEl);  // <-- Phase 39 — MOVE to bottom
  const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
  container.createEl('p', { text: 'No node selected' });
  container.createEl('p', { text: "Right-click a canvas node..." });
}

// editor-panel-view.ts:327-332 (renderForm)
private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
  this.contentEl.empty();
  this.renderToolbar(this.contentEl);  // <-- Phase 39 — MOVE to bottom
  const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
  const formArea = panel.createDiv({ cls: 'rp-editor-form' });
  // ... form body ...
}
```

Target: move each `this.renderToolbar(this.contentEl)` call AFTER its respective form body (renderIdle → after the two `container.createEl('p', ...)` calls; renderForm → after the kind-specific `buildKindForm(formArea, ...)` call). Combined with `margin-top: auto` on `.rp-editor-create-toolbar` in CSS (see below), the toolbar sticks to the panel bottom.

`renderToolbar` itself (line 801, signature `private renderToolbar(container: HTMLElement): void`) is not modified. Button creation order inside it — Question, Answer, Snippet, Loop, Duplicate — stays.

---

### 2. `src/canvas/canvas-node-factory.ts` — offset flip (line 52)

**Analog:** itself. One-line change, no surrounding context should move.

```typescript
// BEFORE (line 52)
pos = { x: anchor.x + anchor.width + NODE_GAP, y: anchor.y };

// AFTER (Phase 48 NODEUI-02)
pos = { x: anchor.x, y: anchor.y + anchor.height + NODE_GAP };
```

Surrounding invariants: `NODE_GAP = 40` (line 16) stays. `anchor.height` is already exposed by `CanvasNodeInternal` — no type change required (the test fixture at `canvas-node-factory.test.ts:147` already passes `height: 80`). The `if (anchor)` guard and the `console.warn` fallback (line 54) stay untouched. `DEFAULT_NODE_WIDTH`/`DEFAULT_NODE_HEIGHT` constants are unrelated and stay.

---

### 3. `src/styles/editor-panel.css` — Phase 48 append-only block

**Analog for marker format:** the file's own history. Existing phase markers (exact strings from the file):

| File line | Marker text |
|-----------|-------------|
| `editor-panel.css:1` | `/* Phase 4: EditorPanelView ─────────────────────────────────────────────── */` |
| `editor-panel.css:47` | `/* Phase 39: Quick-Create toolbar */` |
| `editor-panel.css:92` | `/* Phase 40: Duplicate node button */` |
| `editor-panel.css:122` | `/* Phase 42: Empty-type helper hint */` |
| `editor-panel.css:132` | `/* Phase 42: Create snippet node button */` |
| `editor-panel.css:164` | `/* Phase 42 Plan 04: responsive toolbar — wrap buttons onto a new row at narrow sidebar widths */` |
| `editor-panel.css:170` | `/* Phase 45: loop quick-create button */` |

**Marker convention for Phase 48:** append at EOF (after line 198), follow same `/* Phase 48: short description */` form. Two blocks expected:

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

**Critical cascade note (RESEARCH.md Pitfall 5 + Anti-Pattern 1):** the Phase 39 rule at lines 48-57 (`flex-direction: row`) AND the Phase 42 Plan 04 rule at lines 164-168 (`flex-wrap: wrap`) both STAY in the file. The Phase 48 override above wins by cascade position (last identical-specificity rule wins). Do NOT delete or rewrite earlier Phase blocks — this is the CLAUDE.md append-only rule.

**Post-edit build step:** `npm run build` to regenerate `styles.css` (and the convenience copy `src/styles.css`). Never hand-edit the generated file.

---

### 4. `src/__tests__/canvas-node-factory.test.ts` — Test 5 assertion flip (lines 155-160)

**Analog:** itself. Existing assertion:

```typescript
// BEFORE — canvas-node-factory.test.ts:156-160
expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
  expect.objectContaining({
    pos: { x: 100 + 300 + 40, y: 200 }, // anchor.x + anchor.width + NODE_GAP
  })
);

// AFTER (Phase 48 NODEUI-02)
expect(leaf.view.canvas.createTextNode).toHaveBeenCalledWith(
  expect.objectContaining({
    pos: { x: 100, y: 200 + 80 + 40 }, // anchor.x, anchor.y + anchor.height + NODE_GAP
  })
);
```

Fixture at line 147 (`x: 100, y: 200, width: 300, height: 80`) stays unchanged. Tests 1-4 (error paths) and Tests 6+ (other scenarios) stay untouched.

---

### 5. New NODEUI-01/03/04/05 assertions — `editor-panel.test.ts` or new `editor-panel-forms.test.ts`

Planner's decision: RESEARCH.md Wave 0 Gaps list five assertions. Recommendation: put them in a NEW file `src/__tests__/editor-panel-forms.test.ts` so `editor-panel.test.ts` remains the lightweight view-metadata sanity file and `editor-panel-create.test.ts` remains the quick-create harness. A new file isolates the form-specific Setting-prototype mock without polluting either existing file.

**Analog 1 — Setting-prototype mock for NODEUI-01/03 (captures `setName` call order):** `src/__tests__/editor-panel-loop-form.test.ts:44-103`. Copy this harness verbatim, including the `settingCalls` capture record and `installSettingPrototypeMock()` installer:

```typescript
// editor-panel-loop-form.test.ts:44-103 (EXCERPT — copy verbatim into new test file)
const settingCalls: {
  setName: string[];
  setDesc: string[];
  setHeading: number;
} = { setName: [], setDesc: [], setHeading: 0 };
const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const dropdownOptions: Array<[string, string]> = [];

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = 0;
  textareaOnChange.cb = null;
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

  SettingProto.addText = vi.fn(function (this: unknown) { return this; });
}
```

Usage per test:
- **NODEUI-01 negative:** after invoking `buildKindForm(fakeNode, 'text-block', nodeRecord)`, assert `expect(settingCalls.setName).not.toContain('Snippet ID (optional)')`.
- **NODEUI-03 order:** after invoking `buildKindForm(fakeNode, 'answer', nodeRecord)`, assert `settingCalls.setName.indexOf('Display label (optional)') < settingCalls.setName.indexOf('Answer text')`.

**Analog 2 — `fakeNode()` recursive stub for NODEUI-04/05 (captures `createEl` / `createDiv` calls):** `src/__tests__/editor-panel-create.test.ts:412-429`. Copy this pattern into the new test file; extend it to record textarea `style.height` writes + to surface a readable `scrollHeight`:

```typescript
// editor-panel-create.test.ts:412-429 (EXCERPT — copy and extend)
const createdElements: Array<{ tag: string; cls?: string; text?: string }> = [];

const fakeNode = (): Record<string, unknown> => {
  const self: Record<string, unknown> = {
    empty: () => {},
    createDiv: (_opts?: { cls?: string }) => fakeNode(),
    createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
      createdElements.push({ tag, cls: opts?.cls, text: opts?.text });
      return fakeNode();
    },
    createSpan: () => fakeNode(),
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

**Extension for NODEUI-04 auto-grow test:** the `createEl('textarea', ...)` return value must carry a settable `style` object + readable `scrollHeight`. Minimal delta:

```typescript
// Extended fakeNode for NODEUI-04 test — the textarea child records height writes
createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
  createdElements.push({ tag, cls: opts?.cls, text: opts?.text });
  const child = fakeNode();
  if (tag === 'textarea') {
    (child as Record<string, unknown>).style = { width: '', height: '' };
    (child as Record<string, unknown>).scrollHeight = 123;
    (child as Record<string, unknown>).value = '';
    (child as Record<string, unknown>).addEventListener = () => {};
  }
  return child;
},
```

`registerDomEvent` inside the view reaches into `this.registerDomEvent` (an ItemView method stubbed via `vi.mock('obsidian')`). The existing mock in `src/__mocks__/obsidian.ts` should already provide a no-op; if the new test needs to fire a synthetic `input` event, spy on `view.registerDomEvent` and capture the callback — same strategy used by `editor-panel-create.test.ts` for click handlers.

**Usage per test:**
- **NODEUI-04 DOM:** after rendering `'question'` form, assert `createdElements.find(e => e.tag === 'textarea' && e.cls === 'rp-question-textarea')` is defined AND that a sibling with `cls === 'rp-field-label'` and one with `cls === 'rp-field-desc'` exist.
- **NODEUI-04 auto-grow:** capture the `input` callback registered on the textarea; invoke it; assert `textarea.style.height` was set to `'auto'` then to `'123px'` (the stubbed `scrollHeight`).
- **NODEUI-05 DOM order:** render `renderForm` with a stubbed `contentEl = fakeNode()`; assert the last child-creation call in `createdElements` order corresponds to the toolbar container (class `rp-editor-create-toolbar` via `renderToolbar`'s internals, or spy on `renderToolbar` itself and assert it is called AFTER `buildKindForm`).

**Test-file boilerplate (copy top-of-file imports from editor-panel-loop-form.test.ts:14-20):**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting, type WorkspaceLeaf } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';
import type RadiProtocolPlugin from '../main';

vi.mock('obsidian');
```

---

## Shared Patterns

### Shared 1 — `registerDomEvent` for lifecycle-safe listeners
**Source:** `src/views/editor-panel-view.ts:102, 111, 808, 814, 823, 832, 840` (existing toolbar + canvas listeners); `src/views/runner-view.ts:837`.
**Apply to:** NODEUI-04 textarea `input` listener. NEVER use `element.addEventListener(...)` directly in a view class — it leaks on reload.

```typescript
this.registerDomEvent(textarea, 'input', () => { /* ... */ });
```

### Shared 2 — `pendingEdits` + `scheduleAutoSave()` for form-driven persistence
**Source:** `editor-panel-view.ts:414-416` (Question), `:430-432` (Answer), `:472-474` (Text-block), `:440-442` (Display label). Every input writes to `this.pendingEdits[key]` then calls `this.scheduleAutoSave()`.
**Apply to:** NODEUI-04 — the new custom-DOM textarea must preserve identical semantics: write both `radiprotocol_questionText` AND `text` keys, then `scheduleAutoSave()`. Do NOT bypass the debounce (Standing Pitfall #D-02 flush behaviour depends on it).

```typescript
this.pendingEdits['radiprotocol_questionText'] = ta.value;
this.pendingEdits['text'] = ta.value;
this.scheduleAutoSave();
```

### Shared 3 — CSS append-only with phase marker
**Source:** `editor-panel.css` — every phase block opens with `/* Phase N: description */`. Seven such markers currently in the file (lines 1, 47, 92, 122, 132, 164, 170).
**Apply to:** Phase 48 CSS MUST append at EOF (after line 198) with `/* Phase 48 NODEUI-04: ... */` and `/* Phase 48 NODEUI-05: ... */` markers. Per CLAUDE.md: "Never rewrite existing sections."

### Shared 4 — esbuild CSS regeneration after any `src/styles/*.css` edit
**Source:** CLAUDE.md (build process section) + RESEARCH.md line 457.
**Apply to:** after every Phase 48 CSS edit, run `npm run build`. The regenerated root `styles.css` and `src/styles.css` are build artifacts — never commit direct edits to them.

### Shared 5 — vitest `vi.mock('obsidian')` harness
**Source:** `src/__tests__/editor-panel.test.ts:8`, `editor-panel-loop-form.test.ts:19`, `editor-panel-create.test.ts` (top).
**Apply to:** any new test file — `vi.mock('obsidian');` at top, then import `Setting`, `WorkspaceLeaf` types from `'obsidian'`. The mock is provided by `src/__mocks__/obsidian.ts`.

---

## No Analog Found

None — every Phase 48 change site has an in-repo analog. This is consistent with RESEARCH.md Metadata: "Every NODEUI-* requirement has a pattern already present in the codebase. Phase 48 is pure composition of existing idioms — no new abstractions, no new dependencies."

---

## Metadata

**Analog search scope:** `src/views/`, `src/canvas/`, `src/styles/`, `src/__tests__/`, `src/__mocks__/`.
**Files scanned:** 8 (runner-view.ts, editor-panel-view.ts, canvas-node-factory.ts, editor-panel.css, editor-panel.test.ts, editor-panel-loop-form.test.ts, editor-panel-create.test.ts, canvas-node-factory.test.ts).
**Pattern extraction date:** 2026-04-19.

---

## PATTERN MAPPING COMPLETE

**Phase:** 48 — Node Editor UX Polish
**Files classified:** 5 change sites
**Analogs found:** 5 / 5 (all exact match; all in-repo)

### Coverage
- Files with exact analog: 5
- Files with role-match analog: 0 (the new test file uses two composed analogs — still counts as exact match for each capability)
- Files with no analog: 0

### Key Patterns Identified
- Auto-grow textarea via `requestAnimationFrame` + `input` → `scrollHeight` (runner-view.ts:816-840) — copy verbatim for NODEUI-04.
- Label-above custom DOM = `createDiv(label)` + `createEl('p', desc)` + `createEl('textarea')` — side-steps Obsidian `Setting` layout; precedent in editor-panel-view.ts idle panel.
- Bottom-anchor toolbar via DOM re-order + `margin-top: auto` on existing `flex-direction: column` parent (`.rp-editor-panel`).
- Setting-prototype mock (editor-panel-loop-form.test.ts:44-103) captures `setName`/`setDesc` call order — ideal for NODEUI-01 negative and NODEUI-03 order assertions.
- Recursive `fakeNode()` stub (editor-panel-create.test.ts:412-429) captures `createEl`/`createDiv` — extend with `style` + `scrollHeight` on textarea for NODEUI-04 auto-grow test.
- CSS append-only: every existing block opens with `/* Phase N: ... */`; Phase 48 follows suit at EOF with two blocks (NODEUI-04, NODEUI-05). Earlier `.rp-editor-create-toolbar { flex-direction: row; flex-wrap: wrap }` rules stay in the file; Phase 48's override wins by cascade order.
- `registerDomEvent` + `pendingEdits` + `scheduleAutoSave()` — the canonical editor-panel write path; every new input surface must preserve it.

### File Created
`Z:\projects\RadiProtocolObsidian\.planning\phases\48-node-editor-ux-polish\48-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files. Recommended plan split (from RESEARCH.md): Plan 01 — TypeScript (NODEUI-01, 02, 03, 04 + test updates); Plan 02 — CSS + toolbar DOM re-order (NODEUI-05).
