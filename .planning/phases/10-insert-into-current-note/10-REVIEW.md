---
phase: 10-insert-into-current-note
reviewed: 2026-04-08T08:25:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/main.ts
  - src/views/runner-view.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-08T08:25:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 10 adds the "Insert into current note" feature: a new `insertIntoCurrentNote()` method in `main.ts` and a corresponding button in the `RunnerView` output toolbar in `runner-view.ts`. The implementation is well-structured — it reuses the existing `WriteMutex` for safe concurrent writes, correctly gates the button on active-leaf state, and wires up an `active-leaf-change` listener to keep the enabled state in sync.

Two warning-level issues were found: a button enabled/disabled ordering bug that can briefly render the insert button clickable even when output is not ready, and a subtle timing issue where the `Notice` confirming insertion fires before the vault write completes. Two info-level issues round out the findings (stale phase comment in the file header, and a pattern inconsistency in how the Notice for insert is delivered vs. save/copy).

---

## Warnings

### WR-01: Insert button disabled-state ordering — button is briefly enabled before guard check

**File:** `src/views/runner-view.ts:512-518`

**Issue:** `insertBtn.disabled = !hasActiveNote()` is set on line 512 based on the active note check. Then on line 514, the code checks `if (!enabled || text === null)` and sets `insertBtn.disabled = true` inside the branch. This order means that when `enabled=false` (idle, at-node, awaiting-snippet-fill states), the button is first set to reflect the real active-note state (potentially `false` = enabled) before being forced to `true` inside the guard. Although this happens synchronously in one render call so no user interaction is possible in between, it is an observable pattern bug: if `hasActiveNote()` returns `true`, the DOM attribute is written twice in opposite directions within the same call, and the final guard write correctly wins. However, the intent described in comment D-05/D-08 is that the button's initial enabled/disabled state should reflect `enabled && hasActiveNote()`, not `hasActiveNote()` alone. The current code will also incorrectly show the button as enabled momentarily in the DOM if a browser queues a paint between the two attribute writes (highly unlikely in Obsidian's synchronous renderer, but architecturally wrong).

**Fix:** Set the initial disabled state only after the `enabled` guard check, or combine both conditions into a single assignment:
```typescript
// Replace lines 511-518 with the following block:

if (!enabled || text === null) {
  copyBtn.disabled = true;
  saveBtn.disabled = true;
  insertBtn.disabled = true;
  return;
}

// Only reach here when enabled=true and text is non-null:
insertBtn.disabled = !hasActiveNote();
```
This ensures the insert button is only conditionally enabled (based on active note) when the toolbar is in an active state, and is unconditionally disabled otherwise.

---

### WR-02: `Notice` fires outside the mutex — insert confirmation shown before write completes on error

**File:** `src/main.ts:232-233`

**Issue:** The `new Notice(...)` call on line 232 is placed after `await this.insertMutex.runExclusive(...)` but is not inside the mutex callback, so it executes after the lock is released. This is generally fine when the write succeeds. However, `vault.modify()` can throw (e.g., if the file is deleted between the `read` and `modify` calls), and the thrown error will propagate out of `insertMutex.runExclusive()` — meaning `new Notice(...)` is never reached and the user sees no feedback at all. More importantly, if `vault.modify()` throws, the notice is silently swallowed: the caller in `runner-view.ts` calls `void this.plugin.insertIntoCurrentNote(finalText)` (fire-and-forget, line 548), so any rejected promise is unhandled.

**Fix:** Wrap the method body in a try/catch to surface errors to the user and ensure the success notice only fires on actual success:
```typescript
async insertIntoCurrentNote(text: string): Promise<void> {
  const { workspace, vault } = this.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);
  if (activeView === null || activeView.file === null) return;
  const file = activeView.file;
  try {
    await this.insertMutex.runExclusive(file.path, async () => {
      const existing = await vault.read(file);
      const separator = existing.trim().length === 0 ? '' : '\n\n---\n\n';
      await vault.modify(file, existing + separator + text);
    });
    new Notice(`Inserted into ${file.name}.`);
  } catch (err) {
    console.error('[RadiProtocol] insertIntoCurrentNote failed:', err);
    new Notice(`Failed to insert into ${file.name}. See console for details.`);
  }
}
```

---

## Info

### IN-01: Stale phase comment in `runner-view.ts` file header

**File:** `src/views/runner-view.ts:1`

**Issue:** The file-level comment reads `// views/runner-view.ts — Phase 5: Full RunnerView with awaiting-snippet-fill branch`. Phase 10 adds the insert-into-note button and its associated listener, but the comment still references "Phase 5". This misleads future readers about the file's current scope.

**Fix:** Update the comment to reflect the current phase, or remove the phase reference:
```typescript
// views/runner-view.ts — RunnerView: protocol runner UI with output toolbar
```

---

### IN-02: Notice delivery pattern inconsistency between insert and save/copy

**File:** `src/views/runner-view.ts:543-549`

**Issue:** The `saveBtn` click handler places the `Notice` inside a `.then()` callback (line 539-540), ensuring it fires only after the async `saveOutputToNote` resolves. The `insertBtn` click handler calls `void this.plugin.insertIntoCurrentNote(finalText)` without a `.then()` (line 548), relying on `insertIntoCurrentNote` itself to post the notice — which it does, but the pattern is inconsistent with the save handler and slightly harder to trace at a glance.

This is a style inconsistency, not a functional bug (the current approach is correct given the notice is inside `insertIntoCurrentNote`). The pattern could be made consistent in one of two ways: move the notice into the click handler via `.then()`, or move the save notice inside `saveOutputToNote` to match the insert pattern.

**Fix (option A — match the insert pattern by moving the notice into `saveOutputToNote`):**
Remove the `.then(() => { new Notice('Report saved to note.'); })` from the click handler and add a notice inside `saveOutputToNote` after `workspace.getLeaf('tab').openFile(file)`.

**Fix (option B — match the save pattern by adding `.then()` to the insert handler):**
```typescript
this.registerDomEvent(insertBtn, 'click', () => {
  const state = this.runner.getState();
  const finalText = state.status === 'complete'
    ? (state as CompleteState).finalText
    : capturedText;
  // Notice is issued inside insertIntoCurrentNote — consistent with current design
  void this.plugin.insertIntoCurrentNote(finalText);
});
```
(No code change needed if option B is chosen; just add a comment clarifying the deliberate pattern.)

---

_Reviewed: 2026-04-08T08:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
