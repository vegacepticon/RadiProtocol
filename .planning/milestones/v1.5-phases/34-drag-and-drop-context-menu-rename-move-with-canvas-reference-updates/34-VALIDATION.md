---
phase: 34
slug: drag-and-drop-context-menu-rename-move-with-canvas-reference-updates
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for test mapping: `34-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` (project root — existing) |
| **Quick run command** | `npx vitest run src/__tests__/snippet-service-move.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (quick) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` clean + human UAT in real Obsidian vault
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

See `34-RESEARCH.md` § Phase Requirements → Test Map (lines 618–636) for the authoritative mapping. Planner MUST copy each row into the corresponding `<automated>` block of each task in PLAN.md.

| Req ID | Test Type | Wave 0 File | Status |
|---|---|---|---|
| MOVE-01 | unit | `snippet-service-move.test.ts` | ⬜ pending |
| MOVE-02 | unit | `snippet-service-move.test.ts` | ⬜ pending |
| MOVE-03 | integration | `snippet-tree-dnd.test.ts` | ⬜ pending |
| MOVE-04 | regression (existing) | `snippet-editor-modal.test.ts` | ✅ green (Phase 33) |
| MOVE-05 | integration | `snippet-service-move.test.ts` | ⬜ pending |
| RENAME-01 | unit (DOM) | `snippet-tree-inline-rename.test.ts` | ⬜ pending |
| RENAME-02 | unit (DOM) | `snippet-tree-inline-rename.test.ts` | ⬜ pending |
| RENAME-03 | integration | `snippet-service-move.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/snippet-service-move.test.ts` — NEW (MOVE-01/02/05, RENAME-03, collision, self-descendant, canvas sync fan-out)
- [ ] `src/__tests__/snippet-tree-dnd.test.ts` — NEW (DnD MIME acceptance, dragover.preventDefault guards, drop highlight classes, Move to… menu flow)
- [ ] `src/__tests__/snippet-tree-inline-rename.test.ts` — NEW (F2 entry, Enter commit, Escape cancel, settled race guard, file + folder rows)

*No framework install needed — vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native HTML5 drag visuals (drag image, cursor) | MOVE-01/02 | Headless DOM has no real drag rendering | Drag a file row onto another folder in a real Obsidian vault; observe drag image and `drag-over` highlight |
| Folder-move canvas-ref round-trip | MOVE-05 / RENAME-03 | Canvas runner is end-to-end | Create a `.canvas` referencing a snippet folder, rename that folder via F2, then open the canvas in the runner — snippet must still resolve |
| Obsidian reload survives moves | Success Criterion 5 | Persistence across process restart | Move + rename across nested subfolders, restart Obsidian, verify content byte-equal and tree intact |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after planner pass

**Approval:** pending
