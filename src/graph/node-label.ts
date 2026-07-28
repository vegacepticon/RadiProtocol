// graph/node-label.ts
// Pure module — zero Obsidian API imports (NFR-01, PARSE-07)
// Phase 49 D-13: shared label extractor for validator error messages (D-04)
// and runner picker body-button captions (D-11/D-12). ONE implementation —
// validator wording and runner caption wording must stay in lock-step.

import type { RPNode } from './graph-model';

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
  }
}
