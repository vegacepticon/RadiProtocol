---
status: complete
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
source:
  - 31-01-SUMMARY.md
  - 31-02-SUMMARY.md
  - 31-03-SUMMARY.md
  - 31-04-SUMMARY.md
started: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Mixed answer + snippet branches render
expected: На question-узле со смешанными рёбрами видны две секции — answers сверху и snippet branches снизу (dashed border). Label snippet-кнопки: "📁 <snippetLabel>" или fallback "📁 Snippet".
result: pass

### 2. Click snippet branch opens Phase 30 picker with per-node separator
expected: Клик по snippet-ветке открывает drill-down picker с корнем = `subfolderPath` этого snippet-узла. Выбор snippet → fill (если есть плейсхолдеры) → в accumulator вставляется ТОЛЬКО текст snippet'а (без label), причём separator берётся из `radiprotocol_snippetSeparator` конкретного узла (например, space override вместо глобального newline).
result: pass

### 3. Editor form round-trip for snippetLabel + separator override
expected: В Node Editor для snippet-ноды доступны два контрола — text input "Branch label" и dropdown "Separator override" (default / newline / space). Ввод значения → auto-save → закрытие/повторное открытие панели показывает то же значение. Пустой label и default separator сохраняются как undefined (глобальный fallback).
result: pass

### 4. Validator silently accepts snippet-only question
expected: Question-узел, у которого ВСЕ исходящие рёбра идут только к snippet-узлам (ни одного answer-ребра), не вызывает ошибку валидатора при запуске протокола. Runner стартует без ошибки и показывает такую question как snippet-only branch list.
result: pass

### 5. Step-back from branch-entered picker returns to branch list
expected: После клика по snippet-ветке и входа в picker, нажатие step-back возвращает пользователя обратно к question с branch list (answers + snippets), а не к предшественнику question-узла. Bonus: если перезагрузить Obsidian между входом в picker и step-back, сессия восстанавливается и step-back всё равно возвращает к question.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
