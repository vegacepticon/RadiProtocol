// src/__tests__/canvas-live-editor.test.ts
// TDD: RED phase tests for getCanvasJSON() and live-data path in openCanvas()
// Plan 17-01: BUG-02, BUG-03 — live canvas read-back for runner

import { describe, it, expect, vi } from 'vitest';
import { CanvasLiveEditor } from '../canvas/canvas-live-editor';
import { RunnerView } from '../views/runner-view';
import type { App } from 'obsidian';
import type { CanvasData } from '../types/canvas-internal';

vi.mock('obsidian');

// ── Helper: build a realistic CanvasData payload ─────────────────────────────
function makeFakeData(): CanvasData {
  return {
    nodes: [
      {
        id: 'n1',
        radiprotocol_nodeType: 'question',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        type: 'text',
      },
    ],
    edges: [],
  };
}

// ── Helper: build a fake canvas leaf ─────────────────────────────────────────
function makeLeafWithData(filePath: string, fakeData: CanvasData) {
  const fakeView = {
    file: { path: filePath },
    canvas: {
      getData: vi.fn().mockReturnValue(fakeData),
      setData: vi.fn(),
      requestSave: vi.fn(),
    },
  };
  return { view: fakeView };
}

// ── Describe: getCanvasJSON() ─────────────────────────────────────────────────
describe('CanvasLiveEditor.getCanvasJSON()', () => {
  it('Test 1: returns JSON.stringify(getData()) when canvas view is open for filePath', () => {
    const fakeData = makeFakeData();
    const fakeLeaf = makeLeafWithData('test.canvas', fakeData);

    const mockApp = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([fakeLeaf]),
      },
    };

    const editor = new CanvasLiveEditor(mockApp as unknown as App);
    const result = editor.getCanvasJSON('test.canvas');

    expect(result).toBe(JSON.stringify(fakeData));
  });

  it('Test 2: returns null when no canvas leaf is open for the given filePath', () => {
    const mockApp = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([]),
      },
    };

    const editor = new CanvasLiveEditor(mockApp as unknown as App);
    const result = editor.getCanvasJSON('other.canvas');

    expect(result).toBeNull();
  });

  it('Test 3: returns null when canvas view exists but getData is not a function (API absent)', () => {
    const fakeView = {
      file: { path: 'test.canvas' },
      canvas: {
        // getData is NOT a function — simulates internal API absence
        getData: 'not-a-function',
        setData: vi.fn(),
        requestSave: vi.fn(),
      },
    };
    const fakeLeaf = { view: fakeView };

    const mockApp = {
      workspace: {
        getLeavesOfType: vi.fn().mockReturnValue([fakeLeaf]),
      },
    };

    const editor = new CanvasLiveEditor(mockApp as unknown as App);
    const result = editor.getCanvasJSON('test.canvas');

    expect(result).toBeNull();
  });
});

// ── Describe: RunnerView.openCanvas() structural contract ────────────────────
describe('RunnerView.openCanvas() live-data contract (BUG-02, BUG-03)', () => {
  it('Test 4: RunnerView.prototype.openCanvas exists (regression guard for live-data integration)', () => {
    // Structural check: openCanvas() method must exist on RunnerView prototype.
    // The method body is updated in Task 2 to call getCanvasJSON() before vault.read().
    // Integration is verified via UAT; this guards against accidental removal of the method.
    expect(typeof (RunnerView.prototype as unknown as Record<string, unknown>)['openCanvas']).toBe('function');
  });
});
