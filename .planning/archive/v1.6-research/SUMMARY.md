# Project Research Summary

**Project:** RadiProtocol v1.6 -- Canvas Workflow and Polish
**Domain:** Obsidian plugin -- programmatic canvas manipulation, dead code cleanup, UI polish
**Researched:** 2026-04-16
**Confidence:** MEDIUM-HIGH

## Executive Summary

RadiProtocol v1.6 is a polish-and-workflow milestone that adds programmatic canvas node creation/duplication to the sidebar editor, cleans up accumulated dead code from 5 prior milestones, and fixes several UI friction points. The headline features -- quick-create buttons and node duplication -- depend on Obsidian undocumented internal Canvas API (`createTextNode`), which is well-validated across 3+ community plugins (enchanted-canvas, canvas-llm-extender, advanced-canvas) but carries inherent MEDIUM confidence due to its undocumented status. The existing codebase already uses this same internal API (Pattern B) for live node editing, so the integration path is proven.

The recommended approach is to start with dead code cleanup (zero dependencies, reduces noise for subsequent work), then handle independent polish items (UI fixes, path sync), and finally build the canvas node creation infrastructure as the culminating feature. Node creation requires a new `CanvasNodeFactory` service layered on top of the existing `CanvasLiveEditor`, with runtime API probing as a mandatory safety pattern. The architecture is clean: one new file (~150 lines), minor extensions to two existing files, and toolbar additions to `EditorPanelView`.

The primary risks are: (1) the undocumented `createTextNode` API changing in a future Obsidian release -- mitigated by runtime probing with graceful fallback to getData/setData; (2) dead code false positives removing Obsidian event callbacks that appear unused to static analysis -- mitigated by a two-pass audit with mandatory test suite verification; (3) the Strategy A vs Pattern B race condition on node creation -- mitigated by requiring Pattern B (canvas must be open) for all creation operations, which aligns with the UX requirement that users need to see nodes appear.

## Key Findings

### Recommended Stack

No new runtime dependencies are needed. The existing stack (TypeScript 6.0.2, Obsidian 1.12.3, esbuild 0.28.0, Vitest 4.1.2) is unchanged.

**Additions:**
- **Knip v6.4+**: Dead code detection -- the only actively maintained TS dead code tool (ts-prune and tsr are both EOL and recommend Knip as successor). Use as `npx knip` one-shot or devDependency.
- **Canvas internal API type extensions**: Extend existing `canvas-internal.d.ts` with `createTextNode`, `CanvasNodeInternal`, and `nodes` map declarations. No npm package needed.
- **`crypto.getRandomValues`**: Built-in Electron API for generating 16-char hex canvas node IDs. No `uuid` package needed.

### Expected Features

**Must have (table stakes):**
- Dead code cleanup -- tech debt from 5 milestones; `.rp-legend*` CSS, stale imports, RED test stubs
- Fix TipJSON spacing bug -- visual defect in snippet modals (Cyrillic label concatenated with type badge)
- Create folder button in snippet editor header -- missing discoverability
- Canvas node path sync on directory rename via native file explorer -- data integrity gap

**Should have (differentiators):**
- Quick node creation buttons in EditorPanelView -- one-click typed node creation from sidebar; no competing plugin offers this
- Duplicate node with preserved RadiProtocol settings -- massive time savings for repetitive protocol structures

**Defer (v2+):**
- Edge creation from sidebar -- spatial routing problem, canvas-native UX is better
- Batch node creation -- layout algorithm problem, out of scope
- Auto-layout / auto-arrange -- destroys user intentional spatial arrangement
- Live canvas node preview in sidebar -- fragile, version-dependent

### Architecture Approach

Node creation integrates as a new capability layer on top of the existing `EditorPanelView` + `CanvasLiveEditor` architecture. A new `CanvasNodeFactory` service encapsulates creation logic, default property stamping, and position calculation. It communicates with the canvas via `CanvasLiveEditor.getCanvasObject()` (new accessor) and uses Pattern B (`createTextNode` then `getData`/`setData` then `requestSave`) for all operations.

**Major components:**
1. **CanvasNodeFactory** (NEW) -- encapsulates `createNode()` and `duplicateNode()` with runtime API probing, position calculation, and `radiprotocol_*` property stamping
2. **CanvasLiveEditor** (MODIFY) -- gains `getCanvasObject()` method exposing raw canvas for `createTextNode()` calls
3. **EditorPanelView** (MODIFY) -- gains quick-create toolbar (7 node-kind buttons) and conditional duplicate button
4. **canvas-internal.d.ts** (MODIFY) -- extended with `createTextNode`, `CanvasNodeInternal`, `CreateTextNodeOptions` types

### Critical Pitfalls

1. **Strategy A race on node creation** -- `vault.modify()` on an open canvas causes nodes to silently vanish when canvas auto-saves its stale in-memory state. Prevention: use Pattern B exclusively for creation; require canvas to be open.
2. **Dead code false positives** -- Obsidian callbacks registered via `registerEvent()` / `addCommand()` appear unused to static analysis. Prevention: two-pass audit; verify each candidate is not transitively reachable from any registration site; run `npm test` after every batch removal.
3. **Node position overlap** -- Creating nodes at fixed coordinates stacks them on existing nodes. Prevention: offset from selected node (width+40 or height+40); overlap detection via AABB check against `canvas.nodes`.
4. **Duplicate node missing `radiprotocol_*` fields** -- Copying only standard fields produces a plain canvas node. Prevention: iterate ALL keys on source, exclude only `id`/`x`/`y`; do NOT maintain a whitelist.
5. **`rewriteCanvasRefs` race with open canvas on directory rename** -- `vault.modify()` overwrites are clobbered by open canvas auto-save. Prevention: for v1.6, accept the limitation and warn users to close canvas before folder rename.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Dead Code Audit and Cleanup
**Rationale:** Zero dependencies, reduces noise for all subsequent phases, addresses known tech debt documented in PROJECT.md. Must come first so subsequent phases build on a clean codebase.
**Delivers:** Removal of unused exports, dead CSS (`.rp-legend*`), stale test stubs, unused imports. Knip configuration for ongoing use.
**Addresses:** Dead code cleanup (table stakes)
**Avoids:** Pitfall 3 (false positives on callbacks) and Pitfall 4 (CSS append-only rule). Requires full test suite run after each batch removal and visual UAT.

### Phase 2: UI Fixes and Polish
**Rationale:** Independent from canvas creation work; low complexity; quick wins that improve UX immediately. Can be grouped as a single phase with multiple small tasks.
**Delivers:** TipJSON spacing fix (both create and edit modals), Create folder button in snippet editor header with explicit tree refresh.
**Addresses:** Fix spacing bug (table stakes), Create folder button (table stakes)
**Avoids:** Pitfall 8 (inconsistent fix across modals) and Pitfall 9 (folder button without tree refresh)

### Phase 3: Canvas Path Sync on Directory Rename
**Rationale:** Extends existing proven infrastructure (`rewriteCanvasRefs`). Independent from node creation work. Addresses a data integrity gap.
**Delivers:** Vault rename listener for directories under snippet folder path; automatic `radiprotocol_subfolderPath` rewrite across all canvas files.
**Addresses:** Canvas node path sync on directory rename (table stakes)
**Avoids:** Pitfall 6 (`rewriteCanvasRefs` race with open canvas). Accept-and-warn approach recommended for v1.6.

### Phase 4: Canvas Node Creation Infrastructure
**Rationale:** Core infrastructure that both quick-create and duplicate depend on. Must precede UI integration. This is the highest-risk phase due to undocumented API dependency.
**Delivers:** `CanvasNodeFactory` service, extended `canvas-internal.d.ts` types, `getCanvasObject()` accessor on `CanvasLiveEditor`, position calculation utility, default property templates for all 8 node kinds.
**Addresses:** Quick node creation (differentiator) -- backend only
**Avoids:** Pitfall 1 (ID collision -- use `createTextNode` own ID), Pitfall 2 (Strategy A race -- Pattern B only), Pitfall 5 (overlap -- offset + AABB detection)

### Phase 5: Quick-Create and Duplicate UI
**Rationale:** Depends on Phase 4 infrastructure. UI layer on top of factory service. Can include both quick-create toolbar and duplicate button since they share the same factory.
**Delivers:** Quick-create toolbar in EditorPanelView (7 buttons for each RPNodeKind), duplicate button (conditional on node loaded), auto-load of created/duplicated node in editor form, CSS styling.
**Addresses:** Quick node creation buttons (differentiator), Duplicate node (differentiator)
**Avoids:** Pitfall 7 (duplicate missing fields -- copy ALL keys), UX pitfalls (disabled state with tooltip when no canvas open)

### Phase Ordering Rationale

- Dead code cleanup first: reduces codebase noise, prevents cascading issues into new features
- UI fixes before canvas work: quick wins ship early, independent from the complex canvas API integration
- Path sync before node creation: uses only proven existing infrastructure, validates the vault watcher pattern that creation may also leverage
- Node creation infrastructure before UI: ensures the factory is tested in isolation before wiring into the 740-line EditorPanelView
- Quick-create and duplicate together in final phase: they share the same `CanvasNodeFactory` and toolbar UI area

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Canvas Node Creation Infrastructure):** The `createTextNode` API shape and behavior should be verified against the current Obsidian version (1.12.3) during phase planning. Runtime probing is mandatory. The options-object signature (vs. older positional args) needs confirmation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Dead Code Audit):** Knip tooling is well-documented; the audit process is mechanical
- **Phase 2 (UI Fixes):** Pure DOM changes using established patterns
- **Phase 3 (Path Sync):** Extends existing `rewriteCanvasRefs` with a new event trigger; no new patterns
- **Phase 5 (Quick-Create UI):** Standard EditorPanelView toolbar addition once factory is built

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new runtime deps; Knip is well-documented with active maintenance |
| Features | HIGH | Clear user value; feature scope is well-bounded; anti-features explicitly excluded |
| Architecture | MEDIUM-HIGH | Clean layering on existing patterns; CanvasNodeFactory is straightforward. Slight uncertainty on `createTextNode` options shape across Obsidian versions |
| Pitfalls | HIGH | Based on direct codebase analysis of existing Pattern B implementation; all pitfalls have proven prevention strategies |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **`createTextNode` API stability:** The options-object signature is verified against 3 community plugins but is undocumented. Must verify against Obsidian 1.12.3 specifically during Phase 4 planning. Fallback to getData/setData is available if needed.
- **Viewport center calculation:** The research references `canvas.tx`/`canvas.ty` for viewport position but these internals are not fully documented. Phase 4 should include a dev-console exploration step.
- **`vault.adapter.mkdir()` event behavior:** Whether Obsidian fires a `vault.on("create")` event for folder creation is uncertain. Phase 2 should test this and use explicit `refreshTree()` regardless.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `canvas-live-editor.ts`, `editor-panel-view.ts`, `canvas-ref-sync.ts`, `canvas-internal.d.ts`, `snippet-editor-modal.ts`
- [Knip official site](https://knip.dev) and [npm registry](https://www.npmjs.com/package/knip)
- [Official canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts)

### Secondary (MEDIUM confidence)
- [obsidian-advanced-canvas Canvas.d.ts](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/@types/Canvas.d.ts) -- internal API types
- [enchanted-canvas source](https://github.com/borolgs/enchanted-canvas) -- createTextNode usage, workspace events
- [obsidian-canvas-llm-extender source](https://github.com/Phasip/obsidian-canvas-llm-extender) -- createTextNode with save/focus flags, position calculation
- [Obsidian-Canvas-Presentation source](https://github.com/Quorafind/Obsidian-Canvas-Presentation) -- createTextNode usage

### Tertiary (LOW confidence)
- [Obsidian Forum: Canvas API](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- confirms undocumented status
- [Canvas System DeepWiki](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system) -- data schema overview

---
*Research completed: 2026-04-16*
*Ready for roadmap: yes*
