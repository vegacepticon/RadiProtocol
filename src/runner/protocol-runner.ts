// runner/protocol-runner.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { ProtocolGraph, LoopContext } from '../graph/graph-model';
import type { RunnerState, UndoEntry } from './runner-state';
import { TextAccumulator } from './text-accumulator';

interface ProtocolRunnerOptions {
  /** Hard maximum loop iteration count before transitioning to error state. Default: 50. (D-08, RUN-09) */
  maxIterations?: number;
  /** Separator inserted between text chunks when no per-node override is set. Default: 'newline'. (D-08, SEP-01) */
  defaultSeparator?: 'newline' | 'space';
}

/**
 * Pure traversal state machine for RadiProtocol sessions.
 *
 * Public API (D-01):
 *   start(graph)              — begin a session
 *   chooseAnswer(answerId)    — user selects a preset-text answer
 *   enterFreeText(text)       — user submits free-text input
 *   stepBack()                — undo last user action
 *   completeSnippet(text)     — Phase 5 submits rendered snippet text
 *   getState()                — read-only snapshot of current state (D-02)
 *
 * No Obsidian API — fully unit-testable with Vitest in a pure Node.js environment.
 */
export class ProtocolRunner {
  private readonly maxIterations: number;
  private readonly defaultSeparator: 'newline' | 'space';

  private graph: ProtocolGraph | null = null;
  private currentNodeId: string | null = null;
  private accumulator = new TextAccumulator();
  private undoStack: UndoEntry[] = [];
  private runnerStatus: RunnerState['status'] = 'idle';

  // Extra fields for non-at-node states
  private errorMessage: string | null = null;
  private snippetId: string | null = null;
  private snippetNodeId: string | null = null;
  private loopContextStack: LoopContext[] = [];

  constructor(options: ProtocolRunnerOptions = {}) {
    this.maxIterations = options.maxIterations ?? 50;
    this.defaultSeparator = options.defaultSeparator ?? 'newline';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start a new protocol session.
   * Transitions from idle to at-node (or error if graph has no start node).
   */
  start(graph: ProtocolGraph): void {
    this.graph = graph;
    this.currentNodeId = null;
    this.accumulator = new TextAccumulator();
    this.undoStack = [];
    this.errorMessage = null;
    this.snippetId = null;
    this.snippetNodeId = null;
    this.loopContextStack = [];
    this.runnerStatus = 'at-node';
    // Auto-advance from the start node
    this.advanceThrough(graph.startNodeId);
  }

  /**
   * User selects a preset-text answer button.
   * Only valid in at-node state when the current node is a question.
   * Pushes undo entry BEFORE mutation (D-03, D-04).
   */
  chooseAnswer(answerId: string): void {
    if (this.runnerStatus !== 'at-node') return;
    if (this.graph === null || this.currentNodeId === null) return;

    const answerNode = this.graph.nodes.get(answerId);
    if (answerNode === undefined || answerNode.kind !== 'answer') {
      this.transitionToError(`Answer node '${answerId}' not found or is not an answer node.`);
      return;
    }

    // Push undo entry BEFORE any mutation (Pitfall 3 — snapshot must come first)
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],
    });

    // Append the answer text
    this.accumulator.appendWithSeparator(answerNode.answerText, this.resolveSeparator(answerNode));

    // Advance to the next node after this answer.
    // Phase 44 UAT-fix: dead-end answer inside a loop body returns to the owning picker
    // (iteration++) instead of completing the protocol — matches the auto-advance contract in
    // advanceOrReturnToLoop (protocol-runner.ts:682-700). Outside a loop, dead-end still completes.
    const neighbors = this.graph.adjacency.get(answerId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.advanceOrReturnToLoop(undefined);
      return;
    }
    this.advanceThrough(next);
  }

  /**
   * Phase 31 D-08: user picks a snippet-kind branch at a question node.
   * Valid only in 'at-node' state when the current node is a question AND
   * the target is a direct snippet neighbour of that question. Pushes an
   * UndoEntry with returnToBranchList=true BEFORE any mutation so that
   * stepBack() returns the user to the question's branch list (not the
   * question's predecessor). Does NOT append anything to the accumulator —
   * the snippet picker takes over and the actual text insertion happens
   * later via completeSnippet().
   */
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

    const snippetNode = this.graph.nodes.get(snippetNodeId);
    if (snippetNode === undefined || snippetNode.kind !== 'snippet') {
      this.transitionToError(
        `Snippet node '${snippetNodeId}' not found or is not a snippet node.`,
      );
      return;
    }

    const neighbours = this.graph.adjacency.get(this.currentNodeId);
    if (neighbours === undefined || !neighbours.includes(snippetNodeId)) {
      this.transitionToError(
        `Snippet node '${snippetNodeId}' is not a direct branch of question '${this.currentNodeId}'.`,
      );
      return;
    }

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

  /**
   * Phase 44 (RUN-01, RUN-03): user picks a branch at the loop picker.
   * Valid only in 'awaiting-loop-pick'. Dispatches by edge label:
   *   - 'выход'  → pop the current loop frame, advance along the exit edge
   *   - other    → walk the body branch (B1 re-entry guard inside case 'loop'
   *                handles the iteration increment on return to picker)
   *
   * edgeId is the stable identifier per locked decision (planner D-02): labels
   * can duplicate and targetNodeIds can collide when two body branches point to
   * the same node. Only edgeId is unambiguous.
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

    // Undo-before-mutate (Pitfall 1)
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],
    });

    if (edge.label === 'выход') {
      // RUN-03: pop frame (top-of-stack, nested-safe)
      this.loopContextStack.pop();
    }
    // Body branch: DO NOT increment iteration here. The B1 re-entry guard inside
    // case 'loop' is the sole site that increments iteration (fires on back-edge
    // re-entry AND on inner-«выход» landing on outer). This keeps the semantic
    // "iteration = number of times user has seen the picker for this loop node":
    //   - First loop-entry:         iteration = 1 (halts at picker)
    //   - Pick body → walk → return: B1 increments to 2 (2nd picker view)
    //   - Pick body again → return:  B1 increments to 3 (3rd picker view)
    // Without this rule, both chooseLoopBranch AND B1 would increment, giving
    // iteration = 2*N + 1 after N picks — confusing and out of line with the
    // Plan 02b RUN-02 assertion expect(iteration).toBe(2).

    this.runnerStatus = 'at-node';
    this.advanceThrough(edge.toNodeId);
  }

  /**
   * User submits free-text input.
   * Only valid in at-node state when the current node is a free-text-input node.
   * Wraps text with prefix/suffix if present (RUN-04).
   * Pushes undo entry BEFORE mutation (D-03, D-04).
   */
  enterFreeText(text: string): void {
    if (this.runnerStatus !== 'at-node') return;
    if (this.graph === null || this.currentNodeId === null) return;

    const node = this.graph.nodes.get(this.currentNodeId);
    if (node === undefined || node.kind !== 'free-text-input') {
      this.transitionToError(`Current node '${this.currentNodeId}' is not a free-text-input node.`);
      return;
    }

    // Push undo entry BEFORE any mutation
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],
    });

    // Assemble final string with optional prefix/suffix (RUN-04)
    const prefix = node.prefix ?? '';
    const suffix = node.suffix ?? '';
    this.accumulator.appendWithSeparator(prefix + text + suffix, this.resolveSeparator(node));

    // Advance to the next node.
    // Phase 44 UAT-fix: dead-end free-text-input inside a loop body returns to the owning picker
    // (iteration++) instead of completing the protocol — same contract as dead-end answer.
    const neighbors = this.graph.adjacency.get(this.currentNodeId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.advanceOrReturnToLoop(undefined);
      return;
    }
    this.advanceThrough(next);
  }

  /**
   * Undo the last user action (RUN-06).
   * Reverts both currentNodeId and accumulatedText to the state before the last
   * chooseAnswer() or enterFreeText() call (D-03).
   * No-op if canStepBack is false.
   */
  stepBack(): void {
    const entry = this.undoStack.pop();
    if (entry === undefined) return; // Nothing to undo

    if (entry.returnToBranchList === true) {
      // Phase 31 D-08: close the branch-entered picker, return to the
      // question's branch list — not to the question's predecessor.
      this.currentNodeId = entry.nodeId;
      this.accumulator.restoreTo(entry.textSnapshot);
      this.loopContextStack = [...entry.loopContextStack];
      this.runnerStatus = 'at-node';
      this.snippetId = null;
      this.snippetNodeId = null;
      this.errorMessage = null;
      return;
    }

    this.currentNodeId = entry.nodeId;
    this.accumulator.restoreTo(entry.textSnapshot);
    this.loopContextStack = [...entry.loopContextStack]; // restore from snapshot (LOOP-05)
    this.runnerStatus = 'at-node';
    this.errorMessage = null;
    this.snippetId = null;
    this.snippetNodeId = null;
  }

  /**
   * Phase 30 D-08: user picks a snippet at the current snippet node.
   * Valid only in 'awaiting-snippet-pick'. Pushes UndoEntry BEFORE any
   * mutation so stepBack reverts to the snippet node's predecessor.
   * Transitions to 'awaiting-snippet-fill'; RunnerView then either opens
   * SnippetFillInModal (placeholders) or calls completeSnippet(template)
   * directly (no placeholders, D-09).
   */
  pickSnippet(snippetId: string): void {
    if (this.runnerStatus !== 'awaiting-snippet-pick') return;
    if (this.currentNodeId === null) return;

    // Pattern A: undo-before-mutate. Spread loopContextStack (LOOP-05).
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],
    });

    this.snippetId = snippetId;
    this.snippetNodeId = this.currentNodeId;
    this.runnerStatus = 'awaiting-snippet-fill';
  }

  /**
   * Phase 5 calls this after the user completes the snippet fill-in modal.
   * Only valid in awaiting-snippet-fill state (D-06, D-07).
   * Appends the pre-rendered text and advances past the snippet text-block node.
   */
  completeSnippet(renderedText: string): void {
    if (this.runnerStatus !== 'awaiting-snippet-fill') return;
    if (this.graph === null || this.snippetNodeId === null) return;

    const pendingNodeId = this.snippetNodeId;
    const snippetNode = this.graph.nodes.get(pendingNodeId);
    // Phase 31 D-04: also honour per-node override on SnippetNode (branch-entered picker)
    const snippetSep = (snippetNode?.kind === 'text-block' || snippetNode?.kind === 'snippet')
      ? this.resolveSeparator(snippetNode)
      : this.defaultSeparator;
    this.accumulator.appendWithSeparator(renderedText, snippetSep);
    this.snippetId = null;
    this.snippetNodeId = null;
    this.runnerStatus = 'at-node'; // Reset before advanceThrough determines next state

    // Advance from the node that had the snippetId.
    // Phase 44 UAT-fix: dead-end snippet inside a loop body returns to the owning picker
    // (iteration++) instead of completing the protocol — same contract as dead-end answer.
    const neighbors = this.graph.adjacency.get(pendingNodeId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.advanceOrReturnToLoop(undefined);
      return;
    }
    this.advanceThrough(next);
  }

  /**
   * Inject a manual textarea edit into the accumulator before an advance action (BUG-01, D-01).
   * Must be called BEFORE chooseAnswer() / enterFreeText() / chooseLoopBranch() so that
   * the undo snapshot captured inside those methods includes the manual edit.
   * No-op if runner is not in 'at-node' state.
   */
  syncManualEdit(text: string): void {
    if (this.runnerStatus !== 'at-node') return;
    this.accumulator.overwrite(text);
  }

  /**
   * Return a read-only snapshot of the current runner state (D-02).
   * Callers must narrow with switch(state.status) — do not access internal fields.
   */
  getState(): RunnerState {
    switch (this.runnerStatus) {
      case 'idle':
        return { status: 'idle' };
      case 'at-node': {
        return {
          status: 'at-node',
          currentNodeId: this.currentNodeId ?? '',
          accumulatedText: this.accumulator.current,
          canStepBack: this.undoStack.length > 0,
        };
      }
      case 'awaiting-snippet-pick': {
        if (this.graph === null || this.currentNodeId === null) {
          return { status: 'error', message: 'invalid awaiting-snippet-pick' };
        }
        const node = this.graph.nodes.get(this.currentNodeId);
        const subfolderPath =
          node !== undefined && node.kind === 'snippet' ? node.subfolderPath : undefined;
        return {
          status: 'awaiting-snippet-pick',
          nodeId: this.currentNodeId,
          subfolderPath,
          accumulatedText: this.accumulator.current,
          canStepBack: this.undoStack.length > 0,
        };
      }
      case 'awaiting-loop-pick':
        return {
          status: 'awaiting-loop-pick',
          nodeId: this.currentNodeId ?? '',
          accumulatedText: this.accumulator.current,
          canStepBack: this.undoStack.length > 0,
        };
      case 'awaiting-snippet-fill':
        return {
          status: 'awaiting-snippet-fill',
          snippetId: this.snippetId ?? '',
          nodeId: this.snippetNodeId ?? '',
          accumulatedText: this.accumulator.current,
          canStepBack: this.undoStack.length > 0,
        };
      case 'complete':
        return { status: 'complete', finalText: this.accumulator.current };
      case 'error':
        return { status: 'error', message: this.errorMessage ?? 'Unknown error.' };
      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = this.runnerStatus;
        void _exhaustive;
        return { status: 'error', message: 'Unknown runner status.' };
      }
    }
  }

  /**
   * Return a serializable snapshot of current runner state for session persistence (SESSION-01).
   * Returns null when the runner is in idle, complete, or error state — these are not
   * valid resume points (only 'at-node' and 'awaiting-snippet-fill' are resumable).
   *
   * The returned object is JSON-safe: all values are strings, numbers, arrays of those,
   * or null. No Set values are present (SESSION-07 — verified by RESEARCH.md audit).
   *
   * Callers (RunnerView.autoSaveSession) add canvasFilePath, canvasMtimeAtSave,
   * savedAt, and version to complete the PersistedSession shape before writing.
   */
  getSerializableState(): {
    runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill' | 'awaiting-loop-pick';
    currentNodeId: string;
    accumulatedText: string;
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
    loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>;
    snippetId: string | null;
    snippetNodeId: string | null;
  } | null {
    if (
      this.runnerStatus !== 'at-node' &&
      this.runnerStatus !== 'awaiting-snippet-fill' &&
      this.runnerStatus !== 'awaiting-snippet-pick' &&
      this.runnerStatus !== 'awaiting-loop-pick'
    ) {
      return null;
    }
    return {
      runnerStatus: this.runnerStatus,
      currentNodeId: this.currentNodeId ?? '',
      accumulatedText: this.accumulator.current,
      // Deep-copy arrays to prevent aliasing (Pitfall 1 — snapshot must be independent)
      undoStack: this.undoStack.map(e => ({
        nodeId: e.nodeId,
        textSnapshot: e.textSnapshot,
        loopContextStack: e.loopContextStack.map(f => ({ ...f })),
        returnToBranchList: e.returnToBranchList,
      })),
      loopContextStack: this.loopContextStack.map(f => ({ ...f })),
      snippetId: this.snippetId,
      snippetNodeId: this.snippetNodeId,
    };
  }

  /**
   * Set the graph reference without calling start() or advanceThrough() (SESSION-01).
   * Must be called BEFORE restoreFrom() so subsequent runner method calls have a valid
   * graph to traverse (Pitfall 2 in RESEARCH.md — restoreFrom before setGraph causes silent no-ops).
   *
   * Correct call order in RunnerView.openCanvas():
   *   1. runner.setGraph(parsedGraph)
   *   2. runner.restoreFrom(session)
   *   3. this.render()
   */
  setGraph(graph: ProtocolGraph): void {
    this.graph = graph;
  }

  /**
   * Restore runner state from a persisted session snapshot (SESSION-01).
   * Directly assigns all private fields — does NOT call start() or advanceThrough().
   *
   * PRECONDITION: setGraph() must be called first (Pitfall 2).
   * POSTCONDITION: getState() returns the same status/nodeId/text as was present at save time.
   *
   * errorMessage is always reset to null after a valid restore (a restored session
   * is never in error state).
   */
  restoreFrom(session: {
    runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill' | 'awaiting-loop-pick';
    currentNodeId: string;
    accumulatedText: string;
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>; returnToBranchList?: boolean }>;
    loopContextStack: Array<{ loopNodeId: string; iteration: number; textBeforeLoop: string }>;
    snippetId: string | null;
    snippetNodeId: string | null;
  }): void {
    this.runnerStatus = session.runnerStatus;
    this.currentNodeId = session.currentNodeId;
    this.accumulator.restoreTo(session.accumulatedText);
    // Deep-copy to prevent aliasing between the session object and internal state
    this.undoStack = session.undoStack.map(e => ({
      nodeId: e.nodeId,
      textSnapshot: e.textSnapshot,
      loopContextStack: e.loopContextStack.map(f => ({ ...f })),
      returnToBranchList: e.returnToBranchList,
    }));
    this.loopContextStack = session.loopContextStack.map(f => ({ ...f }));
    this.snippetId = session.snippetId;
    this.snippetNodeId = session.snippetNodeId;
    // errorMessage is always null after a valid restore (SESSION-06)
    this.errorMessage = null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Resolve the effective separator for a node that produces text (D-04).
   * Per-node radiprotocol_separator takes priority over the global default.
   */
  private resolveSeparator(
    node: import('../graph/graph-model').AnswerNode
          | import('../graph/graph-model').FreeTextInputNode
          | import('../graph/graph-model').TextBlockNode
          | import('../graph/graph-model').SnippetNode,
  ): 'newline' | 'space' {
    // Phase 31 D-04: SnippetNode uses its own property name
    if (node.kind === 'snippet') {
      return node.radiprotocol_snippetSeparator ?? this.defaultSeparator;
    }
    return node.radiprotocol_separator ?? this.defaultSeparator;
  }

  /**
   * Internal auto-advance loop.
   * Processes nodes that do not require user input (start, text-block, answer) and
   * halts at nodes that require input (question, free-text-input) or terminal conditions.
   *
   * IMPORTANT: This method NEVER pushes UndoEntry (Pitfall 1 / D-03).
   * The iteration counter guards against infinite cycles (RUN-09 / D-08).
   */
  private advanceThrough(nodeId: string): void {
    let cursor = nodeId;
    // B2 — previousCursor records the node we were at BEFORE the current cursor was assigned.
    // Used by case 'loop' below to push an undo entry with nodeId=<predecessor> so step-back
    // from the picker restores the predecessor. When advanceThrough is called directly from
    // start() or chooseLoopBranch() and the first node IS the loop itself, previousCursor stays
    // null; the loop-entry undo push then falls back to nodeId=cursor (step-back becomes a
    // logical no-op — re-running advanceThrough lands back at the same picker).
    let previousCursor: string | null = null;
    // steps counter resets on each advanceThrough entry (RUN-07 context: per-call cycle guard,
    // NOT per-loop cap). W4 — long-body integration test in Plan 02b Task 2 exercises a loop
    // body with 10 text-blocks × 10 iterations ≈ 110 nodes-per-call to confirm the guard does
    // NOT trip in realistic long-body cases. ProtocolRunner.maxIterations stays at its default.
    let steps = 0;

    while (true) {
      steps += 1;
      if (steps > this.maxIterations) {
        this.transitionToError(
          `Iteration cap reached (${this.maxIterations}). Possible cycle in protocol.`,
        );
        return;
      }

      if (this.graph === null) {
        this.transitionToError('Internal error: graph is null during traversal.');
        return;
      }

      const node = this.graph.nodes.get(cursor);
      if (node === undefined) {
        this.transitionToError(`Node '${cursor}' not found in graph.`);
        return;
      }

      switch (node.kind) {
        case 'start': {
          // Auto-advance through the start node to the first real node
          const next = this.firstNeighbour(cursor);
          if (this.advanceOrReturnToLoop(next) === 'halted') return;
          previousCursor = cursor;   // B2 threading
          cursor = next!;
          break;
        }
        case 'text-block': {
          if (node.snippetId !== undefined) {
            // D-06: transition to awaiting-snippet-fill for Phase 5 to handle
            this.runnerStatus = 'awaiting-snippet-fill';
            this.snippetId = node.snippetId;
            this.snippetNodeId = cursor;
            return;
          }
          // RUN-05: auto-append static text — no user interaction required
          this.accumulator.appendWithSeparator(node.content, this.resolveSeparator(node));
          const next = this.firstNeighbour(cursor);
          if (this.advanceOrReturnToLoop(next) === 'halted') return;
          previousCursor = cursor;   // B2 threading
          cursor = next!;
          break;
        }
        case 'question':
        case 'free-text-input': {
          // Halts here — awaiting user input
          this.currentNodeId = cursor;
          this.runnerStatus = 'at-node';
          return;
        }
        case 'answer': {
          // Answer nodes are traversed as pass-through: append text, follow edge.
          // This handles answer → text-block → question chains correctly.
          this.accumulator.appendWithSeparator(node.answerText, this.resolveSeparator(node));
          const next = this.firstNeighbour(cursor);
          if (this.advanceOrReturnToLoop(next) === 'halted') return;
          previousCursor = cursor;   // B2 threading
          cursor = next!;
          break;
        }
        // Phase 44 (RUN-01) — unified loop runtime: halt at picker.
        case 'loop': {
          // B1 re-entry guard — check top-of-stack BEFORE pushing a new frame.
          // If the top frame's loopNodeId === cursor, this call is a re-entry via a body
          // back-edge (e.g. n-a1 → n-loop in unified-loop-valid.canvas) OR an inner «выход»
          // that lands on the outer loop node (e.g. e5: n-inner → n-outer in
          // unified-loop-nested.canvas). In both cases the frame already exists — increment
          // iteration in-place and halt at the picker WITHOUT pushing a second frame and
          // WITHOUT pushing a second undo entry (preserves RUN-02 iteration semantics and
          // RUN-04 single-outer-frame invariant).
          const top = this.loopContextStack[this.loopContextStack.length - 1];
          if (top !== undefined && top.loopNodeId === cursor) {
            top.iteration += 1;
            this.currentNodeId = cursor;
            this.runnerStatus = 'awaiting-loop-pick';
            return;
          }

          // First-entry path — push undo snapshot + new frame + halt.
          // Undo-before-mutate (Pitfall 1) with B2 previousCursor threading:
          //   - If previousCursor !== null we came here via auto-advance from a real predecessor;
          //     push undo with nodeId=previousCursor so step-back restores that predecessor.
          //   - If previousCursor === null we entered advanceThrough directly at the loop node
          //     (e.g. start() on a graph whose start-edge points straight at a loop, or any other
          //     zero-auto-advance path). Push undo with nodeId=cursor so canStepBack=true. Step-back
          //     will restore currentNodeId=loopNode + empty loopContextStack; re-running advanceThrough
          //     from the loop node will fall through here again and re-halt at the picker. This is
          //     a logical no-op from the user's perspective (the button clicks but nothing visible
          //     changes) — acceptable because (a) consistent canStepBack behaviour in the union type,
          //     (b) keeps the UI "Step back" button enabled symmetrically, (c) no data loss.
          this.undoStack.push({
            nodeId: previousCursor !== null ? previousCursor : cursor,
            textSnapshot: this.accumulator.snapshot(),
            loopContextStack: [...this.loopContextStack],  // shallow spread — frames are primitive-only
          });
          this.loopContextStack.push({
            loopNodeId: cursor,
            iteration: 1,
            textBeforeLoop: this.accumulator.snapshot(),
          });
          this.currentNodeId = cursor;
          this.runnerStatus = 'awaiting-loop-pick';
          return;
        }
        case 'loop-start':
        case 'loop-end': {
          // Phase 43 D-14 — legacy kinds парсируются (D-06) для migration-error через GraphValidator.
          // В runtime не доходят: validator отвергает канвас до старта runner'а.
          this.transitionToError(
            'Обнаружен устаревший узел loop-start/loop-end. Канвас должен быть отклонён validator-ом; ' +
            'если вы видите это сообщение — это программная ошибка, сообщите автору плагина.',
          );
          return;
        }
        case 'snippet': {
          // Phase 30 D-07: halt at snippet node, RunnerView renders the picker.
          this.currentNodeId = cursor;
          this.runnerStatus = 'awaiting-snippet-pick';
          return;
        }
        default: {
          // TypeScript exhaustiveness check — should never reach here with correct graph
          const _exhaustive: never = node;
          void _exhaustive;
          this.transitionToError('Unknown node kind encountered during traversal.');
          return;
        }
      }
    }
  }

  /**
   * Phase 44 (RUN-02): helper for auto-advance dead-end handling.
   * When `next` is undefined (current node has no outgoing edge):
   *   - if inside a loop frame, increment the top frame's iteration, set
   *     currentNodeId to the top frame's loopNodeId, set runnerStatus to
   *     'awaiting-loop-pick', and return 'halted';
   *   - otherwise call transitionToComplete() and return 'halted'.
   * When `next` is defined, return 'continue' — caller updates its local cursor.
   *
   * Iteration semantic: dead-end bodies and back-edge bodies BOTH count as one
   * new iteration per return to the picker. Back-edge bodies hit B1 re-entry
   * guard inside case 'loop' (different code path); this helper is ONLY for the
   * true-dead-end case (node with zero outgoing edges).
   */
  private advanceOrReturnToLoop(next: string | undefined): 'continue' | 'halted' {
    if (next !== undefined) return 'continue';
    if (this.loopContextStack.length > 0) {
      const frame = this.loopContextStack[this.loopContextStack.length - 1];
      if (frame !== undefined) {
        // Dead-end body (no outgoing edge) returning to the owning picker counts as a new
        // iteration, same as a back-edge body would (via B1 re-entry guard). This keeps the
        // semantic consistent: EVERY return to a picker from a body pass increments iteration
        // exactly once. Note that back-edge bodies reach the loop node via cursor = next! →
        // case 'loop' → B1 guard, which is a different code path and NOT this helper.
        frame.iteration += 1;
        this.currentNodeId = frame.loopNodeId;
        this.runnerStatus = 'awaiting-loop-pick';
        return 'halted';
      }
    }
    this.transitionToComplete();
    return 'halted';
  }

  private firstNeighbour(nodeId: string): string | undefined {
    if (this.graph === null) return undefined;
    const neighbors = this.graph.adjacency.get(nodeId);
    if (neighbors === undefined) return undefined;
    return neighbors[0];
  }

  private transitionToComplete(): void {
    this.runnerStatus = 'complete';
  }

  private transitionToError(message: string): void {
    this.runnerStatus = 'error';
    this.errorMessage = message;
  }
}
