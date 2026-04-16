---
phase: 40
slug: node-duplication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | DUP-01 | — | N/A | manual | `npm run build` | ✅ | ⬜ pending |
| 40-01-02 | 01 | 1 | DUP-01 | — | N/A | manual | `npm run build` | ✅ | ⬜ pending |
| 40-01-03 | 01 | 1 | DUP-02 | — | N/A | manual | `npm run build` | ✅ | ⬜ pending |
| 40-01-04 | 01 | 1 | DUP-01 | — | N/A | manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate button appears in toolbar | DUP-01 | UI interaction requires Obsidian canvas | Open canvas, select node, verify button visible |
| Duplicated node preserves radiprotocol_* properties | DUP-01 | Canvas data access requires running plugin | Duplicate node, inspect canvas JSON for properties |
| Duplicated node has no edges | DUP-02 | Edge verification requires canvas inspection | Duplicate node with edges, verify copy has none |
| Editor panel loads duplicated node | DUP-01 | Panel interaction requires running plugin | Duplicate node, verify editor shows new node |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
