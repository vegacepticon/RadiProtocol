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

// Phase 47 Plan 02 — RUNFIX-02: preserving textarea scroll through the choice-click re-render.
//
// The bug: clicking a choice button calls renderAsync → render → contentEl.empty() → renderPreviewZone,
// which creates a BRAND-NEW <textarea> whose scrollTop defaults to 0 — so long reports snap to the top
// on every click. Fix (in runner-view.ts):
//   1. New private field `pendingTextareaScrollTop: number | null = null`.
//   2. New private helper `capturePendingTextareaScroll()` reads previewTextarea.scrollTop into it.
//   3. Each choice click handler calls capturePendingTextareaScroll() as its FIRST line (before
//      the existing syncManualEdit call) so the value is stashed on `this` BEFORE render() nulls
//      out previewTextarea.
//   4. renderPreviewZone's existing rAF callback, after recomputing height, restores the scrollTop
//      onto the new textarea and nulls the pending field (consume exactly once).
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
  getField: <T>(name: string) => T;
  setField: (name: string, value: unknown) => void;
  callMethod: (name: string, ...args: unknown[]) => unknown;
} {
  const view = Object.create(RunnerView.prototype) as RunnerView;
  // Stub ItemView.registerDomEvent — renderPreviewZone calls it for 'input'.
  (view as unknown as { registerDomEvent: (...args: unknown[]) => void }).registerDomEvent = () => {};
  // Initialize the private fields renderPreviewZone depends on.
  (view as unknown as Record<string, unknown>)['previewTextarea'] = null;
  (view as unknown as Record<string, unknown>)['pendingTextareaScrollTop'] = null;

  const getField = <T,>(name: string): T =>
    (view as unknown as Record<string, unknown>)[name] as T;
  const setField = (name: string, value: unknown): void => {
    (view as unknown as Record<string, unknown>)[name] = value;
  };
  const callMethod = (name: string, ...args: unknown[]): unknown => {
    const fn = (view as unknown as Record<string, (...a: unknown[]) => unknown> | undefined)?.[name];
    if (typeof fn !== 'function') {
      throw new TypeError(`RunnerView has no method '${name}' (pre-plan state or typo)`);
    }
    return (fn as (this: RunnerView, ...a: unknown[]) => unknown).call(view, ...args);
  };

  return { view, getField, setField, callMethod };
}

describe('RunnerView RUNFIX-02 — choice click preserves textarea scroll', () => {
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

  it('RUNFIX-02: pendingTextareaScrollTop field exists and defaults to null', () => {
    const { getField } = makePartialView();
    expect(getField('pendingTextareaScrollTop')).toBeNull();
  });

  it('RUNFIX-02: capturePendingTextareaScroll helper copies previewTextarea.scrollTop into the pending field', () => {
    const { setField, getField, callMethod } = makePartialView();
    // Simulate a user having scrolled the current textarea to 500.
    setField('previewTextarea', { scrollTop: 500, value: 'anything' } as unknown as HTMLTextAreaElement);
    callMethod('capturePendingTextareaScroll');
    expect(getField('pendingTextareaScrollTop')).toBe(500);
  });

  it('RUNFIX-02: renderPreviewZone restores pending scrollTop onto the new textarea and consumes it (clears to null)', () => {
    const { getField, setField, callMethod } = makePartialView();

    // Pretend a choice handler already captured the pre-click scroll.
    setField('pendingTextareaScrollTop', 500);

    const zone = makeFakeZone();
    callMethod('renderPreviewZone', zone as unknown as HTMLElement, 'NEW LINE\n'.repeat(200));

    const created = zone.lastCreated;
    expect(created).not.toBeNull();
    // Preserved (or advanced) — never reset to 0 when tall content remains.
    expect(created!.scrollTop).toBeGreaterThanOrEqual(500);
    // Consumed once — stale pending value must not leak into a later unrelated render.
    expect(getField('pendingTextareaScrollTop')).toBeNull();
  });

  it('RUNFIX-02: renderPreviewZone leaves scrollTop=0 on the new textarea when no capture occurred (no leak)', () => {
    const { callMethod } = makePartialView();

    const zone = makeFakeZone();
    callMethod('renderPreviewZone', zone as unknown as HTMLElement, 'text\n'.repeat(10));

    const created = zone.lastCreated;
    expect(created).not.toBeNull();
    // No pending capture → textarea keeps its default scrollTop (0).
    expect(created!.scrollTop).toBe(0);
  });

  it('RUNFIX-02: end-to-end capture → re-render → restore flow keeps scroll across a simulated choice click', () => {
    const { view, getField, setField, callMethod } = makePartialView();

    // First render: build initial textarea.
    const zone1 = makeFakeZone();
    callMethod('renderPreviewZone', zone1 as unknown as HTMLElement, 'LINE\n'.repeat(200));
    const first = zone1.lastCreated;
    expect(first).not.toBeNull();
    // After first render, previewTextarea points at the first fake element.
    expect(getField<FakeTextareaEl | null>('previewTextarea')).toBe(first);

    // User scrolls it.
    first!.scrollTop = 500;

    // Simulate a choice-button click: FIRST line of handler captures pending scroll.
    callMethod('capturePendingTextareaScroll');
    expect(getField('pendingTextareaScrollTop')).toBe(500);

    // render() would null previewTextarea before rebuilding — mirror that.
    setField('previewTextarea', null);

    // Second render: fresh textarea from renderPreviewZone.
    const zone2 = makeFakeZone();
    callMethod('renderPreviewZone', zone2 as unknown as HTMLElement, 'NEW\n'.repeat(200));
    const second = zone2.lastCreated;
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);

    // Load-bearing invariant: new textarea keeps (or exceeds) pre-click scroll.
    expect(second!.scrollTop).toBeGreaterThanOrEqual(500);
    // Pending field consumed.
    expect(getField('pendingTextareaScrollTop')).toBeNull();

    // Silence unused-var lint on `view`.
    void view;
  });
});
