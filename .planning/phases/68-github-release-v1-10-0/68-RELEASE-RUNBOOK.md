---
phase: 68-github-release-v1-10-0
type: release-runbook
status: ready
performed_on: pending
final_verdict: pending
---

# Phase 68 — v1.10.0 Release Runbook

Step-by-step guide for publishing RadiProtocol v1.10.0 to GitHub so users can install via BRAT with identifier `vegacepticon/RadiProtocol`.

Local release preparation has produced version-aligned metadata, fresh generated assets, a release preflight script, and the local annotated tag `1.10.0`. This runbook is the manual gate for pushing, publishing the GitHub Release, and verifying BRAT.

---

## Pre-publish check — Phase 66 UAT gate

**Do this FIRST, before preflight, push, or Release publication.** Phase 66 is the final v1.10 user-facing reliability gate.

Confirm `.planning/phases/66-runner-step-back-reliability-scroll-pinning/66-UAT.md` contains:

- `status: complete`
- `passed: 9`
- `issues: 0`
- `pending: 0`

From the repo root, verify the UAT file:

```bash
grep -Fxq 'status: complete' .planning/phases/66-runner-step-back-reliability-scroll-pinning/66-UAT.md
grep -Fxq 'passed: 9' .planning/phases/66-runner-step-back-reliability-scroll-pinning/66-UAT.md
grep -Fxq 'issues: 0' .planning/phases/66-runner-step-back-reliability-scroll-pinning/66-UAT.md
grep -Fxq 'pending: 0' .planning/phases/66-runner-step-back-reliability-scroll-pinning/66-UAT.md
```

Also confirm `.planning/ROADMAP.md` no longer describes Phase 66 UAT as pending. If ROADMAP still says Phase 66 is pending, not started, or awaiting UAT, **STOP** and update/commit the planning state before publishing.

Why this gate exists: v1.10.0 must not ship as Latest unless step-back reliability and scroll pinning were accepted in real Obsidian UAT.

---

## Preflight (automated)

Run the release preflight immediately before any push or publish step:

```bash
bash .planning/phases/68-github-release-v1-10-0/scripts/release-preflight.sh
```

Expected final line:

```text
SC-1 local verification: PASS
```

The script asserts version alignment, preserved `versions.json` history, manifest metadata, unprefixed tag shape, generated artifact hygiene, and a fresh `npm run build` with non-empty `main.js` and `styles.css`.

If the script exits non-zero, STOP. Do not push. Do not publish.

---

## Push commit and tag

After the Phase 66 UAT gate and preflight both pass, push the branch and unprefixed tag:

```bash
git push origin main
git push origin 1.10.0
```

Verify the tag appears at <https://github.com/vegacepticon/RadiProtocol/tags> as exactly `1.10.0` with no `v` prefix.

---

## Create the GitHub Release (web UI)

BRAT reads GitHub Release objects, not bare tags.

1. Open <https://github.com/vegacepticon/RadiProtocol/releases/new>.
2. **Choose a tag:** `1.10.0`.
3. **Release title:** exactly `1.10.0` — no `v` prefix, suffix, or extra whitespace.
4. **Description:** paste the [Release Notes](#release-notes) section below.
5. **Attach loose root assets:** upload these three individual files, not a zip:
   - `manifest.json`
   - `main.js`
   - `styles.css`
6. **Pre-release:** leave unchecked after the Phase 66 gate passes.
7. **Latest release:** keep checked.
8. Click **Publish release**.

Immediately verify the Release page URL is `https://github.com/vegacepticon/RadiProtocol/releases/tag/1.10.0`, the title is `1.10.0`, and the asset list contains exactly `manifest.json`, `main.js`, and `styles.css` as separate downloads.

Optional API smoke check:

```bash
curl -s https://api.github.com/repos/vegacepticon/RadiProtocol/releases/latest \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")); const names=(d.assets||[]).map(a=>a.name).sort().join(","); console.log("tag:", d.tag_name, "name:", d.name, "assets:", names); process.exit(d.tag_name==="1.10.0" && d.name==="1.10.0" && names==="main.js,manifest.json,styles.css" ? 0 : 1)'
```

---

## Release Notes

### Editor and Canvas authoring

- **Phase 63 — EDITOR-03 / EDITOR-05:** Bidirectional Canvas ↔ Node Editor sync keeps canvas text edits, Node Editor fields, and Snippet branch labels aligned live.
- **Phase 64 — EDITOR-04 / EDITOR-06:** Node Editor multi-line fields auto-grow while typing or pasting, and the toolbar now includes text-block quick-create.

### Runner UX and reliability

- **Phase 65 — RUNNER-02:** Back and Skip now render together in a consistent footer row across sidebar, tab, and inline modes.
- **Phase 66 — RUNNER-03 / RUNNER-04:** Back is one-click reliable across runner states, avoids the stale Processing placeholder, preserves loop text correctly, and keeps the preview scrolled to the bottom after file-bound snippet insert and step-back.

### Inline Runner

- **Phase 67 — INLINE-FIX-06 / INLINE-FIX-07:** Inline Runner is resizable with persisted/clamped dimensions, and file-bound Snippet nodes now insert the bound file directly in inline mode with sidebar parity.

### Distribution

- **v1.10.0:** BRAT install remains `vegacepticon/RadiProtocol`. The Release ships `manifest.json`, `main.js`, and `styles.css` as loose assets at the Release root.

### Install via BRAT

1. Install and enable the BRAT community plugin in Obsidian.
2. Open Command Palette → `BRAT: Add a beta plugin for testing`.
3. Paste `vegacepticon/RadiProtocol`.
4. Add the plugin, then enable RadiProtocol in Community Plugins.
5. Confirm RadiProtocol reports version `1.10.0`.

---

## Post-release verification

### Fresh-vault BRAT smoke test

1. Create a clean Obsidian vault.
2. Install and enable BRAT.
3. Add `vegacepticon/RadiProtocol` through BRAT.
4. Enable RadiProtocol.
5. Confirm the plugin version is `1.10.0`.
6. Open `RadiProtocol: Open Runner view`; selector appears without console errors.
7. Open Node Editor on a canvas and smoke-check canvas ↔ form sync.
8. Run a protocol and confirm Back/Skip footer layout and one-click Back behaviour.
9. Run `Run protocol in inline`, resize the modal, switch tabs, and confirm size persists.
10. Run a file-bound Snippet node in inline mode and confirm the file content inserts directly.

### Final verdict

- If all gates pass, set `performed_on` to the release date and `final_verdict: success` in this file's frontmatter, add release URL and smoke-test notes, then commit.
- If any gate fails, set `final_verdict: failed`, capture the exact failing step and error, and do not mark the release complete.

---

## Anti-patterns (do NOT do any of these)

- Do not publish before the Phase 66 UAT gate and ROADMAP status are both accepted.
- Do not create or publish `v1.10.0`; use exact tag/title `1.10.0`.
- Do not zip the assets; upload loose `manifest.json`, `main.js`, and `styles.css`.
- Do not check the prerelease box after all gates pass.
- Do not edit the Release title to add descriptive text.
- Do not remove `1.8.0` or `1.9.0` from `versions.json`.
- Do not track or commit generated `main.js` or `styles.css`.
