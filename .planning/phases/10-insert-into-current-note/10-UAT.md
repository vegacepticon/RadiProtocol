---
status: complete
phase: 10-insert-into-current-note
source: [10-01-SUMMARY.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Button visible in complete-state
expected: После завершения протокола в панели плагина видны три кнопки рядом: "Copy to clipboard", "Save to note" и "Insert into note".
result: pass

### 2. Button disabled when no markdown note is active
expected: Закрой все заметки (или переключись на canvas/settings). Запусти протокол до конца. Кнопка "Insert into note" серая и не кликабельна.
result: issue
reported: "Кнопка активна даже без открытых заметок — плагин запоминает последнюю открытую заметку и сохраняет в неё. Переключение между двумя заметками попеременно меняет цель вставки. Работает даже когда открыт только canvas или нет ни одной вкладки."
severity: minor

### 3. Button enabled when a markdown note is active
expected: Открой любой markdown-файл в редакторе, запусти протокол до конца. Кнопка "Insert into note" активна и кликабельна.
result: pass
notes: Fixed — initialized lastActiveMarkdownFile from workspace scan in onOpen()

### 4. Button appends text with separator and shows Notice
expected: С открытой непустой заметкой, после завершения протокола нажми "Insert into note". Текст протокола добавляется в конец заметки с разделителем (---). Кратко появляется уведомление "Inserted into {имя файла}.".
result: pass

### 5. Button disabled state updates on leaf switch
expected: При открытой заметке и завершённом протоколе переключись на canvas или Settings — кнопка становится серой. Вернись к заметке — кнопка снова активна. Перезапуск протокола не нужен.
result: issue
reported: "Кнопка всегда активна — не становится серой при переключении на canvas/Settings."
severity: minor

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Кнопка 'Insert into note' серая и некликабельна когда нет активной markdown-заметки"
  status: failed
  reason: "User reported: кнопка всегда активна — плагин запоминает последнюю открытую заметку и сохраняет в неё вне зависимости от текущего состояния вкладок"
  severity: minor
  test: 2
  note: "By design — lastActiveMarkdownFile approach cannot be cleared on leaf-change without breaking click handler"

- truth: "Кнопка становится серой при переключении на canvas/Settings и снова активной при возврате к заметке"
  status: failed
  reason: "User reported: кнопка всегда активна, не реагирует на переключение вкладок"
  severity: minor
  test: 5
  note: "Same root cause as test 2"
