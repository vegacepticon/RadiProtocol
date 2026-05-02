# Phase 77: Eslint Findings Cleanup - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Привести `npm run lint` к exit code 0 на чистом checkout `main`. Поверхности изменений:

1. **`eslint.config.mjs`** — добавить `.planning/**` в `ignores`; добавить override-блок для `src/__tests__/**` + `src/__mocks__/**` (оба обоснования в commit messages).
2. **`src/styles/*.css`** (per-feature, append-only) — новые правила для CSS-классов state-toggle и CSS custom properties для runtime geometry.
3. **`src/views/*.ts` + ещё ~6 файлов в src/** — заменить `element.style.x = ...` на (a) `el.toggleClass('rp-{component}-{state}', boolean)` для статических state-toggles или (b) `el.setCssProps({'--rp-foo': value})` для runtime geometry. Плюс остаточные правила (sentence-case, floating-promises, this-alias, unused-vars в src, no-tfile-tfolder-cast, no-constant-binary-expression, no-control-regex и т.п.).

Phase 77 предшествует Phase 78 (CI-gate) — что мы решаем здесь, то будет блокировать каждый будущий коммит на `main`.

**Не входит:** изменения runtime-поведения (per CLAUDE.md «only add or modify code relevant to the current phase»); декомпозиция файлов 75/76; новые user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Lint scope
- **D-01:** `.planning/**` добавляется в `ignores` блока `eslint.config.mjs`. **Обоснование (для commit message):** `.planning/archive/v1.11-phases/72.../73.../build/*.mjs` — это архивные canvas-builder скрипты завершённой v1.11 milestone, не active source code. CONCERNS.md MEDIUM-3 уже подтвердил статус архива. 9 находок снимаются.
- **D-02:** Для `src/__tests__/**` и `src/__mocks__/**` добавляется отдельный override-блок в `eslint.config.mjs` с правилами:
  - `'@typescript-eslint/no-explicit-any': 'off'` — обоснование: type-mocks Obsidian API требуют гибкости; полное типизирование ломает тесты или дублирует production-типы (см. `src/__mocks__/obsidian.ts`).
  - `'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]` — обоснование: `_underscore` префикс уже project convention (CONVENTIONS.md §Naming Patterns). Mock callbacks с `_evt`, `_text`, `_cb` и т.п. — намеренно не используются и помечены префиксом.
  - **Оба override обоснования — в одном commit message** (per ROADMAP SC#3).
  - ~430 находок (243 unused-vars + 191 explicit-any в тестах) исчезают.

### Test residual findings (после overrides)
- **D-03:** Не расширять test-override на остальные правила. Оставшиеся 6 тестовых находок фиксим вручную:
  - 3 × `@typescript-eslint/no-this-alias` в `inline-runner-modal*.test.ts` (lines 267/261/272) → переписать `const self = this` на arrow function или явный `this: T` параметр.
  - 1 × `@typescript-eslint/no-floating-promises` в `snippet-editor-modal-banner.test.ts:304` → добавить `void`/`await`.
  - 2 × `obsidianmd/ui/sentence-case` в `snippet-tree-picker.test.ts:979/996` → исправить тестовые fixture-строки в sentence case.

### Static-styles strategy (39 findings в src/views/)
- **D-04:** **Гибрид по природе** — категоризация определяется природой стиля:
  - **Static state toggles** (`display`, `opacity`, `color`, `pointerEvents`, `alignItems`, `gap`, `maxWidth` фиксированный) → `el.toggleClass('rp-{component}-{state}', boolean)` + правило в соответствующем `src/styles/*.css`. Применимо к: `snippet-editor-modal.ts`, `snippet-chip-editor.ts`, `snippet-fill-in-modal.ts`, `snippet-manager-view.ts` (display-toggles), частично `editor-panel-view.ts`.
  - **Runtime geometry** (`left`, `top`, `right`, `bottom`, dynamic `width`/`height`, `transform`) → `el.setCssProps({'--rp-x': value})` с CSS custom properties; правила в src/styles/ ссылаются на `var(--rp-x)`. Применимо к: `inline-runner-modal.ts:applyPosition/applyLayout` (lines 654-677, Phase 60/67 drag+resize state); `runner-view.ts:renderPreviewZone` (lines 1050-1069, auto-grow textarea); `editor-panel-view.ts` resize helper (lines 525-533, 660-661, auto-grow shared helper).
- **D-05:** **Class naming convention:** `rp-{component}-{state}` (например `rp-snippet-banner-hidden`, `rp-chip-disabled`, `rp-modal-error`). Сохраняет `rp-` namespace per CONVENTIONS.md §CSS architecture. Не использовать Obsidian core-style `is-*` (риск коллизий) и не использовать гибрид `rp-is-*`.
- **D-06:** **CSS custom property naming convention:** `--rp-{component}-{prop}` (например `--rp-inline-left`, `--rp-inline-top`, `--rp-inline-width`, `--rp-textarea-height`). Сохраняет `rp-` namespace и читаемость.
- **D-07:** **CSS-файл маппинг (per-feature, append-only per CLAUDE.md §CSS Architecture):**
  - `snippet-editor-modal.ts` rules → `src/styles/snippet-manager.css` (общий snippet-feature файл)
  - `snippet-chip-editor.ts` rules → `src/styles/snippet-manager.css`
  - `snippet-fill-in-modal.ts` rules → `src/styles/snippet-fill-modal.css`
  - `snippet-manager-view.ts` rules → `src/styles/snippet-manager.css`
  - `runner-view.ts` rules → `src/styles/runner-view.css`
  - `inline-runner-modal.ts` rules → `src/styles/inline-runner.css`
  - `editor-panel-view.ts` rules → `src/styles/editor-panel.css`
  - Все файлы уже зарегистрированы в `esbuild.config.mjs` CSS_FILES; новых файлов добавлять не надо.
  - Каждое новое правило префиксуется комментарием `/* Phase 77: <description> */`.

### Coordination with Phase 75/76
- **D-08:** **Phase 77 идёт раньше Phase 75 и Phase 76.** Lint baseline фиксируется первым; 75 (DEDUP) и 76 (SPLIT) наследуют чистые patterns в новых модулях. Это означает:
  - Phase 75 при создании shared `RunnerRenderer` под `src/runner/` ОБЯЗАН использовать setCssProps/toggleClass из старта (а не raw `style.x = ...`).
  - Phase 76 при декомпозиции `editor-panel-view.ts` в per-kind formy ОБЯЗАН тоже сохранять setCssProps/toggleClass подход.
  - CLAUDE.md «never delete code you didn't add» имеет естественное исключение во время refactor scope (как Phase 67 D-14 уже прецедент в PROJECT.md).
- **D-09:** При перемещении кода между файлами в Phase 75/76 setCssProps-вызов «переезжает» с кодом тривиально; CSS-правила в `src/styles/*.css` остаются на месте независимо от того, в каком .ts-файле живёт логика. Phase 78 CI gate ловит регрессии если случатся.
- **D-10:** **Из 75 src-находок только ~14 в файлах 75/76:** runner-view.ts (5), inline-runner-modal.ts (7 — но 5 в `applyPosition`/`applyLayout` остаются в host shell), editor-panel-view.ts (2). Остальные ~61 в файлах вне scope 75/76 (snippet-*, settings.ts, main.ts, node-picker-modal.ts, canvas-parser.ts, snippet-service.ts).

### Commit granularity & rollout
- **D-11:** **Per-rule + per-file commits.** ~12-15 атомарных коммитов:
  - Stage 1: `chore(lint): ignore .planning/ + add test/mock overrides` (D-01, D-02 — оба обоснования в одном коммите)
  - Stage 2 (одна на файл, для static-styles): `refactor(<file>): replace style.x with rp-{state} class / setCssProps` + соответствующее правило в `src/styles/*.css`. ~7 коммитов.
  - Stage 3 (одна на rule в каждом файле где она встречается): `refactor(<file>): fix <rule>`. Для sentence-case, no-floating-promises, no-this-alias, no-unused-vars, no-tfile-tfolder-cast, no-constant-binary-expression, no-control-regex и т.п.
  - Финальный коммит: проверка `npm run lint` exit 0 + `npm test` green.
- **D-12:** Каждый коммит включает соответствующее изменение в `src/styles/*.css` (если применимо) — `npm run build` должен оставаться green после каждого коммита.

### Warnings handling (6 warnings из 523)
- **D-13:** Из 6 warnings:
  - 4 fixable через `eslint --fix` (видимо whitespace-style); запустить fix в финальном коммите Stage 3.
  - 1 × unused `eslint-disable` directive в `snippet-editor-modal.ts:143` → удалить (директива указывала на `no-explicit-any`, но никаких `any`-нарушений в этом блоке нет).
  - 2 × `obsidianmd/prefer-file-manager-trash-file` warnings — фиксить (заменить `vault.trash()` или `vault.delete()` на `app.fileManager.trashFile()` где применимо). Если фикс ломает behaviour (например trash-файл vault-relative vs OS-trash), документировать в `77-VERIFICATION.md` как explicit out-of-scope с rationale per ROADMAP SC#5.

### Claude's Discretion
- Конкретные имена CSS-классов и custom properties в каждом отдельном случае (например `rp-snippet-banner-hidden` vs `rp-snippet-error-banner-hidden`). Researcher/planner выберет имя следуя D-05/D-06 шаблону.
- Точный порядок stage-2 коммитов между файлами — researcher/planner решит исходя из dependency order (если есть).
- Решение fix vs document для 2 `prefer-file-manager-trash-file` warnings — после исследования кода researcher оценит.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & milestone context
- `.planning/PROJECT.md` — v1.12 milestone goal; LINT-01 положение в Tech Debt scope; v1.0-v1.11 decisions table.
- `.planning/REQUIREMENTS.md` §LINT-01 — phase requirement spec; «Rule tuning permitted only with written justification»; «Lint-warning fixes nice-to-have, in scope only if cheap».
- `.planning/ROADMAP.md` §Phase 77 — фаза goal + 5 success criteria; ROADMAP SC#3 (rule tuning rule), SC#5 (warnings handling), SC#4 (vitest suite must pass).
- `.planning/codebase/CONCERNS.md` MEDIUM-2 + MEDIUM-3 + MEDIUM-4 — context for why phase exists; ordering rationale.
- `.planning/quick/260430-uas-low-cleanup-batch-from-concerns-md/260430-uas-SUMMARY.md` §«Pre-existing lint findings surfaced by LOW-6» — origin of 523 findings (commit `07aa79d` when eslint promoted to direct devDep).

### Coding conventions
- `CLAUDE.md` (project root) — **CSS Architecture** (per-feature `src/styles/*.css`, append-only per phase, never edit generated `styles.css`); **«ONLY add or modify code relevant to the current phase»** rule (CRITICAL — applies to Phase 77 when touching shared files); CSS file mapping table (runner-view.css, editor-panel.css, snippet-manager.css, snippet-fill-modal.css, loop-support.css, canvas-selector.css).
- `.planning/codebase/CONVENTIONS.md` §Naming Patterns — `_underscore` convention для intentional unused; §Code Style §Linting — текущие правила; §«Void-ing fire-and-forget promises»; §CSS architecture — `rp-` namespace.

### Existing config to extend
- `eslint.config.mjs` (root) — текущие 23 obsidianmd rules + TS rules + ignores. Phase 77 добавит: (1) `.planning/**` к ignores, (2) override-блок для тестов/моков.
- `esbuild.config.mjs` (root) — CSS_FILES list; ВСЕ необходимые per-feature CSS-файлы уже зарегистрированы.
- `package.json:11` — `"lint": "eslint ."`; не меняется.

### Specific code-locations to migrate (с точными line-numbers)
- `src/views/inline-runner-modal.ts:654-677` — `applyPosition` + `applyLayout`. Phase 60/67 runtime geometry. → setCssProps + CSS custom properties.
- `src/views/runner-view.ts:1052-1069` — `renderPreviewZone` auto-grow textarea. Phase 64 pattern. → setCssProps + CSS custom property для height; CSS-class для width=100%.
- `src/views/editor-panel-view.ts:525-533, 655-663` — auto-grow shared helpers. Phase 64 pattern. → setCssProps.
- `src/views/snippet-manager-view.ts:911, 937` — inline-rename label show/hide; eslint парсит как `style.undefined` (computed access на `style['display']`). → toggleClass.
- Полный список 39 static-style violations: см. вывод `npm run lint` после применения D-01/D-02 overrides.

### Phase 75/76 boundaries (для D-08/D-09 координации)
- `.planning/ROADMAP.md` §Phase 75 (DEDUP-01/02) — какие render-методы переедут в shared `RunnerRenderer` под `src/runner/`.
- `.planning/ROADMAP.md` §Phase 76 (SPLIT-01/02) — какие per-kind formy переедут под `src/views/editor-panel/forms/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Obsidian `el.toggleClass(cls, value)`** — уже используется в проекте для UI state toggles (например `donate-section.ts`, `runner-view.ts` для footer state). Preferred API для статических state-toggles.
- **Obsidian `el.setCssProps(props)`** — нужно проверить наличие в существующем коде; если есть прецеденты — следовать им; иначе впервые ввести в codebase для D-04 runtime-geometry case. Альтернатива: `el.setCssStyles(styles)` — но тот тоже триггерит правило per eslint-plugin-obsidianmd guidance.
- **Per-feature CSS файлы в `src/styles/`** — существуют все нужные. Append-only convention уже отработана в Phase 70 (loop-support.css), Phase 71 (donate-section.css), Phase 67 (inline-runner.css).
- **Phase 64 auto-grow textarea pattern** — `runner-view.ts:1058-1067` и `editor-panel-view.ts:529-533, 655-663` — две почти идентичные реализации; обе мигрируют на одинаковый setCssProps подход. Single source of truth по custom property имени.

### Established Patterns
- **`registerDomEvent`** для DOM listeners (per CONVENTIONS.md) — не меняем при миграции; добавляем только класс/setCssProps вызов до или после.
- **CSS prefix `rp-`** для всех селекторов (per CONVENTIONS.md §CSS architecture). D-05/D-06 строго следуют.
- **`/* Phase N: description */` comment** на новых CSS-блоках per CLAUDE.md §«CSS files: append-only per phase».
- **`void` prefix** для fire-and-forget async (CONVENTIONS.md §Void-ing fire-and-forget promises) — паттерн для D-03 floating-promise fix в тесте.
- **Discriminated union exhaustiveness check** (CONVENTIONS.md §Exhaustiveness checking) — не релевантно Phase 77 напрямую, но полезно знать что пропущенный case в exhaustive-switch может произвести `no-unused-vars` для `_exhaustive: never`.

### Integration Points
- **Phase 78 CI gate** будет вызывать тот же `npm run lint`; Phase 77 lint scope (D-01/D-02) определяет surface которую CI блокирует.
- **Phase 75 (DEDUP)** будет рефакторить `src/views/runner-view.ts` и `inline-runner-modal.ts` после Phase 77 — наследует setCssProps/toggleClass подход.
- **Phase 76 (SPLIT)** будет декомпозировать `src/views/editor-panel-view.ts` после Phase 77 — наследует setCssProps подход для auto-grow helper.
- **`npm run build`** должен оставаться green после каждого коммита (D-12) — esbuild и tsc validate.
- **`npm test`** должен оставаться green после каждого коммита — vitest suite (818 tests pre-Phase-77).

</code_context>

<specifics>
## Specific Ideas

- Реальные данные `npm run lint` (на момент discuss-phase 2026-04-30):
  - **Total: 523 (517 errors + 6 warnings)**
  - По местоположению: 439 в тестах/моках, 9 в `.planning/archive/`, 75 в реальном `src/`
  - По правилу: 243 `no-unused-vars`, 191 `no-explicit-any`, 39 `no-static-styles-assignment`, 19 `obsidianmd/ui/sentence-case`, 7 `no-floating-promises`, 4 `no-this-alias`, 3 `no-tfile-tfolder-cast`, 2 `prefer-file-manager-trash-file` (warnings), и единичные `no-constant-binary-expression`, `no-control-regex`, `no-await-in-loop`, `no-var-requires`, `no-require-imports`, `ban-ts-comment`, плюс 1 unused `eslint-disable` directive.
  - **Важное расхождение с ROADMAP/REQUIREMENTS narrative:** там указано «dominant `obsidianmd/no-static-styles-assignment` violations across `src/views/`», но реальный dominant rule в total counts — `no-unused-vars` и `no-explicit-any` (почти всё в тестах). Внутри `src/` без тестов dominant rule действительно `no-static-styles-assignment` (39 of 75 src-only = 52%). Phase 77 plan и researcher должны учитывать это распределение.
- Реальный пример инлайн-стиля requiring runtime: `inline-runner-modal.ts:656` — `this.containerEl.style.left = \`${Math.round(position.left)}px\`` — Phase 60/67 persisted user position.

</specifics>

<deferred>
## Deferred Ideas

- **MEDIUM-5** (deferred from REQUIREMENTS.md): `protocol-runner.ts` (819 LOC) и `snippet-manager-view.ts` (1037 LOC) — крупные файлы. Re-evaluate после DEDUP-01 (Phase 75). Не v1.12 scope.
- **Husky migration** (deferred from REQUIREMENTS.md): Phase 78 использует hand-written hook; revisit `husky` + `lint-staged` если команда вырастет.
- **Lint-warning long-tail fixes** (deferred from REQUIREMENTS.md): targeting 6 warnings as gating bar, новые warnings surfaced after error fixes — nice-to-have, in scope только если cheap.
- **Inline runner test files** (`inline-runner-modal*.test.ts`) тестируют DOM `style.left/top` setters — после Phase 77 миграции в setCssProps эти тесты потребуют переписывания assertions на `getPropertyValue('--rp-inline-left')` или `el.classList.contains(...)`. Часть Phase 77 как ripple effect (не отдельная фаза).

### Reviewed Todos (not folded)
None — `gsd-tools list-todos` returned `count: 0`.

</deferred>

---

*Phase: 77-eslint-findings-cleanup*
*Context gathered: 2026-04-30*
