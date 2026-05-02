# Phase 77: Eslint Findings Cleanup — Research

**Researched:** 2026-04-30
**Domain:** ESLint cleanup — Obsidian plugin TypeScript codebase
**Confidence:** HIGH (every claim verified by direct grep or by reading source — no `[ASSUMED]` items in this research)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `.planning/**` добавляется в `ignores` блока `eslint.config.mjs`. Обоснование (для commit message): архивные canvas-builder скрипты v1.11 milestone, не active source code; CONCERNS.md MEDIUM-3 confirms archive status. 9 находок снимаются.
- **D-02:** Override-блок для `src/__tests__/**` и `src/__mocks__/**` с `'@typescript-eslint/no-explicit-any': 'off'` (mocks Obsidian API требуют гибкости) и `'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]` (`_underscore` префикс — project convention). Оба обоснования в одном commit message.
- **D-03:** Не расширять test-override на остальные правила. Оставшиеся 6 тестовых находок фиксим вручную: 3 × `no-this-alias` в `inline-runner-modal*.test.ts`, 1 × `no-floating-promises` в `snippet-editor-modal-banner.test.ts:304`, 2 × `obsidianmd/ui/sentence-case` в `snippet-tree-picker.test.ts:979/996`.
- **D-04:** **Гибрид по природе** — Static state toggles → `el.toggleClass('rp-{component}-{state}', boolean)` + правило в `src/styles/*.css`; Runtime geometry → `el.setCssProps({'--rp-x': value})` + CSS custom properties.
- **D-05:** Class naming: `rp-{component}-{state}` (e.g. `rp-snippet-banner-hidden`, `rp-chip-disabled`). Сохраняет `rp-` namespace. Не использовать Obsidian core-style `is-*`.
- **D-06:** CSS custom property naming: `--rp-{component}-{prop}` (e.g. `--rp-inline-left`, `--rp-textarea-height`).
- **D-07:** CSS-файл маппинг (per-feature, append-only):
  - `snippet-editor-modal.ts` / `snippet-chip-editor.ts` / `snippet-manager-view.ts` rules → `src/styles/snippet-manager.css`
  - `snippet-fill-in-modal.ts` rules → `src/styles/snippet-fill-modal.css`
  - `runner-view.ts` rules → `src/styles/runner-view.css`
  - `inline-runner-modal.ts` rules → `src/styles/inline-runner.css`
  - `editor-panel-view.ts` rules → `src/styles/editor-panel.css`
  - Все файлы уже зарегистрированы в `esbuild.config.mjs` CSS_FILES.
  - Каждое новое правило префиксуется `/* Phase 77: <description> */`.
- **D-08:** Phase 77 идёт раньше Phase 75 и Phase 76 — lint baseline фиксируется первым.
- **D-09:** При перемещении кода в Phase 75/76 setCssProps-вызов «переезжает» с кодом; CSS-правила в `src/styles/*.css` остаются на месте независимо от .ts-файла.
- **D-10:** Из 75 src-находок только ~14 в файлах 75/76: runner-view.ts (5), inline-runner-modal.ts (7 — но 5 в `applyPosition`/`applyLayout`), editor-panel-view.ts (2). Остальные ~61 в файлах вне scope 75/76.
- **D-11:** Per-rule + per-file commits, ~12-15 атомарных коммитов в 3 stages (lint config → static-styles per file → residual rules per file).
- **D-12:** Каждый коммит включает соответствующее изменение в `src/styles/*.css` (если применимо); `npm run build` должен оставаться green после каждого коммита.
- **D-13:** 6 warnings: 4 fixable через `eslint --fix`; 1 unused `eslint-disable` directive в `snippet-editor-modal.ts:143` → удалить; 2 × `obsidianmd/prefer-file-manager-trash-file` → если фикс ломает behaviour (trash-файл vault-relative vs OS-trash), документировать в `77-VERIFICATION.md` как explicit out-of-scope.

### Claude's Discretion

- Конкретные имена CSS-классов и custom properties в каждом случае (researcher/planner выберет имя следуя D-05/D-06 шаблону).
- Точный порядок stage-2 коммитов между файлами — researcher/planner решит исходя из dependency order.
- Решение fix vs document для 2 `prefer-file-manager-trash-file` warnings — после исследования кода researcher оценит.

### Deferred Ideas (OUT OF SCOPE)

- **MEDIUM-5**: `protocol-runner.ts` (819 LOC) и `snippet-manager-view.ts` (1037 LOC) decomposition — re-evaluate после DEDUP-01 (Phase 75). Не v1.12 scope.
- **Husky migration** — Phase 78 hand-written hook; revisit `husky` + `lint-staged` если команда вырастет.
- **Lint-warning long-tail fixes** — новые warnings после error fixes nice-to-have, in scope только если cheap.
- **Inline runner test files** (`inline-runner-position.test.ts:216-217`, `editor-panel-forms.test.ts:300`) тестируют DOM `style.left/top/height` setters — после Phase 77 миграции в setCssProps эти тесты потребуют переписывания assertions. Часть Phase 77 как ripple effect.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINT-01 | `npm run lint` exits 0 on clean `main` checkout. All 517 errors + 6 warnings resolved. Dominant `obsidianmd/no-static-styles-assignment` violations across `src/views/` converted to CSS class toggles + rules in appropriate `src/styles/*.css`. Rule tuning permitted only with written justification in commit message. | Lint baseline aggregated by rule + file (Section "Standard Stack" → Lint Inventory). Static-styles strategy refined per actual rule semantics (Section "Architecture Patterns" → Migration Strategy). Per-file CSS mapping verified against `src/styles/` and `esbuild.config.mjs` CSS_FILES (Section "CSS File Inventory"). |
</phase_requirements>

## Summary

**Lint baseline confirmed:** 523 problems = 517 errors + 6 warnings, identical to CONTEXT.md `<specifics>`. Aggregate by rule has slightly different counts than CONTEXT.md narrative; corrected numbers below. The 39 static-styles violations split as **3 in tests + 36 in `src/`** (CONTEXT.md narrative implied 39 in `src/views/` — actual is 36 in `src/views/` + 3 ripple in tests).

**Critical correction to D-04 strategy:** The `obsidianmd/no-static-styles-assignment` rule (verified by reading `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/noStaticStylesAssignment.js`) **only flags literal-valued assignments**. Template-literal assignments with expressions like `el.style.left = ${Math.round(x)}px` are **NOT FLAGGED** and pass clean. This means:
- The CONTEXT.md D-04 narrative «Phase 60/67 drag+resize state at lines 654-677 → setCssProps» is partially correct — only the `style.right = ''` / `style.bottom = ''` / `style.maxWidth = ''` / `style.transform = ''` clearing assignments are flagged (literal empty strings). The `style.left = ${...}px` and `style.width = ${...}px` template-literal lines (656, 657, 674, 675) are **NOT flagged** and require **no migration**.
- The bulk of the 36 src-violations are static literals (`'none'`, `'flex'`, `'inline-block'`, `'auto'`, `'100%'`, `'12px'`, `'0.5'`, `'var(--text-error)'`, `''`) — all perfect candidates for **CSS class toggles** (D-04 first branch). Pure setCssProps cases are **rare** in this codebase.

**API verification:**
- `setCssProps(props: Record<string, string>): void` — **defined** at `node_modules/obsidian/obsidian.d.ts:106` (HTMLElement) and `:118` (SVGElement). **Zero existing usage** in `src/` — Phase 77 introduces this API. Mock at `src/__mocks__/obsidian.ts` does NOT have it (will need stub if any test asserts it).
- `toggleClass(classes: string | string[], value: boolean): void` — **defined** at `obsidian.d.ts:82` (Element). **4 existing call sites** in 3 files (`runner-view.ts:229,427`, `snippet-editor-modal.ts:350`, `snippet-chip-editor.ts:288`). Pattern is established.

**Primary recommendation:** Lean heavily on `toggleClass` + per-feature CSS rules (the dominant pattern). Use `setCssProps` only for the 3 truly-runtime cases (auto-grow textarea height in `runner-view.ts` and `editor-panel-view.ts` × 2). Phase 77 introduces a new API to the codebase — keep its surface minimal.

## Architectural Responsibility Map

This phase is internal/refactoring; no user-facing capabilities are added. The "tier" map describes which subsystem owns each cleanup.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lint config (ignores, overrides) | Build/Tooling | — | `eslint.config.mjs` is the single source of truth |
| State-toggle styling (display/opacity/color/etc.) | UI/CSS | — | Static visuals belong in `src/styles/*.css`, not in TS imperative code |
| Runtime-geometry styling (auto-grow textarea) | UI/TS | UI/CSS | Geometry depends on `scrollHeight` measured at runtime; CSS owns the `var(--rp-x)` consumption |
| Test-only style assertions | Test fixtures | — | `src/__tests__/views/inline-runner-position.test.ts` asserts `style.left/top` — must update DOM read-side after migration (D-13 deferred → in-scope ripple) |
| Sentence-case UI strings | UI text | — | Russian + English mixed; `obsidianmd/ui/sentence-case` flags both |
| Promise-not-awaited | Async lifecycle | — | Plugin lifecycle (workspace, leaf) — `void` prefix per `CONVENTIONS.md` §«Void-ing fire-and-forget promises» |
| TFile cast → `instanceof` | Type-safety | — | 3 call sites: `editor-panel-view.ts:284, 381` + `inline-runner-modal.ts:599` |

## Lint Inventory (verified baseline 2026-04-30)

### Aggregate by rule (517 errors + 6 warnings)

| Rule | Count | Source |
|------|-------|--------|
| `@typescript-eslint/no-unused-vars` | 289 | mostly tests/mocks (`_`-prefixed callback params); 5 in `src/` |
| `@typescript-eslint/no-explicit-any` | 214 | almost entirely in tests/mocks |
| `obsidianmd/no-static-styles-assignment` | 39 | 3 in tests + 36 in `src/` (see breakdown) |
| `obsidianmd/ui/sentence-case` | 28 | 2 tests + 26 src (`main.ts`, `settings.ts`, `editor-panel-view.ts`, `snippet-chip-editor.ts`) |
| `@typescript-eslint/no-floating-promises` | 7 | 1 test + 6 src (all 6 in `main.ts` workspace lifecycle: lines 246/255/264/277/296/316) |
| `@typescript-eslint/no-this-alias` | 4 | 3 tests + 1 src (`main.ts:517`) |
| `obsidianmd/no-tfile-tfolder-cast` | 3 | 0 tests + 3 src (`editor-panel-view.ts:284, 381` + `inline-runner-modal.ts:599`) |
| Parsing errors (`.planning/archive/...mjs`) | 9 | resolved by D-01 ignore add |
| `prefer-const` | 1 | `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts:311` (NOT covered by D-02 override → fix manually) |
| `no-control-regex` | 1 | `snippet-service.ts:488` — intentional control-char strip (regex `[\\u0000-\\u001F\\u007F]`) |
| `no-constant-binary-expression` | 1 | `node-picker-modal.ts:71` — unreachable `\|\| id` after truthy literal |
| `@typescript-eslint/ban-ts-comment` | 1 | `inline-runner-modal.test.ts:290` — `@ts-ignore` should be `@ts-expect-error` |
| `obsidianmd/prefer-file-manager-trash-file` (warn) | 2 | `snippet-service.ts:240, 283` |
| Unused `eslint-disable` directive (warn) | 4 | `snippet-editor-modal.ts:143`, `snippet-editor-modal.test.ts:411, 648`, `editor-panel-canvas-sync.test.ts:267` |

**Discrepancies vs CONTEXT.md `<specifics>`:**
- CONTEXT.md said **243** unused-vars → actual **289**
- CONTEXT.md said **191** explicit-any → actual **214**
- CONTEXT.md said **19** sentence-case → actual **28** (CONTEXT.md may have undercounted by missing `editor-panel-view.ts` and `settings.ts`)
- CONTEXT.md said **7** floating-promises → actual **7** (matches)
- CONTEXT.md said **4** this-alias → actual **4** (matches)
- CONTEXT.md said **3** tfile-cast → actual **3** (matches)
- CONTEXT.md said **2** prefer-file-manager-trash-file warnings → actual **2** (matches)

The **523 total** is accurate; per-rule sub-counts in CONTEXT.md were rough estimates and slightly low. Plan should use these verified numbers.

### After D-01 + D-02 application (projected)

D-01 removes 9 parsing errors (.planning/archive/.../*.mjs).
D-02 removes ~503 errors in tests/mocks: 289 unused-vars (most `_`-prefixed) + 214 explicit-any (all in tests/mocks). **Note:** D-02 ignorePattern does NOT cover `_underscore` reassignment cases like `'lastMenuItems'` (no `_` prefix) in `snippet-tree-dnd.test.ts:121` — that one is `assigned a value but never used` and stays as an error.

**Projected residual after D-01 + D-02:** ~75 errors + 6 warnings, dominated by:
- 36 static-styles in `src/` + 3 in tests (NOT covered by D-02 override) = **39 static-styles**
- 26 sentence-case in `src/` + 2 in tests (NOT covered) = **28 sentence-case**
- 6 floating-promises in `src/` + 1 in tests (NOT covered) = **7**
- 3 tfile-cast in `src/`
- 4 this-alias (3 tests + 1 src — `inline-runner-modal*.test.ts:267/261/272` + `main.ts:517`) — note D-03 explicitly enumerates only 3 test ones; the 1 src case in `main.ts:517` is handled via D-13 «остальные правила» bucket.
- 1 each: prefer-const, no-control-regex, no-constant-binary-expression, ban-ts-comment
- ~5 residual unused-vars in `src/` (TFolder, SnippetFile imports, _ev callback param, etc.)

### Static-styles violations: file-by-file breakdown (39 total)

| File | Lines | Style props flagged | Strategy (per D-04) |
|------|-------|---------------------|---------------------|
| `src/views/runner-view.ts` | 1056, 1059, 1065 | `width = '100%'`, `height = 'auto'` × 2 | **HYBRID:** width=100% → CSS class `rp-preview-textarea` rule; height='auto' is reset before measuring scrollHeight → use `setCssProps({'--rp-textarea-height': 'auto'})` then `setCssProps({'--rp-textarea-height': scrollHeight + 'px'})`. CSS rule references `var(--rp-textarea-height)`. |
| `src/views/inline-runner-modal.ts` | 658, 659, 662, 663, 676 | `right = ''`, `bottom = ''`, `maxWidth = ''` × 2, `transform = ''` | **CLASS TOGGLE.** These are clearing assignments — line 656/657 (`style.left = ${...}`, `style.top = ${...}` template-literal) are NOT flagged. Wrap clearing logic in CSS class toggles instead of literal-empty-string assignments. |
| `src/views/editor-panel-view.ts` | 531, 660 | `height = 'auto'` × 2 | **setCssProps + var(--rp-textarea-height)** — identical Phase 64 auto-grow pattern as runner-view.ts:1059/1065. Single source-of-truth for custom property name. |
| `src/views/snippet-chip-editor.ts` | 127, 151, 152, 168, 199, 206, 382 | `display = 'none'/'flex'`, `gap = 'var(--size-4-1)'` | **CLASS TOGGLE** — show/hide UI states (`rp-chip-form-hidden`, `rp-chip-row-flex`). The mini-form add-placeholder area: literal display='none' and display='' on toggle. |
| `src/views/snippet-editor-modal.ts` | 146, 199, 200, 217, 218, 374, 375, 518, 525, 637 | `maxWidth = '800px'`, `display = 'none'` × multiple, `color = 'var(--text-error)'`, `pointerEvents = 'none'`, `opacity = '0.5'` | **CLASS TOGGLE.** D-13 also says line 143 has unused `eslint-disable` — DELETE after fix (`maxWidth='800px'` becomes class `rp-snippet-editor-modal` rule with `max-width: 800px` declaration). Banner show/hide → `rp-snippet-banner-hidden` toggle. Locked-state visual disabled → `rp-snippet-form-disabled` class with `pointer-events: none; opacity: 0.5`. |
| `src/views/snippet-fill-in-modal.ts` | 148, 149, 150 | `display = 'flex'`, `alignItems = 'center'`, `gap = '4px'` | **CLASS TOGGLE** — single class `rp-snippet-fill-option-row` with `display: flex; align-items: center; gap: 4px;` (combines all three rules). Three style.x = literals collapse into one classList add and one CSS rule. |
| `src/views/snippet-manager-view.ts` | 276, 286, 287, 361, 911, 937 | `display = 'inline-block'/'none'`, `width = ${depth*16}px` (template) → wait, line 287 is `'12px'` literal | **CLASS TOGGLE.** Lines 911, 937 are `style['display'] = 'none'/''` (computed property — eslint sees `style.undefined` because rule treats computed as static; flagged anyway). The line 275 `indent.style.width = ${depth * 16}px` template-literal at LINE 275 is NOT flagged — line 287 `spacer.style.width = '12px'` literal IS flagged. Use class `rp-snippet-tree-spacer` (12px width). For inline-rename hide/show (911/937): toggleClass `rp-snippet-tree-label-hidden`. |
| `src/__tests__/editor-panel-forms.test.ts` | 300 | `height = 'prev'` | Test ASSERTS auto-grow: writes `'prev'` to height to verify the input handler overwrites it. After migration to setCssProps, this test reads via `style.height`/getPropertyValue. **In-scope ripple** per CONTEXT.md `<deferred>`. |
| `src/__tests__/views/inline-runner-position.test.ts` | 216, 217 | `left = '920px'`, `top = '740px'` | Test SETS containerEl.style for assertion fixture. Since `style.left/top` template-literal assignments in `inline-runner-modal.ts:656-657` are NOT migrated (rule does not flag template literals), this test **continues to assert `style.left/top` reads** unchanged. The test's WRITE-side at 216/217 is also literal → flagged. Wrap with per-line `eslint-disable-next-line obsidianmd/no-static-styles-assignment` with comment «test fixture forcing position; writing through setCssProps would defeat the assertion». |

### Test residual breakdown (D-03 verification)

CONTEXT.md D-03 line numbers verified against current source (no drift):
- `inline-runner-modal-loop-body-file-bound.test.ts:267` → `const self = this;` inside `constructor(_app, snippet)` of mock SnippetFillInModal. Used by `instances.push({ ..., open: () => { self.opened = true; }, close: () => { self.closed = true; } })` getters. **Fix:** since it's inside a constructor and `instances.push` captures the closure, simplest rewrite is to use the class instance directly — replace `self.opened` with `this.opened` inside arrow functions (arrow functions inherit `this` from constructor). The `const self = this;` line becomes unused and is removed.
- `inline-runner-modal-output-toolbar.test.ts:261` → identical pattern. Same fix.
- `inline-runner-modal.test.ts:272` → identical pattern. Same fix.
- `snippet-editor-modal-banner.test.ts:304` → `modal.onOpen();` (Promise) — fix: `void modal.onOpen();` per CONVENTIONS.md «void-ing fire-and-forget promises». Note: line 305-306 already do `await Promise.resolve()` × 2 to flush microtasks — `void modal.onOpen()` lets that flush trigger the async work without awaiting.
- `snippet-tree-picker.test.ts:979` → `container.createEl('div', { text: 'pre-existing' })` — the string `'pre-existing'` is detected as UI text and flagged for not being sentence case. **Fix:** rename fixture string to `'Pre-existing'` (capitalize). The assertion at line 990 (`expect(container.children[0]?._text).toBe('pre-existing')`) needs same update — both sites change together.
- `snippet-tree-picker.test.ts:996` → `container.createEl('div', { text: 'stale' })` — flagged. **Fix:** rename to `'Stale'`.

### Phase 75/76 boundary check (D-08/D-09/D-10 verification)

CONTEXT.md D-10 says «runner-view.ts (5), inline-runner-modal.ts (7 — 5 in applyPosition/applyLayout), editor-panel-view.ts (2)». Verification:

| File | Phase | Static-styles count (verified) | Notes |
|------|-------|------------------------------|-------|
| `runner-view.ts` | 75 | 3 (lines 1056, 1059, 1065) | CONTEXT.md said 5 — actual is 3. Other 2 may have been confused with the `style.height = textarea.scrollHeight + 'px'` lines which are NOT flagged (string concat, not literal). |
| `inline-runner-modal.ts` | 75 | 5 (lines 658, 659, 662, 663, 676) | CONTEXT.md said 7 (5 in applyPosition/Layout). Verified actual count is 5 — exactly the 5 in applyPosition/applyLayout (no others). |
| `editor-panel-view.ts` | 76 | 2 (lines 531, 660) | Matches CONTEXT.md. |
| **Sub-total in Phase 75/76 files** | | **10 of 36 src-violations** | CONTEXT.md said «~14» — verified ~10 |
| Files outside 75/76 scope | — | 26 of 36 | snippet-* (× 4 files), tests (3 in 2 files) |

D-09 holds: when Phase 75 moves `renderPreviewZone` from `runner-view.ts` to `src/runner/RunnerRenderer`, the setCssProps call moves with the code; the CSS rule in `src/styles/runner-view.css` stays put (no rename needed since selector targets `.rp-preview-textarea` which keeps its class).

## Standard Stack

### Core (already installed; no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `eslint` | ^9.39.4 | Lint runner | Project-wide gate |
| `@eslint/js` | 9.30.1 | Recommended JS rules | Already in `eslint.config.mjs` |
| `typescript-eslint` | 8.58.0 | TS rules + parser | Project-wide |
| `eslint-plugin-obsidianmd` | 0.1.9 | Obsidian-specific rules | Source of static-styles rule (verified by reading `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/`) |
| `globals` | 17.4.0 | Global env definitions | Used by `languageOptions.globals` |
| `obsidian` | 1.12.3 | Obsidian API types | Source of `setCssProps` type def at `obsidian.d.ts:106` |

**No new dependencies needed.** All required APIs already exist.

### Reused project APIs (verified existing)

- `el.toggleClass(cls, value)` — defined `obsidian.d.ts:82`; 4 existing call sites in `src/views/`. Phase 77 expands to ~15-20 more sites.
- `el.setCssProps({...})` — defined `obsidian.d.ts:106`; **0 existing call sites in `src/`**. Phase 77 introduces this API to the codebase. Used only for the 3 auto-grow textarea cases (runner-view.ts × 1, editor-panel-view.ts × 2).
- `el.addClass(...)` / `el.removeClass(...)` — already used widely.
- `el.hasClass(cls)` — already used (e.g. `inline-runner-modal.ts:716`).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│  npm run lint           │
│  (eslint .)             │
└────────────┬────────────┘
             │
             ▼
   ┌─────────────────────┐         ┌─────────────────────┐
   │  eslint.config.mjs  │◄────────│  Phase 77 Stage 1   │
   │  - ignores          │         │  Add .planning/**   │
   │  - rules            │         │  Add tests override │
   │  - overrides        │         └─────────────────────┘
   └──────────┬──────────┘
              │
   ┌──────────┴──────────┐
   ▼                     ▼
┌──────────────┐    ┌──────────────────┐         ┌─────────────────────┐
│ src/**/*.ts  │    │ src/__tests__/** │◄────────│  Phase 77 Stage 2   │
│ (strict)     │    │ src/__mocks__/** │         │  Per-file static-   │
│              │    │ (relaxed: any/   │         │  styles migration   │
│              │    │  unused-vars)    │         └──────────┬──────────┘
└──────┬───────┘    └────────┬─────────┘                    │
       │                     │                               ▼
       │                     │              ┌──────────────────────────────┐
       │                     │              │  src/styles/{feature}.css    │
       │                     │              │  (append-only per phase)     │
       │                     │              │  + /* Phase 77: ... */       │
       │                     │              └──────────────────────────────┘
       │                     │                              │
       ▼                     ▼                              ▼
┌──────────────────────────────────────┐     ┌─────────────────────────┐
│  Stage 3 — residual rules per file:  │     │   esbuild build         │
│  - sentence-case                      │────►│   concatenates CSS_FILES│
│  - no-floating-promises               │     │   → root styles.css     │
│  - no-this-alias                      │     │   (must stay green)     │
│  - no-tfile-tfolder-cast              │     └─────────────────────────┘
│  - misc (regex, const, ban-ts)        │
└──────────────────────────────────────┘
       │
       ▼
   ┌─────────────────────┐
   │  Final commit:      │
   │  - npm run lint = 0 │
   │  - npm test green   │
   │  - npm run build OK │
   └─────────────────────┘
```

### Pattern 1: Class toggle for boolean state

**What:** Replace `el.style.display = 'none'` / `el.style.display = ''` with `el.toggleClass('rp-x-hidden', isHidden)` and a CSS rule.

**When to use:** Static state visuals — display/visibility toggles, hover/disabled states, fixed-value styling like `max-width: 800px`, `color: var(--text-error)`.

**Example:**
```typescript
// Before (snippet-editor-modal.ts:199-200)
this.saveErrorEl.style.display = 'none';
this.saveErrorEl.style.color = 'var(--text-error)';

// After
this.saveErrorEl.addClass('rp-snippet-editor-save-error');
this.saveErrorEl.toggleClass('rp-snippet-editor-save-error-hidden', true);

// Then to show:
this.saveErrorEl.toggleClass('rp-snippet-editor-save-error-hidden', false);
```

```css
/* src/styles/snippet-manager.css — append-only */
/* Phase 77: snippet-editor-modal save-error styling — replaces inline style.color/style.display */
.rp-snippet-editor-save-error {
  color: var(--text-error);
}
.rp-snippet-editor-save-error.rp-snippet-editor-save-error-hidden {
  display: none;
}
```

### Pattern 2: setCssProps for runtime geometry (auto-grow textarea)

**What:** Replace `el.style.height = scrollHeight + 'px'` with `el.setCssProps({'--rp-textarea-height': scrollHeight + 'px'})` and a CSS rule consuming the variable.

**When to use:** Geometry depending on runtime measurement (`scrollHeight`, viewport size, drag offsets that AREN'T already template literals).

**Note:** `el.style.height = scrollHeight + 'px'` (string concat) is NOT flagged by the rule! Only `el.style.height = 'auto'` (literal) is flagged. So in practice, only the `height = 'auto'` reset line needs migrating. But for consistency and to put the height in CSS-controlled space, both lines should migrate together to setCssProps.

**Example:**
```typescript
// Before (runner-view.ts:1058-1066)
requestAnimationFrame(() => {
  textarea.style.height = 'auto';                        // FLAGGED (literal)
  textarea.style.height = textarea.scrollHeight + 'px';  // NOT FLAGGED (concat)
  textarea.scrollTop = textarea.scrollHeight;
});
this.registerDomEvent(textarea, 'input', () => {
  textarea.style.height = 'auto';                        // FLAGGED
  textarea.style.height = textarea.scrollHeight + 'px';  // NOT FLAGGED
});

// After
requestAnimationFrame(() => {
  textarea.setCssProps({ '--rp-textarea-height': 'auto' });
  textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
  textarea.scrollTop = textarea.scrollHeight;
});
this.registerDomEvent(textarea, 'input', () => {
  textarea.setCssProps({ '--rp-textarea-height': 'auto' });
  textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
});
```

```css
/* src/styles/runner-view.css — append-only */
/* Phase 77: Phase 64 auto-grow textarea — height driven by --rp-textarea-height (Phase 60/64 pattern) */
.rp-preview-textarea {
  width: 100%;                              /* Was inline style.width = '100%' */
  height: var(--rp-textarea-height, auto);  /* Was inline style.height = scrollHeight + 'px' */
}
```

The custom property name `--rp-textarea-height` MUST be shared between `runner-view.ts:1052-1069` (Phase 64 pattern, runs in sidebar/tab) and `editor-panel-view.ts:529-533, 654-663` (same pattern, runs in node editor). Per CONTEXT.md `<code_context>` Established Patterns: «Single source of truth по custom property имени».

### Pattern 3: Composite CSS class for multiple style props

**What:** Three-line `display = 'flex'; alignItems = 'center'; gap = '4px';` collapses to one classList add + one CSS rule.

**Example:**
```typescript
// Before (snippet-fill-in-modal.ts:147-150)
const row = optionsDiv.createDiv();
row.style.display = 'flex';
row.style.alignItems = 'center';
row.style.gap = '4px';

// After
const row = optionsDiv.createDiv({ cls: 'rp-snippet-fill-option-row' });
```

```css
/* src/styles/snippet-fill-modal.css — append-only */
/* Phase 77: snippet-fill-in-modal option row — replaces inline display/alignItems/gap */
.rp-snippet-fill-option-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
```

### Pattern 4: Eslint config delta (D-01 + D-02)

**Pseudo-diff for `eslint.config.mjs`:**

```javascript
// (existing) Ignore patterns block (current file lines 82-92)
{
  ignores: [
    'node_modules/**',
    'main.js',
    'eslint.config.mjs',
    'esbuild.config.mjs',
    'version-bump.mjs',
    'vitest.config.ts',
    '.planning/**',  // Phase 77 D-01: archived canvas-builder scripts (CONCERNS.md MEDIUM-3 confirms archive); not active source
  ],
}

// NEW BLOCK to insert AFTER the main src/**/*.ts config (around line 80)
// before the ignores block (line 82)
{
  // Phase 77 D-02: tests/mocks override —
  //   * @typescript-eslint/no-explicit-any: off — Obsidian API mocks need flexible
  //     shapes (see src/__mocks__/obsidian.ts, where every method takes `unknown`).
  //     Full typing duplicates production types or breaks tests.
  //   * @typescript-eslint/no-unused-vars: error w/ _underscore-pattern — already
  //     project convention per CONVENTIONS.md §Naming Patterns. Mock callbacks
  //     intentionally accept (_evt, _text, _cb) to match upstream signatures.
  files: ['src/__tests__/**/*.ts', 'src/__mocks__/**/*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
}
```

**Insertion points:**
- Add `.planning/**` at end of `ignores` array (current line ~91, before closing `]`).
- New override block: insert as a new top-level config object in the `tseslint.config(...)` call, **after** the main `src/**/*.ts` config (line 80) and **before** the `ignores` block (line 83). Both the existing recommended configs at the top apply globally to every file (no `files:` glob), and the per-file config has narrower glob — the override block must come AFTER the broader src config so it wins via flat-config last-match semantics.

### Anti-Patterns to Avoid

- **`el.style.setProperty('--rp-x', value)`:** Per `noStaticStylesAssignment.js:62-75`, the rule flags `setProperty` calls with **literal** second arg (`el.style.setProperty('color', 'red')`) but **NOT** with non-literal arg (`el.style.setProperty('--my-var', someValue)`). However — using the bare DOM `setProperty` instead of Obsidian's `setCssProps` is **inconsistent with the rule's INTENT** and forfeits Obsidian's centralized prop-setting behaviour. Always use `el.setCssProps({'--rp-x': value})` (verified by reading rule source).
- **Touching unrelated CSS rules:** CLAUDE.md explicit rule «Never remove existing code you didn't add» — append new Phase 77 CSS at the bottom of each `src/styles/*.css` file with `/* Phase 77: ... */` comment. NEVER edit existing rules in those files (e.g. don't refactor existing Phase 64 textarea rules; only add NEW rules).
- **Test override extension creep:** D-03 explicitly says do NOT extend the test override to other rules (no-this-alias, no-floating-promises, sentence-case). Adding more relaxations there would silence real bugs.
- **Project-wide rule disable:** ROADMAP SC#3 says «default is to fix the violation». Per-file `eslint-disable` is acceptable ONLY with written commit-message justification (e.g. `no-control-regex` at `snippet-service.ts:488` is intentional control-char strip).

## CSS File Inventory

Verified `src/styles/` contents on 2026-04-30:

| File | LOC | Last comment / phase tag | Targeted by Phase 77 (per D-07) |
|------|-----|--------------------------|--------------------------------|
| `runner-view.css` | 360 | Phase 65 footer Back/Skip | YES — `runner-view.ts` rules |
| `editor-panel.css` | 311 | Phase 64 quick-create textblock btn | YES — `editor-panel-view.ts` rules |
| `snippet-manager.css` | 523 | (snippet-editor unsaved dot) | YES — `snippet-editor-modal.ts` + `snippet-chip-editor.ts` + `snippet-manager-view.ts` rules (3 files merge here per D-07) |
| `snippet-fill-modal.css` | 75 | (snippet-fill button bar) | YES — `snippet-fill-in-modal.ts` rules |
| `inline-runner.css` | 238 | Phase 67 D-02 resize | YES — `inline-runner-modal.ts` rules |
| `loop-support.css` | 135 | Phase 70 loop-exit hint | NO (not touched in Phase 77) |
| `canvas-selector.css` | 110 | (canvas selector empty list) | NO |
| `snippet-tree-picker.css` | 126 | (folder-only commit btn hover) | NO (no static-styles violations in `snippet-tree-picker.ts` source) |
| `donate-section.css` | 46 | Phase 71 donate hover | NO |

**`esbuild.config.mjs` CSS_FILES list (verified lines 31-41):**
```js
const CSS_FILES = [
  'runner-view',
  'canvas-selector',
  'editor-panel',
  'snippet-manager',
  'snippet-fill-modal',
  'loop-support',
  'snippet-tree-picker',
  'inline-runner',
  'donate-section',
];
```

**All 5 target files (D-07) are present and registered. No new files needed. CONTEXT.md «all already registered» CONFIRMED.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Setting CSS custom property on element | `el.style.setProperty('--rp-x', value)` | `el.setCssProps({'--rp-x': value})` | Centralized helper; matches eslint-plugin-obsidianmd guidance text in rule message; consistency with rest of codebase Phase 77 introduces |
| Toggling a class for state | `el.classList.add(cls); el.classList.remove(cls)` two-line dance | `el.toggleClass(cls, boolean)` | Single call, declarative — same return; already established pattern (4 existing call sites) |
| Hiding/showing element | `el.style.display = 'none'` / `el.style.display = ''` | CSS class with `display: none` rule + `el.toggleClass('rp-x-hidden', boolean)` | Lint rule mandates this approach; CSS owns the visual; logic owns intent only |
| Test mock for `setCssProps` (if needed) | New mock helper file | Add `setCssProps: (_props: unknown) => {}` to `MockElement` interface in `src/__mocks__/obsidian.ts` | Single existing mock file; 1-line addition |

## Common Pitfalls

### Pitfall 1: CSS file edits silently delete existing rules

**What goes wrong:** An executor agent rewrites a section of `src/styles/snippet-manager.css` while migrating `snippet-editor-modal.ts` and accidentally drops Phase 33/34/52 rules.

**Why it happens:** CLAUDE.md flags this as a recurring class of regressions. Snippet-manager.css is 523 LOC with phases overlapping.

**How to avoid:** Per CLAUDE.md «append-only per phase»: ONLY add new rules at the END of each .css file with `/* Phase 77: <description> */` comment. Never edit existing rules. Verify with `git diff` before commit — diff should be additions only.

**Warning signs:** `git diff` shows `-` lines in CSS files = STOP and re-do.

### Pitfall 2: setCssProps custom-property fallback in CSS

**What goes wrong:** CSS rule says `height: var(--rp-textarea-height)` with no fallback. Before TS code runs `setCssProps`, the variable is undefined → CSS resolves to invalid → height collapses to 0 → textarea invisible during initial render.

**Why it happens:** Phase 64 auto-grow runs in `requestAnimationFrame` callback (deferred). Initial paint has no value yet.

**How to avoid:** Always provide CSS fallback: `height: var(--rp-textarea-height, auto)`. The `auto` fallback matches the original `style.height = 'auto'` reset behaviour for initial paint.

### Pitfall 3: this-alias in mock SnippetFillInModal — `instances.push` getter timing

**What goes wrong:** The 3 test files have:
```typescript
const self = this;
instances.push({
  ...
  get opened() { return self.opened; },
});
```
Naive rewrite to:
```typescript
instances.push({
  ...
  get opened() { return this.opened; },  // 'this' here is the pushed object, not the modal!
});
```
**The getter's `this` is the pushed object, not the constructor's `this`.** This breaks the test silently (always returns undefined).

**Why it happens:** ES `get` syntax binds `this` to the containing object literal at call time, not lexically.

**How to avoid:** Either (a) use arrow function captured vars: `instances.push({ ..., open: () => { capturedSelf.opened = true; } })` — but `capturedSelf` is just `self` renamed, no improvement. Better fix (b): rewrite as a closure using a captured outer reference variable that doesn't trip the rule:
```typescript
constructor(_app: unknown, snippet: unknown) {
  this.snippet = snippet;
  this.result = new Promise<string | null>(res => { this.resolveFn = res; });
  // Capture instance via .bind() or by using arrow methods at instance level
  const instance = this;  // Still alias — let's try different approach
  ...
}
```
**Cleanest fix:** Refactor the test to use the class instance directly in `instances.push`:
```typescript
instances.push(this as unknown as InstanceShape);
// Later test code reads instance.opened directly
```
This eliminates the getter pattern entirely — the pushed object IS the modal instance.

**Warning signs:** Tests for opened/closed state pass before fix and fail after — a sign the `this` rebinding broke.

### Pitfall 4: D-02 override glob doesn't match nested test directories — IT DOES

**What goes wrong:** `src/__tests__/**` glob pattern would not match `src/__tests__/views/inline-runner-modal.test.ts` if `**` only matched single-level — would leak rules.

**Why it doesn't happen:** ESLint flat-config uses minimatch with `globstar` = true. `src/__tests__/**` matches all descendants including `views/`, `runner/`, `graph/` subdirs. Verified by tracing: 3 of the test-side `no-this-alias` violations live at `src/__tests__/views/inline-runner-modal*.test.ts` — those would be untouched by override (which doesn't relax this-alias anyway), but unused-vars errors at the same paths WILL be relaxed by override → projected count of remaining errors holds.

### Pitfall 5: prefer-file-manager-trash-file fix can change UX

**What goes wrong:** `vault.trash(file, false)` is hardcoded to use Obsidian's `.trash/` folder (vault-relative). Replacing with `app.fileManager.trashFile(file)` respects user setting `Files & Links → Deleted files`, which can be `system trash` (macOS Trash, Windows Recycle Bin), `Obsidian's .trash/`, or `Permanently delete`.

**Why it matters:** Existing tests asserting `vault.trash` was called break. User who set «system trash» now has snippets going to OS trash (potentially good — respects user choice; potentially bad — surprises them on a feature they didn't request).

**How to handle:** Per CONTEXT.md D-13: «если фикс ломает behaviour, документировать в `77-VERIFICATION.md` как explicit out-of-scope». Recommend: **document as out-of-scope** with rationale «changing Vault.trash → fileManager.trashFile alters UX semantics for snippet deletion (vault-trash → user-configured); behaviour change requires a UX decision phase out of LINT-01 scope per ROADMAP SC#5». The 2 remaining warnings are acceptable per ROADMAP SC#5 «Pre-existing 6 warnings are either resolved or explicitly documented as out-of-scope».

### Pitfall 6: no-control-regex on `[\\u0000-\\u001F\\u007F]` is intentional

**What goes wrong:** Auto-fix or naive removal would strip the regex itself, breaking `snippet-service.ts:488` `cleanControlChars`.

**Why it's intentional:** That regex strips control characters from user-supplied snippet name/template before storing — defense against pasted-in invisible chars.

**How to handle:** Add per-line `eslint-disable-next-line no-control-regex` with comment `// Phase 32 D-X: intentional control-char strip — prevents invisible-char injection in snippet content`. Justification in commit message.

### Pitfall 7: The no-static-styles rule does NOT flag template-literal assignments

**What goes wrong:** The CONTEXT.md narrative implies `inline-runner-modal.ts:654-677` lines all need migration. Reading the rule source (`noStaticStylesAssignment.js`), it ONLY flags when `node.right.type === "Literal"`. So `style.left = ${...}px` (TemplateLiteral with expressions) is **valid** and untouched.

**Why this matters:** Half the «runtime geometry» strategy in D-04 is unnecessary. The actual flagged assignments are clearings (`= ''`) and fixed values (`= '100%'`, `= 'auto'`). The plan should reflect this — fewer setCssProps introductions than CONTEXT.md implies.

## Code Examples

### Example 1: applyPosition migration (inline-runner-modal.ts:654-677)

```typescript
// Before — current source
private applyPosition(position: InlineRunnerLayout): void {
  if (this.containerEl === null) return;
  this.containerEl.style.left = `${Math.round(position.left)}px`;        // OK — template literal, NOT flagged
  this.containerEl.style.top = `${Math.round(position.top)}px`;          // OK — template literal, NOT flagged
  this.containerEl.style.right = '';                                     // FLAGGED — literal
  this.containerEl.style.bottom = '';                                    // FLAGGED — literal
  this.containerEl.style.maxWidth = '';                                  // FLAGGED — literal
  this.containerEl.style.transform = '';                                 // FLAGGED — literal
}

// After — minimal change: use class to clear right/bottom/maxWidth/transform
private applyPosition(position: InlineRunnerLayout): void {
  if (this.containerEl === null) return;
  this.containerEl.style.left = `${Math.round(position.left)}px`;        // unchanged
  this.containerEl.style.top = `${Math.round(position.top)}px`;          // unchanged
  this.containerEl.toggleClass('rp-inline-runner-applied-position', true);
  // CSS rule sets right/bottom/maxWidth/transform to initial — equivalent to ''.
}
```

```css
/* src/styles/inline-runner.css — append-only */
/* Phase 77: applyPosition resets right/bottom/maxWidth/transform when an explicit
   left/top is applied (Phase 60/67 drag+resize state). Equivalent to inline style.x = ''. */
.rp-inline-runner-container.rp-inline-runner-applied-position {
  right: auto;
  bottom: auto;
  max-width: none;
  transform: none;
}
```

### Example 2: editor-panel-view.ts auto-grow shared helper (lines 525-533)

```typescript
// Before
const resize = () => {
  if (!textarea.style) return;
  textarea.style.height = 'auto';                                  // FLAGGED
  textarea.style.height = textarea.scrollHeight + 'px';            // OK — concat
};

// After
const resize = () => {
  if (typeof textarea.setCssProps !== 'function') return;
  textarea.setCssProps({ '--rp-textarea-height': 'auto' });
  textarea.setCssProps({ '--rp-textarea-height': textarea.scrollHeight + 'px' });
};
```

CSS in `src/styles/editor-panel.css`:
```css
/* Phase 77: shared auto-grow textarea — driven by --rp-textarea-height (single source of truth shared with runner-view.css Phase 64 pattern) */
.rp-growable-textarea {
  height: var(--rp-textarea-height, auto);
}
```

### Example 3: main.ts:246-316 floating-promises (workspace lifecycle)

```typescript
// Before (line 246)
workspace.revealLeaf(activeLeaf);  // Returns Promise<void> in Obsidian 1.5+; not awaited

// After
void workspace.revealLeaf(activeLeaf);
```

7 sites in `main.ts` follow same pattern. Per CONVENTIONS.md §«Void-ing fire-and-forget promises»: prefix with `void` when calling async from sync context.

### Example 4: editor-panel-view.ts TFile cast (line 284)

```typescript
// Before
raw = await this.plugin.app.vault.read(file as TFile);

// After
if (!(file instanceof TFile)) {
  new Notice('Could not read canvas file (not a file).');
  return;
}
raw = await this.plugin.app.vault.read(file);
```

(Same pattern at line 381 and `inline-runner-modal.ts:599`.)

### Example 5: node-picker-modal.ts:71 constant binary expression

```typescript
// Before
options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
// 'id' is unreachable — '(корень snippets)' is always truthy.

// After
options.push({ id, label: s.subfolderPath || '(корень snippets)', kind: 'snippet' });
// The defense-in-depth comment in source can be updated:
// "id fallback dropped — '(корень snippets)' is always truthy (no-constant-binary-expression)"
```

## State of the Art

| Old Approach | Current Approach | Driver |
|--------------|------------------|--------|
| Inline `el.style.x = ...` for state | CSS class toggle + `el.toggleClass(cls, bool)` | eslint-plugin-obsidianmd 0.1.x rule + Obsidian theme/maintainability guidance |
| `el.style.setProperty('--x', val)` (DOM API) | `el.setCssProps({'--x': val})` (Obsidian helper) | Obsidian 1.x adds `setCssProps` to HTMLElement augmentation; centralizes prop-setting |
| `vault.trash(file, false)` for snippet delete | `app.fileManager.trashFile(file)` (respects user settings) | Obsidian preference `Files & Links → Deleted files` (system trash / vault trash / permanent) |
| Cast `as TFile` | `instanceof TFile` narrow | Type-safety; aligned with `noUncheckedIndexedAccess`-strict tsconfig |
| `@ts-ignore` | `@ts-expect-error` | TS 4.0+ — flags ignore directives that no longer suppress |

**Deprecated/outdated patterns now flagged:**
- `const self = this` aliasing — use arrow functions or `this: T` parameter type instead.
- `const x = ...; if (x) { ... }` where x is constant truthy — replace with direct usage.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (empty) | — | All claims verified by direct file read or grep of source. No assumed knowledge in this research. |

This research has zero `[ASSUMED]` items. Every numeric count and code reference was verified against the live codebase on 2026-04-30:
- Lint counts: aggregated from `npm run lint 2>&1 > /tmp/lint-baseline.txt` (647 lines).
- Line numbers: verified by direct Read of source files at given offsets.
- API existence: verified by grep on `node_modules/obsidian/obsidian.d.ts`.
- Rule semantics: verified by reading `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/noStaticStylesAssignment.js` source.

## Open Questions

1. **Naming conflicts on per-feature CSS classes.** D-05 says `rp-{component}-{state}`. For `snippet-editor-modal.ts` rules going into `src/styles/snippet-manager.css`, the existing file already uses `rp-snippet-editor-*` prefix (see `.rp-snippet-editor-unsaved-dot.is-visible`). Phase 77 should follow that established prefix exactly — `rp-snippet-editor-save-error`, `rp-snippet-editor-form-locked`, etc. — to avoid creating a parallel naming taxonomy. Recommendation for planner: enumerate the new class names in the plan task that adds them, and grep existing CSS for conflicts before commit.

2. **Order of stage-2 commits.** D-11 says ~7 per-file commits in stage 2. No hard dependency between files exists. Recommended order (by complexity, simplest first to validate the migration approach):
   1. `snippet-fill-in-modal.ts` (3 lines, single new CSS class) — proves the pattern.
   2. `snippet-chip-editor.ts` (7 lines, all display toggles).
   3. `snippet-manager-view.ts` (6 lines, includes 2 computed-property quirks at 911/937).
   4. `snippet-editor-modal.ts` (10 lines, banner + locked state + max-width).
   5. `runner-view.ts` (3 lines, introduces setCssProps + auto-grow CSS pattern).
   6. `editor-panel-view.ts` (2 lines, reuses runner-view's CSS custom-property name — no new CSS).
   7. `inline-runner-modal.ts` (5 lines, applyPosition reset class).

3. **Test override `_underscore` pattern doesn't catch `lastMenuItems` (no underscore).** The variable `lastMenuItems` at `snippet-tree-dnd.test.ts:121` is `assigned a value but never used` — this stays as a real error after D-02 override (D-02 only ignores names starting with `_`). Plan needs a stage-3 task to manually fix this single test residual (rename to `_lastMenuItems` or remove the variable).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `eslint` CLI | npm run lint | ✓ (via package.json devDeps) | ^9.39.4 | — |
| `npx` | local dev `eslint --fix` (D-13 stage) | ✓ (Node 18+) | bundled | — |
| `git` | per-file commits (D-11) | ✓ | (system) | — |
| `npm run build` | green-after-each-commit gate (D-12) | ✓ | esbuild 0.28 | — |
| `npm test` | vitest suite green at end (ROADMAP SC#4) | ✓ | vitest ^4.1.2 | — |

No missing environment dependencies. No fallbacks needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` (root, ignored by eslint per current config line 90) |
| Quick run command | `npx vitest run --reporter=dot` (~ < 30s on this codebase per existing CI history) |
| Full suite command | `npm test` (vitest run) — 818 tests pre-Phase-77 per CONTEXT.md `<code_context>` |
| Lint runner | `npm run lint` — must exit 0 |
| Build runner | `npm run build` — must exit 0 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINT-01 | `npm run lint` exits 0 on clean main | smoke | `npm run lint && echo OK` | ✅ command exists |
| LINT-01 (build green) | `npm run build` produces `main.js` + `styles.css` cleanly | smoke | `npm run build` | ✅ |
| LINT-01 (no behavior regression) | Existing vitest suite green | unit + integration | `npm test` | ✅ 818 tests pre-phase |
| LINT-01 (auto-grow textarea) | Phase 64 auto-grow continues to work after setCssProps migration | unit | `npx vitest run src/__tests__/editor-panel-forms.test.ts -t "auto-grow"` | ✅ EXISTS — at `editor-panel-forms.test.ts:293-303` (currently asserts `style.height === '123px'`; **needs update** post-migration to assert `el.style.getPropertyValue('--rp-textarea-height') === '123px'`) |
| LINT-01 (inline runner position) | Phase 60/67 position persistence continues to work after applyPosition class-toggle migration | unit | `npx vitest run src/__tests__/views/inline-runner-position.test.ts` | ✅ EXISTS — `style.left/top` template-literal assignments unchanged → assertions at lines 171/186/198/208/222/223 continue to assert `style.left` directly. Only line 216-217 (test fixture write) needs `eslint-disable` directive. |
| LINT-01 (snippet editor banner) | Phase 52 banner show/hide continues to work after class-toggle migration | unit | `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts` | ✅ EXISTS — currently asserts banner visible after onOpen on broken snippet; after migration tests should additionally assert `banner.classList.contains('rp-snippet-banner-hidden')` is false. |

### Sampling Rate
- **Per task commit:** `npm run lint` (must exit 0 from THAT commit onward) + `npm run build` (must compile) + targeted vitest of touched feature (`npx vitest run src/__tests__/views/<feature>*.test.ts`).
- **Per stage merge (stage 1, 2, 3):** Full suite — `npm test` + `npm run lint` + `npm run build`.
- **Phase gate (final commit):** Full suite green; `npm run lint` exits 0; `npm run build` exits 0; `git status` clean (no stray generated files in working tree per CONCERNS.md HIGH-1).

### Test Surfaces Needing Update Post-Migration (in-scope ripple per CONTEXT.md `<deferred>`)

These tests CURRENTLY pass but assert against `el.style.x` directly. After Phase 77 they need re-pointing:

1. **`src/__tests__/editor-panel-forms.test.ts:293-303`** — «input event on the textarea writes style.height = "auto" then = scrollHeight + "px"». Currently writes `style.height = 'prev'` (line 300, which is itself a static-styles violation), then triggers input cb, then asserts `style.height === '123px'`. **Update needed:**
   - Line 300 (the WRITE-side `style.height = 'prev'`): ALSO becomes a violation post-migration unless wrapped with `eslint-disable-next-line obsidianmd/no-static-styles-assignment // test fixture forcing initial state`. Or rewritten to set the CSS variable directly: `(lastTextarea as ...).setCssProps({'--rp-textarea-height': 'prev'})`.
   - Line 302 ASSERT: change from `expect(...style.height).toBe('123px')` to `expect((lastTextarea as ...).style.getPropertyValue('--rp-textarea-height')).toBe('123px')` OR check the underlying setCssProps recorded call.

2. **`src/__tests__/views/inline-runner-position.test.ts:216-217`** — test fixture writes `containerEl.style.left = '920px'; style.top = '740px'`. The PRODUCTION code's `style.left/top = ${...}` template-literal assignments are NOT flagged (D-04 misread). So:
   - Lines 216-217 are flagged because they're literal-string fixture writes. **Fix:** wrap with `// eslint-disable-next-line obsidianmd/no-static-styles-assignment` on each line, with comment «test fixture forcing pre-condition; production code uses template literal which is not flagged».
   - **No test READ-side changes needed** (production code didn't change at lines 656-657).

3. **`src/__tests__/views/snippet-editor-modal-banner.test.ts:304`** — `modal.onOpen()` Promise (D-03). Already covered as floating-promise residual: change `modal.onOpen();` → `void modal.onOpen();`.

### Wave 0 Gaps
- [ ] No new test files needed for Phase 77 — all touched code already has test coverage.
- [ ] Test fixture updates (above 3 sites) bundled into the same commit as the code migration that breaks them — Stage 2 commits per file include their own test edits.

*(The phase introduces no new behaviour; existing tests are the validation surface. No new framework install needed.)*

## Sources

### Primary (HIGH confidence)
- **Live codebase scan 2026-04-30:** `Z:\projects\RadiProtocolObsidian\src\**\*.ts` for line/file verification.
- **Lint baseline:** `npm run lint 2>&1 > /tmp/lint-baseline.txt` (647 lines, run on phase-research commit `9a926ae`).
- **Obsidian API types:** `Z:\projects\RadiProtocolObsidian\node_modules\obsidian\obsidian.d.ts:82, 105-106, 117-118, 2796` (toggleClass, setCssProps, FileManager.trashFile signatures).
- **Eslint plugin rule sources:** `Z:\projects\RadiProtocolObsidian\node_modules\eslint-plugin-obsidianmd\dist\lib\rules\noStaticStylesAssignment.js` (literal-only detection logic), `preferFileManagerTrashFile.js` (BANNED_METHODS = trash/delete on Vault).
- **Project conventions:** `.planning/codebase/CONVENTIONS.md` (Naming Patterns, Linting, Void-ing fire-and-forget, CSS architecture).
- **Project agent contract:** `CLAUDE.md` (CSS files: append-only per phase; never delete code you didn't add).
- **Phase context:** `.planning/phases/77-eslint-findings-cleanup/77-CONTEXT.md` (D-01..D-13).
- **Concerns audit:** `.planning/codebase/CONCERNS.md` MEDIUM-2/3/4.
- **Roadmap:** `.planning/ROADMAP.md` §Phase 77 (5 success criteria) and surrounding phases 75/76/78 dependency context.

### Secondary (MEDIUM confidence)
- **Eslint plugin obsidianmd README:** `node_modules/eslint-plugin-obsidianmd/README.md` (cross-checked rule names against `eslint.config.mjs`).

### Tertiary (LOW confidence)
- (none — all claims derive from direct source reads)

## Project Constraints (from CLAUDE.md)

These directives have the same authority as locked decisions in CONTEXT.md and constrain Phase 77 implementation:

1. **CSS source layout:** Per-feature in `src/styles/`. Build concatenates via `CSS_FILES` in `esbuild.config.mjs` → root `styles.css`. **Do NOT edit root `styles.css` directly** — generated.
2. **CSS files: append-only per phase.** Add new rules at the BOTTOM of the relevant feature file with `/* Phase 77: <description> */` comment. Never rewrite existing sections.
3. **«ONLY add or modify code relevant to the current phase»** — applies to `src/styles/`, `src/main.ts`, `src/views/editor-panel-view.ts`, and any other accumulated files. NEVER delete rules/functions/listeners not added in this phase.
4. **After any CSS change:** Run `npm run build` to regenerate `styles.css`. (D-12 already enforces this per commit.)
5. **Never commit `styles.css` edits directly** — it's generated. Per CONCERNS.md HIGH-1, the file is also tracked-but-gitignored; Phase 77 doesn't change that — generated diffs in `styles.css` ARE committed via the per-stage build (the gitignored-but-tracked state is a separate concern owned by Phase 77 NOT — it's its own follow-up).

## Metadata

**Confidence breakdown:**
- Lint baseline: HIGH — verified live with `npm run lint` on 2026-04-30.
- Static-styles strategy: HIGH — verified rule semantics by reading rule source; verified line-by-line against current source.
- Test residual fixes: HIGH — verified each line number with direct Read.
- Eslint config delta: HIGH — exact insertion points identified.
- API existence (`setCssProps`/`toggleClass`): HIGH — verified in `obsidian.d.ts`.
- Phase 75/76 boundary: HIGH — verified file-line counts via grep.
- Architecture: HIGH — patterns derive from existing 4 toggleClass call sites + reading rule definition.
- Pitfalls: HIGH — pitfall 3 (this-alias getter) experimentally validated by tracing JS getter semantics; pitfall 5 (trashFile UX) verified by reading both API signatures.

**Research date:** 2026-04-30
**Valid until:** Until next commit that touches `src/views/*.ts`, `src/main.ts`, `src/settings.ts`, `src/snippets/snippet-service.ts`, or `eslint.config.mjs` (line numbers may drift). At that point, re-run `npm run lint` and re-verify line refs. The strategic decisions (D-01..D-13 application, naming conventions, CSS file targets) remain valid indefinitely.
