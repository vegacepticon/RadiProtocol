---
status: complete
phase: 56-snippet-button-ux-reversal
source:
  - 56-01-SUMMARY.md
  - 56-02-SUMMARY.md
  - 56-03-SUMMARY.md
  - 56-04-SUMMARY.md
started: 2026-04-21
updated: 2026-04-21
---

## Current Test

[testing complete]

## Tests

### 1. File-bound Snippet — direct insert on button click
expected: Клик по sibling-кнопке file-bound Snippet сразу открывает fill-in модалку, минуя tree picker.
result: pass

### 2. Directory-bound Snippet — tree picker opens
expected: Клик по sibling-кнопке directory-bound Snippet открывает SnippetTreePicker (folder drill-in UI), а не fill-in модалку напрямую.
result: pass

### 3. Tree picker — «Выбрать эту папку» committed state
expected: В tree picker'е после клика по «Выбрать эту папку» кнопка остаётся в залипшем состоянии с лейблом «✓ Выбрано» и акцентным фоном. При drill-away (уход в другую папку) состояние сбрасывается; при возврате в ту же папку — снова показывает «✓ Выбрано».
result: pass

### 4. Snippet Editor Modal — «Папка» unsaved dot
expected: Открой существующий Snippet в редакторе. Рядом с лейблом «Папка» dot (•) отсутствует. Смени папку через picker — появляется маленькая акцентная точка. Сохрани — точка исчезает. Повторно смени — появляется; отмени через dismiss — DOM уничтожается (состояние не переносится).
result: pass

### 5. Undo after file-bound snippet pick
expected: После того как file-bound snippet подставился (test 1), нажми Undo/stepBack. Состояние runner'а откатывается к at-node на Question (snippetId/snippetNodeId очищены), fill-in модалка закрывается.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
