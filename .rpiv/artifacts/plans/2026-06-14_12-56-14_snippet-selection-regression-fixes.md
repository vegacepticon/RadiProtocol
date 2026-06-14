---
date: 2026-06-14T12:56:14+0300
author: Roman Shulgha
commit: 0d9ac36
branch: main
repository: RadiProtocol
topic: snippet-selection-regression-fixes
tags:
  - plan
  - ux
  - snippets
  - protocol-editor
  - inline-runner
status: ready
parent: standalone
phase_count: 3
phases:
  - { n: 1, title: Parent-owned Protocol Editor target picker }
  - { n: 2, title: Shared directory tooltip removal }
  - { n: 3, title: Inline Runner picker resize chain }
unresolved_phase_count: 0
last_updated: 2026-06-14T12:56:14+0300
last_updated_by: Roman Shulgha
---

# Snippet Selection Regression Fixes Implementation Plan

## Overview

This plan fixes regressions left after the Snippet node settings layout update. The chosen approach keeps `SnippetTreePicker` as the single picker component, but changes the Protocol Editor target browse flow so the picker is owned by the currently open node-settings modal instead of being an unrelated Obsidian `Modal` layered behind a custom Protocol Editor modal.

The shared picker row and CSS fixes are intentionally narrow: directory rows stop exposing hover-tooltip-triggering attributes just like file rows, and the Inline Runner picker becomes a true flex child of the resizable inline modal rather than being capped by fixed body/list heights.

## Requirements

- Snippet target picker opened from Snippet node settings renders above the settings modal and remains interactive.
- Selecting a directory updates `subfolderPath`, clears `snippetPath`, updates the visible target summary, and saves when the node settings are confirmed.
- Selecting a `.md` snippet file updates `snippetPath`, clears `subfolderPath`, updates the visible target summary, and saves when the node settings are confirmed.
- Cancelling the picker leaves the existing target unchanged.
- Closing the parent settings modal while the picker is open closes/unmounts the picker and leaves no orphaned modal.
- `Escape` closes the topmost picker first, then the parent modal; focus returns to Browse/Select after picker close when possible.
- Directory hover in Insert Snippet and Inline Runner snippet pickers must not show native `title`, Obsidian `aria-label` hover hints, or equivalent tooltip hints.
- Existing `.md` file no-tooltip behavior must remain unchanged.
- Inline Runner snippet list grows and shrinks with vertical modal resizing, and the list scrolls internally for long lists.

## Current State Analysis

The Snippet node settings modal is custom DOM, not an Obsidian `Modal`: it creates `.rp-protocol-editor-modal-backdrop` on `document.body` (`src/views/protocol-editor-view.ts:2131`) and removes that element in a local `closeModal` closure (`src/views/protocol-editor-view.ts:2137`). The new Browse flow opens a separate Obsidian `Modal` from inside that custom modal (`src/views/protocol-editor-view.ts:2246`), so the picker is not owned by the parent modal lifecycle and can be visually/behaviorally stacked behind it.

Shared picker file rows already avoid tooltip-triggering row attributes (`src/views/snippet-tree-picker.ts:375`), but folder rows still set a row-level `aria-label` (`src/views/snippet-tree-picker.ts:330`). In file-only flows, directories are still rendered for navigation, so Insert Snippet and Inline Runner can still display hover hints on directories even after file rows were fixed.

Inline Runner has a resizable outer shell and flexible content zone (`src/styles/inline-runner.css:86`, `src/styles/inline-runner.css:107`), but shared picker CSS still gives `.rp-stp-inline-host .rp-stp-body` a fixed `height: 360px` (`src/styles/snippet-tree-picker.css:26`) and `.rp-stp-list` a `max-height: 320px` (`src/styles/snippet-tree-picker.css:135`). Those caps prevent the list from using newly available vertical space.

### Key Discoveries

- `src/views/protocol-editor-view.ts:2187-2296` already stores selected folder/file state correctly and exposes it through `textControls` for save.
- `src/views/protocol-editor-view.ts:2234-2244` enforces mutual exclusivity between folder and file selections.
- `src/views/protocol-editor-view.ts:2246-2284` creates the picker in a separate Obsidian `Modal`; its `onClose` unmounts the picker, but the parent custom modal never closes it.
- `src/views/snippet-manager-view.ts:453-494` and `src/views/insert-snippet-modal.ts:32-50` show the established pattern: the modal/host that opens the picker owns the picker instance and unmounts it on close.
- `src/views/snippet-tree-picker.ts:330-354` renders folder rows with an `aria-label` even though visible row text already supplies the name.
- `src/views/snippet-tree-picker.ts:375-389` renders file rows without `title` or `aria-label`; tests already assert this behavior.
- `src/runner/render/render-snippet-picker.ts:80-121` mounts Inline Runner's picker in `.rp-stp-inline-host` and delegates lifecycle to `InlineRunnerModal`.
- `src/views/inline-runner-modal.ts:407-423` puts snippet-pick state in `rp-state-content-only`, making `.rp-inline-runner-content` the relevant vertical flex parent.
- `src/styles/snippet-tree-picker.css:26-29`, `src/styles/snippet-tree-picker.css:135`, and `src/styles/snippet-tree-picker.css:236-239` are the restrictive fixed-height/max-height rules.

## Desired End State

```text
Protocol Editor → edit Snippet node → Browse
1. Parent settings modal remains open.
2. Parent-owned picker overlay opens above it.
3. Directory selection changes summary to “Folder: abdomen/ct”.
4. File selection changes summary to “Snippet: abdomen/ct/report.md”.
5. Save persists exactly one of subfolderPath/snippetPath.
6. Cancel/Escape/parent close unmount the picker without stale callbacks.
```

```text
Insert Snippet / Inline Runner picker
- File rows and folder rows have no title/aria-label hover-tooltip triggers.
- Visible row text remains the accessible button name.
```

```text
Inline Runner vertical resize
- Header/footer stay fixed.
- Content-only snippet-pick area consumes remaining height.
- SnippetTreePicker root/body/list form a min-height:0 flex column.
- The list grows and shrinks with the modal and scrolls internally.
```

## What We're NOT Doing

- Not changing protocol document schema, parser, graph model, runner state machine, or snippet persistence semantics.
- Not adding a second picker implementation; `SnippetTreePicker` remains the shared selection component.
- Not converting all Protocol Editor custom modals into Obsidian `Modal` subclasses.
- Not changing snippet fill-in behavior after selection.
- Not changing Snippet Manager move picker except where shared picker CSS continues to apply.
- Not relying on a standalone z-index tweak without fixing ownership, cleanup, and callbacks.

## Decisions

### Decision 1: Parent-owned Protocol Editor picker overlay

The parent settings modal is custom DOM (`src/views/protocol-editor-view.ts:2131`), while the current picker is an unrelated Obsidian `Modal` (`src/views/protocol-editor-view.ts:2247`). The plan replaces that nested Obsidian modal with a custom picker overlay owned by the parent `openEditModal` closure. This makes parent close, picker close, `Escape`, unmounting, and focus restoration deterministic.

### Decision 2: Preserve existing target state semantics

Folder and file selection already use local state and mutually clear one another (`src/views/protocol-editor-view.ts:2234-2244`), and saving reads `subfolderPath`/`snippetPath` from `textControls` (`src/views/protocol-editor-view.ts:2295-2296`, `src/views/protocol-editor-view.ts:2347-2353`). The plan keeps this shape and changes only the picker host/lifecycle around it.

### Decision 3: Directory no-tooltip behavior mirrors file rows

File rows intentionally omit row-level `title` and `aria-label` (`src/views/snippet-tree-picker.ts:375`), and a regression test asserts that (`src/__tests__/views/snippet-tree-picker.test.ts:1058`). Directory rows should match the same no-hover-hint behavior by removing their row-level `aria-label` (`src/views/snippet-tree-picker.ts:330`) while keeping visible text as the button label.

### Decision 4: Inline resize fix is CSS structural, not stateful

Inline Runner already has resize handling and a flexible content region (`src/styles/inline-runner.css:86-112`). The regression is caused by fixed picker body/list caps in shared picker CSS (`src/styles/snippet-tree-picker.css:26-29`, `src/styles/snippet-tree-picker.css:135`). The plan removes/overrides only those caps for inline hosts and strengthens the flex/min-height chain.

## Phase 1: Parent-owned Protocol Editor target picker

### Overview

Foundation phase; no dependencies. It makes the Snippet node target picker a child lifecycle of the currently open Protocol Editor node-settings modal and adds focused regression coverage for selection, cancellation, parent close, and focus/lifecycle cleanup.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts:1,2127-2296

**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — replace nested Obsidian Modal target picker with parent-owned custom overlay and cleanup hooks

```diff
diff --git a/src/views/protocol-editor-view.ts b/src/views/protocol-editor-view.ts
--- a/src/views/protocol-editor-view.ts
+++ b/src/views/protocol-editor-view.ts
@@
-import { ItemView, Modal, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
+import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
@@
-    const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕', attr: { 'aria-label': t('protocolEditor.close') } });
-    const closeModal = () => {
-      modalEl.remove();
-      this.restoreEditorFocus();
-    };
+    const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕', attr: { 'aria-label': t('protocolEditor.close') } });
+    let closeActiveSnippetTargetPicker: (() => void) | null = null;
+    const closeModal = () => {
+      if (closeActiveSnippetTargetPicker !== null) {
+        closeActiveSnippetTargetPicker();
+        closeActiveSnippetTargetPicker = null;
+      }
+      modalEl.remove();
+      this.restoreEditorFocus();
+    };
+    modalEl.setAttr('tabindex', '-1');
+    modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
+      if (e.key !== 'Escape') return;
+      e.preventDefault();
+      e.stopPropagation();
+      if (closeActiveSnippetTargetPicker !== null) {
+        closeActiveSnippetTargetPicker();
+        return;
+      }
+      closeModal();
+    });
     closeBtn.addEventListener('click', closeModal);
@@
-      const openBrowseModal = () => {
-        const pickerModal = new Modal(this.app);
-        pickerModal.setTitle(t('protocolEditor.browseSnippetTargetTitle'));
-        let picker: SnippetTreePicker | null = null;
-
-        pickerModal.onOpen = () => {
-          pickerModal.contentEl.empty();
-          pickerModal.contentEl.createDiv({
-            cls: 'rp-protocol-editor-snippet-target-picker-help',
-            text: t('protocolEditor.snippetTargetHelp'),
-          });
-          const pickerHost = pickerModal.contentEl.createDiv({
-            cls: 'rp-stp-modal-host rp-protocol-editor-snippet-target-picker-modal',
-          });
-          picker = new SnippetTreePicker({
-            app: this.app,
-            snippetService: this.plugin.snippetService,
-            container: pickerHost,
-            mode: 'both',
-            rootPath: this.plugin.settings.snippetFolderPath,
-            initialSelection: selectedFile ?? selectedFolder,
-            t,
-            onSelect: (result) => {
-              applySelection(result);
-              pickerModal.close();
-            },
-          });
-          void picker.mount();
-        };
-
-        pickerModal.onClose = () => {
-          if (picker !== null) {
-            picker.unmount();
-            picker = null;
-          }
-          pickerModal.contentEl.empty();
-        };
-
-        pickerModal.open();
-      };
+      const openBrowseModal = () => {
+        if (closeActiveSnippetTargetPicker !== null) return;
+
+        const pickerBackdrop = document.body.createDiv({
+          cls: 'rp-protocol-editor-modal-backdrop rp-protocol-editor-snippet-target-picker-backdrop',
+        });
+        pickerBackdrop.setAttr('tabindex', '-1');
+
+        const pickerShell = pickerBackdrop.createDiv({ cls: 'rp-protocol-editor-modal rp-protocol-editor-snippet-target-picker-shell' });
+        const pickerHeader = pickerShell.createDiv({ cls: 'rp-protocol-editor-modal-header' });
+        pickerHeader.createEl('h3', { text: t('protocolEditor.browseSnippetTargetTitle') });
+        const pickerCloseBtn = pickerHeader.createEl('button', {
+          cls: 'rp-protocol-editor-modal-close',
+          text: '✕',
+          attr: { 'aria-label': t('protocolEditor.close') },
+        });
+
+        const pickerBody = pickerShell.createDiv({ cls: 'rp-protocol-editor-modal-body rp-protocol-editor-snippet-target-picker-body' });
+        pickerBody.createDiv({ cls: 'rp-protocol-editor-snippet-target-picker-help', text: t('protocolEditor.snippetTargetHelp') });
+        const pickerHost = pickerBody.createDiv({ cls: 'rp-stp-modal-host rp-protocol-editor-snippet-target-picker-modal' });
+
+        let picker: SnippetTreePicker | null = null;
+        let closed = false;
+        const closePicker = (options?: { restoreFocus?: boolean }) => {
+          if (closed) return;
+          closed = true;
+          if (picker !== null) {
+            picker.unmount();
+            picker = null;
+          }
+          pickerBackdrop.remove();
+          if (closeActiveSnippetTargetPicker === closePicker) closeActiveSnippetTargetPicker = null;
+          if (options?.restoreFocus === false) return;
+          window.requestAnimationFrame(() => {
+            if (browseBtn.isConnected) browseBtn.focus({ preventScroll: true });
+          });
+        };
+
+        picker = new SnippetTreePicker({
+          app: this.app,
+          snippetService: this.plugin.snippetService,
+          container: pickerHost,
+          mode: 'both',
+          rootPath: this.plugin.settings.snippetFolderPath,
+          initialSelection: selectedFile ?? selectedFolder,
+          t,
+          onSelect: (result) => {
+            if (!modalEl.isConnected) {
+              closePicker({ restoreFocus: false });
+              return;
+            }
+            applySelection(result);
+            closePicker();
+          },
+        });
+        closeActiveSnippetTargetPicker = closePicker;
+
+        pickerCloseBtn.addEventListener('click', () => closePicker());
+        pickerBackdrop.addEventListener('click', (e) => { if (e.target === pickerBackdrop) closePicker(); });
+        pickerBackdrop.addEventListener('keydown', (e: KeyboardEvent) => {
+          if (e.key !== 'Escape') return;
+          e.preventDefault();
+          e.stopPropagation();
+          closePicker();
+        });
+
+        void picker.mount();
+        window.setTimeout(() => {
+          const searchInput = pickerBackdrop.querySelector('.rp-stp-search-input') as HTMLElement | null;
+          (searchInput ?? pickerBackdrop).focus({ preventScroll: true });
+        }, 0);
+      };
```

#### 2. src/styles/protocol-editor.css:266-490

**File**: src/styles/protocol-editor.css
**Changes**: MODIFY — add explicit custom modal stack classes and sizing for the parent-owned target picker overlay

```diff
diff --git a/src/styles/protocol-editor.css b/src/styles/protocol-editor.css
--- a/src/styles/protocol-editor.css
+++ b/src/styles/protocol-editor.css
@@
 .rp-protocol-editor-snippet-target-picker-modal {
   min-width: min(520px, 100%);
 }
 
+.rp-protocol-editor-modal-backdrop.rp-protocol-editor-snippet-target-picker-backdrop {
+  z-index: 1001;
+}
+
+.rp-protocol-editor-snippet-target-picker-shell {
+  width: min(640px, 92vw);
+  max-height: min(82vh, 720px);
+}
+
+.rp-protocol-editor-snippet-target-picker-body {
+  display: flex;
+  flex-direction: column;
+  min-height: 0;
+}
+
+.rp-protocol-editor-snippet-target-picker-modal {
+  flex: 1 1 auto;
+  min-height: 0;
+}
+
+.rp-protocol-editor-snippet-target-picker-modal .rp-stp-root,
+.rp-protocol-editor-snippet-target-picker-modal .rp-stp-body {
+  min-height: 0;
+}
+
 .rp-protocol-editor-snippet-target-picker-modal .rp-stp-list {
   min-height: 280px;
   max-height: min(52vh, 520px);
 }
```

#### 3. src/__tests__/views/protocol-editor-keyboard.test.ts:1-701

**File**: src/__tests__/views/protocol-editor-keyboard.test.ts
**Changes**: MODIFY — extend MockEl/SnippetTreePicker mocks and add snippet target picker lifecycle/persistence tests

```diff
diff --git a/src/__tests__/views/protocol-editor-keyboard.test.ts b/src/__tests__/views/protocol-editor-keyboard.test.ts
--- a/src/__tests__/views/protocol-editor-keyboard.test.ts
+++ b/src/__tests__/views/protocol-editor-keyboard.test.ts
@@
   disabled: boolean;
+  isConnected: boolean;
   style: { setProperty: (prop: string, value: string) => void };
@@
   remove: () => void;
+  focus: (opts?: { preventScroll?: boolean }) => void;
+  select: () => void;
+  toggleAttribute: (name: string, force?: boolean) => void;
 }
@@
     disabled: false,
+    isConnected: true,
     style: { setProperty() {} },
@@
     addEventListener(type: string, handler: (ev: unknown) => void): void {
@@
     },
+    focus: vi.fn(),
+    select: vi.fn(),
+    toggleAttribute(name: string, force?: boolean): void {
+      const enabled = force ?? attrs[name] === undefined;
+      if (enabled) attrs[name] = '';
+      else delete attrs[name];
+      if (name === 'disabled') el.disabled = enabled;
+    },
@@
     remove(): void {
+      const markDisconnected = (node: MockEl): void => {
+        node.isConnected = false;
+        for (const child of node.children) markDisconnected(child);
+      };
+      markDisconnected(el);
       if (el.parent) {
@@
 }));;
 
 // ── Mock SnippetTreePicker (imported by protocol-editor-view) ────────────────
+const pickerSpies = vi.hoisted(() => ({
+  ctor: vi.fn(),
+  mount: vi.fn(),
+  unmount: vi.fn(),
+  instances: [] as Array<{ options: any }>,
+}));
 
 vi.mock('../../views/snippet-tree-picker', () => ({
-  SnippetTreePicker: class { constructor() {} mount() { return Promise.resolve(); } unmount() {} },
+  SnippetTreePicker: class {
+    constructor(options: any) {
+      pickerSpies.ctor(options);
+      pickerSpies.instances.push({ options });
+    }
+    mount() { pickerSpies.mount(); return Promise.resolve(); }
+    unmount() { pickerSpies.unmount(); }
+  },
 }));
@@
     'protocolEditor.snippetTargetLabel': 'Snippet target',
+    'protocolEditor.browseSnippetTarget': 'Browse',
+    'protocolEditor.browseSnippetTargetTitle': 'Browse snippet target',
+    'protocolEditor.noSnippetTarget': 'No target',
+    'protocolEditor.snippetTargetHelp': 'Choose a folder or snippet',
+    'protocolEditor.snippetFolderTarget': 'Folder',
+    'protocolEditor.snippetFileTarget': 'Snippet',
@@
     'protocolEditor.minimapLabel': 'Minimap — click or drag to pan',
+    'protocolEditor.useGlobalSeparator': 'Use global',
+    'settings.newline': 'Newline',
+    'settings.space': 'Space',
   };
@@
 describe('openEditModal — empty multiline field regression (1.22.0 bug)', () => {
@@
 });
+
+describe('openEditModal — snippet target picker lifecycle', () => {
+  let savedDocument: unknown;
+  let savedWindow: unknown;
+
+  beforeEach(() => {
+    savedDocument = (globalThis as any).document;
+    savedWindow = (globalThis as any).window;
+    pickerSpies.ctor.mockClear();
+    pickerSpies.mount.mockClear();
+    pickerSpies.unmount.mockClear();
+    pickerSpies.instances.length = 0;
+  });
+
+  afterEach(() => {
+    (globalThis as any).document = savedDocument;
+    (globalThis as any).window = savedWindow;
+  });
+
+  function clickText(root: MockEl, text: string): MockEl {
+    const button = findAllByTag(root, 'button').find(el => el._text === text);
+    expect(button).toBeDefined();
+    for (const handler of button!._listeners.get('click') ?? []) handler({ target: button });
+    return button!;
+  }
+
+  async function save(root: MockEl): Promise<void> {
+    const saveBtn = findAllByTag(root, 'button').find(el => el._text === 'Save')!;
+    for (const handler of saveBtn._listeners.get('click') ?? []) await handler({ target: saveBtn });
+  }
+
+  function openSnippetModal(initialFields: Record<string, unknown> = {}) {
+    const documentBody = makeEl('body');
+    const savedNodes: ProtocolNodeRecord[] = [];
+    const node: ProtocolNodeRecord = { id: 's1', kind: 'snippet', x: 0, y: 0, width: 200, height: 80, fields: initialFields };
+    const mockStore = {
+      async update(_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1) {
+        const doc: ProtocolDocumentV1 = {
+          schema: 'radiprotocol.protocol', version: 1, id: 'test', title: 'T',
+          createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
+          nodes: [node], edges: [],
+        };
+        const result = mutator(doc);
+        savedNodes.push(...result.nodes);
+        return result;
+      },
+    };
+    const view = new ProtocolEditorView({} as any, {
+      i18n: { t },
+      settings: { snippetFolderPath: '.radiprotocol/snippets' },
+      snippetService: {},
+      protocolDocumentStore: mockStore,
+    } as any);
+    (view as any).protocolPath = 'test.rp.json';
+    (view as any).viewportEl = makeEl('div');
+    (view as any).loadProtocol = vi.fn(async () => {});
+    (globalThis as any).document = { body: documentBody, activeElement: null };
+    (globalThis as any).window = {
+      setTimeout: (fn: () => void) => { fn(); return 0; },
+      requestAnimationFrame: (fn: () => void) => { fn(); return 0; },
+    };
+    (view as any).openEditModal(node);
+    return { documentBody, savedNodes };
+  }
+
+  it('selecting a folder persists subfolderPath only', async () => {
+    const { documentBody, savedNodes } = openSnippetModal();
+    clickText(documentBody, 'Browse');
+    pickerSpies.instances[0]!.options.onSelect({ kind: 'folder', relativePath: 'abdomen/ct' });
+    await save(documentBody);
+    const saved = savedNodes[savedNodes.length - 1]!;
+    expect(saved.fields.subfolderPath).toBe('abdomen/ct');
+    expect(saved.fields.snippetPath).toBeUndefined();
+  });
+
+  it('selecting a file persists snippetPath only', async () => {
+    const { documentBody, savedNodes } = openSnippetModal({ subfolderPath: 'old' });
+    clickText(documentBody, 'Browse');
+    pickerSpies.instances[0]!.options.onSelect({ kind: 'file', relativePath: 'abdomen/ct/report.md' });
+    await save(documentBody);
+    const saved = savedNodes[savedNodes.length - 1]!;
+    expect(saved.fields.snippetPath).toBe('abdomen/ct/report.md');
+    expect(saved.fields.subfolderPath).toBeUndefined();
+  });
+
+  it('cancelling the picker preserves the existing target', async () => {
+    const { documentBody, savedNodes } = openSnippetModal({ subfolderPath: 'existing/folder' });
+    clickText(documentBody, 'Browse');
+    const pickerClose = findAllByClass(documentBody, 'rp-protocol-editor-modal-close').find(el => el.closest('.rp-protocol-editor-snippet-target-picker-shell'))!;
+    for (const handler of pickerClose._listeners.get('click') ?? []) handler({ target: pickerClose });
+    await save(documentBody);
+    const saved = savedNodes[savedNodes.length - 1]!;
+    expect(saved.fields.subfolderPath).toBe('existing/folder');
+    expect(saved.fields.snippetPath).toBeUndefined();
+  });
+
+  it('closing the parent while the picker is open unmounts and removes the picker overlay', () => {
+    const { documentBody } = openSnippetModal();
+    clickText(documentBody, 'Browse');
+    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(1);
+    const parentCloseBtn = findAllByClass(documentBody, 'rp-protocol-editor-modal-close').find(el => !el.closest('.rp-protocol-editor-snippet-target-picker-shell'))!;
+    for (const handler of parentCloseBtn._listeners.get('click') ?? []) handler({ target: parentCloseBtn });
+    expect(pickerSpies.unmount).toHaveBeenCalledTimes(1);
+    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(0);
+  });
+
+  it('Escape closes the picker before the parent and restores focus to Browse', () => {
+    const { documentBody } = openSnippetModal();
+    const browseBtn = clickText(documentBody, 'Browse');
+    const pickerBackdrop = findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')[0]!;
+    dispatchKeyDown(pickerBackdrop, 'Escape');
+    expect(pickerSpies.unmount).toHaveBeenCalledTimes(1);
+    expect(findAllByClass(documentBody, 'rp-protocol-editor-snippet-target-picker-backdrop')).toHaveLength(0);
+    expect(browseBtn.focus).toHaveBeenCalledWith({ preventScroll: true });
+    expect(findAllByClass(documentBody, 'rp-protocol-editor-modal')).toHaveLength(1);
+  });
+});
```

### Success Criteria:

#### Automated Verification:
- [x] Protocol Editor snippet picker lifecycle tests pass: `npm test -- src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] Protocol Editor no longer constructs an Obsidian picker modal: `grep -n "new Modal(this.app)" src/views/protocol-editor-view.ts` returns no matches.
- [x] Type checking passes after the import change: `npm run build`

#### Manual Verification:
- [ ] Opening Browse from a Snippet node settings modal shows the target picker above the settings modal and it is interactive.
- [ ] Selecting a directory updates the summary and Save persists `subfolderPath` while clearing `snippetPath`.
- [ ] Selecting a `.md` file updates the summary and Save persists `snippetPath` while clearing `subfolderPath`.
- [ ] Cancelling the picker leaves the previous target unchanged.
- [ ] Closing the parent settings modal while the picker is open leaves no orphaned picker.
- [ ] `Escape` closes the picker first and focus returns to Browse/Select.

## Phase 2: Shared directory tooltip removal

### Overview

Depends on Phase 1 only for plan ordering; implementation is otherwise independent. It removes directory row hover-tooltip triggers in the shared picker and extends the existing no-tooltip regression tests.

### Changes Required:

#### 1. src/views/snippet-tree-picker.ts:325-355

**File**: src/views/snippet-tree-picker.ts
**Changes**: MODIFY — remove row-level folder aria-label/title tooltip triggers while preserving visible row text and click behavior

```diff
diff --git a/src/views/snippet-tree-picker.ts b/src/views/snippet-tree-picker.ts
--- a/src/views/snippet-tree-picker.ts
+++ b/src/views/snippet-tree-picker.ts
@@
-    const row = createButton(listEl, { cls: 'rp-stp-folder-row', attr: { 'aria-label': this.t('snippetTreePicker.openFolder', { name: basenameOf(folderName) }) } });
+    const row = createButton(listEl, { cls: 'rp-stp-folder-row' });
```


#### 2. src/__tests__/views/snippet-tree-picker.test.ts:1058-1070

**File**: src/__tests__/views/snippet-tree-picker.test.ts
**Changes**: MODIFY — add directory row no-tooltip assertions for drill and search flows without regressing file-row assertions

```diff
diff --git a/src/__tests__/views/snippet-tree-picker.test.ts b/src/__tests__/views/snippet-tree-picker.test.ts
--- a/src/__tests__/views/snippet-tree-picker.test.ts
+++ b/src/__tests__/views/snippet-tree-picker.test.ts
@@
-describe('File row accessibility (no tooltip-triggering attributes)', () => {
+describe('Picker row accessibility (no tooltip-triggering attributes)', () => {
@@
   it('file rows do not carry tooltip-triggering title or aria-label attributes', async () => {
@@
     expect(fileRow?.getAttribute('title')).toBeNull();
     expect(fileRow?.getAttribute('aria-label')).toBeNull();
   });
+
+  it('folder rows do not carry tooltip-triggering title or aria-label attributes', async () => {
+    svc.listFolder.mockResolvedValue({
+      folders: ['abdomen'],
+      snippets: [],
+    });
+    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
+    await picker.mount();
+
+    const folderRow = findByClass(container, 'rp-stp-folder-row')[0];
+    expect(folderRow?.getAttribute('title')).toBeNull();
+    expect(folderRow?.getAttribute('aria-label')).toBeNull();
+  });
+
+  it('folder rows in search results do not carry tooltip-triggering title or aria-label attributes', async () => {
+    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
+    svc.listFolderDescendants.mockResolvedValue({
+      folders: [`${ROOT}/abdomen`],
+      files: [],
+    });
+    const { picker, container } = makePicker({ mode: 'both' }, svc);
+    await picker.mount();
+
+    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
+    triggerInput(input, 'abdomen');
+    await flushDebounce();
+
+    const folderRow = findByClass(container, 'rp-stp-folder-row')[0];
+    expect(folderRow?.getAttribute('title')).toBeNull();
+    expect(folderRow?.getAttribute('aria-label')).toBeNull();
+  });
 });
```


### Success Criteria:

#### Automated Verification:
- [x] Shared picker tooltip regression tests pass: `npm test -- src/__tests__/views/snippet-tree-picker.test.ts`
- [x] No folder row sets tooltip-triggering attributes: `grep -n "rp-stp-folder-row.*aria-label\|rp-stp-folder-row.*title" src/views/snippet-tree-picker.ts` returns no matches.

#### Manual Verification:
- [ ] Hovering directories in the Insert Snippet picker shows no native title, Obsidian aria-label tooltip, or equivalent hover hint.
- [ ] Hovering directories in the Inline Runner snippet selection step shows no native title, Obsidian aria-label tooltip, or equivalent hover hint.
- [ ] Hovering `.md` file rows in both flows still shows no tooltip.

## Phase 3: Inline Runner picker resize chain

### Overview

Depends on Phase 2 so the shared picker row behavior is already locked. It removes fixed inline picker body/list caps, makes the inline picker a full-height flex child of content-only mode, and adds CSS regression checks.

### Changes Required:

#### 1. src/styles/snippet-tree-picker.css:16-239

**File**: src/styles/snippet-tree-picker.css
**Changes**: MODIFY — split inline and modal picker sizing so inline hosts can grow/shrink while modal hosts keep bounded picker height

```diff
diff --git a/src/styles/snippet-tree-picker.css b/src/styles/snippet-tree-picker.css
--- a/src/styles/snippet-tree-picker.css
+++ b/src/styles/snippet-tree-picker.css
@@
-.rp-stp-inline-host .rp-stp-body,
 .rp-stp-modal-host .rp-stp-body {
   height: 360px;
 }
+
+.rp-stp-inline-host .rp-stp-body {
+  flex: 1 1 auto;
+  min-height: 0;
+  height: 100%;
+}
@@
 .rp-stp-body .rp-stp-list {
   flex: 1 1 auto;
 }
+
+.rp-stp-inline-host .rp-stp-root {
+  display: flex;
+  flex: 1 1 auto;
+  flex-direction: column;
+  min-height: 0;
+  height: 100%;
+}
@@
 .rp-stp-modal-host .rp-stp-list {
   min-height: 240px;
   max-height: 480px;
   overflow-y: auto;
 }
+
+.rp-stp-inline-host .rp-stp-list {
+  flex: 1 1 auto;
+  min-height: 0;
+  max-height: none;
+  overflow-y: auto;
+}
```

#### 2. src/styles/inline-runner.css:107-244

**File**: src/styles/inline-runner.css
**Changes**: MODIFY — complete the Inline Runner content-only flex chain for `.rp-stp-inline-host`, `.rp-stp-root`, `.rp-stp-body`, and `.rp-stp-list`

```diff
diff --git a/src/styles/inline-runner.css b/src/styles/inline-runner.css
--- a/src/styles/inline-runner.css
+++ b/src/styles/inline-runner.css
@@
 .rp-inline-runner-container.rp-state-content-only .rp-inline-runner-content {
   flex: 1 1 auto;
+  display: flex;
+  flex-direction: column;
+  min-height: 0;
 }
@@
 .rp-stp-inline-host {
   width: 100%;
   max-width: 100%;
   min-width: 0;
+  flex: 1 1 auto;
+  min-height: 0;
+  height: 100%;
+  overflow: hidden;
   box-sizing: border-box;
 }
@@
 .rp-stp-inline-host .rp-stp-root,
 .rp-stp-inline-host .rp-stp-body,
 .rp-stp-inline-host .rp-stp-search,
 .rp-stp-inline-host .rp-stp-list {
   width: 100%;
   max-width: 100%;
   min-width: 0;
+  min-height: 0;
   box-sizing: border-box;
 }
+
+.rp-stp-inline-host .rp-stp-root,
+.rp-stp-inline-host .rp-stp-body {
+  display: flex;
+  flex: 1 1 auto;
+  flex-direction: column;
+}
 
 .rp-stp-inline-host .rp-stp-body {
   min-height: 0;
-  height: auto;
+  height: 100%;
 }
 
 .rp-stp-inline-host .rp-stp-list {
+  flex: 1 1 auto;
+  max-height: none;
   overflow-x: hidden;
+  overflow-y: auto;
 }
+
+.rp-inline-runner-container.rp-state-content-only .rp-inline-runner-content > .rp-runner-footer-row {
+  flex: 0 0 auto;
+  margin-top: var(--size-2-3);
+}
```

#### 3. src/__tests__/views/inline-runner-modal.test.ts:1-445

**File**: src/__tests__/views/inline-runner-modal.test.ts
**Changes**: MODIFY — add source-string regression checks for inline picker flex sizing and absence of fixed inline height caps

```diff
diff --git a/src/__tests__/views/inline-runner-modal.test.ts b/src/__tests__/views/inline-runner-modal.test.ts
--- a/src/__tests__/views/inline-runner-modal.test.ts
+++ b/src/__tests__/views/inline-runner-modal.test.ts
@@
 describe('InlineRunnerModal — self-check completion', () => {
@@
 });
+
+describe('InlineRunnerModal — snippet picker resize CSS regression', () => {
+  it('inline snippet picker uses flex growth instead of fixed body/list height caps', () => {
+    const snippetPickerCss = fs.readFileSync(
+      path.resolve(__dirname, '../../styles/snippet-tree-picker.css'),
+      'utf8',
+    );
+    const inlineRunnerCss = fs.readFileSync(
+      path.resolve(__dirname, '../../styles/inline-runner.css'),
+      'utf8',
+    );
+
+    expect(snippetPickerCss).not.toMatch(/\.rp-stp-inline-host\s+\.rp-stp-body,\s*\.rp-stp-modal-host\s+\.rp-stp-body\s*\{[^}]*height:\s*360px/s);
+    expect(snippetPickerCss).toMatch(/\.rp-stp-inline-host\s+\.rp-stp-body\s*\{[^}]*height:\s*100%/s);
+    expect(snippetPickerCss).toMatch(/\.rp-stp-inline-host\s+\.rp-stp-list\s*\{[^}]*max-height:\s*none/s);
+
+    expect(inlineRunnerCss).toMatch(/\.rp-inline-runner-container\.rp-state-content-only\s+\.rp-inline-runner-content\s*\{[^}]*display:\s*flex/s);
+    expect(inlineRunnerCss).toMatch(/\.rp-stp-inline-host\s*\{[^}]*flex:\s*1 1 auto/s);
+    expect(inlineRunnerCss).toMatch(/\.rp-stp-inline-host\s*\{[^}]*overflow:\s*hidden/s);
+    expect(inlineRunnerCss).toMatch(/\.rp-stp-inline-host\s+\.rp-stp-list\s*\{[^}]*overflow-y:\s*auto/s);
+  });
+});
```

### Success Criteria:

#### Automated Verification:
- [x] Inline Runner CSS resize regression test passes: `npm test -- src/__tests__/views/inline-runner-modal.test.ts`
- [x] Final targeted regression suite passes: `npm test -- src/__tests__/views/protocol-editor-keyboard.test.ts src/__tests__/views/snippet-tree-picker.test.ts src/__tests__/views/inline-runner-modal.test.ts`
- [x] Full build passes: `npm run build`

#### Manual Verification:
- [ ] In Inline Runner snippet-pick state, vertically enlarging the modal makes the snippet list grow into the added space.
- [ ] Vertically shrinking the modal makes the snippet list shrink without pushing header/footer out of view.
- [ ] Long snippet lists scroll inside the picker list area.
- [ ] Other Inline Runner states still keep header, footer, controls, and actions visible without nested page-level scrolling.

## Ordering Constraints

- Phase 1 must run first because it fixes the highest-risk broken selection flow and parent/child modal lifecycle.
- Phase 2 can be implemented independently after Phase 1; it is shared picker behavior with low coupling.
- Phase 3 should run last because it changes shared picker CSS and Inline Runner layout; its verification should include the already-fixed no-tooltip picker rows.
- No phase should edit parser, graph, runner core, snippet service, or persisted protocol schema.

## Verification Notes

- Run `npm test -- src/__tests__/views/protocol-editor-keyboard.test.ts src/__tests__/views/snippet-tree-picker.test.ts src/__tests__/views/inline-runner-modal.test.ts` after the final phase.
- Run `npm run build` after the final phase to catch TypeScript/CSS import regressions.
- Manually verify Snippet node settings Browse overlay appears above the settings modal, selection updates the summary, Save persists the correct field, Cancel preserves the old field, and parent close removes the picker.
- Manually verify `Escape` closes the picker before the parent settings modal and focus returns to Browse/Select.
- Manually verify Insert Snippet and Inline Runner directory/file hover shows no native title/aria-label tooltip.
- Manually verify the Inline Runner snippet picker list grows and shrinks with vertical modal resizing and scrolls internally for long lists.

## Performance Considerations

- Picker ownership changes do not add new vault scans; `SnippetTreePicker` still calls the same `listFolder`/`listFolderDescendants` methods.
- CSS changes avoid additional resize observers or polling; Inline Runner continues using existing resize persistence.
- Parent close cleanup unmounts the picker promptly to remove listeners and debounce timers.

## Migration Notes

No persisted schema, settings, or data migration is required. Existing `subfolderPath` and `snippetPath` values remain valid and are still mutually exclusive in the editor UI.

## Pattern References

- `src/views/snippet-manager-view.ts:453-494` — modal/host-owned `SnippetTreePicker` with unmount in close lifecycle.
- `src/views/insert-snippet-modal.ts:32-50` — class-owned picker field cleaned up in `onClose`.
- `src/views/snippet-tree-picker.ts:375-389` — file rows without row-level tooltip-triggering attributes.
- `src/views/inline-runner-modal.ts:407-423` — Inline Runner content-only mode for snippet picker state.
- `src/styles/inline-runner.css:86-112` — resizable shell and flexible content region.

## Developer Context

- Step 4 design confirmation: Proceed with parent-owned custom picker overlay, shared directory no-tooltip behavior, and CSS-only inline resize fix. Evidence cited: `src/views/protocol-editor-view.ts:2131`, `src/views/protocol-editor-view.ts:2246`, `src/views/snippet-tree-picker.ts:330`, `src/styles/snippet-tree-picker.css:26`, `src/styles/snippet-tree-picker.css:135`.
- Step 5 decomposition confirmation: Approved 3 slices — Parent-owned Protocol Editor target picker; Shared directory tooltip removal; Inline Runner picker resize chain.
- Step 9 review triage: Applied both concern findings — scoped Inline Runner overflow clipping to picker host/list and added global restoration around the new Protocol Editor test helper.

## Plan History

- Phase 1: Parent-owned Protocol Editor target picker — approved as generated
- Phase 2: Shared directory tooltip removal — approved as generated
- Phase 3: Inline Runner picker resize chain — approved as generated

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 3 §2 (inline-runner.css) | src/views/inline-runner-modal.ts:417-422 | concern | code-quality | Phase 3 adds `overflow-y: hidden` to generic `rp-state-content-only` content, but that class is applied to all non-action Inline Runner states, not only snippet-pick, so long error/completion/content-only views can be clipped instead of scrolling | Keep generic content overflow scrollable and scope hidden overflow to the snippet-picker host/list only | applied: removed generic `overflow-y: hidden` from content-only content and scoped clipping to `.rp-stp-inline-host` while leaving `.rp-stp-list` as the scroll container |
| code | Phase 1 §3 (protocol-editor-keyboard.test.ts) | src/__tests__/views/protocol-editor-keyboard.test.ts:596-607 | concern | code-quality | The new `openSnippetModal` helper overwrites `globalThis.document` and `globalThis.window` without the afterEach restoration pattern already used in this file | Add saved globals plus an `afterEach` that restores `window`, `requestAnimationFrame`, and `document` | applied: added saved `document`/`window` values and `afterEach` restoration in the new snippet target picker describe block |

_Coverage reviewer reported no uncovered verification-intent findings._

## References

- User request in `/skill:blueprint` invocation at 2026-06-14T12:56:14+0300.
- Previous plan: `.rpiv/artifacts/plans/2026-06-14_11-53-54_snippet-selection-ux-fixes.md`.
- Recent commits: `b49d6cd` (Protocol Editor snippet target Browse modal), `164b8e6` (shared picker sizing/no file-row tooltip), `0d9ac36` (2.0.1 release).
