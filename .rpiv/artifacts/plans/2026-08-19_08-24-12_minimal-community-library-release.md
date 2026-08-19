---
date: 2026-08-19T08:24:12+0300
author: Roman Shulgha
commit: 02bce00
branch: main
repository: RadiProtocol
topic: "Minimal Community Library release"
tags: [plan, blueprint, community-library, installation, obsidian-indexing, release]
status: ready
parent: ".rpiv/artifacts/research/2026-08-18_22-50-44_minimal-community-library-release.md"
phase_count: 4
phases:
  - { n: 1, title: Service Readiness Contract, files: [src/library/library-service.ts, src/__tests__/library/library-service.test.ts], depends_on: [] }
  - { n: 2, title: Install Completion UI, files: [src/views/library-install-progress-modal.ts, src/views/library-view.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/views/library-install-progress-modal.test.ts, src/__tests__/views/library-view-uninstall.test.ts], depends_on: [1] }
  - { n: 3, title: Mutable-Root Synchronization, files: [src/settings.ts, src/__tests__/settings-tab.test.ts], depends_on: [2] }
  - { n: 4, title: Release Documentation and Host Checklist, files: [README.md, README.ru.md], depends_on: [1, 2, 3] }
unresolved_phase_count: 0
last_updated: 2026-08-19T08:24:12+0300
last_updated_by: Roman Shulgha
---

# Minimal Community Library Release Implementation Plan

## Overview

Close the remaining release blockers in the existing command → catalog → manifest preview → install flow without changing its registry, wire, persistence, or transactional contracts. `LibraryService` will preserve marker-last install success while adding a bounded Vault-index readiness result; the progress UI will remain dismissible without cancelling work, explicitly synchronize Installed state, and distinguish committed-but-not-yet-indexed installs.

## Requirements

- Preserve `RegistryClient` → `LibraryService` → transactional `LibraryInstaller` layering.
- Preserve journal-first writes, marker-last commit truth, rollback, startup recovery, existing wire formats, and on-disk schemas.
- Rebuild the library service after protocol-folder and snippet-folder settings are saved so later installs and exports use current normalized roots.
- After a successful network install, wait for the installed protocol path to resolve to an Obsidian `TFile`.
- Bound readiness to 5 seconds with 100 ms polling and an immediate first probe.
- Keep a readiness timeout as committed install success, not an install failure or rollback signal.
- Keep installation running if the progress modal is dismissed; expose operation completion so the Library view can refresh deterministically.
- Render a distinct installed-but-indexing-pending terminal state on timeout.
- Update English and Russian README setup/workflow documentation equivalently.
- Carry a repeatable Obsidian checklist covering successful use and failure/residue states.
- Require a green final `npm run check`; classify unrelated baseline failures separately rather than expanding scope.

## Current State Analysis

The transactional library subsystem is already implemented and lower-layer tests are green in the researched dirty-tree baseline. The remaining blockers are integration-state problems: mutable roots are captured at service construction, successful install visibility depends on adapter events, runtime selection requires Vault-indexed `TFile` objects, and neither README documents Community Library setup or use.

### Key Discoveries

- Protocol and snippet callbacks only save settings, while the registry callback already follows mutate → save → rebuild (`src/settings.ts:97-140`).
- Startup and reconstruction normalize both roots before constructing `LibraryService` (`src/main.ts:74-90`, `src/main.ts:299-310`).
- `LibraryService` and `LibraryInstaller` capture root settings at construction (`src/library/library-service.ts:91-118`, `src/library/library-installer.ts:90-102`).
- The installer writes snippets, protocol, then the installed-record marker last; marker validity is committed truth (`src/library/library-installer.ts:114-150`).
- Installed records are adapter-enumerated and do not require Vault indexing (`src/library/installed-record-store.ts:66-98`).
- Protocol discovery and execution require indexed `TFile` objects (`src/protocol/protocol-file-resolver.ts:19-60`, `src/views/inline-runner-modal.ts:136-145`).
- The progress modal already lets installation continue after dismissal, but its caller cannot await the hidden operation (`src/views/library-install-progress-modal.ts:84-107`, `src/views/library-view.ts:432-441`).
- Uninstall already uses an explicit refresh because adapter events are not reliable (`src/views/library-view.ts:444-468`).
- Deterministic timer tests use Vitest fake timers, while dependency seams use injected options/callbacks (`src/__tests__/snippet-vault-watcher.test.ts:212-276`, `src/library/library-service.ts:79-118`).
- Both README setup sections omit registry configuration and the Community Library workflow (`README.md:44-50`, `README.ru.md:44-50`).

## Desired End State

A service consumer can distinguish committed install truth from runtime readiness without inspecting Vault state itself:

```ts
const result = await libraryService.install('chest-ct', '1.0.0');

if (result.status === 'failed') {
  showInstallFailure(result.reason);
} else if (result.readiness.status === 'ready') {
  openProtocol(result.readiness.protocolPath);
} else {
  showInstalledButIndexingPending(result.readiness.protocolPath);
}
```

The Library view synchronizes after the operation even when the modal was dismissed:

```ts
const modal = new LibraryInstallProgressModal(this.app, this.plugin, packageId, version);
modal.open();
const result = await modal.completion;
if (result.status === 'ok') await this.refresh();
```

Changing either managed root updates the captured library stack in the same callback:

```ts
this.plugin.settings.protocolFolderPath = value.trim();
await this.plugin.saveSettings();
await this.plugin.rebuildLibraryServices();
```

## What We're NOT Doing

- No registry backend, bundled registry URL, publishing/submission UI, or deploy automation.
- No publisher signatures or authenticity claims; SHA-256 remains integrity-only.
- No schema, wire-format, installed-record, journal, or namespace migration.
- No change from transactional adapter writes to Vault creation APIs.
- No undocumented Obsidian refresh/reindex calls.
- No change to marker-last commit, rollback, recovery, namespace safety, or the global install mutex.
- No cache-corruption banner refinement.
- No broader local import/export readiness workflow; root reconstruction benefits those paths indirectly.
- No automated claim that Node/Vitest reproduces real Obsidian adapter-event or index-adoption ordering.

## Decisions

### Readiness belongs to the service façade

**Ambiguity:** Polling could live in `LibraryService` or in `LibraryView`/the progress modal.

**Explored:**
- Service façade — follows existing dependency ownership (`src/library/library-service.ts:91-118`) and keeps domain timing policy out of views; timing can be injected for deterministic tests.
- View/modal — closer to presentation, but conflicts with the view → service dependency direction and duplicates Vault-state policy.

**Decision:** Put the bounded `TFile` readiness barrier in `LibraryService` and inject timing through `LibraryServiceOptions`.

### Preserve install truth with nested readiness

**Ambiguity:** A committed marker may exist even if the protocol is not indexed before timeout.

**Explored:**
- Top-level `status: 'ok'` plus nested `ready | timed-out` readiness — preserves installer truth and requires explicit readiness handling.
- A third top-level install status — explicit but forces every caller to reinterpret committed success.
- A separate method/promise — avoids changing the result but splits one operation across APIs.

**Decision:** Keep top-level committed `status: 'ok'` and add a nested readiness discriminant. A timeout must never become `status: 'failed'` because marker-last commit already succeeded (`src/library/library-installer.ts:129-150`).

### Use a 5-second / 100-millisecond barrier

There is no direct polling precedent; current resolver and runner checks are one-shot snapshots (`src/protocol/protocol-file-resolver.ts:31-56`, `src/views/inline-runner-modal.ts:136-145`). Use an immediate probe, then sleep in at-most-100 ms increments until a 5-second monotonic deadline, followed by a timeout result.

### Expose modal completion separately from dismissal

**Ambiguity:** The modal can currently resolve its UI result before the operation finishes (`src/views/library-install-progress-modal.ts:87-107`).

**Decision:** Preserve the early UI result and background operation, and add a public completion promise that always settles after install plus readiness. `LibraryView` awaits completion and explicitly refreshes on committed success.

### Render timeout as installed, indexing pending

Extend the exhaustive modal state machine with a terminal installed-but-indexing-pending state. It reaches 100% committed progress, enables Close, and explains that the protocol may appear in the picker shortly; it is neither normal immediate-ready success nor install failure.

### Rebuild after mutable-root saves

Apply the registry callback's existing sequential pattern to protocol and snippet root callbacks (`src/settings.ts:97-140`). `rebuildLibraryServices()` remains the single reconstruction point and rereads normalized current settings (`src/main.ts:299-310`).

### Verification remains honest about the host seam

Use deterministic unit tests for polling/result/UI orchestration and settings ordering, but treat real adapter-event ordering, `TFile` adoption, picker visibility, and runner execution as Obsidian-only manual checks. This preserves the inherited “manual seam verification” decision while keeping testable policy automated.

## Phase 1: Service Readiness Contract

### Overview

Define and implement the service-level readiness contract and deterministic barrier tests. Foundation phase; depends on nothing.

### Changes Required:

#### 1. src/library/library-service.ts:79-171

**File**: src/library/library-service.ts

**Changes**: MODIFY — add the composite install result, injected readiness timing, expected protocol-path derivation, and bounded `TFile` polling while preserving never-throw install semantics.

```diff
-import type { App } from 'obsidian';
+import { TFile, type App } from 'obsidian';
@@
-import { assertNoTraversal, slugifyPackageId, validPackageSlug } from './library-paths';
+import {
+  assertNoTraversal, libraryProtocolFilePath, packageNamespaceSegment,
+  slugifyPackageId, validPackageSlug,
+} from './library-paths';
@@
 export type ReleaseManifestResult =
   | { status: 'ok'; manifest: PackageManifest }
   | { status: 'not-found'; reason: string }
   | { status: 'unavailable'; reason: string };
+
+/** Vault-index readiness after a transaction has committed successfully. */
+export type InstallReadiness =
+  | { status: 'ready'; protocolPath: string }
+  | { status: 'timed-out'; protocolPath: string; timeoutMs: number };
+
+/** Service-level install result. The installer remains authoritative for commit
+ * truth; readiness only describes whether Obsidian indexed the committed
+ * protocol within the bounded wait. */
+export type LibraryInstallResult =
+  | (Extract<InstallResult, { status: 'ok' }> & { readiness: InstallReadiness })
+  | Extract<InstallResult, { status: 'failed' }>;
@@
 export interface LibraryServiceOptions {
   t?: Translator;
   installer?: LibraryInstaller;
   cacheStore?: LibraryCacheStore;
   recordStore?: InstalledRecordStore;
+  /** Test seam only; production bounds remain fixed at 5 seconds / 100 ms. */
+  readiness?: {
+    now?: () => number;
+    sleep?: (ms: number) => Promise<void>;
+  };
 }
+
+const INSTALL_READINESS_TIMEOUT_MS = 5_000;
+const INSTALL_READINESS_POLL_INTERVAL_MS = 100;
@@
   private readonly t: Translator;
   private readonly settings: LibraryServiceSettings;
   private readonly exportMutex = new WriteMutex();
+  private readonly readinessNow: () => number;
+  private readonly readinessSleep: (ms: number) => Promise<void>;
@@
     this.installer = options.installer ?? new LibraryInstaller(app, settings, {
       t: this.t,
       listInstalled: () => this.recordStore.list(),
     });
+    this.readinessNow = options.readiness?.now ?? (() => globalThis.performance.now());
+    this.readinessSleep = options.readiness?.sleep ?? ((ms) => new Promise((resolve) => {
+      globalThis.setTimeout(resolve, ms);
+    }));
   }
@@
-  /** Install a release by (packageId, version): fetch the release bundle from the
-   *  registry, then run the transactional installer. Never throws. */
-  async install(packageId: string, version: string): Promise<InstallResult> {
+  /** Fetch, transactionally install, then wait for the committed protocol to
+   * become an indexed TFile. Never throws. A readiness timeout remains an ok
+   * install because the marker-last transaction has already committed. */
+  async install(packageId: string, version: string): Promise<LibraryInstallResult> {
     try {
+      if (this.settings.protocolFolderPath === '') {
+        return {
+          status: 'failed', packageId, releaseVersion: version,
+          reason: 'protocol folder is not configured',
+        };
+      }
+
       const release = await this.registryClient.fetchRelease(packageId, version);
       if (release.status !== 'ok') {
         const reason = release.status === 'not-found' ? release.reason : `release unavailable: ${release.reason}`;
         return { status: 'failed', packageId, releaseVersion: version, reason };
       }
-      return await this.installer.install(release.bundle);
+
+      // Derive the expected indexed path before mutation. If Web Crypto/path
+      // derivation fails, no install has started and returning failed is truthful.
+      const pkgSegment = await packageNamespaceSegment(release.bundle.manifest.packageId);
+      const versionSlug = slugifyPackageId(release.bundle.manifest.releaseVersion);
+      const protocolPath = libraryProtocolFilePath(this.settings.protocolFolderPath, pkgSegment, versionSlug);
+
+      const installResult = await this.installer.install(release.bundle);
+      if (installResult.status === 'failed') return installResult;
+
+      const readiness = await this.waitForProtocolReadiness(protocolPath);
+      return { ...installResult, readiness };
     } catch (e) {
       return { status: 'failed', packageId, releaseVersion: version, reason: `install failed: ${safeErrorMessage(e)}` };
     }
   }
+
+  private async waitForProtocolReadiness(protocolPath: string): Promise<InstallReadiness> {
+    let lastError: unknown;
+    try {
+      const startedAt = this.readinessNow();
+      let scheduledWaitMs = 0;
+      while (true) {
+        let indexed: unknown = null;
+        try {
+          indexed = this.app.vault.getAbstractFileByPath(protocolPath);
+        } catch (e) {
+          // Keep polling because a later Vault lookup may recover.
+          lastError = e;
+        }
+        if (indexed instanceof TFile) return { status: 'ready', protocolPath };
+
+        const elapsedByClock = Math.max(0, this.readinessNow() - startedAt);
+        const elapsedMs = Math.max(elapsedByClock, scheduledWaitMs);
+        if (elapsedMs >= INSTALL_READINESS_TIMEOUT_MS) {
+          this.warnReadinessError(protocolPath, lastError);
+          return {
+            status: 'timed-out', protocolPath,
+            timeoutMs: INSTALL_READINESS_TIMEOUT_MS,
+          };
+        }
+
+        const delayMs = Math.min(
+          INSTALL_READINESS_POLL_INTERVAL_MS,
+          INSTALL_READINESS_TIMEOUT_MS - elapsedMs,
+        );
+        await this.readinessSleep(delayMs);
+        scheduledWaitMs += delayMs;
+      }
+    } catch (e) {
+      this.warnReadinessError(protocolPath, e);
+      return {
+        status: 'timed-out', protocolPath,
+        timeoutMs: INSTALL_READINESS_TIMEOUT_MS,
+      };
+    }
+  }
+
+  private warnReadinessError(protocolPath: string, error: unknown): void {
+    if (error === undefined) return;
+    console.warn(
+      `[RadiProtocol] library protocol readiness check failed for ${protocolPath}`,
+      error,
+    );
+  }
```

#### 2. src/__tests__/library/library-service.test.ts:1-235

**File**: src/__tests__/library/library-service.test.ts

**Changes**: MODIFY — extend the App/Vault fixture and install tests for immediate readiness, delayed readiness, timeout-as-success, and failure-without-polling.

```diff
 import { describe, it, expect, vi } from 'vitest';
-import { LibraryService } from '../../library/library-service';
+import { TFile } from 'obsidian';
+import {
+  LibraryService, type LibraryServiceOptions, type LibraryServiceSettings,
+} from '../../library/library-service';
@@
-import { packageNamespaceSegment, slugifyPackageId } from '../../library/library-paths';
+import {
+  libraryProtocolFilePath, packageNamespaceSegment, slugifyPackageId,
+} from '../../library/library-paths';
@@
-function makeVault(opts: { files?: Record<string, string> } = {}) {
+function makeVault(opts: {
+  files?: Record<string, string>;
+  indexedPaths?: ReadonlySet<string>;
+} = {}) {
@@
     },
     createFolder: vi.fn(async (_p: string) => { /* no-op */ }),
+    getAbstractFileByPath: vi.fn((p: string) => {
+      if (opts.indexedPaths !== undefined && !opts.indexedPaths.has(p)) return null;
+      return Object.assign(new TFile(), { path: p });
+    }),
   };
@@
 async function recPath(packageId: string, version: string): Promise<string> {
   return installedRecordPath(await packageNamespaceSegment(packageId), slugifyPackageId(version));
 }
+
+async function protocolPath(packageId: string, version: string): Promise<string> {
+  return libraryProtocolFilePath(
+    SETTINGS.protocolFolderPath,
+    await packageNamespaceSegment(packageId),
+    slugifyPackageId(version),
+  );
+}
@@
   recovery?: RecoveryReport;
   files?: Record<string, string>;
+  indexedPaths?: ReadonlySet<string>;
+  readiness?: LibraryServiceOptions['readiness'];
+  settings?: LibraryServiceSettings;
 } = {}) {
-  const { vault } = makeVault({ files: opts.files });
+  const { vault } = makeVault({ files: opts.files, indexedPaths: opts.indexedPaths });
@@
-  const service = new LibraryService(app as never, SETTINGS, registryClient, { installer, cacheStore, recordStore });
-  return { service, registryClient, installer, cacheStore, recordStore };
+  const service = new LibraryService(app as never, opts.settings ?? SETTINGS, registryClient, {
+    installer, cacheStore, recordStore, readiness: opts.readiness,
+  });
+  return { service, registryClient, installer, cacheStore, recordStore, vault };
 }
@@
 describe('LibraryService — install', () => {
+  it('rejects an empty protocol root before fetch, mutation, or readiness polling', async () => {
+    const { service, registryClient, installer, vault } = makeService({
+      settings: { ...SETTINGS, protocolFolderPath: '' },
+    });
+
+    const result = await service.install('chest-ct', '1.0.0');
+
+    expect(result).toEqual({
+      status: 'failed', packageId: 'chest-ct', releaseVersion: '1.0.0',
+      reason: 'protocol folder is not configured',
+    });
+    expect(registryClient.fetchRelease).not.toHaveBeenCalled();
+    expect(installer.install).not.toHaveBeenCalled();
+    expect(vault.getAbstractFileByPath).not.toHaveBeenCalled();
+  });
+
-  it('fetches the release and delegates to installer.install', async () => {
+  it('fetches, installs, and reports an immediately indexed protocol as ready', async () => {
     const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
-    const { service, registryClient, installer } = makeService({ fetchRelease: { status: 'ok', bundle } });
-    const r = await service.install('chest-ct', '1.0.0');
-    expect(r.status).toBe('ok');
+    const { service, registryClient, installer, vault } = makeService({ fetchRelease: { status: 'ok', bundle } });
+    const expectedPath = await protocolPath('chest-ct', '1.0.0');
+    const result = await service.install('chest-ct', '1.0.0');
+    expect(result.status).toBe('ok');
+    if (result.status === 'ok') {
+      expect(result.readiness).toEqual({ status: 'ready', protocolPath: expectedPath });
+    }
     expect(registryClient.fetchRelease).toHaveBeenCalledWith('chest-ct', '1.0.0');
     expect(installer.install).toHaveBeenCalledWith(bundle);
+    expect(vault.getAbstractFileByPath).toHaveBeenCalledWith(expectedPath);
+  });
+
+  it('polls at 100 ms until the protocol becomes indexed', async () => {
+    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
+    let nowMs = 0;
+    const sleep = vi.fn(async (ms: number) => { nowMs += ms; });
+    const { service, vault } = makeService({
+      fetchRelease: { status: 'ok', bundle },
+      readiness: { now: () => nowMs, sleep },
+    });
+    const expectedPath = await protocolPath('chest-ct', '1.0.0');
+    const indexedFile = Object.assign(new TFile(), { path: expectedPath });
+    vault.getAbstractFileByPath
+      .mockReturnValueOnce(null)
+      .mockReturnValueOnce(null)
+      .mockReturnValue(indexedFile);
+
+    const result = await service.install('chest-ct', '1.0.0');
+
+    expect(result.status).toBe('ok');
+    if (result.status === 'ok') expect(result.readiness.status).toBe('ready');
+    expect(sleep.mock.calls).toEqual([[100], [100]]);
+    expect(vault.getAbstractFileByPath).toHaveBeenCalledTimes(3);
+  });
+
+  it('keeps a committed install ok when indexing times out after 5 seconds', async () => {
+    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
+    let nowMs = 0;
+    const sleep = vi.fn(async (ms: number) => { nowMs += ms; });
+    const { service, vault } = makeService({
+      fetchRelease: { status: 'ok', bundle },
+      indexedPaths: new Set<string>(),
+      readiness: { now: () => nowMs, sleep },
+    });
+    const expectedPath = await protocolPath('chest-ct', '1.0.0');
+
+    const result = await service.install('chest-ct', '1.0.0');
+
+    expect(result).toEqual({
+      status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0',
+      readiness: { status: 'timed-out', protocolPath: expectedPath, timeoutMs: 5_000 },
+    });
+    expect(sleep).toHaveBeenCalledTimes(50);
+    expect(vault.getAbstractFileByPath).toHaveBeenCalledTimes(51);
+  });
+
+  it('logs the final probe error once while preserving timeout-as-success', async () => {
+    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
+    let nowMs = 0;
+    const sleep = vi.fn(async (ms: number) => { nowMs += ms; });
+    const { service, vault } = makeService({
+      fetchRelease: { status: 'ok', bundle },
+      readiness: { now: () => nowMs, sleep },
+    });
+    const probeError = new Error('vault index unavailable');
+    vault.getAbstractFileByPath.mockImplementation(() => { throw probeError; });
+    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
+
+    try {
+      const result = await service.install('chest-ct', '1.0.0');
+      expect(result.status).toBe('ok');
+      if (result.status === 'ok') expect(result.readiness.status).toBe('timed-out');
+      expect(warn).toHaveBeenCalledTimes(1);
+      expect(warn).toHaveBeenCalledWith(
+        expect.stringContaining('library protocol readiness check failed'),
+        probeError,
+      );
+    } finally {
+      warn.mockRestore();
+    }
+  });
+
+  it('returns installer failure without starting readiness polling', async () => {
+    const bundle = { manifest: { packageId: 'chest-ct', releaseVersion: '1.0.0' }, snippetContents: [] } as unknown as ReleaseBundle;
+    const installResult: InstallResult = {
+      status: 'failed', packageId: 'chest-ct', releaseVersion: '1.0.0', reason: 'commit failed',
+    };
+    const { service, vault } = makeService({
+      fetchRelease: { status: 'ok', bundle }, installResult,
+    });
+    await expect(service.install('chest-ct', '1.0.0')).resolves.toEqual(installResult);
+    expect(vault.getAbstractFileByPath).not.toHaveBeenCalled();
   });
 
-  it('returns failed on not-found without calling installer', async () => {
-    const { service, installer } = makeService({ fetchRelease: { status: 'not-found', reason: 'no such release' } });
+  it('returns failed on not-found without installing or polling', async () => {
+    const { service, installer, vault } = makeService({ fetchRelease: { status: 'not-found', reason: 'no such release' } });
     const r = await service.install('chest-ct', '9.9.9');
@@
     expect(installer.install).not.toHaveBeenCalled();
+    expect(vault.getAbstractFileByPath).not.toHaveBeenCalled();
   });
```

### Success Criteria:

#### Automated Verification:
- [x] Focused service tests pass: `npx vitest run src/__tests__/library/library-service.test.ts`
- [x] Phase-owned TypeScript files lint cleanly: `npx eslint src/library/library-service.ts src/__tests__/library/library-service.test.ts --max-warnings 0`
- [x] Read-only type checking passes after the service contract change: `npx tsc -noEmit -skipLibCheck`

#### Manual Verification:
- [ ] Review the result branches and confirm `timed-out` exists only beneath top-level committed `status: 'ok'`; `src/library/library-installer.ts` remains unchanged.

## Phase 2: Install Completion UI

### Overview

Expose operation completion independently of modal dismissal, render the readiness timeout, and refresh Installed state explicitly. Depends on Phase 1.

### Changes Required:

#### 1. src/views/library-install-progress-modal.ts:19-136

**File**: src/views/library-install-progress-modal.ts

**Changes**: MODIFY — consume the service-level result, add the completion promise, settle it after closed-mid-install work, and add the installed-pending terminal state.

```diff
 import { App, Modal } from 'obsidian';
 import type RadiProtocolPlugin from '../main';
-import type { InstallResult } from '../library/library-installer';
+import type { LibraryInstallResult } from '../library/library-service';
 
 export type LibraryInstallProgressResult =
-  | { done: true; result: InstallResult }
+  | { done: true; result: LibraryInstallResult }
   | { done: false };
 
-type InstallProgressState = 'installing' | 'complete' | 'failed';
+type InstallProgressState = 'installing' | 'complete' | 'indexing-pending' | 'failed';
@@
 export class LibraryInstallProgressModal extends Modal {
   readonly result: Promise<LibraryInstallProgressResult>;
+  /** Settles after install plus Vault-index readiness, even if the modal was dismissed. */
+  readonly completion: Promise<LibraryInstallResult>;
   private resolve!: (value: LibraryInstallProgressResult) => void;
+  private resolveCompletion!: (value: LibraryInstallResult) => void;
   private resolved = false;
+  private completionResolved = false;
@@
   private state: InstallProgressState = 'installing';
-  private installResult: InstallResult | null = null;
+  private installResult: LibraryInstallResult | null = null;
@@
     this.version = version;
     this.result = new Promise<LibraryInstallProgressResult>((res) => { this.resolve = res; });
+    this.completion = new Promise<LibraryInstallResult>((res) => { this.resolveCompletion = res; });
@@
       this.safeResolve(
-        this.state === 'installing' ? { done: false } : { done: true, result: this.installResult as InstallResult },
+        this.state === 'installing'
+          ? { done: false }
+          : { done: true, result: this.installResult as LibraryInstallResult },
       );
@@
   private safeResolve(value: LibraryInstallProgressResult): void {
     if (!this.resolved) { this.resolved = true; this.resolve(value); }
   }
+
+  private safeResolveCompletion(value: LibraryInstallResult): void {
+    if (!this.completionResolved) {
+      this.completionResolved = true;
+      this.resolveCompletion(value);
+    }
+  }
 
   private async runInstall(): Promise<void> {
     const result = await this.plugin.libraryService.install(this.packageId, this.version);
-    if (this.resolved) return; // modal closed mid-install; install continues
     this.installResult = result;
-    this.state = result.status === 'ok' ? 'complete' : 'failed';
-    this.setProgress(this.state === 'complete' ? 100 : 0);
+    this.safeResolveCompletion(result);
+    if (this.resolved) return; // closed UI stays untouched; completion still settles
+    this.state = result.status === 'failed'
+      ? 'failed'
+      : result.readiness.status === 'ready'
+        ? 'complete'
+        : 'indexing-pending';
+    this.setProgress(this.state === 'failed' ? 0 : 100);
     this.renderState();
     this.closeBtn.disabled = false;
@@
       case 'complete':
         this.statusEl.setText(t('library.installComplete'));
         this.progressEl.setAttribute('aria-label', t('library.installComplete'));
         break;
+      case 'indexing-pending': {
+        const protocolPath = this.installResult?.status === 'ok'
+          ? this.installResult.readiness.protocolPath
+          : '';
+        const message = t('library.installIndexPending', { path: protocolPath });
+        this.statusEl.setText(message);
+        this.progressEl.setAttribute('aria-label', message);
+        break;
+      }
       case 'failed': {
```

#### 2. src/views/library-view.ts:423-468

**File**: src/views/library-view.ts

**Changes**: MODIFY — await modal completion and explicitly refresh after committed install success instead of relying on adapter events.

```diff
   private async openInstall(packageId: string, version: string): Promise<void> {
     const modal = new LibraryInstallProgressModal(this.app, this.plugin, packageId, version);
     modal.open();
-    await modal.result;
-    // No explicit refresh — the Slice 6 vault watcher fires on the per-release
-    // marker write (under .radiprotocol/library/installed/) and schedules a
-    // single 120ms-debounced refresh. An explicit refresh here would duplicate
-    // it (Slice 6 single-refresh contract). If the user dismissed the modal
-    // mid-install, the install continues under installMutex and the watcher
-    // still fires on the eventual marker write.
+    const result = await modal.completion;
+    // Adapter events remain useful invalidation hints, but are not the success
+    // signal. Completion settles even when the modal was dismissed mid-install.
+    if (result.status === 'ok') await this.refresh();
   }
```

#### 3. src/i18n/locales/en.json:356-411

**File**: src/i18n/locales/en.json

**Changes**: MODIFY — correct the empty-registry setting help and add the English installed-but-indexing-pending message.

```diff
-    "libraryRegistryUrlDesc": "Override the community library registry endpoint. Leave empty to use the bundled default; an invalid or non-https URL falls back to 'catalog unavailable'.",
+    "libraryRegistryUrlDesc": "Override the community library registry endpoint. Leave empty to keep the catalog unavailable; invalid or non-https URLs are also unavailable.",
@@
     "installInstalling": "Installing…",
     "installComplete": "Installed successfully.",
+    "installIndexPending": "Installed, but Obsidian has not indexed the protocol yet. It may appear in the picker shortly: {path}",
     "installFailed": "Install failed: {reason}",
```

#### 4. src/i18n/locales/ru.json:356-411

**File**: src/i18n/locales/ru.json

**Changes**: MODIFY — correct the empty-registry setting help and add the equivalent Russian installed-but-indexing-pending message.

```diff
-    "libraryRegistryUrlDesc": "Переопределение адреса реестра библиотеки сообщества. Оставьте пустым для использования значения по умолчанию; недействительный или не-https URL приводит к состоянию «каталог недоступен».",
+    "libraryRegistryUrlDesc": "Переопределение адреса реестра библиотеки сообщества. Оставьте пустым, чтобы каталог оставался недоступным; некорректные и не-https URL также недоступны.",
@@
     "installInstalling": "Установка…",
     "installComplete": "Установка завершена.",
+    "installIndexPending": "Пакет установлен, но Obsidian ещё не проиндексировал протокол. Он может вскоре появиться в списке выбора: {path}",
     "installFailed": "Ошибка установки: {reason}",
```

#### 5. src/__tests__/views/library-install-progress-modal.test.ts

**File**: src/__tests__/views/library-install-progress-modal.test.ts

**Changes**: NEW — behaviorally verify completion settlement after dismissal and exhaustive ready/timed-out/failed state mapping.

```ts
import { describe, expect, it, vi } from 'vitest';
import { LibraryInstallProgressModal } from '../../views/library-install-progress-modal';
import type { LibraryInstallResult } from '../../library/library-service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function makePlugin(installResult: Promise<LibraryInstallResult>) {
  return {
    libraryService: {
      install: vi.fn(() => installResult),
    },
    i18n: {
      t: (key: string, vars?: Record<string, string>) =>
        vars?.path === undefined ? key : `${key}:${vars.path}`,
    },
  };
}

interface ModalSubject {
  runInstall: () => Promise<void>;
  state: 'installing' | 'complete' | 'indexing-pending' | 'failed';
  progressEl: { setAttribute: (name: string, value: string) => void };
  fillEl: { style: { width: string } };
  statusEl: { empty: () => void; setText: (text: string) => void };
  closeBtn: { disabled: boolean };
}

function primeModal(modal: LibraryInstallProgressModal) {
  const progressEl = { setAttribute: vi.fn() };
  const fillEl = { style: { width: '' } };
  const statusEl = { empty: vi.fn(), setText: vi.fn() };
  const closeBtn = { disabled: true };
  const subject = modal as unknown as ModalSubject;
  Object.assign(subject, { progressEl, fillEl, statusEl, closeBtn });
  return { subject, progressEl, fillEl, statusEl, closeBtn };
}

const PROTOCOL_PATH = 'Protocols/library/chest-ct-3a6b55b27699/1-0-0/chest-ct-3a6b55b27699.rp.json';

const readyResult: LibraryInstallResult = {
  status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0',
  readiness: { status: 'ready', protocolPath: PROTOCOL_PATH },
};

const timedOutResult: LibraryInstallResult = {
  status: 'ok', packageId: 'chest-ct', releaseVersion: '1.0.0',
  readiness: {
    status: 'timed-out', protocolPath: PROTOCOL_PATH, timeoutMs: 5_000,
  },
};

const failedResult: LibraryInstallResult = {
  status: 'failed', packageId: 'chest-ct', releaseVersion: '1.0.0', reason: 'commit failed',
};

describe('LibraryInstallProgressModal — completion and readiness', () => {
  it('settles completion after the modal was dismissed during installation', async () => {
    const pending = deferred<LibraryInstallResult>();
    const modal = new LibraryInstallProgressModal({} as never, makePlugin(pending.promise) as never, 'chest-ct', '1.0.0');
    const { subject, statusEl } = primeModal(modal);
    const run = subject.runInstall();

    modal.onClose();
    await expect(modal.result).resolves.toEqual({ done: false });
    pending.resolve(readyResult);

    await run;
    await expect(modal.completion).resolves.toEqual(readyResult);
    expect(subject.state).toBe('installing');
    expect(statusEl.setText).not.toHaveBeenCalled();
  });

  it('renders committed timeout as indexing-pending at 100 percent', async () => {
    const modal = new LibraryInstallProgressModal(
      {} as never, makePlugin(Promise.resolve(timedOutResult)) as never, 'chest-ct', '1.0.0',
    );
    const { subject, progressEl, fillEl, statusEl, closeBtn } = primeModal(modal);

    await subject.runInstall();

    await expect(modal.completion).resolves.toEqual(timedOutResult);
    expect(subject.state).toBe('indexing-pending');
    expect(fillEl.style.width).toBe('100%');
    expect(progressEl.setAttribute).toHaveBeenCalledWith('aria-valuenow', '100');
    expect(statusEl.setText).toHaveBeenCalledWith(`library.installIndexPending:${PROTOCOL_PATH}`);
    expect(closeBtn.disabled).toBe(false);
  });

  it.each([
    { result: readyResult, state: 'complete', progress: '100%' },
    { result: failedResult, state: 'failed', progress: '0%' },
  ] as const)('maps $state to its terminal progress', async ({ result, state, progress }) => {
    const modal = new LibraryInstallProgressModal(
      {} as never, makePlugin(Promise.resolve(result)) as never, 'chest-ct', '1.0.0',
    );
    const { subject, fillEl, closeBtn } = primeModal(modal);

    await subject.runInstall();

    expect(subject.state).toBe(state);
    expect(fillEl.style.width).toBe(progress);
    expect(closeBtn.disabled).toBe(false);
  });
});
```

#### 6. src/__tests__/views/library-view-uninstall.test.ts:1-33

**File**: src/__tests__/views/library-view-uninstall.test.ts

**Changes**: MODIFY — add source-level guards for completion-before-refresh install wiring while retaining uninstall guards.

```diff
 describe('library-view — uninstall UI wiring guard', () => {
@@
 });
+
+describe('library-view — install completion wiring guard', () => {
+  it('awaits operation completion then refreshes exactly once for committed success', () => {
+    const start = viewSrc.indexOf('private async openInstall');
+    const end = viewSrc.indexOf('/** FR-8:', start);
+    const body = viewSrc.slice(start, end);
+
+    expect(body).toContain('await modal.completion');
+    expect(body).toContain("result.status === 'ok'");
+    expect(body.match(/await this\.refresh\(\)/g)).toHaveLength(1);
+    expect(body.indexOf('await modal.completion')).toBeLessThan(body.indexOf('await this.refresh()'));
+    expect(body).not.toContain('await modal.result');
+  });
+
+  it('keeps the en/ru indexing-pending key in parity', () => {
+    expect(enSrc).toContain('"installIndexPending"');
+    expect(ruSrc).toContain('"installIndexPending"');
+  });
+});
```

### Success Criteria:

#### Automated Verification:
- [x] Focused modal and LibraryView wiring tests pass: `npx vitest run src/__tests__/views/library-install-progress-modal.test.ts src/__tests__/views/library-view-uninstall.test.ts`
- [x] Phase-owned TypeScript files lint cleanly: `npx eslint src/views/library-install-progress-modal.ts src/views/library-view.ts src/__tests__/views/library-install-progress-modal.test.ts src/__tests__/views/library-view-uninstall.test.ts --max-warnings 0`
- [x] Locale files parse, expose the pending key, and describe an empty registry URL as unavailable: `node -e "const fs=require('fs'); const checks=[['src/i18n/locales/en.json','catalog unavailable'],['src/i18n/locales/ru.json','каталог оставался недоступным']]; for (const [p,fragment] of checks) { const j=JSON.parse(fs.readFileSync(p,'utf8')); if (typeof j.library.installIndexPending !== 'string' || !j.settings.libraryRegistryUrlDesc.includes(fragment)) process.exit(1); }"`
- [x] Read-only type checking passes with the modal consuming Phase 1: `npx tsc -noEmit -skipLibCheck`

#### Manual Verification:
- [ ] Dismiss the progress modal while its service promise is pending; confirm no closed-modal DOM update occurs and the Library view refreshes after committed completion.
- [ ] Force a readiness timeout; confirm the terminal copy says installed/indexing pending, progress is 100%, Close is enabled, and no failure/rollback claim appears.

## Phase 3: Mutable-Root Synchronization

### Overview

Make managed-root changes rebuild the captured library stack after persistence and prove callback order. Depends on Phase 2.

### Changes Required:

#### 1. src/settings.ts:97-140

**File**: src/settings.ts

**Changes**: MODIFY — normalize protocol/snippet roots before persistence, then call `await this.plugin.rebuildLibraryServices()` after each save.

```diff
 import { DONATE_WALLETS } from './donate/wallets';
+import { normalizeProtocolFolderPath } from './protocol/protocol-file-resolver';
+
@@
           .onChange(async (value) => {
-            this.plugin.settings.protocolFolderPath = value.trim();
+            this.plugin.settings.protocolFolderPath = normalizeProtocolFolderPath(value);
             await this.plugin.saveSettings();
+            // LibraryService and LibraryInstaller capture managed roots at
+            // construction, so rebuild only after the new value is persisted.
+            await this.plugin.rebuildLibraryServices();
           });
@@
           .onChange(async (value) => {
-            this.plugin.settings.snippetFolderPath = value.trim() || 'Snippets';
+            this.plugin.settings.snippetFolderPath = normalizeProtocolFolderPath(value) || 'Snippets';
             await this.plugin.saveSettings();
+            await this.plugin.rebuildLibraryServices();
           });
```

#### 2. src/__tests__/settings-tab.test.ts:30-120

**File**: src/__tests__/settings-tab.test.ts

**Changes**: MODIFY — extend the plugin fixture and field tests to prove normalized/defaulted settings are saved before each rebuild.

```diff
 function makePlugin(settings: Partial<RadiProtocolSettings> = {}) {
   return {
     settings: { ...DEFAULT_SETTINGS, ...settings },
     saveSettingsCalls: 0,
+    rebuildLibraryServicesCalls: 0,
+    lifecycle: [] as string[],
     async saveSettings() {
       this.saveSettingsCalls += 1;
+      this.lifecycle.push('save:start');
+      await Promise.resolve();
+      this.lifecycle.push('save:end');
+    },
+    async rebuildLibraryServices() {
+      this.rebuildLibraryServicesCalls += 1;
+      this.lifecycle.push('rebuild');
     },
@@
 }
+
+async function flushAsyncChanges(): Promise<void> {
+  await Promise.resolve();
+  await Promise.resolve();
+  await Promise.resolve();
+}
@@
   it('typing wired fields still persists through field-specific save handlers', async () => {
@@
-    protocolText!.inputEl.value = ' Protocols/CT ';
+    protocolText!.inputEl.value = ' /Protocols\\CT/ ';
     protocolText!.inputEl.dispatchEvent({ type: 'input', bubbles: true });
+    await flushAsyncChanges();
     snippetText!.inputEl.value = '';
     snippetText!.inputEl.dispatchEvent({ type: 'input', bubbles: true });
-    await Promise.resolve();
+    await flushAsyncChanges();
 
     expect(plugin.settings.protocolFolderPath).toBe('Protocols/CT');
     expect(plugin.settings.snippetFolderPath).toBe('Snippets');
     expect(plugin.saveSettingsCalls).toBe(2);
+    expect(plugin.rebuildLibraryServicesCalls).toBe(2);
+    expect(plugin.lifecycle).toEqual([
+      'save:start', 'save:end', 'rebuild',
+      'save:start', 'save:end', 'rebuild',
+    ]);
   });
@@
   it('selecting suggestions reaches the same save-on-change pathway as typing', async () => {
@@
-    suggesters[0]!.selectSuggestion('Protocols/MR', {} as KeyboardEvent);
+    suggesters[0]!.selectSuggestion('/Protocols\\MR/', {} as KeyboardEvent);
+    await flushAsyncChanges();
-    suggesters[1]!.selectSuggestion('.radiprotocol/snippets/CT', {} as KeyboardEvent);
+    suggesters[1]!.selectSuggestion('.radiprotocol\\snippets\\CT/', {} as KeyboardEvent);
-    await Promise.resolve();
+    await flushAsyncChanges();
 
     expect(plugin.settings.protocolFolderPath).toBe('Protocols/MR');
     expect(plugin.settings.snippetFolderPath).toBe('.radiprotocol/snippets/CT');
     expect(plugin.saveSettingsCalls).toBe(2);
+    expect(plugin.rebuildLibraryServicesCalls).toBe(2);
+    expect(plugin.lifecycle).toEqual([
+      'save:start', 'save:end', 'rebuild',
+      'save:start', 'save:end', 'rebuild',
+    ]);
   });
```

### Success Criteria:

#### Automated Verification:
- [x] Focused settings tests pass: `npx vitest run src/__tests__/settings-tab.test.ts`
- [x] Phase-owned TypeScript files lint cleanly: `npx eslint src/settings.ts src/__tests__/settings-tab.test.ts --max-warnings 0`
- [x] Read-only type checking passes after callback changes: `npx tsc -noEmit -skipLibCheck`

#### Manual Verification:
- [ ] In one Obsidian session, change Protocol folder and Snippet folder, then install a package; confirm its protocol and snippets land under the newly configured normalized roots without reloading the plugin.

## Phase 4: Release Documentation and Host Checklist

### Overview

Document Community Library setup and use in both languages and lock the repeatable Obsidian success/failure checklist into final plan verification. Depends on Phases 1–3.

### Changes Required:

#### 1. README.md:44-50

**File**: README.md

**Changes**: MODIFY — document explicit HTTPS registry setup, the literal command name, preview/install/readiness workflow, managed storage, and integrity-not-authenticity boundary.

```diff
 ## Setup
 
 1. Open RadiProtocol settings.
 2. Set **Protocol folder** to the vault-relative folder that contains `.rp.json` protocol files.
 3. Set **Snippet folder** to the vault-relative folder that contains snippet Markdown files.
 4. Choose the preferred text separator for accumulated report text: newline or space.
 5. Select the interface language if needed.
+
+### Community library
+
+RadiProtocol does not ship with a registry endpoint. To use the Community library, open RadiProtocol settings and enter an explicitly configured **HTTPS** endpoint in **Advanced → Library registry URL**. An empty, invalid, or non-HTTPS value leaves the catalog unavailable instead of falling back to another service.
+
+1. Run **Open community library** from the command palette.
+2. Browse, search, or filter the catalog, then open a package to review its protocol title and snippet paths with their SHA-256 hashes.
+3. Choose **Install**. RadiProtocol downloads the full release again, verifies its hashes and protocol graph, and commits snippets, protocol, then the Installed marker.
+4. Wait for the progress dialog to report success. The package appears under **Installed**, and its protocol becomes available in the normal protocol pickers once Obsidian indexes the new file.
+5. If the dialog reports that indexing is still pending, the package is already committed; do not reinstall it. It may appear in the picker shortly. You can refresh the Community library view to confirm the Installed record.
+
+Installed package files live under a managed `library/<package>/<version>/` namespace inside the configured protocol and snippet folders. They are read-only in RadiProtocol; use **Uninstall** from the Installed section to remove only package-owned files.
+
+> **Trust boundary.** SHA-256 verifies that downloaded contents match the release manifest. It does **not** authenticate the publisher or prove who created the package.
```

#### 2. README.ru.md:44-50

**File**: README.ru.md

**Changes**: MODIFY — add equivalent Russian guidance while preserving the literal English command name registered by the plugin and localizing other controls.

```diff
 ## Настройка
 
 1. Откройте настройки RadiProtocol.
 2. Укажите **Protocol folder** — папку в хранилище, где лежат файлы протоколов `.rp.json`.
 3. Укажите **Snippet folder** — папку в хранилище, где лежат Markdown-сниппеты.
 4. Выберите разделитель накопленного текста заключения: новая строка или пробел.
 5. При необходимости выберите язык интерфейса.
+
+### Библиотека сообщества
+
+RadiProtocol не поставляется с готовым адресом реестра. Чтобы использовать библиотеку сообщества, откройте настройки RadiProtocol и укажите явно настроенный адрес **HTTPS** в поле **Дополнительно → URL реестра библиотеки**. Пустое, некорректное или не-HTTPS значение оставляет каталог недоступным и не переключает плагин на другой сервис.
+
+1. Запустите **Open community library** из палитры команд.
+2. Просматривайте каталог, используйте поиск или фильтр, затем откройте пакет и проверьте название протокола и пути сниппетов вместе с их SHA-256-хэшами.
+3. Нажмите **Установить**. RadiProtocol повторно загружает полный релиз, проверяет хэши и граф протокола, затем фиксирует сниппеты, протокол и в последнюю очередь маркер установленного пакета.
+4. Дождитесь результата в окне прогресса. Пакет появится в разделе **Установленные**, а протокол — в обычных списках выбора после того, как Obsidian проиндексирует новый файл.
+5. Если окно сообщает, что индексация ещё не завершена, пакет уже зафиксирован; не устанавливайте его повторно. Протокол может вскоре появиться в списке выбора. Обновите представление библиотеки, чтобы проверить запись в разделе **Установленные**.
+
+Файлы установленных пакетов находятся в управляемом пространстве `library/<package>/<version>/` внутри настроенных папок протоколов и сниппетов. В RadiProtocol они доступны только для чтения; используйте **Удалить** в разделе **Установленные**, чтобы удалить только файлы пакета.
+
+> **Граница доверия.** SHA-256 подтверждает, что загруженное содержимое совпадает с манифестом релиза. Проверка **не** удостоверяет издателя и не доказывает авторство пакета.
```

### Success Criteria:

#### Automated Verification:
- [x] Both README files contain the explicit endpoint, literal command, readiness, managed namespace, and trust-boundary facts: `node -e "const fs=require('fs'); const checks={ 'README.md':['HTTPS','Open community library','SHA-256','Installed','library/<package>/<version>/'], 'README.ru.md':['HTTPS','Open community library','SHA-256','Установленные','library/<package>/<version>/'] }; for (const [p,terms] of Object.entries(checks)) { const s=fs.readFileSync(p,'utf8'); for (const t of terms) if (!s.includes(t)) { console.error(p+' missing '+t); process.exit(1); } }"`
- [x] README patches have no whitespace errors: `git diff --check -- README.md README.ru.md`

#### Manual Verification:
- [ ] With registry URL empty, invalid, and non-HTTPS, open **Open community library**; confirm an explicit unavailable state and no crash or fallback endpoint. Repeat with a valid cached snapshot and with no cache; cached entries appear only in the former case.
- [ ] With a provisioned HTTPS registry, browse, search, and filter; confirm search/filter are client-side and the category list still comes from the unfiltered catalog.
- [ ] Open package details; confirm author/version, protocol title, snippet paths, full SHA-256 values, and integrity-not-authenticity copy are shown, while manifest not-found/mismatch/unavailable keeps **Install** disabled.
- [ ] Install a valid package with nested snippet `relPath` values; confirm every nested parent/file, protocol, and valid marker exists, Installed refreshes automatically, the protocol appears in the picker, and it runs in the same session.
- [ ] During install, confirm the progressbar is indeterminate; ready and indexing-pending finish at 100%, failure finishes at 0%, and the terminal copy matches the state.
- [ ] Change both managed roots without reloading, including trailing slash and backslash forms, install another package, and confirm all new files use normalized new roots while earlier uninstall remains record-derived.
- [ ] Dismiss the progress modal during installation; confirm work continues and Installed refreshes after completion.
- [ ] Force readiness beyond 5 seconds; confirm the UI reports installed/indexing pending, the valid marker remains, no rollback/failure is claimed, and the protocol can appear later without reinstall.
- [ ] Trigger unavailable release, preflight rejection, and commit failure; inspect protocol, snippet, marker, and journal paths to distinguish zero mutation, complete rollback, and recovery-pending residue.
- [ ] Interrupt Obsidian after journal creation but before marker commit, reload, and confirm startup recovery removes incomplete owned files and the journal; a valid marker causes recovery to retain committed files.
- [ ] Confirm managed snippets and protocols are read-only across edit/delete/move/drop/connect/drag/resize/layout/self-check actions, while Installed/read-only badges appear at every protocol picker entry point: editor, start-from-node, export, and inline runner.
- [ ] Exercise a registry/release identity containing Cyrillic characters and encoded spaces; confirm catalog, manifest, and release requests resolve without transport corruption.
- [ ] Temporarily remove one Russian `library.*` key, confirm `npm run check` fails the parity gate, restore the key, and confirm the final gate is green.
- [ ] Confirm **Uninstall** removes only package-owned namespaces and all English/Russian SHA-256 copy avoids publisher-authenticity claims.

## Final Whole-Plan Verification

#### Automated Verification:
- [x] Canonical repository acceptance passes after all phases: `npm run check`

#### Manual Verification:
- [ ] Complete every Phase 1-4 manual criterion in a real Obsidian vault and record unrelated baseline failures separately; release only with the canonical gate green.

## Ordering Constraints

- Phase 1 fixes the result/API contract consumed by Phase 2.
- Phase 2 must follow Phase 1 so modal code compiles against the final service result union.
- Phase 3 is logically independent of readiness internals but is sequenced after Phase 2 to keep implementation checkpoints linear and prevent concurrent edits against the dirty tree.
- Phase 4 follows all behavior phases so documentation and the manual checklist describe the locked implementation rather than a provisional API.
- No phase edits `LibraryInstaller`, installed-record/journal schemas, `main.js`, or `styles.css`.

## Verification Notes

- Verify the readiness probe accepts only `instanceof TFile`, uses an immediate first probe, sleeps no more than 100 ms per interval, and returns timeout at 5 seconds.
- Verify installer/fetch failure returns `status: 'failed'` without starting readiness polling.
- Verify committed installs return `status: 'ok'` for both `ready` and `timed-out` readiness.
- Verify the modal completion promise settles even after `onClose()` has produced `{ done: false }`, with no post-close DOM mutation.
- Verify `LibraryView` refreshes exactly once after committed completion and does not depend on a marker event.
- Verify protocol and snippet callbacks each perform mutate → awaited save → awaited rebuild; rebuild reads current normalized roots in `src/main.ts:304-310`.
- Verify English/Russian i18n and README facts remain equivalent; literal command names stay English where registration is English-only.
- In Obsidian, verify same-session root changes affect the next install destination and snippet namespace without plugin reload.
- In Obsidian, verify catalog search/filter, manifest gating, successful commit, automatic Installed refresh, picker visibility, and actual runner execution.
- In Obsidian, force readiness timeout and verify the package remains Installed, no rollback is claimed, and the protocol can appear later without reinstall.
- In Obsidian, dismiss the progress modal during installation and verify completion still refreshes Installed state.
- In Obsidian, verify unavailable registry, preflight rejection, and commit failure. Inspect protocol, snippet, marker, and journal paths: UI absence alone is not rollback evidence.
- Run final whole-repository acceptance with `npm run check`. The research baseline was a dirty tree; unrelated failures must be classified separately, but the final gate must be green.

## Performance Considerations

- The probe is bounded to about 51 synchronous Vault lookups in the worst case (immediate probe plus 5 seconds at 100 ms), with no adapter scans or network work.
- Readiness runs only after a committed network install; failed fetches and failed installs do not poll.
- Catalog search/filter remains client-side and unchanged.
- Explicit post-install refresh performs one catalog/installed model reload; watcher events remain incidental invalidation hints and may cause a later debounced refresh, but they are no longer the success signal.
- Injected timing keeps unit tests instantaneous and deterministic.

## Migration Notes

No migration applies. Persisted protocol documents, package manifests, release bundles, installed records, journals, namespaces, and settings keys remain unchanged. Rollback is code rollback only; committed packages remain compatible with prior plugin versions.

## Precedents & Lessons

- `d4eb13f` and `841191a`: a green lower layer and persistence hardening did not prove same-session Obsidian usability; the final manual checklist must exercise browse → install → picker → runner.
- `9d3cfc1`: reuse `normalizeProtocolFolderPath()` and index-based discovery rather than inventing a second normalization/indexing path.
- Earlier abandoned-library lifecycle: first-class entry points, nested paths, bilingual strings, and host-level workflow validation are release-critical; verify all in Phase 4 manual criteria.
- Adapter events are invalidation hints, not deterministic success signals; Phase 2 must explicitly refresh after operation completion.

## Pattern References

- `src/library/library-service.ts:35-50,68-72,79-118` — orthogonal result metadata and constructor options/dependency injection.
- `src/library/library-installer.ts:47-50,114-150` — authoritative install result and marker-last commit boundary; do not modify.
- `src/library/installed-record-store.ts:66-98` — adapter-visible Installed truth, independent of Vault indexing.
- `src/protocol/protocol-file-resolver.ts:19-60` — index-only `TFile` resolution.
- `src/views/inline-runner-modal.ts:136-145` — exact runtime `instanceof TFile` guard.
- `src/views/library-install-progress-modal.ts:19-107` — safe-resolve modal/background-operation base pattern.
- `src/views/library-item-detail-modal.ts:39-85,112-130` — promise result and post-await closed-modal guard.
- `src/views/library-view.ts:218-245,432-468` — generation-guarded refresh and explicit uninstall refresh precedent.
- `src/views/snippet-manager-view.ts:184-245,419-449` — timer cleanup, generation guards, and refresh after modal mutation.
- `src/__tests__/snippet-vault-watcher.test.ts:212-276` — deterministic timer verification.
- `src/__tests__/views/library-import-picker-modal.test.ts:18-52` — `TFile` fixture and modal double-resolution test style.
- `src/__tests__/library/library-service.test.ts:90-235` — service fixture/result-union test style.
- `src/__tests__/library/library-installer.test.ts:161-270` — transactional success/failure/rollback evidence that must remain green.
- `src/__tests__/settings-tab.test.ts:30-120` — settings component fixture to extend.
- `src/__mocks__/obsidian.ts` — shared test runtime shape; avoid broadening unless the focused modal test requires it.
- `src/views/protocol-picker-modal.ts:39-69` — picker consumes an immutable indexed `TFile[]` snapshot.
- `src/i18n/locales/en.json`, `src/i18n/locales/ru.json` — paired `library.*` keys.
- `README.md:44-50`, `README.ru.md:44-50` — bilingual setup insertion points.
- `package.json:8-19` — canonical repository gate.
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md:75-106` — manual Obsidian checklist convention.

## Developer Context

### Inherited upstream decisions

- Keep the explicit user-configured HTTPS registry endpoint with no bundled default.
- Keep SHA-256 integrity without publisher authentication.
- Preserve journal-first install, rollback, and startup recovery.
- Keep command → catalog → manifest preview → install as the narrow release seam.
- Close blockers only; no migrations or wire-contract changes.
- Rebuild the service after folder-setting changes.
- A successful install means immediately usable.
- Preserve hardening; add manual host-seam verification; update both READMEs; require `npm run check`.
- Use a bounded readiness barrier, retain adapter writes, wait for `TFile` visibility, and explicitly synchronize Installed state.

### Blueprint checkpoint

**Q:** ❓ Question: `LibraryService` already owns install orchestration and `App` (`src/library/library-service.ts:91-118,159-171`), while views delegate domain work to it (`src/views/library-view.ts:432-441`). About to place the bounded `TFile` readiness barrier in the service and inject its timing through `LibraryServiceOptions`, following the existing dependency-injection pattern. Confirm that direction, or are we moving polling orchestration into the view?

**A:** Follow service pattern.

**Q:** ❓ Question: The marker is written last and defines committed success (`src/library/library-installer.ts:129-150`), while `LibraryService.install()` currently forwards `InstallResult` (`src/library/library-service.ts:159-171`). If the protocol is committed but never becomes a Vault-indexed `TFile` before the bound, how should the service represent that distinct state without claiming rollback/failure?

**A:** Nested readiness (Recommended).

**Q:** ❓ Question: There is no existing Vault-index polling precedent; current lookups are one-shot snapshots (`src/protocol/protocol-file-resolver.ts:31-56`, `src/views/inline-runner-modal.ts:136-145`). Which fixed production bound should the new service barrier use? This controls install-modal latency versus tolerance for slow Obsidian indexing; tests will inject timing rather than wait in real time.

**A:** 5s / 100ms (Recommended).

**Q:** ❓ Question: Closing the progress modal currently resolves `{ done: false }` while its private `runInstall()` continues, so `LibraryView` cannot await the real operation and relies on watcher events (`src/views/library-install-progress-modal.ts:84-107`, `src/views/library-view.ts:432-441`). Which synchronization API should preserve background installation but guarantee one explicit post-operation refresh?

**A:** Expose completion (Recommended).

**Q:** ❓ Question: The progress modal currently has exhaustive `installing | complete | failed` terminal rendering (`src/views/library-install-progress-modal.ts:27,100-136`). With committed `status: 'ok'` plus `readiness.status: 'timed-out'`, what should the user see? The choice must avoid both a false install failure and a false claim of immediate usability.

**A:** Installed, pending (Recommended).

**Design checkpoint:** Proceed (Recommended).

**Decomposition checkpoint:** Approve (Recommended).

### Slice micro-checkpoints

**Slice 1 Q:** Slice 1/4: Service readiness contract — 2 files affected. Adds committed-success readiness with deterministic 5s/100ms polling and focused tests. Approve?

**Slice 1 A:** Approve (Recommended). Verifier: Decisions OK; Cross-slice OK; Research OK.

**Slice 2 Q:** Slice 2/4: Install completion UI — 6 files affected. Adds dismissal-independent completion, explicit success refresh, and bilingual installed-pending rendering with focused tests. Approve?

**Slice 2 A:** Approve (Recommended). Verifier after fixture-path correction: Decisions OK; Cross-slice OK; Research OK.

**Slice 3 Q:** Slice 3/4: Mutable-root synchronization — 2 files affected. Both root callbacks now save before rebuilding, with ordering coverage for typing and suggestions. Approve?

**Slice 3 A:** Approve (Recommended). Verifier: Decisions OK; Cross-slice OK; Research OK.

**Slice 4 Q:** Cross-slice: OK. Slice 4/4: Release documentation and host checklist — 2 files affected. Adds equivalent bilingual setup/workflow guidance and complete Obsidian success/failure verification. Approve?

**Slice 4 A:** Approve (Recommended). Verifier after localization/checklist expansion: Decisions OK; Cross-slice OK; Research OK.

## Plan History

- Phase 1: Service readiness contract — approved as generated
- Phase 2: Install completion UI — approved as generated
- Phase 3: Mutable-root synchronization — approved as generated
- Phase 4: Release documentation and host checklist — approved as generated

## References

- `.rpiv/artifacts/research/2026-08-18_22-50-44_minimal-community-library-release.md`
- `.rpiv/artifacts/research/2026-08-14_15-45-02_library-readiness-and-phase2-gap.md`
- `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md`
- `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md`
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`
- Obsidian Vault API and declarations cited in the parent research artifact.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9. The coverage reviewer found no uncovered verification intents._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 1 §1 (library-service.ts) | `src/protocol/protocol-file-resolver.ts:26` | concern | code-quality | An empty protocol root can return readiness `ready` for `library/...rp.json`, although protocol discovery explicitly returns no files when the configured root is empty, so the committed protocol remains unusable. | Reject installation before mutation when `protocolFolderPath` is empty and add a focused service test. | applied: added an empty-root preflight before fetch/install plus a zero-fetch/zero-mutation/zero-polling service test |
| code | Phase 1 §1 (library-service.ts) | `<n/a>` | concern | code-quality | Both readiness `catch` blocks silently convert Vault probe or timing failures into `timed-out`, obscuring operational faults as ordinary indexing delay. | Retain the committed-success timeout result but log the final probe or timing error once. | applied: capture the last readiness error, warn once at timeout, and test that committed timeout remains `ok` |
| code | Phase 3 §1 (settings.ts) | `src/views/protocol-editor-view.ts:662` | concern | codebase-fit | The callbacks persist only `value.trim()`, while read-only checks compare managed paths against the raw setting, so trailing slashes or backslashes make newly installed library protocols appear editable despite the service using normalized roots. | Normalize both folder values before saving and rebuilding, and extend settings tests with slash and backslash inputs. | applied: normalize both persisted roots and cover leading/trailing slash plus backslash inputs in settings tests |
| code | Phase 4 §1 (README.md) | `src/views/library-item-detail-modal.ts:135` | concern | codebase-fit | The documentation and manual checklist claim the preview shows the protocol path, but the live detail modal renders only `manifest.protocolDoc.title` and never derives or displays that path. | Revise both README steps and the manual checklist to describe the protocol title and snippet paths actually displayed. | applied: corrected English, Russian, and manual-checklist wording to protocol title plus snippet paths |
| code | Phase 4 §1 (README.md) | `src/i18n/locales/en.json:22` | concern | codebase-fit | The new README states that no registry endpoint is bundled and an empty value leaves the catalog unavailable, while the live English and Russian setting descriptions instruct users to leave the field empty for a bundled default. | Update both locale descriptions to state that an empty value leaves the catalog unavailable. | applied: updated both localized setting descriptions and their Phase 2 verification command |
