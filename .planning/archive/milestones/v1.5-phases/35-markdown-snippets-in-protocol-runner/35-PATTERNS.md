# Phase 35: Markdown Snippets in Protocol Runner — Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 2 (1 source, 1 test)
**Analogs found:** 2 / 2
**Язык:** русский (по запросу phase runner'а)

> Фаза чисто additive-дельта поверх Phase 30 picker'а и Phase 32 `Snippet` union'а. Новых файлов нет, CSS не меняется (по UI-SPEC), runner-core не трогается. Все аналоги — это секции тех же файлов, которые будут модифицироваться.

## File Classification

| Файл (modify) | Role | Data Flow | Closest Analog (внутри того же файла) | Match Quality |
|---|---|---|---|---|
| `src/views/runner-view.ts` (`renderSnippetPicker` + `handleSnippetPickerSelection`) | view / UI handler | request-response (click → state mutation → re-render) | Те же методы в текущем состоянии (JSON-only branch, Phase 30 D-09) | exact (self-analog — расширение discriminated-union switch'а) |
| `src/__tests__/runner/protocol-runner.test.ts` (или `src/__tests__/runner-extensions.test.ts`) | test | unit / behaviour | `describe('awaiting-snippet-pick state ...')` блок с `pickSnippet`/`completeSnippet` assertions | exact (тот же state machine, тот же контракт) |

**No source file is created.** Только:
1. Модификация двух методов в `runner-view.ts`.
2. Новые unit-тесты, добавляемые в существующий test-suite (фикстуры — MD-сниппеты).

---

## Pattern Assignments

### `src/views/runner-view.ts` → `renderSnippetPicker` (view, MD row rendering)

**Analog:** тот же метод, строки 612–638 (folder-row + JSON-row loops).

**Folder-row rendering pattern (зеркало для MD-row)** — `src/views/runner-view.ts:612-621`:
```typescript
// D-03: folders first
for (const folderName of listing.folders) {
  const row = list.createEl('button', {
    cls: 'rp-snippet-folder-row',
    text: `📁 ${folderName}`,
  });
  this.registerDomEvent(row, 'click', () => {
    this.snippetPickerPath.push(folderName);
    this.render(); // D-05: local nav, no undo
  });
}
```

**Current JSON-only branch (removing the filter + adding 📄 prefix)** — `src/views/runner-view.ts:623-638`:
```typescript
// Then snippets.
// Phase 32: listing.snippets is now `Snippet[]` (JsonSnippet | MdSnippet).
// Full MD handling lands in Phase 35; for now the runner picker only
// surfaces JSON snippets — MD files are skipped silently. This keeps the
// existing handleSnippetPickerSelection(JsonSnippet) contract intact.
for (const snippet of listing.snippets) {
  if (snippet.kind !== 'json') continue;   // ← Phase 35: REMOVE
  const jsonSnippet = snippet;
  const row = list.createEl('button', {
    cls: 'rp-snippet-item-row',
    text: jsonSnippet.name,                 // ← Phase 35: добавить префикс 📄/📝
  });
  this.registerDomEvent(row, 'click', () => {
    void this.handleSnippetPickerSelection(jsonSnippet);
  });
}
```

**Copy patterns to new MD branch:**
- Используй `list.createEl('button', { cls: 'rp-snippet-item-row', text: ... })` — тот же класс для обоих kinds (CSS не меняется, UI-SPEC).
- `this.registerDomEvent(row, 'click', ...)` — никогда не `addEventListener` напрямую (Obsidian API convention).
- Префикс — это text-часть кнопки (`📄 ${snippet.name}` / `📝 ${snippet.name}`), не отдельный `<span>` — по UI-SPEC это part of visible text node for screen reader compatibility.
- Внутри одного цикла `for` — ветви по `snippet.kind`, а не два отдельных цикла (сохраняет порядок из `listFolder()`, см. UI-SPEC Drill-down symmetry).

---

### `src/views/runner-view.ts` → `handleSnippetPickerSelection` (view, discriminated-union dispatch)

**Analog:** тот же метод, строки 663–695 (JSON zero-placeholder path).

**Current full handler pattern** — `src/views/runner-view.ts:663-695`:
```typescript
/**
 * Phase 30 D-08, D-09, D-14: user clicked a snippet row.
 *  - Push pickSnippet to runner (undo-before-mutate inside the runner).
 *  - If snippet has zero placeholders → completeSnippet(template) directly (D-09).
 *  - Else open SnippetFillInModal; on resolve → completeSnippet(rendered); on cancel → completeSnippet('') (D-14).
 */
private async handleSnippetPickerSelection(snippet: SnippetFile): Promise<void> {
  // BUG-01: capture any manual edit before advancing
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
  this.runner.pickSnippet(snippet.id ?? snippet.name);

  if (snippet.placeholders.length === 0) {
    // D-09: no-placeholder path — skip modal, append template directly
    this.runner.completeSnippet(snippet.template);
    void this.autoSaveSession();
    this.snippetPickerPath = [];
    this.snippetPickerNodeId = null;
    this.render();
    return;
  }

  const modal = new SnippetFillInModal(this.app, snippet);
  modal.open();
  const rendered = await modal.result;
  if (rendered !== null) {
    this.runner.completeSnippet(rendered);
  } else {
    this.runner.completeSnippet('');
  }
  void this.autoSaveSession();
  this.snippetPickerPath = [];
  this.snippetPickerNodeId = null;
  this.render();
}
```

**Pattern to copy / widen for MD (D-02, D-03, D-04, D-06):**

1. **Signature widening:** `snippet: SnippetFile` → `snippet: Snippet` (импорт `Snippet` union вместо/вдобавок к `SnippetFile` из `src/snippets/snippet-model.ts`).

2. **MD branch — ПЕРВАЯ проверка в handler'е** (Pitfall 6 из RESEARCH.md: `MdSnippet` не имеет `placeholders`/`template`, обращение до kind-check = TS/runtime error). Скопировать структуру JSON-zero-placeholder path:
   ```typescript
   this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
   this.runner.pickSnippet(snippet.path);   // D-06 + Open Question 1: path стабильнее name
   if (snippet.kind === 'md') {
     // D-02 verbatim, D-03 empty OK, D-04 no modal
     this.runner.completeSnippet(snippet.content);
     void this.autoSaveSession();
     this.snippetPickerPath = [];
     this.snippetPickerNodeId = null;
     this.render();
     return;
   }
   // ... existing JSON path unchanged
   ```

3. **Последовательность invariant (Pitfall 7):** всегда `pickSnippet(...)` → `completeSnippet(...)`. `completeSnippet` — no-op если `runnerStatus !== 'awaiting-snippet-fill'`.

4. **Cleanup после вставки — идентично JSON zero-placeholder path:**
   - `autoSaveSession()` fire-and-forget.
   - `snippetPickerPath = []` и `snippetPickerNodeId = null`.
   - `this.render()`.

5. **Никакого нового метода на `ProtocolRunner`** (D-06, Anti-patterns из RESEARCH.md). Использовать существующие `pickSnippet` + `completeSnippet`.

---

### `src/__tests__/runner/protocol-runner.test.ts` (unit tests, behaviour)

**Analog:** `describe('awaiting-snippet-pick state (D-06..D-12, SNIPPET-NODE-03..07)')`, строки 601–692.

**pickSnippet → completeSnippet pattern** — `src/__tests__/runner/protocol-runner.test.ts:679-684`:
```typescript
it('completeSnippet after pickSnippet advances through outgoing neighbour', () => {
  // completeSnippet advances from n-snippet1 → n-tb1 (auto-append) → complete.
  runner.pickSnippet('snippetA');
  runner.completeSnippet('rendered text');
  // ... assertions on accumulatedText, currentNodeId, status
});
```

**Undo-before-mutate pattern (для D-06 step-back теста)** — `src/__tests__/runner/protocol-runner.test.ts:655-665`:
```typescript
it('pickSnippet is undo-before-mutate: stepBack from awaiting-snippet-fill reverts to snippet node', () => {
  runner.pickSnippet('x');
  // ... stepBack assertions
  // pickSnippet snapshotted currentNodeId=n-snippet1 BEFORE mutating, so stepBack
  // returns to snippet node with awaiting-snippet-pick status
});
```

**Copy patterns для MD-тестов (MD-01..MD-04, D-03, D-06):**

- **Arrange:** построить `MdSnippet` фикстуру напрямую как объект `{ kind: 'md', path, name, content }` — НЕ читать из vault (unit tests, без Obsidian API).
- **Act MD-02 / D-03:** `runner.pickSnippet(mdSnippet.path); runner.completeSnippet(mdSnippet.content);` — exact mirror of JSON zero-placeholder test above. Для empty MD — передать `''`.
- **Assert verbatim:** `expect(runner.getState().accumulatedText).toBe(expectedSepPrefix + mdContent)` — байт-в-байт, без trim.
- **Step-back (D-06):** после `completeSnippet(content)` вызвать `runner.stepBack()`, проверить что `accumulatedText` откатился к pre-MD snapshot и `status === 'awaiting-snippet-pick'`. Зеркалит `pickSnippet is undo-before-mutate` тест.
- **View-level тесты (MD-01, MD-03, MD-04):** если решено расширять `runner-extensions.test.ts` — копировать существующий pattern построения fake `SnippetService` с `listFolder()` возвращающей смешанный `Snippet[]`. NB: 3 pre-existing red-теста в `runner-extensions.test.ts` НЕ чинить (Pitfall 5, RESEARCH.md).

**Fixture location:** `src/__tests__/fixtures/` если туда уже кладутся JSON-фикстуры; иначе — inline в test file (MdSnippet — простой объект, 4 поля).

---

## Shared Patterns

### Discriminated-union switch by `kind`
**Source pattern:** `src/snippets/snippet-model.ts:56-60` (декларация `Snippet = JsonSnippet | MdSnippet`) + существующие callsites в `snippet-service.ts` / `snippet-tree-view.ts`.
**Apply to:** `handleSnippetPickerSelection` + row rendering loop в `renderSnippetPicker`.
**Rule:** ветвление ВСЕГДА перед доступом к variant-specific полям (`placeholders`, `template` — только JSON; `content` — только MD). TypeScript narrows union по `if (snippet.kind === 'md') { ... }`.

### Obsidian DOM API convention
**Source:** `src/views/runner-view.ts:612-621` (folder rows) + CLAUDE.md constraints.
**Apply to:** новый MD-row rendering.
**Rules:**
- `parent.createEl('button', { cls, text })` — никогда `document.createElement` + `innerHTML`.
- `this.registerDomEvent(el, 'click', handler)` — никогда `el.addEventListener` (Obsidian сам очищает listeners при unload).
- Эмодзи — часть text-ноды, не отдельный `<span>`.

### Undo/step-back reuse (D-06 invariant)
**Source:** `src/runner/protocol-runner.ts:233-277` — `pickSnippet` делает `undoStack.push({ nodeId, textSnapshot, loopContextStack })` ПЕРЕД мутацией.
**Apply to:** MD-ветка. НИЧЕГО не меняется в runner-core. MD использует тот же `pickSnippet → completeSnippet → stepBack` контракт, что и JSON zero-placeholder path. Session save/resume работает «бесплатно» через сериализацию `accumulatedText`.

### Session autosave fire-and-forget
**Source:** `src/views/runner-view.ts:675` (`void this.autoSaveSession();` после `completeSnippet` в JSON zero-placeholder path).
**Apply to:** MD branch — один вызов `void this.autoSaveSession();` ПОСЛЕ `completeSnippet(content)`, перед `render()`. Не дублировать вызов до `pickSnippet` (см. Phase 30 WR-03 comment в коде — race risk).

### CSS append-only / zero-CSS-diff (CLAUDE.md + UI-SPEC)
**Source:** `CLAUDE.md` "CSS files: append-only per phase" + UI-SPEC "CSS changes: none expected".
**Apply to:** `src/styles/runner-view.css` — **не трогать**. MD-row переиспользует `.rp-snippet-item-row`. Если появится реальная нужда в модификаторе (не ожидается) — только append в конец файла с `/* Phase 35: ... */` комментом, никогда не переписывать существующие правила.

---

## No Analog Found

Нет файлов без аналога. Вся фаза — дельта внутри уже существующих структур:
- Row rendering → зеркало folder-row loop'а.
- Click handler → расширение discriminated-union switch'а (аналогично `RPNode` switch'ам в `graph-model.ts`).
- Тесты → зеркало существующих `awaiting-snippet-pick` / `awaiting-snippet-fill` тестов.

---

## Metadata

**Analog search scope:**
- `src/views/runner-view.ts` (picker rendering + handler)
- `src/runner/protocol-runner.ts` (state machine contract, read-only для фазы)
- `src/snippets/snippet-model.ts` (`Snippet` union)
- `src/__tests__/runner/protocol-runner.test.ts` (существующие snippet-pick/fill тесты)
- `src/__tests__/runner-extensions.test.ts` (view-level tests — по необходимости)

**Files scanned:** 5 primary + grep по `pickSnippet|completeSnippet|MdSnippet` через кодовую базу.
**Pattern extraction date:** 2026-04-15
**Key insight:** всё, что нужно фазе 35, уже присутствует в codebase — паттерны для копирования находятся в тех же файлах/методах, которые будут модифицироваться. Planner'у следует формулировать task'и в терминах «расширить X по образцу соседней ветки Y», а не «создать новую абстракцию».
