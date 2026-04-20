---
status: partial
phase: 51-snippet-picker-overhaul
source: [51-VERIFICATION.md]
started: 2026-04-20T10:07:37Z
updated: 2026-04-20T10:07:37Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Node Editor inline SnippetTreePicker (D-05)
expected: Открыть канвас в Obsidian, выбрать Snippet-узел в Node Editor — вместо плоского dropdown отображается иерархический SnippetTreePicker (mode 'both') с breadcrumb, полем поиска, drill-down списком и кнопкой «Выбрать эту папку». Inline picker рендерится внутри editor column capped by rp-stp-editor-host (max-height 360px, scroll). Выбор папки или файла мгновенно сохраняется (autosave) и обновляет canvas card text.
result: [pending]

### 2. Runner awaiting-snippet-pick picker (D-06)
expected: Запустить протокол в Runner на Snippet-узле — открыть drill-down, проверить поиск, клик по файлу, step-back. Picker mounted under questionZone с прокруткой списка (max-height 50vh). Поисковая строка ищет по всему subtree от node.subfolderPath. Клик по файлу .md вставляет текст без модального окна; .json с placeholders открывает SnippetFillInModal.
result: [pending]

### 3. D-13 auto-insert (single-edge file-bound Snippet)
expected: Создать канвас Question → (единственное ребро) → Snippet(radiprotocol_snippetPath='abdomen/ct.md', без subfolderPath). Запустить Runner. Попадая в Question, Runner пропускает choice-button render и сразу переходит в awaiting-snippet-fill. Текст сниппета вставляется автоматически (для .md) либо открывает fill modal (для .json с placeholders). Undo (stepBack) возвращает в Question.
result: [pending]

### 4. D-16 specific-bound sibling button
expected: Question с двумя рёбрами — один на Answer, другой на file-bound Snippet. Кнопка специфически-связанного Snippet'а отрисовывается с префиксом 📄 (не 📁). Caption использует fallback chain: snippetLabel → basename(snippetPath) без расширения → '📄 Snippet'. Клик ведёт через chooseSnippetBranch → awaiting-snippet-pick → picker показывает bound file в списке.
result: [pending]

### 5. Snippet Manager «Переместить в…»
expected: Правый клик на сниппете/папке в Snippet Manager, выбрать «Переместить в…». Открывается Obsidian Modal с заголовком «Переместить в…» внутри которого SnippetTreePicker (mode 'folder-only', rp-stp-modal-host, min-width 360px). Клик «Выбрать эту папку» вызывает performMove; попытка выбрать source-self или source-descendant показывает Notice.
result: [pending]

### 6. SnippetEditorModal «Папка» field
expected: Открыть Snippet Editor (создание или редактирование сниппета). Поле «Папка» показывает SnippetTreePicker в folder-only mode. hasUnsavedChanges=true ставится на каждый выбор папки; collision check отрабатывает.
result: [pending]

### 7. Back-compat Pitfall #11 (legacy directory-bound canvas)
expected: Открыть старый канвас сохранённый до Phase 51 с Snippet-узлом (subfolderPath='abdomen', без snippetPath). Канвас открывается без валидационных ошибок. Runner показывает drill-down picker как раньше. Canvas shape не модифицируется автоматически (zero-touch back-compat).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
