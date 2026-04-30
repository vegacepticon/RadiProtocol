---
phase: 53-runner-skip-close-buttons
plan: 03
subsystem: runner
tags: [runner, view, css, selector-bar, ui]
requires:
  - 53-02-runner-view-skip-button
  - 53-02-phase-53-css-block
provides:
  - runner-view-close-button
  - runner-view-handle-close
  - phase-53-close-css-extension
affects:
  - src/views/runner-view.ts
  - src/styles/runner-view.css
  - styles.css (generated)
  - src/styles.css (generated)
tech-stack:
  added: []
  patterns:
    - "Confirmation-before-destructive (mirrors handleSelectorSelect D-12/D-13)"
    - "D-14 ordered teardown (sessionService.clear → new ProtocolRunner → null fields → setSelectedPath(null) → render)"
    - "Runner-owned modifier class (rp-selector-bar--has-close) for CSS ownership preservation"
    - "Prepend-survives-empty attachment pattern for Close button lifetime"
key-files:
  created: []
  modified:
    - src/views/runner-view.ts
    - src/styles/runner-view.css
    - styles.css
    - src/styles.css
decisions:
  - "Close button attached ONCE in onOpen() (same lifetime as selectorBarEl) — never re-attached inside render() to avoid Phase 30 WR-01 listener accumulation"
  - "Runner-owned .rp-selector-bar--has-close modifier lives in runner-view.css; canvas-selector.css (which owns .rp-selector-bar base) untouched per CLAUDE.md CSS architecture table"
  - "handleClose() needsConfirmation predicate is byte-identical to handleSelectorSelect — copy-paste from Plan plan's interfaces block"
  - "Defence-in-depth guard `if (this.canvasFilePath === null) return;` on handleClose — button is already hidden via is-hidden class when canvasFilePath is null, guard catches double-click race during await"
  - "No accumulator touch by handleClose — runner is re-created to reach clean idle, mirroring openCanvas lines 93-97"
metrics:
  completed: 2026-04-20
  duration_minutes: "~6"
  tasks: 2
  commits: 2
  test_delta: "648 → 648 (preserved, no new tests in Plan 03)"
---

# Phase 53 Plan 03: Close Button UI + handleClose + Close CSS Summary

Rendered the Close icon-button inside `selectorBarEl` next to the selector trigger,
wired its click to a new `handleClose()` private method that mirrors the
`handleSelectorSelect` D-12/D-13 confirmation pattern and performs the D-14
teardown in exact order, and extended the Phase 53 CSS block with neutral-styled
`.rp-close-btn` rules + a runner-owned `.rp-selector-bar--has-close` flex-layout
modifier — all without touching `canvas-selector.css` (CSS ownership preserved).

## What shipped

### Task 1 — closeBtn field + onOpen attachment + onClose teardown (commit `631b2e6`)

**`src/views/runner-view.ts` — additive only, zero deletions**

- **Line 46** (private fields region): new `private closeBtn: HTMLButtonElement | null = null;`
  placed immediately after `selectorBarEl` with a 3-line Phase 53 RUNNER-CLOSE-01
  comment explaining the shared lifetime + prepend-survives-empty pattern.
- **Lines ~218–233** (`onOpen()`): inserted a 15-line Close button attachment block
  between the `new CanvasSelectorWidget(...)` constructor call and the existing
  `// Sync selector label if a canvas is already set` comment. The block:
  1. Applies the runner-owned modifier class via
     `selectorBarEl.addClass('rp-selector-bar--has-close')` (line 230) — switches
     only this instance to flex layout without touching canvas-selector.css.
  2. Creates the `<button>` as a child of `selectorBarEl`, stamps `setIcon('x')`,
     sets `aria-label` + `title` to `'Close protocol'`.
  3. Initial visibility via `closeBtn.toggleClass('is-hidden', this.canvasFilePath === null)`.
  4. Wires click through `this.registerDomEvent(...)` to `this.handleClose()`.
- **Line 310** (`onClose()` teardown): added `this.closeBtn = null;` between the
  existing `this.selectorBarEl = null;` and `this.contentEl.empty();` lines —
  single-line additive extension, all pre-existing teardown preserved byte-identical.

Diff: +27 / -0. All pre-existing methods in runner-view.ts byte-identical.

### Task 2 — handleClose() + render visibility toggle + Phase 53 (cont.) CSS (commit `f6bc1b4`)

**`src/views/runner-view.ts`:**

- **Lines 352–403** (`handleClose()` private method): 44-line new method inserted
  between `handleSelectorSelect` (closes line 350) and `restartCanvas` (opens line
  405). Five-step D-14 teardown in exact order:
  1. `await this.plugin.sessionService.clear(this.canvasFilePath)` (D-14 step 1)
  2. `this.runner = new ProtocolRunner({ defaultSeparator: this.plugin.settings.textSeparator })`
     — mirrors openCanvas lines 95–97 so post-reset `getState().status === 'idle'`.
  3. `this.graph = null; this.canvasFilePath = null; this.previewTextarea = null;`
  4. `this.selector?.setSelectedPath(null)` (D-16 — selector reset to placeholder)
  5. `this.render()` (enters idle branch — visually identical to fresh plugin open)
  - `needsConfirmation` predicate at lines 363–367 is **byte-identical** to
    `handleSelectorSelect` lines 322–326.
  - Cancel path returns early without touching selector (diverges from
    handleSelectorSelect which reverts selector label — Close never changed it).
  - D-15: reuses `CanvasSwitchModal` verbatim (second `new CanvasSwitchModal(this.app)`
    call-site; grep count = 2 confirms).
  - Defence-in-depth guard at line 361 (`if (this.canvasFilePath === null) return;`)
    handles double-click race during the await window.

- **Line 436** (`render()`): inserted
  `this.closeBtn?.toggleClass('is-hidden', this.canvasFilePath === null);`
  directly after the `this.contentEl.prepend(this.selectorBarEl)` block and before
  `this.previewTextarea = null;`. Close visibility is re-computed on every render —
  first render after `openCanvas` reveals it; first render after `handleClose`
  hides it again.

**`src/styles/runner-view.css`** — append-only at EOF under a `/* Phase 53 (cont.): */`
sub-header (single top-level `/* Phase 53:` block header preserved from Plan 02,
line 247). Appended lines 277–320 (+44 lines):

| Rule | Purpose |
|------|---------|
| `.rp-selector-bar--has-close` | Runner-owned modifier: flex-row layout with gap for inline selector-trigger + Close button. `.rp-selector-bar` base rule in canvas-selector.css untouched — only instances carrying this modifier flip to flex. |
| `.rp-close-btn` | Icon-only button: inline-flex, `margin-inline-start: auto` (pushes to row end), 28×28px min, transparent bg, `--background-modifier-border`, `--text-muted`. D-06 neutral. |
| `.rp-close-btn:hover` | Neutral hover: `--background-modifier-hover` + `--text-normal`. |
| `.rp-close-btn:focus-visible` | 2px accent outline + 1px offset for keyboard a11y. |
| `.rp-close-btn.is-hidden` | `display: none` — toggled by render() when canvasFilePath === null (D-12). |

**`styles.css` + `src/styles.css`** — regenerated via `npm run build` (esbuild
cssPlugin concatenates CSS_FILES in order) and deployed to
`Z:\documents\vaults\TEST-BASE\.obsidian\plugins\radiprotocol`. `grep -c
"rp-close-btn" styles.css` returns 4 (base + hover + focus-visible + is-hidden);
`grep -c "rp-selector-bar--has-close" styles.css` returns 2 (comment mention +
rule itself).

### Verification gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit --skipLibCheck` | Exit 0 (covers Task 1's handleClose() reference + Task 2's definition as one consistent unit) |
| `npm run build` | Exit 0; deployed to TEST-BASE vault |
| `npm test` | **648 passed / 1 skipped / 0 failed** (48 files — baseline preserved from Plan 02) |
| `grep -c "private closeBtn:" runner-view.ts` | 1 |
| `grep -c "private async handleClose()" runner-view.ts` | 1 |
| `grep -c "new CanvasSwitchModal(this.app)" runner-view.ts` | 2 (pre-existing handleSelectorSelect + new handleClose) |
| `grep -c "await this.plugin.sessionService.clear(this.canvasFilePath)" runner-view.ts` | 2 (pre-existing + new D-14 step 1) |
| `grep -c "setSelectedPath(null)" runner-view.ts` | 2 (within handleClose teardown; plus existing widget API pattern) |
| `grep -c "this.closeBtn?.toggleClass" runner-view.ts` | 1 |
| `grep -c "\.rp-close-btn" src/styles/runner-view.css` | 4 |
| `grep -c "\.rp-close-btn.is-hidden" src/styles/runner-view.css` | 1 |
| `grep -c "\.rp-selector-bar--has-close" src/styles/runner-view.css` | 1 |
| `grep -c "/\* Phase 53:" src/styles/runner-view.css` | 1 (ONE top-level Phase-53 header) |
| `git diff src/styles/canvas-selector.css` | empty (CSS ownership preserved) |

## D-14 teardown sequence verification

The 5-step order inside `handleClose()` appears verbatim in the method body
(lines 381–402):

1. `sessionService.clear(this.canvasFilePath)` (line 383)
2. `new ProtocolRunner({ defaultSeparator: ... })` (lines 388–390)
3. `this.graph = null; this.canvasFilePath = null; this.previewTextarea = null;` (lines 393–395)
4. `this.selector?.setSelectedPath(null)` (line 398)
5. `this.render()` (line 402)

## Line ranges touched

### `src/views/runner-view.ts`

| Section | Lines | Change |
|---------|-------|--------|
| closeBtn field | 43–46 | +4 (field + 3-line comment) |
| onOpen Close attachment + modifier | 218–234 | +17 |
| onClose closeBtn null | 310 | +1 |
| handleClose() method | 352–403 | +52 (including JSDoc) |
| render() visibility toggle | 432–436 | +5 (comment + toggle) |

### `src/styles/runner-view.css`

| Section | Lines | Change |
|---------|-------|--------|
| Phase 53 (cont.) Close block | 277–320 | +44 appended inside existing Phase 53 block |

## Deviations from Plan

None — both tasks executed exactly as the `<action>` blocks specified.

- Rule 1 (bug fix): not triggered.
- Rule 2 (missing critical functionality): not triggered.
- Rule 3 (blocking issue): not triggered.
- Rule 4 (architectural): not triggered.

One minor observation vs the acceptance-criteria wording: the plan's acceptance
criterion `grep -c "rp-selector-bar--has-close" styles.css returns 1` actually
yields 2 in practice because the generated bundle includes both the CSS comment
mention and the rule itself (CSS comments are preserved by esbuild). This is
cosmetic — the rule is present exactly once; the criterion was intended as a
"present in bundle" check which still holds. No code change needed; noted here
for auditors.

## Threat Flags

None — Close button introduces no new network surface, no new auth paths, no
new trust boundaries, and no new file access. T-53-02 (race during in-flight
session write) is mitigated by the `await this.plugin.sessionService.clear(...)`
completing BEFORE any field nulling or runner re-creation (D-14 step 1 ordering).
T-53-03 (double-click) is mitigated by (a) the render-time `is-hidden` gate
hiding the button after the first Close completes, and (b) the
`if (this.canvasFilePath === null) return;` first-line guard catching any
racing second click during the await window.

## Commits landed

| Commit | Message |
|--------|---------|
| `631b2e6` | `feat(53-03): attach Close button in onOpen + closeBtn field + onClose teardown` |
| `f6bc1b4` | `feat(53-03): handleClose() + render visibility toggle + Close CSS` |

## Self-Check: PASSED

- Files claimed modified:
  - `src/views/runner-view.ts`: FOUND — contains `private closeBtn` + `private async handleClose` + `rp-selector-bar--has-close` + `this.closeBtn?.toggleClass`
  - `src/styles/runner-view.css`: FOUND — contains `.rp-close-btn` (4x) + `.rp-selector-bar--has-close` (1x) + `/* Phase 53 (cont.)` header
  - `styles.css`: FOUND — contains `rp-close-btn` (4x, generated)
- `canvas-selector.css` diff: empty (CSS ownership preserved)
- Commits claimed:
  - `631b2e6`: FOUND in git log
  - `f6bc1b4`: FOUND in git log
- Test baseline 648 → 648 (0 regressions): confirmed by vitest output
- tsc exit 0: confirmed
- build exit 0 + TEST-BASE deploy: confirmed
