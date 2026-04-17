# Phase 30 — Discussion Log

**Date:** 2026-04-14
**Language:** Russian (per user preference)

## Q1 — Gray area selection (multiSelect)
**Options:** Picker UI и навигация / Состояние state machine / Расширение SnippetService / Skip / Step-back / пустая папка
**User selected:** ALL FOUR

## Q2 — Picker UI layout
**Options:**
- Inline список кнопок (Recommended)
- Отдельный Modal-picker
- Tree-view с раскрытием
**User selected:** Inline список кнопок → D-01

## Q3 — Folder traversal mode
**Options:**
- Drill-down с breadcrumb (Recommended)
- Плоский рекурсивный список
- Гибрид: drill-down + search
**User selected:** Drill-down с breadcrumb → D-02

## Q4 — Snippet button label
**Options:**
- snippet.name (Recommended)
- Имя файла (id)
- name + индикатор placeholders
**User selected:** snippet.name → D-04

## Q5 — Folder/snippet ordering
**Options:**
- Папки выше, алфавит (Recommended)
- Перемешано по алфавиту
**User selected:** Папки выше, алфавит → D-03

## Q6 — Runner state machine
**Options:**
- Новый 'awaiting-snippet-pick' (Recommended)
- Переиспользовать at-node
**User selected:** Новый awaiting-snippet-pick → D-06, D-07

## Q7 — Pick API on ProtocolRunner
**Options:**
- pickSnippet(snippetId) (Recommended)
- RunnerView всё решает без pickSnippet
**User selected:** pickSnippet(snippetId) → D-08, D-09

## Q8 — SnippetService API
**Options:**
- listFolder(path) — прямые дети (Recommended)
- listFolder только метаданные
- Расширить существующий list()
**User selected:** listFolder(path) → D-18, D-19

## Q9 — Path safety
**Options:**
- Resolve + prefix-check (Recommended)
- Доверять входу
**User selected:** Resolve + prefix-check → D-20

## Q10 — Skip snippet
**Options:**
- Нет skip-кнопки, только step-back (Recommended)
- Skip-кнопка в picker
**User selected:** Нет skip-кнопки → D-13

## Q11 — Empty / missing folder
**Options:**
- Пустой picker с сообщением (Recommended)
- Fallback на root
- Сообщение об ошибке
**User selected:** Пустой picker с сообщением → D-15, D-17

## Q12 — Step-back from picker
**Options:**
- Да, из пикера и любой глубины drill-down (Recommended)
- Только из корневой папки picker
**User selected:** Да, из любой глубины → D-11, D-12

## Q13 — Confirm
**User selected:** Создать CONTEXT.md
