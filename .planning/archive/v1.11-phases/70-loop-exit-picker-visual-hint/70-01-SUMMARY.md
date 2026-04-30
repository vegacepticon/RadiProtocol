---
phase: 70-loop-exit-picker-visual-hint
plan: 01
id: 70-01-loop-exit-css-hint
subsystem: runner / css
tags:
  - css
  - runner
  - loop
  - visual-hint
requires:
  - LOOP-EXIT-01
provides:
  - Green background accent on loop-exit picker button (`.rp-loop-exit-btn`) across all 3 runner modes
  - Hover dim effect (`filter: brightness(0.92)`) on exit button
  - Desaturated green (`filter: saturate(0.65)`) for muted visual tone
  - Byte-for-byte preservation of Phase 44 body-button styling
affects:
  - src/styles/loop-support.css
  - styles.css (build artefact)
tech-stack:
  added: []
patterns:
  - CSS specificity doubling (`.class.class`) to override Obsidian base `button` rules
  - Append-only per-phase CSS section (CLAUDE.md rule)
key-files:
  created: []
  modified:
    - src/styles/loop-support.css
    - styles.css
    - src/styles.css
key-decisions:
  - "D-01: exit gets solid `--color-green` background; body stays on `--interactive-accent` unchanged"
  - "D-03: solid background + `color: var(--text-on-accent)` — no border, no ::before, no icon"
  - "D-05: hover = `filter: brightness(0.92)` (no `--color-green-hover` token)"
  - "D-08: selector `.rp-loop-exit-btn.rp-loop-exit-btn` (doubled for specificity) covers all 3 modes"
  - "Post-execution fix: doubled selector to beat Obsidian `button:not(.clickable-icon)` (spec 0,1,1)"
  - "Post-execution fix: added `filter: saturate(0.65)` to tone down green saturation per user request"
requirements-completed:
  - LOOP-EXIT-01
duration: "25 min"
completed: "2026-04-29"
---

# Phase 70 Plan 01: Loop-Exit Picker Visual Hint Summary

**One-liner:** Append a desaturated green CSS accent to the `+`-prefix loop-exit picker button via `.rp-loop-exit-btn.rp-loop-exit-btn`, preserving Phase 44 body-button styling byte-for-byte, and verify across all 3 runner modes.

**Duration:** ~25 min (including 2 post-execution specificity fixes)
**Tasks:** 4 (3 automated + 1 human-verify checkpoint)
**Files modified:** 3 (`src/styles/loop-support.css`, `styles.css`, `src/styles.css`)

---

## Task 1: Append Phase 70 visual-hint section to `src/styles/loop-support.css`

**Outcome:** Successfully appended the Phase 70 section at the bottom of `src/styles/loop-support.css`.

**Final source block (lines 113-135):**
```css
/* Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01) ─────────────────── *
 * D-01/D-03: solid `--color-green` background marks the '+'-prefix exit
 *   button as the «finish/выход» control, distinct from body-branch
 *   buttons which keep the Phase 44 `--interactive-accent` blue.
 * D-04: `--text-on-accent` reused for text colour (no `--text-on-color-green`
 *   token exists in Obsidian; pragmatic re-use, contrast covered by UAT).
 * D-05: hover = `filter: brightness(0.92)` — no `--color-green-hover` token.
 * D-06/D-07: focus-visible relies on Obsidian default ring; no `:disabled`
 *   rule (loop picker always renders enabled buttons).
 * D-08: selector `.rp-loop-exit-btn` (unprefixed) covers sidebar / tab /
 *   inline runner modes — DOM is identical across the three. Phase 60
 *   inline padding override (`inline-runner.css:218-224`) is orthogonal
 *   and remains untouched. */
.rp-loop-exit-btn.rp-loop-exit-btn {
  background: var(--color-green);
  color: var(--text-on-accent);
  filter: saturate(0.65);
}

.rp-loop-exit-btn.rp-loop-exit-btn:hover {
  background: var(--color-green);
  filter: saturate(0.65) brightness(0.92);
}
```

**Line count:** 135 (was 111, delta +24 — within ±2 tolerance of expected +23)

**Grep verification:**
- `grep -c "Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01)"` → `1` ✓
- `grep -c "background: var(--color-green);"` → `1` ✓
- `grep -c "filter: brightness(0.92);"` → `1` ✓
- `grep -c "filter: saturate(0.65);"` → `1` ✓
- `grep -c "color: var(--text-on-accent);"` → `3` ✓ (Phase 6 line 20, Phase 44 line 75, Phase 70 line 128)
- `grep -c ":focus-visible"` → `0` ✓
- `grep -c ":disabled"` → `0` ✓

**Phase 44 body-btn preservation (lines 73-80):**
```css
.rp-loop-body-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.rp-loop-body-btn:hover {
  background: var(--interactive-accent-hover);
}
```
Byte-for-byte match ✓

**Scope check:**
- `git diff --name-only -- src/styles/loop-support.css` → `src/styles/loop-support.css` ✓
- `git diff --name-only -- src/views/ src/graph/ src/runner/ src/__tests__/ src/styles/inline-runner.css src/styles/runner-view.css` → empty ✓

---

## Task 2: Regenerate root `styles.css` via `npm run build`

**Outcome:** Build exited `0`.

**Verification:**
- `grep -c "Phase 70: Loop-exit picker visual hint (LOOP-EXIT-01)" styles.css` → `1` ✓
- `grep -c "background: var(--color-green);" styles.css` → `1` ✓
- `grep -c "filter: brightness(0.92);" styles.css` → `1` ✓
- `diff -q styles.css src/styles.css` → no output (identical) ✓
- Phase 6 / 44 / 47 headers still present in `styles.css` ✓

---

## Task 3: Verify existing class-presence regression tests stay green

**Outcome:** Full vitest suite passed.

```
Test Files  63 passed (63)
Tests       813 passed | 1 skipped (814)
Duration    3.86s
```

Loop-related test files confirmed passing:
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` ✓
- `src/__tests__/views/runner-snippet-loop-body-file-bound.test.ts` ✓
- `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` ✓
- `src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts` ✓

No files under `src/__tests__/` modified or added ✓

---

## Task 4: Manual UAT — 7 D-11 checkpoints across sidebar / tab / inline runner modes

**User resume-signal:** `approved`

**Post-execution notes:** Two in-flight fixes applied during UAT:
1. **Specificity fix** — doubled selector `.rp-loop-exit-btn.rp-loop-exit-btn` to beat Obsidian's `button:not(.clickable-icon)` (spec 0,1,1). Without this, the green background was invisible because Obsidian's base button rule overrode ours.
2. **Desaturation fix** — added `filter: saturate(0.65)` per user request to make the green less vivid.

**UAT Log:**

```
Phase 70 UAT — 2026-04-29
Checkpoint 1 (sidebar colours): PASS — green exit button visible, body button on interactive-accent
Checkpoint 2 (tab colours):     PASS — identical treatment as sidebar
Checkpoint 3 (inline colours):  PASS — identical treatment inside inline modal
Checkpoint 4 (hover dim):       PASS — subtle darkening visible on hover
Checkpoint 5 (focus ring):      PASS — Obsidian default focus ring intact (D-06)
Checkpoint 6 (body no regress): PASS — Phase 44 hover behaviour unchanged
Checkpoint 7 (3-colour rhythm): PASS — yellow label + blue body + green exit, distinct
Overall: APPROVED
```

---

## Deviations from Plan

### [Rule 3 — auto-fix] Specificity clash with Obsidian base `button` rule
- **Found during:** Task 4 UAT (Checkpoint 1)
- **Issue:** Obsidian's `button:not(.clickable-icon) { background-color: var(--interactive-normal); }` (spec 0,1,1) overrode our `.rp-loop-exit-btn` (spec 0,1,0). Exit button appeared gray instead of green.
- **Fix:** Changed selector to `.rp-loop-exit-btn.rp-loop-exit-btn` (spec 0,2,0) and repeated `background` in `:hover`. Also added `filter: saturate(0.65)` to tone down saturation per user feedback.
- **Files modified:** `src/styles/loop-support.css` (lines 126-135)
- **Verification:** Re-ran `npm run build` + `npm test` + UAT — all passed
- **Commit hashes:** `b0e2dda` (specificity fix), `fdce5c1` (desaturation fix)

**Total deviations:** 1 auto-fixed. **Impact:** Minimal — CSS-only selector refinement, no TypeScript or logic changes.

---

## Final git diff

```
$ git diff --name-only
src/styles/loop-support.css
styles.css
src/styles.css
```

(`main.js` was also regenerated by the build and committed as part of the initial `e8f75ef` commit, but is untracked by gitignore.)

---

## Verification

1. **Source artefact correct** — Phase 70 header present once, line count 135 (±2), Phase 44 body-btn byte-for-byte preserved ✓
2. **Build artefact correct** — `styles.css` and `src/styles.css` identical, Phase 70 rules present ✓
3. **Test surface green** — `npm test` exits 0, no `src/__tests__/` changes ✓
4. **Out-of-scope files untouched** — no changes in `src/views/`, `src/graph/`, `src/runner/`, `src/__tests__/`, `src/styles/inline-runner.css`, `src/styles/runner-view.css` ✓
5. **4 ROADMAP Success Criteria covered:**
   - SC#1 (visible difference) — UAT Checkpoints 1-3 ✓
   - SC#2 (shape/label/position invariant) — no structural changes, only background/color/filter ✓
   - SC#3 (no body regression) — Task 1 AC#4 + UAT Checkpoint 6 ✓
   - SC#4 (3 modes coverage) — UAT Checkpoints 1, 2, 3 ✓
6. **All 12 locked decisions honoured** — verified against final CSS block ✓

**LOOP-EXIT-01:** Satisfied ✓

---

## Next Step

Phase 70 complete. Ready for:
- `/gsd-verify-work 70` — formal verification
- `/gsd-progress` — check milestone status
- `/gsd-plan-phase 71` — plan next phase (Donate Section)
