---
date: 2026-07-27T17:06:52+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Default a Start node into newly created protocols"
source: .rpiv/artifacts/slices/2026-07-27_16-38-57_runner-cleanup-nodes-snippets-modal-ux.md
slice_n: 4
slice_title: "Default a Start node into newly created protocols"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 4: Default a Start node into newly created protocols

## Approach

Inject one Start `ProtocolNodeRecord` into the `nodes` array returned by
`createEmptyProtocolDocument()` (`src/protocol/protocol-document.ts:118-135`), so
every newly created protocol validates immediately instead of failing
`graphValidator.noStartNode` (`src/graph/graph-validator.ts:60-62`) and renders a
visible node at the surface center on first open.

Shape of the seeded node mirrors the record a user would get by creating a Start
node in the editor (`src/views/protocol-editor-view.ts:248` `NODE_KIND_DEFAULTS.start`
and `:670-692` `createProtocolEditorNode`):

- `kind: 'start'`, `fields: {}` — the Start node carries no typed fields.
- `color: 'rgba(76, 175, 80, 0.28)'` — the `NODE_KIND_DEFAULTS.start` color,
  inlined as a literal (the protocol layer is pure and does not import the
  view-layer constant; a comment cross-references `NODE_KIND_DEFAULTS.start` so
  the two stay in sync).
- `x: 0, y: 0` — world coordinates. The editor maps world `(0,0)` to surface
  center via `PROTOCOL_EDITOR_ORIGIN_X/Y` (`protocol-editor-view.ts:21-22`), and
  `restoreViewportState` scrolls there by default, so the node is visible on
  creation with no pan-to-node logic (explicitly out of scope per the slice map).
- `width: 200, height: 80` — matches the editor's `DEFAULT_NODE_WIDTH` /
  `DEFAULT_NODE_HEIGHT` (`protocol-editor-view.ts:17-18`), so the seeded node
  renders at the same size a user-created node would. The editor's
  `normalizeProtocolEditorNode` (`protocol-editor-view.ts:193-194`) honors these
  via `node.width || DEFAULT_NODE_WIDTH`, so an explicit value keeps the
  rendered size identical to a hand-created node. Inlined as literals with a
  comment for the same purity reason as the color.
- `edges: []` — a single Start node with no edges is valid; the validator's
  reachability check skips the start node and only flags *other* unreachable
  nodes, of which there are none. No `GraphValidator` change is needed (out of
  scope per the slice map).

**ID generation — decided fork.** The slice map offers two options: inline a
`node-${Date.now()}-${random}` pattern, or accept a `startNodeId` parameter. The
protocol layer has no node-ID generator (`nodeUid()` at
`protocol-editor-view.ts:347-348` is view-layer). I take a hybrid that preserves
the function's pure/injectable-clock design: add an **optional `startNodeId`
parameter** to `createEmptyProtocolDocument()`, defaulting to
`` `node-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}` ``. Using
`now.getTime()` (the already-injected clock) rather than a fresh `Date.now()`
keeps the timestamp deterministic under the injected clock; `Math.random()`
adds the same disambiguation entropy as `nodeUid()`. The default lets the sole
caller `ProtocolDocumentStore.create()` (`protocol-document-store.ts:95`) keep
its existing signature, while tests or a future import flow can pass an explicit
id for determinism. This matches the slice's "accept a `startNodeId` parameter"
option, which is the cleaner of the two because it does not introduce an
uncontrollable `Date.now()` into a function that already takes an injectable
clock.

The function name `createEmptyProtocolDocument` is retained (renaming would
cascade through the store and docs); the JSDoc is updated to state it now seeds
a default Start node.

## File Map

- `src/protocol/protocol-document.ts` — change — Add optional `startNodeId`
  parameter to `createEmptyProtocolDocument()`; populate `nodes` with one
  Start `ProtocolNodeRecord` at world `(0,0)` (width 200, height 80, Start color,
  `fields: {}`); update the JSDoc to note the seeded Start node.
- `src/__tests__/protocol-document-store.test.ts` — change — Extend the two
  `ProtocolDocumentStore — create` tests to assert `result.doc.nodes.length`
  is `1` and `result.doc.nodes[0].kind` is `'start'`.

## Key Interfaces

```ts
// src/protocol/protocol-document.ts

/**
 * Utility: generate a new ProtocolDocumentV1 seeded with a single Start node
 * at world (0,0) so the document validates immediately (no `noStartNode`).
 *
 * `startNodeId` defaults to a `node-<timestamp>-<rand>` id mirroring the
 * view-layer `nodeUid()` pattern, using the injectable `now` for the
 * timestamp. Pass an explicit id for deterministic tests/imports.
 */
export function createEmptyProtocolDocument(
  id: string,
  title: string,
  now = new Date(),
  startNodeId = `node-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
): ProtocolDocumentV1
```

Seeded node record (literal values, no new constants exported):

```ts
{
  id: startNodeId,
  kind: 'start',
  x: 0,
  y: 0,
  // match DEFAULT_NODE_WIDTH / DEFAULT_NODE_HEIGHT (protocol-editor-view.ts:17-18)
  width: 200,
  height: 80,
  // match NODE_KIND_DEFAULTS.start.color (protocol-editor-view.ts:248)
  color: 'rgba(76, 175, 80, 0.28)',
  fields: {},
}
```

`ProtocolDocumentStore.create(folderPath, title, id)` signature is unchanged —
it calls `createEmptyProtocolDocument(id, safeTitle, now)` and relies on the new
parameter's default.

## Integration Points

- `src/protocol/protocol-document-store.ts:95` — `create()` calls
  `createEmptyProtocolDocument(id, safeTitle, now)`; no call-site change needed
  (the new `startNodeId` parameter is optional with a generated default). The
  returned `doc` now carries one Start node, which `write()` persists as before.
- `src/main.ts:207-215` — `createAndOpenProtocol()` calls
  `this.protocolDocumentStore.create(...)` then `activateProtocolEditorView(file.path)`;
  the editor loads the seeded document via `loadProtocol`, and the validator no
  longer emits `noStartNode` for the new file. No change in `main.ts`.
- `src/views/protocol-editor-view.ts:670-692` — `createProtocolEditorNode` is
  the reference shape the seeded node mirrors (`kind`, `fields`, `color`,
  dimensions). No coupling: the seeded record is plain data that the editor
  reads via `normalizeProtocolEditorNode` (`:193-194`).
- `src/graph/graph-validator.ts:60-62` — `noStartNode` early return is the
  error this slice eliminates for new protocols. No validator change (out of
  scope); a single-Start-node graph is already valid.

## Success Criteria

- [ ] `createEmptyProtocolDocument('id-1', 'T')` returns a `ProtocolDocumentV1`
      whose `nodes` has length `1`, `nodes[0].kind === 'start'`, `nodes[0].x === 0`,
      `nodes[0].y === 0`, `nodes[0].width === 200`, `nodes[0].height === 80`,
      `nodes[0].color === 'rgba(76, 175, 80, 0.28)'`, `nodes[0].fields` deep-equals
      `{}`, and `nodes[0].id` starts with `node-`.
- [ ] Passing an explicit `startNodeId` (e.g. `createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'start-fixed')`) yields `nodes[0].id === 'start-fixed'` — the default id generator is bypassed.
- [ ] `edges` of the returned document is `[]` and `schema`/`version`/`id`/`title`/`createdAt`/`updatedAt`/`layoutDirection` are unchanged from prior behavior.
- [ ] `ProtocolDocumentStore.create('protocols', 'My Protocol', 'gen-id-123')` (via `makeVault`) returns `doc.nodes.length === 1` and `doc.nodes[0].kind === 'start'`.
- [ ] A graph parsed from the seeded document passes `GraphValidator.validate()` with zero errors (no `noStartNode`).
- [ ] The two `ProtocolDocumentStore — create` tests in `protocol-document-store.test.ts` assert `nodes.length === 1` and `nodes[0].kind === 'start'`, and `npm test` is green.
- [ ] `npm run lint` and `npm run build` (type-check + esbuild) pass with no new warnings.

## Notes / Deferred

- The Start color and node dimensions are inlined as literals in the pure
  protocol layer because that layer intentionally does not import view-layer
  constants (architecture boundary). A comment cross-references
  `NODE_KIND_DEFAULTS.start` (`protocol-editor-view.ts:248`) and
  `DEFAULT_NODE_WIDTH/HEIGHT` (`:17-18`); if those values change, this seed
  should be updated to match. Promoting them to a shared constant is out of
  scope (would touch the layer boundary).
- `createEmptyProtocolDocument`'s name is retained to avoid cascading renames;
  the JSDoc now documents the seeded Start node so the "empty" misnomer is
  explained at the call site.
- Auto-centering / pan-to-node logic is out of scope — the seeded node at world
  `(0,0)` already lands at the default viewport center.
- Seeding any edges or other node kinds is out of scope.
- No `GraphValidator` change is needed: a single-Start-node graph with no edges
  is already valid.