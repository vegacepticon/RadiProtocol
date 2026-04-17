---
phase: 42
plan: 02
subsystem: node-editor
tags: [quick-create, toolbar, snippet, canvas-authoring, ui]

requires:
  - phase: 39-01
    provides: "renderToolbar quick-create buttons (question + answer) and onQuickCreate pipeline"
  - phase: 39-02
    provides: "in-memory renderForm bypass using canvasNode.getData() inside onQuickCreate"
  - phase: 38-01
    provides: "CanvasNodeFactory.createNode(canvasPath, kind, anchorId) — accepts any RPNodeKind including snippet"
  - phase: 42-01
    provides: ".rp-editor-type-hint CSS block (Phase 42 banner #1) — appended BEFORE this plan's block"
provides:
  - "Third quick-create toolbar button: Create snippet node"
  - "onQuickCreate widened to accept 'snippet' kind with zero body changes"
  - ".rp-create-snippet-btn CSS block (base + :hover + :active + :disabled)"
  - "Unit test asserting snippet click wires to factory.createNode('test.canvas', 'snippet', undefined)"
affects:
  - "src/views/editor-panel-view.ts — renderToolbar now creates 4 buttons in locked order [question, answer, snippet, duplicate]"

tech-stack:
  added: []
  patterns:
    - "Reuse of existing onQuickCreate flush -> createNode -> in-memory renderForm pipeline (Phase 39 Plan 02) via type-union widening only"
    - "Append-only CSS per CLAUDE.md: new Phase 42 block added AFTER the Phase 42 type-hint block from Plan 01, no existing rules touched"

key-files:
  created:
    - .planning/phases/42-snippet-node-creation-button-and-double-click-node-selection-fix/42-02-SUMMARY.md
  modified:
    - src/views/editor-panel-view.ts
    - src/styles/editor-panel.css
    - src/styles.css
    - styles.css
    - src/__tests__/editor-panel-create.test.ts

key-decisions:
  - "Widen the onQuickCreate type union rather than introduce a new onCreateSnippet method — the factory handles 'snippet' generically, adding a parallel method would duplicate the flush/create/renderForm pipeline with no behavior difference."
  - "Keep the snippet CSS as a dedicated rule block (not merged into the grouped `.rp-create-question-btn, .rp-create-answer-btn` selector list) — append-only CLAUDE.md invariant forbids editing any Phase 39 rule, even to add a class to a grouped selector."
  - "Snippet button is NOT gated on currentNodeId — UI-SPEC locks the question/answer pattern (always enabled when a canvas is open), not the duplicate pattern. If no anchor is set, the factory places the new node at canvas origin."

patterns-established: []

requirements-completed: [PHASE42-SNIPPET-QUICK-CREATE]

metrics:
  duration: "4min"
  completed: 2026-04-17
  tasks_completed: 2
  files_modified: 5
---

# Phase 42 Plan 02: Create Snippet Node Button Summary

**Third quick-create button 'Create snippet node' added to the node editor toolbar (Lucide file-text icon, accent styling matching Phase 39 buttons) — reuses onQuickCreate by widening its kind union to include 'snippet', zero new pipeline code.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-17T05:17:25Z
- **Completed:** 2026-04-17T05:21:33Z
- **Tasks:** 2 (auto + auto-tdd)
- **Files modified:** 5

## Accomplishments

- **Signature widened:** `onQuickCreate` accepts `'question' | 'answer' | 'snippet'` — body byte-identical, factory handles all three kinds generically.
- **Snippet button inserted:** `renderToolbar` emits a fourth button (`rp-create-snippet-btn`) between the answer and duplicate buttons. Icon `file-text`, visible text / aria-label / title all `"Create snippet node"` (UI-SPEC copy lock). Click handler calls `this.onQuickCreate('snippet')`, reusing the existing flush → create → in-memory renderForm pipeline. Snippet button NOT gated on `currentNodeId` (matches question/answer semantics, not duplicate).
- **Button order (locked):** `[Create question] [Create answer] [Create snippet] [Duplicate]` — verified by `grep -n createEl('button'` line ordering (861, 867, 874, 883).
- **CSS appended:** `/* Phase 42: Create snippet node button */` block at EOF of `src/styles/editor-panel.css` — base + `:hover` + `:active` + `:disabled` rules, all values inherited from Phase 39 token set (accent bg, text-on-accent fg, `filter: brightness(1.1)` hover, 0.4 opacity disabled). Placed AFTER the Phase 42 `.rp-editor-type-hint` block from Plan 01 — append-only invariant preserved.
- **Build:** `npm run build` regenerated `styles.css` (root) and `src/styles.css` — `rp-create-snippet-btn` now present in generated output (4 occurrences).
- **Test:** New unit test `snippet button calls factory with snippet kind` added inside the existing `EditorPanelView quick-create` describe block, immediately after the answer-kind test. Asserts `factory.createNode('test.canvas', 'snippet', undefined)` is called. Full suite 390/390 green (was 389; +1 new, 0 regressions).

## Task Commits

1. **Task 1 — Widen onQuickCreate signature + add Create snippet node button:** `c4840d2` (feat)
   - `onQuickCreate(kind: 'question' | 'answer')` → `onQuickCreate(kind: 'question' | 'answer' | 'snippet')`
   - 8-line snippet button block inserted between answer button and Phase 40 Duplicate comment in `renderToolbar`
   - 1 file changed, 10 insertions, 1 deletion
2. **Task 2 — Append Phase 42 CSS + test snippet wiring:** `257868c` (feat)
   - 32-line CSS block appended to `src/styles/editor-panel.css`
   - `npm run build` regenerated `styles.css` + `src/styles.css`
   - 5-line unit test appended to first describe block in `editor-panel-create.test.ts`
   - 4 files changed, 103 insertions

## Files Created/Modified

- `src/views/editor-panel-view.ts` — 2 surgical changes (signature widening + snippet button insertion), 10 lines added, 1 replaced. Phase 39 question/answer button code and Phase 40 duplicate button code byte-preserved.
- `src/styles/editor-panel.css` — 32-line Phase 42 block (banner + 4 rules) appended at EOF. Phase 4, 39, 40, 42-01 rules byte-identical.
- `styles.css` — auto-regenerated by esbuild. Contains the concatenated Phase 42 snippet block.
- `src/styles.css` — auto-regenerated convenience copy.
- `src/__tests__/editor-panel-create.test.ts` — 1 new `it()` test added inside the first describe. Other 16 tests unchanged.

## Decisions Made

- **Widen the type union, don't add `onCreateSnippet`** — the `onQuickCreate` body passes `kind` straight to `canvasNodeFactory.createNode(canvasPath, kind, anchorId)`. The factory already accepts `'snippet'` (NODE_COLOR_MAP entry confirmed, Phase 29 D-06). A parallel method would duplicate the flush/create/renderForm pipeline with zero behavior difference.
- **Dedicated `.rp-create-snippet-btn` rule block, not merged into grouped Phase 39 selector** — the UI-SPEC offered both options. The append-only CLAUDE.md invariant forbids editing any existing rule, even to add a class name to a grouped selector list. A new block is the clean-append path.
- **Snippet button is NOT disabled when `currentNodeId` is null** — UI-SPEC locks the question/answer pattern (always enabled while a canvas is open). If no anchor is set, `CanvasNodeFactory.createNode` places the new node at canvas origin (Phase 38 behavior). The Duplicate pattern of gating on `currentNodeId` is semantically different (it needs a source node) and does not apply here.

## Deviations from Plan

None — plan executed exactly as written. All grep acceptance criteria matched on the first pass; no auto-fix required; no blockers encountered.

## Issues Encountered

None. Test infrastructure from Plan 42-01 (vi.mock('obsidian') + Setting.prototype patching in the double-click describe block) was not touched — the new snippet-kind test lives in the first describe block which uses the simpler mock setup that existed before Plan 42-01.

## User Setup Required

None — pure code + CSS changes, no external services or secrets.

## Verification Evidence

- `npx vitest run` — 390 tests, all pass (389 existing + 1 new snippet test)
- `npx vitest run src/__tests__/editor-panel-create.test.ts` — 17 tests pass (16 existing + 1 new)
- `npm run build` — exit 0, regenerates `styles.css` + `src/styles.css` + `main.js`
- `npx tsc --noEmit` — all errors confined to pre-existing node_modules vitest/vite moduleResolution warnings; src/ code clean
- Acceptance greps (Task 1 — editor-panel-view.ts):
  - `rp-create-snippet-btn`: 1
  - `Create snippet node`: 4 (visible + aria-label + title + phase banner comment)
  - `file-text`: 1
  - `onQuickCreate('snippet')`: 1
  - `'question' | 'answer' | 'snippet'`: 1
  - `'question' | 'answer'`: 1 (only the widened signature — no leftover)
  - `rp-create-question-btn`: 1 (unchanged)
  - `rp-create-answer-btn`: 1 (unchanged)
  - `rp-duplicate-btn`: 1 (unchanged)
  - `sBtn.disabled`: 0 (gate-free)
  - Button-creation line order: 861 (question) < 867 (answer) < 874 (snippet) < 883 (duplicate) — locked order confirmed
- Acceptance greps (Task 2 — editor-panel.css):
  - `Phase 42:`: 2 (type-hint from 42-01 + snippet button from this plan)
  - `rp-create-snippet-btn`: 4 (base + :hover + :active + :disabled)
  - `rp-editor-type-hint`: 1 (42-01 rule unchanged)
  - `rp-create-question-btn`: 4 (Phase 39 unchanged)
  - `rp-create-answer-btn`: 4 (Phase 39 unchanged)
  - `rp-duplicate-btn`: 4 (Phase 40 unchanged)
  - `rp-editor-panel`: 1 (Phase 4 unchanged)
- Acceptance greps (Task 2 — test file):
  - `snippet button calls factory with snippet kind`: 1
  - `toHaveBeenCalledWith('test.canvas', 'snippet', undefined)`: 1
- Acceptance greps (Task 2 — generated output):
  - `rp-create-snippet-btn` in root `styles.css`: 4 (>= 1 required)

## Next Phase Readiness

- Phase 42 complete: plan 01 (double-click fix + helper hint) + plan 02 (snippet button) both shipped, totaling the three `requirements` declared by the phase (PHASE42-DOUBLECLICK-FIX, PHASE42-EMPTY-TYPE-HINT, PHASE42-SNIPPET-QUICK-CREATE).
- v1.6 phase 42 success criterion #1 and requirement PHASE42-SNIPPET-QUICK-CREATE closed.
- UAT-ready: four-button toolbar, hover brightens button, tooltip "Create snippet node", click creates snippet node adjacent to selected anchor (or at canvas origin if no anchor) and immediately loads the snippet-kind form (subfolder dropdown, branch label, separator override — all from Phase 29).
- Phase verifier can proceed. No open blockers.

---
*Phase: 42-snippet-node-creation-button-and-double-click-node-selection-fix*
*Completed: 2026-04-17*

## Self-Check: PASSED

- All 6 file paths referenced in key-files exist on disk.
- Both commit hashes (c4840d2, 257868c) are present in `git log`.
