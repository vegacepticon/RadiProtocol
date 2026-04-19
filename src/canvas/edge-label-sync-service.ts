// src/canvas/edge-label-sync-service.ts
// Phase 50 D-01: owns the vault.on('modify') subscription + debounced reconcile pass
// for bi-directional Answer.displayLabel ↔ incoming Question→Answer edge label sync.
//
// Lifecycle mirrors CanvasLiveEditor (main.ts:23, :41, :135): instantiated in onload,
// destroy() called in onunload. Subscription attached via this.plugin.registerEvent(...)
// so Obsidian auto-detaches on plugin unload (snippet-manager-view.ts:135 /
// runner-view.ts:200 canonical pattern).
//
// Debounce per filePath: 250ms — below Obsidian's own 500ms canvas requestSave cap
// (canvas-live-editor.ts:298-306) so keystrokes feel responsive. (Claude's Discretion
// per 50-CONTEXT.md; documented constant below.)
//
// D-07 loop guard: reconcileEdgeLabels returns empty result when nothing diverges;
// we short-circuit before any write so the plugin's own write (which triggers a
// follow-up modify event) self-terminates after one reentrant pass. No mutable
// suppress flags or in-flight counters.
//
// Design source: .planning/notes/answer-label-edge-sync.md (Phase 50 D-10 + D-16)

import { TFile } from 'obsidian';
import type { App } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { CanvasParser } from '../graph/canvas-parser';
import { reconcileEdgeLabels } from '../graph/edge-label-reconciler';
import type { EdgeLabelDiff } from '../graph/edge-label-reconciler';
import type { ProtocolGraph } from '../graph/graph-model';

/** D-Claude: 250ms debounce < Obsidian's 500ms canvas requestSave (canvas-live-editor.ts:298-306). */
const RECONCILE_DEBOUNCE_MS = 250;

export class EdgeLabelSyncService {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly parser: CanvasParser;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(app: App, plugin: RadiProtocolPlugin) {
    this.app = app;
    this.plugin = plugin;
    this.parser = new CanvasParser();
  }

  /**
   * D-01: subscribe to vault 'modify' events for .canvas files. The ref is owned by
   * Obsidian's Plugin lifecycle (registerEvent contract) — auto-detached on unload.
   */
  register(): void {
    this.plugin.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'canvas') return;
        this.scheduleReconcile(file.path);
      })
    );
  }

  private scheduleReconcile(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      void this.reconcile(filePath).catch((err) => {
        // Debug-only telemetry (CONTEXT.md Claude's Discretion — no user-facing Notice).
        console.warn('[RadiProtocol] edge-label reconcile failed:', err);
      });
    }, RECONCILE_DEBOUNCE_MS);
    this.debounceTimers.set(filePath, timer);
  }

  /**
   * D-02: read live JSON (BUG-02/03 avoidance) or disk; parse; reconcile; dispatch write.
   * D-07: empty diffs + empty map → no write (self-terminates the modify-event loop).
   */
  private async reconcile(filePath: string): Promise<void> {
    // Shared Pattern C — live-JSON-or-disk read for background work.
    let content: string;
    const liveJson = this.plugin.canvasLiveEditor.getCanvasJSON(filePath);
    if (liveJson !== null) {
      content = liveJson;
    } else {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;
      try {
        content = await this.app.vault.read(file);
      } catch {
        return; // silent — reconciler is background
      }
    }

    // Parse (pure)
    const parsed = this.parser.parse(content, filePath);
    if (!parsed.success) return; // broken canvas — nothing sensible to reconcile
    const graph: ProtocolGraph = parsed.graph;

    // Reconcile (pure)
    const { diffs, newDisplayLabelByAnswerId } = reconcileEdgeLabels(graph);

    // D-07 loop guard: nothing diverges → no write.
    if (diffs.length === 0 && newDisplayLabelByAnswerId.size === 0) return;

    // Dispatch write: Pattern B first (saveLiveBatch with node+edge atomicity), Strategy A fallback.
    const nodeEdits: Array<{ nodeId: string; edits: Record<string, unknown> }> = [];
    for (const [answerId, newLabel] of newDisplayLabelByAnswerId) {
      nodeEdits.push({
        nodeId: answerId,
        edits: { radiprotocol_displayLabel: newLabel }, // undefined → D-08 strip-key symmetry
      });
    }
    const edgeEdits = diffs.map((d: EdgeLabelDiff) => ({
      edgeId: d.edgeId,
      label: d.targetLabel, // undefined → strip-key
    }));

    // Shared Pattern D — Pattern B / Strategy A fork. D-14 atomicity: one setData.
    try {
      const savedLive = await this.plugin.canvasLiveEditor.saveLiveBatch(
        filePath,
        nodeEdits,
        edgeEdits,
      );
      if (savedLive) return;
    } catch (err) {
      console.warn('[RadiProtocol] edge-label saveLiveBatch threw — canvas rolled back:', err);
      return;
    }

    // Strategy A: canvas closed or Pattern B returned false.
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;
    let raw: string;
    try {
      raw = await this.app.vault.read(file);
    } catch {
      return;
    }
    let canvasData: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
    try {
      canvasData = JSON.parse(raw) as typeof canvasData;
    } catch {
      return;
    }

    // D-14: single vault.modify mutates both nodes AND edges before the one write.
    for (const { nodeId, edits } of nodeEdits) {
      const node = canvasData.nodes.find(n => n['id'] === nodeId);
      if (!node) continue;
      for (const [k, v] of Object.entries(edits)) {
        if (v === undefined) delete node[k]; // D-08 strip-key
        else node[k] = v;
      }
    }
    for (const { edgeId, label } of edgeEdits) {
      const edge = canvasData.edges.find(e => e['id'] === edgeId);
      if (!edge) continue;
      if (label === undefined) delete edge['label']; // D-08 strip-key
      else edge['label'] = label;
    }
    try {
      await this.app.vault.modify(file, JSON.stringify(canvasData, null, 2));
    } catch {
      // silent — reconciler background; user sees no Notice
    }
  }

  /** T-11-04 timer leak prevention — called from RadiProtocolPlugin.onunload(). */
  destroy(): void {
    for (const [, timer] of this.debounceTimers.entries()) clearTimeout(timer);
    this.debounceTimers.clear();
    // vault.on('modify') subscription auto-detached by Plugin lifecycle (registerEvent contract)
  }
}

// Shared helper exposed for Node Editor Display-label outbound sync (D-06 / D-14).
// Given a live or on-disk canvas JSON + the edited Answer node id + the new label,
// enumerate every incoming Question→Answer edgeId and produce edgeEdits for
// saveLiveBatch. Parses with CanvasParser so reverseAdjacency is available.
export function collectIncomingEdgeEdits(
  parser: CanvasParser,
  canvasContent: string,
  canvasFilePath: string,
  answerId: string,
  newLabel: string | undefined,
): Array<{ edgeId: string; label: string | undefined }> {
  const parsed = parser.parse(canvasContent, canvasFilePath);
  if (!parsed.success) return [];
  const { graph } = parsed;
  const answerNode = graph.nodes.get(answerId);
  if (!answerNode || answerNode.kind !== 'answer') return [];
  const incoming = graph.edges.filter(e => e.toNodeId === answerId);
  return incoming.map(e => ({ edgeId: e.id, label: newLabel }));
}
