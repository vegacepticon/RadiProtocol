---
date: 2026-06-02T18:26:22+0300
author: Roman Shulgha
commit: 7320c28
branch: main
repository: RadiProtocol
topic: "Cleanup and UX fixes — shared library removal, connector rendering, drag, node creation flash"
tags: [plan, cleanup, protocol-editor, edge-routing, drag, flash, library-removal]
status: ready
parent: ".rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md"
last_updated: 2026-06-02T18:26:22+0300
last_updated_by: Roman Shulgha
---

# Cleanup and UX Fixes Implementation Plan

## Overview

Implement the ready design from `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`: fix stale async drag saves with a generation counter, make backward elbow connector bends dynamic, hide node-creation reload flash behind the edit modal, and remove the abandoned shared library subsystem. Phase boundaries are inherited 1:1 from the design's `## Slices` section.

## Desired End State

After all phases are applied:

1. **Drag race fixed**: Dragging a node and clicking auto-layout during the save no longer causes position/AutoLayout collision. The stale `saveNodeGeometry()` silently abandons.
2. **Elbow connectors smooth**: Backward edge routes use dynamic bend like forward routes — no jagged 20px corners on short connections.
3. **No flash on node creation**: Double-clicking the canvas shows the kind picker, then the edit modal; the protocol reload is invisible behind the backdrop.
4. **Library code gone**: Zero library-related imports, commands, settings, i18n keys, CSS rules, or test files remain. `npm run build` and `npm test` pass cleanly.

## What We're NOT Doing

- `protocolDocumentStore.update()` read-mutex fix — separate latent issue beyond scope
- `nodeElementById` Map stale-entry cleanup — benign, no current iteration over the map
- Guarding `:1886`, `:2123`, `:2147` `void` call sites with generation counter — these call `loadProtocol()` which increments the counter; no additional guard needed
- `stroke-linejoin: round; stroke-linecap: round` CSS in `protocol-editor.css:102-108` — unrelated to library removal, applies globally to all SVG edges

## Phase 1: Generation Counter Guard

### Overview
Add a protocol-load generation counter to `ProtocolEditorView` and make `saveNodeGeometry()` abandon stale async results when a concurrent `loadProtocol()` occurs, including same-path reloads. Update save-geometry tests to simulate both different-path and same-path concurrent loads.

### Changes Required:

#### 1. Protocol editor view generation guard
**File**: `src/views/protocol-editor-view.ts`
**Changes**: Add `loadGeneration`, increment in `loadProtocol()`, snapshot in `saveNodeGeometry()`, and replace the old protocol-path post-await guard with a generation guard.

```typescript
// Add after: private zoom: number = 1;
private loadGeneration = 0;

// In loadProtocol(), before assigning protocolPath:
this.loadGeneration++;
this.protocolPath = file.path;

// In saveNodeGeometry(), after protocolPath snapshot:
const protocolPath = this.protocolPath;
const generation = this.loadGeneration;
const isStaleSave = () => this.loadGeneration !== generation;
if (protocolPath === null) return;

// Inside the protocolDocumentStore.update() mutator, after the missing-file check
// but before constructing mutated node geometry:
if (isStaleSave()) return existing;

// After awaiting protocolDocumentStore.update(), replace old path guard:
if (this.loadGeneration !== generation) return;
```

> **Review triage note**: The in-mutator stale check is plan-local review hardening. It prevents stale geometry mutation from being returned to `protocolDocumentStore.update()` when the generation changed during the async read window; the post-update guard still prevents stale in-memory/DOM updates after the write path returns.

> **Note**: `onClose():481` sets `this.protocolPath = null` without incrementing `loadGeneration`. The design intentionally accepts this because the view is disposed and `this.doc = updated` is harmless; non-disposal scenarios are covered by the generation guard.

#### 2. Save-node-geometry race tests
**File**: `src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
**Changes**: Update the concurrent-load test to bump `loadGeneration`, and add same-path reload coverage for the actual race window.

```typescript
it('does not mutate the active view when a concurrent loadProtocol occurs while saving', async () => {
  const node = makeNode({ x: 42, y: 43 });
  const otherDoc = makeDoc(makeNode({ id: 'other-node' }));
  let viewRef: ProtocolEditorView | null = null;
  const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
    if (viewRef === null) throw new Error('view not initialized');
    (viewRef as any).protocolPath = 'Protocols/other.rp.json';
    (viewRef as any).doc = otherDoc;
    (viewRef as any).loadGeneration += 1;
    const existingDoc = makeDoc(makeNode());
    const updated = mutator(existingDoc);
    expect(updated).toBe(existingDoc);
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

it('abandons stale save when a concurrent loadProtocol occurs on the same path', async () => {
  const node = makeNode({ x: 10, y: 20 });
  const updatedDoc = makeDoc(makeNode({ id: 'updated-node' }));
  let viewRef: ProtocolEditorView | null = null;
  const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
    if (viewRef === null) throw new Error('view not initialized');
    // Simulate a concurrent loadProtocol on the same path before mutation
    (viewRef as any).doc = updatedDoc;
    (viewRef as any).loadGeneration += 1;
    const existingDoc = makeDoc(makeNode());
    const updated = mutator(existingDoc);
    expect(updated).toBe(existingDoc);
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

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [x] Grep for old protocolPath guard is gone: `grep -n "if (this.protocolPath !== protocolPath)" src/views/protocol-editor-view.ts` returns no matches
- [x] Grep for new generation guard exists: `grep -n "if (this.loadGeneration !== generation)" src/views/protocol-editor-view.ts` returns exactly 1 match
- [x] Non-stale geometry save still refreshes dependent UI: positive save/resize coverage verifies `renderMinimap()` is called after accepted geometry updates

#### Manual Verification:
- [ ] Drag a node, immediately click auto-layout button during the save — node position from drag should NOT overwrite auto-layout result
- [ ] Drag a node in a protocol with 10+ nodes — position persisted correctly on disk
- [ ] Resize a node — geometry persisted correctly on disk

---

## Phase 2: Elbow Connector + Flash Fixes

### Overview
Replace the fixed backward elbow bend with the dynamic clamp from the design, reorder node creation reloads behind the edit modal backdrop in both node creation flows, and update edge route tests/comments plus backward route invariants.

### Changes Required:

#### 1. Protocol editor bend and flash behavior
**File**: `src/views/protocol-editor-view.ts`
**Changes**: Update `computeEdgeBend()` backward branch and reorder `openEditModal()` before `loadProtocol()` in both node creation `.then()` blocks.

```typescript
// Replace the backward branch in computeEdgeBend():
// Backward: exit/entry offset constrains first/last L: BACKWARD_OFFSET - bend >= 0
// Cross-direction constraint: L2 + L4 = |normalDelta| - 2*bend >= 0 → bend <= |normalDelta|/2
// Conservative bound |normalDelta|/2 always ≤ actual L2/L4 constraint (TB adds 40-56px margin).
return Math.max(0, Math.min(
  BACKWARD_OFFSET,
  Math.abs(normalDelta) / 2,
  CONFIGURED_MAX_BEND,
));

// In addNodeAtWorldPoint():
}).then(async () => {
  this.openEditModal(newNode, { autofocusFirstTextField: true });
  await this.loadProtocol(this.protocolPath!);
  new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));

// In addNodeAndConnectAtWorldPoint():
}).then(async () => {
  this.openEditModal(newNode, { autofocusFirstTextField: true });
  await this.loadProtocol(this.protocolPath!);
  new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
```


#### 2. Edge route test updates
**File**: `src/__tests__/protocol-editor-helpers.test.ts`
**Changes**: Update backward LR expectations, update the backward TB dynamic-bend comment, and add short backward route invariant tests.

```typescript
it('routes backward horizontal edges around nodes instead of through them', () => {
  const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
  // Dynamic bend: backward LR, normalDelta=20 → min(40, 10, 32) = 10
  expect(route.d).toContain('L 540 158');
  expect(route.d).toContain('L 150 168');
  expect(route.labelY).toBeGreaterThan(120);
});

// Existing backward TB test comment only:
// Dynamic bend: backward TB, |normalDelta|=40 → min(40, 20, 32) = 20

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

> **Note**: Backward route invariants check structural well-formedness (NaN absence, 4 Q-curves, label placement) rather than full rank-monotonicity. Backward routes naturally decrease in rank direction — the no-backtracking concern is degenerate segment length.

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Build passes: `npm run build`
- [ ] Protocol editor helper tests pass, including existing forward-route tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts`
- [ ] Full test suite passes after this editor slice: `npm test`

#### Manual Verification:

---

## Phase 3: Library Disconnection

### Overview
Disconnect active shared-library wiring while keeping most library files and settings constants in place until the deletion phase. Remove plugin service imports/fields/instantiation/command, remove the Snippet Manager library button and export callback plumbing, remove the dead tree-renderer callback slot, and delete the now-orphaned browser modal files/tests that would otherwise keep compiled references to removed plugin fields.

### Changes Required:

#### 1. Plugin library wiring
**File**: `src/main.ts`
**Changes**: Remove library service/protocol library modal imports, service fields, service instantiation, and the browse-protocol-library command.

```typescript
// DELETE imports:
import { LibraryService } from './snippets/library-service';
import { ProtocolLibraryService } from './protocol/protocol-library-service';
import { ProtocolLibraryBrowserModal } from './views/protocol-library-browser-modal';

// DELETE property declarations:
libraryService!: LibraryService;
protocolLibraryService!: ProtocolLibraryService;

// DELETE service instantiation:
this.libraryService = new LibraryService(this.app, this.settings, this.snippetService, this.i18n.t.bind(this.i18n));
this.protocolLibraryService = new ProtocolLibraryService(this.app, this.settings, this.protocolDocumentStore, this.i18n.t.bind(this.i18n));

// DELETE browse-protocol-library command:
this.addCommand({
  id: 'browse-protocol-library',
  name: 'Browse protocol library',
  callback: () => { new ProtocolLibraryBrowserModal(this.app, this).open(); },
});
```

#### 2. Snippet manager library UI and export wiring
**File**: `src/views/snippet-manager-view.ts`
**Changes**: Remove library-only imports, button creation, callback wiring, and the `openLibraryBrowser` / `exportLibraryContribution` methods.

```typescript
// OLD:
import type { Snippet, MdTemplateSnippet } from '../snippets/snippet-model';
// NEW:
import type { Snippet } from '../snippets/snippet-model';

// DELETE imports:
import { serializeMarkdownTemplate } from '../snippets/md-template';
import { LibraryBrowserModal } from './library-browser-modal';
import { ensureFolderPath } from '../utils/vault-utils';

// DELETE library button DOM construction:
const libBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn', ... });
setIcon(libIcon, 'globe');
this.registerDomEvent(libBtn, 'click', () => { void this.openLibraryBrowser(); });

// DELETE callback wiring:
exportLibraryContribution: (path) => this.exportLibraryContribution(path),

// DELETE methods:
private openLibraryBrowser(): void {
  new LibraryBrowserModal(this.app, this.plugin).open();
}

private async exportLibraryContribution(path: string): Promise<void> {
  // entire method body removed
}
```

#### 3. Snippet tree renderer callbacks
**File**: `src/views/snippet-manager/tree-renderer.ts`
**Changes**: Remove the dead `exportLibraryContribution(path: string): Promise<void>` callback slot.

```typescript
// DELETE from TreeRendererCallbacks:
exportLibraryContribution(path: string): Promise<void>;
```

#### 4. Delete library browser modals and importing tests
**Files**: `src/views/library-browser-modal.ts`, `src/views/protocol-library-browser-modal.ts`, `src/__tests__/library-browser-modal.test.ts`, `src/__tests__/views/library-browser-modal-aria.test.ts`
**Changes**: Delete these now-orphaned files in Phase 3 because `library-browser-modal.ts` still references `this.plugin.libraryService` and `protocol-library-browser-modal.ts` still references `this.plugin.protocolLibraryService`; keeping them compiled after removing the plugin fields would break type checking.

```bash
rm src/views/library-browser-modal.ts
rm src/views/protocol-library-browser-modal.ts
rm src/__tests__/library-browser-modal.test.ts
rm src/__tests__/views/library-browser-modal-aria.test.ts
```

### Success Criteria:

> **Note**: `src/settings.ts` changes moved to Slice 4 — constants/fields removed alongside library files that import them, following `e1d9b3a` precedent.

#### Automated Verification:
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Build passes: `npm run build`
- [ ] Grep for removed imports: `grep -rn "LibraryService\|ProtocolLibraryService\|LibraryBrowserModal\|ProtocolLibraryBrowserModal" src/main.ts src/settings.ts src/views/snippet-manager-view.ts src/views/snippet-manager/tree-renderer.ts` returns no matches
- [ ] Grep for `exportLibraryContribution` in tree-renderer.ts returns no match: `grep -n "exportLibraryContribution" src/views/snippet-manager/tree-renderer.ts` returns no output

#### Manual Verification:
- [ ] Snippet manager view opens without errors (no library button visible)
- [ ] Plugin loads without console errors
- [ ] Settings tab renders without library URL fields

---

## Phase 4: Library Deletion + Cleanup

### Overview
Delete abandoned library source/test/style files and clean secondary settings, CSS bundle, locale, stylesheet, and test mock references. This phase completes the full removal and verifies no library references remain.

### Changes Required:

#### 1. Settings cleanup
**File**: `src/settings.ts`
**Changes**: Remove library URL constants, settings interface fields, and defaults.

```typescript
// DELETE constants:
export const DEFAULT_LIBRARY_URL = '...';
export const DEFAULT_PROTOCOL_LIBRARY_URL = '...';

// DELETE interface fields:
libraryUrl: string;
protocolLibraryUrl: string;

// DELETE defaults:
libraryUrl: DEFAULT_LIBRARY_URL,
protocolLibraryUrl: DEFAULT_PROTOCOL_LIBRARY_URL,
```

#### 2. Delete remaining library source, test, and CSS files
**Files**: `src/snippets/library-service.ts`, `src/snippets/library-model.ts`, `src/protocol/protocol-library-service.ts`, `src/protocol/protocol-library-model.ts`, `src/views/library-snippet-preview-modal.ts`, `src/__tests__/library-service.test.ts`, `src/__tests__/protocol-library-service.test.ts`, `src/__tests__/library-snippet-preview-modal.test.ts`, `src/styles/library-preview-modal.css`
**Changes**: Delete all remaining listed files. `src/views/library-browser-modal.ts`, `src/views/protocol-library-browser-modal.ts`, `src/__tests__/library-browser-modal.test.ts`, and `src/__tests__/views/library-browser-modal-aria.test.ts` were moved to Phase 3 during review triage because they reference removed plugin service fields.

```bash
rm src/snippets/library-service.ts
rm src/snippets/library-model.ts
rm src/protocol/protocol-library-service.ts
rm src/protocol/protocol-library-model.ts
rm src/views/library-snippet-preview-modal.ts
rm src/__tests__/library-service.test.ts
rm src/__tests__/protocol-library-service.test.ts
rm src/__tests__/library-snippet-preview-modal.test.ts
rm src/styles/library-preview-modal.css
```

#### 3. CSS bundle cleanup
**File**: `esbuild.config.mjs`
**Changes**: Remove `library-preview-modal` from the `CSS_FILES` array.

```javascript
// DELETE from CSS_FILES:
'library-preview-modal',
```

#### 4. Locale cleanup
**Files**: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`
**Changes**: Remove `snippetManager.libraryButton`, `snippetManager.libraryButtonAria`, the entire `library` block, and the entire `protocolLibrary` block from both locale files.

```jsonc
// DELETE from snippetManager in both en.json and ru.json:
"libraryButton": "...",
"libraryButtonAria": "...",

// DELETE top-level blocks from both en.json and ru.json:
"library": {
  // entire block
},
"protocolLibrary": {
  // entire block
}
```

> **Note**: `exportContributionSaved`, `exportContributionFailed`, and `exportContributionRawMarkdownUnsupported` keys never existed in locale files, so there is no cleanup for those keys.

#### 5. Snippet manager stylesheet cleanup
**File**: `src/styles/snippet-manager.css`
**Changes**: Remove the library browser CSS block containing `.rp-library-*`, `.rp-protocol-library-*`, and related selectors.

```css
/* DELETE the library browser modal block after this comment: */
/* Phase 86/87: Library browser modal */

/* Remove all selectors in that block, including: */
.rp-library-*
.rp-protocol-library-*
```


#### 6. Test mock cleanup
**Files**: `src/__tests__/snippet-service.test.ts`, `src/__tests__/snippet-service-move.test.ts`, `src/__tests__/snippet-vault-watcher.test.ts`, `src/__tests__/snippet-tree-view.test.ts`, `src/__tests__/snippet-tree-inline-rename.test.ts`
**Changes**: Remove `libraryUrl`/`protocolLibraryUrl` mock settings and obsolete `requestUrl` stubs.

```typescript
// DELETE from snippet-service.test.ts and snippet-service-move.test.ts mock settings:
libraryUrl: '',
protocolLibraryUrl: '',

// DELETE from snippet-vault-watcher.test.ts, snippet-tree-view.test.ts,
// and snippet-tree-inline-rename.test.ts:
// Phase 86: Modal / requestUrl stubs — library-browser-modal.ts imports them
const requestUrl = vi.fn();

// Also remove requestUrl from each mocked obsidian return object.
```

### Success Criteria:

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

---

## Testing Strategy

### Automated:
- Run phase-specific type checking, build, and Vitest commands exactly as listed in each phase's Success Criteria.
- After Phase 4, run the full suite: `npm test`.
- Run all grep checks listed in phase Success Criteria, especially the final zero-library-reference checks.

### Manual Testing Steps:
1. Verify `npm run build` after each terminal slice and `npm test` after Phase 2 and Phase 4.
2. Verify backward LR route expectations are recalculated for `normalDelta=20`, new bend = `min(40, 10, 32) = 10`.
3. Verify backward TB route remains unchanged for `|normalDelta|=40`, new bend = `min(40, 20, 32) = 20`, with only the comment updated.
4. Verify forward route tests remain unaffected.
5. Simulate concurrent `loadProtocol()` by incrementing a mock generation counter during `update()`'s mutator callback; verify `this.doc` is not overwritten and `applyNodePosition` is not called.
6. Verify library grep commands return zero matches after Phase 4, excluding comments that explicitly describe removal only if the command allows them.
7. Verify `en.json` and `ru.json` key structures remain symmetric after library and protocolLibrary removal.
8. Manually inspect edge routing because routing changes are fragile; invariant tests are required in addition to string assertions.
9. Verify minimap renders correctly after each editor change; incremental editor updates have historically missed minimap refreshes.

## Performance Considerations

- **Generation counter**: Single integer increment per `loadProtocol()` and single integer compare per `saveNodeGeometry()` — negligible overhead
- **Elbow bend**: `Math.min()` of 3 values per edge route — no measurable perf change (already O(1))
- **Flash fix**: No perf impact — same operations, different order
- **Library removal**: Fewer files to bundle, fewer CSS rules to parse — slight build time and CSS parse improvement

## Migration Notes

Not applicable — no persisted schema changes. The `libraryUrl` and `protocolLibraryUrl` settings fields are removed from the interface; existing `data.json` files with these fields will silently ignore them (Obsidian merges loaded data with `DEFAULT_SETTINGS`, extra keys are benign).

## Developer Context


## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| ------ | -------- | ------------ | -------- | --------- | ------- | -------------- | ---------- |
| code | Phase 3 §1 (main.ts) | `src/views/library-browser-modal.ts:123` | blocker | actionability | Phase 3 deletes `libraryService` from `RadiProtocolPlugin` while `library-browser-modal.ts` remains compiled by `tsconfig` and still calls `this.plugin.libraryService`, producing `Property 'libraryService' does not exist` | Move the deletion of `src/views/library-browser-modal.ts` and its importing tests into Phase 3 before removing the plugin field | applied (plan-local; design follow-up: `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`): moved `library-browser-modal.ts`, `library-browser-modal.test.ts`, and `views/library-browser-modal-aria.test.ts` deletion into Phase 3 |
| code | Phase 3 §1 (main.ts) | `src/views/protocol-library-browser-modal.ts:18` | blocker | actionability | Phase 3 deletes `protocolLibraryService` from `RadiProtocolPlugin` while `protocol-library-browser-modal.ts` remains compiled and still calls `this.plugin.protocolLibraryService`, producing `Property 'protocolLibraryService' does not exist` | Move the deletion of `src/views/protocol-library-browser-modal.ts` into Phase 3 before removing the plugin field | applied (plan-local; design follow-up: `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`): moved `protocol-library-browser-modal.ts` deletion into Phase 3 |
| code | Phase 3 | `src/settings.ts:16` | blocker | actionability | Phase 3 says settings cleanup moved to Phase 4, but its automated verification requires `DEFAULT_LIBRARY_URL`, `DEFAULT_PROTOCOL_LIBRARY_URL`, `libraryUrl`, and `protocolLibraryUrl` to be absent while `src/settings.ts` still owns them until Phase 4 | Remove the settings grep from Phase 3 Success Criteria and verify settings cleanup only in Phase 4 | applied: removed Phase 3 settings grep; Phase 4 retains final `libraryUrl\|protocolLibraryUrl` grep and settings cleanup code |
| code | Phase 1 §1 (protocol-editor-view.ts) | `src/protocol/protocol-document-store.ts:81` | concern | code-quality | The proposed generation guard runs after `protocolDocumentStore.update()`, but `update()` has already persisted `updated` via `await this.write(protocolPath, updated)`, so a stale drag save can still overwrite disk before being abandoned in the UI | Move the generation check into the save write path so stale saves skip the geometry mutation before `write()` is called | applied (plan-local; design follow-up: `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`): added an in-mutator stale check returning `existing` before geometry mutation, kept post-update DOM/doc guard, and updated tests to assert stale mutator returns the existing document |
| coverage | ## Testing Strategy §4 | <n/a> | concern | verification-coverage | Note "Verify `npm run build` after each terminal slice and `npm test` after Phase 2 and Phase 4." — criteria NOT FOUND for Phase 2 build/test coverage, code NOT FOUND; ambiguous verification obligation treated as risk-surface | Add Phase 2 `#### Automated Verification:` bullets for `npm run build` and `npm test` | applied: added Phase 2 automated criteria for `npm run build` and `npm test` |
| coverage | ## Testing Strategy §7 | <n/a> | concern | verification-coverage | Note "Verify forward route tests remain unaffected." — no Success Criteria bullet, no code-level forward-route test mirror | Add a Phase 2 `#### Automated Verification:` bullet requiring `npx vitest run src/__tests__/protocol-editor-helpers.test.ts` with existing forward-route tests passing | applied: added Phase 2 helper-test criterion explicitly covering existing forward-route tests |
| coverage | ## Testing Strategy §12 | <n/a> | concern | verification-coverage | Note "Verify minimap renders correctly after each editor change; incremental editor updates have historically missed minimap refreshes." — no Success Criteria bullet, no code-level positive minimap refresh assertion | Add a Phase 1 `#### Automated Verification:` bullet asserting non-stale drag/resize saves call `renderMinimap()` after geometry updates | applied: added Phase 1 automated criterion requiring positive accepted geometry-save coverage for `renderMinimap()` refresh |

## References

- Design: `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md`
- Research: `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md`
- Research: `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md`
- Original ticket: `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md`
- Prior plan: `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md`
- Precedent: `git show e1d9b3a`
