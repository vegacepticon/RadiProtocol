# Phase 79: Typed Constants for Runner States and CSS Classes

## Goal
Replace stringly-typed runner-state literals and shared cross-file CSS class names with typed constants, reducing AI-agent friction and regression surface.

## Scope
- `src/constants/runner-states.ts` — new; RUNNER_STATUS + RunnerStatus union
- `src/constants/css-classes.ts` — new; CSS_CLASS + CssClass union
- Call sites in `src/runner/`, `src/views/`, `src/runner/render/`
- Out of scope: test fixtures (not shared production code), one-off CSS classes

## Execution Steps
1. Create `src/constants/runner-states.ts` with exhaustive runner-state constants
2. Replace all runner-state string literals in `src/runner/protocol-runner.ts` and `src/runner/runner-state.ts`
3. Verify with `git grep -nP "['\"]awaiting-snippet-(pick|fill)['\"]" src/` → canonical file only
4. Create `src/constants/css-classes.ts` with shared CSS class constants
5. Replace shared CSS class literals in 7 files: runner-view, inline-runner-modal, snippet-editor-modal, snippet-form, runner-host, render-snippet-picker, render-snippet-fill
6. Run build + test + lint
7. Commit

## Verification
See VERIFICATION.md

## Commits
- `6548c1f` — runner states constants
- `1587341` — CSS classes constants
