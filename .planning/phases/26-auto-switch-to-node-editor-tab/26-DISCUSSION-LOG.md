# Phase 26: Auto-Switch to Node Editor Tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 26-auto-switch-to-node-editor-tab
**Areas discussed:** Условие авто-переключения, Dirty guard при авто-switch, Reveal-or-create стратегия

---

## Условие авто-переключения (Trigger Condition)

| Option | Description | Selected |
|--------|-------------|----------|
| Всегда | Любой клик на canvas-узел → revealLeaf(Node Editor). Проще, UX консистентен: клик = намерение редактировать. | ✓ |
| Только когда Runner впереди | Переключение только если Runner tab сейчас активен в sidebar. Требует проверки 'какой leaf сейчас виден' — сложнее, т.к. после клика на canvas activeLeaf уже поменялся. | |

**User's choice:** Всегда
**Notes:** SC говорит «while Runner is active» — это описание сценария, а не условие в коде. Всегда-reveal проще и не ломает другие сценарии.

---

## Dirty guard при авто-switch

| Option | Description | Selected |
|--------|-------------|----------|
| Guard срабатывает | Авто-switch не меняет логику dirty guard. Unsaved edits → диалог «Discard / Stay». | |
| Guard пропускается при авто-switch | Тихо сбрасывает несохранённые изменения. Рискованно — пользователь теряет правки при случайном клике. | |

**User's choice:** (Уточнение изменило вопрос)
**Notes:** Пользователь уточнил: Phase 23 реализовала auto-save, а Phase 24 тест-коммит (`da9e1b5`) откатил его и вернул NodeSwitchGuardModal. Регрессия подтверждена чтением git diff. Решение — восстановить полный Phase 23 auto-save в Phase 26, что автоматически убирает guard.

---

## Reveal-or-create стратегия

| Option | Description | Selected |
|--------|-------------|----------|
| revealLeaf если открыт (non-destructive) | getLeavesOfType → revealLeaf если есть, создать если нет. Форма не пересоздаётся. Нужен отдельный метод ensureEditorPanelVisible() в main.ts. | ✓ |
| Всегда через activateEditorPanelView() | Существующий метод — но он detach+recreate каждый раз. Форма сбрасывается при каждом авто-switch. Не подходит для бесшовного UX. | |

**User's choice:** revealLeaf если открыт
**Notes:** activateEditorPanelView() остаётся для команды «Open node editor» — Phase 26 не меняет его.

---

## Auto-save регрессия

| Option | Description | Selected |
|--------|-------------|----------|
| Guard в Phase 26 — нормально | Phase 26 доставляет только reveal-leaf логику. Auto-save — отдельная задача. | |
| Phase 26 включает fix авто-save | Восстановить Phase 23 полностью как часть Phase 26. | ✓ |

**User's choice:** Phase 26 включает fix авто-save

## Объём авто-save восстановления

| Option | Description | Selected |
|--------|-------------|----------|
| Полный Phase 23 | debounce правки → авто-сохранение, flush перед переключением узла, удаление кнопки Save — индикатор «Saved ✓», удаление guard-диалога. | ✓ |
| Только flush-on-switch | Только flush pendingEdits перед reveal/переключением узла, кнопка Save остаётся. Меньше scope. | |

**User's choice:** Полный Phase 23
**Notes:** Восстанавливать из git коммитов 06926bb, 843436b, 9e849ee — баги уже пофикшены в тех коммитах.

---
