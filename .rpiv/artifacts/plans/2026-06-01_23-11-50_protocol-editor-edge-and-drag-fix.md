---
date: 2026-06-01T23:11:50+0300
author: Roman Shulgha
commit: a7e16d5
branch: fixes-with-pi
repository: RadiProtocol
topic: "Protocol editor edge rendering and drag performance fix"
tags: [plan, protocol-editor, edge-rendering, drag-performance, svg]
status: ready
parent: .rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md
phase_count: 3
unresolved_phase_count: 0
last_updated: 2026-06-01T23:11:50+0300
last_updated_by: Roman Shulgha
---

# Protocol Editor Edge Rendering and Drag Performance Fix — Implementation Plan

## Overview
Fix two issues in the protocol editor view: (1) edge/link rendering cusps/spikes at Q-curve transition points by replacing fixed `bend=24` with dynamic bend clamping in `protocolEditorEdgeRoute()`, and (2) drag stutter by introducing incremental SVG edge path updates (modeled after the existing `updateConnectionPreview` pattern) coupled with rAF-batched position writes and a `saveNodeGeometry()` optimization that avoids full-DOM-reload on drag end.

## Requirements
- Edge connections render as smooth, visually stable paths without cusps, spikes, or pointed notches at any zoom level
- Dragging nodes feels perceptibly smooth and responsive, with no visible stutter
- All existing protocol rendering tests continue to pass (with updated `d` string expectations for dynamic bend)
- Edge routing still avoids self-intersections in backward routes (against layout direction)
- SVG `stroke-linejoin` and `stroke-linecap` set to `round` on edge paths as a complementary CSS safeguard
- During node drag, edge paths are updated incrementally by modifying the `d` attribute of existing SVG `<path>` elements in-place
- Position writes and edge updates are coordinated through requestAnimationFrame to reduce layout churn
- Single-node drag end avoids full `loadProtocol()` DOM rebuild

## Current State Analysis
The protocol editor (`src/views/protocol-editor-view.ts`) has a fixed `const bend = 24` in `protocolEditorEdgeRoute()` (line 314) that produces degenerate Q-curve path segments when node separation in either axis is < 48px. `renderEdges()` (line 778) performs a full SVG teardown/rebuild (`this.svgEl.empty()`) on every call — the primary drag bottleneck. `bindDrag()` (line 1259) has rAF-gated edge re-render but synchronous position writes outside the rAF. `bindResize()` (line 1319) has NO rAF gating at all. `saveNodeGeometry()` (line 1367) calls `loadProtocol()` on every drag end, rebuilding the entire DOM for a single coordinate change.

### Key Discoveries
- `protocol-editor-view.ts:314` — `const bend = 24` root cause of edge degeneration
- `protocol-editor-view.ts:778-864` — `renderEdges()` full SVG rebuild via `this.svgEl.empty()`
- `protocol-editor-view.ts:1028` — `applyNodePosition()` synchronous style write on every mousemove
- `protocol-editor-view.ts:1259-1317` — `bindDrag()` rAF-gated edge render, synchronous position writes
- `protocol-editor-view.ts:1319-1363` — `bindResize()` NO rAF gating
- `protocol-editor-view.ts:1367-1380` — `saveNodeGeometry()` full `loadProtocol()` on every drag end
- `protocol-editor-view.ts:1093-1097` — `updateConnectionPreview()` uses the exact in-place `setAttr('d',...)` pattern to model after
- `protocol-editor-view.ts:1283-1287` — Existing rAF batching pattern to extend
- `src/styles/protocol-editor.css:102-106` — `.rp-protocol-editor-edge` missing stroke-linejoin/linecap
- `src/__tests__/protocol-editor-helpers.test.ts:130-168` — 6 edge route tests, 3-4 need updated `d` strings

## Desired End State
```typescript
// Edge route produces smooth curves even for short connections
const route = protocolEditorEdgeRoute(100, 100, 120, 420, 'TB');
// bend is dynamically clamped: min(rankDelta/2, 32) = min(320/2, 32) = 32 — smooth Q-curve, no fold

// During drag: edges update incrementally, no DOM teardown
private updateEdgePaths(): void {
  for (const edge of this.doc.edges) {
    const group = this.svgEl.querySelector(`[data-edge-id="${edge.id}"]`);
    const pathEl = group?.querySelector('.rp-protocol-editor-edge');
    if (pathEl !== undefined) pathEl.setAttr('d', newRoute.d);
  }
}

// bindDrag batches position writes into rAF, using updateEdgePaths
const onMove = (ev: MouseEvent) => {
  node.x = origX + dx;
  node.y = origY + dy;
  if (rafId === null) {
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      this.applyNodePosition(nodeEl, node);
      this.updateEdgePaths();
    });
  }
};

// saveNodeGeometry updates store + DOM incrementally, no full reload
private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
  await this.plugin.protocolDocumentStore.update(...);
  // Update just this node's DOM position
  this.applyNodePosition(nodeEl, this.nodeElementById.get(node.id)!);
  this.updateEdgePaths();
  // No this.loadProtocol(this.protocolPath) call
}
```

## What We're NOT Doing
- CSS transform for node positioning (`translate` instead of `left`/`top`) — deferred, needs validation against anchor measurement, hit-testing, selection, and Obsidian layout integration
- Pointer events migration (`pointerdown`/`pointermove`/`pointerup`) — deferred; the fix focuses on DOM churn, not event type migration
- No change to the SVG edge data model or storage format
- No changes to `renderMinimap()` — not part of the drag bottleneck
- No changes to `protocol-document.ts` or other lower layers

## Decisions

### Dynamic bend clamping approach
**Decision**: Replace fixed `bend=24` with `Math.min(availableSegmentLength / 2, configuredMax)` in all 4 routing branches of `protocolEditorEdgeRoute()`.
**Evidence**: `protocol-editor-view.ts:314` — `const bend = 24`. Research confirmed 3 of 5 Q-curve tests produce degenerate paths at bend=24. Dynamic clamping prevents pinch-points regardless of connection length.
**configuredMax**: 32 (research recommends 32 as balance between smoothness and visual tightness).

### CSS stroke-linejoin/linecap
**Decision**: Add `stroke-linejoin: round; stroke-linecap: round;` to `.rp-protocol-editor-edge` in `protocol-editor.css`.
**Evidence**: `protocol-editor.css:102-106` — no stroke-linejoin or stroke-linecap set. Backward routing paths make explicit 90° turns where `miter`/`butt` produce visible spikes. Zero matches across `src/` for either property (research).

### Incremental edge update method
**Decision**: New `updateEdgePaths()` method on `ProtocolEditorView` that iterates existing SVG edge elements and updates their `d` attribute in-place.
**Evidence**: `protocol-editor-view.ts:1093-1097` — `updateConnectionPreview()` already uses this exact pattern (`previewPath.setAttr('d', ...)`). Keeps `renderEdges()` as-is for full rebuilds (initial render, add/delete edge).

### rAF batching for position writes
**Decision**: Move `applyNodePosition()` into the existing rAF callback in `bindDrag()`. Add rAF gating to `bindResize()` matching the same pattern.
**Evidence**: `protocol-editor-view.ts:1283-1287` — existing rAF pattern to extend. `protocol-editor-view.ts:1319-1363` — `bindResize()` currently has no rAF gating.

### saveNodeGeometry optimization
**Decision**: After updating one node's coordinates in the store, skip `loadProtocol()` and instead update the node's DOM position + call `updateEdgePaths()`.
**Evidence**: `protocol-editor-view.ts:1367-1380` — `saveNodeGeometry()` calls `loadProtocol()` which rebuilds 300-750 DOM nodes for a single coordinate change. FRD confirmed: include in plan.

## Phase 1: Edge path geometry + CSS + test updates

### Overview
Replace fixed `bend=24` with dynamic bend clamping in all 4 routing branches, add CSS stroke-linejoin/linecap, and update test expectations. Foundation slice — no dependency on other phases.

### Changes Required:

#### 1. `src/views/protocol-editor-view.ts` (near `protocolEditorEdgeRoute`)
**File**: `src/views/protocol-editor-view.ts`
**Changes**: MODIFY — Replace fixed `const bend = 24` with dynamic bend computed per routing branch, clamped to `Math.min(availableSegmentLength / 2, 32)`.

```typescript
/** Maximum configured bend radius for edge Q-curves. */
const CONFIGURED_MAX_BEND = 32;
/** Minimum bend radius to ensure visible curve even on very short segments. */
const MIN_BEND = 8;
/** Backward route exit/entry offset in pixels. */
const BACKWARD_OFFSET = 40;

function computeEdgeBend(
  rankDelta: number,
  normalDelta: number,
  forward: boolean,
): number {
  if (forward) {
    // Forward: first L segment is rankDelta/2 - bend (must be >= 0)
    // Middle L segment is |normalDelta| - 2*bend (must be >= 0)
    const maxBend = Math.min(
      rankDelta / 2,
      Math.abs(normalDelta) / 2,
      CONFIGURED_MAX_BEND,
    );
    return Math.max(MIN_BEND, maxBend);
  }
  // Backward: exit/entry offset constrains first/last L: BACKWARD_OFFSET - bend >= 0
  // Middle horizontal: routeX/routeY extends beyond nodes, midSpace = |normalDelta|/2 + BACKWARD_OFFSET
  // gives bend <= midSpace/2. Conservative: limit to BACKWARD_OFFSET/2.
  const maxBend = Math.min(BACKWARD_OFFSET / 2, CONFIGURED_MAX_BEND);
  return Math.max(MIN_BEND, maxBend);
}
```

Modified `protocolEditorEdgeRoute()`: `const bend = 24;` replaced with:
```typescript
  const rankDelta = direction === 'TB' ? y2 - y1 : x2 - x1;
  const normalDelta = direction === 'TB' ? x2 - x1 : y2 - y1;
  const forward = rankDelta >= 0;
  const bend = computeEdgeBend(rankDelta, normalDelta, forward);
```
All 4 routing branches (`forward TB`, `forward LR`, `backward TB`, `backward LR`) are structurally unchanged — only the bend value is now dynamic.

#### 2. `src/styles/protocol-editor.css` (`.rp-protocol-editor-edge` rule)
**File**: `src/styles/protocol-editor.css`
**Changes**: MODIFY — Add `stroke-linejoin: round; stroke-linecap: round;` to the `.rp-protocol-editor-edge` rule.

```css
.rp-protocol-editor-edge {
  fill: none;
  stroke: var(--interactive-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
```

#### 3. `src/__tests__/protocol-editor-helpers.test.ts` (edge route tests)
**File**: `src/__tests__/protocol-editor-helpers.test.ts`
**Changes**: MODIFY — Update expected `d` strings for the 4 non-straight route tests whose paths change with dynamic bend clamping.

```typescript
    it('routes backward horizontal edges around nodes instead of through them', () => {
      const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
      // Dynamic bend: backward routes clamp to min(40/2, 32) = 20
      expect(route.d).toContain('L 540 148');
      expect(route.d).toContain('L 140 168');
      expect(route.labelY).toBeGreaterThan(120);
    });

    it('keeps forward horizontal edges as stepped orthogonal segments', () => {
      const route = protocolEditorEdgeRoute(100, 100, 500, 120, 'LR');
      // Dynamic bend: forward LR, rankDelta=400, normalDelta=20 → min(400/2, 20/2, 32) = 10
      expect(route.d).toContain('Q 300 100 300 110');
      expect(route.d).toContain('L 500 120');
      expect(route.labelX).toBe(300);
    });

    it('routes forward vertical edges from bottom to top anchors with orthogonal bends', () => {
      const route = protocolEditorEdgeRoute(200, 100, 240, 420, 'TB');
      // Dynamic bend: forward TB, rankDelta=320, normalDelta=40 → min(320/2, 40/2, 32) = 20
      expect(route.d).toContain('Q 200 260 220 260');
      expect(route.d).toContain('L 240 420');
      expect(route.labelY).toBe(250);
    });

    it('routes backward vertical edges around the right side', () => {
      const route = protocolEditorEdgeRoute(200, 320, 160, 120, 'TB');
      // Dynamic bend: backward routes clamp to min(40/2, 32) = 20
      expect(route.d).toContain('L 260 60');
      expect(route.labelX).toBeGreaterThan(260);
    });
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run check`
- [x] Tests pass: `npm test`
- [x] No existing test removed, only `d` string assertions updated

#### Manual Verification:
- [ ] Visual inspection: edge connections render as smooth curves at 50%, 100%, 150%, 200% zoom
- [ ] Backward edge routes produce stable, self-intersection-free paths

## Phase 2: Incremental edge update + rAF batching

### Overview
Add `updateEdgePaths()` method for in-place `d`-attribute updates, rework `bindDrag()` to batch position writes into the rAF and use `updateEdgePaths()`, add rAF gating to `bindResize()`. Depends on Phase 1 (uses improved edge route).

### Changes Required:

#### 1. `src/views/protocol-editor-view.ts`
**File**: `src/views/protocol-editor-view.ts`
**Changes**: MODIFY — Add `updateEdgePaths()` method (new, after `renderEdges()`). Rework `bindDrag()` onMove: move `applyNodePosition()` into rAF callback, call `updateEdgePaths()` instead of `renderEdges()`. Rework `bindResize()`: add rAF gating, call `updateEdgePaths()` during resize, keep `renderEdges()` on final up.

```typescript
  /**
   * Incrementally update edge path geometry in-place during drag/resize.
   * Unlike renderEdges(), this does NOT destroy or recreate SVG elements —
   * it only updates the `d` attribute on existing hitbox and visible path elements,
   * plus label position. Modeled after updateConnectionPreview() in-place pattern.
   * Uses world-coordinate anchors from this.doc to avoid forced layout reads.
   */
  private updateEdgePaths(): void {
    if (this.doc === null || this.svgEl === null) return;
    const nodeById = new Map(this.doc.nodes.map(node => [node.id, node]));
    const outputSide = protocolEditorOutputPortSide(this.layoutDirection);
    const inputSide = protocolEditorInputPortSide(this.layoutDirection);
    for (const edge of this.doc.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (from === undefined || to === undefined) continue;
      // Use world-coordinate anchors (no forced layout reads)
      const source = protocolEditorAnchorToSurfacePoint(protocolEditorPortAnchor(from, outputSide));
      const target = protocolEditorAnchorToSurfacePoint(protocolEditorPortAnchor(to, inputSide));
      const route = protocolEditorEdgeRoute(source.x, source.y, target.x, target.y, this.layoutDirection);
      const group = this.svgEl.querySelector(`[data-edge-id="${CSS.escape(edge.id)}"]`) as SVGGElement | null;
      if (group === null) continue;
      const hitboxEl = group.querySelector('.rp-protocol-editor-edge-hitbox') as SVGPathElement | null;
      if (hitboxEl !== null) hitboxEl.setAttr('d', route.d);
      const pathEl = group.querySelector('.rp-protocol-editor-edge') as SVGPathElement | null;
      if (pathEl !== null) pathEl.setAttr('d', route.d);
      const labelGroup = group.querySelector('.rp-protocol-editor-edge-label-group') as SVGGElement | null;
      if (labelGroup !== null) {
        const rectEl = labelGroup.querySelector('rect');
        const textEl = labelGroup.querySelector('text');
        if (rectEl !== null && textEl !== null) {
          const labelText = textEl.textContent ?? '';
          const approxWidth = Math.min(220, Math.max(48, labelText.length * 7 + 18));
          rectEl.setAttr('x', String(route.labelX - approxWidth / 2));
          rectEl.setAttr('y', String(route.labelY - 15));
          rectEl.setAttr('width', String(approxWidth));
          textEl.setAttr('x', String(route.labelX));
          textEl.setAttr('y', String(route.labelY));
        }
      }
    }
  }
```

`bindDrag()` onMove changed from:
```typescript
      const onMove = (ev: MouseEvent) => {
        // ...
        node.x = origX + dx;
        node.y = origY + dy;
        this.applyNodePosition(nodeEl, node); // ← synchronous, moves into rAF
        if (dragRafId === null) {
          dragRafId = window.requestAnimationFrame(() => {
            dragRafId = null;
            this.renderEdges(); // ← full rebuild, changes to updateEdgePaths
          });
        }
      };
```
To:
```typescript
      const onMove = (ev: MouseEvent) => {
        // ...
        node.x = origX + dx;
        node.y = origY + dy;
        // Batch position writes and edge updates into a single rAF frame
        if (dragRafId === null) {
          dragRafId = window.requestAnimationFrame(() => {
            dragRafId = null;
            this.applyNodePosition(nodeEl, node);
            this.updateEdgePaths();
          });
        }
      };
```

`bindResize()` onMove changed from:
```typescript
      const onMove = (ev: MouseEvent) => {
        // ...
        node.width = Math.max(MIN_NODE_WIDTH, origWidth + dx);
        node.height = Math.max(MIN_NODE_HEIGHT, origHeight + dy);
        this.applyNodePosition(nodeEl, node);
        this.renderEdges(); // ← no rAF gating
      };
```
To:
```typescript
      let resizeRafId: number | null = null;
      const onMove = (ev: MouseEvent) => {
        // ...
        node.width = Math.max(MIN_NODE_WIDTH, origWidth + dx);
        node.height = Math.max(MIN_NODE_HEIGHT, origHeight + dy);
        if (resizeRafId === null) {
          resizeRafId = window.requestAnimationFrame(() => {
            resizeRafId = null;
            this.applyNodePosition(nodeEl, node);
            this.updateEdgePaths();
          });
        }
      };
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run check`
- [x] Tests pass: `npm test`

#### Manual Verification:
- [ ] Dragging a node feels perceptibly smooth with no visible stutter during continuous drag motion
- [ ] `renderEdges()` is NOT called during drag — only `updateEdgePaths()` updates edge paths
- [ ] Resizing a node updates edges smoothly (bindResize rAF gating works)
- [ ] Initial renderEdges() still produces correct edges (full rebuild on first render still works)

## Phase 3: saveNodeGeometry optimization

### Overview
Replace the full `loadProtocol()` call after single-node coordinate update with incremental DOM position update + `updateEdgePaths()`. Depends on Phase 2 (uses `updateEdgePaths()`).

### Changes Required:

#### 1. `src/views/protocol-editor-view.ts` (`saveNodeGeometry`)
**File**: `src/views/protocol-editor-view.ts`
**Changes**: MODIFY — In `saveNodeGeometry()`, after the `protocolDocumentStore.update()` succeeds, skip `loadProtocol()` and instead update incrementally: capture the returned document, assign to `this.doc`, call `applyNodePosition()` on the node's DOM element, call `updateEdgePaths()`.

Before:
```typescript
  private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
    if (this.protocolPath === null) return;
    try {
      await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) protocolMissingFileError();
        const nodes = existing.nodes.map((n) =>
          n.id === node.id ? { ...n, x: Math.round(node.x), y: Math.round(node.y), width: Math.round(node.width), height: Math.round(node.height) } : n,
        );
        return { ...existing, nodes, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
      });
      await this.loadProtocol(this.protocolPath);
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }
```

After:
```typescript
  private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
    if (this.protocolPath === null) return;
    try {
      const updated = await this.plugin.protocolDocumentStore.update(this.protocolPath, (existing) => {
        if (existing === null) protocolMissingFileError();
        const nodes = existing.nodes.map((n) =>
          n.id === node.id ? { ...n, x: Math.round(node.x), y: Math.round(node.y), width: Math.round(node.width), height: Math.round(node.height) } : n,
        );
        return { ...existing, nodes, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
      });
      // Incremental update: avoid full loadProtocol() for a single coordinate change.
      // Update in-memory doc, node DOM position, and edge paths in-place.
      this.doc = updated;
      const nodeEl = this.nodeElementById.get(node.id);
      if (nodeEl !== undefined) {
        const updatedNode = updated.nodes.find((n) => n.id === node.id) ?? node;
        this.applyNodePosition(nodeEl, updatedNode);
      }
      this.updateEdgePaths();
    } catch (err) {
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `npm run check`
- [x] Tests pass: `npm test`

#### Manual Verification:
- [ ] After dragging a node and releasing, the node stays at the dropped position without "snapping back"
- [ ] After dragging a node and releasing, edge connections remain correct (not stale)
- [ ] After dragging a node and releasing, the protocol file on disk has the updated coordinates
- [ ] After dragging a node and releasing, no full-DOM-rebuild visible (no flash/reflow)
- [ ] Adding/removing nodes still works (still uses full `loadProtocol()` for structural changes)

## Ordering Constraints
- Phase 1 must complete first (foundation — dynamic bend is used by all edge routing)
- Phase 2 builds on Phase 1 (uses `protocolEditorEdgeRoute` for edge path computation)
- Phase 3 builds on Phase 2 (uses `updateEdgePaths`)
- All phases are sequential

## Verification Notes
- `npm run check` for type checking — must pass at every phase
- `npm test` for unit tests — Phase 1 updates test expectations, Phases 2-3 must not break them
- Visual inspection at multiple zoom levels (50%, 100%, 150%, 200%) is essential for edge smoothness
- Drag smoothness is perceptual — test by dragging nodes with ~20-30 edge connections on screen
- Backward routes (against layout direction) are the most fragile — test with nodes of varying separation distances
- After Phase 3: verify that `loadProtocol()` is NOT called after single-node drag end (check console or breakpoint)

## Performance Considerations
- Dynamic bend clamping adds negligible computational cost (a few arithmetic ops per edge route)
- `updateEdgePaths()` replaces O(6N) DOM create+insert operations with O(N) `setAttribute` calls — eliminates all insertion/removal garbage collection pressure during drag
- rAF batching reduces style recalc + layout from N-per-frame to 1-per-frame
- saveNodeGeometry optimization eliminates ~300-750 DOM node creations and ~100-250 event listener bindings per drag end
- The existing `protocolEditorMeasuredNodeAnchor()` (line 126) forced layout reads persist — not addressed in this plan (would need a separate approach)

## Migration Notes
No data migration needed — all changes are in-memory rendering logic. The `.rp.json` file format and `ProtocolNodeRecord` schema are unchanged.

## Pattern References
- `src/views/protocol-editor-view.ts:1093-1097` — `updateConnectionPreview()`: in-place SVG `d` attribute update pattern to replicate
- `src/views/protocol-editor-view.ts:1283-1287` — existing rAF batching pattern to extend
- `src/views/protocol-editor-view.ts:972-975` — `updateMinimapViewport()`: in-place SVG attribute update pattern
- `src/__tests__/protocol-editor-helpers.test.ts:130-168` — existing edge route test pattern to follow for test updates

## Developer Context

### Step 4 Checkpoint
- **Directional confirm**: Follow all 4 approaches — dynamic bend clamping, CSS stroke-linejoin/linecap, incremental edge update (new `updateEdgePaths()` method), rAF batching for bindDrag + bindResize
- **Scope confirm**: Include saveNodeGeometry optimization in plan
- **Structure confirm**: New `updateEdgePaths()` method (not refactoring `renderEdges()`)

### Micro-checkpoints
_(filled progressively as slices are approved)_

## Plan History
- Phase 1: Edge path geometry + CSS + tests — approved as generated
- Phase 2: Incremental edge update + rAF batching — approved as generated
- Phase 3: saveNodeGeometry optimization — approved as generated

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| ------ | -------- | ------------ | -------- | --------- | ------- | -------------- | ---------- |
| code | Phase 2 §1 (updateEdgePaths) | `src/views/protocol-editor-view.ts:938-939` | concern | code-quality | `updateEdgePaths()` computes `approxWidth` from `textEl.textContent` but never calls `setAttr('width', …)` on the label rect. Width stays at original value from `renderEdges()`. | Add `rectEl.setAttr('width', String(approxWidth))` in the label positioning block of `updateEdgePaths()`. | applied: added `rectEl.setAttr('width', String(approxWidth))` to label update block |
| code | Phase 1 §1 (protocol-editor-view.ts) | <n/a> | suggestion | actionability | Line reference `:307-408` is stale — lines shifted by additions. | Update or remove line-range suffix. | applied: removed stale line ranges from Phase 1 headings |
| code | Phase 1 §2 (protocol-editor.css) | <n/a> | suggestion | actionability | Line reference `:102-106` for CSS rule is stale. | Update or remove line-range suffix. | applied: removed stale line ranges from Phase 1 headings |

_No findings from coverage reviewer — all 16 verification intents covered._

## References
- `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md` — Research artifact
- `.rpiv/artifacts/discover/2026-06-01_22-51-04_protocol-editor-edge-and-drag-fix.md` — FRD
- `src/views/protocol-editor-view.ts` — All changes in this file
- `src/styles/protocol-editor.css` — CSS changes
- `src/__tests__/protocol-editor-helpers.test.ts` — Test updates
