---
phase: 55
slug: brat-distribution-readiness
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (unit) + bash/PowerShell shell assertions (distribution checks) |
| **Config file** | `vitest.config.ts` (existing) — no new test file in this phase |
| **Quick run command** | `npm run build` (generates `main.js` + `styles.css` against current manifest version) |
| **Full suite command** | `bash .planning/phases/55-brat-distribution-readiness/scripts/release-preflight.sh` (to be created by planner) |
| **Estimated runtime** | ~10 seconds total (build ~5s + shell assertions ~3s) |

---

## Sampling Rate

- **After every task commit:** Run the relevant shell assertion block for the file just modified (e.g., after `.gitignore` edit, run the `git check-ignore styles.css` assertion).
- **After every plan wave:** Run the full `release-preflight.sh` script.
- **Before `/gsd-verify-work`:** Full `release-preflight.sh` must exit 0; tag `1.8.0` must exist locally.
- **Max feedback latency:** ~10 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | BRAT-01 | — | N/A — distribution metadata only | shell | `test "$(jq -r '.version' manifest.json)" = "1.8.0"` | ✅ (manifest.json exists) | ⬜ pending |
| 55-01-02 | 01 | 1 | BRAT-01 | — | N/A | shell | `jq -e '.["1.8.0"] == "1.5.7" and (has("0.1.0") \| not)' versions.json` | ✅ | ⬜ pending |
| 55-01-03 | 01 | 1 | BRAT-01 | — | Public author handle only; no real-name disclosure | shell | `jq -e '.author == "vegacepticon" and .authorUrl == "https://github.com/vegacepticon" and .fundingUrl == ""' manifest.json` | ✅ | ⬜ pending |
| 55-02-01 | 02 | 2 | BRAT-01 | — | styles.css no longer tracked → no source/dist drift | shell | `grep -Fxq 'styles.css' .gitignore && ! git ls-files --error-unmatch styles.css 2>/dev/null` | ✅ | ⬜ pending |
| 55-03-01 | 03 | 3 | BRAT-01 | — | Build output aligns with bumped version | shell | `npm run build && test -s main.js && test -s styles.css` | ✅ | ⬜ pending |
| 55-03-02 | 03 | 3 | BRAT-01 | — | Tag matches manifest exactly, no prefix | shell | `git rev-parse --verify 1.8.0 >/dev/null && ! git tag -l 'v1.8.0' \| grep -q .` | ✅ | ⬜ pending |
| 55-04-01 | 04 | 4 | BRAT-01 | — | Runbook gives user reproducible Release steps | shell | `test -f .planning/phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md && grep -q '## Release Notes' .planning/phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` | ❌ W0 (planner creates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/55-brat-distribution-readiness/scripts/release-preflight.sh` — a preflight assertion script that aggregates all per-task shell checks listed above into a single script the verifier can run end-to-end (exits 0 only when all checks pass).
- [ ] `.planning/phases/55-brat-distribution-readiness/55-RELEASE-RUNBOOK.md` — placeholder created so the runbook task has a file to fill (or planner can treat as created during the runbook task).

*Framework install: `jq` is already available on standard dev environments; PowerShell has `ConvertFrom-Json` as fallback. No vitest infra changes needed (no TypeScript code under test in this phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A GitHub Release named `1.8.0` exists on `vegacepticon/RadiProtocol` with three loose assets `manifest.json`, `main.js`, `styles.css` | BRAT-01 (SC-2) | No `gh` CLI; release is created via web UI per D6 | User follows runbook → visits github.com/vegacepticon/RadiProtocol/releases → confirms the new release shows three individual file links (not a zip) and "Latest" badge is set. |
| BRAT identifier `vegacepticon/RadiProtocol` installs cleanly in a fresh vault | BRAT-01 (SC-3) | Requires a fresh Obsidian vault + BRAT plugin — environment-dependent | User opens fresh vault → installs BRAT → "Add beta plugin" → pastes `vegacepticon/RadiProtocol` → verifies plugin appears, enables, Runner view opens. |
| Release Notes block is human-readable and accurately reflects v1.8 user-visible changes | BRAT-01 (D7) | Content quality is subjective | User reviews the changelog block in the runbook before pasting into the Release description. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`release-preflight.sh` + runbook placeholder)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
