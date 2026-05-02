// runner/runner-text.ts
// Phase 75 DEDUP-01 — shared accumulated-text accessor for runner render hosts.
import type { RunnerState } from './runner-state';

export function accumulatedTextOf(state: RunnerState): string {
  switch (state.status) {
    case 'at-node':
    case 'awaiting-snippet-pick':
    case 'awaiting-snippet-fill':
    case 'awaiting-loop-pick':
      return state.accumulatedText;
    case 'complete':
      return state.finalText;
    case 'idle':
    case 'error':
      return '';
  }
}
