# Phase 2: Core Protocol Runner Engine — Research

**Researched:** 2026-04-06
**Domain:** TypeScript state-machine traversal engine — pure module, zero Obsidian API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `ProtocolRunner` exposes separate methods per action — `start(graph)`, `chooseAnswer(answerId)`, `enterFreeText(text)`, `stepBack()`, `completeSnippet(renderedText)`, `getState()`. No polymorphic `advance()` method.
- **D-02:** `getState()` returns a discriminated union snapshot — callers never access internal fields directly.
- **D-03:** One undo entry = one user action (answer choice or free-text entry). Text-block auto-advances that happen after an answer are bundled into that answer's undo entry. `stepBack()` reverts to the state before the last user action — not to the last node visit.
- **D-04:** `TextAccumulator` stores full text snapshots (not diffs) per undo entry. Revert is O(1) and cannot partially corrupt text (RUN-07).
- **D-05:** When `ProtocolRunner` reaches a `loop-start` node, it immediately transitions to `error` state with message: `"Loop nodes are not yet supported — upgrade to Phase 6"`. No partial traversal of loop bodies in Phase 2.
- **D-06:** When runner reaches a `TextBlockNode` with a `snippetId`, it transitions to `awaiting-snippet-fill` state carrying `{ snippetId, nodeId }`. Phase 5 renders the snippet externally and calls `runner.completeSnippet(renderedText: string)`. Runner appends the ready string to accumulated text and advances.
- **D-07:** In Phase 2, the `awaiting-snippet-fill` state is reachable in tests by constructing a `TextBlockNode` with a `snippetId`. `completeSnippet(renderedText)` is implemented and tested.
- **D-08:** Hard maximum iteration count default: 50 (RUN-09). Configurable via `maxIterations` option passed to `ProtocolRunner` constructor.

### Claude's Discretion

- Internal undo stack data structure (array of snapshots vs. linked list)
- Exact shape of `RunnerState` discriminated union beyond what RUN-08 specifies
- How `start()` handles a graph that fails validation (error state vs. throw)
- Test fixture design for Phase 2 (extend existing fixtures or add new ones)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | Open any `.canvas` file as a guided protocol session via an Obsidian command | Runner `start(graph)` accepts a pre-parsed `ProtocolGraph`; the command wiring lives in Phase 3 UI |
| RUN-02 | Present one question at a time; never show multiple questions simultaneously | `getState()` returns one `currentNodeId`; view renders it; enforced by state machine design |
| RUN-03 | Support preset-text answer buttons: clicking appends `answerText` to accumulated text and advances | `chooseAnswer(answerId)` resolves `AnswerNode`, appends `answerText`, follows edge |
| RUN-04 | Support free-text input nodes: user-typed text is wrapped with `prefix`/`suffix` then appended | `enterFreeText(text)` reads `FreeTextInputNode.prefix/suffix`, assembles final string |
| RUN-05 | Support text-block nodes: static text auto-appended on reach, no user interaction | Runner detects `kind === 'text-block'` during advance and auto-appends; bundled into enclosing undo entry (D-03) |
| RUN-06 | Step-back reverts both navigation state and accumulated protocol text to previous snapshot | `stepBack()` pops `UndoEntry`, restores `currentNodeId` + `textBeforeStep` |
| RUN-07 | `TextAccumulator` uses full snapshots (not diffs); revert is O(1) | `TextAccumulator.snapshot()` / `restoreTo(snapshot)` pattern — confirmed locked by D-04 |
| RUN-08 | Runner state machine uses discriminated union with five states: `idle`, `at-node`, `awaiting-snippet-fill`, `complete`, `error` | `RunnerStatus` stub already exists in `runner-state.ts`; Phase 2 fills in full `RunnerState` type |
| RUN-09 | Configurable hard maximum iteration count (default 50) on loop nodes | `maxIterations` constructor option; counter increments on each `advance()` call; triggers `error` state |

</phase_requirements>

---

## Summary

Phase 2 implements three pure TypeScript modules — `ProtocolRunner`, `TextAccumulator`, and the full `RunnerState` discriminated union — inside `src/runner/`. All three have zero Obsidian API imports and are exercised exclusively through Vitest unit tests. The inputs (`ProtocolGraph`) are fully defined by Phase 1; the outputs (the `RunnerState` discriminated union) are the API surface Phase 3 (UI) will consume.

The core algorithmic challenge is the traversal loop with three distinct advance-triggering scenarios: user chooses an answer (`chooseAnswer`), user submits free text (`enterFreeText`), and user completes a snippet fill-in (`completeSnippet`). A fourth operation, `stepBack`, runs the undo path. All four must maintain the undo stack correctly. Text-block nodes auto-advance without entering the undo stack as a separate entry — they bundle with the preceding user action.

The `awaiting-snippet-fill` state and `completeSnippet` method must be fully wired in Phase 2 even though no snippet modal exists yet. This is deliberate: Phase 5 only adds the modal and calls the already-present method; the runner itself does not change structurally. Similarly, the `loop-start` error branch must be a single, clearly-commented location so Phase 6 replaces exactly that block.

**Primary recommendation:** Implement `TextAccumulator` first (it is a simple append buffer with snapshot/restore), then build `ProtocolRunner` by implementing each state transition as a private method, then wire the public API (`start`, `chooseAnswer`, `enterFreeText`, `stepBack`, `completeSnippet`, `getState`) as thin orchestration over those private methods.

---

## Standard Stack

### Core (all already installed — Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Language | Project-wide; `noUncheckedIndexedAccess` enabled |
| Vitest | ^4.1.2 | Unit test runner | Pure Node.js env; no Obsidian runtime required |
| `@types/node` | ^22.0.0 | Node.js type defs | Used in test files (`node:fs`, `node:path` for fixture loading) |

[VERIFIED: package.json in project root]

### No New Dependencies Required

Phase 2 is pure logic. No new packages need to be installed. The undo stack is a plain `Array<UndoEntry>` (Claude's Discretion area — array is simpler than linked list for this use case; protocol sessions have at most dozens of undo entries).

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (runner module)

```
src/runner/
├── runner-state.ts        # RunnerState discriminated union (5 states) + UndoEntry
├── text-accumulator.ts    # TextAccumulator class — append buffer + snapshot/restore
└── protocol-runner.ts     # ProtocolRunner class — state machine + traversal

src/__tests__/
├── fixtures/
│   ├── linear.canvas              # Already exists (Phase 1)
│   ├── branching.canvas           # Already exists (Phase 1)
│   ├── text-block.canvas          # NEW: start → question → answer → text-block → complete
│   ├── snippet-block.canvas       # NEW: text-block node with snippetId field
│   └── loop-start.canvas          # NEW: contains a loop-start node for error-state test
├── canvas-parser.test.ts          # Already exists (Phase 1)
├── graph-validator.test.ts        # Already exists (Phase 1)
├── text-accumulator.test.ts       # NEW: Phase 2
└── protocol-runner.test.ts        # NEW: Phase 2
```

### Pattern 1: RunnerState Discriminated Union

**What:** Each runner state is a separate interface carrying only the data it needs. The union is the single public return type of `getState()`.

**When to use:** Always. Callers narrow with `switch (state.status)` — TypeScript exhaustiveness checking then ensures all states are handled.

```typescript
// Source: .planning/research/ARCHITECTURE.md §3 + existing runner-state.ts stub
// runner/runner-state.ts

export interface IdleState {
  status: 'idle';
}

export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;           // true if undoStack is non-empty
}

export interface AwaitingSnippetFillState {
  status: 'awaiting-snippet-fill';
  snippetId: string;
  nodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}

export interface CompleteState {
  status: 'complete';
  finalText: string;
}

export interface ErrorState {
  status: 'error';
  message: string;
}

export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;
```

**Note on `canStepBack`:** Exposing this boolean in the snapshot avoids forcing Phase 3 UI to re-derive undo availability. The internal undo stack itself is NOT exposed in the snapshot (D-02).

**Note on `loopContextStack`:** The architecture research includes `loopContextStack` in `AtNodeState`. Since Phase 2 errors immediately on `loop-start` nodes (D-05), this field is deferred to Phase 6. Including it now as an empty field would add noise; omit it in Phase 2, and Phase 6 adds it when loop support lands.

### Pattern 2: UndoEntry — Full Snapshot Strategy

**What:** Each user action (answer choice or free-text entry) pushes one `UndoEntry` before mutating state. `stepBack()` pops the top entry and restores all snapshotted fields.

**When to use:** Every `chooseAnswer()` and `enterFreeText()` call. Text-block auto-advances do NOT push their own entry (D-03).

```typescript
// runner/runner-state.ts (internal type, not exported as part of public API)
interface UndoEntry {
  nodeId: string;          // currentNodeId BEFORE this action
  textSnapshot: string;    // accumulatedText BEFORE this action
}
```

**Correctness guarantee:** Because the snapshot is taken before any mutation, `stepBack()` is unconditionally correct even when text-blocks or chained auto-advances have modified `accumulatedText` after the user action.

### Pattern 3: TextAccumulator Class

**What:** Append-only text buffer. Phase 2 implements two operations: `append(text)` and the snapshot pair `snapshot()` / `restoreTo(s)`.

```typescript
// Source: .planning/research/ARCHITECTURE.md §3 "Text Accumulation"
// runner/text-accumulator.ts
export class TextAccumulator {
  private buffer = '';

  append(text: string): void {
    this.buffer += text;
  }

  get current(): string {
    return this.buffer;
  }

  snapshot(): string {
    return this.buffer;   // string is immutable in JS — this is a safe value copy
  }

  restoreTo(snapshot: string): void {
    this.buffer = snapshot;
  }
}
```

[VERIFIED: .planning/research/ARCHITECTURE.md §3]

### Pattern 4: ProtocolRunner Internal Advance Loop

**What:** After a user action mutates state, the runner enters an internal auto-advance loop that processes text-block nodes (and eventually, in Phase 6, loop-end nodes) without requiring another user call.

**When to use:** Inside `chooseAnswer()`, `enterFreeText()`, and `completeSnippet()` after the primary action completes. The loop runs until it reaches a node that requires user input (`question`, `free-text-input`) or a terminal condition (`complete`, `error`, `awaiting-snippet-fill`).

```typescript
// runner/protocol-runner.ts (internal private method)
private advanceThrough(nodeId: string): void {
  let cursor = nodeId;
  let steps = 0;

  while (true) {
    steps += 1;
    if (steps > this.maxIterations) {
      this.transitionToError(
        `Iteration cap reached (${this.maxIterations}). Possible cycle in protocol.`
      );
      return;
    }

    const node = this.graph.nodes.get(cursor);
    if (node === undefined) {
      this.transitionToError(`Node '${cursor}' not found in graph.`);
      return;
    }

    switch (node.kind) {
      case 'start': {
        // Auto-advance through start node
        const next = this.firstNeighbour(cursor);
        if (next === undefined) { this.transitionToComplete(); return; }
        cursor = next;
        break;
      }
      case 'text-block': {
        if (node.snippetId !== undefined) {
          this.transitionToAwaitingSnippet(node.snippetId, cursor);
          return;
        }
        this.accumulator.append(node.content);
        const next = this.firstNeighbour(cursor);
        if (next === undefined) { this.transitionToComplete(); return; }
        cursor = next;
        break;
      }
      case 'question':
      case 'free-text-input': {
        this.currentNodeId = cursor;
        // Stays in at-node — user input required
        return;
      }
      case 'answer': {
        // Answers are always navigated to from questions, then immediately followed
        this.accumulator.append(node.answerText);
        const next = this.firstNeighbour(cursor);
        if (next === undefined) { this.transitionToComplete(); return; }
        cursor = next;
        break;
      }
      case 'loop-start': {
        // D-05: Phase 2 stub — replaced in Phase 6
        this.transitionToError(
          'Loop nodes are not yet supported — upgrade to Phase 6'
        );
        return;
      }
      case 'loop-end': {
        this.transitionToError(
          'Loop nodes are not yet supported — upgrade to Phase 6'
        );
        return;
      }
      default: {
        // TypeScript exhaustiveness check — should never reach here
        const _exhaustive: never = node;
        this.transitionToError(`Unknown node kind encountered.`);
        return;
      }
    }
  }
}
```

**Important design note on `answer` node traversal:** When the user calls `chooseAnswer(answerId)`, the runner resolves the `AnswerNode` (to get `answerText`), appends it, then calls `advanceThrough(nextNeighborOfAnswer)`. The answer node itself is passed as the starting cursor in some designs, but it is simpler and more correct to resolve the answer node directly and advance to its outgoing neighbor. Either approach is valid — the planner should choose one and be consistent.

### Pattern 5: `chooseAnswer` with Undo Entry

```typescript
// runner/protocol-runner.ts
chooseAnswer(answerId: string): void {
  if (this.status !== 'at-node') return;  // Guard: only valid in at-node state

  const answerNode = this.graph.nodes.get(answerId);
  if (answerNode === undefined || answerNode.kind !== 'answer') {
    this.transitionToError(`Answer node '${answerId}' not found.`);
    return;
  }

  // Push undo entry BEFORE any mutation (D-03, D-04)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
  });

  // Append the chosen answer's text
  this.accumulator.append(answerNode.answerText);

  // Auto-advance through any following text-blocks
  const next = this.firstNeighbour(answerId);
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  this.advanceThrough(next);
}
```

### Anti-Patterns to Avoid

- **Diff-based text undo:** Store `textBeforeStep` as a full string, not a delta. The snapshot is the correct approach per D-04 and RUN-07.
- **Exposing the undo stack in `getState()`:** Only expose `canStepBack: boolean`. Callers do not need the full stack. Exposing it would let callers depend on internal structure.
- **Separate undo entries for text-block auto-advances:** Text-block traversal is bundled into the immediately preceding user action (D-03). Pushing an entry per text-block would make `stepBack()` skip back one text-block at a time instead of one user decision at a time.
- **Throwing exceptions from public methods:** State transitions to `error` state instead. The runner never throws (except in programmer-error situations guarded by the `never` exhaustiveness check). This keeps the caller free from try/catch.
- **Importing from `'obsidian'` in any file under `src/runner/` or `src/graph/`:** NFR-01 prohibits this. The Vitest test run in a pure Node.js environment and will fail to load any module that imports from `'obsidian'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot immutability | Custom deep-clone | `string` assignment (JS strings are immutable values) | `this.buffer` is a primitive string — assignment copies the value, not a reference |
| Undo stack | Linked-list, LRU cache, or command pattern | Plain `Array<UndoEntry>` with `push`/`pop` | Protocol sessions have at most ~50 steps; O(n) is negligible; array is simplest |
| Type narrowing | `typeof`/`instanceof` guards | TypeScript discriminated union on `status` field | TypeScript narrows automatically in `switch (state.status)` blocks with `never` exhaustiveness |
| Iteration safety | Custom visited-set tracking | Integer counter checked against `maxIterations` | D-08 / RUN-09: a simple step counter is sufficient for Phase 2; visited-sets are needed for loop bodies in Phase 6 |

**Key insight:** The text accumulation problem is deceptively simple once you use full string snapshots. The only non-trivial logic is the `advanceThrough` loop, which must correctly classify every node kind and handle the terminal conditions (`complete`, `error`, `awaiting-snippet-fill`) without falling through.

---

## Common Pitfalls

### Pitfall 1: Bundling vs. Separating Text-Block Undo Entries

**What goes wrong:** If `advanceThrough` pushes a new `UndoEntry` every time it auto-appends a text-block node, then `stepBack()` takes the user back to the text-block node rather than back to the question they answered. This creates confusing behavior: the user presses "back" and sees the same auto-advancing text-block re-rendered before they get back to the question.

**Why it happens:** Developers think "every state change should be undoable" but miss the design decision that text-block traversal is automatic and should be transparent to the user.

**How to avoid:** Only push `UndoEntry` inside `chooseAnswer()` and `enterFreeText()` (the two user-action methods). `advanceThrough()` never pushes to the undo stack.

**Warning signs:** Tests show `stepBack()` only reverting one text-block append at a time when multiple text-blocks follow an answer.

### Pitfall 2: noUncheckedIndexedAccess Causes T | undefined on Map.get()

**What goes wrong:** `this.graph.nodes.get(nodeId)` returns `RPNode | undefined` even when you "know" the node exists. Failing to null-check results in a TypeScript error or a runtime crash when the map entry is missing.

**Why it happens:** `noUncheckedIndexedAccess` is enabled in the project tsconfig (verified). TypeScript makes no assumption about Map lookups.

**How to avoid:** Always null-check Map.get() results before using them. Pattern:
```typescript
const node = this.graph.nodes.get(cursor);
if (node === undefined) {
  this.transitionToError(`Node '${cursor}' not found in graph.`);
  return;
}
// now TypeScript knows node is RPNode
```

**Warning signs:** TypeScript errors saying `Object is possibly 'undefined'` on any map lookup.

### Pitfall 3: Mutation Before Snapshot Push

**What goes wrong:** If the undo snapshot is pushed after `accumulator.append()` instead of before, `stepBack()` restores the post-action text rather than the pre-action text — undo does nothing.

**Why it happens:** Push-then-mutate is the natural sequence; developers forget to invert the order.

**How to avoid:** The rule is: **snapshot, then mutate, never the reverse.** In `chooseAnswer()` and `enterFreeText()`, the `undoStack.push(...)` call must be the first operation, before any `accumulator.append()`.

**Warning signs:** `stepBack()` test asserts pre-action text but finds post-action text; test fails.

### Pitfall 4: `getState()` Returning a Live Reference

**What goes wrong:** If `getState()` returns `{ status: 'at-node', accumulatedText: this.accumulator.current, ... }` where `accumulatedText` is accessed via a getter that returns a reference to an internal string, and then the runner's string changes, the returned state object can "change" after it was returned. This doesn't happen with JavaScript string primitives (they are immutable), but would happen if `accumulatedText` were a mutable object.

**Why it happens:** Developers who come from mutable object backgrounds assume returned state is live.

**How to avoid:** Since `accumulatedText` is a plain `string` primitive in JavaScript, this is a non-issue for strings. The snapshot is naturally a value copy. Document this assumption clearly.

**Warning signs:** Not applicable for strings — mentioned here as a reminder that the snapshot design depends on `TextAccumulator` storing a primitive string, not a mutable buffer object.

### Pitfall 5: `awaiting-snippet-fill` State Stranded Without completeSnippet

**What goes wrong:** If `completeSnippet()` is not implemented in Phase 2 (deferred to Phase 5), the runner can enter `awaiting-snippet-fill` state but never exit it. Phase 5 then requires structural changes to the runner to add the method — violating the design goal that Phase 5 only adds UI code.

**Why it happens:** Developers skip the `completeSnippet` implementation since there is no modal to call it yet.

**How to avoid:** Implement `completeSnippet(renderedText: string)` in Phase 2 and test it by calling it directly in unit tests (no modal needed). D-07 explicitly requires this.

**Warning signs:** Phase 5 scope creep into runner internals.

### Pitfall 6: answer Node Adjacency Assumption

**What goes wrong:** The `linear.canvas` fixture shows `question → answer` (answer is a leaf), which might lead the developer to believe answer nodes are always terminal. In a real protocol, `answer → text-block → question` chains are common. The `advanceThrough` loop must handle `answer` nodes as pass-through (append text, follow edge) rather than as terminal nodes.

**Why it happens:** Test fixtures in Phase 1 are minimal; the linear fixture answer node has no outgoing edge (it's a dead-end at the fixture level).

**How to avoid:** Create new fixtures for Phase 2 that include complete chains ending at a `complete` state (no outgoing edge from a non-question node). The `text-block.canvas` fixture should demonstrate this pattern.

---

## Code Examples

### Full RunnerState Type (recommended shape)

```typescript
// Source: .planning/research/ARCHITECTURE.md §3 + D-01 through D-08

// runner/runner-state.ts
export type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'awaiting-snippet-fill'
  | 'complete'
  | 'error';

export interface IdleState { status: 'idle' }

export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}

export interface AwaitingSnippetFillState {
  status: 'awaiting-snippet-fill';
  snippetId: string;
  nodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}

export interface CompleteState {
  status: 'complete';
  finalText: string;
}

export interface ErrorState {
  status: 'error';
  message: string;
}

export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;

// Internal — not exported
export interface UndoEntry {
  nodeId: string;
  textSnapshot: string;
}
```

### ProtocolRunner Constructor + Options

```typescript
// runner/protocol-runner.ts
import type { ProtocolGraph } from '../graph/graph-model';
import type { RunnerState, UndoEntry } from './runner-state';
import { TextAccumulator } from './text-accumulator';

export interface ProtocolRunnerOptions {
  maxIterations?: number;  // D-08: default 50
}

export class ProtocolRunner {
  private readonly maxIterations: number;
  private graph: ProtocolGraph | null = null;
  private currentNodeId: string | null = null;
  private accumulator = new TextAccumulator();
  private undoStack: UndoEntry[] = [];
  private state: RunnerState = { status: 'idle' };

  constructor(options: ProtocolRunnerOptions = {}) {
    this.maxIterations = options.maxIterations ?? 50;
  }

  start(graph: ProtocolGraph): void { /* ... */ }
  chooseAnswer(answerId: string): void { /* ... */ }
  enterFreeText(text: string): void { /* ... */ }
  stepBack(): void { /* ... */ }
  completeSnippet(renderedText: string): void { /* ... */ }
  getState(): RunnerState { return this.state; }
}
```

### stepBack() Implementation

```typescript
// Source: D-03, D-04, RUN-06
stepBack(): void {
  if (this.undoStack.length === 0) return;  // Nothing to undo

  const entry = this.undoStack.pop();
  if (entry === undefined) return;  // noUncheckedIndexedAccess guard

  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.state = {
    status: 'at-node',
    currentNodeId: entry.nodeId,
    accumulatedText: entry.textSnapshot,
    canStepBack: this.undoStack.length > 0,
  };
}
```

### New Fixture: text-block.canvas

The existing fixtures do not contain a `text-block` node. A new fixture is required to test RUN-05 (text-block auto-advance) and the full linear traversal success criterion.

```json
{
  "nodes": [
    {
      "id": "n-start", "type": "text", "text": "Start",
      "x": 0, "y": 0, "width": 200, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "n-q1", "type": "text", "text": "Q1",
      "x": 0, "y": 120, "width": 200, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Is contrast indicated?"
    },
    {
      "id": "n-a1", "type": "text", "text": "Yes",
      "x": 0, "y": 240, "width": 200, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "IV contrast: yes. "
    },
    {
      "id": "n-tb1", "type": "text", "text": "Protocol footer",
      "x": 0, "y": 360, "width": 200, "height": 60,
      "radiprotocol_nodeType": "text-block",
      "radiprotocol_content": "Reported by: RadiProtocol."
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1",   "toNode": "n-a1" },
    { "id": "e3", "fromNode": "n-a1",   "toNode": "n-tb1" }
  ]
}
```

Expected final accumulated text after choosing `n-a1` and auto-advancing through `n-tb1`: `"IV contrast: yes. Reported by: RadiProtocol."`

---

## Runtime State Inventory

Step 2.5 check: Phase 2 is a greenfield module implementation — no rename, refactor, or migration. No runtime state inventory required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest test runner | ✓ | (via npm) | — |
| Vitest | All unit tests | ✓ | 4.1.2 | — |
| TypeScript | Compilation + type checking | ✓ | 6.0.2 | — |

[VERIFIED: package.json — `npm run test` passed 14 tests cleanly at time of research]

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Test include glob | `src/__tests__/**/*.test.ts` |
| Environment | `node` (no browser, no Obsidian runtime) |

[VERIFIED: vitest.config.ts — environment: 'node', include: 'src/__tests__/**/*.test.ts']

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | `start(graph)` transitions runner from `idle` to `at-node` at the start node | unit | `npm run test` | ❌ Wave 0 |
| RUN-02 | `getState()` returns exactly one `currentNodeId` at all times; no multi-question state | unit | `npm run test` | ❌ Wave 0 |
| RUN-03 | `chooseAnswer(answerId)` appends `answerText` to `accumulatedText` and advances to next node | unit | `npm run test` | ❌ Wave 0 |
| RUN-04 | `enterFreeText(text)` wraps with `prefix`/`suffix` and appends to `accumulatedText` | unit | `npm run test` | ❌ Wave 0 |
| RUN-05 | Text-block nodes auto-append `content` without user action; bundled into prior undo entry | unit | `npm run test` | ❌ Wave 0 |
| RUN-06 | `stepBack()` reverts `currentNodeId` AND `accumulatedText` to pre-action values | unit | `npm run test` | ❌ Wave 0 |
| RUN-07 | Revert is O(1) (snapshot-based); partial-corruption test: free-text with embedded newlines step-back correctly | unit | `npm run test` | ❌ Wave 0 |
| RUN-08 | All five states (`idle`, `at-node`, `awaiting-snippet-fill`, `complete`, `error`) are reachable via specific test scenarios | unit | `npm run test` | ❌ Wave 0 |
| RUN-09 | After `maxIterations` steps, runner transitions to `error` state with clear message | unit | `npm run test` | ❌ Wave 0 |

### Test File Structure

Two new test files required:

**`src/__tests__/text-accumulator.test.ts`**
```
describe('TextAccumulator')
  it('starts with empty string')
  it('append() concatenates text')
  it('current getter returns current buffer')
  it('snapshot() returns current text as value copy')
  it('restoreTo(snapshot) sets buffer to snapshot value')
  it('restoreTo() with empty string clears buffer')
  it('append() after restoreTo() builds from restored point')
  it('handles Unicode and embedded newlines correctly (NFR-11)')
```

**`src/__tests__/protocol-runner.test.ts`**
```
describe('ProtocolRunner — state machine')
  it('initial state is idle')

describe('start()')
  it('transitions to at-node at startNodeId')
  it('auto-advances through start node to first content node')
  it('given invalid graph (no start node), transitions to error state')  [Claude's Discretion]

describe('chooseAnswer() — linear protocol')
  it('appends answerText to accumulatedText')
  it('advances currentNodeId past the answer node')
  it('auto-advances through text-block nodes after answer')
  it('transitions to complete when no outgoing edge from last node')
  it('accumulated text matches expected full string after linear run')  [RUN-01 success criterion 1]

describe('chooseAnswer() — branching protocol')
  it('follows correct branch for answer A1')
  it('follows correct branch for answer A2')  [RUN-01 success criterion 2]

describe('enterFreeText()')
  it('appends prefix + text + suffix to accumulatedText')
  it('handles absent prefix/suffix (no extra text)')
  it('pushes undo entry so stepBack() reverts correctly')

describe('stepBack()')
  it('reverts currentNodeId to pre-action node')
  it('reverts accumulatedText to pre-action snapshot')
  it('handles embedded newlines in free-text correctly (RUN-07 edge case)')
  it('3-step protocol: stepBack twice restores to first question')  [RUN-01 success criterion 3]
  it('stepBack on empty undoStack is a no-op (does not throw)')
  it('canStepBack is false after stepBack empties the stack')

describe('completeSnippet() — awaiting-snippet-fill state')
  it('appends renderedText to accumulatedText')
  it('transitions from awaiting-snippet-fill back to at-node or complete')
  it('is reachable by constructing a TextBlockNode with snippetId')  [D-07]

describe('loop-start error state')
  it('transitions to error with correct message when loop-start node is reached')  [D-05]
  it('error message is exactly: "Loop nodes are not yet supported — upgrade to Phase 6"')

describe('maxIterations cap')
  it('transitions to error after maxIterations steps on a cyclic graph')  [RUN-09]
  it('custom maxIterations=3 is respected')  [D-08]

describe('all five RunnerStatus values reachable')
  it('idle: initial state')
  it('at-node: after start()')
  it('awaiting-snippet-fill: TextBlockNode with snippetId reached')
  it('complete: protocol reaches a node with no outgoing edges')
  it('error: loop-start node encountered')
```

### New Fixture Files Required

| Fixture | Purpose |
|---------|---------|
| `src/__tests__/fixtures/text-block.canvas` | Full linear chain: start → question → answer → text-block (no outgoing edge). Tests RUN-05 and complete-state transition. |
| `src/__tests__/fixtures/snippet-block.canvas` | text-block node with `radiprotocol_snippetId` field set. Tests `awaiting-snippet-fill` state. |
| `src/__tests__/fixtures/loop-start.canvas` | Contains a `loop-start` node reachable from start. Tests D-05 error-state transition. |
| `src/__tests__/fixtures/free-text.canvas` | Contains a `free-text-input` node with `prefix` and `suffix`. Tests RUN-04. |

The existing `branching.canvas` fixture is sufficient for branching tests.

### Sampling Rate

- **Per task commit:** `npm run test` (full suite — ~200ms, fast enough to run on every commit)
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/text-accumulator.test.ts` — covers RUN-07
- [ ] `src/__tests__/protocol-runner.test.ts` — covers RUN-01 through RUN-09
- [ ] `src/__tests__/fixtures/text-block.canvas` — shared fixture for linear complete-state tests
- [ ] `src/__tests__/fixtures/snippet-block.canvas` — shared fixture for awaiting-snippet-fill tests
- [ ] `src/__tests__/fixtures/loop-start.canvas` — shared fixture for loop error-state tests
- [ ] `src/__tests__/fixtures/free-text.canvas` — shared fixture for free-text-input tests

Framework install: none — Vitest already installed and passing.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Diff-based undo (text deltas) | Full snapshot per undo entry (D-04) | Decided in Phase 2 planning | Simpler, correct, O(1) revert for small protocol text |
| Polymorphic `advance()` with action type arg | Separate explicit methods per action (D-01) | Decided in Phase 2 planning | TypeScript enforces correct arg types at each call site |
| Expose full undo stack to callers | `canStepBack: boolean` in state snapshot (D-02) | Decided in Phase 2 planning | Encapsulation; Phase 3 UI cannot depend on internal stack structure |

**Deprecated/outdated patterns for this phase:**
- Command Pattern for undo: overkill for small undo stacks in a single-session protocol runner; plain array of snapshots is correct.
- Memoized text diffs: not applicable; protocol text is append-only, not edited in place.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Array of `UndoEntry` (not linked list) is the correct undo stack structure for Phase 2 | Architecture Patterns | Negligible — linked list would work equally well; array is simpler to implement and test |
| A2 | `loopContextStack` is omitted from `AtNodeState` in Phase 2 (added by Phase 6) | Pattern 1 (RunnerState) | Phase 6 must add this field to `AtNodeState`; UI code referencing state would not break since the field simply didn't exist before |
| A3 | `start(graph)` transitions to `error` (rather than throwing) when the graph has no start node | Code Examples (constructor) | If the planner chooses "throw" instead, callers must add try/catch — Phase 3 UI must handle the exception. Either is acceptable; error-state is consistent with the rest of the API. |
| A4 | Answer nodes are traversed via `advanceThrough` (appending `answerText` during the loop), not as a separate step before `advanceThrough` | Pattern 4 (advance loop) | Both approaches produce the same output; consistent handling in `advanceThrough` is simpler |

**If the planner wants to deviate from any assumed item, the change is low-risk and confined to `protocol-runner.ts` internals.**

---

## Open Questions

1. **Should `start()` accept a pre-validated graph or call GraphValidator itself?**
   - What we know: Phase 1 `GraphValidator` exists and is tested. The CONTEXT.md code context says runner receives a `ProtocolGraph` (already parsed). Phase 3 UI will run validation before calling `start()`.
   - What's unclear: Whether the runner should call `GraphValidator.validate(graph)` as a guard inside `start()`, or trust the caller to validate.
   - Recommendation: Trust the caller in Phase 2 (Phase 3 owns the validation call). If the graph is malformed (e.g., missing start node), the runner discovers this during `advanceThrough` and transitions to `error` state gracefully. This keeps the runner a pure traversal engine without a dependency on `GraphValidator`.

2. **Should `getState()` return a deep-frozen object?**
   - What we know: `RunnerState` contains only string primitives and a boolean — no nested objects in Phase 2.
   - What's unclear: Whether `Object.freeze()` is needed to prevent callers from mutating the returned snapshot.
   - Recommendation: Skip `Object.freeze()` in Phase 2. The state object contains only primitives; mutation by callers has no effect on the runner's internal state. Add a comment noting this assumption.

---

## Security Domain

`security_enforcement` is not explicitly set to `false` in `.planning/config.json`. Applying default (enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user auth in runner module |
| V3 Session Management | No | Phase 2 is stateless w.r.t. persistent sessions (Phase 7) |
| V4 Access Control | No | Single-user local plugin |
| V5 Input Validation | Yes — limited | `answerId` passed to `chooseAnswer` must resolve to a valid `AnswerNode` in the graph; `enterFreeText` text is plain string (no injection vector since it is never eval'd) |
| V6 Cryptography | No | No secrets or credentials in runner |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid `answerId` referencing a non-answer node | Tampering | Null-check + kind-check after `graph.nodes.get(answerId)`; transition to error state |
| Crafted protocol graph with no start node (infinite loop in `start()`) | Denial of Service | `start()` must validate `graph.startNodeId` exists before calling `advanceThrough` |
| Iteration cap bypass via non-loop cycles | Denial of Service | `advanceThrough` step counter applies to ALL advance steps, not only loop-body steps |

**Note:** All threat surfaces in Phase 2 are internal (the runner receives data from the already-validated canvas parser). The runner is not exposed to external network input or user-crafted injection strings. The main risk is programmer error in graph construction during tests.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-core-protocol-runner-engine/02-CONTEXT.md` — all locked decisions (D-01 through D-08)
- `.planning/research/ARCHITECTURE.md §3` — Runner State Machine, TextAccumulator, UndoEntry patterns
- `src/graph/graph-model.ts` — all 7 node types (discriminated union, field names) verified in codebase
- `src/runner/runner-state.ts` — `RunnerStatus` stub verified in codebase
- `vitest.config.ts` — test framework config verified
- `package.json` — dependency versions verified

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md §Graph Traversal Pitfalls` — infinite loop prevention, iteration cap
- `.planning/REQUIREMENTS.md §RUN-01 through RUN-09` — authoritative requirement text

### Tertiary (LOW confidence)
- None — all claims were verified against the project codebase or locked decisions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, versions verified from package.json
- Architecture: HIGH — locked decisions (D-01 through D-08) from CONTEXT.md + verified ARCHITECTURE.md patterns
- Pitfalls: HIGH — derived from TypeScript strictness settings verified in tsconfig.json and locked design decisions
- Test strategy: HIGH — Vitest config verified, existing tests pass, new test structure follows established patterns

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable TypeScript/Vitest ecosystem; no fast-moving dependencies in Phase 2)
