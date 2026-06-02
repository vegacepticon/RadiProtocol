---
date: 2026-06-02T11:55:28+0300
author: Roman Shulgha
commit: 7320c28
branch: main
repository: RadiProtocol
topic: "Cleanup and UX fixes — shared library removal, connector rendering, drag, node creation flash"
tags: [intent, frd, cleanup, protocol-editor, connector-rendering, drag, ux]
status: complete
last_updated: 2026-06-02T11:55:28+0300
last_updated_by: Roman Shulgha
---

# FRD: Cleanup and UX Fixes — Shared Library Removal, Connector Rendering, Drag, Node Creation Flash

## Summary
Remove all abandoned shared snippet library / admin panel code (~15 files), then fix three Protocol Editor UX bugs: jagged elbow connector corners (dynamic backward bend), stale connector updates during node drag (root-cause investigation), and a canvas flash on node creation (modal-first reorder). No new dependencies, no rewrites — targeted fixes with clear reasoning.

## Problem & Intent
The dead shared-library code is technical debt that confuses future work and adds maintenance burden. The three visual/behavioral bugs (jagged elbow connectors, stale drags, node-creation flicker) degrade the shipped experience. Success means a clean codebase with no library remnants, and a Protocol Editor that feels polished and stable during everyday protocol authoring.

## Goals
- Eliminate all code, settings, CSS, i18n keys, tests, and UI related to the abandoned shared snippet library / admin panel
- Smooth elbow connector corners in the Protocol Editor (no jagged teeth or cusps on backward/П-shaped routes)
- Live connector updates during every node drag, not just the first drag after opening the editor
- No visible canvas flash when opening the node configuration modal after creating a new node

## Non-Goals
- Not adding new features or functionality
- Not redesigning the connector rendering system (patch, not rewrite)
- Not rewriting the drag system from scratch (targeted root-cause fix)
- Not changing the node creation flow beyond the flash fix
- Not introducing new dependencies

## Functional Requirements
1. **FR1 — Library code removal**: All files, imports, settings fields, CSS classes, i18n keys, commands, and test files related to the shared snippet library / admin panel SHALL be removed from the project.
2. **FR2 — Elbow connector rendering**: Backward (П-shaped / elbow) connector routes SHALL render with smooth corners without jagged teeth or cusps, matching the smoothness already achieved for forward (direct) connections via the 2026-06-01 fix.
3. **FR3 — Live drag connector update**: Connectors SHALL update visually during every node drag, consistently for any number of sequential drags — not only the first drag after opening the Protocol Editor.
4. **FR4 — Node creation flash**: Opening the node configuration modal after creating a new node SHALL NOT cause a visible canvas flash or blank frame. The transition from node type selection to the configuration modal SHALL feel stable.

## Non-Functional Requirements
- **Performance**: No regression in Protocol Editor render or drag performance. Edge path updates during drag SHALL remain rAF-batched.
- **Security**: Not applicable (desktop-only plugin, no auth tokens involved).
- **UX / Accessibility**: No change to existing keyboard navigation or ARIA labels beyond removed library UI.
- **Reliability**: `npm run build` SHALL exit 0. `npm test` SHALL exit 0 with no test failures. Existing Protocol Editor functionality (node editing, edge creation, minimap, zoom/pan) SHALL remain intact.

## Constraints & Assumptions
- **Technical**: Obsidian plugin built with TypeScript 6.0, Obsidian API 1.12.3, esbuild bundler, Vitest test runner.
- **Process**: Work incrementally — inspect before deleting, verify each removal is safe. Prefer targeted fixes over rewrites.
- **No new dependencies**: All fixes use existing APIs and patterns already in the codebase.
- **Assumption**: The abandoned shared library code is truly unused by the current Protocol Editor, snippet workflow, and plugin initialization — confirmed via codebase probe showing no imports from library modules into active feature code (only wiring in main.ts and snippet-manager-view.ts).

## Acceptance Criteria
- [ ] **AC1 — Cleanup**: `npm run build` exits 0. Grep for `LibraryService`, `ProtocolLibraryService`, `LibraryBrowserModal`, `libraryUrl`, `RadiProtocol-Library` in `src/` returns zero hits. The Snippet Manager no longer shows a "Library" button. The command palette no longer lists "Browse protocol library".
- [ ] **AC2 — Cleanup tests**: `npm test` exits 0 with no library-related test failures (library test files removed).
- [ ] **AC3 — Elbow connectors**: Open the Protocol Editor with a protocol containing backward edges (nodes connected right-to-left or bottom-to-top with tight spacing < 80px). Visually inspect the connector corners — they SHALL be smooth curves without jagged teeth or cusps.
- [ ] **AC4 — Elbow tests**: Existing edge route tests in `src/__tests__/protocol-editor-helpers.test.ts` continue to pass.
- [ ] **AC5 — Live drag**: Open the Protocol Editor. Drag a node — connectors update live during drag. Release, then drag another node — same live update. Drag a third node — same. Live update works consistently for any number of sequential drags.
- [ ] **AC6 — Node creation flash**: Create a new node — the canvas SHALL NOT visibly blink or show a blank frame between clicking the node type and the edit modal appearing. The transition SHALL feel stable.

## Recommended Approach
Cleanup first (remove all library files, then strip wiring from settings/main.ts/snippet-manager), then apply the three targeted UX fixes: dynamic backward bend in `computeEdgeBend()`, modal-first reorder in `addNodeAtWorldPoint()`, and root-cause investigation of the drag state leak in `bindDrag()`. Each fix independently verifiable.

## Decisions

### D1 — Intent: Who is this for?
**Question**: "You've listed four concrete tasks — dead code removal, connector rendering fixes, live-drag connector updates, and a node-creation flash. Help me ground these: who are you in this picture, and what does success look like for you when this work is done?"
**Recommended**: n/a — `intent` question
**Chosen**: Plugin maintainer — shipping quality
**Rationale**: The dead code is technical debt to remove before it confuses future work. The visual/behavioral bugs degrade the shipped experience and need fixing so the plugin feels polished and stable.

### D2 — Cleanup scope: Full removal
**Question**: "From the probe, the abandoned shared library spans ~15 files: two services, two browser modals, two model files, CSS, i18n keys, settings fields, the Library button in Snippet Manager, an exportLibraryContribution function, and the browse-protocol-library command. Remove the entire system — services, UI, settings, CSS, i18n, and tests?"
**Recommended**: Full removal — remove everything: LibraryService, ProtocolLibraryService, LibraryBrowserModal, ProtocolLibraryBrowserModal, library CSS, i18n keys, settings fields, model files, test files, the Library button, exportLibraryContribution, browse-protocol-library command, and DEFAULT_LIBRARY_URL / DEFAULT_PROTOCOL_LIBRARY_URL constants.
**Chosen**: Full removal
**Rationale**: The shared library was an abandoned attempt — no part of it is used by current Protocol Editor, snippet workflow, or plugin initialization. Clean removal eliminates technical debt.

### D3 — Elbow connector fix: Dynamic backward bend
**Question**: "The probe confirms: the 2026-06-01 CSS fix (stroke-linejoin: round) applies globally, but computeEdgeBend() backward branch returns a fixed bend=20. For tight elbow connections, the bend exceeds available segment space, causing cusps. Should we make the backward bend dynamic like the forward branch?"
**Recommended**: Dynamic backward bend — clamp backward bend to the actual available space in each segment, matching the forward branch's approach.
**Chosen**: Dynamic backward bend
**Rationale**: evidence: `src/views/protocol-editor-view.ts:328-331` — backward branch returns `Math.min(BACKWARD_OFFSET/2, CONFIGURED_MAX_BEND) = 20` regardless of connection distance. The forward branch at `:317-326` already clamps dynamically to `Math.min(rankDelta/2, |normalDelta|/2, 32)`. The fix generalizes this dynamic clamping to backward routes using the actual segment lengths.

### D4 — Node creation flash: Modal first, then reload
**Question**: "The node creation flash: addNodeAtWorldPoint() calls loadProtocol() which does container.empty() + full DOM rebuild synchronously, then opens the edit modal. This teardown creates a visible blank frame. How should we fix it?"
**Recommended**: Modal first, then reload — open the modal backdrop first, then reload the protocol behind the modal backdrop so the teardown is hidden from the user.
**Chosen**: Modal first, then reload
**Rationale**: evidence: `src/views/protocol-editor-view.ts:621-636` — `addNodeAtWorldPoint()` calls `protocolDocumentStore.update().then(() => loadProtocol().then(() => openEditModal()))`. The synchronous `container.empty()` in `renderShell()` tears down the visible canvas before the modal backdrop appears. Reordering to open the modal before calling `loadProtocol()` hides the teardown behind the modal backdrop.

### D5 — Drag fix approach: Investigate root cause first
**Question**: "The drag issue — connectors stop updating live after the first drag. The probe shows bindDrag() uses rAF-batched updates and proper cleanup on mouseup. The symptom suggests a state leak rather than a structural flaw. How should I approach this?"
**Recommended**: Investigate root cause first — trace the exact state corruption before proposing a fix.
**Chosen**: Investigate root cause first
**Rationale**: The bindDrag() code at `src/views/protocol-editor-view.ts:1328-1385` is structurally sound (rAF batching, proper listener cleanup). The symptom (works once, breaks on subsequent drags) points to a state leak — possibly a DOM rebuild invalidating event listener references, or a canvas-level event conflict. Investigating the exact mechanism avoids a blind rewrite.

### D6 — Cleanup verification: Build + grep + visual check
**Question**: "Acceptance criteria for cleanup: how strict should the verification be?"
**Recommended**: Build + grep + visual check — `npm run build` exits 0, grep for library identifiers returns no hits, Library button and command are gone.
**Chosen**: Build + grep + visual check
**Rationale**: Comprehensive but practical — build catches import errors, grep catches lingering references, visual check confirms UI removal.

### D7 — Elbow verification: Visual inspection + existing tests pass
**Question**: "Acceptance criteria for the elbow connector fix: what verification is needed?"
**Recommended**: Visual inspection + existing tests pass — open the editor with backward edges, visually check corners are smooth; existing edge route tests continue to pass.
**Chosen**: Visual inspection + existing tests pass
**Rationale**: The existing test suite covers edge route calculation; visual inspection is the gold standard for rendering quality.

### D8 — Drag verification: Sequential drag test
**Question**: "Acceptance criteria for the live drag fix: what should be verified?"
**Recommended**: Sequential drag test — drag a node, verify live update; drag another, verify again; drag a third, verify again. Must work consistently.
**Chosen**: Sequential drag test
**Rationale**: The bug's specific repro is that it works on the first drag but not subsequent ones — the verification must test exactly this sequence.

### D9 — Flash verification: No visible flash
**Question**: "Acceptance criteria for the node creation flash fix: what verification is needed?"
**Recommended**: No visible flash — create a new node, verify the canvas doesn't blink or show a blank frame before the modal appears.
**Chosen**: No visible flash
**Rationale**: The bug is visual — the acceptance criterion is visual. DevTools perf check is a nice-to-have but not required.

## Open Questions
_None — all branches resolved with decisions._

## Suggested Follow-ups
- **`exportLibraryContribution` tree-renderer callback**: The `TreeRendererCallbacks` interface in `src/views/snippet-manager/tree-renderer.ts:59` has an `exportLibraryContribution` field that will be removed along with the library. Verify no other callers depend on this callback slot after cleanup.
- **`requestUrl` stubs in test files**: Multiple test files (`snippet-vault-watcher.test.ts:142`, `snippet-tree-view.test.ts:193`, `snippet-tree-inline-rename.test.ts:194`) have `requestUrl` stubs "because library-browser-modal.ts imports them." After removing `library-browser-modal.ts`, these stubs may no longer be needed — consider cleaning them up in a follow-up pass.
- **`InlineRunnerModal` naming**: Per `src/views/architecture.md`, this is a historical artifact — the class is a floating DOM panel, not an Obsidian Modal. Not in scope for this cleanup but noted for future refactoring.

## References
- `src/settings.ts:20-21` — `DEFAULT_LIBRARY_URL` / `DEFAULT_PROTOCOL_LIBRARY_URL` constants
- `src/settings.ts:36-39` — `libraryUrl` / `protocolLibraryUrl` settings fields
- `src/main.ts:10-11,19,36-37,65-69,113-117` — Library service wiring and command registration
- `src/snippets/library-service.ts` — `LibraryService` implementation
- `src/snippets/library-model.ts` — Library type definitions
- `src/protocol/protocol-library-service.ts` — `ProtocolLibraryService` implementation
- `src/protocol/protocol-library-model.ts` — Protocol library type definitions
- `src/views/library-browser-modal.ts` — `LibraryBrowserModal` (snippet library UI)
- `src/views/library-snippet-preview-modal.ts` — `LibrarySnippetPreviewModal`
- `src/views/protocol-library-browser-modal.ts` — `ProtocolLibraryBrowserModal`
- `src/views/snippet-manager-view.ts:95-101,586-607` — Library button + exportLibraryContribution
- `src/views/snippet-manager/tree-renderer.ts:59` — exportLibraryContribution callback
- `src/styles/library-preview-modal.css` — Library preview CSS
- `src/styles/snippet-manager.css:540-694` — Library browser CSS
- `src/i18n/locales/en.json:333-386` — Library + protocolLibrary i18n keys
- `src/i18n/locales/ru.json:333-386` — Library + protocolLibrary i18n keys (Russian)
- `src/views/protocol-editor-view.ts:312-332` — `computeEdgeBend()` (backward branch uses fixed bend=20)
- `src/views/protocol-editor-view.ts:390-431` — Backward (elbow) edge route branches
- `src/views/protocol-editor-view.ts:1328-1385` — `bindDrag()` drag lifecycle
- `src/views/protocol-editor-view.ts:621-636` — `addNodeAtWorldPoint()` (flash source)
- `src/views/protocol-editor-view.ts:488-507` — `loadProtocol()` (full DOM rebuild)
- `src/styles/protocol-editor.css:102-108` — 2026-06-01 CSS fix (stroke-linejoin: round)
- Previous fix artifacts: `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md`, `.rpiv/artifacts/plans/2026-06-02_10-40-04_protocol-editor-review-fixes.md`
