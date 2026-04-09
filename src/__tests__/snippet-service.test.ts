import { describe, it, expect, vi } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';

// Minimal vault adapter mock
function makeVaultMock(existsResult = false) {
  return {
    adapter: {
      exists: vi.fn().mockResolvedValue(existsResult),
      read: vi.fn().mockResolvedValue('{}'),
      write: vi.fn().mockResolvedValue(undefined),
    },
    create: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: vi.fn().mockReturnValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAppMock(existsResult = false) {
  return { vault: makeVaultMock(existsResult) };
}

const settings = { snippetFolderPath: '.radiprotocol/snippets', sessionFolderPath: '.radiprotocol/sessions', outputDestination: 'clipboard' as const, outputFolderPath: '', maxLoopIterations: 50 };

describe('SnippetService (SNIP-01)', () => {
  it('has list() method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.list).toBe('function');
  });

  it('has load(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.load).toBe('function');
  });

  it('has save(snippet) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.save).toBe('function');
  });

  it('has delete(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.delete).toBe('function');
  });

  it('has exists(id) method', () => {
    const svc = new SnippetService(makeAppMock() as never, settings);
    expect(typeof svc.exists).toBe('function');
  });
});
