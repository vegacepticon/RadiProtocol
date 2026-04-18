---
phase: 45
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/editor-panel-view.ts
  - src/styles/editor-panel.css
  - src/__tests__/editor-panel-loop-form.test.ts
autonomous: true
requirements: [LOOP-05, LOOP-06]
tags: [phase-45, editor-panel, loop-05, quick-create, css, lock-in-tests]

must_haves:
  truths:
    - "Node Editor toolbar includes a 'Create loop node' button positioned AFTER snippet button and BEFORE duplicate button"
    - "Clicking 'Create loop node' calls canvasNodeFactory.createNode(path, 'loop', anchorId?) without throwing"
    - "onQuickCreate kind union accepts 'loop' alongside 'question' | 'answer' | 'snippet'"
    - "Selecting a loop node in Node Editor renders heading 'Loop node' + exactly one 'Header text' Setting (Phase 44 UAT-fix form unchanged)"
    - "Loop form NEVER renders a Setting whose name/description matches /iterations/i (negative regression test guards Phase 44 RUN-07 excision)"
    - "Header-text textarea onChange writes the same value to both pendingEdits['radiprotocol_headerText'] and pendingEdits['text']"
    - "saveNodeEdits for kind='loop' injects color='1' (NODE_COLOR_MAP['loop']) into the write path (Phase 28 D-01 pipeline, integration lock-in)"
    - "CSS file src/styles/editor-panel.css ends with Phase 45 marker and .rp-create-loop-btn rule set; generated styles.css refreshed by npm run build"
  artifacts:
    - path: "src/views/editor-panel-view.ts"
      provides: "Loop quick-create button in renderToolbar + widened onQuickCreate union"
      contains: "rp-create-loop-btn, 'loop', Phase 45"
    - path: "src/styles/editor-panel.css"
      provides: "Per-feature CSS rule for .rp-create-loop-btn (hover/active/disabled states parallel to Phase 42 snippet btn)"
      contains: ".rp-create-loop-btn, Phase 45: loop quick-create button"
    - path: "src/__tests__/editor-panel-loop-form.test.ts"
      provides: "Lock-in unit tests for Phase 44 UAT-fix loop form + Phase 45 quick-create button"
      contains: "Loop node, Header text, onQuickCreate, 'loop'"
  key_links:
    - from: "src/views/editor-panel-view.ts"
      to: "src/canvas/canvas-node-factory.ts"
      via: "onQuickCreate → this.plugin.canvasNodeFactory.createNode(canvasPath, 'loop', anchorId)"
      pattern: "canvasNodeFactory\\.createNode\\("
    - from: "src/views/editor-panel-view.ts"
      to: "src/canvas/node-color-map.ts"
      via: "saveNodeEdits reads NODE_COLOR_MAP[editedType] to inject color (Phase 28 D-01)"
      pattern: "NODE_COLOR_MAP"
    - from: "src/__tests__/editor-panel-loop-form.test.ts"
      to: "src/views/editor-panel-view.ts"
      via: "exercise renderForm(nodeRecord, 'loop') + onQuickCreate('loop') behaviour"
      pattern: "EditorPanelView"
---

<objective>
Добавить 4-ю quick-create кнопку «Create loop node» в тулбар Node Editor, расширить `onQuickCreate` kind-union до включения `'loop'`, закрепить существующую (Phase 44 UAT-fix) loop-форму lock-in тестами, и заасертить integration покраску (`color:'1'`) через существующий Phase 28 D-01 pipeline.

Purpose: LOOP-05 — authoring UX для loop-узла (создание + редактирование + автоцвет). Вся графовая/runtime работа уже сделана в Phase 43/44; этот план «сшивает» editor-panel слой чтобы автор мог кликом создать loop-узел с правильным цветом и отредактировать его headerText. Плюс LOOP-06 integration (color-map часть — end-to-end подтверждение через `saveNodeEdits`).

Output:
- `editor-panel-view.ts`: onQuickCreate union расширен до 4 kinds; renderToolbar получает 5-й блок `.rp-create-loop-btn` (позиция между snippet и duplicate).
- `src/styles/editor-panel.css`: append-only блок с `/* Phase 45: loop quick-create button */` marker и `.rp-create-loop-btn{...}` CSS parallel к snippet button.
- Regenerated `styles.css` через `npm run build`.
- `src/__tests__/editor-panel-loop-form.test.ts`: 7 lock-in тестов (dropdown, heading, Header text Setting, negative iterations, onChange sync, saveNodeEdits color injection, onQuickCreate factory call).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md
@.planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md
@src/views/editor-panel-view.ts
@src/styles/editor-panel.css
@src/canvas/canvas-node-factory.ts
@src/canvas/node-color-map.ts
@src/__tests__/editor-panel-create.test.ts

<interfaces>
<!-- Current state (BEFORE Phase 45 edits) — extracted verbatim from source files -->

Phase 44 UAT-fix loop form at editor-panel-view.ts:568-586 — REFERENCE ONLY (landmine, do NOT edit):
```typescript
case 'loop': {
  // Phase 44 UAT-fix: unified loop node form (RUN-01 header text + picker).
  new Setting(container).setHeading().setName('Loop node');
  new Setting(container)
    .setName('Header text')
    .setDesc('Displayed above the branch picker when the runner halts at this loop, and also shown as the canvas node label. Leave blank for no header.')
    .addTextArea(ta => {
      ta.setValue((nodeRecord['radiprotocol_headerText'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
        .onChange(v => {
          this.pendingEdits['radiprotocol_headerText'] = v;
          this.pendingEdits['text'] = v;
          this.scheduleAutoSave();
        });
    });
  break;
}
```

Current onQuickCreate signature (editor-panel-view.ts:745):
```typescript
private async onQuickCreate(kind: 'question' | 'answer' | 'snippet'): Promise<void> {
```

Current renderToolbar snippet button template (editor-panel-view.ts:867-874 — Phase 42):
```typescript
const sBtn = toolbar.createEl('button', { cls: 'rp-create-snippet-btn' });
sBtn.setAttribute('aria-label', 'Create snippet node');
sBtn.setAttribute('title', 'Create snippet node');
const sIcon = sBtn.createSpan();
setIcon(sIcon, 'file-text');
sBtn.appendText('Create snippet node');
this.registerDomEvent(sBtn, 'click', () => { void this.onQuickCreate('snippet'); });
```

Current duplicate button (editor-panel-view.ts:876-882 — Phase 40):
```typescript
// Phase 40: Duplicate node button
const dupBtn = toolbar.createEl('button', { cls: 'rp-duplicate-btn' });
const dupIcon = dupBtn.createSpan();
setIcon(dupIcon, 'copy');
dupBtn.appendText('Duplicate node');
if (!this.currentNodeId) dupBtn.disabled = true;
this.registerDomEvent(dupBtn, 'click', () => { void this.onDuplicate(); });
```

CanvasNodeFactory.createNode (canvas-node-factory.ts:38-77) — kind-agnostic, accepts any RPNodeKind and auto-applies NODE_COLOR_MAP[nodeKind]. Для kind='loop' возвращает узел с `radiprotocol_nodeType:'loop'` + `color:'1'` без code changes (D-05, D-CL-03 zero-delta).

NODE_COLOR_MAP['loop'] === '1' (node-color-map.ts:21, Phase 43 D-12). "1" = Red в Obsidian canvas palette.

Phase 42 snippet CSS template (editor-panel.css:132-162):
```css
/* Phase 42: Create snippet node button */
.rp-create-snippet-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2-1);
  padding: 6px 12px;
  border-radius: var(--radius-s);
  font-size: var(--font-ui-small);
  font-weight: var(--font-semibold);
  cursor: pointer;
  border: none;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  transition: filter 0.1s ease;
}
.rp-create-snippet-btn:hover { filter: brightness(1.1); }
.rp-create-snippet-btn:active { filter: brightness(0.95); }
.rp-create-snippet-btn:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
```

Setting.prototype chainable mock pattern (editor-panel-create.test.ts:353-367):
```typescript
const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
SettingProto.setName = vi.fn(function (this: unknown) { return this; });
SettingProto.setDesc = vi.fn(function (this: unknown) { return this; });
SettingProto.setHeading = vi.fn(function (this: unknown) { return this; });
// ... addTextArea, addDropdown similar
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lock-in tests for Phase 44 UAT-fix loop form + quick-create button</name>
  <files>src/__tests__/editor-panel-loop-form.test.ts</files>
  <read_first>
    - src/views/editor-panel-view.ts:327-586 (renderForm + buildKindForm — НЕ редактировать, только читать для понимания поведения)
    - src/views/editor-panel-view.ts:568-586 (Phase 44 UAT-fix loop form — LANDMINE: reference only)
    - src/views/editor-panel-view.ts:745-784 (onQuickCreate — текущее тело)
    - src/views/editor-panel-view.ts:164-273 (saveNodeEdits — Phase 28 D-01 color injection pipeline)
    - src/__tests__/editor-panel-create.test.ts (существующий sibling test file — COMPLETE чтение для mock patterns)
    - src/__mocks__/obsidian.ts (проверить что Setting/TFile/Notice экспортированы; setIcon/registerDomEvent отсутствуют)
    - src/canvas/node-color-map.ts (NODE_COLOR_MAP['loop'] === '1')
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-01, D-02, D-03, D-17
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md Pitfalls 2, 3, 4, 5
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"8) src/__tests__/editor-panel-loop-form.test.ts"
  </read_first>
  <behavior>
    - Test 1 (D-01/D-02 dropdown): renderForm(nodeRecord, null) добавляет `addOption('loop', 'Loop')` в node-type dropdown.
    - Test 2 (D-02 heading + Header text): renderForm(nodeRecord, 'loop') создаёт ровно одно `Setting.setHeading().setName('Loop node')` и ровно одно `Setting.setName('Header text')` с `addTextArea` callback.
    - Test 3 (D-02 negative iterations): renderForm(nodeRecord, 'loop') НИ В ОДНОМ Setting не ставит name/desc/heading содержащий подстроку "iterations" (case-insensitive). Регрессионный guard для RUN-07 excision из Phase 44.
    - Test 4 (D-02 onChange sync): textarea onChange('new header value') устанавливает ровно pendingEdits['radiprotocol_headerText'] === 'new header value' AND pendingEdits['text'] === 'new header value' (двойная запись в тот же value).
    - Test 5 (D-02/D-17 color injection): saveNodeEdits('test.canvas', 'node-id', { radiprotocol_nodeType: 'loop' }) передаёт в `canvasLiveEditor.saveLive` enrichedEdits содержащий `color: '1'` (NODE_COLOR_MAP['loop']). Assert через spy на saveLive.
    - Test 6 (D-04 onQuickCreate): при вызове `onQuickCreate('loop')` — canvasNodeFactory.createNode вызван с args (canvasPath, 'loop', currentNodeId?) ровно 1 раз. TypeScript-контроль делают compile-time; runtime assertion через mock spy.
    - Test 7 (D-04 flush debounce): если pendingEdits non-empty и _debounceTimer set, onQuickCreate('loop') вызывает saveNodeEdits flush перед createNode (same pattern как 'snippet' кнопка).
  </behavior>
  <action>
## Реализация

Создать новый файл `src/__tests__/editor-panel-loop-form.test.ts`. Структурно паттерн копируется из `src/__tests__/editor-panel-create.test.ts`, но scope изолирован на `'loop'` kind поведение.

### Почему этот тест создаётся ДО edits в editor-panel-view.ts

- **Test 1-5 уже должны проходить** сегодня (Phase 44 UAT-fix form + Phase 28 color injection уже в коде). Они — **lock-in** тесты (zero-code-change asserts).
- **Test 6-7 WILL FAIL** до Task 2 (union extension). Это ожидаемо; TDD RED перед GREEN в Task 2.

### Skeleton файла

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Notice, Setting, TFile, type WorkspaceLeaf } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';
import type RadiProtocolPlugin from '../main';

vi.mock('obsidian');

// ── Mock infrastructure ──────────────────────────────────────────────────
type MockPlugin = Partial<RadiProtocolPlugin> & {
  app: Record<string, unknown>;
  settings: Record<string, unknown>;
  canvasNodeFactory: { createNode: ReturnType<typeof vi.fn> };
  canvasLiveEditor: { saveLive: ReturnType<typeof vi.fn>; getCanvasJSON?: ReturnType<typeof vi.fn> };
};

function makeCanvasLeaf(filePath: string) {
  return { view: { file: { path: filePath } } };
}

let view: EditorPanelView;
let mockPlugin: MockPlugin;
let mockLeaf: { containerEl: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();

  const canvasLeaf = makeCanvasLeaf('test.canvas');
  mockPlugin = {
    app: {
      vault: {
        getAbstractFileByPath: vi.fn().mockReturnValue(null),
        read: vi.fn().mockResolvedValue('{}'),
        modify: vi.fn().mockResolvedValue(undefined),
      },
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
        getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
      },
    },
    settings: {},
    canvasNodeFactory: {
      createNode: vi.fn().mockReturnValue(null),  // default: no-op factory
    },
    canvasLiveEditor: {
      saveLive: vi.fn().mockResolvedValue(true),  // default: treats as handled
      getCanvasJSON: vi.fn().mockReturnValue(null),
    },
  };
  mockLeaf = { containerEl: {} };

  view = new EditorPanelView(
    mockLeaf as unknown as WorkspaceLeaf,
    mockPlugin as unknown as RadiProtocolPlugin,
  );

  // Pitfall 3: stub contentEl (ItemView mock does not auto-init)
  (view as unknown as { contentEl: Record<string, unknown> }).contentEl = fakeContentEl();

  // Pitfall 2: make Setting.prototype.* chainable — they return undefined by default under vi.mock
  installSettingPrototypeMock();

  // Pitfall 4: stub renderToolbar to skip setIcon which is not in mock
  vi.spyOn(
    view as unknown as { renderToolbar: (c: unknown) => void },
    'renderToolbar',
  ).mockImplementation(() => {});
});

// ── Fakes ───────────────────────────────────────────────────────────────
interface CreatedEl { tag: string; cls?: string; text?: string }
let capturedCreatedEls: CreatedEl[] = [];

function fakeContentEl(): Record<string, unknown> {
  const fn = () => fakeNode();
  const self: Record<string, unknown> = {
    empty: () => { capturedCreatedEls = []; },
    createDiv: (_opts?: { cls?: string }) => fakeNode(),
    createEl: (tag: string, opts?: { cls?: string; text?: string }) => {
      capturedCreatedEls.push({ tag, cls: opts?.cls, text: opts?.text });
      return fakeNode();
    },
    createSpan: () => fakeNode(),
  };
  return self;
}

function fakeNode(): Record<string, unknown> {
  return {
    empty: () => {},
    createDiv: (_opts?: { cls?: string }) => fakeNode(),
    createEl: (_tag: string, _opts?: unknown) => fakeNode(),
    createSpan: () => fakeNode(),
    setAttribute: () => {},
    appendText: () => {},
    addEventListener: () => {},
  };
}

// Capture all Setting.setName / setDesc / setHeading calls so tests can assert
const settingCalls = { setName: [] as string[], setDesc: [] as string[], setHeading: [] as unknown[] };
const textareaOnChange: { cb: ((v: string) => void) | null } = { cb: null };
const dropdownOptions: Array<[string, string]> = [];

function installSettingPrototypeMock(): void {
  settingCalls.setName = [];
  settingCalls.setDesc = [];
  settingCalls.setHeading = [];
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
    settingCalls.setHeading.push(true);
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

  // Other Setting methods used в других case arms — noop chainable
  SettingProto.addText = vi.fn(function (this: unknown) { return this; });
}

// ── Tests ───────────────────────────────────────────────────────────────
describe('LOOP-05: Node Editor loop form lock-in (D-01, D-02, D-17)', () => {
  it('dropdown contains option loop with label "Loop"', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm({}, null);
    const loopEntry = dropdownOptions.find(([v]) => v === 'loop');
    expect(loopEntry).toBeDefined();
    expect(loopEntry?.[1]).toBe('Loop');
  });

  it('renderForm(kind=loop) renders heading "Loop node" + exactly one "Header text" Setting', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop', radiprotocol_headerText: 'sample' },
      'loop',
    );
    expect(settingCalls.setName).toContain('Loop node');
    const headerTextCount = settingCalls.setName.filter(n => n === 'Header text').length;
    expect(headerTextCount).toBe(1);
  });

  it('loop form NEVER renders a Setting with /iterations/i in name/desc/heading (RUN-07 regression guard)', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop' },
      'loop',
    );
    const haystack = [...settingCalls.setName, ...settingCalls.setDesc].join(' | ');
    expect(haystack).not.toMatch(/iterations/i);
  });

  it('header-text textarea onChange writes to BOTH pendingEdits.radiprotocol_headerText AND pendingEdits.text', () => {
    (view as unknown as { renderForm: (n: unknown, k: unknown) => void }).renderForm(
      { radiprotocol_nodeType: 'loop', radiprotocol_headerText: '' },
      'loop',
    );
    expect(textareaOnChange.cb).not.toBeNull();
    textareaOnChange.cb?.('new lesion header');
    const pendingEdits = (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits;
    expect(pendingEdits['radiprotocol_headerText']).toBe('new lesion header');
    expect(pendingEdits['text']).toBe('new lesion header');
  });

  it('saveNodeEdits with kind=loop injects color:"1" via NODE_COLOR_MAP (Phase 28 D-01 pipeline lock-in)', async () => {
    const saveLiveSpy = mockPlugin.canvasLiveEditor.saveLive;
    await view.saveNodeEdits('test.canvas', 'node-123', {
      radiprotocol_nodeType: 'loop',
      radiprotocol_headerText: 'x',
    });
    expect(saveLiveSpy).toHaveBeenCalledTimes(1);
    const secondArg = saveLiveSpy.mock.calls[0]?.[2] as Record<string, unknown> | undefined;
    expect(secondArg?.color).toBe('1');
    expect(secondArg?.radiprotocol_nodeType).toBe('loop');
  });
});

describe('LOOP-05: Quick-create loop button (D-03, D-04)', () => {
  it('onQuickCreate("loop") calls canvasNodeFactory.createNode(canvasPath, "loop", anchorId?)', async () => {
    mockPlugin.canvasNodeFactory.createNode.mockReturnValue(null);  // stays null-safe

    // Seed currentFilePath via loadNode-equivalent direct assignment (bypass vault.read)
    (view as unknown as {
      currentFilePath: string | null;
      currentNodeId: string | null;
    }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'anchor-1';

    // onQuickCreate is private — cast to access for the test
    await (view as unknown as {
      onQuickCreate: (k: string) => Promise<void>;
    }).onQuickCreate('loop');

    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalledTimes(1);
    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalledWith(
      'test.canvas',
      'loop',
      'anchor-1',
    );
  });

  it('onQuickCreate("loop") flushes pending debounce before creating', async () => {
    mockPlugin.canvasNodeFactory.createNode.mockReturnValue(null);

    (view as unknown as {
      currentFilePath: string | null;
      currentNodeId: string | null;
      pendingEdits: Record<string, unknown>;
      _debounceTimer: ReturnType<typeof setTimeout> | null;
    }).currentFilePath = 'test.canvas';
    (view as unknown as { currentNodeId: string | null }).currentNodeId = 'anchor-1';
    (view as unknown as { pendingEdits: Record<string, unknown> }).pendingEdits = { radiprotocol_headerText: 'pending' };
    (view as unknown as { _debounceTimer: ReturnType<typeof setTimeout> | null })._debounceTimer =
      setTimeout(() => {}, 10000);  // mock pending timer

    const saveSpy = vi.spyOn(view, 'saveNodeEdits').mockResolvedValue();

    await (view as unknown as { onQuickCreate: (k: string) => Promise<void> }).onQuickCreate('loop');

    expect(saveSpy).toHaveBeenCalledWith(
      'test.canvas',
      'anchor-1',
      expect.objectContaining({ radiprotocol_headerText: 'pending' }),
    );
    expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalled();
  });
});
```

### Замечания по реализации

1. **Pitfall 5 (fall-through guard)** — Test 2 assertion на `setName('Loop node')` (точная строка) уже защищает от fall-through к `case 'loop-start'/'loop-end'` legacy stub который использует `setName('Legacy loop node')`. Если кто-то случайно merge'ит arms — тест упадёт.
2. **Test 5 (color injection)** — может потребовать `fs` mock если существующий saveNodeEdits пытается читать файл через vault.read. Защита: `saveLive` mocked to return `true` → pipeline exits до vault.modify fallback (editor-panel-view.ts:186-196). Это гарантирует integration-test оставаясь unit-level.
3. **Test 6-7 TDD order** — эти тесты ЗАВИСЯТ от Task 2 (union extension). До Task 2 они скомпилируются (TypeScript `onQuickCreate('loop')` уже type-error, но мы используем `as unknown as` cast — compile проходит, runtime упадёт на switch-miss в onQuickCreate — ожидаемо RED).
4. **`expect(mockPlugin.canvasNodeFactory.createNode).toHaveBeenCalledWith(...)` в Test 6** — factory accepts `RPNodeKind` включая 'loop' по существующей сигнатуре (zero-delta per D-CL-03).
5. **Никаких других test-файлов не редактируется** — `editor-panel-create.test.ts` остаётся как reference.

## CLAUDE.md правило

Новый файл. Ничего не удаляется.
  </action>
  <verify>
    <automated>npm test -- --run src/__tests__/editor-panel-loop-form.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/__tests__/editor-panel-loop-form.test.ts` exit 0
    - `grep -c "^describe\\|^  it\\|^  describe" src/__tests__/editor-panel-loop-form.test.ts` >= 8 (2 describe + 7 it)
    - `grep -n "'Loop node'" src/__tests__/editor-panel-loop-form.test.ts` — minimum 1 match (heading lock-in test)
    - `grep -n "'Header text'" src/__tests__/editor-panel-loop-form.test.ts` — minimum 1 match
    - `grep -n "/iterations/i" src/__tests__/editor-panel-loop-form.test.ts` — minimum 1 match (negative regression test)
    - `grep -n "pendingEdits\\['radiprotocol_headerText'\\]\\|pendingEdits\\['text'\\]" src/__tests__/editor-panel-loop-form.test.ts` — minimum 2 matches (D-02 onChange sync assertion)
    - `grep -n "onQuickCreate.*'loop'" src/__tests__/editor-panel-loop-form.test.ts` — minimum 1 match
    - `grep -n "color.*'1'\\|NODE_COLOR_MAP" src/__tests__/editor-panel-loop-form.test.ts` — minimum 1 match (saveNodeEdits color assertion)
    - `grep -n "vi.mock\\('obsidian'\\)" src/__tests__/editor-panel-loop-form.test.ts` — exactly 1 match
    - **Tests 1-5 pass immediately** (lock-in on existing Phase 44 code): `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts -t "loop form"` — 5 of the `describe('LOOP-05: Node Editor loop form')` tests зелёные; Tests 6-7 (`describe('LOOP-05: Quick-create loop button')`) МОГУТ быть RED до Task 2 — это ожидаемо
    - `npx tsc --noEmit --skipLibCheck` exit 0 (типы корректные — `as unknown as` касты не блокируют compile)
    - **CLAUDE.md rule honoured:** новый test-file; не правим существующие файлы в этой задаче
  </acceptance_criteria>
  <done>
    `src/__tests__/editor-panel-loop-form.test.ts` создан с 7 тестами. Tests 1-5 зелёные (lock-in существующего Phase 44 кода). Tests 6-7 могут быть RED до Task 2 — это ожидаемый TDD RED перед GREEN в следующей задаче.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add loop quick-create button + widen onQuickCreate union + CSS append + build</name>
  <files>src/views/editor-panel-view.ts, src/styles/editor-panel.css</files>
  <read_first>
    - src/views/editor-panel-view.ts:745-784 (onQuickCreate — расширяется union)
    - src/views/editor-panel-view.ts:852-883 (renderToolbar — добавляется 4-й блок)
    - src/views/editor-panel-view.ts:1 (import line — проверить setIcon уже импортирован, да)
    - src/styles/editor-panel.css (ВСЕ 169 строк — чтобы знать куда appending)
    - src/canvas/canvas-node-factory.ts:38-77 (createNode — подтвердить kind-agnostic, D-CL-03 zero-delta)
    - esbuild.config.mjs (подтвердить editor-panel.css в CSS_FILES array)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-03, D-04, D-05, D-CL-01, D-CL-02
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"1) src/views/editor-panel-view.ts" + §"7) src/styles/editor-panel.css"
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md Pitfall 9 (CSS file scope)
    - CLAUDE.md (per-feature CSS, append-only, never remove existing code)
  </read_first>
  <behavior>
    - Post-edit: `onQuickCreate` signature принимает kind типа `'question' | 'answer' | 'snippet' | 'loop'`.
    - Post-edit: `renderToolbar` создаёт 4 кнопки в порядке [question, answer, snippet, LOOP-new, duplicate]. Loop button имеет cls='rp-create-loop-btn', aria-label='Create loop node', title='Create loop node', icon 'repeat', text 'Create loop node', click handler `() => { void this.onQuickCreate('loop'); }`.
    - Post-edit: `src/styles/editor-panel.css` заканчивается Phase 45 блоком с `/* Phase 45: loop quick-create button */` marker и `.rp-create-loop-btn` rule-set (selectors: base, :hover, :active, :disabled).
    - Post-edit: `npm run build` exit 0; generated `styles.css` содержит новое правило (текст `.rp-create-loop-btn` присутствует).
    - Zero deletions from pre-edit files (CLAUDE.md). Все Phase 4/39/40/42 блоки в editor-panel.css preserved. Все существующие onQuickCreate('question'/'answer'/'snippet') branches поведенчески unchanged.
  </behavior>
  <action>
## CLAUDE.md правило (ОБЯЗАТЕЛЬНО echo)

**"Never remove existing code you didn't add."** В `src/views/editor-panel-view.ts` эта задача:
- МЕНЯЕТ ровно одну строку в сигнатуре `onQuickCreate` (расширяет union).
- ДОБАВЛЯЕТ ровно один новый блок 8 строк в `renderToolbar` между snippet-блоком (заканчивается на строке 874) и Phase 40 duplicate-блоком (начинается на строке 876).
- НЕ ТРОГАЕТ: строки 1-744, строки 746-866, строки 876-923 (вне диапазонов изменений). Особенно **НИКОГДА не трогать**:
  - строки 557-566 (legacy 'loop-start'/'loop-end' stub — Phase 44 RUN-07)
  - строки 568-586 (Phase 44 UAT-fix loop form — D-01 LANDMINE)
  - строки 588-665 (snippet form)
  - строки 867-874 (Phase 42 snippet button template — оставить byte-identical)

В `src/styles/editor-panel.css`:
- ДОБАВЛЯЕТ новый блок в конец файла (после строки 168).
- НЕ ТРОГАЕТ строки 1-168 (Phase 4/39/40/42 блоки).
- НЕ РЕДАКТИРУЕТ сгенерированные `styles.css` / `src/styles.css`.

---

## Шаг 1 — Расширить `onQuickCreate` union (editor-panel-view.ts:745)

Найти **точную** строку:
```typescript
  private async onQuickCreate(kind: 'question' | 'answer' | 'snippet'): Promise<void> {
```

Заменить **только** текст union (сохранить все пробелы, private, async, return type):
```typescript
  private async onQuickCreate(kind: 'question' | 'answer' | 'snippet' | 'loop'): Promise<void> {
```

Body функции (строки 746-784) — **не трогать**. Существующая реализация kind-agnostic: `this.plugin.canvasNodeFactory.createNode(canvasPath, kind, ...)` и `renderForm(nodeRecord, currentKind)` работают для 'loop' через существующие pipelines (Phase 28 color-map, Phase 44 case 'loop' form).

## Шаг 2 — Добавить loop button в `renderToolbar` (editor-panel-view.ts:874→875)

Найти конец Phase 42 snippet button блока — последняя его строка (editor-panel-view.ts:874):
```typescript
    this.registerDomEvent(sBtn, 'click', () => { void this.onQuickCreate('snippet'); });
```

Далее идёт пустая строка, затем комментарий `// Phase 40: Duplicate node button` на строке 876.

**Вставить ровно между ними** (после строки 874, перед строкой 876) следующий блок — добавь пустую строку-разделитель сверху и снизу для визуального отделения:

```typescript

    // Phase 45: Create loop node button (LOOP-05, D-03)
    const lBtn = toolbar.createEl('button', { cls: 'rp-create-loop-btn' });
    lBtn.setAttribute('aria-label', 'Create loop node');
    lBtn.setAttribute('title', 'Create loop node');
    const lIcon = lBtn.createSpan();
    setIcon(lIcon, 'repeat');
    lBtn.appendText('Create loop node');
    this.registerDomEvent(lBtn, 'click', () => { void this.onQuickCreate('loop'); });
```

### Почему icon = 'repeat' (D-CL-01 finalize)

Четыре кандидата: `repeat`, `repeat-1`, `rotate-cw`, `infinity`. Выбираем `'repeat'`:
- Самая прямая семантика «зациклить» (unlike `rotate-cw` который ассоциируется с refresh).
- `repeat-1` означает «повторить один раз» — не про loop, а про single-item replay.
- `infinity` слишком абстрактно и визуально похоже на цифру 8.
- Lucide icon `repeat` изображает две стрелки образующие петлю — совпадает с user mental model loop-узла.

### Почему aria-label и title — английские

Phase 42 snippet button имеет их английские (строки 869-870). Parallel pattern → consistency. Future-i18n phase может локализовать все кнопки одновременно.

### Почему класс именно `rp-create-loop-btn` (D-CL-02 finalize)

Прямое параллелизм с `rp-create-question-btn`, `rp-create-answer-btn`, `rp-create-snippet-btn`. Существует explicit naming convention `rp-create-{kind}-btn`.

## Шаг 3 — Append CSS в src/styles/editor-panel.css

Файл `src/styles/editor-panel.css` сейчас заканчивается на строке 168:
```css
/* Phase 42 Plan 04: responsive toolbar — wrap buttons onto a new row at narrow sidebar widths */
.rp-editor-create-toolbar {
  flex-wrap: wrap;
  row-gap: var(--size-4-1);
}
```

**Добавить в конец файла** (после строки 168, с пустой строкой-разделителем сверху):

```css

/* Phase 45: loop quick-create button */
.rp-create-loop-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2-1);
  padding: 6px 12px;
  border-radius: var(--radius-s);
  font-size: var(--font-ui-small);
  font-weight: var(--font-semibold);
  cursor: pointer;
  border: none;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  transition: filter 0.1s ease;
}

.rp-create-loop-btn:hover {
  filter: brightness(1.1);
}

.rp-create-loop-btn:active {
  filter: brightness(0.95);
}

.rp-create-loop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: none;
}
```

Маркер `/* Phase 45: loop quick-create button */` (Pitfall 9 точная форма) — обязателен для последующего grep-assertion'а в Task 3 CSS verify.

**НЕ РЕДАКТИРОВАТЬ `src/styles/loop-support.css`** — это runner picker feature, другой scope.

## Шаг 4 — Rebuild

После CSS edit запустить:

```bash
npm run build
```

Это:
1. Ре-компилирует `main.js` через esbuild.
2. Конкатенирует `src/styles/*.css` в root `styles.css` + `src/styles.css` в точном порядке из `CSS_FILES` в `esbuild.config.mjs`.
3. Если есть `.env` с `OBSIDIAN_DEV_VAULT_PATH` — копирует в dev vault (не блокирует если отсутствует).

Ожидаемый результат: exit 0; `styles.css` содержит `.rp-create-loop-btn` и `Phase 45: loop` marker.

## Post-edit verification

```bash
# Type check — должен пройти
npx tsc --noEmit --skipLibCheck

# Loop form tests (Task 1) — теперь все 7 должны быть зелёными
npm test -- --run src/__tests__/editor-panel-loop-form.test.ts

# Phase 42 snippet test не должен сломаться
npm test -- --run src/__tests__/editor-panel-create.test.ts

# Full suite — preserved growth
npm test -- --run

# Grep invariants
grep -c "rp-create-loop-btn" src/views/editor-panel-view.ts    # 1
grep -c "rp-create-loop-btn" src/styles/editor-panel.css        # >= 4 (base + :hover + :active + :disabled)
grep -c "Phase 45: loop quick-create button" src/styles/editor-panel.css  # 1
grep -c "rp-create-loop-btn" styles.css                         # >= 4 (regenerated)
```
  </action>
  <verify>
    <automated>npm run build && npm test -- --run src/__tests__/editor-panel-loop-form.test.ts && npm test -- --run src/__tests__/editor-panel-create.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "kind: 'question' | 'answer' | 'snippet' | 'loop'" src/views/editor-panel-view.ts` returns exactly one match (onQuickCreate signature)
    - `grep -n "rp-create-loop-btn" src/views/editor-panel-view.ts` returns exactly one match (toolbar block)
    - `grep -n "setIcon(lIcon, 'repeat')" src/views/editor-panel-view.ts` returns exactly one match (D-CL-01 finalize)
    - `grep -n "this.onQuickCreate('loop')" src/views/editor-panel-view.ts` returns exactly one match (click handler)
    - `grep -B2 -A1 "rp-create-loop-btn" src/views/editor-panel-view.ts | grep "Phase 45"` — returns the Phase 45 marker comment (position adjacent to new block)
    - **Position verification (D-03):** `awk '/rp-create-snippet-btn/{snip=NR} /rp-create-loop-btn/{loop=NR} /rp-duplicate-btn/{dup=NR} END{print (snip<loop && loop<dup) ? "OK" : "FAIL"}' src/views/editor-panel-view.ts` prints "OK" (loop button between snippet and duplicate)
    - `grep -c "Phase 45: loop quick-create button" src/styles/editor-panel.css` === 1
    - `grep -c "\\.rp-create-loop-btn" src/styles/editor-panel.css` >= 4 (base + :hover + :active + :disabled selectors)
    - **CSS file discipline:** `grep -c "Phase 45" src/styles/loop-support.css` === 0 (Phase 45 CSS не просочилась в runner CSS file — Pitfall 9)
    - `npm run build` exit 0
    - `grep -c "rp-create-loop-btn" styles.css` >= 4 (styles.css regenerated and includes new rule)
    - **Generated files не редактировались вручную**: `git diff src/styles.css styles.css` должен показывать только автоматическую regeneration (new content line contains `.rp-create-loop-btn` — no hand-edited unrelated additions)
    - `npx tsc --noEmit --skipLibCheck` exit 0
    - `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts` exit 0 — ВСЕ 7 tests зелёные (Tests 6-7 теперь GREEN после union extension)
    - `npm test -- --run src/__tests__/editor-panel-create.test.ts` exit 0 — Phase 42 тесты не сломаны
    - `npm test -- --run` exit 0 — полный suite зелёный с net +7 passing tests (из Task 1)
    - **CLAUDE.md landmines preserved**: `grep -c "case 'loop': {" src/views/editor-panel-view.ts` === 1 (Phase 44 UAT-fix form arm intact); `grep -c "case 'loop-start':" src/views/editor-panel-view.ts` === 1 (Phase 44 legacy stub intact); `grep -c "Legacy loop node" src/views/editor-panel-view.ts` === 1 (stub text intact); `grep -c "rp-create-snippet-btn" src/views/editor-panel-view.ts` === 1 (Phase 42 button preserved)
    - **CLAUDE.md per-feature CSS honoured**: новый CSS только в `src/styles/editor-panel.css`, не в `loop-support.css` / `runner-view.css` / любом другом файле.
  </acceptance_criteria>
  <done>
    Loop quick-create кнопка добавлена в editor-panel toolbar с классом `rp-create-loop-btn`, icon 'repeat', позиционирована между snippet и duplicate. `onQuickCreate` union расширен до 4 kinds. CSS правило добавлено append-only в `editor-panel.css` с Phase 45 маркером. `styles.css` regenerated через `npm run build`. Все 7 тестов из Task 1 зелёные. Полный suite без регрессий; CLAUDE.md landmines (Phase 44 UAT-fix form, legacy stub, Phase 42 snippet button) нетронуты.
  </done>
</task>

</tasks>

<verification>
```bash
# Type check
npx tsc --noEmit --skipLibCheck

# Build + CSS regeneration
npm run build

# Targeted tests
npm test -- --run src/__tests__/editor-panel-loop-form.test.ts
npm test -- --run src/__tests__/editor-panel-create.test.ts

# Full suite regression check
npm test -- --run

# Key invariants
grep -c "rp-create-loop-btn" src/views/editor-panel-view.ts    # 1
grep -c "rp-create-loop-btn" src/styles/editor-panel.css        # >= 4
grep -c "Phase 45: loop quick-create button" src/styles/editor-panel.css  # 1
grep -c "rp-create-loop-btn" styles.css                         # >= 4 (generated)

# Landmines intact
grep -c "case 'loop': {" src/views/editor-panel-view.ts         # 1 (Phase 44 UAT form)
grep -c "case 'loop-start':" src/views/editor-panel-view.ts     # 1 (legacy stub)
grep -c "Legacy loop node" src/views/editor-panel-view.ts       # 1
grep -c "rp-create-snippet-btn" src/views/editor-panel-view.ts  # 1 (Phase 42 preserved)
```

Expected: все exit 0. Полный suite растёт на net +7 passing tests (Task 1) без новых failures. Generated `styles.css` автоматически обновлён.
</verification>

<success_criteria>
- `onQuickCreate` kind union — 4 kinds including 'loop'.
- `renderToolbar` содержит loop-button блок с классом `rp-create-loop-btn`, между snippet и duplicate.
- `src/styles/editor-panel.css` tail содержит Phase 45 marker + `.rp-create-loop-btn` rule set (base + :hover + :active + :disabled).
- `styles.css` в root regenerated — содержит новое правило после `npm run build`.
- `src/__tests__/editor-panel-loop-form.test.ts` — 7 тестов, все зелёные.
- `npm test -- --run` полный suite зелёный; growth >= +7 passing.
- CLAUDE.md правила сохранены: Phase 44 UAT-fix form (строки 568-586), Phase 44 legacy stub (557-566), Phase 42 snippet button (867-874), все Phase 4/39/40/42 CSS блоки — без изменений.
- `src/styles/loop-support.css` не тронут (Pitfall 9).
</success_criteria>

<output>
После завершения создать `.planning/phases/45-loop-editor-form-picker-color-map/45-02-SUMMARY.md`:

```markdown
# Phase 45, Plan 02 — Editor-panel loop button + form lock-in: SUMMARY

**Completed:** YYYY-MM-DD
**Status:** Green
**Requirements:** LOOP-05 (full), LOOP-06 (color-map integration lock-in)

## What shipped
- Loop quick-create button (icon 'repeat', class rp-create-loop-btn) в editor-panel toolbar
- onQuickCreate union extended to 4 kinds
- Phase 45 CSS block appended в editor-panel.css
- styles.css regenerated through npm run build
- 7 lock-in unit tests для Phase 44 UAT-fix form + new button

## Decisions implemented
- D-01, D-02 (lock-in Phase 44 form via tests, not rewrite)
- D-03 (button position, icon, label)
- D-04 (onQuickCreate union widened)
- D-05 + D-CL-03 (factory zero-delta — verified not edited)
- D-17 (color injection integration test via saveNodeEdits)
- D-CL-01 (icon 'repeat')
- D-CL-02 (class rp-create-loop-btn)

## Tests added
- 7 tests in src/__tests__/editor-panel-loop-form.test.ts

## Files modified
- src/views/editor-panel-view.ts (+9 lines in renderToolbar, +~10 chars in onQuickCreate signature)
- src/styles/editor-panel.css (+22 lines append)
- styles.css / src/styles.css (regenerated by npm run build)

## Full suite
- Before: 402 passed + 1 skipped
- After: XXX passed + 1 skipped / 0 failed (growth +7 from this plan + N from Plan 01)

## CLAUDE.md compliance
- Phase 44 UAT-fix form (lines 568-586): preserved byte-identical
- Phase 44 legacy 'loop-start'/'loop-end' stub (lines 557-566): preserved
- Phase 42 snippet button block (lines 867-874): preserved byte-identical
- Phase 4/39/40/42 CSS blocks in editor-panel.css (lines 1-168): preserved
- src/styles/loop-support.css: NOT touched (runner feature scope)
- styles.css / src/styles.css: only regenerated, never hand-edited
```
</output>
