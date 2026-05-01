// Phase 76 Plan 76-05 (SPLIT-01 G1) — extracted saveNodeEdits implementation.
// EditorPanelView.saveNodeEdits delegates here so the dispatcher loses ~165 LOC
// while the test surface (`view.saveNodeEdits(...)` and `vi.spyOn(view,
// 'saveNodeEdits')`) keeps working through the thin class wrapper.
import { Notice, TFile } from 'obsidian';
import type RadiProtocolPlugin from '../../main';
import { NODE_COLOR_MAP } from '../../canvas/node-color-map';
// Phase 50 D-14: enumerates incoming Question→Answer edges for atomic Node Editor write
import { collectIncomingEdgeEdits, collectIncomingSnippetEdgeEdits } from '../../canvas/edge-label-sync-service';
import { CanvasParser } from '../../graph/canvas-parser';

export async function saveNodeEditsImpl(
  plugin: RadiProtocolPlugin,
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<void> {
  // Phase 28: D-01, D-02 — inject color before forking into Pattern B / Strategy A
  const enrichedEdits = { ...edits };
  const editedType = enrichedEdits['radiprotocol_nodeType'] as string | undefined;
  // D-06: unmark path — type is '' or key present with undefined/empty value
  const isTypeChange = 'radiprotocol_nodeType' in enrichedEdits;
  const isUnmarkingType = isTypeChange && (editedType === '' || editedType === undefined);

  if (!isUnmarkingType && editedType) {
    // D-04 priority 1: type explicitly changed — inject color immediately
    const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[editedType];
    if (mapped !== undefined) {
      enrichedEdits['color'] = mapped; // D-02: overwrite regardless of prior color
    }
  }

  // LIVE-03: Attempt live save via internal Canvas API first (Pattern B).
  // If saveLive() returns true, the canvas view owns the write — do not call vault.modify().
  try {
    // Phase 50 D-14: when displayLabel is in edits, read live-or-disk canvas JSON
    // to enumerate incoming Question→Answer edges, then commit node + edges in
    // ONE saveLiveBatch call. Otherwise fall back to the Phase 28 saveLive path.
    // Phase 63 Gap 1 (EDITOR-03): extended symmetrically for snippetLabel.
    const isDisplayLabelEdit = 'radiprotocol_displayLabel' in enrichedEdits;
    const isSnippetLabelEdit = 'radiprotocol_snippetLabel' in enrichedEdits;
    let savedLive: boolean;
    if (isDisplayLabelEdit || isSnippetLabelEdit) {
      const newLabel = isDisplayLabelEdit
        ? enrichedEdits['radiprotocol_displayLabel'] as string | undefined
        : enrichedEdits['radiprotocol_snippetLabel'] as string | undefined;
      const liveJson = plugin.canvasLiveEditor.getCanvasJSON(filePath);
      const canvasContent = liveJson ?? await (async () => {
        const f = plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(f instanceof TFile)) return '';
        try { return await plugin.app.vault.read(f); } catch { return ''; }
      })();
      const parser = new CanvasParser();
      const edgeEdits = isDisplayLabelEdit
        ? collectIncomingEdgeEdits(parser, canvasContent, filePath, nodeId, newLabel)
        : collectIncomingSnippetEdgeEdits(parser, canvasContent, filePath, nodeId, newLabel);
      savedLive = await plugin.canvasLiveEditor.saveLiveBatch(
        filePath,
        [{ nodeId, edits: enrichedEdits }],
        edgeEdits,
      );
    } else {
      savedLive = await plugin.canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits);
    }
    if (savedLive) {
      return;
    }
  } catch (err) {
    // D-03: requestSave() threw — canvas state has been rolled back by CanvasLiveEditor.
    console.error('[RadiProtocol] saveLive threw — canvas state rolled back:', err);
    new Notice('Save failed — close the canvas and try again.');
    return;
  }
  // saveLive() returned false: canvas is closed or Pattern B API unavailable.
  // Fall through to Strategy A (vault.modify() with canvas closed requirement).

  const file = plugin.app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    new Notice('Canvas file not found in vault.');
    return;
  }
  if (!(file instanceof TFile)) {
    new Notice('Could not read canvas file (not a file).');
    return;
  }

  let raw: string;
  try {
    raw = await plugin.app.vault.read(file);
  } catch {
    new Notice('Could not read canvas file.');
    return;
  }

  let canvasData: { nodes: Array<Record<string, unknown>>; edges: unknown[] };
  try {
    canvasData = JSON.parse(raw) as typeof canvasData;
  } catch {
    new Notice('Canvas file contains invalid JSON — cannot save.');
    return;
  }

  const nodeIndex = canvasData.nodes.findIndex(n => n['id'] === nodeId);
  if (nodeIndex === -1) {
    new Notice('Node not found in canvas — it may have been deleted.');
    return;
  }

  // Phase 28: D-04 — fallback type resolution for field-only saves (type not in edits)
  // Note: isUnmarkingType implies isTypeChange, so !isTypeChange already covers !isUnmarkingType
  if (!isTypeChange) {
    const existingNode = canvasData.nodes[nodeIndex] as Record<string, unknown> | undefined;
    const existingType = existingNode?.['radiprotocol_nodeType'] as string | undefined;
    if (existingType) {
      const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[existingType];
      if (mapped !== undefined) {
        enrichedEdits['color'] = mapped; // D-02: always overwrite
      }
    }
  }

  const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type']);

  const nodeTypeEdit = enrichedEdits['radiprotocol_nodeType'];
  const isUnmarking = nodeTypeEdit === '' || nodeTypeEdit === undefined;

  const node = canvasData.nodes[nodeIndex];
  if (node !== undefined) {
    if (isUnmarking && 'radiprotocol_nodeType' in enrichedEdits) {
      for (const key of Object.keys(node)) {
        if (key.startsWith('radiprotocol_')) {
          delete node[key];
        }
      }
      // COLOR-02, D-06: also clear the canvas node's colour on unmark (Strategy A path)
      delete node['color'];
    } else {
      for (const [key, value] of Object.entries(enrichedEdits)) {
        if (PROTECTED_FIELDS.has(key)) continue;
        if (value === undefined) {
          delete node[key];
        } else {
          node[key] = value;
        }
      }
    }
  }

  // Phase 50 D-13/D-14: when displayLabel is in edits, mutate every incoming
  // Question→Answer edge label in the SAME canvasData payload — one vault.modify
  // writes node + edges atomically (avoids WR-01 race). Symmetric to the node
  // mutation above: undefined ≡ delete 'label' key (D-08, canvas-parser.ts:207-209).
  // Phase 63 Gap 1 (EDITOR-03): extended symmetrically for snippetLabel.
  if ('radiprotocol_displayLabel' in enrichedEdits) {
    const newLabel = enrichedEdits['radiprotocol_displayLabel'] as string | undefined;
    const parser = new CanvasParser();
    const edgeEdits = collectIncomingEdgeEdits(parser, raw, filePath, nodeId, newLabel);
    const incomingIds = new Set(edgeEdits.map(e => e.edgeId));
    for (const edge of canvasData.edges) {
      const edgeObj = edge as Record<string, unknown>;
      if (!incomingIds.has(edgeObj['id'] as string)) continue;
      if (newLabel === undefined) {
        delete edgeObj['label']; // D-08 strip-key
      } else {
        edgeObj['label'] = newLabel;
      }
    }
  }
  if ('radiprotocol_snippetLabel' in enrichedEdits) {
    const newLabel = enrichedEdits['radiprotocol_snippetLabel'] as string | undefined;
    const parser = new CanvasParser();
    const edgeEdits = collectIncomingSnippetEdgeEdits(parser, raw, filePath, nodeId, newLabel);
    const incomingIds = new Set(edgeEdits.map(e => e.edgeId));
    for (const edge of canvasData.edges) {
      const edgeObj = edge as Record<string, unknown>;
      if (!incomingIds.has(edgeObj['id'] as string)) continue;
      if (newLabel === undefined) {
        delete edgeObj['label']; // D-08 strip-key
      } else {
        edgeObj['label'] = newLabel;
      }
    }
  }

  try {
    await plugin.app.vault.modify(file, JSON.stringify(canvasData, null, 2));
  } catch {
    new Notice('Could not save — write failed. Check file permissions.');
  }
}
