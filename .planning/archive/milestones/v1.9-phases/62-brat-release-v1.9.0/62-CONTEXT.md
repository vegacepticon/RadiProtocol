# Phase 62 — BRAT Release v1.9.0 — CONTEXT

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Mirror of Phase 55 (v1.8.0 BRAT release) with v1.9.0 deltas

**Goal (from ROADMAP):** The repository is shippable via BRAT at version 1.9.0 — `manifest.json`, `versions.json`, `package.json` all align on `1.9.0`, a GitHub Release v1.9.0 exists with the three required assets attached at the release root, and end-to-end BRAT install on a clean test vault succeeds.

**Requirement:** BRAT-02

**Depends on:** Phases 59, 60, 61 (release asset must reflect the full v1.9 shippable build — all Inline Runner fixes + Settings autocomplete must have landed before tagging; mirrors Phase 55 v1.8.0 cadence).

---

## Prior state loaded (verified 2026-04-24)

- `manifest.json.version` = `"1.8.0"`; `minAppVersion` = `"1.5.7"`; `author` = `"vegacepticon"`; `authorUrl` = `"https://github.com/vegacepticon"`; `fundingUrl` = `""`; `isDesktopOnly: true`; `id` = `"radiprotocol"`; `name` = `"RadiProtocol"` (metadata already set by Phase 55 — no re-edit needed)
- `versions.json` = `{"1.8.0": "1.5.7"}` (one entry — the v1.8.0 release; Phase 62 must ADD `"1.9.0": "1.5.7"` and PRESERVE `"1.8.0"`)
- `package.json.version` = `"1.8.0"`; the `version` script still reads `node version-bump.mjs && git add manifest.json versions.json`
- `version-bump.mjs` — unchanged from Phase 55 era; it APPENDS to `versions.json` (does not clean up). Same care required.
- Git tags — include `v1.0…v1.8` (v-prefixed), plus a clean unprefixed `1.8.0` tag from Phase 55. No `1.9.0` tag exists yet.
- `gh` CLI — still **not installed** in the working shell. Web UI path is still mandatory (same as Phase 55 D6).
- `.gitignore` — already ignores `main.js`, `main.js.map`, `styles.css` (Phase 55 D5). `git ls-files styles.css` returns empty, `git ls-files main.js` returns empty. No re-work needed.
- `.github/workflows/` — still does not exist (no CI automation).
- Phase 55 release-preflight script lives at `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/scripts/release-preflight.sh` and is the direct template for Phase 62's preflight.
- Phase 55 runbook lives at `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` and is the direct template for Phase 62's runbook.

## Milestone-level decisions carried from STATE.md (v1.9)

- **Single 1.9.0 release at end of milestone** (no 1.9.1 patch releases along the way).
- **Community plugin submission deferred** — BRAT-only distribution.
- **v1.9 scope** = Phase 59 (Inline Runner Feature Parity, INLINE-FIX-01/04/05), Phase 60 (Layout & Position Persistence, INLINE-FIX-02/03), Phase 61 (Settings Folder Autocomplete, SETTINGS-01).
- Phase 59 = Complete (2026-04-24). Phase 61 = Complete (2026-04-24). Phase 60 = Awaiting human UAT.
- **Release gate**: all three prerequisite phases MUST be marked Complete in `.planning/ROADMAP.md` before tagging `1.9.0`. If Phase 60 UAT has not signed off by the time the release plans run, execution must stop at the tag step — local bump/build can still proceed, but tag/push/Release publishing waits.

---

## Locked decisions (mirror of Phase 55 D1–D9 with v1.9.0 deltas)

### D1 — Version string
**`1.9.0` (SemVer).** Tag `1.9.0`, `manifest.version = "1.9.0"`, `versions.json` key `"1.9.0"`.
- **Why:** Standard Obsidian/BRAT format; continuation of Phase 55 cadence. Matches the roadmap's "single 1.9.0 at end of milestone" decision.
- **How to apply:** Use `npm version 1.9.0 --no-git-tag-version` (runs `version-bump.mjs`, which appends `"1.9.0": "1.5.7"` to `versions.json`) OR edit the three files manually in one commit. `git tag 1.9.0` — unprefixed. Do **NOT** create `v1.9.0`.

### D2 — Legacy tags left as-is
**Leave all prior tags untouched.** `v1.0…v1.8` (v-prefixed) and `1.8.0` (clean) remain. Only `1.9.0` is the new tag.
- **Why:** BRAT reads Releases, not bare tags. The `1.8.0` Release already exists (v1.8 shipped). Retroactive retagging is not worth the risk.
- **How to apply:** No retagging. No force-push. Only `1.9.0` is added.

### D3 — `minAppVersion`
**Keep `1.5.7`.** No evidence of newer-API usage in v1.9.
- **Why:** v1.9 phases (59/60/61) did not add dependencies on newer Obsidian APIs — `AbstractInputSuggest` used by FolderSuggest has been in the public API since before 1.5.7. Do not restrict users without cause.
- **How to apply:** `manifest.json.minAppVersion` unchanged. The new `versions.json` entry is `"1.9.0": "1.5.7"`.

### D4 — `versions.json` shape
**Final file = `{"1.8.0": "1.5.7", "1.9.0": "1.5.7"}`.** ADD the v1.9.0 entry; PRESERVE the v1.8.0 entry (unlike Phase 55 which deleted stale `0.1.0`, because here `1.8.0` is a real published Release).
- **Why:** `versions.json` is historical — it lets older Obsidian installs discover which plugin version supports them. Removing `1.8.0` would break BRAT compatibility checks for anyone still on that release.
- **How to apply:** `version-bump.mjs` will do this correctly (it appends). No cleanup step needed. Planner must verify the final JSON shape explicitly in an acceptance criterion.

### D5 — Build artifacts in git
**Already ignored.** No change required in Phase 62.
- **Why:** Phase 55 added `main.js`, `main.js.map`, `styles.css` to `.gitignore` and removed `styles.css` from the index. State is stable; no re-work.
- **How to apply:** Phase 62 preflight script still asserts `git ls-files styles.css` and `git ls-files main.js` are both empty, and that both paths match `git check-ignore`. Planner does NOT edit `.gitignore`.

### D6 — Release creation tool
**User-driven via GitHub web UI.** Planner prepares everything locally; user performs the Release action. Same as Phase 55.
- **Why:** `gh` CLI still not installed in the working shell. Installing it is incidental work outside this phase's scope.
- **How to apply:** Planner's final task produces a runbook (step-by-step copy-pasteable instructions + release-notes text block) inside the phase folder. No automation, no token handling, no `gh` install step.

### D7 — Release notes content
**Curated v1.9 changelog.** Planner compiles a short, reader-oriented list of changes grouped by area, drawn from Phases 59 + 60 + 61:

- **Runner (Inline mode)** — Phase 59 (INLINE-FIX-01, INLINE-FIX-04, INLINE-FIX-05):
  - Nested `templates/ALGO`-style path resolution in inline mode (parity with snippet resolver).
  - Snippet separator honoured when inserting from inline (space/newline between text and snippet).
  - JSON snippet fill-in modal now opens from inline mode (no z-index conflict with the floating modal).
- **Runner (Inline mode)** — Phase 60 (INLINE-FIX-02, INLINE-FIX-03):
  - Inline modal position persists across tab switches and plugin reload (saved in workspace state, clamped to viewport).
  - Compact default layout — the inline modal no longer overlaps note text.
- **Settings UX** — Phase 61 (SETTINGS-01):
  - Folder autocomplete (`FolderSuggest` built on Obsidian's `AbstractInputSuggest`) on all three path fields: Protocols, Snippets, Output.
- **Distribution** — Phase 62 (this release): BRAT install remains at `vegacepticon/RadiProtocol`.

- **Why:** Auto-generated GitHub notes would dump dozens of `docs(XX-YY)` planning commits — unreadable. A curated list is the first user-facing artifact.
- **How to apply:** Planner writes the release-notes markdown block inside the runbook. User pastes it into the Release description. **A3 guardrail carried from Phase 55**: runbook must instruct the user to TRIM any bullets whose phase is not yet marked Complete in ROADMAP.md at publish time (mainly relevant for Phase 60 if its UAT has not signed off yet).

### D8 — Pre-release flag
**Latest (normal Release), not pre-release** — CONDITIONAL on Phase 60 UAT being approved by publish time.
- **Why:** Phases 59 and 61 passed UAT. Phase 60 is in "Awaiting human UAT". If UAT has signed off, v1.9 is a normal Release. If not, the release should be treated as a pre-release OR the release should wait.
- **How to apply:** Runbook includes an explicit pre-publish check: "Verify Phase 60 UAT is marked approved in ROADMAP/STATE before unchecking pre-release." Default instruction is **Latest**; the guardrail covers the exception.

### D9 — `manifest.json` metadata
**Already set by Phase 55.** `author = "vegacepticon"`, `authorUrl = "https://github.com/vegacepticon"`, `fundingUrl = ""`. No change in Phase 62.
- **How to apply:** Phase 62 preflight script still asserts these exact values, but planner does NOT re-edit `manifest.json` except for the `version` field.

### D10 — Phase-60 UAT gate (new for Phase 62)
**Phase 60 UAT must be marked approved in `.planning/ROADMAP.md` before publishing the Release.** Local bump/build/preflight can run in advance, but the tag push and web UI Release step are gated on Phase 60 signing off.
- **Why:** The release asset must reflect the full v1.9 shippable build (ROADMAP dependency). Shipping without Phase 60 UAT would either mean the build includes un-validated code (risk) OR the release notes mislead users about what was tested.
- **How to apply:** Runbook opens with a pre-publish check: grep `.planning/ROADMAP.md` for Phase 60's status, confirm it reads "Complete" (not "Awaiting human UAT"). If still pending, STOP — do not push the tag, do not publish.

---

## Implementation hints (for planner)

- **Single source of truth for version** = `package.json`. `npm version 1.9.0 --no-git-tag-version` triggers `version-bump.mjs` which writes `manifest.version = "1.9.0"` and appends `"1.9.0": "1.5.7"` to `versions.json`. Confirm `versions.json` shape afterwards (`{"1.8.0": "1.5.7", "1.9.0": "1.5.7"}`).
- **Tagging:** Obsidian convention is unprefixed (`1.9.0`). `npm version` by default creates `v1.9.0`. Use `--no-git-tag-version` and tag manually with `git tag 1.9.0 -m "1.9.0"` (annotated, matching Phase 55 precedent).
- **Asset build order:** manifest bump commit FIRST → `npm run build` SECOND → preflight script third → tag fourth. If build runs before the manifest bump, any future manifest-version embedding would encode the wrong version.
- **Reuse Phase 55 scripts:** The release-preflight script at `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/scripts/release-preflight.sh` should be adapted (not copied blindly) for v1.9.0: change the version asserts from `1.8.0` → `1.9.0`, keep the `minAppVersion` check at `1.5.7`, keep the author/authorUrl asserts, keep the artifact-hygiene asserts. The new script lives in the phase folder (e.g., `.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh`).
- **Reuse Phase 55 runbook structure:** The runbook at `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` is the direct template. Change the version throughout, swap in the D7 v1.9 changelog, add the D10 Phase 60 UAT gate as a new section before "Push the tag".
- **No workflow file changes:** `.github/workflows/` still does not exist; this phase does not create it.
- **`isDesktopOnly: true`** — keep; v1.9 added no mobile-compatible features.
- **Runbook location:** put it in the phase folder (e.g., `.planning/phases/62-brat-release-v1.9.0/62-RELEASE-RUNBOOK.md`) so it survives as an artifact.

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 55 precedent (direct template)
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-CONTEXT.md` — locked decisions D1–D9 that this phase mirrors.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-RESEARCH.md` — BRAT mechanics, Obsidian tag convention, Pitfalls 1–6.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-PATTERNS.md` — file analogs for manifest/versions/tag/asset work.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-VALIDATION.md` — acceptance criteria pattern per plan.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` — runbook template to adapt.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/scripts/release-preflight.sh` — preflight script template to adapt.
- `.planning/milestones/v1.8-phases/55-brat-distribution-readiness/55-01-PLAN.md` through `55-04-PLAN.md` — plan shape, task structure, acceptance criteria style.

### Project state
- `.planning/ROADMAP.md` — Phase 62 definition (lines 285–293), v1.9 milestone progress table, execution order.
- `.planning/STATE.md` — Phase 60 UAT status, v1.9 scope summary, standing pitfalls.
- `.planning/REQUIREMENTS.md` — BRAT-02 success criteria (line 25).
- `CLAUDE.md` — build process, CSS architecture, "never remove existing code" rule.

### Repo files touched by this phase (expected)
- `manifest.json` — version bump
- `versions.json` — append `"1.9.0": "1.5.7"`
- `package.json` — version bump (via `npm version 1.9.0 --no-git-tag-version`)
- `main.js` (generated, gitignored) — build output verification
- `styles.css` (generated, gitignored) — build output verification
- `.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh` — new (adapted from Phase 55)
- `.planning/phases/62-brat-release-v1.9.0/62-RELEASE-RUNBOOK.md` — new (adapted from Phase 55)

---

## Specific Ideas

- **Pre-publish gate section in runbook:** the runbook must open with a Phase 60 UAT check (grep ROADMAP.md for "Awaiting human UAT"). This is the only structural addition vs. Phase 55's runbook.
- **Preflight script reuse:** Plan 03 (build + tag) must NOT re-run the Phase 55 preflight; it must create/use `.planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh`. Fresh script, fresh asserts against `1.9.0`.
- **Release notes — trim guardrail:** Already in Phase 55 runbook, carry forward verbatim. Especially important this release because Phase 60 UAT may be pending at publish time.
- **Plan wave structure (mirror of Phase 55):**
  - Wave 1 / Plan 01: version bump (`manifest.json`, `versions.json`, `package.json`) — no `.gitignore` work (done in Phase 55).
  - Wave 2 / Plan 02: build + preflight script + release-prep commit + local tag `1.9.0` — consolidates Phase 55's Plans 02/03 because the `.gitignore` plan is no longer needed.
  - Wave 3 / Plan 03: runbook artifact (with D10 Phase 60 UAT gate added).
  - **OR** keep the 4-plan structure by splitting Wave 2 into "preflight script" and "build + tag", if planner prefers finer granularity. Planner's call.

---

## Deferred Ideas (NOT this phase)

- GitHub Actions workflow to auto-build + auto-release on tag push (carried from Phase 55 deferred list — still next-milestone candidate).
- Submitting RadiProtocol to the official Obsidian community-plugins registry (explicitly NOT in v1.9 per STATE.md — different review process, beyond BRAT scope).
- Populating `fundingUrl` (still no donation channel).
- Raising `minAppVersion` above `1.5.7` (no API-usage justification in v1.9).
- Installing `gh` CLI (incidental; web UI works).
- Retroactive Releases for v1.0…v1.7 tags.
- Cross-checking whether `main.js` embeds the manifest version string (still irrelevant).
- 1.9.1 patch release — single 1.9.0 is the milestone-level decision; any fix-up becomes 1.10.0 or rolls into the next milestone.

---

## Success Criteria (carried from ROADMAP, unchanged)

1. `manifest.json.version`, `versions.json` mapping (min-Obsidian for 1.9.0), and `package.json.version` all agree on `1.9.0`; `npm run build` produces a clean `main.js` + `styles.css` against that manifest version (BRAT-02).
2. `gh release list` (or web UI equivalent) shows a GitHub Release `v1.9.0` (or equivalent tag convention matching Phase 55 precedent — i.e., unprefixed `1.9.0`) whose assets include `manifest.json`, `main.js`, and `styles.css` as individually downloadable files at the release root — not inside a zip (BRAT-02).
3. Installing the plugin in a fresh Obsidian vault via BRAT with identifier `vegacepticon/RadiProtocol` succeeds end-to-end on the 1.9.0 release — plugin appears in Community Plugins, enables cleanly, and the Runner view opens without errors (BRAT-02).

---

*Phase: 62-brat-release-v1.9.0*
*Context gathered: 2026-04-24 by mirroring Phase 55 CONTEXT.md with v1.9.0 deltas*
