// graph/graph-validator.ts
// Pure module — zero Obsidian API imports (PARSE-07, NFR-01)
import type { ProtocolGraph } from './graph-model';

export class GraphValidator {
  /**
   * Validates a ProtocolGraph and returns an array of human-readable error strings.
   * Returns an empty array if the graph is valid (PARSE-08).
   */
  validate(_graph: ProtocolGraph): string[] {
    // TODO: Phase 1 — Plan 01-04 implements this
    return [];
  }
}
