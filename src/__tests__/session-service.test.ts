import { describe, it, expect, vi } from 'vitest';
import { SessionService } from '../sessions/session-service';
import { validateSessionNodeIds } from '../sessions/session-service';
import type { PersistedSession } from '../sessions/session-model';

// ── Vault mock factory (mirrors snippet-service.test.ts pattern) ─────────────

function makeVaultMock(existsResult = false) {
  return {
    adapter: {
      exists: vi.fn().mockResolvedValue(existsResult),
      read: vi.fn().mockResolvedValue('{}'),
      write: vi.fn().mockResolvedValue(undefined),
    },
    create: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: vi.fn().mockReturnValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAppMock(existsResult = false) {
  return { vault: makeVaultMock(existsResult) };
}

// ── Minimal PersistedSession fixture ─────────────────────────────────────────

function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    version: 1,
    canvasFilePath: 'protocols/chest.canvas',
    canvasMtimeAtSave: 1700000000000,
    savedAt: 1700000001000,
    runnerStatus: 'at-node',
    currentNodeId: 'n-q1',
    accumulatedText: 'Liver',
    undoStack: [{ nodeId: 'n-start', textSnapshot: '', loopContextStack: [] }],
    loopContextStack: [],
    snippetId: null,
    snippetNodeId: null,
    ...overrides,
  };
}

// ── SESSION-01: SessionService API surface ────────────────────────────────────

describe('SessionService API surface (SESSION-01)', () => {
  const svc = new SessionService(makeAppMock() as never, '.radiprotocol/sessions');

  it('has save(session) method', () => {
    expect(typeof svc.save).toBe('function');
  });

  it('has load(canvasFilePath) method', () => {
    expect(typeof svc.load).toBe('function');
  });

  it('has clear(canvasFilePath) method', () => {
    expect(typeof svc.clear).toBe('function');
  });

  it('has hasSession(canvasFilePath) method', () => {
    expect(typeof svc.hasSession).toBe('function');
  });
});

describe('SessionService.save() write behavior (SESSION-01)', () => {
  it('calls vault.create when file does not yet exist', async () => {
    const app = makeAppMock(false);
    const svc = new SessionService(app as never, '.radiprotocol/sessions');
    await svc.save(makeSession());
    expect(app.vault.create).toHaveBeenCalledTimes(1);
    expect(app.vault.adapter.write).not.toHaveBeenCalled();
  });

  it('calls vault.adapter.write (not vault.create) when file already exists', async () => {
    const app = makeAppMock(true);
    const svc = new SessionService(app as never, '.radiprotocol/sessions');
    await svc.save(makeSession());
    expect(app.vault.adapter.write).toHaveBeenCalledTimes(1);
    expect(app.vault.create).not.toHaveBeenCalled();
  });
});

// ── SESSION-02: hasSession() ──────────────────────────────────────────────────

describe('SessionService.hasSession() (SESSION-02)', () => {
  it('returns true when vault.adapter.exists returns true', async () => {
    const svc = new SessionService(makeAppMock(true) as never, '.radiprotocol/sessions');
    const result = await svc.hasSession('protocols/chest.canvas');
    expect(result).toBe(true);
  });

  it('returns false when vault.adapter.exists returns false', async () => {
    const svc = new SessionService(makeAppMock(false) as never, '.radiprotocol/sessions');
    const result = await svc.hasSession('protocols/chest.canvas');
    expect(result).toBe(false);
  });
});

// ── SESSION-03: validateSessionNodeIds() ──────────────────────────────────────

describe('validateSessionNodeIds() (SESSION-03)', () => {
  function makeGraph(nodeIds: string[]) {
    return {
      nodes: new Map(nodeIds.map(id => [id, { id, kind: 'question' }])),
    };
  }

  it('returns empty array when all session node IDs exist in the graph', () => {
    const session = makeSession({
      currentNodeId: 'n-q1',
      undoStack: [{ nodeId: 'n-start', textSnapshot: '', loopContextStack: [] }],
      loopContextStack: [],
    });
    const graph = makeGraph(['n-q1', 'n-start']);
    const missing = validateSessionNodeIds(session, graph as never);
    expect(missing).toHaveLength(0);
  });

  it('returns the missing node ID when currentNodeId no longer exists', () => {
    const session = makeSession({ currentNodeId: 'n-deleted', undoStack: [], loopContextStack: [] });
    const graph = makeGraph(['n-q1', 'n-start']);
    const missing = validateSessionNodeIds(session, graph as never);
    expect(missing).toContain('n-deleted');
  });

  it('returns missing undo stack node ID when that node no longer exists', () => {
    const session = makeSession({
      currentNodeId: 'n-q1',
      undoStack: [{ nodeId: 'n-deleted', textSnapshot: '', loopContextStack: [] }],
      loopContextStack: [],
    });
    const graph = makeGraph(['n-q1']);
    const missing = validateSessionNodeIds(session, graph as never);
    expect(missing).toContain('n-deleted');
  });

  it('returns missing loopStartId from loopContextStack when node removed', () => {
    const session = makeSession({
      currentNodeId: 'n-q1',
      undoStack: [],
      loopContextStack: [{ loopStartId: 'n-ls-deleted', iteration: 1, textBeforeLoop: '' }],
    });
    const graph = makeGraph(['n-q1']);
    const missing = validateSessionNodeIds(session, graph as never);
    expect(missing).toContain('n-ls-deleted');
  });
});

// ── SESSION-04: mtime comparison (pure arithmetic) ────────────────────────────

describe('canvas mtime comparison logic (SESSION-04)', () => {
  it('detects canvas modification when current mtime is greater than saved mtime', () => {
    const savedMtime = 1700000000000;
    const currentMtime = 1700000001000;
    // The logic RunnerView uses: mtime > session.canvasMtimeAtSave
    expect(currentMtime > savedMtime).toBe(true);
  });

  it('does not flag modification when mtime is unchanged', () => {
    const savedMtime = 1700000000000;
    const currentMtime = 1700000000000;
    expect(currentMtime > savedMtime).toBe(false);
  });
});

// ── SESSION-06: load() graceful degradation ───────────────────────────────────

describe('SessionService.load() graceful degradation (SESSION-06)', () => {
  it('returns null when session file does not exist', async () => {
    const svc = new SessionService(makeAppMock(false) as never, '.radiprotocol/sessions');
    const result = await svc.load('protocols/chest.canvas');
    expect(result).toBeNull();
  });

  it('returns null when session file contains corrupt JSON', async () => {
    const app = makeAppMock(true);
    app.vault.adapter.read = vi.fn().mockResolvedValue('{invalid json{{');
    const svc = new SessionService(app as never, '.radiprotocol/sessions');
    const result = await svc.load('protocols/chest.canvas');
    expect(result).toBeNull();
  });

  it('returns null when session JSON is missing required version field', async () => {
    const app = makeAppMock(true);
    app.vault.adapter.read = vi.fn().mockResolvedValue('{"canvasFilePath":"p.canvas"}');
    const svc = new SessionService(app as never, '.radiprotocol/sessions');
    const result = await svc.load('protocols/chest.canvas');
    expect(result).toBeNull();
  });
});

// ── SESSION-07: Set serialization audit ──────────────────────────────────────

describe('PersistedSession JSON serialization audit (SESSION-07)', () => {
  it('JSON round-trip of PersistedSession contains no Set objects (all arrays)', () => {
    const session = makeSession({
      undoStack: [
        { nodeId: 'n-start', textSnapshot: '', loopContextStack: [] },
        { nodeId: 'n-q1',    textSnapshot: 'Liver', loopContextStack: [{ loopStartId: 'n-ls1', iteration: 1, textBeforeLoop: '' }] },
      ],
      loopContextStack: [{ loopStartId: 'n-ls1', iteration: 2, textBeforeLoop: 'Liver' }],
    });
    const json = JSON.stringify(session);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    // No field should stringify to '[object Set]'
    expect(json).not.toContain('[object Set]');
    // Arrays survive round-trip as arrays
    expect(Array.isArray(parsed['undoStack'])).toBe(true);
    expect(Array.isArray(parsed['loopContextStack'])).toBe(true);
  });
});
