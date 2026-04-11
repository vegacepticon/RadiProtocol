---
phase: 24
slug: settings-snippet-node-folder
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-11
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/settings-tab.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1 second (quick), ~10 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/settings-tab.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | SNIPPET-06 | — | N/A | unit | `npx vitest run src/__tests__/settings-tab.test.ts` | ✅ | ✅ green |
| 24-01-02 | 01 | 1 | SNIPPET-06 | — | N/A | compile | `npx tsc --noEmit` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- `src/__tests__/settings-tab.test.ts` — SNIPPET-06 assertion added (line 26–28)
- `src/__tests__/snippet-service.test.ts` — mock fixture auto-fixed (Rule 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Default snippet files folder" label appears in Storage group | SNIPPET-06 | Requires Obsidian plugin runtime — no headless DOM test possible | Open Obsidian settings → RadiProtocol → Storage group → confirm field visible with placeholder "e.g. Templates" |
| `onChange` trims whitespace before storing | SNIPPET-06 | `onChange` callback wired by Obsidian `Setting` builder at runtime | Type "  Templates  " into field → blur → reopen settings → confirm stored value is "Templates" |
| Empty value accepted without error | SNIPPET-06 | Requires full plugin lifecycle with Obsidian vault context | Clear field → close settings → confirm plugin continues working normally |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter — blocked by Obsidian-env manual verifications

**Approval:** approved 2026-04-11

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved (automated) | 0 |
| Escalated to manual-only | 3 |

All 3 gaps require Obsidian plugin runtime — not automatable with vitest. Core SNIPPET-06 default-value behavior is fully covered by existing automated test.
