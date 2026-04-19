// src/canvas/canvas-node-factory.ts
// CanvasNodeFactory: programmatically creates typed RadiProtocol nodes on an open canvas
// using Obsidian's internal createTextNode() API with runtime probing.
//
// Phase 38, Plan 01 — infrastructure service consumed by Phase 39 (Quick-Create UI)
// and Phase 40 (Node Duplication). No UI in this module.

import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type { CanvasNodeInternal, CanvasInternal } from '../types/canvas-internal';
import { NODE_COLOR_MAP } from './node-color-map';

const DEFAULT_NODE_WIDTH = 250;
const DEFAULT_NODE_HEIGHT = 60;
const NODE_GAP = 40;

export interface CreateNodeResult {
  nodeId: string;
  canvasNode: CanvasNodeInternal;
}

export class CanvasNodeFactory {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Creates a new RadiProtocol node on the canvas at canvasPath.
   * Returns { nodeId, canvasNode } on success, null on failure (with Notice shown).
   *
   * @param canvasPath - vault path of the .canvas file (must be open)
   * @param nodeKind - RPNodeKind for the new node
   * @param anchorNodeId - optional ID of an existing node to position next to
   */
  createNode(
    canvasPath: string,
    nodeKind: RPNodeKind,
    anchorNodeId?: string
  ): CreateNodeResult | null {
    // 1. Probe for canvas view with createTextNode API
    const canvas = this.getCanvasWithCreateAPI(canvasPath);
    if (!canvas) return null;

    // 2. Calculate position — offset from anchor or default to origin
    let pos = { x: 0, y: 0 };
    if (anchorNodeId) {
      const anchor = canvas.nodes.get(anchorNodeId);
      if (anchor) {
        // Phase 48 NODEUI-02: vertical offset — place new node BELOW anchor (was rightward).
        pos = { x: anchor.x, y: anchor.y + anchor.height + NODE_GAP };
      } else {
        console.warn(`[RadiProtocol] Anchor node '${anchorNodeId}' not found — using default position.`);
      }
    }

    // 3. Create text node via internal API
    const canvasNode = canvas.createTextNode({
      pos,
      text: '',
      size: { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT },
    });

    // 4. Apply RadiProtocol properties — include color in setData per Research Pitfall 4
    const nodeData = canvasNode.getData();
    canvasNode.setData({
      ...nodeData,
      radiprotocol_nodeType: nodeKind,
      color: NODE_COLOR_MAP[nodeKind],
    });

    // 5. Persist to disk
    canvas.requestSave();

    return { nodeId: canvasNode.id, canvasNode };
  }

  /**
   * Probes for a canvas leaf matching filePath that exposes createTextNode().
   * Returns the CanvasInternal object if available, undefined otherwise (with Notice).
   */
  private getCanvasWithCreateAPI(filePath: string): CanvasInternal | undefined {
    const leaf = this.app.workspace
      .getLeavesOfType('canvas')
      .find((l) => {
        const v = l.view as { file?: { path: string } };
        return v.file?.path === filePath;
      });

    if (!leaf) {
      new Notice('Open a canvas first to create nodes.');
      return undefined;
    }

    const view = leaf.view as unknown as { canvas?: CanvasInternal };
    const canvas = view?.canvas;

    if (!canvas || typeof canvas.createTextNode !== 'function') {
      new Notice('Canvas API unavailable — update Obsidian to use node creation.');
      return undefined;
    }

    return canvas;
  }

  /**
   * Clears resources. Reserved for future cleanup (timer cancellation, etc.).
   * Must be called from RadiProtocolPlugin.onunload() to prevent leaks.
   */
  destroy(): void {
    // No resources to clean up in current implementation
  }
}
