// runner/runner-renderer.ts
// Phase 75 DEDUP-01 — shared runner renderer scaffold.
// Later 75-02..75-05 plans will move concrete state renderers behind this class.
import type { ProtocolGraph } from '../graph/graph-model';
import type { ProtocolRunner } from './protocol-runner';
import type { RunnerHost } from './runner-host';
import type { RunnerState } from './runner-state';

export class RunnerRenderer {
  constructor(
    private readonly host: RunnerHost,
    private readonly runner: ProtocolRunner,
    private readonly getGraph: () => ProtocolGraph | null,
  ) {}

  render(zone: HTMLElement): void {
    const state = this.runner.getState();
    this.renderState(zone, state);
  }

  renderState(_zone: HTMLElement, state: RunnerState): void {
    switch (state.status) {
      case 'idle':
      case 'at-node':
      case 'awaiting-snippet-pick':
      case 'awaiting-snippet-fill':
      case 'awaiting-loop-pick':
      case 'complete':
        // Scaffold only: concrete state renderers migrate in 75-02..75-05.
        return;
      case 'error':
        this.host.renderError([state.message]);
        return;
    }
  }

  graph(): ProtocolGraph | null {
    return this.getGraph();
  }

  unmountActivePicker(): void {
    // Scaffold no-op. SnippetTreePicker ownership moves here in 75-04.
  }
}
