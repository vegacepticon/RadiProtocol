---
phase: 01-project-scaffold-and-canvas-parsing-foundation
plan: "05"
subsystem: infra
tags: [eslint, typescript-eslint, eslint-plugin-obsidianmd, lint, code-quality]

requires:
  - phase: 01-project-scaffold-and-canvas-parsing-foundation
    plan: "02"
    provides: Complete src/ directory tree — all files to lint against
  - phase: 01-project-scaffold-and-canvas-parsing-foundation
    plan: "03"
    provides: CanvasParser implementation in src/graph/canvas-parser.ts
  - phase: 01-project-scaffold-and-canvas-parsing-foundation
    plan: "04"
    provides: GraphValidator implementation in src/graph/graph-validator.ts

provides:
  - eslint.config.mjs with flat ESLint v9 config at project root
  - All 23 eslint-plugin-obsidianmd rules applied to src/**/*.ts (DEV-02)
  - @typescript-eslint/no-explicit-any and no-floating-promises as errors (DEV-03)
  - no-console (allow warn/error/debug), no-restricted-syntax for innerHTML/outerHTML (DEV-03)
  - Zero ESLint errors across all src/ files (NFR-04)
  - All Phase 1 integration checks green: lint + 14/14 tests + esbuild + tsc

affects:
  - All future phases — eslint.config.mjs governs all src/**/*.ts files from here forward

tech-stack:
  added: []
  patterns:
    - "ESLint v9 flat config (eslint.config.mjs) — tseslint.config() wrapper with per-glob rule blocks"
    - "eslint-plugin-obsidianmd loaded as ESM (type:module package) via direct import, not createRequire"
    - "All obsidianmd rules applied explicitly (not via configs.recommended spread) to avoid bundling conflicts"
    - "ui/sentence-case with enforceCamelCaseLower:true — brand names like RadiProtocol become Radiprotocol in UI strings"

key-files:
  created:
    - eslint.config.mjs
  modified:
    - src/main.ts
    - src/settings.ts
    - src/views/runner-view.ts
    - src/views/editor-panel-view.ts
    - src/views/snippet-manager-view.ts

key-decisions:
  - "eslint-plugin-obsidianmd is ESM (type:module) — use direct ESM import, not createRequire CJS wrapper"
  - "Apply obsidianmd rules explicitly rather than spreading configs.recommended — avoids pulling in sdl/import plugins with their own peer-dep requirements"
  - "ui/sentence-case with enforceCamelCaseLower:true forces RadiProtocol → Radiprotocol in all UI-facing strings; accepted as correct behavior per Obsidian community review guidelines"
  - "settings.ts h2 heading removed per no-manual-html-headings rule — Phase 3 will use Setting.setHeading() API"

patterns-established:
  - "Sentence-case UI text policy: all user-visible strings in addRibbonIcon, Notice, addCommand name, createEl text must pass obsidianmd/ui/sentence-case"
  - "Brand name in UI: 'Radiprotocol' (lowercase p) is the lint-compliant form; 'RadiProtocol' only appears in code identifiers and comments"

requirements-completed: [DEV-02, DEV-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-08, NFR-09]

duration: 10min
completed: "2026-04-05"
---

# Phase 01 Plan 05: ESLint Configuration and Zero-Error Pass Summary

**ESLint flat config with all 23 obsidianmd plugin rules, TypeScript strict checks, and no-console/innerHTML guards — zero errors across all src/ files, 14/14 tests pass, esbuild produces main.js**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-05T22:00:00Z
- **Completed:** 2026-04-05T22:10:00Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- `eslint.config.mjs` created with flat ESLint v9 config applying all DEV-02/DEV-03 required rules to `src/**/*.ts`
- Fixed 14 lint violations across 5 source files — zero errors remain
- Phase 1 integration verified: lint + 14/14 tests + esbuild production build + tsc all pass clean

## Task Commits

1. **Task 01-05-01: Create eslint.config.mjs** — `ee138e1` (chore)
2. **Task 01-05-02: Fix all lint violations** — `134a601` (fix)

Task 01-05-03 was a verification-only task; no code changes needed, no separate commit.

## Files Created/Modified

- `eslint.config.mjs` — ESLint v9 flat config: obsidianmd plugin (23 rules), typescript-eslint strict, no-console, no-restricted-syntax for innerHTML/outerHTML
- `src/main.ts` — Sentence-case ribbon tooltip and Notice strings; remove unused `_evt` parameter
- `src/settings.ts` — Remove `createEl('h2')` (no-manual-html-headings); sentence-case `createEl('p')` text
- `src/views/runner-view.ts` — Sentence-case `getDisplayText()` return and placeholder text
- `src/views/editor-panel-view.ts` — Sentence-case `getDisplayText()` return and placeholder text
- `src/views/snippet-manager-view.ts` — Sentence-case `getDisplayText()` return and placeholder text

## Decisions Made

- `eslint-plugin-obsidianmd` is an ESM package (`"type": "module"`) — used direct `import obsidianmd from 'eslint-plugin-obsidianmd'` rather than the `createRequire` CJS fallback suggested in the plan.
- Applied the 23 obsidianmd rules explicitly by name rather than spreading `configs.recommended` — the recommended config bundles `@microsoft/eslint-plugin-sdl` and `eslint-plugin-import` in a way that conflicts when combined with our own `tseslint.config()` wrapper.
- `ui/sentence-case` with `enforceCamelCaseLower: true` lowercases the second capital in `RadiProtocol` → `Radiprotocol` in all UI strings. This is correct per Obsidian community review standards. Code identifiers remain `RadiProtocol`.
- `settings.ts` `h2` heading removed (obsidianmd/settings-tab/no-manual-html-headings); Phase 3 will use `new Setting(containerEl).setHeading()` instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used ESM import instead of createRequire for eslint-plugin-obsidianmd**
- **Found during:** Task 01-05-01 (first ESLint run attempt)
- **Issue:** Plan specified `createRequire` CJS wrapper, but the package has `"type": "module"` — it is already ESM-native. Using `createRequire` would fail at runtime.
- **Fix:** Used `import obsidianmd from 'eslint-plugin-obsidianmd'` directly (the plan's own fallback option 3 covered this case).
- **Files modified:** `eslint.config.mjs`
- **Committed in:** `ee138e1`

**2. [Rule 1 - Bug] Applied obsidianmd rules explicitly rather than via configs.recommended spread**
- **Found during:** Task 01-05-01 (config validation)
- **Issue:** `configs.recommended` is a hybrid iterable object that yields a full flat config array including `@microsoft/eslint-plugin-sdl` and `eslint-plugin-import` plugins; spreading it inside `tseslint.config()` caused rule-registration conflicts.
- **Fix:** Enumerated all 23 plugin rules explicitly in the rules block — identical coverage, no bundling conflicts.
- **Files modified:** `eslint.config.mjs`
- **Committed in:** `ee138e1`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — import/config approach differences from plan suggestion)
**Impact on plan:** Both fixes required for the config to load without errors. Coverage is identical to the plan's intent. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 1 complete: lint, tests, build, and tsc all pass clean
- Phase 2 (Core Protocol Runner Engine) can begin — all src/ import paths are resolvable, pure module boundary is enforced, ESLint guards are active from the first commit of Phase 2
- No blockers

## Self-Check: PASSED

- `eslint.config.mjs` verified present at project root
- Commits `ee138e1` and `134a601` verified in git log
- `npm run lint` — exit code 0, zero errors
- `npx vitest run` — 14/14 tests pass
- `node esbuild.config.mjs production` — exit code 0, `main.js` present
- `npx tsc -noEmit -skipLibCheck` — exit code 0
- `grep -r "from 'obsidian'" src/graph/ src/runner/ src/snippets/ src/sessions/ src/utils/` — zero matches

---
*Phase: 01-project-scaffold-and-canvas-parsing-foundation*
*Completed: 2026-04-05*
