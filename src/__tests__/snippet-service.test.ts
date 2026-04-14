import { describe, it, expect, vi } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';

// Minimal vault adapter mock
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

const settings = { snippetFolderPath: '.radiprotocol/snippets', sessionFolderPath: '.radiprotocol/sessions', outputDestination: 'clipboard' as const, outputFolderPath: '', maxLoopIterations: 50, runnerViewMode: 'sidebar' as const, protocolFolderPath: '', textSeparator: 'newline' as const };

describe('SnippetService (SNIP-01)', () => {
  it('has list() method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.list).toBe('function');
  });

  it('has load(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.load).toBe('function');
  });

  it('has save(snippet) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.save).toBe('function');
  });

  it('has delete(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.delete).toBe('function');
  });

  it('has exists(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.exists).toBe('function');
  });
});

// Phase 30 Plan 01: listFolder — direct-children listing for runner picker.
describe('listFolder (D-18..D-21, T-30-01)', () => {
  function makeListFolderMock(opts: {
    exists?: boolean;
    list?: { files: string[]; folders: string[] };
    reads?: Record<string, string>;
  }) {
    return {
      adapter: {
        exists: vi.fn().mockResolvedValue(opts.exists ?? true),
        list: vi.fn().mockResolvedValue(opts.list ?? { files: [], folders: [] }),
        read: vi.fn().mockImplementation(async (p: string) => {
          if (opts.reads && p in opts.reads) return opts.reads[p];
          throw new Error('unexpected read: ' + p);
        }),
        write: vi.fn(),
      },
      create: vi.fn(),
      createFolder: vi.fn(),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      delete: vi.fn(),
    };
  }

  const ROOT = '.radiprotocol/snippets';

  it('happy path — returns direct-children folders (basenames, sorted) and parsed snippets (sorted by name)', async () => {
    const aPath = '.radiprotocol/snippets/CT/a.json';
    const bPath = '.radiprotocol/snippets/CT/b.json';
    const aJson = JSON.stringify({ id: 'a', name: 'Zebra', template: 't', placeholders: [] });
    const bJson = JSON.stringify({ id: 'b', name: 'Apple', template: 't', placeholders: [] });
    const vault = makeListFolderMock({
      exists: true,
      list: {
        files: [aPath, bPath],
        folders: ['.radiprotocol/snippets/CT/kidney', '.radiprotocol/snippets/CT/adrenal'],
      },
      reads: { [aPath]: aJson, [bPath]: bJson },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder('.radiprotocol/snippets/CT');

    expect(result.folders).toEqual(['adrenal', 'kidney']);
    expect(result.snippets.map((s) => s.name)).toEqual(['Apple', 'Zebra']);
  });

  it('missing folder returns empty and does not call adapter.list', async () => {
    const vault = makeListFolderMock({ exists: false });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder('.radiprotocol/snippets/CT');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.list).toHaveBeenCalledTimes(0);
  });

  it('empty folder returns empty', async () => {
    const vault = makeListFolderMock({
      exists: true,
      list: { files: [], folders: [] },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder('.radiprotocol/snippets/CT');

    expect(result).toEqual({ folders: [], snippets: [] });
  });

  it('corrupt JSON is skipped silently', async () => {
    const goodPath = '.radiprotocol/snippets/CT/good.json';
    const badPath = '.radiprotocol/snippets/CT/bad.json';
    const vault = makeListFolderMock({
      exists: true,
      list: { files: [goodPath, badPath], folders: [] },
      reads: {
        [goodPath]: JSON.stringify({ id: 'g', name: 'Good', template: 't', placeholders: [] }),
        [badPath]: '{bad',
      },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder('.radiprotocol/snippets/CT');

    expect(result.snippets.map((s) => s.name)).toEqual(['Good']);
  });

  it('non-.json files are filtered out', async () => {
    const aPath = '.radiprotocol/snippets/CT/a.json';
    const readmePath = '.radiprotocol/snippets/CT/README.md';
    const vault = makeListFolderMock({
      exists: true,
      list: { files: [aPath, readmePath], folders: [] },
      reads: {
        [aPath]: JSON.stringify({ id: 'a', name: 'Alpha', template: 't', placeholders: [] }),
      },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder('.radiprotocol/snippets/CT');

    expect(result.snippets.map((s) => s.name)).toEqual(['Alpha']);
    expect(vault.adapter.read).toHaveBeenCalledTimes(1);
  });

  it('rejects path with .. segments before any disk I/O', async () => {
    const vault = makeListFolderMock({ exists: true });
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('.radiprotocol/snippets/../../etc');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => /listFolder rejected unsafe path/.test(String(c[0])))).toBe(true);
    errSpy.mockRestore();
  });

  it('rejects absolute path outside root', async () => {
    const vault = makeListFolderMock({ exists: true });
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('/etc/passwd');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => /listFolder rejected unsafe path/.test(String(c[0])))).toBe(true);
    errSpy.mockRestore();
  });

  it('rejects sibling-prefix match (e.g. .radiprotocol/snippets-evil)', async () => {
    const vault = makeListFolderMock({ exists: true });
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('.radiprotocol/snippets-evil');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('accepts the snippet root itself', async () => {
    const vault = makeListFolderMock({
      exists: true,
      list: { files: [], folders: ['.radiprotocol/snippets/CT'] },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder(ROOT);

    expect(result.folders).toEqual(['CT']);
    expect(vault.adapter.exists).toHaveBeenCalledTimes(1);
  });
});
