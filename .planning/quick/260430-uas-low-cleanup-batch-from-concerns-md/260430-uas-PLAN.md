---
quick_id: 260430-uas
type: quick
mode: quick
created: 2026-04-30
title: "LOW-severity cleanup batch from CONCERNS.md (8 items, 5 commits)"
files_modified:
  - .planning/v1.0-MILESTONE-AUDIT.md
  - .planning/STATE.archive-2026-04-21.md
  - .planning/research/
  - .planning/debug/
  - .planning/forensics/
  - src/canvas/canvas-node-factory.ts
  - src/graph/edge-label-reconciler.ts
  - src/canvas/edge-label-sync-service.ts
  - src/graph/graph-validator.ts
  - src/donate/wallets.ts
  - package.json
  - package-lock.json
  - versions.json
autonomous: true
must_haves:
  truths:
    - "All 8 LOW items from CONCERNS.md are addressed (or explicitly flagged if unsafe)"
    - "Each commit is atomic, conventional-commit-styled, and groups semantically related changes"
    - "`npm run build` passes after the final commit"
    - "`npm test` passes after Commit 3 (LOW-4) and Commit 4 (LOW-5/LOW-6)"
    - "No file outside the LOW item scope is modified"
  artifacts:
    - path: ".planning/archive/milestones/v1.0-MILESTONE-AUDIT.md"
      provides: "v1.0 audit relocated alongside other milestone audits"
    - path: ".planning/archive/v1.6-research/"
      provides: "Frozen v1.6 research snapshot moved out of active planning"
    - path: ".planning/archive/STATE.archive-2026-04-21.md"
      provides: "Old STATE archive relocated next to other archives"
    - path: ".planning/archive/debug/"
      provides: "Closed-bug debug notes archived"
    - path: ".planning/archive/forensics/"
      provides: "Old forensics report archived"
    - path: "versions.json"
      provides: "Backfilled 1.0.0–1.7.0 entries (existing 1.8.0–1.11.0 preserved)"
  key_links:
    - from: "package.json devDependencies"
      to: "eslint (direct)"
      via: "npm install --save-dev eslint"
      pattern: "\"eslint\":"
    - from: "package.json devDependencies"
      to: "(no jiti)"
      via: "npm uninstall jiti"
      pattern: "jiti must NOT appear"
---

<objective>
Mechanical batch cleanup of all 8 LOW-severity items in `.planning/codebase/CONCERNS.md`
(2026-04-30 fresh scan). Each item is small and independent. The work is grouped into
**5 atomic commits** that match recent project commit style (conventional commits:
`chore:`, `refactor:`, `build:`).

Purpose: clear the LOW-severity backlog in one focused session so the next CONCERNS.md
scan starts from a cleaner baseline. None of these items requires design work — every
fix is mechanical and pre-verified in the parent prompt.

Output: 5 commits on `main`, working tree clean, build and tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-quick.md
</execution_context>

<context>
@.planning/codebase/CONCERNS.md
@CLAUDE.md
@package.json
@versions.json
@manifest.json

<verified_findings>
The parent prompt and the planner's pre-checks confirmed:

1. **LOW-4 types are safe to dexport.** A repo-wide `Grep` for each type name returned only its own definition file:
   - `CreateNodeResult` → only `src/canvas/canvas-node-factory.ts`
   - `ReconcileResult` → only `src/graph/edge-label-reconciler.ts`
   - `NodeFieldsSnapshot` → only `src/canvas/edge-label-sync-service.ts`
   - `GraphValidatorOptions` → only `src/graph/graph-validator.ts`
   - `DonateWallet` → only `src/donate/wallets.ts` (used on line 21 in `ReadonlyArray<DonateWallet>` — same-file self-reference; dropping `export` does not break it)

2. **`jiti` has zero source imports.** A repo-wide `Grep` for `jiti` returns only `package.json`, `package-lock.json`, two CONCERNS.md mentions, and a milestone-archive SUMMARY. Safe to `npm uninstall`.

3. **Destination directories needed:**
   - `.planning/archive/milestones/` — exists
   - `.planning/archive/v1.6-research/` — DOES NOT exist (Task 2 must create via `git mv` of the directory itself, which creates the destination)
   - `.planning/archive/debug/` — DOES NOT exist (create via `mkdir -p` before `git mv`)
   - `.planning/archive/forensics/` — DOES NOT exist (create via `mkdir -p` before `git mv`)

4. **Git tags exist** for `v1.0` through `v1.7`. For LOW-7, the executor should attempt
   `git show v1.X:manifest.json` for each version to read the actual `minAppVersion` at
   release time. If a tag's manifest is missing or unreadable, fall back to `1.5.7`
   (the value carried by all currently-listed entries 1.8.0–1.11.0).

5. **Commit-message style observed in recent log:**
   - `chore: archive shipped milestone artifacts (v1.0..v1.11)`
   - `refactor: remove dead FolderPickerModal and stale test stubs`
   - `build: drop duplicate src/styles.css write from esbuild`
   - `chore: stop tracking generated build artifacts`
   Match this terse, lowercase, prefix:subject form.
</verified_findings>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit 1 — Archive misplaced top-level planning docs (LOW-1, LOW-3, LOW-8)</name>
  <files>
    .planning/v1.0-MILESTONE-AUDIT.md →  .planning/archive/milestones/v1.0-MILESTONE-AUDIT.md,
    .planning/STATE.archive-2026-04-21.md →  .planning/archive/STATE.archive-2026-04-21.md,
    .planning/debug/* →  .planning/archive/debug/,
    .planning/forensics/* →  .planning/archive/forensics/
  </files>
  <action>
Three archival moves grouped into one commit. All are pure file-system relocations — no content changes.

**LOW-1 (v1.0 milestone audit):** This was missed by Task 4 of quick 260430-sxo because it sat at `.planning/` top level instead of under `.planning/milestones/`. Move it to where the rest of the milestone audits live (now under `.planning/archive/milestones/` after the sxo cleanup):
```bash
git mv .planning/v1.0-MILESTONE-AUDIT.md .planning/archive/milestones/v1.0-MILESTONE-AUDIT.md
```

**LOW-3 (old STATE archive):** Move next to other archives:
```bash
git mv .planning/STATE.archive-2026-04-21.md .planning/archive/STATE.archive-2026-04-21.md
```

**LOW-8 (debug + forensics):** Create destination directories first (they do not yet exist), then move all current contents in. Per CONCERNS.md these are bugs that have shipped + closed (inline-runner-drag-resets-size, inline-runner-tab-switch-resets-size, phase-27-regressions, plus one 2026-04-21 forensics report):
```bash
mkdir -p .planning/archive/debug .planning/archive/forensics
git mv .planning/debug/inline-runner-drag-resets-size.md .planning/archive/debug/inline-runner-drag-resets-size.md
git mv .planning/debug/inline-runner-tab-switch-resets-size.md .planning/archive/debug/inline-runner-tab-switch-resets-size.md
git mv .planning/debug/phase-27-regressions.md .planning/archive/debug/phase-27-regressions.md
git mv .planning/forensics/report-20260421-140424.md .planning/archive/forensics/report-20260421-140424.md
```

If `.planning/debug/` or `.planning/forensics/` end up empty after the moves, leave the empty directories — git will not track them and they may be repopulated later. Do NOT `rmdir` them; that creates noisy untracked-state interactions.

After all `git mv` commands:
```bash
git status   # confirm only renames staged, no untracked or modified-content entries
git commit -m "chore: archive misplaced top-level planning docs"
```
  </action>
  <verify>
    <automated>git log -1 --pretty=%s | grep -F "chore: archive misplaced top-level planning docs"</automated>
    Also: `git show --stat HEAD` should show 5 renamed files (v1.0 audit, STATE archive, 3 debug files, 1 forensics file) — `git mv` records as rename when content is unchanged.
  </verify>
  <done>
    - `.planning/v1.0-MILESTONE-AUDIT.md` no longer at top level; exists under `.planning/archive/milestones/`.
    - `.planning/STATE.archive-2026-04-21.md` no longer at top level; exists under `.planning/archive/`.
    - All 3 files from `.planning/debug/` and 1 from `.planning/forensics/` are now under `.planning/archive/debug/` and `.planning/archive/forensics/` respectively.
    - One commit with conventional-commit subject.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit 2 — Move .planning/research/ to .planning/archive/v1.6-research/ (LOW-2)</name>
  <files>
    .planning/research/ARCHITECTURE.md →  .planning/archive/v1.6-research/ARCHITECTURE.md,
    .planning/research/FEATURES.md →  .planning/archive/v1.6-research/FEATURES.md,
    .planning/research/PITFALLS.md →  .planning/archive/v1.6-research/PITFALLS.md,
    .planning/research/STACK.md →  .planning/archive/v1.6-research/STACK.md,
    .planning/research/SUMMARY.md →  .planning/archive/v1.6-research/SUMMARY.md
  </files>
  <action>
Frozen v1.6 research snapshot — 5 files dated 2026-04-16 that the codebase no longer updates. The current source of truth is `.planning/codebase/`. Move (not delete) so the historical context remains discoverable.

The destination `.planning/archive/v1.6-research/` does not yet exist. `git mv` of a whole directory creates the destination automatically:
```bash
git mv .planning/research .planning/archive/v1.6-research
```

If git refuses the directory-level move on this Windows/Git combination (some bash builds prefer per-file), fall back to:
```bash
mkdir -p .planning/archive/v1.6-research
git mv .planning/research/ARCHITECTURE.md .planning/archive/v1.6-research/ARCHITECTURE.md
git mv .planning/research/FEATURES.md .planning/archive/v1.6-research/FEATURES.md
git mv .planning/research/PITFALLS.md .planning/archive/v1.6-research/PITFALLS.md
git mv .planning/research/STACK.md .planning/archive/v1.6-research/STACK.md
git mv .planning/research/SUMMARY.md .planning/archive/v1.6-research/SUMMARY.md
rmdir .planning/research 2>/dev/null || true
```

Then:
```bash
git status   # 5 renames, nothing else
git commit -m "chore: archive v1.6 research snapshot to .planning/archive/v1.6-research/"
```

This is its own commit (separate from Commit 1) because it is 5 files of meaningful historical content — keeping it isolated makes a future `git log --oneline` more readable.
  </action>
  <verify>
    <automated>test ! -d .planning/research && test -d .planning/archive/v1.6-research && test -f .planning/archive/v1.6-research/SUMMARY.md</automated>
    Also: `git log -1 --pretty=%s` should match `chore: archive v1.6 research snapshot...`
  </verify>
  <done>
    - `.planning/research/` directory removed (or empty).
    - All 5 files present under `.planning/archive/v1.6-research/`.
    - One commit with `chore:` prefix.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Commit 3 — Drop unused `export` keywords from 5 types (LOW-4)</name>
  <files>
    src/canvas/canvas-node-factory.ts,
    src/graph/edge-label-reconciler.ts,
    src/canvas/edge-label-sync-service.ts,
    src/graph/graph-validator.ts,
    src/donate/wallets.ts
  </files>
  <action>
Drop the leading `export` keyword on five interfaces flagged by `knip` as having zero external consumers. The parent prompt and planner Greps confirmed each type appears only in its own file. Re-verify before each edit using `git grep` to be safe.

**For each of the 5 types, do this in sequence:**

1. **`CreateNodeResult` (src/canvas/canvas-node-factory.ts:18):**
   ```bash
   git grep -n "CreateNodeResult"   # expect: only src/canvas/canvas-node-factory.ts
   ```
   If grep returns hits in any other file (including tests), STOP and skip this type — note it in the final report. Otherwise edit line 18:
   - Before: `export interface CreateNodeResult {`
   - After:  `interface CreateNodeResult {`

2. **`ReconcileResult` (src/graph/edge-label-reconciler.ts:28):**
   ```bash
   git grep -n "ReconcileResult"   # expect: only src/graph/edge-label-reconciler.ts
   ```
   - Before: `export interface ReconcileResult {`
   - After:  `interface ReconcileResult {`

3. **`NodeFieldsSnapshot` (src/canvas/edge-label-sync-service.ts:37):**
   ```bash
   git grep -n "NodeFieldsSnapshot"   # expect: only src/canvas/edge-label-sync-service.ts
   ```
   - Before: `export interface NodeFieldsSnapshot {`
   - After:  `interface NodeFieldsSnapshot {`

4. **`GraphValidatorOptions` (src/graph/graph-validator.ts:13):**
   ```bash
   git grep -n "GraphValidatorOptions"   # expect: only src/graph/graph-validator.ts
   ```
   - Before: `export interface GraphValidatorOptions {`
   - After:  `interface GraphValidatorOptions {`

5. **`DonateWallet` (src/donate/wallets.ts:15):**
   ```bash
   git grep -n "DonateWallet"   # expect: only src/donate/wallets.ts (line 15 def + line 21 ReadonlyArray<DonateWallet>)
   ```
   Note: line 21 self-references `DonateWallet` inside the same file — that still resolves after dropping `export` because the type is in scope. Edit line 15:
   - Before: `export interface DonateWallet {`
   - After:  `interface DonateWallet {`

   Do NOT touch line 21 — the `ReadonlyArray<DonateWallet>` reference is unaffected. Also do NOT touch the `DONATE_WALLETS` const export on line 21; that one IS imported elsewhere.

**If ANY of the 5 grep checks above unexpectedly returns a foreign-file import:** leave that one type as-is, drop the `export` only on the verified-safe types, and explicitly list the skipped type(s) in the final report. Do not force-remove `export` if the type is consumed externally.

**After all edits, run the full gate:**
```bash
npm run build
npm test
```

Both MUST pass. The build runs `tsc -noEmit -skipLibCheck` first — if a foreign import existed but was somehow missed, TypeScript will fail compile.

**Important:** Per CLAUDE.md, do NOT touch any other code in these 5 files. Only modify the single line per file that drops the `export` keyword. Append-only / minimal-edit rule applies.

```bash
git add src/canvas/canvas-node-factory.ts src/graph/edge-label-reconciler.ts src/canvas/edge-label-sync-service.ts src/graph/graph-validator.ts src/donate/wallets.ts
git commit -m "refactor: drop export from unused internal types (LOW-4)"
```
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm test</automated>
    Plus: `git diff HEAD~1 HEAD --stat` should show ~5 files, ~1 line each (one `export` keyword removed per file). No other code should change.
  </verify>
  <done>
    - All 5 types lose their `export` keyword (or any skipped type is explicitly listed in the final report with rationale).
    - `npm run build` passes (tsc + esbuild).
    - `npm test` passes (vitest).
    - Single commit with `refactor:` prefix.
  </done>
</task>

<task type="auto">
  <name>Task 4: Commit 4 — package.json cleanup: drop jiti, add eslint as direct devDep (LOW-5 + LOW-6)</name>
  <files>
    package.json,
    package-lock.json
  </files>
  <action>
Two npm dependency changes grouped into one commit. Both target the `package.json` devDependencies block. They are independent of each other but logically the same kind of work, so they share a commit.

**LOW-5: Remove unused `jiti`.**

Re-verify zero source imports first (parent prompt confirmed, but defensive):
```bash
git grep -n "jiti" -- src/ ':!src/**/*.test.ts' 'esbuild.config.mjs' 'vitest.config.*' 'tsconfig*.json' 2>/dev/null || true
# Expect: no output. If anything appears, STOP and report.
```

Then:
```bash
npm uninstall jiti
```

This will edit `package.json` (remove `"jiti": "2.6.1"` from devDependencies) and `package-lock.json` (drop the jiti tree). If npm hoisting later re-adds jiti as a transitive of some other package, leave it — only the direct devDep is being removed.

**LOW-6: Add `eslint` as a direct devDep.**

Currently `package.json:10` runs `eslint .` in the `lint` script, but `eslint` itself appears only transitively (pulled in by `@eslint/js` and `typescript-eslint`). This is the same shape as the previously-fixed `async-mutex` issue — relying on transitive presence is fragile across npm hoisting changes.

Pick a recent stable version. The repo already uses `@eslint/js@9.30.1` and `typescript-eslint@8.58.0`, which are aligned with the eslint v9 line, so install eslint v9:
```bash
npm install --save-dev eslint@^9
```

Verify:
```bash
npx eslint --version   # should print 9.x.y
npm run lint           # should run; if it surfaces lint errors that already existed in the repo before this change, that is OUT OF SCOPE — only confirm eslint runs and exits without an "eslint not found" / hoisting failure. Pre-existing lint errors are NOT to be fixed in this commit.
```

If `npm run lint` exits non-zero only due to pre-existing lint findings (not "command not found" or "module not found"), that is acceptable for this commit — eslint is now resolvable, which is the LOW-6 goal. Note any such pre-existing findings in the final report so the user can decide whether to follow up.

If `npm run lint` exits non-zero with a resolution error (eslint missing, plugin missing), that IS a regression — STOP, restore from git (`git checkout package.json package-lock.json`), and report.

**Final test gate** (covers both changes):
```bash
npm test
```

Then commit both files together:
```bash
git add package.json package-lock.json
git commit -m "build: drop unused jiti, add eslint as direct devDep"
```
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); if(p.devDependencies.jiti) process.exit(1); if(!p.devDependencies.eslint) process.exit(2); console.log('ok');" &amp;&amp; npx eslint --version &amp;&amp; npm test</automated>
  </verify>
  <done>
    - `package.json` devDependencies no longer contains `jiti`.
    - `package.json` devDependencies contains `eslint` (any v9.x).
    - `package-lock.json` reflects both changes.
    - `npx eslint --version` prints a version (eslint resolvable).
    - `npm test` passes.
    - Single commit with `build:` prefix.
    - Any pre-existing lint findings (NOT introduced by this commit) are noted in the final report but NOT fixed.
  </done>
</task>

<task type="auto">
  <name>Task 5: Commit 5 — Backfill versions.json with 1.0.0 through 1.7.0 (LOW-7)</name>
  <files>
    versions.json
  </files>
  <action>
`versions.json` currently has only 1.8.0–1.11.0. Backfill 1.0.0 through 1.7.0. Existing entries MUST be preserved verbatim.

**Step 1: Try to read the actual `minAppVersion` from each historical tag's manifest.json.**

Git tags `v1.0` through `v1.7` exist. For each tag, run:
```bash
for v in v1.0 v1.1 v1.2 v1.3 v1.4 v1.5 v1.6 v1.7; do
  echo "=== $v ==="
  git show "$v:manifest.json" 2>/dev/null | grep -E '"(version|minAppVersion)"' || echo "(no manifest.json at $v or unreadable)"
done
```

Capture each version's `minAppVersion`. If a tag is missing the manifest or the manifest has no `minAppVersion`, use the documented fallback `1.5.7` (this is the value carried by all currently-listed entries 1.8.0–1.11.0 and the value `manifest.json` shows today).

**Step 2: Note version mismatch caveat.**

Tags are named `v1.0`, `v1.1`, … `v1.7`. The `versions.json` keys must use **three-digit** semver: `1.0.0`, `1.1.0`, … `1.7.0`. The `package.json` history may show patch versions (e.g. `1.0.1`); for `versions.json` we only care about the major.minor.0 floor, since Obsidian's compat check resolves to the closest match. Use `X.Y.0` keys only.

**Step 3: Write the merged versions.json.**

The result must keep existing entries 1.8.0–1.11.0 EXACTLY (same key order, same values: `1.5.7`) and prepend the new ones. Final content:

```json
{
	"1.0.0": "<resolved>",
	"1.1.0": "<resolved>",
	"1.2.0": "<resolved>",
	"1.3.0": "<resolved>",
	"1.4.0": "<resolved>",
	"1.5.0": "<resolved>",
	"1.6.0": "<resolved>",
	"1.7.0": "<resolved>",
	"1.8.0": "1.5.7",
	"1.9.0": "1.5.7",
	"1.10.0": "1.5.7",
	"1.11.0": "1.5.7"
}
```

Where `<resolved>` is either the value read from the corresponding tag's manifest.json or `"1.5.7"` if unreadable. Match the existing file's formatting: 2-tab indentation (look at the current file — it uses TAB characters, not spaces), trailing newline, no extra whitespace.

**Step 4: Sanity check.**

```bash
node -e "const v=require('./versions.json'); const keys=Object.keys(v); if(keys.length!==12) {console.error('expected 12 keys, got',keys.length); process.exit(1);} for(const k of ['1.8.0','1.9.0','1.10.0','1.11.0']) if(v[k]!=='1.5.7') {console.error('clobbered existing key:',k); process.exit(2);} console.log('ok',keys);"
```

Must print `ok` followed by 12 keys.

```bash
git add versions.json
git commit -m "chore: backfill versions.json with 1.0.0–1.7.0 entries (LOW-7)"
```

**Final gate (full repo health check after all 5 commits):**
```bash
npm run build
npm test
```

Both MUST pass.
  </action>
  <verify>
    <automated>node -e "const v=require('./versions.json'); const keys=Object.keys(v); if(keys.length!==12) process.exit(1); for(const k of ['1.0.0','1.1.0','1.2.0','1.3.0','1.4.0','1.5.0','1.6.0','1.7.0','1.8.0','1.9.0','1.10.0','1.11.0']) if(!(k in v)) process.exit(2); for(const k of ['1.8.0','1.9.0','1.10.0','1.11.0']) if(v[k]!=='1.5.7') process.exit(3); console.log('ok');" &amp;&amp; npm run build &amp;&amp; npm test</automated>
  </verify>
  <done>
    - `versions.json` has exactly 12 keys: `1.0.0` through `1.7.0` and `1.8.0` through `1.11.0`.
    - Existing 1.8.0–1.11.0 entries unchanged (still `1.5.7`).
    - New 1.0.0–1.7.0 entries are either tag-derived `minAppVersion` or `1.5.7` fallback.
    - `npm run build` passes.
    - `npm test` passes.
    - Single commit with `chore:` prefix.
  </done>
</task>

</tasks>

<verification>
After all 5 tasks complete:

1. **Working tree clean:** `git status` shows nothing.
2. **5 commits added:** `git log --oneline -5` shows the 5 commits in order, each with conventional-commit prefix.
3. **Build passes:** `npm run build` exits 0.
4. **Tests pass:** `npm test` exits 0.
5. **All 8 LOW items addressed:**
   - LOW-1, LOW-3, LOW-8 → Commit 1
   - LOW-2 → Commit 2
   - LOW-4 → Commit 3
   - LOW-5, LOW-6 → Commit 4
   - LOW-7 → Commit 5
6. **No out-of-scope file touched:** `git diff HEAD~5 HEAD --name-only` only contains files listed in the `files_modified` frontmatter.
7. **No file in `src/styles/` or `src/views/` touched** (LOW-4 only touches `src/canvas/`, `src/graph/`, `src/donate/`).
</verification>

<success_criteria>
- 5 commits land on `main`, each commit message uses conventional-commit prefix matching recent history (`chore:`, `chore:`, `refactor:`, `build:`, `chore:`).
- `npm run build` and `npm test` both pass after the final commit.
- `git status` is clean.
- All 8 LOW items from CONCERNS.md are either resolved by these commits OR explicitly flagged in the final report with a reason (e.g., "type X turned out to be imported by Y, skipped").
- A final report enumerates: which items shipped, which were skipped + why, any pre-existing lint findings surfaced (informational only), and any unexpected side effects of `npm install` / `npm uninstall`.
</success_criteria>

<output>
After completion, create `.planning/quick/260430-uas-low-cleanup-batch-from-concerns-md/260430-uas-SUMMARY.md` covering:
- Per-LOW status (1–8) with commit hash where it landed.
- Any items skipped + reason.
- `npm run build` / `npm test` final outcomes.
- Any informational findings (e.g., pre-existing lint errors surfaced by LOW-6's eslint install).
- Suggested follow-ups, if any.
</output>
