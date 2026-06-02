---
date: 2026-06-02T10:40:04+0300
author: Roman Shulgha
commit: 081e95d
branch: fixes-with-pi
repository: RadiProtocol
topic: "Protocol editor review fixes"
tags: [plan, protocol-editor, edge-rendering, minimap, async-save]
status: ready
parent: ".rpiv/artifacts/designs/2026-06-02_10-02-12_protocol-editor-review-fixes.md"
last_updated: 2026-06-02T10:53:00+0300
last_updated_by: Roman Shulgha
last_updated_note: "Step 5 triage complete — 1 concern applied (prose fix for backward branch)"
---

# Protocol Editor Review Fixes — Implementation Plan

## Overview

Patch the protocol editor edge/drag optimization after review by making edge bend clamping safety-first, refreshing minimap geometry after incremental node saves, and guarding async geometry-save UI mutations by captured protocol path. The design keeps the performant incremental main-canvas path while restoring the dependent minimap refresh that full `loadProtocol()` previously provided.

Reference design: `.rpiv/artifacts/designs/2026-06-02_10-02-12_protocol-editor-review-fixes.md`.

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

## What We're NOT Doing

- No new incremental minimap updater; the developer selected full `renderMinimap()` refresh for correctness and lower surface area.
- No CSS changes; edge stroke-linejoin/linecap are already present in the current branch.
- No structural split of `protocol-editor-view.ts`; this is a focused review-fix patch.
- No changes to `.rp.json` schema, parser, store API, or lower protocol layers.
- No full `loadProtocol()` restoration for drag/resize save; performance optimization remains in place.

---

## Phase 1: Safe edge-bend clamp

### Overview

Fix Q1: `computeEdgeBend()` forward path must return the computed safe maximum bend directly instead of flooring it up to `MIN_BEND`. Add invariant-style short-delta tests for LR and TB forward routes to catch backtracking regressions.

### Changes Required:

#### 1.1. Fix `computeEdgeBend()` forward-route bend safety
**File**: `src/views/protocol-editor-view.ts`
**Changes**: Replace the entire `computeEdgeBend()` function. In the forward branch, return `Math.max(0, Math.min(rankDelta / 2, Math.abs(normalDelta) / 2, CONFIGURED_MAX_BEND))` instead of `Math.max(MIN_BEND, maxBend)`. The backward branch is also simplified to remove the `MIN_BEND` floor (both versions return 20 for default constants — behaviorally equivalent). The unused `MIN_BEND` constant is removed.

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
```

#### 1.2. Add short-delta no-backtracking regression tests
**File**: `src/__tests__/protocol-editor-helpers.test.ts`
**Changes**: Add helper functions `routeRankCoordinates()` and `expectNoForwardRankBacktracking()`, then add two new test cases for very short forward horizontal and vertical doglegs that assert no rank-coordinate backtracking.

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

### Success Criteria:

#### Automated Verification:
- [x] Route helper tests pass: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`
- [x] Unsafe bend floor is absent: `grep -n "Math.max(MIN_BEND, maxBend)" src/views/protocol-editor-view.ts` returns no matches

#### Manual Verification:
- [ ] Very short forward LR and TB routes render without backwards folds/cusps.

---

## Phase 2: Guarded geometry save refresh

### Overview

Fix Q2/Q3: guard `saveNodeGeometry()` against stale async mutations by capturing `protocolPath` before await and bailing if it changes; call `renderMinimap()` after successful guarded geometry saves to refresh minimap node rectangles, edge lines, and bounds. Add focused regression tests for minimap refresh and stale-path guard behavior.

### Changes Required:

#### 2.1. Rewrite `saveNodeGeometry()` with path guard and minimap refresh
**File**: `src/views/protocol-editor-view.ts`
**Changes**: Replace `saveNodeGeometry()` to capture `protocolPath`, geometry snapshot, and viewport before the async store update; guard post-await `this.doc`/DOM mutations with `this.protocolPath === capturedPath`; call `renderMinimap()` after guarded `updateEdgePaths()`.

```typescript
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

#### 2.2. New geometry-save regression test file
**File**: `src/__tests__/views/protocol-editor-save-node-geometry.test.ts` (NEW)
**Changes**: Create test suite with mocks for Obsidian APIs, `ProtocolEditorView`, protocol document store, and DOM elements. Two test cases: (1) successful geometry save updates node DOM, edges, and minimap; (2) stale-path bail-out does not mutate the active view.

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

### Success Criteria:

#### Automated Verification:
- [x] Geometry-save regression tests pass: `npm test -- src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [x] Route helper tests still pass: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`
- [x] Full test suite passes: `npm test`
- [x] Type/build validation passes: `npm run build`
- [x] Guard exists: `grep -n "this.protocolPath !== protocolPath" src/views/protocol-editor-view.ts` returns the `saveNodeGeometry()` guard
- [x] Minimap refresh exists in geometry-save path: `grep -n "this.renderMinimap()" src/views/protocol-editor-view.ts` includes `saveNodeGeometry()`

#### Manual Verification:
- [ ] After drag/resize release, the minimap node rectangle and edge line reflect the saved geometry.
- [ ] Loading another protocol while a geometry save is pending does not replace the active view with the stale saved document.
- [ ] Drag remains smooth because `renderMinimap()` runs only after save completion, not during rAF mousemove updates.

---

## Testing Strategy

### Automated:
- Route helper regression tests: `npm test -- src/__tests__/protocol-editor-helpers.test.ts`
- Geometry-save regression tests: `npm test -- src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- Full test suite: `npm test`
- Type/build validation: `npm run build`
- Grep guards: verify stale-path guard and minimap refresh call exist in `saveNodeGeometry()`

### Manual Testing Steps:
1. Visual check: after drag/resize release, main canvas node, main edges, and minimap node rectangle/edge line all reflect the saved geometry.
2. Stale-path check: if another protocol is loaded while a geometry save is pending, the active view must remain on the newly loaded protocol and not flash back to the saved old document.
3. Drag smoothness: `renderMinimap()` runs only after save completion, not during rAF mousemove updates.

## Performance Considerations

- Returning a smaller bend for short routes is pure arithmetic and adds no runtime cost.
- `renderMinimap()` runs after the async save completes, not during mousemove/rAF drag frames, so it does not reintroduce drag stutter.
- The main-canvas hot path remains incremental: `applyNodePosition()` + `updateEdgePaths()` during rAF, no SVG teardown during drag.
- A full minimap refresh is intentionally chosen over a new incremental minimap updater to reduce bug surface; minimap SVG is small compared with the main editor canvas.

## Migration Notes

No data migration required. The `.rp.json` schema and persisted node/edge records are unchanged.

## Developer Context

## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source   | plan-loc          | codebase-loc                | severity   | dimension             | finding   | recommendation   | resolution         |
| -------- | ----------------- | --------------------------- | ---------- | --------------------- | --------- | ---------------- | ------------------ |
| code     | Phase 1 §1.1 (protocol-editor-view.ts) | src/views/protocol-editor-view.ts:310,327,332–333 | concern | code-quality | Plan prose says "The backward branch and constants are unchanged" but the code fence also replaces `return Math.max(MIN_BEND, maxBend)` in the backward branch with `return Math.max(0, Math.min(BACKWARD_OFFSET / 2, CONFIGURED_MAX_BEND))`. Result is behaviorally equivalent (both return 20), but `MIN_BEND` (line 310) becomes dead code and the prose is inaccurate. The success-criteria grep for `Math.max(MIN_BEND, maxBend)` would pass (string gone) but the prose says "unchanged" — implementer faces contradictory signals. | Either keep the backward branch unchanged with `Math.max(MIN_BEND, maxBend)` matching prose, or update prose to acknowledge backward-branch simplification and remove `MIN_BEND` constant. | applied: prose updated to document backward-branch simplification and MIN_BEND removal |
## References

- Design: `.rpiv/artifacts/designs/2026-06-02_10-02-12_protocol-editor-review-fixes.md`
- Review: `.rpiv/artifacts/reviews/2026-06-02_09-35-12_auto.md`
- Prior plan: `.rpiv/artifacts/plans/2026-06-01_23-11-50_protocol-editor-edge-and-drag-fix.md`
- Research: `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md`
