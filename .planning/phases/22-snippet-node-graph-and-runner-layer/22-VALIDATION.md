---
phase: 22
slug: snippet-node-graph-and-runner-layer
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
audited: 2026-04-11
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
| 22-01-01 | 01 | 0 | SNIPPET-01 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ✅ green |
| 22-01-02 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/canvas-parser.test.ts` | ✅ W0 | ✅ green |
| 22-01-03 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/graph-validator.test.ts` | ✅ W0 | ✅ green |
| 22-01-04 | 01 | 0 | SNIPPET-01 | — | N/A | unit stub | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ W0 | ✅ green |
| 22-02-01 | 02 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ✅ W0 | ✅ green |
| 22-02-02 | 02 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | ✅ W0 | ✅ green |
| 22-03-01 | 03 | 1 | SNIPPET-01 | — | N/A | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ W0 | ✅ green |
| 22-03-02 | 03 | 1 | SNIPPET-01 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/canvas-parser.test.ts` — 5 snippet-node tests present and GREEN
- [x] `src/__tests__/fixtures/snippet-node.canvas` — fixture exists
- [x] `src/__tests__/graph-validator.test.ts` — 1 snippet dead-end test present and GREEN
- [x] `src/__tests__/runner/protocol-runner.test.ts` — 3 snippet halt tests present and GREEN (`D-06`, `D-07`, `canStepBack false`)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-11

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tasks audited | 8 |
| Tests confirmed green | 52 (canvas-parser + graph-validator + protocol-runner) |
| Full suite | 142 passing / 3 pre-existing RED (runner-extensions, Phase 23 scope) |
| tsc --noEmit | Clean — zero source errors (node_modules moduleResolution warnings pre-existing) |
