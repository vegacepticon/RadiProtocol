// src/library/installed-record-store.ts
// Persisted installed-release records (D3 — separate typed store under
// .radiprotocol/library/). D15: ONE record file per installed release at
// .radiprotocol/library/installed/<packageIdSlug>/<versionSlug>.json; the file's
// presence + validity IS the install commit marker (D7 — written LAST by the
// installer). There is NO shared index document, so read-modify-write
// atomicity over an index is no longer needed (each release owns one file).
// The store exposes per-file read/list/write/delete; the installer/service
// owns the transaction boundary under the single global installMutex (D7).
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { slugifyPackageId } from './library-paths';
import {
  isInstalledRecord, LibraryStoreError, type InstalledRecord,
} from './library-model';
import { readJsonFile, writeJsonFile, safeErrorMessage } from './library-json-io';

const INSTALLED_DIR = '.radiprotocol/library/installed';

/** Vault-relative path of the per-release record file (D15). */
export function installedRecordPath(packageId: string, version: string): string {
  return `${INSTALLED_DIR}/${slugifyPackageId(packageId)}/${slugifyPackageId(version)}.json`;
}

export class InstalledRecordStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();
  constructor(app: App) { this.app = app; }

  /** Read one installed-release record by (packageId, version). Missing file
   *  → null (not installed). Malformed JSON/schema → throws LibraryStoreError
   *  (D3). A structurally-valid record whose embedded `packageId`/`releaseVersion`
   *  disagree with the requested path is a malformed marker → throws
   *  LibraryStoreError('malformed') (D15 marker identity — the file at slot
   *  (packageId, version) must carry matching identity fields). */
  async read(packageId: string, version: string): Promise<InstalledRecord | null> {
    const path = installedRecordPath(packageId, version);
    const record = await readJsonFile(this.app.vault, path, isInstalledRecord, 'installed record');
    if (record === null) return null;
    if (record.packageId !== packageId || record.releaseVersion !== version) {
      throw new LibraryStoreError(
        'malformed', path,
        `record identity mismatch: path expects ${packageId}@${version} but record carries ${record.packageId}@${record.releaseVersion}`,
      );
    }
    return record;
  }

  /** List all installed-release records. Recursively enumerates
   *  `.radiprotocol/library/installed/` (adapter.list is non-recursive — mirrors
   *  the queue-walk in src/snippets/snippet-service.ts:350-365). Returns [] when
   *  the directory is absent (empty initial state).
   *
   *  Error handling (D3 + D15): directory enumeration (`adapter.list`) and
   *  single-file read (`adapter.read`) failures are OPERATIONAL I/O errors —
   *  they surface as `LibraryStoreError('read-failed')` (explicit recoverable
   *  error, never a silent reset — D3). Only JSON corruption or a failed shape
   *  guard on a single record is SKIPPED (D15 per-file isolation: one bad record
   *  does not poison the whole list). This is the deliberate asymmetry with
   *  read(), which throws on a malformed single file (authoritative single-read
   *  vs best-effort discovery enumeration). */
  async list(): Promise<InstalledRecord[]> {
    const adapter = this.app.vault.adapter;
    const dirExists = await adapter.exists(INSTALLED_DIR);
    if (!dirExists) return [];
    const records: InstalledRecord[] = [];
    const queue: string[] = [INSTALLED_DIR];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await adapter.list(current);
      } catch (e) {
        throw new LibraryStoreError('read-failed', current, `failed to list installed records: ${safeErrorMessage(e)}`);
      }
      for (const file of listing.files) {
        let raw: string;
        try {
          raw = await adapter.read(file);
        } catch (e) {
          throw new LibraryStoreError('read-failed', file, `failed to read installed record: ${safeErrorMessage(e)}`);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // corrupt JSON — D15 per-file isolation (skip, do not throw)
        }
        if (!isInstalledRecord(parsed)) continue; // wrong schema — skip (per-file isolation)
        records.push(parsed);
      }
      for (const sub of listing.folders) queue.push(sub);
    }
    return records;
  }

  /** Persist one installed-release record (the commit marker — written LAST by
   *  the installer under the global installMutex, D7/D15). Pretty JSON + trailing
   *  newline, mutex-protected, parent folder ensured. */
  async write(record: InstalledRecord): Promise<void> {
    const path = installedRecordPath(record.packageId, record.releaseVersion);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, this.mutex, path, parentDir, record);
  }

  /** Delete one installed-release record file (uninstall). Missing file is a no-op. */
  async delete(packageId: string, version: string): Promise<void> {
    const path = installedRecordPath(packageId, version);
    const exists = await this.app.vault.adapter.exists(path);
    if (exists) await this.app.vault.adapter.remove(path);
  }
}
