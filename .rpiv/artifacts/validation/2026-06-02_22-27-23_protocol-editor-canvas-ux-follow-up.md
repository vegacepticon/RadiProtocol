---
date: 2026-06-02T22:27:23+0300
author: Roman Shulgha
commit: 44e0907
branch: main
repository: RadiProtocol
topic: "Validation of Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners"
status: needs_changes
parent: ".rpiv/artifacts/plans/2026-06-02_20-11-53_protocol-editor-canvas-ux-follow-up.md"
tags: [validation, protocol-editor, canvas, drag, edge-routing, node-creation, ux]
last_updated: 2026-06-02T22:27:23+0300
---

## Validation Report: Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners

### Implementation Status

- ⚠️ Phase 1: Live Geometry Invalidation — Fully implemented
- ✗ Phase 2: Incremental Node Creation — Not implemented
- ✗ Phase 3: Orthogonal Route Cleanup — Not implemented
- ✗ Phase 4: Regression Coverage and Full Validation — Not implemented (depends on Phases 2–3)

### Automated Verification Results

- ✓ Save geometry tests: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 4 passed, 0 failed
- ✓ Route helper tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts` — 37 passed, 0 failed
- ✓ Keyboard/modal tests: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts` — 16 passed, 0 failed
- ✓ Full test suite: `npx vitest run` — 56 files, 705 tests, all passed
- ✓ Production build: `npm run build` — succeeded
- ⚠️ Type checking: `npx tsc --noEmit` — 5 errors, all pre-existing in `node_modules/@vitest`/`node_modules/vitest` (moduleResolution mismatch); 0 errors in `src/`
- ⚠️ Lint: `npm run lint` — Stylelint glob error (pre-existing), ESLint portion not independently verified
- ✓ Phase 1 grep — live geometry routing confirmed in `updateEdgePaths()`: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "currentNodeGeometry(from"` returns match at line 926; no bare `protocolEditorPortAnchor(from, outputSide)` in the same block
- ✗ Phase 2 grep — node creation still reloads: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` still reports lines 644 (`addNodeAtWorldPoint` `.then()`) and 738 (`addNodeAndConnectAtWorldPoint` `.then()`)
- ✗ Phase 3 CSS — `grep -n "vector-effect: non-scaling-stroke" src/styles/protocol-editor.css` returns 3 matches (lines 553, 562, 600), but all are for minimap rules only; `.rp-protocol-editor-edge` and `.rp-protocol-editor-edge-hitbox` are missing `vector-effect: non-scaling-stroke`. No `shape-rendering: geometricprecision` anywhere.
- ✗ Phase 4 tests — none of the four new regression tests exist in `src/__tests__/protocol-editor-helpers.test.ts`

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:458` — `liveNodeGeometryById` cache field exists, matching Phase 1 spec
- `src/views/protocol-editor-view.ts:495` — cache cleared in `onClose()`, matching Phase 1 spec
- `src/views/protocol-editor-view.ts:748` — cache cleared at start of `renderDocument()`, matching Phase 1 spec
- `src/views/protocol-editor-view.ts:1127-1135` — `rememberLiveNodeGeometry()` records geometry as specified
- `src/views/protocol-editor-view.ts:1137-1139` — `currentNodeGeometry()` prefers live cache with `fallbackNodeGeometry()` fallback
- `src/views/protocol-editor-view.ts:1112-1114` — `applyNodePosition()` calls `rememberLiveNodeGeometry()` before setting DOM style
- `src/views/protocol-editor-view.ts:926-927` — `updateEdgePaths()` routes from `currentNodeGeometry(from)` / `currentNodeGeometry(to)`
- `src/views/protocol-editor-view.ts:1383-1385` — `bindDrag()` rAF batch calls `applyNodePosition` → `updateEdgePaths`
- `src/views/protocol-editor-view.ts:1412-1414` — `onUp` handler calls `applyNodePosition` → `updateEdgePaths` → `saveNodeGeometry`
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:149-188` — live geometry regression test exists, verifies stale-doc path is NOT used

#### Deviations from Plan:

- `src/views/protocol-editor-view.ts:634-650` (`addNodeAtWorldPoint`) — Still calls `await this.loadProtocol(this.protocolPath!)` after node creation. Plan Phase 2 requires replacing this with an incremental `applyCreatedProtocolDocument()` path. The `renderNode()` helper and `applyCreatedProtocolDocument()` method are absent.
- `src/views/protocol-editor-view.ts:705-742` (`addNodeAndConnectAtWorldPoint`) — Same pattern: `loadProtocol()` reload after creation instead of incremental update. Missing `protocolPath`/`loadGeneration` stale guards.
- `src/views/protocol-editor-view.ts:342-443` (`protocolEditorEdgeRoute`) — Still uses hand-built `Q` command arrays. The plan's `roundedProtocolEditorOrthogonalPath()` helper, coordinate normalization, zero-radius omission, and overshoot clamping are absent.
- `src/styles/protocol-editor.css:74-78` (`.rp-protocol-editor-edge-hitbox`) — Missing `vector-effect: non-scaling-stroke`
- `src/styles/protocol-editor.css:102-107` (`.rp-protocol-editor-edge`) — Missing `vector-effect: non-scaling-stroke` and `shape-rendering: geometricprecision`
- `src/__tests__/protocol-editor-helpers.test.ts` — Missing four new regression tests: backward U-turn overshoot (LR + TB), zero-radius Q omission, and forward dogleg rank monotonicity

#### Potential Issues:

- `src/views/protocol-editor-view.ts:738` — `addNodeAndConnectAtWorldPoint` `.then()` calls `await this.loadProtocol()` with `!` assertion even though `this.protocolPath` is already null-checked at function entry. If the protocol file is deleted between the null check and the async update completion, this throws instead of silently no-opping like the stale-guard pattern would.
- Phases 2–4 are blocked by missing implementation in Phase 2. Phase 3's orthogonal route cleanup could be implemented independently, but Phase 4 regression tests depend on Phase 3's new helpers being present.

### Manual Testing Required:

Phase 1 (implemented — manual verification recommended):

1. Live edge dragging:
   - [ ] Open the Protocol Editor and drag a connected node immediately after opening; connected edges move live
   - [ ] Release the node, drag it again without reloading; connected edges still move live during the second drag
   - [ ] Auto-arrange horizontally or vertically, drag a node once, then drag again; connected edges move live on both drags

Phases 2–4 (not yet implemented — defer manual testing until code lands):

2. Node creation flash:
   - [ ] Create a standalone node from an empty canvas double-click; canvas does not flash/rebuild
   - [ ] Drag a connection to empty canvas and create a connected node; new node and edge appear without canvas flash
   - [ ] Close the new-node edit modal, then drag the created node; connected edges still move live

3. Orthogonal route quality:
   - [ ] Inspect a backward LR U-shaped / П-shaped edge; corners are rounded/clean with no overshoot teeth
   - [ ] Inspect a backward TB U-shaped / П-shaped edge; corners are rounded/clean with no overshoot teeth
   - [ ] Inspect direct straight LR/TB edges; they still render as simple direct lines

### Recommendations:

- **Phase 2 is the critical blocker.** Extract the `renderNode()` helper from the existing `renderDocument()` loop body, implement `applyCreatedProtocolDocument()`, add stale guards with `protocolPath`/`loadGeneration` snapshots, and remove `loadProtocol()` calls from both creation paths. See the plan's Phase 2 code fences for exact implementation.
- After Phase 2 lands, **Phase 3 can be implemented independently** — the `roundedProtocolEditorOrthogonalPath()` helper and CSS hardening do not depend on the incremental creation path.
- **Phase 4** should wait until both Phase 2 and Phase 3 code is in place, since the new regression tests reference the Phase 3 helpers and Phase 2's live geometry integration.
- Consider fixing the pre-existing Stylelint glob pattern error (`'src/styles/**/*.css'` vs bare `src/styles/**/*.css`) in a separate cleanup pass.
- Re-run `/skill:validate` after implementation to confirm all phases pass.
