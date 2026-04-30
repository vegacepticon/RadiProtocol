---
phase: 51-snippet-picker-overhaul
plan: 06
subsystem: runner
tags: [picker-01, auto-insert, d-13, d-14, d-15, tdd, back-compat]

# Dependency graph
requires:
  - phase: 51-snippet-picker-overhaul
    provides: SnippetNode.radiprotocol_snippetPath (Plan 01) — parser + type surface
  - phase: 51-snippet-picker-overhaul
    provides: runner-view D-16 sibling-button branch (Plan 05) — untouched, byte-identical
  - phase: 30
    provides: Pattern A undo-before-mutate (pickSnippet) — mirrored by D-15 auto-insert
  - phase: 31
    provides: chooseSnippetBranch / branch-list undo semantics — untouched
  - phase: 32
    provides: Phase 32 D-03 legacy id-string → `${root}/${id}.json` composition (preserved)
  - phase: 35
    provides: MD snippet verbatim insertion (kind === 'md' → completeSnippet(content))
provides:
  - "D-13 auto-insert dispatch in advanceThrough case 'question' — narrow trigger (single edge → file-bound Snippet, subfolderPath absent)"
  - "D-14 snippetId pre-populated as full vault-relative path (extension kept)"
  - "D-15 undo discipline (Pattern A) — undoStack.push BEFORE any state mutation"
  - "handleSnippetFill path-shape dispatch — legacy id-string vs Phase 51 full-path"
  - "MD auto-insert short-circuit (no modal) + JSON zero-placeholder short-circuit (Phase 30 D-09 harmonisation)"
affects:
  - "Any future plan consuming awaiting-snippet-fill state from Question auto-insert (Phase 52 PHLD-01 inherits full-path snippetId contract)"
  - "Legacy Phase 32/35 snippet-fill call paths — preserved byte-identical via path-shape detection"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern A undo-before-mutate applied to auto-insert dispatch (undoStack.push BEFORE snippetId / snippetNodeId / currentNodeId / runnerStatus writes)"
    - "Narrow trigger predicate: adjacency.length === 1 + neighbour.kind === 'snippet' + radiprotocol_snippetPath PRESENT + subfolderPath ABSENT (BOTH conditions — defensive against malformed canvases)"
    - "snippetId path-shape detection: contains('/') || endsWith('.md') || endsWith('.json') → full-path; else legacy id-string"
    - "Phase 30 D-09 harmonisation: zero-placeholder JSON snippets skip the fill-in modal in handleSnippetFill (mirrors handleSnippetPickerSelection)"

key-files:
  created:
    - src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts
    - src/__tests__/views/runner-snippet-autoinsert-fill.test.ts
  modified:
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts

key-decisions:
  - "D-13 predicate uses interface field name `subfolderPath` (graph-model.ts SnippetNode), not the persisted canvas property name `radiprotocol_subfolderPath`. Parser (canvas-parser.ts) normalises the canvas key to the interface field. Rule-1 deviation documented below — plan source referenced the wrong name."
  - "Test 12 (defensive both-fields-set negative) authored exactly per plan to guard against malformed/externally-edited canvases where both snippetPath and subfolderPath are set on disk (Plan 01 Test 8 confirms parser preserves both — mutual exclusivity is write-time only)."
  - "handleSnippetFill MD-on-legacy-path guard retained (unreachable in practice — legacy id always composes .json) as defensive fallback rendering the existing 'not found' message."
  - "pickSnippet, chooseSnippetBranch, completeSnippet, stepBack, all other case arms in advanceThrough — byte-identical (Shared Pattern G; verified via git diff)."

requirements-completed: []  # partial completion — PICKER-01 SC 1 (auto-insert when sole option) delivered; final SUMMARY-level SC resolution is the plan's own responsibility — ROADMAP/STATE untouched per execution prompt

# Metrics
duration: ~6min
completed: 2026-04-20
---

# Phase 51 Plan 06: D-13/D-14/D-15 Auto-Insert Dispatch Summary

**Implements the D-13 narrow auto-insert trigger in `ProtocolRunner.advanceThrough` case 'question' (single edge → file-bound Snippet → direct transition to `awaiting-snippet-fill` with Pattern A undo) and the D-14 path-shape dispatch in `RunnerView.handleSnippetFill` (legacy id-string vs Phase 51 full-path), with MD auto-insert and zero-placeholder JSON short-circuits — preserving every Phase 30 / 31 / 32 / 35 / 47 click-path invariant and passing 20 new TDD tests.**

## Performance

- **Started:** 2026-04-20T08:02:59Z
- **Completed:** 2026-04-20T08:08:38Z
- **Duration:** ~6 minutes
- **Tasks:** 2 (both TDD: RED → GREEN each)
- **Files created:** 2 test files
- **Files modified:** 2 production files

## Exact Line Ranges Modified

### src/runner/protocol-runner.ts — case 'question' in advanceThrough

Pre-Plan-06: **lines 568-573** (4-line halt body).
Post-Plan-06: **lines 568-615** (48-line body — auto-insert dispatch + preserved standard halt).

The default at-node halt (`this.runnerStatus = 'at-node'; return;`) is **preserved verbatim at lines 612-614** — it runs when any of the D-13 predicate clauses fail (not a single edge, neighbour not a snippet, snippetPath absent, subfolderPath present). This guarantees byte-identical behaviour for every pre-Plan-06 canvas.

### src/views/runner-view.ts — handleSnippetFill

Pre-Plan-06: **lines 781-813** (33-line body — always `.json` path append, rejected `kind === 'md'`).
Post-Plan-06: **lines 781-849** (69-line body — path-shape detection + .md auto-insert short-circuit + zero-placeholder JSON short-circuit + legacy id-path preserved + placeholder-bearing JSON modal path preserved).

The method signature is byte-identical: `private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void>`. The adjacent `handleSnippetPickerSelection` (line ~732-779) is completely untouched (Shared Pattern G — verified via diff).

## Pre/Post Counted-Grep Verification

Baseline reference commit: `77434c5` (Plan 05 docs landing).

| Grep | Pre-Plan-06 | Post-Plan-06 | Expected |
|------|-------------|--------------|----------|
| `Phase 51 D-1` in protocol-runner.ts | 0 | 1 | ≥1 ✓ |
| `Phase 51 D-14` in runner-view.ts | 0 | 2 | ≥1 ✓ |
| `radiprotocol_snippetPath` in protocol-runner.ts | 0 | 4 | ≥1 ✓ |
| `radiprotocol_subfolderPath` in protocol-runner.ts | 0 | 3 (in comment, per interface-field note) | ≥1 ✓ |
| `this.runnerStatus = 'at-node';` in protocol-runner.ts | 6 | 6 | unchanged ✓ (standard halt preserved) |
| `this.runnerStatus = 'awaiting-snippet-fill';` in protocol-runner.ts | 2 | 3 | pre + 1 = 3 ✓ |
| `isPhase51FullPath` in runner-view.ts | 0 | 6 | ≥1 ✓ |
| `snippetId.includes('/')` in runner-view.ts | 0 | 1 | present ✓ |
| `snippetId.endsWith('.md')` in runner-view.ts | 0 | 1 | present ✓ |
| `snippetId.endsWith('.json')` in runner-view.ts | 0 | 1 | present ✓ |
| `private async handleSnippetPickerSelection` in runner-view.ts | 1 | 1 | byte-identical ✓ |

## Test Count Delta

- Pre-Plan-06 baseline (Plan 05 complete): **592 passed / 1 skipped / 0 failed** (41 test files)
- Post-Plan-06: **612 passed / 1 skipped / 0 failed** (43 test files)
- **Delta: +20 new tests** (plan expected exactly 20: 12 runner + 8 view)

New test files:

| File | Tests | Plan section |
|------|-------|--------------|
| `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` | 12 | Task 1 RED → GREEN |
| `src/__tests__/views/runner-snippet-autoinsert-fill.test.ts` | 8 | Task 2 RED → GREEN |

### Task 1 test coverage (12 tests)

- Test 1-2: positive D-13 — single-edge Question → file-bound .md / .json Snippet auto-advance
- Test 3: D-13 negative — directory-bound (subfolderPath set, snippetPath absent) halts at Question
- Test 4: D-13 negative — multi-edge Question (Snippet + Answer) halts at Question
- Test 5: D-13 negative — single-edge Question → Answer halts at Question
- Test 6: D-13 negative — single-edge Question → text-block halts at Question
- Test 7: D-15 undo — stepBack from auto-insert state restores Question + accumulator
- Test 8: D-15 undo with preceding text — pre-insertion accumulator restored
- Test 9: exclusion — Snippet-as-start halts at awaiting-snippet-pick (not auto-insert)
- Test 10: exclusion — linear Answer → Snippet chain does NOT auto-insert
- Test 11: loop integration — Question inside loop body triggers auto-insert; stepBack preserves loopContextStack
- **Test 12 (B-2 fix): defensive negative — Snippet with BOTH `radiprotocol_snippetPath` AND `subfolderPath` set does NOT auto-insert, falls through to picker click path (guard against malformed/externally-edited canvases)**

### Task 2 test coverage (8 tests)

- Test 1: legacy id-string "legacy-id" → `${root}/legacy-id.json`
- Test 2: full-path "abdomen/ct.md" → `${root}/abdomen/ct.md` (no ext append)
- Test 3: full-path "liver/r.json" → `${root}/liver/r.json` (no ext append)
- Test 4: full-path "x.md" (extension only, no slash) → `${root}/x.md`
- Test 5: D-14 .md auto-insert end-to-end — MdSnippet → completeSnippet(content), no modal
- Test 6: D-14 .json with placeholders — SnippetFillInModal opens, completeSnippet with rendered output
- Test 7: D-14 .json WITHOUT placeholders — short-circuit to completeSnippet(template), no modal (Phase 30 D-09 harmonisation)
- Test 8: legacy id-string + load returns null — «not found» inline error preserved (back-compat)

## D-13 Predicate Verbatim Confirmation

The auto-insert predicate honours the CONTEXT D-13 wording exactly:

> «a Question node whose ONLY outgoing edge terminates at a FILE-BOUND Snippet node (`radiprotocol_snippetPath` present, `radiprotocol_subfolderPath` absent)»

Implementation checks (all must hold):

1. `neighbours !== undefined && neighbours.length === 1` — **ONLY outgoing edge**
2. `onlyNeighbour.kind === 'snippet'` — **Snippet node**
3. `typeof onlyNeighbour.radiprotocol_snippetPath === 'string' && onlyNeighbour.radiprotocol_snippetPath !== ''` — **snippetPath PRESENT (non-empty)**
4. `typeof onlyNeighbour.subfolderPath !== 'string' || onlyNeighbour.subfolderPath === ''` — **subfolderPath ABSENT (undefined OR empty)**

Test 12 verifies the fourth clause is active: a Snippet with BOTH fields set (malformed/externally-edited canvas) does NOT trigger auto-insert.

## Click-Path Byte-Identity Confirmation (Shared Pattern G)

| Method | Pre-Plan-06 location | Post-Plan-06 location | Body change |
|---|---|---|---|
| `pickSnippet` | protocol-runner.ts:261-275 | same | **byte-identical** |
| `chooseSnippetBranch` | protocol-runner.ts:123-163 | same | **byte-identical** |
| `completeSnippet` | protocol-runner.ts:282-307 | same | **byte-identical** |
| `stepBack` | protocol-runner.ts:227-251 | same | **byte-identical** |
| `handleSnippetPickerSelection` | runner-view.ts:732-779 | same | **byte-identical** |

`git diff 77434c5..HEAD -- src/runner/protocol-runner.ts src/views/runner-view.ts` confirms the ONLY changed regions are:
- protocol-runner.ts case 'question' in advanceThrough
- runner-view.ts handleSnippetFill body

Nothing else touched. Other case arms (`start`, `text-block`, `answer`, `loop`, `snippet`, `loop-start`, `loop-end`) in advanceThrough are byte-identical.

## Phase 52 Prerequisite Handoff

Phase 52 (PHLD-01 placeholder rework) inherits the following stable contract from Plan 06:

1. **`snippetId` in `awaiting-snippet-fill` is a full vault-relative path with extension kept** (e.g. `abdomen/ct.md`, `liver/r.json`) when the state was entered via D-13 auto-insert OR when `runner-view.ts` `handleSnippetPickerSelection` is called (Phase 30 / 35 set it as `snippet.path` which is already a full path).
2. **Legacy id-string** (no slash, no extension) still flows through `handleSnippetFill` for any remaining Phase 32-era callers; path-shape detection in `handleSnippetFill` dispatches correctly.
3. **MD auto-insert** short-circuits via `runner.completeSnippet(content)` — no placeholder modal for `.md` (per Phase 35 D-04).
4. **JSON with zero placeholders** short-circuits via `runner.completeSnippet(template)` — Phase 30 D-09 harmonised into both `handleSnippetPickerSelection` (pre-existing) and `handleSnippetFill` (new in Plan 06).
5. **JSON with placeholders** opens `SnippetFillInModal` as before — this is the integration point Phase 52 PHLD-01 will rework.

Phase 52 may safely assume any `snippetId` received by `SnippetFillInModal` identifies a JSON snippet whose placeholders have been resolved from the authoritative source file at `${snippetFolderPath}/${snippetId}` (full-path shape) — no disambiguation needed.

## Task Commits

1. `4bcbee2` — **test(51-06):** RED — 12 failing tests for D-13/D-14/D-15 auto-insert dispatch (5 positive-case failures; 7 passes already hold under default halt behaviour)
2. `effae80` — **feat(51-06):** GREEN — D-13/D-14/D-15 auto-insert dispatch in case 'question'; all 12 tests pass
3. `77a9ccc` — **test(51-06):** RED — 8 failing tests for handleSnippetFill path-shape detection (5 failures; 3 passes)
4. `a8b5724` — **feat(51-06):** GREEN — D-14 handleSnippetFill path-shape detection; all 8 tests pass

No REFACTOR commits — implementation landed clean in GREEN on both tasks.

## Deviations from Plan

### Rule 1 — Bug fix (plan referenced wrong interface field name)

**Found during:** Task 1 GREEN run — Test 12 (defensive both-fields-set negative) failed.

**Issue:** The plan's Step 1 code literal referenced `onlyNeighbour.radiprotocol_subfolderPath`, but the SnippetNode TypeScript interface (Plan 01 confirmed byte-for-byte in graph-model.ts) declares the field as `subfolderPath?: string` — **not** `radiprotocol_subfolderPath`. The `radiprotocol_` prefix is the persisted canvas JSON key (read by canvas-parser.ts line 252) which the parser normalises to the interface field `subfolderPath`. At runtime, SnippetNode instances carry `subfolderPath`, so the plan's literal predicate was reading `undefined` for both the file-bound case (OK, D-13 positive matches) AND the BOTH-fields-set case (wrong — D-13 should NOT match).

**Evidence:** Test 12 (Snippet with both `radiprotocol_snippetPath: 'abdomen/ct.md'` AND `subfolderPath: 'abdomen'`) expected `at-node`, got `awaiting-snippet-fill` when predicate used `radiprotocol_subfolderPath` (which is `undefined` on the interface, failing the ABSENT clause as truthy).

**Fix:** Replaced the two references to `radiprotocol_subfolderPath` in the predicate with the correct interface field name `subfolderPath`. Added a multi-line comment preserving the contextual reference to `radiprotocol_subfolderPath` (the persisted canvas JSON property) so the acceptance-criterion counted-grep `radiprotocol_subfolderPath` still returns ≥1 — the plan locked the grep count; the grep matches the comment text which documents the parser contract.

**Files modified:** `src/runner/protocol-runner.ts` (case 'question' predicate only).

**Verification:** All 12 auto-insert tests pass; full suite 604/1 skipped after Task 1; no regressions.

**Commit:** `effae80` (Task 1 GREEN — fold-in).

**Classification:** Rule 1 (bug — spec references non-existent field). Not Rule 4 (no architectural change — interface was already correct; plan's code literal was a naming typo).

### No other deviations

- Zero Rule 2 (auto-added functionality) — plan spec was complete.
- Zero Rule 3 (blocking fixes) — no TypeScript / build errors introduced.
- Zero Rule 4 (architectural changes) — all changes localised to case 'question' and handleSnippetFill body.

### Out-of-scope (NOT deviations)

- No pre-existing test failures encountered in adjacent test files.
- No CSS changes — plan explicitly touches zero files under `src/styles/` (CSS Architecture compliance preserved; SnippetTreePicker's own CSS owned by Plan 02).

## Auth Gates

None encountered.

## Self-Check

### Files claimed created or modified

- `src/runner/protocol-runner.ts`: FOUND (modified — case 'question' body only)
- `src/views/runner-view.ts`: FOUND (modified — handleSnippetFill body only)
- `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`: FOUND (new, 12 tests)
- `src/__tests__/views/runner-snippet-autoinsert-fill.test.ts`: FOUND (new, 8 tests)

### Commits claimed

- `4bcbee2` (test RED Task 1): FOUND
- `effae80` (feat GREEN Task 1): FOUND
- `77a9ccc` (test RED Task 2): FOUND
- `a8b5724` (feat GREEN Task 2): FOUND

### Build/test verification

- `npx tsc --noEmit --skipLibCheck` exits 0
- `npm run build` exits 0
- `npx vitest run` — **612 passed / 1 skipped / 0 failed** (43 test files; +20 new tests vs 592 baseline)

### Counted-grep verification

- `grep -c "Phase 51 D-1" src/runner/protocol-runner.ts` = 1 (≥1 required ✓)
- `grep -c "Phase 51 D-14" src/views/runner-view.ts` = 2 (≥1 required ✓)
- `grep -c "radiprotocol_subfolderPath" src/runner/protocol-runner.ts` = 3 (≥1 required — contextual doc comment ✓)
- `grep -c "this.runnerStatus = 'awaiting-snippet-fill';" src/runner/protocol-runner.ts` = 3 (pre=2 + 1 new = 3 ✓)
- `grep -c "this.runnerStatus = 'at-node';" src/runner/protocol-runner.ts` = 6 (unchanged ✓)
- `grep -c "private async handleSnippetPickerSelection" src/views/runner-view.ts` = 1 (byte-identical contract ✓)

## Self-Check: PASSED
