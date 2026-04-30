---
phase: 62-brat-release-v1.9.0
plan: 02
subsystem: distribution
tags: [release, brat, build, preflight, git-tag, v1.9.0]
requires: [62-01]
provides: [v1.9.0-release-prep-commit, v1.9.0-annotated-tag, sc-1-local-pass]
affects:
  - main.js
  - styles.css
  - manifest.json
  - versions.json
  - package.json
  - .planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh
requirements: [BRAT-02]
completed: 2026-04-25
metrics:
  files_changed: 4
  insertions: 62
  deletions: 3
  build: passed
  build_main_js_bytes: 170060
  build_styles_css_bytes: 44325
  release_prep_commit: 39fa38f
  annotated_tag_object: 37f7f34
  annotated_tag_name: "1.9.0"
  preflight_marker: "SC-1 local verification: PASS"
  verification_assertions: 9/9 passed
---

# Phase 62 Plan 02: Build, Preflight, Atomic Commit, Tag Summary

Built shippable artifacts (`main.js` + `styles.css`) against the v1.9.0 manifest, authored the v1.9.0 preflight harness adapted from Phase 55, landed ONE atomic release-prep commit covering Plan 01's three config edits plus the new preflight script, then created the unprefixed annotated git tag `1.9.0` pointing at that commit. SC-1 fully evidenced locally — Plan 03 runbook can now be executed.

## Completed Tasks

| Task     | Name                                                                | Result | Files                                                                                       | Commit  |
| -------- | ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- | ------- |
| 62-02-01 | Build — `npm run build` regenerates main.js + styles.css            | PASS   | main.js (170060 B), styles.css (44325 B)                                                    | n/a (artifacts ignored — Phase 55 D5) |
| 62-02-02 | Author release-preflight.sh                                          | PASS   | .planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh                        | bundled into 62-02-03 |
| 62-02-03 | Atomic release-prep commit (3 config + 1 script)                    | PASS   | manifest.json, versions.json, package.json, .planning/.../scripts/release-preflight.sh      | 39fa38f |
| 62-02-04 | Annotated tag `1.9.0` (unprefixed) pointing at release-prep commit  | PASS   | (git-only)                                                                                  | tag obj 37f7f34 → commit 39fa38f |

## Build Output

`npm run build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`) produced:

| Artifact     | Size (bytes) | Lines | Tracked? | Ignored? |
| ------------ | ------------ | ----- | -------- | -------- |
| `main.js`    | 170060       | 14    | no       | yes      |
| `styles.css` | 44325        | 1760  | no       | yes      |

Both artifacts were freshly regenerated against `manifest.version === "1.9.0"` (Phase 55 Research S4 ordering satisfied: bump first, build second). Both remain ignored by `.gitignore` (Phase 55 D5 state preserved unchanged) — `git ls-files main.js` and `git ls-files styles.css` both return empty; `git check-ignore main.js styles.css` matches both paths.

`.gitignore` was NOT modified this plan — it still reads:

```
# Build output
main.js
main.js.map
styles.css
```

## Atomic Release-Prep Commit

**SHA:** `39fa38f18e8ae9b882e7e402daac4103e5e03451` (short: `39fa38f`)
**Subject:** `chore(62): prepare 1.9.0 release — manifest, versions, package, preflight`
**Stats:** 4 files changed, 62 insertions(+), 3 deletions(-)

`git show --name-status HEAD`:

```
M	manifest.json
M	package.json
M	versions.json
A	.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh
```

Exactly 4 entries (3 modifications + 1 addition). `main.js`, `styles.css`, and `.planning/v1.8-MILESTONE-AUDIT.md` are NOT included — staged set was constructed from explicit filenames only (no `git add -A`, no `git add .`), per CLAUDE.md git-safety rule.

Diff highlights verified post-commit:

- `git diff HEAD~1 HEAD -- manifest.json` contains `"version": "1.9.0"`.
- `git diff HEAD~1 HEAD -- versions.json` contains both `1.8.0` and `1.9.0` (D4 PRESERVE confirmed at diff level).

## Annotated Git Tag

**Tag name:** `1.9.0` (unprefixed — NO `v`, per D1 / Phase 55 Pattern 1 / Pitfall 2)
**Tag object SHA:** `37f7f34e6df19d349b02e77c3ecd69aa6bbc0aa1` (short: `37f7f34`)
**Points at commit:** `39fa38f18e8ae9b882e7e402daac4103e5e03451` (the release-prep commit, == HEAD)
**Type:** `tag` (annotated, not lightweight — confirmed via `git cat-file -t 1.9.0`)
**Annotation message:** `RadiProtocol v1.9.0` (the `v` is in the free-text body only, NOT in the tag name)

`git tag -l --format='%(refname:short) %(contents:subject)' '1.9.0'` output:

```
1.9.0 RadiProtocol v1.9.0
```

`git tag -l 'v1.9.0'` returns empty — no v-prefixed collision (Phase 55 Pitfall 2 re-mitigated).

Legacy tag `1.8.0` from Phase 55 remains intact.

The tag was NOT pushed — push is the user's job in Plan 03's runbook, gated on D10 (Phase 60 UAT approval).

## Preflight Script

**Path:** `.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh`
**Permissions:** `-rwxr-xr-x` (executable)
**Shebang:** `#!/usr/bin/env bash`
**Strict mode:** `set -euo pipefail`
**Two structural deltas vs. Phase 55 analog:**

1. `=== Version alignment ===` block asserts `manifest.version === "1.9.0"`, `Object.keys(versions.json).sort().join(",") === "1.8.0,1.9.0"`, both keys map to `"1.5.7"`, and `package.version === "1.9.0"`.
2. `=== Tag state ===` block guards on `1.9.0` / `v1.9.0` (vs. Phase 55's `1.8.0` / `v1.8.0`).

All other blocks (manifest metadata, unchanged fields, artifact hygiene, build freshness, final PASS marker) are byte-identical in intent to the Phase 55 script.

### Final preflight run (post-tag) — pasted PASS stdout

```
=== Version alignment ===
=== Manifest metadata (D9 — locked by Phase 55) ===
=== Unchanged fields (D3) ===
=== Tag state ===
  tag 1.9.0 present, no v1.9.0 collision
=== Artifact hygiene (D5 — unchanged from Phase 55) ===
=== Build freshness ===

> radiprotocol@1.9.0 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production

◇ injecting env (1) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
[radiprotocol] Copied to dev vault: Z:\documents\vaults\TEST-BASE\.obsidian\plugins\radiprotocol
SC-1 local verification: PASS
```

The earlier mid-plan run (between Tasks 62-02-02 and 62-02-04) printed `  tag 1.9.0 not yet created (acceptable pre-Task 62-02-04)` instead of the tag-present line — both branches of the gated tag-state block are exercised.

## Verification

All 9 substantive plan-level `<verification>` assertions PASSED:

```
1/9 OK: test -s main.js                                                          (170060 bytes)
2/9 OK: test -s styles.css                                                       (44325 bytes)
3/9 OK: git log -1 --format='%s' | grep -q '^chore(62): prepare 1.9.0 release'   (HEAD subject)
4/9 OK: git rev-parse --verify 1.9.0                                             (1.9.0 tag exists)
5/9 OK: [ -z "$(git tag -l 'v1.9.0')" ]                                          (no v-prefixed collision)
6/9 OK: git cat-file -t 1.9.0 | grep -qx 'tag'                                   (annotated tag)
7/9 OK: [ "$(git rev-parse 1.9.0^{commit})" = "$(git rev-parse HEAD)" ]          (tag at HEAD)
8/9 OK: git rev-parse --verify 1.8.0                                             (legacy Phase 55 tag preserved)
9/9 OK: bash .../release-preflight.sh 2>&1 | tail -1 | grep -qx 'SC-1 local verification: PASS'
```

Per-task automated `<verify>` nodes (all PASS):

- Task 62-02-01: `BUILD_OK` — main.js+styles.css non-empty, git-clean, ignored, untracked.
- Task 62-02-02: `preflight OK` — script exists, executable, asserts on `1.9.0` and `1.8.0,1.9.0`, runs end-to-end with PASS marker.
- Task 62-02-03: `commit OK` — exactly 4 staged entries (3 M + 1 A), no main.js/styles.css in commit.
- Task 62-02-04: `tag OK` — annotated tag at HEAD, no `v1.9.0`, preflight still PASS.

Per-task acceptance criteria all green. The plan's 10th `<verification>` line (`[ -z "$(git status --porcelain)" ]`) was intentionally relaxed because the working tree carried two pre-existing items the user explicitly instructed to preserve untouched (see Deviations below) — these did not affect the atomic 4-file commit and did not bleed into the release-prep commit.

## Deviations from Plan

### Auto-fixed Issues

None.

### Intentionally preserved (per user task instructions)

The plan's verification block included a strict empty-tree assertion `[ -z "$(git status --porcelain)" ]`. The working tree at plan start (and end) contains TWO pre-existing items that the user explicitly instructed me to leave untouched:

1. `.planning/v1.8-MILESTONE-AUDIT.md` (modified) — pre-existing dirty file, "DO NOT TOUCH, preserve per CLAUDE.md and per prior phases' precedent."
2. `.planning/phases/62-brat-release-v1.9.0/62-01-SUMMARY.md` (untracked) — Plan 01's deliverable; "SUMMARY stays untracked per Plan 01's handoff note; it'll be committed at phase-complete time."

Neither of these files entered the staged set for the 62-02-03 atomic commit — `git diff --cached --name-status` showed exactly the 4 expected entries (`M manifest.json`, `M versions.json`, `M package.json`, `A .planning/.../release-preflight.sh`) before committing. CLAUDE.md "Never remove existing code you didn't add" was honored.

This is documented as an intentional residual — NOT an auto-fix. The plan's atomic-commit acceptance criteria (no `main.js`, no `styles.css`, exactly 4 expected entries) all passed cleanly. The empty-tree assertion was the only line not satisfied, and only because of these two pre-existing user-protected items.

## Deferred Issues

None for this plan. Out of scope but noted:

- `.planning/v1.8-MILESTONE-AUDIT.md` modification — pre-existing, ownership unclear, preserved unchanged per user instruction.
- Phase-complete commit covering `62-01-SUMMARY.md`, `62-02-SUMMARY.md`, STATE.md / ROADMAP.md updates is deferred to a later step (Plan 03 or a phase-finalization commit). This plan deliberately scopes only the release-engineering deliverables (build + atomic commit + tag) per the Phase 55 S1 atomic-commit pattern — adding the SUMMARY into this commit would have violated the 4-file scope.
- No `git push` and no GitHub Release creation — both belong to Plan 03's runbook (D10-gated on Phase 60 UAT approval).

## Known Stubs

None. The 4 affected files are: 3 config files (no UI, no runtime data) plus a verification harness script. No placeholder values, no UI rendering, no data wiring introduced.

## Threat Flags

None. The plan's `<threat_model>` enumerated five threats (T-62-02-01 through T-62-02-05), all dispositioned `mitigate` or `accept`. Mitigations were satisfied:

- **T-62-02-01** (tag/asset/manifest spoofing) — preflight `=== Version alignment ===` + `=== Tag state ===` blocks both pass; pre-tag gate in 62-02-04 re-asserted.
- **T-62-02-02** (secret in build asset) — accepted residual; no `.env` baked into bundle (verified by build script behavior; esbuild.config.mjs does not inject `.env` into the production bundle).
- **T-62-02-03** (v1.9.0 collision) — pre-tag gate `! git tag -l 'v1.9.0' | grep -q .` passed; preflight `=== Tag state ===` block also asserts; two independent gates satisfied.
- **T-62-02-04** (unintended file in commit) — `git diff --cached --name-status` pre-commit verification showed exactly 4 expected entries; no `main.js`/`styles.css`/audit drift.
- **T-62-02-05** (artifact re-enters index) — preflight `=== Artifact hygiene ===` block asserts both files NOT in `git ls-files` AND both literal lines still in `.gitignore`; passed.

No new security surface introduced. ASVS L1 sufficient for release-engineering scope.

## Self-Check: PASSED

- `main.js` exists at repo root, 170060 bytes (verified via `test -s main.js` + `wc -c`).
- `styles.css` exists at repo root, 44325 bytes (verified via `test -s styles.css` + `wc -c`).
- `.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh` exists, executable, contains `#!/usr/bin/env bash`, `set -euo pipefail`, `1.9.0`, `1.8.0,1.9.0`, `SC-1 local verification: PASS`.
- Release-prep commit `39fa38f` exists in git history (`git log --oneline | grep 39fa38f` returns the commit subject).
- Annotated tag `1.9.0` resolves: `git rev-parse 1.9.0` = `37f7f34e6df19d349b02e77c3ecd69aa6bbc0aa1`; `git rev-parse 1.9.0^{commit}` = `39fa38f18e8ae9b882e7e402daac4103e5e03451` (== HEAD).
- No `v1.9.0` tag (`git tag -l 'v1.9.0'` empty).
- Legacy tag `1.8.0` (Phase 55) intact (`git rev-parse --verify 1.8.0` exits 0).
- Preflight final run prints `SC-1 local verification: PASS` as last stdout line.
- SUMMARY.md path: `.planning/phases/62-brat-release-v1.9.0/62-02-SUMMARY.md` (this file).
