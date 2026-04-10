---
phase: 20
slug: housekeeping-removals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-W0-01 | Wave 0 | 0 | NTYPE-01, NTYPE-02 | — | N/A | unit | `npm test -- canvas-parser` | ❌ W0 | ⬜ pending |
| 20-W0-02 | Wave 0 | 0 | NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test -- protocol-runner` | ❌ W0 | ⬜ pending |
| 20-W0-03 | Wave 0 | 0 | NTYPE-04 | — | N/A | unit | `npm test -- RunnerView` | ❌ W0 | ⬜ pending |
| 20-W0-04 | Wave 0 | 0 | UX-02 | — | N/A | unit | `npm test -- editor-panel` | ❌ W0 | ⬜ pending |
| 20-01 | types | 1 | NTYPE-01, NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |
| 20-02 | parser | 1 | NTYPE-01, NTYPE-02 | — | N/A | unit | `npm test -- canvas-parser` | ✅ | ⬜ pending |
| 20-03 | runner | 1 | NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test -- protocol-runner` | ✅ | ⬜ pending |
| 20-04 | views | 2 | NTYPE-01, NTYPE-04 | — | N/A | unit | `npm test` | ✅ | ⬜ pending |
| 20-05 | css | 2 | UX-01 | — | N/A | manual | — | ✅ | ⬜ pending |
| 20-06 | editor | 2 | UX-02 | — | N/A | unit | `npm test -- editor-panel` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/fixtures/deprecated-free-text.canvas` — canvas fixture with a `free-text-input` node for silent-skip tests (NTYPE-01, NTYPE-02)
- [ ] New test case in `src/__tests__/graph/canvas-parser.test.ts` — parser silently skips `free-text-input` node and drops edges to/from it
- [ ] Remove/rewrite test cases in `src/__tests__/runner/protocol-runner.test.ts` lines 229–254 (`awaiting-snippet-fill state` describe block)
- [ ] New test case in `src/__tests__/runner/protocol-runner.test.ts` — text-block with `radiprotocol_snippetId` in JSON auto-advances with plain content text (NTYPE-03)
- [ ] New test case in `src/__tests__/views/editor-panel.test.ts` — answer textarea has `rows === 6` (UX-02)
- [ ] New test case in `src/__tests__/views/RunnerView.test.ts` — `openCanvas()` with legacy `awaiting-snippet-fill` session starts fresh (NTYPE-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Protocol Runner textarea does not change background colour on mouse hover | UX-01 | CSS visual change — no DOM assertion available | Load a canvas in Obsidian, hover over the runner textarea, confirm background stays unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
