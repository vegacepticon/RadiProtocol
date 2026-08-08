---
date: 2026-08-07T10:11:49+0300
author: Roman Shulgha
commit: bf206f5
branch: main
repository: RadiProtocol
topic: "Library backend Phase 1 — deploy static registry to Cloudflare Pages + in-Obsidian verify"
tags: [research, codebase, library, registry-client, cloudflare-pages, static-registry, wire-parity, regen-diff, lf-hardening, install, requestUrl, integrity]
status: ready
last_updated: 2026-08-07T10:11:49+0300
last_updated_by: Roman Shulgha
---

# Research: Library Backend Phase 1 — Deploy Static Registry to Cloudflare Pages + In-Obsidian Verify

## Research Question
Deploy the already-generated `site/` from the sibling backend repo `radiprotocol-library-backend/` (commit `92ee719`) to a Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` (direct upload); set the plugin's `libraryRegistryUrl` setting to the live `https://<origin>` and verify the read/install loop in Obsidian (`LibraryView` lists the catalog, a release installs atomically). No plugin source changes; no new backend code beyond the `.gitattributes` LF hardening — a deploy + manual-verify slice, with Phase 2 Supabase deferred.

## Summary
The slice is ~zero new code: the plugin's read contract is frozen and fully built (`src/library/registry-client.ts` 3 GET routes, 949 tests green), and the sibling backend's generated `site/` is code-complete and gate-green (regen-diff + wire-parity + 50 tests, all verified by the prior validation artifact). The research confirms the generated bodies pass every client guard field-by-field, `normalizeRegistryUrl` accepts a `*.pages.dev` https origin and rejects http at construction (the plugin never emits an http request), Cloudflare Pages returns HTTP 404 status (not 200) for missing 200-rewrite targets when a `404.html` is shipped (so FR4's `not-found` mapping holds), and the edge auto-redirects http→https. The transactional installer is journal-first/marker-last with bidirectional manifest↔content closure and CRLF-immune integrity (hashes the parsed string, not raw bytes).

**Two live-verify risks survive research** (both resolved only by the deploy+verify step itself, not by code reading): (1) **highest risk** — `registry-client.ts:127` calls Obsidian's `requestUrl()` directly with the already-percent-encoded URL and NO `fetch()` fallback; precedent commits `e14c5c1`→`fa3d478`→`d9c9487` proved `requestUrl` re-encodes already-encoded URLs on some platforms → double-encoding → 404 for the Cyrillic `КТ-грудная-клетка` and space `chest ct` packageIds. Cloudflare decodes percent-encoding ONCE before asset lookup (so a single encode works; a double-encode 404s). The new client has no `fetch()` fallback the old system added. (2) Cloudflare's percent-encoding decode-before-asset-lookup is inferred from the shared Workers Static Assets infra + `kv-asset-handler` precedent, NOT stated outright in Pages docs — a 60-second post-deploy `curl` of the Cyrillic/space URLs is the definitive confirmation. Per the checkpoint decision, if the live verify 404s on Cyrillic/space, the transport fix is **out-of-scope** for this slice (document the gap for a follow-up); the slice stays "no plugin source changes."

The only non-docs deliverable is FR9: a `.gitattributes` in the backend repo (confirmed none exists) pinning `* text=auto eol=lf` so the `check-regen-diff.mjs:52` raw-`Buffer.equals` byte gate stays robust for Windows contributors. The entire current `src/library/` cluster is a rebuild (founding commit `d4eb13f`, 2026-08-05) that has NEVER run against a live origin — every manual in-Obsidian criterion in its validation doc is still unchecked, so this slice is the first live exercise.

## Detailed Findings

### Read contract — three GET routes + never-throws union
The client (`src/library/registry-client.ts`) exposes three routes, each returning an explicit result union (`ok` / `not-found` / `unavailable`) and never throwing:
- `fetchCatalog` (`:89`) — `GET ${baseUrl}/catalog` (`:94`); 2xx → `isCatalogResponse` (`src/library/registry-model.ts:33`, requires `entries` array of `isCatalogEntry` + string `serverTime` at `:39`) → stamps a `CatalogSnapshot` with `CATALOG_SNAPSHOT_SCHEMA`/`VERSION` sentinels (`src/library/library-model.ts:22-23`, client-local — the server does NOT send these).
- `fetchRelease` (`:121`) — `GET /packages/{enc(id)}/releases/{enc(ver)}` (`:126`); 404→`not-found` (`:128`); 2xx → `isReleaseResponse` (`src/library/registry-model.ts:43`, requires `manifest` passes `isPackageManifest` + `snippetContents` array of `{relPath,content}` at `:47-48`) → identity check `body.manifest.packageId === packageId` (`:139`, mismatch→`unavailable`, NOT `not-found`).
- `fetchReleaseManifest` (`:155`) — `GET .../manifest` (`:160`); same 404/identity pattern (`:162`, `:173`); expects a `{manifest}` wrapper validated by `isPackageManifest`.
- Every route short-circuits to `unavailable` when `isUnavailable()` (`:79`, `this.baseUrl === ''`) — so an empty `libraryRegistryUrl` + empty `DEFAULT_REGISTRY_URL` (`:22`) yields an explicit unavailable banner, never a throw.

### Wire guards — field-by-field acceptance
`isPackageManifest` (`src/library/library-model.ts:174`) requires: `schema === 'radiprotocol.package'` (`:178`), `version === 1` (`:179`), string `packageId`/`releaseVersion`, `isProtocolDocumentV1(protocolDoc)` (`src/protocol/protocol-document.ts:167` — shallow: sentinels `:171-172` + 4 string fields + `Array.isArray(nodes/edges)`, ignores extra fields), string `protocolSha256`, `snippetFiles.every(isPackageSnippetFile)` (`:185`, relPath+sha256 strings), string `catalogEntryId` (`:186`), string `publishedAt` (`:187` — NO ISO/precision check, any string passes), `isOptionalAuthor(author)` (`:188` — `undefined` OR `{displayName:string}`; `null` FAILS). `isCatalogEntry` (`:193`) requires `author` as a NON-optional object with string `displayName` (`:196-200`, `:210`) — a catalog entry missing `author` flips the guard; `summary` is `isOptionalString` (`:209`). The seed always provides `author` (`src/seed/seed.ts:57/72/87`, `:133/138`), so no guard failure is predicted.

### URL normalization + https-only
`normalizeRegistryUrl` (`src/library/registry-client.ts:53-63`) trims (`:54`), empty→`''` (`:55`), `new URL()` parse (invalid→`''`), rejects non-`https:` to `''` when `httpsOnly` (default `true`, `:62`), returns `trimmed.replace(/\/+$/, '')` (`:63` — the ORIGINAL trimmed string minus trailing slashes, NOT `parsed.toString()`, so the host form is preserved as typed). For `https://<project>.pages.dev` → returns the cleaned origin; for `http://...` → `''`; trailing slash → stripped. The rejection happens in the constructor (`:72-73`) BEFORE any `requestUrl` call, so the plugin physically cannot emit an http request — the http→https AC is jointly satisfied by Cloudflare's edge redirect (for direct `curl http://` tests) and the plugin's construction-time scheme gate.

### URL-encoding round-trip + the requestUrl double-encoding risk
`fetchRelease` composes `${baseUrl}/packages/${encodeURIComponent(packageId)}/releases/${encodeURIComponent(version)}` (`:126`). For `КТ-грудная-клетка` this yields `%D0%9A%D0%A2-%D0%B3...`; for `chest ct` → `chest%20ct` (confirmed by test `src/__tests__/library/registry-client.test.ts:106-107`). The `_redirects` rule `/packages/* /packages/:splat.json 200` (`radiprotocol-library-backend/site/_redirects:2`) captures `:splat` = the percent-encoded segment path and rewrites to `...json`. On-disk files use LITERAL UTF-8 names (`radiprotocol-library-backend/src/generator/generate.ts:49`, comment at `:6-8` asserts Cloudflare decodes the encoding for filesystem lookup). The identity check (`registry-client.ts:139`) compares the DECODED literal from the JSON body against the original unencoded `packageId` argument — a transparent round-trip with no double-encoding in the comparison itself.

**The risk is the TRANSPORT, not the identity check.** `registry-client.ts:127` passes the already-percent-encoded URL to Obsidian's `requestUrl()` directly. Precedent commits `e14c5c1`/`fa3d478`/`d9c9487` (2026-05-29, all in the now-deleted old library subsystem) proved `requestUrl` RE-ENCODES already-encoded URLs on some platforms → `%D0%9A` becomes `%25D0%259A` → Cloudflare decodes that to the literal string `%D0%9A` (not `КТ`) → file not found → 404. The old system's resolution was `fetch()`-first (passes encoded URLs unmolested) + `requestUrl` fallback (`d9c9487`). The new client has NO `fetch()` fallback. Cloudflare decodes percent-encoding ONCE before asset lookup (per the web-research finding, inferred from Workers Static Assets + `kv-asset-handler`), so a single encode works but a double-encode 404s. The Cyrillic + space installs are therefore the highest-risk live checks. The in-code comment at `registry-client.ts:117-118` cites `e14c5c1` as the precedent for per-segment encoding but does not address the re-encoding hazard.

### 404-for-unknown + Cloudflare 200-rewrite semantics
`fetchRelease`'s 404→`not-found` branch (`registry-client.ts:128`) is the ONLY `not-found`-producing path. A 200-with-HTML-body (e.g. `404.html` served with status 200) would skip the 404 check, then `res.json` throws `SyntaxError` on the HTML body → caught → `unavailable` (via `:143` catch), breaking the FR4 `not-found` distinction (the detail modal at `src/views/library-item-detail-modal.ts:125-128` shows "not found" for `not-found` but "load failed" for `unavailable`). Web research confirms this does NOT happen: Cloudflare Pages, when a `404.html` is shipped, returns HTTP **404 status** (with the `404.html` body) for a 200-rewrite target that doesn't exist on disk — because 200 is the only "Proxying/rewrite" status code and the not-found handling is delegated to asset lookup (`not_found_handling="404-page"` → "404 Not Found with nearest 404.html"). Without a `404.html`, Pages assumes an SPA and returns 200+`index.html` for misses — which WOULD break FR4; the backend ships `site/404.html`, so FR4 holds. `requestUrl` with `throw: false` surfaces the 404 status without throwing (confirmed by test `registry-client.test.ts:91-95`).

### Settings → LibraryView → installer wiring
`libraryRegistryUrl` (`src/settings.ts:36`, default `''` at `:46`) `onChange` trims (`:136`), saves, and calls `rebuildLibraryServices()` (`:140`) so the override takes effect without a reload. `rebuildLibraryServices` (`src/main.ts:287-292`) constructs a fresh `RegistryClient` (`:288`, captures new readonly `baseUrl`) and `LibraryService` (`:289-292`). `LibraryView.refresh()` (`src/views/library-view.ts:217`) dereferences `this.plugin.libraryService` LIVE on every call (`:225` `listCatalog()`) — NO stale reference; the next `refresh()` picks up the rebuilt service. Empty URL → `fetchCatalog` returns `unavailable` → `listCatalog` (`src/library/library-service.ts:90`, fetchCatalog at `:97`) returns `{entries:[], available:false, reason}` → `LibraryView` renders the unavailable banner (not a throw). The full install click chain: row click (`library-view.ts:349`) → `openDetail` (`:414`, `new LibraryItemDetailModal` `:415`) → manifest fetch (`library-item-detail-modal.ts:116` `getReleaseManifest`) → install button → `openInstall` (`library-view.ts:419/423`, `new LibraryInstallProgressModal` `:424`) → `runInstall` (`library-install-progress-modal.ts:100`, `libraryService.install` `:101`) → `LibraryService.install` (`library-service.ts:127`, `fetchRelease` `:129` + `installer.install` `:134`).

**Discrepancy noted (functionally safe):** the `rebuildLibraryServices` docstring at `main.ts:284` claims `installer`/`recordStore`/`cacheStore` are "preserved," but the code at `:289-292` passes no store options, so `LibraryService`'s constructor defaults `?? new LibraryInstaller/LibraryCacheStore/InstalledRecordStore` fire (`library-service.ts:82-84`) — creating FRESH instances. This is behaviorally safe because all state lives on disk (`.radiprotocol/library/`), not in memory; the old instances are garbage-collected. The docstring is inaccurate but the behavior is correct.

**Recovery ordering:** `recoverInterruptedInstalls()` runs at `main.ts:87` BEFORE any `registerView` (`:92`, `:95`, `:105`) — no user action can race a recovering install.

### Atomic install + recovery + integrity
`LibraryInstaller.install` (`src/library/library-installer.ts:97`) runs under a single global `installMutex` + fixed `INSTALL_LOCK_KEY` (`:43-44`, strict serialization, `:98`). Flow: `planInstall` (`:181`, all in-memory validation, no final-path I/O) → journal write (`:108`, BEFORE any final-path write) → snippet writes (`:116-117`, `ensureFolderPath` + `adapter.write`) → protocol write (`:119`) → **marker write LAST** (`:120-121`, presence+validity = commit signal) → best-effort journal cleanup. On any commit throw → `rollbackTransaction` (`:123`).

`planInstall` validates manifest↔content closure BIDIRECTIONALLY: every `manifest.snippetFiles[].relPath` has matching content (`:219` — "manifest references snippet ... but no content was provided") AND every content entry is manifest-declared (`:215` duplicate, `:223` undeclared). A second missing-snippet detection is the staged `GraphValidator` probe (`:303-304`, `snippetFileProbe: abs => plannedFinalPaths.has(abs)`) — a protocol node referencing a file not in `manifest.snippetFiles` fires `graphValidator.snippetFileMissing`.

`verifyIntegrity` (`src/library/integrity.ts:56-57`) returns `false` on mismatch (NEVER throws — only throws if Web Crypto `subtle` is unavailable, `:18-21`); `planInstall` maps `false` → `{error}` (`:230` snippet, `:236` protocol) → `install` maps to `{status:'failed', reason}` (`:104`), surfaced as in-modal text (`library-install-progress-modal.ts:128-129`, `library.installFailed`), NOT a Notice/throw.

**Integrity is CRLF-immune.** `sha256String` (`integrity.ts:30-32`) hashes `new TextEncoder().encode(content)` — the UTF-8 bytes of the JavaScript STRING. For snippets, `content` is the JSON-PARSED string value from `res.json`; JSON parsers treat inter-token CR/LF as insignificant whitespace and decode string escape sequences identically regardless of the file's line endings. So CRLF in the served `.json` file does NOT change the parsed snippet string and does NOT cause a hash divergence. (The protocol hash IS re-canonicalized: `JSON.stringify(manifest.protocolDoc, null, 2) + '\n'` at `library-installer.ts:235` — also line-ending-independent.) CRLF is therefore only a risk for the `check-regen-diff` raw-byte gate (FR9), NOT for install integrity. A partial download producing valid JSON with missing snippet content WOULD trigger the `:219` missing-snippet error, but HTTPS + immutable CDN caching makes this extremely unlikely.

### Generated site/ artifacts + guard self-assertion
`generate()` (`radiprotocol-library-backend/src/generator/generate.ts:29`) writes `site/catalog.json` (`:58`, `{entries, serverTime}`), per-release `site/packages/<id>/releases/<ver>.json` (`:49`, `{manifest, snippetContents}`), and `site/packages/<id>/releases/<ver>/manifest.json` (`:51`, `{manifest}` wrapper) — using LITERAL UTF-8 `packageId`/`releaseVersion` as directory names. It self-asserts mutual consistency (`:35-37` catalogEntryId===packageId, packageId===catalogEntry.packageId, releaseVersion===latestVersion; `:40` snippetContents/snippetFiles relPath set equality) AND the same wire guards the client runs (`:44` `isReleaseResponse`, `:45` `isPackageManifest`, `:57` `isCatalogResponse`) — using the backend's DUPLICATED guard copies. The generator cannot produce invalid output (an assertion throws and aborts the build). The seed (`src/seed/seed.ts`) defines 3 slash-free packages: `chest-ct` (`:52`), `КТ-грудная-клетка` (`:67`), `chest ct` (`:82`), all with `authorDisplayName: 'Roman Shulgha'` and pinned timestamps `2026-01-01T00:00:00.000Z` (`SEED_SERVER_TIME` `:47`); `buildSeedReleases` (`:107`) is deterministic.

### Regen-diff + wire-parity gates + LF hardening (FR9)
`check-regen-diff.mjs` (`radiprotocol-library-backend/scripts/`): `SITE_DIR='site'` (`:19`), `STATIC_CONFIG = Set(['_redirects','_headers','404.html'])` (`:20`) excluded from the diff (`:47`); esbuild-bundles the generator (`:38`), runs it into a temp dir (`:40`), three-way compares (missing generated `:45`, missing committed excl static `:46-47`, raw `readFileSync(genAbs).equals(readFileSync(comAbs))` byte-diff `:52`), `process.exit(1)` on any mismatch (`:66`). The raw-`Buffer.equals` is the LF-hardening vulnerability: a Windows clone with `core.autocrlf=true` checks out `site/**/*.json` as CRLF while the generator writes LF → every JSON file flagged.

`check-wire-parity.mjs`: `GUARD_NAMES` = 5 served guards (`:24`); reads `plugin-pin.txt` (`:28`, pin = `4c680bdef5d9b485369bf246c09e21873cb41212`); `PLUGIN_REPO_PATH ?? '../RadiProtocol'` (`:31`); `git rev-parse` verifies the plugin checkout is at exactly the pinned rev (`:37-39`); esbuild-bundles both sides' guard files (`loadGuards` `:54`, plugin `:66`, backend `:71`); `deriveDescriptor` (`:103` via `lib/probe-descriptor.mjs`) probes each guard's behavior (requiredness by `undefined`-probe, kind, openness) on seed data; diffs descriptors (`:112`); `process.exit(1)` on drift (`:129`). Both gates are wired into `npm run check` (`package.json:16`: typecheck → regen-diff → wire-parity → test). CI (`.github/workflows/ci.yml`) runs `ubuntu-latest` (autocrlf=false, unaffected); the gap is Windows local runs. **Confirmed: no `.gitattributes` exists** in the backend repo. FR9 adds `* text=auto eol=lf` (checkpoint decision) — global, single line, forces LF on all text files; does NOT break the excluded `_redirects`/`_headers`/`404.html` (skipped by `STATIC_CONFIG`, and Cloudflare serves LF fine).

## Code References
Plugin repo (`Z:/projects/RadiProtocol/`):
- `src/library/registry-client.ts:22` — `DEFAULT_REGISTRY_URL = ''` (empty until official domain provisioned)
- `src/library/registry-client.ts:53-63` — `normalizeRegistryUrl` (trim → URL parse → https-only → strip trailing slash)
- `src/library/registry-client.ts:72-73` — constructor captures readonly `baseUrl` via normalize
- `src/library/registry-client.ts:89-115` — `fetchCatalog` (GET /catalog → isCatalogResponse → CatalogSnapshot)
- `src/library/registry-client.ts:117-118` — comment citing `e14c5c1` precedent for per-segment encoding
- `src/library/registry-client.ts:121-148` — `fetchRelease` (encodes path, 404→not-found `:128`, identity check `:139`)
- `src/library/registry-client.ts:155-184` — `fetchReleaseManifest` (encodes path, 404→not-found `:162`, identity `:173`)
- `src/library/registry-model.ts:33-41` — `isCatalogResponse` (entries array + string serverTime)
- `src/library/registry-model.ts:43-51` — `isReleaseResponse` (isPackageManifest + snippetContents array)
- `src/library/library-model.ts:174-190` — `isPackageManifest` (sentinels + structural + isOptionalAuthor)
- `src/library/library-model.ts:193-211` — `isCatalogEntry` (author REQUIRED `:196-200`, summary optional `:209`)
- `src/library/library-model.ts:162-167` — `isOptionalAuthor` (undefined OR {displayName}; null FAILS)
- `src/protocol/protocol-document.ts:167-183` — `isProtocolDocumentV1` (shallow: sentinels + fields + arrays)
- `src/library/integrity.ts:30-33` — `sha256String` (TextEncoder → SHA-256; hashes the string, not raw bytes)
- `src/library/integrity.ts:56-58` — `verifyIntegrity` (false on mismatch, never throws)
- `src/library/library-installer.ts:97-121` — `install` (mutex → plan → journal `:108` → snippets `:116-117` → protocol `:119` → marker LAST `:120-121`)
- `src/library/library-installer.ts:181-345` — `planInstall` (in-memory validation; closure `:219`, integrity `:229/235`)
- `src/library/library-installer.ts:148-174` — `recoverInterrupted` (marker valid→commit, else rollback `:168`)
- `src/library/library-service.ts:82-84` — constructor `?? new` store defaults (rebuild creates fresh instances)
- `src/library/library-service.ts:90-115` — `listCatalog` (fetchCatalog `:97`, unavailable→empty+banner)
- `src/library/library-service.ts:127-137` — `install` (fetchRelease `:129` + installer.install `:134`)
- `src/settings.ts:36` — `libraryRegistryUrl?: string` field
- `src/settings.ts:135-140` — onChange (trim `:136` → save → rebuildLibraryServices `:140`)
- `src/main.ts:74` — load-time `new RegistryClient({baseUrl: libraryRegistryUrl || DEFAULT_REGISTRY_URL})`
- `src/main.ts:83-87` — LibraryService construction + `recoverInterruptedInstalls()` BEFORE views
- `src/main.ts:92/95/105` — registerView calls (after recovery)
- `src/main.ts:284-292` — `rebuildLibraryServices` (docstring "preserved" vs code creates fresh `:288-292`)
- `src/views/library-view.ts:217-231` — `refresh` (live `this.plugin.libraryService` deref `:225`)
- `src/views/library-view.ts:414-426` — `openDetail`/`openInstall` (modal construction)
- `src/views/library-install-progress-modal.ts:100-130` — `runInstall` (install `:101`, failed render `:128-129`)
- `src/views/library-item-detail-modal.ts:116-128` — manifest fetch + not-found vs load-failed rendering
- `src/__tests__/library/registry-client.test.ts:91-95` — 404→not-found test; `:106-107` — chest%20ct encoding test

Sibling backend repo (`Z:/projects/radiprotocol-library-backend/`):
- `site/_redirects:1-2` — `/catalog /catalog.json 200` + `/packages/* /packages/:splat.json 200`
- `site/_headers` — `/packages/*` immutable cache
- `site/404.html` — static not-found page (makes Pages return 404 status, not SPA 200)
- `src/generator/generate.ts:29-58` — `generate` (writes catalog/releases/manifest; self-asserts guards `:44-45/57`)
- `src/generator/generate.ts:6-8` — comment asserting Cloudflare decodes percent-encoding for filesystem lookup
- `src/seed/seed.ts:47` — `SEED_SERVER_TIME`; `:52/67/82` — 3 packageIds (ASCII/Cyrillic/space); `:107` — `buildSeedReleases`
- `scripts/check-regen-diff.mjs:20` — `STATIC_CONFIG` exclusion set; `:52` — raw `Buffer.equals` byte-diff; `:66` — exit(1)
- `scripts/check-wire-parity.mjs:24` — `GUARD_NAMES` (5); `:28` — plugin-pin read; `:37-39` — rev-parse verify; `:103` — deriveDescriptor; `:129` — exit(1)
- `plugin-pin.txt` — `4c680bdef5d9b485369bf246c09e21873cb41212` (full SHA)
- `package.json:16` — `check` = typecheck → regen-diff → wire-parity → test
- `.github/workflows/ci.yml` — `runs-on: ubuntu-latest` (autocrlf=false; Windows local runs are the LF gap)
- `.gitattributes` — DOES NOT EXIST (FR9 creates it)

## Integration Points
### Inbound References
- `src/settings.ts:135-140` → `src/main.ts:287-292` (`rebuildLibraryServices`) → `src/library/registry-client.ts:72-73` — the `libraryRegistryUrl` setting is the sole client config; onChange rebuilds the client+service mid-session.
- `src/views/library-view.ts:225` → `src/library/library-service.ts:90` (`listCatalog`) → `src/library/registry-client.ts:89` (`fetchCatalog`) — LibraryView reads the service LIVE on every refresh (no stale reference).
- `src/views/library-install-progress-modal.ts:101` → `src/library/library-service.ts:127` (`install`) → `src/library/registry-client.ts:121` (`fetchRelease`) + `src/library/library-installer.ts:97` (`install`) — the in-Obsidian install click chain.
- `src/views/library-item-detail-modal.ts:116` → `src/library/library-service.ts:179` (`getReleaseManifest`) → `src/library/registry-client.ts:155` — the trust-preview manifest fetch.

### Outbound Dependencies
- `src/library/registry-client.ts:94/127/161` → Obsidian `requestUrl` (esbuild-external; injected in tests) — the transport; NO `fetch()` fallback.
- `src/library/library-service.ts:134` → `src/library/library-installer.ts:97` — facade delegates install to the transactional installer.
- `src/library/library-installer.ts:117/119/121` → `app.vault.adapter.write` + `writeJsonFile` — the staged vault writes (snippets, protocol, marker).
- `src/library/library-installer.ts:229/235` → `src/library/integrity.ts:56` (`verifyIntegrity`) → Web Crypto `subtle.digest` — SHA-256 verification.

### Infrastructure Wiring
- `src/main.ts:74/83/87/92/95/105` — onload ordering: RegistryClient → LibraryService → recoverInterruptedInstalls → registerView (recovery before any view).
- `src/main.ts:287-292` — `rebuildLibraryServices` reconstructs client+service (fresh stores via `library-service.ts:82-84` defaults; state on disk).
- `radiprotocol-library-backend/site/_redirects` — 2 splat 200-rewrites serve the extension-less read contract.
- `radiprotocol-library-backend/site/404.html` — makes Cloudflare return 404 status for missing routes (FR4).
- `radiprotocol-library-backend/.github/workflows/ci.yml` — CI runs the gate chain on ubuntu-latest.
- `radiprotocol-library-backend/package.json:16` — `check` wires typecheck + regen-diff + wire-parity + test.

## Architecture Insights
- **Frozen GET-only read contract, never-throws union:** the 3 routes return `ok`/`not-found`/`unavailable` and never throw; 404 is the sole `not-found` trigger; identity mismatch is `unavailable` (a malformed/inconsistent response, not a missing one).
- **Duplicated wire types + behavioral parity gate:** the backend hand-copies the plugin's guard files and `check-wire-parity.mjs` probe-compares their BEHAVIOR (not their text) at a pinned plugin rev — so the generator's build-time self-assertions and the client's runtime validation are guaranteed to agree on the same bytes.
- **Journal-first / marker-last transactional install:** the `InstalledRecord` marker written LAST is the commit signal; recovery-on-load (before views) commits valid markers and rolls back journals lacking one.
- **Integrity over parsed string (snippets) vs canonical JSON (protocol):** `sha256String` hashes the JavaScript string, making snippet integrity CRLF-immune; the protocol hash is re-canonicalized. CRLF is only a regen-diff byte-gate concern (FR9), not an integrity concern.
- **Generator self-asserts the same guards:** the backend cannot emit a body that fails a client guard — the build aborts first.
- **normalizeRegistryUrl rejects non-https at construction:** the plugin never emits an http request; the scheme gate is upstream of any `requestUrl` call.
- **rebuildLibraryServices creates fresh stores (state on disk):** the `main.ts:284` docstring's "preserved" is inaccurate vs the code, but behaviorally safe because stores are filesystem-backed.
- **Cloudflare `_redirects` 200-rewrite + `404.html` → 404 status:** FR4's `not-found` mapping holds because Pages returns 404 (not 200) for missing rewrite targets when a `404.html` exists; http→https is auto-redirected at the edge (301).
- **Live-origin serving assumptions:** two Cloudflare behaviors (percent-encoding decode before asset lookup; `:splat` round-trip) are inferred from shared infra, not stated in Pages docs — definitively confirmed only by a post-deploy `curl`.

## Precedents & Lessons
9 commits analyzed across git history.

### Precedent: URL-encoding / requestUrl re-encoding saga
**Commit(s)**: `e14c5c1` — "fix: URL-encode Cyrillic snippet download paths, widen library buttons" (2026-05-29); `fa3d478` — "fix: inline CSS + fetch() fallback — bypass cascade and requestUrl re-encoding" (2026-05-29); `d9c9487` — "fix: swap fetch order — fetch() first, requestUrl fallback" (2026-05-29)
**Blast radius**: 2-3 files per commit, service + CSS + views layers (all in the now-DELETED old `src/snippets/library-service.ts` + `src/views/library-browser-modal.ts`).
**Follow-up fixes**: `e14c5c1` fixed `raw.githubusercontent` 404 on Cyrillic; `fa3d478` added `fetch()` fallback because `requestUrl` re-encodes already-encoded URLs → double-encode → 404; `d9c9487` swapped to `fetch()`-first because `requestUrl`-first still hit the double-encode 404.
**Lessons from docs**: `.rpiv/artifacts/designs/2026-08-06_08-53-19_community-library-backend-phase1.md` cites `e14c5c1` as the encoding precedent and flags `_redirects` matching percent-encoded paths against literal-UTF-8 files as "empirical test on deploy." `src/library/registry-client.ts:117-118` bakes in per-segment `encodeURIComponent`.
**Takeaway**: The new client uses `requestUrl` directly with NO `fetch()` fallback — the live Cyrillic/space install is the highest-risk check; if `requestUrl` double-encodes against Cloudflare, there is no fallback (per checkpoint: document the gap, transport fix is out-of-scope for this slice).

### Precedent: Current library cluster founding commit + never-done live validation
**Commit(s)**: `d4eb13f` — "feat: add moderated community library" (2026-08-05)
**Blast radius**: 35 files / 4,473 insertions across 8 layers (domain `src/library/*`, main wiring, 3 views, integration, styles, i18n, build, 8 test suites). Single-commit delivery.
**Follow-up fixes**: NONE. `git log -- src/library/` returns exactly one commit — no bug fix has ever touched these files because they have never run against a live origin.
**Lessons from docs**: `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` (verdict pass) — 949/949 tests green, transactional invariants verified, BUT every manual in-Obsidian criterion is `[ ]` unchecked (atomic install, interrupted-recovery rollback, catalog-unavailable banner, read-only integration). Closing line: "Manual Obsidian-side testing remains pending."
**Takeaway**: Treat the install/recovery loop as UNPROVEN despite 949 green unit tests — this slice is the first live exercise.

### Precedent: Install parent-folder creation bug (nested relPath)
**Commit(s)**: `9b4a886` — "fix: create parent folder when installing library snippets" (2026-05-21)
**Blast radius**: 3 files (old `src/snippets/library-service.ts` + tests + mock).
**Follow-up fixes**: part of the same-day hierarchical-browser cluster.
**Lessons from docs**: the diff shows `ensureFolderPath` was called on the full file path including filename; fix slices to the parent. The new `library-installer.ts:116` handles this, but the seed uses single-segment snippet relPaths (`lung-nodule.md`, `заключение.md`, `findings.md`) — nested relPath install is UNEXERCISED by this slice's verify.
**Takeaway**: The historical failure mode (nested-path parent-folder creation) is not exercised by the deterministic seed; a nested-relPath install is a deferred risk.

### Precedent: OLD library subsystem fully deleted (the rebuild context)
**Commit(s)**: `7e2918f` — "fix: disconnect shared library subsystem from plugin wiring" (2026-06-02, 957 deletions); `6657b8d` — "fix: complete library removal — delete files, clean settings, i18n, CSS, test mocks" (2026-06-02, 1,597 deletions)
**Blast radius**: 26 files / ~2,554 deletions — a whole subsystem excised in two commits 17 minutes apart.
**Follow-up fixes**: the deletion WAS the fix; ~2 months later `d4eb13f` rebuilt it as the moderated community library.
**Lessons from docs**: the old git-push library-admin + raw.githubusercontent snippet fetch model was rejected within a week (supporting commits `380fabe`/`4180d10`/`72b1106`/`07b3e44`, all deleted). The static-HTTPS-`_redirects` model is the deliberate replacement.
**Takeaway**: Don't reintroduce shell/git/`requestUrl`-only assumptions; the static-HTTPS model is the deliberate replacement and is still on its first live run.

### Precedent: Consistency-gate deletion silently broke `npm run check`
**Commit(s)**: `f2506ec` — "chore: remove outdated docs, scripts, and CLAUDE.md" (2026-06-02, deleted `scripts/check-consistency.mjs` + 4 gate scripts); `4d9547c` — "chore: restore repository gate scripts referenced by package.json" (2026-06-04)
**Blast radius**: scripts + `package.json`; broke `check` for ~2 days.
**Takeaway**: Gates referenced by `package.json` are load-bearing — both the plugin `npm run check` and the backend `check:wire-parity`/`check:regen-diff` are acceptance criteria; do not "clean up" any gate script referenced by `package.json`.

### Precedent: Cloudflare Pages validation FAIL→PASS (subdirectory placement)
**Commit(s)**: `4c680bd`/`1e2122e`/`bf206f5` — docs commits carrying the two validation reports.
**Blast radius**: docs-only in the plugin repo; the validated implementation is the sibling backend repo.
**Follow-up fixes**: first validation `2026-08-07_08-49-12_…cloudflare-pages.md` FAILED (backend as `RadiProtocol/backend/` subdirectory → plugin eslint picked up backend files → 8 errors → `npm run check` red); second validation `2026-08-07_09-09-57_…cloudflare-pages.md` PASSED (moved backend to separate sibling repo). Deploy-time + in-Obsidian criteria remain unchecked.
**Lessons from docs**: the passing validation's non-blocking recommendation = add a `.gitattributes` LF pin (now FR9); confirms `_redirects` 2 splat 200-rewrites, mandatory `404.html`, `_headers` immutable cache, literal-UTF-8 fixture names.
**Takeaway**: Keep the backend in the separate sibling repo (subdirectory placement breaks the plugin's eslint → `npm run check`); add the `.gitattributes` LF pin before deploying.

### Composite Lessons
1. **Obsidian `requestUrl()` re-encodes already-percent-encoded URLs on some platforms → 404 for non-ASCII paths** — the single most-recurring failure (3 fixes in one day). The new `registry-client.ts:127` uses `requestUrl` directly with NO `fetch()` fallback; the Cyrillic/space install is the highest-risk live check (`e14c5c1`/`fa3d478`/`d9c9487`).
2. **The entire current `src/library/` cluster has never run against a live origin** — one founding commit (`d4eb13f`), zero follow-up fixes, every manual in-Obsidian criterion unchecked. Treat install/recovery as unproven despite 949 green tests.
3. **Nested snippet relPath install is unexercised** — the seed uses single-segment names; the historical parent-folder bug (`9b4a886`) is not covered by this slice's verify.
4. **Gates referenced by `package.json` are load-bearing** — deleting them in "cleanup" broke `npm run check` for ~2 days (`f2506ec`→`4d9547c`).
5. **Backend must stay in the separate sibling repo** — subdirectory placement broke the plugin's eslint and turned `npm run check` red (the only FAIL verdict in Phase-1 validation history).
6. **Add the `.gitattributes` LF pin before deploy** — the regen-diff raw-`Buffer.equals` byte gate breaks on a Windows clone with `core.autocrlf=true`; FR9 closes this with `* text=auto eol=lf`.
7. **`DEFAULT_REGISTRY_URL` stays empty; configure via `libraryRegistryUrl` only** — do not bake a pre-launch `*.pages.dev` URL into the shipped plugin (this slice is explicitly no plugin source changes).
8. **The old git-push publish model was rejected within a week** — don't reintroduce shell/git composition; the static-HTTPS-`_redirects` model is the deliberate replacement.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-08-07_09-59-04_library-backend-phase1-deploy-verify.md` — this slice's FRD (the chained input; 9 decisions + recommended approach)
- `.rpiv/artifacts/discover/2026-08-06_08-12-45_community-library-backend.md` — parent FRD (inherited D1-D6)
- `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` — source FRD (31 inherited decisions)
- `.rpiv/artifacts/designs/2026-08-06_08-53-19_community-library-backend-phase1.md` — Phase-1 design (cites e14c5c1; flags _redirects encoding as empirical-on-deploy)
- `.rpiv/artifacts/plans/2026-08-07_08-01-24_community-library-backend-phase1.md` — Phase-1 plan
- `.rpiv/artifacts/validation/2026-08-07_09-09-57_community-library-backend-phase-1-static-registry-on-cloudflare-pages.md` — most recent validation (PASS; unchecked deploy-time + in-Obsidian criteria; .gitattributes recommendation)
- `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` — foundation validation (PASS; all manual in-Obsidian criteria unchecked)

## Developer Context
**Q (discover: Inherited baseline — frozen read contract): Pre-resolved from codebase evidence — the plugin's read contract is frozen at three GET routes (`src/library/registry-client.ts:89/121/155`); keep frozen or evolve?**
A: Keep frozen — the backend serves the 3 routes verbatim; the plugin client stays untouched.

**Q (discover: Inherited baseline — separate sibling repo + duplicated wire types + parity gate): Pre-resolved — a separate sibling backend repo exists with duplicated wire types + a cross-repo parity gate; keep or consolidate?**
A: Keep separate + parity gate — `radiprotocol-library-backend` @ `92ee719`, `scripts/check-wire-parity.mjs` exit 0; plugin build untouched.

**Q (discover: Inherited baseline — publishing = net-new backend surface, plugin read-only): Pre-resolved — the client is GET-only and manifest fields are server-controlled; keep that boundary or add plugin-side publish now?**
A: Backend-only publish for now — the plugin stays read-only this delivery.

**Q (discover: Inherited baseline — keep auth/crypto deferrals): Pre-resolved — SHA-256 now / ed25519 deferred (`src/library/integrity.ts`); email magic link only / OAuth deferred. Keep deferrals or pull either in?**
A: Keep deferrals — matches the "just me for now" intent.

**Q (discover: Sequencing — finish Phase 1 deploy + verify first): What should THIS continuation deliver? Phase 1 is code-complete but not deployed/verified in-Obsidian; Phase 2 (Supabase) is not started.**
A: Finish Phase 1: deploy + verify — ~zero new code; validates the built client against a live origin; Phase 2 deferred.

**Q (discover: Hosting target — free `*.pages.dev` subdomain now): Which hosting target for the Phase-1 deploy?**
A: Free `*.pages.dev` subdomain now — zero cost, no domain purchase; a custom domain can be added to the same Pages project later.

**Q (discover: Deploy mechanism — Wrangler CLI direct upload): How should `site/` get deployed to Cloudflare Pages?**
A: Wrangler CLI direct upload — simplest one-shot, no GitHub remote/CI setup; manual re-run per change is acceptable for "just me for now."

**Q (discover: Seed content — ship the existing seed as-is): What should the first live catalog contain?**
A: Ship the existing seed as-is — the deterministic seed already exercises URL-encoding, identity-check, and install paths; curation is a cheap follow-up.

**Q (discover: Bundled `DEFAULT_REGISTRY_URL` stays empty): Should the plugin's bundled `DEFAULT_REGISTRY_URL` be set to the live `*.pages.dev` origin?**
A: Leave empty; configure via the `libraryRegistryUrl` setting (`src/settings.ts:36`) — avoids baking a pre-launch URL into the shipped plugin.

**Q (`src/library/registry-client.ts:127`): The new client calls `requestUrl()` directly with the already-percent-encoded URL and NO `fetch()` fallback; precedent `e14c5c1`→`fa3d478`→`d9c9487` proved `requestUrl` re-encodes already-encoded URLs on some platforms → double-encoding → 404 for Cyrillic/space. If the live in-Obsidian verify reveals `requestUrl` double-encodes against Cloudflare, is adding a `fetch()`-first fallback in-scope for this slice?**
A: Out-of-scope; document the gap — the slice stays "no plugin source changes"; if the live verify 404s on Cyrillic/space, record it as an open finding for a follow-up transport fix (matches the FRD's deliberate Phase-1 sequencing).

**Q (`radiprotocol-library-backend/scripts/check-regen-diff.mjs:52` + `:20`): FR9 adds a `.gitattributes` (none exists today); the regen-diff gate uses raw `Buffer.equals` and excludes `_redirects`/`_headers`/`404.html` via `STATIC_CONFIG`. Which line-ending pin form should the research recommend?**
A: `* text=auto eol=lf` — global, single line, forces LF on all text files; simplest + most robust; doesn't break the excluded static files (Cloudflare serves LF fine); also normalizes `.ts`/`.mjs` source for cross-platform consistency.

## Related Research
- `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` — source research for the moderated community library (client foundation)
- `.rpiv/artifacts/research/2026-08-06_08-19-22_community-library-backend.md` — research for the community library backend (Phase-1 static registry design)

## Open Questions
1. **Does Obsidian's `requestUrl()` double-encode the already-percent-encoded URL against the live Cloudflare origin?** (Cyrillic `КТ-грудная-клетка` + space `chest ct` installs) — the highest-risk live-verify item; NOT resolvable by code reading, only by the in-Obsidian install attempt. Per checkpoint: if it 404s, document the gap (transport fix out-of-scope for this slice).
2. **Does Cloudflare Pages decode percent-encoding before asset lookup for `:splat`-rewritten paths?** — inferred YES from Workers Static Assets + `kv-asset-handler` precedent, but NOT stated in Pages docs; definitively confirmed only by a post-deploy `curl -sI https://<origin>/packages/%D0%9A.../releases/1.0.0` (expect 200 + JSON content-type).
3. **Is a nested-snippet `relPath` install exercised?** — the seed uses single-segment relPaths only; the historical parent-folder bug (`9b4a886`) is not covered by this slice's verify (deferred risk, out of scope per the FRD's "ship the existing seed as-is" decision).