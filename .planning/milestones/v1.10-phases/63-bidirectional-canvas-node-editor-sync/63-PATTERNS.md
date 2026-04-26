# Phase 63: Bidirectional Canvas ↔ Node Editor Sync — Pattern Map

**Mapped:** 2026-04-25
**Files in scope:** 8 (2 NEW source/test, 4 MODIFY, 2 OPTIONAL fixtures)
**Analogs found:** 8 / 8 (every file has a closest analog in the existing codebase — Phase 50 surface is a near-perfect blueprint)

---

## File Classification

| File | Status | Role | Data flow | Closest analog | Match quality |
|------|--------|------|-----------|----------------|---------------|
| `src/canvas/edge-label-sync-service.ts` | MODIFY | service (Obsidian-bound) | event-driven (vault.modify → debounced reconcile → write + dispatch) | self (Phase 50) | exact |
| `src/graph/edge-label-reconciler.ts` | MODIFY | pure module / reconciler | transform (Graph → diffs+nodeChanges) | self (Phase 50, Answer arm) | exact |
| `src/views/editor-panel-view.ts` | MODIFY | view (ItemView) | request-response (form ↔ canvas, plus new inbound subscription) | self + Phase 50 wiring | exact |
| `src/__tests__/edge-label-reconciler.test.ts` | EXTEND | unit test (pure) | n/a — vitest | self (existing answer-kind describe blocks) | exact |
| `src/__tests__/canvas-write-back.test.ts` | EXTEND | unit test | n/a — vitest | self (lines 202-327, saveLiveBatch suite) | exact |
| `src/__tests__/edge-label-sync-service.test.ts` | NEW | unit test (service) | n/a — vitest | `src/__tests__/canvas-write-back.test.ts:206-244` (CanvasViewInternal mock pattern) + `src/__tests__/edge-label-reconciler.test.ts:12-13` (fixture loader) | role-match |
| `src/__tests__/views/editor-panel-canvas-sync.test.ts` | NEW | unit test (view, FakeNode) | n/a — vitest | `src/__tests__/editor-panel-forms.test.ts:31-166` (FakeNode + Setting prototype mock + buildKindForm direct call) | role-match |
| `src/__tests__/fixtures/snippet-cold-open-migration.canvas` | NEW (optional) | fixture (canvas JSON) | n/a | `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` | exact |
| `src/__tests__/fixtures/branching-snippet-multi-incoming.canvas` | NEW (optional) | fixture (canvas JSON) | n/a | `src/__tests__/fixtures/branching-multi-incoming.canvas` | exact |

> Note on naming: RESEARCH.md proposes `edge-label-sync-service-dispatch.test.ts` and `editor-panel-canvas-patch.test.ts`. VALIDATION.md row 63-02-* / 63-03-* fixed the canonical names to `edge-label-sync-service.test.ts` and `views/editor-panel-canvas-sync.test.ts`. Planner: use VALIDATION.md names.

> Note on fixture naming: VALIDATION.md says `snippet-cold-open-migration.canvas` and `branching-snippet-multi-incoming.canvas`. RESEARCH.md uses `snippet-label-edge-mismatch.canvas`. Use VALIDATION names.

---

## Pattern Assignments

### MODIFY `src/graph/edge-label-reconciler.ts` (pure reconciler)

**Closest analog: SELF — extend the Answer arm to a parallel Snippet arm in the same loop.**

**Why this is the cleanest extension:** The existing function is a single `for (const node of graph.nodes.values())` pass that bails on `if (node.kind !== 'answer') continue` (line 54). Phase 63 D-04 is literally "drop that filter and add a sister `if (node.kind === 'snippet')` block with identical edge-wins logic but reading/writing `snippetLabel` instead of `displayLabel`."

**Current shape of `EdgeLabelDiff` and `ReconcileResult` (`edge-label-reconciler.ts:12-21`):**
```typescript
export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
}

export interface ReconcileResult {
  diffs: EdgeLabelDiff[];
  newDisplayLabelByAnswerId: Map<string, string | undefined>;
}
```

**Target shape (CONTEXT D-04 + RESEARCH §"Pattern: discriminated EdgeLabelDiff"):**
```typescript
export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
  kind: 'answer' | 'snippet';   // Phase 63 NEW
}

// CONTEXT D-04 says "extend EdgeLabelDiff to discriminated union with kind".
// For node-side label changes, prefer ONE of these two shapes (Discretion):
//   A. Add a parallel `newSnippetLabelBySnippetId: Map<string, string | undefined>`
//      to ReconcileResult — minimal disruption to Phase 50 callers.
//   B. Replace `newDisplayLabelByAnswerId` with
//      `nodeChanges: Array<{ nodeId, newLabel, kind }>` — symmetrical to diffs[],
//      requires updating sync-service writer to map by kind.
// Recommendation (RESEARCH §"Open Questions" #2): option B (single discriminated
// list) keeps the writer in edge-label-sync-service.ts honest and eliminates the
// "two parallel maps" smell. Either is acceptable per CONTEXT.
```

**Edge-wins core to mirror 1:1 (`edge-label-reconciler.ts:53-89`):**
```typescript
for (const node of graph.nodes.values()) {
  if (node.kind !== 'answer') continue;     // ← line 54: filter the planner must drop
  const answer: AnswerNode = node;

  const incomingEdges: RPEdge[] = graph.edges.filter(
    (e) => e.toNodeId === answer.id,
  );

  // D-04 step 1: first non-empty incoming label
  const firstLabeled = incomingEdges.find((e) => isLabeledEdge(e));
  const edgePick = firstLabeled?.label?.trim() || undefined;

  // D-04 step 2: fallback to trimmed displayLabel
  const displayTrim = answer.displayLabel?.trim() || undefined;
  const pickedLabel: string | undefined = edgePick ?? displayTrim;

  // D-04 step 3: propagate displayLabel divergence
  if (displayTrim !== pickedLabel) {
    newDisplayLabelByAnswerId.set(answer.id, pickedLabel);
  }

  // D-04 step 4: re-sync each diverging edge
  for (const e of incomingEdges) {
    const currentTrim = e.label?.trim() || undefined;
    if (currentTrim !== pickedLabel) {
      diffs.push({
        edgeId: e.id,
        currentLabel: e.label,
        targetLabel: pickedLabel,
      });   // Phase 63 will need: kind: 'answer' here
    }
  }
}
```

**Snippet arm planner must add (mirror the above with `snippet` substitutions):**
- Read `node.snippetLabel?.trim() || undefined` (instead of `displayLabel`)
- Write into the snippet-side map / nodeChanges entry
- Stamp every emitted `EdgeLabelDiff` with `kind: 'snippet'`

**SnippetNode shape (`graph-model.ts:83-95`)** — confirms `snippetLabel?: string` is already on the node, no graph-model change needed:
```typescript
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;
  snippetLabel?: string;        // ← Phase 63 reads this
  radiprotocol_snippetSeparator?: 'newline' | 'space';
  radiprotocol_snippetPath?: string;
}
```

**Doc-comment to copy verbatim (with `Snippet` substitutions):** `edge-label-reconciler.ts:23-48` — the JSDoc on `reconcileEdgeLabels` must be extended to mention the snippet pass and Phase 63 D-04. Do not delete existing Phase 50 D-04/D-07/D-18 paragraphs (CLAUDE.md never-delete rule).

**Touchpoints:**
- Insert snippet arm at line 89 (after the closing `}` of the answer arm, BEFORE `return { diffs, newDisplayLabelByAnswerId };` line 91).
- If picking option B above, also rename the return-shape — touches lines 18-21 of this file AND line 96 of `edge-label-sync-service.ts` AND line 99 of same file (the `if (diffs.length === 0 && newDisplayLabelByAnswerId.size === 0)` short-circuit).

**Read-first for executor:**
1. `src/graph/edge-label-reconciler.ts` (entire 92 lines — small file)
2. `src/graph/graph-model.ts:83-95` (SnippetNode shape)
3. `src/graph/node-label.ts:40-42` (`isLabeledEdge` predicate — already imported)

---

### MODIFY `src/canvas/edge-label-sync-service.ts` (Obsidian-bound service)

**Closest analog: SELF — extend `reconcile()` with snippet writer + node-text snapshot diff + dispatch.**

**Three additions (CONTEXT D-04 + D-12 + EDITOR-05 surface from RESEARCH §"Inbound dispatch protocol"):**

#### A) Snippet writer (D-04)

**Current `nodeEdits` builder (`edge-label-sync-service.ts:102-108`):**
```typescript
const nodeEdits: Array<{ nodeId: string; edits: Record<string, unknown> }> = [];
for (const [answerId, newLabel] of newDisplayLabelByAnswerId) {
  nodeEdits.push({
    nodeId: answerId,
    edits: { radiprotocol_displayLabel: newLabel }, // undefined → D-08 strip-key
  });
}
```

**Target (matches the discriminated nodeChanges shape from RESEARCH §"Pattern: discriminated EdgeLabelDiff"):**
```typescript
// Phase 63: route to radiprotocol_displayLabel vs radiprotocol_snippetLabel by kind.
const nodeEdits = nodeChanges.map(c => ({
  nodeId: c.nodeId,
  edits: c.kind === 'answer'
    ? { radiprotocol_displayLabel: c.newLabel }
    : { radiprotocol_snippetLabel: c.newLabel },
}));
```

The Strategy A fallback (`edge-label-sync-service.ts:144-157`) needs no per-kind switch — it iterates `Object.entries(edits)` and treats `undefined` as strip-key, which works for both keys.

#### B) Snapshot tracking + dispatch (D-12 + EDITOR-05)

**Add the two private fields (placement: alongside `debounceTimers` line 36):**
```typescript
// Phase 63 D-12 — broadcast bus for canvas-changed-for-node.
private readonly bus = new EventTarget();
// Phase 63 — snapshot baseline for "node text fields changed since last reconcile" (EDITOR-05).
private readonly lastSnapshotByFilePath = new Map<string, Map<string, NodeFieldsSnapshot>>();
```

**Subscribe API (RESEARCH §"Inbound dispatch protocol"):**
```typescript
subscribe(handler: (detail: CanvasChangedForNodeDetail) => void): () => void {
  const wrapped = (e: Event) => {
    handler((e as CustomEvent<CanvasChangedForNodeDetail>).detail);
  };
  this.bus.addEventListener('canvas-changed-for-node', wrapped);
  return () => this.bus.removeEventListener('canvas-changed-for-node', wrapped);
}
```

**Dispatch sites — AFTER write success (CRITICAL — see RESEARCH Pitfall §"Dispatch ПОСЛЕ write success"):**
- After `if (savedLive) return;` (currently `edge-label-sync-service.ts:121`) — Pattern B path
- After `await this.app.vault.modify(...)` (currently line 159) — Strategy A path
- ALSO emit when *only node-text fields changed* (no diffs, no nodeChanges) — RESEARCH says reconciler must run a node-text snapshot pass independent of edge reconcile. This means the `if (diffs.length === 0 && newDisplayLabelByAnswerId.size === 0) return;` short-circuit (line 99) needs adjustment: short-circuit only if BOTH the edge reconcile AND the node-text snapshot diff are empty.

**Snapshot shape (RESEARCH lines 254-264):**
```typescript
interface NodeFieldsSnapshot {
  questionText?: string;
  answerText?: string;
  displayLabel?: string;
  content?: string;
  headerText?: string;
  snippetLabel?: string;
  kind: RPNodeKind | null;
}

interface CanvasChangedForNodeDetail {
  filePath: string;
  nodeId: string;
  changeKind: 'fields' | 'nodeType' | 'deleted';
  fieldUpdates?: Partial<Record<
    | 'radiprotocol_questionText'
    | 'radiprotocol_answerText'
    | 'radiprotocol_displayLabel'
    | 'radiprotocol_content'
    | 'radiprotocol_headerText'
    | 'radiprotocol_snippetLabel',
    string | undefined
  >>;
  newKind?: RPNodeKind | null;
}
```

**Read node text from `RPNode` (already resolved by parser — RESEARCH "Мини-гочча" line 215):** read `node.questionText`, `node.answerText`, `node.content`, `node.headerText`, `node.snippetLabel`, `node.displayLabel` directly from `RPNode` after `parser.parse(content, filePath)` at line 91. DO NOT re-parse the raw `radiprotocol_*` properties — the parser's `getString(props, 'radiprotocol_questionText', raw.text ?? '')` fallback is already applied.

#### C) Snapshot cleanup (Open Question #4 from RESEARCH)

**Pattern source (`edge-label-sync-service.ts:48-55`)** — the existing `register()` shows how to plug into `vault.on(...)`:
```typescript
register(): void {
  this.plugin.registerEvent(
    this.app.vault.on('modify', (file) => {
      if (!(file instanceof TFile) || file.extension !== 'canvas') return;
      this.scheduleReconcile(file.path);
    })
  );
}
```

**Add two more `registerEvent` calls (VALIDATION row 63-02-03):**
```typescript
this.plugin.registerEvent(
  this.app.vault.on('rename', (file, oldPath) => {
    if (oldPath.endsWith('.canvas')) {
      this.lastSnapshotByFilePath.delete(oldPath);
    }
  })
);
this.plugin.registerEvent(
  this.app.vault.on('delete', (file) => {
    if (file.path.endsWith('.canvas')) {
      this.lastSnapshotByFilePath.delete(file.path);
    }
  })
);
```

Also clear `lastSnapshotByFilePath` in `destroy()` (currently line 166-170) — add `this.lastSnapshotByFilePath.clear();` next to the existing `this.debounceTimers.clear();`.

**Touchpoints:**
- Lines 30-42: declare `bus`, `lastSnapshotByFilePath`, possibly hoist Detail/Snapshot interfaces
- Line 55 (after `register()` body): add rename/delete subscriptions
- Line 96-99: extend short-circuit to consider node-text snapshot diff
- Lines 102-112: replace `nodeEdits`/`edgeEdits` builders with kind-aware versions
- After line 121 AND after line 159: dispatch `canvas-changed-for-node`
- After line 92 (`if (!parsed.success) return`): handle deleted-nodes case (snapshot has nodeId, parsed graph doesn't) → dispatch `changeKind: 'deleted'` then snapshot.delete
- Detect `changeKind: 'nodeType'`: when snapshot.kind !== current.kind for same nodeId → dispatch with `newKind`
- Lines 166-170: extend `destroy()` to clear snapshot map

**`collectIncomingEdgeEdits` helper at lines 177-191** — Phase 63 D-04 says reconciler does NOT outbound-write snippet edges directly from `saveNodeEdits` (RESEARCH §`editor-panel-view.ts:175-326` outbound). This helper currently early-returns on `if (!answerNode || answerNode.kind !== 'answer')`. Planner: do NOT extend this helper to handle `'snippet'` (D-04 explicitly says Snippet outbound rides on the reconciler async path, not on `saveNodeEdits`).

**Read-first for executor:**
1. `src/canvas/edge-label-sync-service.ts` (entire 191 lines)
2. `src/graph/edge-label-reconciler.ts` (final 92-line shape, post-Plan-01)
3. `src/graph/canvas-parser.ts:251-278` (Snippet parser arm — confirms which props feed snippetLabel)
4. `src/graph/graph-model.ts:55-95` (RPNode union — confirms which `*Text`/`*Label` fields exist on which kind)
5. `src/canvas/canvas-live-editor.ts:148-205` (`saveLiveBatch` signature — already accepts edgeEdits, no change)
6. `src/main.ts:14, 89, 115-116, 221` (service wiring — confirms lifecycle hooks)

---

### MODIFY `src/views/editor-panel-view.ts` (ItemView)

**Closest analog: SELF — add private fields + `applyCanvasPatch` method + `onOpen` subscription + per-textarea blur handler in `renderGrowableTextarea`.**

**Existing `onOpen` (`editor-panel-view.ts:45-58`):**
```typescript
async onOpen(): Promise<void> {
  this.renderIdle();
  this.attachCanvasListener();

  // Re-attach when user switches active leaf (e.g. opens a second canvas)
  type EventRef = import('obsidian').EventRef;
  this.registerEvent(
    (this.plugin.app.workspace as unknown as {
      on(event: 'active-leaf-change', handler: () => void): EventRef;
    }).on('active-leaf-change', () => {
      this.attachCanvasListener();
    })
  );
}
```

**Pattern to add inside `onOpen` (RESEARCH §"Code Examples" line 745-756):**
```typescript
// Phase 63 — subscribe to canvas-changed-for-node events from EdgeLabelSyncService.
const unsubscribe = this.plugin.edgeLabelSyncService.subscribe(
  (detail) => this.applyCanvasPatch(detail),
);
this.register(unsubscribe);   // Component.register accepts () => void teardown
```

**`onClose` currently (`editor-panel-view.ts:60-62`):**
```typescript
async onClose(): Promise<void> {
  this.contentEl.empty();
}
```

**Add (do NOT delete the existing `contentEl.empty()`):**
```typescript
this.formFieldRefs.clear();
this.pendingCanvasUpdate.clear();
```

**Private fields to add (placement: alongside `pendingEdits` line 19):**
```typescript
// Phase 63 D-08 — DOM ref per pendingEdits-key for inbound DOM patching.
private formFieldRefs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
// Phase 63 D-07 — patch values stashed during in-flight focus, applied on blur.
private pendingCanvasUpdate = new Map<string, string | undefined>();
```

**Where to populate `formFieldRefs` — `renderGrowableTextarea` already returns the textarea (`editor-panel-view.ts:443-488`):**
```typescript
private renderGrowableTextarea(
  container: HTMLElement,
  options: {
    blockClass: string;
    textareaClass?: string;
    label: string;
    desc: string;
    value: string;
    onInput: (value: string) => void;
  }
): HTMLTextAreaElement {
  // ... builds textarea ...
  return textarea;
}
```

The 5 callers in `buildKindForm` (lines 519, 557, 591, 640, 720) already capture nothing. Planner pattern: each call site assigns the return to `const ta = this.renderGrowableTextarea(...)` then `this.formFieldRefs.set('radiprotocol_questionText', ta)` (and equivalents — see Field Key Vocabulary below). Also wire blur:
```typescript
this.registerDomEvent(ta, 'blur', () => {
  queueMicrotask(() => {
    const pending = this.pendingCanvasUpdate.get('radiprotocol_questionText');
    if (pending !== undefined) {
      this.patchTextareaValue(ta, pending);
      this.pendingCanvasUpdate.delete('radiprotocol_questionText');
    }
  });
});
```

For `addText` Setting (Answer displayLabel `editor-panel-view.ts:550-556`), capture `text.inputEl` from the callback:
```typescript
.addText(t => {
  t.setValue((nodeRecord['radiprotocol_displayLabel'] as string | undefined) ?? '')
    .onChange(v => { /* existing */ });
  this.formFieldRefs.set('radiprotocol_displayLabel', t.inputEl);
  this.registerDomEvent(t.inputEl, 'blur', /* same blur pattern */);
});
```

**Field key vocabulary (CRITICAL — RESEARCH §"Field key vocabulary" verifies these against actual code):**

| Node kind | Key | Captured at line | text-mirror? |
|-----------|-----|------------------|--------------|
| Question | `radiprotocol_questionText` | 519-532 | yes (line 530 also writes `text`) |
| Answer | `radiprotocol_answerText` | 557-569 | yes (line 567) |
| Answer | `radiprotocol_displayLabel` | 547-556 | no |
| Text-block | **`radiprotocol_content`** (NOT `radiprotocol_text`) | 591-603 | yes (line 601) |
| Loop | `radiprotocol_headerText` | 640-652 | yes (line 650) |
| Snippet | `radiprotocol_snippetLabel` | 720-728 | no |

> **Planner gotcha:** CONTEXT D-08/D-11 says "text-block `text`". The actual pendingEdits key in `editor-panel-view.ts:600` is `radiprotocol_content`. Use `radiprotocol_content`. Reconciler snapshot must also key off `node.content`, not raw `radiprotocol_text`.

**`applyCanvasPatch` method to add — full implementation from RESEARCH §"Code Examples" lines 786-825:**
```typescript
private applyCanvasPatch(detail: CanvasChangedForNodeDetail): void {
  if (detail.filePath !== this.currentFilePath) return;
  if (detail.nodeId !== this.currentNodeId) return;

  queueMicrotask(() => {
    if (detail.changeKind === 'deleted') {
      // D-10
      this.pendingEdits = {};
      this.currentNodeId = null;
      this.currentFilePath = null;
      this.formFieldRefs.clear();
      this.pendingCanvasUpdate.clear();
      this.renderIdle();
      return;
    }
    if (detail.changeKind === 'nodeType') {
      // D-09
      this.pendingEdits = {};
      this.formFieldRefs.clear();
      this.pendingCanvasUpdate.clear();
      void this.renderNodeForm(this.currentFilePath!, this.currentNodeId!);
      return;
    }
    // D-08 fields patch
    for (const [key, value] of Object.entries(detail.fieldUpdates ?? {})) {
      const el = this.formFieldRefs.get(key);
      if (!el || !el.isConnected) continue;       // Pitfall 2 defensive
      const focused = el.ownerDocument?.activeElement === el;
      if (focused) {
        // D-05/D-07 stash
        this.pendingCanvasUpdate.set(key, value);
        continue;
      }
      this.patchTextareaValue(el, value ?? '');
    }
  });
}

private patchTextareaValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  el.value = value;
  if (el instanceof HTMLTextAreaElement && el.style) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
  // INVARIANT: do NOT dispatch synthetic 'input' event (RESEARCH Pitfall 1) —
  // that would push the value back into pendingEdits and trigger an autosave loop.
  // INVARIANT: do NOT touch this.pendingEdits (RESEARCH Pitfall 6) — outbound
  // saves only flush user-typed values; canvas patches are DOM-only.
}
```

**Existing `loadNode` (`editor-panel-view.ts:163-173`)** — add `this.formFieldRefs.clear()` and `this.pendingCanvasUpdate.clear()` next to the existing `this.pendingEdits = {}` (line 171).

**Existing `renderNodeForm` (`editor-panel-view.ts:328-378`)** — already does `this.contentEl.empty()` and `this.pendingEdits = {}` (line 332). Add `this.formFieldRefs.clear(); this.pendingCanvasUpdate.clear();` adjacent.

**Re-entrancy pattern reference (`editor-panel-view.ts:415` — Phase 42 WR-01/WR-02):**
```typescript
queueMicrotask(() => {
  this.renderForm(mergedRecord, nextKind);
});
```
The `applyCanvasPatch` body already wraps in `queueMicrotask` (per CONTEXT §code_context "Phase 42 WR-01") — same defensive pattern.

**Touchpoints:**
- Line 19-34 (private fields): add `formFieldRefs`, `pendingCanvasUpdate`
- Line 45-58 (`onOpen`): add subscribe + register
- Line 60-62 (`onClose`): add clears
- Line 163-173 (`loadNode`): add clears
- Line 332 (`renderNodeForm` head): add clears
- Lines 519, 557, 591, 640, 720 (`renderGrowableTextarea` callers): capture return + register blur + populate map
- Line 550-556 (`addText` for displayLabel): capture `t.inputEl` + register blur + populate map
- New private method `applyCanvasPatch` (place near `saveNodeEdits` line 175 or near `renderForm` line 380)
- New private helper `patchTextareaValue` (place near `renderGrowableTextarea` line 443)

**CLAUDE.md compliance reminder:** every addition above must be marked `// Phase 63: ...` and must NOT delete or modify any code authored by Phase 28/42/48/50/51/64. The shared file `editor-panel-view.ts` is exactly the kind of accumulated file the CLAUDE.md never-delete rule was written for.

**Read-first for executor:**
1. `src/views/editor-panel-view.ts:1-180` (imports, fields, lifecycle, saveNodeEdits head)
2. `src/views/editor-panel-view.ts:328-490` (renderNodeForm, renderForm, renderGrowableTextarea)
3. `src/views/editor-panel-view.ts:490-748` (buildKindForm — every kind arm)
4. `src/canvas/edge-label-sync-service.ts:177-191` (collectIncomingEdgeEdits — for reference)
5. RESEARCH §"EditorPanelView lifecycle map" + §"Pitfalls" 1, 2, 4, 5, 6, 9
6. `src/main.ts:89, 115` (confirm `plugin.edgeLabelSyncService` is the wired field name)

---

### EXTEND `src/__tests__/edge-label-reconciler.test.ts`

**Closest analog: SELF — add a new `describe('reconcileEdgeLabels — snippet edge-wins (Phase 63)')` block mirroring the answer describe blocks at lines 72-119.**

**Current describe-block structure (verbatim from `edge-label-reconciler.test.ts`):**
```typescript
describe('reconcileEdgeLabels — D-04 edge-wins', () => {                  // line 72
  it('picks first non-empty incoming label when displayLabel differs', ...)
  it('multi-incoming: re-syncs every OTHER incoming edge to picked label', ...)
  it('displayLabel wins when no incoming edge is labeled', ...)
});
describe('reconcileEdgeLabels — D-07 idempotency', () => {                 // line 121
  it('returns empty diffs + empty map when all labels already match', ...)
});
describe('reconcileEdgeLabels — D-08 / D-09 clearing', () => {             // line 144
  it('all incoming edges empty + displayLabel empty → fully idempotent', ...)
  it('all incoming edges empty + displayLabel present → diff propagates ...', ...)
  it('all incoming edges whitespace-only label → treated as unlabeled', ...)
});
describe('reconcileEdgeLabels — fixture: displayLabel-edge-mismatch', ...)  // line 191
describe('reconcileEdgeLabels — fixture: branching-multi-incoming', ...)    // line 206
```

**`makeGraph` helper to extend (`edge-label-reconciler.test.ts:21-70`):** currently builds Question + Answer nodes only. Phase 63 needs Snippet nodes too. Two options:
- A) Add a `snippets?: Array<{ id: string; snippetLabel?: string; subfolderPath?: string }>` param mirroring `answers`
- B) Build a small new helper `makeSnippetGraph` next to `makeGraph`

Recommendation: option A keeps the file's single helper-shape consistent.

**Snippet describe-block to add (mirror existing structure — VALIDATION rows 63-01-01, 63-01-02):**
```typescript
describe('reconcileEdgeLabels — snippet edge-wins (Phase 63)', () => {
  it('picks first non-empty incoming label when snippetLabel differs', () => {
    const graph = makeGraph({
      questions: [{ id: 'q1' }],
      snippets: [{ id: 's1', snippetLabel: 'Старое' }],
      edges: [{ id: 'e1', fromNodeId: 'q1', toNodeId: 's1', label: 'Новое' }],
    });
    const result = reconcileEdgeLabels(graph);
    // Either result.newSnippetLabelBySnippetId.get('s1') === 'Новое'
    // OR result.nodeChanges contains { nodeId: 's1', newLabel: 'Новое', kind: 'snippet' }
    // depending on shape choice in Plan 01.
    // diffs[] for the now-matching edge: 0 entries.
    expect(result.diffs.filter(d => d.kind === 'snippet')).toHaveLength(0);
  });

  it('cold-open: snippetLabel="X" + edge.label=undefined → diff propagates X onto edge', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('snippet-cold-open-migration.canvas'),
      'snippet-cold-open-migration.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const result = reconcileEdgeLabels(parseResult.graph);
    const snippetDiffs = result.diffs.filter(d => d.kind === 'snippet');
    expect(snippetDiffs).toHaveLength(1);
    expect(snippetDiffs[0]!.targetLabel).toBe('Брюшной отдел');
  });

  it('multi-incoming: edge-wins picks first labeled, resyncs sibling edges + node', () => {
    const parseResult = new CanvasParser().parse(
      loadFixture('branching-snippet-multi-incoming.canvas'),
      'branching-snippet-multi-incoming.canvas',
    );
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const result = reconcileEdgeLabels(parseResult.graph);
    // pickedLabel === 'Вариант X' (first labeled — e1)
    // diffs[].kind === 'snippet' for e2 only
    const snippetDiffs = result.diffs.filter(d => d.kind === 'snippet');
    expect(snippetDiffs).toHaveLength(1);
    expect(snippetDiffs[0]!.edgeId).toBe('e2');
    expect(snippetDiffs[0]!.targetLabel).toBe('Вариант X');
  });

  it('mixed Answer+Snippet incoming: both kinds reconcile in one pass', () => {
    // One Question fans out to one Answer + one Snippet.
    // Both edges should appear in diffs[] with appropriate `kind` discriminator.
    // Asserts D-04 single-pass behaviour.
  });

  it('idempotency: snippet kind contributes to D-07 short-circuit', () => {
    // All snippet edges already match snippetLabel → reconciler returns
    // structurally empty result (no diffs, no nodeChanges) for the snippet
    // arm too — same self-terminating modify-event loop guard.
  });
});
```

**Touchpoints:**
- Lines 14-19 (`MakeGraphParams` type): extend with `snippets?: Array<...>`
- Lines 21-70 (`makeGraph` body): extend node-builder loop for snippet nodes
- After line 226 (after the existing "deterministic iteration order" describe): append the new Phase 63 describe block

**Read-first for executor:**
1. `src/__tests__/edge-label-reconciler.test.ts` (entire 260 lines)
2. `src/__tests__/fixtures/branching-multi-incoming.canvas` (analog for new snippet fixture)
3. `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` (analog for cold-open fixture)
4. The fixture files this plan creates (after Plan 01 Wave 0 lays them down)

---

### EXTEND `src/__tests__/canvas-write-back.test.ts`

**Closest analog: SELF lines 202-327 — the `PHASE-50 CanvasLiveEditor edge writes` describe block.**

**Pattern to mirror — `buildMockLiveEditor` helper (`canvas-write-back.test.ts:209-244`):**
```typescript
function buildMockLiveEditor(params: {
  filePath: string;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}): {
  editor: CanvasLiveEditor;
  setDataSpy: ReturnType<typeof vi.fn>;
  requestSaveSpy: ReturnType<typeof vi.fn>;
} {
  const data = { nodes: [...params.nodes], edges: [...params.edges] };
  const setDataSpy = vi.fn((next: { nodes: unknown[]; edges: unknown[] }) => {
    data.nodes = next.nodes as Array<Record<string, unknown>>;
    data.edges = next.edges as Array<Record<string, unknown>>;
  });
  // ... mockView with file, canvas { getData, setData, requestSave, nodes }
  // ... mockApp with workspace.getLeavesOfType
  const editor = new CanvasLiveEditor(mockApp as any);
  return { editor, setDataSpy, requestSaveSpy };
}
```

**Extension scope (VALIDATION row 63-01-03):** the test must verify that when `EdgeLabelDiff.kind === 'snippet'`, the writer routes `radiprotocol_snippetLabel` (not `radiprotocol_displayLabel`) into the node edits, and that snippet-edge label writes use the same `saveLiveBatch` atomic path.

**New tests to add (mirror lines 271-326):**
```typescript
it('saveLiveBatch routes snippet-kind nodeChanges to radiprotocol_snippetLabel (Phase 63 D-04)', async () => {
  const { editor, setDataSpy } = buildMockLiveEditor({
    filePath: 'test.canvas',
    nodes: [
      { id: 'n-q', radiprotocol_nodeType: 'question' },
      { id: 'n-snip', radiprotocol_nodeType: 'snippet', radiprotocol_snippetLabel: 'Старое' },
    ],
    edges: [{ id: 'e1', fromNode: 'n-q', toNode: 'n-snip', label: 'Старое' }],
  });
  const ok = await editor.saveLiveBatch(
    'test.canvas',
    [{ nodeId: 'n-snip', edits: { radiprotocol_snippetLabel: 'Новое' } }],
    [{ edgeId: 'e1', label: 'Новое' }],
  );
  expect(ok).toBe(true);
  expect(setDataSpy).toHaveBeenCalledTimes(1);   // D-14 atomic
  const written = setDataSpy.mock.calls[0]![0] as {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  expect(written.nodes.find(n => n.id === 'n-snip')!['radiprotocol_snippetLabel']).toBe('Новое');
  expect(written.edges.find(e => e.id === 'e1')!['label']).toBe('Новое');
});

it('saveLiveBatch strips radiprotocol_snippetLabel when value is undefined (D-08 symmetry)', async () => {
  // Mirror the displayLabel-undefined-strip test for snippet kind.
});
```

**Touchpoints:**
- Append after line 326 (closing `});` of last `it` in the existing PHASE-50 describe), inside the same describe block, OR open a new `describe('PHASE-63 CanvasLiveEditor snippet edge writes', ...)` block — Discretion.

**Read-first for executor:**
1. `src/__tests__/canvas-write-back.test.ts:202-327` (entire Phase 50 describe block — the template)
2. `src/canvas/canvas-live-editor.ts:148-234` (`saveLiveBatch` implementation — confirms it accepts arbitrary `edits` Record so snippet keys work without source change)

---

### NEW `src/__tests__/edge-label-sync-service.test.ts`

**Closest analog mix:**
- `src/__tests__/canvas-write-back.test.ts:206-244` for the `buildMockLiveEditor` / mockApp scaffold (vault.modify, workspace.getLeavesOfType, canvasLiveEditor.saveLiveBatch mocking)
- `src/__tests__/edge-label-reconciler.test.ts:1-13` for the fixture-loader pattern (`loadFixture('xxx.canvas')`)
- The service itself (`src/canvas/edge-label-sync-service.ts:32-191`) for the constructor signature `new EdgeLabelSyncService(app, plugin)`

**Setup pattern to assemble (compose the two analogs above):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EdgeLabelSyncService } from '../canvas/edge-label-sync-service';

vi.mock('obsidian');

const fixturesDir = path.join(__dirname, 'fixtures');
const loadFixture = (n: string) => fs.readFileSync(path.join(fixturesDir, n), 'utf-8');

function buildService(canvasContent: string): {
  service: EdgeLabelSyncService;
  saveLiveBatchSpy: ReturnType<typeof vi.fn>;
  vaultModifySpy: ReturnType<typeof vi.fn>;
  registerEventSpy: ReturnType<typeof vi.fn>;
  vaultHandlers: Map<string, (file: unknown, oldPath?: string) => void>;
} {
  const vaultHandlers = new Map<string, (file: unknown, oldPath?: string) => void>();
  const saveLiveBatchSpy = vi.fn().mockResolvedValue(true);
  const vaultModifySpy = vi.fn().mockResolvedValue(undefined);
  const registerEventSpy = vi.fn((ref: unknown) => ref);
  const mockApp = {
    vault: {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        vaultHandlers.set(event, handler);
        return { event };
      },
      getAbstractFileByPath: () => ({ path: 'test.canvas' }),  // TFile mock
      read: vi.fn().mockResolvedValue(canvasContent),
      modify: vaultModifySpy,
    },
  };
  const mockPlugin = {
    app: mockApp,
    canvasLiveEditor: {
      getCanvasJSON: () => canvasContent,
      saveLiveBatch: saveLiveBatchSpy,
    },
    registerEvent: registerEventSpy,
  };
  const service = new EdgeLabelSyncService(mockApp as any, mockPlugin as any);
  service.register();
  return { service, saveLiveBatchSpy, vaultModifySpy, registerEventSpy, vaultHandlers };
}
```

**Test rows (VALIDATION 63-02-01 .. 63-02-03):**
```typescript
describe('EdgeLabelSyncService — dispatch contract (Phase 63 D-12)', () => {
  it('dispatches canvas-changed-for-node after reconcile produces edge diffs', async () => {
    // Use displayLabel-edge-mismatch.canvas — Phase 50 fixture, edge "Y" wins.
    // Assert subscribe-handler called with detail.fieldUpdates['radiprotocol_displayLabel'] === 'Y'.
  });

  it('does not dispatch when reconcile is a no-op (D-07 idempotency short-circuit)', async () => {
    // Use a canvas where every edge label already matches displayLabel.
    // Subscribe handler must not be called.
  });

  it('routes snippet-kind nodeChanges to radiprotocol_snippetLabel in fieldUpdates', async () => {
    // Use snippet-cold-open-migration.canvas. Assert detail.fieldUpdates
    // contains 'radiprotocol_snippetLabel' (not displayLabel).
  });
});

describe('EdgeLabelSyncService — node-text snapshot (Phase 63 EDITOR-05)', () => {
  it('detects questionText change between two reconcile passes and dispatches', async () => {
    // Pass 1: parse with questionText='Q1'. Pass 2: parse with questionText='Q1 edited'.
    // Subscribe handler called with detail.fieldUpdates['radiprotocol_questionText'] === 'Q1 edited'.
  });

  it('does not dispatch when no fields changed since last snapshot', async () => {
    // Two consecutive reconcile passes with identical content → 0 dispatches after the first.
  });

  it('detects nodeType change → dispatches changeKind:"nodeType"', async () => {
    // Pass 1: kind='question'. Pass 2: kind='answer'. detail.changeKind === 'nodeType', detail.newKind === 'answer'.
  });

  it('detects node deletion → dispatches changeKind:"deleted"', async () => {
    // Pass 1: includes 'n-q1'. Pass 2: 'n-q1' removed from canvas. detail.changeKind === 'deleted'.
  });
});

describe('EdgeLabelSyncService — snapshot cleanup (Phase 63 D-12)', () => {
  it('removes snapshot for filePath when vault.on("rename") fires (old → new)', async () => {
    // Trigger rename handler captured in vaultHandlers; assert internal snapshot map cleared.
    // Inspect via private field cast OR by observing that next reconcile re-builds snapshot from scratch.
  });

  it('removes snapshot for filePath when vault.on("delete") fires', async () => {
    // Same pattern.
  });

  it('destroy() clears all snapshots and timers (T-11-04 leak prevention)', () => {
    // Mirror the existing destroy() shape in edge-label-sync-service.ts:166-170.
  });
});
```

**Read-first for executor:**
1. `src/canvas/edge-label-sync-service.ts` (the file under test — full 191 lines)
2. `src/__tests__/canvas-write-back.test.ts:206-244` (mockApp / saveLiveBatch mocking)
3. `src/__tests__/edge-label-reconciler.test.ts:12-13, 191-220` (fixture loader + how to assert against `parseResult.graph`)
4. `vitest.config.ts` (confirm `environment: 'node'`, `obsidian` alias to `__mocks__/obsidian.ts`)
5. `src/__mocks__/obsidian.ts` (confirm what `vi.mock('obsidian')` auto-stubs vs. what the test must hand-roll — `TFile` is NOT exported by the mock, so the test uses bare object `{ path: 'test.canvas' }` and the service's `if (!(file instanceof TFile))` check will fail unless the mock provides TFile or the test passes a stub that satisfies `instanceof TFile`)

**Gotcha:** The service's `register()` does `if (!(file instanceof TFile) || file.extension !== 'canvas') return;` (line 51). The test must either (a) drive the reconcile via `(service as any).reconcile('test.canvas')` directly, bypassing the modify subscription, or (b) extend `__mocks__/obsidian.ts` with a `TFile` class. Option (a) is simpler and matches the pattern in `canvas-write-back.test.ts` which calls editor methods directly.

---

### NEW `src/__tests__/views/editor-panel-canvas-sync.test.ts`

**Closest analog mix:**
- `src/__tests__/editor-panel-forms.test.ts:31-166` — Setting prototype mock + FakeNode + buildKindForm direct call
- `src/__tests__/views/runner-snippet-sibling-button.test.ts:37-101, 219-225` — FakeNode shape and `registerDomEvent` patching

**Setup pattern to compose:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorPanelView } from '../../views/editor-panel-view';
import type RadiProtocolPlugin from '../../main';

vi.mock('obsidian');
vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class { mount = vi.fn().mockResolvedValue(undefined); unmount = vi.fn(); },
}));

// FakeNode + style tracking lifted from editor-panel-forms.test.ts:100-145.
// activeElement patching lifted from RESEARCH §"Test harness conventions" lines 391-396:
const globalAny = globalThis as unknown as { document: { activeElement: HTMLElement | null } };

beforeEach(() => {
  installSettingPrototypeMock();
  resetDomCaptures();
  globalAny.document = { activeElement: null };  // RESEARCH line 393
});

function makeView(): EditorPanelView {
  // Same shape as editor-panel-forms.test.ts:149-166, plus plugin.edgeLabelSyncService stub.
  const subscribeSpy = vi.fn().mockReturnValue(() => {});
  const plugin = {
    app: { vault: { adapter: { list: vi.fn(), exists: vi.fn() } } },
    settings: { snippetFolderPath: '.radiprotocol/snippets' },
    snippetService: {},
    edgeLabelSyncService: { subscribe: subscribeSpy },   // Phase 63 wiring
  } as unknown as RadiProtocolPlugin;
  const view = new EditorPanelView({} as any, plugin);
  (view as any).contentEl = fakeNode();
  (view as any).register = vi.fn();   // Component.register stub
  // ... registerDomEvent stub from editor-panel-forms.test.ts
  return view;
}
```

**Activate-element pattern to drive D-05 / D-07 (RESEARCH §"DOM-mocking" lines 391-396):**
```typescript
// In a test:
const ta = (view as any).formFieldRefs.get('radiprotocol_questionText');
globalAny.document.activeElement = ta as unknown as HTMLElement;
// Now invoke applyCanvasPatch with a fieldUpdate for questionText — assert
// that ta.value DID NOT change AND pendingCanvasUpdate.get(...) === 'new value'.
```

> Defensive note (RESEARCH Pitfall 3): the implementation actually checks `el.ownerDocument?.activeElement === el`, not the global `document.activeElement`. The test's FakeNode therefore needs an `ownerDocument` property that points to the same `globalAny.document`. Add this to the FakeNode factory.

**Test rows (VALIDATION 63-03-01 .. 63-03-07):**
```typescript
describe('EditorPanelView.applyCanvasPatch — formFieldRefs lifecycle (D-08)', () => {
  it('renderForm populates formFieldRefs for question textarea', () => { /* 63-03-01 */ });
  it('formFieldRefs cleared on loadNode (node switch)', () => { /* 63-03-01 */ });
  it('formFieldRefs cleared on onClose', () => { /* 63-03-01 */ });
});

describe('EditorPanelView.applyCanvasPatch — D-08 patch non-focused field', () => {
  it('writes value to .value of unfocused textarea', () => { /* 63-03-02 */ });
  it('does NOT push patched value into pendingEdits (RESEARCH Pitfall 6)', () => { /* 63-03-02 */ });
  it('does NOT dispatch synthetic input event (RESEARCH Pitfall 1)', () => { /* 63-03-02 */ });
});

describe('EditorPanelView.applyCanvasPatch — D-05 in-flight protection', () => {
  it('skips patch when target el === ownerDocument.activeElement', () => { /* 63-03-03 */ });
  it('stashes value in pendingCanvasUpdate slot when skipped', () => { /* 63-03-03 */ });
  it('continues patching OTHER non-focused fields in same payload (D-06 field-level lock)', () => {});
});

describe('EditorPanelView.applyCanvasPatch — D-07 apply post-blur', () => {
  it('blur handler flushes pendingCanvasUpdate to .value', () => { /* 63-03-04 */ });
  it('blur handler clears its slot after flushing', () => { /* 63-03-04 */ });
  it('blur runs inside queueMicrotask (RESEARCH Pitfall 4)', () => {});
});

describe('EditorPanelView.applyCanvasPatch — D-09 nodeType change', () => {
  it('changeKind:"nodeType" triggers full renderNodeForm', () => { /* 63-03-05 */ });
  it('clears formFieldRefs and pendingCanvasUpdate before re-render', () => {});
});

describe('EditorPanelView.applyCanvasPatch — D-10 node deleted', () => {
  it('changeKind:"deleted" triggers renderIdle', () => { /* 63-03-06 */ });
  it('nullifies currentNodeId and currentFilePath', () => { /* 63-03-06 */ });
});

describe('EditorPanelView.applyCanvasPatch — Phase 42 WR-01 re-entrancy', () => {
  it('patch arriving during renderForm flush is deferred via queueMicrotask', () => { /* 63-03-07 */ });
});
```

**Read-first for executor:**
1. `src/__tests__/editor-panel-forms.test.ts:1-200` (Setting mock + FakeNode pattern)
2. `src/__tests__/views/runner-snippet-sibling-button.test.ts:37-228` (richer FakeNode + registerDomEvent patching)
3. `src/views/editor-panel-view.ts` post-Plan-03 (the API surface under test)
4. RESEARCH §"DOM-mocking" lines 370-396 + Pitfalls 1, 2, 3, 4, 5, 6
5. `src/__mocks__/obsidian.ts` (confirm what `vi.mock('obsidian')` provides)

---

### NEW `src/__tests__/fixtures/snippet-cold-open-migration.canvas` (optional)

**Closest analog: `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas`** — same shape, swap Answer for Snippet.

**Concrete content (RESEARCH §"Test fixture for cold-open Snippet" lines 318-330):**
```jsonc
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start" },
    { "id": "n-q1", "type": "text", "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1" },
    { "id": "n-snip1", "type": "text", "text": "abdomen",
      "x": 0, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "snippet",
      "radiprotocol_subfolderPath": "abdomen",
      "radiprotocol_snippetLabel": "Брюшной отдел" }
  ],
  "edges": [
    { "id": "e0", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e1", "fromNode": "n-q1",   "toNode": "n-snip1" }
  ]
}
```
(Edge `e1` has no `label` — the cold-open migration target.)

**Read-first:** `src/__tests__/fixtures/displayLabel-edge-mismatch.canvas` (32 lines), `src/__tests__/fixtures/snippet-node.canvas` (22 lines).

---

### NEW `src/__tests__/fixtures/branching-snippet-multi-incoming.canvas` (optional)

**Closest analog: `src/__tests__/fixtures/branching-multi-incoming.canvas`** — verbatim shape, but the shared target is a Snippet not an Answer.

**Concrete content (RESEARCH §"Multi-incoming Snippet fixture" lines 340-352):**
```jsonc
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start" },
    { "id": "n-q1", "type": "text", "text": "Q1",
      "x": -200, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1" },
    { "id": "n-q2", "type": "text", "text": "Q2",
      "x": 200, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q2" },
    { "id": "n-snip-shared", "type": "text", "text": "x",
      "x": 0, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "snippet",
      "radiprotocol_subfolderPath": "x",
      "radiprotocol_snippetLabel": "Старое" }
  ],
  "edges": [
    { "id": "e0", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e1", "fromNode": "n-q1",   "toNode": "n-snip-shared", "label": "Вариант X" },
    { "id": "e2", "fromNode": "n-q2",   "toNode": "n-snip-shared", "label": "Вариант Y" }
  ]
}
```

Expected reconciler output: `pickedLabel = 'Вариант X'`, `nodeChanges` updates `n-snip-shared.snippetLabel → 'Вариант X'`, one `EdgeLabelDiff{ edgeId: 'e2', targetLabel: 'Вариант X', kind: 'snippet' }`.

**Read-first:** `src/__tests__/fixtures/branching-multi-incoming.canvas` (entire 41 lines).

---

## Shared Patterns (cross-cutting)

### Pattern: Obsidian event subscription with auto-detach

**Source:** `src/canvas/edge-label-sync-service.ts:48-55` (canonical Phase 50 example)
```typescript
this.plugin.registerEvent(
  this.app.vault.on('modify', (file) => {
    if (!(file instanceof TFile) || file.extension !== 'canvas') return;
    this.scheduleReconcile(file.path);
  })
);
```
**Apply to:**
- `edge-label-sync-service.ts` rename/delete handlers (Plan 02 snapshot cleanup)

### Pattern: subscriber callback with manual teardown via `Component.register`

**Source:** RESEARCH §"Code Examples" + `src/views/editor-panel-view.ts:51` (existing `registerEvent` usage)

```typescript
// Service side:
subscribe(handler: (detail: D) => void): () => void {
  const wrapped = (e: Event) => handler((e as CustomEvent<D>).detail);
  this.bus.addEventListener('canvas-changed-for-node', wrapped);
  return () => this.bus.removeEventListener('canvas-changed-for-node', wrapped);
}
// View side (in onOpen):
const unsub = this.plugin.edgeLabelSyncService.subscribe((d) => this.applyCanvasPatch(d));
this.register(unsub);   // Obsidian Component.register accepts a teardown function
```
**Apply to:** `editor-panel-view.ts:onOpen` (Plan 03)

### Pattern: D-07 content-diff loop guard (idempotency)

**Source:** `src/canvas/edge-label-sync-service.ts:99` + `src/graph/edge-label-reconciler.ts:39-42` JSDoc

```typescript
// Service:
if (diffs.length === 0 && newDisplayLabelByAnswerId.size === 0) return;
```
**Apply to:** Phase 63 must extend the short-circuit predicate to cover BOTH the snippet arm AND the new node-text snapshot diff. The structural-empty test must pass when:
- No edge diffs (any kind)
- No node label changes (any kind)
- No node-text field deltas
- No nodeType deltas
- No deletions

If ALL five empty → no write, no dispatch (the modify-event self-terminates as in Phase 50).

### Pattern: Atomic node+edge write via `saveLiveBatch`

**Source:** `src/canvas/canvas-live-editor.ts:148-205` + `src/canvas/edge-label-sync-service.ts:115-120`
```typescript
const savedLive = await this.plugin.canvasLiveEditor.saveLiveBatch(
  filePath,
  nodeEdits,        // Array<{ nodeId, edits: Record<string, unknown> }>
  edgeEdits,        // Array<{ edgeId, label: string | undefined }>
);
if (savedLive) return;
// Fall through to Strategy A vault.modify with the SAME payload mutated atomically.
```
**Apply to:** Phase 63 reconcile() — same call, but `nodeEdits` now contains a mix of `radiprotocol_displayLabel` AND `radiprotocol_snippetLabel` entries; `edgeEdits` is the same shape regardless of kind.

### Pattern: `queueMicrotask` for re-entrant render guard

**Source:** `src/views/editor-panel-view.ts:415` (Phase 42 WR-01)
```typescript
queueMicrotask(() => {
  this.renderForm(mergedRecord, nextKind);
});
```
**Apply to:**
- `applyCanvasPatch` body — wrap the entire patch loop in `queueMicrotask` (RESEARCH §"Re-entrancy" line 196-198)
- Blur handler in `renderGrowableTextarea` — wrap pending-flush in `queueMicrotask` (RESEARCH Pitfall 4 lines 471-481)

### Pattern: D-08 strip-key semantics (`undefined` ≡ delete)

**Source:** `src/canvas/edge-label-sync-service.ts:106-112` + `:148-156` + `src/views/editor-panel-view.ts:281-298`

When writing edits to canvas JSON, `value === undefined` MUST `delete obj[key]` (not `obj[key] = undefined`). This invariant carries straight through Phase 63 — the new `radiprotocol_snippetLabel` writes obey the same rule, and Strategy A loops `Object.entries(edits)` and deletes-on-undefined uniformly.

### Pattern: Field-key vocabulary stays canonical

**Source:** `src/views/editor-panel-view.ts` lines 519-728 (every kind arm) + `src/graph/canvas-parser.ts:198-286`

| Form key | Reconciler reads from RPNode |
|----------|------------------------------|
| `radiprotocol_questionText` | `node.questionText` |
| `radiprotocol_answerText` | `node.answerText` |
| `radiprotocol_displayLabel` | `node.displayLabel` |
| `radiprotocol_content` | `node.content` (NOT `radiprotocol_text`) |
| `radiprotocol_headerText` | `node.headerText` |
| `radiprotocol_snippetLabel` | `node.snippetLabel` |

The reconciler MUST read from the resolved RPNode field (post-parser fallback to raw `text`), not re-parse `radiprotocol_*` keys (RESEARCH §"Мини-гочча" line 215). The dispatch MUST emit the form key (not the RPNode property name).

---

## No analog found

(none — Phase 63 is purely additive on top of a deeply established Phase 50 surface; every file has at least a role-match analog.)

---

## Metadata

**Analog search scope:**
- `src/canvas/`, `src/graph/`, `src/views/`, `src/__tests__/`, `src/__tests__/views/`, `src/__tests__/fixtures/`
- Phase 50 milestone notes (`.planning/milestones/v1.8-phases/50-answer-edge-label-sync/`)

**Files scanned:**
- 7 source files (read in full or near-full): edge-label-sync-service.ts, edge-label-reconciler.ts, editor-panel-view.ts (1027 lines, read in three windows: 1-200, 200-550, 550-748, 895-1024), canvas-parser.ts (snippet arm), graph-model.ts (SnippetNode), main.ts (wiring grep), node-label.ts (referenced)
- 5 test files (read in full or partial): edge-label-reconciler.test.ts, canvas-write-back.test.ts, editor-panel-forms.test.ts (1-300), runner-snippet-sibling-button.test.ts (1-230), canvas-parser.test.ts (grep)
- 4 fixture files: branching-multi-incoming.canvas, displayLabel-edge-mismatch.canvas, snippet-node.canvas, plus directory listing
- Mocks: `__mocks__/obsidian.ts` (1-80)

**Pattern extraction date:** 2026-04-25
