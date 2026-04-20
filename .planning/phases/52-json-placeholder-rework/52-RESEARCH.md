# Phase 52: JSON Placeholder Rework — Research

**Researched:** 2026-04-20
**Domain:** TypeScript snippet subsystem (model, service, editor, fill-in modal, runner)
**Confidence:** HIGH — все факты верифицированы чтением исходников; D-08 bug hypothesis 2 опровергнута grep'ом, hypothesis 3 проверена анализом кода (баг в Phase 33 chip-editor не воспроизводится на этой базе — см. § D-08 repro ниже).

## Summary

Phase 52 — чисто TypeScript-рефакторинг сниппет-субсистемы, без новых внешних зависимостей. Все целевые файлы (model, service, chip-editor, fill-in modal, snippet-editor-modal, runner-view) уже существуют и имеют устоявшиеся паттерны. Риски сосредоточены в двух местах: (1) жёсткая проверка legacy-типов в `SnippetService.load`/`listFolder` должна ветвиться во **всех 4 консьюмерах** (runner-view x2 call sites, snippet-manager-view, snippet-editor-modal indirectly через listFolderDescendants, snippet-tree-picker) — каждый должен уметь переваривать `validationError`; (2) D-08 «сломанный options-editor» скорее всего относится к hypothesis 3 — баг уже починен Phase 33 MODAL-06 и статическое чтение кода `renderOptionRows` + `+ Add option` (src/views/snippet-chip-editor.ts:390-426) показывает корректную add/edit/remove-семантику. Legacy `snippet-manager-view.ts` собственного placeholder-editor больше не имеет (grep подтверждён).

**Primary recommendation:** Выполнить эту фазу 4 волнами: (Wave 0) расширить `JsonSnippet` полем `validationError: string | null`, обновить test-baseline; (Wave 1) сузить union до 2 типов + `renderSnippet` + `SnippetPlaceholder` без `unit`/`joinSeparator` + `separator?: string`; (Wave 2) чип-редактор (PH_COLOR, renderOptionRows keeping, удаление `renderNumberExpanded`, type-select → 2 варианта); (Wave 3) SnippetService.load/listFolder hard-reject + SnippetEditorModal banner + RunnerView error-panel в `handleSnippetFill` + `handleSnippetPickerSelection`. D-08 bug-fix планируется как «regression-proof unit test», а не как код-правка (bug не воспроизводится).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Placeholder schema (union narrowing) | Pure model (`snippets/snippet-model.ts`) | — | Единая точка правды; test-only зависимости; zero Obsidian API |
| Hard-validation (legacy reject) | Service (`snippets/snippet-service.ts`) | Pure (validator-logic can live in helper in snippet-model.ts) | Единственная точка чтения `.json` + vault I/O; centralises error computation |
| Options-list UI (D-08 bug-fix surface) | View (`views/snippet-chip-editor.ts`) | — | Phase 33 уже владеет unified editor; никакой другой UI не редактирует options |
| Fill-in render (unified multi-select) | View (`views/snippet-fill-in-modal.ts`) | — | Runtime-only consumer placeholders |
| Banner surface (editor) | View (`views/snippet-editor-modal.ts`) | — | Hosts chip-editor; уже использует `saveBtnEl.disabled` для collision |
| Runner surface (hard-reject) | View (`views/runner-view.ts`) | — | Два call-sites `snippetService.load`; уже есть `renderError()` pattern |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHLD-01 | Collapse placeholder types to `free-text` + unified `choice`; fix broken options-list editor; unified `choice` renders as multi-select with `separator` join (default `", "`); hard-reject legacy `number`/`multichoice`/old-choice with validation error blocking Runner | Все 4 SC прямо маппятся: SC 1 → `snippet-model.ts` union + `renderSnippet` + `SnippetPlaceholder` правка (§ Model & Render); SC 2 → chip-editor `renderOptionRows` + Wave 2 functional tests (§ D-08 Repro); SC 3 → `snippet-fill-in-modal.ts` `renderChoiceField(isMulti=true)` + `separator` default (§ Fill-in Modal); SC 4 → `SnippetService.load`/`listFolder` + banner + error-panel (§ Hard-reject & Surfaces) |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Дисковая схема JSON:**
- **D-01:** Строковое имя типов на диске и в TS union остаётся `'free-text'` и `'choice'` (дефисное). TS union: `type SnippetPlaceholder['type'] = 'free-text' | 'choice'`.
- **D-02:** Поле-разделитель переименовывается из `joinSeparator` в `separator` и в TS, и на диске. Дефолт `', '`. Legacy сниппетов с `joinSeparator` нет — graceful read-both-write-new не нужен.
- **D-07:** Поле `unit` удаляется полностью. `renderSnippet` теряет ветку `type === 'number' && unit`.

**Hard-reject legacy-типов:**
- **D-03:** Валидация — в `SnippetService.load` и `SnippetService.listFolder`. Если JSON распарсился, но содержит плейсхолдер с `type ∈ {'number','multichoice','multi-choice'}` ИЛИ `type === 'choice'` без валидного `options: string[]` — возвращают `JsonSnippet` с обязательным новым полем `validationError: string`. Валидный snippet → `validationError: null`. Syntax-broken JSON остаётся silent-skip как сейчас. **GraphValidator-level check не вводится** в этой фазе.
- **D-04:** Две поверхности ошибки:
  - **SnippetEditorModal** — красный banner над формой, «Сохранить» заблокирована, форма read-only.
  - **RunnerView error-panel** — при попытке загрузки битого snippet показывает русский текст с `nodeId`, путём и именем удалённого типа.
  - SnippetManagerView tree в фазе НЕ меняется визуально.

**UI unified `choice`:**
- **D-05:** `snippet-fill-in-modal.ts` рендерит `choice` как checkbox-список. `renderChoiceField(..., isMulti=true)` всегда. `renderNumberField` удаляется. Empty = `''`.
- **D-06:** Phase 31 D-09 «Custom:» free-text override остаётся как есть.
- **D-08:** Сломанный options-list editor — **исследователь/планировщик локализует в dev-вауле**. Hypothesis order: chip-editor `renderOptionRows` → legacy snippet-manager-view → уже починено Phase 33 MODAL-06.

**Неизменное:**
- **D-09:** Пустой выбор в unified `choice` = пустая строка.
- Phase 27 D-02 цветовая палитра: `PH_COLOR` сужается до 2 ключей (планировщик решает — удалить или оставить dead-safe).
- Phase 51 D-14 auto-insert продолжает работать; `validationError` guard добавляется.

### Claude's Discretion

- Точный текст русских ошибок для D-04 banner + runner error-panel (по образцу Phase 50.1 D-04..D-08).
- `validationError: string | null` vs `string | undefined` (рекомендация: `string | null` для exhaustiveness).
- Удалять ли ключи `'multi-choice'` и `'number'` из `PH_COLOR`.
- Отдельный `kind: 'invalid-json'` в union vs поле на `JsonSnippet`.
- Вёрстка banner-ошибки в SnippetEditorModal.
- Runner state при попытке auto-insert битого snippet (non-fatal Notice vs `error` state).

### Deferred Ideas (OUT OF SCOPE)

- Marker для битых сниппетов в SnippetManagerView tree (красная точка / иконка).
- `required` семантика на placeholder.
- `separator` переопределение пользователем во время fill-in.
- Авто-миграция legacy `.json`-сниппетов.
- `unit`-feature в другой форме.
- «Архивировать» кнопка в editor-banner.
- Marker нового формата (`schemaVersion: 2`).
</user_constraints>

## Project Constraints (from CLAUDE.md)

| Directive | Applies To Phase 52 |
|-----------|---------------------|
| CSS is append-only per phase in `src/styles/*.css` | If banner needs CSS, add to `src/styles/snippet-manager.css` with `/* Phase 52: banner */` comment at bottom; **never** edit `styles.css` directly (generated by esbuild) |
| Run `npm run build` after any CSS change | Mandatory |
| Never remove existing code you didn't add | Critical for shared files: `src/main.ts`, `src/views/editor-panel-view.ts`, `src/views/snippet-manager-view.ts`, `src/styles/*`, `src/views/snippet-chip-editor.ts`, `src/views/snippet-fill-in-modal.ts`, `src/views/snippet-editor-modal.ts` |

Violations detected in planning must block plan acceptance.

## Standard Stack

No new dependencies required for Phase 52. All work uses the existing project stack:

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `obsidian` | peer | Modal, App, Notice, TFile | [VERIFIED: imported across snippet-* files] |
| `vitest` | existing | Unit tests | [VERIFIED: `npx vitest run src/__tests__/snippet-model.test.ts` passes 10/10 on current tree] |
| DOM API (no innerHTML) | native | Element creation via `createEl`/`createDiv` | [VERIFIED: chip-editor uses `container.createEl` pattern throughout] |

**Version verification:** No new packages — no registry lookup needed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                 SnippetService (single I/O entrypoint)          │
│  .load(path)        → Snippet | null        silent on corrupt   │
│  .listFolder(path)  → {folders, snippets}   silent on corrupt   │
│                                                                 │
│  [Phase 52 change]  BOTH now return JsonSnippet with            │
│                     validationError: string | null on legacy    │
│                     type detection (D-03 contract)              │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Snippet (with validationError)
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐        ┌──────────────────┐       ┌──────────────────┐
│ runner-view  │        │ snippet-manager  │       │ snippet-editor   │
│ .load  x2    │        │ listFolder       │       │   -modal         │
│ .listFolder  │        │ (tree build)     │       │ (opens chip-edit)│
│              │        │ — Phase 52       │       │                  │
│ On error:    │        │ NO tree marker   │       │ On error:        │
│ renderError  │        │ (Deferred)       │       │ banner above     │
│ (existing    │        │                  │       │ form + disabled  │
│  pattern     │        │                  │       │ save + read-only │
│  l. 985-998) │        │                  │       │ chip editor      │
└──────────────┘        └──────────────────┘       └──────────────────┘
                                                         │
                                                         ▼
                                              ┌───────────────────────┐
                                              │ snippet-chip-editor   │
                                              │ — mountChipEditor()   │
                                              │                       │
                                              │ Phase 52 changes:     │
                                              │ • PH_COLOR → 2 keys   │
                                              │ • miniTypeSelect → 2  │
                                              │ • phTypesLocal → 2    │
                                              │ • DELETE renderNumber │
                                              │   Expanded()          │
                                              │ • DELETE 'number'     │
                                              │   branch in switch    │
                                              │ • rename joinSeparator│
                                              │   → separator + apply │
                                              │   to single+multi     │
                                              └───────────────────────┘

                   ┌────────────────────────────────────────┐
                   │ snippet-fill-in-modal                  │
                   │ renderField() — dispatch on ph.type:   │
                   │                                        │
                   │ Phase 52 simplification:               │
                   │  'free-text' → renderFreeTextField     │
                   │  'choice'    → renderChoiceField(true) │
                   │                                        │
                   │ DELETE: renderNumberField()            │
                   │ DELETE: 'number' + 'multi-choice' arms │
                   │ RENAME: joinSeparator → separator      │
                   └────────────────────────────────────────┘
```

### Recommended Project Structure (unchanged)

Phase 52 modifies existing files only. No new modules.

```
src/
├── snippets/
│   ├── snippet-model.ts       [union + renderSnippet + SnippetPlaceholder]
│   └── snippet-service.ts     [load + listFolder + sanitizeJson]
├── views/
│   ├── snippet-chip-editor.ts      [PH_COLOR + placeholder form]
│   ├── snippet-fill-in-modal.ts    [renderField dispatch + renderChoiceField]
│   ├── snippet-editor-modal.ts     [banner surface]
│   ├── snippet-manager-view.ts     [NO CHANGES — listFolder consumer only]
│   ├── snippet-tree-picker.ts      [NO CHANGES — listFolder consumer only, but must tolerate validationError: snippets still appear in tree; bug surfaces on click → editor banner]
│   └── runner-view.ts              [handleSnippetFill + handleSnippetPickerSelection guards; error-panel reuse]
└── __tests__/
    └── snippet-model.test.ts  [replace 'number'/'multi-choice' fixtures with new union]
```

### Pattern 1: Validation error-banner in Modal (paralleling Phase 33 collision-error)

**What:** Red text above form + disabled `mod-cta` button + title attribute on the disabled button
**Where:** Same shape as `COLLISION_ERROR_TEXT` in `snippet-editor-modal.ts:42` + `updateCollisionUI` at `:431-445`
**Example (verified pattern):**

```typescript
// Source: src/views/snippet-editor-modal.ts:431-445 [VERIFIED]
private updateCollisionUI(): void {
  if (!this.collisionErrorEl || !this.saveBtnEl) return;
  if (this.hasCollision) {
    this.collisionErrorEl.style.display = '';
    this.saveBtnEl.disabled = true;
    this.saveBtnEl.setAttribute('title', 'Устраните конфликт имени, чтобы сохранить.');
  } else {
    this.collisionErrorEl.style.display = 'none';
    this.saveBtnEl.disabled = false;
    this.saveBtnEl.removeAttribute('title');
  }
}
```

For Phase 52 D-04: add `validationErrorEl` field, render a new `<div class="radi-snippet-editor-validation-error">` above `contentRegionEl`, and in `onOpen` after `renderContentRegion()` check `if (this.draft.kind === 'json' && (this.draft as JsonSnippet).validationError !== null)` — disable save, set title, hide the chip editor (or render chip-editor wrapper `aria-disabled="true"` + pointer-events:none; planner's choice).

### Pattern 2: Runner error-panel (for D-04 Runner surface)

**What:** `<ul class="rp-error-list">` inside a `rp-validation-panel` wrapped by `rp-question-zone`
**Where:** `src/views/runner-view.ts:985-998` — verbatim reuse target
**Example (verified code, to reuse for validationError surfacing):**

```typescript
// Source: src/views/runner-view.ts:985-998 [VERIFIED]
private renderError(errors: string[]): void {
  this.contentEl.empty();
  if (this.selectorBarEl !== null) {
    this.contentEl.prepend(this.selectorBarEl);
  }
  const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
  const questionZone = root.createDiv({ cls: 'rp-question-zone rp-validation-panel' });
  questionZone.createEl('p', { text: 'Protocol error' });
  const ul = questionZone.createEl('ul', { cls: 'rp-error-list' });
  for (const err of errors) {
    ul.createEl('li', { text: err });
  }
}
```

**Important:** `renderError` currently clears `contentEl` — this is acceptable for terminal `case 'error':` at runner-view:614-617. For Phase 52 surfaces inside `handleSnippetFill` (`runner-view.ts:782`) and `handleSnippetPickerSelection` (`runner-view.ts:732`), planner should choose between: (A) re-use `renderError` as full-screen takeover (symmetric with GraphValidator errors); (B) inline-render inside `questionZone.empty(); questionZone.createEl('p', {cls: 'rp-empty-state-body', ...})` similar to the existing «Snippet not found» / «Сниппет не найден» path at `runner-view.ts:694-700` and `:799-805`. **Recommendation:** use (A) `renderError` path for parity with GraphValidator LOOP-04 / Phase 51 D-04, switching runner to `error` status (pitfall: this ends the session — see Open Questions #1).

### Anti-Patterns to Avoid

- **Don't silently coerce legacy `'multi-choice'` to `'choice'` at parse time.** User locked D-02 / D-03 on explicit-reject; auto-migration is Out-of-Scope.
- **Don't introduce a per-snippet `validationError` flag on `MdSnippet`.** MD snippets have no placeholders → nothing to validate. Restrict the new field to `JsonSnippet` only.
- **Don't edit `styles.css`.** It is esbuild-generated from `src/styles/*`. CLAUDE.md rule.
- **Don't delete `renderNumberField` / `renderNumberExpanded` without also removing all test references** to `'number'` + `'unit'` in `snippet-model.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal banner + disabled save pattern | New bespoke `ValidationBanner` class | Reuse Phase 33 `collisionErrorEl` + `saveBtnEl.disabled` pattern (`snippet-editor-modal.ts:431-445`) | Already tested, CLAUDE-compliant, identical UX vocabulary |
| Runner error surfacing | New error modal | Reuse `renderError(errors: string[])` at `runner-view.ts:985-998` | Exactly how GraphValidator LOOP-04 + Phase 51 D-04 surface errors — consistency |
| Error-text localisation | Custom i18n helper | Inline Russian strings literal (project convention — Phase 50.1 D-04..D-08) | Project has no i18n library; every error-path uses inline ru-RU verbatim strings |
| Russian error-text format | New format | Follow Phase 50.1 template: `{Субъект} "{label}": {проблема} — {предписание}.` | See `.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` D-04..D-08 — 5 locked texts; planner mirrors this format for D-04 banner + runner-panel |

**Key insight:** Every part of Phase 52's surface pattern (banner + disabled CTA + read-only form; runtime error panel) already has a battle-tested precedent in the codebase. The risk isn't «designing a banner», it's «wiring `validationError` to the right number of consumers without orphaning one».

## Runtime State Inventory (not applicable)

**Category:** Not a rename/refactor/migration phase in the runtime-state sense.

- **Stored data:** None — `.json` snippets contain schema data but user confirmed no legacy snippets exist in their vault (REQUIREMENTS.md Out-of-Scope row 2). Hard-reject path surfaces the error for unexpected legacy files; no migration runs.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets and env vars:** None.
- **Build artifacts:** `styles.css` is regenerated by `npm run build`; esbuild output `main.js` deploys to TEST-BASE vault via `devVaultCopyPlugin` — unchanged by this phase.

## D-08 Bug Repro Report

> **Verdict: NOT REPRODUCIBLE on the current tree.** Static analysis of `src/views/snippet-chip-editor.ts:390-426` shows correct add/edit/remove semantics. The D-08 bug description in ROADMAP Goal text reflects pre-Phase-33 status.

### Evidence — Static Analysis of `renderOptionRows` + `+ Add option`

**Source:** `src/views/snippet-chip-editor.ts:390-426` [VERIFIED via direct read]

```typescript
const renderOptionRows = (): void => {
  optionList.empty();                                     // (1) clear existing rows
  const options = ph.options ?? [];
  options.forEach((opt, oi) => {
    const optRow = optionList.createDiv({ cls: 'rp-option-row' });
    // ...
    const optInput = optRow.createEl('input', { type: 'text' });
    optInput.id = `rp-opt-${ph.id}-${oi}`;
    optInput.value = opt;                                 // (2) populate from array
    optInput.placeholder = `Option ${oi + 1}`;
    on(optInput, 'input', () => {                         // (3) input listener
      if (ph.options) ph.options[oi] = optInput.value;    //     mutates array
      onChange();                                         //     dispatches unsaved
    });
    const removeOptBtn = optRow.createEl('button', { text: '×' });
    on(removeOptBtn, 'click', () => {
      ph.options?.splice(oi, 1);                          // (4) remove entry
      renderOptionRows();                                 //     full re-render
      onChange();
    });
  });
};
renderOptionRows();

const addOptionBtn = optionsSec.createEl('button', { text: '+ Add option' });
on(addOptionBtn, 'click', () => {
  if (!ph.options) ph.options = [];
  ph.options.push('');                                    // (5) push empty string
  renderOptionRows();                                     //     full re-render
  onChange();
});
```

All four operations (add, edit, reorder-via-drag, remove) are present and semantically correct:
- **Add:** push empty string + re-render + onChange (step 5)
- **Edit:** `input` listener writes `optInput.value` back into the array at index `oi` (step 3) — note it uses the captured closure index, so re-renders don't stale-capture
- **Remove:** `splice(oi, 1)` + re-render + onChange (step 4)
- **Reorder:** chip-level drag — applies to placeholder chips (whole ph list) at `:255-285`; no per-option reorder exists but SC 2 explicitly lists add/edit/reorder/remove — «reorder» here means the placeholder list, not options-within-a-placeholder. Planner should confirm this reading with user or scope reorder-options as deferred.

### Hypothesis Check

| Hypothesis (CONTEXT D-08) | Verdict | Evidence |
|---|---|---|
| (1) Chip-editor options-list has focus / onChange bug | **FALSIFIED** | Static read shows correct `on(optInput, 'input', ...)` listener; same `on()` tracking pattern as other working sections (name input l.104, template textarea l.119) |
| (2) Legacy `snippet-manager-view.ts` has a parallel placeholder editor still reachable | **FALSIFIED** | Grep of `snippet-manager-view.ts` for `placeholder\|SnippetPlaceholder\|PH_COLOR\|'number'\|'choice'` returns **zero hits** except one unrelated string-literal at `:515` (`'например: обследования'`, a search-field placeholder). The legacy editor was removed during Phase 33. All snippet editing routes through `SnippetEditorModal` (see `snippet-manager-view.ts:466-488` `openEditModal`), which mounts `mountChipEditor` (`snippet-editor-modal.ts:336-343`). |
| (3) Bug already fixed by Phase 33 MODAL-06 | **MOST LIKELY** | Consistent with both falsifications above. Phase 33 description says «MODAL-06 — Reusable placeholder chip editor extracted from legacy SnippetManagerView» (see chip-editor header comment, l.1-14). |

### Recommendation

- **No code-delta required to fix D-08.** SC 2 should be satisfied by a functional unit test suite covering add/edit/remove/reorder(-placeholders) + full-round-trip persistence through `SnippetService.save` → disk → `SnippetService.load`.
- Planner writes a new test file (or extends existing chip-editor tests if present) proving:
  1. `+ Add option` click creates a new empty option row that accepts input
  2. Typing in an existing option input mutates `draft.placeholders[i].options[j]`
  3. Clicking `×` on an option row removes it + persists after save/load roundtrip
  4. Drag-reordering placeholder chips preserves all options (regression guard against post-refactor)
- Dev-vault manual-UAT step: open SnippetEditorModal for a fresh JSON snippet, add a `choice` placeholder, add 3 options, edit middle one, remove last, save, close, reopen — all state preserved.
- If user reports still-broken behaviour in dev-vault despite this verdict: escalate to orchestrator; one of the two falsified hypotheses may have been false-falsified, or there's a third cause not in the hypothesis tree.

## Dead-Code Audit — Legacy Types

> Exhaustive list of every file+line that touches `'number'`, `'multichoice'`, `'multi-choice'`, `renderNumberField`, `renderNumberExpanded`, `joinSeparator`, `unit` (as `SnippetPlaceholder` field) within the snippet subsystem. Verified via Grep. [VERIFIED]

### `src/snippets/snippet-model.ts` — MUST UPDATE

| Line | Content | Action |
|------|---------|--------|
| 7 | `type: 'free-text' \| 'choice' \| 'multi-choice' \| 'number';` | Narrow to `'free-text' \| 'choice'` |
| 8 | `/** Predefined options for 'choice' and 'multi-choice' types (D-06) */` | Doc-comment: drop `and 'multi-choice'` |
| 10-11 | `/** Unit suffix ... */ unit?: string;` | DELETE |
| 12-13 | `/** Join separator for 'multi-choice' type ... */ joinSeparator?: string;` | DELETE; replace with `/** Separator between values when multiple options selected. Default ', '. (D-02) */ separator?: string;` |
| 72-75 | `renderSnippet` JSDoc mentions unit + joinSeparator | Update to mention D-02 separator semantics only (caller no longer pre-joins; see D-05) |
| 89-91 | `if (placeholder.type === 'number' && placeholder.unit) { ... \`${raw} ${unit}\` }` | DELETE entire branch; `output = output.split(...).join(raw)` becomes unconditional |

### `src/snippets/snippet-service.ts` — MUST UPDATE

| Line | Content | Action |
|------|---------|--------|
| 487 | `unit: p.unit !== undefined ? clean(p.unit) : undefined,` | DELETE from sanitizeJson |
| 488 | `joinSeparator: p.joinSeparator !== undefined ? clean(p.joinSeparator) : undefined,` | REPLACE with `separator: p.separator !== undefined ? clean(p.separator) : undefined,` |
| 119 (load) | `const parsed = JSON.parse(raw) as Partial<JsonSnippet>;` | Still OK — but after parse, run new `validateLegacyTypes(parsed.placeholders)` helper before return; on hit, return snippet with `validationError: string` |
| 120-126 (listFolder) | `snippets.push({ kind: 'json', path, name, template, placeholders })` | Wrap with same legacy-validation; add `validationError: string \| null` field |
| 163-171 (load .json arm) | Same as above | Same — consolidate helper |
| 127-129 | `} catch { /* Corrupt file — skip silently. */ }` | Keep verbatim (D-03 explicit: syntax-broken JSON stays silent-skip) |

### `src/views/snippet-chip-editor.ts` — MUST UPDATE

| Line | Content | Action |
|------|---------|--------|
| 29-34 | `PH_COLOR` dictionary with 4 entries (`free-text`, `choice`, `multi-choice`, `number`) | Narrow to 2 entries — Claude's Discretion per CONTEXT (recommendation: delete dead keys since TS union narrowing makes them unreachable) |
| 143-148 | `phTypes` array for `miniTypeSelect` — 4 entries | Narrow to 2 entries (`free-text`, `choice`) |
| 191-199 | New-placeholder creation logic with branches on `phType === 'number'` and `phType === 'multi-choice'` | Simplify: options always `[]` for `choice`; no joinSeparator init; no unit init |
| 192-198 | `...(phType === 'multi-choice' ? { joinSeparator: ', ' } : {})` + `...(phType === 'number' ? { unit: '' } : {})` | DELETE both spreads; keep `...(phType === 'choice' ? { options: [] } : {})` |
| 294-298 | `if (ph.type === 'number') { renderNumberExpanded(ph, chip); } else { renderExpandedPlaceholder(...); }` | Simplify — always `renderExpandedPlaceholder` |
| 351-356 | `phTypesLocal` array for type-change dropdown — 4 entries | Narrow to 2 |
| 362-377 | Type-change handler with branches on `'choice' \| 'multi-choice'`, `'number'`, and `else` | Simplify: only `'choice'` → init options; only `'free-text'` → clear options |
| 368 | `if (ph.type === 'choice') ph.joinSeparator = undefined;` | Obsolete after D-02 rename; replace logic with `separator` default (or delete — per D-02 separator applies always when multiple values) |
| 429-442 | Join-separator section — only rendered for `ph.type === 'multi-choice'` | RENAME «Join separator» → «Разделитель» (planner decides ru-RU copy); RENDER for all `choice` (D-02: separator applies to single+multi identically per D-05 semantics); RENAME field from `joinSeparator` to `separator` |
| 445-463 | `renderNumberExpanded` function | DELETE entire function |

### `src/views/snippet-fill-in-modal.ts` — MUST UPDATE

| Line | Content | Action |
|------|---------|--------|
| 91-97 | `renderField` dispatch — 4 branches (`free-text`, `number`, `choice`, `multi-choice`) | Narrow to 2: `'free-text'` → `renderFreeTextField`; `'choice'` → `renderChoiceField(..., true)` |
| 113-129 | `renderNumberField` function | DELETE entire function |
| 119 | `label.textContent = placeholder.label + (placeholder.unit ? \` (${unit})\` : '');` | Dead after deletion above |
| 136-212 | `renderChoiceField(container, placeholder, isMulti: boolean)` | Drop `isMulti` param (always true); or keep param for zero-diff but inline-call with `true` — planner decides. Replace `placeholder.joinSeparator ?? ', '` at l.160 with `placeholder.separator ?? ', '` (D-02 rename) |
| 162-165 | `else` branch for `!isMulti` single-radio path | DELETE (always isMulti under D-05) |
| 176 | `const inputType = isMulti ? 'checkbox' : 'radio';` | Always `'checkbox'` |

### `src/__tests__/snippet-model.test.ts` — MUST UPDATE

| Line | Content | Action |
|------|---------|--------|
| 14-19 | Test `has optional unit field for number placeholders` | DELETE entire `it(...)` |
| 21-26 | Test `has optional joinSeparator field for multi-choice placeholders` | REPLACE — test `has optional separator field for choice placeholders` with new field name |
| 39 | `{ id: 'size', label: 'Size', type: 'number', unit: 'mm' }` | REMOVE placeholder; update template to drop `{{size}}` |
| 48-51 | Test `renders number placeholder with unit suffix` | DELETE |
| 60-69 | Test `joins multi-choice values with joinSeparator` | REWRITE — test `renderSnippet for choice with multiple values pre-joined by caller` (since renderSnippet takes already-joined string per D-05/D-07 new contract — caller in fill-in modal pre-joins with `placeholder.separator`) |

### Does the `kind: 'invalid-json'` alternative matter?

Claude's Discretion option (CONTEXT): «отдельный `kind: 'invalid-json'` в `Snippet` дискриминированном union vs поле на существующем `JsonSnippet`». **Recommendation: field on existing `JsonSnippet`**, reason:
- Every current call-site already branches `if (snippet.kind === 'json') ... else if (snippet.kind === 'md')` (see `runner-view.ts:747, 813`; `snippet-editor-modal.ts:202, 334`). Adding a third arm `'invalid-json'` forces every exhaustiveness-check to add a new case — larger blast radius.
- `validationError: string | null` is the minimal-diff: existing call-sites read `snippet.placeholders`, `snippet.template` etc. unchanged; only new surfaces (editor modal + runner) additionally check `validationError !== null` before use.
- Trade-off: typechecker won't force consumers to handle the error case. **Mitigation:** add a helper `isValidJsonSnippet(s: Snippet): s is JsonSnippet & { validationError: null }` used at all critical surfaces.

## SnippetService.load / listFolder — Current Flow & Call Sites

### Current silent-skip (verified)

**`listFolder`** at `src/snippets/snippet-service.ts:114-144`:
```typescript
for (const filePath of listing.files) {
  const basename = this.basenameNoExt(filePath);
  if (filePath.endsWith('.json')) {
    try {
      const raw = await this.app.vault.adapter.read(filePath);
      const parsed = JSON.parse(raw) as Partial<JsonSnippet>;
      snippets.push({
        kind: 'json',
        path: filePath,
        name: basename,
        template: parsed.template ?? '',
        placeholders: parsed.placeholders ?? [],
      });
    } catch {
      // Corrupt file — skip silently.   ← LINE 127-129 (CONTEXT reference point)
    }
  } else if (filePath.endsWith('.md')) { ... }
}
```

**`load`** at `:155-180` — same pattern, `JSON.parse` failure → return `null`.

### Phase 52 Target Flow

1. After successful `JSON.parse`, run a new synchronous helper `validatePlaceholders(parsed.placeholders)`:
   - Iterate placeholders; for each, check `type ∈ {'number', 'multichoice', 'multi-choice'}` OR (`type === 'choice'` AND (`!Array.isArray(options)` OR `options.length < 1`))  → collect offender(s).
   - Return `null` if clean, else a Russian error string (D-04 format, see Banner Copy § below).
2. In `load`: push `snippet` with `validationError` set from helper.
3. In `listFolder`: same — snippet still appears in listing with `validationError` populated.
4. `JSON.parse` catch block (`:127-129`, `:177-179`): **unchanged** — syntax-broken remains silent-skip per D-03.

### All Call Sites — Exhaustive List

| File:line | Call | Current behavior on `null` | Required Phase 52 change |
|-----------|------|----------------------------|---------------------------|
| `src/views/runner-view.ts:684` | `snippetService.load(absPath)` in `renderSnippetPicker` row-click | Inline-empty picker with `«Сниппет не найден: …»` | Add branch: `if (snippet !== null && snippet.kind === 'json' && snippet.validationError !== null) → render runner error-panel via renderError + switch runner to error status` |
| `src/views/runner-view.ts:797` | `snippetService.load(absPath)` in `handleSnippetFill` | Inline-empty `«Snippet '…' not found.»` | Same guard, before the `snippet.kind === 'md'` check at :813 — path-shape detection (Phase 51 D-14 at :788-795) stays BEFORE validationError check (detection is just string analysis; file-system hit happens on `.load()`) |
| `src/views/snippet-manager-view.ts:198` | `snippetService.listFolder(folderPath)` in `buildTreeChildren` | Returns empty on try/catch | **NO UI CHANGE** per D-04 (tree untouched). Tolerate `validationError` on snippet objects — they appear in tree; error visible only on click (opens editor → banner fires) |
| `src/views/snippet-manager-view.ts:467` | `snippetService.load(path)` in `openEditModal` | `Notice('Сниппет не найден.')` + rebuild tree | Already opens SnippetEditorModal — modal's `onOpen` detects `validationError` and renders banner; no change needed here |
| `src/views/snippet-editor-modal.ts` | (No direct `.load`/`.listFolder` call; receives snippet via `options.snippet`) | — | **Banner logic** lives in `onOpen` / `renderContentRegion` — new state check for `this.draft` as `JsonSnippet & { validationError: string }` |
| `src/views/snippet-tree-picker.ts:239` | `snippetService.listFolder(currentAbsPath())` | Empty on throw | **NO UI CHANGE** — tolerate `validationError` (file still listed; picker drill works; bug surfaces on final click path via runner-view guard) |
| `src/__tests__/views/runner-snippet-picker.test.ts:316` etc. | Mocks `snippetService.load` returning fake snippets | — | Update mock fixtures to include `validationError: null` on valid paths; add new test for `validationError !== null` branch |
| `src/__tests__/snippet-vault-watcher.test.ts:217-267` | Mocks `snippetService.listFolder` call-tracking | — | No API-surface change; field-presence check may need mock-data update if tests inspect returned snippet shape |

**Planner checklist:** 4 runtime consumers × 2 paths each = **8 integration points** where `validationError` must be branched or tolerated. The most common slip is missing `snippet-tree-picker.ts:239` (search results in file-only mode would happily list a broken `.json` and click-commit before reaching runner guards if the click-handler skipped the guard). Runner is the last-line-of-defence; planner should explicitly document that Picker does NOT filter and Runner DOES reject.

## Auto-insert Integration with `validationError`

### Current Phase 51 D-13/D-14 dispatch

**Location:** `src/runner/protocol-runner.ts:568-619`, inside `case 'question':` in the state-advance loop.

[VERIFIED — read above]

The D-13/D-14 path-shape check happens at `protocol-runner.ts:580-613`. When triggered, it sets `runnerStatus = 'awaiting-snippet-fill'` with `snippetId = onlyNeighbour.radiprotocol_snippetPath` (a path relative to snippetFolderPath). **The file has not yet been loaded at this point** — only the path is set. Loading happens downstream in `runner-view.ts:797` via `handleSnippetFill`.

### `handleSnippetFill` Path-Shape Dispatch (Phase 51 D-14)

**Location:** `src/views/runner-view.ts:788-795`
```typescript
const isPhase51FullPath =
  snippetId.includes('/') ||
  snippetId.endsWith('.md') ||
  snippetId.endsWith('.json');
const root = this.plugin.settings.snippetFolderPath;
const absPath = isPhase51FullPath
  ? `${root}/${snippetId}`
  : `${root}/${snippetId}.json`;  // Phase 32 D-03 legacy composition

const snippet = await this.plugin.snippetService.load(absPath);  // :797
```

### Where to Insert the `validationError` Guard

**Recommendation:** After `snippet === null` check at `:799`, before `snippet.kind === 'md'` check at `:813`.

```typescript
// After line 806 (the existing null-guard closes), add:
if (snippet.kind === 'json' && snippet.validationError !== null) {
  // Option A (recommended): full error-panel takeover
  this.renderError([snippet.validationError]);
  this.runner.setError(snippet.validationError);  // transition runner to status:'error'
  return;
}
```

The path-shape split (`.md` vs `.json`) happens AFTER this guard — irrelevant for validation (MD snippets have no placeholders, no legacy types to reject). The guard fires only for `.json`.

**Mirror location for non-auto-insert (Phase 51 D-16 sibling-button / manual picker click):** `handleSnippetPickerSelection` at `src/views/runner-view.ts:732-779`. The path here is post-`.load` (loaded in `renderSnippetPicker` `onSelect` callback at :684-702); planner adds the `validationError` guard inside `handleSnippetPickerSelection` **before** the `.kind === 'md'` check at :747 (or alternatively in the caller at :702 before calling `handleSnippetPickerSelection`). **Recommendation:** place guard in the **caller** (inside `onSelect` at :683-703), inline-render error message via existing `questionZone` pattern (:694-700) — this keeps `handleSnippetPickerSelection` focused on the happy path and uses the already-proven «Сниппет не найден» surface for symmetry. But CONTEXT D-04 says «RunnerView error-panel» — which implies full `renderError` takeover. Planner decides: inline (lighter, matches existing «not found» UX) vs takeover (heavier, matches GraphValidator LOOP-04).

### Runner state at auto-insert failure (Claude's Discretion per CONTEXT)

Two options from CONTEXT:
- **Non-fatal Notice:** `new Notice(snippet.validationError)` + call `this.runner.stepBack()` → returns to Question. User sees notice, can pick another path.
- **`error` state:** `this.runner.setError(...)` + `renderError([...])` — session ends.

**Recommendation:** non-fatal Notice + stepBack for auto-insert (D-14) path; `error` state for explicit user-click path (D-16 / picker click). Rationale: auto-insert was user-invisible; dropping them out mid-session is surprising. Explicit click = user made a choice, seeing a blocking error is expected. Planner confirms with user during plan-phase if this split is acceptable.

## Error-Panel Precedent — Concrete Code Snippet

### Phase 50.1 D-04..D-08 format to mirror

Source: `.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` §D-04..D-08

Template pattern:
```
{Субъект} "{label}": {описание проблемы} — {императивное предписание}.
```

### Phase 51 D-04 file-not-found precedent

Source: `.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md` §D-04:
> GraphValidator emits a **hard validation error** at canvas-open when `radiprotocol_snippetPath` references a file that does not exist. Error surfaces in the RunnerView error panel, same pattern as Phase 50.1 D-04..D-08. Error text is a new Russian string to be finalised in PLAN.md; it must name the `nodeId` and the invalid relative path, matching the style of the five locked `LOOP-04` texts.

### Suggested Russian copy for Phase 52 D-04 (PLANNER LOCKS IN PLAN.md)

> **Claude's Discretion per CONTEXT — planner finalises during plan-phase.** Recommended baseline:

**Banner (SnippetEditorModal):**
```
Сниппет "{snippet.name}" использует удалённый тип плейсхолдера: "{ph.type}" (плейсхолдер "{ph.id}"). Файл не может быть использован в Runner. Пересоздайте плейсхолдер вручную — автоматическая миграция не выполняется.
```

**Runner error-panel (D-04 Runner surface):**
```
Snippet-узел "{nodeId}": сниппет "{snippet.path}" использует удалённый тип плейсхолдера "{ph.type}". Обновите сниппет в редакторе — автоматическая миграция не выполняется.
```

Claude's Discretion on exact wording; format must:
- Name the subject (`Сниппет "..."` or `Snippet-узел "..."`) — parallels Phase 50.1 `Loop-узел "..."`.
- Specify the offending `type` literal string (quote it).
- Reference the placeholder id where applicable.
- Close with imperative предписание + «автоматическая миграция не выполняется» hint (mirrors Out-of-Scope user contract).

## Model & Render — TypeScript Changes

### Proposed new `SnippetPlaceholder` (Wave 1)

```typescript
// src/snippets/snippet-model.ts — Phase 52
export interface SnippetPlaceholder {
  id: string;
  label: string;
  type: 'free-text' | 'choice';                        // D-01: union narrowed
  /** Predefined options for 'choice' type (D-06) */
  options?: string[];
  /** Separator between values when multiple options selected.
   *  Default: ', '. Applies to unified choice (single or multi-select).
   *  (D-02, D-05) */
  separator?: string;
}
```

### Proposed new `JsonSnippet` (Wave 0 — added BEFORE Wave 1 union narrowing)

```typescript
export interface JsonSnippet {
  readonly kind: 'json';
  path: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
  /**
   * Phase 52 D-03: non-null when the .json file on disk declares a legacy
   * placeholder type ('number', 'multichoice', 'multi-choice') or a 'choice'
   * without valid options. Consumers MUST branch before rendering.
   */
  validationError: string | null;
  /** @deprecated D-02: basename is source of truth. */
  id?: string;
}
```

### Proposed new `renderSnippet` body (D-05 / D-07)

After D-07 deletes `unit` and D-05 moves joining to the caller (fill-in modal pre-joins via `separator`):

```typescript
export function renderSnippet(snippet: JsonSnippet, values: Record<string, string>): string {
  let output = snippet.template;
  for (const placeholder of snippet.placeholders) {
    const raw = values[placeholder.id] ?? '';
    output = output.split(`{{${placeholder.id}}}`).join(raw);
  }
  return output;
}
```

**Note on contract change:** Today's fill-in modal already pre-joins multi-choice values before passing to `values[id]` (see `snippet-fill-in-modal.ts:157-161`), and today's `renderSnippet` has special-case for `number + unit` only. After Phase 52, `renderSnippet` becomes unambiguously pure string-replace. Test `joins multi-choice values with joinSeparator` at `snippet-model.test.ts:60-69` passes a **pre-joined** string — the new version will pass this same test unchanged.

## Fill-in Modal — Unified `choice` Rendering

### Current `renderField` dispatch (4 branches)

`src/views/snippet-fill-in-modal.ts:86-98` [VERIFIED]
```typescript
if (placeholder.type === 'free-text') { this.renderFreeTextField(...); }
else if (placeholder.type === 'number') { this.renderNumberField(...); }
else if (placeholder.type === 'choice') { this.renderChoiceField(..., false); }
else if (placeholder.type === 'multi-choice') { this.renderChoiceField(..., true); }
```

### Phase 52 simplified dispatch (2 branches)

```typescript
if (placeholder.type === 'free-text') { this.renderFreeTextField(...); }
else if (placeholder.type === 'choice') { this.renderChoiceField(..., /* isMulti */ true); }
```

### Separator field rename inside `renderChoiceField`

Line 160 [VERIFIED]: `const sep = placeholder.joinSeparator ?? ', ';` → `const sep = placeholder.separator ?? ', ';`

All other logic (checkbox iteration, custom-override, preview refresh) preserved byte-identical.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | Not explicitly verified — project has `npx vitest run` working (verified via `src/__tests__/snippet-model.test.ts` 10/10 pass). Likely `vitest.config.ts` at repo root. |
| Quick run command | `npx vitest run src/__tests__/snippet-model.test.ts` |
| Full suite command | `npm test` |
| Test scaffold | `src/__tests__/*.test.ts` flat + `src/__tests__/views/*.test.ts` + `src/__tests__/runner/*.test.ts` subdirs |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHLD-01 SC 1 | Union narrowed to 2 types; `separator` field on `SnippetPlaceholder`; `renderSnippet` has no unit-branch | unit | `npx vitest run src/__tests__/snippet-model.test.ts` | ✅ (rewrite) |
| PHLD-01 SC 2 | options-list add/edit/remove/persist roundtrip | integration | `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts` | ❌ Wave 0 — new file |
| PHLD-01 SC 3 | Runner fill-in modal renders unified choice as multi-select; `separator` join default + override; empty = `''` | unit | `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` | ❌ Wave 0 — new file |
| PHLD-01 SC 4 | `SnippetService.load` / `.listFolder` return `validationError: string` for legacy types; banner renders in SnippetEditorModal; runner error-panel renders on `.load` in `handleSnippetFill` + picker-click | integration | `npx vitest run src/__tests__/snippet-service-validation.test.ts` + `src/__tests__/views/runner-snippet-picker.test.ts` | ❌ Wave 0 (new snippet-service-validation.test.ts) + ✅ extend existing runner-snippet-picker.test.ts |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/snippet-service-validation.test.ts` (< 5s expected)
- **Per wave merge:** `npm test` (full suite; baseline after Phase 51 was 506/1/0 per STATE.md)
- **Phase gate:** Full suite green + build green before `/gsd-verify-work`

### Observable Signals Per SC / Decision

| Signal | Proves | Test type | Status |
|--------|--------|-----------|--------|
| `SnippetPlaceholder['type']` narrowed to 2 values via `satisfies` or exhaustiveness-check | D-01 | tsc-only; 0 runtime | augment snippet-model.test.ts |
| `separator` field exists on `SnippetPlaceholder`; `joinSeparator` absent | D-02 | unit | augment snippet-model.test.ts |
| `renderSnippet` for `{type:'number', unit:'mm'}` no longer appends unit (compile-time: test fixture won't typecheck) | D-07 | tsc + unit | rewrite existing test at :48 |
| `SnippetService.load(".json with type='number'")` returns `{validationError: non-null}` | D-03 | integration | NEW: `snippet-service-validation.test.ts` |
| `SnippetService.listFolder(…)` returns snippets list where one has `validationError !== null` | D-03 | integration | NEW (same file) |
| SnippetEditorModal with `snippet.validationError !== null` disables save button + shows banner element | D-04 banner | jsdom integration | NEW: extend `snippet-editor-modal.test.ts` if present, else new |
| RunnerView `handleSnippetFill` with mocked `.load → {validationError}` renders error panel | D-04 runner | jsdom integration | NEW: extend `src/__tests__/views/runner-snippet-picker.test.ts` |
| SnippetFillInModal for `{type:'choice', separator:' / '}` with 2 checkboxes checked → joins with ` / ` | D-05 | jsdom | NEW: `snippet-fill-in-modal.test.ts` |
| SnippetFillInModal with 0 checked boxes + empty custom → `values[id] === ''` | D-05 + D-09 | jsdom | NEW (same file) |
| SnippetFillInModal Custom non-empty overrides checkboxes | D-06 | jsdom | NEW (same file) |
| Phase 51 D-14 auto-insert path loads snippet with `validationError` → runner shows error / Notice | D-04 + D-14 | integration | NEW: extend `src/__tests__/views/runner-snippet-picker.test.ts` |

### Wave 0 Gaps
- [ ] `src/__tests__/snippet-service-validation.test.ts` — D-03 integration coverage (new file)
- [ ] `src/__tests__/views/snippet-chip-editor.test.ts` — D-08 regression suite + options-list roundtrip (new file)
- [ ] `src/__tests__/views/snippet-fill-in-modal.test.ts` — D-05 / D-06 / D-09 coverage (new file, or extend if one exists — grep for `snippet-fill` in tests)
- [ ] Extend `src/__tests__/snippet-model.test.ts` — drop `'number'` / `'multi-choice'` fixtures; add `separator` cases
- [ ] Extend `src/__tests__/views/runner-snippet-picker.test.ts` — `validationError` branch in `handleSnippetFill` + picker click-path
- [ ] No framework install needed — vitest already in deps and green.

## Common Pitfalls

### Pitfall 1: Silently dropping `validationError` at test boundaries
**What goes wrong:** Tests mock `snippetService.load` returning `{kind: 'json', placeholders: [], template: '...'}` — old shape — and new code crashes with «Cannot read properties of undefined (reading 'validationError')»
**Why it happens:** Wave 0 needs to update ALL mock fixtures simultaneously with the type change
**How to avoid:** Add `validationError: null` to every mock fixture in all existing test files (see runner-snippet-picker.test.ts:316 and 479 — `fakeSnippet`). If field is non-optional, tsc will force it.
**Warning signs:** `TypeError: Cannot read properties of undefined` in test output for tests that used to pass.

### Pitfall 2: Forgetting one of 4 listFolder/load consumers
**What goes wrong:** SnippetTreePicker happily lists a broken `.json`; user clicks, runner crashes before guard
**Why it happens:** SnippetTreePicker uses `snippetService.listFolder` at `:239` and does its own row rendering — it doesn't go through SnippetEditorModal, so no banner
**How to avoid:** Runner is the last-line-of-defence. Document explicitly in D-04 runner guard that picker does NOT filter.
**Warning signs:** Phase 52 tests pass, but dev-UAT clicks a broken file in picker and hits runner crash.

### Pitfall 3: Breaking Phase 51 D-14 auto-insert path
**What goes wrong:** Guard inserted in wrong place — before path-shape detection → legacy id-string crashes; or after `.md` check → MD snippets incorrectly surface a stale `validationError` field
**Why it happens:** `handleSnippetFill` has 3 nested decisions (null-check, path-shape, kind-check)
**How to avoid:** Insert guard AFTER `snippet === null` check (line 799) and BEFORE `snippet.kind === 'md'` check (line 813). MD snippets don't carry the field at all (it's on `JsonSnippet` only); narrow with `snippet.kind === 'json' && snippet.validationError !== null`.
**Warning signs:** Existing Phase 51 runner-snippet-picker tests regress.

### Pitfall 4: Mutating `options` during fill-in separator field rename
**What goes wrong:** Chip-editor renames `joinSeparator` → `separator`, but fill-in modal still reads `joinSeparator`, or vice versa — field is present on-disk but modal sees `undefined`
**Why it happens:** Two files, two reads, easy to desync
**How to avoid:** Do model rename (Wave 1) + chip-editor rename (Wave 2) + fill-in modal rename (Wave 2) as a single atomic commit, not spread across phases. Add a unit test that round-trips a snippet with `{separator: '/'}` through save→load and confirms the field survives.

### Pitfall 5: Stale test fixtures breaking tsc
**What goes wrong:** `snippet-model.test.ts:39` uses `type: 'number'` literal — after union narrowing, tsc errors «'number' is not assignable to type 'free-text' | 'choice'»
**Why it happens:** Test files pin literal union values
**How to avoid:** Wave 0 should pre-scan test files for `'number'`, `'multi-choice'`, `unit:`, `joinSeparator:` literal mentions. Grep already enumerated:
  - `snippet-model.test.ts:16, 23, 39, 48, 60, 65` — edit
  - `snippet-vault-watcher.test.ts` — call-tracking only, no fixture change needed
  - `runner-snippet-picker.test.ts:316, 479` — `fakeSnippet` objects need `validationError: null` added

## Code Examples

### `validatePlaceholders` helper for SnippetService (proposed Wave 1)

```typescript
// src/snippets/snippet-model.ts — new export
export function validatePlaceholders(
  placeholders: unknown,
): string | null {
  if (!Array.isArray(placeholders)) return null;  // degenerate OK, modal handles empty
  const legacy = new Set(['number', 'multichoice', 'multi-choice']);
  for (const p of placeholders) {
    if (typeof p !== 'object' || p === null) continue;
    const ph = p as { type?: unknown; id?: unknown; options?: unknown };
    const type = ph.type;
    const id = typeof ph.id === 'string' ? ph.id : '<unknown>';
    if (typeof type === 'string' && legacy.has(type)) {
      return `Плейсхолдер "${id}" использует удалённый тип "${type}". Пересоздайте плейсхолдер вручную.`;
    }
    if (type === 'choice' && (!Array.isArray(ph.options) || (ph.options as unknown[]).length === 0)) {
      return `Плейсхолдер "${id}" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.`;
    }
  }
  return null;
}
```

### Banner injection in SnippetEditorModal (proposed)

```typescript
// src/views/snippet-editor-modal.ts — inside onOpen, after renderContentRegion()
if (this.draftKind === 'json') {
  const err = (this.draft as JsonSnippet).validationError;
  if (err !== null) {
    this.renderValidationBanner(contentEl, err);
    // Disable save + gray out chip-editor
    this.saveBtnEl.disabled = true;
    this.saveBtnEl.setAttribute('title', err);
    this.contentRegionEl.setAttribute('aria-disabled', 'true');
    this.contentRegionEl.style.pointerEvents = 'none';
    this.contentRegionEl.style.opacity = '0.5';
  }
}

// New method:
private renderValidationBanner(container: HTMLElement, msg: string): void {
  const banner = container.createDiv({ cls: 'radi-snippet-editor-validation-banner' });
  banner.setAttribute('role', 'alert');
  banner.textContent = msg;
  // CSS: new .radi-snippet-editor-validation-banner rule
  // in src/styles/snippet-manager.css appended with /* Phase 52 */ comment
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 placeholder types (`free-text`, `number`, `choice`, `multi-choice`) | 2 types (`free-text`, unified `choice`) | Phase 52 | Reduces UI complexity; author writes unit suffixes inline in template |
| `joinSeparator` applies only to `multi-choice` | `separator` applies to unified `choice` (used whenever >1 value) | Phase 52 | Consistent field name; single-select still uses separator if user somehow picks multiple via Custom |
| Silent-skip on legacy types | Hard-validation error with Runner + Editor surfaces | Phase 52 | Breaking change for ANY legacy snippet; user confirmed none exist |
| Phase 27 D-02 `PH_COLOR` 4 colours | 2 colours (cyan=free-text, orange=choice) | Phase 52 | Minor — Claude's Discretion on retaining dead entries |

**Deprecated/outdated:**
- `SnippetPlaceholder.unit` — removed entirely
- `SnippetPlaceholder.joinSeparator` — renamed to `separator`
- `renderNumberField` in fill-in modal — deleted
- `renderNumberExpanded` in chip-editor — deleted
- `'multi-choice'` / `'number'` literal string types — deleted

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-08 bug is not reproducible — Phase 33 MODAL-06 already fixed it (verified statically) | § D-08 Bug Repro | Moderate. If user reproduces the bug in dev-UAT, hypotheses need a 4th branch (e.g., CSS z-index issue hiding input click-target, vault-watcher rebuild race, Obsidian Modal framework quirk). Mitigation: plan-phase includes a dev-vault manual-UAT checkpoint before coding to confirm hypothesis 3. [ASSUMED] |
| A2 | Runner state transition for auto-insert failure = non-fatal Notice + stepBack (vs `error` state) | § Auto-insert guard | Low. User explicitly marked this as Claude's Discretion (CONTEXT §Claude's Discretion). Planner's decision, user confirms during plan-review. [ASSUMED] |
| A3 | SnippetTreePicker does not filter broken `.json` (last-line-of-defence = runner) | § All Call Sites | Low. Alternative = filter in picker, but that hides legitimate files the user may want to open-to-fix via Manager right-click. Better to let them appear in tree, error on use. [ASSUMED — user may disagree] |
| A4 | `validationError: string \| null` on `JsonSnippet` > separate `kind: 'invalid-json'` in union | § Model changes | Low. Planner confirms during plan-phase. Field approach has smaller blast radius. [ASSUMED] |
| A5 | PH_COLOR keys `'multi-choice'` and `'number'` should be **removed** (not kept as dead-code) | § Chip-editor changes | Low. TS union narrowing will make these entries unreferenceable; linter would flag. Remove for cleanliness. [ASSUMED — Claude's Discretion per CONTEXT] |
| A6 | Russian text format for D-04 banner and runner panel mirrors Phase 50.1 D-04..D-08 verbatim style | § Banner Copy | Low. Explicit CONTEXT instruction: «в стиле Phase 50.1». [CITED: CONTEXT §Claude's Discretion last bullet refers explicitly to Phase 50.1 D-04..D-08] |
| A7 | «Reorder» in SC 2 means reorder-placeholder-chips (already works), NOT reorder-options-within-placeholder (not implemented) | § D-08 Bug Repro recommendation | Moderate. If user expects option-level reorder, Wave 2 work expands. Verify with user during plan-phase. [ASSUMED] |

## Open Questions

1. **Runner state on auto-insert failure — Notice vs error state.**
   - What we know: CONTEXT explicitly marks this as Claude's Discretion. Two options listed (non-fatal Notice + stepBack, or `error` state).
   - What's unclear: User's preferred severity for this path.
   - Recommendation: Non-fatal Notice + stepBack for D-14 auto-insert path; `error` state for explicit D-16 picker-click path. Planner surfaces during plan review.

2. **«Reorder» granularity in SC 2.**
   - What we know: SC 2 reads «adding, editing, reordering, and removing options persists». Chip-editor supports reorder of placeholder-chips via drag, not of options-within-a-chip.
   - What's unclear: Whether user expects per-option reorder UI.
   - Recommendation: Read as placeholder-chip reorder only; confirm with user in plan-phase. If option-level reorder is needed, add to Wave 2.

3. **`validationError` on `MdSnippet`.**
   - What we know: MD snippets have no placeholders → no legacy types to reject.
   - What's unclear: Whether future schema drift in MD (e.g., front-matter validation) would benefit from a unified error field across `Snippet` union.
   - Recommendation: Restrict to `JsonSnippet`. If MD validation becomes a requirement, add then.

4. **Banner visual weight in SnippetEditorModal.**
   - What we know: D-04 wants read-only form + disabled save.
   - What's unclear: Full takeover (hide chip-editor entirely and show only banner + «Name» field for archive-rename) vs. gray-out + banner-at-top.
   - Recommendation: Gray-out + banner — lets user move the file to an archive folder via «Папка» picker without full-UI teardown. Planner chooses.

## Environment Availability

No new external dependencies. Existing tools audited:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | esbuild, vitest | ✓ (previous phases built + tested green, including this session's `npx vitest run`) | — | — |
| npm / npx | build + test CLI | ✓ | — | — |
| vitest | `npm test` | ✓ | 4.1.2 (from test run banner) | — |
| esbuild | `npm run build` | ✓ (Phase 51 built main.js deployed to TEST-BASE) | — | — |
| TypeScript compiler | tsc --noEmit | ✓ | — | — |
| Obsidian API (peer dep) | runtime imports | ✓ (compile-time only; runtime in dev-vault) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Security Domain

> `security_enforcement` config not explicitly checked — conservative default: include section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no user auth; single-vault plugin) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (file-system-level only via Obsidian vault) |
| V5 Input Validation | yes | Existing `sanitizeJson` strips U+0000–U+001F/U+007F (snippet-service.ts:479); validation-error strings displayed verbatim inside DOM via `element.textContent` (not `innerHTML`) per CLAUDE.md Standing Pitfall #3 |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JSON.parse on untrusted vault file | Tampering | Existing try/catch silent-skip (snippet-service.ts:127-129, 177-179); Phase 52 preserves this for syntax errors |
| Banner XSS via snippet name | Tampering | Use `element.textContent = msg` (NEVER `innerHTML`); sanitized names already strip control chars in `sanitizeJson` |
| Path traversal via snippet path in banner | Information Disclosure | `assertInsideRoot` (snippet-service.ts:48-64) normalises paths at I/O boundary; banner copy uses `snippet.path` post-normalisation |
| Runner replay of pre-validation snippet | Tampering | Guard at `handleSnippetFill` / `handleSnippetPickerSelection` rejects BEFORE any template substitution; `renderSnippet` is pure and never sees broken data |

## Sources

### Primary (HIGH confidence — verified this session)
- `src/snippets/snippet-model.ts` (113 lines, direct read)
- `src/snippets/snippet-service.ts` (493 lines, direct read — especially :86-180, :479-491)
- `src/views/snippet-chip-editor.ts` (494 lines, direct read — especially :28-34, :143-208, :291-443)
- `src/views/snippet-fill-in-modal.ts` (255 lines, direct read)
- `src/views/snippet-editor-modal.ts` (617 lines, direct read)
- `src/views/runner-view.ts` selected ranges (:280-340, :520-580, :670-850, :985-998 direct read)
- `src/runner/protocol-runner.ts:560-620` (direct read — Phase 51 D-13/D-14 auto-insert arm)
- `src/views/snippet-manager-view.ts:185-230, :450-490` (direct read + Grep showing no placeholder editor)
- `src/views/snippet-tree-picker.ts:225-262` (direct read)
- `src/__tests__/snippet-model.test.ts` (direct read + verified passing 10/10 via `npx vitest run`)
- `.planning/phases/52-json-placeholder-rework/52-CONTEXT.md` (direct read)
- `.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` §D-04..D-08 (direct read)
- `.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md` §D-04, §D-13..D-16 (direct read)
- `.planning/REQUIREMENTS.md` §PHLD-01 + §Out-of-Scope row 2 (direct read)
- `.planning/ROADMAP.md` §Phase 52 (direct read)
- `.planning/notes/json-snippet-placeholder-rework.md` (direct read — canonical design)
- `CLAUDE.md` (direct read — CSS append-only + never-remove-existing-code rules)
- Grep results for `'number'|'multichoice'|'multi-choice'|renderNumberField|joinSeparator|unit` — exhaustive file+line enumeration above

### Secondary (MEDIUM confidence)
- `src/__tests__/views/runner-snippet-picker.test.ts` fixtures at :316, :479 (referenced via Grep, not full-read — mock shape inferred; planner reads fully during Wave 0)
- `.planning/STATE.md` (direct read — Phase 51 state, 506 tests baseline)

### Tertiary (LOW confidence — none)
*(No LOW-confidence claims in this research.)*

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all patterns verified in existing code
- Architecture: HIGH — every target file read; every call site enumerated by Grep
- Pitfalls: HIGH — each pitfall derived from a verified code path
- D-08 bug localization: HIGH on falsification (grep + static analysis); MEDIUM on hypothesis 3 (static analysis shows correct code; dev-vault UAT strongly recommended during plan-phase but not blocking)
- Russian-error-copy format: MEDIUM — format pattern confirmed from Phase 50.1 CONTEXT, exact text is Claude's Discretion per CONTEXT

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — codebase is stable, Phase 51 just closed, no imminent refactors expected on the snippet subsystem outside Phase 52)
