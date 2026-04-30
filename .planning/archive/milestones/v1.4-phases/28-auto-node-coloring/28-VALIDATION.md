---
phase: 28
slug: auto-node-coloring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | NODE-COLOR-01 | — | N/A | unit | `npm test -- --run --reporter=verbose` | ✅ existing | ⬜ pending |
| 28-01-02 | 01 | 1 | NODE-COLOR-02 | — | N/A | unit | `npm test -- --run --reporter=verbose` | ✅ existing | ⬜ pending |
| 28-02-01 | 02 | 1 | NODE-COLOR-03 | — | N/A | unit | `npm test -- --run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/canvas-write-back.test.ts` — update color contract (line 57: "color is never written" → "color is always written for known types")
- [ ] Helper `makeCanvasNode(type, overrides?)` — new fixture helper that auto-derives color from NODE_COLOR_MAP

*Existing infrastructure (vitest) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas node color updates immediately when canvas is open (Pattern B) | NODE-COLOR-01 | Requires live Obsidian canvas render | Open canvas, open EditorPanel, save a node, observe color change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
