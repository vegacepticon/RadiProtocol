---
date: 2026-06-01T23:01:21+0300
author: Roman Shulgha
commit: a7e16d5
branch: fixes-with-pi
repository: RadiProtocol
topic: "Protocol editor edge rendering and drag performance"
tags: [research, protocol-editor, edge-rendering, drag-performance, svg]
status: complete
last_updated: 2026-06-01T23:01:21+0300
last_updated_by: Roman Shulgha
---

# Research: Protocol editor edge rendering and drag performance

## Research Question
Investigate two issues in the protocol editor view (`src/views/protocol-editor-view.ts`): (1) edge/link rendering cusps/spikes at Q-curve transition points caused by fixed `bend=24` radius, and (2) drag stutter caused by full SVG rebuilds on every frame and unbatched synchronous layout writes.

## Summary
The edge cusp artifact is confirmed: `const bend = 24` (`protocol-editor-view.ts:314`) produces degenerate Q-curve path segments when node separation in either axis is < 48px — the L segment preceding the Q has zero or negative length, creating a fold/overlap in the rendered path. The backward routing branches (4 Q-curves vs. 2) have fixed 16px entry/exit segments that are always tight. 3 of 5 non-straight-line test cases already contain degenerate paths at bend=24. The drag stutter is driven by `renderEdges()` doing a full SVG teardown/rebuild (`this.svgEl.empty()` at line 780) on every rAF tick during drag, plus synchronous style writes in `applyNodePosition()` on every mousemove. `bindResize()` has no rAF gating at all. On drag end, `saveNodeGeometry()` triggers a full `loadProtocol()` cycle that re-reads the file and rebuilds the entire DOM for a single coordinate change. CSS `.rp-protocol-editor-edge` (`protocol-editor.css:102-106`) omits `stroke-linejoin` and `stroke-linecap`, defaulting to `miter`/`butt`.

## Detailed Findings

### Edge Path Geometry Degeneration

`protocolEditorEdgeRoute()` at `protocol-editor-view.ts:307-408` generates SVG `d` strings for all four routing variants using quadratic bezier (`Q`) curves with a hardcoded `bend = 24`.

**Forward-TB degeneration** (lines 321-339): When `rankDelta = y2 - y1 < 48`, the L segment `L x1 (midY - bend)` at line 333 goes UP (back toward the source) instead of DOWN, because `midY - bend < y1`. At `(x1, midY - bend)`, the L arrives going UP while the Q's initial tangent goes DOWN — a 180° reversal. When `normalDelta = x2 - x1 < 48`, vertex B at `(x1 + hs*bend, midY)` produces a horizontal 180° fold. Test at line 158 (`protocolEditorEdgeRoute(200, 100, 240, 420, 'TB')`) demonstrates: `normalDelta=40 < 48`, the horizontal segment runs from 224 LEFT to 216 — an 8px backtrack.

**Forward-LR degeneration** (lines 349-361): Same pattern rotated to horizontal/vertical axes. When `rankDelta = x2 - x1 < 48` (horizontal span < 48px), the first L has zero/negative length. When `normalDelta = y2 - y1 < 48`, the vertical middle segment degenerates. Test at line 151 (`protocolEditorEdgeRoute(100, 100, 500, 120, 'LR')`) shows `|Δy| = 20 < 48`, producing a -28px reverse vertical segment.

**Backward-TB degeneration** (lines 367-383): Exit/entry vertical offsets are hardcoded at 40px (lines 369-370: `exitY = y1 + 40`, `entryY = y2 - 40`). After subtracting `bend=24`, the first and last L segments are fixed at 16px — always tight. When target is very close to the source horizontally, the horizontal segments also shorten.

**Backward-LR degeneration** (lines 388-404): Mirror of backward-TB. Exit/entry horizontal offsets are hardcoded at 40px. The vertical middle at line 401 (`L entryX (y2 + bend)`) can hit exactly zero length when `routeY - y2 - 2*bend = 0`, which occurs when `y1` and `y2` are close.

### Full SVG Rebuild Cost

`renderEdges()` at line 778 opens with `this.svgEl.empty()` (line 780), then creates per-edge DOM:
- `<g>` group (`protocol-editor-view.ts:797`)
- Hitbox `<path>` (`:823-828`)
- Visible `<path>` (`:829-834`)
- Optionally: label `<g>` + `<rect>` + `<text>` (`:839-861`)
- Plus 3 event listeners per edge group (click, dblclick, keydown)

Minimum 3 DOM nodes per edge, maximum 6 with label. For 50 edges with labels: `6 × 50 × 60 = 18,000` DOM nodes created + destroyed per second at 60fps. Incremental `d` attribute updates would eliminate all insertion/removal — only O(N) `setAttribute` calls per frame.

### Drag Pipeline Synchronous Writes

`bindDrag()` (`protocol-editor-view.ts:1259`): `applyNodePosition()` runs synchronously on every mousemove (`:1282`), writing `style.left/top`. Edge re-render is rAF-gated (`:1283-1287`). This means 3-4 style writes can fire between rAF frames.

`bindResize()` (`protocol-editor-view.ts:1319`): **No rAF gating at all** (`:1339` calls `renderEdges()` synchronously on every mousemove). At 120Hz, this is 120 full DOM rebuilds + forced layouts per second.

`protocolEditorMeasuredNodeAnchor()` (`protocol-editor-view.ts:126`): Reads `nodeEl.offsetWidth`/`offsetHeight` (forced layout) for every edge's source and target on every renderEdges() call. This is called for both endpoints of every edge.

### Coordinate Precision and Round-Trip

The coordinate round-trip through `nodeEl.style.left → parseFloat → - PROTOCOL_EDITOR_ORIGIN` is lossless — JavaScript double-precision handles the full float. The only quantization is `Math.round()` in `onUp` at lines 1304-1305. During drag, edge anchors use unrounded floats; after save, they use rounded integers. Maximum drift: 0.5 world-coordinate units (~0.5px at zoom=1.0, ~1px at zoom=2.0).

### saveNodeGeometry Full-Reload Waste

After a single-node drag, `saveNodeGeometry()` (`protocol-editor-view.ts:1367`) updates one node's coordinates in the store, then calls `loadProtocol()` (`:1377`) which:
1. Re-reads the file from the store (`:477`)
2. Calls `renderShell()` (`:478`) — `container.empty()` + rebuilds entire DOM shell (~15+ elements)
3. Calls `renderDocument()` (`:479`) — `surfaceEl.empty()` + `svgEl.empty()` + N node element recreations + edge rebuild + minimap rebuild

For a 20-node, 25-edge protocol, this is ~300-750 DOM node creations, ~100-250 event listener bindings, and a file I/O — all because one coordinate changed. An incremental approach would skip the DOM rebuild entirely and just update the one node's position + re-render edges.

### CSS Stroke Properties

`.rp-protocol-editor-edge` (`protocol-editor.css:102-106`) sets only `fill`, `stroke`, and `stroke-width`. No `stroke-linejoin` or `stroke-linecap` — both default to `miter`/`butt`. The backward routing paths (4 Q-curves each) make explicit 90° turns where `miter` produces visible spikes. Adding `stroke-linejoin: round` would replace spikes with 2px-radius fillets regardless of path geometry. No other rule in the cascade (hover/focus at line 85, preview at line 108) sets these either. Zero matches across the entire `src/` directory for either property.

### Existing Test Degeneracy (bend=24)

The test file at `__tests__/protocol-editor-helpers.test.ts` has 5 Q-curve test cases. 3 are already degenerate:

| Test | Args | bend=24 behavior | Degenerate? |
|------|------|------------------|-------------|
| Line 130 | `(100,100,500,100,'LR')` | Straight line | No (straight) |
| Line 137 | `(200,100,200,400,'TB')` | Straight line | No (straight) |
| Line 144 | `(500,100,200,120,'LR')` | Backward LR | Partial (last L zero-length, Q endpoint = L target) |
| Line 151 | `(100,100,500,120,'LR')` | Forward LR, Δy=20 | **Yes** (-28px reverse vertical) |
| Line 158 | `(200,100,240,420,'TB')` | Forward TB, Δx=40 | **Yes** (-8px reverse horizontal) |
| Line 165 | `(200,320,160,120,'TB')` | Backward TB | Tight (16px exit/entry segments) |

Under dynamic clamping with `configuredMax=32`, the clamped bend values per test: LR (Δy=20) → 10, forward TB (Δx=40) → 20, backward LR (40px exit) → 20, backward TB (40px exit) → 20. All 4 non-straight tests need updated expected `d` string assertions.

## Code References
- `src/views/protocol-editor-view.ts:307-408` — `protocolEditorEdgeRoute()` — all 4 routing branches with fixed bend=24
- `src/views/protocol-editor-view.ts:314` — `const bend = 24` — root cause of degeneration
- `src/views/protocol-editor-view.ts:778-864` — `renderEdges()` — full SVG rebuild via `this.svgEl.empty()`
- `src/views/protocol-editor-view.ts:1028` — `applyNodePosition()` — synchronous style write on every mousemove
- `src/views/protocol-editor-view.ts:1259-1317` — `bindDrag()` — rAF-gated edge render, synchronous position writes
- `src/views/protocol-editor-view.ts:1319-1363` — `bindResize()` — NO rAF gating at all
- `src/views/protocol-editor-view.ts:1367-1380` — `saveNodeGeometry()` — full `loadProtocol()` on every drag end
- `src/views/protocol-editor-view.ts:461-479` — `loadProtocol()` — full shell + document rebuild
- `src/views/protocol-editor-view.ts:126-140` — `protocolEditorMeasuredNodeAnchor()` — forced layout reads
- `src/views/protocol-editor-view.ts:281-282` — `screenDeltaToProtocolEditorDelta()` — redundant zoom clamp
- `src/styles/protocol-editor.css:102-106` — `.rp-protocol-editor-edge` — missing stroke-linejoin/linecap
- `src/styles/protocol-editor.css:74-122` — all edge-related CSS rules
- `src/__tests__/protocol-editor-helpers.test.ts:130-168` — 6 edge route test cases
- `src/protocol/protocol-document.ts:63-83` — `ProtocolNodeRecord` interface (x, y, width, height)

## Integration Points

### Inbound References
- `src/__tests__/protocol-editor-helpers.test.ts:14` — unit tests for `protocolEditorEdgeRoute`
- `src/views/protocol-editor-view.ts:796` — `renderEdges()` calls `protocolEditorEdgeRoute()`
- `src/views/protocol-editor-view.ts:1095` — `updateConnectionPreview()` calls `protocolEditorEdgeRoute()`
- `src/views/protocol-editor-view.ts:791-792` — `renderEdges()` calls `protocolEditorMeasuredNodeAnchor()` for each edge's source and target
- `src/views/protocol-editor-view.ts:1312` — `saveNodeGeometry()` called from `bindDrag()` onUp
- `src/views/protocol-editor-view.ts:1357` — `saveNodeGeometry()` called from `bindResize()` onUp

### Outbound Dependencies
- `src/protocol/protocol-document.ts:63-83` — `ProtocolNodeRecord` — the x/y/width/height fields mutated during drag
- `src/views/protocol-editor-view.ts:21-22` — `PROTOCOL_EDITOR_ORIGIN_X/Y` (15000, 12000) — coordinate origin offset
- `src/views/protocol-editor-view.ts:25-27` — `MIN_ZOOM` (0.1), `MAX_ZOOM` (2), `ZOOM_STEP` (0.1)

### Infrastructure Wiring
- `src/views/protocol-editor-view.ts:428` — `private zoom: number = 1` — bound to `[0.1, 2]` at every write site
- `src/views/protocol-editor-view.ts:697-708` — `renderDocument()` — orchestrates node rendering + `renderEdges()` + `renderMinimap()`
- `src/views/protocol-editor-view.ts:1367-1380` — `saveNodeGeometry()` — persist through `protocolDocumentStore.update()` + full reload

## Architecture Insights
- **Edge routing is a pure function** (`protocolEditorEdgeRoute` at line 307) — no class state, no side effects. Easily testable in isolation. The existing test pattern (`protocol-editor-helpers.test.ts:130-168`) validates `d` string output.
- **The coordinate system decouples world coords from surface coords** via `PROTOCOL_EDITOR_ORIGIN_X/Y` (15000, 12000). `applyNodePosition()` converts world → surface for CSS `left/top`; `protocolEditorMeasuredNodeAnchor()` reverses via `parseFloat(style.left) - origin`.
- **The backward routing paths are inherently more complex** — 4 Q-curves vs. 2, with hardcoded 40px exit/entry offsets that leave only 16px clearance on the first/last segments. These are the most fragile paths.
- **`renderEdges()` and `renderMinimap()` are synchronous full rebuilds** — no incremental update path exists anywhere in the rendering pipeline.
- **Drag optimization is two-tiered**: `bindDrag()` has partial rAF gating (edges only), while `bindResize()` has none.
- **Zoom safety is defense-in-depth**: The redundant clamp in `screenDeltaToProtocolEditorDelta()` (`:281-282`) is a public-API guard. Internal code already guarantees `this.zoom` is always clamped at every write site.

## Precedents & Lessons
0 similar past changes analyzed.

### Precedent: Current code state
**Commit(s)**: `a7e16d5` — single commit in shallow clone; no git history available.
**Blast radius**: 1 primary file (`protocol-editor-view.ts`), 2 secondary files (`protocol-editor.css`, `protocol-editor-helpers.test.ts`)

**Takeaway**: The entire edge rendering and drag interaction is a single ~2000-line view file. All fixes are self-contained within this file + CSS + tests.

### Composite Lessons
- Fixed `bend=24` is the root cause of cusp artifacts — identical constant appears in all 4 routing branches. Clamp to `min(availableSegmentLength / 2, configuredMax)` must be branch-aware.
- `renderEdges()` full DOM rebuild is the primary drag bottleneck in both `bindDrag()` and `bindResize()`. Incremental `d` attribute updates eliminate all insertion/removal.
- 3 of 5 Q-curve tests encode degenerate paths (backtracking segments). Dynamic bend radius fixes the degeneration AND changes test expectations.
- CSS `stroke-linejoin: round` + `stroke-linecap: round` are a cheap safety net with zero performance cost.
- `saveNodeGeometry()` → `loadProtocol()` full reload on drag end is wasteful for single-coordinate changes.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-06-01_22-51-04_protocol-editor-edge-and-drag-fix.md` — FRD specifying fix scope, approach, and acceptance criteria

## Developer Context
**Q (discover: Scope — fix both issues): Should we fix both edge rendering and drag stutter, or one at a time?**
A: Fix both edge and drag in one pass.

**Q (discover: Edge fix approach): What approach for the edge cusp/spike artifact?**
A: Increase bend radius + clamp to segment length, plus check stroke-linejoin/linecap.

**Q (discover: Drag fix approach): What approach for drag stutter?**
A: Incremental edge update during drag + rAF batching of position writes.

**Q (discover: Platform constraints): Any platform compatibility constraints?**
A: Standard Obsidian desktop Chromium only.

**Q (discover: Performance target): What performance target for the drag fix?**
A: Perceptibly smooth — no specific FPS target.

**Q (discover: Acceptance criteria): What acceptance criteria should be captured?**
A: Visual smoothness at multiple zoom levels, perceptibly smooth drag, all existing tests pass, backward routes stable.

**Q (`src/__tests__/protocol-editor-helpers.test.ts`): 3 of 5 test cases already have degenerate paths at bend=24. Should this be documented?**
A: Yes — document in the research doc alongside the saveNodeGeometry full-reload finding.

## Related Research
(none — first research pass)

## Open Questions
(none)
