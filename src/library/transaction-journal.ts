// src/library/transaction-journal.ts
// Stage→verify→commit→rollback journal under .radiprotocol/library/transactions/
// (D7). Written BEFORE any final-path write so an interrupted install can be
// rolled back deterministically: the journal records every owned path the
// transaction will create plus the per-release marker path (the marker entry
// is LAST → its presence = commit).
//
// Recovery (run on plugin load, orchestrated by LibraryInstaller.recoverInterrupted):
// for each in-flight journal, read the marker at its recorded path — marker
// present+valid+identity-matches → install committed, remove the journal only;
// marker absent/invalid → install incomplete, remove every journal entry path
// deepest-first, then the journal itself.
//
// Obsidian-touching via app.vault/adapter only. The installer holds the single
// global installMutex (D7) across all journal + final-path I/O; this module
// passes the caller-supplied mutex to writeJsonFile and owns no separate lock.

import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { slugifyPackageId, packageNamespaceSegment } from './library-paths';
import { readJsonFile, writeJsonFile, safeErrorMessage } from './library-json-io';
import { LibraryStoreError } from './library-model';

export const TRANSACTIONS_SCHEMA = 'radiprotocol.transaction-journal' as const;
export const TRANSACTIONS_VERSION = 1 as const;

const TRANSACTIONS_DIR = '.radiprotocol/library/transactions';

/** A single planned write in the journal. */
export interface JournalEntry {
  /** Vault-relative path the transaction will create. */
  path: string;
  /** 'owned' = a final-path write the transaction owns (rollback may delete it).
   *  'marker' = the per-release commit marker (written LAST; presence = commit). */
  kind: 'owned' | 'marker';
}

/** The journal document — one per in-flight (packageId, version) transaction. */
export interface TransactionJournal {
  readonly schema: typeof TRANSACTIONS_SCHEMA;
  readonly version: typeof TRANSACTIONS_VERSION;
  packageId: string;
  releaseVersion: string;
  /** ISO 8601 start timestamp. */
  startedAt: string;
  /** All paths the transaction plans to write, in commit order. The marker
   *  entry MUST be last (it is written last → its presence is the commit signal). */
  entries: JournalEntry[];
}

export function isTransactionJournal(value: unknown): value is TransactionJournal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['schema'] !== TRANSACTIONS_SCHEMA) return false;
  if (v['version'] !== TRANSACTIONS_VERSION) return false;
  if (typeof v['packageId'] !== 'string') return false;
  if (typeof v['releaseVersion'] !== 'string') return false;
  if (typeof v['startedAt'] !== 'string') return false;
  if (!Array.isArray(v['entries'])) return false;
  return v['entries'].every((e) => {
    if (typeof e !== 'object' || e === null) return false;
    const je = e as Record<string, unknown>;
    return typeof je['path'] === 'string' && (je['kind'] === 'owned' || je['kind'] === 'marker');
  });
}

/** Vault-relative journal file path for an in-flight (packageId, version).
 *  `pkgSegment` is the precomputed `packageNamespaceSegment(packageId)`;
 *  `versionSlug` is `slugifyPackageId(version)`. */
export function transactionJournalPath(pkgSegment: string, versionSlug: string): string {
  return `${TRANSACTIONS_DIR}/${pkgSegment}@${versionSlug}.json`;
}

/** Typed wrapper around the journal file. The installer calls these under the
 *  single global installMutex (D7); this module passes the caller's mutex to
 *  writeJsonFile and owns no separate lock domain. */
export class TransactionJournalIO {
  private readonly app: App;
  constructor(app: App) { this.app = app; }

  /** Read a journal for (packageId, version). Missing → null (no in-flight tx).
   *  Malformed → throws LibraryStoreError (D3). */
  async read(packageId: string, version: string): Promise<TransactionJournal | null> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    return readJsonFile(this.app.vault, transactionJournalPath(pkgSegment, versionSlug), isTransactionJournal, 'transaction journal');
  }

  /** Write the journal BEFORE any final-path write (D7). Caller holds the global
   *  installMutex; `mutex` is that same lock passed through to writeJsonFile. */
  async write(journal: TransactionJournal, mutex: WriteMutex): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(journal.packageId);
    const versionSlug = slugifyPackageId(journal.releaseVersion);
    const path = transactionJournalPath(pkgSegment, versionSlug);
    const parentDir = path.slice(0, path.lastIndexOf('/'));
    await writeJsonFile(this.app.vault, mutex, path, parentDir, journal);
  }

  /** Remove the journal file (after successful commit OR after rollback). Missing = no-op. */
  async remove(packageId: string, version: string): Promise<void> {
    const pkgSegment = await packageNamespaceSegment(packageId);
    const versionSlug = slugifyPackageId(version);
    const path = transactionJournalPath(pkgSegment, versionSlug);
    if (await this.app.vault.adapter.exists(path)) {
      await this.app.vault.adapter.remove(path);
      return;
    }
    // Legacy slug-only journal path (pre-migration interrupt). Best-effort cleanup.
    const legacyPath = `${TRANSACTIONS_DIR}/${slugifyPackageId(packageId)}@${versionSlug}.json`;
    if (await this.app.vault.adapter.exists(legacyPath)) await this.app.vault.adapter.remove(legacyPath);
  }

  /** List all in-flight transaction journals (for recovery on load). Recursively
   *  enumerates `.radiprotocol/library/transactions/` (adapter.list is non-recursive
   *  — mirrors src/snippets/snippet-service.ts:350-365). Returns [] when the
   *  directory is absent. I/O failures surface as LibraryStoreError('read-failed')
   *  (D3); malformed single journal files are SKIPPED (a malformed journal has
   *  no usable owned-paths list — its orphaned paths, if any, live harmlessly
   *  under `library/<pkg>/<ver>/` and are out of foundation recovery scope). */
  async listAll(): Promise<TransactionJournal[]> {
    const adapter = this.app.vault.adapter;
    const dirExists = await adapter.exists(TRANSACTIONS_DIR);
    if (!dirExists) return [];
    const journals: TransactionJournal[] = [];
    const queue: string[] = [TRANSACTIONS_DIR];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      let listing: { files: string[]; folders: string[] };
      try {
        listing = await adapter.list(current);
      } catch (e) {
        throw new LibraryStoreError('read-failed', current, `failed to list transactions: ${safeErrorMessage(e)}`);
      }
      for (const file of listing.files) {
        let raw: string;
        try {
          raw = await adapter.read(file);
        } catch (e) {
          throw new LibraryStoreError('read-failed', file, `failed to read transaction journal: ${safeErrorMessage(e)}`);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue; // corrupt JSON — skip (malformed journal cannot be rolled back)
        }
        if (isTransactionJournal(parsed)) journals.push(parsed);
      }
      for (const sub of listing.folders) queue.push(sub);
    }
    return journals;
  }
}
