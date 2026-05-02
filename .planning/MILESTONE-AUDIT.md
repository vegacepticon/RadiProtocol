---
milestone: v1.12
name: Maintenance & Tech Debt
audit_date: 2026-05-02
auditor: gsd-milestone-management
status: tech_debt — all 7 requirements satisfied; one phase (75) has work-tree-complete artifacts not yet committed
---

# Milestone v1.12 — Maintenance & Tech Debt — Audit

**Defined:** 2026-04-30
**Audited:** 2026-05-02
**Scope:** Phases 75, 76, 77, 78
**Theme:** Internal-only milestone — no GitHub Release for `1.12.0`. Refactor (DEDUP/SPLIT), lint cleanup (LINT), automation gate (CI). Public APIs and runtime behavior preserved.

---

## Completion Status Per Phase

| Phase | Title | Plans | Code Status | Verification | Commit Status |
|-------|-------|-------|-------------|--------------|---------------|
| 75 | RunnerView ↔ InlineRunnerModal Deduplication | 7/7 | ✅ Complete in working tree | ✅ `75-VERIFICATION.md` (final gate green) | ⚠️ **uncommitted** — see "Cross-Phase Wiring Issues" |
| 76 | editor-panel-view.ts Decomposition | 5/5 + gap-closure | ✅ Complete and committed | ✅ `76-VERIFICATION.md` (393 LOC, 818/1 skipped tests pass) | ✅ `0406c98` |
| 77 | Eslint Findings Cleanup | 14/14 | ✅ Complete and committed | ✅ `77-VERIFICATION.md` (517 errors → 0; 6 warnings → 2 documented) | ✅ `681f82d`..`99f8afa` (12 commits) |
| 78 | Lint + Test Automation Gate | 2/2 | ✅ Complete and committed | ✅ `78-VERIFICATION.md` (CI-01 verified locally; CI-02 structural pass) | ✅ `8dee957`, `907cec1` |

### Phase 75 — RunnerView ↔ InlineRunnerModal Deduplication

- **Goal achieved:** Shared renderer entry points live under `src/runner/render/` (7 modules: render-footer, render-loop-picker, render-question, render-snippet-picker, render-snippet-fill, render-complete, render-error). Both host shells (`runner-view.ts`, `inline-runner-modal.ts`) delegate to them.
- **DEDUP-01 evidence:** Production scan for duplicate private renderer declarations under `src/views/` returns 0. Hosts retain only chrome/lifecycle/autosave-policy responsibilities.
- **DEDUP-02 evidence:** Inline test LOC reduced 2222 → 1555 (30.0%, target met exactly). View LOC reduced 2345 → 1929 (17.7%).
- **Final gate:** `npm test` → 847/1 skipped pass; `npm run build` → exit 0; `npm run lint` → 0 errors / 2 known warnings; `git diff --check` → exit 0.
- **Risk noted in 75-VERIFICATION.md:** `runner-view.ts` (924 LOC) and `inline-runner-modal.ts` (1005 LOC) are still large host shells; a broader host decomposition was out of phase scope.

### Phase 76 — editor-panel-view.ts Decomposition

- **Goal achieved:** `src/views/editor-panel-view.ts` reduced 1230 LOC → 393 LOC (under the <400 budget). Per-kind form modules created under `src/views/editor-panel/forms/` (7 files including `_shared.ts`); 9 helper modules extracted under `src/views/editor-panel/` (autosave, canvas-listener, canvas-patch, growable-textarea, quick-create-controller, render-form, render-toolbar, save-node-edits, legacy/list-snippet-subfolders).
- **SPLIT-01 evidence:** `wc -l` confirms 393 LOC; canvas-sync subscription remains owned in `EditorPanelView.onOpen` (single subscription contract preserved); `buildKindForm` remains in dispatcher.
- **SPLIT-02 evidence:** Targeted `npm test -- editor-panel` → 93/93 pass; targeted `npm test -- canvas-write-back` → 16/16 pass; full `npm test` → 818 pass / 1 skipped.
- **Implementation note:** During final extraction, `renderNodeFormImpl` initially called `renderFormImpl` directly, breaking spy-based test access; fixed by routing through `host.renderForm(...)` to preserve the spyable surface (documented in `76-SUMMARY.md`).

### Phase 77 — Eslint Findings Cleanup

- **Goal achieved:** `npm run lint` exits 0; 517 errors cleared; 6 warnings reduced to 2 (documented out-of-scope: `obsidianmd/prefer-file-manager-trash-file` × 2 in `src/snippets/snippet-service.ts:240,283`).
- **LINT-01 evidence:** All 14 plans completed across 9 waves. 12 atomic commits (`681f82d`..`99f8afa`). The dominant `obsidianmd/no-static-styles-assignment` violations were converted to CSS class toggles + appended rules in the appropriate per-feature `src/styles/*.css` files (per CLAUDE.md per-feature CSS architecture).
- **Notes from 77-VERIFICATION.md:**
  - 2 pre-existing test failures in `snippet-editor-modal.test.ts` (collision error elements) — unrelated to phase 77 changes; MockEl harness limitation. **NOTE:** by Phase 78 verification, full test suite was passing 818/1 skipped — so these resolved naturally during the milestone.
  - `instanceof TFile` runtime guards introduced in `editor-panel-view.ts` and `inline-runner-modal.ts`; tests updated to use `new TFile()` mock.
  - `no-control-regex` suppressed with rationale (JSON sanitization regex intentionally matches control characters).
  - `no-constant-binary-expression`: dead `|| id` removed after truthy string literal `'(корень snippets)'`; fallback preserved.

### Phase 78 — Lint + Test Automation Gate

- **Goal achieved:** Two-layer gate installed.
  - Layer 1: `.githooks/pre-commit` runs eslint on staged `*.ts` + `npm test`; bypass via `--no-verify` preserved.
  - Layer 2: `.github/workflows/ci.yml` runs `npm ci && npm run build && npm run lint && npm test` on push to `main` and on every PR; Node 18+.
- **CI-01 evidence:** Local verification on disposable `test/lint-gate` branch — introducing `_unusedLintTestVariable` blocked commit; `--no-verify` succeeded.
- **CI-02 evidence:** Workflow file present, valid YAML, correct triggers, correct pipeline order.
- **Pre-flight:** `npm run lint` exit 0 (0 errors, 2 known warnings), `npm test` exit 0 (818 pass, 1 skipped), `npm run build` exit 0.
- **Deferred verification:** CI-04 / CI-05 (red ✕ on PR with deliberate error) require an actual GitHub push of a broken branch — workflow structurally validated but live PR red-status check happens on the next regular PR.

---

## Requirements Coverage (v1.12)

| REQ-ID | Phase | Status | Evidence |
|--------|-------|--------|----------|
| DEDUP-01 | 75 | ✅ Satisfied | `75-VERIFICATION.md` — single declaration per renderer under `src/runner/render/`; production duplicate-declaration scan returns 0 |
| DEDUP-02 | 75 | ✅ Satisfied | `75-VERIFICATION.md` — inline test LOC 2222 → 1555 (30.0%, target met exactly); shared `runner-renderer-host-fixtures.ts` consolidates harness setup |
| SPLIT-01 | 76 | ✅ Satisfied | `76-VERIFICATION.md` — `editor-panel-view.ts` = 393 LOC; per-kind form modules under `src/views/editor-panel/forms/` |
| SPLIT-02 | 76 | ✅ Satisfied | `76-VERIFICATION.md` — `npm test -- editor-panel` 93/93; canvas-write-back 16/16; full suite 818/1 skipped |
| LINT-01 | 77 | ✅ Satisfied | `77-VERIFICATION.md` — `npm run lint` exit 0; 0 errors, 2 documented out-of-scope warnings |
| CI-01 | 78 | ✅ Satisfied | `78-VERIFICATION.md` — pre-commit hook blocks on error; `--no-verify` preserved |
| CI-02 | 78 | ✅ Satisfied (structural) | `78-VERIFICATION.md` — workflow file valid; live red ✕ PR check deferred to next real PR |

**Coverage:** 7 / 7 requirements satisfied. **Zero gaps in milestone scope.**

---

## Cross-Phase Wiring Issues

### 1. ⚠️ Phase 75 work uncommitted (HIGH-priority audit finding)

The Phase 75 acceptance gate is GREEN (`75-VERIFICATION.md` shows 847/1-skipped tests, build clean, lint clean), but the actual source-file deltas, new modules under `src/runner/render/`, new shared tests under `src/__tests__/runner/`, and the per-plan SUMMARY/VERIFICATION docs are present **only in the working tree** — not committed. `git status` shows:

- Modified (uncommitted): `src/views/runner-view.ts`, `src/views/inline-runner-modal.ts`, 4 inline-runner test files, `src/__tests__/views/runner-snippet-picker.test.ts`, `.planning/ROADMAP.md`.
- Untracked: `src/runner/render/`, `src/runner/runner-host.ts`, `src/runner/runner-renderer.ts`, `src/runner/runner-text.ts`, `src/runner/snippet-label.ts`, 8 new test files in `src/__tests__/runner/`, the entire `.planning/phases/75-runner-view-inline-runner-deduplication/` directory.
- ROADMAP.md still lists Phase 75 as "Not started" in the progress table (line 403) and "75 pending" in the bullet header (line 21) despite verification being green.

**Implication for milestone close:** the Phase 76 commit (`0406c98 refactor(76): decompose editor panel view`) landed AFTER Phase 75's work was complete-in-tree, meaning Phase 76 was tested against a working tree that already contained Phase 75's renderer extraction. This is fine for code health (everything passes together) but means git history alone does not tell the v1.12 story — Phase 75 has no atomic commit boundary on `main`.

**Risk:** any future operation that resets the working tree (e.g. `git stash` then accidental drop, or a forced clean) loses Phase 75. The verification gate cannot be re-run from `main` HEAD.

**Recommended next action (outside this audit's scope per "NO GIT COMMANDS" constraint):** the next session should commit Phase 75 changes atomically per plan (75-01 through 75-07), update ROADMAP.md to mark Phase 75 complete, and update the progress table.

### 2. Phase 76 commit landed after Phase 75 work-in-tree

`git log` shows commit ordering: 78 → 77 → 76, with Phase 75's work uncommitted underneath. The dependency graph in REQUIREMENTS.md says all four phases are independent except 78-after-77. The actual execution order (77 → 78 → 76 with 75 in-tree throughout) honored that constraint.

### 3. ROADMAP.md status drift

Lines 21, 292, 306, 403–406 of ROADMAP.md are partially out of date:
- Line 21: "Phase 76 complete, Phase 77 complete, Phase 78 complete; 75 pending" — but Phase 75 verification is green; this label is stale relative to working-tree state.
- Line 292: Phase 75 status block ✅ — already updated.
- Line 306: Phase 76 status block ✅ — already updated.
- Lines 403–404: progress table shows 75 and 76 as "0/? Not started". Phase 76 should read "5/5 Complete 2026-05-01"; Phase 75 should read "7/7 Complete 2026-05-01" once committed.

These are documentation-only discrepancies; verification reports are the source of truth.

---

## Tech Debt Outcomes

### Resolved during v1.12 (relative to milestone open on 2026-04-30)

- 517 ESLint errors → 0 (LINT-01)
- 6 ESLint warnings → 2 (4 resolved; 2 documented out-of-scope as `prefer-file-manager-trash-file`)
- `runner-view.ts` 1145 LOC → 924 LOC (–19.3%)
- `inline-runner-modal.ts` 1205 LOC → 1005 LOC (–16.6%)
- Inline-runner test family LOC: 2222 → 1555 (–30.0%)
- `editor-panel-view.ts` 1230 LOC → 393 LOC (–68.0%)
- 6 new shared `src/runner/render/*.ts` modules (renderer extraction)
- 16 new modules under `src/views/editor-panel/` (forms + helpers)
- Pre-commit hook installed (`.githooks/pre-commit`)
- GitHub Actions workflow installed (`.github/workflows/ci.yml`)

### New tech debt introduced in v1.12

- **Phase 75 atomic-commit gap (cross-phase wiring issue #1).** Verification artifacts and source live in working tree only. Will be closed by next-session commit pass.
- **CI-04 / CI-05 live red-status verification deferred.** Workflow is structurally valid but has not been observed failing on a real GitHub PR with a deliberate lint/test error. Carry-over for the first PR to use the gate.

### Carried forward (no v1.12 work and no v1.12 cause)

- **Pre-existing 2 lint warnings** in `src/snippets/snippet-service.ts:240,283` — `obsidianmd/prefer-file-manager-trash-file` (`Vault.trash()` → `app.fileManager.trashFile()`). Documented out-of-scope in REQUIREMENTS.md "Future Requirements"; safe to address in a future phase.
- **MEDIUM-5 from CONCERNS.md** — `protocol-runner.ts` (819 LOC) and `snippet-manager-view.ts` (1037 LOC) are still large; explicitly deferred from v1.12 scope per REQUIREMENTS.md (re-evaluate now that DEDUP-01 has shipped a renderer-extraction template the snippet manager could follow).
- **Verification documentation backfill (carry-over from v1.10)** — Phases 64, 66, 67 still lack formal `gsd-verifier` `VERIFICATION.md` (UAT-PASS evidence exists). Pattern: v1.8 Phase 58 backfill.
- **Nyquist `VALIDATION.md` debt (project-wide carry-over)** — Phase 63 draft, Phases 64–78 missing entirely. v1.12 phases (75–78) ship without `VALIDATION.md` artifacts; matches the existing pattern.
- **3 open debug sessions** (`inline-runner-drag-resets-size`, `inline-runner-tab-switch-resets-size`, `phase-27-regressions`).
- **2 stale seeds** (`duplicate-node.md`, `quick-node-creation.md`) for v1.6-delivered work.
- **`@deprecated` `LoopStartNode` / `LoopEndNode`** retained for Migration Check enumeration (carry-over from v1.7).

---

## Out-of-Scope Compliance

REQUIREMENTS.md "Out of Scope" exclusions for v1.12:

| Exclusion | Compliance |
|-----------|------------|
| No new user-facing features | ✅ Compliant — no canvas authoring, no new UI, no new node kinds, no settings additions |
| No GitHub Release for `1.12.0` | ✅ Compliant — no release commit, no tag, no `manifest.json` version bump in this milestone |
| No changes to snippet system / runner state machine / canvas parser / graph validator / session persistence | ✅ Compliant — Phase 75 is render-extraction only; ProtocolRunner state-machine and snippet-service untouched |
| No dependency upgrades | ✅ Compliant — `package.json` runtime dep tree unchanged in 75/76/77; Phase 78 added only the workflow file (no new deps) |
| No documentation overhaul | ✅ Compliant — README/CONTRIBUTING not touched; phase-internal docs only |

---

## Audit Verdict

**Status: tech_debt — 7/7 requirements satisfied with one in-flight wiring issue (uncommitted Phase 75) and one deferred external verification (CI-04/05 live red-status).**

Path A (close now, document the wiring issue) is appropriate because:

1. All seven REQUIREMENTS.md items have green verification gates.
2. The Phase 75 commit gap is mechanical (artifacts exist; just need atomic commits) and does not change the truth value of any acceptance criterion.
3. The CI-04/05 deferral is the standard pattern when a CI gate is freshly installed — observation comes on the first natural PR.
4. v1.12 is an internal-only milestone; no public release is gated on this audit.

**No blockers. Milestone is closeable.**
