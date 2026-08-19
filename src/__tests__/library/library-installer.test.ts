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
  type ReleaseBundle, type PackageManifest, type PackageSnippetFile, type InstalledRecord,
} from '../../library/library-model';
import { sha256String } from '../../library/integrity';
import { packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';
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

/** Expected vault-relative paths for a (packageId, version), using the slug+hash segment. */
async function pathsFor(packageId: string, version: string) {
  const s = await packageNamespaceSegment(packageId);
  const v = slugifyPackageId(version);
  return {
    segment: s,
    versionSlug: v,
    protocol: `Protocols/library/${s}/${v}/${s}.rp.json`,
    snippet: (relPath: string) => `Snippets/library/${s}/${v}/${relPath}`,
    snippetNs: `Snippets/library/${s}/${v}`,
    marker: installedRecordPath(s, v),
    journal: transactionJournalPath(s, v),
  };
}

/** Build a valid ReleaseBundle with one start node, one snippet node bound to a
 *  .md file, and correct SHA-256 hashes (computed dynamically so the bundle is
 *  internally consistent). Selectively corruptible via the options.
 *
 *  Multi-snippet mode (`snippetFiles`): one snippet node per entry (id `snip-<i>`,
 *  edge from the start node), each bound to its relPath via `fields.snippetPath`
 *  unless `nodeKind: 'subfolderPath'` → `fields.subfolderPath`. A subfolder entry
 *  is a directory NODE, not a declared file — it is omitted from
 *  manifest.snippetFiles so planInstall's .md-only check (src/library/library-installer.ts:316)
 *  never sees a directory relPath, and 1g-bis's "declared descendant" check keys
 *  off the file entries only. Per-entry SHA-256 via sha256String(content), the
 *  same dialect as the single-snippet path (tamperSnippetHash corrupts every hash). */
async function makeBundle(opts: {
  packageId?: string; version?: string;
  snippetContent?: string; tamperSnippetHash?: boolean; tamperProtocolHash?: boolean;
  snippetRelPath?: string; nodeSnippetPath?: string; undeclaredContent?: string;
  snippetFiles?: Array<{ relPath: string; content: string; nodeKind?: 'snippetPath' | 'subfolderPath' }>;
} = {}): Promise<ReleaseBundle> {
  const packageId = opts.packageId ?? 'chest-ct';
  const version = opts.version ?? '1.0.0';
  const protocolDoc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
  const startId = protocolDoc.nodes[0]!.id;

  if (opts.snippetFiles !== undefined) {
    opts.snippetFiles.forEach((entry, i) => {
      protocolDoc.nodes.push({
        id: `snip-${i}`, kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
        fields: entry.nodeKind === 'subfolderPath'
          ? { subfolderPath: entry.relPath }
          : { snippetPath: entry.relPath },
      });
      protocolDoc.edges.push({ id: `e${i}`, fromNodeId: startId, toNodeId: `snip-${i}` });
    });
  } else {
    const relPath = opts.snippetRelPath ?? 'lung.md';
    const nodeSnippetPath = opts.nodeSnippetPath ?? relPath;
    protocolDoc.nodes.push({
      id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
      fields: { snippetPath: nodeSnippetPath },
    });
    protocolDoc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
  }

  const protocolJson = JSON.stringify(protocolDoc, null, 2) + '\n';
  const protocolSha = await sha256String(protocolJson);

  // Manifest snippet entries + contents. The single-snippet path keeps its exact
  // legacy shape; the multi-snippet path hashes each entry's content the same way.
  let snippetFiles: PackageSnippetFile[];
  let snippetContents: Array<{ relPath: string; content: string }>;
  if (opts.snippetFiles !== undefined) {
    snippetFiles = [];
    snippetContents = [];
    for (const entry of opts.snippetFiles) {
      if (entry.nodeKind === 'subfolderPath') continue; // a subfolder node is not a declared file
      const sha = opts.tamperSnippetHash ? '0'.repeat(64) : await sha256String(entry.content);
      snippetFiles.push({ relPath: entry.relPath, sha256: sha });
      snippetContents.push({ relPath: entry.relPath, content: entry.content });
    }
  } else {
    const relPath = opts.snippetRelPath ?? 'lung.md';
    const snippetContent = opts.snippetContent ?? '# Lung content\n';
    const snippetSha = await sha256String(snippetContent);
    snippetFiles = [{ relPath, sha256: opts.tamperSnippetHash ? '0'.repeat(64) : snippetSha }];
    snippetContents = [{ relPath, content: snippetContent }];
  }
  if (opts.undeclaredContent) snippetContents.push({ relPath: opts.undeclaredContent, content: 'extra' });

  const manifest: PackageManifest = {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId, releaseVersion: version,
    protocolDoc,
    protocolSha256: opts.tamperProtocolHash ? '0'.repeat(64) : protocolSha,
    snippetFiles,
    catalogEntryId: packageId, publishedAt: '2026-01-01T00:00:00Z',
  };
  return { manifest, snippetContents };
}

/** Nested-relPath fixture: two files inside a declared subfolder plus one at the
 *  namespace root — the nested shape the parent-folder-creation seam (9b4a886,
 *  src/library/library-installer.ts:133) and the 1g-bis subfolder closure
 *  (src/library/library-installer.ts:361) were designed for. */
const NESTED_SNIPPET_FILES = [
  { relPath: 'chest/protocols/lung.md', content: '# Lung\n' },
  { relPath: 'chest/protocols/ct-overview.md', content: '# CT overview\n' },
  { relPath: 'summary.md', content: '# Summary\n' },
] as const;

describe('LibraryInstaller — install', () => {
  it('installs a valid bundle: writes protocol + snippet + marker, removes journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeDefined();
    expect(files[p.snippet('lung.md')]).toBe('# Lung content\n');
    const marker = JSON.parse(files[p.marker]!);
    expect(marker.schema).toBe(INSTALLED_RECORD_SCHEMA);
    expect(marker.packageId).toBe('chest-ct');
    expect(marker.releaseVersion).toBe('1.0.0');
    expect(marker.protocolPath).toBe(p.protocol);
    // journal removed after commit
    expect(files[p.journal]).toBeUndefined();
  });

  it('installs two colliding-slug packages to DISTINCT destinations (FR-1)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const r1 = await installer.install(await makeBundle({ packageId: 'chest.ct' }));
    const r2 = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    const p1 = await pathsFor('chest.ct', '1.0.0');
    const p2 = await pathsFor('chest-ct', '1.0.0');
    expect(p1.segment).not.toBe(p2.segment);
    expect(p1.segment.startsWith('chest-ct-')).toBe(true);
    expect(p2.segment.startsWith('chest-ct-')).toBe(true);
    expect(files[p1.protocol]).toBeDefined();
    expect(files[p2.protocol]).toBeDefined();
    expect(files[p1.marker]).toBeDefined();
    expect(files[p2.marker]).toBeDefined();
  });

  it('fails on snippet integrity mismatch (no final paths written, no marker)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({ tamperSnippetHash: true }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('integrity');
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
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
    const p = await pathsFor('chest-ct', '1.0.0');
    const { vault, files } = makeVault({ failWriteFor: (path) => path === p.protocol });
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle());
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('commit failed');
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });
});

describe('LibraryInstaller — uninstall', () => {
  it('uninstalls an installed package: removes protocol + snippet + marker', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    expect((await installer.install(await makeBundle())).status).toBe('ok');
    const p = await pathsFor('chest-ct', '1.0.0');
    expect(files[p.marker]).toBeDefined();
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
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
    const p = await pathsFor('chest-ct', '1.0.0');
    const journalIO = new TransactionJournalIO({ vault } as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: p.snippet('lung.md'), kind: 'owned' },
        { path: p.protocol, kind: 'owned' },
        { path: p.marker, kind: 'marker' },
      ],
    };
    await journalIO.write(journal, new WriteMutex());
    const files = vault as { adapter: { write: (p: string, data: string) => Promise<void> } };
    if (stagedSnippet) await files.adapter.write(p.snippet('lung.md'), '# Lung content\n');
    if (markerPresent) {
      const marker = {
        schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
        packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
        protocolPath: p.protocol,
        snippetNamespace: p.snippetNs,
        snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
        protocolSha256: 'a'.repeat(64),
      };
      await files.adapter.write(p.marker, JSON.stringify(marker, null, 2) + '\n');
    }
  }

  it('finalizes a committed install: marker present → remove journal only', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, true, true);
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.committed).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.rolledBack).toEqual([]);
    // committed install's files remain; journal removed
    expect(files[p.snippet('lung.md')]).toBeDefined();
    expect(files[p.marker]).toBeDefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('rolls back an incomplete install: marker absent → remove owned paths + journal', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedJournal(vault, false, true);
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('rolls back when the marker exists but its identity mismatches the journal slot (D15)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    // Seed a journal for chest-ct@1.0.0 but a marker carrying brain-mri@2.0.0 in
    // the chest-ct slot — a hand-moved/corrupted marker must not be trusted.
    const journalIO = new TransactionJournalIO(makeApp(vault) as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        { path: p.snippet('lung.md'), kind: 'owned' },
        { path: p.marker, kind: 'marker' },
      ],
    };
    await journalIO.write(journal, new WriteMutex());
    const mismatchedMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[p.marker] = JSON.stringify(mismatchedMarker, null, 2) + '\n';
    files[p.snippet('lung.md')] = '# Lung content\n';
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('returns an empty report when no transactions are in flight', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report).toEqual({ committed: [], rolledBack: [], orphansCleaned: [] });
  });
});

describe('LibraryInstaller — preflight collision/dirty-slot split', () => {
  it('detects a collision via a foreign marker at the slot and names both packageIds', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    const foreignMarker = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/brain-mri/2-0-0/brain-mri.rp.json',
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    files[p.marker] = JSON.stringify(foreignMarker, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('collision');
      expect(result.reason).toContain('brain-mri');
    }
  });

  it('detects a dirty slot (leftover files, no marker) and reports dirtySlotError', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'partial-leftover';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('recovery');
      expect(result.reason).toContain('chest-ct');
    }
  });

  it('detects a collision via a foreign record owning the protocol path (with a lister)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'foreign-protocol';
    const foreignRecord: InstalledRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'brain-mri', releaseVersion: '2.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: p.protocol,
      snippetNamespace: 'Snippets/library/brain-mri/2-0-0',
      snippetFiles: [], protocolSha256: 'a'.repeat(64),
    };
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, {
      listInstalled: async () => [foreignRecord],
    });
    const result = await installer.install(await makeBundle({ packageId: 'chest-ct' }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('collision');
      expect(result.reason).toContain('brain-mri');
    }
  });
});

describe('LibraryInstaller — recoverInterrupted orphan scan', () => {
  it('cleans a journal-less orphan namespace (no marker, no record)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('orphan-pkg', '1.0.0');
    files[p.protocol] = 'orphan-protocol';
    files[p.snippet('lung.md')] = 'orphan-snippet';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    const protoNs = p.protocol.slice(0, p.protocol.lastIndexOf('/'));
    expect(report.orphansCleaned.map((o) => o.namespace).sort()).toEqual([protoNs, p.snippetNs].sort());
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
  });

  it('does NOT clean a namespace whose marker .json is present (D6 safety)', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'orphan-protocol';
    files[p.marker] = 'corrupt-not-json';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const report = await installer.recoverInterrupted();
    expect(report.orphansCleaned).toEqual([]);
    expect(files[p.protocol]).toBeDefined();
  });

  it('does NOT clean a namespace owned by a valid installed record', async () => {
    const { vault, files } = makeVault();
    const p = await pathsFor('chest-ct', '1.0.0');
    files[p.protocol] = 'real-protocol';
    files[p.snippet('lung.md')] = 'real-snippet';
    const record: InstalledRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: p.protocol, snippetNamespace: p.snippetNs,
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    };
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, {
      listInstalled: async () => [record],
    });
    const report = await installer.recoverInterrupted();
    expect(report.orphansCleaned).toEqual([]);
    expect(files[p.protocol]).toBeDefined();
  });
});

describe('LibraryInstaller — migrateInstalledRecords', () => {
  it('migrates a legacy slug-only record to slug+hash paths + rewrites embedded refs', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = {
      schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
      protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs,
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [legacyRecord] });
    const report = await installer.migrateInstalledRecords();
    expect(report.migrated).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    const p = await pathsFor('chest-ct', '1.0.0');
    expect(files[p.protocol]).toBeDefined();
    expect(files[p.snippet('lung.md')]).toBe('# Lung content\n');
    expect(files[p.marker]).toBeDefined();
    expect(files[legacyProtoPath]).toBeUndefined();
    expect(files[`${legacySnipNs}/lung.md`]).toBeUndefined();
    expect(files[legacyMarker]).toBeUndefined();
    const migratedDoc = JSON.parse(files[p.protocol]!);
    expect(migratedDoc.nodes.find((n: { id: string }) => n.id === 'snip-1').fields.snippetPath).toBe(`library/${p.segment}/${vSlug}/lung.md`);
    const migratedRecord = JSON.parse(files[p.marker]!);
    expect(migratedRecord.protocolPath).toBe(p.protocol);
    expect(migratedRecord.snippetNamespace).toBe(p.snippetNs);
  });

  it('is idempotent — re-running on a migrated vault skips with no changes', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = { schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION, packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z', protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs, snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64) };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [JSON.parse(files[legacyMarker]!)] });
    await installer.migrateInstalledRecords();
    const p = await pathsFor('chest-ct', '1.0.0');
    const installer2 = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [JSON.parse(files[p.marker]!)] });
    const report2 = await installer2.migrateInstalledRecords();
    expect(report2.migrated).toEqual([]);
    expect(report2.skipped).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
  });

  it('uninstall after migration removes the new-namespace files', async () => {
    const { vault, files } = makeVault();
    const slug = slugifyPackageId('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const legacyProtoPath = `Protocols/library/${slug}/${vSlug}/${slug}.rp.json`;
    const legacySnipNs = `Snippets/library/${slug}/${vSlug}`;
    const legacyMarker = installedRecordPath(slug, vSlug);
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'));
    const startId = doc.nodes[0]!.id;
    doc.nodes.push({ id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } });
    doc.edges.push({ id: 'e1', fromNodeId: startId, toNodeId: 'snip-1' });
    files[legacyProtoPath] = JSON.stringify(doc, null, 2) + '\n';
    files[`${legacySnipNs}/lung.md`] = '# Lung content\n';
    const legacyRecord = { schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION, packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z', protocolPath: legacyProtoPath, snippetNamespace: legacySnipNs, snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64) };
    files[legacyMarker] = JSON.stringify(legacyRecord, null, 2) + '\n';
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS, { listInstalled: async () => [legacyRecord] });
    await installer.migrateInstalledRecords();
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('lung.md')]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
  });
});

describe('LibraryInstaller — nested relPath regression', () => {
  /** Write a synthetic journal with nested snippet entries directly (simulating
   *  an interrupt that left a journal on disk) without going through the
   *  installer — mirrors seedJournal in the recoverInterrupted describe above. */
  async function seedNestedJournal(vault: unknown, opts: { markerPresent: boolean; stagedSnippet: boolean }) {
    const p = await pathsFor('chest-ct', '1.0.0');
    const journalIO = new TransactionJournalIO({ vault } as never);
    const journal: TransactionJournal = {
      schema: TRANSACTIONS_SCHEMA, version: TRANSACTIONS_VERSION,
      packageId: 'chest-ct', releaseVersion: '1.0.0', startedAt: '2026-01-01T00:00:00Z',
      entries: [
        ...NESTED_SNIPPET_FILES.map((f) => ({ path: p.snippet(f.relPath), kind: 'owned' as const })),
        { path: p.protocol, kind: 'owned' as const },
        { path: p.marker, kind: 'marker' as const },
      ],
    };
    await journalIO.write(journal, new WriteMutex());
    const files = vault as { adapter: { write: (p: string, data: string) => Promise<void> } };
    if (opts.stagedSnippet) {
      for (const f of NESTED_SNIPPET_FILES) await files.adapter.write(p.snippet(f.relPath), f.content);
    }
    if (opts.markerPresent) {
      const marker = {
        schema: INSTALLED_RECORD_SCHEMA, version: INSTALLED_RECORD_VERSION,
        packageId: 'chest-ct', releaseVersion: '1.0.0', installedAt: '2026-01-01T00:00:00Z',
        protocolPath: p.protocol,
        snippetNamespace: p.snippetNs,
        snippetFiles: NESTED_SNIPPET_FILES.map((f) => ({ relPath: f.relPath, sha256: 'b'.repeat(64) })),
        protocolSha256: 'a'.repeat(64),
      };
      await files.adapter.write(p.marker, JSON.stringify(marker, null, 2) + '\n');
    }
  }

  it('installs a bundle with nested snippet relPaths: protocol, marker, nested + top-level files land in the namespace', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({ snippetFiles: [...NESTED_SNIPPET_FILES] }));
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeDefined();
    expect(files[p.marker]).toBeDefined();
    for (const f of NESTED_SNIPPET_FILES) {
      expect(files[p.snippet(f.relPath)]).toBe(f.content);
    }
    expect(files[p.journal]).toBeUndefined();
  });

  it('creates the nested parent folder via vault.createFolder — never a full file path (9b4a886 seam)', async () => {
    const { vault } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({ snippetFiles: [...NESTED_SNIPPET_FILES] }));
    expect(result.status).toBe('ok');
    const folderCalls = vault.createFolder.mock.calls.map(([arg]) => arg as string);
    expect(folderCalls).toContain(`${p.snippetNs}/chest/protocols`);
    expect(folderCalls.every((dir) => !dir.endsWith('.md') && !dir.endsWith('.json'))).toBe(true);
  });

  it('rewrites every nested snippet ref to a namespace-scoped, extension-preserving path', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({ snippetFiles: [...NESTED_SNIPPET_FILES] }));
    expect(result.status).toBe('ok');
    const installedDoc = JSON.parse(files[p.protocol]!);
    const snippetNodes = installedDoc.nodes.filter((n: { kind: string }) => n.kind === 'snippet');
    expect(snippetNodes).toHaveLength(NESTED_SNIPPET_FILES.length);
    const expected = new Set(NESTED_SNIPPET_FILES.map((f) => `library/${p.segment}/${p.versionSlug}/${f.relPath}`));
    for (const node of snippetNodes) {
      expect(expected.has(node.fields['snippetPath'])).toBe(true);
    }
  });

  it('uninstalls a nested bundle: nested files, top-level snippet, protocol, and marker removed; snippet namespace empty', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    expect((await installer.install(await makeBundle({ snippetFiles: [...NESTED_SNIPPET_FILES] }))).status).toBe('ok');
    const result = await installer.uninstall('chest-ct', '1.0.0');
    expect(result.status).toBe('ok');
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.marker]).toBeUndefined();
    for (const f of NESTED_SNIPPET_FILES) {
      expect(files[p.snippet(f.relPath)]).toBeUndefined();
    }
    const listing = await vault.adapter.list(p.snippetNs);
    expect(listing.files).toEqual([]);
    expect(listing.folders).toEqual([]);
  });

  it('rolls back a nested install on commit failure: nested staged files removed, no marker, journal removed', async () => {
    const p = await pathsFor('chest-ct', '1.0.0');
    const { vault, files } = makeVault({ failWriteFor: (path) => path === p.protocol });
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const result = await installer.install(await makeBundle({ snippetFiles: [...NESTED_SNIPPET_FILES] }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('commit failed');
    for (const f of NESTED_SNIPPET_FILES) {
      expect(files[p.snippet(f.relPath)]).toBeUndefined();
    }
    expect(files[p.marker]).toBeUndefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('recovers a nested install with a valid marker: files retained, journal removed (committed)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedNestedJournal(vault, { markerPresent: true, stagedSnippet: true });
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.committed).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.rolledBack).toEqual([]);
    for (const f of NESTED_SNIPPET_FILES) {
      expect(files[p.snippet(f.relPath)]).toBeDefined();
    }
    expect(files[p.marker]).toBeDefined();
    expect(files[p.journal]).toBeUndefined();
  });

  it('recovers a nested install without a marker: nested files removed, journal removed (rolled back)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    await seedNestedJournal(vault, { markerPresent: false, stagedSnippet: true });
    const p = await pathsFor('chest-ct', '1.0.0');
    const report = await installer.recoverInterrupted();
    expect(report.rolledBack).toEqual([{ packageId: 'chest-ct', releaseVersion: '1.0.0' }]);
    expect(report.committed).toEqual([]);
    for (const f of NESTED_SNIPPET_FILES) {
      expect(files[p.snippet(f.relPath)]).toBeUndefined();
    }
    expect(files[p.journal]).toBeUndefined();
  });

  it('installs a subfolderPath-only node at a nested dir with declared descendants (1g-bis closure satisfied)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({
      snippetFiles: [
        { relPath: 'chest/protocols', content: '', nodeKind: 'subfolderPath' },
        { relPath: 'chest/protocols/lung.md', content: '# Lung\n' },
        { relPath: 'chest/protocols/ct-overview.md', content: '# CT overview\n' },
      ],
    }));
    expect(result.status).toBe('ok');
    expect(files[p.snippet('chest/protocols/lung.md')]).toBe('# Lung\n');
    expect(files[p.snippet('chest/protocols/ct-overview.md')]).toBe('# CT overview\n');
    const installedDoc = JSON.parse(files[p.protocol]!);
    const subfolderNode = installedDoc.nodes.find(
      (n: { kind: string; fields: Record<string, unknown> }) =>
        n.kind === 'snippet' && n.fields['subfolderPath'] !== undefined,
    );
    expect(subfolderNode.fields['subfolderPath']).toBe(`library/${p.segment}/${p.versionSlug}/chest/protocols`);
  });

  it('refuses a subfolderPath-only node with no declared descendant (1g-bis)', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({
      snippetFiles: [{ relPath: 'chest/protocols', content: '', nodeKind: 'subfolderPath' }],
    }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.reason).toContain('subfolder');
      expect(result.reason).toContain('chest/protocols');
    }
    expect(files[p.marker]).toBeUndefined();
    expect(files[p.protocol]).toBeUndefined();
  });

  it('rejects a traversal relPath escaping through a nested segment (chest/../escape.md) with zero final-path writes', async () => {
    const { vault, files } = makeVault();
    const installer = new LibraryInstaller(makeApp(vault) as never, SETTINGS);
    const p = await pathsFor('chest-ct', '1.0.0');
    const result = await installer.install(await makeBundle({
      snippetFiles: [
        { relPath: 'chest/../escape.md', content: 'nope' },
        { relPath: 'summary.md', content: '# Summary\n' },
      ],
    }));
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason).toContain('unsafe');
    expect(files[p.marker]).toBeUndefined();
    expect(files[p.protocol]).toBeUndefined();
    expect(files[p.snippet('summary.md')]).toBeUndefined();
  });
});
