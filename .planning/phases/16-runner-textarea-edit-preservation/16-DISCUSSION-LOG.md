# Phase 16: Runner Textarea Edit Preservation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 16-runner-textarea-edit-preservation
**Areas discussed:** Edit capture timing, Coverage — which advance actions, Complete state behavior

---

## Edit Capture Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Перед каждым действием | Читаем textarea.value в обработчике кнопки до вызова runner-метода; минимум кода, undo захватывает правку автоматически | ✓ |
| Живая синхронизация | На каждый input обновляем аккумулятор; undo-стек захватывал бы промежуточные состояния — сложнее | |

**User's choice:** Перед каждым действием (capture-before-advance)
**Notes:** Пользователь выбрал этот вариант как рекомендуемый. Новый метод `runner.syncManualEdit(text)` вызывается в обработчике кнопки до вызова `chooseAnswer` / `enterFreeText` / `chooseLoopAction`.

---

## Coverage — Which Advance Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Все три | chooseAnswer, enterFreeText, chooseLoopAction — все интерактивные шаги вперёд | ✓ |
| Только кнопки ответа | Только chooseAnswer; остальные без изменений | |

**User's choice:** Все три действия
**Notes:** Пользователь видит textarea на каждом интерактивном шаге (question, free-text-input, loop-end). Все три должны синхронизировать правки. Step-back не синхронизирует — откат намеренно сбрасывает текущие правки.

---

## Complete State Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Читать из textarea | textarea.value на момент нажатия кнопки — правки пользователя сохраняются | ✓ |
| Использовать finalText раннера | state.finalText — правки в textarea игнорируются | |
| Отложить | Не BUG-01; оставить текущее поведение | |

**User's choice:** Читать из textarea (правки сохраняются)
**Notes:** Кнопки Copy / Save / Insert читают `this.previewTextarea?.value` в момент клика. Позволяет быстро подправить финальный отчёт без перезапуска протокола. Аналогично поведению активных шагов.

---

## Claude's Discretion

- Имя нового метода `ProtocolRunner.syncManualEdit(text)` и `TextAccumulator.overwrite(text)` — на усмотрение Claude
- Паттерн `overwrite` зеркалит `restoreTo` — без undo-семантики
- Замена `capturedText`-замыкания в `renderOutputToolbar` для complete-состояния

## Deferred Ideas

None.
