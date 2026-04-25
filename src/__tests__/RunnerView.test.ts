import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Phase 66 D-09: renderPreviewZone unconditionally scrolls to bottom on every render.
//
// The tests below drive renderPreviewZone directly against a fake zone+textarea fixture because
// the vitest environment is node (no jsdom) — we cannot instantiate RunnerView normally, so we
// use Object.create to bypass the constructor and stub the ItemView helper methods the code under
// test touches (registerDomEvent). See RunnerView.constructor for why full construction is blocked.
interface FakeTextareaEl {
  value: string;
  scrollTop: number;
  scrollHeight: number;
  style: { width: string; height: string };
  className: string;
}

interface FakeZone {
  createEl: (tag: string, opts?: { cls?: string }) => FakeTextareaEl;
  lastCreated: FakeTextareaEl | null;
}

function makeFakeZone(): FakeZone {
  const zone: FakeZone = {
    lastCreated: null,
    createEl(_tag: string, opts?: { cls?: string }) {
      const el: FakeTextareaEl = {
        value: '',
        scrollTop: 0,
        // Simulate a tall textarea so scrollTop=500 is within content bounds after height recompute.
        scrollHeight: 5000,
        style: { width: '', height: '' },
        className: opts?.cls ?? '',
      };
      zone.lastCreated = el;
      return el;
    },
  };
  return zone;
}

/**
 * Build a RunnerView instance without running its constructor (constructor needs a
 * real Obsidian WorkspaceLeaf + RadiProtocolPlugin, neither of which exist in the
 * node-environment vitest runner). We assign only the fields touched by
 * renderPreviewZone and stub registerDomEvent so the method runs without throwing.
 */
function makePartialView(): {
  view: RunnerView;
  callMethod: (name: string, ...args: unknown[]) => unknown;
} {
  const view = Object.create(RunnerView.prototype) as RunnerView;
  // Stub ItemView.registerDomEvent — renderPreviewZone calls it for 'input'.
  (view as unknown as { registerDomEvent: (...args: unknown[]) => void }).registerDomEvent = () => {};
  // Initialize the private fields renderPreviewZone depends on.
  (view as unknown as Record<string, unknown>)['previewTextarea'] = null;

  const callMethod = (name: string, ...args: unknown[]): unknown => {
    const fn = (view as unknown as Record<string, (...a: unknown[]) => unknown> | undefined)?.[name];
    if (typeof fn !== 'function') {
      throw new TypeError(`RunnerView has no method '${name}' (pre-plan state or typo)`);
    }
    return (fn as (this: RunnerView, ...a: unknown[]) => unknown).call(view, ...args);
  };

  return { view, callMethod };
}

describe('RunnerView D-09 — unconditional scroll-to-bottom on every render', () => {
  // vitest node environment does not define requestAnimationFrame — install a
  // synchronous polyfill so renderPreviewZone's deferred height+scroll block
  // runs inside the same tick, then tear it down to keep other suites clean.
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  beforeEach(() => {
    originalRaf = (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame;
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };
  });

  afterEach(() => {
    if (originalRaf === undefined) {
      delete (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    } else {
      (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame = originalRaf;
    }
  });

  it('Phase 66 D-09: renderPreviewZone schedules an unconditional scroll-to-bottom on requestAnimationFrame', () => {
    const { callMethod } = makePartialView();

    const zone = makeFakeZone();
    callMethod('renderPreviewZone', zone as unknown as HTMLElement, 'NEW LINE\n'.repeat(200));

    const created = zone.lastCreated;
    expect(created).not.toBeNull();
    // After D-09: the new textarea ALWAYS scrolls to BOTTOM so the freshly
    // inserted content is visible — matches scrollHeight exactly.
    expect(created!.scrollTop).toBe(created!.scrollHeight);
  });
});
