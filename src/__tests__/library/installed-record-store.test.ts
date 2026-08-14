import { describe, it, expect, vi } from 'vitest';
import { InstalledRecordStore, installedRecordPath } from '../../library/installed-record-store';
import { INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION, type InstalledRecord } from '../../library/library-model';
import { libraryProtocolFilePath, librarySnippetNamespace, packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';

/** Derive a one-level directory listing from the in-memory files map so the
 *  store's recursive `adapter.list` walk works in tests (mirrors the real
 *  adapter.list non-recursive contract — see src/snippets/snippet-service.ts:125). */
function listPath(files: Record<string, string>, dirPath: string): { files: string[]; folders: string[] } {
  const prefix = dirPath === '' ? '' : dirPath + '/';
  const out: string[] = [];
  const folders = new Set<string>();
  for (const p of Object.keys(files)) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    if (rest === '') continue;
    const slash = rest.indexOf('/');
    if (slash === -1) out.push(p);
    else folders.add(prefix + rest.slice(0, slash));
  }
  return { files: out, folders: [...folders] };
}

function makeVault(opts: { files?: Record<string, string> } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p === '' ? '' : p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async (p: string) => listPath(files, p)),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
    },
    // ensureFolderPath (src/utils/vault-utils.ts:12) calls vault.createFolder after adapter.exists returns false.
    createFolder: vi.fn(async (_p: string) => { /* no-op in-memory; existence is derived from the files map */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

/** Real per-release record path for (packageId, version), using the slug+hash segment. */
async function recPath(packageId: string, version: string): Promise<string> {
  return installedRecordPath(await packageNamespaceSegment(packageId), slugifyPackageId(version));
}

async function validRecord(packageId: string, version: string): Promise<InstalledRecord> {
  const pkgSegment = await packageNamespaceSegment(packageId);
  const versionSlug = slugifyPackageId(version);
  return {
    schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
    packageId, releaseVersion: version, installedAt: '2026-01-01T00:00:00Z',
    // Use the real slug+hash path helpers so stored paths match the installer's
    // actual installed paths (the namespace segment carries slug + shortHash).
    protocolPath: libraryProtocolFilePath('Protocols', pkgSegment, versionSlug),
    snippetNamespace: librarySnippetNamespace('Snippets', pkgSegment, versionSlug),
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
    protocolSha256: 'a'.repeat(64),
  };
}

describe('InstalledRecordStore — read', () => {
  it('returns null when the record file is missing', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    expect(await store.read('chest-ct', '1.0.0')).toBe(null);
  });
  it('round-trips a written record', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    const rec = await validRecord('chest-ct', '1.0.0');
    await store.write(rec);
    expect(await store.read('chest-ct', '1.0.0')).toEqual(rec);
  });
  it('throws LibraryStoreError(malformed) on invalid JSON', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: 'nope' } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) on wrong schema', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    const { vault } = makeVault({ files: { [path]: JSON.stringify({ schema: 'other', version: 1, packageId: 'x', releaseVersion: '1', installedAt: 't', protocolPath: 'a', snippetNamespace: 'b', snippetFiles: [], protocolSha256: 'h' }) } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
  it('throws LibraryStoreError(malformed) when record identity mismatches the path (D15 marker identity)', async () => {
    const path = await recPath('chest-ct', '1.0.0');
    // A structurally-valid record carrying a DIFFERENT (packageId, releaseVersion)
    // than its slot — a hand-moved/corrupted marker must not be trusted.
    const mismatched = { ...(await validRecord('brain-mri', '2.0.0')) };
    const { vault } = makeVault({ files: { [path]: JSON.stringify(mismatched) } });
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.read('chest-ct', '1.0.0')).rejects.toMatchObject({ name: 'LibraryStoreError', kind: 'malformed' });
  });
});

describe('InstalledRecordStore — list', () => {
  it('returns [] when the installed directory is absent (empty initial state)', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    expect(await store.list()).toEqual([]);
  });
  it('lists records across nested package/version folders', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await store.write(await validRecord('brain-mri', '2.0.0'));
    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.packageId).sort()).toEqual(['brain-mri', 'chest-ct']);
  });
  it('skips a corrupted single record (D15 per-file isolation, no throw)', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await vault.adapter.write(await recPath('brain-mri', '2.0.0'), 'not-json');
    const records = await store.list();
    expect(records).toHaveLength(1);
    expect(records[0]!.packageId).toBe('chest-ct');
  });
});

describe('InstalledRecordStore — write', () => {
  it('writes pretty JSON with a trailing newline at the per-release path', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    const path = await recPath('chest-ct', '1.0.0');
    const written = files[path]!;
    expect(written).toMatch(/\n$/);
    expect(written).toContain('  "schema"');
    expect(written).toContain('"radiprotocol.installed-record"');
  });
});

describe('InstalledRecordStore — delete', () => {
  it('removes the per-release record file', async () => {
    const { vault, files } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await store.write(await validRecord('chest-ct', '1.0.0'));
    await store.delete('chest-ct', '1.0.0');
    expect(files[await recPath('chest-ct', '1.0.0')]).toBeUndefined();
  });
  it('is a no-op when the file is missing', async () => {
    const { vault } = makeVault();
    const store = new InstalledRecordStore(makeApp(vault) as never);
    await expect(store.delete('chest-ct', '1.0.0')).resolves.toBeUndefined();
  });
});
