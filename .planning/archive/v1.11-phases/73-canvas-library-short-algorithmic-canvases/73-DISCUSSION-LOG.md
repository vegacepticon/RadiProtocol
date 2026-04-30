# Phase 73: Canvas Library — Short Algorithmic Canvases - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 73-canvas-library-short-algorithmic-canvases
**Areas discussed:** Canvas internal structure, ОМТ short sex split, snippet usage, fill-in placeholders, normal/non-normal branching level, snippet folder mapping, file naming convention

---

## Canvas internal structure (per organ system)

| Option | Description | Selected |
|--------|-------------|----------|
| Минимальная: один Text-block + Заключ./Реком. | Канвас почти линейный: Question (опционально) → большой Text-block с вербатим-текстом всего абзаца → терминальные блоки. Без развилок норма/не-норма, без снипетов — всё хардкод. | |
| С развилкой норма/не-норма (==напишу что не так==) | Базовая ветка как выше + Question «Норма?» → Да/Нет fill-in. Соответствует D-23 паттерну Phase 72. | |
| С под-блоками по органам (text-block per system) | Разбить нормальный абзац на отдельные Text-block ноды по органам/системам, линейно соединённые. Ближе по форме к полным канвасам. Даёт авторам точку ввода для будущих расширений. | ✓ |

**User's choice:** С под-блоками по органам (text-block per system)
**Notes:** Captured as D-01. Drives decision to also branch per-system (see «Норма-ветка» below).

---

## ОМТ short — пол fan-out

| Option | Description | Selected |
|--------|-------------|----------|
| Один канвас, fan-out по полу (Жен/Муж) | Канвас начинается с Question «Пол?» → Жен / Муж → разные текст-блоки. Аналог D-26 паттерна Phase 72 (ОМТ full = одна канва с sex×contrast fan-out). Соответствует ROADMAP scope (ровно 3 канваса). | ✓ |
| Два отдельных файла (ОМТ short жен / ОМТ short муж) | Два независимых .canvas файла. Проще каждый по отдельности, но это 4 канваса вместо 3 — не совпадает с CANVAS-LIB-08. | |

**User's choice:** Один канвас, fan-out по полу (Жен/Муж)
**Notes:** Captured as D-05. Sex-only fan-out (no contrast inner branching per D-06).

---

## Snippets vs hardcoded text

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode весь текст в Text-block нодах | Никаких snippet-нод. Самое простое, минимум зависимостей от папок SNIPPETS\, легче перепроверить визуально. | |
| Гибрид: общий «Костно-деструктивных» как snippet, остальное hardcode | Один snippet «кости-норма» в общей папке КОСТИ\ и все три канваса на него ссылаются. | |
| Полноценные snippet-ноды как в Phase 72 | Каждая клиническая фраза — отдельный snippet с привязкой через snippetPath. Максимально переиспользуемо. | ✓ |

**User's choice:** Полноценные snippet-ноды как в Phase 72
**Notes:** Captured as D-08. Note: short canvases have no clinical-variation branching at the «норма» trunk; snippet-pickers per D-09 are primarily wired into the «Нет» branch from the per-system Question (D-02). Generator may also offer optional snippet pickers under «Да» path for fine-tuning, at its discretion.

---

## Fill-in placeholders

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-27 ==fill-in== chips inside Text-block (D-29 pattern) | Каждое пустое место заворачивается в ==fill-in== chip, который при run-time подставляется через Phase-27 fill-in modal. Полностью соответствует D-29 из Phase 72. | ✓ |
| Оставить пустые места как пробелы в тексте (без чипов) | Канвас выводит текст как есть. Автор сам редактирует результат после прогона в Obsidian. Проще, но теряется UX-параллель с full-канвасами. | |
| Заменить на Question→Answer для каждого измерения | Вместо чипов — отдельный Question-нод с free-text Answer. Структурно, но превращает короткий канвас в длинный (5+ вопросов в ОМТ). | |

**User's choice:** Phase-27 ==fill-in== chips inside Text-block (D-29 pattern)
**Notes:** Captured as D-12 (measurement gaps in ОМТ) and D-13 (Заключение «РКТ-признаки » diagnosis line).

---

## Норма-ветка (level of normal/non-normal branching)

| Option | Description | Selected |
|--------|-------------|----------|
| Пер орган/систему: отдельный Question перед каждым text-block | Каждый орган-блок предваряется Question «Норма?» → Да = вербатим-text-block / Нет = ==напишу что не так== fill-in или snippet-picker. ОГК = 1 вопрос, ОБП = 1, ОМТ = 1+1 (пол × 1) — компактно. | ✓ |
| Один Question «Норма?» на весь канвас | Одно «Норма?» в начале → Да = весь нормальный отчёт линейно / Нет = ==напишу что не так==. Проще для автора при прогоне (1 клик), но нет гранулярности. | |
| Без развилок норма/не-норма — всегда выводим вербатим | Канвас линейно проходит все text-block + snippet ноды. Самое простое, но несовместимо с «snippet-ноды как в Phase 72» (там snippet-picker подразумевает выбор варианта). | |

**User's choice:** Пер орган/систему: отдельный Question перед каждым text-block
**Notes:** Captured as D-02. ОГК canvas: 1 Question; ОБП canvas: 1 Question; ОМТ canvas: 1 sex Question + 1 «Норма?» per shared system on each sex branch. Fine-grained authoring control — author can mark e.g. ОГК normal but ОМТ abnormal in the same protocol run.

---

## Snippet-папки (mapping to existing SNIPPETS\)

| Option | Description | Selected |
|--------|-------------|----------|
| Переиспользовать те же папки что и full (SNIPPETS\ОГК\, SNIPPETS\ОБП\, etc.) | Short канвасы используют тот же набор snippet-папок из SNIPPETS\, что и полные (Phase 72 D-04 cross-canvas isolation выдерживается). Никаких новых папок создавать не нужно. | ✓ |
| Новые short-подпапки (SNIPPETS\ОГК short\, etc.) | Создать выделенные папки для short-вариантов фраз. Изоляция от full, но раздувает структуру. Phase 72 D-15 запрещает pre-creation папок. | |
| Автор конфигурирует пути сам после генерации (D-15 Phase 72) | Генератор создаёт snippet-ноды с placeholder путями, автор переназначает в EditorPanel. Блокирует end-to-end верификацию скриптом. | |

**User's choice:** Переиспользовать те же папки что и full (SNIPPETS\ОГК\, SNIPPETS\ОБП\, etc.)
**Notes:** Captured as D-09. Cross-canvas isolation (Pitfall 9) preserved: ОГК short references only `SNIPPETS\ОГК\…`; ОБП short only `SNIPPETS\ОБП\…`; ОМТ short only `SNIPPETS\ОМТ\…`. Shared `SNIPPETS\КОСТИ\` may be used per D-11.

---

## Имена файлов

| Option | Description | Selected |
|--------|-------------|----------|
| 'ОГК short 1.0.0.canvas', 'ОБП short 1.0.0.canvas', 'ОМТ short 1.0.0.canvas' | Параллельно Phase 72 паттерну ('ОМТ full 1.0.0.canvas', 'ОБП full 1.0.0.canvas'). Суффикс 'short' явно отличает от full-версии. | ✓ |
| 'Короткий ОГК 1.0.0.canvas', 'Короткий ОБП 1.0.0.canvas', 'Короткий ОМТ 1.0.0.canvas' | Полностью кириллические имена. Префикс «Короткий» помещает файлы вместе в алфавитном списке. Отличается от Phase 72 паттерна. | |

**User's choice:** 'ОГК short 1.0.0.canvas', 'ОБП short 1.0.0.canvas', 'ОМТ short 1.0.0.canvas'
**Notes:** Captured as D-18. Mirror of Phase 72 'X full 1.0.0.canvas' / 'X 1.0.0.canvas' naming pattern.

---

## Claude's Discretion

- Exact node x/y coordinates in canvas — generator may auto-layout or copy Phase 72 spatial conventions
- Russian wording of per-system Question prompts beyond the literal «Норма?» (e.g., «Норма ОГК?» / «ЛЕГКИЕ норма?») — generator picks consistent style
- Whether the «Костно-деструктивных» line is its own text-block or appended to the last organ-system text-block per canvas — generator chooses
- How to render visible separation between organ-system text-blocks (newline-prefixed strings vs separate blank text-blocks)
- Whether to fork `canvas-builder.mjs` from Phase 72 or import it directly — implementation detail

## Deferred Ideas

- Public canvas library / community publication of v1.11 canvases — out of scope (deferred from Phase 72)
- Snippet folder pre-creation — explicitly deferred per Phase 72 D-15
- Multi-finding short canvases (loops in short variants) — short templates have no multi-instance scenarios; out of scope
- Migrating full-canvas snippets to a shared library structure — out of scope
- Fill-in chips on Рекомендации line — only diagnosis line gets a chip (D-13)
