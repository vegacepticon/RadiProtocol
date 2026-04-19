# Phase 50: Answer ↔ Edge Label Sync — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 7 touchpoints (3 new, 4 modified) + 2 test-file extensions
**Analogs found:** 7 / 7 (all fully covered by existing code)

> **Language note.** Prose commentary in Russian per upstream convention;
> field names, types, code excerpts, file paths, line numbers — English.
> Проектные правила: см. `CLAUDE.md` — append-only для разделяемых файлов
> (особенно `main.ts`, `editor-panel-view.ts`, `src/styles/*`), никогда
> не удалять код, который не добавлял текущий phase.

---

## Stale-reference audit (CONTEXT.md vs working tree)

Проверено построчно против текущего рабочего дерева на 2026-04-19:

| CONTEXT.md claim | Working tree reality | Status |
|---|---|---|
| `editor-panel-view.ts:443-451` — Display label Setting + handler | Строки 442-451 (header `new Setting(container)` открывает с 442, `.onChange` завершается строкой 451). Диапазон 443-451 ссылается на тело блока. | Accurate |
| `editor-panel-view.ts:448` — `v \|\| undefined` | Строка 448 точно: `this.pendingEdits['radiprotocol_displayLabel'] = v \|\| undefined;` | Accurate |
| `editor-panel-view.ts:165-274` — `saveNodeEdits` Pattern B / Strategy A | Signature на 165-169, Pattern B блок 185-199, Strategy A блок 201-273 | Accurate |
| `editor-panel-view.ts:258-265` — undefined-deletes-key Strategy A | Точная локация `for (const [key, value] of Object.entries(enrichedEdits))` цикла с `value === undefined → delete` | Accurate |
| `canvas-live-editor.ts:75-205` — `saveLive` + `saveLiveBatch` | `saveLive` на 75-133, `saveLiveBatch` на 149-205 | Accurate |
| `canvas-live-editor.ts:124-132` — rollback-on-throw | Точная локация try/catch после `setData(updatedData)` | Accurate |
| `canvas-live-editor.ts:148-205` — WR-01 batched-write commentary | Doc-комментарий 138-148, тело 149-205 | Accurate |
| `canvas-parser.ts:202-215` — Answer arm | Строки 202-215 точно (`case 'answer':` открывается на 202, закрывается на 215) | Accurate |
| `canvas-parser.ts:207-209` — undefined-key normalisation (displayLabel) | Точная локация: тернарник `props['radiprotocol_displayLabel'] !== undefined ? getString(...) : undefined` | Accurate |
| `canvas-parser.ts:103-127` — edge parsing | Строки 103-127 точно, `RPEdge.label` передаётся как `rawEdge.label` (может быть undefined) | Accurate |
| `types/canvas-internal.d.ts:18-21` — `CanvasData.edges: unknown[]` | Точно строка 20: `edges: unknown[];` (строки 18-21 заключают interface CanvasData) | Accurate |
| `graph-model.ts:38-43` — `AnswerNode.displayLabel` | Строки 38-43 точно (`interface AnswerNode` с `displayLabel?: string` на 41) | Accurate |
| `graph-model.ts:130` — `reverseAdjacency` | Строка 130 точно (`reverseAdjacency: Map<string, string[]>;` внутри `ProtocolGraph`) | Accurate |
| `runner-view.ts:200` — `registerEvent(app.vault.on(...))` | Строка 200 точно — `this.registerEvent(this.app.vault.on('create', ...` | Accurate |
| `snippet-manager-view.ts:135` — `registerEvent(app.vault.on(...))` | Строка 135 точно — `this.registerEvent(this.app.vault.on('create', ...` | Accurate |
| `canvas-write-back.test.ts:145-156` — displayLabel round-trip | Строки 143-157 (тест `'undefined values delete the key from the node'`). Диапазон 145-156 попадает в тело теста. | Accurate |
| `node-label.ts:22` — `nodeLabel(answer) → displayLabel ?? answerText` | Строка 22 точно: `case 'answer': return (node.displayLabel ?? node.answerText) \|\| node.id;` | Accurate |

**Все line refs из CONTEXT.md актуальны** — drift не обнаружен. Планировщик может цитировать их напрямую.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/graph/edge-label-reconciler.ts` **(new)** | Service (pure) | transform (graph + raw JSON → diff list) | `src/graph/canvas-parser.ts` (pure pattern) + `src/graph/node-label.ts` (pure utility) | role-match (new pure module) |
| `src/canvas/canvas-live-editor.ts` → add `saveLiveEdges` + extend `saveLiveBatch` **(modified)** | Writer | request-response (Pattern B) | `saveLive` (lines 75-133) + `saveLiveBatch` (lines 149-205) — in-file analogs | exact |
| `src/types/canvas-internal.d.ts` → typed `CanvasEdgeData` **(modified)** | Type-def | n/a | `CanvasNodeData` (lines 7-16) — sibling interface in same file | exact |
| `src/views/editor-panel-view.ts` → Display label handler + node+edge atomic write **(modified)** | View | request-response | `saveNodeEdits` (lines 165-274) + Display label block (lines 442-451) — both in-file | exact |
| `src/main.ts` → register `vault.on('modify')` reconciler subscription **(modified)** OR `src/canvas/edge-label-sync-service.ts` **(new)** | Subscriber | event-driven | `main.ts:101-129` (`canvas:node-menu` registerEvent) + `runner-view.ts:200-224` (vault event subscription pattern) + `snippet-manager-view.ts:135-149` (vault watcher + debounce) | role-match (vault.on('modify') is a new event, but the pattern is identical) |
| `src/__tests__/fixtures/branching-multi-incoming.canvas` **(new)** OR extend `branching.canvas` **(modified)** | Test fixture | n/a | `src/__tests__/fixtures/branching.canvas` (lines 1-48) | exact |
| `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` **(new)** | Test fixture | n/a | `src/__tests__/fixtures/two-questions.canvas` (lines 1-15) | exact |
| `src/__tests__/edge-label-reconciler.test.ts` **(new)** | Test (pure unit) | n/a | `src/__tests__/canvas-parser.test.ts` (lines 1-80) | exact |
| `src/__tests__/canvas-write-back.test.ts` → extend with edge round-trip **(modified)** | Test (integration) | n/a | in-file `'undefined values delete the key'` test (lines 143-157) | exact |
| `src/__tests__/canvas-parser.test.ts` → multi-incoming + label-mismatch fixtures **(modified)** | Test | n/a | in-file branching-fixture tests (lines 27-47) | exact |

Замечание по `src/main.ts`: Claude's Discretion в CONTEXT.md позволяет выбрать
между inline-подпиской в `main.ts` и выделенным `EdgeLabelSyncService`. Оба
варианта опираются на один и тот же паттерн `registerEvent(vault.on(...))`.
Рекомендация к планировщику: **выделенный сервис** — см. раздел Shared
Patterns ниже, это согласуется с уже существующим разделением
(`SnippetService`, `SessionService`, `CanvasLiveEditor`, `CanvasNodeFactory`
в `main.ts:9-13, 36-44`). Владелец сервиса — `RadiProtocolPlugin`; subscribe
в `onload`, destroy в `onunload` — симметрично `canvasLiveEditor.destroy()`
на `main.ts:135`.

---

## Pattern Assignments

### 1. `src/graph/edge-label-reconciler.ts` **(new)** — Service (pure)

**Role:** pure module без Obsidian-зависимостей (D-18: "Reconciler unit tests are pure").
**Analog:** `src/graph/canvas-parser.ts` — pure module pattern; `src/graph/node-label.ts` — pure utility с предикатами (`isLabeledEdge`).

**Imports pattern to mirror** — `src/graph/canvas-parser.ts:1-18`:
```typescript
// graph/canvas-parser.ts
// Pure module — zero Obsidian API imports (PARSE-06, NFR-01, NFR-07)

import type {
  RPNode,
  RPNodeKind,
  RPEdge,
  ProtocolGraph,
  ParseResult,
  StartNode,
  QuestionNode,
  AnswerNode,
  TextBlockNode,
  LoopStartNode,
  LoopEndNode,
  SnippetNode,  // Phase 29
  LoopNode,     // Phase 43 D-05 — unified loop kind (LOOP-01, LOOP-02)
} from './graph-model';
```

**Rules to mirror:**
1. Header-комментарий: `// Pure module — zero Obsidian API imports` — enforces D-18 test isolation.
2. Все импорты — `import type`, без runtime-импорта `obsidian`.
3. Canonical reference comment в начале файла, ссылается на `.planning/notes/answer-label-edge-sync.md` (D-10 + D-16).

**"Whitespace ≡ unlabeled" helper to reuse** — copy from `src/graph/node-label.ts:40-42`:
```typescript
export function isLabeledEdge(edge: RPEdge): boolean {
  return edge.label != null && edge.label.trim() !== '';
}
```

D-02 / D-04 / D-09 прямо ссылаются на "Phase 49 D-05 rule" — это `isLabeledEdge`. Reconciler должен **импортировать** эту функцию из `./node-label`, а НЕ реимплементировать (CLAUDE.md: "Never remove existing code you didn't add" — и правило "do NOT reshape" из CONTEXT.md `<code_context>`).

**Reverse-adjacency lookup pattern** — from `src/graph/graph-model.ts:125-132`:
```typescript
export interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;
  edges: RPEdge[];
  adjacency: Map<string, string[]>;
  reverseAdjacency: Map<string, string[]>;
  startNodeId: string;
}
```

**Core reconciler API shape (новое, но опирается на существующие примитивы):**
```typescript
// Per D-07: idempotent via content-diff.
// Per D-04: edge-wins, pick first non-empty incoming label (deterministic order
//   = order returned by reverseAdjacency.get(answerId))
// Per D-18: pure — feed ProtocolGraph + edges array, return diff list. No vault.

export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
}

export interface ReconcileResult {
  diffs: EdgeLabelDiff[];
  newDisplayLabelByAnswerId: Map<string, string | undefined>;
}

export function reconcileEdgeLabels(graph: ProtocolGraph): ReconcileResult {
  // 1. For each Answer node in graph.nodes:
  //    - incoming = graph.reverseAdjacency.get(answerId) ?? []
  //    - incomingEdges = graph.edges.filter(e => e.toNodeId === answerId && incoming.includes(e.fromNodeId))
  //    - pickedLabel = first edge in incomingEdges with isLabeledEdge(e)
  //        → that edge's trimmed label
  //      else if answer.displayLabel is non-empty → use trimmed displayLabel
  //      else → undefined (all empty, D-08 clearing)
  //    - For every incomingEdge whose (label after trim) !== pickedLabel (or both ≡ unlabeled):
  //        push EdgeLabelDiff { edgeId, currentLabel, targetLabel: pickedLabel }
  //    - If answer.displayLabel (trimmed) !== pickedLabel:
  //        newDisplayLabelByAnswerId.set(answerId, pickedLabel)
  // 2. Return { diffs, newDisplayLabelByAnswerId }
  // 3. If diffs.length === 0 AND newDisplayLabelByAnswerId.size === 0 → caller skips write (D-07 loop guard)
}
```

**"Pure — no vault" enforcement** — this module must pass the same structural test as `canvas-parser.test.ts:59-65`:
```typescript
describe('CanvasParser has zero Obsidian API imports (NFR-01, PARSE-06)', () => {
  it('module can be imported without Obsidian runtime', () => {
    // If this test file loads, the import at the top succeeded in a pure Node.js env.
    // This proves CanvasParser has no obsidian imports.
    expect(typeof CanvasParser).toBe('function');
  });
});
```
Reconciler test file copies this shape 1:1.

---

### 2. `src/canvas/canvas-live-editor.ts` — add `saveLiveEdges`, extend `saveLiveBatch` **(modified)**

**Role:** Writer (Pattern B).
**Analog:** in-file — `saveLive` (lines 75-133) and `saveLiveBatch` (lines 149-205).

**CLAUDE.md constraint flag:** `canvas-live-editor.ts` — shared file. D-12 says "Add `saveLiveEdges` to `src/canvas/canvas-live-editor.ts`. Same `getData → mutate → setData → debouncedRequestSave` pattern already used by `saveLive` and `saveLiveBatch`." Executor **must append** to the class, never rewrite `saveLive`, `saveLiveBatch`, `debouncedRequestSave`, `destroy`.

**Signature pattern to mirror — saveLive** (lines 75-79):
```typescript
async saveLive(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<boolean> {
```

**New signature per D-12:**
```typescript
async saveLiveEdges(
  filePath: string,
  edgeEdits: Array<{ edgeId: string; label: string | undefined }>
): Promise<boolean>
```

**Rollback-on-throw semantics to copy verbatim** — `canvas-live-editor.ts:83-86, 120-132`:
```typescript
// Get pristine snapshot for rollback (D-03)
const originalData: CanvasData = view.canvas.getData();
// Get a second copy to mutate and commit
const updatedData: CanvasData = view.canvas.getData();
```
```typescript
try {
  view.canvas.setData(updatedData);
  this.debouncedRequestSave(filePath, view);
  return true;
} catch (err) {
  // Rollback: restore canvas to pre-edit state (D-03)
  try {
    view.canvas.setData(originalData);
  } catch (rollbackErr) {
    console.error('[RadiProtocol] Canvas rollback failed — canvas may be in inconsistent state:', rollbackErr);
  }
  throw err;
}
```

**Undefined-deletes-key mutation pattern** — `canvas-live-editor.ts:110-118` (adapt for edges):
```typescript
for (const [key, value] of Object.entries(edits)) {
  if (PROTECTED_FIELDS.has(key)) continue;
  if (value === undefined) {
    delete node[key as keyof CanvasNodeData];
  } else {
    (node as Record<string, unknown>)[key] = value;
  }
}
```
For `saveLiveEdges`, only key of interest is `label`; `undefined ≡ delete edge.label` (D-08, matches `canvas-parser.ts:207-209` symmetry):
```typescript
// Adapted for edges — only 'label' field is writable; no PROTECTED_FIELDS list needed.
for (const { edgeId, label } of edgeEdits) {
  const edge = updatedData.edges.find((e) => e.id === edgeId);
  if (!edge) return false;  // bail without mutating (mirrors saveLiveBatch:164)
  if (label === undefined) {
    delete (edge as Record<string, unknown>)['label'];
  } else {
    (edge as Record<string, unknown>)['label'] = label;
  }
}
```

**Batch-first-pass-validate pattern to copy** — `canvas-live-editor.ts:160-166`:
```typescript
// First pass: locate every target node; bail without mutating if any missing
const targets: Array<{ node: CanvasNodeData; edits: Record<string, unknown> }> = [];
for (const { nodeId, edits } of nodeEdits) {
  const node = updatedData.nodes.find((n: CanvasNodeData) => n.id === nodeId);
  if (!node) return false;
  targets.push({ node, edits });
}
```
D-14 требует atomicity для node + edge. Рекомендация: **расширить сигнатуру `saveLiveBatch`** (не писать параллельный `saveLiveEdgesBatch`):
```typescript
async saveLiveBatch(
  filePath: string,
  nodeEdits: Array<{ nodeId: string; edits: Record<string, unknown> }>,
  edgeEdits?: Array<{ edgeId: string; label: string | undefined }>   // NEW (optional param — back-compat)
): Promise<boolean>
```
First-pass validate: if any edgeId missing, `return false` BEFORE mutating — mirrors lines 161-165. Second-pass mutate after both node and edge validations pass. Single `setData` + `debouncedRequestSave` — one disk write total (D-14).

**Debounce pattern to reuse as-is** — `canvas-live-editor.ts:210-218`:
```typescript
private debouncedRequestSave(filePath: string, view: CanvasViewInternal): void {
  const existing = this.debounceTimers.get(filePath);
  if (existing !== undefined) clearTimeout(existing);
  const timer = setTimeout(() => {
    view.canvas.requestSave();
    this.debounceTimers.delete(filePath);
  }, 500);
  this.debounceTimers.set(filePath, timer);
}
```
`saveLiveEdges` вызывает `this.debouncedRequestSave(filePath, view)` — same 500ms cap (coordinates with Obsidian's own debounce per CONTEXT.md Claude's Discretion).

---

### 3. `src/types/canvas-internal.d.ts` — typed `CanvasEdgeData` **(modified)**

**Role:** Type-def.
**Analog:** in-file `CanvasNodeData` — lines 7-16.

**Pattern to mirror** — `canvas-internal.d.ts:7-16`:
```typescript
export interface CanvasNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  color?: string;
  [key: string]: unknown; // radiprotocol_* fields and any other custom properties
}
```

**New interface per D-15:**
```typescript
export interface CanvasEdgeData {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
  [key: string]: unknown; // forward-compat: fromSide, toSide, color, etc.
}
```
Shape derives from `canvas-parser.ts:36-41` (`RawCanvasEdge`) — keep field names identical. The index signature mirrors `CanvasNodeData` line 15.

**Upgrade call site** — `canvas-internal.d.ts:18-21`:
```typescript
export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: unknown[];   // ← D-15: change to CanvasEdgeData[]
}
```
becomes:
```typescript
export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
}
```

**Ripple-audit targets (planner must include in plan):**
- `canvas-live-editor.ts` — already uses `CanvasData` (line 12 import); `edges` access in new `saveLiveEdges` will inherit the stronger type.
- `editor-panel-view.ts:215, 296` — local type `{ nodes: Array<...>; edges: unknown[] }` — leave as-is (private local), or tighten to match.
- No other import of `CanvasData` outside these two files (confirmed by the on-file `import type` statements).

---

### 4. `src/views/editor-panel-view.ts` — Display label atomic write **(modified)**

**Role:** View.
**Analog:** in-file — `saveNodeEdits` (lines 165-274), Display label block (lines 442-451).

**CLAUDE.md hard constraint:** `editor-panel-view.ts` is the canonical
shared file called out by name in CLAUDE.md:
> *"When editing any file in ... `src/views/editor-panel-view.ts` ... ONLY add or modify code relevant to the current phase. NEVER delete rules, functions, or event listeners that you did not add in this phase."*

Executor must NOT touch: `attachCanvasListener`, `handleNodeClick`, `onQuickCreate`, `onDuplicate`, `renderToolbar`, `listSnippetSubfolders`, `buildKindForm` branches for `question`/`text-block`/`loop`/`snippet`/`loop-start`/`loop-end`/`start`, `renderForm` structural scaffolding, or any form-field handler other than the Display label one.

**Exact mutation points (scope-limited edits only):**

**(a) Display label onChange handler** — `editor-panel-view.ts:442-451`:
```typescript
new Setting(container)
  .setName('Display label (optional)')
  .setDesc('Short label shown in the runner button if set. Leave blank to use answer text.')
  .addText(t => {
    t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
      .onChange(v => {
        this.pendingEdits['radiprotocol_displayLabel'] = v || undefined;
        this.scheduleAutoSave();
      });
  });
```
Mutation per D-06/D-14:
- KEEP the line `this.pendingEdits['radiprotocol_displayLabel'] = v || undefined;` — это канонический undefined-deletes-key (D-08 symmetry).
- ADD a code-comment above this Setting citing `.planning/notes/answer-label-edge-sync.md` (D-10 explicit).
- DO NOT replace `scheduleAutoSave()` with a direct save — preserve the 800ms debounce pipe (`editor-panel-view.ts:625-644`) so atomic write happens inside the `saveNodeEdits` successor, not inline.

**(b) `saveNodeEdits` — Pattern B / Strategy A fork** — `editor-panel-view.ts:165-199` (Pattern B block) and `201-273` (Strategy A block).

Pattern B fork pattern — **verbatim excerpt (185-199)** to mirror for edge writes:
```typescript
// LIVE-03: Attempt live save via internal Canvas API first (Pattern B).
// If saveLive() returns true, the canvas view owns the write — do not call vault.modify().
try {
  const savedLive = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits);
  if (savedLive) {
    return;
  }
} catch (err) {
  // D-03: requestSave() threw — canvas state has been rolled back by CanvasLiveEditor.
  console.error('[RadiProtocol] saveLive threw — canvas state rolled back:', err);
  new Notice('Save failed \u2014 close the canvas and try again.');
  return;
}
// saveLive() returned false: canvas is closed or Pattern B API unavailable.
// Fall through to Strategy A (vault.modify() with canvas closed requirement).
```

Per D-14 (atomicity), when `radiprotocol_displayLabel` is in `edits`, the Pattern B call must switch from `saveLive` to the **extended `saveLiveBatch`** with both `nodeEdits=[{nodeId, edits}]` AND `edgeEdits=[...]`:
```typescript
// NEW (Phase 50 D-14): when displayLabel is in edits, collect incoming edges and
// submit node + edges in ONE saveLiveBatch call. Avoids WR-01 race per
// canvas-live-editor.ts:148-152 (Phase 41 WR-01 doc comment).
const isDisplayLabelEdit = 'radiprotocol_displayLabel' in enrichedEdits;
if (isDisplayLabelEdit) {
  const newLabel = (enrichedEdits['radiprotocol_displayLabel'] as string | undefined) ?? undefined;
  // Use ProtocolGraph from a fresh parse of live JSON to enumerate incoming edges
  // (reverseAdjacency pattern — see Reconciler).
  const edgeEdits = collectIncomingEdgeEdits(filePath, nodeId, newLabel);  // helper
  const savedLive = await this.plugin.canvasLiveEditor.saveLiveBatch(
    filePath,
    [{ nodeId, edits: enrichedEdits }],
    edgeEdits,
  );
  if (savedLive) return;
  // Fall-through to Strategy A branch below
}
```

**(c) Strategy A fork — undefined-deletes-key for edges** — mirror `editor-panel-view.ts:258-265` exactly:
```typescript
for (const [key, value] of Object.entries(enrichedEdits)) {
  if (PROTECTED_FIELDS.has(key)) continue;
  if (value === undefined) {
    delete node[key];
  } else {
    node[key] = value;
  }
}
```
Edge-side adaptation (inside the same `vault.modify()` call, D-14 "one vault.modify"):
```typescript
// Phase 50 D-13: also mutate incoming edge labels inside the SAME canvasData payload
// before vault.modify(). Symmetric to editor-panel-view.ts:258-265 node loop.
const incomingEdgeIds = /* computed from freshly-parsed graph */;
for (const edge of canvasData.edges) {
  const edgeObj = edge as Record<string, unknown>;
  if (!incomingEdgeIds.has(edgeObj['id'] as string)) continue;
  if (newLabel === undefined) {
    delete edgeObj['label'];  // D-08: strip key (symmetric to canvas-parser.ts:207-209)
  } else {
    edgeObj['label'] = newLabel;
  }
}
// single vault.modify() (line 270) writes node+edges atomically — NEVER split into two writes
await this.plugin.app.vault.modify(file as TFile, JSON.stringify(canvasData, null, 2));
```

Per D-13 Claude's Discretion: helper `collectIncomingEdgeEdits` MAY live inside `editor-panel-view.ts` colocated with `saveNodeEdits`, OR in a shared util (e.g., `src/canvas/edge-label-sync-helpers.ts`). Recommendation — **shared util** so the reconciler (inbound sync) can reuse the same edge-selection logic.

**CLAUDE.md enforcement for this file:** planner must add a task-level acceptance criterion:
> *"Acceptance: diff of `src/views/editor-panel-view.ts` touches only lines inside `saveNodeEdits` (165-274) and the Display label Setting block (442-451). No rules, functions, or listeners outside these ranges are modified or deleted."*

---

### 5. `src/main.ts` OR `src/canvas/edge-label-sync-service.ts` — `vault.on('modify')` subscription **(D-01)**

**Role:** Subscriber (event-driven).
**Analogs:**
- `runner-view.ts:200-224` — three `registerEvent(vault.on(...))` calls for create/delete/rename.
- `snippet-manager-view.ts:135-149` — three vault watchers + `shouldHandle` prefix filter + `scheduleRedraw` debounce.
- `main.ts:101-129` — plugin-owned `registerEvent(workspace.on(...))` with typed cast for undocumented event.

**CLAUDE.md constraint flag:** `main.ts` explicitly named in CLAUDE.md — append-only. Executor MUST NOT delete or reorder existing service instantiations (lines 32-44), commands (49-91), view registrations (64-70), ribbon (46), settings tab (94), `canvas:node-menu` handler (101-129), `onunload` destroys (134-138), or any method below `onload`.

**registerEvent+vault.on pattern to copy** — `runner-view.ts:200-206`:
```typescript
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (file instanceof TFile && file.extension === 'canvas') {
      this.selector?.rebuildIfOpen();
    }
  })
);
```

**Debounce + prefix-filter pattern from snippet-manager-view.ts:135-149, 170-180:**
```typescript
this.registerEvent(
  this.app.vault.on('create', (file) => {
    if (this.shouldHandle(file.path)) this.scheduleRedraw();
  }) as EventRef,
);
```
```typescript
private scheduleRedraw(): void {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  this.redrawTimer = window.setTimeout(async () => {
    this.redrawTimer = null;
    try {
      // ... work
    } catch { /* ... */ }
  }, /* debounce ms */);
}
```

**Owner lifecycle pattern for service-in-plugin** — `main.ts:23-24, 41, 134-137`:
```typescript
// field:
canvasLiveEditor!: CanvasLiveEditor;
// in onload():
this.canvasLiveEditor = new CanvasLiveEditor(this.app);
// in onunload():
async onunload(): Promise<void> {
  this.canvasLiveEditor.destroy();
  this.canvasNodeFactory.destroy();
  console.debug('[RadiProtocol] Plugin unloaded');
}
```

Service skeleton (D-01 "long-lived owner"):
```typescript
// src/canvas/edge-label-sync-service.ts
// Phase 50 D-01: owns the vault.on('modify') subscription + debounced reconcile pass.
// Symmetric to CanvasLiveEditor's lifecycle (instantiated in main.ts onload, destroyed in onunload).
// Canonical design: .planning/notes/answer-label-edge-sync.md (D-16)

import type { App, EventRef, TFile } from 'obsidian';
import type RadiProtocolPlugin from '../main';
// reconciler + Pattern B write path
import { reconcileEdgeLabels } from '../graph/edge-label-reconciler';
import { CanvasParser } from '../graph/canvas-parser';

export class EdgeLabelSyncService {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private eventRef: EventRef | null = null;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  register(): void {
    // D-01: registerEvent ensures auto-detach on plugin unload
    // (runner-view.ts:200 / snippet-manager-view.ts:135 pattern)
    this.eventRef = this.plugin.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'canvas') return;
        this.scheduleReconcile(file.path);
      })
    );
  }

  private scheduleReconcile(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      void this.reconcile(filePath).catch((err) => {
        console.warn('[RadiProtocol] reconcile failed:', err);  // Claude's Discretion: debug-only
      });
    }, 250);  // Claude's Discretion: 250ms < Obsidian's own 500ms canvas debounce
    this.debounceTimers.set(filePath, timer);
  }

  private async reconcile(filePath: string): Promise<void> {
    // D-02: live-JSON preferred, disk fallback (BUG-02/03 avoidance — see main.ts:320-335)
    // Parse → reconcileEdgeLabels() → if diff=∅ return (D-07) → otherwise saveLiveBatch OR Strategy A
    // ...
  }

  destroy(): void {
    for (const [, timer] of this.debounceTimers.entries()) clearTimeout(timer);
    this.debounceTimers.clear();
    // eventRef auto-detached by Plugin lifecycle — no manual offref needed
  }
}
```

**`main.ts` wire-up — exactly 3 added lines (append-only, no deletions):**
```typescript
// Add field near line 23:
edgeLabelSyncService!: EdgeLabelSyncService;

// Add instantiation near line 44 (after canvasNodeFactory):
this.edgeLabelSyncService = new EdgeLabelSyncService(this.app, this);
this.edgeLabelSyncService.register();

// Add destroy near line 136 (after canvasNodeFactory.destroy()):
this.edgeLabelSyncService.destroy();
```

**Live-JSON-or-disk read pattern to reuse inside `reconcile()`** — `main.ts:318-335` (verbatim):
```typescript
// 2. Read canvas content — prefer live in-memory JSON (BUG-02/03 avoidance).
let content: string;
const liveJson = this.canvasLiveEditor.getCanvasJSON(canvasPath);
if (liveJson !== null) {
  content = liveJson;
} else {
  const file = this.app.vault.getAbstractFileByPath(canvasPath);
  if (!(file instanceof TFile)) {
    new Notice('Canvas file not found.');
    return;
  }
  try {
    content = await this.app.vault.read(file);
  } catch {
    new Notice('Could not read canvas file.');
    return;
  }
}
```
Adapt inside reconciler — drop `new Notice(...)` calls (reconciler is background, not user-triggered; CONTEXT.md D-telemetry: "console.warn not user-facing Notice").

---

### 6. Test fixtures **(new)**

**Role:** Test fixture.
**Analogs:**
- `src/__tests__/fixtures/branching.canvas` (lines 1-48) — multi-outgoing from one Question; each Answer has 1 incoming.
- `src/__tests__/fixtures/two-questions.canvas` (lines 1-15) — sequential with `displayLabel`.

**Base fixture shape to copy** — `branching.canvas:1-48` (entire file; the pattern is:
a start + a question + two answer nodes + a plain-canvas node, all wired as `type: "text"` with the radiprotocol_* fields as extra keys, edges as `{ id, fromNode, toNode }` objects):

```json
{
  "nodes": [
    {
      "id": "n-start",
      "type": "text",
      "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1",
      "type": "text",
      "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    },
    {
      "id": "n-a1",
      "type": "text",
      "text": "A1",
      "x": -150, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "A1",
      "radiprotocol_displayLabel": "A1"
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" }
  ]
}
```

**New fixture 1 — `branching-multi-incoming.canvas`** (D-17: "multi-incoming case so D-04's 're-sync siblings' rule is asserted"):
- Two Question nodes `n-q1`, `n-q2` both point to a single Answer `n-a-shared`.
- Each of the two edges carries a `label` field — one labeled "Вариант X", the other labeled "Вариант Y". They intentionally differ — reconciler must detect and re-sync per D-04.
- `n-a-shared.radiprotocol_displayLabel` starts absent OR set to a third value ("Старое") — so three-way conflict exercises `edge-wins` pick-first.

**New fixture 2 — `displayLabel-edge-mismatch.canvas`** (D-17: "edge.label ≠ displayLabel cold-open"):
- One Question → one Answer, `radiprotocol_displayLabel: "X"`, edge has `label: "Y"`.
- Reconciler on cold-open sees the mismatch, picks edge label "Y" (first non-empty incoming), sets `displayLabel = "Y"`.

**Do-not-touch list per D-17 verbatim:** `unified-loop-*.canvas` fixtures (Phase 49 surface) MUST NOT be altered. Confirmed fixtures locked:
- `unified-loop-duplicate-exit.canvas`
- `unified-loop-long-body.canvas`
- `unified-loop-missing-exit.canvas`
- `unified-loop-nested.canvas`
- `unified-loop-no-body.canvas`
- `unified-loop-stray-body-label.canvas`
- `unified-loop-valid.canvas`

---

### 7. `src/__tests__/edge-label-reconciler.test.ts` **(new)**

**Role:** Test (pure unit, D-18 "feed ProtocolGraph + edges, assert diff list, no vault").
**Analog:** `src/__tests__/canvas-parser.test.ts:1-80` — vitest shape for pure module.

**Imports + fixture-loader pattern** — `canvas-parser.test.ts:1-10`:
```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}
```

**Test-shape skeleton** (one describe per D-clause):
```typescript
// src/__tests__/edge-label-reconciler.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CanvasParser } from '../graph/canvas-parser';
import { reconcileEdgeLabels } from '../graph/edge-label-reconciler';

const fixturesDir = path.join(__dirname, 'fixtures');
const loadFixture = (n: string) => fs.readFileSync(path.join(fixturesDir, n), 'utf-8');

describe('reconcileEdgeLabels — D-04 edge-wins', () => {
  it('picks first non-empty incoming label when displayLabel differs', () => { /* ... */ });
  it('resyncs every other incoming edge to the picked label (multi-incoming)', () => { /* ... */ });
  it('returns empty diff when all labels already match (D-07 idempotency)', () => { /* ... */ });
});

describe('reconcileEdgeLabels — D-08/D-09 clearing', () => {
  it('propagates empty displayLabel → strips label key on every incoming edge', () => { /* ... */ });
  it('all incoming edges empty → sets displayLabel to undefined', () => { /* ... */ });
});

describe('reconcileEdgeLabels has zero Obsidian API imports (D-18)', () => {
  it('module can be imported without Obsidian runtime', () => {
    expect(typeof reconcileEdgeLabels).toBe('function');
  });
});
```

---

### 8. `src/__tests__/canvas-write-back.test.ts` — extend with edge round-trip **(modified)**

**Role:** Test (integration with mocked vault).
**Analog:** in-file `'undefined values delete the key from the node'` test — lines 143-157.

**Pattern to copy** — `canvas-write-back.test.ts:143-157` (verbatim):
```typescript
it('undefined values delete the key from the node', async () => {
  mockVaultRead.mockResolvedValue(
    makeCanvasJson({ radiprotocol_displayLabel: 'old-label' })
  );
  await view.saveNodeEdits('test.canvas', 'node-1', {
    radiprotocol_displayLabel: undefined,
  });
  // saveLive returns false → falls through to vault.modify()
  expect(mockVaultModify).toHaveBeenCalled();
  const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
    nodes: Array<Record<string, unknown>>;
  };
  const node = written.nodes[0];
  expect(node).not.toHaveProperty('radiprotocol_displayLabel');
});
```

**New tests to append (Phase 50 edge round-trip):**
1. `'PHASE-50 D-14: display label set on Answer writes node + incoming edge.label in ONE vault.modify() call'` — mock canvas with one Answer + one incoming edge; saveNodeEdits with `radiprotocol_displayLabel: 'New'`; assert `mockVaultModify` called **exactly once**; assert written JSON has both `node.radiprotocol_displayLabel === 'New'` AND `edge.label === 'New'`.
2. `'PHASE-50 D-08: clearing displayLabel strips label key from every incoming edge'` — fixture with multi-incoming Answer + labeled incoming edges; set `radiprotocol_displayLabel: undefined`; assert `edge.label` key is absent on all incoming edges, present on non-incoming edges.

Helper `makeCanvasJson` (lines 7-13) extend-target — append edge-support overload:
```typescript
function makeCanvasJsonWithEdge(
  nodeExtra: Record<string, unknown> = {},
  edgeExtra: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    nodes: [
      { id: 'node-q', x: 0, y: 0, width: 100, height: 50, type: 'text',
        radiprotocol_nodeType: 'question' },
      { id: 'node-1', x: 10, y: 20, width: 100, height: 50, type: 'text', ...nodeExtra },
    ],
    edges: [
      { id: 'e1', fromNode: 'node-q', toNode: 'node-1', ...edgeExtra },
    ],
  });
}
```

**CLAUDE.md flag:** this test file is accumulated — existing 10 tests at lines 15-193 must be preserved verbatim; new tests appended with `/* Phase 50: ... */` comment banner.

---

### 9. `src/__tests__/canvas-parser.test.ts` — multi-incoming + label-mismatch **(modified)**

**Role:** Test.
**Analog:** in-file branching-fixture tests — lines 27-47.

**Pattern to copy — verbatim** (`canvas-parser.test.ts:27-37`):
```typescript
it('parses branching.canvas and builds correct adjacency map', () => {
  const parser = new CanvasParser();
  const result = parser.parse(loadFixture('branching.canvas'), 'branching.canvas');
  expect(result.success).toBe(true);
  if (!result.success) return;
  const graph = result.graph;
  const q1Edges = graph.adjacency.get('n-q1');
  expect(q1Edges).toBeDefined();
  expect(q1Edges).toContain('n-a1');
  expect(q1Edges).toContain('n-a2');
});
```

**New tests to append per D-17:**
1. `'parses branching-multi-incoming.canvas — reverseAdjacency.get(sharedAnswerId) returns both Question parents'` — exercises the enumeration used by reconciler.
2. `'parses displayLabel-edge-mismatch.canvas — edge label preserved on RPEdge.label'` — regression guard that `canvas-parser.ts:111` propagates `rawEdge.label` into `RPEdge`.

---

## Shared Patterns

### Shared Pattern A: Pure-module convention (Phase 49 lineage)
**Source:** `src/graph/canvas-parser.ts:1` header, `src/graph/node-label.ts:1-5` header.
**Apply to:** `src/graph/edge-label-reconciler.ts`.
```typescript
// graph/edge-label-reconciler.ts
// Pure module — zero Obsidian API imports (D-18)
// Design source: .planning/notes/answer-label-edge-sync.md (Phase 50 D-16)
```
Structural test (mirror `canvas-parser.test.ts:59-65`) asserts the module loads in pure Node — proves no accidental `obsidian` import leaked.

---

### Shared Pattern B: registerEvent + debounce + prefix filter
**Source:** `src/views/snippet-manager-view.ts:135-149` + `170-180`.
**Apply to:** `EdgeLabelSyncService.register` + `scheduleReconcile`.

Canonical subscription:
```typescript
this.plugin.registerEvent(
  this.app.vault.on('modify', (file) => {
    if (!(file instanceof TFile) || file.extension !== 'canvas') return;
    this.scheduleReconcile(file.path);
  })
);
```
Canonical debounce (key per file-path — mirrors `CanvasLiveEditor.debounceTimers`):
```typescript
private scheduleReconcile(filePath: string): void {
  const existing = this.debounceTimers.get(filePath);
  if (existing !== undefined) clearTimeout(existing);
  const timer = setTimeout(() => { /* work */ }, 250);
  this.debounceTimers.set(filePath, timer);
}
```
`destroy()` clears all timers — mirrors `canvas-live-editor.ts:224-229`.

---

### Shared Pattern C: Live-JSON-or-disk read for background work
**Source:** `src/main.ts:318-335` (verbatim block inside `handleStartFromNode`).
**Apply to:** `EdgeLabelSyncService.reconcile` reads, Display-label handler's incoming-edge enumeration.
Prefer `this.canvasLiveEditor.getCanvasJSON(filePath)` first; fall back to `vault.read`. Never skip the live-check — stale disk reads re-introduce BUG-02/03.

---

### Shared Pattern D: Pattern B / Strategy A fork
**Source:** `src/views/editor-panel-view.ts:185-199` (Pattern B) + `201-273` (Strategy A).
**Apply to:** Display label write path (extended via `saveLiveBatch`), reconciler's outbound write (inside `EdgeLabelSyncService.reconcile`).

Identifying rule: `saveLive*` returns `false` → canvas closed → Strategy A (`vault.modify` with protected-fields + undefined-deletes-key loop). Throw → rolled-back → abort with user Notice. Never call both.

---

### Shared Pattern E: undefined-deletes-key normalisation
**Source:**
- Parser-side: `src/graph/canvas-parser.ts:207-209` (displayLabel read).
- Writer-side (node): `src/views/editor-panel-view.ts:258-265`, `src/canvas/canvas-live-editor.ts:110-118`.
**Apply to:** Edge `label` field throughout Phase 50 (`saveLiveEdges`, Strategy A edge loop, reconciler diff application).
D-08 explicitly calls this symmetry out — executor must `delete edgeObj['label']` (never write `''` or `null`).

---

### Shared Pattern F: Rollback-on-throw
**Source:** `src/canvas/canvas-live-editor.ts:83-86, 120-132`.
**Apply to:** new `saveLiveEdges`, extended `saveLiveBatch` (with edge edits).
Two `getData()` calls → mutate copy B → `setData(B)` in try → on throw, `setData(A)` in nested try, then re-throw. **Never** silently swallow a rollback failure — `console.error` required.

---

### Shared Pattern G: Append-only edits on shared files (CLAUDE.md)
**Source:** `CLAUDE.md` lines 28-44.
**Apply to:** every plan task that modifies `src/main.ts`, `src/views/editor-panel-view.ts`, `src/canvas/canvas-live-editor.ts`, `src/types/canvas-internal.d.ts`, `src/__tests__/canvas-write-back.test.ts`, `src/__tests__/canvas-parser.test.ts`.
Planner must propagate this into every such task's `acceptance_criteria`:
> *"Diff touches only lines explicitly named in this task. No unrelated function, listener, or rule is modified, reordered, or deleted. Pre-existing tests continue to pass unchanged."*

---

### Shared Pattern H: Code-comment canonical refs (D-10, D-16)
**Apply to:** reconciler entry point AND `editor-panel-view.ts:442-451` Display label Setting.
**Pattern:**
```typescript
// Phase 50 D-10: Answer.displayLabel is the single source of truth for every
// incoming Question→Answer edge label. Multi-incoming Answer nodes share ONE
// label across all incoming edges — per-edge override is explicitly out of scope.
// Design source: .planning/notes/answer-label-edge-sync.md
```

---

## No Analog Found

None. Every Phase 50 touchpoint has a strong in-tree analog.

---

## Metadata

**Analog search scope:**
- `src/canvas/` (canvas-live-editor.ts, canvas-node-factory.ts)
- `src/graph/` (canvas-parser.ts, graph-model.ts, node-label.ts)
- `src/types/` (canvas-internal.d.ts)
- `src/views/` (editor-panel-view.ts, runner-view.ts, snippet-manager-view.ts)
- `src/main.ts`
- `src/__tests__/` (canvas-write-back.test.ts, canvas-parser.test.ts, canvas-live-editor.test.ts)
- `src/__tests__/fixtures/` (branching.canvas, two-questions.canvas, and 21 neighbours)

**Files read during mapping:** 13
**Pattern extraction date:** 2026-04-19
**Upstream source documents consumed:**
- `.planning/phases/50-answer-edge-label-sync/50-CONTEXT.md` (18 decisions, all anchored to in-tree code)
- `.planning/notes/answer-label-edge-sync.md` (canonical design source — D-16)
- `CLAUDE.md` (append-only / never-delete invariants for shared files)
