// runner/runner-state.ts — TODO: Phase 2
// Pure module — zero Obsidian API imports (NFR-01)
export type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'awaiting-snippet-fill'
  | 'complete'
  | 'error';
