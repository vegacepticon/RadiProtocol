---
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
plan: 04
subsystem: runner-view
tags: [runner-view, ui, snippets, branching, phase-31]
requires:
  - 31-01
  - 31-02
  - 31-03
provides:
  - Partitioned answer/snippet branch rendering на question-узле
  - UI hook для runner.chooseSnippetBranch()
affects:
  - src/views/runner-view.ts
  - src/styles/runner-view.css
  - styles.css (regenerated)
tech-stack:
  added: []
  patterns:
    - DOM partition via typed array + two separate render loops
    - Append-only CSS block с /* Phase 31: ... */ маркером
key-files:
  created:
    - .planning/phases/31-mixed-answer-and-snippet-branching-at-question-nodes/31-04-SUMMARY.md
  modified:
    - src/views/runner-view.ts
    - src/styles/runner-view.css
    - styles.css
decisions:
  - "Snippet-варианты рендерятся отдельной секцией .rp-snippet-branch-list ПОД answers; визуально отделены dashed border"
  - "Fallback label '📁 Snippet' применяется когда snippetLabel undefined ИЛИ пустая строка"
  - "Step-back из branch-entered picker обеспечивается undo-стеком Plan 31-03 (returnToBranchList) — runner-view не нуждается в специальной логике, просто re-render на question state"
metrics:
  duration: "~10 min"
  completed: "2026-04-15"
---

# Phase 31 Plan 04: Runner UI — Mixed Answer + Snippet Branch List Summary

Финальная волна Phase 31: вывод question-узла в runner разделён на две секции — answers (сверху) и snippet branches (снизу), клик по snippet-ветке вызывает `runner.chooseSnippetBranch(snippetNodeId)` и открывает существующий Phase 30 picker.

## What Changed

### src/views/runner-view.ts
- Добавлен импорт типов `AnswerNode`, `SnippetNode` из `../graph/graph-model`.
- В `case 'question'` (внутри `case 'at-node'` / `switch (node.kind)`) single-loop рендер заменён на partitioned:
  1. Сначала сохраняется `createEl('p', { text: node.questionText, cls: 'rp-question-text' })`.
  2. Соседи узла партиционируются в `answerNeighbors: AnswerNode[]` и `snippetNeighbors: SnippetNode[]` единым проходом по `this.graph.adjacency`.
  3. Если `answerNeighbors.length > 0` — рендерится `.rp-answer-list` с `.rp-answer-btn` (существующее поведение, сохранён click handler с `syncManualEdit` → `chooseAnswer` → `autoSaveSession` → `renderAsync`).
  4. Если `snippetNeighbors.length > 0` — рендерится новая секция `.rp-snippet-branch-list` с `.rp-snippet-branch-btn` на каждый snippet-узел. Label: `📁 ${snippetLabel}` или fallback `📁 Snippet`. Click handler: `syncManualEdit` → `chooseSnippetBranch(snippetNode.id)` → `autoSaveSession` → `renderAsync`.
- Никакие другие `case` (`free-text-input`, `loop-end`, `awaiting-snippet-pick`, `awaiting-snippet-fill`, `complete`, `error`, `default`, `text-block`, etc.) не тронуты.
- Используются Obsidian DOM хелперы (`createDiv`, `createEl`, `registerDomEvent`) — никакого `innerHTML`.

### src/styles/runner-view.css
- Append-only блок в самом конце файла с комментарием `/* Phase 31: mixed answer + snippet branches at question nodes */`.
- Добавлены два правила: `.rp-snippet-branch-list` (flex column gap + margin-top отделяющий от answer списка) и `.rp-snippet-branch-btn` (копия геометрии `.rp-answer-btn` + `border-style: dashed` для визуального отличия).
- Существующие правила не тронуты.

### styles.css
- Перегенерирован `npm run build`. Не редактировался вручную.

## Verification

- **Build:** `npm run build` — зелёный (tsc -noEmit + esbuild production bundle).
- **Tests:** `npm test -- --run` — 217 passed / 3 failed. Все 3 failing — **предсуществующие** baseline failures в `src/__tests__/runner-extensions.test.ts` (`setAccumulatedText`, `start startNodeId`, `D-05`), не связаны с плаnom 04 и существуют с волны 2.
- **Acceptance criteria greps:**
  - `chooseSnippetBranch` → 1 match (line 377)
  - `rp-snippet-branch-list` → 1 match (line 366)
  - `rp-snippet-branch-btn` → 1 match (line 372)
  - `rp-snippet-branch-btn` в CSS → 1 match
  - `/* Phase 31:` в CSS → 1 match
  - `rp-answer-btn` в CSS сохранён (Phase 12 regression guard)
  - `rp-answer-list` в ts сохранён
  - `chooseAnswer` в ts сохранён
  - 📁 emoji label в ts → 2 matches (labeled + fallback)

## Deviations from Plan

Ни одного. Plan выполнен дословно.

## Manual UAT — Pending

Plan помечен `autonomous: false` — визуальная проверка UI не автоматизируется. По запросу orchestrator manual UAT checkpoint (Task 2) отложен: код и CSS завершены, build зелёный, тесты стабильны. Пользователь должен выполнить все 5 SNIPPET-BRANCH-0X критериев из 31-04-PLAN Task 2 на реальном canvas в Obsidian:

1. **SNIPPET-BRANCH-01** — mixed question показывает secции answers + snippets; snippet-кнопки с dashed border отличимы от answer-кнопок; пустой `snippetLabel` → "📁 Snippet" fallback.
2. **SNIPPET-BRANCH-02** — клик по snippet-ветке открывает Phase 30 drill-down picker с root = `snippetNode.subfolderPath`; выбор → fill → вставка только текста snippet'а через per-node separator override (пробел вместо newline для S1).
3. **SNIPPET-BRANCH-03** — editor form round-trip для `snippetLabel` / `snippetSeparator` (Plan 31-02 territory; smoke check).
4. **SNIPPET-BRANCH-04** — validator silent acceptance snippet-only question.
5. **SNIPPET-BRANCH-05** — step-back из branch-entered picker возвращает к branch list (обеспечивается undo-стеком `returnToBranchList` из Plan 31-03); session resume bonus — reload Obsidian между click snippet-ветки и step-back, picker восстанавливается, step-back всё равно возвращает к question.

### UI-specific notes для ручной проверки

- Secции рендерятся **только если непустые** — question c только-snippet рёбрами не покажет пустой `.rp-answer-list`, question с только-answer рёбрами не покажет пустой `.rp-snippet-branch-list`.
- `margin-top: var(--size-4-2)` на `.rp-snippet-branch-list` создаёт визуальный зазор между секциями только когда обе присутствуют; при snippet-only секции margin окажется между question-text `<p>` и списком — это ожидаемо и выглядит как стандартный padding.
- Dashed border наследуется от темы (button базовый border + `border-style: dashed`). Если тема переопределяет `button` border — dashed может не отобразиться; fallback — различимость по margin + позиции.
- Label emoji `📁` — это U+1F4C1 (folder). Если шрифт темы не поддерживает — покажет прямоугольник; функциональность не страдает.

## Self-Check: PASSED

- `src/views/runner-view.ts` — modified, содержит `chooseSnippetBranch`, `rp-snippet-branch-list`, `rp-snippet-branch-btn`.
- `src/styles/runner-view.css` — modified, содержит `/* Phase 31:` и `.rp-snippet-branch-btn`.
- `styles.css` — regenerated by build.
- `.planning/phases/31-mixed-answer-and-snippet-branching-at-question-nodes/31-04-SUMMARY.md` — создан.
