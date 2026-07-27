// Phase 4 — direct factory verification for createEmptyProtocolDocument's
// seeded Start node. Covers the default-ID shape, the explicit-ID override,
// unchanged document metadata, and a zero-error GraphValidator parse.
import { describe, it, expect } from 'vitest';
import { createEmptyProtocolDocument, isProtocolDocumentV1 } from '../protocol/protocol-document';
import { PROTOCOL_SCHEMA, PROTOCOL_VERSION } from '../protocol/protocol-document';
import { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import { GraphValidator } from '../graph/graph-validator';

describe('createEmptyProtocolDocument — seeded Start node (Phase 4)', () => {
  it('seeds one Start node at (0,0) with 200×80 dimensions, the editor default color, empty fields, and a node- prefixed ID', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'));
    expect(doc.nodes).toHaveLength(1);
    const node = doc.nodes[0]!;
    expect(node.kind).toBe('start');
    expect(node.x).toBe(0);
    expect(node.y).toBe(0);
    expect(node.width).toBe(200);
    expect(node.height).toBe(80);
    expect(node.color).toBe('rgba(76, 175, 80, 0.28)');
    expect(node.fields).toEqual({});
    expect(node.id.startsWith('node-')).toBe(true);
  });

  it('honors an explicit startNodeId fourth argument', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'start-fixed');
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]!.id).toBe('start-fixed');
    expect(doc.nodes[0]!.kind).toBe('start');
  });

  it('keeps edges empty and preserves schema/version/document metadata', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const doc = createEmptyProtocolDocument('id-1', 'My Title', now, 'start-fixed');
    expect(doc.edges).toEqual([]);
    expect(doc.schema).toBe(PROTOCOL_SCHEMA);
    expect(doc.version).toBe(PROTOCOL_VERSION);
    expect(doc.id).toBe('id-1');
    expect(doc.title).toBe('My Title');
    expect(doc.createdAt).toBe(now.toISOString());
    expect(doc.updatedAt).toBe(now.toISOString());
    expect(isProtocolDocumentV1(doc)).toBe(true);
  });

  it('produces a graph with zero GraphValidator errors (including no noStartNode)', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'start-fixed');
    const json = JSON.stringify(doc);
    const parseResult = new ProtocolDocumentParser().parse(json, 'protocols/T.rp.json');
    expect(parseResult.success).toBe(true);
    if (!parseResult.success) return;
    const validator = new GraphValidator();
    const errors = validator.validate(parseResult.graph);
    // No validation errors, in particular no missing-start-node error.
    expect(errors).toHaveLength(0);
    expect(errors.some((e) => /start/i.test(e))).toBe(false);
    expect(parseResult.graph.startNodeId).toBe('start-fixed');
  });
});