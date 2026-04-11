---
phase: 23
slug: node-editor-auto-save-and-color-on-type-change
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
audited: 2026-04-11
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/editor-panel.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/editor-panel.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | AUTOSAVE-01 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-02 | 01 | 1 | AUTOSAVE-01 | — | snapshot captures at schedule time, not fire time | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-03 | 01 | 1 | AUTOSAVE-02 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-04 | 01 | 1 | AUTOSAVE-03 | — | flush fires for first node before switching to second | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-05 | 01 | 1 | AUTOSAVE-03 | — | flush save failure does not block node switch | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-06 | 01 | 1 | AUTOSAVE-04 | — | N/A | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-07 | 01 | 1 | AUTOSAVE-04 | — | Notice mock not called on auto-save | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend) | ✅ green |
| 23-01-08 | 01 | 1 | — (D-05) | — | N/A | static (compile) | `npx tsc --noEmit` | ✅ confirmed by build | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/__tests__/editor-panel.test.ts` — `describe('auto-save behaviour', ...)` block added and all 7 tests green (Plan 01 + Plan 02).

*Existing infrastructure covers test runner and mock setup — test cases implemented and passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Saved ✓" indicator fades out visually after ~2 seconds | AUTOSAVE-04 | CSS opacity transition is visual-only | Load a canvas node, edit a field, wait 1s, confirm "Saved ✓" appears then fades |
| Canvas node colour updates in real-time on type change | AUTOSAVE-02 | Obsidian canvas renderer is not unit-testable | Switch node type in dropdown, observe canvas node colour change in the canvas view |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-11

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests passing | 14/14 |
| Manual-only | 2 |
