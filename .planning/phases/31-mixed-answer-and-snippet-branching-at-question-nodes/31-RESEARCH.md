# Phase 31: Mixed Answer + Snippet Branching at Question Nodes — Research

**Researched:** 2026-04-15
**Domain:** RadiProtocolObsidian — runner state machine extension, graph model, validator relaxation, UI rendering
**Confidence:** HIGH (all findings verified against current source)
**Response language:** ru (user-facing summary at bottom); identifiers and code remain English

---

<user_constraints>

## User Constraints (from 31-CONTEXT.md)

### Locked Decisions

- **D-01** Snippet-нода получает новое поле `radiprotocol_snippetLabel` (string, optional). На развилке snippet-вариант рендерится кнопкой с этим label. Fallback — `📁 Snippet`.
- **D-02** Порядок вариантов на развилке: answers сверху, snippets снизу, разделённые секциями. Snippets визуально помечены префиксом `📁` / CSS-классом. Внутри секций — стабильный порядок обхода исходящих рёбер (как сейчас).
- **D-03** Выбор snippet-варианта вставляет в accumulator **только отрендеренный текст snippet** (без текста question, без label). Placeholders → существующий `SnippetFillInModal`.
- **D-04** Новое поле `radiprotocol_snippetSeparator` (enum `space` | `newline`, optional). Перекрывает глобальный text separator из фазы 15 для этой конкретной snippet-ноды. Применяется **ко всем** snippet-нодам — и branching-вариант этой фазы, и обычный snippet-узел после answer (фаза 30).
- **D-05** Полный reuse picker flow фазы 30: выбор snippet-варианта → picker с `subfolderPath` → drill-down → выбор → modal если placeholders → вставка → runner идёт по outgoing рёбрам snippet-ноды.
- **D-06** Question может иметь любое количество answers + любое количество snippets в любой комбинации; допустим snippet-only question. Каждый snippet — независимый вариант со своим subfolderPath / label / separator.
- **D-07** `graph-validator`: question с outgoing рёбрами к snippet-узлам разрешён молча; snippet-only question разрешён молча. Правило "answer → question/end/snippet" не меняется.
- **D-08** Step-back из открытого snippet picker, если picker открыт выбором на развилке, **закрывает picker и возвращает к списку вариантов на том же question**, не откатывает узел назад. После того как вариант выбран (picker уже открыт), обычный step-back откатывает на предыдущий узел.
- **D-09** Session resume сохраняет `currentNodeId` question + (если snippet-вариант уже выбран и picker открыт) `selectedSnippetVariantNodeId`. Если на момент сейва открыт список вариантов — resume показывает список заново. Drill-down path во picker'е — view-local, как в фазе 30.

### Claude's Discretion

- Имя приватных полей в runner (например `branchSnippetNodeId` vs `selectedSnippetVariantNodeId`)
- Shape расширения `AtNodeState` vs новый статус `awaiting-branch` (исследование ниже рекомендует extend existing state)
- CSS-класс имена для секций answers/snippets на развилке
- Порядок рендера breadcrumb при "branch-entered picker" (можно отличать от обычного picker, а можно оставить идентичным)

### Deferred Ideas (OUT OF SCOPE)

- Условные snippet-варианты (показывать только при условии)
- Mixed branching у answer-узлов
- Multi-snippet выбор
- Изменение поведения answer-узлов при вставке текста

</user_constraints>

<phase_requirements>

## Phase Requirements

Нет явных requirement IDs в REQUIREMENTS.md для этой фазы — success criteria зафиксированы через Decisions D-01…D-09 из CONTEXT.md. Planner должен мапить tasks на D-XX.

| D-ID | Что делаем | Research Support |
|------|-----------|------------------|
| D-01 | add `snippetLabel` field | graph-model + canvas-parser sections |
| D-02 | answers + snippets sections in branch list | runner-view render section |
| D-03 | rendered snippet text only, reuse modal | state machine + picker reuse sections |
| D-04 | per-node `snippetSeparator` override | separator integration section |
| D-05 | full picker reuse | picker reuse section |
| D-06 | mixed/snippet-only branches | validator section |
| D-07 | validator allows silently | validator section |
| D-08 | branch-entered picker step-back returns to branch list | step-back semantics section |
| D-09 | session resume for branch-entered picker | session resume section |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Never delete code you didn't add** in shared files (`src/styles/*`, `src/main.ts`, `src/views/editor-panel-view.ts`, `src/runner/*`, `src/views/runner-view.ts`). Plan tasks MUST be append/modify, not rewrite.
- **CSS append-only per phase** — add new rules at the bottom of `src/styles/runner-view.css` with comment `/* Phase 31: ... */`. Do not touch existing selectors.
- **Do not commit `styles.css`** — it is generated. Run `npm run build` after CSS changes.
- Tests: vitest (`npm test`).

## Summary

Phase 31 расширяет state machine runner'а и модель Snippet-узла так, чтобы question мог иметь outgoing рёбра одновременно к answer- и snippet-узлам. Это мелкая, но тонкая фаза: критические риски — в семантике undoStack (D-08: step-back из branch-entered picker возвращает к branch list, не откатывает узел), в интеграции per-node separator во всех snippet-код-путях (D-04 применяется и к branching, и к post-answer snippet-нодам фазы 30), и в shape session snapshot для resume (D-09).

**Primary recommendation:** Расширить существующий `AtNodeState` полем `snippetBranches?: SnippetBranchOption[]` вместо введения нового статуса — это минимизирует cascade по render-switch / getState / serialize. Для D-08 ввести **второй undoStack-like маркер** `branchReturnState` (или специальный UndoEntry с флагом `returnToBranchList: true`), который step-back консюмирует вместо обычного pop'а. Separator (D-04) — добавить `radiprotocol_snippetSeparator` в `SnippetNode`, обновить `resolveSeparator` overload'ы и гарантировать что оба путя (branching pick и existing Phase 30 pick) используют один helper.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Новые поля snippet-узла (label, separator) | Graph model + parser | Editor panel | Pure data, нет runtime зависимостей |
| Branch список (answers + snippets) рендер | RunnerView (Obsidian UI) | ProtocolRunner (pure) exposes branch data via state | View reads neighbors из graph, runner не знает про DOM |
| Выбор snippet-варианта → открытие picker | ProtocolRunner (state transition) | RunnerView (renders picker reuse) | Transition в `awaiting-snippet-pick` — чистая логика; picker уже рендерится существующим кодом |
| Per-node separator application | ProtocolRunner (pure) | — | Уже централизовано в `resolveSeparator` / `completeSnippet` |
| Step-back branch-entered picker → branch list | ProtocolRunner (new method) | RunnerView (wires button) | Требует новой приватной semantics (см. ниже) |
| Session resume новых полей | `runner-state.ts` + `protocol-runner.getSerializableState` | RunnerView (re-render) | Serialize shape extends existing contract |
| Validator relaxation | `graph-validator.ts` (pure) | — | Удаляется ограничение, не добавляется |

---

## Current State Machine Analysis

### AtNodeState shape (runner-state.ts:26-36)
```ts
export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
  loopIterationLabel?: string;
  isAtLoopEnd?: boolean;
}
```

### How question branching works today
- `ProtocolRunner.advanceThrough` (protocol-runner.ts:515-521): on `case 'question'` → halts, sets `runnerStatus = 'at-node'`, stores `currentNodeId = cursor`. State is indistinguishable from free-text/loop-end halts except by `graph.nodes.get(currentNodeId).kind`.
- `RunnerView.render` (runner-view.ts:320-355) reads `state.currentNodeId`, fetches the node, switches on `node.kind === 'question'`, iterates `graph.adjacency.get(currentNodeId)`, filters `answerNode.kind === 'answer'`, and emits `rp-answer-btn` buttons wired to `runner.chooseAnswer(answerNode.id)`.
- `chooseAnswer` (protocol-runner.ts:73-101): validates target is an `answer` node, pushes UndoEntry BEFORE mutation (invariant — Pitfall 1), appends `answerNode.answerText`, follows `adjacency.get(answerId)[0]`.

### Recommended extension approach

**DO NOT introduce a new `awaiting-branch` status.** Reasons:
1. Every status change cascades into `getState` switch (protocol-runner.ts:288-345), `getSerializableState` whitelist (line 359-373), `restoreFrom` signature (line 415-423), `render` switch in runner-view.ts, and `handleSelectorSelect` status check (line 252-255). Each addition is risk surface for regression.
2. Question node with only answers is functionally identical to today's `at-node` — no need to relabel.
3. Mixed/snippet-only branching is a *rendering* + *routing* concern. Runner state can stay `at-node`; the *routing* of the user's click is the only new behaviour.

**Instead:** keep `runnerStatus = 'at-node'` at question nodes. The VIEW iterates neighbours and partitions them into `answer` vs `snippet` kind (D-02 ordering, D-06 mixed). A new public method `chooseSnippetBranch(snippetNodeId: string)` on ProtocolRunner:
1. Verifies current status is `at-node`, current node is `question`, and target node exists and is `snippet` and is an outgoing neighbour of current node.
2. Pushes UndoEntry BEFORE mutation (Pitfall 1) — snapshotting current question node and accumulator. **Marker field** added to UndoEntry: `returnTarget: 'branch-list' | undefined` (see step-back section).
3. Sets `currentNodeId = snippetNodeId` and `runnerStatus = 'awaiting-snippet-pick'`. That's it — the existing picker rendering in RunnerView handles the rest.

**Alternative considered:** expose the branch list via `AtNodeState.branches?: Array<{kind: 'answer'|'snippet', nodeId: string, label: string}>` — cleaner separation but adds a new field that must be serialised. **Rejected:** the view can derive branches from the graph without runner cooperation. Keeps runner pure and minimises state shape changes.

---

## Step-back / UndoStack Semantics

### Current behaviour (protocol-runner.ts:147-158)
```ts
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return;
  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.loopContextStack = [...entry.loopContextStack];
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```
UndoEntry always fully reverts to a prior `at-node`. Phase 30 relies on this: step-back from `awaiting-snippet-pick` pops the entry pushed by Phase 30 `pickSnippet` (wait — Phase 30's `pickSnippet` is the transition from pick → fill, not into pick; the entry that step-back-from-pick consumes was pushed by the UPSTREAM action that led to advancing into the snippet node, e.g. the `chooseAnswer` that routed to it. See line 84-88.) This is the current contract: step-back from `awaiting-snippet-pick` exits the snippet node entirely and reverts to the predecessor.

### D-08 required semantics

Two distinct entry paths into `awaiting-snippet-pick`:

| Path | How picker was opened | Step-back target |
|------|-----------------------|------------------|
| A (Phase 30) | Runner auto-advanced into a snippet node downstream of an answer (no user click at the snippet node itself) | Predecessor node — existing behaviour |
| B (Phase 31) | User clicked a snippet-variant button on a question branch list | **Back to the branch list of the same question** |

Path B must NOT unwind to the predecessor — the user should be able to re-pick a different branch variant.

### Recommended implementation

Add a flag to `UndoEntry`:

```ts
export interface UndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: LoopContext[];
  /** Phase 31: marks an entry pushed by chooseSnippetBranch. stepBack should restore
   *  currentNodeId to nodeId (the question) and runnerStatus to 'at-node' — NOT pop further. */
  returnToBranchList?: boolean;
}
```

Modified `stepBack`:
```ts
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return;
  if (entry.returnToBranchList === true) {
    // Phase 31 D-08: close the picker, return to the question branch list.
    this.currentNodeId = entry.nodeId;        // question node
    this.accumulator.restoreTo(entry.textSnapshot); // unchanged at branch click time
    this.loopContextStack = [...entry.loopContextStack];
    this.runnerStatus = 'at-node';
    this.snippetId = null;
    this.snippetNodeId = null;
    this.errorMessage = null;
    return;
  }
  // Existing behaviour
  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.loopContextStack = [...entry.loopContextStack];
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```

`chooseSnippetBranch` pushes an UndoEntry with `returnToBranchList: true`. Once the user picks a snippet inside the picker, `pickSnippet` fires its own UndoEntry (Phase 30 behaviour, line 173-177). That entry does NOT have the flag — so after the picker is exited via `pickSnippet`, subsequent `stepBack` pops the normal Phase 30 entry (reverting from fill → pick), then another `stepBack` pops the Phase 31 entry (returning to branch list). **Chain is preserved** and the user can navigate any number of steps back.

### Concrete pre/post states

**Pre-click on snippet variant (branch list open):**
- `runnerStatus = 'at-node'`
- `currentNodeId = <question-id>`
- `undoStack = [... prior entries]`
- `accumulator = "Prior text..."`

**After `chooseSnippetBranch(<snippet-id>)`:**
- `runnerStatus = 'awaiting-snippet-pick'`
- `currentNodeId = <snippet-id>`
- `undoStack = [... prior, { nodeId: <question-id>, textSnapshot: "Prior text...", loopContextStack: [...], returnToBranchList: true }]`
- `accumulator = "Prior text..."` (unchanged)

**After `stepBack()` (picker was open, user hit Step back):**
- `runnerStatus = 'at-node'`
- `currentNodeId = <question-id>`
- `undoStack = [... prior entries]`  (the branch entry is consumed)
- `accumulator = "Prior text..."`
- Branch list re-renders, user can click any answer or snippet variant again.

---

## Picker Reuse Strategy

The runner's `awaiting-snippet-pick` state and RunnerView's `renderSnippetPicker` (runner-view.ts:519-620) are entirely reused. The only hook point is the new transition `chooseSnippetBranch` described above.

Transition diagram:

```
[at-node question]
    │
    ├─► chooseAnswer(a)        → advanceThrough(nextAfterAnswer) [existing]
    │
    └─► chooseSnippetBranch(s) → push UndoEntry{returnToBranchList:true}
                                  currentNodeId = s
                                  runnerStatus = 'awaiting-snippet-pick'
                                  [RETURN — view renders picker]
                                         │
                                         ├─► pickSnippet(snippetId)    [Phase 30, unchanged]
                                         │        ↓
                                         │   awaiting-snippet-fill
                                         │        ↓
                                         │   completeSnippet(rendered)
                                         │        ↓
                                         │   advance via adjacency.get(s)[0]
                                         │
                                         └─► stepBack()
                                                 ↓
                                             [back to branch list at question]
```

**No new public API besides `chooseSnippetBranch`.** `renderSnippetPicker` already uses `this.snippetPickerNodeId` to reset drill-down path when the target snippet node changes (runner-view.ts:450-453). That invariant holds automatically for Path B.

One subtle issue: when user clicks "Step back" inside the picker, current code (runner-view.ts:612-619) calls `this.runner.stepBack()` and then `this.render()`. With the new logic, `stepBack` sees `returnToBranchList: true` and resets to `at-node`; render then shows the question branch list. **No view-side code change needed for the step-back button wiring**, but `this.snippetPickerPath = []; this.snippetPickerNodeId = null;` resets are already present (lines 613-614) — good. Keep them.

---

## Per-node Separator Integration Point (D-04)

### Current state
`ProtocolRunner.resolveSeparator` (protocol-runner.ts:446-452) accepts only `AnswerNode | FreeTextInputNode | TextBlockNode` — SnippetNode is NOT in the union, because today SnippetNode has no `radiprotocol_separator` field. Thus, in `completeSnippet` (lines 189-211):

```ts
const snippetNode = this.graph.nodes.get(pendingNodeId);
const snippetSep = (snippetNode?.kind === 'text-block')
  ? this.resolveSeparator(snippetNode)
  : this.defaultSeparator;  // ← snippet-kind nodes fall through to default, no override possible
```

This is the **exact hook** Phase 31 must extend.

### Required changes

1. Add `radiprotocol_snippetSeparator?: 'newline' | 'space'` to `SnippetNode` in `graph-model.ts`.
   - **Naming note:** keep it `radiprotocol_snippetSeparator` (per D-04, distinct from existing `radiprotocol_separator` on text-block/answer/free-text-input). Rationale: CONTEXT.md specifies this field name verbatim; avoiding reuse of `radiprotocol_separator` prevents collision with the overload union in `resolveSeparator`. Alternatively, planner may decide to reuse `radiprotocol_separator` for all node kinds — but that is a larger refactor and deviates from D-04's naming. **Recommendation: keep the distinct name.**
2. Extend `resolveSeparator` to accept `SnippetNode`:
   ```ts
   private resolveSeparator(
     node: AnswerNode | FreeTextInputNode | TextBlockNode | SnippetNode,
   ): 'newline' | 'space' {
     if (node.kind === 'snippet') {
       return node.radiprotocol_snippetSeparator ?? this.defaultSeparator;
     }
     return node.radiprotocol_separator ?? this.defaultSeparator;
   }
   ```
3. Update `completeSnippet` hook:
   ```ts
   const snippetSep = (snippetNode?.kind === 'text-block' || snippetNode?.kind === 'snippet')
     ? this.resolveSeparator(snippetNode)
     : this.defaultSeparator;
   ```
   This covers BOTH code paths (Phase 30 `awaiting-snippet-pick` entered via auto-advance, AND Phase 31 branch-entered picker) because both end at `completeSnippet(pendingNodeId=<snippet-node-id>)`.
4. Canvas parser: parse `radiprotocol_snippetSeparator` with same value-normalisation as existing `radiprotocol_separator` fields (lines 202-204 / 219-221 / 233-235):
   ```ts
   radiprotocol_snippetSeparator: props['radiprotocol_snippetSeparator'] === 'space' ? 'space'
     : props['radiprotocol_snippetSeparator'] === 'newline' ? 'newline'
     : undefined,
   ```
5. **CRITICAL:** D-04 says override applies to ALL snippet nodes — both branching (Phase 31) and post-answer (Phase 30). The single `completeSnippet` hook above delivers this automatically; no conditional needed. **Verify this in planner: one code change, two functional paths.**

---

## Session Resume Serialization Changes (D-09)

### Current serialisation (protocol-runner.ts:359-389)
```ts
getSerializableState(): {
  runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill';
  currentNodeId: string;
  accumulatedText: string;
  undoStack: Array<{ nodeId; textSnapshot; loopContextStack }>;
  loopContextStack: Array<...>;
  snippetId: string | null;
  snippetNodeId: string | null;
} | null
```

### What changes for Phase 31

- **Case 1 (branch list visible, no snippet variant selected):** runner is in `at-node` at a question node. Existing `currentNodeId` field is sufficient. On resume, view re-derives branch list from graph adjacency. **No serialization change.**
- **Case 2 (snippet variant clicked, picker open, not yet picked):** runner is in `awaiting-snippet-pick` at the snippet node; `currentNodeId = <snippet-id>`. UndoStack contains an entry with `returnToBranchList: true`. For session persistence to round-trip correctly, the UndoStack entries must include the new flag:
  ```ts
  undoStack: Array<{
    nodeId: string;
    textSnapshot: string;
    loopContextStack: Array<{...}>;
    returnToBranchList?: boolean;  // Phase 31
  }>;
  ```
- `restoreFrom` must pass the flag through into reconstructed UndoEntry objects (line 428-432). Deep-copy pattern is already in place.

CONTEXT.md D-09 mentions `selectedSnippetVariantNodeId` as a conceptual field — in practice this is **already** stored as `currentNodeId` once runner transitions into `awaiting-snippet-pick`. No new top-level field needed. Only the UndoStack entry's `returnToBranchList` flag is new.

### Resumable statuses whitelist
Already includes `awaiting-snippet-pick` (line 368-372) — no change needed.

### Drill-down path
View-local `snippetPickerPath` is explicitly not persisted (Phase 30 D-23). On resume the picker re-opens at the snippet node's configured root. Same for Phase 31.

---

## Validator Rule Changes

### Current rule (graph-validator.ts:60-71)
```ts
// Check 5: Dead-end questions — question nodes with no outgoing edges
for (const [id, node] of graph.nodes) {
  if (node.kind === 'question') {
    const outgoing = graph.adjacency.get(id);
    if (!outgoing || outgoing.length === 0) {
      errors.push(`Question "${node.questionText || id}" has no answers. ...`);
    }
  }
}
```

There is currently **NO** rule that requires question outgoing edges to point at `answer` nodes. The existing check only requires non-empty outgoing. **This means mixed and snippet-only question branches are already parser/validator-compatible at the data level** — the gap is purely in runtime rendering and routing.

### What changes for D-07

1. The dead-end message "has no answers" is misleading when the question has snippet-only outgoing edges (D-06: snippet-only is valid). Update the message to "has no outgoing branches" or similar — reword to be agnostic.
2. Confirm no other validator rule silently rejects snippets downstream of a question. Audit:
   - Reachability BFS (line 101-120): fine, works for any edge.
   - Cycle detection (line 128-187): fine, snippet nodes don't introduce cycles of their own.
   - Loop-end orphan check (line 74-84): unrelated.
3. **No new rule needs adding.** D-07 is a relaxation via rewording + affirmative test.

### Tests to add / update in `src/__tests__/graph-validator.test.ts`

- **New test:** `it('accepts question with only snippet outgoing edges silently')` — construct a question → snippet canvas, assert `validate()` returns `[]`.
- **New test:** `it('accepts question with mixed answer + snippet outgoing edges silently')` — construct question → [answer, snippet], assert `validate()` returns `[]`.
- **Updated test:** line 38 `'detects dead-end question with no outgoing edges'` — message text may change; update the expected substring.
- Confirm: existing test `'detects dead-end question...'` still passes against the new wording.

---

## Renderer Changes (RunnerView)

### Current (runner-view.ts:332-355)
Question node case: single `rp-answer-list` div, iterate adjacency, filter `kind === 'answer'`, emit buttons.

### New structure (D-02)

```ts
case 'question': {
  questionZone.createEl('p', { text: node.questionText, cls: 'rp-question-text' });
  const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];

  // Partition in adjacency order
  const answerNeighbors: AnswerNode[] = [];
  const snippetNeighbors: SnippetNode[] = [];
  for (const nid of neighborIds) {
    const n = this.graph.nodes.get(nid);
    if (n === undefined) continue;
    if (n.kind === 'answer') answerNeighbors.push(n);
    else if (n.kind === 'snippet') snippetNeighbors.push(n);
  }

  // D-02: answers first
  if (answerNeighbors.length > 0) {
    const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });  // existing class — reused
    for (const answerNode of answerNeighbors) {
      const btn = answerList.createEl('button', {
        cls: 'rp-answer-btn',
        text: answerNode.displayLabel ?? answerNode.answerText,
      });
      this.registerDomEvent(btn, 'click', () => {
        this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
        this.runner.chooseAnswer(answerNode.id);
        void this.autoSaveSession();
        void this.renderAsync();
      });
    }
  }

  // D-02: snippets below
  if (snippetNeighbors.length > 0) {
    const snippetList = questionZone.createDiv({ cls: 'rp-snippet-branch-list' });  // NEW Phase 31
    for (const snippetNode of snippetNeighbors) {
      const label = snippetNode.snippetLabel && snippetNode.snippetLabel.length > 0
        ? `📁 ${snippetNode.snippetLabel}`
        : '📁 Snippet';  // D-01 fallback
      const btn = snippetList.createEl('button', {
        cls: 'rp-snippet-branch-btn',  // NEW Phase 31
        text: label,
      });
      this.registerDomEvent(btn, 'click', () => {
        this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
        this.runner.chooseSnippetBranch(snippetNode.id);
        void this.autoSaveSession();
        void this.renderAsync();
      });
    }
  }
  break;
}
```

**Critical:** this edit is inside a shared switch block in runner-view.ts. Per CLAUDE.md, do NOT delete or rewrite unrelated branches (`free-text-input`, `loop-end`, default). Only replace the body of `case 'question'`.

### CSS additions (src/styles/runner-view.css — append-only)

```css
/* Phase 31: mixed answer + snippet branches at question nodes */
.rp-snippet-branch-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.rp-snippet-branch-btn {
  /* visual distinction from rp-answer-btn — e.g., folder-ish accent */
}
```

**Do not touch** existing `.rp-answer-list`, `.rp-answer-btn`, Phase 30 picker classes. Add new rules **at the bottom** of the file with the phase comment.

After CSS change: `npm run build` to regenerate `styles.css`. Do not commit `styles.css` by hand.

---

## Editor Panel Field Additions

### Existing pattern (editor-panel-view.ts:566-613)
`case 'snippet'` currently renders a single async-populated dropdown for `radiprotocol_subfolderPath`. Pattern: `new Setting(container).setName(...).setDesc(...).addDropdown(...)` + `pendingEdits[key]` + `scheduleAutoSave()`.

### New fields

Add two new `Setting` rows inside the `case 'snippet'` block, **below** the existing subfolderPath dropdown (append, not rewrite):

```ts
// Phase 31: snippetLabel (D-01)
new Setting(container)
  .setName('Branch label')
  .setDesc('Shown on the question branch list when this snippet node is an outgoing neighbour. Empty → "📁 Snippet".')
  .addText(t => {
    t.setValue((nodeRecord['radiprotocol_snippetLabel'] as string | undefined) ?? '')
     .onChange(v => {
       this.pendingEdits['radiprotocol_snippetLabel'] = v || undefined;
       this.scheduleAutoSave();
     });
  });

// Phase 31: snippetSeparator (D-04)
new Setting(container)
  .setName('Separator override')
  .setDesc('Overrides the global text separator when this snippet is appended to the output.')
  .addDropdown(drop => {
    drop.addOption('', '— use global default —');
    drop.addOption('newline', 'Newline');
    drop.addOption('space', 'Space');
    const current = (nodeRecord['radiprotocol_snippetSeparator'] as string | undefined) ?? '';
    drop.setValue(current);
    drop.onChange(v => {
      this.pendingEdits['radiprotocol_snippetSeparator'] = v === '' ? undefined : v;
      this.scheduleAutoSave();
    });
  });
```

**Critical:** CLAUDE.md forbids removing existing code in `editor-panel-view.ts`. The Phase 29/30 subfolderPath dropdown MUST remain untouched. The two new Settings append inside the same `case 'snippet'` block, after the closing `})();` of the void IIFE at line 611.

---

## Canvas Parser Changes

In `src/graph/canvas-parser.ts` `case 'snippet'` (lines 261-272), extend the SnippetNode construction:

```ts
case 'snippet': {
  const rawPath = props['radiprotocol_subfolderPath'];
  const rawLabel = props['radiprotocol_snippetLabel'];
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    subfolderPath: (typeof rawPath === 'string' && rawPath !== '') ? rawPath : undefined,
    snippetLabel: (typeof rawLabel === 'string' && rawLabel !== '') ? rawLabel : undefined,
    radiprotocol_snippetSeparator:
      props['radiprotocol_snippetSeparator'] === 'space' ? 'space'
      : props['radiprotocol_snippetSeparator'] === 'newline' ? 'newline'
      : undefined,
  };
  return node;
}
```

Follow Phase 30 WR-02 convention: empty string and null both normalise to `undefined`.

### Tests in `src/__tests__/canvas-parser.test.ts`

- Parse a canvas with a snippet node that has `radiprotocol_snippetLabel: 'Adrenal nodule'` → assert `graph.nodes.get('...').snippetLabel === 'Adrenal nodule'`.
- Parse with empty string → assert `snippetLabel === undefined`.
- Parse with `radiprotocol_snippetSeparator: 'space'` → assert value.
- Parse with invalid value → assert `undefined`.

---

## Validation Architecture

Nyquist validation is enabled (`.planning/config.json` does not disable it). Test framework: **vitest**, invoked via `npm test`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `vitest.config.ts` (project root) |
| Quick run | `npm test -- --run <pattern>` |
| Full suite | `npm test -- --run` |

### Decision → Test Map

| D-ID | Behavior | Test Type | Command | File Exists? |
|------|----------|-----------|---------|--------------|
| D-01 | snippetLabel parsed from canvas | unit | `npm test -- --run canvas-parser` | ✅ existing file |
| D-01 | branch list shows `📁 Label` fallback to `📁 Snippet` | unit (RunnerView DOM) | `npm test -- --run RunnerView` | ✅ existing file |
| D-02 | answers section above snippets section | unit (RunnerView DOM) | `npm test -- --run RunnerView` | ✅ |
| D-03 | picking snippet variant appends only rendered template text | unit (ProtocolRunner) | `npm test -- --run protocol-runner` | ✅ |
| D-04 | per-node snippetSeparator overrides default | unit | `npm test -- --run protocol-runner` | ✅ |
| D-04 | override applies to Phase 30 post-answer snippet nodes too | unit | `npm test -- --run protocol-runner` | ✅ |
| D-05 | chooseSnippetBranch transitions into awaiting-snippet-pick | unit | `npm test -- --run protocol-runner` | ✅ |
| D-06 | question with snippet-only branches is valid | unit (validator) | `npm test -- --run graph-validator` | ✅ |
| D-06 | question with mixed branches is valid | unit | `npm test -- --run graph-validator` | ✅ |
| D-07 | validator remains silent on relaxed cases | unit | `npm test -- --run graph-validator` | ✅ |
| D-08 | step-back from branch-entered picker returns to branch list | unit (ProtocolRunner) | `npm test -- --run protocol-runner` | ✅ |
| D-08 | step-back from Phase 30 picker still reverts to predecessor | regression | `npm test -- --run protocol-runner` | ✅ |
| D-09 | serialize/restoreFrom round-trip preserves `returnToBranchList` flag | unit | `npm test -- --run protocol-runner-session` | ✅ existing file |

### Sampling Rate
- **Per task commit:** `npm test -- --run protocol-runner canvas-parser graph-validator RunnerView` (targeted)
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** full suite green + TypeScript build (`npm run build`) green before `/gsd-verify-work`.

### Wave 0 Gaps
None — all test files already exist. No fixtures needed beyond inline canvas JSON literals used in existing test patterns.

---

## Common Pitfalls

### Pitfall 1: UndoEntry order (established invariant)
Push UndoEntry BEFORE any mutation in `chooseSnippetBranch` — mirrors Phase 2 D-03 / Phase 30 D-08. Violation breaks step-back.

### Pitfall 2: Separator override forgotten on Phase 30 path
D-04 explicitly applies to ALL snippet nodes. If the planner only wires the override into the branching path, the Phase 30 post-answer path silently ignores `radiprotocol_snippetSeparator`. The fix is a single edit to `completeSnippet`'s `snippetSep` computation — planner must verify both tests (D-04 × 2) pass.

### Pitfall 3: returnToBranchList flag lost on serialization
`getSerializableState` and `restoreFrom` both deep-copy UndoEntry arrays. The flag must be included in both copy loops or session resume will silently degrade step-back semantics after reload.

### Pitfall 4: Silent deletion of unrelated code in shared files
`src/views/runner-view.ts`, `src/views/editor-panel-view.ts`, `src/runner/protocol-runner.ts`, and `src/styles/runner-view.css` are all in CLAUDE.md's "never remove code" list. Plan tasks must include explicit "append/modify only" instructions and reviewer checks.

### Pitfall 5: `syncManualEdit` before `chooseSnippetBranch`
The existing answer-click handler (runner-view.ts:347-352) calls `syncManualEdit` BEFORE `chooseAnswer` to capture manual edits from the preview textarea. The new snippet-branch handler must do the same (it's in the pseudo-code above). Forgetting this silently drops manual edits.

### Pitfall 6: Exhaustiveness check breakage in `resolveSeparator`
Adding `SnippetNode` to the accepted union will not trigger a TS error in existing call sites that narrow by kind — but if `completeSnippet` is changed to call `resolveSeparator(snippetNode)` without narrowing (i.e., `snippetNode?.kind === 'snippet'`), TypeScript will complain unless the union is updated. Both changes must land together.

### Pitfall 7: Validator message wording used in tests
The existing test at graph-validator.test.ts:38 asserts on error strings. Rewording "has no answers" → "has no outgoing branches" requires updating the test's expected substring. Don't leave test on the floor.

---

## Code Examples

### Applying per-node snippet separator (completeSnippet diff)

```ts
// protocol-runner.ts ~line 193-198, diff
- const snippetSep = (snippetNode?.kind === 'text-block')
-   ? this.resolveSeparator(snippetNode)
-   : this.defaultSeparator;
+ const snippetSep =
+   (snippetNode?.kind === 'text-block' || snippetNode?.kind === 'snippet')
+     ? this.resolveSeparator(snippetNode)
+     : this.defaultSeparator;
```

### chooseSnippetBranch (new public method, pure)

```ts
/**
 * Phase 31 D-05, D-08: user clicked a snippet variant on a question's branch list.
 * Transitions into awaiting-snippet-pick at the selected snippet node.
 * The UndoEntry is flagged so stepBack returns to the branch list (not the predecessor).
 */
chooseSnippetBranch(snippetNodeId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const questionNode = this.graph.nodes.get(this.currentNodeId);
  if (questionNode === undefined || questionNode.kind !== 'question') return;

  // Ensure snippetNodeId is an outgoing neighbour of the current question
  const neighbors = this.graph.adjacency.get(this.currentNodeId) ?? [];
  if (!neighbors.includes(snippetNodeId)) return;

  const target = this.graph.nodes.get(snippetNodeId);
  if (target === undefined || target.kind !== 'snippet') return;

  // Pitfall 1: undo-before-mutate, with returnToBranchList flag (D-08)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
    returnToBranchList: true,
  });

  this.currentNodeId = snippetNodeId;
  this.runnerStatus = 'awaiting-snippet-pick';
}
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `radiprotocol_snippetSeparator` name is preferred over reusing `radiprotocol_separator` | Separator section | Minor — planner can rename; D-04 text uses `radiprotocol_snippetSeparator` verbatim so this is a CITED decision, not an assumption |
| A2 | No existing validator rule blocks question→snippet edges | Validator section | VERIFIED by reading graph-validator.ts — no such rule exists |
| A3 | Phase 30's existing `renderSnippetPicker` works identically whether entered via auto-advance or branch click | Picker reuse section | VERIFIED by code read — picker reads only `state.nodeId` and `state.subfolderPath`; no entry-path discriminator in its logic |
| A4 | `snippetPickerPath`/`snippetPickerNodeId` reset on step-back from picker correctly handles branch-list return | Renderer section | VERIFIED — runner-view.ts:613-614 already clears these; re-rendering at-node question branch list uses fresh graph adjacency |
| A5 | Session resume for "branch list visible, no variant picked" requires zero changes | Session section | HIGH confidence — runner stays in `at-node` at question; existing serialisation covers it |

All major claims verified against source. No unverified assumptions carry through to plan.

---

## Open Questions (RESOLVED)

1. RESOLVED: **CSS styling detail for snippet-branch buttons** — differentiator is left to planner's discretion (D-02 says "prefix `📁` и/или CSS-классом"). Both are available; prefix is already in the button text per pseudo-code. Recommendation: keep prefix + add a subtle background-tint class to match the folder-row style used in the Phase 30 picker for visual consistency.
2. RESOLVED: **snippetLabel field naming in TypeScript interface** — CONTEXT.md uses `radiprotocol_snippetLabel` for the canvas property name. TypeScript field can be `snippetLabel` (mirroring `subfolderPath` which drops the prefix) for consistency. Canvas-parser maps one to the other. **Recommendation: use `snippetLabel` on the interface, keep `radiprotocol_snippetLabel` as the canvas key.**
3. RESOLVED: **Backwards compatibility** — existing canvases with snippet nodes already in use (if any) have neither new field. Parser normalises missing → `undefined`, so the runner falls back to global separator and the fallback label `📁 Snippet`. No migration needed.

---

## Sources

### Primary (HIGH confidence — source code read in this session)
- `src/runner/protocol-runner.ts` — full read, lines 1-600
- `src/runner/runner-state.ts` — full read
- `src/graph/graph-model.ts` — full read
- `src/graph/graph-validator.ts` — full read
- `src/graph/canvas-parser.ts` — full read
- `src/views/runner-view.ts` — full read
- `src/views/editor-panel-view.ts` — `case 'snippet'` block (lines 566-613)
- `.planning/phases/31-.../31-CONTEXT.md` — user decisions D-01..D-09
- `.planning/phases/30-.../30-CONTEXT.md` — Phase 30 decisions (state machine contract)
- `.planning/phases/29-.../29-CONTEXT.md` — Phase 29 decisions (snippet model baseline)
- `./CLAUDE.md` — project rules

### Secondary
- `src/__tests__/graph-validator.test.ts` — line 38 dead-end test (to be updated)

### Tertiary
None — no WebSearch or external docs needed for this phase; all domain knowledge is in-repo.

---

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — phase uses existing libraries and patterns; no new dependencies.
- State machine extension design: HIGH — verified every touchpoint by direct code read.
- Step-back semantics: HIGH — validated the undo-chain invariant against current `stepBack` and `pickSnippet` code.
- Separator integration: HIGH — found the exact line (protocol-runner.ts:195) and the fix is mechanical.
- Session resume: HIGH — round-trip flag inclusion is the only delta; serialisation shape otherwise unchanged.
- Validator: HIGH — no rule blocks the new cases today; change is a test-add + message rewording.

**Research date:** 2026-04-15
**Valid until:** ~30 days (stable — no fast-moving external ecosystem)

---

## Краткое резюме (ru)

Фаза 31 — хирургическое расширение существующих инвариантов, а не новая подсистема.

1. **Не вводить новый статус `awaiting-branch`** — оставить `at-node` у question и партиционировать соседей на answers и snippets в render-коде RunnerView. Добавить на ProtocolRunner новый pure-метод `chooseSnippetBranch(snippetNodeId)` который делает undo-before-mutate (с флагом `returnToBranchList: true`) и переводит в существующий `awaiting-snippet-pick`. Весь Phase 30 picker-UI переиспользуется без единой правки.
2. **Step-back из branch-entered picker (D-08)** реализуется флагом `returnToBranchList?: boolean` на `UndoEntry`. Метод `stepBack()` при `returnToBranchList === true` откатывает в `at-node` на question-ноду вместо полного отката. Цепочка undo'шек остаётся консистентной для любого количества шагов назад.
3. **Per-node separator (D-04)** — добавить `radiprotocol_snippetSeparator` в `SnippetNode`, расширить union `resolveSeparator`, и ОДНОЙ строкой правки в `completeSnippet` (protocol-runner.ts ~195) включить `snippet`-kind в проверку. Это автоматически покрывает и branching-path этой фазы, и post-answer path фазы 30 — одно изменение, две функциональных дорожки. Это главный пункт, который можно случайно недоделать.
4. **Validator (D-07)** — правила, блокирующего question → snippet, **в коде сейчас нет**. Достаточно переформулировать message "has no answers" в чём-то вроде "has no outgoing branches" и добавить два позитивных теста (mixed, snippet-only).
5. **Session resume (D-09)** — менять только shape UndoStack entries (добавить optional `returnToBranchList` в copy loops `getSerializableState` и `restoreFrom`). Top-level shape не расширять.
6. **Editor panel** — два новых `Setting` (текст + dropdown) добавляются в конец `case 'snippet'`. CLAUDE.md запрещает удаление/переписывание существующего subfolderPath-dropdown — только append.
7. **CSS** — новый блок `/* Phase 31: ... */` в конце `src/styles/runner-view.css`, `npm run build` после правки, `styles.css` не коммитить вручную.

Все тесты покрываются существующими vitest-файлами — **Wave 0 gaps: нет**.

Главные риски: Pitfall 2 (забыть separator на Phase 30 пути), Pitfall 3 (потерять флаг в serialize/restore), Pitfall 4 (случайное удаление чужого кода в shared files).
