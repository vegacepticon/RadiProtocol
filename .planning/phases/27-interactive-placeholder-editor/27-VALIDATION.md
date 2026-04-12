---
phase: 27-interactive-placeholder-editor
slug: interactive-placeholder-editor
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-12
---

# Phase 27 — Validation Strategy

> Per-phase validation contract. Reconstructed from artifacts (State B) on 2026-04-12.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/chip-dnd-logic.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/chip-dnd-logic.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | CHIP-01 (chip CSS) | — | N/A | manual | — | ✅ src/styles.css | ✅ green |
| 27-01-02 | 01 | 1 | CHIP-02 (DnD splice + auto-save) | T-27-01 | Reject out-of-range / NaN / same-slot indices | unit | `npx vitest run src/__tests__/chip-dnd-logic.test.ts` | ✅ | ✅ green |
| 27-01-02 | 01 | 1 | CHIP-03 (tab order via persisted array) | — | N/A | manual | — | — | ✅ green (UAT) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all automatable phase requirements.
`src/__tests__/chip-dnd-logic.test.ts` added in Nyquist validation audit (2026-04-12).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chip renders with coloured left bar, label (not raw `{{id}}`), type badge, drag handle, remove button | CHIP-01 | DOM rendering and CSS custom-property colours require live Obsidian instance | Open a snippet with placeholders in SnippetManagerView; verify chip layout visually |
| Click-to-expand guard: handle and remove button do not trigger expand | CHIP-01 | DOM click-target routing requires browser event execution | Click ⠿ handle → no expand; click × → no expand; click chip body → expands |
| DnD reorder persists across snippet navigation | CHIP-02 | HTML5 DnD interaction + vault file persistence require live Obsidian | Drag chip, navigate away, navigate back; confirm order persisted |
| `Notice('Snippet saved.')` fires after drop | CHIP-02 | Obsidian Notice system requires Obsidian runtime | Drag any chip; confirm toast appears |
| Colour bars visually distinct per type (cyan/orange/purple/green) | CHIP-01 | CSS var rendering requires visual inspection inside Obsidian | Create 4 placeholder types; verify left-bar colours |
| SnippetFillInModal tab order follows persisted placeholder array order | CHIP-03 | Requires live Obsidian runtime + running modal | Reorder chips; run snippet; confirm FillInModal field order matches chip order |

---

## Validation Audit 2026-04-12

| Metric | Count |
|--------|-------|
| Gaps found | 2 (CHIP-02 guards/splice, WR-03 UUID regex) |
| Resolved | 2 (25 unit tests added — all green) |
| Escalated to manual-only | 6 (DOM rendering, DnD E2E, Notice, colour bars, tab order, click-expand guard) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only justification
- [x] Sampling continuity: chip-dnd-logic.test.ts covers CHIP-02 algorithmic core
- [x] Wave 0 not needed — existing vitest infrastructure used
- [x] No watch-mode flags
- [x] Feedback latency ~1s
- [ ] `nyquist_compliant: true` — blocked by 6 manual-only items requiring live Obsidian runtime

**Approval:** partial — 2026-04-12 (automatable gaps resolved; manual items are Obsidian-runtime-bound)
