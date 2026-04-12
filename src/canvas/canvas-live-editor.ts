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
   * Used by RunnerView.openCanvas() to read live in-memory state instead of
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
