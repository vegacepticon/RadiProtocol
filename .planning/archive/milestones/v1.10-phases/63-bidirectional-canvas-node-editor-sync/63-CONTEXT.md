# Phase 63: Bidirectional Canvas ↔ Node Editor Sync — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Сейчас синхронизация Canvas ↔ Node Editor одностороння: форма пишет в canvas через `EditorPanelView.saveNodeEdits` (Pattern B `saveLive` / Strategy A `vault.modify`). Phase 63 добавляет обратное направление:

1. Прямая правка текста узла на canvas (`questionText` / `answerText` / text-block `text` / `snippetLabel` / loop `headerText`) — **в реальном времени** обновляет соответствующее поле открытой формы Node Editor (EDITOR-05).
2. Ярлык исходящей ветки `Snippet`'а (поле "branch label" в Node Editor) round-trip-ит в обе стороны с **incoming** Question→Snippet edge label, точно как `Answer.displayLabel` ↔ incoming Question→Answer label из Phase 50 (EDITOR-03). Текст самого Snippet-узла на canvas продолжает показывать выбранный путь к директории/файлу — он не задействован в bidirectional sync.

**Scope-in:** EDITOR-03 + EDITOR-05.
**Scope-out:** EDITOR-04 / EDITOR-06 (Phase 64 — auto-grow textarea + text-block quick-create), Runner UX (Phase 65/66), Inline Runner (Phase 67), per-edge override на multi-incoming Snippet (наследуем Phase 50 D-10 — единый ярлык на все incoming). ROADMAP SC#2/3 говорит "outgoing edge" — это считаем опиской по симметрии с Phase 50; Phase 63 синхронизирует **incoming Question→Snippet** edge (см. D-01).

</domain>

<decisions>
## Implementation Decisions

### Snippet branch label model

- **D-01 (Incoming edge):** "Branch label" Snippet'а синхронизируется с **incoming Question→Snippet** ребром, не с outgoing. Симметрия с Phase 50 (где Answer.displayLabel ↔ incoming Question→Answer). `snippetLabel` в текущем коде уже используется именно при mixed-branching от Question (`runner-view.ts:538`, `inline-runner-modal.ts:351`) — outgoing Snippet→next в runner'е никогда не читается. ROADMAP SC#2/3 формулировка "outgoing" считается описку при формулировке требования.
- **D-02 (Mirror node + edge, edge-wins reconcile):** `SnippetNode.snippetLabel` остаётся на узле как сейчас (`radiprotocol_snippetLabel` в canvas JSON, см. `canvas-parser.ts:253-268`, `graph-model.ts:87`). Дополнительно ярлык зеркалится на каждое incoming Question→Snippet ребро. Edge-wins precedence — **точное наследование Phase 50 D-04**: при расхождении reconciler берёт первый non-empty incoming edge label, выставляет `snippetLabel = label`, ре-синхронизирует sibling incoming рёбра (если такие есть). Runner и тесты, читающие `node.snippetLabel`, не трогаются — reconciler гарантирует, что значение на узле всегда совпадает с edge-wins picked label.
- **D-03 (Auto-mirror cold-open):** существующие canvas-файлы с `radiprotocol_snippetLabel` на узле, но без `label` на ребре, мигрируют автоматически при первом modify-event: reconciler видит "node.snippetLabel ≠ ∅, edge.label = ∅" и сидит edge.label с узла. Это симметрично Phase 50 D-11 (новое ребро с label сидит displayLabel когда тот пустой). Пользователь не делает ничего — первое же касание canvas зеркалит. Никакой миграционной утилиты не нужно.
- **D-04 (Расширить EdgeLabelSyncService + edge-label-reconciler):** не плодить параллельных сервисов. `src/graph/edge-label-reconciler.ts` дополняется проходкой по incoming Question→Snippet рёбрам в одной reverseAdjacency-проходке вместе с Question→Answer. Один `vault.on('modify')` subscription, один debounce-пул, один loop-guard через D-07-идемпотентность. Diff-список расширяется до `{ edgeId, currentLabel, targetLabel, kind: 'answer' | 'snippet' }`, чтобы writer знал какое поле трогать (`radiprotocol_displayLabel` или `radiprotocol_snippetLabel`).

### In-flight protection (canvas → form)

- **D-05 (`document.activeElement` detector):** при входящем patch'е `EditorPanelView` сравнивает целевой `HTMLInputElement` / `HTMLTextAreaElement` с `document.activeElement`. Если совпадают — patch пропускается для этого поля (но не для других). Прозрачный, дешёвый детектор без отдельного состояния.
- **D-06 (Field-level lock):** блокируется только конкретное сфокусированное поле, остальные поля той же формы patch'атся live. Form-level "freeze" не используем — иначе остальные поля выглядят неотзывчивыми.
- **D-07 (Apply post-blur):** при пропуске patch'а из-за D-05, последнее значение target из reconcile-прохода складывается во внутренний `pendingCanvasUpdate` slot per field. На событии `blur` поля (или при переключении фокуса на любое другое поле формы) — этот slot применяется к DOM как обычный D-08 patch. Если форма уже отправила свой autosave с pendingEdits — `vault.modify`/`saveLive` улетит позже и через Phase 50 D-07 idempotency loop guard reconciler не зациклится. Last-write-wins.

### Re-render strategy

- **D-08 (Точечный DOM patch):** при сборке формы (`renderForm` / `buildKindForm`) попутно строится `private formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>` где ключ — pendingEdits-key (`radiprotocol_questionText`, `radiprotocol_answerText`, `radiprotocol_text` для text-block, `radiprotocol_snippetLabel`, `radiprotocol_headerText`). При входящем canvas-обновлении lookup в Map → запись `.value`. Selection / scrollTop фокусного поля никогда не трогаются (D-05 защита). На переключении узла Map сбрасывается.
- **D-09 (NodeType change → full renderForm):** если canvas изменил `radiprotocol_nodeType` текущего выбранного узла, точечный patch невозможен (наборы полей разные для каждого kind). Тогда: `pendingEdits = {}`, `formFieldRefs.clear()`, `void this.renderNodeForm(filePath, nodeId)` (полный re-render). Это явное исключение из D-08.
- **D-10 (Узел удалён → renderIdle):** если на canvas удалили текущий выбранный узел (отсутствует в reconcile-прохождении), `EditorPanelView` переходит в `renderIdle`, `pendingEdits = {}`, `currentNodeId = null`, `currentFilePath = null`. Без Notice — это нормальный авторский флоу.
- **D-11 (Patch scope — только SC#1 поля):** Map'ятся и patch'атся только `questionText`, `answerText`, `text` (text-block), `snippetLabel`, `headerText`. `displayLabel` (Answer) уже синхронизируется через Phase 50 — но **через тот же входящий канал**, поскольку Phase 50 reconciler обновит `radiprotocol_displayLabel` в canvas, и наш patch'инг просто прочитает обновлённое значение через тот же event. Прочие поля (separator, color, snippet `subfolderPath`, `snippetType`, `radiprotocol_separator`) **не входят в Phase 63 scope** — их можно поднять в будущей фазе.

### Trigger channel

- **D-12 (vault.on('modify') + dispatch):** Используем существующий канал Phase 50: `EdgeLabelSyncService` уже подписан на `vault.on('modify')` для `.canvas` файлов (`edge-label-sync-service.ts:50`). После reconcile (после write через `saveLiveBatch` / Strategy A) сервис диспатчит лёгкое событие "canvas-changed-for-node" с `{ filePath, nodeId, kind, fieldUpdates }`. `EditorPanelView` слушает и patch'ит по D-08 если `currentFilePath/currentNodeId` совпадают. Никакого нового `vault.on` подписчика. Одно событие, один debounce-пул, один loop-guard. Канал работает и для Pattern B (canvas открыт), и для Strategy A (canvas закрыт).
- **D-13 (250 ms debounce):** наследуем `RECONCILE_DEBOUNCE_MS = 250` из `edge-label-sync-service.ts:30`. Не дублируем константу. Итоговая latency keystroke-on-canvas → form ~750 ms (500 ms Obsidian requestSave + 250 ms наш debounce) — это ощущается как "форма догнала после паузы в печати", не как "live frame-perfect", и это приемлемо для ползования (consistent с Phase 50 поведением).

### Loop guard и race semantics (наследуется из Phase 50)

- Идемпотентность через content-diff (Phase 50 D-07): когда reconcile-проход не находит расхождений, write не делается → modify-event self-terminates. Та же логика покрывает и snippet edges, и canvas→form событие (если ничего не diff'ит — событие не диспатчится).
- Pattern B `saveLiveBatch` атомарно для node + edge edits в одном `setData` (Phase 50 D-14). Strategy A — один `vault.modify` mutate'ит и nodes, и edges перед записью. Никаких отдельных writes для node и edge.
- Last-write-wins для form ↔ canvas: если форма пишет позже — её значение побеждает; если canvas пишет позже — наоборот. D-07 (idempotency) предотвращает infinite loop.

### Claude's Discretion

- Выбор имени для `formFieldRefs` Map'а и точное место его сброса в `renderForm` / `buildKindForm` lifecycle.
- Точная сигнатура события "canvas-changed-for-node" (EventTarget.dispatchEvent vs прямой callback list в `EdgeLabelSyncService.subscribe(handler)` — выбрать что чище встраивается).
- Где живёт patch-метод в `EditorPanelView` (`applyCanvasPatch(updates)` vs `onCanvasChanged(...)` — чисто naming).
- Telemetry: `console.warn` при пропуске patch'а из-за D-05 — debug-only, не пользовательское.
- Тест-фикстуры: новые `.canvas` для cold-open миграции D-03 + multi-incoming Snippet (если будет нужно) — naming аналогично существующим (`branching-multi-incoming.canvas`, `snippet-label-mismatch.canvas`).
- Точная форма расширения `EdgeLabelDiff` (single discriminated union с `kind: 'answer' | 'snippet'` vs два параллельных diff-array'а) — Claude выбирает то, что чище type-narrowed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 63 scope / convention
- `.planning/notes/answer-label-edge-sync.md` — design source для Phase 50 bi-directional sync rule. Phase 63 расширяет его на Snippet — ту же ноту обновить или добавить параллельный документ (Claude's Discretion).
- `.planning/notes/snippet-node-binding-and-picker.md` — модель Snippet-binding (Phase 51); contains Pattern H снippet-tree-picker context.
- `.planning/ROADMAP.md` §Phase 63 — Goal, Depends on, Success Criteria 1-4. Замечание про "outgoing edge" (SC#2/3) считается опиской — см. D-01.
- `.planning/REQUIREMENTS.md` EDITOR-03 + EDITOR-05.
- `.planning/milestones/v1.8-phases/50-answer-edge-label-sync/50-CONTEXT.md` — все D-01..D-18 решения Phase 50, которые наследуем целиком.

### Current code touchpoints
- `src/graph/graph-model.ts:83-88` — `SnippetNode.snippetLabel?: string` (Phase 31 D-01). Phase 63 НЕ удаляет поле.
- `src/graph/canvas-parser.ts:253-268` — Snippet parser arm; `snippetLabel` уже нормализуется к `undefined` при пустой строке/отсутствии. Reconciler reuses этот же контракт.
- `src/graph/edge-label-reconciler.ts` — Phase 50 reconciler. Phase 63 расширяет его до Question→Snippet рёбер (D-04).
- `src/canvas/edge-label-sync-service.ts` — Phase 50 service. Phase 63 расширяет dispatch'ем "canvas-changed-for-node" события после reconcile (D-12).
- `src/canvas/canvas-live-editor.ts:75-205, 253` — `saveLive` / `saveLiveBatch` / `saveLiveEdges`. Phase 63 переиспользует saveLiveBatch для атомарной записи `radiprotocol_snippetLabel` + edge labels (mirror Phase 50 D-14).
- `src/views/editor-panel-view.ts:328-380` — `renderNodeForm` / `renderForm`. Phase 63 добавляет `formFieldRefs` Map, subscription на dispatch из EdgeLabelSyncService, patch-метод, blur-handler.
- `src/views/editor-panel-view.ts:175-223` — `saveNodeEdits` Pattern B fork; пример того, как outbound write сейчас выглядит (для reference).
- `src/views/editor-panel-view.ts:678-695` — Snippet branch label form Setting (`radiprotocol_snippetLabel` autosave). Phase 63 этот код в принципе не трогает — outbound уже работает как нужно после D-04.
- `src/views/runner-view.ts:538, 550`, `src/views/inline-runner-modal.ts:351, 361` — runner read-path для `node.snippetLabel`. **Не трогаем** — D-02 mirror pattern гарантирует что node.snippetLabel остаётся актуальным.
- `src/types/canvas-internal.d.ts` — `CanvasEdgeData.label?: string` (расширено Phase 50 D-15). Phase 63 ничего не добавляет.

### Test surface
- `src/__tests__/edge-label-reconciler.test.ts` — Phase 50 reconciler unit tests; расширить тестами на Question→Snippet edges + multi-mixed (один Question имеет и Answer-, и Snippet-ветки).
- `src/__tests__/canvas-write-back.test.ts:202-265` — saveLiveEdges / saveLiveBatch coverage. Расширить на edge-edits для Snippet ветки.
- `src/__tests__/canvas-parser.test.ts:150-162` — существующее покрытие `radiprotocol_snippetLabel` parser arm.
- `src/__tests__/views/runner-snippet-sibling-button.test.ts` — runner-side coverage `node.snippetLabel`. Регрессионный guard: post-Phase-63 эти тесты должны остаться зелёными без изменений (D-02 mirror — node.snippetLabel остаётся источником для runner).
- Новые fixtures: `branching-snippet-multi-incoming.canvas` (если потребуется) + cold-open миграция (D-03) — пары `.canvas` "до миграции" / "после миграции".

### Standing pitfalls touching Phase 63
- STATE.md Standing Pitfall #1 (no `vault.modify()` while canvas open) — Pattern B path Phase 50 D-12. Phase 63 наследует.
- STATE.md Standing Pitfall #2 (`vault.modify()` race) — атомарный `saveLiveBatch` Phase 50 D-14. Phase 63 наследует.
- Phase 42 WR-01/WR-02 (re-entrant `renderForm` стейл closure / re-entrancy) — `queueMicrotask` + `pendingEdits` merge паттерн. Phase 63 patch-флоу должен учитывать: входящее обновление приходит **во время** возможного renderForm pendingEdits flush — defer patch через `queueMicrotask` если активный flush идёт.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EdgeLabelSyncService` (`src/canvas/edge-label-sync-service.ts:32`) — vault.on('modify') subscription + debounced reconcile + write dispatch. Phase 63 расширяет, не пересоздаёт.
- `reconcileEdgeLabels` (`src/graph/edge-label-reconciler.ts`) — pure reconcile pass. Phase 63 расширяет до Question→Snippet incoming edges.
- `collectIncomingEdgeEdits` (`src/canvas/edge-label-sync-service.ts:177-191`) — helper для outbound (form → edges). Phase 63 переиспользует, расширяя на Snippet kind.
- `CanvasLiveEditor.saveLiveBatch` (`canvas-live-editor.ts:148-205`) — атомарный node+edge write. Phase 63 переиспользует.
- `ProtocolGraph.reverseAdjacency` (`graph-model.ts:130`) — incoming nodes в O(1). Phase 63 использует для Snippet incoming enumeration.
- `Plugin.registerEvent` / `Plugin.registerDomEvent` lifecycle — для нового subscriber'а в `EditorPanelView` и для `blur` handler'а на полях.

### Established Patterns
- `pendingEdits` accumulator + 250 ms debounce autosave в `EditorPanelView`. Phase 63 НЕ ломает это — patch'инг приходит **снаружи** этого цикла; D-05 гарантирует, что pending pendingEdits никогда не overwrite'ится.
- Map<key, HTMLElement> для form-field tracking — паттерн отсутствует, но согласуется с существующим `kindFormSection` / `_savedIndicatorEl` (явные DOM ссылки храним полем класса).
- `queueMicrotask` для re-render deferral (Phase 42 WR-01) — переносим если patch попадает в момент re-entrant `renderForm`.
- vault subscription через `registerEvent` для auto-detach (`runner-view.ts:200`, `snippet-manager-view.ts:135`) — стандарт.

### Integration Points
- `EditorPanelView.onOpen` — добавить subscribe на dispatch из `EdgeLabelSyncService`.
- `EditorPanelView.onClose` — auto-detach через `registerEvent`; явно очищать `formFieldRefs`.
- `EditorPanelView.renderForm` / `buildKindForm` — заполнение `formFieldRefs` параллельно с построением Setting'ов.
- `EditorPanelView.renderIdle` / `loadNode` — сбрасывание `formFieldRefs` и `pendingCanvasUpdate`.
- `EdgeLabelSyncService.reconcile` — после reconcile-write вызывать `notifyCanvasChange(filePath, nodeIds, fieldUpdates)`.

</code_context>

<specifics>
## Specific Ideas

- "Должно ощущаться как одно поле, на которое смотришь с двух сторон" — пользователь правит на canvas, через ~750 ms Node Editor подтягивает; пользователь правит в Node Editor, через ~250 ms canvas подтягивает. Не "live frame-perfect", а "догнало после паузы".
- Snippet-узел на canvas продолжает показывать путь к директории/файлу через `text` поле — branch label живёт ИСКЛЮЧИТЕЛЬНО на ребре. Никаких UX подвалов "ярлык + путь сразу" внутри одного canvas-text.
- Loop headerText, text-block text, questionText, answerText синхронизируются через тот же канал, но это node text properties (не edge labels) — для них reconciler не делает edge-write; он только диспатчит canvas-changed-for-node событие, которое Node Editor patch'ит. То есть "outbound" путь для них уже существует (Phase 28 saveNodeEdits), новый только "inbound".

</specifics>

<deferred>
## Deferred Ideas

- Per-edge override на multi-incoming Snippet — наследуем Phase 50 D-10 Out-of-Scope для consistency. Если пользователь захочет разные ярлыки для разных incoming Question'ов на один Snippet — отдельная фаза.
- "Live frame-perfect" sync через canvas internal events / MutationObserver — обсуждали в Зоне 4, отклонили из-за рисков ломки и unclear API. Если 750 ms latency окажется неприемлемой по UAT — пересмотрим в отдельной фазе с runtime probe.
- Patch'инг прочих radiprotocol_* полей формы (separator, snippet subfolderPath, snippetType) — out of Phase 63 scope (D-11). Может быть отдельной фазой если кейс возникнет.
- UI-индикатор "canvas изменил это поле, пока ты печатал" (visual flash на blur, баннер) — не требуется по SC; D-07 apply-post-blur тихо применяет.
- Telemetry / opt-in метрика частоты patch'ей — debug-only `console.warn`, не пользовательское.

</deferred>

---

*Phase: 63-bidirectional-canvas-node-editor-sync*
*Context gathered: 2026-04-25*
