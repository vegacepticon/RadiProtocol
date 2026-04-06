// runner/protocol-runner.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { ProtocolGraph } from '../graph/graph-model';
import type { RunnerState, UndoEntry } from './runner-state';
import { TextAccumulator } from './text-accumulator';

export interface ProtocolRunnerOptions {
  /** Hard maximum loop iteration count before transitioning to error state. Default: 50. (D-08, RUN-09) */
  maxIterations?: number;
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

  private graph: ProtocolGraph | null = null;
  private currentNodeId: string | null = null;
  private accumulator = new TextAccumulator();
  private undoStack: UndoEntry[] = [];
  private runnerStatus: RunnerState['status'] = 'idle';

  // Extra fields for non-at-node states
  private errorMessage: string | null = null;
  private snippetId: string | null = null;
  private snippetNodeId: string | null = null;

  constructor(options: ProtocolRunnerOptions = {}) {
    this.maxIterations = options.maxIterations ?? 50;
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
    });

    // Append the answer text
    this.accumulator.append(answerNode.answerText);

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
    });

    // Assemble final string with optional prefix/suffix (RUN-04)
    const prefix = node.prefix ?? '';
    const suffix = node.suffix ?? '';
    this.accumulator.append(prefix + text + suffix);

    // Advance to the next node
    const neighbors = this.graph.adjacency.get(this.currentNodeId);
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
   * chooseAnswer() or enterFreeText() call (D-03).
   * No-op if canStepBack is false.
   */
  stepBack(): void {
    const entry = this.undoStack.pop();
    if (entry === undefined) return; // Nothing to undo

    this.currentNodeId = entry.nodeId;
    this.accumulator.restoreTo(entry.textSnapshot);
    this.runnerStatus = 'at-node';
    this.errorMessage = null;
    this.snippetId = null;
    this.snippetNodeId = null;
  }

  /**
   * Phase 5 calls this after the user completes the snippet fill-in modal.
   * Only valid in awaiting-snippet-fill state (D-06, D-07).
   * Appends the pre-rendered text and advances past the snippet text-block node.
   */
  completeSnippet(renderedText: string): void {
    if (this.runnerStatus !== 'awaiting-snippet-fill') return;
    if (this.graph === null || this.snippetNodeId === null) return;

    this.accumulator.append(renderedText);
    this.snippetId = null;

    const pendingNodeId = this.snippetNodeId;
    this.snippetNodeId = null;
    this.runnerStatus = 'at-node'; // Reset before advanceThrough determines next state

    // Advance from the node that had the snippetId
    const neighbors = this.graph.adjacency.get(pendingNodeId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.transitionToComplete();
      return;
    }
    this.advanceThrough(next);
  }

  /**
   * Return a read-only snapshot of the current runner state (D-02).
   * Callers must narrow with switch(state.status) — do not access internal fields.
   */
  getState(): RunnerState {
    switch (this.runnerStatus) {
      case 'idle':
        return { status: 'idle' };
      case 'at-node':
        return {
          status: 'at-node',
          currentNodeId: this.currentNodeId ?? '',
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

  // ── Private helpers ──────────────────────────────────────────────────────────

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
          if (node.snippetId !== undefined) {
            // D-06: transition to awaiting-snippet-fill for Phase 5 to handle
            this.runnerStatus = 'awaiting-snippet-fill';
            this.snippetId = node.snippetId;
            this.snippetNodeId = cursor;
            return;
          }
          // RUN-05: auto-append static text — no user interaction required
          this.accumulator.append(node.content);
          const next = this.firstNeighbour(cursor);
          if (next === undefined) {
            this.transitionToComplete();
            return;
          }
          cursor = next;
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
          this.accumulator.append(node.answerText);
          const next = this.firstNeighbour(cursor);
          if (next === undefined) {
            this.transitionToComplete();
            return;
          }
          cursor = next;
          break;
        }
        case 'loop-start':
        case 'loop-end': {
          // D-05: Phase 2 stub — this exact block is replaced in Phase 6
          this.transitionToError(
            'Loop nodes are not yet supported — upgrade to Phase 6',
          );
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

  private transitionToComplete(): void {
    this.runnerStatus = 'complete';
  }

  private transitionToError(message: string): void {
    this.runnerStatus = 'error';
    this.errorMessage = message;
  }
}
