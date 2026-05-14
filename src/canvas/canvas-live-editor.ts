// src/canvas/canvas-live-editor.ts
// CanvasLiveEditor: probes for the internal Obsidian Canvas View API (Pattern B)
// and performs live node mutations without vault.modify().
//
// Pattern B: view.canvas.getData() returns a deep copy; edits are applied to the copy
// and written back via view.canvas.setData(). Debounced view.canvas.requestSave() persists to disk.
//
// If the internal API is absent (view.canvas?.getData is not a function), saveLive() returns false
// and callers fall back to Strategy A (vault.modify() with canvas closed).

import type { App } from 'obsidian';
import type { CanvasViewInternal, CanvasNodeData, CanvasData } from '../types/canvas-internal';

const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type']);

export class CanvasLiveEditor {
  private readonly app: App;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Returns the live CanvasViewInternal if a canvas leaf for filePath is open
   * AND exposes the internal Pattern B API (canvas.getData is a function).
   * Returns undefined if canvas is closed or the internal API is unavailable.
   */
  private getCanvasView(filePath: string): CanvasViewInternal | undefined {
    const leaf = this.app.workspace
      .getLeavesOfType('canvas')
      .find((l) => {
        const v = l.view as { file?: { path: string } };
        return v.file?.path === filePath;
      });

    if (!leaf) return undefined;

    const view = leaf.view as unknown as CanvasViewInternal | undefined;

    // D-01: probe for Pattern B API presence on the canvas sub-object
    if (!view || typeof view.canvas?.getData !== 'function') {
      return undefined;
    }

    return view;
  }

  /**
   * Returns true if a live canvas view is available for filePath with the internal API.
   */
  isLiveAvailable(filePath: string): boolean {
    return this.getCanvasView(filePath) !== undefined;
  }

  /**
   * Returns JSON.stringify(canvas.getData()) when the canvas view for filePath
   * is open and exposes the internal Pattern B API. Returns null when the canvas
   * is closed or the API is unavailable.
   *
   * Used by canvas-backed commands to read live in-memory state instead of
   * potentially stale vault.read() data (BUG-02, BUG-03).
   */
  getCanvasJSON(filePath: string): string | null {
    const view = this.getCanvasView(filePath);
    if (!view) return null;
    return JSON.stringify(view.canvas.getData());
  }

  /**
   * Saves edits into the live canvas using Pattern B (getData/setData/requestSave).
   * Returns true if live save succeeded, false if caller should use Strategy A.
   * Throws if setData() or requestSave() throws — callers handle with Notice per D-03.
   */
  async saveLive(
    filePath: string,
    nodeId: string,
    edits: Record<string, unknown>
  ): Promise<boolean> {
    const view = this.getCanvasView(filePath);
    if (!view) return false;

    // Get pristine snapshot for rollback (D-03)
    const originalData: CanvasData = view.canvas.getData();
    // Get a second copy to mutate and commit
    const updatedData: CanvasData = view.canvas.getData();

    const node: CanvasNodeData | undefined = updatedData.nodes.find(
      (n: CanvasNodeData) => n.id === nodeId
    );
    if (!node) return false;

    // Check for un-mark path (D-02 + Pitfall 4):
    // When radiprotocol_nodeType is set to '' or undefined, remove ALL radiprotocol_* keys.
    const isUnmarking =
      'radiprotocol_nodeType' in edits &&
      (edits['radiprotocol_nodeType'] === '' || edits['radiprotocol_nodeType'] === undefined);

    if (isUnmarking) {
      // Remove all radiprotocol_* fields from the node copy
      for (const key of Object.keys(node)) {
        if (key.startsWith('radiprotocol_')) {
          delete node[key as keyof CanvasNodeData];
        }
      }
      // Also clear the canvas colour on unmark (mirrors Strategy A path)
      delete node['color' as keyof CanvasNodeData];
    } else {
      // Apply edits to the copy, skipping PROTECTED_FIELDS
      for (const [key, value] of Object.entries(edits)) {
        if (PROTECTED_FIELDS.has(key)) continue;
        if (value === undefined) {
          delete node[key as keyof CanvasNodeData];
        } else {
          (node as Record<string, unknown>)[key] = value;
        }
      }
    }

    try {
      view.canvas.setData(updatedData);
      this.debouncedRequestSave(filePath, view);
      return true;
    } catch (err) {
      // Rollback: restore canvas to pre-edit state (D-03)
      try {
        view.canvas.setData(originalData);
      } catch (rollbackErr) {
        console.error('[RadiProtocol] Canvas rollback failed — canvas may be in inconsistent state:', rollbackErr);
      }
      throw err;
    }
  }

  /**
   * Phase 41 WR-01: Batched live save — applies all edits in a single
   * `getData → mutate all → setData → requestSave` cycle so callers observe
   * atomic all-or-nothing semantics from the live view's perspective.
   *
   * Returns true if all edits applied successfully; returns false without
   * touching the view if:
   *   - The canvas view is not available (closed, or Pattern B API missing)
   *   - Any target nodeId is not present in the current canvas data
   *
   * This avoids the write-order race where per-node `saveLive` mutates the
   * live view partially and then falls through to `vault.modify`, leaving a
   * pending debounced `requestSave` to overwrite the disk write (WR-01).
   */
  async saveLiveBatch(
    filePath: string,
    nodeEdits: Array<{ nodeId: string; edits: Record<string, unknown> }>,
    // Phase 50 D-14: optional edge-label edits applied in the SAME Pattern B
    // write so node + incoming-edge updates land in one setData/requestSave
    // cycle. undefined label ≡ delete the 'label' key (D-08 symmetry with
    // canvas-parser.ts:207-209). Design source: docs/ARCHITECTURE-NOTES.md#answer-label-and-edge-sync
    edgeEdits?: Array<{ edgeId: string; label: string | undefined }>
  ): Promise<boolean> {
    const view = this.getCanvasView(filePath);
    if (!view) return false;
    if (nodeEdits.length === 0 && (!edgeEdits || edgeEdits.length === 0)) return true;

    const originalData: CanvasData = view.canvas.getData();
    const updatedData: CanvasData = view.canvas.getData();

    // First pass: locate every target node; bail without mutating if any missing
    const targets: Array<{ node: CanvasNodeData; edits: Record<string, unknown> }> = [];
    for (const { nodeId, edits } of nodeEdits) {
      const node = updatedData.nodes.find((n: CanvasNodeData) => n.id === nodeId);
      if (!node) return false;
      targets.push({ node, edits });
    }

    // Phase 50 D-14: first-pass validate edge targets — bail without mutating
    // if any edgeId is missing (mirrors node-target validation above).
    if (edgeEdits) {
      for (const { edgeId } of edgeEdits) {
        const edge = updatedData.edges.find((e) => e.id === edgeId);
        if (!edge) return false;
      }
    }

    // Second pass: apply edits to each target's copy
    for (const { node, edits } of targets) {
      const isUnmarking =
        'radiprotocol_nodeType' in edits &&
        (edits['radiprotocol_nodeType'] === '' || edits['radiprotocol_nodeType'] === undefined);

      if (isUnmarking) {
        for (const key of Object.keys(node)) {
          if (key.startsWith('radiprotocol_')) {
            delete node[key as keyof CanvasNodeData];
          }
        }
        delete node['color' as keyof CanvasNodeData];
      } else {
        for (const [key, value] of Object.entries(edits)) {
          if (PROTECTED_FIELDS.has(key)) continue;
          if (value === undefined) {
            delete node[key as keyof CanvasNodeData];
          } else {
            (node as Record<string, unknown>)[key] = value;
          }
        }
      }
    }

    // Phase 50 D-14: apply edge mutations to updatedData. Same setData call
    // below commits node + edge changes atomically — NEVER split into two
    // setData/requestSave cycles (WR-01 doc-comment lines 138-148).
    if (edgeEdits) {
      for (const { edgeId, label } of edgeEdits) {
        const edge = updatedData.edges.find((e) => e.id === edgeId);
        if (!edge) continue; // first-pass already rejected; defensive
        if (label === undefined) {
          delete (edge as Record<string, unknown>)['label']; // D-08 strip-key
        } else {
          (edge as Record<string, unknown>)['label'] = label;
        }
      }
    }

    try {
      view.canvas.setData(updatedData);
      this.debouncedRequestSave(filePath, view);
      return true;
    } catch (err) {
      try {
        view.canvas.setData(originalData);
      } catch (rollbackErr) {
        console.error('[RadiProtocol] Canvas rollback failed — canvas may be in inconsistent state:', rollbackErr);
      }
      throw err;
    }
  }

  /**
   * Phase 50 D-12: Pattern B write for edge-label-only changes.
   *
   * Same getData → mutate → setData → debouncedRequestSave pattern as saveLive
   * (lines 75-133) and saveLiveBatch (lines 149-205). Used by the modify-event
   * reconciler (EdgeLabelSyncService) when a canvas-side edge edit has to be
   * re-synced onto OTHER incoming edges of the same Answer, without touching
   * any Answer node's radiprotocol_* fields.
   *
   * When an Answer's radiprotocol_displayLabel also needs updating, callers
   * MUST use saveLiveBatch with edgeEdits instead — D-14 atomicity.
   *
   * undefined label ≡ delete 'label' key (D-08 symmetry with
   * canvas-parser.ts:207-209).
   *
   * Design source: docs/ARCHITECTURE-NOTES.md#answer-label-and-edge-sync
   */
  async saveLiveEdges(
    filePath: string,
    edgeEdits: Array<{ edgeId: string; label: string | undefined }>
  ): Promise<boolean> {
    const view = this.getCanvasView(filePath);
    if (!view) return false;
    if (edgeEdits.length === 0) return true;

    const originalData: CanvasData = view.canvas.getData();
    const updatedData: CanvasData = view.canvas.getData();

    // First pass: locate every target edge; bail without mutating if any missing
    for (const { edgeId } of edgeEdits) {
      const edge = updatedData.edges.find((e) => e.id === edgeId);
      if (!edge) return false;
    }

    // Second pass: apply label edits
    for (const { edgeId, label } of edgeEdits) {
      const edge = updatedData.edges.find((e) => e.id === edgeId);
      if (!edge) continue; // defensive — first-pass already validated
      if (label === undefined) {
        delete (edge as Record<string, unknown>)['label']; // D-08 strip-key
      } else {
        (edge as Record<string, unknown>)['label'] = label;
      }
    }

    try {
      view.canvas.setData(updatedData);
      this.debouncedRequestSave(filePath, view);
      return true;
    } catch (err) {
      try {
        view.canvas.setData(originalData);
      } catch (rollbackErr) {
        console.error('[RadiProtocol] Canvas rollback failed — canvas may be in inconsistent state:', rollbackErr);
      }
      throw err;
    }
  }

  /**
   * Debounced requestSave — at most one requestSave() per 500ms per canvas file (D-06, T-11-03).
   */
  private debouncedRequestSave(filePath: string, view: CanvasViewInternal): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      view.canvas.requestSave();
      this.debounceTimers.delete(filePath);
    }, 500);
    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Clears all pending debounce timers (T-11-04).
   * Must be called from RadiProtocolPlugin.onunload() to prevent timer leaks.
   */
  destroy(): void {
    for (const [, timer] of this.debounceTimers.entries()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
