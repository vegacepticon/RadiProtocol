---
phase: 44-unified-loop-runtime
plan: 04
subsystem: legacy-cleanup
tags: [cleanup, settings, legacy-excision, run-07]

# Dependency graph
requires:
  - phase: 43 (unified-loop-graph-model-parser-validator-migration-errors) — `LoopStartNode` interface still in `RPNodeKind` union (D-CL-05 variant b) so editor-panel switch must continue to handle it
  - plan: 44-01 (Wave 0 scaffolding) — no direct artifact use, but sibling-plan ordering establishes the cleanup-after-runtime sequence
  - plan: 44-02a (state machine) — `ProtocolRunner.maxIterations` (RUN-09 cycle guard) must remain intact (different field, different file, same name); plan calls this out explicitly
provides:
  - "RadiProtocolSettings interface + DEFAULT_SETTINGS — no maxLoopIterations field at runtime ('maxLoopIterations' in DEFAULT_SETTINGS === false)"
  - "Settings tab display() — no 'Max loop iterations' control, no 'Protocol engine' heading"
  - "@deprecated LoopStartNode interface — 3 fields only (kind, loopLabel, exitLabel)"
  - "CanvasParser case 'loop-start' — no maxIterations field on parsed node (verified by new RUN-07 test)"
  - "EditorPanelView buildKindForm switch — single merged informational stub 'Legacy loop node' replacing the two legacy form arms"
  - "Phase 44 RUN-07 requirement: delivered + STATE.md Standing Pitfall #10 enforced"
affects:
  - Phase 45 (LOOP-05 Node Editor form for unified `loop` kind) — current `default` arm in editor-panel switch will receive the real loop form; legacy `loop-start`/`loop-end` stub remains until Phase 46 removes the legacy kinds entirely
  - Phase 46 (legacy kind removal) — the legacy informational stub + the @deprecated LoopStartNode/LoopEndNode interfaces become candidates for full deletion once the validator path no longer needs MIGRATE-01 nodeLabel resolution

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan-level grep gate: full-repo `grep -rn 'maxLoopIterations\\|radiprotocol_maxIterations' src/` returns only the test's literal `in`-check (intentional). Pattern complements unit-test absence assertion — the codebase as a whole is the assertion target, not just one file"
    - "Merged switch arms with informational stub: when two legacy kinds collapse to a single message, use `case 'loop-start': case 'loop-end': { ... break; }` pattern — preserves TS exhaustiveness, deduplicates copy, signals the kinds are obsolescing in lockstep"
    - "Rule 3 deferred-mock-cleanup: when a deleted interface field leaves orphan references in unrelated test mocks (untyped object literals + `as never` casts), remove the orphans in the same plan as the field deletion to keep the plan-level grep gate meaningful"

key-files:
  created: []
  modified:
    - src/settings.ts (-25 / +0) — deleted Notice import, maxLoopIterations field, default value, and Group 4 Protocol engine block (heading + Setting)
    - src/__tests__/settings-tab.test.ts (+3 / -3) — replaced D-10 default-value test with RUN-07 absence test; updated describe block name
    - src/__tests__/snippet-service.test.ts (-1 / +0) — Rule 3: removed dead maxLoopIterations: 50 from mock settings
    - src/__tests__/snippet-service-move.test.ts (-1 / +0) — Rule 3: removed dead maxLoopIterations: 50 from mock settings
    - src/graph/graph-model.ts (-1 / +0) — deleted maxIterations from @deprecated LoopStartNode interface
    - src/graph/canvas-parser.ts (-1 / +0) — deleted maxIterations field assignment in case 'loop-start'
    - src/views/editor-panel-view.ts (-44 / +9 net) — replaced 53-line legacy 'loop-start' + 'loop-end' form arms with merged informational stub
    - src/__tests__/canvas-parser.test.ts (+15 / +0) — added RUN-07 absence test (parser does not set maxIterations on parsed legacy node)

key-decisions:
  - "Rule 3 dead-mock cleanup: snippet-service.test.ts and snippet-service-move.test.ts contained orphaned `maxLoopIterations: 50` entries inside untyped object literals (`as never`-cast settings mocks). Removed in the same plan as the interface deletion so the plan-level grep gate (`grep -rn 'maxLoopIterations' src/ --include='*.ts' returns 0`) becomes meaningful. Untyped literals would have allowed the orphans to compile silently otherwise"
  - "TDD per task: RED test for settings.ts (RUN-07 absence assertion against DEFAULT_SETTINGS) committed BEFORE deletion. Second RED test for parser added in canvas-parser.test.ts before Step A/B/C edits. Both transitioned to GREEN by deletions. Plan-level TDD gate sequence: 2 test() commits + 2 feat() commits in correct order"
  - "Editor-panel merged stub uses 'Legacy loop node' heading + descriptive sentence pointing the author to rebuild as unified 'loop' node. Indentation matches surrounding case blocks (6-space case marker, 8-space body) — verified by reading neighbouring `case 'snippet':` block before edit"
  - "getNumber helper in canvas-parser.ts left intact even though it is now unused — CLAUDE.md / plan explicitly forbid touching helpers not added in this phase. TS compiles clean (no unused-function lint error in current config)"
  - "D-10 stub-check test (`UI-10/D-10: RadiProtocolSettingsTab has display method`) preserved verbatim per plan instruction. The plan's done-criterion `grep -c 'D-10' returns 0` was overly strict given the explicit 'DO NOT touch the display-method stub test at lines 17-22' instruction; the latter wins. Reported as a documentation-criterion mismatch in Deviations"
  - "Notice import dropped from settings.ts because its only call site was inside the deleted onChange validation block. Plan explicitly authorized this drop as part of Step A.4"

patterns-established:
  - "Rule 3 dead-mock cleanup pattern: when deleting an interface field, scan test mocks for orphan references and remove in the same commit — keeps plan-level grep gate as a meaningful guarantee instead of an aspirational one"
  - "TDD per task on cleanup plans: a deletion plan still gets RED→GREEN cycles by formulating the deletion as an absence assertion (`'fieldName' in object === false`). Test serves as the documented contract that the field is gone and stays gone"

requirements-completed:
  - "RUN-07 (a): 'maxLoopIterations' in DEFAULT_SETTINGS === false (asserted by green test in settings-tab.test.ts)"
  - "RUN-07 (b): LoopStartNode interface has no maxIterations field (`grep -c 'maxIterations' src/graph/graph-model.ts` returns 0)"
  - "RUN-07 (c): Settings tab display() does not render 'Max loop iterations' control or 'Protocol engine' heading (`grep -c` both return 0; manual UAT recommended for visual confirmation)"
  - "RUN-07 (d): canvas-parser case 'loop-start' no longer sets the deleted field (asserted by green test in canvas-parser.test.ts; `grep -c 'radiprotocol_maxIterations' src/graph/canvas-parser.ts` returns 0)"
  - "RUN-07 (e): editor-panel-view legacy form arms replaced with single informational stub (`grep -c 'Legacy loop node' src/views/editor-panel-view.ts` returns 1)"
  - "STATE.md Standing Pitfall #10 enforced: zero `maxLoopIterations` references remain in production code; only the test absence-assertion literal survives"

# Metrics
duration: ~5min
completed: 2026-04-17
---

# Phase 44 Plan 04: Legacy maxIterations Excision Summary

**Excised the legacy per-loop iteration cap (`maxLoopIterations` settings field + UI Setting + 'Protocol engine' heading + `LoopStartNode.maxIterations` interface field + `radiprotocol_maxIterations` parser assignment + 53-line editor-panel legacy form arms) per RUN-07 and STATE.md Standing Pitfall #10. Replaced with a single 9-line informational stub in the editor-panel switch and a RUN-07 absence test in both `settings-tab.test.ts` and `canvas-parser.test.ts`. `ProtocolRunner.maxIterations` (RUN-09 auto-advance cycle guard, default 50) untouched and verified by green `iteration cap (RUN-09, D-08)` test.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T13:27:23Z
- **Completed:** 2026-04-17T13:32:15Z
- **Tasks:** 2 / 2
- **Files modified:** 8 (3 production: settings.ts, graph-model.ts, canvas-parser.ts; 3 view/editor: editor-panel-view.ts; 4 test: settings-tab.test.ts, canvas-parser.test.ts, snippet-service.test.ts, snippet-service-move.test.ts)
- **Files created:** 0
- **Net deletion:** 76 lines deleted, 28 lines added (mostly the merged editor-panel informational stub + 2 RED-phase test additions)

## Accomplishments

### Task 1 — Delete maxLoopIterations from settings.ts + update settings-tab.test.ts (TDD)

**RED gate (commit `7893d02`):**
- Replaced D-10 default-value test (`expect(DEFAULT_SETTINGS.maxLoopIterations).toBe(50)`) with RUN-07 absence test (`expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false)`)
- Updated describe block name from `'Settings defaults (UI-10, UI-11, D-10)'` to `'Settings defaults (UI-10, UI-11, RUN-07)'`
- Test correctly fails: `expected true to be false` — RED confirmed
- Preserved verbatim: UI-10 test, UI-11 test, the `UI-10/D-10` stub-check test at lines 17-22 (per explicit plan instruction)

**GREEN gate (commit `71859f5`):**
- `src/settings.ts`:
  - Dropped `Notice` from the obsidian import (sole call site was inside the deleted onChange validation block)
  - Deleted `maxLoopIterations: number;` from `RadiProtocolSettings` interface (line 9)
  - Deleted `maxLoopIterations: 50,` from `DEFAULT_SETTINGS` object literal (line 27)
  - Deleted entire 18-line "Group 4 — Protocol engine" block (heading + 'Max loop iterations' Setting + onChange validation with parseInt + Notice fallback)
- Rule 3 auto-fix in test mocks:
  - `src/__tests__/snippet-service.test.ts` line 79 — removed orphaned `maxLoopIterations: 50,` from untyped settings mock
  - `src/__tests__/snippet-service-move.test.ts` line 111 — removed orphaned `maxLoopIterations: 50,` from untyped settings mock
- Test transitioned to GREEN: 4/4 settings-tab tests pass, full suite 388 passed / 14 skipped / 3 todo / 0 failed

### Task 2 — Delete maxIterations from LoopStartNode + canvas-parser + editor-panel legacy forms (TDD)

**RED gate (commit `99bb5cf`):**
- New `describe('RUN-07: legacy loop-start no longer carries maxIterations')` block in canvas-parser.test.ts
- Test parses `loop-start.canvas` fixture, asserts `'maxIterations' in (node as any) === false`
- Test correctly fails — parser still sets the field — RED confirmed

**GREEN gate (commit `b40a07f`):**
- **Step A — `src/graph/graph-model.ts`:** deleted single line `maxIterations: number;` from `@deprecated LoopStartNode` interface (line 81). Surrounding interface unchanged: still has `kind: 'loop-start'`, `loopLabel: string`, `exitLabel: string`. Surrounding @deprecated JSDoc preserved byte-identically. `LoopEndNode`, `LoopNode`, `LoopContext`, `RPNode` union — all untouched.
- **Step B — `src/graph/canvas-parser.ts`:** deleted single line `maxIterations: getNumber(props, 'radiprotocol_maxIterations', 50),` inside `case 'loop-start'` body (line 247). Resulting case body has 4 lines (spread base, kind literal, loopLabel, exitLabel). `getNumber` helper preserved per CLAUDE.md (no longer called locally — left as defined function).
- **Step C — `src/views/editor-panel-view.ts`:** replaced 53-line range (lines 556-608 — `case 'loop-start': { ... 37 lines ... }` + `case 'loop-end': { ... 14 lines ... }` + the blank line between them) with a 9-line merged informational stub:
  ```typescript
  case 'loop-start':
  case 'loop-end': {
    // Phase 44 (RUN-07) — legacy kinds retained for parser migration-error path (Phase 43 D-03).
    // Validator rejects any canvas containing these; the form below is informational only.
    new Setting(container).setHeading().setName('Legacy loop node');
    new Setting(container).setDesc(
      'This node type is obsolete. Rebuild the loop using a unified "loop" node. The canvas will fail validation until the legacy nodes are removed.',
    );
    break;
  }
  ```
  Indentation: 6-space case marker, 8-space body — verified against neighbouring `case 'snippet':` block before edit.

## Task Commits

1. **Task 1 RED — failing RUN-07 absence test** — `7893d02` (test)
2. **Task 1 GREEN — excise maxLoopIterations from settings + dead mocks** — `71859f5` (feat)
3. **Task 2 RED — failing parser absence test** — `99bb5cf` (test)
4. **Task 2 GREEN — excise maxIterations from graph-model + parser + editor-panel** — `b40a07f` (feat)

## Files Created/Modified

### Created

- None — Plan 44-04 is purely deletion + minimal informational replacement.

### Modified

- `src/settings.ts` (-25 / +0)
- `src/__tests__/settings-tab.test.ts` (+3 / -3)
- `src/__tests__/snippet-service.test.ts` (-1 / +0)
- `src/__tests__/snippet-service-move.test.ts` (-1 / +0)
- `src/graph/graph-model.ts` (-1 / +0)
- `src/graph/canvas-parser.ts` (-1 / +0)
- `src/views/editor-panel-view.ts` (-44 / +9 net)
- `src/__tests__/canvas-parser.test.ts` (+15 / +0)

## Verification Results

### Plan-level done criteria (all green)

- ✅ `grep -c 'maxLoopIterations' src/settings.ts` → **0**
- ✅ `grep -c 'Max loop iterations' src/settings.ts` → **0**
- ✅ `grep -c 'Protocol engine' src/settings.ts` → **0**
- ✅ `grep -cE '\bNotice\b' src/settings.ts` → **0**
- ✅ `grep -c 'maxLoopIterations' src/__tests__/settings-tab.test.ts` → **1** (the new RUN-07 test's `in` check)
- ✅ `grep -c 'RUN-07' src/__tests__/settings-tab.test.ts` → **2**
- ✅ `grep -c 'maxIterations' src/graph/graph-model.ts` → **0**
- ✅ `grep -c 'radiprotocol_maxIterations' src/graph/canvas-parser.ts` → **0**
- ✅ `grep -cE 'radiprotocol_maxIterations|radiprotocol_loopLabel|radiprotocol_exitLabel|radiprotocol_loopStartId' src/views/editor-panel-view.ts` → **0**
- ✅ `grep -c 'Legacy loop node' src/views/editor-panel-view.ts` → **1**
- ✅ `grep -cE "case 'loop-start':|case 'loop-end':" src/views/editor-panel-view.ts` → **2**
- ✅ `grep -rn 'maxLoopIterations\|radiprotocol_maxIterations' src/ --include='*.ts'` → only the test absence-assertion literal in settings-tab.test.ts

### Retention confirmation: ProtocolRunner.maxIterations (RUN-09) intact

```
$ grep -c "this.maxIterations" src/runner/protocol-runner.ts
3
```

Three hits — same as Plan 02a baseline:
1. Constructor assignment (`this.maxIterations = options?.maxIterations ?? 50`)
2. Cycle-guard comparison inside advanceThrough's while loop (`if (steps > this.maxIterations)`)
3. Error message template (`...exceeded maxIterations cap of ${this.maxIterations}.`)

### Green-test confirmation

- ✅ `npx vitest run src/__tests__/settings-tab.test.ts` → 4 passed (RUN-07 + UI-10 + UI-11 + display-stub)
- ✅ `npx vitest run src/__tests__/canvas-parser.test.ts` → all parser tests pass including new RUN-07 absence test
- ✅ `npx vitest run src/__tests__/graph-validator.test.ts src/__tests__/canvas-parser.test.ts` → 35 passed (combined validator + parser corpus)
- ✅ `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "iteration cap"` → 2 passed (RUN-09 cycle guard test green — `describe('iteration cap (RUN-09, D-08)')` intact)
- ✅ `npx tsc --noEmit --skipLibCheck` → exit 0
- ✅ `npm test -- --run` → **389 passed + 14 skipped + 3 todo / 0 failed** (29 test files; +1 vs Plan 02a baseline from new RUN-07 parser test)
- ✅ `npm run build` → exit 0 (production bundle generated; dev vault copy succeeded)
- ✅ `git diff --diff-filter=D --name-only HEAD~4 HEAD` → empty (no whole-file deletions; only line-level deletions inside scope)

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Removed orphaned `maxLoopIterations: 50` from snippet-service test mocks**
- **Found during:** Task 1 GREEN (post-edit grep `grep -rn 'maxLoopIterations' src/`)
- **Issue:** `src/__tests__/snippet-service.test.ts:79` and `src/__tests__/snippet-service-move.test.ts:111` both had untyped settings-mock object literals containing `maxLoopIterations: 50` as a leftover entry. Without removal, the plan-level grep gate (`grep -rn 'maxLoopIterations\|radiprotocol_maxIterations' src/ --include='*.ts' returns 0 matches`) would fail. The mocks compile silently because they are passed via `as never` cast, so TS doesn't enforce shape conformance.
- **Fix:** Deleted both lines. SnippetService tests do not consume `settings.maxLoopIterations` so behaviour unchanged. Verified by green test re-run.
- **Files modified:** `src/__tests__/snippet-service.test.ts`, `src/__tests__/snippet-service-move.test.ts`
- **Commit:** `71859f5`
- **Rationale:** Plan-level done criterion `grep -rn ... returns 0` is the spirit of RUN-07 (zero references to legacy per-loop cap). Leaving dead mock entries would render the gate aspirational instead of enforceable. Treating this as Rule 3 (auto-fix blocking issue preventing plan-level verification) rather than Rule 4 (architectural change) — the deletion is purely mechanical, not a design choice.

### Documentation-criterion mismatch

**1. [Plan internal contradiction] D-10 stub-check test name retained**
- **Found during:** Task 1 GREEN done-criteria verification
- **Issue:** Plan done criterion says `grep -c 'D-10' src/__tests__/settings-tab.test.ts returns 0`. But plan instruction lines 237-241 explicitly say "DO NOT touch... the display-method stub test at lines 17-22" — and that test is named `'UI-10/D-10: RadiProtocolSettingsTab has display method (stub check)'` (contains literal 'D-10').
- **Resolution:** Honoured the explicit DO NOT touch instruction over the broader grep done-criterion. The `D-10` substring survives in the stub-check test's name (1 hit). This test asserts only that `RadiProtocolSettingsTab.prototype.display` is a function — unrelated to RUN-07. Renaming it would risk breaking grep-based test selection downstream.
- **Action:** Documented here. Final state: `grep -c 'D-10' src/__tests__/settings-tab.test.ts returns 1` (the stub-check test name). The deleted D-10 test (default value assertion) is gone — that was the intent of the criterion.

### Auth gates

None — fully autonomous execution.

### Architectural decisions

None — no Rule 4 checkpoints needed.

## Handoff Notes

### For Phase 44 verifier

- **All 7 RUN requirements satisfied across Phase 44:**
  - RUN-01..RUN-04: state machine + dead-end helper + nested loops (Plan 02a)
  - RUN-05: step-back undo-before-mutate (Plan 02a)
  - RUN-06: PersistedSession union widened (Plan 02a — type half) and round-trip (Plan 03 — when complete)
  - RUN-07: legacy iteration cap fully excised (this plan)
- **STATE.md Standing Pitfall #10 enforced:** "do not carry the maxIterations field forward for any reason" — verified by full-repo grep.
- **`ProtocolRunner.maxIterations` (RUN-09 cycle guard) preserved:** different field, different file (`src/runner/protocol-runner.ts`). 3 grep hits, 2 tests green.
- **Phase 44 still has Plan 03 outstanding:** RunnerView picker UI (replacing Plan 02a's `awaiting-loop-pick` exhaustiveness stub).

### For Phase 45 (LOOP-05)

- The editor-panel switch's legacy-arm stub (`case 'loop-start': case 'loop-end':` → 'Legacy loop node' message) remains until Phase 46. Phase 45 owns the `case 'loop':` arm — currently falls through to `default`. Add a real form for the unified `loop` kind (`headerText` text input + per-edge label preview if practical).
- Pattern reference: the Phase 31 SnippetNode form arm (`case 'snippet':` at editor-panel-view.ts:610+) shows the standard structure (heading + form fields with `pendingEdits` + `scheduleAutoSave`).

### For Phase 46 (legacy kind removal)

- The 9-line `case 'loop-start': case 'loop-end':` informational stub becomes a candidate for full deletion when:
  1. `RPNodeKind` union drops `'loop-start'` and `'loop-end'` (Phase 46 LOOP-05 / LOOP-06 follow-up)
  2. The validator's MIGRATE-01 path no longer needs to call `nodeLabel` on legacy nodes
  3. The parser's `case 'loop-start'` and `case 'loop-end'` arms are removed
- The `getNumber` helper in canvas-parser.ts is no longer called locally (its sole caller — the `radiprotocol_maxIterations` parse line — is gone). Phase 46 may garbage-collect it as part of dead-helper sweep, but per CLAUDE.md "never remove code you didn't add" rule it is preserved here.

## Known Stubs

- `src/views/editor-panel-view.ts` `case 'loop-start': case 'loop-end':` — informational stub returning a 'Legacy loop node' message. This is intentional and documented above as the Phase 44 → Phase 46 handoff. Stub blocks rendering of editable form fields for legacy nodes (validator already rejects canvases containing them, so the editor-panel never shows real loop-node forms). Does not flow to RunnerView output. Goal: prevent author confusion if they open a legacy `.canvas` from before v1.7. No data wiring required.

## Threat Flags

None — no new network surface, auth path, file access pattern, or schema change at trust boundaries. RUN-07 cleanup is strictly internal type-shape + UI-form removal.

## TDD Gate Compliance

- ✅ Task 1 RED gate: `7893d02` — `test(44-04): add failing RUN-07 absence test for maxLoopIterations`
- ✅ Task 1 GREEN gate: `71859f5` — `feat(44-04): excise maxLoopIterations from settings and dead test mocks (RUN-07)`
- ✅ Task 2 RED gate: `99bb5cf` — `test(44-04): add failing RUN-07 absence test for parser maxIterations`
- ✅ Task 2 GREEN gate: `b40a07f` — `feat(44-04): excise legacy maxIterations from graph-model, parser, editor-panel (RUN-07)`
- No REFACTOR commits needed (no cleanup-after-green required; deletions were minimal and self-contained).

Each task RED→GREEN sequence preserved in correct git order; both RED tests transitioned to GREEN by the immediately-following feat commit.

## Self-Check: PASSED

- ✅ FOUND: `src/settings.ts` (modified — Notice import dropped, maxLoopIterations field/default/Setting deleted, Protocol engine heading deleted)
- ✅ FOUND: `src/__tests__/settings-tab.test.ts` (modified — D-10 default test replaced with RUN-07 absence test)
- ✅ FOUND: `src/__tests__/snippet-service.test.ts` (modified — Rule 3 dead-mock cleanup)
- ✅ FOUND: `src/__tests__/snippet-service-move.test.ts` (modified — Rule 3 dead-mock cleanup)
- ✅ FOUND: `src/graph/graph-model.ts` (modified — LoopStartNode.maxIterations deleted)
- ✅ FOUND: `src/graph/canvas-parser.ts` (modified — radiprotocol_maxIterations field assignment deleted)
- ✅ FOUND: `src/views/editor-panel-view.ts` (modified — legacy form arms replaced with merged informational stub)
- ✅ FOUND: `src/__tests__/canvas-parser.test.ts` (modified — RUN-07 absence test added)
- ✅ FOUND commit: `7893d02` — `test(44-04): add failing RUN-07 absence test for maxLoopIterations`
- ✅ FOUND commit: `71859f5` — `feat(44-04): excise maxLoopIterations from settings and dead test mocks (RUN-07)`
- ✅ FOUND commit: `99bb5cf` — `test(44-04): add failing RUN-07 absence test for parser maxIterations`
- ✅ FOUND commit: `b40a07f` — `feat(44-04): excise legacy maxIterations from graph-model, parser, editor-panel (RUN-07)`
