import { describe, it, expect, vi } from 'vitest';
import { LibraryService } from '../../library/library-service';
import type { RegistryClient } from '../../library/registry-client';
import type { LibraryInstaller, InstallResult, UninstallResult, RecoveryReport } from '../../library/library-installer';
import { LibraryCacheStore } from '../../library/library-cache-store';
import { InstalledRecordStore } from '../../library/installed-record-store';
import {
  CATALOG_SNAPSHOT_SCHEMA, CATALOG_SNAPSHOT_VERSION,
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  type CatalogEntry, type CatalogFetchResult, type ReleaseBundle,
} from '../../library/library-model';
import type { ReleaseFetchResult } from '../../library/registry-model';
import { installedRecordPath } from '../../library/installed-record-store';
import { packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { sha256String } from '../../library/integrity';
import { isReleaseResponse } from '../../library/registry-model';

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
    createFolder: vi.fn(async (_p: string) => { /* no-op */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

async function recPath(packageId: string, version: string): Promise<string> {
  return installedRecordPath(await packageNamespaceSegment(packageId), slugifyPackageId(version));
}

const SETTINGS = { protocolFolderPath: 'Protocols', snippetFolderPath: 'Snippets' };

function entry(packageId: string, title: string, cats: string[] = []): CatalogEntry {
  return {
    packageId, title, description: 'desc ' + packageId, author: { displayName: 'Dr ' + packageId },
    latestVersion: '1.0.0', categories: cats, updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeService(opts: {
  fetchCatalog?: CatalogFetchResult;
  fetchRelease?: ReleaseFetchResult;
  installResult?: InstallResult;
  uninstallResult?: UninstallResult;
  recovery?: RecoveryReport;
  files?: Record<string, string>;
} = {}) {
  const { vault } = makeVault({ files: opts.files });
  const app = makeApp(vault);
  const registryClient = {
    fetchCatalog: vi.fn(async () => opts.fetchCatalog ?? { status: 'unavailable', reason: 'no endpoint', cachedSnapshot: null }),
    fetchRelease: vi.fn(async () => opts.fetchRelease ?? { status: 'not-found', reason: 'not found' }),
  } as unknown as RegistryClient;
  const cacheStore = new LibraryCacheStore(app as never);
  const recordStore = new InstalledRecordStore(app as never);
  const installer = {
    install: vi.fn(async (_b: ReleaseBundle): Promise<InstallResult> => opts.installResult ?? { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' }),
    uninstall: vi.fn(async (_p: string, _v: string): Promise<UninstallResult> => opts.uninstallResult ?? { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' }),
    recoverInterrupted: vi.fn(async (): Promise<RecoveryReport> => opts.recovery ?? { committed: [], rolledBack: [], orphansCleaned: [] }),
    migrateInstalledRecords: vi.fn(async () => ({ migrated: [], skipped: [], failed: [] })),
  } as unknown as LibraryInstaller;
  const service = new LibraryService(app as never, SETTINGS, registryClient, { installer, cacheStore, recordStore });
  return { service, registryClient, installer, cacheStore, recordStore };
}

describe('LibraryService — listCatalog', () => {
  it('fetches and returns entries with available=true, caching the snapshot', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: '2026-01-01T00:00:00Z', entries: [entry('chest-ct', 'Chest CT', ['radiology'])] };
    const { service, cacheStore } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog();
    expect(r.available).toBe(true);
    expect(r.entries).toHaveLength(1);
    expect(r.fetchedAt).toBe('2026-01-01T00:00:00Z');
    const cached = await cacheStore.readSnapshot();
    expect(cached?.entries).toHaveLength(1);
  });

  it('serves the cached snapshot when unavailable, with available=false + reason', async () => {
    const cachedSnap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: '2025-01-01T00:00:00Z', entries: [entry('brain-mri', 'Brain MRI')] };
    const files: Record<string, string> = { '.radiprotocol/library/catalog-cache.json': JSON.stringify(cachedSnap, null, 2) + '\n' };
    const { service } = makeService({ fetchCatalog: { status: 'unavailable', reason: 'no endpoint', cachedSnapshot: null }, files });
    const r = await service.listCatalog();
    expect(r.available).toBe(false);
    expect(r.reason).toBe('no endpoint');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('brain-mri');
    expect(r.fetchedAt).toBe('2025-01-01T00:00:00Z');
  });

  it('returns empty entries when unavailable and no cache', async () => {
    const { service } = makeService({ fetchCatalog: { status: 'unavailable', reason: 'down', cachedSnapshot: null } });
    const r = await service.listCatalog();
    expect(r.available).toBe(false);
    expect(r.entries).toEqual([]);
  });

  it('filters by free-text query (case-insensitive across title/description/author/categories)', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [entry('chest-ct', 'Chest CT', ['radiology']), entry('brain-mri', 'Brain MRI', ['neuro'])] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'chest' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('chest-ct');
  });

  it('filters by exact category', async () => {
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [entry('chest-ct', 'Chest CT', ['radiology']), entry('brain-mri', 'Brain MRI', ['neuro'])] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ filter: 'neuro' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('brain-mri');
  });

  it('matches a query against the description field only (field isolation)', async () => {
    const a = entry('a', 'Alpha'); a.description = 'uniqueword';
    const b = entry('b', 'Beta');
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [a, b] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'uniqueword' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('a');
  });

  it('matches a query against the summary field', async () => {
    const a = entry('a', 'Alpha'); a.summary = 'hidden-term';
    const b = entry('b', 'Beta');
    const snap = { schema: CATALOG_SNAPSHOT_SCHEMA, version: CATALOG_SNAPSHOT_VERSION, fetchedAt: 't', entries: [a, b] };
    const { service } = makeService({ fetchCatalog: { status: 'ok', snapshot: snap } });
    const r = await service.listCatalog({ query: 'hidden-term' });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.packageId).toBe('a');
  });
});

describe('LibraryService — install', () => {
  it('fetches the release and delegates to installer.install', async () => {
    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
    const { service, registryClient, installer } = makeService({ fetchRelease: { status: 'ok', bundle } });
    const r = await service.install('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    expect(registryClient.fetchRelease).toHaveBeenCalledWith('chest-ct', '1.0.0');
    expect(installer.install).toHaveBeenCalledWith(bundle);
  });

  it('returns failed on not-found without calling installer', async () => {
    const { service, installer } = makeService({ fetchRelease: { status: 'not-found', reason: 'no such release' } });
    const r = await service.install('chest-ct', '9.9.9');
    expect(r.status).toBe('failed');
    if (r.status === 'failed') expect(r.reason).toContain('no such release');
    expect(installer.install).not.toHaveBeenCalled();
  });

  it('returns failed on unavailable', async () => {
    const { service } = makeService({ fetchRelease: { status: 'unavailable', reason: 'down' } });
    const r = await service.install('chest-ct', '1.0.0');
    expect(r.status).toBe('failed');
  });
});

describe('LibraryService — uninstall / listInstalled / recovery', () => {
  it('delegates uninstall to installer.uninstall', async () => {
    const { service, installer } = makeService({ uninstallResult: { status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0' } });
    const r = await service.uninstall('chest-ct', '1.0.0');
    expect(r.status).toBe('ok');
    expect(installer.uninstall).toHaveBeenCalledWith('chest-ct', '1.0.0');
  });

  it('delegates listInstalled to recordStore.list and returns seeded records', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const rp = await recPath('chest-ct', '1.0.0');
    const files: Record<string, string> = { [rp]: JSON.stringify(record, null, 2) + '\n' };
    const { service, recordStore } = makeService({ files });
    const spy = vi.spyOn(recordStore, 'list');
    const r = await service.listInstalled();
    expect(r).toHaveLength(1);
    expect(r[0]!.packageId).toBe('chest-ct');
    expect(spy).toHaveBeenCalled();
  });

  it('listInstalled returns [] when the store throws (dependency-throw safe-default)', async () => {
    const { service, recordStore } = makeService({});
    vi.spyOn(recordStore, 'list').mockRejectedValueOnce(new Error('store down'));
    const r = await service.listInstalled();
    expect(r).toEqual([]);
  });

  it('getInstalledRecord delegates to recordStore.read (seeded → record, missing → null)', async () => {
    const record = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const rp = await recPath('chest-ct', '1.0.0');
    const files: Record<string, string> = { [rp]: JSON.stringify(record, null, 2) + '\n' };
    const { service } = makeService({ files });
    expect((await service.getInstalledRecord('chest-ct', '1.0.0'))?.packageId).toBe('chest-ct');
    expect(await service.getInstalledRecord('chest-ct', '9.9.9')).toBe(null);
  });

  it('delegates recoverInterruptedInstalls to installer.recoverInterrupted', async () => {
    const { service, installer } = makeService({ recovery: { committed: [{ packageId: 'a', releaseVersion: '1' }], rolledBack: [], orphansCleaned: [] } });
    const r = await service.recoverInterruptedInstalls();
    expect(r.committed).toHaveLength(1);
    expect(installer.recoverInterrupted).toHaveBeenCalled();
  });
});

describe('LibraryService — buildLocalPackage / writePackageExport', () => {
  it('assembles a SOURCE bundle with correct hashes + un-rewritten refs', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const protoJson = JSON.stringify(protocolDoc, null, 2) + '\n';
    const snippetContent = '# Lung content\n';
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': protoJson, 'Snippets/lung.md': snippetContent };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0', author: { displayName: 'Roman' } });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bundle.manifest.protocolSha256).toBe(await sha256String(protoJson));
    expect(result.bundle.manifest.protocolDoc.nodes.find((n) => n.id === 'snip-1')!.fields['snippetPath']).toBe('lung.md');
    expect(result.bundle.snippetContents).toEqual([{ relPath: 'lung.md', content: snippetContent }]);
    expect(result.bundle.manifest.snippetFiles[0]!.sha256).toBe(await sha256String(snippetContent));
    expect(isReleaseResponse(result.bundle)).toBe(true);
  });

  it('FR-7: sets collisionWith when a same-slug package is already installed', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const protoJson = JSON.stringify(protocolDoc, null, 2) + '\n';
    const existingRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest.ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const seg = await packageNamespaceSegment('chest.ct');
    const vSlug = slugifyPackageId('1.0.0');
    const files: Record<string, string> = {
      'Protocols/chest-ct.rp.json': protoJson,
      'Snippets/lung.md': '# Lung\n',
      [installedRecordPath(seg, vSlug)]: JSON.stringify(existingRecord, null, 2) + '\n',
    };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.collisionWith).toBe('chest.ct');
  });

  it('fails on a subfolderPath-only node whose subfolder has no .md files (subfolder closure)', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { subfolderPath: 'empty-folder' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': JSON.stringify(protocolDoc, null, 2) + '\n' };
    const { service } = makeService({ files });
    const result = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('no .md files');
  });

  it('writePackageExport writes a single JSON that passes isReleaseResponse', async () => {
    const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = protocolDoc.nodes[0]!.id;
    protocolDoc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: 'lung.md' } });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    const files: Record<string, string> = { 'Protocols/chest-ct.rp.json': JSON.stringify(protocolDoc, null, 2) + '\n', 'Snippets/lung.md': '# Lung\n' };
    const { service } = makeService({ files });
    const build = await service.buildLocalPackage('Protocols/chest-ct.rp.json', { packageId: 'chest-ct', releaseVersion: '1.0.0' });
    if (build.status !== 'ok') throw new Error('build failed');
    await service.writePackageExport(build.bundle, 'Exports/chest-ct-1.0.0.json');
    const vault = (service as unknown as { app: { vault: { adapter: { read: (p: string) => Promise<string> } } } }).app.vault;
    const written = await vault.adapter.read('Exports/chest-ct-1.0.0.json');
    expect(isReleaseResponse(JSON.parse(written))).toBe(true);
  });
});
