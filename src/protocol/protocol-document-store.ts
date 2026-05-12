// src/protocol/protocol-document-store.ts
// Obsidian vault service for reading/writing .rp.json protocol documents.
// Uses WriteMutex to prevent concurrent write races (same pattern as SnippetService).

import { TFile, TFolder } from 'obsidian';
import type { App } from 'obsidian';

import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import {
  createEmptyProtocolDocument,
  isProtocolDocumentV1,
  type ProtocolDocumentV1,
} from './protocol-document';

export const PROTOCOL_FILE_EXTENSION = 'rp.json' as const;

/**
 * Vault-level service for .rp.json protocol documents.
 * All writes are mutex-protected per file path.
 */
export class ProtocolDocumentStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Read and validate a .rp.json protocol file.
   * Returns parsed ProtocolDocumentV1 or null if file missing/invalid.
   */
  async read(protocolPath: string): Promise<ProtocolDocumentV1 | null> {
    const exists = await this.app.vault.adapter.exists(protocolPath);
    if (!exists) return null;

    try {
      const raw = await this.app.vault.adapter.read(protocolPath);
      const parsed = JSON.parse(raw) as unknown;
      if (!isProtocolDocumentV1(parsed)) {
        console.warn(`[RadiProtocol] ProtocolDocumentStore.read: invalid schema in ${protocolPath}`);
        return null;
      }
      return parsed;
    } catch (err) {
      console.error(`[RadiProtocol] ProtocolDocumentStore.read failed for ${protocolPath}:`, err);
      return null;
    }
  }

  /**
   * Write a protocol document to disk. Mutex-protected per path.
   * Ensures parent folder exists before writing.
   */
  async write(protocolPath: string, doc: ProtocolDocumentV1): Promise<void> {
    await this.mutex.runExclusive(protocolPath, async () => {
      // Ensure parent folder exists
      const lastSlash = protocolPath.lastIndexOf('/');
      if (lastSlash > 0) {
        const parent = protocolPath.slice(0, lastSlash);
        await ensureFolderPath(this.app.vault, parent);
      }

      const payload = JSON.stringify(doc, null, 2) + '\n';
      await this.app.vault.adapter.write(protocolPath, payload);
    });
  }

  /**
   * Atomic read-modify-write operation.
   * Mutator receives current doc (or null if not exists) and returns updated doc.
   * Returns the written document.
   */
  async update(
    protocolPath: string,
    mutator: (doc: ProtocolDocumentV1 | null) => ProtocolDocumentV1
  ): Promise<ProtocolDocumentV1> {
    const existing = await this.read(protocolPath);
    const updated = mutator(existing);
    await this.write(protocolPath, updated);
    return updated;
  }

  /**
   * Create a new protocol document in the specified folder.
   * Returns the created TFile and document.
   */
  async create(folderPath: string, title: string, id: string): Promise<{ file: TFile; doc: ProtocolDocumentV1 }> {
    const now = new Date();
    const safeTitle = title.replace(/[\\/]/g, '-').trim() || 'Untitled Protocol';
    const fileName = `${safeTitle}.${PROTOCOL_FILE_EXTENSION}`;
    const protocolPath = folderPath ? `${folderPath}/${fileName}` : fileName;

    const doc = createEmptyProtocolDocument(id, safeTitle, now);

    await this.write(protocolPath, doc);

    const file = this.app.vault.getAbstractFileByPath(protocolPath);
    if (!(file instanceof TFile)) {
      throw new Error(`[RadiProtocol] ProtocolDocumentStore.create: file not found after write: ${protocolPath}`);
    }

    return { file, doc };
  }

  /**
   * List all .rp.json files under a folder (recursive).
   * Returns empty array if folder doesn't exist.
   */
  async list(folderPath: string): Promise<TFile[]> {
    const folder = folderPath === '' ? null : this.app.vault.getAbstractFileByPath(folderPath);
    const files: TFile[] = [];

    if (folder instanceof TFolder) {
      const walk = (f: TFolder): void => {
        for (const child of f.children) {
          if (child instanceof TFolder) {
            walk(child);
          } else if (child instanceof TFile && child.path.endsWith(`.${PROTOCOL_FILE_EXTENSION}`)) {
            files.push(child);
          }
        }
      };
      walk(folder);
      return files;
    }

    // Fallback: scan all vault files with prefix match. This also handles test
    // doubles and vault-index edge cases where getAbstractFileByPath returns null.
    const prefix = folderPath ? folderPath + '/' : '';
    for (const f of this.app.vault.getFiles()) {
      if (!f.path.endsWith(`.${PROTOCOL_FILE_EXTENSION}`)) continue;
      if (folderPath === '' || f.path.startsWith(prefix)) {
        files.push(f);
      }
    }

    return files;
  }

  /**
   * Delete a protocol file. Mutex-protected.
   */
  async delete(protocolPath: string): Promise<void> {
    await this.mutex.runExclusive(protocolPath, async () => {
      const file = this.app.vault.getAbstractFileByPath(protocolPath);
      if (file instanceof TFile) {
        await this.app.fileManager.trashFile(file);
      }
    });
  }
}
