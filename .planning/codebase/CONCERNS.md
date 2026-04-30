# Codebase Concerns

**Analysis Date:** 2026-04-30

This is a fresh scan that fully replaces the prior 2026-04-16 version. Several of the older HIGH-severity items (e.g. `async-mutex` not declared, `validate-protocol` stub) have already been fixed and are no longer flagged. New findings center on **build artifacts that are gitignored but still tracked**, **a duplicate generated `src/styles.css`**, **the orphaned `folder-picker-modal.ts`**, and **deep render-logic duplication between `RunnerView` and `InlineRunnerModal`**.

> **Out of scope per project owner:** `node_modules/`, `package-lock.json`, and the root `styles.css` are expected. `node_modules/` is local-only and gitignored; `styles.css` at the repo root is generated but Obsidian loads it from there, so it must remain.

---

## Quick Wins

These are the cheapest, highest-impact changes that would speed up the dev loop today. Each has been verified against actual file usage (no false positives).

1. **Stop tracking generated build artifacts in git** (HIGH, 5 min) — `main.js`, `styles.css`, and `src/styles.css` are listed in `.gitignore` but are still tracked by `git ls-files`. Every build dirties the working tree, every commit risks accidentally re-bundling them, and `git diff` is full of generated noise. Fix: `git rm --cached main.js styles.css src/styles.css` and commit. See HIGH-1.
2. **Delete the duplicate `src/styles.css`** (HIGH, 10 min) — `esbuild.config.mjs:60` writes a byte-identical copy of `styles.css` into `src/styles.css`. Nothing in the codebase reads it. The comment claims it is "for tools that expect it", but no tool actually does. Removes 50 671 lines from the working tree and one write per build. See HIGH-2.
3. **Delete `src/views/folder-picker-modal.ts`** (MEDIUM, 5 min) — Self-marked `@deprecated Phase 51` and confirmed by `knip` as unused; the only references outside the file are `vi.mock(...)` stubs in tests, which can be removed in the same patch. See MEDIUM-1.
4. **Archive completed-milestone planning material** (MEDIUM, 15 min) — `.planning/milestones/v1.0…v1.9-phases/` is **8.6 MB** of historical phase folders for milestones already shipped. Moving them under `.planning/archive/` (or stripping intermediate `*-RESEARCH.md` / `*-DISCUSSION-LOG.md` files) shrinks the planner's search surface. See MEDIUM-3.
5. **Remove the orphaned `.planning/research/` snapshot from v1.6** (LOW, 2 min) — Five files dated 2026-04-16 that duplicate `.planning/codebase/`. The two trees diverged after v1.6 was shipped and `research/` is no longer updated. Either delete or move to `.planning/archive/v1.6-research/`. See LOW-2.

---

## HIGH

### HIGH-1: Generated build artifacts are gitignored but still tracked

- **Issue:** `main.js`, `styles.css`, and `src/styles.css` all appear in `.gitignore` (lines 5, 7) yet `git cat-file -e HEAD:<path>` confirms each is present in HEAD. Most recent touch: commit `f1ae8fe` (2026-04-30) re-committed all three.
- **Files:** `Z:/projects/RadiProtocolObsidian/.gitignore` (lines 4–7), `Z:/projects/RadiProtocolObsidian/main.js`, `Z:/projects/RadiProtocolObsidian/styles.css`, `Z:/projects/RadiProtocolObsidian/src/styles.css`
- **Evidence:**
  ```
  $ git ls-files main.js styles.css src/styles.css
  main.js
  src/styles.css
  styles.css

  $ git cat-file -e HEAD:main.js && echo TRACKED
  TRACKED
  ```
- **Impact:**
  - `git status` and `git diff` are noisy after every `npm run build` (180 KB `main.js`, 50 KB `styles.css` re-rewritten).
  - Every PR contains hundreds of KB of generated diff.
  - Branch merges produce spurious conflicts in `main.js` / `styles.css`.
  - The `.gitignore` lies about the project's intent.
- **Fix approach:**
  ```bash
  git rm --cached main.js styles.css src/styles.css
  git commit -m "chore: stop tracking generated build artifacts"
  ```
  Then on any release branch, run `npm run build` and either (a) attach the artifacts to the GitHub Release as binaries (current pattern per phase 74), or (b) keep a separate `release` branch that does track them. The plugin-on-disk install for end-users uses BRAT/Releases, not `git clone`, so there is no end-user impact.
- **Caveat:** Obsidian BRAT and the manual install path both pull from GitHub Releases (per `manifest.json` and the v1.11 release flow). Confirm release tooling does not assume `main.js` is on `main` before removing.

### HIGH-2: Duplicate generated CSS file inside `src/`

- **Issue:** `esbuild.config.mjs:59-60` writes the concatenated CSS to **two** locations on every build:
  ```js
  fs.writeFileSync('styles.css', combined);
  fs.writeFileSync('src/styles.css', combined);  // ← redundant
  ```
  The comment at `esbuild.config.mjs:46` claims `src/styles.css` is "kept in sync as a convenience copy for tools that expect it", but no source file imports it and no tool reads it.
- **Files:** `Z:/projects/RadiProtocolObsidian/src/styles.css`, `Z:/projects/RadiProtocolObsidian/esbuild.config.mjs:46-60`
- **Evidence:**
  - `diff -q src/styles.css styles.css` → byte-identical (50 671 lines each).
  - `Grep "from ['\"].*styles\\.css['\"]"` in `src/` → no hits.
  - `tsconfig.json` includes only `src/**/*.ts`, never `*.css`.
  - vitest does not load CSS.
- **Impact:**
  - Doubles the dev-watch write storm (relevant on Windows where `src/styles.css` triggers IDE/editor file-watchers in the source tree).
  - 50 KB of duplicated content in git history (compounds with HIGH-1).
  - Confuses the `src/` layout — readers wonder whether it is the "real" source. CLAUDE.md explicitly says CSS source is per-feature in `src/styles/`.
- **Fix approach:**
  1. Delete the line `fs.writeFileSync('src/styles.css', combined);` in `esbuild.config.mjs`.
  2. Remove `src/styles.css` from disk and untrack it (`git rm src/styles.css`; subsumed by HIGH-1's `git rm --cached`).
  3. Update the JSDoc on `cssPlugin` to drop the "convenience copy" line.

---

## MEDIUM

### MEDIUM-1: `folder-picker-modal.ts` is dead code

- **Issue:** Self-marked `@deprecated Phase 51 D-07 (PICKER-02)` in `src/views/folder-picker-modal.ts:9-15`. Replaced by `SnippetTreePicker`-hosting modal in `src/views/snippet-manager-view.ts`. Confirmed orphaned by `npx knip`:
  ```
  Unused files (10)
  src/views/folder-picker-modal.ts
  ```
- **Files:** `Z:/projects/RadiProtocolObsidian/src/views/folder-picker-modal.ts` (entire file, 41 lines)
- **Evidence:** Only references outside the file are:
  - `vi.mock('../views/folder-picker-modal', …)` stubs in 4 test files (`snippet-tree-dnd.test.ts:251`, `snippet-tree-inline-rename.test.ts:224`, `views/snippet-manager-folder-picker.test.ts:241`, `snippet-vault-watcher.test.ts:129` comment)
  - One comment in `snippet-service.ts:467` and one in `snippet-manager-view.ts:16` referring to it as "deprecated retained per CLAUDE.md"
- **Impact:** Adds noise to `src/views/`, drags along its own test mock plumbing, and forces every "modal grep" to disambiguate.
- **Fix approach:** Delete `src/views/folder-picker-modal.ts`, remove the `vi.mock` stubs in the four test files, and trim the two stale comments. The CLAUDE.md "never delete code you didn't add" rule has an explicit exception for code with `@deprecated` JSDoc that is verifiably orphaned — the JSDoc itself authorizes future deletion ("may be safely deleted in a future cleanup phase if `git grep FolderPickerModal` returns zero imports outside this file" — line 13).

### MEDIUM-2: `RunnerView` and `InlineRunnerModal` carry deeply duplicated render logic

- **Issue:** Both files implement the same protocol-runner UI in two parallel near-copies. They share method names, control flow, and even comment structure:

  | Method / pattern | `runner-view.ts` | `inline-runner-modal.ts` |
  |---|---|---|
  | `private async renderSnippetPicker(...)` | line 776 | line 952 |
  | `state.currentNodeId` access for picker dispatch | line 605 | line 461 |
  | `runner.pickFileBoundSnippet(state.currentNodeId, snippetNode.id, snippetPath)` | line 536 | line 416 |
  | `renderError(...)` on missing graph node | line 455 | line 351 |
  | Loop-body file-bound snippet handling | yes | yes (mirrored) |

- **Files:**
  - `Z:/projects/RadiProtocolObsidian/src/views/runner-view.ts` (1 145 lines, 13 methods)
  - `Z:/projects/RadiProtocolObsidian/src/views/inline-runner-modal.ts` (1 205 lines, 28 methods)
- **Impact:**
  - **Hot spot for bug duplication.** Phase 59 ("inline-runner-feature-parity") and the four `inline-runner-*` test files (`inline-runner-modal.test.ts`, `inline-runner-modal-loop-body-file-bound.test.ts`, `inline-runner-modal-output-toolbar.test.ts`, `inline-runner-position.test.ts`, `inline-runner-layout.test.ts`) exist precisely because the inline modal kept drifting from `RunnerView`.
  - Every new runner feature must be implemented twice and tested twice → roughly 2× the cost of every runner-side phase.
  - Combined LOC of these two files: 2 350 — the largest single-feature surface in the codebase.
- **Fix approach:** Extract a `RunnerRenderer` (or composable hooks) module under `src/runner/` that owns all `renderQuestion`, `renderAnswer`, `renderSnippetPicker`, `renderTextBlock`, `renderLoop` logic. `RunnerView` and `InlineRunnerModal` become thin shells that wire host-specific concerns (sidebar leaf vs floating modal, layout persistence, output toolbar). Track parity via a shared test fixture set rather than two parallel test trees. This is a multi-phase refactor and should be scoped explicitly (estimate: 3–4 phases).

### MEDIUM-3: 8.6 MB of completed-milestone planning artifacts under `.planning/milestones/`

- **Issue:** `.planning/milestones/v1.0…v1.9` are all shipped (per `MILESTONES.md` and `versions.json`); `v1.10` and `v1.11` are also shipped. Their `*-phases/` subdirectories total **8.6 MB** of `*-PLAN.md`, `*-RESEARCH.md`, `*-DISCUSSION-LOG.md`, `*-VERIFICATION.md` files that the GSD planner does not need anymore.
- **Files / folders:**
  - `Z:/projects/RadiProtocolObsidian/.planning/milestones/v1.2-phases/` … `v1.10-phases/` (combined 7.2 MB)
  - Largest single offender: `v1.8-phases/` (2.7 MB), then `v1.7-phases/` (1.4 MB), then `v1.10-phases/` (1.1 MB)
  - Within those: `v1.7-phases/43-unified-loop-graph-model-parser-validator-migration-errors/` (456 KB), `v1.10-phases/63-bidirectional-canvas-node-editor-sync/` (412 KB) are the heaviest single-phase folders
- **Impact:**
  - Slows `Glob`/`Grep` scans agents do at the start of every session.
  - Bloats context for any "scan `.planning/`" operation.
  - Makes it harder to find the *current* phase folder under `.planning/phases/` (the active work area).
- **Fix approach:**
  1. Move `.planning/milestones/v1.0…v1.9-phases/` and `v1.10-phases/` to `.planning/archive/`, keeping only the `v1.X-MILESTONE-AUDIT.md` / `v1.X-LEARNINGS.md` summaries at the top level for historical reference.
  2. Add `.planning/archive/` to the GSD planner's exclude list (or rename to `.archive/` if that already excludes it).
  3. Optionally drop `*-RESEARCH.md` and `*-DISCUSSION-LOG.md` entirely — they were inputs to phase planning, not deliverables.

### MEDIUM-4: `editor-panel-view.ts` is a 1 226-line god-file

- **Issue:** `src/views/editor-panel-view.ts` carries 20 methods and 1 226 lines, mixing form rendering for every node kind (Question, Answer, TextBlock, Snippet, Loop), canvas-sync orchestration, and toolbar buttons. CLAUDE.md explicitly warns about agents losing context in this file ("recurring regressions were caused by executor agents silently deleting … functions while editing unrelated sections").
- **Files:** `Z:/projects/RadiProtocolObsidian/src/views/editor-panel-view.ts`
- **Impact:**
  - Each phase that touches the editor pays a "find the right section" tax.
  - Test coverage is split across `editor-panel-create.test.ts` (29 KB), `editor-panel-forms.test.ts` (22 KB), `editor-panel-loop-form.test.ts` (12 KB), `editor-panel-canvas-sync.test.ts` (41 KB), `editor-panel-snippet-picker.test.ts` (15 KB), `editor-panel.test.ts` (2 KB) — six files totaling ~120 KB. Any refactor must preserve all of them.
  - This is the file most often cited by CLAUDE.md as a "sharp edge".
- **Fix approach:** Extract per-kind form renderers into siblings: `editor-panel/forms/question-form.ts`, `answer-form.ts`, `text-block-form.ts`, `snippet-form.ts`, `loop-form.ts`. The view becomes a dispatcher. Mirror the test split that already exists. Defer until a quiet phase — the file is not actively bleeding bugs, just expensive to navigate.

### MEDIUM-5: `protocol-runner.ts` and `snippet-service.ts` are also large

- **Files & sizes:**
  - `Z:/projects/RadiProtocolObsidian/src/runner/protocol-runner.ts` — 819 lines
  - `Z:/projects/RadiProtocolObsidian/src/snippets/snippet-service.ts` — 501 lines (modest, but combined with the 22 KB `snippet-manager-view.ts` and 28 KB `snippet-editor-modal.ts`, snippets are the second-largest feature surface)
  - `Z:/projects/RadiProtocolObsidian/src/views/snippet-manager-view.ts` — 1 037 lines
  - `Z:/projects/RadiProtocolObsidian/src/canvas/edge-label-sync-service.ts` — 437 lines (acceptable)
- **Impact:** Less acute than MEDIUM-4 but worth noting — these four files own ~3 000 lines of UI/service code; any "snippet feature" phase touches at least three of them.
- **Fix approach:** No immediate action recommended. Re-evaluate after MEDIUM-2 (runner refactor) — if the runner extracts cleanly, apply the same pattern to snippets.

---

## LOW

### LOW-1: Top-level `.planning/v1.0-MILESTONE-AUDIT.md` is misplaced

- **Issue:** All other milestone audits live under `.planning/milestones/v1.X-MILESTONE-AUDIT.md`. The v1.0 audit is at `.planning/v1.0-MILESTONE-AUDIT.md` (top level). It is 13 KB and dated 2026-04-12.
- **Files:** `Z:/projects/RadiProtocolObsidian/.planning/v1.0-MILESTONE-AUDIT.md`
- **Fix approach:** `git mv .planning/v1.0-MILESTONE-AUDIT.md .planning/milestones/v1.0-MILESTONE-AUDIT.md`.

### LOW-2: `.planning/research/` is an orphaned v1.6 snapshot

- **Issue:** `.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,STACK,SUMMARY}.md` are dated 2026-04-16 and explicitly scope themselves to v1.6 ("RadiProtocol v1.6 -- Canvas Workflow and Polish" — `SUMMARY.md:3`). Since v1.6, `.planning/codebase/` (also dated 2026-04-16 originally) has been the canonical snapshot. Three milestones have shipped on top of v1.6 and `research/` was never refreshed.
- **Files:** `Z:/projects/RadiProtocolObsidian/.planning/research/*.md` (5 files, ~50 KB)
- **Impact:** Two competing "what is the architecture?" answers; readers may pick the older one.
- **Fix approach:** Move to `.planning/archive/v1.6-research/` or delete outright. The current source of truth is `.planning/codebase/`.

### LOW-3: `STATE.archive-2026-04-21.md` lives next to `STATE.md`

- **Issue:** `Z:/projects/RadiProtocolObsidian/.planning/STATE.archive-2026-04-21.md` (57 KB) is an explicit archive sitting in the active planning root.
- **Fix approach:** Move to `.planning/archive/` together with the v1.X-phases content (MEDIUM-3).

### LOW-4: Several exported types are unused

- **Issue:** `knip` reports 5 exported types with no consumer:
  - `CreateNodeResult` — `src/canvas/canvas-node-factory.ts:18`
  - `ReconcileResult` — `src/graph/edge-label-reconciler.ts:28`
  - `NodeFieldsSnapshot` — `src/canvas/edge-label-sync-service.ts:37`
  - `GraphValidatorOptions` — `src/graph/graph-validator.ts:13`
  - `DonateWallet` — `src/donate/wallets.ts:15`
- **Impact:** Minor — they are TypeScript types with no runtime cost. They do, however, mislead readers into thinking these shapes are part of a public API.
- **Fix approach:** Either drop the `export` keyword (most cases) or, for documentation value, add a JSDoc comment marking them as the canonical shape returned/accepted by the function on the same file.

### LOW-5: Unused devDependency `jiti`

- **Issue:** `knip` reports `jiti` (`package.json:24`) is not imported anywhere.
- **Files:** `Z:/projects/RadiProtocolObsidian/package.json:24`
- **Impact:** Trivial — adds a few MB to `node_modules/`. May have been pulled in transitively by an older `eslint` config.
- **Fix approach:** `npm uninstall jiti`. If the next `npm install` re-adds it via hoisting, leave it alone.

### LOW-6: `eslint` invoked but not declared

- **Issue:** `knip` reports "Unlisted binaries: eslint". `package.json:13` runs `eslint .` but `eslint` itself is only present transitively via `@eslint/js` and `typescript-eslint`.
- **Files:** `Z:/projects/RadiProtocolObsidian/package.json:13`
- **Impact:** Build/lint can break on a clean install if hoisting changes. Same shape as the now-fixed `async-mutex` issue.
- **Fix approach:** `npm install --save-dev eslint`.

### LOW-7: `versions.json` is missing v1.0–v1.7 entries

- **Issue:** `versions.json` only lists `1.8.0` through `1.11.0`. Older versions (still on GitHub Releases per the `versions.json` purpose) are not present.
- **Files:** `Z:/projects/RadiProtocolObsidian/versions.json`
- **Impact:** Obsidian uses `versions.json` to map plugin version → `minAppVersion`. Users on older Obsidian who try to install v1.0–v1.7 may see a misleading compat error. Low real-world impact since BRAT pins to `manifest.json`.
- **Fix approach:** Backfill entries `"1.0.0": "1.5.7"` … `"1.7.0": "1.5.7"` for completeness.

### LOW-8: `.planning/debug/` and `.planning/forensics/` accumulate but are never cleaned

- **Issue:** `.planning/debug/` has 3 files dated 2026-04-25 that document inline-runner regressions long since fixed. `.planning/forensics/` has 1 report from 2026-04-21.
- **Files:**
  - `Z:/projects/RadiProtocolObsidian/.planning/debug/inline-runner-drag-resets-size.md`
  - `Z:/projects/RadiProtocolObsidian/.planning/debug/inline-runner-tab-switch-resets-size.md`
  - `Z:/projects/RadiProtocolObsidian/.planning/debug/phase-27-regressions.md`
  - `Z:/projects/RadiProtocolObsidian/.planning/forensics/report-20260421-140424.md`
- **Fix approach:** Move to `.planning/archive/debug/` and `.planning/archive/forensics/` after confirming the linked bugs are closed.

---

## Performance Bottlenecks

None observed at runtime. The only perf-adjacent concern is **dev-loop friction** (Quick Wins #1–#3 above) and the **8.6 MB planning surface** that slows agent startup scans.

## Fragile Areas

- **`src/views/editor-panel-view.ts`** — see MEDIUM-4. CLAUDE.md flags it explicitly. Touch with care; never delete blocks you did not add.
- **`src/views/runner-view.ts` ↔ `src/views/inline-runner-modal.ts`** — see MEDIUM-2. Any change to runner UX must be applied to both, with mirrored tests.
- **`src/canvas/edge-label-sync-service.ts`** — 437 lines but very dense Obsidian-internal-API code (Phase 50 `vault.on('modify')` subscription). Tests in `edge-label-sync-service.test.ts` (31 KB) are the safety net; do not modify the class without running them.

## Test Coverage Observations

Test footprint is large and healthy: **64 test files, 23 753 lines** vs **12 004 lines of source** — a ~2:1 test:source ratio. No coverage gaps were surfaced by this scan; in particular, the inline runner has dedicated parity tests (`inline-runner-modal-loop-body-file-bound.test.ts`, etc.) that mirror the sidebar runner's tests.

The cost of this coverage is felt in MEDIUM-2: every runner change requires updating both test trees. Refactoring the runner per MEDIUM-2 would also let you collapse half of these test files into shared fixtures.

## Build / Dev-Loop Friction Summary

| Symptom | Root cause | Where |
|---|---|---|
| `git status` always dirty after build | `main.js`, `styles.css`, `src/styles.css` tracked despite `.gitignore` | HIGH-1 |
| 50 671 redundant lines per build | Duplicate write to `src/styles.css` | HIGH-2 |
| Slow planner scans on session start | 8.6 MB of completed-milestone phase folders | MEDIUM-3 |
| Runner features cost 2× to ship | Render logic duplicated `RunnerView` ↔ `InlineRunnerModal` | MEDIUM-2 |
| "Where do I edit this form?" tax | `editor-panel-view.ts` is 1 226 lines | MEDIUM-4 |

---

*Concerns audit: 2026-04-30 — supersedes 2026-04-16 version.*
