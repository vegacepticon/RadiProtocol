# Plan 56-03 — Tree Picker Committed State — SUMMARY

**Status:** ✅ Complete
**Date:** 2026-04-21
**Commits:** `074ac51` (RED tests), `d7f51d7` (Task 1 GREEN), `47a8336` (Task 2 CSS)

## Tasks

### Task 1 — `committedRelativePath` state + button label/class swap (commit d7f51d7)
- New private field `committedRelativePath: string | null = null` on `SnippetTreePicker`.
- New constant `SELECT_FOLDER_COMMITTED_LABEL = '\u2713 Выбрано'`.
- `renderDrillView` now computes `currentRel = drillPath.join('/')` and `isCommitted = committedRelativePath === currentRel`; renders the button with `.is-committed` class + «✓ Выбрано» label when matched, default otherwise.
- Click handler sets `committedRelativePath = currentRel` and re-renders before invoking `onSelect`.
- `mount()` and `unmount()` both reset `committedRelativePath` to `null` (handles re-mount lifecycle per Behaviour Test 5).
- Drill-away naturally reverts visual: comparison-based design — `committedRelativePath` lies dormant, button reactivates if user drills back.

### Task 2 — Append committed-state CSS (commit 47a8336)
- `.rp-stp-select-folder-btn.is-committed` + `:hover` rules appended to `src/styles/snippet-tree-picker.css` under `/* Phase 56 D-10 */` block.
- Uses `var(--interactive-accent)`, `var(--text-on-accent)`, `var(--interactive-accent-hover)` — theme-compatible per Obsidian conventions.
- `npm run build` regenerated both `styles.css` (root) and `src/styles.css`; both swept into the same commit, also clearing the pre-existing dirty `src/styles.css` diff left over from Plan 02's build.

## Verification
- `npx vitest run src/__tests__/views/snippet-tree-picker.test.ts` → **34/34 passed** (4+ new committed-state cases added on top of Phase 51's baseline).
- CSS diff strictly append-only.
- `git diff src/styles/snippet-tree-picker.css` shows only added lines under Phase 56 D-10 marker.

## Success Criteria coverage
- SC 7 ✅ — «Выбрать эту папку» button transitions to persistent committed state on click; reverts on drill-away / unmount.
