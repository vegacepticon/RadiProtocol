import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';
import type { MdSnippet, MdTemplateSnippet } from '../snippets/snippet-model';
import { serializeMarkdownTemplate } from '../snippets/md-template';

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

interface MockVaultOptions {
  files?: Record<string, string>; // path → raw contents
  folders?: string[]; // folder paths that "exist"
  abstractFiles?: Record<string, unknown>; // paths that resolve to a TFile-ish
}

function makeVault(opts: MockVaultOptions = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  const abstractFiles: Record<string, unknown> = { ...(opts.abstractFiles ?? {}) };
  // Any file in `files` should resolve by default to a stub TFile unless overridden
  for (const p of Object.keys(files)) {
    if (!(p in abstractFiles)) abstractFiles[p] = { path: p, stat: {} };
  }

  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => {
        return p in files || folderSet.has(p);
      }),
      read: vi.fn(async (p: string) => {
        if (!(p in files)) throw new Error('ENOENT: ' + p);
        return files[p];
      }),
      write: vi.fn(async (p: string, data: string) => {
        files[p] = data;
      }),
      list: vi.fn(async (p: string) => {
        const prefix = p + '/';
        const childFiles: string[] = [];
        const childFolders = new Set<string>();
        for (const fp of Object.keys(files)) {
          if (fp.startsWith(prefix)) {
            const rest = fp.slice(prefix.length);
            if (!rest.includes('/')) childFiles.push(fp);
          }
        }
        for (const folder of folderSet) {
          if (folder.startsWith(prefix)) {
            const rest = folder.slice(prefix.length);
            if (rest !== '' && !rest.includes('/')) childFolders.add(folder);
          }
        }
        return { files: childFiles, folders: Array.from(childFolders) };
      }),
    },
    create: vi.fn(async (p: string, data: string) => {
      files[p] = data;
      abstractFiles[p] = { path: p, stat: {} };
    }),
    createFolder: vi.fn(async (p: string) => {
      folderSet.add(p);
    }),
    getAbstractFileByPath: vi.fn((p: string) => {
      return p in abstractFiles ? abstractFiles[p] : null;
    }),
    getFiles: vi.fn(() => {
      return Object.keys(files).map((p) => ({ path: p, stat: {} }));
    }),
    trash: vi.fn(async (_file: unknown, _system: boolean) => {
      // no-op; tests spy on call args
    }),
    delete: vi.fn(),
  };
  return { vault, files, folderSet, abstractFiles };
}

function makeSnippetServiceApp(vault: ReturnType<typeof makeVault>['vault']) {
  return {
    vault,
    fileManager: {
      trashFile: vi.fn(async (file: unknown) => vault.trash(file, false)),
    },
  };
}

const settings = {
  snippetFolderPath: '.radiprotocol/snippets',
  snippetTreeExpandedPaths: [] as string[],
  protocolFolderPath: '',
  textSeparator: 'newline' as const,
  locale: 'en' as const,
};

const ROOT = '.radiprotocol/snippets';

/** A minimal md-template frontmatter string with the given body + placeholders. */
function mdTemplateFile(name: string, body: string, placeholders: MdTemplateSnippet['placeholders']): string {
  return serializeMarkdownTemplate({
    kind: 'md-template',
    path: '',
    name,
    template: body,
    placeholders,
    validationError: null,
  });
}

// ---------------------------------------------------------------------------
// API presence
// ---------------------------------------------------------------------------

describe('SnippetService API surface (Phase 32 D-03)', () => {
  it('exposes listFolder / load / save / delete / exists / searchSnippets / resolveSnippet', () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    expect(typeof svc.listFolder).toBe('function');
    expect(typeof svc.load).toBe('function');
    expect(typeof svc.save).toBe('function');
    expect(typeof svc.delete).toBe('function');
    expect(typeof svc.exists).toBe('function');
    expect(typeof svc.searchSnippets).toBe('function');
    expect(typeof svc.resolveSnippet).toBe('function');
  });

  it('does NOT expose removed legacy list() method', () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    expect((svc as unknown as { list?: unknown }).list).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listFolder — happy paths + MD routing (Phase 2 JSON-removal)
// ---------------------------------------------------------------------------

describe('listFolder (D-18..D-21, T-30-01)', () => {
  it('happy path — returns direct-children folders and parsed snippets sorted', async () => {
    const aPath = `${ROOT}/CT/a.md`;
    const bPath = `${ROOT}/CT/b.md`;
    const { vault } = makeVault({
      files: {
        [aPath]: mdTemplateFile('Zebra', 't', []),
        [bPath]: mdTemplateFile('Apple', 't', []),
      },
      folders: [`${ROOT}/CT`, `${ROOT}/CT/kidney`, `${ROOT}/CT/adrenal`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    expect(result.folders).toEqual(['adrenal', 'kidney']);
    // md-template `name` comes from frontmatter; sorted by name.
    expect(result.snippets.map((s) => s.name)).toEqual(['Apple', 'Zebra']);
    expect(result.snippets.every((s) => s.kind === 'md-template')).toBe(true);
  });

  it('missing folder returns empty and does not call adapter.list', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.list).toHaveBeenCalledTimes(0);
  });

  it('skips legacy .json files — they never render as selectable rows', async () => {
    const mdPath = `${ROOT}/CT/notes.md`;
    const jsonPath = `${ROOT}/CT/legacy.json`;
    const { vault } = makeVault({
      files: {
        [mdPath]: 'raw md body',
        [jsonPath]: JSON.stringify({ name: 'legacy', template: 't', placeholders: [] }),
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]!.kind).toBe('md');
    expect(result.snippets[0]!.name).toBe('notes');
  });

  it('rejects path with .. segments before any disk I/O', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder(`${ROOT}/../../etc`);

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(
      errSpy.mock.calls.some((c) =>
        /snippet-service rejected unsafe path/.test(String(c[0])),
      ),
    ).toBe(true);
    errSpy.mockRestore();
  });

  it('rejects absolute path outside root', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('/etc/passwd');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('rejects sibling-prefix match (e.g. .radiprotocol/snippets-evil)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('.radiprotocol/snippets-evil');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// listFolder extension routing (MD-05)
// ---------------------------------------------------------------------------

describe('listFolder extension routing (MD-05)', () => {
  it('returns MdTemplateSnippet for .md files with frontmatter', async () => {
    const p = `${ROOT}/CT/alpha.md`;
    const { vault } = makeVault({
      files: {
        [p]: mdTemplateFile('Alpha', 'hello {{x}}', [
          { id: 'x', label: 'X', type: 'free-text' },
        ]),
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('md-template');
    const s = snippets[0] as MdTemplateSnippet;
    expect(s.name).toBe('Alpha');
    expect(s.template).toBe('hello {{x}}');
    expect(s.placeholders).toHaveLength(1);
    expect(s.path).toBe(p);
  });

  it('returns MdSnippet for .md files without frontmatter (raw content)', async () => {
    const p = `${ROOT}/CT/notes.md`;
    const raw = '# Notes\n\nFree-text markdown body.';
    const { vault } = makeVault({
      files: { [p]: raw },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('md');
    const s = snippets[0] as MdSnippet;
    expect(s.name).toBe('notes');
    expect(s.content).toBe(raw);
    expect(s.path).toBe(p);
  });

  it('skips non-.md files (e.g. .txt)', async () => {
    const mdPath = `${ROOT}/CT/a.md`;
    const txtPath = `${ROOT}/CT/ignore.txt`;
    const { vault } = makeVault({
      files: {
        [mdPath]: 'raw md body',
        [txtPath]: 'ignore me',
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('md');
  });
});

// ---------------------------------------------------------------------------
// load(path) routing
// ---------------------------------------------------------------------------

describe('load(path) routing (D-03)', () => {
  it('returns MdTemplateSnippet for .md path with frontmatter', async () => {
    const p = `${ROOT}/CT/a.md`;
    const { vault } = makeVault({
      files: { [p]: mdTemplateFile('Alpha', 't', []) },
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet = await svc.load(p);

    expect(snippet).not.toBeNull();
    expect(snippet!.kind).toBe('md-template');
    expect((snippet as MdTemplateSnippet).name).toBe('Alpha');
    expect(snippet!.path).toBe(p);
  });

  it('returns MdSnippet with raw content for .md path without frontmatter', async () => {
    const p = `${ROOT}/CT/note.md`;
    const raw = 'body\nwith\nlines';
    const { vault } = makeVault({ files: { [p]: raw } });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet = await svc.load(p);

    expect(snippet).not.toBeNull();
    expect(snippet!.kind).toBe('md');
    expect((snippet as MdSnippet).content).toBe(raw);
    expect((snippet as MdSnippet).name).toBe('note');
  });

  it('returns null for a legacy .json path (no longer loadable)', async () => {
    const p = `${ROOT}/CT/legacy.json`;
    const { vault } = makeVault({
      files: { [p]: JSON.stringify({ name: 'legacy', template: 't', placeholders: [] }) },
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet = await svc.load(p);
    expect(snippet).toBeNull();
  });

  it('returns null for missing file', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet = await svc.load(`${ROOT}/missing.md`);
    expect(snippet).toBeNull();
  });

  it('returns null for out-of-root path (path-safety D-10)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const snippet = await svc.load(`${ROOT}/../../etc/passwd`);

    expect(snippet).toBeNull();
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('returns null for corrupt .md read (unreadable)', async () => {
    const p = `${ROOT}/bad.md`;
    const { vault } = makeVault({ files: { [p]: 'not relevant' } });
    // Force read to throw
    vault.adapter.read = vi.fn(async () => { throw new Error('ENOENT'); });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet = await svc.load(p);
    expect(snippet).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// save(Snippet) branching + WriteMutex serialisation
// ---------------------------------------------------------------------------

describe('save(Snippet) branching (D-03, D-11)', () => {
  it('md-template save writes frontmatter + body', async () => {
    const p = `${ROOT}/CT/a.md`;
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet: MdTemplateSnippet = {
      kind: 'md-template',
      path: p,
      name: 'Alpha',
      template: 'hello {{x}}',
      placeholders: [{ id: 'x', label: 'X', type: 'free-text' }],
      validationError: null,
    };
    await svc.save(snippet);

    const persisted = files[p];
    expect(persisted).toBeDefined();
    expect(persisted).toContain('---');
    expect(persisted).toContain('name: Alpha');
    expect(persisted).toContain('hello {{x}}');
  });

  it('MD save writes raw content verbatim', async () => {
    const p = `${ROOT}/CT/raw.md`;
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const content = '# H1\n\nLine 1\nLine 2';
    const snippet: MdSnippet = {
      kind: 'md',
      path: p,
      name: 'raw',
      content,
    };
    await svc.save(snippet);

    expect(files[p]).toBe(content);
  });

  it('concurrent saves on the same path serialise via WriteMutex', async () => {
    const p = `${ROOT}/CT/a.md`;
    const order: string[] = [];
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const origCreate = vault.create;
    vault.create = vi.fn(async (path: string, data: string) => {
      order.push('start:' + path);
      await new Promise((r) => setTimeout(r, 10));
      order.push('end:' + path);
      await origCreate(path, data);
    }) as unknown as typeof origCreate;
    const origWrite = vault.adapter.write;
    vault.adapter.write = vi.fn(async (path: string, data: string) => {
      order.push('start:' + path);
      await new Promise((r) => setTimeout(r, 10));
      order.push('end:' + path);
      await origWrite(path, data);
    }) as unknown as typeof origWrite;

    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const s1: MdSnippet = { kind: 'md', path: p, name: 'one', content: 'one' };
    const s2: MdSnippet = { kind: 'md', path: p, name: 'two', content: 'two' };

    await Promise.all([svc.save(s1), svc.save(s2)]);

    expect(order).toHaveLength(4);
    expect(order[0]!.startsWith('start:')).toBe(true);
    expect(order[1]!.startsWith('end:')).toBe(true);
    expect(order[2]!.startsWith('start:')).toBe(true);
    expect(order[3]!.startsWith('end:')).toBe(true);
    expect(files[p]).toBeDefined();
  });

  it('save rejects unsafe path (D-10)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const snippet: MdSnippet = {
      kind: 'md',
      path: `${ROOT}/../../escape.md`,
      name: 'x',
      content: '',
    };
    await expect(svc.save(snippet)).rejects.toThrow(/unsafe path/);
    expect(vault.adapter.write).toHaveBeenCalledTimes(0);
    expect(vault.create).toHaveBeenCalledTimes(0);
  });
});

// ---------------------------------------------------------------------------
// delete(path) — DEL-01 via vault.trash
// ---------------------------------------------------------------------------

describe('delete(path) uses Obsidian trash (DEL-01, D-08)', () => {
  it('routes deletion through FileManager trash once', async () => {
    const p = `${ROOT}/CT/victim.md`;
    const { vault } = makeVault({ files: { [p]: 'raw' } });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await svc.delete(p);

    expect(vault.trash).toHaveBeenCalledTimes(1);
    const [file, system] = vault.trash.mock.calls[0]!;
    expect((file as { path: string }).path).toBe(p);
    expect(system).toBe(false);
  });

  it('no-op when file missing (no throw, trash not called)', async () => {
    const p = `${ROOT}/CT/ghost.md`;
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.delete(p)).resolves.toBeUndefined();
    expect(vault.trash).toHaveBeenCalledTimes(0);
  });

  it('rejects out-of-root path — trash NOT called', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await svc.delete(`${ROOT}/../../etc/passwd`);

    expect(vault.trash).toHaveBeenCalledTimes(0);
    expect(vault.getAbstractFileByPath).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// exists(path)
// ---------------------------------------------------------------------------

describe('exists(path) (D-03)', () => {
  it('returns true for existing safe path', async () => {
    const p = `${ROOT}/CT/a.md`;
    const { vault } = makeVault({ files: { [p]: 'raw' } });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    expect(await svc.exists(p)).toBe(true);
  });

  it('returns false for missing safe path', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    expect(await svc.exists(`${ROOT}/missing.md`)).toBe(false);
  });

  it('returns false for out-of-root path without touching adapter', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const r = await svc.exists(`${ROOT}/../../etc/passwd`);

    expect(r).toBe(false);
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Parameterised path-safety gate (D-10)
// ---------------------------------------------------------------------------

describe('path-safety gate applies to every entry point (D-10)', () => {
  const unsafePaths = [
    `${ROOT}/../evil.md`,
    '/absolute/path.md',
    `${ROOT}/sub/../../escape.md`,
    '.radiprotocol/snippets-evil/foo.md',
  ];

  let _errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  for (const bad of unsafePaths) {
    it(`load() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
      const r = await svc.load(bad);
      expect(r).toBeNull();
      expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    });

    it(`save() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
      const snippet: MdSnippet = {
        kind: 'md',
        path: bad,
        name: 'x',
        content: '',
      };
      await expect(svc.save(snippet)).rejects.toThrow(/unsafe path/);
      expect(vault.adapter.write).toHaveBeenCalledTimes(0);
      expect(vault.create).toHaveBeenCalledTimes(0);
    });

    it(`delete() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
      await svc.delete(bad);
      expect(vault.trash).toHaveBeenCalledTimes(0);
      expect(vault.getAbstractFileByPath).toHaveBeenCalledTimes(0);
    });

    it(`exists() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
      const r = await svc.exists(bad);
      expect(r).toBe(false);
      expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    });

    it(`listFolder() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
      const r = await svc.listFolder(bad);
      expect(r).toEqual({ folders: [], snippets: [] });
      expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Phase 33 (D-17): folder operations
// ---------------------------------------------------------------------------

describe('createFolder (Phase 33 D-17)', () => {
  it('creates the folder via ensureFolderPath inside the root', async () => {
    const { vault, folderSet } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    await svc.createFolder(`${ROOT}/new-folder`);
    expect(folderSet.has(`${ROOT}/new-folder`)).toBe(true);
    expect(vault.createFolder).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second call does not throw', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    await svc.createFolder(`${ROOT}/x`);
    await expect(svc.createFolder(`${ROOT}/x`)).resolves.toBeUndefined();
  });

  it('rejects a path outside the root', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(svc.createFolder('../escape')).rejects.toThrow(/createFolder rejected/);
    expect(vault.createFolder).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

describe('deleteFolder (Phase 33 D-17)', () => {
  it('routes folder deletion through FileManager trash once', async () => {
    const sub = `${ROOT}/sub`;
    const { vault } = makeVault({
      folders: [ROOT, sub],
      abstractFiles: { [sub]: { path: sub } },
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    await svc.deleteFolder(sub);
    expect(vault.trash).toHaveBeenCalledTimes(1);
    expect(vault.trash.mock.calls[0]![1]).toBe(false);
  });

  it('is a no-op for unsafe paths', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await svc.deleteFolder('../escape');
    expect(vault.trash).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('is a no-op when the folder does not exist', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    await svc.deleteFolder(`${ROOT}/missing`);
    expect(vault.trash).toHaveBeenCalledTimes(0);
  });
});

describe('listFolderDescendants (Phase 33 D-15)', () => {
  it('returns files, folders, and total (extension-agnostic — includes .json)', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/a/one.md`]: 'raw',
        [`${ROOT}/a/b/legacy.json`]: '{}',
      },
      folders: [ROOT, `${ROOT}/a`, `${ROOT}/a/b`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const result = await svc.listFolderDescendants(`${ROOT}/a`);
    expect(result.total).toBe(result.files.length + result.folders.length);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/one\.md$/),
        expect.stringMatching(/legacy\.json$/),
      ]),
    );
    expect(result.folders).toEqual(expect.arrayContaining([`${ROOT}/a/b`]));
  });

  it('returns empty for unsafe path', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await svc.listFolderDescendants('../escape');
    expect(result).toEqual({ files: [], folders: [], total: 0 });
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// duplicateSnippet — path, name, and placeholder deep clone (Phase 36)
// ---------------------------------------------------------------------------

describe('duplicateSnippet (Phase 36)', () => {
  it('duplicates an md-template snippet — path, name, and placeholders cloned', async () => {
    const p = `${ROOT}/CT/chest.md`;
    const original: MdTemplateSnippet = {
      kind: 'md-template',
      path: p,
      name: 'chest',
      template: 'Finding: {{finding}}. Side: {{side}}.',
      placeholders: [
        { id: 'finding', label: 'Finding', type: 'free-text' },
        { id: 'side', label: 'Side', type: 'choice', options: ['left', 'right'], separator: ', ' },
      ],
      validationError: null,
    };
    const { vault, files } = makeVault({
      files: { [p]: serializeMarkdownTemplate(original) },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const newPath = await svc.duplicateSnippet(p);

    expect(newPath).toBe(`${ROOT}/CT/chest-copy.md`);
    expect(files[newPath]).toBeDefined();
    expect(files[newPath]).toContain('Finding: {{finding}}. Side: {{side}}.');

    const loaded = await svc.load(newPath);
    const dup = loaded as MdTemplateSnippet;
    expect(dup.kind).toBe('md-template');
    expect(dup.placeholders).toHaveLength(2);
    expect(dup.placeholders).not.toBe(original.placeholders);
    expect(dup.placeholders[0]).not.toBe(original.placeholders[0]);
    expect(dup.placeholders[1]).not.toBe(original.placeholders[1]);
  });

  it('increments suffix when -copy already exists', async () => {
    const p = `${ROOT}/CT/chest.md`;
    const cp = `${ROOT}/CT/chest-copy.md`;
    const orig: MdTemplateSnippet = {
      kind: 'md-template',
      path: p,
      name: 'chest',
      template: 't',
      placeholders: [],
      validationError: null,
    };
    const { vault } = makeVault({
      files: {
        [p]: serializeMarkdownTemplate(orig),
        [cp]: serializeMarkdownTemplate({ ...orig, path: cp, name: 'chest-copy' }),
      },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const newPath = await svc.duplicateSnippet(p);

    expect(newPath).toBe(`${ROOT}/CT/chest-copy-2.md`);
  });

  it('duplicates an MD snippet — content preserved, no placeholders', async () => {
    const p = `${ROOT}/CT/notes.md`;
    const raw = '# Notes\n\nBody text.';
    const { vault, files } = makeVault({
      files: { [p]: raw },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const newPath = await svc.duplicateSnippet(p);

    expect(newPath).toBe(`${ROOT}/CT/notes-copy.md`);
    expect(files[newPath]).toBe(raw);

    const loaded = await svc.load(newPath);
    const dup = loaded as MdSnippet;
    expect(dup.kind).toBe('md');
    expect(dup.content).toBe(raw);
    expect(dup.name).toBe('notes-copy');
  });

  it('throws for missing source file', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.duplicateSnippet(`${ROOT}/missing.md`)).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// resolveSnippet — Phase 2 (JSON-removal) discriminated resolver
// ---------------------------------------------------------------------------

describe('resolveSnippet (Phase 2 JSON-removal)', () => {
  it('found — direct .md path resolves to a loaded Markdown snippet', async () => {
    const p = `${ROOT}/CT/alpha.md`;
    const { vault } = makeVault({
      files: { [p]: mdTemplateFile('Alpha', 'hello {{x}}', [
        { id: 'x', label: 'X', type: 'free-text' },
      ]) },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet(p);

    expect(resolution.status).toBe('found');
    if (resolution.status === 'found') {
      expect(resolution.snippet.kind).toBe('md-template');
      expect(resolution.snippet.path).toBe(p);
    }
  });

  it('found — extensionless id resolves to a root .md file', async () => {
    const p = `${ROOT}/greeting.md`;
    const { vault } = makeVault({
      files: { [p]: 'plain md body' },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('greeting');

    expect(resolution.status).toBe('found');
    if (resolution.status === 'found') {
      expect(resolution.snippet.kind).toBe('md');
    }
  });

  it('found — extensionless id backed by a unique-subdir .md file', async () => {
    const p = `${ROOT}/CT/abdomen.md`;
    const { vault } = makeVault({
      files: { [p]: mdTemplateFile('Abdomen', 'body', []) },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('abdomen');

    expect(resolution.status).toBe('found');
    if (resolution.status === 'found') {
      expect(resolution.snippet.path).toBe(p);
    }
  });

  it('legacy-json — explicit .json reference returns legacy-json with path', async () => {
    const p = `${ROOT}/CT/legacy.json`;
    const { vault } = makeVault({
      files: { [p]: JSON.stringify({ name: 'legacy', template: 't', placeholders: [] }) },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet(p);

    expect(resolution.status).toBe('legacy-json');
    if (resolution.status === 'legacy-json') {
      expect(resolution.path).toBe(p);
    }
  });

  it('legacy-json — extensionless id whose root .json file exists returns legacy-json', async () => {
    const p = `${ROOT}/legacy.json`;
    const { vault } = makeVault({
      files: { [p]: JSON.stringify({ name: 'legacy', template: 't', placeholders: [] }) },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('legacy');

    expect(resolution.status).toBe('legacy-json');
    if (resolution.status === 'legacy-json') {
      expect(resolution.path).toBe(p);
    }
  });

  it('legacy-json — extensionless id backed by a unique-subdir .json file', async () => {
    const p = `${ROOT}/CT/oldformat.json`;
    const { vault } = makeVault({
      files: { [p]: JSON.stringify({ name: 'oldformat', template: 't', placeholders: [] }) },
      folders: [ROOT, `${ROOT}/CT`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('oldformat');

    expect(resolution.status).toBe('legacy-json');
    if (resolution.status === 'legacy-json') {
      expect(resolution.path).toBe(p);
    }
  });

  it('missing — no .md or .json match exists', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('nonexistent');

    expect(resolution.status).toBe('missing');
  });

  it('missing — unsafe/traversal-escaping id returns missing without touching the vault', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resolution = await svc.resolveSnippet('../../etc/passwd');

    expect(resolution.status).toBe('missing');
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(vault.getFiles).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('prefers .md over .json when both exist for the same extensionless id', async () => {
    const mdPath = `${ROOT}/dupe.md`;
    const jsonPath = `${ROOT}/dupe.json`;
    const { vault } = makeVault({
      files: {
        [mdPath]: 'md body',
        [jsonPath]: JSON.stringify({ name: 'dupe', template: 't', placeholders: [] }),
      },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const resolution = await svc.resolveSnippet('dupe');

    expect(resolution.status).toBe('found');
    if (resolution.status === 'found') {
      expect(resolution.snippet.path).toBe(mdPath);
    }
  });
});

// ---------------------------------------------------------------------------
// searchSnippets — Phase: Service-owned global search
// ---------------------------------------------------------------------------

describe('searchSnippets — global parsed Markdown search', () => {
  it('matches snippet names and sorts matches by display name then path', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/zebra-report.md`]: 'body',
        [`${ROOT}/alpha-report.md`]: 'body',
        [`${ROOT}/ignore.md`]: 'body',
      },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const matches = await svc.searchSnippets('REPORT');

    expect(matches.map(({ snippet }) => snippet.name)).toEqual(['alpha-report', 'zebra-report']);
    expect(matches.every(({ folderPath }) => folderPath === ROOT)).toBe(true);
  });

  it('matches plain content and template body but not template frontmatter metadata', async () => {
    const plainPath = `${ROOT}/plain.md`;
    const templatePath = `${ROOT}/template.md`;
    const metadataOnlyPath = `${ROOT}/metadata.md`;
    const metadataOnly = serializeMarkdownTemplate({
      kind: 'md-template',
      path: metadataOnlyPath,
      name: 'metadata',
      template: 'ordinary body',
      placeholders: [],
      validationError: null,
      description: 'frontmatter-secret',
    });
    const { vault } = makeVault({
      files: {
        [plainPath]: 'Contains Needle Plain.',
        [templatePath]: mdTemplateFile('template', 'Contains needle template.', []),
        [metadataOnlyPath]: metadataOnly,
      },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const bodyMatches = await svc.searchSnippets('needle');
    const metadataMatches = await svc.searchSnippets('frontmatter-secret');

    expect(bodyMatches.map(({ snippet }) => snippet.path)).toEqual([plainPath, templatePath]);
    expect(metadataMatches).toEqual([]);
  });

  it('promotes every nested snippet under a matching real folder', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/Chest/direct.md`]: 'ordinary',
        [`${ROOT}/Chest/CT/nested.md`]: 'ordinary',
        [`${ROOT}/Abdomen/other.md`]: 'ordinary',
      },
      folders: [ROOT, `${ROOT}/Chest`, `${ROOT}/Chest/CT`, `${ROOT}/Abdomen`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const matches = await svc.searchSnippets('chest');

    expect(matches.map(({ snippet }) => snippet.path)).toEqual([
      `${ROOT}/Chest/direct.md`,
      `${ROOT}/Chest/CT/nested.md`,
    ]);
  });

  it('does not treat the configured root basename as a folder-name match', async () => {
    const { vault } = makeVault({
      files: { [`${ROOT}/ordinary.md`]: 'ordinary body' },
      folders: [ROOT],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.searchSnippets('snippets')).resolves.toEqual([]);
  });

  it('skips failed parses, unreadable Markdown, legacy JSON, and non-Markdown files without aborting', async () => {
    const readablePath = `${ROOT}/readable.md`;
    const unreadablePath = `${ROOT}/unreadable.md`;
    const failedParsePath = `${ROOT}/failed-parse.md`;
    const failedParse = [
      '---',
      'name: failed-parse',
      'placeholders:',
      '  - id: choice',
      '    label: Choice',
      '    type: choice',
      '---',
      'needle',
    ].join('\n');
    const { vault } = makeVault({
      files: {
        [readablePath]: 'needle',
        [unreadablePath]: 'needle',
        [failedParsePath]: failedParse,
        [`${ROOT}/legacy.json`]: '{"content":"needle"}',
        [`${ROOT}/notes.txt`]: 'needle',
      },
      folders: [ROOT],
    });
    const originalRead = vault.adapter.read;
    vault.adapter.read = vi.fn(async (path: string) => {
      if (path === unreadablePath) throw new Error('EACCES');
      return originalRead(path);
    }) as typeof originalRead;
    const throwingTranslator = ((key: string): string => {
      if (key === 'snippetModel.invalidChoiceError') throw new Error('parse failed');
      return key;
    }) as never;
    const svc = new SnippetService(
      makeSnippetServiceApp(vault) as never,
      settings,
      throwingTranslator,
    );

    const matches = await svc.searchSnippets('needle');

    expect(matches.map(({ snippet }) => snippet.path)).toEqual([readablePath]);
  });

  it('returns no matches for an empty or whitespace-only query without reading folders', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.searchSnippets('   ')).resolves.toEqual([]);
    expect(vault.adapter.list).not.toHaveBeenCalled();
  });
});