---
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
plan: 01
subsystem: graph-model
tags: [snippet, branching, validator, parser, model]
requires: []
provides:
  - SnippetNode.snippetLabel
  - SnippetNode.radiprotocol_snippetSeparator
  - "graph-validator: question → snippet / mixed branches allowed"
affects:
  - src/graph/graph-model.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-validator.ts
tech_stack:
  added: []
  patterns:
    - "WR-02 empty-string → undefined normalisation"
    - "strict enum narrowing (mirror radiprotocol_separator pattern)"
key_files:
  created:
    - .planning/phases/31-mixed-answer-and-snippet-branching-at-question-nodes/31-01-SUMMARY.md
  modified:
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/__tests__/canvas-parser.test.ts
    - src/__tests__/graph-validator.test.ts
decisions:
  - "snippetLabel и radiprotocol_snippetSeparator — optional поля на SnippetNode (append-only)"
  - "Валидатор просто ослабляет wording Check 5 — никаких новых правил"
metrics:
  tasks_completed: 2
  files_modified: 5
  tests_added: 9
requirements:
  - SNIPPET-BRANCH-03
  - SNIPPET-BRANCH-04
---

# Phase 31 Plan 01: Foundation — SnippetNode fields + relaxed validator

## One-liner

Добавлены optional поля `snippetLabel` и `radiprotocol_snippetSeparator` на `SnippetNode`, парсер нормализует их (empty → undefined, strict enum), а `GraphValidator` теперь молча пропускает question-узлы с outgoing-рёбрами только к snippet или в mixed answer+snippet режиме.

## What shipped

### Task 1 — Model + parser + parser tests
- `src/graph/graph-model.ts`: в `SnippetNode` добавлены два optional поля после существующего `subfolderPath`. Ничего не удалено.
- `src/graph/canvas-parser.ts`: внутри `case 'snippet'` добавлены `rawLabel` / `rawSep` + нормализация. Парсинг `subfolderPath` не тронут.
- `src/__tests__/canvas-parser.test.ts`: новый блок `describe('CanvasParser — snippet node extra fields (Phase 31)')` с 7 тестами (happy path snippetLabel, empty → undefined, отсутствие → undefined; separator=space, separator=newline, invalid enum → undefined, отсутствие → undefined).

### Task 2 — Validator reword + tests
- `src/graph/graph-validator.ts`: Check 5 message переформулирован на branch-agnostic (`has no outgoing branches. Add at least one answer or snippet node…`). Правило `outgoing.length === 0` не изменено. Никакие другие checks не тронуты.
- `src/__tests__/graph-validator.test.ts`: обновлён expect в существующем dead-end тесте на новый substring; добавлен блок `describe('GraphValidator — Phase 31: mixed and snippet-only question branches')` с 2 тестами (snippet-only — D-07, mixed answer+snippet — D-06). Оба возвращают `[]`.

## Verification

- `npm test -- --run src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts` → **27/27 passed** (2 test files).
- `npm run build` → **clean**, нет TS ошибок (tsc + esbuild production).
- Full suite: 204 passed, 3 failed — все 3 фейла в `runner-extensions.test.ts` и **pre-existing** (подтверждено запуском на stashed clean tree), не связаны с плaном 31-01. Логируются как deferred.

## Acceptance criteria checklist

- [x] `snippetLabel?: string` в SnippetNode — 1 match
- [x] `radiprotocol_snippetSeparator?: 'newline' | 'space'` — 1 match
- [x] `radiprotocol_snippetLabel` в canvas-parser — ≥1 match
- [x] `radiprotocol_snippetSeparator` в canvas-parser — ≥1 match
- [x] `subfolderPath` parsing сохранён
- [x] `has no outgoing branches` в graph-validator — 1 match, старое `has no answers` удалено
- [x] 7 новых parser-тестов зелёные
- [x] 2 новых validator-теста зелёные
- [x] zero regressions в существующих parser/validator тестах
- [x] TS production build проходит

## Deferred issues

- `src/__tests__/runner-extensions.test.ts` — 3 failing tests (pre-existing, not introduced by 31-01). Касается runner state-machine, out of scope для фазы 31 foundation. Должно быть обработано отдельно.

## Deviations from Plan

None — план выполнен точно, без отклонений по Rule 1/2/3. Никакие architectural решения не требовались.

## Self-Check: PASSED

- `src/graph/graph-model.ts` — snippetLabel + radiprotocol_snippetSeparator присутствуют
- `src/graph/canvas-parser.ts` — rawLabel/rawSep с нормализацией
- `src/graph/graph-validator.ts` — "has no outgoing branches"
- Тест файлы содержат новые Phase 31 describe-блоки
- vitest на целевых файлах: 27/27 зелёных
- npm run build: clean
