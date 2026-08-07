---
template_version: 1
date: 2026-08-07T09:09:57+0300
author: Roman Shulgha
commit: 4c680bd
branch: main
repository: RadiProtocol
topic: "Validation of Community Library backend — Phase 1 (static registry on Cloudflare Pages)"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-08-07_08-01-24_community-library-backend-phase1.md"
tags: [validation, backend, library, registry, wire-types, seed, generator, cloudflare-pages, parity-gate, sha256, static-registry]
last_updated: 2026-08-07T09:09:57+0300
---

## Validation Report: Community Library backend — Phase 1 (static registry on Cloudflare Pages)

> **Refreshed after the placement fix.** An earlier validation run (`2026-08-07_08-49-12_…`, `verdict: fail`) found the backend lived as a subdirectory `RadiProtocol/backend/`, which made the plugin's `npm run lint` pick up `backend/` files and fail (`npm run check` red). The fix was applied: the backend was moved to a **separate sibling repo** at `Z:/projects/radiprotocol-library-backend/` (git-initialized, branch `main`, initial commit `92ee719`), matching the plan's separate-repo intent. This report re-verifies the post-fix state.
>
> **Implementation location:** `Z:/projects/radiprotocol-library-backend/` (separate sibling of the plugin repo). All file paths below are relative to that repo root unless noted. The plugin repo remains at the pinned rev `4c680bdef5d9b485369bf246c09e21873cb41212` (== `plugin-pin.txt`); its source is untouched.

### Implementation Status

- ✓ Phase 1: Repo scaffold + duplicated wire types + integrity — Fully implemented
- ✓ Phase 2: Shared seed — Fully implemented
- ✓ Phase 3: Deterministic generator + Cloudflare site config — Fully implemented
- ✓ Phase 4: Cross-repo parity gate — Fully implemented
- ✓ Phase 5: Contract tests + regen-diff + CI — Fully implemented

All 22 planned files are present, plus two justified extras: `package-lock.json` (required by CI's `npm ci`) and `.gitignore` (`node_modules/`, `dist/` — standard for any Node repo). `vitest.config.ts` (originally a workaround for the subdirectory layout) is now redundant given the separate-repo root but harmless — explicit `include` + `environment: node`.

### Automated Verification Results

- ✓ Typecheck (backend): `npm run typecheck` — passes, no errors
- ✓ Full test suite (backend): `npm test` — 4 files, 50 tests pass (wire-types + seed + generate + contract)
- ✓ Wire-type parity gate: `npm run check:wire-parity` with the **default** `PLUGIN_REPO_PATH=../RadiProtocol` (resolves to `Z:\projects\RadiProtocol` from the sibling, no override needed) — all 5 served guards (`isCatalogResponse`, `isReleaseResponse`, `isPackageManifest`, `isCatalogEntry`, `isProtocolDocumentV1`) descriptors match, exit 0
- ✓ Regen-diff gate: `npm run check:regen-diff` — `site/` byte-identical to regenerated output (7 generated files), exit 0
- ✓ Full backend check: `npm run check` (typecheck + regen-diff + wire-parity + test, default `PLUGIN_REPO_PATH`) — exit 0
- ✓ Parity-gate drift detection (manual criterion exercised): flipping `PACKAGE_MANIFEST_SCHEMA` in the backend → gate exits 1; revert → exit 0
- ✓ Regen-diff drift detection (manual criterion exercised): mutating `site/catalog.json` → gate exits 1; revert → exit 0
- ✓ **Plugin repo `npm run lint`: exit 0** (was exit 1 before the fix) — zero `backend/` references; `backend/` no longer present in the plugin working tree
- ✓ **Plugin repo `npm run check` (full): exit 0** — build + lint + tests + i18n parity + agent-docs all green. (The lone `⚠️ Knip advisory` is a pre-existing environment issue — `npx knip` failed to run — unrelated to the backend and non-blocking; the check exits 0.)
- ✓ No regressions: plugin `npm test` unaffected (69 files, 949 tests; vitest scopes to `src/__tests__/**`)

### Code Review Findings

#### Matches Plan:

- `src/wire-types/*.ts` — the served wire-type guards are byte-identical to the plugin's sources (verified by `diff` of each function body): `isPackageManifest`, `isCatalogEntry`, `isCatalogResponse`, `isReleaseResponse`, `isPackageSnippetFile`, `isOptionalAuthor`, `isOptionalString`, `isProtocolDocumentV1`, and the integrity helpers `toHex`/`sha256String`/`verifyIntegrity`. Sentinels (`PROTOCOL_SCHEMA`/`PROTOCOL_VERSION`, `PACKAGE_MANIFEST_SCHEMA`/`PACKAGE_MANIFEST_VERSION`) match. `createEmptyProtocolDocument` matches in values and key order (the `protocolSha256` hashed bytes).
- `src/wire-types/` has zero `obsidian` imports (Phase 1 manual criterion — `grep -r "obsidian"` returns nothing); `PackageManifest` has no `signature`/`ed25519` field (D11).
- `src/seed/seed.ts` — includes Cyrillic `КТ-грудная-клетка` + space `chest ct` packageIds; all packageIds slash-free; pinned timestamps + explicit `startNodeId` (no `Math.random` in the seed path); `catalogEntryId === packageId`; `protocolSha256` = real SHA-256 of `JSON.stringify(doc,null,2)+'\n'`; `buildSeedReleases` is deterministic (building twice → byte-identical, asserted in `seed.test.ts`).
- `src/generator/generate.ts` — emits exactly the three route artifacts: `catalog.json` (CatalogResponse), `packages/<id>/releases/<ver>.json` (ReleaseResponse), `packages/<id>/releases/<ver>/manifest.json` (the `{manifest}`-only wrapper — not bare, not full release); literal-UTF-8 file names; pinned `serverTime`; mutual-consistency + guard-validity assertions; CLI guard fires only when `argv[1]` ends with `generate.cjs`.
- `site/_redirects` — exactly the 2 splat 200-rewrite rules; `site/404.html` present; `site/_headers` sets `/packages/* Cache-Control: public, max-age=86400, immutable`.
- `scripts/check-wire-parity.mjs` + `scripts/lib/probe-descriptor.mjs` — probe-based (no hand-written descriptors); derives descriptors behaviorally on BOTH the plugin's compiled guards (pinned rev) and the backend's; `GUARD_NAMES` excludes client-only `isCatalogSnapshot`/`isInstalledRecord`; enriched seeds probe optional declared fields; plugin repo read-only.
- `scripts/check-regen-diff.mjs` — bundles the generator into a separate temp dir, raw-`Buffer.equals` byte diff, excludes hand-written static config (`_redirects`/`_headers`/`404.html`).
- `.github/workflows/ci.yml` — checkout self → read pin → checkout plugin at pinned rev into `plugin-checkout/` → `npm ci` → typecheck → regen-diff → wire-parity (`PLUGIN_REPO_PATH=plugin-checkout`) → `npm test`; matches the plan verbatim.
- Plugin repo source untouched — `git status` shows no modified/staged plugin source files; the plugin is at the pinned rev.

#### Deviations from Plan:

- None that require action. Minor, non-blocking extras: `.gitignore` and `package-lock.json` (both standard/necessary for a Node repo); `vitest.config.ts` (now redundant given the separate-repo root but harmless — explicit include + node environment). The earlier subdirectory-placement deviation is **resolved** (the backend is now a separate sibling repo, as the plan intended).

#### Pattern Conformance:

- ✓ Both gate scripts (`check-wire-parity.mjs`, `check-regen-diff.mjs`) faithfully reuse the plugin's `scripts/check-consistency.mjs` skeleton (`errors`/`fail()`/`info()`/`═══` banner/`process.exit(1)`). `lib/probe-descriptor.mjs` is correctly a pure helper that `throw`s (the gate scripts catch and route to `fail()`) — correct layering.
- ✓ `buildSeedReleases` manifest shape matches the plugin's `makeBundle` reference (`src/__tests__/library/library-installer.test.ts:76-86`): `catalogEntryId === packageId`, `protocolSha256` canonical, `snippetFiles`/`snippetContents` shapes align. It adds optional `author:{displayName}` (accepted by the open `isPackageManifest` guard — proven by the passing parity gate) and millisecond-precision `publishedAt` (the guard checks `typeof === 'string'` only) — acceptable variations, not wire-breaking.

#### Potential Issues:

None — every automated gate passes in the current state and the previously-failing plugin lint is restored to green. (A latent cross-platform line-ending consideration is noted under Recommendations; it does not affect the current verified state.)

### Manual Testing Required

The plan's deploy-time and in-Obsidian manual criteria cannot be exercised without a live Cloudflare deploy + Obsidian; they remain unchecked here:

1. Deploy-time (requires `site/` live on Cloudflare Pages):
   - [ ] `curl -sI https://<origin>/packages/%D0%9A.../releases/1.0.0` → 200 + JSON content-type (Cyrillic `_redirects` percent-encoding resolution)
   - [ ] `curl -sI https://<origin>/packages/unknown/releases/9.9.9` → 404 (FR3 not-found; relies on `site/404.html`)
   - [ ] `curl -sI http://<origin>/catalog` redirected/rejected to https; `normalizeRegistryUrl('https://<origin>')` accepts it (FR15)
   - [ ] p95 latency ≤ 2s via a 100-request load test (FR14)
2. In-Obsidian (requires the shipped, untouched plugin + a configured `libraryRegistryUrl`):
   - [ ] A release downloaded through the plugin installs atomically (no missing-snippet validation error) — Phase-1 installer AC
   - [ ] With `libraryRegistryUrl` set to the origin, `LibraryView` lists the seeded catalog anonymously (no auth prompt) — Phase-1 LibraryView AC
3. Repo hygiene:
   - [x] The plugin's `npm run check` stays green — **restored to exit 0** after the placement fix
   - [x] `grep -r "libraryRegistryUrl\|DEFAULT_REGISTRY_URL" src/` in the plugin returns only existing client code (verified — plugin source untouched)

### Recommendations:

- **(Non-blocking, cross-platform hardening)** Add a `.gitattributes` to the backend repo pinning LF line endings (e.g. `* text=auto eol=lf`, or specifically `*.json eol=lf` / `*.ts eol=lf` / `*.mjs eol=lf`). The `git commit` emitted `LF will be replaced by CRLF` warnings, meaning a fresh Windows clone with `core.autocrlf=true` would check out `site/**/*.json` with CRLF — and the regen-diff gate's raw-`Buffer.equals` byte comparison would then fail (working-tree CRLF vs generated LF). The current working tree is LF (gates pass); CI runs on `ubuntu-latest` (autocrlf off, unaffected). A `.gitattributes` makes the commit-and-gate strategy robust for Windows contributors. Not required for the current verdict.
- Ready to commit — the backend repo is already initialized and committed (`92ee719`); the plugin repo is untouched and green. Deploy-time and in-Obsidian manual criteria remain to be exercised once the site is live.