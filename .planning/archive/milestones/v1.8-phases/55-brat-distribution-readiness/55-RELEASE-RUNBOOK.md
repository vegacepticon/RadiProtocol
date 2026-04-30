---
phase: 55-brat-distribution-readiness
type: release-runbook
status: ready
performed_on: <YYYY-MM-DD — user fills at publish time>
final_verdict: pending
source:
  - 55-CONTEXT.md
  - 55-RESEARCH.md
  - 55-PATTERNS.md
  - 55-VALIDATION.md
created: 2026-04-21
---

# Phase 55 — v1.8.0 Release Runbook

> Step-by-step guide for publishing RadiProtocol v1.8.0 to GitHub so users can install via BRAT with identifier `vegacepticon/RadiProtocol`.
>
> Everything local (manifest bump, versions.json cleanup, .gitignore, build, commit, tag, preflight) has already been performed by Plans 01–03. Your job as the repository owner: run the preflight, push the tag, create the Release in the web UI, then verify.

---

## Pre-flight (automated)

From the repo root, run:

```bash
bash .planning/phases/55-brat-distribution-readiness/scripts/release-preflight.sh
```

Expected final line of stdout:
```
SC-1 local verification: PASS
```

If the script exits non-zero, STOP — do not push, do not publish. Read the failing section header in stdout and fix (re-run Plans 01–03 as needed) before continuing.

---

## Push the tag

The release-prep commit and annotated tag `1.8.0` already exist locally (Plan 03). Push them:

```bash
git push origin main
git push origin 1.8.0
```

(Only the tag push is strictly required for the Release step below — the branch push is recommended to keep `origin/main` in sync with the commit the tag points at.)

Verify the tag is visible on GitHub:
- Visit <https://github.com/vegacepticon/RadiProtocol/tags>
- Confirm `1.8.0` (no `v` prefix) appears at the top.
- If you see `v1.8.0` instead, STOP — a prefixed tag was created by mistake. Delete it locally and on origin, then return to Plan 03 Task 55-03-03.

---

## Create the GitHub Release (web UI)

BRAT does not read bare tags — it reads GitHub **Release** objects. A tag without a Release is invisible to BRAT (Research Pitfall 4).

1. Open <https://github.com/vegacepticon/RadiProtocol/releases/new>
2. **Choose a tag**: select `1.8.0` from the dropdown (already pushed in the previous section).
3. **Release title**: type exactly `1.8.0` — no `v` prefix, no suffix, no extra whitespace. (Pitfall 5 — tag name, release title, and `manifest.version` must all byte-match.)
4. **Description**: paste the entire contents of the [Release Notes](#release-notes) section below into the description field. Before pasting, read the A3 guardrail at the top of that section and trim any bullets for phases that are NOT yet marked Complete in `.planning/ROADMAP.md`.
5. **Attach binaries**: drag-and-drop these three files from your repo root, ONE AT A TIME (or all at once, but as individual loose files — DO NOT zip them per Pitfall 6):
   - `manifest.json`
   - `main.js`
   - `styles.css`
   Confirm the "Assets" list shows three separate downloadable entries. If it shows a single `.zip`, remove the zip and re-upload the three loose files.
6. **Pre-release flag**: leave `Set as a pre-release` UNCHECKED (per D8 — v1.8 passed UAT, so a normal Release is the honest signal).
7. **Latest release**: `Set as the latest release` must be CHECKED (default — BRAT selects by latest SemVer).
8. Click **Publish release**.

Immediately after publishing, verify in the browser:
- URL redirects to `https://github.com/vegacepticon/RadiProtocol/releases/tag/1.8.0`
- "Latest" green badge visible next to the release title
- Assets section shows three separate entries: `manifest.json`, `main.js`, `styles.css`
- Click each asset link — each downloads the individual file (not a zip, not a 404)

Optional API smoke-check (works without `gh` CLI):

```bash
curl -s https://api.github.com/repos/vegacepticon/RadiProtocol/releases/latest \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); const names=(d.assets||[]).map(a=>a.name).sort().join(","); console.log("tag:", d.tag_name, "name:", d.name, "assets:", names); process.exit(d.tag_name==="1.8.0" && names==="main.js,manifest.json,styles.css" ? 0 : 1)'
```

Expected stdout:
```
tag: 1.8.0  name: 1.8.0  assets: main.js,manifest.json,styles.css
```

---

## Release Notes

> **A3 guardrail (read before pasting):** Some phases below may not be marked Complete in `.planning/ROADMAP.md` at the moment you publish. Before pasting this block into the Release description, open the ROADMAP Progress table and TRIM any bullet whose phase is not yet marked Complete. Do not ship a changelog that mentions features that were not actually included in the build.

### Runner
- **Regression fixes (Phase 47)**: manual textarea edits preserved across loop transitions; textarea auto-scrolls to the insertion point after choice click; choice buttons render Cyrillic descenders and parentheses fully.
- **Skip & Close buttons (Phase 53)**: Runner now has a Close button (with confirmation) and a Skip button that advances without appending any text.
- **Inline protocol display mode (Phase 54)**: new `Run protocol in inline` command — opens a floating modal that appends answers directly into the active note instead of the Runner pane.

### Node Editor
- **UX polish (Phases 48 + 48.1)**: obsolete "Snippet ID" field removed from Text blocks; new nodes are placed below the anchor (vertical tree); Answer form shows Display label above Answer text; Question textarea auto-grows; quick-create buttons relocated to a bottom vertical stack; tighter spacing between form content and the toolbar.

### Loop
- **Exit-edge convention (Phases 49 + 50 + 50.1)**: loop exit labels are now editable via the edge (no longer hardcoded «выход»); editing an Answer's Display label keeps every incoming edge label in sync, and vice-versa; loop exit edges are now distinguished by a leading `+` prefix; body edges can carry free-form labels; five clear Russian validator errors guide authors through malformed loops.

### Snippet
- **Picker overhaul (Phase 51)**: unified hierarchical snippet picker with drill-down, breadcrumb, and tree-wide search; Snippet nodes can bind to a specific file.
- **JSON placeholder rework (Phase 52)**: JSON placeholders simplified to two types — free-text and unified choice (with multi-select); options editor fixed; legacy types surface clear validation errors.
- **Button UX reversal (Phase 56)**: file-bound Snippet nodes render as buttons and insert content directly on click; folder-selection in the Snippet editor now shows a "committed" state indicator after clicking «Выбрать эту папку».

### Distribution
- **BRAT-ready (Phase 55 — this release)**: the repository is now installable via BRAT (Beta Reviewers Auto-update Tester) with identifier `vegacepticon/RadiProtocol`. `manifest.json`, `main.js`, and `styles.css` are attached as loose assets on every Release.

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
6. Wait for BRAT's "plugin installed" notice (downloads the three loose assets from the Release).
7. Go to Settings → Community Plugins → find **RadiProtocol** in the installed list → toggle ON.
8. Open Command Palette → `RadiProtocol: Open Runner view`.
9. Confirm:
   - Plugin appears in the Community Plugins list with author `vegacepticon`.
   - Plugin enables without errors in the Developer Console.
   - Runner view opens in the workspace (selector placeholder visible: `Select a protocol…`).
10. If any step fails, open DevTools (`Ctrl+Shift+I`) → Console tab → copy the red error messages → return to this runbook's §Create the GitHub Release and verify the three assets uploaded correctly.

### Final verdict

- ✅ If all three checks pass (preflight, web-UI Release with 3 loose assets, fresh-vault BRAT install): mark `final_verdict: success` in this file's frontmatter and commit.
- ❌ If any check fails: mark `final_verdict: failed`, capture the specific failure, and return to the relevant plan (01/02/03) or this runbook's §Create the GitHub Release.

---

## Anti-patterns (do NOT do any of these)

- `git tag v1.8.0` — breaks BRAT's byte-match rule (Pitfall 5). Use `1.8.0` without prefix.
- Zipping the three assets into a single `.zip` — BRAT cannot extract it (Pitfall 6).
- Checking "Set as a pre-release" — v1.8 passed UAT; `latest` is the honest signal (D8).
- Editing the Release title to add a descriptive suffix (e.g., `1.8.0 — UX Polish`) — the tag, release name, and `manifest.version` must all read exactly `1.8.0`. Descriptive text goes in the description body, not the title.
- Running `gh release create …` — `gh` CLI is not installed in this environment and D6 locks the web UI path. Do not install `gh` just for this step.
