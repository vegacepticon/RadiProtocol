import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as obsidian from 'obsidian';
import { LibraryService } from '../snippets/library-service';
import type { LibrarySnippetEntry } from '../snippets/library-model';

describe('LibraryService', () => {
  let service: LibraryService;
  let mockApp: any;
  let mockSnippetService: any;
  let mockT: any;
  let mockSettings: any;

  beforeEach(() => {
    mockT = vi.fn((key: string) => key);
    mockSettings = {
      libraryUrl: 'https://example.com/library-index.json',
      snippetFolderPath: '.radiprotocol/snippets',
    };

    mockSnippetService = {
      createFile: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue(undefined),
    };

    mockApp = {
      vault: {
        create: vi.fn().mockResolvedValue(undefined),
        createFolder: vi.fn().mockResolvedValue(undefined),
        adapter: {
          exists: vi.fn().mockResolvedValue(false),
          read: vi.fn().mockResolvedValue(''),
          write: vi.fn().mockResolvedValue(undefined),
        },
      },
    };
    vi.spyOn(obsidian, 'requestUrl').mockResolvedValue({ text: '' } as never);

    service = new LibraryService(mockApp, mockSettings, mockSnippetService, mockT);
  });

  describe('fetchIndex', () => {
    it('returns null when URL is empty', async () => {
      service = new LibraryService(mockApp, { ...mockSettings, libraryUrl: '' }, mockSnippetService, mockT);
      const result = await service.fetchIndex();
      expect(result).toBeNull();
      expect(mockT).toHaveBeenCalledWith('library.noUrl');
    });
  });

  describe('fetchSnippetPreview', () => {
    it('downloads and parses a snippet without writing to the vault', async () => {
      const entry: LibrarySnippetEntry = {
        id: 'test-snip',
        name: 'Index Name',
        category: 'General',
        path: 'general/test.json',
        description: 'A test snippet',
      };
      vi.spyOn(obsidian, 'requestUrl').mockResolvedValue({
        text: JSON.stringify({
          name: 'Remote Name',
          template: 'Finding: {{finding}}',
          placeholders: [{ id: 'finding', label: 'Finding', type: 'free-text' }],
        }),
      } as never);

      const result = await service.fetchSnippetPreview(entry);

      expect(result).toMatchObject({
        kind: 'json',
        path: 'general/test.json',
        name: 'Remote Name',
        template: 'Finding: {{finding}}',
        validationError: null,
      });
      expect(result?.placeholders).toHaveLength(1);
      expect(mockApp.vault.adapter.write).not.toHaveBeenCalled();
    });
  });

  describe('installSnippet', () => {
    it('downloads and writes snippet file, creating only parent folders', async () => {
      const entry: LibrarySnippetEntry = {
        id: 'test-snip',
        name: 'Test Snippet',
        category: 'General',
        path: 'general/test.json',
        description: 'A test snippet',
      };
      vi.spyOn(obsidian, 'requestUrl').mockResolvedValue({ text: '{"name":"Test Snippet","template":"ok","placeholders":[]}' } as never);

      const result = await service.installSnippet(entry);

      expect(result).toBe(true);
      expect(obsidian.requestUrl).toHaveBeenCalledWith({
        url: 'https://example.com/general/test.json',
        method: 'GET',
      });
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith('.radiprotocol/snippets/Library/General');
      expect(mockApp.vault.createFolder).not.toHaveBeenCalledWith('.radiprotocol/snippets/Library/General/Test Snippet.json');
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        '.radiprotocol/snippets/Library/General/Test Snippet.json',
        '{"name":"Test Snippet","template":"ok","placeholders":[]}',
      );
    });
  });

  describe('installSnippets', () => {
    it('installs entries sequentially and returns success/failure counts', async () => {
      const entries: LibrarySnippetEntry[] = [
        { id: 'a', name: 'A', category: 'General', path: 'a.json', description: 'A' },
        { id: 'b', name: 'B', category: 'General', path: 'b.json', description: 'B' },
        { id: 'c', name: 'C', category: 'General', path: 'c.json', description: 'C' },
      ];
      vi.spyOn(service, 'installSnippet')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.installSnippets(entries);

      expect(result).toEqual({ installed: 2, failed: 1 });
      expect(service.installSnippet).toHaveBeenNthCalledWith(1, entries[0]);
      expect(service.installSnippet).toHaveBeenNthCalledWith(2, entries[1]);
      expect(service.installSnippet).toHaveBeenNthCalledWith(3, entries[2]);
    });
  });

  describe('readManifest / writeManifest', () => {
    it('returns null when manifest does not exist', async () => {
      mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(false);
      const result = await service.readManifest();
      expect(result).toBeNull();
    });

    it('reads existing manifest', async () => {
      mockApp.vault.adapter.exists = vi.fn().mockResolvedValue(true);
      mockApp.vault.adapter.read = vi.fn().mockResolvedValue(JSON.stringify({ installed: [{ id: 'a', version: '1.0' }] }));
      const result = await service.readManifest();
      expect(result).toEqual({ installed: [{ id: 'a', version: '1.0' }] });
    });
  });
});
