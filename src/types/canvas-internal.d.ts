// src/types/canvas-internal.d.ts
// Ambient declarations for Obsidian's undocumented internal Canvas View API.
// Shape verified via community plugin research (obsidian-advanced-canvas Canvas.d.ts).
// WARNING: These are internal APIs subject to change. CanvasLiveEditor probes for
// existence at runtime before use — if absent, the live path silently falls back to Strategy A.

export interface CanvasNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  color?: string;
  [key: string]: unknown; // radiprotocol_* fields and any other custom properties
}

export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: unknown[];
}

/** The Canvas sub-object exposed on CanvasViewInternal as `view.canvas`. */
export interface CanvasInternal {
  /**
   * Returns a deep copy of the current canvas data (nodes + edges).
   * Edits must be applied to the returned copy and committed back via setData().
   */
  getData(): CanvasData;
  /**
   * Writes the supplied data back to the canvas in-memory state.
   * Must be followed by requestSave() to persist to disk.
   */
  setData(data: CanvasData): void;
  /**
   * Triggers a debounced file write of the canvas state.
   * Fire-and-forget — does not return a Promise.
   */
  requestSave(): void;
}

export interface CanvasViewInternal {
  /** Path of the canvas file currently displayed by this view. */
  file?: { path: string };
  /**
   * The Canvas sub-object. Probe for existence via:
   *   typeof leaf.view.canvas?.getData === 'function'
   * This is the stable Pattern B API used by obsidian-advanced-canvas,
   * Obsidian-Link-Nodes-In-Canvas, and enchanted-canvas.
   */
  canvas: CanvasInternal;
}
