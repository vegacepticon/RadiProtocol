# Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

В graph model, canvas parser и graph validator ввести единый `loop` node kind (заменяя legacy пару `loop-start`/`loop-end`), добавить валидационные правила для «выход»-ребра и body-ветвей, и отклонять legacy-канвасы понятным сообщением на русском с инструкцией на пересборку — до того как runner runtime трогается.

**In scope:** `src/graph/graph-model.ts`, `src/graph/canvas-parser.ts`, `src/graph/graph-validator.ts`, `src/canvas/node-color-map.ts`, runner-level stubs в `src/runner/protocol-runner.ts` + `src/runner/runner-state.ts` (чтобы build остался зелёным), минимальная правка в `src/sessions/session-service.ts` (graceful reject legacy сессий), fixture updates в `src/__tests__/fixtures/`, тесты в `src/__tests__/graph-validator.test.ts`.

**NOT in scope (следующие фазы v1.7):**
- Полный runtime unified-loop picker (Phase 44 — RUN-01..07, включая удаление `settings.maxLoopIterations`)
- Node Editor form + NodePickerModal entry + формальная LOOP-06 (Phase 45 — LOOP-05, LOOP-06)
- `free-text-input` excision (Phase 46 — CLEAN-01..04)

</domain>

<decisions>
## Implementation Decisions

### Graph Model (`src/graph/graph-model.ts`)

- **D-01:** `RPNodeKind` union: добавляем `'loop'`, удаляем `'loop-start'` и `'loop-end'`. Break-compat с v1.0 loop-схемой принят в `/gsd-explore` (STATE.md → v1.7 Design Decisions #1).
- **D-02:** Новый `LoopNode extends RPNodeBase` имеет ровно два поля: `kind: 'loop'` + `headerText: string`. Без legacy-полей (`loopLabel`, `exitLabel`, `maxIterations`) — YAGNI, метка «выход» живёт на ребре, picker-UI сам решает композицию в Phase 44.
- **D-03:** `LoopStartNode` и `LoopEndNode` interface-объявления удаляются целиком. Поле `LoopStartNode.maxIterations` исчезает автоматически вместе с ним (удовлетворяет модельную часть RUN-07 заранее; глобальная `settings.maxLoopIterations` — D-14).
- **D-04:** `LoopContext.loopStartId` переименовывается в `loopNodeId` (меняется тип и все use-sites в runner/session/runner-state). Семантика prior-phase'а «один узел на фрейм цикла» сохраняется — просто цикл теперь стартует с unified loop узла вместо пары.

### Canvas Parser (`src/graph/canvas-parser.ts`)

- **D-05:** Парсер распознаёт `radiprotocol_nodeType = "loop"` → строит `LoopNode` с `headerText` из `radiprotocol_headerText`. Нормализация: `headerText` всегда `string`; отсутствие/undefined → `''` (симметрия с `questionText` / `text-block.content`, не pattern SnippetNode `string \| undefined`).
- **D-06:** Парсер ПРОДОЛЖАЕТ распознавать `radiprotocol_nodeType = "loop-start"` и `"loop-end"` как валидные kinds и строит для них placeholder-RPNode (`LegacyLoopStartNode` / `LegacyLoopEndNode` или сохранение старых interface'ов как "legacy-only", на усмотрение planner'а). Это нужно, чтобы validator мог выдать точную migration-error, а downstream graph-построение не разваливалось на edges ссылающихся на legacy-узлы. Valid kinds list в parser.ts остаётся: `['start', 'question', 'answer', 'free-text-input', 'text-block', 'loop-start', 'loop-end', 'snippet', 'loop']` (порядок на усмотрение planner'а; 'free-text-input' уходит в Phase 46).

### Validator (`src/graph/graph-validator.ts`)

- **D-07:** Migration error (MIGRATE-01): **одна** сводная строка на канвас в стиле Check 6, на **русском** языке, содержит перечень всех legacy-узлов через `nodeLabel()`-pattern (loopLabel если есть, иначе ID). Шаблон:
  > «Канвас содержит устаревшие узлы loop-start/loop-end: "<labelA>", "<labelB>". Пересоберите цикл с единым узлом loop: метка «выход» на одном из исходящих рёбер обозначает ветвь выхода, остальные исходящие рёбра — тело цикла.»
  Финальная формулировка — Claude's Discretion (D-CL-01), но обязательно: (a) называет «loop-start» и «loop-end» дословно, (b) называет «loop» дословно, (c) называет «выход» в кавычках-ёлочках, (d) перечисляет затронутые узлы.
- **D-08:** LOOP-04 enforcement для каждого `loop`-узла:
  1. Ровно одно исходящее ребро с `edge.label === 'выход'` (exact match, case-sensitive, без trim). Если 0 — ошибка («Loop node "<label>" не имеет ребра «выход». Добавьте исходящее ребро с меткой «выход».»).
  2. Дубликаты: 2+ исходящих рёбер с меткой «выход» → отдельная ошибка с ID конкретных рёбер.
  3. Минимум одна body-ветвь (любое исходящее ребро, метка которого НЕ «выход») — иначе ошибка («Loop node "<label>" не имеет ни одной body-ветви. Добавьте хотя бы одно исходящее ребро с другой меткой.»).
- **D-09:** `detectUnintentionalCycles`: маркер намеренного цикла меняется с `kind === 'loop-end'` на `kind === 'loop'`. Сообщение обновляется: «Unintentional cycle detected: ... Cycles must pass through a loop node.»
- **D-10:** Check 6 (orphaned loop-end) — удаляется целиком. `LoopEndNode` больше нет, `loopStartId` reference поле исчезло.
- **D-11:** `nodeLabel()` обновляется: удаляются ветки `case 'loop-start'` и `case 'loop-end'` (если legacy-узлы переживают parsing под именами LegacyLoopStartNode/LegacyLoopEndNode — добавляются краткие ветки возвращающие `loop-start (<id>)` / `loop-end (<id>)` для migration-error текста). Добавляется `case 'loop': return node.headerText || node.id`.

### Node Color Map (`src/canvas/node-color-map.ts`)

- **D-12:** `NODE_COLOR_MAP` получает `'loop': '1'` (red — тот же цвет, что был у loop-start/loop-end); ключи `'loop-start'` и `'loop-end'` удаляются. Это структурное следствие изменения `RPNodeKind` (Record тип форсит), а не новая фича LOOP-06 (которая также покрывает picker + editor в Phase 45).

### Session Layer (`src/sessions/session-model.ts`, `session-service.ts`)

- **D-13:** Break-compat для сохранённых сессий. `PersistedSession.loopContexts[].loopStartId` переименовывается в `loopNodeId` (строгий shape нового типа). `validateSessionNodeIds` и любой load-path должен gracefully отбросить старый файл (возвращать null / false без throw), чтобы plugin upgrade не крашился при первом открытии. Старые canvas-сессии в любом случае бесполезны — canvas-файл с loop-start/loop-end теперь фейлит validator перед runner'ом.

### Runner Stub (`src/runner/protocol-runner.ts`, `runner-state.ts`)

- **D-14:** В Phase 43 runner trогается минимально:
  - В `advanceThrough()` switch удаляются `case 'loop-start'` и `case 'loop-end'`.
  - Добавляется `case 'loop':` с `throw new Error('Loop runtime implemented in Phase 44')` (или эквивалентный assertNever-подобный stub на усмотрение planner'а).
  - `runner-state.ts` UndoEntry / state shape — удаляются поля ссылающиеся на loop-start/loop-end; добавляются минимальные placeholder'ы для loop-фрейма, которые Phase 44 дополнит picker-state. Цель: build зелёный, runtime на loop-канвасе бросает понятный stub-error.
- **D-15:** `settings.ts` поле `maxLoopIterations` + UI-toggle «max loop iterations» **остаются в Phase 43**. Удаление ждёт Phase 44 (RUN-07) как часть runtime-фазы. В Phase 43 runtime-использование `settings.maxLoopIterations` внутри runner просто уходит вместе со старой loop-логикой (она теперь падает в stub до счётчика).

### Fixtures and Tests

- **D-16:** Existing fixtures `src/__tests__/fixtures/loop-start.canvas`, `loop-body.canvas` — **сохраняются** как MIGRATE-01 тест-кейсы (validator должен выдать migration-error). По желанию planner'а переименовать в `legacy-loop-*.canvas` для ясности.
- **D-17:** Добавляются новые unified fixtures для LOOP-01..04 тестов:
  - `unified-loop-valid.canvas` — один loop узел, ровно одно ребро «выход», ≥1 body-ребро → validator passes.
  - `unified-loop-missing-exit.canvas` — loop без «выход» ребра → D-08.1 ошибка.
  - `unified-loop-duplicate-exit.canvas` — 2 ребра «выход» → D-08.2 ошибка.
  - `unified-loop-no-body.canvas` — только «выход», нет body → D-08.3 ошибка.
  - Имена fixture-файлов — Claude's Discretion в рамках kebab-case.
- **D-18:** Существующие runner-тесты, зависящие от loop-start/loop-end (`protocol-runner.test.ts`, `protocol-runner-session.test.ts` — loop-related блоки), помечаются `it.skip('TODO Phase 44: rewrite for unified loop')`. Не удаляются — сохраняют исторический контур тест-кейсов для планировщика Phase 44.
- **D-19:** `graph-validator.test.ts` — добавляются тесты для LOOP-04 (D-08.1/2/3), MIGRATE-01 (D-07), cycle detection через loop (D-09). Удаляются тесты для старого Check 6 (orphaned loop-end).
- **D-20:** `session-service.test.ts` — добавляется тест на graceful reject сессии со старым `loopStartId`-полем / ссылкой на legacy loop-start ID (D-13).

### Claude's Discretion

- **D-CL-01:** Точная формулировка migration-error (D-07) и LOOP-04 error-строк (D-08) — при сохранении ключевых элементов (русский язык, упоминание loop-start/loop-end/loop/«выход», nodeLabel-pattern перечисление).
- **D-CL-02:** Порядок Check'ов в `validate()` — planner решает. Migration-check должен идти перед LOOP-04 проверкой (иначе legacy loop-start узлы получат сбивающую ошибку про «отсутствует ребро выход»).
- **D-CL-03:** Имена fixture-файлов в рамках D-17 конвенции.
- **D-CL-04:** Реализация stub-throw в runner (D-14) — явный `throw new Error(...)` vs. `assertNever(node.kind)` vs. возврат error-state. Должно оставить build зелёным и не вводить unreachable TypeScript errors.
- **D-CL-05:** Имя нового placeholder-типа в model если legacy loop-start/loop-end остаются парсируемыми — `LegacyLoopStartNode` / `LegacyLoopEndNode` или переиспользование старых имён c пометкой `@deprecated`.

### Folded Todos

Ни один из открытых todo не попадает в scope Phase 43 (проверено против `.planning/STATE.md → Known Follow-ups` — Node Editor stale subfolderPath и Nyquist VALIDATION.md относятся к прочим милестонам/фазам).

</decisions>

<canonical_refs>
## Canonical References

**Downstream агенты (researcher, planner) ОБЯЗАНЫ прочесть перед работой.**

### v1.7 Design Authority
- `.planning/ROADMAP.md` — Phase 43 goal, dependencies, requirements, success criteria
- `.planning/REQUIREMENTS.md` — LOOP-01, LOOP-02, LOOP-03, LOOP-04, MIGRATE-01, MIGRATE-02 полный текст; Out of Scope для v1.7
- `.planning/STATE.md` — v1.7 Design Decisions (locked during `/gsd-explore`), Standing Pitfalls (особенно #10: maxIterations cannot be carried forward)
- `.planning/PROJECT.md` — Key Decisions table (break-compat, discriminated union on `kind`, radiprotocol_* namespace)

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — модульный layout, "New Node Type" checklist (9 шагов)
- `.planning/codebase/CONVENTIONS.md` — code style, naming
- `.planning/codebase/CONCERNS.md` — risks / tech debt

### Source — модификации в Phase 43
- `src/graph/graph-model.ts` — RPNodeKind union, LoopStartNode, LoopEndNode, LoopContext, RPNode union
- `src/graph/canvas-parser.ts:159-165` — validKinds список, parseNode() switch
- `src/graph/canvas-parser.ts:239-260` — текущие `case 'loop-start'` / `case 'loop-end'` блоки
- `src/graph/graph-validator.ts:55-85` — текущие Check 4 (cycles), Check 6 (orphaned loop-end)
- `src/graph/graph-validator.ts:128-187` — `detectUnintentionalCycles` с `loop-end` маркером
- `src/graph/graph-validator.ts:192-203` — `nodeLabel()` switch
- `src/canvas/node-color-map.ts:12-21` — NODE_COLOR_MAP entries
- `src/runner/protocol-runner.ts` — advanceThrough() switch, `maxLoopIterations` use-site (grep по loopStartId/loop-start/loop-end)
- `src/runner/runner-state.ts` — UndoEntry loop-related поля, state shape
- `src/sessions/session-model.ts` — PersistedSession → LoopContext[] shape
- `src/sessions/session-service.ts` — validateSessionNodeIds, load-path
- `src/settings.ts` — `maxLoopIterations` остаётся до Phase 44
- `src/views/runner-view.ts` — error panel (НЕ меняется; MIGRATE-02 удовлетворяется тем что validator просто добавляет ещё одну строку к errors[])
- `src/views/editor-panel-view.ts`, `src/views/node-picker-modal.ts` — НЕ меняются в Phase 43 (LOOP-05/06 — Phase 45)

### Fixtures and Tests
- `src/__tests__/fixtures/loop-start.canvas`, `loop-body.canvas` — legacy (D-16)
- `src/__tests__/graph-validator.test.ts` — обновления LOOP-04, migration, cycles (D-19)
- `src/__tests__/runner/protocol-runner.test.ts`, `protocol-runner-session.test.ts` — loop-блоки → it.skip (D-18)
- `src/__tests__/session-service.test.ts` — graceful reject тест (D-20)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`nodeLabel()` в GraphValidator** (`graph-validator.ts:192-203`) — existing pattern для рендера human-readable node-ссылок в ошибках. Используется в Check 3 (unreachable) и Check 6 (orphaned loop-end). Переиспользовать в migration-error (D-07) и LOOP-04 ошибках (D-08).
- **RunnerView error panel** — уже рендерит список validator-ошибок. MIGRATE-02 удовлетворяется без изменений во view: migration-error просто становится ещё одной строкой в `errors[]`.
- **Discriminated normalization pattern** (`canvas-parser.ts:202-204`) — `props['radiprotocol_separator'] === 'space' ? 'space' : ...` — model для строгой нормализации enum-like полей.
- **Break-compat precedent** — v1.7 Design Decisions #1 уже зафиксировал break-compat для canvas-файлов; сессии (D-13) следуют той же линии.

### Established Patterns
- **Zero-Obsidian-imports** для `src/graph/` и `src/runner/`: сохраняется. Migration-error на русском — просто string literal, не нарушает чистоту.
- **Exhaustive switch по discriminated union** (`graph-model.ts` RPNode): добавление/удаление kinds автоматически заставляет TypeScript ловить все незакрытые case'ы по `advanceThrough`, `nodeLabel`, `NODE_COLOR_MAP`. Это полезный side-benefit: Phase 43 "рыщет" все use-sites за нас.
- **Checks нумеруются в validate()** — удобно для human-readable code-navigation. Migration-check должен стать новым Check (например Check 0 или Check 7); LOOP-04 — отдельный Check. Planner решит нумерацию.
- **Per-phase CSS comment markers** (`/* Phase N: description */`) — не применяется в Phase 43 (CSS не трогаем).

### Integration Points
- `graph-model` → `canvas-parser` → `graph-validator` — весь feedback loop Phase 43.
- `graph-model` → `runner/{protocol-runner,runner-state}` — stub-ы в Phase 43; полный runtime в Phase 44.
- `graph-model` → `node-color-map` — вынужденное следствие изменения union в Phase 43.
- `graph-model` → `sessions/{session-model,session-service}` — rename + graceful reject в Phase 43.
- `graph-model` → `views/editor-panel-view` — не трогается в Phase 43 (Phase 45).
- `graph-model` → `views/node-picker-modal` — не трогается в Phase 43 (Phase 45).
- `graph-validator` → `views/runner-view` (error panel) — no-op в Phase 43; строка просто дописывается в errors[].

</code_context>

<specifics>
## Specific Ideas

- **Migration error — обязательные строковые элементы:** дословно «loop-start», «loop-end», «loop» и «выход» (в кавычках-ёлочках). Прочий текст на усмотрение planner/executor.
- **Метка «выход»** — literal Cyrillic: `'выход'` (шесть символов, без вариаций регистра). Как контракт с автором протокола, а не как толерантная эвристика.
- **Break-compat «тройной»:** canvas-файлы (D-06/D-07), PersistedSession (D-13), runner-tests (D-18). Все три — осознанные.

</specifics>

<deferred>
## Deferred Ideas

### Следующие фазы v1.7 (уже в ROADMAP — не scope creep)
- **Phase 44:** unified loop runtime picker, dead-end-return, nested-loop stack, step-back, session resume, удаление `settings.maxLoopIterations` (D-15) и UI-toggle (RUN-07), переактивация loop-runner-тестов которые в Phase 43 помечены `it.skip` (D-18).
- **Phase 45:** Node Editor form для unified loop (LOOP-05), NodePickerModal entry (LOOP-06), формальная LOOP-06 color-map запись (хотя D-12 уже кладёт запись — Phase 45 добавляет picker UI). «Формальная» LOOP-06 — это `NodePickerModal` listing, цвет в 43 — вынужденно.
- **Phase 46:** excision `free-text-input` из модели / парсера / runner / editor / picker / color-map / fixtures (CLEAN-01..04).

### Reviewed todos (not folded)
Ни один из todo не подошёл под scope Phase 43 — пусто.

### Post-v1.7
- i18n validator-ошибок (сейчас разнотон — migration на русском, остальные на английском). Не блокирует community release.

</deferred>

---

*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Context gathered: 2026-04-17*
