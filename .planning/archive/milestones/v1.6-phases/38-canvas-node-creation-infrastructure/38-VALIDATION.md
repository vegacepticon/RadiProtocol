---
phase: 38
slug: canvas-node-creation-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | CANVAS-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | CANVAS-04 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 38-01-03 | 01 | 1 | CANVAS-05 | — | N/A | manual | Manual verification | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Unit tests for CanvasNodeFactory service — stubs for CANVAS-01, CANVAS-04
- [ ] Existing test infrastructure covers framework needs

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Node creation on live canvas | CANVAS-01 | Requires Obsidian runtime with canvas view | Open canvas, trigger node creation, verify node appears |
| Auto-color on created nodes | CANVAS-04 | Requires Obsidian canvas rendering | Create node, verify color matches NODE_COLOR_MAP |
| No-canvas Notice | CANVAS-01 | Requires Obsidian Notice API | Close all canvases, trigger creation, verify Notice shown |
| Position offset no overlap | CANVAS-05 | Requires visual canvas inspection | Create node adjacent to selected, verify no overlap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
