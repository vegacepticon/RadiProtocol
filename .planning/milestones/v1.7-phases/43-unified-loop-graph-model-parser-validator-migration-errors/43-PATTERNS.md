# Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors — Pattern Map

**Mapped:** 2026-04-17
**Phase directory:** `.planning/phases/43-unified-loop-graph-model-parser-validator-migration-errors/`
**Files analyzed:** 14 source touchpoints + 6 fixtures/tests
**Analogs found:** 14 / 14 (все source-правки имеют close analog в существующем коде; fixtures — прямое зеркало существующих `loop-body.canvas` / `loop-start.canvas`).

---

## File Classification

| Файл (будет изменён / создан) | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/graph/graph-model.ts` | model (type definitions) | transform (discriminated union) | `SnippetNode` / `TextBlockNode` / `LoopStartNode` в том же файле | exact |
| `src/graph/canvas-parser.ts` | parser | transform (JSON → typed) | `case 'text-block'` / `case 'question'` / `case 'loop-start'` в том же switch | exact |
| `src/graph/graph-validator.ts` | validator | batch (sweep nodes → errors[]) | Checks 4, 5, 6 в том же validator | exact |
| `src/canvas/node-color-map.ts` | config map | static Record | текущий `NODE_COLOR_MAP` | exact |
| `src/sessions/session-model.ts` | model (persisted types) | transform | `PersistedLoopContext` в том же файле | exact |
| `src/sessions/session-service.ts` | service (load/validate) | file I/O + validation | `validateSessionNodeIds` (same file) | exact |
| `src/runner/runner-state.ts` | model (runtime types) | transform | `AtNodeState`, `UndoEntry` (same file) | exact |
| `src/runner/protocol-runner.ts` | service (state machine) | event-driven | `advanceThrough()` switch, `chooseLoopAction()` (same file) | exact |
| `src/views/runner-view.ts` | view (build-time type check only) | request-response | `case 'loop-end'` в `switch (node.kind)` (same file) | partial (dead-code removal только) |
| `src/settings.ts` | config (no-op in Phase 43) | — | — | N/A (no change) |
| `src/__tests__/fixtures/unified-loop-valid.canvas` (new) | fixture | static JSON | `loop-body.canvas`, `branching.canvas` | role-match |
| `src/__tests__/fixtures/unified-loop-missing-exit.canvas` (new) | fixture | static JSON | `loop-start.canvas` (малый канвас с одним loop-узлом) | role-match |
| `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` (new) | fixture | static JSON | `branching.canvas` (несколько исходящих edges) | role-match |
| `src/__tests__/fixtures/unified-loop-no-body.canvas` (new) | fixture | static JSON | `linear.canvas` (минимальный happy-path) | role-match |
| `src/__tests__/fixtures/loop-start.canvas` (keep, reassign) | fixture | static JSON | self (migration-error test case) | exact |
| `src/__tests__/fixtures/loop-body.canvas` (keep, reassign) | fixture | static JSON | self (migration-error test case) | exact |
| `src/__tests__/graph-validator.test.ts` | test | arrange-act-assert | существующие `describe('loop validation')` / `describe('error detection')` блоки | exact |
| `src/__tests__/runner/protocol-runner.test.ts` | test (it.skip markers) | n/a | `describe('loop support (LOOP-01 through LOOP-05, RUN-09)')` | self |
| `src/__tests__/runner/protocol-runner-session.test.ts` | test (it.skip markers) | n/a | `describe('Loop context stack survives session round-trip (SESSION-05)')` | self |
| `src/__tests__/session-service.test.ts` | test | arrange-act-assert | `describe('validateSessionNodeIds() (SESSION-03)')` | exact |

---

## Pattern Assignments

### `src/graph/graph-model.ts` (model, transform)

**Analog:** тот же файл — `SnippetNode` / `TextBlockNode` / `QuestionNode` (closest shape к будущему `LoopNode`: ровно один string payload поверх `RPNodeBase`), плюс существующие `LoopStartNode` / `LoopEndNode` (целиком удаляются, D-03).

**RPNodeKind union pattern** (`graph-model.ts:4-12`):
```ts
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'
  | 'text-block'
  | 'loop-start'
  | 'loop-end'
  | 'snippet';  // Phase 29
```

**Single-string-payload node pattern — для нового `LoopNode`** (`graph-model.ts:28-31`, `QuestionNode`):
```ts
export interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
}
```

Та же структура для `TextBlockNode.content` (строка, всегда defined, normalized `''` в парсере):
```ts
// graph-model.ts:48-53
export interface TextBlockNode extends RPNodeBase {
  kind: 'text-block';
  content: string;
  snippetId?: string;
  radiprotocol_separator?: 'newline' | 'space';
}
```

**Legacy interfaces to DELETE целиком** (`graph-model.ts:55-65`):
```ts
export interface LoopStartNode extends RPNodeBase {
  kind: 'loop-start';
  loopLabel: string;
  exitLabel: string;
  maxIterations: number;
}

export interface LoopEndNode extends RPNodeBase {
  kind: 'loop-end';
  loopStartId: string;
}
```

**RPNode union** (`graph-model.ts:91-99`) — убираются `| LoopStartNode | LoopEndNode`, добавляется `| LoopNode`:
```ts
export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode
  | SnippetNode;  // Phase 29
```

**LoopContext shape — rename `loopStartId` → `loopNodeId`** (`graph-model.ts:81-89`):
```ts
export interface LoopContext {
  /** ID of the loop-start node that opened this frame */
  loopStartId: string;
  /** 1-based iteration counter (starts at 1 on first entry) */
  iteration: number;
  /** Full text snapshot captured immediately before entering the loop body.
   *  Used to restore accumulated text if the user steps back past the loop entry point. */
  textBeforeLoop: string;
}
```

**Notes for planner:**
- **D-02**: новый `LoopNode` — только `kind: 'loop'` + `headerText: string`. Зеркалит `QuestionNode.questionText`, НЕ `SnippetNode.subfolderPath?: string | undefined` (у нас `headerText` всегда строка).
- **D-CL-05**: если legacy-kinds сохраняем как parseable (D-06), можно (a) переименовать в `LegacyLoopStartNode` / `LegacyLoopEndNode` + пометить `@deprecated`, или (b) оставить `LoopStartNode` / `LoopEndNode` имена c `@deprecated` JSDoc. Рекомендованный вариант по naming-ясности — (a) новые имена с префиксом `Legacy`; но если оставить старые имена, D-11 `nodeLabel()` и downstream ещё проще написать.
- **Pitfall (STATE.md #10):** `maxIterations` поле удаляется вместе c `LoopStartNode` — никогда не переносить в `LoopNode`.
- **CLAUDE.md rule — never remove code you didn't add**: `FreeTextInputNode` (строки 40-46) остаётся в файле до Phase 46, не трогать.
- **Discriminated exhaustiveness side-effect**: удаление `'loop-start'` / `'loop-end'` из `RPNodeKind` форсит TS ошибки в каждом `switch (node.kind)` — это feature, не bug. Planner должен перечислить все use-sites (см. секцию «Shared Patterns» ниже).

---

### `src/graph/canvas-parser.ts` (parser, transform)

**Analog:** тот же файл — `case 'text-block'` (один string payload, normalized `''`) и `case 'loop-start'` / `case 'loop-end'` (destination kinds, удаляются / заменяются).

**Valid kinds list** (`canvas-parser.ts:159-162`) — добавить `'loop'`:
```ts
const validKinds: RPNodeKind[] = [
  'start', 'question', 'answer', 'free-text-input',
  'text-block', 'loop-start', 'loop-end', 'snippet',  // Phase 29
];
```

**Single-string-payload parser case — model для нового `case 'loop'`** (`canvas-parser.ts:225-238`, `TextBlockNode`):
```ts
case 'text-block': {
  const node: TextBlockNode = {
    ...base,
    kind: 'text-block',
    content: getString(props, 'radiprotocol_content', raw.text ?? ''),
    snippetId: props['radiprotocol_snippetId'] !== undefined
      ? getString(props, 'radiprotocol_snippetId')
      : undefined,
    radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
      : props['radiprotocol_separator'] === 'newline' ? 'newline'
      : undefined,
  };
  return node;
}
```

**Альтернативный аналог — `QuestionNode`** (`canvas-parser.ts:186-193`), самый близкий по shape (один string `questionText` + fallback на `raw.text`):
```ts
case 'question': {
  const node: QuestionNode = {
    ...base,
    kind: 'question',
    questionText: getString(props, 'radiprotocol_questionText', raw.text ?? ''),
  };
  return node;
}
```

**Discriminated normalization pattern** (`canvas-parser.ts:202-204`) — modelreference для strict enum; для `headerText` **не нужен** enum, достаточно `getString(props, 'radiprotocol_headerText', '')`:
```ts
radiprotocol_separator: props['radiprotocol_separator'] === 'space' ? 'space'
  : props['radiprotocol_separator'] === 'newline' ? 'newline'
  : undefined,
```

**Legacy parser cases — D-06 REQUIRES сохранить их как parsing-valid** (`canvas-parser.ts:239-260`):
```ts
case 'loop-start': {
  const node: LoopStartNode = {
    ...base,
    kind: 'loop-start',
    loopLabel: getString(props, 'radiprotocol_loopLabel', 'Loop'),
    exitLabel: getString(props, 'radiprotocol_exitLabel', 'Done'),
    maxIterations: getNumber(props, 'radiprotocol_maxIterations', 50),
  };
  return node;
}
case 'loop-end': {
  const loopStartId = getString(props, 'radiprotocol_loopStartId');
  if (!loopStartId) {
    return { parseError: `Loop-end node "${raw.id}" is missing radiprotocol_loopStartId` };
  }
  const node: LoopEndNode = {
    ...base,
    kind: 'loop-end',
    loopStartId,
  };
  return node;
}
```

**Notes for planner:**
- **D-05**: новый `case 'loop'` читает `radiprotocol_headerText` с fallback на `''` (НЕ на `raw.text` — symbolically отличаем «пустой header» от «нет поля»; но зеркалить `QuestionNode` с fallback на `raw.text ?? ''` тоже допустимо — planner решает).
- **D-06 + D-CL-05**: legacy `case 'loop-start'` и `case 'loop-end'` ОСТАЮТСЯ парсируемыми в Phase 43 — иначе validator увидит parseError вместо migration-error, а это даёт пользователю менее понятное сообщение. Parser должен вернуть node с `kind: 'loop-start'` / `kind: 'loop-end'` чтобы validator потом его поймал в Check-migration.
- **CLAUDE.md rule**: блок `case 'snippet'` (строки 261-280) не трогать — Phase 29 D-01/D-02 нормализация.
- **Import block** (`canvas-parser.ts:4-18`) — `LoopStartNode`, `LoopEndNode` должны остаться в импортах пока legacy parseable (D-06). Планировщику: также добавить `LoopNode` в import.
- **Pitfall**: relaxing `radiprotocol_loopStartId` check для `case 'loop-end'` (строка 251-253 возвращает `{ parseError }` если ID пустой) — НЕ удалять, legacy-узлы без loopStartId должны отбиться именно здесь. Migration-error покрывает только те legacy-узлы что прошли parsing.

---

### `src/graph/graph-validator.ts` (validator, batch)

**Analog:** тот же файл — существующие Check 3 (unreachable), Check 4 (cycles), Check 5 (dead-end questions), Check 6 (orphaned loop-end). Все используют pattern «sweep nodes by kind → push strings to `errors[]`».

**Existing `nodeLabel()` switch** (`graph-validator.ts:192-203`) — model для D-11 update:
```ts
private nodeLabel(node: RPNode): string {
  switch (node.kind) {
    case 'start': return `start (${node.id})`;
    case 'question': return node.questionText || node.id;
    case 'answer': return (node.displayLabel ?? node.answerText) || node.id;
    case 'free-text-input': return node.promptLabel || node.id;
    case 'text-block': return node.content.slice(0, 30) || node.id;
    case 'loop-start': return node.loopLabel || node.id;
    case 'loop-end': return `loop-end (${node.id})`;
    case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
  }
}
```

**Check 6 (orphaned loop-end) — удаляется целиком** (D-10) (`graph-validator.ts:73-84`):
```ts
// Check 6: Orphaned loop-end nodes
for (const [id, node] of graph.nodes) {
  if (node.kind === 'loop-end') {
    const matchingLoopStart = graph.nodes.get(node.loopStartId);
    if (!matchingLoopStart || matchingLoopStart.kind !== 'loop-start') {
      errors.push(
        `Loop-end node "${id}" references loop-start "${node.loopStartId}" which does not exist. ` +
        'Ensure every loop-end node has a matching loop-start node.'
      );
    }
  }
}
```

**Check 5 (dead-end questions) — прямой аналог для D-08 «no body-branch» проверки** (`graph-validator.ts:60-71`):
```ts
// Check 5: Dead-end questions — question nodes with no outgoing edges
for (const [id, node] of graph.nodes) {
  if (node.kind === 'question') {
    const outgoing = graph.adjacency.get(id);
    if (!outgoing || outgoing.length === 0) {
      errors.push(
        `Question "${node.questionText || id}" has no outgoing branches. ` +
        'Add at least one answer or snippet node connected from this question.'
      );
    }
  }
}
```

**Check 3 (unreachable) — pattern для перечисления nodes через `nodeLabel()` в ошибке** (`graph-validator.ts:42-53`):
```ts
if (unreachable.length > 0) {
  const nodeList = unreachable
    .map(id => {
      const node = graph.nodes.get(id);
      return node ? `"${this.nodeLabel(node)}"` : `"${id}"`;
    })
    .join(', ');
  errors.push(
    `${unreachable.length} unreachable node${unreachable.length > 1 ? 's' : ''} found: ${nodeList}. ` +
    'Connect these nodes to the protocol or remove them.'
  );
}
```

**Check 4 (cycles) — `detectUnintentionalCycles` loop-end marker** (`graph-validator.ts:128-187`):
```ts
private detectUnintentionalCycles(graph: ProtocolGraph, startNodeId: string): string[] {
  const errors: string[] = [];
  const color = new Map<string, 'white' | 'gray' | 'black'>();
  // ... (DFS setup)
        if (neighborColor === 'gray') {
          // Back-edge found — determine if this cycle passes through a loop-end node
          const cycleStart = pathStack.indexOf(neighborId);
          const cycleNodes = pathStack.slice(cycleStart);

          const passesViaLoopEnd = cycleNodes.some(id => {
            const n = graph.nodes.get(id);
            return n?.kind === 'loop-end';
          });

          if (!passesViaLoopEnd) {
            const cycleLabel = cycleNodes
              .map(id => {
                const n = graph.nodes.get(id);
                return n ? `"${this.nodeLabel(n)}"` : `"${id}"`;
              })
              .join(' → ');
            errors.push(
              `Unintentional cycle detected: ${cycleLabel}. ` +
              'Cycles must pass through a loop-end node. Remove the back-edge or use a loop-start/loop-end pair.'
            );
          }
        }
```

**Validator error tone reference — English, punctuation-complete** (examples from Check 1/5/6):
```
'No start node found. Add a node with radiprotocol_nodeType = "start".'
`Question "${node.questionText || id}" has no outgoing branches. Add at least one answer or snippet node connected from this question.`
`Loop-end node "${id}" references loop-start "${node.loopStartId}" which does not exist. Ensure every loop-end node has a matching loop-start node.`
```

**Notes for planner:**
- **D-CL-02 Order**: в `validate()` migration-check (D-07) ДОЛЖЕН идти ПЕРЕД LOOP-04 (D-08), иначе legacy узлы дадут ошибку «loop node не имеет ребра выход» в LOOP-04, которая сбивает с толку. Варианты: (i) новый Check 0 (migration) → existing Checks 1..5 → новый Check for LOOP-04; или (ii) Check 1..5 → Check 7 (migration) → early-return-if-errors → Check 8 (LOOP-04). Вариант (i) чище — migration блокирует всё остальное.
- **D-07 tone departure**: migration-error написан на русском. Это осознанный разнотон (STATE.md deferred list → i18n post-v1.7). Planner должен удерживать «английские Check'и vs. русский Migration Check» последовательно.
- **D-07 required literals**: `«loop-start»`, `«loop-end»`, `«loop»`, `«выход»` (в кавычках-ёлочках). Обязательно перечислить затронутые узлы через `nodeLabel()` pattern (Check 3 analog).
- **D-08 substructure**: три отдельные ошибки для D-08.1 (missing `выход`), D-08.2 (duplicate `выход` — перечислить `edge.id`s), D-08.3 (no body). Каждая — отдельный `errors.push()`, цикл по `node.kind === 'loop'`.
- **D-08.1 exact-match**: `edge.label === 'выход'` (case-sensitive, без `.trim()`). Это контракт, НЕ эвристика.
- **D-09 marker change**: `kind === 'loop-end'` → `kind === 'loop'` в `detectUnintentionalCycles` (строка 152). Сообщение: английское, замена `'loop-end node'` → `'loop node'`, `'use a loop-start/loop-end pair'` → `'use a loop node'`.
- **D-10**: Check 6 block (строки 73-84) целиком удаляется — `LoopEndNode` больше нет, поле `loopStartId` не существует.
- **D-11 `nodeLabel()` update**: добавить `case 'loop': return node.headerText || node.id`. Для legacy (если D-CL-05 вариант (a)) — добавить `case 'loop-start': return \`loop-start (${node.id})\`;` и `case 'loop-end': return \`loop-end (${node.id})\`;` (без `loopLabel`/`loopStartId` обращения — в migration-error planner хочет видеть ID узла, это нормально). Если D-CL-05 вариант (b), поля `loopLabel` и `loopStartId` ещё существуют — можно использовать `node.loopLabel || node.id` для `case 'loop-start'`.
- **CLAUDE.md rule — never remove code you didn't add**: Checks 1, 2, 3, 4, 5 и комментарий Phase 5 TODO (строки 86-93) не трогать.
- **Exhaustiveness**: validator `nodeLabel()` switch — TypeScript заставит планировщика закрыть все kinds иначе compile-error.

---

### `src/canvas/node-color-map.ts` (config, static Record)

**Analog:** сам файл — `NODE_COLOR_MAP` (только один в codebase).

**Full current content** (`node-color-map.ts:12-21`):
```ts
export const NODE_COLOR_MAP: Record<RPNodeKind, string> = {
  'start':           '4',  // green  — entry point ("go" semantics)
  'question':        '5',  // cyan   — information gathering
  'answer':          '2',  // orange — action / selection
  'free-text-input': '2',  // orange — user input action (same family as answer)
  'text-block':      '3',  // yellow — passive content
  'loop-start':      '1',  // red    — loop boundary
  'loop-end':        '1',  // red    — loop boundary (intentional share with loop-start, D-01)
  'snippet':         '6',  // purple — snippet node (Phase 29, D-11)
};
```

**Notes for planner:**
- **D-12**: удалить ключи `'loop-start'` и `'loop-end'`, добавить `'loop': '1'` (red). Комментарий — phase-marker: `// Phase 43 D-12: unified loop kind (see v1.7 LOOP-01).`
- `Record<RPNodeKind, string>` тип форсит exhaustiveness — TS ошибка при любом рассинхроне с union. Это — полезный tripwire.
- **CLAUDE.md**: комментарии-источники (`D-01`, `Phase 29, D-11`) сохранить; добавить свой `Phase 43 D-12` комментарий к новой записи `'loop'`. Не удалять комментарии, которые не добавляли.

---

### `src/sessions/session-model.ts` (model)

**Analog:** `PersistedLoopContext` в том же файле (целевое поле-переименование).

**Current shape** (`session-model.ts:9-13`):
```ts
export interface PersistedLoopContext {
  loopStartId: string;
  iteration: number;
  textBeforeLoop: string;
}
```

**Notes for planner:**
- **D-04 + D-13**: переименовать `loopStartId` → `loopNodeId`. Это break-compat для сохранённых сессий (D-13 признаёт).
- Эта же схема отражается в runtime `LoopContext` в `graph-model.ts:81-89` — надо держать shape синхронным (либо оба переименовать, либо оставить runtime `loopStartId` и добавить transformer; CONTEXT.md D-04 требует именно переименование на обеих сторонах).
- `PersistedUndoEntry` (`session-model.ts:19-23`) содержит `loopContextStack: PersistedLoopContext[]` — переименование поля прозрачно проникает через вложенный массив.

---

### `src/sessions/session-service.ts` (service, load + validate)

**Analog:** `validateSessionNodeIds` + `load()` в том же файле.

**Load path graceful-reject pattern** (`session-service.ts:56-73`):
```ts
async load(canvasFilePath: string): Promise<PersistedSession | null> {
  const filePath = this.sessionFilePath(canvasFilePath);
  const exists = await this.app.vault.adapter.exists(filePath);
  if (!exists) return null;

  try {
    const raw = await this.app.vault.adapter.read(filePath);
    const parsed = JSON.parse(raw) as PersistedSession;
    // Validate minimum required fields to detect truncated or corrupted JSON (SESSION-06)
    if (typeof parsed.version !== 'number' || typeof parsed.canvasFilePath !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    // JSON.parse failure — corrupt or sync-conflict file; degrade gracefully (SESSION-06)
    return null;
  }
}
```

**Existing `validateSessionNodeIds`** (`session-service.ts:116-148`):
```ts
export function validateSessionNodeIds(
  session: PersistedSession,
  graph: ProtocolGraph,
): string[] {
  const missing: string[] = [];

  // Check currentNodeId
  if (!graph.nodes.has(session.currentNodeId)) {
    missing.push(session.currentNodeId);
  }

  // Check all nodeIds in the undo stack + their loopContextStack loopStartIds
  for (const entry of session.undoStack) {
    if (!graph.nodes.has(entry.nodeId)) {
      missing.push(entry.nodeId);
    }
    for (const frame of entry.loopContextStack) {
      if (!graph.nodes.has(frame.loopStartId)) {
        missing.push(frame.loopStartId);
      }
    }
  }

  // Check loopStartIds in the top-level loopContextStack
  for (const frame of session.loopContextStack) {
    if (!graph.nodes.has(frame.loopStartId)) {
      missing.push(frame.loopStartId);
    }
  }

  // Remove duplicates without using Set (SESSION-07: prefer arrays)
  return missing.filter((id, idx) => missing.indexOf(id) === idx);
}
```

**Notes for planner:**
- **D-04**: field access `frame.loopStartId` → `frame.loopNodeId` (три call-sites: строки 133, 141).
- **D-13 (graceful reject)**: существующий `load()` уже возвращает `null` на corrupt / missing fields без throw. Для сессии со старым `loopStartId`-полем (без `loopNodeId`) planner может:
  - (опция A) добавить в load() guard `typeof parsed.loopContextStack[0]?.loopNodeId === 'string'` → возврат null;
  - (опция B) оставить load() как есть — `validateSessionNodeIds` вернёт `missing` (legacy узлов нет в новом графе, который валидатор уже отверг), runner увидит missing и очистит сессию через обычный flow.
- RunnerView уже очищает сессию через `sessionService.clear()` когда validator-ошибка есть (canvas валится перед стартом runner) — поэтому **опция B** минимальна и зеркалит существующий failure mode.
- **CLAUDE.md**: остальные методы (`save`, `clear`, `hasSession`, `sessionFilePath`) — не трогать.

---

### `src/runner/runner-state.ts` (model)

**Analog:** `UndoEntry` + `AtNodeState` в том же файле.

**Loop-related fields** (`runner-state.ts:23-27, 92-93`):
```ts
// AtNodeState
/** Iteration label for display when inside a loop body (e.g., "Lesion 2") (LOOP-04) */
loopIterationLabel?: string;
/** true when currentNodeId refers to a loop-end node — drives UI branch (LOOP-02) */
isAtLoopEnd?: boolean;

// UndoEntry
/** Deep snapshot of the loop context stack at the moment this entry was pushed.
 *  Must be a spread copy — NOT a live reference (LOOP-05, Pitfall 1 in RESEARCH.md). */
loopContextStack: LoopContext[];
```

**Notes for planner:**
- **D-14**: `isAtLoopEnd` поле семантически теряет смысл (`loop-end` kind больше нет). Planner решает:
  - (a) удалить поле `isAtLoopEnd` целиком из `AtNodeState` — но TS сломает use-sites в `runner-view.ts:402` и `protocol-runner.ts:374`. Не соответствует «минимальный stub» принципу.
  - (b) переименовать в `isAtLoopNode` — но Phase 44 заменит flag на полноценную picker-state; это лишняя работа.
  - (c) оставить `isAtLoopEnd?: boolean` (всегда `undefined` в Phase 43), пометить JSDoc `@deprecated Phase 44 заменит на picker state`. Compile зелёный, runtime просто никогда не выставляет в true.
  - Рекомендация — **(c)**.
- `loopIterationLabel` тоже лучше оставить без изменений (Phase 44 перенормирует).
- `UndoEntry.loopContextStack` — сохраняется, shape меняется через `LoopContext` renaming (D-04).

---

### `src/runner/protocol-runner.ts` (service, state machine)

**Analog:** `advanceThrough()` switch (строки 535-643), `chooseLoopAction()` (291-347), `resolveSeparator()` и др. в том же файле.

**`advanceThrough()` switch — текущие loop-start / loop-end cases** (`protocol-runner.ts:607-628`):
```ts
case 'loop-start': {
  // Push a new loop frame — iteration starts at 1 (LOOP-03)
  this.loopContextStack.push({
    loopStartId: cursor,
    iteration: 1,
    textBeforeLoop: this.accumulator.snapshot(),
  });
  // Follow the 'continue' edge into the loop body (LOOP-02)
  const continueNeighbor = this.edgeByLabel(cursor, 'continue');
  if (continueNeighbor === undefined) {
    this.transitionToError(`Loop-start node '${cursor}' has no 'continue' edge.`);
    return;
  }
  cursor = continueNeighbor;
  break;
}
case 'loop-end': {
  // Halt here — RunnerView will render "loop again / done" prompt (LOOP-02)
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;
}
```

**`advanceThrough()` default / exhaustiveness footer** (`protocol-runner.ts:635-641`):
```ts
default: {
  // TypeScript exhaustiveness check — should never reach here with correct graph
  const _exhaustive: never = node;
  void _exhaustive;
  this.transitionToError('Unknown node kind encountered during traversal.');
  return;
}
```

**`chooseLoopAction()` — полный loop runtime (удаляется / превращается в stub)** (`protocol-runner.ts:295-347`):
```ts
chooseLoopAction(action: 'again' | 'done'): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const node = this.graph.nodes.get(this.currentNodeId);
  if (node === undefined || node.kind !== 'loop-end') return;

  // Push undo entry BEFORE any mutation (LOOP-05)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  const frame = this.loopContextStack[this.loopContextStack.length - 1];

  if (action === 'again') {
    // ... maxIterations check, iteration++, follow 'continue' edge ...
  } else {
    // 'done' — pop the loop frame and follow loop-start's 'exit' edge
    this.loopContextStack.pop();
    const loopStartId = node.loopStartId;
    // ...
  }
}
```

**Stub-error precedent — `transitionToError`** (`protocol-runner.ts:668-671`):
```ts
private transitionToError(message: string): void {
  this.runnerStatus = 'error';
  this.errorMessage = message;
}
```

**`getState()` loop-label assembly** (`protocol-runner.ts:357-377`):
```ts
case 'at-node': {
  const topFrame = this.loopContextStack[this.loopContextStack.length - 1];
  const loopStartNode = topFrame !== undefined
    ? this.graph?.nodes.get(topFrame.loopStartId)
    : undefined;
  const loopLabel = loopStartNode?.kind === 'loop-start'
    ? loopStartNode.loopLabel
    : undefined;
  const loopIterationLabel =
    topFrame !== undefined && loopLabel !== undefined
      ? `${loopLabel} ${topFrame.iteration}`
      : undefined;
  return {
    status: 'at-node',
    currentNodeId: this.currentNodeId ?? '',
    accumulatedText: this.accumulator.current,
    canStepBack: this.undoStack.length > 0,
    loopIterationLabel,
    isAtLoopEnd: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'loop-end',
  };
}
```

**Notes for planner:**
- **D-14**: удалить `case 'loop-start'` и `case 'loop-end'` из `advanceThrough()` switch. Добавить `case 'loop':` с одним из:
  - (a) `throw new Error('Loop runtime implemented in Phase 44 (RUN-01..RUN-07).')` — throws, runner catches через Promise? Нет — `advanceThrough` не async, throw вылезет в RunnerView; это hard failure.
  - (b) `this.transitionToError('Loop runtime not yet implemented — см. Phase 44.'); return;` — soft, zero-Obsidian, build green, runner state = error, RunnerView отрендерит error panel. **Рекомендуется**.
  - (c) `const _: never = node;` — не сработает, у нас `node` НЕ never в new world (kind 'loop' exists).
- **D-14**: удалить метод `chooseLoopAction()` целиком (и его вызовы из `runner-view.ts:433, 439`). НО: тесты `protocol-runner.test.ts:467, 479, 505, 521, 525` вызывают `chooseLoopAction` — они будут помечены `.skip` (D-18), но TypeScript всё равно компилирует их. **Нужно** либо (i) оставить `chooseLoopAction` как no-op stub с `@deprecated`, либо (ii) `vi.mock`-stub в тестах, либо (iii) удалить метод + skip-тесты действительно `.skip` на уровне `describe.skip` перед `beforeEach`, чтобы их тело не компилировалось... последнее невозможно — TS компилит всё. Рекомендация: **опция (i)** — метод остаётся, тело превращается в `// Phase 44 TODO` + `this.transitionToError('...')`.
- **D-04**: `getState()` assembly (строка 360-368) ссылается на `topFrame.loopStartId` и `loopStartNode.loopLabel` — оба исчезают. Упрощение: `loopIterationLabel = topFrame ? \`${headerText} ${topFrame.iteration}\` : undefined` где `headerText` читается из `graph.nodes.get(topFrame.loopNodeId)` если `kind === 'loop'`, иначе `undefined`. Или ещё проще — в Phase 43 оставить `loopIterationLabel: undefined`, Phase 44 напишет полноценный label.
- **D-04**: все `loopStartId` field accesses меняются на `loopNodeId`:
  - `protocol-runner.ts:86, 145, 174, 241, 306` (undo.loopContextStack snapshots — shape дефинируется в `LoopContext` тип, авто-починится)
  - `protocol-runner.ts:317` (`loopStartNode = this.graph.nodes.get(frame.loopStartId)`) — ломается т.к. `chooseLoopAction` всё равно stub-нутый.
- **CLAUDE.md rule — never remove code you didn't add**: оставить `syncManualEdit()`, `chooseSnippetBranch()`, `pickSnippet()`, `completeSnippet()`, `stepBack()`, `setGraph()`, `restoreFrom()`, `getSerializableState()`, `TextAccumulator` usage. Phase 43 — ТОЛЬКО loop-specific surgery.
- **`edgeByLabel` helper** (строки 657-662) — оставить, Phase 44 переиспользует для выбора body / «выход» edge.
- **`ProtocolRunnerOptions.maxIterations`** (строки 8-9, 44) — оставить: это общий cap auto-advance, не loop-specific (см. тест `iteration cap (RUN-09)`). НЕ путать с `settings.maxLoopIterations` (которое уходит в Phase 44 RUN-07).

---

### `src/views/runner-view.ts` (view, dead-code-removal ONLY)

**Analog:** `case 'loop-end'` switch-arm в `switch (node.kind)` (строки 402-444).

**Current block — D-14 requires removal** (`runner-view.ts:402-444`):
```ts
case 'loop-end': {
  // Display iteration label if inside a loop body (LOOP-04)
  if (state.loopIterationLabel !== undefined) {
    questionZone.createEl('p', {
      text: state.loopIterationLabel,
      cls: 'rp-loop-iteration-label',
    });
  }

  // Resolve button labels from the matching loop-start node
  const matchingStart = this.graph.nodes.get(node.loopStartId);
  const againLabel = matchingStart?.kind === 'loop-start'
    ? matchingStart.loopLabel
    : 'Loop again';
  // ... buttons, chooseLoopAction('again'), chooseLoopAction('done') ...
}
```

**Notes for planner:**
- **CONTEXT.md** говорит `runner-view.ts` «НЕ меняется», но это про **error panel** (который рендерит `validator.errors[]`). Switch на `node.kind` — отдельная точка: `case 'loop-end'` стал недостижимым (kind исчез), TypeScript выдаст `Type '"loop-end"' is not assignable to type 'RPNodeKind'` — **строгая compile-ошибка**.
- **Минимальный fix**: удалить весь `case 'loop-end':` блок (строки 402-444). `default:` clause (446-454) подхватит любой неожиданный kind. Новый `case 'loop':` НЕ добавляем в Phase 43 — runner бросает error до рендера (D-14), switch не долетает.
- **Alternative**: добавить `case 'loop':` с `'Loop picker — Phase 44'` placeholder. Но CONTEXT.md явно говорит UI не трогать → только **удалить** `case 'loop-end'`.
- **CLAUDE.md rule — never remove code you didn't add**: все остальные cases (`question`, `free-text-input`, `default`) не трогать; не трогать `chooseSnippetBranch`, pickSnippet flow, error panel render, `autoSaveSession`. Удаление — строго `case 'loop-end'` блок.
- CSS: classes `rp-loop-btn-row`, `rp-loop-again-btn`, `rp-loop-done-btn`, `rp-loop-iteration-label` останутся в `src/styles/loop-support.css` — **НЕ удалять** (CLAUDE.md: append-only, never remove code you didn't add; Phase 45 вернёт picker UI).

---

### `src/settings.ts` (config — NO-CHANGE in Phase 43)

**D-15 explicit:** `maxLoopIterations` и UI-toggle остаются до Phase 44.

**Notes for planner:**
- Не трогать строки 9 (`maxLoopIterations: number;`), 27 (`maxLoopIterations: 50`), 128-143 (settings-tab UI).
- Runtime-использование поля ушло вместе с `chooseLoopAction()` stub — но тип и DEFAULT_SETTINGS остаются чтобы не ломать persisted user-settings.

---

### Fixtures (new)

**Analog for structure:** `loop-body.canvas` + `branching.canvas`. Ключевые поля: `id`, `type: "text"`, `text`, `x/y/width/height`, `radiprotocol_nodeType`, specific radiprotocol_* payload. Edges: `id`, `fromNode`, `toNode`, optional `label`.

**Reference for radiprotocol_headerText payload — shape-mirror `radiprotocol_questionText`** (from `branching.canvas:14-16`):
```json
{
  "id": "n-q1", "type": "text", "text": "Q1",
  "x": 0, "y": 120, "width": 200, "height": 60,
  "radiprotocol_nodeType": "question",
  "radiprotocol_questionText": "Q1"
}
```

**Reference for labeled edges — mirror `loop-body.canvas:24-25`**:
```json
{ "id": "e-ls1-body",  "fromNode": "n-ls1",   "toNode": "n-q1",  "label": "continue" },
{ "id": "e-ls1-exit",  "fromNode": "n-ls1",   "toNode": "n-tb1", "label": "exit" }
```

**Reference for minimal canvas — mirror `linear.canvas`**:
```json
{
  "nodes": [
    { "id": "n-start", ..., "radiprotocol_nodeType": "start" },
    { "id": "n-q1",    ..., "radiprotocol_nodeType": "question", "radiprotocol_questionText": "Q1" },
    { "id": "n-a1",    ..., "radiprotocol_nodeType": "answer", "radiprotocol_answerText": "A1" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" }
  ]
}
```

**D-17 required new fixtures** (имена — D-CL-03):

1. **`unified-loop-valid.canvas`** (validator passes):
   - Один loop узел + ровно один edge «выход» + ≥1 body edge.
   - Shape: start → loop (loop с `radiprotocol_headerText: "Lesion loop"`) → body-branch → back-edge-to-loop; loop -(«выход»)→ terminal text-block.

2. **`unified-loop-missing-exit.canvas`** (D-08.1):
   - loop узел без edge «выход» — только body-ветви.

3. **`unified-loop-duplicate-exit.canvas`** (D-08.2):
   - loop узел с двумя edges `label: "выход"` → каждый к разным terminal nodes.

4. **`unified-loop-no-body.canvas`** (D-08.3):
   - loop узел ТОЛЬКО c «выход» edge, без body-ветвей.

**Notes for planner:**
- `"выход"` — шесть Cyrillic символов `в-ы-х-о-д`. НЕ `"exit"`, НЕ `"Exit"`. JSON string literal кодируется как есть (UTF-8 файл).
- Все fixtures должны содержать валидный `start` узел — иначе validator завалится на Check 1 до LOOP-04.
- Cycle через loop узел (body → ... → loop) требует обновления `detectUnintentionalCycles` (D-09) — иначе `unified-loop-valid.canvas` провалится на cycle-error.
- **D-16**: `loop-start.canvas` и `loop-body.canvas` остаются. Planner выбирает: оставить имена или переименовать в `legacy-loop-start.canvas` / `legacy-loop-body.canvas` (D-CL-03) — во втором случае обновить имена в `graph-validator.test.ts` и `protocol-runner*.test.ts`.

---

### `src/__tests__/graph-validator.test.ts` (test)

**Analog:** существующие `describe('error detection')` / `describe('loop validation')` / `describe('GraphValidator — Phase 31')` блоки.

**Arrange-act-assert rhythm — inline JSON variant** (строки 71-88 — `multiple start nodes`):
```ts
it('detects multiple start nodes', () => {
  const multiStartJson = JSON.stringify({
    nodes: [
      { id: 'n-s1', type: 'text', text: 'S1', x: 0, y: 0, width: 100, height: 60,
        radiprotocol_nodeType: 'start' },
      // ...
    ],
    edges: []
  });
  const parser = new CanvasParser();
  const result = parser.parse(multiStartJson, 'multi-start.canvas');
  expect(result.success).toBe(true);
  if (!result.success) return;
  const validator = new GraphValidator();
  const errors = validator.validate(result.graph);
  expect(errors.some(e => e.toLowerCase().includes('multiple') || e.toLowerCase().includes('start'))).toBe(true);
});
```

**Fixture-based variant** (строки 22-27):
```ts
it('returns no errors for linear.canvas', () => {
  const graph = parseFixture('linear.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors).toHaveLength(0);
});
```

**Orphaned loop-end test — D-19 REMOVE** (строки 113-132):
```ts
it('detects orphaned loop-end node', () => {
  // ... loopStartId: 'nonexistent-id' ...
  expect(errors.some(e => e.toLowerCase().includes('loop') || e.toLowerCase().includes('orphan'))).toBe(true);
});
```

**Loop-body happy path test — D-19 REPLACE fixture-name if renamed** (строки 147-152):
```ts
it('valid loop-body graph passes validation with zero errors (LOOP-01)', () => {
  const graph = parseFixture('loop-body.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors).toHaveLength(0);
});
```

**Notes for planner:**
- **D-19 new tests**:
  - LOOP-04: 3 теста — missing-exit / duplicate-exit / no-body (fixture-based, каждый использует новый `unified-loop-*.canvas`).
  - MIGRATE-01: 2 теста — `loop-start.canvas` и `loop-body.canvas` дают migration-error (поменять текущий «returns no errors for loop-body» ассерт на «returns migration-error containing loop-start/loop-end/loop/выход literals»).
  - Cycle detection через loop (D-09): тест что cycle-проход-через-loop-node не флагается как unintentional cycle.
- **D-19 REMOVE**: тест `detects orphaned loop-end node` (строки 113-132) — Check 6 удаляется.
- **Assertion style для migration-error**: использовать `expect(errors.some(e => e.includes('loop-start') && e.includes('loop-end') && e.includes('loop') && e.includes('выход')))` чтобы закрепить обязательные лексемы (D-07 requirements (a)-(d)).
- **CLAUDE.md rule — never remove code you didn't add**: `describe('Phase 31')` и `describe('snippet node (Phase 29)')` не трогать.
- **Pitfall**: пустой (not containing cycle-through-loop) fixture для cycle-test пригодится. Можно использовать существующий `cycle.canvas` если он НЕ содержит loop-узлов.

---

### `src/__tests__/runner/protocol-runner.test.ts` (tests — it.skip markers)

**D-18 — указанные `it` блоки получают `.skip` + TODO comment**:

| Line | Current | Action |
|---|---|---|
| 257 | `it('transitions to error state when loop-start has no continue edge', …)` | `.skip` (пересматривается в Phase 44) |
| 457 | `it('runner halts at loop-end node after traversing loop body once (LOOP-02)', …)` | `.skip` |
| 467 | `it("chooseLoopAction('again') re-enters loop body and increments iteration to 2"…)` | `.skip` |
| 479 | `it("chooseLoopAction('done') exits loop and completes protocol (LOOP-02)"…)` | `.skip` |
| 490 | `it("getState() returns loopIterationLabel='Lesion 1' when halted at loop-end on iteration 1 (LOOP-04)"…)` | `.skip` |
| 501 | `it('stepBack() from iteration 2 first question restores iteration 1 loop-end state (LOOP-05)', …)` | `.skip` |
| 515 | `it('per-loop maxIterations cap transitions to error after exceeding limit (RUN-09)', …)` | `.skip` |

**Standard pattern**:
```ts
it.skip('runner halts at loop-end node after traversing loop body once (LOOP-02)', () => {
  // TODO Phase 44: rewrite for unified loop (RUN-01..RUN-07)
  // ... existing body unchanged ...
});
```

**Notes for planner:**
- `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)', ...)` — **альтернатива** пометить весь describe-блок, короче + оставляет тела для истории. Выбор planner'а (D-CL-04).
- **Pitfall**: тесты в `.skip` всё равно **компилируются**. Это значит `chooseLoopAction`, `maxIterations`, `loopLabel` use-sites в их телах ДОЛЖНЫ остаться type-valid. Это одна из причин, почему D-14 stub-метод `chooseLoopAction` должен остаться (а не быть удалён) — см. Notes в `protocol-runner.ts` секции.
- **CLAUDE.md**: вне loop-блоков (snippet tests, freetext tests, iteration-cap через text-block chain) — не трогать.

---

### `src/__tests__/runner/protocol-runner-session.test.ts` (tests — it.skip)

**D-18 target**: `describe('Loop context stack survives session round-trip (SESSION-05)')` (строка 319) → `describe.skip` или внутренний `it.skip` на строке 320.

**Current test body** (строки 319-348):
```ts
describe('Loop context stack survives session round-trip (SESSION-05)', () => {
  it('loopContextStack with iteration=2 is restored correctly and getState() reflects loopIterationLabel', () => {
    const graph = loadGraph('loop-body.canvas');
    // ... chooseLoopAction('again') on iteration-2 loop-end ...
    expect(state.loopIterationLabel).toBe('Lesion 2');
  });
});
```

**Notes for planner:**
- Session-tests вне loop-блока (SESSION-01..04, SESSION-06..07, validateSessionNodeIds) — работают на абстрактном shape и не ломаются от D-04 переименования `loopStartId → loopNodeId` ЕСЛИ тестовые fixtures внутри теста тоже обновить.
- `session-service.test.ts:195-197` имеет inline fixture со «старым» полем `loopStartId` — planner ОБЯЗАН обновить на `loopNodeId` чтобы тест продолжал компилиться против нового `PersistedLoopContext` shape. (Это то же изменение, только в другом файле теста.)

---

### `src/__tests__/session-service.test.ts` (test)

**D-04 compile-fix**: строки 137, 195, 197 содержат inline `loopStartId: ...` в `PersistedLoopContext` literals → переименовать в `loopNodeId`.

**D-20 new test — graceful reject легаси-сессии**:

**Analog arrange pattern** (строки 133-142):
```ts
it('returns missing loopStartId from loopContextStack when node removed', () => {
  const session = makeSession({
    currentNodeId: 'n-q1',
    undoStack: [],
    loopContextStack: [{ loopStartId: 'n-ls-deleted', iteration: 1, textBeforeLoop: '' }],
  });
  const graph = makeGraph(['n-q1']);
  const missing = validateSessionNodeIds(session, graph as never);
  expect(missing).toContain('n-ls-deleted');
});
```

**Suggested D-20 test shape** (graceful reject):
```ts
it('gracefully rejects session whose loopContextStack references a legacy loop-start ID (D-13)', () => {
  // Build a session object that references an ID not in the new graph
  // (canvas already failed validator before runner got here, so this is the backstop path).
  const session = makeSession({
    currentNodeId: 'n-q1',
    loopContextStack: [{ loopNodeId: 'n-legacy-ls1', iteration: 1, textBeforeLoop: '' }],
  });
  const graph = makeGraph(['n-q1']);
  const missing = validateSessionNodeIds(session, graph as never);
  expect(missing).toContain('n-legacy-ls1');
});
```

Либо — тест на `load()` path, возвращающий `null` для corrupt-schema session:
```ts
it('load() returns null when session JSON has legacy loopStartId without loopNodeId (D-13)', async () => {
  const legacyJson = JSON.stringify({
    version: 1,
    canvasFilePath: 'protocols/chest.canvas',
    // ... legacy shape with loopStartId instead of loopNodeId ...
  });
  // ... load, expect null ...
});
```

**Notes for planner:**
- Option-B из `session-service.ts` notes (валидатор → missing-id → существующий failure mode) — значит D-20 тест о validateSessionNodeIds достаточен; отдельная load() schema-check не обязательна.
- `makeSession()` factory (строки 28-43) — переиспользуется; `loopContextStack` override passable.
- **CLAUDE.md**: не трогать SESSION-01..07 тесты вне loop-reference строк.

---

## Shared Patterns (cross-cutting)

### Pattern: Zero-Obsidian-imports in `src/graph/` and `src/runner/`

**Source:** CONTEXT.md `<code_context>` "Zero-Obsidian-imports"; `graph-model.ts:2` comment; `canvas-parser.ts:2` comment; `graph-validator.ts:2` comment; `protocol-runner.ts:2` comment; `runner-state.ts:2` comment.

**Apply to:** all Phase 43 edits in `src/graph/` and `src/runner/`.

```ts
// graph/graph-model.ts
// Pure TypeScript types — zero Obsidian API imports (NFR-01, PARSE-06)
```

**Enforcement:** migration-error string literal на русском — это просто `string` constant, не нарушает чистоту. НЕ импортировать `Notice` / `App` / `TFile` в validator / runner / model / parser.

---

### Pattern: Discriminated-union exhaustiveness on `RPNodeKind`

**Source:** STATE.md Standing Pitfall implicit + CONTEXT.md "Established Patterns"; `protocol-runner.ts:635-641` (exhaustiveness assert), `graph-validator.ts:192-203` (`nodeLabel()` switch), `node-color-map.ts:12-21` (`Record<RPNodeKind, string>`).

**Apply to:** every `switch (node.kind)` and every `Record<RPNodeKind, …>` map.

**Use-sites to audit** (TypeScript will force on build):
1. `src/graph/graph-validator.ts:192-203` — `nodeLabel()` switch
2. `src/graph/canvas-parser.ts:181-280` — `parseNode()` switch
3. `src/runner/protocol-runner.ts:559-642` — `advanceThrough()` switch
4. `src/canvas/node-color-map.ts:12-21` — `NODE_COLOR_MAP` Record
5. `src/views/runner-view.ts:331-455` — `render()` switch (dead-code-removal here)
6. `src/views/editor-panel-view.ts:556-614` — `buildKindForm()` switch (Phase 45 territory — **NOT touched in Phase 43**, but TS will still complain about legacy cases. Planner must decide — если legacy kinds сохраняются через D-06 (вариант (b) D-CL-05), switch arms `case 'loop-start'` и `case 'loop-end'` остаются и компилируются; если вариант (a) — TS завалится. **Рекомендация: D-CL-05 вариант (b)** — сохранить имена `LoopStartNode` / `LoopEndNode` с `@deprecated` JSDoc — так Phase 43 не прорастает в editor-panel-view.ts.)
7. `src/views/node-picker-modal.ts:15` — comment mention (no code impact)

---

### Pattern: "Check N" numbered validator blocks with nodeLabel()-based node lists

**Source:** `graph-validator.ts:38-84` (Checks 3, 4, 5, 6).

**Apply to:** new Migration Check (D-07) and new LOOP-04 Check (D-08).

**Template**:
```ts
// Check N: <English or Russian description>
for (const [id, node] of graph.nodes) {
  if (node.kind === <target-kind>) {
    // <condition evaluation>
    if (<condition fails>) {
      errors.push(
        `<Prefix with "${this.nodeLabel(node)}"> ... <instruction>.`
      );
    }
  }
}
```

**D-07 variant — aggregate all legacy nodes into ONE message** (unlike Check 6 which pushed per-node):
```ts
// Check N: Migration — legacy loop-start / loop-end nodes
const legacyNodes: string[] = [];
for (const [id, node] of graph.nodes) {
  if (node.kind === 'loop-start' || node.kind === 'loop-end') {
    legacyNodes.push(`"${this.nodeLabel(node)}"`);
  }
}
if (legacyNodes.length > 0) {
  errors.push(
    `Канвас содержит устаревшие узлы loop-start/loop-end: ${legacyNodes.join(', ')}. ` +
    `Пересоберите цикл с единым узлом loop: метка «выход» на одном из исходящих рёбер обозначает ветвь выхода, остальные исходящие рёбра — тело цикла.`
  );
  // Option: early-return here so LOOP-04 doesn't also complain (D-CL-02)
  return errors;
}
```

**D-08 variant — three sub-checks per loop node**:
```ts
for (const [id, node] of graph.nodes) {
  if (node.kind !== 'loop') continue;

  const outgoing = graph.edges.filter(e => e.fromNodeId === id);
  const exitEdges = outgoing.filter(e => e.label === 'выход');
  const bodyEdges = outgoing.filter(e => e.label !== 'выход');

  // D-08.1
  if (exitEdges.length === 0) {
    errors.push(`Loop node "${this.nodeLabel(node)}" не имеет ребра «выход». …`);
  }
  // D-08.2
  if (exitEdges.length > 1) {
    const dupIds = exitEdges.map(e => e.id).join(', ');
    errors.push(`Loop node "${this.nodeLabel(node)}" имеет несколько рёбер «выход»: ${dupIds}. …`);
  }
  // D-08.3
  if (bodyEdges.length === 0) {
    errors.push(`Loop node "${this.nodeLabel(node)}" не имеет ни одной body-ветви. …`);
  }
}
```

---

### Pattern: WriteMutex / vault.adapter — untouched in Phase 43

**Source:** `session-service.ts:18, 41-49, 87-94`.

**Apply to:** Phase 43 session-service change (D-13 graceful reject) is **pure validation logic** — no new file I/O. `mutex`, `ensureFolderPath`, `vault.adapter.write/read/remove/exists` remain untouched. Do NOT introduce new vault operations.

---

### Pattern: Per-phase comment markers

**Source:** CLAUDE.md rule; examples in `node-color-map.ts:19` (`Phase 29, D-11`), `graph-validator.ts:92-93` (`Phase 5 — Check 7`), `graph-model.ts:12, 69-74` (`Phase 29, 31 D-01/D-04`).

**Apply to:** every new or changed block in Phase 43 — append `// Phase 43 D-<N>: <brief>` marker. Do NOT rewrite existing per-phase markers from earlier phases.

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| — | — | Все Phase 43 файлы имеют прямой analog в существующем codebase. Ни один файл не требует fallback к RESEARCH.md template patterns. |

---

## Metadata

**Analog search scope:**
- `src/graph/` (3 files, all read)
- `src/runner/` (3 files, all read)
- `src/sessions/` (2 files, all read)
- `src/canvas/` (1 file read — `node-color-map.ts`; `canvas-live-editor.ts` not relevant)
- `src/views/` (grepped — `runner-view.ts`, `editor-panel-view.ts`, `node-picker-modal.ts`)
- `src/settings.ts` (read — confirm D-15 no-change)
- `src/__tests__/fixtures/` (full `ls`; read `loop-body.canvas`, `loop-start.canvas`, `branching.canvas`, `linear.canvas`)
- `src/__tests__/` (full `ls`; read `graph-validator.test.ts`, `session-service.test.ts` key blocks, `runner/protocol-runner*.test.ts` loop blocks)

**Files scanned:** ~22 source files + fixtures.

**Pattern extraction date:** 2026-04-17.

**Cross-refs:**
- CLAUDE.md (CSS architecture — not relevant; never-remove rule — applies).
- `.planning/ROADMAP.md` Phase 43 success criteria — covered.
- `.planning/REQUIREMENTS.md` LOOP-01..04, MIGRATE-01..02 — covered.
- `.planning/STATE.md` Standing Pitfalls #8 (shared file hygiene), #10 (maxIterations forbidden) — flagged in Notes.
- `.planning/codebase/STRUCTURE.md` "New Node Type" 9-step checklist — steps 1-6 applicable in Phase 43; steps 7-9 (editor panel form, runner UI, dropdown option) — Phase 44/45.
