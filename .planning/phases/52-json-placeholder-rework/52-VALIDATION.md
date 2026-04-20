---
phase: 52
slug: json-placeholder-rework
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-20
updated: 2026-04-20
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/snippet-service-validation.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts src/__tests__/views/runner-snippet-picker.test.ts` |
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

> Populated by `gsd-planner` during plan authoring (2026-04-20).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 1 | PHLD-01 SC 1 | T-52-01 | textContent only; fixtures updated | unit | `npx vitest run src/__tests__/snippet-model.test.ts` | ✅ | ✅ pass (Plan 01 commit) |
| 52-01-02 | 01 | 1 | PHLD-01 SC 4 | T-52-01 | fixtures declare validationError | unit | `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts` | ✅ | ✅ pass (Plan 01 commit) |
| 52-01-03 | 01 | 1 | PHLD-01 SC 4 | T-52-01, T-52-04 | validatePlaceholders contract | integration (RED→GREEN via Wave 2) | `npx vitest run src/__tests__/snippet-service-validation.test.ts` | ✅ | ✅ pass (Wave 2 flipped) |
| 52-01-04 | 01 | 1 | PHLD-01 SC 3 | T-52-01 | checkbox-only render + separator | integration (RED→GREEN via Wave 3) | `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` | ✅ | ✅ pass (Wave 3 flipped) |
| 52-01-05 | 01 | 1 | PHLD-01 SC 2 + SC 4 | T-52-01, T-52-03, T-52-09 | options-list regression + banner textContent | integration (mixed RED/GREEN) | `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts` | ✅ | ✅ pass (Waves 3+4 flipped) |
| 52-02-01 | 02 | 2 | PHLD-01 SC 1 | T-52-04 | union narrowed; validatePlaceholders typed with `unknown` | unit (GREEN flip) | `npx vitest run src/__tests__/snippet-model.test.ts && npx tsc --noEmit --skipLibCheck` | ✅ | ✅ pass (Plan 02 commit) |
| 52-02-02 | 02 | 2 | PHLD-01 SC 4 | T-52-06 | sanitizeJson uses `separator`; no joinSeparator survives | integration (GREEN flip) | `npx vitest run src/__tests__/snippet-service-validation.test.ts` | ✅ | ✅ pass (Plan 02 commit) |
| 52-03-01 | 03 | 3 | PHLD-01 SC 1 + SC 2 | T-52-07 | PH_COLOR narrowed; separator input bound to ph.separator | integration (GREEN flip) | `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts` | ✅ | ✅ pass (Plan 03 commit) |
| 52-03-02 | 03 | 3 | PHLD-01 SC 3 | T-52-08 | renderField 2-branch dispatch; checkbox-only | integration (GREEN flip) | `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` | ✅ | ✅ pass (Plan 03 commit) |
| 52-04-01 | 04 | 4 | PHLD-01 SC 4 | T-52-09, T-52-12 | banner via textContent; disabled save; grayed content | integration + build (GREEN flip) | `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts && npm run build` | ✅ | ✅ pass (Plan 04 commit 794a922) |
| 52-04-02 | 04 | 4 | PHLD-01 SC 4 | T-52-10 | Runner guard inserted between null-check and md-kind; Phase 51 D-14 preserved | integration (GREEN flip + new) | `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts && npm test` | ✅ | ✅ pass (Plan 04 commit 611f4ff) |
| 52-05-01 | 05 | 5 | PHLD-01 all SCs | T-52-13 | static audits + full suite gate | end-to-end | `npm test && npm run build && npx tsc --noEmit --skipLibCheck` | n/a | ✅ pass (642 PASS / 0 FAIL / 1 SKIP — 2026-04-20) |
| 52-05-02 | 05 | 5 | PHLD-01 SC 2 + SC 4 | — | dev-vault UAT 5 scenarios | manual UAT | (human UAT) | n/a | ⬜ pending (Task 02) |
| 52-05-03 | 05 | 5 | PHLD-01 | — | rollup + STATE/ROADMAP/REQUIREMENTS flip | doc-only | `git log -1 --oneline && git status` | n/a | ⬜ pending (Task 03) |

---

## Wave 0 Requirements

**New test files (MUST be created in Plan 01 before any Wave-1 logic changes):**

- [ ] `src/__tests__/snippet-service-validation.test.ts` — D-03 integration coverage: `SnippetService.load`/`listFolder` return `validationError: string` for `.json` with `type ∈ {'number', 'multichoice', 'multi-choice'}` and for `choice` without valid `options`; `validationError: null` for valid snippets.
- [ ] `src/__tests__/views/snippet-chip-editor.test.ts` — SC 2 regression suite: options-list add / edit / reorder / remove roundtrip; confirm D-08 bug non-reproducible OR (if reproduced in dev-UAT) locks repro scenario.
- [ ] `src/__tests__/views/snippet-fill-in-modal.test.ts` — D-05/D-06/D-09 coverage: unified `choice` renders as multi-select; 0 checked → `''`; single → verbatim; ≥2 → joined by `separator`; Custom non-empty overrides.
- [ ] `src/__tests__/views/snippet-editor-modal-banner.test.ts` — D-04 banner: when `snippet.validationError !== null`, banner renders + save disabled + form read-only.

**Test-fixture updates (Plan 01):**
- [ ] `src/__tests__/snippet-model.test.ts` — remove `'number'`, `'multi-choice'` literal fixtures; add `separator` field cases; add `validationError: null` to every SnippetFile/JsonSnippet fixture.
- [ ] `src/__tests__/views/runner-snippet-picker.test.ts` — `fakeSnippet` fixtures (at :316 and :479 per RESEARCH) need `validationError: null`; add new `fakeBrokenSnippet` fixture used by Plan 04 Task 02 tests.

**Framework install:** None — vitest already in deps.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions (Plan 05 Task 02 UAT) |
|----------|-------------|------------|-------------------|
| D-08 options-list roundtrip in live Obsidian dev-vault | PHLD-01 SC 2 | Full Obsidian Modal framework + CSS + vault watcher cannot be instantiated in vitest; need user to confirm fix-or-repro. | Scenario 1 in 52-UAT.md |
| Runner error-panel + Notice visual correctness for broken snippet | PHLD-01 SC 4 | Visual/layout check + Notice UX cannot be asserted in jsdom. | Scenario 5 in 52-UAT.md |
| SnippetEditorModal banner visual correctness | PHLD-01 SC 4 | Layout/position/colour match to Phase 50.1 style is visual-only. | Scenario 4 in 52-UAT.md |
| D-05 unified-choice interactive UX | PHLD-01 SC 3 | Live checkbox + Custom override behaviour in the real Modal framework. | Scenario 3 in 52-UAT.md |
| D-02 separator on-disk persistence | PHLD-01 SC 1 | Confirms round-trip from UI → sanitizeJson → file system. | Scenario 2 in 52-UAT.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (mapped above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 new files identified)
- [x] No watch-mode flags (`vitest run`, never `vitest watch` in tasks)
- [x] Feedback latency < 30s for full suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner signed 2026-04-20 — ready for Plan 01 execution.
