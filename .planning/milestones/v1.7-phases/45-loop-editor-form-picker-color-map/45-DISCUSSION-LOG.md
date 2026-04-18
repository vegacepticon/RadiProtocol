# Phase 45: Loop Editor Form, Picker & Color Map - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 45-loop-editor-form-picker-color-map
**Areas discussed:** LOOP-05 scope, LOOP-06 picker kinds + wiring, Loop label pattern, Sort/grouping, Kind-badge text

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| LOOP-05 scope | Что добавить сверх Phase 44 UAT-fix (тесты, подсказки, quick-create кнопка) | ✓ |
| LOOP-06 picker kinds | Какие kinds включить в NodePickerModal + что делать с dead code | ✓ |
| Loop label в picker'е | headerText/generic/id fallback | ✓ |
| Sort/grouping picker'а | Порядок узлов в списке | ✓ |

**User's choice:** all four (multiSelect).

---

## LOOP-05 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Lock-in тесты + quick-create | Unit-тесты на форму + quick-create кнопка «Create loop node» в тулбаре | ✓ |
| Только lock-in тесты | Только тесты, без quick-create UI | |
| Тесты + quick-create + подсказка про «выход» | Всё из 1 + setDesc подсказка про exit/body edges | |

**User's choice:** Lock-in тесты + quick-create (Recommended).
**Notes:** Quick-create кнопка — единственный маленький серьёзный UX gap; остальные две дельты либо тесты, либо authoring polish. Выбран минимальный pragmatic scope.

---

## LOOP-06 picker kinds

**Сначала было предложено 3 варианта в одном вопросе — пользователь попросил уточнить.** Объяснение расширилось: что такое NodePickerModal, его dead-code статус в `main.ts`, и почему answer семантически спорен как точка старта. Перевопросил разделив на 2 sub-вопроса.

### Sub-вопрос 1: Какие kinds в buildNodeOptions()?

| Option | Description | Selected |
|--------|-------------|----------|
| Все 5 (буква ROADMAP) | question + text-block + answer + snippet + loop | |
| 4 без answer | question + text-block + snippet + loop — answer исключён как не-самостоятельная точка старта | ✓ |
| Только +loop | Минимум: question + text-block + loop | |

**User's choice:** 4 без answer (Recommended).
**Notes:** Осознанное отклонение от буквы ROADMAP SC #3 ради UX-чистоты. Rationale записан в CONTEXT D-06.

### Sub-вопрос 2: Wiring команды в main.ts?

| Option | Description | Selected |
|--------|-------------|----------|
| Подключить команду | Добавить addCommand('start-from-node', ...) в main.ts — воскрешает v1.0 RUN-10 | ✓ |
| Не подключать | Только починить buildNodeOptions(), NodePickerModal остаётся dead code | |
| Удалить NodePickerModal целиком | Пересформулировать LOOP-06 и удалить dead code | |

**User's choice:** Подключить команду (Recommended).
**Notes:** Scope чуть шире LOOP-06, но delivers user-visible value: воскрешение v1.0 «Start from specific node» фичи.

---

## Loop label в picker'е

| Option | Description | Selected |
|--------|-------------|----------|
| Text-филд + id fallback | question → questionText \|\| id; loop → headerText \|\| id; и т.д. | ✓ |
| Text-филд + generic fallback | loop без headerText → 'Loop'; несколько безымянных loop'ов станут неразличимы | |
| Только text-филд (пустые отсеиваем) | Узел без текста не попадает в picker — risk потерять узел | |

**User's choice:** Text-филд + id fallback (Recommended).
**Notes:** Id-fallback гарантирует, что любой RP-узел виден в picker'е, даже если author забыл текст.

---

## Sort/grouping picker'а

| Option | Description | Selected |
|--------|-------------|----------|
| Kind-groups, entry-order | question → loop → text-block → snippet; внутри alphabetical | ✓ |
| Kind-groups, текущий порядок + new kinds в конец | question → text-block → snippet → loop (chronology of implementation) | |
| Flat alphabetical | Все kinds смешаны, сортировка по label | |

**User's choice:** Kind-groups, entry-order (Recommended).
**Notes:** Order отражает реальную частоту точек старта у радиолога. Сохраняет v1.0 «questions first» поведение.

---

## Kind-badge text (уточнение)

| Option | Description | Selected |
|--------|-------------|----------|
| Русские ярлыки | Вопрос / Текст / Сниппет / Цикл (через local map) | ✓ |
| Английские kind-literals | Текущее v1.0 поведение: 'question', 'text-block' и т.д. | |
| Без badge | Убрать `<small>{kind}</small>` вообще | |

**User's choice:** Русские ярлыки (Recommended).
**Notes:** Consistency с существующим русскоязычным runner UI («выход», migration errors, loop picker).

---

## Claude's Discretion

- Имя Lucide-иконки для quick-create loop кнопки (D-CL-01)
- CSS-класс loop-кнопки (D-CL-02)
- Zero-delta vs новая ветка в CanvasNodeFactory (D-CL-03)
- Язык notice'ов при ошибках start-from-node (D-CL-04)
- Snippet-узел fallback label без subfolderPath (D-CL-05)
- UX когда canvas имеет validator-ошибки в start-from-node flow (D-CL-06)

## Deferred Ideas

- «Convert to unified loop» кнопка для legacy форм — out-of-scope v1.7 (REQUIREMENTS Out of Scope)
- Placeholder/подсказка про «выход» в loop-форме — отложено до UAT-жалоб
- Answer-узлы в picker'е — backlog idea, одна ветка в switch если понадобится
- Hotkey `start-from-node` — оставляем пользователю через Obsidian Settings
- i18n Obsidian-native строк picker'а — отдельная будущая фаза
