// src/library/library-service.ts
// Facade for the community library: catalog discovery (fetch + cache +
// filter), install (fetch release → installer), uninstall, installed-record
// listing, and recovery-on-load orchestration. Consumes RegistryClient,
// LibraryInstaller, LibraryCacheStore, InstalledRecordStore. Views consume this;
// this layer never imports views. Modeled after SnippetService
// (src/snippets/snippet-service.ts) — Obsidian-touching via injected stores.

import type { App } from 'obsidian';
import { defaultT, type Translator } from '../i18n';
import type { CatalogEntry, CatalogFetchResult, InstalledRecord, PackageManifest } from './library-model';
import { RegistryClient } from './registry-client';
import { LibraryCacheStore } from './library-cache-store';
import { InstalledRecordStore } from './installed-record-store';
import {
  LibraryInstaller,
  type InstallResult, type LibraryInstallerSettings, type RecoveryReport, type UninstallResult,
} from './library-installer';
import { safeErrorMessage } from './library-json-io';

/** Query for catalog filtering. */
export interface CatalogQuery {
  /** Free-text query matched against title/description/author/categories (case-insensitive). */
  query?: string;
  /** Category filter (exact match against entry.categories). */
  filter?: string;
}

/** Result of listing the catalog. `available=false` = the registry endpoint was
 *  unavailable (no endpoint, network failure, non-https, malformed); entries are
 *  then the cached snapshot (possibly empty) — the explicit "catalog
 *  unavailable" state (D6), never a throw. `cacheError` (Step 5 C7) is set when a
 *  cached snapshot existed but was unreadable, so the banner can distinguish
 *  "no cache" from "cache corrupt". */
export interface CatalogListResult {
  entries: CatalogEntry[];
  available: boolean;
  /** Set when `available=false`. */
  reason?: string;
  /** ISO 8601 of the snapshot being served (fetched just now, or the cached one). */
  fetchedAt?: string;
  /** Set when the cached snapshot was present but unreadable (Step 5 C7). */
  cacheError?: string;
}

/** Result of fetching a release manifest for the UI trust preview (Slice 7).
 *  Never throws. A trimmed view of ReleaseFetchResult (the manifest only —
 *  snippet contents are NOT shipped to the preview). */
export type ReleaseManifestResult =
  | { status: 'ok'; manifest: PackageManifest }
  | { status: 'not-found'; reason: string }
  | { status: 'unavailable'; reason: string };

export type LibraryServiceSettings = LibraryInstallerSettings;

export interface LibraryServiceOptions {
  t?: Translator;
  installer?: LibraryInstaller;
  cacheStore?: LibraryCacheStore;
  recordStore?: InstalledRecordStore;
}

export class LibraryService {
  private readonly app: App;
  private readonly registryClient: RegistryClient;
  private readonly t: Translator;
  /** The transactional installer (public for main.ts recovery-on-load wiring). */
  readonly installer: LibraryInstaller;
  private readonly cacheStore: LibraryCacheStore;
  /** The installed-record store (public for Slice 8 read-only integration lookups). */
  readonly recordStore: InstalledRecordStore;

  constructor(
    app: App,
    settings: LibraryServiceSettings,
    registryClient: RegistryClient,
    options: LibraryServiceOptions = {},
  ) {
    this.app = app;
    this.registryClient = registryClient;
    this.t = options.t ?? defaultT;
    this.installer = options.installer ?? new LibraryInstaller(app, settings, { t: this.t });
    this.cacheStore = options.cacheStore ?? new LibraryCacheStore(app);
    this.recordStore = options.recordStore ?? new InstalledRecordStore(app);
  }

  /** List the catalog with optional filtering. Fetches from the registry; on
   *  unavailable, serves the cached snapshot (explicit unavailable state, D6).
   *  Never throws. */
  async listCatalog(query?: CatalogQuery): Promise<CatalogListResult> {
    let entries: CatalogEntry[];
    let available: boolean;
    let reason: string | undefined;
    let fetchedAt: string | undefined;
    let cacheError: string | undefined;
    try {
      const fetchResult: CatalogFetchResult = await this.registryClient.fetchCatalog();
      if (fetchResult.status === 'ok') {
        available = true;
        entries = fetchResult.snapshot.entries;
        fetchedAt = fetchResult.snapshot.fetchedAt;
        // Persist the fresh snapshot for offline / next-time use (best-effort).
        try { await this.cacheStore.writeSnapshot(fetchResult.snapshot); } catch { /* best-effort cache */ }
      } else {
        available = false;
        reason = fetchResult.reason;
        const cached = await this.readCachedSnapshot();
        if (cached !== null && 'error' in cached) { cacheError = cached.error; entries = []; fetchedAt = undefined; }
        else if (cached !== null) { entries = cached.entries; fetchedAt = cached.fetchedAt; }
        else { entries = []; fetchedAt = undefined; }
      }
    } catch (e) {
      // A registry client never throws (D2/D6), but defend-in-depth: treat any
      // unexpected throw as an unavailable catalog serving the cache.
      available = false;
      reason = `catalog fetch error: ${safeErrorMessage(e)}`;
      const cached = await this.readCachedSnapshot();
      if (cached !== null && 'error' in cached) { cacheError = cached.error; entries = []; fetchedAt = undefined; }
      else if (cached !== null) { entries = cached.entries; fetchedAt = cached.fetchedAt; }
      else { entries = []; fetchedAt = undefined; }
    }
    return { entries: filterEntries(entries, query), available, reason, fetchedAt, cacheError };
  }

  /** Install a release by (packageId, version): fetch the release bundle from the
   *  registry, then run the transactional installer. Never throws. */
  async install(packageId: string, version: string): Promise<InstallResult> {
    try {
      const release = await this.registryClient.fetchRelease(packageId, version);
      if (release.status !== 'ok') {
        const reason = release.status === 'not-found' ? release.reason : `release unavailable: ${release.reason}`;
        return { status: 'failed', packageId, releaseVersion: version, reason };
      }
      return await this.installer.install(release.bundle);
    } catch (e) {
      return { status: 'failed', packageId, releaseVersion: version, reason: `install failed: ${safeErrorMessage(e)}` };
    }
  }

  /** Uninstall a release by (packageId, version). Never throws. */
  async uninstall(packageId: string, version: string): Promise<UninstallResult> {
    try {
      return await this.installer.uninstall(packageId, version);
    } catch (e) {
      return { status: 'failed', packageId, releaseVersion: version, reason: `uninstall failed: ${safeErrorMessage(e)}` };
    }
  }

  /** List all installed releases. Never throws — a store read failure returns []
   *  and logs a warning (Step 5 C7: throw-safe default is intentional UI safety, but
   *  the failure is no longer silent). */
  async listInstalled(): Promise<InstalledRecord[]> {
    try {
      return await this.recordStore.list();
    } catch (e) {
      console.warn('[RadiProtocol] library listInstalled failed — serving empty list', e);
      return [];
    }
  }

  /** Read one installed record by (packageId, version) — for the UI's installed
   *  indicator (Slice 8). Missing/malformed → null. Never throws; logs a warning
   *  on store failure (Step 5 C7). */
  async getInstalledRecord(packageId: string, version: string): Promise<InstalledRecord | null> {
    try {
      return await this.recordStore.read(packageId, version);
    } catch (e) {
      console.warn(`[RadiProtocol] library getInstalledRecord(${packageId}, ${version}) failed — treating as not installed`, e);
      return null;
    }
  }

  /** Fetch a release manifest for the UI trust preview (Slice 7). Never throws.
   *  Returns the manifest (file list + SHA-256 hashes) WITHOUT snippet contents
   *  — the preview shows what will be installed and its integrity hashes before
   *  the user commits. The actual install re-fetches the full bundle.
   *  Step 5 C8: uses the manifest-only `fetchReleaseManifest` so snippet bytes
   *  are not shipped to the preview. */
  async getReleaseManifest(packageId: string, version: string): Promise<ReleaseManifestResult> {
    try {
      const result = await this.registryClient.fetchReleaseManifest(packageId, version);
      if (result.status === 'ok') return { status: 'ok', manifest: result.manifest };
      return result;
    } catch (e) {
      return { status: 'unavailable', reason: `manifest fetch error: ${safeErrorMessage(e)}` };
    }
  }

  /** Recovery on load: finalize any in-flight installs. Never throws. */
  async recoverInterruptedInstalls(): Promise<RecoveryReport> {
    try {
      return await this.installer.recoverInterrupted();
    } catch {
      return { committed: [], rolledBack: [] };
    }
  }

  /** Read the cached snapshot (best-effort; malformed/missing → null; logs a
   *  warning on read failure — Step 5 C7). Returns `{ entries, fetchedAt }` on
   *  success, `null` when the cache is missing, or `{ error }` when the cache
   *  file exists but is unreadable (so listCatalog can populate cacheError). */
  private async readCachedSnapshot(): Promise<{ entries: CatalogEntry[]; fetchedAt: string } | { error: string } | null> {
    try {
      const snap = await this.cacheStore.readSnapshot();
      return snap ? { entries: snap.entries, fetchedAt: snap.fetchedAt } : null;
    } catch (e) {
      console.warn('[RadiProtocol] library cached snapshot unreadable', e);
      return { error: safeErrorMessage(e) };
    }
  }
}

/** Filter catalog entries by a free-text query (title/description/author/
 *  categories/summary) and an exact category filter. Pure. */
function filterEntries(entries: CatalogEntry[], query?: CatalogQuery): CatalogEntry[] {
  if (!query) return entries;
  const q = query.query?.trim().toLowerCase();
  const cat = query.filter?.trim();
  return entries.filter((e) => {
    if (cat !== undefined && cat !== '' && !e.categories.includes(cat)) return false;
    if (q !== undefined && q !== '') {
      const hay = [e.title, e.description, e.author.displayName, ...e.categories, e.summary ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
