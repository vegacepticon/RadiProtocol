---
phase: 8
slug: settings-full-tab-runner-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (via npm test) |
| **Config file** | jest.config.js or package.json scripts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | RUNTAB-01 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | RUNTAB-02 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |
| 8-01-03 | 01 | 1 | RUNTAB-03 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab mode opens runner in main workspace (not sidebar) | RUNTAB-02 | Requires live Obsidian UI interaction | 1. Enable tab mode in settings. 2. Run protocol runner command. 3. Verify tab appears in main workspace. |
| Second invocation reveals existing tab, no duplicate | RUNTAB-03 | Requires live Obsidian UI interaction | 1. Open runner tab. 2. Run command again. 3. Verify same tab is focused, no duplicate created. |
| Sidebar mode matches v1.0 behavior (no regression) | RUNTAB-01 | Requires live Obsidian UI interaction | 1. Ensure sidebar mode (default). 2. Run protocol runner command. 3. Verify sidebar panel opens as before. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
