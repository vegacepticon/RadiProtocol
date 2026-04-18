---
phase: 45-loop-editor-form-picker-color-map
plan: 03
subsystem: runtime
tags: [phase-45, start-from-node, command-wiring, loop-06, runner-signature-extension]

# Dependency graph
requires:
  - phase: 45-loop-editor-form-picker-color-map
    plan: 01
    provides: NodePickerModal + buildNodeOptions 4-kind contract (question/text-block/snippet/loop)
  - phase: 43-unified-loop-graph-model-parser-validator-migration-errors
    provides: GraphValidator (MIGRATE-01 rejects legacy loop-start/loop-end canvases)
  - phase: 5-runner-initial
    provides: ProtocolRunner.start(graph) + RunnerView.openCanvas(filePath) base signatures
provides:
  - ProtocolRunner.start(graph, startNodeId?) signature extension — backward compatible
  - RunnerView.openCanvas(filePath, startNodeId?) signature extension with explicit-start branch
  - main.ts addCommand 'start-from-node' + handleStartFromNode private async method
  - runner-commands.test.ts +2 tests (buildNodeOptions loop smoke + NFR-06 grep)
  - End-to-end wiring that brings NodePickerModal from dead-code into a live Ctrl+P command
affects:
  - LOOP-06 requirement closed at command + picker wiring level
  - CONCERNS.md §"Stub command left in production" resolved (NodePickerModal now invoked by handleStartFromNode)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional signature extension at runtime layer (startNodeId?: string) preserves v1.0 contract — setState restoration still works"
    - "Explicit-start branch in RunnerView.openCanvas bypasses session-resume modal when caller supplied a startNodeId (D-14)"
    - "Validator gate inside command callback (MIGRATE-01 blocks legacy canvases before picker opens, D-CL-06)"
    - "Live-JSON read preferred over vault.read to avoid stale-disk race with CanvasLiveEditor debounce (BUG-02/03)"

key-files:
  created: []
  modified:
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
    - src/main.ts
    - src/__tests__/runner-commands.test.ts

key-decisions:
  - "startNodeId is optional at BOTH layers (ProtocolRunner.start AND RunnerView.openCanvas) — non-negotiable per Pitfall 8 (Obsidian setState calls openCanvas(path) with ONE argument on workspace restore)"
  - "Explicit-start branch placed BEFORE session-resume block so user's deliberate start point takes priority over an incomplete session"
  - "sessionService.clear called inside explicit-start branch — mirrors the normal-start fallback semantics; session-resume modal is never opened when startNodeId supplied"
  - "handleStartFromNode uses live-JSON first then vault.read fallback — consistent with RunnerView.openCanvas read pattern"
  - "English notice wording (D-CL-04) — consistent with pre-existing main.ts notices (v1.0 NFR-06-adjacent convention)"
  - "Test 3 grep comment reworded to avoid literal 'radiprotocol-start-from-node' double-match (acceptance grep must return exactly 1, not 2)"

patterns-established:
  - "Pattern: Plugin-entry command with 6-step callback — (1) active-leaf discovery, (2) live-JSON+disk read, (3) parse, (4) validate with early-return on errors, (5) options-build + empty guard, (6) view-activate + modal-open. Reusable for any future 'start-at-X' command"
  - "Pattern: Runtime signature widening with JSDoc breadcrumb referencing the exact decision ID (D-14) and phase — future maintainers can trace why the parameter is optional without archaeology"

requirements-completed: [LOOP-06]

# Metrics
duration: 4min
completed: 2026-04-18
---

# Phase 45 Plan 03: start-from-node command + startNodeId plumbing Summary

**Зарегистрирована команда `start-from-node` в Obsidian command palette; NodePickerModal подключён end-to-end к runner'у через новый `handleStartFromNode` callback в main.ts; ProtocolRunner.start и RunnerView.openCanvas расширены optional параметром `startNodeId` с полной обратной совместимостью (setState restoration preserved per Pitfall 8).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-18T08:35:31Z
- **Completed:** 2026-04-18T08:39:28Z
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- **LOOP-06 command wiring** (D-12, D-13): `main.ts` получил пятую команду `start-from-node` с bare id (NFR-06 — без `radiprotocol-` префикса). Callback открывает `NodePickerModal` над активным canvas после parse + validate, маршрутизирует user pick через `runnerView.openCanvas(canvasPath, opt.id)`.
- **Runtime signature extension** (D-14): `ProtocolRunner.start(graph, startNodeId?)` — advanceThrough использует `startNodeId ?? graph.startNodeId`. `RunnerView.openCanvas(filePath, startNodeId?)` — новая early-return ветка перед session-resume path: `sessionService.clear(filePath)` → `this.graph = graph` → `runner.start(graph, startNodeId)` → `render()` → return.
- **Backward compat жёстко соблюдён** (Pitfall 8): `setState` line 56 продолжает вызывать `this.openCanvas(path)` с ОДНИМ аргументом → `startNodeId` остаётся undefined → ветка не срабатывает → session-resume flow работает как в v1.0 для Obsidian workspace restoration.
- **Validator gate** (D-CL-06): Команда блокирует start на legacy loop-start/loop-end канвасах через `GraphValidator` (MIGRATE-01) — первая ошибка выводится в Notice, picker не открывается. Consistent UX с RunnerView основной цепочкой.
- **Live-JSON read pattern** (BUG-02/03): Callback сначала проверяет `canvasLiveEditor.getCanvasJSON(canvasPath)`, и только если null — fallback на `vault.read`. Это избегает stale-disk race с debounced `saveLive` писателем.
- **2 новых unit-теста** в `runner-commands.test.ts`: (a) LOOP-06 (D-20) — dynamic import `buildNodeOptions`, mock mixed-kind graph с loop-узлом, assert возвращённый NodeOption содержит `kind: 'loop'` с сохранённым `headerText` как label; (b) NFR-06 (Pitfall 10) — `fs.readFileSync` на `src/main.ts`, `expect(mainTs).toContain("id: 'start-from-node'")` AND `.not.toContain("id: 'radiprotocol-start-from-node'")`.
- **CLAUDE.md "Never remove existing code" соблюдён** во всех 4 файлах: нулевые удаления. Все 4 pre-existing addCommand блоки byte-identical; все 5 async методов на RadiProtocolPlugin preserved; canvas:node-menu registration, activate*, ProtocolRunner.chooseAnswer/chooseLoopBranch/stepBack/completeSnippet/enterFreeText, RunnerView session-resume modal logic (ResumeSessionModal/restoreFrom), runner-commands pre-existing 2 тесты — все нетронуты.

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Thread optional startNodeId through ProtocolRunner.start and RunnerView.openCanvas** — `59d9586` (feat)
2. **Task 2: Register start-from-node command with handleStartFromNode callback** — `db9a614` (feat)
3. **Task 3: Lock in buildNodeOptions loop smoke and NFR-06 command-id grep** — `8203867` (test)

**Plan metadata commit:** будет добавлен после SUMMARY.md + STATE.md + ROADMAP.md обновлений.

## Files Created/Modified

- **modified** `src/runner/protocol-runner.ts` — +1 signature line (`startNodeId?: string`), +1 body line (`advanceThrough(startNodeId ?? graph.startNodeId)`), +~10 JSDoc lines объясняющих D-14. Все остальные public methods (`chooseAnswer`, `enterFreeText`, `stepBack`, `completeSnippet`, `chooseLoopBranch`), private methods (`advanceThrough`, `advanceOrReturnToLoop`, `transitionToError`, etc.), reset fields, constructor, options — byte-identical.
- **modified** `src/views/runner-view.ts` — +1 signature line (`startNodeId?: string`), +9-line Phase 45 branch между `const graph = parseResult.graph;` и `// ── SESSION-02` commentом. Все остальные методы (`onOpen`, `setState`, `render`, `renderError`, `handleSelectorSelect`, session-resume path, ResumeSessionModal integration, normal-start fallback, `syncManualEdit`, vault file-change listeners) — byte-identical.
- **modified** `src/main.ts` — +2 import lines (`NodePickerModal`/`buildNodeOptions` from views + `GraphValidator` from graph), +6-line addCommand block после open-node-editor, +~75-line `handleStartFromNode` private async method перед closing `}` класса. Все 4 pre-existing addCommand блоки, canvas:node-menu registration (EDIT-05), activate*, openEditorPanelForNode, insertIntoCurrentNote, saveOutputToNote, onunload, ribbonIcon, registerView blocks — byte-identical.
- **modified** `src/__tests__/runner-commands.test.ts` — +2 tests (LOOP-06 D-20 + NFR-06 Pitfall 10) ПОСЛЕ существующих 2 тестов (`RUN-10: node-picker-modal exports NodePickerModal` + `UI-04: GraphValidator.validate()`). Imports (vitest, GraphValidator, CanvasParser, fs, path) byte-identical — новые тесты используют уже импортированные fs/path через Node CJS `__dirname`.

## Decisions Made

- **startNodeId optional at BOTH layers** — Pitfall 8 (setState Obsidian workspace restoration). Если бы параметр был обязательным, setState восстанавливал бы runner в error-state при каждом перезапуске Obsidian.
- **Explicit-start ветка ПЕРЕД session-resume блоком** — семантика: user's deliberate Ctrl+P → "Start from specific node" пик важнее stale incomplete session. Если бы ветка шла после session-check, stale сессия могла бы перехватить flow.
- **`sessionService.clear` внутри explicit-start ветки** — зеркалит normal-start fallback (runner-view.ts:150) и предотвращает «hybrid state» где runner начал с нового узла, а session файл на диске описывает старую сессию.
- **Live-JSON preferred → vault.read fallback** — BUG-02/03 mitigation pattern. Консистентно с `runner-view.ts:78-88` pattern который Phase 5 установил.
- **English notice wording** (D-CL-04) — `'Open a canvas first.'`, `'Active canvas has no file path.'`, `'Canvas file not found.'`, `'Could not read canvas file.'`, `'Canvas parse failed: ...'`, `'Canvas validation failed: ...'`, `'No startable nodes in this canvas.'` — параллельны существующим main.ts notices (`'Could not open runner view: no available leaf.'`, `'Inserted into ${file.name}.'`).
- **Test 3 comment reworded для grep-1-match compliance** — оригинальный комментарий содержал literal `radiprotocol:radiprotocol-start-from-node` в объяснении collision. Это делало `grep -c "radiprotocol-start-from-node"` возвращающим 2 (комментарий + assertion), что нарушало acceptance criterion «exactly 1 match». Заменил на "double prefix would collide" — тот же смысл, без literal.

## Deviations from Plan

**Одна pre-commit косметическая правка в Task 3 для соответствия grep-1-match acceptance criterion.**

### Minor adjustment (not a Rule-1/2/3 deviation)

**1. [Comment-only edit] Reworded commentary in runner-commands.test.ts NFR-06 test**
- **Found during:** Task 3 post-write acceptance-criteria verification
- **Issue:** Первоначальный комментарий `// Double prefix produces\n    // radiprotocol:radiprotocol-start-from-node in Ctrl+P.` содержал literal `radiprotocol-start-from-node` → `grep -c` возвращал 2 (комментарий + assertion).
- **Fix:** Переформулировал на `A double prefix would collide in the Ctrl+P command palette (see NFR-06, RESEARCH.md Pitfall 10).` — тот же смысл, без literal.
- **Files modified:** `src/__tests__/runner-commands.test.ts` (pre-commit edit, применено ДО git add)
- **Verification:** `grep -c "radiprotocol-start-from-node" src/__tests__/runner-commands.test.ts` returns 1.
- **Committed in:** `8203867` (Task 3 commit — применено до commit'а)

---

**Total deviations:** 0 functional (1 pre-commit comment reword for literal-grep compliance).
**Impact on plan:** Нулевой — план executed ровно как написан, все acceptance criteria + done-criteria + success criteria выполнены.

## Issues Encountered

- **READ-BEFORE-EDIT hook warnings** — каждый Edit на уже прочитанный файл в текущей сессии триггерил hook reminder, но edits применялись корректно (verified grep after each). Hook — false-positive в рамках текущей сессии.
- **vitest CLI filter behavior** — попытка `npm test -- --run src/__tests__/protocol-runner.test.ts` (root-level path) возвращала "No test files found". Actual path — `src/__tests__/runner/protocol-runner.test.ts` (файлы в runner/ подпапке). Fix: использовать полные пути `src/__tests__/runner/...`. Plan acceptance-criteria снятие в итоге пошло через full-suite `npm test -- --run` что автоматически собирает все файлы через `include: 'src/__tests__/**/*.test.ts'`.

## User Setup Required

None — никаких environment variables, credentials, или external services. Phase 45 — чистая in-plugin code работа.

## Next Phase Readiness

- **Phase 45 complete:** 3 of 3 plans shipped. LOOP-05 (closed in 45-02) + LOOP-06 picker side (closed in 45-01) + LOOP-06 command/runtime wiring (closed in this plan) — Phase 45 requirement set fully satisfied at code + test layers.
- **Manual UAT (из VALIDATION.md):** 3 визуальные проверки остаются для user-verification:
  1. Quick-create loop button click → loop-kind canvas node with red color (LOOP-05).
  2. Ctrl+P → "Start from specific node" command visible; picker shows все 4 kinds с русскими badges; user pick → runner starts at chosen node.
  3. Canvas rendering красным (Obsidian palette position 1) для loop-узлов.
- **Phase 46 (Free-Text-Input Removal, CLEAN-01..04):** Independent of Phase 45. Может выполняться после verifier sign-off.

## Full Suite

- After Plan 45-01: 411 passed + 1 skipped
- After Plan 45-02: 418 passed + 1 skipped (+7 lock-in loop form tests)
- **After Plan 45-03: 420 passed + 1 skipped / 0 failed** (+2 from D-20 loop smoke + NFR-06 grep)

## Backward Compatibility

- `ProtocolRunner.start(graph)` без второго аргумента — работает identical pre-Phase 45. `startNodeId` undefined → `advanceThrough(graph.startNodeId)` exactly как v1.0.
- `RunnerView.openCanvas(path)` без второго аргумента — работает identical pre-Phase 45. setState из Obsidian workspace restoration продолжает вызывать с ОДНИМ аргументом → explicit-start ветка не triggered → session-resume path runs как в v1.0.
- Все pre-existing команды (`run-protocol`, `validate-protocol`, `open-snippet-manager`, `open-node-editor`) и methods byte-identical.
- Все pre-existing runner tests (64 tests в 3 файлах), session tests, RunnerView tests — зелёные без изменений.
- `NodePickerModal` public API (constructor, getSuggestions, renderSuggestion, onChooseSuggestion, setPlaceholder) — не тронут, Plan 01's export contract сохранён.

## Self-Check: PASSED

Verification of claims in this SUMMARY:

- FOUND: commit `59d9586` — Task 1 (feat — startNodeId plumbing through runner + view signatures)
- FOUND: commit `db9a614` — Task 2 (feat — start-from-node command + handleStartFromNode method)
- FOUND: commit `8203867` — Task 3 (test — D-20 loop smoke + NFR-06 grep)
- GREEN: `npm test -- --run` → 420 passed + 1 skipped / 0 failed (baseline 418+1, net +2)
- GREEN: `npx tsc --noEmit --skipLibCheck` exit 0
- GREEN: `npm run build` exit 0
- GREEN: grep invariants — `id: 'start-from-node'`=1, `id: 'radiprotocol-start-from-node'`=0, `startNodeId` in protocol-runner.ts=6 (>=3), `startNodeId` in runner-view.ts=5 (>=3), `void this.openCanvas(path)`=1 (setState compat), `handleStartFromNode`=2, `new NodePickerModal`=1, `new GraphValidator`=1
- FOUND: `.planning/phases/45-loop-editor-form-picker-color-map/45-03-start-from-node-command-SUMMARY.md` (this file)

---

*Phase: 45-loop-editor-form-picker-color-map*
*Completed: 2026-04-18*
