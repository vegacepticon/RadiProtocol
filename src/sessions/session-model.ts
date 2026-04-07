// sessions/session-model.ts — TODO: Phase 7 implementation
// Type definitions for persisted session data
import type { UndoEntry } from '../runner/runner-state';
import type { LoopContext } from '../graph/graph-model';

/**
 * Shape of a serialized session saved to vault.
 * All fields must be JSON-serializable (no Set, Map, or class instances).
 */
export interface PersistedSession {
  /** Schema version — increment on breaking changes */
  version: number;
  /** Vault-relative path of the canvas file */
  canvasFilePath: string;
  /** mtime of the canvas file when session was saved (ms since epoch) */
  canvasMtimeAtSave: number;
  /** Timestamp when session was saved (ms since epoch) */
  savedAt: number;
  /** Runner status at save time — only 'at-node' or 'awaiting-snippet-fill' are valid */
  runnerStatus: 'at-node' | 'awaiting-snippet-fill';
  /** Node the runner halted at */
  currentNodeId: string;
  /** Accumulated protocol text at save time */
  accumulatedText: string;
  /** Undo stack snapshot */
  undoStack: UndoEntry[];
  /** Loop context stack snapshot */
  loopContextStack: LoopContext[];
  /** Active snippet ID (null when not in snippet state) */
  snippetId: string | null;
  /** Active snippet node ID (null when not in snippet state) */
  snippetNodeId: string | null;
}
