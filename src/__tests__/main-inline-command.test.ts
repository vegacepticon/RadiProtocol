// Phase 59 Wave 0 — INLINE-FIX-01 test scaffolding.
// These tests remain RED until Wave 1a exports resolveProtocolCanvasFiles from src/main.ts.
import { describe, it, expect, vi } from 'vitest';
import { TFile, TFolder } from 'obsidian';
import { resolveProtocolCanvasFiles } from '../main';

type TestTFileConstructor = new (path?: string) => TFile;
type TestTFolderConstructor = new (path?: string, children?: Array<TFile | TFolder>) => TFolder;
const TestTFile = TFile as unknown as TestTFileConstructor;
const TestTFolder = TFolder as unknown as TestTFolderConstructor;

// Build a fake vault whose getAbstractFileByPath reads from a path-keyed tree
// and whose getFiles() returns every TFile in the tree flattened.
function makeVault(tree: Record<string, TFile | TFolder>) {
  const allFiles: TFile[] = Object.values(tree).filter(
    (f): f is TFile => f instanceof TFile,
  );
  return {
    getAbstractFileByPath: vi.fn((p: string) => tree[p] ?? null),
    getFiles: vi.fn(() => allFiles),
  };
}

function buildNestedTree() {
  const nested = new TestTFile('templates/ALGO/nested.canvas');
  const root = new TestTFile('templates/ALGO/root.canvas');
  const mdNoise = new TestTFile('templates/ALGO/notes.md'); // must be excluded (not .canvas)
  const algoFolder = new TestTFolder('templates/ALGO', [nested, root, mdNoise]);
  const templatesFolder = new TestTFolder('templates', [algoFolder]);
  const tree: Record<string, TFile | TFolder> = {
    'templates': templatesFolder,
    'templates/ALGO': algoFolder,
    'templates/ALGO/nested.canvas': nested,
    'templates/ALGO/root.canvas': root,
    'templates/ALGO/notes.md': mdNoise,
  };
  return { tree, nested, root, algoFolder, templatesFolder };
}

describe('resolveProtocolCanvasFiles (INLINE-FIX-01)', () => {
  it('(a) resolves canonical multi-segment path with no trailing slash', () => {
    const { tree } = buildNestedTree();
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, 'templates/ALGO');
    expect(out.map(f => f.path).sort()).toEqual([
      'templates/ALGO/nested.canvas',
      'templates/ALGO/root.canvas',
    ]);
  });

  it('(b) normalizes a trailing slash — "templates/ALGO/" resolves identically', () => {
    const { tree } = buildNestedTree();
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, 'templates/ALGO/');
    expect(out.map(f => f.path).sort()).toEqual([
      'templates/ALGO/nested.canvas',
      'templates/ALGO/root.canvas',
    ]);
  });

  it('(b+) normalizes a leading slash — "/templates/ALGO" resolves identically', () => {
    const { tree } = buildNestedTree();
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, '/templates/ALGO');
    expect(out.map(f => f.path).sort()).toEqual([
      'templates/ALGO/nested.canvas',
      'templates/ALGO/root.canvas',
    ]);
  });

  it('(c) normalizes Windows backslashes — "templates\\\\ALGO" resolves identically', () => {
    const { tree } = buildNestedTree();
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, 'templates\\ALGO');
    expect(out.map(f => f.path).sort()).toEqual([
      'templates/ALGO/nested.canvas',
      'templates/ALGO/root.canvas',
    ]);
  });

  it('(d) falls back to vault.getFiles() when getAbstractFileByPath returns null but canvases exist under the prefix', () => {
    // Tree has canvas files but NO TFolder entry for "templates/ALGO" — simulates
    // an indexing quirk where getAbstractFileByPath returns null.
    const nested = new TestTFile('templates/ALGO/nested.canvas');
    const root = new TestTFile('templates/ALGO/root.canvas');
    const unrelated = new TestTFile('other/unrelated.canvas');
    const tree: Record<string, TFile | TFolder> = {
      'templates/ALGO/nested.canvas': nested,
      'templates/ALGO/root.canvas': root,
      'other/unrelated.canvas': unrelated,
      // NOTE: no 'templates/ALGO' folder entry — getAbstractFileByPath returns null for that path.
    };
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, 'templates/ALGO');
    expect(out.map(f => f.path).sort()).toEqual([
      'templates/ALGO/nested.canvas',
      'templates/ALGO/root.canvas',
    ]);
    // Fallback must NOT pull in unrelated canvases from siblings
    expect(out.map(f => f.path)).not.toContain('other/unrelated.canvas');
  });

  it('(e) returns an empty array when the folder exists but contains no canvases — caller is responsible for the D8 Notice', () => {
    const empty = new TestTFolder('templates/EMPTY', []);
    const tree: Record<string, TFile | TFolder> = {
      'templates/EMPTY': empty,
    };
    const vault = makeVault(tree);
    const out = resolveProtocolCanvasFiles(vault as any, 'templates/EMPTY');
    expect(out).toEqual([]);
  });

  it('(e+) returns an empty array when folderPath is blank or all-whitespace (defensive)', () => {
    const vault = makeVault({});
    expect(resolveProtocolCanvasFiles(vault as any, '')).toEqual([]);
    expect(resolveProtocolCanvasFiles(vault as any, '   ')).toEqual([]);
  });
});
