---
template_version: 1
date: 2026-06-04T11:07:53+0300
author: Roman Shulgha
commit: af25010
branch: main
repository: RadiProtocol
topic: "Validation of Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners"
status: complete
parent: ".rpiv/artifacts/plans/2026-06-02_20-11-53_protocol-editor-canvas-ux-follow-up.md"
tags: [validation, protocol-editor, canvas, drag, edge-routing, node-creation, ux]
last_updated: 2026-06-04T11:07:53+0300
---

## Validation Report: Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners

### Implementation Status

- ✓ Phase 1: Live Geometry Invalidation — Fully implemented
- ✓ Phase 2: Incremental Node Creation — Fully implemented
- ✓ Phase 3: Orthogonal Route Cleanup — Fully implemented
- ✓ Phase 4: Regression Coverage and Full Validation — Fully implemented

### Automated Verification Results

- ✓ Focused save geometry tests: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 1 test file passed, 4 tests passed.
- ✓ Type checking: `npx tsc --noEmit` — passed with no diagnostics.
- ✓ Live geometry grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "currentNodeGeometry(from"` — returned a match in `updateEdgePaths()`.
- ✓ Hot-path stale-anchor grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "protocolEditorPortAnchor(from, outputSide)"` — returned no match in the `updateEdgePaths()` block.
- ✓ Node creation reload grep: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` — no node creation continuation contains this reload; the only remaining hit is unrelated auto-layout refresh.
- ✓ Keyboard/modal tests: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts` — 1 test file passed, 16 tests passed.
- ✓ CSS non-scaling stroke grep: `grep -n "vector-effect: non-scaling-stroke" src/styles/protocol-editor.css` — 5 matches, including editor edge and minimap rules.
- ✓ Lint: `npm run lint` — ESLint and Stylelint completed successfully.
- ✓ Protocol editor route helper tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts` — 1 test file passed, 41 tests passed.
- ✓ Production build: `npm run build` — TypeScript check plus production esbuild bundle completed successfully.
- ✓ Full test suite: `npm test` — 56 test files passed, 709 tests passed.
- ✓ No regressions detected by the plan's automated verification suite.

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:513` — `liveNodeGeometryById` cache is present alongside the existing node-element cache.
- `src/views/protocol-editor-view.ts:549-550` and `src/views/protocol-editor-view.ts:808-809` — live geometry and element caches are cleared on close and full document render.
- `src/views/protocol-editor-view.ts:1009-1021` — `updateEdgePaths()` routes from `currentNodeGeometry(from/to)`, so incremental edge updates prefer cached live geometry instead of replacement-document coordinates.
- `src/views/protocol-editor-view.ts:1205-1231` — `applyNodePosition()` records live geometry, and `currentNodeGeometry()` falls back to document-derived measurements.
- `src/views/protocol-editor-view.ts:1471-1478` and `src/views/protocol-editor-view.ts:1500-1505` — drag move/up both apply node position and update edge paths before geometry persistence.
- `src/views/protocol-editor-view.ts:689-704` and `src/views/protocol-editor-view.ts:763-801` — standalone and connected node creation snapshot path/generation, update the store, apply the updated document incrementally, open the edit modal, and avoid `loadProtocol()` in creation continuations.
- `src/views/protocol-editor-view.ts:889-908` — `applyCreatedProtocolDocument()` updates the active document, renders/appends the created node when needed, then refreshes edges and minimap without rebuilding the shell.
- `src/views/protocol-editor-view.ts:60-116` and `src/views/protocol-editor-view.ts:434-495` — orthogonal edge routes use a centralized rounded-path helper that normalizes points, clamps bends, and omits degenerate bends.
- `src/styles/protocol-editor.css:74-110` and `src/styles/protocol-editor.css:551-603` — editor and minimap SVG strokes include non-scaling stroke handling; visible editor edges retain rounded joins/caps and `shape-rendering: geometricprecision`.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:166-211` — the live-geometry regression simulates a replaced document, seeds live geometry, asserts the live anchor is used, and asserts the stale document anchor is not used.
- `src/__tests__/protocol-editor-helpers.test.ts:143-201` and `src/__tests__/protocol-editor-helpers.test.ts:261-281` — route tests cover straight routes, backward U-turn no-overshoot, zero-radius `Q` omission, and forward dogleg no-backtracking.
- `package.json:10` and `tsconfig.json:13` — verification-supporting environment fixes keep lint and TypeScript checks passing in the current toolchain.

#### Deviations from Plan:

- None. Implementation is a faithful realization of the plan; the additional `package.json` and `tsconfig.json` changes are verification-enabling fixes, not functional deviations.

#### Pattern Conformance:

- ✓ Protocol Editor changes preserve the existing `ItemView` DOM-building style and incremental SVG path-update hot path.
- ✓ Map-based caches, path/generation guards in node creation, and focused Vitest view mocks follow nearby Protocol Editor conventions.
- ✓ The route helper remains a pure exported helper with prefixed local utilities and coverage in `protocol-editor-helpers.test.ts`.
- Minor observation: broader async Protocol Editor flows still have mixed stale-guard coverage, but the creation flows required by this plan now use the requested path/generation guard; this is acceptable variation, not a plan deviation.

### Manual Testing Required:

1. Live connected-edge dragging:
   - [ ] Open the Protocol Editor and drag a connected node immediately after opening; connected edges move live.
   - [ ] Release the node, drag it again without reloading; connected edges still move live during the second drag.
   - [ ] Auto-arrange horizontally and vertically; after each auto-layout, drag once and then drag again, confirming edges move live every time.

2. Incremental node creation:
   - [ ] Create a standalone node from an empty canvas double-click; the canvas does not flash/rebuild when the node appears and the edit modal opens.
   - [ ] Drag a connection to empty canvas and create a connected node; the new node and edge appear without canvas flash/rebuild.
   - [ ] Close the new-node edit modal, then drag the created node; connected edges still move live.

3. Edge route visuals:
   - [ ] Inspect backward LR U-shaped / П-shaped edges at multiple zoom levels; corners are rounded/clean with no overshoot teeth.
   - [ ] Inspect backward TB U-shaped / П-shaped edges at multiple zoom levels; corners are rounded/clean with no overshoot teeth.
   - [ ] Inspect direct straight LR/TB edges at multiple zoom levels; they still render as simple direct lines without new artifacts.

### Recommendations:

- Ready to commit — implementation is complete and automated validation passes.
- Complete the manual Obsidian visual QA checklist before release, because perceived flicker/smoothness and zoom-level corner artifacts cannot be fully proven by repository tests alone.
