// src/library/submission-store.ts
// Persisted local submission records (Stage D — plan §6.2.1: save BEFORE the
// POST; if persistence fails, DO NOT send). One record file per attempt at
// .radiprotocol/library/submissions/<requestId>.json. Mirrors the typed-store
// patterns of InstalledRecordStore: WriteMutex-serialized writes, per-file
// isolation in list() (corrupt entries skipped, never silently reset), single
// read() throws LibraryStoreError on corruption (explicit recoverable error).
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import type { SubmissionRecord } from './submission-model';
import { isSubmissionRecord } from './submission-model';
import { LibraryStoreError } from './library-model';
import { readJsonFile, writeJsonFile, safeErrorMessage } from './library-json-io';

const SUBMISSIONS_DIR = '.radiprotocol/library/submissions';

/** Vault-relative path of one submission record file. */
export function submissionRecordPath(requestId: string): string {
  return `${SUBMISSIONS_DIR}/${requestId}.json`;
}

export class SubmissionStore {
  private readonly app: App;
  private readonly mutex = new WriteMutex();
  constructor(app: App) { this.app = app; }

  /** Read one submission record by requestId. Missing file → null (no such
   *  attempt). Malformed JSON/schema → throws LibraryStoreError (explicit —
   *  a corrupt receipt must never masquerade as "nothing was sent"). */
  async read(requestId: string): Promise<SubmissionRecord | null> {
    const path = submissionRecordPath(requestId);
    const record = await readJsonFile(this.app.vault, path, isSubmissionRecord, 'submission record');
    if (record !== null && record.requestId !== requestId) {
      throw new LibraryStoreError(
        'malformed', path,
        `record identity mismatch: path expects ${requestId} but record carries ${record.requestId}`,
      );
    }
    return record;
  }

  /** List all local submission records, newest first (by createdAt, then
   *  requestId for stability). Directory absent → []. Enumerate/read failures
   *  are operational errors (LibraryStoreError('read-failed')); a single
   *  corrupt file is skipped (per-file isolation, mirrors InstalledRecordStore). */
  async list(): Promise<SubmissionRecord[]> {
    const adapter = this.app.vault.adapter;
    if (!await adapter.exists(SUBMISSIONS_DIR)) return [];
    const records: SubmissionRecord[] = [];
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await adapter.list(SUBMISSIONS_DIR);
    } catch (e) {
      throw new LibraryStoreError('read-failed', SUBMISSIONS_DIR, `failed to list submission records: ${safeErrorMessage(e)}`);
    }
    for (const file of listing.files) {
      if (!file.endsWith('.json')) continue;
      let raw: string;
      try {
        raw = await adapter.read(file);
      } catch (e) {
        throw new LibraryStoreError('read-failed', file, `failed to read submission record: ${safeErrorMessage(e)}`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // corrupt JSON — per-file isolation (skip, do not throw)
      }
      if (!isSubmissionRecord(parsed)) continue; // wrong schema — skip
      records.push(parsed);
    }
    records.sort((a, b) => (b.createdAt.localeCompare(a.createdAt)) || a.requestId.localeCompare(b.requestId));
    return records;
  }

  /** Persist one submission record. Pretty JSON + trailing newline,
   *  mutex-protected, parent folder ensured. */
  async write(record: SubmissionRecord): Promise<void> {
    const path = submissionRecordPath(record.requestId);
    await writeJsonFile(this.app.vault, this.mutex, path, SUBMISSIONS_DIR, record);
  }

  /** Delete one submission record (explicit local retention action). Missing
   *  file is a no-op. */
  async delete(requestId: string): Promise<void> {
    const path = submissionRecordPath(requestId);
    if (await this.app.vault.adapter.exists(path)) {
      await this.app.vault.adapter.remove(path);
    }
  }
}
