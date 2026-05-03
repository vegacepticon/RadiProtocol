// snippets/library-model.ts
// Phase 86 (TEMPLATE-LIB-01): types for the external template library system.

export interface LibrarySnippetEntry {
  id: string;
  name: string;
  category: string;
  path: string;
  description: string;
}

export interface LibraryIndex {
  version: string;
  snippets: LibrarySnippetEntry[];
}

export interface LibraryManifest {
  installed: Array<{ id: string; version: string }>;
}
