// Phase 76 (SPLIT-01 G4) — extracted quick-create / duplicate controller. The
// dispatcher (EditorPanelView) keeps thin private wrappers for `onQuickCreate`
// and `onDuplicate` because (a) the toolbar wrapper calls them via `this.*` and
// (b) tests access them through the private surface (`view.onQuickCreate(...)`,
// `vi.spyOn(view, 'onQuickCreate')`). `getActiveCanvasPath` and
// `getCanvasForPath` are pure lookups on the workspace; their sole remaining
// in-class caller (renderNodeForm → getCanvasForPath) imports the bare function.
//
// State mutation rules (R5 from the SPLIT-01 plan):
//   - The `state` slice IS the EditorPanelView instance, narrowed via cast.
//     Reassigning `state.pendingEdits = {}` therefore reassigns the class field
//     directly so subsequent class-side reads observe the same fresh object,
//     matching the original method bodies verbatim.
//   - `state._debounceTimer = null` flows back to the class field for the same
//     reason; without that the autosave wrapper (G8) would see a stale handle.
import { Notice } from 'obsidian';
import type { CanvasInternal } from '../../types/canvas-internal';
import type { RPNodeKind } from '../../graph/graph-model';
import type RadiProtocolPlugin from '../../main';

export type QuickCreateKind = 'question' | 'answer' | 'snippet' | 'loop' | 'text-block';

export interface QuickCreateState {
  currentFilePath: string | null;
  currentNodeId: string | null;
  pendingEdits: Record<string, unknown>;
  _debounceTimer: ReturnType<typeof setTimeout> | null;
}

export interface QuickCreateDeps {
  plugin: RadiProtocolPlugin;
  state: QuickCreateState;
  saveNodeEdits: (filePath: string, nodeId: string, edits: Record<string, unknown>) => Promise<void>;
  renderForm: (record: Record<string, unknown>, kind: RPNodeKind | null) => void;
}

export function getActiveCanvasPath(plugin: RadiProtocolPlugin): string | undefined {
  const canvasLeaves = plugin.app.workspace.getLeavesOfType('canvas');
  const activeLeaf = plugin.app.workspace.getMostRecentLeaf();
  const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
  if (!canvasLeaf) return undefined;
  return (canvasLeaf.view as { file?: { path: string } })?.file?.path;
}

export function getCanvasForPath(
  plugin: RadiProtocolPlugin,
  canvasPath: string,
): CanvasInternal | undefined {
  const leaf = plugin.app.workspace
    .getLeavesOfType('canvas')
    .find((l) => {
      const v = l.view as { file?: { path: string } };
      return v.file?.path === canvasPath;
    });
  if (!leaf) return undefined;
  return (leaf.view as unknown as { canvas?: CanvasInternal })?.canvas;
}

export async function onQuickCreate(
  kind: QuickCreateKind,
  deps: QuickCreateDeps,
): Promise<void> {
  const { plugin, state, saveNodeEdits, renderForm } = deps;
  const canvasPath = getActiveCanvasPath(plugin);
  if (!canvasPath) {
    new Notice('Open a canvas first to create nodes.');
    return;
  }

  // Flush pending auto-save before switching (Pitfall 3 from RESEARCH.md)
  if (state._debounceTimer !== null) {
    clearTimeout(state._debounceTimer);
    state._debounceTimer = null;
    if (state.currentFilePath && state.currentNodeId) {
      const editsSnapshot = { ...state.pendingEdits };
      try {
        await saveNodeEdits(state.currentFilePath, state.currentNodeId, editsSnapshot);
      } catch {
        // flush save failure does not block creation — silent
      }
    }
  }

  const result = plugin.canvasNodeFactory.createNode(
    canvasPath,
    kind,
    state.currentNodeId ?? undefined,
  );

  if (result) {
    // Bypass disk read: use in-memory node data directly from createNode().
    // renderNodeForm() reads canvas JSON from disk via vault.read(), but
    // canvas.requestSave() is async fire-and-forget — the file may not be
    // flushed yet. Instead, getData() returns the live node record.
    state.currentFilePath = canvasPath;
    state.currentNodeId = result.nodeId;
    state.pendingEdits = {};
    const nodeRecord = result.canvasNode.getData();
    const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
    renderForm(nodeRecord, currentKind);
  }
}

export async function onDuplicate(deps: QuickCreateDeps): Promise<void> {
  const { plugin, state, saveNodeEdits, renderForm } = deps;
  if (!state.currentNodeId || !state.currentFilePath) {
    return;
  }

  const canvasPath = getActiveCanvasPath(plugin);
  if (!canvasPath) {
    new Notice('Open a canvas first to create nodes.');
    return;
  }

  // Flush pending auto-save before switching (same pattern as onQuickCreate)
  if (state._debounceTimer !== null) {
    clearTimeout(state._debounceTimer);
    state._debounceTimer = null;
    if (state.currentFilePath && state.currentNodeId) {
      const editsSnapshot = { ...state.pendingEdits };
      try {
        await saveNodeEdits(state.currentFilePath, state.currentNodeId, editsSnapshot);
      } catch {
        // flush save failure does not block duplication — silent
      }
    }
  }

  // Read source node data from live canvas (NOT disk — avoids race condition)
  const canvas = getCanvasForPath(plugin, canvasPath);
  if (!canvas) return;
  const sourceNode = canvas.nodes.get(state.currentNodeId);
  if (!sourceNode) return;
  const sourceData = sourceNode.getData();

  const sourceKind = sourceData['radiprotocol_nodeType'] as RPNodeKind | undefined;
  if (!sourceKind) {
    new Notice('Select a protocol node to duplicate.');
    return;
  }

  // Create new node via factory (handles position offset, type, color, ID)
  const result = plugin.canvasNodeFactory.createNode(
    canvasPath, sourceKind, state.currentNodeId,
  );
  if (!result) return;

  // Copy radiprotocol_* properties + text from source to new node
  const rpProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceData)) {
    if (key.startsWith('radiprotocol_') || key === 'text') {
      rpProps[key] = value;
    }
  }
  const newData = result.canvasNode.getData();
  result.canvasNode.setData({ ...newData, ...rpProps });
  canvas.requestSave();

  // Load new node in editor (in-memory, no disk read)
  state.currentFilePath = canvasPath;
  state.currentNodeId = result.nodeId;
  state.pendingEdits = {};
  const finalData = result.canvasNode.getData();
  const finalKind = (finalData['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
  renderForm(finalData, finalKind);
}
