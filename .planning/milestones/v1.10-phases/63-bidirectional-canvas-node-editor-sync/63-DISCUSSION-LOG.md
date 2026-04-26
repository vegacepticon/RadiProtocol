# Phase 63: Bidirectional Canvas ↔ Node Editor Sync — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 63-bidirectional-canvas-node-editor-sync
**Areas discussed:** Snippet branch label model; Защита фокусированного поля; Стратегия ре-рендера формы; Канал триггера canvas→form

---

## Снippet branch label model

### С каким ребром синхронизируется branch label Snippet'а?

| Option | Description | Selected |
|--------|-------------|----------|
| Incoming Question→Snippet | Зеркало Phase 50; runner уже использует node.snippetLabel именно при mixed-branching от Question | ✓ |
| Outgoing Snippet→next | Буквальное прочтение ROADMAP, но в реальных протоколах outgoing Snippet обычно без label; runner ничего не читает с outgoing | |
| Оба ребра | Двойное зеркалирование; конфликт edge-wins при расхождении incoming и outgoing labels | |

**User's choice:** Incoming Question→Snippet (Recommended)
**Notes:** ROADMAP SC#2/3 формулировка "outgoing edge" считается опиской — Phase 50 симметрия диктует incoming.

### Где хранится branch label?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror: на узле + на ребре | snippetLabel остаётся на узле; reconciler зеркалит edge.label с edge-wins. Минимальный blast-радиус, две Phase'ы живут по одной схеме | ✓ |
| Только на ребре | Snippet.snippetLabel уходит из модели; runner читает с ребра. Чище, но требует трогать ~8 файлов и мигрировать существующие canvas | |
| Только на узле | Отказ от bidirection — EDITOR-03 не выполняется | |

**User's choice:** Mirror на узле + ребре (Recommended)

### Что делать с canvas файлами, где сейчас есть radiprotocol_snippetLabel на узле, но нет label на ребре?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-mirror при cold-open | Reconciler видит "node.snippetLabel ≠ ∅, edge.label = ∅" и сидит edge.label с узла. Симметрично Phase 50 D-11 | ✓ |
| Explicit migration при ручном сохранении | Миграция только при первой авторской правке branch label через Node Editor; canvas видит ribbon позже | |

**User's choice:** Auto-mirror при cold-open (Recommended)

### Куда ложить reconcile-логику?

| Option | Description | Selected |
|--------|-------------|----------|
| Расширить edge-label-reconciler | Existing reconcileEdgeLabels добавляет проходку по Question→Snippet рёбрам в ту же reverseAdjacency-проходку | ✓ |
| Новый snippet-label-reconciler | Отдельный сервис; меньше coupling; но два vault.on('modify') subscription и два debounce-пула | |

**User's choice:** Расширить edge-label-reconciler (Recommended)

---

## Защита фокусированного поля

### Как определять, что поле в "in-flight" и его нельзя перезаписывать?

| Option | Description | Selected |
|--------|-------------|----------|
| document.activeElement | Простая DOM-проверка: входящее обновление пропускается если target == document.activeElement | ✓ |
| pendingEdits имеет это поле | Скипать поля с незакоммиченным эдитом; работает за пределами фокуса в окне 250 ms | |
| Timestamp window | Per-field last-keystroke timestamp; блокировать если < N ms; лишнее состояние | |

**User's choice:** document.activeElement (Recommended)

### Как широко блокировать?

| Option | Description | Selected |
|--------|-------------|----------|
| Только фокусное поле | Field-level lock; остальные поля live | ✓ |
| Вся форма | Form-level freeze пока курсор где-то в форме; форма выглядит замёрзшей | |

**User's choice:** Только фокусное поле (Recommended)

### Что делать с отложенным canvas-изменением поля, когда пользователь убрал фокус (blur)?

| Option | Description | Selected |
|--------|-------------|----------|
| Apply post-blur | Накопить pending value; на blur применить. Reconciler-loop разведёт last-write-wins | ✓ |
| Drop — user-wins | Ничего не очередить; ввод пользователя автосохранится и перепишет canvas; пользователь не увидит, что было одновременное изменение | |

**User's choice:** Apply post-blur (Recommended)

---

## Стратегия ре-рендера формы

### Как применять входящее обновление к DOM формы?

| Option | Description | Selected |
|--------|-------------|----------|
| Точечный patch по ключу | Map<fieldKey, HTMLElement> заполняется при renderForm; lookup + .value =. Selection/scroll фокусного поля не трогаем | ✓ |
| Полный renderForm() | Перерисовывать всё; cursor/scroll сбрасываются | |

**User's choice:** Точечный patch (Recommended)

### Что делать, если на canvas изменился radiprotocol_nodeType текущего выбранного узла?

| Option | Description | Selected |
|--------|-------------|----------|
| Полный renderForm + сброс pendingEdits | Наборы полей разные для каждого kind; точечный patch невозможен | ✓ |
| Игнорировать (оставить старую форму) | Форма и canvas в разнобое; некорректно | |

**User's choice:** Полный renderForm + сброс pendingEdits (Recommended)

### Что делать, если текущий выбранный узел удалили на canvas?

| Option | Description | Selected |
|--------|-------------|----------|
| renderIdle + сброс pendingEdits | Форма в idle; pendingEdits отбрасываются (некуда писать) | ✓ |
| Notice + оставить форму | Призрак-форма; ввод теряется | |

**User's choice:** renderIdle + сброс pendingEdits (Recommended)

### Какие поля входят в patch'инг?

| Option | Description | Selected |
|--------|-------------|----------|
| Только SC#1 текстовые поля | questionText / answerText / text-block text / snippetLabel / loop headerText. displayLabel уже покрыт Phase 50 | ✓ |
| Все radiprotocol_* поля | Шире охват; новые классы ошибок на каждое поле | |

**User's choice:** Только SC#1 текстовые поля (Recommended)

---

## Канал триггера canvas→form

### Откуда Node Editor узнаёт о входящих canvas-изменениях?

| Option | Description | Selected |
|--------|-------------|----------|
| Тот же vault.on('modify') | Расширяем EdgeLabelSyncService; диспатчим событие после reconcile; EditorPanelView подписывается. Один канал, ~750 ms latency | ✓ |
| Гибрид: in-memory + modify | Polling canvas.getData() каждые 200 ms пока EditorPanelView открыт; modify как fallback | |
| Canvas internal events | canvas.on('node-changed') или MutationObserver; недокументировано, риск ломки | |

**User's choice:** vault.on('modify') (Recommended)

### Какие debounce/latency параметры?

| Option | Description | Selected |
|--------|-------------|----------|
| 250 ms (как Phase 50) | Наследовать RECONCILE_DEBOUNCE_MS; одна константа для Answer и Snippet | ✓ |
| 100 ms | Незначительная экономия latency, риск thrash | |
| 500 ms | Хуже, превышает Obsidian requestSave | |

**User's choice:** 250 ms (Recommended)

---

## Claude's Discretion

- Имя `formFieldRefs` Map'а и точное место его сброса в renderForm/buildKindForm lifecycle.
- Точная сигнатура события "canvas-changed-for-node" (EventTarget vs прямой callback).
- Naming patch-метода в EditorPanelView (applyCanvasPatch vs onCanvasChanged).
- Telemetry — debug-only console.warn при пропуске patch'а.
- Тест-фикстуры — naming аналогично существующим.
- Форма расширения EdgeLabelDiff — single discriminated union vs два параллельных diff-array'а.

## Deferred Ideas

- Per-edge override на multi-incoming Snippet — наследуется Phase 50 D-10 Out-of-Scope.
- "Live frame-perfect" sync через canvas internal events — отклонено по риску ломки API.
- Patch прочих radiprotocol_* полей (separator, subfolderPath, snippetType) — Phase 64+ или отдельная фаза.
- UI-индикатор "canvas изменил это поле, пока ты печатал" — не требуется.
- Telemetry/opt-in metric — debug-only console.warn.
