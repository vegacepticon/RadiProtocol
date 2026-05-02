---
phase: 77
slug: eslint-findings-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build && npm test` |
| **Estimated runtime** | ~30s lint, ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` (must show finding count strictly decreasing or unchanged)
- **After every plan wave:** Run `npm run build && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run lint` must exit 0
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Populated by gsd-planner during step 8. Each plan task must have an `<automated>` block citing one of:
- `npm run lint -- <file>` — focused lint
- `npm run lint` — full lint baseline
- `npm run build` — esbuild + tsc gate
- `npm test -- <file>` — focused vitest
- `npm test` — full vitest suite

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (vitest + eslint already configured).
- Wave 1 will modify `eslint.config.mjs` (D-01/D-02) — this resets the lint baseline to ~75 src-only findings before stage-2/3 begin.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual regression after CSS class migration | LINT-01 SC#2 | CSS rules must produce equivalent visual outcome to inline styles; no automated visual snapshot in project | Open Obsidian, exercise: snippet manager (rename input show/hide), inline runner (drag/resize), runner preview (auto-grow), editor panel (auto-grow). Verify no visual diffs vs pre-Phase-77 behavior. |
| `prefer-file-manager-trash-file` semantic equivalence | LINT-01 SC#5 | Trash semantics differ between `vault.delete()` (vault-relative trash) and `app.fileManager.trashFile()` (system-honoring trash) | If fix applied: delete a generated file, verify it lands where the user's Obsidian "Files & Links → Deleted Files" setting says it should. If documented out-of-scope: VERIFICATION.md lists rationale. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
