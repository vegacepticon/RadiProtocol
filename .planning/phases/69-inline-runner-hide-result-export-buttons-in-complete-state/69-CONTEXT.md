# Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 69 удаляет три result-export кнопки (`Copy to clipboard` / `Save to note` / `Insert into note`) из Inline Runner — режима, в котором текст и так пишется в активную заметку в реальном времени по контракту Phase 54, а кнопки превращаются в визуальный балласт. Sidebar `RunnerView` и tab `RunnerView` сохраняют все три кнопки в complete-state как сегодня — никакой cross-mode регрессии.

Scope расширен относительно буквальной формулировки `INLINE-CLEAN-01` в `REQUIREMENTS.md` ("when the Inline Runner reaches the protocol-complete state"): по решению этой discuss-сессии прячем кнопки во **всех** Inline-состояниях (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`), потому что disabled-кнопки в non-complete состояниях — такой же редант, как enabled-кнопки в complete. PROJECT.md "remove redundant buttons" формулировка совпадает с этим расширенным чтением.

**In scope:**
- `src/views/inline-runner-modal.ts` — `render()` `case 'complete'` + 5 non-complete кейсов, `buildContainer()`/`render()` создание `outputToolbar` div, удаление 6 вызовов `renderOutputToolbar(...)`, удаление private метода `renderOutputToolbar(...)` (lines 960-1002).
- `src/styles/inline-runner.css` — удаление 3 dead CSS блоков `.rp-inline-runner-content .rp-output-toolbar*` (lines 74-80, 234-239, 241-244) с CLAUDE.md exception (Phase 67 D-14 паттерн).
- `.planning/REQUIREMENTS.md` `INLINE-CLEAN-01` — переформулировка "no longer rendered in any Inline Runner state".
- `.planning/ROADMAP.md` §Phase 69 Goal + Success Criteria — обновление scope-формулировки + SC #1 расширение на все inline-состояния.
- Тесты: новый или расширенный inline-runner-modal тест, который утверждает отсутствие `.rp-copy-btn`/`.rp-save-btn`/`.rp-insert-btn` во всех 6 inline-состояниях; sidebar regression — RunnerView complete-state имеет все три кнопки (cross-mode защита SC#2/#3).

**Out of scope:**
- Sidebar `RunnerView` complete/non-complete render — НЕ трогаем (`runner-view.ts:686-704`, `runner-view.ts:1071-...`).
- Tab Runner View — отдельного файла нет, тот же `RunnerView`; покрывается sidebar regression-тестом.
- `plugin.saveOutputToNote` (`main.ts:339`) и `plugin.insertIntoCurrentNote` (`main.ts:356`) — остаются живы для sidebar; не трогаем.
- Кнопка `Run again` в Inline complete-state — НЕ добавляем в Phase 69; перенесена в Deferred Ideas.
- Базовое CSS-правило `.rp-output-toolbar` в `runner-view.css:58` — нужно для sidebar/tab; не трогаем.
- Phase 65 `renderRunnerFooter` (Back/Skip) — отдельная подсистема, не пересекается.
- Phase 60/67 drag/resize state — не пересекается; complete-state не меняет geometry.
- Phase 54 D1 freeze/resume на `active-leaf-change` — не пересекается.
- Канонические `'Protocol complete'` heading и Close (X) в шапке остаются как есть.

</domain>

<decisions>
## Implementation Decisions

### Scope удаления кнопок

- **D-01 — Прячем во всех 6 inline-состояниях.** В `idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete` — кнопок `rp-copy-btn` / `rp-save-btn` / `rp-insert-btn` в DOM Inline-режима нет. Disabled-кнопки в non-complete состояниях — такой же редант, как enabled в complete; Inline всё равно вставляет в активную заметку в реальном времени по Phase 54 контракту.
- **D-02 — Phase 67 D-13 паттерн scope-аменда.** Первый план Phase 69 переформулирует `INLINE-CLEAN-01` в `REQUIREMENTS.md` на "the Insert/Copy/Save buttons are no longer rendered in any Inline Runner state" + обновит §Phase 69 Goal в `ROADMAP.md` (SC#1 расширяется на все inline-состояния, SC#2/#3 о sidebar/tab остаются буквально). Цель аменда — сохранить трассировку SC↔код синхронной для будущего milestone-аудита.

### Render-механика toolbar

- **D-03 — Удаляем `outputToolbar` div и 6 вызовов `renderOutputToolbar(...)`.** В `inline-runner-modal.ts` `render()` (line 334) убирается `const outputToolbar = this.contentEl.createDiv({ cls: 'rp-output-toolbar' });`, и в каждом `case` (`idle:342`, `at-node:455`, `awaiting-snippet-pick:460`, `awaiting-loop-pick:516`, `awaiting-snippet-fill:525`, `complete:532`) пропадает строка `this.renderOutputToolbar(outputToolbar, ..., ...);`. Изменения локализованы в одном файле.
- **D-04 — Удаляем private метод `renderOutputToolbar(...)`.** После D-03 метод (`inline-runner-modal.ts:960-1002`) не имеет вызовов. Удаляется целиком, чтобы не оставлять dead-code, который ESLint поймает позже. `plugin.saveOutputToNote` (`main.ts:339`) и `plugin.insertIntoCurrentNote` (`main.ts:356`) НЕ трогаем — они продолжают использоваться `runner-view.ts:1114/1123` для sidebar.
- **D-05 — Удаляем 3 dead CSS блока с CLAUDE.md exception.** В `src/styles/inline-runner.css` удаляются: lines 74-80 (`.rp-inline-runner-content .rp-output-toolbar` базовый), lines 234-239 (compact override), lines 241-244 (`.rp-inline-runner-content .rp-output-toolbar button`). Все три селектора перестанут матчить любой DOM после D-03/D-04 — это load-bearing wrong code, аналогично Phase 67 D-14 4-line block. Исключение из CLAUDE.md "never remove existing code you didn't add" документируется в PLAN.md и commit-message. Базовое правило `.rp-output-toolbar` в `runner-view.css:58` НЕ трогаем — оно нужно sidebar/tab.

### Run again в Inline

- **D-06 — Run again в Inline complete-state НЕ добавляется в Phase 69.** Roadmap-формулировка "only Close (and Run Again where applicable) remains" интерпретируется как "where applicable = N/A для Inline": Close (X в шапке) уже даёт способ выйти; перезапуск через команду `inline-protocol-display-mode` или re-open покрывает паритет с sidebar `Run again` без новой кнопки. Парирование sidebar/tab Run again — потенциальная будущая фаза (см. `<deferred>`).

### Визуал complete-state

- **D-07 — Только `<h2>Protocol complete</h2>` + Close в шапке.** Никаких добавлений (статус-строки "Текст записан в [name].md", preview final-text, ссылок на target note). Минимализм соответствует букве PROJECT.md "remove redundant" и не вводит новый UI вне INLINE-CLEAN-01. Inline-модал может выглядеть пустым на больших размерах после Phase 67 resize — это сознательная цена scope-disciplined фазы.

### Test strategy

- **D-08 — Inline во всех 6 состояниях + sidebar complete regression.** В `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts` (новый файл, либо расширение `inline-runner-modal.ts.test.ts`) — для каждого из 6 inline-состояний утверждается, что в DOM модала нет `.rp-copy-btn`, `.rp-save-btn`, `.rp-insert-btn`. В одном из существующих sidebar-тестов (например `runner-snippet-sibling-button.test.ts` или новый narrow `runner-view-output-toolbar.test.ts`) — utterждается, что в complete-state RunnerView три кнопки присутствуют (cross-mode защита SC#2/#3).
- **D-09 — Дополнительное утверждение для D-04/D-05.** Тест может проверять отсутствие `<div class="rp-output-toolbar">` в любой точке `.rp-inline-runner-container` (один общий assert на все состояния), плюс checkout в DOM-snapshot — но это discretion планнера.

### Claude's Discretion

- Имя нового файла тестов (`inline-runner-modal-output-toolbar.test.ts` vs расширение существующего `inline-runner-modal.test.ts`) — планнер выбирает после прочтения test-files на конфликт с уже существующими `describe` блоками.
- Точная формулировка переписанного `INLINE-CLEAN-01` и обновлённого §Phase 69 в ROADMAP.md — планнер составляет, не противоречия с D-01.
- Стоит ли также удалять переменную `outputToolbar` в `render()` (line 334) или оставлять `null` — планнер выбирает чище-выглядящий вариант (вариант "не создавать вообще" предпочтительнее).
- Точная формулировка CLAUDE.md exception в PLAN.md и commit-message для D-05 — планнер моделирует на Phase 67 D-14 формулировке.
- Стоит ли в этом же phase обновить тесты `inline-runner-modal.test.ts:374,396,...` (мокающие `runner.completeSnippet`) или оставить как есть, если они не зависят от toolbar — планнер проверяет, остаются ли они зелёными после D-03/D-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 69 Requirements & Roadmap

- `.planning/REQUIREMENTS.md` `INLINE-CLEAN-01` — формулировка для переписывания (расширение scope на все inline-состояния, см. D-02).
- `.planning/ROADMAP.md` §Phase 69 — Goal + 4 Success Criteria. SC#1 расширяется на все inline-состояния (D-02). SC#2/#3 о sidebar/tab остаются буквально и проверяются регресс-тестом (D-08).
- `.planning/PROJECT.md` "Current Milestone: v1.11" §Target features — "Inline Runner — remove redundant Insert / Copy to clipboard / Save to note buttons (sidebar+tab keep them)" — широкое чтение совпадает с D-01.
- `.planning/STATE.md` §"v1.11 Phase-Specific Domain Notes" — Phase 69 Inline-mode-only, файлы `InlineRunnerModal` (Phase 65 RUNNER-02 modified). Standing Pitfalls #7 (CSS append-only — D-05 нарушает с явным exception), #8 (только phase-relevant код в shared files).

### Prior phase context (locked invariants, applicable here)

- `.planning/milestones/v1.10-phases/67-inline-runner-resizable-modal-file-bound-snippet-parity/67-CONTEXT.md` — D-13 (ROADMAP/STATE аменд при scope расширении) и D-14 (CLAUDE.md exception на удаление "load-bearing wrong code"). Phase 69 D-02 и D-05 повторяют ровно эти паттерны.
- `.planning/milestones/v1.10-phases/65-runner-footer-layout-back-skip-row/65-CONTEXT.md` — Phase 65 D-12/D-13 о shared `renderRunnerFooter` пайплайне (Back/Skip). Phase 69 не пересекается с footer row, но `inline-runner-modal.ts:551-586` остаётся неизменным.
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-CONTEXT.md` — Phase 54 D1 freeze/resume на `active-leaf-change`, контракт "note as buffer, append to end" — Phase 69 НЕ нарушает: complete-state не меняет geometry, не пишет в заметку, не закрывает модал.

### Existing code touched

- `src/views/inline-runner-modal.ts:334` — `const outputToolbar = this.contentEl.createDiv({ cls: 'rp-output-toolbar' });` — удаляется (D-03).
- `src/views/inline-runner-modal.ts:342, 455, 460, 516, 525, 532` — 6 вызовов `this.renderOutputToolbar(outputToolbar, ..., ...)` — удаляются все (D-03).
- `src/views/inline-runner-modal.ts:530-534` — `case 'complete':` блок остаётся: `<h2>Protocol complete</h2>` + удалённый вызов `renderOutputToolbar`. Без других добавлений (D-07).
- `src/views/inline-runner-modal.ts:960-1002` — private `renderOutputToolbar(toolbar, text, enabled)` — удаляется целиком (D-04).
- `src/styles/inline-runner.css:74-80` — `.rp-inline-runner-content .rp-output-toolbar { display: flex; gap; margin-top; padding-top; border-top }` — удаляется (D-05, exception).
- `src/styles/inline-runner.css:234-239` — `.rp-inline-runner-content .rp-output-toolbar { gap; margin-top; padding-top; flex-wrap }` — удаляется (D-05, exception).
- `src/styles/inline-runner.css:241-244` — `.rp-inline-runner-content .rp-output-toolbar button { padding; min-height }` — удаляется (D-05, exception).
- `src/views/runner-view.ts:686-704` — sidebar Run again + complete-state `renderOutputToolbar` — НЕ трогаем (cross-mode защита SC#2/#3).
- `src/views/runner-view.ts:1071-...` — sidebar private `renderOutputToolbar` — НЕ трогаем.
- `src/styles/runner-view.css:58, 65-67` — базовые правила `.rp-output-toolbar` и `.rp-copy-btn` / `.rp-save-btn` / `.rp-insert-btn` — НЕ трогаем (sidebar нужен).
- `src/main.ts:339, 356` — `saveOutputToNote` / `insertIntoCurrentNote` — НЕ трогаем (sidebar callers).

### Test files touched

- `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts` (новый, либо расширение `inline-runner-modal.test.ts`) — Inline-mode regression: для каждого из 6 inline-состояний (`idle`, `at-node` question, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`) утверждается отсутствие `.rp-copy-btn`/`.rp-save-btn`/`.rp-insert-btn` в `containerEl`. (D-08)
- `src/__tests__/views/runner-snippet-*.test.ts` или новый `runner-view-output-toolbar.test.ts` — sidebar complete-state regression: 3 кнопки присутствуют. (D-08, cross-mode)
- `src/__tests__/views/inline-runner-modal.test.ts:374-700` — существующие тесты, мокующие `runner.completeSnippet` и `plugin.saveOutputToNote`/`insertIntoCurrentNote` (lines 181-182 в `inline-runner-layout.test.ts`) — должны остаться зелёными после удаления `renderOutputToolbar`. Планнер прогоняет полный test suite после D-03/D-04 (D-09).

### Project guardrails

- `CLAUDE.md` "Critical Rules for Editing Shared Files" — D-05 (удаление CSS) — explicit exception под Phase 67 D-14 паттерн. Документируется в PLAN.md и commit-message: "Phase 69 D-05 — load-bearing wrong code: 3 CSS блока `.rp-inline-runner-content .rp-output-toolbar*` после D-03/D-04 не матчат никакой DOM; exception из 'never remove existing code you didn't add'."
- `CLAUDE.md` "CSS Architecture" — Phase 69 ничего не дополняет в `inline-runner.css`, только удаляет; никакого `/* Phase 69: ... */` комментария добавлять не нужно.
- `.planning/STATE.md` Standing Pitfall #6 — `console.debug` only (Phase 69 не вводит логирование).
- `.planning/STATE.md` Standing Pitfall #8 — только phase-relevant код в shared files; Phase 69 трогает только секции, относящиеся к output toolbar в Inline.
- Phase 60/67 invariants (drag persistence, resize persistence, viewport clamp) — не пересекаются.

### User memory

- `memory/feedback_language.md` — discuss-phase ведётся на русском; CONTEXT.md остаётся на английском (downstream agents читают на английском). Здесь CONTEXT.md написан на русском+английском гибриде, потому что технические термины + цитаты кода и формулировок остаются английскими, объяснения — на русском, как привычно автору.
- `memory/project_snippet_node_ux.md` — file-bound vs directory-bound Snippet UX. Не пересекается с Phase 69 (output toolbar — не snippet UX).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`<h2>Protocol complete</h2>` рендер в `case 'complete'`** (`inline-runner-modal.ts:531`) — остаётся как единственный визуал complete-state (D-07).
- **`rp-inline-runner-close-btn` в шапке** (`inline-runner-modal.ts:306-312`) — Close (X) уже даёт способ выйти из модала; D-06 ссылается на это для отказа от Run again.
- **Phase 65 `renderRunnerFooter`** (`inline-runner-modal.ts:551-586`) — Back/Skip footer row живёт внутри `rp-question-zone`, не пересекается с `outputToolbar`. Удаление `outputToolbar` не задевает Phase 65.
- **`plugin.saveOutputToNote` / `plugin.insertIntoCurrentNote`** (`main.ts:339,356`) — переиспользуются sidebar `runner-view.ts`, остаются нетронутыми (D-04).
- **Sidebar `renderOutputToolbar`** (`runner-view.ts:1071-...`) — параллельная реализация, остаётся как есть; cross-mode regression-тест (D-08) проверяет её.

### Established Patterns

- **Phase 67 D-13 / D-14 как прецедент.** Любое расширение scope относительно ROADMAP/REQUIREMENTS буквы документируется в первом плане фазы (D-02). Удаление "load-bearing wrong code" вне правила "never remove existing code" — explicit exception в CLAUDE.md, документируется в PLAN.md и commit (D-05).
- **CSS append-only per phase** (`CLAUDE.md`) — Phase 69 ничего не добавляет в CSS, только удаляет 3 dead блока с exception. Это редкий случай отрицательной диффы в `src/styles/`.
- **Single render path в Inline.** `inline-runner-modal.ts` `render()` — один switch по `state.status`; все 6 состояний рендерятся одним и тем же стилем. D-03 убирает один общий элемент (`outputToolbar`) сразу из всех состояний, не нужно по-отдельности менять каждый case.
- **Cross-mode regression защита.** Sidebar `RunnerView` и tab Runner View — отдельный код (`runner-view.ts`), не должен меняться. SC#2/#3 ROADMAP'а проверяется регресс-тестом (D-08).

### Integration Points

- **`inline-runner-modal.ts` `render()`** — единственное место, где исчезает `outputToolbar` div и 6 вызовов `renderOutputToolbar`. Один файл, один метод (D-03).
- **`inline-runner-modal.ts:960-1002`** — единственный приватный метод, удаляющийся целиком (D-04). Один файл, одна функция.
- **`inline-runner.css:74-80, 234-239, 241-244`** — три блока, идущие подряд в логических секциях, удаляются целиком (D-05). Один файл, три блока.
- **`REQUIREMENTS.md` / `ROADMAP.md`** — два документа обновляются в первом плане Phase 69 для scope-аменда (D-02). Phase 67 D-13 паттерн.
- **Тестовая поверхность** — один новый файл (или расширение существующего) для Inline во всех 6 состояниях + один утверждение в sidebar тесте (D-08). Не требует новых mock-инфраструктур (`obsidian` mock + `Vault` уже мокированы в `inline-runner-modal.test.ts:181-182` и братских файлах).

</code_context>

<specifics>
## Specific Ideas

- Inline-режим всю дорогу пишет в активную заметку (Phase 54 контракт `appendDeltaFromAccumulator(beforeText)` через Phase 59 INLINE-FIX-04). Поэтому result-export кнопки `Copy/Save/Insert` в Inline избыточны в любом состоянии, не только complete — это центральный аргумент за расширенный scope (D-01).
- Phase 67 D-13 / D-14 — прямой прецедент scope-аменда и CLAUDE.md exception. Phase 69 повторяет ровно те же два паттерна (D-02, D-05). Это рекуррентный шаблон в этом проекте.
- Минималистичный complete-state (D-07) — сознательное решение: добавление статус-строки "Текст записан в X.md" — это новый UI-элемент, не предусмотренный INLINE-CLEAN-01, и потенциально вышел бы за phase scope.
- Inline-режим `'Protocol complete'` heading + Close в шапке — этого достаточно для сигнала окончания. Если в будущем UAT покажет, что пользователь чувствует себя потерянным в complete — это будет отдельная фаза с явным UI-полишем.

</specifics>

<deferred>
## Deferred Ideas

- **Run again в Inline complete-state** — паритет с sidebar/tab `runner-view.ts:686-704`. Не добавляем в Phase 69 (D-06). Возможная будущая фаза: новая кнопка в `rp-inline-runner-header` рядом с Close (или в `questionZone` в complete-state), вызывающая `restartCanvas`-эквивалент для inline-modal lifecycle. Учесть Phase 60/67 drag/resize state — restart должен сбросить runner, но оставить geometry. Кандидат на v1.12+.
- **Статус-строка "Текст записан в [target note name]"** в Inline complete-state — обсуждалось, отвергнуто по minimalism reasons (D-07). Если UAT v1.11 покажет confusion — будущий UX-полиш.
- **Preview final-text в Inline complete-state** (sidebar `renderPreviewZone(previewZone, state.finalText)` паттерн) — Phase 54 дизайн "note as buffer, не нужен preview". Не добавляем. Если когда-то Phase 54 D2 пересмотрят — фаза для этого.
- **Refactor `renderOutputToolbar` в shared helper с `mode: 'inline' | 'sidebar'`** — Phase 65 `renderRunnerFooter` style. Сейчас sidebar и inline `renderOutputToolbar` имели разную семантику (sidebar читал `previewTextarea?.value`, inline — нет), к тому же inline-копия теперь удаляется вообще; refactor бессмыслен. Если будущая фаза вернёт inline output-кнопки в каком-либо новом виде — тогда стоит подумать о shared helper.

### Reviewed Todos (not folded)

None — `.planning/todos/pending/` не сканировался по этому inline-output-toolbar topic; cross_reference_todos шаг по этой phase ничего не вернул (todo_count = 0 в init.phase-op JSON).

</deferred>

---

*Phase: 69-inline-runner-hide-result-export-buttons-in-complete-state*
*Context gathered: 2026-04-29*
