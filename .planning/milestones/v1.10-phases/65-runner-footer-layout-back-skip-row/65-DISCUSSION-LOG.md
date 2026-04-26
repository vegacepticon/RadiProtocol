# Phase 65: Runner Footer Layout - Back/Skip Row - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `65-CONTEXT.md`.

**Date:** 2026-04-25
**Phase:** 65-runner-footer-layout-back-skip-row
**Areas discussed:** Footer placement, button copy style, cross-state row rules, shared render pattern

---

## Gray Areas Selected

The user selected all proposed areas and requested that the discussion continue in Russian.

| Area | Why it mattered |
|------|-----------------|
| Footer placement | Determines DOM order and fixes Skip intrusion between answer and snippet branch groups. |
| Button copy style | Roadmap asked for `back`/`skip`, but current UI uses `Step back` and icon-only Skip. |
| Cross-state row rules | Back exists in non-question states while Skip is question-only; the row needs consistent behavior. |
| Shared render pattern | `RunnerView` and `InlineRunnerModal` have duplicated render paths and already show drift risk. |

---

## Footer Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Под всеми ветками | Back+Skip go in a dedicated row below answer/snippet/loop/picker UI and above Copy/Save/Insert toolbar. | Yes |
| Сразу под ответами | Back+Skip after answer buttons but before snippet buttons. | No |
| В output toolbar | Back+Skip next to Copy/Save/Insert. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Под всеми ветками.

**Notes:** This directly fixes the mixed-branch visual bug. The output toolbar remains only for output actions.

### Responsive behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap в две строки | Use flex-wrap; one row normally, wrap instead of clipping on narrow sidebar widths. | Yes |
| Всегда одна строка | Force one row. | No |
| Full-width кнопки | Stack/full-width buttons. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Wrap в две строки.

---

## Button Copy Style

| Option | Description | Selected |
|--------|-------------|----------|
| lowercase back/skip | Match roadmap literal lowercase wording. | No |
| Sentence case Back/Skip | Use Obsidian-style Sentence case labels. | Yes |
| Back + skip | Mixed casing. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Sentence case Back/Skip.

**Follow-up:** Because roadmap text says `back`/`skip`, the user confirmed Sentence case is intentional.

| Option | Description | Selected |
|--------|-------------|----------|
| Да, Back/Skip | Lock visible text as `Back` and `Skip`. | Yes |
| Нет, back/skip | Follow roadmap lowercase literally. | No |
| Не важно | Planner discretion. | No |

### Skip icon treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Только текст | Visible `Skip` text only; no icon decoration. | Yes |
| Иконка + текст | Keep skip-forward icon plus text. | No |
| Текст + aria | Visible text only, descriptive aria/title. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Только текст.

---

## Cross-State Row Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Показывать Back-only | Use the same footer row for states where only Back is valid. | Yes |
| Только на вопросах | Footer row only on question nodes. | No |
| Скрывать без Skip | Footer appears only when Back+Skip both exist. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Показывать Back-only.

### Skip availability

| Option | Description | Selected |
|--------|-------------|----------|
| Нет, только question | Preserve Phase 53: Skip only for skippable question nodes. | Yes |
| В snippet picker тоже | Add Skip to snippet picker. | No |
| В loop picker тоже | Add Skip to loop picker. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Нет, только question.

---

## Shared Render Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Helper обязателен | Require a shared helper/render contract so modes cannot drift. | Yes |
| Дублирование допустимо | Patch two implementations separately. | No |
| Helper только CSS | Share only CSS classes. | No |
| Ты реши | Planner discretion. | No |

**User's choice:** Helper обязателен.

**Notes:** Planner can decide exact helper shape and location, but must specify a reusable contract for Back-only and Back+Skip footer rendering across `RunnerView` and `InlineRunnerModal`.

---

## the agent's Discretion

- Helper name/location and whether it is a module function or class-local reusable method pair.
- Exact CSS selector naming, with preference for a shared footer-row class.
- Exact spacing and theme token choices.
- Accessibility label wording.

## Deferred Ideas

- Skip in snippet picker or loop picker states.
- Phase 66 step-back reliability and scroll pinning work.
- Keyboard shortcuts for Back/Skip.
- Output toolbar redesign.
