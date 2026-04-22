# Phase 55 — BRAT Distribution Readiness — CONTEXT

**Goal (from ROADMAP)**: The repository is shippable via BRAT — `manifest.json`, `versions.json`, and git tags align on one version, and a GitHub Release exists with the three required assets so users can install through BRAT with identifier `vegacepticon/RadiProtocol`.

**Requirement**: BRAT-01

## Prior state loaded

- `manifest.json` — `version: "0.1.0"`, `minAppVersion: "1.5.7"`, `author`/`authorUrl`/`fundingUrl` all empty, `isDesktopOnly: true`
- `versions.json` — only `{"0.1.0": "1.5.7"}` (stale, never released)
- Git tags — `v1.0`…`v1.7` (with `v` prefix; no corresponding GitHub Releases)
- `gh release list` — none (no Releases exist)
- `.gitignore` — `main.js` + `main.js.map` ignored; `styles.css` is **tracked** (inconsistent)
- `gh` CLI — **not available** in the working shell (WSL bash)
- `package.json` has a `version` script that runs `node version-bump.mjs && git add manifest.json versions.json`
- `version-bump.mjs` reads `$npm_package_version`, writes manifest.version + versions.json[v]=minAppVersion
- Milestone is v1.8; phases 47–54 and 56 deliver the shippable build

## Locked from `/gsd-explore`-equivalent (ROADMAP + original todo)

1. **BRAT identifier** = `vegacepticon/RadiProtocol` (fixed; this is what users type into BRAT)
2. **Assets attached loose** = `manifest.json`, `main.js`, `styles.css` at the root of the Release (not zipped)
3. **Obsidian tag convention** = tag equals manifest `version` **without `v` prefix**
4. **CI automation OUT OF SCOPE** (explicit in REQUIREMENTS.md) — this phase delivers manual process + first Release only

## Decisions from discuss-phase

### D1 — Version string
**`1.8.0` (SemVer).** Tag `1.8.0`, `manifest.version = "1.8.0"`, `versions.json` key `"1.8.0"`.
- **Why**: Standard Obsidian/BRAT format; allows `1.8.1` patches without scheme change.
- **How to apply**: Planner uses `npm version 1.8.0` (runs existing `version-bump.mjs`) OR edits all three files manually and tags with `git tag 1.8.0` (no `v`).

### D2 — Legacy tags v1.0…v1.7
**Leave as-is.** Old `v`-prefixed tags are untouched; new `1.8.0` starts the Obsidian-compatible scheme.
- **Why**: BRAT reads Releases, not bare tags — legacy tags without Releases are invisible to BRAT. Destructive rewrites are not worth the risk.
- **How to apply**: No retagging. No force-push. First aligned tag is `1.8.0`.

### D3 — `minAppVersion`
**Keep `1.5.7`.** No evidence of newer-API usage.
- **Why**: Do not restrict users without cause. Can be raised in a future release if a new API is adopted.
- **How to apply**: `manifest.json.minAppVersion` unchanged.

### D4 — `versions.json` legacy entry
**Delete `"0.1.0"`.** Final file = `{"1.8.0": "1.5.7"}`.
- **Why**: `0.1.0` was never released via BRAT — it is noise, not history.
- **How to apply**: Planner rewrites `versions.json` cleanly; does not rely on `version-bump.mjs` merge behavior for this cleanup commit.

### D5 — Build artifacts in git
**Both ignored.** Add `styles.css` to `.gitignore`; `git rm --cached styles.css`. `main.js` stays ignored.
- **Why**: Standard Obsidian-plugin convention; prevents source↔dist drift in the repo; the authoritative copies of `main.js` + `styles.css` live on the Release as assets.
- **How to apply**: Planner updates `.gitignore` (add `styles.css`, optionally also `main.js.map` already present) and removes `styles.css` from the index in the same commit. CLAUDE.md's "styles.css generated — do not edit directly" rule stays valid; the file just stops being tracked.

### D6 — Release creation tool
**User-driven via GitHub web UI.** Planner prepares everything locally; user performs the Release action.
- **Why**: `gh` CLI not installed and installing it is incidental work. Web UI supports drag-and-drop of the three files directly from the repo root.
- **How to apply**: Planner's final task produces a **runbook** (step-by-step copy-pasteable instructions + release-notes text block) that the user executes once. No automation, no token handling, no `gh` install step in the plan.

### D7 — Release notes content
**Curated v1.8 changelog.** Planner compiles a short, reader-oriented list of changes grouped by area, drawn from phases 47–54 + 56:
- Runner: regression fixes (47), skip & close buttons (53), inline display mode (54)
- Node Editor: UX polish (48, 48.1)
- Loop: exit-edge convention (49, 50, 50.1)
- Snippet: picker overhaul (51), JSON placeholder rework (52), button UX reversal (56)
- Distribution: BRAT-ready (this phase)

- **Why**: Auto-generated GitHub notes would dump dozens of `docs(XX-YY)` planning commits — unreadable. A curated list is the first user-facing artifact; worth the ~15 minutes.
- **How to apply**: Planner writes the release-notes markdown block inside the runbook from D6. User pastes it into the Release description.

### D8 — Pre-release flag
**Latest (normal Release), not pre-release.** v1.8 passed UAT across phases 47–54.
- **Why**: BRAT installs either; "latest" is the honest signal.
- **How to apply**: Runbook instructs user to leave the "Set as a pre-release" checkbox unchecked.

### D9 — `manifest.json` metadata
- `author` = `"vegacepticon"`
- `authorUrl` = `"https://github.com/vegacepticon"`
- `fundingUrl` = **leave empty** (no donation channel yet)

Public GitHub handle only; no real-name disclosure. Planner edits `manifest.json` in the same commit as the version bump.

## Implementation hints (for researcher/planner)

- **Single source-of-truth for version** = `package.json`. The `npm version 1.8.0` flow triggers `version-bump.mjs` which syncs `manifest.json` + `versions.json`. BUT: `version-bump.mjs` *appends* to `versions.json` — it will leave the stale `0.1.0` entry. Plan a manual cleanup step (D4) after the bump, OR skip the script entirely and edit three files by hand in one commit.
- **Tagging**: Obsidian convention is unprefixed (`1.8.0`). `npm version` by default creates `v1.8.0`. Use `npm version 1.8.0 --no-git-tag-version` then `git tag 1.8.0` manually, or set `npm config set tag-version-prefix ""` for this repo.
- **Asset build order**: `npm run build` → verifies clean `main.js` + `styles.css` against the already-bumped `manifest.json` version. If build runs *before* manifest bump, `main.js` will embed the wrong version string if/when we ever inline it (currently we don't, but the order is still the safer default).
- **`isDesktopOnly: true`** — keep; no mobile consideration in scope.
- **Runbook location**: put it in the phase folder (e.g., `55-RELEASE-RUNBOOK.md`) so it survives as an artifact the user references for future releases.
- **No workflow file changes**: `.github/workflows/` does not exist in the repo and this phase does not create it (CI automation is out of scope per REQUIREMENTS.md).

## Success criteria (carried from ROADMAP, unchanged)

1. `manifest.json.version`, `versions.json` mapping, and git tag all agree on `1.8.0`; `npm run build` produces clean `main.js` + `styles.css` against that version.
2. `gh release list` (or web UI) shows at least one GitHub Release whose assets include `manifest.json`, `main.js`, and `styles.css` as individually downloadable files at the root of the release.
3. Installing via BRAT with identifier `vegacepticon/RadiProtocol` in a fresh Obsidian vault succeeds end-to-end — plugin appears, enables, Runner view opens.

## Deferred ideas (NOT this phase)

- GitHub Actions workflow to auto-build + auto-release on tag push (explicitly out of scope per REQUIREMENTS.md; next-milestone candidate).
- Submitting RadiProtocol to the official Obsidian community-plugins registry (different review process; beyond BRAT scope).
- Populating `fundingUrl` (no donation channel yet).
- Raising `minAppVersion` (no current API-usage reason).
- Installing `gh` CLI in the dev environment.
- Retroactive Releases for v1.0…v1.7 tags.
- Cross-checking that `main.js` embeds the manifest version string (currently it does not).
