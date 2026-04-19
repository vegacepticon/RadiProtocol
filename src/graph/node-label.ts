// graph/node-label.ts
// Pure module — zero Obsidian API imports (NFR-01, PARSE-07)
// Phase 49 D-13: shared label extractor for validator error messages (D-04)
// and runner picker body-button captions (D-11/D-12). ONE implementation —
// validator wording and runner caption wording must stay in lock-step.

import type { RPNode, RPEdge } from './graph-model';

/**
 * Human-readable label for a node. Used by GraphValidator error messages (D-04)
 * and by RunnerView loop-picker body-button captions (D-11/D-12).
 *
 * Body lifted verbatim from the former private GraphValidator.nodeLabel()
 * (graph-validator.ts:238-249 pre-Phase-49). Do not diverge — the validator error
 * text and the runner button caption MUST match character-for-character so users
 * can correlate an error to the button they see.
 */
export function nodeLabel(node: RPNode): string {
  switch (node.kind) {
    case 'start': return `start (${node.id})`;
    case 'question': return node.questionText || node.id;
    case 'answer': return (node.displayLabel ?? node.answerText) || node.id;
    case 'text-block': return node.content.slice(0, 30) || node.id;
    case 'loop-start': return node.loopLabel || node.id;                              // @deprecated Phase 43 D-CL-05
    case 'loop-end': return `loop-end (${node.id})`;                                  // @deprecated Phase 43 D-CL-05
    case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
    case 'loop': return node.headerText || node.id;                                   // Phase 43 D-11 (LOOP-02)
  }
}

/**
 * Phase 49 D-05: an edge is "labeled" iff its label is non-null/undefined
 * AND its trimmed length is > 0. Whitespace-only labels are NOT labeled —
 * this prevents a "looks-empty but string-equal" bypass of the exit-edge
 * uniqueness invariant enforced by GraphValidator LOOP-04.
 *
 * Consumed by GraphValidator (LOOP-04 check), ProtocolRunner.chooseLoopBranch
 * (exit-edge dispatch), and RunnerView (loop-picker CSS class + caption choice).
 */
export function isLabeledEdge(edge: RPEdge): boolean {
  return edge.label != null && edge.label.trim() !== '';
}

/**
 * Phase 49 D-07: alias spelling the runtime intent. Under the Phase 49 convention
 * the sole labeled outgoing edge of a loop node IS the exit edge; GraphValidator
 * guarantees uniqueness (0 or ≥2 labeled edges are hard errors) before the
 * Runner starts, so runtime callers never need to count — a single boolean
 * predicate suffices.
 */
export const isExitEdge = isLabeledEdge;
