---
date: 2026-07-26T16:19:09+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Pre-fill snippet editor from selection + standalone create-snippet command"
source: .rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md
slice_n: 1
slice_title: "Pre-fill snippet editor from selection + standalone create-snippet command"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 1: Pre-fill snippet editor from selection + standalone create-snippet command

## Approach

Two independent-but-composed changes, both localized to the create-mode path of
`SnippetEditorModal` plus one new command in the plugin shell:

1. **Pre-fill plumbing (option → draft → textarea).** `SnippetEditorModal`'s
   create mode builds its `draft` from the `emptyMdTemplateDraft()` factory, which
   hard-codes `template: ''` (`snippet-editor-modal.ts:71-83`). The chip editor
   then mounts from `draft.template` directly — `templateArea.value = draft.template`
   at `snippet-chip-editor.ts:125` is the single pre-fill path the whole outcome
   rests on. So the minimal, contract-preserving way to pre-fill is to thread a
   4th parameter `initialTemplate: string = ''` through `emptyMdTemplateDraft()`
   and pass `options.initialTemplate ?? ''` from the constructor's create-mode
   branch (`snippet-editor-modal.ts:129-137`). No other create-mode code path
   needs to change: `mountChipEditor` already reads `draft.template`
   (`snippet-editor-modal.ts:384`), and `handleSave()`'s `draftToSave` spread
   (`snippet-editor-modal.ts:536-537`) carries the template through
   `SnippetService.save()` untouched, then `safeResolve` fires
   (`snippet-editor-modal.ts:553`). The new `initialTemplate?: string` field on
   `SnippetEditorOptions` is **optional**, so the existing create-mode caller
   `SnippetManagerView.openCreateModal()` (`snippet-manager-view.ts:258-267`)
   compiles unchanged — backward-compatible by construction.

2. **Standalone `create-snippet` command.** A new command in `main.ts`
   mirroring `handleInsertSnippet()` (`main.ts:285-297`) in shape, but with two
   deliberate divergences from that pattern:
   - **No "open Markdown first" guard.** The slice brief says pre-fill is empty
     when there is no active md view or no selection — so the command must open
     the editor with an empty template rather than bailing with a Notice. This
     keeps the command useful for authoring snippets from scratch via the
     palette.
   - **Pre-fill source is `editor.getSelection()`, not `editor.replaceSelection()`.**
     `handleInsertSnippet` writes the rendered snippet back into the editor; the
     create-snippet command instead *reads* the current selection to seed the
     template, then hands off to `SnippetEditorModal`.

   The command reads the active `MarkdownView` via
   `this.app.workspace.getActiveViewOfType(MarkdownView)`, takes
   `activeView?.editor?..getSelection() ?? ''` as `initialTemplate`, constructs
   `new SnippetEditorModal(app, this, { mode: 'create', initialFolder:
   this.settings.snippetFolderPath, initialTemplate })`, `open()`s it, awaits
   `modal.result`, and shows a `Notice` on save. The Notice reuses the existing
   `snippetEditor` i18n namespace with one new key (`createdNotice`) added to
   both locales — consistent with `snippetEditor.movedNotice` /
   `renamedNotice` already emitted by the modal's save pipeline.

No discovery, no validation, no runner-state changes. The chip editor's
placeholder/orphan-badge machinery operates on whatever `draft.template`
contains, so a pre-filled template with `{{placeholder-id}}` tokens will
surface orphan badges exactly as if the user had typed them — that is the
intended behavior (the user then adds/edits placeholders and saves).

## File Map

- `src/views/snippet-editor-modal.ts` — change — add `initialTemplate?: string`
  to `SnippetEditorOptions`; add 4th param `initialTemplate: string = ''` to
  `emptyMdTemplateDraft()` and use it for the `template` field; pass
  `options.initialTemplate ?? ''` as the 4th arg in the constructor create-mode
  branch.
- `src/main.ts` — change — import `SnippetEditorModal`; register a new
  `create-snippet` `addCommand` block (after the `insert-snippet` command at
  `main.ts:96-100`); add a `handleCreateSnippet()` method mirroring
  `handleInsertSnippet()` (`main.ts:285-297`) but reading
  `editor.getSelection()` for pre-fill, with no md-guard bail.
- `src/i18n/locales/en.json` — change — add `snippetEditor.createdNotice`
  ("Snippet created.") for the post-save Notice.
- `src/i18n/locales/ru.json` — change — add `snippetEditor.createdNotice`
  (Russian translation) for the post-save Notice.

## Key Interfaces

```ts
// src/views/snippet-editor-modal.ts — SnippetEditorOptions (additive, optional)
interface SnippetEditorOptions {
  mode: 'create' | 'edit';
  initialFolder: string;
  snippet?: Snippet;
  initialKind?: never;
  snippetServiceOverride?: { /* unchanged */ };
  disableFolderPicker?: boolean;
  /** NEW: pre-fill the create-mode template textarea. Empty/undefined ⇒
   *  byte-identical to previous behavior (empty template). */
  initialTemplate?: string;
}

// Factory signature — 4th param defaults to '' so all existing callers
// (openCreateModal) compile unchanged without modifying their call sites.
function emptyMdTemplateDraft(
  folder: string,
  locale: string,
  cat: string,
  initialTemplate: string = '',
): MdTemplateSnippet;
// returns { ..., template: initialTemplate, ... }
```

```ts
// src/main.ts — new command + handler
// Registration (alongside the existing insert-snippet command):
this.addCommand({
  id: 'create-snippet',
  name: 'Create snippet from selection',
  callback: () => { void this.handleCreateSnippet(); },
});

// Handler shape (mirrors handleInsertSnippet, minus the md-guard, plus pre-fill):
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

```jsonc
// src/i18n/locales/en.json — snippetEditor namespace (additive)
"createdNotice": "Snippet created."
// src/i18n/locales/ru.json — snippetEditor namespace (additive)
"createdNotice": "Сниппет создан."
```

## Integration Points

- `src/views/snippet-editor-modal.ts:30-48` — `SnippetEditorOptions` gets the new
  optional `initialTemplate?: string` field. Additive; no existing caller
  breaks.
- `src/views/snippet-editor-modal.ts:71-83` — `emptyMdTemplateDraft()` gains the
  4th param `initialTemplate: string = ''`; the `template:` field reads it
  instead of the literal `''`.
- `src/views/snippet-editor-modal.ts:129-137` — constructor create-mode branch
  passes `options.initialTemplate ?? ''` as the 4th arg to
  `emptyMdTemplateDraft()`. (Edit-mode branch is untouched.)
- `src/views/snippet-chip-editor.ts:125` — no change; confirms
  `templateArea.value = draft.template` is the pre-fill path. The chip editor
  mounts from `draft.template` via `mountChipEditor` at
  `snippet-editor-modal.ts:384`, so the seeded template flows through unchanged.
- `src/views/snippet-editor-modal.ts:536-537` — no change; the `draftToSave`
  spread carries the pre-filled `template` into `SnippetService.save()` as-is.
- `src/main.ts:96-100` — new `addCommand({ id: 'create-snippet', ... })` block
  inserted after the `insert-snippet` command registration. Command `name` is a
  plain English string, matching the convention of every other `addCommand` in
  this file (none use i18n keys for `name`).
- `src/main.ts:285-297` — `handleInsertSnippet()` is the mirrored pattern; the
  new `handleCreateSnippet()` sits alongside it. Key divergences: (a) no
  `getActiveFile()`/`.extension !== 'md'` guard — the command opens the editor
  with an empty template when there is no active md view; (b) pre-fill source is
  `editor.getSelection()` instead of `editor.replaceSelection(rendered)`.
- `src/views/snippet-manager-view.ts:258-267` — `openCreateModal()` is the
  existing create-mode caller; compiles unchanged because `initialTemplate` is
  optional and `emptyMdTemplateDraft`'s 4th param defaults to `''`.
- `src/i18n/locales/en.json` + `src/i18n/locales/ru.json` — `snippetEditor`
  namespace gains `createdNotice` in both locales (i18n rule: keys added to both
  en and ru). Used only by `handleCreateSnippet()`; the modal itself does not
  emit a Notice on plain create (it only emits move/rename notices), so this
  key is owned by this slice.
- This slice does **not** couple to Slices 2–5. Slice 2 (Runner footer) will
  consume the same `initialTemplate` option added here — that is the
  cross-slice contract this slice publishes. Slice 2 builds on
  `SnippetEditorOptions.initialTemplate` exactly as `handleCreateSnippet`
  does, by constructing `new SnippetEditorModal(app, this.plugin, { mode:
  'create', initialFolder, initialTemplate: selection.toString() })`.

## Success Criteria

- [ ] `SnippetEditorOptions` type carries a new optional `initialTemplate?: string`
  field; `tsc` compiles with no new errors.
- [ ] `emptyMdTemplateDraft(folder, locale, cat, 'Hello {{name}}!')` returns a
  draft whose `template === 'Hello {{name}}!'`; with the 4th arg omitted,
  `template === ''` (byte-identical to prior behavior).
- [ ] Constructing `new SnippetEditorModal(app, plugin, { mode: 'create',
  initialFolder, initialTemplate: 'selected text' })` and opening it mounts the
  chip editor textarea pre-filled with `selected text` (verifiable via the chip
  editor's `templateArea.value` at `snippet-chip-editor.ts:125`).
- [ ] Constructing the modal without `initialTemplate` (the existing
  `openCreateModal` path) still mounts with an empty template — no regression.
- [ ] Saving a pre-filled create-mode snippet persists the template text to the
  vault file via `SnippetService.save()` (the `draftToSave` spread at
  `snippet-editor-modal.ts:536-537` carries `template` through).
- [ ] `SnippetManagerView.openCreateModal()` (`snippet-manager-view.ts:258-267`)
  compiles and runs unchanged — no call-site edit required.
- [ ] A `create-snippet` command appears in the Obsidian command palette with
  id `create-snippet` and a human-readable name.
- [ ] Running `create-snippet` with an active `MarkdownView` that has a
  selection opens `SnippetEditorModal` with the template textarea pre-filled
  with that selection.
- [ ] Running `create-snippet` with an active `MarkdownView` but no selection
  opens `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] Running `create-snippet` with no active `MarkdownView` opens
  `SnippetEditorModal` with an empty template (no bail, no Notice).
- [ ] On save, a `Notice` is shown using `snippetEditor.createdNotice` from the
  active locale (en or ru).
- [ ] `npm run build` (type-check + esbuild) passes; `npm test` passes with no
  regressions in existing snippet-editor / chip-editor suites.

## Notes / Deferred

- **No md-guard bail by design.** The slice brief explicitly states pre-fill is
  "empty when no selection or no active md view" — i.e. the command must remain
  usable for authoring snippets from scratch via the palette. This diverges from
  `handleInsertSnippet()`'s `openMarkdownFirst` guard and is intentional, not an
  oversight. If the product later wants to restrict the command to md-only
  contexts, that is a separate decision — not assumed here.
- **Notice key placement.** `createdNotice` is added to the existing
  `snippetEditor` namespace rather than a new `createSnippet` namespace, because
  the modal already owns `movedNotice` / `renamedNotice` /
  `movedAndRenamedNotice` in that namespace and the command's "created" Notice
  is the create-mode counterpart. The key is consumed only by
  `handleCreateSnippet()`; the modal itself does not emit a Notice on plain
  create (only on move/rename), so there is no collision or double-Notice.
- **Selection length cap not enforced here.** A multi-megabyte selection would
  pre-fill a very large textarea; if that ever becomes a problem, a cap belongs
  in a future hardening slice, not in this one — the slice scope is the pre-fill
  plumbing and the command, not input bounding.
- **Orphan-badge behavior on pre-fill is intended.** A pre-filled template
  containing `{{placeholder-id}}` tokens that have no matching placeholder entry
  will surface the existing orphan-badge UI in the chip editor exactly as if
  the user had typed those tokens. That is the desired authoring flow (user
  edits template text, then adds/adjusts placeholders and saves) — no special
  handling added.
- **Slice 2 contract published here.** The `initialTemplate?: string` option on
  `SnippetEditorOptions` is the cross-slice contract Slice 2 (Runner footer
  create-from-selection) depends on. It is decided (not parked): optional
  field, string, empty-when-absent, threaded through `emptyMdTemplateDraft`'s
  4th param. Slice 2 should consume it as fixed.