// graph/node-label.ts
// Pure module — zero Obsidian API imports (NFR-01, PARSE-07)
// Phase 49 D-13: shared label extractor for validator error messages (D-04)
// and runner picker body-button captions (D-11/D-12). ONE implementation —
// validator wording and runner caption wording must stay in lock-step.

import type { RPNode, RPEdge } from './graph-model';

/**
 * Human-readable label for a node. Used by GraphValidator error messages (D-04)
 * and by loop-picker body-button captions (D-11/D-12).
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
    case 'snippet': {
      // Phase 67 D-15 — caption parity with inline runner sibling-button captions.
      // Character-for-character identity is the invariant from this file's header comment ("the validator
      // error text and the runner button caption MUST match character-for-character"). The directory-bound
      // arm at the bottom preserves the legacy 'snippet (subfolderPath)' / 'snippet (root)' strings that
      // graph-validator consumes in error UX (Specifics §5).
      const isFileBound = typeof node.radiprotocol_snippetPath === 'string' && node.radiprotocol_snippetPath !== '';
      if (isFileBound) {
        const path = node.radiprotocol_snippetPath as string;
        if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📄 ${node.snippetLabel}`;
        const lastSlash = path.lastIndexOf('/');
        const basename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
        const dot = basename.lastIndexOf('.');
        const stem = dot > 0 ? basename.slice(0, dot) : basename;
        if (stem.length > 0) return `📄 ${stem}`;
        return '📄 Snippet';
      }
      if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📁 ${node.snippetLabel}`;
      if (node.subfolderPath) return `snippet (${node.subfolderPath})`;
      return 'snippet (root)';
    }
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
 * (exit-edge dispatch) and inline host loop-picker caption choice.
 */
export function isLabeledEdge(edge: RPEdge): boolean {
  return edge.label != null && edge.label.trim() !== '';
}

/**
 * Phase 50.1 D-10: exit-edge predicate. An edge is an exit edge iff its label
 * is non-null/undefined AND its trimmed value starts with "+". The prefix
 * distinguishes exit edges from body edges so a loop node can carry any number
 * of labeled body branches (Phase 50 reconciler legitimately labels body edges
 * that point to Answer nodes with displayLabel — see
 * docs/ARCHITECTURE-NOTES.md#loop-node-exit-edge-convention).
 *
 * Supersedes the Phase 49 alias `isExitEdge = isLabeledEdge`. The two
 * predicates are now semantically distinct:
 *   - isLabeledEdge: "edge has any non-empty trimmed label" — Phase 50
 *     EdgeLabelReconciler uses this as the sync discriminator (preserved).
 *   - isExitEdge:    "edge label starts with '+' after trim" — Phase 50.1
 *     runtime exit dispatch + validator LOOP-04 + loop-picker caption arm.
 */
export function isExitEdge(edge: RPEdge): boolean {
  return edge.label != null && edge.label.trim().startsWith('+');
}

/**
 * Phase 50.1 D-09: caption extractor for an exit edge. Caller MUST verify
 * isExitEdge(edge) first — this function assumes the label has already been
 * trimmed-and-checked for the "+" prefix at a higher layer.
 *
 * Behaviour:
 *   - Outer whitespace is trimmed first (matches Phase 49 D-06 "trimmed verbatim").
 *   - Exactly ONE "+" character is removed.
 *   - Any whitespace (including Unicode nbsp) immediately following the "+" is
 *     stripped, so "+ выход" and "+\u00a0выход" both yield "выход".
 *   - "+" alone (or "+ ") yields "" — GraphValidator LOOP-04 D-08 rejects the
 *     canvas before Runner ever dispatches, so runtime never sees an empty
 *     caption.
 *   - "++foo" yields "+foo" — an author may consciously opt into a
 *     "+"-prefixed caption; rare.
 */
export function stripExitPrefix(label: string): string {
  return label.trim().slice(1).replace(/^\s+/, '');
}
