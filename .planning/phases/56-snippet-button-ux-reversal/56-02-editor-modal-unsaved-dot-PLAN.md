---
phase: 56-snippet-button-ux-reversal
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/snippet-editor-modal.ts
  - src/styles/snippet-manager.css
autonomous: true
requirements:
  - PICKER-01

must_haves:
  truths:
    - "SnippetEditorModal shows a visible • dot next to the «Папка» label whenever pendingFolderPath differs from the saved folder"
    - "The dot disappears the moment the user saves (pending becomes saved, diff = 0)"
    - "The dot uses Obsidian accent colour var(--interactive-accent) so it aligns with the native unsaved-file indicator vocabulary"
  artifacts:
    - path: "src/views/snippet-editor-modal.ts"
      provides: "savedFolder baseline + rp-snippet-editor-unsaved-dot render + diff-driven show/hide"
      contains: "rp-snippet-editor-unsaved-dot"
    - path: "src/styles/snippet-manager.css"
      provides: "Phase 56 unsaved-dot rule appended"
      contains: ".rp-snippet-editor-unsaved-dot"
  key_links:
    - from: "SnippetTreePicker onSelect callback"
      to: "dot visibility"
      via: "currentFolder !== savedFolder → dot.toggleClass('is-visible', true)"
      pattern: "is-visible"
---

<objective>
Add the D-08 / SC-6 unsaved-change indicator to SnippetEditorModal — a small dot/bullet adjacent to the «Папка» label that appears when the in-modal folder selection differs from the saved value and clears on save/reset.

Purpose: Users need immediate, unambiguous visual confirmation that a folder change is pending. Mirrors Obsidian's native "unsaved file" tab-bar dot semantics.

Output: Modified `src/views/snippet-editor-modal.ts` with a `savedFolder` baseline + dot element + diff watcher, and an appended `/* Phase 56: unsaved-dot indicator */` CSS block in `src/styles/snippet-manager.css`.
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
@src/views/snippet-editor-modal.ts
@src/styles/snippet-manager.css
</context>

<interfaces>
Existing relevant state on `SnippetEditorModal` (source-of-truth — do not refactor):

```typescript
private currentFolder: string;          // line 81 — the pending/live selection
private hasUnsavedChanges = false;      // line 82
// constructor: edit mode → currentFolder = dirname(options.snippet.path)
//              create mode → currentFolder = options.initialFolder
// SnippetTreePicker onSelect callback (line 315-322) sets:
//   this.currentFolder = ... ; this.hasUnsavedChanges = true; this.runCollisionCheck();
```

CSS scope: editor-modal styles live in `src/styles/snippet-manager.css` (verified: `grep -l "radi-snippet-editor" src/styles/*.css`). Append Phase 56 block at bottom of that file. Do NOT create a new feature CSS file — CLAUDE.md requires registering new files in `esbuild.config.mjs`, and we already have the right owner.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add savedFolder baseline + unsaved-dot DOM + diff watcher</name>
  <files>src/views/snippet-editor-modal.ts</files>
  <read_first>
    - `src/views/snippet-editor-modal.ts` lines 80-130 (field declarations + constructor that initialises `currentFolder`).
    - `src/views/snippet-editor-modal.ts` lines 283-325 (`renderFolderDropdown` — where the «Папка» label + picker host are created, and where the `onSelect` callback writes `currentFolder`).
    - `src/views/snippet-editor-modal.ts` — the save path (search for `hasUnsavedChanges = false` inside a save/commit method). Confirm the single site where a successful save flips `hasUnsavedChanges` back to false.
    - `.planning/phases/56-snippet-button-ux-reversal/56-CONTEXT.md` D-08 and D-09.
  </read_first>
  <behavior>
    - Test 1: On modal open in edit mode, dot element exists in DOM but has `display: none` (or class `is-visible` absent) because `currentFolder === savedFolder`.
    - Test 2: After SnippetTreePicker `onSelect` fires with a different folder, dot has `is-visible` class (visible).
    - Test 3: After a successful save that commits the folder change (savedFolder updated to currentFolder), dot returns to hidden state.
    - Test 4: After reset-to-original (if a reset path exists) or selecting the same folder again, dot hides.
    - Test 5: Dot element is a `<span>` placed adjacent to (immediately after) the «Папка» label, NOT in the modal header.
  </behavior>
  <action>
    1. Add a new private field `savedFolder: string` declared next to `currentFolder` (line 81). Initialise it in the constructor with the SAME value that `currentFolder` is initialised with (edit mode: `dirname(options.snippet.path)`; create mode: `options.initialFolder`). This is the baseline against which we compute "unsaved".

    2. Add a new private field `folderUnsavedDotEl: HTMLSpanElement | null = null` next to the other DOM element refs.

    3. In `renderFolderDropdown` at the site `row.createEl('label', { text: 'Папка' });` (line ~291), modify to:

    ```typescript
    const folderLabel = row.createEl('label', { text: 'Папка' });
    this.folderUnsavedDotEl = folderLabel.createEl('span', {
      cls: 'rp-snippet-editor-unsaved-dot',
      text: '\u2022', // • bullet; visual mimics Obsidian unsaved-file dot
    });
    this.folderUnsavedDotEl.setAttribute('aria-label', 'Несохранённые изменения');
    this.updateFolderUnsavedDot();
    ```

    4. Add a new private method:

    ```typescript
    private updateFolderUnsavedDot(): void {
      if (this.folderUnsavedDotEl === null) return;
      const diff = this.currentFolder !== this.savedFolder;
      this.folderUnsavedDotEl.toggleClass('is-visible', diff);
    }
    ```

    5. Inside the existing `SnippetTreePicker` `onSelect` callback (lines 315-322), add a call to `this.updateFolderUnsavedDot();` AFTER the existing `this.runCollisionCheck()` line. Do NOT remove any existing code in that callback.

    6. In the save path (the site where `hasUnsavedChanges = false` is set on successful commit — located via the grep in read_first), add immediately BEFORE that line:

    ```typescript
    this.savedFolder = this.currentFolder; // Phase 56 D-08 — commit baseline
    this.updateFolderUnsavedDot();
    ```

    7. If a reset-to-original path exists (search for any method that resets `currentFolder` back to its initial value), add `this.updateFolderUnsavedDot();` after the reset. If none exists, skip step 7 — D-08 covers save + modal dismiss (modal dismiss destroys the DOM, so no hide needed).

    DO NOT modify any Phase 51 or earlier behaviour. DO NOT remove the existing `hasUnsavedChanges = true` flips in `onSelect` or elsewhere — those are separate semantics (modal close prompt) from the D-08 visual indicator. Extend `src/__tests__/views/snippet-editor-modal-banner.test.ts` with Behavior cases 1-5; do NOT create a new test file.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "rp-snippet-editor-unsaved-dot" src/views/snippet-editor-modal.ts` returns ≥ 1
    - `grep -c "savedFolder" src/views/snippet-editor-modal.ts` returns ≥ 3 (field decl + constructor init + save-path write)
    - `grep -c "updateFolderUnsavedDot" src/views/snippet-editor-modal.ts` returns ≥ 3 (method + onSelect call + save-path call)
    - The unsaved-dot `<span>` is created as a child of the label element (assert via DOM test: label.querySelector('.rp-snippet-editor-unsaved-dot') is non-null)
    - Existing test count in `snippet-editor-modal-banner.test.ts` grows by ≥ 3 new `test(` or `it(` blocks
    - `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    SnippetEditorModal renders a bullet dot adjacent to «Папка» that toggles on folder-selection diff and clears on save; all tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Append Phase 56 unsaved-dot CSS to snippet-manager.css</name>
  <files>src/styles/snippet-manager.css</files>
  <read_first>
    - `src/styles/snippet-manager.css` — full file (confirm current bottom + existing selector namespace).
    - `CLAUDE.md` CSS Architecture section — append-only per phase, `/* Phase 56: ... */` comment required, run `npm run build` after.
  </read_first>
  <action>
    Append AT THE END of `src/styles/snippet-manager.css`, preserving all existing content:

    ```css

    /* Phase 56 D-08 (PICKER-01 follow-up): unsaved-change indicator next to «Папка» label.
     * Visual vocabulary mirrors Obsidian's native unsaved-file tab-bar dot.
     * Rendered as an inline <span> inside the label element; hidden by default,
     * shown via the .is-visible modifier written by SnippetEditorModal.updateFolderUnsavedDot().
     */
    .rp-snippet-editor-unsaved-dot {
      display: none;
      margin-left: var(--size-4-1);
      color: var(--interactive-accent);
      font-size: 1.2em;
      line-height: 1;
      vertical-align: middle;
      user-select: none;
    }

    .rp-snippet-editor-unsaved-dot.is-visible {
      display: inline;
    }
    ```

    Do NOT edit any other CSS file. Do NOT touch `esbuild.config.mjs` — `snippet-manager` is already registered in `CSS_FILES`. Do NOT edit `styles.css` directly (it is generated).

    After appending, run `npm run build` to regenerate `styles.css`.
  </action>
  <verify>
    <automated>npm run build && node -e "const s=require('fs').readFileSync('styles.css','utf8'); if(!s.includes('rp-snippet-editor-unsaved-dot')) process.exit(1); if(!s.includes('Phase 56 D-08')) process.exit(2); process.exit(0);"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 56 D-08" src/styles/snippet-manager.css` returns 1
    - `grep -c "rp-snippet-editor-unsaved-dot" src/styles/snippet-manager.css` returns ≥ 2 (base rule + `.is-visible` modifier)
    - `grep -c "rp-snippet-editor-unsaved-dot" styles.css` returns ≥ 2 (regenerated output contains the appended block)
    - `npm run build` exits 0
    - No existing selector in `snippet-manager.css` was removed or modified — `git diff src/styles/snippet-manager.css` shows only APPENDED lines
  </acceptance_criteria>
  <done>
    CSS appended with phase marker; styles.css regenerated and contains the new selector; no pre-existing rules disturbed.
  </done>
</task>

</tasks>

<verification>
- Task 1: DOM test asserts dot presence, visibility toggling, and save-path clear.
- Task 2: `styles.css` contains `.rp-snippet-editor-unsaved-dot` selectors post-build.
- Combined: `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts` green.
</verification>

<success_criteria>
SC 6 — unsaved-change indicator next to «Папка» field appears on diff, clears on save.
</success_criteria>

<output>
After completion, create `.planning/phases/56-snippet-button-ux-reversal/56-02-SUMMARY.md`.
</output>
