# Phase 74: GitHub Release v1.11.0 — Research

**Phase:** 74 — GitHub Release v1.11.0  
**Researched:** 2026-04-30  
**Researcher:** gsd-phase-researcher  

---

## 1. Release Pattern Analysis (Phases 55 / 62 / 68)

All three prior BRAT releases followed an identical runbook structure:

1. **Version alignment** — `manifest.json`, `versions.json`, and `package.json` aligned on the target version
2. **Build verification** — `npm run build` produces clean `main.js` + `styles.css`
3. **Git tag** — unprefixed annotated tag pushed (`1.8.0`, `1.9.0`, `1.10.0`)
4. **GitHub Release** — published with three loose root assets (`manifest.json`, `main.js`, `styles.css`), `prerelease=false`
5. **BRAT smoke test** — clean vault install via `vegacepticon/RadiProtocol` succeeds

### Phase 68 (v1.10.0) specific pattern
- Used **D10 UAT-gate-as-first-section** pattern in the release runbook
- Runbook executed after all code-side phases (63-67) were UAT-accepted
- Phases 72/73 (content-authoring) were explicitly NOT release-blocking

---

## 2. Current Version State

| File | Current Version | Target |
|------|----------------|--------|
| `manifest.json` | `1.10.0` | `1.11.0` |
| `package.json` | `1.10.0` | `1.11.0` |
| `versions.json` | has `1.8.0`, `1.9.0`, `1.10.0` | add `1.11.0` |

`minAppVersion` is `1.5.7` — unchanged since v1.8.0.

### Version bump mechanism
The project uses `version-bump.mjs`:
- Reads `npm_package_version` from environment (set by `npm version`)
- Updates `manifest.json` version field
- Appends entry to `versions.json` mapping `{version: minAppVersion}`
- The `npm version` script in `package.json` runs: `node version-bump.mjs && git add manifest.json versions.json`

**Standard command:**
```bash
npm version 1.11.0 --no-git-tag-version
```
This bumps `package.json`, then the script bumps `manifest.json` and `versions.json`.

---

## 3. Build System

- **Entry:** `src/main.ts`
- **Bundler:** esbuild
- **Production build:** `npm run build` (= `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`)
- **Outputs:** `main.js`, `styles.css` (generated from `src/styles/*.css` list in `esbuild.config.mjs`)
- **CSS files:** `runner-view`, `canvas-selector`, `editor-panel`, `snippet-manager`, `snippet-fill-modal`, `loop-support`, `snippet-tree-picker`, `inline-runner`, `donate-section`

The build copies to dev vault when `OBSIDIAN_DEV_VAULT_PATH` is set in `.env`.

---

## 4. Git State

- Current HEAD is on Phase 73 completion
- No uncommitted changes expected at release time
- Branching strategy in config: `none` (work on default branch)
- Tag pattern: unprefixed annotated tag (e.g., `1.10.0`)

---

## 5. BRAT Install Verification

BRAT requires:
1. Public GitHub repository `vegacepticon/RadiProtocol`
2. Release with `manifest.json`, `main.js`, `styles.css` as individual assets
3. `manifest.json` has valid `id`, `name`, `version`, `minAppVersion`
4. Plugin enables cleanly and Runner view opens

Clean vault test checklist:
- Create new vault
- Install BRAT plugin
- Add `vegacepticon/RadiProtocol`
- Enable plugin
- Verify version shows `1.11.0`
- Open Protocol Runner view → no errors

---

## 6. Dependencies and Blockers

**Release-blocking:**
- [x] Phase 69 (INLINE-CLEAN-01) — complete
- [x] Phase 70 (LOOP-EXIT-01) — complete
- [x] Phase 71 (DONATE-01) — complete

**Non-blocking:**
- [x] Phase 72 (CANVAS-LIB-01..05) — content-authoring, local vault only
- [x] Phase 73 (CANVAS-LIB-06..08) — content-authoring, local vault only

All blocking phases are complete per ROADMAP (2026-04-30).

---

## 7. Risk Areas

| Risk | Mitigation |
|------|-----------|
| `npm run build` fails due to TypeScript errors | Run `tsc -noEmit -skipLibCheck` first; fix any errors before versioning |
| `styles.css` missing donate-section CSS | Verify `donate-section` is in `CSS_FILES` array in `esbuild.config.mjs` |
| Tag already exists locally or remote | Check with `git tag -l 1.11.0` and `git ls-remote --tags origin 1.11.0` before creating |
| Uncommitted changes at release time | `git status` must be clean; stash or commit first |
| BRAT install fails due to manifest mismatch | Verify all three version files agree before tagging |

---

## 8. Validation Architecture

Per Nyquist validation requirements:

- **Dimension 1 (Correctness):** Version strings align across all three files; build produces zero errors
- **Dimension 2 (Coverage):** All v1.11 code-side changes (69, 70, 71) are present in the built artifact
- **Dimension 3 (Edge cases):** Tag doesn't exist; versions.json preserves prior mappings
- **Dimension 4 (Integration):** BRAT install succeeds end-to-end
- **Dimension 5 (Regression):** Prior version mappings remain intact
- **Dimension 6 (Performance):** N/A for release phase
- **Dimension 7 (Security):** N/A — no code changes, only versioning
- **Dimension 8 (UAT/Real-world):** Clean vault BRAT smoke test passes

---

## 9. Recommended Plan Structure

Based on prior release phases, recommend 3 plans:

1. **Version bump + build verification** — Align versions, run build, verify outputs
2. **Git tag + GitHub Release creation** — Annotated tag, push, create release with assets
3. **BRAT smoke test + verification** — Clean vault install, enable, verify version and runner

The D10 UAT-gate-as-first-section pattern (from Phase 68) should be used: the first plan's first task is a UAT gate that verifies all blocking phases are accepted.

---

## RESEARCH COMPLETE

All information gathered. Proceed to planning.
