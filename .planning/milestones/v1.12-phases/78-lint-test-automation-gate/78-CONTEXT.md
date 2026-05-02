# Phase 78 Context: Lint + Test Automation Gate

## Background

Phase 77 cleared all 517 ESLint errors + 6 warnings. Phase 78 prevents regression by installing two-layer gate:
1. **Local fast feedback**: pre-commit git hook at `.githooks/pre-commit`
2. **Safety net**: GitHub Actions CI workflow at `.github/workflows/ci.yml`

## Current state

- No `.githooks/` directory exists
- No `.github/workflows/` directory exists
- No `husky` or `lint-staged` in dependencies
- `npm run lint` → `eslint .` (0 errors, 2 warnings)
- `npm test` → `vitest run` (816 passed, 2 pre-existing failures, 1 skipped)
- No `prepare` script in `package.json`

## Decisions

### Pre-commit hook design
- **Plain shell script** (no husky/lint-staged dependency) — keeps the plugin repo lightweight, zero npm install overhead
- Script location: `.githooks/pre-commit`
- Wiring: agent runs `git config core.hooksPath .githooks` (repo-local, not global)
- Scope: runs `eslint` on staged `*.ts` files + `npm test`
- Escape hatch: `git commit --no-verify` bypasses the hook (preserved per requirement)
- Test filtering: runs full `npm test` (vitest is fast enough at ~15s)

### GitHub Actions CI
- Workflow: `.github/workflows/ci.yml`
- Triggers: `push` to `main`, `pull_request` (any branch)
- Node version: 18 (project baseline per ROADMAP)
- Steps: `npm ci` → `npm run build` → `npm run lint` → `npm test`
- No matrix needed — single Node 18 run is sufficient for Obsidian plugin

### Plan split
- **78-01**: Pre-commit hook (`.githooks/pre-commit` + wire it + verify CI-01, CI-02)
- **78-02**: GitHub Actions workflow (`.github/workflows/ci.yml` + verify CI-03, CI-04, CI-05)

## Dependencies

- Phase 77 complete ✅ (lint clean, tests green)
- `git` repo on `main` branch

## Requirements covered

- CI-01: Pre-commit hook runs eslint + test, blocks on failure
- CI-02: `--no-verify` escape hatch works
- CI-03: GitHub Actions workflow exists, triggers correctly, runs full pipeline
- CI-04: PR with lint error → red CI status
- CI-05: PR with failing test → red CI status
