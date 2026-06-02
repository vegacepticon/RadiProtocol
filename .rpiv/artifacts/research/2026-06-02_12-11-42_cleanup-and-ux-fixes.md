---
date: 2026-06-02T12:11:42+0300
author: Roman Shulgha
commit: 7320c28
branch: main
repository: RadiProtocol
topic: "Cleanup and UX fixes — shared library removal, connector rendering, drag, node creation flash"
tags: [research, codebase, cleanup, protocol-editor, edge-routing, drag, flash]
status: complete
last_updated: 2026-06-02T16:30:00+0300
last_updated_by: Roman Shulgha
---

# Research: Cleanup and UX Fixes — Shared Library Removal, Connector Rendering, Drag, Node Creation Flash

## Research Question

Remove all abandoned shared snippet library / admin panel code (~15 files), then fix three Protocol Editor UX bugs: jagged elbow connector corners (dynamic backward bend), stale connector updates during node drag (root-cause investigation), and a canvas flash on node creation (modal-first reorder). No new dependencies, no rewrites — targeted fixes with clear reasoning.

## Summary

**Cleanup**: 7 source files + 5 test files to delete. Wiring to strip from `main.ts:10-11,19,36-37,65-69,113-117`, `settings.ts:20-21,35-39,48-49`, and `snippet-manager-view.ts:94-101,586-621`. `exportLibraryContribution` callback at `tree-renderer.ts:59` is already dead code. i18n: ~55 keys each in `en.json` + `ru.json`. CSS: delete `library-preview-modal.css`, remove ~155 lines from `snippet-manager.css:538-694`. Precedent template: admin panel removal (`e1d9b3a`) — 19 files, clean.

**Elbow connector**: Replace fixed `bend=20` at `computeEdgeBend():331` with dynamic `min(BACKWARD_OFFSET, |normalDelta|/2, CONFIGURED_MAX_BEND)`. LR backward test breaks (bend 20→10), TB test unchanged (|normalDelta|/2 still 20). Recommend adding no-backtracking invariant tests (pattern from `5797c60`).

**Node creation flash**: Reorder `openEditModal()` before `loadProtocol()` at `addNodeAtWorldPoint():629-632` and `addNodeAndConnectAtWorldPoint():723-726`. Backdrop paints first, teardown hidden. Verified: `newNode` reference preserved, `autofocusFirstTextField` intact.

**Drag state leak**: Not a DOM-rebuild-invalidating-listeners issue. Root cause is a race: `saveNodeGeometry()` at `:1384` uses `void` (fire-and-forget), and its internal `await protocolDocumentStore.update()` at `:1459` yields to the event loop. During that yield, a concurrent `loadProtocol()` (e.g. from auto-layout click at `:1645`) rebuilds DOM via `renderShell():512` → `container.empty()`. Then `saveNodeGeometry` resumes and sets `this.doc = updated` at `:1469` — creating three-way inconsistency (DOM ↔ this.doc ↔ disk). Four `void` call sites share this race window (`:1384, :1886, :2123, :2147`). **Decision**: Guard with a generation counter that detects concurrent `loadProtocol` and abandons stale saves (option b).

## Detailed Findings

### Library Removal — Source Files

**Files to delete** (7 source, zero active-feature imports confirmed):
- `src/snippets/library-service.ts` — `LibraryService` class (`:14`), imports only from `main.ts:10`
- `src/snippets/library-model.ts` — `LibraryIndex`, `LibraryLanguage`, etc. — pure types, imported by `library-service.ts:9` and `library-browser-modal.ts:5`
- `src/protocol/protocol-library-service.ts` — `ProtocolLibraryService` class (`:16`), imported only from `main.ts:11`
- `src/protocol/protocol-library-model.ts` — `ProtocolLibraryEntry`, etc. — pure types, imported by `protocol-library-service.ts:10` and `protocol-library-browser-modal.ts:5`
- `src/views/library-browser-modal.ts` — `LibraryBrowserModal`, imported by `snippet-manager-view.ts:15`
- `src/views/library-snippet-preview-modal.ts` — `LibrarySnippetPreviewModal`, imported by `library-browser-modal.ts:6`
- `src/views/protocol-library-browser-modal.ts` — `ProtocolLibraryBrowserModal`, imported by `main.ts:19`

**Dependency graph** — all 7 form a closed subgraph:
```
main.ts → LibraryService → library-model.ts
main.ts → ProtocolLibraryService → protocol-library-model.ts
main.ts → ProtocolLibraryBrowserModal → protocol-library-model.ts
snippet-manager-view.ts → LibraryBrowserModal → library-model.ts
                                               → LibrarySnippetPreviewModal
```

**Wiring to strip from `src/main.ts`**:
- `:10` — `import { LibraryService } from './snippets/library-service'`
- `:11` — `import { ProtocolLibraryService } from './protocol/protocol-library-service'`
- `:19` — `import { ProtocolLibraryBrowserModal } from './views/protocol-library-browser-modal'`
- `:36-37` — property declarations `libraryService!: LibraryService; protocolLibraryService!: ProtocolLibraryService;`
- `:65-69` — instantiation of both services
- `:113-117` — `browse-protocol-library` command registration (entire `addCommand` block)

**Wiring to strip from `src/settings.ts`**:
- `:20-21` — `DEFAULT_LIBRARY_URL` / `DEFAULT_PROTOCOL_LIBRARY_URL` constants (only consumed by `library-service.ts:80` and `protocol-library-service.ts:59`)
- `:35-39` — `libraryUrl: string` / `protocolLibraryUrl: string` interface fields
- `:48-49` — default values in `DEFAULT_SETTINGS`

### Library Removal — Snippet Manager UI

**`src/views/snippet-manager-view.ts`** changes:
- `:15` — remove `import { LibraryBrowserModal } from './library-browser-modal'`
- `:11` — remove `MdTemplateSnippet` from `import type` (only used at `:611` in `exportLibraryContribution`)
- `:12` — remove entire `import { serializeMarkdownTemplate }` line (only used at `:621`)
- `:94-101` — remove Library button DOM construction (globe icon, click → `openLibraryBrowser()`)
- `:585-588` — remove `openLibraryBrowser()` method
- `:590-621` — remove `exportLibraryContribution()` method
- `:131` — remove `exportLibraryContribution: (path) => this.exportLibraryContribution(path)` wiring

**`src/views/snippet-manager/tree-renderer.ts:59`** — remove `exportLibraryContribution(path: string): Promise<void>` from `TreeRendererCallbacks`. Confirmed dead: grep for `callbacks.exportLibraryContribution` across `src/` returns only definition + wiring assignment — zero invocations.

**Import impact**: `Snippet` type at `:11` remains (used at `:200`). `dirname` at `:20` remains (used at `:362, :474`). `ensureFolderPath` at `:21` remains (used at `:313`).

### Library Removal — i18n and CSS

**`src/i18n/locales/en.json`** — remove three blocks:
- `:182-185` — `snippetManager.libraryButton` / `libraryButtonAria` (2 keys)
- `:333-369` — `"library": {}` block (37 keys: title, loadError, searchPlaceholder, install, preview, etc.)
- `:370-386` — `"protocolLibrary": {}` block (17 keys: title, loadError, install, nodes, edges)
- Additional: `snippetManager.exportContributionSaved` / `exportContributionFailed` at ~`:227, :229` (2 keys used only by `exportLibraryContribution()`)

**`src/i18n/locales/ru.json`** — identical structural ranges, Russian values (~55 keys total)

**`src/styles/library-preview-modal.css`** — delete entire file (~125 lines, all `.rp-library-preview-*` selectors)

**`src/styles/snippet-manager.css:538-694`** — remove ~155-line block: `.rp-library-modal`, `.rp-library-breadcrumb`, `.rp-library-entry`, `.rp-library-install-btn`, `.rp-protocol-library-entry`, and related selectors. Block starts after `/* Phase 86/87: Library browser modal */` comment.

**Independent**: `src/styles/protocol-editor.css:102-108` (`stroke-linejoin: round; stroke-linecap: round`) — NOT part of library removal. Applies globally to `.rp-protocol-editor-edge` SVG paths.

### Elbow Connector Rendering Fix

**Problem**: `computeEdgeBend()` at `src/views/protocol-editor-view.ts:312-332`. Backward branch at `:331` returns `Math.max(0, Math.min(BACKWARD_OFFSET / 2, CONFIGURED_MAX_BEND))` = fixed 20. Forward branch at `:317-326` dynamically clamps to `min(rankDelta/2, |normalDelta|/2, 32)`.

Constants (`:308-310`): `CONFIGURED_MAX_BEND = 32`, `BACKWARD_OFFSET = 40`.

**How bend is consumed in backward routes**:

*TB direction* (`:394-415`): `routeX = max(x1,x2) + max(56, |normalDelta|/2 + 40)`, `exitY = y1 + 40`, `entryY = y2 - 40`. L1/L5 segments have length `40 - bend`. L2/L4 segments have length `routeX - max(x1,x2) - 2*bend`.

*LR direction* (`:418-432`): `routeY = max(y1,y2) + max(48, |normalDelta|/2 + 32)`, `exitX = x1 + 40`, `entryX = x2 - 40`. Same constraint pattern.

**Correct dynamic formula** (replacing `:328-331`):
```typescript
return Math.max(0, Math.min(
  BACKWARD_OFFSET,            // L1 & L5: 40 − bend ≥ 0
  Math.abs(normalDelta) / 2,  // L2 & L4 cross-direction constraint
  CONFIGURED_MAX_BEND,        // absolute cap at 32
));
```

`|normalDelta|/2` is always ≤ the actual L2/L4 constraint (TB adds 40-56px margin via `max()`), so it's a safe conservative bound.

**Test impact** (`src/__tests__/protocol-editor-helpers.test.ts`):
- `:143-149` — backward LR test: `normalDelta = 20`, new bend = `min(40, 10, 32) = 10`. Assertions `'L 540 148'` and `'L 140 168'` break. Need recalculation with bend=10.
- `:167-172` — backward TB test: `|normalDelta| = 40`, new bend = `min(40, 20, 32) = 20`. **Unchanged** — `'L 260 60'` assertion remains valid. Only comment at `:169` needs updating.
- `:145, :169` — comments saying "min(40/2, 32) = 20" become stale.
- Forward tests (`:129-141, :151-165, :237-252`) unaffected.

**Recommendation**: Add no-backtracking invariant tests alongside string assertions (pattern from `5797c60`). Precedent: edge routing at `5ba8e05` had 4 follow-up fixes; string-comparison tests missed degenerate backtracking segments.

### Node Creation Flash Fix

**Problem**: `addNodeAtWorldPoint()` at `:621-636`. Chain: `store.update()` → `.then()` → `loadProtocol()` at `:630` (triggers `renderShell():512` → `container.empty()` → synchronous full-DOM teardown) → `openEditModal()` at `:632` (creates backdrop at `:1903`). The teardown creates a visible blank frame before the backdrop paints.

**Fix**: Reorder the `.then()` block:
```typescript
.then(async () => {
  this.openEditModal(newNode, { autofocusFirstTextField: true });  // backdrop first
  await this.loadProtocol(this.protocolPath!);                      // teardown behind backdrop
  new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
})
```

**Verification**:
- `newNode` reference: local `const` at `:624`, closed over by `.then()`. Not mutated by `loadProtocol()` (which creates new objects from disk). `openEditModal()` receives the same POJO — identical properties to persisted copy. ✓
- `autofocusFirstTextField: true`: passed identically to `openEditModal(node, options?)` at `:1901`. Deferred focus via `window.setTimeout(..., 0)` at `:2159-2162` fires after both `openEditModal` and `loadProtocol()` complete. ✓

**Same bug at `addNodeAndConnectAtWorldPoint():687-730`**: Identical pattern at `:723-726`. Same reorder fix applies.

### Drag State Leak — Root Cause

**Initial hypothesis was wrong**: No `loadProtocol()` call site can fire during an active `bindDrag()` `mousemove` loop. Analysis of all 8 call sites:

| Call Site | Trigger | During Active Drag? |
|---|---|---|
| `:630` addNodeAtWorldPoint | dblclick → kind picker → click | No — separate gesture |
| `:724` addNodeAndConnectAtWorldPoint | connection drag mouseup → kind picker → click | No — separate gesture |
| `:1089` deleteEdge | edge modal Delete button | No — user in modal |
| `:1245` finishConnectionDrag | connection drag mouseup | No — separate gesture, mutually exclusive with node drag (`:1331-1332`) |
| `:1645` autoLayoutNodes | floating action button click | No — click fires after drag mouseup |
| `:1886` edge edit save | edge modal Save button | No — user in modal |
| `:2123` node edit save | edit modal Save button | No — user in modal |
| `:2147` node delete | edit modal Delete→Confirm | No — user in modal |

**Real cause**: Race condition in `saveNodeGeometry()`:

1. `bindDrag()` mouseup at `:1384`: `void this.saveNodeGeometry(node)` — fire-and-forget, NO `await`
2. `saveNodeGeometry():1459`: `await this.plugin.protocolDocumentStore.update(...)` — **yields to event loop**
3. During yield, user clicks auto-layout button → `loadProtocol():1645` → `renderShell():512` → `container.empty()` **destroys all DOM**, then `renderDocument():506` rebuilds with auto-layout positions
4. `saveNodeGeometry()` resumes, gets `updated` from its own store update
5. `:1469`: `this.doc = updated` — overwrites auto-layout document with drag-only document
6. `:1474`: `applyNodePosition(nodeEl, updatedNode)` — patches one dragged node's DOM element. Other nodes' DOM (auto-layout) now mismatches `this.doc` (pre-auto-layout positions)
7. Disk race: `protocolDocumentStore.update()` at `protocol-document-store.ts:88-92` reads from disk (not mutexed). Two concurrent updates can both read state S before either writes — second write overwrites first. Result: auto-layout may win the disk race, drag position lost on disk.

**Three-way inconsistency**: DOM (auto-layout) ≠ `this.doc` (drag-saved) ≠ disk (race winner). Resolves on next `loadProtocol()`.

**`nodeElementById` lifecycle**: Populated at `renderDocument():786`. Never explicitly cleared. Stale after `container.empty():512` but always repopulated at `:786` before any subsequent read at `saveNodeGeometry():1471`. **Not the leak source.**

**Same `void` pattern at 3 other sites**: `:1886` (edge save), `:2123` (node save), `:2147` (node delete) — all use `void this.loadProtocol()` after modal operations, creating the same yield window for race with drag's `saveNodeGeometry`.

### Decision: Guard with Generation Counter

Per `src/views/protocol-editor-view.ts`, add a `private loadGeneration = 0` counter that `loadProtocol()` increments and `saveNodeGeometry()` snapshots before `await`. After `await`, if the snapshot ≠ current generation, a concurrent `loadProtocol` occurred — abandon the stale save (no `this.doc = updated`, no `applyNodePosition`). Same guard applied at `:1886`, `:2123`, `:2147` for symmetry.

## Code References

### Cleanup — Delete
- `src/snippets/library-service.ts:14` — `LibraryService` class
- `src/snippets/library-model.ts` — library types
- `src/protocol/protocol-library-service.ts:16` — `ProtocolLibraryService` class
- `src/protocol/protocol-library-model.ts` — protocol library types
- `src/views/library-browser-modal.ts:99` — `LibraryBrowserModal`
- `src/views/library-snippet-preview-modal.ts:3` — `LibrarySnippetPreviewModal`
- `src/views/protocol-library-browser-modal.ts:7` — `ProtocolLibraryBrowserModal`

### Cleanup — Edit
- `src/main.ts:10-11,19` — library imports
- `src/main.ts:36-37` — service property declarations
- `src/main.ts:65-69` — service instantiation
- `src/main.ts:113-117` — browse-protocol-library command
- `src/settings.ts:20-21` — `DEFAULT_LIBRARY_URL` / `DEFAULT_PROTOCOL_LIBRARY_URL`
- `src/settings.ts:35-39` — `libraryUrl` / `protocolLibraryUrl` fields
- `src/settings.ts:48-49` — default values
- `src/views/snippet-manager-view.ts:11-12,15,94-101,131,585-621` — library UI + export method
- `src/views/snippet-manager/tree-renderer.ts:59` — `exportLibraryContribution` callback slot
- `src/i18n/locales/en.json:182-185,227-229,333-369,370-386` — i18n keys
- `src/i18n/locales/ru.json:182-185,227-229,333-369,370-386` — Russian equivalents
- `src/styles/library-preview-modal.css` — entire file
- `src/styles/snippet-manager.css:538-694` — library CSS block

### Elbow Connector
- `src/views/protocol-editor-view.ts:312-332` — `computeEdgeBend()` (fix target)
- `src/views/protocol-editor-view.ts:308-310` — `CONFIGURED_MAX_BEND = 32`, `BACKWARD_OFFSET = 40`
- `src/views/protocol-editor-view.ts:394-432` — backward edge route SVG construction (TB + LR)
- `src/__tests__/protocol-editor-helpers.test.ts:143-172` — backward edge route tests

### Flash Fix
- `src/views/protocol-editor-view.ts:621-636` — `addNodeAtWorldPoint()` (primary fix)
- `src/views/protocol-editor-view.ts:687-730` — `addNodeAndConnectAtWorldPoint()` (same fix)
- `src/views/protocol-editor-view.ts:488-506` — `loadProtocol()` triggering `renderShell()`
- `src/views/protocol-editor-view.ts:509-512` — `renderShell()` → `container.empty()` (flash source)
- `src/views/protocol-editor-view.ts:1901-1903` — `openEditModal()` backdrop creation

### Drag Race
- `src/views/protocol-editor-view.ts:1329-1388` — `bindDrag()` lifecycle
- `src/views/protocol-editor-view.ts:1384` — `void this.saveNodeGeometry(node)` (race enabler)
- `src/views/protocol-editor-view.ts:1446-1480` — `saveNodeGeometry()` (race window at `:1459`)
- `src/views/protocol-editor-view.ts:451` — `nodeElementById` Map
- `src/views/protocol-editor-view.ts:786` — Map repopulation
- `src/protocol/protocol-document-store.ts:88-92` — `update()` read-not-mutexed
- `src/views/protocol-editor-view.ts:1886,2123,2147` — other `void` call sites

### Test Cleanup
- `src/__tests__/library-service.test.ts:3` — `LibraryService` import
- `src/__tests__/library-browser-modal.test.ts:3-6` — `buildLibraryTree` etc.
- `src/__tests__/library-snippet-preview-modal.test.ts:2` — `LibrarySnippetPreviewModal`
- `src/__tests__/protocol-library-service.test.ts:3` — `ProtocolLibraryService`
- `src/__tests__/views/library-browser-modal-aria.test.ts:2` — `LibraryBrowserModal`
- `src/__tests__/snippet-vault-watcher.test.ts:142,157-158` — `requestUrl` stub
- `src/__tests__/snippet-tree-view.test.ts:193,208-209` — `requestUrl` stub
- `src/__tests__/snippet-tree-inline-rename.test.ts:194,209-210` — `requestUrl` stub
- `src/__tests__/snippet-service.test.ts:88-89` — `libraryUrl`/`protocolLibraryUrl` mock fields
- `src/__tests__/snippet-service-move.test.ts:120-121` — same mock fields

## Integration Points

### Inbound References
- `src/main.ts:10-11,19` — imports `LibraryService`, `ProtocolLibraryService`, `ProtocolLibraryBrowserModal`
- `src/views/snippet-manager-view.ts:15` — imports `LibraryBrowserModal`
- `src/settings.ts:5` — `LibraryService` imports `DEFAULT_LIBRARY_URL` from settings (deleted with library)
- `src/protocol/protocol-library-service.ts:4` — imports `DEFAULT_PROTOCOL_LIBRARY_URL` from settings (deleted with library)

### Outbound Dependencies
- `src/snippets/library-service.ts:5` → `settings.ts` (DEFAULT_LIBRARY_URL)
- `src/snippets/library-service.ts:6-9` → `snippet-model.ts`, `md-template.ts`, `library-model.ts`
- `src/protocol/protocol-library-service.ts:4,10` → `settings.ts`, `protocol-library-model.ts`
- `src/views/library-browser-modal.ts:5-7` → `library-model.ts`, `library-snippet-preview-modal.ts`, `snippet-model.ts`
- `src/views/protocol-library-browser-modal.ts:5` → `protocol-library-model.ts`

### Infrastructure Wiring
- `src/main.ts:65-69` — DI: `LibraryService` gets `App`, `settings`, `SnippetService`, `Translator`
- `src/main.ts:68-69` — DI: `ProtocolLibraryService` gets `App`, `settings`, `ProtocolDocumentStore`, `Translator`
- `src/main.ts:113-117` — Command: `browse-protocol-library` → `ProtocolLibraryBrowserModal`
- `src/views/snippet-manager-view.ts:131` — Callback wiring: `exportLibraryContribution` → `SnippetManagerView`

## Architecture Insights

1. **`container.empty()` at `renderShell():512` is the root cause of all three UX bugs**: flash (synchronous teardown before backdrop), drag race (destroys DOM during `saveNodeGeometry` await), and a theoretical issue for any future incremental update that doesn't account for the full teardown.

2. **`void` (fire-and-forget) at 4 call sites creates a systemic race pattern**: `saveNodeGeometry():1384`, edge save `:1886`, node save `:2123`, node delete `:2147`. Each yields during await, and any concurrent `loadProtocol()` can interleave. The generation counter fix guards against this class of bugs.

3. **`nodeElementById` Map never cleared but safely overwritten**: The map accumulates stale entries for deleted nodes (entries from prior `loadProtocol` that aren't overwritten by new `set()` calls). This is benign for current usage but could cause issues if code ever iterates the map.

4. **`protocolDocumentStore.update()` has a read-not-mutexed race**: Two concurrent `update()` calls can both read the same disk state before either writes, causing the second write to silently overwrite the first. Only the `write()` step is mutex-protected. This is a latent issue beyond the drag fix scope.

5. **Library removal follows proven precedent**: Admin panel removal (`e1d9b3a`) deleted 19 files (5,811 lines) cleanly. Same pattern applies — verify zero active imports, then delete. Secondary references (callback slots, test stubs) need explicit follow-up.

## Precedents & Lessons

7 similar past changes analyzed.

### Precedent: Remove Unused Admin Panel
**Commit(s)**: `e1d9b3a` — "chore: remove unused admin panel" (2026-05-28)
**Blast radius**: 19 files — 5,811 deletions across 4 layers
  `src/snippets/library-admin.ts` — 1,118 lines removed
  `src/views/library-admin-modal.ts` — 683 lines removed
  `src/views/library-admin/` — 5 files removed
  `src/styles/library-admin.css` — 385 lines removed
  `src/i18n/locales/` — 131 keys removed each
  `src/__tests__/` — 6 test files removed
  `src/settings.ts` — 6 lines removed

**Follow-up fixes**:
- `cb41717` — "fix nightly drift — dead CSS/i18n cleanup" (2026-05-22) — cleaned 37 dead i18n keys
- `a72a971` — "optimize-for-release" (2026-05-27) — further removal of unused code
- No direct breakage — removal was clean because admin panel was verified unused first

**Takeaway**: Large code removal safe IF preceded by import analysis. Secondary references (callback slots, test stubs, CSS classes, i18n keys) need follow-up cleanup.

### Precedent: Edge/Drag Performance Optimization + Review Fixes
**Commit(s)**: `37760da` → `5797c60` → `fbd0dcb` (2026-05-28 to 2026-06-02)
**Blast radius**: 3-3-1 files respectively
  `src/views/protocol-editor-view.ts` — dynamic bend clamping, rAF-batched drag, incremental `updateEdgePaths()`
  `src/__tests__/protocol-editor-helpers.test.ts` — route tests, no-backtracking invariant tests
  `src/styles/protocol-editor.css` — stroke-linejoin/linecap

**Follow-up fixes**:
- `5797c60` — found 3 gaps in "ready" plan: unsafe bend clamping, stale minimap, missing async guard
- `fbd0dcb` — trivial 2-line CSS fix planned but landed as separate commit

**Lessons from docs**:
- `.rpiv/artifacts/reviews/2026-06-02_09-35-12_auto.md` — **Even "ready" plans have implementation gaps that surface only in review.**
- `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md` — Phase 3 explicitly did NOT call `loadProtocol()`, yet minimap went stale. **When removing a full-reload path, audit ALL dependent UI surfaces.**

**Takeaway**: Incremental updates must refresh every surface (canvas, minimap, viewport). The minimap was forgotten 3× across precedents.

### Precedent: Edge Routing Introduction
**Commit(s)**: `5ba8e05` — "feat(editor): edge routing, port colors, title placement" (2026-05-16)
**Blast radius**: 8 files across 4 layers, 14 new route tests

**Follow-up fixes** (4 over 2 days):
- `50a7fcb` — edge label logic too restrictive
- `f5850c0` — missing `loadProtocol()` after edge save
- `67db3c6` — port anchor calculation wrong
- `37760da` — drag performance degraded after routing changes

**Takeaway**: Routing geometry changes are the most fragile editor change type. String-comparison tests miss backtracking — use invariant tests.

### Precedent: Dagre Auto-Layout Migration
**Commit(s)**: `3a4b290` — "Replace hand-rolled BFS with dagre" (2026-05-28)
**Follow-up fixes** (4 within 6 hours): port anchors, measured geometry, off-screen edges, drag-lag

**Takeaway**: Layout engine changes need 2-4 follow-ups. Automated tests alone won't catch visual regressions — manual testing with real protocols essential.

### Composite Lessons
1. **Incremental editor updates must refresh ALL dependent UI surfaces** (recurred 3×)
2. **Edge routing changes are the most fragile protocol-editor change type** (recurred 4×)
3. **Large code removal is safe ONLY after import/grep analysis** (recurred 2×)
4. **"Ready" plans still have implementation gaps** (recurred 1×)
5. **`container.empty()` in `renderShell()` is the root cause of canvas flash**
6. **CSS/i18n cleanup must be paired with allowlist/consistency checks**

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md` — FRD: 4 cleanup + UX tasks, 9 decisions, recommended approach
- `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md` — 3-phase edge/drag fix plan
- `.rpiv/artifacts/plans/2026-06-02_10-40-04_protocol-editor-review-fixes.md` — review follow-up plan
- `.rpiv/artifacts/designs/2026-06-02_10-02-12_protocol-editor-review-fixes.md` — design with "What We're NOT Doing" stash
- `.rpiv/artifacts/reviews/2026-06-02_09-35-12_auto.md` — review finding 3 gaps in "ready" plan
- `.rpiv/artifacts/validation/2026-06-02_11-21-14_protocol-editor-review-fixes.md` — validation report

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

## Related Research
- `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-rendering-and-drag.md` — prior edge/drag research

## Open Questions
_None — all questions resolved during research and developer checkpoint._
