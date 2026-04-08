---
phase: 13-sidebar-canvas-selector-and-run-again
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/styles.css
  - src/views/runner-view.ts
  - src/__tests__/RunnerView.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three source files were reviewed: the stylesheet (`src/styles.css`), the main view logic (`src/views/runner-view.ts`), and the unit test suite (`src/__tests__/RunnerView.test.ts`).

The implementation is generally solid. Session management, canvas switching confirmation via `CanvasSwitchModal`, and the "Run again" path are well-structured. The `registerDomEvent` / `registerEvent` pattern is used consistently — with one exception noted below (WR-03). No critical security or correctness bugs were found.

Four warnings were found: a stale-DOM / runner-state-corruption hazard in `handleSnippetFill` when concurrent re-renders occur; a double session-clear on every normal protocol start; a `rename` handler guard that should be more explicit; and a unit test that asserts nothing about the actual `getDisplayText` return value. Three informational issues cover a duplicate CSS `is-selected` rule, a vacuous always-passing test, and a test description that disagrees with the implementation.

---

## Warnings

### WR-01: `handleSnippetFill` mutates a potentially stale `questionZone` after a concurrent re-render

**File:** `src/views/runner-view.ts:413-481`

**Issue:** `handleSnippetFill` is launched fire-and-forget (`void this.handleSnippetFill(...)`) inside `render()` at line 414, with a reference to the `questionZone` `div` created in that render cycle. The method suspends twice: at `snippetService.load()` (line 460) and at `modal.result` (line 473). Between either suspension, another code path can call `render()` — for example, the user clicks "Step back" in a parallel view, or a vault event triggers a rebuild. When `render()` runs again, `contentEl.empty()` is called (line 259), removing the original `questionZone` from the DOM. The `handleSnippetFill` continuation then calls `questionZone.empty()` and `questionZone.createEl(...)` on the now-detached element (lines 463-468). The mutations succeed silently but are never displayed to the user.

More critically, after the second suspension the code calls `this.runner.completeSnippet(rendered)` (line 475 or 478) regardless of whether the runner is still in the `awaiting-snippet-fill` state. If a concurrent path already advanced the runner, `completeSnippet` is invoked on an unexpected state and may corrupt runner state.

**Fix:** Track render generations and bail out from stale continuations:

```typescript
// Add field to class:
private renderGeneration = 0;

// At the top of render(), before contentEl.empty():
const generation = ++this.renderGeneration;

// Change handleSnippetFill signature to accept generation:
private async handleSnippetFill(
  snippetId: string,
  questionZone: HTMLElement,
  generation: number,
): Promise<void> {
  const snippet = await this.plugin.snippetService.load(snippetId);
  if (generation !== this.renderGeneration) return; // render was superseded

  if (snippet === null) {
    questionZone.empty();
    questionZone.createEl('p', {
      text: `Snippet '${snippetId}' not found. ...`,
      cls: 'rp-empty-state-body',
    });
    return;
  }

  const modal = new SnippetFillInModal(this.app, snippet);
  modal.open();
  const rendered = await modal.result;
  if (generation !== this.renderGeneration) return; // render was superseded after modal

  this.runner.completeSnippet(rendered ?? '');
  void this.autoSaveSession();
  this.render();
}

// In render(), awaiting-snippet-fill branch:
void this.handleSnippetFill(state.snippetId, questionZone, generation);
```

---

### WR-02: Session is cleared twice on every normal (non-resume) protocol start

**File:** `src/views/runner-view.ts:128-134`

**Issue:** When a session is found and the user picks "start-over", `sessionService.clear()` is called at line 128. Execution then falls through to line 134, which calls `sessionService.clear()` a second time for the same `filePath`. This is a double-write on the start-over path.

For the more common `session === null` path (line 90), there is no session file to clear, yet line 134 still fires a `clear()` unconditionally. The comment at line 132 says this is "SESSION-01 Pitfall 3: clear any stale session file once per fresh run", but when the load at line 89 returned `null`, the file does not exist. The call is redundant overhead and will cause tracing confusion because it appears to be the single canonical clear site when it is not.

**Fix:** Remove the unconditional clear at line 134. The start-over branch at line 128 already handles its own clear; the `session === null` branch needs no clear at all.

```typescript
// Remove lines 132-134 (the comment + the redundant clear):
// SESSION-01 Pitfall 3: ...
// await this.plugin.sessionService.clear(filePath);

this.graph = graph;
this.runner.start(graph);
this.render();
```

---

### WR-03: `rename` handler null-guard for `canvasFilePath` is implicit, not explicit

**File:** `src/views/runner-view.ts:177-185`

**Issue:** Inside `vault.on('rename', ...)`, the condition `oldPath === this.canvasFilePath` correctly evaluates to `false` when `this.canvasFilePath` is `null` (a renamed path is always a non-empty string). The logic is therefore safe, but the intent is not obvious — a reader must reason that `string === null` is always false. Future changes to the comparison (e.g., adding a fallback empty string) could accidentally match `null`. Additionally, the `null` case is not documented.

**Fix:** Add an explicit null guard to make intent self-documenting:

```typescript
this.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => {
    if (file instanceof TFile && file.extension === 'canvas') {
      this.selector?.rebuildIfOpen();
      if (this.canvasFilePath !== null && oldPath === this.canvasFilePath) {
        this.canvasFilePath = file.path;
        this.selector?.setSelectedPath(file.path);
      }
    }
  })
);
```

---

### WR-04: `getDisplayText` test makes no assertion about the actual return value

**File:** `src/__tests__/RunnerView.test.ts:23-26`

**Issue:** The test `UI-12: getDisplayText returns RadiProtocol runner` asserts only that the property is a function (`typeof ... === 'function'`). The comment states "Full value verified in integration — stub checks method exists." No integration test is visible, and the actual return value in `runner-view.ts:35` is `'Protocol runner'`. If someone changes this string, the test continues to pass. Additionally, the test *description* says the expected value is `'RadiProtocol runner'`, which differs from the implementation value `'Protocol runner'` — the description is already wrong.

**Fix:** Add the value assertion (the method has no dependencies and is safe to call on the prototype):

```typescript
it('UI-12: getDisplayText returns "Protocol runner"', () => {
  expect(RunnerView.prototype.getDisplayText()).toBe('Protocol runner');
});
```

---

## Info

### IN-01: Duplicate `is-selected` CSS rule for `.rp-selector-file-row`

**File:** `src/styles.css:507-510` and `src/styles.css:548-551`

**Issue:** `.rp-selector-row.is-selected` at line 507 covers all `.rp-selector-row` elements that carry `is-selected`, which includes `.rp-selector-file-row` (since it inherits the base class). The separate `.rp-selector-file-row.is-selected` rule at line 548 declares identical property values. The second rule is dead code — it cannot produce a different computed style because it has equal specificity and the same declarations.

**Fix:** Remove the duplicate block:

```css
/* Remove lines 548-551 — already covered by .rp-selector-row.is-selected */
```

---

### IN-02: Vacuous test always passes regardless of implementation

**File:** `src/__tests__/RunnerView.test.ts:57-62`

**Issue:** The test `SIDEBAR-01: CanvasSelectorWidget mock is registered` asserts `expect(true).toBe(true)`. The comment explains that a removed import would cause an error elsewhere, but this assertion provides no signal. It will pass even if the file is completely emptied.

**Fix:** Replace with an observable assertion or remove:

```typescript
it('SIDEBAR-01: CanvasSelectorWidget class is importable (mock guard)', async () => {
  const { CanvasSelectorWidget } = await import('../views/canvas-selector-widget');
  expect(CanvasSelectorWidget).toBeDefined();
});
```

---

### IN-03: Test description says "RadiProtocol runner" but implementation returns "Protocol runner"

**File:** `src/__tests__/RunnerView.test.ts:23`

**Issue:** The test description reads `getDisplayText returns RadiProtocol runner`, but `runner-view.ts:35` returns the string `'Protocol runner'` (without the "Radi" prefix). The mismatch is confusing — it is unclear whether the display text was changed intentionally or the description was written against an earlier design. This is related to WR-04 above.

**Fix:** Align the description with the implementation (and add the value assertion per WR-04):

```typescript
it('UI-12: getDisplayText returns "Protocol runner"', () => {
  expect(RunnerView.prototype.getDisplayText()).toBe('Protocol runner');
});
```

---

_Reviewed: 2026-04-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
