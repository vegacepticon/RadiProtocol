import { describe, it, expect, vi } from 'vitest';
import { RunnerView, RUNNER_VIEW_TYPE } from '../views/runner-view';
import { TFile } from 'obsidian';
import { CanvasParser } from '../graph/canvas-parser';
import type { PersistedSession } from '../sessions/session-model';

// Mock obsidian — RunnerView imports ItemView, WorkspaceLeaf, TFile, Notice, etc.
vi.mock('obsidian');

// Mock ResumeSessionModal so openCanvas() doesn't hang waiting for user input.
// The mock immediately resolves to 'resume' so the current (pre-Plan-03) code
// calls runner.restoreFrom(session) with the awaiting-snippet-fill session.
// After Plan 03 adds the degradation guard, the guard fires BEFORE the modal
// (discarding the session and calling clear()), so the mock's resolution value
// is irrelevant in the post-guard world.
vi.mock('../views/resume-session-modal', () => ({
  ResumeSessionModal: class {
    result: Promise<'resume' | 'start-over'> = Promise.resolve('resume' as const);
    open() {}
    close() {}
  },
}));

// Mock CanvasSelectorWidget and CanvasSwitchModal — not needed for openCanvas tests.
vi.mock('../views/canvas-selector-widget', () => ({
  CanvasSelectorWidget: class {
    setSelectedPath() {}
    rebuildIfOpen() {}
  },
}));
vi.mock('../views/canvas-switch-modal', () => ({
  CanvasSwitchModal: class {
    open() {}
  },
}));
// Mock SnippetFillInModal — not needed for these tests.
vi.mock('../views/snippet-fill-in-modal', () => ({
  SnippetFillInModal: class {
    open() {}
  },
}));

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

describe('NTYPE-04 — legacy awaiting-snippet-fill session degradation', () => {
  it('starts a fresh session when loaded session has runnerStatus "awaiting-snippet-fill"', async () => {
    // After Plan 03 adds the degradation guard to openCanvas(), this passes.
    // Currently fails because openCanvas() restores the awaiting-snippet-fill session
    // via runner.restoreFrom(), causing the runner to end up in awaiting-snippet-fill
    // state (which no longer exists after Plan 02 removes it), or the runner is left
    // in an unexpected state. The test asserts clear() was called and runner is at-node.
    //
    // Canvas JSON with a valid graph: start → question → answer (terminal).
    // The graph validator requires questions to have at least one outgoing edge.
    const canvasJson = JSON.stringify({
      nodes: [
        { id: 'n-start', type: 'text', text: '', x: 0, y: 0, width: 200, height: 60, radiprotocol_nodeType: 'start' },
        { id: 'n-q1', type: 'text', text: 'Q?', x: 0, y: 120, width: 200, height: 60, radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Q?' },
        { id: 'n-a1', type: 'text', text: 'A1', x: 0, y: 240, width: 200, height: 60, radiprotocol_nodeType: 'answer', radiprotocol_answerText: 'Answer 1' },
      ],
      edges: [
        { id: 'e1', fromNode: 'n-start', toNode: 'n-q1' },
        { id: 'e2', fromNode: 'n-q1', toNode: 'n-a1' },
      ],
    });

    // Legacy session saved when runner was in awaiting-snippet-fill state
    // Cast to PersistedSession to simulate a pre-migration session with the old status value
    const legacySession = {
      version: 1,
      canvasFilePath: 'test.canvas',
      canvasMtimeAtSave: 0,
      savedAt: Date.now(),
      runnerStatus: 'awaiting-snippet-fill' as 'at-node', // legacy value — cast for test simulation
      currentNodeId: 'n-q1',
      accumulatedText: 'some text',
      undoStack: [],
      loopContextStack: [],
    } as PersistedSession;

    const clearSpy = vi.fn().mockResolvedValue(undefined);

    // Build a minimal plugin mock that satisfies openCanvas() needs
    const mockPlugin = {
      settings: { textSeparator: 'newline' },
      sessionService: {
        load: vi.fn().mockResolvedValue(legacySession),
        clear: clearSpy,
        save: vi.fn().mockResolvedValue(undefined),
      },
      snippetService: {
        load: vi.fn().mockResolvedValue(null),
      },
      canvasParser: {
        parse: (json: string, path: string) => new CanvasParser().parse(json, path),
      },
      canvasLiveEditor: {
        getCanvasJSON: vi.fn().mockReturnValue(canvasJson),
      },
      app: {
        vault: {
          getAbstractFileByPath: vi.fn().mockReturnValue(Object.assign(new (TFile as unknown as new (p: string) => TFile)('test.canvas'), { stat: { mtime: 0 } })),
          read: vi.fn().mockResolvedValue(canvasJson),
        },
        workspace: {
          getLeavesOfType: vi.fn().mockReturnValue([]),
          onLayoutReady: vi.fn((cb: () => void) => cb()),
          on: vi.fn(),
        },
      },
    };

    // Construct a minimal WorkspaceLeaf mock
    const mockLeaf = {
      containerEl: {
        createEl: () => mockLeaf.containerEl,
        createDiv: () => mockLeaf.containerEl,
        empty: () => {},
        setText: () => {},
      },
    };

    const view = new RunnerView(
      mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
      mockPlugin as unknown as import('../main').default,
    );

    // Inject app onto the view — the mock ItemView constructor doesn't set this.app
    // (real Obsidian sets it from the component registry), so we set it directly.
    (view as unknown as { app: typeof mockPlugin.app }).app = mockPlugin.app;

    // Inject Component methods not on the mock ItemView (from Obsidian's Component base class)
    const viewAny = view as unknown as Record<string, unknown>;
    viewAny['registerDomEvent'] = () => {};
    viewAny['registerEvent'] = () => {};
    viewAny['register'] = () => {};

    // Inject a recursive mock contentEl so render() / renderError() DOM calls don't throw.
    // render() builds a deep tree via createDiv/createEl chains — the mock must be self-referential.
    function makeMockDomEl(): Record<string, unknown> {
      const el: Record<string, unknown> = {
        empty: () => {},
        setText: () => {},
        addClass: () => {},
        removeClass: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: () => {},
        insertBefore: () => {},
        style: {},
        value: '',
        rows: 2,
        disabled: false,
      };
      el['createDiv'] = (_opts?: unknown) => makeMockDomEl();
      el['createEl'] = (_tag: string, _opts?: unknown) => makeMockDomEl();
      return el;
    }
    (view as unknown as { contentEl: unknown }).contentEl = makeMockDomEl();

    // Stub requestAnimationFrame — not available in Node test environment
    const rafStub = (cb: FrameRequestCallback) => { cb(0); return 0; };
    (globalThis as unknown as Record<string, unknown>)['requestAnimationFrame'] = rafStub;

    // Call openCanvas — loads the legacy session
    await view.openCanvas('test.canvas');

    // Assert: the legacy awaiting-snippet-fill session was discarded
    expect(clearSpy).toHaveBeenCalledWith('test.canvas');

    // Assert: runner ends up in at-node state (fresh start at n-q1), not awaiting-snippet-fill
    const runner = (view as unknown as { runner: { getState(): { status: string } } }).runner;
    const state = runner.getState();
    expect(state.status).toBe('at-node');
  });
});
