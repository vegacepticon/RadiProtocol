---
date: 2026-06-02T10:02:12+0300
author: Roman Shulgha
commit: 081e95d
branch: fixes-with-pi
repository: RadiProtocol
topic: "Protocol editor review fixes"
tags: [design, protocol-editor, edge-rendering, minimap, async-save]
status: ready
parent: .rpiv/artifacts/reviews/2026-06-02_09-35-12_auto.md
last_updated: 2026-06-02T10:02:12+0300
last_updated_by: Roman Shulgha
---

# Design: Protocol Editor Review Fixes

## Summary
Patch the protocol editor edge/drag optimization after review by making edge bend clamping safety-first, refreshing minimap geometry after incremental node saves, and guarding async geometry-save UI mutations by captured protocol path. The design keeps the performant incremental main-canvas path while restoring the dependent minimap refresh that full `loadProtocol()` previously provided.

## Requirements
- Fix Q1: `computeEdgeBend()` must never return a forward-route bend larger than the computed safe maximum.
- Add short-delta route tests that prove forward routes do not backtrack when rank/normal deltas are below the visual minimum.
- Fix Q2: incremental drag/resize saves must refresh minimap node geometry, edge lines, and bounds.
- Fix Q3: `saveNodeGeometry()` must not mutate `this.doc` or DOM after await if the editor has switched to another protocol path.
- Address Q4 in this artifact: Desired End State snippets must be copy-paste-safe (`!== null` SVG guards and updated node geometry, not stale DOM lookups).
- Preserve the drag-performance improvement: no full `loadProtocol()` reload for single-node geometry saves.
- Keep all source changes localized to the protocol editor view and tests.

## Current State Analysis
The current branch already contains the prior edge/drag optimization: dynamic bend constants, `updateEdgePaths()`, rAF-batched drag/resize, and incremental `saveNodeGeometry()`. Review found three implementation gaps in that optimized path and one documentation/snippet hygiene issue in the previous plan.

### Key Discoveries
- `src/views/protocol-editor-view.ts:314-327` — `computeEdgeBend()` computes `maxBend` but returns `Math.max(MIN_BEND, maxBend)`, which can exceed safe constraints when `maxBend < 8`.
- `src/views/protocol-editor-view.ts:336-409` — `protocolEditorEdgeRoute()` uses `bend` in forward LR/TB paths, so an unsafe bend can create negative first segments or middle-segment backtracking.
- `src/__tests__/protocol-editor-helpers.test.ts:130-172` — existing route tests cover normal-sized forward/backward routes but not very short forward doglegs.
- `src/views/protocol-editor-view.ts:903-936` — `updateEdgePaths()` refreshes main SVG edge paths/labels incrementally.
- `src/views/protocol-editor-view.ts:939-1039` — `renderMinimap()` is the only path that rebuilds minimap bounds, edge lines, node rectangles, viewport rect, and then calls `updateMinimapViewport()`.
- `src/views/protocol-editor-view.ts:1042-1051` — `updateMinimapViewport()` only updates the viewport rectangle and cannot fix stale minimap node/edge geometry.
- `src/views/protocol-editor-view.ts:1448-1467` — `saveNodeGeometry()` awaits `protocolDocumentStore.update()`, then unconditionally assigns `this.doc`, updates node DOM, and updates edge paths.
- `src/runner/render/render-snippet-picker.ts:83-107` — stale async pattern to model: capture identity before await and bail if host state changed before dispatching results.
- `src/protocol/protocol-document-store.ts:75-82` — store `update()` returns the written document after async read/mutate/write; callers must guard UI state separately.

## Scope

### Building
- Replace the forward-route bend floor with safe maximum behavior in `computeEdgeBend()`.
- Add invariant-style short-delta tests for LR and TB forward routes to catch backtracking regressions.
- Snapshot `protocolPath`, node geometry, and viewport state before the async store update in `saveNodeGeometry()`.
- Guard post-await `this.doc`/DOM mutations with `this.protocolPath === capturedPath`.
- Refresh minimap geometry with `renderMinimap()` after guarded incremental node saves.
- Add focused regression tests for minimap refresh and stale-path guard behavior.

### Not Building
- No new incremental minimap updater; the developer selected full `renderMinimap()` refresh for correctness and lower surface area.
- No CSS changes; edge stroke-linejoin/linecap are already present in the current branch.
- No structural split of `protocol-editor-view.ts`; this is a focused review-fix patch.
- No changes to `.rp.json` schema, parser, store API, or lower protocol layers.
- No full `loadProtocol()` restoration for drag/resize save; performance optimization remains in place.

## Decisions

### Q1 safe bend clamp
**Decision**: Forward routes return the computed safe maximum bend directly instead of flooring it up to `MIN_BEND`.

**Evidence**: `src/views/protocol-editor-view.ts:314-327` computes the safe cap from `rankDelta / 2`, `Math.abs(normalDelta) / 2`, and `CONFIGURED_MAX_BEND`, then violates that cap with `Math.max(MIN_BEND, maxBend)`. The review's Q1 fix requires the returned bend never exceed the safe maximum.

**Verification**: Add route tests for short LR/TB doglegs where the old implementation emits an initial backtracking segment (`L 97 100` / `L 200 97`) and the fixed implementation keeps rank coordinates monotonic.

### Q2 minimap refresh strategy
**Ambiguity**: The review allowed either incremental minimap updates or a targeted minimap refresh after geometry saves.

**Explored**:
- **Full `renderMinimap()` refresh** (`src/views/protocol-editor-view.ts:939-1039`) — refreshes bounds, minimap edge lines, node rects, viewport rect, and reuses existing render path. Slightly more work after save, but not in the drag hot path.
- **New incremental minimap updater** (`src/views/protocol-editor-view.ts:1042-1051` is viewport-only and insufficient) — potentially more efficient, but adds new DOM lookup/update surface and extra test burden.

**Decision**: Use full `renderMinimap()` after guarded geometry saves. Developer selected "Full refresh (Recommended)" at checkpoint.

### Q3 async path guard
**Decision**: Capture `const protocolPath = this.protocolPath`, a rounded geometry snapshot, and viewport snapshot before `await`; pass the captured path to `protocolDocumentStore.update()`; after await, return without mutating `this.doc` or DOM if `this.protocolPath !== protocolPath`.

**Evidence**: `src/views/protocol-editor-view.ts:1448-1467` currently reads `this.protocolPath` at call time and mutates view state unconditionally after await. `src/views/protocol-editor-view.ts:490-508` can switch `this.protocolPath`/`this.doc` via `loadProtocol()` while the save is pending. `src/runner/render/render-snippet-picker.ts:83-107` shows the existing stale async guard pattern.

### Q4 copy-paste-safe snippets
**Decision**: The new design's Desired End State uses copy-paste-safe guards and updated node geometry. It avoids the prior plan's `!== undefined` SVG query checks and stale DOM-element-as-node examples.

**Evidence**: Review Q4 cited previous plan snippets that used `if (pathEl !== undefined)` for nullable SVG query results and passed a DOM element where updated node geometry was required.

## Architecture

### src/views/protocol-editor-view.ts:314-327;1448-1467 — MODIFY
Updates edge bend safety and guarded geometry-save/minimap refresh behavior.

```typescript
/** Maximum configured bend radius for edge Q-curves. */
const CONFIGURED_MAX_BEND = 32;
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
    // The computed safe maximum is authoritative: applying a visual minimum above
    // this value reintroduces backtracking on very short doglegs.
    return Math.max(0, Math.min(
      rankDelta / 2,
      Math.abs(normalDelta) / 2,
      CONFIGURED_MAX_BEND,
    ));
  }
  // Backward: exit/entry offset constrains first/last L: BACKWARD_OFFSET - bend >= 0
  // Middle horizontal: routeX/routeY extends beyond nodes, midSpace = |normalDelta|/2 + BACKWARD_OFFSET
  // gives bend <= midSpace/2. Conservative: limit to BACKWARD_OFFSET/2.
  return Math.max(0, Math.min(BACKWARD_OFFSET / 2, CONFIGURED_MAX_BEND));
}

private async saveNodeGeometry(node: ProtocolNodeRecord): Promise<void> {
  const protocolPath = this.protocolPath;
  if (protocolPath === null) return;

  const geometry = {
    id: node.id,
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
  };
  const viewport = this.currentViewportState();

  try {
    const updated = await this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
      if (existing === null) protocolMissingFileError();
      const nodes = existing.nodes.map((n) =>
        n.id === geometry.id
          ? { ...n, x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height }
          : n,
      );
      return { ...existing, nodes, viewport, updatedAt: new Date().toISOString() };
    });
    if (this.protocolPath !== protocolPath) return;

    this.doc = updated;
    const nodeEl = this.nodeElementById.get(geometry.id);
    const updatedNode = updated.nodes.find((n) => n.id === geometry.id);
    if (nodeEl !== undefined && updatedNode !== undefined) {
      this.applyNodePosition(nodeEl, updatedNode);
    }
    this.updateEdgePaths();
    this.renderMinimap();
  } catch (err) {
    new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
  }
}
```

### src/__tests__/protocol-editor-helpers.test.ts:130-172 — MODIFY
Adds short-delta no-backtracking edge-route regression tests.

```typescript
function routeRankCoordinates(d: string, direction: 'LR' | 'TB'): number[] {
  const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(([value]) => Number(value));
  const rankCoordinates: number[] = [];
  const rankOffset = direction === 'LR' ? 0 : 1;
  for (let index = rankOffset; index < values.length; index += 2) {
    rankCoordinates.push(values[index]!);
  }
  return rankCoordinates;
}

function expectNoForwardRankBacktracking(d: string, direction: 'LR' | 'TB'): void {
  const rankCoordinates = routeRankCoordinates(d, direction);
  for (let index = 1; index < rankCoordinates.length; index += 1) {
    expect(rankCoordinates[index]!).toBeGreaterThanOrEqual(rankCoordinates[index - 1]!);
  }
}

// Add these tests inside `describe('edge helpers', () => { ... })`
// after the existing forward horizontal/vertical route tests.
it('does not backtrack on very short forward horizontal doglegs', () => {
  const route = protocolEditorEdgeRoute(100, 100, 110, 102, 'LR');
  // Safe bend: forward LR, rankDelta=10, normalDelta=2 → min(10/2, 2/2, 32) = 1.
  expect(route.d).toContain('L 104 100');
  expect(route.d).toContain('Q 105 100 105 101');
  expectNoForwardRankBacktracking(route.d, 'LR');
});

it('does not backtrack on very short forward vertical doglegs', () => {
  const route = protocolEditorEdgeRoute(200, 100, 202, 110, 'TB');
  // Safe bend: forward TB, rankDelta=10, normalDelta=2 → min(10/2, 2/2, 32) = 1.
  expect(route.d).toContain('L 200 104');
  expect(route.d).toContain('Q 200 105 201 105');
  expectNoForwardRankBacktracking(route.d, 'TB');
});
```

### src/__tests__/views/protocol-editor-save-node-geometry.test.ts — NEW
Adds focused regression tests for `saveNodeGeometry()` minimap refresh and stale-path guard behavior.

```typescript
import { describe, expect, it, vi } from 'vitest';
import { ProtocolEditorView } from '../../views/protocol-editor-view';
import type { ProtocolDocumentV1, ProtocolNodeRecord } from '../../protocol/protocol-document';

type UpdateMutator = (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1;
type StoreUpdate = (protocolPath: string, mutator: UpdateMutator) => Promise<ProtocolDocumentV1>;

interface MockNodeElement {
  attrs: Record<string, string>;
  setAttr(name: string, value: string | number | boolean): void;
}

vi.mock('obsidian', () => ({
  ItemView: class {
    leaf = {};
    app = {};
    containerEl = { children: [] };
    constructor() {}
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
    onOpen(): void {}
    onClose(): void {}
    registerDomEvent(): void {}
  },
  Notice: class { constructor(_message?: string) {} },
  TFile: class { path: string; constructor(path = '') { this.path = path; } },
  WorkspaceLeaf: class {},
  setIcon: () => {},
}));

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class { mount(): Promise<void> { return Promise.resolve(); } unmount(): void {} },
}));

function makeNode(overrides: Partial<ProtocolNodeRecord> = {}): ProtocolNodeRecord {
  return {
    id: 'node-1',
    kind: 'question',
    x: 10,
    y: 20,
    width: 200,
    height: 80,
    text: 'Question',
    fields: { questionText: 'Question' },
    ...overrides,
  };
}

function makeDoc(node = makeNode()): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'doc-1',
    title: 'Protocol',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: [node],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function makeNodeElement(): MockNodeElement {
  return {
    attrs: {},
    setAttr(name: string, value: string | number | boolean): void {
      this.attrs[name] = String(value);
    },
  };
}

function createView(update: StoreUpdate, doc = makeDoc()) {
  const plugin = {
    i18n: { t: (key: string, params?: Record<string, string>) => params?.error ?? key },
    protocolDocumentStore: { update },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
  } as any;
  const view = new ProtocolEditorView({} as any, plugin);
  const nodeEl = makeNodeElement();
  (view as any).protocolPath = 'Protocols/current.rp.json';
  (view as any).doc = doc;
  (view as any).zoom = 1;
  (view as any).viewportEl = { scrollLeft: 15010, scrollTop: 12020 };
  (view as any).nodeElementById.set(doc.nodes[0]!.id, nodeEl as unknown as HTMLElement);
  const updateEdgePaths = vi.spyOn(view as any, 'updateEdgePaths').mockImplementation(() => {});
  const renderMinimap = vi.spyOn(view as any, 'renderMinimap').mockImplementation(() => {});
  return { view, nodeEl, updateEdgePaths, renderMinimap };
}

describe('ProtocolEditorView — saveNodeGeometry', () => {
  it('updates node DOM, edges, and minimap after a successful geometry save', async () => {
    const node = makeNode({ x: 12.6, y: 34.2, width: 210.7, height: 88.4 });
    let savedDoc: ProtocolDocumentV1 | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      const nextDoc = mutator(makeDoc(makeNode()));
      savedDoc = nextDoc;
      return nextDoc;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect(savedDoc?.nodes[0]).toMatchObject({ x: 13, y: 34, width: 211, height: 88 });
    expect(savedDoc?.viewport).toEqual({ x: 10, y: 20, zoom: 1 });
    expect((view as any).doc).toBe(savedDoc);
    expect(nodeEl.attrs['style']).toContain('left:15013px;top:12034px;width:211px;min-height:88px;');
    expect(updateEdgePaths).toHaveBeenCalledTimes(1);
    expect(renderMinimap).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the active view when the protocol path changes while saving', async () => {
    const node = makeNode({ x: 42, y: 43 });
    const otherDoc = makeDoc(makeNode({ id: 'other-node' }));
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      const updated = mutator(makeDoc(makeNode()));
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).protocolPath = 'Protocols/other.rp.json';
      (viewRef as any).doc = otherDoc;
      return updated;
    });
    const { view, nodeEl, updateEdgePaths, renderMinimap } = createView(update, makeDoc(node));
    viewRef = view;

    await (view as any).saveNodeGeometry(node);

    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
    expect((view as any).protocolPath).toBe('Protocols/other.rp.json');
    expect((view as any).doc).toBe(otherDoc);
    expect(nodeEl.attrs['style']).toBeUndefined();
    expect(updateEdgePaths).not.toHaveBeenCalled();
    expect(renderMinimap).not.toHaveBeenCalled();
  });
});
```

## Slices

### Slice 1: Safe edge-bend clamp

**Files**: `src/views/protocol-editor-view.ts`, `src/__tests__/protocol-editor-helpers.test.ts`

#### Automated Verification:
- [ ] Route helper tests pass: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`
- [ ] Unsafe bend floor is absent: `grep -n "Math.max(MIN_BEND, maxBend)" src/views/protocol-editor-view.ts` returns no matches

#### Manual Verification:
- [ ] Very short forward LR and TB routes render without backwards folds/cusps.

### Slice 2: Guarded geometry save refresh

**Files**: `src/views/protocol-editor-view.ts`, `src/__tests__/views/protocol-editor-save-node-geometry.test.ts`

#### Automated Verification:
- [ ] Geometry-save regression tests pass: `npm test -- src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [ ] Route helper tests still pass: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`
- [ ] Full test suite passes: `npm test`
- [ ] Type/build validation passes: `npm run build`
- [ ] Guard exists: `grep -n "this.protocolPath !== protocolPath" src/views/protocol-editor-view.ts` returns the `saveNodeGeometry()` guard
- [ ] Minimap refresh exists in geometry-save path: `grep -n "this.renderMinimap()" src/views/protocol-editor-view.ts` includes `saveNodeGeometry()`

#### Manual Verification:
- [ ] After drag/resize release, the minimap node rectangle and edge line reflect the saved geometry.
- [ ] Loading another protocol while a geometry save is pending does not replace the active view with the stale saved document.
- [ ] Drag remains smooth because `renderMinimap()` runs only after save completion, not during rAF mousemove updates.

## Desired End State

```typescript
// Very short forward LR dogleg: bend is safe max (1), not MIN_BEND (8).
const route = protocolEditorEdgeRoute(100, 100, 110, 102, 'LR');
// Path rank coordinates never move left/backward: M 100 → L 104 → Q 105 → ... → L 110.
```

```typescript
// Single-node geometry save remains incremental but is guarded and minimap-aware.
const protocolPath = this.protocolPath;
if (protocolPath === null) return;
const geometry = {
  id: node.id,
  x: Math.round(node.x),
  y: Math.round(node.y),
  width: Math.round(node.width),
  height: Math.round(node.height),
};
const viewport = this.currentViewportState();

const updated = await this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
  if (existing === null) protocolMissingFileError();
  const nodes = existing.nodes.map((n) => n.id === geometry.id ? { ...n, ...geometry } : n);
  return { ...existing, nodes, viewport, updatedAt: new Date().toISOString() };
});

if (this.protocolPath !== protocolPath) return;
this.doc = updated;
const nodeEl = this.nodeElementById.get(geometry.id);
const updatedNode = updated.nodes.find((n) => n.id === geometry.id);
if (nodeEl !== undefined && updatedNode !== undefined) this.applyNodePosition(nodeEl, updatedNode);
this.updateEdgePaths();
this.renderMinimap();
```

```typescript
// Copy-paste-safe SVG guard pattern for nullable query results.
const pathEl = group.querySelector('.rp-protocol-editor-edge') as SVGPathElement | null;
if (pathEl !== null) pathEl.setAttr('d', route.d);
```

## File Map

```text
src/views/protocol-editor-view.ts  # MODIFY — safe bend clamp; guarded geometry save; minimap refresh
src/__tests__/protocol-editor-helpers.test.ts  # MODIFY — route no-backtracking regression tests
src/__tests__/views/protocol-editor-save-node-geometry.test.ts  # NEW — saveNodeGeometry regression tests
```

## Ordering Constraints
- Slice 1 comes first because it fixes the pure routing invariant and route tests.
- Slice 2 comes second because it rewrites the same source file with the final merged code and adds save-path tests.
- Slices are sequential; no parallel implementation because both touch `src/views/protocol-editor-view.ts`.

## Verification Notes
- Run targeted route tests: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`.
- Run targeted geometry-save tests: `npm test -- src/__tests__/views/protocol-editor-save-node-geometry.test.ts`.
- Run full tests after terminal slice: `npm test`.
- Run type/build validation after terminal slice: `npm run build`.
- Grep guard implementation: `grep -n "this.protocolPath !== protocolPath" src/views/protocol-editor-view.ts` should find the geometry-save stale guard.
- Grep minimap refresh implementation: `grep -n "this.renderMinimap()" src/views/protocol-editor-view.ts` should include the guarded geometry-save path.
- Manual visual check: after drag/resize release, main canvas node, main edges, and minimap node rectangle/edge line all reflect the saved geometry.
- Manual stale-path check: if another protocol is loaded while a geometry save is pending, the active view must remain on the newly loaded protocol and not flash back to the saved old document.

## Performance Considerations
- Returning a smaller bend for short routes is pure arithmetic and adds no runtime cost.
- `renderMinimap()` runs after the async save completes, not during mousemove/rAF drag frames, so it does not reintroduce drag stutter.
- The main-canvas hot path remains incremental: `applyNodePosition()` + `updateEdgePaths()` during rAF, no SVG teardown during drag.
- A full minimap refresh is intentionally chosen over a new incremental minimap updater to reduce bug surface; minimap SVG is small compared with the main editor canvas.

## Migration Notes
No data migration required. The `.rp.json` schema and persisted node/edge records are unchanged.

## Pattern References
- `src/__tests__/protocol-editor-helpers.test.ts:130-172` — existing route helper test style to extend.
- `src/views/protocol-editor-view.ts:903-936` — incremental main edge update pattern to preserve.
- `src/views/protocol-editor-view.ts:939-1039` — full minimap rebuild path to reuse after geometry saves.
- `src/views/protocol-editor-view.ts:1042-1051` — viewport-only minimap update; evidence that viewport update alone is insufficient.
- `src/runner/render/render-snippet-picker.ts:83-107` — stale async identity guard pattern.
- `src/protocol/protocol-document-store.ts:75-82` — async update returns written document, requiring caller-side view-state guard.

## Developer Context

### Inherited research/discover decisions
- **Q (discover: Scope — fix both issues): Should we fix both edge rendering and drag stutter, or one at a time?** A: Fix both edge and drag in one pass.
- **Q (discover: Edge fix approach): What approach for the edge cusp/spike artifact?** A: Increase bend radius + clamp to segment length, plus check stroke-linejoin/linecap.
- **Q (discover: Drag fix approach): What approach for drag stutter?** A: Incremental edge update during drag + rAF batching of position writes.
- **Q (discover: Platform constraints): Any platform compatibility constraints?** A: Standard Obsidian desktop Chromium only.
- **Q (discover: Performance target): What performance target for the drag fix?** A: Perceptibly smooth — no specific FPS target.
- **Q (discover: Acceptance criteria): What acceptance criteria should be captured?** A: Visual smoothness at multiple zoom levels, perceptibly smooth drag, all existing tests pass, backward routes stable.

### Design checkpoint
- **❓ Question: Q2 can be fixed by refreshing the minimap after guarded geometry saves. `renderMinimap()` rebuilds bounds/node rects/edge lines (`src/views/protocol-editor-view.ts:939-1039`), while `updateMinimapViewport()` only moves the viewport rect (`src/views/protocol-editor-view.ts:1042-1051`). Which should this design use?** A: Full refresh (Recommended).
- **Question: Ready to proceed to decomposition for the protocol editor review-fix design summarized above?** A: Proceed (Recommended).
- **Question: 2 slices for protocol editor review fixes. Slice 1: Safe edge-bend clamp (foundation). Slice 2: Guarded geometry save refresh. Approve decomposition?** A: Approve (Recommended).

### Micro-checkpoints
- **Slice 1 approval question**: Slice 1/2: Safe edge-bend clamp — `src/views/protocol-editor-view.ts`, `src/__tests__/protocol-editor-helpers.test.ts`. Fixes Q1 and adds no-backtracking tests. Approve? **A: Approve (Recommended)**. Slice-verifier: Decisions OK / Cross-slice OK / Research OK.
- **Slice 2 approval question**: Slice 2/2: Guarded geometry save refresh — `src/views/protocol-editor-view.ts`, new save-node-geometry regression test file. Fixes Q2/Q3 and preserves Slice 1. Approve? **A: Approve (Recommended)**. Slice-verifier: Decisions OK / Cross-slice OK / Research OK.

## Design History
- Slice 1: Safe edge-bend clamp — approved as generated
- Slice 2: Guarded geometry save refresh — approved as generated

## References
- `.rpiv/artifacts/reviews/2026-06-02_09-35-12_auto.md` — review findings Q1-Q4.
- `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md` — prior plan under review.
- `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md` — upstream edge/drag research.
- `src/views/protocol-editor-view.ts` — protocol editor implementation.
- `src/__tests__/protocol-editor-helpers.test.ts` — route helper tests.
