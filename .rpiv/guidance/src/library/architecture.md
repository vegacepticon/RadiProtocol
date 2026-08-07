# Library Layer Architecture

## Responsibility
Community-library feature cluster: catalog discovery (registry fetch + cache), transactional install/uninstall of protocol+snippet packages, and recovery-on-load. A thin `LibraryService` facade over a registry client, typed stores, and a transactional installer. Self-contained — mirrors the model/service + pure/Obsidian split used across the plugin.

## Dependencies
- **protocol/protocol-document**: `ProtocolDocumentV1` — `PackageManifest` wraps it as a value (never extends)
- **graph/graph-model**, **snippets/snippet-model** (library-paths types) · **utils/write-mutex**, **utils/vault-utils**
- **settings**: `RadiProtocolSettings` (registry URL, library root)
- **obsidian** (type-only): `App`, `Vault` (service/installer/stores)
- **registry transport**: `requestUrl` (injected; production default is an esbuild-external import) — never touches vault

## Consumers
- **main.ts**: constructs `LibraryService`, runs `recoverInterruptedInstalls()` before view registration; `rebuildLibraryServices()`
- **views/library-view**: `listCatalog`, `listInstalled` · **views/library-item-detail-modal**: `getReleaseManifest` · **views/library-install-progress-modal**: `install`
- **views/snippet-manager-view**, **views/protocol-picker-modal**: `listInstalled` + pure `findInstalledRecordForPath` for installed-indicator lookups

## Module Structure
```
src/library/
├── library-model.ts, registry-model.ts     # Pure models: PackageManifest, CatalogEntry, InstalledRecord, wire types
├── library-paths.ts, integrity.ts          # Pure path-safety/namespace derivation + SHA-256 verification
├── registry-client.ts                      # Network client — injected requestUrl, never throws
├── library-json-io.ts                      # Shared readJsonFile/writeJsonFile + safeErrorMessage
├── library-cache-store.ts, installed-record-store.ts  # Typed stores (catalog snapshot, per-release markers)
├── transaction-journal.ts, library-installer.ts      # Atomic install journal + stage→verify→commit→rollback
└── library-service.ts                      # Facade: listCatalog/install/uninstall/listInstalled/recoverInterruptedInstalls
```

## Model Split: Schema Sentinels + Shape Guards

```typescript
export const SCHEMA = 'radiprotocol.package' as const;   // *_SCHEMA / *_VERSION sentinels throughout
export function isPackageManifest(v: unknown): v is PackageManifest {
  // sentinel + structural + element guards — type predicate used everywhere
}
// PackageManifest wraps ProtocolDocumentV1 as a value; wire types live in registry-model.ts, distinct from stored models.
```
Result-union types are suffixed `Result`/`FetchResult` and carry a `status` discriminant; guards prefixed `is`. **Service never imports views**; dependencies injected via `options` (`??` defaults).

## Registry Client Boundary (Never Throws)

```typescript
if (this.isUnavailable()) return { status: 'unavailable', reason: '...', /* null fields */ };
try {
  const res = await this.requestUrl({ url, method: 'GET', throw: false });
  if (res.status < 200 || res.status >= 300) return { status: 'unavailable', reason: `status ${res.status}` };
  // 404 → 'not-found'; malformed → guard check → 'unavailable'
} catch (e) { return { status: 'unavailable', reason: `... ${safeErrorMessage(e)}` }; }
```
**Boundary contract (D2/D6)**: every fetch returns explicit `ok | not-found | unavailable`, never throws; https-only validation. All URL composition stays inside the `try`.

## Typed JSON Store + Shared IO (D3)

```typescript
export async function readJsonFile<T>(vault, path, guard, label): Promise<T | null> {
  if (!(await vault.adapter.exists(path))) return null;          // missing = empty state
  // malformed JSON/schema → throw LibraryStoreError ('malformed'), never silent reset
}
export async function writeJsonFile(vault, mutex, path, parentDir, value): Promise<void> {
  await mutex.runExclusive(path, async () => { await ensureFolderPath(vault, parentDir); /* pretty + '\n' */ });
}
```
One file per record → no shared index → no read-modify-write atomicity needed. **D15 per-file isolation**: `list()` skips corrupt/schema-bad records; `read()` throws on a malformed single — documented asymmetry. **D3**: malformed file throws `LibraryStoreError`; missing file is null/empty.

## Transaction Journal (Marker-Last Commit, D7/D15)

```typescript
entries.push({ path, kind: 'owned' });                  // owned final paths
entries.push({ path: markerPath, kind: 'marker' });     // LAST → presence+validity = commit signal
// journal written BEFORE any final-path write; marker written ONLY after all writes succeed.
// recoverInterrupted on load: marker present+valid → commit; else remove all entry paths deepest-first then journal.
// rollback uses namespace-gated removeOwnedPaths (deletes only owned paths passing assertNoTraversal within expected namespaces).
```
The **entire** stage→verify→commit→rollback cycle is serialized under ONE global `WriteMutex` with a fixed synthetic key (`installMutex`, `'library-install'`) — **intentional design decision**: install/uninstall never run concurrently. All validation happens in-memory (`planInstall`) before any final-path write.

## Integrity, Not Authenticity (Security Posture)

```typescript
export async function verifyIntegrity(content: string, expectedSha256: string): Promise<boolean> {
  const actual = await sha256String(content);           // TextEncoder → subtle().digest → hex
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}
```
Pure SHA-256 content-hash verification in-memory before any final-path write (D11). Mismatch returns `false` (recoverable, never throw). **Trust caveat — front and center**: this is **integrity, not authenticity**; unsigned releases are installed on manifest-hash trust. Signature (ed25519) verification is a documented **future path**, deferred — do NOT represent installed packages as authenticated.

## Pure Path-Safety + Namespace Derivation

```typescript
export function assertNoTraversal(relPath: string): string | null {
  // rejects '\', leading '/', '..'/'.'; returns normalized path or null
}
// rewriteSnippetRef: exact match wins, then '/' boundary prefix (longest wins) — same semantics as snippets/protocol-ref-sync
export function isLibraryManagedPath(path): boolean;   // namespace-gate cleanup
```
Every path gate runs before write/delete; `slugifyPackageId`/`validPackageSlug` reuse `slugifyLabel`; Cyrillic-safe (`\p{L}`).

## Architectural Boundaries
- **Registry URL default is EMPTY and user-configured** — the wire client + transactional install path are real and current, but the plugin ships with no hosted backend; a registry deployment is future/deferred (do not assume one is reachable).
- **Pure vs Obsidian**: `library-model`, `registry-model`, `library-paths`, `integrity` are zero-Obsidian; service/installer/stores use injected `type App`/`type Vault`.
- **Market-last commit + one global `installMutex`** are intentional atomicity/safety constraints — do not parallelize without revisiting the journal contract.
- **Compose, never extend**: `PackageManifest` composes `ProtocolDocumentV1`.
- `LibraryService` + installer never throw — errors surface as result unions / `LibraryStoreError`.

<important if="you are adding a new library capability">
## Adding a New Library Capability
1. **Define the model** — new `*Model` shapes with `schema`/`version` sentinels + `is*` guards; wire types in `registry-model.ts` if network-facing
2. **Pure helpers** — put path/validation logic in a dedicated `*-paths.ts` style file (zero Obsidian)
3. **Persistence** — via `readJsonFile`/`writeJsonFile` wrapped in a store owning its own `WriteMutex`; document missing-vs-malformed semantics
4. **Compose a service method** on `LibraryService`: wrap in try/catch, return a result union, never throw; log store failures with `console.warn('[RadiProtocol] …')`
5. **Network (if needed)** — extend `RegistryClient`: injectable transport, guards, explicit `unavailable`/`not-found`
6. **Mutation (install/rollback)** — extend `planInstall`, add journal entries via `TransactionJournalIO`, keep the **marker entry LAST**
7. **Export** the result type; add a test mirroring store/service shape (`vi.fn()` stubs for transport, stub `journalIO`)
</important>

<important if="you are writing or modifying tests for the library layer">
## Testing Conventions
- Pure modules (`library-model`, `registry-model`, `library-paths`, `integrity`): construct/call directly, no mocking; `integrity` needs Web Crypto available
- Service/installer: `makeVault()` + `makeApp()` mock factory; inject `vi.fn()` stubs for `requestUrl` transport and `TransactionJournalIO`
- Assert registry failures return `unavailable`/`not-found` result unions and never throw
- Journal tests: verify marker is written LAST and that recovery commits valid vs rolls back invalid markers (deepest-first, namespace-gated)
- Path-safety: assert unsafe paths cause **zero** vault I/O (mock not called)
</important>
