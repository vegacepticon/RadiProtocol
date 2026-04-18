# Phase 45: Loop Editor Form, Picker & Color Map — Research

**Researched:** 2026-04-18
**Domain:** Obsidian plugin UI (Node Editor ItemView + SuggestModal picker) + TypeScript discriminated-union integration
**Confidence:** HIGH — весь анализ на локальной кодовой базе; внешние библиотеки не добавляются; только Obsidian-native API и уже используемые внутренние сервисы. `[VERIFIED: codebase grep + чтение файлов]` на каждом утверждении ниже.

---

## Summary

Phase 45 — **интеграционная «сшивка» UX вокруг уже готового loop-runtime**. Вся фундаментальная работа сделана:

- Графовая модель знает `kind:'loop'` (Phase 43).
- Парсер нормализует `radiprotocol_headerText` (Phase 43).
- Validator принимает loop-канвасы с «выход» и отклоняет legacy-пару (Phase 43).
- Runtime halts в `awaiting-loop-pick`, умеет back-edge re-entry, dead-end return, nested frames, step-back, session round-trip (Phase 44).
- Editor-panel уже имеет `case 'loop'` форму + option `'loop'` в dropdown (Phase 44 UAT-fix commit `cd98df3`).
- `NODE_COLOR_MAP['loop'] = '1'` уже в map'е (Phase 43 D-12, `src/canvas/node-color-map.ts:21`). `[VERIFIED: read]`

**Что реально делает Phase 45 (≈ 7 небольших изменений + 2 новых test-файла):**

1. Добавить 4-ю quick-create кнопку «Create loop node» в `renderToolbar()` — зеркало существующих question/answer/snippet кнопок.
2. Расширить `onQuickCreate` kind-union с `'question'|'answer'|'snippet'` до `+'loop'`.
3. Переписать `node-picker-modal.ts` — `NodeOption.kind` union до 4 kinds, `buildNodeOptions` на 4 ветки + entry-order sort, русские KIND_LABELS в `renderSuggestion`.
4. Зарегистрировать команду `start-from-node` в `main.ts` (сейчас `NodePickerModal` — мёртвый код, импортируется только тестом).
5. Расширить `RunnerView.openCanvas(filePath)` до `openCanvas(filePath, startNodeId?)` — **сейчас параметра нет**, см. §1.4.
6. Fix-up `ProtocolRunner.start(graph)` — **сейчас** начинает с `graph.startNodeId`, см. §1.4.
7. CSS `.rp-create-loop-btn` append-only в `src/styles/editor-panel.css`.
8. Lock-in тесты loop-формы + тесты picker'а.

**Primary recommendation:** Планировщик формирует 4 волны: (a) NodePickerModal rewrite + тесты, (b) Editor-panel loop-button + lock-in тесты формы, (c) start-from-node command wiring в main.ts (требует добавить optional параметр в `openCanvas` + `ProtocolRunner.start`), (d) CSS append + build. Все волны независимы кроме (c), которая зависит от (a).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

> Копия verbatim секции `<decisions>` из `45-CONTEXT.md`. Planner **обязан** сохранять семантику D-01..D-20 и Claude's Discretion D-CL-01..D-CL-06.

**LOOP-05 — Loop Editor Form**

- **D-01:** Форма loop-узла (`editor-panel-view.ts:568-586`) уже добавлена Phase 44 UAT-fix'ом (commit `cd98df3`). Phase 45 её **НЕ переписывает** — только фиксирует тестами. Текущее поведение (textarea для `headerText` + синхронизация `radiprotocol_headerText` ↔ `text`) — правильное, не трогаем.
- **D-02:** Lock-in unit-тесты на loop-форму в новом файле `src/__tests__/editor-panel-loop-form.test.ts`. Кейсы:
  - Dropdown содержит option `'loop'` с label `'Loop'`.
  - Выбор kind='loop' рендерит heading "Loop node" + ровно одно Setting с name "Header text".
  - Форма **НЕ содержит** Setting со словом "iterations" / "maxIterations" (негативный тест — защита от regressions).
  - `onChange` в textarea ставит оба `pendingEdits['radiprotocol_headerText']` и `pendingEdits['text']` в одно значение.
  - `saveNodeEdits` при kind='loop' инжектит `color: '1'` (через `NODE_COLOR_MAP['loop']` lookup).
- **D-03:** Quick-create кнопка «Create loop node» в тулбаре. Позиционирование: **после** Snippet-кнопки, **перед** Duplicate-кнопкой. Иконка — D-CL-01 (`repeat` / `repeat-1` / `rotate-cw` / `infinity`). CSS-класс: `rp-create-loop-btn`.
- **D-04:** `onQuickCreate` kind-union расширяется: `'question' | 'answer' | 'snippet'` → `'question' | 'answer' | 'snippet' | 'loop'`. Zero-delta — factory уже принимает `RPNodeKind`.
- **D-05:** `src/canvas/canvas-node-factory.ts` — injection `radiprotocol_nodeType: 'loop'`, `color: '1'`, начальный `radiprotocol_headerText: ''`. **Проверено в §2.3 — factory kind-agnostic, отдельной ветки не нужно**; headerText-stub опционален (парсер нормализует отсутствующий header в `''`).

**LOOP-06 — NodePickerModal**

- **D-06:** `buildNodeOptions()` расширяется на **4 kinds**: question, text-block, snippet, loop. **Answer НЕ включается** (осознанное отклонение от ROADMAP SC #3 — answer рендерится как кнопка под question, не самостоятельная точка старта).
- **D-07:** Label pattern per kind — **text-филд || node.id fallback**:
  - `question` → `questionText || id`
  - `text-block` → `content.slice(0, 60) || id`
  - `snippet` → `subfolderPath || '(корень snippets)' || id`
  - `loop` → `headerText || id`
- **D-08:** Sort order — **kind-groups в entry-order**: `question → loop → text-block → snippet`. Внутри — alphabetical по `label.toLowerCase()` через `localeCompare`.
- **D-09:** `NodeOption.kind` literal union расширяется: `'question' | 'text-block'` → `'question' | 'text-block' | 'snippet' | 'loop'`.
- **D-10:** Kind-badge в `renderSuggestion` — **русские ярлыки** через локальный `KIND_LABELS` const:
  ```typescript
  const KIND_LABELS: Record<NodeOption['kind'], string> = {
    'question': 'Вопрос',
    'text-block': 'Текст',
    'snippet': 'Сниппет',
    'loop': 'Цикл',
  };
  ```
- **D-11:** `setPlaceholder` остаётся английским (`'Search nodes by label…'`).

**Command Wiring (LOOP-06 — dead-code resolution)**

- **D-12:** `this.addCommand({ id: 'start-from-node', name: 'Start from specific node', callback })` в `main.ts onload()`. ID без плагин-префикса (NFR-06).
- **D-13:** Callback — найти активный canvas leaf, прочитать, распарсить, валидировать, `new NodePickerModal(app, buildNodeOptions(graph), onChoose)`, `runnerView.openCanvas(canvasPath, opt.id)`.
- **D-14:** `RunnerView.openCanvas(canvasPath, startNodeId?)` — **не существует сегодня**, см. §1.4. Planner либо добавляет второй параметр, либо использует существующий pathway (его тоже нет — `ProtocolRunner.start` не принимает `startNodeId`).
- **D-15:** Перед открытием picker'а — `plugin.activateRunnerView()` (существует, `main.ts:178`).

**NODE_COLOR_MAP (LOOP-06 color part)**

- **D-16:** `NODE_COLOR_MAP['loop'] = '1'` **уже существует** — `src/canvas/node-color-map.ts:21`. Phase 45 не изменяет файл. `[VERIFIED: read]`
- **D-17:** End-to-end покраска работает через Phase 28 `saveNodeEdits` injection pipeline (`editor-panel-view.ts:169-182`). Phase 45 добавляет integration-тест.

**Tests**

- **D-18, D-19, D-20:** Два новых файла (`editor-panel-loop-form.test.ts`, `node-picker-modal.test.ts`) + расширение `runner-commands.test.ts`.

### Claude's Discretion

- **D-CL-01:** Иконка loop кнопки (`repeat` / `repeat-1` / `rotate-cw` / `infinity`).
- **D-CL-02:** Имя CSS-класса loop кнопки (`rp-create-loop-btn` предложено).
- **D-CL-03:** Если factory уже поддерживает все kinds (ДА, см. §2.3) — D-05 zero-delta.
- **D-CL-04:** Формулировка notice'ов (русский/английский) для ошибок command-flow — консистентно с существующими (в main.ts они английские).
- **D-CL-05:** Позиция fallback `'(корень snippets)'` для snippet label в D-07.
- **D-CL-06:** В `start-from-node` при legacy-loop-start в канвасе validator вернёт MIGRATE-01 — блокируем старт (не делаем exception для не-loop startNode).

### Deferred Ideas (OUT OF SCOPE)

- Удаление legacy `loop-start` / `loop-end` из `RPNodeKind` / парсера / валидатора / editor-panel fallback формы — остаются до окончания прода legacy-канвасов (Phase 43 D-CL-05).
- Замена ItemView Node Editor на modal — out of scope v1.7.
- Free-text-input excision — Phase 46 (CLEAN-01..04).
- Автомиграция legacy loop-start/loop-end → unified loop — REQUIREMENTS.md Out of Scope.
- Wiring `start-from-node` на hotkey / ribbon icon — пользователь назначает через Obsidian Settings → Hotkeys.
- «Convert to unified loop» кнопка для legacy форм.
- Placeholder подсказка про «выход» в loop-форме.
- Answer-узлы в picker'е.
- i18n `setPlaceholder` и Obsidian-native строк.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LOOP-05** | Node Editor form for the loop node lets the author edit `headerText` and removes any `maxIterations` control | §1.1 подтверждает — форма существует в `editor-panel-view.ts:568-586`, maxIterations нет нигде в src (Phase 44 RUN-07 excision). Lock-in тесты в `editor-panel-loop-form.test.ts` (D-02). Quick-create button — §1.1 + §2.1. |
| **LOOP-06** | Node color map and `NodePickerModal` list `loop` as a first-class node kind | Color: §2.4 — `NODE_COLOR_MAP['loop']='1'` exists. Picker: §1.2 — переписан согласно D-06..D-11. Command wire-up: §1.5 (dead code resolution — picker сегодня не вызывается ниоткуда кроме RED теста). |

---

## Project Constraints (from CLAUDE.md)

Это **жёсткие guardrails** для executor'а. Planner обязан включить их в acceptance criteria каждой соответствующей задачи.

1. **CSS Architecture — per-feature file + append-only per phase.** Новый CSS Phase 45 идёт ТОЛЬКО в `src/styles/editor-panel.css` с маркером `/* Phase 45: loop quick-create button */`. Никаких изменений в `src/styles/loop-support.css` (он про runner picker, не editor-panel). Никогда не редактировать `styles.css` / `src/styles.css` — они generated-by-esbuild. После любого CSS edit — `npm run build` для regeneration.
2. **Never remove existing code you didn't add.** Особенно критично для: `editor-panel-view.ts` (не трогать Phase 44 UAT-fix строки 568-586, не трогать формы question/answer/snippet/text-block/free-text-input/loop-start|loop-end legacy stub), `main.ts` (не удалять существующие addCommand), `node-picker-modal.ts` (при расширении — не удалять существующие question/text-block ветки, расширять), `src/styles/editor-panel.css` (append-only, не переписывать Phase 4/39/40/42 блоки).
3. **CSS output generated — не коммитить ручные правки `styles.css`.**

### Other Project Standing Pitfalls (from STATE.md)

- `loadData()` returns null on first install — always merge with defaults (не применимо к Phase 45 — settings не трогаются).
- No `innerHTML` — DOM API + Obsidian helpers.
- No `require('fs')` — use `app.vault.*`.
- `console.log` forbidden in production — use `console.debug()`.
- `parentElement` first, `.parent` mock fallback for DOM lookup.
- **Pitfall #10 (v1.7-specific):** Никогда не возвращать `maxIterations` — применимо, Phase 45 не должна добавлять iterations UI куда-либо.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loop quick-create кнопка (UI) | Views (`editor-panel-view.ts`) | Canvas (`canvas-node-factory.ts`) | UI-сервис делегирует создание узла существующему factory |
| Loop form lock-in тесты | `__tests__/editor-panel-loop-form.test.ts` | — | Pure unit-test layer над Views |
| NodePickerModal (SuggestModal) | Views (`node-picker-modal.ts`) | Graph (`graph-model.ts` types) | View читает `ProtocolGraph.nodes` Map, строит `NodeOption[]` |
| NodePicker тесты | `__tests__/node-picker-modal.test.ts` | — | Unit-test pure `buildNodeOptions` + mock SuggestModal |
| `start-from-node` command | Plugin entry (`main.ts`) | Views + Graph + Runner | orchestration layer: command callback → `canvasParser.parse` → `GraphValidator.validate` → `NodePickerModal.open` → `RunnerView.openCanvas(path, nodeId)` |
| `openCanvas` extension (startNodeId parameter) | Views (`runner-view.ts`) | Runner (`protocol-runner.ts` — `start(graph, startNodeId?)`) | View передаёт параметр в pure engine; engine выбирает стартовую точку traversal'а |
| CSS `.rp-create-loop-btn` | `src/styles/editor-panel.css` | — | Per-feature CSS append (CLAUDE.md) |
| NODE_COLOR_MAP['loop']='1' coloring | Canvas (`node-color-map.ts`) | Views (`editor-panel-view.ts saveNodeEdits`) | Color map — pure data; editor-panel читает его на каждом save |

---

## Standard Stack

### Core (Already in project — никаких новых deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | pinned 1.12.3 | `ItemView`, `SuggestModal`, `Setting`, `Notice`, `setIcon` | Obsidian plugin API — single runtime dependency |
| TypeScript | (project-local) | Strict discriminated unions | NFR enforces type-safe `kind` discriminant |
| vitest | (project-local) | Unit tests with JSDom-ish environment | Already test harness for all `src/__tests__/*.test.ts` |
| esbuild | (project-local) | Build pipeline with CSS concatenation plugin | Regenerates `styles.css` from `src/styles/*.css` per CSS_FILES order |

**No new packages required.** `[VERIFIED: package.json — research did not run `npm install`, работаем в контексте существующих зависимостей; CONTEXT.md не вводит новых библиотек]`

### Обращение к Obsidian API (reference-only — уже используется)

| API | Used For | Confidence |
|-----|----------|-----------|
| `SuggestModal<T>` | `NodePickerModal extends SuggestModal<NodeOption>` | `[VERIFIED: read views/node-picker-modal.ts:50]` |
| `setIcon(el, iconName)` | Lucide icon injection в кнопки toolbar'а | `[VERIFIED: read editor-panel-view.ts:1 import]` |
| `new Notice(msg)` | Ошибки command flow (no canvas / parse fail / validator fail) | `[VERIFIED: read main.ts:56, editor-panel-view.ts:194]` |
| `new Setting(container)` | Form rendering в buildKindForm | `[VERIFIED: read editor-panel-view.ts:334-665]` |
| `this.addCommand({id,name,callback})` | Команда регистрируется без плагин-префикса (NFR-06) | `[VERIFIED: read main.ts:46-81]` |
| `app.workspace.getLeavesOfType('canvas')` + `getMostRecentLeaf()` | Поиск активного canvas leaf'а | `[VERIFIED: read editor-panel-view.ts:55-57, main.ts:98-105]` |

---

## Architecture Patterns

### System Data Flow — Phase 45 New Paths

**Flow A — Quick-create loop node (LOOP-05):**

```
[User clicks "Create loop node"]
         ↓
editor-panel-view.ts:renderToolbar() → registerDomEvent('click')
         ↓
onQuickCreate('loop')        — kind-union расширен
         ↓
flush pending auto-save      — reuse existing flush block (editor-panel-view.ts:753-764)
         ↓
plugin.canvasNodeFactory.createNode(canvasPath, 'loop', currentNodeId?)
         ↓
  canvas-node-factory.ts:createNode()  ← kind-agnostic — writes:
    - radiprotocol_nodeType: 'loop'
    - color: NODE_COLOR_MAP['loop'] === '1'  (red)
         ↓
editor-panel-view.ts:renderForm(nodeRecord, 'loop')
         ↓
  buildKindForm → case 'loop':  ← already exists (line 568-586)
    → Setting: "Header text" textarea
    → onChange syncs both radiprotocol_headerText AND text
```

**Flow B — Start from specific node (LOOP-06 command):**

```
[User: Ctrl+P → "Start from specific node"]
         ↓
main.ts: start-from-node command callback
         ↓
  getLeavesOfType('canvas') ∩ getMostRecentLeaf() → canvasLeaf
         ↓  (if no canvas open)
  new Notice('Open a canvas first.')  ← D-CL-04
         ↓
  vault.read(canvasFile) → canvasParser.parse(json)
         ↓  (if parse fails)
  new Notice(parseResult.error)
         ↓
  validator.validate(graph) → errors
         ↓  (if any errors — including MIGRATE-01 on legacy loops, per D-CL-06)
  new Notice(errors[0])
         ↓
  plugin.activateRunnerView()  ← main.ts:178, уже существует
         ↓
  new NodePickerModal(app, buildNodeOptions(graph), onChoose).open()
         ↓  (user picks option)
  runnerView.openCanvas(canvasPath, opt.id)     ← D-14: нужен extension
         ↓
  ProtocolRunner.start(graph, opt.id)           ← D-14: нужен extension
```

### Recommended Project Structure (no new folders)

```
src/
├── main.ts                              # +1 addCommand block (Flow B)
├── canvas/
│   ├── canvas-node-factory.ts           # untouched (kind-agnostic — см. §2.3)
│   └── node-color-map.ts                # untouched (D-16)
├── runner/
│   └── protocol-runner.ts               # +startNodeId optional param on start()
├── styles/
│   └── editor-panel.css                 # +append Phase 45 CSS block
├── views/
│   ├── editor-panel-view.ts             # +'loop' in onQuickCreate union + +loop button in renderToolbar
│   ├── node-picker-modal.ts             # REWRITE buildNodeOptions + extend NodeOption + KIND_LABELS
│   └── runner-view.ts                   # +startNodeId param on openCanvas
└── __tests__/
    ├── editor-panel-loop-form.test.ts   # NEW (D-02)
    ├── node-picker-modal.test.ts        # NEW (D-19)
    └── runner-commands.test.ts          # +extend for D-20
```

### Pattern 1: onQuickCreate Flush + Factory + Re-render

**What:** Единый paths для любой quick-create кнопки.
**When to use:** Добавление 4-й кнопки (`'loop'`) — повторяется паттерн question/answer/snippet.
**Example:** `editor-panel-view.ts:745-784` (смотри весь метод; единственная правка — union extension).

```typescript
// Current signature (line 745):
private async onQuickCreate(kind: 'question' | 'answer' | 'snippet'): Promise<void> {
// Phase 45 target:
private async onQuickCreate(kind: 'question' | 'answer' | 'snippet' | 'loop'): Promise<void> {
// — body unchanged; createNode + renderForm работают для 'loop' через NODE_COLOR_MAP['loop']
```

### Pattern 2: renderToolbar Button Block

**What:** Стандартный блок createEl('button') + setIcon + appendText + registerDomEvent.
**Example:** `editor-panel-view.ts:852-883`. Loop-кнопка — один новый блок после `sBtn` и **перед** `dupBtn` (D-03):

```typescript
// After Phase 42 snippet button block (line 874), BEFORE Phase 40 duplicate button (line 877):
const lBtn = toolbar.createEl('button', { cls: 'rp-create-loop-btn' });
lBtn.setAttribute('aria-label', 'Create loop node');
lBtn.setAttribute('title', 'Create loop node');
const lIcon = lBtn.createSpan();
setIcon(lIcon, 'repeat');  // D-CL-01 — planner picks: repeat / repeat-1 / rotate-cw / infinity
lBtn.appendText('Create loop node');
this.registerDomEvent(lBtn, 'click', () => { void this.onQuickCreate('loop'); });
```

### Pattern 3: SuggestModal Extension

**What:** `class X extends SuggestModal<T>` + `getSuggestions(q)` filter + `renderSuggestion(opt,el)` render + `onChooseSuggestion(opt,evt)` callback.
**Existing:** `node-picker-modal.ts:50-75`. Phase 45 меняет только internals `buildNodeOptions` + `renderSuggestion` body + `NodeOption.kind` union; класс и его API-сигнатура — те же.

### Anti-Patterns to Avoid

- **Deleting legacy question/text-block branches in `buildNodeOptions`** — append-only extension. Добавляем 2 новых `else if` ветки (snippet, loop), сохраняя старые.
- **Adding iteration / maxIterations field to loop form** — Phase 44 RUN-07 это удалило из всех слоёв. Test в D-02 последний пункт — негативный assertion на строку "iterations".
- **Adding "answer" to NodePickerModal** — осознанное отклонение D-06. Если добавить — добавь в KIND_LABELS тоже. Не делаем в Phase 45.
- **Editing `styles.css` / `src/styles.css` directly** — они сгенерированные; editor их перезапишет на следующем build.
- **Prefixing command id with `radiprotocol-`** — NFR-06. Id только `'start-from-node'`.
- **Calling `NodePickerModal` без предварительной валидации графа** — D-CL-06 requires: validator.validate() first; если errors[].length > 0, Notice + abort (включая MIGRATE-01 на legacy loops).
- **Hardcoding Russian text в `setPlaceholder`** — D-11: оставить английский, это Obsidian-native слой.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Фильтрация и выбор узлов | Custom modal c input + DIV list | Obsidian `SuggestModal<T>` | Уже используется в `node-picker-modal.ts`; фуззи-поиск, keyboard nav, theme-aware styling — встроенно |
| Lucide icon injection | Inline SVG markup | `setIcon(el, 'iconName')` из obsidian | Уже используется 4 раза в `renderToolbar`; поддерживает 1000+ иконок out-of-the-box |
| Form fields c labels | Custom `<label>` + `<input>` | `new Setting(container).setName().setDesc().addTextArea(...)` | Используется 15+ раз в `editor-panel-view.ts`; theme-aware, автоматически стилится |
| DOM event lifecycle | `addEventListener` | `this.registerDomEvent(el, evt, handler)` | Obsidian auto-cleans listeners при view destroy (CONCERNS.md анти-паттерн inline listeners — Phase 39 WR-01) |
| Canvas JSON parse | Custom JSON.parse + traversal | `plugin.canvasParser.parse(content, path)` | Единственная реализация, возвращает typed `ParseResult`, уже учитывает v1.7 loop rules |
| Graph structural validation | Custom checks | `new GraphValidator().validate(graph)` | Reuse от Phase 43/44; MIGRATE-01/LOOP-04/acyclicity встроены |
| Auto-coloring | Hardcoded `color: '1'` | `NODE_COLOR_MAP[kind]` через `saveNodeEdits` injection | Phase 28 established patter; Record<RPNodeKind, string> форсит exhaustiveness |
| Canvas leaf поиск | Перебор workspace.iterateAllLeaves | `getLeavesOfType('canvas') ∩ getMostRecentLeaf()` | Существующий паттерн в editor-panel-view.ts:55-57 |

**Key insight:** Phase 45 — upstream integration phase, не greenfield. 80% работы — «протянуть» существующие паттерны на 4-й kind (loop) и расшить picker.

---

## Runtime State Inventory

Phase 45 **не является rename/refactor/migration фазой** (новая функциональность: кнопка + picker + команда). Запись формально пуста, но ниже — sanity-check:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 45 не меняет schemas каких-либо persisted данных (sessions / snippets / canvas format) | None |
| Live service config | None — никаких внешних сервисов (n8n / Datadog / pm2) | None |
| OS-registered state | None — Obsidian command registration live-in-plugin, не OS-level | None |
| Secrets/env vars | None | None |
| Build artifacts | `styles.css` + `src/styles.css` + `main.js` — regenerate after `npm run build`; `dev-vault-copy` esbuild plugin копирует в `OBSIDIAN_DEV_VAULT_PATH` если задан (.env) | После CSS edit — `npm run build`. Для UAT в Obsidian — убедиться что dev-vault-copy отработал (если `.env` есть). |

---

## Common Pitfalls

### Pitfall 1: Async save cycle blocks node selection

**What goes wrong:** quickCreate нажимается пока в форме pending textarea edit с debounce; без flush — edits теряются при switch node.
**Why it happens:** `scheduleAutoSave()` debounce timer (800ms) может не отработать до вызова `createNode`.
**How to avoid:** Copy the existing flush block verbatim from `editor-panel-view.ts:753-764` — уже работает для question/answer/snippet. Loop quick-create идёт через тот же `onQuickCreate` — flush автоматически.
**Warning signs:** Test — зарегистрировать pending edit, вызвать `onQuickCreate('loop')`, проверить что flush ран.

### Pitfall 2: `Setting` mock returns undefined — tests break на chain

**What goes wrong:** vi.mock('obsidian') автоматически заменяет `Setting.prototype.setName/setDesc/setHeading/addTextArea` на vi.fn() возвращающий `undefined`. Chain `.setName().setDesc().addTextArea(cb)` падает.
**Why it happens:** Default vitest mock — возвращает undefined, не chainable this.
**How to avoid:** `editor-panel-create.test.ts:354-367` демонстрирует фикс:
```typescript
const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
SettingProto.setName = vi.fn(function (this: unknown) { return this; });
// ... и т.д.
```
Planner должен **скопировать** эту технику в `editor-panel-loop-form.test.ts`.
**Warning signs:** Test падает с `Cannot read properties of undefined (reading 'setDesc')`.

### Pitfall 3: contentEl undefined в ItemView mock

**What goes wrong:** `vi.mock('obsidian')` auto-stubs `ItemView` constructor — `this.contentEl` === undefined.
**Why:** Mock body не run, только class skeleton.
**How to avoid:** `editor-panel-create.test.ts:345-348`:
```typescript
(view as unknown as { contentEl: { empty: () => void } }).contentEl = { empty: () => {} };
```
Для более rich setup (createEl/createDiv capture) — см. fakeNode builder в `editor-panel-create.test.ts:410-430`.
**Warning signs:** `view.renderForm()` throws при первой итерации `this.contentEl.empty()`.

### Pitfall 4: `setIcon` doesn't exist in obsidian mock

**What goes wrong:** `__mocks__/obsidian.ts` не экспортирует `setIcon` (проверено grep-ом — нет). Импорт в test через `import { setIcon } from 'obsidian'` вернёт undefined; вызов → TypeError.
**Why:** Только минимальный мок используется.
**How to avoid:** Тесты которые exercise `renderToolbar()` должны stub-ить его целиком (см. `editor-panel-create.test.ts:434-437`):
```typescript
vi.spyOn(view as unknown as { renderToolbar: (c: unknown) => void }, 'renderToolbar').mockImplementation(() => {});
```
Для Phase 45 — lock-in тесты **формы** не должны вызывать renderToolbar; isolation test на кнопку — либо stub-ить setIcon через `vi.mock('obsidian', async () => ({ ...actual, setIcon: vi.fn() }))`, либо тестировать behaviour через `onQuickCreate` напрямую (как `editor-panel-create.test.ts` делает).
**Warning signs:** `TypeError: setIcon is not a function`.

### Pitfall 5: Ordering of buildKindForm switch — case 'loop' должна быть ПОСЛЕ legacy 'loop-start'/'loop-end'

**What goes wrong:** Если `case 'loop'` случайно сольётся с `case 'loop-start'` через fall-through.
**Why:** `switch` case без break — classic hazard. Сейчас `case 'loop-start': case 'loop-end': { ... break; }` — слито (legacy stub), а `case 'loop'` — отдельный, правильно. **Не трогать.**
**How to avoid:** В lock-in тесте (D-02 второй кейс) явно assert: kind='loop' → heading "Loop node", НЕ "Legacy loop node".
**Warning signs:** Тест даст regression если кто-то случайно добавит fall-through.

### Pitfall 6: NodePickerModal answer-exclusion regression

**What goes wrong:** Программист добавляет `answer` в `buildNodeOptions` thinking «ROADMAP SC #3 говорит answer».
**Why:** ROADMAP буквально перечисляет answer; CONTEXT.md D-06 осознанно отклоняет.
**How to avoid:** Test в D-19:
```typescript
const graph = mockGraph({ answer: {...}, start: {...} });
const opts = buildNodeOptions(graph);
expect(opts.find(o => o.kind === 'answer')).toBeUndefined();  // must not appear
expect(opts.find(o => o.kind === 'start')).toBeUndefined();   // start тоже исключен
```
**Warning signs:** Test падает если кто-то расширил union.

### Pitfall 7: Sort instability для одинаковых labels

**What goes wrong:** `localeCompare` deterministic для разных строк, но два узла с одинаковым `headerText` через `node.id` fallback дадут нестабильный порядок.
**Why:** `Array.prototype.sort` is stable в ES2019+ (все Node.js 12+), но разные labels одного вида сортируются per-locale rules.
**How to avoid:** localeCompare без locale arg использует runtime default. Для теста — фиксировать ASCII labels в mock graph (избегать смешения кириллицы/латиницы в одном group'е, если только это не тест на сортировку).
**Warning signs:** Flaky test assertions на exact порядок суссeстий.

### Pitfall 8: `openCanvas` contract change breaks setState восстановление

**What goes wrong:** Расширение `openCanvas(filePath, startNodeId?)` — `setState` на строке 56 вызывает `this.openCanvas(path)` без второго arg — работает (optional), но добавление **обязательного** параметра сломает session resume.
**Why:** Obsidian workspace persistence вызывает setState при restart; там только `canvasFilePath`.
**How to avoid:** Второй параметр должен быть **optional** (`startNodeId?: string`). Планировщик явно это фиксирует.
**Warning signs:** After restart runner показывает error/idle вместо resume.

### Pitfall 9: CSS append в неверный файл

**What goes wrong:** Loop кнопка — элемент editor-panel toolbar'а. Её CSS — в `editor-panel.css`. НЕ в `loop-support.css` (тот — про runner picker).
**Why:** CLAUDE.md CSS Architecture: один feature = один файл. `loop-support.css` уже owned by Phase 6/44 runner loop UI.
**How to avoid:** Planner task acceptance criteria должен явно указать файл `src/styles/editor-panel.css`.
**Warning signs:** `.rp-create-loop-btn` не рендерится ожидаемо (style не подключён), либо появляется в runner'е (wrong scope).

### Pitfall 10: Command id lookup collision

**What goes wrong:** Obsidian вычисляет полный command id как `radiprotocol:start-from-node` (plugin manifest id + `:` + command id). Если кто-то забудет и сделает id = `radiprotocol-start-from-node` — получится `radiprotocol:radiprotocol-start-from-node`.
**Why:** NFR-06 явно запрещает префикс.
**How to avoid:** Test в D-20:
```typescript
// После регистрации command — grep main.ts на точную строку 'start-from-node' (не 'radiprotocol-start-from-node')
```
**Warning signs:** Duplicate prefix в Obsidian command palette.

---

## Code Examples

Проверенные паттерны из текущего кода. Source ссылки — на actual файлы в репо.

### Example 1: Existing loop form — lock this in

```typescript
// Source: src/views/editor-panel-view.ts:568-586 (Phase 44 UAT-fix commit cd98df3)
case 'loop': {
  // Phase 44 UAT-fix: unified loop node form (RUN-01 header text + picker).
  new Setting(container).setHeading().setName('Loop node');
  new Setting(container)
    .setName('Header text')
    .setDesc('Displayed above the branch picker when the runner halts at this loop, and also shown as the canvas node label. Leave blank for no header.')
    .addTextArea(ta => {
      ta.setValue((nodeRecord['radiprotocol_headerText'] as string | undefined) ?? (nodeRecord['text'] as string | undefined) ?? '')
        .onChange(v => {
          this.pendingEdits['radiprotocol_headerText'] = v;
          this.pendingEdits['text'] = v;   // sync both fields (см. D-01)
          this.scheduleAutoSave();
        });
    });
  break;
}
```

### Example 2: Existing quick-create button — template for loop button

```typescript
// Source: src/views/editor-panel-view.ts:867-874 (Phase 42 snippet button — template)
const sBtn = toolbar.createEl('button', { cls: 'rp-create-snippet-btn' });
sBtn.setAttribute('aria-label', 'Create snippet node');
sBtn.setAttribute('title', 'Create snippet node');
const sIcon = sBtn.createSpan();
setIcon(sIcon, 'file-text');
sBtn.appendText('Create snippet node');
this.registerDomEvent(sBtn, 'click', () => { void this.onQuickCreate('snippet'); });
```

### Example 3: Existing addCommand pattern — template for start-from-node

```typescript
// Source: src/main.ts:46-81
this.addCommand({
  id: 'run-protocol',
  name: 'Run protocol',
  callback: () => { void this.activateRunnerView(); },
});
// ...
this.addCommand({
  id: 'open-node-editor',          // NFR-06: no prefix
  name: 'Open node editor',
  callback: () => { void this.activateEditorPanelView(); },
});
```

### Example 4: Existing NodePickerModal + buildNodeOptions (extend, don't rewrite)

```typescript
// Source: src/views/node-picker-modal.ts:17-38 (current — 2 kinds)
export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      options.push({ id, label: (node as QuestionNode).questionText, kind: 'question' });
    } else if (node.kind === 'text-block') {
      const preview = (node as TextBlockNode).content.slice(0, 60);
      options.push({ id, label: preview, kind: 'text-block' });
    }
  }
  options.sort((a, b) => {
    if (a.kind !== b.kind) { return a.kind === 'question' ? -1 : 1; }
    return a.label.localeCompare(b.label);
  });
  return options;
}
```

**Target for Phase 45 (D-06..D-10) — integrates 4 kinds + Russian badges:**

```typescript
// Source target: src/views/node-picker-modal.ts (after Phase 45 rewrite)
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model';

export interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block' | 'snippet' | 'loop';   // D-09
}

const KIND_LABELS: Record<NodeOption['kind'], string> = {  // D-10
  'question': 'Вопрос',
  'text-block': 'Текст',
  'snippet': 'Сниппет',
  'loop': 'Цикл',
};

const KIND_ORDER: NodeOption['kind'][] = ['question', 'loop', 'text-block', 'snippet'];  // D-08

export function buildNodeOptions(graph: ProtocolGraph): NodeOption[] {
  const options: NodeOption[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.kind === 'question') {
      const q = node as QuestionNode;
      options.push({ id, label: q.questionText || id, kind: 'question' });      // D-07
    } else if (node.kind === 'text-block') {
      const tb = node as TextBlockNode;
      const preview = tb.content.slice(0, 60);
      options.push({ id, label: preview || id, kind: 'text-block' });
    } else if (node.kind === 'snippet') {
      const s = node as SnippetNode;
      options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
    } else if (node.kind === 'loop') {
      const l = node as LoopNode;
      options.push({ id, label: l.headerText || id, kind: 'loop' });
    }
    // answer, start, free-text-input, loop-start, loop-end — сознательно исключены (D-06)
  }
  options.sort((a, b) => {
    const kaIdx = KIND_ORDER.indexOf(a.kind);
    const kbIdx = KIND_ORDER.indexOf(b.kind);
    if (kaIdx !== kbIdx) return kaIdx - kbIdx;
    return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  });
  return options;
}

// ... class NodePickerModal — renderSuggestion uses KIND_LABELS[option.kind]
```

### Example 5: Start-from-node command callback (D-13)

```typescript
// Source target: src/main.ts onload() — new addCommand
this.addCommand({
  id: 'start-from-node',
  name: 'Start from specific node',
  callback: () => { void this.handleStartFromNode(); },
});

// new method on RadiProtocolPlugin class:
private async handleStartFromNode(): Promise<void> {
  const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
  const activeLeaf = this.app.workspace.getMostRecentLeaf();
  const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
  if (!canvasLeaf) {
    new Notice('Open a canvas first.');     // D-CL-04
    return;
  }
  const canvasPath = (canvasLeaf.view as { file?: { path: string } }).file?.path;
  if (!canvasPath) return;

  // Prefer live JSON via CanvasLiveEditor to avoid stale disk read (BUG-02/03 pattern)
  const liveJson = this.canvasLiveEditor.getCanvasJSON(canvasPath);
  let content: string;
  if (liveJson !== null) {
    content = liveJson;
  } else {
    const file = this.app.vault.getAbstractFileByPath(canvasPath);
    if (!(file instanceof TFile)) { new Notice('Canvas file not found.'); return; }
    content = await this.app.vault.read(file);
  }

  const parseResult = this.canvasParser.parse(content, canvasPath);
  if (!parseResult.success) { new Notice(parseResult.error); return; }

  const validator = new GraphValidator();
  const errors = validator.validate(parseResult.graph);
  if (errors.length > 0) { new Notice(errors[0]!); return; }  // D-CL-06

  const options = buildNodeOptions(parseResult.graph);
  if (options.length === 0) {
    new Notice('No startable nodes in this canvas.');
    return;
  }

  await this.activateRunnerView();  // D-15
  const runnerLeaves = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
  const runnerLeaf = runnerLeaves[0];
  if (runnerLeaf === undefined) return;
  const runnerView = runnerLeaf.view as RunnerView;

  new NodePickerModal(this.app, options, (opt) => {
    void runnerView.openCanvas(canvasPath, opt.id);     // D-14: needs extension
  }).open();
}
```

### Example 6: ProtocolRunner.start extension for startNodeId

```typescript
// Source: src/runner/protocol-runner.ts:54-66 (current)
start(graph: ProtocolGraph): void {
  this.graph = graph;
  this.currentNodeId = null;
  this.accumulator = new TextAccumulator();
  this.undoStack = [];
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
  this.loopContextStack = [];
  this.runnerStatus = 'at-node';
  this.advanceThrough(graph.startNodeId);     // ← hardcoded start
}

// Target: add optional startNodeId parameter
start(graph: ProtocolGraph, startNodeId?: string): void {
  this.graph = graph;
  // ... same reset logic
  this.runnerStatus = 'at-node';
  this.advanceThrough(startNodeId ?? graph.startNodeId);   // ← parametrized
}
```

### Example 7: RunnerView.openCanvas extension for startNodeId

```typescript
// Source: src/views/runner-view.ts:61-154 (current — `openCanvas(filePath)` only)
// Target: add optional startNodeId param, thread into runner.start() AND bypass session-resume
//         modal when caller explicitly picks a node (clear session first, per restartCanvas pattern).
async openCanvas(filePath: string, startNodeId?: string): Promise<void> {
  // ... existing: create runner, read, parse, validate ...
  if (startNodeId !== undefined) {
    // Skip session-resume modal — user explicitly picked a start point
    await this.plugin.sessionService.clear(filePath);
    this.graph = graph;
    this.runner.start(graph, startNodeId);
    this.render();
    return;
  }
  // ... existing session-resume path unchanged ...
}
```

### Example 8: Test pattern for Setting mock

```typescript
// Source: src/__tests__/editor-panel-create.test.ts:353-367
// Required for any test that exercises buildKindForm / renderForm
import { Setting } from 'obsidian';

beforeEach(() => {
  const SettingProto = Setting.prototype as unknown as Record<string, unknown>;
  SettingProto.setName = vi.fn(function (this: unknown) { return this; });
  SettingProto.setDesc = vi.fn(function (this: unknown) { return this; });
  SettingProto.setHeading = vi.fn(function (this: unknown) { return this; });
  const mockTextArea = {
    setValue: vi.fn(function (this: unknown) { return this; }),
    onChange: vi.fn(function (this: unknown) { return this; }),
  };
  SettingProto.addTextArea = vi.fn(function (this: unknown, cb: (ta: unknown) => void) {
    cb(mockTextArea);
    return this;
  });
});
```

---

## State of the Art

Нет deprecated / outdated внутри Phase 45 scope — вся работа поверх стабильных Obsidian API (`SuggestModal`, `Setting`, `setIcon`) и внутренних паттернов, установленных Phase 28-44. Ничего не «обновляется» — только расширяется.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `LoopStartNode.maxIterations` field | Removed; `ProtocolRunner.maxIterations` — cycle guard only (RUN-09) | Phase 44 (2026-04-17) | Нельзя добавлять iterations UI в loop form (LOOP-05 негативный assertion) |
| `NodePickerModal` dead — только RED test импорт | Wire через `start-from-node` command (Phase 45 D-12) | v1.0 → Phase 45 | Удаляется dead code след |
| `loop-start` / `loop-end` как live kinds | Legacy-only, retained для MIGRATE-01 path | Phase 43 (2026-04-17) | Не добавлять их в picker; они не startable |

**Deprecated / outdated (должны остаться на месте — **не трогать** в Phase 45):**

- `LoopStartNode` / `LoopEndNode` interface в graph-model.ts — `@deprecated Phase 43 D-03`, live для parser MIGRATE-01.
- `case 'loop-start': case 'loop-end':` legacy stub в editor-panel-view.ts:557-566 — Phase 44 RUN-07 переписал на informational stub. Не трогать.
- `NODE_COLOR_MAP['loop-start']='1'`, `NODE_COLOR_MAP['loop-end']='1'` — nодержатся для exhaustiveness `Record<RPNodeKind, string>`.

---

## Assumptions Log

> Все ключевые утверждения в этом RESEARCH.md верифицированы чтением кода или CONTEXT.md. Список `[ASSUMED]` claims пуст. Planner не требует дополнительного подтверждения пользователя перед execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**Table empty:** All claims in this research were verified (codebase read) or cited (CONTEXT.md, CLAUDE.md, STATE.md). No user confirmation needed for assumed facts.

---

## Open Questions

1. **Icon name для loop button** (D-CL-01)
   - What we know: Phase 44 CSS использует `var(--interactive-accent)` для body-btn и `var(--background-modifier-border)` для exit-btn в loop picker.
   - What's unclear: Какая из 4 Lucide иконок (`repeat`, `repeat-1`, `rotate-cw`, `infinity`) семантически лучше подходит.
   - Recommendation: Planner выбирает `repeat` по умолчанию (наиболее семантически однозначно); executor может заменить при UAT feedback.

2. **Label для snippet без subfolderPath** (D-CL-05)
   - What we know: SnippetNode.subfolderPath — optional.
   - What's unclear: Что показать в picker'е — `'(корень snippets)'` (предложено в D-07), просто `id`, или пустую строку.
   - Recommendation: `label || '(корень snippets)' || id` — двойной fallback гарантирует непустую метку.

3. **Notice wording** при различных ошибках command flow (D-CL-04)
   - What we know: Existing notices в main.ts — английские.
   - What's unclear: Применять ли русский (в стиле validator migration-errors) или остаться английским.
   - Recommendation: Английский — consistency с окружающими notices. `'Open a canvas first.'`, `'Canvas validation failed: <first error>'`, `'No startable nodes in this canvas.'`

4. **Как именно клиент NodePickerModal callback получит `runnerView`**
   - What we know: `activateRunnerView()` (main.ts:178) создаёт leaf, потом ищется через `getLeavesOfType(RUNNER_VIEW_TYPE)[0]`.
   - What's unclear: Можно ли в callback сразу обратиться к runnerView, или нужен `await`-point между `activateRunnerView()` и `new NodePickerModal(...).open()`.
   - Recommendation: В Example 5 выше — `await activateRunnerView()` ДО открытия picker'а; в callback уже безопасно брать leaf и звать openCanvas.

---

## Environment Availability

Phase 45 — чистая code/config работа, никаких внешних tools/services.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Build + test | ✓ (project-local) | `npm test`, `npm run build` | — |
| vitest | Unit tests | ✓ (dev dep) | 1.x (project-pinned) | — |
| esbuild | Bundle + CSS concat | ✓ (dev dep) | (project-pinned) | — |
| Obsidian desktop app | UAT | Человек | 1.12.3+ | — (не automation) |

**Missing dependencies with no fallback:** None — Phase 45 workable сразу.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (project-local) |
| Config file | `vitest.config.ts` (ambient; aliases `obsidian` → `src/__mocks__/obsidian.ts`) |
| Quick run command | `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts src/__tests__/node-picker-modal.test.ts src/__tests__/runner-commands.test.ts` |
| Full suite command | `npm test -- --run` |
| Phase gate | Full suite green + `npm run build` exit 0 + UAT human verify (3 checks) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-05 | Dropdown contains option 'loop' with label 'Loop' | unit | `npx vitest run -t "dropdown contains loop option"` | ❌ Wave 0 (new file) |
| LOOP-05 | Selecting kind='loop' renders heading 'Loop node' + ровно одно Setting 'Header text' | unit | `npx vitest run -t "loop form renders header-text setting"` | ❌ Wave 0 |
| LOOP-05 | Loop form НЕ содержит 'iterations' / 'maxIterations' setting (negative) | unit | `npx vitest run -t "loop form has no iterations control"` | ❌ Wave 0 |
| LOOP-05 | Textarea onChange syncs pendingEdits['radiprotocol_headerText'] AND pendingEdits['text'] | unit | `npx vitest run -t "loop onChange syncs both fields"` | ❌ Wave 0 |
| LOOP-05 | `saveNodeEdits` injects color:'1' when kind='loop' | unit | `npx vitest run -t "saveNodeEdits loop sets color"` | ❌ Wave 0 |
| LOOP-05 | Quick-create 'loop' button calls factory with kind='loop' | unit | `npx vitest run -t "loop button calls factory"` | ❌ Wave 0 (extend editor-panel-create.test.ts OR new file) |
| LOOP-05 | Quick-create 'loop' button flushes pending debounce | unit | `npx vitest run -t "loop quick-create flushes debounce"` | ❌ Wave 0 |
| LOOP-06 | `buildNodeOptions` returns all 4 kinds (question + text-block + snippet + loop) | unit | `npx vitest run -t "buildNodeOptions 4 kinds"` | ❌ Wave 0 (new file) |
| LOOP-06 | `buildNodeOptions` excludes answer / start / legacy loops | unit | `npx vitest run -t "buildNodeOptions excludes non-startable"` | ❌ Wave 0 |
| LOOP-06 | Label fallback to id when text field empty (4 kinds) | unit | `npx vitest run -t "label fallback to id"` | ❌ Wave 0 |
| LOOP-06 | Sort order: question → loop → text-block → snippet | unit | `npx vitest run -t "sort kind-groups entry-order"` | ❌ Wave 0 |
| LOOP-06 | Within-group sort alphabetical via localeCompare | unit | `npx vitest run -t "within-group alphabetical"` | ❌ Wave 0 |
| LOOP-06 | KIND_LABELS has all 4 kinds с русскими метками | unit | `npx vitest run -t "KIND_LABELS exhaustive"` | ❌ Wave 0 |
| LOOP-06 | `renderSuggestion` использует KIND_LABELS[option.kind] в badge | unit | `npx vitest run -t "renderSuggestion uses Russian badge"` | ❌ Wave 0 |
| LOOP-06 | Command 'start-from-node' registered в plugin commands (extend runner-commands.test.ts D-20) | unit | `npx vitest run -t "start-from-node command registered"` | ✓ (extend) |
| LOOP-06 | Command id имеет НЕ radiprotocol- префикс (grep assert) | unit | `npx vitest run -t "start-from-node id has no prefix"` | ❌ Wave 0 |
| LOOP-06 | NODE_COLOR_MAP['loop'] === '1' (already in code; assert) | unit | `npx vitest run -t "NODE_COLOR_MAP loop is red"` | ✓ (may already exist в graph-validator.test.ts; verify) |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts src/__tests__/node-picker-modal.test.ts` (fast subset, ~1s)
- **Per wave merge:** `npm test -- --run` (full suite, currently 402 passed + 1 skipped)
- **Phase gate:** Full suite green + `npm run build` exit 0 + human UAT 3 checks:
  1. Editor-panel: select loop node → form renders; no iterations field.
  2. Editor-panel toolbar: click "Create loop node" → node created на canvas с красным цветом.
  3. Command palette: Ctrl+P → "Start from specific node" → picker shows все 4 kinds, loop помечен «Цикл»; picker выбор → runner стартует с этого узла.

### Wave 0 Gaps

- [ ] `src/__tests__/editor-panel-loop-form.test.ts` — NEW (covers LOOP-05 items 1-5 выше + button item 6-7)
- [ ] `src/__tests__/node-picker-modal.test.ts` — NEW (covers LOOP-06 buildNodeOptions/sort/label/KIND_LABELS)
- [ ] `src/__tests__/runner-commands.test.ts` — EXTEND (D-20: stronger assertion on NodePickerModal export + start-from-node command registration)
- [ ] No framework install needed — vitest already in place.
- [ ] No shared fixtures needed — существующие `unified-loop-valid.canvas` + любой in-memory mock graph достаточны.

---

## Sources

### Primary (HIGH confidence)

- `Z:\projects\RadiProtocolObsidian\CLAUDE.md` — CSS Architecture, «Never remove existing code you didn't add»
- `Z:\projects\RadiProtocolObsidian\.planning\phases\45-loop-editor-form-picker-color-map\45-CONTEXT.md` — вся decision-matrix D-01..D-20 + Claude's Discretion
- `Z:\projects\RadiProtocolObsidian\.planning\REQUIREMENTS.md` — LOOP-05, LOOP-06 + Out of Scope
- `Z:\projects\RadiProtocolObsidian\.planning\ROADMAP.md` — Phase 45 goal, SC
- `Z:\projects\RadiProtocolObsidian\.planning\STATE.md` — v1.7 Design Decisions, Standing Pitfalls (особ. #7, #8, #10)
- `Z:\projects\RadiProtocolObsidian\.planning\PROJECT.md` — Key Decisions (discriminated union on kind; NFR-06)
- `Z:\projects\RadiProtocolObsidian\.planning\codebase\STRUCTURE.md` — «New Node Type» 9-step checklist
- `Z:\projects\RadiProtocolObsidian\.planning\codebase\CONVENTIONS.md` — naming, imports, phase comment markers
- `Z:\projects\RadiProtocolObsidian\.planning\codebase\CONCERNS.md` — tech debt (mixed Ru/En strings; view-layer test gaps; NodePickerModal is dead code)
- `Z:\projects\RadiProtocolObsidian\.planning\phases\43-unified-loop-graph-model-parser-validator-migration-errors\43-CONTEXT.md` — D-01 (RPNodeKind), D-02 (LoopNode shape), D-12 (NODE_COLOR_MAP['loop']='1')
- `Z:\projects\RadiProtocolObsidian\.planning\phases\44-unified-loop-runtime\44-VERIFICATION.md` — подтверждение что Phase 44 закрыл RUN-07, runtime зелёный
- `Z:\projects\RadiProtocolObsidian\.planning\phases\44-unified-loop-runtime\44-HUMAN-UAT.md` — объяснение, почему форма loop уже в editor-panel-view.ts:568-586 (3 UAT-fixes)

### Codebase (HIGH confidence — actual reads)

- `src/views/editor-panel-view.ts` (923 lines) — dropdown line 345, loop form 568-586, onQuickCreate 745-784, renderToolbar 852-883
- `src/views/node-picker-modal.ts` (75 lines) — NodeOption, buildNodeOptions, NodePickerModal class
- `src/canvas/canvas-node-factory.ts` (114 lines) — kind-agnostic createNode (no switch)
- `src/canvas/node-color-map.ts` (22 lines) — `'loop': '1'` строка 21, exhaustive Record<RPNodeKind, string>
- `src/runner/protocol-runner.ts` — start(graph) signature (line 54), maxIterations is RUN-09 cycle guard only
- `src/views/runner-view.ts` — openCanvas(filePath) signature (line 61), no startNodeId yet
- `src/main.ts` (277 lines) — addCommand pattern lines 46-81, activateRunnerView line 178
- `src/graph/graph-model.ts` — RPNodeKind union line 9-18, LoopNode interface line 67-70
- `src/styles/editor-panel.css` (169 lines) — existing `rp-create-question-btn`, `rp-create-answer-btn`, `rp-create-snippet-btn`, `rp-duplicate-btn` rules for template
- `src/styles/loop-support.css` — Phase 6 + Phase 44 picker classes (reference only — not edited in Phase 45)
- `src/__tests__/editor-panel-create.test.ts` (627 lines) — Setting.prototype mock pattern, ItemView.contentEl stub pattern
- `src/__tests__/editor-panel.test.ts` (70 lines) — light stub test (view metadata, method existence)
- `src/__tests__/runner-commands.test.ts` (30 lines) — existing RED test for NodePickerModal export (D-20 extends this)
- `src/__mocks__/obsidian.ts` (174 lines) — confirmed `setIcon` and `registerDomEvent` NOT in mock (planner must stub them at test time)
- `esbuild.config.mjs` — CSS_FILES array confirms `editor-panel.css` is concatenated at position 3
- `src/__tests__/fixtures/unified-loop-valid.canvas` — reference fixture (5 nodes, 5 edges, loop + «выход»)

### Secondary (MEDIUM confidence)

- None — все заявления выше проверяемы локально в кодовой базе.

### Tertiary (LOW confidence — unverified)

- None.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — никаких новых библиотек; только уже used Obsidian API (`SuggestModal`, `Setting`, `setIcon`, `Notice`, `addCommand`).
- Architecture: HIGH — все паттерны (quick-create, form extension, command wiring) существуют в коде как templates.
- Pitfalls: HIGH — 10 штук, каждый grounded в конкретной строке кода или истории предыдущих фаз (Phase 28/39/42/44).
- Tests: HIGH — mock patterns скопированы из `editor-panel-create.test.ts`; Setting.prototype hack и contentEl stub — проверенно работают.
- Command wiring: HIGH — `NodePickerModal` — прямо-таки dead код сегодня, Phase 45 его впервые оживляет (CONCERNS.md §«Stub command left in production» валидирует этот factual claim).
- CSS / build: HIGH — CSS_FILES array, append-only pattern, и Phase 45 marker `/* Phase 45: loop quick-create button */` — все описаны и прецеденты в существующих файлах видны.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (~30 days — stable: Obsidian API frozen, нет внешних деков с fast-moving releases).

---

*Phase: 45-loop-editor-form-picker-color-map*
*Research by: gsd-researcher / Claude Opus 4.7*
*Research date: 2026-04-18*
