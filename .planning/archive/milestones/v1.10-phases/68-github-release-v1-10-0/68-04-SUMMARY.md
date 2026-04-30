---
phase: 68-github-release-v1-10-0
plan: 04
subsystem: release-publication
tags: [release, github-release, brat, runbook]
key-files:
  created:
    - .planning/phases/68-github-release-v1-10-0/68-RELEASE-RUNBOOK.md
  modified:
    - .planning/phases/68-github-release-v1-10-0/68-RELEASE-RUNBOOK.md
decisions:
  - Phase 66 UAT gate kept as the first operational section of the runbook (mirrors Phase 62 D10 precedent).
  - Release published via GitHub web UI with three loose root assets — no zip, no v-prefix on tag/title.
  - BRAT smoke install on a clean vault used as the final verdict gate.
metrics:
  completed: 2026-04-26
  tasks: 2
release:
  tag: "1.10.0"
  title: "1.10.0"
  url: https://github.com/vegacepticon/RadiProtocol/releases/tag/1.10.0
  prerelease: false
  latest: true
  assets: ["manifest.json", "main.js", "styles.css"]
  brat_identifier: vegacepticon/RadiProtocol
  brat_smoke: passed
---

# Phase 68 Plan 04: Release Runbook + GitHub Release Publication Summary

Authored the v1.10.0 release runbook with the Phase 66 UAT gate, ran the runbook end-to-end, and published the GitHub Release with BRAT smoke verification on a clean vault.

## Completed Tasks

| Task | Result |
| ---- | ------ |
| 68-04-01 Author release runbook | `68-RELEASE-RUNBOOK.md` created with frontmatter, Phase 66 UAT gate, preflight, push/tag, GitHub web UI publish, release notes (Phases 63–67 + v1.10 REQ-IDs), BRAT smoke verification, and anti-patterns. |
| 68-04-02 Publish GitHub Release + BRAT smoke verify | Release `1.10.0` published as Latest with three loose assets; BRAT install on clean vault enabled RadiProtocol at version `1.10.0` with all post-publish smoke checks green. |

## Verification

- **Phase 66 UAT gate:** PASS — `66-UAT.md` `status: complete`, `passed: 9`, `issues: 0`, `pending: 0`; ROADMAP shows Phase 66 complete.
- **Preflight:** PASS — `release-preflight.sh` final line `SC-1 local verification: PASS`.
- **Push:** PASS — `main` and tag `1.10.0` pushed to `origin`; tag `1.10.0` resolves to `a1992e1` (release-prep HEAD).
- **GitHub Release:** PASS — title exactly `1.10.0`, no `v` prefix, prerelease unchecked, Latest checked.
- **Release assets:** PASS — `manifest.json`, `main.js`, `styles.css` attached as loose root downloads (not zipped).
- **BRAT smoke install:** PASS — clean Obsidian vault → BRAT add `vegacepticon/RadiProtocol` → plugin enables at version `1.10.0` with no console errors.
- **Live smoke checks (per runbook §Post-release verification):**
  - Runner view opens cleanly (selector renders).
  - Node Editor on a canvas: canvas↔form text sync verified.
  - Runner: Back/Skip footer layout + one-click Back behaviour confirmed.
  - Inline Runner: resize → tab switch → restore preserves dimensions.
  - File-bound Snippet node in inline mode appends bound file content directly.

## Deviations from Plan

None. Runbook executed as written.

## Known Stubs

None.

## Self-Check: PASSED

- Runbook frontmatter set to `final_verdict: success` with `performed_on: 2026-04-26`.
- Release URL, title, asset list, and BRAT smoke result recorded in runbook frontmatter and Post-release verification section.
- Local tag `1.10.0` matches the published Release tag.
