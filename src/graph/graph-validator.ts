// graph/graph-validator.ts
// Pure module — zero Obsidian API imports (PARSE-07, NFR-01)

import type { ProtocolGraph, RPNode } from './graph-model';

export class GraphValidator {
  /**
   * Validates a ProtocolGraph and returns human-readable error strings (PARSE-08).
   * Returns [] if the graph is valid.
   * Never throws — all errors are returned as strings.
   */
  validate(graph: ProtocolGraph): string[] {
    const errors: string[] = [];

    // Check 1 & 2: Exactly one start node
    const startNodes: string[] = [];
    for (const [id, node] of graph.nodes) {
      if (node.kind === 'start') startNodes.push(id);
    }

    if (startNodes.length === 0) {
      errors.push('No start node found. Add a node with radiprotocol_nodeType = "start".');
      // Without a start node, reachability checks are meaningless — return early
      return errors;
    }
    if (startNodes.length > 1) {
      errors.push(
        `Multiple start nodes found (${startNodes.length}). Only one start node is allowed.`
      );
      // Continue other checks using the first start node found
    }

    const startNodeId = startNodes[0];
    if (startNodeId === undefined) return errors; // Guard for noUncheckedIndexedAccess

    // Check 3: Reachability — BFS from start node
    const reachable = this.bfsReachable(graph, startNodeId);
    const unreachable: string[] = [];
    for (const [id] of graph.nodes) {
      if (!reachable.has(id)) unreachable.push(id);
    }
    if (unreachable.length > 0) {
      const nodeList = unreachable
        .map(id => {
          const node = graph.nodes.get(id);
          return node ? `"${this.nodeLabel(node)}"` : `"${id}"`;
        })
        .join(', ');
      errors.push(
        `${unreachable.length} unreachable node${unreachable.length > 1 ? 's' : ''} found: ${nodeList}. ` +
        'Connect these nodes to the protocol or remove them.'
      );
    }

    // Check 4: Unintentional cycles — three-color DFS
    // A cycle is unintentional if it does NOT pass through a loop-end node.
    const cycleErrors = this.detectUnintentionalCycles(graph, startNodeId);
    errors.push(...cycleErrors);

    // Check 5: Dead-end questions — question nodes with no outgoing edges
    for (const [id, node] of graph.nodes) {
      if (node.kind === 'question') {
        const outgoing = graph.adjacency.get(id);
        if (!outgoing || outgoing.length === 0) {
          errors.push(
            `Question "${node.questionText || id}" has no outgoing branches. ` +
            'Add at least one answer or snippet node connected from this question.'
          );
        }
      }
    }

    // Check 6: Orphaned loop-end nodes
    for (const [id, node] of graph.nodes) {
      if (node.kind === 'loop-end') {
        const matchingLoopStart = graph.nodes.get(node.loopStartId);
        if (!matchingLoopStart || matchingLoopStart.kind !== 'loop-start') {
          errors.push(
            `Loop-end node "${id}" references loop-start "${node.loopStartId}" which does not exist. ` +
            'Ensure every loop-end node has a matching loop-start node.'
          );
        }
      }
    }

    // TODO: Phase 5 — Check 7: Snippet reference existence
    // for (const [id, node] of graph.nodes) {
    //   if (node.kind === 'text-block' && node.snippetId) {
    //     if (!snippetService.exists(node.snippetId)) {
    //       errors.push(`Snippet "${node.snippetId}" referenced by node "${id}" was not found.`);
    //     }
    //   }
    // }

    return errors;
  }

  /**
   * BFS from startNodeId — returns the set of all reachable node IDs.
   */
  private bfsReachable(graph: ProtocolGraph, startNodeId: string): Set<string> {
    const visited = new Set<string>();
    const queue: string[] = [startNodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = graph.adjacency.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
    }

    return visited;
  }

  /**
   * Three-color DFS cycle detection.
   * Colors: white (unvisited) | gray (in current DFS path) | black (fully processed)
   * A back-edge (gray → gray) indicates a cycle.
   * Cycles that pass through a loop-end node are intentional and NOT reported as errors.
   */
  private detectUnintentionalCycles(graph: ProtocolGraph, startNodeId: string): string[] {
    const errors: string[] = [];
    const color = new Map<string, 'white' | 'gray' | 'black'>();

    // Initialize all nodes as white
    for (const [id] of graph.nodes) {
      color.set(id, 'white');
    }

    const dfs = (nodeId: string, pathStack: string[]): void => {
      color.set(nodeId, 'gray');
      pathStack.push(nodeId);

      const neighbors = graph.adjacency.get(nodeId) ?? [];
      for (const neighborId of neighbors) {
        const neighborColor = color.get(neighborId);

        if (neighborColor === 'gray') {
          // Back-edge found — determine if this cycle passes through a loop-end node
          const cycleStart = pathStack.indexOf(neighborId);
          const cycleNodes = pathStack.slice(cycleStart);

          const passesViaLoopEnd = cycleNodes.some(id => {
            const n = graph.nodes.get(id);
            return n?.kind === 'loop-end';
          });

          if (!passesViaLoopEnd) {
            const cycleLabel = cycleNodes
              .map(id => {
                const n = graph.nodes.get(id);
                return n ? `"${this.nodeLabel(n)}"` : `"${id}"`;
              })
              .join(' → ');
            errors.push(
              `Unintentional cycle detected: ${cycleLabel}. ` +
              'Cycles must pass through a loop-end node. Remove the back-edge or use a loop-start/loop-end pair.'
            );
          }
        } else if (neighborColor === 'white') {
          dfs(neighborId, pathStack);
        }
        // black = already fully processed, skip
      }

      pathStack.pop();
      color.set(nodeId, 'black');
    };

    // Start DFS from the start node; also visit any unreachable nodes
    // to catch cycles in disconnected subgraphs
    dfs(startNodeId, []);
    for (const [id] of graph.nodes) {
      if (color.get(id) === 'white') {
        dfs(id, []);
      }
    }

    return errors;
  }

  /**
   * Returns a human-readable label for a node (for use in error messages).
   */
  private nodeLabel(node: RPNode): string {
    switch (node.kind) {
      case 'start': return `start (${node.id})`;
      case 'question': return node.questionText || node.id;
      case 'answer': return (node.displayLabel ?? node.answerText) || node.id;
      case 'free-text-input': return node.promptLabel || node.id;
      case 'text-block': return node.content.slice(0, 30) || node.id;
      case 'loop-start': return node.loopLabel || node.id;
      case 'loop-end': return `loop-end (${node.id})`;
      case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
    }
  }
}
