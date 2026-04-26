# Phase 66: Runner Step-Back Reliability & Scroll Pinning - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 66 закрывает две связанные UX-регрессии в Protocol Runner:

1. **RUNNER-03 — Step-back reliability:** одиночный клик на Back продвигает раннер назад ровно на один шаг в каждом состоянии (`at-node`, `awaiting-loop-pick`, `awaiting-snippet-pick`, `awaiting-snippet-fill`, `complete`) во всех трёх runner-модах (sidebar, tab, inline); double-click никогда не вызывает double-step; "Processing..." placeholder не висит дольше одного re-render frame; повторные Back-клики через границы циклов не портят accumulated text и loop context stack.

2. **RUNNER-04 — Scroll pinning:** preview textarea в **sidebar/tab** runner-модах автоматически скроллится в низ после file-bound snippet insert и после step-back, в дополнение к уже корректно работающему scroll-у при Answer-insert и directory-bound snippet insert.

**In scope:**
- `ProtocolRunner.stepBack()` semantics + state restoration (extend `UndoEntry` с `restoreStatus`).
- Double-click guard: in-flight flag в `ProtocolRunner` + `button.disabled` во вью.
- Удаление `'Processing...'` default placeholder из `RunnerView.renderState`.
- Унификация scroll-pinning архитектуры в `RunnerView`: scroll-to-bottom by default в `renderPreviewZone`, удаление `pendingTextareaScrollTop` флага и всех 6 `capturePendingTextareaScroll()` call-sites.
- Shared click-binding helper для Back-кнопки между `RunnerView` и `InlineRunnerModal` (расширение Phase 65 footer-helper).
- Loop-boundary roundtrip property test + 4 scripted scenarios.
- 66-UAT.md scripted чеклист для RUNNER-04 visual scroll verification.

**Out of scope:**
- Skip / Answer / Snippet-branch / Loop-branch double-click guards (только Back).
- Inline runner: text removal из note при step-back (нарушение SC3 для inline — сознательный trade-off, отложено).
- Inline runner: scroll-to-cursor / scrollIntoView интеграция с editor (RUNNER-04 не применяется к inline).
- Изменения семантики `runner.skip()`, `chooseAnswer`, `chooseLoopBranch`, `chooseSnippetBranch`, `pickSnippet`, `pickFileBoundSnippet`, `completeSnippet` (только добавление `restoreStatus` в UndoEntry payload).
- Phase 65 footer placement / button copy / responsive wrapping.
- Keyboard shortcuts для Back.
- E2E / Playwright harness.

</domain>

<decisions>
## Implementation Decisions

### Single-click guarantee (Area 1)

- **D-01:** Защита от double-click живёт в **двух слоях**: `ProtocolRunner.stepBack()` ставит in-flight флаг и silent no-op'ит при повторном вызове в той же tick; `RunnerView` и `InlineRunnerModal` дополнительно ставят `button.disabled = true` сразу после клика. Корректность гарантируется state machine, visual feedback — view-уровнем.
- **D-02:** Visual feedback — стандартный HTML `button.disabled` атрибут. Никакого нового CSS, никакого custom `.rp-step-back-btn--processing` класса. Это совпадает с существующим поведением output toolbar (Copy/Save/Insert disabled).
- **D-03:** Click-binding на Back инкапсулируется в **shared helper** — расширение `renderRunnerFooter` из Phase 65 (`runner-view.ts:737`). Helper встраивает guard и используется обоими view'ами одинаково. Дрейф между `RunnerView.registerDomEvent` и `InlineRunnerModal.addEventListener` устраняется по конструкции.
- **D-04:** Защита от double-click распространяется **только на Back**. Skip / Answer / Snippet-branch / Loop-branch / output toolbar — out of scope для Phase 66 (отдельные баги если найдутся).

### Step-back state restoration (Area 2)

- **D-05:** `UndoEntry` (`src/runner/runner-state.ts:88-105`) расширяется опциональным полем `restoreStatus?: RunnerStatus`. Каждый push-site указывает желаемый статус восстановления:
  - `chooseLoopBranch` (line 235-240) → `restoreStatus: 'awaiting-loop-pick'`
  - `pickSnippet` (line 305-318) → `restoreStatus: 'awaiting-snippet-pick'`
  - `advanceThrough` loop-entry push (line 703-707) → `restoreStatus: 'awaiting-loop-pick'`
  - `chooseAnswer` / `skip` / `pickFileBoundSnippet` → `restoreStatus` undefined (= `'at-node'`, существующее поведение)
  - `chooseSnippetBranch` (line 195-202) — оставляем `returnToBranchList: true` без изменений (уже корректно восстанавливает `'at-node'` @ question)
  - `stepBack` (line 271-295): `this.runnerStatus = entry.restoreStatus ?? 'at-node'`. Существующая ветка `returnToBranchList === true` сохраняет приоритет.
- **D-06:** Back из `awaiting-snippet-fill`:
  - **Directory-bound chain** (was через picker): возвращает к `awaiting-snippet-pick` на том же snippet node — пользователь может выбрать другой snippet без повторного клика по snippet branch на question. Реализуется через `pickSnippet.restoreStatus = 'awaiting-snippet-pick'`.
  - **File-bound chain** (picker не был открыт): возвращает к `at-node` на question. Это существующее поведение `pickFileBoundSnippet`-undo, сохраняется как есть.
- **D-07:** `'Processing...'` default placeholder в `RunnerView.renderState` `case 'at-node'` (`runner-view.ts:586-594`) — **удалить**. Заменить на `transitionToError('No render path for ${node.kind} at-node — internal bug')` + TypeScript exhaustiveness check (narrow `node.kind` union с `default` branch как `_exhaustive: never`). После D-05 этот путь становится недостижимым; exhaustiveness check ловит будущие регрессии на compile-time, error-transition ловит на runtime.
- **D-08:** Loop-boundary text invariant покрывается **двумя слоями тестов**:
  - **Property roundtrip:** для случайного валидного forward-пути длиной N (генератор по существующим fixtures), `back × N` должен дать accumulated text === начальный, и наоборот для `back × N → forward × N`. Реализация — vitest property test (без fast-check, runtime собственная утилита).
  - **Scripted scenarios:** четыре сценария, каждый — отдельный `it()` блок с конкретным fixture'ом и handcrafted assertions (см. D-13).

### Scroll-pinning architecture (Area 3)

- **D-09:** Scroll-to-bottom становится **поведением по умолчанию** `RunnerView.renderPreviewZone` (`runner-view.ts:1057-1083`). Каждый раз когда метод создаёт новый textarea — после layout (`requestAnimationFrame`) выставляет `textarea.scrollTop = textarea.scrollHeight`.
- **D-10:** Удаляются:
  - Поле `pendingTextareaScrollTop` из `RunnerView`
  - Метод `capturePendingTextareaScroll()` (line 1053-1055)
  - Все 6 call-sites: `runner-view.ts:494, 516, 538, 675, 798, 875`
  - Условный блок `if (this.pendingTextareaScrollTop !== null)` (line 1073-1076)
- **D-11:** Manual scroll position пользователя **не сохраняется** между render'ами. Раннер re-render'ится только в ответ на click-action — пользователь ожидает увидеть результат внизу. RUNNER-04 SC4-5 это и требуют.
- **D-12:** RUNNER-04 (scroll pinning) **только для sidebar/tab runner мод** (`RunnerView` с `previewTextarea`). Inline runner mode пишет напрямую в active Obsidian note через `appendDeltaFromAccumulator` — управление scroll'ом editor'а делегируется Obsidian, RUNNER-04 не применяется. Это уточняет roadmap-формулировку «preview textarea» — у inline mode такого preview нет.

### Loop scope + inline scope (Area 4)

- **D-13:** Scripted loop scenarios (требуются под D-08):
  1. **Back из тела loop body, iteration N:** forward до text-block внутри тела на 2-й iteration → back → ожидаемое состояние `awaiting-loop-pick` @ loop node, iteration=2, accumulated text === перед клик-входом в body 2-й iteration.
  2. **Back через `+exit` edge:** forward через `+exit` → back → `awaiting-loop-pick` @ loop node, iteration=N (тот же frame восстановлен, loopContextStack снова содержит этот frame), accumulated text === перед exit click.
  3. **Dead-end body auto-loop-back:** forward по body до dead-end → автоматический возврат к loop picker (`advanceOrReturnToLoop` + B1 re-entry в `case 'loop'` поднимает iteration на единицу) → back → отменяет авто-возврат, восстанавливает состояние перед last user click внутри body.
  4. **Nested loops:** forward в outer loop body, заход в inner loop, выбор branch в inner picker → back → возврат к inner picker (не к outer); ещё back → back в body inner; outer loopContextStack frame не изменился между этими шагами.
- **D-14:** Loop fixtures — переиспользовать существующие из `src/__tests__/fixtures/` (например `unified-loop-valid.canvas`, `unified-loop-nested.canvas` если есть; иначе `protocol-runner-loop-picker.test.ts:126`-style встроенные graph builders). Не создавать новых fixture-файлов кроме как в крайнем случае.
- **D-15:** Inline runner step-back **обновляет только runner state, не трогает note**. `InlineRunnerModal` уже так делает (`inline-runner-modal.ts:405-413, 469-477, 938-950`) — Phase 66 сохраняет это поведение. RUNNER-03 SC3 («protocol preview matches the same content») для inline mode частично нарушен (note не возвращается к pre-click состоянию), но это сознательный trade-off: text removal из открытой note опасно (пользователь мог сам редактировать). Деструктивный inline-back — отложен в deferred ideas.
- **D-16:** RUNNER-04 visual scroll verification — через **scripted чеклист в `66-UAT.md`** (паттерн из Phase 63 `63-VALIDATION.md` "Manual-Only Verifications"). Минимум 3 пункта:
  1. Sidebar mode + canvas с file-bound snippet нодом, накопить достаточно текста чтобы появился scroll, кликнуть snippet branch → подтвердить tail виден.
  2. То же что (1), но кликнуть Back → подтвердить tail (новый после step-back) виден.
  3. Tab mode (re-open в tab) — повторить (1)-(2).

### the agent's Discretion

- Точное имя `restoreStatus` поля в `UndoEntry` (можно `restoreToStatus` / `postUndoStatus` / иное), главное чтобы семантика была явной.
- Точное имя shared helper'а / расширения `renderRunnerFooter` (D-03) — `renderRunnerFooter` уже существует, planner решает добавить `guardedClick` параметр, обернуть существующий callback, или ввести новый wrapper.
- Имя поля in-flight флага в `ProtocolRunner` (например `_stepBackInFlight: boolean`).
- Точное расположение property roundtrip теста (`src/__tests__/runner/protocol-runner-step-back-roundtrip.test.ts` или внутри существующего `protocol-runner.test.ts`).
- Использование fast-check / hand-rolled property generator — planner решает.
- Если existing tests (`protocol-runner.test.ts:103-180`, `protocol-runner-loop-picker.test.ts:126`, `protocol-runner-skip.test.ts:203-284`, `protocol-runner-pick-file-bound-snippet.test.ts`) ломаются от D-05 (restoreStatus меняет post-undo `runnerStatus`) — обновить assertions; не откатывать D-05.
- Удаление `Processing...` (D-07): `transitionToError` или `console.error` + return — на усмотрение, главное чтобы default branch был unreachable по типам.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 66 Requirements

- `.planning/ROADMAP.md` §Phase 66 (lines 384-394) — goal + 5 success criteria для RUNNER-03 / RUNNER-04.
- `.planning/REQUIREMENTS.md` RUNNER-03 (line 23), RUNNER-04 (line 25) — full requirement text.
- `.planning/PROJECT.md` Current Milestone v1.10 — milestone-level statement.

### Prior Decisions

- `.planning/phases/65-runner-footer-layout-back-skip-row/65-CONTEXT.md` D-12, D-13 — shared `renderRunnerFooter` helper pattern (Phase 66 расширяет его в D-03).
- `.planning/milestones/v1.8-phases/53-runner-skip-close-buttons/53-CONTEXT.md` — Skip semantics (Phase 66 не меняет).
- `.planning/phases/63-bidirectional-canvas-node-editor-sync/63-VALIDATION.md` — Manual-Only Verifications pattern (Phase 66 копирует в 66-UAT.md, см. D-16).

### Source Touchpoints

- `src/runner/protocol-runner.ts`:
  - `:34` — `undoStack: UndoEntry[]`
  - `:85-110` — `chooseAnswer` push site
  - `:139-155` — `skip` push site
  - `:195-202` — `chooseSnippetBranch` push site (`returnToBranchList: true`)
  - `:235-240` — `chooseLoopBranch` push site **(D-05 + restoreStatus)**
  - `:271-295` — `stepBack` **(D-05 ветка restoreStatus, D-01 in-flight guard)**
  - `:305-318` — `pickSnippet` push site **(D-05 + restoreStatus)**
  - `:341-360` — `pickFileBoundSnippet` push site
  - `:367-391` — `completeSnippet`
  - `:593-712` — `advanceThrough` (loop-entry push at `:703-707` **(D-05 + restoreStatus)**)
- `src/runner/runner-state.ts:88-105` — `UndoEntry` type **(D-05 — добавить `restoreStatus?` поле)**
- `src/views/runner-view.ts`:
  - `:438-728` — `render` / `renderState` switch (D-07 удаление `'Processing...'` default at `:586-594`)
  - `:494, 516, 538, 675, 798, 875` — все `capturePendingTextareaScroll()` call-sites **(D-10 удалить)**
  - `:597-606`, `:670-678`, `:845-852` (искать `runner.stepBack()`) — Back wire-up sites (заменить на guarded helper из D-03)
  - `:737-770` — `renderRunnerFooter` (D-03 расширение)
  - `:1053-1055` — `capturePendingTextareaScroll` метод **(D-10 удалить)**
  - `:1057-1083` — `renderPreviewZone` **(D-09 — scroll-to-bottom by default)**
  - `:1069-1076` — условный блок `if (pendingTextareaScrollTop !== null)` **(D-10 удалить)**
- `src/views/inline-runner-modal.ts`:
  - `:405-413`, `:469-477`, `:938-950` — Back wire-up sites (заменить на guarded helper из D-03)
- `src/styles/runner-view.css:97-102` — `.rp-step-back-btn` (Phase 66 дополнения append-only per CLAUDE.md)
- `CLAUDE.md` — append-only CSS rule, never-remove rule для shared файлов

### Test Surface

- `src/__tests__/runner/protocol-runner.test.ts:103-180` — `stepBack()` undo suite (assertions могут потребовать update под D-05 restoreStatus)
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:126` — loop step-back test (D-08 расширение property + 4 scripted scenarios D-13)
- `src/__tests__/runner/protocol-runner-skip.test.ts:203-284` — skip + stepBack roundtrip
- `src/__tests__/runner/protocol-runner-pick-file-bound-snippet.test.ts` — file-bound snippet undo
- `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` — snippet picker + branch list back
- `src/__tests__/views/runner-snippet-sibling-button.test.ts` — RunnerView mixed branch rendering
- `src/__tests__/views/runner-snippet-picker.test.ts` — picker + Back rendering (D-06 directory-bound chain → picker)
- `src/__tests__/views/inline-runner-modal.test.ts` — inline parity (D-15)

### Loop fixtures

- `src/__tests__/fixtures/` (искать `unified-loop-*.canvas`) — переиспользовать (D-14)
- `.planning/fixtures/` (если существует) — secondary location

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`renderRunnerFooter` helper** (`runner-view.ts:737-770`) — shipped в Phase 65, уже инкапсулирует Back-кнопку с `registerDomEvent` обёрткой. Phase 66 D-03 расширяет signature: добавить `guarded: true` параметр (или обернуть `onBack` callback в guard internally). InlineRunnerModal должна перейти на тот же helper — на сегодня она использует `addEventListener` на сырой `createEl('button')`.
- **`UndoEntry.returnToBranchList: boolean`** (`runner-state.ts:88-105`) — существующий precedent для расширения UndoEntry опциональным behavioral флагом. D-05 добавляет `restoreStatus?: RunnerStatus` по тому же паттерну.
- **`transitionToError(message)`** (`protocol-runner.ts`, есть множественные call-sites) — для D-07 замены `'Processing...'` placeholder на видимую ошибку.
- **`requestAnimationFrame` блок в `renderPreviewZone`** (`runner-view.ts:1063-1077`) — уже выставляет `textarea.scrollHeight + 'px'` для auto-size; добавить безусловный `textarea.scrollTop = textarea.scrollHeight` сразу после height assignment (D-09).
- **Phase 47 RUNFIX-02 doc-comments** — описывают одноразовый flag pattern; Phase 66 D-10 удаляет этот pattern, comments тоже снимаются (per CLAUDE.md only-add-or-modify-relevant rule, обоснование удаления — текущая фаза замещает Phase 47 механизм).

### Established Patterns

- **Undo-before-mutate (Pitfall 1/3)** во всех мутирующих методах ProtocolRunner. Phase 66 не меняет порядок push'а — только payload UndoEntry (D-05).
- **`runner-state.ts` discriminated union** на `runnerStatus` — добавление `restoreStatus` поля затрагивает только UndoEntry, не сам `RunnerState`. Type safety preserved.
- **Tests на ProtocolRunner — pure unit без DOM**, на RunnerView — vitest + jsdom. D-08 property roundtrip живёт на стороне ProtocolRunner (без DOM); RUNNER-04 scroll — через scripted UAT (D-16), не через DOM unit test (jsdom не вычисляет scrollHeight надёжно).
- **InlineRunnerModal vs RunnerView дрейф** — задокументирован в Phase 65 CONTEXT.md (sidebar/tab используют `registerDomEvent`, inline — сырой `addEventListener`). D-03 shared helper устраняет drift для Back wire-up.

### Integration Points

- **`UndoEntry.restoreStatus` (D-05)** — единственное breaking change в API ProtocolRunner. Каждое существующее место `undoStack.push({...})` обновляется атомарным изменением. Тесты в `protocol-runner.test.ts:103-180` могут проверять `runnerStatus === 'at-node'` после stepBack из loop / snippet — assertions потребуют обновления к новому ожидаемому статусу (`'awaiting-loop-pick'` / `'awaiting-snippet-pick'`). Это intended изменение поведения (D-06), не bug.
- **`renderRunnerFooter` (D-03)** — расширение без breaking change: добавить опциональный `guarded?: boolean` параметр (default `true` для Back, иначе сохраняется текущее поведение). Inline modal click handlers (3 сайта) переключаются на `renderRunnerFooter` вызов (если ещё не используют) или на новый shared helper, если `renderRunnerFooter` живёт в `RunnerView` и не доступен из `InlineRunnerModal` — planner решает экстракцию.
- **`renderPreviewZone` (D-09)** — изменение поведения: scroll-to-bottom always. Любой test ожидающий `scrollTop === 0` после render потребует обновления. Скорее всего таких тестов нет (jsdom scrollHeight ненадёжен), но planner проверяет.
- **Phase 65 footer / Phase 66 guard** — Phase 65 уже использует `renderRunnerFooter` для Back/Skip footer; Phase 66 надстраивает guard поверх. Скорее всего удобнее всего проинициализировать guard внутри `renderRunnerFooter` ветки `if (options.showBack)` (`runner-view.ts:750-758`).

</code_context>

<specifics>
## Specific Ideas

- Discussion велась на русском (per memory), плагин UI остаётся English-only — кнопка остаётся `Back`.
- Пользователь подтвердил восприятие "Processing..." как видимого баг-симптома — fix должен быть наблюдаем через UAT, не только через unit tests.
- Пользователь явно расширил scope обсуждения когда выбрал «Не важно — фиксим всё» (Area 3 Q3) — RUNNER-04 SC формулировка про «matching existing correct behaviour» рассматривается как косметическая, реальный fix унифицирует все insert-paths одновременно через D-09.
- Inline runner step-back трактуется как state-only operation (D-15) — пользователь предпочёл безопасность (не трогать note) над буквальным выполнением SC3 в inline mode. SC3 для sidebar/tab остаётся обязательным.

</specifics>

<deferred>
## Deferred Ideas

- **Inline runner: text removal из note при step-back** — нарушает SC3 для inline mode, но удалять текст из открытой Obsidian note который пользователь мог редактировать — деструктивно. Отложено до отдельной фазы с проработкой UX (например diff-based undo с подтверждением, или snapshot-based revert с пометкой regions, изменённых runner'ом vs пользователем).
- **Universal double-click guard на все мутирующие методы ProtocolRunner** — Phase 66 D-04 ограничивает scope до Back. Если в production обнаружатся аналогичные регрессии на Skip / Answer / Snippet branch / Loop branch — отдельная фаза или phase-insert.
- **Detect manual scroll и уважать user scroll position** — отвергнуто в Area 3 Q2 как избыточная сложность для текущего use case. Если кто-то начнёт читать накопленный текст в preview во время выбора — будущая фаза.
- **Scroll-to-cursor / scrollIntoView в inline mode** — RUNNER-04 в Phase 66 не покрывает inline. Если редактор Obsidian не сам скроллит к месту вставки — отдельная фаза.
- **Keyboard shortcuts для Back** (Esc / Backspace / Cmd+Z) — упомянуто как deferred в Phase 65, остаётся deferred.
- **Playwright / E2E harness для visual regression** — отвергнуто как overhead для одной фазы. Если в v1.11+ накопится больше визуальных регрессий — отдельная фаза.

</deferred>

---

*Phase: 66-runner-step-back-reliability-scroll-pinning*
*Context gathered: 2026-04-25*
