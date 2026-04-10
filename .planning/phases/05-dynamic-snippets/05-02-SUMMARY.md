---
phase: 05-dynamic-snippets
plan: "02"
subsystem: ui
tags: [snippets, itemview, master-detail, css, dom-api, obsidian-plugin]

# Dependency graph
requires:
  - phase: 05-01
    provides: SnippetService CRUD, SnippetPlaceholder with options/unit/joinSeparator, slugifyLabel, renderSnippet
provides:
  - SnippetManagerView full two-column master-detail ItemView (D-01 through D-08)
  - All Phase 5 CSS classes in styles.css (rp-snippet-* and rp-snippet-modal-*)
  - SnippetManagerView registered in main.ts with open-snippet-manager command
  - snippetService property on plugin for service-locator access
affects: [05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-column master-detail ItemView: left list panel + right form panel pattern"
    - "Inline mini-form for add-placeholder: shown/hidden via style.display toggle"
    - "insertAtCursor helper: inserts {{id}} at textarea cursor position via selectionStart/End"
    - "Two-step delete confirm: button text toggles to 'Confirm delete?' with Cancel span"
    - "Orphan badge: check template for {{id}} tokens after placeholder removal, show role=alert badge"
    - "Save button disabled during async save (T-5-06 DoS protection)"

key-files:
  created: []
  modified:
    - src/views/snippet-manager-view.ts
    - src/styles.css
    - src/main.ts

key-decisions:
  - "snippetService added to main.ts as plugin property (Rule 2) — required for this.plugin.snippetService access in view"
  - "SnippetManagerView registered in main.ts with open-snippet-manager command and activateSnippetManagerView method"
  - "renderPlaceholderList rebuilds entire placeholder list container on each change — avoids incremental DOM sync complexity"
  - "refreshOrphanBadges uses regex matchAll on template to detect all {{token}} references not in active placeholder IDs"

patterns-established:
  - "Service locator via this.plugin.snippetService — consistent with editor-panel-view.ts pattern"
  - "ItemView onClose() calls this.contentEl.empty() — consistent across all views"
  - "All event listeners via registerDomEvent() — no raw addEventListener"
  - "Zero innerHTML throughout — all DOM via createEl/createDiv/createSpan"

requirements-completed: [SNIP-01, SNIP-02, SNIP-03]

# Metrics
duration: ~25min
completed: 2026-04-06
---

# Phase 05 Plan 02: Wave 2 — SnippetManagerView full UI + Phase 5 CSS

**Two-column master-detail SnippetManagerView with inline placeholder authoring (D-01 through D-08), insertAtCursor template integration, orphan badge warnings, and all rp-snippet-* CSS classes including modal classes for Plan 03**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-06T19:20:00Z
- **Completed:** 2026-04-06T19:45:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `SnippetManagerView` fully implemented: two-column layout (list left, form right), constructor updated to `(leaf, plugin)`, service locator via `this.plugin.snippetService`
- All D-01 through D-08 interaction decisions implemented: empty states, new draft creation (D-03), inline add-placeholder mini-form with insertAtCursor + slugifyLabel (D-04), orphan warning badge (D-05), choice/multi-choice expand inline with option fields (D-06), join separator for multi-choice (D-07), unit field for number type (D-08)
- Save with Notice + button-disable guard (T-5-06) and two-step delete confirm with inline Cancel span
- Real-time list item label update on name input change
- `getDisplayText()` returns `'Snippet manager'` (sentence case per NFR-05)
- All Phase 5 CSS classes appended to `styles.css`: 20 `rp-snippet-*` selectors covering manager UI and fill-in modal (used by Plan 03)
- `snippetService` added to main.ts plugin class; SnippetManagerView registered with `open-snippet-manager` command

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement SnippetManagerView full master-detail UI** - `64036ec` (feat)
2. **Task 2: Add Phase 5 CSS classes to styles.css** - `929f927` (feat)

## Files Created/Modified

| File | Change |
|------|--------|
| `src/views/snippet-manager-view.ts` | Full replacement of Phase 3 stub with 590-line master-detail ItemView |
| `src/styles.css` | Phase 5 block appended (230 lines): rp-snippet-manager through rp-snippet-modal-btn-row |
| `src/main.ts` | Added SnippetService import + instantiation, SnippetManagerView registration, open-snippet-manager command, activateSnippetManagerView method |

## Decisions Made

- `snippetService` added to `main.ts` plugin class as a deviation (Rule 2 — missing critical functionality): without it, `this.plugin.snippetService` would throw at runtime. This is the standard service-locator pattern already established by `editor-panel-view.ts`.
- `renderPlaceholderList()` rebuilds the entire placeholder list container on each mutation rather than patching individual rows — avoids incremental DOM sync complexity at the cost of minor re-render overhead (acceptable for small placeholder counts).
- `refreshOrphanBadges()` uses `regex.matchAll` to scan all `{{token}}` references in the template on every `input` event — ensures orphan badges are live-updated as the author edits the template directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added snippetService property and SnippetManagerView registration to main.ts**
- **Found during:** Task 1 (SnippetManagerView implementation)
- **Issue:** The plan specified `this.plugin.snippetService` as the access pattern, but `main.ts` had no `snippetService` property, no `SnippetService` import, and no `SnippetManagerView` registration. The view would fail at runtime with a property access error and the command to open it would not exist.
- **Fix:** Added `SnippetService` import + instantiation in `onload()`, `snippetService` property declaration, `SnippetManagerView` registration, `open-snippet-manager` command, and `activateSnippetManagerView()` method — all following the existing `EditorPanelView` pattern exactly.
- **Files modified:** `src/main.ts`
- **Verification:** TypeScript compiles clean; `this.plugin.snippetService` resolves correctly
- **Committed in:** `64036ec` (Task 1 commit)

**2. [Rule 3 - Blocking] npm install required in worktree**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Worktree had no `node_modules` directory; `async-mutex` (required by WriteMutex) could not be resolved.
- **Fix:** Ran `npm install` — 353 packages installed.
- **Files modified:** `node_modules/` (gitignored, not committed)
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (1 Rule 2 missing critical, 1 Rule 3 blocking)
**Impact on plan:** Both essential for correctness. No scope creep — Rule 2 fix follows exact pattern from EditorPanelView.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SnippetManagerView` fully functional and registered — plan 03 (SnippetFillInModal) and plan 04 (RunnerView integration) can proceed
- All CSS modal classes (`rp-snippet-modal-*`) are in `styles.css` and ready for Plan 03 to use
- `this.plugin.snippetService` is now a stable access path for all Phase 5 views

## Known Stubs

None. All deliverables are fully implemented.

## Threat Surface Scan

No new network endpoints or external trust boundaries introduced. All input from user (name, template, placeholder labels) is set via `element.textContent` or input `.value` — never `innerHTML` (T-5-05 mitigated). Save button disabled during async write (T-5-06 mitigated). Two-step delete confirm implemented (T-5-08 mitigated).

## Self-Check: PASSED

- `src/views/snippet-manager-view.ts` — exists, contains SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE, slugifyLabel, insertAtCursor, rp-snippet-list-panel, rp-snippet-form, rp-placeholder-orphan-badge, registerDomEvent, 'Snippet manager', 'Snippet saved.', 'Snippet deleted.'
- `src/styles.css` — exists, contains rp-snippet-manager, rp-snippet-list-panel, rp-snippet-form, rp-snippet-list-item.is-active, rp-placeholder-row.is-expanded, rp-placeholder-orphan-badge, rp-snippet-modal, rp-snippet-preview (min-height: 80px, var(--font-monospace)), rp-snippet-modal-btn-row button (min-height: 36px), Phase 3/4 classes unchanged
- `src/main.ts` — exists, contains snippetService, SnippetManagerView registration, open-snippet-manager command
- `.planning/phases/05-dynamic-snippets/05-02-SUMMARY.md` — exists
- Commit `64036ec` — exists (feat: SnippetManagerView implementation)
- Commit `929f927` — exists (feat: Phase 5 CSS classes)
- `npx tsc --noEmit` — zero errors in src/ files

---
*Phase: 05-dynamic-snippets*
*Completed: 2026-04-06*
