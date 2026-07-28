// src/protocol/protocol-document-migration.ts
// Pure, lossless, idempotent migration of legacy `.rp.json` documents to the
// canonical post-merge shape (standalone `kind: 'loop'` → looped Questions;
// `+`-prefix exit labels → `isLoopExit` flags). Zero Obsidian imports.

import type { ProtocolDocumentV1, ProtocolNodeRecord, ProtocolEdgeRecord } from './protocol-document';

/** Strip the leading `+` control prefix from a legacy loop-exit edge label.
 *  Outer trim, remove exactly one `+`, then strip whitespace immediately
 *  following it (mirrors the former prefix-strip helper that lived in
 *  node-label.ts before the loop→question merge). */
function stripLegacyExitPrefix(label: string): string {
  return label.trim().slice(1).replace(/^\s+/, '');
}

/**
 * Migrate a legacy `.rp.json` document to the canonical post-merge shape.
 *
 * Transform (applied only when at least one node has exact legacy `kind === 'loop'`):
 *   - Each `kind: 'loop'` node → `kind: 'question'` with
 *     `fields.questionText = fields.headerText ?? ''`, `fields.loop = true`,
 *     and `fields.headerText` removed. All other node fields, geometry, color,
 *     text, and unknown extension fields are preserved.
 *   - Each outgoing edge of a legacy loop node whose label starts with `+`
 *     (after trim) → label stripped of the `+` prefix (empty result →
 *     `undefined`), `isLoopExit = true`. Edges from non-loop nodes are NEVER
 *     reclassified — only edges whose `fromNodeId` is a captured legacy loop
 *     node ID are touched, so unrelated user labels beginning with `+` are
 *     left intact.
 *   - `updatedAt` bumped to `now()` (injectable for tests; default
 *     `new Date().toISOString()`).
 *
 * Idempotent: if no node has legacy `kind === 'loop'`, returns
 * `{ doc, changed: false }` without allocating a new document (same reference).
 * Lossless: layered spreads (`...doc`, `...node`, `...node.fields`, `...edge`)
 * preserve metadata, IDs, endpoints, geometry, colors, raw text, viewport,
 * layout direction, self-check state, and unknown extension fields.
 */
export function migrateProtocolDocument(
  doc: ProtocolDocumentV1,
  now: () => string = () => new Date().toISOString(),
): { doc: ProtocolDocumentV1; changed: boolean } {
  const legacyLoopIds = new Set<string>();
  for (const node of doc.nodes) {
    if ((node.kind as string | null) === 'loop') legacyLoopIds.add(node.id);
  }
  if (legacyLoopIds.size === 0) {
    return { doc, changed: false };
  }

  const migratedNodes: ProtocolNodeRecord[] = doc.nodes.map((node) => {
    if ((node.kind as string | null) !== 'loop') return node;
    const fields =
      typeof node.fields === 'object' && node.fields !== null
        ? { ...(node.fields as Record<string, unknown>) }
        : {};
    const headerTextValue = typeof fields['headerText'] === 'string'
      ? fields['headerText']
      : typeof fields['radiprotocol_headerText'] === 'string'
        ? fields['radiprotocol_headerText']
        : '';
    delete fields['headerText'];
    delete fields['radiprotocol_headerText'];
    return {
      ...node,
      kind: 'question',
      fields: {
        ...fields,
        questionText: headerTextValue,
        loop: true,
      },
    };
  });

  const migratedEdges: ProtocolEdgeRecord[] = doc.edges.map((edge) => {
    if (!legacyLoopIds.has(edge.fromNodeId)) return edge;
    if (typeof edge.label !== 'string') return edge;
    const trimmed = edge.label.trim();
    if (!trimmed.startsWith('+')) return edge;
    const caption = stripLegacyExitPrefix(edge.label);
    return {
      ...edge,
      label: caption === '' ? undefined : caption,
      isLoopExit: true,
    };
  });

  return {
    doc: {
      ...doc,
      nodes: migratedNodes,
      edges: migratedEdges,
      updatedAt: now(),
    },
    changed: true,
  };
}