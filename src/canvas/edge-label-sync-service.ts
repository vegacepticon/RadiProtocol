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
import type { EdgeLabelDiff, NodeLabelChange } from '../graph/edge-label-reconciler'; // Phase 63: discriminated nodeChanges
import type { ProtocolGraph, RPNodeKind } from '../graph/graph-model'; // Phase 63: RPNodeKind for snapshot baseline

/** D-Claude: 250ms debounce < Obsidian's 500ms canvas requestSave (canvas-live-editor.ts:298-306). */
const RECONCILE_DEBOUNCE_MS = 250;

// Phase 63 EDITOR-05: per-node baseline of mutable text fields. The reconciler
// pass after every modify-event diffs the freshly-parsed graph against the
// previous snapshot for the same filePath. Field deltas → dispatch with
// changeKind: 'fields'. RPNodeKind delta → dispatch with changeKind: 'nodeType'.
// Missing nodeId in current pass → dispatch with changeKind: 'deleted'.
export interface NodeFieldsSnapshot {
  questionText?: string;
  answerText?: string;
  displayLabel?: string;
  content?: string;
  headerText?: string;
  snippetLabel?: string;
  text?: string;
  kind: RPNodeKind | null;
}

// Phase 63 D-12: payload broadcast on the canvas-changed-for-node EventTarget.
// Plan 03's EditorPanelView subscribes via service.subscribe(handler) and
// patches the open form's DOM in real time without giving the view its own
// vault.on(...) subscription (single owner, single debounce, single loop guard).
export interface CanvasChangedForNodeDetail {
  filePath: string;
  nodeId: string;
  changeKind: 'fields' | 'nodeType' | 'deleted';
  fieldUpdates?: Partial<Record<
    | 'radiprotocol_questionText'
    | 'radiprotocol_answerText'
    | 'radiprotocol_displayLabel'
    | 'radiprotocol_content'
    | 'radiprotocol_headerText'
    | 'radiprotocol_snippetLabel',
    string | undefined
  >>;
  newKind?: RPNodeKind | null;
}

export class EdgeLabelSyncService {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly parser: CanvasParser;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Phase 63 D-12 — broadcast bus for canvas-changed-for-node. Lightweight
  // EventTarget so multiple consumers (Plan 03 view + future others) can
  // subscribe without per-handler bookkeeping in the service.
  private readonly bus = new EventTarget();
  // Phase 63 EDITOR-05 — per-filePath baseline of node text fields for diff
  // detection. T-02: bounded by vault.on('rename'/'delete') purges + destroy().
  private readonly lastSnapshotByFilePath = new Map<string, Map<string, NodeFieldsSnapshot>>();

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
    // Phase 63 — snapshot cleanup on rename/delete (T-02 leak prevention).
    // The snapshot baseline keyed by filePath would otherwise grow monotonically
    // as the user opens/renames/deletes canvases.
    this.plugin.registerEvent(
      this.app.vault.on('rename', (_file, oldPath: string) => {
        if (oldPath.endsWith('.canvas')) this.lastSnapshotByFilePath.delete(oldPath);
      })
    );
    this.plugin.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file.path.endsWith('.canvas')) this.lastSnapshotByFilePath.delete(file.path);
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
    // Phase 63: discriminated nodeChanges (was newDisplayLabelByAnswerId Map in Phase 50).
    const { diffs, nodeChanges } = reconcileEdgeLabels(graph);

    // Phase 63 EDITOR-05 — node-text snapshot diff. Build the current snapshot
    // from the freshly-parsed graph; compare against the previous snapshot for
    // this filePath; collect dispatches for fields/nodeType/deletion deltas.
    // First-pass behaviour (no previous snapshot): seed silently; do NOT flood
    // the bus with one "fields" event per node on cold open.
    const previousSnapshot = this.lastSnapshotByFilePath.get(filePath);
    const isFirstPass = previousSnapshot === undefined;
    const currentSnapshot = new Map<string, NodeFieldsSnapshot>();
    const dispatches: CanvasChangedForNodeDetail[] = [];

    for (const node of graph.nodes.values()) {
      // Phase 63: read text fields from the resolved RPNode (parser has already
      // applied raw.text fallback per canvas-parser.ts:198-286). Cast through
      // any because each RPNode kind exposes a different subset of these.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = node as any;
      const snap: NodeFieldsSnapshot = {
        questionText: n.questionText,
        answerText: n.answerText,
        displayLabel: n.displayLabel,
        content: n.content,
        headerText: n.headerText,
        snippetLabel: n.snippetLabel,
        text: n.text,
        kind: node.kind,
      };
      currentSnapshot.set(node.id, snap);

      if (isFirstPass) continue;             // seed only — no dispatch on baseline build
      const prev = previousSnapshot!.get(node.id);
      if (!prev) continue;                   // newly-added node — also seed silently

      if (prev.kind !== snap.kind) {
        // Phase 63 D-09: nodeType change → full re-render in Plan 03; do not
        // also emit a fields delta (the form layout differs per kind).
        dispatches.push({
          filePath,
          nodeId: node.id,
          changeKind: 'nodeType',
          newKind: snap.kind,
        });
        continue;
      }

      // Phase 63 D-08: field-level diff — only keys that actually changed.
      const fieldUpdates: NonNullable<CanvasChangedForNodeDetail['fieldUpdates']> = {};
      if (prev.questionText !== snap.questionText) fieldUpdates['radiprotocol_questionText'] = snap.questionText;
      if (prev.answerText !== snap.answerText)     fieldUpdates['radiprotocol_answerText']  = snap.answerText;
      if (prev.displayLabel !== snap.displayLabel) fieldUpdates['radiprotocol_displayLabel'] = snap.displayLabel;
      if (prev.content !== snap.content)           fieldUpdates['radiprotocol_content']     = snap.content;
      if (prev.headerText !== snap.headerText)     fieldUpdates['radiprotocol_headerText']  = snap.headerText;
      if (prev.snippetLabel !== snap.snippetLabel) fieldUpdates['radiprotocol_snippetLabel'] = snap.snippetLabel;

      // Phase 63 Gap 2 (EDITOR-05): Obsidian canvas edits update the generic 'text'
      // property while leaving radiprotocol_* unchanged. Synthesize the correct
      // canonical field key based on node type so the form patch hits the right field.
      if (prev.text !== snap.text) {
        const canonicalKey =
          snap.kind === 'question'  ? 'radiprotocol_questionText' :
          snap.kind === 'answer'    ? 'radiprotocol_answerText' :
          snap.kind === 'text-block'? 'radiprotocol_content' :
          snap.kind === 'loop'      ? 'radiprotocol_headerText' :
          undefined;
        if (canonicalKey && !(canonicalKey in fieldUpdates)) {
          fieldUpdates[canonicalKey] = snap.text;
        }
      }

      if (Object.keys(fieldUpdates).length > 0) {
        dispatches.push({ filePath, nodeId: node.id, changeKind: 'fields', fieldUpdates });
      }
    }

    // Phase 63 D-10: deletion detection — nodes in previousSnapshot missing
    // from the current parse. Skip on first pass (no baseline to compare).
    if (!isFirstPass) {
      for (const [nodeId] of previousSnapshot!) {
        if (!currentSnapshot.has(nodeId)) {
          dispatches.push({ filePath, nodeId, changeKind: 'deleted' });
        }
      }
    }

    // Phase 63: short-circuit holds across BOTH edge reconcile AND snapshot
    // diff (extends Phase 50 D-07 idempotency). When all five categories of
    // change are empty, no write fires and no dispatch fires — the modify-event
    // self-terminates as in Phase 50, AND the EditorPanelView bus stays silent.
    // The snapshot is still updated so the next pass has the latest baseline.
    if (
      diffs.length === 0 &&
      nodeChanges.length === 0 &&
      dispatches.length === 0
    ) {
      this.lastSnapshotByFilePath.set(filePath, currentSnapshot);
      return;
    }

    // Phase 63: dispatch write. Discriminated nodeChanges → kind-aware nodeEdits.
    // Pattern B first (saveLiveBatch with node+edge atomicity), Strategy A fallback.
    const nodeEdits: Array<{ nodeId: string; edits: Record<string, unknown> }> =
      nodeChanges.map((c: NodeLabelChange) => ({
        nodeId: c.nodeId,
        edits: c.kind === 'answer'
          ? { radiprotocol_displayLabel: c.newLabel }   // Phase 50 path preserved
          : { radiprotocol_snippetLabel: c.newLabel },  // Phase 63 D-04 snippet routing
      }));
    const edgeEdits = diffs.map((d: EdgeLabelDiff) => ({
      edgeId: d.edgeId,
      label: d.targetLabel, // undefined → strip-key
    }));

    // Phase 63 D-12: every reconciler-driven nodeChange is also a "fields"
    // dispatch — the form must receive the new (display|snippet)Label even on
    // first pass when the snapshot baseline is empty. Merge into existing
    // dispatch entry for the same nodeId if one already exists; otherwise
    // append a fresh one. This makes cold-open D-03 migration broadcast.
    for (const c of nodeChanges) {
      const key = c.kind === 'answer' ? 'radiprotocol_displayLabel' : 'radiprotocol_snippetLabel';
      const existing = dispatches.find((d) => d.nodeId === c.nodeId && d.changeKind === 'fields');
      if (existing) {
        existing.fieldUpdates![key] = c.newLabel;
      } else {
        dispatches.push({
          filePath,
          nodeId: c.nodeId,
          changeKind: 'fields',
          fieldUpdates: { [key]: c.newLabel },
        });
      }
    }

    // Shared Pattern D — Pattern B / Strategy A fork. D-14 atomicity: one setData.
    try {
      const savedLive = await this.plugin.canvasLiveEditor.saveLiveBatch(
        filePath,
        nodeEdits,
        edgeEdits,
      );
      if (savedLive) {
        // Phase 63: snapshot + dispatch AFTER write success. Order matters —
        // snapshot lands first so any re-entrant reconcile triggered by the
        // write itself (Phase 50 modify-event loop) sees the new baseline and
        // short-circuits via the extended D-07 predicate above.
        this.lastSnapshotByFilePath.set(filePath, currentSnapshot);
        for (const d of dispatches) this.dispatchChange(d);
        return;
      }
    } catch (err) {
      console.warn('[RadiProtocol] edge-label saveLiveBatch threw — canvas rolled back:', err);
      return;   // do NOT update snapshot on failure — next pass rebuilds correctly
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
      // Phase 63: snapshot + dispatch AFTER write success (Strategy A path).
      this.lastSnapshotByFilePath.set(filePath, currentSnapshot);
      for (const d of dispatches) this.dispatchChange(d);
    } catch {
      // silent — reconciler background; user sees no Notice
      // Snapshot NOT updated on failure — next pass rebuilds.
    }
  }

  // Phase 63 D-12 — public subscribe API. Plan 03's EditorPanelView wires the
  // returned unsubscribe through Obsidian's Component.register(...) so the
  // lifecycle is tied to view unmount (T-04 leak prevention).
  subscribe(handler: (detail: CanvasChangedForNodeDetail) => void): () => void {
    const wrapped = (e: Event) => {
      handler((e as CustomEvent<CanvasChangedForNodeDetail>).detail);
    };
    this.bus.addEventListener('canvas-changed-for-node', wrapped);
    return () => this.bus.removeEventListener('canvas-changed-for-node', wrapped);
  }

  // Phase 63 D-12 — internal dispatch helper. Constructed in-place so no
  // shared state escapes the dispatch site (T-04 information leak guard).
  private dispatchChange(detail: CanvasChangedForNodeDetail): void {
    this.bus.dispatchEvent(
      new CustomEvent<CanvasChangedForNodeDetail>('canvas-changed-for-node', { detail }),
    );
  }

  /** T-11-04 timer leak prevention — called from RadiProtocolPlugin.onunload(). */
  destroy(): void {
    for (const [, timer] of this.debounceTimers.entries()) clearTimeout(timer);
    this.debounceTimers.clear();
    // Phase 63 T-02 — clear snapshot baseline on plugin unload to bound resident memory.
    this.lastSnapshotByFilePath.clear();
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

// Phase 63 Gap 1 (EDITOR-03): symmetric helper for Snippet branch label outbound sync.
// Enumerates every incoming edge targeting a Snippet node so saveLiveBatch can update
// edge labels atomically with the node property change.
export function collectIncomingSnippetEdgeEdits(
  parser: CanvasParser,
  canvasContent: string,
  canvasFilePath: string,
  snippetNodeId: string,
  newLabel: string | undefined,
): Array<{ edgeId: string; label: string | undefined }> {
  const parsed = parser.parse(canvasContent, canvasFilePath);
  if (!parsed.success) return [];
  const { graph } = parsed;
  const snippetNode = graph.nodes.get(snippetNodeId);
  if (!snippetNode || snippetNode.kind !== 'snippet') return [];
  const incoming = graph.edges.filter(e => e.toNodeId === snippetNodeId);
  return incoming.map(e => ({ edgeId: e.id, label: newLabel }));
}
