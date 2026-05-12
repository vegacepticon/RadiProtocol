// src/__tests__/protocol-document-store.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ProtocolDocumentStore, PROTOCOL_FILE_EXTENSION } from '../protocol/protocol-document-store';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';
import { TFile, TFolder } from '../__mocks__/obsidian';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

interface MockVaultOptions {
  files?: Record<string, string>;
  folders?: string[];
}

function makeVault(opts: MockVaultOptions = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);

  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || folderSet.has(p)),
      read: vi.fn(async (p: string) => {
        if (!(p in files)) throw new Error('ENOENT: ' + p);
        return files[p];
      }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async (p: string) => {
        const prefix = p + '/';
        const childFiles: string[] = [];
        const childFolders = new Set<string>();
        for (const fp of Object.keys(files)) {
          if (fp.startsWith(prefix)) {
            const rest = fp.slice(prefix.length);
            if (!rest.includes('/')) childFiles.push(fp);
          }
        }
        for (const folder of folderSet) {
          if (folder.startsWith(prefix)) {
            const rest = folder.slice(prefix.length);
            if (rest !== '' && !rest.includes('/')) childFolders.add(folder);
          }
        }
        return { files: childFiles, folders: Array.from(childFolders) };
      }),
    },
    create: vi.fn(async (p: string, data: string) => {
      files[p] = data;
    }),
    createFolder: vi.fn(async (p: string) => { folderSet.add(p); }),
    getAbstractFileByPath: vi.fn((p: string) => {
      // Recursively build folder hierarchy
      function buildFolder(path: string): TFolder {
        const children: Array<TFile | TFolder> = [];
        const seenSubfolders = new Set<string>();
        for (const fp of Object.keys(files)) {
          const parentSlash = fp.lastIndexOf('/');
          const parent = parentSlash >= 0 ? fp.substring(0, parentSlash) : '';
          if (parent === path) {
            children.push(new TFile(fp));
          } else if (fp.startsWith(path + '/')) {
            const rest = fp.slice(path.length + 1);
            const firstSlash = rest.indexOf('/');
            if (firstSlash >= 0) {
              const sub = rest.substring(0, firstSlash);
              if (!seenSubfolders.has(sub)) {
                seenSubfolders.add(sub);
                const subPath = path + '/' + sub;
                if (folderSet.has(subPath)) {
                  children.push(buildFolder(subPath));
                }
              }
            }
          }
        }
        return new TFolder(path, children);
      }
      if (folderSet.has(p)) return buildFolder(p);
      if (p in files) return new TFile(p);
      return null;
    }),
    getFiles: vi.fn(() => Object.keys(files).map(p => new TFile(p))),
    trash: vi.fn(async (_file: unknown, _system: boolean) => {}),
    delete: vi.fn(),
  };
  return { vault, files, folderSet };
}

function makeApp(vault: ReturnType<typeof makeVault>['vault']) {
  return {
    vault,
    fileManager: {
      trashFile: vi.fn(async (file: unknown) => vault.trash(file, false)),
    },
  } as unknown;
}

const VALID_DOC = {
  schema: 'radiprotocol.protocol',
  version: 1,
  id: 'test-doc-1',
  title: 'Test Protocol',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [],
  edges: [],
} as ProtocolDocumentV1;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtocolDocumentStore — read', () => {
  it('returns null for non-existent file', async () => {
    const { vault } = makeVault();
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/missing.rp.json');
    expect(result).toBeNull();
  });

  it('parses a valid .rp.json document', async () => {
    const { vault } = makeVault({
      files: { 'protocols/test.rp.json': JSON.stringify(VALID_DOC) },
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/test.rp.json');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-doc-1');
    expect(result!.title).toBe('Test Protocol');
  });

  it('returns null for invalid schema', async () => {
    const { vault } = makeVault({
      files: { 'protocols/bad.rp.json': JSON.stringify({ schema: 'wrong', version: 1 }) },
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/bad.rp.json');
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const { vault } = makeVault({
      files: { 'protocols/corrupt.rp.json': '{ invalid json' },
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/corrupt.rp.json');
    expect(result).toBeNull();
  });
});

describe('ProtocolDocumentStore — write', () => {
  it('writes valid document to disk', async () => {
    const { vault, files } = makeVault();
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    await store.write('protocols/new.rp.json', VALID_DOC);
    expect(vault.adapter.write).toHaveBeenCalled();
    expect(files['protocols/new.rp.json']).toContain('"radiprotocol.protocol"');
  });

  it('calls adapter.write only once (mutex serializes)', async () => {
    const { vault } = makeVault({ folders: ['protocols'] });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    await Promise.all([
      store.write('protocols/x.rp.json', { ...VALID_DOC, id: 'a' }),
      store.write('protocols/y.rp.json', { ...VALID_DOC, id: 'b' }),
    ]);
    expect(vault.adapter.write).toHaveBeenCalledTimes(2);
  });
});

describe('ProtocolDocumentStore — update', () => {
  it('applies mutator to existing document', async () => {
    const { vault, files } = makeVault({
      files: { 'protocols/existing.rp.json': JSON.stringify(VALID_DOC) },
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.update('protocols/existing.rp.json', (doc) => {
      return { ...doc!, title: 'Updated Title' };
    });
    expect(result.title).toBe('Updated Title');
    expect(JSON.parse(files['protocols/existing.rp.json']!).title).toBe('Updated Title');
  });

  it('creates via null when file does not exist', async () => {
    const { vault, files } = makeVault({ folders: ['protocols'] });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.update('protocols/new-via-update.rp.json', (doc) => {
      expect(doc).toBeNull();
      return { ...VALID_DOC, id: 'new-1', title: 'New Protocol' };
    });
    expect(result.title).toBe('New Protocol');
    expect(files['protocols/new-via-update.rp.json']).toBeDefined();
  });
});

describe('ProtocolDocumentStore — create', () => {
  it('creates a protocol file with title and id', async () => {
    const { vault } = makeVault({
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.create('protocols', 'My Protocol', 'gen-id-123');
    expect(result.doc.id).toBe('gen-id-123');
    expect(result.doc.title).toBe('My Protocol');
    expect(result.file.path).toBe('protocols/My Protocol.rp.json');
  });

  it('sanitizes slashes in title', async () => {
    const { vault } = makeVault({
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.create('protocols', 'bad/title', 'gen-id-2');
    expect(result.doc.title).not.toContain('/');
    expect(result.file.path).not.toContain('/title');
  });
});

describe('ProtocolDocumentStore — list', () => {
  it('returns .rp.json files recursively', async () => {
    const { vault } = makeVault({
      files: {
        'protocols/a.rp.json': JSON.stringify(VALID_DOC),
        'protocols/b.rp.json': JSON.stringify(VALID_DOC),
        'protocols/sub/c.rp.json': JSON.stringify(VALID_DOC),
        'protocols/ignored.txt': 'not a protocol',
      },
      folders: ['protocols', 'protocols/sub'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const files = await store.list('protocols');
    expect(files.length).toBe(3);
    expect(files.every((f: { path: string }) => f.path.endsWith('.rp.json'))).toBe(true);
  });

  it('returns empty array for non-existent folder', async () => {
    const { vault } = makeVault();
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const files = await store.list('nonexistent');
    expect(files.length).toBe(0);
  });
});

describe('ProtocolDocumentStore — delete', () => {
  it('trashes the file via vault.trash', async () => {
    const { vault } = makeVault({
      files: { 'protocols/to-delete.rp.json': JSON.stringify(VALID_DOC) },
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    await store.delete('protocols/to-delete.rp.json');
    expect(vault.trash).toHaveBeenCalled();
  });
});

describe('ProtocolDocumentStore — PROTOCOL_FILE_EXTENSION constant', () => {
  it('is rp.json', () => {
    expect(PROTOCOL_FILE_EXTENSION).toBe('rp.json');
  });
});
