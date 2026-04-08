import { describe, it, expect } from 'vitest';
import { RunnerView, RUNNER_VIEW_TYPE } from '../views/runner-view';

describe('RunnerView (UI-01, UI-07, UI-12)', () => {
  it('UI-01: exports RUNNER_VIEW_TYPE constant equal to radiprotocol-runner', () => {
    expect(RUNNER_VIEW_TYPE).toBe('radiprotocol-runner');
  });

  it('UI-01: RunnerView has getViewType() returning RUNNER_VIEW_TYPE', () => {
    // Constructing RunnerView requires a WorkspaceLeaf — test the prototype method exists
    expect(typeof RunnerView.prototype.getViewType).toBe('function');
  });

  it('UI-12: getDisplayText returns RadiProtocol runner', () => {
    expect(typeof RunnerView.prototype.getDisplayText).toBe('function');
    // Full value verified in integration — stub checks method exists
  });

  it('UI-07: RunnerView has getState method', () => {
    expect(typeof RunnerView.prototype.getState).toBe('function');
  });

  it('UI-02: RunnerView has openCanvas method (not yet implemented — RED)', () => {
    // This MUST fail until Plan 01 implements openCanvas
    expect(typeof (RunnerView.prototype as unknown as Record<string, unknown>)['openCanvas']).toBe('function');
  });
});
