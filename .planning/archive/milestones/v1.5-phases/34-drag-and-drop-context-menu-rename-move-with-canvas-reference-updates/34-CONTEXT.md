---
phase: 34
slug: drag-and-drop-context-menu-rename-move-with-canvas-reference-updates
created: 2026-04-15
source: distilled from 34-RESEARCH.md + 34-PATTERNS.md (user skipped /gsd-discuss-phase)
---

# Phase 34 — Locked Decisions (Context Digest)

Пользователь пропустил `/gsd-discuss-phase` и `--skip-ui`. Ниже — решения, зафиксированные планировщиком на основе research + roadmap + паттернов Phase 33. Они **обязательны** для исполнителей всех планов фазы 34.

---

## D-01. Service API — Option A (service I/O only; view orchestrates canvas sync)

`SnippetService` получает четыре новых метода: `renameSnippet`, `moveSnippet`, `renameFolder`, `moveFolder`. Все четыре выполняют **только** vault I/O (rename + pre-flight). Вызов `rewriteCanvasRefs` происходит в **view**-слое после успешного I/O, по тому же шаблону, что `SnippetEditorModal.handleSave` в Phase 33. Service остаётся чистым.

**Обоснование:** соответствует существующей конвенции Phase 33 (D-09), упрощает тестирование (service-тесты не мокают vault canvas), даёт view контроль над Notice.

## D-02. Rename API — `app.vault.rename(abstractFile, newPath)` (не `fileManager.renameFile`)

Причина: сниппеты не ссылаются друг на друга через markdown-линки, а `.canvas`-ссылки обновляются нашим собственным `rewriteCanvasRefs`. `fileManager.renameFile` добавил бы ненужный проход по markdown-ссылкам. `vault.rename` обрабатывает как `TFile`, так и `TFolder` (рекурсивно).

## D-03. Canvas-ref mapping format — snippet-root-relative, БЕЗ расширения

Разрешение расхождения из 34-RESEARCH.md (HIGH priority): фактический формат `radiprotocol_subfolderPath` на диске и контракт `canvas-ref-sync.ts` (JSDoc lines 34-37) — **snippet-root-relative, без расширения, без ведущего слэша**. Тест `canvas-ref-sync.test.ts:75` (`['a/b', 'a/c']`) подтверждает это.

**Следствие 1 (placebo в Phase 33):** вызов `rewriteCanvasRefs(new Map([[oldPath, newPath]]))` в `snippet-editor-modal.ts:459-462` передаёт vault-relative пути с `.json`/`.md` — **никогда не матчится**. Нотис «Обновлено канвасов: N» всегда показывает N=0. Phase 34 обязан удалить этот вызов и исправить Notice.

**Следствие 2 (file vs folder асимметрия):** `SnippetNode` хранит **только папку** — файл rename/move канвас-невидимы. `rewriteCanvasRefs` вызывается **только** на folder rename и folder move.

**Утилита нормализации** (добавляется в `snippet-service.ts` как приватный хелпер или в `canvas-ref-sync.ts` как экспорт):
```ts
function toCanvasKey(vaultPath: string, snippetRoot: string): string {
  // strip snippetRoot + '/' prefix, strip trailing .json/.md
  let rel = vaultPath.startsWith(snippetRoot + '/') ? vaultPath.slice(snippetRoot.length + 1) : vaultPath;
  rel = rel.replace(/\.(json|md)$/i, '');
  return rel;
}
```
Для папок: только strip префикса, без замены расширения.

## D-04. DnD — HTML5, custom MIME `application/x-radi-snippet-file` / `application/x-radi-snippet-folder`

`dragover.preventDefault()` вызывается **только** если `dataTransfer.types.includes(...)` содержит наш MIME — иначе drop из ОС, chip-editor'а и т.п. не перехватывается. Drop папки на саму себя или на потомка отклоняется (self-descendant guard). Все листенеры — через `this.registerDomEvent` (auto-cleanup).

## D-05. F2 inline rename — swap `<span>` на `<input>`, `settled` flag против Enter+blur race

Replace label-span на transient `<input>`. Выделение текста — basename без расширения. Enter коммитит через service, Escape восстанавливает. `blur` коммитит только если `settled === false` (защита от Enter→commit→blur→double-commit). Контекстное меню «Переименовать» вызывает тот же `startInlineRename(node)`.

## D-06. Folder picker — `SuggestModal<string>`, hoist `buildFolderOptions`

Новый файл `src/views/folder-picker-modal.ts` расширяет `SuggestModal<string>` по образцу `src/views/node-picker-modal.ts`. Хелпер `buildFolderOptions` выносится из `SnippetEditorModal` в `SnippetService.listAllFolders(): Promise<string[]>` и переиспользуется обоими потребителями. При move папки из списка исключаются сама папка и её потомки.

## D-07. Expand-state prefix rewrite на folder rename/move

`settings.snippetTreeExpandedPaths` содержит абсолютные vault-relative пути папок. При rename/move папки **в той же транзакции** (после успешного `vault.rename`, перед notify-view) надо пройти по массиву и переписать префиксы `oldPath` → `newPath`. Это обязанность **view** (service не знает о settings).

## D-08. Локализация — русский

Все новые `Notice`, context-menu titles, modal placeholders, ошибки — на русском (совпадает с Phase 33 и user memory).

## D-09. CSS — append-only в `src/styles/snippet-manager.css`

Новые правила добавляются **в конец** файла под комментарием `/* Phase 34: drag-and-drop, inline rename */`. Ничего из Phase 33 не удаляется и не переписывается. После изменения — `npm run build`. `styles.css` не коммитится вручную.

## D-10. MOVE-04 — regression-only

Phase 33 уже реализовал поле «Папка» в editor modal (lines 447-475). Phase 34 **не** переписывает этот поток — только:
1. убирает placebo `rewriteCanvasRefs` call (D-03 следствие 1),
2. переводит single-file save+delete на новый `moveSnippet(oldPath, newFolder)` (атомарный rename вместо save+delete),
3. при file-only move Notice «Обновлено канвасов» **не показывается** (всегда 0).

## Deferred (вне Phase 34)

- Bulk multi-select DnD
- Tree arrow-key navigation, Enter-to-open
- Markdown preview / tree search / tags
- Orphan-canvas-node cleanup
- Pre-move confirm modal «Обновится N канвасов, продолжить?» — research предлагал, но UAT-шаги и так дают undo через Obsidian trash, лишняя модалка не нужна. Явный opt-out.
