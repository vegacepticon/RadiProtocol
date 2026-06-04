---
template_version: 1
date: 2026-06-04T10:46:27+0300
author: Roman Shulgha
commit: 91b6548
branch: main
repository: RadiProtocol
topic: "Validation of Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners"
status: needs_changes
parent: ".rpiv/artifacts/plans/2026-06-02_20-11-53_protocol-editor-canvas-ux-follow-up.md"
tags: [validation, protocol-editor, canvas, drag, edge-routing, node-creation, ux]
last_updated: 2026-06-04T10:46:27+0300
---

## Validation Report: Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners

### Implementation Status

- ✓ Phase 1: Live Geometry Invalidation — Fully implemented
- ✓ Phase 2: Incremental Node Creation — Fully implemented
- ✓ Phase 3: Orthogonal Route Cleanup — Fully implemented
- ⚠️ Phase 4: Regression Coverage and Full Validation — Partially implemented (see Findings)

### Automated Verification Results

- ✓ Focused save geometry tests: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 1 test file passed, 4 tests passed.
- ✗ Type checking: `npx tsc --noEmit` — failed in dependency declaration resolution (`@vitest/utils/display` and `vite/module-runner` could not be resolved under current `moduleResolution`).
- ✓ Live geometry grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "currentNodeGeometry(from"` — returned a match in `updateEdgePaths()`.
- ✓ Hot-path stale-anchor grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "protocolEditorPortAnchor(from, outputSide)"` — returned no match in the `updateEdgePaths()` block.
- ✓ Node creation reload grep: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` — no node creation continuation contains this reload; the remaining hit is an unrelated auto-layout flow.
- ✓ Keyboard/modal tests: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts` — 1 test file passed, 16 tests passed.
- ✓ CSS non-scaling stroke grep: `grep -n "vector-effect: non-scaling-stroke" src/styles/protocol-editor.css` — 5 matches, including editor edge and minimap rules.
- ✗ Lint: `npm run lint` — failed when Stylelint reported no files matching the quoted pattern `'src/styles/**/*.css'` in the current shell.
- ✓ Protocol editor route helper tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts` — 1 test file passed, 41 tests passed.
- ✓ Production build: `npm run build` — passed (`tsc -noEmit -skipLibCheck` plus production esbuild bundle).
- ✓ Full test suite: `npm test` — 56 test files passed, 709 tests passed.

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:513` — added `liveNodeGeometryById` cache for rendered node geometry.
- `src/views/protocol-editor-view.ts:549-550` and `src/views/protocol-editor-view.ts:808-810` — clears node/geometry caches on close and full render.
- `src/views/protocol-editor-view.ts:1017-1019` — incremental edge updates route through `currentNodeGeometry(from/to)`, preferring live geometry over stale replacement document nodes.
- `src/views/protocol-editor-view.ts:1204-1230` — `applyNodePosition()` records live geometry and `currentNodeGeometry()` falls back to document-derived measurements.
- `src/views/protocol-editor-view.ts:1473-1478` and `src/views/protocol-editor-view.ts:1500-1504` — drag move/up both apply node position and update edge paths before save.
- `src/views/protocol-editor-view.ts:689-705` and `src/views/protocol-editor-view.ts:763-803` — standalone and connected node creation use generation/path guards, apply the updated document incrementally, open the edit modal, and do not call `loadProtocol()` in their creation continuations.
- `src/views/protocol-editor-view.ts:831-910` — extracted `renderNode()` and `applyCreatedProtocolDocument()` implement targeted node rendering plus edge/minimap refresh.
- `src/views/protocol-editor-view.ts:87-118` and `src/views/protocol-editor-view.ts:434-495` — orthogonal routes use a centralized rounded path helper that normalizes points, clamps bend radius, and omits degenerate bends.
- `src/styles/protocol-editor.css:74-110` and `src/styles/protocol-editor.css:551-603` — edge and minimap SVG strokes include non-scaling stroke handling; visible editor edges keep rounded joins/caps and geometric precision.
- `src/__tests__/protocol-editor-helpers.test.ts:143-201` — route tests cover backward U-turn no-overshoot, aligned zero-radius `Q` omission, and forward dogleg rank monotonicity.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:166-208` — added a live-geometry-after-document-replacement regression test.

#### Deviations from Plan:

- `npx tsc --noEmit` — plan-required type checking does not pass as written because Vitest/Vite declaration imports are unresolved under the repository's current TypeScript module resolution settings.
- `npm run lint` — plan-required linting does not pass as written in the current shell because Stylelint receives the quoted glob literally and finds no CSS files.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:207-208` — the strengthened stale-document negative assertion checks `M 15000 12040`, but the stale LR output anchor for `x=0,width=200` would be `M 15200 12040`; the positive live assertion still catches stale routing, but the explicit Phase 4 negative check is not the one requested by the plan.

#### Pattern Conformance:

- ✓ Extracting `renderNode()` inside `protocol-editor-view.ts` follows the existing large-view-file pattern and preserves direct helper tests/imports.
- ✓ View tests continue to use local Obsidian mocks, private-method access via `(view as any)`, and focused Vitest factories consistent with nearby Protocol Editor tests.
- ✓ `updateEdgePaths()` preserves the established incremental SVG update pattern rather than rebuilding the full canvas during drag.
- Minor observation: `src/views/protocol-editor-view.ts:1006` has a stale comment saying edge updates use anchors from `this.doc`; implementation now prefers live geometry. This is an acceptable implementation variation but should be cleaned up for maintainability.

#### Potential Issues:

- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:187` — the test installs `globalThis.CSS` without cleanup. This did not break the current suite, but restoring globals would better match other view-test patterns.

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

- Address the failing `npx tsc --noEmit` success criterion, either by updating TypeScript module resolution/dependency compatibility or by revising the plan to use the repository's passing build command if that is the intended type-check contract.
- Address the failing `npm run lint` command in this environment by making the Stylelint glob portable across the shells used by validation.
- Correct the stale-document negative assertion in `src/__tests__/views/protocol-editor-save-node-geometry.test.ts` to check `M 15200 12040`.
- Clean up the stale `updateEdgePaths()` comment and consider restoring `globalThis.CSS` after the live-geometry regression test.
- Re-run `/skill:validate` after these gaps are fixed.
