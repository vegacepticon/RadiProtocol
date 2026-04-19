// src/graph/edge-label-reconciler.ts
// Pure module — zero Obsidian API imports (D-18)
// Phase 50 D-10: Answer.displayLabel is the single source of truth for every
// incoming Question→Answer edge label. Multi-incoming Answer nodes share ONE
// label across all incoming edges — per-edge override is explicitly out of scope
// for v1.8 (REQUIREMENTS.md Out-of-Scope row 1).
// Design source: .planning/notes/answer-label-edge-sync.md (Phase 50 D-16)

import type { ProtocolGraph, RPEdge, AnswerNode } from './graph-model';
import { isLabeledEdge } from './node-label';

export interface EdgeLabelDiff {
  edgeId: string;
  currentLabel: string | undefined;
  targetLabel: string | undefined;
}

export interface ReconcileResult {
  diffs: EdgeLabelDiff[];
  newDisplayLabelByAnswerId: Map<string, string | undefined>;
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
 *   - If pickedLabel differs from answer.displayLabel (trimmed), record
 *     newDisplayLabelByAnswerId.set(answerId, pickedLabel).
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
 */
export function reconcileEdgeLabels(graph: ProtocolGraph): ReconcileResult {
  const diffs: EdgeLabelDiff[] = [];
  const newDisplayLabelByAnswerId = new Map<string, string | undefined>();

  for (const node of graph.nodes.values()) {
    if (node.kind !== 'answer') continue;
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
      newDisplayLabelByAnswerId.set(answer.id, pickedLabel);
    }

    // D-04 step 4: push a diff for every incoming edge whose trimmed label !== pickedLabel.
    for (const e of incomingEdges) {
      const currentTrim = e.label?.trim() || undefined;
      if (currentTrim !== pickedLabel) {
        diffs.push({
          edgeId: e.id,
          currentLabel: e.label,
          targetLabel: pickedLabel,
        });
      }
    }
  }

  return { diffs, newDisplayLabelByAnswerId };
}
