---
date: 2026-07-30T12:33:56+0300
author: Roman Shulgha
commit: 9e99e9d
branch: main
repository: RadiProtocol
topic: "Snippet Manager validation race and mutation fixes"
tags: [plan, snippets, snippet-manager, validation-fix, async, race-condition]
status: ready
parent: .rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md
phase_count: 2
phases:
  - { n: 1, title: Atomic async model ownership, files: [src/views/snippet-manager-view.ts, src/__tests__/snippet-tree-view.test.ts], depends_on: [] }
  - { n: 2, title: Guarded mutation completion and sync recovery, files: [src/views/snippet-manager-view.ts, src/views/snippet-manager/tree-renderer.ts, src/__tests__/snippet-tree-view.test.ts, src/__tests__/snippet-tree-dnd.test.ts, src/__tests__/snippet-tree-inline-rename.test.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json], depends_on: [1] }
unresolved_phase_count: 0
last_updated: 2026-07-30T17:39:45+0300
last_updated_by: Roman Shulgha
---

# Snippet Manager Validation Race and Mutation Fixes Implementation Plan

## Overview

Correct the failed two-pane Snippet Manager validation by making one mounted generation the exclusive owner of model commits, search scanning state, errors, and rendering. All navigation and mutation completions will use that guarded refresh path, while successful folder storage mutations reconcile UI paths before protocol-reference synchronization is attempted independently.

## Requirements

- Build folder trees, selected-folder snippet rows, and search results in local values rather than mutating shared view fields during asynchronous reads.
- Commit shared models and render only when the view remains mounted and the initiating generation still owns the operation.
- Keep old right-pane results visible while a replacement search is in flight.
- Restart the unchanged active query when folder selection invalidates an in-flight scan.
- Ensure only the owning mounted operation clears `.is-scanning` or reports refresh errors.
- Route initial load, watcher refreshes, folder navigation, renderer refreshes, and CRUD/move completion through one guarded refresh path.
- Reconcile selected and expanded paths immediately after a successful folder rename/move, before protocol-reference synchronization.
- Preserve successful storage/UI state when protocol-reference synchronization unexpectedly rejects; show a localized warning and log the sync error separately.
- Add regressions for A→B→A search, concurrent folder selection, stale shared-state assignment, old-results-visible scanning, selection during search, post-close completion, guarded mutation refresh, and reference-sync rejection.
- Re-run validation after implementation before committing the existing redesign.

## Current State Analysis

The implementation already passes all targeted tests, lint checks, `npm run check`, and `npm run check:release`, but validation failed because ownership checks occur after asynchronous builders have already assigned `folderTreeData` and `snippetData`. Direct CRUD/move and renderer rename paths also rebuild and render outside the shared generation guard, and folder rename/move delays path reconciliation until after reference synchronization.

### Key Discoveries

- `src/views/snippet-manager-view.ts:207-232` captures a generation but stale/unmounted cleanup and error reporting are not fully ownership-aware.
- `src/views/snippet-manager-view.ts:239-287` mutates `folderTreeData` and `snippetData` while reads are still in flight, before the caller validates ownership.
- `src/views/snippet-manager-view.ts:289-294` invalidates active search on folder selection without starting replacement search work.
- `src/views/snippet-manager-view.ts:323-483` contains direct edit/create/delete rebuild-and-render paths that bypass mounted/generation ownership.
- `src/views/snippet-manager-view.ts:591-633` waits for protocol-reference sync before guarded model refresh and folder path reconciliation.
- `src/views/snippet-manager/tree-renderer.ts:543-579` similarly waits for reference sync before rename reconciliation and refresh.
- `src/views/snippet-tree-picker.ts:455-473` keeps old UI mounted, loads into locals, checks lifecycle/query ownership, and only then changes DOM.
- `src/views/protocol-editor-view.ts:1682-1718` captures generation, awaits an immutable result, validates ownership, then swaps shared state.
- `src/snippets/protocol-ref-sync.ts:26-31,37-110` defines reference sync as best-effort and never-throw, but callers still need resilience to an unexpected rejected promise.
- `src/__tests__/snippet-tree-view.test.ts:643-679` covers A→B stale results and close-time DOM behavior but not same-query recurrence, shared model mutation, scanning cleanup, or concurrent selection.

## Desired End State

```typescript
// Older reads may finish, but only the newest mounted operation can commit.
void view.selectFolder('Snippets/Chest');
void view.selectFolder('Snippets/Abdomen');
// Final shared folder/snippet/search model belongs to Abdomen's generation.
```

```text
Active search + folder selection
  → invalidate prior generation
  → keep current right-pane results visible
  → restart the unchanged query
  → atomically swap folder tree, selected rows, and search results
  → clear scanning only for the owning mounted generation
```

```text
Successful folder move/rename
  → rewrite selected/expanded paths
  → guarded model refresh and render
  → attempt protocol-reference sync
  → on unexpected sync rejection, keep moved state and show localized warning
```

## What We're NOT Doing

- No changes to `SnippetService.searchSnippets()`, search matching semantics, snippet formats, or protocol schemas.
- No search index, cache, cancellation token, worker, or parallel recursive vault scan.
- No CSS/layout redesign or additional two-pane interactions.
- No rollback of a successful snippet/folder storage mutation when protocol-reference synchronization fails.
- No refactor of `protocol-ref-sync.ts`; its best-effort contract remains unchanged.
- No replacement of `SnippetManagerTreeRenderer` or broader callback subsystem redesign beyond routing its refresh completion through the view-owned guard.
- No unrelated fixes to legacy `.MD` behavior, service tests, or release output.

## Decisions

### Build locally and commit under one ownership check

Async folder, snippet, and search builders return local values. The view validates `mounted` and generation ownership immediately before assigning shared model fields and rendering, following `src/views/protocol-editor-view.ts:1682-1718` and `src/views/snippet-tree-picker.ts:455-473` rather than the current eager assignments at `src/views/snippet-manager-view.ts:239-287`.

### Restart active search after folder selection

Folder selection remains part of the single invalidation domain. When `searchQuery.trim()` is non-empty, selection starts a replacement refresh for that unchanged query instead of merely invalidating the old scan (`src/views/snippet-manager-view.ts:207-232,289-294`).

### Ownership governs scanning cleanup and refresh errors

A stale or unmounted operation neither clears `.is-scanning` nor emits `redrawError`; its replacement or close owns cleanup. Only the mounted current generation may report a refresh failure or remove the scanning marker.

### Every model-changing completion uses guarded refresh

Initial load, watcher debounce, navigation, renderer `refresh`, edit/create/delete handlers, folder creation/deletion, and move completion all converge on the view's guarded refresh. Mutation-specific path rewrites happen before invoking it.

### Storage success precedes reference-sync fan-out

Folder move/rename treats the storage operation as the mutation commit boundary. Selected/expanded reconciliation and guarded UI refresh happen immediately after storage succeeds; `rewriteProtocolSnippetRefs()` is then attempted as an independent best-effort fan-out (`src/views/snippet-manager-view.ts:619-633`, `src/views/snippet-manager/tree-renderer.ts:560-574`).

### Unexpected sync rejection gets a bilingual warning

Add symmetric English/Russian `snippetManager.*` warning copy. If reference sync unexpectedly rejects, retain the successful mutation and reconciled UI, emit the localized warning, and write a namespaced `console.error`; do not surface the generic move/rename failure message.

## Phase 1: Atomic async model ownership

### Overview

Foundation phase with no dependencies; converts asynchronous model construction and navigation/search refresh into local load-then-swap work owned by one mounted generation.

### Changes Required:

#### 1. src/views/snippet-manager-view.ts:async model and refresh sections

**File**: src/views/snippet-manager-view.ts
**Changes**: MODIFY — return local folder/snippet models, centralize guarded commits, restart active searches on selection, and make scanning/error cleanup ownership-aware

```typescript
// Add beside the existing Snippet type import.
import type { SnippetSearchResult } from '../snippets/snippet-service';

interface SnippetManagerModel {
  folderTree: TreeNodeFolder;
  snippets: TreeNodeFile[];
  selectedFolderPath: string;
  searchResults: SnippetSearchResult[];
}

// Replace the searchResults field declaration and add requested navigation state.
private searchResults: SnippetSearchResult[] = [];
private requestedFolderPath: string;

// In the constructor, initialize both committed and requested selection.
this.selectedFolderPath = plugin.settings.snippetFolderPath;
this.requestedFolderPath = plugin.settings.snippetFolderPath;

// In onOpen, reset both paths to root before the initial refresh.
this.selectedFolderPath = this.plugin.settings.snippetFolderPath;
this.requestedFolderPath = this.selectedFolderPath;

// In the renderer callbacks, replace the refresh callback.
refresh: async () => {
  await this.refresh();
},

// In onOpen, replace the initial generation/rebuild/render sequence.
await this.refresh();
if (!this.mounted) return;

// Replace refresh(), rebuildTreeModel(), buildFolderChildren(),
// rebuildSelectedSnippets(), selectFolder(), and toggleFolder() with:
private ownsRefresh(generation: number): boolean {
  return this.mounted && generation === this.searchGeneration;
}

private async refresh(
  selectedFolderPath: string = this.requestedFolderPath,
): Promise<boolean> {
  if (!this.mounted) return false;
  this.requestedFolderPath = selectedFolderPath;
  const query = this.searchQuery.trim();
  const generation = ++this.searchGeneration;
  this.searchWrapEl.addClass('is-scanning');
  try {
    const nextModel = await this.loadModel(selectedFolderPath, query);
    if (!this.ownsRefresh(generation)) return false;
    await this.pruneStaleExpandedPaths(nextModel.folderTree);
    if (!this.ownsRefresh(generation)) return false;
    this.commitModel(nextModel);
    this.renderTree();
    return true;
  } catch (e) {
    if (!this.ownsRefresh(generation)) return false;
    new Notice(this.plugin.i18n.t('snippetManager.redrawError'));
    console.error('[RadiProtocol] snippet manager refresh failed', e);
    return false;
  } finally {
    if (this.ownsRefresh(generation)) this.searchWrapEl.removeClass('is-scanning');
  }
}

private async loadModel(
  selectedFolderPath: string,
  query: string,
): Promise<SnippetManagerModel> {
  const folderTree = await this.loadFolderTree();
  const reconciledFolderPath = this.resolveSelectedFolder(folderTree, selectedFolderPath);
  const snippets = await this.loadSnippetData(reconciledFolderPath);
  const searchResults = query === ''
    ? []
    : await this.plugin.snippetService.searchSnippets(query);
  return { folderTree, snippets, selectedFolderPath: reconciledFolderPath, searchResults };
}

private commitModel(model: SnippetManagerModel): void {
  this.folderTreeData = model.folderTree;
  this.snippetData = model.snippets;
  this.selectedFolderPath = model.selectedFolderPath;
  this.requestedFolderPath = model.selectedFolderPath;
  this.searchResults = model.searchResults;
}

private async loadFolderTree(): Promise<TreeNodeFolder> {
  const root = this.plugin.settings.snippetFolderPath;
  return {
    kind: 'folder',
    path: root,
    name: root.slice(root.lastIndexOf('/') + 1) || root,
    isRoot: true,
    children: await this.buildFolderChildren(root),
  };
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

private async loadSnippetData(folderPath: string): Promise<TreeNodeFile[]> {
  let snippets: Snippet[] = [];
  try {
    snippets = (await this.plugin.snippetService.listFolder(folderPath)).snippets;
  } catch {
    // Keep the selected folder navigable and render an empty right pane.
  }
  return snippets
    .map((snippet) => ({
      kind: 'file' as const,
      path: snippet.path,
      name: snippet.name || basenameNoExt(snippet.path),
      snippetKind: snippet.kind,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Temporary compatibility wrappers for direct mutation callers. Phase 2
// removes these callers after routing every completion through refresh().
private async rebuildTreeModel(): Promise<void> {
  this.commitModel(await this.loadModel(this.selectedFolderPath, this.searchQuery.trim()));
}

private async rebuildSelectedSnippets(): Promise<void> {
  this.snippetData = await this.loadSnippetData(this.selectedFolderPath);
}

private async selectFolder(path: string): Promise<void> {
  await this.refresh(path);
}

private async toggleFolder(path: string): Promise<void> {
  const generation = this.searchGeneration;
  const list = this.plugin.settings.snippetTreeExpandedPaths;
  const index = list.indexOf(path);
  if (index >= 0) list.splice(index, 1);
  else list.push(path);
  await this.plugin.saveSettings();
  if (!this.ownsRefresh(generation)) return;
  this.renderTree();
}

private resolveSelectedFolder(folderTree: TreeNodeFolder, selectedFolderPath: string): string {
  const root = this.plugin.settings.snippetFolderPath;
  const findFolder = (node: TreeNodeFolder, target: string): boolean => {
    if (node.path === target) return true;
    return node.children.some((child) => findFolder(child, target));
  };
  let path = selectedFolderPath;
  while (path !== root && !findFolder(folderTree, path)) {
    const slash = path.lastIndexOf('/');
    if (slash <= root.length) return root;
    path = path.slice(0, slash);
  }
  return path;
}

private reconcileSelectedFolder(): void {
  this.selectedFolderPath = this.resolveSelectedFolder(
    this.folderTreeData,
    this.selectedFolderPath,
  );
}

private async pruneStaleExpandedPaths(
  folderTree: TreeNodeFolder = this.folderTreeData,
): Promise<void> {
  const expanded = this.plugin.settings.snippetTreeExpandedPaths;
  if (expanded.length === 0) return;
  const valid = new Set<string>();
  const collect = (node: TreeNodeFolder): void => {
    valid.add(node.path);
    for (const child of node.children) collect(child);
  };
  collect(folderTree);
  let mutated = false;
  for (let i = expanded.length - 1; i >= 0; i--) {
    if (!valid.has(expanded[i]!)) {
      expanded.splice(i, 1);
      mutated = true;
    }
  }
  if (mutated) await this.plugin.saveSettings();
}
```

#### 2. src/__tests__/snippet-tree-view.test.ts:search and lifecycle regressions

**File**: src/__tests__/snippet-tree-view.test.ts
**Changes**: MODIFY — add deferred-operation coverage for concurrent selections, A→B→A, old-results-visible scans, selection during search, scanning cleanup, stale model assignment, and post-close shared state

```typescript
let noticeMessages: string[] = [];

// Replace the Notice class inside the local obsidian mock.
class Notice {
  message: string;
  constructor(msg: string) {
    this.message = msg;
    noticeMessages.push(msg);
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Reset noticeMessages in both existing beforeEach blocks.
noticeMessages = [];

// In existing TREE-03, replace its two-microtask wait after folder click.
folderRow.dispatchEvent({ type: 'click', target: folderRow });
await flushAsync();

it('SEARCH: keeps prior results visible and scanning owned until replacement completes', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin();
  const view = makeView(plugin);
  await view.onOpen();
  service.searchSnippets.mockResolvedValueOnce([
    { snippet: makeSnippet('md', `${root}/old.md`, 'old'), folderPath: root },
  ]);
  (view as any).searchQuery = 'old';
  await (view as any).refresh();
  const replacement = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  service.searchSnippets.mockReturnValueOnce(replacement.promise);
  (view as any).searchQuery = 'new';
  const pending = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/old.md`]);
  expect(((view as any).searchWrapEl as MockEl).classList.has('is-scanning')).toBe(true);
  replacement.resolve([
    { snippet: makeSnippet('md', `${root}/new.md`, 'new'), folderPath: root },
  ]);
  await pending;
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/new.md`]);
  expect(((view as any).searchWrapEl as MockEl).classList.has('is-scanning')).toBe(false);
});

it('SEARCH: rejects the first completion in an A→B→A race', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin();
  const firstA = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  const secondA = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  service.searchSnippets
    .mockReturnValueOnce(firstA.promise)
    .mockResolvedValueOnce([
      { snippet: makeSnippet('md', `${root}/b.md`, 'b'), folderPath: root },
    ])
    .mockReturnValueOnce(secondA.promise);
  const view = makeView(plugin);
  await view.onOpen();
  (view as any).searchQuery = 'a';
  const pendingFirstA = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  (view as any).searchQuery = 'b';
  await (view as any).refresh();
  (view as any).searchQuery = 'a';
  const pendingSecondA = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  secondA.resolve([
    { snippet: makeSnippet('md', `${root}/new-a.md`, 'new-a'), folderPath: root },
  ]);
  await pendingSecondA;
  firstA.resolve([
    { snippet: makeSnippet('md', `${root}/old-a.md`, 'old-a'), folderPath: root },
  ]);
  await pendingFirstA;
  expect((view as any).searchResults.map((result: { snippet: Snippet }) => result.snippet.path))
    .toEqual([`${root}/new-a.md`]);
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${root}/new-a.md`]);
});

it('TREE-03-RACE: concurrent folder selections cannot leave stale shared models for a later render', async () => {
  const root = '.radiprotocol/snippets';
  const folderA = `${root}/a`;
  const folderB = `${root}/b`;
  const listings = {
    [root]: { folders: ['a', 'b'], snippets: [] },
    [folderA]: { folders: [], snippets: [makeSnippet('md', `${folderA}/a.md`, 'a')] },
    [folderB]: { folders: [], snippets: [makeSnippet('md', `${folderB}/b.md`, 'b')] },
  };
  const { plugin, service } = makePlugin({ listings });
  const view = makeView(plugin);
  await view.onOpen();
  const staleFolderLoad = deferred<{ folders: string[]; snippets: Snippet[] }>();
  let deferFirstA = true;
  service.listFolder.mockImplementation((path: string) => {
    if (path === folderA && deferFirstA) {
      deferFirstA = false;
      return staleFolderLoad.promise;
    }
    return Promise.resolve(listings[path as keyof typeof listings] ?? { folders: [], snippets: [] });
  });
  const pendingA = (view as any).selectFolder(folderA) as Promise<void>;
  await flushAsync();
  await (view as any).selectFolder(folderB);
  staleFolderLoad.resolve(listings[folderA]);
  await pendingA;
  await (view as any).toggleFolder(folderB);
  expect((view as any).selectedFolderPath).toBe(folderB);
  expect((view as any).snippetData.map((node: { path: string }) => node.path))
    .toEqual([`${folderB}/b.md`]);
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${folderB}/b.md`]);
});

it('TREE-03-WATCHER: watcher refresh preserves the latest requested folder', async () => {
  const root = '.radiprotocol/snippets';
  const folder = `${root}/a`;
  const listings = {
    [root]: { folders: ['a'], snippets: [] },
    [folder]: { folders: [], snippets: [makeSnippet('md', `${folder}/a.md`, 'a')] },
  };
  const { plugin, service } = makePlugin({ listings });
  const view = makeView(plugin);
  await view.onOpen();
  const staleRoot = deferred<{ folders: string[]; snippets: Snippet[] }>();
  service.listFolder.mockImplementationOnce(() => staleRoot.promise);

  const selecting = (view as any).selectFolder(folder) as Promise<void>;
  await flushAsync();
  await (view as any).refresh();
  staleRoot.resolve(listings[root]);
  await selecting;

  expect((view as any).requestedFolderPath).toBe(folder);
  expect((view as any).selectedFolderPath).toBe(folder);
  expect((view as any).snippetData.map((node: { path: string }) => node.path))
    .toEqual([`${folder}/a.md`]);
});

it('SEARCH: folder selection during a scan restarts the unchanged query and owns cleanup', async () => {
  const root = '.radiprotocol/snippets';
  const folder = `${root}/a`;
  const { plugin, service } = makePlugin({
    listings: {
      [root]: { folders: ['a'], snippets: [] },
      [folder]: { folders: [], snippets: [] },
    },
  });
  const staleSearch = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  service.searchSnippets
    .mockReturnValueOnce(staleSearch.promise)
    .mockResolvedValueOnce([
      { snippet: makeSnippet('md', `${folder}/fresh.md`, 'fresh'), folderPath: folder },
    ]);
  const view = makeView(plugin);
  await view.onOpen();
  (view as any).searchQuery = 'ct';
  const pending = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  await (view as any).selectFolder(folder);
  expect(service.searchSnippets).toHaveBeenLastCalledWith('ct');
  expect(service.searchSnippets).toHaveBeenCalledTimes(2);
  expect((view as any).selectedFolderPath).toBe(folder);
  expect(((view as any).searchWrapEl as MockEl).classList.has('is-scanning')).toBe(false);
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${folder}/fresh.md`]);
  staleSearch.resolve([
    { snippet: makeSnippet('md', `${root}/stale.md`, 'stale'), folderPath: root },
  ]);
  await pending;
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${folder}/fresh.md`]);
});

it('SEARCH: stale failures emit no Notice, log, or cleanup of the owning scan', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin();
  const staleSearch = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  const currentSearch = deferred<Array<{ snippet: Snippet; folderPath: string }>>();
  service.searchSnippets
    .mockReturnValueOnce(staleSearch.promise)
    .mockReturnValueOnce(currentSearch.promise);
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const view = makeView(plugin);
  await view.onOpen();
  (view as any).searchQuery = 'old';
  const stale = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  (view as any).searchQuery = 'new';
  const current = (view as any).refresh() as Promise<boolean>;
  await flushAsync();
  staleSearch.reject(new Error('stale failure'));
  await stale;
  expect(noticeMessages).toEqual([]);
  expect(consoleSpy).not.toHaveBeenCalled();
  expect(((view as any).searchWrapEl as MockEl).classList.has('is-scanning')).toBe(true);
  currentSearch.resolve([
    { snippet: makeSnippet('md', `${root}/new.md`, 'new'), folderPath: root },
  ]);
  await current;
  expect(((view as any).searchWrapEl as MockEl).classList.has('is-scanning')).toBe(false);
  consoleSpy.mockRestore();
});

it('LIFECYCLE: close during initial load cannot assign the first shared model', async () => {
  const { plugin, service } = makePlugin();
  const initialRoot = deferred<{ folders: string[]; snippets: Snippet[] }>();
  service.listFolder.mockReturnValueOnce(initialRoot.promise);
  const view = makeView(plugin);
  const opening = view.onOpen();
  await flushAsync();
  await view.onClose();
  initialRoot.resolve({ folders: [], snippets: [] });
  await opening;
  expect((view as any).folderTreeData).toBeUndefined();
  expect((view as any).snippetData).toEqual([]);
  expect(noticeMessages).toEqual([]);
  expect(((view as any).contentEl as MockEl).children).toEqual([]);
});

it('LIFECYCLE: close during folder selection cannot assign its local model', async () => {
  const root = '.radiprotocol/snippets';
  const folder = `${root}/a`;
  const listings = {
    [root]: { folders: ['a'], snippets: [] },
    [folder]: { folders: [], snippets: [makeSnippet('md', `${folder}/a.md`, 'a')] },
  };
  const { plugin, service } = makePlugin({ listings });
  const view = makeView(plugin);
  await view.onOpen();
  const originalFolderTree = (view as any).folderTreeData;
  const originalSnippetData = (view as any).snippetData;
  const pendingRoot = deferred<{ folders: string[]; snippets: Snippet[] }>();
  service.listFolder.mockReturnValueOnce(pendingRoot.promise);
  const selecting = (view as any).selectFolder(folder) as Promise<void>;
  await flushAsync();
  await view.onClose();
  pendingRoot.resolve(listings[root]);
  await selecting;
  expect((view as any).folderTreeData).toBe(originalFolderTree);
  expect((view as any).snippetData).toBe(originalSnippetData);
  expect((view as any).selectedFolderPath).toBe(root);
  expect(noticeMessages).toEqual([]);
  expect(((view as any).contentEl as MockEl).children).toEqual([]);
});
```

### Success Criteria:

#### Automated Verification:
- [x] Async ownership regressions pass: `npx vitest run src/__tests__/snippet-tree-view.test.ts`
- [x] Phase TypeScript files satisfy ESLint: `npx eslint src/views/snippet-manager-view.ts src/__tests__/snippet-tree-view.test.ts`

#### Manual Verification:
- [ ] In Obsidian, rapidly issue A→B→A searches and select folders during scanning; prior results remain visible until the newest operation commits, and the scanning style always clears.

## Phase 2: Guarded mutation completion and sync recovery

### Overview

Depends on Phase 1; routes all storage mutation completions through guarded refresh and makes rename/move reconciliation survive unexpected reference-sync rejection.

### Changes Required:

#### 1. src/views/snippet-manager-view.ts:CRUD, move, and reconciliation sections

**File**: src/views/snippet-manager-view.ts
**Changes**: MODIFY — replace direct rebuild/render calls with guarded refresh, reorder move reconciliation before independent protocol-reference sync, and rename the view's top-level private `toSnippetRelativePath` helper (extension-preserving) to `toProtocolRelativePath` to avoid colliding with the extension-stripping `toSnippetRelativePath` exported by `src/snippets/snippet-service.ts`; update its two call sites in `syncProtocolRefs`

```typescript
// Replace the renderer callback rewriteExpandState assignment.
completeFolderRename: (oldPath, newPath) =>
  this.completeFolderRename(oldPath, newPath),

// openEditModal(): replace missing-snippet and modal-result completion blocks.
if (snippet === null) {
  new Notice(this.plugin.i18n.t('snippetManager.notFound'));
  await this.refresh();
  return;
}
// ...construct and open the existing modal unchanged...
const result = await modal.result;
this.currentlyEditingPath = null;
if (result.saved) {
  await this.refresh();
} else if (this.mounted) {
  this.renderTree();
}

// openCreateModal(): replace the saved completion.
if (result.saved) await this.refresh();

// handleCreateSubfolder(): replace the successful try body after validation.
await this.plugin.snippetService.createFolder(newPath);
const expanded = this.plugin.settings.snippetTreeExpandedPaths;
if (!expanded.includes(parentPath)) expanded.push(parentPath);
if (!expanded.includes(newPath)) expanded.push(newPath);
await this.plugin.saveSettings();
await this.refresh();

// handleDeleteSnippet(): replace the successful try body.
await this.plugin.snippetService.delete(path);
new Notice(t('snippetManager.deletedNotice'));
await this.refresh();

// handleDeleteFolder(): replace the successful try body.
await this.plugin.snippetService.deleteFolder(path);
new Notice(t('snippetManager.folderDeletedNotice'));
await this.refresh();

private async performMove(
  srcPath: string,
  srcKind: 'file' | 'folder',
  dstFolder: string,
): Promise<void> {
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  if (srcKind === 'file') {
    if (dirname(srcPath) === dstFolder) return;
    const newPath = await this.plugin.snippetService.moveSnippet(srcPath, dstFolder);
    await this.refresh();
    const protocolResult = await this.syncProtocolRefs(srcPath, newPath);
    if (protocolResult !== null) {
      new Notice(t('snippetManager.movedFileNotice', {
        protocolCount: String(protocolResult.updated),
      }));
    }
    return;
  }
  if (srcPath === dstFolder || dstFolder.startsWith(`${srcPath}/`)) {
    throw new Error(t('snippetManager.cannotMoveIntoSelf'));
  }
  const newPath = await this.plugin.snippetService.moveFolder(srcPath, dstFolder);
  await this.refreshAfterFolderPathChange(srcPath, newPath);
  const protocolResult = await this.syncProtocolRefs(srcPath, newPath);
  if (protocolResult !== null) {
    new Notice(t('snippetManager.movedFolderNotice', {
      protocolCount: String(protocolResult.updated),
    }));
  }
}

private async refreshAfterFolderPathChange(oldPath: string, newPath: string): Promise<void> {
  const selectedFolderPath = this.rewriteSelectedPath(
    this.selectedFolderPath,
    oldPath,
    newPath,
  );
  // Commit the requested selection synchronously after storage succeeds so a
  // later refresh failure cannot pair a successful mutation with an obsolete
  // requested folder path. The guarded refresh below commits the visible model.
  this.requestedFolderPath = selectedFolderPath;
  try {
    await this.rewriteExpandState(oldPath, newPath);
  } catch (e) {
    if (this.mounted) new Notice(this.plugin.i18n.t('snippetManager.redrawError'));
    console.error('[RadiProtocol] snippet manager path reconciliation failed', e);
  }
  await this.refresh(selectedFolderPath);
}

private async completeFolderRename(
  oldPath: string,
  newPath: string,
): Promise<{ updated: number; skipped: number } | null> {
  await this.refreshAfterFolderPathChange(oldPath, newPath);
  return this.syncProtocolRefs(oldPath, newPath);
}

private async syncProtocolRefs(
  oldPath: string,
  newPath: string,
): Promise<{ updated: number; skipped: number } | null> {
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  const snippetRoot = this.plugin.settings.snippetFolderPath;
  const mapping = new Map<string, string>([[
    toProtocolRelativePath(oldPath, snippetRoot),
    toProtocolRelativePath(newPath, snippetRoot),
  ]]);
  try {
    const result = await rewriteProtocolSnippetRefs(this.app, mapping);
    return { updated: result.updated.length, skipped: result.skipped.length };
  } catch (e) {
    const error = (e as Error)?.message ?? t('snippetManager.unknownError');
    new Notice(t('snippetManager.referenceSyncWarning', { error }));
    console.error('[RadiProtocol] snippet manager protocol-reference sync failed', e);
    return null;
  }
}

private async rewriteExpandState(oldPath: string, newPath: string): Promise<void> {
  const expanded = this.plugin.settings.snippetTreeExpandedPaths;
  let mutated = false;
  for (let i = 0; i < expanded.length; i++) {
    const entry = expanded[i]!;
    if (entry === oldPath) {
      expanded[i] = newPath;
      mutated = true;
    } else if (entry.startsWith(`${oldPath}/`)) {
      expanded[i] = `${newPath}${entry.slice(oldPath.length)}`;
      mutated = true;
    }
  }
  if (mutated) await this.plugin.saveSettings();
}

private rewriteSelectedPath(
  selectedFolderPath: string,
  oldPath: string,
  newPath: string,
): string {
  if (selectedFolderPath === oldPath) return newPath;
  if (selectedFolderPath.startsWith(`${oldPath}/`)) {
    return `${newPath}${selectedFolderPath.slice(oldPath.length)}`;
  }
  return selectedFolderPath;
}

// Delete the complete Phase 1 compatibility method declarations
// rebuildTreeModel(), rebuildSelectedSnippets(), and reconcileSelectedFolder().
```

#### 2. src/views/snippet-manager/tree-renderer.ts:rename completion section

**File**: src/views/snippet-manager/tree-renderer.ts
**Changes**: MODIFY — reconcile and guarded-refresh successful renames before independently handling protocol-reference sync rejection

```typescript
// Delete imports of rewriteProtocolSnippetRefs and toSnippetRelativePath.

// Replace rewriteExpandState in TreeRendererCallbacks.
completeFolderRename(
  oldPath: string,
  newPath: string,
): Promise<{ updated: number; skipped: number } | null>;

private async commitInlineRename(
  node: TreeNode,
  rawValue: string,
  cleanup: () => void,
): Promise<void> {
  const newValue = rawValue.trim();
  const oldBasename = node.kind === 'file' ? basenameNoExt(node.path) : node.name;
  if (newValue === '' || newValue === oldBasename) {
    cleanup();
    return;
  }
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  try {
    if (node.kind === 'file') {
      await this.plugin.snippetService.renameSnippet(node.path, newValue);
      cleanup();
      await this.callbacks.refresh();
      new Notice(t('snippetManager.snippetRenamedNotice'));
      return;
    }
    const oldPath = node.path;
    const newPath = await this.plugin.snippetService.renameFolder(oldPath, newValue);
    cleanup();
    const result = await this.callbacks.completeFolderRename(oldPath, newPath);
    if (result !== null) {
      new Notice(t('snippetManager.folderRenamedNotice', {
        updated: String(result.updated),
        skipped: String(result.skipped),
      }));
    }
  } catch (e) {
    const error = (e as Error)?.message ?? t('snippetManager.unknownError');
    new Notice(t('snippetManager.renameError', { error }));
    cleanup();
  }
}
```

#### 3. src/__tests__/snippet-tree-view.test.ts:mutation ownership regressions

**File**: src/__tests__/snippet-tree-view.test.ts
**Changes**: MODIFY — verify mutation completions cannot commit shared models or render after close/supersession

```typescript
import * as fs from 'fs';
import * as path from 'path';

it('MUTATION-ROUTING: every model-changing completion calls the guarded refresh surface', () => {
  const viewSource = fs.readFileSync(path.resolve(__dirname, '../views/snippet-manager-view.ts'), 'utf8');
  const rendererSource = fs.readFileSync(path.resolve(__dirname, '../views/snippet-manager/tree-renderer.ts'), 'utf8');
  const methodSource = (source: string, name: string): string => {
    const start = source.indexOf(`private async ${name}(`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('\n  private ', start + 1);
    return source.slice(start, end < 0 ? source.length : end);
  };
  for (const name of [
    'openEditModal',
    'openCreateModal',
    'handleCreateSubfolder',
    'handleDeleteSnippet',
    'handleDeleteFolder',
  ]) {
    expect(methodSource(viewSource, name)).toContain('await this.refresh()');
  }
  const moveSource = methodSource(viewSource, 'performMove');
  expect(moveSource).toContain('await this.refresh()');
  expect(moveSource).toContain('await this.refreshAfterFolderPathChange');
  const renameSource = methodSource(rendererSource, 'commitInlineRename');
  expect(renameSource).toContain('await this.callbacks.refresh()');
  expect(renameSource).toContain('await this.callbacks.completeFolderRename');

  const callbackInterface = rendererSource.match(
    /export interface TreeRendererCallbacks\s*\{([\s\S]*?)\n\}/,
  )?.[1] ?? '';
  const callbackNames = [...callbackInterface.matchAll(/^\s*(\w+)\s*\(/gm)]
    .map((match) => match[1]!);
  const callbackAssignments = viewSource.slice(
    viewSource.indexOf('callbacks: {'),
    viewSource.indexOf('\n      },\n    });', viewSource.indexOf('callbacks: {')),
  );
  expect(callbackNames.length).toBeGreaterThan(0);
  for (const name of callbackNames) {
    expect(callbackAssignments).toMatch(new RegExp(`\\b${name}:`));
    expect(rendererSource).toContain(`this.callbacks.${name}(`);
  }
  expect(viewSource).not.toMatch(/rebuild(TreeModel|SelectedSnippets)/);
});

it('MUTATION-LIFECYCLE: close during delete completion cannot commit or render a model', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin({ listings: {
    [root]: { folders: [], snippets: [makeSnippet('md', `${root}/gone.md`, 'gone')] },
  } });
  const view = makeView(plugin);
  await view.onOpen();
  const originalFolderTree = (view as any).folderTreeData;
  const originalSnippetData = (view as any).snippetData;
  const deleting = deferred<void>();
  service.delete.mockReturnValueOnce(deleting.promise);
  confirmModalNextResult = 'confirm';
  const completion = (view as any).handleDeleteSnippet(`${root}/gone.md`, 'gone') as Promise<void>;
  await flushAsync();
  await view.onClose();
  deleting.resolve(undefined);
  await completion;
  expect((view as any).folderTreeData).toBe(originalFolderTree);
  expect((view as any).snippetData).toBe(originalSnippetData);
  expect(((view as any).contentEl as MockEl).children).toEqual([]);
});

it('MUTATION-RACE: a superseded delete refresh cannot overwrite newer navigation', async () => {
  const root = '.radiprotocol/snippets';
  const folderA = `${root}/a`;
  const folderB = `${root}/b`;
  const listings = {
    [root]: { folders: ['a', 'b'], snippets: [makeSnippet('md', `${root}/gone.md`, 'gone')] },
    [folderA]: { folders: [], snippets: [] },
    [folderB]: { folders: [], snippets: [makeSnippet('md', `${folderB}/current.md`, 'current')] },
  };
  const { plugin, service } = makePlugin({ listings });
  const view = makeView(plugin);
  await view.onOpen();
  const staleRoot = deferred<{ folders: string[]; snippets: Snippet[] }>();
  service.listFolder.mockImplementationOnce(() => staleRoot.promise);
  confirmModalNextResult = 'confirm';
  const deleting = (view as any).handleDeleteSnippet(`${root}/gone.md`, 'gone') as Promise<void>;
  await flushAsync();
  await (view as any).selectFolder(folderB);
  staleRoot.resolve(listings[root]);
  await deleting;
  expect((view as any).selectedFolderPath).toBe(folderB);
  expect((view as any).snippetData.map((node: { path: string }) => node.path))
    .toEqual([`${folderB}/current.md`]);
  expect(rowsIn((view as any).snippetRootEl as MockEl).map((row) => row._attrs['data-path']))
    .toEqual([`${folderB}/current.md`]);
});
```

#### 4. src/__tests__/snippet-tree-dnd.test.ts:move sync-rejection regressions

**File**: src/__tests__/snippet-tree-dnd.test.ts
**Changes**: MODIFY — verify successful file/folder moves refresh and reconcile before an unexpected protocol-sync rejection and are not reported as storage failures

```typescript
let noticeMessages: string[] = [];

// Replace Notice in the local obsidian mock.
class Notice {
  message: string;
  constructor(msg: string) { this.message = msg; noticeMessages.push(msg); }
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const listings: Record<string, { folders: string[]; snippets: Snippet[] }> =
  opts.listings ?? { '.radiprotocol/snippets': { folders: [], snippets: [] } };

const relocateFolder = (oldPath: string, newPath: string): void => {
  const oldParent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const oldName = oldPath.slice(oldPath.lastIndexOf('/') + 1);
  const newParent = newPath.slice(0, newPath.lastIndexOf('/'));
  const newName = newPath.slice(newPath.lastIndexOf('/') + 1);
  if (listings[oldParent] !== undefined) {
    listings[oldParent]!.folders = listings[oldParent]!.folders.filter((name) => name !== oldName);
  }
  const destination = listings[newParent] ?? { folders: [], snippets: [] };
  listings[newParent] = destination;
  if (!destination.folders.includes(newName)) destination.folders.push(newName);
  const moved = Object.keys(listings)
    .filter((p) => p === oldPath || p.startsWith(`${oldPath}/`))
    .sort((a, b) => a.length - b.length)
    .map((p) => [p, `${newPath}${p.slice(oldPath.length)}`] as const);
  for (const [p, target] of moved) {
    const listing = listings[p]!;
    listings[target] = {
      folders: [...listing.folders],
      snippets: listing.snippets.map((snippet) => ({
        ...snippet,
        path: `${newPath}${snippet.path.slice(oldPath.length)}`,
      })),
    };
  }
  for (const [p] of moved) delete listings[p];
};

// Replace default move mocks in makePlugin.
moveSnippet: vi.fn(opts.moveSnippetImpl ?? (async (oldPath: string, newFolder: string) => {
  const oldParent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const base = oldPath.slice(oldPath.lastIndexOf('/') + 1);
  const source = listings[oldParent];
  const snippet = source?.snippets.find((candidate) => candidate.path === oldPath);
  if (source !== undefined) {
    source.snippets = source.snippets.filter((candidate) => candidate.path !== oldPath);
  }
  const destination = listings[newFolder] ?? { folders: [], snippets: [] };
  listings[newFolder] = destination;
  if (snippet !== undefined) destination.snippets.push({ ...snippet, path: `${newFolder}/${base}` });
  return `${newFolder}/${base}`;
})),
moveFolder: vi.fn(opts.moveFolderImpl ?? (async (oldPath: string, newParent: string) => {
  const base = oldPath.slice(oldPath.lastIndexOf('/') + 1);
  const newPath = `${newParent}/${base}`;
  relocateFolder(oldPath, newPath);
  return newPath;
})),

// Reset noticeMessages in each beforeEach. Replace fixed Promise.resolve waits
// after positive drop/select operations and inside selectAbsolute() with:
noticeMessages = [];
await flushAsync();

it('file move keeps refreshed storage state when protocol-reference sync rejects', async () => {
  const { service, view } = makeTreeView();
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  rewriteProtocolSnippetRefsSpy.mockRejectedValueOnce(new Error('sync exploded'));
  await view.onOpen();
  await (view as any).performMove(`${root}/note.md`, 'file', `${root}/b`);
  expect(service.moveSnippet).toHaveBeenCalledWith(`${root}/note.md`, `${root}/b`);
  expect((view as any).snippetData.map((node: { path: string }) => node.path))
    .not.toContain(`${root}/note.md`);
  await (view as any).selectFolder(`${root}/b`);
  expect((view as any).snippetData.map((node: { path: string }) => node.path))
    .toContain(`${root}/b/note.md`);
  expect(noticeMessages.some((message) => message.includes('saved, but protocol references'))).toBe(true);
  expect(noticeMessages.some((message) => message.startsWith('Failed to move'))).toBe(false);
  expect(consoleSpy).toHaveBeenCalledWith(
    '[RadiProtocol] snippet manager protocol-reference sync failed',
    expect.any(Error),
  );
  consoleSpy.mockRestore();
});

it('folder move keeps reconciled UI state when protocol-reference sync rejects', async () => {
  const { plugin, view } = makeTreeView();
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  rewriteProtocolSnippetRefsSpy.mockRejectedValueOnce(new Error('sync exploded'));
  await view.onOpen();
  await (view as any).selectFolder(`${root}/a/sub`);
  await (view as any).performMove(`${root}/a`, 'folder', `${root}/b`);
  expect((view as any).selectedFolderPath).toBe(`${root}/b/a/sub`);
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/b/a`);
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/b/a/sub`);
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a`);
  expect(noticeMessages.some((message) => message.includes('saved, but protocol references'))).toBe(true);
  expect(noticeMessages.some((message) => message.startsWith('Failed to move'))).toBe(false);
  expect(consoleSpy).toHaveBeenCalledWith(
    '[RadiProtocol] snippet manager protocol-reference sync failed',
    expect.any(Error),
  );
  consoleSpy.mockRestore();
});
```

#### 5. src/__tests__/snippet-tree-inline-rename.test.ts:rename sync-rejection regressions

**File**: src/__tests__/snippet-tree-inline-rename.test.ts
**Changes**: MODIFY — verify successful folder rename preserves rewritten selection/expansion and refreshed rows when protocol sync rejects

```typescript
let noticeMessages: string[] = [];

// Replace Notice in the local obsidian mock.
class Notice {
  message: string;
  constructor(msg: string) { this.message = msg; noticeMessages.push(msg); }
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const listings: Record<string, { folders: string[]; snippets: Snippet[] }> =
  opts.listings ?? { '.radiprotocol/snippets': { folders: [], snippets: [] } };

const renameFolderInListings = (oldPath: string, newPath: string): void => {
  const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const oldName = oldPath.slice(oldPath.lastIndexOf('/') + 1);
  const newName = newPath.slice(newPath.lastIndexOf('/') + 1);
  if (listings[parent] !== undefined) {
    listings[parent]!.folders = listings[parent]!.folders
      .map((name) => name === oldName ? newName : name);
  }
  const moved = Object.keys(listings)
    .filter((p) => p === oldPath || p.startsWith(`${oldPath}/`))
    .sort((a, b) => a.length - b.length)
    .map((p) => [p, `${newPath}${p.slice(oldPath.length)}`] as const);
  for (const [p, target] of moved) {
    const listing = listings[p]!;
    listings[target] = {
      folders: [...listing.folders],
      snippets: listing.snippets.map((snippet) => ({
        ...snippet,
        path: `${newPath}${snippet.path.slice(oldPath.length)}`,
      })),
    };
  }
  for (const [p] of moved) delete listings[p];
};

// Replace the default renameFolder mock.
renameFolder: vi.fn(opts.renameFolderImpl ?? (async (oldPath: string, newBase: string) => {
  const parent = oldPath.slice(0, oldPath.lastIndexOf('/'));
  const newPath = `${parent}/${newBase}`;
  renameFolderInListings(oldPath, newPath);
  return newPath;
})),

// Reset noticeMessages in beforeEach. Replace fixed Promise.resolve waits after
// positive file/folder rename, duplicate settlement, path rewrite, and folder
// keyboard activation operations with `await flushAsync();`.
noticeMessages = [];

it('folder rename keeps reconciled UI state when protocol-reference sync rejects', async () => {
  const { plugin, view } = makeTreeView();
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  rewriteProtocolSnippetRefsSpy.mockRejectedValueOnce(new Error('sync exploded'));
  await view.onOpen();
  await (view as any).selectFolder(`${root}/a/sub`);
  const cleanup = vi.fn();
  await (view as any).treeRenderer.commitInlineRename(
    { kind: 'folder', path: `${root}/a`, name: 'a', isRoot: false, children: [] },
    'renamed',
    cleanup,
  );
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect((view as any).selectedFolderPath).toBe(`${root}/renamed/sub`);
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/renamed`);
  expect(plugin.settings.snippetTreeExpandedPaths).toContain(`${root}/renamed/sub`);
  expect(plugin.settings.snippetTreeExpandedPaths).not.toContain(`${root}/a`);
  expect(noticeMessages.some((message) => message.includes('saved, but protocol references'))).toBe(true);
  expect(noticeMessages.some((message) => message.startsWith('Failed to rename'))).toBe(false);
  expect(consoleSpy).toHaveBeenCalledWith(
    '[RadiProtocol] snippet manager protocol-reference sync failed',
    expect.any(Error),
  );
  consoleSpy.mockRestore();
});
```

#### 6. src/i18n/locales/en.json:snippetManager

**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add the English sync warning, drop `{canvasCount}` from move notices, and relabel `folderRenamedNotice` counts as protocol-reference results

```json
"movedFolderNotice": "Folder moved. Updated {protocolCount} protocol(s).",
"movedFileNotice": "Snippet moved. Updated {protocolCount} protocol(s).",
"folderRenamedNotice": "Folder renamed. Protocol references updated: {updated}, skipped: {skipped}.",
"referenceSyncWarning": "The snippet change was saved, but protocol references could not be synchronized: {error}"
```

#### 7. src/i18n/locales/ru.json:snippetManager

**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the structurally matching Russian sync warning, drop `{canvasCount}` from move notices, and relabel `folderRenamedNotice` counts as protocol-reference results

```json
"movedFolderNotice": "Папка перемещена. Обновлено {protocolCount} протокол(ов).",
"movedFileNotice": "Сниппет перемещён. Обновлено {protocolCount} протокол(ов).",
"folderRenamedNotice": "Папка переименована. Обновлено ссылок в протоколах: {updated}, пропущено: {skipped}.",
"referenceSyncWarning": "Изменение сниппетов сохранено, но не удалось синхронизировать ссылки в протоколах: {error}"
```

### Success Criteria:

#### Automated Verification:
- [x] Mutation and sync-recovery regressions pass: `npx vitest run src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- [x] Phase TypeScript files satisfy ESLint: `npx eslint src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-dnd.test.ts src/__tests__/snippet-tree-inline-rename.test.ts`
- [x] English and Russian Snippet Manager keys remain symmetric: `node -e "const e=require('./src/i18n/locales/en.json').snippetManager,r=require('./src/i18n/locales/ru.json').snippetManager;process.exit(Object.keys(e).sort().join()===Object.keys(r).sort().join()?0:1)"`
- [x] No eager compatibility builder remains: `node -e "const s=require('fs').readFileSync('src/views/snippet-manager-view.ts','utf8');process.exit(/rebuild(TreeModel|SelectedSnippets)/.test(s)?1:0)"`
- [x] Every renderer callback remains assigned and invoked: `npx vitest run src/__tests__/snippet-tree-view.test.ts -t "MUTATION-ROUTING"`

#### Manual Verification:
- [ ] In Obsidian, complete create/edit/delete/move/rename operations while rapidly navigating or closing the manager; no stale pane, detached render, or stuck scanning state appears.
- [ ] Simulate an unexpected protocol-reference sync failure after a successful folder move/rename; the moved/renamed UI state remains, and the localized warning does not claim storage failed.
- [ ] Rerun `/skill:validate` against this plan and record successful validate-owned `npm run check` and `npm run check:release` results before committing.

## Ordering Constraints

- Phase 1 is the foundation because Phase 2 routes every mutation completion through the guarded refresh API introduced there.
- Phase 2 depends on Phase 1 and revisits both `snippet-manager-view.ts` and `snippet-tree-view.test.ts` incrementally.
- The phases are sequential and cannot run in parallel because they modify overlapping files and Phase 2 code assumes Phase 1 signatures.
- Implementation applies each phase on top of the current uncommitted redesign and preserves the existing working tree changes.

## Verification Notes

- Prove an A→B→A query race cannot let the first A completion overwrite the second A, even though query strings match.
- Prove two concurrent folder selections cannot expose stale `snippetData` under the newest `selectedFolderPath`.
- Prove stale builders cannot assign `folderTreeData`, `snippetData`, or `searchResults` that a later render can expose.
- Prove prior right-pane results remain visible while replacement search/model work is unresolved.
- Prove folder selection during active search starts replacement work and eventually clears `.is-scanning` without exposing stale results.
- Prove stale/unmounted failures emit no Notice, log no current-operation failure, and do not clear another generation's scanning marker.
- Prove close during initial load, search, selection, or mutation completion prevents shared model assignment and detached rendering.
- Prove create/edit/delete/folder-create/folder-delete/move/renderer-rename completion uses the guarded refresh path rather than direct rebuild/render.
- Prove successful folder move/rename rewrites selected and expanded paths before protocol-reference synchronization settles.
- Prove an unexpected protocol-sync rejection leaves successful storage/UI state intact, emits the localized sync warning, logs separately, and does not emit generic move/rename failure copy.
- Preserve absolute path identity, DnD MIME guards, file-row containing-folder drops, self/descendant rejection, and duplicate-settlement rename behavior.
- Run the failed validation workflow again after implementation; the whole-project `npm run check` and `npm run check:release` gates remain validate-owned whole-plan checks, not phase-local commands.

## Performance Considerations

- Local model construction retains the existing sequential recursive read strategy and 120 ms debounce; it does not increase vault read concurrency.
- Stale operations may finish already-issued vault reads because no cancellation API is introduced, but they cannot commit models, render, emit stale errors, or clear the current scan marker.
- Active-search folder selection deliberately starts one replacement scan to preserve the single-generation ownership model.
- Atomic synchronous assignment of the completed local model avoids mixed old/new state without adding a cache or deep clone.

## Migration Notes

No persisted schema or settings migration is required. Existing expanded paths remain compatible; reconciliation and stale-path pruning continue to update the current settings structure.

## Pattern References

- `src/views/protocol-editor-view.ts:1682-1718` — capture generation, await immutable result, validate ownership, then assign shared state.
- `src/views/snippet-tree-picker.ts:455-473` — retain previous UI during async reads and mutate DOM only after lifecycle/query validation.
- `src/runner/render/render-snippet-picker.ts:78-111` — suppress both success and error presentation after logical ownership or mounted-host loss.
- `src/views/snippet-manager-view.ts:643-719` — slash-boundary selected/expanded path rewrite and missing-folder fallback.
- `src/snippets/protocol-ref-sync.ts:26-31,37-110` — best-effort reference-sync outcome semantics.
- `src/__tests__/snippet-tree-view.test.ts:643-679` — deferred search and close-race test scaffold to strengthen.
- `src/__tests__/views/snippet-tree-picker.test.ts:658-682` — previous-results-visible asynchronous regression pattern.
- `src/__tests__/snippet-tree-inline-rename.test.ts:485-507` — selected/expanded path assertions after folder rename.

## Precedents & Lessons

- Search flicker fix `fed8242f` established load-then-swap and stale-result guards; this plan strengthens them with same-query generation identity and shared-model ownership.
- Recursive manager rewrite `ccbd9935` required immediate real-DOM follow-up `77b62c1`; preserve `parentElement`-first inline rename behavior and repeat real Obsidian UAT.
- DnD introduction `e4b07bf1` established absolute path identity and custom MIME safety; mutation orchestration changes must not weaken either.
- Renderer extraction `eb5c670` later exposed dead callback wiring; keep the callback contract minimal and verify every callback remains assigned and invoked.
- `protocol-ref-sync.ts` is best-effort by contract, so a fan-out failure must not reclassify a completed storage mutation as failed.

## Developer Context

**Q (blueprint Direction, `src/views/snippet-manager-view.ts:207-232,289-294`): Folder selection invalidates an active search. Should it restart the unchanged query under the shared generation or preserve the current scan?**
A: Restart search.

**Q (blueprint Sync failure, `src/views/snippet-manager-view.ts:619-633`, `src/views/snippet-manager/tree-renderer.ts:560-574`, `src/snippets/protocol-ref-sync.ts:26-31`): After storage and guarded UI reconciliation succeed, should an unexpected reference-sync rejection show a localized warning or log only?**
A: Localized warning.

**Q (blueprint Design): Proceed with local async model construction, one mounted-generation commit owner, guarded mutation refresh, reconciliation-before-sync, and bilingual sync warning?**
A: Proceed.

**Q (blueprint Slices): Approve two sequential slices: atomic async model ownership; guarded mutation completion and sync recovery?**
A: Approve.

**Q (blueprint Slice 1, `src/views/snippet-manager-view.ts:207-294`, `src/__tests__/snippet-tree-view.test.ts:643-679`): Approve local load-then-swap model ownership, active-search replacement on folder selection, ownership-aware scanning/errors, and deferred race/lifecycle regressions?**
A: Approve.

**Q (blueprint Slice 2, `src/views/snippet-manager-view.ts:323-633`, `src/views/snippet-manager/tree-renderer.ts:543-579`): Approve guarded CRUD/move/rename completion, reconciliation-before-sync, bilingual sync warnings, storage-realistic fixtures, and close/supersession/sync-rejection regressions?**
A: Approve.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coverage | `## Verification Notes §12` | `<n/a>` | blocker | verification-coverage | The validate-owned rerun requirement has no corresponding criterion or visible code mirror. | Add a Phase 2 Manual Verification bullet requiring the failed validation workflow to be rerun and recording successful validate-owned `npm run check` and `npm run check:release` results. | applied: added a Phase 2 manual validation-rerun criterion recording both whole-project gates |
| coverage | `## Precedents & Lessons §4` | `<n/a>` | blocker | verification-coverage | The callback-minimality lesson is not covered for every `TreeRendererCallbacks` member; the structural test checks only refresh and rename callbacks. | Add a Phase 2 Automated Verification bullet for a callback-contract test that enumerates every `TreeRendererCallbacks` member and asserts each is assigned and invoked. | applied: extended MUTATION-ROUTING to enumerate all callbacks and added a focused AV command |
| code | `Phase 1 §1 (snippet-manager-view.ts)` | `src/views/snippet-manager-view.ts:186` | concern | code-quality | `refresh()` defaults to committed `selectedFolderPath`, so a watcher refresh during `selectFolder(path)` can supersede navigation and restore the previous folder. | Track the latest requested folder path synchronously and use it as the default refresh target while committing visible selection only under the generation guard. | applied: added requestedFolderPath ownership and a watcher-during-navigation regression |
| code | `Phase 2 §1 (snippet-manager-view.ts)` | `src/views/snippet-manager-view.ts:665` | concern | code-quality | `refreshAfterFolderPathChange()` does not commit rewritten selection until guarded refresh succeeds, so refresh failure can leave a successful folder mutation paired with an obsolete selected path. | Rewrite the view's requested selection immediately after storage succeeds, then pass that path through the guarded visible-model refresh. | applied: `refreshAfterFolderPathChange` commits `this.requestedFolderPath = selectedFolderPath` synchronously after rewriting selection, before `rewriteExpandState`/`refresh` |
| code | `Phase 2 §1 (snippet-manager-view.ts)` | `src/snippets/snippet-service.ts:41` | concern | codebase-fit | The plan retains a private `toSnippetRelativePath()` that preserves `.md`, while the exported utility with the same name strips `.md`. | Rename the view helper to a protocol-specific name and document its extension-preserving contract, or reconcile the two reference formats. | applied: renamed the view's private helper to `toProtocolRelativePath` (extension-preserving) and updated its two `syncProtocolRefs` call sites |
| code | `Phase 2 §1 (snippet-manager-view.ts)` | `src/i18n/locales/en.json:215` | concern | code-quality | Move notices supply only `protocolCount`, but `movedFileNotice` and `movedFolderNotice` also require `{canvasCount}`, leaving that placeholder visible. | Change both localized move messages to describe only `{protocolCount}`, or restore and supply a real canvas count. | applied: dropped `{canvasCount}` from EN/RU `movedFileNotice`/`movedFolderNotice`, keeping only `{protocolCount}` |
| code | `Phase 2 §2 (tree-renderer.ts)` | `src/i18n/locales/en.json:231` | concern | code-quality | `completeFolderRename()` returns protocol-reference counts, but `folderRenamedNotice` labels them as canvas results. | Update English and Russian rename notices to label these values as protocol-reference synchronization results. | applied: EN/RU `folderRenamedNotice` relabeled to 'Protocol references updated: {updated}, skipped: {skipped}' |

## Plan History

- Phase 1: Atomic async model ownership — approved as generated
- Phase 2: Guarded mutation completion and sync recovery — approved as generated

## References

- `.rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md`
- `.rpiv/artifacts/plans/2026-07-30_09-49-45_snippet-editor-two-pane-file-manager.md`
- `.rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md`
- Commits `fed8242f`, `ccbd9935`, `77b62c1`, `e4b07bf1`, `eb5c670`.
