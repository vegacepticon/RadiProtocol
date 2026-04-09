---
phase: 17
plan: "02"
subsystem: snippet-manager
tags: [bug-fix, uat-passed, accessibility]
dependency_graph:
  requires: []
  provides: [miniAddBtn-type-button, miniCancelBtn-type-button, unicode-slug]
  affects: [src/views/snippet-manager-view.ts, src/snippets/snippet-model.ts]
tech_stack:
  added: []
  patterns: [setAttribute type=button, Unicode property escapes in regex]
key_files:
  created: []
  modified:
    - src/views/snippet-manager-view.ts
    - src/snippets/snippet-model.ts
    - src/__tests__/snippet-model.test.ts
decisions:
  - type="button" added via setAttribute after element creation — no handler logic changed
  - slugifyLabel uses \p{L}\p{N} Unicode property escapes (u flag) instead of [a-z0-9] to support Cyrillic and any other Unicode script
  - Unicode slug chosen over transliteration — simpler, preserves original label meaning
metrics:
  duration: "~15 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_changed: 3
---

# Phase 17 Plan 02: BUG-04 Add Button Fix (Snippet Placeholder Mini-Form) Summary

**One-liner:** Added explicit `type="button"` to `miniAddBtn` and `miniCancelBtn` to prevent implicit submit behavior in Electron/Chromium, and extended `slugifyLabel` to support Unicode (Cyrillic) labels.

## What Was Built

Fixed BUG-04: clicking "Add" in the snippet placeholder mini-form had no effect.

**Root cause:** `miniAddBtn` and `miniCancelBtn` were created without an explicit `type` attribute. In Electron's Chromium webview, untyped buttons can default to `type="submit"`, causing unexpected event behavior that prevents the `registerDomEvent` click handler from firing.

**Fix (plan scope):**
- Added `miniAddBtn.setAttribute('type', 'button')` and `miniCancelBtn.setAttribute('type', 'button')` immediately after element creation in `renderFormPanel()`
- No changes to handler logic

**Additional fix found during UAT:**
- `slugifyLabel` used `[^a-z0-9]` which stripped all Cyrillic characters, producing an empty slug and silently blocking placeholder creation for Russian labels
- Fixed by replacing with `[^\p{L}\p{N}]` (Unicode `u` flag) — Cyrillic labels now produce Cyrillic slugs (e.g. `Возраст пациента` → `{{возраст-пациента}}`)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add explicit type="button" to miniAddBtn and miniCancelBtn | 0f997aa | src/views/snippet-manager-view.ts |
| 2 (UAT finding) | Support Cyrillic labels in slugifyLabel via Unicode property escapes | a0e4237 | src/snippets/snippet-model.ts, src/__tests__/snippet-model.test.ts |

## Verification Results

- `snippet-model.test.ts`: 10 tests, all GREEN (including new Cyrillic test)
- `snippet-service.test.ts`: 4 tests, all GREEN
- Full suite: 133 tests — 130 passed, 3 failed (pre-existing RED in runner-extensions.test.ts, unrelated)

Structural checks:
- `miniAddBtn.setAttribute('type', 'button')` present at line 226
- `miniCancelBtn.setAttribute('type', 'button')` present at line 228
- `slugifyLabel` uses `/[^\p{L}\p{N}]+/gu`

## UAT Results

UAT conducted in live Obsidian. All 8 steps passed:
- Add button fires handler, placeholder appended, form hidden, label cleared ✓
- Empty label guard: focus returns to input, no placeholder added ✓
- Cancel: form hides, no side effects ✓
- Cyrillic label (found during UAT): `Возраст пациента` → `{{возраст-пациента}}` ✓

## Deviations from Plan

**Unicode slug fix** — not in original plan scope, discovered during UAT when user tested Cyrillic label input. Fixed inline as a UAT finding.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes. `slugifyLabel` change is purely regex — no eval, no file I/O. Unicode slug values are used only as template variable identifiers in the textarea.

## Self-Check: PASSED

- `miniAddBtn.setAttribute('type', 'button')` in snippet-manager-view.ts: FOUND (line 226)
- `miniCancelBtn.setAttribute('type', 'button')` in snippet-manager-view.ts: FOUND (line 228)
- `slugifyLabel` uses Unicode regex: FOUND
- Cyrillic test in snippet-model.test.ts: FOUND
- All snippet tests GREEN: CONFIRMED
