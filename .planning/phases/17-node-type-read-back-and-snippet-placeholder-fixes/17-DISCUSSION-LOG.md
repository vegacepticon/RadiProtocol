# Phase 17: Node Type Read-Back and Snippet Placeholder Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 17-node-type-read-back-and-snippet-placeholder-fixes
**Areas discussed:** BUG-02/03 root cause, BUG-04 root cause, TDD approach

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| BUG-02/03 root cause | What fails when runner reaches a Node-Editor-configured node | ✓ |
| BUG-04 root cause | What the Add button does (or doesn't do) | ✓ |
| TDD vs fix-first | Whether to write RED tests first | ✓ |

**User's note:** Хочу обсудить все области на русском языке.

---

## BUG-02/03: Runner Behavior at Misconfigured Node

| Option | Description | Selected |
|--------|-------------|----------|
| Узел пропускается / игнорируется | Раннер проходит мимо узла — никакого промпта и никакого текста | |
| Ошибка / protocol завершается | Раннер показывает ошибку или переходит в error-state | |
| Узел ведёт себя как question-узел | Показываются кнопки ответов вместо поля ввода текста или авто-продвижения | |
| Не знаю — баг не воспроизводился лично | Баг описан в требованиях, но точное поведение под вопросом | |

**User's choice:** "Он не отображается вместе с другими узлами, которые отходят от узла ответа"
**Notes:** Узел не появляется наряду с другими узлами, соединёнными с узлом ответа — т.е. он отсутствует в разобранном графе и пропускается раннером.

---

## BUG-02/03: Where Does the Bug Manifest?

| Option | Description | Selected |
|--------|-------------|----------|
| Node Editor не читает тип обратно | После сохранения повторное открытие узла показывает «— unset —» | |
| Node Editor показывает верно, раннер — нет | После сохранения Node Editor корректен, раннер ведёт себя неправильно | ✓ |
| Тип сохраняется, но поля узла теряются | Тип виден в дропдауне, но доп. поля не применяются в раннере | |

**User's choice:** Node Editor показывает верно, раннер — нет
**Notes:** Node Editor читает тип правильно (диск обновлён к этому моменту), раннер не видит `radiprotocol_nodeType`.

---

## BUG-02/03: Canvas Open or Closed During Repro?

| Option | Description | Selected |
|--------|-------------|----------|
| Канвас открыт | Пользователь открыл Canvas-вью, настроил узел, сохранил через Node Editor, затем открыл раннер — при этом Canvas всё ещё открыт в другой вкладке | ✓ |
| Канвас закрыт | Настройка шла через Strategy A (vault.modify()) | |

**User's choice:** Канвас открыт
**Notes:** Баг воспроизводится именно в live-path: `saveLive()` → `setData()` → debounced `requestSave()`. Если раннер открывается в 500мс-окне до flush — диск устарел.

---

## BUG-02/03: Fix Approach

| Option | Description | Selected |
|--------|-------------|----------|
| runner читает из getData() | В openCanvas(): если канвас открыт, читать из canvas.getData() вместо vault.read() | ✓ |
| saveLive() + vault.modify() сразу | После setData() немедленно записывать на диск через vault.modify() | |
| debounce убрать / сделать 0мс | requestSave() вызывается сразу после setData() | |

**User's choice:** runner читает из getData() (Recommended)
**Notes:** Самый чистый подход: добавить публичный метод `getCanvasJSON()` в `CanvasLiveEditor`; `openCanvas()` использует его если canvas открыт, иначе `vault.read()`.

---

## BUG-04: Add Button Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Add не реагирует вообще | Клик ничего не делает — форма остаётся открытой, поле не очищается | ✓ |
| Add закрывает форму, но placeholder не добавляется | Мини-форма скрывается, но список не обновляется | |
| Add работает, но поле не очищается | placeholder добавляется и в шаблон, но лейбл остаётся заполненным | |

**User's choice:** Add не реагирует вообще
**Notes:** Обработчик клика вообще не срабатывает. Root cause — для исследователя: `registerDomEvent(miniAddBtn, 'click', ...)` в snippet-manager-view.ts ~строка 244.

---

## TDD Approach

| Option | Description | Selected |
|--------|-------------|----------|
| TDD: RED затем GREEN | Сначала пишем тесты (провальные), затем фиксируем | ✓ |
| Фикс сразу, убеждаемся через UAT | Исправляем код, затем ручное UAT | |

**User's choice:** TDD: RED затем GREEN
**Notes:** Устоявшийся паттерн из Phase 12 и 14. BUG-02/03 хорошо тестируются на уровне canvas-parser.ts (pure module). BUG-04 — DOM-зависимый код, юнит-тест может быть ограничен; UAT-верификация дополнит.

---

## Claude's Discretion

- Точное имя метода `getCanvasJSON` (или аналог) в CanvasLiveEditor
- Обновлять ли `renderNodeForm()` в EditorPanelView для чтения из live-данных (опционально, как улучшение консистентности)
- Внутренняя реализация фикса BUG-04 (добавить `type="button"` на кнопку, event delegation, пересборка обработчика и т.д.)

## Deferred Ideas

None.
