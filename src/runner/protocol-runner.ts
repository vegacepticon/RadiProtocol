// runner/protocol-runner.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { ProtocolGraph, LoopContext } from '../graph/graph-model';
import type { RunnerState, UndoEntry } from './runner-state';
import { TextAccumulator } from './text-accumulator';

export interface ProtocolRunnerOptions {
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
 *   stepBack()                — undo last user action
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

    // Advance to the next node after this answer
    const neighbors = this.graph.adjacency.get(answerId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.transitionToComplete();
      return;
    }
    this.advanceThrough(next);
  }

  /**
   * Undo the last user action (RUN-06).
   * Reverts both currentNodeId and accumulatedText to the state before the last
   * chooseAnswer() or chooseLoopAction() call (D-03).
   * No-op if canStepBack is false.
   */
  stepBack(): void {
    const entry = this.undoStack.pop();
    if (entry === undefined) return; // Nothing to undo

    this.currentNodeId = entry.nodeId;
    this.accumulator.restoreTo(entry.textSnapshot);
    this.loopContextStack = [...entry.loopContextStack]; // restore from snapshot (LOOP-05)
    this.runnerStatus = 'at-node';
    this.errorMessage = null;
  }

  /**
   * Inject a manual textarea edit into the accumulator before an advance action (BUG-01, D-01).
   * Must be called BEFORE chooseAnswer() / chooseLoopAction() so that
   * the undo snapshot captured inside those methods includes the manual edit.
   * No-op if runner is not in 'at-node' state.
   */
  syncManualEdit(text: string): void {
    if (this.runnerStatus !== 'at-node') return;
    this.accumulator.overwrite(text);
  }

  /**
   * User chooses to loop again or exit the loop at a loop-end node (LOOP-02).
   * Only valid in at-node state when current node is a loop-end node.
   * Pushes UndoEntry BEFORE mutation (same invariant as chooseAnswer).
   */
  chooseLoopAction(action: 'again' | 'done'): void {
    if (this.runnerStatus !== 'at-node') return;
    if (this.graph === null || this.currentNodeId === null) return;

    const node = this.graph.nodes.get(this.currentNodeId);
    if (node === undefined || node.kind !== 'loop-end') return;

    // Push undo entry BEFORE any mutation (LOOP-05)
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],
    });

    const frame = this.loopContextStack[this.loopContextStack.length - 1];

    if (action === 'again') {
      if (frame === undefined) {
        this.transitionToError('Loop context stack is empty at loop-end node.');
        return;
      }
      // Enforce per-loop iteration cap (RUN-09)
      const loopStartNode = this.graph.nodes.get(frame.loopStartId);
      if (loopStartNode?.kind === 'loop-start' && frame.iteration >= loopStartNode.maxIterations) {
        this.transitionToError(
          `Maximum iterations (${loopStartNode.maxIterations}) reached for loop "${loopStartNode.loopLabel}".`,
        );
        return;
      }
      // Increment iteration on the top stack frame (replace — do not mutate)
      this.loopContextStack[this.loopContextStack.length - 1] = {
        ...frame,
        iteration: frame.iteration + 1,
      };
      // Re-enter the loop body via loop-start's 'continue' edge (Pitfall 3)
      const continueNeighbor = this.edgeByLabel(frame.loopStartId, 'continue');
      if (continueNeighbor === undefined) {
        this.transitionToError(`Loop-start '${frame.loopStartId}' has no 'continue' edge for re-entry.`);
        return;
      }
      this.advanceThrough(continueNeighbor);
    } else {
      // 'done' — pop the loop frame and follow loop-start's 'exit' edge
      this.loopContextStack.pop();
      const loopStartId = node.loopStartId;
      const exitNeighbor = this.edgeByLabel(loopStartId, 'exit');
      if (exitNeighbor === undefined) {
        this.transitionToError(`Loop-start '${loopStartId}' has no 'exit' edge.`);
        return;
      }
      this.advanceThrough(exitNeighbor);
    }
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
        const topFrame = this.loopContextStack[this.loopContextStack.length - 1];
        const loopStartNode = topFrame !== undefined
          ? this.graph?.nodes.get(topFrame.loopStartId)
          : undefined;
        const loopLabel = loopStartNode?.kind === 'loop-start'
          ? loopStartNode.loopLabel
          : undefined;
        const loopIterationLabel =
          topFrame !== undefined && loopLabel !== undefined
            ? `${loopLabel} ${topFrame.iteration}`
            : undefined;
        return {
          status: 'at-node',
          currentNodeId: this.currentNodeId ?? '',
          accumulatedText: this.accumulator.current,
          canStepBack: this.undoStack.length > 0,
          loopIterationLabel,
          isAtLoopEnd: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'loop-end',
        };
      }
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
   * valid resume points (only 'at-node' is resumable).
   *
   * The returned object is JSON-safe: all values are strings, numbers, arrays of those,
   * or null. No Set values are present (SESSION-07 — verified by RESEARCH.md audit).
   *
   * Callers (RunnerView.autoSaveSession) add canvasFilePath, canvasMtimeAtSave,
   * savedAt, and version to complete the PersistedSession shape before writing.
   */
  getSerializableState(): {
    runnerStatus: 'at-node';
    currentNodeId: string;
    accumulatedText: string;
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopStartId: string; iteration: number; textBeforeLoop: string }> }>;
    loopContextStack: Array<{ loopStartId: string; iteration: number; textBeforeLoop: string }>;
  } | null {
    if (this.runnerStatus !== 'at-node') {
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
      })),
      loopContextStack: this.loopContextStack.map(f => ({ ...f })),
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
    runnerStatus: 'at-node';
    currentNodeId: string;
    accumulatedText: string;
    undoStack: Array<{ nodeId: string; textSnapshot: string; loopContextStack: Array<{ loopStartId: string; iteration: number; textBeforeLoop: string }> }>;
    loopContextStack: Array<{ loopStartId: string; iteration: number; textBeforeLoop: string }>;
  }): void {
    this.runnerStatus = session.runnerStatus;
    this.currentNodeId = session.currentNodeId;
    this.accumulator.restoreTo(session.accumulatedText);
    // Deep-copy to prevent aliasing between the session object and internal state
    this.undoStack = session.undoStack.map(e => ({
      nodeId: e.nodeId,
      textSnapshot: e.textSnapshot,
      loopContextStack: e.loopContextStack.map(f => ({ ...f })),
    }));
    this.loopContextStack = session.loopContextStack.map(f => ({ ...f }));
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
          | import('../graph/graph-model').TextBlockNode,
  ): 'newline' | 'space' {
    return node.radiprotocol_separator ?? this.defaultSeparator;
  }

  /**
   * Internal auto-advance loop.
   * Processes nodes that do not require user input (start, text-block, answer) and
   * halts at nodes that require input (question, loop-end) or terminal conditions.
   *
   * IMPORTANT: This method NEVER pushes UndoEntry (Pitfall 1 / D-03).
   * The iteration counter guards against infinite cycles (RUN-09 / D-08).
   */
  private advanceThrough(nodeId: string): void {
    let cursor = nodeId;
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
          if (next === undefined) {
            this.transitionToComplete();
            return;
          }
          cursor = next;
          break;
        }
        case 'text-block': {
          // NTYPE-03: plain-text only — no snippet fill branch
          this.accumulator.appendWithSeparator(node.content, this.resolveSeparator(node));
          const next = this.firstNeighbour(cursor);
          if (next === undefined) {
            this.transitionToComplete();
            return;
          }
          cursor = next;
          break;
        }
        case 'question': {
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
          if (next === undefined) {
            this.transitionToComplete();
            return;
          }
          cursor = next;
          break;
        }
        case 'loop-start': {
          // Push a new loop frame — iteration starts at 1 (LOOP-03)
          this.loopContextStack.push({
            loopStartId: cursor,
            iteration: 1,
            textBeforeLoop: this.accumulator.snapshot(),
          });
          // Follow the 'continue' edge into the loop body (LOOP-02)
          const continueNeighbor = this.edgeByLabel(cursor, 'continue');
          if (continueNeighbor === undefined) {
            this.transitionToError(`Loop-start node '${cursor}' has no 'continue' edge.`);
            return;
          }
          cursor = continueNeighbor;
          break;
        }
        case 'loop-end': {
          // Halt here — RunnerView will render "loop again / done" prompt (LOOP-02)
          this.currentNodeId = cursor;
          this.runnerStatus = 'at-node';
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

  private firstNeighbour(nodeId: string): string | undefined {
    if (this.graph === null) return undefined;
    const neighbors = this.graph.adjacency.get(nodeId);
    if (neighbors === undefined) return undefined;
    return neighbors[0];
  }

  /**
   * Returns the toNodeId of the first edge from nodeId with the given label.
   * Edge count per loop-start node is ≤ 2 — O(n) find is fine (RESEARCH.md Don't Hand-Roll).
   */
  private edgeByLabel(nodeId: string, label: string): string | undefined {
    if (this.graph === null) return undefined;
    return this.graph.edges.find(
      e => e.fromNodeId === nodeId && e.label === label,
    )?.toNodeId;
  }

  private transitionToComplete(): void {
    this.runnerStatus = 'complete';
  }

  private transitionToError(message: string): void {
    this.runnerStatus = 'error';
    this.errorMessage = message;
  }
}
