---
date: 2026-07-26T16:31:29+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Create snippet from selection in Runner footer"
source: .rpiv/artifacts/plans/2026-07-26_16-27-21_snippet-create-from-selection-and-insert-modal-ux.md
phase_n: 2
phase_title: "Create snippet from selection in Runner footer"
status: ready
tags: [elaboration]
---

## Phase 2: Create snippet from selection in Runner footer

### Changes

#### `src/views/inline-runner-modal.ts`
Add the `SnippetEditorModal` import (sibling Phase 1 publishes the `initialTemplate` option this phase consumes — referenced by the synthesis-fixed contract, not redefined here), two new instance fields next to `boundKeyHandler`, selection-listener wiring in `open()`/`close()`, a footer-left group rendered in the `render()` footer-teardown block, and three private helper methods.

**Import** — add to the existing import block at the top of the file (after the `SnippetFillInModal` import near `src/views/inline-runner-modal.ts:12`):

```ts
import { SnippetEditorModal } from './snippet-editor-modal';
```

**Instance fields** — add immediately after the existing `boundKeyHandler` field declaration (`src/views/inline-runner-modal.ts:78`):

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

**Three private methods** — add at the end of the `Event Handlers` region, after `handleKeydown()` (`src/views/inline-runner-modal.ts:540-561`). Placement keeps the selection helpers next to the keydown handler they complement.

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
- [ ] `tsc` compiles with no new errors after adding the `SnippetEditorModal` import, the `createSnippetBtnEl`/`boundSelectionHandler` fields, the `open()`/`close()` listener wiring, the footer-left render block, and the three private methods to `InlineRunnerModal`. (Depends on sibling Phase 1 having published the optional `initialTemplate?: string` field on `SnippetEditorOptions` — the synthesis-fixed contract this phase consumes; if Phase 1 lands first this compiles, otherwise `tsc` flags the `initialTemplate` property and the splice/grade panel re-orders.)
- [ ] `npm run build` (type-check + esbuild) passes; `npm test` passes with no regressions in existing inline-runner / snippet-editor suites.
- [ ] Closing the inline runner (`close()`) detaches both `mouseup` (on `contentEl`) and `selectionchange` (on `document`) listeners and nulls `createSnippetBtnEl` and `boundSelectionHandler` — no leaked listeners or stale DOM refs (verifiable by re-opening the runner and confirming no double-fire of selection events).
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