---
quick_id: 260430-uas
type: quick
mode: quick
status: complete
title: "LOW-severity cleanup batch from CONCERNS.md (8 items, 5 commits)"
created: 2026-04-30
completed: 2026-04-30
commits:
  - hash: 65e1a75
    subject: "chore: archive misplaced top-level planning docs"
    items: [LOW-1, LOW-3, LOW-8]
  - hash: 99e446d
    subject: "chore: archive v1.6 research snapshot to .planning/archive/v1.6-research/"
    items: [LOW-2]
  - hash: 6361e05
    subject: "refactor: drop export from unused internal types (LOW-4)"
    items: [LOW-4]
  - hash: 07aa79d
    subject: "build: drop unused jiti, add eslint as direct devDep"
    items: [LOW-5, LOW-6]
  - hash: 5b2fd2d
    subject: "chore: backfill versions.json with 1.0.0–1.7.0 entries (LOW-7)"
    items: [LOW-7]
gates:
  npm_run_build: pass
  npm_test: "pass (818 passed, 1 skipped, 0 failed)"
  working_tree: clean
---

# Quick 260430-uas — LOW cleanup batch SUMMARY

All 8 LOW-severity items from `.planning/codebase/CONCERNS.md` (2026-04-30 scan) were
addressed in 5 atomic conventional-commit-style commits on `main`. No items skipped.
Final `npm run build` and `npm test` both green.

## Per-commit detail

### Commit 1 — `65e1a75` — `chore: archive misplaced top-level planning docs`
Resolves **LOW-1, LOW-3, LOW-8**. Six pure renames (zero content change):

| Source                                           | Destination                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `.planning/v1.0-MILESTONE-AUDIT.md`              | `.planning/archive/milestones/v1.0-MILESTONE-AUDIT.md`       |
| `.planning/STATE.archive-2026-04-21.md`          | `.planning/archive/STATE.archive-2026-04-21.md`              |
| `.planning/debug/inline-runner-drag-resets-size.md`        | `.planning/archive/debug/…`                        |
| `.planning/debug/inline-runner-tab-switch-resets-size.md`  | `.planning/archive/debug/…`                        |
| `.planning/debug/phase-27-regressions.md`        | `.planning/archive/debug/phase-27-regressions.md`            |
| `.planning/forensics/report-20260421-140424.md`  | `.planning/archive/forensics/report-20260421-140424.md`      |

`.planning/debug/` and `.planning/forensics/` directories are now empty (not removed
per plan instruction; git doesn't track empty dirs anyway).

### Commit 2 — `99e446d` — `chore: archive v1.6 research snapshot to .planning/archive/v1.6-research/`
Resolves **LOW-2**. Five pure renames; the directory-level `git mv` worked on first
attempt so the per-file fallback was not needed:

```
.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,STACK,SUMMARY}.md
  → .planning/archive/v1.6-research/{...}
```

Old `.planning/research/` directory now removed.

### Commit 3 — `6361e05` — `refactor: drop export from unused internal types (LOW-4)`
Resolves **LOW-4**. Pre-edit `git grep -- 'src/'` confirmed each of the 5 types only
appears in its own source file (and self-references within that file), so dropping
`export` is safe.

| Type                    | File                                       | Other src/ usage         |
| ----------------------- | ------------------------------------------ | ------------------------ |
| `CreateNodeResult`      | `src/canvas/canvas-node-factory.ts`        | line 42 (return type)    |
| `ReconcileResult`       | `src/graph/edge-label-reconciler.ts`       | line 72 (return type)    |
| `NodeFieldsSnapshot`    | `src/canvas/edge-label-sync-service.ts`    | lines 79/162/176         |
| `GraphValidatorOptions` | `src/graph/graph-validator.ts`             | line 28 (ctor param)     |
| `DonateWallet`          | `src/donate/wallets.ts`                    | line 21 (ReadonlyArray)  |

All 5 self-references resolve fine post-edit because the type stays in module scope.
No types skipped — every grep returned the expected own-file-only result. Diff is
exactly 5 files × 1 line each (the `export ` keyword removed).

Post-edit gate:
- `npm run build` → pass (`tsc -noEmit -skipLibCheck` + esbuild both green)
- `npm test` → 818 passed, 1 skipped, 0 failed

### Commit 4 — `07aa79d` — `build: drop unused jiti, add eslint as direct devDep`
Resolves **LOW-5** and **LOW-6**. Two npm dependency adjustments:

- **Removed** `jiti@2.6.1` from devDependencies via `npm uninstall jiti`. Pre-check
  `git grep -- 'src/' 'esbuild.config.mjs' 'vitest.config.*' 'tsconfig*.json'` returned
  zero hits, confirming no source imports exist (jiti was vestigial).
- **Added** `eslint@^9.39.4` as a direct devDep via `npm install --save-dev eslint@^9`.
  Previously `eslint` resolved transitively via `@eslint/js@9.30.1` and
  `typescript-eslint@8.58.0` — same fragile-transitive shape that bit `async-mutex`
  earlier. Now declared directly. `npx eslint --version` → `v9.39.4`.

Post-change:
- `npx eslint --version` → resolves cleanly
- `npm test` → still 818 passed
- `npm run build` → still pass (proves esbuild works after package.json changes)
- `npm run lint` → exits non-zero with **523 pre-existing findings** (517 errors,
  6 warnings). These are all style-rule violations (mostly `obsidianmd/no-static-styles-assignment`,
  some `obsidianmd/ui/sentence-case`, plus a handful of `@typescript-eslint/no-unused-vars`).
  Per plan, these are **out of scope** — the LOW-6 goal is "eslint resolvable", not
  "zero lint findings". See "Pre-existing lint findings" section below for follow-up
  hooks.

### Commit 5 — `5b2fd2d` — `chore: backfill versions.json with 1.0.0–1.7.0 entries (LOW-7)`
Resolves **LOW-7**. `git show v1.X:manifest.json` for each tag `v1.0..v1.7` returned
`"minAppVersion": "1.5.7"` for **all 8 historical tags** (each tag's `manifest.json`
ships the same min-app value, since Obsidian's required `minAppVersion` floor was set
to 1.5.7 at the start and never bumped through v1.7). Result: every backfilled key
maps to `"1.5.7"`, matching the existing 1.8.0–1.11.0 entries.

The fallback `1.5.7` was therefore never actually needed — every tag's manifest was
readable and produced the same value.

Final `versions.json` has exactly 12 keys (`1.0.0`–`1.11.0`), all valued `"1.5.7"`.
Existing 1.8.0–1.11.0 entries preserved verbatim. File formatting preserved (single
TAB indent, LF line endings, trailing newline). Sanity check (12 keys, 1.8.0–1.11.0
unclobbered) passed.

## Final gates

| Gate              | Result                                  |
| ----------------- | --------------------------------------- |
| `npm run build`   | **pass** (tsc + esbuild)                |
| `npm test`        | **pass** (64 files, 818 passed, 1 skipped) |
| `git status`      | **clean** (working tree empty)          |
| Commit count      | **5** — exactly as planned              |
| Out-of-scope edits | **none** — only files in plan's `files_modified` were touched |

## LOW-item ↔ commit map

| Item   | Description (from CONCERNS.md)                         | Status      | Commit    |
| ------ | ------------------------------------------------------ | ----------- | --------- |
| LOW-1  | v1.0 milestone audit at `.planning/` top level         | resolved    | `65e1a75` |
| LOW-2  | Frozen v1.6 research snapshot in active planning dir   | resolved    | `99e446d` |
| LOW-3  | Old STATE archive at top level                         | resolved    | `65e1a75` |
| LOW-4  | 5 unused-`export` interfaces flagged by knip           | resolved    | `6361e05` |
| LOW-5  | `jiti` devDep with zero source imports                 | resolved    | `07aa79d` |
| LOW-6  | `eslint` only resolves transitively                    | resolved    | `07aa79d` |
| LOW-7  | `versions.json` missing 1.0.0–1.7.0 entries            | resolved    | `5b2fd2d` |
| LOW-8  | Closed-bug debug + 2026-04-21 forensics report at top  | resolved    | `65e1a75` |

No items were skipped.

## Skipped items

None — all pre-conditions held (5 grep checks for LOW-4 returned own-file-only;
jiti grep for LOW-5 returned zero hits; all 8 historical manifest tags were readable
for LOW-7).

## Pre-existing lint findings surfaced by LOW-6

Now that `eslint` is directly resolvable, `npm run lint` runs end-to-end and reveals
**523 problems (517 errors, 6 warnings)** that already existed in the codebase. Brief
breakdown by rule (top contributors):

- `obsidianmd/no-static-styles-assignment` — by far the dominant rule. Flags every
  `element.style.x = ...` direct assignment across `src/views/` (runner-view,
  snippet-chip-editor, snippet-editor-modal, snippet-fill-in-modal, snippet-manager-view,
  etc.). The Obsidian community plugin guidelines prefer CSS classes / `setCssProps`
  for theming. This is a long tail and would require a dedicated phase to migrate.
- `obsidianmd/ui/sentence-case` — a handful of UI-string casing nits.
- `@typescript-eslint/no-unused-vars` — a few unused imports/parameters
  (`TFolder`, `SnippetFile`, `_ev`).
- 1 unused `eslint-disable` directive in `src/views/snippet-editor-modal.ts:143`.
- 4 fixable warnings + 1 fixable error per eslint's auto-fix advisory.

**Per plan, NONE of these were fixed in this commit.** They are documented here so
the user can decide whether to scope a follow-up cleanup. Recommendation: a separate
quick task (or a small phase) to migrate `element.style.x` assignments to CSS classes
in batches — likely worth ~3–5 commits, one per view file.

## Side effects of npm install/uninstall

`npm uninstall jiti` + `npm install --save-dev eslint@^9` resulted in `package-lock.json`
diff of **+2/-2 lines** (very small). npm reports `2 vulnerabilities (1 moderate, 1 high)`
unchanged from before — not introduced by this work, pre-existing in the dep tree
(likely transitive). Not in scope to fix here.

## Final commit roll-up

All five commit hashes:

1. `65e1a75` — `chore: archive misplaced top-level planning docs` (LOW-1, LOW-3, LOW-8)
2. `99e446d` — `chore: archive v1.6 research snapshot to .planning/archive/v1.6-research/` (LOW-2)
3. `6361e05` — `refactor: drop export from unused internal types (LOW-4)` (LOW-4)
4. `07aa79d` — `build: drop unused jiti, add eslint as direct devDep` (LOW-5, LOW-6)
5. `5b2fd2d` — `chore: backfill versions.json with 1.0.0–1.7.0 entries (LOW-7)` (LOW-7)

Working tree clean, build green, 818 tests pass. All 8 LOW items from CONCERNS.md
resolved with no skips and no out-of-scope edits.
