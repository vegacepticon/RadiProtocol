# Phase 53: Runner Skip & Close Buttons - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 53-runner-skip-close-buttons
**Areas discussed:** Button placement, Skip state coverage + behavior, Visual treatment + accessibility, Close confirmation + target state

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Размещение кнопок | Где в Runner UI живут Skip/Close | ✓ |
| Skip: охват состояний + поведение | В каких состояниях Skip активен; куда идёт; undo | ✓ |
| Визуал и доступность | Текст vs иконки; destructive styling; когда Close видна | ✓ |
| Close: подтверждение + целевое состояние | Когда подтверждать; итоговое состояние после Close | ✓ |

**User's choice:** Все четыре области — full scope discussion.

---

## Размещение кнопок

| Option | Description | Selected |
|--------|-------------|----------|
| Вместе в output toolbar | Skip/Close рядом с Copy/Save/Insert | |
| Skip в question zone, Close рядом с selector | Skip под answers (runtime nav); Close ✕ в selector bar (canvas-level) | ✓ |
| Отдельная runner-toolbar | Новая строка rp-runner-actions между selector и preview | |

**User's choice:** Skip в question zone, Close рядом с selector.
**Notes:** Семантически правильное разделение runtime-nav vs canvas-level actions.

---

## Skip: охват состояний

| Option | Description | Selected |
|--------|-------------|----------|
| Только at-node question | Минимальный scope; Skip виден только при показе answers | ✓ |
| at-node question + все picker'ы | Универсальный Skip в all interactive states | |
| Везде кроме idle/complete/error | Включая text-block auto-advance для симметрии | |

**User's choice:** Только at-node question.
**Notes:** Skip сужен до того состояния, где у пользователя есть активный выбор, а не автоматический переход.

---

## Skip: target при branching

| Option | Description | Selected |
|--------|-------------|----------|
| До следующего merge point | Advance через первый answer edge (adjacency order), без вставки текста | ✓ |
| Завершает протокол (complete) | Skip = "выход"; автор рисует явный skip-edge если нужно продолжение | |
| Skip доступен только при 1 ветви | Если неоднозначно — disabled | |

**User's choice:** До следующего merge point.
**User's wording:** «Хочу чтобы skip пропускал текущий узел просто, пропускал текущий выбор и просто осуществлял переход к следующему узлу по сценарию».
**Notes:** Pragmatic choice — skip проходит по графу как «линейный advance», даже при параллельных ветвях, выбирая первый по adjacency.

---

## Skip: undo

| Option | Description | Selected |
|--------|-------------|----------|
| Да, Skip — полноценный choice (С UndoEntry) | Пушит undo snapshot; step-back возвращает к question с answers | ✓ |
| Нет, Skip — односторонний | Не добавляет UndoEntry; вернуться нельзя | |

**User's choice:** Полноценный choice с UndoEntry.
**Notes:** Консистентно с answer-выбором и snippet-pick'ом; юзер может передумать.

---

## Визуал и доступность

| Option | Description | Selected |
|--------|-------------|----------|
| Текстовые кнопки | «Пропустить» / «Закрыть» | |
| Иконки (Obsidian setIcon) | ⏭ + ✕ через lucide; tooltip + aria-label | ✓ |
| Смешанно (Skip text, Close icon) | Разные контексты — разный язык | |

**User's choice:** Иконки через Obsidian setIcon.
**Notes:** Matches Obsidian native style; компактно в selector bar; aria-label + tooltip для discoverability.

---

## Close: styling + visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Нейтральная, всегда когда canvas загружен | ✕ видна в любом состоянии (включая complete/error) | |
| Нейтральная, всегда; подтверждение только при in-progress | Close всегда видна; модалка только в at-node/awaiting-* | ✓ |
| Destructive, только при активной сессии | Красная ✕, видна только когда есть что терять | |

**User's choice:** Нейтральная, всегда видна; подтверждение только при in-progress.
**Notes:** Зеркалит D-12/D-13 switch logic. Destructive стиль избыточен — сам modal содержит warning. В complete/error закрывается тихо.

---

## Close: target state

| Option | Description | Selected |
|--------|-------------|----------|
| Полный reset к 'no canvas selected' | sessionService.clear + selector placeholder + idle render | ✓ |
| Reset, но selector помнит предыдущий canvas | Quick re-run hint в selector | |

**User's choice:** Полный reset.
**Notes:** Clean exit — как если бы плагин только что включили. Никаких "призрачных" состояний selector'a.

---

## Claude's Discretion

- Точный lucide icon name — планировщик подтвердит доступность `skip-forward` / `x` в Obsidian bundle.
- DOM-структура Skip (сибллинг answer-list или новый `rp-runner-nav` контейнер) — планировщик/экзекьютор.
- Disabled vs hidden, когда question не имеет answer-соседей — планировщик выбирает и документирует trade-off.
- Нужен ли a11y-wrapper (`role="toolbar"`) вокруг Skip — планировщик.

## Deferred Ideas

- Skip в snippet-picker / loop-picker / snippet-fill modal — отклонено в D-07; может быть отдельной фазой.
- Author-defined "skip"-edge (по аналогии с loop «выход») — explicit reject.
- Keyboard shortcuts для Skip/Close (S / Esc) — вне scope.
- Destructive styling для Close с переменной видимостью — reject.
- Selector "memory" о последнем canvas'е как quick-run hint — reject.
- Skip как необратимое действие без undo — reject.
