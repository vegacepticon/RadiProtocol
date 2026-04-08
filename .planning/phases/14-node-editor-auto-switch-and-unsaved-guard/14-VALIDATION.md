---
phase: 14
slug: node-editor-auto-switch-and-unsaved-guard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | EDITOR-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 0 | EDITOR-02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | EDITOR-01 | — | nodeId from canvas.selection used as lookup key only; missing node handled by renderError() | unit | `npm test` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | EDITOR-02 | — | Modal resolves false (stay) by default; discard only on explicit confirm | unit | `npm test` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 2 | EDITOR-01/02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/node-switch-guard-modal.test.ts` — stubs for EDITOR-01/EDITOR-02: `NodeSwitchGuardModal` importable, `result: Promise<boolean>` property, `onClose` resolves with `false`, `EditorPanelView` imports `NodeSwitchGuardModal`
- [ ] Pattern: mirror `RunnerView.test.ts` and `editor-panel.test.ts` — `vi.mock('obsidian')`, prototype method existence checks, `Promise<boolean>` result verification

*No new test infrastructure needed — Vitest + `vi.mock('obsidian')` pattern is fully established.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clicking canvas node auto-switches editor | EDITOR-01 | DOM event + canvas.selection timing (setTimeout(0) deferral) cannot be fully simulated in Vitest | Open plugin, open EditorPanel, click a canvas node, verify form loads |
| Confirmation prompt appears on dirty switch | EDITOR-02 | Modal interaction requires real Obsidian UI | Open EditorPanel, make an edit, click different node, verify modal appears |
| Staying on current node preserves edits | EDITOR-02 | Modal button click in real Obsidian | In modal, click Stay, verify edits unchanged and node unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
