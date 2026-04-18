---
phase: 45-loop-editor-form-picker-color-map
verified: 2026-04-18T08:49:57Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Quick-create loop button creates a red loop node on the canvas"
    expected: "После npm run build и перезагрузки плагина: открыть canvas, Node Editor справа, кликнуть «Create loop node» (4-я кнопка, иконка repeat). На canvas появляется loop-узел цвета RED (Obsidian palette position 1). Node Editor показывает заголовок 'Loop node' + textarea 'Header text' + БЕЗ контрола iterations."
    why_human: "Требуется живая Obsidian instance + Canvas plugin + реальная файловая система — невоспроизводимо в vitest/JSDom. Визуальная проверка цвета и отсутствия iterations-контрола."
  - test: "Start-from-node command visible in Ctrl+P and opens NodePickerModal over active canvas"
    expected: "Ctrl+P → набрать «Start from specific node» → команда видна → выбрать. Над активным canvas открывается SuggestModal со списком узлов, в котором loop отображается как first-class kind с русским badge «Цикл» (наряду с Вопрос/Текст/Сниппет). Порядок kind-групп: question → loop → text-block → snippet. Выбор loop-опции → RunnerView открывается и встаёт на loop picker (RUN-01 render из Phase 44)."
    why_human: "Регистрация команды в Obsidian command palette + открытие модали + activation runner — только end-to-end в живом Obsidian. UI rendering русских badge'ей и порядок групп требуют визуальной верификации."
  - test: "Start-from-node blocks on legacy loop-start/loop-end canvases via MIGRATE-01"
    expected: "Открыть canvas содержащий legacy loop-start / loop-end узлы → Ctrl+P → «Start from specific node» → появляется Notice с текстом MIGRATE-01 (plain-language rebuild instruction); picker НЕ открывается."
    why_human: "Обсидиан Notice API + end-to-end валидатор-путь требует живого окружения."
  - test: "Start-from-node command does NOT conflict with ResumeSessionModal (WR-01 from REVIEW)"
    expected: "Запустить protocol из canvas A, прервать сессию на середине (создастся session-файл), закрыть RunnerView. Открыть тот же canvas A → Ctrl+P → «Start from specific node» → НЕ должна появиться ResumeSessionModal поверх / под NodePickerModal. Выбранный user-ом узел становится стартовым без resume-диалога."
    why_human: "REVIEW.md WR-01 flagged race condition: activateRunnerView() fires `void view.openCanvas(filePath)` (без startNodeId) перед picker callback, что может открыть ResumeSessionModal одновременно с NodePickerModal. Требуется реальный session-файл + live modal stacking для воспроизведения."
---

# Phase 45: Loop Editor Form, Picker & Color Map — Verification Report

**Phase Goal:** Authors can create and edit unified `loop` nodes with the Node Editor and the Start-From-Node picker, and those nodes are coloured consistently on the canvas.

**Verified:** 2026-04-18T08:49:57Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting a `loop` node in Node Editor shows a form with editable `headerText`; no `maxIterations` control (LOOP-05) | VERIFIED | `editor-panel-view.ts:568-586` contains `case 'loop':` with `setName('Loop node')` + `setName('Header text')` + textarea binding to `radiprotocol_headerText`. `grep "maxIterations" editor-panel-view.ts` returns 0 matches. Dropdown at line 345 includes `.addOption('loop', 'Loop')`. Lock-in tests pass in `editor-panel-loop-form.test.ts` (5 form-lock tests + negative `/iterations/i` regression guard). |
| 2 | Saving Node Editor form writes updated `headerText` back to canvas JSON and colours node with loop-kind colour from NODE_COLOR_MAP (LOOP-06) | VERIFIED | `editor-panel-view.ts:170-182` (`saveNodeEdits` pipeline) reads `NODE_COLOR_MAP[editedType]` and sets `enrichedEdits['color']` before `canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits)`. `node-color-map.ts:21` defines `'loop': '1'`. Test 5 in `editor-panel-loop-form.test.ts` asserts `saveLiveSpy` receives `color: '1'` when `radiprotocol_nodeType='loop'`. onChange callback (lines 579-583) writes to both `radiprotocol_headerText` AND `text` keys. |
| 3 | `NodePickerModal` lists `loop` as first-class kind alongside question, answer, snippet, text-block (LOOP-06) | VERIFIED | `node-picker-modal.ts:9` declares 4-kind union including `'loop'`. `KIND_LABELS` (line 17) exhaustively maps `'loop': 'Цикл'`. `buildNodeOptions` (lines 46-78) produces loop options from LoopNode entries. 9 unit tests in `node-picker-modal.test.ts` + LOOP-06 D-20 test in `runner-commands.test.ts` confirm behaviour. **Note:** `answer` is deliberately excluded from picker (D-06 conscious deviation from ROADMAP SC #3 wording) — see Gap Note below. |

**Score:** 3/3 truths verified

### Gap Note — D-06 Answer Exclusion

ROADMAP SC #3 literally says "alongside question, answer, snippet, and text-block" — but `buildNodeOptions` excludes `answer`-kind nodes by design (D-06 in `45-CONTEXT.md`). The deviation was **explicitly planned** and documented in three places:
- `node-picker-modal.ts:37` JSDoc — "answer (renders as button under question, not a self-starting point)"
- Plan 45-01 frontmatter — `"buildNodeOptions excludes answer, start, free-text-input, loop-start, loop-end (D-06 осознанное отклонение от ROADMAP SC #3)"`
- Test 2 in `node-picker-modal.test.ts` — "excludes answer, start, free-text-input, loop-start, loop-end (D-06 conscious deviation from ROADMAP SC #3)"

This is a conscious scope decision made during planning — `answer` nodes are dependent children of `question` nodes and cannot serve as valid start points. The verifier accepts this as the intended interpretation of SC #3 based on the domain-correct behaviour (starting on an `answer` alone has no semantic meaning). **The SC is considered VERIFIED** because the picker does list `loop` as a first-class kind alongside the other startable kinds (question, text-block, snippet) — the intent of the SC (loop is not a second-class citizen) is fulfilled.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/views/node-picker-modal.ts` | 4-kind NodeOption union, KIND_LABELS map, buildNodeOptions 4-branch | VERIFIED | File exists (116 lines). Union on line 9. `KIND_LABELS` exported (line 17). `KIND_ORDER` (line 29). 4 branches in buildNodeOptions (lines 50-65). `renderSuggestion` uses `KIND_LABELS[option.kind]` (line 109). |
| `src/__tests__/node-picker-modal.test.ts` | Unit tests for D-06..D-10 | VERIFIED | File exists (170 lines). 9 tests across 2 describe blocks. All passing. |
| `src/views/editor-panel-view.ts` | case 'loop' form + loop quick-create button + 4-kind onQuickCreate union | VERIFIED | Case 'loop' at lines 568-586. `rp-create-loop-btn` block at lines 876-883 (position between snippet btn at 867 and duplicate btn at 885). `onQuickCreate` signature at line 745 widened to 4 kinds. |
| `src/styles/editor-panel.css` | Phase 45 marker + .rp-create-loop-btn rules | VERIFIED | `/* Phase 45: loop quick-create button */` at line 170. `.rp-create-loop-btn` selectors at lines 171, 186, 190, 194 (base + :hover + :active + :disabled = 4 occurrences). |
| `styles.css` (generated) | Regenerated via npm run build | VERIFIED | 4 occurrences of `rp-create-loop-btn` in root `styles.css` — confirmed regeneration. |
| `src/__tests__/editor-panel-loop-form.test.ts` | 7 lock-in tests | VERIFIED | File exists (~10.8KB). 7 tests pass. |
| `src/runner/protocol-runner.ts` | start(graph, startNodeId?) signature | VERIFIED | Signature at line 61: `start(graph: ProtocolGraph, startNodeId?: string): void`. Body uses `this.advanceThrough(startNodeId ?? graph.startNodeId)` at line 72. JSDoc on lines 50-60 documents D-14. |
| `src/views/runner-view.ts` | openCanvas(filePath, startNodeId?) + explicit-start branch | VERIFIED | Signature at line 61. Early-return branch at lines 104-114 (clear session → set graph → runner.start(graph, startNodeId) → render → return) placed BEFORE session-resume block. setState at line 56 still calls `openCanvas(path)` with ONE arg (backward compat). |
| `src/main.ts` | addCommand('start-from-node') + handleStartFromNode | VERIFIED | Imports at lines 14-16. addCommand block at lines 86-91 (id='start-from-node', no plugin prefix). `handleStartFromNode` private async method at lines 302-370 (6-step flow: active-leaf → live-JSON read → parse → validate → buildNodeOptions → activateRunnerView + NodePickerModal). |
| `src/__tests__/runner-commands.test.ts` | +2 tests (LOOP-06 D-20 + NFR-06) | VERIFIED | File has 4 tests (2 existing + 2 new). All passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/views/node-picker-modal.ts` | `src/graph/graph-model.ts` | type imports | WIRED | Line 4: `import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, LoopNode } from '../graph/graph-model'` — all 4 kinds imported. |
| `src/views/editor-panel-view.ts` | `src/canvas/canvas-node-factory.ts` | onQuickCreate → createNode(canvasPath, 'loop', anchorId) | WIRED | Line 766-770: `this.plugin.canvasNodeFactory.createNode(canvasPath, kind, this.currentNodeId ?? undefined)`. Factory zero-delta per D-CL-03. |
| `src/views/editor-panel-view.ts` | `src/canvas/node-color-map.ts` | saveNodeEdits reads NODE_COLOR_MAP[editedType] | WIRED | Line 5 imports `NODE_COLOR_MAP`. Lines 178, 234 lookup and inject color. `NODE_COLOR_MAP['loop']='1'` confirmed (node-color-map.ts:21). |
| `src/main.ts` | `src/views/node-picker-modal.ts` | import NodePickerModal + buildNodeOptions | WIRED | Line 15: `import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal'`. Used at lines 354 + 367. |
| `src/main.ts` | `src/graph/graph-validator.ts` | new GraphValidator().validate(graph) | WIRED | Line 16 import. Lines 345-346: `const validator = new GraphValidator(); const errors = validator.validate(parseResult.graph)`. |
| `src/main.ts` | `src/views/runner-view.ts` | NodePickerModal callback → runnerView.openCanvas(canvasPath, opt.id) | WIRED | Lines 367-369: `new NodePickerModal(this.app, options, (opt) => { void runnerView.openCanvas(canvasPath, opt.id); }).open()`. |
| `src/views/runner-view.ts` | `src/runner/protocol-runner.ts` | runner.start(graph, startNodeId) in explicit-start branch | WIRED | Line 111: `this.runner.start(graph, startNodeId)` (new branch). Line 164: `this.runner.start(graph)` (normal-start fallback, preserved). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `NodePickerModal` suggestions | `this.options` | Passed from `main.ts handleStartFromNode` → `buildNodeOptions(parseResult.graph)` which iterates over `graph.nodes` Map produced by real `CanvasParser.parse()` on canvas content from `canvasLiveEditor.getCanvasJSON()` or `vault.read()` | YES | FLOWING |
| Loop form header-text textarea | `nodeRecord['radiprotocol_headerText']` / `nodeRecord['text']` | Passed into `renderForm(nodeRecord, 'loop')` from `renderNodeForm` which reads canvas JSON via `vault.read()` / live canvas `getData()` | YES | FLOWING |
| Color injection into saveLive | `enrichedEdits['color']` | Computed from `NODE_COLOR_MAP[editedType]` where editedType comes from actual edits Map; NODE_COLOR_MAP is a static Record (real data). Integration test asserts `color='1'` reaches `saveLiveSpy`. | YES | FLOWING |
| RunnerView graph | `this.graph` | `parseResult.graph` from real CanvasParser on real canvas content | YES | FLOWING |
| ProtocolRunner start node | `advanceThrough(startNodeId ?? graph.startNodeId)` | Either explicit startNodeId from NodePickerModal callback (`opt.id`) or `graph.startNodeId` from parsed canvas | YES | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit --skipLibCheck` | exit 0 | PASS |
| All Phase 45 unit tests pass | `npm test -- --run src/__tests__/node-picker-modal.test.ts src/__tests__/editor-panel-loop-form.test.ts src/__tests__/runner-commands.test.ts` | 3 files / 20 tests / 0 failed | PASS |
| Full test suite passes | `npm test -- --run` | 31 files / 420 passed + 1 skipped / 0 failed | PASS |
| Command id has no plugin prefix | `grep -c "id: 'start-from-node'" src/main.ts` / `grep -c "id: 'radiprotocol-start-from-node'" src/main.ts` | 1 / 0 | PASS |
| Backward compat: setState calls openCanvas with ONE arg | `grep -c "void this.openCanvas(path)" src/views/runner-view.ts` | 1 | PASS |
| Normal-start fallback preserved | `grep -c "this.runner.start(graph);" src/views/runner-view.ts` | 1 | PASS |
| handleStartFromNode callback wiring | `grep -c "handleStartFromNode" src/main.ts` | 2 (callback + def) | PASS |
| Phase 44 UAT-fix loop form preserved | `grep -c "case 'loop': {" src/views/editor-panel-view.ts` | 1 | PASS |
| Legacy loop-start/loop-end stub preserved | `grep -c "Legacy loop node" src/views/editor-panel-view.ts` | 1 | PASS |
| CSS scope discipline (Phase 45 only in editor-panel.css) | `grep -c "Phase 45" src/styles/loop-support.css` | 0 | PASS |
| Generated styles.css contains new rule | `grep -c "rp-create-loop-btn" styles.css` | 4 | PASS |
| No maxIterations in editor-panel form | `grep -c "maxIterations" src/views/editor-panel-view.ts` | 0 | PASS |
| Position invariant (loop btn between snippet & duplicate) | `awk '...snip<loop && loop<dup...' src/views/editor-panel-view.ts` | snip=867, loop=877, dup=885 → OK | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOOP-05 | 45-02 | Node Editor form for loop node lets author edit headerText and removes any maxIterations control | SATISFIED | `case 'loop'` form present (editor-panel-view.ts:568-586). `grep maxIterations` returns 0. Lock-in tests in `editor-panel-loop-form.test.ts` include negative `/iterations/i` regression guard (Test 3). |
| LOOP-06 | 45-01, 45-02, 45-03 | Node color map and NodePickerModal list loop as a first-class node kind | SATISFIED | NODE_COLOR_MAP['loop']='1' (node-color-map.ts:21). NodePickerModal 4-kind union with `loop` (node-picker-modal.ts:9). Command wiring via `start-from-node` (main.ts:86-91). Color integration tested (`editor-panel-loop-form.test.ts` Test 5). D-20 buildNodeOptions loop smoke test green. |

**No ORPHANED requirements.** REQUIREMENTS.md traceability table maps Phase 45 only to LOOP-05 and LOOP-06; both are covered by the 3 plans' `requirements:` frontmatter fields (Plan 01: [LOOP-06], Plan 02: [LOOP-05, LOOP-06], Plan 03: [LOOP-06]).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/views/node-picker-modal.ts` | 61 | Dead final fallback operand: `s.subfolderPath \|\| '(корень snippets)' \|\| id` — third operand unreachable because middle operand is a non-empty string literal | Info (IN-01 from REVIEW) | Harmless but confusing to readers. JSDoc acknowledges "defense-in-depth". No impact on goal. |
| `src/views/node-picker-modal.ts` | 55 | `preview = tb.content.slice(0, 60)` truncates without ellipsis indicator | Info (IN-02 from REVIEW) | Minor UX: long text-block previews look identical to short ones when cut at char 60. No impact on SC #3 (loop is listed first-class). |
| `src/views/node-picker-modal.ts` | 70-75 | Sort comparator uses `KIND_ORDER.indexOf(a.kind)` — returns -1 for unknown kinds, silently clustering them ahead of known kinds without TypeScript safeguard | Warning (WR-02 from REVIEW) | Unreachable today (exhaustive union matches KIND_ORDER). Future-phase foot-gun: adding a 5th kind without updating KIND_ORDER produces silent sort regression. Not blocking goal. |
| `src/main.ts` | 361-369 | `handleStartFromNode` calls `activateRunnerView()` which fires `void view.openCanvas(filePath)` (WITHOUT startNodeId) at main.ts:239 BEFORE NodePickerModal opens | Warning (WR-01 from REVIEW) | Race condition: if session file exists, `ResumeSessionModal` can open simultaneously with `NodePickerModal`, defeating the documented "bypasses session resume" contract of `openCanvas(filePath, startNodeId?)`. Requires human UAT to confirm severity in live Obsidian. **Routed to human verification test #4.** |

### Human Verification Required

See frontmatter `human_verification:` for 4 items requiring live-Obsidian testing:

1. **Quick-create loop button creates a red loop node** — visual canvas color + form content verification (LOOP-05, LOOP-06).
2. **Start-from-node command visible in Ctrl+P** — command palette registration + Russian badges in picker + runner activation (LOOP-06, SC #3).
3. **Start-from-node blocks legacy canvases via MIGRATE-01** — validator-gate + Notice rendering (D-CL-06).
4. **WR-01 race condition** — ResumeSessionModal vs NodePickerModal concurrent display when session file exists (flagged by REVIEW.md).

### Gaps Summary

**No blocking gaps.** All three ROADMAP Success Criteria verified via code inspection, type-check, unit tests, and integration tests. 420/421 tests pass; 1 skipped (pre-existing, unrelated to Phase 45).

The REVIEW.md identified 2 warnings and 3 info items. None block goal achievement at the code-layer; WR-01 (race with ResumeSessionModal) is the only item that could affect real-world UX and is routed to human verification test #4 for confirmation.

The D-06 exclusion of `answer` from the picker is a conscious, documented deviation from the literal wording of ROADMAP SC #3, accepted as the correct domain-level interpretation (answer nodes are dependents of questions, not valid start points).

---

_Verified: 2026-04-18T08:49:57Z_
_Verifier: Claude (gsd-verifier)_
