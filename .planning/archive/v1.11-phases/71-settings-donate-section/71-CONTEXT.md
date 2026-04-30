# Phase 71: Settings — Donate Section - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 71 добавляет секцию **«Помочь разработке»** первым (top-most) блоком в `RadiProtocolSettingsTab.display()` (`src/settings.ts:58`), выше существующих групп Runner / Protocol / Output / Storage. Секция содержит русский invitation-абзац и **9 крипто-адресов в 4 рядах**: 1 объединённый EVM-ряд (адрес `0x0B528dAF919516899617C536ec26D2d5ab7fB02A`, разделяемый между Ethereum / Linea / Base / Arbitrum / BNB Chain / Polygon), Bitcoin (`bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7`), Solana (`HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA`), Tron (`TPBbBauXk56obAiQMSKzMQgsnUiea12hAB`). У каждого ряда — Obsidian icon-кнопка copy-to-clipboard, копирующая полный (нетранкированный) адрес и показывающая transient `Notice('Адрес скопирован')`.

Адреса — **hard-coded constants** в новом модуле `src/donate/wallets.ts` (типизированный `DONATE_WALLETS`). Никакого persistence (`RadiProtocolSettings` не расширяется), никаких ссылок наружу, никакой аналитики, никаких сетевых запросов.

**In scope:**
- Новый файл `src/donate/wallets.ts` — типизированный `DONATE_WALLETS: ReadonlyArray<{ name: string; networks?: readonly string[]; address: string }>` (4 элемента: EVM, Bitcoin, Solana, Tron) + экспорт invitation/notice строковых констант.
- Правка `src/settings.ts:RadiProtocolSettingsTab.display()` — добавление секции «Помочь разработке» перед `// Group 1 — Runner`. Использует `new Setting(containerEl).setName(...).setHeading()` для заголовка, `containerEl.createEl('p', ...)` для invitation, `new Setting(...).setName(...).setDesc(...).addExtraButton(...)` для каждого ряда.
- Новый файл `src/styles/donate-section.css` (registered в `esbuild.config.mjs` `CSS_FILES`) — минимальные правила для `<code>` внутри `.setting-item-description` (word-break, display:block, margin-top).
- Регенерация `styles.css` через `npm run build`.
- Новый файл `src/__tests__/donate/wallets.test.ts` — unit-тесты валидации констант (4 ряда, точный порядок EVM→BTC→SOL→TRX, точные адреса из REQUIREMENTS, EVM содержит ровно 6 сетей в порядке Ethereum/Linea/Base/Arbitrum/BNB Chain/Polygon).

**Out of scope:**
- Расширение `RadiProtocolSettings` interface / `DEFAULT_SETTINGS` — секция полностью stateless (DONATE-01 success criterion #4).
- Любые внешние ссылки (donate-страницы, кошельки в браузере, blockchain-explorers) — DONATE-01 SC#4 запрещает.
- Аналитика, телеметрия, любой сетевой запрос — DONATE-01 SC#4 запрещает.
- QR-коды для адресов — out-of-scope, не упомянуто в REQUIREMENTS.
- Configurable wallet list / user-добавляемые адреса — out-of-scope, REQUIREMENTS фиксируют 9 адресов hard-coded.
- Multi-language toggle (EN/RU UI) — out-of-scope, REQUIREMENTS зафиксировал русский для заголовка/invitation; мы расширяем русский на Notice/tooltip для симметрии. Переключатель — отдельная фаза.
- Перенос existing настроек (Runner/Protocol/Output/Storage) — секции остаются на месте, только добавляется новая сверху.
- Изменения runner / canvas / snippets / sessions — не пересекаются с этой фазой.
- DOM-render unit-тест на settings tab (мокаем `PluginSettingTab`, кликаем copy) — отвергнуто как избыточное; UAT в dev vault покрывает.
- Try/catch + `document.execCommand('copy')` fallback — отвергнуто (Obsidian Desktop = Electron, navigator.clipboard надёжен; runner-view.ts:1107 не имеет fallback).
- Truncate-middle отображение адреса (`0x0B52…fB02A`) — отвергнуто (anti-phishing требует видеть адрес целиком).
- Custom heading с emoji или border/background рамкой — отвергнуто (Obsidian community-plugin convention = `setHeading()`).

</domain>

<decisions>
## Implementation Decisions

### Структура DOM строки кошелька

- **Row-D-01 — Obsidian-нативный `new Setting()` builder.** Каждый из 4 рядов = `new Setting(containerEl).setName(networkName).setDesc(...).addExtraButton(b => b.setIcon('copy').setTooltip('Скопировать адрес').onClick(() => { void navigator.clipboard.writeText(address).then(() => new Notice('Адрес скопирован')); }))`. Консистентно с остальной вкладкой (Runner / Protocol / Output / Storage всё через `new Setting()`). Obsidian сам рисует разделители, hover, отступы — нам не нужно дублировать темирование.
- **Row-D-02 — Полный адрес внутри `<code>` элемента.** В desc создаём `descEl.createEl('code', { text: fullAddress, cls: 'rp-donate-address' })`. `descEl` = `setting.descEl` (Obsidian API). Полный адрес критичен для крипты — anti-phishing верификация невозможна, если средняя часть скрыта; пользователь должен иметь возможность визуально подтвердить адрес перед переводом. CSS обеспечивает `word-break: break-all` чтобы длинные адреса корректно переносились.
- **Row-D-03 — Copy = icon-only `addExtraButton('copy')`.** Lucide `copy` иконка, `setTooltip('Скопировать адрес')`. Соответствует Obsidian-конвенции (community-плагины используют icon-only extra-buttons в settings tabs). Текстовая кнопка «Скопировать» отвергнута — выглядит инородно в plain Obsidian settings.
- **Row-D-04 — Игнорируем clipboard reject (no `.catch`).** Точно как в `src/views/runner-view.ts:1107-1109`: `void navigator.clipboard.writeText(addr).then(() => new Notice('Адрес скопирован'))`. Phase 31 D-08 уже зафиксировал это решение для проекта (Obsidian Desktop = Electron, clipboard reject практически невозможен; добавлять `.catch` — нарушение принципа «не добавляй обработку ошибок для невозможных сценариев»).

### Структура EVM-ряда

- **EVM-D-01 — `name='EVM'` (короткое), сети в `desc`.** `setName('EVM')` — короткий ярлык в левом слоте, симметричный с `Bitcoin` / `Solana` / `Tron`. Список сетей — мелким текстом в `desc`, ниже него — `<code>` с адресом на отдельной строке. Длинные строки `name='Ethereum / Linea / Base / Arbitrum / BNB Chain / Polygon'` отвергнуто (ломает выравнивание с другими рядами).
- **EVM-D-02 — Порядок рядов: EVM → Bitcoin → Solana → Tron.** Точно как в REQUIREMENTS DONATE-01 / ROADMAP SC#2. EVM сверху — самый объёмный ряд (1 адрес покрывает 6 сетей), визуально и логически открывает секцию.
- **EVM-D-03 — Имена EVM-сетей в desc: «Ethereum, Linea, Base, Arbitrum, BNB Chain, Polygon».** Буквальный порядок из REQUIREMENTS.md DONATE-01 / ROADMAP SC#2. Не сортируем по алфавиту, market-cap или TVL — отвергнуто как риск future churn без обоснования.
- **EVM-D-04 — Разделитель в EVM desc — middle dot ` · ` (U+00B7).** Читабельнее запятых, тише слэшей. Применяется только в строке имён сетей (не в адресе).

### Visual hierarchy и CSS

- **VIS-D-01 — Заголовок секции — Obsidian-нативный `setHeading()`.** `new Setting(containerEl).setName('Помочь разработке').setHeading()` — идентичный стиль с Runner / Protocol / Output / Storage. Секция выделяется исключительно (а) позицией (top-most в `display()`) и (б) русским заголовком на фоне английских. Custom heading с emoji или border-tinted рамкой отвергнут — расходится с Obsidian community-plugin эстетикой.
- **VIS-D-02 — Новый `src/styles/donate-section.css`, зарегистрировать в `esbuild.config.mjs` CSS_FILES.** CLAUDE.md «CSS Architecture»: **«When adding CSS for a new feature: create a new file in `src/styles/` and add it to the `CSS_FILES` list in `esbuild.config.mjs`. Do NOT add CSS to an unrelated feature file.»** Inline-стили на DOM-элементах (`code.style.wordBreak = ...`) отвергнуты как нарушение проектных правил и риск ESLint-конфликта. Файл append-only per phase (CLAUDE.md Critical Rules) — но сейчас файл создаётся, так что вся первоначальная заливка идёт без `/* Phase N */`-маркера (планнер решает финальную форму комментариев).
- **VIS-D-03 — Стилизация `<code>` минимальная.** Полагаемся на Obsidian default `<code>` (background-tint, monospace font, radius 4px) — это единообразно с inline code в markdown views, тема-aware. Наше CSS добавляет только: (а) `word-break: break-all` (или `overflow-wrap: anywhere`) — длинные адреса должны корректно переноситься, (б) `display: block` + небольшой `margin-top` — чтобы `<code>` визуально лёг под список сетей в EVM-desc на отдельной строке (для BTC/SOL/TRX desc состоит только из `<code>`, но `display: block` не вредит). Custom font-size / padding / border отвергнуто как риск рассинхронизации с Obsidian-темами.

### Тон, тексты, константы и тесты

- **NTC-D-01 — Invitation-строка:** «Спасибо за поддержку! Если RadiProtocol экономит вам время — буду рад любому переводу.» Тёплый, личный «я»-тон от автора плагина. Рендерится между `setHeading()` и первым кошельковым рядом через `containerEl.createEl('p', { text: INVITATION_TEXT, cls: 'rp-donate-intro' })` (либо без класса, если CSS не нужен — планнер решает по UAT).
- **NTC-D-02 — Notice text — «Адрес скопирован».** Русский, симметричен с заголовком и invitation. Notice показывается после `clipboard.writeText().then(...)`. Не network-specific — единый текст для всех 9 потенциальных кликов (4 кнопки × возможные повторы), упрощает логику.
- **NTC-D-03 — Константы в `src/donate/wallets.ts`.** Новый каталог `src/donate/`, новый файл `wallets.ts`. Экспортирует:
  - `DONATE_WALLETS: ReadonlyArray<DonateWallet>` — 4 элемента (EVM, BTC, SOL, TRX) в порядке EVM-D-02.
  - `DonateWallet` тип: `{ readonly name: string; readonly networks?: readonly string[]; readonly address: string }` (`networks` присутствует только для EVM).
  - (Опционально) `DONATE_INVITATION_TEXT: string`, `DONATE_NOTICE_TEXT: string` константы — планнер решает, оставить ли их в `wallets.ts` или вынести в отдельный модуль.
  Соответствует STRUCTURE.md правилу «New Service / domain folder for new feature», изолирует константы для тестирования.
- **NTC-D-04 — Unit-тест констант: `src/__tests__/donate/wallets.test.ts`.** Проверяет:
  1. `DONATE_WALLETS.length === 4`.
  2. Порядок: `[0].name === 'EVM'`, `[1].name === 'Bitcoin'`, `[2].name === 'Solana'`, `[3].name === 'Tron'`.
  3. Точные адреса из REQUIREMENTS.md DONATE-01 (литеральное сравнение строк).
  4. `DONATE_WALLETS[0].networks` равен `['Ethereum', 'Linea', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon']` (порядок сохранён).
  5. У BTC/SOL/TRX `networks === undefined` (не путать «отсутствует» и «пустой массив»).
  Дешёвый tripwire против опечатки в адресе (последствия: деньги уходят в чужой кошелёк).

### Claude's Discretion

- Точное имя CSS-класса (`rp-donate-address` / `rp-donate-intro` / `rp-donate-section` или иное) — планнер выбирает по проектному именованию.
- Стоит ли вынести invitation/notice строки в отдельный модуль (`src/donate/i18n.ts`) или оставить в `wallets.ts` — планнер решает, исходя из объёма (если только две строки — оставить в wallets.ts).
- Точные значения CSS (`margin-top: 4px` vs `8px`, `word-break: break-all` vs `overflow-wrap: anywhere`) — планнер решает по визуальному UAT в dev vault.
- Финальный wording tooltip кнопки (`Скопировать адрес` vs `Копировать` vs `Скопировать в буфер обмена`) — рекомендуется `Скопировать адрес`, планнер может скорректировать.
- Стоит ли дополнительно поставить класс на `.setting-item` всей донат-секции (`rp-donate-row`) для возможной будущей CSS-доработки — планнер решает (не критично, проще не ставить).
- Использовать `setting.descEl.createEl('code', ...)` или `setting.descEl.appendChild(document.createElement('code'))` — оба корректны; рекомендуется первый (Obsidian-API стиль, уже встречается в кодбазе).
- Точное имя комментария-маркера в CSS-файле (поскольку файл создаётся с нуля — `/* Phase 71: Donate section (DONATE-01) */` рекомендован) — планнер уточняет.
- Стоит ли в `display()` группировать секцию через дополнительную обёртку `containerEl.createDiv({ cls: 'rp-donate-section' })` для будущей CSS-доработки — планнер решает; **по умолчанию НЕ группировать** (консистентно с остальными группами тaba, которые тоже не имеют обёртки).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules
- `CLAUDE.md` — CSS Architecture (per-feature файлы в `src/styles/`, регистрация в `esbuild.config.mjs` CSS_FILES), Critical Rules (append-only per phase, не удалять чужой код в shared files), Build Process (`npm run build` после CSS-правки).
- `.planning/codebase/STRUCTURE.md` §«Where to Add New Code» → «New CSS Feature» (1. файл в `src/styles/`, 2. registration, 3. phase comment, 4. rebuild).
- `.planning/codebase/STACK.md` — Obsidian Plugin API 1.12.3 (Setting, PluginSettingTab, Notice), ESLint правила (`@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-floating-promises: error`, `no-restricted-syntax` запрещает `innerHTML`/`outerHTML`).

### Requirements / Roadmap
- `.planning/REQUIREMENTS.md` → DONATE-01 (полные литеральные адреса 9 кошельков, 4 ряда: EVM с 6 сетями + BTC + SOL + TRX, hard-coded, no links/analytics/network).
- `.planning/ROADMAP.md` → Phase 71 success criteria 1-4 (top-most позиция, 9 строк в указанном порядке, copy + Notice, без persistence).

### Code references (existing patterns)
- `src/settings.ts:50-173` (`RadiProtocolSettingsTab.display()`) — точка вставки новой секции (перед строкой 63 `// Group 1 — Runner`). Паттерн `new Setting().setName().setDesc().addX()` уже используется во всех 4 группах.
- `src/views/runner-view.ts:1105-1109` — каноничный паттерн copy→Notice без `.catch`. Phase 71 копирует это поведение байт-в-байт (только меняет текст Notice на «Адрес скопирован»).
- `esbuild.config.mjs` → массив `CSS_FILES` — место регистрации нового `donate-section.css`.

### Adjacent settings phases
- `.planning/milestones/v1.10-phases/61-*` (если экспортирован FolderSuggest pattern) — Phase 61 последний раз менял Settings tab; Phase 71 сохраняет его паттерны и не пересекается логически.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`new Setting(containerEl).setName().setDesc().addExtraButton(...)` (`src/settings.ts:50-173`):** Готовый Obsidian builder. `addExtraButton` принимает callback с `ExtraButtonComponent` (`b.setIcon('copy').setTooltip(...).onClick(...)`).
- **`new Notice(message: string)` (Obsidian API):** Уже импортирован/используется по всему проекту (`src/views/runner-view.ts:1108`, `src/main.ts`, `src/views/inline-runner-modal.ts`, `src/views/editor-panel-view.ts`). Импорт стандартный: `import { Notice } from 'obsidian'`.
- **`navigator.clipboard.writeText(text: string): Promise<void>`:** Web standard, доступен в Electron context Obsidian Desktop. Прецедент использования: `runner-view.ts:1107`.
- **Obsidian default `<code>` styling:** Тема-aware monospace + tinted background + radius. Применяется автоматически когда DOM содержит `<code>`-элемент. Не требует ручного импорта.

### Established Patterns
- **CSS append-only per phase (CLAUDE.md):** Так как `src/styles/donate-section.css` создаётся в этой фазе, весь первоначальный контент идёт без `/* Phase N */`-разделителей; будущие фазы будут append-only с маркерами.
- **`registerDomEvent` для click-handlers (Phase 30 WR-01):** В runner-view.ts применяется через `this.registerDomEvent(btn, 'click', handler)` для auto-cleanup при unload. **В settings tab не нужно** — `addExtraButton().onClick()` использует Obsidian-managed lifecycle (компонент уничтожается при `display().empty()` / settings закрытии). Settings tab не имеет `register*` методов как у `ItemView`.
- **`void` prefix для Promise без await (`@typescript-eslint/no-floating-promises: error`):** Обязательный паттерн при использовании `clipboard.writeText().then()` без await — `void navigator.clipboard.writeText(...).then(...)`.
- **Hard-coded constants в `Readonly`-типах:** В кодбазе встречается (`src/canvas/node-color-map.ts:NODE_COLOR_MAP`), хорошая база для `DONATE_WALLETS`.

### Integration Points
- **Точка вставки секции:** `src/settings.ts:60` — между `containerEl.empty()` и `// Group 1 — Runner`. Новый код должен идти **до** Group 1, чтобы рендериться сверху.
- **CSS_FILES в `esbuild.config.mjs`:** Имена должны соответствовать файлам в `src/styles/` (без `.css`-расширения, скорее всего). Планнер прочитает текущий список и подберёт позицию вставки `'donate-section'`.
- **Test harness:** `src/__tests__/` использует vitest с `Z:\projects\RadiProtocolObsidian\src\__mocks__\obsidian.ts` mock. Для теста `wallets.test.ts` Obsidian-мок не нужен (модуль не импортирует Obsidian).

</code_context>

<specifics>
## Specific Ideas

- **Invitation-текст — личный «я»-тон от автора:** «Спасибо за поддержку! Если RadiProtocol экономит вам время — буду рад любому переводу.» (NTC-D-01). Не «команда разработчиков», не нейтральный официоз — конкретно «я-разработчик-благодарю».
- **Anti-phishing приоритет:** Адрес показывается **полностью** (Row-D-02), не truncate-middle. Это намеренно — пользователь должен иметь возможность визуально сверить весь адрес перед переводом криптовалюты. Truncate-middle (`0x0B52…fB02A`) — известный анти-паттерн в crypto UX.
- **Симметрия русского:** Заголовок («Помочь разработке») и invitation русские per REQUIREMENTS, поэтому Notice («Адрес скопирован») и tooltip («Скопировать адрес») тоже русские для визуальной симметрии секции. Остальное UI плагина остаётся английским — этот «русский остров» только в донат-секции.
- **EVM как первый ряд:** Намеренно, не алфавитно — наибольший охват (6 сетей за один адрес) идёт сверху, читается как основной канал поддержки.
- **Middle-dot разделитель ` · `:** Эстетический выбор для списка EVM-сетей. Менее тяжёл визуально чем `, ` или ` / `. U+00B7 — стандартный Unicode-символ, безопасно вставлять в JS-строки.

</specifics>

<deferred>
## Deferred Ideas

- **QR-коды для адресов** — упростили бы перевод с мобильного, но не упомянуто в REQUIREMENTS DONATE-01. Если запросят — отдельная фаза (потребуется QR-генератор, прирост bundle size).
- **Multi-language toggle (EN/RU UI секции)** — REQUIREMENTS зафиксировали русский заголовок; полный multi-language переключатель — отдельная инфраструктурная работа (i18n модуль, хранение текущего языка в settings, перевод всех существующих strings). Не в этой фазе.
- **DOM-render unit-тест с моком `PluginSettingTab`** — отвергнуто как избыточно дорогое для UI-секции без логики. Validation констант (NTC-D-04) + ручной UAT покрывают риски.
- **Try/catch + `document.execCommand('copy')` fallback** — отвергнуто (Obsidian Desktop = Electron, navigator.clipboard надёжен; текущий проектный паттерн `runner-view.ts:1107` не имеет fallback).
- **Truncate-middle отображение адресов с tooltip полного адреса** — отвергнуто (anti-phishing приоритет, см. specifics).
- **Custom heading с emoji / border-tinted callout рамкой** — отвергнуто (расходится с Obsidian community-plugin эстетикой; setHeading() консистентен).
- **Configurable wallet list / user-добавляемые адреса** — out-of-scope per REQUIREMENTS DONATE-01 SC#4 («addresses are hard-coded constants»). Если когда-нибудь потребуется (forks плагина) — отдельная фаза.
- **External donate-page link / GitHub Sponsors / Buy-me-a-coffee** — REQUIREMENTS DONATE-01 SC#4 явно запрещает «no external links». Не в этой и не в смежных фазах без отдельного REQUIREMENTS.

</deferred>

---

*Phase: 71-Settings-Donate-Section*
*Context gathered: 2026-04-29*
