// sessions/session-service.ts
// Pure module — zero Obsidian API imports (NFR-01)
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import type { PersistedSession } from './session-model';
import type { ProtocolGraph } from '../graph/graph-model';

/**
 * CRUD for session JSON files stored in {sessionFolderPath}/{encoded}.json (SESSION-01).
 * One session file per canvas file — keyed by the vault-relative canvas path.
 * Every vault write is wrapped in WriteMutex.runExclusive() (SESSION-01, NFR-09).
 * Folder existence is guaranteed via ensureFolderPath() before every write.
 */
export class SessionService {
  private readonly app: App;
  private readonly sessionFolderPath: string;
  private readonly mutex = new WriteMutex();

  constructor(app: App, sessionFolderPath: string) {
    this.app = app;
    this.sessionFolderPath = sessionFolderPath;
  }

  /**
   * Derive session file path from canvas file path.
   * Uses encodeURIComponent to avoid slug collisions (Pitfall 4, RESEARCH.md).
   * e.g. 'protocols/chest.canvas' → '.radiprotocol/sessions/protocols%2Fchest.canvas.json'
   */
  private sessionFilePath(canvasFilePath: string): string {
    return `${this.sessionFolderPath}/${encodeURIComponent(canvasFilePath)}.json`;
  }

  /**
   * Save a session. Idempotent — overwrites any existing session file for this canvas.
   * Always uses vault.adapter.write() (SESSION-01) — this avoids vault.create() path
   * normalisation issues with encodeURIComponent-encoded characters such as %2F.
   * vault.adapter.write() creates the file if it does not exist and treats the path as
   * a literal filesystem path, matching the behaviour needed for encoded filenames.
   */
  async save(session: PersistedSession): Promise<void> {
    const filePath = this.sessionFilePath(session.canvasFilePath);
    const payload = JSON.stringify(session, null, 2);

    await this.mutex.runExclusive(filePath, async () => {
      await ensureFolderPath(this.app.vault, this.sessionFolderPath);
      await this.app.vault.adapter.write(filePath, payload);
    });
  }

  /**
   * Load a session for the given canvas path.
   * Returns null if no session exists, JSON is corrupt, or required fields are missing.
   * Wraps JSON.parse in try/catch to handle sync-conflict corrupted files (Pitfall 7, SESSION-06).
   */
  async load(canvasFilePath: string): Promise<PersistedSession | null> {
    const filePath = this.sessionFilePath(canvasFilePath);
    const exists = await this.app.vault.adapter.exists(filePath);
    if (!exists) return null;

    try {
      const raw = await this.app.vault.adapter.read(filePath);
      const parsed = JSON.parse(raw) as PersistedSession;
      // Validate minimum required fields to detect truncated or corrupted JSON (SESSION-06)
      if (typeof parsed.version !== 'number' || typeof parsed.canvasFilePath !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      // JSON.parse failure — corrupt or sync-conflict file; degrade gracefully (SESSION-06)
      return null;
    }
  }

  /**
   * Delete the session file for the given canvas path.
   * No-op if the file does not exist.
   * Called when: protocol completes, user chooses "Start over", node ID validation fails.
   *
   * Uses vault.adapter.remove() — NOT vault.delete() — for the same reason save() uses
   * vault.adapter.write(): vault.getAbstractFileByPath() looks up files by the
   * normalised vault index path, which decodes %2F back to /, so a filename like
   * "protocols%2Fchest.canvas.json" is never found in the index and getAbstractFileByPath
   * returns null. vault.adapter.remove() treats the path as a literal filesystem path,
   * matching exactly how the file was written by save().
   */
  async clear(canvasFilePath: string): Promise<void> {
    const filePath = this.sessionFilePath(canvasFilePath);
    const exists = await this.app.vault.adapter.exists(filePath);
    if (!exists) return;
    await this.app.vault.adapter.remove(filePath);
  }

  /**
   * Check if an incomplete session exists for the given canvas path.
   * Returns true if a session file is present (does not validate content).
   */
  async hasSession(canvasFilePath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(this.sessionFilePath(canvasFilePath));
  }
}

/**
 * Validate that all node IDs referenced in a saved session still exist in the current
 * graph. Returns a deduplicated array of missing IDs (SESSION-03).
 *
 * Exported as a pure function (not a SessionService method) so RunnerView can call it
 * without going through the service. No vault I/O — purely structural.
 *
 * Checks: currentNodeId, all nodeIds in undoStack, all loopStartIds in undoStack
 * loopContextStacks, and all loopStartIds in the top-level loopContextStack.
 * Does NOT check snippetNodeId because it always equals currentNodeId when set.
 */
export function validateSessionNodeIds(
  session: PersistedSession,
  graph: ProtocolGraph,
): string[] {
  const missing: string[] = [];

  // Check currentNodeId
  if (!graph.nodes.has(session.currentNodeId)) {
    missing.push(session.currentNodeId);
  }

  // Check all nodeIds in the undo stack + their loopContextStack loopStartIds
  for (const entry of session.undoStack) {
    if (!graph.nodes.has(entry.nodeId)) {
      missing.push(entry.nodeId);
    }
    for (const frame of entry.loopContextStack) {
      if (!graph.nodes.has(frame.loopStartId)) {
        missing.push(frame.loopStartId);
      }
    }
  }

  // Check loopStartIds in the top-level loopContextStack
  for (const frame of session.loopContextStack) {
    if (!graph.nodes.has(frame.loopStartId)) {
      missing.push(frame.loopStartId);
    }
  }

  // Remove duplicates without using Set (SESSION-07: prefer arrays)
  return missing.filter((id, idx) => missing.indexOf(id) === idx);
}
