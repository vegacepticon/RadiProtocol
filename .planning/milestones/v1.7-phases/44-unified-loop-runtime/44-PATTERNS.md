# Phase 44: Unified Loop Runtime — Pattern Map

**Mapped:** 2026-04-17
**Phase directory:** `.planning/phases/44-unified-loop-runtime/`
**Files analyzed:** 12 source touchpoints + 2 test files + 1 CSS file + 1 new fixture
**Analogs found:** 16 / 16 — every Phase 44 touchpoint has a direct in-repo analog (snippet picker = primary analog across state machine, view, and session layers).

---

## File Classification

| File (created / modified) | Role | Data Flow | Closest Analog | Why / Match |
|---|---|---|---|---|
| `src/runner/runner-state.ts` | model (types) | transform | `AwaitingSnippetPickState` in same file (runner-state.ts:40-46) | **Exact shape twin** — halt state carrying `nodeId`, `accumulatedText`, `canStepBack`. New `AwaitingLoopPickState` mirrors it 1:1. |
| `src/runner/protocol-runner.ts` (new `case 'loop':` in `advanceThrough`) | service (state machine) | event-driven | (a) stub `case 'loop':` (protocol-runner.ts:554-563) — what we replace; (b) `case 'snippet':` (574-579) — halt-and-wait pattern; (c) `pickSnippet()` (233-247) — undo-before-mutate at entry | **Triple analog** — 43's stub shows the arm location, `case 'snippet'` shows the halt pattern, `pickSnippet` shows the undo snapshot convention. |
| `src/runner/protocol-runner.ts` (new `chooseLoopBranch` method) | service public API | event-driven | (a) `chooseAnswer(answerId)` (protocol-runner.ts:73-101); (b) `chooseSnippetBranch(snippetNodeId)` (113-153) | **Closest semantic** — `chooseSnippetBranch` is a picker-exiting action that pushes undo, transitions status, re-targets `currentNodeId`, and does NOT touch accumulator. `chooseLoopBranch` diverges only in the «выход» branch (pops loopContextStack). |
| `src/runner/protocol-runner.ts` (dead-end return helper in `advanceThrough`) | service (state machine) | event-driven | Existing `firstNeighbour()` usage in `case 'start'`/`case 'answer'`/`case 'text-block'` (protocol-runner.ts:509-515, 527-533, 546-552) | **Same control-flow site** — all three cases currently do `if (next === undefined) transitionToComplete()`. Phase 44 inserts a loop-frame check before falling through to `transitionToComplete`. |
| `src/runner/protocol-runner.ts` (getSerializableState / restoreFrom widening) | service (persistence) | transform | `getSerializableState()` (protocol-runner.ts:372-403), `restoreFrom()` (429-453) — `'awaiting-snippet-pick'` already handled | **Exact shape** — literal union `'at-node' \| 'awaiting-snippet-pick' \| 'awaiting-snippet-fill'` widens to `\| 'awaiting-loop-pick'` in THREE places (return type of getSerializableState, parameter type of restoreFrom, PersistedSession.runnerStatus). |
| `src/runner/protocol-runner.ts` (deletions: `chooseLoopAction`, `isAtLoopEnd` / `loopIterationLabel` population in `getState()`) | service | — | Phase 43 stubs (protocol-runner.ts:297-302, 313-323) | **Self-delete** — both were placed in Phase 43 D-14 as compile-bridges; Phase 44 removes them after rewriting `.skip` tests. |
| `src/sessions/session-model.ts` (widen `PersistedSession.runnerStatus` union) | model (persisted types) | transform | Same file, same field (session-model.ts:46-51) | **Self-delta** — literal union extension mirrors the same edit shape used historically in Phase 29/30 when `'awaiting-snippet-pick'` and `'awaiting-snippet-fill'` were added. |
| `src/views/runner-view.ts` (new `case 'awaiting-loop-pick':` render arm) | view (UI) | request-response | (a) `case 'awaiting-snippet-pick':` (runner-view.ts:434-450) + `renderSnippetPicker()` (508-614); (b) the `question` answer-list render inside `case 'at-node'` (333-384) | **Two-level analog** — snippet-pick arm shows the halt-state render skeleton (preview zone + toolbar + picker delegation); the answer-list loop inside `at-node` shows the button-per-neighbour pattern that the loop picker needs literally (one button per outgoing edge). |
| `src/views/runner-view.ts` (step-back button in picker) | view (UI) | request-response | Step-back block inside `case 'at-node'` (runner-view.ts:417-427) and inside `renderSnippetPicker()` (601-613) | **Exact copy** — same three-line handler: `stepBack()` → `void autoSaveSession()` → `render()`. |
| `src/styles/loop-support.css` (append Phase 44 picker styles) | CSS (feature file) | — | Existing Phase 6 block in same file (loop-support.css:1-46); `.rp-snippet-picker-list` / `.rp-snippet-folder-row` / `.rp-snippet-item-row` (in `snippet-manager.css`) for layout reference | **CLAUDE.md append-only** — new classes land under a `/* Phase 44: Unified loop picker (RUN-01) ─── */` marker at the bottom; Phase 6 block above stays verbatim. |
| `src/graph/graph-model.ts` (delete `LoopStartNode.maxIterations`) | model (type defs) | transform | Same file, same interface (graph-model.ts:77-82) | **Self-delta** — field removal on `@deprecated` legacy interface. No analog needed; mechanical delete. |
| `src/settings.ts` (delete `maxLoopIterations` field + default + UI Setting) | config | — | Same file, same three sites (settings.ts:9, 27, 127-143) | **Self-delta** — three delete blocks in one file. Surrounding Settings (Runner / Protocol / Output / Storage groups) are analogs for what to keep; the "Protocol engine" heading at line 127 is orphaned once the one Setting it contained is deleted — choice: drop the heading too (recommended) or leave empty group for future phases. |
| `src/settings-tab.test.ts` (delete D-10 test + add RUN-07 assertion) | test | arrange-act-assert | Same file, existing UI-10/UI-11 tests (settings-tab.test.ts:5-11) | **Exact structure** — same `expect(DEFAULT_SETTINGS.<field>)` shape; new test inverts to `expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false)`. |
| `src/views/editor-panel-view.ts` (delete legacy `case 'loop-start'` / `case 'loop-end'`) | view (form builder) | — | Same file (editor-panel-view.ts:556-608) | **Self-delete** — two case blocks in `buildKindForm()` switch; default arm will catch remaining kinds. CLAUDE.md: do NOT touch other cases. |
| `src/__tests__/fixtures/unified-loop-nested.canvas` (NEW for RUN-04) | fixture | static JSON | `unified-loop-valid.canvas` (src/__tests__/fixtures/unified-loop-valid.canvas) | **Role-match** — adds one more loop node inside the outer loop's body branch; each loop has one «выход» edge. Same JSON shape as the existing valid fixture. |
| `src/__tests__/runner/protocol-runner.test.ts` (rewrite 7 `.skip` tests + 1 obsolete) | test (rewrite) | arrange-act-assert | `describe('initial state')` / `describe('start()')` / `describe('chooseAnswer()')` — all passing tests in same file using `loadGraph(fixture)` + `runner.start()` + assertion on `state.status`/`currentNodeId`/`accumulatedText` (protocol-runner.test.ts:19-50) | **Same rhythm** — new tests use `loadGraph('unified-loop-valid.canvas')` + `runner.chooseLoopBranch(edgeId)`. Mirror existing `describe('iteration cap (RUN-09)')` for "dead-end returns to picker" shape. |
| `src/__tests__/runner/protocol-runner-session.test.ts` (rewrite 4 `.skip` + 2 `it.skip`) | test (rewrite) | arrange-act-assert | `describe('session — awaiting-snippet-pick (D-22)')` passing tests (protocol-runner-session.test.ts:191-218) | **Exact pattern** — "save → JSON round-trip → restore → assert status and fields" mirrors what Phase 30 D-22 did for snippet-pick. Phase 44 repeats for `'awaiting-loop-pick'`. |

---

## Pattern Assignments

### `src/runner/runner-state.ts` (model: new `AwaitingLoopPickState`)

**Analog:** `AwaitingSnippetPickState` (runner-state.ts:40-46).

**Literal shape to mirror:**
```ts
// Source: src/runner/runner-state.ts:35-46
/**
 * Phase 30 D-06: runner paused at a snippet node while the user browses
 * the configured subfolder and picks a snippet. Transitions to
 * 'awaiting-snippet-fill' via pickSnippet().
 */
export interface AwaitingSnippetPickState {
  status: 'awaiting-snippet-pick';
  nodeId: string;
  subfolderPath: string | undefined;
  accumulatedText: string;
  canStepBack: boolean;
}
```

**New interface shape (Phase 44):**
```ts
/**
 * Phase 44 (RUN-01): runner paused at a unified loop node, presenting a picker
 * over all outgoing edges (body branches + «выход»). Transitions back to
 * 'at-node' via chooseLoopBranch(edgeId).
 */
export interface AwaitingLoopPickState {
  status: 'awaiting-loop-pick';
  nodeId: string;                 // loop node id — RunnerView looks up headerText from graph
  accumulatedText: string;
  canStepBack: boolean;
}
```

**Union extension:** add `| AwaitingLoopPickState` to `RunnerState` (line 77-83).

**Deletions (Pitfall 9 from RESEARCH.md):**
```ts
// Source: src/runner/runner-state.ts:23-32 — DELETE both @deprecated fields
/**
 * @deprecated Phase 43 D-14 — семантика меняется в Phase 44 (unified loop picker, RUN-01).
 */
loopIterationLabel?: string;
/**
 * @deprecated Phase 43 D-14 — поле теряет смысл: loop-end kind больше не существует.
 */
isAtLoopEnd?: boolean;
```

**CLAUDE.md:** don't touch `IdleState`, `AwaitingSnippetFillState`, `CompleteState`, `ErrorState`, or `UndoEntry` (which Phase 31 D-08 owns).

---

### `src/runner/protocol-runner.ts` — new `case 'loop':` in `advanceThrough()`

**Analog A (location):** stub `case 'loop':` at protocol-runner.ts:554-563 (what we replace).

**Current stub:**
```ts
// Source: src/runner/protocol-runner.ts:554-563
// Phase 43 D-14, D-CL-04 — unified loop runtime реализуется в Phase 44 (RUN-01..RUN-07).
case 'loop': {
  this.transitionToError(
    'Loop runtime ещё не реализован (запланировано в Phase 44 — см. ROADMAP v1.7).',
  );
  return;
}
```

**Analog B (halt pattern):** `case 'snippet':` at protocol-runner.ts:574-579:
```ts
case 'snippet': {
  // Phase 30 D-07: halt at snippet node, RunnerView renders the picker.
  this.currentNodeId = cursor;
  this.runnerStatus = 'awaiting-snippet-pick';
  return;
}
```

**Analog C (undo snapshot at picker entry):** `pickSnippet()` at protocol-runner.ts:233-247:
```ts
pickSnippet(snippetId: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-pick') return;
  if (this.currentNodeId === null) return;

  // Pattern A: undo-before-mutate. Spread loopContextStack (LOOP-05).
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  // ... then mutate
}
```

**New `case 'loop':` to write (per Pitfall 1 — undo BEFORE frame push):**
```ts
case 'loop': {
  // Undo-before-mutate (Pitfall 1): snapshot PRE-loop state first so stepBack()
  // from the picker lands at the node that entered the loop, not at the loop node itself.
  this.undoStack.push({
    nodeId: cursor,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  // Push loop frame on stack
  this.loopContextStack.push({
    loopNodeId: cursor,
    iteration: 1,
    textBeforeLoop: this.accumulator.snapshot(),
  });
  // Halt at picker
  this.currentNodeId = cursor;
  this.runnerStatus = 'awaiting-loop-pick';
  return;
}
```

**Notes for planner:**
- **Undo push details:** `nodeId` should be the pre-loop node, i.e. the predecessor cursor that advanced us TO the loop. But `advanceThrough` already has `cursor = <loop-node-id>` by the time the `case` runs. Options: (a) push undo with `nodeId: cursor` (loop node itself) — step-back will restore to loop node and re-enter the loop, creating an infinite undo loop. (b) Track previous cursor in the while-loop and push that. (c) Pop the loop frame itself in `stepBack` when it detects `runnerStatus === 'awaiting-loop-pick'`. **Recommended:** option (c) — `stepBack()` already does `this.loopContextStack = [...entry.loopContextStack]`, which restores the pre-loop stack (empty if this was a top-level loop entry). The `nodeId` in the undo entry should be the loop node's predecessor — planner must thread that through from the call site (either pass it to `advanceThrough` or track locally). See Pitfall 1 details.
- **Legacy `case 'loop-start' / 'loop-end':`** (protocol-runner.ts:564-573) — these are `transitionToError` defensive fallbacks. They should remain until Phase 46 (validator rejects legacy canvases before runtime). CLAUDE.md: don't delete code you didn't add.

---

### `src/runner/protocol-runner.ts` — new public method `chooseLoopBranch(edgeId)`

**Analog A (primary):** `chooseSnippetBranch(snippetNodeId)` (protocol-runner.ts:113-153) — picker-exiting user action, pushes undo-before-mutate, transitions status, does NOT touch accumulator.

**Full analog excerpt:**
```ts
// Source: src/runner/protocol-runner.ts:113-153
chooseSnippetBranch(snippetNodeId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const currentNode = this.graph.nodes.get(this.currentNodeId);
  if (currentNode === undefined || currentNode.kind !== 'question') {
    this.transitionToError(
      `chooseSnippetBranch called when current node '${this.currentNodeId}' is not a question.`,
    );
    return;
  }

  // ... snippet-specific validation ...

  // Phase 31 Pitfall 1: undo-before-mutate with returnToBranchList flag.
  this.undoStack.push({
    nodeId: this.currentNodeId, // question id
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
    returnToBranchList: true,
  });

  // Transition to picker at the snippet node — no accumulator mutation.
  this.currentNodeId = snippetNodeId;
  this.snippetNodeId = snippetNodeId;
  this.runnerStatus = 'awaiting-snippet-pick';
}
```

**Analog B (edge lookup):** validator's edge filter at graph-validator.ts:98 (per Pattern 5 in RESEARCH.md):
```ts
const outgoing = graph.edges.filter(e => e.fromNodeId === id);
```

**New method to write:**
```ts
/**
 * Phase 44 (RUN-01, RUN-03): user picks a branch at the loop picker.
 * Valid only in 'awaiting-loop-pick'. Dispatches by edge label:
 *   - 'выход'  -> pop the current loop frame, advance along the exit edge
 *   - other    -> increment iteration on top frame, advance along the body edge
 */
chooseLoopBranch(edgeId: string): void {
  if (this.runnerStatus !== 'awaiting-loop-pick') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const edge = this.graph.edges.find(e => e.id === edgeId);
  if (edge === undefined || edge.fromNodeId !== this.currentNodeId) {
    this.transitionToError(
      `Loop picker edge '${edgeId}' not found or does not originate at current loop node.`,
    );
    return;
  }

  // Undo-before-mutate
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  if (edge.label === 'выход') {
    // RUN-03: pop frame
    this.loopContextStack.pop();
  } else {
    // Body branch: increment iteration on top frame (RUN-04 nested-safe — .pop() is not used)
    const top = this.loopContextStack[this.loopContextStack.length - 1];
    if (top !== undefined) top.iteration += 1;
  }

  this.runnerStatus = 'at-node';
  this.advanceThrough(edge.toNodeId);
}
```

**Notes for planner:**
- `edge.label === 'выход'` is an **exact-match contract** (graph-validator.ts:99 uses the same literal). Do NOT `.trim()` or lowercase. Consider extracting `const EXIT_LABEL = 'выход'` to a shared constants module and importing it on both sides (Anti-pattern note in RESEARCH.md).
- The method is NOT `async` — mirrors `chooseAnswer`/`chooseSnippetBranch`.
- RunnerView's click handler must call `syncManualEdit(preview.value)` BEFORE `chooseLoopBranch(edgeId)` (Pitfall 7).
- On `.pop()` mutation: that mutation should happen AFTER the undo push captured a spread copy `[...this.loopContextStack]` — the spread copy is independent of the live array, so `.pop()` on the live one does not mutate the undo snapshot.

---

### `src/runner/protocol-runner.ts` — dead-end return helper in `advanceThrough()`

**Analogs:** three sites currently all look identical:

```ts
// Source: src/runner/protocol-runner.ts:507-515 (case 'start')
case 'start': {
  const next = this.firstNeighbour(cursor);
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  cursor = next;
  break;
}

// Source: src/runner/protocol-runner.ts:527-533 (case 'text-block' non-snippet branch)
const next = this.firstNeighbour(cursor);
if (next === undefined) {
  this.transitionToComplete();
  return;
}
cursor = next;
break;

// Source: src/runner/protocol-runner.ts:546-552 (case 'answer')
const next = this.firstNeighbour(cursor);
if (next === undefined) {
  this.transitionToComplete();
  return;
}
cursor = next;
break;
```

**Pitfall 2 prescription — extract a helper** (RESEARCH.md):
```ts
/**
 * Phase 44 (RUN-02): auto-advance helper. If `next` is defined, update cursor.
 * If `next` is undefined AND we are inside a loop, return to the owning loop's picker.
 * Otherwise complete the protocol. Returns 'continue' to proceed the while-loop or
 * 'halted' to signal the caller should return from advanceThrough.
 *
 * Mutates: this.currentNodeId, this.runnerStatus (only when halted).
 */
private advanceOrReturnToLoop(next: string | undefined): 'continue' | 'halted' {
  if (next !== undefined) {
    // caller updates its local `cursor` on 'continue'
    return 'continue';
  }
  // Dead-end: RUN-02 — inside a loop, return to picker; else, complete.
  if (this.loopContextStack.length > 0) {
    const frame = this.loopContextStack[this.loopContextStack.length - 1];
    if (frame !== undefined) {
      this.currentNodeId = frame.loopNodeId;
      this.runnerStatus = 'awaiting-loop-pick';
      return 'halted';
    }
  }
  this.transitionToComplete();
  return 'halted';
}
```

**Notes for planner:**
- Replacing all three sites with the helper is a minor refactor — each site currently has `if (next === undefined) { transitionToComplete(); return; } cursor = next;` which becomes `if (this.advanceOrReturnToLoop(next) === 'halted') return; cursor = next!;`.
- Alternative: inline the loop-check at each of the 3 sites (DRY violation, but local). The helper is cleaner.
- Beware of the auto-advance cycle guard (`this.maxIterations`, protocol-runner.ts:28, 488): if a loop body is longer than `maxIterations / iterations`, the counter overflows. See Pitfall 10 — verify with a long-body test. Recommendation: reset `steps = 0` when halting at the picker (inside `advanceOrReturnToLoop` halted-to-picker branch, or at the top of `advanceThrough` when called from `chooseLoopBranch`).

---

### `src/runner/protocol-runner.ts` — widen `getSerializableState` / `restoreFrom`

**Analog:** the exact union literal at three call sites.

**Current return type** (protocol-runner.ts:372-380):
```ts
getSerializableState(): {
  runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill';
  currentNodeId: string;
  accumulatedText: string;
  undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
  loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>;
  snippetId: string | null;
  snippetNodeId: string | null;
} | null {
```

**Current status gate** (protocol-runner.ts:381-387):
```ts
if (
  this.runnerStatus !== 'at-node' &&
  this.runnerStatus !== 'awaiting-snippet-fill' &&
  this.runnerStatus !== 'awaiting-snippet-pick'
) {
  return null;
}
```

**New widening (three sites):**
1. Return type of `getSerializableState()`: add `| 'awaiting-loop-pick'` to the `runnerStatus` literal.
2. Status gate: add `&& this.runnerStatus !== 'awaiting-loop-pick'`.
3. `restoreFrom()` parameter type (protocol-runner.ts:429-437): same `| 'awaiting-loop-pick'` literal addition.

**Notes for planner:**
- **No new data fields needed** — `currentNodeId` already carries the loop node id at `awaiting-loop-pick`; `loopContextStack` already carries the frames; `accumulatedText` already set. Round-trip works out of the box once the union is widened.
- Pitfall 5 — widen `PersistedSession.runnerStatus` in the same commit (see next section).

---

### `src/sessions/session-model.ts` (widen `PersistedSession.runnerStatus`)

**Current shape** (session-model.ts:46-51):
```ts
/**
 * Runner status at save time.
 * Only 'at-node', 'awaiting-snippet-pick' and 'awaiting-snippet-fill' are valid
 * resume states. idle/complete/error sessions are never written to disk.
 */
runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill';
```

**Phase 44 delta:**
```ts
runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill' | 'awaiting-loop-pick';
```

**Docblock update:** include `'awaiting-loop-pick'` in the list of valid resume states.

**Notes for planner:**
- Pre-Phase-44 session files on disk with `runnerStatus === 'at-node'` etc. remain readable — TypeScript accepts narrower literal unions being widened.
- `PersistedLoopContext` (session-model.ts:13-17) is already `loopNodeId`/`iteration`/`textBeforeLoop` — NO schema change required for the loop frame itself. Phase 43 D-04 already handled this.
- **CLAUDE.md:** don't touch `PersistedUndoEntry`, `PersistedSession.canvasFilePath`/`canvasMtimeAtSave`/`savedAt`/`version`/`snippetId`/`snippetNodeId`.

---

### `src/views/runner-view.ts` (new `case 'awaiting-loop-pick':` render arm)

**Analog A (halt-state render skeleton):** `case 'awaiting-snippet-pick':` at runner-view.ts:434-450.
```ts
// Source: src/views/runner-view.ts:434-450
case 'awaiting-snippet-pick': {
  this.renderPreviewZone(previewZone, state.accumulatedText);
  this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

  // Phase 30 D-05/D-23: reset picker drill-down when we enter a new snippet node
  if (this.snippetPickerNodeId !== state.nodeId) {
    this.snippetPickerNodeId = state.nodeId;
    this.snippetPickerPath = [];
  }

  questionZone.createEl('p', {
    text: 'Loading snippets...',
    cls: 'rp-empty-state-body',
  });
  void this.renderSnippetPicker(state, questionZone);
  break;
}
```

**Analog B (button-per-neighbour pattern):** answer-list inside `case 'at-node' → case 'question':` (runner-view.ts:348-362).
```ts
if (answerNeighbors.length > 0) {
  const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
  for (const answerNode of answerNeighbors) {
    const btn = answerList.createEl('button', {
      cls: 'rp-answer-btn',
      text: answerNode.displayLabel ?? answerNode.answerText,
    });
    this.registerDomEvent(btn, 'click', () => {
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01 (Pitfall 7)
      this.runner.chooseAnswer(answerNode.id);
      void this.autoSaveSession();   // Pattern 3 (RESEARCH.md)
      void this.renderAsync();
    });
  }
}
```

**Analog C (step-back button):** runner-view.ts:417-427.
```ts
if (state.canStepBack) {
  const stepBackBtn = questionZone.createEl('button', {
    cls: 'rp-step-back-btn',
    text: 'Step back',
  });
  this.registerDomEvent(stepBackBtn, 'click', () => {
    this.runner.stepBack();
    void this.autoSaveSession();
    this.render();
  });
}
```

**New render arm to write:**
```ts
case 'awaiting-loop-pick': {
  if (this.graph === null) {
    this.renderError(['Internal error: graph not loaded.']);
    return;
  }
  const node = this.graph.nodes.get(state.nodeId);
  if (node === undefined || node.kind !== 'loop') {
    this.renderError([`Loop node "${state.nodeId}" not found in graph.`]);
    return;
  }

  // RUN-01: render headerText above picker
  if (node.headerText !== '') {
    questionZone.createEl('p', {
      text: node.headerText,
      cls: 'rp-loop-header-text',             // NEW Phase 44 class
    });
  }

  // Picker: every outgoing edge becomes a button (Pitfall 4 — edge.filter, not adjacency)
  const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId);
  const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });  // NEW
  for (const edge of outgoing) {
    const label = edge.label ?? '(unlabeled)';
    const isExit = edge.label === 'выход';
    const btn = list.createEl('button', {
      cls: isExit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',            // NEW
      text: label,
    });
    this.registerDomEvent(btn, 'click', () => {
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');    // Pitfall 7
      this.runner.chooseLoopBranch(edge.id);
      void this.autoSaveSession();                                      // Pattern 3
      void this.renderAsync();
    });
  }

  // Step-back (RUN-05) — exact same pattern as at-node arm
  if (state.canStepBack) {
    const stepBackBtn = questionZone.createEl('button', {
      cls: 'rp-step-back-btn',
      text: 'Step back',
    });
    this.registerDomEvent(stepBackBtn, 'click', () => {
      this.runner.stepBack();
      void this.autoSaveSession();
      this.render();
    });
  }

  this.renderPreviewZone(previewZone, state.accumulatedText);
  this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
  break;
}
```

**Notes for planner:**
- Arm position: insert AFTER `case 'awaiting-snippet-pick':` block (around runner-view.ts:450) and BEFORE `case 'awaiting-snippet-fill':` (line 452). This keeps picker-style arms adjacent.
- NO `innerHTML` — use `createEl`/`createDiv`/`registerDomEvent` (RESEARCH.md Standard Stack).
- Do NOT reuse `.rp-loop-iteration-label`/`.rp-loop-btn-row`/`.rp-loop-again-btn`/`.rp-loop-done-btn` (Phase 6 two-button UI). Those stay untouched in `loop-support.css` (CLAUDE.md: never remove / never modify rules you didn't add). Assumption A6 — Phase 44 adds NEW classes.
- `state.nodeId` — the new `AwaitingLoopPickState` variant; confirmed in runner-state.ts (interface to be added per the model section above).
- Don't touch `case 'at-node'` question/free-text-input arms, `case 'awaiting-snippet-fill'`, `case 'complete'`, `case 'error'`, `case 'idle'`, the default exhaustiveness arm, or any of the helper methods (`renderSnippetPicker`, `handleSnippetPickerSelection`, `handleSnippetFill`, `autoSaveSession`, `renderPreviewZone`, `renderOutputToolbar`, `renderError`).

---

### `src/styles/loop-support.css` — append Phase 44 picker styles

**Existing Phase 6 block (read-only, CLAUDE.md append-only):**
```css
/* Source: src/styles/loop-support.css:1-46 */
/* Phase 6: Loop Support ─────────────────────────────────────────────────── */
.rp-loop-iteration-label { ... }
.rp-loop-btn-row { ... }
.rp-loop-again-btn { ... }
.rp-loop-done-btn { ... }
```

**Append pattern (Phase 44 marker):**
```css
/* Phase 44: Unified loop picker (RUN-01) ────────────────────────────────── */

.rp-loop-header-text {
  font-size: var(--font-ui-medium);
  font-weight: var(--font-semibold);
  color: var(--text-normal);
  margin-bottom: var(--size-2-3);
}

.rp-loop-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-2);
  margin-top: var(--size-2-3);
}

.rp-loop-body-btn,
.rp-loop-exit-btn {
  text-align: left;
  padding: var(--size-2-3) var(--size-4-2);
  border-radius: var(--radius-s);
  border: none;
  cursor: pointer;
  font-size: var(--font-ui-small);
}

.rp-loop-body-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}
.rp-loop-body-btn:hover {
  background: var(--interactive-accent-hover);
}

.rp-loop-exit-btn {
  background: var(--background-modifier-border);
  color: var(--text-normal);
}
.rp-loop-exit-btn:hover {
  background: var(--background-modifier-border-hover, var(--background-modifier-border));
  opacity: 0.9;
}
```

**Notes for planner:**
- **Pitfall 6:** do NOT edit `runner-view.css`, `snippet-manager.css`, or any other feature file — loop-support.css owns loop picker classes.
- `CSS_FILES` order in `esbuild.config.mjs:31-38` is already correct (`loop-support` is last).
- After append, run `npm run build` to regenerate `styles.css` and `src/styles.css` (CLAUDE.md).
- Do NOT remove the Phase 6 block — `.rp-loop-iteration-label` etc. remain declared in CSS even though Phase 44 RunnerView does not use them. CLAUDE.md "never remove code you didn't add". Phase 45 may garbage-collect them if RUN-05 form work warrants it.

---

### `src/graph/graph-model.ts` — delete `LoopStartNode.maxIterations`

**Current interface** (graph-model.ts:77-82):
```ts
/**
 * @deprecated Phase 43 D-03, D-CL-05 — legacy parseable kind.
 */
export interface LoopStartNode extends RPNodeBase {
  kind: 'loop-start';
  loopLabel: string;
  exitLabel: string;
  maxIterations: number;            // ← DELETE this line (Phase 44 RUN-07)
}
```

**Phase 44 delta:** delete just the `maxIterations: number;` line. Keep `kind`/`loopLabel`/`exitLabel` — they are still used by the editor-panel legacy form (which is also being deleted in this phase, see below) and by the canvas-parser legacy arm.

**Cascading impact:**
- `src/graph/canvas-parser.ts:247` still does `maxIterations: getNumber(props, 'radiprotocol_maxIterations', 50)` when parsing `case 'loop-start'`. Deleting the field from the interface forces a parse-site fix: delete that field assignment too (parser goes from 3-field to 2-field). Planner: verify via `tsc --noEmit`.
- No runtime code reads this field after Phase 43 (validator rejects legacy canvases; runtime never reaches `case 'loop-start'` with a real graph).
- STATE.md Standing Pitfall #10: "LOOP rework must delete the old iteration cap (RUN-07) — do not carry the maxIterations field forward for any reason."

---

### `src/settings.ts` — delete `maxLoopIterations` field + default + UI Setting

**Three deletion sites:**

**Site 1 — interface field** (settings.ts:9):
```ts
maxLoopIterations: number;          // DELETE
```

**Site 2 — default** (settings.ts:27):
```ts
maxLoopIterations: 50,              // DELETE
```

**Site 3 — settings tab Setting block** (settings.ts:127-143):
```ts
// Group 4 — Protocol engine
new Setting(containerEl).setName('Protocol engine').setHeading();   // DELETE heading

new Setting(containerEl)
  .setName('Max loop iterations')
  .setDesc('Maximum times a loop can repeat before stopping. Prevents infinite loops in misconfigured canvases. Default: 50.')
  .addText(text => text
    .setValue(String(this.plugin.settings.maxLoopIterations))
    .onChange(async (value) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) {
        this.plugin.settings.maxLoopIterations = num;
        await this.plugin.saveSettings();
      } else if (value.trim() !== '') {
        new Notice('Max loop iterations must be a positive integer.');
      }
    })
  );
// DELETE entire block (17 lines)
```

**Notes for planner:**
- After Site 3 delete, the "Protocol engine" heading is the only remaining item in that group — delete the heading too (Site 3 includes it above). Next heading "Storage" at line 146 flows naturally.
- `Notice` import at settings.ts:3 becomes unused after the delete (only `Notice` call was inside `onChange`). Either remove `Notice` from the import or leave it (CLAUDE.md: don't delete what you didn't add; but import-only removal is OK since you're removing the thing that created the Notice. Recommendation: drop `Notice` from the import to keep the import line clean — or import-only-what-you-use linting will flag it otherwise).
- `loadData()` merge at `main.ts:26` (`Object.assign({}, DEFAULT_SETTINGS, await loadData())`) gracefully handles extra fields in old data.json files — users who saved `maxLoopIterations: 50` will just have a harmless orphan field in data.json; no migration needed.
- Don't touch `textSeparator`, `outputDestination`, `outputFolderPath`, `snippetFolderPath`, `snippetTreeExpandedPaths`, `sessionFolderPath`, `runnerViewMode`, `protocolFolderPath` or their Settings blocks.

---

### `src/__tests__/settings-tab.test.ts` — delete D-10, add RUN-07 assertion

**Current test to delete** (settings-tab.test.ts:13-15):
```ts
it('D-10: DEFAULT_SETTINGS.maxLoopIterations is 50', () => {
  expect(DEFAULT_SETTINGS.maxLoopIterations).toBe(50);
});
```

**Analog for structure** (settings-tab.test.ts:5-7):
```ts
it('UI-10: DEFAULT_SETTINGS.outputDestination is clipboard', () => {
  expect(DEFAULT_SETTINGS.outputDestination).toBe('clipboard');
});
```

**New RUN-07 test (add):**
```ts
it('RUN-07: DEFAULT_SETTINGS has no maxLoopIterations field', () => {
  expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false);
});
```

**Notes for planner:**
- The fourth existing test `UI-10/D-10: RadiProtocolSettingsTab has display method (stub check)` stays — it only asserts the class has a `display` method, unaffected by field delete.
- If planner wants a negative-type test: `// @ts-expect-error` before `DEFAULT_SETTINGS.maxLoopIterations` would enforce TS removal at compile time; but the runtime `in` check above is simpler and mirrors the UI-10 test shape.

---

### `src/views/editor-panel-view.ts` — delete legacy `case 'loop-start'` / `case 'loop-end'`

**Current blocks** (editor-panel-view.ts:556-608) — 53 lines total.

`case 'loop-start':` (editor-panel-view.ts:556-593):
```ts
case 'loop-start': {
  new Setting(container).setHeading().setName('Loop-start node');
  new Setting(container)
    .setName('Loop label')
    .setDesc('Shown as iteration prefix in the runner (e.g., "Lesion 2"). Default: Loop.')
    .addText(t => {
      t.setValue((nodeRecord['radiprotocol_loopLabel'] as string | undefined) ?? 'Loop')
        .onChange(v => {
          this.pendingEdits['radiprotocol_loopLabel'] = v || 'Loop';
          this.scheduleAutoSave();
        });
    });
  new Setting(container)
    .setName('Exit label')
    .setDesc('Text on the exit button shown at the loop-end node. Default: Done.')
    .addText(t => {
      t.setValue((nodeRecord['radiprotocol_exitLabel'] as string | undefined) ?? 'Done')
        .onChange(v => {
          this.pendingEdits['radiprotocol_exitLabel'] = v || 'Done';
          this.scheduleAutoSave();
        });
    });
  new Setting(container)
    .setName('Max iterations')
    .setDesc('Hard cap on loop repetitions. Prevents infinite loops in the runner. Default: 50.')
    .addText(t => {
      const inputEl = t.inputEl;
      inputEl.type = 'number';
      inputEl.min = '1';
      t.setValue(String((nodeRecord['radiprotocol_maxIterations'] as number | undefined) ?? 50))
        .onChange(v => {
          const n = parseInt(v, 10);
          this.pendingEdits['radiprotocol_maxIterations'] = isNaN(n) ? 50 : Math.max(1, n);
          this.scheduleAutoSave();
        });
    });
  break;
}
```

`case 'loop-end':` (editor-panel-view.ts:595-608):
```ts
case 'loop-end': {
  new Setting(container).setHeading().setName('Loop-end node');
  new Setting(container)
    .setName('Loop start node ID')
    .setDesc('Must match the ID of the corresponding loop-start node on the canvas.')
    .addText(t => {
      t.setValue((nodeRecord['radiprotocol_loopStartId'] as string | undefined) ?? '')
        .onChange(v => {
          this.pendingEdits['radiprotocol_loopStartId'] = v;
          this.scheduleAutoSave();
        });
    });
  break;
}
```

**Phase 44 delta:** delete BOTH case blocks. Since `RPNodeKind` still contains `'loop-start'` and `'loop-end'` (Phase 43 D-CL-05 variant b — legacy parseable), TypeScript exhaustiveness still requires them to be handled OR fall through to `default`.

**Two options (planner chooses):**
- **Option (a) — informational stub** (recommended): replace both cases with a single combined case that shows one-line notice.
  ```ts
  case 'loop-start':
  case 'loop-end': {
    new Setting(container).setHeading().setName('Legacy loop node');
    new Setting(container).setDesc('This node type is obsolete. Rebuild the loop using a unified "loop" node. The canvas will fail validation until the legacy nodes are removed.');
    break;
  }
  ```
- **Option (b) — minimal `break`**: `case 'loop-start': case 'loop-end': break;` — falls through to end-of-switch; user sees whatever the "no editable properties" default renders (check planner: does the switch have a `default:` arm or does missing kinds just leave the container empty?). Simpler but silent.

**Notes for planner:**
- Do NOT add `case 'loop':` in Phase 44 — that's Phase 45 LOOP-05. Let `default` (or missing case) handle it for now.
- Do NOT touch `case 'start'`, `case 'question'`, `case 'answer'`, `case 'free-text-input'`, `case 'text-block'`, `case 'snippet'` — all active kinds. CLAUDE.md: never remove code you didn't add.
- Removing these cases may cascade into tests that exercise editor-panel-view for loop-start/loop-end — grep `tests/` for `radiprotocol_loopLabel`, `radiprotocol_maxIterations`, `radiprotocol_loopStartId` before deleting. None identified in RESEARCH.md for editor-panel-view-specific tests; safe to proceed.

---

### `src/__tests__/fixtures/unified-loop-nested.canvas` (NEW — RUN-04)

**Analog:** `src/__tests__/fixtures/unified-loop-valid.canvas` (full content below, already present in repo).

```json
// Source: src/__tests__/fixtures/unified-loop-valid.canvas
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start",       "x": 0,   "y": 0,   "width": 200, "height": 60, "radiprotocol_nodeType": "start" },
    { "id": "n-loop",  "type": "text", "text": "Lesion loop", "x": 0,   "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "loop",      "radiprotocol_headerText": "Lesion loop" },
    { "id": "n-q1",    "type": "text", "text": "Size?",       "x": 260, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question",  "radiprotocol_questionText": "Size?" },
    { "id": "n-a1",    "type": "text", "text": "1 cm",        "x": 520, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "answer",    "radiprotocol_answerText": "1 cm" },
    { "id": "n-end",   "type": "text", "text": "Done",        "x": 0,   "y": 240, "width": 200, "height": 60, "radiprotocol_nodeType": "text-block","radiprotocol_content": "Done" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-loop" },
    { "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1",   "label": "проверка" },
    { "id": "e3", "fromNode": "n-loop",  "toNode": "n-end",  "label": "выход" },
    { "id": "e4", "fromNode": "n-q1",    "toNode": "n-a1" },
    { "id": "e5", "fromNode": "n-a1",    "toNode": "n-loop" }
  ]
}
```

**New fixture shape (nested loop for RUN-04):**
```json
{
  "nodes": [
    { "id": "n-start",     "radiprotocol_nodeType": "start",      ... },
    { "id": "n-outer",     "radiprotocol_nodeType": "loop",       "radiprotocol_headerText": "Organ",  ... },
    { "id": "n-inner",     "radiprotocol_nodeType": "loop",       "radiprotocol_headerText": "Lesion", ... },
    { "id": "n-inner-q",   "radiprotocol_nodeType": "question",   "radiprotocol_questionText": "Size?", ... },
    { "id": "n-inner-a",   "radiprotocol_nodeType": "answer",     "radiprotocol_answerText": "1 cm",   ... },
    { "id": "n-end",       "radiprotocol_nodeType": "text-block", "radiprotocol_content": "Done",      ... }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start",   "toNode": "n-outer" },
    { "id": "e2", "fromNode": "n-outer",   "toNode": "n-inner",   "label": "проверка" },
    { "id": "e3", "fromNode": "n-outer",   "toNode": "n-end",     "label": "выход" },
    { "id": "e4", "fromNode": "n-inner",   "toNode": "n-inner-q", "label": "проверка" },
    { "id": "e5", "fromNode": "n-inner",   "toNode": "n-outer",   "label": "выход" },
    { "id": "e6", "fromNode": "n-inner-q", "toNode": "n-inner-a" },
    { "id": "e7", "fromNode": "n-inner-a", "toNode": "n-inner" }
  ]
}
```

**Notes for planner:**
- «выход» is **literal Cyrillic** `в-ы-х-о-д` (6 chars). Not `exit`, not `Exit`.
- Inner loop's «выход» edge points to the OUTER loop node (back up the stack). Outer loop's «выход» edge points to terminal `n-end`.
- The fixture must pass GraphValidator: both loops have exactly one «выход» AND ≥1 body edge.
- Cycle detection (graph-validator.ts:128-187) — both loops are legitimate cycles through a `loop` node and are exempt.

---

### `src/__tests__/runner/protocol-runner.test.ts` — rewrite 7 `.skip` tests + 1 obsolete

**Current skipped tests (per RESEARCH.md + repo grep):**

**Line 260-271 — obsolete:**
```ts
// TODO Phase 44: rewrite for unified loop — RUN-08 (loop-start missing continue edge) теряет смысл...
describe.skip('loop-start missing continue edge (RUN-08)', () => {
  it('transitions to error state when loop-start has no continue edge', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('loop-start.canvas'));
    const state = runner.getState();
    expect(state.status).toBe('error');
    if (state.status !== 'error') return;
    expect(state.message).toMatch(/Loop-start node.*has no 'continue' edge/);
  });
});
```
→ **Action:** Delete (migration-error now covers this; see RESEARCH.md Wave 0 Gaps).

**Line 454-539 — describe.skip with 7 inner tests:**
```ts
// TODO Phase 44: rewrite for unified loop (RUN-01..RUN-07). LoopEndNode удалён, chooseLoopAction
// превращён в @deprecated stub (Phase 43 D-14).
describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)', () => {
  function reachLoopEnd(runner: ProtocolRunner, graph: ProtocolGraph): void { ... }
  it('runner halts at loop-end node after traversing loop body once (LOOP-02)', ...);
  it("chooseLoopAction('again') re-enters loop body and increments iteration to 2 (LOOP-02, LOOP-03)", ...);
  it("chooseLoopAction('done') exits loop and completes protocol (LOOP-02)", ...);
  it("getState() returns loopIterationLabel='Lesion 1' when halted at loop-end on iteration 1 (LOOP-04)", ...);
  it('stepBack() from iteration 2 first question restores iteration 1 loop-end state (LOOP-05)', ...);
  it('per-loop maxIterations cap transitions to error after exceeding limit (RUN-09)', ...);
});
```

**Analog for passing test rhythm** (protocol-runner.test.ts:28-48, `describe('start() — linear protocol traversal (RUN-01, RUN-02)')`):
```ts
describe('start() — linear protocol traversal (RUN-01, RUN-02)', () => {
  it('transitions to at-node state pointing at the first question after start()', () => {
    const runner = new ProtocolRunner();
    const graph = loadGraph('linear.canvas');
    runner.start(graph);
    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('n-q1');
    expect(state.canStepBack).toBe(false);
  });
});
```

**Rewrite mapping (closest passing analog for each rewrite):**

| `.skip` test (current) | Rewrite using | Target behaviour | Analog for shape |
|---|---|---|---|
| `runner halts at loop-end node after traversing loop body once` | `unified-loop-valid.canvas` | After `start()`, runner halts at `n-loop` in `awaiting-loop-pick` status (loop-entry is first auto-advance). | `describe('start() — linear protocol traversal')` `it` block — `runner.start(g); expect(runner.getState().status).toBe('awaiting-loop-pick')`. |
| `chooseLoopAction('again') re-enters loop body and increments iteration` | `unified-loop-valid.canvas` | `chooseLoopBranch(edge.id of "проверка")` → advances to `n-q1`, iteration ticks from 1→2 (via body-branch semantics). | `describe('chooseAnswer() — preset-text answer (RUN-03)')` tests at protocol-runner.test.ts:50+. |
| `chooseLoopAction('done') exits loop and completes` | `unified-loop-valid.canvas` | `chooseLoopBranch(edge.id of "выход")` → pops frame → advances to `n-end` → `complete`. | Same as above; assert `state.status === 'complete'`. |
| `loopIterationLabel === 'Lesion 1' at loop-end iteration 1` | **OBSOLETE** | Assumption A3: no iteration counter in UI. Delete. | N/A |
| `stepBack() from iteration 2 first question restores iteration 1 loop-end state` | `unified-loop-valid.canvas` | Enter loop → `chooseLoopBranch('проверка')` → `chooseAnswer('n-a1')` auto-returns to loop picker iteration 2 → `stepBack()` restores to iteration 1 picker state. | Phase 31 step-back tests in same file (search for `describe('stepBack')`) — same push/pop undo rhythm. |
| `per-loop maxIterations cap transitions to error after exceeding limit (RUN-09)` | **OBSOLETE** | RUN-07 removed the per-loop cap. Auto-advance cycle guard stays but is tested separately at `describe('iteration cap (RUN-09)')` (protocol-runner.test.ts:273-313) which already passes. Delete this `.skip`. | N/A |

**New test files to add (per RESEARCH.md Test Map RUN-01..06):**

- `it('loop picker renders body-branch + «выход» buttons (RUN-01)', …)` — parse `unified-loop-valid.canvas`, `runner.start(g)`, assert `state.status === 'awaiting-loop-pick'` and `state.nodeId === 'n-loop'`.
- `it('dead-end returns to picker with iteration 2 (RUN-02)', …)` — after `chooseLoopBranch(body-edge)` + `chooseAnswer('n-a1')`, assert runner re-halts at picker, `loopContextStack[0].iteration === 2`.
- `it('«выход» pops frame and advances (RUN-03)', …)` — `chooseLoopBranch('e3')` → `state.status === 'complete'`, `loopContextStack.length === 0`.
- `it('nested loops: inner «выход» returns to outer picker (RUN-04)', …)` — use `unified-loop-nested.canvas`, enter outer → enter inner → `chooseLoopBranch(inner-выход)` → state still `awaiting-loop-pick` but `nodeId === 'n-outer'`.
- `it('step-back from loop picker restores pre-loop accumulated text (RUN-05)', …)` — enter loop body, append text via answer, `stepBack()` → asserts text reverts to pre-loop snapshot AND `loopContextStack.length === 0`.

**Notes for planner:**
- Keep the `loadGraph(...)` helper at top of file (line 10-16) — it's used by all other passing tests.
- Add `'unified-loop-nested.canvas'` path as needed.
- Delete only `describe.skip` blocks listed above and the `loop-start missing continue edge` obsolete skip. Do NOT touch any other `describe('...')` / `it('...')` — CLAUDE.md.

---

### `src/__tests__/runner/protocol-runner-session.test.ts` — rewrite 4 `it.skip` + 1 `describe.skip`

**Current skipped tests (per RESEARCH.md Wave 0 Gaps):**

| Line | Current test | Action |
|---|---|---|
| 50 | `it.skip('returns non-null when runner is at-node awaiting user input', ...)` | Rewrite with `unified-loop-valid.canvas`: `runner.start(g)` → serializable state has `runnerStatus === 'awaiting-loop-pick'`, `currentNodeId === 'n-loop'`. |
| 66 | `it.skip('serialized state has all required PersistedSession fields', ...)` | Same as above with broader field assertions. |
| 88 | `it.skip('restores currentNodeId and status correctly', ...)` | Save-restore round-trip; assert `status === 'awaiting-loop-pick'`. |
| 113 | `it.skip('restores accumulatedText correctly (SESSION-05)', ...)` | Same; add `chooseLoopBranch(body-edge)` → `chooseAnswer()` to accumulate text first. |
| 133 | `it.skip('canStepBack is true when undoStack was non-empty in saved state', ...)` | Same; loop-entry pushes undo, so `canStepBack` is true after `runner.start(g)`. |
| 159 | `it.skip('getSerializableState() → JSON.stringify → JSON.parse → restoreFrom() produces identical getState()', ...)` | Same — full round-trip. |
| 336 | `describe.skip('Loop context stack survives session round-trip (SESSION-05)')` with 1 `it` inside | Rewrite to use `chooseLoopBranch(body-edge)` on iteration 2; iteration counter still tested (internal state). Drop the `loopIterationLabel` assertion per Assumption A3. |

**Analog for passing session-test rhythm** (protocol-runner-session.test.ts:191-218):
```ts
describe('session — awaiting-snippet-pick (D-22)', () => {
  it('serializes awaiting-snippet-pick state with snippet node id', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('snippet-node-with-exit.canvas'));
    runner.chooseAnswer('n-a1');
    expect(runner.getState().status).toBe('awaiting-snippet-pick');
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.runnerStatus).toBe('awaiting-snippet-pick');
    expect(serialized.currentNodeId).toBe('n-snippet1');
  });

  it('restores awaiting-snippet-pick round-trip', () => {
    const graph = loadGraph('snippet-node-with-exit.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    runner.chooseAnswer('n-a1');
    const saved = runner.getSerializableState();
    // ... round-trip, restoreFrom, assert status/currentNodeId ...
  });
});
```

**Phase 44 new block (mirror D-22 exactly, swap `snippet-node-with-exit.canvas` → `unified-loop-valid.canvas`, `'awaiting-snippet-pick'` → `'awaiting-loop-pick'`):**
```ts
describe('session — awaiting-loop-pick (RUN-06)', () => {
  it('serializes awaiting-loop-pick state with loop node id', () => {
    const runner = new ProtocolRunner();
    runner.start(loadGraph('unified-loop-valid.canvas'));
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    const serialized = runner.getSerializableState();
    expect(serialized).not.toBeNull();
    if (serialized === null) return;
    expect(serialized.runnerStatus).toBe('awaiting-loop-pick');
    expect(serialized.currentNodeId).toBe('n-loop');
  });

  it('restores awaiting-loop-pick round-trip', () => {
    const graph = loadGraph('unified-loop-valid.canvas');
    const runner = new ProtocolRunner();
    runner.start(graph);
    const saved = runner.getSerializableState();
    if (saved === null) return;
    const deserialized = JSON.parse(JSON.stringify(saved)) as typeof saved;
    const restored = new ProtocolRunner();
    restored.setGraph(graph);
    restored.restoreFrom(deserialized);
    expect(restored.getState().status).toBe('awaiting-loop-pick');
  });
});
```

**Notes for planner:**
- Delete all 6 `it.skip(...)` and the 1 `describe.skip(...)` — Phase 44 replaces them with new passing tests against `unified-loop-valid.canvas`.
- Keep the passing `describe('ProtocolRunner.getSerializableState() (SESSION-01)')` non-skip tests (protocol-runner-session.test.ts:20-44) — they use `linear.canvas`, not loop fixtures.
- Keep the Phase 31 `describe('session — awaiting-snippet-pick (D-22)')` block at line 191 — it passes on `snippet-node-with-exit.canvas`.
- Delete all `loopIterationLabel` assertions in rewritten tests (Assumption A3 — no iteration counter in UI; internal `iteration` is tested via serialized state's `loopContextStack[0].iteration`).

---

## Shared Patterns (cross-cutting)

### Pattern: Zero-Obsidian-imports in `src/runner/` and `src/graph/`

**Source:** protocol-runner.ts:2 (`// Pure module — zero Obsidian API imports (NFR-01)`); runner-state.ts:2; graph-model.ts:2.

**Apply to:** all Phase 44 edits in `src/runner/*.ts`, `src/graph/*.ts`, `src/sessions/*.ts`. ONLY `src/views/runner-view.ts`, `src/views/editor-panel-view.ts`, `src/settings.ts` may touch Obsidian API.

### Pattern: Discriminated-union exhaustiveness

**Source:** protocol-runner.ts:352-357 (`default` arm with `_exhaustive: never`), runner-state.ts:76-83 (RunnerState union), runner-view.ts:489-494 (render switch default).

**Apply to:** adding `AwaitingLoopPickState` to `RunnerState` → TypeScript force-fixes every `switch(state.status)` site:
1. `protocol-runner.ts:308-357` — `getState()` switch
2. `protocol-runner.ts:381-387` — `getSerializableState()` status gate
3. `runner-view.ts:309-494` — `render()` switch
4. `runner-view.ts:250-254` — `handleSelectorSelect` needsConfirmation check (may need `'awaiting-loop-pick'` added)
5. `src/sessions/session-model.ts:51` — `PersistedSession.runnerStatus` union

### Pattern: Undo-before-mutate with loopContextStack spread

**Source:** protocol-runner.ts:84-88 (`chooseAnswer`), 142-147 (`chooseSnippetBranch`), 172-176 (`enterFreeText`), 238-242 (`pickSnippet`).

**Canonical form:**
```ts
this.undoStack.push({
  nodeId: this.currentNodeId,
  textSnapshot: this.accumulator.snapshot(),
  loopContextStack: [...this.loopContextStack],  // shallow spread — frames are primitive-only
});
```

**Apply to:** loop-entry in `case 'loop':` of `advanceThrough()`; `chooseLoopBranch(edgeId)`. NOT in the picker render — that was already covered at entry.

### Pattern: Auto-save-session fire-and-forget after mutations

**Source:** runner-view.ts:355-360 (chooseAnswer click), 374-380 (chooseSnippetBranch click), 393-397 (enterFreeText submit), 594-596 (snippet pick), 606-611 (step-back).

**Canonical form:**
```ts
this.registerDomEvent(btn, 'click', () => {
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');    // Pitfall 7
  this.runner.chooseLoopBranch(edgeId);                             // OR stepBack(), chooseAnswer(...), etc.
  void this.autoSaveSession();                                      // fire-and-forget (NFR-09)
  void this.renderAsync();
});
```

**Apply to:** every new picker click handler in the `case 'awaiting-loop-pick':` render arm, plus the step-back button.

### Pattern: Edge filter over adjacency (labeled traversal)

**Source:** graph-validator.ts:98 — `const outgoing = graph.edges.filter(e => e.fromNodeId === id);` (validator D-08 LOOP-04 enforcement).

**Apply to:** RunnerView picker render (needs `edge.label`) AND `chooseLoopBranch` dispatch (`graph.edges.find(e => e.id === edgeId)`).

**Anti-pattern:** `graph.adjacency.get(loopNodeId)` — returns node IDs only, loses `label`. The whole picker UX depends on labels, so `adjacency` is insufficient.

### Pattern: Per-phase CSS marker (CLAUDE.md)

**Source:** loop-support.css:1 — `/* Phase 6: Loop Support ─────────────────────────────────────────────────── */`.

**Apply to:** Phase 44 appends `/* Phase 44: Unified loop picker (RUN-01) ────────────────────────────────── */` at the bottom of `src/styles/loop-support.css`. Phase 6 block above must remain verbatim.

### Pattern: `syncManualEdit` before every action click (BUG-01)

**Source:** runner-view.ts:356, 376, 394, 623 — pattern repeated across chooseAnswer, chooseSnippetBranch, enterFreeText, handleSnippetPickerSelection. Always `syncManualEdit(preview.value ?? '')` as the first line inside the click handler.

**Apply to:** new `chooseLoopBranch` click handler (Pitfall 7). NOT in the step-back handler (step-back overwrites accumulator from undo snapshot).

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| — | — | Every Phase 44 touchpoint has a direct in-repo analog. Primary analog is the snippet picker (`AwaitingSnippetPickState`, `chooseSnippetBranch`, `pickSnippet`, `case 'awaiting-snippet-pick':` in RunnerView) — all four stages of the loop picker (state type, runner entry, runner exit, view render) mirror its structure verbatim. |

---

## Metadata

**Analog search scope:**
- `src/runner/` (3 files — runner-state.ts, protocol-runner.ts, text-accumulator.ts)
- `src/graph/` (grepped — graph-model.ts, canvas-parser.ts, graph-validator.ts)
- `src/sessions/` (2 files — session-model.ts, session-service.ts)
- `src/views/` (runner-view.ts, editor-panel-view.ts)
- `src/settings.ts`
- `src/canvas/node-color-map.ts`
- `src/styles/loop-support.css` (all 46 lines)
- `src/__tests__/fixtures/` (read `unified-loop-valid.canvas`, enumerated all other fixtures)
- `src/__tests__/runner/protocol-runner.test.ts` (head + loop-block sections)
- `src/__tests__/runner/protocol-runner-session.test.ts` (head + all skip blocks)
- `src/__tests__/settings-tab.test.ts` (full)

**Files scanned:** ~14 source files + 2 test files + 1 CSS file + 1 config (esbuild.config.mjs).

**Pattern extraction date:** 2026-04-17.

**Cross-refs:**
- CLAUDE.md — CSS append-only rule, never-remove rule, build discipline (all apply).
- `.planning/phases/43-.../43-PATTERNS.md` — Phase 43 pattern map; several Phase 43 patterns (discriminated-union exhaustiveness, zero-Obsidian-imports, per-phase markers) carry into Phase 44 unchanged.
- `.planning/phases/43-.../43-CONTEXT.md` D-04, D-13, D-14, D-15 — Phase 43 locked decisions on `loopNodeId` rename, graceful session reject, runner stub, deferred `maxLoopIterations` removal (this Phase 44 completes D-15).
- `.planning/REQUIREMENTS.md` — RUN-01..RUN-07 covered.
- `.planning/ROADMAP.md` Phase 44 success criteria — covered.
- `.planning/STATE.md` Standing Pitfall #10 (`maxIterations` never carries forward) — enforced by three delete sites above.

**Confidence:** HIGH — every excerpt is a literal copy of current repo code; no inference, no paraphrasing.
