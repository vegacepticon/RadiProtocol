---
date: 2026-06-01T22:51:04+0300
author: Roman Shulgha
commit: a7e16d5
branch: fixes-with-pi
repository: RadiProtocol
topic: "Protocol editor edge rendering and drag performance"
tags: [intent, frd, protocol-editor, edge-rendering, drag-performance]
status: complete
last_updated: 2026-06-01T22:51:04+0300
last_updated_by: Roman Shulgha
---

# FRD: Protocol editor edge rendering and drag performance

## Summary
Fix two issues in the protocol editor view (`src/views/protocol-editor-view.ts`): (1) edge/link rendering cusps/spikes at Q-curve transition points caused by fixed `bend=24` radius and potential degenerate segments, and (2) drag stutter caused by full SVG rebuilds on every frame and unbatched synchronous layout writes.

## Problem & Intent
*Primary issue #1: edge/link rendering artifact. Connections between nodes sometimes render with sharp cusps/spikes/teeth instead of smooth curves. The artifact is visible at transition points where a horizontal segment bends into a vertical/curved segment, producing a pointed notch. Expected behavior: all node connections should render as smooth, visually stable paths without sharp cusps, spikes, self-intersections, or sudden direction artifacts.*

*Primary issue #2: drag performance / stutter. On some computers where the plugin is installed, dragging nodes feels laggy: the node movement is interrupted, choppy, or looks like FPS drops. Expected behavior: dragging nodes should feel smooth and responsive, without visible stutter during normal graph editing.*

Both issues affect end users editing protocols in the canvas view. Success means smooth curves for all node connections and responsive dragging without stutter during normal graph editing.

## Goals
- Edge connections render as smooth, visually stable paths without cusps, spikes, or pointed notches at any zoom level
- Dragging nodes feels perceptibly smooth and responsive, with no visible stutter
- All existing protocol rendering tests continue to pass
- Edge routing still avoids self-intersections in backward routes (against layout direction)

## Non-Goals
- Migrating to pointer events (`pointerdown`/`pointermove`/`pointerup`) is deferred; the stutter fix focuses on DOM churn and SVG rebuilds, not event type migration
- Converting node positioning from `style.left/top` to CSS `transform` is deferred pending validation that it does not break saved coordinates, anchor measurement, hit-testing, selection, resize behavior, or Obsidian layout integration
- No mobile or cross-platform considerations beyond Obsidian's desktop Chromium WebView (`isDesktopOnly: true`)
- No change to the SVG edge data model or storage format

## Functional Requirements
1. The edge router SHALL compute bend radius dynamically, clamped to `min(availableSegmentLength / 2, configuredMax)` instead of a fixed 24px, to prevent degenerate Q curves
2. The edge router SHALL produce smooth Q-curve transitions without zero-length or negative-length path segments in any of the 4 routing paths (forward TB, forward LR, backward TB, backward LR)
3. During node drag, edge paths SHALL be updated incrementally by modifying the `d` attribute of existing SVG `<path>` elements in-place, rather than emptying and recreating all edge DOM nodes
4. During node drag, position writes and edge updates SHALL be coordinated through requestAnimationFrame to reduce layout churn — both node position application and edge re-routing should be batched per frame
5. SVG `stroke-linejoin` and `stroke-linecap` SHALL be configured on edge paths to prevent sharp rendering artifacts at curve boundaries (e.g., `round`), independent of the path geometry fix

## Non-Functional Requirements
- **Performance**: Dragging should feel perceptibly smooth — no visible stutter during normal node dragging on the originally-reported computers
- **UX**: All edge transitions render smoothly at any zoom level, with no cusps, spikes, or sudden direction changes visible
- **Reliability**: Backward edge routes (against layout direction) still avoid self-intersections and produce stable paths
- **Compatibility**: Standard Obsidian desktop Chromium (Windows, macOS, Linux) — no legacy browser concerns

## Constraints & Assumptions
- Desktop-only plugin (`isDesktopOnly: true`), running in Obsidian's embedded Chromium WebView
- The coordinate system (`x`, `y` on `ProtocolNodeRecord`) is shared with persisted `.rp.json` files and must not change format or semantics
- The 4 routing paths (forward TB/LR, backward TB/LR) each have different geometry — fixes must apply consistently to all four
- The resize drag handler (`bindResize`) has the same full-SVG-rebuild issue and should be checked for the same rAF/incremental update pattern

## Acceptance Criteria
- [ ] Edge connections render as smooth curves with no visible cusps, spikes, or pointed notches at transition points, tested at 50%, 100%, 150%, and 200% zoom levels
- [ ] Dragging a node feels perceptibly smooth with no visible stutter or choppiness during continuous drag motion
- [ ] All existing tests in `__tests__/protocol-editor-helpers.test.ts` (edge route unit tests) pass unchanged
- [ ] Backward edge routes (against layout direction) produce stable, self-intersection-free paths that are visually smooth
- [ ] SVG edge paths use `stroke-linejoin: round` and `stroke-linecap: round` (or equivalent) to prevent sharp rendering at curve boundaries
- [ ] `renderEdges()` during drag updates existing `<path>` elements in-place instead of emptying and recreating the full SVG

## Recommended Approach
Edge fix: increase `bend` radius (from 24 to a larger default) and clamp to `min(availableSegmentLength / 2, configuredMax)` to prevent degenerate Q curves when connections are short. Add `stroke-linejoin: round` and `stroke-linecap: round` to edge path CSS as a complementary safeguard. Drag fix: introduce incremental edge path updates during drag (modify `d` attribute of existing SVG `<path>` elements instead of full rebuild via `this.svgEl.empty()`), apply the same rAF-gated pattern to position writes (not just edge re-render), and extend rAF batching to the resize drag handler. Both fixes live entirely within `src/views/protocol-editor-view.ts` — no changes to the data model, store, or other layers.

## Decisions

### Scope — fix both issues
**Question**: Should we fix both edge rendering and drag stutter, or one at a time?
**Recommended**: Fix both in one pass
**Chosen**: Fix both edge and drag
**Rationale**: Both issues affect the same view file and share infrastructure (edge rendering is a contributor to drag cost); fixing together avoids double-work on shared code.

### Edge fix approach
**Question**: What approach for the edge cusp/spike artifact?
**Recommended**: Increase bend radius + clamp to available segment length
**Chosen**: Increase bend radius + clamp to segment length, plus check stroke-linejoin/linecap
**Rationale**: Fixed bend=24 produces degenerate Q curves when path segments are shorter than bend radius. Dynamic clamping prevents pinch-points regardless of connection length. stroke-linejoin/linecap provide a CSS-level safety net.

### Drag fix approach
**Question**: What approach for drag stutter?
**Recommended**: Incremental edge path updates + rAF-batched position writes
**Chosen**: Incremental edge update during drag + rAF batching of position writes
**Rationale**: Full SVG rebuild (`this.svgEl.empty()`) is the primary bottleneck — updating existing path elements' `d` attribute in-place is much cheaper. Coupled with rAF-batched position writes to reduce layout churn. CSS transform and pointer events are deferred.

### Platform constraints
**Question**: Any platform compatibility constraints?
**Recommended**: Standard Obsidian desktop Chromium
**Chosen**: Standard Obsidian desktop Chromium only
**Rationale**: `isDesktopOnly: true` — no legacy browser or mobile concerns. Can use modern SVG/CSS features.

### Performance target
**Question**: What performance target for the drag fix?
**Recommended**: Perceptibly smooth
**Chosen**: Perceptibly smooth — no specific FPS target
**Rationale**: The fix should make dragging feel responsive on the reported computers. Measure by user perception, not synthetic metrics.

### Acceptance criteria
**Question**: What acceptance criteria should be captured?
**Recommended**: Visual rendering + drag feel + test suite + backward route stability
**Chosen**: Visual smoothness at multiple zoom levels, perceptibly smooth drag, all existing tests pass, backward routes stable
**Rationale**: Comprehensive coverage of both observable behavior and regression protection.

## Open Questions
(none — all branches resolved)

## Suggested Follow-ups
- Resize drag (`bindResize`) has the same full-SVG-rebuild pattern without rAF gating — should receive the same incremental update treatment in a follow-up
- CSS transform for node positioning (`translate` instead of `left`/`top`) could further improve drag smoothness but needs validation against anchor measurement, hit-testing, selection, and Obsidian layout integration

## References
- `src/views/protocol-editor-view.ts:307-408` — `protocolEditorEdgeRoute()` — SVG path generation with fixed `bend = 24`
- `src/views/protocol-editor-view.ts:778-864` — `renderEdges()` — full SVG rebuild on every call
- `src/views/protocol-editor-view.ts:1259-1317` — `bindDrag()` — drag handler with rAF-gated edge re-render but synchronous position writes
- `src/views/protocol-editor-view.ts:1319-1363` — `bindResize()` — resize drag with NO rAF gating
- `src/styles/protocol-editor.css:74-122` — edge path CSS (no stroke-linejoin/linecap currently set)
- `src/__tests__/protocol-editor-helpers.test.ts` — edge route unit tests
