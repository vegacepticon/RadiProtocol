import { describe, it, expect } from 'vitest';
import { planRecordMigration } from '../../library/library-migration';
import type { InstalledRecord } from '../../library/library-model';
import type { ProtocolDocumentV1 } from '../../protocol/protocol-document';
import { PROTOCOL_SCHEMA, PROTOCOL_VERSION } from '../../protocol/protocol-document';
import { packageNamespaceSegment, slugifyPackageId, libraryProtocolFilePath, librarySnippetNamespace } from '../../library/library-paths';
import { installedRecordPath } from '../../library/installed-record-store';

const NOW = '2026-01-01T00:00:00Z';

function legacyRecord(packageId: string, version: string, protocolRoot: string, snippetRoot: string): InstalledRecord {
  const slug = slugifyPackageId(packageId);
  const vSlug = slugifyPackageId(version);
  return {
    schema: 'radiprotocol.installed-record' as never, version: 1 as never,
    packageId, releaseVersion: version, installedAt: NOW,
    protocolPath: `${protocolRoot}/library/${slug}/${vSlug}/${slug}.rp.json`,
    snippetNamespace: `${snippetRoot}/library/${slug}/${vSlug}`,
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }], protocolSha256: 'a'.repeat(64),
    author: { displayName: 'Dr Test' },
  };
}

function docWithSnippetNode(slug: string, vSlug: string): ProtocolDocumentV1 {
  return {
    schema: PROTOCOL_SCHEMA, version: PROTOCOL_VERSION, id: 'id-1', title: 'Chest CT',
    createdAt: NOW, updatedAt: NOW, layoutDirection: 'LR',
    nodes: [
      { id: 'start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {} },
      { id: 'snip-1', kind: 'snippet', x: 0, y: 0, width: 100, height: 100, fields: { snippetPath: `library/${slug}/${vSlug}/lung.md` } },
    ],
    edges: [{ id: 'e1', fromNodeId: 'start', toNodeId: 'snip-1' }],
  };
}

describe('library-migration — planRecordMigration', () => {
  it('returns changed:false for an already-migrated record (D2 discriminator)', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = { ...legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets'), protocolPath: libraryProtocolFilePath('Protocols', pkgSegment, vSlug) };
    const doc = docWithSnippetNode(pkgSegment, vSlug);
    expect(planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets')).toEqual({ changed: false });
  });

  it('rewrites record.protocolPath + snippetNamespace to slug+hash paths', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slugifyPackageId('chest-ct'), vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    expect(r.changed).toBe(true);
    if (!r.changed) return;
    expect(r.plan.record.protocolPath).toBe(libraryProtocolFilePath('Protocols', pkgSegment, vSlug));
    expect(r.plan.record.snippetNamespace).toBe(librarySnippetNamespace('Snippets', pkgSegment, vSlug));
  });

  it('is lossless — preserves author/installedAt/snippetFiles/packageId', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slugifyPackageId('chest-ct'), vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    expect(r.plan.record.author).toEqual({ displayName: 'Dr Test' });
    expect(r.plan.record.installedAt).toBe(NOW);
    expect(r.plan.record.snippetFiles).toEqual(record.snippetFiles);
    expect(r.plan.record.packageId).toBe('chest-ct');
    expect(r.plan.record.releaseVersion).toBe('1.0.0');
  });

  it('rewrites the embedded snippetPath ref to the new namespace', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    const snipNode = r.plan.rewrittenDoc.nodes.find((n) => n.id === 'snip-1')!;
    expect(snipNode.fields['snippetPath']).toBe(`library/${pkgSegment}/${vSlug}/lung.md`);
  });

  it('computes old/new marker paths + snippet moves', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const r = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!r.changed) return;
    expect(r.plan.oldMarkerPath).toBe(installedRecordPath(slug, vSlug));
    expect(r.plan.newMarkerPath).toBe(installedRecordPath(pkgSegment, vSlug));
    expect(r.plan.snippetMoves).toEqual([{ relPath: 'lung.md', oldPath: `Snippets/library/${slug}/${vSlug}/lung.md`, newPath: `Snippets/library/${pkgSegment}/${vSlug}/lung.md` }]);
  });

  it('is idempotent — migrating the migrated record+doc returns changed:false', async () => {
    const pkgSegment = await packageNamespaceSegment('chest-ct');
    const vSlug = slugifyPackageId('1.0.0');
    const slug = slugifyPackageId('chest-ct');
    const record = legacyRecord('chest-ct', '1.0.0', 'Protocols', 'Snippets');
    const doc = docWithSnippetNode(slug, vSlug);
    const first = planRecordMigration(record, doc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    if (!first.changed) return;
    const second = planRecordMigration(first.plan.record, first.plan.rewrittenDoc, pkgSegment, vSlug, 'Protocols', 'Snippets');
    expect(second.changed).toBe(false);
  });
});
