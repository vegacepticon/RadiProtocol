# RadiProtocol — v1.12 Requirements

**Milestone:** v1.12 Maintenance & Tech Debt
**Defined:** 2026-04-30
**Source:** Tech-debt items captured in `.planning/codebase/CONCERNS.md` (2026-04-30 scan), promoted from backlog 999.1..999.4.

This milestone has **no user-facing surface**. Every requirement is internal — refactoring, lint cleanup, or build/CI infrastructure. End users on `1.11.0` see no behavior change. There is no GitHub Release for v1.12; if any regression is found and fixed during this milestone, it ships as a `1.11.x` patch.

---

## Active Requirements

### Refactoring

- [ ] **DEDUP-01**: A single shared render module under `src/runner/` (e.g. `RunnerRenderer`) owns all per-step UI rendering — `renderQuestion`, `renderAnswer`, `renderSnippetPicker`, `renderTextBlock`, `renderLoop` (and any peer methods), and is consumed by both `RunnerView` (sidebar/tab) and `InlineRunnerModal` (floating modal). For any given protocol step, both surfaces produce DOM with the same structure, classes, and content; visual differences are limited to host chrome (sidebar leaf vs modal frame) and are isolated in the host shells.

- [ ] **DEDUP-02**: Runner-side test coverage is consolidated. The parallel `inline-runner-*.test.ts` files (`inline-runner-modal.test.ts`, `inline-runner-modal-loop-body-file-bound.test.ts`, `inline-runner-modal-output-toolbar.test.ts`, `inline-runner-position.test.ts`, `inline-runner-layout.test.ts`) are merged into shared fixtures that exercise the renderer once and the host shells once each. Total runner-related test LOC reduced by at least 30%; **zero behaviors lost** (every assertion in the previous trees has a corresponding assertion in the new structure or is documented as obsoleted by the refactor).

- [ ] **SPLIT-01**: `src/views/editor-panel-view.ts` is decomposed into per-node-kind form modules under `src/views/editor-panel/forms/` (one file per kind: `question-form.ts`, `answer-form.ts`, `text-block-form.ts`, `snippet-form.ts`, `loop-form.ts`, plus any other kinds currently handled inline). The remaining `editor-panel-view.ts` is **<400 LOC** and acts as a dispatcher — registers forms, routes node-selection events to the right form, owns shared concerns (canvas-sync subscription, toolbar) only.

- [ ] **SPLIT-02**: All six existing `editor-panel-*.test.ts` files (`editor-panel-create.test.ts`, `editor-panel-forms.test.ts`, `editor-panel-loop-form.test.ts`, `editor-panel-canvas-sync.test.ts`, `editor-panel-snippet-picker.test.ts`, `editor-panel.test.ts`) continue to pass after the split. Tests may be mechanically split to mirror the new module boundaries provided every existing test case appears in exactly one resulting file with the same assertion semantics.

### Lint Cleanup

- [ ] **LINT-01**: `npm run lint` exits with code 0 on a clean `main` checkout. All 517 errors and 6 warnings surfaced by quick task `260430-uas` (commit `07aa79d`) are resolved, with the dominant `obsidianmd/no-static-styles-assignment` violations across `src/views/` converted to CSS class toggles + rules in the appropriate `src/styles/*.css` file (per CLAUDE.md's per-feature CSS architecture). Rule tuning (disabling a rule project-wide or per-file) is permitted only with a written justification in the same commit message — the default is to fix the violation.

### CI / Automation

- [ ] **CI-01**: A pre-commit git hook, tracked under `.githooks/pre-commit` and wired via `git config core.hooksPath .githooks` (or equivalent automation in `package.json`'s `prepare` script), runs `eslint` against staged `*.ts` files and `npm test` before allowing a commit. The hook fails the commit on any lint error or test failure. Bypass via `git commit --no-verify` is preserved (intentional escape hatch — CI is the safety net).

- [ ] **CI-02**: A GitHub Actions workflow at `.github/workflows/ci.yml` runs on every `push` to `main` and on every pull request, executing `npm ci && npm run build && npm run lint && npm test`. The workflow fails (non-zero exit, red ✕ in GitHub UI) on any of: install, build, lint error, or test failure. The workflow uses a Node.js version matching the project's documented dev environment (Node 18+).

---

## Future Requirements (deferred from v1.12)

- **MEDIUM-5** (deferred from CONCERNS.md): `protocol-runner.ts` (819 LOC) and `snippet-manager-view.ts` (1037 LOC) are also large. Re-evaluate after DEDUP-01 ships — if the runner extracts cleanly, the same pattern applies to snippets. Not in v1.12 scope.

- **Lint-warning fixes**: LINT-01 targets the 517 errors as the gating bar. The 6 warnings (and any new ones surfaced after error fixes) are nice-to-have; in scope only if cheap.

- **Husky migration**: CI-01 uses a hand-written hook. If team grows or hooks become more complex, revisit `husky` + `lint-staged` later.

---

## Out of Scope (explicit exclusions)

- **No new user-facing features.** No canvas authoring. No new UI. No new node kinds. No settings additions. v1.12 is internal-only.
- **No GitHub Release for `1.12.0`.** End users on `1.11.0` see no behavior change. If a regression is found and fixed during the milestone, it ships as `1.11.x` patch.
- **No changes to the snippet system, runner state machine, canvas parser, graph validator, or session persistence.** All refactors are structural — public APIs and runtime behavior are preserved.
- **No dependency upgrades.** This milestone touches build infra (CI), not the runtime dep tree. `npm audit` issues raised in 260430-uas are out of scope.
- **No documentation overhaul.** README/CONTRIBUTING updates are limited to mentioning the new gate (one paragraph max).

---

## Traceability

Filled by the roadmapper. Each REQ-ID maps to exactly one phase.

| REQ-ID | Phase | Status |
|---|---|---|
| DEDUP-01 | TBD (Phase 75) | Active |
| DEDUP-02 | TBD (Phase 75) | Active |
| SPLIT-01 | TBD (Phase 76) | Active |
| SPLIT-02 | TBD (Phase 76) | Active |
| LINT-01 | TBD (Phase 77) | Active |
| CI-01 | TBD (Phase 78) | Active |
| CI-02 | TBD (Phase 78) | Active |

**Phase ordering constraint:** Phase 78 (CI gate) MUST follow Phase 77 (lint cleanup). Reverse order is unworkable — the gate would block all subsequent commits until 523 findings cleared in one go. Phases 75 and 76 are independent of 77/78 and of each other.
