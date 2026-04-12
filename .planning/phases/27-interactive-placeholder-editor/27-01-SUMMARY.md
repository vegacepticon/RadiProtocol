---
phase: 27-interactive-placeholder-editor
plan: 01
subsystem: ui
tags: [drag-and-drop, snippet-editor, css, typescript, obsidian-plugin]

requires:
  - phase: 05-dynamic-snippets
    provides: SnippetManagerView, SnippetFile, SnippetPlaceholder model, snippetService.save()
  - phase: 25-snippet-node-runner-ui
    provides: SnippetFillInModal iterates placeholders in array order

provides:
  - Chip-based placeholder list in SnippetManagerView replacing expandable row list
  - HTML5 drag-and-drop reorder splicing draft.placeholders array
  - autoSaveAfterDrop() persists new order to disk via snippetService.save()
  - PH_COLOR constant mapping placeholder type to CSS custom property colour
  - Eight chip CSS classes in src/styles.css for chip layout, handle, label, badge, remove button

affects:
  - SnippetFillInModal (tab order now follows persisted array order — CHIP-03)
  - Any future phase touching SnippetManagerView placeholder rendering

tech-stack:
  added: []
  patterns:
    - "Chip renderer pattern: renderPlaceholderChip() creates self-contained draggable chip with inline DnD event listeners"
    - "autoSaveAfterDrop(): fire-and-forget async save after array splice, updates this.snippets sync"
    - "PH_COLOR Record<type, string>: centralised colour mapping for placeholder type colour bars"

key-files:
  created: []
  modified:
    - src/styles.css
    - src/views/snippet-manager-view.ts

key-decisions:
  - "HTML5 native DnD (not a library) — chips are recreated on each re-render so addEventListener is correct; registerDomEvent not used for DnD events since chips are ephemeral"
  - "border-left inline style for colour bar — avoids per-type CSS class proliferation; PH_COLOR maps type to CSS var at render time"
  - "autoSaveAfterDrop shows Notice('Snippet saved.') on success matching handleSave() UX pattern"
  - "click-to-expand guard checks e.target === removeBtn and closest('.rp-placeholder-chip-handle') to prevent expand on handle/remove click"

patterns-established:
  - "Chip renderer: renderPlaceholderChip() replaces renderPlaceholderRow() — type-coloured chip with handle, label, badge, remove, and click-to-expand"
  - "Drop splice pattern: splice(from, 1) then splice(to, 0, moved) for stable array reorder"

requirements-completed:
  - CHIP-01
  - CHIP-02
  - CHIP-03

duration: 18min
completed: 2026-04-12
---

# Phase 27 Plan 01: Interactive Placeholder Editor Summary

**Chip-based drag-and-drop placeholder list in SnippetManagerView with type-colour bars, HTML5 DnD reorder, and auto-save on drop — SnippetFillInModal tab order follows persisted array order for free.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-12T08:11:00Z
- **Completed:** 2026-04-12T08:29:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced `renderPlaceholderRow()` with `renderPlaceholderChip()` — each placeholder now renders as a chip with coloured left bar (type-driven via `PH_COLOR`), human-readable label (never raw `{{id}}`), type badge, `⠿` drag handle, and `×` remove button
- Implemented HTML5 native drag-and-drop: `dragstart`/`dragover`/`dragenter`/`dragleave`/`drop`/`dragend` on each chip, splicing `draft.placeholders` and calling `autoSaveAfterDrop()` to persist new order
- `autoSaveAfterDrop()` calls `snippetService.save(draft)`, syncs `this.snippets`, and shows `Notice('Snippet saved.')` — SnippetFillInModal receives reordered array on next open (CHIP-03 satisfied at zero modal changes)

## Task Commits

1. **Task 1: Add chip CSS classes to styles.css** — `96022c2` (feat)
2. **Task 2: Replace renderPlaceholderRow with chip renderer + DnD + auto-save** — `bf322c9` (feat)

## Files Created/Modified

- `src/styles.css` — Added 8 chip CSS rule blocks after `.rp-placeholder-orphan-badge`: `.rp-placeholder-chip`, hover/is-expanded/drag-over modifiers, handle, label, badge, remove, expanded child
- `src/views/snippet-manager-view.ts` — Added `PH_COLOR` constant; replaced `renderPlaceholderRow()` with `renderPlaceholderChip()`; updated `renderPlaceholderList()` call site; added `autoSaveAfterDrop()` method

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — chip rendering is fully wired to live `draft.placeholders` data.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Drag index validated with `from === -1 || from === to` guard as specified in threat register T-27-01.

## Self-Check

Checking files exist and commits are present...

## Self-Check: PASSED

- FOUND: src/styles.css
- FOUND: src/views/snippet-manager-view.ts
- FOUND: .planning/phases/27-interactive-placeholder-editor/27-01-SUMMARY.md
- FOUND commit: 96022c2 (Task 1 — CSS)
- FOUND commit: bf322c9 (Task 2 — TypeScript)
