// runner/runner-state.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { LoopContext } from '../graph/graph-model';
import { RUNNER_STATUS } from '../constants/runner-states';

// --- Public state interfaces (returned by ProtocolRunner.getState()) ---

/** Runner has not been started yet. */
export interface IdleState {
  status: typeof RUNNER_STATUS.IDLE;
}

/**
 * Runner is paused at a question node awaiting chooseAnswer.
 */
export interface AtNodeState {
  status: typeof RUNNER_STATUS.AT_NODE;
  currentNodeId: string;
  accumulatedText: string;
  /** true when undoStack is non-empty — avoids exposing the stack itself (D-02) */
  canStepBack: boolean;
}

/**
 * Phase 30 D-06: runner paused at a snippet node while the user browses
 * the configured subfolder and picks a snippet. Transitions to
 * 'awaiting-snippet-fill' via pickSnippet().
 */
export interface AwaitingSnippetPickState {
  status: typeof RUNNER_STATUS.AWAITING_SNIPPET_PICK;
  nodeId: string;
  subfolderPath: string | undefined;
  accumulatedText: string;
  canStepBack: boolean;
}

/**
 * Phase 44 (RUN-01): runner paused at a unified loop node, presenting a picker
 * over all outgoing edges (body branches + «выход»). Transitions back to
 * 'at-node' via chooseLoopBranch(edgeId).
 */
export interface AwaitingLoopPickState {
  status: typeof RUNNER_STATUS.AWAITING_LOOP_PICK;
  nodeId: string;                 // loop node id — host looks up headerText from graph
  accumulatedText: string;
  canStepBack: boolean;
}

/**
 * Runner has reached a text-block node with a snippetId.
 * Phase 5 will call runner.completeSnippet(renderedText) to resume.
 * The runner carries snippetId and nodeId so the caller can open the correct modal.
 */
export interface AwaitingSnippetFillState {
  status: typeof RUNNER_STATUS.AWAITING_SNIPPET_FILL;
  snippetId: string;
  nodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}

/** All nodes have been traversed and there is no next node. */
export interface CompleteState {
  status: typeof RUNNER_STATUS.COMPLETE;
  finalText: string;
}

/**
 * An unrecoverable error occurred (unknown node, iteration cap exceeded, loop node
 * reached in Phase 2). The runner cannot continue — caller should surface message to user.
 */
export interface ErrorState {
  status: typeof RUNNER_STATUS.ERROR;
  message: string;
}

/** Discriminated union over all runner states. */
export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetPickState
  | AwaitingLoopPickState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;

// --- Internal types (exported for use by ProtocolRunner) ---

/**
 * One entry on the undo stack.
 * Captured BEFORE any mutation inside chooseAnswer().
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
  /** Phase 31 D-08: marks an entry pushed by chooseSnippetBranch. stepBack
   *  restores currentNodeId (the question) and runnerStatus='at-node' — so the
   *  user returns to the branch list, not the question's predecessor. */
  returnToBranchList?: boolean;
  /** Phase 66 D-05: desired runnerStatus after stepBack consumes this entry.
   *  Undefined → 'at-node' (existing default). returnToBranchList=true takes
   *  priority and still produces 'at-node' at the question. */
  restoreStatus?: RunnerState['status'];
}
