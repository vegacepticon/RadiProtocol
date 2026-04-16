---
phase: 39
slug: quick-create-ui-in-node-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | package.json `"test": "vitest run"` |
| **Quick run command** | `npx vitest run src/__tests__/editor-panel-create.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/editor-panel-create.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | CANVAS-02 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "question"` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 1 | CANVAS-03 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "answer"` | ❌ W0 | ⬜ pending |
| 39-01-03 | 01 | 1 | CANVAS-02 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "anchor"` | ❌ W0 | ⬜ pending |
| 39-01-04 | 01 | 1 | CANVAS-05 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "no canvas"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/editor-panel-create.test.ts` — stubs for CANVAS-02, CANVAS-03, disabled state
- Existing test infrastructure (vitest, obsidian mock) sufficient — no new framework install needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual button appearance matches UI-SPEC | CANVAS-02, CANVAS-03 | CSS styling requires visual inspection | Open plugin, check toolbar buttons have correct icons, labels, and accent color |
| Toolbar persists across idle/form states | CANVAS-02 | DOM re-render timing is fragile to unit test | Click node, verify toolbar stays visible; switch canvas, verify toolbar stays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
