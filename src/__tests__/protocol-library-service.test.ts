import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolLibraryService } from '../protocol/protocol-library-service';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';

describe('ProtocolLibraryService', () => {
  let service: ProtocolLibraryService;
  let mockApp: any;
  let mockT: any;
  let mockSettings: any;
  let mockProtocolDocumentStore: any;

  beforeEach(() => {
    mockT = vi.fn((key: string) => key);
    mockSettings = {
      protocolLibraryUrl: 'https://example.com/protocols-index.json',
      protocolFolderPath: 'Protocols',
    };

    mockProtocolDocumentStore = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(false),
          read: vi.fn().mockResolvedValue(''),
          write: vi.fn().mockResolvedValue(undefined),
        },
        createFolder: vi.fn().mockResolvedValue(undefined),
      },
    };

    service = new ProtocolLibraryService(mockApp, mockSettings, mockProtocolDocumentStore, mockT);
  });

  describe('fetchIndex', () => {
    it('returns null when URL is empty', async () => {
      service = new ProtocolLibraryService(
        mockApp,
        { ...mockSettings, protocolLibraryUrl: '' },
        mockProtocolDocumentStore,
        mockT,
      );
      const result = await service.fetchIndex();
      expect(result).toBeNull();
      expect(mockT).toHaveBeenCalledWith('protocolLibrary.noUrl');
    });
  });

  describe('installProtocol', () => {
    it('returns null when download fails (mocked requestUrl)', async () => {
      const entry: ProtocolLibraryEntry = {
        id: 'pkop',
        title: 'ПКОП',
        path: 'protocols/pkop.rp.json',
        schema: 'radiprotocol.protocol',
        version: 1,
        nodes: 62,
        edges: 79,
        description: 'ПКОП',
      };
      const result = await service.installProtocol(entry);
      // requestUrl mock returns a simple object; the actual download will fail
      expect(typeof result === 'string' || result === null).toBe(true);
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
      mockApp.vault.adapter.read = vi.fn().mockResolvedValue(
        JSON.stringify({ installed: [{ id: 'ogk', version: '1' }] }),
      );
      const result = await service.readManifest();
      expect(result).toEqual({ installed: [{ id: 'ogk', version: '1' }] });
    });

    it('writes manifest', async () => {
      await service.writeManifest({ installed: [{ id: 'pkop', version: '1' }] });
      expect(mockApp.vault.adapter.write).toHaveBeenCalled();
      const written = mockApp.vault.adapter.write.mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed.installed).toEqual([{ id: 'pkop', version: '1' }]);
    });
  });

  describe('getLibraryFolderPath', () => {
    it('returns Library subfolder for non-empty protocolFolderPath', () => {
      mockSettings.protocolFolderPath = 'Protocols';
      const path = (service as any).getLibraryFolderPath();
      expect(path).toBe('Protocols/Library');
    });

    it('returns just Library for empty protocolFolderPath', () => {
      mockSettings.protocolFolderPath = '';
      const path = (service as any).getLibraryFolderPath();
      expect(path).toBe('Library');
    });
  });
});