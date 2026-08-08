---
date: 2026-08-07T10:35:10+0300
author: Roman Shulgha
commit: bf206f5
branch: main
repository: RadiProtocol
topic: "Library backend Phase 1 — deploy static registry to Cloudflare Pages + in-Obsidian verify"
tags: [design, library, cloudflare-pages, wrangler, deploy, verify, static-registry, lf-hardening, gitattributes, requestUrl, percent-encoding, load-test]
status: ready
parent: ".rpiv/artifacts/research/2026-08-07_10-11-49_library-backend-phase1-deploy-verify.md"
last_updated: 2026-08-07T10:35:10+0300
last_updated_by: Roman Shulgha
---

# Design: Library Backend Phase 1 — Deploy Static Registry to Cloudflare Pages + In-Obsidian Verify

## Summary
Deploy the already-generated `site/` from the sibling backend repo `radiprotocol-library-backend/` (commit `92ee719`) to a Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` direct upload (project `radiprotocol` → `https://radiprotocol.pages.dev`), set the plugin's `libraryRegistryUrl` setting to the live origin, and verify the read/install loop end-to-end in Obsidian. The only new file is a `.gitattributes` LF pin in the backend repo (FR9); zero plugin source changes. The deploy + verify procedure is captured as copy-pasteable shell commands and manual Obsidian steps, with the highest-risk live check — `requestUrl()` double-encoding on Cyrillic/space packageIds — explicitly tested by installing all 3 seed packages in-Obsidian.

## Requirements
- **FR1**: Deploy `site/` to Cloudflare Pages; reachable at stable `https://radiprotocol.pages.dev` over https.
- **FR2**: Origin serves the three extension-less read routes via `_redirects` 200-rewrites — `GET /catalog` (CatalogResponse), `GET /packages/{id}/releases/{ver}` (ReleaseResponse), `GET /packages/{id}/releases/{ver}/manifest` ({manifest} wrapper) — each accepted by the plugin's `isCatalogResponse` / `isReleaseResponse` / `isPackageManifest` guards.
- **FR3**: Origin URL-accepts encoded non-ASCII `packageId`/`version` segments (Cyrillic `КТ-грудная-клетка`, space `chest ct`) and returns a manifest whose identity matches the decoded request.
- **FR4**: Origin returns 404 for unknown package/version (served by `site/404.html`).
- **FR5**: Origin rejects/redirects http→https; `normalizeRegistryUrl` accepts the `*.pages.dev` origin.
- **FR6**: Deployed catalog is the existing deterministic seed; releases install atomically through the foundation installer with no missing-snippet validation error.
- **FR7**: `libraryRegistryUrl` set to `https://radiprotocol.pages.dev` via settings UI; `DEFAULT_REGISTRY_URL` stays empty.
- **FR8**: Deploy via `wrangler pages deploy site/` direct upload; committed `site/` byte-identical to regenerated output (`check:regen-diff` green) before deploy.
- **FR9**: Backend repo adds `.gitattributes` pinning LF line endings (`* text=auto eol=lf`) so the regen-diff raw-`Buffer.equals` byte gate stays robust for Windows contributors.
- **NFR-Performance**: Catalog and release reads p95 ≤ 2s (100-request load test).
- **NFR-Security**: All transport https; reads anonymous; SHA-256 integrity verified client-side on install; no `libraryRegistryUrl` hard-coded in shipped plugin.
- **AC**: Plugin repo `npm run check` stays green (no source changes); backend repo `npm run check` exits 0.

## Current State Analysis

### What exists now
- **Plugin library cluster** (`src/library/`): fully built, 949 tests green, frozen read contract (3 GET routes, never-throws union). Founded in a single commit `d4eb13f` (2026-08-05); zero follow-up fixes — has NEVER run against a live origin. Every manual in-Obsidian criterion in its validation doc is unchecked.
- **Sibling backend repo** (`radiprotocol-library-backend/`, commit `92ee719`): code-complete, gate-green (regen-diff + wire-parity + 50 tests). Generated `site/` with 3 seed packages, `_redirects` (2 splat 200-rewrites), `_headers` (immutable cache), `404.html`. No `.gitattributes` exists.
- **Plugin setting** `libraryRegistryUrl` (`src/settings.ts:36`, default `''`): already wired with onChange → `rebuildLibraryServices()` (`src/main.ts:287-292`) so the override takes effect without a reload.
- **Cloudflare account + Wrangler CLI**: Wrangler v4.119.0 installed locally; Node v24, npm 11. No wrangler config file in the backend repo (direct upload doesn't need one).

### What's missing
- The `.gitattributes` LF pin (FR9) — the regen-diff raw-`Buffer.equals` byte gate (`check-regen-diff.mjs:52`) breaks on a Windows clone with `core.autocrlf=true`; no `.gitattributes` exists in either repo today.
- A live origin — `DEFAULT_REGISTRY_URL = ''` (`registry-client.ts:22`); the client returns `unavailable` until `libraryRegistryUrl` is configured.
- Live verification — the entire read/install/recovery loop is unproven against a real origin despite 949 green unit tests.

### Key Discoveries
- **`registry-client.ts:127`** — `requestUrl()` is called directly with the already-percent-encoded URL and NO `fetch()` fallback. Precedent commits `e14c5c1`→`fa3d478`→`d9c9487` proved `requestUrl` re-encodes already-encoded URLs on some platforms → double-encoding → 404 for non-ASCII paths. The Cyrillic + space in-Obsidian installs are the highest-risk live checks.
- **`check-regen-diff.mjs:52`** — raw `Buffer.equals` byte-diff; `STATIC_CONFIG` exclusion set (`:20`) skips `_redirects`/`_headers`/`404.html`. A Windows clone with `core.autocrlf=true` checks out `site/**/*.json` as CRLF while the generator writes LF → every JSON file flagged. FR9 closes this with `* text=auto eol=lf`.
- **`normalizeRegistryUrl` (`registry-client.ts:53-63`)** — trims, URL-parses, rejects non-`https:` to `''` (httpsOnly default true), strips trailing slashes. `https://radiprotocol.pages.dev` passes; `http://...` → `''`. The scheme gate is upstream of any `requestUrl` call — the plugin physically cannot emit an http request.
- **Cloudflare Pages 404 semantics (web-confirmed)** — with a `404.html` at the site root, Pages returns HTTP 404 status (not 200 + `index.html` SPA fallback) for routes matching no file or rewrite. FR4's `not-found` mapping holds.
- **Cloudflare Pages percent-encoding (web-confirmed, GitHub #5721)** — production Pages decodes a single UTF-8 percent-encode before asset lookup (`%D0%9A%D0%A2` → `КТ`). BUT the local `wrangler pages dev` server has a known bug giving false 404s for non-ASCII — must test on production, not locally. The `_redirects` splat × percent-encoding interaction is undocumented — a post-deploy `curl` is definitive.
- **`--branch=main` is critical (web-confirmed)** — without it, wrangler may fall back to a non-production branch → preview deployment at `<branch>.<project>.pages.dev` instead of production at `<project>.pages.dev`.
- **`rebuildLibraryServices` (`main.ts:284-292`)** — reconstructs client+service with fresh stores (the docstring's "preserved" is inaccurate vs code, but behaviorally safe — state lives on disk in `.radiprotocol/library/`).

## Scope

### Building
- `radiprotocol-library-backend/.gitattributes` — NEW, one line `* text=auto eol=lf` (FR9 LF hardening).
- Cloudflare Pages project creation (`wrangler pages project create radiprotocol --production-branch=main`) + first deploy (`wrangler pages deploy site/ --project-name=radiprotocol --branch=main`).
- HTTP-level curl verification: 3 read routes (catalog, release, manifest), 404 for unknown, http→https redirect, Cyrillic + space percent-encoding round-trip, load test (100-request p95 ≤ 2s).
- In-Obsidian verification: set `libraryRegistryUrl` to `https://radiprotocol.pages.dev`, list catalog (3 entries), install all 3 seed packages (ASCII + Cyrillic + space), verify no missing-snippet error, document gaps.

### Not Building
- **Plugin source changes** — the read contract is frozen; `DEFAULT_REGISTRY_URL` stays empty; no `fetch()` fallback added even if `requestUrl` double-encodes (transport fix is out-of-scope; document the gap).
- **Phase 2 Supabase stateful backend** — submission/moderation/auth/immutable storage + WCAG dashboard; deferred to a later FRD.
- **Custom domain purchase + DNS** — deferred; free `*.pages.dev` subdomain is the first target.
- **Git-connected / CI-driven deploys** — deferred; wrangler CLI direct upload is the first mechanism (manual re-run per change).
- **Real-package curation** — the deterministic seed ships as-is; curation is a follow-up (edit seed + regenerate + redeploy).
- **Deploy/verify script files** — the FRD scopes "no new backend code beyond the .gitattributes"; the deploy + verify procedure is captured as shell commands + manual steps in this design artifact, not as committed script files.
- **Nested-snippet relPath install exercise** — the seed uses single-segment relPaths only; the historical parent-folder bug (`9b4a886`) is not covered by this slice's verify (deferred risk).

## Decisions

### D1: Frozen read contract — keep frozen (inherited, simple)
The plugin's read contract is frozen at three GET routes (`registry-client.ts:89/121/155`); the backend serves them verbatim. No plugin source changes. Evidence: 949 tests green; `registry-client.ts` untouched.

### D2: Separate sibling repo + parity gate — keep (inherited, simple)
`radiprotocol-library-backend` @ `92ee719` stays a separate repo with duplicated wire types + `check-wire-parity.mjs` parity gate. No consolidation. Evidence: parity gate exit 0; plugin build untouched.

### D3: Backend-only publish — plugin read-only (inherited, simple)
The client is GET-only; manifest fields are server-controlled. Publishing is a net-new backend surface (Phase 2). The plugin stays read-only this delivery.

### D4: Keep auth/crypto deferrals (inherited, simple)
SHA-256 now / ed25519 deferred (`integrity.ts`); email magic link only / OAuth deferred. Matches the "just me for now" intent.

### D5: Finish Phase 1 deploy + verify (inherited, simple)
~zero new code; validates the built client against a live origin and de-risks before the big Supabase build. Phase 2 deferred.

### D6: Free `*.pages.dev` subdomain (inherited, simple)
Zero cost, no domain purchase. A custom domain can be added to the same Pages project later.

### D7: Wrangler CLI direct upload (inherited, simple)
Simplest one-shot, live in minutes, no GitHub remote/CI setup. Manual re-run per change is acceptable for "just me for now."

### D8: Ship existing seed as-is (inherited, simple)
The deterministic seed (Cyrillic + space packageIds, real SHA-256, pinned timestamps) exercises URL-encoding, identity-check, and install paths. Curation is a follow-up.

### D9: `DEFAULT_REGISTRY_URL` stays empty (inherited, simple)
Configure via `libraryRegistryUrl` setting (`settings.ts:36`); do not bake a pre-launch `*.pages.dev` URL into the shipped plugin. Evidence: `registry-client.ts:22` ("Do NOT hard-code an unprovisioned domain").

### D10: requestUrl transport fix out-of-scope (inherited, simple)
If the live in-Obsidian verify reveals `requestUrl` double-encodes against Cloudflare (404 on Cyrillic/space), adding a `fetch()`-first fallback is OUT-OF-SCOPE for this slice. Document the gap for a follow-up transport fix. The slice stays "no plugin source changes." Evidence: `registry-client.ts:127` (no fetch fallback); precedent `e14c5c1`→`fa3d478`→`d9c9487`.

### D11: `.gitattributes` with `* text=auto eol=lf` (inherited, simple)
Global, single line, forces LF on all text files. Protects `check-regen-diff.mjs:52` raw-`Buffer.equals` byte gate on Windows. Does not break excluded `_redirects`/`_headers`/`404.html` (in `STATIC_CONFIG`); Cloudflare serves LF fine; also normalizes `.ts`/`.mjs` source for cross-platform consistency. Evidence: no `.gitattributes` exists in either repo; `check-regen-diff.mjs:20` exclusion set + `:52` byte-diff.

### D12: Cloudflare Pages project name `radiprotocol` (Step 4 decision)
**Ambiguity**: The project name becomes the globally-unique `<name>.pages.dev` subdomain and the `libraryRegistryUrl` value. **Options explored**: (A) `radiprotocol-library` — descriptive, matches backend repo name; (B) `radiprotocol` — short, matches plugin name. **Decision**: `radiprotocol` → origin `https://radiprotocol.pages.dev`. **Rationale**: short, matches the plugin name, memorable. If globally taken, Cloudflare appends random chars (acceptable; re-point `libraryRegistryUrl` to the actual subdomain).

### D13: Install all 3 seed packages in-Obsidian (Step 4 decision)
**Ambiguity**: The live verify's highest risk is `requestUrl()` double-encoding (`registry-client.ts:127`, no `fetch()` fallback; precedent `e14c5c1`→`fa3d478`→`d9c9487`). This ONLY manifests on Cyrillic/space installs in-Obsidian — `curl` tests Cloudflare's decode behavior but not `requestUrl`'s encoding. **Options explored**: (A) All 3 packages (ASCII + Cyrillic + space) — comprehensively tests the risk; if non-ASCII 404s, document the gap (D10); (B) ASCII only + curl non-ASCII — lower risk but doesn't exercise `requestUrl`'s encoding on non-ASCII. **Decision**: All 3 packages. **Rationale**: the whole point of the live verify is to test the highest-risk item; `curl` alone cannot exercise `requestUrl`.

### D14: Include quick load test (Step 4 decision)
**Ambiguity**: The FRD's NFR requires p95 ≤ 2s via a 100-request load test. For a free-tier static CDN serving small JSON, this is near-certain. **Options explored**: (A) Include a ~100-request curl loop with timing — lightweight, closes the NFR acceptance criterion; (B) Defer — rely on subjective "feels fast." **Decision**: Include. **Rationale**: a curl loop is trivial to run and closes the acceptance criterion definitively.

## Architecture

### radiprotocol-library-backend/.gitattributes — NEW
LF line-ending pin for the backend repo. Protects the regen-diff raw-`Buffer.equals` byte gate on Windows clones with `core.autocrlf=true`.

```gitattributes
# Normalize all text files to LF line endings.
# Protects scripts/check-regen-diff.mjs raw-Buffer.equals byte gate on Windows
# (core.autocrlf=true would otherwise check out site/**/*.json as CRLF while
# the generator writes LF → every JSON file flagged as a byte-diff).
# Cloudflare Pages serves LF fine; the excluded _redirects/_headers/404.html
# are in STATIC_CONFIG (check-regen-diff.mjs:20) and skipped by the gate.
# Also normalizes .ts/.mjs source for cross-platform consistency.
* text=auto eol=lf
```

### Deploy + HTTP verification procedure — OPERATIONAL
Cloudflare Pages project creation + direct upload deploy + curl verification of the 3 read routes, 404, http→https, percent-encoding round-trip, and load test. No committed files — copy-pasteable shell commands run from the sibling backend repo.

```bash
# =============================================================================
# Library Backend Phase 1 — Deploy + HTTP verification
# Run from: Z:/projects/radiprotocol-library-backend/
# Origin:   https://radiprotocol.pages.dev (Cloudflare Pages free subdomain)
# =============================================================================

# --- Step 0: One-time setup ------------------------------------------------

# Authenticate wrangler (OAuth browser flow). Skip if already logged in.
npx wrangler@latest login

# Create the Pages project. The name becomes the globally-unique subdomain.
# If "radiprotocol" is taken, Cloudflare appends random chars — use the ACTUAL
# subdomain printed here in all subsequent commands + libraryRegistryUrl (D12).
npx wrangler@latest pages project create radiprotocol --production-branch=main

# --- Step 1: Pre-deploy gate (FR8) -----------------------------------------

# Committed site/ must be byte-identical to regenerated output.
npm run check:regen-diff

# --- Step 2: Deploy (FR1, FR8) ---------------------------------------------

# Direct upload (atomic; immutable). --branch=main is CRITICAL — without it
# wrangler may fall back to a non-production branch → preview deployment.
# If workspace has uncommitted changes, add --commit-dirty=true.
npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main

# --- Step 3: HTTP smoke test — 3 read routes (FR2) -------------------------

ORIGIN=https://radiprotocol.pages.dev

# Catalog: GET /catalog → _redirects 200-rewrite → /catalog.json
curl -sI $ORIGIN/catalog | grep -iE "^(HTTP|content-type)"
# Expect: HTTP/2 200 + content-type: application/json

curl -s $ORIGIN/catalog | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!Array.isArray(b.entries)||typeof b.serverTime!=='string')throw new Error('bad catalog');console.log('catalog OK: '+b.entries.length+' entries')})"

# Release: GET /packages/chest-ct/releases/1.0.0 → _redirects splat 200-rewrite
curl -s $ORIGIN/packages/chest-ct/releases/1.0.0 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.schema!=='radiprotocol.package'||b.manifest.packageId!=='chest-ct'||b.manifest.releaseVersion!=='1.0.0'||!Array.isArray(b.snippetContents))throw new Error('bad release');console.log('release OK: '+b.manifest.packageId+'@'+b.manifest.releaseVersion)})"

# Manifest: GET /packages/chest-ct/releases/1.0.0/manifest → {manifest} wrapper
curl -s $ORIGIN/packages/chest-ct/releases/1.0.0/manifest | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!b.manifest||b.manifest.packageId!=='chest-ct')throw new Error('bad manifest wrapper');console.log('manifest OK: '+b.manifest.packageId+'@'+b.manifest.releaseVersion)})"

# --- Step 4: Percent-encoding round-trip (FR3 — highest-risk HTTP check) ---

# Cyrillic КТ-грудная-клетка → encodeURIComponent → %D0%9A%D0%A2-%D0%B3%D1%80%D1%83%D0%B4%D0%BD%D0%B0%D1%8F-%D0%BA%D0%BB%D0%B5%D1%82%D0%BA%D0%B0
# Production Pages decodes a single percent-encode before asset lookup (GitHub #5721).
# WARNING: do NOT test with `wrangler pages dev` locally — known non-ASCII bug.
curl -s "$ORIGIN/packages/%D0%9A%D0%A2-%D0%B3%D1%80%D1%83%D0%B4%D0%BD%D0%B0%D1%8F-%D0%BA%D0%BB%D0%B5%D1%82%D0%BA%D0%B0/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='\u041a\u0422-\u0433\u0440\u0443\u0434\u043d\u0430\u044f-\u043a\u043b\u0435\u0442\u043a\u0430')throw new Error('cyrillic mismatch: '+b.manifest.packageId);console.log('cyrillic OK: '+b.manifest.packageId)})"

# Space "chest ct" → encodeURIComponent → chest%20ct
curl -s "$ORIGIN/packages/chest%20ct/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='chest ct')throw new Error('space mismatch: '+b.manifest.packageId);console.log('space OK: '+b.manifest.packageId)})"

# --- Step 5: 404 for unknown (FR4 — site/404.html) ------------------------

curl -s -o /dev/null -w "%{http_code}\n" $ORIGIN/packages/unknown/releases/9.9.9
# Expect: 404

# --- Step 6: http→https redirect (FR5) -------------------------------------

curl -sI http://radiprotocol.pages.dev/catalog | grep -iE "^(HTTP|location)"
# Expect: HTTP/2 301 + location: https://radiprotocol.pages.dev/catalog

# normalizeRegistryUrl (registry-client.ts:53-63) accepts the https origin:
node -e "const u='https://radiprotocol.pages.dev';const p=new URL(u);if(p.protocol!=='https:')throw new Error('not https');if(u.endsWith('/'))throw new Error('trailing slash');console.log('normalizeRegistryUrl OK: '+u)"

# --- Step 7: Load test (NFR — p95 ≤ 2s, 100 requests) ---------------------

for i in $(seq 1 100); do curl -s -o /dev/null -w "%{time_total}\n" $ORIGIN/catalog; done | sort -n | awk 'NR==95{printf "p95: %.3fs\n",$1; if($1>2.0)exit(1)}'
# Expect: p95 ≤ 2.0s
```

### In-Obsidian verification procedure — OPERATIONAL
Configure `libraryRegistryUrl` in the plugin settings UI, list the catalog, install all 3 seed packages (ASCII + Cyrillic + space), verify no missing-snippet error, and document any gaps. No committed files — manual Obsidian steps.

```text
1. Configure the registry URL:
   - Obsidian → Settings (gear icon) → RadiProtocol → Advanced → Library registry URL
   - Enter: https://radiprotocol.pages.dev
   - The onChange handler (settings.ts:136) trims + saves + calls
     rebuildLibraryServices() (main.ts:287-292) — the new client takes effect
     immediately (no reload needed). normalizeRegistryUrl (registry-client.ts:53-63)
     accepts the https origin and strips any trailing slash.

2. Open the Community Library view:
   - Command palette (Ctrl/Cmd+P) → "Open community library"
   - LibraryView.refresh() (library-view.ts:217) calls listCatalog() →
     fetchCatalog() (registry-client.ts:89) against the live origin.

3. Verify the catalog lists 3 entries:
   - Expected: chest-ct (Chest CT Protocol), КТ-грудная-клетка, chest ct
   - Each entry shows: title, author "Roman Shulgha", latest version 1.0.0,
     updated date 2026-01-01
   - If the unavailable banner appears: check the URL is correct, check
     network, check Obsidian dev console (Ctrl+Shift+I) for requestUrl errors.

4. Install chest-ct (ASCII — baseline, lowest risk):
   - Click the chest-ct row → LibraryItemDetailModal opens
     (library-item-detail-modal.ts)
   - Wait for the manifest to load (file list + SHA-256 hashes appear;
     Install button enables — it is disabled until the manifest loads)
   - Click Install → LibraryInstallProgressModal opens
     (library-install-progress-modal.ts)
   - Wait for "Installed successfully." (library.installComplete) — the atomic
     installer: journal → snippets → protocol → marker LAST
     (library-installer.ts:97)
   - The Installed section auto-refreshes after the 120ms-debounced vault
     watcher fires on the marker write (library-view.ts scheduleRedraw)

5. Install КТ-грудная-клетка (Cyrillic — HIGHEST RISK):
   - Click the КТ-грудная-клетка row → detail modal → Install
   - This exercises requestUrl() with the Cyrillic percent-encoded URL
     (registry-client.ts:127 — NO fetch() fallback)
   - SUCCESS: "Installed successfully." (library.installComplete) — requestUrl
     does NOT double-encode; the loop works end-to-end
   - FAILURE (any of:
       (a) "Release not found." (library.detailNotFound) — MOST LIKELY;
           the manifest fetch (fetchReleaseManifest) 404s on the double-encoded
           URL, the Install button never enables
       (b) "Install failed: {reason}" (library.installFailed) — the manifest
           loaded but the release fetch (fetchRelease) 404s after Install click
       (c) "Failed to load release details: {reason}" (library.detailLoadFailed)
           — a non-404 failure (network error, malformed response)
     ): requestUrl double-encoded the URL → document the gap (step 8)
   - Check Obsidian dev console (Ctrl+Shift+I → Network tab) for the actual
     request URL. If it shows %25D0%259A (double-encoded %), that confirms
     the transport bug (precedent: e14c5c1→fa3d478→d9c9487).

6. Install chest ct (space — high risk):
   - Click the chest ct row → detail modal → Install
   - This exercises requestUrl() with the space percent-encoded URL (chest%20ct)
   - SUCCESS: "Installed successfully." (library.installComplete)
   - FAILURE: same pattern as step 5 (a/b/c) → document the gap (step 8)

7. Verify all 3 installed protocols produce no missing-snippet error:
   - For each installed protocol, open it in the Protocol Editor or run it in
     the Inline Runner
   - The installer's planInstall validates manifest↔content closure
     bidirectionally (library-installer.ts:215-223) — a successful install
     means no missing-snippet error
   - If a protocol fails to open/run with a missing-snippet error: document
     it (step 8)

8. Gap documentation (CONDITIONAL — only if any non-ASCII install 404s or a
   protocol errors):
   Record in the downstream validation artifact:
   - Which packageIds failed (Cyrillic, space, or both)
   - The requestUrl-composed URL from Obsidian dev console Network tab
   - Whether the 404 is a double-encoding artifact (%25D0%259A vs %D0%9A)
   - Confirmed curl works for the same URL (proving the origin is correct;
     the gap is transport-side, not origin-side)
   - Per D10: the transport fix (fetch()-first fallback) is out-of-scope for
     this slice; record as an open finding for a follow-up
```

## Slices

### Slice 1: LF hardening
**Files**: `radiprotocol-library-backend/.gitattributes`

#### Automated Verification:
- [ ] `.gitattributes` exists at backend repo root: `test -f Z:/projects/radiprotocol-library-backend/.gitattributes`
- [ ] LF pin applies to generated JSON: `git -C Z:/projects/radiprotocol-library-backend check-attr text eol -- site/catalog.json` returns `text: auto` + `eol: lf`
- [ ] Backend regen-diff gate passes: `cd Z:/projects/radiprotocol-library-backend && npm run check:regen-diff` exits 0

#### Manual Verification:
- [ ] `cd Z:/projects/radiprotocol-library-backend && git add --renormalize .` produces no changes (existing files already LF — generator writes LF)
- [ ] `.gitattributes` committed to the backend repo: `git -C Z:/projects/radiprotocol-library-backend log --oneline -1 -- .gitattributes` shows the commit

### Slice 2: Deploy + HTTP verification
**Files**: *(none — operational procedure)*

#### Automated Verification:
- [ ] Catalog body valid (isCatalogResponse): `curl -s https://radiprotocol.pages.dev/catalog | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!Array.isArray(b.entries)||typeof b.serverTime!=='string')process.exit(1);console.log('catalog OK')})"` prints `catalog OK`
- [ ] Release body valid + identity (isReleaseResponse): `curl -s https://radiprotocol.pages.dev/packages/chest-ct/releases/1.0.0 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.schema!=='radiprotocol.package'||b.manifest.packageId!=='chest-ct'||b.manifest.releaseVersion!=='1.0.0'||!Array.isArray(b.snippetContents))process.exit(1);console.log('release OK')})"` prints `release OK`
- [ ] Manifest wrapper valid: `curl -s https://radiprotocol.pages.dev/packages/chest-ct/releases/1.0.0/manifest | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!b.manifest||b.manifest.packageId!=='chest-ct')process.exit(1);console.log('manifest OK')})"` prints `manifest OK`
- [ ] Cyrillic round-trip: `curl -s "https://radiprotocol.pages.dev/packages/%D0%9A%D0%A2-%D0%B3%D1%80%D1%83%D0%B4%D0%BD%D0%B0%D1%8F-%D0%BA%D0%BB%D0%B5%D1%82%D0%BA%D0%B0/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='\u041a\u0422-\u0433\u0440\u0443\u0434\u043d\u0430\u044f-\u043a\u043b\u0435\u0442\u043a\u0430')process.exit(1);console.log('cyrillic OK')})"` prints `cyrillic OK`
- [ ] Space round-trip: `curl -s "https://radiprotocol.pages.dev/packages/chest%20ct/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='chest ct')process.exit(1);console.log('space OK')})"` prints `space OK`
- [ ] 404 for unknown: `curl -s -o /dev/null -w "%{http_code}" https://radiprotocol.pages.dev/packages/unknown/releases/9.9.9` returns `404`
- [ ] http→https redirect: `curl -sI http://radiprotocol.pages.dev/catalog | head -1` returns `301`
- [ ] normalizeRegistryUrl accepts origin: `node -e "const u='https://radiprotocol.pages.dev';const p=new URL(u);if(p.protocol!=='https:')process.exit(1);console.log('normalize OK')"` prints `normalize OK`
- [ ] Load test p95 ≤ 2s: `for i in $(seq 1 100); do curl -s -o /dev/null -w "%{time_total}\n" https://radiprotocol.pages.dev/catalog; done | sort -n | awk 'NR==95{if($1>2.0)exit(1);print "p95 OK"}'` prints `p95 OK`

#### Manual Verification:
- [ ] `npx wrangler@latest login` completes the OAuth browser flow (one-time prerequisite)
- [ ] `npx wrangler@latest pages project create radiprotocol --production-branch=main` succeeds (one-time; if `radiprotocol` is taken, note the actual subdomain and use it in all subsequent commands + `libraryRegistryUrl`)
- [ ] `cd Z:/projects/radiprotocol-library-backend && npm run check:regen-diff` passes before deploy
- [ ] `cd Z:/projects/radiprotocol-library-backend && npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main` succeeds and prints the live `https://radiprotocol.pages.dev` URL
- [ ] Cloudflare dashboard shows the `radiprotocol` project with a production deployment

### Slice 3: In-Obsidian verify
**Files**: *(none — operational procedure)*

#### Automated Verification:
- [ ] Plugin repo check green (no source changes): `cd Z:/projects/RadiProtocol && npm run check` exits 0
- [ ] Backend repo check green (.gitattributes + gates): `cd Z:/projects/radiprotocol-library-backend && npm run check` exits 0

#### Manual Verification:
- [ ] `libraryRegistryUrl` set to `https://radiprotocol.pages.dev` in Settings → RadiProtocol → Advanced
- [ ] Community Library view lists 3 entries: chest-ct, КТ-грудная-клетка, chest ct (author: Roman Shulgha, version: 1.0.0)
- [ ] chest-ct installs atomically: detail modal → Install → "Installed successfully." (library.installComplete; no missing-snippet error)
- [ ] КТ-грудная-клетка installs: detail modal → Install → "Installed successfully." OR document the requestUrl double-encoding gap (D10)
- [ ] chest ct installs: detail modal → Install → "Installed successfully." OR document the requestUrl double-encoding gap (D10)
- [ ] Installed section shows all successfully installed packages with integrity-verified badges
- [ ] Each installed protocol opens in the Protocol Editor / runs in the Inline Runner with no missing-snippet validation error
- [ ] If any non-ASCII install failed: gap documented in the validation artifact (which packageIds, the requestUrl URL, double-encoding confirmation, curl-works proof)

## Desired End State

### Deploy (run from `Z:/projects/radiprotocol-library-backend/`)
```bash
# One-time: authenticate wrangler (OAuth browser flow)
npx wrangler@latest login

# One-time: create the Pages project (subdomain = radiprotocol.pages.dev)
npx wrangler@latest pages project create radiprotocol --production-branch=main

# Pre-deploy gate: committed site/ is byte-identical to regenerated output
npm run check:regen-diff

# Deploy (atomic; --branch=main → production at radiprotocol.pages.dev)
npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main
```

### HTTP smoke test (curl)
```bash
ORIGIN=https://radiprotocol.pages.dev

# FR2: 3 read routes via _redirects 200-rewrites
curl -sI $ORIGIN/catalog                                    # expect 200 + content-type: application/json
curl -s $ORIGIN/catalog | node -e "process.stdin.on('data',d=>{const b=JSON.parse(d);console.log('entries:',b.entries.length,'serverTime:',b.serverTime)})"
curl -sI $ORIGIN/packages/chest-ct/releases/1.0.0           # expect 200
curl -sI $ORIGIN/packages/chest-ct/releases/1.0.0/manifest  # expect 200

# FR3: percent-encoding round-trip (Cyrillic + space)
curl -sI "$ORIGIN/packages/%D0%9A%D0%A2-%D0%B3%D1%80%D1%83%D0%B4%D0%BD%D0%B0%D1%8F-%D0%BA%D0%BB%D0%B5%D1%82%D0%BA%D0%B0/releases/1.0.0"  # expect 200
curl -sI "$ORIGIN/packages/chest%20ct/releases/1.0.0"       # expect 200

# FR4: 404 for unknown
curl -sI $ORIGIN/packages/unknown/releases/9.9.9            # expect 404

# FR5: http→https redirect
curl -sI http://radiprotocol.pages.dev/catalog               # expect 301 → https

# NFR: load test (100 requests, p95 ≤ 2s)
for i in $(seq 1 100); do curl -s -o /dev/null -w "%{time_total}\n" $ORIGIN/catalog; done | sort -n | tail -5
```

### In-Obsidian verify
1. Obsidian → Settings → RadiProtocol → Advanced → Library registry URL → enter `https://radiprotocol.pages.dev`
2. Command palette → "Open community library" → LibraryView lists 3 entries: `chest-ct`, `КТ-грудная-клетка`, `chest ct` (author: Roman Shulgha)
3. Click `chest-ct` → detail modal shows manifest + SHA-256 hashes → click Install → progress modal → "Installed successfully." (library.installComplete)
4. Click `КТ-грудная-клетка` → Install → **highest risk**: if `requestUrl` double-encodes, the detail modal shows "Release not found." (library.detailNotFound) → document the gap (D10)
5. Click `chest ct` → Install → space-encoding risk → same failure pattern as Cyrillic → document the gap (D10)
6. Installed section shows all 3; open each installed protocol in the runner → no missing-snippet validation error

### Gap documentation (conditional — only if non-ASCII 404s)
If the in-Obsidian install 404s on Cyrillic/space (D10), record in the downstream validation artifact:
- Which packageIds failed (Cyrillic, space, or both)
- The `requestUrl`-composed URL (from Obsidian dev console network tab)
- Whether the 404 is a double-encoding artifact (`%25D0%259A` vs `%D0%9A`)
- Confirmed `curl` works for the same URL (proving the origin is correct; the gap is transport-side)

## File Map
```
radiprotocol-library-backend/.gitattributes  # NEW — LF line-ending pin (FR9); protects regen-diff byte gate on Windows
```

## Ordering Constraints
- **Slice 1 before Slice 2**: the `.gitattributes` must be committed before deploy so the deployed `site/` is the LF-normalized version (and the regen-diff gate is robust for future re-generations on Windows).
- **Slice 2 before Slice 3**: the origin must be live before the in-Obsidian verify can point `libraryRegistryUrl` at it.
- **`check:regen-diff` before deploy**: the committed `site/` must be byte-identical to regenerated output (FR8).
- **All 3 in-Obsidian installs are sequential** (the installer's `installMutex` serializes them anyway — `library-installer.ts:43-44`); but each is an independent verify target.
- **No parallelism**: each slice builds on the previous; this is a linear deploy-then-verify flow.

## Verification Notes
- **HIGHEST RISK — `requestUrl` double-encoding**: `registry-client.ts:127` calls `requestUrl` directly with the already-percent-encoded URL and NO `fetch()` fallback. Precedent `e14c5c1`→`fa3d478`→`d9c9487` proved `requestUrl` re-encodes on some platforms → `%D0%9A` becomes `%25D0%259A` → Cloudflare decodes to literal `%D0%9A` → 404. The Cyrillic + space in-Obsidian installs are the definitive test. **If 404**: document the gap (D10); transport fix is out-of-scope. **Verify**: install `КТ-грудная-клетка` + `chest ct` in Obsidian; check Obsidian dev console network tab for the actual request URL.
- **Cloudflare percent-encoding decode — empirically confirmed, not documented**: production Pages decodes a single UTF-8 percent-encode before asset lookup (GitHub #5721 deployed reproduction). The `_redirects` splat × percent-encoding interaction is undocumented. **Verify**: `curl -sI "$ORIGIN/packages/%D0%9A%D0%A2-.../releases/1.0.0"` → expect 200 + JSON content-type.
- **Local `wrangler pages dev` gives false 404s for non-ASCII**: known bug (GitHub #5721, still open). Do NOT trust local dev for non-ASCII path testing — test against the production `*.pages.dev` deployment only.
- **`--branch=main` is critical**: without it, wrangler may fall back to a non-production branch → preview deployment at `<branch>.<project>.pages.dev` instead of production. Always pass `--branch=main` explicitly.
- **Entire library cluster never run against a live origin**: founded in `d4eb13f`, zero follow-up fixes, every manual in-Obsidian criterion unchecked. Treat install/recovery as unproven despite 949 green tests.
- **Gates referenced by `package.json` are load-bearing**: both the plugin `npm run check` and the backend `check:regen-diff`/`check:wire-parity` are acceptance criteria; do not "clean up" any gate script.
- **Backend must stay in the separate sibling repo**: subdirectory placement broke the plugin's eslint → `npm run check` red (the only FAIL verdict in Phase-1 validation history).
- **`_redirects` direct-request gotcha**: a direct request to `/packages/foo.json` (with `.json` extension) also matches `/packages/*` and rewrites to `/packages/foo.json.json` → 404. All plugin URLs use the extension-less form (`registry-client.ts:126`), so this is not a risk — but do not test with `.json` suffixes.
- **`/404` literal-path quirk**: requesting `/404` or `/404.html` directly returns 200 (the file exists as a servable asset). This only affects someone typing `/404` into a browser — not normal not-found routes.

## Performance Considerations
- Static CDN serving small JSON files (catalog ~1KB, releases ~5-20KB); p95 ≤ 2s is near-certain on Cloudflare's free tier.
- `_headers` sets `Cache-Control: public, max-age=86400, immutable` for `/packages/*` — release reads are cached at the edge for 24h.
- The load test is a 100-request `curl` loop against `/catalog` with `%{time_total}` timing; sort + tail to find p95. No load-generation tool needed.
- The plugin's `LibraryView.refresh()` fetches the full catalog once and filters client-side (`library-view.ts` fetch discipline) — no N+1; the install click chain is one `fetchRelease` + one `fetchReleaseManifest` per entry click.

## Migration Notes
Not applicable. No schema changes, no persisted data migration. The `.gitattributes` is a new file; existing `site/` files are already LF (generator writes LF), so `git add --renormalize .` is expected to be a no-op. No rollback strategy needed beyond Cloudflare's built-in deployment rollback (each deploy is immutable; the production alias can be flipped back via dashboard).

## Pattern References
- **No existing `.gitattributes` pattern** in either repo — this is a novel file. The `* text=auto eol=lf` form is standard git practice (git docs: "Attributes that affect all files: `* text=auto eol=lf`").
- **Deploy procedure** modeled after the Cloudflare Pages Direct Upload guide (https://developers.cloudflare.com/pages/get-started/direct-upload/) — `wrangler pages project create` then `wrangler pages deploy <dir>`.
- **curl verification pattern**: standard HTTP smoke testing (status code + content-type + body structure). The percent-encoding test URLs use `encodeURIComponent` output (verified: `node -e "console.log(encodeURIComponent('КТ-грудная-клетка'))"`).
- **In-Obsidian verify pattern**: follows the unchecked manual criteria from `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` (catalog listing, atomic install, no missing-snippet error).

## Developer Context

**Q (Step 4 — Install verify scope):** `registry-client.ts:127` calls `requestUrl` directly with the already-percent-encoded URL and NO `fetch()` fallback; precedent `e14c5c1`→`fa3d478`→`d9c9487` proved requestUrl re-encodes on some platforms → 404. This ONLY manifests on Cyrillic/space installs in-Obsidian — curl tests Cloudflare's decode behavior but NOT requestUrl's encoding. The seed has 3 packages (chest-ct ASCII, КТ-грудная-клетка Cyrillic, chest ct space). How many should the in-Obsidian install verify cover?
**A:** All 3 packages — comprehensively tests the requestUrl double-encoding risk; if non-ASCII 404s, document the gap (out-of-scope transport fix per D10).

**Q (Step 4 — Subdomain):** What project name for the Cloudflare Pages project? This becomes the live `<name>.pages.dev` subdomain (globally unique) and the `libraryRegistryUrl` value (`settings.ts:36`).
**A:** `radiprotocol` → origin `https://radiprotocol.pages.dev`.

**Q (Step 4 — Load test):** The FRD's NFR requires p95 ≤ 2s via a 100-request load test. Include or defer?
**A:** Include quick load test — a ~100-request curl loop with timing against /catalog; lightweight, closes the NFR acceptance criterion.

**Inherited research Q/As (recorded as Decisions D1-D11, not re-asked):**
- Frozen read contract → keep frozen (D1)
- Separate sibling repo + parity gate → keep (D2)
- Backend-only publish → plugin read-only (D3)
- Auth/crypto deferrals → keep (D4)
- Sequencing → finish Phase 1 deploy + verify (D5)
- Hosting → free `*.pages.dev` subdomain (D6)
- Deploy mechanism → wrangler CLI direct upload (D7)
- Seed content → ship existing seed as-is (D8)
- `DEFAULT_REGISTRY_URL` → stays empty (D9)
- requestUrl transport fix → out-of-scope; document gap (D10)
- `.gitattributes` → `* text=auto eol=lf` (D11)

## Design History
- Slice 1: LF hardening — approved as generated
- Slice 2: Deploy + HTTP verification — approved as generated
- Slice 3: In-Obsidian verify — approved as generated

## References
- Research artifact: `.rpiv/artifacts/research/2026-08-07_10-11-49_library-backend-phase1-deploy-verify.md`
- FRD (discover): `.rpiv/artifacts/discover/2026-08-07_09-59-04_library-backend-phase1-deploy-verify.md`
- Phase-1 validation (most recent, PASS): `.rpiv/artifacts/validation/2026-08-07_09-09-57_community-library-backend-phase-1-static-registry-on-cloudflare-pages.md`
- Foundation validation (PASS, manual criteria unchecked): `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`
- Phase-1 design: `.rpiv/artifacts/designs/2026-08-06_08-53-19_community-library-backend-phase1.md`
- Phase-1 plan: `.rpiv/artifacts/plans/2026-08-07_08-01-24_community-library-backend-phase1.md`
- Backend repo: `Z:/projects/radiprotocol-library-backend/` (commit `92ee719`)
- Cloudflare Pages Direct Upload guide: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Wrangler pages command reference: https://developers.cloudflare.com/workers/wrangler/commands/pages/
- Cloudflare Pages `_redirects` reference: https://developers.cloudflare.com/pages/configuration/redirects/
- Cloudflare Pages serving/404 behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
- GitHub #5721 — percent-encoded path decoding (production works, local dev broken): https://github.com/cloudflare/workers-sdk/issues/5721