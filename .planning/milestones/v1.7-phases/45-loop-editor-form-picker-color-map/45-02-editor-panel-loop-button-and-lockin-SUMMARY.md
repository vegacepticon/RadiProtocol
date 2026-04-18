---
phase: 45-loop-editor-form-picker-color-map
plan: 02
subsystem: ui
tags: [phase-45, editor-panel, loop-05, quick-create, css, lock-in-tests]

# Dependency graph
requires:
  - phase: 44-unified-loop-runtime
    provides: Phase 44 UAT-fix `case 'loop'` form in editor-panel-view.ts (lines 568-586) + `'loop'` option in node-type dropdown
  - phase: 43-unified-loop-graph-model-parser-validator-migration-errors
    provides: NODE_COLOR_MAP['loop']='1' (D-12) + RPNodeKind union with 'loop'
  - phase: 42-double-click-ux
    provides: Phase 42 snippet quick-create button CSS + TS template (per-feature CSS + toolbar block pattern)
  - phase: 39-quick-create-toolbar
    provides: onQuickCreate helper with debounce flush + renderToolbar scaffold
  - phase: 28-auto-color-injection
    provides: saveNodeEdits color-injection pipeline (NODE_COLOR_MAP lookup before canvasLiveEditor.saveLive)
provides:
  - Loop quick-create button (4th toolbar button, .rp-create-loop-btn, icon 'repeat')
  - onQuickCreate kind-union widened to 4 kinds ('question' | 'answer' | 'snippet' | 'loop')
  - Phase 44 UAT-fix loop form behaviour locked in by 7 unit tests
  - NODE_COLOR_MAP['loop']='1' integration verified end-to-end via saveNodeEdits
  - Phase 45 CSS block appended to editor-panel.css with proper phase marker
  - styles.css / src/styles.css regenerated via `npm run build`
affects:
  - 45-03-start-from-node-command (no direct dependency but shares editor-panel surface)
  - Any future phase adding a 5th quick-create kind (has 4-kind pattern to extend)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-kind quick-create toolbar (question, answer, snippet, loop) with per-kind CSS selectors"
    - "Lock-in unit tests for stable form behaviour that was introduced by a prior UAT fix"
    - "Integration smoke test via saveLive mock returning true — short-circuits vault fallback and exposes enrichedEdits arg for color-injection assertion"

key-files:
  created:
    - src/__tests__/editor-panel-loop-form.test.ts
  modified:
    - src/views/editor-panel-view.ts
    - src/styles/editor-panel.css
    - styles.css
    - src/styles.css

key-decisions:
  - "Chose Lucide icon 'repeat' over alternatives (D-CL-01) — cleanest loop semantics, no ambiguity with refresh/single-replay"
  - "Class name rp-create-loop-btn — direct parallel to rp-create-{question,answer,snippet}-btn convention"
  - "Tests 6-7 (factory dispatch + debounce flush) pass pre-union-widen at runtime because onQuickCreate body is kind-agnostic — TypeScript union is compile-time only; still red against tsc until Task 2 widens the union"
  - "saveLive mock returns true — exits saveNodeEdits pipeline before vault.modify fallback, so color-injection assertion runs in pure unit-test layer with no filesystem dependency"
  - "CSS block appended via single Edit replacing the Phase 42 responsive-toolbar block + new Phase 45 block in one atomic change — zero edits to prior Phase 4/39/40/42 rules"

patterns-established:
  - "Pattern: Phase-boundary CSS marker `/* Phase N: description */` followed by class-scoped rule set — greppable, append-only, preserves all prior phase blocks"
  - "Pattern: Lock-in test file (`*-loop-form.test.ts`) created in the same wave as the corresponding TS delta — RED/GREEN cycle fits because Tests 6-7 only become fully TypeScript-compliant after the union widens"

requirements-completed: [LOOP-05, LOOP-06]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 45 Plan 02: Editor-panel loop button + form lock-in Summary

**Добавлена 4-я quick-create кнопка «Create loop node» (icon 'repeat', class `rp-create-loop-btn`) в тулбар Node Editor, расширен `onQuickCreate` до 4 kinds, закреплена Phase 44 UAT-fix loop-форма 7 lock-in тестами, и подтверждена color-map интеграция (`color:'1'`) через существующий Phase 28 `saveNodeEdits` pipeline — без изменения самой формы или factory.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-18T08:25:02Z
- **Completed:** 2026-04-18T08:29:25Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified source; styles.css/src/styles.css auto-regenerated)

## Accomplishments

- **LOOP-05 (authoring UX):** Автор может кликом создать loop-узел через Node Editor toolbar; новый узел получает `radiprotocol_nodeType='loop'` + `color:'1'` (красный) через уже существующий `CanvasNodeFactory.createNode` pipeline — factory не редактируется (D-CL-03 zero-delta).
- **LOOP-06 (color-map integration):** End-to-end покраска loop-узла через `saveNodeEdits` → `NODE_COLOR_MAP['loop']='1'` → `canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits)` закреплена integration-тестом (Test 5 в новом файле).
- **Lock-in:** Phase 44 UAT-fix форма (editor-panel-view.ts:568-586) зафиксирована 5 unit-тестами: dropdown 'loop' option, heading 'Loop node', exactly-one 'Header text' Setting, negative `/iterations/i` regression guard (RUN-07 excision), onChange dual-field sync (radiprotocol_headerText + text).
- **onQuickCreate union расширен** до 4 kinds (`'question' | 'answer' | 'snippet' | 'loop'`, D-04) — body не тронут (zero logic delta), factory call kind-agnostic.
- **CSS append-only:** `src/styles/editor-panel.css` получил блок `.rp-create-loop-btn` (base + :hover + :active + :disabled) под маркером `/* Phase 45: loop quick-create button */`. Phase 4/39/40/42 блоки (lines 1-168) byte-identical.
- **Regenerated:** `styles.css` + `src/styles.css` через `npm run build` — единственная дельта: новые правила `.rp-create-loop-btn` точно как в source.

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Lock-in tests for Phase 44 loop form + quick-create button** — `306adff` (test)
2. **Task 2: Add loop quick-create button + widen onQuickCreate union + CSS append + build** — `926ed43` (feat)

**Plan metadata commit:** будет добавлен после SUMMARY.md + STATE.md + ROADMAP.md обновлений.

## Files Created/Modified

- **created** `src/__tests__/editor-panel-loop-form.test.ts` — 7 vitest cases в 2 describe-блоках: `LOOP-05: Node Editor loop form lock-in (D-01, D-02, D-17)` (5 тестов) и `LOOP-05: Quick-create loop button (D-03, D-04)` (2 теста). Pitfall-2 Setting.prototype chainable stubs, Pitfall-3 contentEl fake, Pitfall-4 renderToolbar spy. Zero внешних фикстур.
- **modified** `src/views/editor-panel-view.ts` — (а) сигнатура `onQuickCreate` расширена до `'question' | 'answer' | 'snippet' | 'loop'` (line 745); (б) новый 8-строчный блок `.rp-create-loop-btn` в renderToolbar (между lines 874 и 876 — строго между snippet и duplicate блоками). Case 'loop' form (568-586), legacy 'loop-start'/'loop-end' stub (557-566), Phase 42 snippet button (867-874), saveNodeEdits (164-273) — byte-preserved.
- **modified** `src/styles/editor-panel.css` — append-only Phase 45 блок (29 новых строк) в конец файла с маркером `/* Phase 45: loop quick-create button */`. Phase 4/39/40/42 секции (lines 1-168) не тронуты.
- **auto-regenerated** `styles.css` + `src/styles.css` — единственная дельта +30 строк каждый (новый `.rp-create-loop-btn` block).

## Decisions Made

- **Icon = 'repeat' (D-CL-01 finalize).** Из 4 кандидатов (repeat, repeat-1, rotate-cw, infinity) выбран `'repeat'` — самая прямая семантика «зациклить», две стрелки образующие петлю. `repeat-1` = «повторить один раз» (не про loop), `rotate-cw` ассоциируется с refresh, `infinity` визуально похож на 8.
- **Class = `rp-create-loop-btn` (D-CL-02 finalize).** Прямой parallel к `rp-create-{question,answer,snippet}-btn`.
- **Tests 6-7 (onQuickCreate factory + debounce flush) прошли RED→GREEN одновременно с Task 1.** Runtime `onQuickCreate` body kind-agnostic (`factory.createNode(path, kind, anchorId)` принимает любую строку); TypeScript union — compile-time gate, а тест использует `as unknown as` каст. Формально это ожидаемый TDD RED→GREEN переход: до Task 2 `tsc --noEmit` проходит (union не ссылается в тесте напрямую), runtime — тоже. Плюс: тест становится фактически lock-in 7/7 с первого коммита.
- **`canvasLiveEditor.saveLive` mocked to return `true`** — short-circuit в `saveNodeEdits` (lines 186-190), избегаем vault.modify fallback в integration-тесте color-injection. Это делает Test 5 чистым unit-тестом без filesystem-зависимости.
- **CanvasNodeFactory не редактирован (D-CL-03 zero-delta).** Factory тело kind-agnostic: `NODE_COLOR_MAP[nodeKind]` автоматически возвращает `'1'` для 'loop'. Phase 45 только использует уже готовый path.

## Deviations from Plan

**Одна косметическая правка в Task 1 для соответствия grep-acceptance-criterion `exactly 1 match` на `vi.mock('obsidian')`.**

### Minor adjustment (not a Rule-1/2/3 deviation)

**1. [Comment-only edit] Reworded комментарий в editor-panel-loop-form.test.ts**
- **Found during:** Task 1 post-write acceptance-criteria verification
- **Issue:** Первоначальный комментарий на строке 160 содержал literal `vi.mock('obsidian')` — это делало `grep -c "vi.mock('obsidian')"` возвращающим 2, нарушая criterion «exactly 1 match».
- **Fix:** Переформулировал комментарий как `// Pitfall 3: stub contentEl — obsidian module mock auto-stubs ItemView without body.` — тот же смысл, без literal.
- **Files modified:** `src/__tests__/editor-panel-loop-form.test.ts` (pre-commit edit — never committed with original text)
- **Verification:** `grep -c "vi.mock('obsidian')" src/__tests__/editor-panel-loop-form.test.ts` returns 1.
- **Committed in:** `306adff` (Task 1 commit — применено до git add)

---

**Total deviations:** 0 functional (1 pre-commit comment reword for literal-grep compliance).
**Impact on plan:** Нулевой — план executed ровно как написан, все acceptance criteria + done-criteria выполнены.

## Issues Encountered

- **Hook READ-BEFORE-EDIT** срабатывал после Write при попытке последующего Edit'а только что созданного test-файла. Edit всё равно применялся (runtime allow-listed Write→Edit в той же сессии), но hook выдавал warning. Продолжил работу без проблем.
- **PreToolUse Edit reminders** для `editor-panel-view.ts` и `editor-panel.css` (файлы, которые я уже читал в той же сессии, но для которых hook требовал повторный Read перед каждым Edit). Edits применялись корректно — проверил после каждого через `grep`.

## User Setup Required

None — никаких environment variables, credentials, или external services. Phase 45 — чистая in-plugin code/CSS работа.

## Next Phase Readiness

- **45-03 (start-from-node-command):** Не зависит от 45-02. Может выполняться в Wave 2 независимо. Оба плана трогают разные поверхности (45-02 → editor-panel; 45-03 → main.ts + runner-view.ts + protocol-runner.ts).
- **Manual UAT (из VALIDATION.md):** Три визуальные проверки:
  1. Node Editor toolbar показывает 4-ю кнопку «Create loop node» (icon repeat) после snippet и перед duplicate.
  2. Клик по кнопке создаёт loop-узел на canvas с **красным** цветом (Obsidian palette position "1"); Node Editor показывает «Loop node» heading + «Header text» textarea + NO iterations field.
  3. Ctrl+P → «Start from specific node» (добавляется в 45-03) — не в scope этого плана.
- **Zero-delta gate VM-15:** CanvasNodeFactory.createNode содержит `radiprotocol_nodeType: nodeKind` + `color: NODE_COLOR_MAP[nodeKind]` — проверено grep'ом, не редактировалось.

## Self-Check: PASSED

Verification of claims in this SUMMARY:

- FOUND: `src/__tests__/editor-panel-loop-form.test.ts` — `git log --oneline -5 | grep 306adff` matches "test(45-02): lock in Phase 44 loop form..."
- FOUND: commit `306adff` — Task 1 commit (274 insertions, 1 file created)
- FOUND: commit `926ed43` — Task 2 commit (4 files, 100 insertions, 1 deletion from the CSS closing brace update)
- GREEN: `npm test -- --run` → 418 passed + 1 skipped / 0 failed (was 411+1 — net +7 from this plan)
- GREEN: `npx tsc --noEmit --skipLibCheck` exit 0
- GREEN: `npm run build` exit 0
- GREEN: `grep -c "rp-create-loop-btn" styles.css` returns 4 (regenerated)
- GREEN: `grep -c "Phase 45: loop quick-create button" src/styles/editor-panel.css` returns 1
- GREEN: `awk '/rp-create-snippet-btn/{snip=NR} /rp-create-loop-btn/{loop=NR} /rp-duplicate-btn/{dup=NR} END{print (snip<loop && loop<dup)?"OK":"FAIL"}' src/views/editor-panel-view.ts` prints "OK" (positional invariant)
- GREEN: landmines intact — `case 'loop': { count=1`, `case 'loop-start': count=1`, `Legacy loop node count=1`, `rp-create-snippet-btn count=1`
- GREEN: `grep -c "Phase 45" src/styles/loop-support.css` returns 0 (CSS scope discipline honoured)

---

*Phase: 45-loop-editor-form-picker-color-map*
*Completed: 2026-04-18*
