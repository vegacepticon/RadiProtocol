# Protocol JSON + Visual Editor Migration Plan

> **For Hermes:** Execute phase-by-phase. Use OpenCode for bounded implementation tasks, Hermes tools for verification and mechanical patches. Do not delete the old Canvas path until the new JSON-backed editor can create, edit, run, and migrate a real protocol.

**Goal:** Replace `.canvas` as RadiProtocol's protocol authoring/storage substrate with a first-party `.rp.json` protocol format and first-party visual graph editor, preserving the current node/edge authoring model and runtime behavior.

**Architecture:** Introduce a storage-neutral protocol document model (`ProtocolDocument`) and parser/writer services. Keep the existing runner model (`ProtocolGraph`, `RPNode`, `RPEdge`) as the runtime contract. Build a custom Obsidian `ItemView` visual editor for `.rp.json` protocols. Keep legacy `.canvas` import/migration support until manual migration is complete, then remove undocumented Canvas API dependencies.

**Tech Stack:** TypeScript, Obsidian Plugin API, DOM/SVG for visual editor MVP, Vitest, existing esbuild pipeline. No backend, no auth, no web app rewrite.

---

## Non-goals

- No web 2.0 rewrite.
- No backend storage.
- No collaboration/multiplayer.
- No perfect Figma/Miro clone in MVP.
- No reliance on undocumented `view.canvas.*` APIs in the final default path.
- No `.canvas` write path after migration MVP is accepted.

## Definition of Done

The migration is complete when:

1. A user can create a new protocol as `.rp.json` from a command.
2. A user can open that file in RadiProtocol Visual Editor.
3. A user can visually create, select, move, connect, delete, and edit protocol nodes.
4. The existing inline runner can run `.rp.json` protocols without `.canvas`.
5. Existing `.canvas` protocols can be imported into `.rp.json` with node kinds, fields, positions, colors, edge labels, and IDs preserved where possible.
6. Build, lint, and relevant tests pass.
7. Plugin no longer requires undocumented Obsidian Canvas APIs for normal operation.

---

## Current dependency map

### Pure runtime core that should survive

- `src/graph/graph-model.ts`
  - Runtime graph types: `RPNode`, `RPEdge`, `ProtocolGraph`.
  - Currently field name `canvasFilePath` leaks old storage naming.
- `src/graph/graph-validator.ts`
  - Validates runtime graph semantics.
- `src/runner/**`
  - Runs `ProtocolGraph`, mostly storage-neutral.
- `src/views/inline-runner-modal.ts`
  - Runtime UI; should only need a `ProtocolGraph`.
- `src/views/editor-panel/forms/**`
  - Existing node property forms are reusable if made storage-neutral.

### Canvas-specific code to replace or quarantine

- `src/graph/canvas-parser.ts`
  - Parse `.canvas` JSON into `ProtocolGraph`.
  - Keep initially as legacy import parser; later rename/quarantine.
- `src/canvas/canvas-live-editor.ts`
  - Uses undocumented `view.canvas.getData/setData/requestSave`.
  - Replace with `ProtocolDocumentStore` write path.
- `src/canvas/canvas-node-factory.ts`
  - Uses undocumented `canvas.createTextNode`.
  - Replace with visual editor document mutation.
- `src/canvas/edge-label-sync-service.ts`
  - Watches `.canvas` file modify events and reconciles labels.
  - Replace with in-editor graph update events.
- `src/types/canvas-internal.d.ts`
  - Remove from normal build path after migration.
- `src/views/editor-panel/canvas-listener.ts`
  - Selects nodes from Obsidian Canvas UI.
  - Replace with Visual Editor selection event bus.
- `src/views/editor-panel/canvas-patch.ts`
  - Rename/generalize to protocol patch if still needed.
- `src/views/editor-panel/save-node-edits.ts`
  - Replace canvas write-back with `.rp.json` document mutation.
- `src/views/editor-panel/quick-create-controller.ts`
  - Replace canvas node factory calls with visual editor commands.
- `src/snippets/canvas-ref-sync.ts`
  - Audit. Likely rename to protocol ref sync.
- `src/main.ts`
  - Replace `.canvas` enumeration and picker with `.rp.json` enumeration.

---

## Target file format

Use a new extension: `.rp.json`.

Reasoning:

- Keeps files readable and diffable.
- Avoids hijacking `.json` globally.
- Avoids editing Obsidian-owned `.canvas` files.
- Easy to detect in vault scan.
- Future-compatible with official plugin review.

### Schema v1

```ts
export interface ProtocolDocumentV1 {
  schema: 'radiprotocol.protocol';
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: ProtocolNodeRecord[];
  edges: ProtocolEdgeRecord[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface ProtocolNodeRecord {
  id: string;
  kind: RPNodeKind | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text?: string;
  fields: Record<string, unknown>;
}

export interface ProtocolEdgeRecord {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}
```

### Field mapping

Existing canvas fields map into `fields`:

- `radiprotocol_questionText` → `fields.questionText`
- `radiprotocol_answerText` → `fields.answerText`
- `radiprotocol_displayLabel` → `fields.displayLabel`
- `radiprotocol_content` → `fields.content`
- `radiprotocol_separator` → `fields.separator`
- `radiprotocol_headerText` → `fields.headerText`
- `radiprotocol_subfolderPath` → `fields.subfolderPath`
- `radiprotocol_snippetLabel` → `fields.snippetLabel`
- `radiprotocol_snippetSeparator` → `fields.snippetSeparator`
- `radiprotocol_snippetPath` → `fields.snippetPath`

Legacy parser may keep support for `radiprotocol_*` names only inside `.canvas` import path. New `.rp.json` files should not store `radiprotocol_*` prefixes.

---

## Visual editor MVP

Use HTML + SVG overlay, not `<canvas>` rendering.

Reasoning:

- DOM nodes are easier to style with existing CSS and Obsidian theme variables.
- SVG edges are simple and crisp.
- Node forms can reuse current DOM/editor-panel infrastructure.
- Hit testing and keyboard interaction are easier than raw canvas.

### Layout

`ProtocolEditorView` root:

```text
<div class="rp-visual-editor">
  <div class="rp-visual-toolbar">...</div>
  <div class="rp-visual-canvas-shell">
    <svg class="rp-visual-edges">...</svg>
    <div class="rp-visual-nodes">...</div>
  </div>
</div>
```

### MVP interactions

- Select node: click node.
- Move node: drag node, update `x/y`.
- Create node: toolbar buttons for Start, Question, Answer, Text block, Loop, Snippet.
- Connect nodes: select source, click “Connect”, then click target; or drag from small output handle.
- Delete selected node/edge: keyboard Delete + toolbar button.
- Edit node properties: existing Node Editor panel listens to visual editor selection, or right side inspector embedded in editor.
- Edit edge label: click edge or selected edge inspector.
- Save: debounced file write through `ProtocolDocumentStore`.

### Deferred interactions

- Pan/zoom polish.
- Marquee select.
- Auto-layout.
- Drag handles for edge endpoints.
- Minimap.
- Copy/paste.

---

## Phased implementation

## Phase 0: Safety branch and baseline

**Objective:** Create a safe checkpoint and verify current baseline.

**Files:** none initially.

**Steps:**

1. Run:
   ```bash
   cd /home/hermes/dev-workspace/RadiProtocol
   git status --short
   npm test
   npm run build
   npm run lint
   ```
2. If working tree is dirty, inspect diff before touching anything.
3. Create branch if Roman wants commits/checkpoints:
   ```bash
   git switch -c dev/protocol-json-visual-editor
   ```

**Verification:** baseline test/build/lint result recorded in final report.

---

## Phase 1: Introduce storage-neutral protocol document model

**Objective:** Add `.rp.json` model and pure conversion to/from `ProtocolGraph` without touching UI.

**Files:**

- Create: `src/protocol/protocol-document.ts`
- Create: `src/protocol/protocol-document-parser.ts`
- Create: `src/protocol/protocol-document-writer.ts`
- Test: `src/__tests__/protocol-document-parser.test.ts`
- Modify: `src/graph/graph-model.ts` only if adding storage-neutral aliases is necessary.

**Tasks:**

1. Define `ProtocolDocumentV1`, `ProtocolNodeRecord`, `ProtocolEdgeRecord`.
2. Implement `parseProtocolDocument(jsonString, filePath, t?) -> ParseResult`.
3. Implement `protocolGraphToDocument(graph, title?)` if needed for migration.
4. Ensure parser builds existing `ProtocolGraph` shape exactly.
5. Add tests for:
   - valid start/question/answer graph;
   - edge labels;
   - snippet fields;
   - malformed JSON;
   - missing `nodes`/`edges`;
   - unknown schema/version;
   - legacy loop rejection still handled by existing validator, not parser.

**Acceptance:**

```bash
npm test -- src/__tests__/protocol-document-parser.test.ts
npm run build
```

---

## Phase 2: Protocol document store

**Objective:** Add Obsidian vault service for reading/writing `.rp.json` documents.

**Files:**

- Create: `src/protocol/protocol-document-store.ts`
- Test: `src/__tests__/protocol-document-store.test.ts`
- Modify: `src/settings.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`

**Tasks:**

1. Add constants:
   ```ts
   export const PROTOCOL_FILE_EXTENSION = 'rp.json';
   export const PROTOCOL_SCHEMA = 'radiprotocol.protocol';
   export const PROTOCOL_VERSION = 1;
   ```
2. Add `ProtocolDocumentStore` methods:
   - `read(path): Promise<ProtocolDocumentV1>`
   - `write(path, doc): Promise<void>`
   - `update(path, mutator): Promise<ProtocolDocumentV1>`
   - `create(folderPath, title): Promise<TFile>`
   - `list(folderPath): TFile[]`
3. Preserve existing `WriteMutex` pattern.
4. Rename user-facing setting semantics from “canvas folder” to “protocol folder” while keeping backward-compatible setting key if useful.
5. Update i18n strings to say `.rp.json` protocols, not `.canvas`.

**Acceptance:**

```bash
npm test -- src/__tests__/protocol-document-store.test.ts src/__tests__/settings-tab.test.ts
npm run build
npm run lint
```

---

## Phase 3: Runtime can run `.rp.json`

**Objective:** Inline runner protocol picker scans `.rp.json` and uses `ProtocolDocumentParser`.

**Files:**

- Modify: `src/main.ts`
- Test: `src/__tests__/main-inline-command.test.ts`
- Test: `src/__tests__/runner-commands.test.ts`

**Tasks:**

1. Replace `resolveProtocolCanvasFiles` with `resolveProtocolFiles`.
2. Keep old function temporarily if tests/imports depend on it, but route new command through `.rp.json` list.
3. Replace `CanvasPickerSuggestModal` with `ProtocolPickerSuggestModal`.
4. Update `loadAndValidateProtocol(canvasPath)` to `loadAndValidateProtocol(protocolPath)`.
5. Use `ProtocolDocumentStore.read` + `parseProtocolDocument`.
6. Keep `CanvasParser` only for import/migration path, not default runner.

**Acceptance:**

```bash
npm test -- src/__tests__/main-inline-command.test.ts src/__tests__/runner-commands.test.ts
npm run build
```

---

## Phase 4: Visual editor view skeleton

**Objective:** Add a first-party Obsidian view that opens and renders `.rp.json` protocols read-only.

**Files:**

- Create: `src/views/protocol-editor-view.ts`
- Create: `src/views/protocol-editor/render.ts`
- Create: `src/views/protocol-editor/types.ts`
- Create: `src/styles/protocol-editor.css`
- Modify: `src/main.ts`
- Modify: `esbuild.config.mjs`
- Test: `src/__tests__/views/protocol-editor-view.test.ts`

**Tasks:**

1. Register `PROTOCOL_EDITOR_VIEW_TYPE = 'radiprotocol-protocol-editor'`.
2. Add command “Open RadiProtocol visual editor”.
3. Add command “Create new RadiProtocol protocol”.
4. Render toolbar, SVG edges, DOM nodes.
5. Render node kind, main label, and color.
6. No editing yet.
7. Add CSS file to `CSS_FILES`.

**Acceptance:**

```bash
npm test -- src/__tests__/views/protocol-editor-view.test.ts
npm run build
npm run lint
```

---

## Phase 5: Selection event bus and editor panel decoupling

**Objective:** Make existing Node Editor panel listen to RadiProtocol editor selection instead of Obsidian Canvas selection.

**Files:**

- Create: `src/protocol/protocol-selection-service.ts`
- Modify: `src/views/editor-panel-view.ts`
- Modify: `src/views/editor-panel/render-form.ts`
- Modify: `src/views/editor-panel/save-node-edits.ts`
- Modify: `src/views/editor-panel/canvas-listener.ts` or replace with `protocol-listener.ts`
- Test: `src/__tests__/views/editor-panel-protocol-sync.test.ts`

**Tasks:**

1. Define event shape:
   ```ts
   interface ProtocolSelectionDetail {
     filePath: string;
     nodeId: string | null;
     edgeId?: string | null;
   }
   ```
2. `ProtocolEditorView` emits selection events.
3. `EditorPanelView` subscribes to selection events.
4. Rename internal variable names from `currentFilePath/currentNodeId`; do not require canvas terminology.
5. `renderNodeForm` reads node record from `.rp.json`, not live canvas JSON.
6. `saveNodeEdits` updates `.rp.json` through store.
7. Existing form modules stay mostly unchanged; add adapter mapping between `fields.*` and expected form keys if needed.

**Acceptance:**

```bash
npm test -- src/__tests__/views/editor-panel-protocol-sync.test.ts src/__tests__/editor-panel-forms.test.ts
npm run build
```

---

## Phase 6: Visual editor mutations

**Objective:** Support create, move, connect, delete, and edge label editing in `.rp.json`.

**Files:**

- Create: `src/views/protocol-editor/mutations.ts`
- Create: `src/views/protocol-editor/interaction-controller.ts`
- Modify: `src/views/protocol-editor-view.ts`
- Modify: `src/views/editor-panel/quick-create-controller.ts`
- Test: `src/__tests__/views/protocol-editor-mutations.test.ts`

**Tasks:**

1. Implement pure mutation helpers:
   - `createProtocolNode(doc, kind, position)`
   - `moveProtocolNode(doc, nodeId, x, y)`
   - `createProtocolEdge(doc, fromNodeId, toNodeId, label?)`
   - `deleteProtocolNode(doc, nodeId)` including connected edges
   - `deleteProtocolEdge(doc, edgeId)`
   - `updateProtocolEdgeLabel(doc, edgeId, label?)`
2. Wire toolbar buttons.
3. Wire node drag with pointer events.
4. Wire selection state.
5. Wire connect mode.
6. Debounce writes.

**Acceptance:**

```bash
npm test -- src/__tests__/views/protocol-editor-mutations.test.ts src/__tests__/views/protocol-editor-view.test.ts
npm run build
npm run lint
```

---

## Phase 7: Canvas import/migration

**Objective:** Import existing `.canvas` protocols into `.rp.json`.

**Files:**

- Create: `src/migration/canvas-to-protocol-document.ts`
- Create: `src/views/migrate-canvas-modal.ts` or command-only initially
- Modify: `src/main.ts`
- Test: `src/__tests__/migration/canvas-to-protocol-document.test.ts`

**Tasks:**

1. Parse raw `.canvas` JSON.
2. Convert each `radiprotocol_nodeType` node to `ProtocolNodeRecord`.
3. Preserve:
   - `id`
   - `x/y/width/height`
   - `color`
   - text fallback
   - known `radiprotocol_*` fields
4. Convert edges referencing imported nodes.
5. Preserve edge labels.
6. Generate `.rp.json` file next to original or into protocol folder.
7. Add command “Import Canvas protocol to RadiProtocol JSON”.
8. Report skipped plain canvas nodes and skipped invalid edges.

**Acceptance:**

```bash
npm test -- src/__tests__/migration/canvas-to-protocol-document.test.ts src/__tests__/canvas-parser.test.ts
npm run build
```

---

## Phase 8: Remove default Canvas dependencies

**Objective:** Make normal operation independent from Obsidian Canvas internals.

**Files:**

- Modify/delete/quarantine:
  - `src/canvas/canvas-live-editor.ts`
  - `src/canvas/canvas-node-factory.ts`
  - `src/canvas/edge-label-sync-service.ts`
  - `src/types/canvas-internal.d.ts`
  - `src/views/editor-panel/canvas-listener.ts`
  - `src/views/editor-panel/canvas-patch.ts`
- Modify: tests referencing canvas internals.

**Tasks:**

1. Remove construction of `CanvasLiveEditor`, `CanvasNodeFactory`, `EdgeLabelSyncService` from `main.ts` default lifecycle.
2. Keep `CanvasParser` only under migration namespace or rename to `legacy-canvas-parser.ts`.
3. Remove context menu integration for Obsidian Canvas nodes.
4. Replace canvas test names with protocol test names where relevant.
5. Verify no `view.canvas`, `getLeavesOfType('canvas')`, or `canvas.createTextNode` remains in non-migration code.

**Acceptance:**

```bash
grep -R "view.canvas\|createTextNode\|getLeavesOfType('canvas')\|canvas-internal" -n src
npm test
npm run build
npm run lint
```

Expected grep result: only migration tests/docs or no results.

---

## Phase 9: UX hardening

**Objective:** Make the editor usable for real protocol authoring.

**Files:**

- `src/views/protocol-editor-view.ts`
- `src/views/protocol-editor/**`
- `src/styles/protocol-editor.css`
- i18n locales

**Tasks:**

1. Add unsaved/saved indicator.
2. Add keyboard shortcuts:
   - Delete selected
   - Escape cancel connect mode
   - Cmd/Ctrl+S force save
3. Add zoom controls if MVP editor feels cramped.
4. Add basic viewport persistence.
5. Add empty-state help.
6. Add validation button: “Validate protocol”.
7. Ensure all user-facing strings use i18n.

**Acceptance:**

```bash
npm test
npm run build
npm run lint
```

Manual check in Obsidian:

- create protocol;
- add Start → Question → Answer → Text block;
- edit fields;
- run inline;
- close/reopen editor;
- verify positions and fields persisted.

---

## Phase 10: Documentation and official-library readiness

**Objective:** Document new authoring model and remove Canvas dependency from public docs.

**Files:**

- `README.md`
- `manifest.json`
- `docs/**`
- Possibly `docs/adr/0002-protocol-json-visual-editor.md`

**Tasks:**

1. Add ADR explaining why `.canvas` was replaced.
2. Update README install/use instructions.
3. Document migration command.
4. Document `.rp.json` file format at user level.
5. Check official plugin guidelines for restricted API usage.
6. Audit generated `styles.css` only through build.

**Acceptance:**

```bash
npm test
npm run build
npm run lint
```

Manual review:

- no docs tell users to edit `.canvas` as primary workflow;
- no normal code path depends on undocumented Canvas APIs.

---

## Risk register

### Risk 1: Visual editor scope explosion

**Mitigation:** SVG + DOM MVP only. No advanced graph editor features before create/edit/run works.

### Risk 2: Editor panel assumes canvas-shaped records

**Mitigation:** Add adapter layer. Do not rewrite forms until necessary.

### Risk 3: File format churn

**Mitigation:** Schema version starts at `1`; parser rejects unknown major versions clearly.

### Risk 4: Edge editing UX gets awkward

**Mitigation:** MVP can use explicit connect mode + edge inspector, not drag handles.

### Risk 5: Official library still dislikes something else

**Mitigation:** Phase 10 includes full audit for undocumented APIs and external dependencies.

---

## Recommended execution order

Do not attempt this as one giant agent run. Use phase checkpoints:

1. Phase 1-3: storage + runner migration. This proves `.rp.json` can execute.
2. Phase 4-6: visual editor MVP. This proves authoring can work without `.canvas`.
3. Phase 7: import your existing work.
4. Phase 8-10: cleanup, polish, official-library readiness.

First implementation checkpoint should be **Phase 1 only**. It is safe, pure, testable, and does not disturb current plugin behavior.
