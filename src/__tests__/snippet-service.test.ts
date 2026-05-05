import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';
import type { JsonSnippet, MdSnippet } from '../snippets/snippet-model';

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
    trash: vi.fn(async (_file: unknown, _system: boolean) => {
      // no-op; tests spy on call args
    }),
    delete: vi.fn(),
  };
  return { vault, files, folderSet, abstractFiles };
}

const settings = {
  snippetFolderPath: '.radiprotocol/snippets',
  snippetTreeExpandedPaths: [] as string[],
  protocolFolderPath: '',
  textSeparator: 'newline' as const,
  locale: 'en' as const,
  libraryUrl: '',
};

const ROOT = '.radiprotocol/snippets';

// ---------------------------------------------------------------------------
// API presence
// ---------------------------------------------------------------------------

describe('SnippetService API surface (Phase 32 D-03)', () => {
  it('exposes listFolder / load / save / delete / exists', () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    expect(typeof svc.listFolder).toBe('function');
    expect(typeof svc.load).toBe('function');
    expect(typeof svc.save).toBe('function');
    expect(typeof svc.delete).toBe('function');
    expect(typeof svc.exists).toBe('function');
  });

  it('does NOT expose removed legacy list() method', () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    // Phase 32: legacy flat-list `list()` is removed.
    expect((svc as unknown as { list?: unknown }).list).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listFolder — happy paths (retained from Phase 30) + MD routing (MD-05, D-09)
// ---------------------------------------------------------------------------

describe('listFolder (D-18..D-21, T-30-01)', () => {
  it('happy path — returns direct-children folders and parsed snippets sorted', async () => {
    const aPath = `${ROOT}/CT/a.json`;
    const bPath = `${ROOT}/CT/b.json`;
    const { vault } = makeVault({
      files: {
        [aPath]: JSON.stringify({ id: 'a', name: 'Zebra', template: 't', placeholders: [] }),
        [bPath]: JSON.stringify({ id: 'b', name: 'Apple', template: 't', placeholders: [] }),
      },
      folders: [`${ROOT}/CT`, `${ROOT}/CT/kidney`, `${ROOT}/CT/adrenal`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    expect(result.folders).toEqual(['adrenal', 'kidney']);
    // Phase 33 (D-02): basename is authoritative for `name` — JSON's inner
    // `name` field is ignored at read time so external vault rename reflects
    // in the tree immediately (SYNC-02).
    expect(result.snippets.map((s) => s.name)).toEqual(['a', 'b']);
    expect(result.snippets.every((s) => s.kind === 'json')).toBe(true);
  });

  it('missing folder returns empty and does not call adapter.list', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.list).toHaveBeenCalledTimes(0);
  });

  it('corrupt JSON is skipped silently', async () => {
    const goodPath = `${ROOT}/CT/good.json`;
    const badPath = `${ROOT}/CT/bad.json`;
    const { vault } = makeVault({
      files: {
        [goodPath]: JSON.stringify({ name: 'Good', template: 't', placeholders: [] }),
        [badPath]: '{bad',
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const result = await svc.listFolder(`${ROOT}/CT`);

    // Phase 33 (D-02): basename is authoritative — `name` comes from filename.
    expect(result.snippets.map((s) => s.name)).toEqual(['good']);
  });

  it('rejects path with .. segments before any disk I/O', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService({ vault } as never, settings);
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
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('/etc/passwd');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    expect(
      errSpy.mock.calls.some((c) =>
        /snippet-service rejected unsafe path/.test(String(c[0])),
      ),
    ).toBe(true);
    errSpy.mockRestore();
  });

  it('rejects sibling-prefix match (e.g. .radiprotocol/snippets-evil)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await svc.listFolder('.radiprotocol/snippets-evil');

    expect(result).toEqual({ folders: [], snippets: [] });
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// listFolder extension routing (MD-05) + JSON/MD coexistence (D-09)
// ---------------------------------------------------------------------------

describe('listFolder extension routing (MD-05)', () => {
  it('returns JsonSnippet for .json files', async () => {
    const p = `${ROOT}/CT/alpha.json`;
    const { vault } = makeVault({
      files: {
        [p]: JSON.stringify({
          name: 'Alpha',
          template: 'hello {{x}}',
          placeholders: [{ id: 'x', label: 'X', type: 'free-text' }],
        }),
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('json');
    const s = snippets[0] as JsonSnippet;
    // Phase 33 (D-02): basename is authoritative for `name`.
    expect(s.name).toBe('alpha');
    expect(s.template).toBe('hello {{x}}');
    expect(s.placeholders).toHaveLength(1);
    expect(s.path).toBe(p);
  });

  it('returns MdSnippet for .md files with raw content', async () => {
    const p = `${ROOT}/CT/notes.md`;
    const raw = '# Notes\n\nFree-text markdown body.';
    const { vault } = makeVault({
      files: { [p]: raw },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('md');
    const s = snippets[0] as MdSnippet;
    expect(s.name).toBe('notes');
    expect(s.content).toBe(raw);
    expect(s.path).toBe(p);
  });

  it('returns both when foo.json and foo.md coexist (D-09)', async () => {
    const jsonP = `${ROOT}/CT/foo.json`;
    const mdP = `${ROOT}/CT/foo.md`;
    const { vault } = makeVault({
      files: {
        [jsonP]: JSON.stringify({ name: 'foo', template: 't', placeholders: [] }),
        [mdP]: 'raw md body',
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(2);
    const kinds = snippets.map((s) => s.kind).sort();
    expect(kinds).toEqual(['json', 'md']);
    // Both derive `name` = 'foo' (basename)
    expect(snippets.every((s) => s.name === 'foo')).toBe(true);
  });

  it('skips non-.json/.md files', async () => {
    const jsonP = `${ROOT}/CT/a.json`;
    const txtP = `${ROOT}/CT/ignore.txt`;
    const { vault } = makeVault({
      files: {
        [jsonP]: JSON.stringify({ name: 'a', template: 't', placeholders: [] }),
        [txtP]: 'ignore me',
      },
      folders: [`${ROOT}/CT`],
    });
    const svc = new SnippetService({ vault } as never, settings);

    const { snippets } = await svc.listFolder(`${ROOT}/CT`);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.kind).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// load(path) routing
// ---------------------------------------------------------------------------

describe('load(path) routing (D-03)', () => {
  it('returns JsonSnippet for .json path', async () => {
    const p = `${ROOT}/CT/a.json`;
    const { vault } = makeVault({
      files: {
        [p]: JSON.stringify({ name: 'Alpha', template: 't', placeholders: [] }),
      },
    });
    const svc = new SnippetService({ vault } as never, settings);

    const snippet = await svc.load(p);

    expect(snippet).not.toBeNull();
    expect(snippet!.kind).toBe('json');
    // Phase 33 (D-02): basename is authoritative — `a.json` → `a`.
    expect((snippet as JsonSnippet).name).toBe('a');
    expect(snippet!.path).toBe(p);
  });

  it('returns MdSnippet with raw content for .md path', async () => {
    const p = `${ROOT}/CT/note.md`;
    const raw = 'body\nwith\nlines';
    const { vault } = makeVault({ files: { [p]: raw } });
    const svc = new SnippetService({ vault } as never, settings);

    const snippet = await svc.load(p);

    expect(snippet).not.toBeNull();
    expect(snippet!.kind).toBe('md');
    expect((snippet as MdSnippet).content).toBe(raw);
    expect((snippet as MdSnippet).name).toBe('note');
  });

  it('returns null for missing file', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);

    const snippet = await svc.load(`${ROOT}/missing.json`);
    expect(snippet).toBeNull();
  });

  it('returns null for out-of-root path (path-safety D-10)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const snippet = await svc.load(`${ROOT}/../../etc/passwd`);

    expect(snippet).toBeNull();
    expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('returns null for corrupt JSON', async () => {
    const p = `${ROOT}/bad.json`;
    const { vault } = makeVault({ files: { [p]: '{not json' } });
    const svc = new SnippetService({ vault } as never, settings);

    const snippet = await svc.load(p);
    expect(snippet).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// save(Snippet) branching + WriteMutex serialisation
// ---------------------------------------------------------------------------

describe('save(Snippet) branching (D-03, D-11)', () => {
  it('JSON save writes serialised JSON without runtime-only kind/path fields', async () => {
    const p = `${ROOT}/CT/a.json`;
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const svc = new SnippetService({ vault } as never, settings);

    const snippet: JsonSnippet = {
      kind: 'json',
      path: p,
      name: 'Alpha',
      template: 'hello {{x}}',
      placeholders: [{ id: 'x', label: 'X', type: 'free-text' }],
      validationError: null,
    };
    await svc.save(snippet);

    // Either create() or adapter.write() was used to persist payload
    const persisted = files[p];
    expect(persisted).toBeDefined();
    const parsed = JSON.parse(persisted!);
    expect(parsed).toEqual({
      name: 'Alpha',
      template: 'hello {{x}}',
      placeholders: [{ id: 'x', label: 'X', type: 'free-text' }],
    });
    // runtime-only fields must NOT be persisted
    expect(parsed).not.toHaveProperty('kind');
    expect(parsed).not.toHaveProperty('path');
    expect(parsed).not.toHaveProperty('id');
  });

  it('MD save writes raw content verbatim', async () => {
    const p = `${ROOT}/CT/raw.md`;
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const svc = new SnippetService({ vault } as never, settings);

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
    const p = `${ROOT}/CT/a.json`;
    const order: string[] = [];
    // Override write to be async and record ordering
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const origCreate = vault.create;
    vault.create = vi.fn(async (path: string, data: string) => {
      order.push('start:' + path);
      // yield to event loop so interleaving is possible if mutex is absent
      await new Promise((r) => setTimeout(r, 10));
      order.push('end:' + path);
      await origCreate(path, data);
    }) as unknown as typeof origCreate;
    // After the first save create()s the file, subsequent writes go through adapter.write()
    const origWrite = vault.adapter.write;
    vault.adapter.write = vi.fn(async (path: string, data: string) => {
      order.push('start:' + path);
      await new Promise((r) => setTimeout(r, 10));
      order.push('end:' + path);
      await origWrite(path, data);
    }) as unknown as typeof origWrite;

    const svc = new SnippetService({ vault } as never, settings);
    const s1: JsonSnippet = {
      kind: 'json',
      path: p,
      name: 'One',
      template: 't',
      placeholders: [],
      validationError: null,
    };
    const s2: JsonSnippet = {
      kind: 'json',
      path: p,
      name: 'Two',
      template: 't',
      placeholders: [],
      validationError: null,
    };

    await Promise.all([svc.save(s1), svc.save(s2)]);

    // Serialised: start/end must come in pairs, never interleaved
    expect(order).toHaveLength(4);
    expect(order[0]!.startsWith('start:')).toBe(true);
    expect(order[1]!.startsWith('end:')).toBe(true);
    expect(order[2]!.startsWith('start:')).toBe(true);
    expect(order[3]!.startsWith('end:')).toBe(true);
    // Final persisted value corresponds to one of the two writes
    expect(files[p]).toBeDefined();
  });

  it('JSON save strips control characters (sanitise, T-5-01)', async () => {
    const p = `${ROOT}/CT/ctrl.json`;
    const { vault, files } = makeVault({ folders: [ROOT, `${ROOT}/CT`] });
    const svc = new SnippetService({ vault } as never, settings);

    const snippet: JsonSnippet = {
      kind: 'json',
      path: p,
      name: 'Na\u0001me',
      template: 'tmpl\u0000here',
      placeholders: [
        { id: 'x', label: 'Lbl\u001F', type: 'free-text' },
      ],
      validationError: null,
    };
    await svc.save(snippet);

    const parsed = JSON.parse(files[p]!);
    expect(parsed.name).toBe('Name');
    expect(parsed.template).toBe('tmplhere');
    expect(parsed.placeholders[0].label).toBe('Lbl');
  });

  it('save rejects unsafe path (D-10)', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);

    const snippet: JsonSnippet = {
      kind: 'json',
      path: `${ROOT}/../../escape.json`,
      name: 'x',
      template: '',
      placeholders: [],
      validationError: null,
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
  it('calls vault.trash(file, false) exactly once', async () => {
    const p = `${ROOT}/CT/victim.json`;
    const { vault } = makeVault({
      files: { [p]: JSON.stringify({ name: 'v', template: 't', placeholders: [] }) },
    });
    const svc = new SnippetService({ vault } as never, settings);

    await svc.delete(p);

    expect(vault.trash).toHaveBeenCalledTimes(1);
    const [file, system] = vault.trash.mock.calls[0]!;
    expect((file as { path: string }).path).toBe(p);
    // CRITICAL: system=false — goes to Obsidian .trash/, not OS trash
    expect(system).toBe(false);
  });

  it('no-op when file missing (no throw, trash not called)', async () => {
    const p = `${ROOT}/CT/ghost.json`;
    const { vault } = makeVault(); // no abstract file
    const svc = new SnippetService({ vault } as never, settings);

    await expect(svc.delete(p)).resolves.toBeUndefined();
    expect(vault.trash).toHaveBeenCalledTimes(0);
  });

  it('rejects out-of-root path — trash NOT called', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
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
    const p = `${ROOT}/CT/a.json`;
    const { vault } = makeVault({ files: { [p]: '{}' } });
    const svc = new SnippetService({ vault } as never, settings);
    expect(await svc.exists(p)).toBe(true);
  });

  it('returns false for missing safe path', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    expect(await svc.exists(`${ROOT}/missing.json`)).toBe(false);
  });

  it('returns false for out-of-root path without touching adapter', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
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
    `${ROOT}/../evil.json`,
    '/absolute/path.json',
    `${ROOT}/sub/../../escape.json`,
    '.radiprotocol/snippets-evil/foo.json',
  ];

  let _errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  for (const bad of unsafePaths) {
    it(`load() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService({ vault } as never, settings);
      const r = await svc.load(bad);
      expect(r).toBeNull();
      expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    });

    it(`save() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService({ vault } as never, settings);
      const snippet: JsonSnippet = {
        kind: 'json',
        path: bad,
        name: 'x',
        template: '',
        placeholders: [],
        validationError: null,
      };
      await expect(svc.save(snippet)).rejects.toThrow(/unsafe path/);
      expect(vault.adapter.write).toHaveBeenCalledTimes(0);
      expect(vault.create).toHaveBeenCalledTimes(0);
    });

    it(`delete() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService({ vault } as never, settings);
      await svc.delete(bad);
      expect(vault.trash).toHaveBeenCalledTimes(0);
      expect(vault.getAbstractFileByPath).toHaveBeenCalledTimes(0);
    });

    it(`exists() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService({ vault } as never, settings);
      const r = await svc.exists(bad);
      expect(r).toBe(false);
      expect(vault.adapter.exists).toHaveBeenCalledTimes(0);
    });

    it(`listFolder() rejects ${bad}`, async () => {
      const { vault } = makeVault();
      const svc = new SnippetService({ vault } as never, settings);
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
    const svc = new SnippetService({ vault } as never, settings);
    await svc.createFolder(`${ROOT}/new-folder`);
    expect(folderSet.has(`${ROOT}/new-folder`)).toBe(true);
    expect(vault.createFolder).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second call does not throw', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    await svc.createFolder(`${ROOT}/x`);
    await expect(svc.createFolder(`${ROOT}/x`)).resolves.toBeUndefined();
  });

  it('rejects a path outside the root', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(svc.createFolder('../escape')).rejects.toThrow(/createFolder rejected/);
    expect(vault.createFolder).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

describe('deleteFolder (Phase 33 D-17)', () => {
  it('trashes the folder via vault.trash(folder, false)', async () => {
    const sub = `${ROOT}/sub`;
    const { vault } = makeVault({
      folders: [ROOT, sub],
      abstractFiles: { [sub]: { path: sub } },
    });
    const svc = new SnippetService({ vault } as never, settings);
    await svc.deleteFolder(sub);
    expect(vault.trash).toHaveBeenCalledTimes(1);
    expect(vault.trash.mock.calls[0]![1]).toBe(false);
  });

  it('is a no-op for unsafe paths', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await svc.deleteFolder('../escape');
    expect(vault.trash).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('is a no-op when the folder does not exist', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    await svc.deleteFolder(`${ROOT}/missing`);
    expect(vault.trash).toHaveBeenCalledTimes(0);
  });
});

describe('listFolderDescendants (Phase 33 D-15)', () => {
  it('returns files, folders, and total', async () => {
    const { vault } = makeVault({
      files: {
        [`${ROOT}/a/one.json`]: '{}',
        [`${ROOT}/a/b/two.md`]: '',
      },
      folders: [ROOT, `${ROOT}/a`, `${ROOT}/a/b`],
    });
    const svc = new SnippetService({ vault } as never, settings);
    const result = await svc.listFolderDescendants(`${ROOT}/a`);
    expect(result.total).toBe(result.files.length + result.folders.length);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/one\.json$/),
        expect.stringMatching(/two\.md$/),
      ]),
    );
    expect(result.folders).toEqual(expect.arrayContaining([`${ROOT}/a/b`]));
  });

  it('returns empty for unsafe path', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService({ vault } as never, settings);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await svc.listFolderDescendants('../escape');
    expect(result).toEqual({ files: [], folders: [], total: 0 });
    errSpy.mockRestore();
  });
});
