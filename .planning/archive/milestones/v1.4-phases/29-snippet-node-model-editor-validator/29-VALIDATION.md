---
phase: 29
slug: snippet-node-model-editor-validator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- canvas-parser` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- canvas-parser`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | SNIPPET-NODE-01 | — | N/A | unit | `npm test -- canvas-parser` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | SNIPPET-NODE-01 | — | N/A | unit | `npm test -- canvas-parser` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | SNIPPET-NODE-08 | — | N/A | unit | `npm test -- graph-validator` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 2 | SNIPPET-NODE-02 | — | Subfolder path limited to vault.adapter.list() results — no direct user path input | unit/manual | `npm test -- editor-panel` | ⚠️ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/fixtures/snippet-node.canvas` — snippet node fixture with `radiprotocol_subfolderPath`
- [ ] `src/__tests__/fixtures/snippet-node-no-path.canvas` — snippet node fixture without path (D-12 / SNIPPET-NODE-08 superseded)
- [ ] New `it()` cases in `canvas-parser.test.ts` — parsing snippet kind with and without subfolderPath
- [ ] New `it()` cases in `graph-validator.test.ts` — snippet node without subfolderPath generates no errors

*Existing test infrastructure (Vitest) covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EditorPanel shows subfolder dropdown populated from vault | SNIPPET-NODE-02 | Requires live Obsidian vault with .radiprotocol/snippets/ subfolders | Open a canvas with snippet node → open EditorPanel → verify dropdown lists real subfolders |
| Saving snippet node writes canvas JSON correctly | SNIPPET-NODE-02 | Requires live Obsidian canvas file mutation | Select subfolder → save → inspect canvas JSON for `radiprotocol_nodeType: "snippet"` and `radiprotocol_subfolderPath` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
