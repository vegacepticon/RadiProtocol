---
phase: 35
slug: markdown-snippets-in-protocol-runner
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (project standard) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- src/__tests__/runner-extensions.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/__tests__/runner-extensions.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (excluding 3 pre-existing failures on phase-26 branch carry-over, documented in CONTEXT.md)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 0 | MD-01..MD-04 | — | N/A | fixture | `ls src/__tests__/fixtures/snippets/*.md` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | MD-01 | — | Picker rendering | unit | `npm test -- runner-extensions -t "md picker row"` | ❌ W0 | ⬜ pending |
| 35-01-03 | 01 | 1 | MD-02 | — | Verbatim insert no modal | unit | `npm test -- runner-extensions -t "md click completes"` | ❌ W0 | ⬜ pending |
| 35-01-04 | 01 | 1 | MD-03 | — | Drill-down MD | unit | `npm test -- runner-extensions -t "md drill-down"` | ❌ W0 | ⬜ pending |
| 35-01-05 | 01 | 1 | MD-04 | — | Branch-entered picker + MD | unit | `npm test -- runner-extensions -t "mixed branch md"` | ❌ W0 | ⬜ pending |
| 35-01-06 | 01 | 1 | SC-05 (session) | — | Save/resume after MD insert | unit | `npm test -- runner-extensions -t "session md resume"` | ❌ W0 | ⬜ pending |
| 35-01-07 | 01 | 1 | D-06 step-back | — | stepBack reverts MD insertion | unit | `npm test -- runner-extensions -t "step-back md"` | ❌ W0 | ⬜ pending |
| 35-01-08 | 01 | 1 | D-03 empty MD | — | Empty `.md` is valid pick | unit | `npm test -- runner-extensions -t "empty md"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/fixtures/snippets/` — MD fixture files (at least: one plain `.md`, one `.md` in subfolder, one empty `.md`)
- [ ] `src/__tests__/runner-extensions.test.ts` — extended with MD picker test stubs (one per row above)
- [ ] Existing vitest infrastructure — already installed, no new deps

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual prefix rendering (📄 vs 📝) in real Obsidian UI | MD-01 | Emoji font rendering varies by OS — visual check guards UX | Open Runner → trigger snippet-pick node → confirm both icons visible and distinguishable |
| End-to-end drill-down UX during real protocol run | MD-03 | Click feel, subfolder navigation flow | Run a protocol with nested MD snippet → verify step-back reopens at correct folder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (MD fixtures + test stubs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 completes

**Approval:** pending
