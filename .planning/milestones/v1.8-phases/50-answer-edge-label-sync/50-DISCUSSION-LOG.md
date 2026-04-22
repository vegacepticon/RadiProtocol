# Phase 50: Answer ↔ Edge Label Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 50-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 50-answer-edge-label-sync
**Areas discussed:** Detector (canvas-side edits), Conflict resolution, Empty-label semantics, Multi-incoming UX

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Детектор canvas-side правок | Как замечаем edit edge-метки на канвасе | ✓ |
| Расхождение при открытии (legacy) | Кто побеждает: displayLabel или edge при divergence | ✓ |
| Семантика пустого displayLabel | Что значит «пустая» метка, в обе стороны | ✓ |
| Multi-incoming UX | Visual warning vs code-comment for shared-label trade-off | ✓ |

**User's choice:** All four (multiSelect).

---

## Detector + Pattern B edges

### Q: Как плагин узнаёт, что пользователь поправил edge label на канвасе?

| Option | Description | Selected |
|--------|-------------|----------|
| `vault.on('modify')` + reconcile | Подписка на modify-event canvas-файла, debounced parse → reconcile. Работает и Pattern B и Strategy A. Идиоматично. | ✓ |
| Pattern B polling через canvas.getData() | Polling open-canvases каждые N мс, diff snapshots. Internal-API зависимость, не покрывает закрытые. | |
| Lazy на Runner-старт / Node Editor open | Реконсилия только при Runner-парсе. Расхождения копятся в canvas. Не покрывает live edits. | |

**User's choice:** vault.on('modify') + reconcile.

### Q: Live-запись edge labels в открытый canvas (когда редактируется displayLabel в Node Editor) — через что?

| Option | Description | Selected |
|--------|-------------|----------|
| Расширить CanvasLiveEditor: `saveLiveEdges()` | getData/setData/requestSave для edges. Параллельно saveLive() для nodes. Канвас-internal типы прокачиваются. | ✓ |
| Batched node+edge save в одном saveLiveBatch | Атомарно (один disk-flush на правку), но больше API + рефакторинг callsites. | |
| Pattern B только для nodes, edges — Strategy A | Конфликтует с Standing Pitfall #1 (vault.modify открытого .canvas). | |

**User's choice:** Extend CanvasLiveEditor: saveLiveEdges().

---

## Conflict Resolution + Loop Guard

### Q: На modify-event (или при первом парсе canvas) нашли: edge.label = 'A', Answer.displayLabel = 'B'. Кто побеждает?

| Option | Description | Selected |
|--------|-------------|----------|
| Edge label побеждает | Первая non-empty incoming edge → displayLabel, остальные re-syncают. Реализует «edit edge → updates displayLabel + re-syncs others» из notes. | ✓ |
| displayLabel побеждает | Source-of-truth, но canvas edits никогда не применяются — нарушает bi-directional spec. | |
| На open — displayLabel, во время сессии — edge | Разделение cold-open vs live edit. Сложнее, нет ясного выигрыша. | |

**User's choice:** Edge label wins (uniformly).

### Q: Когда плагин сам пишет edge labels (в ответ на displayLabel edit), это триггерит новый modify event. Как не зациклиться?

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotency через content-diff | Reconciler сначала diff'ит. Diff = ∅ → no-op. Самозатухает за один re-entry. Без mutable state. | ✓ |
| Suppress-flag «echo from own write» | Mutable флаг, тайминг-риски с debounced requestSave. | |
| Diff + suppress (defence-in-depth) | Усложнение ради устойчивости к thrash. | |

**User's choice:** Idempotency через content-diff.

---

## Empty-label Semantics

### Q: Пользователь очистил Display label в Node Editor до пустой строки. Что происходит со всеми входящими Question→Answer рёбрами?

| Option | Description | Selected |
|--------|-------------|----------|
| Label ключ удаляется из edges | Симметрично существующему canvas-parser.ts:207-209 (undefined ≡ key absent). Ribbon без label. | ✓ |
| Label становится пустой строкой | Различает «cleared» vs «never had». Двойная семантика не нужна (Phase 49 D-05 уже фиксирует whitespace ≡ unlabeled). | |
| Fallback на answerText | Ломает single-source-of-truth. | |

**User's choice:** Label ключ удаляется из edges (key removed).

### Q: Обратный сценарий: юзер стёр label у edge на канвасе до пустоты. Что происходит с Answer.displayLabel и другими входящими рёбрами?

| Option | Description | Selected |
|--------|-------------|----------|
| Симметрия: displayLabel → undefined + все incoming очищаются | Edge-wins действует симметрично; clearing — это намерение «убрать label». | ✓ |
| Пустая edge = «не трогать» (no-op) | Edge-wins асимметричен: только Node Editor может clear. Неинтуитивно. | |
| Первая оставшаяся non-empty edge побеждает | Скрывает намерение — label «возвращается» магически. | |

**User's choice:** Симметрия — clearing edge → clearing displayLabel + siblings.

---

## Multi-incoming + New Edge

### Q: Multi-incoming Answer (>1 Question→Answer edge на один Answer). Trade-off зафиксирован — все делят label. Нужна ли UI-подсказка?

| Option | Description | Selected |
|--------|-------------|----------|
| Только код-комментарий | Комментарий в parser/reconciler + Node Editor field, цитирующий design note. Без UI шума. | ✓ |
| Notice при первом обнаружении multi-incoming | Информирует, но шум для тех, кто так не работает. | |
| Inline подсказка в Node Editor | Полезно, требует UI работы в editor-panel-view.ts. | |

**User's choice:** Только код-комментарий (двух местах: reconciler + editor-panel-view.ts:443).

### Q: Новый edge с label создан на канвасе (Question→Answer ранее не существовал). Что с Answer.displayLabel?

| Option | Description | Selected |
|--------|-------------|----------|
| Новый label seed'ит displayLabel если тот empty | Покрывается существующим reconciler'ом (D-04 edge-wins). Спец-логики не нужно. | ✓ |
| Новый edge без label наследует displayLabel | Противоречит edge-wins (отсутствие label должно оставаться отсутствием). | |
| Ничего особенного, edge-wins + symmetry работают сами | Эквивалентно опции 1, но без явной фиксации в спеке. | |

**User's choice:** New edge seeds displayLabel via existing edge-wins rule.

---

## Done check

### Q: Что-то ещё?

| Option | Description | Selected |
|--------|-------------|----------|
| Готов писать CONTEXT.md | Все ключевые решения закрыты; остальное — Claude's Discretion / planner. | ✓ |
| Ещё вопросы | Performance, telemetry, undo/redo. | |

**User's choice:** Готов писать CONTEXT.md.

---

## Claude's Discretion (deferred to planner)

- Module organisation для reconciler'а (отдельный файл vs метод на CanvasLiveEditor).
- Точный debounce delay (default 250ms, < Obsidian 500ms requestSave).
- Console.warn telemetry на cold-open reconcile (debug only).
- Strategy A edge-write helper location (внутри editor-panel-view.ts vs новая утилита).
- Имена новых тест-фикстур.

## Deferred Ideas

- Per-edge label override (REQUIREMENTS Out-of-Scope row 1).
- Inline Node Editor warning для multi-incoming Answer.
- Notice/toast при cold-open реконсилe.
- Vault-wide migration sweep на plugin load.
- Undo/redo интеграция bi-directional sync.
- Reconcile telemetry / opt-in metrics.
