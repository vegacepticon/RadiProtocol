// graph/edge-order.ts
// Pure ordered-projection helper for a question's outgoing edges.
// Zero Obsidian imports (NFR-01) — fully unit-testable in plain Node.js.
//
// Shared by render-question, render-loop-picker, and skip across the runner
// layer. When a QuestionNode carries an `optionOrder: string[]` (outgoing edge
// ids in display order), this module projects the current outgoing edges into
// that order, dropping stale/non-outgoing/duplicate ids and appending any
// unlisted current outgoing edges at the end (FR-6 read-path counterpart). When
// `optionOrder` is absent (`undefined`), the projection is the edges-array order
// of outgoing edges — today's fallback — so consumers can call this helper
// unconditionally and the absent case is byte-identical to prior behavior.

import type { ProtocolGraph, RPEdge } from './graph-model';

/**
 * Return the outgoing edges of `questionId` in display order.
 *
 * - `optionOrder` absent (`undefined`) → outgoing edges in `graph.edges` array
 *   order (the never-authored fallback; adjacency order agrees per source node).
 * - `optionOrder` present (including `[]`) → emit each listed id that resolves
 *   to a CURRENT outgoing edge, in listed order, skipping stale ids (edge
 *   deleted or reassigned to another source), non-outgoing ids, and duplicates;
 *   then append any unlisted current outgoing edges at the end in edges-array
 *   order so every reachable edge stays reachable even in hand-edited files.
 *
 * Never throws; a missing/non-question `questionId` yields the edges-array
 * outgoing order (defensive — callers already guard kind).
 */
export function orderedOutgoingEdges(graph: ProtocolGraph, questionId: string): RPEdge[] {
  const outgoing = graph.edges.filter((e) => e.fromNodeId === questionId);
  const node = graph.nodes.get(questionId);
  const optionOrder = node?.kind === 'question' ? node.optionOrder : undefined;
  if (optionOrder === undefined) return outgoing;

  const byId = new Map<string, RPEdge>();
  for (const e of outgoing) byId.set(e.id, e);

  const ordered: RPEdge[] = [];
  const seen = new Set<string>();
  for (const id of optionOrder) {
    // Parser guarantees string elements, but a hand-edited runtime graph could
    // carry malformed entries — skip them silently (never-throw convention).
    if (typeof id !== 'string') continue;
    const edge = byId.get(id);
    if (edge === undefined) continue;  // stale or non-outgoing
    if (seen.has(id)) continue;        // duplicate
    seen.add(id);
    ordered.push(edge);
  }
  // Append unlisted current outgoing edges at the end, in edges-array order.
  for (const e of outgoing) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    ordered.push(e);
  }
  return ordered;
}
