# Phase 35: Markdown Snippets in Protocol Runner — Research

**Researched:** 2026-04-15
**Domain:** Obsidian plugin / TypeScript / Runner picker UI delta
**Confidence:** HIGH (задача целиком внутриpr-проектной, все источники — локальный codebase фаз 30/32/33/34)

## Summary

Фаза 35 — минимальный UI-дельта поверх существующего Protocol Runner snippet picker'а (фаза 30) и модели `Snippet = JsonSnippet | MdSnippet` из фазы 32. Весь runner-core (`ProtocolRunner.pickSnippet()` / `completeSnippet()` / `stepBack()` / сериализация сессии) уже готов принять MD-вставку без единой новой строки — нужно лишь снять фильтр `kind !== 'json'` в `renderSnippetPicker` и расширить click-handler до `Snippet`-union'а, ветку MD направив в `completeSnippet(mdSnippet.content)` напрямую (технически тот же путь, что zero-placeholder JSON в D-09 фазы 30).

`SnippetService.listFolder()` уже возвращает оба типа с фазы 32 (подтверждено MD-05 = Complete). Сессии сериализуют только `accumulatedText` + `currentNodeId` + undo-stack, поэтому save/resume и step-back после MD-вставки работают «бесплатно», без расширения формата сессии.

**Primary recommendation:** Одно касание в `src/views/runner-view.ts` (rendering + handler), ноль касаний в `src/runner/protocol-runner.ts`, ноль новых CSS-правил (по D-01 тип-индикатор — эмодзи в text-ноде строки). Тесты — расширение `runner-extensions.test.ts` фикстурами с MD-сниппетами.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Тип-индикатор в picker:** префикс-иконка перед именем. `.json` → `📄 snippet-name`, `.md` → `📝 snippet-name`, `📁 folderName` без изменений. Никаких цветов/hover-preview.
- **D-02 — Форматирование вставки MD-контента:** verbatim. `mdSnippet.content` вставляется байт-в-байт. Никакого strip frontmatter, trailing whitespace или разделителей. Никаких helper-функций типа `normalizeMdContent`/`stripFrontmatter`.
- **D-03 — Пустой/whitespace-only `.md`:** валидный пик, симметрично JSON-zero-placeholder. Клик вызывает `completeSnippet('')` (или `completeSnippet(whitespaceContent)`), runner продвигается. Никакой валидации/Notice/disabled-состояния.
- **D-04 — Preview MD-контента в picker:** нет. Клик сразу коммитит. Нет tooltip, expand, side panel. Эквивалентно JSON-zero-placeholder path (фаза 30 D-09).
- **D-05 — Имя MD-сниппета в picker:** `mdSnippet.name` (basename без расширения). Никакой H1-extraction, никаких двухстрочных row'ов с subtitle.
- **D-06 — Step-back после MD-вставки:** симметрично JSON. `pickSnippet()` делает snapshot перед вставкой (уже работает), `stepBack()` откатывает `accumulatedText` и `currentNodeId`, picker открывается заново. Никакой MD-специальной логики в `protocol-runner.ts`.

### Claude's Discretion

- CSS-класс row'а: оставить общим `.rp-snippet-item-row` или добавить модификатор `--md`/`--json` на будущее (planner решит по месту). По умолчанию — общий класс, т.к. визуальной разницы нет.
- Структура тестов: расширить существующие файлы фикстур или добавить новый suite для MD-веток picker'а.

### Deferred Ideas (OUT OF SCOPE)

- Preview MD-контента (hover, tooltip, expand, side panel) — forbidden by D-04.
- H1/title extraction или subtitle rows — forbidden by D-05.
- Frontmatter stripping, markdown-to-plain rendering, разделители между вставками — forbidden by D-02.
- Новые колонки/фильтры/сортировка в picker (в т.ч. kind-based grouping) — вне фазы.
- Копирование MD-сниппета в clipboard/экспорт — вне фазы.
- Drag-and-drop MD-сниппета в Runner preview — вне фазы.
- Disabled/greyed-out state для пустого `.md` — forbidden by D-03.
- Новые цвета для MD-row'ов (дифференциация — только glyph/emoji) — forbidden by UI-SPEC.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MD-01 | Protocol Runner snippet picker отображает `.md` файлы вместе с `.json` | `SnippetService.listFolder()` уже возвращает `Snippet[]` (JSON+MD) с фазы 32 (MD-05 = Complete). Нужно убрать фильтр `if (snippet.kind !== 'json') continue;` в `runner-view.ts:629` и добавить MD-branch с префиксом `📝` |
| MD-02 | Выбор `.md` вставляет содержимое as-is без fill-in модалки | `handleSnippetPickerSelection` расширяется до `Snippet`; MD-branch идёт по тому же техническому пути, что JSON-zero-placeholder (D-09 фазы 30): `pickSnippet(id)` → `completeSnippet(mdSnippet.content)`. Никакого modal |
| MD-03 | `.md` корректно обрабатываются в `awaiting-snippet-pick` (drill-down) | `renderSnippetPicker` уже рекурсивно обходит `snippetPickerPath`; MD-файлы появляются в `listing.snippets` на любой глубине — ничего дополнительного не нужно, нужен только unit/integration test, доказывающий drill-down с MD внутри subfolder |
| MD-04 | `.md` корректно участвуют в mixed answer+snippet branching (Phase 31 flow) | `pickSnippet()`/`completeSnippet()` не различают происхождение контента — branch-entered picker из фазы 31 использует тот же state machine. Тест должен покрыть SnippetNode-ветку (branch-entered) + MD-файл |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MD row rendering (prefix `📝`, click handler) | View (`runner-view.ts`) | — | Чистая презентация, runner-core про неё не знает |
| MD content insertion (verbatim) | View → Runner core | Runner (`completeSnippet`) | View вызывает существующий `completeSnippet(text)`; runner-core не различает JSON/MD |
| Undo snapshot / step-back | Runner (`pickSnippet`/`stepBack`) | — | Уже работает для JSON — MD переиспользует без изменений |
| Session save/resume | SessionService | — | Сериализуется `accumulatedText` — byte-identical между JSON/MD вставками |
| MD file load (content в `listFolder`) | SnippetService | Vault API | Уже реализовано в фазе 32 (MD-05) |
| Type discrimination (`kind`) | `snippet-model.ts` | — | Discriminated union уже есть; view только читает `kind` |

## Standard Stack

Фаза полностью проектная — никаких новых зависимостей. Все используемые инструменты уже стандарт проекта.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (проектный) | Типизация `Snippet` union | `[VERIFIED: package.json]` уже используется всюду |
| Obsidian API | current | `createEl`, `registerDomEvent`, `vault.read` | `[VERIFIED: runner-view.ts]` используется в picker'е |
| vitest | 2.x (проектный) | Test runner | `[VERIFIED: npm test]` — фаза 34 проходит через тот же suite |

**Installation:** ничего не ставить — всё уже в `package.json`.

## Architecture Patterns

### System Architecture Diagram (данных-поток для MD-пика)

```
User clicks 📝 row in Runner picker
         │
         ▼
runner-view.ts:renderSnippetPicker (MD-branch)
         │  prefix text: "📝 ${snippet.name}"
         │  onClick → handleSnippetPickerSelection(snippet)
         ▼
runner-view.ts:handleSnippetPickerSelection (kind-switch)
         │  syncManualEdit(preview textarea value)   ← уже есть
         │  runner.pickSnippet(snippet.path|name)    ← уже есть, undo snapshot
         │  switch(snippet.kind):
         │     case 'json': existing modal | zero-placeholder path
         │     case 'md'  : runner.completeSnippet(snippet.content) ← NEW branch
         ▼
ProtocolRunner.completeSnippet(text)
         │  accumulator.appendWithSeparator(text, sep)
         │  runnerStatus = 'at-node'
         │  advanceThrough(next)
         ▼
runner-view.render() → autoSaveSession() → session persisted
         │
         ▼  (later, если user жмёт Step back)
ProtocolRunner.stepBack()
         │  pops undoStack → restores accumulatedText + currentNodeId + loopContextStack
         ▼
picker reopens at snippetPickerPath state
```

### Recommended Project Structure

Никаких новых файлов. Touch-list (exhaustive):

```
src/
├── views/runner-view.ts         # renderSnippetPicker + handleSnippetPickerSelection
├── __tests__/
│   ├── runner-extensions.test.ts           # + MD picker tests (MD-01..MD-04)
│   └── (optional) runner-md-picker.test.ts # new suite если тесты не помещаются
```

**Не трогать:**
- `src/runner/protocol-runner.ts` — runner-core не меняется (D-06 invariant).
- `src/snippets/snippet-model.ts` — модель уже готова.
- `src/snippets/snippet-service.ts` — `listFolder()` уже возвращает MD.
- `src/styles/runner-view.css` — по UI-SPEC CSS изменений не ожидается; если всё-таки понадобится модификатор `--md`, append-only под `/* Phase 35: ... */`.

### Pattern 1: Discriminated Union Switch on Click Handler

**What:** Widening `handleSnippetPickerSelection` signature from `SnippetFile` (= `JsonSnippet`) to `Snippet` union и ветвление по `snippet.kind`.

**When to use:** всегда, когда callsite ранее обрабатывал только один вариант union'а — стандартный pattern проекта (зеркалит `RPNode` switch в `graph-model.ts`).

**Example:**
```typescript
// Source: существующий паттерн в runner-view.ts + graph-model.ts
private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
  // pickSnippet принимает string ID — basename подходит для обоих kinds
  this.runner.pickSnippet(snippet.name);

  if (snippet.kind === 'md') {
    // D-02: verbatim, D-03: пустой контент OK, D-04: без modal
    this.runner.completeSnippet(snippet.content);
    void this.autoSaveSession();
    this.snippetPickerPath = [];
    this.snippetPickerNodeId = null;
    this.render();
    return;
  }

  // existing JSON path (zero-placeholder или modal) — без изменений
  if (snippet.placeholders.length === 0) {
    this.runner.completeSnippet(snippet.template);
    // ... (existing)
    return;
  }
  // ... modal flow (existing)
}
```

### Pattern 2: Row rendering c prefix

```typescript
// Source: расширение runner-view.ts:628-638
for (const snippet of listing.snippets) {
  // Phase 35: снят фильтр kind !== 'json'
  const prefix = snippet.kind === 'md' ? '📝' : '📄';
  const row = list.createEl('button', {
    cls: 'rp-snippet-item-row',
    text: `${prefix} ${snippet.name}`,
  });
  this.registerDomEvent(row, 'click', () => {
    void this.handleSnippetPickerSelection(snippet);
  });
}
```

### Anti-Patterns to Avoid

- **Введение helper'а `insertMdSnippet()` в `ProtocolRunner`** — дублирует `completeSnippet()`, нарушает D-06 («ноль нового кода в runner-ядре»).
- **Трансформация MD-контента перед вставкой** (trim, strip frontmatter, нормализация newlines) — запрещено D-02.
- **Добавление нового RunnerStatus `awaiting-md-pick`** — state machine не меняется, MD идёт через существующий `awaiting-snippet-pick` → `awaiting-snippet-fill` → `completeSnippet`.
- **Добавление CSS-цвета для MD-row'ов** — дифференциация только через glyph (UI-SPEC + accessibility для colour-blind).
- **Re-read MD-файла из vault внутри click-handler'а** — `mdSnippet.content` уже загружен `listFolder()`, повторное чтение = race risk + лишний I/O.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MD content loading | Custom `vault.read()` в runner-view | `SnippetService.listFolder()` (уже грузит `content`) | Дублирование, race conditions |
| Undo snapshot для MD | Новый `pickMdSnippet()` method | Существующий `pickSnippet()` | D-06: runner-core не меняется |
| Session сериализация MD | Новое поле в `PersistedSession` | Существующий `accumulatedText` | Вставленный текст уже попадает в accumulator — byte-identical |
| Modal-less confirm | Отдельный confirm-dialog для MD | Прямой `completeSnippet(content)` | D-04: клик сразу коммитит |
| Type detection в view | Чтение расширения `.md`/`.json` | `snippet.kind === 'md'` | Discriminated union уже даёт tag |

**Key insight:** Все, что нужно фазе 35, уже построено в фазах 30/31/32. Фаза 35 — это снятие одного `continue;` и один `if`-branch в handler'е.

## Runtime State Inventory

> Rename/refactor? Нет — фаза **additive**. Никакие существующие данные/имена не меняются.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — vault `.md` файлы уже читаются `SnippetService` с фазы 32; формат сессии (`accumulatedText`) уже сохраняет любой текст | none |
| Live service config | None — нет внешних сервисов | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | None — никакие package names не меняются; esbuild-конфиг не трогается | none |

**Nothing found in any category — verified:** фаза чисто additive по view-слою.

## Common Pitfalls

### Pitfall 1: `pickSnippet(snippetId: string)` принимает строку, не `Snippet`

**What goes wrong:** Executor может ошибочно передать `snippet` (объект) вместо строки.
**Why it happens:** `pickSnippet` сигнатура исторически `(snippetId: string)`; разработчик мог ожидать, что после widening'а handler'а runner-core тоже должен знать `kind`.
**How to avoid:** `pickSnippet(snippet.path)` или `pickSnippet(snippet.name)` — строка. Текущий JSON-callsite передаёт `snippet.id ?? snippet.name` (`runner-view.ts:666`); для MD `id` нет — передать `snippet.name` (или `snippet.path` для более стабильного identity).
**Warning signs:** TS error в handler'е; runtime `runnerStatus !== 'awaiting-snippet-pick'` → silent return.

### Pitfall 2: Удаление `📄` prefix для JSON при добавлении `📝` для MD

**What goes wrong:** Executor может добавить `📝` только для MD-branch, оставив JSON без префикса — или наоборот удалить старый плоский `text: jsonSnippet.name`.
**Why it happens:** D-01 требует оба префикса одновременно — это изменение JSON-rendering'а, а не только добавление MD.
**How to avoid:** ВСЕГДА рендерить обе ветки с префиксом. Существующая строка `text: jsonSnippet.name` (runner-view.ts:633) МЕНЯЕТСЯ на `text: \`📄 ${snippet.name}\``.
**Warning signs:** Picker показывает `📝 md-name` и `json-name` (без префикса) — визуальная асимметрия.

### Pitfall 3: CSS append-only rule (CLAUDE.md)

**What goes wrong:** Executor, редактируя `runner-view.css`, случайно удаляет правила предыдущих фаз.
**Why it happens:** Автоматическое переформатирование / «чистка» shared-файлов.
**How to avoid:** По UI-SPEC CSS не трогается вообще. Если executor всё-таки хочет `--md` модификатор — append at bottom with `/* Phase 35: ... */` comment. Категорически никаких правок ранее существующих правил.
**Warning signs:** `git diff src/styles/runner-view.css` показывает удаления.

### Pitfall 4: Пропуск rebuild после CSS/TS изменений

**What goes wrong:** `styles.css` / `main.js` в корне stale, Obsidian грузит старую версию.
**How to avoid:** `npm run build` после любого изменения. Не коммитить руками правки в корневой `styles.css`.

### Pitfall 5: Тест `runner-extensions.test.ts` — 3 pre-existing failure

**What goes wrong:** Executor видит красные тесты и пытается их чинить.
**Why it happens:** Эти 3 падения — carry-over с ветки phase-26, не относятся к 35.
**How to avoid:** НЕ чинить. Новые MD-тесты должны быть green; pre-existing red-tests игнорируются (документировано в CONTEXT.md).

### Pitfall 6: Handler игнорирует разницу между JSON с placeholders и без

**What goes wrong:** MD-branch ставится ПОСЛЕ проверки `if (snippet.placeholders.length === 0)` — `placeholders` не существует на `MdSnippet` → TS error или runtime crash.
**How to avoid:** `if (snippet.kind === 'md')` должен быть ПЕРВОЙ проверкой в handler'е, ДО любого обращения к `snippet.placeholders`/`snippet.template`.

### Pitfall 7: `awaiting-snippet-fill` invariant

**What goes wrong:** `completeSnippet()` делает no-op если `runnerStatus !== 'awaiting-snippet-fill'`. Если executor забудет вызвать `pickSnippet()` перед `completeSnippet()` для MD-ветки — вставка молча не произойдёт.
**How to avoid:** Последовательность ОБЯЗАТЕЛЬНА: `pickSnippet(name)` → `completeSnippet(content)`. Это та же последовательность, что у JSON-zero-placeholder (runner-view.ts:666 → 674).

## Code Examples

Verified patterns from local codebase (все ссылки на файлы — `[VERIFIED: codebase grep]`):

### Existing JSON zero-placeholder path (the template for MD)

```typescript
// Source: src/views/runner-view.ts:663-680 (фаза 30 D-09)
private async handleSnippetPickerSelection(snippet: SnippetFile): Promise<void> {
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
  this.runner.pickSnippet(snippet.id ?? snippet.name);

  if (snippet.placeholders.length === 0) {
    this.runner.completeSnippet(snippet.template);
    void this.autoSaveSession();
    this.snippetPickerPath = [];
    this.snippetPickerNodeId = null;
    this.render();
    return;
  }
  // ... modal flow
}
```

### pickSnippet + completeSnippet contract

```typescript
// Source: src/runner/protocol-runner.ts:233-277
pickSnippet(snippetId: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-pick') return;
  if (this.currentNodeId === null) return;
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  this.snippetId = snippetId;
  this.snippetNodeId = this.currentNodeId;
  this.runnerStatus = 'awaiting-snippet-fill';
}

completeSnippet(renderedText: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-fill') return;
  // ... appendWithSeparator → advanceThrough
}
```

### Снимаемый фильтр

```typescript
// Source: src/views/runner-view.ts:624-638 (current state — BEFORE phase 35)
for (const snippet of listing.snippets) {
  if (snippet.kind !== 'json') continue;   // ← REMOVE in phase 35
  const jsonSnippet = snippet;
  const row = list.createEl('button', {
    cls: 'rp-snippet-item-row',
    text: jsonSnippet.name,                 // ← add 📄 prefix
  });
  this.registerDomEvent(row, 'click', () => {
    void this.handleSnippetPickerSelection(jsonSnippet);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `SnippetFile` type | `Snippet = JsonSnippet \| MdSnippet` discriminated union | Phase 32 | Runner picker фильтровал MD `continue`'ом до 35, теперь снимается |
| MD-файлы игнорируются в picker'е | MD появляются как равноправные entries | Phase 35 (this) | User может вставлять raw markdown snippets |
| Runner-core knew only `template` | Runner-core знает только `renderedText` (уже с фазы 5) | Phase 5 | MD попадает через существующий API без изменений |

**Deprecated/outdated:** none.

## Validation Architecture

> Enabled (config.json не содержит explicit false → default on).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (проектный) |
| Config file | `vitest.config.ts` (если есть) / `package.json` scripts |
| Quick run command | `npm test -- src/__tests__/runner-extensions.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MD-01 | Picker рендерит MD row с префиксом `📝` рядом с JSON `📄` | unit (view-level) | `npm test -- runner-extensions` | partially — нужен MD fixture + new test |
| MD-02 | Клик по MD-row → `completeSnippet(content)` без модалки, verbatim | unit | `npm test -- runner-extensions` | Wave 0 — new test |
| MD-03 | Drill-down в subfolder с MD-файлом → MD видно и кликабельно | unit / integration | `npm test -- runner-extensions` | Wave 0 — new test |
| MD-04 | Branch-entered snippet picker (фаза 31 SnippetNode flow) + MD | unit / integration | `npm test -- runner-extensions` | Wave 0 — new test |
| Step-back симметрия | `stepBack()` после MD-вставки возвращает `accumulatedText` к pre-MD snapshot | unit | `npm test -- runner-extensions` | Wave 0 — new test |
| Empty MD (D-03) | Пустой `.md` → `completeSnippet('')`, runner advances | unit | `npm test -- runner-extensions` | Wave 0 — new test |
| Session save/resume с MD | Сериализация→десериализация содержит вставленный MD-контент | unit | `npm test -- session` | Wave 0 — new test или расширение |

### Sampling Rate
- **Per task commit:** `npm test -- src/__tests__/runner-extensions.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (с учётом 3 pre-existing failures из phase-26 — их игнорируем по CONTEXT.md).

### Wave 0 Gaps
- [ ] Fixture: `tests/fixtures/snippets/` с `.md` файлом (и subfolder variant для MD-03)
- [ ] New test: MD row rendering (MD-01)
- [ ] New test: click → completeSnippet verbatim (MD-02)
- [ ] New test: drill-down с MD (MD-03)
- [ ] New test: branch-entered picker + MD (MD-04, uses Phase 31 SnippetNode graph fixture)
- [ ] New test: step-back после MD-вставки (D-06)
- [ ] New test: пустой `.md` content (D-03)
- [ ] Optional: session round-trip с MD-вставленным текстом

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SnippetService.listFolder()` загружает `content` для `.md` файлов (не lazy) | Architecture | LOW — если lazy, executor обнаружит при первом тесте и добавит explicit read; но model.ts comment «Raw file contents» подтверждает eager load |
| A2 | `pickSnippet(snippetId: string)` принимает basename или path одинаково — id используется только для последующего resolve в fill-modal, а MD-ветка модалку не открывает, поэтому любой уникальный string OK | Pitfall 1 | LOW — fail-fast в тестах покажет если runner ожидает specific format |
| A3 | 3 pre-existing падения в `runner-extensions.test.ts` не связаны с snippet picker | Pitfall 5 | LOW — явно задокументировано в CONTEXT.md, но executor должен сверить список падений до старта |

**Все остальные утверждения — `[VERIFIED: codebase]` через чтение исходников.**

## Open Questions

1. **`pickSnippet(id)` — какой string передавать для MD?**
   - What we know: JSON-callsite передаёт `snippet.id ?? snippet.name` (строка, used как key для snippetFillModal). MD не нуждается в lookup (content уже на руках).
   - What's unclear: стабильнее ли передавать `snippet.path` (уникальный в рамках vault) или `snippet.name` (может колллайдить между папками).
   - Recommendation: `snippet.path` — identity по D-02 фазы 32. Это строка, runner-core её только сохраняет в `this.snippetId` и после `completeSnippet` обнуляет — no lookup нужен.

2. **Нужен ли CSS-модификатор `.rp-snippet-item-row--md`?**
   - What we know: UI-SPEC declares «no CSS changes». Эмодзи несёт визуальную дифференциацию.
   - What's unclear: захочется ли в будущих фазах (preview, цвет) хук — сейчас или потом?
   - Recommendation: НЕ добавлять сейчас. YAGNI. Если понадобится — append-only в фазе N+1.

## Environment Availability

Skipped — фаза чисто in-project, никаких внешних зависимостей/CLI/сервисов сверх уже установленных (node, npm, vitest, esbuild) не требуется.

## Project Constraints (from CLAUDE.md)

- **Build:** `npm run build` (prod) / `npm run dev` (watch) после любых TS/CSS изменений. `styles.css` в корне НЕ редактировать руками — generated.
- **CSS append-only per phase:** новые правила — в конец `src/styles/runner-view.css` с комментом `/* Phase 35: ... */`. Никогда не переписывать существующие секции. По UI-SPEC ожидается zero CSS diff.
- **Never remove existing code you didn't add:** при редактировании `runner-view.ts` и shared-файлов — только add/modify relevant rows. Никакого silently deleting существующих event listeners / методов.
- **Tests:** `npm test` (vitest). 3 pre-existing падения на phase-26 ветке — не чинить в рамках 35.
- **DOM API:** no `innerHTML`, use `createEl`/`registerDomEvent` (уже соблюдается текущим picker'ом).
- **No `require('fs')`:** только `app.vault.*` — MD-контент уже грузится через `SnippetService` на базе vault API.

## Sources

### Primary (HIGH confidence)
- `src/views/runner-view.ts:580-695` — `renderSnippetPicker` + `handleSnippetPickerSelection` existing code
- `src/runner/protocol-runner.ts:225-290` — `pickSnippet`/`completeSnippet`/`syncManualEdit` contracts
- `src/snippets/snippet-model.ts:1-113` — `Snippet` discriminated union, `MdSnippet` shape
- `.planning/phases/35-markdown-snippets-in-protocol-runner/35-CONTEXT.md` — locked D-01..D-06
- `.planning/phases/35-markdown-snippets-in-protocol-runner/35-UI-SPEC.md` — Checker dimensions + out-of-scope guard
- `.planning/REQUIREMENTS.md` — MD-01..MD-04 definitions + MD-05 (Complete) baseline
- `CLAUDE.md` — CSS/shared-file rules

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — phase 34 status, standing pitfalls

### Tertiary (LOW confidence)
- none — research is entirely in-codebase, no web sources needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — весь стек уже в проекте, ничего нового
- Architecture: HIGH — runner-core invariants прочитаны напрямую, D-06 «ноль нового кода» подтверждается сигнатурами
- Pitfalls: HIGH — большинство извлечены из существующих комментариев кода (Pattern A, BUG-01, CLAUDE.md)
- Tests: MEDIUM — структура существующих runner-extensions тестов не полностью просмотрена, executor должен уточнить при Wave 0

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 дней — внутрипроектная задача, ветка стабильна)
