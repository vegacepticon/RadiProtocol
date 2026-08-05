import { describe, it, expect, vi } from 'vitest';
import { LibraryInstaller, type LibraryInstallerSettings } from '../../library/library-installer';
import {
  TransactionJournalIO, transactionJournalPath,
  TRANSACTIONS_SCHEMA, TRANSACTIONS_VERSION, type TransactionJournal,
} from '../../library/transaction-journal';
import { installedRecordPath } from '../../library/installed-record-store';
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  INSTALLED_RECORD_SCHEMA, INSTALLED_RECORD_VERSION,
  type ReleaseBundle, type PackageManifest,
} from '../../library/library-model';
import { sha256String } from '../../library/integrity';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';
import { WriteMutex } from '../../utils/write-mutex';

/** One-level directory listing derived from the in-memory files map (mirrors the
 *  real non-recursive adapter.list contract — see src/snippets/snippet-service.ts:125). */
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

function makeVault(opts: { files?: Record<string, string>; failWriteFor?: (p: string) => boolean } = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const failWriteFor = opts.failWriteFor ?? (() => false);
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || Object.keys(files).some((f) => f.startsWith(p === '' ? '' : p + '/'))),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT: ' + p); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => {
        if (failWriteFor(p)) throw new Error('write blocked: ' + p);
        files[p] = data;
      }),
      list: vi.fn(async (p: string) => listPath(files, p)),
      remove: vi.fn(async (p: string) => { delete files[p]; }),
    },
    createFolder: vi.fn(async (_p: string) => { /* no-op in-memory */ }),
  };
  return { vault, files };
}
const makeApp = (vault: ReturnType<typeof makeVault>['vault']) => ({ vault } as unknown);

const SETTINGS: LibraryInstallerSettings = { protocolFolderPath: 'Protocols', snippetFolderPath: 'Snippets' };

/** Build a valid ReleaseBundle with one start node, one snippet node bound to a
 *  .md file, and correct SHA-256 hashes (computed dynamically so the bundle is
 *  internally consistent). Selectively corruptible via the options. */
async function makeBundle(opts: {
  snippetContent?: string;
  tamperSnippetHash?: boolean;
  tamperProtocolHash?: boolean;
  snippetRelPath?: string;
  nodeSnippetPath?: string;
  undeclaredContent?: string;
} = {}): Promise<ReleaseBundle> {
  const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
  const startId = protocolDoc.nodes[0]!.id;
  const relPath = opts.snippetRelPath ?? 'lung.md';
  const nodeSnippetPath = opts.nodeSnippetPath ?? relPath;
  protocolDoc.nodes.push({
    id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
    fields: { snippetPath: nodeSnippetPath },
  });
  protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
  const snippetContent = opts.snippetContent ?? '# Lung content\n';
  const snippetSha = await sha256String(snippetContent);
  const protocolJson = JSON.stringify(protocolDoc, null, 2) + '\n';
  const protocolSha = await sha256String(protocolJson);
  const manifest: PackageManifest = {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct', releaseVersion: '1.0.0',
    protocolDoc,
    protocolSha256: opts.tamperProtocolHash ? '0'.repeat(64) : protocolSha,
    snippetFiles: [{ relPath, sha256: opts.tamperSnippetHash ? '0'.repeat(64) : snippetSha }],
    catalogEntryId: 'chest-ct', publishedAt: '2026-01-01T00:00:00Z',
  };
  const snippetContents = [{ relPath, content: snippetContent }];
  if (opts.undeclaredContent) snippetContents.push({ relPath: opts.undeclaredContent, content: 'extra' });
  return { manifest, snippetContents };
}

describe('LibraryInstaller — install', () => {
  it('installs a valid bundle: writes protocol + snippet + marker, removes journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('ok');
    expect(files['Protocols/library/chest-ct/1-0-0/chest-ct.rp.json']).toBeDefined();
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBe('# Lung content\n');
    const marker = JSON.parse(files[installedRecordPath('chest-ct', '1.0.0')]!);
    expect(marker.schema).toBe(INSTALLED_RECORD_SCHEMA);
    expect(marker.packageId).toBe('chest-ct');
    expect(marker.releaseVersion).toBe('1.0.0');
    expect(marker.protocolPath).toBe('Protocols/library/chest-ct/1-0-0/chest-ct.rp.json');
    // journal removed after commit
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('fails on snippet integrity mismatch (no final paths written, no marker)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ tamperSnippetHash: true }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('integrity');
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('fails on protocol integrity mismatch', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ tamperProtocolHash: true }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('protocol document');
  });

  it('fails on non-.md snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: 'lung.txt' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('.md');
  });

  it('fails on traversal snippet relPath', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetRelPath: '../escape.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('unsafe');
  });

  it('fails on undeclared snippet content', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ undeclaredContent: 'extra.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('not declared');
  });

  it('fails staged graph validation when a snippet node references a file not in the manifest (D-04 probe)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    // Manifest declares 'lung.md' but the snippet node references 'other.md'. The
    // staged probe composes Snippets/library/.../other.md, which is NOT in
    // plannedFinalPaths (only lung.md is) → GraphValidator D-04 rejects it.
    const result = await installer.install(await makeBundle({ nodeSnippetPath: 'other.md' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('invalid');
  });

  it('fails if already installed (marker present)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('already installed');
  });

  it('rolls back on commit failure: removes staged owned paths, no marker, journal removed', async () => {
    // adapter.write throws for the protocol path only — snippet writes succeed,
    // then the protocol write fails, triggering rollback of all owned paths.
    const { vault, files } = makeVault({ failWriteFor: (p) => p === 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json' });
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('commit failed');
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });
});

describe('LibraryInstaller — uninstall', () => {
  it('uninstalls an installed package: removes protocol + snippet + marker', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeDefined();
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files['Protocols/library/chest-ct/1-0-0/chest-ct.rp.json']).toBeUndefined();
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('returns not-installed when no valid marker exists', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('not-installed');
  });
});

describe('LibraryInstaller — recoverInterrupted', () => {
  /** Write a synthetic journal directly (simulating an interrupt that left a
   *  journal on disk) without going through the installer. */
  async function seedJournal(vault: unknown, markerPresent: boolean, stagedSnippet: boolean) {
    const files = (vault as { adapter: { write: (p: string, d: string) => Promise<void> } });
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: 'Snippets/library/chest-ct/1-0-0/lung.md', kind: 'owned' },
        { path: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json', kind: 'owned' },
        { path: installedRecordPath('chest-ct', '1.0.0'), kind: 'marker' },
      ],
    };
    await new TransactionJournalIO({ vault } as never).write(journal, new WriteMutex());
    if (stagedSnippet) await files.adapter.write('Snippets/library/chest-ct/1-0-0/lung.md', '# Lung content\n');
    if (markerPresent) {
      const marker = {
        schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
        packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
        protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
        snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
        snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
        protocolSha256: 'a'.repeat(64),
      };
      await files.adapter.write(installedRecordPath('chest-ct', '1.0.0'), JSON.stringify(marker, null, 2) + '\n');
    }
  }

  it('finalizes a committed install: marker present → remove journal only', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, true, true);
    const report = await installer.recoverInterrupted();
    expect(report.committed).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.rolledBack).toEqual([]);
    // committed install's files remain; journal removed
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeDefined();
    expect(files[installedRecordPath('chest-ct', '1.0.0')]).toBeDefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('rolls back an incomplete install: marker absent → remove owned paths + journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, false, true);
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('rolls back when the marker exists but its identity mismatches the journal slot (D15)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    // Seed a journal for chest-ct@1.0.0 but a marker carrying brain-mri@2.0.0 in
    // the chest-ct slot — a hand-moved/corrupted marker must not be trusted.
    const journalIO = new TransactionJournalIO(makeApp(vault) as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [{ path: 'Snippets/library/chest-ct/1-0-0/lung.md', kind: 'owned' }, { path: installedRecordPath('chest-ct', '1.0.0'), kind: 'marker' }],
    };
    await journalIO.write(journal, new WriteMutex());
    const mismatchedMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[installedRecordPath('chest-ct', '1.0.0')] = JSON.stringify(mismatchedMarker, null, 2) + '\n';
    files['Snippets/library/chest-ct/1-0-0/lung.md'] = '# Lung content\n';
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files['Snippets/library/chest-ct/1-0-0/lung.md']).toBeUndefined();
    expect(files[transactionJournalPath('chest-ct', '1.0.0')]).toBeUndefined();
  });

  it('returns an empty report when no transactions are in flight', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report).toEqual({ committed: [], rolledBack: [] });
  });
});
