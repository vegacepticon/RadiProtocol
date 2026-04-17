---
phase: 37
slug: snippet-editor-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | CLEAN-03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | SYNC-01 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify existing snippet-tree-inline-rename.test.ts covers SYNC-01 folder rename → canvas ref update
- [ ] Add test for "Create folder" button visibility in snippet manager header

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create folder button visible in header | CLEAN-03 | Visual UI placement | Open snippet editor, verify button next to "Create snippet" |
| Folder appears in tree without refresh | CLEAN-03 | Live UI interaction | Create folder, confirm it appears immediately |
| Canvas refs updated after rename | SYNC-01 | Cross-file side effect | Rename folder, open canvas, verify snippet resolves |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
