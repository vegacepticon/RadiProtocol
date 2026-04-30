# Phase 70: Loop-Exit Picker Visual Hint - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 70 даёт `+`-prefix loop-exit кнопке (`.rp-loop-exit-btn`) визуальное отличие от body-кнопок (`.rp-loop-body-btn`) во **всех 3 режимах runner'а** (sidebar `RunnerView`, tab Runner View, inline `InlineRunnerModal`) через одно CSS-правило в `src/styles/loop-support.css`. Цвет — `--color-green` (solid background) + `--text-on-accent` (text); body кнопка остаётся на `--interactive-accent` без изменений. Visual hierarchy: `body = «следующая итерация» (blue, рутина)`, `exit = «выход / завершить» (green, финиш)`. Совместимо с уже устоявшейся семантикой `--color-yellow` для `rp-loop-iteration-label` (yellow = ход, green = финиш).

DOM-инвариант (Phase 50.1 D-12 + Phase 44 D-18): класс `rp-loop-exit-btn` уже выставляется в обоих рендер-путях (sidebar `runner-view.ts:648`, inline `inline-runner-modal.ts:500`) на основании `isExitEdge(edge)` — Phase 70 ничего не меняет в TS/views.

**In scope:**
- `src/styles/loop-support.css` — append `/* Phase 70: ... */` секция в самом низу файла, переопределяющая `.rp-loop-exit-btn { background; color; }` и добавляющая `.rp-loop-exit-btn:hover { filter: brightness(0.92); }`.
- `npm run build` — регенерация `styles.css` (build-output committed по проектному стандарту).
- `.planning/phases/70-loop-exit-picker-visual-hint/70-PLAN-*.md` — 1 plan (CSS append + build + UAT runbook).

**Out of scope:**
- `src/views/runner-view.ts`, `src/views/inline-runner-modal.ts` — DOM-рендер не трогается; класс `rp-loop-exit-btn` уже на месте.
- `src/graph/node-label.ts` (`isExitEdge` / `stripExitPrefix`) — Phase 50.1 контракт, не пересекается.
- `src/styles/inline-runner.css` — НЕ трогаем; Phase 60 padding override (`inline-runner.css:226-232`) ортогонален цветовой теме и продолжает работать.
- `src/styles/runner-view.css` — НЕ трогаем; loop styling живёт в `loop-support.css` по проектному разделению.
- Body-кнопка (`.rp-loop-body-btn`) — стиль (Phase 44 lines 73-80) НЕ меняется.
- Phase 47 RUNFIX-03 typography секция (`loop-support.css:96-111`) — НЕ трогаем; padding/min-height/word-break ортогонален цвету.
- Phase 65 footer row, Phase 60/67 drag/resize state, Phase 54 Inline contract — не пересекаются.
- Configurable accent / user-setting для цвета — out-of-scope per REQUIREMENTS.md Out-of-Scope row «Visual-customisation tokens for the loop-exit highlight».
- Node Editor visual hint для `+`-prefixed edges — Phase 50.1 deferred bucket (Node Editor UX), не Phase 70.
- Computed-style тесты (JSDOM не вычисляет CSS-правила) и playwright screenshot regression — out-of-scope; UAT покрывает визуальную верификацию.
- Изменение формы / label / position кнопки — явный SC#2 ROADMAP'а запрещает.

</domain>

<decisions>
## Implementation Decisions

### Цвет / тон акцента

- **D-01 — Exit получает `--color-green`, body остаётся на `--interactive-accent`.** Семантика: «iteration = ход (blue), exit = финиш (green)». Соединяется с уже устоявшимся `--color-yellow` в `rp-loop-iteration-label` (loop-support.css:6) — все три цвета внутри loop UI разные и осмысленные. `--color-green` уже используется в проекте (`editor-panel.css:31`) — не вводит новый токен, удовлетворяет REQUIREMENTS LOOP-EXIT-01 «existing Obsidian CSS variables (no new colour tokens)».
- **D-02 — Body-кнопка стиль НЕ меняется.** Phase 44 правило `.rp-loop-body-btn { background: var(--interactive-accent); color: var(--text-on-accent); }` (loop-support.css:73-76) остаётся байт-в-байт. CLAUDE.md «append-only per phase» соблюдается — правки только в новой Phase 70 секции внизу файла.

### Тип CSS-маркера

- **D-03 — Solid background `--color-green` + `color: var(--text-on-accent)`.** Симметрично Phase 44 D-04 (`rp-loop-body-btn` использует ту же конструкцию `background + color: text-on-accent`). Solid background — самый недвусмысленный визуальный сигнал «эта кнопка отличается»; не требует ::before/icon (не меняет shape/label/position per SC#2).
- **D-04 — `--text-on-accent` для текста кнопки.** В Obsidian этот токен парный к `--interactive-accent` (белый/тёмный в зависимости от темы). Для `--color-green` парного `--text-on-color-green` не существует, но `--text-on-accent` практически даёт читаемый контраст в default light/dark Obsidian темах. Если UAT в одной из тем покажет contrast issue — план откатывается до варианта «border-left stripe» (deferred fallback в `<deferred>`).

### Hover / focus state

- **D-05 — Hover = `filter: brightness(0.92)`.** Универсальный паттерн без новых токенов; работает поверх любого background. Body-кнопка использует Phase 44 hover `--interactive-accent-hover` (есть Obsidian-токен). Для `--color-green` парного `--color-green-hover` не существует; `filter: brightness()` — стандартный fallback. Visual feedback ~8% затемнение на hover ≈ интенсивности `--interactive-accent → -hover` shift.
- **D-06 — Focus-visible не переопределяется.** Полагаемся на Obsidian default focus ring (через `:focus-visible` без нашего вмешательства). Никаких новых outline-правил не вводим.
- **D-07 — Disabled state не релевантен.** Loop picker всегда рендерит enabled кнопки (см. `runner-view.ts:647-657` и `inline-runner-modal.ts:499-505` — без `.disabled` или `.aria-disabled`). Phase 70 не добавляет `:disabled` правило.

### Поверхность изменений

- **D-08 — Один файл, одна append-секция.** Selector `.rp-loop-exit-btn` без `.rp-inline-runner-content` префикса работает во всех 3 режимах автоматически — DOM одинаков. Phase 60 inline padding override (`inline-runner.css:226-232`) ортогонален: padding/min-height не пересекаются с background/color/filter. Дублирование правил в `inline-runner.css` (вариант D отверженной зоны 4) — visual inconsistency risk + violation of «append-only per phase» semantics для нескольких файлов.
- **D-09 — `/* Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01) */` коммент над секцией.** Соответствует CLAUDE.md «CSS Architecture: добавляйте новые правила внизу файла с phase-комментарием».
- **D-10 — Build artefact regenerated.** `npm run build` после CSS правки регенерирует `styles.css` (esbuild concatenation per `esbuild.config.mjs` `CSS_FILES`). `styles.css` коммитится по проектному стандарту (manifest.json + main.js + styles.css — три loose BRAT-asset триплета).

### Test strategy

- **D-11 — Manual UAT в 3 режимах.** Прецедент Phase 47 RUNFIX-03 / Phase 60 INLINE-FIX-03 / Phase 65 RUNNER-02 — CSS-only фазы верифицируются через UAT, а не через computed-style тесты. UAT-чеклист в плане:
  1. Sidebar Runner View: открыть canvas с loop, дойти до loop picker, увидеть green exit + blue body.
  2. Tab Runner View: повторить (тот же `RunnerView` файл, разные mount points).
  3. Inline Runner: запустить через command palette, дойти до loop picker, увидеть green exit + blue body.
  4. Hover на exit-кнопке: визуальное затемнение ~8%.
  5. Focus на exit (Tab keyboard navigation): Obsidian default focus ring виден.
  6. Body-кнопка hover: без регрессии (Phase 44 поведение).
  7. Loop iteration label (yellow) + exit (green) + body (blue) — визуально 3 разных цвета без коллизий.
- **D-12 — Tripwire: existing class-presence assert уже зелёный.** В `src/__tests__/runner/protocol-runner-loop-picker.test.ts` и `src/__tests__/views/inline-runner-modal-loop-picker.test.ts` (или эквивалентных) уже проверяется что при exit edge кнопка получает класс `rp-loop-exit-btn` (Phase 50.1 D-12/D-15). Plan-phase верифицирует, что эти тесты остаются зелёными после Phase 70 — никаких новых vitest-тестов не пишем (CSS-правила в JSDOM не загружаются → нечего тестировать вне DOM-class-presence, который уже покрыт).

### Claude's Discretion

- Точная формулировка `/* Phase 70: ... */` коммента в `loop-support.css` — планнер выбирает, моделируя на Phase 44/47 комментариях.
- Порядок CSS-свойств внутри Phase 70 секции — планнер выбирает (`background` → `color` → `:hover { filter }` или иной читаемый порядок).
- UAT-сценарий выбора canvas с loop для тестирования (`unified-loop-valid.canvas` fixture или live canvas в dev vault) — планнер выбирает после прочтения dev workflow.
- Стоит ли в plan-phase явно прогнать `npm test` чтобы подтвердить D-12 (существующие class-presence тесты зелёные) — рекомендуется, но не обязательно (Phase 70 не трогает TS).
- Проверка corner-case: `hsl(var(--color-green))` синтаксис vs raw `var(--color-green)` — `loop-support.css:6` использует `color: var(--color-yellow)` напрямую (не через `hsl()`), значит токен напрямую годится для `background: var(--color-green)`. Планнер подтверждает на этапе implementation.
- Упоминать ли в commit-message Phase 50.1 как convention origin — рекомендуется ("LOOP-EXIT-01: green accent on `+`-prefix exit button per Phase 50.1 convention; affects sidebar/tab/inline").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 70 Requirements & Roadmap

- `.planning/REQUIREMENTS.md` `LOOP-EXIT-01` — целевое требование. Locked: «subtle background or accent treatment using existing Obsidian CSS variables (no new colour tokens), without changing button shape, label, or position»; «applies uniformly in all three runner modes».
- `.planning/ROADMAP.md` §Phase 70 — Goal + 4 Success Criteria. SC#1 (visible difference в picker), SC#2 (shape/label/position invariant), SC#3 (no body regression), SC#4 (3 modes coverage).
- `.planning/PROJECT.md` "Current Milestone: v1.11" §Target features — «Loop-exit picker button visual hint — `+`-prefix label gets a subtle background/accent distinct from body-branch buttons (sidebar/tab/inline)».
- `.planning/STATE.md` §"v1.11 Phase-Specific Domain Notes" — Phase 70: CSS-only, append-only, существующая `+`-prefix convention из Phase 50.1, picker rendering в `RunnerView.renderLoopPicker` и inline equivalent.

### Prior phase context (locked invariants, applicable here)

- `.planning/milestones/v1.8-phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` — `+`-prefix convention, `isExitEdge`/`stripExitPrefix` D-09/D-10, CSS class assignment D-12. Phase 70 НЕ меняет ни один из этих контрактов; только дополняет визуально.
- `.planning/milestones/v1.7-phases/44-unified-loop-runtime/44-CONTEXT.md` (если существует) — Phase 44 D-18 источник классов `.rp-loop-body-btn` / `.rp-loop-exit-btn` и базового стиля. Phase 70 D-02 явно сохраняет Phase 44 body-кнопку.
- `.planning/phases/69-inline-runner-hide-result-export-buttons-in-complete-state/69-CONTEXT.md` — параллельный phase, не пересекается (Phase 69 убирает output toolbar, Phase 70 цвет loop button). 69-02-PLAN.md строка 943 уже учитывает Phase 70 интеграцию: «`grep -c rp-loop-exit-btn src/styles/inline-runner.css` returns at least 1 ... Phase 70 will add a rule on this; Phase 69 leaves it intact» — но это устаревшая запись из 69-плана; Phase 70 D-08 решает класть правило в `loop-support.css`, не в `inline-runner.css`. План Phase 70 явно перенаправляет.

### Existing code touched

- `src/styles/loop-support.css` — append `/* Phase 70: ... */` секция в самом низу файла после строки 111. Существующие Phase 6 / Phase 44 / Phase 47 секции — НЕ трогаем (CLAUDE.md append-only).
- `styles.css` (root) — generated by `npm run build` (esbuild concatenates `CSS_FILES` per `esbuild.config.mjs`); commit как build artefact.

### Existing code NOT touched (cross-mode invariants)

- `src/views/runner-view.ts:629-657` — sidebar loop picker render (class assignment line 648 `cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn'`). НЕ трогаем.
- `src/views/inline-runner-modal.ts:488-506` — inline loop picker render (class assignment line 500). НЕ трогаем.
- `src/graph/node-label.ts:79` `isExitEdge`, `:99` `stripExitPrefix` — Phase 50.1 D-09/D-10. НЕ трогаем.
- `src/runner/protocol-runner.ts:245` `chooseLoopBranch` (использует `isExitEdge`). НЕ трогаем.
- `src/styles/loop-support.css:1-111` — Phase 6 / 44 / 47 секции. НЕ трогаем (Phase 44 D-04 body styling — D-02 явно сохраняет; Phase 47 typography — ортогональна цвету).
- `src/styles/inline-runner.css:226-232` — Phase 60 inline padding/min-height override для обоих loop-классов. НЕ трогаем (ортогонален цвету).
- `src/styles/runner-view.css` — sidebar layout, не loop UI. НЕ трогаем.

### Test surface

- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — Phase 50.1 D-15 + Phase 44 RUN-01 регрессии: при `+`-prefix edge кнопка получает класс `rp-loop-exit-btn`, при non-`+` — `rp-loop-body-btn`. Phase 70 верифицирует что эти тесты остаются зелёными (D-12); новых assertions не добавляем.
- `src/__tests__/views/runner-view-loop-picker.test.ts` или эквивалентный (если существует) — sidebar regression. Plan-phase локализует точное имя.
- `src/__tests__/views/inline-runner-modal*.test.ts` — inline regression на DOM-class. Plan-phase локализует.
- `src/__tests__/graph/node-label.test.ts:127-180` — `isExitEdge` / `stripExitPrefix` D-15 регрессия (Phase 50.1). НЕ трогаем; зелёный.

### Project guardrails

- `CLAUDE.md` "CSS Architecture" — Phase 70 добавляет новое правило внизу `loop-support.css` с phase-комментарием. Никаких новых файлов в `src/styles/` (нет новой feature) — добавление в `CSS_FILES` array не требуется.
- `CLAUDE.md` "Critical Rules for Editing Shared Files" — Phase 70 НЕ удаляет ничего; только append. CLAUDE.md exception (как в Phase 67 D-14 / Phase 69 D-05) НЕ нужен.
- `CLAUDE.md` "After any CSS change" — `npm run build` для регенерации `styles.css`; commit и `styles.css`, и `loop-support.css` атомарно.
- `.planning/STATE.md` Standing Pitfalls #7 (CSS append-only — D-09 явно соблюдает), #8 (только phase-relevant код в shared files — Phase 70 трогает только новую секцию).

### User memory

- `memory/feedback_language.md` — discuss-phase ведётся на русском; CONTEXT.md остаётся гибридным (русские объяснения + английские code/cite — как в Phase 69 CONTEXT).
- `memory/project_snippet_node_ux.md` — не пересекается с Phase 70.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Класс `.rp-loop-exit-btn`** уже на DOM-кнопке во всех 3 режимах (sidebar `runner-view.ts:648`, inline `inline-runner-modal.ts:500`). Phase 70 переопределяет визуал на этом готовом hook'е — TS/views не трогаются.
- **Phase 44 body-кнопка как симметричный шаблон** (`loop-support.css:73-80`):
  ```css
  .rp-loop-body-btn { background: var(--interactive-accent); color: var(--text-on-accent); }
  .rp-loop-body-btn:hover { background: var(--interactive-accent-hover); }
  ```
  Phase 70 строит exit-кнопку по той же конструкции, заменяя token: `--color-green` вместо `--interactive-accent` + `filter: brightness(0.92)` вместо `--color-green-hover` (которого нет).
- **`--color-green` уже используется** в `editor-panel.css:31` — verified Obsidian theme token, не вводит новый.
- **`--color-yellow` precedent** в `loop-support.css:6` (Phase 44 iteration label) — подтверждает что raw `var(--color-*)` без `hsl(...)` обёртки работает в проекте.
- **Phase 50.1 `+`-prefix convention** — DOM уже знает который edge exit-edge через `isExitEdge(edge)`. Phase 70 не вводит новой логики discrimination.

### Established Patterns

- **CSS append-only per phase** (`CLAUDE.md`): Phase 70 пишет `/* Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01) */` секцию внизу `loop-support.css`. Существующие Phase 6/44/47 секции байт-в-байт сохранены.
- **Single rule covers 3 runner modes**: selector `.rp-loop-exit-btn` без mode-specific префикса автоматически работает в sidebar/tab/inline — DOM-структура одна и та же. Inline padding override (Phase 60) ортогонален.
- **Build artefact commits** (CLAUDE.md «After any CSS change»): `npm run build` регенерирует `styles.css`; коммит включает обе диффы (`src/styles/loop-support.css` + `styles.css`).
- **Manual UAT для CSS-only фаз**: прецедент Phase 47 RUNFIX-03, Phase 60 INLINE-FIX-03, Phase 65 RUNNER-02 — CSS правила не тестируются computed-style assertions (JSDOM не загружает CSS); UAT в 3 режимах вручную (D-11).
- **`--text-on-accent` поверх non-`--interactive-accent` background** — pragmatic re-use Obsidian token (нет парного `--text-on-color-green`); работает в default light/dark themes; UAT покрывает risk проверкой контраста (D-04).

### Integration Points

- **Один CSS-файл, одна секция**: `src/styles/loop-support.css` line 112+ (append после Phase 47 секции). Plan-phase точно локализует insertion point.
- **`npm run build` artefact**: `styles.css` (root) обновляется автоматически esbuild plugin'ом из `esbuild.config.mjs`. Plan-phase явно включает `npm run build` в task list, чтобы build-output попал в commit.
- **Существующие class-presence regression tests** (Phase 50.1 D-12/D-15 в `node-label.test.ts` + sibling tests в `protocol-runner-loop-picker.test.ts`) — Phase 70 не добавляет новых тестов, только верифицирует что существующие зелёные после CSS-only изменения (D-12).
- **Phase 69 параллельность**: Phase 69 (Inline output toolbar removal) и Phase 70 (Loop exit color) не пересекаются по файлам и могут идти параллельно. Phase 69 plan 02 line 943 устаревший hint — Phase 70 D-08 явно перенаправляет правило в `loop-support.css`, не `inline-runner.css`.

</code_context>

<specifics>
## Specific Ideas

- **Цветовая семантика loop UI**: yellow для iteration label (Phase 44), blue для body branch (Phase 44), green для exit (Phase 70) — три осмысленных цвета, не пересекающиеся друг с другом. Visual rhythm: «yellow ход → blue выбор → green финиш».
- **«Inverted hierarchy» — отвергнут.** Один из 4 вариантов в зоне 1 был «exit получает `--interactive-accent`, body становится muted gray». Отвергнут пользователем в пользу зелёного: blue остаётся primary action для самой частой операции (продолжение iteration), exit получает дифференцирующий зелёный — НЕ за счёт body.
- **`--text-on-accent` как pragmatic выбор.** Парного `--text-on-color-green` в Obsidian нет — `--text-on-accent` (белый/тёмный по теме) работает на green в default Obsidian темах. Если custom theme сломает контраст — UAT поймает; fallback — Border-left stripe variant из зоны 2 deferred bucket.
- **`filter: brightness(0.92)` стандартный CSS-fallback** для отсутствующего `--color-green-hover`. Совместим с любой темой (применяется к computed pixel value background'а), не требует препроцессинга, не ломает Obsidian theme overrides.
- **`+`-prefix label stripped before display.** `stripExitPrefix(edge.label)` (Phase 50.1 D-09) убирает `+` — пользователь видит чистое «выход», но визуальный hint Phase 70 (зелёный фон) делает кнопку recognizable без `+` glyph'а в label'е.

</specifics>

<deferred>
## Deferred Ideas

- **Border-left stripe вариант** (зона 2 option B) — отвергнут в пользу solid green, но остаётся как fallback если UAT в одной из тем покажет text-contrast issue с `--color-green` + `--text-on-accent`. План откатывается до: `border-left: 3px solid var(--color-green); background: var(--background-modifier-border); color: var(--text-normal);` — визуальный сигнал без риска контраста. Кандидат на ad-hoc fallback внутри Phase 70 если UAT провалится, не на отдельную фазу.
- **Configurable accent token (user setting)** — REQUIREMENTS Out-of-Scope row «Visual-customisation tokens for the loop-exit highlight». Пользователь может в будущем захотеть выбрать `yellow` / `green` / `red` через Settings tab; v1.11 этого не делает.
- **Visual hint в Node Editor для `+`-prefixed edges** — Phase 50.1 deferred bucket («Node Editor visual hint for `+`-prefixed edges. Rendering exit edges with a distinct colour/icon in the loop-node form»). Phase 70 — runtime/runner picker only; авторская визуализация в Node Editor — отдельная будущая фаза.
- **Animation / transition на color change** — out-of-scope (REQUIREMENTS «subtle ... without changing shape/label/position»; transition на background не запрещён буквой, но добавляет complexity без UX-выигрыша; deferred до явного UAT-feedback'а).
- **Keyboard-navigation focus enhancement** (например, custom outline-color для focus-visible на exit button) — Phase 70 D-06 полагается на Obsidian default. Если accessibility audit покажет проблему — отдельная phase для всего runner UI focus polish.
- **Multi-exit visual differentiation** — Phase 50.1 D-01 lock'ит ровно 1 exit edge на loop. Если будущая фаза релаксирует до ≥1 exit edges, Phase 70 визуал может потребовать differentiation между несколькими exit'ами. Не v1.11.

### Reviewed Todos (not folded)

None — `gsd-sdk query todo.match-phase 70` вернул `todo_count = 0` / пустой `matches` array.

</deferred>

---

*Phase: 70-loop-exit-picker-visual-hint*
*Context gathered: 2026-04-29*
