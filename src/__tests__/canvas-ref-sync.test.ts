import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rewriteCanvasRefs } from '../snippets/canvas-ref-sync';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Mock App backed by an in-memory map of canvas files. vault.getFiles returns
// TFile-ish objects carrying `extension`/`path`; vault.read/modify operate on
// the shared `files` record so tests can observe writes.
// ---------------------------------------------------------------------------

interface MockApp {
  app: import('obsidian').App;
  writes: Record<string, string>;
  files: Record<string, string>;
  readSpy: ReturnType<typeof vi.fn>;
  modifySpy: ReturnType<typeof vi.fn>;
}

function makeApp(files: Record<string, string>): MockApp {
  const writes: Record<string, string> = {};
  const workingFiles = { ...files };
  const makeTFile = (p: string) => ({
    path: p,
    extension: p.split('.').pop() ?? '',
    basename: (p.split('/').pop() ?? '').replace(/\.[^.]+$/, ''),
  });
  const readSpy = vi.fn(async (f: { path: string }) => {
    if (!(f.path in workingFiles)) throw new Error('ENOENT: ' + f.path);
    return workingFiles[f.path];
  });
  const modifySpy = vi.fn(async (f: { path: string }, data: string) => {
    writes[f.path] = data;
    workingFiles[f.path] = data;
  });
  return {
    app: {
      vault: {
        getFiles: () => Object.keys(workingFiles).map(makeTFile),
        read: readSpy,
        modify: modifySpy,
        getAbstractFileByPath: (p: string) =>
          p in workingFiles ? makeTFile(p) : null,
      },
    } as unknown as import('obsidian').App,
    writes,
    files: workingFiles,
    readSpy,
    modifySpy,
  };
}

function loadFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, 'fixtures', name),
    'utf-8',
  );
}

describe('rewriteCanvasRefs', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('meta-check: broken fixture is genuinely invalid JSON', () => {
    const raw = loadFixture('snippet-node-broken.canvas');
    expect(() => JSON.parse(raw)).toThrow();
  });

  it('exact-match rename rewrites subfolderPath', async () => {
    const canvasPath = 'protocols/a.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-a.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated).toEqual([canvasPath]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(app.writes[canvasPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    const snippetNode = parsed.nodes.find(
      (n) => n['radiprotocol_nodeType'] === 'snippet',
    )!;
    expect(snippetNode['radiprotocol_subfolderPath']).toBe('a/c');
  });

  it('prefix folder-move rewrites nested paths with / boundary', async () => {
    const canvasPath = 'protocols/b.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-b.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated).toEqual([canvasPath]);
    const parsed = JSON.parse(app.writes[canvasPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    const prefix = parsed.nodes.find((n) => n['id'] === 's-prefix')!;
    expect(prefix['radiprotocol_subfolderPath']).toBe('a/c/sub');
  });

  it('WR-02: empty-string subfolderPath is preserved (not rewritten)', async () => {
    const canvasPath = 'protocols/b.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-b.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    await rewriteCanvasRefs(app.app, mapping);

    const parsed = JSON.parse(app.writes[canvasPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    const rootNode = parsed.nodes.find((n) => n['id'] === 's-root')!;
    expect(rootNode['radiprotocol_subfolderPath']).toBe('');
  });

  it('no mapping hit leaves canvas untouched (no vault.modify)', async () => {
    const canvasPath = 'protocols/a.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-a.canvas'),
    });
    const mapping = new Map<string, string>([['zzz', 'yyy']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
  });

  it('no-op early return for canvas without snippet nodes', async () => {
    const canvasPath = 'protocols/no-snippets.canvas';
    const app = makeApp({
      [canvasPath]: JSON.stringify({
        nodes: [
          {
            id: 'q1',
            radiprotocol_nodeType: 'question',
            text: 'Do you agree?',
          },
        ],
        edges: [],
      }),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
  });

  it('best-effort: broken JSON canvas is skipped with reason, others processed', async () => {
    const brokenPath = 'protocols/broken.canvas';
    const goodPath = 'protocols/good.canvas';
    const app = makeApp({
      [brokenPath]: loadFixture('snippet-node-broken.canvas'),
      [goodPath]: loadFixture('snippet-node-multi-a.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    // Broken was skipped with a JSON-related reason
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.path).toBe(brokenPath);
    expect(result.skipped[0]!.reason).toMatch(/JSON|invalid/i);
    // Good canvas still processed
    expect(result.updated).toEqual([goodPath]);
    expect(app.writes[goodPath]).toBeDefined();
  });

  it('multi-canvas updates both files in one pass', async () => {
    const aPath = 'protocols/a.canvas';
    const bPath = 'protocols/b.canvas';
    const app = makeApp({
      [aPath]: loadFixture('snippet-node-multi-a.canvas'),
      [bPath]: loadFixture('snippet-node-multi-b.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated.sort()).toEqual([aPath, bPath].sort());
    expect(app.modifySpy).toHaveBeenCalledTimes(2);
    // Exact-match fixture A → a/c
    const parsedA = JSON.parse(app.writes[aPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    expect(
      parsedA.nodes.find((n) => n['radiprotocol_nodeType'] === 'snippet')![
        'radiprotocol_subfolderPath'
      ],
    ).toBe('a/c');
    // Prefix-match fixture B → a/c/sub
    const parsedB = JSON.parse(app.writes[bPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    expect(
      parsedB.nodes.find((n) => n['id'] === 's-prefix')![
        'radiprotocol_subfolderPath'
      ],
    ).toBe('a/c/sub');
  });

  it('empty mapping is a no-op', async () => {
    const canvasPath = 'protocols/a.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-a.canvas'),
    });

    const result = await rewriteCanvasRefs(app.app, new Map());

    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
    // Optimisation: empty mapping should short-circuit before reading files
    expect(app.readSpy).toHaveBeenCalledTimes(0);
  });

  it('exact-match rename also rewrites the node text field', async () => {
    const canvasPath = 'protocols/a.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-a.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    await rewriteCanvasRefs(app.app, mapping);

    const parsed = JSON.parse(app.writes[canvasPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    const snippetNode = parsed.nodes.find(
      (n) => n['radiprotocol_nodeType'] === 'snippet',
    )!;
    expect(snippetNode['text']).toBe('a/c');
  });

  it('prefix-match rename also rewrites the node text field', async () => {
    const canvasPath = 'protocols/b.canvas';
    const app = makeApp({
      [canvasPath]: loadFixture('snippet-node-multi-b.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    await rewriteCanvasRefs(app.app, mapping);

    const parsed = JSON.parse(app.writes[canvasPath]!) as {
      nodes: Array<Record<string, unknown>>;
    };
    const prefixNode = parsed.nodes.find((n) => n['id'] === 's-prefix')!;
    expect(prefixNode['text']).toBe('a/c/sub');
  });

  it('ignores non-.canvas files', async () => {
    const app = makeApp({
      'notes/readme.md': '# not a canvas',
      'protocols/a.canvas': loadFixture('snippet-node-multi-a.canvas'),
    });
    const mapping = new Map<string, string>([['a/b', 'a/c']]);

    const result = await rewriteCanvasRefs(app.app, mapping);

    expect(result.updated).toEqual(['protocols/a.canvas']);
    // readSpy should not have been called with the .md file
    const readPaths = app.readSpy.mock.calls.map(
      (c) => (c[0] as { path: string }).path,
    );
    expect(readPaths).not.toContain('notes/readme.md');
  });
});
