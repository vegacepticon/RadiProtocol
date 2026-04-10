---
phase: 01-project-scaffold-and-canvas-parsing-foundation
plan: "01"
subsystem: infra
tags: [obsidian-plugin, esbuild, typescript, eslint, dotenv, scaffold]

requires: []
provides:
  - package.json with full devDependency set (esbuild, TypeScript, ESLint, dotenv, obsidian)
  - tsconfig.json with strict TypeScript config and noUncheckedIndexedAccess
  - manifest.json with minAppVersion 1.5.7 (NFR-03 compliant)
  - esbuild.config.mjs with dotenv-based dev vault copy on rebuild (D-01, D-02)
  - version-bump.mjs npm version script
  - .gitignore, .env.example, LICENSE, styles.css, versions.json
  - package-lock.json (reproducible installs)
affects:
  - 01-02-directory-structure-stubs
  - 01-05-eslint-and-build
  - all subsequent plans (depend on package.json and tsconfig.json)

tech-stack:
  added:
    - esbuild@0.28.0 (bundler)
    - typescript@6.0.2
    - obsidian@1.12.3 (types)
    - dotenv@17.4.0 (dev vault path loading)
    - builtin-modules@4.0.0 (esbuild external list)
    - "@eslint/js@9.30.1"
    - eslint-plugin-obsidianmd@0.1.9
    - typescript-eslint@8.58.0
    - globals@17.4.0
    - jiti@2.6.1
  patterns:
    - dev vault copy via esbuild onEnd plugin reading OBSIDIAN_DEV_VAULT_PATH from .env
    - dotenv loaded at top of esbuild.config.mjs (not bundled into plugin output)
    - all build output (main.js, main.js.map) gitignored

key-files:
  created:
    - package.json
    - tsconfig.json
    - manifest.json
    - versions.json
    - styles.css
    - esbuild.config.mjs
    - .env.example
    - .gitignore
    - version-bump.mjs
    - LICENSE
    - package-lock.json
  modified: []

key-decisions:
  - "@eslint/js downgraded from 10.0.1 to 9.30.1 — eslint-plugin-obsidianmd@0.1.9 requires ^9.30.1"
  - "builtin-modules@4.0.0 added to devDeps — required by esbuild.config.mjs but missing from plan spec"
  - "npm install uses --legacy-peer-deps — eslint-plugin-obsidianmd@0.1.9 pins obsidian@1.8.7 but project uses 1.12.3"

patterns-established:
  - "esbuild config uses top-level await ESM; must be .mjs extension"
  - "dev vault copy is silent no-op when OBSIDIAN_DEV_VAULT_PATH not set — safe for CI"

requirements-completed: [DEV-01, DEV-02, DEV-03, NFR-02, NFR-03, NFR-06, NFR-10]

duration: 3min
completed: 2026-04-05
---

# Phase 01 Plan 01: Plugin Scaffold Setup Summary

**Obsidian plugin scaffold with esbuild config, dotenv-based dev vault copy, strict TypeScript, and full devDependency set installed and verified**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-05T18:38:42Z
- **Completed:** 2026-04-05T18:41:49Z
- **Tasks:** 3
- **Files modified:** 11 created + 1 (package-lock.json)

## Accomplishments
- Full plugin scaffold from official Obsidian template with all required files
- esbuild.config.mjs with dotenv-based OBSIDIAN_DEV_VAULT_PATH copy on each successful rebuild
- `npm install` verified clean (0 vulnerabilities, `node_modules/obsidian` present)
- Syntax-verified esbuild config: loads correctly, fails only on missing `src/main.ts` (expected)

## Task Commits

Each task was committed atomically:

1. **Task 01-01-01: package.json, tsconfig.json, manifest files** - `3866fdb` (chore)
2. **Task 01-01-02: esbuild.config.mjs, .env.example, .gitignore** - `0a670ac` (chore)
3. **Task 01-01-03: version-bump.mjs, LICENSE, restore files** - `d588246` (chore)
4. **package-lock.json from npm install** - `94bbdf4` (chore)

## Files Created/Modified
- `package.json` - Project manifest with full devDependency set; @eslint/js pinned to 9.30.1
- `package-lock.json` - Reproducible install lockfile (302 packages)
- `tsconfig.json` - Strict TypeScript config: noUncheckedIndexedAccess, strictNullChecks, isolatedModules
- `manifest.json` - Plugin manifest with minAppVersion 1.5.7 (NFR-03)
- `versions.json` - Version compatibility map: 0.1.0 -> 1.5.7
- `styles.css` - Empty placeholder (Phase 3 will populate)
- `esbuild.config.mjs` - Build config with devVaultCopyPlugin using dotenv (D-01, D-02)
- `.env.example` - Template for OBSIDIAN_DEV_VAULT_PATH (committed; .env gitignored)
- `.gitignore` - Excludes node_modules, main.js, .env, OS files
- `version-bump.mjs` - npm version script syncing manifest.json and versions.json
- `LICENSE` - MIT License, 2026, RadiProtocol Contributors

## Decisions Made
- `@eslint/js` downgraded from `10.0.1` (plan spec) to `9.30.1` — peer dependency requirement of `eslint-plugin-obsidianmd@0.1.9`
- `builtin-modules@4.0.0` added to devDependencies — required by esbuild.config.mjs import but omitted from plan spec
- `npm install --legacy-peer-deps` used — eslint-plugin-obsidianmd@0.1.9 pins `obsidian@1.8.7` as peer dep, project uses `1.12.3`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @eslint/js version incompatible with eslint-plugin-obsidianmd peer dependency**
- **Found during:** Task 01-01-01 (npm install)
- **Issue:** Plan specified `@eslint/js@10.0.1` but `eslint-plugin-obsidianmd@0.1.9` requires `^9.30.1` — npm install failed with ERESOLVE
- **Fix:** Downgraded `@eslint/js` to `9.30.1`; used `--legacy-peer-deps` for obsidian version mismatch
- **Files modified:** `package.json`
- **Verification:** `npm install` exits 0, `node_modules/obsidian` present
- **Committed in:** `3866fdb` (Task 01-01-01 commit)

**2. [Rule 3 - Blocking] builtin-modules missing from devDependencies**
- **Found during:** Task 01-01-02 (esbuild config syntax verification)
- **Issue:** `esbuild.config.mjs` imports `builtin-modules` but it was not in `package.json` devDependencies — node threw "Cannot find package 'builtin-modules'"
- **Fix:** Added `builtin-modules@4.0.0` to devDependencies and re-ran npm install
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `node -e "import('./esbuild.config.mjs')..."` fails only on missing `src/main.ts` (expected)
- **Committed in:** `0a670ac` (Task 01-01-02 commit)

---

**Total deviations:** 2 auto-fixed (1 version bug, 1 missing blocking dependency)
**Impact on plan:** Both fixes required for correct installation and build config loading. No scope creep.

## Issues Encountered
- Running `node version-bump.mjs --help` directly (without `npm_package_version` env var) caused the script to write `"undefined": "1.5.7"` into `versions.json` and strip `"version"` from `manifest.json`. Both files were immediately restored. The script itself is correct — it's designed to run only via `npm version`.

## User Setup Required
None — no external service configuration required. Dev vault copy requires creating `.env` from `.env.example` and setting `OBSIDIAN_DEV_VAULT_PATH`, documented in the plan's Manual Verification section.

## Next Phase Readiness
- `package.json` and `node_modules/` in place — Plan 01-00 (Vitest) can add test deps immediately
- `tsconfig.json` and `esbuild.config.mjs` ready — Plan 01-02 (directory structure + src/main.ts) unblocked
- `npm run dev` will build once `src/main.ts` exists (Plan 01-02)
- ESLint config (`eslint.config.mjs`) still needed — Plan 01-05

---
*Phase: 01-project-scaffold-and-canvas-parsing-foundation*
*Completed: 2026-04-05*

## Self-Check: PASSED

All 11 created files verified present on disk. All 4 task commits verified in git log.
