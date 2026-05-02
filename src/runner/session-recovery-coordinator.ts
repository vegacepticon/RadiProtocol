import { TFile } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { ProtocolGraph } from '../graph/graph-model';
import { ProtocolRunner } from './protocol-runner';
import { ResumeSessionModal } from '../views/resume-session-modal';
import { validateSessionNodeIds } from '../sessions/session-service';
import type { PersistedSession } from '../sessions/session-model';

/**
 * Phase 83: owns autosave, resume prompt, and canvas-modification-warning.
 * Extracted from RunnerView to keep the view shell focused on ItemView lifecycle
 * and host chrome only.
 */
export class SessionRecoveryCoordinator {
  constructor(private readonly plugin: RadiProtocolPlugin) {}

  /**
   * SESSION-02 → SESSION-06: check for an existing incomplete session,
   * validate node IDs, check canvas mtime, present ResumeSessionModal,
   * and either restore the runner or signal a fresh start.
   *
   * Returns:
   *   'resume'    — runner has been restored from the saved session.
   *   'start-over' — stale session was cleared; caller should start fresh.
   *   'error'      — session is corrupt; `messages` contains user-facing errors.
   */
  async resolveSession(
    filePath: string,
    graph: ProtocolGraph,
    file: TFile,
    runner: ProtocolRunner,
  ): Promise<{ action: 'resume' | 'start-over' | 'error'; messages?: string[] }> {
    const session = await this.plugin.sessionService.load(filePath);

    if (session === null) {
      // No persisted session — normal fresh start.
      return { action: 'start-over' };
    }

    // SESSION-03: validate that all saved node IDs still exist in the current graph
    const missingIds = validateSessionNodeIds(session, graph);
    if (missingIds.length > 0) {
      await this.plugin.sessionService.clear(filePath);
      return {
        action: 'error',
        messages: [
          `Cannot resume session: ${missingIds.length} node(s) referenced in the saved session no longer exist in the canvas.`,
          'The canvas may have been edited since the session was saved.',
          'Starting over. Run the protocol again to begin a fresh session.',
        ],
      };
    }

    // SESSION-04: check canvas mtime against the saved timestamp
    const warnings: string[] = [];
    if (file.stat.mtime > session.canvasMtimeAtSave) {
      warnings.push('The canvas file has been modified since this session was saved.');
      warnings.push('Resuming may produce unexpected results if nodes or their content changed.');
    }

    // SESSION-06: present resume/start-over choice to the user
    const modal = new ResumeSessionModal(this.plugin.app, warnings);
    modal.open();
    const choice = await modal.result;

    if (choice === 'resume') {
      // Restore the runner from the saved session snapshot.
      // Order is critical: setGraph first, then restoreFrom (Pitfall 2).
      runner.setGraph(graph);
      runner.restoreFrom(session);
      return { action: 'resume' };
    }

    // 'start-over' — clear the stale session and signal fresh start.
    await this.plugin.sessionService.clear(filePath);
    return { action: 'start-over' };
  }

  /**
   * SESSION-01: fire-and-forget session auto-save.
   * Called after every user action that mutates runner state.
   *
   * IMPORTANT: Call as `void coordinator.autoSave(...)` — never await in event
   * handlers (NFR-09: floating promises must be void-marked).
   */
  async autoSave(
    canvasFilePath: string | null,
    runner: ProtocolRunner,
  ): Promise<void> {
    if (canvasFilePath === null) return;
    const state = runner.getSerializableState();
    if (state === null) return; // idle, complete, or error — not a valid save point

    // Read canvas mtime for SESSION-04 change detection on resume
    const file = this.plugin.app.vault.getAbstractFileByPath(canvasFilePath);
    const mtime = file instanceof TFile ? file.stat.mtime : 0;

    const session: PersistedSession = {
      version: 1 as const,
      canvasFilePath,
      canvasMtimeAtSave: mtime,
      savedAt: Date.now(),
      ...state,
    };

    try {
      await this.plugin.sessionService.save(session);
    } catch (err) {
      console.error('[RadiProtocol] autoSaveSession failed:', err);
    }
  }
}
