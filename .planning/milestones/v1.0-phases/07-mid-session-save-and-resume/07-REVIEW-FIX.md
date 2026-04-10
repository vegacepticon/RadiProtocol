---
phase: 07-mid-session-save-and-resume
fixed_at: 2026-04-07T00:00:00Z
review_path: .planning/phases/07-mid-session-save-and-resume/07-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-04-07T00:00:00Z
**Source review:** .planning/phases/07-mid-session-save-and-resume/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `session-service.test.ts` — Tests assert a branching write API that the implementation does not have

**Files modified:** `src/__tests__/session-service.test.ts`
**Commit:** 21d1cd9
**Applied fix:** Replaced the two branching tests (`vault.create` when file absent, `vault.adapter.write` when file present) with a single test that iterates over both `existsResult` values and asserts the actual invariant: `vault.adapter.write` is always called once and `vault.create` is never called.

---

### WR-02: `SessionService.clear()` is not mutex-guarded — save/clear race possible

**Files modified:** `src/sessions/session-service.ts`
**Commit:** 00b75f9
**Applied fix:** Wrapped the `clear()` body (`adapter.exists` + `adapter.remove`) inside `this.mutex.runExclusive(filePath, ...)`, using the same key as `save()`. This eliminates the race where a concurrent `save()` could write a file that a concurrent `clear()` then deletes, or vice versa.

---

### WR-03: `ResumeSessionModal.settle()` — `contentEl.empty()` executes before `resolve(choice)` in button-click path

**Files modified:** `src/views/resume-session-modal.ts`
**Commit:** 6d5d74d
**Applied fix:** Swapped the order inside `settle()` so `this.resolve(choice)` is called before `this.close()`. The promise now resolves before `onClose()` fires and clears the DOM, making the ordering safe and non-fragile if Obsidian's `Modal.close()` ever becomes asynchronous.

---

_Fixed: 2026-04-07T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
