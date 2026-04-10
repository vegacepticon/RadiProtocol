---
phase: 2
slug: core-protocol-runner-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/runner/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/runner/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | RUN-01 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | RUN-01 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | RUN-01,RUN-02 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | RUN-03 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | RUN-04,RUN-07 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | RUN-05,RUN-06 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | RUN-08 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 3 | RUN-09 | — | N/A | unit | `npx vitest run src/__tests__/runner/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/runner/protocol-runner.test.ts` — stubs for RUN-01 through RUN-09
- [ ] `src/__tests__/fixtures/text-block.canvas` — text-block node fixture
- [ ] `src/__tests__/fixtures/snippet-block.canvas` — snippet node fixture
- [ ] `src/__tests__/fixtures/free-text.canvas` — free-text node fixture
- [ ] `src/__tests__/fixtures/loop-start.canvas` — loop-start node fixture

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
