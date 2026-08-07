---
template_version: 1
date: 2026-08-07T08:49:12+0300
author: Roman Shulgha
commit: 4c680bd
branch: main
repository: RadiProtocol
topic: "Validation of Community Library backend — Phase 1 (static registry on Cloudflare Pages)"
status: ready
verdict: fail
parent: ".rpiv/artifacts/plans/2026-08-07_08-01-24_community-library-backend-phase1.md"
tags: [validation, backend, library, registry, wire-types, seed, generator, cloudflare-pages, parity-gate, sha256, static-registry]
last_updated: 2026-08-07T08:49:12+0300
---

## Validation Report: Community Library backend — Phase 1 (static registry on Cloudflare Pages)

> **Implementation location.** The plan describes a greenfield *separate* backend repo. The implementation was placed at `RadiProtocol/backend/` — a subdirectory of the plugin repo's working tree (untracked). All file paths below are relative to `backend/` unless noted. The parity gate was run with `PLUGIN_REPO_PATH=..` (the plugin checkout at the pinned rev `4c680bdef5d9b485369bf246c09e21873cb41212`, which equals the current plugin HEAD and `plugin-pin.txt`).

### Implementation Status

- ✓ Phase 1: Repo scaffold + duplicated wire types + integrity — Fully implemented
- ✓ Phase 2: Shared seed — Fully implemented
- ✓ Phase 3: Deterministic generator + Cloudflare site config — Fully implemented
- ✓ Phase 4: Cross-repo parity gate — Fully implemented
- ✓ Phase 5: Contract tests + regen-diff + CI — Fully implemented

All 22 planned files are present (4 wire-type modules, seed, generator, 4 test suites, 3 site-config files, probe harness, 2 gate scripts, `plugin-pin.txt`, CI workflow, `package.json`/`tsconfig.json`/`esbuild.config.mjs`). Two extra files were added: `package-lock.json` (required by CI's `npm ci`) and `vitest.config.ts` (justified — see Deviations).

### Automated Verification Results

- ✓ Typecheck (backend): `npm run typecheck` — passes, no errors
- ✓ Full test suite (backend): `npm test` — 4 files, 50 tests pass (wire-types + seed + generate + contract)
- ✓ Wire-type parity gate: `PLUGIN_REPO_PATH=.. npm run check:wire-parity` — all 5 served guards (`isCatalogResponse`, `isReleaseResponse`, `isPackageManifest`, `isCatalogEntry`, `isProtocolDocumentV1`) descriptors match, exit 0
- ✓ Regen-diff gate: `npm run check:regen-diff` — `site/` byte-identical to regenerated output (7 generated files), exit 0
- ✓ Full backend check: `PLUGIN_REPO_PATH=.. npm run check` (typecheck + regen-diff + wire-parity + test) — exit 0
- ✓ Parity-gate drift detection (manual criterion exercised): flipping `PACKAGE_MANIFEST_SCHEMA` in the backend → gate exits 1 (`❌ FAILED: 2 error(s)`); revert → exit 0
- ✓ Regen-diff drift detection (manual criterion exercised): mutating committed `site/catalog.json` → gate exits 1 (`file differs from regenerated: catalog.json`); revert → exit 0
- ✗ Plugin repo lint: `npx eslint . --max-warnings 0` in the *plugin* repo (a component of the plan's "plugin's `npm run check` stays green" criterion) — **FAILS, exit 1**, 8 errors all originating from `backend/` files (see Potential Issues)
- ✓ Plugin typecheck + tests unaffected by `backend/`: plugin `tsc` exit 0 (tsconfig includes `src/**` only); plugin `npm test` exit 0 (69 files, 949 tests; vitest config includes `src/__tests__/**` only)

### Code Review Findings

#### Matches Plan:

- `src/wire-types/*.ts` — the served wire-type guards are byte-identical to the plugin's sources (verified by `diff` of each function body): `isPackageManifest`, `isCatalogEntry`, `isCatalogResponse`, `isReleaseResponse`, `isPackageSnippetFile`, `isOptionalAuthor`, `isOptionalString`, `isProtocolDocumentV1`, and the integrity helpers `toHex`/`sha256String`/`verifyIntegrity`. Sentinels (`PROTOCOL_SCHEMA`/`PROTOCOL_VERSION`, `PACKAGE_MANIFEST_SCHEMA`/`PACKAGE_MANIFEST_VERSION`) match. `createEmptyProtocolDocument` matches in values and key order (the `protocolSha256` hashed bytes).
- `src/wire-types/` has zero `obsidian` imports (Phase 1 manual criterion — `grep -r "obsidian"` returns nothing); `PackageManifest` has no `signature`/`ed25519` field (D11).
- `src/seed/seed.ts` — includes Cyrillic `КТ-грудная-клетка` + space `chest ct` packageIds; all packageIds slash-free; pinned timestamps + explicit `startNodeId` (no `Math.random` in the seed path); `catalogEntryId === packageId`; `protocolSha256` = real SHA-256 of `JSON.stringify(doc,null,2)+'\n'`; `buildSeedReleases` is deterministic (building twice → byte-identical, asserted in `seed.test.ts`).
- `src/generator/generate.ts` — emits exactly the three route artifacts: `catalog.json` (CatalogResponse), `packages/<id>/releases/<ver>.json` (ReleaseResponse), `packages/<id>/releases/<ver>/manifest.json` (the `{manifest}`-only wrapper — not bare, not full release); literal-UTF-8 file names; pinned `serverTime`; mutual-consistency + guard-validity assertions; CLI guard fires only when `argv[1]` ends with `generate.cjs` (tests import `generate()` directly without triggering it).
- `site/_redirects` — exactly the 2 splat 200-rewrite rules (`/catalog /catalog.json 200`, `/packages/* /packages/:splat.json 200`); `site/404.html` present; `site/_headers` sets `/packages/* Cache-Control: public, max-age=86400, immutable`.
- `scripts/check-wire-parity.mjs` + `scripts/lib/probe-descriptor.mjs` — probe-based (no hand-written descriptors); derives descriptors behaviorally on BOTH the plugin's compiled guards (pinned rev) and the backend's; `GUARD_NAMES` excludes client-only `isCatalogSnapshot`/`isInstalledRecord`; enriched seeds include optional declared fields (`CatalogEntry.summary`, `ProtocolDocumentV1` `selfCheckEnabled`/`selfCheckItems`/`viewport`) so the harness probes them; plugin repo is read-only (git rev-parse + file reads; esbuild writes to temp dirs cleaned in `finally`).
- `scripts/check-regen-diff.mjs` — bundles the generator into a separate temp dir, raw-`Buffer.equals` byte diff, excludes hand-written static config (`_redirects`/`_headers`/`404.html`).
- `.github/workflows/ci.yml` — checkout self → read pin → checkout plugin at pinned rev into `plugin-checkout/` → `npm ci` → typecheck → regen-diff → wire-parity (`PLUGIN_REPO_PATH=plugin-checkout`) → `npm test`; matches the plan verbatim.
- Plugin repo source untouched — `git status` shows no modified/staged plugin source files (only untracked `backend/` + `.rpiv/artifacts/...`); `grep -r "libraryRegistryUrl\|DEFAULT_REGISTRY_URL" src/` returns only existing client code.

#### Deviations from Plan:

- **Subdirectory layout instead of a separate repo.** The plan describes a greenfield *separate* backend repo ("A developer clones the backend repo…") and the parity gate's default `PLUGIN_REPO_PATH ?? '../RadiProtocol'` assumes a sibling-repo layout (backend at `../<name>`, plugin at `../RadiProtocol`). The implementation placed the backend at `RadiProtocol/backend/`. Consequences: (a) local parity-gate runs require `PLUGIN_REPO_PATH=..` instead of the default (CI sets `plugin-checkout`, so CI is unaffected); (b) an extra `backend/vitest.config.ts` was added (justified + documented) to prevent the plugin's vitest config — which includes only `src/__tests__/**/*.test.ts` — from shadowing the backend's test discovery. This deviation is the root cause of the Potential Issue below.
- `createEmptyProtocolDocument` omits the plugin's inline comment `// Matches NODE_KIND_DEFAULTS['start'].color in protocol-editor-view.ts.` — comment-only; values and key order (the `protocolSha256` hashed bytes) are identical, so wire parity and determinism are preserved. Acceptable variation, not a deviation that matters.

#### Pattern Conformance:

- ✓ Both gate scripts (`check-wire-parity.mjs`, `check-regen-diff.mjs`) faithfully reuse the plugin's `scripts/check-consistency.mjs` skeleton (`const errors = []` → `fail()` pushes `❌ …` → `info()` logs `OK: …` → `═══` banner → `process.exit(1)` on errors / `✅` on success). `lib/probe-descriptor.mjs` is correctly a pure helper that `throw`s on bad input (the gate scripts catch and route to `fail()`) — the right layering, a library should not own `process.exit`.
- ✓ `buildSeedReleases` manifest shape matches the plugin's `makeBundle` reference (`src/__tests__/library/library-installer.test.ts:76-86`): `catalogEntryId === packageId`, `protocolSha256` canonical form, `snippetFiles`/`snippetContents` shapes all align. It adds optional `author:{displayName}` (accepted by the open `isPackageManifest` guard — proven by the passing parity gate) and millisecond-precision `publishedAt` (the guard checks `typeof === 'string'` only) — acceptable variations, not wire-breaking deviations.

#### Potential Issues:

- **`Z:/projects/RadiProtocol` (plugin repo) — the backend's subdirectory placement breaks the plugin's `npm run lint`, a component of `npm run check`.** Running `npx eslint . --max-warnings 0` in the plugin repo exits 1 with 8 errors, all originating from `backend/` files:
  - 4× typescript-eslint project-service "Parsing error: … was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject" — `backend/scripts/check-regen-diff.mjs`, `backend/scripts/check-wire-parity.mjs`, `backend/scripts/lib/probe-descriptor.mjs`, `backend/vitest.config.ts` (not in the plugin's tsconfig, which includes `src/**` only).
  - 2× `@typescript-eslint/no-unused-vars`: `'author' is assigned a value but never used` at `backend/__tests__/wire-types.test.ts:63` and `:79` (the destructured-to-omit pattern `const { author, ...rest } = …`).
  - Confirmed attribution: moving `backend/` aside makes the plugin's `eslint .` pass (exit 0); restoring it makes it fail again (exit 1). The plugin's `tsc` and `vitest` are unaffected (they scope to `src/**` and `src/__tests__/**` respectively) — only lint breaks.

  This violates the plan's explicit criterion (Phase 5 Manual Verification + "What We're NOT Doing"): *"The plugin repo is untouched: the plugin's `npm run check` stays green."* The plugin's `npm run check` (build + lint + tests + …) therefore fails at the lint step while `backend/` sits in the plugin working tree. **Requires action.**

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
3. Repo hygiene (the second part is currently failing — see Potential Issues):
   - [ ] The plugin's `npm run check` stays green — **currently FAILING at lint** due to `backend/` files
   - [x] `grep -r "libraryRegistryUrl\|DEFAULT_REGISTRY_URL" src/` in the plugin returns only existing client code (verified — plugin source untouched)

### Recommendations:

- **(Blocking — forces `verdict: fail`)** Move `backend/` to a separate sibling repo (e.g. `Z:/projects/RadiProtocol-library-backend/`) to honor the plan's separate-repo intent, restore the plugin's `npm run lint` / `npm run check` to green, and make the parity gate's default `PLUGIN_REPO_PATH=../RadiProtocol` resolve without a local `..` override. After moving: re-run the backend `npm run check` (with `PLUGIN_REPO_PATH=../RadiProtocol`) and the plugin `npm run check` to confirm both are green, then re-run `/skill:validate` for a fresh report.
- **(Alternative, less preferred)** If the subdirectory layout must stay, add `backend/**` to the plugin's `eslint.config.mjs` `ignores` block. Note this is a plugin-repo change that partially conflicts with the plan's "plugin untouched" constraint, so the separate-repo option is preferred. Also add `backend/scripts/**` is already covered by `scripts/**/*.mjs`? — it is not (that glob is root-anchored and does not match `backend/scripts/**`), which is exactly why the parsing errors surface.
- **(Non-blocking)** The two `author` unused-vars at `backend/__tests__/wire-types.test.ts:63,79` are latent lint errors surfaced only via the plugin's eslint (the backend has no lint script). If the backend ever gains its own lint script, rename to `_author` (`const { author: _author, ...rest } = …`) or add a scoped `eslint-disable` — the destructured-to-omit intent is clear, this is cosmetic.