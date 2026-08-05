import { describe, it, expect } from 'vitest';
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  INSTALLED_RECORD_SCHEMA, CATALOG_SNAPSHOT_SCHEMA,
  isPackageManifest, isCatalogSnapshot, isInstalledRecord, isCatalogEntry,
  LibraryStoreError,
  type PackageManifest, type CatalogSnapshot, type InstalledRecord, type CatalogEntry,
} from '../../library/library-model';
import { createEmptyProtocolDocument } from '../../protocol/protocol-document';

function validManifest(): PackageManifest {
  return {
    schema: PACKAGE_MANIFEST_SCHEMA,
    version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct',
    releaseVersion: '1.0.0',
    protocolDoc: createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z')),
    protocolSha256: 'a'.repeat(64),
    snippetFiles: [{ relPath: 'lung-fields.md', sha256: 'b'.repeat(64) }],
    catalogEntryId: 'chest-ct',
    publishedAt: '2026-01-01T00:00:00Z',
  };
}

describe('library-model — isPackageManifest', () => {
  it('accepts a valid manifest', () => { expect(isPackageManifest(validManifest())).toBe(true); });
  it('rejects wrong schema sentinel', () => {
    expect(isPackageManifest({ ...validManifest(), schema: 'radiprotocol.protocol' })).toBe(false);
  });
  it('rejects wrong version', () => {
    expect(isPackageManifest({ ...validManifest(), version: 2 })).toBe(false);
  });
  it('rejects non-object and null', () => {
    expect(isPackageManifest(null)).toBe(false);
    expect(isPackageManifest('x')).toBe(false);
    expect(isPackageManifest(42)).toBe(false);
  });
  it('rejects missing packageId', () => {
    const m = validManifest(); delete (m as Partial<PackageManifest>).packageId;
    expect(isPackageManifest(m)).toBe(false);
  });
  it('rejects snippetFiles with a malformed entry', () => {
    const m = validManifest();
    (m as PackageManifest).snippetFiles = [null as unknown as PackageManifest['snippetFiles'][number]];
    expect(isPackageManifest(m)).toBe(false);
  });
});

describe('library-model — isCatalogSnapshot', () => {
  it('accepts a valid snapshot', () => {
    const s: CatalogSnapshot = { schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't', entries: [] };
    expect(isCatalogSnapshot(s)).toBe(true);
  });
  it('rejects wrong schema', () => {
    expect(isCatalogSnapshot({ schema: 'other', version: 1, fetchedAt: 't', entries: [] })).toBe(false);
  });
  it('rejects missing entries array', () => {
    expect(isCatalogSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't' })).toBe(false);
  });
  it('rejects a non-CatalogEntry in entries', () => {
    expect(isCatalogSnapshot({ schema: CATALOG_SNAPSHOT_SCHEMA, version: 1, fetchedAt: 't', entries: ['nope'] })).toBe(false);
  });
});

describe('library-model — isInstalledRecord', () => {
  function validRecord(): InstalledRecord {
    return {
      schema: INSTALLED_RECORD_SCHEMA, version: 1,
      packageId: 'chest-ct', releaseVersion: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      protocolPath: 'Protocols/library/chest-ct/1-0-0/chest-ct.rp.json',
      snippetNamespace: 'Snippets/library/chest-ct/1-0-0',
      snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
      protocolSha256: 'a'.repeat(64),
    };
  }
  it('accepts a valid per-release record', () => { expect(isInstalledRecord(validRecord())).toBe(true); });
  it('rejects wrong schema sentinel', () => {
    expect(isInstalledRecord({ ...validRecord(), schema: 'radiprotocol.installed-records' })).toBe(false);
  });
  it('rejects wrong version', () => {
    expect(isInstalledRecord({ ...validRecord(), version: 2 })).toBe(false);
  });
  it('rejects a malformed snippetFile entry', () => {
    const r = validRecord();
    (r as InstalledRecord).snippetFiles = [null as unknown as InstalledRecord['snippetFiles'][number]];
    expect(isInstalledRecord(r)).toBe(false);
  });
  it('rejects missing protocolPath', () => {
    const r = validRecord(); delete (r as Partial<InstalledRecord>).protocolPath;
    expect(isInstalledRecord(r)).toBe(false);
  });
});

describe('library-model — isCatalogEntry', () => {
  const baseEntry: CatalogEntry = {
    packageId: 'chest-ct', title: 'Chest CT', description: 'd',
    author: { displayName: 'Dr X' }, latestVersion: '1.0.0',
    categories: ['radiology'], updatedAt: 't',
  };
  it('accepts a valid entry', () => { expect(isCatalogEntry(baseEntry)).toBe(true); });
  it('accepts an entry with a string summary', () => {
    expect(isCatalogEntry({ ...baseEntry, summary: 's' })).toBe(true);
  });
  it('rejects a non-string summary', () => {
    expect(isCatalogEntry({ ...baseEntry, summary: 42 })).toBe(false);
  });
  it('rejects missing latestVersion', () => {
    const e = { ...baseEntry }; delete (e as Partial<CatalogEntry>).latestVersion;
    expect(isCatalogEntry(e)).toBe(false);
  });
  it('rejects missing author.displayName', () => {
    expect(isCatalogEntry({ ...baseEntry, author: {} })).toBe(false);
  });
  it('rejects missing author entirely', () => {
    const e = { ...baseEntry }; delete (e as Partial<CatalogEntry>).author;
    expect(isCatalogEntry(e)).toBe(false);
  });
  it('rejects categories with a non-string entry', () => {
    expect(isCatalogEntry({ ...baseEntry, categories: ['ok', null as unknown as string] })).toBe(false);
  });
});

describe('library-model — LibraryStoreError', () => {
  it('carries kind + path + message', () => {
    const err = new LibraryStoreError('malformed', '.radiprotocol/library/x.json', 'invalid JSON');
    expect(err.kind).toBe('malformed');
    expect(err.path).toBe('.radiprotocol/library/x.json');
    expect(err.message).toContain('malformed');
    expect(err.message).toContain('invalid JSON');
    expect(err instanceof Error).toBe(true);
  });
});
