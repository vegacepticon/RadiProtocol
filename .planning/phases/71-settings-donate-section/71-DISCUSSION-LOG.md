# Phase 71: Settings — Donate Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 71-settings-donate-section
**Areas discussed:** Строка кошелька (DOM + адрес + copy), EVM-ряд, Visual hierarchy + CSS, Тексты + константы + тесты

---

## Строка кошелька (DOM + адрес + copy)

### Q1 — DOM-структура строки

| Option | Description | Selected |
|--------|-------------|----------|
| Obsidian `new Setting()` | Консистентно с остальной вкладкой; `setName/setDesc/addExtraButton`. | ✓ |
| Кастомный DOM через createDiv | Полный контроль над вёрсткой, но больше CSS, рассинхрон с Obsidian-темами. | |
| Гибрид | `new Setting()` + кастомный `<code>` через `descEl.createEl`. | |

**User's choice:** Obsidian `new Setting()`.

### Q2 — Формат отображения адреса

| Option | Description | Selected |
|--------|-------------|----------|
| Полный адрес в `<code>` | `descEl.createEl('code', ...)` с `word-break: break-all`. Anti-phishing — пользователь видит весь адрес. | ✓ |
| Truncate-middle | `0x0B52…2A` с tooltip полного. Анти-паттерн для крипты. | |
| Полный без monospace | `setDesc` с обычным шрифтом. Плохая разборчивость 0/O, l/1/I. | |

**User's choice:** Полный адрес в `<code>`.

### Q3 — Copy-контрол

| Option | Description | Selected |
|--------|-------------|----------|
| Icon-only `addExtraButton('copy')` | Lucide `copy` + `setTooltip`. Obsidian-конвенция в settings. | ✓ |
| Текстовая кнопка «Скопировать» | Понятнее новичкам, но жирнее в ряду и нестандартно. | |
| Click по адресу + icon-кнопка | Дублирующий affordance, ломает «select-to-verify». | |

**User's choice:** Icon-only `addExtraButton('copy')`.

### Q4 — Обработка `clipboard.writeText` reject

| Option | Description | Selected |
|--------|-------------|----------|
| Игнорируем (как runner-view) | `void clipboard.writeText().then(() => new Notice(...))` без `.catch`. Электрон надёжен. | ✓ |
| `.catch` → Notice об ошибке | Вежливо, но расходится с проектным паттерном. | |
| Try-catch + execCommand fallback | Избыточно для Electron-only плагина. | |

**User's choice:** Игнорируем по паттерну `runner-view.ts:1107`.

---

## EVM-ряд

### Q1 — Подача 6 сетей на 1 адрес

| Option | Description | Selected |
|--------|-------------|----------|
| `name='EVM'`, desc=сети + адрес | Короткое имя в левом слоте, симметрично с BTC/SOL/TRX. | ✓ |
| `name='Ethereum / Linea / ...'` | Длинная строка в name-слоте, ломает выравнивание. | |
| `name='EVM-совместимые сети'` | Русский ярлык, расходится с английскими «Bitcoin/Solana/Tron». | |

**User's choice:** `name='EVM'`, desc = список сетей + `<code>` адрес.

### Q2 — Порядок 9 кошельков (4 рядов)

| Option | Description | Selected |
|--------|-------------|----------|
| EVM → BTC → SOL → TRX (REQUIREMENTS) | Точно как в REQUIREMENTS DONATE-01 / ROADMAP SC#2. | ✓ |
| BTC → EVM → SOL → TRX | BTC исторически старший. Расходится с REQUIREMENTS. | |
| По market-cap | Рационально, но требует обоснования при audit и future churn. | |

**User's choice:** EVM → BTC → SOL → TRX (по REQUIREMENTS).

### Q3 — Порядок 6 EVM-сетей в desc

| Option | Description | Selected |
|--------|-------------|----------|
| Точно как в REQUIREMENTS | Ethereum, Linea, Base, Arbitrum, BNB Chain, Polygon. | ✓ |
| По алфавиту | Arbitrum, Base, BNB Chain, Ethereum, Linea, Polygon. | |
| Ethereum + остальное по TVL | Future churn. | |

**User's choice:** Точно как в REQUIREMENTS.

### Q4 — Разделитель имён сетей

| Option | Description | Selected |
|--------|-------------|----------|
| ` · ` middle dot | Читабельно, тише слэшей. | ✓ |
| ` / ` слэш | Из REQUIREMENTS, dev-стиль. | |
| `, ` запятая | Нейтрально, но плохо сканируется. | |

**User's choice:** ` · ` middle dot (U+00B7).

---

## Visual hierarchy + CSS

### Q1 — Заголовок секции

| Option | Description | Selected |
|--------|-------------|----------|
| Obsidian-нативный `setHeading()` | Идентично Runner/Protocol/Output/Storage; выделяется только позицией+русским. | ✓ |
| Custom heading с emoji ❤️/☕ | Привлекает, но «попрошайничает», нетипично для community-плагинов. | |
| Custom heading + border/background | Callout-рамка, расходится с Obsidian эстетикой. | |

**User's choice:** Obsidian-нативный `setHeading()`.

### Q2 — Отдельный CSS-файл

| Option | Description | Selected |
|--------|-------------|----------|
| Новый `donate-section.css` | Соответствует CLAUDE.md Critical Rule. | ✓ |
| Inline-стили на элементах | Нарушает CLAUDE.md «new feature → новый CSS-файл». | |
| Приписать к runner-view.css | Запрещено CLAUDE.md «Do NOT add CSS to an unrelated feature file». | |

**User's choice:** Новый `src/styles/donate-section.css` + регистрация в `esbuild.config.mjs` CSS_FILES.

### Q3 — Стилизация `<code>` с адресом

| Option | Description | Selected |
|--------|-------------|----------|
| Нативный + только `word-break` (+ display:block + margin-top) | Полагаемся на Obsidian тему, минимальные правки. | ✓ |
| Перепределить font-size + padding | Риск рассинхрона с темами. | |
| Полный custom (без Obsidian default) | Риск расхождения с Obsidian-токенами. | |

**User's choice:** Нативный + только word-break (плюс `display: block` и `margin-top`).

---

## Тексты + константы + тесты

### Q1 — Текст приглашения

| Option | Description | Selected |
|--------|-------------|----------|
| «Если плагин оказался полезен — поддержать разработку можно переводом на один из этих кошельков.» | Одна фраза, нейтральный тон. | |
| «Спасибо за поддержку! Если RadiProtocol экономит вам время — буду рад любому переводу.» | Тёплый «я»-тон от автора. | ✓ |
| Развёрнутый абзац (2-3 фразы) | Больше контекста, больше высоты. | |

**User's choice:** «Спасибо за поддержку! Если RadiProtocol экономит вам время — буду рад любому переводу.»

### Q2 — Текст Notice

| Option | Description | Selected |
|--------|-------------|----------|
| «Адрес скопирован» | Русский, симметричен с заголовком/invitation. | ✓ |
| Network-specific («Bitcoin адрес скопирован» и т.д.) | Подтверждает что именно скопировано, сложнее. | |
| «Copied to clipboard.» (как runner-view) | Английский в русскоязычной секции — рвано. | |

**User's choice:** «Адрес скопирован».

### Q3 — Расположение констант

| Option | Description | Selected |
|--------|-------------|----------|
| Новый `src/donate/wallets.ts` | Типизированный массив, изолирует для тестирования. | ✓ |
| Inline в `settings.ts` | Минимум файлов, но раздувает settings.ts. | |
| Inline в `display()` | Пересоздаётся при каждом open, плохо тестируется. | |

**User's choice:** Новый `src/donate/wallets.ts` с типизированным `DONATE_WALLETS`.

### Q4 — Unit-тесты

| Option | Description | Selected |
|--------|-------------|----------|
| Валидация констант | Проверка 4 рядов, точных адресов, EVM 6 сетей в порядке. Дешёвый tripwire против опечатки. | ✓ |
| Константы + DOM-render тест | Полнее, но дороже (мокать PluginSettingTab). | |
| Без тестов, только UAT | Опечатка обнаружится только пользователем. | |

**User's choice:** Валидация констант (`src/__tests__/donate/wallets.test.ts`).

---

## Claude's Discretion

- Точное имя CSS-класса (`rp-donate-address` / `rp-donate-intro` / `rp-donate-section`).
- Стоит ли вынести invitation/notice строки в отдельный модуль (`src/donate/i18n.ts`).
- Точные значения CSS (`margin-top: 4px` vs `8px`; `word-break: break-all` vs `overflow-wrap: anywhere`).
- Финальный wording tooltip кнопки.
- Стоит ли ставить класс на `.setting-item` всей секции для будущей CSS-доработки.
- `setting.descEl.createEl('code', ...)` vs `appendChild(document.createElement('code'))`.
- Точная формулировка `/* Phase 71: ... */` комментария-маркера в новом CSS-файле.
- Группировать секцию через обёртку `containerEl.createDiv({ cls: 'rp-donate-section' })` или нет.

## Deferred Ideas

- QR-коды для адресов (упростят перевод с мобильного, но не в REQUIREMENTS).
- Multi-language toggle (EN/RU UI) — отдельная инфраструктурная работа.
- External donate-page link / GitHub Sponsors / Buy-me-a-coffee — запрещено DONATE-01 SC#4.
- Configurable wallet list / user-добавляемые адреса — out-of-scope per SC#4 («hard-coded constants»).
- DOM-render unit-тест с моком `PluginSettingTab` — отвергнуто как избыточно дорогое.
- Try/catch + `execCommand('copy')` fallback — отвергнуто, проектный паттерн без fallback.
- Truncate-middle отображение — отвергнуто, anti-phishing приоритет.
- Custom heading с emoji / border-callout — отвергнуто, не Obsidian-эстетика.
