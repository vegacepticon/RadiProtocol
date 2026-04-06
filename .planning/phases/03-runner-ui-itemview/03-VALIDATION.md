---
phase: 3
slug: runner-ui-itemview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (existing) |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --testPathPattern=runner` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=runner`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UI-01 | — | N/A | unit | `npm test -- --testPathPattern=RunnerView` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | UI-02 | — | N/A | unit | `npm test -- --testPathPattern=RunnerView` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | UI-03 | — | N/A | unit | `npm test -- --testPathPattern=RunnerView` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | UI-04 | — | N/A | unit | `npm test -- --testPathPattern=RunnerView` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | UI-05 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | UI-06 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | UI-07 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | UI-08 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 4 | RUN-10 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 4 | RUN-11 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 5 | UI-09 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-05-02 | 05 | 5 | UI-10 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-05-03 | 05 | 5 | UI-11 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |
| 03-05-04 | 05 | 5 | UI-12 | — | N/A | unit | `npm test -- --testPathPattern=runner` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/RunnerView.test.ts` — stubs for UI-01, UI-02, UI-03
- [ ] `src/__tests__/RunnerState.test.ts` — stubs for UI-04, UI-05, UI-06, RUN-11
- [ ] `src/__tests__/runner-commands.test.ts` — stubs for RUN-10, UI-07, UI-08
- [ ] `src/__tests__/save-to-note.test.ts` — stubs for UI-09, UI-10, UI-11, UI-12

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RunnerView opens in right sidebar | UI-01 | Obsidian workspace.getRightLeaf() requires live Obsidian | Open test vault, run "Run protocol" from command palette, confirm right sidebar shows RunnerView |
| Step-back reverts preview text | UI-06 | DOM state across interactions | Answer 2 questions, click Step back, verify preview reverts |
| getState/setState on workspace restore | UI-11 | Requires Obsidian restart | Close and reopen Obsidian, confirm RunnerView in idle state |
| Copy to clipboard | UI-08 | Clipboard API unavailable in jest | Complete protocol, click Copy, paste into text editor |
| Answer button layout with 8+ options | UI-04 | Visual layout validation | Load a protocol with many laterality options, verify no overflow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
