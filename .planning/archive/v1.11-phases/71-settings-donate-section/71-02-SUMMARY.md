---
phase: 71-settings-donate-section
plan: 02
subsystem: CSS build pipeline
tags: [css, esbuild, donate-section]
dependency_graph:
  requires: []
  provides: [DONATE-01]
  affects: [styles.css, build output]
tech_stack:
  added: []
  patterns:
    - Per-feature CSS file in src/styles/ (VIS-D-02)
    - CSS_FILES registration in esbuild.config.mjs
    - Obsidian theme tokens var(--size-2-1), var(--size-4-2)
key_files:
  created:
    - src/styles/donate-section.css
  modified:
    - esbuild.config.mjs
decisions:
  - Used Obsidian theme tokens instead of hardcoded pixel values (VIS-D-03)
  - Minimal CSS: only word-break, display:block, margin-top (VIS-D-03 defers all styling to Obsidian defaults)
  - rp-donate-address class for wallet address <code> elements
  - rp-donate-intro class for invitation paragraph
metrics:
  duration: "<5 min"
  completed: "2026-04-29"
---

# Phase 71 Plan 02 Summary: Donate Section CSS

## One-liner
Created per-feature `donate-section.css` with minimal VIS-D-03 rules and registered it in the esbuild `CSS_FILES` array.

## What was built

### `src/styles/donate-section.css` (new file)
- Phase 71 header marker comment
- `.rp-donate-address` selector:
  - `display: block` — places address on its own line below network list
  - `word-break: break-all` — ensures long crypto addresses wrap in narrow columns
  - `margin-top: var(--size-2-1)` — small breathing room using Obsidian theme token
- `.rp-donate-intro` selector:
  - `margin-bottom: var(--size-4-2)` — prevents paragraph from sitting flush against first setting row
- **No color/background/border/font-size overrides** — inherits Obsidian defaults per VIS-D-03

### `esbuild.config.mjs` (1-line change)
- Added `'donate-section'` as 9th entry in `CSS_FILES` array (after `'inline-runner'`)
- All 8 original entries preserved in original order (T-71-03 mitigation)
- `npm run build` confirmed: `styles.css` regenerated with Phase 71 rules concatenated at end

## Verification
| Check | Result |
|-------|--------|
| `src/styles/donate-section.css` exists | PASS |
| Contains `Phase 71: Donate section (DONATE-01)` marker | PASS |
| Contains `.rp-donate-address` selector | PASS |
| Contains `word-break: break-all` | PASS |
| Contains `.rp-donate-intro` selector | PASS |
| Uses `var(--size-*)` theme tokens (no hardcoded px) | PASS |
| No `color:` / `background:` / `border:` / `font-size:` overrides | PASS |
| `esbuild.config.mjs` has `'donate-section'` | PASS |
| All 8 prior CSS_FILES entries preserved | PASS |
| `npm run build` exits 0 | PASS |
| `styles.css` contains Phase 71 marker | PASS |
| `styles.css` contains `.rp-donate-address` | PASS |
| `styles.css` contains `.rp-donate-intro` | PASS |
| Existing CSS rules still present in `styles.css` | PASS |

## Commits
| Hash | Message |
|------|---------|
| `5df52df` | feat(71-02): add donate-section.css with minimal VIS-D-03 rules |
| `68926e3` | feat(71-02): register donate-section in CSS_FILES array |

## Next Steps
Plan 03 will produce DOM nodes with class names `rp-donate-intro` (invitation paragraph) and `rp-donate-address` (wallet address `<code>` elements), which will be styled by these CSS rules.

## Deviations from Plan
None — plan executed exactly as written.

## Threat Surface Scan
| Flag | File | Description |
|------|------|-------------|
| None | — | CSS-only changes; no trust boundary crossings |

## TDD Gate Compliance
Not applicable — plan type is `execute`, not `tdd`.

## Self-Check: PASSED
- [x] Commit `5df52df` exists
- [x] Commit `68926e3` exists
- [x] `src/styles/donate-section.css` exists
- [x] `esbuild.config.mjs` contains `'donate-section'`
- [x] `styles.css` regenerated with Phase 71 marker
