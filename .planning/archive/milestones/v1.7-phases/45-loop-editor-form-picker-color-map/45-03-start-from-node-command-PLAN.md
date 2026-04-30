---
phase: 45
plan: 03
type: execute
wave: 2
depends_on: [45-01]
files_modified:
  - src/runner/protocol-runner.ts
  - src/views/runner-view.ts
  - src/main.ts
  - src/__tests__/runner-commands.test.ts
autonomous: true
requirements: [LOOP-06]
tags: [phase-45, main, runner, start-from-node, command-wiring]

must_haves:
  truths:
    - "ProtocolRunner.start accepts optional startNodeId; when absent defaults to graph.startNodeId (preserves v1.0 contract)"
    - "RunnerView.openCanvas accepts optional startNodeId; when provided, bypasses session-resume modal, clears session, and starts runner from that node"
    - "Plugin registers addCommand with id 'start-from-node' (no plugin prefix per NFR-06) — visible in Ctrl+P as 'Start from specific node'"
    - "Command callback reads active canvas leaf, parses+validates graph (rejects legacy loop-start/loop-end via MIGRATE-01), opens NodePickerModal over active canvas, and routes user pick through RunnerView.openCanvas(path, nodeId)"
    - "Existing setState restoration path (openCanvas called with ONE argument) works unchanged — startNodeId param is optional (Pitfall 8)"
    - "runner-commands.test.ts asserts buildNodeOptions returns a loop option for a mixed-kind graph AND that main.ts contains literal string 'id: \\'start-from-node\\''"
  artifacts:
    - path: "src/runner/protocol-runner.ts"
      provides: "start(graph, startNodeId?) signature extension"
      contains: "startNodeId?: string, advanceThrough(startNodeId ?? graph.startNodeId)"
    - path: "src/views/runner-view.ts"
      provides: "openCanvas(filePath, startNodeId?) signature extension + explicit-start branch"
      contains: "startNodeId?: string, sessionService.clear, runner.start(graph, startNodeId)"
    - path: "src/main.ts"
      provides: "addCommand start-from-node + handleStartFromNode private method"
      contains: "'start-from-node', NodePickerModal, buildNodeOptions, GraphValidator"
    - path: "src/__tests__/runner-commands.test.ts"
      provides: "Extended tests: buildNodeOptions loop-kind smoke + grep-assert on command id without plugin prefix"
      contains: "buildNodeOptions, 'start-from-node', radiprotocol-"
  key_links:
    - from: "src/main.ts handleStartFromNode"
      to: "src/views/node-picker-modal.ts buildNodeOptions"
      via: "import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal'"
      pattern: "from '\\./views/node-picker-modal'"
    - from: "src/main.ts handleStartFromNode"
      to: "src/graph/graph-validator.ts"
      via: "import { GraphValidator } + new GraphValidator().validate(graph)"
      pattern: "GraphValidator"
    - from: "src/main.ts handleStartFromNode"
      to: "src/views/runner-view.ts"
      via: "runnerView.openCanvas(canvasPath, opt.id) in NodePickerModal callback"
      pattern: "openCanvas\\([^,]+, "
    - from: "src/views/runner-view.ts openCanvas"
      to: "src/runner/protocol-runner.ts start"
      via: "runner.start(graph, startNodeId) when startNodeId provided"
      pattern: "runner\\.start\\(graph, startNodeId\\)"
---

<objective>
Зарегистрировать команду `start-from-node` в plugin entry, оживить `NodePickerModal` (сейчас dead code — только RED-test импорт), и расширить `RunnerView.openCanvas` + `ProtocolRunner.start` optional параметром `startNodeId` для программатического старта runner'а с выбранного узла.

Purpose: LOOP-06 — вторая часть требования ("NodePickerModal lists loop as a first-class node kind"). Plan 01 переписал picker; этот план подключает его к команде в Obsidian command palette, что делает loop-узлы дискoverable через Ctrl+P. Технический SIDE EFFECT — startNodeId плумбинг через runner pipeline, что раскрывает v1.0 RUN-10 design intent (feature был недостроен).

Output:
- `ProtocolRunner.start(graph, startNodeId?)` — optional параметр через передачу в `advanceThrough`.
- `RunnerView.openCanvas(filePath, startNodeId?)` — optional параметр с explicit-start branch что bypass'ит session-resume.
- `main.ts` — new addCommand block + new `handleStartFromNode` private async method.
- `runner-commands.test.ts` — расширен 2 новыми тестами (buildNodeOptions loop smoke + grep NFR-06 assertion).

Depends on: **Plan 45-01 MUST complete first** — этот план импортирует `buildNodeOptions` с расширенной 4-kind сигнатурой из обновлённого `node-picker-modal.ts`.
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
@.planning/phases/45-loop-editor-form-picker-color-map/45-01-node-picker-modal-rewrite-PLAN.md
@src/main.ts
@src/views/runner-view.ts
@src/runner/protocol-runner.ts
@src/views/node-picker-modal.ts
@src/graph/graph-validator.ts
@src/__tests__/runner-commands.test.ts

<interfaces>
<!-- Current signatures BEFORE Phase 45 edits — extracted verbatim from source -->

ProtocolRunner.start (protocol-runner.ts:54-66):
```typescript
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

RunnerView.openCanvas (runner-view.ts:61-154) — summary: reads file, parses, validates, checks session, either resumes via modal OR calls `this.runner.start(graph)` on line 152. setState (line 56) calls `openCanvas(path)` with ONE argument — этот path MUST остаться valid (Pitfall 8).

RunnerView.openCanvas final line before change (line 152):
```typescript
this.runner.start(graph);
```

Current main.ts addCommand pattern (main.ts:46-81) — все 4 команды (run-protocol, validate-protocol, open-snippet-manager, open-node-editor) без plugin prefix (NFR-06).

Current main.ts imports (main.ts:1-13):
```typescript
import { Plugin, Notice, Menu, TFile } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from './views/editor-panel-view';
import { RunnerView, RUNNER_VIEW_TYPE } from './views/runner-view';
import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';
import { SnippetService } from './snippets/snippet-service';
import { SessionService } from './sessions/session-service';
import { WriteMutex } from './utils/write-mutex';
import { CanvasLiveEditor } from './canvas/canvas-live-editor';
import { CanvasNodeFactory } from './canvas/canvas-node-factory';
```

NodePickerModal constructor (node-picker-modal.ts:54):
```typescript
constructor(app: App, options: NodeOption[], onChoose: (option: NodeOption) => void) {
```

Existing active-canvas discovery pattern (editor-panel-view.ts:54-57 — reused in new method):
```typescript
const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
```

Live-JSON pattern (runner-view.ts:78-88):
```typescript
const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(filePath);
if (liveJson !== null) {
  content = liveJson;
} else {
  try {
    content = await this.app.vault.read(file);
  } catch { ... }
}
```

GraphValidator.validate(graph) returns `string[]` of errors (Phase 43 implementation).

Current runner-commands.test.ts (28 lines — whole file shown above in read_first).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend ProtocolRunner.start + RunnerView.openCanvas with optional startNodeId</name>
  <files>src/runner/protocol-runner.ts, src/views/runner-view.ts</files>
  <read_first>
    - src/runner/protocol-runner.ts:1-100 (ВКЛ. current start method + constructor)
    - src/views/runner-view.ts:1-200 (ВКЛ. current openCanvas full body + setState)
    - src/sessions/session-service.ts (grep для `.clear(filePath)` сигнатуры — подтвердить signature)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-14
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md Pitfall 8 (setState backward compat)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"5) src/views/runner-view.ts" + §"6) src/runner/protocol-runner.ts"
  </read_first>
  <behavior>
    - `new ProtocolRunner().start(graph)` (no second arg) — поведенчески identical pre-Phase 45: auto-advances from `graph.startNodeId`.
    - `new ProtocolRunner().start(graph, 'node-xyz')` — advances from 'node-xyz' instead of graph.startNodeId.
    - `new ProtocolRunner().start(graph, undefined)` — identical to no-second-arg case.
    - `RunnerView.openCanvas(filePath)` (no second arg) — поведенчески identical pre-Phase 45: session-resume path preserved (Obsidian setState restoration).
    - `RunnerView.openCanvas(filePath, 'node-xyz')` — bypass session-resume, clear session via `sessionService.clear(filePath)`, set graph, call `runner.start(graph, 'node-xyz')`, render. No resume modal opened.
    - Parse + validation errors STILL block explicit-start (consistent UX — D-CL-06): if parse fails or validator returns errors, `renderError` path runs and startNodeId is ignored (runner never started).
    - All existing ProtocolRunner tests (protocol-runner.test.ts, protocol-runner-session.test.ts, protocol-runner-loop-picker.test.ts) remain green — optional param is backward compatible.
    - All existing RunnerView tests remain green — setState + openCanvas(path) path unchanged.
  </behavior>
  <action>
## CLAUDE.md правило (ОБЯЗАТЕЛЬНО echo)

**"Never remove existing code you didn't add."** Эта задача меняет:
- ProtocolRunner.start: **1 строку в сигнатуре** (добавляется optional параметр) + **1 строку в body** (advanceThrough call).
- RunnerView.openCanvas: **1 строку в сигнатуре** + **~8 строк в body** (inserted branch перед session-resume path).
- Ничего не удаляется. Все остальные methods, state fields, session-resume logic, selector sync, error paths — byte-identical.

---

## Шаг 1 — ProtocolRunner.start (src/runner/protocol-runner.ts:54)

Найти **точную** текущую сигнатуру:
```typescript
  start(graph: ProtocolGraph): void {
```

Заменить на:
```typescript
  start(graph: ProtocolGraph, startNodeId?: string): void {
```

Найти **точную** текущую последнюю строку body (строка 65):
```typescript
    this.advanceThrough(graph.startNodeId);
```

Заменить на:
```typescript
    this.advanceThrough(startNodeId ?? graph.startNodeId);
```

JSDoc перед методом (строки 50-53):
```typescript
  /**
   * Start a new protocol session.
   * Transitions from idle to at-node (or error if graph has no start node).
   */
```

Обновить JSDoc чтобы упомянуть новый параметр:
```typescript
  /**
   * Start a new protocol session.
   * Transitions from idle to at-node (or error if graph has no start node).
   *
   * @param graph — protocol graph to traverse
   * @param startNodeId — Phase 45 (LOOP-06 / D-14): optional explicit starting node id.
   *                      When provided, auto-advance begins from this node instead of
   *                      graph.startNodeId. Used by the start-from-node command
   *                      (main.ts handleStartFromNode). When omitted, defaults to
   *                      graph.startNodeId for backward compatibility with v1.0 flow.
   */
```

**Всё остальное в protocol-runner.ts — не трогать.** Особенно `chooseAnswer`, `enterFreeText`, `stepBack`, `completeSnippet`, `chooseLoopBranch`, `advanceThrough`, `advanceOrReturnToLoop`, `maxIterations` (RUN-09 cycle guard — НЕ путать с RUN-07), все реset-поля в body.

## Шаг 2 — RunnerView.openCanvas (src/views/runner-view.ts:61)

Найти **точную** текущую сигнатуру (строка 61):
```typescript
  async openCanvas(filePath: string): Promise<void> {
```

Заменить на:
```typescript
  async openCanvas(filePath: string, startNodeId?: string): Promise<void> {
```

Найти **точную** секцию начиная со строки 102:
```typescript
    const graph = parseResult.graph;

    // ── SESSION-02: check for existing incomplete session ─────────────────────
    const session = await this.plugin.sessionService.load(filePath);
```

Вставить новый блок **между** `const graph = parseResult.graph;` и комментарием `// ── SESSION-02` (как дополнительные строки перед session-resume — НЕ заменять существующие, а встраивать ранний return):

```typescript
    const graph = parseResult.graph;

    // Phase 45 (LOOP-06 / D-14): explicit start-from-node path bypasses session resume.
    // When the start-from-node command callback supplies a startNodeId, clear any stale
    // session and begin the runner at the chosen node. This preserves the v1.0 contract
    // for openCanvas(path) setState restoration (Pitfall 8) by making startNodeId optional.
    if (startNodeId !== undefined) {
      await this.plugin.sessionService.clear(filePath);
      this.graph = graph;
      this.runner.start(graph, startNodeId);
      this.render();
      return;
    }

    // ── SESSION-02: check for existing incomplete session ─────────────────────
    const session = await this.plugin.sessionService.load(filePath);
```

**Остальное body функции openCanvas — НЕ ТРОГАТЬ.** Особенно:
- setState (строки 46-59) — продолжает вызывать `openCanvas(path)` без второго аргумента; это корректно.
- Session-resume modal path (строки 107-145) — byte-identical.
- Normal-start fallback на последних строках (147-153) — byte-identical.

## Шаг 3 — Verification

```bash
npx tsc --noEmit --skipLibCheck   # Exit 0
npm test -- --run src/__tests__/protocol-runner.test.ts
npm test -- --run src/__tests__/protocol-runner-session.test.ts
npm test -- --run src/__tests__/runner/protocol-runner-loop-picker.test.ts
```

Все три — должны остаться зелёными (optional param, default behaviour preserved).
  </action>
  <verify>
    <automated>npx tsc --noEmit --skipLibCheck && npm test -- --run src/__tests__/protocol-runner.test.ts src/__tests__/protocol-runner-session.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "start(graph: ProtocolGraph, startNodeId\\?: string): void" src/runner/protocol-runner.ts` returns exactly one match
    - `grep -n "this.advanceThrough(startNodeId \\?\\? graph.startNodeId)" src/runner/protocol-runner.ts` returns exactly one match
    - `grep -n "async openCanvas(filePath: string, startNodeId\\?: string)" src/views/runner-view.ts` returns exactly one match
    - `grep -n "this.runner.start(graph, startNodeId)" src/views/runner-view.ts` returns exactly one match
    - `grep -c "if (startNodeId !== undefined)" src/views/runner-view.ts` === 1 (early-return branch added)
    - `grep -c "sessionService.clear" src/views/runner-view.ts` >= 2 (original call on line 144 + new call in Phase 45 branch)
    - **Backward-compat invariants:**
      - `grep -c "void this.openCanvas(path)" src/views/runner-view.ts` === 1 (setState still calls with ONE arg — Pitfall 8)
      - `grep -c "this.runner.start(graph);" src/views/runner-view.ts` === 1 (normal-start fallback still uses ONE arg)
    - `grep -c "restoreFrom" src/views/runner-view.ts` >= 1 (session-resume modal path preserved)
    - `grep -c "new ResumeSessionModal" src/views/runner-view.ts` === 1 (session-resume not removed)
    - `npx tsc --noEmit --skipLibCheck` exit 0
    - `npm test -- --run src/__tests__/protocol-runner.test.ts` — все existing tests зелёные (backward compat)
    - `npm test -- --run src/__tests__/protocol-runner-session.test.ts` — все зелёные
    - `npm test -- --run src/__tests__/runner/protocol-runner-loop-picker.test.ts` — все зелёные (Phase 44 suite preserved)
    - **CLAUDE.md rule honoured:** no deletions from protocol-runner.ts или runner-view.ts; только 2 одностроковых changes + 1 multi-line insert в runner-view
  </acceptance_criteria>
  <done>
    ProtocolRunner.start и RunnerView.openCanvas приняли optional startNodeId параметр. Backward compatibility 100% — setState + все существующие callers работают неизменно. Runner + session tests зелёные.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Register start-from-node command + handleStartFromNode method in main.ts</name>
  <files>src/main.ts</files>
  <read_first>
    - src/main.ts (ВСЕ 277 строк)
    - src/views/node-picker-modal.ts (после Plan 01 edits — для confirming buildNodeOptions 4-kind API)
    - src/graph/graph-validator.ts:1-40 (для confirming `validate(graph): string[]` сигнатуры)
    - src/graph/canvas-parser.ts (сигнатура `parse(content, path): ParseResult`)
    - src/canvas/canvas-live-editor.ts (сигнатура `getCanvasJSON(path): string | null`)
    - src/views/runner-view.ts после Task 1 (подтвердить openCanvas 2-arg signature доступна)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-12, D-13, D-14, D-15, D-CL-04, D-CL-06
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md §"Code Examples" Example 5 (handleStartFromNode full body) + Pitfall 10 (command id no-prefix)
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"4) src/main.ts" (all 3 sub-analogs)
  </read_first>
  <behavior>
    - После `onload()` регистрирует команду `{ id: 'start-from-node', name: 'Start from specific node', callback: () => { void this.handleStartFromNode(); } }`.
    - `handleStartFromNode` method найдётся как приватный async method на RadiProtocolPlugin.
    - Callback flow: active-canvas-leaf discovery → если canvas не открыт `new Notice('Open a canvas first.')`; если canvas открыт — прочитать содержимое (prefer live-JSON, fallback vault.read); распарсить через this.canvasParser; validate через new GraphValidator(); при любой ошибке Notice+return; buildNodeOptions, если empty — Notice('No startable nodes in this canvas.')+return; activateRunnerView; получить runnerView instance; `new NodePickerModal(this.app, options, (opt) => { void runnerView.openCanvas(canvasPath, opt.id); }).open()`.
    - Command id literal в коде строки — `'start-from-node'`, НЕ `'radiprotocol-start-from-node'` (NFR-06).
    - Имеющиеся 4 addCommand блока (run-protocol, validate-protocol, open-snippet-manager, open-node-editor) — byte-identical.
    - Имеющиеся activate*, context-menu, onunload, insert, saveOutputToNote methods — без изменений.
  </behavior>
  <action>
## CLAUDE.md правило (ОБЯЗАТЕЛЬНО echo)

**"Never remove existing code you didn't add."** Эта задача:
- ДОБАВЛЯЕТ 3 новых import statement (append-only к import секции).
- ДОБАВЛЯЕТ один новый addCommand блок после open-node-editor (после строки 81).
- ДОБАВЛЯЕТ один новый private async method `handleStartFromNode` в class body (предлагаемая позиция — после `openEditorPanelForNode` на строке 276).
- НЕ ТРОГАЕТ строки 15-24 (class declaration + fields), строки 25-122 (onload body except наш insert), строки 124-128 (onunload), строки 130-276 (existing methods).

---

## Шаг 1 — Расширить импорты (src/main.ts:1-13)

Текущие 13 строк импортов — оставить как есть. **Добавить 2 новых import после строки 13**:

```typescript
// Phase 45 (LOOP-06): start-from-node command dependencies
import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal';
import { GraphValidator } from './graph/graph-validator';
```

`TFile`, `Notice` уже импортированы в строке 2 (`import { Plugin, Notice, Menu, TFile } from 'obsidian';`).

## Шаг 2 — Добавить addCommand блок

Найти **точную** позицию — конец блока open-node-editor (строки 76-81):
```typescript
    // Command: open-node-editor (EDIT-01 — opens editor panel; NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'open-node-editor',
      name: 'Open node editor',
      callback: () => { void this.activateEditorPanelView(); },
    });
```

Вставить **сразу после него** (между строкой 81 `});` и строкой 82 пустой + строкой 83 `// Settings tab`) — новый блок с пустой строкой-разделителем:

```typescript

    // Phase 45 (LOOP-06): start-from-node command (NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'start-from-node',
      name: 'Start from specific node',
      callback: () => { void this.handleStartFromNode(); },
    });
```

## Шаг 3 — Добавить handleStartFromNode private async method

Найти **точную** позицию — конец файла. Последний method — `openEditorPanelForNode` (строки 267-276):
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
}
```

Добавить **перед закрывающей `}` класса** (перед строкой 277 `}`) — новый method. Вставка с пустой строкой-разделителем:

```typescript

  /**
   * Phase 45 (LOOP-06, D-12/D-13): "Start from specific node" command callback.
   *
   * Flow:
   *   1. Discover active canvas leaf (editor-panel pattern).
   *   2. Read canvas content (live-JSON preferred, disk fallback — Pitfall BUG-02/03).
   *   3. Parse via CanvasParser; validate via GraphValidator.
   *   4. Any parse/validate error → Notice + abort (D-CL-06 — validator blocks start
   *      including MIGRATE-01 on legacy loop-start/loop-end).
   *   5. buildNodeOptions produces 4-kind picker list (Plan 45-01).
   *   6. Activate RunnerView (D-15), then open NodePickerModal. User's pick
   *      routes through RunnerView.openCanvas(path, startNodeId) which bypasses
   *      session resume and starts at the chosen node (Plan 45-03 Task 1).
   */
  private async handleStartFromNode(): Promise<void> {
    // 1. Find active canvas leaf — same pattern as editor-panel-view.ts:54-57
    const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
    const activeLeaf = this.app.workspace.getMostRecentLeaf();
    const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
    if (!canvasLeaf) {
      new Notice('Open a canvas first.');
      return;
    }

    const canvasPath = (canvasLeaf.view as { file?: { path: string } }).file?.path;
    if (!canvasPath) {
      new Notice('Active canvas has no file path.');
      return;
    }

    // 2. Read canvas content — prefer live in-memory JSON (BUG-02/03 avoidance).
    let content: string;
    const liveJson = this.canvasLiveEditor.getCanvasJSON(canvasPath);
    if (liveJson !== null) {
      content = liveJson;
    } else {
      const file = this.app.vault.getAbstractFileByPath(canvasPath);
      if (!(file instanceof TFile)) {
        new Notice('Canvas file not found.');
        return;
      }
      try {
        content = await this.app.vault.read(file);
      } catch {
        new Notice('Could not read canvas file.');
        return;
      }
    }

    // 3. Parse
    const parseResult = this.canvasParser.parse(content, canvasPath);
    if (!parseResult.success) {
      new Notice(`Canvas parse failed: ${parseResult.error}`);
      return;
    }

    // 4. Validate — MIGRATE-01 (legacy loop-start/loop-end) blocks start per D-CL-06
    const validator = new GraphValidator();
    const errors = validator.validate(parseResult.graph);
    if (errors.length > 0) {
      const firstError = errors[0] ?? 'Canvas validation failed.';
      new Notice(`Canvas validation failed: ${firstError}`);
      return;
    }

    // 5. Build picker options (4 kinds via Plan 45-01)
    const options = buildNodeOptions(parseResult.graph);
    if (options.length === 0) {
      new Notice('No startable nodes in this canvas.');
      return;
    }

    // 6. Open RunnerView (D-15) then picker modal
    await this.activateRunnerView();
    const runnerLeaves = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
    const runnerLeaf = runnerLeaves[0];
    if (runnerLeaf === undefined) return;
    const runnerView = runnerLeaf.view as RunnerView;

    new NodePickerModal(this.app, options, (opt) => {
      void runnerView.openCanvas(canvasPath, opt.id);
    }).open();
  }
```

## Детали реализации

1. **TFile в instanceof check** — `TFile` уже импортирован (строка 2), никаких новых imports для него не нужно.
2. **Notice wording** — английские (D-CL-04 consistency), параллелят существующие notices в main.ts (`'Could not open runner view: no available leaf.'`, `'Inserted into ${file.name}.'`).
3. **activateRunnerView await** — уже async method (строка 178), returns Promise<void>. Вызов перед picker'ом — по RESEARCH.md Open Question #4 (правильный порядок).
4. **runnerLeaf guard** — activateRunnerView может не найти leaf при экстремальных edge-cases; undefined guard + silent return (consistent с existing openEditorPanelForNode pattern на строке 272).
5. **Picker callback не await-ed** — `void runnerView.openCanvas(...)` — fire-and-forget внутри NodePickerModal's onChooseSuggestion callback; errors обрабатываются внутри openCanvas через renderError path.
6. **Никакого `this.activateRunnerView` внутри callback** — уже активировано ДО открытия picker'а (D-15). Picker callback только маршрутизирует к openCanvas с startNodeId.

## Imports order — важное замечание

Добавленные Phase 45 imports идут **после** всех существующих imports. Не сортировать alphabetically — project convention (CONVENTIONS.md) — group by origin: `obsidian` → project imports. Phase 45 imports добавляются в конец project imports group с Phase-45 comment marker.

## Post-edit verification

```bash
npx tsc --noEmit --skipLibCheck   # exit 0

# Lint на уровне grep
grep -n "id: 'start-from-node'" src/main.ts
grep -n "id: 'radiprotocol-start-from-node'" src/main.ts   # MUST return nothing
grep -n "handleStartFromNode" src/main.ts                   # 2 matches (1 в callback, 1 в method def)
grep -n "from './views/node-picker-modal'" src/main.ts

# Full suite
npm test -- --run
```
  </action>
  <verify>
    <automated>npx tsc --noEmit --skipLibCheck && grep -c "id: 'start-from-node'" src/main.ts && grep -c "id: 'radiprotocol-start-from-node'" src/main.ts; true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "id: 'start-from-node'" src/main.ts` === 1
    - `grep -c "name: 'Start from specific node'" src/main.ts` === 1
    - `grep -c "id: 'radiprotocol-start-from-node'" src/main.ts` === 0 (NFR-06 violation check)
    - `grep -c "handleStartFromNode" src/main.ts` === 2 (callback reference + method definition)
    - `grep -c "NodePickerModal" src/main.ts` >= 2 (import + new instance)
    - `grep -c "buildNodeOptions" src/main.ts` >= 2 (import + call)
    - `grep -c "new GraphValidator" src/main.ts` === 1
    - `grep -c "Open a canvas first" src/main.ts` === 1
    - `grep -c "No startable nodes in this canvas" src/main.ts` === 1
    - `grep -c "Canvas validation failed" src/main.ts` === 1
    - `grep -c "runnerView.openCanvas(canvasPath, opt.id)" src/main.ts` === 1
    - **Existing commands preserved:**
      - `grep -c "id: 'run-protocol'" src/main.ts` === 1
      - `grep -c "id: 'validate-protocol'" src/main.ts` === 1
      - `grep -c "id: 'open-snippet-manager'" src/main.ts` === 1
      - `grep -c "id: 'open-node-editor'" src/main.ts` === 1
    - **Existing methods preserved:**
      - `grep -c "async activateRunnerView" src/main.ts` === 1
      - `grep -c "async activateEditorPanelView" src/main.ts` === 1
      - `grep -c "async openEditorPanelForNode" src/main.ts` === 1
      - `grep -c "async insertIntoCurrentNote" src/main.ts` === 1
      - `grep -c "async saveOutputToNote" src/main.ts` === 1
    - `grep -c "this.registerEvent" src/main.ts` >= 1 (context menu registration preserved)
    - `npx tsc --noEmit --skipLibCheck` exit 0
    - `npm test -- --run` полный suite зелёный (preceding plans' gains preserved; нет регрессий от main.ts changes)
    - **CLAUDE.md rule honoured:** никаких deletions в main.ts; только 2 new import + 1 new addCommand + 1 new method
  </acceptance_criteria>
  <done>
    Команда `start-from-node` зарегистрирована в main.ts с правильным id (без plugin prefix). `handleStartFromNode` private method реализован по pattern from RESEARCH.md Example 5 — active-canvas discovery, live-JSON read, parse, validate (MIGRATE-01 blocks), picker open, user-pick routes через runnerView.openCanvas(path, nodeId). Все existing команды и methods preserved byte-identical.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend runner-commands.test.ts with buildNodeOptions loop smoke + NFR-06 grep assertion</name>
  <files>src/__tests__/runner-commands.test.ts</files>
  <read_first>
    - src/__tests__/runner-commands.test.ts (ВСЕ 29 строк — полный файл)
    - src/views/node-picker-modal.ts после Plan 01 edits
    - src/main.ts после Task 2 edits
    - .planning/phases/45-loop-editor-form-picker-color-map/45-CONTEXT.md D-20
    - .planning/phases/45-loop-editor-form-picker-color-map/45-RESEARCH.md Pitfall 10
    - .planning/phases/45-loop-editor-form-picker-color-map/45-PATTERNS.md §"10) src/__tests__/runner-commands.test.ts"
  </read_first>
  <behavior>
    - Existing test 1 (RUN-10: node-picker-modal exports NodePickerModal) — preserved (smoke import).
    - Existing test 2 (UI-04: GraphValidator dead-end errors) — preserved.
    - New test 3 (D-20 strengthen): imports buildNodeOptions dynamically, builds mock graph with 1 loop node, asserts buildNodeOptions(graph) returns array containing an option with kind='loop'.
    - New test 4 (Pitfall 10): reads src/main.ts as text file, asserts it contains `id: 'start-from-node'` AND does NOT contain `id: 'radiprotocol-start-from-node'`.
  </behavior>
  <action>
## Реализация

Расширение существующего файла. Правило: **не удалять** существующие 2 теста; добавить 2 новых `it(...)` внутри того же `describe('Runner commands (RUN-10, UI-04)', ...)` блока.

### Шаг 1 — Добавить import для fs/path

Текущий файл на строках 1-5:
```typescript
import { describe, it, expect } from 'vitest';
import { GraphValidator } from '../graph/graph-validator';
import { CanvasParser } from '../graph/canvas-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';
```

`fs` и `path` **уже импортированы** — используем существующие, не дублируем.

### Шаг 2 — Добавить 2 новых теста после существующих (перед закрывающим `});` блока describe)

Найти текущую закрывающую часть файла (строки 27-29):
```typescript
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

Вставить **между** `});` на строке 28 (конец UI-04 тест) и `});` на строке 29 (конец describe) — 2 новых теста с пустой разделяющей строкой:

```typescript
    expect(errors.length).toBeGreaterThan(0);
  });

  it('LOOP-06 (D-20): buildNodeOptions returns a loop option for a mixed-kind graph', async () => {
    // Phase 45 strengthens the Phase 4/RUN-10 smoke test: import buildNodeOptions
    // and verify the 4-kind union actually includes 'loop' on a real mixed graph.
    const { buildNodeOptions } = await import('../views/node-picker-modal');
    const { LoopNode } = await import('../graph/graph-model').then(m => ({ LoopNode: null as unknown as typeof m }));
    void LoopNode; // suppress unused — import is for type confirmation only

    const loopNode = {
      id: 'loop-1',
      kind: 'loop' as const,
      headerText: 'Lesion loop',
      x: 0, y: 0, width: 0, height: 0,
    };
    const graph = {
      canvasFilePath: 'test.canvas',
      nodes: new Map([[loopNode.id, loopNode]] as const),
      edges: [],
      adjacency: new Map(),
      reverseAdjacency: new Map(),
      startNodeId: loopNode.id,
    };
    const opts = buildNodeOptions(graph);
    const loopOpt = opts.find(o => o.kind === 'loop');
    expect(loopOpt).toBeDefined();
    expect(loopOpt?.id).toBe('loop-1');
    expect(loopOpt?.label).toBe('Lesion loop');
  });

  it('NFR-06 (Pitfall 10): start-from-node command id has no plugin prefix', () => {
    // Phase 45 Plan 03 Task 2 registers this command in main.ts. The id must NOT
    // carry a 'radiprotocol-' prefix — Obsidian already namespaces commands by
    // plugin manifest id (radiprotocol:start-from-node). Double prefix produces
    // radiprotocol:radiprotocol-start-from-node in Ctrl+P.
    const mainTsPath = path.join(__dirname, '..', 'main.ts');
    const mainTs = fs.readFileSync(mainTsPath, 'utf-8');
    expect(mainTs).toContain(`id: 'start-from-node'`);
    expect(mainTs).not.toContain(`id: 'radiprotocol-start-from-node'`);
  });
});
```

### Замечания

1. **Dynamic import `buildNodeOptions`** — сохраняется консистентность с Phase 4 pattern existing теста (строка 11 использует `await import(...)`). Это немного медленнее но упрощает file-integration тестирование без vi.mock'ов.
2. **Type assertion `kind: 'loop' as const`** — узкий literal для TypeScript типа LoopNode (kind поле discriminated union).
3. **Path resolution `path.join(__dirname, '..', 'main.ts')`** — `__dirname` в vitest работает через Node.js compat; resolution идёт к `src/main.ts` относительно `src/__tests__/`.
4. **Двойной assert на command id** — (a) positive contains, (b) negative NOT contains prefix — явно покрывает Pitfall 10 "regex collision" scenario.
5. **Existing describe name не меняем** — остаётся `describe('Runner commands (RUN-10, UI-04)', ...)`. Два новых `it(...)` внутри — тесты описывают LOOP-06 и NFR-06 через их names, этого достаточно.

## CLAUDE.md правило

Файл расширяется (2 новых `it(...)` блока), ничего не удаляется. Existing 2 теста preserved byte-identical. Imports preserved.

## Post-edit verification

```bash
npm test -- --run src/__tests__/runner-commands.test.ts
# Expected: 4 tests pass (2 pre-existing + 2 new)

npm test -- --run
# Full suite green (402 baseline + gains from Plan 01 + Plan 02 + +2 from this task)
```
  </action>
  <verify>
    <automated>npm test -- --run src/__tests__/runner-commands.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^  it(" src/__tests__/runner-commands.test.ts` === 4 (2 existing + 2 new)
    - `grep -n "LOOP-06 (D-20)" src/__tests__/runner-commands.test.ts` returns exactly one match
    - `grep -n "NFR-06 (Pitfall 10)" src/__tests__/runner-commands.test.ts` returns exactly one match
    - `grep -n "buildNodeOptions" src/__tests__/runner-commands.test.ts` — minimum 1 match (new test)
    - `grep -n "'start-from-node'" src/__tests__/runner-commands.test.ts` — minimum 1 match (grep test checks this literal в main.ts)
    - `grep -n "radiprotocol-start-from-node" src/__tests__/runner-commands.test.ts` — exactly 1 match (negative-assert)
    - **Existing tests preserved:**
      - `grep -c "RUN-10: node-picker-modal exports NodePickerModal" src/__tests__/runner-commands.test.ts` === 1
      - `grep -c "UI-04: GraphValidator" src/__tests__/runner-commands.test.ts` === 1
    - `npm test -- --run src/__tests__/runner-commands.test.ts` exit 0 — все 4 теста зелёные
    - `npm test -- --run` полный suite зелёный
    - **CLAUDE.md rule honoured:** existing 2 тесты не удалены и не изменены byte-wise
  </acceptance_criteria>
  <done>
    `src/__tests__/runner-commands.test.ts` содержит 4 теста (2 pre-existing + 2 new). LOOP-06 D-20 тест подтверждает что buildNodeOptions экспортирует loop option при mixed-kind graph. NFR-06 тест grep-асертит корректный command id в main.ts. Full suite зелёный.
  </done>
</task>

</tasks>

<verification>
```bash
# Type check
npx tsc --noEmit --skipLibCheck

# Targeted tests (all must pass)
npm test -- --run src/__tests__/protocol-runner.test.ts
npm test -- --run src/__tests__/protocol-runner-session.test.ts
npm test -- --run src/__tests__/runner/protocol-runner-loop-picker.test.ts
npm test -- --run src/__tests__/runner-commands.test.ts

# Full suite regression
npm test -- --run

# Grep invariants
grep -c "id: 'start-from-node'" src/main.ts                          # 1
grep -c "id: 'radiprotocol-start-from-node'" src/main.ts             # 0
grep -c "startNodeId" src/runner/protocol-runner.ts                  # >= 3 (signature + body + JSDoc)
grep -c "startNodeId" src/views/runner-view.ts                       # >= 3
grep -c "void this.openCanvas(path)" src/views/runner-view.ts        # 1 (setState backward compat)
grep -c "handleStartFromNode" src/main.ts                            # 2
grep -c "new NodePickerModal" src/main.ts                            # 1
grep -c "new GraphValidator" src/main.ts                             # 1
```

Expected: все exit 0; полный suite растёт на +2 passing (Task 3) сверх Plans 01/02. Backward compat 100% — все existing RunnerView + ProtocolRunner tests зелёные.
</verification>

<success_criteria>
- `ProtocolRunner.start(graph, startNodeId?)` — optional param, backward compatible.
- `RunnerView.openCanvas(filePath, startNodeId?)` — optional param, explicit-start branch bypasses session-resume; setState через 1-arg call unchanged.
- `main.ts` регистрирует `start-from-node` команду с правильным id (NFR-06); handleStartFromNode async method реализован.
- `runner-commands.test.ts` — 4 теста, все зелёные.
- `npm test -- --run` полный suite зелёный; regression 0.
- CLAUDE.md правила: existing addCommand блоки (run-protocol, validate-protocol, open-snippet-manager, open-node-editor) byte-identical; existing methods (activate*, openEditorPanelForNode, insertIntoCurrentNote, saveOutputToNote) preserved; ProtocolRunner.chooseAnswer/chooseLoopBranch/stepBack/completeSnippet/enterFreeText preserved; RunnerView session-resume logic preserved.
- LOOP-06 picker сторона финализирована: `NodePickerModal` → command → runner pipeline работает end-to-end (validated через manual UAT после merge всех 4 planов).
</success_criteria>

<output>
После завершения создать `.planning/phases/45-loop-editor-form-picker-color-map/45-03-SUMMARY.md`:

```markdown
# Phase 45, Plan 03 — start-from-node command + startNodeId plumbing: SUMMARY

**Completed:** YYYY-MM-DD
**Status:** Green
**Requirements:** LOOP-06 (command wiring completion)

## What shipped
- ProtocolRunner.start accepts optional startNodeId
- RunnerView.openCanvas accepts optional startNodeId + explicit-start branch
- main.ts: start-from-node command registered (NFR-06 compliant)
- main.ts: handleStartFromNode private method (active-canvas discovery → parse → validate → picker → runner)
- runner-commands.test.ts: +2 tests (D-20 buildNodeOptions loop smoke, NFR-06 grep)

## Decisions implemented
- D-12, D-13, D-14, D-15, D-CL-04, D-CL-06, D-20
- D-CL-06: validator errors (including MIGRATE-01) block start-from-node — consistent UX with RunnerView main flow

## Tests added
- 2 new tests in src/__tests__/runner-commands.test.ts

## Files modified
- src/runner/protocol-runner.ts (+1 signature line, +1 body line, +JSDoc)
- src/views/runner-view.ts (+1 signature line, +~8 body lines for explicit-start branch)
- src/main.ts (+2 import lines, +6 lines addCommand, +~60 lines handleStartFromNode method)
- src/__tests__/runner-commands.test.ts (+~30 lines, 2 new tests)

## Full suite
- After Plan 01+02: expected ~411 passed + 1 skipped
- After Plan 03: expected ~413 passed + 1 skipped / 0 failed

## Backward compatibility
- setState → openCanvas(path, undefined) — works unchanged
- ProtocolRunner.start(graph) — works unchanged
- All existing commands + methods preserved byte-identical
- NodePickerModal now wired from dead code into live command (CONCERNS.md §"Stub command left in production" resolved)
```
</output>
