---
milestone: v1.13
name: AI-Agent Friction Reduction & Codebase Health
audit_date: 2026-05-02
auditor: gsd-milestone-management
status: close — all 5 requirements satisfied; two soft LOC targets met partially with documented rationale
---

# Milestone v1.13 — AI-Agent Friction Reduction & Codebase Health — Audit

**Defined:** 2026-05-02
**Audited:** 2026-05-02
**Scope:** Phases 79, 80, 81, 82, 83
**Theme:** Internal-only milestone — no GitHub Release for `1.13.0`. Typed surfaces (runner-state literals, shared CSS class names, DOM helpers), reusable CSS utilities + stylelint gate, and two further god-file decompositions (`SnippetManagerView`, `RunnerView`). Public APIs and runtime behavior preserved verbatim.

---

## Executive Summary

The v1.13 milestone shipped 5 internal phases over a single day (2026-05-02). Every active requirement is **PASS**. The two soft LOC targets in REFACTOR-SNIPPET-MGR-01 (Phase 82) and REFACTOR-RUNNER-VIEW-01 (Phase 83) were exceeded relative to their stated soft budgets but met their behavioral-extraction success criteria; both are flagged below as PARTIAL on the LOC dimension and PASS on the behavioral dimension. Build, lint, and test gates are uniformly green: `npm run build` exit 0, `npm run lint` exit 0 (0 errors / 2 pre-existing warnings), `npm test` 847 passed / 1 skipped across every phase boundary.

The work landed on `main` via squash merge `eb5c670` (PR #2), which simultaneously resolved the Phase 75 atomic-commit gap that was carried over from v1.12 close — the working-tree-only Phase 75 deltas are now committed as part of the v1.13 PR. Release tag `1.13.0` is present (`2ad1c0a`) but the milestone is internal-only by REQUIREMENTS.md design and no GitHub Release was published.

**Verdict: CLOSE** with two documented soft-target carry-overs (snippet-manager-view 531 LOC vs <400 soft target; runner-view 880 LOC vs <700 soft target).

---

## Completion Status Per Phase

| Phase | Title | Plans | Code Status | Verification | Commit |
|-------|-------|-------|-------------|--------------|--------|
| 79 | Typed Constants for Runner States and CSS Classes | 2/2 | ✅ Complete and committed | ✅ `79-VERIFICATION.md` (847 pass, 0 lint errors, build 0) | ✅ `6548c1f`, `1587341` (squashed into `eb5c670`) |
| 80 | Reusable CSS Utilities + Stylelint Gate | 5/5 | ✅ Complete and committed | ✅ `80-VERIFICATION.md` (utilities + stylelint wired; pre-commit + CI gates green) | ✅ `c1d15ba` (squashed into `eb5c670`) |
| 81 | Typed dom-helpers Module | 5/5 | ✅ Complete and committed | ✅ `81-VERIFICATION.md` (hot-path casts removed; 847 pass) | ✅ (squashed into `eb5c670`) |
| 82 | SnippetManagerView Decomposition | 5/5 | ✅ Complete and committed | ⚠️ `82-VERIFICATION.md` (LOC 531 > 400 soft target; behavior preserved) | ✅ `4d1fba2` (squashed into `eb5c670`) |
| 83 | RunnerView SessionRecoveryCoordinator Extraction | 5/5 | ✅ Complete and committed | ⚠️ `83-VERIFICATION.md` (LOC 880 > 700 soft target; behavior preserved) | ✅ `5bde443` (squashed into `eb5c670`) |

### Phase 79 — Typed Constants for Runner States and CSS Classes

- **Goal achieved:** Two new constants modules — `src/constants/runner-states.ts` (11 LOC, exports `RUNNER_STATUS` + `RunnerStatus` union) and `src/constants/css-classes.ts` (17 LOC, exports `CSS_CLASS` + `CssClass` union). Stringly-typed runner-state literals replaced across `src/runner/protocol-runner.ts` and `src/runner/runner-state.ts`. Shared CSS class names replaced at 7 hot-path call sites: `runner-view.ts`, `inline-runner-modal.ts`, `snippet-editor-modal.ts`, `snippet-form.ts`, `runner-host.ts`, `render-snippet-picker.ts`, `render-snippet-fill.ts`.
- **EXTRACT-TYPES-01 evidence:** `git grep -nP "['\"]awaiting-snippet-(pick|fill)['\"]" src/` returns matches only inside `src/constants/runner-states.ts`. All 7 runner states (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-snippet-fill`, `awaiting-loop-pick`, `complete`, `error`) exported as `const`. One-off classes intentionally left inline per REQUIREMENTS.md "no exhaustive sweeps".
- **Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings.

### Phase 80 — Reusable CSS Utilities + Stylelint Gate

- **Goal achieved:** New `src/styles/_utilities.css` (65 LOC) registered first in `esbuild.config.mjs` `CSS_FILES`, exporting `.rp-stack`, `.rp-row`, `.rp-center`, `.rp-hidden`, `.rp-disabled` (plus size variants). At least one duplicated flex/gap/visibility rule per existing per-feature CSS file migrated to consume the utility class (8 feature files migrated: runner-view, snippet-fill-modal, editor-panel, snippet-manager, snippet-tree-picker, canvas-selector, inline-runner, loop-support).
- **SPLIT-CSS-01 evidence:** `stylelint` + `stylelint-config-standard` installed as devDependencies. `stylelint.config.mjs` extends standard config with `declaration-block-no-duplicate-properties`, `selector-pseudo-class-no-unknown`, `selector-pseudo-element-no-unknown`, `selector-type-no-unknown` enabled and pre-existing style noise (no-duplicate-selectors, rule-empty-line-before, etc.) disabled to keep the gate focused. `npm run lint` script updated to invoke `stylelint 'src/styles/**/*.css'` alongside ESLint. `.githooks/pre-commit` updated to run stylelint on staged `src/styles/**/*.css` files (existing eslint-on-staged-`*.ts` and `npm test` behavior preserved). `.github/workflows/ci.yml` continues to invoke `npm run lint` (now covers stylelint) without a separate workflow file.
- **Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0 (esbuild concatenation pipeline preserves utility-first ordering), `npm run lint` 0 errors / 2 pre-existing warnings.

### Phase 81 — Typed dom-helpers Module

- **Goal achieved:** New `src/utils/dom-helpers.ts` (69 LOC) exports `createButton(parent, opts?) → HTMLButtonElement`, `createInput(parent, opts?) → HTMLInputElement`, `createTextarea(parent, opts?) → HTMLTextAreaElement`, and `registerEvent(scope, target, event, handler) → void`. Hot-path call sites — `src/runner/render/*` plus `src/views/snippet-tree-picker.ts` and `src/views/snippet-editor-modal.ts` — no longer contain `as HTMLButtonElement` / `as HTMLInputElement` / `as HTMLTextAreaElement` casts for the four element kinds the helpers cover.
- **TYPE-SAFETY-01 evidence:** Mock at `src/__mocks__/obsidian.ts` updated so the typed helpers work in vitest without `as any` escape hatches; existing mock-extension points (`recordedCssProps`, etc. introduced in Phase 77) preserved verbatim. `RunnerHost` interface untouched per Phase 75 contract.
- **Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings.
- **Out-of-scope follow-up explicitly noted in `81-VERIFICATION.md`:** `registerEvent` provided but not wired at all call sites yet — only typed element creation is in use; future phases can expand. Long-tail `as HTMLButtonElement` casts remain in `src/views/settings-tab.ts`, `snippet-fill-in-modal.ts`, `snippet-editor-modal.ts` outside the declared hot path; opportunistic migration deferred to v1.14.

### Phase 82 — SnippetManagerView Decomposition

- **Goal achieved:** Tree rendering, drag-and-drop, inline rename, and context-menu logic extracted from `src/views/snippet-manager-view.ts` into `src/views/snippet-manager/tree-renderer.ts` (`SnippetManagerTreeRenderer` class, 577 LOC). Host view trimmed from 1037 LOC → 537 LOC (48% reduction). Phase 32 vault watcher / 120ms debounce / prefix-filter pattern preserved; Phase 32/34 `rewriteCanvasRefs` integration (with `WriteMutex` per file path) preserved verbatim.
- **REFACTOR-SNIPPET-MGR-01 evidence:** `wc -l src/views/snippet-manager-view.ts` = 537 LOC; `wc -l src/views/snippet-manager/tree-renderer.ts` = 577 LOC. Two test files mechanically updated to reference `tree-renderer.ts` and the `treeRenderer` delegate; assertion semantics preserved.
- **PARTIAL on LOC dimension:** Soft target of <400 LOC was **not** met — host view remains at 537 LOC (verification reports 531 LOC at commit time; current tree shows 537 LOC). Rationale documented in `82-VERIFICATION.md`: a single renderer file was chosen rather than 3 separate controllers because tree + DnD + rename are tightly coupled by DOM state. Further sub-decomposition would have required threading shared mutable DOM references across module boundaries, which the planner judged worse-than-the-disease.
- **2 deferred lint warnings re-evaluated:** `obsidianmd/prefer-file-manager-trash-file` × 2 in `src/snippets/snippet-service.ts:240,283`. **Re-deferred** with rationale (out of Phase 82 scope per REQUIREMENTS.md — touching `snippet-service.ts` was not required by the controller extraction itself); both warnings persist into v1.14 backlog.
- **Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings.

### Phase 83 — RunnerView SessionRecoveryCoordinator Extraction

- **Goal achieved:** `SessionRecoveryCoordinator` extracted to `src/runner/session-recovery-coordinator.ts` (112 LOC). Owns the three behavioral surfaces stipulated by REQUIREMENTS.md REFACTOR-RUNNER-VIEW-01 — autosave/append-policy (`autoSave()`), resume prompt + canvas-modification-warning (`resolveSession()` returning `'resume' | 'start-over' | 'error'`). `RunnerView` constructor wires the coordinator; `openCanvas()`'s ~45-LOC session-recovery block replaced with a single `resolveSession()` call; `autoSaveSession()` body replaced with delegation. Imports of `ResumeSessionModal`, `PersistedSession`, and `validateSessionNodeIds` removed from `runner-view.ts` (relocated to coordinator).
- **REFACTOR-RUNNER-VIEW-01 evidence:** `wc -l src/views/runner-view.ts` = 880 LOC (down from 925 LOC pre-extraction; –45 LOC). Phase 7 contract preserved — autosave timing, resume conditions, and canvas-modification warnings fire under the same conditions as before. Phase 75 contract preserved — `RunnerHost` interface untouched; shared renderer delegation unchanged. `InlineRunnerModal` not modified (per REQUIREMENTS.md "Out of Scope").
- **PARTIAL on LOC dimension:** Soft target of <700 LOC was **not** met — host view remains at 880 LOC. Rationale documented in `83-VERIFICATION.md` and Plan: the coordinator extraction alone was always projected to leave ~855 LOC; further reduction requires extracting the snippet-picker surface (`mountSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`) and the canvas-switching surface (`handleSelectorSelect`, `handleClose`, `restartCanvas`), both deferred to v1.14 by scope.
- **Final gate:** `npm test` 847/1 skipped, `npm run build` exit 0, `npm run lint` 0 errors / 2 pre-existing warnings.

---

## Requirements Coverage Matrix

| REQ-ID | Phase | Status | Evidence |
|--------|-------|--------|----------|
| EXTRACT-TYPES-01 | 79 | ✅ PASS | `79-VERIFICATION.md` — `src/constants/runner-states.ts` + `src/constants/css-classes.ts` exist; `git grep -nP "['\"]awaiting-snippet-(pick|fill)['\"]" src/` returns matches only in canonical file; 7 hot-path call sites consume `CSS_CLASS.*` constants |
| SPLIT-CSS-01 | 80 | ✅ PASS | `80-VERIFICATION.md` — `_utilities.css` registered first in `esbuild.config.mjs`; ≥1 migration per of 8 per-feature CSS files; stylelint devDep + config + lint script + pre-commit hook + CI integration verified |
| TYPE-SAFETY-01 | 81 | ✅ PASS | `81-VERIFICATION.md` — `src/utils/dom-helpers.ts` exports 4 typed helpers; hot-path call sites no longer cast `as HTMLButton/Input/TextAreaElement`; mock updated; 847 tests pass |
| REFACTOR-SNIPPET-MGR-01 | 82 | ⚠️ PARTIAL (PASS-behavior, PARTIAL-LOC) | `82-VERIFICATION.md` — host view 537 LOC (target <400, soft); tree + DnD + rename + context-menu extracted to `src/views/snippet-manager/tree-renderer.ts`; behavior preserved (vault watcher, `rewriteCanvasRefs`, `WriteMutex`); 2 deferred lint warnings re-deferred with rationale |
| REFACTOR-RUNNER-VIEW-01 | 83 | ⚠️ PARTIAL (PASS-behavior, PARTIAL-LOC) | `83-VERIFICATION.md` — host view 880 LOC (target <700, soft); `SessionRecoveryCoordinator` owns autosave/append-policy + resume prompt + canvas-mod warning; `InlineRunnerModal` untouched; `RunnerHost` interface untouched |

**Coverage:** 5 / 5 requirements satisfied at the behavioral dimension. **2 / 5 partial on the soft LOC dimension** with documented rationale. **Zero gaps in milestone scope.**

---

## Phase-by-Phase Verification Summary

| Phase | Planned | Delivered | Build | Lint | Test | LOC Impact (src) |
|-------|---------|-----------|-------|------|------|------------------|
| 79 | EXTRACT-TYPES-01: typed runner-state + CSS class constants | ✅ Two new constants modules; 7 hot-path call sites migrated | exit 0 | 0 / 2 warnings | 847/1 skipped | +28 LOC (2 new files) |
| 80 | SPLIT-CSS-01: utilities + stylelint gate (lint, pre-commit, CI) | ✅ `_utilities.css` + stylelint config wired into all three gates; 8 per-feature CSS files migrated | exit 0 | 0 / 2 warnings | 847/1 skipped | +65 LOC utilities; per-feature CSS net-neutral after migration |
| 81 | TYPE-SAFETY-01: typed dom-helpers at hot paths | ✅ `src/utils/dom-helpers.ts` exports 4 typed helpers; hot-path casts removed; mock updated | exit 0 | 0 / 2 warnings | 847/1 skipped | +69 LOC helpers; –casts at hot paths |
| 82 | REFACTOR-SNIPPET-MGR-01: SnippetManagerView decomposition (<400 LOC soft) | ⚠️ Behavior extracted to `tree-renderer.ts`; host 1037 → 537 LOC (48% reduction; soft <400 not met) | exit 0 | 0 / 2 warnings | 847/1 skipped | host –500 LOC; new module +577 LOC |
| 83 | REFACTOR-RUNNER-VIEW-01: SessionRecoveryCoordinator + RunnerView trim (<700 LOC soft) | ⚠️ Coordinator extracted (112 LOC); host 925 → 880 LOC (–45; soft <700 not met) | exit 0 | 0 / 2 warnings | 847/1 skipped | host –45 LOC; new module +112 LOC |

**Aggregate src/ delta (vs v1.12 close `febabfd`):** +1096 / −735 across 35 files (per `git diff --stat febabfd HEAD -- src/`).

---

## Gaps and Tech Debt Found

### New tech debt introduced by v1.13

- **REFACTOR-SNIPPET-MGR-01 soft-LOC carry-over** — `src/views/snippet-manager-view.ts` remains at 537 LOC vs <400 LOC soft target. Further reduction would require splitting `tree-renderer.ts` into separate tree / DnD / rename / context-menu controllers; planner judged this would force shared mutable DOM state across module boundaries, which is worse than a single 537-LOC dispatcher. Re-evaluate in v1.14 if a natural seam emerges.
- **REFACTOR-RUNNER-VIEW-01 soft-LOC carry-over** — `src/views/runner-view.ts` remains at 880 LOC vs <700 LOC soft target. Further reduction requires extracting (a) the snippet-picker surface (`mountSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`) and (b) the canvas-switching surface (`handleSelectorSelect`, `handleClose`, `restartCanvas`). Both deferred to v1.14 by scope; the coordinator extraction proved the pattern.
- **2 deferred lint warnings re-deferred (third milestone in a row)** — `obsidianmd/prefer-file-manager-trash-file` × 2 in `src/snippets/snippet-service.ts:240,283`. v1.12 documented out-of-scope; v1.13 Phase 82 re-evaluated and re-deferred (out of phase-82 scope by planner judgment). Persist into v1.14 backlog. Recommend wrapping into a future quick task — they are mechanical to fix and adjacent to in-scope work whenever `snippet-service.ts` is next touched.
- **`registerEvent` typed wrapper is provided but not yet wired** — Phase 81 added `registerEvent` to `dom-helpers.ts` but did not adopt it at call sites; only typed element creation is in use. Long-tail `as HTML*Element` casts remain in `src/views/settings-tab.ts`, `snippet-fill-in-modal.ts`, `snippet-editor-modal.ts` outside the declared Phase-81 hot path. Opportunistic migration deferred to v1.14.
- **Exhaustive CSS utility migration deferred** — Phase 80 demonstrated the pattern with at-least-one-per-feature; full sweep over every duplicated flex/gap rule across the per-feature CSS files is deferred per REQUIREMENTS.md "Future Requirements".
- **`.planning/phases/75-runner-view-inline-runner-deduplication/` orphan directory** — present in active phases tree alongside the v1.12 archive copy at `.planning/milestones/v1.12-phases/75-runner-view-inline-runner-deduplication/`. The Phase 75 atomic-commit gap was resolved as part of the v1.13 PR squash (`eb5c670`), but the orphan directory under `.planning/phases/` was not relocated to the v1.12 archive. Mechanical cleanup recommended at the next `/gsd-cleanup` pass; not a blocker for v1.13 close.

### Carry-over tech debt from v1.12 close (status update)

| Item | v1.12 status | v1.13 status |
|------|--------------|--------------|
| Phase 75 atomic-commit gap | pending | ✅ **Resolved** by squash merge `eb5c670` (PR #2). Orphan `.planning/phases/75-*` directory remains — see new tech-debt list above. |
| CI-04 / CI-05 live red-status verification | deferred to next natural PR | ✅ **Resolved** — Phase 80 stylelint integration exercised the gate naturally on PR #2. |
| 2 lint warnings in `snippet-service.ts:240,283` | documented out-of-scope | ⚠️ **Re-deferred** by Phase 82 — see new tech-debt list above. |
| MEDIUM-5 — `protocol-runner.ts` (819 LOC) decomposition | deferred | Still deferred — explicitly out of v1.13 scope (REQUIREMENTS.md "Out of Scope: No engine decomposition"). |
| Phases 64/66/67 formal `VERIFICATION.md` | carry-over | Still carry-over project-wide tech debt (UAT-PASS evidence exists; no formal `gsd-verifier` artifact). |
| Nyquist `VALIDATION.md` for Phases 63–78 | project-wide tech debt | Still carry-over — Phases 79–83 also lack `VALIDATION.md` artifacts. Nyquist coverage gap continues to widen. |
| 3 open debug sessions (`inline-runner-drag-resets-size`, `inline-runner-tab-switch-resets-size`, `phase-27-regressions`) | open | Still open — not touched in v1.13. |
| 2 stale seeds (`duplicate-node.md`, `quick-node-creation.md`) | stale | Still stale — not touched in v1.13. |
| `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check | carry-over | Still retained. |

---

## Cross-Phase Integration Check

- **Phase 79 → 81 surface flow:** Phase 81's `dom-helpers` consume typed element kinds, and Phase 79's `RUNNER_STATUS` constants are imported by the hot-path call sites that Phase 81 also migrated. No conflict observed — both phases edit overlapping files (`src/runner/render/*`) but at orthogonal seams (constants vs typed creation), and the squash merge applied them in declared order without rebase fallout.
- **Phase 79 → 82 surface flow:** Phase 82's `tree-renderer.ts` consumes `CSS_CLASS` from Phase 79 directly. No double-rewrites of moved call sites — the recommended ordering held.
- **Phase 79 → 83 surface flow:** Phase 83's `SessionRecoveryCoordinator` does not consume `RUNNER_STATUS` (no runner-state literals in coordinator scope; resume-result is a custom `'resume' | 'start-over' | 'error'` discriminated union). No drift.
- **Phase 80 stylelint gate × Phase 82/83 CSS edits:** Phase 82 and 83 are CSS-light (no per-feature `src/styles/*.css` edits in 82; none in 83). Stylelint gate fired clean on every commit in the squash chain.
- **Phase 75 contract preservation across 82/83:** Both phases' verifications explicitly confirm `RunnerHost` interface untouched and shared renderer delegation unchanged. `inline-runner-modal.ts` not modified by Phase 83 per REQUIREMENTS.md "Out of Scope".
- **Phase 76 dispatcher contract preservation across 82:** Phase 82's split mirrors the Phase 76 host-coordinator pattern (single dispatcher, per-controller modules under a sibling directory). Pattern fidelity checked — `snippet-manager-view.ts` is now a host coordinator like `editor-panel-view.ts` was after Phase 76, except at 537 LOC vs 393 LOC.

**No cross-phase wiring issues detected.** All five phases composed cleanly under the squash merge.

---

## Verdict: CLOSE

**Recommendation: CLOSE v1.13 as `complete-with-documented-soft-target-carry-overs`.**

Path A (close with documented tech debt) is appropriate because:

1. All 5 active requirements PASS at the behavioral / contract dimension. The two PARTIALs are on **soft** LOC budgets that REQUIREMENTS.md and the phase plans explicitly framed as soft, with planner-time rationale already captured in each VERIFICATION.md.
2. Build, lint, and test gates are uniformly green at every commit boundary in the squash chain.
3. The v1.12 Phase 75 atomic-commit carry-over — the single highest-priority deferred item entering v1.13 — was resolved as a side effect of the v1.13 squash merge (PR #2).
4. CI-04 / CI-05 live red-status verification — also deferred from v1.12 — was naturally exercised by the v1.13 PR.
5. No regressions, no test removals, no behavior changes. The milestone delivered exactly what REQUIREMENTS.md scoped: typed surfaces, reusable utilities, two further god-file decompositions — all internal-only.

Carry into v1.14:

- (HIGH) Continued `runner-view.ts` decomposition: snippet-picker surface + canvas-switching surface, targeting the original <700 LOC soft budget.
- (MEDIUM) `snippet-manager-view.ts` further reduction if a clean seam emerges (re-evaluate after exercising `tree-renderer.ts` for a milestone).
- (MEDIUM) `protocol-runner.ts` (819 LOC) decomposition — MEDIUM-5 from v1.12 CONCERNS.md, deferred two milestones running.
- (LOW-mechanical) 2 lint warnings in `snippet-service.ts:240,283` — wrap into a v1.14 quick task; no longer worth re-deferring.
- (LOW-mechanical) `.planning/phases/75-*` orphan directory cleanup at next `/gsd-cleanup` pass.
- (LOW) Long-tail typed-helpers + CSS-utilities migration (Phases 81 / 80 both shipped pattern-only).
- (Project-wide) Nyquist `VALIDATION.md` backfill across Phases 63–83 remains an open project-wide gap; the gap widens by one milestone each cycle without explicit attention.

**No blockers identified.** Milestone is ready for archive.
