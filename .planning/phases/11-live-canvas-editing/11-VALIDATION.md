---
phase: 11
slug: live-canvas-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 second (pure module tests, no Obsidian mock overhead) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (4 pre-existing failures in `runner-extensions.test.ts` and `runner-commands.test.ts` are unrelated to Phase 11 — do not introduce new failures)
- **Max feedback latency:** ~1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-W0-01 | Wave 0 | 0 | LIVE-01 | — | N/A | unit stub | `npm test` | ❌ W0 | ⬜ pending |
| 11-W0-02 | Wave 0 | 0 | LIVE-03, LIVE-04 | — | N/A | unit stub | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-01 | 01 | 1 | LIVE-01 | T-11-01 | PROTECTED_FIELDS not mutated by saveLive() | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | LIVE-01 | — | saveLive() returns true when canvas live API present + node found | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | LIVE-01 | — | saveLive() returns false when view.data is not an array | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | LIVE-01 | — | saveLive() returns false when canvas leaf not found | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 1 | LIVE-01 | — | Un-mark: radiprotocol_nodeType='' removes all radiprotocol_* keys from live node | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-01-06 | 01 | 1 | LIVE-01 | — | saveLive() rolls back node mutation if requestSave() throws | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | LIVE-03 | — | saveNodeEdits() calls saveLive() first; vault.modify NOT called when live returns true | unit | `npm test` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | LIVE-04 | — | saveNodeEdits() does NOT show "Close the canvas" Notice when canvas is open | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/canvas-live-editor.test.ts` — stubs for LIVE-01 (pure module, no Obsidian import — vitest resolves cleanly)
- [ ] Update `src/__tests__/canvas-write-back.test.ts` — add LIVE-03/LIVE-04 contract stubs (replace canvas-open guard test)

*No new test infrastructure needed — vitest already configured and running.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-place mutation of `view.data` items persists after `requestSave()` | LIVE-01 (A4 risk) | Cannot mock internal Canvas runtime behavior reliably | Open dev vault, open a canvas, run `saveLive()` via console, verify node text persisted after save |
| `requestSave()` location: `leaf.view` vs `leaf.view.canvas` | LIVE-01 | Runtime-only introspection | In Obsidian console: `app.workspace.getLeavesOfType('canvas')[0].view` — check if `.requestSave` exists directly or only on `.canvas` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
