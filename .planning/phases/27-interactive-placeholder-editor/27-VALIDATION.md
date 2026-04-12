---
phase: 27
slug: interactive-placeholder-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual / DOM inspection (Obsidian plugin — no automated test runner wired) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` + manual smoke test in Obsidian
- **Before `/gsd-verify-work`:** TypeScript clean + all 3 success criteria verified manually
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | CHIP-01 | — | N/A | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 27-01-02 | 01 | 1 | CHIP-01 | — | N/A | manual | Open snippet → chips visible, no `{{syntax}}` raw text | N/A | ⬜ pending |
| 27-02-01 | 02 | 2 | CHIP-02 | — | N/A | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 27-02-02 | 02 | 2 | CHIP-02 | — | N/A | manual | Drag chip → visual reorder updates immediately | N/A | ⬜ pending |
| 27-03-01 | 03 | 2 | CHIP-03 | — | N/A | manual | Reorder chips → open SnippetFillInModal → fields in new order, tab follows sequence | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

*TypeScript type-check (`npx tsc --noEmit`) is the only automated gate. All user-facing behaviour requires manual verification in Obsidian.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chips render with coloured left bar, label, type badge, [×], drag handle | CHIP-01 | Obsidian plugin DOM — no headless renderer | Open snippet in Snippet Editor; verify each placeholder shows as chip without raw `{{...}}` text |
| Drag reorders chips immediately | CHIP-02 | Requires interactive DnD in Electron | Drag chip to new position; verify list updates on drop |
| SnippetFillInModal tab order follows reordered chips | CHIP-03 | Requires UI interaction | Reorder chips, save, open SnippetFillInModal, tab through fields and verify sequence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
