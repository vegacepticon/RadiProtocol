---
template_version: 1
date: 2026-06-04T10:59:27+0300
author: Roman Shulgha
commit: 91b6548
branch: main
repository: RadiProtocol
topic: "Validation of Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners"
status: complete
parent: ".rpiv/artifacts/plans/2026-06-02_20-11-53_protocol-editor-canvas-ux-follow-up.md"
tags: [validation, protocol-editor, canvas, drag, edge-routing, node-creation, ux]
last_updated: 2026-06-04T10:59:27+0300
---

## Validation Report: Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners

### Implementation Status

- ✓ Phase 1: Live Geometry Invalidation — Fully implemented
- ✓ Phase 2: Incremental Node Creation — Fully implemented
- ✓ Phase 3: Orthogonal Route Cleanup — Fully implemented
- ✓ Phase 4: Regression Coverage and Full Validation — Fully implemented

### Automated Verification Results

- ✓ Focused save geometry tests: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 1 test file passed, 4 tests passed.
- ✓ Protocol editor route helper tests: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts` — 1 test file passed, 41 tests passed.
- ✓ Keyboard/modal tests: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts` — 1 test file passed, 16 tests passed.
- ✓ Type checking: `npx tsc --noEmit` — passed after switching TypeScript package-export resolution to `moduleResolution: "bundler"`.
- ✓ Lint: `npm run lint` — passed after making the Stylelint glob portable for the current shell.
- ✓ Production build: `npm run build` — passed (`tsc -noEmit -skipLibCheck` plus production esbuild bundle).
- ✓ Full test suite: `npm test` — 56 test files passed, 709 tests passed.
- ✓ Live geometry grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "currentNodeGeometry(from"` — returned a match in `updateEdgePaths()`.
- ✓ Hot-path stale-anchor grep: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "protocolEditorPortAnchor(from, outputSide)"` — returned no match in the `updateEdgePaths()` block.
- ✓ Node creation reload grep: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` — no node creation continuation contains this reload; the remaining hit is an unrelated auto-layout flow.
- ✓ CSS non-scaling stroke grep: `grep -n "vector-effect: non-scaling-stroke" src/styles/protocol-editor.css` — 5 matches, including editor edge and minimap rules.

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:513` — live node geometry cache is present.
- `src/views/protocol-editor-view.ts:1009-1021` — incremental `updateEdgePaths()` uses `currentNodeGeometry(from/to)`, preferring cached live geometry over replacement-document coordinates.
- `src/views/protocol-editor-view.ts:1205-1231` — `applyNodePosition()` records live geometry and `currentNodeGeometry()` falls back to document-derived measurements.
- `src/views/protocol-editor-view.ts:1471-1478` and `src/views/protocol-editor-view.ts:1500-1505` — drag move/up both apply node position and update edge paths before save.
- `src/views/protocol-editor-view.ts:689-704` and `src/views/protocol-editor-view.ts:763-800` — standalone and connected node creation use generation/path guards, apply updated documents incrementally, open edit modals, and avoid `loadProtocol()` in creation continuations.
- `src/views/protocol-editor-view.ts:889-908` — `applyCreatedProtocolDocument()` updates the active document, renders/appends only the created node when needed, then refreshes edges/minimap.
- `src/views/protocol-editor-view.ts:72-116` and `src/views/protocol-editor-view.ts:434-495` — orthogonal routes use the centralized rounded helper that normalizes points, clamps bends, and omits degenerate bends.
- `src/styles/protocol-editor.css:74-110` and `src/styles/protocol-editor.css:551-603` — editor and minimap SVG strokes include non-scaling stroke handling.
- `src/__tests__/protocol-editor-helpers.test.ts:143-201` — route tests cover straight routes, backward U-turn no-overshoot, aligned zero-radius `Q` omission, and forward dogleg rank monotonicity.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:187-217` — the live-geometry regression test restores `globalThis.CSS` after installing its local mock.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:208-211` — the stale-document negative assertion now checks the correct stale LR anchor, `M 15200 12040`.
- `src/views/protocol-editor-view.ts:1001-1008` — the stale `updateEdgePaths()` comment now documents live-geometry-first behavior.
- `package.json:10` — `npm run lint` no longer passes a quoted Stylelint glob literally in this environment.
- `tsconfig.json:13` — `npx tsc --noEmit` can resolve Vitest/Vite package-export declaration imports via `moduleResolution: "bundler"`.

#### Deviations from Plan:

- None. The previous validation deviations and potential issues have been addressed.

#### Pattern Conformance:

- ✓ View tests continue to use local Obsidian mocks and explicit Vitest imports, matching nearby Protocol Editor test patterns.
- ✓ The `globalThis.CSS` save/restore pattern in the save-geometry test matches other view-test global cleanup conventions.
- ✓ `updateEdgePaths()` preserves the existing incremental SVG update pattern rather than rebuilding the canvas during drag.
- ✓ The TypeScript config remains `module: "ESNext"`; `moduleResolution: "bundler"` is the minimal package-export-compatible setting for the existing ESM/esbuild toolchain.

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
