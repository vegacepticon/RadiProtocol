---
phase: 52
slug: json-placeholder-rework
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/snippet-service-validation.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (targeted quick-run), ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` green
- **Max feedback latency:** 5 seconds (quick), 30 seconds (full)

---

## Per-Task Verification Map

> Filled in by `gsd-planner` per task. Each phase requirement ID (PHLD-01) mapped to at least one task + automated command. Entry template:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 0 | PHLD-01 | — | N/A | wave-0 scaffold | (test files created in Wave 0) | ❌ W0 | ⬜ pending |
| {task-id} | {plan} | {wave} | PHLD-01 | — | {behavior} | unit/integration | `{command}` | ✅/❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

**New test files (MUST be created in Wave 0 before any Wave-1 logic changes):**

- [ ] `src/__tests__/snippet-service-validation.test.ts` — D-03 integration coverage: `SnippetService.load`/`listFolder` return `validationError: string` for `.json` with `type ∈ {'number', 'multichoice', 'multi-choice'}` and for `choice` without valid `options`; `validationError: null` for valid snippets.
- [ ] `src/__tests__/views/snippet-chip-editor.test.ts` — SC 2 regression suite: options-list add / edit / reorder / remove roundtrip; confirm D-08 bug non-reproducible OR (if reproduced in dev-UAT) locks repro scenario.
- [ ] `src/__tests__/views/snippet-fill-in-modal.test.ts` — D-05/D-06/D-09 coverage: unified `choice` renders as multi-select; 0 checked → `''`; single → verbatim; ≥2 → joined by `separator`; Custom non-empty overrides.
- [ ] `src/__tests__/views/snippet-editor-modal-banner.test.ts` *(optional — merge into existing if file exists)* — D-04 banner: when `snippet.validationError !== null`, banner renders + save disabled + form read-only.

**Test-fixture updates (Wave 0):**
- [ ] `src/__tests__/snippet-model.test.ts` — remove `'number'`, `'multi-choice'` literal fixtures; add `separator` field cases.
- [ ] `src/__tests__/views/runner-snippet-picker.test.ts` — `fakeSnippet` fixtures at `:316` and `:479` need `validationError: null`; add new branch for `validationError: 'error-msg'`.
- [ ] Any other test that imports `JsonSnippet` — grep after Wave 1 type-narrow to catch missed call sites.

**Framework install:** None — vitest already in deps.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-08 bug reproduction in live Obsidian dev-vault | PHLD-01 SC 2 | Full Obsidian Modal framework + CSS + vault watcher cannot be instantiated in vitest; need user to confirm fix-or-repro. | 1. `npm run dev`; 2. Open dev vault; 3. Create/open `.json` snippet with `type: 'choice'`; 4. Click **+ Add option**; 5. Type text; 6. Move to next row; 7. Reorder (if UI supports); 8. Remove row; 9. Save; 10. Re-open file; confirm all operations persisted. Record verdict in UAT. |
| Runner error-panel visual correctness for broken snippet | PHLD-01 SC 4 | Visual/layout check cannot be asserted in jsdom. | Load canvas with SnippetNode pointing at broken `.json`; run protocol; confirm red error-panel shows placeholder type name, file path, node id, and matches Phase 50.1 / 51 D-04 visual style. |
| SnippetEditorModal banner visual correctness | PHLD-01 SC 4 | Layout/position/colour match to Phase 50.1 style is visual-only. | Open broken `.json` via manager; confirm banner above form; Save button disabled; chip-editor visually grayed out; banner text matches D-04 Russian copy. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest watch` in tasks)
- [ ] Feedback latency < 30s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills Per-Task map

**Approval:** pending
