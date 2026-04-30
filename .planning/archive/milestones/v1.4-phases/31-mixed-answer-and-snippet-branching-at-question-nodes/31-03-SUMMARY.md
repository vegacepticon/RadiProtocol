---
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
plan: 03
subsystem: runner
tags: [runner, state-machine, snippet, branching, session]
wave: 2
dependency_graph:
  requires:
    - 31-01
  provides:
    - chooseSnippetBranch runner API
    - UndoEntry.returnToBranchList flag
    - per-node snippet separator resolution
  affects:
    - src/views/runner-view.ts (future wave — consumes chooseSnippetBranch)
tech_stack:
  added: []
  patterns:
    - undo-before-mutate with returnToBranchList flag
    - typed resolveSeparator overload across 4 node kinds
key_files:
  created: []
  modified:
    - src/runner/runner-state.ts
    - src/runner/protocol-runner.ts
    - src/__tests__/runner/protocol-runner.test.ts
    - src/__tests__/runner/protocol-runner-session.test.ts
decisions:
  - chooseSnippetBranch валидирует source (question) и target (snippet-neighbour) через transitionToError, а не no-op — consistent с chooseAnswer при передаче wrong-kind id
metrics:
  duration: ~20m
  completed: 2026-04-15
  tests_added: 13
  test_baseline_before: "204 passing / 3 pre-existing failing"
  test_result_after: "217 passing / 3 pre-existing failing"
---

# Phase 31 Plan 03: Runner chooseSnippetBranch + returnToBranchList + per-node snippet separator

Один абзац: Чистый state-machine `ProtocolRunner` получил новый метод `chooseSnippetBranch(snippetNodeId)` для входа в snippet-picker как в branch-развилку question-узла, optional флаг `UndoEntry.returnToBranchList` для корректного step-back в branch list, расширенный `resolveSeparator`/`completeSnippet` для `kind === 'snippet'` через `radiprotocol_snippetSeparator`, и полный round-trip нового флага в `getSerializableState` / `restoreFrom`.

## What Was Built

### 1. `UndoEntry.returnToBranchList?: boolean` (runner-state.ts)
Новое optional поле — маркер для entry, созданных через `chooseSnippetBranch`. `stepBack()` видит флаг и возвращает пользователя в branch list, а не к предшественнику question-узла.

### 2. `ProtocolRunner.chooseSnippetBranch(snippetNodeId)` (protocol-runner.ts)
Новый публичный метод, размещён сразу после `chooseAnswer`. Валидация (через `transitionToError`):
- `runnerStatus === 'at-node'` и graph/currentNodeId не null (иначе тихий no-op, как и в `chooseAnswer`)
- Текущий узел — `question`
- Target существует и имеет `kind === 'snippet'`
- Target — прямой сосед current question в adjacency

Push UndoEntry **до мутации** с `returnToBranchList: true`, затем переключает `currentNodeId` на snippet-узел, `snippetNodeId` на тот же id, `runnerStatus = 'awaiting-snippet-pick'`. Accumulator **не трогается** — вставка текста произойдёт позже через `pickSnippet → completeSnippet`.

### 3. `stepBack()` early branch
При pop'е entry с `returnToBranchList === true` — восстанавливает question-узел, сбрасывает snippetId/snippetNodeId, `runnerStatus = 'at-node'`. Поведение остальных entries не изменилось (Phase 30 Path A regression test подтверждает).

### 4. `resolveSeparator` расширен на `SnippetNode`
Добавлен union-член `SnippetNode` в типовую сигнатуру. Для `node.kind === 'snippet'` — возврат `node.radiprotocol_snippetSeparator ?? this.defaultSeparator`. Для остальных kinds — прежняя логика `radiprotocol_separator`.

### 5. `completeSnippet` separator hook
Расширено условие: `snippetNode?.kind === 'text-block' || snippetNode?.kind === 'snippet'` передаёт узел в `resolveSeparator`. Это обеспечивает per-node override и для branch-entered picker, и для auto-advanced (Phase 30) picker.

### 6. `getSerializableState` / `restoreFrom` round-trip
Тип `undoStack` item в обоих методах получил `returnToBranchList?: boolean`. Оба `.map(e => ({...}))` копирования теперь копируют флаг. Остальная форма сериализации не изменена (SESSION-07 JSON-safe неизменно).

## Tests Added

### `src/__tests__/runner/protocol-runner.test.ts` — Phase 31 describe (10 тестов)
Fixture: Q → {A1, A2, S1(subfolder='foo'), S2(separator='space')}.
1. `chooseSnippetBranch('n-s1')` → `awaiting-snippet-pick` at n-s1, accumulator пуст, subfolderPath='foo'
2. undoStack[0] = {nodeId: 'n-q1', returnToBranchList: true}
3. `stepBack()` → at-node at n-q1, snippetId/snippetNodeId null, undoStack пуст
4. Nonexistent target → error
5. Wrong kind target (answer) → error
6. Current node не question (free-text-input) → error
7. D-04: completeSnippet с S2 (`snippetSeparator='space'`) → финальный текст `'prefix hello'` (space join)
8. D-04: completeSnippet с S1 без override → `'prefix\nhello'` (newline default)
9. Phase 30 regression: auto-advanced snippet-picker (через chooseAnswer) step-back → предшественник (не branch list)
10. Chain: chooseSnippetBranch → pickSnippet → stepBack (→n-s1) → stepBack (→n-q1) → stepBack (stays at n-q1)

### `src/__tests__/runner/protocol-runner-session.test.ts` — Phase 31 describe (3 теста)
1. `chooseSnippetBranch` → serialize → JSON round-trip → restore: `undoStack[0].returnToBranchList === true`
2. После restore `stepBack()` → at-node at question (flag семантика пережила JSON)
3. At-node в question без chooseSnippetBranch → serialize/restore показывает at-node branch list

## Verification

- `npm run build` — tsc strict PASS, esbuild production PASS
- `npm test -- --run` — 217 passed / 3 failed (3 failing = pre-existing baseline в `runner-extensions.test.ts`: RUN-11 setAccumulatedText, D-05 undo clear, D-07 start(startNodeId) — не трогалось в этом plan'е)
- Net delta vs. baseline 204/3: **+13 passing тестов, 0 новых регрессий**
- Phase 30 pickSnippet / completeSnippet тесты — все зелёные
- grep guards (acceptance_criteria):
  - `returnToBranchList` в runner-state.ts: 1 match (определение поля) ✓
  - `chooseSnippetBranch` в protocol-runner.ts: ≥1 match ✓
  - `returnToBranchList: true` в protocol-runner.ts: 1 match (push в chooseSnippetBranch) ✓
  - `returnToBranchList === true` в protocol-runner.ts: 1 match (stepBack early branch) ✓
  - `kind === 'snippet'` в protocol-runner.ts: ≥2 matches (resolveSeparator + completeSnippet) ✓
  - `returnToBranchList` count в protocol-runner.ts: ≥4 (push + stepBack + getSerializableState + restoreFrom) ✓
  - `chooseAnswer`, `pickSnippet` не удалены ✓

## Deviations

Ни одного. План выполнен точно как написан, без auto-fix'ов. Использован `transitionToError` для всех валидационных ветвей `chooseSnippetBranch` (план допускал "no-op или error" — выбран error для явной диагностики, симметрично с `chooseAnswer` при wrong-kind target).

## Known Stubs

Нет. `chooseSnippetBranch` — полнофункциональный state-переход; UI wire-up будет сделан в следующих wave-plans фазы 31 (31-04+).

## Self-Check: PASSED

- `src/runner/runner-state.ts` FOUND, returnToBranchList поле добавлено
- `src/runner/protocol-runner.ts` FOUND, chooseSnippetBranch + stepBack branch + resolveSeparator extension + serialization round-trip присутствуют
- `src/__tests__/runner/protocol-runner.test.ts` FOUND, Phase 31 describe с 10 тестами
- `src/__tests__/runner/protocol-runner-session.test.ts` FOUND, Phase 31 D-09 describe с 3 тестами
- Commit будет создан следующим шагом — hash см. в final commit message
