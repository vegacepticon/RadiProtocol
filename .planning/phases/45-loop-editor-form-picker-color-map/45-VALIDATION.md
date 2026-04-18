---
phase: 45
slug: loop-editor-form-picker-color-map
status: plans-written
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-18
updated: 2026-04-18
plans:
  - 45-01-node-picker-modal-rewrite
  - 45-02-editor-panel-loop-button-and-lockin
  - 45-03-start-from-node-command
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
| **Estimated runtime** | ~8 seconds (full suite, existing baseline 402 passed + 1 skipped) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <pattern>` (targeted file)
- **After every plan wave:** Run `npm test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite + `npm run build` must both be green
- **Max feedback latency:** ~10 seconds per targeted run

---

## Planner decisions baked into plans

- **CanvasNodeFactory — zero-delta confirmed** (D-CL-03 + RESEARCH.md §2.3): factory already kind-agnostic, NO code changes needed. Phase 45 does not modify `src/canvas/canvas-node-factory.ts`. Coverage happens transparently: `onQuickCreate('loop')` → `canvasNodeFactory.createNode(path, 'loop', anchorId)` → existing body applies `NODE_COLOR_MAP['loop']='1'` via the Phase 28 pipeline. The dedicated {45-VM-15} row below is therefore a **zero-delta verification** (grep assertion) rather than a code task.
- **CSS merged into Plan 02** (not a separate Plan D): loop quick-create button and its CSS rule belong to the same feature seam — splitting them would force Plan D to depend on Plan 02's class-name choice without any parallelism gain. Plan 02 owns both the TS button and the CSS append + `npm run build` regen step.
- **Result:** 3 plans (not 4). 2 waves. 7 tasks total. Every LOOP-05 and LOOP-06 anchor in the matrix below maps to a concrete PLAN.md task ID.

---

## Per-Task Verification Map

| VM ID | Plan (file) | Plan Task | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------|-------------|-----------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 45-VM-01 | 45-01 (node-picker-modal-rewrite) | T1 | 1 | LOOP-06 | `buildNodeOptions` returns ≥4 kinds (question/text-block/snippet/loop), answer/start/free-text-input/loop-start/loop-end excluded, id fallback for empty label (D-06 + D-07) | unit | `npm test -- --run src/__tests__/node-picker-modal.test.ts` | ❌ Wave 0 (new file via T2) | ⬜ pending |
| 45-VM-02 | 45-01 (node-picker-modal-rewrite) | T1 | 1 | LOOP-06 | Sort order `question → loop → text-block → snippet` (KIND_ORDER); alphabetical within group via `toLowerCase().localeCompare` (D-08) | unit | `npm test -- --run src/__tests__/node-picker-modal.test.ts` | ❌ Wave 0 (via T2) | ⬜ pending |
| 45-VM-03 | 45-01 (node-picker-modal-rewrite) | T1 | 1 | LOOP-06 | `KIND_LABELS` exhaustive — `'question': 'Вопрос'`, `'text-block': 'Текст'`, `'snippet': 'Сниппет'`, `'loop': 'Цикл'` (D-10). `renderSuggestion` uses `KIND_LABELS[option.kind]` | unit + grep | `npm test -- --run src/__tests__/node-picker-modal.test.ts` + `grep "KIND_LABELS\[option.kind\]" src/views/node-picker-modal.ts` | ❌ Wave 0 (via T2) | ⬜ pending |
| 45-VM-04 | 45-02 (editor-panel-loop-button-and-lockin) | T1 | 1 | LOOP-05 | Dropdown offers option `'loop'` with label `'Loop'`; `kind='loop'` renders heading "Loop node" + exactly one Setting "Header text" (D-01, D-02) | unit | `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts` | ❌ Wave 0 (new file via 45-02 T1) | ⬜ pending |
| 45-VM-05 | 45-02 (editor-panel-loop-button-and-lockin) | T1 | 1 | LOOP-05 | Loop form does NOT contain any Setting with text matching `/iterations/i` — negative regression guard for Phase 44 RUN-07 excision (D-02) | unit | `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts -t iterations` | ❌ Wave 0 | ⬜ pending |
| 45-VM-06 | 45-02 (editor-panel-loop-button-and-lockin) | T1 | 1 | LOOP-05 | onChange of headerText textarea sets BOTH `pendingEdits.radiprotocol_headerText` AND `pendingEdits.text` to the same value (D-02 sync field) | unit | `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts` | ❌ Wave 0 | ⬜ pending |
| 45-VM-07 | 45-02 (editor-panel-loop-button-and-lockin) | T1 | 1 | LOOP-06 | `saveNodeEdits` for `kind='loop'` injects `color: '1'` via NODE_COLOR_MAP['loop'] lookup in the Phase 28 D-01 pipeline (integration lock-in, D-17) | unit | `npm test -- --run src/__tests__/editor-panel-loop-form.test.ts -t "saveNodeEdits"` | ❌ Wave 0 | ⬜ pending |
| 45-VM-08 | 45-02 (editor-panel-loop-button-and-lockin) | T2 | 1 | LOOP-05 | `renderToolbar` renders a button with class `rp-create-loop-btn`, icon `repeat`, positioned AFTER snippet button and BEFORE duplicate button (D-03, D-CL-01, D-CL-02) | grep + awk | `awk '/rp-create-snippet-btn/{snip=NR} /rp-create-loop-btn/{loop=NR} /rp-duplicate-btn/{dup=NR} END{print (snip<loop && loop<dup)?"OK":"FAIL"}' src/views/editor-panel-view.ts` → prints OK | ❌ Wave 1 | ⬜ pending |
| 45-VM-09 | 45-02 (editor-panel-loop-button-and-lockin) | T2 | 1 | LOOP-05 | `onQuickCreate` union extended to `'question' \| 'answer' \| 'snippet' \| 'loop'` (D-04); clicking loop button calls factory with kind='loop' (runtime-verified by VM-12 below in Plan 02 T1 tests 6-7) | grep | `grep -n "kind: 'question' \| 'answer' \| 'snippet' \| 'loop'" src/views/editor-panel-view.ts` | ❌ Wave 1 | ⬜ pending |
| 45-VM-10 | 45-03 (start-from-node-command) | T2 | 2 | LOOP-06 | `main.ts` addCommand block with id `'start-from-node'` (NO plugin prefix per NFR-06) exists; negative-assert `'radiprotocol-start-from-node'` absent | grep | `grep -c "id: 'start-from-node'" src/main.ts` === 1 AND `grep -c "id: 'radiprotocol-start-from-node'" src/main.ts` === 0 | ❌ Wave 2 | ⬜ pending |
| 45-VM-11 | 45-03 (start-from-node-command) | T1 | 2 | LOOP-06 | `RunnerView.openCanvas` accepts optional `startNodeId`; `ProtocolRunner.start` accepts optional `startNodeId`; both default to graph.startNodeId when absent (D-14, Pitfall 8 backward compat) | unit | `npm test -- --run src/__tests__/protocol-runner.test.ts src/__tests__/protocol-runner-session.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts` | ⚠️ extend existing (no code ambiguity — backward-compat verified by pre-existing tests staying green) | ⬜ pending |
| 45-VM-12 | 45-03 (start-from-node-command) | T3 | 2 | LOOP-06 | `runner-commands.test.ts` verifies `buildNodeOptions` is importable AND returns a loop option for a mixed-kind graph (D-20 strengthen) | unit | `npm test -- --run src/__tests__/runner-commands.test.ts -t "D-20"` | ⚠️ extend existing | ⬜ pending |
| 45-VM-13 | 45-02 (editor-panel-loop-button-and-lockin) | T2 | 1 | LOOP-05 | `src/styles/editor-panel.css` tail contains `/* Phase 45: loop quick-create button */` marker and a `.rp-create-loop-btn` rule set (base + :hover + :active + :disabled) | grep | `grep -c "Phase 45: loop quick-create button" src/styles/editor-panel.css` === 1 AND `grep -c "\\.rp-create-loop-btn" src/styles/editor-panel.css` >= 4 | ❌ Wave 1 | ⬜ pending |
| 45-VM-14 | 45-02 (editor-panel-loop-button-and-lockin) | T2 | 1 | LOOP-05 | `npm run build` regenerates `styles.css` successfully; generated file contains `.rp-create-loop-btn`; no hand-edit to `styles.css` outside the regeneration | build + grep | `npm run build` exit 0 AND `grep -c "rp-create-loop-btn" styles.css` >= 4 | ❌ Wave 1 | ⬜ pending |
| 45-VM-15 | **zero-delta** (no code change — D-CL-03 / RESEARCH §2.3) | — | — | LOOP-05 | `CanvasNodeFactory.createNode(path, 'loop', anchorId?)` applies `radiprotocol_nodeType='loop'` and `color: NODE_COLOR_MAP['loop']='1'` via the existing kind-agnostic body. Optional `radiprotocol_headerText: ''` initialization is left to the Phase 43 parser-normalization path (D-05); the factory itself needs no Phase 45 edit | grep-only (invariant check — no new code) | `grep -c "radiprotocol_nodeType: nodeKind" src/canvas/canvas-node-factory.ts` === 1 AND `grep -c "color: NODE_COLOR_MAP\[nodeKind\]" src/canvas/canvas-node-factory.ts` === 1 | ✓ (existing code, no change required) | ⬜ pending (verify-only gate) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Traceability: plan tasks → VM rows

| Plan | Task | Covers VMs |
|------|------|-----------|
| 45-01 | T1 Extend NodePickerModal | VM-01, VM-02, VM-03 (partial: grep on renderSuggestion KIND_LABELS usage) |
| 45-01 | T2 Unit tests | VM-01, VM-02, VM-03 (test portion) |
| 45-02 | T1 Lock-in tests + quick-create button tests | VM-04, VM-05, VM-06, VM-07, VM-09 (grep in acceptance), VM-12 (via 45-02 Tests 6-7 that exercise onQuickCreate) |
| 45-02 | T2 Button + CSS + build | VM-08, VM-09, VM-13, VM-14 |
| 45-03 | T1 ProtocolRunner + RunnerView signature extension | VM-11 |
| 45-03 | T2 addCommand + handleStartFromNode method | VM-10, VM-11 (integration path) |
| 45-03 | T3 runner-commands test extension | VM-10 (grep), VM-12 |
| — | zero-delta verify | VM-15 (grep gate executed during Phase 45 verify-work step) |

---

## Wave 0 Requirements

- [x] Validation framework already installed (vitest present in `package.json` + working tests in `src/__tests__/`).
- [ ] `src/__tests__/node-picker-modal.test.ts` — NEW (created by 45-01 T2); covers LOOP-06 (kinds, sort, labels, id fallback, KIND_LABELS exhaustive).
- [ ] `src/__tests__/editor-panel-loop-form.test.ts` — NEW (created by 45-02 T1); covers LOOP-05 form lock-in (heading, Header text, negative iterations), D-02 onChange sync, D-17 color injection, D-03/D-04 button + onQuickCreate smoke.
- [ ] `src/__tests__/runner-commands.test.ts` — EXTEND existing (by 45-03 T3); +2 tests for D-20 + NFR-06.
- [x] Obsidian mock parity: `src/__mocks__/obsidian.ts` has `Setting`, `TFile`, `Notice`, `SuggestModal`, `ItemView` — missing `setIcon` + `registerDomEvent` are handled inline via `vi.spyOn` (`renderToolbar` stubbed in editor-panel-loop-form tests per Pitfall #4).

*No new test framework install. No shared fixtures required — in-memory mock graphs (45-01 T2) + existing `unified-loop-valid.canvas` suffice.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quick-create loop button click actually creates a loop node on the active canvas, painted with `color: '1'` (Obsidian RED per `NODE_COLOR_MAP['loop']='1'`) | LOOP-05, LOOP-06 | Requires live Obsidian instance + Canvas plugin + real filesystem — not reproducible in vitest/JSDom | 1. `npm run build` → reload plugin in Obsidian. 2. Open any canvas. 3. Open Node Editor (right sidebar). 4. Click «Create loop node» (4th button in toolbar, icon `repeat`). 5. Verify a loop-kind node appears with **red** color (Obsidian palette position "1") and empty headerText. 6. Click the new node; Node Editor shows "Loop node" heading + "Header text" textarea + NO iterations field. |
| `start-from-node` command visible in Ctrl+P, opens NodePickerModal over active canvas, and starts RunnerView from the chosen node | LOOP-06 | Command palette registration + modal + runner activation only testable end-to-end in Obsidian | 1. Reload plugin. 2. Open canvas `unified-loop-valid.canvas` (or any canvas with mixed node kinds). 3. Press Ctrl+P (Cmd+P on macOS) → type "Start from specific node" → select. 4. Verify picker opens with Вопрос / Цикл / Текст / Сниппет Russian badges, ordered question → loop → text-block → snippet. 5. Pick the loop-kind option → RunnerView opens and halts at the loop picker (RUN-01 render from Phase 44). 6. Close; re-run with a canvas containing legacy `loop-start`/`loop-end` nodes → expect a Notice with the MIGRATE-01 text; picker does NOT open. |
| Canvas rendering of loop node painted red | LOOP-06 | Only Obsidian native canvas renderer interprets the `color` property on canvas nodes | After quick-create, visually inspect the canvas — the node should be **red** (first Obsidian palette color). Cross-reference Phase 43 screenshots of running loop protocols where the same red color was used for the unified loop. |

---

## Validation Sign-Off

- [x] All plan tasks have `<automated>` verify or Wave 0 dependencies — confirmed in plan files.
- [x] Sampling continuity: every plan runs its targeted test command at task commit; wave-merge runs full suite.
- [x] Wave 0 covers all MISSING references (node-picker-modal.test.ts, editor-panel-loop-form.test.ts).
- [x] No watch-mode flags (all runs use `--run`).
- [x] Feedback latency < 10s per targeted run.
- [x] `nyquist_compliant: true` set in frontmatter — every task has a concrete automated command or grep-verifiable acceptance criterion.

**Approval:** APPROVED — plans 45-01, 45-02, 45-03 cover all 15 VM rows.

---

## Source audit summary (for /gsd-verify-work reference)

| Source Item | Covered By | Kind |
|-------------|-----------|------|
| LOOP-05 | 45-02 (all tasks) | REQ |
| LOOP-06 | 45-01 (all tasks) + 45-02 T1 VM-07 (color integration) + 45-03 (all tasks) | REQ |
| D-01 (lock-in not rewrite Phase 44 form) | 45-02 T1 VM-04, VM-05, VM-06 | CONTEXT |
| D-02 (five lock-in test cases) | 45-02 T1 VM-04 + VM-05 + VM-06 + VM-07 | CONTEXT |
| D-03 (button position + class + icon) | 45-02 T2 VM-08 + VM-13 | CONTEXT |
| D-04 (onQuickCreate union widening) | 45-02 T2 VM-09 + 45-02 T1 Tests 6-7 | CONTEXT |
| D-05 (factory support for loop) | VM-15 zero-delta (D-CL-03 verified, factory kind-agnostic) | CONTEXT |
| D-06 (4 kinds, answer excluded) | 45-01 T2 VM-01 | CONTEXT |
| D-07 (label text-field \|\| id fallback) | 45-01 T2 VM-01 (id fallback case) | CONTEXT |
| D-08 (kind-group entry-order sort) | 45-01 T2 VM-02 | CONTEXT |
| D-09 (NodeOption.kind 4-union) | 45-01 T1 grep in VM-03 | CONTEXT |
| D-10 (KIND_LABELS map) | 45-01 T2 VM-03 | CONTEXT |
| D-11 (setPlaceholder remains English) | 45-01 T1 acceptance criteria grep | CONTEXT |
| D-12 (addCommand registration) | 45-03 T2 VM-10 | CONTEXT |
| D-13 (callback flow) | 45-03 T2 (handleStartFromNode body) | CONTEXT |
| D-14 (openCanvas + start startNodeId extension) | 45-03 T1 VM-11 | CONTEXT |
| D-15 (activateRunnerView before picker) | 45-03 T2 acceptance criteria | CONTEXT |
| D-16 (NODE_COLOR_MAP['loop']='1' exists) | Reference-only; VM-07 asserts it through saveNodeEdits | CONTEXT |
| D-17 (integration test color injection) | 45-02 T1 VM-07 | CONTEXT |
| D-18, D-19, D-20 (test files) | 45-01 T2 + 45-02 T1 + 45-03 T3 | CONTEXT |
| D-CL-01 (icon 'repeat') | 45-02 T2 (action step 2) | CONTEXT |
| D-CL-02 (class rp-create-loop-btn) | 45-02 T2 VM-08 | CONTEXT |
| D-CL-03 (factory zero-delta) | VM-15 | CONTEXT |
| D-CL-04 (English notices) | 45-03 T2 (handleStartFromNode body) | CONTEXT |
| D-CL-05 (snippet label fallback) | 45-01 T1 buildNodeOptions body | CONTEXT |
| D-CL-06 (validator blocks start-from-node) | 45-03 T2 (GraphValidator check in callback) | CONTEXT |
| ROADMAP Phase 45 SC #1 (Node Editor form editable headerText, no maxIterations) | 45-02 T1 VM-04 + VM-05 | GOAL |
| ROADMAP Phase 45 SC #2 (save writes headerText + loop color) | 45-02 T1 VM-06 + VM-07 + manual UAT | GOAL |
| ROADMAP Phase 45 SC #3 (NodePickerModal lists loop first-class) | 45-01 T2 VM-01 + 45-03 manual UAT | GOAL |
| CLAUDE.md: per-feature CSS | 45-02 T2 acceptance VM-13 + VM-14 | CONTEXT |
| CLAUDE.md: never remove code | Every shared-file task echoes this rule + grep acceptance | CONTEXT |
| RESEARCH.md Pitfall 2 (Setting mock chain) | 45-02 T1 beforeEach pattern | RESEARCH |
| RESEARCH.md Pitfall 4 (setIcon missing in mock) | 45-02 T1 renderToolbar stub | RESEARCH |
| RESEARCH.md Pitfall 5 (loop vs loop-start fall-through) | 45-02 T1 VM-04 "Loop node" exact assertion | RESEARCH |
| RESEARCH.md Pitfall 6 (answer exclusion) | 45-01 T2 VM-01 exclusion test | RESEARCH |
| RESEARCH.md Pitfall 8 (setState backward compat) | 45-03 T1 VM-11 grep on 1-arg openCanvas | RESEARCH |
| RESEARCH.md Pitfall 9 (CSS file scope) | 45-02 T2 acceptance (loop-support.css not touched) | RESEARCH |
| RESEARCH.md Pitfall 10 (command id collision) | 45-03 T3 VM-10 NFR-06 grep | RESEARCH |

**No unplanned items detected.** All LOOP-05 / LOOP-06 / CONTEXT.md D-XX / RESEARCH.md pitfalls / ROADMAP success criteria map to at least one plan task.
