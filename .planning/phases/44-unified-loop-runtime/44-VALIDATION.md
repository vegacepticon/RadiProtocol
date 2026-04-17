---
phase: 44
slug: unified-loop-runtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run build` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner from PLAN.md `<automated>` blocks. Columns are authoritative; downstream execute/verify workflows read the Automated Command to run per-task validation.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-XX-XX | XX | N | RUN-XX | — | N/A | unit/integration | `npm test -- --run path/to.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/canvases/unified-loop-nested.canvas` — nested-loop fixture for RUN-04
- [ ] Rewrite 7 skipped tests in `tests/runtime/protocol-runner.test.ts` (RUN-01..RUN-05)
- [ ] Rewrite 4 skipped tests in `tests/runtime/protocol-runner-session.test.ts` (RUN-06)
- [ ] New test file `tests/runtime/protocol-runner-loop-picker.test.ts` — covers RUN-01..RUN-03 specific picker paths

*Framework already installed — vitest is in use across Phase 43 test corpus.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loop picker visual rendering in Obsidian | RUN-01 | Requires running Obsidian plugin with a canvas containing a `loop` node | 1) `npm run dev` 2) open a canvas with a `loop` node 3) start protocol 4) verify picker shows every body-branch label + «выход» under `headerText` |
| Session resume across Obsidian restart | RUN-06 | Requires closing and reopening the Obsidian process (automated tests simulate this via save/load round-trip, but real restart is manual) | 1) Start a protocol inside a loop 2) Close Obsidian 3) Reopen 4) Verify runner resumes at same picker with same accumulated text |
| Step-back UX after loop entry | RUN-05 | Requires user-initiated step-back action in the running plugin to visually confirm text/node restoration | 1) Start protocol 2) Enter loop 3) Pick a branch 4) Step back 5) Verify state reverts to pre-loop node + accumulated text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
