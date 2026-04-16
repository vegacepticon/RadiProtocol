---
phase: 33
slug: tree-ui-modal-create-edit-folder-operations-vault-watcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

(Populated by planner from PLAN.md tasks — see RESEARCH.md "Validation Architecture".)

---

## Wave 0 Requirements

- [ ] `tests/snippet-tree-view.test.ts` — stubs for TREE-01..04
- [ ] `tests/snippet-editor-modal.test.ts` — stubs for MODAL-01..08
- [ ] Extend `tests/snippet-service.test.ts` — createFolder/deleteFolder/listFolderDescendants (FOLDER-01/02)
- [ ] `tests/snippet-vault-watcher.test.ts` — stubs for SYNC-01..03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context menu visual + three-button order | MODAL-07, FOLDER-02 | Obsidian Menu renders via native UI | Open vault, right-click folder, verify "New subfolder" / "Delete folder"; trigger unsaved-guard and verify Save/Discard/Cancel order |
| Vault watcher across external rename | SYNC-01..03 | Requires external file change outside plugin | Rename file in Obsidian file explorer, confirm tree redraw |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
