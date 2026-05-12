import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rewriteProtocolSnippetRefs } from '../snippets/protocol-ref-sync';

// ---------------------------------------------------------------------------
// Mock App backed by an in-memory map of .rp.json files.
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

function makeProtocolDoc(nodes: Array<{
  id: string;
  kind: string | null;
  fields?: Record<string, unknown>;
}>): string {
  return JSON.stringify({
    schema: 'radiprotocol.protocol',
    version: 1,
    id: 'test-id',
    title: 'Test Protocol',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fields: n.fields ?? {},
    })),
    edges: [],
  });
}

describe('rewriteProtocolSnippetRefs', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('exact path match rewrite', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b.json' } },
        { id: 'q1', kind: 'question', fields: { questionText: 'Hello?' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b.json', 'c/d.json']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual([protocolPath]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(app.writes[protocolPath]!) as {
      nodes: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    const snippetNode = parsed.nodes.find((n) => n.id === 's1')!;
    expect(snippetNode.fields['snippetPath']).toBe('c/d.json');
  });

  it('prefix path rewrite (folder move affecting nested files)', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b/nested.json' } },
        { id: 's2', kind: 'snippet', fields: { subfolderPath: 'a/b' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b', 'c/d']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual([protocolPath]);
    const parsed = JSON.parse(app.writes[protocolPath]!) as {
      nodes: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    const s1 = parsed.nodes.find((n) => n.id === 's1')!;
    expect(s1.fields['snippetPath']).toBe('c/d/nested.json');
    const s2 = parsed.nodes.find((n) => n.id === 's2')!;
    expect(s2.fields['subfolderPath']).toBe('c/d');
  });

  it('no match = no write', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'x/y.json' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b', 'c/d']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
  });

  it('empty mapping = no-op', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b.json' } },
      ]),
    });

    const result = await rewriteProtocolSnippetRefs(app.app, new Map());

    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
    expect(app.readSpy).toHaveBeenCalledTimes(0);
  });

  it('invalid JSON file is skipped', async () => {
    const brokenPath = 'protocols/broken.rp.json';
    const goodPath = 'protocols/good.rp.json';
    const app = makeApp({
      [brokenPath]: 'not json at all',
      [goodPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b.json' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b.json', 'c/d.json']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.path).toBe(brokenPath);
    expect(result.skipped[0]!.reason).toMatch(/JSON|invalid/i);
    expect(result.updated).toEqual([goodPath]);
    expect(app.writes[goodPath]).toBeDefined();
  });

  it('ignores non-.rp.json files', async () => {
    const app = makeApp({
      'notes/readme.md': '# not a protocol',
      'protocols/test.rp.json': makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b.json' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b.json', 'c/d.json']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual(['protocols/test.rp.json']);
    const readPaths = app.readSpy.mock.calls.map(
      (c) => (c[0] as { path: string }).path,
    );
    expect(readPaths).not.toContain('notes/readme.md');
  });

  it('empty-string snippetPath and subfolderPath are preserved', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: '', subfolderPath: '' } },
      ]),
    });
    const mapping = new Map<string, string>([['', 'new-root']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
  });

  it('non-snippet nodes are untouched', async () => {
    const protocolPath = 'protocols/test.rp.json';
    const app = makeApp({
      [protocolPath]: makeProtocolDoc([
        { id: 'q1', kind: 'question', fields: { questionText: 'a/b' } },
        { id: 't1', kind: 'text-block', fields: { content: 'a/b.json' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b', 'c/d']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated).toEqual([]);
    expect(app.modifySpy).toHaveBeenCalledTimes(0);
  });

  it('multi-protocol updates both files in one pass', async () => {
    const aPath = 'protocols/a.rp.json';
    const bPath = 'protocols/b.rp.json';
    const app = makeApp({
      [aPath]: makeProtocolDoc([
        { id: 's1', kind: 'snippet', fields: { snippetPath: 'a/b/nested.json' } },
      ]),
      [bPath]: makeProtocolDoc([
        { id: 's2', kind: 'snippet', fields: { subfolderPath: 'a/b' } },
      ]),
    });
    const mapping = new Map<string, string>([['a/b', 'c/d']]);

    const result = await rewriteProtocolSnippetRefs(app.app, mapping);

    expect(result.updated.sort()).toEqual([aPath, bPath].sort());
    expect(app.modifySpy).toHaveBeenCalledTimes(2);
  });
});
