---
phase: 07-mid-session-save-and-resume
reviewed: 2026-04-07T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/sessions/session-model.ts
  - src/sessions/session-service.ts
  - src/views/resume-session-modal.ts
  - src/views/runner-view.ts
  - src/main.ts
  - src/runner/protocol-runner.ts
  - src/settings.ts
  - src/__tests__/session-service.test.ts
  - src/__tests__/runner/protocol-runner-session.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-07
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The phase implements mid-session save and resume for the RadiProtocol Obsidian plugin. The core
architecture is sound: `vault.adapter.write/read/remove` are used consistently instead of the
vault index API (correctly avoiding the `%2F` path-normalisation pitfall), `onLayoutReady` defers
session restore to prevent the layout-hang regression, and `ResumeSessionModal` uses a
double-resolve guard for Escape/button races. The `ProtocolRunner.restoreFrom()` and
`getSerializableState()` methods are clean, symmetric, and well-tested.

Two warning-level findings require attention before shipping:

1. The `session-service.test.ts` suite has two tests that assert a `vault.create`/`vault.adapter.write`
   branching API that the implementation does not have — the tests will fail against the real code.
2. `SessionService.clear()` is not protected by the write mutex, creating a potential save/clear race.

One additional warning concerns the `onClose` → `settle` → `close()` re-entrancy cycle in
`ResumeSessionModal`. It is safe due to the `resolved` guard, but the ordering means `contentEl.empty()`
executes before `this.resolve(choice)` returns in the button-click path, which is unexpected and
could become a real bug if the modal is extended.

---

## Warnings

### WR-01: `session-service.test.ts` — Tests assert a branching write API that the implementation does not have

**File:** `src/__tests__/session-service.test.ts:68-83`

**Issue:** The test block `'SessionService.save() write behavior (SESSION-01)'` contains two tests:

- `"calls vault.create when file does not yet exist"` (line 69) — asserts that `vault.create` is
  called and `vault.adapter.write` is NOT called when `existsResult = false`.
- `"calls vault.adapter.write (not vault.create) when file already exists"` (line 76) — asserts that
  `vault.adapter.write` is called and `vault.create` is NOT called when `existsResult = true`.

`SessionService.save()` (session-service.ts:41-49) uses `vault.adapter.write()` unconditionally
regardless of whether the file exists. It never calls `vault.create`. Both tests will fail:
the first because `vault.create` is never called and `vault.adapter.write` is always called;
the second happens to pass only because the mock returns `existsResult = true` yet the
implementation still reaches `vault.adapter.write`.

Running the suite will produce one failing test and one accidentally-passing test testing the wrong
contract. This is a correctness issue: the tests do not reflect the design decision documented in
the `save()` JSDoc (which explicitly says "always uses vault.adapter.write()").

**Fix:** Replace the two branching tests with a single test that asserts the actual invariant:

```typescript
describe('SessionService.save() write behavior (SESSION-01)', () => {
  it('always calls vault.adapter.write (never vault.create) regardless of file existence', async () => {
    for (const existsResult of [false, true]) {
      const app = makeAppMock(existsResult);
      const svc = new SessionService(app as never, '.radiprotocol/sessions');
      await svc.save(makeSession());
      expect(app.vault.adapter.write).toHaveBeenCalledTimes(1);
      expect(app.vault.create).not.toHaveBeenCalled();
    }
  });
});
```

---

### WR-02: `SessionService.clear()` is not mutex-guarded — save/clear race possible

**File:** `src/sessions/session-service.ts:87-92`

**Issue:** `save()` wraps its vault writes inside `mutex.runExclusive(filePath, ...)` (line 45),
but `clear()` calls `vault.adapter.exists()` and `vault.adapter.remove()` outside any lock.

If `save()` and `clear()` are called concurrently on the same canvas path — which can happen when
the user clicks "complete" while an auto-save triggered by the last answer is still in flight —
the following interleaving is possible:

1. `clear()` calls `adapter.exists()` → returns `true`
2. `save()` acquires the mutex and begins writing
3. `clear()` calls `adapter.remove()` and deletes the partially-written file (or the file that
   save() just finished writing)
4. `save()` returns successfully from its perspective, but the file is now gone

The result is a silently deleted session. On the next Obsidian restart there will be no session
to resume even though the runner appeared to complete correctly.

**Fix:** Run the `clear()` body inside `mutex.runExclusive()` on the same key used by `save()`:

```typescript
async clear(canvasFilePath: string): Promise<void> {
  const filePath = this.sessionFilePath(canvasFilePath);
  await this.mutex.runExclusive(filePath, async () => {
    const exists = await this.app.vault.adapter.exists(filePath);
    if (!exists) return;
    await this.app.vault.adapter.remove(filePath);
  });
}
```

---

### WR-03: `ResumeSessionModal.onClose` — `contentEl.empty()` executes before `resolve(choice)` in button-click path

**File:** `src/views/resume-session-modal.ts:62-74`

**Issue:** When the user clicks a button, the call chain is:

1. Button click handler calls `settle('resume')` (line 58 or 59)
2. `settle` checks `this.resolved` (false), sets it to `true`, then calls `this.close()` (line 72)
3. Obsidian's `Modal.close()` synchronously fires `onClose()` (line 62)
4. `onClose` calls `settle('start-over')` — guarded off because `resolved` is now `true`
5. `onClose` then calls `this.contentEl.empty()` (line 65) — **DOM is cleared here**
6. Control returns up the call stack back into the original `settle()` call
7. `this.resolve(choice)` is finally called (line 73) — the promise resolves **after** the DOM clear

Downstream code that `await modal.result` may attempt to read `contentEl` content after the
promise resolves and find it empty. More importantly, if Obsidian ever changes `Modal.close()` to
be asynchronous, this sequence breaks. The `contentEl.empty()` call also runs redundantly in the
`onClose` path for both button-click and Escape — when triggered by a button, the modal's DOM
is cleared before the awaiting caller gets to process the choice.

This is safe today with the current Obsidian API, but the ordering is fragile. Move
`contentEl.empty()` to after the resolve, or clear only in the non-button-click path:

```typescript
onClose(): void {
  this.settle('start-over');
  // Only clear if not already resolved by a button click
  // (settle() already resolved the promise in the button path)
  this.contentEl.empty();
}

private settle(choice: ResumeChoice): void {
  if (this.resolved) return;
  this.resolved = true;
  this.resolve(choice);   // resolve FIRST
  this.close();           // close AFTER — onClose will call contentEl.empty()
}
```

Note: with this ordering `this.close()` still triggers `onClose()`, but `settle` inside `onClose`
is guarded off and only `contentEl.empty()` runs, which is correct.

---

## Info

### IN-01: `makeVaultMock` in test does not include `adapter.remove` — brittle mock

**File:** `src/__tests__/session-service.test.ts:8-20`

**Issue:** `makeVaultMock` defines `adapter.exists`, `adapter.read`, and `adapter.write` but not
`adapter.remove`. If a future test exercises `svc.clear()` with `existsResult = true`, the call
to `this.app.vault.adapter.remove(filePath)` will throw `TypeError: ... is not a function`.
Currently no test triggers this path, but the omission means clear() success behavior is untested.

**Fix:** Add `remove` to the adapter mock and add a test verifying clear() calls remove when the
session file exists:

```typescript
function makeVaultMock(existsResult = false) {
  return {
    adapter: {
      exists: vi.fn().mockResolvedValue(existsResult),
      read: vi.fn().mockResolvedValue('{}'),
      write: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),   // add this
    },
    // ...
  };
}
```

---

### IN-02: `validateSessionNodeIds` comment incorrectly justifies O(n²) dedup by citing SESSION-07

**File:** `src/sessions/session-service.ts:144-145`

**Issue:** The comment `// Remove duplicates without using Set (SESSION-07: prefer arrays)` at
line 144 incorrectly applies a SESSION-07 concern (Set values are not JSON-serializable) to a
result that is never serialized. `validateSessionNodeIds` returns a `string[]` to `RunnerView`
which uses it only for `.length` and an error message — it is never written to disk.

Using `[...new Set(missing)]` here would be cleaner and the SESSION-07 rationale does not apply.
The current code is not wrong (the O(n²) concern is out of v1 scope), but the misleading comment
may cause future maintainers to cargo-cult the array-dedup pattern in places where Set is
actually fine.

**Fix:** Either use `[...new Set(missing)]` and remove the comment, or correct the comment to
explain the actual motivation (e.g. "avoid dependency on Set in case this utility is ever
serialized, as a conservative choice"):

```typescript
// Return deduplicated array; Set not used here but this function is intentionally
// side-effect-free and has no dependency on built-ins beyond Array.
return [...new Set(missing)];
```

---

### IN-03: `main.ts` `onunload` declared `async` with no awaited operations

**File:** `src/main.ts:115-117`

**Issue:** `onunload` is declared `async` but its body contains only a `console.debug` call.
Obsidian calls `onunload` synchronously as part of plugin cleanup; the `async` declaration causes
it to return a `Promise<void>` that Obsidian silently ignores. This is harmless today but
misleading — if a future developer adds cleanup logic assuming it will be awaited, it will not be.

**Fix:** Remove the `async` keyword:

```typescript
onunload(): void {
  console.debug('[RadiProtocol] Plugin unloaded');
}
```

---

_Reviewed: 2026-04-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
