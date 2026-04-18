---
phase: 45
slug: loop-editor-form-picker-color-map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run <pattern>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~8 seconds (full suite, existing baseline) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <pattern>` (targeted file)
- **After every plan wave:** Run `npm test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite + `npm run build` must both be green
- **Max feedback latency:** ~10 seconds per targeted run

---

## Per-Task Verification Map

*Populated by planner in PLAN.md frontmatter. Rows below are anchors the planner must cover — each maps to a requirement/decision from 45-CONTEXT.md and 45-RESEARCH.md.*

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| {45-XX-01} | NodePickerModal rewrite | A | LOOP-06 | `buildNodeOptions` returns ≥4 kinds (question/text-block/snippet/loop), answer excluded, legacy loop-start excluded, id fallback for empty label | unit | `npm test -- --run node-picker-modal` | ❌ W0 | ⬜ pending |
| {45-XX-02} | NodePickerModal rewrite | A | LOOP-06 | Sort order question → loop → text-block → snippet; alphabetical within group via localeCompare | unit | `npm test -- --run node-picker-modal` | ❌ W0 | ⬜ pending |
| {45-XX-03} | NodePickerModal rewrite | A | LOOP-06 | KIND_LABELS exhaustive — `'question': 'Вопрос'`, `'text-block': 'Текст'`, `'snippet': 'Сниппет'`, `'loop': 'Цикл'` | unit | `npm test -- --run node-picker-modal` | ❌ W0 | ⬜ pending |
| {45-XX-04} | Editor-panel loop form lock-in | B | LOOP-05 | Dropdown offers option `'loop'` with label `'Loop'`; kind='loop' renders heading "Loop node" + exactly one Setting "Header text" | unit | `npm test -- --run editor-panel-loop-form` | ❌ W0 | ⬜ pending |
| {45-XX-05} | Editor-panel loop form lock-in | B | LOOP-05 | Loop form does NOT contain any Setting with text matching /iterations/i (negative regression test) | unit | `npm test -- --run editor-panel-loop-form` | ❌ W0 | ⬜ pending |
| {45-XX-06} | Editor-panel loop form lock-in | B | LOOP-05 | onChange of headerText textarea sets both `pendingEdits.radiprotocol_headerText` AND `pendingEdits.text` to the same value | unit | `npm test -- --run editor-panel-loop-form` | ❌ W0 | ⬜ pending |
| {45-XX-07} | Editor-panel loop form lock-in | B | LOOP-06 | saveNodeEdits for kind='loop' injects `color: '1'` via NODE_COLOR_MAP['loop'] lookup | unit | `npm test -- --run editor-panel-loop-form` | ❌ W0 | ⬜ pending |
| {45-XX-08} | Quick-create loop button | B | LOOP-05 | renderToolbar renders a button with class `rp-create-loop-btn` (or planner-chosen equivalent) positioned AFTER snippet button, BEFORE duplicate button | unit | `npm test -- --run editor-panel-loop-form` | ❌ W0 | ⬜ pending |
| {45-XX-09} | Quick-create loop button | B | LOOP-05 | onQuickCreate union type extended to `'question' \| 'answer' \| 'snippet' \| 'loop'`; grep succeeds | unit/grep | `npm test -- --run editor-panel-loop-form` + grep check | ❌ W0 | ⬜ pending |
| {45-XX-10} | start-from-node command wiring | C | LOOP-06 | main.ts addCommand block with id `'start-from-node'` (NO plugin prefix per NFR-06) exists; grep passes | unit/grep | `npm test -- --run runner-commands` | ❌ W0 | ⬜ pending |
| {45-XX-11} | start-from-node command wiring | C | LOOP-06 | RunnerView.openCanvas accepts optional `startNodeId`; ProtocolRunner.start accepts optional `startNodeId`; both default to graph entry when absent | unit | `npm test -- --run runner` | ❌ W0 | ⬜ pending |
| {45-XX-12} | start-from-node command wiring | C | LOOP-06 | runner-commands test verifies `buildNodeOptions` is importable AND returns a loop option for a mixed-kind graph | unit | `npm test -- --run runner-commands` | ⚠️ extend existing | ⬜ pending |
| {45-XX-13} | CSS append | D | LOOP-05 | `src/styles/editor-panel.css` tail contains a `/* Phase 45: loop quick-create button */` marker and a `.rp-create-loop-btn` rule | grep | `grep -F "Phase 45: loop" src/styles/editor-panel.css` | ❌ W0 | ⬜ pending |
| {45-XX-14} | CSS append | D | LOOP-05 | `npm run build` regenerates `styles.css` successfully; no hand-edit to `styles.css` in the commit | build | `npm run build` + `git diff --stat styles.css` check | ❌ W0 | ⬜ pending |
| {45-XX-15} | CanvasNodeFactory loop support | B | LOOP-05 | `CanvasNodeFactory.createNode(..., 'loop', ...)` injects `radiprotocol_nodeType='loop'`, `color: NODE_COLOR_MAP['loop']`, `radiprotocol_headerText: ''` | unit | `npm test -- --run canvas-node-factory` | ⚠️ may exist | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner owns the final task IDs and may merge/split rows. Each anchor must survive into at least one PLAN.md task with `<acceptance_criteria>` covering it.

---

## Wave 0 Requirements

- [ ] `src/__tests__/node-picker-modal.test.ts` — new file, stubs for LOOP-06 (kinds, sort, labels, id fallback)
- [ ] `src/__tests__/editor-panel-loop-form.test.ts` — new file, stubs for LOOP-05 (form lock-in, negative iterations test, color injection)
- [ ] `src/__tests__/runner-commands.test.ts` — extend existing RUN-10 test (D-20) with buildNodeOptions import+usage check
- [ ] Obsidian mock parity — confirm `setIcon` + `registerDomEvent` either live in `src/__mocks__/obsidian.ts` or are stubbed inline in each new test (per 45-RESEARCH.md Pitfall #6)

*Framework already installed (vitest present in `package.json` + working tests in `src/__tests__/`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-create loop button click actually creates a loop node on the active canvas, painted with `color: '1'` (Obsidian green) | LOOP-05, LOOP-06 | Requires live Obsidian instance + Canvas plugin + real filesystem — not reproducible in vitest/JSDom | 1. `npm run build` → reload plugin in Obsidian. 2. Open a canvas. 3. Open Node Editor. 4. Click «Create loop node». 5. Verify a loop-kind node appears with green color and empty headerText. |
| `start-from-node` command is visible in Ctrl+P (Command Palette), opens NodePickerModal, and starts RunnerView from the chosen node | LOOP-06 | Command palette registration + modal + runner activation only testable end-to-end in Obsidian | 1. Ctrl+P → type "Start from specific node" → select. 2. Verify picker opens with Вопрос/Цикл/Текст/Сниппет badges. 3. Pick a loop node → verify RunnerView opens and immediately shows loop picker. |
| Canvas rendering of loop node — Obsidian Canvas renderer paints `color: '1'` as green | LOOP-06 (color map) | Only Obsidian native renderer knows how to interpret the `color` property on canvas nodes | 1. After quick-create, inspect canvas — node should be visibly green (matching Phase 43 screenshots of running loop protocols). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`node-picker-modal.test.ts`, `editor-panel-loop-form.test.ts`)
- [ ] No watch-mode flags (all runs use `--run`)
- [ ] Feedback latency < 10s per targeted run
- [ ] `nyquist_compliant: true` set in frontmatter after planner confirms all task IDs above are owned by PLAN.md tasks

**Approval:** pending
