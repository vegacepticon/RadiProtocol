# Phase 55: BRAT Distribution Readiness — Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 7 (4 modify, 1 untrack-only, 2 create)
**Analogs found:** 6 / 7 (preflight.sh has no in-repo analog — infer from 55-VALIDATION.md assertions)

---

## File Classification

| File | Op | Role | Data Flow | Closest Analog | Match Quality |
|------|----|----|-----------|---------------|----------------|
| `manifest.json` | modify | config / metadata | read-at-plugin-load (Obsidian) + fetched-by-BRAT (from Release assets) | **itself** (existing `manifest.json`) | self (only shape that matters) |
| `versions.json` | modify | config / metadata | read by Obsidian community-plugins updater from default branch | **itself** (existing `versions.json`) + `version-bump.mjs` for JSON style (tab indent via `JSON.stringify(.., null, '\t')`) | self + script-style-reference |
| `package.json` | modify (version field only) | config / npm-metadata | consumed by `version-bump.mjs` via `process.env.npm_package_version`; nothing else reads it at runtime | **itself** (existing `package.json`) | self |
| `.gitignore` | modify (append one line) | config / git-metadata | read by git CLI on every command; append-only semantics per CLAUDE.md "never delete existing rules" | **itself** (existing `.gitignore`) | self |
| `styles.css` | `git rm --cached` only (no content change) | artifact-only (generated) | written by esbuild `cssPlugin.onEnd` (`esbuild.config.mjs:47–65`); currently in git index (must be removed) | `main.js` — the *other* generated artifact, already correctly ignored | exact pattern-parallel |
| `.planning/phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` | CREATE | doc / user-facing runbook | read by human operator; copy-paste source for release workflow | `.planning/phases/53-runner-skip-close-buttons/53-UAT.md` (markdown tone, frontmatter, numbered scenarios) + `.planning/phases/54-inline-protocol-display-mode/54-03-SUMMARY.md` (narrative-with-commands style) | role-match (docs) |
| `.planning/phases/55-brat-distribution-readiness/scripts/release-preflight.sh` | CREATE | shell-script / verification harness | run locally by executor + `/gsd-verify-work`; exits 0 on full green; asserts versions alignment + untrack state + build freshness | **none in repo** — no prior phase has `scripts/*.sh`. Infer directly from `55-VALIDATION.md` Per-Task table + `55-RESEARCH.md` "SC-1 evidence" block (lines 474–500) | no-analog (use RESEARCH+VALIDATION inline asserts) |

---

## Pattern Assignments

### 1. `manifest.json` (modify — config / metadata)

**Analog:** itself — `Z:/projects/RadiProtocolObsidian/manifest.json` lines 1–11 (current pre-edit shape).

**Current shape (to preserve key order + spacing — 2-space indent, NOT tabs; see note below):**
```json
{
  "id": "radiprotocol",
  "name": "RadiProtocol",
  "version": "0.1.0",
  "minAppVersion": "1.5.7",
  "description": "Canvas-based guided protocol runner for radiologists.",
  "author": "",
  "authorUrl": "",
  "fundingUrl": "",
  "isDesktopOnly": true
}
```

**Indent note for planner (VERIFIED):** Current `manifest.json` on disk uses **2-space indent**, not tabs. `version-bump.mjs` line 11 uses `JSON.stringify(manifest, null, '\t')` which would convert to tabs IF the script were run — but per D4 + Pitfall 1 the script is NOT run. Therefore:

- If planner hand-edits, **preserve the existing 2-space indent** (matches current file, no whitespace-only churn in the diff).
- `55-RESEARCH.md` line 321 shows the "Tab indentation" comment — that applies only to the script path, which we are bypassing. **Follow disk truth, not the script comment.**

**Exact diff to apply (D1 + D3 + D9):**
```diff
 {
   "id": "radiprotocol",
   "name": "RadiProtocol",
-  "version": "0.1.0",
+  "version": "1.8.0",
   "minAppVersion": "1.5.7",
   "description": "Canvas-based guided protocol runner for radiologists.",
-  "author": "",
-  "authorUrl": "",
+  "author": "vegacepticon",
+  "authorUrl": "https://github.com/vegacepticon",
   "fundingUrl": "",
   "isDesktopOnly": true
 }
```

**Unchanged keys (MUST NOT be touched per D3 + per CLAUDE.md "never remove existing code"):** `id`, `name`, `minAppVersion`, `description`, `fundingUrl` (stays empty per D9), `isDesktopOnly`.

---

### 2. `versions.json` (modify — config / metadata)

**Analog:** itself — `Z:/projects/RadiProtocolObsidian/versions.json` lines 1–3.

**Current shape:**
```json
{
  "0.1.0": "1.5.7"
}
```

**Final shape (per D4 — delete stale entry, not append; rewrite the whole file):**
```json
{
  "1.8.0": "1.5.7"
}
```

**Indent note:** disk uses 2-space indent today. Keep 2-space (do not migrate to tabs even though `version-bump.mjs:16` would use tabs — we are not running the script, and preserving indent avoids whitespace-only noise).

**Why a rewrite, not a merge:** `version-bump.mjs` lines 14–16 are pure `versions[targetVersion] = minAppVersion` + write-back — it NEVER deletes keys. Running it would produce `{"0.1.0": "1.5.7", "1.8.0": "1.5.7"}` and violate D4. **Planner must bypass the script for this file and hand-rewrite.**

Reference excerpt from `version-bump.mjs:12–16`:
```javascript
// Update versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
```

---

### 3. `package.json` (modify — version field only)

**Analog:** itself — `Z:/projects/RadiProtocolObsidian/package.json` line 3.

**Exact diff (single-line change, touch nothing else):**
```diff
 {
   "name": "radiprotocol",
-  "version": "0.1.0",
+  "version": "1.8.0",
   "description": "Canvas-based guided protocol runner for Obsidian",
```

**DO NOT touch:** `scripts.version` (line 9 — preserves `node version-bump.mjs && git add manifest.json versions.json` for future additive releases per Research §"State of the Art"), dependencies, devDependencies, keywords, author (leave as `""` — CLAUDE.md + D9 scope only the *manifest* `author`, not npm's).

**Why no `npm version 1.8.0`:** Research Pitfall 2 — `npm config get tag-version-prefix` returns `v` in this env, which would tag `v1.8.0`. Also triggers Pitfall 1. Hand-edit is the safer single commit.

---

### 4. `.gitignore` (modify — append one line)

**Analog:** itself — `Z:/projects/RadiProtocolObsidian/.gitignore` lines 1–14 (current shape, flat list with section comments).

**Current shape (to extend, NOT rewrite):**
```
# Dependencies
node_modules/

# Build output
main.js
main.js.map

# Dev vault config (never commit vault paths)
.env

# OS files
.DS_Store
Thumbs.db
```

**Exact diff (append `styles.css` into the existing "Build output" section — preserve section ordering + comment style):**
```diff
 # Build output
 main.js
 main.js.map
+styles.css
```

**Style rules to follow:**
1. Section comments are `#` prefixed, single-line, placed directly above the group of patterns.
2. Patterns are bare (no leading `/`, no trailing comment) — maintain this style for the new entry.
3. Trailing newline at EOF is preserved by the existing file.
4. Per CLAUDE.md "never remove existing code you didn't add" — `main.js`, `main.js.map`, `.env`, `.DS_Store`, `Thumbs.db`, `node_modules/` all stay unchanged.

---

### 5. `styles.css` (untrack-only — no content change)

**Parallel analog:** `main.js` — the other esbuild output. Already correctly:
- written by `esbuild.config.mjs:58` (`fs.writeFileSync('styles.css', combined)` — see `cssPlugin.onEnd`)
- NOT committed to the repo (verified: `git ls-files main.js` → empty)
- listed in `.gitignore` line 5

**Gap to close:** `git ls-files styles.css` currently returns `styles.css` (verified this session). After the phase:
- `git ls-files styles.css` → empty
- `git check-ignore styles.css` → echoes `styles.css` (ignored)
- disk file remains (npm run build regenerates it every time)

**Exact command (planner's plan action):**
```bash
git rm --cached styles.css
```

**Critical ordering constraint (Pitfall 3 — VERIFIED against research):**
- `git rm --cached` MUST be staged in the SAME commit as the `.gitignore` addition.
- If the order splits across commits, every interim build produces a tracked-but-noisy modification.

**Esbuild CSS-write site (for planner to reference when explaining the ignore):**
```javascript
// esbuild.config.mjs:47–65 — cssPlugin
const cssPlugin = {
  name: 'css-concat',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      try {
        const parts = CSS_FILES.map((name) => {
          const filePath = `src/styles/${name}.css`;
          return fs.readFileSync(filePath, 'utf8');
        });
        const combined = parts.join('\n');
        fs.writeFileSync('styles.css', combined);        // ← line 58: repo-root styles.css
        fs.writeFileSync('src/styles.css', combined);    // ← line 59: convenience copy in src/
      } catch (err) {
        console.error(`[radiprotocol] CSS concat failed: ${err.message}`);
      }
    });
  },
};
```

**Implication for planner:** `src/styles.css` (the convenience copy on line 59) is a separate question — it is NOT in the phase scope per CONTEXT.md D5. Planner should leave `src/styles.css` alone. Verify pre-commit: `git ls-files src/styles.css` to know its current state before touching anything. If `src/styles.css` is currently tracked and gets regenerated by the build after the release commit, note as a follow-up — do NOT expand phase scope to address it.

---

### 6. `55-RELEASE-RUNBOOK.md` (CREATE — doc / user-facing runbook)

**Analogs for tone + structure:**
- **Primary:** `.planning/phases/53-runner-skip-close-buttons/53-UAT.md` — provides frontmatter style, numbered scenario list, Russian-language scenario narration mirroring `project_snippet_node_ux.md` convention. Good tone reference for the BRAT install smoke test section.
- **Secondary:** `.planning/phases/54-inline-protocol-display-mode/54-03-SUMMARY.md` — narrative-with-inline-bash-blocks style; good tone reference for the "execute this, then check that" flow.

**Frontmatter pattern (copy from `53-UAT.md` lines 1–17, ADAPT for runbook purpose):**
```markdown
---
phase: 55-brat-distribution-readiness
type: release-runbook
status: draft
performed_on: <YYYY-MM-DD — user fills at publish time>
final_verdict: pending
source:
  - 55-CONTEXT.md
  - 55-RESEARCH.md
  - 55-VALIDATION.md
created: 2026-04-21
---
```

**Section skeleton (derived from Research §Code Examples + §Validation Architecture):**
```markdown
# Phase 55 — v1.8.0 Release Runbook

> Step-by-step guide for publishing RadiProtocol v1.8.0 to GitHub so users can install via BRAT.
> Generated by Phase 55 planner; executed once by the repository owner.

## Prerequisites (local machine)
- clean `git status` on `main`
- `node`, `npm`, `git` installed (v24.11.1 / 11.12.1 / any recent)
- Repo cloned at `Z:/projects/RadiProtocolObsidian` or equivalent

## Step 1 — Release-prep commit (executor has already landed this)
<describe what executor did in Plans 01–03: manifest bump, versions.json rewrite, package.json sync, .gitignore + git rm --cached styles.css>

## Step 2 — Rebuild artifacts
```bash
npm run build
ls -la main.js styles.css   # both present, non-zero, recent mtime
```

## Step 3 — Tag and push
```bash
git tag -a 1.8.0 -m "v1.8.0 — UX Polish & Snippet Picker Overhaul"
git push origin main
git push origin 1.8.0
```

## Step 4 — Create the GitHub Release (web UI, per D6)
1. Open <https://github.com/vegacepticon/RadiProtocol/releases/new>
2. "Choose a tag" → select `1.8.0` (already pushed)
3. **Release title: `1.8.0`** (exact — no `v` prefix, no suffix — per Pitfall 5)
4. Paste the [Release Notes](#release-notes) block below into the description.
5. Drag-and-drop THREE loose files into the "Attach binaries" drop zone:
   - `manifest.json`
   - `main.js`
   - `styles.css`
   DO NOT zip them (Pitfall 6).
6. Leave "Set as a pre-release" **unchecked** (D8).
7. Click **Publish release**.

## Step 5 — Post-publish verification
<include curl-based API check from 55-RESEARCH.md lines 504–511>
<include fresh-vault BRAT install smoke test — 5 steps>

## Release Notes
<curated changelog drawn from phases 47–54 + 56; planner must trim to phases actually marked Complete in ROADMAP at runbook-writing time, per Research Assumption A3>

## SC-1 Preflight (executor runs before handoff)
```bash
bash .planning/phases/55-brat-distribution-readiness/scripts/release-preflight.sh
# expected: exits 0, prints "SC-1 local verification: PASS"
```
```

**Planner must also:**
- Include explicit `v`-prefix / zip / draft-release anti-patterns callout (Research Pitfalls 4–7).
- List the fresh-vault BRAT smoke test (SC-3 from `55-VALIDATION.md` Manual-Only table, line 67).

---

### 7. `scripts/release-preflight.sh` (CREATE — shell-script / verification harness)

**No in-repo analog.** There are zero prior `*.sh` files anywhere in `.planning/phases/**` (verified this session via Glob). Planner instead composes the script from two sources **already written and approved by research/validation**:

**Source A — Research §Validation Architecture "SC-1 evidence" block** (`55-RESEARCH.md` lines 474–500):
```bash
set -e
# Version alignment
test "$(node -e 'process.stdout.write(require("./manifest.json").version)')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(Object.keys(v).join(","))')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(v["1.8.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./package.json").version)')" = "1.8.0"
git rev-parse --verify 1.8.0 >/dev/null    # tag exists (skip if run before tag step)
git tag --list 1.8.0 | grep -q '^1\.8\.0$' # tag is unprefixed
! git tag --list | grep -q '^v1\.8\.0$'    # no v-prefixed duplicate
# Artifact hygiene
! git ls-files styles.css | grep -q .       # styles.css untracked
! git ls-files main.js | grep -q .          # main.js untracked
git check-ignore styles.css main.js | wc -l | grep -q '^2$'  # both ignored
# Build freshness
npm run build
test -s main.js
test -s styles.css
# Manifest metadata (D9)
test "$(node -e 'process.stdout.write(require("./manifest.json").author)')" = "vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").authorUrl)')" = "https://github.com/vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").fundingUrl)')" = ""
# Unchanged fields (D3)
test "$(node -e 'process.stdout.write(require("./manifest.json").minAppVersion)')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./manifest.json").isDesktopOnly.toString())')" = "true"
echo "SC-1 local verification: PASS"
```

**Source B — `55-VALIDATION.md` Per-Task table rows 41–47** — concise `jq`-based alternatives (use ONLY if `jq` is available; else fall back to Source A `node -e` style, which has zero external deps):
- `test "$(jq -r '.version' manifest.json)" = "1.8.0"`
- `jq -e '.["1.8.0"] == "1.5.7" and (has("0.1.0") | not)' versions.json`
- `jq -e '.author == "vegacepticon" and .authorUrl == "https://github.com/vegacepticon" and .fundingUrl == ""' manifest.json`
- `grep -Fxq 'styles.css' .gitignore && ! git ls-files --error-unmatch styles.css 2>/dev/null`
- `git rev-parse --verify 1.8.0 >/dev/null && ! git tag -l 'v1.8.0' | grep -q .`

**Planner's shape recommendation for `scripts/release-preflight.sh`:**
1. Shebang: `#!/usr/bin/env bash`
2. `set -euo pipefail` at top.
3. Compose from Source A (node -e) — no `jq` dependency (Research §Environment Availability flags `jq` as unavailable in this env).
4. Group checks into labelled sections (Version, Tag, Artifact hygiene, Build, Metadata) and echo a section header before each — makes failure localisation easy.
5. Gate the tag checks behind an `if git rev-parse --verify 1.8.0 >/dev/null 2>&1; then ... fi` so the script is runnable BEFORE the tag exists (Plans 01–02 can smoke-check partial green).
6. Exit 0 only on all-green; on any failure, `set -e` aborts with the failing line number.
7. Final line: `echo "SC-1 local verification: PASS"` (matches expected output string in 55-VALIDATION.md).

**File permissions:** Set executable bit via `git update-index --chmod=+x scripts/release-preflight.sh` after `git add` (standard `.sh` convention; not strictly required since `bash scripts/release-preflight.sh` works either way, but good hygiene).

---

## Shared Patterns

### Pattern S1 — Single-commit atomic release prep

**Source:** Research §Code Examples "The release-prep commit, end-to-end" (lines 348–375) + CLAUDE.md "never remove existing code" rule.

**Apply to:** Plans 01 + 02 (planner decides split; recommendation: single commit covering manifest.json + versions.json + package.json + .gitignore + `git rm --cached styles.css` — one atomic change is easier to verify and revert).

**Commit message template (Russian-friendly per user pref but technical artifact = English):**
```
chore(55): prepare v1.8.0 release

- manifest.json: version 1.8.0, author vegacepticon, authorUrl github
- versions.json: reset to {1.8.0: 1.5.7} (drop stale 0.1.0)
- package.json: version 1.8.0
- .gitignore: untrack styles.css (generated artifact)
- BRAT-01
```

### Pattern S2 — Bypass `version-bump.mjs` for this one-shot

**Source:** Research Pitfall 1 + Pitfall 2 combined.

**Apply to:** All Plans in Phase 55.

**Rule:** Do NOT invoke `npm version`, `npm run version`, or `node version-bump.mjs` anywhere in the plan actions. Hand-edit all three files (manifest.json, versions.json, package.json) in one commit. Reason: the script (a) appends to versions.json without deleting (D4 violation) and (b) would tag `v1.8.0` via npm's default prefix (D1 violation).

**Script stays in the repo as-is** for future additive releases (1.8.1, 1.9.0). Do NOT delete `version-bump.mjs`. CLAUDE.md "never remove existing code" applies.

### Pattern S3 — CLAUDE.md append-only rule for shared files

**Source:** `CLAUDE.md` lines 19–28 ("Never remove existing code you didn't add") + lines 35–42 ("CSS files: append-only per phase").

**Apply to:** `.gitignore`, `package.json`, `manifest.json`.

**Rule:** The phase may only ADD or MODIFY keys explicitly scoped by D1/D3/D4/D5/D9. ANY other key/line already present in these files must remain byte-identical in the diff.
- manifest.json: touch only `version`, `author`, `authorUrl`.
- package.json: touch only the top-level `version`.
- .gitignore: append one line to the "Build output" section, no other edits.
- versions.json: full rewrite is authorised explicitly by D4 — the only file where wholesale replacement is allowed.

### Pattern S4 — Build ordering (bump then build, not the reverse)

**Source:** Research Pattern 4 (lines 199–208).

**Apply to:** Plan 03 (rebuild step) must come AFTER Plan 01–02 (manifest edit + untrack). Never rebuild first then edit manifest.

**Executor gate:** Before running `npm run build`, verify `node -e 'console.log(require("./manifest.json").version)'` prints `1.8.0`.

### Pattern S5 — Unprefixed tag

**Source:** Research Pattern 1 + Pitfall 2 + Pitfall 5.

**Apply to:** Plan 03 (tagging step) and the runbook Step 3.

**Exact form:**
```bash
git tag -a 1.8.0 -m "v1.8.0 — <short descriptive suffix allowed HERE, in the annotation body only>"
```
- Tag NAME (the thing after `-a`): `1.8.0` — **no `v` prefix, no suffix**.
- Annotation BODY (after `-m`): may contain `v1.8.0` or descriptive text — it does not affect BRAT resolution.

**Never do:** `git tag v1.8.0`, `git tag 1.8.0-beta`, `npm version 1.8.0` (without `--no-git-tag-version`).

---

## No Analog Found

| File | Role | Data Flow | Reason | Recourse |
|------|------|-----------|--------|----------|
| `scripts/release-preflight.sh` | shell-script | verification harness | No prior `.sh` file in `.planning/phases/**` or anywhere else under version control (verified via Glob). | Compose directly from `55-RESEARCH.md` lines 474–500 (SC-1 block) and `55-VALIDATION.md` Per-Task table rows. Both were written for this phase specifically — they ARE the spec. |

Everything else has a self-analog (files being modified in-place) or a direct sample-plugin convention the Research doc already cited.

---

## Metadata

**Analog search scope:**
- `/` (repo root) — `manifest.json`, `versions.json`, `package.json`, `.gitignore`, `version-bump.mjs`, `esbuild.config.mjs` — all read in this session.
- `.planning/phases/**/` — Glob-scanned for `*-SUMMARY.md`, `*-UAT.md`, `*-RUNBOOK*.md`, `*.sh`, `scripts/`.

**Files scanned:** ~45 planning-artifact markdown files + 6 repo-root config files.

**Pattern extraction date:** 2026-04-21.

**Confidence:** HIGH for self-analog edits (manifest.json, versions.json, package.json, .gitignore, styles.css untrack) — exact shape on disk verified this session. HIGH for runbook structure — two strong in-repo precedents (53-UAT.md, 54-03-SUMMARY.md). MEDIUM for preflight.sh — no in-repo precedent, but Research + Validation docs fully specify the assertions; planner composes rather than invents.
