---
date: 2026-07-26T16:30:25+0300
last_updated: 2026-07-26T16:37:31+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "snippet-create-from-selection-and-insert-modal-ux"
status: ready
phase_count: 5
phases:
  - { n: 1, title: "Pre-fill snippet editor from selection + standalone create-snippet command", slice: 1 }
  - { n: 2, title: "Create snippet from selection in Runner footer", slice: 2 }
  - { n: 3, title: "Pin insert-snippet modal and stabilize picker body height", slice: 3 }
  - { n: 4, title: "SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)", slice: 4 }
  - { n: 5, title: "Add hideSearchResultPath option and opt in from InsertSnippetModal", slice: 5 }
risks:
  - { id: r1, claim: "SnippetEditorModal opened from InlineRunnerModal (a custom DOM overlay, not an Obsidian Modal) stacks above the runner overlay by Obsidian's default modal z-index — the research names modal-stacking-from-custom-backdrop as the codebase's #1 recurring failure pattern and requires validation-time verification." }
  - { id: r2, claim: "The pin rule assumes Obsidian centers .modal via flex align-items: center on .modal-container; if a future Obsidian version switches .modal to absolute/fixed positioning, align-self: flex-start no longer opts out and the pin would need top:0; bottom:auto instead." }
  - { id: r3, claim: "Slice 4 (Phase 4) and Slice 5 (Phase 5) both edit src/views/snippet-tree-picker.ts; the sub-plans assert disjoint edit regions (Phase 4: mount() listener, removeListenersExceptSearch(), re-render bodies; Phase 5: SnippetTreePickerOptions interface + renderFileRow path-div gate). Validate that the two phases' line ranges do not collide and that the broadened removeListenersExceptSearch() keep-predicate does not regress Phase 5's path-display gate or vice-versa." }
  - { id: r4, claim: "Query-on-keypress navigation (Phase 4 currentRows()) assumes every visible list row carries .rp-stp-folder-row or .rp-stp-file-row and lives under the current .rp-stp-list. Phase 5's name-only display changes only the path-div inside renderFileRow, not the row's own class, so the contract should hold — but verify the row-class + .rp-stp-list container contract is preserved across every render path both phases touch." }
sources:
  - .rpiv/artifacts/subplans/2026-07-26_16-26-52_cluster-1.md
  - .rpiv/artifacts/subplans/2026-07-26_16-26-52_cluster-3.md
  - .rpiv/artifacts/subplans/2026-07-26_16-26-52_cluster-4.md
  - .rpiv/artifacts/subplans/2026-07-26_16-26-52_cluster-5.md
  - .rpiv/artifacts/research/2026-07-26_16-08-02_snippet-create-from-selection-and-insert-modal-ux.md
tags: [plan, synthesized]
---

# Plan: snippet-create-from-selection-and-insert-modal-ux

## Synthesis Notes
- **Root merge of four clusters.** cluster-1 (2 phases: create-from-selection), cluster-3 (1 phase: insert-modal pinning), cluster-4 (1 phase: keyboard nav), cluster-5 (1 phase: name-only display). Each cluster declared `depends_on_clusters: []`, so no hard cross-cluster contract dependency exists; the only ordering constraints come from shared-file overlaps resolved below.
- **Shared file: `src/views/snippet-tree-picker.ts` (cluster-4 + cluster-5).** Both phases edit this file but in disjoint regions: Phase 4 adds instance fields, a `keydown` listener in `mount()`, broadens `removeListenersExceptSearch()`'s keep-predicate, calls `clearHighlight()` at the top of `renderDrillView()`/`renderSearchResults()`, and adds private methods; Phase 5 adds a `hideSearchResultPath?: boolean` field to `SnippetTreePickerOptions` and narrows the `renderFileRow()` path-div gate at `:381` from `if (isSearchResult)` to `if (isSearchResult && !this.options.hideSearchResultPath)`. No shared line. **Sequenced Phase 4 → Phase 5** so the broadened `removeListenersExceptSearch()` keep-predicate lands first and Phase 5's gate edit applies against the post-Phase-4 source. Flagged as risk r3 for the grade/validate panel to confirm disjointness.
- **Shared file: `src/views/insert-snippet-modal.ts` (cluster-3 + cluster-5).** Both phases edit `onOpen()`: Phase 3 inserts `modalEl.addClass('rp-insert-snippet-modal')` as the first statement (protected-cast pattern, before `contentEl.empty()`); Phase 5 passes `hideSearchResultPath: true` in the `SnippetTreePicker` options object at `:32`. Disjoint lines within the same method. **Sequenced Phase 3 → Phase 5** so the `addClass`-first invariant holds and Phase 5's options-object edit lands cleanly after.
- **Shared file: `src/styles/snippet-tree-picker.css` (cluster-3 + cluster-4).** Phase 3 appends the pin + height-stabilization rules immediately after the existing `.rp-insert-snippet-picker-host` width block (`:220-228`); Phase 4 adds `.rp-stp-row-highlighted` and `.rp-stp-sr-only` rules. Different selectors, additive — no merge conflict. Both target `snippet-tree-picker.css` (already wired via `esbuild.config.mjs` `CSS_FILES`).
- **Shared file: `src/i18n/locales/en.json` + `ru.json` (all four clusters).** Disjoint namespaces: cluster-1 adds `snippetEditor.createdNotice` (Phase 1) and `protocolRunner.createSnippetFromSelection` (Phase 2); cluster-4 adds `snippetTreePicker.highlightAria` (Phase 4); cluster-3 and cluster-5 add no i18n keys. All additions are additive into existing namespaces; no existing key is mutated. The research's standing rule (i18n updated in BOTH en + ru simultaneously) is preserved per phase.
- **Shared file: `src/__tests__/views/snippet-tree-picker.test.ts` (cluster-4 + cluster-5).** Phase 4 adds the keyboard-nav Vitest suite at this path (per its design). Phase 5 adds one `hideSearchResultPath: true` assertion and keeps the existing default-`false` test at `:638-655` unchanged. Disjoint test additions into the same file — both additive; no test removed or rewritten by the other. Sequencing Phase 4 → Phase 5 keeps the test file consistent.
- **Contract seam wired: `SnippetEditorOptions.initialTemplate` (cluster-1 internal).** Phase 1 publishes the optional `initialTemplate?: string` field and the `emptyMdTemplateDraft()` 4th param `initialTemplate: string = ''`. Phase 2 consumes it verbatim — `handleCreateSnippetFromSelection()` constructs `new SnippetEditorModal(this.app, this.plugin, { mode: 'create', initialFolder, initialTemplate: template })`. No redesign of the contract in Phase 2. Backward compatibility preserved by construction: the field is optional and the param defaults to `''`, so `SnippetManagerView.openCreateModal()` (`snippet-manager-view.ts:258-267`) compiles and runs unchanged.
- **No cross-cluster redesign.** Each cluster's decisions are preserved verbatim; the root merge only sequences phases to keep shared-file edits disjoint and wires the one internal contract (`initialTemplate`). No phase is merged; each slice becomes exactly one phase.
- **Phase ordering rationale.** Phase 1 → Phase 2 (cluster-1 internal `depends_on: [1]` — `initialTemplate` contract). Phases 3, 4, 5 are independent of cluster-1 and of each other at the contract level, but sequenced 3 → 4 → 5 to keep the `insert-snippet-modal.ts` `onOpen()` `addClass`-first invariant and the `snippet-tree-picker.ts` `removeListenersExceptSearch()` broadening landing before the `renderFileRow` gate edit. Any order satisfying those two pairwise constraints is valid; this one is canonical.

## Risk Flags
- **r1** — `SnippetEditorModal` is opened from `InlineRunnerModal`, which is a plain floating div (custom DOM overlay), not an Obsidian `Modal` subclass. The research's #1 recurring failure pattern is "picker/modal opened from a custom backdrop stacks behind it" (commits `c0bb3ee`, `164b8e6` consumed two plan cycles on this). Phase 2's design argues `SnippetEditorModal` is a real Obsidian `Modal` that mounts to `document.body`, so it should stack above the inline runner overlay by Obsidian's default modal z-index — but this is an unverified assumption, not a tested behavior. **Validate** by opening the runner, selecting text, clicking the create-snippet button, and confirming the modal renders above the runner (the runner remains visible behind it). If it stacks behind, the fix is a z-index rule on the modal's `modalEl` scoped class — out of scope for this plan unless validation fails.
- **r2** — The pin rule (Phase 3) assumes Obsidian centers `.modal` via flex `align-items: center` on `.modal-container` (current behavior); `align-self: flex-start` opts out. If a future Obsidian version switches `.modal` to absolute/fixed positioning, the pin would need `top: 0; bottom: auto` instead. Reviewer: verify the pinned modal does not move vertically on any keystroke in the current Obsidian build target; if it still jumps, the pin CSS needs the absolute-positioning fallback.
- **r3** — Phase 4 and Phase 5 both edit `src/views/snippet-tree-picker.ts` and `src/__tests__/views/snippet-tree-picker.test.ts`. The sub-plans assert disjoint edit regions (Phase 4: `mount()` listener registration, `removeListenersExceptSearch()` keep-predicate, re-render-body `clearHighlight()` calls, new private methods; Phase 5: `SnippetTreePickerOptions` interface field + `renderFileRow` path-div gate at `:381`). Reviewer should verify the two phases' line ranges in `snippet-tree-picker.ts` do not collide and that the broadened `removeListenersExceptSearch()` keep-predicate does not regress Phase 5's path-display gate (or any other phase's listener on `searchInputEl`). Rule pass if disjoint, fail if either phase edits a line the other also touches.
- **r4** — Phase 4's query-on-keypress `currentRows()` relies on every visible list row carrying `.rp-stp-folder-row` or `.rp-stp-file-row` and being a descendant of the current `.rp-stp-list`. Phase 5's name-only display change alters only the path-div inside `renderFileRow`, not the row's own class — so the contract should hold. But if any sibling phase restructures the search-result container or renames row classes, `currentRows()` could return a stale/empty set and ArrowUp/Down would silently no-op. Reviewer should confirm the row-class + `.rp-stp-list` container contract is preserved across every render path both phases touch (`renderDrillView` + `renderSearchResults`).

## Phase 1: Pre-fill snippet editor from selection + standalone create-snippet command

### Changes

#### `src/views/snippet-editor-modal.ts`
Add an optional `initialTemplate?: string` field to `SnippetEditorOptions` (after `disableFolderPicker?`), widen `emptyMdTemplateDraft()` with a 4th defaulted param so the template is pre-filled, and pass `options.initialTemplate ?? ''` from the create-mode constructor branch. Edit mode, `mountChipEditor`, and `handleSave()`'s `draftToSave` spread are untouched — the pre-filled `template` flows through the chip editor (`templateArea.value = draft.template` at `src/views/snippet-chip-editor.ts:125`) into `SnippetService.save()` unchanged.

Edit 1 — interface field (after `disableFolderPicker?: boolean;` at `src/views/snippet-editor-modal.ts:50`):

```ts
  /** Hide the folder picker when the caller manages moves separately. */
  disableFolderPicker?: boolean;
  /** Pre-fill the template textarea in create mode (verbatim, no transformation).
   *  Defaults to '' so existing callers (e.g. SnippetManagerView.openCreateModal
   *  at src/views/snippet-manager-view.ts:258-267) compile and behave unchanged. */
  initialTemplate?: string;
}
```

Edit 2 — `emptyMdTemplateDraft()` 4th param + pre-filled `template` (replaces the function at `src/views/snippet-editor-modal.ts:71-82`):

```ts
function emptyMdTemplateDraft(
  folder: string,
  locale: string,
  cat: string,
  initialTemplate: string = '',
): MdTemplateSnippet {
  return {
    kind: 'md-template',
    path: folder + '/.md',
    name: '',
    template: initialTemplate,
    placeholders: [],
    validationError: null,
    lang: locale as 'ru' | 'en' | undefined,
    category: cat,
  };
}
```

Edit 3 — constructor create-mode branch passes `options.initialTemplate ?? ''` as the 4th arg (replaces the call at `src/views/snippet-editor-modal.ts:137-142`):

```ts
      this.draftKind = 'md-template';
      this.currentFolder = options.initialFolder;
      this.savedFolder = this.currentFolder; // Phase 56 D-08 baseline
      this.draft = emptyMdTemplateDraft(
        this.currentFolder,
        this.plugin.settings.locale ?? 'ru',
        basename(this.currentFolder),
        options.initialTemplate ?? '',
      );
```

#### `src/main.ts`
Import `SnippetEditorModal`, register a `create-snippet` command after the existing `insert-snippet` command (`src/main.ts:96-100`), and add a `handleCreateSnippet()` method mirroring `handleInsertSnippet()` (`src/main.ts:285-297`) but reading the active editor's selection as `initialTemplate` (NOT `editor.replaceSelection`), with no md-guard bail (the command stays useful for authoring from scratch when there is no active MarkdownView or no selection).

Edit 1 — add the import alongside the existing view imports (after the `InsertSnippetModal` import at `src/main.ts:15`):

```ts
import { InsertSnippetModal } from './views/insert-snippet-modal';
import { SnippetEditorModal } from './views/snippet-editor-modal';
```

Edit 2 — register the `create-snippet` command immediately after the `insert-snippet` `addCommand` block (which ends at `src/main.ts:100`):

```ts
    this.addCommand({
      id: 'insert-snippet',
      name: 'Insert snippet',
      callback: () => { void this.handleInsertSnippet(); },
    });

    this.addCommand({
      id: 'create-snippet',
      name: 'Create snippet from selection',
      callback: () => { void this.handleCreateSnippet(); },
    });
```

Edit 3 — add the `handleCreateSnippet()` method immediately after `handleInsertSnippet()` ends (after the closing brace of `handleInsertSnippet` at `src/main.ts:312`). The method captures the live selection (or `''`) as `initialTemplate`, opens `SnippetEditorModal` in create mode with the snippet folder from settings, `await`s `modal.result`, and shows the `snippetEditor.createdNotice` on save:

```ts
  /**
   * "Create snippet from selection" command. Opens SnippetEditorModal in create
   * mode with the active Markdown editor's selection pre-filled as the template.
   *
   * No md-guard bail: when there is no active MarkdownView or no selection, the
   * modal still opens with an empty template so the command remains useful for
   * authoring a snippet from scratch.
   */
  private async handleCreateSnippet(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const initialTemplate = activeView?.editor?.getSelection() ?? '';

    const modal = new SnippetEditorModal(this.app, this, {
      mode: 'create',
      initialFolder: this.settings.snippetFolderPath,
      initialTemplate,
    });
    modal.open();
    const result = await modal.result;
    if (result.saved) {
      new Notice(this.i18n.t('snippetEditor.createdNotice'));
    }
  }
```

#### `src/i18n/locales/en.json`
Add `createdNotice` to the `snippetEditor` namespace, placed after `movedAndRenamedNotice` (line 137) to keep the notice keys grouped:

```json
    "movedNotice": "Snippet moved.",
    "renamedNotice": "Snippet renamed.",
    "movedAndRenamedNotice": "Snippet moved and renamed.",
    "createdNotice": "Snippet created.",
```

#### `src/i18n/locales/ru.json`
Add `createdNotice` to the `snippetEditor` namespace, mirroring the English placement (after `movedAndRenamedNotice`):

```json
    "movedNotice": "Сниппет перемещён.",
    "renamedNotice": "Сниппет переименован.",
    "movedAndRenamedNotice": "Сниппет перемещён и переименован.",
    "createdNotice": "Сниппет создан.",
```

### Success Criteria
#### Automated Verification:
- [x] `tsc` compiles with no new errors after adding `initialTemplate?: string` to `SnippetEditorOptions` and the 4th param to `emptyMdTemplateDraft()`.
- [x] `emptyMdTemplateDraft(folder, locale, cat, 'Hello {{name}}!')` returns a draft whose `template === 'Hello {{name}}!'`; with the 4th arg omitted, `template === ''` (byte-identical to prior behavior).
- [x] `SnippetManagerView.openCreateModal()` (`src/views/snippet-manager-view.ts:258-267`) compiles unchanged — no call-site edit required (the new field is optional and the new param defaults to `''`).
- [x] `npm run build` (type-check + esbuild) passes; `npm test` passes with no regressions in existing snippet-editor / chip-editor suites.
#### Manual Verification:
- [ ] Constructing `new SnippetEditorModal(app, plugin, { mode: 'create', initialFolder, initialTemplate: 'selected text' })` and opening it mounts the chip editor textarea pre-filled with `selected text` (verifiable via the chip editor's `templateArea.value` at `src/views/snippet-chip-editor.ts:125`).
- [ ] Constructing the modal without `initialTemplate` (the existing `openCreateModal` path at `src/views/snippet-manager-view.ts:258-267`) still mounts with an empty template — no regression.
- [ ] Saving a pre-filled create-mode snippet persists the template text to the vault file via `SnippetService.save()` (the `draftToSave` spread at `src/views/snippet-editor-modal.ts:535` carries `template` through).
- [ ] A `create-snippet` command appears in the Obsidian command palette with id `create-snippet` and a human-readable name.
- [ ] Running `create-snippet` with an active `MarkdownView` that has a selection opens `SnippetEditorModal` with the template textarea pre-filled with that selection.
- [ ] Running `create-snippet` with an active `MarkdownView` but no selection opens `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] Running `create-snippet` with no active `MarkdownView` opens `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] On save, a `Notice` is shown using `snippetEditor.createdNotice` from the active locale (en or ru).

## Notes / Deferred
None — the plan's contract (`SnippetEditorOptions.initialTemplate` + `emptyMdTemplateDraft()` 4th param) is published here verbatim for Phase 2 to consume; backward compatibility is preserved by construction (optional field + defaulted param), so `SnippetManagerView.openCreateModal()` needs no edit. The `handleCreateSnippet()` method deliberately has no md-guard bail and reads `activeView?.editor?.getSelection() ?? ''` (not `editor.replaceSelection`) per the plan's explicit constraint.

## Phase 2: Create snippet from selection in Runner footer

### Changes

#### `src/views/inline-runner-modal.ts`
Add the `SnippetEditorModal` import (sibling Phase 1 publishes the `initialTemplate` option this phase consumes — referenced by the synthesis-fixed contract, not redefined here), two new instance fields next to `boundKeyHandler`, selection-listener wiring in `open()`/`close()`, a footer-left group rendered in the `render()` footer-teardown block, and three private helper methods.

**Import** — add to the existing import block at the top of the file (after the `SnippetFillInModal` import near `src/views/inline-runner-modal.ts:12`):

```ts
import { SnippetEditorModal } from './snippet-editor-modal';
```

**Instance fields** — add immediately after the existing `boundKeyHandler` field declaration (`src/views/inline-runner-modal.ts:76`):

```ts
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Phase 2 — create-snippet-from-selection footer button + selection listener. */
  private createSnippetBtnEl: HTMLButtonElement | null = null;
  private boundSelectionHandler: (() => void) | null = null;
```

**`open()` — attach selection listeners** — insert immediately after the `boundKeyHandler` attach block at the end of `open()` (`src/views/inline-runner-modal.ts:226-227`), still inside `open()`:

```ts
    // Keyboard shortcuts: Ctrl/Alt+Left = step back, Ctrl/Alt+Right = redo, Escape = close
    this.boundKeyHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    this.containerEl?.addEventListener('keydown', this.boundKeyHandler);

    // Phase 2 — track text selection inside contentEl to enable/disable the
    // create-snippet-from-selection footer button. mouseup covers drag-selection;
    // selectionchange covers keyboard Shift+Arrow selection.
    this.boundSelectionHandler = () => this.updateCreateSnippetButtonState();
    this.contentEl?.addEventListener('mouseup', this.boundSelectionHandler);
    document.addEventListener('selectionchange', this.boundSelectionHandler);
  }
```

**`close()` — detach selection listeners + null refs** — insert immediately after the `boundKeyHandler` detach block (`src/views/inline-runner-modal.ts:251-254`), before the `activeFileEventRef` unsubscribe:

```ts
    // Unsubscribe event listeners
    if (this.boundKeyHandler !== null && this.containerEl !== null) {
      this.containerEl.removeEventListener('keydown', this.boundKeyHandler);
    }
    this.boundKeyHandler = null;

    // Phase 2 — detach selection listeners and release DOM refs (parity with boundKeyHandler).
    // Runs BEFORE contentEl/containerEl are nulled below so removeEventListener still sees the node.
    if (this.boundSelectionHandler !== null) {
      this.contentEl?.removeEventListener('mouseup', this.boundSelectionHandler);
      document.removeEventListener('selectionchange', this.boundSelectionHandler);
      this.boundSelectionHandler = null;
    }
    this.createSnippetBtnEl = null;
```

**`render()` — footer-teardown block** — replace the existing footer-recreation block (`src/views/inline-runner-modal.ts:423-434`) so the close button and the new create-snippet button sit inside a `rp-runner-footer-left` group; the create-snippet button starts disabled and is re-evaluated against the live selection:

```ts
    // Recreate footer-row children (close btn destroyed by empty, must re-add)
    if (this.footerBtnRowEl !== null) {
      this.footerBtnRowEl.empty();

      // Phase 2 — left group holds close + create-snippet-from-selection.
      const leftGroup = this.footerBtnRowEl.createDiv({ cls: 'rp-runner-footer-left' });

      // Close button — always present on the left
      const closeBtn = leftGroup.createEl('button', { cls: 'rp-inline-runner-close-btn rp-runner-icon-btn' });
      setIcon(closeBtn, 'x');
      closeBtn.setAttribute('aria-label', this.plugin.i18n.t('protocolRunner.closeProtocol'));
      closeBtn.addEventListener('click', () => {
        this.close();
      });

      // Create-snippet-from-selection — always visible, disabled until contentEl has a selection.
      const createSnippetBtn = leftGroup.createEl('button', {
        cls: 'rp-inline-runner-create-snippet-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.plugin.i18n.t('protocolRunner.createSnippetFromSelection') },
      });
      setIcon(createSnippetBtn, 'file-plus');
      createSnippetBtn.disabled = true;
      createSnippetBtn.addEventListener('click', () => {
        void this.handleCreateSnippetFromSelection();
      });
      this.createSnippetBtnEl = createSnippetBtn;
      // Re-evaluate against the live selection so an existing selection at render time enables it.
      this.updateCreateSnippetButtonState();
    }
```

**Three private methods** — add at the end of the `Event Handlers` region, after `handleKeydown()` (`src/views/inline-runner-modal.ts:672-697`). Placement keeps the selection helpers next to the keydown handler they complement.

```ts
  /** Phase 2 — Return the current selection's text iff its anchor node is contained
   *  in contentEl. Selections outside the runner (e.g. in the note behind it) return ''. */
  private getSelectedContentText(): string {
    if (this.contentEl === null) return '';
    const sel = window.getSelection();
    if (sel === null || sel.isCollapsed) return '';
    const anchorNode = sel.anchorNode;
    if (anchorNode === null) return '';

    const contentEl = this.contentEl;
    let node: Node | null = anchorNode;
    while (node !== null) {
      if (node === contentEl) return sel.toString();
      node = node.parentNode;
    }
    return '';
  }

  /** Phase 2 — Enable/disable the create-snippet button based on the live selection. */
  private updateCreateSnippetButtonState(): void {
    if (this.createSnippetBtnEl === null) return;
    this.createSnippetBtnEl.disabled = this.getSelectedContentText().length === 0;
  }

  /** Phase 2 — Capture the selection, open SnippetEditorModal in create mode pre-filled
   *  with the selected text, await its result. The inline runner stays open underneath
   *  (SnippetEditorModal mounts to document.body and stacks above the runner overlay).
   *  Defensive guard: no-op when the selection is empty (covers disabled-button edge). */
  private async handleCreateSnippetFromSelection(): Promise<void> {
    const template = this.getSelectedContentText();
    if (template.length === 0) return;
    const modal = new SnippetEditorModal(this.app, this.plugin, {
      mode: 'create',
      initialFolder: this.plugin.settings.snippetFolderPath,
      initialTemplate: template,
    });
    modal.open();
    await modal.result;
  }
```

#### `src/styles/inline-runner.css`
Append the `rp-runner-footer-left` group rule and the disabled-state rule for `rp-runner-icon-btn` at the end of the file (after the `.rp-inline-runner-self-check-item` block). The disabled rule is additive — it also styles the Back/Redo/Skip buttons' disabled state (currently set via `.disabled = true` in `renderFooterIcons` but previously unstyled).

```css
/* Phase 2 — footer left group: close + create-snippet-from-selection, pushed to the
   space-between row's start side (Back/Redo/Skip group stays on the end side). */
.rp-runner-footer-left {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  justify-content: flex-start;
}

/* Phase 2 — disabled icon buttons read as inactive. Additive: also styles the
   Back/Redo/Skip buttons' disabled state set via .disabled = true in renderFooterIcons. */
.rp-runner-icon-btn:disabled,
.rp-runner-icon-btn:disabled:hover {
  opacity: 0.4;
  cursor: not-allowed;
  background: transparent;
  color: var(--text-muted);
}
```

#### `src/i18n/locales/en.json`
Add the `createSnippetFromSelection` key to the existing `protocolRunner` namespace (after the last key `"keyClose": "Esc Close"`):

```json
    "keyStepBack": "Ctrl+← Back",
    "keyStepRedo": "Ctrl+→ Redo",
    "keyClose": "Esc Close",
    "createSnippetFromSelection": "Create snippet from selection"
  },
```

#### `src/i18n/locales/ru.json`
Add the `createSnippetFromSelection` key to the existing `protocolRunner` namespace (after the last key `"keyClose": "Esc Закрыть"`):

```json
    "keyStepBack": "Ctrl+← Назад",
    "keyStepRedo": "Ctrl+→ Повторить",
    "keyClose": "Esc Закрыть",
    "createSnippetFromSelection": "Создать сниппет из выделения"
  },
```

### Success Criteria
#### Automated Verification:
- [x] `tsc` compiles with no new errors after adding the `SnippetEditorModal` import, the `createSnippetBtnEl`/`boundSelectionHandler` fields, the `open()`/`close()` listener wiring, the footer-left render block, and the three private methods to `InlineRunnerModal`. (Depends on sibling Phase 1 having published the optional `initialTemplate?: string` field on `SnippetEditorOptions` — the synthesis-fixed contract this phase consumes; if Phase 1 lands first this compiles, otherwise `tsc` flags the `initialTemplate` property and the splice/grade panel re-orders.)
- [x] `npm run build` (type-check + esbuild) passes; `npm test` passes with no regressions in existing inline-runner / snippet-editor suites.
- [x] Closing the inline runner (`close()`) detaches both `mouseup` (on `contentEl`) and `selectionchange` (on `document`) listeners and nulls `createSnippetBtnEl` and `boundSelectionHandler` — no leaked listeners or stale DOM refs (verifiable by re-opening the runner and confirming no double-fire of selection events).
#### Manual Verification:
- [ ] `InlineRunnerModal` renders an always-visible create-snippet icon button in the footer row, inside the same left group as the close button, on every `render()` — including after `at-node`/`awaiting-loop-pick` re-renders that tear down and rebuild the footer.
- [ ] The create-snippet button is created with `disabled = true` on every render, then `updateCreateSnippetButtonState()` re-evaluates it against the live selection so an existing selection at render time enables it immediately.
- [ ] Selecting text inside `contentEl` (mouse drag then release) enables the create-snippet button within one `mouseup`/`selectionchange` tick; clearing the selection (clicking elsewhere in `contentEl`) disables it again.
- [ ] Selecting text outside `contentEl` (e.g. in the note editor behind the runner) does NOT enable the runner's create-snippet button — `getSelectedContentText()` returns `''` when the selection's anchor node is not contained in `contentEl`.
- [ ] Keyboard Shift+Arrow selection inside `contentEl` enables the button via the `document` `selectionchange` listener (covers non-mouse selection).
- [ ] Clicking the enabled create-snippet button opens `SnippetEditorModal` in create mode with the template textarea pre-filled verbatim with the selected text (verifiable via the chip editor's `templateArea.value`, the pre-fill path at `src/views/snippet-chip-editor.ts:125`).
- [ ] Clicking the create-snippet button when disabled does nothing (the browser-suppressed disabled button + the `if (template.length === 0) return` defensive guard both block action).
- [ ] `SnippetEditorModal` opens above the inline runner overlay (Obsidian modal z-index on `document.body`); the inline runner remains visible behind the modal. **[Risk r1 — verify explicitly.]**
- [ ] After `SnippetEditorModal` resolves (save or cancel), the inline runner is still open and functional; the create-snippet button reflects the then-current selection state.
- [ ] The runner's keyboard shortcuts (Ctrl/Alt+Left = step back, Ctrl/Alt+Right = redo, Escape = close) still work while the create-snippet button is present; the selection listener does not intercept keydown.
- [ ] The create-snippet button's aria-label uses `protocolRunner.createSnippetFromSelection` from the active locale (en or ru); the key exists in both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.

## Notes / Deferred
- **Sibling-phase dependency on `SnippetEditorOptions.initialTemplate`.** This phase constructs `new SnippetEditorModal(this.app, this.plugin, { mode: 'create', initialFolder, initialTemplate: template })` per the contract the Synthesis Notes fixed between Phase 1 and Phase 2. Phase 1 owns the `initialTemplate?: string` field on `SnippetEditorOptions` (and the `emptyMdTemplateDraft()` 4th-param plumbing). The current tree does not yet carry that field (`src/views/snippet-editor-modal.ts:32-51`), so `tsc` on this phase alone would flag `initialTemplate` as an unknown property — this resolves the moment Phase 1 lands, and the splice/grade panel sequences Phase 1 → Phase 2 per the synthesis notes. No redesign here; the contract is consumed verbatim.
- **Risk r1 (modal stacking) not pre-empted.** Per the plan's risk register, whether `SnippetEditorModal` (a real Obsidian `Modal` mounting to `document.body`) stacks above the inline runner overlay (a plain `position: fixed` div at `z-index: var(--layer-modal)`) is an unverified assumption. This elaboration does **not** add a defensive z-index rule — the plan scopes that fix to a follow-up only if validation fails. If the grade/validate panel observes stacking-behind, the remediation is a scoped z-index bump on `.rp-snippet-editor-modal` (out of scope for this phase as written).
- **Icon name `file-plus`.** Not used elsewhere in the codebase but is a standard lucide icon shipped with Obsidian's `setIcon` (same family as the existing `x`, `arrow-left`, `redo`, `skip-forward` icons used in this file). If the build target's Obsidian version lacks `file-plus`, swap to `plus` or `square-plus` — left as a validation-time check rather than guessing here.

## Phase 3: Pin insert-snippet modal and stabilize picker body height

### Changes

#### `src/views/insert-snippet-modal.ts`
Add `modalEl.addClass('rp-insert-snippet-modal')` as the **first** statement of `onOpen()` (before the `const { contentEl, titleEl } = this;` destructure and `contentEl.empty()`), using the protected-cast pattern that `SnippetEditorModal` already uses at `src/views/snippet-editor-modal.ts:151-153`. No other JS change — the existing body (root-path guard, picker host creation, `SnippetTreePicker` construction at `src/views/insert-snippet-modal.ts:31-43`, `mount()`) is untouched. Phase 5's later `hideSearchResultPath: true` edit lands on the options object at `:32`, disjoint from this top-of-method insert.

The current `onOpen()` head (`src/views/insert-snippet-modal.ts:20-22`):
```ts
  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
```
becomes:
```ts
  onOpen(): void {
    const modalEl = (this as unknown as { modalEl?: { addClass?: (cls: string) => void } }).modalEl;
    if (typeof modalEl?.addClass === 'function') {
      modalEl.addClass('rp-insert-snippet-modal');
    }

    const { contentEl, titleEl } = this;
    contentEl.empty();
```

#### `src/styles/snippet-tree-picker.css`
Append a new rule block immediately after the existing width-only host block at `src/styles/snippet-tree-picker.css:220-228` (the combined `.rp-stp-inline-host, .rp-stp-modal-host, .rp-insert-snippet-picker-host { width: 100%; … }` rule), extending the same `.rp-insert-snippet-picker-host` host scope. The block pins the modal to the top of `.modal-container` (opts out of Obsidian's flex `align-items: center`) and fixes the picker body + bare search-result list heights so the `renderSearchResults()` `removeBody` + bare `.rp-stp-list` rebuild (search-result list recreated directly on the host, not inside `.rp-stp-body`) does not recenter the modal on every keystroke.

No new CSS file — `snippet-tree-picker.css` is already wired into the build via `esbuild.config.mjs` `CSS_FILES` (entry at `esbuild.config.mjs:36`). The global `.rp-stp-list { max-height: 320px }` at `src/styles/snippet-tree-picker.css:148` still applies to the bare search-result list, so setting `min-height: 320px` fixes it to min==max==320px regardless of result count. The inner list inside `.rp-stp-body` (drill view) is governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }` at `src/styles/snippet-tree-picker.css:40` and is **not** matched by the new `.rp-stp-root > .rp-stp-list` direct-child selector — verified by reading the CSS; the drill-view inner list lives inside `.rp-stp-body`, so the `>` direct-child combinator excludes it.

Insert this block immediately after the closing brace of the `.rp-stp-inline-host, .rp-stp-modal-host, .rp-insert-snippet-picker-host { … }` rule (i.e. as a new block starting right after `src/styles/snippet-tree-picker.css:229`):
```css
/* Slice 3 — Pin insert-snippet modal near the top + stabilize body height so the
   search-result rebuild (removeBody + bare .rp-stp-list on host) doesn't recenter
   the modal on every keystroke. The insert host previously had only width CSS. */
.rp-insert-snippet-modal {
  /* Opt out of .modal-container's align-items: center; anchor to top padding. */
  align-self: flex-start;
  margin-top: 0;
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body {
  /* Stabilize drill view outer height (matches .rp-stp-modal-host treatment). */
  height: 360px;
}

.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list {
  /* Bare search-result list recreated on host by renderSearchResults().
     Global .rp-stp-list { max-height: 320px } (src/styles/snippet-tree-picker.css:148)
     still applies, so min==max==320px fixes the height regardless of result count. */
  min-height: 320px;
}
```

### Success Criteria
#### Automated Verification:
- [x] `InsertSnippetModal.onOpen()` adds class `rp-insert-snippet-modal` to `modalEl` using the protected-cast pattern (mirrors `src/views/snippet-editor-modal.ts:151-153`).
- [x] `src/styles/snippet-tree-picker.css` defines `.rp-insert-snippet-modal` with `align-self: flex-start` and `margin-top: 0` (opts out of Obsidian's flex vertical centering).
- [x] `src/styles/snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-body { height: 360px }` (stabilizes the drill view).
- [x] `src/styles/snippet-tree-picker.css` sets `.rp-insert-snippet-picker-host .rp-stp-root > .rp-stp-list { min-height: 320px }` (stabilizes the bare search-result list; combined with the global `max-height: 320px` at `src/styles/snippet-tree-picker.css:148`, the height is fixed).
- [x] The inner list inside `.rp-stp-body` (drill view) is **not** affected by the new `min-height` rule — the direct-child selector `> .rp-stp-list` targets only the bare search list (verified by reading the CSS — the inner list is governed by `.rp-stp-body .rp-stp-list { flex: 1 1 auto }` at `src/styles/snippet-tree-picker.css:40`).
- [x] `npm run lint` (ESLint + Stylelint) passes on `src/views/insert-snippet-modal.ts` and `src/styles/snippet-tree-picker.css`.
- [x] `npm run build` (type-check + esbuild) passes.
#### Manual Verification:
- [ ] Open the Insert snippet command, type a query that matches a varying number of snippets, then clear it — the modal does not move vertically on any keystroke (the search-result list grows/shrinks downward from the fixed top anchor).

## Phase 4: SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)

### Changes

#### `src/views/snippet-tree-picker.ts`
Add three highlight-state instance fields next to the existing `searchInputEl` field (`src/views/snippet-tree-picker.ts:95`); register a `keydown` listener on `searchInputEl` in `mount()` immediately after the existing `input` listener (`src/views/snippet-tree-picker.ts:130`) and create the aria-live status span inside `.rp-stp-search`; broaden the keep-predicate in `removeListenersExceptSearch()` (`src/views/snippet-tree-picker.ts:173`) to also keep `keydown`; call `clearHighlight()` at the top of `renderDrillView()` (`src/views/snippet-tree-picker.ts:219`) and `renderSearchResults()` (`src/views/snippet-tree-picker.ts:433`) right after `removeBody(host)`; add four private keyboard-nav methods. Reset highlight state in `mount()` and `unmount()` alongside the existing state resets.

**1. Instance fields — add after `searchInputEl` (`src/views/snippet-tree-picker.ts:95`):**
```ts
  private searchInputEl: HTMLInputElement | null = null;

  /** Phase 4 — keyboard-nav highlight cursor. -1 = nothing highlighted.
   *  Reset on each mount() and on every body re-render via clearHighlight(). */
  private highlightedIndex: number = -1;
  /** The currently-highlighted row DOM node. Detached by removeBody() on the
   *  next re-render, so clearHighlight() only resets the cursor (no class
   *  removal needed — the old element is gone). */
  private highlightedRowEl: HTMLElement | null = null;
  /** Visually-hidden aria-live="polite" status span created in mount(); survives
   *  removeBody() because it lives inside .rp-stp-search. Updated by moveHighlight(). */
  private highlightStatusEl: HTMLElement | null = null;
```

**2. `mount()` — reset highlight state (add next to the existing state resets at `src/views/snippet-tree-picker.ts:110-112`):**
```ts
    this.searchInputEl = null;
    this.committedRelativePath = null;
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
    this.highlightStatusEl = null;
```

**3. `mount()` — add keydown listener + aria-live status span immediately after the existing `input` listener (`src/views/snippet-tree-picker.ts:130-133`):**
```ts
    this.addListener(searchInput, 'input', () => {
      const value = searchInput.value;
      this.onSearchInput(value);
    });
    // Phase 4 — keyboard navigation (ArrowUp/Down + Enter) on the search input.
    // Tracked via addListener so unmount()/clearContainer() tear it down, and
    // preserved across body re-renders by removeListenersExceptSearch().
    this.addListener(searchInput, 'keydown', (e) => {
      this.handleSearchKeydown(e as KeyboardEvent);
    });

    // Phase 4 — visually-hidden aria-live="polite" status span for screen-reader
    // announcements of the highlighted row title. Lives inside .rp-stp-search so
    // removeBody() (which keeps .rp-stp-search) preserves it across re-renders.
    const statusSpan = searchWrap.createEl('span', {
      cls: 'rp-stp-sr-only',
      attr: { 'aria-live': 'polite', role: 'status' },
    });
    this.highlightStatusEl = statusSpan;
```

**4. `unmount()` — reset highlight state (add next to the existing resets at `src/views/snippet-tree-picker.ts:149-150`):**
```ts
    this.containerEl = null;
    this.searchInputEl = null;
    this.committedRelativePath = null;
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
    this.highlightStatusEl = null;
```

**5. `removeListenersExceptSearch()` — broaden the keep-predicate at `src/views/snippet-tree-picker.ts:173`:**
```ts
      if (
        entry.el === (this.searchInputEl as unknown as HTMLElement) &&
        (entry.type === 'input' || entry.type === 'keydown')
      ) {
        keep.push(entry);
      } else {
        drop.push(entry);
      }
```

**6. `renderDrillView()` — call `clearHighlight()` right after `removeBody(host)` at `src/views/snippet-tree-picker.ts:219`:**
```ts
    this.removeListenersExceptSearch();
    this.removeBody(host);
    this.clearHighlight();
```

**7. `renderSearchResults()` — call `clearHighlight()` right after `removeBody(host)` at `src/views/snippet-tree-picker.ts:433`:**
```ts
    this.removeListenersExceptSearch();
    this.removeBody(host);
    this.clearHighlight();
```

**8. New private keyboard-nav methods — add after `renderSearchResults()` (before the class closing brace at `src/views/snippet-tree-picker.ts:481`):**
```ts

  // ── Keyboard navigation (Phase 4) ──────────────────────────────────────

  private handleSearchKeydown(e: KeyboardEvent): void {
    // Ignore modifier-laden keys (Ctrl/Cmd/Alt+Arrow etc.) — those belong to the
    // host (e.g. InlineRunnerModal Ctrl+← / Ctrl+→ / Esc) and must pass through
    // unchanged. The runner's handleKeydown INPUT/TEXTAREA bail holds regardless.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = this.currentRows();
      if (rows.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      this.moveHighlight(rows, delta);
      return;
    }

    if (e.key === 'Enter') {
      // No-op + no-throw when nothing is highlighted.
      if (this.highlightedIndex === -1 || this.highlightedRowEl === null) return;
      e.preventDefault();
      // Dispatch the row's registered click handler — same path as a mouse click
      // (file row → onSelect, folder row → drill).
      this.highlightedRowEl.click();
      return;
    }
  }

  /** All visible folder/file rows under the current root, in document order.
   *  Never cached — always re-queried so a fresh re-render's rows are used. */
  private currentRows(): HTMLElement[] {
    const root = this.rootEl();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('.rp-stp-folder-row, .rp-stp-file-row'));
  }

  /** Move the highlight cursor by `delta` with wrap-around modulo rows.length. */
  private moveHighlight(rows: HTMLElement[], delta: number): void {
    const count = rows.length;
    if (count === 0) return;

    // Toggle the old highlight off (the old element is still live at this point).
    if (this.highlightedRowEl !== null) {
      this.highlightedRowEl.classList.remove('rp-stp-row-highlighted');
    }

    let next: number;
    if (this.highlightedIndex === -1) {
      // Nothing highlighted: ArrowDown → first (0), ArrowUp → last (count-1).
      next = delta === 1 ? 0 : count - 1;
    } else {
      next = (this.highlightedIndex + delta + count) % count;
    }
    const row = rows[next];

    row.classList.add('rp-stp-row-highlighted');
    row.scrollIntoView({ block: 'nearest' });

    this.highlightedIndex = next;
    this.highlightedRowEl = row;

    // Announce the highlighted row title via the aria-live status span.
    const titleEl = row.querySelector<HTMLElement>('.rp-stp-row-title');
    const name = titleEl?.textContent ?? '';
    if (this.highlightStatusEl !== null) {
      this.highlightStatusEl.textContent = this.t('snippetTreePicker.highlightAria', { name });
    }
  }

  /** Reset the highlight cursor. Called at the top of every body re-render
   *  (renderDrillView / renderSearchResults) right after removeBody(host) —
   *  the previously-highlighted row is already detached by removeBody(), so
   *  no class removal is needed; just reset the cursor. */
  private clearHighlight(): void {
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
  }
```

#### `src/styles/snippet-tree-picker.css`
Append the keyboard-nav highlight rule + the visually-hidden screen-reader-only helper at the end of the file (after the `.rp-stp-select-folder-btn.is-committed:hover` block at `src/styles/snippet-tree-picker.css:274-277`). Additive selectors — no existing rule touched (Phase 3's pin/height rules land earlier in the file; these are distinct selectors).

```css
/* Phase 4 — keyboard-nav highlight + screen-reader-only status span. */
.rp-stp-row-highlighted {
  background: var(--background-modifier-hover);
  border-color: var(--background-modifier-border);
}

.rp-stp-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

#### `src/i18n/locales/en.json`
Add the `highlightAria` key under the existing `snippetTreePicker` namespace (after `breadcrumbNavLabel`). No existing key modified.

```json
    "crumbAria": "Go to {name}",
    "breadcrumbNavLabel": "Snippet folders",
    "highlightAria": "Highlighted: {name}"
  },
```

#### `src/i18n/locales/ru.json`
Add the `highlightAria` key under the existing `snippetTreePicker` namespace (after `breadcrumbNavLabel`). No existing key modified.

```json
    "crumbAria": "Перейти к {name}",
    "breadcrumbNavLabel": "Папки сниппетов",
    "highlightAria": "Подсвечено: {name}"
  },
```

#### `src/__tests__/views/snippet-tree-picker.test.ts`
Add a `triggerKeydown` helper and a `rowsOf` helper next to the existing `triggerClick`/`triggerInput` helpers; extend the `MockEl` interface and `makeEl` factory with four additive methods (`querySelector`, `querySelectorAll`, `scrollIntoView`, `click`) so the implementation's real-DOM calls (`rootEl().querySelectorAll(...)`, `row.querySelector('.rp-stp-row-title')`, `row.scrollIntoView(...)`, `this.highlightedRowEl.click()`) work in the hand-rolled MockEl environment; append a `describe('Keyboard navigation (Phase 4)', ...)` Vitest suite covering ArrowDown/ArrowUp traversal, wrap-around, Enter dispatches the row's click handler (file-row `onSelect` spy + folder-row drill assertion), Enter no-op when no row highlighted, keydown listener survives a debounced search re-render, highlight resets after a drill re-render, and the aria-live status announcement.

**A. `MockEl` interface — add four members (inside the `interface MockEl { ... }` block, e.g. after `dispatchEvent`):**
```ts
  querySelector: (selector: string) => MockEl | null;
  querySelectorAll: (selector: string) => MockEl[];
  scrollIntoView: (opts?: unknown) => void;
  click: () => void;
```

**B. `makeEl()` factory — add four implementations (inside the `el` object, e.g. after `dispatchEvent`):**
```ts
    querySelector(selector: string): MockEl | null {
      // Minimal: supports a single '.class' selector. Returns first descendant
      // match in document order (mirrors DOM querySelector semantics — not self).
      const cls = selector.trim().startsWith('.') ? selector.trim().slice(1) : selector.trim();
      function walk(node: MockEl): MockEl | null {
        for (const c of node.children) {
          if (c.classList.has(cls)) return c;
          const r = walk(c);
          if (r) return r;
        }
        return null;
      }
      return walk(el);
    },
    querySelectorAll(selector: string): MockEl[] {
      // Minimal: supports comma-separated '.class1, .class2' selectors. Returns
      // all descendant matches in document order.
      const classes = selector
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('.'))
        .map((s) => s.slice(1));
      const out: MockEl[] = [];
      function walk(node: MockEl): void {
        for (const c of node.children) {
          if (classes.some((cls) => c.classList.has(cls))) out.push(c);
          walk(c);
        }
      }
      walk(el);
      return out;
    },
    scrollIntoView(_opts?: unknown): void {},
    click(): void {
      el.dispatchEvent({ type: 'click', target: el });
    },
```

**C. Test helpers — add near the existing `triggerInput`/`flushDebounce` helpers:**
```ts
function triggerKeydown(
  inputEl: MockEl | undefined,
  key: string,
  mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): void {
  if (!inputEl) throw new Error('triggerKeydown: element is undefined');
  const event = {
    type: 'keydown',
    key,
    target: inputEl,
    ctrlKey: !!mods.ctrlKey,
    altKey: !!mods.altKey,
    metaKey: !!mods.metaKey,
    preventDefault: vi.fn(),
  };
  inputEl.dispatchEvent(event as unknown as { type: string; target?: unknown });
}

function rowsOf(container: MockEl): MockEl[] {
  return findAll(container, (el) =>
    el.classList.has('rp-stp-folder-row') || el.classList.has('rp-stp-file-row'),
  );
}
```

**D. Keyboard-nav suite — append at the end of the file (after the last `describe('Picker row accessibility ...)` block):**
```ts
describe('Keyboard navigation (Phase 4)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('ArrowDown moves the highlight onto the first row, then the second', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown');
    let rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(false);

    triggerKeydown(input, 'ArrowDown');
    rows = rowsOf(container);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('ArrowUp moves the highlight back to the previous row', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → 0
    triggerKeydown(input, 'ArrowDown'); // → 1
    triggerKeydown(input, 'ArrowUp');   // → 0
    const rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('wrap-around: ArrowDown from last wraps to first; ArrowUp from first wraps to last', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → 0
    triggerKeydown(input, 'ArrowDown'); // → 1
    triggerKeydown(input, 'ArrowDown'); // → 2 (last)
    let rows = rowsOf(container);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(true);

    triggerKeydown(input, 'ArrowDown'); // wrap last → first
    rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(false);

    triggerKeydown(input, 'ArrowUp'); // wrap first → last
    rows = rowsOf(container);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('Enter on a highlighted file row dispatches the row click handler (onSelect with kind: file)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → file row (only row)
    triggerKeydown(input, 'Enter');
    expect(onSelect).toHaveBeenCalledWith({ kind: 'file', relativePath: 'report.json' });
  });

  it('Enter on a highlighted folder row drills in (same path as a mouse click)', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct'], snippets: [] });
    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → folder row (first row)
    triggerKeydown(input, 'Enter');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // onSelect NOT called — folder click drills (D-12).
    expect(onSelect).not.toHaveBeenCalled();
    expect(svc.listFolder).toHaveBeenCalledWith(`${ROOT}/abdomen`);
  });

  it('Enter with no highlighted row is a no-op and does not throw', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [jsonSnippet(`${ROOT}/r.json`)],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    expect(() => triggerKeydown(input, 'Enter')).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('after a debounced search re-render the keydown listener is still active (ArrowDown moves highlight on freshly-rendered rows)', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct.md`, `${ROOT}/abdomen/mri.md`],
      folders: [],
      total: 2,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'm');
    await flushDebounce();

    // Search results rendered — proves removeListenersExceptSearch() preserved
    // the keydown listener (it would have been dropped by the old input-only
    // keep-predicate).
    expect(rowsOf(container).length).toBe(2);

    triggerKeydown(input, 'ArrowDown');
    const rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
  });

  it('after a drill re-render the highlight resets (no row carries rp-stp-row-highlighted)', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct'], snippets: [] });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → row 0 highlighted
    expect(rowsOf(container)[0].classList.has('rp-stp-row-highlighted')).toBe(true);

    // Drill in via click → renderDrillView → clearHighlight resets the cursor.
    triggerClick(rowsOf(container)[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    const rowsAfter = rowsOf(container);
    expect(rowsAfter.every((r) => !r.classList.has('rp-stp-row-highlighted'))).toBe(true);
  });

  it('aria-live status span announces the highlighted row title via snippetTreePicker.highlightAria (defaultT → English)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown');

    const status = findFirst(container, (el) => el.classList.has('rp-stp-sr-only'));
    expect(status?.textContent).toBe('Highlighted: abdomen');
  });

  it('modifier-laden keys (Ctrl+ArrowDown) are ignored — no highlight moves, no throw', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    expect(() => triggerKeydown(input, 'ArrowDown', { ctrlKey: true })).not.toThrow();
    expect(rowsOf(container).every((r) => !r.classList.has('rp-stp-row-highlighted'))).toBe(true);
  });
});
```

### Success Criteria
#### Automated Verification:
- [x] `npm test` — new `src/__tests__/views/snippet-tree-picker.test.ts` `Keyboard navigation (Phase 4)` suite passes: ArrowDown/ArrowUp traversal, wrap-around (last→first + first→last), Enter dispatches the row's `click` handler (file-row `onSelect` spy + folder-row drill assertion), Enter no-op when no row highlighted, keydown listener survives a debounced search re-render (ArrowDown moves highlight on freshly-rendered rows), highlight resets after a drill re-render, aria-live status announcement, modifier-laden keys ignored.
- [x] `npm run lint` — ESLint + Stylelint pass (including the new `.rp-stp-row-highlighted` / `.rp-stp-sr-only` CSS rules).
- [x] `npm run build` — type-check + esbuild production bundle succeeds; `InlineRunnerModal` and `InsertSnippetModal` consumers compile unchanged (no public-surface signature change to `SnippetTreePickerOptions` or `SnippetTreePicker`).
#### Manual Verification:
- [ ] In the Insert snippet modal, typing a query then pressing ArrowDown moves the highlight onto the first row; ArrowDown again moves to the second; ArrowUp moves back; navigation wraps from last→first and first→last.
- [ ] Pressing Enter while a file row is highlighted inserts that snippet (same path as a mouse click); pressing Enter on a folder row drills in (same path as a mouse click); pressing Enter with no row highlighted is a no-op.
- [ ] After the modal re-renders on a new keystroke or a breadcrumb/drill navigation, arrow keys still work and no stale-row `.click()` fires.
- [ ] A screen reader announces the highlighted row's title on each highlight move (aria-live status span via `snippetTreePicker.highlightAria`).
- [ ] Arrow/Enter keys pressed while focus is in the picker search input do not trigger `InlineRunnerModal` Ctrl+← / Ctrl+→ / Escape handling (the runner's `handleKeydown` INPUT/TEXTAREA bail holds).
- [ ] `snippetTreePicker.highlightAria` key exists in both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.

## Notes / Deferred
- **MockEl extended with `querySelector` / `querySelectorAll` / `scrollIntoView` / `click`.** The implementation uses the real-DOM APIs `rootEl().querySelectorAll('.rp-stp-folder-row, .rp-stp-file-row')`, `row.querySelector('.rp-stp-row-title')`, `row.scrollIntoView({ block: 'nearest' })`, and `this.highlightedRowEl.click()` (per the plan's prescription). The existing `MockEl` in `src/__tests__/views/snippet-tree-picker.test.ts` did not implement these. To keep the implementation faithful to the plan AND testable in the hand-rolled MockEl environment, four additive methods were added to the `MockEl` interface + `makeEl` factory (minimal: `querySelector`/`querySelectorAll` support only `.class` / comma-separated `.class1, .class2` selectors — sufficient for this phase's queries; `scrollIntoView` is a no-op; `click` dispatches a synthetic click event to the row's registered listeners). This is additive test infrastructure; it does not touch the existing default-`false` path-display test (`'result row secondary text = full relative path from rootPath'` in `src/__tests__/views/snippet-tree-picker.test.ts`) that Phase 5 keeps unchanged, so risk r3's disjointness holds.

## Phase 5: Add hideSearchResultPath option and opt in from InsertSnippetModal

### Changes

#### `src/views/snippet-tree-picker.ts`
Add an optional `hideSearchResultPath?: boolean` field to the `SnippetTreePickerOptions` interface (after the existing `t?: Translator` field at `src/views/snippet-tree-picker.ts:73-74`). It defaults to `false` by virtue of being optional, is search-result-only, and does not affect drill-view rows (which never render the path line). No constructor normalization — read `this.options.hideSearchResultPath` directly, matching the established `this.options.mode` / `this.options.rootPath` / `this.options.t` access pattern. No new fields, listeners, or state.

Interface edit (current shape at `src/views/snippet-tree-picker.ts:62-75`):

```ts
export interface SnippetTreePickerOptions {
  app: App;
  snippetService: SnippetService;
  container: HTMLElement;
  mode: SnippetTreePickerMode;
  /** Vault-relative root path the picker is anchored at. */
  rootPath: string;
  initialSelection?: string;
  onSelect: (result: SnippetTreePickerResult) => void;
  /** Phase 84 (I18N-02): translator for user-visible copy. Optional —
   *  unit tests and standalone callers fall back to the English defaultT. */
  t?: Translator;
  /** Phase 5: when true, search-result file rows omit the secondary
   *  `.rp-stp-result-path` line and render basename-only. Default `false`
   *  preserves the prior two-line behavior (basename + full relative path).
   *  Drill-view rows never render the path line regardless of this flag. */
  hideSearchResultPath?: boolean;
}
```

Narrow the `renderFileRow()` path-div gate at `src/views/snippet-tree-picker.ts:381` from `if (isSearchResult)` to `if (isSearchResult && !this.options.hideSearchResultPath)`. The surrounding `renderFileRow` body (current shape at `src/views/snippet-tree-picker.ts:357-388`):

```ts
  private renderFileRow(
    listEl: HTMLElement,
    snippetOrBasename: Snippet | { basename: string; relativePath: string },
    isSearchResult: boolean,
  ): void {
    let basename: string;
    let relativePath: string;
    if ('kind' in snippetOrBasename) {
      // Drill-view row: Snippet object. Basename from path. Relative path = drillPath + basename.
      basename = basenameOf(snippetOrBasename.path);
      relativePath = this.drillPath.length === 0
        ? basename
        : `${this.drillPath.join('/')}/${basename}`;
    } else {
      basename = snippetOrBasename.basename;
      relativePath = snippetOrBasename.relativePath;
    }

    const row = createButton(listEl, { cls: 'rp-stp-file-row' });
    const nameEl = row.createEl('div', { cls: 'rp-stp-result-name' });
    nameEl.setText(`${fileGlyph(basename)} ${basename}`);
    nameEl.empty();
    nameEl.createEl('span', { cls: 'rp-stp-row-glyph', text: fileGlyph(basename) });
    nameEl.createEl('span', { cls: 'rp-stp-row-title', text: basename });
    if (isSearchResult && !this.options.hideSearchResultPath) {
      const pathEl = row.createEl('div', { cls: 'rp-stp-result-path' });
      pathEl.setText(relativePath);
    }

    const relPathAtClickTime = relativePath;
    this.addListener(row, 'click', () => {
      this.options.onSelect({ kind: 'file', relativePath: relPathAtClickTime });
    });
  }
```

No change to `renderFolderRow` (its `if (isSearchResult)` gate at `src/views/snippet-tree-picker.ts:336` stays — folder search-result rows keep their path line for disambiguation in the move-to modal). No change to the drill-view branch, no change to the constructor.

#### `src/views/insert-snippet-modal.ts`
Pass `hideSearchResultPath: true` alongside the existing `mode: 'file-only'` in the `SnippetTreePicker` options object constructed in `onOpen()` at `src/views/insert-snippet-modal.ts:32-44`. No other change to the modal — Phase 3's `modalEl.addClass('rp-insert-snippet-modal')` remains the first statement in `onOpen()` (owned by Phase 3, sequenced before this phase); this edit lands on the later options-object lines only.

The updated `onOpen()` body (current shape at `src/views/insert-snippet-modal.ts:22-45`):

```ts
  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
    titleEl.setText(this.plugin.i18n.t('insertSnippet.title'));

    const rootPath = this.plugin.settings.snippetFolderPath.trim();
    if (rootPath === '') {
      contentEl.createEl('p', { text: this.plugin.i18n.t('insertSnippet.setSnippetFolderFirst') });
      return;
    }

    const pickerHost = contentEl.createDiv({ cls: 'rp-insert-snippet-picker-host' });
    this.picker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost,
      mode: 'file-only',
      rootPath,
      hideSearchResultPath: true,
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
      onSelect: (result) => {
        void this.handleSelect(rootPath, result.relativePath);
      },
    });
    void this.picker.mount();
  }
```

#### `src/__tests__/views/snippet-tree-picker.test.ts`
Add one Vitest suite asserting that with `hideSearchResultPath: true` in file-only mode, a search-result file row renders `.rp-stp-result-name` (glyph + basename) but no `.rp-stp-result-path` element. The existing default-`false` regression guard at `src/__tests__/views/snippet-tree-picker.test.ts:638-655` (`'result row secondary text = full relative path from rootPath'`) stays unchanged. The new suite reuses the in-file `makePicker` / `findFirst` / `findByClass` / `triggerInput` / `flushDebounce` helpers and the `FakeSnippetService` / `makeFakeSnippetService` / `jsonSnippet` fixtures already defined at `src/__tests__/views/snippet-tree-picker.test.ts:235-280`. Append at the end of the file (after the last `describe('Picker row accessibility…')` block):

```ts
describe('hideSearchResultPath option (Phase 5)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('hideSearchResultPath: true in file-only mode renders name but omits the result-path line', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct/ct-routine.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker(
      { mode: 'file-only', hideSearchResultPath: true },
      svc,
    );
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    // Name line present (glyph + basename).
    const nameEl = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent).toContain('ct-routine.md');

    // No result-path element rendered anywhere in the picker.
    const pathEl = findFirst(container, (el) => el.classList.has('rp-stp-result-path'));
    expect(pathEl).toBeNull();

    // The file row itself is still present and selectable.
    const fileRows = findByClass(container, 'rp-stp-file-row');
    expect(fileRows.length).toBe(1);
  });

  it('hideSearchResultPath omitted (default false) still renders the result-path line — regression guard', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct/ct-routine.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    const pathEl = findFirst(container, (el) => el.classList.has('rp-stp-result-path'));
    expect(pathEl).not.toBeNull();
    expect(pathEl?.textContent).toBe('abdomen/ct/ct-routine.md');
  });
});
```

### Success Criteria
#### Automated Verification:
- [x] `npm run build` (`tsc --noEmit` + esbuild) passes with no type errors after adding the optional `hideSearchResultPath?: boolean` field — all existing callers compile unchanged because the field is optional.
- [x] `npm test` passes — the existing default-`false` test at `src/__tests__/views/snippet-tree-picker.test.ts:638-655` remains green (search-result file row still renders `.rp-stp-result-path` with the full relative path when the flag is unset), and the two new tests in the `hideSearchResultPath option (Phase 5)` suite pass (`.rp-stp-result-path` is absent when `hideSearchResultPath: true` while `.rp-stp-result-name` is present; the default-`false` regression guard renders the path line).
- [x] `npm run lint` passes for `src/views/snippet-tree-picker.ts`, `src/views/insert-snippet-modal.ts`, and `src/__tests__/views/snippet-tree-picker.test.ts`.

#### Manual Verification:
- [ ] Run the "Insert snippet" command, type a query matching a snippet, and confirm the search-result rows show name-only (no secondary path line).
- [ ] Open the Snippet Manager move-to modal (`both`/`folder-only` mode, does not pass the flag) and confirm search-result rows still show the secondary path line for disambiguation — no regression.
- [ ] In the insert modal, drill-view navigation (if reachable) shows name-only rows as before — the flag is search-only and does not affect drill-view.
