---
phase: 74
slug: github-release-v1-11-0
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-30
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (for unit tests only) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full build + test must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 74-01-01 | 01 | 1 | BRAT-03 | — | Version alignment | script | `grep '"version": "1.11.0"' manifest.json package.json` | ⬜ | ⬜ pending |
| 74-01-02 | 01 | 1 | BRAT-03 | — | Build artifacts | script | `test -f main.js && test -f styles.css` | ⬜ | ⬜ pending |
| 74-01-03 | 01 | 1 | BRAT-03 | — | versions.json preserved | script | `grep '"1.8.0"' versions.json && grep '"1.9.0"' versions.json && grep '"1.10.0"' versions.json` | ⬜ | ⬜ pending |
| 74-02-01 | 02 | 1 | BRAT-03 | — | Tag exists | script | `git tag -l 1.11.0` | ⬜ | ⬜ pending |
| 74-02-02 | 02 | 1 | BRAT-03 | — | Release assets | manual | Verify 3 assets on GitHub release page | ⬜ | ⬜ pending |
| 74-03-01 | 03 | 1 | BRAT-03 | — | BRAT install | manual | Clean vault BRAT smoke test | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- `npm run build` (esbuild + tsc)
- `version-bump.mjs` script
- Git tagging workflow
- GitHub Releases (manual creation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Release page shows 3 loose assets | BRAT-03 | Requires GitHub UI interaction | Open release page, verify manifest.json, main.js, styles.css are attached as individual files |
| BRAT install on clean vault | BRAT-03 | Requires Obsidian + BRAT plugin | 1. Create new vault 2. Install BRAT 3. Add `vegacepticon/RadiProtocol` 4. Enable plugin 5. Verify version shows 1.11.0 6. Open Runner view |
| Plugin enables without errors | BRAT-03 | Requires live Obsidian runtime | After BRAT install, enable plugin and check DevTools console for errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
