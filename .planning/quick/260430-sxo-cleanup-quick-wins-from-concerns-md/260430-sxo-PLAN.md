---
quick_id: 260430-sxo
type: quick
mode: quick
created: 2026-04-30
description: "Cleanup quick-wins from CONCERNS.md (2026-04-30 scan): untrack build artifacts, drop duplicate src/styles.css build write, delete dead folder-picker-modal, archive shipped milestones."
source: .planning/codebase/CONCERNS.md
tasks: 4
autonomous: true
files_modified:
  - .gitignore
  - main.js                         # untrack only — file stays on disk
  - styles.css                      # untrack only — Obsidian loads from root
  - src/styles.css                  # untrack + delete (subsumed by Task 2)
  - esbuild.config.mjs
  - src/views/folder-picker-modal.ts            # deleted
  - src/snippets/snippet-service.ts             # docstring trim
  - src/__tests__/snippet-tree-dnd.test.ts
  - src/__tests__/snippet-tree-inline-rename.test.ts
  - src/__tests__/views/snippet-manager-folder-picker.test.ts
  - .planning/milestones/                       # contents moved out
  - .planning/archive/milestones/               # new — receives moved content
---

<objective>
Execute the four cleanup quick-wins identified in `.planning/codebase/CONCERNS.md`
(fresh scan dated 2026-04-30). Each task is independent and ships as its own
commit so any one of them can be reverted in isolation.

Purpose:
- Stop dirtying `git status` after every `npm run build` (HIGH-1).
- Stop the redundant write of `src/styles.css` on every build (HIGH-2).
- Remove orphaned `folder-picker-modal.ts` flagged by `knip` and self-marked
  `@deprecated` since Phase 51 (MEDIUM-1).
- Shrink the planner's scan surface by archiving 8.6 MB of shipped-milestone
  artifacts (MEDIUM-3).

Output: 4 commits on `main`, each addressing one concern, plus a SUMMARY.md
that flags any cross-references the executor noticed (e.g. milestone paths
referenced from `.planning/ROADMAP.md` / `.planning/MILESTONES.md`) for the
user to repoint manually. The cleanup itself is mechanical; cross-ref repair
is explicitly out of scope.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/codebase/CONCERNS.md
@.planning/STATE.md
@./esbuild.config.mjs
@./.gitignore
@./package.json

<critical_rules>
- "Never remove existing code you didn't add" applies to **partial edits** of
  shared files. Task 3 is a **complete-file deletion** of a self-`@deprecated`
  module, which the file's own JSDoc explicitly authorizes once
  `git grep FolderPickerModal` returns zero non-self hits — this is allowed.
- `styles.css` at the repo root is generated **but Obsidian loads it from
  there**. Do NOT delete the file from disk in Task 1 — only untrack it.
- Per-feature CSS sources under `src/styles/*.css` are **NOT duplicates** of
  `src/styles.css`. They are sources. Task 2 removes only `src/styles.css`
  (the build-output dupe) — never touch `src/styles/`.
- After Task 4, do **not** edit `.planning/ROADMAP.md`, `.planning/MILESTONES.md`,
  or any other doc to repoint moved paths. Cross-ref repair is the user's
  follow-up. Just record the broken refs in SUMMARY.md.
</critical_rules>

<repo_state>
Verified at planning time (2026-04-30):

- `git ls-files | grep -E '^(main\.js|styles\.css|src/styles\.css)$'` → all 3 tracked.
- `.gitignore` lists `main.js`, `main.js.map`, `styles.css` — but **not** `src/styles.css`. Task 1 must add `src/styles.css` to `.gitignore` before / alongside the `git rm --cached`.
- `esbuild.config.mjs:60` is the duplicate-CSS write line; the JSDoc on `cssPlugin` at lines 43–46 mentions the "convenience copy" and should be trimmed.
- `src/views/folder-picker-modal.ts` exists, is `@deprecated`, and has these external references (verified via `git grep FolderPickerModal`):
  - `src/snippets/snippet-service.ts:467` — JSDoc-only mention ("Used by FolderPickerModal").
  - `src/__tests__/snippet-tree-dnd.test.ts:244, 252, 254, 408, 580, 624` — `vi.mock` stub + `folderPickerCtorSpy` + `lastPickerCall` + comments. The "context menu Move to…" `describe` block at line 576 uses these spies in tests for a flow Phase 51 D-07 replaced. The executor must read those tests and decide whether they still validate live behavior; if every assertion routes through the now-deleted modal, the entire `describe` block is dead and should be removed with the spies.
  - `src/__tests__/snippet-tree-inline-rename.test.ts:224–229` — `vi.mock` stub only; no spies. Removing the `vi.mock` block is sufficient (the file's tests are about F2 inline rename, unrelated to the modal).
  - `src/__tests__/views/snippet-manager-folder-picker.test.ts` — entire file (271 lines, 6 tests under "Phase 51 Plan 04 — SnippetManager «Переместить в…» uses SnippetTreePicker (D-07)"). The tests themselves verify the **replacement** `SnippetTreePicker` flow; they only stub `FolderPickerModal` so the import resolves. Once the modal file is gone, the stub is unnecessary — the executor should remove only the `vi.mock` block (lines 241–245) and any other lines that mention the modal name (e.g. line 13 comment), keeping the actual `SnippetTreePicker` test logic intact.
- `.planning/milestones/` contents at planning time:
  - 13 top-level `*.md` files (`v1.0-REQUIREMENTS.md`, `v1.0-ROADMAP.md`, `v1.2..v1.11-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT,LEARNINGS}.md`)
  - 9 `v1.X-phases/` subdirectories (`v1.2`, `v1.4`, `v1.5`, `v1.6`, `v1.7`, `v1.8`, `v1.9`, `v1.10`)
  - All v1.0..v1.11 are shipped (per `.planning/STATE.md` line 5: `status: completed`); no active milestone — moving everything is safe.
- Cross-references to `.planning/milestones/v1.X-...` paths exist in:
  - `.planning/ROADMAP.md` (11 hits, all "Full details: `.planning/milestones/v1.X-ROADMAP.md`")
  - `.planning/MILESTONES.md` (8 hits, all "Archive: `.planning/milestones/v1.X-...`")
  - `.planning/PROJECT.md` and `.planning/STATE.md` were checked: no hits.
  These references will break after Task 4. The executor MUST list them in
  SUMMARY.md but MUST NOT edit them — that is the user's manual follow-up.
</repo_state>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Untrack generated build artifacts (HIGH-1)</name>
  <files>.gitignore, main.js, styles.css, src/styles.css</files>
  <action>
Stop tracking `main.js`, `styles.css`, and `src/styles.css` in git. The files
must remain on disk (Obsidian loads `styles.css` from the repo root).

Steps:

1. Append `src/styles.css` to `.gitignore` (the current `.gitignore` lists
   `main.js`, `main.js.map`, `styles.css` but is missing `src/styles.css`).
   Add it under the existing `# Build output` group, immediately after the
   `styles.css` line. Do not reorganize the rest of the file.

2. Untrack the three files (keeps them on disk):
   ```bash
   git rm --cached main.js styles.css src/styles.css
   ```

3. Verify the working tree still has all three files:
   ```bash
   ls main.js styles.css src/styles.css
   ```
   All three must still exist on disk after the cached removal.

4. Stage and commit (single, focused commit — do NOT include any other tasks'
   changes):
   ```bash
   git add .gitignore
   git commit -m "chore: stop tracking generated build artifacts"
   ```
   The `git rm --cached` already staged the deletions, so the commit will
   include `.gitignore` (modified) + 3 file deletions.

Commit-message style: matches recent history (e.g. `chore: remove
REQUIREMENTS.md for v1.11 milestone`, `5928cf5`). Plain `chore:` prefix, no
scope. Body optional but if added, mention `.gitignore drift` and the three
artifact paths.
  </action>
  <verify>
    <automated>git ls-files | grep -E '^(main\.js|styles\.css|src/styles\.css)$' ; test $? -eq 1</automated>
  </verify>
  <done>
- `git ls-files | grep -E '^(main\.js|styles\.css|src/styles\.css)$'` returns
  empty (exit 1).
- All three files still present on disk: `ls main.js styles.css src/styles.css` succeeds.
- `.gitignore` now contains `src/styles.css` under `# Build output`.
- `git log -1 --oneline` shows a `chore:` commit untracking the three files.
- `git status` is clean (no other side-effects committed).
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove duplicate `src/styles.css` build write (HIGH-2)</name>
  <files>esbuild.config.mjs, src/styles.css</files>
  <action>
Stop the build from writing a byte-identical copy of `styles.css` into
`src/styles.css`, and remove the now-orphaned file from disk.

Steps:

1. Edit `esbuild.config.mjs`:
   - Delete the line `fs.writeFileSync('src/styles.css', combined);`
     (currently line 60).
   - Update the JSDoc on `cssPlugin` at lines 43–46: remove the sentence
     "src/styles.css is kept in sync as a convenience copy for tools that
     expect it." Keep the rest of the JSDoc intact (the "Concatenates
     src/styles/*.css …" description and the "Obsidian loads styles.css from
     the plugin root." sentence stay).
   - Do NOT touch the `fs.writeFileSync('styles.css', combined);` line — that
     one is the file Obsidian loads.

2. Delete `src/styles.css` from disk (Task 1 already untracked it):
   ```bash
   rm src/styles.css
   ```
   (On Windows bash this is `rm`, not `del`.)

3. Run a clean production build to confirm:
   ```bash
   npm run build
   ```
   Expected: exits 0, regenerates `styles.css` at the repo root, and does NOT
   recreate `src/styles.css`.

4. Verify `src/styles.css` is absent:
   ```bash
   ls src/styles.css 2>&1 | grep -i 'no such file'
   ```
   (or `test ! -e src/styles.css && echo OK`)

5. Stage and commit:
   ```bash
   git add esbuild.config.mjs
   git commit -m "build: drop duplicate src/styles.css write from esbuild"
   ```

Commit-message style: `build:` is appropriate for esbuild config changes
(matches conventional commits used elsewhere in the repo). Single sentence
description; body optional.

NOTE: Task 1's `git rm --cached src/styles.css` already staged the file's
removal from the index. After Task 1's commit, the file is untracked. After
this task's `rm`, the file is gone from the working tree too — `git status`
will show it as already-removed (no further git action needed for the file
itself).
  </action>
  <verify>
    <automated>npm run build && test ! -e src/styles.css && grep -c "src/styles.css" esbuild.config.mjs | grep -q '^0$'</automated>
  </verify>
  <done>
- `esbuild.config.mjs` no longer contains the string `src/styles.css`.
- `src/styles.css` does not exist on disk.
- `npm run build` exits 0 and produces `styles.css` at the repo root.
- The "convenience copy" sentence is gone from the `cssPlugin` JSDoc.
- `git log -1 --oneline` shows a `build:` commit for the dedup.
- Per-feature CSS files under `src/styles/*.css` are untouched (verify with
  `git diff HEAD~1 -- src/styles/` returns empty).
  </done>
</task>

<task type="auto">
  <name>Task 3: Delete dead `folder-picker-modal.ts` and prune test stubs (MEDIUM-1)</name>
  <files>src/views/folder-picker-modal.ts, src/snippets/snippet-service.ts, src/__tests__/snippet-tree-dnd.test.ts, src/__tests__/snippet-tree-inline-rename.test.ts, src/__tests__/views/snippet-manager-folder-picker.test.ts</files>
  <action>
Delete the orphaned `FolderPickerModal` (self-`@deprecated` since Phase 51
D-07) and remove all references to it. The deprecation JSDoc on the file
itself authorizes deletion when `git grep FolderPickerModal` returns zero
non-self hits — Task 3 makes that condition true.

Steps:

1. **Delete the modal file:**
   ```bash
   git rm src/views/folder-picker-modal.ts
   ```

2. **Remove references in 5 other files** (verified at planning time — see
   `<repo_state>`):

   **a) `src/snippets/snippet-service.ts:467`** — JSDoc comment for
   `listAllFolders` (or similarly named function) currently reads:
   ```
   * Phase 34 (D-06): Return the sorted list of every folder under the snippet
   * root, including the root itself. Used by FolderPickerModal and by
   * SnippetEditorModal's "Папка" field. Delegates to listFolderDescendants.
   ```
   Edit to drop the "FolderPickerModal and by" phrasing while keeping the
   sentence grammatical. Suggested:
   ```
   * Phase 34 (D-06): Return the sorted list of every folder under the snippet
   * root, including the root itself. Used by SnippetEditorModal's "Папка" field
   * and SnippetTreePicker. Delegates to listFolderDescendants.
   ```
   Do not modify any code in this file — only the docstring.

   **b) `src/__tests__/snippet-tree-inline-rename.test.ts` lines 224–229** —
   delete the entire `vi.mock('../views/folder-picker-modal', () => ({ ...
   }))` block. The tests in this file exercise F2 inline rename and have no
   spies on the modal; the stub was only there so the import resolved. After
   removal, run `npm test -- snippet-tree-inline-rename` to confirm the file
   still passes.

   **c) `src/__tests__/views/snippet-manager-folder-picker.test.ts`** —
   - Delete the comment at line 13 that mentions `FolderPickerModal`.
   - Delete the entire `vi.mock('../../views/folder-picker-modal', () => ({
     ... }))` block at lines 241–245.
   - Keep the rest of the file: all 6 tests under the "Phase 51 Plan 04 —
     SnippetManager «Переместить в…» uses SnippetTreePicker (D-07)" describe
     block validate the **replacement** `SnippetTreePicker` flow and remain
     valuable.

   **d) `src/__tests__/snippet-tree-dnd.test.ts`** — this one is heaviest.
   The `describe('SnippetManagerView — drag-and-drop (Phase 34 Plan 02)')`
   block at line 403 contains a `describe('context menu Move to…', …)`
   sub-block (line 576) that uses `folderPickerCtorSpy` (declared at line
   249) and `lastPickerCall` (line 250) to assert against the deprecated
   modal. The actual production code path was replaced in Phase 51 D-07.
   - Read lines 244–700 of the file to understand the tests.
   - Delete the spy declarations at lines 244–250.
   - Delete the `vi.mock('../views/folder-picker-modal', …)` block at
     lines 251–256.
   - Delete the `mockClear`/reset lines at 408–409 and 580–582 (or whichever
     lines reference `folderPickerCtorSpy` / `lastPickerCall`).
   - Delete every test inside the "context menu Move to…" describe block
     that asserts on the spies (lines ~610, ~637, ~661, ~696 — the ones
     calling `folderPickerCtorSpy` or `lastPickerCall`). If, after pruning,
     the entire "context menu Move to…" describe block has no remaining
     tests, delete the describe block too.
   - Keep all dragstart / dragover / drop tests above line 576 — they do
     NOT reference the modal.
   - Delete the comment at line 624 that references `FolderPickerModal`.

3. **Verify the grep gate is clean:**
   ```bash
   git grep FolderPickerModal
   ```
   Expected output: empty (exit 1).

4. **Run the full test suite:**
   ```bash
   npm test
   ```
   Expected: all suites pass. If any test fails because it depended on the
   deleted spies, that test was validating the removed code path — delete
   it (and confirm via `git log -p` of the originating Phase 51 commits
   that the live behavior is covered by `snippet-manager-folder-picker.test.ts`'s
   SnippetTreePicker tests).

5. **Run a typecheck-clean build** (catches stale types from the test
   refactor):
   ```bash
   npm run build
   ```

6. **Commit:**
   ```bash
   git add -A
   git commit -m "refactor: remove dead FolderPickerModal and stale test stubs"
   ```

Commit-message style: `refactor:` matches the recent
`refactor(settings): move donate section …` commit style. Body should list
the files touched in bullet form (file deletion + 4 test/comment trims).
  </action>
  <verify>
    <automated>git grep FolderPickerModal ; test $? -eq 1 && npm test</automated>
  </verify>
  <done>
- `src/views/folder-picker-modal.ts` does not exist.
- `git grep FolderPickerModal` returns empty (exit 1).
- `npm test` passes (all vitest suites green).
- `npm run build` exits 0 (no TypeScript errors from the test refactor).
- `src/__tests__/views/snippet-manager-folder-picker.test.ts` still has
  its 6 SnippetTreePicker tests intact (only the `vi.mock` stub and the
  line-13 comment removed).
- `src/__tests__/snippet-tree-inline-rename.test.ts` F2-rename tests still
  pass (only the `vi.mock` stub removed).
- `git log -1 --oneline` shows a `refactor:` commit.
  </done>
</task>

<task type="auto">
  <name>Task 4: Archive shipped milestone artifacts (MEDIUM-3)</name>
  <files>.planning/milestones/, .planning/archive/milestones/</files>
  <action>
Move every file and subdirectory currently under `.planning/milestones/` to
`.planning/archive/milestones/`. All v1.0..v1.11 milestones are shipped (per
`.planning/STATE.md` line 5: `status: completed`); there is no active
milestone, so the entire directory contents can move.

Steps:

1. **Pre-flight: confirm no active milestone is referenced from a
   currently-running phase.** Already verified at planning time:
   - `.planning/STATE.md` line 5 says `status: completed`.
   - No `.planning/phases/` directory has open work (all v1.11 phases shipped
     2026-04-30 per commit `4be62d1`).

2. **Create the destination directory:**
   ```bash
   mkdir -p .planning/archive/milestones
   ```
   (`.planning/archive/` does not exist yet — verified at planning time.)

3. **Move every entry under `.planning/milestones/` to the archive:**
   ```bash
   git mv .planning/milestones/* .planning/archive/milestones/
   ```
   This will move ~13 top-level `.md` files plus 9 `v1.X-phases/`
   directories. The shell glob `*` on bash should expand to all entries.
   On Windows-bash, if the glob does not expand cleanly (returns a literal
   `*`), fall back to:
   ```bash
   for entry in .planning/milestones/*; do
     git mv "$entry" .planning/archive/milestones/
   done
   ```

4. **Confirm `.planning/milestones/` is now empty** (the directory itself
   may stay or be removed — empty git-tracked directories are not retained
   by git, so it will simply disappear from `git ls-files`):
   ```bash
   ls .planning/milestones/ 2>&1
   ```
   Expected: either empty output, "No such file or directory", or only an
   index/README that the executor explicitly chose to keep at the top
   level (none was identified at planning time).

5. **Confirm the move landed:**
   ```bash
   ls .planning/archive/milestones/ | wc -l
   ```
   Expected: roughly 22 entries (13 `.md` + 9 `v1.X-phases/`).

6. **Sanity-check active docs are NOT broken edits.** The user explicitly
   does NOT want the executor to repoint any cross-references. Just confirm
   the move did not accidentally edit any active doc:
   ```bash
   grep -rn 'milestones/v1' .planning/STATE.md .planning/PROJECT.md
   ```
   Expected: empty (verified at planning time — no hits in those two
   files).

7. **Catalogue broken cross-references for the SUMMARY.** Run:
   ```bash
   grep -rn 'milestones/v1' .planning/ROADMAP.md .planning/MILESTONES.md
   ```
   Capture the full output verbatim — these are the references that point
   to the OLD path and will need the user to repoint to
   `.planning/archive/milestones/v1.X-...`. **DO NOT EDIT THESE FILES.**
   Save the captured grep output for the SUMMARY.md.

8. **Commit:**
   ```bash
   git add -A
   git commit -m "chore: archive shipped milestone artifacts (v1.0..v1.11)"
   ```

Commit-message style: `chore:` matches the recent `chore: archive v1.11
milestone files and evolve PROJECT.md` (`015c7fb`) style. Body should note
that v1.0..v1.11 are all shipped, the move is mechanical, and that
cross-references in `.planning/ROADMAP.md` and `.planning/MILESTONES.md`
remain pointing at the old path and are flagged in the quick task
SUMMARY for the user to repoint.
  </action>
  <verify>
    <automated>test -d .planning/archive/milestones && test "$(ls .planning/milestones/ 2>/dev/null | wc -l | tr -d ' ')" = "0" && test "$(ls .planning/archive/milestones/ | wc -l | tr -d ' ')" -gt 15</automated>
  </verify>
  <done>
- `.planning/archive/milestones/` exists and contains ~22 entries (the
  full pre-move contents of `.planning/milestones/`).
- `.planning/milestones/` is empty (or absent — git does not retain empty dirs).
- `grep -rn 'milestones/v1' .planning/STATE.md .planning/PROJECT.md`
  returns empty (no edits to active state docs).
- The executor has captured a list of broken cross-refs from
  `.planning/ROADMAP.md` and `.planning/MILESTONES.md` for the SUMMARY.
- `git log -1 --oneline` shows a `chore:` commit for the archive.
- `git status` is clean.
  </done>
</task>

</tasks>

<verification>
After all 4 tasks ship as 4 separate commits:

1. **Build artifacts untracked:**
   `git ls-files | grep -E '^(main\.js|styles\.css|src/styles\.css)$'` → empty.
2. **Working tree intact:**
   `ls main.js styles.css` → both exist (Obsidian-loadable build is preserved).
   `ls src/styles.css 2>&1 | grep -q 'No such file'` → src dupe is gone.
3. **Build is green and idempotent:**
   `npm run build` exits 0, regenerates only the root `styles.css`.
4. **Tests are green:**
   `npm test` exits 0.
5. **Dead code is gone:**
   `git grep FolderPickerModal` → empty.
6. **Milestones archived:**
   `ls .planning/archive/milestones/ | wc -l` → ≥ 15. `ls .planning/milestones/` →
   empty/absent.
7. **Active state docs unmodified:**
   `git diff HEAD~4 -- .planning/STATE.md .planning/PROJECT.md` → empty.
8. **Commit count:**
   `git log --oneline HEAD~4..HEAD` → 4 commits, one per task, in order.
</verification>

<success_criteria>
- [ ] 4 commits on `main`, one per task, in the order Task 1 → Task 4.
- [ ] Each commit message follows existing project conventional-commits style
      (`chore:`, `build:`, `refactor:`, `chore:`).
- [ ] No commit batches changes from multiple tasks.
- [ ] All four `<verify>` automated checks pass when run after their task's
      commit lands.
- [ ] `npm run build` and `npm test` both green at HEAD after Task 4.
- [ ] SUMMARY.md flags the cross-references in `.planning/ROADMAP.md` (11 hits)
      and `.planning/MILESTONES.md` (8 hits) that now point at the old
      `.planning/milestones/v1.X-...` paths and need user-driven repointing.
- [ ] No edits to `.planning/STATE.md`, `.planning/PROJECT.md`,
      `.planning/ROADMAP.md`, or `.planning/MILESTONES.md` were made by the
      executor (cross-ref repair is explicitly out of scope for this quick).
- [ ] Per-feature CSS sources under `src/styles/*.css` are untouched.
</success_criteria>

<output>
After completion, create
`.planning/quick/260430-sxo-cleanup-quick-wins-from-concerns-md/260430-sxo-SUMMARY.md`
with:

- **Verdict:** PASS / PARTIAL / FAIL.
- **Commits:** SHA + subject for each of the 4 commits.
- **Verify outputs:** transcript of each `<verify>` automated check.
- **Cross-references flagged for user follow-up** (the captured grep output
  from Task 4 step 7) — list of file:line entries in
  `.planning/ROADMAP.md` and `.planning/MILESTONES.md` that point at the old
  `.planning/milestones/v1.X-...` paths and need to be repointed by the user
  to `.planning/archive/milestones/v1.X-...`.
- **Update `.planning/STATE.md` "Quick Tasks Completed" table** with a new
  row matching the existing format:
  | `260430-sxo` | Cleanup quick-wins from CONCERNS.md (untrack build artifacts, drop esbuild dupe write, delete folder-picker-modal, archive milestones) | 2026-04-30 | <last-commit-sha> | [260430-sxo-cleanup-quick-wins-from-concerns-md](./quick/260430-sxo-cleanup-quick-wins-from-concerns-md/) |
- **Update `.planning/STATE.md` `last_activity` and `last_updated`** in the
  frontmatter.
- **Notes:** any deviations the executor took (e.g. test deletions in
  Task 3) with the reasoning.
</output>
