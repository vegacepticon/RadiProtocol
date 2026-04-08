---
phase: 12
slug: runner-layout-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` |
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
| 12-01-01 | 01 | 1 | LAYOUT-02 | — | N/A | unit (jsdom) | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) | ⬜ pending |
| 12-01-02 | 01 | 1 | LAYOUT-01 | — | N/A | unit (jsdom) | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) | ⬜ pending |
| 12-01-03 | 01 | 1 | LAYOUT-03 | — | N/A | manual CSS | `npm test -- --reporter=verbose` | ✅ `src/styles.css` | ⬜ pending |
| 12-01-04 | 01 | 1 | LAYOUT-04 | — | N/A | unit | `npm test -- --reporter=verbose` | ✅ `src/__tests__/RunnerView.test.ts` (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/RunnerView.test.ts` — add `@vitest-environment jsdom` block with DOM assertions for LAYOUT-01 (textarea height set), LAYOUT-02 (previewZone before questionZone), LAYOUT-04 (renderLegend absent)

*Existing framework covers the test runner; only test extensions needed, no new files or packages required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.rp-insert-btn` has `flex: 1` applied visually | LAYOUT-03 | CSS rule change — no DOM behavior, trivial grep verification | Grep `src/styles.css` for `.rp-insert-btn` in the flex:1 rule |
| Panel scrolls when protocol is long | LAYOUT-01 | jsdom has no layout engine — scrollHeight always 0 | Load a long protocol in sidebar mode, confirm panel scrolls and textarea shows all text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
