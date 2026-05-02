# Phase 80: Reusable CSS Utilities + Stylelint Gate

## Goal
Extract reusable CSS utility classes from per-feature files and wire stylelint into `npm run lint`, pre-commit hook, and CI.

## Scope
- New `src/styles/_utilities.css` with shared flex/gap/visibility utilities
- Register utilities first in `esbuild.config.mjs` CSS_FILES
- Install `stylelint` + `stylelint-config-standard`
- Config `stylelint.config.mjs` focused on duplicate properties + invalid selectors
- Update `package.json` lint script
- Update `.githooks/pre-commit` to run stylelint on staged CSS
- Migrate at least one duplicated pattern per existing feature CSS file

## Execution Steps
1. Audit `src/styles/*.css` for duplicated flex/gap/visibility patterns
2. Create `_utilities.css` with `.rp-stack`, `.rp-row`, `.rp-center`, `.rp-hidden`, `.rp-disabled`
3. Register `_utilities` in esbuild CSS_FILES
4. Install stylelint devDependencies
5. Create stylelint.config.mjs
6. Update npm run lint
7. Update pre-commit hook
8. Migrate patterns in 8 feature files
9. Update TS call sites to include utility classes
10. Run build/test/lint
11. Commit

## Verification
See VERIFICATION.md

## Commits
- `c1d15ba` — Phase 80 complete
