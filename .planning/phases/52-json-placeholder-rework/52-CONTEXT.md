# Phase 52: JSON Placeholder Rework — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 52 сокращает JSON-схему плейсхолдеров сниппетов до **ровно двух типов** и чинит редактор списка опций:

1. **`free-text`** — свободный ввод; единственная замена исчезнувшему `number` (единицы измерения вводит автор в сам текст).
2. **`choice`** — унифицированный multi-select: ноль/один/много вариантов, склейка через `separator` (по умолчанию `", "`, переопределяется полем `separator` на плейсхолдере).

Параллельно фаза:
- Чинит сломанный options-list editor (фактический UI-путь локализуется исследователем / планировщиком в dev-вауле — см. D-08).
- Превращает `snippet-fill-in-modal` multi-select (checkbox-список) в единственный рендер для `choice`.
- Вводит жёсткую валидацию legacy-типов (`number`, `multichoice`, нечитаемый старый `choice`) без автоматической миграции.

**В рамках фазы:**
- `src/snippets/snippet-model.ts` — сужение `SnippetPlaceholder['type']` до `'free-text' | 'choice'`, удаление полей `unit` и `joinSeparator`, добавление поля `separator?: string`, упрощение `renderSnippet`.
- `src/views/snippet-chip-editor.ts` — два варианта в селекторе типа (вместо четырёх), удаление `number`-expanded-арма, переименование в UI «Разделитель» с применением и к single, и к multi (унифицированный `choice`).
- `src/views/snippet-editor-modal.ts` — пропагация D-04 banner + блокировка Save при legacy-snippet.
- `src/views/snippet-fill-in-modal.ts` — единая renderChoiceField `isMulti = true` (choice = всегда checkbox-список); удаление `renderNumberField`; Custom-override остаётся по Phase 31 D-09.
- `src/snippets/snippet-service.ts` — `load` и `listFolder` вместо silent-skip возвращают `JsonSnippet` с новым полем `validationError: string | null` (точная форма полей — см. D-03).
- `src/runner/protocol-runner.ts` + `src/views/runner-view.ts` — error-panel surface при попытке запустить snippet с `validationError`.
- Возможно `src/graph/graph-validator.ts` — только если планировщик решит дополнительно валидировать на уровне canvas-open (вторичная защита, см. D-03 option C отсылку).

**Вне рамок фазы** (Out-of-Scope из REQUIREMENTS.md и уточнения здесь):
- Автоматическая миграция legacy-сниппетов (пользователь подтвердил: таких файлов нет в его ваулте).
- Валидация «required» для `choice` (пустой выбор = пустая строка, D-09).
- Переделка `.md`-сниппетов.
- Косметика snippet-manager tree (помечать красным битые сниппеты — не входит; hard-reject виден в editor + runner, этого достаточно).
- Редизайн color-bar чипов (цветов сейчас 4, типов остаётся 2; планировщик решает, убирать два неиспользуемых ключа из `PH_COLOR` или оставить для совместимости — Claude's Discretion).

</domain>

<decisions>
## Implementation Decisions

### Дисковая схема JSON

- **D-01:** Строковое имя типов на диске и в TS union остаётся **`'free-text'` и `'choice'`** (дефисное, как сейчас в коде). Дизайн-нота `.planning/notes/json-snippet-placeholder-rework.md` читается как семантическое описание «двух категорий», а не как байтовый контракт. Существующие `.json`-сниппеты с `type: "free-text"` и `type: "choice"` (unified-compatible) продолжают работать без правки. TS union: `type SnippetPlaceholder['type'] = 'free-text' | 'choice'`.
- **D-02:** Поле-разделитель переименовывается из `joinSeparator` (текущее) в **`separator`** — и в TS-типе, и на диске. Дефолт: строка `', '` (запятая + пробел) при отсутствии поля. Пользователь подтвердил, что legacy-сниппетов с `joinSeparator` в его ваулте нет, поэтому graceful read-both-write-new не нужен — изменение чистое. Любой .json с `joinSeparator` при чтении проигнорирует поле; планировщик сам решает, падать ли на этом как на legacy или молча терять (Claude's Discretion — строгий путь предпочтительнее, но не блокирующее решение).
- **D-07:** Поле `unit` удаляется из `SnippetPlaceholder` полностью. `renderSnippet` теряет ветку `type === 'number' && unit` — заменяется простым `output = output.split('{{...}}').join(raw)` для всех плейсхолдеров. Автор, который хочет суффикс «мм», сам пишет его в template (`{{size}} мм`) или в саму опцию choice.

### Hard-reject legacy-типов

- **D-03:** Валидация — **в `SnippetService.load` и `SnippetService.listFolder`** (единая точка на все пути: SnippetManager-tree, Snippet Editor, Runner snippet-picker, auto-insert из Phase 51 D-14). Контракт:
  - Если JSON распарсился, но содержит плейсхолдер с `type ∈ {'number', 'multichoice', 'multi-choice'}` или плейсхолдер с `type === 'choice'` без валидного `options: string[]` — `listFolder`/`load` возвращают `JsonSnippet` со всеми полями + новым обязательным полем `validationError: string` (текст причины, см. D-04).
  - Если snippet валидный, `validationError: null` (или отсутствует — планировщик выбирает представление: `string | null` обязательное поле или `string | undefined` опциональное; предпочтительно `string | null` для явного рассуждения в TS).
  - Существующее silent-skip поведение для **синтаксически сломанного** JSON (`JSON.parse` throws) остаётся — те файлы как и сейчас не появляются в дереве (только логируются в console на уровне, который планировщик сочтёт нужным).
  - Дополнительная валидация на уровне `GraphValidator` при open canvas **не вводится** в этой фазе. Обоснование: SnippetNode хранит **папку** (`subfolderPath`) или **конкретный файл** (`snippetPath` из Phase 51) — при открытии canvas значение конкретного snippet-файла не резолвится до момента Runner-dispatch, поэтому проверять legacy-тип в GraphValidator значило бы читать все файлы из subfolderPath. Runner уже загружает snippet через `snippetService.load` перед insertion — там и ловим D-04 ошибку.
- **D-04:** Пользователь видит ошибку в двух местах:
  - **SnippetEditorModal**: при открытии сниппета с `validationError !== null` над формой появляется красный banner с текстом ошибки (формат: *«Сниппет использует удалённый тип плейсхолдера: `{typeName}` (плейсхолдер `{placeholderId}`). Файл не может быть использован в Runner. Пересоздайте плейсхолдер вручную.»*). Кнопка «Сохранить» заблокирована, форма плейсхолдеров и template показаны **read-only** (без активных инпутов). Пользователь может только изменить имя/папку (для перемещения в «архив») или закрыть модалку. Точный русский текст и вёрстка banner — Claude's Discretion в PLAN.md, должен соответствовать стилю Phase 50.1 D-04..D-08 (nodeId / путь / имя проблемного поля).
  - **RunnerView error-panel**: при попытке Runner'а загрузить сниппет с `validationError`, существующий error-panel pattern показывает русский текст с `nodeId` Snippet-ноды, путём к битому `.json` и именем удалённого типа. Использует тот же путь, что `GraphValidator` ошибки (LOOP-04 / Phase 50.1 D-04..D-08 / Phase 51 D-04). Snippet не вставляется в накопитель, Runner остаётся в `awaiting-snippet-pick` или, в случае auto-insert из Phase 51 D-14, уходит в `error` state (планировщик решает точный переход — предпочтительно не ломать session, а показать non-fatal Notice с предложением выбрать другой snippet).
  - `SnippetManagerView` tree в этой фазе **не изменяется** визуально — битые сниппеты остаются в дереве как обычные, ошибка видна только при клике на них (открытие editor → banner). Отметка цветом в дереве — Deferred Idea (см. ниже).

### UI unified `choice`

- **D-05:** `snippet-fill-in-modal.ts` рендерит `choice` как **checkbox-список** — тот же путь, что сейчас используется для `multi-choice`. Поведение:
  - 0 выбранных → `this.values[id] = ''` (D-09).
  - 1 выбранный → значение этого option вставляется верно.
  - ≥2 выбранных → склеиваются через `placeholder.separator ?? ', '`.
  - Порядок в результате = порядок options в массиве схемы (не порядок клика), как сейчас работает `filter(cb => cb.checked).map(cb => cb.value)`.
  - Метод `renderChoiceField` из snippet-fill-in-modal.ts `:136` вызывается с `isMulti = true` всегда. `renderNumberField` удаляется полностью. `renderField` теряет две ветки, остаётся только `free-text` → `renderFreeTextField`, `choice` → `renderChoiceField(..., true)`.
- **D-06:** Phase 31 D-09 **«Custom:»** free-text override **остаётся** как есть. Семантика:
  - Пустой Custom → используется состояние чекбоксов.
  - Непустой Custom → все чекбоксы игнорируются, вставляется только custom-строка.
  - Custom применим ко всем `choice`-плейсхолдерам (раньше было и для single, и для multi — теперь тип один, поведение одно).
- **D-08:** Сломанный options-list editor — **локализует исследователь/планировщик во время `/gsd-plan-phase`**. Гипотезы (проверить в порядке приоритета):
  1. В `snippet-chip-editor.ts` `renderOptionRows` + `+ Add option` — код на первый взгляд корректен (добавляет пустую строку в `ph.options`, ре-рендерит). Возможно, баг в том, что option-input не фокусируется или input-listener не дёргает `onChange`. Проверить в dev-вауле через `npm run dev` и ручное воспроизведение.
  2. В legacy `snippet-manager-view.ts` (1037 строк) — параллельный редактор, который пользователь может продолжать использовать. Если баг там и этот путь уже не вызывается из production code, он закрывается автоматически удалением.
  3. Возможно, баг уже починен в рамках Phase 33 MODAL-06 и сниппет-файл Goal-формулировки роадмапа отражает **прошлый** status. В этом случае планировщик явно фиксирует в PLAN.md, что «D-08: баг не воспроизводится на текущей базе, acceptance criteria SC 2 удовлетворён функциональным тестом add/edit/reorder/remove».
  Исследователь обязан воспроизвести в dev-вауле и зафиксировать результат в RESEARCH.md до планирования.

### Что остаётся неизменным из прошлых фаз

- **D-09:** Пустой выбор в unified `choice` (0 чекбоксов + пустой Custom) вставляет **пустую строку** — текущее поведение снiрpet-fill-in-modal сохраняется. Понятие «required» в этой фазе не вводится (отдельная deferred idea если понадобится).
- Phase 27 D-02 цветовая палитра чипов: при удалении `'multi-choice'` и `'number'` из union, планировщик решает — убрать эти ключи из `PH_COLOR` (чище) или оставить dead-code-safe (минимум правки). Claude's Discretion. Рекомендация: убрать, т.к. ESLint/TS не дадут использовать литералы, а CLAUDE.md запрещает амбивалентный код.
- Phase 51 D-14 auto-insert для `.json`-сниппетов продолжает работать: `handleSnippetFill` ловит `.json`-путь и открывает modal. При `validationError` Runner вместо открытия modal показывает error-panel (см. D-04) — логика «placeholder modal always runs before insertion» семантически сохраняется (модалка не открывается только потому, что файл битый, а не потому, что мы пропустили fill).

### Claude's Discretion

- Точный текст русских ошибок для D-04 (banner в editor + runner error-panel) — пишется планировщиком в PLAN.md по образцу Phase 50.1 D-04..D-08.
- Представление `validationError` в `JsonSnippet` (новое обязательное поле `string | null` vs опциональное `string | undefined`) — планировщик выбирает, предпочтительно явное `string | null` для exhaustiveness в дискриминированных арм.
- Удалять ли ключи `'multi-choice'` и `'number'` из `PH_COLOR` записи в `snippet-chip-editor.ts`.
- Отдельный `kind: 'invalid-json'` в `Snippet` дискриминированном union vs поле на существующем `JsonSnippet` — планировщик выбирает. Поле проще, но отдельный kind лучше типизирует «снiрpet нельзя рендерить».
- Вёрстка и позиция banner-ошибки в SnippetEditorModal (над формой, под titleEl, или как inline-alert в месте первого некорректного плейсхолдера).
- Точный Runner state при попытке auto-insert битого snippet (см. Phase 51 D-14): non-fatal Notice + возврат в `awaiting-snippet-pick`, или `error` state.
- Исследование бага D-08 в dev-вауле — форма отчёта (screenshot / test case / gif).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design notes (primary)
- `.planning/notes/json-snippet-placeholder-rework.md` — канонический дизайн-контракт Phase 52 (два типа, удалённые типы = ошибка, сломанный options-editor как часть скоупа, пользователь подтвердил отсутствие legacy).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §JSON Snippet Placeholders — PHLD-01 (полное описание two-type-collapse, unified choice UI, bug-fix, hard-validation-error).
- `.planning/REQUIREMENTS.md` §Out of Scope, строка 2 — «Automatic migration of legacy `.json` snippets using removed placeholder types» (поясняет: пользователь подтвердил отсутствие legacy).
- `.planning/ROADMAP.md` §Phase 52 — Goal + 4 Success Criteria (SC 1 two-type schema + separator; SC 2 working options-list editor; SC 3 Runner multi-select render + separator join; SC 4 hard-validation блокирует Runner use).

### Прецеденты и паттерны
- `.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` §D-04..D-08 — образец стиля русских валидационных ошибок (5 locked Russian error texts + `nodeId` surfacing через RunnerView error panel).
- `.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md` §D-04 — прецедент hard-validation ошибки для snippet-ноды (file-not-found для `radiprotocol_snippetPath`) с тем же pattern surface.
- `CLAUDE.md` — правило «Never remove existing code you didn't add» в shared-файлах (`src/main.ts`, `src/views/editor-panel-view.ts`, `src/styles/*`); CSS-правило append-only per-phase; `npm run build` после CSS-изменений.

### Исходный код, который меняется
- `src/snippets/snippet-model.ts` (113 строк) — union, `renderSnippet`, `slugifyLabel`.
- `src/views/snippet-chip-editor.ts` (494 строки) — Phase 33 unified placeholder editor; содержит весь options-list путь (`renderOptionRows`, `+ Add option`).
- `src/views/snippet-editor-modal.ts` (617 строк) — banner-surface для D-04.
- `src/views/snippet-fill-in-modal.ts` (255 строк) — упрощение renderField, удаление renderNumberField.
- `src/snippets/snippet-service.ts` (493 строки) — `load`/`listFolder` возвращают `validationError`.
- `src/views/snippet-manager-view.ts` (1037 строк legacy) — по Phase 33 MODAL-06 должен быть wrapped, но ещё жив; проверить, остался ли там собственный placeholder editor, который нужно синхронизировать или удалить.

### Тесты, которые обновляются/добавляются
- `src/__tests__/snippet-model.test.ts` — union теперь 2 значения, `renderSnippet` без unit-ветки.
- Новый тест: `snippet-service.load` возвращает `validationError` для `.json` с `type: 'number'` / `type: 'multichoice'` / `type: 'multi-choice'` / `type: 'choice'` без валидного `options`.
- Новый тест: `snippet-chip-editor` options-list add/edit/reorder/remove — покрытие баг-фикса D-08 (acceptance SC 2).
- Новый тест: `snippet-fill-in-modal` для unified `choice` с `separator` (default + override), empty state = `''`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SnippetService.load` / `listFolder`** (`src/snippets/snippet-service.ts:86-180`): единая точка чтения .json + .md. Сейчас молча пропускает сломанные файлы (строки 127-129) — расширяется до возврата `validationError`, точка D-03.
- **`SnippetFillInModal.renderChoiceField`** (`src/views/snippet-fill-in-modal.ts:136-212`): уже реализует multi-select с `separator`, custom-override, порядок-по-массиву. Передаём `isMulti = true` всегда — готовый код.
- **Error-panel surface в RunnerView** (паттерн из Phase 50.1 / 51 D-04): проверенная машинка «русский текст + nodeId + путь» — реюзается для D-04 validation.
- **`mountChipEditor` / `renderOptionRows`** (`src/views/snippet-chip-editor.ts:319-426`): options-list UI уже здесь; D-08 bug-fix работает внутри одного файла (если hypothesis #1 верна).
- **`SnippetEditorModal.renderButtonRow`** (`src/views/snippet-editor-modal.ts:372-390`): `saveBtnEl.disabled` уже используется для collision-error — тот же механизм применяется для D-04 banner-state.

### Established Patterns
- **Discriminated union на `kind`** (Phase 32 D-01): `Snippet = JsonSnippet | MdSnippet`. Расширение до `JsonSnippet & { validationError: string | null }` вместо отдельного kind сохраняет совместимость с call-sites, которые branch только по `kind === 'json'`.
- **Phase 27 D-02 цветовые бары плейсхолдеров** (`PH_COLOR` в `snippet-chip-editor.ts:30`): словарь фиксированной палитры на тип. После сужения union останется 2 цвета — cyan (free-text) и orange (choice).
- **CSS append-only по файлам** (CLAUDE.md): новые стили идут в `src/styles/snippet-manager.css` с комментарием `/* Phase 52: description */` внизу файла, не правим существующие правила.
- **`handleSnippetFill` dispatch by path shape** (Phase 51 D-14): Runner branch-by-path (.md vs .json) остаётся; добавляется только проверка `snippet.validationError != null` ранее path-check.

### Integration Points
- **`runner-view.ts` snippet-fill arm** (строки ~530-540): здесь перехватываем D-04 при попытке открыть fill-in modal для битого `.json`.
- **`canvas-parser.ts` / `graph-model.ts`**: НЕ меняются — SnippetNode shape (subfolderPath, snippetPath из Phase 51) не зависит от типов плейсхолдеров. Hard-reject живёт на уровне snippet-service.
- **`editor-panel-view.ts`**: не меняется для Phase 52. Snippet-arm отвечает только за выбор файла/папки (Phase 51), не за содержимое .json.

### Creative Options
- Вместо отдельного banner можно inline-подсветить конкретный плейсхолдер в chip-editor красной рамкой. Но Goal фазы — hard-reject целиком, а не per-plakeholder surface, banner проще.
- Можно добавить «Архивировать» кнопку в editor-banner (переименовать в `.legacy-json`), но это расширяет скоуп — оставляем в Deferred.
- Color-bar PH_COLOR можно унифицировать с D-02 (разделитель) — показывать мини-превью separator'а рядом с `choice` чипом. Скоуп-крипт, не делаем.

</code_context>

<specifics>
## Specific Ideas

- Пользователь прямо ответил «Не знаю точно» по D-08 — ожидает, что исследователь воспроизведёт сломанный options-editor в dev-вауле и зафиксирует точку отказа в RESEARCH.md. Это **блокирующая задача** для планировщика: без локализации бага SC 2 acceptance criteria нельзя спланировать.
- Пользователь на шагах «Дисковая схема» и «separator» явно выбрал путь минимальной правки для имени типа (`'free-text'` остаётся) и осознанную правку для поля (`joinSeparator` → `separator`) — разница в выборе показывает, что он оптимизирует за «не трогать то, что не нужно» + «привести к design note там, где есть ценность».
- Предпочтение «checkbox-список» для unified choice + сохранение Custom-override — указывает на желание минимально отходить от текущего multi-choice UX. Пользователь знает, как выглядит текущий `renderChoiceField`.
- «Удалить unit полностью» — пользователь готов отказаться от feature ради чистоты «два типа, ничего лишнего».

</specifics>

<deferred>
## Deferred Ideas

- **Marker для битых сниппетов в SnippetManagerView tree** — красная точка / иконка рядом с названием файла, который имеет `validationError`. Не входит в Phase 52 — hard-reject виден в Editor + Runner, этого достаточно для MVP. Может стать отдельной Phase 52.x или UX-polish в v1.9.
- **`required` семантика на plaсeholder** — запретить пустой `choice`. D-09 сознательно оставил empty=''. Добавлять required поле = дополнительное usage-tracking, новые тесты, UI indicator — отдельная фаза.
- **`separator` переопределение пользователем во время fill-in** — REQUIREMENTS.md Out-of-Scope явно говорит «Separator is author-defined on the snippet; user doesn't pick it per-session».
- **Авто-миграция legacy `.json` сниппетов** — REQUIREMENTS.md Out-of-Scope; пользователь подтвердил отсутствие legacy.
- **`unit`-feature в другой форме** — если позже кто-то попросит авто-суффикс для числовых плейсхолдеров, рассматривать как новую фичу отдельной фазы, не регрессию Phase 52.
- **«Архивировать» кнопка в editor-banner D-04** — переименование битого `.json` в `.legacy-json`, чтобы убрать из tree но не удалять. Nice-to-have; деферим.
- **Marker нового формата в файле (`.json` с `schemaVersion: 2`)** — позволило бы отличать «новый формат» от «legacy без маркера». Не нужен, пока нет legacy и нет планов на вторую эволюцию.

</deferred>

---

*Phase: 52-json-placeholder-rework*
*Context gathered: 2026-04-20*
