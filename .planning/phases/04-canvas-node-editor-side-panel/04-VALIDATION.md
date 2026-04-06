---
phase: 4
slug: canvas-node-editor-side-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (existing) |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --testPathPattern=runner-extensions` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | EDIT-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | EDIT-02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | EDIT-03 | — | N/A | manual | manual test | — | ⬜ pending |
| 4-02-02 | 02 | 2 | EDIT-04 | — | canvas guard prevents silent overwrite | manual | manual test | — | ⬜ pending |
| 4-02-03 | 02 | 2 | EDIT-05 | — | N/A | manual | manual test | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/editor-panel.test.ts` — stubs for EDIT-01, EDIT-02
- [ ] shared fixtures for NodeData and canvas JSON structures

*Existing jest infrastructure covers the automated portion; manual verification required for canvas write-back and context menu.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form fields pre-populated for selected node | EDIT-01, EDIT-02 | Obsidian UI only testable in live plugin | Open canvas, click node, open editor panel — verify fields match node properties |
| Save writes updated properties to canvas JSON | EDIT-03 | Requires live file system and Obsidian | Edit field values, save, inspect .canvas file in text editor |
| Canvas not corrupted after write | EDIT-03 | Requires Obsidian native Canvas view | Re-open canvas in Obsidian, confirm all nodes and edges intact |
| Open-canvas guard triggers Notice | EDIT-04 | Requires running Obsidian with canvas open | Attempt edit with canvas open — verify Notice shown and write aborted |
| Context menu opens editor panel | EDIT-05 | Requires Obsidian Canvas right-click menu | Right-click node on canvas — verify "Edit RadiProtocol" appears and opens panel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
