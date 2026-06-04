---
date: 2026-06-02T20:11:53+0300
author: Roman Shulgha
commit: 44e0907
branch: main
repository: RadiProtocol
topic: "Protocol Editor canvas UX follow-up — node creation flash, live edge dragging, orthogonal corners"
tags: [plan, protocol-editor, canvas, drag, edge-routing, node-creation, ux]
status: ready
parent: ".rpiv/artifacts/plans/2026-06-02_18-26-22_cleanup-and-ux-fixes.md"
phase_count: 4
unresolved_phase_count: 0
last_updated: 2026-06-02T20:11:53+0300
last_updated_by: Roman Shulgha
---

# Protocol Editor Canvas UX Follow-up Implementation Plan

## Overview

Fix the remaining Protocol Editor canvas issues by addressing the root causes missed by the prior cleanup/UX plan Phase 2. The plan keeps the editor architecture intact, adds a live geometry source for incremental edge updates, removes the full reload from node creation, and normalizes orthogonal SVG route generation so U-shaped corners do not overshoot or emit degenerate bend commands.

## Requirements

- Creating a new node must not cause a visible flash, blink, jump, or temporary incorrect canvas state.
- Connected edges must update live during every node drag, not only the first drag after editor open or auto-layout.
- Edge updates must be visible during drag frames and must not wait for mouseup/drop.
- Orthogonal U-shaped / П-shaped edges must render with clean corners and no jagged teeth/notches.
- Direct straight edge rendering must remain unchanged.
- Avoid broad rewrites; keep changes targeted to Protocol Editor rendering/update logic.
- Add focused automated regression coverage where practical and document visual/manual QA.

## Current State Analysis

The previous plan's Phase 2 attempted to fix two symptoms by changing `computeEdgeBend()` and moving `openEditModal()` before `loadProtocol()` in both node creation flows. Current code shows those changes landed, but they do not address the remaining root causes.

### Key Discoveries

- `src/views/protocol-editor-view.ts:627-637` and `src/views/protocol-editor-view.ts:698-731` still call `loadProtocol()` after node creation, which rebuilds the shell/document and can visibly tear down/repaint the canvas.
- `src/views/protocol-editor-view.ts:1335-1386` binds drag handlers to node objects from the current render. The handler mutates that captured object during drag.
- `src/views/protocol-editor-view.ts:1452-1486` replaces `this.doc` with the freshly written document after save. Existing DOM listeners remain attached to old node objects, while `updateEdgePaths()` reads `this.doc.nodes`.
- `src/views/protocol-editor-view.ts:907-919` recalculates edge endpoints from `this.doc` world coordinates, so subsequent drags mutate a stale closure object while edge routing reads an unmutated replacement object.
- `src/views/protocol-editor-view.ts:1574-1654` auto-layout ends with `loadProtocol()`, which recreates listeners bound to current `this.doc` objects; therefore the first drag after auto-layout works, then the first save recreates the stale-closure split.
- `src/views/protocol-editor-view.ts:312-431` still hand-builds backward orthogonal paths. Some corners overshoot the actual corner before the `Q` command, producing tiny backtracking hooks/notches.
- `src/styles/protocol-editor.css:102-107` already sets round line joins/caps, so the remaining corner artifact is path geometry, not just missing CSS.
- `src/__tests__/protocol-editor-helpers.test.ts:143-170` checks selected route strings but does not assert that backward U-turn corners avoid overshoot or zero-radius `Q` commands.

## Desired End State

```typescript
// During every drag frame, the node DOM and edge SVG both use the same live geometry source.
node.x = origX + dx;
node.y = origY + dy;
this.applyNodePosition(nodeEl, node); // records live geometry
this.updateEdgePaths();              // reads live geometry, not stale this.doc nodes
```

```typescript
// Node creation updates the active editor incrementally instead of tearing down the shell.
const updated = await protocolDocumentStore.update(path, addNodeMutator);
this.applyCreatedProtocolDocument(updated, newNode.id);
this.openEditModal(newNodeFromUpdatedDoc, { autofocusFirstTextField: true });
```

```typescript
// Orthogonal paths approach a corner, curve through the corner, and leave the corner
// without overshooting/backtracking or emitting zero-length Q bends.
roundedOrthogonalPath([
  { x: 500, y: 100 },
  { x: 540, y: 100 },
  { x: 540, y: 168 },
  { x: 160, y: 168 },
  { x: 160, y: 120 },
  { x: 200, y: 120 },
], 10);
```

## What We're NOT Doing

- No persisted schema changes to `.rp.json` documents.
- No replacement of dagre auto-layout.
- No broad Protocol Editor rewrite or framework migration.
- No change to edge semantics, labels, node kinds, or parser behavior.
- No new Obsidian `Modal` subclass; this plan keeps the existing DOM modal pattern.
- No full SVG rebuild in the drag hot path.

## Decisions

### Use a live UI geometry cache for drag edge updates

`bindDrag()` mutates a captured node object during mousemove (`src/views/protocol-editor-view.ts:1335-1361`), but `saveNodeGeometry()` later replaces `this.doc` (`src/views/protocol-editor-view.ts:1452-1480`). Existing listeners are not rebound after save, so `updateEdgePaths()` reading `this.doc.nodes` (`src/views/protocol-editor-view.ts:907-919`) observes stale coordinates on subsequent drags. The chosen fix records geometry whenever node DOM position is applied and makes edge updates prefer that live geometry.

### Avoid `loadProtocol()` after node creation

Phase 2 only moved the modal before reload; it did not remove the full shell/document teardown. The chosen fix updates the current document and appends the newly created node in place, then refreshes edges/minimap. This preserves canvas stability and keeps creation targeted.

### Normalize orthogonal path generation rather than only changing bend constants

The remaining U-shaped edge artifacts are caused by route geometry that can overshoot a corner before a `Q` bend. The chosen fix centralizes rounded orthogonal path generation, clamps each corner to adjacent segment lengths, omits zero-radius bends, rounds coordinates, and updates route tests to cover the backward U-turn cases.

### Keep validation focused on underlying logic plus manual visual QA

The bugs are visual/interactive, but the underlying failures are testable: stale doc vs live drag geometry, degenerate route commands, and backward corner overshoot. Manual QA remains required for actual flicker/perception in Obsidian.

## Phase 1: Live Geometry Invalidation

### Overview

Adds live rendered node geometry as the source of truth for incremental edge path updates. Foundation phase; required before incremental creation and route cleanup.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts: geometry cache and updateEdgePaths
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — add live geometry cache, record it in `applyNodePosition()`, clear it on full render/close, and have `updateEdgePaths()` route from live geometry.

```typescript
// Add after interface ProtocolEditorMeasuredNodeGeometry
interface ProtocolEditorLiveNodeGeometry extends ProtocolEditorMeasuredNodeGeometry {
  id: string;
}

// Add after: private readonly nodeElementById = new Map<string, HTMLElement>();
private readonly liveNodeGeometryById = new Map<string, ProtocolEditorLiveNodeGeometry>();

// In onClose(), after nodeElementById/null cleanup intent and before body class cleanup:
this.nodeElementById.clear();
this.liveNodeGeometryById.clear();

// At the start of renderDocument(), immediately before this.surfaceEl.empty():
this.nodeElementById.clear();
this.liveNodeGeometryById.clear();

// Add near fallbackNodeGeometry():
private rememberLiveNodeGeometry(node: Pick<ProtocolNodeRecord, 'id' | 'x' | 'y' | 'width' | 'height'>): void {
  this.liveNodeGeometryById.set(node.id, {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  });
}

private currentNodeGeometry(node: ProtocolNodeRecord): ProtocolEditorMeasuredNodeGeometry {
  return this.liveNodeGeometryById.get(node.id) ?? this.fallbackNodeGeometry(node);
}

// Replace applyNodePosition() with:
private applyNodePosition(nodeEl: HTMLElement, node: ProtocolNodeRecord): void {
  this.rememberLiveNodeGeometry(node);
  nodeEl.setAttr('style', `left:${worldXToSurfaceX(node.x)}px;top:${worldYToSurfaceY(node.y)}px;width:${node.width}px;min-height:${node.height}px;${node.color !== undefined ? `--rp-node-color:${node.color};` : ''}`);
}

// In updateEdgePaths(), replace the source/target calculation block:
const source = protocolEditorAnchorToSurfacePoint(protocolEditorPortAnchor(this.currentNodeGeometry(from), outputSide));
const target = protocolEditorAnchorToSurfacePoint(protocolEditorPortAnchor(this.currentNodeGeometry(to), inputSide));

// In bindDrag() onUp, after node.x/node.y are rounded and before saveNodeGeometry():
node.x = newX;
node.y = newY;
this.applyNodePosition(nodeEl, node);
this.updateEdgePaths();
void this.saveNodeGeometry(node);
```

#### 2. src/__tests__/views/protocol-editor-save-node-geometry.test.ts: stale-doc live edge regression
**File**: src/__tests__/views/protocol-editor-save-node-geometry.test.ts
**Changes**: MODIFY — add a regression test proving `updateEdgePaths()` uses live geometry even when `this.doc` has been replaced.

```typescript
it('updates edge paths from live geometry after doc replacement leaves drag listeners with older node objects', () => {
  const sourceNode = makeNode({ id: 'source', x: 0, y: 0, width: 200, height: 80 });
  const targetNode = makeNode({ id: 'target', x: 400, y: 0, width: 200, height: 80 });
  const doc: ProtocolDocumentV1 = {
    ...makeDoc(sourceNode),
    nodes: [sourceNode, targetNode],
    edges: [{ id: 'edge-1', fromNodeId: 'source', toNodeId: 'target' }],
  };
  const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(doc));
  const { view, updateEdgePaths } = createView(update, doc);
  updateEdgePaths.mockRestore();

  const hitboxEl = makeNodeElement();
  const pathEl = makeNodeElement();
  const group = {
    querySelector(selector: string) {
      if (selector === '.rp-protocol-editor-edge-hitbox') return hitboxEl;
      if (selector === '.rp-protocol-editor-edge') return pathEl;
      return null;
    },
  };
  (globalThis as any).CSS = { escape: (value: string) => value };
  (view as any).svgEl = {
    querySelector: (selector: string) => selector === '[data-edge-id="edge-1"]' ? group : null,
  };

  // Simulate the post-save state: this.doc has replacement node objects at old
  // coordinates, while the still-bound drag listener is moving the old object.
  (view as any).doc = {
    ...doc,
    nodes: [
      { ...sourceNode, x: 0, y: 0 },
      { ...targetNode, x: 400, y: 0 },
    ],
  };
  (view as any).liveNodeGeometryById.set('source', { id: 'source', x: 50, y: 30, width: 200, height: 80 });

  (view as any).updateEdgePaths();

  expect(pathEl.attrs.d).toContain('M 15250 12070');
  expect(hitboxEl.attrs.d).toBe(pathEl.attrs.d);
});
```

### Success Criteria:

#### Automated Verification:
- [x] Focused save geometry tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [x] Type checking passes for editor/test changes: `npx tsc --noEmit`
- [x] Grep confirms the hot-path incremental updater routes from live geometry: `grep -A35 -n "private updateEdgePaths" src/views/protocol-editor-view.ts | grep "currentNodeGeometry(from"` returns a match, while the same block has no `protocolEditorPortAnchor(from, outputSide)` match

#### Manual Verification:
- [ ] Open the Protocol Editor and drag a connected node immediately after opening; connected edges move live.
- [ ] Release the node, drag it again without reloading; connected edges still move live during the second drag.
- [ ] Auto-arrange horizontally or vertically, drag a node once, then drag again; connected edges move live on both drags.

## Phase 2: Incremental Node Creation

### Overview

Replaces node-creation full reloads with incremental document/DOM updates. Depends on Phase 1.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts: renderNode helper and creation apply path
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — extract single-node rendering and use it to append created nodes without calling `loadProtocol()`.

```typescript
// Extract the node body currently inside `for (const node of this.doc.nodes)` in renderDocument()
// into this helper. The helper body is identical to the existing loop body.
private renderNode(node: ProtocolNodeRecord): HTMLElement | null {
  if (this.surfaceEl === null) return null;
  this.surfaceEl.querySelector('.rp-protocol-editor-empty')?.remove();

  const nodeEl = this.surfaceEl.createDiv({ cls: 'rp-protocol-editor-node' });
  nodeEl.toggleClass('is-untyped', node.kind === null);
  nodeEl.setAttr('data-node-id', node.id);
  nodeEl.setAttr('data-node-kind', nodeKindToken(node.kind));
  nodeEl.setAttr('tabindex', '0');
  nodeEl.setAttr('role', 'group');
  nodeEl.setAttr('aria-label', nodeTitle(node, this.plugin.i18n.t.bind(this.plugin.i18n)));
  if (node.color === undefined) node.color = defaultColorForProtocolEditorNodeKind(node.kind);
  this.applyNodePosition(nodeEl, node);

  const inputPort = nodeEl.createDiv({ cls: 'rp-protocol-editor-port rp-protocol-editor-port-input' });
  inputPort.setAttr('data-node-id', node.id);
  inputPort.setAttr('data-port-kind', 'input');
  inputPort.setAttr('data-port-side', protocolEditorInputPortSide(this.layoutDirection));
  inputPort.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.inputPortLabel'));

  const outputPort = nodeEl.createDiv({ cls: 'rp-protocol-editor-port rp-protocol-editor-port-output' });
  outputPort.setAttr('data-node-id', node.id);
  outputPort.setAttr('data-port-kind', 'output');
  outputPort.setAttr('data-port-side', protocolEditorOutputPortSide(this.layoutDirection));
  outputPort.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.outputPortLabel'));

  nodeEl.createDiv({ cls: 'rp-protocol-editor-node-kind', text: node.kind ?? this.plugin.i18n.t('protocolEditor.untyped') });
  const displayTitle = nodeTitle(node, this.plugin.i18n.t.bind(this.plugin.i18n));
  if (displayTitle !== (node.kind ?? this.plugin.i18n.t('protocolEditor.untyped'))) {
    nodeEl.createDiv({ cls: 'rp-protocol-editor-node-title', text: displayTitle });
  }
  const resizeHandle = nodeEl.createDiv({ cls: 'rp-protocol-editor-resize-handle' });
  resizeHandle.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.resizeNodeLabel'));

  this.bindConnectionDrag(outputPort, node);
  this.bindDrag(nodeEl, node);
  this.bindResize(resizeHandle, nodeEl, node);
  this.nodeElementById.set(node.id, nodeEl);

  nodeEl.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
    e.preventDefault();
    e.stopPropagation();
    this.openEditModal(node);
  });

  nodeEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('.rp-protocol-editor-port') !== null) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      this.openEditModal(node);
    }
  });

  return nodeEl;
}

// Replace the renderDocument() node loop body with:
for (const node of this.doc.nodes) {
  this.renderNode(node);
}

// Add after renderDocument():
private applyCreatedProtocolDocument(updated: ProtocolDocumentV1, newNodeId: string): ProtocolNodeRecord | null {
  this.doc = updated;
  this.layoutDirection = protocolEditorLayoutDirectionFromDocument(updated);
  this.viewportEl?.setAttr('data-layout-direction', this.layoutDirection);

  const createdNode = updated.nodes.find((node) => node.id === newNodeId) ?? null;
  if (createdNode === null) {
    this.renderDocument();
    return null;
  }

  const existingNodeEl = this.nodeElementById.get(createdNode.id);
  if (existingNodeEl === undefined || !existingNodeEl.isConnected) {
    this.renderNode(createdNode);
  } else {
    this.applyNodePosition(existingNodeEl, createdNode);
  }

  this.renderEdges();
  this.renderMinimap();
  return createdNode;
}

// In addNodeAtWorldPoint(), snapshot the active path/generation before update:
const protocolPath = this.protocolPath;
const generation = this.loadGeneration;

// Use the snapshot for update and replace the .then block:
void this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
  if (existing === null) protocolMissingFileError();
  return { ...existing, nodes: [...existing.nodes, newNode], viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
}).then((updated) => {
  if (this.protocolPath !== protocolPath || this.loadGeneration !== generation) return;
  const createdNode = this.applyCreatedProtocolDocument(updated, newNode.id) ?? newNode;
  this.openEditModal(createdNode, { autofocusFirstTextField: true });
  new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
}).catch((err) => {

// In addNodeAndConnectAtWorldPoint(), snapshot the active path/generation before update:
const protocolPath = this.protocolPath;
const generation = this.loadGeneration;

// Use the snapshot for update and apply the same stale guard in the .then block:
void this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
  // existing mutation body stays the same
}).then((updated) => {
  if (this.protocolPath !== protocolPath || this.loadGeneration !== generation) return;
  const createdNode = this.applyCreatedProtocolDocument(updated, newNode.id) ?? newNode;
  this.openEditModal(createdNode, { autofocusFirstTextField: true });
  new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
}).catch((err) => {
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes for extracted helper signatures: `npx tsc --noEmit`
- [x] Grep confirms node creation no longer reloads immediately after create: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` does not report the two node creation `.then()` blocks near `addNodeAtWorldPoint()` / `addNodeAndConnectAtWorldPoint()`
- [x] Existing keyboard/modal tests still pass: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts`

#### Manual Verification:
- [ ] Create a standalone node from an empty canvas double-click; the canvas does not flash/rebuild when the node appears and the edit modal opens.
- [ ] Drag a connection to empty canvas and create a connected node; the new node and edge appear without canvas flash/rebuild.
- [ ] Close the new-node edit modal, then drag the created node; connected edges still move live.

## Phase 3: Orthogonal Route Cleanup

### Overview

Centralizes rounded orthogonal path generation and removes backward-corner overshoot/degenerate Q commands. Depends on Phase 1; can be implemented after Phase 2 or independently from it.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts: rounded orthogonal path helper
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — add route point helpers and rewrite orthogonal route branches to use them.

```typescript
// Add near ProtocolEditorEdgeRoute
interface ProtocolEditorEdgePoint {
  x: number;
  y: number;
}

const EDGE_ROUTE_EPSILON = 0.5;

function roundProtocolEditorEdgeCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatProtocolEditorEdgeCoord(value: number): string {
  return String(roundProtocolEditorEdgeCoord(value));
}

function sameProtocolEditorEdgePoint(a: ProtocolEditorEdgePoint, b: ProtocolEditorEdgePoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < EDGE_ROUTE_EPSILON;
}

function normalizeProtocolEditorEdgePoints(points: ProtocolEditorEdgePoint[]): ProtocolEditorEdgePoint[] {
  const normalized: ProtocolEditorEdgePoint[] = [];
  for (const point of points) {
    const rounded = { x: roundProtocolEditorEdgeCoord(point.x), y: roundProtocolEditorEdgeCoord(point.y) };
    const previous = normalized[normalized.length - 1];
    if (previous !== undefined && sameProtocolEditorEdgePoint(previous, rounded)) continue;
    normalized.push(rounded);
  }
  return normalized;
}

function protocolEditorLineCommand(point: ProtocolEditorEdgePoint): string {
  return `L ${formatProtocolEditorEdgeCoord(point.x)} ${formatProtocolEditorEdgeCoord(point.y)}`;
}

function roundedProtocolEditorOrthogonalPath(points: ProtocolEditorEdgePoint[], maxBend: number): string {
  const normalized = normalizeProtocolEditorEdgePoints(points);
  if (normalized.length === 0) return '';
  if (normalized.length === 1) return `M ${formatProtocolEditorEdgeCoord(normalized[0]!.x)} ${formatProtocolEditorEdgeCoord(normalized[0]!.y)}`;

  const commands = [`M ${formatProtocolEditorEdgeCoord(normalized[0]!.x)} ${formatProtocolEditorEdgeCoord(normalized[0]!.y)}`];
  for (let index = 1; index < normalized.length; index += 1) {
    const current = normalized[index]!;
    const next = normalized[index + 1];
    if (next === undefined || maxBend <= EDGE_ROUTE_EPSILON) {
      commands.push(protocolEditorLineCommand(current));
      continue;
    }

    const previous = normalized[index - 1]!;
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const bend = Math.min(maxBend, inLength / 2, outLength / 2);
    if (bend <= EDGE_ROUTE_EPSILON) {
      commands.push(protocolEditorLineCommand(current));
      continue;
    }

    const inUnit = { x: (current.x - previous.x) / inLength, y: (current.y - previous.y) / inLength };
    const outUnit = { x: (next.x - current.x) / outLength, y: (next.y - current.y) / outLength };
    const bendStart = { x: current.x - inUnit.x * bend, y: current.y - inUnit.y * bend };
    const bendEnd = { x: current.x + outUnit.x * bend, y: current.y + outUnit.y * bend };

    commands.push(protocolEditorLineCommand(bendStart));
    commands.push(`Q ${formatProtocolEditorEdgeCoord(current.x)} ${formatProtocolEditorEdgeCoord(current.y)} ${formatProtocolEditorEdgeCoord(bendEnd.x)} ${formatProtocolEditorEdgeCoord(bendEnd.y)}`);
  }

  return commands.join(' ');
}

// In protocolEditorEdgeRoute(), replace the forward TB non-straight return d with:
d: roundedProtocolEditorOrthogonalPath([
  { x: x1, y: y1 },
  { x: x1, y: midY },
  { x: x2, y: midY },
  { x: x2, y: y2 },
], bend),

// Replace the forward LR non-straight return d with:
d: roundedProtocolEditorOrthogonalPath([
  { x: x1, y: y1 },
  { x: midX, y: y1 },
  { x: midX, y: y2 },
  { x: x2, y: y2 },
], bend),

// Replace the backward TB return d array with:
d: roundedProtocolEditorOrthogonalPath([
  { x: x1, y: y1 },
  { x: x1, y: exitY },
  { x: routeX, y: exitY },
  { x: routeX, y: entryY },
  { x: x2, y: entryY },
  { x: x2, y: y2 },
], bend),

// Replace the backward LR return d array with:
d: roundedProtocolEditorOrthogonalPath([
  { x: x1, y: y1 },
  { x: exitX, y: y1 },
  { x: exitX, y: routeY },
  { x: entryX, y: routeY },
  { x: entryX, y: y2 },
  { x: x2, y: y2 },
], bend),
```

#### 2. src/styles/protocol-editor.css: SVG stroke hardening
**File**: src/styles/protocol-editor.css
**Changes**: MODIFY — keep edge stroke width stable under zoom and request geometric precision.

```css
.rp-protocol-editor-edge-hitbox {
  fill: none;
  stroke: transparent;
  stroke-width: 18;
  pointer-events: stroke;
  vector-effect: non-scaling-stroke;
}

.rp-protocol-editor-edge {
  fill: none;
  stroke: var(--interactive-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricprecision;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes for route helper changes: `npx tsc --noEmit`
- [x] CSS contains non-scaling visible edge stroke: `grep -n "vector-effect: non-scaling-stroke" src/styles/protocol-editor.css` returns at least 3 matches including minimap rules and editor edge rules
- [x] CSS lint passes: `npm run lint`

#### Manual Verification:
- [ ] Inspect a backward LR U-shaped / П-shaped edge; corners are rounded/clean with no overshoot teeth.
- [ ] Inspect a backward TB U-shaped / П-shaped edge; corners are rounded/clean with no overshoot teeth.
- [ ] Inspect direct straight LR/TB edges; they still render as simple direct lines without new artifacts.

## Phase 4: Regression Coverage and Full Validation

### Overview

Adds focused tests for backward U-shaped route quality and the live geometry path, then runs repository validation. Depends on Phases 1-3.

### Changes Required:

#### 1. src/__tests__/protocol-editor-helpers.test.ts: route geometry invariants
**File**: src/__tests__/protocol-editor-helpers.test.ts
**Changes**: MODIFY — update backward route expectations and add no-zero-radius/no-overshoot assertions.

```typescript
// Update existing backward horizontal expectation:
it('routes backward horizontal edges around nodes instead of through them', () => {
  const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
  // Dynamic bend: backward LR, normalDelta=20 → min(40, 10, 32) = 10.
  // The third corner now approaches from the right side of entryX (170), not past it (150).
  expect(route.d).toContain('L 540 158');
  expect(route.d).toContain('L 170 168');
  expect(route.labelY).toBeGreaterThan(120);
});

// Update existing backward vertical expectation:
it('routes backward vertical edges around the right side', () => {
  const route = protocolEditorEdgeRoute(200, 320, 160, 120, 'TB');
  // Dynamic bend: backward TB, |normalDelta|=40 → min(40, 20, 32) = 20.
  // The route now approaches the lower return corner without overshooting it.
  expect(route.d).toContain('L 260 100 Q 260 80 240 80');
  expect(route.labelX).toBeGreaterThan(260);
});

it('does not overshoot backward horizontal U-turn corners', () => {
  const route = protocolEditorEdgeRoute(500, 100, 200, 120, 'LR');
  expect(route.d).toContain('L 170 168 Q 160 168 160 158');
  expect(route.d).not.toContain('L 150 168');
});

it('does not overshoot backward vertical U-turn corners', () => {
  const route = protocolEditorEdgeRoute(200, 320, 160, 120, 'TB');
  expect(route.d).toContain('L 260 100 Q 260 80 240 80');
  expect(route.d).not.toContain('L 260 60');
});

it('omits zero-radius Q-curves on aligned backward U-shaped routes', () => {
  const horizontal = protocolEditorEdgeRoute(500, 100, 200, 100, 'LR');
  const vertical = protocolEditorEdgeRoute(200, 320, 200, 120, 'TB');
  expect(horizontal.d).not.toContain('Q');
  expect(vertical.d).not.toContain('Q');
  expect(horizontal.d).not.toContain('NaN');
  expect(vertical.d).not.toContain('NaN');
});

it('keeps forward dogleg routes rank-monotonic after rounded path cleanup', () => {
  const horizontal = protocolEditorEdgeRoute(100, 100, 110, 102, 'LR');
  const vertical = protocolEditorEdgeRoute(200, 100, 202, 110, 'TB');
  expectNoForwardRankBacktracking(horizontal.d, 'LR');
  expectNoForwardRankBacktracking(vertical.d, 'TB');
});
```

#### 2. src/__tests__/views/protocol-editor-save-node-geometry.test.ts: live update coverage
**File**: src/__tests__/views/protocol-editor-save-node-geometry.test.ts
**Changes**: MODIFY — strengthen the Phase 1 live geometry regression by asserting the stale document anchor is not used.

```typescript
// In the Phase 1 test `updates edge paths from live geometry after doc replacement leaves drag listeners with older node objects`, add after the positive path assertion:
expect(pathEl.attrs.d).not.toContain('M 15200 12040');
```

### Success Criteria:

#### Automated Verification:
- [x] Protocol editor route helper tests pass: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts`
- [x] Protocol editor save geometry tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Production build passes: `npm run build`
- [x] Full test suite passes: `npm test`
- [x] Lint passes: `npm run lint`

#### Manual Verification:
- [ ] Open the Protocol Editor; drag a connected node immediately after opening and confirm edges move live.
- [ ] Drag the same node a second time without reloading and confirm edges still move live during drag.
- [ ] Auto-arrange horizontally and vertically; after each auto-layout, drag once and then drag again, confirming edges move live every time.
- [ ] Create a standalone node and confirm no visible flash/flicker occurs when the node appears and edit modal opens.
- [ ] Create a connected node by dragging an edge to empty canvas and confirm no visible flash/flicker occurs.
- [ ] Inspect backward LR and TB U-shaped / П-shaped edges at multiple zoom levels; corners are clean with no teeth/notches.
- [ ] Inspect direct straight edges at multiple zoom levels; no regression in direct rendering.

## Ordering Constraints

- Phase 1 must come first because it changes the geometry source used by both drag and incremental creation.
- Phase 2 depends on Phase 1 because appended nodes must register live geometry immediately.
- Phase 3 depends only on current route helpers and Phase 1's stable update path; it may be implemented after Phase 1 even if Phase 2 is delayed.
- Phase 4 is terminal and must run after all code changes.

## Verification Notes

- Reproduce the first-drag pattern: first drag after open works, second drag freezes before this fix; after Phase 1 every drag must update edges live.
- Reproduce auto-layout pattern: first drag after auto-layout works, second drag freezes before this fix; after Phase 1 every post-auto-layout drag must update edges live.
- Verify node creation visually in Obsidian: choose node kind and confirm no canvas shell teardown/flash happens when the node appears or edit modal opens.
- Verify direct straight LR/TB edges still produce simple `M ... L ...` paths.
- Verify backward U-shaped LR/TB routes do not emit zero-radius `Q` bends when normal delta is zero.
- Verify route helper tests cover forward dogleg no-backtracking and backward U-turn no-overshoot.
- Run `npx tsc --noEmit`, focused Vitest files, `npm run build`, and `npm test`.

## Performance Considerations

- The live geometry cache avoids forced layout reads in the drag rAF path and preserves the previous incremental SVG update strategy.
- Incremental node creation avoids a full shell rebuild after every created node, reducing flicker and avoiding unnecessary DOM churn.
- Rounded path generation is O(number of route points), with at most six points per edge; overhead is negligible.
- `vector-effect: non-scaling-stroke` keeps stroke rendering stable under zoom and should not materially affect performance.

## Migration Notes

Not applicable — no schema, settings, vault, or persisted data migration.

## Pattern References

- `src/views/protocol-editor-view.ts:811-902` — full edge render already uses measured/current node anchors when DOM is available.
- `src/views/protocol-editor-view.ts:907-956` — incremental edge updates update SVG `d` attributes in place and should remain the hot path.
- `src/views/protocol-editor-view.ts:1335-1386` — existing drag lifecycle and rAF throttling pattern to preserve.
- `src/views/protocol-editor-view.ts:1452-1487` — save geometry generation guard and post-save dependent UI refresh.
- `src/__tests__/protocol-editor-helpers.test.ts:129-267` — route helper tests to extend rather than replace.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:92-164` — existing stale-save regression test style.

## Developer Context

- ❓ Question: "Design summary above. Ready to proceed to decomposition?" Answer: Proceed (Recommended).
- ❓ Question: "4 slices for Protocol Editor canvas/UX follow-up. Slice 1: live geometry cache (foundation). Slices 2-4: incremental creation, orthogonal route cleanup, regression coverage. Approve decomposition?" Answer: Approve (Recommended).

## Plan History

- Phase 1: Live Geometry Invalidation — approved as generated
- Phase 2: Incremental Node Creation — approved as generated
- Phase 3: Orthogonal Route Cleanup — approved as generated
- Phase 4: Regression Coverage and Full Validation — approved as generated

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| ------ | -------- | ------------ | -------- | --------- | ------- | -------------- | ---------- |
| code | Phase 1 | `src/views/protocol-editor-view.ts:825` | blocker | actionability | Phase 1's verification says `grep -n "protocolEditorPortAnchor(from" src/views/protocol-editor-view.ts` returns no matches, but `renderEdges()` legitimately still contains `protocolEditorPortAnchor(from, outputSide)` | Narrow the verification to the `updateEdgePaths()` block or change the expected result to allow the `renderEdges()` fallback | applied: narrowed Phase 1 grep criterion to the `updateEdgePaths()` hot path and allowed `renderEdges()` fallback |
| code | Phase 3 §2 (protocol-editor.css) | `package.json:10` | blocker | actionability | Phase 3 adds `shape-rendering: geometricPrecision;`, but `npm run lint` runs Stylelint standard rules that require lowercase value keywords | Change the value to lowercase or remove the declaration so Stylelint passes | applied: changed Phase 3 CSS code fence to `shape-rendering: geometricprecision;` |
| code | Phase 4 §1 (protocol-editor-helpers.test.ts) | <n/a> | blocker | actionability | Phase 4 expects `route.d` to contain `L 240 80`, but Phase 3's rounded TB backward route emits `Q 260 80 240 80` followed by `L 180 80` | Replace the expectation with the actual rounded-path substring produced by Phase 3 | applied: updated the backward vertical test expectation to `L 260 100 Q 260 80 240 80` |
| code | Phase 2 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:1454` | concern | code-quality | `applyCreatedProtocolDocument()` applies an async update without the `loadGeneration` stale-save guard used by `saveNodeGeometry()`, so an in-flight creation can overwrite a view after a concurrent protocol load | Capture `protocolPath` and `loadGeneration` before the update and no-op the `.then()` body when they no longer match | applied: Phase 2 now snapshots `protocolPath`/`loadGeneration` before creation updates and no-ops stale `.then()` bodies |
| coverage | ## Verification Notes §6 | <n/a> | concern | verification-coverage | Note "Verify route helper tests cover forward dogleg no-backtracking and backward U-turn no-overshoot" — criteria NOT FOUND for forward dogleg no-backtracking; code NOT FOUND for a forward dogleg no-backtracking test body | Add a Phase 4 `src/__tests__/protocol-editor-helpers.test.ts` test asserting a forward LR/TB dogleg route does not backtrack | applied: added Phase 4 forward LR/TB dogleg rank-monotonic regression test |

## References

- Prior plan: `.rpiv/artifacts/plans/2026-06-02_18-26-22_cleanup-and-ux-fixes.md`
- Prior research: `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md`
- Prior research: `.rpiv/artifacts/research/2026-06-01_23-01-21_protocol-editor-edge-and-drag-performance.md`
