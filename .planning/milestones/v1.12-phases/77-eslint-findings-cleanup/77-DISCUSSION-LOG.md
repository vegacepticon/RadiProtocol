# Phase 77: Eslint Findings Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 77-eslint-findings-cleanup
**Areas discussed:** Lint scope, Tests: tune vs fix, Static-styles стратегия, Координация с 75/76

**Discussion language:** Russian (per user preference / memory `feedback_language.md`)

**Pre-discussion data gathering:** Запущен `npm run lint` для получения реальных counts. Обнаружено существенное расхождение с ROADMAP/REQUIREMENTS narrative (claimed dominant rule `no-static-styles-assignment`, real dominant rules `no-unused-vars` 243 + `no-explicit-any` 191, оба почти полностью в тестах). По местоположению: 439 в тестах/моках (84%), 9 в `.planning/archive/`, 75 в реальном `src/`. Это переформулировало стратегию обсуждения.

---

## Gray Area Selection

| Option | Description | Selected |
|---|---|---|
| Lint scope | Что вообще должен линтить `eslint .`? Сейчас сканирует тесты, моки, и `.planning/archive/` (9 находок в архивных canvas-builder скриптах). | ✓ |
| Тесты: tune vs fix | 430+ находок в тестах/моках — `_underscore`-префиксные unused и `any` в моках. Конфиг-overrides убирает их одним блоком; рефакторинг каждого теста — низкая ценность, высокий churn. | ✓ |
| Static-styles стратегия | 39 находок в src/views — единственная категория где CLAUDE.md прямо предписывает CSS-классы. Но Phase 60/67 ставят `style.left/top/width/height` из runtime-state — для них уместнее `setCssProps` + CSS custom properties. | ✓ |
| Координация с 75/76 | Phase 75 переписывает runner-view.ts и inline-runner-modal.ts (там 14 из 39 static-style violations). Phase 76 переписывает editor-panel-view.ts. ROADMAP говорит «независимы», но файлы пересекаются. | ✓ |

**User selection:** Все четыре area.

---

## Lint scope

### Q1: 9 находок в `.planning/archive/v1.11-phases/72.../73.../build/*.mjs` — это архивные canvas-builder скрипты из завершённой v1.11. Что с ними?

| Option | Description | Selected |
|---|---|---|
| Добавить .planning/ в ignores (Recommended) | Архив завершённых фаз — не active code; CONCERNS.md уже подтвердил что v1.0-v1.10 материалы перемещены в archive именно как историческая референция. Линту там делать нечего. | ✓ |
| Оставить в scope, фиксить | Если планируется в будущем восстанавливать canvas-builder скрипты — лучше держать их чистыми. Но v1.12 specifically НЕ модифицирует canvas library. | |
| Игнорировать только сами .mjs файлы | Узкая выемка — только `**/*.mjs` или конкретные пути. Сохраняет .planning/ в scope для будущих .ts-фрагментов. | |

**User's choice:** Добавить .planning/ в ignores
**Notes:** Перешло в D-01 в CONTEXT.md.

### Q2: 439 находок в src/__tests__/ и src/__mocks__/ — почти всё `_underscore`-префиксные параметры моков (`no-unused-vars`) и `any` для гибких type-mocks (`no-explicit-any`). Стратегия?

| Option | Description | Selected |
|---|---|---|
| Overrides блок для тестов (Recommended) | В eslint.config.mjs добавить override на `src/__tests__/**` и `src/__mocks__/**`: `no-explicit-any: 'off'` и `no-unused-vars: ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]`. Justification — мокам нужен `any`, underscore-префикс это уже принятая convention. ~430 находок исчезают. | ✓ |
| argsIgnorePattern глобально + tests без 'any' | Global argsIgnorePattern: '^_' (это и так стандарт TS-eslint default) — убирает ~243 unused-var, оставляет ~191 'any' в тестах. Затем рефакторим 'any' → конкретные типы вручную. Высокий churn, но lint scope без overrides. | |
| Полностью убрать тесты из lint scope | `ignores: ['src/__tests__/**', 'src/__mocks__/**']`. Тесты больше не линтятся вообще. Простой ход, но теряем lint-coverage реального код тестов (catch typos, unused imports). | |
| Рефакторить вручную всё | Никаких overrides; убираем underscore-префиксы (заменяем на rest-args или удаляем) и заменяем все `any` на `unknown` / конкретные mock-типы. Высокий churn, потенциал ломать тесты. | |

**User's choice:** Overrides блок для тестов
**Notes:** Перешло в D-02 в CONTEXT.md.

### Q3: По Lint scope ещё вопросы, или переходим к Tests: tune vs fix?

| Option | Description | Selected |
|---|---|---|
| Переходим дальше | Lint scope решён — .planning/ в ignores, overrides-блок для тестов/моков. | ✓ |
| Ещё вопросы | Есть что уточнить по этому area. | |

**User's choice:** Переходим дальше

---

## Tests: tune vs fix

(Большая часть решена в Lint scope Q2.)

### Q1: Эти 6 остаточных находок в тестах — фиксить вручную или расширять overrides?

(После основных overrides в тестах останутся: 3 × `no-this-alias` в моках inline-runner, 1 × `no-floating-promises` в snippet-editor-modal-banner.test.ts, 2 × `obsidianmd/ui/sentence-case` в test fixtures snippet-tree-picker.)

| Option | Description | Selected |
|---|---|---|
| Фиксить вручную (Recommended) | 3 this-alias → arrow function или explicit `this: T` тип, 1 floating-promise → `void` или await, 2 sentence-case → поправить фикстуры. Overrides остаётся узким — только то что реально обоснованно (any + _underscore convention). | ✓ |
| Расширить overrides | Добавить `no-this-alias: 'off'`, `no-floating-promises: 'off'`, `obsidianmd/ui/sentence-case: 'off'` в test override-блок. Меньше ручной работы, но больше «силенцеров» в конфиге. | |
| Гибрид | no-this-alias в override (конвенция моков часто использует self=this), остальные фиксить. | |

**User's choice:** Фиксить вручную
**Notes:** Перешло в D-03 в CONTEXT.md.

---

## Static-styles стратегия

**Pre-question code-spelunking:**
- `inline-runner-modal.ts:654-677` `applyPosition` + `applyLayout` — Phase 60/67 runtime persisted user position+size; CSS-классом не выразить.
- `runner-view.ts:1052-1069` — `renderPreviewZone` auto-grow textarea (Phase 64 pattern).
- `editor-panel-view.ts:525-533, 655-663` — auto-grow shared helpers (Phase 64).
- `snippet-manager-view.ts:911, 937` — eslint парсит как `style.undefined` потому что `style['display']` (computed access); реальный код — display toggle для inline-rename UX.

### Q1: Как разделить 39 static-style находок между CSS-классами и setCssProps?

| Option | Description | Selected |
|---|---|---|
| Гибрид по природе (Recommended) | Static state toggles (display, opacity, color, pointerEvents) → CSS-класс + правило в соотв. src/styles/*.css. Runtime geometry (position, dynamic width/height) → setCssProps c CSS custom properties (`--rp-inline-left`, `--rp-textarea-height`). Около 25 в CSS-классы, ~14 в setCssProps. | ✓ |
| Всё через setCssProps | Даже статические toggles — через setCssProps `{'--rp-display': 'none'}` + var() в CSS. Не противоречит CLAUDE.md, но идёт против per-feature CSS-архитектуры. | |
| Всё через CSS-классы | Для geometry — сгенерируем CSS-классы по snap в скватизованных ступенях. Сломает Phase 60/67 «layout persists pixel-accurate» invariant. | |

**User's choice:** Гибрид по природе
**Notes:** Перешло в D-04 в CONTEXT.md.

### Q2: Какая convention для имён static-state toggle классов?

| Option | Description | Selected |
|---|---|---|
| `is-*` (Obsidian core convention) | Obsidian core использует `.is-active`, `.is-hidden`, `.is-disabled`. Это общепринятый BEM-style modifier. Риск: высокая вероятность коллизии с Obsidian core. | |
| `rp-*-hidden` / `rp-*-disabled` (Recommended) | Сохраняет namespace `rp-` (конвенция проекта per CONVENTIONS.md), но добавляет modifier в конец: `.rp-snippet-banner-hidden`, `.rp-chip-disabled`. Понятно и безопасно. | ✓ |
| `rp-is-*` | Комбинация — namespace + Obsidian-style modifier: `.rp-is-hidden`. Гибрид, но переизобретает колесо. | |

**User's choice:** `rp-*-hidden` / `rp-*-disabled`
**Notes:** Перешло в D-05 в CONTEXT.md. CSS custom property convention `--rp-{component}-{prop}` (D-06) выведена параллельно.

### Q3: По Static-styles ещё вопросы, или переходим к Координации с 75/76?

| Option | Description | Selected |
|---|---|---|
| Переходим к 4/4 | Static-styles решён — гибрид, namespace `rp-{component}-{state}`, runtime geometry через setCssProps + CSS custom properties. | ✓ |
| Ещё вопросы | Что-то ещё надо обсудить по стратегии static-styles. | |

**User's choice:** Переходим к 4/4

---

## Координация с 75/76

**Pre-question impact analysis:**
- runner-view.ts: 5 находок (3 style + 2 unused). Phase 75 вытащит `renderPreviewZone` (1052-1069) в shared `RunnerRenderer`.
- inline-runner-modal.ts: 7 (5 style + 2 unused). Phase 75 вытащит render-методы; НО `applyPosition`/`applyLayout` (5 style) — host chrome, остаётся в host shell.
- editor-panel-view.ts: 2 (style — auto-grow helper). Phase 76 либо оставит в диспетчере, либо вынесет в `forms/shared.ts`.
- Из 75 src-находок только ~14 в файлах 75/76; ~61 в файлах вне scope (snippet-*, settings.ts, main.ts, etc.).

### Q1: Порядок Phase 77 относительно 75/76 (ROADMAP говорит «независимы», но файлы пересекаются)?

| Option | Description | Selected |
|---|---|---|
| 77 раньше 75/76 (Recommended) | Зафиксировать lint baseline первым — 75/76 наследуют чистые patterns в новых модулях. Риск: в ~14 находок runner/editor-panel фикс может быть частично сдвинут в новые файлы при рефакторинге (тривиально: setCssProps-вызов переезжает в RunnerRenderer, CSS-rules в src/styles/ остаются). 78 (CI gate) потом отловит любой регресс. | ✓ |
| 77 после 75/76 | Дать рефакторингу сделать своё — у 75/76 ломаются большие куски кода. Потом 77 вычищает финальный layout. Нет переделывания, но Phase 78 (CI gate) ждёт дольше. | |
| Гибрид: 77a без-перекрытия → 75/76 → 77b | 77a — config overrides + ~60 находок в не-перекрывающихся файлах. Затем 75/76 в любом порядке. Затем 77b — ~14 оставшихся в runner/editor-panel в их финальном layout. Добавляет фазы/работу, но ноль переделывания. | |

**User's choice:** 77 раньше 75/76
**Notes:** Перешло в D-08, D-09, D-10 в CONTEXT.md.

### Q2: Если 77 идёт первым — какой коммит-гранулярность для atomic-rollback?

| Option | Description | Selected |
|---|---|---|
| Per-rule и per-file (Recommended) | 1 коммит = 1 rule в 1 файле (или одно связное множество по файлу). ~12-15 коммитов. Легко откатить любой фикс если всплывёт regression. Соответствует GSD-паттерну atomic per task. | ✓ |
| Per-file (1 commit per file) | 1 коммит = все lint-фиксы в одном файле + соответствующие CSS-правила. ~10 коммитов. Чище история по файлу, но rollback группы фиксов вместе. | |
| Per-stage (config / styles / misc) | Stage 1: config overrides + .planning/ ignore (1 commit). Stage 2: все 39 static-style в src/views (1 commit + CSS). Stage 3: остальное (1 commit). Минимум коммитов, максимум blast radius при rollback. | |

**User's choice:** Per-rule и per-file
**Notes:** Перешло в D-11, D-12 в CONTEXT.md.

---

## Closure

### Q: Готовы к CONTEXT.md, или есть ещё серые зоны?

| Option | Description | Selected |
|---|---|---|
| Готовы к CONTEXT.md | Пишем CONTEXT.md и DISCUSSION-LOG.md, фиксируем решения, рекомендуем /gsd-plan-phase 77. | ✓ |
| Есть ещё вопросы | Обсудить дополнительные серые зоны или уточнить решения. | |

**User's choice:** Готовы к CONTEXT.md

---

## Claude's Discretion

- Конкретные имена CSS-классов и custom properties в каждом отдельном случае. Researcher/planner следует D-05/D-06 шаблону.
- Точный порядок stage-2 коммитов между файлами — researcher/planner решит на основании зависимостей.
- Решение fix-vs-document для 2 `prefer-file-manager-trash-file` warnings — после исследования кода researcher оценит.

## Deferred Ideas

См. `<deferred>` секцию CONTEXT.md:
- MEDIUM-5 (large files protocol-runner.ts, snippet-manager-view.ts) — re-evaluate после Phase 75.
- Husky migration — revisit если команда вырастёт.
- Lint-warning long-tail — nice-to-have only if cheap.
- Inline runner tests assertions переписать после Phase 77 миграции — ripple effect внутри Phase 77.
