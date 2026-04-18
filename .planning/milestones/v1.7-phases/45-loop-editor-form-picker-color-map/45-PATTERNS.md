# Phase 45: Loop Editor Form, Picker & Color Map — Pattern Map

**Mapped:** 2026-04-18
**Files analysed:** 9 (7 modified + 2 created)
**Analogs found:** 9 / 9 (все внутрикодовые, без fallback на RESEARCH.md).

---

## CLAUDE.md Guardrails (carry into every task)

Planner ДОЛЖЕН перенести эти правила в acceptance criteria каждой задачи, касающейся перечисленных файлов:

1. **Never remove existing code you didn't add.** При редактировании `src/views/editor-panel-view.ts`, `src/views/node-picker-modal.ts`, `src/main.ts`, `src/views/runner-view.ts`, `src/runner/protocol-runner.ts`, `src/canvas/canvas-node-factory.ts`, `src/styles/editor-panel.css` — добавлять/модифицировать ТОЛЬКО код, относящийся к Phase 45. Все Phase 4/28/39/40/42/43/44 блоки (CSS rules, addCommand, case-ветки, form sections) остаются нетронутыми. Если неясно, чей блок — НЕ трогать.
2. **CSS: per-feature file + append-only per phase.** Новый CSS Phase 45 идёт ТОЛЬКО в `src/styles/editor-panel.css`, **в конец файла**, с маркером `/* Phase 45: loop quick-create button */`. Никаких правок `loop-support.css` (он про runner picker, другая feature). Никогда не редактировать сгенерированный `styles.css` / `src/styles.css`.
3. **After any CSS change — `npm run build`** для регенерации `styles.css`. Не коммитить ручные правки generated файла.
4. **Phase 44 UAT-fix landmine:** `src/views/editor-panel-view.ts` lines **568-586** (case 'loop' form) — REFERENCE ONLY, НЕ переписывать. Phase 45 только фиксирует это тестами (D-01).
5. **Command id без плагин-префикса** (NFR-06) — только `'start-from-node'`, НЕ `'radiprotocol-start-from-node'`.

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality | Status |
|------|------|-----------|----------------|---------------|--------|
| `src/views/editor-panel-view.ts` | view (ItemView) | request-response (user → canvas write) | self (lines 867-874 — snippet button block; lines 745-784 — onQuickCreate) | **exact (self-reference)** | modified |
| `src/views/node-picker-modal.ts` | view (SuggestModal) | transform (graph → NodeOption[]) | self (lines 17-38 — current 2-kind buildNodeOptions) | **exact (self-reference)** | modified |
| `src/canvas/canvas-node-factory.ts` | canvas-IO service | CRUD (create) | self (lines 59-71 — kind-agnostic createNode body) | **zero-delta** | verify-only |
| `src/main.ts` | plugin entry (command wiring) | event-driven (command palette) | `main.ts:46-81` (existing addCommand blocks); `main.ts:267-276` (openEditorPanelForNode async method) | **exact (self-reference)** | modified |
| `src/views/runner-view.ts` | view (ItemView) | request-response | `runner-view.ts:61-154` (current `openCanvas(filePath)`) | **exact (self-reference)** | modified |
| `src/runner/protocol-runner.ts` | runner (pure engine) | state-machine | `protocol-runner.ts:54-66` (current `start(graph)`) | **exact (self-reference)** | modified |
| `src/styles/editor-panel.css` | style | n/a | self (lines 132-162 — `.rp-create-snippet-btn` block) | **exact (self-reference)** | modified (append) |
| `src/__tests__/editor-panel-loop-form.test.ts` | test (unit) | n/a | `src/__tests__/editor-panel-create.test.ts` (esp. 1-80 setup, 340-367 Setting.prototype hack, 409-446 renderForm test) | **exact (sibling test file)** | **NEW** |
| `src/__tests__/node-picker-modal.test.ts` | test (unit) | n/a | `src/__tests__/runner-commands.test.ts` (existing dynamic-import smoke test); `node-picker-modal.ts:17-38` (SUT) | **role-match** | **NEW** |
| `src/__tests__/runner-commands.test.ts` | test (unit) | n/a | self (lines 7-29 — existing RUN-10 / UI-04 tests) | **exact (self-reference)** | modified (extend) |

**Summary:** Phase 45 — *integration/extension* фаза. Каждый source-файл уже содержит свой собственный аналог (в виде соседней ветки switch, соседней кнопки в renderToolbar, соседнего addCommand блока, соседнего CSS-правила). Это снижает риск: планировщик копирует шаблон **из того же файла** в соседнюю позицию.

---

## Pattern Assignments

### 1) `src/views/editor-panel-view.ts` (view / ItemView, modified)

**Deltas (Phase 45 scope):**
- `onQuickCreate` kind-union (line 745): `'question' | 'answer' | 'snippet'` → `+ 'loop'` (D-04).
- `renderToolbar` (lines 852-883): добавить 4-ю кнопку `.rp-create-loop-btn` **после** snippet-блока (line 874), **перед** Phase 40 duplicate-блоком (line 877). D-03 + D-CL-01/02.
- **НЕ трогать:** case 'loop' форма (lines 568-586, Phase 44 UAT-fix), case 'loop-start'/'loop-end' legacy stub (lines 557-566), dropdown (line 345), saveNodeEdits color injection (lines 164-182).

**Analog 1a — onQuickCreate union + body (self, lines 745-784):**
```typescript
private async onQuickCreate(kind: 'question' | 'answer' | 'snippet'): Promise<void> {
  const canvasPath = this.getActiveCanvasPath();
  if (!canvasPath) {
    new Notice('Open a canvas first to create nodes.');
    return;
  }

  // Flush pending auto-save before switching (Pitfall 3 from RESEARCH.md)
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this.currentFilePath && this.currentNodeId) {
      const editsSnapshot = { ...this.pendingEdits };
      try {
        await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
      } catch { /* flush save failure does not block creation — silent */ }
    }
  }

  const result = this.plugin.canvasNodeFactory.createNode(
    canvasPath,
    kind,
    this.currentNodeId ?? undefined
  );

  if (result) {
    this.currentFilePath = canvasPath;
    this.currentNodeId = result.nodeId;
    this.pendingEdits = {};
    const nodeRecord = result.canvasNode.getData();
    const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
    this.renderForm(nodeRecord, currentKind);
  }
}
```
**Target delta:** заменить сигнатуру на `kind: 'question' | 'answer' | 'snippet' | 'loop'`. Body — без изменений (zero logic delta).

**Analog 1b — existing Phase 42 snippet quick-create button (self, lines 867-874):**
```typescript
// Phase 42: Create snippet node button
const sBtn = toolbar.createEl('button', { cls: 'rp-create-snippet-btn' });
sBtn.setAttribute('aria-label', 'Create snippet node');
sBtn.setAttribute('title', 'Create snippet node');
const sIcon = sBtn.createSpan();
setIcon(sIcon, 'file-text');
sBtn.appendText('Create snippet node');
this.registerDomEvent(sBtn, 'click', () => { void this.onQuickCreate('snippet'); });
```
**Target pattern (Phase 45 new block, insert on line 875 — between snippet block and Phase 40 duplicate block):**
```typescript
// Phase 45: Create loop node button
const lBtn = toolbar.createEl('button', { cls: 'rp-create-loop-btn' });
lBtn.setAttribute('aria-label', 'Create loop node');
lBtn.setAttribute('title', 'Create loop node');
const lIcon = lBtn.createSpan();
setIcon(lIcon, 'repeat');   // D-CL-01 — planner default 'repeat'; может быть repeat-1/rotate-cw/infinity
lBtn.appendText('Create loop node');
this.registerDomEvent(lBtn, 'click', () => { void this.onQuickCreate('loop'); });
```

**Imports pattern (self, line 1) — уже импортирует всё нужное:**
```typescript
import { ItemView, WorkspaceLeaf, Setting, TFile, Notice, setIcon } from 'obsidian';
```
No import changes needed — `setIcon` уже доступен, Phase 45 не добавляет новых obsidian импортов.

**Error handling / validation pattern (self, lines 745-750):**
Reuse existing `Notice('Open a canvas first to create nodes.')` — `onQuickCreate('loop')` автоматически наследует этот path.

**LANDMINE:** Lines 568-586 — case 'loop' form Phase 44 UAT-fix. Planner должен явно запретить редактирование этого диапазона в acceptance criteria. D-01 фиксирует: lock-in только тестами.

---

### 2) `src/views/node-picker-modal.ts` (view / SuggestModal, modified — rewrite internals)

**Deltas (Phase 45 scope):**
- `NodeOption.kind` union (line 9): `'question' | 'text-block'` → `+ 'snippet' | 'loop'` (D-09).
- `buildNodeOptions` (lines 17-38): добавить 2 новых `else if` ветки (snippet, loop), переделать sort на `KIND_ORDER` indexOf, label с fallback на `id` (D-06, D-07, D-08).
- `renderSuggestion` (lines 67-70): badge text из `KIND_LABELS[option.kind]` (D-10), заменить inline `option.kind`.
- Добавить top-level const `KIND_LABELS: Record<NodeOption['kind'], string>` (D-10) и `KIND_ORDER: NodeOption['kind'][]` (D-08).
- **НЕ трогать:** `class NodePickerModal` public API, `setPlaceholder('Search nodes by label…')` (D-11 — английский остаётся), constructor signature.

**Analog 2a — current buildNodeOptions body (self, lines 17-38):**
```typescript
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      options.push({ id, label: (node as QuestionNode).questionText, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const preview = (node as TextBlockNode).content.slice(0, 60);
      options.push({ id, label: preview, kind: 'text-block' });
    }
  }

  // Sort: questions first, then text-blocks; within each group, alphabetically by label
  options.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'question' ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });

  return options;
}
```

**Target pattern (Phase 45 rewrite — see RESEARCH.md Example 4):**
- Добавить imports `SnippetNode`, `LoopNode` к существующему import line 4.
- Добавить 2 новых `else if` ветки (snippet, loop) после text-block ветки — **append-only, не удалять question/text-block**.
- Добавить `|| id` fallback к label всех 4 kinds (D-07).
- Заменить sort-compare на `KIND_ORDER.indexOf(...)` с alphabetical within-group через `toLowerCase().localeCompare()` (D-08).

**Analog 2b — current renderSuggestion (self, lines 67-70):**
```typescript
renderSuggestion(option: NodeOption, el: HTMLElement): void {
  el.createEl('div', { text: option.label });
  el.createEl('small', { text: option.kind, cls: 'rp-node-kind-badge' });
}
```
**Target delta (D-10):**
```typescript
renderSuggestion(option: NodeOption, el: HTMLElement): void {
  el.createEl('div', { text: option.label });
  el.createEl('small', { text: KIND_LABELS[option.kind], cls: 'rp-node-kind-badge' });
}
```

**Imports pattern (line 3-4) — требуется расширить type imports:**
```typescript
// current:
import type { ProtocolGraph, QuestionNode, TextBlockNode } from '../graph/graph-model';
// target:
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model';
```

**Anti-pattern ANCHOR:** RESEARCH.md Pitfall 6 — **НЕ добавлять** answer/start/legacy-loop в switch. D-06 explicit-отклонение. Test в `node-picker-modal.test.ts` assert'ит исключение.

---

### 3) `src/canvas/canvas-node-factory.ts` (canvas-IO service, verify-only / zero-delta)

**Deltas (Phase 45 scope):** ZERO (subject to planner verification).

**Analog 3 — createNode body (self, lines 38-77):**
```typescript
createNode(
  canvasPath: string,
  nodeKind: RPNodeKind,
  anchorNodeId?: string
): CreateNodeResult | null {
  const canvas = this.getCanvasWithCreateAPI(canvasPath);
  if (!canvas) return null;

  let pos = { x: 0, y: 0 };
  if (anchorNodeId) {
    const anchor = canvas.nodes.get(anchorNodeId);
    if (anchor) {
      pos = { x: anchor.x + anchor.width + NODE_GAP, y: anchor.y };
    }
  }

  const canvasNode = canvas.createTextNode({
    pos,
    text: '',
    size: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
  });

  // Apply RadiProtocol properties — include color in setData per Research Pitfall 4
  const nodeData = canvasNode.getData();
  canvasNode.setData({
    ...nodeData,
    radiprotocol_nodeType: nodeKind,
    color: NODE_COLOR_MAP[nodeKind],
  });

  canvas.requestSave();
  return { nodeId: canvasNode.id, canvasNode };
}
```
**Why zero-delta (D-CL-03, RESEARCH.md §2.3):**
- Функция kind-agnostic — нет switch per-kind.
- `nodeKind: RPNodeKind` → `'loop'` валиден union-member.
- `NODE_COLOR_MAP[nodeKind]` → `'1'` для loop (node-color-map.ts:21, Phase 43 D-12, уже проверено).
- `radiprotocol_headerText: ''` stub **опционален** — парсер нормализует отсутствующий header в пустую строку (Phase 43 D-05). Planner может не добавлять, но если добавит — должно быть в том же `setData({...})` блоке.

**Planner action:** прочесть файл, подтвердить что createNode работает для 'loop' как есть → пометить задачу как completed без code-edit. Если обнаружится аномалия — добавить kind-specific branch ТОЛЬКО для 'loop' (не переписывать существующее).

---

### 4) `src/main.ts` (plugin entry / command wiring, modified)

**Deltas (Phase 45 scope):**
- Добавить `this.addCommand({ id: 'start-from-node', name: 'Start from specific node', callback })` в `onload()` (D-12). Позиция — рядом с другими addCommand блоками (после `open-node-editor` block, line 81). **Append-only.**
- Добавить новый приватный async метод `handleStartFromNode()` (D-13). Позиция — рядом с `openEditorPanelForNode` (line 267).
- Добавить import для `NodePickerModal`, `buildNodeOptions` (из `./views/node-picker-modal`) и `GraphValidator` (из `./graph/graph-validator`). Остальные imports (`TFile`, `Notice`, `RUNNER_VIEW_TYPE`) уже есть.
- **НЕ трогать:** existing addCommand blocks (46-81), ribbonIcon (43), registerView blocks (61-67), canvas:node-menu registration (91-119), activate* methods (134-234).

**Analog 4a — existing addCommand block template (self, lines 70-81):**
```typescript
// Command: open-snippet-manager (SNIP-01)
this.addCommand({
  id: 'open-snippet-manager',
  name: 'Open snippet manager',
  callback: () => { void this.activateSnippetManagerView(); },
});

// Command: open-node-editor (EDIT-01 — opens editor panel; NFR-06: no plugin name prefix)
this.addCommand({
  id: 'open-node-editor',
  name: 'Open node editor',
  callback: () => { void this.activateEditorPanelView(); },
});
```
**Target pattern (new block after line 81):**
```typescript
// Phase 45 (LOOP-06): start-from-node command (NFR-06: no plugin name prefix)
this.addCommand({
  id: 'start-from-node',
  name: 'Start from specific node',
  callback: () => { void this.handleStartFromNode(); },
});
```

**Analog 4b — canvas leaf discovery pattern (self, lines 98-105):**
```typescript
const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
const activeLeaf = canvasLeaves.find(leaf => {
  const view = leaf.view as unknown as { canvas?: unknown };
  return view.canvas === node.canvas;
});
const filePath = (activeLeaf?.view as { file?: { path: string } } | undefined)?.file?.path;
```
**Alternative pattern (editor-panel-view.ts:54-57 — preferred for start-from-node — most-recent-leaf):**
```typescript
const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
```

**Analog 4c — async method on plugin (self, lines 267-276):**
```typescript
async openEditorPanelForNode(filePath: string, nodeId: string): Promise<void> {
  await this.activateEditorPanelView();
  const leaves = this.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
  const leaf = leaves[0];
  if (leaf === undefined) return;
  const view = leaf.view;
  if (view instanceof EditorPanelView) {
    view.loadNode(filePath, nodeId);
  }
}
```
**Target skeleton (Phase 45 new method — see RESEARCH.md Example 5 for full body):**
```typescript
private async handleStartFromNode(): Promise<void> {
  // 1. Find active canvas leaf (pattern из editor-panel-view.ts:54-57)
  // 2. On no-canvas: new Notice('Open a canvas first.') (D-CL-04, english-consistent)
  // 3. Read live JSON via canvasLiveEditor.getCanvasJSON(), fallback to vault.read
  // 4. canvasParser.parse() → on failure: Notice(error)
  // 5. new GraphValidator().validate(graph) → on errors: Notice(errors[0]) (D-CL-06)
  // 6. buildNodeOptions(graph) → on empty: Notice('No startable nodes in this canvas.')
  // 7. await this.activateRunnerView() (D-15)
  // 8. getLeavesOfType(RUNNER_VIEW_TYPE)[0] → runnerView
  // 9. new NodePickerModal(this.app, options, (opt) => {
  //      void runnerView.openCanvas(canvasPath, opt.id);   // D-14 extension
  //    }).open();
}
```

**Imports delta:**
```typescript
// existing:
import { Plugin, Notice, Menu, TFile } from 'obsidian';
// existing imports of plugin services — keep as-is.
// Add to imports:
import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal';
import { GraphValidator } from './graph/graph-validator';
```

**Landmine:** NFR-06 — command id НЕ должен содержать префикс `radiprotocol-`. Test в `runner-commands.test.ts` assert'ит точную строку `'start-from-node'` (D-20, RESEARCH.md Pitfall 10).

---

### 5) `src/views/runner-view.ts` (view / ItemView, modified — signature extension)

**Deltas (Phase 45 scope):**
- `openCanvas(filePath: string)` → `openCanvas(filePath: string, startNodeId?: string)` (D-14). Параметр **optional** (Pitfall 8 RESEARCH.md — иначе ломается session-resume через setState).
- При `startNodeId !== undefined` — bypass session-resume modal, clear session, call `runner.start(graph, startNodeId)`, `render()`, return.
- **НЕ трогать:** existing session-resume path (lines 104-145), error handling (71-88), selector sync (68), onOpen (156-200+), setState (46-58).

**Analog 5 — existing openCanvas signature + body (self, lines 61-154):**
```typescript
async openCanvas(filePath: string): Promise<void> {
  // Phase 15: re-create runner to pick up the current textSeparator setting
  this.runner = new ProtocolRunner({
    defaultSeparator: this.plugin.settings.textSeparator,
  });

  this.canvasFilePath = filePath;
  this.selector?.setSelectedPath(filePath);
  const file = this.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    this.renderError([`Canvas file not found: "${filePath}".`]);
    return;
  }

  let content: string;
  const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(filePath);
  if (liveJson !== null) {
    content = liveJson;
  } else {
    try {
      content = await this.app.vault.read(file);
    } catch {
      this.renderError([`Could not read canvas file: "${filePath}".`]);
      return;
    }
  }

  const parseResult = this.plugin.canvasParser.parse(content, filePath);
  if (!parseResult.success) {
    this.renderError([parseResult.error]);
    return;
  }

  const validationErrors = this.validator.validate(parseResult.graph);
  if (validationErrors.length > 0) {
    this.renderError(validationErrors);
    return;
  }

  const graph = parseResult.graph;

  // ── SESSION-02: check for existing incomplete session ─────────────────────
  const session = await this.plugin.sessionService.load(filePath);

  if (session !== null) {
    // ... full resume path — DO NOT TOUCH ...
  }

  // Normal protocol start (no session, or user chose start-over)
  await this.plugin.sessionService.clear(filePath);
  this.graph = graph;
  this.runner.start(graph);
  this.render();
}
```

**Target pattern (Phase 45 — insert startNodeId branch BEFORE session-resume path; see RESEARCH.md Example 7):**
```typescript
async openCanvas(filePath: string, startNodeId?: string): Promise<void> {
  // ... unchanged: runner reset, file lookup, content read, parse, validate ...

  const graph = parseResult.graph;

  // Phase 45: explicit start-from-node path bypasses session resume
  if (startNodeId !== undefined) {
    await this.plugin.sessionService.clear(filePath);
    this.graph = graph;
    this.runner.start(graph, startNodeId);   // D-14 — requires protocol-runner.ts extension
    this.render();
    return;
  }

  // ── existing SESSION-02 resume path unchanged ──
  // ...
}
```

**Landmine (RESEARCH.md Pitfall 8):** `setState` (line 56) вызывает `openCanvas(path)` без второго arg при Obsidian workspace restore. Второй параметр ДОЛЖЕН быть optional — backward compatibility жёсткое требование.

---

### 6) `src/runner/protocol-runner.ts` (pure engine, modified — signature extension)

**Deltas (Phase 45 scope):**
- `start(graph: ProtocolGraph): void` → `start(graph: ProtocolGraph, startNodeId?: string): void` (D-14).
- Последняя строка body — `this.advanceThrough(graph.startNodeId)` → `this.advanceThrough(startNodeId ?? graph.startNodeId)`.
- **НЕ трогать:** все остальные public methods (`chooseAnswer`, `enterFreeText`, `stepBack`, `completeSnippet`, `getState`), reset-логику (lines 55-63), `loopContextStack`, maxIterations.

**Analog 6 — existing start method (self, lines 50-66):**
```typescript
/**
 * Start a new protocol session.
 * Transitions from idle to at-node (or error if graph has no start node).
 */
start(graph: ProtocolGraph): void {
  this.graph = graph;
  this.currentNodeId = null;
  this.accumulator = new TextAccumulator();
  this.undoStack = [];
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
  this.loopContextStack = [];
  this.runnerStatus = 'at-node';
  // Auto-advance from the start node
  this.advanceThrough(graph.startNodeId);
}
```

**Target pattern (Phase 45 — single-line delta on signature + advanceThrough call; see RESEARCH.md Example 6):**
```typescript
start(graph: ProtocolGraph, startNodeId?: string): void {
  this.graph = graph;
  this.currentNodeId = null;
  this.accumulator = new TextAccumulator();
  this.undoStack = [];
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
  this.loopContextStack = [];
  this.runnerStatus = 'at-node';
  // Auto-advance from the explicit start or graph.startNodeId default
  this.advanceThrough(startNodeId ?? graph.startNodeId);
}
```

**Planner note:** Этот engine — pure (zero-Obsidian-import, NFR-01). Тестов на `protocol-runner.ts` много (Phase 43/44); если после изменения существующие тесты упадут — значит сигнатура где-то mocked, планировщик проверит.

---

### 7) `src/styles/editor-panel.css` (style, modified — append-only)

**Deltas (Phase 45 scope):**
- Добавить один блок `.rp-create-loop-btn { ... }` **в конец файла** (после line 168).
- Добавить маркер `/* Phase 45: loop quick-create button */` перед блоком.
- **НЕ трогать:** все существующие Phase 4/39/40/42 блоки (lines 1-168).

**Analog 7 — existing Phase 42 snippet button CSS (self, lines 132-162):**
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

.rp-create-snippet-btn:hover {
  filter: brightness(1.1);
}

.rp-create-snippet-btn:active {
  filter: brightness(0.95);
}

.rp-create-snippet-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: none;
}
```

**Target pattern (Phase 45 — append to end of file, line 169+):**
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

.rp-create-loop-btn:hover { filter: brightness(1.1); }
.rp-create-loop-btn:active { filter: brightness(0.95); }
.rp-create-loop-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: none;
}
```

**After CSS edit:** `npm run build` (Pitfall 9 RESEARCH.md) — регенерация `styles.css`.
**Landmine:** НЕ добавлять в `src/styles/loop-support.css` (он — runner picker scope, другая feature; CLAUDE.md CSS Architecture).

---

### 8) `src/__tests__/editor-panel-loop-form.test.ts` (test, NEW — D-02)

**Analog — full test file `src/__tests__/editor-panel-create.test.ts`:**

**Imports pattern (lines 1-11):**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Notice, Setting, TFile } from 'obsidian';
import { EditorPanelView } from '../views/editor-panel-view';

vi.mock('obsidian');
```

**Mock plugin setup pattern (lines 22-50):**
```typescript
function makeCanvasLeaf(filePath: string) {
  return { view: { file: { path: filePath } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  const canvasLeaf = makeCanvasLeaf('test.canvas');
  mockPlugin = {
    app: {
      vault: {},
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
        getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
      },
    },
    settings: {},
    canvasNodeFactory: { createNode: vi.fn().mockReturnValue(null) },
    canvasLiveEditor: { saveLive: vi.fn().mockResolvedValue(false) },
  };
  mockLeaf = { containerEl: {} };
  view = new EditorPanelView(
    mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
    mockPlugin as unknown as import('../main').default
  );
});
```

**Setting.prototype chainable mock (lines 346-367) — CRITICAL (RESEARCH.md Pitfall 2):**
```typescript
(view as unknown as { contentEl: { empty: () => void } }).contentEl = { empty: () => {} };

const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
SettingProto.setName = vi.fn(function (this: unknown) { return this; });
SettingProto.setDesc = vi.fn(function (this: unknown) { return this; });
SettingProto.setHeading = vi.fn(function (this: unknown) { return this; });
// For loop form which uses addTextArea — need mock that invokes cb with mock textarea:
const mockTextArea = {
  setValue: vi.fn(function (this: unknown) { return this; }),
  onChange: vi.fn(function (this: unknown) { return this; }),
};
SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (ta: unknown) => void) {
  cb(mockTextArea);
  return this;
});
```

**renderForm-style fake contentEl capture pattern (lines 410-430):**
```typescript
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
    // ...
  };
  return self;
};
(view as unknown as { contentEl: Record<string, unknown> }).contentEl = fakeNode();
```

**Test case skeletons (covers D-02 all 5 cases + D-03 button cases 6-7):**
```typescript
describe('Loop node form (LOOP-05 lock-in)', () => {
  // Case 1 — dropdown contains 'loop' option with label 'Loop'
  it('dropdown contains loop option with label "Loop"', () => {
    // Stub Setting.addDropdown to capture addOption calls
    const addOptionCalls: Array<[string, string]> = [];
    SettingProto.addDropdown = vi.fn(function (this: unknown, cb: (d: unknown) => void) {
      const mockDrop = {
        addOption: vi.fn(function (this: unknown, v: string, d: string) {
          addOptionCalls.push([v, d]); return this;
        }),
        setValue: vi.fn(function (this: unknown) { return this; }),
        onChange: vi.fn(function (this: unknown) { return this; }),
      };
      cb(mockDrop);
      return this;
    });
    // Call renderForm → assert addOptionCalls.find(([v]) => v === 'loop')[1] === 'Loop'
  });

  // Case 2 — kind='loop' renders "Loop node" heading + exactly one "Header text" Setting
  // Case 3 — NEGATIVE: form does NOT contain any Setting.setName('... iterations ...')
  // Case 4 — onChange syncs pendingEdits['radiprotocol_headerText'] AND pendingEdits['text']
  // Case 5 — saveNodeEdits with kind='loop' edits injects color:'1' via NODE_COLOR_MAP
  // Case 6 — onQuickCreate('loop') calls factory with kind='loop' (RESEARCH §2.1)
  // Case 7 — onQuickCreate('loop') flushes debounce (pattern from create.test.ts line 73-80)
});
```

**Pitfalls covered:**
- Pitfall 2 (Setting mock chain) — mock Setting.prototype.
- Pitfall 3 (contentEl undefined) — inject `{ empty: () => {} }`.
- Pitfall 4 (setIcon missing) — stub `renderToolbar` целиком (lines 434-437): `vi.spyOn(view, 'renderToolbar').mockImplementation(() => {})`.
- Pitfall 5 (case 'loop' vs 'loop-start' fall-through) — Case 2 asserts heading text exact === "Loop node", NOT "Legacy loop node".

---

### 9) `src/__tests__/node-picker-modal.test.ts` (test, NEW — D-19)

**Analog:** `runner-commands.test.ts` для dynamic-import smoke pattern + `node-picker-modal.ts:17-38` как SUT.

**Imports pattern (based on runner-commands.test.ts:1-5):**
```typescript
import { describe, it, expect } from 'vitest';
import { buildNodeOptions, type NodeOption } from '../views/node-picker-modal';
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode, RPNode } from '../graph/graph-model';
```

**Mock graph builder pattern (in-memory, no vi.mock of obsidian needed — buildNodeOptions is pure):**
```typescript
function makeGraph(nodes: RPNode[]): ProtocolGraph {
  const map = new Map<string, RPNode>();
  for (const n of nodes) map.set(n.id, n);
  return {
    canvasFilePath: 'test.canvas',
    nodes: map,
    edges: [],
    adjacency: new Map(),
    reverseAdjacency: new Map(),
    startNodeId: nodes[0]?.id ?? '',
  };
}

function loop(id: string, headerText: string): LoopNode {
  return { id, kind: 'loop', headerText, x: 0, y: 0, width: 0, height: 0 };
}
function question(id: string, text: string): QuestionNode {
  return { id, kind: 'question', questionText: text, x: 0, y: 0, width: 0, height: 0 };
}
// ... similar for snippet, text-block
```

**Test case skeletons (covers D-19 + RESEARCH.md pitfall 6/7):**
```typescript
describe('buildNodeOptions (LOOP-06)', () => {
  it('returns all 4 kinds (question, text-block, snippet, loop)', () => {
    const g = makeGraph([
      question('q1', 'Is there lesion?'),
      /* text-block, snippet, loop */
    ]);
    const opts = buildNodeOptions(g);
    expect(opts.map(o => o.kind).sort()).toEqual(['loop', 'question', 'snippet', 'text-block']);
  });

  it('excludes answer, start, free-text-input, legacy loop-start/loop-end', () => {
    // D-06 + Pitfall 6: осознанное отклонение answer/start/legacy
    const opts = buildNodeOptions(g);
    expect(opts.find(o => o.kind === 'answer' as never)).toBeUndefined();
    expect(opts.find(o => o.kind === 'start' as never)).toBeUndefined();
  });

  it('label falls back to id when text field empty (all 4 kinds)', () => {
    // D-07
  });

  it('sorts kind-groups in entry order: question → loop → text-block → snippet', () => {
    // D-08
  });

  it('within-group sort alphabetical via toLowerCase().localeCompare', () => {
    // D-08 (Pitfall 7 — use ASCII labels to avoid locale flakiness)
  });

  it('KIND_LABELS exhaustive — all 4 kinds mapped to Russian text', () => {
    // D-10: 'Вопрос', 'Текст', 'Сниппет', 'Цикл'
    // Since KIND_LABELS is module-internal const — either export for test, or probe
    // via renderSuggestion spy. Planner decides.
  });
});
```

**Landmine:** `KIND_LABELS` объявлен module-internal `const` (D-10). Для exhaustive-теста planner решит: (a) export const, или (b) test через `renderSuggestion` spy, который capture'ает создание `<small>` с text. Рекомендация — export, проще (CONVENTIONS.md не запрещает).

---

### 10) `src/__tests__/runner-commands.test.ts` (test, modified — extend D-20)

**Deltas (Phase 45 scope):**
- Оставить существующие 2 теста (lines 8-28) как smoke-assertions.
- Добавить новый `it(...)` (после текущих) который импортирует `buildNodeOptions` и делает stronger assertion (вызов с mock graph + проверка `loop` option).
- Добавить `it(...)` который grep'ом проверяет main.ts на точную строку `'start-from-node'` (без `radiprotocol-` префикса) — Pitfall 10.

**Analog — current file (self, lines 7-29):**
```typescript
describe('Runner commands (RUN-10, UI-04)', () => {
  it('RUN-10: node-picker-modal exports NodePickerModal (RED until Plan 03)', async () => {
    await expect(import('../views/node-picker-modal')).resolves.toHaveProperty('NodePickerModal');
  });
  // ...
});
```

**Target delta (append new test inside existing describe):**
```typescript
it('RUN-10-P45: buildNodeOptions includes loop kind', async () => {
  const { buildNodeOptions } = await import('../views/node-picker-modal');
  // Construct minimal graph with a loop node → assert option.kind === 'loop'
  // See node-picker-modal.test.ts for full mock-graph builder
});

it('NFR-06: start-from-node command id has no plugin prefix', async () => {
  // Read src/main.ts text, grep for exact 'start-from-node' string
  const fs = await import('node:fs');
  const path = await import('node:path');
  const mainTs = fs.readFileSync(
    path.join(__dirname, '..', 'main.ts'),
    'utf-8'
  );
  expect(mainTs).toContain(`id: 'start-from-node'`);
  expect(mainTs).not.toContain(`id: 'radiprotocol-start-from-node'`);
});
```

---

## Shared Patterns

### Shared 1 — `getLeavesOfType('canvas')` ∩ `getMostRecentLeaf()` (active canvas discovery)

**Source:** `src/views/editor-panel-view.ts:54-57`
**Apply to:** `main.ts:handleStartFromNode` (Phase 45 new method)
```typescript
const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
if (!canvasLeaf) return;  // + Notice('Open a canvas first.')
```

### Shared 2 — live-JSON preferred over disk read

**Source:** `src/views/runner-view.ts:78-88`
**Apply to:** `main.ts:handleStartFromNode` (RESEARCH.md Example 5)
```typescript
const liveJson = this.canvasLiveEditor.getCanvasJSON(canvasPath);
let content: string;
if (liveJson !== null) {
  content = liveJson;
} else {
  const file = this.app.vault.getAbstractFileByPath(canvasPath);
  if (!(file instanceof TFile)) { new Notice('Canvas file not found.'); return; }
  content = await this.app.vault.read(file);
}
```
Rationale: избегает stale read в окне между `canvas.requestSave()` и flush на disk (BUG-02/03 pattern).

### Shared 3 — registerDomEvent for DOM lifecycle

**Source:** `src/views/editor-panel-view.ts:859, 865, 874, 882`
**Apply to:** Phase 45 new loop button in renderToolbar
```typescript
this.registerDomEvent(lBtn, 'click', () => { void this.onQuickCreate('loop'); });
```
NOT `lBtn.addEventListener(...)` — Obsidian ItemView tears down registered listeners on destroy (CONCERNS.md WR-01 Phase 39 anti-pattern fix).

### Shared 4 — `setIcon(span, 'icon-name')` for Lucide icons

**Source:** `src/views/editor-panel-view.ts:857, 863, 872, 879`
**Apply to:** Phase 45 loop button
```typescript
const lIcon = lBtn.createSpan();
setIcon(lIcon, 'repeat');   // D-CL-01 default
```
Import already present in file (line 1). `setIcon` **отсутствует в `__mocks__/obsidian.ts`** (RESEARCH.md Pitfall 4) — loop-form.test.ts должен stub-ить `renderToolbar` целиком.

### Shared 5 — phase comment markers

**Source:** existing phase comments throughout codebase (e.g. `src/styles/editor-panel.css` `/* Phase 39: ... */`, `/* Phase 42: ... */`; `src/canvas/node-color-map.ts:21` inline `// Phase 43 D-12 ...`)
**Apply to:** ALL Phase 45 new code blocks — префиксить комментарием:
- TS: `// Phase 45 (LOOP-05): ...` или `// Phase 45 (LOOP-06): ...`
- CSS: `/* Phase 45: loop quick-create button */`

### Shared 6 — command id без plugin prefix (NFR-06)

**Source:** `src/main.ts:46-81` — все существующие `addCommand` блоки имеют голые id (`'run-protocol'`, `'validate-protocol'`, `'open-snippet-manager'`, `'open-node-editor'`).
**Apply to:** Phase 45 new `start-from-node` command (D-12). Test assertion в `runner-commands.test.ts` (D-20).

---

## No Analog Found

Пусто. Каждый Phase 45 файл имеет внутрикодовый аналог (либо self-reference в том же файле, либо sibling тест-файл). Planner не нуждается в RESEARCH.md code examples как primary source — они уже дублируют то, что показано в реальном коде.

---

## Metadata

**Analog search scope:**
- `src/views/*.ts` — все view-layer файлы (editor-panel, runner, node-picker-modal, snippet-fill-in, resume-session, snippet-manager, canvas-selector, canvas-switch).
- `src/canvas/*.ts` — canvas-IO слой (live-editor, node-factory, color-map).
- `src/runner/protocol-runner.ts` — pure engine.
- `src/main.ts` — plugin entry.
- `src/styles/*.css` — all per-feature CSS.
- `src/__tests__/*.test.ts` — sibling test patterns (especially `editor-panel-create.test.ts` как near-exact аналог для `editor-panel-loop-form.test.ts`).
- `src/__mocks__/obsidian.ts` — mock capabilities проверены (SuggestModal, Setting, ItemView — есть; setIcon, registerDomEvent — отсутствуют).

**Files scanned:** 14 source files + 3 test files + 1 mock file + 3 .planning docs = 21.
**Pattern extraction date:** 2026-04-18

---

*Phase: 45-loop-editor-form-picker-color-map*
*Pattern map by: gsd-pattern-mapper / Claude Opus 4.7 (1M context)*
