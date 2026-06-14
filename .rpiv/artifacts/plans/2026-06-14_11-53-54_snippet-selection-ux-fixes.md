---
date: 2026-06-14T11:53:54+0300
author: Roman Shulgha
commit: 33f6ceb
branch: main
repository: RadiProtocol
topic: snippet-selection-ux-fixes
tags:
  - plan
  - ux
  - snippets
  - protocol-editor
status: ready
parent: standalone
phase_count: 2
phases:
  - { n: 1, title: Shared picker row semantics and sizing polish }
  - { n: 2, title: Protocol Editor snippet target redesign }
unresolved_phase_count: 0
last_updated: 2026-06-14T11:53:54+0300
last_updated_by: Roman Shulgha
---

# Snippet Selection UX Fixes Implementation Plan

## Overview

This plan polishes the shared snippet picker surfaces used by Inline Runner and Insert Snippet, then redesigns the Protocol Editor snippet-node target selector. The implementation keeps `SnippetTreePicker` as the single picker component, removes hover-tooltip triggers from snippet file rows while preserving visible labels, fixes sizing/path wrapping through CSS, and replaces the cramped embedded Protocol Editor target picker with compact target controls plus a larger Browse modal.

## Requirements

- Remove hover tooltip behavior when hovering snippet name items in the Inline Runner snippet selection list.
- Remove hover tooltip behavior when hovering snippet name items in the Insert Snippet command selection list.
- Let the Inline Runner snippet list fill the full available modal width at any resize size; avoid fixed-width list constraints and horizontal scrolling.
- Fix the Insert Snippet directory/path display so folder/path names are not clipped, the up-arrow and folder label sit cleanly together, and the display feels polished.
- Redesign Protocol Editor snippet-node settings so target directory/snippet selection is fast, clear, and not dominated by a cramped picker.
- Preserve existing snippet node persistence semantics: folder targets write `subfolderPath`, file targets write `snippetPath`, and only one target is active at a time.

## Current State Analysis

The Inline Runner and Insert Snippet flows both construct `SnippetTreePicker` in `file-only` mode, so shared picker row and CSS fixes cover both selection lists. Protocol Editor snippet-node settings currently embed a `both` mode `SnippetTreePicker` directly inside the node edit modal, then CSS constrains the body/list to a very small height.

### Key Discoveries

- `src/views/snippet-tree-picker.ts:325-383` renders folder/file rows through `createButton`; file rows currently set an `aria-label` on the button even though the visible row title already names the snippet.
- `src/runner/render/render-snippet-picker.ts:76-92` creates the Inline Runner picker host using `CSS_CLASS.STP_INLINE_HOST`, then mounts `SnippetTreePicker` in `file-only` mode.
- `src/views/insert-snippet-modal.ts:31-42` mounts the Insert Snippet command picker in `file-only` mode inside `.rp-insert-snippet-picker-host`.
- `src/styles/snippet-tree-picker.css:45-104` controls breadcrumb/up-button/crumb layout; `.rp-stp-crumb` currently caps path segments to `max-width: 120px` with ellipsis.
- `src/styles/inline-runner.css:220-226` gives `.rp-stp-inline-host` width but does not force all nested picker/list boxes to opt out of intrinsic min-width behavior.
- `src/views/protocol-editor-view.ts:2187-2243` stores snippet target state correctly but displays two read-only inputs plus an always-mounted picker.
- `src/styles/protocol-editor.css:422-433` caps the embedded Protocol Editor picker body/list to `160px`/`112px`, causing the cramped scrolling reported by the user.
- `src/views/snippet-manager-view.ts:442-496` demonstrates the existing modal-hosted `SnippetTreePicker` pattern used for move-target browsing.

## Desired End State

From the user's perspective:

```text
Inline Runner → snippet pick state
- The picker list expands to the resized modal width.
- Snippet rows show their visible file names but do not open hover tips.
- Long snippet names wrap/clip gracefully without horizontal scrolling.

Insert Snippet command
- The same picker row behavior applies.
- Drilled folder paths wrap cleanly next to the up-arrow instead of being clipped in a small rectangle.

Protocol Editor → double-click snippet node → Edit Node
- Snippet target is a compact summary: “Folder: abdomen/ct” or “Snippet: abdomen/ct/report.md”.
- Browse opens a larger picker modal for choosing a folder or snippet.
- Clear removes the target.
- Save persists exactly one of `subfolderPath` or `snippetPath`.
```

## What We're NOT Doing

- Not changing snippet model, snippet storage, parser, graph validation, or runner traversal semantics.
- Not introducing a new picker component; all selection continues through `SnippetTreePicker`.
- Not changing snippet fill-in or placeholder behavior after selection.
- Not rewriting Protocol Editor modals into Obsidian `Modal` subclasses beyond the targeted Browse picker opened from the existing custom node edit modal.
- Not changing the Snippet Manager move picker except through shared CSS improvements.

## Decisions

### Decision 1: Shared picker remains the selection surface

Use the existing `SnippetTreePicker` for Inline Runner and Insert Snippet because both flows already mount it in `file-only` mode (`src/runner/render/render-snippet-picker.ts:76-92`, `src/views/insert-snippet-modal.ts:31-42`). This avoids divergent behavior and fixes both user-reported selection lists from one row/CSS change.

### Decision 2: Snippet rows should not use hover-tooltip attributes

Snippet file rows already contain visible glyph + title text (`src/views/snippet-tree-picker.ts:357-383`), so the plan removes row-level tooltip-triggering attributes from file rows instead of replacing them with another tooltip mechanism. Folder rows can retain navigational accessible labels; the specific complaint targets snippet name items.

### Decision 3: Width/path polish belongs in shared CSS plus host hooks

The fixed-width/horizontal-scroll and Insert path clipping issues are layout problems in shared picker containers and breadcrumb/row CSS (`src/styles/snippet-tree-picker.css:45-164`, `src/styles/inline-runner.css:220-226`). The plan strengthens `width: 100%`, `min-width: 0`, and wrapping rules at shared and host levels rather than forking picker DOM per caller.

### Decision 4: Protocol Editor target selection uses a compact summary plus Browse modal

Ambiguity: current Protocol Editor snippet target UI embeds the picker directly in the node edit modal (`src/views/protocol-editor-view.ts:2187-2243`), while an existing larger modal-hosted picker pattern exists in Snippet Manager (`src/views/snippet-manager-view.ts:442-496`).

Explored:
- Option A — wide embedded picker: preserves single-modal flow but still spends much of the edit modal on navigation.
- Option B — separate Browse modal: keeps node settings compact and gives navigation a large focused surface.

Decision: implement Option B per developer checkpoint. The node settings modal shows summary + Browse/Clear controls; Browse opens a `both` mode `SnippetTreePicker` modal and reuses the existing selection state semantics.

## Phase 1: Shared picker row semantics and sizing polish

### Overview

Foundation phase; can run first and has no dependency on Phase 2. It fixes shared picker row tooltip triggers, width behavior, and path wrapping for Inline Runner and Insert Snippet.

### Changes Required:

#### 1. src/views/snippet-tree-picker.ts:375-378

**File**: src/views/snippet-tree-picker.ts
**Changes**: MODIFY — remove file-row tooltip-triggering attributes while keeping visible row text as the accessible button name

```ts
const row = createButton(listEl, { cls: 'rp-stp-file-row' });
```

#### 2. src/styles/snippet-tree-picker.css:6-164

**File**: src/styles/snippet-tree-picker.css
**Changes**: MODIFY — strengthen shared picker width/min-width rules and make breadcrumb/path text wrap instead of clipping

```css
.rp-stp-root {
  /* display/flex/gap migrated to .rp-stack-lg utility (Phase 80) */
  gap: var(--size-2-3);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.rp-stp-body {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-3);
  min-height: 280px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.rp-stp-search {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.rp-stp-breadcrumb {
  display: flex;
  align-items: flex-start;
  gap: var(--size-2-1);
  width: 100%;
  min-width: 0;
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  flex-wrap: wrap;
  line-height: 1.3;
}

.rp-stp-crumb,
.rp-stp-up-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  height: auto;
  min-width: 0;
  padding: 0 var(--size-2-2);
  border: 1px solid transparent;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  line-height: 1.3;
  box-shadow: none;
  box-sizing: border-box;
}

.rp-stp-up-btn {
  flex: 0 0 auto;
  align-self: flex-start;
  width: 24px;
  padding: 0;
}

.rp-stp-crumb {
  max-width: 100%;
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  text-align: left;
  justify-content: flex-start;
}

.rp-stp-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  min-width: 0;
  max-height: 320px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

.rp-stp-folder-row,
.rp-stp-file-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: var(--size-2-2) var(--size-2-3);
  text-align: left;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 30px;
  box-sizing: border-box;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-s);
}

.rp-stp-row-title {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-stp-result-path {
  width: 100%;
  min-width: 0;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  line-height: 1.3;
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.rp-stp-inline-host,
.rp-stp-modal-host,
.rp-insert-snippet-picker-host {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
```

#### 3. src/styles/inline-runner.css:220-226

**File**: src/styles/inline-runner.css
**Changes**: MODIFY — ensure the inline picker host and nested picker boxes fill resized modal width without intrinsic horizontal overflow

```css
.rp-stp-inline-host {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.rp-stp-inline-host .rp-stp-root,
.rp-stp-inline-host .rp-stp-body,
.rp-stp-inline-host .rp-stp-search,
.rp-stp-inline-host .rp-stp-list {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.rp-stp-inline-host .rp-stp-body {
  min-height: 0;
  height: auto;
}

.rp-stp-inline-host .rp-stp-list {
  overflow-x: hidden;
}
```

#### 4. src/__tests__/views/snippet-tree-picker.test.ts

**File**: src/__tests__/views/snippet-tree-picker.test.ts
**Changes**: MODIFY — add regression coverage that snippet file rows do not carry native/Obsidian tooltip-triggering attributes

```ts
  it('file rows do not carry tooltip-triggering title or aria-label attributes', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const fileRow = findByClass(container, 'rp-stp-file-row')[0];
    expect(fileRow?.getAttribute('title')).toBeNull();
    expect(fileRow?.getAttribute('aria-label')).toBeNull();
  });
```

### Success Criteria:

#### Automated Verification:
- [x] SnippetTreePicker regression passes: `npm test -- src/__tests__/views/snippet-tree-picker.test.ts`
- [x] No snippet file row tooltip attributes remain: `rg "rp-stp-file-row', attr|rp-stp-file-row\", attr|setAttr\(['\"]title|title:" src/views/snippet-tree-picker.ts` returns no matches for file-row tooltip attributes

#### Manual Verification:
- [ ] In Insert Snippet, hover file rows and confirm no hover tip appears over snippet names.
- [ ] In Inline Runner awaiting-snippet-pick, resize the modal wider and confirm the picker/list fills the available width without horizontal scrolling.
- [ ] In Insert Snippet, drill into a long nested folder name and confirm the up arrow and folder/path text wrap cleanly without clipping.

## Phase 2: Protocol Editor snippet target redesign

### Overview

Depends on Phase 1 for shared picker sizing/path behavior. It replaces the cramped embedded snippet target picker with compact target controls and a modal-hosted Browse picker.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts:1-2243

**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — import `Modal`, replace embedded target picker UI with summary/Browse/Clear controls, and open a large both-mode picker modal

```ts
import { ItemView, Modal, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
```

```ts
    const addSnippetTargetPicker = (folderValue: unknown, fileValue: unknown) => {
      let selectedFolder = normalizeProtocolEditorSnippetFolderSelection(typeof folderValue === 'string' ? folderValue : '');
      let selectedFile = normalizeProtocolEditorSnippetFolderSelection(typeof fileValue === 'string' ? fileValue : '');
      if (selectedFile !== undefined) selectedFolder = undefined;
      type SelectedSnippetTarget = { kind: 'folder' | 'file'; path: string } | null;

      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-snippet-target-field' });
      field.createEl('label', { text: t('protocolEditor.snippetTargetLabel') });

      const summary = field.createDiv({ cls: 'rp-protocol-editor-snippet-target-summary' });
      const summaryKind = summary.createSpan({ cls: 'rp-protocol-editor-snippet-target-kind' });
      const summaryPath = summary.createSpan({ cls: 'rp-protocol-editor-snippet-target-path' });

      const actions = field.createDiv({ cls: 'rp-protocol-editor-snippet-target-actions' });
      const browseBtn = actions.createEl('button', {
        cls: 'rp-protocol-editor-modal-btn',
        text: t('protocolEditor.browseSnippetTarget'),
        attr: { type: 'button' },
      });
      const clearBtn = actions.createEl('button', {
        cls: 'rp-protocol-editor-modal-btn',
        text: t('protocolEditor.clearSnippetTarget'),
        attr: { type: 'button' },
      });

      const currentTarget = (): SelectedSnippetTarget => {
        if (selectedFile !== undefined) return { kind: 'file', path: selectedFile };
        if (selectedFolder !== undefined) return { kind: 'folder', path: selectedFolder };
        return null;
      };

      const renderSummary = () => {
        const target = currentTarget();
        clearBtn.toggle(target !== null);
        if (target === null) {
          summaryKind.setText(t('protocolEditor.noSnippetTarget'));
          summaryPath.setText(t('protocolEditor.snippetTargetHelp'));
          summary.toggleClass('is-empty', true);
          return;
        }
        summaryKind.setText(target.kind === 'folder'
          ? t('protocolEditor.snippetFolderTarget')
          : t('protocolEditor.snippetFileTarget'));
        summaryPath.setText(target.path);
        summary.toggleClass('is-empty', false);
      };

      const applySelection = (result: SnippetTreePickerResult) => {
        const normalized = normalizeProtocolEditorSnippetFolderSelection(result.relativePath);
        if (result.kind === 'folder') {
          selectedFolder = normalized;
          selectedFile = undefined;
        } else {
          selectedFile = normalized;
          selectedFolder = undefined;
        }
        renderSummary();
      };

      const openBrowseModal = () => {
        const pickerModal = new Modal(this.app);
        pickerModal.setTitle(t('protocolEditor.browseSnippetTargetTitle'));
        let picker: SnippetTreePicker | null = null;

        pickerModal.onOpen = () => {
          pickerModal.contentEl.empty();
          pickerModal.contentEl.createDiv({
            cls: 'rp-protocol-editor-snippet-target-picker-help',
            text: t('protocolEditor.snippetTargetHelp'),
          });
          const pickerHost = pickerModal.contentEl.createDiv({
            cls: 'rp-stp-modal-host rp-protocol-editor-snippet-target-picker-modal',
          });
          picker = new SnippetTreePicker({
            app: this.app,
            snippetService: this.plugin.snippetService,
            container: pickerHost,
            mode: 'both',
            rootPath: this.plugin.settings.snippetFolderPath,
            initialSelection: selectedFile ?? selectedFolder,
            t,
            onSelect: (result) => {
              applySelection(result);
              pickerModal.close();
            },
          });
          void picker.mount();
        };

        pickerModal.onClose = () => {
          if (picker !== null) {
            picker.unmount();
            picker = null;
          }
          pickerModal.contentEl.empty();
        };

        pickerModal.open();
      };

      browseBtn.addEventListener('click', openBrowseModal);
      clearBtn.addEventListener('click', () => {
        selectedFolder = undefined;
        selectedFile = undefined;
        renderSummary();
      });

      renderSummary();
      textControls.push({ key: 'subfolderPath', value: () => selectedFolder });
      textControls.push({ key: 'snippetPath', value: () => selectedFile });
    };
```

#### 2. src/styles/protocol-editor.css:422-433

**File**: src/styles/protocol-editor.css
**Changes**: MODIFY — replace cramped embedded picker overrides with compact target summary/control styling and Browse modal host sizing

```css
.rp-protocol-editor-snippet-target-field {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-2);
  margin-bottom: var(--size-4-3);
}

.rp-protocol-editor-snippet-target-field > label {
  margin-bottom: 0;
}

.rp-protocol-editor-snippet-target-summary {
  display: flex;
  align-items: flex-start;
  gap: var(--size-2-2);
  min-width: 0;
  padding: var(--size-2-3) var(--size-4-2);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: var(--background-secondary);
  line-height: 1.35;
}

.rp-protocol-editor-snippet-target-summary.is-empty {
  color: var(--text-muted);
}

.rp-protocol-editor-snippet-target-kind {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rp-protocol-editor-snippet-target-path {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-normal);
  font-family: var(--font-monospace);
  font-size: var(--font-ui-smaller);
  overflow-wrap: anywhere;
}

.rp-protocol-editor-snippet-target-summary.is-empty .rp-protocol-editor-snippet-target-path {
  color: var(--text-muted);
  font-family: var(--font-interface);
}

.rp-protocol-editor-snippet-target-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-2-2);
}

.rp-protocol-editor-snippet-target-picker-help {
  margin-bottom: var(--size-4-2);
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  line-height: 1.4;
}

.rp-protocol-editor-snippet-target-picker-modal {
  min-width: min(520px, 100%);
}

.rp-protocol-editor-snippet-target-picker-modal .rp-stp-list {
  min-height: 280px;
  max-height: min(52vh, 520px);
}
```

#### 3. src/i18n/locales/en.json

**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add Protocol Editor strings for target summary and Browse modal controls

```json
    "browseSnippetTarget": "Browse…",
    "browseSnippetTargetTitle": "Choose snippet target",
    "noSnippetTarget": "No target selected",
    "snippetFolderTarget": "Folder",
    "snippetFileTarget": "Snippet",
    "snippetTargetHelp": "Choose a folder to ask for a snippet during the run, or choose a snippet file directly.",
```

#### 4. src/i18n/locales/ru.json

**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add Russian Protocol Editor strings matching the English target summary and Browse controls

```json
    "browseSnippetTarget": "Выбрать…",
    "browseSnippetTargetTitle": "Выбрать цель сниппета",
    "noSnippetTarget": "Цель не выбрана",
    "snippetFolderTarget": "Папка",
    "snippetFileTarget": "Сниппет",
    "snippetTargetHelp": "Выберите папку, чтобы при запуске выбрать сниппет из неё, или выберите конкретный файл сниппета.",
```

#### 5. src/__tests__/views/protocol-editor-save-node-geometry.test.ts:13

**File**: src/__tests__/views/protocol-editor-save-node-geometry.test.ts
**Changes**: MODIFY — add a local Obsidian `Modal` stub so the new ProtocolEditorView import resolves in this suite

```ts
  Modal: class {
    contentEl = { empty(): void {} };
    setTitle(_title: string): void {}
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  },
```

#### 6. src/__tests__/views/protocol-editor-keyboard.test.ts:197

**File**: src/__tests__/views/protocol-editor-keyboard.test.ts
**Changes**: MODIFY — add a local Obsidian `Modal` stub backed by the suite's `MockEl` helper

```ts
  Modal: class {
    contentEl = makeEl('div');
    title = '';
    setTitle(title: string): void { this.title = title; }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  },
```

#### 7. src/__tests__/views/protocol-editor-deletion.test.ts:172

**File**: src/__tests__/views/protocol-editor-deletion.test.ts
**Changes**: MODIFY — add a local Obsidian `Modal` stub backed by the suite's `MockEl` helper

```ts
    Modal: class {
      contentEl = makeEl('div');
      title = '';
      setTitle(title: string): void { this.title = title; }
      open(): void { this.onOpen(); }
      close(): void { this.onClose(); }
      onOpen(): void {}
      onClose(): void {}
    },
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript build passes with the new `Modal` import and Browse modal code: `npm run build`
- [x] Full test suite passes: `npm test -- --runInBand` if supported by the current Vitest version; otherwise run `npm test`
- [x] English and Russian Protocol Editor target strings are present: `rg "browseSnippetTarget|browseSnippetTargetTitle|noSnippetTarget|snippetFolderTarget|snippetFileTarget|snippetTargetHelp" src/i18n/locales/en.json src/i18n/locales/ru.json`
- [x] Protocol Editor code still writes mutually-exclusive target fields: `rg "textControls.push\(\{ key: 'subfolderPath'|textControls.push\(\{ key: 'snippetPath'|selectedFile = undefined|selectedFolder = undefined" src/views/protocol-editor-view.ts`

#### Manual Verification:
- [ ] Open a snippet node in Protocol Editor and confirm the edit modal shows a compact target summary plus Browse and Clear controls, not an embedded cramped tree.
- [ ] Click Browse, select a folder, save the node, and confirm the protocol JSON contains `subfolderPath` and not `snippetPath` for that node.
- [ ] Click Browse, select a snippet file, save the node, and confirm the protocol JSON contains `snippetPath` and not `subfolderPath` for that node.
- [ ] Click Clear, save the node, and confirm both `subfolderPath` and `snippetPath` are removed.
- [ ] Confirm the Browse modal is large enough to navigate without the previous 112px list-height constraint.

## Ordering Constraints

- Phase 1 must run before Phase 2 because Phase 2's Browse modal reuses `SnippetTreePicker` and benefits from the shared path/list sizing fixes.
- The two phases are sequential; no phase should edit the same code fence from an earlier phase.

## Verification Notes

- Verify no snippet file row in `SnippetTreePicker` sets `title` or `aria-label` after Phase 1; visible row text remains available for screen readers.
- Verify Inline Runner awaiting-snippet-pick host still uses `.rp-stp-inline-host` and full-width list styling.
- Verify Insert Snippet drilled breadcrumb/path display wraps long folder names without clipping.
- Verify Protocol Editor snippet target save semantics: folder selection persists `subfolderPath` only; file selection persists `snippetPath` only; Clear removes both.
- Verify i18n additions exist in both English and Russian locale files.
- Run `npm test -- --runInBand` if supported by the current Vitest version, otherwise run `npm test`.
- Run `npm run build` before considering the implementation complete.

## Performance Considerations

- The changes do not add new vault scans. `SnippetTreePicker` continues to use `listFolder()` for drill views and `listFolderDescendants()` only for search.
- Protocol Editor no longer mounts the snippet picker immediately for every snippet-node edit; it mounts only when Browse is clicked, reducing initial modal DOM work.
- CSS wrapping rules avoid horizontal overflow without adding layout observers or resize handlers.

## Migration Notes

No data migration is required. Existing protocol documents continue to use the same `subfolderPath` and `snippetPath` fields.

## Pattern References

- `src/views/snippet-tree-picker.ts:325-383` — shared folder/file row rendering to modify and test.
- `src/runner/render/render-snippet-picker.ts:76-92` — Inline Runner picker host wiring to preserve.
- `src/views/insert-snippet-modal.ts:31-42` — Insert Snippet picker host wiring to preserve.
- `src/views/snippet-manager-view.ts:442-496` — modal-hosted `SnippetTreePicker` lifecycle pattern to model for Browse.
- `src/styles/snippet-tree-picker.css:195-201` — existing modal host sizing rules.
- `src/__tests__/views/snippet-tree-picker.test.ts:306-405` — picker row behavior test patterns.

## Developer Context

- Question: "Found two viable layouts for the Protocol Editor snippet-node target UI. Current modal embeds the picker directly in the node edit form at `src/views/protocol-editor-view.ts:2187-2243`, but CSS caps it to `max-height: 160px` / list `112px` at `src/styles/protocol-editor.css:422-433`. Existing larger picker pattern opens a modal-hosted `SnippetTreePicker` at `src/views/snippet-manager-view.ts:442-496` with `.rp-stp-modal-host` sizing at `src/styles/snippet-tree-picker.css:195-201`. Which should the plan implement?" Answer: Separate browse modal.
- Design confirmation: Proceed with shared picker fixes plus compact Protocol Editor target summary and separate Browse modal.
- Decomposition confirmation: Approved 2 slices: shared picker row/sizing polish, then Protocol Editor target redesign.
- Slice 1 micro-checkpoint: Approved shared picker row semantics and sizing polish after verifier returned Decisions OK / Cross-slice OK / Research OK.
- Slice 2 micro-checkpoint: Approved Protocol Editor compact target summary + Browse modal after verifier returned Decisions OK / Cross-slice OK / Research OK.
- Step 9 review triage: Applied all 7 reviewer findings — added three Modal test mock stubs, added full-suite test success criterion, normalized initial target state, and trimmed duplicate locale keys.

## Plan History

- Phase 1: Shared picker row semantics and sizing polish — approved as generated
- Phase 2: Protocol Editor snippet target redesign — approved as generated; revised at Step 9 to add Modal test mock stubs, normalize initial target state, add full-suite test criterion, and trim duplicate locale key snippets

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 2 §1 (protocol-editor-view.ts) | src/__tests__/views/protocol-editor-save-node-geometry.test.ts:13 | blocker | actionability | Phase 2 imports `Modal` from `obsidian`, but this test's local `vi.mock('obsidian')` does not export `Modal`, so Vitest will fail importing `ProtocolEditorView`. | Add a `Modal` stub to this mock before Phase 2 lands. | applied: added Phase 2 test mock subsection for `protocol-editor-save-node-geometry.test.ts` Modal stub. |
| code | Phase 2 §1 (protocol-editor-view.ts) | src/__tests__/views/protocol-editor-keyboard.test.ts:197 | blocker | actionability | Phase 2 imports `Modal` from `obsidian`, but this test's local `vi.mock('obsidian')` does not export `Modal`, so Vitest will fail importing `ProtocolEditorView`. | Add a `Modal` stub to this mock before Phase 2 lands. | applied: added Phase 2 test mock subsection for `protocol-editor-keyboard.test.ts` Modal stub. |
| code | Phase 2 §1 (protocol-editor-view.ts) | src/__tests__/views/protocol-editor-deletion.test.ts:172 | blocker | actionability | Phase 2 imports `Modal` from `obsidian`, but this test's local `vi.mock('obsidian')` does not export `Modal`, so Vitest will fail importing `ProtocolEditorView`. | Add a `Modal` stub to this mock before Phase 2 lands. | applied: added Phase 2 test mock subsection for `protocol-editor-deletion.test.ts` Modal stub. |
| coverage | ## Verification Notes §6 | <n/a> | blocker | verification-coverage | Note "Run `npm test -- --runInBand` if supported by the current Vitest version, otherwise run `npm test`." — criteria NOT FOUND, code NOT FOUND | Add a full-suite test command bullet under Phase 2's `#### Automated Verification:` for `npm test -- --runInBand` if supported, otherwise `npm test` | applied: added Phase 2 full-suite test success criterion. |
| code | Phase 2 §1 (protocol-editor-view.ts) | src/views/protocol-editor-view.ts:2188-2243 | concern | code-quality | Phase 2 displays the file target when both persisted fields exist but never clears `selectedFolder` during initialization, so Save can re-write both `subfolderPath` and `snippetPath`. | After initialization, normalize to one active target by clearing `selectedFolder` when `selectedFile` is defined. | applied: Phase 2 now clears `selectedFolder` when initial `selectedFile` is defined. |
| code | Phase 2 §3 (en.json) | src/i18n/locales/en.json:81-83 | suggestion | codebase-fit | Phase 2 says to add `snippetFolderPlaceholder`, `snippetFilePlaceholder`, and `clearSnippetTarget`, but those locale keys already exist. | Add only the new Protocol Editor locale keys in this phase. | applied: trimmed en.json code fence to only new target summary/Browse keys. |
| code | Phase 2 §4 (ru.json) | src/i18n/locales/ru.json:81-83 | suggestion | codebase-fit | Phase 2 says to add `snippetFolderPlaceholder`, `snippetFilePlaceholder`, and `clearSnippetTarget`, but those locale keys already exist. | Add only the new Protocol Editor locale keys in this phase. | applied: trimmed ru.json code fence to only new target summary/Browse keys. |

## References

- Standalone blueprint input from 2026-06-14T11:53:54+0300.
- Branch `main` at commit `33f6ceb`.
