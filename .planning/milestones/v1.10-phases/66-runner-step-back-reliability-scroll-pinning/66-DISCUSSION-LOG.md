# Phase 66: Runner Step-Back Reliability & Scroll Pinning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 66-runner-step-back-reliability-scroll-pinning
**Areas discussed:** Single-click guarantee, Processing + step-back semantics, Scroll-pinning architecture, Loop scope + inline mode

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Гарантия 1-клик = 1-шаг | Как блокировать второй клик до завершения rerender | ✓ |
| Починка 'Processing...' + step-back semantics | stepBack() сам зовёт advanceThrough() / расширить UndoEntry / view зовёт advance явно | ✓ |
| Scroll-pinning архитектура | Точечно добавить capture / scroll-to-bottom by default / unified helper | ✓ |
| Loop-boundary scope + inline mode scope | Какие loop-сценарии в scope тестов; применяется ли RUNNER-04 к inline | ✓ |

**User's choice:** Все 4 области.

---

## Single-click guarantee

### Q1: Где живёт защита от двойного клика?

| Option | Description | Selected |
|--------|-------------|----------|
| State machine + view (Recommended) | ProtocolRunner.stepBack() in-flight flag + view button.disabled | ✓ |
| Только state machine | Только in-flight flag в раннере, view не меняется | |
| Только view | Кнопка disabled сразу после клика, re-enable при render | |

### Q2: Visual feedback?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard disabled (Recommended) | button.disabled = true — браузер сам приглушит opacity | ✓ |
| Custom CSS pressed/loading state | Новый .rp-step-back-btn--processing класс | |
| Silent (no visual change) | Без визуальных изменений | |

### Q3: addEventListener vs registerDomEvent в InlineRunnerModal?

| Option | Description | Selected |
|--------|-------------|----------|
| Оставить addEventListener | Не трогать паттерн, добавить guard внутри handler | |
| Переписать на registerDomEvent | Совпадение с RunnerView паттерном | |
| Shared helper bind() (Recommended) | Хелпер инкапсулирует click-binding с guard'ом — оба view зовут один хелпер | ✓ |

### Q4: На какие кнопки распространить защиту?

| Option | Description | Selected |
|--------|-------------|----------|
| Только Back (Recommended) | Фаза посвящена step-back. Остальные — out of scope | ✓ |
| Back + Skip | Обе кнопки footer row | |
| Все продвигающие кнопки | Universal guard в ProtocolRunner | |

---

## Processing + step-back semantics

### Q1: Как stepBack() восстанавливает правильный status?

| Option | Description | Selected |
|--------|-------------|----------|
| restoreStatus в UndoEntry (Recommended) | Расширить UndoEntry полем restoreStatus?: RunnerStatus; каждый push указывает | ✓ |
| stepBack зовёт advanceThrough | В конце stepBack — this.advanceThrough(this.currentNodeId) | |
| Рекурсивный pop | stepBack pop'ит дополнительные entries пока не landнёт на render-able status | |

### Q2: Куда возвращать back из awaiting-snippet-fill?

| Option | Description | Selected |
|--------|-------------|----------|
| К snippet picker (Recommended) | Back возвращает к awaiting-snippet-pick на том же snippet node | ✓ |
| К question | Back отменяет всю snippet-цепочку | |
| По разному для типов | Directory-bound → picker, file-bound → question | |

**Note:** В CONTEXT.md D-06 итоговое решение детализировано: directory-bound → picker, file-bound → question (т.к. picker не открывался). Q2 ответ относится к directory-bound случаю; file-bound chain сохраняет существующее поведение.

### Q3: Что делать с 'Processing...' default placeholder?

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить + exhaustiveness check (Recommended) | transitionToError + TS exhaustiveness | ✓ |
| Заменить на visible error | Видимый placeholder с node.kind | |
| Оставить как есть | Defence in depth | |

### Q4: Какой invariant тестируем для loop-boundary back?

| Option | Description | Selected |
|--------|-------------|----------|
| Roundtrip + scripted scenarios (Recommended) | Property test (forward N → back N) + 4 scripted | ✓ |
| Только snapshot-property | Для каждого UndoEntry: после stepBack текст === snapshot | |
| Только конкретные scripted сценарии | 3 fixture canvas + handcrafted assertions | |

---

## Scroll-pinning architecture

### Q1: Архитектура scroll-pinning?

| Option | Description | Selected |
|--------|-------------|----------|
| Scroll-to-bottom by default (Recommended) | renderPreviewZone всегда скроллит; удалить флажную логику | ✓ |
| Точечно добавить capture в step-back | Сохранить flag, добавить в 3 step-back точки | |
| Sticky flag до text-change | Флаг стоит пока длина текста не изменилась | |

### Q2: Manual user scroll position?

| Option | Description | Selected |
|--------|-------------|----------|
| Игнорировать, scroll в низ всегда (Recommended) | Click-action всегда scroll'ит в низ | ✓ |
| Detect manual scroll и уважать | Если scrollTop не в низу — не скроллить | |
| Scroll только если текст изменился | Сравнивать old.value vs new accumulatedText | |

### Q3: Реальное поведение Answer / dir-bound vs file-bound сейчас?

| Option | Description | Selected |
|--------|-------------|----------|
| Не важно — фиксим всё (Recommended) | scroll-by-default унифицирует все пути | ✓ |
| Я проверю вручную | Пользователь проверит в плагине | |
| Доверять roadmap'у | Чинить только file-bound + step-back | |

### Q4: Inline runner mode + RUNNER-04?

| Option | Description | Selected |
|--------|-------------|----------|
| RUNNER-04 только sidebar/tab (Recommended) | Inline = пишет в active note, scroll = Obsidian | ✓ |
| Scroll editor к месту вставки | scrollIntoView к последней вставленной строке | |
| Step-back в inline удаляет текст из note | Опасно, требует отдельного требования | |

---

## Loop scope + inline mode scope

### Q1: Inline mode step-back — что с уже вставленным текстом?

| Option | Description | Selected |
|--------|-------------|----------|
| Строго следовать SC3 | Inline удаляет дельту из note; pre-check user edits | |
| Inline back только state, не note | Runner state обновляется, note не трогается | ✓ |
| Inline back out of scope | RUNNER-03 SC3 для inline отложен | |

### Q2: Откуда берём loop fixtures?

| Option | Description | Selected |
|--------|-------------|----------|
| Существующие fixtures (Recommended) | unified-loop-valid.canvas, nested.canvas | ✓ |
| Новые fixtures под Phase 66 | 66-loop-back-deadend.canvas etc | |
| Программные graph builders | Без .canvas файлов | |

### Q3: Конкретные loop сценарии?

| Option | Description | Selected |
|--------|-------------|----------|
| Все 4 сценария (Recommended) | body + +exit + dead-end + nested | ✓ |
| 3 сценария без nested | nested через property test | |
| Только наблюдённые баги | Пользователь назовёт | |

### Q4: Manual UAT для RUNNER-04?

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted чеклист в UAT.md (Recommended) | Pattern из Phase 63 63-VALIDATION.md | ✓ |
| Unit test на textarea.scrollTop | jsdom хрупок для scrollHeight | |
| Playwright/E2E | Нет E2E harness в проекте | |

---

## Wrap-up

### Q: Готов к записи CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Готов, пиши CONTEXT.md | Все 4 области разобраны | ✓ |
| Ещё вопросы | Нерешённые моменты | |

---

## the agent's Discretion

- Точное имя `restoreStatus` поля в UndoEntry
- Точное имя shared helper'а / расширения `renderRunnerFooter`
- Имя in-flight флага в ProtocolRunner
- Расположение property roundtrip теста
- fast-check vs hand-rolled property generator
- Удаление "Processing..." — `transitionToError` или `console.error` + return

## Deferred Ideas

- Inline runner: text removal из note при step-back — будущая фаза
- Universal double-click guard на все мутирующие методы — будущая фаза
- Detect manual scroll и уважать user position — отвергнуто как избыточно
- Scroll-to-cursor в inline mode — будущая фаза если потребуется
- Keyboard shortcuts для Back — deferred ещё с Phase 65
- Playwright / E2E harness — отвергнуто как overhead

---

*Discussion log generated 2026-04-25*
