---
phase: 54-inline-protocol-display-mode
fixed_at: 2026-04-21T12:15:00Z
review_path: Z:\projects\RadiProtocolObsidian\.planning\phases\54-inline-protocol-display-mode\54-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 54: Code Review Fix Report

**Fixed at:** 2026-04-21T12:15:00Z
**Source review:** Z:\projects\RadiProtocolObsidian\.planning\phases\54-inline-protocol-display-mode\54-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Stale closure in SnippetTreePicker `onSelect` callback

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Added a DOM-attached check (`document.body.contains(this.containerEl)`) after the state guard in the `onSelect` callback. For error cases (snippet not found, validation error), replaced direct writes to the captured `questionZone` with a re-render to get a fresh DOM, then query for the new `.rp-question-zone` element to display the error message. This prevents silent writes to detached DOM nodes when the modal has been closed or re-rendered between the async `snippetService.load()` call and the callback resolution.

### CR-02: Concurrent `vault.modify` on target note

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Wrapped the read-modify-write sequence in `appendAnswerToNote()` with `this.plugin['insertMutex'].runExclusive(this.targetNote.path, ...)` to serialize writes, matching the pattern already used by `insertIntoCurrentNote()` in `main.ts`. This prevents race conditions when the user manually edits the note, another plugin modifies it, or multiple inline runners target the same note.

### WR-01: `handleAnswerClick` text-diff logic is fragile

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Added a defensive check `if (!afterText.startsWith(beforeText))` before computing the diff. If text changed non-monotonically (violating the append-only invariant), logs a warning and skips the append. This protects against future changes that might produce non-append-only text.

### WR-02: `handleLoopBranchClick` text extraction has incomplete state coverage

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Added an `else` clause to the state coverage chain that catches `idle`, `error`, and any other unexpected states. Sets `afterText = beforeText` to preserve the baseline (no spurious append) and logs a warning with the unexpected state name.

### WR-03: `handleSnippetFill` path resolution may double-prefix paths

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Added a check `snippetId.startsWith(root + '/')` before the existing `isPhase51FullPath` logic. If the snippetId already starts with the root path, it's used as-is without prepending. This prevents double-prefixing when the snippetId is already an absolute vault path like `snippets/my-snippet.json`.

### WR-04: `renderSnippetFillIn` captures input values by reference

**Files modified:** `src/views/inline-runner-modal.ts`
**Commit:** cd2baa3
**Applied fix:** Changed the submit handler to copy array values before processing: `[...val].join(...)` instead of `val.join(...)`. This prevents mutation-after-submit issues where the `selectedChoices` array could be in an unexpected state if the form is re-rendered before the async `appendAnswerToNote` completes.

### WR-05: SuggestModal canvas picker is not dismissed on plugin unload

**Files modified:** `src/main.ts`
**Commit:** cd2baa3
**Applied fix:** Added a `pickerModal` field to the plugin class. The anonymous `SuggestModal` instance is now stored in this field when created. On `onunload()`, the picker is explicitly closed if still open. The field is also cleared in `onChooseSuggestion` when the user makes a selection, so the close is a no-op in the normal case.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-04-21T12:15:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
