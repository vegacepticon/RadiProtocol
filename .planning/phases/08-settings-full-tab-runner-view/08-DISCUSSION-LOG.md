# Phase 8: Settings + Full-Tab Runner View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 08-settings-full-tab-runner-view
**Areas discussed:** Settings tab scope, Mode toggle UI style, Transition behavior, Tab deduplication edge cases

---

## Settings Tab Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Всё + переключатель режима | Реализовать все существующие настройки (output destination, output folder, max iterations) и добавить новый runner view mode. Вкладка будет полностью рабочей после Phase 8. | ✓ |
| Только переключатель режима | Добавить только новый runner view mode toggle. Существующие настройки оставить как есть (заглушка). Остальные контролы — в отдельной задаче позже. | |

**User's choice:** Всё + переключатель режима
**Notes:** Пользователь подтвердил рекомендованный вариант — полная реализация вкладки настроек в Phase 8.

---

## Mode Toggle UI Style

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown | Выпадающий список: "Sidebar panel" / "Editor tab". Стандартный паттерн Obsidian для настроек с несколькими вариантами, легко расширяется в будущем. | ✓ |
| Toggle switch | Бинарный toggle: OFF = Sidebar, ON = Tab. Минималистично, но менее очевидно когда вариантов больше двух. | |

**User's choice:** Dropdown (Recommended)
**Notes:** Пользователь выбрал dropdown, согласившись с мокапом вида [↓] Sidebar panel / Editor tab.

---

## Transition Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Ничего | Новый режим вступает в силу при следующем вызове команды. Текущая сессия не прерывается. | ✓ |
| Немедленно закрыть и переоткрыть | При смене режима runner закрывается и сразу reopens в новом режиме. Сложнее в реализации, риск потери сессии. | |

**User's choice:** Ничего (Recommended)
**Notes:** Пользователь подтвердил — смена режима не влияет на уже открытый runner.

---

## Tab Deduplication Edge Cases

| Option | Description | Selected |
|--------|-------------|----------|
| Закрыть sidebar, открыть таб | Новый режим активен — при вызове команды старый sidebar-лист закрывается, открывается новый таб. Поведение соответствует выбранному режиму. | ✓ |
| Просто фокусировать sidebar | RUNTAB-03 — раннер уже открыт, просто reveal его. Проще, но игнорирует смену режима. | |

**User's choice:** Закрыть sidebar, открыть таб (Recommended)
**Notes:** Пользователь подтвердил — при несоответствии режима существующего листа текущей настройке, старый лист закрывается и открывается новый в правильном режиме.

---

## Claude's Discretion

- Label text для настройки и её description string
- Нужен ли разделитель-заголовок между группами настроек
- Имя поля `runnerViewMode` в `RadiProtocolSettings`

## Deferred Ideas

Нет — обсуждение оставалось в рамках Phase 8.
