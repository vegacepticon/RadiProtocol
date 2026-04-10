// sessions/session-model.ts
// Pure type definitions for session persistence — zero Obsidian API imports (NFR-01)

/**
 * Persisted form of a LoopContext stack frame.
 * Identical shape to the runtime LoopContext — defined separately to keep
 * sessions/ independent of runner/ types.
 */
export interface PersistedLoopContext {
  loopStartId: string;
  iteration: number;
  textBeforeLoop: string;
}

/**
 * Persisted form of a single undo stack entry.
 * Identical shape to the runtime UndoEntry — defined separately for the same reason.
 */
export interface PersistedUndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: PersistedLoopContext[];
}

/**
 * Full snapshot of a ProtocolRunner session, serialized to JSON.
 * All fields are JSON-native — no Set values (SESSION-07).
 *
 * SESSION-07 audit: undoStack and loopContextStack are arrays; all leaf values
 * are strings and numbers. No Set<T> is present anywhere in runner state (verified
 * by RESEARCH.md Set Serialization Audit).
 */
export interface PersistedSession {
  /** Schema version — increment if shape changes to allow migration */
  version: 1;
  /** Vault-relative path of the canvas file this session belongs to */
  canvasFilePath: string;
  /** Unix ms timestamp from TFile.stat.mtime at the time the session was saved */
  canvasMtimeAtSave: number;
  /** Unix ms timestamp when this session file was last written */
  savedAt: number;
  /**
   * Runner status at save time.
   * Only 'at-node' is a valid resume state.
   * idle/complete/error sessions are never written to disk.
   */
  runnerStatus: 'at-node';
  /** currentNodeId from the runner */
  currentNodeId: string;
  /** accumulatedText snapshotted at save time (SESSION-05) */
  accumulatedText: string;
  /** Full undo stack — each entry is already JSON-serializable */
  undoStack: PersistedUndoEntry[];
  /** Full loop context stack at time of save */
  loopContextStack: PersistedLoopContext[];
}
