# Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 69-inline-runner-hide-result-export-buttons-in-complete-state
**Areas discussed:** Scope удаления кнопок, Run again в inline, Render-механика toolbar, Визуал complete-state

---

## Scope удаления кнопок

### Question 1.1: Где прячем кнопки Copy/Save/Insert в Inline-режиме?

| Option | Description | Selected |
|--------|-------------|----------|
| Во всех inline-состояниях (Recommended) | Ни в одном состоянии inline-модала эти три кнопки не рендерятся. Их disabled-вид сейчас — визуальный балласт, ведь Inline всё равно вставляет в заметку в реальном времени. PROJECT.md формулировка «remove redundant buttons» общая, без привязки к complete. Минус — изменение шире буквального текста INLINE-CLEAN-01. | ✓ |
| Только в complete | Буквальный INLINE-CLEAN-01: в `complete` кнопок нет, в остальных состояниях disabled-кнопки остаются как сейчас. Минимальный blast radius. Минус — непоследовательно. | |

**User's choice:** Во всех inline-состояниях
**Notes:** Inline пишет в активную заметку в реальном времени, кнопки избыточны на всех этапах.

### Question 1.2: Как формализуем расширенный scope против буквы INLINE-CLEAN-01?

| Option | Description | Selected |
|--------|-------------|----------|
| Обновить REQUIREMENTS+ROADMAP (Recommended) | В первом плане Phase 69 переформулировать INLINE-CLEAN-01 на «no longer rendered in any Inline Runner state» + обновить §Phase 69 Goal/SC в ROADMAP.md. Прецедент — Phase 67 D-13. | ✓ |
| Только CONTEXT.md | Оставляем REQUIREMENTS.md и ROADMAP.md как есть, фиксируем расширенное чтение только в CONTEXT.md и commit-message. Минус — milestone-аудит SC#1 буквально скажет «running to completion in Inline mode — buttons absent from DOM», а код будет шире. | |
| Узкий scope, вернуть решение | Откатить предыдущий ответ: прячем только в complete-state, без изменений в REQUIREMENTS.md/ROADMAP.md. | |

**User's choice:** Обновить REQUIREMENTS+ROADMAP
**Notes:** Phase 67 D-13 паттерн — scope-аменд в первом плане фазы.

### Question 1.3: Насколько плотно тестить расширенный scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + sidebar/tab в каждом состоянии (Recommended) | В новом или расширенном тесте проверить, что в каждом из 6 inline-состояний кнопок нет в DOM. И один cross-mode regression-тест на RunnerView, что кнопки в sidebar `complete` остаются. Жёсткий лок на SC. | ✓ |
| Только complete-state обоих режимов | Проверяем только complete: inline — кнопок нет; sidebar — все три присутствуют. Не ловит регрессию «по ошибке вернули disabled-кнопки в awaiting-*». | |
| Inline во всех состояниях, sidebar — без регрессии | Sidebar/tab покрывается существующими тестами неявно. Риск — ни один не утверждает явно «sidebar complete всё ещё имеет 3 кнопки». | |

**User's choice:** Inline + sidebar/tab в каждом состоянии

### Question 1.4: Ещё вопросы по Scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Переходим к Run again (Recommended) | Scope-решения залоканы: hide во всех inline-состояниях, аменд REQUIREMENTS.md/ROADMAP.md, тесты по состояниям + sidebar regression на complete. | ✓ |
| Ещё вопросы по Scope | Есть что-то недосказанное по расширенному scope. | |

**User's choice:** Переходим к Run again

---

## Run again в inline

### Question 2.1: Добавлять ли Run again в Inline complete-state для паритета с sidebar/tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Не добавлять (Recommended) | «Where applicable» в roadmap-формулировке = Inline не применимо: Close (X в шапке) уже закрывает модал, и рестарт через команду или реоткрытие окна окажется идентичным. INLINE-CLEAN-01 буквально не требует Run again в этой фазе; расширение — scope creep, лучше deferred. | ✓ |
| Добавить рядом с Close в шапке | Новая иконочная кнопка (например `rotate-ccw`) рядом с X. Объём: новый элемент в `buildContainer()` + restart-handler + CSS + visible-only-when-complete гейт. Риск — лайфцайкл модала и Phase 60/67 drag/resize state. | |
| Добавить в questionZone в complete | Копируем sidebar `runner-view.ts:686-704` (`rp-run-again-btn`). Однороднее с sidebar; но опять выходит за букву INLINE-CLEAN-01. | |

**User's choice:** Не добавлять
**Notes:** Перенос в Deferred Ideas для будущей фазы.

---

## Render-механика toolbar

### Question 3.1: Как технически подавить кнопки в inline-режиме?

| Option | Description | Selected |
|--------|-------------|----------|
| Не создавать outputToolbar и не вызывать renderOutputToolbar (Recommended) | В `render()` убираем создание div + все 6 вызовов. Сама функция `renderOutputToolbar` остаётся dead-code или удаляется. DOM чист от пустых обёрток; изменения в одном месте. | ✓ |
| Early-return внутри renderOutputToolbar | Оставляем 6 вызовов, но в начале функции `return;`. Минимальный дифф, но DOM имеет пустой `<div class="rp-output-toolbar">` в каждом состоянии. | |
| Refactor с флагом shared библиотеки | Извлечь общую `renderOutputToolbar` в helper с `mode: 'inline' | 'sidebar'`. Pattern Phase 65 `renderRunnerFooter`. Но логика сейчас разная (sidebar читает `previewTextarea?.value`, inline — нет); refactor выходит за phase scope. | |

**User's choice:** Не создавать outputToolbar и не вызывать renderOutputToolbar

### Question 3.2: Что делать с больше не вызываемым `renderOutputToolbar` в inline-runner-modal.ts?

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить метод сразу (Recommended) | Делитим весь `private renderOutputToolbar(...)` (lines 960-1002) в `inline-runner-modal.ts`. CLAUDE.md «не оставляй dead code». `plugin.saveOutputToNote` и `plugin.insertIntoCurrentNote` НЕ трогаем — живы для sidebar. | ✓ |
| Оставить как dead code | Не удалять, чтобы не расширять дифф фазы. ESLint `no-unused-private` поймает позже. | |
| Оставить, добавить eslint-disable | Сохранить как backup. Бессмысленно, если Run again в inline решили НЕ добавлять. | |

**User's choice:** Удалить метод сразу

### Question 3.3: Что делать с dead CSS-правилами для `.rp-inline-runner-content .rp-output-toolbar`?

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить все 3 блока с CLAUDE.md exception (Recommended) | Аналогично Phase 67 D-14 exception: эти правила «load-bearing wrong code» — их селектор перестанет матчить любой DOM. Документируем исключение в PLAN.md/commit. CSS-файл остаётся чистым. | ✓ |
| Оставить как dead CSS | Не трогать эти 3 блока. CLAUDE.md «никогда не удаляй то, что не добавлял» буквально. Минус — 16 строк CSS без соответствующего DOM-узла. | |
| Удалить вместе с базовым правилом в runner-view.css | Дополнительно убрать `.rp-output-toolbar` из `runner-view.css:58`. НЕТ — оно нужно для sidebar и tab Runner View, которые сохраняют toolbar. Это удалит базовое правило и сломает sidebar — НЕ трогаем. | |

**User's choice:** Удалить все 3 блока с CLAUDE.md exception

### Question 3.4: Ещё вопросы по Render-механике?

| Option | Description | Selected |
|--------|-------------|----------|
| Переходим к Визуал complete-state (Recommended) | Render-механика залокана. | ✓ |
| Ещё вопросы по Render | Нужно уточнить хелперы/тесты. | |

**User's choice:** Переходим к Визуал complete-state

---

## Визуал complete-state

### Question 4.1: Что показывать в Inline `case 'complete'` кроме заголовка «Protocol complete»?

| Option | Description | Selected |
|--------|-------------|----------|
| Только заголовок, без добавлений (Recommended) | Оставить как есть: `<h2>Protocol complete</h2>` + Close в шапке. Минимализм соответствует «убрать redundant», ничего не добавляем. Риск — для растянутого (Phase 67) модала выглядит пустым. | ✓ |
| Короткий статус под заголовком | <p> вроде «Текст записан в [name].md» (`this.targetNote.basename`). Не кнопка, просто текст. Но это новый UI вне INLINE-CLEAN-01. | |
| Превью final-text в модале | Скопировать sidebar `renderPreviewZone` + final-text. Структурное изменение inline (Phase 54 дизайн «нотка = буфер»). Никто не просил. Scope creep. | |

**User's choice:** Только заголовок, без добавлений

---

## Done check

### Question 5.1: Остались ли неразобранные gray areas?

| Option | Description | Selected |
|--------|-------------|----------|
| Готов к CONTEXT.md (Recommended) | Все 4 area закрыты. Записываем CONTEXT.md + DISCUSSION-LOG.md, чистим чекпойнт, коммитим, обновляем STATE.md. | ✓ |
| Исследовать ещё gray areas | Есть недостающие моменты — сформулируем новые area's. | |

**User's choice:** Готов к CONTEXT.md

---

## Claude's Discretion

- Имя нового файла тестов (`inline-runner-modal-output-toolbar.test.ts` vs расширение `inline-runner-modal.test.ts`).
- Точная формулировка переписанного `INLINE-CLEAN-01` и обновлённого §Phase 69 в ROADMAP.md.
- Стоит ли удалять переменную `outputToolbar` в `render()` или оставлять `null`.
- Точная формулировка CLAUDE.md exception в PLAN.md и commit-message.
- Стоит ли в этой же phase обновить тесты `inline-runner-modal.test.ts:374,396,...` или оставить как есть.

## Deferred Ideas

- Run again в Inline — паритет с sidebar/tab. Возможная будущая фаза.
- Статус-строка «Текст записан в [target note name]» в Inline complete — отвергнуто по minimalism.
- Preview final-text в Inline complete — Phase 54 «note as buffer» дизайн.
- Refactor `renderOutputToolbar` в shared helper — бессмысленно после удаления inline-копии.
