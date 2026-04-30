# Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Сервисный слой `SnippetService` получает tree-ориентированную модель данных, распознаёт `.md` как first-class тип, удаляет через `vault.trash()`, и появляется vault-wide утилита переписывания Canvas `SnippetNode.subfolderPath` при rename/move папок.

**В scope:**
- Типы `Snippet` как discriminated union JsonSnippet | MdSnippet в `snippet-model.ts`
- Breaking refactor публичного API `SnippetService` (listFolder/load/delete)
- Path = identity повсеместно; id-поле в JSON deprecated
- Новый модуль `src/snippets/canvas-ref-sync.ts`
- `vault.trash(file, false)` для DEL-01
- Обновление существующих runner callsite'ов (protocol-runner, runner-view) под новый API
- Unit-тесты на extension routing, trash delete, canvas rewrite

**Вне scope (другие фазы):**
- UI дерева, модалки create/edit, folder operations — Phase 33
- Drag-and-drop, rename, context menu, триггеры sync utility из UI — Phase 34
- Runner picker отображения `.md` файлов + insert as-is — Phase 35
- Добавление `filename`-поля на SnippetNode (per-node specific snippet) — не требуется

</domain>

<decisions>
## Implementation Decisions

### D-01: Модель данных — discriminated union
- Тип `Snippet = JsonSnippet | MdSnippet`, различаются через `kind: 'json' | 'md'`
- Общее поле `path: string` (полный vault-relative path, включая расширение) — идентичность
- `JsonSnippet`: `{ kind: 'json', path, name, template, placeholders[] }` — поля эквивалентны текущему `SnippetFile` минус `id`
- `MdSnippet`: `{ kind: 'md', path, name, content: string }` — `name` вычисляется из basename без расширения
- Максимальная type safety: TS заставит runner разветвлять логику в каждом callsite, совпадает с паттерном `RPNode`
- Старый интерфейс `SnippetFile` заменяется на `JsonSnippet` (или сохраняется как alias для минимизации правок; решает planner)

### D-02: Path = identity; id-поле deprecated
- Полный vault-relative path — единственный идентификатор снippet'а (включая расширение)
- В `JsonSnippet` на диске поле `id` всё ещё присутствует для обратной совместимости с v1.4-файлами, но **в рантайме игнорируется** при `save()` (filename — источник истины)
- На `load()`: если `id` в JSON не совпадает с basename файла, это не ошибка — используется basename
- `MdSnippet` не имеет отдельного id
- Миграция существующих JSON-файлов: не требуется. Поле `id` просто не читается.

### D-03: API — breaking change, чистый контракт
Публичный интерфейс `SnippetService` после фазы:
- `listFolder(folderPath: string): Promise<{ folders: string[]; snippets: Snippet[] }>` — возвращает union оба типа
- `load(path: string): Promise<Snippet | null>` — универсальный, маршрутизация по расширению (`.json` → JSON.parse + JsonSnippet; `.md` → raw read + MdSnippet)
- `save(snippet: Snippet): Promise<void>` — ветвится по kind: JSON сериализует, MD пишет content raw
- `delete(path: string): Promise<void>` — path-based (не id-based), внутри использует `vault.trash()`
- `exists(path: string): Promise<boolean>`
- Старые `list()` / id-based `delete(id)` — **удаляются**, не сохраняются как deprecated

**Обновление callsite'ов:** runner (`protocol-runner.ts`, `runner-view.ts`, `editor-panel-view.ts`) обновляются в рамках этой же фазы. Планировщик должен явно включить задачи на обновление этих файлов с минимальными сохранными правками (только те места, что ломаются от смены типов/сигнатур).

### D-04: Sync utility — отдельный модуль
- Файл: `src/snippets/canvas-ref-sync.ts`
- Экспорт: `async function rewriteCanvasRefs(app: App, mapping: Map<string, string>): Promise<{ updated: string[]; skipped: Array<{ path: string; reason: string }> }>`
- Зависит от `App` (Obsidian API), не pure — но изолирована для тестирования через моки vault
- SnippetService **не** получает методов canvas I/O — разделение ответственности

### D-05: Sync контракт — Map old→new за один вызов
- `mapping`: ключ — старый folder path (относительно `settings.snippetFolderPath` без лидирующего слэша, в формате, совпадающем с `SnippetNode.subfolderPath`), значение — новый
- Один проход по `vault.getFiles()` с фильтром `.canvas`
- Для каждого canvas: parse JSON → найти nodes с `radiprotocol_nodeType === 'snippet'` → для каждого проверить `radiprotocol_subfolderPath` против mapping → если совпадает, переписать (точное совпадение или префикс с `/`) → если изменения были, `vault.modify()` через `WriteMutex`
- Батч-семантика: один вызов обновляет все затронутые canvas за один проход (эффективно для move целой папки с N-детьми)

**Сопоставление префиксов:** при перемещении папки `a/b` → `a/c`, SnippetNode с `subfolderPath='a/b/sub'` должен стать `'a/c/sub'`. Sync учитывает префикс-матч с границей `/`.

### D-06: Sync failure mode — best-effort + отчёт
- Если один canvas не читается / JSON невалиден / запись падает — продолжаем остальные
- Возвращаемое значение: `{ updated: string[], skipped: Array<{path, reason}> }`
- Утилита **не** бросает исключения из-за отдельных сломанных canvas
- Вызывающий (Phase 34 UI) отвечает за показ `Notice` с результатами
- Каждый skipped случай логируется через `console.error('[RadiProtocol] canvas-ref-sync:', ...)` в духе Phase 30

### D-07: SnippetNode — только folder-refs
- Структура `SnippetNode` не меняется: `subfolderPath?` остаётся единственным полем с path
- `filename` в roadmap success criterion 4 — переформулировано: sync перепишет subfolderPath при rename/move папки; rename отдельного snippet-файла canvas не трогает (runtime picker перечитает папку)
- Phase 34 может использовать sync при rename/move **папки** (не файла)

### D-08: Trash — system=false (Obsidian `.trash/`)
- `vault.trash(file, false)` — файл попадает в `.trash/` внутри vault
- Совпадает с Obsidian default, переживает vault sync между устройствами, работает в Mobile sandbox
- DEL-01 считается выполненным: файл исчезает из `.radiprotocol/snippets/` в рантайме, пользователь видит его в Obsidian file explorer под `.trash/`

### D-09: Коллизии foo.json vs foo.md — разрешены
- Path = identity включает расширение → `foo.json` и `foo.md` в одной папке это два разных снippet'а
- `listFolder` вернёт оба в массиве snippets
- runner picker (Phase 35) покажет оба с type-индикатором
- Валидация basename-уникальности **не** требуется в Phase 32

### D-10: Pre-I/O path-safety gate сохраняется
Существующий Phase 30 gate в `listFolder` (проверка `..`, absolute, containment в `snippetFolderPath`) распространяется на **все** path-принимающие методы нового API: `load`, `save`, `delete`, `exists`. Планировщик должен выделить helper (например, `private assertInsideRoot(path): string`) и применить его в каждой точке входа.

### D-11: WriteMutex обязателен для всех записей
- `save()` (JSON и MD) — под `WriteMutex.runExclusive(path, ...)`
- `delete()` — под тем же mutex
- `canvas-ref-sync` — `WriteMutex.runExclusive(canvasPath, ...)` на каждую canvas-запись (переиспользовать тот же экземпляр mutex, который владеет SnippetService, или завести свой — решает planner; главное, ключ — путь файла)

### Claude's Discretion
- Нужен ли `SnippetFile` как type alias → `JsonSnippet` для минимизации правок vs полный rename
- Точные имена утилит-функций (`matchesSubfolderPrefix`, `assertInsideRoot` и т.п.)
- Структура тест-фикстур для canvas-ref-sync (single-canvas, multi-canvas, mixed-non-snippet-nodes)
- Оставлять ли старое поле `id` на `JsonSnippet` TS-типе как `readonly id?: string` для терпимости старых JSON-файлов, или выкинуть из типа полностью (и парсить «руками»)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / requirements
- `.planning/ROADMAP.md` §Phase 32 — goal, dependencies, success criteria
- `.planning/REQUIREMENTS.md` §MD-05, §DEL-01 — requirement text
- `.planning/PROJECT.md` §Key Decisions — WriteMutex per-path, one-file-per-snippet, path-safety gate, BFS via adapter

### Существующий код — точки приложения изменений
- `src/snippets/snippet-service.ts` — **полная переработка публичного API** (list/listFolder/load/save/delete/exists)
- `src/snippets/snippet-model.ts` — **замена** `SnippetFile` на discriminated union `Snippet = JsonSnippet | MdSnippet`; `renderSnippet` остаётся для JSON, сигнатура может потребовать обновления (`JsonSnippet` vs `SnippetFile`)
- `src/graph/graph-model.ts` §SnippetNode — **не меняется** (D-07), но reader должен понимать почему filename-поле не добавляется
- `src/graph/canvas-parser.ts` lines 260–275 — образец чтения `radiprotocol_subfolderPath` (`null`/`''`/`undefined` нормализация, WR-02) — `canvas-ref-sync` должен уважать эту семантику

### Runner callsite'ы (обновляются в рамках фазы)
- `src/runner/protocol-runner.ts` — места, где читается snippet (`SnippetFile` → `Snippet`/`JsonSnippet`)
- `src/views/runner-view.ts` — awaiting-snippet-pick, snippet picker rendering
- `src/views/editor-panel-view.ts` — subfolder picker (чтение `listFolder`)
- `src/views/snippet-fill-in-modal.ts` — работает только с JSON-снippet'ами, после фазы принимает `JsonSnippet` вместо `SnippetFile`
- `src/views/snippet-manager-view.ts` — legacy master-detail UI. Задача фазы 32 — минимальная совместимость с новым API (чтобы билд не падал). Полная замена — Phase 33.

### Obsidian API
- `vault.trash(file: TAbstractFile, system: boolean)` — используется с `system=false`
- `vault.getFiles()` + фильтр по `.extension === 'canvas'` — для canvas-ref-sync scanner
- `vault.read()` / `vault.modify()` — canvas I/O (строго через `WriteMutex` для modify)

### Тесты-ориентиры
- `src/__tests__/snippet-service.test.ts` — существующие тесты, многие придётся переписать под новый API
- `src/__tests__/fixtures/snippet-node*.canvas` — уже есть snippet-canvas фикстуры, использовать как базу для sync-тестов
- Новые фикстуры: multi-canvas, mixed-non-snippet-nodes, сломанный JSON (для best-effort test)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WriteMutex** (`src/utils/write-mutex.ts`) — уже используется в SnippetService, распространить на canvas-sync
- **ensureFolderPath** (`src/utils/vault-utils.ts`) — используется в `save()`, продолжает работать
- **Pre-I/O path-safety gate** — существует в `listFolder` (Phase 30). Вынести в private helper и применить в каждом path-методе (D-10)
- **WR-02 нормализация** — `(typeof rawPath === 'string' && rawPath !== '') ? rawPath : undefined` паттерн из `canvas-parser.ts` должен сохраняться при write-back в sync утилите

### Established Patterns
- Zero Obsidian imports в engine-модулях (`snippet-model.ts`) — **сохраняется**. `canvas-ref-sync.ts` может импортировать App (как `snippet-service.ts` уже делает), т.к. это service-слой
- Discriminated union на `kind` — уже используется для `RPNode`; повторяем для `Snippet`
- Вся запись через WriteMutex per-path — масштабируется на canvas-sync
- Corrupt-file silent skip — паттерн `list()` / `listFolder()` в SnippetService; повторяем в canvas-sync

### Integration Points
- `src/main.ts` — инициализация `SnippetService`, не должна меняться
- Runner state `awaiting-snippet-pick` → `awaiting-snippet-fill` → `completeSnippet` — flow не трогаем (D-07), только типы вдоль цепочки
- `EditorPanelView` subfolder picker BFS — работает через `listFolder`, адаптируется к новому return type

</code_context>

<specifics>
## Specific Ideas

- Roadmap success criterion 4 говорит «rewrite SnippetNode `subfolderPath` + filename references» — зафиксировано (D-07): фаза переписывает только `subfolderPath`, т.к. SnippetNode не хранит имя файла. Downstream planner должен переписать эту формулировку в PLAN.md как «rewrite `SnippetNode.subfolderPath` при rename/move папок».
- Тест-фикстуры canvas-sync: минимум single-canvas+single-rename, multi-canvas+folder-move (prefix-match), canvas-с-поломанным-JSON (best-effort skip), canvas-без-snippet-nodes (no-op early return).
- `list()` (плоский list всего корневого folder) — **удаляется** без замены, если его нигде не используют. Проверить grep перед удалением.

</specifics>

<deferred>
## Deferred Ideas

- Добавление `snippetFileName` поля на `SnippetNode` (per-node specific snippet без picker'а) — осознанно отложено, не требуется для v1.5 scope
- Markdown preview в дереве — уже в REQUIREMENTS.md §Future Requirements
- Frontmatter parsing в `.md` файлах — уже в Out of Scope (REQUIREMENTS.md)
- `{{placeholder}}` синтаксис в `.md` — уже в Out of Scope
- Basename-уникальность валидация (`foo.json` vs `foo.md` в одной папке) — **разрешено сосуществование** (D-09), не откладываем
- Транзакционный (all-or-nothing) canvas-sync — отвергнут в пользу best-effort; если появится регрессия, пересмотреть в следующей итерации
- Retroactive Nyquist VALIDATION для ранних фаз — отдельный tech-debt backlog

</deferred>

---

*Phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync*
*Context gathered: 2026-04-15*
