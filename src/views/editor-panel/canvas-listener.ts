// Phase 76 (SPLIT-01 G2) — extracted attachCanvasListener body. The dispatcher
// (EditorPanelView) keeps a thin private wrapper that delegates here; the two
// bookkeeping fields (watchedCanvasContainer, canvasPointerdownHandler) remain
// on the class instance so re-attach idempotency persists across event-driven
// re-entry. The helper mutates them through the `state` slice passed in.
import type { ItemView } from 'obsidian';
import type RadiProtocolPlugin from '../../main';

export interface CanvasListenerState {
  canvasPointerdownHandler: (() => void) | null;
  watchedCanvasContainer: HTMLElement | null;
}

export function attachCanvasListener(args: {
  plugin: RadiProtocolPlugin;
  state: CanvasListenerState;
  registerDomEvent: ItemView['registerDomEvent'];
  handleNodeClick: (filePath: string, nodeId: string) => Promise<void>;
}): void {
  const { plugin, state, registerDomEvent, handleNodeClick } = args;

  const canvasLeaves = plugin.app.workspace.getLeavesOfType('canvas');
  const activeLeaf = plugin.app.workspace.getMostRecentLeaf();
  const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
  if (!canvasLeaf) return;

  // containerEl is an undocumented but stable property on WorkspaceLeaf (EDITOR-01).
  const canvasLeafInternal = canvasLeaf as unknown as {
    containerEl: HTMLElement;
    view: unknown;
  };

  // Early-return: already watching this exact container — do not re-register.
  // Prevents listener accumulation when active-leaf-change fires on modal open/close.
  if (state.watchedCanvasContainer === canvasLeafInternal.containerEl) return;

  // Genuine switch to a different canvas leaf — reset bookkeeping.
  state.canvasPointerdownHandler = null;
  state.watchedCanvasContainer = null;

  const canvasView = canvasLeaf.view as unknown as {
    file?: { path: string };
    canvas?: { selection?: Set<{ id: string; [key: string]: unknown }> };
  };

  state.watchedCanvasContainer = canvasLeafInternal.containerEl;

  state.canvasPointerdownHandler = () => {
    // Phase 42 Plan 03: defer the selection read via setTimeout(0) per
    // canvas-internal.d.ts — Obsidian updates canvas.selection AFTER the
    // pointer event, not synchronously.
    setTimeout(() => {
      const selection = canvasView.canvas?.selection;
      if (!selection || selection.size !== 1) return; // ignore multi-select

      const node = Array.from(selection)[0];
      if (!node?.id) return;

      const filePath = canvasView.file?.path;
      if (!filePath) return;

      void handleNodeClick(filePath, node.id);
    }, 0);
  };

  if (state.watchedCanvasContainer !== null) {
    registerDomEvent(
      state.watchedCanvasContainer,
      'click',
      state.canvasPointerdownHandler
    );
    // Phase 42 Plan 03: also wire 'dblclick' so double-click-creates-node is
    // handled even if Obsidian swallows the intermediate click events during
    // the native text-node creation gesture.
    registerDomEvent(
      state.watchedCanvasContainer,
      'dblclick',
      state.canvasPointerdownHandler
    );
  }
}
