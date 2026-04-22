---
phase: 54-inline-protocol-display-mode
reviewed: 2026-04-21T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/views/inline-runner-modal.ts
  - src/main.ts
  - src/styles/inline-runner.css
  - esbuild.config.mjs
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-04-21T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the inline protocol display mode implementation: a new `InlineRunnerModal` class (951 lines), integration in `main.ts`, CSS styles, and esbuild config. The feature is well-structured with good lifecycle management, but there are two critical issues (stale-closure race in snippet picker, potential double vault.modify), five warnings around error handling and edge cases, and several info-level suggestions.

---

## Critical Issues

### CR-01: Stale closure in SnippetTreePicker `onSelect` callback — race between picker selection and state transitions

**File:** `src/views/inline-runner-modal.ts:573-603`
**Issue:** The `onSelect` callback passed to `SnippetTreePicker` captures `state.nodeId` via `capturedNodeId` (line 573), and later checks `currentState.nodeId !== capturedNodeId` to guard against stale picks. However, the callback also captures a closure over `questionZone` (the `HTMLElement` passed to `renderSnippetPicker`). Between the time the user clicks a snippet and the async `onSelect` handler resolves (which awaits `snippetService.load()`), `render()` may have been called for a different state, which calls `questionZone.empty()` and creates a *new* `questionZone` div. The stale `questionZone` reference still points at a detached DOM node. Writing to it (lines 587-596, `questionZone.empty()`, `questionZone.createEl(...)`) silently succeeds on a detached element — the user sees nothing.

Worse, if the user steps back (line 608-614) which unmounts the picker and re-renders, the `onSelect` callback may still fire after the picker is unmounted, operating on a detached DOM tree.

**Fix:**
```typescript
// In onSelect callback, after the state guard, also verify the DOM is still attached:
if (
  currentState.status !== 'awaiting-snippet-pick' ||
  currentState.nodeId !== capturedNodeId
) {
  return;
}

// Add a check that this.containerEl is still in the DOM:
if (this.containerEl === null || !document.body.contains(this.containerEl)) {
  return;
}

// Instead of using the captured questionZone, re-render from scratch:
this.render();
// Then handle the snippet result...
```

A cleaner approach: after `snippetService.load()` resolves, call `this.render()` first to get the fresh DOM, then handle the snippet selection result from there, or store the selection result and let `render()` pick it up.

### CR-02: Concurrent `vault.modify` on target note — `appendAnswerToNote` races with `insertIntoCurrentNote`

**File:** `src/views/inline-runner-modal.ts:357-364`
**Issue:** `appendAnswerToNote()` reads the note content, then writes it back with `vault.modify()`. This is a classic read-modify-write race. If another process (or the user) modifies the note between the `vault.read()` and `vault.modify()`, those changes are silently lost.

Compare with `main.ts:280-293` where `insertIntoCurrentNote()` correctly uses `insertMutex.runExclusive()` to serialize writes. `appendAnswerToNote()` has no such protection.

In practice this could happen if:
- The user manually edits the note while the protocol is running
- Another plugin modifies the same note
- Multiple inline runners target the same note

**Fix:**
```typescript
// Option A: Reuse the plugin's insertMutex (preferred — consistent with insertIntoCurrentNote)
private async appendAnswerToNote(text: string): Promise<void> {
  await this.plugin['insertMutex'].runExclusive(this.targetNote.path, async () => {
    const currentContent = await this.app.vault.read(this.targetNote);
    let toAppend = text;
    const sep = this.resolveSeparator();
    if (currentContent.endsWith(sep) && text.startsWith(sep)) {
      toAppend = text.slice(sep.length);
    }
    const newContent = currentContent + toAppend;
    await this.app.vault.modify(this.targetNote, newContent);
  });
}
```

If `insertMutex` is private, either expose a public method on the plugin that wraps it, or create a dedicated mutex in `InlineRunnerModal`.

---

## Warnings

### WR-01: `handleAnswerClick` text-diff logic is fragile — assumes append-only

**File:** `src/views/inline-runner-modal.ts:338-350`
**Issue:** The code computes `appendedText = afterText.slice(beforeText.length)` assuming the accumulated text only grows. If the runner ever produces text that replaces or rewrites earlier content (e.g., a text-block that overwrites), this diff will capture the wrong substring, potentially inserting duplicate or garbled content into the note.

This is currently safe because the runner only appends, but it's a fragile invariant with no assertion or comment.

**Fix:** Add a defensive check:
```typescript
if (!afterText.startsWith(beforeText)) {
  console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
  return;
}
const appendedText = afterText.slice(beforeText.length);
```

### WR-02: `handleLoopBranchClick` text extraction has incomplete state coverage

**File:** `src/views/inline-runner-modal.ts:380-393`
**Issue:** The `afterText` extraction after `chooseLoopBranch()` handles `at-node`, `awaiting-loop-pick`, `complete`, `awaiting-snippet-pick`, and `awaiting-snippet-fill`, but does NOT handle `idle` or `error` states. If the loop branch choice triggers an error or transitions to idle, `afterText` remains `''` and the text diff silently does nothing. The user loses any accumulated text from that iteration.

**Fix:** Add a default case with logging:
```typescript
} else {
  console.warn('[RadiProtocol] Unexpected state after loop branch:', stateAfter.status);
  afterText = beforeText; // preserve baseline so no spurious append occurs
}
```

### WR-03: `handleSnippetFill` path resolution may double-prefix paths

**File:** `src/views/inline-runner-modal.ts:476-481`
**Issue:** The `isPhase51FullPath` heuristic checks if `snippetId` contains `/` or ends with `.md`/`.json`. If it does, it prepends `${root}/` to create `absPath`. But if `snippetId` is already an absolute vault path (e.g., `snippets/my-snippet.json`), the result becomes `${root}/snippets/my-snippet.json` which is wrong — it double-prefixes.

Compare with `handleSnippetPickerSelection` (line 456) which uses `result.relativePath` and correctly constructs `absPath` as `${nodeRootAbs}/${result.relativePath}`. The two methods handle paths inconsistently.

**Fix:** If `snippetId` is already vault-relative (starts without `/` but contains the root path), don't prepend. Or better, standardize on a single path resolution strategy:
```typescript
const absPath = snippetId.startsWith(root + '/')
  ? snippetId
  : isPhase51FullPath
    ? `${root}/${snippetId}`
    : `${root}/${snippetId}.json`;
```

### WR-04: `renderSnippetFillIn` captures input values by reference — mutation after submit

**File:** `src/views/inline-runner-modal.ts:520-523`
**Issue:** For `choice` type placeholders, `selectedChoices` is an array reference stored in `values[placeholder.id]`. The `change` handler mutates this array in-place with `push()` and `splice()`. On submit (line 545), `Object.entries(values)` iterates this same reference. If the user submits, then the form is re-rendered before the async `appendAnswerToNote` completes, the array could be in an unexpected state.

This is currently low-risk because `render()` is called after submit which destroys the form, but the pattern is fragile.

**Fix:** On submit, copy the array values before processing:
```typescript
const filledValues: Record<string, string> = {};
for (const [key, val] of Object.entries(values)) {
  if (Array.isArray(val)) {
    filledValues[key] = [...val].join(this.plugin.settings.textSeparator);
  } else {
    filledValues[key] = val as string;
  }
}
```

### WR-05: SuggestModal canvas picker is not dismissed on plugin unload

**File:** `src/main.ts:458-479`
**Issue:** The anonymous `SuggestModal` subclass created in `handleRunProtocolInline()` is opened but never explicitly closed. If the plugin is unloaded while the picker is open (e.g., during development hot-reload), the modal remains on screen with a broken reference to the plugin. Obsidian's `SuggestModal` does register itself with `this.register()` internally, but this anonymous class doesn't call `register()` on itself.

**Fix:** Store a reference and close it in `onunload()`, or use `picker.open()` followed by `this.register(picker)` if the plugin context is available. For this inline pattern, the risk is low (only during dev), but worth noting.

---

## Info

### IN-01: `console.debug` statement in production code

**File:** `src/views/inline-runner-modal.ts:60`
**Issue:** `console.debug('[RadiProtocol] InlineRunnerModal.open()', this.canvasFilePath);` will emit in production builds. While `debug` level is typically filtered, it's still unnecessary noise.

**Fix:** Either remove or gate behind a debug flag from settings.

### IN-02: Unused import `TFolder` in `inline-runner-modal.ts`

**File:** `src/views/inline-runner-modal.ts:4`
**Issue:** `TFolder` is imported from `obsidian` but never used in this file. It's used in `main.ts` but not in `inline-runner-modal.ts`.

**Fix:** Remove `TFolder` from the import statement.

### IN-03: Redundant `as string` type assertions

**File:** `src/views/inline-runner-modal.ts:210,226`
**Issue:** After the `isFileBound` guard checks `typeof snippetNode.radiprotocol_snippetPath === 'string'`, the code still uses `as string` to cast. TypeScript's type narrowing already handles this.

**Fix:** Remove the `as string` casts — the type guard is sufficient.

### IN-04: `handleSnippetFill` has confusing md-snippet branch

**File:** `src/views/inline-runner-modal.ts:494-501`
**Issue:** If the snippet is an `MdSnippet` and `isPhase51FullPath` is true, it completes and appends. But if `isPhase51FullPath` is false (e.g., the snippetId is just a basename), it shows "Snippet not found" — even though the snippet WAS found (we're inside the `snippet !== null` branch). The error message is misleading.

**Fix:** Clarify the error message or restructure the logic:
```typescript
if (snippet.kind === 'md') {
  this.runner.completeSnippet(snippet.content);
  await this.appendAnswerToNote(snippet.content);
  this.render();
  return;
}
// No need for the "not found" branch — if we got here with an md snippet, just use it.
```

---

_Reviewed: 2026-04-21T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
