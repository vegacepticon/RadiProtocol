---
phase: 22
slug: snippet-node-graph-and-runner-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green (3 pre-existing RED in `runner-extensions.test.ts` are acceptable — they belong to Phase 23)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | SNIPPET-01 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 22-01-02 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/canvas-parser.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/graph-validator.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-04 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ✅ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | ✅ W0 | ⬜ pending |
| 22-03-01 | 03 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ W0 | ⬜ pending |
| 22-03-02 | 03 | 1 | SNIPPET-01 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/canvas-parser.test.ts` — add stub tests for snippet parse (RED until Wave 1)
- [ ] `src/__tests__/fixtures/snippet-node.canvas` — fixture file for Wave 1 parser tests
- [ ] `src/__tests__/graph-validator.test.ts` — add stub test for snippet dead-end valid (RED until Wave 1)
- [ ] `src/__tests__/runner/protocol-runner.test.ts` — add stub tests for snippet halt, `isAtSnippetNode`, `canStepBack` false (RED until Wave 1)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
