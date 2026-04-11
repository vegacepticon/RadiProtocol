# Phase 21: Color Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 21-color-infrastructure
**Areas discussed:** Palette assignments, Snippet color scope, PROTECTED_FIELDS approach, Fallback behaviour

---

## Palette assignments

| Option | Description | Selected |
|--------|-------------|----------|
| По смыслу | start=4, question=5, answer=2, text-block=3, snippet=6, loop-start=1, loop-end=1 (loop pair shares red) | ✓ |
| По ролям | start/loop-end=4, question=5, answer=2, text-block=3, snippet=6, loop-start=1 | |

**User's choice:** По смыслу — loop-start и loop-end делят `"1"` (красный) как логическая пара.

---

## Snippet color scope

| Option | Description | Selected |
|--------|-------------|----------|
| Добавить сейчас | node-color-map.ts сразу определяет все 7 типов включая snippet | ✓ |
| Оставить Phase 22 | Phase 21 только 6 типов; snippet добавляется в Phase 22 | |

**User's choice:** Добавить сейчас — Phase 22 не трогает node-color-map.ts.

---

## PROTECTED_FIELDS approach

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить 'color' из обоих | Убрать из canvas-live-editor.ts и editor-panel-view.ts | ✓ |
| writeColor() отдельным методом | Оставить PROTECTED_FIELDS без изменений, добавить явный обход | |

**User's choice:** Удалить 'color' из обоих экземпляров — чище, соответствует ROADMAP.

---

## Fallback behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Молча пропустить | Цвет пишется только через live path; если canvas закрыт — цвет появится при следующем открытии | ✓ |
| Strategy A тоже записывает color | vault.modify fallback также прописывает color в JSON | |

**User's choice:** Молча пропустить — Strategy A не расширяется, colour write только через live.

---
