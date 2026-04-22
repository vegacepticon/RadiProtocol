# Phase 56: Snippet Button UX Reversal — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 56-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 56-snippet-button-ux-reversal
**Areas discussed:** Single-edge file-bound render, Click dispatch path, Unsaved-change indicator, Committed-state button

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Рендер single-edge file-bound | SC 1 caption/вид для сингл-ветки | ✓ |
| Click dispatch путь | SC 2 маршрутизация клика | ✓ |
| «Не сохранено» индикатор | SC 6 UX несохранённого выбора | ✓ |
| Committed-state кнопки | SC 7 визуальное подтверждение | ✓ |

**User's choice:** все четыре зоны.

---

## Single-edge file-bound render

| Option | Description | Selected |
|--------|-------------|----------|
| Точно как sibling (Recommended) | Тот же CSS + D-16 caption fallback; один код-путь | ✓ |
| Отдельный вид | Новый CSS/дизайн под single-option (шире / без emoji) | |
| Claude's discretion | Решение на executor'е в рамках append-only CSS | |

**User's choice:** унифицированный вид (sibling-style).
**Notes:** одна ветка рендера — меньше кода, одинаковый жест пользователю.

---

## Click dispatch path

| Option | Description | Selected |
|--------|-------------|----------|
| Новый pickFileBoundSnippet (Recommended) | Явный метод ProtocolRunner с собственным undo-push и переходом в awaiting-snippet-fill | ✓ |
| Переиспользовать pickSnippet | Из sibling-кнопки вызывать существующий pickSnippet напрямую | |
| Перенести auto-insert в click | Вырезать D-13 блок, сделать private-метод, вызвать из click handler'а | |

**User's choice:** новый публичный метод `pickFileBoundSnippet`.
**Notes:** явный API развязывает UX-слой от auto-insert семантики и упрощает тестирование.

---

## Unsaved-change indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Точка у label «Папка» (Recommended) | Маленькая • accent-цвета рядом с надписью «Папка» | ✓ |
| Бейдж в header модалки | «Несохранённые изменения» глобально в верхней части | |
| И точка, и бейдж | Дублирование обоих сигналов | |
| Цветной border поля | Подсветка самого input-поля | |

**User's choice:** точка у label.
**Notes:** компактно, локально, не требует глобальной верстки.

---

## Committed-state button

| Option | Description | Selected |
|--------|-------------|----------|
| Постоянный accent + «✓ Выбрано» (Recommended) | Смена фона + label до изменения drill/закрытия picker'а | ✓ |
| Flash + возврат | Короткое accent-мигание на ~400ms | |
| Постоянный accent без смены label | Только смена фона | |

**User's choice:** постоянный accent + label «✓ Выбрано».
**Notes:** долговременный визуальный якорь; сбрасывается при переходе в другую папку или закрытии picker'а.

---

## Claude's Discretion

- Exact CSS pixel values (dot size, spacing).
- Whether `src/styles/snippet-editor-modal.css` becomes a new feature file or styles append to existing.
- Method signature refinements for `pickFileBoundSnippet`.
- Test observation strategy for `SnippetTreePicker` committed-state internals.

## Deferred Ideas

- Multi-select folder commit.
- Global unsaved badge in modal header.
- Flash-and-return committed animation.
- Settings toggle to restore auto-advance.
- Mixed sibling buttons (specific + directory-bound) visual variant (already Out-of-Scope per REQUIREMENTS.md).
