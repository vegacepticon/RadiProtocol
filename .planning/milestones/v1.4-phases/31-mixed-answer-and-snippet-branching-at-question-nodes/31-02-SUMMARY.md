---
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
plan: 02
subsystem: editor-panel-view
tags: [snippet, node-editor, ui, form, wave-2]
requires:
  - SnippetNode.snippetLabel
  - SnippetNode.radiprotocol_snippetSeparator
provides:
  - "Node Editor: Branch label text input для snippet-ноды"
  - "Node Editor: Separator override dropdown для snippet-ноды"
affects:
  - src/views/editor-panel-view.ts
tech_stack:
  added: []
  patterns:
    - "Append-only Setting-блоки внутри case 'snippet' в buildKindForm"
    - "nodeRecord[...] для чтения текущих значений (копия паттерна subfolderPath)"
    - "empty-string → undefined нормализация через `v || undefined`"
    - "strict enum narrowing для separator: (v === 'space' || v === 'newline') ? v : undefined"
key_files:
  created:
    - .planning/phases/31-mixed-answer-and-snippet-branching-at-question-nodes/31-02-SUMMARY.md
  modified:
    - src/views/editor-panel-view.ts
decisions:
  - "Оба контрола — синхронные Setting-блоки после закрывающего `})();` subfolderPath IIFE, перед `break;`"
  - "Чтение текущих значений через `nodeRecord[...]`, консистентно с существующим subfolderPath dropdown, а не через `this.node?.*`"
  - "Separator dropdown: три опции (default/newline/space); пустая строка нормализуется в undefined для глобального fallback"
metrics:
  tasks_completed: 1
  files_modified: 1
  tests_added: 0
  duration: "~5 min"
requirements:
  - SNIPPET-BRANCH-03
---

# Phase 31 Plan 02: Snippet node form controls (Branch label + Separator override) Summary

Добавлены два новых Setting-контрола в Node Editor для snippet-ноды: text input `Branch label` (пишет в `radiprotocol_snippetLabel`) и dropdown `Separator override` (пишет в `radiprotocol_snippetSeparator`). Оба триггерят `scheduleAutoSave` и нормализуют empty/default в `undefined`.

## What was built

**`src/views/editor-panel-view.ts`** — внутри существующего `case 'snippet'` блока в `buildKindForm`, после закрывающего `})();` async IIFE для subfolderPath dropdown и перед `break;`, добавлены:

1. **Branch label (text input)** — читает `nodeRecord['radiprotocol_snippetLabel']`, пишет в `this.pendingEdits['radiprotocol_snippetLabel']` с empty-to-undefined нормализацией.
2. **Separator override (dropdown)** — три опции (`''` = глобальный default, `newline`, `space`). Читает `nodeRecord['radiprotocol_snippetSeparator']`, пишет в `this.pendingEdits['radiprotocol_snippetSeparator']` со строгим narrowing: если не `'space'` и не `'newline'` → `undefined`.

Оба контрола используют тот же паттерн доступа к текущим значениям (`nodeRecord[...]`), что и соседний subfolderPath dropdown, ради консистентности с окружающей формой.

## Key decisions

- **Чтение через `nodeRecord[...]` вместо `this.node?.*`** — план допускал оба варианта, но существующий subfolderPath dropdown использует именно `nodeRecord[...]`, поэтому новые контролы следуют тому же паттерну (меньше когнитивной нагрузки, одна точка правды внутри одного case-блока).
- **pendingEdits без fallback на предыдущий pending-value** — text.setValue читает только из `nodeRecord`, а не из `pendingEdits`. Это тоже копия поведения subfolderPath, где setValue работает только через `nodeRecord`, а debounce auto-save не требует re-render между правками.

## Deviations from Plan

**None — план исполнен как написано**, с единственной уточняющей нормализацией: паттерн чтения взят из subfolderPath (`nodeRecord[...]`), как и предписывал план в примечании к Task 1 ("скопировать ТОТ ЖЕ паттерн чтения, что использует subfolderPath dropdown").

## Verification

- `npm run build` — зелёный, TypeScript строгий режим без ошибок.
- `npm test` — 204 passed / 3 failed. Три падения — известный baseline в `src/__tests__/runner-extensions.test.ts` (D-05 setAccumulatedText, D-07 start startNodeId, предшествующие Plan 31-01). Не связаны с Plan 31-02. Никаких новых падений не введено.
- `grep` проверки acceptance criteria:
  - `radiprotocol_snippetLabel` — 2 совпадения (read + write) ✓
  - `radiprotocol_snippetSeparator` — 2 совпадения (read + write) ✓
  - `Branch label` — 1 совпадение ✓
  - `Separator override` — присутствует (новое совпадение в snippet-контексте; остальные — pre-existing для других типов) ✓
  - `radiprotocol_subfolderPath` — сохранён, пре-существующая форма не затронута ✓

## Shared-file hygiene (CLAUDE.md)

Правка строго append-only внутри `case 'snippet'`. Ни одна строка существующего кода (subfolderSetting, async IIFE, setHeading, break, другие case) не была удалена или переписана. Диффф ограничен вставкой 29 новых строк между `})();` и `break;`.

## Known Stubs

None.

## Self-Check: PASSED

- File `src/views/editor-panel-view.ts` contains expected grep matches — verified.
- Build succeeds — verified.
- Test baseline preserved (204 passing, same 3 pre-existing failures) — verified.
