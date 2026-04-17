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

    // Check (migration): Legacy loop-start and loop-end узлы (Phase 43 D-07, MIGRATE-01).
    // Если найдены — возвращаем одну сводную ошибку на русском и прекращаем валидацию,
    // иначе LOOP-04 и cycle-check выдают ошибки поверх, что сбивает автора (D-CL-02).
    const legacyLoopNodes: string[] = [];
    for (const [, node] of graph.nodes) {
      if (node.kind === 'loop-start' || node.kind === 'loop-end') {
        legacyLoopNodes.push(`"${this.nodeLabel(node)}"`);
      }
    }
    if (legacyLoopNodes.length > 0) {
      errors.push(
        `Канвас содержит устаревшие узлы loop-start/loop-end: ${legacyLoopNodes.join(', ')}. ` +
        `Пересоберите цикл с единым узлом loop: метка «выход» на одном из исходящих рёбер ` +
        `обозначает ветвь выхода, остальные исходящие рёбра — тело цикла.`
      );
      return errors;
    }

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
    // Phase 43 D-09 — A cycle is unintentional if it does NOT pass through a unified loop node.
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

    // Check (LOOP-04): каждый unified loop-узел должен иметь
    //  1) ровно одно исходящее ребро с label === 'выход' (Phase 43 D-08.1)
    //  2) не более одного ребра «выход» (Phase 43 D-08.2) — дубликаты флагаем отдельно
    //  3) минимум одно body-ребро (label !== 'выход') (Phase 43 D-08.3)
    // «выход» — exact-match, case-sensitive, без trim. Контракт с автором.
    for (const [id, node] of graph.nodes) {
      if (node.kind !== 'loop') continue;
      const outgoing = graph.edges.filter(e => e.fromNodeId === id);
      const exitEdges = outgoing.filter(e => e.label === 'выход');
      const bodyEdges = outgoing.filter(e => e.label !== 'выход');
      const label = this.nodeLabel(node);
      // D-08.1 — missing «выход»
      if (exitEdges.length === 0) {
        errors.push(
          `Loop node "${label}" не имеет ребра «выход». ` +
          `Добавьте исходящее ребро с меткой «выход», обозначающее ветвь выхода из цикла.`
        );
      }
      // D-08.2 — duplicate «выход»
      if (exitEdges.length > 1) {
        const dupIds = exitEdges.map(e => e.id).join(', ');
        errors.push(
          `Loop node "${label}" имеет несколько рёбер «выход»: ${dupIds}. ` +
          `Должно быть ровно одно исходящее ребро с меткой «выход».`
        );
      }
      // D-08.3 — no body
      if (bodyEdges.length === 0) {
        errors.push(
          `Loop node "${label}" не имеет ни одной body-ветви. ` +
          `Добавьте хотя бы одно исходящее ребро с меткой, отличной от «выход».`
        );
      }
    }

    // Check 6 (orphaned loop-end) удалён в Phase 43 D-10 — LoopEndNode больше не существует
    // как живой kind в валидных канвасах. Legacy loop-end узлы отклоняются Migration Check'ом
    // (см. выше, Phase 43 D-07), до достижения этой точки.

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
   * Phase 43 D-09 — Cycles that pass through a unified loop node are intentional and NOT reported as errors.
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
          // Back-edge found — determine if this cycle passes through a unified loop node (Phase 43 D-09)
          const cycleStart = pathStack.indexOf(neighborId);
          const cycleNodes = pathStack.slice(cycleStart);

          // Phase 43 D-09 — намеренный цикл теперь проходит через unified loop node
          // (ранее проходил через loop-end). Имя переменной обновлено.
          const passesViaLoopNode = cycleNodes.some(id => {
            const n = graph.nodes.get(id);
            return n?.kind === 'loop';
          });

          if (!passesViaLoopNode) {
            const cycleLabel = cycleNodes
              .map(id => {
                const n = graph.nodes.get(id);
                return n ? `"${this.nodeLabel(n)}"` : `"${id}"`;
              })
              .join(' → ');
            errors.push(
              `Unintentional cycle detected: ${cycleLabel}. ` +
              'Cycles must pass through a loop node. Remove the back-edge or route the cycle through a loop node.'
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
      case 'loop-start': return node.loopLabel || node.id;                              // @deprecated Phase 43 D-CL-05
      case 'loop-end': return `loop-end (${node.id})`;                                  // @deprecated Phase 43 D-CL-05
      case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
      case 'loop': return node.headerText || node.id;                                   // Phase 43 D-11 (LOOP-02)
    }
  }
}
