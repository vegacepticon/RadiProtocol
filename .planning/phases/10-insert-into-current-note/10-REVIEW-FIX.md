---
phase: 10-insert-into-current-note
fixed_at: 2026-04-08T00:00:00Z
review_path: .planning/phases/10-insert-into-current-note/10-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-04-08
**Source review:** .planning/phases/10-insert-into-current-note/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Insert button disabled-state ordering — button is briefly enabled before guard check

**Files modified:** `src/views/runner-view.ts`
**Commit:** caeb1ee
**Applied fix:** Moved the `insertBtn.disabled = !hasActiveNote()` assignment to after the `if (!enabled || text === null)` guard block. The guard now unconditionally disables all three buttons and returns early when the toolbar is inactive; the active-note check only runs when `enabled=true` and `text` is non-null, ensuring the DOM is written once with the correct final value.

### WR-02: `Notice` fires outside the mutex — insert confirmation shown before write completes on error

**Files modified:** `src/main.ts`
**Commit:** 23c79b5
**Applied fix:** Wrapped the `insertMutex.runExclusive(...)` call and success `Notice` in a `try/catch`. The success notice (`Inserted into ${file.name}.`) now only fires after the vault write succeeds. On failure, the error is logged to the console via `console.error` and an error notice (`Failed to insert into ${file.name}. See console for details.`) is shown to the user, preventing silent failures from the fire-and-forget call site in `runner-view.ts`.

---

_Fixed: 2026-04-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
