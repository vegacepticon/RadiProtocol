// src/protocol/protocol-library-model.ts
// External protocol library index and install manifest types.

export interface ProtocolLibraryEntry {
  id: string;
  title: string;
  path: string;
  schema: 'radiprotocol.protocol';
  version: number;
  nodes?: number;
  edges?: number;
  description?: string;
}

export interface ProtocolLibraryIndex {
  version: string;
  protocols: ProtocolLibraryEntry[];
}

export interface ProtocolLibraryManifest {
  installed: Array<{ id: string; version: string }>;
}
