# Phase 52 — Discussion Log

**Date:** 2026-04-20
**Mode:** discuss (interactive, RU)

Audit trail of questions asked during `/gsd-discuss-phase 52` and user's selections. Not consumed by downstream agents — see `52-CONTEXT.md` for locked decisions.

---

## Gray area selection

**Q:** Какие области обсудим для Phase 52? (multiSelect)
- Options presented:
  1. Дисковая схема JSON — имена типа на диске, поле separator, судьба unit
  2. Hard-reject legacy — где валидация, что видит пользователь
  3. UI unified choice — multi-select формат + Custom override
  4. Что с 'number' и unit
- **User selected:** All four.

---

## Area 1: Дисковая схема JSON

**Q1:** Какое строковое имя типа пишется в .json?
- Options:
  - `'free-text'` / `'choice'` (Recommended) — оставить текущий дефисный формат
  - `'free text'` / `'choice'` — перейти на формат из design note (с пробелом)
- **User selected:** `'free-text'` / `'choice'` (Recommended). → D-01.

**Q2:** Как называется поле разделителя в .json и в TS-типе?
- Options:
  - `'separator'` (Recommended) — переименовать по design note
  - `'joinSeparator'` — оставить текущее имя
  - Оба (read-both, write `'separator'`) — graceful чтение
- **User selected:** `'separator'` (Recommended). → D-02.

---

## Area 2: Hard-reject legacy

**Q3:** Где технически падает сниппет с удалённым типом (`number` / `multichoice` / нечитаемый старый `choice`)?
- Options:
  - В `SnippetService.load`/`listFolder` (Recommended) — единая точка, все пути ловят
  - В `GraphValidator` при open canvas — только при открытии canvas
  - В обоих местах — двойная защита
- **User selected:** `SnippetService.load`/`listFolder` (Recommended). → D-03.

**Q4:** Где пользователь видит ошибку про легаси-тип?
- Options:
  - Editor + Runner error panel (Recommended) — banner в editor + error-panel в Runner
  - Только Editor — banner + отфильтровать в Runner picker
  - Только в Runner — Notice + error-panel, в editor тихо
- **User selected:** Editor + Runner error panel (Recommended). → D-04.

---

## Area 3: UI unified choice

**Q5:** Как показывать unified `choice` в `snippet-fill-in-modal`?
- Options:
  - Checkbox-список (Recommended) — как текущий multi-choice UI
  - Chip toggle (tag-style)
  - Multi-select `<select multiple>`
- **User selected:** Checkbox-список (Recommended). → D-05.

**Q6:** Судьба Phase 31 D-09 «Custom:» free-text override?
- Options:
  - Оставить как есть (Recommended) — Custom перебивает checkbox'ы
  - Убрать `Custom:` — только options
- **User selected:** Оставить как есть (Recommended). → D-06.

---

## Area 4: Судьба 'number' и unit

**Q7:** `number` удаляется из union. Что делаем с суффиксом-единицей (`{value} {unit}`)?
- Options:
  - Удалить полностью (Recommended) — по design note
  - Оставить unit на `free-text` как опциональный
  - unit на все типы (включая choice)
- **User selected:** Удалить полностью (Recommended). → D-07.

---

## Follow-up clarifications

**Q8:** Сниппет Goal пишет, что «options-list editor сломан». В каком именно UI он сломан?
- Options:
  - В Snippet Editor Modal (Phase 33) — новый путь
  - В legacy SnippetManagerView — старый путь, всё ещё живёт
  - Не знаю точно — research воспроизведёт в dev-вауле
- **User selected:** Не знаю точно. → D-08 (исследователь локализует в RESEARCH.md).

**Q9:** Что вставляется, если в unified `choice` пользователь не выбрал ни один option и не ввёл Custom?
- Options:
  - Пустая строка (Recommended) — сохранить текущее поведение
  - Заблокировать Confirm — вводит «required» семантику
- **User selected:** Пустая строка (Recommended). → D-09.

---

## Wrap-up

**Q10:** Готов к CONTEXT.md?
- Options:
  - Создать CONTEXT.md (Recommended)
  - Обсудить ещё — дополнительные гей-зоны
- **User selected:** Создать CONTEXT.md (Recommended).

---

## Scope creep / deferred during discussion

- **Marker в tree для битых сниппетов** — обсуждено в Area 2, отнесено в Deferred (banner в editor + Runner error-panel достаточно для MVP).
- **`required` семантика для `choice`** — рассматривалась в Q9, отклонена (пустая строка сохраняется).
- **`unit` на free-text как опциональный** — предложено в Q7, отклонено пользователем в пользу полного удаления.

---

*Log compiled from AskUserQuestion transcript, 2026-04-20.*
