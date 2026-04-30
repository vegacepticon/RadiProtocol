---
phase: 35-markdown-snippets-in-protocol-runner
plan: 02
subsystem: ui
tags: [obsidian, snippets, markdown, runner-view, protocol-runner]

requires:
  - phase: 35-01
    provides: "Failing test stubs (Wave 0 RED) for MD snippet picker behavior"
  - phase: 32
    provides: "SnippetService with MdSnippet model and listFolder returning Snippet union"
provides:
  - "MD snippets visible in runner picker with glyph prefix differentiation"
  - "Click-to-insert verbatim for MD snippets without fill-in modal"
  - "Drill-down subfolder support for MD snippets"
  - "Mixed answer+snippet branching routes MD snippets correctly"
  - "Step-back symmetry for MD snippets"
  - "Session save/resume preserves MD content"
affects: []

tech-stack:
  added: []
  patterns:
    - "Snippet union dispatch: kind-switch before JSON-specific field access"
    - "Glyph prefix in text node for snippet type differentiation"

key-files:
  created: []
  modified:
    - src/views/runner-view.ts

key-decisions:
  - "Used snippet.path for pickSnippet identity with kind-aware ternary for backward compatibility"
  - "Prefix glyph embedded in text node (not separate span) per accessibility requirement"
  - "Zero CSS diff, zero runner-core changes -- all changes confined to runner-view.ts"

patterns-established:
  - "Snippet kind dispatch: check snippet.kind === 'md' BEFORE accessing JSON-only fields (placeholders/template)"
  - "Glyph prefix convention: JSON=pencil-on-paper, MD=memo for visual differentiation in picker"

requirements-completed: [MD-01, MD-02, MD-03, MD-04]

duration: 12min
completed: 2026-04-16
---

# Phase 35 Plan 02: MD Snippets in Runner Picker Summary

**Surgical two-method edit to runner-view.ts surfacing MD snippets alongside JSON in picker with glyph prefixes and verbatim click-to-insert**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-16T04:00:00Z
- **Completed:** 2026-04-16T04:12:56Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments
- MD snippets appear in runner snippet picker with distinct glyph prefix (MD=memo, JSON=pencil-on-paper)
- Click on MD snippet inserts content verbatim without fill-in modal
- All 7 Phase 35 tests green (md click completes, step-back md, empty md, mixed branch md, session md resume, md picker row, md drill-down)
- Human verification passed all 11 Obsidian live environment checks
- Zero CSS changes, zero runner-core changes -- confined to runner-view.ts only

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen handleSnippetPickerSelection to Snippet union + MD kind branch** - `167a724` (feat)
2. **Task 2: Remove JSON-only filter + add kind-aware glyph prefix in renderSnippetPicker** - `c53e138` (feat)
3. **Task 3: Human verify MD picker in real Obsidian** - `8c8d895` (test/UAT -- user approved)

_Note: TDD RED stubs were committed in plan 35-01. This plan executed GREEN phase._

## Files Created/Modified
- `src/views/runner-view.ts` - Widened handleSnippetPickerSelection to Snippet union with MD kind branch; removed JSON-only filter in renderSnippetPicker; added glyph prefix differentiation

## Decisions Made
- Used kind-aware ternary for pickSnippet identity (`snippet.kind === 'md' ? snippet.path : (snippet.id ?? snippet.name)`) for full backward compatibility
- Embedded glyph prefix directly in button text node rather than separate span element, per UI-SPEC accessibility requirement
- Zero CSS diff maintained as specified in UI-SPEC contract

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 35 (markdown-snippets-in-protocol-runner) is complete
- All MD snippet requirements (MD-01 through MD-04) satisfied
- Ready for v1.5 release or any follow-on phases

## Self-Check: PASSED

- FOUND: src/views/runner-view.ts
- FOUND: commit 167a724 (Task 1)
- FOUND: commit c53e138 (Task 2)
- FOUND: commit 8c8d895 (Task 3 UAT)

---
*Phase: 35-markdown-snippets-in-protocol-runner*
*Completed: 2026-04-16*
