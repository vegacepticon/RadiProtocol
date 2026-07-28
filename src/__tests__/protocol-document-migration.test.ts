// src/__tests__/protocol-document-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateProtocolDocument } from '../protocol/protocol-document-migration';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';

const NOW = '2026-02-02T00:00:00.000Z';

function docWith(nodes: any[], edges: any[] = []): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol', version: 1, id: 'd1', title: 'T',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    nodes, edges,
  } as ProtocolDocumentV1;
}

describe('migrateProtocolDocument — discriminator + idempotency', () => {
  it('returns the same doc reference with changed:false when no legacy loop nodes', () => {
    const d = docWith([{ id: 'n1', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } }]);
    const result = migrateProtocolDocument(d, () => NOW);
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(d);
  });
  it('is idempotent — migrate(migrate(doc)) second call changed:false, same reference', () => {
    const d = docWith(
      [{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'Repeat?' } }],
      [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+Done' }],
    );
    const first = migrateProtocolDocument(d, () => NOW);
    expect(first.changed).toBe(true);
    const second = migrateProtocolDocument(first.doc, () => '2026-03-03T00:00:00.000Z');
    expect(second.changed).toBe(false);
    expect(second.doc).toBe(first.doc);
  });
});

describe('migrateProtocolDocument — node transform', () => {
  it('converts a legacy loop node to a looped question and preserves geometry/color/text', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 10, y: 20, width: 250, height: 60, color: 'rgba(233,30,99,0.24)', text: 'Repeat?', fields: { headerText: 'Repeat for each slice?' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    const node = doc.nodes[0]!;
    expect(node.kind).toBe('question');
    expect(node.fields['loop']).toBe(true);
    expect(node.fields['questionText']).toBe('Repeat for each slice?');
    expect(node.fields['headerText']).toBeUndefined();
    expect(node.x).toBe(10); expect(node.y).toBe(20);
    expect(node.color).toBe('rgba(233,30,99,0.24)'); expect(node.text).toBe('Repeat?');
  });
  it('preserves unrelated node fields', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H', startPointEnabled: true, customExt: 'keep' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['startPointEnabled']).toBe(true);
    expect(doc.nodes[0]!.fields['customExt']).toBe('keep');
  });
  it('falls back to legacy radiprotocol_headerText and removes the legacy key', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { radiprotocol_headerText: 'Legacy prompt' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['questionText']).toBe('Legacy prompt');
    expect(doc.nodes[0]!.fields['radiprotocol_headerText']).toBeUndefined();
  });
  it('non-string headerText normalizes to empty questionText', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 123 } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['questionText']).toBe('');
    expect(doc.nodes[0]!.fields['loop']).toBe(true);
  });
  it('non-object fields is handled defensively', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: 'not-an-object' as never }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.kind).toBe('question');
    expect(doc.nodes[0]!.fields['loop']).toBe(true);
    expect(doc.nodes[0]!.fields['questionText']).toBe('');
  });
  it('leaves non-loop nodes unchanged (changed:false)', () => {
    const d = docWith([
      { id: 'n1', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } },
      { id: 'n2', kind: 'answer', x: 0, y: 0, width: 250, height: 60, fields: { answerText: 'A' } },
    ]);
    const { doc, changed } = migrateProtocolDocument(d, () => NOW);
    expect(changed).toBe(false);
    expect(doc.nodes[0]!.kind).toBe('question');
    expect(doc.nodes[1]!.kind).toBe('answer');
  });
});

describe('migrateProtocolDocument — edge transform', () => {
  it('strips + prefix and sets isLoopExit on a legacy loop exit edge', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+выход' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('выход'); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('strips whitespace around and after the + prefix (nbsp)', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '  +\u00a0готово  ' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('готово'); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('empty + caption becomes undefined label with isLoopExit true', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBeUndefined(); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('body edge (no + prefix) from a loop node is unchanged', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-body', label: 'Body' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('Body'); expect(doc.edges[0]!.isLoopExit).toBeUndefined();
  });
  it('+-prefixed edge from a NON-loop node is NOT reclassified (no global + scanning)', () => {
    const d = docWith([{ id: 'n-q', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } }], [{ id: 'e1', fromNodeId: 'n-q', toNodeId: 'n-other', label: '+not-an-exit' }]);
    const { doc, changed } = migrateProtocolDocument(d, () => NOW);
    expect(changed).toBe(false);
    expect(doc.edges[0]!.label).toBe('+not-an-exit');
    expect(doc.edges[0]!.isLoopExit).toBeUndefined();
  });
  it('preserves edge ids/endpoints and unrelated edge fields', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+Done', customExt: 'keep' }] as any[]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.id).toBe('e1'); expect(doc.edges[0]!.fromNodeId).toBe('n-loop'); expect(doc.edges[0]!.toNodeId).toBe('n-next');
    expect((doc.edges[0] as any).customExt).toBe('keep');
  });
});

describe('migrateProtocolDocument — losslessness', () => {
  it('preserves document metadata, viewport, layoutDirection, selfCheck, unknown top-level fields, and bumps updatedAt', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }]);
    (d as any).viewport = { x: 1, y: 2, zoom: 0.5 };
    (d as any).layoutDirection = 'TB';
    (d as any).selfCheckEnabled = true;
    (d as any).selfCheckItems = ['item'];
    (d as any).unknownTopLevel = 'keep';
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.schema).toBe('radiprotocol.protocol'); expect(doc.version).toBe(1);
    expect(doc.id).toBe('d1'); expect(doc.title).toBe('T');
    expect(doc.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect((doc as any).viewport).toEqual({ x: 1, y: 2, zoom: 0.5 });
    expect((doc as any).layoutDirection).toBe('TB');
    expect((doc as any).selfCheckEnabled).toBe(true);
    expect((doc as any).selfCheckItems).toEqual(['item']);
    expect((doc as any).unknownTopLevel).toBe('keep');
    expect(doc.updatedAt).toBe(NOW);
  });
});