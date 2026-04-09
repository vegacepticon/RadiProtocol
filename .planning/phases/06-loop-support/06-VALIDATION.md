---
phase: 6
slug: loop-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | LOOP-01 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | LOOP-02 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | LOOP-03 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |
| 6-01-04 | 01 | 1 | LOOP-04 | — | N/A | manual | — | ❌ | ⬜ pending |
| 6-01-05 | 01 | 1 | LOOP-05 | — | N/A | manual | — | ❌ | ⬜ pending |
| 6-01-06 | 01 | 1 | LOOP-06 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — vitest is already installed and configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Runner presents "Loop again / Done" at loop-end | LOOP-03 | Requires Obsidian UI interaction | Open a 3-lesion protocol, run to loop-end, verify button labels |
| Iteration counter "Lesion 2" displays correctly | LOOP-04 | Requires Obsidian UI interaction | Complete first loop iteration, verify counter in RunnerView |
| Step back across loop boundary | LOOP-05 | Requires Obsidian UI interaction | At iteration 2, step back, verify reverts to last node of iteration 1 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
