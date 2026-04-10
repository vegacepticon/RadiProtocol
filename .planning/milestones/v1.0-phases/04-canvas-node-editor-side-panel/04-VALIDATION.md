---
phase: 4
slug: canvas-node-editor-side-panel
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/editor-panel.test.ts src/__tests__/canvas-write-back.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-00-01 | 00 | 1 | EDIT-01, EDIT-02 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ❌ W0 creates it | ⬜ pending |
| 4-00-02 | 00 | 1 | EDIT-03, EDIT-04 | — | PROTECTED_FIELDS, canvas-open guard, orphan cleanup | unit | `npx vitest run src/__tests__/canvas-write-back.test.ts` | ❌ W0 creates it | ⬜ pending |
| 4-01-01 | 01 | 2 | EDIT-01 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ after W0 | ⬜ pending |
| 4-01-02 | 01 | 2 | EDIT-02 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ after W0 | ⬜ pending |
| 4-02-01 | 02 | 3 | EDIT-03, EDIT-04 | T-04-02-01, T-04-02-02 | canvas guard prevents silent overwrite; PROTECTED_FIELDS; orphan cleanup | unit | `npx vitest run src/__tests__/canvas-write-back.test.ts` | ✅ after W0 | ⬜ pending |
| 4-02-02 | 02 | 3 | EDIT-05 | — | N/A | manual | manual test | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/editor-panel.test.ts` — stubs for EDIT-01, EDIT-02
- [ ] `src/__tests__/canvas-write-back.test.ts` — stubs for EDIT-03, EDIT-04 (JSON patching, PROTECTED_FIELDS, orphan cleanup, canvas-open guard)

*Existing Vitest infrastructure covers the automated portion; manual verification required for canvas write-back (live Obsidian) and context menu.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form fields pre-populated for selected node | EDIT-01, EDIT-02 | Obsidian UI only testable in live plugin | Open canvas, click node, open editor panel — verify fields match node properties |
| Save writes updated properties to canvas JSON | EDIT-03 | Requires live file system and Obsidian | Edit field values, save, inspect .canvas file in text editor |
| Canvas not corrupted after write | EDIT-03 | Requires Obsidian native Canvas view | Re-open canvas in Obsidian, confirm all nodes and edges intact |
| Open-canvas guard triggers Notice | EDIT-04 | Requires running Obsidian with canvas open | Attempt edit with canvas open — verify Notice shown and write aborted |
| Un-mark cleanup removes all radiprotocol_* keys | EDIT-03 | Requires live file inspection | Set node type to unset, save, inspect .canvas — verify no radiprotocol_* keys remain |
| Context menu opens editor panel | EDIT-05 | Requires Obsidian Canvas right-click menu | Right-click node on canvas — verify "Edit RadiProtocol properties" appears and opens panel |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (editor-panel.test.ts + canvas-write-back.test.ts)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
