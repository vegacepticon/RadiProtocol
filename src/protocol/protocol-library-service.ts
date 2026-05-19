// src/protocol/protocol-library-service.ts
// Fetches a remote protocol library index, installs .rp.json protocols, and tracks installed entries.
import { App, Notice, requestUrl } from 'obsidian';
import type { RadiProtocolSettings } from '../settings';
import type { Translator } from '../i18n';
import { ensureFolderPath } from '../utils/vault-utils';
import { WriteMutex } from '../utils/write-mutex';
import { isProtocolDocumentV1, type ProtocolDocumentV1 } from './protocol-document';
import { ProtocolDocumentStore } from './protocol-document-store';
import type { ProtocolLibraryEntry, ProtocolLibraryIndex, ProtocolLibraryManifest } from './protocol-library-model';

function sanitizePathSegment(value: string): string {
  return value.replace(/[\\/]/g, '-').trim() || 'Untitled Protocol';
}

export class ProtocolLibraryService {
  private readonly app: App;
  private readonly settings: RadiProtocolSettings;
  private readonly protocolDocumentStore: ProtocolDocumentStore;
  private readonly t: Translator;
  private readonly mutex = new WriteMutex();

  constructor(
    app: App,
    settings: RadiProtocolSettings,
    protocolDocumentStore: ProtocolDocumentStore,
    t: Translator,
  ) {
    this.app = app;
    this.settings = settings;
    this.protocolDocumentStore = protocolDocumentStore;
    this.t = t;
  }

  async fetchIndex(): Promise<ProtocolLibraryIndex | null> {
    const url = this.settings.protocolLibraryUrl.trim();
    if (url === '') {
      new Notice(this.t('protocolLibrary.noUrl'));
      return null;
    }

    try {
      const response = await requestUrl({ url, method: 'GET' });
      const parsed = JSON.parse(response.text) as ProtocolLibraryIndex;
      if (!parsed.version || !Array.isArray(parsed.protocols)) {
        console.error('[RadiProtocol][ProtocolLibrary] Index JSON missing version or protocols array');
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('[RadiProtocol][ProtocolLibrary] fetchIndex failed:', err);
      new Notice(this.t('protocolLibrary.networkError'));
      return null;
    }
  }

  private getBaseUrl(): string {
    const url = this.settings.protocolLibraryUrl.trim();
    const lastSlash = url.lastIndexOf('/');
    return lastSlash > 0 ? url.slice(0, lastSlash + 1) : url;
  }

  private getLibraryFolderPath(): string {
    const root = this.settings.protocolFolderPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    return root === '' ? 'Library' : `${root}/Library`;
  }

  private getManifestPath(): string {
    return `${this.getLibraryFolderPath()}/protocol-library-manifest.json`;
  }

  async installProtocol(entry: ProtocolLibraryEntry): Promise<string | null> {
    const baseUrl = this.getBaseUrl();
    const rawUrl = baseUrl + entry.path;
    let doc: ProtocolDocumentV1;

    try {
      const response = await requestUrl({ url: rawUrl, method: 'GET' });
      const parsed = JSON.parse(response.text) as unknown;
      if (!isProtocolDocumentV1(parsed)) {
        console.error('[RadiProtocol][ProtocolLibrary] downloaded protocol has invalid schema:', entry.path);
        new Notice(this.t('protocolLibrary.invalidProtocol'));
        return null;
      }
      doc = parsed;
    } catch (err) {
      console.error('[RadiProtocol][ProtocolLibrary] installProtocol download failed:', err);
      new Notice(this.t('protocolLibrary.networkError'));
      return null;
    }

    const targetPath = `${this.getLibraryFolderPath()}/${sanitizePathSegment(entry.title)}.rp.json`;

    try {
      await this.mutex.runExclusive(targetPath, async () => {
        await this.protocolDocumentStore.write(targetPath, doc);
      });
    } catch (err) {
      console.error('[RadiProtocol][ProtocolLibrary] installProtocol write failed:', err);
      return null;
    }

    const manifest = (await this.readManifest()) ?? { installed: [] };
    const existing = manifest.installed.find((item) => item.id === entry.id);
    const version = String(entry.version ?? 'unknown');
    if (existing) {
      existing.version = version;
    } else {
      manifest.installed.push({ id: entry.id, version });
    }
    await this.writeManifest(manifest);
    return targetPath;
  }

  async readManifest(): Promise<ProtocolLibraryManifest | null> {
    const path = this.getManifestPath();
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) return null;
      const text = await this.app.vault.adapter.read(path);
      return JSON.parse(text) as ProtocolLibraryManifest;
    } catch (err) {
      console.error('[RadiProtocol][ProtocolLibrary] readManifest failed:', err);
      return null;
    }
  }

  async writeManifest(manifest: ProtocolLibraryManifest): Promise<void> {
    const path = this.getManifestPath();
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash > 0) {
      await ensureFolderPath(this.app.vault, path.slice(0, lastSlash));
    }
    await this.app.vault.adapter.write(path, JSON.stringify(manifest, null, 2));
  }
}
