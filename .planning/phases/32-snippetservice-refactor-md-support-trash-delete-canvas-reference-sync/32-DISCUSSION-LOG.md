# Phase 32: SnippetService Refactor — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
**Areas discussed:** Типы/API, Canvas ref sync scope, Sync utility форма, Trash + MD identity

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Типы JSON vs MD и API | Моделирование обоих типов + форма listFolder/load + id vs path | ✓ |
| Canvas ref sync scope | Только folder-refs или добавлять filename-поле на SnippetNode | ✓ |
| Sync utility форма | Модуль vs метод, контракт input, failure mode | ✓ |
| Trash + MD identity коллизии | system=true/false, foo.json vs foo.md | ✓ |

**User's choice:** все 4 области выбраны.

---

## Типы JSON vs MD и API

### Q1: Как моделировать JSON и MD снippet'ы?

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union (Recommended) | `Snippet = JsonSnippet \| MdSnippet` через `kind:'json'\|'md'`, общее `path` | ✓ |
| Сохранить SnippetFile + новый MdSnippetFile | Два отдельных типа, API возвращает два списка | |
| Единый Snippet с optional полями | Один интерфейс с optional template/placeholders/content | |

**User's choice:** Discriminated union

### Q2: Breaking или additive API?

| Option | Description | Selected |
|--------|-------------|----------|
| Breaking change, чистый API (Recommended) | listFolder возвращает Snippet[], load(path), delete(path), старые id-методы удалены | ✓ |
| Additive — старые методы + новые listFolderAll/loadByPath | Оба API параллельно на переход | |

**User's choice:** Breaking change

### Q3: Identity — path или внутреннее id?

| Option | Description | Selected |
|--------|-------------|----------|
| Path = identity (Recommended) | Полный vault-relative path единственный ID, id-поле в JSON deprecated | ✓ |
| Сохранить id-поле в JSON, MD = basename | Асимметричная идентификация | |

**User's choice:** Path = identity

---

## Canvas ref sync scope

### Q: Добавлять filename-поле на SnippetNode?

| Option | Description | Selected |
|--------|-------------|----------|
| Только folder-refs (Recommended) | SnippetNode не меняется, sync переписывает только subfolderPath при rename/move папки | ✓ |
| Добавить snippetFileName optional | Runner выбирает конкретный файл без picker'а, большой refactor runner-state | |

**User's choice:** Только folder-refs

**Notes:** Roadmap формулировка «subfolderPath + filename references» переформулирована в CONTEXT как «rewrite subfolderPath при rename/move папок». Downstream planner перепишет в PLAN.md.

---

## Sync utility форма

### Q1: Размещение?

| Option | Description | Selected |
|--------|-------------|----------|
| Отдельный модуль (Recommended) | `src/snippets/canvas-ref-sync.ts`, pure функция с App-зависимостью | ✓ |
| Метод на SnippetService | Проще для вызывающего, смешивает snippet I/O и canvas I/O | |

**User's choice:** Отдельный модуль

### Q2: Контракт input?

| Option | Description | Selected |
|--------|-------------|----------|
| Map old→new за один вызов (Recommended) | Один проход по всем canvas для batch-операций, prefix-match | ✓ |
| Один rename за вызов | Проще, но неэффективно при move папки с N детьми | |

**User's choice:** Map old→new

### Q3: Failure mode?

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort + отчёт (Recommended) | Продолжаем остальные файлы, возвращаем {updated, skipped} | ✓ |
| Транзакционно (all-or-nothing) | Сложнее, canvas всегда консистентны | |

**User's choice:** Best-effort + отчёт

---

## Trash + MD identity коллизии

### Q1: vault.trash system trash vs vault .trash/?

| Option | Description | Selected |
|--------|-------------|----------|
| system=false — .trash/ в vault (Recommended) | Obsidian default, sync между устройствами, работает в Mobile | ✓ |
| system=true — OS recycle bin | Не виден в vault, может не работать в sandboxed | |
| Читать из user settings Obsidian | Больше кода + undocumented internals | |

**User's choice:** system=false

### Q2: Коллизии foo.json vs foo.md в одной папке?

| Option | Description | Selected |
|--------|-------------|----------|
| Разрешить — это разные снippet'ы (Recommended) | Path=identity включает расширение, picker показывает оба с type-индикатором | ✓ |
| Запретить в модалке создания | Basename-уникальность в Ph33 модалке, helper в SnippetService | |

**User's choice:** Разрешить

---

## Claude's Discretion

- Нужен ли `SnippetFile` type alias → `JsonSnippet` vs полный rename
- Точные имена helper-функций (`assertInsideRoot`, `matchesSubfolderPrefix`)
- Тест-фикстуры canvas-ref-sync (single/multi/corrupt/no-op)
- Оставлять ли `id` в TS-типе `JsonSnippet` для терпимости старых файлов

## Deferred Ideas

- Добавление `snippetFileName` поля на SnippetNode (per-node specific snippet)
- Markdown preview в дереве (уже в Future Requirements)
- Frontmatter parsing в `.md` (уже в Out of Scope)
- Транзакционный canvas-sync — отвергнут в пользу best-effort
