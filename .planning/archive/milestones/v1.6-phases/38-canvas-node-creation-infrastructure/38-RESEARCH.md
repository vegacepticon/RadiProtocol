# Phase 38: Canvas Node Creation Infrastructure - Research

**Researched:** 2026-04-16
**Domain:** Obsidian Canvas internal API — programmatic node creation
**Confidence:** HIGH

## Summary

Phase 38 builds a `CanvasNodeFactory` service that programmatically creates typed RadiProtocol nodes on an open canvas. The project already has a mature `CanvasLiveEditor` that reads/writes canvas data via Pattern B (`getData()`/`setData()`/`requestSave()`). This phase extends that foundation with `createTextNode()` — a separate internal Canvas API method that creates a live DOM node and adds it to the canvas's `nodes` Map in one call.

The `createTextNode()` API exists on the internal `Canvas` object (the same object already probed as `view.canvas` in `CanvasLiveEditor`). It accepts an options object with `pos`, `text`, and `size` fields and returns a `CanvasNode` instance with `setColor()`, `setData()`, and spatial properties. This API is used by at least three community plugins (enchanted-canvas, obsidian-advanced-canvas, Obsidian-Canvas-Presentation) and has been stable since Obsidian 1.1.10+.

**Primary recommendation:** Create `CanvasNodeFactory` as a new service in `src/canvas/` that wraps `createTextNode()` with RadiProtocol-specific logic (node type injection, auto-color from `NODE_COLOR_MAP`, position offset calculation). Extend `canvas-internal.d.ts` with `createTextNode`, `CanvasNodeInternal`, and `nodes` Map types.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANVAS-01 | `CanvasNodeFactory` provides programmatic node creation via Canvas internal API (Pattern B) with runtime API probing | `createTextNode()` API verified via community plugins; runtime probing pattern already exists in `CanvasLiveEditor.getCanvasView()` |
| CANVAS-04 | Newly created nodes receive correct `radiprotocol_nodeType` and auto-color | `NODE_COLOR_MAP` already maps all 8 node kinds to palette strings; `setColor()` available on returned `CanvasNode`; `setData()` can inject `radiprotocol_*` properties |
| CANVAS-05 | UI shows clear Notice when canvas is not open | Pattern already used in `editor-panel-view.ts` and `runner-view.ts` — `new Notice('...')` from Obsidian API |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Node creation API | Canvas internal (browser runtime) | -- | Must use live Canvas view object; no backend/file approach |
| RadiProtocol property injection | Service layer (CanvasNodeFactory) | -- | Business logic maps node kind to `radiprotocol_*` fields and color |
| Position calculation | Service layer (CanvasNodeFactory) | -- | Pure geometry calculation based on selected node bounds |
| "No canvas" Notice | Service layer (CanvasNodeFactory) | -- | Runtime probe returns undefined, caller shows Notice |
| Type declarations | Build-time (canvas-internal.d.ts) | -- | Type safety for internal API methods |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian API | latest | Plugin framework, Notice, workspace API | Required by project |
| obsidian internal Canvas API | undocumented | `createTextNode()`, `canvas.nodes`, `setColor()` | Used by 3+ community plugins; already probed in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.2 | Unit testing | All new service code [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createTextNode()` (Pattern B) | `setData()` with manually-built node array (Strategy A variant) | `createTextNode()` handles ID generation, DOM creation, and canvas registration automatically; manual approach requires reimplementing all of that |
| `createTextNode()` | Direct JSON file write | Breaks live canvas; Standing Pitfall #1 forbids this |

## Architecture Patterns

### System Architecture Diagram

```
User Action (Phase 39+)
    │
    ▼
CanvasNodeFactory.createNode(canvasPath, nodeKind, anchorNodeId?)
    │
    ├── 1. Probe: getActiveCanvasView(canvasPath)
    │       └── returns CanvasInternal | undefined
    │           └── if undefined → Notice("Open a canvas first") → return null
    │
    ├── 2. Calculate position:
    │       └── if anchorNodeId → offset right of anchor (width + gap)
    │       └── if no anchor → use viewport center
    │
    ├── 3. Create node:
    │       └── canvas.createTextNode({ pos, text: '', size })
    │           └── returns CanvasNodeInternal
    │
    ├── 4. Apply RadiProtocol properties:
    │       └── node.setData({ ...node.getData(), radiprotocol_nodeType, color })
    │       └── color from NODE_COLOR_MAP[nodeKind]
    │
    └── 5. Persist:
            └── canvas.requestSave()
            └── return { nodeId, canvasNode }
```

### Recommended Project Structure
```
src/
├── canvas/
│   ├── canvas-live-editor.ts     # Existing — read/write Pattern B
│   ├── canvas-node-factory.ts    # NEW — node creation service
│   └── node-color-map.ts         # Existing — color mapping
├── types/
│   └── canvas-internal.d.ts      # EXTEND — add createTextNode types
```

### Pattern 1: createTextNode API (post Obsidian 1.1.10)
**What:** Canvas internal method that creates a text node, adds it to the DOM and canvas nodes Map, and returns the live CanvasNode object.
**When to use:** Always for programmatic node creation on an open canvas.
**Example:**
```typescript
// Source: enchanted-canvas + Obsidian-Canvas-Presentation (verified)
const canvasNode = canvas.createTextNode({
  pos: { x: 100, y: 200 },
  text: '',
  size: { width: 250, height: 60 },
  save: true,
  focus: false,
});
canvasNode.setColor('5'); // cyan — from NODE_COLOR_MAP
canvas.requestSave();
```
[VERIFIED: github.com/borolgs/enchanted-canvas, github.com/Quorafind/Obsidian-Canvas-Presentation]

### Pattern 2: Setting RadiProtocol properties on created node
**What:** After `createTextNode()`, use `node.setData()` to inject custom `radiprotocol_*` properties.
**When to use:** Immediately after creation, before `requestSave()`.
**Example:**
```typescript
// Source: obsidian-advanced-canvas Canvas.d.ts — setData signature
const nodeData = canvasNode.getData();
canvasNode.setData({
  ...nodeData,
  radiprotocol_nodeType: 'question',
  color: NODE_COLOR_MAP['question'], // '5'
});
```
[VERIFIED: obsidian-advanced-canvas Canvas.d.ts — `setData(data: AnyCanvasNodeData, addHistory?: boolean)`]

### Pattern 3: Runtime API probing (existing project pattern)
**What:** Check `typeof view.canvas?.createTextNode === 'function'` before using.
**When to use:** Every call to `CanvasNodeFactory.createNode()`.
**Example:**
```typescript
// Source: existing CanvasLiveEditor.getCanvasView() pattern
if (typeof canvas.createTextNode !== 'function') {
  new Notice('Canvas API unavailable — update Obsidian to use node creation.');
  return null;
}
```
[VERIFIED: src/canvas/canvas-live-editor.ts line 42 — same probe pattern for getData]

### Pattern 4: Position offset calculation
**What:** Place new node adjacent to the selected/anchor node to avoid overlap.
**When to use:** When creating a node relative to an existing one.
**Example:**
```typescript
const GAP = 40; // pixels between nodes
const anchorNode = canvas.nodes.get(anchorNodeId);
if (anchorNode) {
  const pos = {
    x: anchorNode.x + anchorNode.width + GAP,
    y: anchorNode.y,
  };
}
```
[ASSUMED — gap value is a UX decision; 40px is common in canvas plugins]

### Anti-Patterns to Avoid
- **Modifying .canvas JSON file while canvas is open:** Standing Pitfall #1. Always use Pattern B internal API.
- **Calling createTextNode without probing:** Will crash if API is unavailable. Always probe first.
- **Setting color via the options object of createTextNode:** The `color` field in `createTextNode` options is unreliable. Use `setColor()` or `setData()` after creation. [ASSUMED — based on enchanted-canvas using `setColor()` post-creation]
- **Generating node IDs manually:** `createTextNode()` generates IDs automatically. Do not pre-generate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node ID generation | UUID/nanoid generator | `createTextNode()` auto-generates | Canvas manages its own ID namespace; collisions possible with external IDs |
| Canvas DOM node creation | Manual DOM insertion | `createTextNode()` | Canvas maintains internal Maps, z-index, interaction layers — skipping these breaks selection and rendering |
| Node color resolution | Inline color lookup | `NODE_COLOR_MAP` from `node-color-map.ts` | Already exists, centralized, tested since Phase 28 |
| Canvas view detection | Custom leaf scanning | `CanvasLiveEditor.getCanvasView()` pattern | Already battle-tested; reuse the probe pattern |

**Key insight:** `createTextNode()` does three things atomically: creates DOM, registers in `canvas.nodes` Map, and sets up event listeners. Hand-rolling any of these individually leads to broken interactions (selection, dragging, context menus).

## Common Pitfalls

### Pitfall 1: createTextNode API signature changed at Obsidian 1.1.10
**What goes wrong:** Old signature `createTextNode(pos, size, focus)` vs new `createTextNode({ pos, text, size, save, focus })`.
**Why it happens:** Obsidian silently changed the internal API around version 1.1.10.
**How to avoid:** Use ONLY the object-form signature `createTextNode({ pos, text, size })`. Obsidian 1.1.10 was released in 2023 — all modern Obsidian versions use the object form.
**Warning signs:** TypeError at runtime about missing properties.
[VERIFIED: github.com/Quorafind/Obsidian-Canvas-Presentation — shows both signatures with version comment]

### Pitfall 2: Forgetting requestSave after node creation
**What goes wrong:** Node appears visually but disappears on canvas reload — not persisted to `.canvas` file.
**Why it happens:** `createTextNode()` only adds the node to in-memory state; `requestSave()` triggers the debounced disk write.
**How to avoid:** Always call `canvas.requestSave()` after creation. Use the existing `debouncedRequestSave` pattern from `CanvasLiveEditor` if batching.
**Warning signs:** Created nodes vanish after closing and reopening the canvas.
[VERIFIED: enchanted-canvas source — explicitly calls `canvas.requestSave()` after `createTextNode()`]

### Pitfall 3: Node overlap when creating without position calculation
**What goes wrong:** New node renders on top of existing nodes, obscuring content.
**Why it happens:** Default position (0,0) or anchor node position used without offset.
**How to avoid:** Calculate offset using anchor node's `x + width + GAP` for horizontal placement, or `y + height + GAP` for vertical. Check for overlaps with `canvas.nodes` iteration.
**Warning signs:** Nodes stacked on top of each other.
[ASSUMED — standard UX concern]

### Pitfall 4: setData vs setColor ordering
**What goes wrong:** `setData()` may overwrite `color` if called after `setColor()`.
**Why it happens:** `setData()` replaces the entire node data object.
**How to avoid:** Include `color` in the `setData()` call rather than using a separate `setColor()`.
**Warning signs:** Node appears with wrong color briefly, then corrects (or vice versa).
[ASSUMED — based on API design where setData replaces all fields]

### Pitfall 5: Canvas not open — silent failure
**What goes wrong:** Code attempts to create a node but canvas view is not available; no user feedback.
**Why it happens:** User hasn't opened a canvas, or opened a different file type.
**How to avoid:** Always probe for canvas view first; show `new Notice('Open a canvas first to create nodes.')` if unavailable.
**Warning signs:** Button click does nothing.
[VERIFIED: CANVAS-05 requirement]

## Code Examples

### Complete node creation flow
```typescript
// Source: Composite from enchanted-canvas + project patterns
import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import { NODE_COLOR_MAP } from './node-color-map';

const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_HEIGHT = 60;
const NODE_GAP = 40;

interface CanvasNodeInternal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  getData(): Record<string, unknown>;
  setData(data: Record<string, unknown>, addHistory?: boolean): void;
  setColor(color: string): void;
}

interface CanvasInternalExtended {
  getData(): { nodes: unknown[]; edges: unknown[] };
  setData(data: { nodes: unknown[]; edges: unknown[] }): void;
  requestSave(): void;
  selection?: Set<{ id: string }>;
  nodes: Map<string, CanvasNodeInternal>;
  createTextNode(options: {
    pos: { x: number; y: number };
    text: string;
    size: { width: number; height: number };
    save?: boolean;
    focus?: boolean;
  }): CanvasNodeInternal;
}
```

### Probing for createTextNode availability
```typescript
// Source: existing CanvasLiveEditor.getCanvasView() + extension
function getCanvasWithCreateAPI(app: App, filePath: string): CanvasInternalExtended | undefined {
  const leaf = app.workspace
    .getLeavesOfType('canvas')
    .find((l) => {
      const v = l.view as { file?: { path: string } };
      return v.file?.path === filePath;
    });

  if (!leaf) return undefined;

  const view = leaf.view as unknown as { canvas?: CanvasInternalExtended };
  const canvas = view?.canvas;

  if (!canvas || typeof canvas.createTextNode !== 'function') {
    return undefined;
  }

  return canvas;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createTextNode(pos, size, focus)` positional args | `createTextNode({ pos, text, size, save, focus })` object form | Obsidian ~1.1.10 (2023) | Must use object form only |
| Strategy A (file write) for node creation | Pattern B (`createTextNode` on live canvas) | Project decision (REQUIREMENTS.md Out of Scope) | Canvas must be open |
| Manual `getData()`/`setData()` to add nodes | `createTextNode()` + `setData()` for properties | Always available on internal API | Cleaner, handles DOM + registration |

**Deprecated/outdated:**
- Positional argument form of `createTextNode(pos, size, focus)`: replaced by object form in Obsidian 1.1.10+

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `NODE_GAP = 40` pixels is a good default spacing | Architecture Patterns | Low — purely cosmetic, easily tuned |
| A2 | `setColor()` after `setData()` may be overwritten; better to include color in setData | Pitfall 4 | Medium — could cause color flicker; verify at implementation |
| A3 | `createTextNode` `save: true` parameter auto-calls `requestSave()` | Code Examples | Low — we call `requestSave()` explicitly regardless |
| A4 | Default node dimensions 250x60 are reasonable | Code Examples | Low — cosmetic, can be tuned |

## Open Questions

1. **Does `createTextNode` return a node with auto-generated `id` already set?**
   - What we know: enchanted-canvas reads `next.color` directly after creation, implying the node is fully initialized. obsidian-advanced-canvas types show `id: string` on `CanvasNode`.
   - What's unclear: Whether the `id` is available synchronously after `createTextNode()` returns.
   - Recommendation: Assume synchronous (all evidence supports this). Test at implementation time.

2. **Should `CanvasNodeFactory` be a new class or methods on `CanvasLiveEditor`?**
   - What we know: `CanvasLiveEditor` handles reads and property edits. Node creation is a distinct capability.
   - What's unclear: Whether separation is worth the added complexity.
   - Recommendation: Separate class — `CanvasNodeFactory` has a distinct responsibility (creation vs mutation). Both share the canvas probe pattern but diverge in purpose. Factory can internally use `CanvasLiveEditor` for the probe.

3. **Overlap detection — should we check all existing nodes?**
   - What we know: The requirement says "positioned adjacent to the selected node without overlapping existing nodes".
   - What's unclear: Whether simple offset is enough or full collision detection is needed.
   - Recommendation: Start with simple offset (anchor.x + anchor.width + GAP). If overlap detected with `canvas.nodes` iteration, shift Y position down. Keep it simple for Phase 38.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANVAS-01 | CanvasNodeFactory creates text node via createTextNode with runtime probing | unit | `npx vitest run src/__tests__/canvas-node-factory.test.ts -x` | No - Wave 0 |
| CANVAS-04 | Created node receives correct radiprotocol_nodeType and auto-color | unit | `npx vitest run src/__tests__/canvas-node-factory.test.ts -x` | No - Wave 0 |
| CANVAS-05 | Notice shown when no canvas is open | unit | `npx vitest run src/__tests__/canvas-node-factory.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/canvas-node-factory.test.ts` -- covers CANVAS-01, CANVAS-04, CANVAS-05
- [ ] No framework install needed -- vitest already configured and passing (359 tests)

## Security Domain

Not applicable for this phase -- internal service with no user input beyond node type selection (closed enum `RPNodeKind`). No authentication, session management, cryptography, or external data involved.

## Sources

### Primary (HIGH confidence)
- [obsidian-advanced-canvas Canvas.d.ts](https://github.com/Developer-Mike/obsidian-advanced-canvas) — full internal Canvas API types including `createTextNode`, `CanvasNode`, `nodes: Map`, `setColor`, `setData`
- [enchanted-canvas source](https://github.com/borolgs/enchanted-canvas) — working `createTextNode()` usage with `setColor()` and `requestSave()`
- [Obsidian-Canvas-Presentation](https://github.com/Quorafind/Obsidian-Canvas-Presentation) — `createTextNode()` both API versions (pre/post 1.1.10)
- Existing project code: `src/canvas/canvas-live-editor.ts`, `src/canvas/node-color-map.ts`, `src/types/canvas-internal.d.ts`

### Secondary (MEDIUM confidence)
- [Obsidian API canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) — official data types (not internal runtime API)
- [Obsidian Forum: Canvas API details](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120)

### Tertiary (LOW confidence)
- None — all key claims verified against community plugin source code

## Project Constraints (from CLAUDE.md)

- CSS: split per-feature files in `src/styles/`, append-only per phase, always run `npm run build` after changes
- Shared files (main.ts, editor-panel-view.ts): only modify code relevant to current phase, never delete existing code
- Build: `npm run build` (production), `npm test` (vitest)
- No `innerHTML`, no `require('fs')`, no `console.log` in production
- `styles.css` is generated — never edit directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — internal Canvas API verified across 3 community plugins
- Architecture: HIGH — extends existing proven CanvasLiveEditor pattern
- Pitfalls: HIGH — API version change documented with source; other pitfalls derive from project experience

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable — internal API unchanged for 2+ years)
