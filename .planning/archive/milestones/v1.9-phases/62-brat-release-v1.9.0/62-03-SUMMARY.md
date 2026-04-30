---
phase: 62-brat-release-v1.9.0
plan: 03
subsystem: distribution
tags: [release, runbook, brat, uat-gate]
requires: [62-01, 62-02]
provides: [v1.9.0-release-runbook, sc-2-ready, sc-3-ready]
affects: [.planning/phases/62-brat-release-v1.9.0/62-RELEASE-RUNBOOK.md]
requirements: [BRAT-02]
key-files:
  created:
    - .planning/phases/62-brat-release-v1.9.0/62-RELEASE-RUNBOOK.md
  modified: []
decisions:
  - D10 Phase 60 UAT gate authored as the first operational section — runbook structurally diverges from Phase 55 by exactly this addition.
  - Web-UI Release path locked (per D6); `gh release create` listed as anti-pattern.
  - A3 guardrail paragraph at top of Release Notes instructs the user to trim bullets for not-yet-Complete phases — defence-in-depth alongside the D10 gate.
metrics:
  sections_authored: 8
  requirement_ids_rendered: 7
  brat_identifier_occurrences: 8
  version_string_occurrences: 23
  verification_assertions_passed: 22
completed: 2026-04-25
---

# Phase 62 Plan 03: v1.9.0 Release Runbook Summary

User-facing copy-pasteable playbook for publishing RadiProtocol v1.9.0 to GitHub via web UI, gated on Phase 60 UAT — created in one commit and validated against all 22 plan-level assertions.

## Completed Tasks

| Task | Result | Commit |
| ---- | ------ | ------ |
| 62-03-01: Author 62-RELEASE-RUNBOOK.md (D10 gate + 7 sections + Final verdict + Anti-patterns + D7 changelog) | Runbook written via Write tool with exact content from plan `<action>` block; all 22 verification assertions pass. | 398f055 |

## Runbook Structure (verified)

The runbook contains exactly the eight section headings required by the plan, in this order:

1. `# Phase 62 — v1.9.0 Release Runbook` (title + intro blockquote)
2. `## Pre-publish check — Phase 60 UAT gate` — **D10 gate, the Phase 62 structural delta vs. Phase 55. First operational section.**
3. `## Preflight (automated)` — invokes `bash .planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh` verbatim
4. `## Push the tag` — `git push origin main` + `git push origin 1.9.0` (unprefixed)
5. `## Create the GitHub Release (web UI)` — 8-step procedure with tag selection, title `1.9.0`, three loose assets drag-and-drop, pre-release UNCHECKED, latest CHECKED, optional curl smoke-check
6. `## Release Notes` — A3 guardrail at top + D7 changelog grouped by Runner-Inline / Settings UX / Distribution + Install via BRAT subsection
7. `## Post-release verification` — SC-3 fresh-vault BRAT install smoke test (10 numbered steps) + `### Final verdict` subsection
8. `## Anti-patterns (do NOT do any of these)` — re-emphasises Phase 55 pitfalls 4–6 + D4 PRESERVE rule + `gh release create` ban + `v1.9.0` prefix ban

## Requirement IDs Rendered in Release Notes (D7 verbatim)

All seven v1.9 requirement IDs present in the runbook, grouped per D7:

- **Phase 59 (Inline parity)**: `INLINE-FIX-01`, `INLINE-FIX-04`, `INLINE-FIX-05`
- **Phase 60 (Inline layout/position)**: `INLINE-FIX-02`, `INLINE-FIX-03`
- **Phase 61 (Settings UX)**: `SETTINGS-01`
- **Phase 62 (Distribution)**: `BRAT-02`

## Verification

All 22 plan-level assertions pass on HEAD:

- File existence: `test -f` PASS
- Section headers (7): all `grep -Fxq` pass — Pre-publish check, Preflight, Push the tag, Create the GitHub Release, Release Notes, Post-release verification, Final verdict subsection
- Literal commands: `bash .planning/phases/62-brat-release-v1.9.0/scripts/release-preflight.sh`, `git push origin 1.9.0`, `git push origin main` — all present
- BRAT identifier `vegacepticon/RadiProtocol`: 8 occurrences (>= 2 required)
- Version string `1.9.0`: 23 occurrences (>= 10 required)
- Requirement IDs (7): all present (INLINE-FIX-01..05, SETTINGS-01, BRAT-02)
- Strings `Phase 60`, `Awaiting human UAT`, `A3 guardrail`, `final_verdict: pending`: all present
- Commit title match: `git log -1 --format='%s' | grep -q '^docs(62): add v1.9.0 release runbook'` — PASS

## D10 Gate is the First Operational Section — confirmed

The runbook opens (after title and intro blockquote) with `## Pre-publish check — Phase 60 UAT gate`, providing two independent grep checks against `.planning/ROADMAP.md` and a STOP instruction on any indicator other than Complete. This is the structural delta vs. the Phase 55 v1.8.0 runbook and the gating control for T-62-03-01 (per the plan's threat model).

## SC-2 / SC-3 Status

With this plan landed, all planner/executor work for Phase 62 is complete. SC-2 (GitHub Release published with three loose assets) and SC-3 (BRAT install in fresh vault) are now blocked **only** on:

1. **Phase 60 UAT signing off in `ROADMAP.md`** (D10 gate condition — currently `Awaiting human UAT` per plan-time check).
2. **User action** — running the preflight, pushing the tag, creating the Release in the GitHub web UI, and performing the fresh-vault BRAT install per the runbook.

No further planner or executor work is required to unblock SC-2 or SC-3.

## Deviations from Plan

None — runbook authored verbatim from the plan's `<action>` block specification. No deviation rules triggered.

## Deferred Issues

None within plan scope. Pre-existing dirty items in the working tree (`.planning/v1.8-MILESTONE-AUDIT.md` modification, untracked `62-01-SUMMARY.md` and `62-02-SUMMARY.md`) were preserved exactly as found per the executor prompt's explicit instruction.

## Known Stubs

None — the runbook is a static, copy-pasteable user document. No code paths, no rendered data flows.

## Threat Flags

None — all five STRIDE threats from the plan's threat register (T-62-03-01 through T-62-03-05) are mitigated by the runbook content as specified:

- T-62-03-01 (Tampering — asset shipped without UAT) → mitigated by D10 gate as first operational section.
- T-62-03-02 (Spoofing — tag/title/manifest mismatch) → mitigated by exact-typing instruction in §Create the GitHub Release step 3 + anti-patterns ban on `v1.9.0` prefix and descriptive suffixes.
- T-62-03-03 (Denial of service — zipped assets) → mitigated by §Create the GitHub Release step 5 explicit "DO NOT zip" + Anti-patterns repeat.
- T-62-03-04 (Information disclosure — unreviewed feature in changelog) → mitigated by A3 guardrail at top of §Release Notes.
- T-62-03-05 (Tampering — versions.json regression) → mitigated by Anti-patterns explicit "Removing the 1.8.0 entry" warning + preflight assertion (Plan 02).

## Commit

- `398f055` docs(62): add v1.9.0 release runbook with Phase 60 UAT gate

## Self-Check: PASSED

- `.planning/phases/62-brat-release-v1.9.0/62-RELEASE-RUNBOOK.md` exists.
- Commit `398f055` exists on HEAD with title `docs(62): add v1.9.0 release runbook with Phase 60 UAT gate`.
- All 22 plan-level verification assertions exit 0.
- Working-tree dirty state matches starting state exactly (no incidental file changes).
