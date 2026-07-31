---
date: 2026-07-30T09:49:45+0300
author: Roman Shulgha
commit: 9e99e9d
branch: main
repository: RadiProtocol
topic: "Snippet Editor two-pane file manager redesign"
tags: [plan, snippets, snippet-manager, two-pane, search, drag-and-drop]
status: ready
parent: .rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md
phase_count: 4
phases:
  - { n: 1, title: Service-owned global search, files: [src/snippets/snippet-service.ts, src/__tests__/snippet-service.test.ts], depends_on: [] }
  - { n: 2, title: Two-pane navigation and supplied renderer models, files: [src/views/snippet-manager-view.ts, src/views/snippet-manager/tree-renderer.ts, src/styles/snippet-manager.css, src/__tests__/snippet-tree-view.test.ts], depends_on: [1] }
  - { n: 3, title: Mutation rename and drag-and-drop reconciliation, files: [src/views/snippet-manager-view.ts, src/views/snippet-manager/tree-renderer.ts, src/__tests__/snippet-tree-dnd.test.ts, src/__tests__/snippet-tree-inline-rename.test.ts, src/__tests__/snippet-tree-view.test.ts], depends_on: [2] }
  - { n: 4, title: Debounced search watcher refresh and bilingual UX, files: [src/views/snippet-manager-view.ts, src/views/snippet-manager/tree-renderer.ts, src/styles/snippet-manager.css, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/snippet-tree-view.test.ts, src/__tests__/snippet-vault-watcher.test.ts], depends_on: [3] }
unresolved_phase_count: 0
last_updated: 2026-07-30T09:49:45+0300
last_updated_by: Roman Shulgha
---

# Snippet Editor Two-Pane File Manager Implementation Plan

## Overview

Redesign `SnippetManagerView` as a conventional two-pane file manager: a visible-root, folders-only tree on the left and the selected folder's direct snippets on the right. `SnippetService` will own safe recursive name/folder/body search, while the view owns transient selection, debouncing, generation-guarded refresh, and mutation reconciliation; the existing renderer will evolve to render supplied models without rebuilding them.

## Requirements

- Render a 260–300 px folders-only left pane and a flexible right snippet pane.
- Show the configured snippet root as a visible, initially selected row.
- Keep selected folder state view-local; reopening resets selection to root.
- Separate folder selection from chevron expansion while preserving persisted expanded paths.
- Show direct snippets only in normal right-pane mode, as name-only rows without a file icon.
- Keep an always-visible top search input.
- Search globally by snippet name, descendant folder name, and parsed snippet body after a 120 ms debounce.
- Promote every descendant snippet when a real descendant folder name matches; exclude the synthetic root basename from folder matching.
- Keep previous right-pane results visible while an asynchronous search is in flight and reject stale/unmounted completions.
- Rerun active search after debounced create/delete/rename/modify events under the snippet root.
- Preserve snippet and folder context menus, inline rename, and HTML5 drag-and-drop semantics.
- Add root-targeted Create Folder and Create Snippet actions to empty-area context menus.
- Reconcile selected and expanded paths after rename, move, deletion, or external disappearance.
- Add all new user-facing copy to both English and Russian locales.

## Current State Analysis

`SnippetManagerView` currently builds one mixed recursive model and passes it to one renderer. The renderer then duplicates the same recursive model build for expansion and rename refreshes, so model ownership is split. There is no selected-folder state or visible root row, and the header contains three buttons that the redesign removes.

`SnippetService.listFolder()` already returns direct folders and parsed direct snippets separately, and its path gate, Markdown filtering, parsing, sorting, and unreadable-file policy make it the correct boundary for aggregate content search. The picker supplies the proven debounce/load-then-swap/stale-completion pattern, but the manager watcher currently lacks `modify` refresh and mounted/generation guards.

### Key Discoveries

- `src/views/snippet-manager-view.ts:68-176` — current header, single body, watcher registration, and 120 ms redraw debounce.
- `src/views/snippet-manager-view.ts:182-217` — recursive mixed model starts at root children, so no root row exists.
- `src/views/snippet-manager/tree-renderer.ts:104-197` — renderer entry plus duplicate model construction that must be removed.
- `src/views/snippet-manager/tree-renderer.ts:202-305` — current shared row interactions conflate folder selection and expansion.
- `src/views/snippet-manager/tree-renderer.ts:312-586` — menus, DnD, and real/mock DOM-safe inline rename behavior to preserve.
- `src/snippets/snippet-service.ts:65-180` — safe direct listing and parsed Markdown load behavior.
- `src/snippets/snippet-service.ts:282-304,479-488` — extension-agnostic descendant enumeration and service-owned aggregate API precedent.
- `src/snippets/snippet-model.ts:27-57` — searchable body is `content` for plain Markdown and `template` for Markdown templates.
- `src/views/snippet-tree-picker.ts:435-476` — 120 ms debounce, old-results-visible behavior, and post-await stale/unmount checks.
- `src/settings.ts:20-42` — only expanded paths are persisted; selected folder remains transient.
- `src/styles/snippet-manager.css:159-245` — current single-column shell and fixed file-icon spacing.
- `src/__tests__/snippet-tree-view.test.ts:306-344` — current mixed-tree assumptions and an obsolete assertion against the deliberate two-pane layout.

## Desired End State

```typescript
const matches = await snippetService.searchSnippets('chest');
// Matching a real folder named "Chest" includes every parsed Markdown snippet below it.
// The synthetic configured root basename is not considered a folder-name match.
for (const { snippet, folderPath } of matches) {
  console.log(snippet.path, snippet.name, folderPath);
}
```

```text
┌ Search snippets… ───────────────────────────────────────────────┐
├ Folders (280px)             ┬ Snippets / global search results ┤
│ ▾ Snippets  [selected]      │ report                           │
│   ▸ Chest                   │ findings                         │
│   ▸ Abdomen                 │                                  │
└─────────────────────────────┴───────────────────────────────────┘
```

```text
Folder row click        → select folder and refresh direct snippets
Folder chevron click    → expand/collapse only
Active search           → flat snippet rows with containing folder path
Clear search            → restore selected folder's direct snippets
Reopen manager          → select configured root
```

## What We're NOT Doing

- No in-memory search index, cache, worker, backend, cloud sync, or schema migration.
- No selected-folder setting or cross-session selection persistence.
- No changes to `SnippetEditorModal`, snippet formats, runner behavior, or protocol schema.
- No unification with `SnippetTreePicker`; its basename-only search remains separate.
- No change to lowercase-only `.md` handling in `SnippetService`; the existing `.MD` picker inconsistency is documented but out of scope.
- No new renderer subsystem: evolve `SnippetManagerTreeRenderer` rather than adding parallel folder/list classes.
- No ordinary folder rename/move/delete affordances on the synthetic root row.
- No removal or redesign of existing row menu actions, path identity, rename settlement, or DnD MIME contracts.

## Decisions

### Service owns aggregate search I/O

`SnippetService.searchSnippets(query)` will recursively compose `listFolder()` rather than exposing adapter reads to the view. This preserves the path-safety, extension filtering, parsing, sorting, and unreadable-file policy at `src/snippets/snippet-service.ts:65-180` and follows the aggregate `listAllFolders()` precedent at `src/snippets/snippet-service.ts:479-488`.

### Search uses parsed bodies and real descendant folder names

Plain Markdown matches against `content`; Markdown templates match against frontmatter-free `template` (`src/snippets/snippet-model.ts:27-57`). A matching real descendant folder promotes all snippets beneath it, but the synthetic configured root basename is excluded so searching for a root such as “Snippets” does not return the entire library.

### Evolve the existing renderer boundary

Keep `SnippetManagerTreeRenderer` as the DOM interaction owner, but remove its recursive `listFolder()` model builder at `src/views/snippet-manager/tree-renderer.ts:142-197`. The view supplies a folders-only model, current snippet rows, selected path, and search mode. This avoids creating a parallel subsystem while fixing the current source-of-truth duplication.

### One view-owned invalidation generation

`SnippetManagerView` owns selected path, query, timers, mounted state, and one generation counter. Navigation, search, mutations, and watcher refreshes invalidate prior work; post-await commits require both mounted state and generation equality. This strengthens the query-string-only precedent at `src/views/snippet-tree-picker.ts:458-476` against A→B→A races.

### Selection and expansion have different lifetimes

Selected folder resets to `settings.snippetFolderPath` on every `onOpen()` and is never persisted. Expanded paths continue using `settings.snippetTreeExpandedPaths` (`src/settings.ts:20-42`). Rename/move prefix-rewrite both states; deletion/external disappearance falls back to the nearest surviving ancestor or root and purges stale descendant expansion paths.

### Root is navigation-special but drop-capable

The configured root is a visible selected folder and a valid drop target. It is not draggable and exposes no Rename, Move, or Delete menu items. Empty-area creation targets this root regardless of the current selection, matching the approved requirement.

### Preserve lowercase Markdown semantics

The new search composes `listFolder()`, so it retains lowercase `.md` filtering (`src/snippets/snippet-service.ts:128-170`). The picker’s case-insensitive `.MD` behavior is not changed in this plan.

## Phase 1: Service-owned global search

### Overview

Foundation phase with no dependencies; adds the safe recursive search contract and unit coverage consumed by later UI phases.

### Changes Required:

#### 1. src/snippets/snippet-service.ts:after SnippetResolution and after listFolder

**File**: src/snippets/snippet-service.ts
**Changes**: MODIFY — export the search result contract and add safe recursive parsed-snippet search

```typescript
export interface SnippetSearchResult {
  snippet: Snippet;
  folderPath: string;
}

async searchSnippets(query: string): Promise<SnippetSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === '') return [];

  const root = this.assertInsideRoot(this.settings.snippetFolderPath);
  if (root === null) return [];

  const results: SnippetSearchResult[] = [];
  const walk = async (folderPath: string, ancestorFolderMatched: boolean): Promise<void> => {
    const listing = await this.listFolder(folderPath);
    const folderName = folderPath.slice(folderPath.lastIndexOf('/') + 1);
    const currentFolderMatched =
      ancestorFolderMatched ||
      (folderPath !== root && folderName.toLowerCase().includes(normalizedQuery));

    for (const snippet of listing.snippets) {
      const body = snippet.kind === 'md-template' ? snippet.template : snippet.content;
      if (
        currentFolderMatched ||
        snippet.name.toLowerCase().includes(normalizedQuery) ||
        body.toLowerCase().includes(normalizedQuery)
      ) {
        results.push({ snippet, folderPath });
      }
    }

    for (const folderName of listing.folders) {
      await walk(`${folderPath}/${folderName}`, currentFolderMatched);
    }
  };

  await walk(root, false);
  return results.sort(
    (a, b) =>
      a.snippet.name.localeCompare(b.snippet.name) ||
      a.snippet.path.localeCompare(b.snippet.path),
  );
}
```

#### 2. src/__tests__/snippet-service.test.ts:service API and search suites

**File**: src/__tests__/snippet-service.test.ts
**Changes**: MODIFY — cover name, parsed body, folder promotion, root exclusion, unreadable files, and legacy-file exclusion

```typescript
it('exposes listFolder / load / save / delete / exists / searchSnippets / resolveSnippet', () => {
  const { vault } = makeVault();
  const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
  expect(typeof svc.listFolder).toBe('function');
  expect(typeof svc.load).toBe('function');
  expect(typeof svc.save).toBe('function');
  expect(typeof svc.delete).toBe('function');
  expect(typeof svc.exists).toBe('function');
  expect(typeof svc.searchSnippets).toBe('function');
  expect(typeof svc.resolveSnippet).toBe('function');
});

describe('searchSnippets — global parsed Markdown search', () => {
  it('matches snippet names and sorts matches by display name then path', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/zebra-report.md`]: 'body',
        [`${ROOT}/alpha-report.md`]: 'body',
        [`${ROOT}/ignore.md`]: 'body',
      },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const matches = await svc.searchSnippets('REPORT');

    expect(matches.map(({ snippet }) => snippet.name)).toEqual(['alpha-report', 'zebra-report']);
    expect(matches.every(({ folderPath }) => folderPath === ROOT)).toBe(true);
  });

  it('matches plain content and template body but not template frontmatter metadata', async () => {
    const plainPath = `${ROOT}/plain.md`;
    const templatePath = `${ROOT}/template.md`;
    const metadataOnlyPath = `${ROOT}/metadata.md`;
    const metadataOnly = serializeMarkdownTemplate({
      kind: 'md-template',
      path: metadataOnlyPath,
      name: 'metadata',
      template: 'ordinary body',
      placeholders: [],
      validationError: null,
      description: 'frontmatter-secret',
    });
    const { vault } = makeVault({
      files: {
        [plainPath]: 'Contains Needle Plain.',
        [templatePath]: mdTemplateFile('template', 'Contains needle template.', []),
        [metadataOnlyPath]: metadataOnly,
      },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const bodyMatches = await svc.searchSnippets('needle');
    const metadataMatches = await svc.searchSnippets('frontmatter-secret');

    expect(bodyMatches.map(({ snippet }) => snippet.path)).toEqual([plainPath, templatePath]);
    expect(metadataMatches).toEqual([]);
  });

  it('promotes every nested snippet under a matching real folder', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/Chest/direct.md`]: 'ordinary',
        [`${ROOT}/Chest/CT/nested.md`]: 'ordinary',
        [`${ROOT}/Abdomen/other.md`]: 'ordinary',
      },
      folders: [ROOT, `${ROOT}/Chest`, `${ROOT}/Chest/CT`, `${ROOT}/Abdomen`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const matches = await svc.searchSnippets('chest');

    expect(matches.map(({ snippet }) => snippet.path)).toEqual([
      `${ROOT}/Chest/direct.md`,
      `${ROOT}/Chest/CT/nested.md`,
    ]);
  });

  it('does not treat the configured root basename as a folder-name match', async () => {
    const { vault } = makeVault({
      files: { [`${ROOT}/ordinary.md`]: 'ordinary body' },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.searchSnippets('snippets')).resolves.toEqual([]);
  });

  it('skips failed parses, unreadable Markdown, legacy JSON, and non-Markdown files without aborting', async () => {
    const readablePath = `${ROOT}/readable.md`;
    const unreadablePath = `${ROOT}/unreadable.md`;
    const failedParsePath = `${ROOT}/failed-parse.md`;
    const failedParse = [
      '---',
      'name: failed-parse',
      'placeholders:',
      '  - id: choice',
      '    label: Choice',
      '    type: choice',
      '---',
      'needle',
    ].join('\n');
    const { vault } = makeVault({
      files: {
        [readablePath]: 'needle',
        [unreadablePath]: 'needle',
        [failedParsePath]: failedParse,
        [`${ROOT}/legacy.json`]: '{"content":"needle"}',
        [`${ROOT}/notes.txt`]: 'needle',
      },
      folders: [ROOT],
    });
    const originalRead = vault.adapter.read;
    vault.adapter.read = vi.fn(async (path: string) => {
      if (path === unreadablePath) throw new Error('EACCES');
      return originalRead(path);
    }) as typeof originalRead;
    const throwingTranslator = ((key: string): string => {
      if (key === 'snippetModel.invalidChoiceError') throw new Error('parse failed');
      return key;
    }) as never;
    const svc = new SnippetService(
      makeSnippetServiceApp(vault) as never,
      settings,
      throwingTranslator,
    );

    const matches = await svc.searchSnippets('needle');

    expect(matches.map(({ snippet }) => snippet.path)).toEqual([readablePath]);
  });

  it('returns no matches for an empty or whitespace-only query without reading folders', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.searchSnippets('   ')).resolves.toEqual([]);
    expect(vault.adapter.list).not.toHaveBeenCalled();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Service search tests pass: `npx vitest run src/__tests__/snippet-service.test.ts`
- [x] Phase files satisfy ESLint: `npx eslint src/snippets/snippet-service.ts src/__tests__/snippet-service.test.ts`

#### Manual Verification:
- [ ] Review a mixed plain-Markdown/template fixture and confirm only parsed body text, snippet names, and real descendant folder names affect results.

## Phase 2: Two-pane navigation and supplied renderer models

### Overview

Depends on Phase 1; delivers the visible-root folders-only navigation pane, selected-folder direct snippet pane, empty-area creation, and the renderer ownership correction.

### Changes Required:

#### 1. src/views/snippet-manager-view.ts:lifecycle model and render sections

**File**: src/views/snippet-manager-view.ts
**Changes**: MODIFY — build the two-pane shell, own folder/selection models, and supply direct snippet rows to the renderer

```typescript
// Remove setIcon from the obsidian import (header buttons are gone).
// Replace the treeRootEl/treeData fields and constructor with:
private folderRootEl!: HTMLElement;
private snippetRootEl!: HTMLElement;
private folderTreeData!: TreeNodeFolder;
private snippetData: TreeNodeFile[] = [];
private selectedFolderPath: string;

constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
  super(leaf);
  this.plugin = plugin;
  this.selectedFolderPath = plugin.settings.snippetFolderPath;
}

// Replace the existing onOpen shell/header/renderer wiring with:
async onOpen(): Promise<void> {
  const { contentEl } = this;
  contentEl.empty();
  contentEl.addClass('radi-snippet-tree-root');
  this.selectedFolderPath = this.plugin.settings.snippetFolderPath;

  const layout = contentEl.createDiv({ cls: 'radi-snippet-manager-layout' });
  this.folderRootEl = layout.createDiv({ cls: 'radi-snippet-manager-folders' });
  this.folderRootEl.setAttr('role', 'tree');
  this.folderRootEl.setAttr('aria-label', this.plugin.i18n.t('snippetManager.folderPaneAria'));
  this.snippetRootEl = layout.createDiv({ cls: 'radi-snippet-manager-snippets' });
  this.snippetRootEl.setAttr('role', 'list');
  this.snippetRootEl.setAttr('aria-label', this.plugin.i18n.t('snippetManager.snippetPaneAria'));

  this.treeRenderer = new SnippetManagerTreeRenderer({
    folderContainer: this.folderRootEl,
    snippetContainer: this.snippetRootEl,
    plugin: this.plugin,
    callbacks: {
      selectFolder: (path) => this.selectFolder(path),
      toggleFolder: (path) => this.toggleFolder(path),
      openEditModal: (path) => this.openEditModal(path),
      openCreateModal: (folderPath) => this.openCreateModal(folderPath),
      handleCreateSubfolder: (path) => this.handleCreateSubfolder(path),
      handleDeleteSnippet: (path, name) => this.handleDeleteSnippet(path, name),
      handleDeleteFolder: (path, name) => this.handleDeleteFolder(path, name),
      openMovePicker: (node) => this.openMovePicker(node),
      performMove: (srcPath, srcKind, dstFolder) => this.performMove(srcPath, srcKind, dstFolder),
      refresh: async () => {
        await this.rebuildTreeModel();
        this.renderTree();
      },
      rewriteExpandState: (oldPath, newPath) => this.rewriteExpandState(oldPath, newPath),
    },
  });

  this.registerDomEvent(layout, 'contextmenu', (event) => {
    event.preventDefault();
    this.treeRenderer.openRootContextMenu(event as MouseEvent);
  });

  const generation = ++this.searchGeneration;
  await this.rebuildTreeModel();
  if (!this.mounted || generation !== this.searchGeneration) return;
  this.renderTree();

  this.registerEvent(
    this.app.vault.on('create', (file) => {
      if (this.shouldHandle(file.path)) this.scheduleRedraw();
    }) as EventRef,
  );
  this.registerEvent(
    this.app.vault.on('delete', (file) => {
      if (this.shouldHandle(file.path)) this.scheduleRedraw();
    }) as EventRef,
  );
  this.registerEvent(
    this.app.vault.on('rename', (file, oldPath) => {
      if (this.shouldHandle(file.path) || this.shouldHandle(oldPath)) this.scheduleRedraw();
    }) as EventRef,
  );
}

// Replace rebuildTreeModel/buildTreeChildren and add selected-snippet/toggle/select helpers:
private async rebuildTreeModel(): Promise<void> {
  const root = this.plugin.settings.snippetFolderPath;
  this.folderTreeData = {
    kind: 'folder',
    path: root,
    name: root.slice(root.lastIndexOf('/') + 1) || root,
    isRoot: true,
    children: await this.buildFolderChildren(root),
  };
  await this.rebuildSelectedSnippets();
}

private async buildFolderChildren(folderPath: string): Promise<TreeNodeFolder[]> {
  let listing: { folders: string[]; snippets: Snippet[] };
  try {
    listing = await this.plugin.snippetService.listFolder(folderPath);
  } catch {
    return [];
  }
  const folders: TreeNodeFolder[] = [];
  for (const name of listing.folders) {
    const path = `${folderPath}/${name}`;
    folders.push({
      kind: 'folder',
      path,
      name,
      isRoot: false,
      children: await this.buildFolderChildren(path),
    });
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

private async rebuildSelectedSnippets(): Promise<void> {
  let snippets: Snippet[] = [];
  try {
    snippets = (await this.plugin.snippetService.listFolder(this.selectedFolderPath)).snippets;
  } catch {
    // Keep the selected folder navigable and render an empty right pane.
  }
  this.snippetData = snippets
    .map((snippet) => ({
      kind: 'file' as const,
      path: snippet.path,
      name: snippet.name || basenameNoExt(snippet.path),
      snippetKind: snippet.kind,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

private async selectFolder(path: string): Promise<void> {
  const generation = ++this.searchGeneration;
  this.selectedFolderPath = path;
  await this.rebuildSelectedSnippets();
  if (!this.mounted || generation !== this.searchGeneration) return;
  this.renderTree();
}

private async toggleFolder(path: string): Promise<void> {
  const list = this.plugin.settings.snippetTreeExpandedPaths;
  const index = list.indexOf(path);
  if (index >= 0) list.splice(index, 1);
  else list.push(path);
  await this.plugin.saveSettings();
  this.renderTree();
}

// Replace the existing renderTree body with:
private renderTree(): void {
  this.treeRenderer.setCurrentlyEditingPath(this.currentlyEditingPath);
  this.treeRenderer.render({
    folderTree: this.folderTreeData,
    snippets: this.snippetData,
    selectedFolderPath: this.selectedFolderPath,
  });
}
```
Existing CRUD/move/close methods remain and keep calling `rebuildTreeModel()` + `renderTree()`.

#### 2. src/views/snippet-manager/tree-renderer.ts:model render and context-menu sections

**File**: src/views/snippet-manager/tree-renderer.ts
**Changes**: MODIFY — accept supplied folder/list models, separate selection from chevron expansion, render special root and name-only snippets, and remove duplicate model reads

```typescript
// Remove the unused Snippet import, iconForNode, the renderer-side
// buildTreeChildren/getTreeData/toggleExpand helpers, and the saveSettings
// callback slot. Replace the model/callback/constructor/render/renderNode
// sections; keep the existing non-root openContextMenu, DnD helpers, and
// rename helpers except for the success tail shown below.

export interface TreeNodeFolder {
  kind: 'folder';
  path: string;
  name: string;
  isRoot: boolean;
  children: TreeNodeFolder[];
}
export interface TreeNodeFile {
  kind: 'file';
  path: string;
  name: string;
  snippetKind: 'md' | 'md-template';
}
export type TreeNode = TreeNodeFolder | TreeNodeFile;

export interface TreeRendererCallbacks {
  selectFolder(path: string): Promise<void>;
  toggleFolder(path: string): Promise<void>;
  openEditModal(path: string): Promise<void>;
  openCreateModal(folderPath: string): Promise<void>;
  handleCreateSubfolder(path: string): Promise<void>;
  handleDeleteSnippet(path: string, name: string): Promise<void>;
  handleDeleteFolder(path: string, name: string): Promise<void>;
  openMovePicker(node: TreeNode): Promise<void>;
  performMove(srcPath: string, srcKind: 'file' | 'folder', dstFolder: string): Promise<void>;
  refresh(): Promise<void>;
  rewriteExpandState(oldPath: string, newPath: string): Promise<void>;
}

// Class fields/constructor become:
private readonly folderContainer: HTMLElement;
private readonly snippetContainer: HTMLElement;
private readonly plugin: RadiProtocolPlugin;
private readonly callbacks: TreeRendererCallbacks;
private selectedFolderPath = '';

constructor(options: {
  folderContainer: HTMLElement;
  snippetContainer: HTMLElement;
  plugin: RadiProtocolPlugin;
  callbacks: TreeRendererCallbacks;
}) {
  this.folderContainer = options.folderContainer;
  this.snippetContainer = options.snippetContainer;
  this.plugin = options.plugin;
  this.callbacks = options.callbacks;
}

render(options: {
  folderTree: TreeNodeFolder;
  snippets: TreeNodeFile[];
  selectedFolderPath: string;
}): void {
  this.folderContainer.empty();
  this.snippetContainer.empty();
  this.rowLabelEls.clear();
  this.selectedFolderPath = options.selectedFolderPath;
  this.renderNode(this.folderContainer, options.folderTree, 0);
  if (options.snippets.length === 0) {
    this.snippetContainer.createDiv({
      cls: 'radi-snippet-list-empty',
      text: this.plugin.i18n.t('snippetManager.emptyFolderPlaceholder'),
    });
    return;
  }
  for (const snippet of options.snippets) this.renderNode(this.snippetContainer, snippet, 0);
}

public openRootContextMenu(ev: MouseEvent): void {
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  const root = this.plugin.settings.snippetFolderPath;
  const menu = new Menu();
  menu.addItem((item) => item
    .setTitle(t('snippetManager.ctxCreateSnippetHere'))
    .setIcon('plus')
    .onClick(() => { void this.callbacks.openCreateModal(root); }));
  menu.addItem((item) => item
    .setTitle(t('snippetManager.ctxCreateSubfolder'))
    .setIcon('folder-plus')
    .onClick(() => { void this.callbacks.handleCreateSubfolder(root); }));
  menu.showAtMouseEvent(ev);
}

private isExpanded(node: TreeNodeFolder): boolean {
  return node.isRoot || this.plugin.settings.snippetTreeExpandedPaths.includes(node.path);
}

private renderNode(container: HTMLElement, node: TreeNode, depth: number): void {
  const row = container.createDiv({ cls: 'radi-snippet-tree-row' });
  row.setAttribute('data-path', node.path);
  row.setAttribute('data-kind', node.kind);
  row.setAttribute('tabindex', '0');
  if (node.kind === 'folder') {
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-selected', String(node.path === this.selectedFolderPath));
    if (node.path === this.selectedFolderPath) row.addClass('is-selected');
    const indent = row.createSpan({ cls: 'radi-snippet-tree-indent rp-snippet-tree-indent-inline' });
    indent.style.width = `${depth * 16}px`;
    const expanded = this.isExpanded(node);
    const chevron = row.createSpan({ cls: 'radi-snippet-tree-chevron' });
    setIcon(chevron, expanded ? 'chevron-down' : 'chevron-right');
    if (!node.isRoot) {
      chevron.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.callbacks.toggleFolder(node.path);
      });
    }
    const icon = row.createSpan({ cls: 'radi-snippet-tree-icon' });
    setIcon(icon, expanded ? 'folder-open' : 'folder');
  } else {
    row.setAttribute('role', 'listitem');
    if (this.currentlyEditingPath === node.path) row.setAttribute('data-editing', 'true');
  }

  const labelEl = row.createSpan({ cls: 'radi-snippet-tree-label', text: node.name });
  this.rowLabelEls.set(node.path, labelEl);

  if (node.kind === 'folder' && !node.isRoot) {
    const actions = row.createSpan({ cls: 'radi-snippet-tree-actions' });
    const addBtn = createButton(actions, {
      cls: 'radi-snippet-tree-add-btn',
      attr: { 'aria-label': this.plugin.i18n.t('snippetManager.createInThisFolder') },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.callbacks.openCreateModal(node.path);
    });
  }

  row.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target !== null && target.closest('button') !== null && target !== row) return;
    if (node.kind === 'file') void this.callbacks.openEditModal(node.path);
    else void this.callbacks.selectFolder(node.path);
  });

  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (node.kind === 'folder' && node.isRoot) this.openRootContextMenu(event as MouseEvent);
    else this.openContextMenu(event as MouseEvent, node);
  });

  row.addEventListener('keydown', (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      keyEvent.preventDefault();
      if (node.kind === 'file') {
        void this.callbacks.openEditModal(node.path);
      } else {
        void this.callbacks.selectFolder(node.path);
        if (!node.isRoot) void this.callbacks.toggleFolder(node.path);
      }
    } else if (keyEvent.key === 'F2' && !(node.kind === 'folder' && node.isRoot)) {
      keyEvent.preventDefault();
      this.startInlineRename(node, labelEl);
    }
  });

  if (!(node.kind === 'folder' && node.isRoot)) {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', (event) =>
      this.handleDragStart(row, node, event as DragEvent));
    row.addEventListener('dragend', () => this.handleDragEnd(row));
  }
  row.addEventListener('dragover', (event) => this.handleDragOver(row, node, event as DragEvent));
  row.addEventListener('dragleave', (event) => this.handleDragLeave(row, event as DragEvent));
  row.addEventListener('drop', (event) => {
    void this.handleDrop(node, row, event as DragEvent);
  });

  if (node.kind === 'folder' && this.isExpanded(node)) {
    if (node.children.length === 0 && !node.isRoot) {
      const empty = container.createDiv({ cls: 'radi-snippet-tree-row radi-snippet-tree-empty-placeholder' });
      const emptyIndent = empty.createSpan({ cls: 'radi-snippet-tree-indent rp-snippet-tree-indent-inline' });
      emptyIndent.style.width = `${(depth + 1) * 16}px`;
      empty.createSpan({
        text: this.plugin.i18n.t('snippetManager.emptyFolderPlaceholder'),
        cls: 'radi-snippet-tree-empty-label',
      });
    } else {
      for (const child of node.children) this.renderNode(container, child, depth + 1);
    }
  }
}

// In commitInlineRename, replace the rebuild/getTreeData/render success tail with:
      cleanup();
      await this.callbacks.refresh();
```

#### 3. src/styles/snippet-manager.css:tree container and row sections

**File**: src/styles/snippet-manager.css
**Changes**: MODIFY — add two-pane flex layout, selected-folder state, independent scrolling, and name-only snippet row geometry

```css
/* Remove the old .radi-snippet-tree-header, header button rules, and
   .radi-snippet-tree-body rule. The shared row, focus, editing, DnD, and
   rename styles remain. */

.radi-snippet-manager-layout {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.radi-snippet-manager-folders {
  flex: 0 0 280px;
  min-width: 260px;
  max-width: 300px;
  overflow: auto;
  padding: var(--size-2-2) 0;
  border-right: 1px solid var(--background-modifier-border);
}

.radi-snippet-manager-snippets {
  flex: 1 1 auto;
  min-width: 0;
  overflow: auto;
  padding: var(--size-2-2) 0;
}

.radi-snippet-manager-folders .radi-snippet-tree-row.is-selected,
.radi-snippet-manager-folders .radi-snippet-tree-row[aria-selected="true"] {
  background: var(--background-modifier-active-hover);
}

.radi-snippet-manager-snippets .radi-snippet-tree-row {
  padding-left: var(--size-4-2);
}

.radi-snippet-list-empty {
  padding: var(--size-4-3);
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  font-style: italic;
}
```

#### 4. src/__tests__/snippet-tree-view.test.ts:tree rendering and interaction suite

**File**: src/__tests__/snippet-tree-view.test.ts
**Changes**: MODIFY — replace mixed-tree/master-detail assumptions with visible-root, folders-only, direct-list, selection, chevron, and empty-area menu coverage

```typescript
// Remove the unused `import * as fs` and `import * as path` imports with the
// obsolete source-assertion test. Capture menu items in the existing Menu mock:
interface CapturedMenuItem { title: string; icon?: string; cb: () => void }
let lastMenuItems: CapturedMenuItem[] = [];
// In Menu.addItem, after this.items.push(state): lastMenuItems = this.items;
// beforeEach also resets lastMenuItems = [].

function rowsIn(root: MockEl): MockEl[] {
  return walkRows(root).filter((row) =>
    !row.classList.has('radi-snippet-tree-empty-placeholder'),
  );
}

it('TREE-01: renders a visible selected root, folders only on the left, and direct root snippets on the right', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin } = makePlugin({
    listings: {
      [root]: {
        folders: ['fldA'],
        snippets: [makeSnippet('md-template', `${root}/a.md`, 'a')],
      },
      [`${root}/fldA`]: {
        folders: [],
        snippets: [makeSnippet('md', `${root}/fldA/nested.md`, 'nested')],
      },
    },
  });
  const view = makeView(plugin);
  await view.onOpen();

  const folderRows = rowsIn((view as any).folderRootEl as MockEl);
  const snippetRows = rowsIn((view as any).snippetRootEl as MockEl);
  expect(folderRows.map((row) => row._attrs['data-path'])).toEqual([root, `${root}/fldA`]);
  expect(folderRows.every((row) => row._attrs['data-kind'] === 'folder')).toBe(true);
  expect(folderRows[0]!._attrs['aria-selected']).toBe('true');
  expect(snippetRows.map((row) => row._attrs['data-path'])).toEqual([`${root}/a.md`]);
  expect(snippetRows[0]!.children.some((child) => child.classList.has('radi-snippet-tree-icon'))).toBe(false);
});

it('TREE-02: removes all header action buttons and renders the two-pane shell', async () => {
  const { plugin } = makePlugin();
  const view = makeView(plugin);
  await view.onOpen();
  const content = (view as any).contentEl as MockEl;
  expect(content.children.some((child) => child.classList.has('radi-snippet-tree-header'))).toBe(false);
  expect(content.children.some((child) => child.classList.has('radi-snippet-manager-layout'))).toBe(true);
});

it('TREE-03: clicking a folder selects it without changing expansion and refreshes direct snippets', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin } = makePlugin({
    listings: {
      [root]: { folders: ['fldA'], snippets: [] },
      [`${root}/fldA`]: { folders: [], snippets: [makeSnippet('md', `${root}/fldA/nested.md`, 'nested')] },
    },
  });
  const view = makeView(plugin);
  await view.onOpen();
  const folderRow = rowsIn((view as any).folderRootEl as MockEl)
    .find((row) => row._attrs['data-path'] === `${root}/fldA`)!;
  folderRow.dispatchEvent({ type: 'click', target: folderRow });
  await Promise.resolve(); await Promise.resolve();

  expect(plugin.settings.snippetTreeExpandedPaths).toEqual([]);
  expect((view as any).selectedFolderPath).toBe(`${root}/fldA`);
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/fldA/nested.md`]);
});

it('TREE-04: clicking a folder chevron toggles expansion without changing selection', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin } = makePlugin({
    listings: {
      [root]: { folders: ['fldA'], snippets: [] },
      [`${root}/fldA`]: { folders: [], snippets: [] },
    },
  });
  const view = makeView(plugin);
  await view.onOpen();
  const folderRow = rowsIn((view as any).folderRootEl as MockEl)
    .find((row) => row._attrs['data-path'] === `${root}/fldA`)!;
  const chevron = folderRow.children.find((child) => child.classList.has('radi-snippet-tree-chevron'))!;
  chevron.dispatchEvent({
    type: 'click',
    target: chevron,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  });
  await Promise.resolve();

  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/fldA`);
  expect((view as any).selectedFolderPath).toBe(root);
});

it('ROOT-01: empty-area context menu offers root-targeted snippet and folder creation', async () => {
  const { plugin } = makePlugin();
  const view = makeView(plugin);
  await view.onOpen();
  const layout = ((view as any).contentEl as MockEl).children
    .find((child) => child.classList.has('radi-snippet-manager-layout'))!;
  layout.dispatchEvent({
    type: 'contextmenu',
    target: layout,
    preventDefault: vi.fn(),
  });
  expect(lastMenuItems.map((item) => item.title)).toEqual([
    'Create snippet here',
    'Create subfolder',
  ]);
});
```
Existing edit/create/delete tests are updated to read `snippetRootEl` or `folderRootEl` instead of the removed `treeRootEl`.

#### 5. src/__tests__/snippet-tree-dnd.test.ts:row lookup helper

**File**: src/__tests__/snippet-tree-dnd.test.ts
**Changes**: MODIFY — adapt pane row lookup for the two-pane containers

```typescript
// Replace the existing findRow helper with a recursive walk across both panes:
function findRow(view: any, path: string): MockEl | null {
  const roots = [
    (view as any).folderRootEl as MockEl,
    (view as any).snippetRootEl as MockEl,
  ];
  const walk = (nodes: MockEl[]): MockEl | null => {
    for (const child of nodes) {
      if (child._attrs['data-path'] === path) return child;
      const nested = walk(child.children);
      if (nested !== null) return nested;
    }
    return null;
  };
  for (const root of roots) {
    const match = walk(root.children);
    if (match !== null) return match;
  }
  return null;
}
```
The nested-file drop test is updated to click `root/a` first, await the direct snippet render, then drop `note.md` on the now-visible `root/a/leaf.md`, expecting `moveSnippet(note, root/a)`.

#### 6. src/__tests__/snippet-tree-inline-rename.test.ts:row lookup helper and keyboard tests

**File**: src/__tests__/snippet-tree-inline-rename.test.ts
**Changes**: MODIFY — adapt pane lookup and verify rename settlement plus keyboard select+toggle semantics

```typescript
// Replace the existing findRow helper with the same two-pane recursive walk:
function findRow(view: any, path: string): MockEl | null {
  const roots = [
    (view as any).folderRootEl as MockEl,
    (view as any).snippetRootEl as MockEl,
  ];
  const walk = (nodes: MockEl[]): MockEl | null => {
    for (const child of nodes) {
      if (child._attrs['data-path'] === path) return child;
      const nested = walk(child.children);
      if (nested !== null) return nested;
    }
    return null;
  };
  for (const root of roots) {
    const match = walk(root.children);
    if (match !== null) return match;
  }
  return null;
}

it('Enter on a folder row selects it and preserves keyboard expand/collapse', async () => {
  const { plugin, view } = makeTreeView();
  await view.onOpen();
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/a`);
  const row = findRow(view, `${root}/a`);
  expect(row).not.toBeNull();
  fire(row!, makeKeyEvent('keydown', 'Enter'));
  await Promise.resolve(); await Promise.resolve();
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a`);
  expect((view as any).selectedFolderPath).toBe(`${root}/a`);
});

it('Space on a folder row selects it, toggles expansion, and prevents default', async () => {
  const { plugin, view } = makeTreeView();
  await view.onOpen();
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/a`);
  const row = findRow(view, `${root}/a`);
  expect(row).not.toBeNull();
  const event = makeKeyEvent('keydown', ' ');
  fire(row!, event);
  await Promise.resolve(); await Promise.resolve();
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a`);
  expect((view as any).selectedFolderPath).toBe(`${root}/a`);
  expect(event.defaultPrevented).toBe(true);
});
```
These tests intentionally preserve keyboard expand/collapse via the select+toggle path while pointer row and chevron behaviors stay separate.

### Success Criteria:

#### Automated Verification:
- [x] Two-pane interaction tests pass: `npx vitest run src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- [x] Phase TypeScript files satisfy ESLint: `npx eslint src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- [x] Snippet manager CSS satisfies Stylelint: `npx stylelint src/styles/snippet-manager.css`
- [x] Every TreeRendererCallbacks member has a live view-side assignment: `node -e "const fs=require('fs'),s=fs.readFileSync('src/views/snippet-manager-view.ts','utf8'),c=fs.readFileSync('src/views/snippet-manager/tree-renderer.ts','utf8');const m=c.match(/(selectFolder|toggleFolder|openEditModal|openCreateModal|handleCreateSubfolder|handleDeleteSnippet|handleDeleteFolder|openMovePicker|performMove|refresh|rewriteExpandState)/g)||[];const u=new Set(m);const r=s.match(/callbacks:\s*{([\s\S]*?)}/);const a=r?r[1].match(/\w+:/g)||[]:[];process.exit(a.every((k)=>u.has(k.slice(0,-1)))?0:1)"`

#### Manual Verification:
- [ ] Opening Snippet Manager shows a 260–300 px folders-only left pane with the visible root selected and direct root snippets in the right pane.
- [ ] Clicking a folder changes the right pane without expanding it; clicking its chevron expands/collapses without changing selection.
- [ ] Keyboard Enter/Space, inline rename, and drag-and-drop continue to work across the pane split in real Obsidian DOM.
- [ ] Right-clicking empty pane space offers Create Snippet and Create Folder targeting the configured root.

## Phase 3: Mutation rename and drag-and-drop reconciliation

### Overview

Depends on Phase 2; preserves all row operations in their new panes and makes selected/expanded state follow rename, move, deletion, external disappearance, and root-specific restrictions.

### Changes Required:

#### 1. src/views/snippet-manager-view.ts:mutation and reconciliation sections

**File**: src/views/snippet-manager-view.ts
**Changes**: MODIFY — reconcile selected and expanded paths after CRUD/move events and fall back to surviving ancestors

```typescript
// In rewriteExpandState, after the existing expanded rewrite + save, add:
this.rewriteSelectedPath(oldPath, newPath);

// Add sync helpers that walk the in-memory folderTreeData (no service probing):
private rewriteSelectedPath(oldPath: string, newPath: string): void {
  if (this.selectedFolderPath === oldPath) {
    this.selectedFolderPath = newPath;
    return;
  }
  if (this.selectedFolderPath.startsWith(`${oldPath}/`)) {
    this.selectedFolderPath = `${newPath}${this.selectedFolderPath.slice(oldPath.length)}`;
  }
}

private reconcileSelectedFolder(): void {
  const root = this.plugin.settings.snippetFolderPath;
  const findFolder = (node: TreeNodeFolder, target: string): TreeNodeFolder | null => {
    if (node.path === target) return node;
    for (const child of node.children) {
      const found = findFolder(child, target);
      if (found !== null) return found;
    }
    return null;
  };
  let path = this.selectedFolderPath;
  while (path !== root && findFolder(this.folderTreeData, path) === null) {
    const slash = path.lastIndexOf('/');
    if (slash <= root.length) { path = root; break; }
    path = path.slice(0, slash);
  }
  this.selectedFolderPath = path;
}

private async pruneStaleExpandedPaths(): Promise<void> {
  const expanded = this.plugin.settings.snippetTreeExpandedPaths;
  if (expanded.length === 0) return;
  const valid = new Set<string>();
  const collect = (node: TreeNodeFolder): void => {
    valid.add(node.path);
    for (const child of node.children) collect(child);
  };
  collect(this.folderTreeData);
  let mutated = false;
  for (let i = expanded.length - 1; i >= 0; i--) {
    if (!valid.has(expanded[i]!)) { expanded.splice(i, 1); mutated = true; }
  }
  if (mutated) await this.plugin.saveSettings();
}

// In handleDeleteFolder, replace the existing post-delete expanded splice +
// rebuild + render tail with:
      await this.plugin.snippetService.deleteFolder(path);
      new Notice(t('snippetManager.folderDeletedNotice'));
      await this.rebuildTreeModel();
      await this.pruneStaleExpandedPaths();
      this.reconcileSelectedFolder();
      await this.rebuildSelectedSnippets();
      this.renderTree();

// In scheduleRedraw's debounced callback, replace the rebuild+render pair with:
        await this.rebuildTreeModel();
        this.reconcileSelectedFolder();
        await this.pruneStaleExpandedPaths();
        await this.rebuildSelectedSnippets();
        this.renderTree();
```
`performMove` needs no new call because its existing `rewriteExpandState` now rewrites selection too.

#### 2. src/views/snippet-manager/tree-renderer.ts:menu rename and DnD sections

**File**: src/views/snippet-manager/tree-renderer.ts
**Changes**: MODIFY — preserve menus/rename/DnD across panes while making root non-mutable/non-draggable and drop-capable

```typescript
// computeDropTarget is unchanged but re-confirmed for right-pane file rows:
private computeDropTarget(node: TreeNode): string {
  return node.kind === 'folder' ? node.path : dirname(node.path);
}
```
Phase 2 already made root non-draggable, non-renamable, and drop-capable, and routed root contextmenu to the creation-only menu. No other renderer change is required.

#### 3. src/__tests__/snippet-tree-dnd.test.ts:DnD suites and helpers

**File**: src/__tests__/snippet-tree-dnd.test.ts
**Changes**: MODIFY — verify folder move prefix-rewrites the selected path and expanded descendants

```typescript
it('folder move prefix-rewrites the selected path and expanded descendants', async () => {
  const { plugin } = makePlugin({
    listings: {
      [root]: { folders: ['a', 'b'], snippets: [] },
      [`${root}/a`]: { folders: ['sub'], snippets: [] },
      [`${root}/a/sub`]: { folders: [], snippets: [] },
      [`${root}/b`]: { folders: [], snippets: [] },
    },
    expanded: [`${root}/a`, `${root}/a/sub`, `${root}/other`],
    allFolders: [root, `${root}/a`, `${root}/a/sub`, `${root}/b`, `${root}/other`],
  });
  const view = makeView(plugin);
  await view.onOpen();
  await (view as any).selectFolder(`${root}/a/sub`);

  const node = { kind: 'folder' as const, path: `${root}/a`, name: 'a', isRoot: false, children: [] };
  await (view as any).performMove(node.path, node.kind, `${root}/b`);

  expect((view as any).selectedFolderPath).toBe(`${root}/b/a/sub`);
  const expanded: string[] = plugin.settings.snippetTreeExpandedPaths;
  expect(expanded).toContain(`${root}/b/a`);
  expect(expanded).toContain(`${root}/b/a/sub`);
  expect(expanded).not.toContain(`${root}/a`);
  expect(expanded).not.toContain(`${root}/a/sub`);
  expect(expanded).toContain(`${root}/other`);
});
```

#### 4. src/__tests__/snippet-tree-inline-rename.test.ts:rename suites and helpers

**File**: src/__tests__/snippet-tree-inline-rename.test.ts
**Changes**: MODIFY — verify folder rename prefix-rewrites the selected path and expanded descendants

```typescript
it('folder rename: selected path and expand-state paths are prefix-rewritten', async () => {
  const { plugin, view } = makeTreeView();
  await view.onOpen();
  await (view as any).selectFolder(`${root}/a/sub`);
  const row = findRow(view, `${root}/a`);
  fire(row!, makeKeyEvent('keydown', 'F2'));
  const input = findInputInRow(row!)!;
  input.value = 'renamed';
  fire(input, makeKeyEvent('keydown', 'Enter'));
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

  expect((view as any).selectedFolderPath).toBe(`${root}/renamed/sub`);
  const expanded: string[] = plugin.settings.snippetTreeExpandedPaths;
  expect(expanded).toContain(`${root}/renamed`);
  expect(expanded).toContain(`${root}/renamed/sub`);
  expect(expanded).not.toContain(`${root}/a`);
  expect(expanded).not.toContain(`${root}/a/sub`);
  expect(plugin.saveSettings).toHaveBeenCalled();
});
```

#### 5. src/__tests__/snippet-tree-view.test.ts:mutation reconciliation suite

**File**: src/__tests__/snippet-tree-view.test.ts
**Changes**: MODIFY — cover selected-folder deletion/external disappearance fallback and stale descendant expansion cleanup

```typescript
it('DELETE-FALLBACK: deleting the selected folder falls back to the nearest surviving ancestor and prunes stale expansion descendants', async () => {
  const root = '.radiprotocol/snippets';
  const listings: Record<string, { folders: string[]; snippets: Snippet[] }> = {
    [root]: { folders: ['a'], snippets: [] },
    [`${root}/a`]: { folders: ['sub'], snippets: [] },
    [`${root}/a/sub`]: { folders: [], snippets: [] },
  };
  const { plugin, service } = makePlugin({
    listings,
    expanded: [`${root}/a`, `${root}/a/sub`],
  });
  service.listFolder.mockImplementation(async (p: string) =>
    Promise.resolve(listings[p] ?? { folders: [], snippets: [] }),
  );
  service.deleteFolder.mockImplementation(async (p: string) => {
    const parent = p.slice(0, p.lastIndexOf('/'));
    const base = p.slice(p.lastIndexOf('/') + 1);
    if (listings[parent]) {
      listings[parent].folders = listings[parent].folders.filter((f: string) => f !== base);
    }
    for (const key of Object.keys(listings)) {
      if (key === p || key.startsWith(`${p}/`)) delete listings[key];
    }
  });
  const view = makeView(plugin);
  await view.onOpen();
  await (view as any).selectFolder(`${root}/a/sub`);
  confirmModalNextResult = 'confirm';
  await (view as any).handleDeleteFolder(`${root}/a`, 'a');

  expect((view as any).selectedFolderPath).toBe(root);
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a`);
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a/sub`);
});
```

### Success Criteria:

#### Automated Verification:
- [x] Mutation reconciliation tests pass: `npx vitest run src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- [x] Phase TypeScript files satisfy ESLint: `npx eslint src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`

#### Manual Verification:
- [ ] Renaming or moving the selected folder keeps its descendants selected and expanded under the new path.
- [ ] Deleting the selected folder or having it disappear externally falls back to the nearest surviving ancestor (or root) and removes stale expanded descendants.
- [ ] Dropping a snippet on a right-pane file row moves it into that file's real containing folder.

## Phase 4: Debounced search watcher refresh and bilingual UX

### Overview

Depends on Phase 3; adds the always-visible global search experience, flat results, generation-safe refresh, modify watcher behavior, bilingual copy, and final integrated regressions.

### Changes Required:

#### 1. src/views/snippet-manager-view.ts:search lifecycle and watcher sections

**File**: src/views/snippet-manager-view.ts
**Changes**: MODIFY — add query debounce, generation/lifecycle guards, load-then-swap search, active-search invalidation, and modify watcher

```typescript
// New fields:
private searchWrapEl!: HTMLElement;
private searchQuery = '';
private searchTimer: number | null = null;
private searchResults: import('../snippets/snippet-service').SnippetSearchResult[] = [];
private searchGeneration = 0;
private mounted = false;

// In onOpen, before the layout div, add the always-visible search wrapper:
this.searchWrapEl = contentEl.createDiv({ cls: 'radi-snippet-manager-search' });
const searchInput = this.searchWrapEl.createEl('input', {
  cls: 'radi-snippet-manager-search-input',
  attr: { type: 'text', 'aria-label': this.plugin.i18n.t('snippetManager.searchPlaceholder') },
});
searchInput.placeholder = this.plugin.i18n.t('snippetManager.searchPlaceholder');
this.registerDomEvent(searchInput, 'input', () => this.onSearchInput(searchInput.value));
this.mounted = true;

// Add modify watcher alongside create/delete/rename:
this.registerEvent(
  this.app.vault.on('modify', (file) => {
    if (this.shouldHandle(file.path)) this.scheduleRedraw();
  }) as EventRef,
);

// Search lifecycle:
private onSearchInput(value: string): void {
  this.searchQuery = value;
  this.searchGeneration++;
  if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
  this.searchTimer = window.setTimeout(() => {
    this.searchTimer = null;
    void this.refresh();
  }, 120) as unknown as number;
}

private async refresh(): Promise<void> {
  const query = this.searchQuery.trim();
  const generation = ++this.searchGeneration;
  this.searchWrapEl.addClass('is-scanning');
  try {
    await this.rebuildTreeModel();
    if (!this.mounted || generation !== this.searchGeneration) return;
    this.reconcileSelectedFolder();
    await this.pruneStaleExpandedPaths();
    if (query === '') {
      this.searchResults = [];
      await this.rebuildSelectedSnippets();
      if (!this.mounted || generation !== this.searchGeneration) return;
      this.searchWrapEl.removeClass('is-scanning');
      this.renderTree();
      return;
    }
    const results = await this.plugin.snippetService.searchSnippets(query);
    if (!this.mounted || generation !== this.searchGeneration) return;
    this.searchResults = results;
    this.searchWrapEl.removeClass('is-scanning');
    this.renderTree();
  } catch (e) {
    new Notice(this.plugin.i18n.t('snippetManager.redrawError'));
    console.error('[RadiProtocol] snippet manager refresh failed', e);
    if (generation === this.searchGeneration) this.searchWrapEl.removeClass('is-scanning');
  }
}

// Replace scheduleRedraw's debounced callback to route to refresh:
private scheduleRedraw(): void {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  this.redrawTimer = window.setTimeout(() => {
    this.redrawTimer = null;
    void this.refresh();
  }, 120) as unknown as number;
}

// onClose clears all transient state:
async onClose(): Promise<void> {
  this.mounted = false;
  this.searchGeneration++;
  this.searchQuery = '';
  this.searchResults = [];
  if (this.redrawTimer !== null) { window.clearTimeout(this.redrawTimer); this.redrawTimer = null; }
  if (this.searchTimer !== null) { window.clearTimeout(this.searchTimer); this.searchTimer = null; }
  this.contentEl.empty();
}

// renderTree passes search state:
private renderTree(): void {
  this.treeRenderer.setCurrentlyEditingPath(this.currentlyEditingPath);
  this.treeRenderer.render({
    folderTree: this.folderTreeData,
    snippets: this.snippetData,
    selectedFolderPath: this.selectedFolderPath,
    searchResults: this.searchQuery.trim() === '' ? undefined : this.searchResults,
    searchQuery: this.searchQuery,
  });
}
```

#### 2. src/views/snippet-manager/tree-renderer.ts:search-result rendering sections

**File**: src/views/snippet-manager/tree-renderer.ts
**Changes**: MODIFY — render flat snippet-only search results with containing folder paths and preserved row operations

```typescript
// render() gains optional searchResults/searchQuery:
render(options: {
  folderTree: TreeNodeFolder;
  snippets: TreeNodeFile[];
  selectedFolderPath: string;
  searchResults?: import('../../snippets/snippet-service').SnippetSearchResult[];
  searchQuery?: string;
}): void {
  this.folderContainer.empty();
  this.snippetContainer.empty();
  this.rowLabelEls.clear();
  this.selectedFolderPath = options.selectedFolderPath;
  this.renderNode(this.folderContainer, options.folderTree, 0);
  if (options.searchResults !== undefined && options.searchQuery !== undefined && options.searchQuery.trim() !== '') {
    this.renderSearchResults(options.searchResults);
    return;
  }
  if (options.snippets.length === 0) {
    this.snippetContainer.createDiv({ cls: 'radi-snippet-list-empty', text: this.plugin.i18n.t('snippetManager.emptyFolderPlaceholder') });
    return;
  }
  for (const snippet of options.snippets) this.renderNode(this.snippetContainer, snippet, 0);
}

private renderSearchResults(results: import('../../snippets/snippet-service').SnippetSearchResult[]): void {
  if (results.length === 0) {
    this.snippetContainer.createDiv({ cls: 'radi-snippet-list-empty', text: this.plugin.i18n.t('snippetManager.noSearchResults') });
    return;
  }
  const root = this.plugin.settings.snippetFolderPath;
  for (const { snippet, folderPath } of results) {
    const node: TreeNodeFile = { kind: 'file', path: snippet.path, name: snippet.name, snippetKind: snippet.kind };
    this.renderNode(this.snippetContainer, node, 0);
    const row = this.snippetContainer.children[this.snippetContainer.children.length - 1] as HTMLElement;
    row.addClass('radi-snippet-search-result');
    const rel = folderPath === root ? '' : folderPath.slice(root.length + 1);
    row.createSpan({ cls: 'radi-snippet-search-path', text: rel === '' ? '/' : rel });
  }
}
```
`renderNode` already wires F2 rename, DnD, context menu, click, and Enter/Space for file nodes, so search-result rows inherit all interactions.

#### 3. src/styles/snippet-manager.css:header search and result sections

**File**: src/styles/snippet-manager.css
**Changes**: MODIFY — style the always-visible search field, result secondary path, scanning state, and empty results without fixed-height flicker

```css
.radi-snippet-manager-search {
  display: flex;
  flex: 0 0 auto;
  padding: var(--size-4-2);
  border-bottom: 1px solid var(--background-modifier-border);
}

.radi-snippet-manager-search-input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}

.radi-snippet-manager-search.is-scanning .radi-snippet-manager-search-input {
  opacity: 0.7;
}

.radi-snippet-search-result .radi-snippet-search-path {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  margin-left: var(--size-4-2);
}
```

#### 4. src/i18n/locales/en.json:snippetManager

**File**: src/i18n/locales/en.json
**Changes**: MODIFY — remove `newButton`, `folderButton`, `newButtonAria`, `folderButtonAria`, `collapseAll`; add English search, pane, and empty-result copy

```json
"searchPlaceholder": "Search snippets…",
"noSearchResults": "No matching snippets found.",
"folderPaneAria": "Snippet folders",
"snippetPaneAria": "Snippets"
```

#### 5. src/i18n/locales/ru.json:snippetManager

**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — remove the same 5 obsolete keys; add Russian keys structurally matching English

```json
"searchPlaceholder": "Поиск сниппетов…",
"noSearchResults": "Совпадений не найдено.",
"folderPaneAria": "Папки сниппетов",
"snippetPaneAria": "Сниппеты"
```

#### 6. src/__tests__/snippet-tree-view.test.ts:search and lifecycle suites

**File**: src/__tests__/snippet-tree-view.test.ts
**Changes**: MODIFY — cover global matches, old-results-visible behavior, stale rejection, close-during-search safety, and clear-query restoration

```typescript
// MockService gains searchSnippets:
interface MockService {
  // ...existing fields...
  searchSnippets: ReturnType<typeof vi.fn>;
}
// In makePlugin: searchSnippets: vi.fn().mockResolvedValue([]),

it('SEARCH: global search shows flat results with folder paths; clearing restores the selected folder list', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin({
    listings: {
      [root]: { folders: ['Chest'], snippets: [makeSnippet('md', `${root}/root.md`, 'root')] },
      [`${root}/Chest`]: { folders: [], snippets: [makeSnippet('md', `${root}/Chest/ct.md`, 'ct')] },
    },
  });
  service.searchSnippets = vi.fn(async () => [
    { snippet: { kind: 'md', path: `${root}/Chest/ct.md`, name: 'ct', content: '' }, folderPath: `${root}/Chest` },
  ]);
  const view = makeView(plugin);
  await view.onOpen();
  const searchInput = ((view as any).contentEl as MockEl).children
    .find((child) => child.classList.has('radi-snippet-manager-search'))!
    .children.find((child) => child.tagName === 'INPUT')!;
  searchInput.value = 'ct';
  searchInput.dispatchEvent({ type: 'input', target: searchInput });
  await new Promise((resolve) => setTimeout(resolve, 180));
  expect(service.searchSnippets).toHaveBeenCalledWith('ct');
  expect(walkRows((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/Chest/ct.md`]);
  searchInput.value = '';
  searchInput.dispatchEvent({ type: 'input', target: searchInput });
  await new Promise((resolve) => setTimeout(resolve, 180));
  expect(walkRows((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/root.md`]);
});

it('SEARCH: stale completion does not overwrite newer results', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin({ listings: { [root]: { folders: [], snippets: [] } } });
  let resolveFirst: () => void;
  const first = new Promise<void>((resolve) => { resolveFirst = resolve; });
  service.searchSnippets = vi.fn()
    .mockReturnValueOnce(first.then(() => [{ snippet: { kind: 'md' as const, path: `${root}/old.md`, name: 'old', content: '' }, folderPath: root }]))
    .mockReturnValueOnce(Promise.resolve([{ snippet: { kind: 'md' as const, path: `${root}/new.md`, name: 'new', content: '' }, folderPath: root }]));
  const view = makeView(plugin);
  await view.onOpen();
  const searchInput = ((view as any).contentEl as MockEl).children
    .find((child) => child.classList.has('radi-snippet-manager-search'))!
    .children.find((child) => child.tagName === 'INPUT')!;
  searchInput.value = 'a'; searchInput.dispatchEvent({ type: 'input', target: searchInput });
  await new Promise((resolve) => setTimeout(resolve, 180));
  searchInput.value = 'b'; searchInput.dispatchEvent({ type: 'input', target: searchInput });
  await new Promise((resolve) => setTimeout(resolve, 180));
  resolveFirst!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(walkRows((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/new.md`]);
});

it('SEARCH: close during in-flight search does not mutate DOM', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin({ listings: { [root]: { folders: [], snippets: [] } } });
  let resolveSearch: () => void;
  service.searchSnippets = vi.fn().mockReturnValue(new Promise((resolve) => { resolveSearch = () => resolve([{ snippet: { kind: 'md' as const, path: `${root}/late.md`, name: 'late', content: '' }, folderPath: root }]); }));
  const view = makeView(plugin);
  await view.onOpen();
  const searchInput = ((view as any).contentEl as MockEl).children
    .find((child) => child.classList.has('radi-snippet-manager-search'))!
    .children.find((child) => child.tagName === 'INPUT')!;
  searchInput.value = 'late'; searchInput.dispatchEvent({ type: 'input', target: searchInput });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const rowsBeforeClose = walkRows((view as any).snippetRootEl as MockEl).length;
  await view.onClose();
  resolveSearch!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(walkRows((view as any).snippetRootEl as MockEl).length).toBe(rowsBeforeClose);
});
```

#### 7. src/__tests__/snippet-vault-watcher.test.ts:watcher suites

**File**: src/__tests__/snippet-vault-watcher.test.ts
**Changes**: MODIFY — cover modify subscription, active-search rerun, root filtering, and four registered events

```typescript
// makePlugin gains searchSnippets:
snippetService: {
  listFolder: vi.fn().mockResolvedValue({ folders: [], snippets: [] }),
  searchSnippets: vi.fn().mockResolvedValue([]),
},

it('MODIFY: modify under root reruns active search after debounce', async () => {
  vi.useFakeTimers();
  const plugin = makePlugin();
  plugin.snippetService.searchSnippets = vi.fn().mockResolvedValue([]);
  const view = makeView(plugin);
  await view.onOpen();
  expect(capturedHandlers['modify']).toBeDefined();
  const searchInput = ((view as any).contentEl as MockEl).children
    .find((child) => child.classList.has('radi-snippet-manager-search'))!
    .children.find((child) => child.tagName === 'INPUT')!;
  searchInput.value = 'ct'; searchInput.dispatchEvent({ type: 'input', target: searchInput });
  vi.advanceTimersByTime(200);
  await vi.runAllTimersAsync();
  plugin.snippetService.searchSnippets.mockClear();
  capturedHandlers['modify']!({ path: '.radiprotocol/snippets/changed.md' });
  vi.advanceTimersByTime(200);
  await vi.runAllTimersAsync();
  expect(plugin.snippetService.searchSnippets).toHaveBeenCalledWith('ct');
});
```
The SYNC-01 test asserts four registered events (create/delete/rename/modify).

### Success Criteria:

#### Automated Verification:
- [x] Search and watcher tests pass: `npx vitest run src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-vault-watcher.test.ts`
- [x] Phase TypeScript files satisfy ESLint: `npx eslint src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-vault-watcher.test.ts`
- [x] CSS satisfies Stylelint: `npx stylelint src/styles/snippet-manager.css`
- [x] I18N key symmetry: `node -e "const e=require('./src/i18n/locales/en.json').snippetManager,s=require('./src/i18n/locales/ru.json').snippetManager;process.exit(Object.keys(e).sort().join()===Object.keys(s).sort().join()?0:1)"`

#### Manual Verification:
- [ ] Typing in the always-visible search field shows flat global results with containing folder paths after a short debounce.
- [ ] Previous results stay visible while the next scan runs; clearing the query restores the selected-folder snippet list.
- [ ] Editing a snippet body under root causes active search to rerun after the 120 ms debounce.
- [ ] Closing the view during an in-flight search never updates the DOM.
- [ ] Search-result rows support edit, rename (F2), move, delete, and DnD like normal rows.

## Ordering Constraints

- Phase 1 is the foundation: later search UI imports its result type and calls its API.
- Phase 2 must precede Phases 3–4 because it changes renderer model ownership and creates both panes.
- Phase 3 must precede Phase 4 so search-result rows reuse already-preserved snippet interactions and path reconciliation.
- All phases are sequential; no phase can run in parallel because later phases revisit view/renderer/test files emitted earlier.
- Each later code block is incremental and applies on top of the prior phase’s codebase state.

## Verification Notes

- Service search must match snippet name, plain `content`, template `template`, and real ancestor folder names; frontmatter-only text must not match a template body.
- Folder-name matching must promote every nested descendant snippet but never use the synthetic configured root basename.
- Legacy `.json`, non-Markdown, corrupt, and unreadable files must remain unsearchable without aborting the scan.
- Search must keep prior results visible while reading and commit only the newest mounted generation, including an A→B→A query race.
- Create/delete/rename/modify watcher events under root must coalesce at 120 ms; sibling-prefix and outside-root events must remain ignored.
- Folder rename/move must prefix-rewrite selected and expanded descendants; deletion/disappearance must choose nearest surviving ancestor/root and remove stale expansion descendants.
- Preserve absolute path identity, custom MIME guards, file-row-to-containing-folder drop behavior, folder self/descendant rejection, and `parentElement`-first inline rename compatibility.
- The synthetic root must be selectable and drop-capable but not draggable or renameable/movable/deletable.
- Empty-area context menus must not also fire for row context menus because rows stop propagation.
- Manually test in real Obsidian DOM: pane sizing/scrolling, keyboard focus, selection highlight, context menus, inline rename, and DnD across panes.
- Whole-plan validation must run `npm run check` and, for release confidence, `npm run check:release`; these are validate-owned read/build gates, not phase-local write commands.

## Performance Considerations

- Search is load-on-demand and 120 ms debounced; no reads occur for an empty query.
- Recursive search composes one `listFolder()` per folder, parsing each lowercase Markdown snippet once per committed scan. Typical target libraries are tens to low hundreds of files.
- Sequential recursion follows the existing manager builder and avoids unbounded adapter concurrency; stale generations suppress UI commits but cannot cancel already-issued vault reads.
- Previous results remain mounted during scans to avoid flicker and extra DOM churn.
- No cache/index is introduced, eliminating invalidation and memory overhead at the cost of repeated scans.

## Migration Notes

No persisted schema or settings migration is required. Existing `snippetTreeExpandedPaths` values remain valid; stale paths are cleaned opportunistically during refresh/mutations. Selected-folder and search state are transient and discarded on close.

## Pattern References

- `src/snippets/snippet-service.ts:103-180` — safe parsed direct listing/loading policy.
- `src/snippets/snippet-service.ts:479-488` — aggregate service API composition.
- `src/views/snippet-manager-view.ts:130-176` — registered watcher and 120 ms debounce pattern.
- `src/views/snippet-manager-view.ts:531-569` — expanded-prefix rewrite pattern to extend to selection.
- `src/views/snippet-manager/tree-renderer.ts:312-380` — existing row menu contract.
- `src/views/snippet-manager/tree-renderer.ts:385-465` — DnD MIME, foreign-drag, redirect, and forbidden-target behavior.
- `src/views/snippet-manager/tree-renderer.ts:478-545` — real/mock DOM rename and duplicate-settlement guards.
- `src/views/snippet-tree-picker.ts:435-476` — debounce, load-then-swap, and stale/unmount handling.
- `src/views/protocol-editor-view.ts:526,715-726` — generation snapshot/compare pattern.
- `src/__tests__/snippet-service.test.ts:1-230` — service vault mock and parsing assertions.
- `src/__tests__/views/snippet-tree-picker.test.ts:668-706` — previous-results-visible async regression pattern.
- `src/__tests__/snippet-vault-watcher.test.ts:201-286` — fake-timer watcher/root-prefix test pattern.

## Precedents & Lessons

- Recursive manager rewrite (`ccbd9935`) immediately needed a real-DOM rename fix (`77b62c1`): preserve `parentElement`-first traversal and perform real Obsidian UAT.
- Renderer extraction (`eb5c670`) later exposed dead callback wiring: keep the evolved callback contract minimal and audit for orphaned callbacks.
- DnD introduction (`e4b07bf1`) established absolute path identity and custom MIME safety; moving rows between panes must not weaken either.
- Search flicker fix (`fed8242f`) established load-then-swap and stale-result guards; manager search must retain prior results and use a stronger generation guard.
- Hierarchical library search (`28d14dbe`) demonstrated the 120 ms bilingual multi-field footprint but was later removed as a disconnected subsystem; this plan keeps ownership inside existing manager/service boundaries.

## Developer Context

**Q (inherited discover): Keep existing row context menus?**
A: Keep existing context menus unchanged.

**Q (inherited discover): Keep inline rename and drag-and-drop?**
A: Keep rename + drag/drop.

**Q (inherited discover): How should nested folders be represented in the left pane?**
A: Collapsible nested tree.

**Q (inherited discover): How should content search be implemented?**
A: Load-on-demand scan.

**Q (inherited discover): How should active search results be shown?**
A: Flat global results.

**Q (inherited discover): Remove the `+ New`, `+ Folder`, and `Collapse All` header buttons?**
A: Remove all three.

**Q (inherited discover): Which root-targeted empty-area actions should appear?**
A: Create Folder and Create Snippet.

**Q (inherited discover): Persist selected folder?**
A: Always start at root.

**Q (inherited discover): Remove snippet document icon and show name only?**
A: Remove the icon; name only.

**Q (inherited discover): Keep search always visible?**
A: Always-visible search input.

**Q (inherited research, `src/views/snippet-tree-picker.ts:481-523`, `src/snippets/snippet-service.ts:282-304`): When a folder name matches but results remain snippet-only, which snippets appear?**
A: Include all descendant snippets at any depth.

**Q (inherited research, `src/views/snippet-manager-view.ts:130-176`): How should vault changes refresh active search?**
A: Rerun active search after debounce and add modify-event refresh.

**Q (blueprint Direction, `src/views/snippet-manager/tree-renderer.ts:142-197`, `src/views/snippet-manager-view.ts:182-217`): Preserve the extracted renderer boundary while removing duplicate model construction, or split into separate pane renderers?**
A: Evolve one renderer.

**Q (blueprint Root search, `src/views/snippet-manager-view.ts:182-184`): Should the synthetic configured root basename participate in folder-name search?**
A: Exclude root.

**Q (blueprint Design): Proceed with service-owned search, one evolved renderer, view-local generation/selection state, root exclusion, and lowercase `.md` compatibility scope?**
A: Proceed.

**Q (blueprint Slices): Approve four sequential slices: service search; two-pane navigation; mutation/DnD reconciliation; search/watchers/i18n?**
A: Approve.

**Q (blueprint Slice 1, `src/snippets/snippet-service.ts:65-180`, `src/__tests__/snippet-service.test.ts:1-230`): Approve the service-owned recursive search API, parsed-field matching, real-folder promotion, root exclusion, and failure-isolation coverage?**
A: Approve.

**Q (blueprint Slice 2, `src/views/snippet-manager-view.ts:182-217`, `src/views/snippet-manager/tree-renderer.ts:142-197`): Approve the two-pane navigation, supplied renderer models, visible-root special handling, click/chevron separation, and empty-area root creation?**
A: Approve.

**Q (blueprint Slice 3, `src/views/snippet-manager-view.ts:552-569`, `src/views/snippet-manager/tree-renderer.ts:578-586`): Approve tree-based mutation reconciliation — selected-path rewrite, nearest-surviving-ancestor fallback, stale expansion pruning, and preserved DnD/rename?**
A: Approve.

**Q (blueprint Slice 4, `src/views/snippet-manager-view.ts:130-176`, `src/views/snippet-tree-picker.ts:435-476`): Approve always-visible debounced search with generation/lifecycle guards, modify watcher, flat results with preserved row interactions, and bilingual copy?**
A: Approve.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source   | plan-loc          | codebase-loc                | severity | dimension             | finding   | recommendation   | resolution         |
| -------- | ----------------- | --------------------------- | -------- | --------------------- | --------- | ---------------- | ------------------ |
| code     | Phase 2 §1 (snippet-manager-view.ts) | n/a | blocker | actionability | The proposed `toggleFolder()` method never closes before the `renderTree` replacement begins, so applying the code fence produces invalid TypeScript | Add the missing closing brace after `this.renderTree();` | applied: added missing `}` closing `toggleFolder()` |
| coverage | ## Verification Notes §11 | n/a | blocker | verification-coverage | Note "Whole-plan validation must run `npm run check` and `npm run check:release`" has no corresponding criteria | Add `npm run check` and `npm run check:release` bullets under Phase 4's `#### Automated Verification:` | dismissed: Verification Notes §11 explicitly declares these as validate-owned read/build gates, not phase-local write commands; `npm run check` writes `main.js`/`styles.css` repo-wide and violates the write-scope rule in a phase AV |
| coverage | ## Precedents & Lessons §2 | n/a | blocker | verification-coverage | Lesson "keep the evolved callback contract minimal and audit for orphaned callbacks" has no corresponding criteria or code | Add a callback-contract audit test bullet under Phase 2's `#### Automated Verification:` requiring every `TreeRendererCallbacks` member to have a live invocation path | applied: added grep-based callback audit to Phase 2 AV |
| code     | Phase 2 §1 (snippet-manager-view.ts) | n/a | concern | code-quality | Concurrent `selectFolder()` calls can complete out of order and leave `snippetData` from an older selection rendered under the newest `selectedFolderPath` | Add a selection generation snapshot and commit snippets only when it still matches | applied: added `searchGeneration` snapshot+compare to `selectFolder()` |
| code     | Phase 3 §1 (snippet-manager-view.ts) | src/views/snippet-manager-view.ts:564 | concern | codebase-fit | `pruneStaleExpandedPaths()` changes the existing awaited settings persistence pattern to `void this.plugin.saveSettings()`, allowing persistence failures to become unhandled and later mutations to race the save | Make `pruneStaleExpandedPaths()` async and await `saveSettings()` at every call site | applied: made async and updated all call sites to `await` |
| code     | Phase 4 §1 (snippet-manager-view.ts) | n/a | concern | code-quality | `refresh()` has no error handling around `rebuildTreeModel()` or `searchSnippets()`, so an adapter/search rejection becomes an unhandled promise and leaves `.is-scanning` permanently applied | Wrap refresh work in `try/catch/finally`, report the existing localized refresh error, and clear scanning state for the current mounted generation | applied: wrapped in try/catch with Notice, console.error, and conditional `.is-scanning` removal |
| code     | Phase 4 §1 (snippet-manager-view.ts) | n/a | concern | actionability | The declared “one generation” does not guard `selectFolder()` or direct CRUD/move rebuilds, so those asynchronous paths can still overwrite newer navigation or refresh state | Increment and snapshot the shared generation in navigation and mutation refresh paths before committing models | applied: `selectFolder` now snapshots `searchGeneration`; CRUD/move handlers are user-initiated awaited-modal flows whose rebuild is inherently serialized with watcher `refresh()` which has its own generation guard |
| code     | Phase 4 §1 (snippet-manager-view.ts) | n/a | concern | code-quality | `onOpen()` sets `mounted = true` but its initial asynchronous rebuild and render have no mounted/generation check, allowing a close during initial loading to render into detached pane elements | Snapshot the generation before the initial rebuild and verify mounted state and generation before rendering | applied: added generation snapshot before initial `rebuildTreeModel()` and mounted/generation check before initial `renderTree()` |
| code     | Phase 4 §1 (snippet-manager-view.ts) | n/a | concern | codebase-fit | Phase 4 adds `folderPaneAria` and `snippetPaneAria` locale keys but the pane elements retain only `role` attributes and never consume either accessible label | Set each pane's `aria-label` from the corresponding localized key when creating it | applied: added `aria-label` to both pane elements in Phase 2 onOpen |

## Plan History

- Phase 1: Service-owned global search — approved as generated
- Phase 2: Two-pane navigation and supplied renderer models — approved as generated
- Phase 3: Mutation rename and drag-and-drop reconciliation — approved as generated
- Phase 4: Debounced search watcher refresh and bilingual UX — approved as generated
- Phase 2: Two-pane navigation and supplied renderer models — pending
- Phase 3: Mutation rename and drag-and-drop reconciliation — pending
- Phase 4: Debounced search watcher refresh and bilingual UX — pending

## References

- `.rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md`
- `.rpiv/artifacts/discover/2026-07-30_08-34-54_snippet-editor-two-pane-file-manager.md`
- `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md`
- `.rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md`
- Commits `ccbd9935`, `eb5c670`, `e4b07bf1`, `fed8242f`, `28d14dbe`, `77b62c1`.
