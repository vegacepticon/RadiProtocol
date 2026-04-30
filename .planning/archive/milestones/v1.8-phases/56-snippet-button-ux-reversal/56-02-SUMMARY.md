---
phase: 56-snippet-button-ux-reversal
plan: 02
subsystem: snippets/editor-ui
tags: [picker, ux, unsaved-indicator, css, tdd]
requires:
  - SnippetEditorModal (Phase 33+)
  - SnippetTreePicker folder-only mode (Phase 51 D-07)
provides:
  - "rp-snippet-editor-unsaved-dot CSS surface (base + .is-visible modifier)"
  - "savedFolder baseline + updateFolderUnsavedDot() runtime contract on SnippetEditorModal"
affects:
  - src/views/snippet-editor-modal.ts
  - src/styles/snippet-manager.css
  - styles.css (generated)
  - src/__tests__/views/snippet-editor-modal-banner.test.ts
tech-stack:
  added: []
  patterns:
    - "diff-driven .is-visible class toggle (matches Phase 51 SnippetTreePicker pattern)"
    - "append-only CSS per CLAUDE.md (single Phase 56 D-08 block at file tail)"
key-files:
  created: []
  modified:
    - src/views/snippet-editor-modal.ts
    - src/styles/snippet-manager.css
    - styles.css
    - src/__tests__/views/snippet-editor-modal-banner.test.ts
decisions:
  - "savedFolder baseline initialised in BOTH constructor branches (edit + create) so the create-mode initial dot state is also correct."
  - "Save commit point: re-baseline INSIDE try{} after the persistence call(s) succeed but BEFORE safeResolve+super.close() — matches plan step 6 and works for both no-move and move/rename branches."
  - "No reset-to-original path exists in the modal; modal dismiss tears down DOM, so plan step 7 was a no-op (documented inline)."
  - "Dot toggled via toggleClass('is-visible', diff) (single source of truth) instead of style.display so future theme overrides remain pure-CSS."
metrics:
  duration: ~9 min
  completed: 2026-04-21
  tasks: 2
  files_modified: 4
  tests_added: 5
  commits: 3
---

# Phase 56 Plan 02: Editor Modal Unsaved-Dot Indicator — Summary

Added the D-08 / SC-6 «Папка» unsaved-change indicator to `SnippetEditorModal`: a small bullet (•) rendered inside the «Папка» label that appears the moment the in-modal folder selection differs from the saved baseline and clears on a successful save (or on modal dismiss, which destroys the DOM). Visual vocabulary uses `var(--interactive-accent)` — same channel Obsidian uses for its native unsaved-file tab dot.

## What Shipped

**Task 1 — `src/views/snippet-editor-modal.ts`** (commit `fe16f56`):
- Added `private savedFolder: string` next to `currentFolder`; initialised in both edit-mode and create-mode constructor branches so the initial diff is always 0.
- Added `private folderUnsavedDotEl: HTMLSpanElement | null = null` next to other DOM refs.
- `renderFolderDropdown` now creates the bullet `<span class="rp-snippet-editor-unsaved-dot">•</span>` as a child of the «Папка» `<label>` element, with `aria-label="Несохранённые изменения"`. An initial `updateFolderUnsavedDot()` is called immediately so the hidden state is established before the picker mounts.
- New private method `updateFolderUnsavedDot()` performs the diff and toggles the `.is-visible` class.
- `SnippetTreePicker.onSelect` callback now calls `updateFolderUnsavedDot()` AFTER the existing `runCollisionCheck()` line — Phase 51 semantics (`hasUnsavedChanges = true` + collision recheck) are preserved verbatim.
- Both save success branches in `handleSave` (no-move and move/rename) re-baseline `savedFolder = currentFolder` and call `updateFolderUnsavedDot()` immediately before `safeResolve` + `super.close()`. The dot disappears the instant the persistence promise resolves.

**Task 2 — `src/styles/snippet-manager.css`** (commit `a22f2a7`):
- Appended a `/* Phase 56 D-08 */` block at the file tail with the `.rp-snippet-editor-unsaved-dot` base rule (`display:none` + accent colour + `1.2em` font-size for legibility next to a small label) and the `.is-visible` modifier (`display:inline`).
- Diff is **+19 lines / 0 deletions** — strict append-only per CLAUDE.md.
- `npm run build` regenerated `styles.css`; the new selectors round-trip into the bundle.

**Test additions — `src/__tests__/views/snippet-editor-modal-banner.test.ts`** (commit `b87058f` — RED, then green after `fe16f56`):
- D1: opening a snippet — dot exists, `.is-visible` absent.
- D2: setting `currentFolder` to a different value + invoking `updateFolderUnsavedDot()` adds `.is-visible`.
- D3: re-baselining `savedFolder = currentFolder` and re-invoking the updater removes `.is-visible`.
- D4: reverting `currentFolder` back to `savedFolder` removes `.is-visible`.
- D5: dot is a `<span>` child of the «Папка» `<label>` and is NOT present in `titleEl`.
- All 10 tests green (5 pre-existing B1-B5 + 5 new D1-D5).

## Verification

- `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts` → 10/10 pass.
- `npx tsc --noEmit --skipLibCheck` → clean (project-code errors: 0).
- `npm run build` → success; `styles.css` regenerated with both selectors.
- `grep -c "rp-snippet-editor-unsaved-dot" styles.css` → 2 (base + `.is-visible`).
- `git diff src/styles/snippet-manager.css` → +19 / -0 (append-only honoured).

## Acceptance Criteria

| Criterion | Result |
| --- | --- |
| `grep -c "rp-snippet-editor-unsaved-dot" src/views/snippet-editor-modal.ts` ≥ 1 | 1 ✓ |
| `grep -c "savedFolder" src/views/snippet-editor-modal.ts` ≥ 3 | 8 ✓ |
| `grep -c "updateFolderUnsavedDot" src/views/snippet-editor-modal.ts` ≥ 3 | 6 ✓ |
| Dot `<span>` is a child of label element | ✓ (D5 assertion) |
| Test count grew by ≥ 3 | +5 ✓ |
| Vitest exit 0 | ✓ |
| `npx tsc --noEmit` (project code) exit 0 | ✓ |
| `grep -c "Phase 56 D-08" src/styles/snippet-manager.css` = 1 | 1 ✓ |
| `grep -c "rp-snippet-editor-unsaved-dot" src/styles/snippet-manager.css` ≥ 2 | 2 ✓ |
| `grep -c "rp-snippet-editor-unsaved-dot" styles.css` ≥ 2 | 2 ✓ |
| `npm run build` exit 0 | ✓ |
| `git diff src/styles/snippet-manager.css` shows only appended lines | ✓ |

## Deviations from Plan

None — plan executed exactly as written. Plan step 7 (reset-to-original wiring) was confirmed a no-op: no such reset method exists in the modal, and modal dismissal tears down the DOM.

## TDD Gate Compliance

- RED: commit `b87058f` — `test(56-02): add failing tests for «Папка» unsaved dot`. Vitest output confirmed 5 fails / 5 passes.
- GREEN: commit `fe16f56` — `feat(56-02): add «Папка» unsaved dot indicator`. Vitest output: 10/10 pass.
- REFACTOR: not required — implementation matches the plan's prescribed shape and the test surface stayed minimal.

## Commits

- `b87058f` test(56-02): add failing tests for «Папка» unsaved dot (Phase 56 D-08)
- `fe16f56` feat(56-02): add «Папка» unsaved dot indicator (Phase 56 D-08)
- `a22f2a7` feat(56-02): append unsaved-dot CSS for «Папка» label (Phase 56 D-08)

## Self-Check: PASSED

- File `src/views/snippet-editor-modal.ts` modified — FOUND.
- File `src/styles/snippet-manager.css` modified — FOUND.
- File `styles.css` regenerated — FOUND.
- File `src/__tests__/views/snippet-editor-modal-banner.test.ts` extended — FOUND.
- Commit `b87058f` — FOUND.
- Commit `fe16f56` — FOUND.
- Commit `a22f2a7` — FOUND.
