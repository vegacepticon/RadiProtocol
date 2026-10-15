---
template_version: 1
date: 2026-10-15T18:09:39+0300
author: Hermes
branch: main
repository: RadiProtocol
topic: Compact conclusion draft UI
status: ready
verdict: pass-with-runtime-limits
---

# Compact conclusion-draft UI

Roman verified release 3.6.13 in Obsidian and requested a focused visual simplification.

## Changes

- Removed up/down buttons, their handlers, wrapper styles and unused en/ru labels. Existing chip-based drag reorder and snapshot dirtiness remain covered.
- Removed heading/help DOM and their unused locale/CSS entries.
- Replaced tooltip-producing aria-label attributes on pending input, row editors, drag chips and delete buttons with aria-labelledby references to unique rp-sr-only labels. Accessible names remain present; labels for rows are removed with those rows on rerender.
- Shared theme-based control height between single-line fields, chips and delete buttons. Symmetric padding preserves vertical centering; long text still grows and reflows on width change without clipping.
- Centered the insert button. No runner state, note insertion, persistence, settings-default or lifecycle behavior changed.

## Verification

- TDD: the new minimal-UI/accessible-label test failed on the prior heading; after implementation focused editor/host suites passed.
- Full `npm run check:release`: build, lint, 97 test files / 1348 tests, planning/consistency/agent-docs, en/ru parity and i18n audit passed (exit 0). Knip remains advisory.
- Real Chromium component smoke with synthetic Obsidian DOM helpers passed: no title/help/arrows, no aria-label/title triggers, hidden labels linked, 30 px and 36 px theme field/chip/delete parity, repeated-size stability, centered button, drag reorder, long-text growth on narrowing, shrink-back and accessible answer controls.
- Real Chromium AX tree exposes `Drag to reorder`, `Edit item`, `Delete item` and `New conclusion item` names without the removed tooltip attributes.
- Actual Obsidian rendering of this follow-up is not yet user-verified. The standalone browser harness does not load the Obsidian application.

## Release boundary

Source/build version is still 3.6.13; this follow-up has not been published. Existing pipeline would delete release and tag 3.6.11 when publishing 3.6.14. The earlier scoped deletion approval covered 3.6.10, not this next deletion. Wait for explicit approval before invoking that release pipeline; do not change retention policy implicitly.
