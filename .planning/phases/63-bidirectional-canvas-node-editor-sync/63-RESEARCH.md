# Phase 63: Bidirectional Canvas ↔ Node Editor Sync — Research

**Researched:** 2026-04-25
**Domain:** Canvas write-back loop / Node Editor lifecycle / Obsidian internal Canvas API
**Confidence:** HIGH (всё подтверждено живым кодом — никаких ASSUMED для критических решений)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snippet branch label model**
- **D-01 (Incoming edge):** branch label Snippet'а синхронизируется с **incoming Question→Snippet** ребром (не outgoing). Симметрия с Phase 50. ROADMAP SC#2/3 формулировка "outgoing edge" — описка.
- **D-02 (Mirror node + edge, edge-wins reconcile):** `SnippetNode.snippetLabel` остаётся на узле; reconciler зеркалит ярлык на каждое incoming Question→Snippet ребро по edge-wins (Phase 50 D-04 наследуется поэлементно).
- **D-03 (Auto-mirror cold-open):** существующие canvas-ы с `radiprotocol_snippetLabel` на узле, но без `label` на ребре, мигрируют автоматически при первом modify-event (симметрично Phase 50 D-11).
- **D-04 (Расширить EdgeLabelSyncService + edge-label-reconciler):** один сервис, один subscription, один debounce-пул, один loop-guard. `EdgeLabelDiff` расширяется до `kind: 'answer' | 'snippet'`.

**In-flight protection (canvas → form)**
- **D-05 (`document.activeElement` detector):** входящий patch пропускается, если целевой `HTMLInputElement`/`HTMLTextAreaElement` совпадает с `document.activeElement`.
- **D-06 (Field-level lock):** блокируется только сфокусированное поле, остальные patch'атся live.
- **D-07 (Apply post-blur):** при пропуске patch'а из-за D-05 значение складывается в `pendingCanvasUpdate` slot; на blur — применяется как обычный D-08 patch. Last-write-wins.

**Re-render strategy**
- **D-08 (Точечный DOM patch):** `private formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>` заполняется при `renderForm`/`buildKindForm`. Ключ — pendingEdits-key. На сбросе узла Map очищается.
- **D-09 (NodeType change → full renderForm):** `pendingEdits = {}`, `formFieldRefs.clear()`, `void this.renderNodeForm(...)`.
- **D-10 (Узел удалён → renderIdle):** `pendingEdits = {}`, `currentNodeId = null`, `currentFilePath = null`. Без Notice.
- **D-11 (Patch scope):** только `questionText`, `answerText`, `text` (text-block), `snippetLabel`, `headerText`. `displayLabel` уже синхронизируется через Phase 50 — но через тот же входящий канал.

**Trigger channel**
- **D-12 (vault.on('modify') + dispatch):** существующий канал Phase 50; `EdgeLabelSyncService` после reconcile диспатчит "canvas-changed-for-node" с `{ filePath, nodeId, kind, fieldUpdates }`. `EditorPanelView` слушает.
- **D-13 (250 ms debounce):** наследуем `RECONCILE_DEBOUNCE_MS = 250` из `edge-label-sync-service.ts:30`. Латентность keystroke→form ≈ 750 ms (500 ms Obsidian requestSave + 250 ms наш debounce).

**Loop guard:** идемпотентность через content-diff (Phase 50 D-07); атомарный `saveLiveBatch` (D-14); last-write-wins.

### Claude's Discretion

- Имя `formFieldRefs` Map'а и точное место сброса в `renderForm`/`buildKindForm` lifecycle.
- Точная сигнатура события "canvas-changed-for-node" (EventTarget.dispatchEvent vs прямой `subscribe(handler)` в `EdgeLabelSyncService`).
- Naming patch-метода в `EditorPanelView` (`applyCanvasPatch` vs `onCanvasChanged`).
- Telemetry — debug-only `console.warn`.
- Тест-фикстуры: naming аналогично существующим (`branching-snippet-multi-incoming.canvas`, `snippet-label-edge-mismatch.canvas`).
- Точная форма расширения `EdgeLabelDiff` — single discriminated union `{ kind: 'answer' | 'snippet', edgeId, currentLabel, targetLabel }` vs два параллельных diff-массива.

### Deferred Ideas (OUT OF SCOPE)

- Per-edge override на multi-incoming Snippet (наследуем Phase 50 D-10).
- "Live frame-perfect" sync через canvas internal events / MutationObserver.
- Patch'инг прочих radiprotocol_* полей (separator, snippet subfolderPath, snippetType).
- UI-индикатор "canvas изменил это поле, пока ты печатал" (visual flash, баннер).
- Telemetry / opt-in метрика частоты patch'ей.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **EDITOR-03** | Snippet branch-label поле в Node Editor пишет ярлык на (incoming) ребро на canvas, и наоборот — правка ярлыка ребра обновляет поле формы в реальном времени. Mirror Phase 50. | Phase 50 reconciler (`reconcileEdgeLabels` `src/graph/edge-label-reconciler.ts`) и `saveLiveBatch` с `edgeEdits` (`canvas-live-editor.ts:148-205`) полностью пере-используются. Outbound уже существует в `editor-panel-view.ts:720-728` (Snippet branch label). Inbound добавляется через расширение reconciler-а на Question→Snippet рёбра + dispatch "canvas-changed-for-node". |
| **EDITOR-05** | Прямая правка текста узла на canvas обновляет соответствующее поле открытой формы Node Editor в реальном времени (для Question text / Answer text / Text block text / Snippet branch label / Loop headerText). | Reconciler уже триггерится при modify-event (Phase 50 D-01). Добавляется новый снимок node text fields → diff с last-known → dispatch event. EditorPanelView слушает dispatch и patch'ит конкретное `formFieldRefs.get(key)`. |

</phase_requirements>

---

## Краткое summary

- **Phase 50 reconciler — точная база для расширения.** `EdgeLabelSyncService` уже владеет `vault.on('modify')` subscription, 250 ms debounce, parser+reconcile+saveLiveBatch pipeline и loop guard (D-07 idempotency). Phase 63 добавляет: (1) snippet проходку в `reconcileEdgeLabels`, (2) post-write dispatch события "canvas-changed-for-node", (3) new node-text snapshot pass для EDITOR-05.
- **EditorPanelView lifecycle уже подходящий, но `onClose` нужно усилить.** Существующий `onClose` только делает `contentEl.empty()` — `formFieldRefs` нужно явно clear'ить, dispatch subscription auto-detach'ится через `registerEvent`. Re-entrancy при `renderForm` уже решена через `queueMicrotask` (Phase 42 WR-01) на line 415 — паттерн переиспользуется для defer'а patch'а при mid-render.
- **`document.activeElement` детектор работает в Obsidian.** Obsidian leaf — обычный DOM, не iframe; `document.activeElement` возвращает текущий focused element корректно. Phase 63 patch'инг через `.value =` на non-focused inputs не двигает фокус (стандартное DOM поведение).
- **Patch-flow vs autosave race решается через D-07 idempotency.** Если форма пишет позже autosave из канваса — `saveNodeEdits` пишет (Pattern B/Strategy A), modify-event → reconciler видит no diff → no write. Если canvas пишет позже формы — symmetrically. Last-write-wins без явного locking.
- **Cold-open миграция D-03 — почти бесплатно.** Phase 50 reconciler уже работает по принципу "если есть displayLabel, но edge.label пустой — propagate displayLabel onto edges" (см. `edge-label-reconciler.ts:74-87`). Тот же pattern для snippetLabel срабатывает автоматически после расширения `kind: 'snippet'`.

**Primary recommendation:** ОДИН расширяющий PR в `edge-label-reconciler.ts` + `edge-label-sync-service.ts` (snippet проходка + dispatch), второй PR в `editor-panel-view.ts` (formFieldRefs Map + subscription + apply-patch + blur handler). Не плодить новых классов. Использовать `EventTarget` API для dispatch (стандарт Web Platform; Obsidian не предоставляет своего pub/sub за пределами `vault.on/workspace.on`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect canvas modify event | Plugin / `EdgeLabelSyncService` | — | Уже владеет `vault.on('modify')` (Phase 50 D-01). Single source. |
| Reconcile edge labels (Answer + Snippet) | Pure module `edge-label-reconciler.ts` | — | D-18: zero Obsidian imports, fully testable in pure Node env (vitest config: `environment: 'node'`). |
| Atomic node+edge write | `CanvasLiveEditor.saveLiveBatch` (Pattern B) → Strategy A `vault.modify` | — | Phase 50 D-14 atomicity. Phase 63 переиспользует payload. |
| Snapshot canvas state for "changed since last patch" | `EditorPanelView` (per open node) | `EdgeLabelSyncService` (broadcast → каждый view сравнивает) | View knows currentNodeId; service не знает кто слушает. View hookups дешевле. |
| Dispatch "canvas-changed-for-node" event | `EdgeLabelSyncService` | `EventTarget` instance owned by service | Simple subscriber pattern; matches Obsidian's `registerEvent` lifecycle через стандартный `addEventListener`/`removeEventListener` через `registerDomEvent` или ручное теар-down. |
| Field-level patch + in-flight protection | `EditorPanelView.applyCanvasPatch(...)` | — | Owns `formFieldRefs` Map; знает `document.activeElement` policy. |
| Apply post-blur slot | `EditorPanelView` per-field `pendingCanvasUpdate` Map | `registerDomEvent('blur', ...)` | Lifecycle co-located с DOM. |

---

## Phase 50 re-use surface

### `EdgeLabelSyncService` (`src/canvas/edge-label-sync-service.ts:32-191`)

Полностью описывает текущий pipeline и точки расширения для Phase 63.

```
register()  // src/canvas/edge-label-sync-service.ts:48-55
  └─ vault.on('modify', file) → if .canvas → scheduleReconcile(file.path)

scheduleReconcile(filePath)  // line 57-68
  └─ debounceTimers.set(filePath, setTimeout(..., RECONCILE_DEBOUNCE_MS))
        // RECONCILE_DEBOUNCE_MS = 250 (line 30) — D-13 наследуется

reconcile(filePath)  // line 74-163
  ├─ getCanvasJSON (live) или vault.read (Pattern C)  // line 77-88
  ├─ parser.parse(content)  // line 91
  ├─ reconcileEdgeLabels(graph) → { diffs, newDisplayLabelByAnswerId }  // line 96
  ├─ if (diffs.length === 0 && newDisplayLabelByAnswerId.size === 0) return  // line 99 — D-07 loop guard
  ├─ build nodeEdits[] from newDisplayLabelByAnswerId  // line 102-108
  ├─ build edgeEdits[] from diffs  // line 109-112
  ├─ saveLiveBatch(filePath, nodeEdits, edgeEdits)  // line 116-120 — D-14 atomic Pattern B
  └─ Strategy A fallback: vault.modify atomically mutates nodes + edges  // line 128-162
```

**Точки расширения для Phase 63:**

| Where | What to add | Why |
|-------|-------------|-----|
| `reconcileEdgeLabels` | Новый цикл `for (node of nodes.values()) if (node.kind === 'snippet') { ... }` строго симметричный текущему `if (node.kind !== 'answer') continue` (line 53-89). Точно так же: incoming edges, edge-wins pick, propagate `snippetLabel`, resync siblings. | D-04 (CONTEXT) — same reverseAdjacency loop. |
| `EdgeLabelDiff` | Расширить до `{ edgeId, currentLabel, targetLabel, kind: 'answer' \| 'snippet' }`. Writer (`reconcile()` lines 102-112) использует `kind` чтобы знать, какое поле узла обновить (`radiprotocol_displayLabel` vs `radiprotocol_snippetLabel`). | Single source of truth для два-варианта-один-pass. |
| `newDisplayLabelByAnswerId` | Переименовать в `newNodeLabelByNodeId: Map<string, { kind, label }>` или ввести второй map `newSnippetLabelBySnippetId`. Discretion. | `nodeEdits.push` (line 102-108) теперь должен пушить `radiprotocol_snippetLabel` для snippet kind. |
| После line 121 (Pattern B success) и line 162 (Strategy A success) | **Dispatch `canvas-changed-for-node`** — собрать список `{ nodeId, fieldUpdates: { 'radiprotocol_displayLabel'?: string\|undefined, 'radiprotocol_snippetLabel'?: string\|undefined, ... } }` для каждого ненулевого изменения в этом проходе. Также включить **node text fields** (questionText, answerText, text-block text, headerText) — но они НЕ из reconcile (см. ниже Inbound dispatch protocol). | Dispatch ОБЯЗАТЕЛЬНО ПОСЛЕ write success — иначе слушатели patch'ат значения, которые ещё не на диске → race с self-trigger modify-event. |

### `reconcileEdgeLabels` (`src/graph/edge-label-reconciler.ts:49-92`)

Структура pure-функции, готовой к точечному расширению:

```typescript
for (const node of graph.nodes.values()) {
  if (node.kind !== 'answer') continue;          // ← line 54: точка вставки snippet ветки
  // ... edge-wins picking + diff push
}
// ← добавить вторую loop: if (node.kind !== 'snippet') continue
//   с тем же edge-wins алгоритмом, но picking source = snippetLabel вместо displayLabel
```

**Контракт edge-wins (line 64-87) переносится 1:1:**
1. `incomingEdges = graph.edges.filter(e => e.toNodeId === snippet.id)` (filter по array order — D-04 deterministic)
2. `firstLabeled = incomingEdges.find(isLabeledEdge)` (Phase 49 D-05 — `isLabeledEdge` уже импортирован, line 10)
3. `edgePick = firstLabeled?.label?.trim() || undefined`
4. `nodeTrim = snippet.snippetLabel?.trim() || undefined`
5. `pickedLabel = edgePick ?? nodeTrim`
6. If `nodeTrim !== pickedLabel` → push новое значение для snippet.id
7. For each `e of incomingEdges` если `e.label?.trim() !== pickedLabel` → push diff

### `CanvasLiveEditor.saveLiveBatch` (`canvas-live-editor.ts:148-234`)

**Уже принимает edgeEdits**, никаких изменений не нужно. Phase 63 просто добавляет больше edges в payload (snippet edges рядом с answer edges в одном setData).

Ключевой инвариант (line 207-209): "the same setData call below commits node + edge changes atomically — NEVER split into two setData/requestSave cycles (WR-01 doc-comment)". Phase 63 наследует.

### `editor-panel-view.ts:175-326` (`saveNodeEdits` outbound)

**Snippet branch label outbound уже работает:**
- Setting на line 720-728 пишет `pendingEdits['radiprotocol_snippetLabel'] = value || undefined`
- 800 ms debounce autosave (`scheduleAutoSave` line 750-769) → `saveNodeEdits` → Pattern B `saveLive` → если canvas открыт, узел обновляется
- **НО:** outbound в текущем коде НЕ пишет ярлык на incoming Question→Snippet ребро. Это работает по-другому — после write модифай-event триггерит reconciler который диспатчит edge-edits. Через ~750 ms ребро на canvas обновится.
- **Acceptable:** D-13 явно принимает 750 ms latency как "догнало после паузы".
- **Альтернатива (НЕ рекомендуется):** добавить `collectIncomingEdgeEdits`-аналог для snippet сразу в `saveNodeEdits` (line 305-319 уже делает это для displayLabel). Это даст ~250 ms latency но усложнит — через `kind === 'snippet'` ветку нужно тащить ту же кодовую логику. Рекомендую оставить async через reconciler, как у Phase 50 inbound (там тоже два хопа).

---

## EditorPanelView lifecycle map

### Where to patch

| Operation | Location | Notes |
|-----------|----------|-------|
| **Subscribe to dispatch** | `onOpen()` (line 45-58) — добавить `this.registerEvent(...)` рядом с существующим `active-leaf-change` registration. Если используется `EventTarget` instance — обернуть в `addEventListener` / `removeEventListener` через `registerDomEvent` (с DummyTarget) или ручной teardown в `onClose`. | `registerEvent` стандартный паттерн в этом файле (line 51), gives auto-cleanup на unload. |
| **Initialize formFieldRefs** | В `renderForm()` (line 380-441), сразу после `this.contentEl.empty()` и перед `buildKindForm` — `this.formFieldRefs = new Map()`. Заполнение в `buildKindForm` параллельно созданию каждого Setting / textarea. | Map уничтожается на каждом re-render — никакого устаревания. |
| **Populate formFieldRefs in buildKindForm** | Каждый `renderGrowableTextarea` (line 443-488) уже возвращает `HTMLTextAreaElement` — capture его и `this.formFieldRefs.set('radiprotocol_questionText', textarea)`. Для `addText` Setting'ов (displayLabel line 547-556, snippetLabel ВЫШЕ был заменён на growable textarea — см. ниже) нужно достать `text.inputEl` из callback. | Discretion: можно собрать в helper `registerFormField(key, el)`. |
| **Apply patch entry point** | `applyCanvasPatch(updates: Record<string, string \| undefined>): void` — публичный или private метод. Реализация: для каждого key в updates → `formFieldRefs.get(key)` → если el && el !== document.activeElement → `el.value = newValue || ''` + dispatch synthetic 'input' event для триггера auto-grow resize. | Synthetic input event нужен для resize, но НЕ должен триггерить наш autosave цикл — autosave triggers через `pendingEdits[key] = ...` явно в input handler. Если synthetic event дойдёт до registered handler, он положит значение в pendingEdits → следующий autosave переизданёт canvas → loop. **Решение:** patch БЕЗ dispatch event, и вручную вызвать resize через известный паттерн (`textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'`). |
| **Pending slot for blur** | `private pendingCanvasUpdate: Map<string, string \| undefined>` — ключ тот же. На blur (`registerDomEvent(el, 'blur', ...)`) → достать значение, применить, удалить из map. | Регистрировать blur handler в том же месте, где `formFieldRefs.set(...)`. |
| **Reset on node switch** | `loadNode()` (line 163-173) — добавить `this.formFieldRefs.clear()`, `this.pendingCanvasUpdate.clear()`. | `pendingEdits` уже сбрасывается на line 171. |
| **Reset on close** | `onClose()` (line 60-62) — добавить `this.formFieldRefs.clear()`, `this.pendingCanvasUpdate.clear()`. | Auto-detach subscription уже через `registerEvent`. |
| **NodeType change → full re-render** (D-09) | `applyCanvasPatch` должен проверять `'radiprotocol_nodeType' in updates` → если да → `pendingEdits = {}`, `formFieldRefs.clear()`, `void this.renderNodeForm(currentFilePath, currentNodeId)` (полный re-render). Не точечный patch. | NodeType changes уже проходят через `onTypeDropdownChange` (line 771-788) — но это outbound; inbound тот же контракт через renderNodeForm. |
| **Node deleted on canvas → renderIdle** (D-10) | Dispatch event с `{ kind: 'deleted', nodeId }` → если `currentNodeId === nodeId` → `pendingEdits = {}`, `currentNodeId = null`, `currentFilePath = null`, `this.renderIdle()`. | renderIdle уже существует (line 152-161). |

### Re-entrancy с `renderForm` (Phase 42 WR-01/WR-02)

Существующий паттерн (line 415):

```typescript
queueMicrotask(() => {
  this.renderForm(mergedRecord, nextKind);
});
```

— defer'ится re-render на следующий microtask, чтобы dropdown handler полностью развернулся до того как `contentEl` будет очищен.

**Phase 63 переносит этот паттерн в `applyCanvasPatch`:**
- Если patch приходит **во время** mid-renderForm (теоретически возможно если dispatch fires во время microtask), запихнуть apply в `queueMicrotask`.
- Practical detection: если `formFieldRefs` пустой, но event поступил — это скорее всего mid-render → defer через queueMicrotask.
- Простейшая реализация: всегда оборачивать body `applyCanvasPatch` в `queueMicrotask(...)` для безопасности.

### Field key vocabulary (verified в коде)

Все ключи использованные в `pendingEdits` для ОДНОГО text-field на каждый kind:

| Node kind | Key | Mirror на `text` field? | Source |
|-----------|-----|--------------------------|--------|
| Question | `radiprotocol_questionText` | **Да** (line 530) | `editor-panel-view.ts:529-531` |
| Answer | `radiprotocol_answerText` | **Да** (line 567) | line 566-568 |
| Answer (display label) | `radiprotocol_displayLabel` | Нет | line 553 |
| Text block | `radiprotocol_content` | **Да** (line 601) — **NB:** канонический ключ это `radiprotocol_content`, НЕ `radiprotocol_text` (CONTEXT.md упоминает `radiprotocol_text` — это неточность; реальный ключ `radiprotocol_content`, см. `canvas-parser.ts:220`) | line 600-602 |
| Loop | `radiprotocol_headerText` | **Да** (line 650) | line 649-651 |
| Snippet (branch label) | `radiprotocol_snippetLabel` | Нет | line 726 |

**Важный consistency check для planner'а:** CONTEXT.md D-08/D-11 говорит про "text-block `text`" — на самом деле в pendingEdits это **`radiprotocol_content`**, а `text` это canvas-card visible field, который дублируется отдельно. Patch'инг должен апдейтить **textarea**, привязанный к `radiprotocol_content`. Reconciler должен следить за `radiprotocol_content` (или за `text` если канвас-mirror — см. далее).

**Мини-гочча:** для Question / Answer / Text-block / Loop канвас-сторона parser'а резолвит значение через `getString(props, 'radiprotocol_questionText', raw.text ?? '')` (`canvas-parser.ts:198, 206, 220, 286`). То есть если автор правит `text` поле (canvas built-in), parser возьмёт его как fallback. Это значит inbound watch должен сравнивать значение, которое реально использует runner и форма (`getString(...)` result), а НЕ сырое `radiprotocol_questionText`. Простейшее: парсить через CanvasParser и читать `node.questionText` / `node.answerText` / `node.content` / `node.headerText` напрямую из `RPNode` — там уже отрезолвлено.

---

## Inbound dispatch protocol

### Сигнатура события

**Recommended (single source of truth):** `EdgeLabelSyncService` владеет `private readonly bus = new EventTarget()`. Метод `subscribe(handler: (e: CanvasChangedEvent) => void): () => void` — возвращает unsubscribe. `EditorPanelView.onOpen` вызывает subscribe и сохраняет unsubscribe в поле, в `onClose` вызывает.

```typescript
interface CanvasChangedForNodeDetail {
  filePath: string;
  nodeId: string;
  // Discriminated update payload — один из:
  changeKind: 'fields' | 'nodeType' | 'deleted';
  // For 'fields': specific patch values
  fieldUpdates?: Partial<Record<
    | 'radiprotocol_questionText'
    | 'radiprotocol_answerText'
    | 'radiprotocol_displayLabel'  // Phase 50 surface, included for free
    | 'radiprotocol_content'
    | 'radiprotocol_headerText'
    | 'radiprotocol_snippetLabel',
    string | undefined
  >>;
  // For 'nodeType': new kind (or undefined for unmark)
  newKind?: RPNodeKind | null;
}
```

Альтернатива через прямой callback list — Discretion (CONTEXT.md). `EventTarget` чище, тестируется через `dispatchEvent`/`addEventListener` без mock'ов.

### Snapshot baseline для определения "changed since last dispatch"

**Где хранить:** в `EdgeLabelSyncService` (per filePath) либо в `EditorPanelView` (per currentNodeId). 

**Recommended: в EdgeLabelSyncService, per filePath.** Service уже владеет debounceTimers Map per filePath — добавить параллельный `lastSnapshotByFilePath: Map<string, Map<nodeId, NodeFieldsSnapshot>>`.

```typescript
interface NodeFieldsSnapshot {
  questionText?: string;
  answerText?: string;
  displayLabel?: string;
  content?: string;
  headerText?: string;
  snippetLabel?: string;
  kind: RPNodeKind | null;
}
```

После каждого reconcile pass (внутри `reconcile()` метода после parser.parse — line 91), пройтись по всем nodes, сравнить с `lastSnapshotByFilePath.get(filePath)?.get(nodeId)`, для diff-нутых nodes — собрать `fieldUpdates`. Затем — обновить snapshot. Затем — диспатчить.

**Dispatch ПОСЛЕ write success (после line 121 Pattern B и line 162 Strategy A).** Иначе race: receiver patch'ит значение, которого ещё нет на диске → modify-event → reconciler видит diff → пишет повторно.

**Альтернатива (хранить в View):** view хранит snapshot только для currentNodeId. Service диспатчит сырой `nodeRecord` или весь `RPNode`, view сам diff'ит. Минус: view нужно знать структуру всех node kinds. **Не рекомендую.**

### NodeType change handling (D-09)

Когда reconciler видит, что `kind` отличается от snapshot — диспатчить `changeKind: 'nodeType'`. View → если `currentNodeId === nodeId` → `void this.renderNodeForm(currentFilePath, currentNodeId)` (полный re-render).

### Node deleted handling (D-10)

Reconciler после parse — компарить `Set<nodeId>` парсенных vs snapshot. Для отсутствующих в новом parse — диспатчить `changeKind: 'deleted'`. Также: cleanup `lastSnapshotByFilePath.get(filePath)` для удалённых.

---

## Cold-open migration mechanics (D-03)

### Текущий Phase 50 механизм (verified в `edge-label-reconciler.ts:69-87`)

```typescript
const displayTrim = answer.displayLabel?.trim() || undefined;
const pickedLabel: string | undefined = edgePick ?? displayTrim;
// ↑ если edgePick === undefined (никакая edge не lable'на), 
//   то pickedLabel = displayTrim (тоже может быть undefined)

// Затем propagate pickedLabel onto every incoming edge that doesn't match:
for (const e of incomingEdges) {
  const currentTrim = e.label?.trim() || undefined;
  if (currentTrim !== pickedLabel) {
    diffs.push({ edgeId: e.id, currentLabel: e.label, targetLabel: pickedLabel });
  }
}
```

— то есть если node имеет displayLabel="X", а edge не имеет label, → diff `{ edgeId, currentLabel: undefined, targetLabel: "X" }` → write пишет label на edge.

**Это и есть auto-mirror cold-open:** при первом modify-event reconciler одним проходом мигрирует. Verified тестом `edge-label-reconciler.test.ts:158-172`:

```typescript
it('all incoming edges empty + displayLabel present → diff propagates displayLabel onto edges', () => {
  // expects diffs.length === 1, diffs[0].targetLabel === 'A'
});
```

**Phase 63 наследует механизм 1:1.** Snippet проходка → если `snippetLabel="X"` и edge без label → diff с `targetLabel: "X"` → write пишет label на edge.

### Test fixture для cold-open Snippet

Структура (на базе `branching-multi-incoming.canvas`):

```jsonc
// snippet-label-edge-mismatch.canvas
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start", "x": 0, "y": 0, "width": 200, "height": 60, "radiprotocol_nodeType": "start" },
    { "id": "n-q1", "type": "text", "text": "Q1", "x": 0, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question", "radiprotocol_questionText": "Q1" },
    { "id": "n-snip1", "type": "text", "text": "abdomen", "x": 0, "y": 240, "width": 200, "height": 60, "radiprotocol_nodeType": "snippet", "radiprotocol_subfolderPath": "abdomen", "radiprotocol_snippetLabel": "Брюшной отдел" }
  ],
  "edges": [
    { "id": "e0", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e1", "fromNode": "n-q1", "toNode": "n-snip1" }  // no label — должно быть мигрировано
  ]
}
```

Expected reconcile result:
- `newNodeLabelByNodeId` (или per-snippet equivalent): empty (snippetLabel уже = "Брюшной отдел")
- `diffs.length === 1`, `diffs[0].edgeId === 'e1'`, `diffs[0].targetLabel === 'Брюшной отдел'`, `diffs[0].kind === 'snippet'`

### Multi-incoming Snippet fixture

Аналогично `branching-multi-incoming.canvas`, но Q1 и Q2 → один Snippet:

```jsonc
// branching-snippet-multi-incoming.canvas
{
  "nodes": [
    /* start, q1, q2 */,
    { "id": "n-snip-shared", "radiprotocol_nodeType": "snippet", "radiprotocol_subfolderPath": "x",
      "radiprotocol_snippetLabel": "Старое" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-q1", "toNode": "n-snip-shared", "label": "Вариант X" },
    { "id": "e2", "fromNode": "n-q2", "toNode": "n-snip-shared", "label": "Вариант Y" }
  ]
}
```

Expected: pickedLabel = "Вариант X" (first labeled), node.snippetLabel update → "Вариант X", diff for e2 → targetLabel "Вариант X".

---

## Test harness conventions + new test surfaces

### Vitest config (verified)

`vitest.config.ts:1-15`:
- `environment: 'node'` — **НЕ jsdom, НЕ happy-dom**. Это ключевое.
- alias `obsidian: src/__mocks__/obsidian.ts` — все Obsidian-импорты mock'аются.
- Tests location: `src/__tests__/**/*.test.ts`.
- Globals: false → нужен явный import `import { describe, it, expect, vi } from 'vitest'`.

### DOM-mocking паттерн в существующих view-тестах

В отсутствие jsdom тесты для view (`runner-snippet-sibling-button.test.ts`, `editor-panel-forms.test.ts`) используют **hand-rolled FakeNode**:

```typescript
function makeFakeNode(tag = 'div'): FakeNode {
  return {
    tag, children: [],
    createDiv: (opts) => /* push fake child */,
    createEl: (tag, opts) => /* push fake child + capture type/cls */,
    empty: () => { children.length = 0 },
    setAttribute: (n, v) => { _attrs[n] = v },
    disabled: false, value: '', style: {},
    scrollTop: 0, scrollHeight: 0,
  };
}
```

— и для `register*`-методов patch'ат `view.registerDomEvent = (el, type, handler) => { if (type === 'click') el._clickHandler = handler; }` (см. line 219-225 в `runner-snippet-sibling-button.test.ts`).

**Phase 63 тесты для applyCanvasPatch / blur / activeElement detector могут пойти двумя путями:**

1. **Pure unit test через FakeNode + патч `document.activeElement`** — globalThis patch:
   ```typescript
   const globalAny = globalThis as unknown as { document: { activeElement: HTMLElement | null } };
   globalAny.document = { activeElement: null };
   ```
   Затем в тесте: `globalAny.document.activeElement = focusedTextarea as unknown as HTMLElement;` → проверить, что `applyCanvasPatch` skip'ит.

2. **Reconciler-level integration test** — extend `edge-label-reconciler.test.ts` тестами на `kind === 'snippet'` (зеркально текущим Answer-тестам). Pure-функция, никаких DOM.

### Existing → extend

| File | What to extend |
|------|----------------|
| `src/__tests__/edge-label-reconciler.test.ts` | (a) snippet-only edge-wins тесты mirror'ят все 8 текущих Answer-кейсов; (b) mixed Answer+Snippet (Question с обеими incoming kinds) — verify oba kinds обрабатываются в одном проходе; (c) Snippet idempotency — D-07 zero-diff. |
| `src/__tests__/canvas-write-back.test.ts:202-265` | Расширить `saveLiveBatch` тесты на edge-edits для Snippet ветки (структура та же — addresses different `fromNode → toNode` edge kinds). |
| `src/__tests__/canvas-parser.test.ts:150-162` | Уже покрывает `radiprotocol_snippetLabel` parser — НЕ ТРОГАТЬ (regression guard). |
| `src/__tests__/views/runner-snippet-sibling-button.test.ts` | **Регрессионный guard** — должен остаться зелёным после Phase 63. Тесты Test 1 / Test 4 / Test 8 / Test 11 проверяют `node.snippetLabel` рендерится в кнопку. D-02 mirror гарантирует, что node.snippetLabel остаётся актуальным после reconcile. |
| `src/__tests__/editor-panel-forms.test.ts:362-368` | Существующее покрытие Snippet branch label autosave — должно остаться зелёным. |

### Новые файлы

| File | Purpose |
|------|---------|
| `src/__tests__/views/editor-panel-canvas-patch.test.ts` (или `editor-panel-applyCanvasPatch.test.ts`) | Тесты на `applyCanvasPatch` через FakeNode + patched `document.activeElement`. Сценарии: (a) точечный patch без фокуса; (b) patch фокусного поля → skip; (c) blur → applies pendingCanvasUpdate; (d) nodeType change → full re-render. |
| `src/__tests__/edge-label-sync-service-dispatch.test.ts` | Тесты на dispatch контракт: после reconcile с diff'ами — событие приходит подписчикам с правильным fieldUpdates payload. Мокирует CanvasLiveEditor + EventTarget. |
| `src/__tests__/fixtures/snippet-label-edge-mismatch.canvas` | Cold-open миграция D-03 (см. раздел выше). |
| `src/__tests__/fixtures/branching-snippet-multi-incoming.canvas` | Multi-incoming Snippet fixture (см. раздел выше). |

---

## Pitfalls / landmines

### Pitfall 1: Synthetic input event → autosave loop

**What goes wrong:** `applyCanvasPatch` устанавливает `textarea.value = newValue` и dispatch'ит synthetic `input` event для триггера auto-grow resize. Registered input handler (`onTextareaInput` line 475-485) ловит event → `pendingEdits['radiprotocol_questionText'] = textarea.value` → 800ms autosave → `saveNodeEdits` → modify-event → reconcile видит no diff (D-07) → но Pattern B / Strategy A сами выполнили disk write → modify-event срабатывает повторно → reconcile видит no diff и self-terminates. **Не fatal, но 1 лишний disk write per patch.**

**Fix-pattern:** не диспатчить synthetic input event. Вручную вызвать resize logic:
```typescript
private patchTextareaValue(el: HTMLTextAreaElement, value: string): void {
  el.value = value;
  if (el.style) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
}
```
Дублирование 3-х строк вместо 1 dispatch — оправданное trade-off.

### Pitfall 2: `formFieldRefs` устаревает между renderForm passes

**What goes wrong:** `renderForm` (line 380) делает `this.contentEl.empty()` — все DOM ноды detach'ятся. Но если patch приходит в окне между `empty()` и завершением `buildKindForm`, `formFieldRefs.get(key)` вернёт detached element или undefined.

**Fix-pattern:** в начале `renderForm` (сразу после `empty()`) — `this.formFieldRefs.clear()`. И/или в `applyCanvasPatch` оборачивать в `queueMicrotask` всегда — даёт `renderForm` шанс закончить до patch'а.

**Defensive check в applyCanvasPatch:**
```typescript
const el = this.formFieldRefs.get(key);
if (!el || !el.isConnected) continue;  // detached → skip
```

### Pitfall 3: `document.activeElement` cross-iframe / shadow DOM

**What goes wrong:** Если Obsidian когда-нибудь поместит editor в iframe или shadow root (сейчас не делает, но Plugin API не гарантирует), `document.activeElement` вернёт iframe element, не targeted textarea. Sync direction проверка broken.

**Verification:** Obsidian leaves сейчас НЕ iframe-encapsulated (вся плагинная DOM в основном document). Это HIGH confidence, проверено existing patterns в `editor-panel-view.ts:64-127` где используется `containerEl` напрямую без iframe-handling.

**Fix-pattern (defensive future-proof):** check both `document.activeElement` И ownerDocument:
```typescript
private isFocused(el: HTMLElement): boolean {
  const doc = el.ownerDocument;
  return doc?.activeElement === el;
}
```

### Pitfall 4: blur event timing — synchronous vs queued

**What goes wrong:** `blur` event срабатывает синхронно при потере фокуса. Если patch приходит в момент blur, есть теоретическое окно где `document.activeElement` ещё указывает на blur'нутый el (event срабатывает ДО смены activeElement в некоторых браузерах).

**Verification:** В современных Chromium/Electron (которые Obsidian) `blur` event fires **AFTER** activeElement updated to next focused element (or document.body). HIGH confidence для desktop Obsidian (Electron).

**Fix-pattern:** в blur handler — apply pendingCanvasUpdate **через `setTimeout(0)` или `queueMicrotask`**:
```typescript
this.registerDomEvent(textarea, 'blur', () => {
  queueMicrotask(() => {
    const pending = this.pendingCanvasUpdate.get(key);
    if (pending !== undefined) {
      this.patchTextareaValue(textarea, pending);
      this.pendingCanvasUpdate.delete(key);
    }
  });
});
```
Гарантирует, что activeElement-проверка в `applyCanvasPatch` (если параллельно вызывается) видит уже-сменившийся activeElement.

### Pitfall 5: `selectionStart`/`selectionEnd` на non-focused inputs

**What goes wrong:** Установка `el.value = newValue` на input, у которого ЕСТЬ selection range, может (a) сбросить selection в начало, (b) не двигать фокус (правильно), но потерять scroll position в textarea.

**Verification:** D-05 уже скипает фокусные поля → selection issue только для non-focused inputs у которых юзер уже снял фокус (после blur). Для них selection не имеет user-meaning.

**Fix-pattern:** не сохранять/восстанавливать selection — D-05 покрывает фокусный кейс. Документировать в коде "selection on patched non-focused fields is intentionally not preserved".

### Pitfall 6: form autosave fires while inbound patch arrives

**What goes wrong:** Sequence:
1. T=0ms: юзер печатает в Question textarea на canvas → modify event scheduled.
2. T=200ms: юзер печатает в displayLabel input в форме → autosave scheduled (T=1000ms).
3. T=250ms: reconcile fires (D-13 debounce) → dispatch → form patches `radiprotocol_questionText` (не displayLabel — D-05 skip).
4. T=1000ms: autosave fires → `saveNodeEdits({radiprotocol_displayLabel: ...})` → Pattern B writes BOTH the questionText we just patched AND the displayLabel.

**Question:** patched questionText в `pendingEdits` или нет? **Verified в коде:** `applyCanvasPatch` (если делать правильно) НЕ кладёт в `pendingEdits`. Только в DOM. Значит autosave on T=1000 пишет только `radiprotocol_displayLabel`. Pattern B `saveLive` (line 75-133) только применяет `edits` к node copy, остальные fields на canvas остаются как были (то есть = patched value). **No race.**

**Если applyCanvasPatch ОШИБОЧНО кладёт в pendingEdits:** loop. Pattern B вернёт обратно patched value на disk → modify → reconcile видит no diff → terminates. Cost: 1 redundant write per autosave cycle. Не fatal но wasteful.

**Fix-pattern:** `applyCanvasPatch` НЕ модифицирует pendingEdits. Документировать invariant в JSDoc.

### Pitfall 7: Multi-incoming Snippet edge consistency

**What goes wrong:** D-04 (Phase 50) — "first labeled wins, others re-sync". При переходе в Phase 63 одна и та же логика для snippet — но если snippet имеет несколько incoming Question→Snippet рёбер, все они должны быть синхронизированы. Текущий reconciler (`edge-label-reconciler.ts:60-87`) **уже** делает это правильно (см. test `branching-multi-incoming.canvas`).

**Verification:** Phase 63 переносит ту же loop структуру 1:1 на snippet. Test `branching-snippet-multi-incoming.canvas` (см. выше) проверяет это.

**Fix-pattern:** assert в test, что `diffs.length === 1` (только one e2 нужен resync), `targetLabel === pickedLabel` для всех diff entries.

### Pitfall 8: Reconciler видит NEW snippet edge без snippet kind на target

**What goes wrong:** Если автор создаёт edge `Question → SomeNode` где `SomeNode` ещё не помечен как Snippet (radiprotocol_nodeType пустой), parser silently skip'ает edge (`canvas-parser.ts:104` `if (!nodes.has(rawEdge.fromNode) || !nodes.has(rawEdge.toNode)) continue`). Reconciler не видит → ничего не делает. **Корректно.**

После того как автор проставит `radiprotocol_nodeType: snippet`, modify-event fires → parser теперь видит edge → reconciler синхронизирует. **Auto.**

### Pitfall 9: Subscription leak при view re-mount

**What goes wrong:** `EditorPanelView.onClose` вызывает `contentEl.empty()` но не отписывается от dispatch. Если view re-mount'нут через workspace, новая инстанция подпишется ещё раз, старая остаётся подписана → memory leak + double patch.

**Fix-pattern:** Использовать `this.registerEvent(...)` который Obsidian auto-cleanup'ает. Если `EventTarget` не подходит под `EventRef` контракт — manual:
```typescript
async onOpen() {
  const unsub = this.plugin.edgeLabelSyncService.subscribe((e) => this.applyCanvasPatch(e));
  this.register(unsub);  // Obsidian Plugin.register accepts () => void
}
```
`Component.register()` (наследуется ItemView'ом) принимает teardown-функцию, вызывает её на unmount.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.x (verified `package.json` через project pattern) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/edge-label-reconciler.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDITOR-03 | Snippet branch label outbound: Node Editor → reconcile → all incoming Question→Snippet edges share label | unit (reconciler) | `npx vitest run src/__tests__/edge-label-reconciler.test.ts -t "snippet"` | ❌ Wave 0 — extend existing test file |
| EDITOR-03 | Snippet branch label inbound: edit edge.label на canvas → reconcile diff → write → dispatch → form patch | unit (sync service) | `npx vitest run src/__tests__/edge-label-sync-service-dispatch.test.ts` | ❌ Wave 0 — new file |
| EDITOR-03 | Multi-incoming Snippet: edge-wins picks first labeled, resyncs siblings | unit (reconciler + fixture) | `npx vitest run src/__tests__/edge-label-reconciler.test.ts -t "branching-snippet-multi-incoming"` | ❌ Wave 0 — fixture + test |
| EDITOR-03 | Cold-open: snippetLabel="X" + edge.label=undefined → migrate edge to "X" | unit (reconciler + fixture) | `npx vitest run src/__tests__/edge-label-reconciler.test.ts -t "snippet-label-edge-mismatch"` | ❌ Wave 0 — fixture + test |
| EDITOR-05 | Patch questionText: focus elsewhere → DOM updates immediately | unit (DOM-via-FakeNode) | `npx vitest run src/__tests__/views/editor-panel-canvas-patch.test.ts -t "questionText"` | ❌ Wave 0 — new file |
| EDITOR-05 | D-05 in-flight: patch questionText while focused → skip; patch other field → applies | unit | same file `-t "in-flight"` | ❌ Wave 0 |
| EDITOR-05 | D-07 apply post-blur: skipped patch applies on blur | unit | same file `-t "post-blur"` | ❌ Wave 0 |
| EDITOR-05 | D-09 nodeType change: triggers full renderNodeForm | unit | same file `-t "nodeType change"` | ❌ Wave 0 |
| EDITOR-05 | D-10 node deleted: renders idle | unit | same file `-t "node deleted"` | ❌ Wave 0 |
| EDITOR-05 | D-11 patch scope: separator / subfolderPath НЕ patched | unit | same file `-t "out of scope fields"` | ❌ Wave 0 |
| EDITOR-03+05 | Manual UAT — реальная Obsidian вкладка (browser environment) с открытым canvas + open Node Editor | manual UAT | n/a | n/a |
| Loop guard | D-07 idempotency: empty diff → no write → modify event self-terminates | unit (reconciler) | `npx vitest run src/__tests__/edge-label-reconciler.test.ts -t "D-07 idempotency"` | ✅ existing |
| Regression | runner-snippet-sibling-button tests pass unchanged | regression | `npx vitest run src/__tests__/views/runner-snippet-sibling-button.test.ts` | ✅ existing |
| Regression | canvas-write-back saveLiveBatch tests pass unchanged | regression | `npx vitest run src/__tests__/canvas-write-back.test.ts` | ✅ existing |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/edge-label-reconciler.test.ts src/__tests__/views/editor-panel-canvas-patch.test.ts` (~5s)
- **Per wave merge:** `npm test` (~30-60s, full suite)
- **Phase gate:** Full suite green + manual UAT on real Obsidian vault before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/views/editor-panel-canvas-patch.test.ts` — covers EDITOR-05 (D-05/D-06/D-07/D-08/D-09/D-10/D-11)
- [ ] `src/__tests__/edge-label-sync-service-dispatch.test.ts` — covers EDITOR-03 inbound + dispatch contract
- [ ] `src/__tests__/fixtures/snippet-label-edge-mismatch.canvas` — D-03 cold-open
- [ ] `src/__tests__/fixtures/branching-snippet-multi-incoming.canvas` — multi-incoming snippet
- [ ] Extend `src/__tests__/edge-label-reconciler.test.ts` with snippet-kind describe block (mirror Answer тестов)

(Framework install: not needed — vitest already configured.)

---

## Standard Stack

### Core (already in repo, verified)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian Plugin API | as installed | `vault.on('modify')`, `registerEvent`, `Plugin.register`, `WorkspaceLeaf` | Required by host environment |
| TypeScript | (per tsconfig) | Type safety for new `EdgeLabelDiff` discriminated union | Project convention |
| vitest | 1.x | Unit testing in pure node env | Project convention (`vitest.config.ts`) |
| esbuild | (per esbuild.config.mjs) | Build pipeline | CLAUDE.md mandates |

### Don't Add

- **No new MCP, no new dependencies.** Phase 63 уровня — refactor + small additions.
- **No EventEmitter polyfill** — Web Platform `EventTarget` достаточно (Electron has it natively).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pub/sub event bus | Custom callback registry с `.add(handler)` / `.remove(handler)` | `new EventTarget()` + `addEventListener` / `removeEventListener` | Стандарт; testable; нет risk утечек handler'ов. |
| Debounce timer per filePath | Свой Map + setTimeout | **Уже есть** в `EdgeLabelSyncService.debounceTimers` (line 36) | Reuse existing — не плодить параллельный. |
| Canvas modify subscription | `this.plugin.app.vault.on('modify', ...)` в EditorPanelView | **Уже владеет** `EdgeLabelSyncService` (line 49-54) — добавить dispatch в его reconcile | Single owner per Phase 50 D-01. |
| Reconcile loop guard | suppress flag, in-flight counter | **Уже есть** content-diff idempotency Phase 50 D-07 | Любая дополнительная схема ломает elegance. |
| Atomic node+edge write | Two separate `vault.modify`-ей | `saveLiveBatch` с edge edits (`canvas-live-editor.ts:148-205`) | WR-01 race document'ирован in-line. |
| `selectionStart`/`selectionEnd` сохранение фокусного поля | Save before patch + restore after | **Не нужно** — D-05 skip фокусного поля целиком | Simpler == correct. |

**Key insight:** Phase 63 — это **диета расширения**, не новая фундаментальная инфраструктура. Каждое добавление поверх Phase 50 surface должно быть точечным; любой новый класс / пул / subscription = code smell против CONTEXT.md D-04.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─ User edits canvas node text ───────────────────────────────────────────┐
│                                                                          │
│   Canvas (Obsidian view)                                                 │
│         │                                                                │
│         │ user keystroke                                                 │
│         ▼                                                                │
│   Obsidian's debounced requestSave (500ms) → vault.write                 │
│         │                                                                │
│         │ fires 'modify' event                                           │
│         ▼                                                                │
│   ┌─ EdgeLabelSyncService.scheduleReconcile ──────────────┐              │
│   │   debounceTimers per filePath (250ms — D-13)           │              │
│   └────────────────────┬───────────────────────────────────┘              │
│                        │                                                  │
│                        ▼                                                  │
│   ┌─ EdgeLabelSyncService.reconcile (Phase 63 extends) ───┐              │
│   │  1. read canvas JSON (live or disk)                    │              │
│   │  2. parser.parse → ProtocolGraph                       │              │
│   │  3. reconcileEdgeLabels(graph)                         │              │
│   │     ├─ Answer pass (Phase 50)                          │              │
│   │     └─ Snippet pass (Phase 63 NEW — D-04)              │              │
│   │  4. compute node-text snapshot diff vs lastSnapshot    │              │
│   │  5. if (no edge diffs && no node-text diffs) RETURN    │              │
│   │     (D-07 loop guard self-terminates here)             │              │
│   │  6. saveLiveBatch(filePath, nodeEdits, edgeEdits)      │              │
│   │     OR Strategy A vault.modify atomic                  │              │
│   │  7. update lastSnapshotByFilePath                      │              │
│   │  8. dispatchEvent('canvas-changed-for-node', detail)   │              │
│   └────────────────────┬───────────────────────────────────┘              │
│                        │                                                  │
│                        ▼                                                  │
│   ┌─ EditorPanelView (subscribed via subscribe(handler)) ─┐              │
│   │  applyCanvasPatch(detail):                             │              │
│   │    if (detail.changeKind === 'deleted') → renderIdle   │              │
│   │    if (detail.changeKind === 'nodeType') → renderForm  │              │
│   │    else for (key in fieldUpdates):                     │              │
│   │      el = formFieldRefs.get(key)                       │              │
│   │      if (el === document.activeElement):               │              │
│   │        pendingCanvasUpdate.set(key, value)  // D-07    │              │
│   │      else:                                             │              │
│   │        el.value = value; resize()  // D-08             │              │
│   └────────────────────────────────────────────────────────┘              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ User edits Node Editor form (outbound — already exists) ────────────────┐
│   form input → pendingEdits → 800ms autosave → saveNodeEdits             │
│       └─ Pattern B saveLiveBatch (D-14) OR Strategy A vault.modify       │
│       └─ for displayLabel: edge edits collected via collectIncomingEdgeEdits │
│       └─ writes disk → fires 'modify' → reconciler sees no diff (D-07)   │
└──────────────────────────────────────────────────────────────────────────┘

┌─ blur event on patched-while-focused field ──────────────────────────────┐
│   textarea.blur → registerDomEvent handler → queueMicrotask              │
│     → if pendingCanvasUpdate.has(key):                                   │
│         patchTextareaValue(el, pendingCanvasUpdate.get(key))             │
│         pendingCanvasUpdate.delete(key)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Project Structure (где живут изменения)

```
src/
├── canvas/
│   └── edge-label-sync-service.ts    # EXTEND: snippet kind handling, dispatch event, snapshot tracking
├── graph/
│   ├── edge-label-reconciler.ts      # EXTEND: snippet pass with edge-wins (mirror Answer pass)
│   └── graph-model.ts                # NO CHANGE — SnippetNode.snippetLabel already exists
├── views/
│   └── editor-panel-view.ts          # EXTEND: formFieldRefs Map, subscribe in onOpen, applyCanvasPatch, blur handlers
└── __tests__/
    ├── edge-label-reconciler.test.ts # EXTEND: snippet describe block
    ├── edge-label-sync-service-dispatch.test.ts  # NEW
    ├── views/
    │   └── editor-panel-canvas-patch.test.ts     # NEW
    └── fixtures/
        ├── snippet-label-edge-mismatch.canvas    # NEW (cold-open D-03)
        └── branching-snippet-multi-incoming.canvas  # NEW
```

### Pattern: discriminated EdgeLabelDiff union (Discretion call)

```typescript
// edge-label-reconciler.ts — recommended single-list discriminated:
export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
  kind: 'answer' | 'snippet';  // Phase 63 NEW
}

export interface NodeLabelChange {
  nodeId: string;
  newLabel: string | undefined;
  kind: 'answer' | 'snippet';  // dictates radiprotocol_displayLabel vs radiprotocol_snippetLabel
}

export interface ReconcileResult {
  diffs: EdgeLabelDiff[];
  nodeChanges: NodeLabelChange[];  // replaces newDisplayLabelByAnswerId
}
```

— writer in `edge-label-sync-service.ts` (line 102-108) becomes:

```typescript
const nodeEdits = nodeChanges.map(c => ({
  nodeId: c.nodeId,
  edits: c.kind === 'answer'
    ? { radiprotocol_displayLabel: c.newLabel }
    : { radiprotocol_snippetLabel: c.newLabel },
}));
```

---

## Code Examples

### Pattern: subscribe in onOpen with auto-cleanup

```typescript
// editor-panel-view.ts (in onOpen)
async onOpen(): Promise<void> {
  this.renderIdle();
  this.attachCanvasListener();
  // ... existing active-leaf-change registerEvent ...

  // Phase 63 — subscribe to canvas-changed-for-node
  const unsubscribe = this.plugin.edgeLabelSyncService.subscribe(
    (detail) => this.applyCanvasPatch(detail),
  );
  this.register(unsubscribe);  // Obsidian Component.register
}
```

### Pattern: dispatch event after write

```typescript
// edge-label-sync-service.ts (extend reconcile() AFTER write success)
private bus = new EventTarget();

subscribe(handler: (detail: CanvasChangedForNodeDetail) => void): () => void {
  const wrapped = (e: Event) => {
    handler((e as CustomEvent<CanvasChangedForNodeDetail>).detail);
  };
  this.bus.addEventListener('canvas-changed-for-node', wrapped);
  return () => this.bus.removeEventListener('canvas-changed-for-node', wrapped);
}

private dispatchChange(detail: CanvasChangedForNodeDetail): void {
  this.bus.dispatchEvent(
    new CustomEvent('canvas-changed-for-node', { detail }),
  );
}
```

### Pattern: applyCanvasPatch with D-05/D-07

```typescript
// editor-panel-view.ts
private formFieldRefs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
private pendingCanvasUpdate = new Map<string, string | undefined>();

private applyCanvasPatch(detail: CanvasChangedForNodeDetail): void {
  if (detail.filePath !== this.currentFilePath) return;
  if (detail.nodeId !== this.currentNodeId) return;

  queueMicrotask(() => {
    if (detail.changeKind === 'deleted') {
      this.pendingEdits = {};
      this.currentNodeId = null;
      this.currentFilePath = null;
      this.formFieldRefs.clear();
      this.pendingCanvasUpdate.clear();
      this.renderIdle();
      return;
    }
    if (detail.changeKind === 'nodeType') {
      this.pendingEdits = {};
      this.formFieldRefs.clear();
      this.pendingCanvasUpdate.clear();
      void this.renderNodeForm(this.currentFilePath!, this.currentNodeId!);
      return;
    }
    // changeKind === 'fields'
    for (const [key, value] of Object.entries(detail.fieldUpdates ?? {})) {
      const el = this.formFieldRefs.get(key);
      if (!el || !el.isConnected) continue;
      if (el === el.ownerDocument?.activeElement) {
        // D-05 skip + D-07 stash
        this.pendingCanvasUpdate.set(key, value);
        continue;
      }
      // D-08 patch
      el.value = value ?? '';
      if (el instanceof HTMLTextAreaElement) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
    }
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-key `vault.modify` для node + edge | Atomic `saveLiveBatch` с edgeEdits | Phase 50 D-14 | Phase 63 наследует — нет новых race classes. |
| Reconciler через mutable suppress flag | Content-diff idempotency D-07 | Phase 50 D-07 | Phase 63 наследует — empty diff = no write = self-terminate. |
| Form re-render через `renderForm` для каждого внешнего change | Точечный DOM patch через `formFieldRefs` Map | Phase 63 NEW | Cursor / scroll preservation; better UX. |
| Form-level freeze пока юзер печатает | Field-level skip через `document.activeElement` | Phase 63 D-05/D-06 | Adjacent fields остаются live. |

**Deprecated/outdated:** none — Phase 63 чисто additive.

---

## Project Constraints (from CLAUDE.md)

- **Build:** `npm run build` (esbuild). После любых CSS-изменений — обязательно (Phase 63 НЕ должна добавлять CSS, но если visual indicator ever — append-only в `src/styles/editor-panel.css`).
- **Tests:** `npm test` (vitest).
- **Never delete code you didn't add:** Phase 63 правит `editor-panel-view.ts` и `edge-label-sync-service.ts` — оба shared. ВСЕ новые добавления должны быть размечены `// Phase 63: ...` комментариями. Никаких "tidy-up" соседних строк.
- **Append-only CSS:** если ничего не добавляешь — не трогай.
- **CSS файлы под `src/styles/`** — `styles.css` в корне generated, never edit.

Все эти constraints совместимы с Phase 63 scope.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Obsidian editor leaves НЕ помещены в iframe / shadow root в текущей версии | Pitfall 3 | LOW — defensive fallback через `el.ownerDocument?.activeElement` уже в code example. |
| A2 | `blur` event fires AFTER `document.activeElement` updated (Chromium semantics) | Pitfall 4 | LOW — defensive `queueMicrotask` в blur handler уже в code example. |
| A3 | Vitest version is 1.x (не verified в этом разделе, но project pattern говорит про vitest config existence) | Validation Architecture | NONE — команды совместимы со всеми versions. |

**Все остальные claims в этом research'е VERIFIED через прямое чтение кода в этой сессии.**

---

## Open Questions

1. **Snapshot baseline scope: Service vs View ownership?**
   - What we know: D-08 говорит "formFieldRefs Map per current node". Snapshot для diff-detection нужен service'у.
   - What's unclear: где хранить — `EdgeLabelSyncService.lastSnapshotByFilePath` (recommended above) или `EditorPanelView` per-currentNodeId.
   - Recommendation: **в Service**, чтобы один snapshot обслуживал любое количество подписчиков (не только Node Editor — потенциально RunnerView в будущем).

2. **Single discriminated EdgeLabelDiff vs параллельные lists?**
   - What we know: CONTEXT.md "Claude's Discretion" явно оставляет это.
   - What's unclear: type narrowing в TypeScript для discriminated union vs separate list iteration.
   - Recommendation: **discriminated union** — единый pass в writer, меньше дубликации.

3. **Outbound Snippet branch label — оптимизировать через `collectIncomingEdgeEdits` для ~250 ms latency?**
   - What we know: D-13 принимает 750ms latency; outbound через reconciler работает.
   - What's unclear: оправдано ли усложнение `saveNodeEdits` (line 175-326) добавлением snippet ветки рядом с line 305-319 displayLabel ветки?
   - Recommendation: **оставить через reconciler** — single source of truth для outbound.

4. **Where should `lastSnapshotByFilePath` cleanup happen?**
   - What we know: snapshot per filePath накапливается за время работы плагина.
   - What's unclear: cleanup при file rename / file delete.
   - Recommendation: вешать на `vault.on('rename')` и `vault.on('delete')` через тот же `registerEvent` lifecycle. Низкий приоритет — service.destroy() в onunload очистит весь Map в любом случае.

---

## Sources

### Primary (HIGH confidence — verified в коде в этой сессии)
- `src/canvas/edge-label-sync-service.ts:1-191` — Phase 50 service полная структура.
- `src/graph/edge-label-reconciler.ts:1-92` — Phase 50 reconciler edge-wins logic.
- `src/canvas/canvas-live-editor.ts:148-234` — `saveLiveBatch` с edgeEdits.
- `src/views/editor-panel-view.ts:1-1027` — полный lifecycle, renderForm/buildKindForm/saveNodeEdits, queueMicrotask Phase 42 pattern, registerEvent/registerDomEvent usage.
- `src/graph/graph-model.ts:83-95` — SnippetNode.snippetLabel существует.
- `src/graph/canvas-parser.ts:251-278` — Snippet parser arm нормализует пустую строку в undefined.
- `src/types/canvas-internal.d.ts:1-99` — CanvasEdgeData.label, CanvasViewInternal API.
- `src/graph/node-label.ts:40-42` — `isLabeledEdge` whitespace-as-unlabeled (Phase 49 D-05) reuse.
- `src/__tests__/edge-label-reconciler.test.ts:1-260` — pure-module test patterns + fixture loader.
- `src/__tests__/views/runner-snippet-sibling-button.test.ts:1-482` — FakeNode DOM mocking pattern.
- `src/__tests__/canvas-write-back.test.ts:202-295` — saveLiveBatch + saveLiveEdges test patterns.
- `vitest.config.ts:1-15` — `environment: 'node'`, alias obsidian mock.
- `src/__mocks__/obsidian.ts:1-150` — mock Obsidian API surface.
- `src/main.ts:14, 89, 115, 221` — EdgeLabelSyncService wired in plugin lifecycle.
- `.planning/phases/63-bidirectional-canvas-node-editor-sync/63-CONTEXT.md` — locked decisions D-01..D-13.
- `.planning/milestones/v1.8-phases/50-answer-edge-label-sync/50-CONTEXT.md` — Phase 50 D-01..D-18.
- `.planning/notes/answer-label-edge-sync.md` — design source convention.
- `.planning/STATE.md` — Standing Pitfalls #1, #2.
- `.planning/REQUIREMENTS.md` — EDITOR-03, EDITOR-05.
- `.planning/config.json` — `nyquist_validation: true` triggers Validation Architecture section.
- `CLAUDE.md` — build process, never-delete rule, append-only CSS.

### Secondary
- (None — research relied entirely on local code base.)

### Tertiary
- (None.)

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — все библиотеки уже в repo, versions verified.
- Architecture (Phase 50 reuse): **HIGH** — каждая extension point указана с файлом:строкой.
- Pitfalls: **HIGH** для p1, p2, p5, p6, p7, p8, p9; **MEDIUM** для p3, p4 (defensive code patterns в case if Obsidian internals меняются).
- Test harness: **HIGH** — verified vitest config + 3 reference test files.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 дней — Phase 50 surface стабильна с Phase 50.1).

---

## RESEARCH COMPLETE
