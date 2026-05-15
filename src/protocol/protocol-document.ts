// src/protocol/protocol-document.ts
// Storage-neutral protocol document model for RadiProtocol.
// This is the canonical on-disk shape for .rp.json protocol files.
//
// Design goals:
// - Decouple from Obsidian Canvas internals (no .canvas dependency).
// - Keep fields diffable and human-readable.
// - Support schema evolution via version field.
// - Map cleanly to runtime ProtocolGraph without loss.

import type { RPNodeKind } from '../graph/graph-model';

/** Canonical schema identifier for RadiProtocol JSON files. */
export const PROTOCOL_SCHEMA = 'radiprotocol.protocol' as const;

/** Current on-disk schema version. Bump on breaking changes. */
export const PROTOCOL_VERSION = 1 as const;

/**
 * Canonical on-disk shape for a RadiProtocol protocol (.rp.json).
 * Versioned to allow future evolution without breaking existing files.
 */
export interface ProtocolDocumentV1 {
  /** Fixed schema identifier: 'radiprotocol.protocol' */
  schema: typeof PROTOCOL_SCHEMA;
  /** Schema version number. Current: 1 */
  version: typeof PROTOCOL_VERSION;
  /** Unique document ID (UUID or similar). */
  id: string;
  /** Human-readable protocol title. */
  title: string;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  /** ISO 8601 timestamp of last update. */
  updatedAt: string;
  /** All protocol nodes. Order is not semantically significant. */
  nodes: ProtocolNodeRecord[];
  /** All protocol edges. Order is not semantically significant. */
  edges: ProtocolEdgeRecord[];
  /** Whether final runner self-check checklist is enabled. */
  selfCheckEnabled?: boolean;
  /** Optional final runner self-check checklist items. */
  selfCheckItems?: string[];
  /** Optional viewport state for visual editor persistence. */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

/**
 * On-disk node record. Maps to runtime RPNode after parsing.
 *
 * Design notes:
 * - `kind` may be null for untyped nodes during authoring.
 * - `fields` is a flat key-value map; parser normalizes to typed RPNode shape.
 * - Legacy `radiprotocol_*` prefix is NOT used in new .rp.json files.
 *   Keys in `fields` use camelCase without prefix (e.g. 'questionText').
 */
export interface ProtocolNodeRecord {
  /** Unique node ID within the document. */
  id: string;
  /** Node kind. Null means untyped/plain node (authoring intermediate state). */
  kind: RPNodeKind | null;
  /** X coordinate in visual editor space (pixels). */
  x: number;
  /** Y coordinate in visual editor space (pixels). */
  y: number;
  /** Node width in pixels. */
  width: number;
  /** Node height in pixels. */
  height: number;
  /** Optional node background color (CSS color string). */
  color?: string;
  /** Optional raw text content (fallback for label/body). */
  text?: string;
  /**
   * Typed node fields. Keys are camelCase without prefix:
   * - questionText, answerText, displayLabel, content, separator,
   *   headerText, subfolderPath, snippetLabel, snippetSeparator, snippetPath.
   *
   * Parser validates field presence/absence per node kind.
   */
  fields: Record<string, unknown>;
}

/**
 * On-disk edge record. Maps directly to runtime RPEdge.
 */
export interface ProtocolEdgeRecord {
  /** Unique edge ID within the document. */
  id: string;
  /** Source node ID. Must reference an existing node. */
  fromNodeId: string;
  /** Target node ID. Must reference an existing node. */
  toNodeId: string;
  /** Optional edge label (shown on connector in visual editor and runner). */
  label?: string;
}

/**
 * Utility: generate a new ProtocolDocumentV1 with minimal valid structure.
 * Used by ProtocolDocumentStore.create() and tests.
 */
export function createEmptyProtocolDocument(
  id: string,
  title: string,
  now = new Date()
): ProtocolDocumentV1 {
  const iso = now.toISOString();
  return {
    schema: PROTOCOL_SCHEMA,
    version: PROTOCOL_VERSION,
    id,
    title,
    createdAt: iso,
    updatedAt: iso,
    nodes: [],
    edges: [],
  };
}

/**
 * Utility: check if a value looks like a ProtocolDocumentV1.
 * Does NOT validate field semantics — only schema/version shape.
 */
export function isProtocolDocumentV1(value: unknown): value is ProtocolDocumentV1 {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as Record<string, unknown>;
  return (
    doc['schema'] === PROTOCOL_SCHEMA &&
    doc['version'] === PROTOCOL_VERSION &&
    typeof doc['id'] === 'string' &&
    typeof doc['title'] === 'string' &&
    typeof doc['createdAt'] === 'string' &&
    typeof doc['updatedAt'] === 'string' &&
    Array.isArray(doc['nodes']) &&
    Array.isArray(doc['edges'])
  );
}
