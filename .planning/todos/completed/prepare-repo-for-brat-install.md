---
title: "Prepare repo for BRAT installation (Obsidian beta plugin distribution)"
date: 2026-04-18
priority: medium
---

Goal: users can install RadiProtocol in Obsidian via BRAT by entering `vegacepticon/RadiProtocol`.

BRAT requires a GitHub Release (not just a tag) with three files attached as release assets: `manifest.json`, `main.js`, `styles.css`.

## Steps

1. **Align version numbers.**
   - `manifest.json` currently has `"version": "0.1.0"` while git tags go `v1.0` … `v1.7` — pick one scheme and make them match.
   - Obsidian convention: release tag on GitHub equals the `version` string in `manifest.json` **without** a `v` prefix (e.g. tag `1.7.0`, manifest `"version": "1.7.0"`).
2. **Update `versions.json`** to map the chosen version → minimum Obsidian app version, e.g.:
   ```json
   { "1.7.0": "1.5.7" }
   ```
   Current file only contains `"0.1.0"` and will not be valid after the version bump.
3. **Build fresh artifacts** — `npm run build` — to produce up-to-date `main.js` and `styles.css` in the repo root.
4. **Create a GitHub Release** (not just a git tag) for the aligned version and attach the three files as release assets:
   - `manifest.json`
   - `main.js`
   - `styles.css`

   Can be done via `gh release create <tag> manifest.json main.js styles.css --title "<tag>" --notes "..."` or via the GitHub web UI.
5. **Verify in BRAT**: install in a fresh Obsidian vault via BRAT → Add Beta plugin → `vegacepticon/RadiProtocol` → confirm plugin loads.

## Notes

- Current state: no GitHub Releases exist; only bare tags `v1.0`–`v1.7`. BRAT cannot install from bare tags — it needs the Release object with assets attached.
- Once this process is in place, consider automating it in CI (build + create release on tag push) so future versions don't require manual asset uploads.
