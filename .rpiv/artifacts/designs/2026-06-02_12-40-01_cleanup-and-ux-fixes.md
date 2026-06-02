---
date: 2026-06-02T12:40:01+0300
author: Roman Shulgha
commit: 7320c28
branch: main
repository: RadiProtocol
topic: "Cleanup and UX fixes — shared library removal, connector rendering, drag, node creation flash"
tags: [design, cleanup, protocol-editor, edge-routing, drag, flash, library-removal]
status: ready
parent: .rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md
last_updated: 2026-06-02T12:40:01+0300
last_updated_by: Roman Shulgha
last_updated_note: "Finalized — 4 slices generated, all approved"
---

# Design: Cleanup and UX Fixes — Shared Library Removal, Elbow Connector Rendering, Drag, Node Creation Flash

## Summary

Four targeted fixes across the protocol editor plus full removal of the abandoned shared snippet/protocol library subsystem. No new dependencies, no rewrites. A generation counter guards against stale async saves (drag race). The backward elbow bend formula receives a dynamic clamp matching the forward branch. Node creation reorders modal backdrop paint before DOM teardown to eliminate flash. Library removal follows the proven `e1d9b3a` admin-panel precedent: disconnect wiring first, then delete files and clean secondary references (i18n, CSS, test mocks).

## Requirements

- Remove all abandoned shared snippet library / admin panel code (~12 files)
- Fix jagged elbow connector corners: replace fixed 20px backward bend with dynamic formula
- Fix canvas flash on node creation: reorder backdrop before teardown
- Fix drag state leak: guard `saveNodeGeometry` against concurrent `loadProtocol` with generation counter
- Zero remaining import references to deleted files (verified via grep)
- All existing tests pass; elbow backward LR test assertions updated
- Add no-backtracking invariant tests for backward routes
- Update generation counter guard test: verify silent abandon on concurrent load

## Current State Analysis

### Key Discoveries

- **`container.empty()` at `renderShell():512`** is the root of three bugs: flash (synchronous teardown before backdrop), drag race (destroys DOM during `saveNodeGeometry` await), and a theoretical issue for any future incremental update (`src/views/protocol-editor-view.ts:512`)
- **`void` (fire-and-forget) at 4 call sites** creates a systemic async race window: `saveNodeGeometry():1384`, edge save `:1886`, node save `:2123`, node delete `:2147`. Each yields during `await`, and concurrent `loadProtocol()` can interleave (`src/views/protocol-editor-view.ts:1384,1886,2123,2147`)
- **Existing `protocolPath` guard at `:1469`** catches navigation to a different file but not same-file reload — the actual race window (`src/views/protocol-editor-view.ts:1469`)
- **`T-30-04` stale-result guard** in `render-snippet-picker.ts:83-105` establishes the "snapshot-before-async, compare-after" pattern the generation counter follows (`src/runner/render/render-snippet-picker.ts:83-105`)
- **Library removal precedent `e1d9b3a`**: 3-commit layered approach (hygiene → disconnect → delete), 19 files, zero follow-up fixes. Proves the approach works (`git show e1d9b3a`)
- **7 library files form a closed import subgraph**: no imports from outside the set beyond `main.ts`, `settings.ts`, `snippet-manager-view.ts`, and `tree-renderer.ts` (`src/main.ts:10-11,19`)
- **`exportLibraryContribution` callback at `tree-renderer.ts:59`** is dead code: grep confirms only definition + wiring assignment, zero invocations (`src/views/snippet-manager/tree-renderer.ts:59`)
- **3 i18n keys referenced by `exportLibraryContribution()`** (`exportContributionSaved`, `exportContributionFailed`, `exportContributionRawMarkdownUnsupported`) never existed in locale files — no i18n cleanup needed for them

### Patterns to Follow

- **Generation counter**: Model after `T-30-04` stale-result guard (`src/runner/render/render-snippet-picker.ts:83-105`) — snapshot before async, compare after, silent abandon on mismatch
- **Library removal**: Model after `e1d9b3a` admin panel removal — disconnect wiring in one commit, delete files + clean up in another
- **Edge routing tests**: Add no-backtracking invariant tests (pattern from `5797c60`), not just string-comparison assertions
- **Test structure**: Follow existing `protocol-editor-save-node-geometry.test.ts` patterns — simulate state change during `await` via mutator mock

## Scope

### Building

- Generation counter guard for `saveNodeGeometry` in `ProtocolEditorView`
- Dynamic backward bend formula in `computeEdgeBend()`
- No-backtracking invariant tests for backward edge routes
- Node creation flash fix (reorder `.then()` blocks) in `addNodeAtWorldPoint` + `addNodeAndConnectAtWorldPoint`
- Library wiring disconnection from `main.ts`, `settings.ts`, `snippet-manager-view.ts`, `tree-renderer.ts`
- Deletion of 7 source files + 5 test files
- i18n key removal (~56 keys per locale)
- CSS cleanup: delete `library-preview-modal.css`, remove library block from `snippet-manager.css`
- `esbuild.config.mjs` CSS bundle update
- Test mock cleanup: `requestUrl` stubs and `libraryUrl`/`protocolLibraryUrl` fields

### Not Building

- `protocolDocumentStore.update()` read-mutex fix — separate latent issue beyond scope
- `nodeElementById` Map stale-entry cleanup — benign, no current iteration over the map
- Guarding `:1886`, `:2123`, `:2147` `void` call sites with generation counter — these call `loadProtocol()` which increments the counter; no additional guard needed
- `stroke-linejoin: round; stroke-linecap: round` CSS in `protocol-editor.css:102-108` — unrelated to library removal, applies globally to all SVG edges

## Decisions

### Generation Counter Supersedes protocolPath Guard

**Ambiguity**: The existing `protocolPath` guard at `saveNodeGeometry():1469` catches navigation to a different protocol file but not same-file reload (the actual race window). The `loadGeneration` counter catches both. Keep both or replace?

**Decision**: Replace. `loadGeneration` is a strict superset — every `loadProtocol()` call increments it regardless of whether the path changes. The `protocolPath` guard becomes redundant. Cleaner code, one guard instead of two.

**Evidence**: `loadProtocol():488-506` is the only place `this.protocolPath` is set. Every path change goes through `loadProtocol()`. No path-switch-without-generation-bump scenario exists (`src/views/protocol-editor-view.ts:488-506`).

### Dynamic Backward Bend Formula

**Decision**: Replace fixed `BACKWARD_OFFSET / 2` (20px) with `Math.min(BACKWARD_OFFSET, Math.abs(normalDelta) / 2, CONFIGURED_MAX_BEND)` — matching the forward branch's dynamic clamping logic.

**Evidence**: Forward branch at `computeEdgeBend():317-326` already uses this pattern. The backward route geometry at `:394-432` has the same constraints (L1/L5 length = `BACKWARD_OFFSET - bend` ≥ 0, L2/L4 cross-direction = `|normalDelta| - 2*bend` ≥ 0). The conservative bound `|normalDelta|/2` is always ≤ the actual L2/L4 constraint because TB adds 40-56px margin via `max()` (`src/views/protocol-editor-view.ts:317-326, 394-432`).

### Modal-First Node Creation

**Decision**: Reorder `openEditModal()` before `await loadProtocol()` in both `addNodeAtWorldPoint()` and `addNodeAndConnectAtWorldPoint()` — backdrop paints first, hides the synchronous `container.empty()` teardown.

**Evidence**: `openEditModal()` creates a modal backdrop at `:1901-1903` that covers the viewport. `loadProtocol()` triggers `renderShell():512` → `container.empty()` which destroys all DOM synchronously. Backdrop-first means the teardown is hidden. `newNode` reference is a local `const` closed over by `.then()`, not mutated by `loadProtocol()` (which creates new objects from disk) (`src/views/protocol-editor-view.ts:621-636, 687-730, 1901-1903`).

### Library Removal Approach

**Decision**: Follow `e1d9b3a` precedent — disconnect wiring first (Slice 3), then delete files + clean up secondary references (Slice 4). Verify zero remaining imports via grep before deletion.

**Evidence**: Admin panel removal (`e1d9b3a`) used the same layered approach: `a72a971` disconnected wiring (imports, commands, settings UI), `e1d9b3a` deleted files + types + i18n + CSS + config + docs. Zero follow-up fixes. Both commits were independently compilable and testable (`git show e1d9b3a`).

### i18n Export Keys Never Existed

**Discovery**: The `exportLibraryContribution()` method references `snippetManager.exportContributionSaved`, `exportContributionFailed`, and `exportContributionRawMarkdownUnsupported` — but grep confirms these keys never existed in `en.json` or `ru.json`. No i18n cleanup is needed for these keys. The actual library-related keys to remove are: `library` block (~37 keys), `protocolLibrary` block (~17 keys), and `snippetManager.libraryButton`/`libraryButtonAria` (2 keys) — approximately 56 keys per locale.

## Architecture

### `src/views/protocol-editor-view.ts` — MODIFY

**Change 1**: Add `loadGeneration` field after `private zoom: number = 1;` (line 455):
```typescript
  private loadGeneration = 0;
```

**Change 2**: Increment `loadGeneration` at the start of `loadProtocol()`, before `this.protocolPath = file.path;` (line 501):
```typescript
    this.loadGeneration++;
    this.protocolPath = file.path;
```

**Change 3a**: Snapshot generation in `saveNodeGeometry()`, after `const protocolPath = this.protocolPath;` (line 1448):
```typescript
    const protocolPath = this.protocolPath;
    const generation = this.loadGeneration;
    if (protocolPath === null) return;
```

**Change 3b**: Replace `protocolPath` guard with generation guard (line 1469):
```typescript
      if (this.loadGeneration !== generation) return;
```
(replaces `if (this.protocolPath !== protocolPath) return;`)

> **Note**: `onClose():481` sets `this.protocolPath = null` without incrementing `loadGeneration`. The old guard would catch a post-close save, the new one doesn't. By-design: the view is disposed — `this.doc = updated` is harmless, DOM references are stale. Non-disposal scenarios are fully covered.

### `src/views/protocol-editor-view.ts` — MODIFY (Slice 2: non-overlapping with Slice 1)

**Change 4**: Fix `computeEdgeBend()` backward branch (lines 328-331). Replace the fixed formula:
```typescript
  // Backward: exit/entry offset constrains first/last L: BACKWARD_OFFSET - bend >= 0
  // Middle horizontal: routeX/routeY extends beyond nodes, midSpace = |normalDelta|/2 + BACKWARD_OFFSET
  // gives bend <= midSpace/2. Conservative: limit to BACKWARD_OFFSET/2.
  return Math.max(0, Math.min(BACKWARD_OFFSET / 2, CONFIGURED_MAX_BEND));
```
With dynamic clamp:
```typescript
  // Backward: exit/entry offset constrains first/last L: BACKWARD_OFFSET - bend >= 0
  // Cross-direction constraint: L2 + L4 = |normalDelta| - 2*bend >= 0 → bend <= |normalDelta|/2
  // Conservative bound |normalDelta|/2 always ≤ actual L2/L4 constraint (TB adds 40-56px margin).
  return Math.max(0, Math.min(
    BACKWARD_OFFSET,
    Math.abs(normalDelta) / 2,
    CONFIGURED_MAX_BEND,
  ));
```

**Change 5**: Reorder `openEditModal` before `loadProtocol` in `addNodeAtWorldPoint()` (lines 629-632):
```typescript
    }).then(async () => {
      this.openEditModal(newNode, { autofocusFirstTextField: true });
      await this.loadProtocol(this.protocolPath!);
      new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
```

**Change 6**: Same reorder in `addNodeAndConnectAtWorldPoint()` (lines 723-726):
```typescript
    }).then(async () => {
      this.openEditModal(newNode, { autofocusFirstTextField: true });
      await this.loadProtocol(this.protocolPath!);
      new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
```

### `src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — MODIFY

**Change 4**: Update existing test (rename + bump `loadGeneration` during mutator). Replace test body at lines 90-115:
```typescript
  it('does not mutate the active view when a concurrent loadProtocol occurs while saving', async () => {
    const node = makeNode({ x: 42, y: 43 });
    const otherDoc = makeDoc(makeNode({ id: 'other-node' }));
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      const updated = mutator(makeDoc(makeNode()));
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).protocolPath = 'Protocols/other.rp.json';
      (viewRef as any).doc = otherDoc;
      (viewRef as any).loadGeneration += 1;
      return updated;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));
    viewRef = view;

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((view as any).protocolPath).toBe('Protocols/other.rp.json');
    expect((view as any).doc).toBe(otherDoc);
    expect(nodeEl.attrs['style']).toBeUndefined();
    expect(updateEdgePaths).not.toHaveBeenCalled();
    expect(renderMinimap).not.toHaveBeenCalled();
  });
```

**Change 5**: Add new test after the above (same-path reload — the actual race window):
```typescript
  it('abandons stale save when a concurrent loadProtocol occurs on the same path', async () => {
    const node = makeNode({ x: 10, y: 20 });
    const updatedDoc = makeDoc(makeNode({ id: 'updated-node' }));
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      const updated = mutator(makeDoc(makeNode()));
      if (viewRef === null) throw new Error('view not initialized');
      // Simulate a concurrent loadProtocol on the same path
      (viewRef as any).doc = updatedDoc;
      (viewRef as any).loadGeneration += 1;
      return updated;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));
    viewRef = view;

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((view as any).protocolPath).toBe('Protocols/current.rp.json');
    expect((view as any).doc).toBe(updatedDoc);
    expect(nodeEl.attrs['style']).toBeUndefined();
    expect(updateEdgePaths).not.toHaveBeenCalled();
    expect(renderMinimap).not.toHaveBeenCalled();
  });
```

**Change 7**: Update backward LR test assertions (lines 143-149). Bend changes from 20 to 10:
```typescript
    it('routes backward horizontal edges around nodes instead of through them', () => {
      const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
      // Dynamic bend: backward LR, normalDelta=20 → min(40, 10, 32) = 10
      expect(route.d).toContain('L 540 158');
      expect(route.d).toContain('L 150 168');
      expect(route.labelY).toBeGreaterThan(120);
    });
```

**Change 8**: Update backward TB comment only (line 169). Bend unchanged (|normalDelta|=40 → 20):
```typescript
      // Dynamic bend: backward TB, |normalDelta|=40 → min(40, 20, 32) = 20
```

**Change 9**: Add backward no-backtracking invariant tests after the existing forward tests (after line 252):
```typescript
    it('does not produce degenerate segments on short backward horizontal routes', () => {
      const route = protocolEditorEdgeRoute(500, 100, 460, 120, 'LR');
      // rankDelta=-40, normalDelta=20 → bend = min(40, 10, 32) = 10
      expect(route.d).not.toContain('NaN');
      const qCount = (route.d.match(/Q/g) || []).length;
      expect(qCount).toBe(4); // backward routes have 4 Q-curves
      expect(route.labelX).toBeGreaterThanOrEqual(480);
    });

    it('does not produce degenerate segments on short backward vertical routes', () => {
      const route = protocolEditorEdgeRoute(200, 320, 220, 300, 'TB');
      // rankDelta=-20, normalDelta=20 → bend = min(40, 10, 32) = 10
      expect(route.d).not.toContain('NaN');
      const qCount = (route.d.match(/Q/g) || []).length;
      expect(qCount).toBe(4);
      expect(route.labelX).toBeGreaterThan(240);
    });
```

> **Note**: Backward route invariants check structural well-formedness (NaN absence, 4 Q-curves, label placement) rather than full rank-monotonicity. Backward routes naturally decrease in rank direction — the "no-backtracking" concern for backward routes is degenerate segment lengths (negative space), which the dynamic clamp eliminates. The Q-count invariant catches structural collapse; the NaN check catches arithmetic failure.

### `src/main.ts` — MODIFY

**Remove lines 10-11 (2 imports)**:
```typescript
// DELETE: import { LibraryService } from './snippets/library-service';
// DELETE: import { ProtocolLibraryService } from './protocol/protocol-library-service';
```

**Remove line 19 (1 import)**:
```typescript
// DELETE: import { ProtocolLibraryBrowserModal } from './views/protocol-library-browser-modal';
```

**Remove lines 36-37 (2 property declarations)**:
```typescript
// DELETE: libraryService!: LibraryService;
// DELETE: protocolLibraryService!: ProtocolLibraryService;
```

**Remove lines 65-69 (2 service instantiations)**:
```typescript
// DELETE:
// this.libraryService = new LibraryService(this.app, this.settings, this.snippetService, this.i18n.t.bind(this.i18n));
// this.protocolLibraryService = new ProtocolLibraryService(this.app, this.settings, this.protocolDocumentStore, this.i18n.t.bind(this.i18n));
```

**Remove lines 113-117 (browse-protocol-library command)**:
```typescript
// DELETE:
// this.addCommand({
//   id: 'browse-protocol-library',
//   name: 'Browse protocol library',
//   callback: () => { new ProtocolLibraryBrowserModal(this.app, this).open(); },
// });
```

### `src/settings.ts` — MODIFY

> **Moved to Slice 4**: `DEFAULT_LIBRARY_URL`, `DEFAULT_PROTOCOL_LIBRARY_URL` constants, `libraryUrl`/`protocolLibraryUrl` interface fields and defaults. Removing them before library files are deleted would break `library-service.ts:4` and `protocol-library-service.ts:4` which still import from settings. Following `e1d9b3a` precedent: constants/fields/defaults removed in deletion phase, not disconnection phase.

No changes in Slice 3.

### `src/views/snippet-manager-view.ts` — MODIFY

**Narrow import at line 11**:
```typescript
// OLD: import type { Snippet, MdTemplateSnippet } from '../snippets/snippet-model';
// NEW: import type { Snippet } from '../snippets/snippet-model';
```

**Remove line 12**:
```typescript
// DELETE: import { serializeMarkdownTemplate } from '../snippets/md-template';
```

**Remove line 15**:
```typescript
// DELETE: import { LibraryBrowserModal } from './library-browser-modal';
```

**Remove lines 94-101 (library button DOM)**:
```typescript
// DELETE:
// const libBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn', ... });
// ... setIcon(libIcon, 'globe'); ...
// this.registerDomEvent(libBtn, 'click', () => { void this.openLibraryBrowser(); });
```

**Remove line 131 (callback wiring)**:
```typescript
// DELETE: exportLibraryContribution: (path) => this.exportLibraryContribution(path),
```

**Remove lines 585-621 (openLibraryBrowser + exportLibraryContribution methods)**:
```typescript
// DELETE:
// private openLibraryBrowser(): void { new LibraryBrowserModal(this.app, this.plugin).open(); }
// private async exportLibraryContribution(path: string): Promise<void> { ... }
```

**Remove `ensureFolderPath` import at line 21** (only consumer was `exportLibraryContribution`):
```typescript
// DELETE: import { ensureFolderPath } from '../utils/vault-utils';
```

### `src/views/snippet-manager/tree-renderer.ts` — MODIFY

**Remove line 59 (callback slot)**:
```typescript
// DELETE: exportLibraryContribution(path: string): Promise<void>;
```

### `src/settings.ts` — MODIFY

> Settings constants/fields moved here from Slice 3. Following `e1d9b3a` precedent: constants removed in deletion phase alongside files that import them.

**Remove lines 20-21 (2 constants)** — only imported by `library-service.ts:4` and `protocol-library-service.ts:4`, both deleted in this slice:
```typescript
// DELETE: export const DEFAULT_LIBRARY_URL = '...';
// DELETE: export const DEFAULT_PROTOCOL_LIBRARY_URL = '...';
```

**Remove lines 37, 39 (2 interface fields)**:
```typescript
// DELETE: libraryUrl: string;
// DELETE: protocolLibraryUrl: string;
```

**Remove lines 49-50 (2 defaults)**:
```typescript
// DELETE: libraryUrl: DEFAULT_LIBRARY_URL,
// DELETE: protocolLibraryUrl: DEFAULT_PROTOCOL_LIBRARY_URL,
```

### `src/snippets/library-service.ts` — DELETE

### `src/snippets/library-model.ts` — DELETE

### `src/protocol/protocol-library-service.ts` — DELETE

### `src/protocol/protocol-library-model.ts` — DELETE

### `src/views/library-browser-modal.ts` — DELETE

### `src/views/library-snippet-preview-modal.ts` — DELETE

### `src/views/protocol-library-browser-modal.ts` — DELETE

### `src/__tests__/library-service.test.ts` — DELETE

### `src/__tests__/protocol-library-service.test.ts` — DELETE

### `src/__tests__/library-browser-modal.test.ts` — DELETE

### `src/__tests__/library-snippet-preview-modal.test.ts` — DELETE

### `src/__tests__/views/library-browser-modal-aria.test.ts` — DELETE

### `esbuild.config.mjs` — MODIFY

Remove `'library-preview-modal'` from the `CSS_FILES` array:
```javascript
// DELETE: 'library-preview-modal',
```

### `src/i18n/locales/en.json` — MODIFY

Remove three blocks:
1. `snippetManager.libraryButton` + `libraryButtonAria` (2 keys, ~lines 182-185)
2. Entire `"library": {}` block (~37 keys, ~lines 333-369)
3. Entire `"protocolLibrary": {}` block (~17 keys, ~lines 370-386)

> **Note**: `exportContributionSaved`, `exportContributionFailed`, `exportContributionRawMarkdownUnsupported` keys never existed — no removal needed.

### `src/i18n/locales/ru.json` — MODIFY

Same three blocks as en.json — identical structural ranges with Russian values.

### `src/styles/library-preview-modal.css` — DELETE

### `src/styles/snippet-manager.css` — MODIFY

Remove ~155-line library CSS block (lines 538-694): all `.rp-library-*`, `.rp-protocol-library-*`, and related selectors. Block starts after `/* Phase 86/87: Library browser modal */` comment.

### `src/__tests__/snippet-service.test.ts` — MODIFY

Remove `libraryUrl` and `protocolLibraryUrl` from mock settings (lines 88-89):
```typescript
// DELETE: libraryUrl: '',
// DELETE: protocolLibraryUrl: '',
```

### `src/__tests__/snippet-service-move.test.ts` — MODIFY

Same — remove `libraryUrl` and `protocolLibraryUrl` from mock settings (lines 120-121).

### `src/__tests__/snippet-vault-watcher.test.ts` — MODIFY

Remove `requestUrl` stub (lines 142, 157-158):
```typescript
// DELETE comment at line 142: "// Phase 86: Modal / requestUrl stubs — library-browser-modal.ts imports them"
// DELETE: const requestUrl = vi.fn();
// Remove `requestUrl` from the return object
```

### `src/__tests__/snippet-tree-view.test.ts` — MODIFY

Remove `requestUrl` stub (lines 193, 208-209).

### `src/__tests__/snippet-tree-inline-rename.test.ts` — MODIFY

Remove `requestUrl` stub (lines 194, 209-210).

## Slices

### Slice 1: Generation Counter Guard

**Files**: `src/views/protocol-editor-view.ts`, `src/__tests__/views/protocol-editor-save-node-geometry.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [ ] Grep for old protocolPath guard is gone: `grep -n "if (this.protocolPath !== protocolPath)" src/views/protocol-editor-view.ts` returns no matches
- [ ] Grep for new generation guard exists: `grep -n "if (this.loadGeneration !== generation)" src/views/protocol-editor-view.ts` returns exactly 1 match

#### Manual Verification:
- [ ] Drag a node, immediately click auto-layout button during the save — node position from drag should NOT overwrite auto-layout result
- [ ] Drag a node in a protocol with 10+ nodes — position persisted correctly on disk
- [ ] Resize a node — geometry persisted correctly on disk

### Slice 2: Elbow Connector + Flash Fixes

**Files**: `src/views/protocol-editor-view.ts`, `src/__tests__/protocol-editor-helpers.test.ts`

#### Automated Verification:

#### Manual Verification:

### Slice 3: Library Disconnection

**Files**: `src/main.ts`, `src/views/snippet-manager-view.ts`, `src/views/snippet-manager/tree-renderer.ts`

> **Note**: `src/settings.ts` changes moved to Slice 4 — constants/fields removed alongside library files that import them, following `e1d9b3a` precedent.

#### Automated Verification:
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Build passes: `npm run build`
- [ ] Grep for removed imports: `grep -rn "LibraryService\|ProtocolLibraryService\|LibraryBrowserModal\|ProtocolLibraryBrowserModal" src/main.ts src/settings.ts src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts` returns no matches
- [ ] Grep for removed settings: `grep -rn "DEFAULT_LIBRARY_URL\|DEFAULT_PROTOCOL_LIBRARY_URL\|libraryUrl\|protocolLibraryUrl" src/settings.ts` returns no matches
- [ ] Grep for `exportLibraryContribution` in tree-renderer.ts returns no match: `grep -n "exportLibraryContribution" src/views/snippet-manager/tree-renderer.ts` returns no output

#### Manual Verification:
- [ ] Snippet manager view opens without errors (no library button visible)
- [ ] Plugin loads without console errors
- [ ] Settings tab renders without library URL fields

### Slice 4: Library Deletion + Cleanup

**Files**: 12 deleted, `src/settings.ts`, `esbuild.config.mjs`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/styles/library-preview-modal.css`, `src/styles/snippet-manager.css`, `src/__tests__/snippet-service.test.ts`, `src/__tests__/snippet-service-move.test.ts`, `src/__tests__/snippet-vault-watcher.test.ts`, `src/__tests__/snippet-tree-view.test.ts`, `src/__tests__/snippet-tree-inline-rename.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Build passes: `npm run build`
- [ ] Full test suite passes: `npm test`
- [ ] Zero library imports remain: `grep -rn "LibraryService\|ProtocolLibraryService\|LibraryBrowserModal\|ProtocolLibraryBrowserModal\|LibrarySnippetPreviewModal\|library-model\|protocol-library-model\|library-service\|protocol-library-service" src/ --include="*.ts"` returns no matches
- [ ] Zero library i18n keys: `grep -c '"library"' src/i18n/locales/en.json src/i18n/locales/ru.json` both return 0
- [ ] Zero protocolLibrary i18n keys: `grep -c '"protocolLibrary"' src/i18n/locales/en.json src/i18n/locales/ru.json` both return 0
- [ ] CSS bundle clean: `grep "library-preview-modal" esbuild.config.mjs` returns no match
- [ ] Zero library CSS in snippet-manager: `grep -c "rp-library" src/styles/snippet-manager.css` returns 0
- [ ] Zero requestUrl stubs: `grep -rn "requestUrl" src/__tests__/snippet-vault-watcher.test.ts src/__tests__/snippet-tree-view.test.ts src/__tests__/snippet-tree-inline-rename.test.ts` returns no matches
- [ ] Zero libraryUrl in test mocks: `grep -rn "libraryUrl\|protocolLibraryUrl" src/__tests__/ --include="*.ts"` returns no matches (or only in deleted files)

#### Manual Verification:
- [ ] Plugin Settings tab: no library URL fields visible
- [ ] Snippet Manager: no Library button
- [ ] Command palette: "Browse protocol library" command not found
- [ ] Library CSS styles not visible in devtools

## Desired End State

After all slices are applied:

1. **Drag race fixed**: Dragging a node and clicking auto-layout during the save no longer causes position/AutoLayout collision. The stale `saveNodeGeometry()` silently abandons.
2. **Elbow connectors smooth**: Backward edge routes use dynamic bend like forward routes — no jagged 20px corners on short connections.
3. **No flash on node creation**: Double-clicking the canvas shows the kind picker, then the edit modal; the protocol reload is invisible behind the backdrop.
4. **Library code gone**: Zero library-related imports, commands, settings, i18n keys, CSS rules, or test files remain. `npm run build` and `npm test` pass cleanly.

## File Map

```
src/views/protocol-editor-view.ts                                  # MODIFY — generation counter, elbow bend, flash reorder
src/__tests__/views/protocol-editor-save-node-geometry.test.ts     # MODIFY — generation counter guard test
src/__tests__/protocol-editor-helpers.test.ts                      # MODIFY — backward LR test + no-backtracking invariants
src/main.ts                                                        # MODIFY — strip library wiring
src/settings.ts                                                    # MODIFY — remove library constants/fields/defaults
src/views/snippet-manager-view.ts                                  # MODIFY — remove library UI/methods/callback
src/views/snippet-manager/tree-renderer.ts                         # MODIFY — remove exportLibraryContribution slot
src/snippets/library-service.ts                                    # DELETE
src/snippets/library-model.ts                                      # DELETE
src/protocol/protocol-library-service.ts                           # DELETE
src/protocol/protocol-library-model.ts                             # DELETE
src/views/library-browser-modal.ts                                 # DELETE
src/views/library-snippet-preview-modal.ts                         # DELETE
src/views/protocol-library-browser-modal.ts                        # DELETE
src/__tests__/library-service.test.ts                              # DELETE
src/__tests__/protocol-library-service.test.ts                     # DELETE
src/__tests__/library-browser-modal.test.ts                        # DELETE
src/__tests__/library-snippet-preview-modal.test.ts                # DELETE
src/__tests__/views/library-browser-modal-aria.test.ts             # DELETE
esbuild.config.mjs                                                 # MODIFY — remove library-preview-modal from bundle
src/i18n/locales/en.json                                           # MODIFY — remove ~56 library keys
src/i18n/locales/ru.json                                           # MODIFY — remove ~56 library keys
src/styles/library-preview-modal.css                               # DELETE
src/styles/snippet-manager.css                                     # MODIFY — remove ~155-line library CSS block
src/__tests__/snippet-service.test.ts                              # MODIFY — remove libraryUrl/protocolLibraryUrl mocks
src/__tests__/snippet-service-move.test.ts                         # MODIFY — same
src/__tests__/snippet-vault-watcher.test.ts                        # MODIFY — remove requestUrl stub
src/__tests__/snippet-tree-view.test.ts                            # MODIFY — remove requestUrl stub
src/__tests__/snippet-tree-inline-rename.test.ts                   # MODIFY — remove requestUrl stub
```

## Ordering Constraints

- Slice 1 → Slice 2: Both modify `protocol-editor-view.ts` in non-overlapping regions. Slice 1 goes first as it's the structural change (new field). Slice 2 touches different functions.
- Slice 3 must complete before Slice 4: File deletion in Slice 4 would break compilation if Slice 3 hasn't removed the imports first.
- Slices 1-2 (protocol editor) are independent of Slices 3-4 (library removal). They could run in parallel, but sequential within the design artifact.

## Verification Notes

- **Build**: `npm run build` must pass after each slice (terminal slices only)
- **Tests**: `npm test` must pass after Slice 2 and Slice 4
- **Elbow backward LR**: Test at `protocol-editor-helpers.test.ts:143-149` — `normalDelta=20`, new bend = `min(40, 10, 32) = 10`. Assertions `'L 540 148'` and `'L 140 168'` break; must recalculate with bend=10
- **Elbow backward TB**: Test at `:167-172` — `|normalDelta|=40`, new bend = `min(40, 20, 32) = 20`. Unchanged. Only comment at `:169` needs updating
- **Forward tests**: All forward route tests (`:129-141, :151-165, :237-252`) unaffected — dynamic clamp already active
- **Drag race guard**: Simulate concurrent `loadProtocol` by incrementing a mock generation counter during `update()`'s mutator callback. Verify `this.doc` is not overwritten and `applyNodePosition` is not called
- **Library grep**: `grep -rn "LibraryService\|ProtocolLibraryService\|LibraryBrowserModal\|ProtocolLibraryBrowserModal\|LibrarySnippetPreviewModal\|library-model\|protocol-library-model\|library-service\|protocol-library-service\|DEFAULT_LIBRARY_URL\|DEFAULT_PROTOCOL_LIBRARY_URL\|libraryUrl\|protocolLibraryUrl" src/ --include="*.ts"` must return zero matches after Slice 4 (except comments referencing removal)
- **i18n symmetry**: Both `en.json` and `ru.json` must have identical key structure after removal — grep for `library` and `protocolLibrary` keys must return zero matches in both files
- **Precedent**: Edge routing changes are the most fragile editor change type (4 follow-up fixes across `5ba8e05`). String-comparison tests miss backtracking — invariant tests are essential
- **Precedent**: Incremental editor updates must refresh ALL dependent UI surfaces (recurred 3×). The `container.empty()` in `renderShell()` resets everything, but the minimap was forgotten 3×. Verify minimap renders correctly after each change

## Performance Considerations

- **Generation counter**: Single integer increment per `loadProtocol()` and single integer compare per `saveNodeGeometry()` — negligible overhead
- **Elbow bend**: `Math.min()` of 3 values per edge route — no measurable perf change (already O(1))
- **Flash fix**: No perf impact — same operations, different order
- **Library removal**: Fewer files to bundle, fewer CSS rules to parse — slight build time and CSS parse improvement

## Migration Notes

Not applicable — no persisted schema changes. The `libraryUrl` and `protocolLibraryUrl` settings fields are removed from the interface; existing `data.json` files with these fields will silently ignore them (Obsidian merges loaded data with `DEFAULT_SETTINGS`, extra keys are benign).

## Pattern References

- `src/runner/render/render-snippet-picker.ts:83-105` — T-30-04 stale-result guard (snapshot-before-async, compare-after)
- `src/views/protocol-editor-view.ts:1469` — existing `protocolPath` guard (being replaced by generation counter)
- `src/views/protocol-editor-view.ts:317-326` — forward branch dynamic bend (model for backward fix)
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:90-115` — existing test for protocolPath guard (model for generation counter test)
- `git show e1d9b3a` — admin panel removal precedent (model for library removal)
- `src/__tests__/protocol-editor-helpers.test.ts:237-252` — no-backtracking invariant test (model for backward invariant)

## Developer Context

**Q (discover: D1 — Intent): Who are you in this picture, and what does success look like for you when this work is done?**
A: Plugin maintainer — shipping quality

**Q (discover: D2 — Cleanup scope): Remove the entire shared library system — services, UI, settings, CSS, i18n, and tests?**
A: Full removal

**Q (discover: D3 — Elbow connector fix): Should we make the backward bend dynamic like the forward branch?**
A: Dynamic backward bend

**Q (discover: D4 — Node creation flash): How should we fix the canvas flash?**
A: Modal first, then reload

**Q (discover: D5 — Drag fix approach): How should I approach the drag issue?**
A: Investigate root cause first

**Q (discover: D6 — Cleanup verification): How strict should the verification be?**
A: Build + grep + visual check

**Q (discover: D7 — Elbow verification): What verification is needed?**
A: Visual inspection + existing tests pass

**Q (discover: D8 — Drag verification): What should be verified?**
A: Sequential drag test

**Q (discover: D9 — Flash verification): What verification is needed?**
A: No visible flash

**Q (`src/views/protocol-editor-view.ts:1384` + `:1459`): Drag leak is a race between `void saveNodeGeometry()` (fire-and-forget) yielding at `await :1459` and a concurrent `loadProtocol()`. Four `void` call sites share this race (`:1384, :1886, :2123, :2147`). Fix approach?**
A: Guard with generation counter — detect concurrent `loadProtocol` and abandon stale saves

**Q (design: Direction): Replace `protocolPath` guard with generation counter or keep both?**
A: Replace — generation counter is a strict superset, cleaner code

**Q (design: I18n correction): ~56 keys per locale to remove (library + protocolLibrary blocks + 2 button keys). Export keys never existed. Confirm?**
A: Correct — remove ~56 keys

## Design History

- Slice 4: Library Deletion + Cleanup — approved as generated
- Slice 3: Library Disconnection — approved as generated
- Slice 2: Elbow Connector + Flash Fixes — approved as generated (fixed: grep criterion + test assertion)
- Slice 1: Generation Counter Guard — approved as generated

## References

- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — parent research artifact
- `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-rendering-and-drag.md` — prior edge/drag research
- `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md` — FRD
- `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md` — 3-phase edge/drag fix plan
- `git show e1d9b3a` — admin panel removal precedent
