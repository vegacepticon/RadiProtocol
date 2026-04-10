---
phase: 5
slug: dynamic-snippets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | SNIP-01 | — | N/A | unit | `npx vitest run src/__tests__/snippet-service.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | SNIP-02 | — | N/A | unit | `npx vitest run src/__tests__/snippet-model.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | SNIP-07 | — | N/A | unit | `npx vitest run src/__tests__/write-mutex.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 0 | SNIP-08 | — | N/A | unit | `npx vitest run src/__tests__/vault-utils.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | SNIP-01 | T-5-01 | Input sanitized before JSON serialization | unit | `npx vitest run src/__tests__/snippet-service.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | SNIP-02 | — | N/A | unit | `npx vitest run src/__tests__/snippet-model.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | SNIP-07 | T-5-02 | WriteMutex serializes concurrent writes | unit | `npx vitest run src/__tests__/write-mutex.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | SNIP-08 | — | N/A | unit | `npx vitest run src/__tests__/vault-utils.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | SNIP-03 | — | N/A | manual | — | — | ⬜ pending |
| 5-04-02 | 04 | 2 | SNIP-04 | — | N/A | manual | — | — | ⬜ pending |
| 5-04-03 | 04 | 2 | SNIP-05 | — | N/A | manual | — | — | ⬜ pending |
| 5-04-04 | 04 | 2 | SNIP-06 | — | N/A | manual | — | — | ⬜ pending |
| 5-04-05 | 04 | 2 | SNIP-09 | — | N/A | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/snippet-model.test.ts` — stubs for SNIP-01 (interface shape), SNIP-02 (`renderSnippet` with all 4 placeholder types)
- [ ] `src/__tests__/snippet-service.test.ts` — stubs for SNIP-01 CRUD operations (vault adapter mock required)
- [ ] `src/__tests__/write-mutex.test.ts` — stubs for SNIP-07 (concurrent writes, serialization guarantee)
- [ ] `src/__tests__/vault-utils.test.ts` — stubs for SNIP-08 (`ensureFolderPath` idempotency)

Note: `src/__mocks__/obsidian.ts` may need `titleEl` added for `SnippetFillInModal` tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Label shown to user; id never rendered | SNIP-03 | UI string rendering | Open snippet fill-in modal; verify placeholder label (not id) appears as field label |
| Tab navigation between fields | SNIP-04 | Keyboard UX | Open modal with 2+ fields; press Tab; verify focus moves to next field |
| Live preview updates on input | SNIP-05 | Real-time DOM update | Type in a placeholder field; verify preview text updates immediately |
| Runner transitions to awaiting-snippet-fill | SNIP-06 | Full plugin lifecycle | Run a protocol with a TextBlockNode+snippetId; verify modal opens |
| Custom free-text clears radio/checkbox | SNIP-09 | Interaction behavior | Select a choice option then type in free-text field; verify choice deselects |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
