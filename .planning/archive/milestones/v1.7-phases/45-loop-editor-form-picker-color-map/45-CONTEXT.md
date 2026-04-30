# Phase 45: Loop Editor Form, Picker & Color Map - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Финализировать authoring-UX для unified `loop` узла: (1) зафиксировать форму Node Editor тестами и добавить quick-create кнопку, (2) починить `NodePickerModal` (Start-From-Node) чтобы он включал loop + остальные start-worthy kinds, (3) подключить picker к команде в Obsidian command palette, (4) проверить что `NODE_COLOR_MAP['loop']` покраска уже работает end-to-end.

**In scope:**
- `src/views/editor-panel-view.ts` — quick-create кнопка «Create loop node» в тулбаре (`renderToolbar()`); расширение `onQuickCreate` kind-union до `'question' | 'answer' | 'snippet' | 'loop'`.
- `src/views/node-picker-modal.ts` — `buildNodeOptions()` расширяется на 4 kinds (question, text-block, snippet, loop); `NodeOption.kind` union расширяется; `renderSuggestion` рендерит русские kind-badge'и; сортировка меняется на kind-groups entry-order.
- `src/canvas/canvas-node-factory.ts` — поддержка `kind: 'loop'` в `createNode()` (injection `radiprotocol_nodeType='loop'` + color `'1'` + optional `radiprotocol_headerText=''` stub).
- `src/main.ts` — регистрация новой команды `{ id: 'start-from-node', name: 'Start from specific node' }`, которая открывает `NodePickerModal` над активным канвасом и стартует RunnerView с выбранного узла.
- `src/__tests__/editor-panel-loop-form.test.ts` (новый) — lock-in тесты на loop-форму (headerText edit, отсутствие maxIterations, color injection при save).
- `src/__tests__/node-picker-modal.test.ts` (новый или расширение существующего) — тесты на `buildNodeOptions()` для всех 4 kinds + label/sort rules.
- `src/__tests__/runner-commands.test.ts` — расширение существующего теста на новую команду.
- CSS: `src/styles/editor-panel.css` — стиль loop quick-create кнопки (per-feature CSS rule, AGENTS CLAUDE.md CSS Architecture).

**NOT in scope (будущие фазы / out of v1.7):**
- Удаление legacy `loop-start`/`loop-end` из RPNodeKind, parser, validator, editor-panel fallback формы — остаются до тех пор, пока есть legacy-канвасы в проде (Phase 43 D-03 решил).
- Замена ItemView Node Editor на modal или rethink UX — out of scope v1.7.
- Free-text-input excision — Phase 46 (CLEAN-01..04).
- Автомиграция legacy loop-start/loop-end канвасов в unified loop — out-of-scope v1.7 (REQUIREMENTS.md Out of Scope).
- Wiring `start-from-node` команды к hotkey или ribbon icon — пользователь вызывает через Ctrl+P. Hotkey-назначение оставляем на усмотрение пользователя через Obsidian Settings → Hotkeys.

</domain>

<decisions>
## Implementation Decisions

### LOOP-05 — Loop Editor Form

- **D-01:** Форма loop-узла (`editor-panel-view.ts:568-586`) уже добавлена Phase 44 UAT-fix'ом (commit `cd98df3`). Phase 45 её **НЕ переписывает** — только фиксирует тестами. Текущее поведение (textarea для `headerText` + синхронизация `radiprotocol_headerText` ↔ `text`) — правильное, не трогаем.
- **D-02:** Lock-in unit-тесты на loop-форму в новом файле `src/__tests__/editor-panel-loop-form.test.ts`. Тест-кейсы:
  - Dropdown содержит option `'loop'` с label `'Loop'`.
  - Выбор kind='loop' рендерит heading "Loop node" + ровно одно Setting с name "Header text".
  - Форма **НЕ содержит** Setting со словом "iterations" / "maxIterations" (отрицательный тест — защита от regressions).
  - `onChange` в textarea ставит оба `pendingEdits['radiprotocol_headerText']` и `pendingEdits['text']` в одно значение.
  - `saveNodeEdits` при kind='loop' инжектит `color: '1'` (через `NODE_COLOR_MAP['loop']` lookup в D-03 existing pipeline).
- **D-03:** Quick-create кнопка «Create loop node» в тулбаре Node Editor (`renderToolbar()`). Позиционирование: **после** Snippet-кнопки, **перед** Duplicate-кнопкой (логическая группа: create-buttons вместе, duplicate — особая). Иконка: `setIcon(icon, 'repeat')` или `'repeat-1'` — Claude's Discretion, любая loop-подобная Lucide иконка. CSS-класс: `rp-create-loop-btn` (параллельно существующим `rp-create-question-btn`, `rp-create-answer-btn`, `rp-create-snippet-btn`).
- **D-04:** `onQuickCreate` kind-union расширяется: `'question' | 'answer' | 'snippet'` → `'question' | 'answer' | 'snippet' | 'loop'`. Реализация — zero-delta: существующая `canvasNodeFactory.createNode(canvasPath, kind, sourceNodeId)` уже принимает `RPNodeKind` — просто новая kind-ветвь пойдёт через ту же pipeline. Но `CanvasNodeFactory` сам сейчас может не поддерживать `'loop'` — planner должен проверить и добавить при необходимости (D-05).
- **D-05:** `src/canvas/canvas-node-factory.ts` должен уметь создавать loop-узел: injection `radiprotocol_nodeType: 'loop'`, `color: '1'`, начальный `radiprotocol_headerText: ''` (пустая строка — нормализация D-05 из Phase 43). Planner проверит текущий createNode switch и добавит loop-case если его нет. Каноническая позиция нового узла — стандартная (reuse существующей offset-логики Phase 38).

### LOOP-06 — NodePickerModal

- **D-06:** `buildNodeOptions()` расширяется на **4 kinds**: question, text-block, snippet, loop. **Answer НЕ включается** — rationale: answer-узлы в runner'е рендерятся как кнопки под question-узлом, они не самостоятельные точки старта. ROADMAP SC #3 буквально называет answer, но UX-семантически это некорректно; в CONTEXT фиксируем отклонение как осознанное решение. Если понадобится в будущем — легко добавить одну ветку в switch.
- **D-07:** Label pattern per kind — **text-филд \|\| node.id fallback** (никогда не пустой label):
  - `question` → `questionText || id`
  - `text-block` → `content.slice(0, 60) || id`
  - `snippet` → `subfolderPath || '(корень snippets)' || id` (snippet может иметь subfolderPath=undefined — тогда fallback "(корень snippets)")
  - `loop` → `headerText || id`
  - Id fallback гарантирует что любой RP-узел показывается в picker'е даже если author забыл текст.
- **D-08:** Sort order — **kind-groups в entry-order**: `question → loop → text-block → snippet`. Внутри каждой группы — alphabetical по `label.toLowerCase()` через `localeCompare`. Rationale: question = самая частая точка старта для радиолога; loop = вторая по частоте (локальные повторяющиеся блоки — lesion, лимфоузлы); text-block и snippet реже, но валидны. Сохраняет v1.0 поведение «questions first».
- **D-09:** `NodeOption.kind` literal union расширяется: `'question' | 'text-block'` → `'question' | 'text-block' | 'snippet' | 'loop'`.
- **D-10:** Kind-badge в `renderSuggestion` — **русские ярлыки** через локальный map:
  ```typescript
  const KIND_LABELS: Record<NodeOption['kind'], string> = {
    'question': 'Вопрос',
    'text-block': 'Текст',
    'snippet': 'Сниппет',
    'loop': 'Цикл',
  };
  ```
  Map объявляется как `const` в `node-picker-modal.ts`. Rationale: остальной runner UI уже говорит на русском (метка «выход», миграционные ошибки, runner picker). Consistency > экономия 4 строк.
- **D-11:** `NodePickerModal` SuggestModal `setPlaceholder` остаётся английским ('Search nodes by label…') — это Obsidian-native placeholder, не проектный текст. Если пользователь захочет локализовать — это отдельная i18n-фаза.

### Command Wiring (LOOP-06 — dead code resolution)

- **D-12:** В `src/main.ts` в `onload()` добавляется `this.addCommand({ id: 'start-from-node', name: 'Start from specific node', callback: () => {...} })`. ID без плагин-префикса (convention NFR-06 из PROJECT.md).
- **D-13:** Callback реализация (псевдокод, уточняется planner'ом):
  1. Найти активный canvas leaf (тот же pattern что `editor-panel-view.ts:55-57` — `getLeavesOfType('canvas')` ∩ `getMostRecentLeaf()`).
  2. Если canvas не открыт — `new Notice('Open a canvas first.')`.
  3. Прочитать canvas file через `vault.read()`, распарсить через `CanvasParser`.
  4. Если parse fails или validator видит ошибки — `new Notice(...)` с первой ошибкой.
  5. `buildNodeOptions(graph)` → `new NodePickerModal(app, options, async (opt) => { await runnerView.openCanvas(canvasPath, opt.id); }).open()`.
- **D-14:** `RunnerView.openCanvas(canvasPath, startNodeId?)` — planner проверит существующую сигнатуру. В v1.0 RUN-10 дизайне был optional параметр. Если его нет — planner либо добавляет второй параметр (backward compatible), либо использует существующий «Start from node» pathway если он уже в runner'е.
- **D-15:** Перед открытием picker'а — **проверка что RunnerView leaf существует или активируется**. Переиспользовать `plugin.activateRunnerView()` (существует в main.ts).

### NODE_COLOR_MAP (LOOP-06 color part)

- **D-16:** `NODE_COLOR_MAP['loop'] = '1'` **уже существует** (Phase 43 D-12, commit проверен в `src/canvas/node-color-map.ts:21`). Phase 45 **не изменяет** `node-color-map.ts`.
- **D-17:** End-to-end покраска канвасного loop-узла уже работает через `editor-panel-view.ts:saveNodeEdits()` pipeline (Phase 28 D-01 injection). Phase 45 добавляет один integration-тест на это в `editor-panel-loop-form.test.ts` (D-02 last case).

### Tests

- **D-18:** Тест-файл `src/__tests__/editor-panel-loop-form.test.ts` — unit, vitest, JSDom. Мокировать Obsidian API (pattern существует в других тестах editor-panel'а, planner найдёт).
- **D-19:** Тест-файл `src/__tests__/node-picker-modal.test.ts` — unit, vitest. Тесты:
  - `buildNodeOptions` с mixed graph (все 4 kinds + answer + start + legacy loop-start) → возвращает ровно 4 kind'а + answer/start/legacy исключены.
  - Label pattern: loop узел без headerText → label === node.id. Loop с headerText → label === headerText.
  - Sort: question > loop > text-block > snippet; внутри — alphabetical.
  - KIND_LABELS: exhaustive — все 4 kinds покрыты.
- **D-20:** `src/__tests__/runner-commands.test.ts` — расширить существующий RED-тест (`RUN-10: node-picker-modal exports NodePickerModal`) на более сильную проверку: импорт `buildNodeOptions` + вызов с mock graph + проверка loop option. Текущий тест остаётся как smoke-test.

### Claude's Discretion

- **D-CL-01:** Точное имя Lucide-иконки для quick-create loop кнопки (`repeat`, `repeat-1`, `rotate-cw`, `infinity` — на выбор planner'а). Предпочтение — что-то узнаваемо-loop-семантическое.
- **D-CL-02:** Имя CSS-класса loop кнопки (`rp-create-loop-btn` предложено, но planner может выбрать другое имя если это противоречит naming convention).
- **D-CL-03:** Если `CanvasNodeFactory.createNode` уже поддерживает все kinds через общий pipeline (без switch per-kind) — D-05 становится zero-delta. Planner проверяет и решает.
- **D-CL-04:** Точная формулировка notice'ов при ошибках открытия picker'а (no canvas / parse error / validator error) — на русском или английском, finalize при реализации. Предпочтение — консистентность с существующими notice'ами в main.ts (сейчас они в основном английские).
- **D-CL-05:** Позиция fallback "(корень snippets)" для snippet-узла без subfolderPath в D-07 label — можно заменить на просто `id` (если null → id) или другую короткую строку. Главное: label непустой.
- **D-CL-06:** В `start-from-node` callback — если canvas содержит legacy loop-start/loop-end узлы, validator вернёт MIGRATE-01 ошибку. Делаем ли exception для случая когда выбранный startNode не loop-узел? Ожидаемое поведение: любая validator ошибка блокирует старт (consistent с RunnerView main flow). Planner решит финальный UX.

### Folded Todos

Ни один pending-todo не попадает в scope Phase 45 (проверено: audit-dead-code.md, create-folder-button-snippet-editor.md, fix-snippet-modal-spacing.md, sync-node-path-on-directory-rename.md, duplicate-node.md, quick-node-creation.md — все про другие подсистемы).

</decisions>

<canonical_refs>
## Canonical References

**Downstream агенты (researcher, planner) ОБЯЗАНЫ прочесть перед работой.**

### v1.7 Design Authority
- `.planning/ROADMAP.md` — Phase 45 goal, dependencies, success criteria (строки 135-142)
- `.planning/REQUIREMENTS.md` — LOOP-05, LOOP-06 полный текст (строки 13-14); Out of Scope для v1.7
- `.planning/PROJECT.md` — Key Decisions: break-compat, discriminated union on `kind`, `radiprotocol_*` namespace, NFR-06 (no plugin-name prefix in command IDs)
- `.planning/STATE.md` — v1.7 Design Decisions (locked during `/gsd-explore`)

### Prior Phase Context
- `.planning/phases/43-unified-loop-graph-model-parser-validator-migration-errors/43-CONTEXT.md` — D-01 (RPNodeKind unified), D-02 (LoopNode shape), D-12 (NODE_COLOR_MAP['loop']='1'), D-CL-05 (legacy kinds retained)
- `.planning/phases/44-unified-loop-runtime/44-HUMAN-UAT.md` — Phase 44 UAT-fix commits cd98df3 (editor-panel dropdown) и 961d968 (dead-end return) — объясняют текущее состояние loop-формы
- `.planning/phases/44-unified-loop-runtime/44-VERIFICATION.md` — RUN-07 maxIterations excision (чтобы понять что настроено в settings.ts)

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — модульный layout, «New Node Type» checklist
- `.planning/codebase/CONVENTIONS.md` — code style, naming patterns
- `.planning/codebase/CONCERNS.md` — risks / tech debt (особенно про canvas-internal.d.ts и async save cycle)

### Source — модификации в Phase 45
- `src/views/editor-panel-view.ts:345` — dropdown, уже добавлен Phase 44 UAT-fix
- `src/views/editor-panel-view.ts:568-586` — существующая loop-форма (Phase 44 UAT-fix, НЕ переписывать)
- `src/views/editor-panel-view.ts:745-784` — `onQuickCreate`, расширение union type до 'loop'
- `src/views/editor-panel-view.ts:852-883` — `renderToolbar`, добавление loop-кнопки
- `src/views/node-picker-modal.ts` — файл целиком, расширение `buildNodeOptions` + `NodeOption.kind` + `renderSuggestion`
- `src/canvas/canvas-node-factory.ts` — поддержка kind='loop' в createNode
- `src/canvas/node-color-map.ts:21` — **reference-only**, не изменяется (Phase 43 D-12)
- `src/main.ts:45-81` — существующие addCommand блоки как pattern для нового `start-from-node`
- `src/main.ts` RunnerView activation — `activateRunnerView`, `openEditorPanelForNode` как pattern для `startFromNode`
- `src/views/runner-view.ts` — `openCanvas(canvasPath, startNodeId?)` — planner проверит сигнатуру

### CSS
- `src/styles/editor-panel.css` — per-feature CSS (AGENTS CLAUDE.md CSS Architecture). Новое правило для `.rp-create-loop-btn` добавляется **в конец файла** с комментарием `/* Phase 45: loop quick-create button */`.
- `esbuild.config.mjs` — `CSS_FILES` список, убедиться что `editor-panel.css` в нём (уже должен быть).

### Graph Model (reference-only)
- `src/graph/graph-model.ts:9-18` — RPNodeKind union (не меняется)
- `src/graph/graph-model.ts:67-70` — LoopNode shape (не меняется)

### Fixtures and Tests
- `src/__tests__/fixtures/unified-loop-valid.canvas` — существующий valid loop fixture (Phase 43 D-17)
- `src/__tests__/runner-commands.test.ts` — существующий RUN-10 тест (расширение в D-20)
- Новые: `src/__tests__/editor-panel-loop-form.test.ts` (D-02), `src/__tests__/node-picker-modal.test.ts` (D-19)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`renderToolbar()` pattern** (`editor-panel-view.ts:852-883`) — existing quick-create buttons для question/answer/snippet. Каждая кнопка: `createEl('button', { cls: 'rp-create-X-btn' })` → `setIcon(span, 'lucide-name')` → `appendText(label)` → `registerDomEvent(btn, 'click', handler)`. Loop-кнопка — один новый блок по тому же шаблону.
- **`onQuickCreate(kind)` pattern** (`editor-panel-view.ts:745-784`) — уже умеет flush pending save, вызывать factory, rerender форму. Расширение union type до 'loop' — zero logic change.
- **`NODE_COLOR_MAP` Record type** (`node-color-map.ts`) — строгая Record<RPNodeKind, string> форсит завершённость. Loop уже в ней. Если planner добавляет новые kinds в factory — color автоматически доступен.
- **`buildNodeOptions` skeleton** (`node-picker-modal.ts:17-38`) — существующий pattern для question+text-block. Добавление 2 новых kinds — 2 if-ветки + 1 sort-key.
- **`renderSuggestion` pattern** (`node-picker-modal.ts:67-70`) — `createEl('div', {text})` + `createEl('small', {text, cls})`. KIND_LABELS map подменяет второй text.
- **`addCommand` pattern** (`main.ts:46-81`) — существующие команды `run-protocol`, `open-snippet-manager`, `open-node-editor` — все без id-префикса (NFR-06).
- **`getMostRecentLeaf` ∩ `getLeavesOfType('canvas')`** (`editor-panel-view.ts:55-57`) — уже используется для поиска активного canvas leaf в editor-panel. Переиспользовать в `start-from-node` callback.

### Established Patterns

- **Zero-Obsidian-imports в graph/runner/canvas** — для `node-picker-modal.ts` НЕ применимо (SuggestModal extend требует obsidian import). Это view-layer, допустимо.
- **Русский в user-facing строках** — Phase 43 D-07 (migration error), Phase 44 picker labels («выход»). KIND_LABELS map продолжает эту линию.
- **Per-phase CSS comment markers** — `/* Phase N: description */` в CSS-файлах. Loop-кнопка CSS получит `/* Phase 45: loop quick-create button */`.
- **Lock-in тесты после UAT-fix** — паттерн формализации: Phase 43 добавил 20 тестов, Phase 44 — 7 session-roundtrip. Phase 45 LOOP-05 следует той же линии: фиксируем behavior тестами, не переписываем код.

### Integration Points

- `editor-panel-view.ts` → `canvas-node-factory.ts` (loop quick-create) — может потребоваться расширить factory.
- `main.ts` → `node-picker-modal.ts` + `canvas-parser.ts` + `runner-view.ts` — цепочка нового `start-from-node` callback.
- `NODE_COLOR_MAP` → editor-panel `saveNodeEdits` pipeline — уже работает end-to-end для loop (Phase 28 + Phase 43 D-12), Phase 45 только добавляет integration-тест.

</code_context>

<specifics>
## Specific Ideas

- Пользователь явно выбрал **русские kind-badges** (Вопрос/Текст/Сниппет/Цикл) в NodePickerModal — consistency с остальным runner UI, а не минимализм.
- Picker order (question → loop → text-block → snippet) отражает **реальную частоту** запуска у радиолога: протоколы обычно стартуют с главного вопроса; loop-узлы — для повторяющихся lesion-блоков; text-block/snippet — редко.
- Answer-узлы **сознательно исключены** из picker'а несмотря на буквальное чтение ROADMAP SC #3 — UX-семантически answer не самостоятельная точка старта (он появляется как кнопка под question). Решение задокументировано как осознанное отклонение.
- Phase 45 **не переписывает** loop-форму из Phase 44 UAT-fix — только фиксирует её тестами. Это важно: UAT-fix был корректным, regression-risk минимальный.

</specifics>

<deferred>
## Deferred Ideas

- **«Convert to unified loop» кнопка** для legacy loop-start/loop-end форм — интересно, но это автомиграция, explicitly out-of-scope v1.7 (REQUIREMENTS.md → Out of Scope → «Automatic migration of existing loop-start/loop-end pairs»). Не добавляем.
- **Placeholder/подсказка про метку «выход»** в loop-форме — полезно для authoring UX, но отложено; валидатор уже даёт ясную ошибку если edge метки некорректные (Phase 43 D-08). Если будут UAT-жалобы — добавим в следующий милестон.
- **Answer-узлы в picker'е** — отклонены из scope Phase 45. Если выяснится use-case — одна ветка в switch. Капчурим как backlog idea.
- **Hotkey назначение команде `start-from-node`** — пользователь может назначить через Obsidian Settings → Hotkeys. Не хардкодим.
- **i18n `setPlaceholder` и других Obsidian-native строк в picker'е** — отдельная будущая фаза.

</deferred>

---

*Phase: 45-loop-editor-form-picker-color-map*
*Context gathered: 2026-04-18*
