// src/__tests__/edge-label-sync-service.test.ts
// Phase 63 Plan 02 — RED tests for EdgeLabelSyncService dispatch contract,
// node-text snapshot diff (EDITOR-05), and snapshot cleanup (T-02 leak prevention).
//
// Tests drive the service via `(service as any).reconcile(filePath)` directly,
// bypassing the vault.on('modify') TFile-instanceof gate (per 63-PATTERNS.md
// "Gotcha" line 767). The setup mirrors canvas-write-back.test.ts:206-244
// (mockApp + saveLiveBatch spy) and edge-label-reconciler.test.ts:12-13
// (fixture loader pattern).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EdgeLabelSyncService } from '../canvas/edge-label-sync-service';
import type { CanvasChangedForNodeDetail } from '../canvas/edge-label-sync-service';

vi.mock('obsidian');

const fixturesDir = path.join(__dirname, 'fixtures');
const loadFixture = (n: string) => fs.readFileSync(path.join(fixturesDir, n), 'utf-8');

interface BuildServiceResult {
  service: EdgeLabelSyncService;
  saveLiveBatchSpy: ReturnType<typeof vi.fn>;
  vaultModifySpy: ReturnType<typeof vi.fn>;
  registerEventSpy: ReturnType<typeof vi.fn>;
  vaultHandlers: Map<string, (file: unknown, oldPath?: string) => void>;
  setCanvas: (next: string) => void;
}

function buildService(initialCanvasContent: string): BuildServiceResult {
  let currentContent = initialCanvasContent;
  const vaultHandlers = new Map<string, (file: unknown, oldPath?: string) => void>();
  const saveLiveBatchSpy = vi.fn().mockResolvedValue(true);
  const vaultModifySpy = vi.fn().mockResolvedValue(undefined);
  const registerEventSpy = vi.fn((ref: unknown) => ref);
  const mockApp = {
    vault: {
      on: (event: string, handler: (file: unknown, oldPath?: string) => void) => {
        vaultHandlers.set(event, handler);
        return { event };
      },
      getAbstractFileByPath: (_p: string) => ({ path: 'test.canvas' }), // not actually used (live JSON path wins)
      read: vi.fn().mockImplementation(() => Promise.resolve(currentContent)),
      modify: vaultModifySpy,
    },
  };
  const mockPlugin = {
    app: mockApp,
    canvasLiveEditor: {
      getCanvasJSON: (_p: string) => currentContent,
      saveLiveBatch: saveLiveBatchSpy,
    },
    registerEvent: registerEventSpy,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new EdgeLabelSyncService(mockApp as any, mockPlugin as any);
  service.register();
  return {
    service,
    saveLiveBatchSpy,
    vaultModifySpy,
    registerEventSpy,
    vaultHandlers,
    setCanvas: (next: string) => {
      currentContent = next;
    },
  };
}

// Helper for inline canvas JSON construction in snapshot-diff tests.
function makeCanvas(opts: {
  nodes: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
}): string {
  return JSON.stringify({
    nodes: opts.nodes,
    edges: opts.edges ?? [],
  });
}

// Standard skeleton for a Question→Snippet branch (used in dispatch / snapshot tests).
function questionSnippetCanvas(opts: {
  questionText?: string;
  snippetLabel?: string;
  edgeLabel?: string;
  questionKind?: 'question' | 'answer';
  includeQuestion?: boolean;
}): string {
  const includeQuestion = opts.includeQuestion ?? true;
  const nodes: Array<Record<string, unknown>> = [
    {
      id: 'n-start',
      type: 'text',
      text: 'Start',
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      radiprotocol_nodeType: 'start',
    },
  ];
  if (includeQuestion) {
    nodes.push({
      id: 'n-q1',
      type: 'text',
      text: opts.questionText ?? 'Q1',
      x: 0,
      y: 120,
      width: 200,
      height: 60,
      radiprotocol_nodeType: opts.questionKind ?? 'question',
      ...(opts.questionKind === 'answer'
        ? { radiprotocol_answerText: opts.questionText ?? 'A1', radiprotocol_displayLabel: 'X' }
        : { radiprotocol_questionText: opts.questionText ?? 'Q1' }),
    });
  }
  nodes.push({
    id: 'n-snip1',
    type: 'text',
    text: 'abdomen',
    x: 0,
    y: 240,
    width: 200,
    height: 60,
    radiprotocol_nodeType: 'snippet',
    radiprotocol_subfolderPath: 'abdomen',
    ...(opts.snippetLabel !== undefined ? { radiprotocol_snippetLabel: opts.snippetLabel } : {}),
  });
  const edges: Array<Record<string, unknown>> = [
    { id: 'e0', fromNode: 'n-start', toNode: 'n-q1' },
  ];
  if (includeQuestion) {
    edges.push({
      id: 'e1',
      fromNode: 'n-q1',
      toNode: 'n-snip1',
      ...(opts.edgeLabel !== undefined ? { label: opts.edgeLabel } : {}),
    });
  }
  return makeCanvas({ nodes, edges });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('EdgeLabelSyncService — dispatch contract (Phase 63 D-12)', () => {
  it('dispatches canvas-changed-for-node after reconcile produces edge diffs (regression: Phase 50 displayLabel)', async () => {
    const { service } = buildService(loadFixture('displayLabel-edge-mismatch.canvas'));
    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    // Phase 50 fixture: Answer n-a1 has displayLabel='X', edge has label='Y' → edge wins.
    // Reconciler emits a NodeLabelChange (nodeId='n-a1', newLabel='Y', kind='answer').
    // Service routes it to radiprotocol_displayLabel in fieldUpdates.
    const displayDispatch = calls.find(
      (c) => c.fieldUpdates?.['radiprotocol_displayLabel'] === 'Y',
    );
    expect(displayDispatch).toBeDefined();
    expect(displayDispatch!.nodeId).toBe('n-a1');
    expect(displayDispatch!.changeKind).toBe('fields');
  });

  it('does not dispatch when reconcile is a no-op (D-07 idempotency short-circuit)', async () => {
    // Canvas where every edge label already matches the corresponding displayLabel.
    const inSync = makeCanvas({
      nodes: [
        {
          id: 'n-start', type: 'text', text: 'Start',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'start',
        },
        {
          id: 'n-q1', type: 'text', text: 'Q1',
          x: 0, y: 120, width: 200, height: 60,
          radiprotocol_nodeType: 'question',
          radiprotocol_questionText: 'Q1',
        },
        {
          id: 'n-a1', type: 'text', text: 'A1',
          x: 0, y: 240, width: 200, height: 60,
          radiprotocol_nodeType: 'answer',
          radiprotocol_answerText: 'A1',
          radiprotocol_displayLabel: 'Same',
        },
      ],
      edges: [
        { id: 'e0', fromNode: 'n-start', toNode: 'n-q1' },
        { id: 'e1', fromNode: 'n-q1', toNode: 'n-a1', label: 'Same' },
      ],
    });
    const { service, setCanvas } = buildService(inSync);
    // Seed snapshot with first pass (no subscriber yet).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    // Subscribe and run a second pass with byte-identical content — must not dispatch.
    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));
    setCanvas(inSync); // explicit no-op; setCanvas is for clarity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    expect(calls).toHaveLength(0);
  });

  it('routes snippet-kind nodeChanges to radiprotocol_snippetLabel in fieldUpdates', async () => {
    // Cold-open fixture: snippet has label "Брюшной отдел", incoming edge has no label.
    // Reconciler emits ONE EdgeLabelDiff (kind='snippet') propagating node-side onto edge,
    // and ZERO nodeChanges (because edgePick is undefined → falls back to snippetTrim → no diff).
    // Hence the dispatch is on the snapshot path: first-pass seeds, no field dispatch fires
    // for snippetLabel (it didn't change). To exercise the snippet routing we need a canvas
    // where the EDGE has a label and the NODE has a different label → reconciler emits
    // nodeChange (kind='snippet') routed to radiprotocol_snippetLabel.
    const snippetDiverged = questionSnippetCanvas({
      snippetLabel: 'Старое',
      edgeLabel: 'Новое',
    });
    const { service } = buildService(snippetDiverged);
    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const snippetDispatch = calls.find(
      (c) => c.fieldUpdates?.['radiprotocol_snippetLabel'] !== undefined,
    );
    expect(snippetDispatch).toBeDefined();
    expect(snippetDispatch!.nodeId).toBe('n-snip1');
    expect(snippetDispatch!.fieldUpdates!['radiprotocol_snippetLabel']).toBe('Новое');
    // Phase 63 routing invariant: snippet kind MUST NOT bleed into displayLabel.
    expect(snippetDispatch!.fieldUpdates!['radiprotocol_displayLabel']).toBeUndefined();
  });
});

describe('EdgeLabelSyncService — node-text snapshot (Phase 63 EDITOR-05)', () => {
  it('detects questionText change between two reconcile passes and dispatches', async () => {
    const pass1 = questionSnippetCanvas({ questionText: 'Q1' });
    const { service, setCanvas } = buildService(pass1);
    // Seed snapshot silently (subscribe AFTER pass-1).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(questionSnippetCanvas({ questionText: 'Q1 edited' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find(
      (c) => c.changeKind === 'fields' && c.nodeId === 'n-q1',
    );
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_questionText']).toBe('Q1 edited');
  });

  it('does not dispatch when no fields changed since last snapshot', async () => {
    const content = questionSnippetCanvas({ questionText: 'Stable' });
    const { service } = buildService(content);
    // Pass 1 — seed snapshot. No subscriber.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    // Pass 2 — byte-identical content; ZERO dispatches expected.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    expect(calls).toHaveLength(0);
  });

  it('detects nodeType change → dispatches changeKind:"nodeType"', async () => {
    // Pass-1: n-q1 is a question. Pass-2: n-q1 becomes an answer.
    const pass1 = questionSnippetCanvas({ questionText: 'Q1', questionKind: 'question' });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(questionSnippetCanvas({ questionText: 'Q1', questionKind: 'answer' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const nodeTypeDispatch = calls.find(
      (c) => c.changeKind === 'nodeType' && c.nodeId === 'n-q1',
    );
    expect(nodeTypeDispatch).toBeDefined();
    expect(nodeTypeDispatch!.newKind).toBe('answer');
  });

  it('detects node deletion → dispatches changeKind:"deleted"', async () => {
    // Pass-1 includes n-q1; pass-2 omits it.
    const pass1 = questionSnippetCanvas({ questionText: 'Q1', includeQuestion: true });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(questionSnippetCanvas({ includeQuestion: false }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const deletionDispatch = calls.find(
      (c) => c.changeKind === 'deleted' && c.nodeId === 'n-q1',
    );
    expect(deletionDispatch).toBeDefined();
  });
});

describe('EdgeLabelSyncService — snapshot cleanup (Phase 63 T-02 leak prevention)', () => {
  it('removes snapshot for filePath when vault.on("rename") fires (old → new)', async () => {
    const { service, vaultHandlers } = buildService(questionSnippetCanvas({ questionText: 'Q1' }));
    // Seed snapshot for 'test.canvas'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');
    // Manually inject snapshot under 'old.canvas' so we can prove rename purges it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastSnapshotByFilePath.set('old.canvas', new Map());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).lastSnapshotByFilePath.has('old.canvas')).toBe(true);

    const renameHandler = vaultHandlers.get('rename');
    expect(renameHandler).toBeDefined();
    renameHandler!({ path: 'new.canvas' }, 'old.canvas');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).lastSnapshotByFilePath.has('old.canvas')).toBe(false);
  });

  it('removes snapshot for filePath when vault.on("delete") fires', async () => {
    const { service, vaultHandlers } = buildService(questionSnippetCanvas({ questionText: 'Q1' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastSnapshotByFilePath.set('doomed.canvas', new Map());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).lastSnapshotByFilePath.has('doomed.canvas')).toBe(true);

    const deleteHandler = vaultHandlers.get('delete');
    expect(deleteHandler).toBeDefined();
    deleteHandler!({ path: 'doomed.canvas' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).lastSnapshotByFilePath.has('doomed.canvas')).toBe(false);
  });

  it('destroy() clears all snapshots and timers (T-02 leak prevention)', () => {
    const { service } = buildService(questionSnippetCanvas({ questionText: 'Q1' }));
    // Seed two snapshot entries.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastSnapshotByFilePath.set('a.canvas', new Map());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).lastSnapshotByFilePath.set('b.canvas', new Map());
    // Seed a debounce timer too.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).debounceTimers.set('a.canvas', setTimeout(() => {}, 10000));

    service.destroy();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).lastSnapshotByFilePath.size).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).debounceTimers.size).toBe(0);
  });
});

describe('Gap 2 — inbound text diff dispatch', () => {
  it('Question text diff: dispatches radiprotocol_questionText when only text changes', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-q1', type: 'text', text: 'Old',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'question',
          radiprotocol_questionText: 'Old',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-q1', type: 'text', text: 'New',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'question',
          radiprotocol_questionText: 'Old',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-q1');
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_questionText']).toBe('New');
  });

  it('No duplicate dispatch when both text and radiprotocol_questionText change', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-q1', type: 'text', text: 'Old',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'question',
          radiprotocol_questionText: 'Old',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-q1', type: 'text', text: 'New',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'question',
          radiprotocol_questionText: 'New',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-q1');
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_questionText']).toBe('New');
    // Only one fields dispatch — not duplicated.
    expect(calls.filter((c) => c.changeKind === 'fields' && c.nodeId === 'n-q1').length).toBe(1);
  });

  it('Snippet text changes are ignored (no dispatch)', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-snip', type: 'text', text: 'abdomen',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'snippet',
          radiprotocol_subfolderPath: 'abdomen',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-snip', type: 'text', text: 'chest',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'snippet',
          radiprotocol_subfolderPath: 'abdomen',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-snip');
    expect(fieldDispatch).toBeUndefined();
  });

  it('Answer text diff: dispatches radiprotocol_answerText when only text changes', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-a1', type: 'text', text: 'Old',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'answer',
          radiprotocol_answerText: 'Old',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-a1', type: 'text', text: 'New',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'answer',
          radiprotocol_answerText: 'Old',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-a1');
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_answerText']).toBe('New');
  });

  it('Text-block content diff: dispatches radiprotocol_content when only text changes', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-tb', type: 'text', text: 'Old',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'text-block',
          radiprotocol_content: 'Old',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-tb', type: 'text', text: 'New',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'text-block',
          radiprotocol_content: 'Old',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-tb');
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_content']).toBe('New');
  });

  it('Loop headerText diff: dispatches radiprotocol_headerText when only text changes', async () => {
    const pass1 = makeCanvas({
      nodes: [
        {
          id: 'n-loop', type: 'text', text: 'Old',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'loop',
          radiprotocol_headerText: 'Old',
        },
      ],
    });
    const { service, setCanvas } = buildService(pass1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const calls: CanvasChangedForNodeDetail[] = [];
    service.subscribe((detail) => calls.push(detail));

    setCanvas(makeCanvas({
      nodes: [
        {
          id: 'n-loop', type: 'text', text: 'New',
          x: 0, y: 0, width: 200, height: 60,
          radiprotocol_nodeType: 'loop',
          radiprotocol_headerText: 'Old',
        },
      ],
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).reconcile('test.canvas');

    const fieldDispatch = calls.find((c) => c.changeKind === 'fields' && c.nodeId === 'n-loop');
    expect(fieldDispatch).toBeDefined();
    expect(fieldDispatch!.fieldUpdates!['radiprotocol_headerText']).toBe('New');
  });
});
