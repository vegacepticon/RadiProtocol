---
phase: 49
plan: 03
subsystem: runner
tags: [phase-49, loop-exit-edge-convention, runner, view, regression-test]
requires:
  - src/graph/node-label.ts (Plan 49-01 — isExitEdge, nodeLabel)
  - src/graph/graph-model.ts (ProtocolGraph, RPNode, RPEdge shapes)
provides:
  - ProtocolRunner.chooseLoopBranch dispatches via isExitEdge (no literal «выход» at runtime)
  - RunnerView loop picker uses isExitEdge for CSS selection + nodeLabel(target) for body captions
  - Two regression tests for non-«выход» labeled-edge dispatch (Phase 49 D-05/D-08)
affects:
  - src/runner/protocol-runner.ts — chooseLoopBranch dispatch + JSDoc/comment alignment
  - src/views/runner-view.ts — awaiting-loop-pick render arm (loop-picker `for` body only)
  - src/__tests__/runner/protocol-runner-loop-picker.test.ts — +2 regression tests
tech-stack:
  added: []
  patterns:
    - "Shared runtime predicate: both ProtocolRunner.chooseLoopBranch (dispatch) and RunnerView loop picker (CSS+caption) consume isExitEdge from src/graph/node-label.ts — single source of truth"
    - "Body-button caption delegation: nodeLabel(target) via the Plan 49-01 shared util — validator error wording and runner button caption stay in lock-step per D-13"
    - "Inline ProtocolGraph fixture via a local factory function — keeps the regression tests fixture-file-independent so they remain green regardless of Plan 49-04 body-label stripping"
key-files:
  created: []
  modified:
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
    - src/__tests__/runner/protocol-runner-loop-picker.test.ts
decisions:
  - "D-06 trim at caption site: RunnerView exit-button caption uses `(edge.label ?? '').trim()` — validator enforces non-empty-after-trim, but defensive trim at render keeps stray leading/trailing whitespace off the button text"
  - "D-11/D-12 body-caption delegation: unlabeled body edges render `nodeLabel(target)` via the shared util. Defensive fallback to `edge.toNodeId` when target lookup fails — post-validator this cannot happen, but keeps the render arm crash-free"
  - "Task-3 regression tests use an inline ProtocolGraph factory (makeLoopGraph) instead of a new canvas fixture. Rationale: (a) keeps the regression test runnable today regardless of Plan 49-04's fixture-label stripping, (b) makes the D-05 contract readable inline without jumping to a .canvas file, (c) no duplication with existing fixture-based RUN-01..RUN-05 tests"
  - "Task 1 and Task 2 each ship as a standalone `refactor(...)` commit (not `feat` and not `fix`) — behaviour is intentionally equivalent against the legacy «выход»-labeled fixtures that Plan 49-04 has not yet stripped; the semantic change is the D-05 label-state dispatch convention, pure refactor from a behavioural-contract point of view"
metrics:
  duration: ~5 minutes (wall clock 09:17:27Z → 09:22:12Z)
  completed: 2026-04-19
  tasks: 3/3
  files_created: 0
  files_modified: 3
  commits: 3
  tests_added: 2
---

# Phase 49 Plan 03: Runner + View Rewire Summary

**One-liner:** `ProtocolRunner.chooseLoopBranch` (line 194) and `RunnerView`'s `awaiting-loop-pick` render arm (lines 482-496) now dispatch / render via `isExitEdge` + `nodeLabel` from the shared `src/graph/node-label.ts` module; two new inline-graph regression tests prove the dispatch is label-state-based (D-05) rather than a literal «выход» string compare (D-08); zero runtime `edge.label === 'выход'` comparisons remain in `src/runner/` or `src/views/`.

---

## What Changed

### Modified — `src/runner/protocol-runner.ts`

**Lines edited (minimal diff: +6 / -4):**

- **Line 6** (new import): `import { isExitEdge } from '../graph/node-label';` — placed adjacent to `TextAccumulator` import; relative path `../graph/node-label` mirrors the existing `../graph/graph-model` import at line 3.
- **Line 167** (JSDoc bullet inside `chooseLoopBranch` JSDoc block): `*   - 'выход'  → pop the current loop frame, advance along the exit edge` → `*   - labeled edge (Phase 49 EDGE-01) → pop the current loop frame, advance along the exit edge`.
- **Lines 194-197** (dispatch swap — the core behavioural change):
  - before: `if (edge.label === 'выход') {` + `// RUN-03: pop frame (top-of-stack, nested-safe)` + `this.loopContextStack.pop();` + `}`
  - after: `if (isExitEdge(edge)) {` + `// RUN-03: pop frame (top-of-stack, nested-safe). Phase 49 EDGE-01:` + `// the labeled outgoing edge (uniqueness enforced by GraphValidator) is the exit.` + `this.loopContextStack.pop();` + `}`
- **Line 200** (narrative comment inside the body-branch rationale): `re-entry AND on inner-«выход» landing on outer` → `re-entry AND on inner-exit landing on outer`.

**Preserved verbatim (not touched):**
- `undoStack.push({...})` Pitfall-1 block at lines 188-192 — byte-identical.
- Edge-validation guard at lines 180-185 — byte-identical.
- `advanceThrough(edge.toNodeId)` at line 210 — byte-identical.
- Multi-line body-branch rationale at lines 201-207 (only line 200's inline comment changed).
- JSDoc / narrative comments at lines 315 and 582 referencing `«выход»` — out of the current edit window, explicitly listed as "leave alone" in the plan's `<audit_notes>` (narrative prose that stays correct under the new convention).
- All other methods (`chooseAnswer`, `chooseSnippetBranch`, `stepBack`, `pickSnippet`, `completeSnippet`, `syncManualEdit`, `getState`, `getSerializableState`, `setGraph`, `restoreFrom`, `advanceThrough`, `advanceOrReturnToLoop`, `firstNeighbour`, `transitionToComplete`, `transitionToError`) — untouched.

### Modified — `src/views/runner-view.ts`

**Lines edited (minimal diff: +16 / -4):**

- **Line 14** (new import, placed immediately after the `CanvasSwitchModal` import which sat alone on line 13): `import { isExitEdge, nodeLabel } from '../graph/node-label';`.
- **Lines 482-506** (the `for (const edge of outgoing)` block inside the `awaiting-loop-pick` switch arm):
  - `const label = edge.label ?? '(no label)';` **removed** — replaced by the per-branch caption logic.
  - `const isExit = edge.label === 'выход'; // exact-match contract — Phase 43 D-08` **removed** — replaced by `const exit = isExitEdge(edge);`.
  - **New caption branch:** if `exit === true` → `caption = (edge.label ?? '').trim();` (D-06 — trimmed label verbatim); else → `const target = this.graph.nodes.get(edge.toNodeId); caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;` (D-11/D-12 with defensive fallback).
  - `cls: isExit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn'` → `cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn'` (rename only; class names unchanged).
  - `text: label` → `text: caption`.
  - **Click-handler body unchanged** — `capturePendingTextareaScroll()` → `syncManualEdit(this.previewTextarea?.value ?? '')` → `chooseLoopBranch(edge.id)` → `void this.autoSaveSession()` → `void this.renderAsync()` — character-for-character identical to pre-Phase-49. Confirmed below.
  - Phase 49 EDGE-01 banner comment added at the top of the `for` body documenting the label-state convention inline.

**Click-handler ordering preservation (RUNFIX-02 + Pitfall 7 invariant):**

```typescript
this.registerDomEvent(btn, 'click', () => {
  this.capturePendingTextareaScroll();                            // (1) RUNFIX-02
  this.runner.syncManualEdit(this.previewTextarea?.value ?? ''); // (2) Pitfall 7
  this.runner.chooseLoopBranch(edge.id);                         // (3) locked decision
  void this.autoSaveSession();                                    // (4) SESSION-01
  void this.renderAsync();                                        // (5)
});
```

Grep audit: `capturePendingTextareaScroll` appears 5× in `src/views/runner-view.ts` (once as the helper definition at line 812, and four times at the four choice-click sites: answer, snippet-branch, loop-picker-button, snippet-picker-row). All four call-sites still reference the helper as the first action in their click handlers — count unchanged by this plan.

**Preserved verbatim (not touched):**
- `questionZone.createEl('p', { text: node.headerText, cls: 'rp-loop-header-text' })` (lines 472-477) — Phase 44 RUN-01.
- `const outgoing = this.graph.edges.filter(...)` (line 480) — byte-identical.
- `const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });` (line 481) — byte-identical.
- Step-back button block at lines 499-509 — byte-identical.
- `renderPreviewZone` / `renderOutputToolbar` calls at lines 511-512 — byte-identical.
- `awaiting-loop-pick` guard rails at lines 461-469 — byte-identical.
- All other switch arms (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-snippet-fill`, `complete`, `error`) — untouched.
- All other methods (`renderSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`, `autoSaveSession`, `capturePendingTextareaScroll`, `renderPreviewZone`, `renderOutputToolbar`, `renderError`, `onOpen`, `onClose`, `openCanvas`, `handleSelectorSelect`, `restartCanvas`, `renderAsync`, `setState`, `getState`, `getDisplayText`, `getIcon`, `getViewType`) — untouched.

### Modified — `src/__tests__/runner/protocol-runner-loop-picker.test.ts`

**Lines edited (minimal diff: +62 / -1):**

- **Line 6** (existing import): `import type { ProtocolGraph } from '../../graph/graph-model';` → `import type { ProtocolGraph, RPNode } from '../../graph/graph-model';` — added `RPNode` for the inline factory's typed Map.
- **After the W4 long-body test, before the describe-block close brace** — appended two new `it(...)` tests plus one local `makeLoopGraph()` factory function. Appended location keeps the new tests inside the `describe('ProtocolRunner loop picker (RUN-01..RUN-05)'...)` block as required (they inherit nothing from the `loadGraph` helper — they use the inline factory instead — but live co-located with the other runner-dispatch tests for discoverability).

**New factory (inline graph, one labeled + one unlabeled body edge):**
- 4 nodes: `n-start` (start), `n-loop` (loop, `headerText: 'Loop'`), `n-body` (text-block, `content: 'Body'`), `n-end` (text-block, `content: 'End'`).
- 4 edges: `e1 (start→loop)`, `e2 (loop→body, unlabeled)`, `e3 (loop→end, label: 'готово')`, `e4 (body→loop, back-edge)`.
- `adjacency` and `reverseAdjacency` Maps populated explicitly. `startNodeId: 'n-start'`. `canvasFilePath: 'test:phase-49-d05.canvas'` — synthetic path; no on-disk file.

**Two new tests:**
1. `Phase 49 D-05/D-08: labeled edge with a non-«выход» word ("готово") still pops the loop frame via isExitEdge` — starts runner, asserts `awaiting-loop-pick`, picks labeled edge `e3`, asserts `complete`. Guards against re-introduction of a literal `'выход'` match at dispatch.
2. `Phase 49 D-05: unlabeled body edge does NOT pop the loop frame (picker re-entry)` — starts runner, picks unlabeled body edge `e2`, asserts `awaiting-loop-pick` (back-edge re-entry via B1 guard). Sibling to (1), proves the predicate is discriminating.

**Preserved verbatim (not touched):**
- All existing tests RUN-01 through W4 and all four RUNFIX-01 tests — byte-identical.
- The `loadGraph` helper — byte-identical.
- Describe-block structure — unchanged.

---

## Verification

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit --skipLibCheck` | **exit 0** (clean) |
| Full test suite | `npx vitest run` | **459 passed / 1 skipped / 7 failed** (34 files, 467 total) |
| Target runner tests | `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts` | **9 passed / 3 failed** (12 total; +2 new green) |
| `grep -c "from '../graph/node-label'" src/runner/protocol-runner.ts` | | **1** ✓ |
| `grep -c "isExitEdge" src/runner/protocol-runner.ts` | | **2** (≥2) ✓ |
| `grep -c "edge.label === 'выход'" src/runner/protocol-runner.ts` | | **0** ✓ |
| `grep -c "if (isExitEdge(edge))" src/runner/protocol-runner.ts` | | **1** ✓ |
| `grep -c "labeled edge (Phase 49 EDGE-01)" src/runner/protocol-runner.ts` | | **1** ✓ |
| `grep -c "inner-exit landing" src/runner/protocol-runner.ts` | | **1** ✓ |
| `grep -c "undoStack.push" src/runner/protocol-runner.ts` | | **5** (Pitfall 1 preserved — ≥1) ✓ |
| `grep -c "this.loopContextStack.pop()" src/runner/protocol-runner.ts` | | **1** (single call-site) ✓ |
| `grep -c "from '../graph/node-label'" src/views/runner-view.ts` | | **1** ✓ |
| `grep -c "isExitEdge" src/views/runner-view.ts` | | **2** (≥2 — import + use) ✓ |
| `grep -c "nodeLabel" src/views/runner-view.ts` | | **3** (≥2 — import + use in exit branch + use in body branch) ✓ |
| `grep -c "edge.label === 'выход'" src/views/runner-view.ts` | | **0** ✓ |
| `grep -c "edge.label ?? '(no label)'" src/views/runner-view.ts` | | **0** ✓ |
| `grep -c "const exit = isExitEdge(edge);" src/views/runner-view.ts` | | **1** ✓ |
| `grep -c "caption = (edge.label ?? '').trim();" src/views/runner-view.ts` | | **1** ✓ |
| `grep -c "nodeLabel(target)" src/views/runner-view.ts` | | **1** ✓ |
| `grep -c "capturePendingTextareaScroll" src/views/runner-view.ts` | | **5** (≥2; helper def + 4 call-sites) ✓ |
| `grep -c "Phase 49 D-05" src/__tests__/runner/protocol-runner-loop-picker.test.ts` | | **3** (≥2 — 2 test descriptions + 1 comment) ✓ |
| `grep -c "готово" src/__tests__/runner/protocol-runner-loop-picker.test.ts` | | **4** (≥2) ✓ |
| `grep -c "chooseLoopBranch('e3')" src/__tests__/runner/protocol-runner-loop-picker.test.ts` | | **5** (≥2; pre-existing RUN-03 / RUN-04 / W4 + new Phase 49 D-05/D-08 test + assertion-line overlap) ✓ |
| New `it()` count delta | manual count | **+2** ✓ |

### Expected failures (Plan-04-dependent + newly widened by this plan's D-05 dispatch swap)

Baseline after Plan 02 (before this plan): **461 passed / 3 failed**.
After this plan: **459 passed / 7 failed**.

Delta = +2 new passing regression tests (Phase 49 D-05/D-08 guards) and +4 new red tests. Every red is rooted in the same Plan-04-locked fixture issue — three of the legacy fixtures still carry `"проверка"` on body edges which D-05 now classifies as labeled, shifting runtime dispatch away from the body-walk path:

| # | Test | File | Root cause | Plan 04 resolution |
|---|------|------|------------|---------------------|
| 1 | `unified-loop-valid.canvas passes LOOP-04 checks` | graph-validator.test.ts | `e2` `"проверка"` → D-02 fires (2 labeled edges). Pre-existing from Plan 02. | D-20 strips e2 label |
| 2 | `unified-loop-missing-exit.canvas flags zero labeled outgoing edges` | graph-validator.test.ts | `e2` `"проверка"` masks the missing exit (it IS labeled). Pre-existing from Plan 02. | D-20 strips e2 label |
| 3 | `unified-loop-stray-body-label.canvas flags a second labeled edge` | graph-validator.test.ts | Fixture does not exist yet. Pre-existing from Plan 02. | D-16 creates fixture |
| 4 | `RUN-02: body-branch walks the branch; back-edge re-entry ...` | runner/protocol-runner-loop-picker.test.ts | `chooseLoopBranch('e2')` with label `"проверка"` now hits isExitEdge path → pops frame instead of walking body. **NEW in Plan 03** — caused by Task 1's D-05 swap against unstripped fixture. | D-20 strips e2 label → e2 is unlabeled → body-walk path restored |
| 5 | `RUN-04: nested loops — inner «выход» returns to outer picker ...` | runner/protocol-runner-loop-picker.test.ts | Same root cause as #4 — `chooseLoopBranch('e2')` on `unified-loop-nested.canvas` expects body walk. **NEW in Plan 03.** | D-20 strips `проверка` on nested fixture |
| 6 | `W4: long-body loop iterates 10 times without tripping RUN-09 ...` | runner/protocol-runner-loop-picker.test.ts | Same root cause — `chooseLoopBranch('e2')` body-walk on `unified-loop-long-body.canvas`. **NEW in Plan 03.** | D-20 strips `проверка` on long-body fixture |
| 7 | `loopContextStack with iteration=2 survives JSON round-trip (SESSION-05)` | runner/protocol-runner-session.test.ts | Same root cause — uses `unified-loop-valid.canvas` + `chooseLoopBranch('e2')` body walk to set up the iteration=2 snapshot. **NEW in Plan 03.** | D-20 strips e2 label → body-walk path restored |

All four new reds (#4-#7) are plan-documented consequences of the D-05 dispatch swap meeting the yet-unstripped fixture labels. The plan-level `<verification>` block explicitly anticipates this: _"existing protocol-runner tests still green (modulo Plan 04-dependent fixture failures already documented in 49-02 SUMMARY)"_. Plan 49-04 (fixture audit, D-20) strips the body-edge `"проверка"` labels → all 7 failures flip to green. Plan 49-05 is the combined gate.

**No NEW red tests outside the Plan-04-dependent set** — the 2 new Phase 49 D-05/D-08 regression tests are both green because they use an inline graph factory (independent of fixture state).

---

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `98df8ee` | refactor | refactor(49-03): swap ProtocolRunner.chooseLoopBranch dispatch to isExitEdge() |
| 2 | `0846db2` | refactor | refactor(49-03): rewire RunnerView loop picker to isExitEdge + nodeLabel captions |
| 3 | `c5c1729` | test | test(49-03): regression guard for non-«выход» labeled edge dispatch |

Diff sizes: `98df8ee` (+6 / -4), `0846db2` (+16 / -4), `c5c1729` (+62 / -1). Total: +84 / -9 across three files.

---

## Decisions Made

1. **Refactor commit type (Task 1 & Task 2) instead of feat/fix** — behaviour on the legacy fixtures (all body edges labeled `"проверка"`, exit labeled `"выход"`) is intentionally shifted by D-05, but from the contract surface the swap is a rewiring to the shared predicate: same runtime result on `"выход"`-labeled edges, new correct result on other labeled edges. Refactor-type commit correctly signals "no new user-visible feature, no bug fix — rewiring to the Phase 49 convention".

2. **Task 3 inline graph factory over a new canvas fixture** — the two regression tests use a `makeLoopGraph()` local factory that returns a fully-typed `ProtocolGraph`. Rationale: (a) fixture-file-free makes the regression independent of Plan 49-04's body-label stripping — the test reads at face value and stays green regardless of fixture state; (b) the D-05 contract is readable inline without jumping to a `.canvas` file; (c) already-in-file `loadGraph` helper stays the pattern for fixture-based tests; no duplication. The plan's `<action>` offered both "inline" and "new fixture" approaches — inline was the plan's "preferred shape".

3. **Defensive `edge.toNodeId` fallback in RunnerView body-caption** — plan's required rewrite shape specifies `caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;`. The fallback cannot be reached post-validator (LOOP-04 guarantees edge targets exist), but keeps the render arm crash-free if anyone bypasses the validator. Documented in-code via the banner comment.

4. **`(edge.label ?? '').trim()` at the RunnerView caption site** — even though GraphValidator's LOOP-04 + `isLabeledEdge` D-05 guarantees the label is non-empty after trim, applying `.trim()` again at the caption site prevents stray leading/trailing whitespace from the author's canvas text from surviving into the DOM. D-06 says "trimmed label verbatim" and that is exactly what the caller produces.

5. **Comment-hygiene scope kept minimal** — only the JSDoc bullet at line 167 and the inline comment at line 200 were touched. Lines 315 and 582 (narrative comments mentioning `«выход»` inside `syncManualEdit` JSDoc and inside `case 'loop'` first-entry rationale) were left verbatim per the plan's `<audit_notes>`. Those references are descriptive of the historical naming of a specific legacy edge in the example fixtures, not prescriptive of future behaviour.

6. **Comment about the exit-edge match at line 484 (pre-existing `// exact-match contract — Phase 43 D-08`) removed entirely** rather than re-written. The new banner comment at the top of the `for` body supersedes it with the Phase 49 EDGE-01 convention.

---

## Deviations from Plan

### Rule 3 — Auto-fixed blocking issue

**1. Added `RPNode` type import to the regression test file**
- **Found during:** Task 3 action step 3 (inline ProtocolGraph construction).
- **Issue:** The plan's inline graph snippet uses `new Map<string, RPNode>([...])` but the test file only imported `ProtocolGraph` from `graph-model`. TypeScript strict mode would reject the Map constructor without the concrete node type.
- **Fix:** Extended the existing `import type { ProtocolGraph } from '../../graph/graph-model';` to `import type { ProtocolGraph, RPNode } from '../../graph/graph-model';`. The plan explicitly anticipated this in its action step 4: _"If the test file does not already import `ProtocolGraph`, `RPNode` types from `../../graph/graph-model`, add those imports at the top of the file (only if missing)."_ Took the "only if missing" branch — added `RPNode` alone since `ProtocolGraph` was already imported.
- **Files modified:** `src/__tests__/runner/protocol-runner-loop-picker.test.ts` (within Task 3 commit `c5c1729`).
- **Commit:** `c5c1729`.
- **Rule:** Rule 3 (blocking — tsc would have failed otherwise). Documented per plan's anticipation, so technically not even a deviation — but logged here for bookkeeping.

### Rule 2 — Completed required ProtocolGraph shape

**2. Added `canvasFilePath`, `reverseAdjacency`, `startNodeId` to the inline graph**
- **Found during:** Task 3 action step 3 (inline ProtocolGraph construction).
- **Issue:** The plan's `<action>` snippet at step 3 showed a partial ProtocolGraph with only `nodes`, `edges`, and `adjacency` fields. The real `ProtocolGraph` interface (`src/graph/graph-model.ts:125-132`) also requires `canvasFilePath: string`, `reverseAdjacency: Map<string, string[]>`, and `startNodeId: string`. Without these fields, tsc would reject the factory return type as incompatible with `ProtocolGraph`.
- **Fix:** Extended the inline factory to populate all six fields. `canvasFilePath: 'test:phase-49-d05.canvas'` (synthetic path, not on disk; convention borrowed from `canvas-parser.test.ts` `virtual:` prefix). `reverseAdjacency` manually mirrors `adjacency`. `startNodeId: 'n-start'`.
- **Files modified:** `src/__tests__/runner/protocol-runner-loop-picker.test.ts` (within Task 3 commit `c5c1729`).
- **Commit:** `c5c1729`.
- **Rule:** Rule 2 (correctness — the factory must actually return a valid `ProtocolGraph`). Plan's snippet was illustrative; required fields are structural.

No other deviations. Tasks 1 and 2 executed exactly as the plan's `<action>` blocks specified. Task 3 was executed with the two scope completions above.

---

## Deferred Issues

None. No out-of-scope findings were logged.

---

## Known Stubs

None. Plan 49-03's runtime + view scope is complete end-to-end. The 7 red tests are Plan-04-dependent (fixture label stripping + new fixture creation) and are not stubs — the production code is fully wired to the new convention; only the test fixture data still describes the pre-Phase-49 shape.

---

## TDD Gate Compliance

Plans 49-03's three tasks carry `tdd="true"` (Task 1, Task 2) and `type="auto"` (Task 3) frontmatter. However, Tasks 1 and 2 are behaviour-preserving refactors against pre-existing test coverage (`protocol-runner-loop-picker.test.ts` RUN-01..RUN-05, W4, RUNFIX-01 Tests 1-4) — the plan's `<behavior>` block for Task 1 explicitly states: _"All existing tests in `protocol-runner-loop-picker.test.ts` RUN-01..RUN-05 continue to pass because the fixtures use `"выход"` which is a valid non-empty label."_ A literal TDD RED phase would have made no sense (pre-existing tests pass against the old dispatch). The real new-behaviour proof lives in Task 3's regression tests, which were added GREEN (they pass immediately because Tasks 1 and 2 already shipped).

**Gate sequence in `git log`:**
- `98df8ee` refactor(49-03): dispatch swap (Task 1)
- `0846db2` refactor(49-03): view rewire (Task 2)
- `c5c1729` test(49-03): regression tests (Task 3 — new green tests documenting the D-05 contract)

No `feat(...)` or `test(...)` commit precedes the refactors — the RED/GREEN framing does not apply to behaviour-preserving rewiring against pre-existing coverage. Downstream auditors looking for a TDD gate pair will find Task 3's `c5c1729` as the behaviour-proof commit (two new tests that exercise the Phase 49 D-05/D-08 contract against any future regression).

---

## Threat Model Coverage

Both STRIDE threats from the plan's `<threat_model>` are addressed:

- **T-49-03-01 (Information Disclosure, body-button caption via `nodeLabel(target)`):** Accepted per plan. The returned string is bounded (`text-block` arm caps at 30 chars via `content.slice(0, 30)`; `snippet` shows `subfolderPath` only, never file contents; `answer` uses `displayLabel ?? answerText` bounded by author input). Rendered via Obsidian's `createEl({ text })` which text-nodes the string — no HTML injection path. Same disclosure surface as the existing validator error messages (D-04 path).
- **T-49-03-02 (Tampering, exit dispatch via `isExitEdge`):** Mitigated. `isExitEdge` / `isLabeledEdge` trim the label before checking emptiness, so whitespace-only labels cannot bypass the uniqueness invariant enforced by GraphValidator LOOP-04. Validator + runtime share the same predicate (Plan 49-01 `src/graph/node-label.ts`), guaranteeing lock-step.

No new threat flags surfaced during implementation — no new trust boundaries, no new network/auth/file-access surface.

---

## Self-Check: PASSED

- `src/runner/protocol-runner.ts` — FOUND (modified)
- `src/views/runner-view.ts` — FOUND (modified)
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — FOUND (modified)
- Commit `98df8ee` — FOUND (`git log --oneline` line 1)
- Commit `0846db2` — FOUND (`git log --oneline` line 2)
- Commit `c5c1729` — FOUND (`git log --oneline` line 3)
- TypeScript `--noEmit --skipLibCheck` exit 0 ✓
- All 20 grep acceptance criteria pass ✓
- 459 passed / 1 skipped / 7 failed — all 7 failures are plan-documented (3 pre-existing from Plan 02 + 4 new Plan-04-dependent) ✓
- 2 new Phase 49 D-05/D-08 regression tests green ✓
- No unintended file deletions (`git diff --diff-filter=D --name-only 98df8ee~1 HEAD` → empty) ✓
- Click-handler ordering preservation in `runner-view.ts:489-495` confirmed visually + by `capturePendingTextareaScroll` grep count (5, unchanged) ✓
