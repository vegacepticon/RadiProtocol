---
date: 2026-07-26T16:31:29+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Pre-fill snippet editor from selection + standalone create-snippet command"
source: .rpiv/artifacts/plans/2026-07-26_16-27-21_snippet-create-from-selection-and-insert-modal-ux.md
phase_n: 1
phase_title: "Pre-fill snippet editor from selection + standalone create-snippet command"
status: ready
tags: [elaboration]
---

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

Edit 2 — `emptyMdTemplateDraft()` 4th param + pre-filled `template` (replaces the function at `src/views/snippet-editor-modal.ts:71-81`):

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
Add `createdNotice` to the `snippetEditor` namespace, placed after `movedAndRenamedNotice` (line ~135) to keep the notice keys grouped:

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
- [ ] `tsc` compiles with no new errors after adding `initialTemplate?: string` to `SnippetEditorOptions` and the 4th param to `emptyMdTemplateDraft()`.
- [ ] `emptyMdTemplateDraft(folder, locale, cat, 'Hello {{name}}!')` returns a draft whose `template === 'Hello {{name}}!'`; with the 4th arg omitted, `template === ''` (byte-identical to prior behavior).
- [ ] `SnippetManagerView.openCreateModal()` (`src/views/snippet-manager-view.ts:258-267`) compiles unchanged — no call-site edit required (the new field is optional and the new param defaults to `''`).
- [ ] `npm run build` (type-check + esbuild) passes; `npm test` passes with no regressions in existing snippet-editor / chip-editor suites.
#### Manual Verification:
- [ ] Constructing `new SnippetEditorModal(app, plugin, { mode: 'create', initialFolder, initialTemplate: 'selected text' })` and opening it mounts the chip editor textarea pre-filled with `selected text` (verifiable via the chip editor's `templateArea.value` at `src/views/snippet-chip-editor.ts:125`).
- [ ] Constructing the modal without `initialTemplate` (the existing `openCreateModal` path at `src/views/snippet-manager-view.ts:258-267`) still mounts with an empty template — no regression.
- [ ] Saving a pre-filled create-mode snippet persists the template text to the vault file via `SnippetService.save()` (the `draftToSave` spread at `src/views/snippet-editor-modal.ts:536-537` carries `template` through).
- [ ] A `create-snippet` command appears in the Obsidian command palette with id `create-snippet` and a human-readable name.
- [ ] Running `create-snippet` with an active `MarkdownView` that has a selection opens `SnippetEditorModal` with the template textarea pre-filled with that selection.
- [ ] Running `create-snippet` with an active `MarkdownView` but no selection opens `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] Running `create-snippet` with no active `MarkdownView` opens `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] On save, a `Notice` is shown using `snippetEditor.createdNotice` from the active locale (en or ru).

## Notes / Deferred
None — the plan's contract (`SnippetEditorOptions.initialTemplate` + `emptyMdTemplateDraft()` 4th param) is published here verbatim for Phase 2 to consume; backward compatibility is preserved by construction (optional field + defaulted param), so `SnippetManagerView.openCreateModal()` needs no edit. The `handleCreateSnippet()` method deliberately has no md-guard bail and reads `activeView?.editor?.getSelection() ?? ''` (not `editor.replaceSelection`) per the plan's explicit constraint.