# Technology Stack — v1.6 Additions

**Project:** RadiProtocol v1.6 — Polish & Canvas Workflow
**Researched:** 2026-04-16
**Scope:** Only NEW stack needs for v1.6 features. Existing stack (TypeScript 6.0.2, Obsidian 1.12.3, esbuild 0.28.0, Vitest ^4.1.2, ESLint 9.30.1 + obsidianmd plugin, async-mutex) is validated and unchanged.

---

## New Additions Summary

| What | Addition | Type | Why |
|------|----------|------|-----|
| Dead code detection | Knip ^6.4 | devDependency (or npx) | Only maintained TS dead code tool; ts-prune and tsr are EOL |
| Canvas node creation API | Extend `canvas-internal.d.ts` | Type declarations only | Undocumented internal API already used by the project (Pattern B) |
| Node ID generation | `crypto.getRandomValues` | Built-in (Electron) | No library needed; generates 16-char hex IDs matching Obsidian format |
| Canvas path sync on rename | None | Uses existing `rewriteCanvasRefs` | Already validated in v1.5 |
| UI fixes | None | Pure DOM changes | No new dependencies |

**Zero new runtime dependencies. One optional devDependency (Knip).**

---

## 1. Dead Code Detection: Knip

**Recommendation:** Use `knip` v6.4+ for the dead code audit phase.

| Field | Value |
|-------|-------|
| Package | `knip` |
| Version | ^6.4 (latest 6.4.1, published 2026-04-14) |
| Type | devDependency or `npx knip` (one-shot, no install) |
| License | ISC |
| Confidence | HIGH |

**Why Knip over alternatives:**
- `ts-prune` is in **maintenance mode** — the author recommends Knip as successor
- `tsr` (TypeScript Remove by LINE) **project has ended** — recommends Knip
- Knip finds unused files, unused exports, unused dependencies, and unused devDependencies in a single pass
- Built-in plugins for Vitest and ESLint (auto-detects config files)
- `--fix` flag can auto-remove unused exports (review diffs first)

**Integration with existing stack:**

```json
// knip.json — minimal config for Obsidian plugin
{
  "entry": ["src/main.ts"],
  "project": ["src/**/*.ts"],
  "ignore": ["src/__mocks__/**", "src/__tests__/**"],
  "ignoreDependencies": ["obsidian", "tslib", "builtin-modules"]
}
```

**Key notes:**
- `obsidian` must be in `ignoreDependencies` because it is an external provided by the runtime, not bundled
- `tslib` and `builtin-modules` are build-time utilities that Knip may flag as unused
- CSS dead code is NOT covered by Knip; the known `.rp-legend*` dead CSS requires manual grep
- Knip auto-detects `vitest.config.ts` and treats test files as entry points (no manual config needed)

**Installation:**
```bash
# Option A: One-time audit (recommended for Phase 1)
npx knip

# Option B: Permanent devDependency
npm install -D knip
```

**Sources:**
- [Knip official site](https://knip.dev) (HIGH confidence)
- [Knip npm registry](https://www.npmjs.com/package/knip) — v6.4.1 (HIGH confidence)
- [Effective TypeScript: Use Knip](https://effectivetypescript.com/2023/07/29/knip/) — migration rationale (HIGH confidence)

---

## 2. Canvas Programmatic Node Creation: Internal API Extensions

**Recommendation:** Extend the existing `canvas-internal.d.ts` with node/edge creation methods. No new npm packages.

**Confidence:** MEDIUM — undocumented internal API, but verified against two actively-used community plugins (obsidian-advanced-canvas and Obsidian-Canvas-Presentation) and consistent with the project's existing Pattern B usage.

### What Already Exists

The project's `src/types/canvas-internal.d.ts` declares:
- `CanvasInternal.getData(): CanvasData`
- `CanvasInternal.setData(data: CanvasData): void`
- `CanvasInternal.requestSave(): void`
- `CanvasInternal.selection: Set<...>`

The project's `src/canvas/canvas-live-editor.ts` already uses Pattern B (getData/setData/requestSave) for live node editing.

### New Type Declarations Needed

Add these to `canvas-internal.d.ts` (verified from [obsidian-advanced-canvas Canvas.d.ts](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/@types/Canvas.d.ts)):

```typescript
// --- New interfaces ---

/** Live canvas node object (runtime, NOT the serialized CanvasNodeData). */
export interface CanvasNodeInternal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  getData(): CanvasNodeData;
  setData(data: CanvasNodeData, addHistory?: boolean): void;
  setText(text: string): void;
  setColor(color: string): void;
}

/** Live canvas edge object (runtime). */
export interface CanvasEdgeInternal {
  id: string;
  label: string;
  from: { node: CanvasNodeInternal; side: string };
  to: { node: CanvasNodeInternal; side: string };
  getData(): CanvasEdgeData;
  setData(data: CanvasEdgeData, addHistory?: boolean): void;
}

// --- Extensions to existing CanvasInternal ---

export interface CanvasInternal {
  // existing: getData, setData, requestSave, selection

  /** Creates a text node. Returns the live CanvasNodeInternal. */
  createTextNode(options: {
    pos: { x: number; y: number };
    size: { width: number; height: number };
    text?: string;
    focus?: boolean;
    save?: boolean;
  }): CanvasNodeInternal;

  /** Map of all live nodes by ID. */
  nodes: Map<string, CanvasNodeInternal>;

  /** Map of all live edges by ID. */
  edges: Map<string, CanvasEdgeInternal>;

  /** Adds a pre-built node. */
  addNode(node: CanvasNodeInternal): void;

  /** Removes a node. */
  removeNode(node: CanvasNodeInternal): void;

  /** Adds an edge. */
  addEdge(edge: CanvasEdgeInternal): void;

  /** Removes an edge. */
  removeEdge(edge: CanvasEdgeInternal): void;

  /** Selects a single element, deselecting others. */
  selectOnly(element: CanvasNodeInternal): void;

  /** Deselects all. */
  deselectAll(): void;
}
```

### Two Approaches for Node Creation

| Approach | Method | Pros | Cons |
|----------|--------|------|------|
| **A: `createTextNode()` (recommended)** | `canvas.createTextNode({ pos, size, text, focus: false, save: true })` then `node.setData()` for radiprotocol_* properties | Obsidian handles ID, undo history, rendering, DOM registration | Undocumented; signature may change between Obsidian versions |
| **B: `getData()`/`setData()` (fallback)** | Push new node object into `getData().nodes[]`, call `setData()` + `requestSave()` | Already proven in codebase | Does not trigger Obsidian's internal node render pipeline; may need canvas view refresh |

**Recommendation: Use Approach A with runtime probe, fallback to Approach B.**

This matches the existing defensive pattern in `CanvasLiveEditor` — probe for `typeof canvas.createTextNode === 'function'` before use. If absent (older Obsidian version), fall back to getData/setData.

### Node ID Generation

Obsidian uses 16-character lowercase hexadecimal IDs. Generate with built-in Web Crypto API (available in Electron):

```typescript
function generateCanvasId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
```

No `uuid` npm package needed.

### Node Duplication Strategy

1. Get selected node data: `canvas.nodes.get(nodeId)?.getData()`
2. Deep-clone the data object
3. Generate new 16-char hex ID
4. Offset position (+30px x, +30px y)
5. Preserve ALL `radiprotocol_*` properties (nodeType, questionText, answerText, color, separator, snippetLabel, subfolderPath)
6. Create via `createTextNode()` + `node.setData()` with cloned properties
7. Do NOT duplicate edges — user connects manually (matches Obsidian's native copy-paste behavior)

### Sources
- [obsidian-advanced-canvas Canvas.d.ts](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/@types/Canvas.d.ts) — Internal API type definitions (MEDIUM confidence)
- [Obsidian-Canvas-Presentation source](https://github.com/Quorafind/Obsidian-Canvas-Presentation/blob/master/canvasPresentationIndex.ts) — `createTextNode` usage (MEDIUM confidence)
- [Obsidian Forum: Canvas API](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) — Confirms undocumented status (HIGH confidence)
- [Obsidian Forum: Canvas ID format](https://forum.obsidian.md/t/how-is-the-canvas-node-element-id-determined/50739) — 16-char hex (HIGH confidence)
- [Official canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) — Serialization types only (HIGH confidence)

---

## 3. Canvas Path Sync on Directory Rename: No New Dependencies

Uses existing `rewriteCanvasRefs` utility (validated v1.5 Phase 32). Extends the vault watcher to detect `vault.on('rename')` events for folders within `.radiprotocol/snippets/` and calls `rewriteCanvasRefs` to update `radiprotocol_subfolderPath` in all canvas files.

**Already available in codebase:**
- `rewriteCanvasRefs(app, oldPath, newPath)` — prefix-match + exact-match rewrite with WriteMutex
- Vault watcher pattern with 120ms debounce (Phase 33)
- `vault.on('rename', callback)` event registration

---

## 4. UI Fixes: No New Dependencies

- "ТипJSON" spacing fix: string literal change in SnippetEditorModal
- Create folder button in snippet editor: `createEl('button')` + existing `SnippetService.createFolder()` or vault adapter pattern
- Both are pure DOM changes using existing `createEl`/`createDiv` patterns

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Dead code | Knip | ts-prune | Maintenance mode; author recommends Knip |
| Dead code | Knip | tsr | Project ended; recommends Knip |
| Dead code | Knip | Manual grep | Unreliable for transitive unused exports |
| Node IDs | `crypto.getRandomValues` | uuid npm | Unnecessary dependency; trivial to generate |
| Canvas creation | Internal `createTextNode` | File-based JSON write | Requires canvas closed; no live rendering |
| Canvas creation | Internal API | Custom canvas renderer | Massive scope creep; Obsidian IS the canvas |

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| `uuid` | Built-in crypto is sufficient for 16-char hex canvas IDs |
| Any canvas rendering library | Obsidian is the canvas renderer |
| `ts-prune` | EOL; Knip is the successor |
| `eslint-plugin-unused-imports` | Knip covers this more comprehensively |
| React / Svelte / any UI framework | Project constraint: plain DOM |
| `json-canvas` npm package | Does not exist for JS/TS; raw JSON.parse is correct |

---

## Installation Summary

```bash
# Dead code audit (one-time or devDependency)
npx knip
# OR
npm install -D knip

# That's it. No other new packages for v1.6.
```
