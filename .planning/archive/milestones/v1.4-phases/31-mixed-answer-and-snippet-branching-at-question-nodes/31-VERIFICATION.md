---
phase: 31-mixed-answer-and-snippet-branching-at-question-nodes
verified: 2026-04-15T09:35:00Z
uat_closed: 2026-04-15
status: passed
score: 5/5 automated must-haves verified + 5/5 UAT items passed (see 31-UAT.md)
overrides_applied: 0
human_verification_resolved:
  - test: "SNIPPET-BRANCH-01 — Mixed branch list rendering"
    expected: "На question с исходящими рёбрами к answer+snippet runner показывает сначала секцию rp-answer-list с кнопками answer, затем rp-snippet-branch-list с кнопками '📁 <label>' или '📁 Snippet' fallback. Snippet-кнопки визуально отличимы (dashed border)."
    why_human: "DOM/визуальный рендер и CSS восприятие не проверяются unit-тестами; нужна реальная Obsidian-сессия"
  - test: "SNIPPET-BRANCH-02 — Snippet insertion contract + per-node separator"
    expected: "Клик по snippet-ветке открывает Phase 30 picker с корнем subfolderPath; после выбора и fill-in в textarea добавляется ТОЛЬКО отрендеренный snippet-текст, отделённый от предыдущего контента пробелом (если snippetSeparator='space') или newline (default). Текст question и snippetLabel НЕ вставляются."
    why_human: "End-to-end flow с drill-down picker, SnippetFillInModal и accumulator требует живого canvas"
  - test: "SNIPPET-BRANCH-03 — Editor form round-trip"
    expected: "В Node Editor для snippet-ноды видны поля 'Branch label' (text) и 'Separator override' (dropdown default/newline/space). Изменения сохраняются через autoSave и read-back через parser после reopen canvas показывает новые значения в runner."
    why_human: "Нет test harness для editor-panel-view; Nyquist exception задокументирован в 31-VALIDATION.md"
  - test: "SNIPPET-BRANCH-05 — Step-back from branch-entered picker"
    expected: "После клика по snippet-ветке и открытия picker, Step Back возвращает runner в branch list того же question (обе секции answers+snippets снова видны), а не к предшественнику question. Повторный клик по answer и step-back от туда работает нормально."
    why_human: "End-to-end UI flow; автоматические unit-тесты покрывают state machine (Plan 31-03 tests 3, 10), но не DOM re-render"
  - test: "Session resume bonus (D-09)"
    expected: "Reload Obsidian между кликом по snippet-ветке и step-back: после restore picker всё ещё открыт на том же snippet-узле, step-back возвращает к branch list question."
    why_human: "Требует full reload Obsidian с живыми workspace leaves"
---

# Phase 31 — Verification Report: Mixed Answer + Snippet Branching at Question Nodes

**Phase Goal (ROADMAP):** A question node can have outgoing edges to both answer nodes and snippet nodes simultaneously. The runner presents all branches side-by-side as selectable options. Picking an answer inserts the answer text; picking a snippet opens the snippet picker/fill-in modal and inserts only that snippet's rendered text with a per-node configurable separator.

**Verified:** 2026-04-15
**Status:** passed (automated layers fully verified; all 5 UAT items closed per `31-UAT.md` status=complete, 5/5 passed, 0 issues)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria + plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Question может иметь outgoing рёбра одновременно к answer и snippet узлам; validator молча разрешает это | VERIFIED | `src/graph/graph-validator.ts:66` wording reworded to `has no outgoing branches`; Plan 31-01 Task 2 adds 2 Phase 31 positive tests (snippet-only, mixed) — green |
| 2 | Runner рендерит mixed branch list (answers + snippets секциями) | VERIFIED (code) / HUMAN (visual) | `src/views/runner-view.ts:337-383` partitioned loops; DOM classes `.rp-answer-list` + `.rp-snippet-branch-list`; visual CSS в `src/styles/runner-view.css:240-259` |
| 3 | Выбор snippet-варианта открывает Phase 30 picker и вставляет только snippet-текст через per-node separator | VERIFIED (state machine) / HUMAN (end-to-end) | `chooseSnippetBranch` → `awaiting-snippet-pick` без accumulator мутации (`protocol-runner.ts:113-153`); `completeSnippet` учитывает `kind === 'snippet'` через `resolveSeparator` (`protocol-runner.ts:261-264, 521`); 10 runner тестов зелёных |
| 4 | SnippetNode поддерживает snippetLabel и radiprotocol_snippetSeparator с round-trip через parser/editor | VERIFIED (parser) / HUMAN (editor form) | `graph-model.ts:71,73`; `canvas-parser.ts:263-275` с normalisation; 7 parser тестов зелёных; editor form wired в `editor-panel-view.ts:616-640` (Nyquist exception) |
| 5 | Step-back из branch-entered picker возвращает к branch list, не к предшественнику question | VERIFIED (state machine) / HUMAN (UI) | `UndoEntry.returnToBranchList` (`runner-state.ts:106`); `chooseSnippetBranch` пушит с флагом до мутации (`protocol-runner.ts:141-147`); `stepBack` early branch (`protocol-runner.ts:199-214`); session round-trip в `getSerializableState`/`restoreFrom` (`protocol-runner.ts:429-499`); Plan 31-03 tests 3, 10 + session D-09 tests — все зелёные |

**Score:** 5/5 observable truths verified at the state-machine / parser / DOM-structure level. All 5 require human UAT to confirm end-to-end UX behaviour (as designed: Plan 31-04 is `autonomous: false`).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/graph/graph-model.ts` | SnippetNode with optional snippetLabel + radiprotocol_snippetSeparator | VERIFIED | Lines 71, 73 — both optional fields present |
| `src/graph/canvas-parser.ts` | Parse both fields with empty→undefined / strict enum normalisation | VERIFIED | Lines 263-275 — `rawLabel`, `rawSep`, correct narrowing |
| `src/graph/graph-validator.ts` | Branch-agnostic dead-end wording | VERIFIED | Line 66: `has no outgoing branches` — old `has no answers` removed |
| `src/views/editor-panel-view.ts` | Branch label text + Separator override dropdown in snippet form | VERIFIED | Lines 616-640 — both Setting controls wired to pendingEdits + scheduleAutoSave |
| `src/runner/runner-state.ts` | UndoEntry.returnToBranchList optional flag | VERIFIED | Line 106 |
| `src/runner/protocol-runner.ts` | chooseSnippetBranch, stepBack branch, resolveSeparator overload, completeSnippet hook, serialization round-trip | VERIFIED | 113-153 (new method), 199-214 (stepBack early branch), 261-264 (completeSnippet hook), 521 (resolveSeparator snippet branch), 429, 450, 486, 499 (serialization) |
| `src/views/runner-view.ts` | Partitioned question rendering + chooseSnippetBranch click handler | VERIFIED | Lines 337-383 — two-section partition, emoji label, fallback, click → runner.chooseSnippetBranch |
| `src/styles/runner-view.css` | Phase 31 append-only CSS block | VERIFIED | Lines 240-259 — `/* Phase 31: ... */` marker + `.rp-snippet-branch-list` + `.rp-snippet-branch-btn` with dashed border |

All artifacts: exist (L1) + substantive (L2) + imported/used (L3) + data-flowing (L4, state round-trips confirmed via session tests).

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `runner-view.ts` snippet button click | `ProtocolRunner.chooseSnippetBranch` | `registerDomEvent` → runner method call | WIRED | Line 377 — direct method invocation after `syncManualEdit`, before `autoSaveSession` + `renderAsync` |
| `chooseSnippetBranch` | `undoStack.push({returnToBranchList: true})` | before mutation | WIRED | Lines 141-147, pushed BEFORE `currentNodeId`/`runnerStatus` mutation on 150-152 |
| `stepBack` | `entry.returnToBranchList` early branch | if-guard | WIRED | Line 203 — early return restores question + clears snippet state |
| `completeSnippet` | `resolveSeparator(snippetNode)` for `kind==='snippet'` | expanded type union + condition | WIRED | Line 261 condition + line 521 resolveSeparator snippet branch with `radiprotocol_snippetSeparator` fallback |
| `getSerializableState`/`restoreFrom` | `returnToBranchList` round-trip | object spread in undoStack.map | WIRED | Lines 429 + 450 (serialize), 486 + 499 (restore) |
| `canvas-parser` case 'snippet' | `SnippetNode.snippetLabel` / `radiprotocol_snippetSeparator` | object literal append | WIRED | Lines 263-275 |
| `editor-panel-view` case 'snippet' | `pendingEdits['radiprotocol_snippetLabel'/'radiprotocol_snippetSeparator']` | Setting onChange → scheduleAutoSave | WIRED | Lines 616-640 |

### Cross-plan integration (runner-view → ProtocolRunner → undo/restore)

Verified end-to-end connection:
1. **runner-view.ts:377** вызывает `this.runner.chooseSnippetBranch(snippetNode.id)`
2. **protocol-runner.ts:113-153** валидирует → пушит UndoEntry с `returnToBranchList: true` → переводит state в `awaiting-snippet-pick` at the snippet node
3. **protocol-runner.ts:199-214** `stepBack` видит флаг → восстанавливает question + очищает snippetId/snippetNodeId → state = `at-node` (branch list re-renders)
4. **protocol-runner.ts:429-499** serialization round-trips `returnToBranchList` через JSON, обеспечивая session resume semantic (Plan 31-03 session tests 1-3 зелёные)

Интеграция замкнута и wired без discontinuities. Data-flow verified: `snippetNode.snippetLabel` читается в runner-view `368-370`, происходит из `canvas-parser.ts:273-275`, живёт на `SnippetNode` из `graph-model.ts:71`.

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| runner-view.ts branch list | `snippetNeighbors` | `this.graph.adjacency.get(state.currentNodeId)` → filter by `kind === 'snippet'` | Yes — from parsed canvas graph | FLOWING |
| runner-view.ts button label | `snippetNode.snippetLabel` | `canvas-parser.ts` → `graph-model.SnippetNode` | Yes — round-trip through parser tested | FLOWING |
| completeSnippet separator | `snippetNode.radiprotocol_snippetSeparator` | same parser path | Yes — resolveSeparator unit-tested (Plan 31-03 test 7 "space", test 8 "default") | FLOWING |
| stepBack restore | `entry.returnToBranchList` | undoStack push in chooseSnippetBranch | Yes — session round-trip unit-tested (Plan 31-03 session tests 1-3) | FLOWING |

---

### Requirements Coverage

Note: `.planning/REQUIREMENTS.md` still lists Phase 31 under `Requirements: TBD` in ROADMAP — no formal `SNIPPET-BRANCH-0X` entries exist in REQUIREMENTS.md. Plans reference these IDs against the 5 numbered ROADMAP success criteria. This is a documentation gap but does not block phase verification — the contract is ROADMAP.md.

| SC # | ROADMAP Success Criterion | Status | Evidence |
|------|---------------------------|--------|----------|
| SC-1 | Question with edges to both answers and snippet nodes shows both as selectable options | VERIFIED (code) / HUMAN (visual) | `runner-view.ts:337-383` partitioned render; 2 sections only rendered when non-empty |
| SC-2 | Selecting snippet variant opens standard Phase 30 picker and inserts only rendered snippet text | VERIFIED (state) / HUMAN (e2e) | `chooseSnippetBranch` → `awaiting-snippet-pick` (no accumulator mutation); `completeSnippet` appends only `renderedText` via Phase 30 picker flow |
| SC-3 | Snippet nodes have configurable label and per-node separator editable in Node Editor | VERIFIED (parser+wiring) / HUMAN (form UX) | Fields in `graph-model.ts:71,73`; parser `canvas-parser.ts:263-275`; editor form `editor-panel-view.ts:616-640` |
| SC-4 | graph-validator allows mixed and snippet-only question branches without warnings | VERIFIED | `graph-validator.ts:66` reworded; 2 Phase 31 positive tests green |
| SC-5 | Step-back from open snippet picker (entered via branch choice) returns to branch list | VERIFIED (state) / HUMAN (UI) | `UndoEntry.returnToBranchList` + `stepBack` early branch; Plan 31-03 tests 3, 10 + session D-09 tests |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict build | `npm run build` | Clean (tsc -noEmit + esbuild production) | PASS |
| Full test suite | `npm test -- --run` | 217 passed / 3 failed | PASS (see baseline note) |
| Phase 31 parser tests | `grep -c "Phase 31" src/__tests__/canvas-parser.test.ts` | ≥1 describe present | PASS |
| Phase 31 validator tests | `grep "Phase 31" src/__tests__/graph-validator.test.ts` | present | PASS |
| Phase 31 runner tests | `grep "Phase 31" src/__tests__/runner/protocol-runner.test.ts` | 10 tests in describe | PASS |
| Session D-09 round-trip tests | `grep "Phase 31" src/__tests__/runner/protocol-runner-session.test.ts` | 3 tests in describe | PASS |

**Test baseline:** 217 passing / 3 failing. All 3 failures are in `src/__tests__/runner-extensions.test.ts`:
- `RUN-11 / D-04: setAccumulatedText method (RED until Plan 02)`
- `D-05: setAccumulatedText clears the undo stack (RED until Plan 02)`
- `D-07: start() accepts optional startNodeId parameter (RED until Plan 02)`

These are **pre-existing** baseline RED tests from prior phases (documented as "RED until Plan 02" in their own test descriptions). They are NOT regressions from Phase 31 — Plan 31-03 SUMMARY explicitly records the delta `204/3 → 217/3` (**+13 new passing, 0 new failing**). Out of scope for Phase 31.

---

### Anti-Patterns Scan

No stubs, no TODO/FIXME/PLACEHOLDER introduced by Phase 31 commits in the modified code paths. Append-only discipline from CLAUDE.md respected across all 4 commits (verified from commit diffs in git log — all edits are strictly additive within the targeted case blocks / method bodies).

---

### Workspace Hygiene

Phase 31 commits (`02a2262`, `7754719`, `4d55b0d`, `f9b171e`) touch ONLY:
- `src/graph/graph-model.ts`, `src/graph/canvas-parser.ts`, `src/graph/graph-validator.ts`
- `src/views/editor-panel-view.ts`, `src/views/runner-view.ts`
- `src/runner/runner-state.ts`, `src/runner/protocol-runner.ts`
- `src/styles/runner-view.css` (+ regenerated `styles.css`)
- `src/__tests__/canvas-parser.test.ts`, `src/__tests__/graph-validator.test.ts`
- `src/__tests__/runner/protocol-runner.test.ts`, `src/__tests__/runner/protocol-runner-session.test.ts`
- `.planning/phases/31-mixed-answer-and-snippet-branching-at-question-nodes/31-0{1..4}-SUMMARY.md`

**Unrelated working-tree changes** (`.planning/config.json` modification and `.planning/phases/01..29/*` deletions) are **NOT part of Phase 31 commits** — они висят в working tree отдельно и не связаны с этой фазой. Phase 31 workspace hygiene: clean.

---

## Human Verification Required

Plan 31-04 is `autonomous: false` by design — UI rendering and end-to-end flows require manual UAT in live Obsidian. The following checklist reproduces Task 2 of Plan 31-04:

### Test Canvas Setup
- `start` → `question` "Тип исследования"
- `question` → `answer` "КТ" → `text-block` "КТ протокол"
- `question` → `answer` "МРТ" → `text-block` "МРТ протокол"
- `question` → `snippet` S1 (`subfolderPath='CT'`, `snippetLabel='CT templates'`, `snippetSeparator='space'`)
- `question` → `snippet` S2 (`subfolderPath='MRI'`, `snippetLabel` empty, `snippetSeparator` unset)
- `S1` → `end`, `S2` → `end`
- Поместить 1-2 файла в `.radiprotocol/snippets/CT/` и `.radiprotocol/snippets/MRI/`, хотя бы один с `{{placeholder}}`

### UAT Checklist

1. **SNIPPET-BRANCH-01 (mixed branch list):** Open Protocol Runner → запустить canvas. На вопросе должны появиться кнопки "КТ", "МРТ" (answer section), затем отдельная секция с "📁 CT templates" и "📁 Snippet" (S2 fallback). Snippet-кнопки — dashed border.

2. **SNIPPET-BRANCH-02 (snippet insertion contract + per-node separator):** Нажать "📁 CT templates" → должен открыться Phase 30 drill-down picker с корнем `.radiprotocol/snippets/CT/`. Выбрать snippet с placeholder'ами → модалка → fill → submit. В textarea должен добавиться **только** отрендеренный snippet-текст, отделённый от предыдущего контента **пробелом** (не newline — это подтверждает per-node `snippetSeparator='space'` override из D-04).

3. **SNIPPET-BRANCH-03 (editor form round-trip):** Закрыть runner → открыть S1 в Node Editor → убедиться что "Branch label" = "CT templates", "Separator override" = "Space". Открыть S2 → "Branch label" пусто, "Separator override" = "use global default". Изменить S2 label на "MRI templates" → save → reopen canvas → runner на том же question должен показать "📁 MRI templates".

4. **SNIPPET-BRANCH-04 (validator silent acceptance):** Удалить answer edges из question (оставить только 2 snippet edges) → запустить canvas → validator не должен выдать Notice warning. Также mixed (answers+snippets) не должен давать warning.

5. **SNIPPET-BRANCH-05 (step-back from branch-entered picker):** Запустить mixed canvas → нажать "📁 CT templates" → picker открылся → нажать Step Back. Runner должен вернуться **на тот же question с обеими секциями**. Затем нажать "КТ" → продолжить → Step Back → нормальный откат к question.

6. **Session resume bonus (D-09):** Между шагом 5 "click 📁 CT templates" и "click Step Back" сделать reload Obsidian. После restore runner должен по-прежнему показывать picker S1, и Step Back от туда всё равно должен вернуть к branch list.

---

## Phase Verdict

**PASS** — automated + manual UAT both closed (see `31-UAT.md`, commit `d6c6280`)

Все автоматически проверяемые слои Phase 31 верифицированы:
- 5/5 observable truths подтверждены на уровне code/tests
- 8/8 артефактов exist + substantive + wired + data-flowing
- 7/7 key links подключены end-to-end
- 5/5 ROADMAP success criteria имеют реализационный backing
- Test delta: +13 new passing, 0 new regressions (217/3 total, 3 failing are pre-existing baseline unrelated to Phase 31)
- Workspace hygiene: clean для Phase 31 commits; unrelated working-tree noise не относится к фазе
- Shared-file append-only discipline (CLAUDE.md) соблюдён во всех 4 commits

**Остаётся:** 5 manual UAT items (5 SNIPPET-BRANCH-0X + session resume bonus) — это ожидаемо, Plan 31-04 изначально помечен `autonomous: false`. Фаза готова к UAT пользователем.

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
