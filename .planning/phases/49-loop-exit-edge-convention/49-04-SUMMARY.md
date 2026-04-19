---
phase: 49
plan: 04
subsystem: test-fixtures
tags: [phase-49, loop-exit-edge-convention, fixtures, audit]
requires:
  - Plan 49-02 (GraphValidator LOOP-04 rewire + test assertions referencing stray-body-label fixture)
  - Plan 49-03 (ProtocolRunner + RunnerView rewire consuming isExitEdge)
provides:
  - unified-loop-{valid,nested,long-body,missing-exit}.canvas aligned to Phase 49 D-05/D-09 convention (body edges unlabeled)
  - unified-loop-stray-body-label.canvas NEW fixture exercising D-02 (≥2 labeled outgoing edges)
  - Test suite fully green — 7 previously-expected red tests flipped (3 validator tests from Plan 02 + 4 runner tests from Plan 03)
affects:
  - src/__tests__/fixtures/unified-loop-valid.canvas — e2 label stripped
  - src/__tests__/fixtures/unified-loop-nested.canvas — e2 + e4 labels stripped
  - src/__tests__/fixtures/unified-loop-long-body.canvas — e2 label stripped
  - src/__tests__/fixtures/unified-loop-missing-exit.canvas — e2 label stripped
  - src/__tests__/fixtures/unified-loop-stray-body-label.canvas — created
tech-stack:
  added: []
  patterns:
    - "D-20 fixture audit: strip stray body-edge labels on 'valid-intent' fixtures so they match the Phase 49 D-05 one-labeled-exit convention"
    - "D-16 fixture creation: new unified-loop-stray-body-label.canvas triggers D-02 (≥2 labeled outgoing) with a recognisable 'проверка + выход' shape"
key-files:
  created:
    - src/__tests__/fixtures/unified-loop-stray-body-label.canvas
  modified:
    - src/__tests__/fixtures/unified-loop-valid.canvas
    - src/__tests__/fixtures/unified-loop-nested.canvas
    - src/__tests__/fixtures/unified-loop-long-body.canvas
    - src/__tests__/fixtures/unified-loop-missing-exit.canvas
decisions:
  - "D-20: stripped only the minimal required — single property removal '\"label\": \"проверка\"' per body edge, preserving column spacing where possible (double-space after closing quote of toNode where alignment allowed)"
  - "unified-loop-missing-exit.canvas: stripped per audit_detail decision — fixture now cleanly exercises D-01 (zero labeled) instead of the ambiguous D-03 path that the pre-audit label would have caused"
  - "unified-loop-duplicate-exit.canvas + unified-loop-no-body.canvas: NOT TOUCHED — they exercise D-02 (3 labeled) and D-03 (0 unlabeled) respectively under the new convention without modification"
  - "New fixture style: nodes + edges copied verbatim from unified-loop-duplicate-exit.canvas (same author style, same column alignment, same radiprotocol_* property names)"
metrics:
  duration: ~1.5 minutes (wall clock 09:28:23Z → 09:29:47Z)
  completed: 2026-04-19
  tasks: 2/2
  files_created: 1
  files_modified: 4
  commits: 2
  tests_added: 0
  tests_modified: 0
---

# Phase 49 Plan 04: Fixture Audit Summary

**One-liner:** Stripped stray `"label": "проверка"` from body-meant edges on 4 `unified-loop-*.canvas` fixtures and created `unified-loop-stray-body-label.canvas` — aligning the fixture corpus with the Phase 49 D-05 "labeled = exit" convention and flipping all 7 previously-expected red tests green (466 passed / 0 failed; was 459 / 7 before).

---

## What Changed

### Modified — `src/__tests__/fixtures/unified-loop-valid.canvas`

**Line 11 diff (single property removal on e2):**
- Before: `{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1",   "label": "проверка" },`
- After:  `{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1" },`

`n-loop` now has exactly 1 labeled outgoing (`e3` → `"выход"`) and 1 unlabeled body edge (`e2`). Satisfies D-05/D-09; flips the happy-path LOOP-04 test green and restores the RUN-03/RUN-02 body-walk dispatch test behaviour.

### Modified — `src/__tests__/fixtures/unified-loop-nested.canvas`

**Two-line diff (e2 outer body + e4 inner body):**
- Line 12 before: `{ "id": "e2", "fromNode": "n-outer",   "toNode": "n-inner",   "label": "проверка" },`
- Line 12 after:  `{ "id": "e2", "fromNode": "n-outer",   "toNode": "n-inner" },`
- Line 14 before: `{ "id": "e4", "fromNode": "n-inner",   "toNode": "n-inner-q", "label": "проверка" },`
- Line 14 after:  `{ "id": "e4", "fromNode": "n-inner",   "toNode": "n-inner-q" },`

Both loop nodes (`n-outer` / `n-inner`) now have exactly 1 labeled outgoing (`e3` / `e5` → `"выход"`) + 1 unlabeled body edge (`e2` / `e4`). Preserves nested-loop topology; flips RUN-04.

### Modified — `src/__tests__/fixtures/unified-loop-long-body.canvas`

**Line 19 diff (e2 body):**
- Before: `{ "id": "e2",  "fromNode": "n-loop",  "toNode": "n-t01",  "label": "проверка" },`
- After:  `{ "id": "e2",  "fromNode": "n-loop",  "toNode": "n-t01" },`

`n-loop` now has exactly 1 labeled (`e3` → `"выход"`) + 1 unlabeled body (`e2`, kicking off the 10-step body chain). Flips W4 long-body.

### Modified — `src/__tests__/fixtures/unified-loop-missing-exit.canvas`

**Line 10 diff (e2 — sole outgoing):**
- Before: `{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1",   "label": "проверка" },`
- After:  `{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1" },`

`n-loop` now has 0 labeled outgoing + 1 unlabeled → cleanly exercises **D-01** (zero labeled). Matches Plan 02 Task 2's D-01 assertion `не имеет выхода`. Per the plan's `<audit_detail>`, without this strip the fixture would ambiguously hit D-03 instead of the intended D-01.

### Created — `src/__tests__/fixtures/unified-loop-stray-body-label.canvas`

New 16-line fixture (~1.3 KB). Style (columns, node positions, `radiprotocol_*` property names) copied verbatim from `unified-loop-duplicate-exit.canvas`.

**Nodes:** `n-start` (start) → `n-loop` (loop, headerText "Lesion loop") → `n-q1` (question "Size?") → `n-a1` (answer "1 cm") → `n-end` (text-block "Done").

**Edges (5 total; 2 labeled outgoing on n-loop triggers D-02):**
- `e1` `n-start` → `n-loop` (unlabeled)
- `e2` `n-loop` → `n-q1` **`label: "проверка"`** (stray body label)
- `e3` `n-loop` → `n-end` **`label: "выход"`** (legit exit)
- `e4` `n-q1` → `n-a1` (unlabeled)
- `e5` `n-a1` → `n-loop` (unlabeled back-edge)

Under Phase 49 D-05: `n-loop` has 2 labeled outgoing edges → D-02 fires listing `e2, e3`. Referenced by the Plan 49-02 test `unified-loop-stray-body-label.canvas flags a second labeled edge (Phase 49 D-02 + D-16)` which asserts `несколько помеченных исходящих рёбер` + both edge ids.

### NOT TOUCHED (explicitly preserved)

- `unified-loop-duplicate-exit.canvas` — still carries its three labeled outgoing on `n-loop` (`e2` "проверка" + `e3` "выход" + `e4` "выход"). Under D-05 this cleanly fires D-02 listing all three edge ids (the Plan 02 D-02 duplicate-exit test asserts `e2`, `e3`, `e4`). Leaving it alone preserves the triple-id assertion and the fixture's "duplicate exit" intent under the widened semantics.
- `unified-loop-no-body.canvas` — has only `e2` labeled `"выход"` from `n-loop`; under D-05/D-09 that's 1 labeled + 0 unlabeled → D-03 fires. Intent preserved.
- All other `.canvas` fixtures under `src/__tests__/fixtures/` — untouched.

---

## Verification

| Gate | Command | Result |
|------|---------|--------|
| JSON parse (all 4 edited + 1 new) | `node -e "[...].forEach(n => JSON.parse(require('fs').readFileSync(...)))"` | **exit 0** ✓ |
| Stray-body-label fixture shape | `node -e "... outgoing n-loop labeled=2"` | **OK: 2 outgoing edges, 2 labeled** ✓ |
| TypeScript | `npx tsc --noEmit --skipLibCheck` | **exit 0** (clean) |
| Full test suite | `npx vitest run` | **466 passed / 1 skipped / 0 failed** (34 files) ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-valid.canvas` | | **0** ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-nested.canvas` | | **0** ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-long-body.canvas` | | **0** ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-missing-exit.canvas` | | **0** ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-stray-body-label.canvas` | | **1** (e2 stray) ✓ |
| `grep -c "\"label\": \"проверка\"" unified-loop-duplicate-exit.canvas` | | **1** (preserved — exercises D-02 triple) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-valid.canvas` | | **1** (e3 exit) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-nested.canvas` | | **2** (e3 + e5) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-long-body.canvas` | | **1** (e3) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-no-body.canvas` | | **1** (preserved) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-duplicate-exit.canvas` | | **2** (preserved) ✓ |
| `grep -c "\"label\": \"выход\"" unified-loop-stray-body-label.canvas` | | **1** (e3 exit) ✓ |
| `grep -c "\"label\":" unified-loop-missing-exit.canvas` | | **0** ✓ (no labels) |
| Fixture inventory `src/__tests__/fixtures/unified-loop-*.canvas` | `ls` | **7 files** (6 → 7) ✓ |

### Previously-expected failures (all flipped green by this plan)

Baseline after Plan 03: **459 passed / 7 failed**. After Plan 04: **466 passed / 0 failed**. Delta = +7 green, zero new failures, zero new skips.

From Plan 02 SUMMARY (validator-side reds — now green):

1. ✓ `unified-loop-valid.canvas passes LOOP-04 checks` — e2 now unlabeled, D-02 no longer fires.
2. ✓ `unified-loop-missing-exit.canvas flags zero labeled outgoing edges` — e2 now unlabeled, D-01 fires correctly.
3. ✓ `unified-loop-stray-body-label.canvas flags a second labeled edge` — fixture now exists.

From Plan 03 SUMMARY (runner-side reds caused by D-05 dispatch meeting still-labeled fixtures — now green):

4. ✓ `RUN-02: body-branch walks the branch; back-edge re-entry ...` — e2 in unified-loop-valid now unlabeled → body-walk path restored.
5. ✓ `RUN-04: nested loops — inner «выход» returns to outer picker ...` — e2/e4 in unified-loop-nested now unlabeled → nested body-walk restored.
6. ✓ `W4: long-body loop iterates 10 times without tripping RUN-09 ...` — e2 in unified-loop-long-body now unlabeled → 10-step body chain traversed.
7. ✓ `loopContextStack with iteration=2 survives JSON round-trip (SESSION-05)` — e2 in unified-loop-valid now unlabeled → iteration=2 snapshot setup works.

---

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `9fcbb03` | chore | chore(49-04): strip stray 'проверка' body-edge labels from 4 unified-loop fixtures |
| 2 | `2889d68` | feat | feat(49-04): add unified-loop-stray-body-label.canvas fixture for D-02 coverage |

Diff sizes: `9fcbb03` (+5/-5 across 4 files — single property removed per body edge), `2889d68` (+16/-0, new 16-line fixture). Total: +21/-5 across 5 files.

---

## Decisions Made

1. **Commit type `chore` for Task 1** — fixture data cleanup to match the Phase 49 convention locked in Plans 01-03. No feature, no fix, no test addition — pure data alignment. `chore` is the most semantically honest type per Conventional Commits (test code path + assertions untouched; only the inputs those tests parse changed).

2. **Commit type `feat` for Task 2** — the new fixture is a net-new test input asset. Plan 02's assertion `parseFixture('unified-loop-stray-body-label.canvas')` was previously raising ENOENT; this plan "feat"-enables that test. Contrast with `chore` on Task 1 which only cleans existing data.

3. **Column-alignment preservation** — per plan's `<action>` "preserve column alignment where possible by using a double-space after the property removal". Applied verbatim: `"toNode": "n-q1" },` retains the double-space before the closing brace where the original had `"toNode": "n-q1",   "label":` with similar alignment. Keeps visual diff minimal.

4. **`unified-loop-missing-exit.canvas` stripped (not left) per audit_detail** — plan's initial audit_table said "LEAVE ALONE" but `<audit_detail>` explicitly resolved to STRIP so the fixture cleanly exercises D-01. Followed the resolution.

---

## Deviations from Plan

**None.** Tasks 1 and 2 executed exactly as the plan's `<action>` blocks specified. Zero auto-fixes required. Zero Rule 4 escalations. Zero blocking issues. Zero architectural questions. Full test suite green on first run after the two commits.

---

## Deferred Issues

None. No out-of-scope findings were logged.

---

## Known Stubs

None. The fixture corpus is now fully aligned with the Phase 49 convention; every `unified-loop-*.canvas` fixture expresses a cleanly-testable scenario (happy path / nested / long-body / D-01 / D-02 duplicate / D-02 stray / D-03).

---

## Threat Model Coverage

No threats applicable per plan's `<threat_model>` block: _"Fixtures are test-only JSON. No trust boundary. Out of STRIDE scope."_ No threat flags surfaced during implementation — no new trust boundaries, no new network/auth/file-access surface.

---

## Self-Check: PASSED

- `src/__tests__/fixtures/unified-loop-valid.canvas` — FOUND (modified, e2 unlabeled)
- `src/__tests__/fixtures/unified-loop-nested.canvas` — FOUND (modified, e2 + e4 unlabeled)
- `src/__tests__/fixtures/unified-loop-long-body.canvas` — FOUND (modified, e2 unlabeled)
- `src/__tests__/fixtures/unified-loop-missing-exit.canvas` — FOUND (modified, e2 unlabeled; 0 total labels)
- `src/__tests__/fixtures/unified-loop-stray-body-label.canvas` — FOUND (created, 2 labeled outgoing on n-loop)
- `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` — FOUND, NOT modified ✓
- `src/__tests__/fixtures/unified-loop-no-body.canvas` — FOUND, NOT modified ✓
- Commit `9fcbb03` — FOUND (`git log --oneline`)
- Commit `2889d68` — FOUND (`git log --oneline`)
- TypeScript `--noEmit --skipLibCheck` exit 0 ✓
- Full test suite 466 passed / 1 skipped / 0 failed ✓
- All 17 grep acceptance criteria pass ✓
- 7/7 previously-expected red tests flipped green; zero new failures; zero new skips ✓
- No unintended file deletions (`git diff --diff-filter=D --name-only 9fcbb03~1 HEAD` → empty) ✓
