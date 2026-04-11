---
phase: 21
slug: color-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=dot`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 0 | COLOR-01, COLOR-03 | — | N/A | unit | `npm test -- --reporter=dot node-color-map` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 0 | COLOR-02 | — | N/A | unit | `npm test -- --reporter=dot canvas-write-back` | ✅ existing | ⬜ pending |
| 21-01-03 | 01 | 0 | COLOR-04 | — | N/A | unit | `npm test -- --reporter=dot canvas-live-editor` | ✅ existing | ⬜ pending |
| 21-02-01 | 02 | 1 | COLOR-01 | — | Palette strings are constants, not user input | unit | `npm test -- --reporter=dot node-color-map` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | COLOR-02 | — | N/A | unit | `npm test -- --reporter=dot canvas-write-back` | ✅ existing | ⬜ pending |
| 21-03-01 | 03 | 2 | COLOR-04 | — | N/A | unit | `npm test -- --reporter=dot canvas-live-editor` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/node-color-map.test.ts` — stubs/tests for COLOR-01 (assign path), COLOR-03 (7-type mapping)
- [ ] New test case in `src/__tests__/canvas-write-back.test.ts` — covers COLOR-02 (unmark clears color)
- [ ] Update `src/__tests__/canvas-live-editor.test.ts` line 57 — invert color PROTECTED_FIELDS assertion (color is no longer protected)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time color change visible in Obsidian canvas on type assignment | COLOR-01, COLOR-04 | Requires live Obsidian canvas rendering | 1. Open canvas, 2. Open Node Editor for a node, 3. Assign a type, 4. Confirm canvas node color changes immediately |
| Removing type clears color visually on canvas | COLOR-02 | Requires live Obsidian canvas rendering | 1. Select a typed node, 2. Open Node Editor, 3. Remove type, 4. Confirm node reverts to default canvas color |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
