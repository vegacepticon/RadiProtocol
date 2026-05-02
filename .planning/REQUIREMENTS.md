# RadiProtocol — v1.13 Requirements

**Milestone:** v1.13 AI-Agent Friction Reduction & Codebase Health
**Defined:** 2026-05-02
**Source:** Recurring failure modes captured in CLAUDE.md (executor agents silently deleting unrelated CSS rules / TS functions in shared files), v1.12 MILESTONE-AUDIT.md "tech_debt" carry-overs (`SnippetManagerView` 1037 LOC, `RunnerView` 924 LOC after Phase 75), and the v1.12 Phase 77 lint cleanup which surfaced how stringly-typed runner-state literals and inline `el.style.foo` patterns make it easy to introduce regressions in shared files.

This milestone has **no user-facing surface**. Every requirement is internal — typed surfaces, reusable CSS utilities + a stylesheet linter, typed DOM helpers, and two further god-file decompositions following the v1.12 Phase 75/76 extraction template. End users on `1.11.0` see no behavior change. There is no GitHub Release for v1.13; if any regression is found and fixed during this milestone, it ships as a `1.11.x` patch.

The connecting thesis: **make the safe path obvious to AI executors and human contributors alike.** Stringly-typed states + inline styles + 1000+-LOC views are not bugs by themselves — they are friction multipliers that turn an unrelated edit into a regression.

---

## Active Requirements

### Typed Constants

- [ ] **EXTRACT-TYPES-01**: A typed constants module (e.g. `src/runner/runner-state-names.ts` and `src/styles/css-classes.ts` or a single `src/types/constants.ts` — exact file boundaries to be decided in Phase 79 planning) replaces the stringly-typed runner-state literals and shared CSS class names that currently live as inline string literals across the codebase.
  - Runner state names — every occurrence of the literal strings `'idle'`, `'at-node'`, `'awaiting-snippet-pick'`, `'awaiting-snippet-fill'`, `'awaiting-loop-pick'`, `'complete'`, and `'error'` outside of the discriminated-union type definition itself uses an exported `const` (e.g. `RUNNER_STATE.AWAITING_SNIPPET_PICK`) or imports the existing union type — `git grep -nP "['\"]awaiting-snippet-(pick|fill)['\"]" src/` returns matches only in the canonical type / constants file.
  - Shared CSS class names used in two or more `src/` files (the `rp-runner-footer-row`, `rp-loop-exit-btn`, `rp-snippet-tree-*`, `rp-chip-*`, etc. families introduced in Phases 75/77) are exported as `const` from a single module and consumed by name; one-off classes used in a single `src/styles/*.css` file plus a single `src/views/*.ts` file are out of scope (the friction is in cross-file drift).
  - The full vitest suite continues to pass (`npm test` exits 0); the test fixtures may consume the same constants for additional safety, but assertion semantics are preserved.
  - `npm run lint` continues to exit 0 — no rule disables added without written justification (per v1.12 Phase 77 contract).

### CSS Utilities + Stylelint

- [ ] **SPLIT-CSS-01**: Reusable CSS utility classes are extracted from the per-feature `src/styles/*.css` files where the same flex/gap/visibility patterns recur (e.g. `.rp-row` for horizontal flex with gap, `.rp-stack` for vertical stack, hidden/disabled state classes). The utilities live in a new `src/styles/_utilities.css` (registered in `esbuild.config.mjs` `CSS_FILES` ahead of the per-feature files so feature rules can override). At least one duplicated pattern per feature file is migrated to the utility class — the goal is to demonstrate the pattern, not exhaustively migrate every rule.
  - A `stylelint` config (`stylelint.config.mjs` or equivalent) is added as a devDependency; rules at minimum cover duplicated property declarations, invalid selectors, and a project-style rule for the per-feature `/* Phase N: description */` comment header convention from CLAUDE.md (lint-only, not a hard fail) where mechanically expressible.
  - `npm run lint` is updated to run `stylelint 'src/styles/**/*.css'` alongside ESLint; both gates exit 0 on a clean `main` checkout.
  - `.githooks/pre-commit` (Phase 78) is updated to run stylelint on staged `src/styles/**/*.css` files; the existing eslint-on-staged-`*.ts` and `npm test` behavior is preserved (append, do not rewrite).
  - The GitHub Actions workflow `.github/workflows/ci.yml` (Phase 78) continues to invoke `npm run lint` (which now covers stylelint), exiting non-zero on stylelint violation. No separate workflow file added.
  - `npm run build` continues to regenerate `styles.css` cleanly via the existing esbuild concatenation pipeline; new utilities file ordering preserved.

### Typed DOM Helpers

- [ ] **TYPE-SAFETY-01**: A typed `dom-helpers` module (e.g. `src/utils/dom-helpers.ts`) wraps the most common Obsidian DOM idioms with typed return types. At minimum:
  - `createButton(parent, opts)` returns `HTMLButtonElement` (not `HTMLElement`), narrowing the `as HTMLButtonElement` casts that recur across `runner-view.ts`, `inline-runner-modal.ts`, `editor-panel-view.ts`, and `snippet-manager-view.ts`.
  - `createInput(parent, opts)` returns `HTMLInputElement`; `createTextarea(parent, opts)` returns `HTMLTextAreaElement`.
  - `registerEvent(scope, target, event, handler)` is a typed wrapper over `registerDomEvent` that narrows the event type by `event` name (`'click'` → `MouseEvent`, `'input'` → `Event`, etc.) for the dozen or so events the codebase actually uses; rest fall back to `Event`.
  - At least the **hot-path call sites** (the runner shared renderer under `src/runner/render/*` plus `editor-panel-view.ts` dispatcher) consume the typed helpers — not every `createEl` call needs migration; the goal is the typed surface, not a full sweep.
  - The mock used by tests (`src/__mocks__/obsidian.ts`) is updated so the typed helpers work in vitest without `as any` escape hatches in test files; existing mock-extension points (e.g. `recordedCssProps`) are preserved.
  - `npm test` exits 0; `npm run lint` exits 0; `npm run build` exits 0.

### View Decomposition (round 2)

- [ ] **REFACTOR-SNIPPET-MGR-01**: `src/views/snippet-manager-view.ts` is decomposed by extracting its three behavioral surfaces — the snippet **tree controller** (folder navigation, expand/collapse, drag-source/drag-target), the **modal controller** (create/edit/rename/delete dispatch, snippet-editor-modal coordination), and the **drag-and-drop controller** (drop validation, vault rewrite via `rewriteCanvasRefs`, debounced refresh) — into per-controller modules under `src/views/snippet-manager/` (one file per controller, plus a `_shared.ts` for any cross-controller types if needed). The remaining `snippet-manager-view.ts` becomes a thin host coordinator under **400 LOC** (mirrors the v1.12 Phase 76 dispatcher budget for `editor-panel-view.ts`).
  - All existing snippet-manager-related tests under `src/__tests__/` continue to pass without modification of their assertion semantics — `npm test` exits 0 with the full suite green; tests may be mechanically split to mirror the new module boundaries provided every existing test case appears in exactly one resulting file.
  - The Phase 32 vault watcher / debounce pattern (120ms, prefix-filtered) and the Phase 32/34 `rewriteCanvasRefs` integration (with `WriteMutex` per file path) are preserved verbatim — no behavior change to snippet CRUD, drag-drop, or canvas reference rewriting.
  - The 2 lint warnings in `snippet-service.ts:240,283` (`obsidianmd/prefer-file-manager-trash-file`, deferred from v1.12) are re-evaluated during this phase; either fixed (preferred — cheap and adjacent to in-scope work) or explicitly re-deferred in the phase's VERIFICATION.md with rationale.
  - `npm run lint` continues to exit 0; `npm run build` continues to exit 0.

- [ ] **REFACTOR-RUNNER-VIEW-01**: `src/views/runner-view.ts` (924 LOC after Phase 75) is further trimmed by extracting a **`SessionRecoveryCoordinator`** module to `src/runner/session-recovery-coordinator.ts` (or `src/views/runner/`, exact location decided in Phase 83 planning). The coordinator owns:
  - Autosave/append-policy — the rules that decide when `RunnerView` writes a session snapshot via `SessionService` (preserved from Phase 7 contract).
  - Resume prompt — the dialog the user sees on workspace re-open when an in-flight session exists for the canvas.
  - Canvas-modification-warning — the prompt that fires when the underlying `.canvas` has changed since the session started (preserved from Phase 7 contract per Pitfall #1 "never modify .canvas while open").
  - The remaining `runner-view.ts` is responsible only for ItemView lifecycle (`onOpen`/`onClose`), workspace `getState`/`setState`, and host chrome around the Phase 75 shared renderer (`renderInto(container, runnerHost)`); LOC target is **<700 LOC** (a softer budget than Phase 76's 400, because the View also owns canvas-selector mounting, output-toolbar rendering for sidebar/tab modes, and the Phase 65 footer wrapper). The exact target is to be confirmed during Phase 83 planning.
  - `InlineRunnerModal` does NOT receive an equivalent coordinator extraction in this phase — its session-recovery surface is intentionally narrower (modal-as-buffer, append-to-end, source-note binding from Phase 54) and out of scope.
  - All existing runner-view + inline-runner tests under `src/__tests__/` (including the Phase 75 shared fixtures) continue to pass without modification of their assertion semantics — `npm test` exits 0.
  - The Phase 75 contract is preserved — host shells delegate per-step rendering to the shared `src/runner/render/*` modules; the coordinator extraction is orthogonal to renderer decomposition.
  - `npm run lint` continues to exit 0; `npm run build` continues to exit 0.

---

## Future Requirements (deferred from v1.13)

- **MEDIUM-5 from CONCERNS.md (engine half)** — `protocol-runner.ts` (819 LOC) decomposition. v1.13 only touches the View shells (`SnippetManagerView`, `RunnerView`); the runner engine itself is out of scope to keep the milestone bounded. Re-evaluate after Phase 83 lands — the View extraction may have surfaced engine seams worth pulling on.

- **InlineRunnerModal `SessionRecoveryCoordinator` adoption** — REFACTOR-RUNNER-VIEW-01 deliberately scopes the coordinator to `RunnerView` only. If Phase 83 produces a clean coordinator surface, a follow-up phase in v1.14 (or a quick task) can adopt it for the inline modal too — but the inline modal's Phase 54 modal-as-buffer / append-to-end / source-note-binding contract makes the surfaces non-identical and that's what makes a forced extraction risky.

- **Exhaustive CSS utility migration** — SPLIT-CSS-01 demonstrates the pattern with at-least-one-per-feature; a full sweep over every duplicated flex/gap rule across the 6 per-feature CSS files is a follow-up.

- **Exhaustive `dom-helpers` migration** — TYPE-SAFETY-01 covers the hot paths (runner shared renderer + editor-panel dispatcher). A full sweep over the long-tail `createEl` call sites in `settings.ts`, `snippet-fill-in-modal.ts`, `snippet-editor-modal.ts`, `snippet-chip-editor.ts`, etc. is a follow-up.

- **Husky migration** — pre-commit hook is still hand-written. If team grows or hooks become more complex, revisit `husky` + `lint-staged` (carry-over from v1.12 Future Requirements).

- **2 deferred lint warnings** — `obsidianmd/prefer-file-manager-trash-file` × 2 in `snippet-service.ts:240,283`. REFACTOR-SNIPPET-MGR-01 re-evaluates them; if not fixed there, they remain a documented future requirement.

---

## Out of Scope (explicit exclusions)

- **No new user-facing features.** No canvas authoring. No new UI. No new node kinds. No settings additions. v1.13 is internal-only.
- **No GitHub Release for `1.13.0`.** End users on `1.11.0` see no behavior change. If a regression is found and fixed during the milestone, it ships as `1.11.x` patch.
- **No changes to the canvas parser, graph validator, runner state machine, snippet system, or session persistence.** All refactors are structural — public APIs and runtime behavior are preserved. EXTRACT-TYPES-01 specifically replaces *literal occurrences* of state names; the discriminated-union type definitions and the runner state machine itself are untouched.
- **No engine decomposition.** `protocol-runner.ts` (819 LOC) and `canvas-parser.ts` are out of scope. v1.13 only addresses Views and shared utilities.
- **No `InlineRunnerModal` coordinator extraction.** REFACTOR-RUNNER-VIEW-01 is sidebar/tab `RunnerView` only; the inline modal's surface is intentionally narrower.
- **No exhaustive sweeps.** TYPE-SAFETY-01 and SPLIT-CSS-01 demonstrate the pattern at the hot paths; full migration across every call site / every duplicated CSS rule is deferred to follow-up phases.
- **No dependency upgrades** beyond the `stylelint` devDependency required for SPLIT-CSS-01. Other `npm audit` issues remain out of scope.
- **No documentation overhaul.** README/CONTRIBUTING updates are limited to mentioning the new stylelint gate and the typed-constants/dom-helpers modules (one paragraph each, max).

---

## Traceability

Filled by the roadmapper. Each REQ-ID maps to exactly one phase.

| REQ-ID | Phase | Status |
|---|---|---|
| EXTRACT-TYPES-01 | 79 | Active |
| SPLIT-CSS-01 | 80 | Active |
| TYPE-SAFETY-01 | 81 | Active |
| REFACTOR-SNIPPET-MGR-01 | 82 | Active |
| REFACTOR-RUNNER-VIEW-01 | 83 | Active |

**Phase ordering constraint:** Phases 79, 80, and 81 are independent foundations and may run in any order or in parallel. Phases 82 and 83 are independent of each other and of the foundations, but **strongly benefit from EXTRACT-TYPES-01 (79) and TYPE-SAFETY-01 (81) landing first** — the View decompositions move many call sites of stringly-typed states and `as HTMLButtonElement` casts, and rewriting them once against the typed surfaces costs less than rewriting them twice. The recommended (but not strictly required) execution order is 79 → 81 → 80 → 82 → 83, with 80 (stylelint) interleaved wherever convenient since it is fully orthogonal.

**Hard dependency:** none. Soft dependency captured above.

**Pre-existing v1.12 deferred item:** Phase 75 atomic-commit cleanup should land before Phase 83 (`RunnerView` further decomposition) to avoid a three-way diff hazard between the working-tree-only Phase 75 changes, the v1.13 typed surface migrations, and the coordinator extraction itself.
