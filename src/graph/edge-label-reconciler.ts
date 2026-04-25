// src/graph/edge-label-reconciler.ts
// Pure module — zero Obsidian API imports (D-18)
// Phase 50 D-10: Answer.displayLabel is the single source of truth for every
// incoming Question→Answer edge label. Multi-incoming Answer nodes share ONE
// label across all incoming edges — per-edge override is explicitly out of scope
// for v1.8 (REQUIREMENTS.md Out-of-Scope row 1).
// Design source: .planning/notes/answer-label-edge-sync.md (Phase 50 D-16)

import type { ProtocolGraph, RPEdge, AnswerNode, SnippetNode } from './graph-model'; // Phase 63: discriminated union
import { isLabeledEdge } from './node-label';

export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
  kind: 'answer' | 'snippet'; // Phase 63: discriminated union
}

// Phase 63: discriminated union — node-side label change carries kind so
// downstream writers know whether to target radiprotocol_displayLabel
// (kind='answer') or radiprotocol_snippetLabel (kind='snippet').
export interface NodeLabelChange {
  nodeId: string;
  newLabel: string | undefined;
  kind: 'answer' | 'snippet';
}

export interface ReconcileResult {
  diffs: EdgeLabelDiff[];
  nodeChanges: NodeLabelChange[]; // Phase 63: discriminated union (replaces the legacy answer-only map)
}

/**
 * D-04 edge-wins bi-directional reconcile.
 *
 * For each Answer node:
 *   pickedLabel =
 *     first non-empty (trimmed) incoming edge label
 *     ?? (answer.displayLabel?.trim() || undefined)
 *     ?? undefined
 *
 * Then:
 *   - If pickedLabel differs from answer.displayLabel (trimmed), append a
 *     NodeLabelChange { nodeId, newLabel, kind: 'answer' } to nodeChanges.
 *   - For each incoming edge whose trimmed label !== pickedLabel, push an
 *     EdgeLabelDiff so the caller can re-sync to the picked value.
 *
 * D-07: if no Answer needs a displayLabel change AND no edge diverges from its
 * picked target, the returned result is structurally empty — the caller MUST
 * short-circuit (no disk write), which is how the vault.on('modify') loop
 * self-terminates after the plugin's own write lands (CONTEXT.md D-07).
 *
 * D-05 reuse: whitespace-only edge labels are treated as unlabeled via the
 * shared isLabeledEdge predicate from ./node-label — do NOT reshape that
 * predicate (CONTEXT.md §code_context).
 *
 * D-18: pure — no vault, no Obsidian import, no side effects.
 *
 * Phase 63 D-04: the same edge-wins rule extends to Question→Snippet incoming
 * edges. SnippetNode.snippetLabel is the single source of truth for every
 * incoming Question→Snippet edge label. Diffs and node changes carry a
 * `kind: 'answer' | 'snippet'` discriminator so the caller can route
 * node-side writes to either `radiprotocol_displayLabel` or
 * `radiprotocol_snippetLabel`. The snippet arm runs in the SAME loop pass
 * as the answer arm, sharing the D-07 idempotency short-circuit: a
 * structurally empty `{ diffs: [], nodeChanges: [] }` self-terminates the
 * modify-event loop across BOTH arms. Phase 63 T-01 invariant: the
 * reconciler MUST NEVER throw — every field read uses optional chaining,
 * unexpected node shapes are silently skipped (the existing Answer arm
 * already establishes that precedent).
 */
export function reconcileEdgeLabels(graph: ProtocolGraph): ReconcileResult {
  const diffs: EdgeLabelDiff[] = [];
  const nodeChanges: NodeLabelChange[] = []; // Phase 63: discriminated union

  for (const node of graph.nodes.values()) {
    // Phase 63: parallel arms for answer + snippet kinds; other kinds skipped.
    if (node.kind === 'answer') {
      const answer: AnswerNode = node;

      // Deterministic incoming enumeration: filter graph.edges in array order.
      // reverseAdjacency gives the set of source nodes but array order of
      // graph.edges[] is what determines "first non-empty" below.
      const incomingEdges: RPEdge[] = graph.edges.filter(
        (e) => e.toNodeId === answer.id,
      );

      // D-04 step 1: first non-empty incoming label (Phase 49 D-05 reuse —
      // whitespace-only ≡ unlabeled).
      const firstLabeled = incomingEdges.find((e) => isLabeledEdge(e));
      const edgePick = firstLabeled?.label?.trim() || undefined;

      // D-04 step 2: fallback to trimmed displayLabel if no incoming edge is labeled.
      const displayTrim = answer.displayLabel?.trim() || undefined;
      const pickedLabel: string | undefined = edgePick ?? displayTrim;

      // D-04 step 3: propagate displayLabel if it diverges from pickedLabel.
      if (displayTrim !== pickedLabel) {
        nodeChanges.push({ nodeId: answer.id, newLabel: pickedLabel, kind: 'answer' }); // Phase 63: discriminated union
      }

      // D-04 step 4: push a diff for every incoming edge whose trimmed label !== pickedLabel.
      for (const e of incomingEdges) {
        const currentTrim = e.label?.trim() || undefined;
        if (currentTrim !== pickedLabel) {
          diffs.push({
            edgeId: e.id,
            currentLabel: e.label,
            targetLabel: pickedLabel,
            kind: 'answer', // Phase 63: discriminated union
          });
        }
      }
    } else if (node.kind === 'snippet') {
      // Phase 63 D-04: snippet edge-wins arm — byte-identical mirror of the
      // answer arm above, reading SnippetNode.snippetLabel and stamping
      // kind: 'snippet' on every emitted diff/nodeChange.
      const snippet: SnippetNode = node;

      const incomingEdges: RPEdge[] = graph.edges.filter(
        (e) => e.toNodeId === snippet.id,
      );

      const firstLabeled = incomingEdges.find((e) => isLabeledEdge(e));
      const edgePick = firstLabeled?.label?.trim() || undefined;

      const snippetTrim = snippet.snippetLabel?.trim() || undefined;
      const pickedLabel: string | undefined = edgePick ?? snippetTrim;

      if (snippetTrim !== pickedLabel) {
        nodeChanges.push({ nodeId: snippet.id, newLabel: pickedLabel, kind: 'snippet' });
      }

      for (const e of incomingEdges) {
        const currentTrim = e.label?.trim() || undefined;
        if (currentTrim !== pickedLabel) {
          diffs.push({
            edgeId: e.id,
            currentLabel: e.label,
            targetLabel: pickedLabel,
            kind: 'snippet',
          });
        }
      }
    }
  }

  return { diffs, nodeChanges }; // Phase 63: discriminated union
}
