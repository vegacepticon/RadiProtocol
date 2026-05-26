// snippets/library-model.ts
// Phase 86/93: types for the external template library system.

export type LibraryLanguage = 'ru' | 'en';
export type LibraryLanguageFilter = LibraryLanguage | 'all';
export type LibrarySnippetFormat = 'json' | 'md-template' | 'md';

export interface LibrarySnippetEntry {
  id: string;
  name: string;
  category: string;
  path: string;
  description: string;
  /** Source/library language. New generated indexes include this; legacy index.json does not. */
  lang?: LibraryLanguage;
  /** Source file format. New library uses md-template; legacy index.json was json. */
  format?: LibrarySnippetFormat;
  version?: number | string;
}

export interface LibraryIndex {
  version: string;
  language?: LibraryLanguage;
  snippets: LibrarySnippetEntry[];
}

export interface LibraryManifest {
  installed: Array<{ id: string; version: string; lang?: LibraryLanguage; path?: string }>;
}
