import { describe, it, expect } from 'vitest';
import {
  slugifyPackageId, validPackageSlug,
  libraryProtocolNamespace, librarySnippetNamespace,
  libraryProtocolFilePath, librarySnippetFilePath,
  isLibraryManagedPath, assertNoTraversal, assertInsideLibraryRoot,
  rewriteSnippetRef, buildReferenceMapping,
} from '../../library/library-paths';
import type { SnippetNode } from '../../graph/graph-model';

function snippetNode(id: string, opts: { snippetPath?: string; subfolderPath?: string }): SnippetNode {
  return {
    id, kind: 'snippet', x: 0, y: 0, width: 100, height: 100,
    radiprotocol_snippetPath: opts.snippetPath,
    subfolderPath: opts.subfolderPath,
  };
}

describe('library-paths — slugifyPackageId', () => {
  it('lowercases and dashes non letter/number runs', () => {
    expect(slugifyPackageId('Chest CT!')).toBe('chest-ct');
  });
  it('strips edge dashes', () => {
    expect(slugifyPackageId('  --Chest--CT--  ')).toBe('chest-ct');
  });
  it('preserves cyrillic', () => {
    expect(slugifyPackageId('Грудная КТ')).toBe('грудная-кт');
  });
  it('slugifies version tags', () => {
    expect(slugifyPackageId('1.0.0')).toBe('1-0-0');
  });
});

describe('library-paths — validPackageSlug', () => {
  it('returns the slug for a valid id', () => {
    expect(validPackageSlug('Chest CT')).toBe('chest-ct');
  });
  it('returns null when the id slugifies to empty', () => {
    expect(validPackageSlug('!!!')).toBe(null);
    expect(validPackageSlug('   ')).toBe(null);
  });
});

describe('library-paths — namespace derivation', () => {
  it('protocol namespace under root', () => {
    expect(libraryProtocolNamespace('Protocols', 'chest-ct', '1.0.0')).toBe('Protocols/library/chest-ct/1-0-0');
  });
  it('snippet namespace under root', () => {
    expect(librarySnippetNamespace('Snippets', 'chest-ct', '1.0.0')).toBe('Snippets/library/chest-ct/1-0-0');
  });
  it('protocol file path ends with <slug>.rp.json', () => {
    expect(libraryProtocolFilePath('Protocols', 'chest-ct', '1.0.0')).toBe('Protocols/library/chest-ct/1-0-0/chest-ct.rp.json');
  });
  it('snippet file path preserves relPath extension', () => {
    expect(librarySnippetFilePath('Snippets', 'chest-ct', '1.0.0', 'folder/lung.md')).toBe('Snippets/library/chest-ct/1-0-0/folder/lung.md');
  });
});

describe('library-paths — isLibraryManagedPath', () => {
  it('true for path under <root>/library/', () => {
    expect(isLibraryManagedPath('Snippets/library/chest-ct/1-0-0/lung.md', 'Snippets')).toBe(true);
  });
  it('false for user content under root', () => {
    expect(isLibraryManagedPath('Snippets/my-snippet.md', 'Snippets')).toBe(false);
  });
  it('false for sibling root (no partial-segment match)', () => {
    expect(isLibraryManagedPath('SnippetsOther/library/x.md', 'Snippets')).toBe(false);
  });
  it('true for the library folder itself', () => {
    expect(isLibraryManagedPath('Snippets/library', 'Snippets')).toBe(true);
  });
});

describe('library-paths — assertNoTraversal', () => {
  it('accepts a normal relative path', () => { expect(assertNoTraversal('folder/snippet.md')).toBe('folder/snippet.md'); });
  it('accepts root (empty)', () => { expect(assertNoTraversal('')).toBe(''); });
  it('rejects parent traversal', () => { expect(assertNoTraversal('../escape.md')).toBe(null); });
  it('rejects current-dir segments', () => { expect(assertNoTraversal('./x.md')).toBe(null); });
  it('rejects absolute leading slash', () => { expect(assertNoTraversal('/etc/x.md')).toBe(null); });
  it('rejects backslashes', () => { expect(assertNoTraversal('a\\b.md')).toBe(null); });
});

describe('library-paths — assertInsideLibraryRoot', () => {
  it('accepts path inside root with slash boundary', () => {
    expect(assertInsideLibraryRoot('Snippets/folder/x.md', 'Snippets')).toBe('Snippets/folder/x.md');
  });
  it('accepts root itself', () => {
    expect(assertInsideLibraryRoot('Snippets', 'Snippets')).toBe('Snippets');
  });
  it('rejects outside root (no partial-segment match)', () => {
    expect(assertInsideLibraryRoot('SnippetsOther/x.md', 'Snippets')).toBe(null);
  });
  it('rejects traversal', () => {
    expect(assertInsideLibraryRoot('Snippets/../x.md', 'Snippets')).toBe(null);
  });
  it('rejects backslashes', () => {
    expect(assertInsideLibraryRoot('Snippets\\x.md', 'Snippets')).toBe(null);
  });
});

describe('library-paths — rewriteSnippetRef', () => {
  it('exact match wins', () => {
    const m = new Map([['folder/snippet.md', 'library/p/v/folder/snippet.md']]);
    expect(rewriteSnippetRef('folder/snippet.md', m)).toBe('library/p/v/folder/snippet.md');
  });
  it('prefix match with slash boundary, longest wins', () => {
    const m = new Map([['folder', 'library/p/v/folderA'], ['folder/sub', 'library/p/v/folderB']]);
    expect(rewriteSnippetRef('folder/sub/x.md', m)).toBe('library/p/v/folderB/x.md');
  });
  it('no match returns null', () => {
    const m = new Map([['other.md', 'library/p/v/other.md']]);
    expect(rewriteSnippetRef('folder/snippet.md', m)).toBe(null);
  });
});

describe('library-paths — buildReferenceMapping', () => {
  it('maps file-bound snippetPath (extension-preserving)', () => {
    const nodes = [snippetNode('n1', { snippetPath: 'folder/lung.md' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('mapping' in r).toBe(true);
    if ('mapping' in r) expect(r.mapping.get('folder/lung.md')).toBe('library/chest-ct/1-0-0/folder/lung.md');
  });
  it('maps subfolderPath', () => {
    const nodes = [snippetNode('n1', { subfolderPath: 'folder' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    if ('mapping' in r) expect(r.mapping.get('folder')).toBe('library/chest-ct/1-0-0/folder');
  });
  it('errors on root-bound node (neither field set)', () => {
    const nodes = [snippetNode('n1', {})];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toContain('root-bound');
  });
  it('errors on traversal snippetPath', () => {
    const nodes = [snippetNode('n1', { snippetPath: '../escape.md' })];
    const r = buildReferenceMapping('chest-ct', '1.0.0', nodes);
    expect('error' in r).toBe(true);
  });
});
