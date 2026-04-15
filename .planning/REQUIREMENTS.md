# RadiProtocol — v1.5 Requirements

**Milestone:** v1.5 Snippet Editor Refactoring
**Date:** 2026-04-15
**Status:** Mapped to roadmap (Phases 32–35)

---

## Goal

Переработать Snippet Editor: file-system-подобное дерево, модальные create/edit, синхронизация с vault, поддержка `.md` сниппетов в Protocol Runner.

---

## v1.5 Requirements

### Tree UI (SnippetManagerView)

- [ ] **TREE-01**: SnippetManagerView отображает сниппеты в виде раскрывающегося дерева папок/файлов (иерархия `.radiprotocol/snippets/`, expand/collapse на папках, индикатор типа .json/.md рядом с файлом)
- [ ] **TREE-02**: Старый master-detail layout полностью удалён — дерево единственный режим просмотра
- [ ] **TREE-03**: Клик по файлу в дереве открывает модалку редактирования этого сниппета
- [ ] **TREE-04**: Пустые папки отображаются явно (можно создать пустую подпапку и увидеть её до добавления сниппетов)

### Modal Create / Edit

- [x] **MODAL-01**: Создание сниппета происходит через модалку, а не inline в сайдбаре
- [x] **MODAL-02**: Редактирование существующего сниппета (имя, плейсхолдеры, содержимое) происходит через модалку
- [x] **MODAL-03**: Модалка создания имеет toggle/radio выбора типа: JSON (с плейсхолдерами) или Markdown (статическое содержимое)
- [x] **MODAL-04**: Модалка создания предзаполняется путём целевой папки — при нажатии кнопки «+ New» у конкретной папки в дереве
- [x] **MODAL-05**: Модалка содержит поле «Папка» (dropdown с деревом папок), позволяющее изменить путь перед сохранением
- [x] **MODAL-06**: Для JSON-сниппета модалка показывает существующий placeholder chip-editor из v1.3
- [x] **MODAL-07**: Для Markdown-сниппета модалка показывает inline textarea для редактирования содержимого
- [x] **MODAL-08**: Unsaved-changes guard: закрытие модалки с несохранёнными правками требует подтверждения

### Folder Operations

- [ ] **FOLDER-01**: Пользователь может создать новую подпапку внутри выбранной папки через context menu или кнопку в дереве
- [ ] **FOLDER-02**: Пользователь может удалить пустую или непустую папку через context menu с confirm (показывающим список что будет удалено)
- [ ] **FOLDER-03**: У каждой папки в дереве есть hover-кнопка «+ New» для быстрого создания сниппета с предзаполненным путём

### Move / Drag-and-Drop

- [ ] **MOVE-01**: Drag-and-drop перемещает сниппет на целевую папку в дереве — файл физически перемещается в vault
- [ ] **MOVE-02**: Drag-and-drop перемещает подпапку целиком в целевую папку
- [ ] **MOVE-03**: Context menu содержит пункт «Move to…» с выбором целевой папки из списка дерева
- [ ] **MOVE-04**: Модалка редактирования содержит кнопку «Move» / поле «Папка» для смены пути через сохранение
- [ ] **MOVE-05**: Перемещение обновляет все Canvas-ссылки (`subfolderPath`/имя файла в SnippetNode) автоматически

### Rename

- [ ] **RENAME-01**: Переименование сниппета inline через F2 / context menu «Rename»
- [ ] **RENAME-02**: Переименование папки inline через F2 / context menu «Rename»
- [ ] **RENAME-03**: Переименование обновляет все Canvas-ссылки (`subfolderPath`/имя файла в SnippetNode) автоматически

### Vault Sync

- [ ] **SYNC-01**: SnippetManagerView подписан на `vault.on('create')`, `vault.on('delete')`, `vault.on('rename')` и перерисовывает дерево при изменениях извне
- [ ] **SYNC-02**: Watcher фильтрует события только по `.radiprotocol/snippets/` префиксу — не реагирует на весь vault
- [ ] **SYNC-03**: Watcher отписывается при закрытии view (cleanup в `onClose()`)

### Delete

- [x] **DEL-01**: Удаление сниппета через context menu / кнопку в дереве физически перемещает файл в Obsidian trash через `vault.trash()`
- [x] **DEL-02**: Удаление требует подтверждения через confirm-модалку (показывает имя сниппета / папки)
- [ ] **DEL-03**: После удаления сниппет не отображается ни в дереве, ни в Protocol Runner snippet picker (фиксит рассинхрон)

### Markdown Snippet Support in Runner

- [ ] **MD-01**: Protocol Runner snippet picker отображает `.md` файлы из папки сниппетов вместе с `.json`
- [ ] **MD-02**: Выбор `.md` сниппета в runner вставляет содержимое файла as-is в накапливаемый текст — без запуска fill-in модалки
- [ ] **MD-03**: `.md` сниппеты корректно обрабатываются в `awaiting-snippet-pick` state (drill-down по папкам)
- [ ] **MD-04**: `.md` сниппеты корректно участвуют в mixed answer+snippet branching (Phase 31 flow)
- [x] **MD-05**: SnippetService различает тип по расширению файла и возвращает правильную модель (JSON-snippet vs MD-snippet) из listFolder/load методов

---

## Future Requirements (Deferred)

- [ ] Markdown preview в дереве при hover (показ первых ~200 символов содержимого)
- [ ] Bulk operations: multi-select с drag-drop нескольких файлов одновременно
- [ ] Snippet templates — сохранение часто используемых структур как шаблон
- [ ] Поиск по дереву (filter input сверху)
- [ ] Tag-based organization поверх папочной структуры

## Out of Scope

- Live markdown rendering в runner preview (вставляется raw markdown, Obsidian отрендерит при сохранении в note)
- Frontmatter parsing в .md сниппетах (вставляется весь файл включая frontmatter)
- .md плейсхолдеры (`{{name}}` синтаксис) — для динамических сниппетов используется JSON формат
- Синхронизация с облаком или другими vault'ами — локальные файлы через Obsidian vault API
- Версионирование сниппетов — Obsidian trash служит rollback'ом

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TREE-01 | Phase 33 | Pending |
| TREE-02 | Phase 33 | Pending |
| TREE-03 | Phase 33 | Pending |
| TREE-04 | Phase 33 | Pending |
| MODAL-01 | Phase 33 | Complete |
| MODAL-02 | Phase 33 | Complete |
| MODAL-03 | Phase 33 | Complete |
| MODAL-04 | Phase 33 | Complete |
| MODAL-05 | Phase 33 | Complete |
| MODAL-06 | Phase 33 | Complete |
| MODAL-07 | Phase 33 | Complete |
| MODAL-08 | Phase 33 | Complete |
| FOLDER-01 | Phase 33 | Pending |
| FOLDER-02 | Phase 33 | Pending |
| FOLDER-03 | Phase 33 | Pending |
| MOVE-01 | Phase 34 | Pending |
| MOVE-02 | Phase 34 | Pending |
| MOVE-03 | Phase 34 | Pending |
| MOVE-04 | Phase 34 | Pending |
| MOVE-05 | Phase 34 | Pending |
| RENAME-01 | Phase 34 | Pending |
| RENAME-02 | Phase 34 | Pending |
| RENAME-03 | Phase 34 | Pending |
| SYNC-01 | Phase 33 | Pending |
| SYNC-02 | Phase 33 | Pending |
| SYNC-03 | Phase 33 | Pending |
| DEL-01 | Phase 32 | Complete |
| DEL-02 | Phase 33 | Complete |
| DEL-03 | Phase 33 | Pending |
| MD-01 | Phase 35 | Pending |
| MD-02 | Phase 35 | Pending |
| MD-03 | Phase 35 | Pending |
| MD-04 | Phase 35 | Pending |
| MD-05 | Phase 32 | Complete |

**Coverage:** 34/34 requirements mapped ✓
