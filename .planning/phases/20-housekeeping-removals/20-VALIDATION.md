---
phase: 20
slug: housekeeping-removals
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
audited: 2026-04-10
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
| 20-W0-01 | Wave 0 | 0 | NTYPE-01, NTYPE-02 | — | N/A | unit | `npm test -- canvas-parser` | ✅ | ✅ green |
| 20-W0-02 | Wave 0 | 0 | NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test -- protocol-runner` | ✅ | ✅ green |
| 20-W0-03 | Wave 0 | 0 | NTYPE-04 | — | N/A | unit | `npm test -- RunnerView` | ✅ | ✅ green |
| 20-W0-04 | Wave 0 | 0 | UX-02 | — | N/A | unit | `npm test -- editor-panel` | ✅ | ✅ green |
| 20-01 | types | 1 | NTYPE-01, NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test` | ✅ | ✅ green |
| 20-02 | parser | 1 | NTYPE-01, NTYPE-02 | — | N/A | unit | `npm test -- canvas-parser` | ✅ | ✅ green |
| 20-03 | runner | 1 | NTYPE-03, NTYPE-04 | — | N/A | unit | `npm test -- protocol-runner` | ✅ | ✅ green |
| 20-04 | views | 2 | NTYPE-01, NTYPE-04 | — | N/A | unit | `npm test` | ✅ | ✅ green |
| 20-05 | css | 2 | UX-01 | — | N/A | manual | — | ✅ | ⬜ manual |
| 20-06 | editor | 2 | UX-02 | — | N/A | unit | `npm test -- editor-panel` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/fixtures/deprecated-free-text.canvas` — canvas fixture with a `free-text-input` node for silent-skip tests (NTYPE-01, NTYPE-02)
- [x] New test case in `src/__tests__/canvas-parser.test.ts` — parser silently skips `free-text-input` node and drops edges to/from it
- [x] Remove/rewrite test cases in `src/__tests__/runner/protocol-runner.test.ts` (`awaiting-snippet-fill state` describe block removed)
- [x] New test case in `src/__tests__/runner/protocol-runner.test.ts` — text-block with `radiprotocol_snippetId` in JSON auto-advances with plain content text (NTYPE-03)
- [x] New test case in `src/__tests__/editor-panel.test.ts` — answer textarea has `rows === 6` (UX-02)
- [x] New test case in `src/__tests__/RunnerView.test.ts` — `openCanvas()` with legacy `awaiting-snippet-fill` session starts fresh (NTYPE-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Protocol Runner textarea does not change background colour on mouse hover | UX-01 | CSS visual change — no DOM assertion available | Load a canvas in Obsidian, hover over the runner textarea, confirm background stays unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-10 — audit confirmed 132 passing, 0 phase-20 failures

---

## Validation Audit 2026-04-10

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual-only | 1 (UX-01 — CSS hover, no DOM assertion) |
| Tests passing | 132 |
| Tests failing (phase 20) | 0 |
| Unrelated failing stubs | 3 (runner-extensions — future phase placeholder) |
