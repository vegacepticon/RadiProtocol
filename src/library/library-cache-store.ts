// src/library/library-cache-store.ts
// Persisted cache for the catalog snapshot (D3 — separate typed store under
// .radiprotocol/library/, NOT through the existing protocol or snippet stores).
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { isCatalogSnapshot, type CatalogSnapshot } from './library-model';
import { readJsonFile, writeJsonFile } from './library-json-io';

const CACHE_DIR = '.radiprotocol/library';
const CACHE_FILE = `${CACHE_DIR}/catalog-cache.json`;

export class LibraryCacheStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();
  constructor(app: App) { this.app = app; }

  /** Read the cached catalog snapshot. Missing file → null (empty initial state).
   *  Malformed file → throws LibraryStoreError (D3). */
  async readSnapshot(): Promise<CatalogSnapshot | null> {
    return readJsonFile(this.app.vault, CACHE_FILE, isCatalogSnapshot, 'catalog snapshot');
  }

  /** Persist a catalog snapshot (pretty JSON + trailing newline, mutex-protected). */
  async writeSnapshot(snapshot: CatalogSnapshot): Promise<void> {
    await writeJsonFile(this.app.vault, this.mutex, CACHE_FILE, CACHE_DIR, snapshot);
  }
}
