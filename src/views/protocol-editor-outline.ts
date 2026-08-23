// views/protocol-editor-outline.ts
// Pure outline-tree builder for the protocol editor's structure panel.
// Projects the document graph (nodes + edges) into a depth-ordered list of
// rows: start → questions → branches, following edge topology with cycle
// protection. No Obsidian/DOM imports — fully unit-testable.

import type { ProtocolEdgeRecord, ProtocolNodeRecord } from '../protocol/protocol-document';
import type { RPNodeKind } from '../graph/graph-model';

/** One renderable row of the outline panel. */
export interface ProtocolEditorOutlineEntry {
  nodeId: string;
  kind: RPNodeKind | null;
  /** Display title resolved by the caller (nodeTitle + translator live in the view). */
  title: string;
  /** Hop distance from the start node along the traversal (0 = start). */
  depth: number;
  /** True when the node has at least one outgoing edge. */
  hasChildren: boolean;
}

/**
 * Build the outline rows for a protocol document.
 *
 * Traversal: depth-first from the start node (first `kind: 'start'`, else the
 * first node) following edges in document order. DFS keeps each branch's
 * subtree directly under its parent, so rows read as an indented tree instead
 * of level-by-level layers. Every node appears exactly once — joins and loop
 * re-entries are folded into their first visit, so the panel stays a tree even
 * when the graph is not one. Unreachable nodes are appended after the
 * reachable ones (document order), so nothing silently disappears.
 */
export function buildProtocolEditorOutline(
  nodes: readonly ProtocolNodeRecord[],
  edges: readonly ProtocolEdgeRecord[],
  titleOf: (node: ProtocolNodeRecord) => string,
): ProtocolEditorOutlineEntry[] {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeById.has(edge.fromNodeId) || !nodeById.has(edge.toNodeId)) continue;
    const list = outgoing.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, list);
  }

  const start = nodes.find(node => node.kind === 'start') ?? nodes[0];
  const entries: ProtocolEditorOutlineEntry[] = [];
  if (start === undefined) return entries;

  const visited = new Set<string>();
  // Iterative DFS with an explicit stack. Children are pushed in reverse
  // document order so the first edge's subtree is emitted first.
  const stack: Array<{ id: string; depth: number }> = [{ id: start.id, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const node = nodeById.get(current.id);
    if (node === undefined) continue;
    const children = outgoing.get(current.id) ?? [];
    entries.push({
      nodeId: node.id,
      kind: node.kind,
      title: titleOf(node),
      depth: current.depth,
      hasChildren: children.length > 0,
    });
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const childId = children[i]!;
      if (visited.has(childId)) continue;
      stack.push({ id: childId, depth: current.depth + 1 });
    }
  }

  // Unreachable nodes (disconnected fragments) go last, document order.
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    entries.push({
      nodeId: node.id,
      kind: node.kind,
      title: titleOf(node),
      depth: 0,
      hasChildren: (outgoing.get(node.id) ?? []).length > 0,
    });
  }

  return entries;
}
