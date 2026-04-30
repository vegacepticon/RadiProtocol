# Phase 29: Snippet Node — Model, Editor, Validator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 29-snippet-node-model-editor-validator
**Areas discussed:** Subfolder picker UX, Текст узла в canvas, Validator warning vs error, Цвет узла snippet

---

## Subfolder Picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Дроп-даун с live-листингом | Async: vault.adapter.list() при рендере формы, <select> с найденными подпапками | ✓ |
| Текстовый ввод | Обычный <input type=text>, автор вводит путь вручную | |
| Текст + кнопка Browse | Текстовое поле + модальный FolderSuggestModal | |

**User's choice:** Дроп-даун с live-листингом

**Follow-up — уровень листинга:**

| Option | Description | Selected |
|--------|-------------|----------|
| Flat — только первый уровень | Только непосредственные подпапки | |
| Flat с полными путями | Рекурсивный обход, все подпапки с полными путями (CT/adrenal, CT/lung/nodes) | ✓ |

**User's choice:** Flat с полными путями (рекурсивный обход)

---

## Текст узла в canvas

| Option | Description | Selected |
|--------|-------------|----------|
| "Snippet: {path}" | Комбо с префиксом типа | |
| Только путь | Только значение subfolder path, напр. CT/adrenal | ✓ |
| "Snippet" (fixed) | Фиксированная метка, не различает узлы | |

**User's choice:** Только путь

---

## Validator warning vs error

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking warning | validate() добавляет строку предупреждения, runner запускается | |
| Блокирующая ошибка | validate() возвращает ошибку, runner не запускается без subfolder | |
| Fallback на root (user suggestion) | Если subfolder не задан — автоматически использовать root .radiprotocol/snippets | ✓ |

**User's choice:** Fallback на root `.radiprotocol/snippets` — отсутствие subfolder валидно, ошибок нет

**Follow-up — нужен ли info-warning валидатора при fallback:**

| Option | Description | Selected |
|--------|-------------|----------|
| Нет, валидатор молчит | Отсутствие subfolder — валидная конфигурация, SNIPPET-NODE-08 отпадает | ✓ |
| Да, показывать info-предупреждение | Non-blocking info о fallback поведении | |

**User's choice:** Валидатор молчит. SNIPPET-NODE-08 superseded by fallback design.

---

## Цвет узла snippet

| Option | Description | Selected |
|--------|-------------|----------|
| Purple "6" | Единственный незанятый цвет в палитре Obsidian | ✓ |
| Любой другой | Поделить цвет с существующим типом | |

**User's choice:** Purple `"6"`

---

## Claude's Discretion

- Реализация рекурсивного помощника для листинга папок (inline или shared utility)
- Точный async-паттерн загрузки в форме EditorPanel (при loadNode или при рендере)

## Deferred Ideas

None
