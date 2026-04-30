---
phase: 18
slug: css-gap-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — CSS-only phase, no automated test framework |
| **Config file** | none |
| **Quick run command** | `grep -E "rp-insert-btn|rp-selector-bar|rp-run-again-btn" src/styles.css` |
| **Full suite command** | `grep -E "rp-insert-btn|rp-selector-bar|rp-selector-wrapper|rp-selector-trigger|rp-selector-popover|rp-selector-row|rp-run-again-btn" src/styles.css` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `grep -E "rp-insert-btn|rp-selector-bar|rp-run-again-btn" src/styles.css`
- **After every plan wave:** Run full suite grep command above
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | LAYOUT-03 | — | N/A | grep | `grep "rp-insert-btn" src/styles.css` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | SIDEBAR-01 | — | N/A | grep | `grep "rp-selector-bar" src/styles.css` | ✅ | ⬜ pending |
| 18-01-03 | 01 | 1 | RUNNER-01 | — | N/A | grep | `grep "rp-run-again-btn" src/styles.css` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a CSS-only phase — no test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Insert button renders same width as Copy/Save | LAYOUT-03 | Visual rendering check | Open plugin in Obsidian, open runner view, verify Insert button is same width as Copy and Save buttons |
| Canvas selector widget renders styled | SIDEBAR-01 | Visual rendering check | Open plugin sidebar, verify canvas selector dropdown shows styled rows with icons and hover states |
| Run Again button styled and disabled when no canvas | RUNNER-01 | Visual rendering check | Open runner view with no canvas loaded, verify Run Again button appears disabled and styled correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
