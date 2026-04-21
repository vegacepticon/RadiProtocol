# Phase 55: BRAT Distribution Readiness — Research

**Researched:** 2026-04-21
**Domain:** Obsidian plugin release mechanics (BRAT) + git tag/version hygiene
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D1 — Version string**: `1.8.0` (SemVer). Tag `1.8.0`, `manifest.version = "1.8.0"`, `versions.json` key `"1.8.0"`.
- **D2 — Legacy tags v1.0…v1.7**: Leave as-is. No retag, no force-push. First aligned tag is `1.8.0`.
- **D3 — `minAppVersion`**: Keep `1.5.7`. Unchanged.
- **D4 — `versions.json` legacy entry**: Delete `"0.1.0"`. Final file = `{"1.8.0": "1.5.7"}`.
- **D5 — Build artifacts in git**: Both ignored. Add `styles.css` to `.gitignore`; `git rm --cached styles.css`. `main.js` stays ignored.
- **D6 — Release creation tool**: User-driven via GitHub web UI. Planner produces a runbook; user executes. No `gh` CLI.
- **D7 — Release notes content**: Curated v1.8 changelog drawn from phases 47–54 + 56; written into the runbook.
- **D8 — Pre-release flag**: Latest (normal Release), not pre-release.
- **D9 — `manifest.json` metadata**: `author` = `"vegacepticon"`, `authorUrl` = `"https://github.com/vegacepticon"`, `fundingUrl` = empty.

### Claude's Discretion

- Exact command ordering within a single version-bump commit (single commit vs. split commits).
- Wording of the curated changelog bullets (drawn from phase SUMMARY/UAT docs).
- Runbook filename, shape, and level of copy-pasteability.
- Local verification script / check-list that the executor runs before declaring the phase done.

### Deferred Ideas (OUT OF SCOPE)

- GitHub Actions workflow to auto-build + auto-release on tag push.
- Submitting RadiProtocol to the official Obsidian community-plugins registry.
- Populating `fundingUrl`.
- Raising `minAppVersion`.
- Installing `gh` CLI in the dev environment.
- Retroactive Releases for v1.0…v1.7 tags.
- Cross-checking that `main.js` embeds the manifest version string.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAT-01 | Repo is installable via BRAT with identifier `vegacepticon/RadiProtocol`; `manifest.json` / `versions.json` / git tag align; GitHub Release exists with `manifest.json` + `main.js` + `styles.css` as root assets. | Sections *Standard Stack*, *Architecture Patterns*, *Runtime State Inventory*, *Common Pitfalls*, *Validation Architecture*. |
</phase_requirements>

## Summary

Phase 55 is a **release-engineering phase**, not a code-change phase. Every TypeScript source file is frozen; the work is entirely in `manifest.json`, `versions.json`, `.gitignore`, git tags, and a user-executed GitHub Release via the web UI. The planner must treat this as (a) a handful of deterministic file edits and git operations the executor performs locally, (b) a runbook the user follows once, and (c) a local verification pass that proves SC-1 and SC-2 are *about to be* satisfiable before the user goes to github.com.

The critical technical facts are all confirmed against official Obsidian developer documentation and the BRAT developer guide: the three required release assets are `manifest.json`, `main.js`, `styles.css` attached loose (not zipped) at the root of the Release; the git tag MUST be **unprefixed** (i.e., `1.8.0`, not `v1.8.0`) and MUST byte-exactly match `manifest.version`; BRAT selects the **latest** (by SemVer) release on the repo and downloads those three files directly from its assets. There is no `versions.json` requirement on the Release itself — `versions.json` lives in the repo default branch and serves the Obsidian community-plugins update path, not BRAT.

Two latent hazards justify care: (1) `npm config get tag-version-prefix` in this environment returns `v`, so a plain `npm version 1.8.0` would create tag `v1.8.0` and break the convention — the planner must force `--no-git-tag-version` and create the tag manually; (2) `version-bump.mjs` **appends** to `versions.json` without pruning, so blindly running `npm version` leaves the stale `0.1.0` entry behind and D4 fails — the planner either skips the script and hand-edits, or adds an explicit post-script rewrite step.

**Primary recommendation:** Edit `manifest.json` + `versions.json` + `package.json` + `.gitignore` by hand in one commit, `git rm --cached styles.css` in the same commit, then create an annotated tag `1.8.0` pointing at that commit. Skip `npm version` entirely — it is more trouble than it is worth for a one-shot release where `versions.json` needs a delete-and-rewrite.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest version source-of-truth | Repo default branch (`manifest.json`) | `package.json` (reflected for npm tooling) | Obsidian and BRAT both read `manifest.json` from the Release assets; `package.json` is the npm-scripts entry-point only. |
| Version-to-minAppVersion mapping | Repo default branch (`versions.json`) | — | Consumed by Obsidian community-plugins update check; NOT consumed by BRAT but required by the sample-plugin convention and expected by some tooling. |
| Build artifact production | Local dev machine (esbuild) | — | `npm run build` produces `main.js` + `styles.css` which the user then uploads. No CI. |
| Tag-to-release binding | GitHub (tag + Release object) | — | BRAT resolves `owner/repo` → latest Release → assets by SemVer of the release tag. |
| Installable unit delivery | GitHub Release assets | — | Three files attached loose at the root of the Release. Not a zip. Not `main.js` committed to the repo. |
| User install flow | BRAT plugin (runtime, inside Obsidian) | — | User types `vegacepticon/RadiProtocol` into BRAT's "Add beta plugin" dialog. BRAT does the rest. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| esbuild | 0.28.0 (already installed) | Bundles `src/main.ts` → `main.js`; concatenates `src/styles/*.css` → `styles.css` | Already the build tool; no change needed. |
| git | any recent | Tag + commit operations | Shell-native. |
| Obsidian sample plugin convention | n/a (reference) | `manifest.json` field shape + tag convention + release-asset layout | This is THE reference pattern Obsidian and BRAT expect. [CITED: https://github.com/obsidianmd/obsidian-sample-plugin] |
| BRAT | n/a (consumer) | Installs plugins from `user/repo` GitHub paths | User runs BRAT 2.0.0+ in their vault; no repo-side dependency. [CITED: https://github.com/TfTHacker/obsidian42-brat] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node` | v24.11.1 (installed) | Runs `version-bump.mjs` if we choose to | Only if we decide NOT to hand-edit — see Architecture Patterns §3. |
| `npm` | 11.12.1 (installed) | Runs `npm run build` | Always, to produce `main.js` + `styles.css` before user uploads. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web UI Release creation (D6) | `gh release create 1.8.0 manifest.json main.js styles.css -t "v1.8.0 — …" -F RELEASE_NOTES.md` | `gh` CLI is NOT installed (`command -v gh` returns nothing) and D6 locks web UI — not available, and out of scope to install per Deferred Ideas. |
| Hand-edit version bump | `npm version 1.8.0 --no-git-tag-version` + manual `git tag 1.8.0` | `version-bump.mjs` **appends** to `versions.json` without pruning (`versions[targetVersion] = minAppVersion` leaves the `0.1.0` entry); D4 still requires a follow-up manual rewrite. See Common Pitfalls §1. |
| `npm version` with re-configured prefix | `npm config set tag-version-prefix '' --location=project` (writes `.npmrc`) | Creates a new repo-level file just to flip one flag, and still doesn't solve D4 versions.json pruning. Not worth it for a one-shot release. |

**Installation:** No new packages required.

**Version verification:** Nothing to verify in the registry — this phase adds no dependencies. The only version number this phase cares about is `1.8.0` itself (D1).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────── Local Dev Machine ────────────────────────┐
│                                                                │
│  1. Edit files (executor):                                    │
│     manifest.json  ─┐                                         │
│     versions.json  ─┤                                         │
│     package.json   ─┼─► single commit                         │
│     .gitignore     ─┤                                         │
│     [index -= styles.css] ─┘                                   │
│                                                                │
│  2. npm run build ──► main.js + styles.css (untracked)        │
│                                                                │
│  3. git tag 1.8.0 ──► tag points at commit from step 1        │
│                                                                │
│  4. git push origin main 1.8.0 ─────┐                         │
│                                      │                         │
└──────────────────────────────────────┼─────────────────────────┘
                                       │
                                       ▼
                       ┌─────────── github.com ────────────┐
                       │                                     │
                       │  5. User (web UI, per runbook):    │
                       │     - Create Release for tag 1.8.0 │
                       │     - Attach 3 files:              │
                       │         manifest.json              │
                       │         main.js                    │
                       │         styles.css                 │
                       │     - Paste curated changelog      │
                       │     - "Set as pre-release" OFF     │
                       │     - Publish                      │
                       │                                     │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                       ┌──── User's Obsidian vault ────┐
                       │                                │
                       │  6. BRAT resolves identifier   │
                       │     vegacepticon/RadiProtocol  │
                       │     → latest Release (1.8.0)   │
                       │     → downloads 3 assets       │
                       │     → installs into            │
                       │       .obsidian/plugins/       │
                       │       radiprotocol/            │
                       │                                │
                       └────────────────────────────────┘
```

### Recommended Project Structure

No new files in `src/`. Artifacts of this phase live in:

```
./manifest.json        ← edited (version, author, authorUrl)
./versions.json        ← rewritten ({"1.8.0": "1.5.7"})
./package.json         ← version field synced to "1.8.0"
./.gitignore           ← adds styles.css (main.js already ignored)
./                     ← styles.css removed from index (file remains on disk, built artifact)
.planning/phases/55-brat-distribution-readiness/
    55-RUNBOOK.md      ← NEW: user-facing runbook for the web-UI Release step (recommended name)
```

### Pattern 1: Unprefixed tag matching manifest.version byte-exactly
**What:** The git tag, the release name, and `manifest.version` MUST all read `1.8.0` with no `v` prefix.
**When to use:** Every Obsidian plugin release, always. This is a hard requirement of the Obsidian community-plugin index *and* BRAT. [CITED: Obsidian docs, `Submission requirements for plugins`, and BRAT-DEVELOPER-GUIDE.md: "release tag, release name, and the version stored in the released `manifest.json`" must all match.]
**Example:**
```bash
# The one-liner that matters:
git tag -a 1.8.0 -m "v1.8.0 — UX Polish & Snippet Picker Overhaul"
# NOT:  git tag v1.8.0
# NOT:  git tag 1.8.0-beta
```

### Pattern 2: Manual versions.json rewrite (not via version-bump.mjs)
**What:** D4 requires pruning the stale `0.1.0` entry. `version-bump.mjs` only appends — reading it confirms it does `versions[targetVersion] = minAppVersion` with no delete, so running it leaves `{"0.1.0": "1.5.7", "1.8.0": "1.5.7"}`.
**When to use:** This one-shot v1.8 release that deletes a legacy never-released entry. For future `1.8.1`, `1.9.0` releases that are additive, `version-bump.mjs` is fine.
**Example:**
```bash
# Final contents of versions.json — written directly, not via the script:
cat > versions.json <<'EOF'
{
	"1.8.0": "1.5.7"
}
EOF
```
(Tabs, not spaces — matches the style `version-bump.mjs` uses via `JSON.stringify(versions, null, '\t')`.)

### Pattern 3: styles.css untrack + re-ignore (one commit)
**What:** `styles.css` is currently tracked (`git ls-files styles.css` → present; `main.js` → absent, correctly ignored). D5 says align them by untracking `styles.css` AND adding it to `.gitignore` in the same commit.
**When to use:** Only this phase — thereafter `styles.css` behaves like `main.js` has since inception.
**Example:**
```bash
# Inside the single release-prep commit:
git rm --cached styles.css       # removes from index only; file stays on disk
# Then edit .gitignore to add a styles.css line
git add .gitignore
git commit -m "chore(55): prepare v1.8.0 release — version bump, manifest metadata, untrack styles.css"
```
**Critical follow-up:** next `npm run build` regenerates `styles.css` on disk; because the file is now ignored, `git status` stays clean. This IS the intended steady state.

### Pattern 4: Build ordering (bump first, build second)
**What:** Edit `manifest.json` FIRST, run `npm run build` SECOND, so the build is a clean bundle against the already-bumped manifest. Current code does not inline the manifest version into `main.js`, but future versions might — following the safer ordering now avoids a future foot-gun.
**When to use:** Every release.
**Example:**
```bash
# Step 1: edit manifest, versions, package.json, .gitignore; commit; untrack styles.css
# Step 2: npm run build   (regenerates main.js + styles.css against the new manifest)
# Step 3: git tag 1.8.0
# Step 4: git push + web UI Release
```

### Anti-Patterns to Avoid

- **Running `npm version 1.8.0` without flags.** In this environment `npm config get tag-version-prefix` returns `v`, so npm would create tag `v1.8.0` — breaking the convention. Also triggers `version-bump.mjs` which leaves `0.1.0` in `versions.json`. [VERIFIED: local `npm config get tag-version-prefix`]
- **Zipping the three assets into one `.zip` file.** BRAT downloads each asset by filename from the Release's asset list — a zip is invisible. [CITED: BRAT-DEVELOPER-GUIDE.md]
- **Committing `styles.css` edits alongside the version bump.** Per CLAUDE.md `styles.css` is a generated file — the phase's goal is to un-track it, not freshly check in a stale copy. The final commit should contain a `styles.css` REMOVAL from the index, never an addition.
- **Creating a `.github/workflows/*.yml` file.** CI automation is explicitly Out of Scope per REQUIREMENTS.md and CONTEXT.md Deferred Ideas. Nothing in the phase touches that path.
- **Tagging with `v1.8.0`.** Legacy tags `v1.0…v1.7` used that convention and never shipped as Releases; the new scheme is unprefixed per D1. Do not retag legacy tags either (D2).
- **Retroactive Releases for v1.0…v1.7.** Explicitly Deferred.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-bump manifest + versions.json | A new Node script | Hand-edit for the one-shot; `version-bump.mjs` already exists for additive future releases | Existing `version-bump.mjs` handles 90% case; this release is the 10% that needs a delete — just edit it. |
| Create Release from CLI | `gh` install + script | GitHub web UI per D6 | `gh` not installed, user explicitly chose web UI. |
| Curated changelog generation | Parser over phase SUMMARY.md frontmatter | Hand-curated bullets extracted from existing phase docs | Reader-oriented narrative beats machine-concatenated titles; ~15 min one-time cost (D7). |
| Version embedding in main.js | `DEFINE` substitution in esbuild | Leave as-is (not embedded today) | Deferred per CONTEXT.md; not required by BRAT. |

**Key insight:** Every hand-roll candidate here either (a) already has an existing convention we just follow (sample-plugin manifest shape, unprefixed tag), or (b) is explicitly scoped out (CI, gh CLI, version embedding). This phase is pure "follow the manual".

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no databases, no plugin-managed state files on user vaults are touched. Existing `sessions/` JSON that the Runner writes is unaffected (uses plugin-id `radiprotocol` which is constant across this release). | None. |
| Live service config | None — no external services. BRAT itself is a third-party Obsidian plugin the user installs independently; it reads GitHub's REST API and our Release assets. Nothing for us to "register". | None. |
| OS-registered state | None — plugin is not registered with the OS. Obsidian loads it by directory name `.obsidian/plugins/radiprotocol/` which is driven by `manifest.json.id = "radiprotocol"` (unchanged this phase). | None. |
| Secrets/env vars | None — no credentials, no tokens. `.env` exists for dev-vault copy (`OBSIDIAN_DEV_VAULT_PATH`) but is local-only and unrelated to the release. | None. |
| Build artifacts | `main.js` (166242 bytes, ignored), `styles.css` (42274 bytes, CURRENTLY TRACKED — must be untracked by D5). `main.js.map` ignored. No pip/npm egg-info equivalents. The plugin has no installed-system-package footprint. | **`styles.css`: remove from index in the release-prep commit, add to `.gitignore` in the same commit.** After this, next `npm run build` regenerates both and git sees nothing. |

**Canonical question answered:** After every repo edit lands and `npm run build` runs, the only runtime systems that have the old `0.1.0` string cached anywhere are (a) no end-user vaults yet (v0.1.0 was never released), (b) no BRAT-registered installs (same reason), and (c) the legacy `v1.0…v1.7` tags with no Releases are invisible to BRAT. Runtime state is effectively empty — the "rename" is a first-write, not a migration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | esbuild build + version-bump script (if used) | ✓ | v24.11.1 | — |
| `npm` | `npm run build` | ✓ | 11.12.1 | — |
| `git` | Tag, commit, push | ✓ | implied by `git status` working | — |
| `gh` CLI | Would enable programmatic release | ✗ | — | **Web UI per D6** (by design) |
| `jq` | Pretty-print / assert manifest fields | ✗ | — | `node -e 'console.log(require("./manifest.json").version)'` |
| `.github/workflows/*.yml` | Optional CI | ✗ (no `.github/` dir) | — | N/A — explicitly out of scope |

**Missing dependencies with no fallback:** None that block this phase.
**Missing dependencies with fallback:** `gh` (fallback: web UI — the intended path); `jq` (fallback: `node -e`).

## Common Pitfalls

### Pitfall 1: `version-bump.mjs` silently appends; `versions.json` keeps `0.1.0`
**What goes wrong:** Running `npm version 1.8.0` triggers `node version-bump.mjs && git add manifest.json versions.json`. The script does `versions[targetVersion] = minAppVersion` and writes back — it NEVER deletes keys. Result: `versions.json` becomes `{"0.1.0": "1.5.7", "1.8.0": "1.5.7"}`, violating D4.
**Why it happens:** The script's mental model is additive (each release is a new row in the map). Our D4 wants a full reset because `0.1.0` was never shipped.
**How to avoid:** EITHER skip `npm version` entirely and edit `manifest.json` + `versions.json` + `package.json` by hand, OR run `npm version --no-git-tag-version` then overwrite `versions.json` before committing. Recommendation: **hand-edit** — simpler and visible in the diff.
**Warning signs:** `versions.json` has more than one key after the bump commit is staged.
[VERIFIED: read `version-bump.mjs` directly — lines 12–16 show pure set-then-write with no delete.]

### Pitfall 2: `npm version` creates `v`-prefixed tag
**What goes wrong:** `npm config get tag-version-prefix` returns `v` in this environment. Plain `npm version 1.8.0` with the default `--git-tag-version` creates tag `v1.8.0`, not `1.8.0`. Obsidian + BRAT require the unprefixed form.
**Why it happens:** npm's global default for `tag-version-prefix` is `v`. Obsidian's convention inverts this.
**How to avoid:** ALWAYS pass `--no-git-tag-version` to `npm version`, then `git tag -a 1.8.0 -m "..."` manually. Our recommended path skips `npm version` entirely for this release.
**Warning signs:** `git tag --list | grep '^v1\.8'` returns a match after the bump.
[VERIFIED: local `npm config get tag-version-prefix` output = `v`.]

### Pitfall 3: `.gitignore` adds `styles.css` but `git rm --cached` is forgotten
**What goes wrong:** Adding `styles.css` to `.gitignore` while it's still in the git index is a no-op — git continues to track the existing file and pick up modifications. Every `npm run build` then produces a tracked-but-noisy diff.
**Why it happens:** `.gitignore` only prevents NEW files from being added; it doesn't untrack files already in the index.
**How to avoid:** BOTH actions in the SAME commit: `git rm --cached styles.css` AND add the line to `.gitignore`. Verify after with `git ls-files | grep styles.css` — must return empty.
**Warning signs:** After commit, `git ls-files styles.css` still lists the file, or `npm run build` shows `styles.css` as modified.
[VERIFIED: local `git ls-files styles.css` currently returns `styles.css` — the file IS tracked today.]

### Pitfall 4: Tag pushed, Release not created → BRAT shows "no release found"
**What goes wrong:** The user `git push origin 1.8.0` but forgets the web-UI Release step. BRAT's resolver on `vegacepticon/RadiProtocol` queries the Releases API, sees an empty list (no Releases attached to the new tag), and errors.
**Why it happens:** A git tag ≠ a GitHub Release. Releases are a separate GitHub object that wraps a tag with a title, body, and asset uploads.
**How to avoid:** Runbook's final step is Release creation with asset upload; runbook's final verification step is "refresh the Releases tab and confirm `1.8.0` appears with 3 assets". Also: hand the user a post-publish BRAT smoke test (fresh vault install).
**Warning signs:** On GitHub, `https://github.com/vegacepticon/RadiProtocol/releases/latest` 404s or redirects to an old tag; BRAT dialog reports `Unable to find manifest.json`.
[CITED: BRAT-DEVELOPER-GUIDE.md — "a repository without releases would be uninstallable via BRAT".]

### Pitfall 5: Release name / tag / manifest.version drift
**What goes wrong:** The user creates the Release with title "v1.8.0 — UX Polish" (with `v`) but the tag is `1.8.0` and the manifest says `1.8.0`. Obsidian/BRAT require byte-exact match on all three strings.
**Why it happens:** The Release title is a free-text field in the GitHub UI; easy to add a decorative `v`.
**How to avoid:** Runbook spells out "Release title: `1.8.0`" (exact, no prefix, no extras). The optional descriptive suffix (e.g., `v1.8.0 — UX Polish`) must go in the body, NOT in the title/tag.
**Warning signs:** Comparing manifest.version vs. the `refs/tags/*` name vs. the Release name in the UI shows any string mismatch.
[CITED: BRAT-DEVELOPER-GUIDE.md — "release tag, release name, and the version stored in the released `manifest.json`" must all match.]

### Pitfall 6: Zipped assets
**What goes wrong:** User drag-and-drops a `radiprotocol-1.8.0.zip` containing the three files into the Release — BRAT sees a zip, not individual assets, and fails to find `manifest.json`.
**Why it happens:** Zipped Releases are conventional for traditional software; Obsidian plugins are the exception.
**How to avoid:** Runbook makes the three files explicit: drop `manifest.json`, `main.js`, `styles.css` one at a time (or all three at once, but as individual files).
**Warning signs:** Release's "Assets" section shows a single `*.zip`.

### Pitfall 7: `styles.css` removed from index but not present on disk when user uploads
**What goes wrong:** Executor does `git rm --cached styles.css` in a fresh clone scenario, then hands off to user. If user then runs `git clean -fdx` (or the clone is fresh), `styles.css` is absent and must be rebuilt before upload.
**Why it happens:** `git rm --cached` only removes from the index; the file stays on the current working tree but isn't restored on a fresh checkout.
**How to avoid:** Runbook's step order is: (1) clone / pull main at tag, (2) `npm install`, (3) `npm run build` — this deterministically regenerates `main.js` + `styles.css` from source. Do NOT rely on the working tree carrying them over.
**Warning signs:** Before upload, `ls -la main.js styles.css` doesn't show both files with recent mtime.

## Code Examples

### Hand-edit manifest.json (final shape)
```json
{
	"id": "radiprotocol",
	"name": "RadiProtocol",
	"version": "1.8.0",
	"minAppVersion": "1.5.7",
	"description": "Canvas-based guided protocol runner for radiologists.",
	"author": "vegacepticon",
	"authorUrl": "https://github.com/vegacepticon",
	"fundingUrl": "",
	"isDesktopOnly": true
}
```
(Tab indentation — matches what `version-bump.mjs` produces via `JSON.stringify(manifest, null, '\t')`.)

### Final versions.json
```json
{
	"1.8.0": "1.5.7"
}
```

### .gitignore append
```
# Dependencies
node_modules/

# Build output
main.js
main.js.map
styles.css      # ← added Phase 55

# Dev vault config (never commit vault paths)
.env

# OS files
.DS_Store
Thumbs.db
```

### The release-prep commit, end-to-end
```bash
# 1. Edit manifest.json, versions.json, package.json ("version": "1.8.0"), .gitignore by hand
# 2. Untrack styles.css from index (file stays on disk)
git rm --cached styles.css

# 3. Stage
git add manifest.json versions.json package.json .gitignore

# 4. Single commit
git commit -m "chore(55): prepare v1.8.0 release

- manifest.json: version 1.8.0, author vegacepticon, authorUrl github
- versions.json: reset to {1.8.0: 1.5.7} (drop stale 0.1.0)
- package.json: version 1.8.0
- .gitignore: untrack styles.css (generated artifact)
- BRAT-01"

# 5. Rebuild against the new manifest
npm run build

# 6. Annotated tag
git tag -a 1.8.0 -m "v1.8.0 — UX Polish & Snippet Picker Overhaul"

# 7. Push (user authorises if needed)
git push origin main
git push origin 1.8.0
```

### Local verification commands (executor runs these before handoff)
```bash
# SC-1 checks — local
node -e 'console.log(require("./manifest.json").version)'        # → 1.8.0
node -e 'console.log(Object.keys(require("./versions.json")))'    # → [ '1.8.0' ]
git tag --list '1.8.0'                                            # → 1.8.0  (exact, unprefixed)
git status --porcelain                                            # → empty (clean tree)
git ls-files styles.css                                           # → empty (untracked)
git check-ignore styles.css main.js                               # → both echoed (both ignored)
npm run build && echo OK                                          # → OK, main.js + styles.css present
ls -la main.js styles.css                                         # → recent mtime, non-zero size

# SC-2 prep (files must exist, readable, non-empty):
test -s manifest.json && test -s main.js && test -s styles.css && echo "3 assets ready"
```

### Curated changelog input — phase → user-visible bullets

Drawn from the phase SUMMARY/UAT docs (all verified completed phases):

- **Phase 47 — Runner Regressions** (complete): manual textarea edits preserved across loop transitions; textarea auto-scrolls to insertion point after choice click; choice buttons render Cyrillic descenders and parentheses fully.
- **Phase 48 — Node Editor UX Polish** (planned, will land pre-release): obsolete "Snippet ID" field removed from Text blocks; new nodes now placed below anchor (vertical tree); Answer form shows Display label above Answer text; Question textarea auto-grows; quick-create buttons relocated to a bottom vertical stack.
- **Phase 48.1 — Toolbar Gap Tighten** (complete): tighter spacing between Node Editor form content and the bottom toolbar.
- **Phase 49 — Loop Exit Edge Convention** (complete): loop exit label is now editable via the edge (not hardcoded «выход»).
- **Phase 50 — Answer ↔ Edge Label Sync** (complete): editing an Answer's Display label updates every incoming edge label, and vice-versa.
- **Phase 50.1 — Loop Exit `+` Prefix** (complete): loop exit edges marked with a leading `+`; body edges can now carry labels unambiguously; five clear Russian validator errors guide authors.
- **Phase 51 — Snippet Picker Overhaul** (planned): unified hierarchical snippet picker with drill-down, breadcrumb, and tree-wide search; Snippet nodes can bind to a specific file.
- **Phase 52 — JSON Placeholder Rework** (complete): JSON placeholders simplified to two types — free-text and unified choice (with multi-select); options editor fixed; legacy types surface validation errors.
- **Phase 53 — Runner Skip & Close Buttons** (complete, skip part pending): Close button in Runner with confirmation; Skip button advances without appending text.
- **Phase 54 — Inline Protocol Display Mode** (in review): new `Run protocol in inline` command opens a floating modal that appends answers directly to the active note.
- **Phase 56 — Snippet Button UX Reversal** (complete): file-bound Snippet nodes now render as buttons and insert content directly on click; folder-selection in the snippet editor shows a "committed" state indicator.
- **Distribution — this phase**: the repo is now installable via BRAT with identifier `vegacepticon/RadiProtocol`.

**Planner note:** several of the above are status "planned" as of research time (48, 51, parts of 53, 54). The runbook changelog must only include phases that have actually shipped at release time — the planner builds the runbook late enough in the release window that this drift is resolved. Recommended task: "Before writing the final runbook, re-read `.planning/ROADMAP.md` Progress table and include only rows marked Complete."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `manifest-beta.json` alongside main manifest for BRAT testing | Plain `manifest.json` on Releases; BRAT selects by SemVer of Release tag | BRAT v1.1.0 (ignored since), v2.0.0 fully dropped | We do NOT create `manifest-beta.json`. [CITED: BRAT-DEVELOPER-GUIDE.md] |
| `v`-prefixed tags (legacy git/semver convention) | Unprefixed tags matching `manifest.version` | Obsidian community-plugins convention (always) | Our v1.0…v1.7 tags used the old convention and never shipped Releases — harmless legacy. New tag 1.8.0 is unprefixed. |
| Committing `main.js` / `styles.css` to repo | `.gitignore` both; authoritative copies ship as Release assets only | Obsidian sample-plugin template (current) | D5 aligns us with current convention. |

**Deprecated/outdated:**
- `manifest-beta.json`: ignored by BRAT since v1.1.0. Do not create.
- `gh` CLI path: not installed in this env and out of scope to install (D6).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BRAT 2.0.0+ is the version end-users install. If a user is on BRAT < 1.1.0 they might still look for `manifest-beta.json`. | State of the Art | Low — BRAT auto-updates through Obsidian's community-plugin channel; a user old enough to miss this has other problems. Not worth creating `manifest-beta.json` as a belt-and-suspenders. |
| A2 | The user's GitHub repo is publicly accessible (no private-repo BRAT install path considered). | Architecture Patterns | Low — implicit from the open-source nature of the plugin and the BRAT identifier `vegacepticon/RadiProtocol`. |
| A3 | Phases 48, 51, parts of 53, and 54 will be complete by the time the user executes the runbook. If they slip, the changelog bullets list unreleased features. | Code Examples §changelog | Medium — the planner must instruct the executor/runbook user to trim the changelog to only-Complete phases at release-writing time. Explicit guardrail included. |

**If this table is empty:** Not empty — three low-to-medium-risk assumptions noted above; the planner should flag A3 as a pre-release checklist item.

## Open Questions

1. **Should the runbook also include a BRAT smoke-test script?**
   - What we know: SC-3 is a human-only end-to-end check ("installing via BRAT in a fresh vault succeeds").
   - What's unclear: Whether the planner wants to produce a 5-step "how to test this in a fresh vault" block inside the runbook.
   - Recommendation: Yes — include a BRAT install smoke test in the runbook as a post-publish step. One-time cost, high confidence boost for first Release.

2. **Should `package.json.version` be bumped too?**
   - What we know: Obsidian and BRAT only read `manifest.version`. `package.json.version` is npm-internal.
   - What's unclear: Whether leaving `package.json.version = 0.1.0` is acceptable.
   - Recommendation: Bump it to `1.8.0` anyway — single source-of-truth principle, matches what `npm version` would do, zero downside, and keeps `version-bump.mjs` meaningful for future releases.

3. **Should the single commit be a merge commit from a `release/1.8.0` branch, or straight to main?**
   - What we know: Repo's current branch is `main`; recent commits land directly on main; no feature-branch convention in evidence.
   - What's unclear: User preference.
   - Recommendation: Straight to main — matches repo's observed workflow; no merge ceremony needed for a 1-commit change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 (existing) |
| Config file | none — vitest picks up by default via `"test": "vitest run"` in `package.json` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |
| TypeScript check | `npx tsc --noEmit --skipLibCheck` |
| Build | `npm run build` |

**Phase 55 caveat:** This phase does NOT add unit tests. No TypeScript changes = no tests to write. The validation architecture is **operational verification** (commands that assert file contents and git state), not behavioural verification.

### Phase Requirements → Validation Map

| Req ID | Behavior (Success Criterion) | Test Type | Automated Command | File Exists? |
|--------|------------------------------|-----------|-------------------|--------------|
| BRAT-01 (SC-1) | `manifest.json.version`, `versions.json` keys, and git tag all read `1.8.0`; `npm run build` green against new manifest | operational audit | see script below | local-only, executor runs |
| BRAT-01 (SC-2) | GitHub Release exists with 3 loose assets (`manifest.json`, `main.js`, `styles.css`) | human+observation (web UI) | runbook checklist; optional curl of Releases API | N/A (gh UI) |
| BRAT-01 (SC-3) | BRAT install in fresh vault succeeds end-to-end — plugin appears, enables, Runner opens | manual-only | BRAT install smoke test in runbook | N/A (human) |

**SC-1 evidence (executor runs locally, pre-handoff):**
```bash
set -e
# Version alignment
test "$(node -e 'process.stdout.write(require("./manifest.json").version)')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(Object.keys(v).join(","))')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(v["1.8.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./package.json").version)')" = "1.8.0"
git rev-parse --verify 1.8.0 >/dev/null    # tag exists
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

**SC-2 evidence (post-publish, human + optional API curl):**
```bash
# Optional — works without gh CLI:
curl -s https://api.github.com/repos/vegacepticon/RadiProtocol/releases/latest \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); \
             const names=(d.assets||[]).map(a=>a.name).sort().join(","); \
             console.log("tag:", d.tag_name, "name:", d.name, "assets:", names); \
             process.exit(d.tag_name==="1.8.0" && names==="main.js,manifest.json,styles.css" ? 0 : 1)'
# Expected: tag: 1.8.0  name: 1.8.0  assets: main.js,manifest.json,styles.css
```

**SC-3 evidence (human only):**
Fresh Obsidian vault → install BRAT from community plugins → BRAT: Add beta plugin → paste `vegacepticon/RadiProtocol` → wait → Settings → Community plugins → enable RadiProtocol → open Runner command → Runner view opens without console errors.

### Sampling Rate
- **Per code change (unit tests):** N/A — phase has no code changes.
- **Per release-prep commit:** run the SC-1 verification block above (bash). Takes < 10s.
- **Per tag push:** same, plus `git log -1 1.8.0` sanity.
- **Phase gate:** SC-1 block passes green; runbook exists; user executes runbook and reports success on SC-2 + SC-3.

### Wave 0 Gaps

- [x] No new test files needed — phase is release engineering, not code.
- [ ] **Runbook file does not exist yet** — `55-RUNBOOK.md` in phase directory. This is the primary artifact the planner delivers.
- [ ] **SC-1 verification script** — can be inlined in the runbook (bash block) or kept as a phase-local helper. Recommendation: inline in the runbook so the user can copy-paste.
- [ ] **No changes to `package.json` scripts** — `npm test` / `npm run build` remain as-is.

*If the phase had been a code phase, the test infrastructure (vitest, tsc) is already in place — 642 tests pass at Phase 52, no framework install needed.*

## Security Domain

This phase has no runtime code changes and no new data paths. The security surface is:

| Concern | Applies | Mitigation |
|---------|---------|-----------|
| Credential leak in commit | yes (minor) | D9 metadata contains only the public GitHub handle `vegacepticon` and a public URL — no secrets, no email, no real name. Already public in the repo owner field. |
| Supply-chain integrity of the Release | yes | GitHub Releases are signed by GitHub; the user uploads from their own machine over HTTPS. BRAT verifies filename match on download. No additional hardening is in scope. |
| Plugin-code injection via malicious PR | no (not in this phase) | No code changes. |
| Committing `styles.css` with accidental secrets | no | `styles.css` is generated, no interpolation of env vars; read `esbuild.config.mjs` confirms concat-only. |

**ASVS categories active:** V1 Architecture (release process integrity only), V10 Configuration (manifest hygiene). All handled by following Obsidian's prescribed conventions.

## Sources

### Primary (HIGH confidence)
- [Obsidian sample plugin repository](https://github.com/obsidianmd/obsidian-sample-plugin) — reference `manifest.json` shape
- [BRAT Developer Guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md) — release asset requirements, tag/name/manifest-version triple match, `manifest-beta.json` deprecated since v1.1.0
- Local `version-bump.mjs` — read directly; confirms append-only behaviour
- Local `esbuild.config.mjs` — read directly; confirms `main.js` outfile and `styles.css` concat output
- Local `.gitignore` — read directly; confirms `main.js` already ignored, `styles.css` currently tracked
- Local `git ls-files styles.css` — confirms tracked state
- Local `npm config get tag-version-prefix` — confirms `v` default in this environment
- Local `git tag --list` — confirms `v1.0…v1.7` exist, no `1.8.0` collision, no bare `1.x`
- Local `command -v gh` — confirms gh NOT installed

### Secondary (MEDIUM confidence, multiple independent sources)
- [Obsidian docs — Release with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions) — tag-matches-manifest-version rule (via raw-GitHub fetch + WebSearch confirmation)
- [Obsidian forum — Using GitHub actions to release plugins](https://forum.obsidian.md/t/using-github-actions-to-release-plugins/7877) — community-confirmed unprefixed-tag convention
- [Obsidian forum — BRAT functional update v2](https://forum.obsidian.md/t/functional-update-to-brat-version-picker-github-pre-releases-and-frozen-version-updates/98951) — confirms BRAT 2.0 latest-release-by-semver selection

### Tertiary (LOW, not critical)
- DeepWiki "Plugin Submission Guide" entry surfaced via WebSearch — used only as cross-check for unprefixed-tag rule, which was already HIGH via the two primary sources above.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all files verified locally; all external patterns cross-sourced (sample plugin repo + BRAT guide + Obsidian docs).
- Architecture: **HIGH** — flow is deterministic file edits + git + manual web UI; no ambiguity, no alternatives to evaluate.
- Pitfalls: **HIGH** — Pitfalls 1 (append behaviour), 2 (tag prefix), 3 (untrack ordering) each verified by reading the code/config directly; Pitfalls 4–7 are documented in BRAT developer guide.
- Runbook content: **MEDIUM** — assumes phases 48, 51, 53-skip, 54 complete by release time (A3); planner must enforce the "trim to complete only" guardrail.

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable — Obsidian + BRAT release conventions change rarely; sample-plugin template is currently maintained by the Obsidian team).
