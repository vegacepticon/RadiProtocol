---
date: 2026-07-29T10:01:42+0300
author: Roman Shulgha
commit: cb3ac55
branch: main
repository: RadiProtocol
topic: "Hide Start from node picker; direct Question-to-Question transitions"
tags: [plan, blueprint, protocol-editor-view, runner, render, graph]
status: ready
parent: .rpiv/artifacts/research/2026-07-29_09-38-38_hide-start-picker-q-to-q-transitions.md
phase_count: 3
phases:
  - { n: 1, title: Runner transition contract }
  - { n: 2, title: Transition rendering and host wiring }
  - { n: 3, title: Editor authoring correctness }
unresolved_phase_count: 0
last_updated: 2026-07-29T10:01:42+0300
last_updated_by: Roman Shulgha
---

# Hide Start Picker Entry and Add Direct Q-to-Q Transitions Implementation Plan

## Overview
Add direct ordinary Question-to-Question choices as distinct, edge-backed transition buttons while preserving the existing Answer and Snippet branch behavior. The runner will select transitions by stable edge ID with normal undo/redo discipline, and the editor will make Start creation and Q-to-Q label persistence consistent with the current document state.

## Requirements
- Hide Start from both node-kind creation pickers whenever the current protocol document already contains a Start node.
- Show Start in both pickers whenever the current document contains no Start node.
- Preserve ordinary Q-to-Q edge labels through editor save and reopen.
- Render every direct outgoing ordinary Question-to-Question edge as a distinct transition button.
- Use the edge label as the button caption when nonblank; otherwise use target Question text, then target ID.
- Preserve concrete edge identity and source order from rendering through selection.
- Allow direct transitions to both ordinary and looped Question targets.
- Preserve accumulated report text and avoid physical note writes for strict Q-to-Q transitions.
- Preserve existing Answer, Snippet, empty-Answer, loop, undo, and redo behavior.
- Synchronize the editor's in-memory document immediately after successful node deletion.

## Current State Analysis
The graph model and parser already preserve ordered `RPEdge` identity, labels, endpoints, and adjacency, and traversal already halts correctly at ordinary or looped Questions. Missing behavior is confined to the ordinary Question runner action, renderer/host wiring, editor display-persistence policy, picker availability, and deletion state synchronization.

### Key Discoveries
- `src/graph/graph-model.ts:119-140` and `src/protocol/protocol-document-parser.ts:117-143` already carry all required edge data; no schema or parser change is needed.
- `src/runner/render/render-question.ts:45-86` partitions only Answer and Snippet adjacency targets and ignores Question targets.
- `src/runner/render/render-loop-picker.ts:44-64` is the ordered, edge-aware rendering precedent.
- `src/runner/protocol-runner.ts:184-220` and `src/runner/protocol-runner.ts:242-281` establish target validation and edge-ID undo-before-mutate patterns.
- `src/views/inline-runner-modal.ts:459-479` is the sole production Question renderer host; `src/views/inline-runner-modal.ts:748-788` contains the note-write path that direct transitions must not call.
- `src/views/protocol-editor-view.ts:312-326` currently rejects ordinary Q-to-Q labels, causing `openEdgeModal()` at `src/views/protocol-editor-view.ts:2076-2103` to persist them as `undefined`.
- Both picker loops enumerate `EDITABLE_NODE_KINDS` without filtering at `src/views/protocol-editor-view.ts:760-775` and `src/views/protocol-editor-view.ts:810-825`.
- Successful deletion discards the returned document before an unawaited reload at `src/views/protocol-editor-view.ts:2466-2476`.

## Desired End State

```typescript
// An ordinary Question exposes direct labeled navigation without report text.
runner.chooseQuestionBranch('edge-to-follow-up');
expect(runner.getState()).toMatchObject({
  status: 'at-node',
  currentNodeId: 'follow-up-question',
  accumulatedText: priorText,
});
```

```typescript
// Renderer host receives the concrete persisted edge.
onChooseQuestionBranch: (edge: RPEdge) => {
  runner.chooseQuestionBranch(edge.id);
  render();
};
```

```typescript
// Start availability reflects the current editor document on every invocation.
const availableKinds = hasStart
  ? EDITABLE_NODE_KINDS.filter(kind => kind !== 'start')
  : EDITABLE_NODE_KINDS;
```

## What We're NOT Doing
- No graph-model, parser, validator, runner-state, or persisted-schema changes.
- No new node kind, edge field, editor field, modal, command, or localization key.
- No change to loop-picker body/exit semantics or loop-body label visibility.
- No replacement or broadening of `chooseAnswer()`.
- No removal or behavioral change for empty Answer pass-through protocols.
- No report-text append or note-write call for direct Q-to-Q transitions.
- No global mutation of `EDITABLE_NODE_KINDS`; filtering remains per picker invocation.
- No generated `main.js` or `styles.css` edits outside the build pipeline.

## Decisions

### Reuse existing graph and parser contracts
`RPEdge` and ordered `ProtocolGraph.edges` already preserve identity and labels (`src/graph/graph-model.ts:119-140`), and the parser retains them (`src/protocol/protocol-document-parser.ts:117-143`). Keep the graph model, parser, validator, and schema unchanged.

### Add an edge-ID runner action
Add `chooseQuestionBranch(edgeId: string): void`, modeled after source/target validation in `chooseSnippetBranch()` (`src/runner/protocol-runner.ts:184-220`) and stable edge lookup/history sequencing in `chooseLoopBranch()` (`src/runner/protocol-runner.ts:242-281`). The source must be an ordinary Question, and the target may be either an ordinary or looped Question.

### Render from ordered concrete edges
Use `graph.edges` rather than adjacency for direct Question transitions so each button retains edge identity, caption, and source order. Caption resolution is nonblank `edge.label`, then `nodeLabel(target)`, then target ID (`src/graph/node-label.ts:18-22`).

### Use distinct transition styling

#### Ambiguity
Ordinary branches currently place Answer buttons in `rp-answer-list` and Snippet buttons in a separate list (`src/runner/render/render-question.ts:56-86`). Direct Q-to-Q transitions do not append report text.

#### Explored
- Reuse Answer styling: no CSS changes and one unified choice list, but navigation appears equivalent to report-producing Answers.
- Distinct transition styling: separate list/button classes between Answers and Snippets, clarifying no-text navigation at the cost of a small CSS surface.

#### Decision
Render direct Q-to-Q transitions in a distinct transition list after Answers and before Snippets.

### Keep direct transitions off the note-write path
The host calls `chooseQuestionBranch(edge.id)` and rerenders directly. It does not call `handleAnswerClick()`, `appendDeltaFromAccumulator()`, or `appendAnswerToNote()` (`src/views/inline-runner-modal.ts:748-788`).

### Filter Start per picker invocation
Derive a local available-kind list from current `this.doc.nodes` in both picker methods (`src/views/protocol-editor-view.ts:732-830`). Never mutate the shared ordered `EDITABLE_NODE_KINDS` constant.

### Preserve only ordinary Q-to-Q authored labels
Extend `shouldDisplayProtocolEditorEdgeLabel()` for ordinary Question-source to Question-target edges when a nonblank label exists. Keep existing Answer/Snippet behavior and loop-exit behavior unchanged; do not expose ordinary loop-body labels (`src/views/protocol-editor-view.ts:312-326`).

### Synchronize deletion state immediately
Assign the document returned by the successful node-deletion `ProtocolDocumentStore.update()` to `this.doc` before closing and starting the existing reload (`src/views/protocol-editor-view.ts:2466-2476`).

## Phase 1: Runner transition contract

### Overview
Adds the pure edge-based transition action and focused state/history coverage. Foundation phase; depends on nothing.

### Changes Required:

#### 1. src/runner/protocol-runner.ts:after chooseSnippetBranch
**File**: src/runner/protocol-runner.ts
**Changes**: MODIFY — add validated edge-ID ordinary Question transition with undo/redo and traversal.

```typescript
// Add to the class-level Public API list:
 *   chooseQuestionBranch(edgeId) — user selects a direct Question-to-Question edge

  /**
   * User selects a direct edge from the current ordinary Question to another
   * Question. The edge ID is the stable selection identity because captions
   * and targets are not guaranteed to be unique.
   *
   * Validation completes before history mutation. A successful transition
   * preserves accumulated text, clears redo, captures one undo snapshot, and
   * delegates target-state selection to advanceThrough().
   */
  chooseQuestionBranch(edgeId: string): void {
    if (this.runnerStatus !== RUNNER_STATUS.AT_NODE) return;
    if (this.graph === null || this.currentNodeId === null) return;

    const currentNode = this.graph.nodes.get(this.currentNodeId);
    if (currentNode === undefined || currentNode.kind !== 'question' || currentNode.loop === true) {
      this.transitionToError(
        `chooseQuestionBranch called when current node '${this.currentNodeId}' is not an ordinary question.`,
      );
      return;
    }

    const edge = this.graph.edges.find(candidate => candidate.id === edgeId);
    if (edge === undefined || edge.fromNodeId !== this.currentNodeId) {
      this.transitionToError(
        `Question transition edge '${edgeId}' not found or does not originate at current question '${this.currentNodeId}'.`,
      );
      return;
    }

    const targetNode = this.graph.nodes.get(edge.toNodeId);
    if (targetNode === undefined || targetNode.kind !== 'question') {
      this.transitionToError(
        `Question transition edge '${edgeId}' does not target a question node.`,
      );
      return;
    }

    this.redoStack = [];
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: this.loopContextStack.map(frame => ({ ...frame })),
    });

    // A direct transition is one user action. If its target is looped, the
    // action snapshot above replaces advanceThrough's automatic loop-entry
    // snapshot so one Back returns directly to the source Question.
    this.advanceThrough(edge.toNodeId, true);
  }

// Replace the private traversal signature:
  private advanceThrough(nodeId: string, suppressLoopEntryUndo = false): void {

// Replace the first-entry block inside case 'question' when node.loop === true:
            // First-entry path — push an undo snapshot unless the caller already
            // captured the loop entry as part of the same user action.
            if (!suppressLoopEntryUndo) {
              this.undoStack.push({
                nodeId: cursor,
                textSnapshot: this.accumulator.snapshot(),
                loopContextStack: this.loopContextStack.map(frame => ({ ...frame })),
                restoreStatus: RUNNER_STATUS.AWAITING_LOOP_PICK,
              });
            }
            this.loopContextStack.push({
              loopNodeId: cursor,
              iteration: 1,
              textBeforeLoop: this.accumulator.snapshot(),
            });
            this.currentNodeId = cursor;
            this.runnerStatus = RUNNER_STATUS.AWAITING_LOOP_PICK;
            return;
```

#### 2. src/__tests__/runner/protocol-runner-question-branch.test.ts
**File**: src/__tests__/runner/protocol-runner-question-branch.test.ts
**Changes**: NEW — focused direct Question transition state, validation, history, and loop-target tests.

```typescript
import { describe, expect, it } from 'vitest';
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';
import { ProtocolRunner } from '../../runner/protocol-runner';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['prior', { id: 'prior', kind: 'text-block', content: 'Prior', x: 0, y: 60, width: 100, height: 60 }],
    ['q-source', { id: 'q-source', kind: 'question', questionText: 'Source?', x: 0, y: 120, width: 100, height: 60 }],
    ['q-target', { id: 'q-target', kind: 'question', questionText: 'Target?', x: 0, y: 180, width: 100, height: 60 }],
    ['q-loop', { id: 'q-loop', kind: 'question', questionText: 'Repeat?', loop: true, x: 0, y: 240, width: 100, height: 60 }],
    ['answer', { id: 'answer', kind: 'answer', answerText: 'Answer', x: 0, y: 300, width: 100, height: 60 }],
  ]);
  return {
    canvasFilePath: 'question-branch.rp.json',
    nodes,
    edges: [
      { id: 'e-start', fromNodeId: 'start', toNodeId: 'prior' },
      { id: 'e-prior', fromNodeId: 'prior', toNodeId: 'q-source' },
      { id: 'e-target', fromNodeId: 'q-source', toNodeId: 'q-target', label: 'Continue' },
      { id: 'e-loop', fromNodeId: 'q-source', toNodeId: 'q-loop' },
      { id: 'e-answer', fromNodeId: 'q-source', toNodeId: 'answer' },
      { id: 'e-wrong-source', fromNodeId: 'q-target', toNodeId: 'q-source' },
      { id: 'e-missing-target', fromNodeId: 'q-source', toNodeId: 'missing' },
      { id: 'e-loop-source', fromNodeId: 'q-loop', toNodeId: 'q-target' },
    ],
    adjacency: new Map([
      ['start', ['prior']],
      ['prior', ['q-source']],
      ['q-source', ['q-target', 'q-loop', 'answer']],
      ['q-target', ['q-source']],
      ['q-loop', ['q-target']],
    ]),
    reverseAdjacency: new Map([
      ['prior', ['start']],
      ['q-source', ['prior', 'q-target']],
      ['q-target', ['q-source', 'q-loop']],
      ['q-loop', ['q-source']],
      ['answer', ['q-source']],
    ]),
    startNodeId: 'start',
  };
}

function startAtSource(): ProtocolRunner {
  const runner = new ProtocolRunner();
  runner.start(makeGraph());
  const state = runner.getState();
  expect(state.status).toBe('at-node');
  if (state.status === 'at-node') {
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
  }
  return runner;
}

describe('ProtocolRunner — direct Question transition', () => {
  it('selects an edge by ID, preserves text, and captures one undo snapshot', () => {
    const runner = startAtSource();

    runner.chooseQuestionBranch('e-target');

    const state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-target');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
    expect(state.canStepBack).toBe(true);
  });

  it('round-trips the selected transition through stepBack and redo', async () => {
    const runner = startAtSource();
    runner.chooseQuestionBranch('e-target');

    runner.stepBack();
    await Promise.resolve();
    let state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.canRedo).toBe(true);

    runner.redo();
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-target');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
  });

  it('clears redo history after a new direct transition', () => {
    const runner = startAtSource();
    runner.chooseQuestionBranch('e-target');
    runner.stepBack();
    const rewound = runner.getState();
    expect(rewound.status).toBe('at-node');
    if (rewound.status !== 'at-node') return;
    expect(rewound.canRedo).toBe(true);

    runner.chooseQuestionBranch('e-loop');

    const state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.canRedo).toBe(false);
  });

  it('enters a looped Question as one undoable user action', async () => {
    const runner = startAtSource();

    runner.chooseQuestionBranch('e-loop');

    let state = runner.getState();
    expect(state.status).toBe('awaiting-loop-pick');
    if (state.status !== 'awaiting-loop-pick') return;
    expect(state.nodeId).toBe('q-loop');
    expect(state.accumulatedText).toBe('Prior');
    expect(state.undoStackSize).toBe(1);
    expect(runner.getSerializableState()?.loopContextStack).toEqual([
      { loopNodeId: 'q-loop', iteration: 1, textBeforeLoop: 'Prior' },
    ]);

    runner.stepBack();
    await Promise.resolve();
    state = runner.getState();
    expect(state.status).toBe('at-node');
    if (state.status !== 'at-node') return;
    expect(state.currentNodeId).toBe('q-source');
    expect(state.accumulatedText).toBe('Prior');
    expect(runner.getSerializableState()?.loopContextStack).toEqual([]);
  });

  it.each(['missing-edge', 'e-wrong-source', 'e-answer', 'e-missing-target'])(
    'rejects invalid selection %s before clearing redo or pushing undo',
    (edgeId) => {
      const runner = startAtSource();
      runner.chooseQuestionBranch('e-target');
      runner.stepBack();
      const rewound = runner.getState();
      expect(rewound.status).toBe('at-node');
      if (rewound.status !== 'at-node') return;
      expect(rewound.canRedo).toBe(true);
      expect(rewound.undoStackSize).toBe(0);

      runner.chooseQuestionBranch(edgeId);
      expect(runner.getState().status).toBe('error');

      runner.redo();
      const restored = runner.getState();
      expect(restored.status).toBe('at-node');
      if (restored.status !== 'at-node') return;
      expect(restored.currentNodeId).toBe('q-target');
      expect(restored.undoStackSize).toBe(1);
    },
  );

  it('rejects an at-node snapshot whose current source is looped', () => {
    const graph = makeGraph();
    const runner = new ProtocolRunner();
    runner.setGraph(graph);
    runner.restoreFrom({
      runnerStatus: 'at-node',
      currentNodeId: 'q-loop',
      accumulatedText: 'Prior',
      undoStack: [],
      loopContextStack: [],
      snippetId: null,
      snippetNodeId: null,
    });

    runner.chooseQuestionBranch('e-loop-source');

    expect(runner.getState().status).toBe('error');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Focused runner transition tests pass: `npx vitest run src/__tests__/runner/protocol-runner-question-branch.test.ts`
- [ ] Existing runner tests remain green: `npx vitest run src/__tests__/runner/protocol-runner.test.ts src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-redo.test.ts`

#### Manual Verification:
- [ ] Review the public runner action to confirm every validation branch precedes redo clearing and undo mutation.

## Phase 2: Transition rendering and host wiring

### Overview
Renders and styles distinct transition choices and wires them to the runner without note persistence. Depends on Phase 1.

### Changes Required:

#### 1. src/runner/render/render-question.ts:QuestionBranchHost and branch rendering
**File**: src/runner/render/render-question.ts
**Changes**: MODIFY — expose edge callback and render ordered direct Question edges after Answers and before Snippets.

```typescript
// Replace graph-model imports and add nodeLabel:
import type { AnswerNode, ProtocolGraph, RPEdge, SnippetNode } from '../../graph/graph-model';
import { nodeLabel } from '../../graph/node-label';

// Add to QuestionBranchHost:
  onChooseQuestionBranch(edge: RPEdge): void | Promise<void>;

// Add after the existing Answer/Snippet adjacency partition:
  // Direct Question transitions are edge-sensitive: preserve persisted edge
  // order, caption, and identity rather than reducing them to adjacency IDs.
  const questionEdges = graph.edges.filter((edge) => {
    if (edge.fromNodeId !== state.currentNodeId) return false;
    return graph.nodes.get(edge.toNodeId)?.kind === 'question';
  });

// Add after the existing Answer list and before the Snippet list:
  if (questionEdges.length > 0) {
    const transitionList = actionZone.createDiv({ cls: 'rp-question-transition-list' });
    for (const edge of questionEdges) {
      const target = graph.nodes.get(edge.toNodeId);
      const fallbackCaption = target !== undefined
        ? nodeLabel(target).trim() || edge.toNodeId
        : edge.toNodeId;
      const caption = edge.label !== undefined && edge.label.trim() !== ''
        ? edge.label
        : fallbackCaption;
      const btn = createButton(transitionList, {
        cls: 'rp-question-transition-btn',
        text: caption,
      });
      host.bindClick(btn, () => {
        void host.onChooseQuestionBranch(edge);
      });
    }
  }
```

#### 2. src/views/inline-runner-modal.ts:ordinary Question host
**File**: src/views/inline-runner-modal.ts
**Changes**: MODIFY — delegate transition edge selection to the runner and rerender without a note-write handler.

```typescript
// Add to the renderQuestionAtNode host object after onChooseAnswer:
            onChooseQuestionBranch: (edge) => {
              this.runner.chooseQuestionBranch(edge.id);
              this.render();
            },
```

#### 3. src/styles/inline-runner.css:question action lists and buttons
**File**: src/styles/inline-runner.css
**Changes**: MODIFY — add distinct transition list/button styling within the existing action-zone layout.

```css
.rp-inline-runner-actions .rp-answer-list,
.rp-inline-runner-actions .rp-question-transition-list,
.rp-inline-runner-actions .rp-snippet-branch-list,
.rp-inline-runner-actions .rp-loop-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-3);
  margin-bottom: 0;
}

.rp-inline-runner-actions .rp-answer-btn,
.rp-inline-runner-actions .rp-question-transition-btn,
.rp-inline-runner-actions .rp-snippet-branch-btn,
.rp-inline-runner-actions .rp-loop-body-btn,
.rp-inline-runner-actions .rp-loop-exit-btn {
  padding: var(--size-2-3) var(--size-4-2);
  width: 100%;
  min-height: 36px;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  height: auto;
  align-items: flex-start;
  max-width: 100%;
  box-sizing: border-box;
  text-align: left;
}

/* Direct Question transitions are navigation, not report-producing Answers. */
.rp-inline-runner-actions .rp-question-transition-list {
  margin-top: var(--size-4-3);
}

.rp-inline-runner-actions .rp-question-transition-btn {
  border-left: 3px solid var(--interactive-accent);
  background: var(--background-secondary);
}
```

#### 4. src/__tests__/runner/render-question.test.ts:direct transition rendering
**File**: src/__tests__/runner/render-question.test.ts
**Changes**: MODIFY — cover edge order, captions, classes, callback identity, and mixed existing branches.

```typescript
// Extend makeGraph() before returning:
  nodes.set('q-labeled', baseNode('q-labeled', 'question', { questionText: 'Labeled target' }));
  nodes.set('q-fallback', baseNode('q-fallback', 'question', { questionText: 'Fallback question' }));
  nodes.set('q-id', baseNode('q-id', 'question', { questionText: '   ' }));

// Replace makeGraph() edge and adjacency fields:
    edges: [
      { id: 'e-fallback', fromNodeId: current.id, toNodeId: 'q-fallback' },
      { id: 'e-labeled', fromNodeId: current.id, toNodeId: 'q-labeled', label: 'Direct label' },
      { id: 'e-id', fromNodeId: current.id, toNodeId: 'q-id', label: '   ' },
    ],
    adjacency: new Map([[current.id, ['a1', 'q-labeled', 's-file', 's-dir', 'q-fallback', 'q-id']]]),

// Add to the main renderer test setup and host:
    const onChooseQuestionBranch = vi.fn();
      onChooseQuestionBranch,

// Add rendering assertions:
    expect(actionZone.children.map(child => child.cls)).toEqual([
      'rp-answer-list rp-stack',
      'rp-question-transition-list',
      'rp-snippet-branch-list',
    ]);
    expect(findByClass(actionZone, 'rp-question-transition-btn').map(btn => btn.text)).toEqual([
      'Fallback question',
      'Direct label',
      'q-id',
    ]);

// Dispatch the transition controls with the existing branch controls:
    for (const btn of findByClass(actionZone, 'rp-question-transition-btn')) {
      btn.clickHandler?.({} as MouseEvent);
    }

// Assert concrete edge identity and source order:
    expect(onChooseQuestionBranch.mock.calls.map(call => call[0].id)).toEqual([
      'e-fallback',
      'e-labeled',
      'e-id',
    ]);

// Add to the error/not-question host:
      onChooseQuestionBranch: vi.fn(),
```

#### 5. src/__tests__/views/inline-runner-modal.test.ts:direct transition host
**File**: src/__tests__/views/inline-runner-modal.test.ts
**Changes**: MODIFY — verify host runner delegation, rerender, and zero vault modification.

```typescript
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';

describe('InlineRunnerModal — direct Question transition host', () => {
  it('delegates the concrete edge ID, rerenders, and never modifies the note', () => {
    const { modal, app } = setupModal({ vaultContent: 'Existing note' });
    const graph: ProtocolGraph = {
      canvasFilePath: 'question-transition.rp.json',
      nodes: new Map<string, RPNode>([
        ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
        ['q-source', { id: 'q-source', kind: 'question', questionText: 'Source?', x: 0, y: 60, width: 100, height: 60 }],
        ['q-target', { id: 'q-target', kind: 'question', questionText: 'Target?', x: 0, y: 120, width: 100, height: 60 }],
      ]),
      edges: [
        { id: 'e-start', fromNodeId: 'start', toNodeId: 'q-source' },
        { id: 'e-transition', fromNodeId: 'q-source', toNodeId: 'q-target', label: 'Continue' },
      ],
      adjacency: new Map([
        ['start', ['q-source']],
        ['q-source', ['q-target']],
      ]),
      reverseAdjacency: new Map([
        ['q-source', ['start']],
        ['q-target', ['q-source']],
      ]),
      startNodeId: 'start',
    };
    const content = makeEl('div');
    const actions = makeEl('div');
    (modal as any).contentEl = content;
    (modal as any).actionsEl = actions;
    (modal as any).footerBtnRowEl = makeEl('div');
    (modal as any).containerEl = makeEl('div');
    (modal as any).graph = graph;
    (modal as any).runner.start(graph);
    const chooseSpy = vi.spyOn((modal as any).runner, 'chooseQuestionBranch');
    const renderSpy = vi.spyOn(modal as any, 'render');

    (modal as any).render();
    const transitionButtons = actions.querySelectorAll('.rp-question-transition-btn');
    expect(transitionButtons).toHaveLength(1);

    transitionButtons[0]!.dispatchEvent({ type: 'click' });

    expect(chooseSpy).toHaveBeenCalledWith('e-transition');
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect((modal as any).runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'q-target',
      accumulatedText: '',
    });
    expect(app.vault.modify).not.toHaveBeenCalled();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Renderer and host integration tests pass: `npx vitest run src/__tests__/runner/render-question.test.ts src/__tests__/views/inline-runner-modal.test.ts`
- [ ] Stylelint accepts the transition selectors: `npx stylelint "src/styles/inline-runner.css"`

#### Manual Verification:
- [ ] In an inline run with mixed branches, Answer buttons appear first, distinct transition buttons second, and Snippet buttons last.
- [ ] Clicking a direct transition changes the displayed Question without appending text to the active note.

## Phase 3: Editor authoring correctness

### Overview
Makes Start availability, Q-to-Q label persistence, and post-deletion editor state reflect the current stored document. Depends on Phase 2.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts:picker, label policy, and deletion paths
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — filter Start per invocation, preserve ordinary Q-to-Q labels, and assign successful deletion results to `this.doc`.

```typescript
// Add after the existing loop-exit arm in shouldDisplayProtocolEditorEdgeLabel(),
// before the final return false:
  // Ordinary Question-to-Question edges may carry authored transition captions.
  // Looped-question body labels remain hidden; loop exits are handled above.
  if (
    fromNode?.kind === 'question' &&
    fromNode.fields['loop'] !== true &&
    toNode?.kind === 'question'
  ) {
    return edge.label !== undefined && edge.label.trim() !== '';
  }

// In openNodeKindPickerAtWorldPoint(), replace the picker loop header:
    const hasStart = this.doc.nodes.some(node => node.kind === 'start');
    const availableKinds = hasStart
      ? EDITABLE_NODE_KINDS.filter(kind => kind !== 'start')
      : EDITABLE_NODE_KINDS;
    for (const kind of availableKinds) {

// Apply the same per-invocation replacement in
// openNodeKindPickerAndConnectAtWorldPoint():
    const hasStart = this.doc.nodes.some(node => node.kind === 'start');
    const availableKinds = hasStart
      ? EDITABLE_NODE_KINDS.filter(kind => kind !== 'start')
      : EDITABLE_NODE_KINDS;
    for (const kind of availableKinds) {

// In the node-delete confirm handler, capture and guard the update result:
        const protocolPath = this.protocolPath!;
        const generation = this.loadGeneration;
        const updated = await this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
          if (existing === null) protocolMissingFileError();
          const nodes = existing.nodes.filter((n) => n.id !== node.id);
          const edges = existing.edges.filter((e) => e.fromNodeId !== node.id && e.toNodeId !== node.id);
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        if (this.protocolPath !== protocolPath || this.loadGeneration !== generation) {
          closeModal();
          return;
        }
        this.doc = updated;
        closeModal();
        new Notice(t('protocolEditor.nodeDeleted'));
        void this.loadProtocol(protocolPath);
```

#### 2. src/__tests__/protocol-editor-helpers.test.ts:edge-label policy
**File**: src/__tests__/protocol-editor-helpers.test.ts
**Changes**: MODIFY — cover ordinary Q-to-Q labels while preserving loop-body and existing target policies.

```typescript
// Add ordinary Question fixtures beside the loop fixtures:
    const questionNodeA: ProtocolNodeRecord = {
      id: 'question-a',
      kind: 'question',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Question A',
      fields: { questionText: 'Question A' },
    };
    const questionNodeB: ProtocolNodeRecord = {
      id: 'question-b',
      kind: 'question',
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      text: 'Question B',
      fields: { questionText: 'Question B' },
    };

// Add to the edge-label policy test after the Answer/Snippet expectations:
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'q-to-q', fromNodeId: 'question-a', toNodeId: 'question-b', label: 'Follow up' },
        questionNodeA,
        questionNodeB,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'q-to-loop', fromNodeId: 'question-a', toNodeId: 'loop-a', label: 'Repeat' },
        questionNodeA,
        loopNodeA,
      )).toBe(true);
      expect(shouldDisplayProtocolEditorEdgeLabel(
        { id: 'q-to-q-empty', fromNodeId: 'question-a', toNodeId: 'question-b', label: '   ' },
        questionNodeA,
        questionNodeB,
      )).toBe(false);
```

#### 3. src/__tests__/views/protocol-editor-keyboard.test.ts:picker and persistence regressions
**File**: src/__tests__/views/protocol-editor-keyboard.test.ts
**Changes**: MODIFY — cover both picker states, Q-to-Q save/reopen behavior, and immediate post-delete Start availability.

```typescript
// Extend MockEl:
  appendText: (text: string) => void;

// Add to makeEl():
    appendText(text: string): void { el._text += text; },

// Add to the test translator map:
    'protocolEditor.edgeLabelHelp': 'Shown beside the edge',
    'protocolEditor.loopExitLabel': 'Loop exit',
    'protocolEditor.deleteEdgeLabel': 'Delete edge',
    'protocolEditor.edgeSaved': 'Edge saved',
    'protocolEditor.deleteNodeConfirm': 'Delete this node?',
    'protocolEditor.confirmDelete': 'Confirm delete',
    'protocolEditor.nodeDeleted': 'Node deleted',

// Add inside the existing node-kind picker describe, reusing
// nodeKindsInPicker() and openPickerDocument():
  it('both pickers hide Start when the current document already has one', () => {
    const { view } = createTestView();
    (view as any).doc.nodes.unshift({
      id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {},
    });
    const documentBody = openPickerDocument();

    (view as any).openNodeKindPickerAtWorldPoint(0, 0);
    expect(nodeKindsInPicker(documentBody)).toEqual(['question', 'answer', 'snippet']);

    documentBody.empty();
    (view as any).openNodeKindPickerAndConnectAtWorldPoint('node-1', 0, 0);
    expect(nodeKindsInPicker(documentBody)).toEqual(['question', 'answer', 'snippet']);
  });

  it('uses the successful Start deletion result before the asynchronous reload finishes', async () => {
    const savedWindow = (globalThis as any).window;
    const savedHTMLElement = (globalThis as any).HTMLElement;
    const documentBody = openPickerDocument();
    (globalThis as any).window = {
      requestAnimationFrame: (callback: () => void) => { callback(); return 0; },
      setTimeout: (callback: () => void) => { callback(); return 0; },
    };
    (globalThis as any).HTMLElement = class HTMLElement {};
    try {
      const startNode: ProtocolNodeRecord = {
        id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {},
      };
      let stored: ProtocolDocumentV1 = {
        schema: 'radiprotocol.protocol', version: 1, id: 'delete-start', title: 'Delete Start',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        nodes: [startNode], edges: [],
      };
      const update = vi.fn(async (_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1) => {
        stored = mutator(stored);
        return stored;
      });
      const view = new ProtocolEditorView({} as any, {
        i18n: { t }, settings: { snippetFolderPath: '.radiprotocol/snippets' },
        protocolDocumentStore: { update },
      } as any);
      (view as any).protocolPath = 'delete-start.rp.json';
      (view as any).doc = stored;
      (view as any).viewportEl = makeEl('div');
      (view as any).zoom = 1;
      (view as any).loadProtocol = vi.fn(() => new Promise<void>(() => {}));

      (view as any).openEditModal(startNode);
      const deleteBtn = findAllByTag(documentBody, 'button').find(button => button._text === 'Delete')!;
      for (const handler of deleteBtn._listeners.get('click') ?? []) handler({ target: deleteBtn });
      const confirmBtn = findAllByTag(documentBody, 'button').find(button => button._text === 'Confirm delete')!;
      for (const handler of confirmBtn._listeners.get('click') ?? []) await handler({ target: confirmBtn });

      expect((view as any).doc.nodes).toEqual([]);
      expect((view as any).loadProtocol).toHaveBeenCalledWith('delete-start.rp.json');

      (view as any).openNodeKindPickerAtWorldPoint(0, 0);
      expect(nodeKindsInPicker(documentBody)).toEqual(['start', 'question', 'answer', 'snippet']);
      documentBody.empty();
      (view as any).openNodeKindPickerAndConnectAtWorldPoint('start', 0, 0);
      expect(nodeKindsInPicker(documentBody)).toEqual(['start', 'question', 'answer', 'snippet']);
    } finally {
      (globalThis as any).window = savedWindow;
      (globalThis as any).HTMLElement = savedHTMLElement;
    }
  });

  it('does not apply a stale deletion result after another protocol loads', async () => {
    const savedWindow = (globalThis as any).window;
    const savedHTMLElement = (globalThis as any).HTMLElement;
    const documentBody = openPickerDocument();
    (globalThis as any).window = {
      requestAnimationFrame: (callback: () => void) => { callback(); return 0; },
      setTimeout: (callback: () => void) => { callback(); return 0; },
    };
    (globalThis as any).HTMLElement = class HTMLElement {};
    try {
      const startNode: ProtocolNodeRecord = {
        id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {},
      };
      const deletingDoc: ProtocolDocumentV1 = {
        schema: 'radiprotocol.protocol', version: 1, id: 'deleting', title: 'Deleting',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        nodes: [startNode], edges: [],
      };
      const activeDoc: ProtocolDocumentV1 = {
        ...deletingDoc,
        id: 'active',
        title: 'Active',
        nodes: [{
          id: 'active-question', kind: 'question', x: 0, y: 0, width: 200, height: 80,
          fields: { questionText: 'Active' },
        }],
      };
      let view!: ProtocolEditorView;
      const update = vi.fn(async (_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1) => {
        const deleted = mutator(deletingDoc);
        (view as any).protocolPath = 'active.rp.json';
        (view as any).doc = activeDoc;
        (view as any).loadGeneration += 1;
        return deleted;
      });
      view = new ProtocolEditorView({} as any, {
        i18n: { t }, settings: { snippetFolderPath: '.radiprotocol/snippets' },
        protocolDocumentStore: { update },
      } as any);
      (view as any).protocolPath = 'deleting.rp.json';
      (view as any).doc = deletingDoc;
      (view as any).viewportEl = makeEl('div');
      (view as any).zoom = 1;
      (view as any).loadProtocol = vi.fn(async () => {});

      (view as any).openEditModal(startNode);
      const deleteBtn = findAllByTag(documentBody, 'button').find(button => button._text === 'Delete')!;
      for (const handler of deleteBtn._listeners.get('click') ?? []) handler({ target: deleteBtn });
      const confirmBtn = findAllByTag(documentBody, 'button').find(button => button._text === 'Confirm delete')!;
      for (const handler of confirmBtn._listeners.get('click') ?? []) await handler({ target: confirmBtn });

      expect((view as any).protocolPath).toBe('active.rp.json');
      expect((view as any).doc).toBe(activeDoc);
      expect((view as any).loadProtocol).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).window = savedWindow;
      (globalThis as any).HTMLElement = savedHTMLElement;
    }
  });

describe('ProtocolEditorView: ordinary Question edge labels', () => {
  it('preserves a typed Q-to-Q label through save and reopen', async () => {
    const savedDocument = (globalThis as any).document;
    const savedWindow = (globalThis as any).window;
    const savedHTMLElement = (globalThis as any).HTMLElement;
    const documentBody = makeEl('body');
    (globalThis as any).document = { body: documentBody, activeElement: null };
    (globalThis as any).window = {
      requestAnimationFrame: (callback: () => void) => { callback(); return 0; },
    };
    (globalThis as any).HTMLElement = class HTMLElement {};
    try {
      const source: ProtocolNodeRecord = {
        id: 'q-source', kind: 'question', x: 0, y: 0, width: 200, height: 80,
        text: 'Source', fields: { questionText: 'Source' },
      };
      const target: ProtocolNodeRecord = {
        id: 'q-target', kind: 'question', x: 300, y: 0, width: 200, height: 80,
        text: 'Target', fields: { questionText: 'Target' },
      };
      let stored: ProtocolDocumentV1 = {
        schema: 'radiprotocol.protocol', version: 1, id: 'q-label', title: 'Q label',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        nodes: [source, target],
        edges: [{ id: 'q-edge', fromNodeId: source.id, toNodeId: target.id }],
      };
      const update = vi.fn(async (_path: string, mutator: (doc: ProtocolDocumentV1) => ProtocolDocumentV1) => {
        stored = mutator(stored);
        return stored;
      });
      const view = new ProtocolEditorView({} as any, {
        i18n: { t }, settings: { snippetFolderPath: '.radiprotocol/snippets' },
        protocolDocumentStore: { update },
      } as any);
      (view as any).protocolPath = 'q-label.rp.json';
      (view as any).doc = stored;
      (view as any).viewportEl = makeEl('div');
      (view as any).zoom = 1;
      (view as any).loadProtocol = vi.fn(async () => { (view as any).doc = stored; });

      (view as any).openEdgeModal(stored.edges[0]);
      const labelInput = findAllByTag(documentBody, 'input').find(input => input._attrs['type'] === 'text')!;
      labelInput.value = '  Follow up  ';
      const saveBtn = findAllByTag(documentBody, 'button').find(button => button._text === 'Save')!;
      for (const handler of saveBtn._listeners.get('click') ?? []) await handler({ target: saveBtn });

      expect(stored.edges[0]?.label).toBe('Follow up');
      expect((view as any).doc.edges[0]?.label).toBe('Follow up');

      (view as any).openEdgeModal((view as any).doc.edges[0]);
      const reopenedInput = findAllByTag(documentBody, 'input').find(input => input._attrs['type'] === 'text')!;
      expect(reopenedInput.value).toBe('Follow up');
    } finally {
      (globalThis as any).document = savedDocument;
      (globalThis as any).window = savedWindow;
      (globalThis as any).HTMLElement = savedHTMLElement;
    }
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Editor helper and view regression tests pass: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts`
- [ ] Complete project gate passes: `npm run check`

#### Manual Verification:
- [ ] With a Start present, both empty-canvas and connected-node pickers omit Start; after deleting it, both immediately show Start.
- [ ] Save a label on an ordinary Q-to-Q edge, reopen the edge modal, and confirm the trimmed label remains visible.
- [ ] Run a protocol containing Answer, Q-to-Q, looped-Q target, and Snippet choices and confirm all branch types remain usable.

## Ordering Constraints
- Phase 1 must land first because Phase 2 host wiring calls the new runner method.
- Phase 2 must follow Phase 1 so render callbacks compile against the runner API.
- Phase 3 is behaviorally independent of the runner implementation but remains last so terminal verification covers the complete authoring-to-runtime path.
- No phases should run in parallel; each phase is verified and locked before the next.

## Verification Notes
- Verify invalid edge IDs, wrong-source edges, and non-Question targets fail before redo clearing or undo pushes.
- Verify a successful direct transition preserves accumulated text, pushes one undo snapshot, clears redo, and round-trips through step-back/redo.
- Verify direct transitions to looped Questions halt in `awaiting-loop-pick` through existing traversal.
- Verify concrete edge order and callback identity; adjacency alone is insufficient.
- Verify label fallback and authored-label behavior without adding validation requirements for label-less edges.
- Verify mixed Answer, direct Question, and Snippet branches preserve their existing behavior and render ordering.
- Verify the direct-transition host path never reaches `vault.modify` or the physical note-write sink.
- Verify both node-kind pickers show Start only when the current document has no Start.
- Verify a Q-to-Q label survives editor save and reopen; this is a known regression hotspot from commits `50a7fcb`, `0ff2587`, and `f5850c0`.
- Verify successful Start deletion updates `this.doc` before the asynchronous reload so an immediately reopened picker shows Start.
- Run project baseline checks on the terminal phase: `npm run check`.

## Performance Considerations
- Picker filtering scans the current node array once per modal invocation; it adds no persistent cache or observer.
- Direct transition rendering filters the ordered edge array once for the current Question, matching the loop-picker precedent. No new graph-wide hot path, I/O, or N+1 behavior is introduced.
- Runner edge selection uses a linear edge-ID lookup, matching `chooseLoopBranch()`; protocol graphs are editor-local and already use this pattern.

## Migration Notes
Not applicable. The persisted schema, graph model, parser, validator, and existing protocol documents remain compatible.

## Pattern References
- `src/runner/protocol-runner.ts:184-220` — current Question/target/direct-branch validation pattern.
- `src/runner/protocol-runner.ts:242-281` — stable edge-ID lookup and undo-before-mutate pattern.
- `src/runner/render/render-loop-picker.ts:44-64` — ordered edge-aware rendering and callback identity.
- `src/graph/node-label.ts:18-22` — canonical Question caption fallback.
- `src/views/inline-runner-modal.ts:459-479` — ordinary Question renderer host wiring.
- `src/views/inline-runner-modal.ts:573-609` — runner mutation followed by rerender without note persistence.
- `src/views/protocol-editor-view.ts:708-718` and `src/views/protocol-editor-view.ts:983-1003` — successful store result assigned to current editor document.
- `src/__tests__/runner/render-question.test.ts:74-158` — local MockEl render test pattern.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts:17-62` — edge-driven traversal and state assertions.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:864-900` — exact ordered node-kind picker assertions.

## Developer Context
- Inherited research decisions are recorded in `## Decisions`; the upstream artifact contains the exact discover/research Q&A transcript.
- **Q:** “❓ Question: Ordinary Question choices currently render in `rp-answer-list` with `rp-answer-btn`, before the distinct Snippet list (`src/runner/render/render-question.ts:56-86`). Direct Q→Q transitions add no report text, so visual treatment affects whether users perceive them as navigation or answers. Which shape should the new transition buttons use?”
  **A:** “Distinct transition style”.
- **Design confirmation:** Developer approved distinct labeled Q-to-Q transition buttons, edge-ID traversal with undo/redo, no note write, Start-aware pickers, Q-to-Q label persistence, and immediate deletion-state synchronization.
- **Decomposition confirmation:** Developer approved three sequential slices: runner contract; renderer/host/CSS; editor authoring correctness.
- **Slice 1 checkpoint:** Developer approved the edge-ID runner action, loop-entry undo suppression, and focused state/history tests as generated. Verifier: Decisions OK; Cross-slice OK; Research OK.
- **Slice 2 checkpoint:** Developer approved ordered distinct transition rendering, direct host delegation, CSS treatment, and no-note-write coverage as generated. Verifier: Decisions OK; Cross-slice OK; Research OK.
- **Slice 3 checkpoint:** Developer approved Start-aware picker filtering, ordinary Q-to-Q label persistence, immediate deletion-state synchronization, and editor regression coverage as generated. Verifier: Decisions OK; Cross-slice OK; Research OK.
- **Step 9 reviewer triage:** Developer applied both concerns: whitespace-only target captions now fall back to target IDs, and node deletion now uses protocol-path/load-generation stale-operation guards with regression coverage.

## Plan History
- Phase 1: Runner transition contract — approved as generated
- Phase 2: Transition rendering and host wiring — revised: trim target captions before target-ID fallback.
- Phase 3: Editor authoring correctness — revised: guard deletion results by protocol path/load generation and test stale completion.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 2 §1 (render-question.ts) | `src/graph/node-label.ts:20` | concern | code-quality | `nodeLabel(target)` treats whitespace-only `questionText` as a valid caption, so a direct transition can render as a visually blank button instead of falling back to the target ID. | Resolve the fallback with `nodeLabel(target).trim() || edge.toNodeId`. | applied: trim the derived target caption and fall back to `edge.toNodeId`; render test now uses whitespace-only target text. |
| code | Phase 3 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:703-714` | concern | codebase-fit | The deletion result is assigned to `this.doc` without the protocol-path and load-generation stale-operation guards used by node creation, so a delayed deletion from a previously loaded protocol can overwrite the current document state. | Capture `protocolPath` and `loadGeneration` before deletion and apply the result only when both still match. | applied: capture path/generation, ignore stale results, and add a concurrent-load regression test. |

## References
- `.rpiv/artifacts/research/2026-07-29_09-38-38_hide-start-picker-q-to-q-transitions.md`
- `.rpiv/artifacts/discover/2026-07-29_09-21-06_hide-start-picker-q-to-q-transitions.md`
- `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`
- `.rpiv/artifacts/plans/2026-07-28_11-40-42_merge-loop-into-question.md`
- `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md`
