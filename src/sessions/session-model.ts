// sessions/session-model.ts
// Pure type definitions for session persistence — zero Obsidian API imports (NFR-01)

/**
 * Persisted frame of a loop context — serialized to session JSON.
 * Identical shape to the runtime LoopContext — defined separately to keep
 * sessions/ independent of runner/ types.
 *
 * Phase 43 D-04 / D-13: field renamed from loopStartId to loopNodeId alongside
 * unified loop node (LOOP-01). Break-compat: old sessions with loopStartId
 * gracefully rejected through validateSessionNodeIds → missing IDs → clear().
 */
export interface PersistedLoopContext {
  loopNodeId: string;
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
   * Only 'at-node', 'awaiting-snippet-pick', 'awaiting-snippet-fill', and 'awaiting-loop-pick' are valid
   * resume states. idle/complete/error sessions are never written to disk.
   */
  runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill' | 'awaiting-loop-pick';
  /** currentNodeId from the runner */
  currentNodeId: string;
  /** accumulatedText snapshotted at save time (SESSION-05) */
  accumulatedText: string;
  /** Full undo stack — each entry is already JSON-serializable */
  undoStack: PersistedUndoEntry[];
  /** Full loop context stack at time of save */
  loopContextStack: PersistedLoopContext[];
  /** snippetId if status is 'awaiting-snippet-fill'; null otherwise */
  snippetId: string | null;
  /** snippetNodeId if status is 'awaiting-snippet-fill'; null otherwise */
  snippetNodeId: string | null;
}
