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

// Phase 50 D-15: typed edge data (was unknown[]). Field names mirror the raw
// canvas JSON edge shape parsed by CanvasParser (src/graph/canvas-parser.ts:36-41)
// and Obsidian's internal canvas model. Index signature keeps the interface
// forward-compat with fromSide / toSide / color / etc. — same escape hatch
// CanvasNodeData uses above. Design source: docs/ARCHITECTURE-NOTES.md#answer-label-and-edge-sync
export interface CanvasEdgeData {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
  [key: string]: unknown; // forward-compat: fromSide, toSide, color, etc.
}

export interface CanvasData {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];   // ← Phase 50 D-15 (was unknown[])
}

/** A live canvas node instance (returned by createTextNode). */
export interface CanvasNodeInternal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  getData(): Record<string, unknown>;
  setData(data: Record<string, unknown>, addHistory?: boolean): void;
  setColor(color: string): void;
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
  /**
   * Currently selected canvas nodes.
   * Access via Array.from(canvas.selection) — Set does not support index access.
   * Read only AFTER a setTimeout(0) deferral inside a pointerdown handler;
   * Obsidian updates this Set after the pointer event, not synchronously.
   */
  selection?: Set<{ id: string; [key: string]: unknown }>;
  /** Map of all canvas node IDs to their live node objects. */
  nodes: Map<string, CanvasNodeInternal>;
  /**
   * Creates a text node on the canvas, adds it to the DOM and the nodes Map.
   * Uses object-form signature (post Obsidian 1.1.10).
   */
  createTextNode(options: {
    pos: { x: number; y: number };
    text: string;
    size: { width: number; height: number };
    save?: boolean;
    focus?: boolean;
  }): CanvasNodeInternal;
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
