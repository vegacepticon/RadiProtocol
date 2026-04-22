---
phase: 47
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/runner-view.ts
  - src/__tests__/RunnerView.test.ts
autonomous: true
requirements:
  - RUNFIX-02
must_haves:
  truths:
    - "Clicking a choice button (answer / snippet-branch / loop-body / loop-exit) never resets the textarea scroll to 0 when content extends below the visible viewport"
    - "After the re-render triggered by a choice click, the textarea's scrollTop equals either the pre-click scrollTop or a value >= the pre-click scrollTop (forward scroll to insertion point is also acceptable per the todo)"
  artifacts:
    - path: "src/views/runner-view.ts"
      provides: "scrollTop capture before re-render + restore after renderPreviewZone"
      contains: "pendingTextareaScrollTop"
    - path: "src/__tests__/RunnerView.test.ts"
      provides: "RUNFIX-02 regression coverage"
      contains: "RUNFIX-02"
  key_links:
    - from: "src/views/runner-view.ts click handlers (answer / snippet-branch / loop-body / loop-exit)"
      to: "renderPreviewZone → new textarea element"
      via: "scroll capture before renderAsync, scroll restore inside renderPreviewZone's requestAnimationFrame (after height recompute)"
      pattern: "pendingTextareaScrollTop"
---

<objective>
Close RUNFIX-02: clicking a choice button in the Runner must preserve textarea scroll position (or advance to the insertion point) — it must never snap back to scrollTop=0 after the re-render.

Purpose: every choice click calls `this.renderAsync()` which calls `render()` which empties `contentEl` and rebuilds the textarea via `renderPreviewZone` (src/views/runner-view.ts:793-808). The new `<textarea>` is a fresh DOM element with default scrollTop=0, so long reports jump to the top on every click. Fix: capture scrollTop on the old textarea immediately before the advance, stash it on `this`, and restore it on the new textarea inside `renderPreviewZone`'s existing `requestAnimationFrame` (after height is computed, otherwise scrollTop has no effect on an auto-sized element).

Output: a single pending-scroll private field on RunnerView, captures wired into all four choice-button click handlers and the existing line-676 advance site, restore logic appended to `renderPreviewZone`, plus a vitest unit test that drives a choice click on a tall textarea and asserts scrollTop is retained.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/todos/pending/runner-textarea-preserve-scroll-on-insert.md
@./CLAUDE.md

<interfaces>
<!-- Key structures the executor needs. Extracted from src/views/runner-view.ts. -->

Existing RunnerView private field (line 23):
```typescript
private previewTextarea: HTMLTextAreaElement | null = null;
```

Existing renderPreviewZone (lines 793-808) — where the NEW textarea is built on every render:
```typescript
private renderPreviewZone(zone: HTMLElement, text: string): void {
  const textarea = zone.createEl('textarea', { cls: 'rp-preview-textarea' });
  textarea.value = text;
  textarea.style.width = '100%';
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
  this.registerDomEvent(textarea, 'input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
  this.previewTextarea = textarea;
}
```

Four choice-button click handler sites that currently lose scroll:
- Line 368-373: `.rp-answer-btn` click → syncManualEdit + chooseAnswer + autoSaveSession + renderAsync
- Line 388-393: `.rp-snippet-branch-btn` click → syncManualEdit + chooseSnippetBranch + autoSaveSession + renderAsync
- Line 478-483: `.rp-loop-body-btn` / `.rp-loop-exit-btn` click → syncManualEdit + chooseLoopBranch + autoSaveSession + renderAsync
- Line 675-676 (inside a different advance site — inspect context when reading; may be stepBack or an auto-advance; include if it re-renders)

`render()` (lines 306-320) runs `this.contentEl.empty()` and resets `this.previewTextarea = null` before rebuilding — confirming that the OLD textarea element is detached and scrollTop must be captured BEFORE renderAsync runs.

`renderAsync` invocation pattern (from each click handler):
```typescript
this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
this.runner.chooseAnswer(answerNode.id);
void this.autoSaveSession();
void this.renderAsync();   // <-- triggers render() → renderPreviewZone → new textarea
```
</interfaces>

<tests>
<!-- Mock-DOM / vitest patterns already in use in src/__tests__/RunnerView.test.ts -->
Existing RunnerView.test.ts (27 lines) is minimal — executor should extend it with a focused RUNFIX-02 describe block. Use Obsidian's ItemView mock already in tests/fixtures if present, or drive renderPreviewZone in isolation by constructing a minimal HTMLElement host and invoking the method directly.
</tests>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add pending-scroll capture + restore across choice clicks</name>
  <files>src/views/runner-view.ts, src/__tests__/RunnerView.test.ts</files>
  <read_first>
    - src/views/runner-view.ts (focus lines 20-30 for field block, 306-330 for render(), 360-400 for answer+snippet click handlers, 470-500 for loop-pick click handler, 665-685 for the site around line 675-676 syncManualEdit call, 793-810 for renderPreviewZone)
    - src/__tests__/RunnerView.test.ts (existing test file — 27 lines; inspect imports and mock patterns)
    - .planning/todos/pending/runner-textarea-preserve-scroll-on-insert.md
    - CLAUDE.md "Critical Rules for Editing Shared Files" section
  </read_first>
  <behavior>
    RED — write this test first:
    - Test (RUNFIX-02 scroll preservation on choice click):
      * Instantiate RunnerView (or call renderPreviewZone directly against a minimal host element if full view instantiation is blocked by Obsidian mocks).
      * Call `view['renderPreviewZone'](host, 'LINE\n'.repeat(200))` to build a tall textarea.
      * Simulate a user scroll: set `view['previewTextarea'].scrollTop = 500`.
      * Call the new internal method that captures pending scroll (e.g. `view['capturePendingTextareaScroll']()`), then trigger another `renderPreviewZone(host2, 'NEW LINE\n'.repeat(200))` to simulate the post-choice re-render.
      * Flush the requestAnimationFrame (use `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` or a `requestAnimationFrame` shim — match whatever pattern RunnerView.test.ts already uses; if none, use a microtask flush via `await new Promise(r => setTimeout(r, 0))` with a manual rAF polyfill calling cb synchronously).
      * Assert the new textarea's scrollTop >= 500 (retained or advanced; never reset to 0).

    Then additional assertion — verify scrollTop default remains 0 when no capture occurred (guard against leaking pending-scroll across unrelated renders):
    - After the assertion above, call renderPreviewZone a third time WITHOUT a preceding capture, assert scrollTop === 0 (the pending-scroll field must be consumed exactly once and cleared).

    GREEN — implement:
    1. Add private field `private pendingTextareaScrollTop: number | null = null;` alongside `previewTextarea` (near line 23 in the field block).
    2. Add private helper method `private capturePendingTextareaScroll(): void { this.pendingTextareaScrollTop = this.previewTextarea?.scrollTop ?? null; }`.
    3. In `renderPreviewZone` (lines 793-808), inside the existing `requestAnimationFrame` callback, AFTER the two `textarea.style.height = ...` lines, append:
       ```typescript
       if (this.pendingTextareaScrollTop !== null) {
         textarea.scrollTop = this.pendingTextareaScrollTop;
         this.pendingTextareaScrollTop = null;  // consume once
       }
       ```
    4. In each of the four choice-button click handlers, insert `this.capturePendingTextareaScroll();` AS THE FIRST LINE of the click handler — BEFORE the existing `syncManualEdit` call. Sites:
       - line 368 (`.rp-answer-btn` click)
       - line 388 (`.rp-snippet-branch-btn` click)
       - line 478 (`.rp-loop-body-btn` / `.rp-loop-exit-btn` click — one capture covers both buttons since they share the handler)
       - line 675 area (inspect context — if this site runs renderAsync and has a previewTextarea to preserve, insert the capture; if it's a pre-render or snippet-fill path with no scroll to preserve, skip and document why in the commit message)
    5. In `render()` at line 313 where `this.previewTextarea = null` is set, DO NOT clear `pendingTextareaScrollTop` — it must survive the render so `renderPreviewZone`'s rAF callback can consume it.

    Use the scrollTop value verbatim (no clamping, no "scroll to insertion point" translation) — the todo accepts "keep the previous scroll position OR scroll to the insertion point", and preserving verbatim is the simpler, safer choice that subsumes "never jump to the top". If native browser behaviour clamps scrollTop to the new content height that's fine — the assertion is "never resets to 0 when content is tall enough to scroll".
  </behavior>
  <action>
    Step 1 (RED): add the RUNFIX-02 describe block to src/__tests__/RunnerView.test.ts implementing the test above. If full RunnerView instantiation is not already exercised in this test file, drive renderPreviewZone as a unit by calling the private method through bracket notation (`view['renderPreviewZone']`) — same pattern used by other private-method tests in the codebase. Run `npm test -- RunnerView.test.ts` and confirm the new test FAILS (scrollTop resets to 0).

    Step 2 (GREEN): apply the 5 edits listed in `<behavior>` to src/views/runner-view.ts. Preserve every surrounding line unchanged — especially the BUG-01 capture-before-advance `syncManualEdit` calls must remain in all four click handlers. The capture line you add is a NEW first line before `syncManualEdit`, not a replacement.

    Step 3: run `npm test -- RunnerView.test.ts` and confirm the RUNFIX-02 test now passes.

    Step 4: run the full suite `npm test` and confirm no regression (the BUG-01 test and the 47-01 RUNFIX-01 tests must still pass if 47-01 has already landed in the same wave).

    Shared-file safety constraints (CLAUDE.md — "Critical Rules for Editing Shared Files"):
    - Do NOT delete, reorder, or rewrite any code you did not add in this plan.
    - Do NOT remove any existing `syncManualEdit(this.previewTextarea?.value ?? '')` call — these are BUG-01 protections and the RUNFIX-01 dependency from plan 47-01.
    - Do NOT change the rAF-based height-recompute pattern in renderPreviewZone — only APPEND the scrollTop restore block inside the existing rAF callback.
    - Do NOT touch any listener, method, or field outside the five edit points listed above.
  </action>
  <verify>
    <automated>npm test -- RunnerView.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "pendingTextareaScrollTop" src/views/runner-view.ts` returns >=4 matches: 1 field declaration, 1 helper method body, 1 restore site in renderPreviewZone, 1 consume-clear (the `= null` after restoring). (If executor inlines the consume into the same assignment, at least 3 matches.)
    - `grep -n "capturePendingTextareaScroll" src/views/runner-view.ts` returns >=4 call sites (one declaration + the four click-handler captures; if line 675 site is skipped with a comment, 3 call sites + 1 declaration = 4 matches; document the skip in the commit message).
    - `grep -n "textarea.scrollTop = this.pendingTextareaScrollTop" src/views/runner-view.ts` returns 1 match inside renderPreviewZone's rAF callback.
    - `grep -n "syncManualEdit(this.previewTextarea" src/views/runner-view.ts` returns the SAME number of matches as on main HEAD before this plan (>=4) — proves no BUG-01 capture was accidentally deleted.
    - `grep -n "RUNFIX-02" src/__tests__/RunnerView.test.ts` returns >=1 match.
    - `npm test -- RunnerView.test.ts` exits 0 with the new RUNFIX-02 test passing.
    - `npm test` (full suite) exits 0.
    - `git diff src/views/runner-view.ts` shows ONLY: 1 new field declaration near line 23, 1 new helper method (capturePendingTextareaScroll), 1 appended block inside renderPreviewZone's rAF, and ≤4 single-line `this.capturePendingTextareaScroll();` additions at the top of existing click handlers. No method body rewrites, no renames, no reordering.
    - No pre-Phase 47 functions or event listeners deleted from src/views/runner-view.ts (git diff shows only additions + the targeted inserts).
    - No edits to src/runner/protocol-runner.ts or src/styles/*.css (this plan's scope is the view + its test only).
  </acceptance_criteria>
  <done>
    Choice click on a tall textarea preserves scrollTop through the re-render; RUNFIX-02 vitest passes; no regression in existing tests.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DOM textarea → RunnerView memory | User-controlled scrollTop value copied from old textarea to new textarea. Existing data path; no new source. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-47-02-01 | Tampering | pendingTextareaScrollTop field | accept | Field stores a number copied from the DOM element the user themselves is scrolling. No adversarial model — the user scrolling their own textarea is expected behaviour. |
| T-47-02-02 | Denial of Service | renderPreviewZone rAF callback | accept | Appending 3 lines inside the existing rAF callback adds O(1) cost. No change to render cadence. |

No new attack surface; changes are confined to DOM scroll-position capture + restore inside existing render pipeline. No user-supplied data enters new code paths. ASVS L1 — no relevant threats.
</threat_model>

<verification>
- `npm test` passes with no skipped or failing tests.
- `grep -n "scrollTop" src/views/runner-view.ts` returns >=2 matches (capture in helper + restore in renderPreviewZone).
- Manual smoke: open a long protocol, scroll the textarea to the middle, click a choice button, confirm the new render keeps (or advances past) that scroll position.
</verification>

<success_criteria>
- RUNFIX-02 closed: choice-button clicks never reset textarea scroll to 0.
- One focused vitest case asserts scrollTop retention through a re-render.
- No other render behaviour changes.
</success_criteria>

<output>
After completion, create `.planning/phases/47-runner-regressions/47-02-SUMMARY.md` using the standard summary template. Reference RUNFIX-02 in the summary's requirements-closed section.
</output>
