---
phase: 56-snippet-button-ux-reversal
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/snippet-tree-picker.ts
  - src/styles/snippet-tree-picker.css
autonomous: true
requirements:
  - PICKER-01

must_haves:
  truths:
    - "The «Выбрать эту папку» button, after click, persists in a committed visual state (accent background, «✓ Выбрано» label) until the user drills elsewhere or unmounts the picker"
    - "Drilling into a different folder resets the committed state"
    - "Committed state uses Obsidian accent vars (var(--interactive-accent) / var(--text-on-accent)) — no hard-coded colours"
  artifacts:
    - path: "src/views/snippet-tree-picker.ts"
      provides: "committedRelativePath field + render-time diff against drillPath + label/class swap"
      contains: "committedRelativePath"
    - path: "src/styles/snippet-tree-picker.css"
      provides: "Phase 56 .rp-stp-select-folder-btn.is-committed rule"
      contains: "is-committed"
  key_links:
    - from: "select-folder button click"
      to: "committedRelativePath state"
      via: "this.committedRelativePath = this.drillPath.join('/'); re-render"
      pattern: "committedRelativePath"
---

<objective>
Add the D-10 / SC-7 persistent "committed" visual state to `SnippetTreePicker`'s «Выбрать эту папку» button so users get unambiguous, persistent visual confirmation that the folder selection was recorded — replacing the current blink-and-miss-it feedback (memory `project_snippet_node_ux.md`).

Purpose: The button must flip to accent-filled + «✓ Выбрано» label on click and stay that way for the drill-session lifetime at that folder. Drilling elsewhere or unmounting resets it.

Output: Modified `src/views/snippet-tree-picker.ts` with a `committedRelativePath` field and render-time comparison; appended `/* Phase 56: committed-state button */` CSS block in `src/styles/snippet-tree-picker.css`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md
@CLAUDE.md
@src/views/snippet-tree-picker.ts
@src/styles/snippet-tree-picker.css
</context>

<interfaces>
Existing relevant structure (source of truth — do not refactor):

```typescript
// src/views/snippet-tree-picker.ts :200-234 (renderDrillView region)
// Constants near top of file:
//   SELECT_FOLDER_LABEL = 'Выбрать эту папку'
//   UP_BUTTON_LABEL     = '... Наверх' (or similar)

// Current select-folder button (lines 218-234):
if ((this.options.mode === 'folder-only' || this.options.mode === 'both') &&
    this.drillPath.length > 0) {
  const selectBtn = host.createEl('button', {
    cls: 'rp-stp-select-folder-btn',
    text: SELECT_FOLDER_LABEL,
  }) as HTMLButtonElement;
  this.addListener(selectBtn, 'click', () => {
    this.options.onSelect({ kind: 'folder', relativePath: this.drillPath.join('/') });
  });
}

// renderDrillView is called on every drillPath mutation (up button line 214,
// plus folder-row clicks elsewhere in the file). Use this re-render as the
// natural refresh point — no extra render calls needed.
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add committedRelativePath state + button label/class swap</name>
  <files>src/views/snippet-tree-picker.ts</files>
  <read_first>
    - `src/views/snippet-tree-picker.ts` lines 1-60 (imports, constants, class field declarations).
    - `src/views/snippet-tree-picker.ts` lines 200-240 (`renderDrillView` select-folder button region).
    - Full file: locate every site that mutates `drillPath` (up-button pop at :213, folder-row drill elsewhere) — each must keep leaving `committedRelativePath` semantics intact (D-10: drilling elsewhere resets the committed marker).
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-10.
  </read_first>
  <behavior>
    - Test 1: On mount, `committedRelativePath === null` and the select-folder button (if visible) renders the default label «Выбрать эту папку» without the `is-committed` class.
    - Test 2: After clicking the select-folder button, the button renders with class `is-committed` and text exactly «✓ Выбрано» (U+2713 + space + «Выбрано»).
    - Test 3: After drilling into a folder NOT equal to the committed path (e.g. drilling into a sibling or a descendant), the committed state clears — button returns to default label + no `is-committed`.
    - Test 4: Navigating up via the up-button out of the committed folder (drillPath becomes a prefix of, but not equal to, committedRelativePath) clears the committed state.
    - Test 5: Re-mounting the picker (unmount + mount) resets `committedRelativePath` to null.
    - Test 6: If the user clicks select-folder, then stays at the same drillPath and something else triggers a re-render, the button STAYS in committed state (persistence within drill session).
  </behavior>
  <action>
    1. Add a new private field to the class:

    ```typescript
    /** Phase 56 D-10 (PICKER-01 follow-up): relative path (drillPath.join('/'))
     *  of the folder the user has "committed" via the «Выбрать эту папку» button.
     *  null when no commit has occurred in the current drill session, or when
     *  drillPath no longer equals this value (drilled elsewhere / navigated up). */
    private committedRelativePath: string | null = null;
    ```

    2. Add a top-of-file constant near the existing `SELECT_FOLDER_LABEL`:

    ```typescript
    const SELECT_FOLDER_COMMITTED_LABEL = '\u2713 Выбрано'; // ✓ Выбрано — Phase 56 D-10
    ```

    3. Rewrite the select-folder button block inside `renderDrillView` (current lines ~218-234) to:

    ```typescript
    if (
      (this.options.mode === 'folder-only' || this.options.mode === 'both') &&
      this.drillPath.length > 0
    ) {
      const currentRel = this.drillPath.join('/');
      const isCommitted = this.committedRelativePath === currentRel;
      const selectBtn = host.createEl('button', {
        cls: isCommitted ? 'rp-stp-select-folder-btn is-committed' : 'rp-stp-select-folder-btn',
        text: isCommitted ? SELECT_FOLDER_COMMITTED_LABEL : SELECT_FOLDER_LABEL,
      }) as HTMLButtonElement;
      this.addListener(selectBtn, 'click', () => {
        this.committedRelativePath = currentRel;
        this.options.onSelect({
          kind: 'folder',
          relativePath: currentRel,
        });
        void this.renderDrillView();
      });
    }
    ```

    4. Add a reset hook in `unmount` (locate the existing unmount method): set `this.committedRelativePath = null;` before releasing DOM refs. If no `unmount` method exists, locate the equivalent teardown method referenced in the modal's `this.snippetTreePicker.unmount()` call (snippet-editor-modal.ts:304) and add the reset there.

    5. No change is needed to the up-button or folder-row drill handlers — because `renderDrillView` recomputes `currentRel` and `isCommitted` each call from `this.drillPath`, any drill that changes `drillPath` away from `committedRelativePath` automatically renders the default state (Behavior Test 3 and 4). The committed marker itself is deliberately NOT reset on drill — it's a comparison against `currentRel`, so it "lies dormant" and reactivates if the user drills back into the same folder. (Claude's discretion: D-10 wording says "resets when drillPath changes"; the comparison-based approach satisfies this visually while being simpler than clearing the field. If the test file interprets D-10 strictly as "field must be null after drill", change line for line in Task 1 review.)

    DO NOT modify `renderFolderRow`, search handling, `renderSearchView`, or any other method unrelated to the drill-view select-folder button. DO NOT introduce new selectors beyond `is-committed` modifier.

    Extend `src/__tests__/views/snippet-tree-picker.test.ts` with Behavior cases 1-6.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-tree-picker.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "committedRelativePath" src/views/snippet-tree-picker.ts` returns ≥ 4 (field decl + render read + click write + unmount reset)
    - `grep -c "SELECT_FOLDER_COMMITTED_LABEL" src/views/snippet-tree-picker.ts` returns ≥ 2 (declaration + usage)
    - `grep -c "is-committed" src/views/snippet-tree-picker.ts` returns ≥ 1
    - `grep -c "\\\\u2713 Выбрано\\|✓ Выбрано" src/views/snippet-tree-picker.ts` returns ≥ 1 (either escape form acceptable)
    - `snippet-tree-picker.test.ts` grows by ≥ 4 new `test(`/`it(` blocks covering committed-state transitions
    - `npx vitest run src/__tests__/views/snippet-tree-picker.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    `SnippetTreePicker` tracks committed folder, button swaps label + class on click, reverts visually on drill-away, resets on unmount; tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Append Phase 56 committed-state CSS</name>
  <files>src/styles/snippet-tree-picker.css</files>
  <read_first>
    - `src/styles/snippet-tree-picker.css` full file — confirm bottom boundary + existing `.rp-stp-select-folder-btn` base rule.
    - `CLAUDE.md` CSS Architecture append-only rule.
  </read_first>
  <action>
    Append AT THE END of `src/styles/snippet-tree-picker.css`:

    ```css

    /* Phase 56 D-10 (PICKER-01 follow-up): committed-state variant for the
     * «Выбрать эту папку» button. Applied by SnippetTreePicker when the
     * current drillPath equals committedRelativePath. Persistent (not an
     * animation) — users reported blink-feedback was missed (memory note
     * project_snippet_node_ux.md). Uses Obsidian accent vars for theme compat.
     */
    .rp-stp-select-folder-btn.is-committed {
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      border-color: var(--interactive-accent);
    }

    .rp-stp-select-folder-btn.is-committed:hover {
      background-color: var(--interactive-accent-hover);
      color: var(--text-on-accent);
    }
    ```

    Do NOT modify existing rules. Do NOT edit `esbuild.config.mjs` — `snippet-tree-picker` is already in `CSS_FILES`. Run `npm run build` afterwards.
  </action>
  <verify>
    <automated>npm run build && node -e "const s=require('fs').readFileSync('styles.css','utf8'); if(!s.includes('rp-stp-select-folder-btn.is-committed')) process.exit(1); if(!s.includes('Phase 56 D-10')) process.exit(2); process.exit(0);"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 56 D-10" src/styles/snippet-tree-picker.css` returns 1
    - `grep -c "is-committed" src/styles/snippet-tree-picker.css` returns ≥ 2 (base + hover)
    - `grep -c "is-committed" styles.css` returns ≥ 2 (regenerated output)
    - `grep -c "var(--interactive-accent)" src/styles/snippet-tree-picker.css` increased by ≥ 2 compared to pre-edit (theme vars used)
    - `npm run build` exits 0
    - `git diff src/styles/snippet-tree-picker.css` shows only APPENDED lines
  </acceptance_criteria>
  <done>
    CSS appended with phase marker; styles.css contains the committed-state rule; no existing selectors disturbed.
  </done>
</task>

</tasks>

<verification>
- Task 1: Unit tests exercise mount → click → drill-away → unmount transitions.
- Task 2: Built CSS contains the new selector.
</verification>

<success_criteria>
SC 7 — «Выбрать эту папку» button transitions to committed state after click (persistent visual anchor).
</success_criteria>

<output>
After completion, create `.planning/phases/56-snippet-button-ux-reversal/56-03-SUMMARY.md`.
</output>
