# Phase 70: Loop-Exit Picker Visual Hint - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 70-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 70-loop-exit-picker-visual-hint
**Areas discussed:** Тон акцента exit-кнопки, Тип CSS-маркера, Hover/focus/disabled state, Test strategy и CSS-файл

---

## Тон акцента exit-кнопки

| Option | Description | Selected |
|--------|-------------|----------|
| Жёлтый (--color-yellow) (Recommended) | Loop-контекст уже использует --color-yellow в rp-loop-iteration-label. Exit как «внимание — выход из цикла». Body остаётся на --interactive-accent. | |
| Зелёный (--color-green) | Exit как «success / done / завершить». Проект использует --color-green в editor-panel.css. Семантика: «iteration — ход, exit — финиш». | ✓ |
| Инверсия ролей | Exit получает --interactive-accent (saturated blue, primary), body становится --background-modifier-border (muted gray). Концепция: «выход — главный выбор», body — продолжения. Трогает оба правила Phase 44. | |
| Нейтральный, но ярче | Покрасить exit более насыщенным neutral (--background-modifier-active-hover) или --text-accent border, без ввода цветной семантики. | |

**User's choice:** Зелёный (--color-green)
**Notes:** Concretization picked зелёный over Recommended жёлтый. Выбор согласован с уже устоявшимся `--color-green` в `editor-panel.css:31` — токен подтверждён workable в проекте; не вводит новых color tokens. Семантический раздел: yellow loop-iteration label (Phase 44) + blue body (Phase 44) + green exit (Phase 70) — три осмысленных не-перекрывающихся цвета внутри loop UI.

---

## Тип CSS-маркера

| Option | Description | Selected |
|--------|-------------|----------|
| Solid green background (Recommended) | background: var(--color-green); color: var(--text-on-accent). Симметрично Phase 44 body конструкции. Риск: --text-on-accent ориентирован на --interactive-accent — UAT проверяет контраст. | ✓ |
| Border-left stripe | Самый «subtle»: оставляем --background-modifier-border фон, добавляем 3-4px зелёный stripe слева. Без риска contrast. Но легко пропустить в narrow sidebar. | |
| Outline / colored border (1-2px) | Рамка в --color-green; фон --background-modifier-border. Риск: визуальный конфликт с :focus-visible outline. | |
| Tinted bg + green text | Приглушённый фон (--background-modifier-success если есть) + color: green. Мягкий визуал. Риск: --background-modifier-success не верифицированный токен. | |

**User's choice:** Solid green background
**Notes:** Symmetrical с Phase 44 body конструкцией (`background + color: text-on-accent`). UAT покрывает риск text-contrast в light/dark themes. Border-left stripe оставлен как fallback в `<deferred>` если UAT провалит контраст.

---

## Hover / focus / disabled state

| Option | Description | Selected |
|--------|-------------|----------|
| filter: brightness(0.92) на hover (Recommended) | На hover слегка приглушить green; focus-visible — Obsidian default ring. Никаких новых токенов. | ✓ |
| var(--color-green-hover, --color-green) | Попытка использовать --color-green-hover с fallback. Риск: токен не существует, fallback всегда тот же — hover отсутствует. | |
| Hover-shift через box-shadow | На hover добавляем box-shadow: 0 0 0 2px var(--color-green) inset. Отличается от body-кнопки паттерну — visual inconsistency. | |
| Без hover эффекта | Hover оставляем как есть (без :hover правила). Чувство «broken interaction». | |

**User's choice:** filter: brightness(0.92) на hover
**Notes:** Универсальный CSS-fallback для отсутствующего `--color-green-hover` Obsidian-токена. Совместим с любой темой. Focus-visible не переопределяется — полагаемся на Obsidian default focus ring. Disabled state не релевантен (loop picker всегда рендерит enabled кнопки).

---

## Test strategy и CSS-файл

| Option | Description | Selected |
|--------|-------------|----------|
| Manual UAT + 1 файл (Recommended) | CSS правило append-only в src/styles/loop-support.css с /* Phase 70 */ комментом. Покрывает все 3 режима. inline-runner.css не трогаем. UAT мануально (прецедент Phase 47/60/65). Tripwire = existing class-presence test из Phase 50.1. | ✓ |
| + string-contains CSS test | К #1 добавляем brittle test: fs.readFileSync(...).includes('--color-green'). Ловит регрессии типа «executor удалит правило», но ломается при рефакторинге токена. | |
| Headless browser visual test | Playwright + screenshot regression. Out of scope — проект не использует playwright. | |
| Inline overrides в inline-runner.css | Дублирование правил в оба файла. Излишне — селектор без префикса автоматически покрывает inline. | |

**User's choice:** Manual UAT + 1 файл
**Notes:** Прецедент Phase 47 RUNFIX-03 / Phase 60 INLINE-FIX-03 / Phase 65 RUNNER-02 для CSS-only фаз — UAT в 3 режимах вручную. JSDOM не загружает CSS из stylesheet'ов → computed-style assertions невозможны. Class-presence уже покрыт Phase 50.1 D-15 + sibling tests; plan-phase верифицирует, что они остаются зелёными после Phase 70.

---

## Claude's Discretion

- Точная формулировка `/* Phase 70: ... */` коммента в `loop-support.css` — планнер выбирает, моделируя на Phase 44/47.
- Порядок CSS-свойств внутри Phase 70 секции (`background → color → :hover { filter }` или иной).
- Выбор UAT canvas (existing fixture vs live dev vault canvas).
- Прогон `npm test` в plan-phase для подтверждения D-12 — рекомендуется, не обязательно.
- Упоминание Phase 50.1 как convention origin в commit-message.

## Deferred Ideas

- **Border-left stripe** — fallback внутри Phase 70 если UAT покажет contrast issue с solid green + text-on-accent.
- **Configurable accent token (user setting)** — REQUIREMENTS Out-of-Scope row, не v1.11.
- **Visual hint в Node Editor для `+`-prefixed edges** — Phase 50.1 deferred bucket; отдельная будущая фаза.
- **Animation / transition на color change** — out-of-scope; deferred до UAT-feedback'а.
- **Keyboard-navigation focus enhancement** — отдельный runner UI focus polish phase, если accessibility audit потребует.
- **Multi-exit visual differentiation** — после Phase 50.1 D-01 релаксации до ≥1 exit edges (не v1.11).
