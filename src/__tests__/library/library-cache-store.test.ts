import { describe, it, expect, vi } from 'vitest';
import { LibraryCacheStore } from '../../library/library-cache-store';
import { CATALOG_SNAPSHOT_SCHEMA, CATALOG_SNAPSHOT_VERSION } from '../../library/library-model';
import { TFile } from '../../__mocks__/obsidian';

function makeVault(opts: { files?: Record<string, string>; folders?: string[] } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || folderSet.has(p)),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async () => ({ files: [], folders: [] })),
    },
    createFolder: vi.fn(async (p: string) => { folderSet.add(p); }),
    getAbstractFileByPath: vi.fn((p: string) => (p in files ? new TFile(p) : null)),
    getFiles: vi.fn(() => Object.keys(files).map((p) => new TFile(p))),
  };
  return { vault, files, folderSet };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

describe('LibraryCacheStore — readSnapshot', () => {
  it('returns null when the cache file is missing (empty initial state)', async () => {
    const { vault } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    expect(await store.readSnapshot()).toBe(null);
  });
  it('round-trips a written snapshot', async () => {
    const { vault, files } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [] };
    await store.writeSnapshot(snap);
    expect(files['.radiprotocol/library/catalog-cache.json']).toBeDefined();
    expect(await store.readSnapshot()).toEqual(snap);
  });
  it('throws LibraryStoreError(malformed) on invalid JSON', async () => {
    const { vault } = makeVault({ files: { '.radiprotocol/library/catalog-cache.json': 'not json' }, folders: ['.radiprotocol/library'] });
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await expect(store.readSnapshot()).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) on wrong schema', async () => {
    const { vault } = makeVault({ files: { '.radiprotocol/library/catalog-cache.json': JSON.stringify({ schema: 'other', version: 1, fetchedAt: 't', entries: [] }) }, folders: ['.radiprotocol/library'] });
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await expect(store.readSnapshot()).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('writes pretty JSON with a trailing newline', async () => {
    const { vault, files } = makeVault();
    const store = new LibraryCacheStore(makeApp(vault) as never);
    await store.writeSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [] });
    const written = files['.radiprotocol/library/catalog-cache.json']!;
    expect(written).toMatch(/\n$/);
    expect(written).toContain('  "schema"');
  });
});
