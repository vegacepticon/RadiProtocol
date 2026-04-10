// runner/runner-state.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { LoopContext } from '../graph/graph-model';

// Four runner statuses — used as the discriminant field in RunnerState
export type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'complete'
  | 'error';

// --- Public state interfaces (returned by ProtocolRunner.getState()) ---

/** Runner has not been started yet. */
export interface IdleState {
  status: 'idle';
}

/**
 * Runner is paused at a node awaiting user input.
 * The node is a question (awaiting chooseAnswer).
 */
export interface AtNodeState {
  status: 'at-node';
  currentNodeId: string;
  accumulatedText: string;
  /** true when undoStack is non-empty — avoids exposing the stack itself (D-02) */
  canStepBack: boolean;
  /** Iteration label for display when inside a loop body (e.g., "Lesion 2") (LOOP-04) */
  loopIterationLabel?: string;
  /** true when currentNodeId refers to a loop-end node — drives UI branch (LOOP-02) */
  isAtLoopEnd?: boolean;
}

/** All nodes have been traversed and there is no next node. */
export interface CompleteState {
  status: 'complete';
  finalText: string;
}

/**
 * An unrecoverable error occurred (unknown node, iteration cap exceeded, loop node
 * reached in Phase 2). The runner cannot continue — caller should surface message to user.
 */
export interface ErrorState {
  status: 'error';
  message: string;
}

/** Discriminated union over all four runner states. */
export type RunnerState =
  | IdleState
  | AtNodeState
  | CompleteState
  | ErrorState;

// --- Internal types (exported for use by ProtocolRunner) ---

/**
 * One entry on the undo stack.
 * Captured BEFORE any mutation inside chooseAnswer() or chooseLoopAction().
 * Text-block auto-advances do NOT create separate UndoEntry values (D-03).
 */
export interface UndoEntry {
  /** currentNodeId BEFORE this user action */
  nodeId: string;
  /** accumulatedText BEFORE this user action — full string snapshot (D-04, RUN-07) */
  textSnapshot: string;
  /** Deep snapshot of the loop context stack at the moment this entry was pushed.
   *  Must be a spread copy — NOT a live reference (LOOP-05, Pitfall 1 in RESEARCH.md). */
  loopContextStack: LoopContext[];
}
