// Phase 34 Plan 00 — SnippetService move/rename API unit tests.
// Covers: toCanvasKey, renameSnippet, moveSnippet, renameFolder, moveFolder,
// listAllFolders. Every suite asserts path-safety gating, collision pre-flight,
// WriteMutex wrapping, and self-descendant guards where applicable.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnippetService, toSnippetRelativePath } from '../snippets/snippet-service';

// ---------------------------------------------------------------------------
// Mock vault harness (kept local — mirrors snippet-service.test.ts pattern).
// ---------------------------------------------------------------------------

interface MockVaultOptions {
  files?: Record<string, string>;
  folders?: string[];
  abstractFiles?: Record<string, unknown>;
}

function makeVault(opts: MockVaultOptions = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  const abstractFiles: Record<string, unknown> = { ...(opts.abstractFiles ?? {}) };
  for (const p of Object.keys(files)) {
    if (!(p in abstractFiles)) abstractFiles[p] = { path: p, stat: {} };
  }
  for (const f of folderSet) {
    if (!(f in abstractFiles)) abstractFiles[f] = { path: f, children: [] };
  }

  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || folderSet.has(p)),
      read: vi.fn(async (p: string) => {
        if (!(p in files)) throw new Error('ENOENT: ' + p);
        return files[p]!;
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
      if (!(p in abstractFiles)) abstractFiles[p] = { path: p, children: [] };
    }),
    getAbstractFileByPath: vi.fn((p: string) => (p in abstractFiles ? abstractFiles[p] : null)),
    getFiles: vi.fn(() => Object.keys(files).map((path) => ({ path }))),
    read: vi.fn(async (file: { path: string }) => files[file.path]!),
    modify: vi.fn(async (file: { path: string }, content: string) => { files[file.path] = content; }),
    trash: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(async (file: { path: string }, newPath: string) => {
      const oldPath = file.path;
      // simulate file rename
      if (oldPath in files) {
        files[newPath] = files[oldPath]!;
        delete files[oldPath];
        delete abstractFiles[oldPath];
        abstractFiles[newPath] = { path: newPath, stat: {} };
      }
      // simulate folder rename (including descendants)
      if (folderSet.has(oldPath)) {
        folderSet.delete(oldPath);
        folderSet.add(newPath);
        delete abstractFiles[oldPath];
        abstractFiles[newPath] = { path: newPath, children: [] };
        for (const f of Array.from(folderSet)) {
          if (f.startsWith(oldPath + '/')) {
            folderSet.delete(f);
            folderSet.add(newPath + f.slice(oldPath.length));
          }
        }
        for (const fp of Object.keys(files)) {
          if (fp.startsWith(oldPath + '/')) {
            const np = newPath + fp.slice(oldPath.length);
            files[np] = files[fp]!;
            delete files[fp];
          }
        }
      }
      // update file.path ref (Obsidian mutates TFile.path)
      file.path = newPath;
    }),
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

// ---------------------------------------------------------------------------
// toSnippetRelativePath — pure helper (D-03)
// ---------------------------------------------------------------------------

describe('toSnippetRelativePath (Phase 34 D-03)', () => {
  it('strips snippet-root prefix and .md extension', () => {
    expect(toSnippetRelativePath(`${ROOT}/a/b.md`, ROOT)).toBe('a/b');
  });
  it('leaves .json extension intact (Phase 2 JSON-removal: stripping narrowed to .md)', () => {
    expect(toSnippetRelativePath(`${ROOT}/a/b.json`, ROOT)).toBe('a/b.json');
  });
  it('leaves folder path untouched after root strip', () => {
    expect(toSnippetRelativePath(`${ROOT}/a`, ROOT)).toBe('a');
  });
  it('returns empty string when vaultPath === snippetRoot', () => {
    expect(toSnippetRelativePath(ROOT, ROOT)).toBe('');
  });
  it('handles nested folder path with no extension', () => {
    expect(toSnippetRelativePath(`${ROOT}/a/sub/leaf`, ROOT)).toBe('a/sub/leaf');
  });
  it('leaves path unchanged when prefix does not match', () => {
    expect(toSnippetRelativePath('other/x.json', ROOT)).toBe('other/x.json');
  });
});

// ---------------------------------------------------------------------------
// renameSnippet
// ---------------------------------------------------------------------------

describe('renameSnippet (Phase 34 RENAME-03 service)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a .json source without renaming or rewriting it (Phase 2 JSON-removal)', async () => {
    const old = `${ROOT}/a/old.json`;
    const { vault, files } = makeVault({
      files: { [old]: '{"legacy":1}' },
      folders: [ROOT, `${ROOT}/a`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameSnippet(old, 'new')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    // Legacy file remains byte-for-byte at its old path.
    expect(files[old]).toBe('{"legacy":1}');
    expect(files[`${ROOT}/a/new.md`]).toBeUndefined();
    expect(files[`${ROOT}/a/new.json`]).toBeUndefined();
    errSpy.mockRestore();
  });

  it('preserves .md extension', async () => {
    const old = `${ROOT}/a/note.md`;
    const { vault } = makeVault({
      files: { [old]: 'raw' },
      folders: [ROOT, `${ROOT}/a`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.renameSnippet(old, 'renamed');
    expect(result).toBe(`${ROOT}/a/renamed.md`);
    errSpy.mockRestore();
  });

  it('rejects basename containing a slash', async () => {
    const old = `${ROOT}/a/x.md`;
    const { vault } = makeVault({ files: { [old]: 'raw' }, folders: [ROOT, `${ROOT}/a`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameSnippet(old, 'a/b')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('rejects empty / whitespace basename', async () => {
    const old = `${ROOT}/a/x.md`;
    const { vault } = makeVault({ files: { [old]: 'raw' }, folders: [ROOT, `${ROOT}/a`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameSnippet(old, '   ')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('rejects unsafe source path', async () => {
    const { vault } = makeVault();
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameSnippet(`${ROOT}/../escape.md`, 'new')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('no-op when new path equals old', async () => {
    const old = `${ROOT}/a/same.md`;
    const { vault } = makeVault({ files: { [old]: 'raw' }, folders: [ROOT, `${ROOT}/a`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.renameSnippet(old, 'same');
    expect(result).toBe(old);
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('throws on destination collision without touching source', async () => {
    const old = `${ROOT}/a/old.md`;
    const collide = `${ROOT}/a/new.md`;
    const { vault, files } = makeVault({
      files: { [old]: 'old', [collide]: 'keep' },
      folders: [ROOT, `${ROOT}/a`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameSnippet(old, 'new')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    expect(files[old]).toBe('old');
    expect(files[collide]).toBe('keep');
    errSpy.mockRestore();
  });

  it('serialises concurrent renames on the same source path via WriteMutex', async () => {
    const old = `${ROOT}/a/x.md`;
    const order: string[] = [];
    const { vault } = makeVault({ files: { [old]: 'raw' }, folders: [ROOT, `${ROOT}/a`] });
    const origRename = vault.rename;
    vault.rename = vi.fn(async (file: { path: string }, np: string) => {
      order.push('start:' + np);
      await new Promise((r) => setTimeout(r, 10));
      order.push('end:' + np);
      await origRename(file, np);
    }) as unknown as typeof vault.rename;
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    // Two sequential (awaited) calls — second one fails after the first renames,
    // but mutex ensures first completes before second begins. Assert start/end pairs are contiguous.
    const p1 = svc.renameSnippet(old, 'first').catch(() => undefined);
    const p2 = svc.renameSnippet(old, 'second').catch(() => undefined);
    await Promise.all([p1, p2]);

    // At least one rename completed fully (start immediately followed by end)
    expect(order.length % 2).toBe(0);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i]!.startsWith('start:')).toBe(true);
      expect(order[i + 1]!.startsWith('end:')).toBe(true);
    }
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// moveSnippet
// ---------------------------------------------------------------------------

describe('moveSnippet (Phase 34 MOVE-01 / MOVE-05 service)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('happy: moves file to new folder preserving basename', async () => {
    const old = `${ROOT}/a/x.md`;
    const { vault, files } = makeVault({
      files: { [old]: 'raw' },
      folders: [ROOT, `${ROOT}/a`, `${ROOT}/b`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.moveSnippet(old, `${ROOT}/b`);
    expect(result).toBe(`${ROOT}/b/x.md`);
    expect(vault.rename).toHaveBeenCalledTimes(1);
    expect(files[`${ROOT}/b/x.md`]).toBe('raw');
    expect(files[old]).toBeUndefined();
    errSpy.mockRestore();
  });

  it('ensures destination folder exists before rename', async () => {
    const old = `${ROOT}/a/x.md`;
    const { vault, folderSet } = makeVault({
      files: { [old]: 'raw' },
      folders: [ROOT, `${ROOT}/a`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await svc.moveSnippet(old, `${ROOT}/fresh`);
    expect(folderSet.has(`${ROOT}/fresh`)).toBe(true);
    errSpy.mockRestore();
  });

  it('throws on destination collision', async () => {
    const old = `${ROOT}/a/x.md`;
    const collide = `${ROOT}/b/x.md`;
    const { vault } = makeVault({
      files: { [old]: 'a', [collide]: 'b' },
      folders: [ROOT, `${ROOT}/a`, `${ROOT}/b`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveSnippet(old, `${ROOT}/b`)).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('rejects destination folder outside root', async () => {
    const old = `${ROOT}/a/x.md`;
    const { vault } = makeVault({ files: { [old]: 'raw' }, folders: [ROOT, `${ROOT}/a`] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveSnippet(old, '../elsewhere')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// renameFolder
// ---------------------------------------------------------------------------

describe('renameFolder (Phase 34 RENAME-03 service)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('happy: renames folder in place', async () => {
    const old = `${ROOT}/a/old`;
    const { vault, folderSet } = makeVault({
      folders: [ROOT, `${ROOT}/a`, old],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.renameFolder(old, 'new');
    expect(result).toBe(`${ROOT}/a/new`);
    expect(vault.rename).toHaveBeenCalledTimes(1);
    expect(folderSet.has(`${ROOT}/a/new`)).toBe(true);
    expect(folderSet.has(old)).toBe(false);
    errSpy.mockRestore();
  });

  it('rejects basename containing a slash', async () => {
    const old = `${ROOT}/a/old`;
    const { vault } = makeVault({ folders: [ROOT, `${ROOT}/a`, old] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameFolder(old, 'a/b')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('throws on destination collision', async () => {
    const old = `${ROOT}/a/old`;
    const collide = `${ROOT}/a/new`;
    const { vault } = makeVault({ folders: [ROOT, `${ROOT}/a`, old, collide] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.renameFolder(old, 'new')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// moveFolder — self-descendant guard is CRITICAL
// ---------------------------------------------------------------------------

describe('moveFolder (Phase 34 MOVE-02 / MOVE-05 service)', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('happy: moves folder into new parent', async () => {
    const old = `${ROOT}/a`;
    const { vault, folderSet } = makeVault({
      folders: [ROOT, old, `${ROOT}/b`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const result = await svc.moveFolder(old, `${ROOT}/b`);
    expect(result).toBe(`${ROOT}/b/a`);
    expect(vault.rename).toHaveBeenCalledTimes(1);
    expect(folderSet.has(`${ROOT}/b/a`)).toBe(true);
    errSpy.mockRestore();
  });

  it('ensures new parent exists before rename', async () => {
    const old = `${ROOT}/a`;
    const { vault, folderSet } = makeVault({ folders: [ROOT, old] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await svc.moveFolder(old, `${ROOT}/fresh`);
    expect(folderSet.has(`${ROOT}/fresh/a`)).toBe(true);
    errSpy.mockRestore();
  });

  it('SELF guard: moveFolder(a, a) throws', async () => {
    const old = `${ROOT}/a`;
    const { vault } = makeVault({ folders: [ROOT, old] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveFolder(old, old)).rejects.toThrow(/cannot move folder into itself/i);
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('DESCENDANT guard: moveFolder(a, a/sub) throws', async () => {
    const old = `${ROOT}/a`;
    const sub = `${ROOT}/a/sub`;
    const { vault } = makeVault({ folders: [ROOT, old, sub] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveFolder(old, sub)).rejects.toThrow(/itself/i);
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('throws on destination collision (target already has folder of same name)', async () => {
    const old = `${ROOT}/a`;
    const dstParent = `${ROOT}/b`;
    const collide = `${ROOT}/b/a`;
    const { vault } = makeVault({ folders: [ROOT, old, dstParent, collide] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveFolder(old, dstParent)).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });

  it('rejects destination parent outside root', async () => {
    const old = `${ROOT}/a`;
    const { vault } = makeVault({ folders: [ROOT, old] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    await expect(svc.moveFolder(old, '../elsewhere')).rejects.toThrow();
    expect(vault.rename).toHaveBeenCalledTimes(0);
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// listAllFolders
// ---------------------------------------------------------------------------

describe('listAllFolders (Phase 34 D-06)', () => {
  it('returns sorted list including root and all descendants', async () => {
    const { vault } = makeVault({
      folders: [ROOT, `${ROOT}/zeta`, `${ROOT}/alpha`, `${ROOT}/alpha/beta`],
    });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const folders = await svc.listAllFolders();
    expect(folders).toContain(ROOT);
    expect(folders).toContain(`${ROOT}/alpha`);
    expect(folders).toContain(`${ROOT}/alpha/beta`);
    expect(folders).toContain(`${ROOT}/zeta`);
    // sorted
    const sorted = [...folders].sort((a, b) => a.localeCompare(b));
    expect(folders).toEqual(sorted);
  });

  it('returns only the root when no descendants exist', async () => {
    const { vault } = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(vault) as never, settings);

    const folders = await svc.listAllFolders();
    expect(folders).toEqual([ROOT]);
  });
});

function protocolRefs(snippetPath: string, subfolderPath = ''): string {
  return JSON.stringify({
    schema: 'radiprotocol.protocol', version: 1, id: 'refs', title: 'Refs',
    createdAt: '2026-10-11', updatedAt: '2026-10-11', edges: [],
    nodes: [{ id: 'snippet', kind: 'snippet', x: 0, y: 0, width: 100, height: 60,
      fields: { snippetPath, subfolderPath } }],
  });
}

describe('service-owned path changes and reference reconciliation', () => {
  it.each([
    ['renameSnippet', 'old.md', 'new.md'],
    ['moveSnippet', 'old.md', 'dest/old.md'],
    ['relocateSnippet', 'old.md', 'dest/new.md'],
    ['renameFolder', 'folder/old.md', 'renamed/old.md'],
    ['moveFolder', 'folder/old.md', 'dest/folder/old.md'],
  ])('%s repairs references before returning', async (operation, oldRef, newRef) => {
    const v = makeVault({ files: { [`${ROOT}/${oldRef}`]: 'body', 'p.rp.json': protocolRefs(oldRef, 'folder') },
      folders: [ROOT, `${ROOT}/folder`, `${ROOT}/dest`] });
    const reports = vi.fn();
    const svc = new SnippetService(makeSnippetServiceApp(v.vault) as never, settings as never, undefined, reports);
    if (operation === 'renameSnippet') await svc.renameSnippet(`${ROOT}/old.md`, 'new');
    if (operation === 'moveSnippet') await svc.moveSnippet(`${ROOT}/old.md`, `${ROOT}/dest`);
    if (operation === 'relocateSnippet') await svc.relocateSnippet(`${ROOT}/old.md`, `${ROOT}/dest/new.md`);
    if (operation === 'renameFolder') await svc.renameFolder(`${ROOT}/folder`, 'renamed');
    if (operation === 'moveFolder') await svc.moveFolder(`${ROOT}/folder`, `${ROOT}/dest`);
    expect(v.files[`${ROOT}/${newRef}`]).toBe('body');
    const fields = JSON.parse(v.files['p.rp.json']!).nodes[0].fields;
    expect(fields.snippetPath).toBe(newRef);
    expect(fields.subfolderPath).toBe(operation === 'renameFolder' ? 'renamed'
      : operation === 'moveFolder' ? 'dest/folder' : 'folder');
    expect(reports).toHaveBeenCalledWith({ updated: ['p.rp.json'], skipped: [] });
    expect(v.vault.rename).toHaveBeenCalledTimes(1);
  });

  it('reports partial reference failures without rejecting a completed rename', async () => {
    const v = makeVault({ files: { [`${ROOT}/old.md`]: 'body', 'ok.rp.json': protocolRefs('old.md'), 'bad.rp.json': '{' } });
    const reports = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const svc = new SnippetService(makeSnippetServiceApp(v.vault) as never, settings as never, undefined, reports);
      await expect(svc.renameSnippet(`${ROOT}/old.md`, 'new')).resolves.toBe(`${ROOT}/new.md`);
      expect(JSON.parse(v.files['ok.rp.json']!).nodes[0].fields.snippetPath).toBe('new.md');
      expect(reports.mock.calls[0]![0].skipped).toEqual([{ path: 'bad.rp.json', reason: expect.any(String) }]);
    } finally { log.mockRestore(); }
  });

  it('serializes destination checks across two service instances without overwriting a winner', async () => {
    const v = makeVault({ files: { [`${ROOT}/a.md`]: 'A', [`${ROOT}/b.md`]: 'B' } });
    const app = makeSnippetServiceApp(v.vault);
    const a = new SnippetService(app as never, settings as never);
    const b = new SnippetService(app as never, settings as never);
    const results = await Promise.allSettled([
      a.renameSnippet(`${ROOT}/a.md`, 'dest'), b.renameSnippet(`${ROOT}/b.md`, 'dest'),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(v.files[`${ROOT}/dest.md`]).toBe('A');
    expect(v.files[`${ROOT}/b.md`]).toBe('B');
    expect(v.vault.rename).toHaveBeenCalledTimes(1);
  });

  it('a relocation failure leaves every protocol untouched', async () => {
    const v = makeVault({ files: { [`${ROOT}/old.md`]: 'body', 'p.rp.json': protocolRefs('old.md') } });
    v.vault.rename.mockRejectedValueOnce(new Error('rename failed'));
    const svc = new SnippetService(makeSnippetServiceApp(v.vault) as never, settings as never);
    await expect(svc.renameSnippet(`${ROOT}/old.md`, 'new')).rejects.toThrow('rename failed');
    expect(v.vault.read).not.toHaveBeenCalled();
    expect(v.vault.modify).not.toHaveBeenCalled();
    expect(v.files[`${ROOT}/old.md`]).toBe('body');
  });
});

describe('path-change completion semantics', () => {
  it('waits for protocol writes and serializes a subsequent rename', async () => {
    const v = makeVault({ files: { [`${ROOT}/a.md`]: 'body', 'p.rp.json': protocolRefs('a.md') } });
    const app = makeSnippetServiceApp(v.vault);
    const a = new SnippetService(app as never, settings as never);
    const b = new SnippetService(app as never, settings as never);
    const modify = v.vault.modify.getMockImplementation()!;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    v.vault.modify.mockImplementationOnce(async (file, content) => { await held; await modify(file, content); });
    let settled = false;
    const first = a.renameSnippet(`${ROOT}/a.md`, 'b').then(() => { settled = true; });
    for (let i = 0; i < 20 && v.vault.modify.mock.calls.length === 0; i++) await Promise.resolve();
    expect(v.vault.modify).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    const second = b.renameSnippet(`${ROOT}/b.md`, 'c');
    await Promise.resolve();
    expect(v.vault.rename).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(JSON.parse(v.files['p.rp.json']!).nodes[0].fields.snippetPath).toBe('c.md');
    expect(v.files[`${ROOT}/c.md`]).toBe('body');
  });

  it('does not touch storage when asked to move or rename the configured root', async () => {
    const v = makeVault({ folders: [ROOT] });
    const svc = new SnippetService(makeSnippetServiceApp(v.vault) as never, settings as never);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(svc.renameFolder(ROOT, 'new')).rejects.toThrow();
      await expect(svc.moveFolder(ROOT, `${ROOT}/nested`)).rejects.toThrow();
      expect(v.vault.adapter.exists).not.toHaveBeenCalled();
      expect(v.vault.rename).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it('a reporting exception cannot reject a successfully repaired rename', async () => {
    const v = makeVault({ files: { [`${ROOT}/old.md`]: 'body', 'p.rp.json': protocolRefs('old.md') } });
    const svc = new SnippetService(makeSnippetServiceApp(v.vault) as never, settings as never, undefined,
      () => { throw new Error('UI disposed'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(svc.renameSnippet(`${ROOT}/old.md`, 'new')).resolves.toBe(`${ROOT}/new.md`);
      expect(JSON.parse(v.files['p.rp.json']!).nodes[0].fields.snippetPath).toBe('new.md');
    } finally { log.mockRestore(); }
  });
});
