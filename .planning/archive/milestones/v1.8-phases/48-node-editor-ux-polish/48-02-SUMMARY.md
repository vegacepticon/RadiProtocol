---
phase: 48-node-editor-ux-polish
plan: "02"
subsystem: editor-panel
tags: [editor-panel, css, layout, toolbar, tdd]
dependency_graph:
  requires: [48-01]
  provides: [NODEUI-05]
  affects:
    - src/views/editor-panel-view.ts
    - src/styles/editor-panel.css
    - styles.css
    - src/styles.css
    - src/__tests__/editor-panel-forms.test.ts
tech_stack:
  added: []
  patterns:
    - CSS cascade override (append-only Phase 48 block wins over Phase 39 + 42 Plan 04 same-specificity rules)
    - margin-top auto on flex-column child for bottom-anchoring (reused from NODEUI-05 research)
    - DOM sentinel (__TOOLBAR__) injection for call-order unit testing
key_files:
  created: []
  modified:
    - src/__tests__/editor-panel-forms.test.ts
    - src/views/editor-panel-view.ts
    - src/styles/editor-panel.css
    - styles.css
    - src/styles.css
decisions:
  - "Removed 3 unused @ts-expect-error directives from test file — TypeScript 6 bracket-access (view['method']()) resolves to any and does not trigger private-access errors; keeping them caused tsc -noEmit to fail"
  - "Phase 48 CSS appended strictly at EOF of editor-panel.css via cascade override — Phase 39 flex-direction:row and Phase 42 Plan 04 flex-wrap:wrap rules preserved byte-for-byte; Phase 48 block wins by source order at equal specificity"
metrics:
  duration: "~4m"
  completed: "2026-04-19"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 5
  tests_before: 435
  tests_after: 438
---

# Phase 48 Plan 02: Toolbar CSS Bottom-Stack Summary

One-liner: Moved renderToolbar call-sites to end of renderIdle/renderForm and appended Phase 48 CSS to flip the quick-create toolbar from a top row to a bottom-anchored full-width vertical column.

## Status

**PARTIAL — stopped at checkpoint:human-verify (Task 3)**

Tasks 1 and 2 are complete and committed. Task 3 is the human UAT checkpoint — awaiting visual verification in TEST-BASE vault.

## What Was Built

### Task 1 — NODEUI-05 RED assertions (TDD RED gate)

Three new `it(...)` blocks appended to `src/__tests__/editor-panel-forms.test.ts`:

1. `renderIdle: toolbar is invoked AFTER the idle container <p> elements` — injects a `__TOOLBAR__` sentinel by overriding `renderToolbar`, calls `renderIdle()`, asserts sentinel index > `rp-editor-idle` div index in `createdElements`.
2. `renderForm: toolbar is invoked AFTER the .rp-editor-panel container` — same sentinel approach for `renderForm({}, null)`, asserts sentinel after `rp-editor-panel` div.
3. CSS file-parse assertion — reads `src/styles/editor-panel.css` via `fs.readFileSync`, asserts `/* Phase 48` marker present and `flex-direction: column`, `margin-top: auto`, `flex-wrap: nowrap` all in the Phase 48 region.

Also added `import * as fs from 'fs'` and `import * as path from 'path'` at top of the file (required by CSS-parse test).

Confirmed RED: 3 new assertions failing, 7 Plan 01 assertions green.

### Task 2 — Implementation (TDD GREEN gate)

**`src/views/editor-panel-view.ts` — two call-site moves:**

- `renderIdle`: removed `this.renderToolbar(this.contentEl)` from line 2 (after `empty()`); appended it as the last statement with `// Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).` comment.
- `renderForm`: removed `this.renderToolbar(this.contentEl)` from line 3 (after `empty()`); appended it after `indicatorRow.removeClass('is-visible')` with the same Phase 48 comment.
- No other code in either function was modified.

**`src/styles/editor-panel.css` — two Phase 48 blocks appended at EOF:**

Block A (`/* Phase 48 NODEUI-04: Question textarea custom layout */`):
- `.rp-question-block` — padding + border-top to match Setting row visual rhythm
- `.rp-question-block .rp-field-label` — font-size + font-weight
- `.rp-question-block .rp-field-desc` — muted color + font-size
- `.rp-question-textarea` — width:100%, min-height:80px, box-sizing:border-box, resize:vertical

Block B (`/* Phase 48 NODEUI-05: anchor create toolbar at bottom of panel, vertical column */`):
- `.rp-editor-create-toolbar` — flex-direction:column, flex-wrap:nowrap, margin-top:auto, width:100%, border-bottom:none, border-top, padding-top
- `.rp-editor-create-toolbar > button` — width:100%, justify-content:center

All 198 lines preceding the Phase 48 blocks are byte-identical (confirmed by `git diff` showing additions-only at EOF).

**`npm run build`** — tsc + esbuild ran cleanly; `styles.css` (root) and `src/styles.css` both regenerated and contain `Phase 48 NODEUI-05`.

**Deviation: removed 3 unused @ts-expect-error directives** (Rule 3 — blocking build fix):
- `view['pendingEdits']` in NODEUI-01 test (line 155 old numbering)
- `view['renderIdle']()` in new NODEUI-05 test
- `view['renderForm']({}, null)` in new NODEUI-05 test

In TypeScript 6, bracket-access on a typed object resolves to `any`, so private-access errors don't fire; the directives were unused and caused `tsc -noEmit` to error. Removing them is a correctness fix, not a behavior change.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b1942a6 | test(48-02) | Add NODEUI-05 DOM-order + CSS-file-parse assertions (RED) |
| 33d59ef | feat(48-02) | Anchor create toolbar at bottom as vertical column (NODEUI-05) |

## Test Count Delta

| Metric | Value |
|--------|-------|
| Tests before Plan 02 | 435 passed, 1 skipped |
| Tests after Plan 02 | 438 passed, 1 skipped |
| New tests added | 3 (NODEUI-05 DOM-order × 2, CSS-file-parse × 1) |

## Changed Files

| File | Change |
|------|--------|
| `src/__tests__/editor-panel-forms.test.ts` | MODIFIED — 3 NODEUI-05 `it(...)` blocks + fs/path imports appended; 3 unused @ts-expect-error removed |
| `src/views/editor-panel-view.ts` | MODIFIED — renderToolbar call-site moved to bottom in renderIdle + renderForm |
| `src/styles/editor-panel.css` | MODIFIED — Phase 48 NODEUI-04 + NODEUI-05 blocks appended at EOF (additions only) |
| `styles.css` | REGENERATED — npm run build; contains Phase 48 NODEUI-05 marker |
| `src/styles.css` | REGENERATED — npm run build; contains Phase 48 NODEUI-05 marker |

## CSS Append-Only Verification

```
git diff src/styles/editor-panel.css
```
Output: `+` lines only starting at line 196 (after the closing `}` of Phase 45 `.rp-create-loop-btn:disabled`). Zero deletions, zero edits to any existing line. T-48-05 threat mitigated.

## DO-NOT-TOUCH Files — Scope Fence Verification

```
git diff -- src/graph/canvas-parser.ts src/runner/protocol-runner.ts src/graph/graph-model.ts
```
Output: empty (byte-identical). Plan 01 scope fence still holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused @ts-expect-error directives (build-blocking)**
- **Found during:** Task 2 — `npm run build` ran `tsc -noEmit -skipLibCheck` which reported 3 TS2578 errors ("Unused @ts-expect-error directive")
- **Issue:** TypeScript 6 resolves bracket-indexed access (`view['method']()`) to `any`, so private-access suppression directives are unused. `tsc -noEmit` fails on unused directives.
- **Fix:** Removed the 3 directives. No behavior change — tests still pass and access the private methods correctly via bracket notation.
- **Files modified:** `src/__tests__/editor-panel-forms.test.ts`
- **Commit:** 33d59ef (included in the same Task 2 commit)

## TDD Gate Compliance

1. RED gate: `test(48-02)` commit b1942a6 — 3 NODEUI-05 assertions failing
2. GREEN gate: `feat(48-02)` commit 33d59ef — all 3 assertions now passing
3. REFACTOR gate: Not needed

## UAT Checklist (Task 3 — Pending Human Verification)

The following 10-step UAT in TEST-BASE vault is pending:

- [ ] NODEUI-05: Idle state toolbar is a vertical full-width stack at the bottom
- [ ] NODEUI-05: Form state toolbar stays at bottom below form fields
- [ ] NODEUI-05: Narrow sidebar (~300px) — buttons stack vertically, no wrap
- [ ] NODEUI-01: Text-block node has no "Snippet ID (optional)" input
- [ ] NODEUI-01: Old canvases with snippetId still load correctly
- [ ] NODEUI-03: Answer node shows Display label ABOVE Answer text
- [ ] NODEUI-04: Question textarea label + helper above textarea; full-width
- [ ] NODEUI-04: Typing grows textarea; content persists after click-away and reopen
- [ ] NODEUI-02: Quick-create places new nodes directly BELOW anchor node
- [ ] Regression: Previously-working protocol runs without regressions

## Known Stubs

None — all implementation is complete. CSS and DOM order fully wired. UAT pending only for visual confirmation.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

Files exist:
- src/__tests__/editor-panel-forms.test.ts — FOUND (contains `__TOOLBAR__`, `rp-editor-idle`, `rp-editor-panel`, `Phase 48`)
- src/views/editor-panel-view.ts — FOUND (contains `Phase 48 NODEUI-05: toolbar moved to bottom` ×2)
- src/styles/editor-panel.css — FOUND (contains `Phase 48 NODEUI-04` and `Phase 48 NODEUI-05`)
- styles.css — FOUND (contains `Phase 48 NODEUI-05`)
- src/styles.css — FOUND (contains `Phase 48 NODEUI-05`)

Commits exist:
- b1942a6 — FOUND (test RED)
- 33d59ef — FOUND (feat NODEUI-05 GREEN)

Full suite: 438 passed, 1 skipped (≥435 post-Plan-01 baseline — PASSED)
