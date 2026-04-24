---
phase: 62-brat-release-v1.9.0
type: release-runbook
status: ready
performed_on: <YYYY-MM-DD — user fills at publish time>
final_verdict: pending
source:
  - 62-CONTEXT.md
  - 55-RELEASE-RUNBOOK.md (template)
  - ROADMAP.md (D10 gate reference)
created: 2026-04-24
---

# Phase 62 — v1.9.0 Release Runbook

> Step-by-step guide for publishing RadiProtocol v1.9.0 to GitHub so users can install via BRAT with identifier `vegacepticon/RadiProtocol`.
>
> Everything local (manifest bump, versions.json append, build, commit, tag, preflight) has already been performed by Plans 01–02. Your job as the repository owner: confirm the Phase 60 UAT gate, run the preflight, push the tag, create the Release in the web UI, then verify.
>
> This runbook mirrors Phase 55's v1.8.0 runbook with one structural addition: the opening **Pre-publish check — Phase 60 UAT gate** section, which blocks publishing until Phase 60 is marked Complete in `ROADMAP.md`.

---

## Pre-publish check — Phase 60 UAT gate

**Do this FIRST, before any other step.** The release asset must reflect the full v1.9 shippable build; Phase 60's UAT status gates this release.

From the repo root, run:

```bash
grep -E '^\- \[.\] \*\*Phase 60:' .planning/ROADMAP.md
```

Interpret the output:

- If the line reads `- [x] **Phase 60: ...` **AND** ends with `— completed <DATE>` (or similar Complete marker) → Phase 60 UAT has signed off. Proceed to **Preflight (automated)** below.
- If the line reads `- [ ] **Phase 60: ...` **OR** the status note says `Awaiting human UAT` (or anything other than Complete) → **STOP**. Do not push the tag. Do not publish the Release. Local Plans 01–02 have already run (bump + build + preflight + tag all exist locally), which is safe. Complete Phase 60's UAT sign-off first, update ROADMAP.md, then return here.

Double-check the Progress table near the end of `.planning/ROADMAP.md`:

```bash
grep -E 'Phase 60' .planning/ROADMAP.md | grep -E 'Complete|Awaiting'
```

If the Progress-table row for Phase 60 reads `Awaiting human UAT`, the gate is NOT passed — STOP.

**Why this gate exists (D10 from 62-CONTEXT.md):** shipping v1.9.0 without Phase 60 UAT would either bundle un-validated Inline Runner layout/position code into a "Latest" Release (user-facing risk) or publish release notes that describe features not actually tested. Both are unacceptable. The gate is the single decision point; everything downstream assumes it has passed.

---

## Preflight (automated)

Once the D10 gate passes, run:

```bash
bash .planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh
```

Expected final line of stdout:

```
SC-1 local verification: PASS
```

The script asserts:
- `manifest.json.version === "1.9.0"`
- `versions.json` keys are exactly `1.8.0,1.9.0` (both mapping to `1.5.7` — D4 preserves the `1.8.0` entry)
- `package.json.version === "1.9.0"`
- `author` / `authorUrl` / `fundingUrl` unchanged from Phase 55 (D9)
- `minAppVersion` remains `1.5.7` (D3)
- Tag `1.9.0` exists AND no `v1.9.0` collision
- `styles.css` and `main.js` are NOT in the git index and ARE matched by `.gitignore`
- Fresh `npm run build` produces non-empty `main.js` + `styles.css`

If the script exits non-zero, STOP — do not push, do not publish. Read the failing section header in stdout and fix (re-run Plan 01 or Plan 02 as needed) before continuing.

---

## Push the tag

The release-prep commit and annotated tag `1.9.0` already exist locally (Plan 02). Push them:

```bash
git push origin main
git push origin 1.9.0
```

(Only the tag push is strictly required for the Release step below — the branch push is recommended to keep `origin/main` in sync with the commit the tag points at.)

Verify the tag is visible on GitHub:
- Visit <https://github.com/vegacepticon/RadiProtocol/tags>
- Confirm `1.9.0` (no `v` prefix) appears at the top.
- The existing `1.8.0` tag (Phase 55) should still be present below it.
- If you see `v1.9.0` instead of `1.9.0`, STOP — a prefixed tag was created by mistake. Delete it locally and on origin, then return to Plan 02 Task 62-02-04.

---

## Create the GitHub Release (web UI)

BRAT does not read bare tags — it reads GitHub **Release** objects. A tag without a Release is invisible to BRAT (Phase 55 Research Pitfall 4).

1. Open <https://github.com/vegacepticon/RadiProtocol/releases/new>
2. **Choose a tag**: select `1.9.0` from the dropdown (already pushed in the previous section).
3. **Release title**: type exactly `1.9.0` — no `v` prefix, no suffix, no extra whitespace. (Phase 55 Pitfall 5 — tag name, release title, and `manifest.version` must all byte-match.)
4. **Description**: paste the entire contents of the [Release Notes](#release-notes) section below into the description field. Before pasting, read the A3 guardrail at the top of that section and trim any bullets for phases that are NOT yet marked Complete in `.planning/ROADMAP.md` (most relevant: Phase 60 — if the D10 gate above required you to wait until it flipped to Complete, its bullets are safe to keep; if a previous gate exception was ever invoked, trim accordingly).
5. **Attach binaries**: drag-and-drop these three files from your repo root, ONE AT A TIME (or all at once, but as individual loose files — DO NOT zip them per Phase 55 Pitfall 6):
   - `manifest.json`
   - `main.js`
   - `styles.css`
   Confirm the "Assets" list shows three separate downloadable entries. If it shows a single `.zip`, remove the zip and re-upload the three loose files.
6. **Pre-release flag**: leave `Set as a pre-release` UNCHECKED (per D8 — the D10 gate above ensures all three v1.9 phases passed UAT by publish time, so a normal Release is the honest signal). If for any reason you have intentionally bypassed the D10 gate (STRONGLY discouraged), CHECK this box instead.
7. **Latest release**: `Set as the latest release` must be CHECKED (default — BRAT selects by latest SemVer).
8. Click **Publish release**.

Immediately after publishing, verify in the browser:
- URL redirects to `https://github.com/vegacepticon/RadiProtocol/releases/tag/1.9.0`
- "Latest" green badge visible next to the release title
- Assets section shows three separate entries: `manifest.json`, `main.js`, `styles.css`
- Click each asset link — each downloads the individual file (not a zip, not a 404)

Optional API smoke-check (works without `gh` CLI):

```bash
curl -s https://api.github.com/repos/vegacepticon/RadiProtocol/releases/latest \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); const names=(d.assets||[]).map(a=>a.name).sort().join(","); console.log("tag:", d.tag_name, "name:", d.name, "assets:", names); process.exit(d.tag_name==="1.9.0" && names==="main.js,manifest.json,styles.css" ? 0 : 1)'
```

Expected stdout:
```
tag: 1.9.0 name: 1.9.0 assets: main.js,manifest.json,styles.css
```

---

## Release Notes

> **A3 guardrail (read before pasting):** Some phases below may not be marked Complete in `.planning/ROADMAP.md` at the moment you publish. Before pasting this block into the Release description, open the ROADMAP Progress table and TRIM any bullet whose phase is not yet marked Complete. Do not ship a changelog that mentions features that were not actually included in the build. This is especially important for Phase 60 — if the D10 gate above instructed you to wait for its UAT, its bullets are valid; if you are publishing with any exception, trim accordingly.

### Runner (Inline mode)

**Phase 59 — Feature parity fixes**
- Nested `templates/ALGO`-style path resolution in inline mode (parity with the snippet resolver). INLINE-FIX-01.
- Snippet separator honoured when inserting from inline (space/newline between text and snippet — matches sidebar-runner). INLINE-FIX-04.
- JSON snippet fill-in modal now opens from inline mode (no z-index conflict with the floating runner). INLINE-FIX-05.

**Phase 60 — Layout & position persistence**
- Inline modal position persists across tab switches and plugin reload (saved in workspace state, clamped to viewport bounds so the modal never lands off-screen). INLINE-FIX-02.
- Compact default layout — the inline modal no longer overlaps note text at default Obsidian window size. INLINE-FIX-03.

### Settings UX

**Phase 61 — Folder autocomplete**
- Folder autocomplete (`FolderSuggest` built on Obsidian's `AbstractInputSuggest`) now shows a dropdown of existing vault folders on all three settings path fields: Protocols, Snippets, Output. SETTINGS-01.

### Distribution

- BRAT install remains at `vegacepticon/RadiProtocol`. v1.9.0 ships `manifest.json`, `main.js`, and `styles.css` as loose assets on this Release. BRAT-02.

### Install via BRAT

1. Install the **BRAT** plugin from Obsidian's Community Plugins list (if not already installed).
2. Open Command Palette → `BRAT: Add a beta plugin for testing`.
3. Paste `vegacepticon/RadiProtocol` into the dialog.
4. Click `Add Plugin`.
5. Once BRAT reports the plugin installed, enable it in Settings → Community Plugins.
6. Open Command Palette → `RadiProtocol: Open Runner view`.

---

## Post-release verification

### SC-3 — Fresh-vault BRAT install smoke test (manual, 5 minutes)

1. Create a new empty vault in Obsidian (`File → New vault`).
2. Enable Community Plugins in Settings (disable Restricted Mode if prompted).
3. Install **BRAT** from the Community Plugins browser and enable it.
4. Open Command Palette → `BRAT: Add a beta plugin for testing`.
5. Paste `vegacepticon/RadiProtocol` and click `Add Plugin`.
6. Wait for BRAT's "plugin installed" notice (downloads the three loose assets from the 1.9.0 Release).
7. Go to Settings → Community Plugins → find **RadiProtocol** in the installed list → toggle ON.
8. Open Command Palette → `RadiProtocol: Open Runner view`.
9. Confirm:
   - Plugin appears in the Community Plugins list with author `vegacepticon` and version `1.9.0`.
   - Plugin enables without errors in the Developer Console.
   - Runner view opens in the workspace (selector placeholder visible: `Select a protocol…`).
   - Open Settings → RadiProtocol: confirm all three path fields (Protocols, Snippets, Output) show folder-autocomplete dropdowns on focus (Phase 61 smoke verification).
   - Run the `Run protocol in inline` command on a note with any canvas configured: confirm the inline modal opens in the compact default layout and remembers its position after a tab switch (Phase 60 smoke verification).
10. If any step fails, open DevTools (`Ctrl+Shift+I`) → Console tab → copy the red error messages → return to this runbook's §Create the GitHub Release and verify the three assets uploaded correctly.

### Final verdict

- ✅ If all three checks pass (D10 gate, preflight, web-UI Release with 3 loose assets, fresh-vault BRAT install): mark `final_verdict: success` in this file's frontmatter and commit.
- ❌ If any check fails: mark `final_verdict: failed`, capture the specific failure, and return to the relevant plan (01/02) or this runbook's §Create the GitHub Release.

---

## Anti-patterns (do NOT do any of these)

- `git tag v1.9.0` — breaks BRAT's byte-match rule (Phase 55 Pitfall 5). Use `1.9.0` without prefix.
- Zipping the three assets into a single `.zip` — BRAT cannot extract it (Phase 55 Pitfall 6).
- Checking "Set as a pre-release" when all three prerequisite phases (59, 60, 61) are Complete — the D10 gate exists specifically so Latest is the honest signal. Pre-release is only valid if you have intentionally bypassed the D10 gate, which should never be routine.
- Editing the Release title to add a descriptive suffix (e.g., `1.9.0 — Inline Polish`) — the tag, release name, and `manifest.version` must all read exactly `1.9.0`. Descriptive text goes in the description body, not the title.
- Running `gh release create …` — `gh` CLI is not installed in this environment and D6 locks the web UI path. Do not install `gh` just for this step.
- Removing the `1.8.0` entry from `versions.json` — D4 PRESERVE. The preflight script will fail loudly if this regresses, but do not try to "tidy" the file manually.
- Re-tracking `styles.css` or `main.js` — D5 state was locked by Phase 55 and this phase does not touch `.gitignore`. The preflight asserts both paths remain ignored.
