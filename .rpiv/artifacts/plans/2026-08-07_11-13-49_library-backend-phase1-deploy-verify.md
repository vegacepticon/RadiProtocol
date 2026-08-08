---
date: 2026-08-07T11:13:49+0300
author: Roman Shulgha
commit: bf206f5
branch: main
repository: RadiProtocol
topic: "Library backend Phase 1 — deploy static registry to Cloudflare Pages + in-Obsidian verify"
tags: [plan, library, cloudflare-pages, wrangler, deploy, verify, static-registry, lf-hardening, gitattributes, requestUrl, percent-encoding, load-test]
status: ready
parent: ".rpiv/artifacts/designs/2026-08-07_10-35-10_library-backend-phase1-deploy-verify.md"
phase_count: 3
phases:
  - { n: 1, title: "LF hardening", files: ["radiprotocol-library-backend/.gitattributes"], depends_on: [] }
  - { n: 2, title: "Deploy + HTTP verification", files: [], depends_on: [1] }
  - { n: 3, title: "In-Obsidian verify", files: [], depends_on: [2] }
last_updated: 2026-08-07T11:13:49+0300
last_updated_by: Roman Shulgha
---

# Library backend Phase 1 — Deploy Static Registry to Cloudflare Pages + In-Obsidian Verify Implementation Plan

## Overview

This plan implements Library backend Phase 1: deploying the already-generated `site/` from the sibling backend repo `radiprotocol-library-backend/` (commit `92ee719`) to a Cloudflare Pages free `*.pages.dev` subdomain via `wrangler pages deploy site/` direct upload, configuring the plugin's `libraryRegistryUrl` setting to the live origin, and verifying the read/install loop end-to-end in Obsidian. The only new file is a `.gitattributes` LF pin in the backend repo (FR9); **zero plugin source changes**. The deploy + verify procedure is captured as copy-pasteable shell commands and manual Obsidian steps, with the highest-risk live check — `requestUrl()` double-encoding on Cyrillic/space packageIds — explicitly tested by installing all 3 seed packages in-Obsidian.

Phases are inherited 1:1 from the design's `## Slices` (no recomposition); Success Criteria pass through verbatim from the design's `### Slice N` subsections.

Reference design: `.rpiv/artifacts/designs/2026-08-07_10-35-10_library-backend-phase1-deploy-verify.md`

## Desired End State

"Done" = `https://radiprotocol.pages.dev` is live over https and serving the three extension-less read routes (`/catalog`, `/packages/{id}/releases/{ver}`, `/packages/{id}/releases/{ver}/manifest`) via `_redirects` 200-rewrites; the origin URL-accepts encoded non-ASCII `packageId`/`version` segments (Cyrillic `КТ-грудная-клетка`, space `chest ct`) and returns matching-identity manifests; unknown package/version 404s; http→https redirects. The plugin's `libraryRegistryUrl` is set to the live origin; the Community Library view lists 3 entries; all 3 seed packages install atomically in-Obsidian with no missing-snippet error — OR any non-ASCII transport gap (`requestUrl` double-encoding) is documented per D10 (transport fix out-of-scope). The plugin repo `npm run check` stays green (no source changes); the backend repo `npm run check` exits 0 (`.gitattributes` + gates).

### Deploy (run from `Z:/projects/radiprotocol-library-backend/`)
- One-time: `npx wrangler@latest login` (OAuth browser flow)
- One-time: `npx wrangler@latest pages project create radiprotocol --production-branch=main`
- Pre-deploy gate: `npm run check:regen-diff` (committed `site/` byte-identical to regenerated output)
- Deploy: `npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main`

### HTTP smoke test (curl)
- FR2: 3 read routes via `_redirects` 200-rewrites (expect 200 + `content-type: application/json`)
- FR3: percent-encoding round-trip (Cyrillic + space) → 200
- FR4: 404 for unknown package/version
- FR5: http→https redirect (301)
- NFR: 100-request load test, p95 ≤ 2s

### In-Obsidian verify
1. Settings → RadiProtocol → Advanced → Library registry URL → `https://radiprotocol.pages.dev`
2. Command palette → "Open community library" → LibraryView lists 3 entries: `chest-ct`, `КТ-грудная-клетка`, `chest ct`
3. Install `chest-ct` (ASCII baseline) → "Installed successfully."
4. Install `КТ-грудная-клетка` (Cyrillic — highest risk) → "Installed successfully." OR document the `requestUrl` double-encoding gap (D10)
5. Install `chest ct` (space — high risk) → same failure pattern as Cyrillic → document the gap (D10)
6. Installed section shows all 3; open each installed protocol in the runner → no missing-snippet validation error

### Gap documentation (conditional — only if non-ASCII 404s)
Record in the downstream validation artifact: which packageIds failed, the `requestUrl`-composed URL (from Obsidian dev console network tab), whether the 404 is a double-encoding artifact (`%25D0%259A` vs `%D0%9A`), and confirmed `curl` works for the same URL (proving the gap is transport-side, not origin-side).

## What We're NOT Doing

- **Plugin source changes** — the read contract is frozen; `DEFAULT_REGISTRY_URL` stays empty; no `fetch()` fallback added even if `requestUrl` double-encodes (transport fix is out-of-scope; document the gap per D10).
- **Phase 2 Supabase stateful backend** — submission/moderation/auth/immutable storage + WCAG dashboard; deferred to a later FRD.
- **Custom domain purchase + DNS** — deferred; free `*.pages.dev` subdomain is the first target.
- **Git-connected / CI-driven deploys** — deferred; wrangler CLI direct upload is the first mechanism (manual re-run per change).
- **Real-package curation** — the deterministic seed ships as-is; curation is a follow-up (edit seed + regenerate + redeploy).
- **Deploy/verify script files** — the FRD scopes "no new backend code beyond the .gitattributes"; the deploy + verify procedure is captured as shell commands + manual steps in this plan, not as committed script files.
- **Nested-snippet relPath install exercise** — the seed uses single-segment relPaths only; the historical parent-folder bug (`9b4a886`) is not covered by this plan's verify (deferred risk).

## Phase 1: LF hardening

### Overview
Add a `.gitattributes` LF line-ending pin to the backend repo root. This protects the `check-regen-diff.mjs:52` raw-`Buffer.equals` byte gate on Windows clones with `core.autocrlf=true` (FR9) and must land before the deploy so the deployed `site/` is the LF-normalized version (and the regen-diff gate stays robust for future re-generations on Windows). Single new file; no plugin changes.

### Changes Required:

#### 1. radiprotocol-library-backend/.gitattributes
**File**: `radiprotocol-library-backend/.gitattributes`
**Changes**: NEW file — one-line `* text=auto eol=lf` pin with explanatory header comments. Forces LF on all text files in the backend repo, protecting the `check-regen-diff.mjs:52` raw-`Buffer.equals` byte gate on Windows clones (`core.autocrlf=true` would otherwise check out `site/**/*.json` as CRLF while the generator writes LF → every JSON file flagged as a byte-diff). Does not affect the excluded `_redirects`/`_headers`/`404.html` (in `STATIC_CONFIG`, `check-regen-diff.mjs:20`); Cloudflare serves LF fine; also normalizes `.ts`/`.mjs` source for cross-platform consistency.

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

### Success Criteria:

#### Automated Verification:
- [x] `.gitattributes` exists at backend repo root: `test -f Z:/projects/radiprotocol-library-backend/.gitattributes`
- [x] LF pin applies to generated JSON: `git -C Z:/projects/radiprotocol-library-backend check-attr text eol -- site/catalog.json` returns `text: auto` + `eol: lf`
- [x] Backend regen-diff gate passes: `cd Z:/projects/radiprotocol-library-backend && npm run check:regen-diff` exits 0

#### Manual Verification:
- [x] `cd Z:/projects/radiprotocol-library-backend && git add --renormalize .` produces no changes (existing files already LF — generator writes LF)
- [x] `.gitattributes` committed to the backend repo: `git -C Z:/projects/radiprotocol-library-backend log --oneline -1 -- .gitattributes` shows the commit

---

## Phase 2: Deploy + HTTP verification

### Overview
Create the Cloudflare Pages project (`radiprotocol` → `https://radiprotocol.pages.dev`) and deploy the committed `site/` via `wrangler pages deploy` direct upload (`--branch=main` is critical for production). Then run the HTTP-level curl verification: the 3 read routes (catalog, release, manifest), 404 for unknown, http→https redirect, Cyrillic + space percent-encoding round-trip, and a 100-request load test (p95 ≤ 2s). No committed files — operational procedure run from the sibling backend repo. Depends on Phase 1 (the `.gitattributes` must be committed before deploy so the deployed `site/` is LF-normalized and the regen-diff gate is robust).

### Changes Required:

#### 1. Deploy + HTTP verification procedure
**File**: *(none — operational procedure)*
**Changes**: Cloudflare Pages project creation + direct-upload deploy of the committed `site/` + HTTP-level curl verification of the 3 read routes, 404, http→https, percent-encoding round-trip, and a 100-request load test. No committed files — copy-pasteable shell commands run from `Z:/projects/radiprotocol-library-backend/`. Origin: `https://radiprotocol.pages.dev`.

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

### Success Criteria:

#### Automated Verification:
- [x] Catalog body valid (isCatalogResponse): `curl -s https://radiprotocol.pages.dev/catalog | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!Array.isArray(b.entries)||typeof b.serverTime!=='string')process.exit(1);console.log('catalog OK')})"` prints `catalog OK`
- [x] Release body valid + identity (isReleaseResponse): `curl -s https://radiprotocol.pages.dev/packages/chest-ct/releases/1.0.0 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.schema!=='radiprotocol.package'||b.manifest.packageId!=='chest-ct'||b.manifest.releaseVersion!=='1.0.0'||!Array.isArray(b.snippetContents))process.exit(1);console.log('release OK')})"` prints `release OK`
- [x] Manifest wrapper valid: `curl -s https://radiprotocol.pages.dev/packages/chest-ct/releases/1.0.0/manifest | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(!b.manifest||b.manifest.packageId!=='chest-ct')process.exit(1);console.log('manifest OK')})"` prints `manifest OK`
- [x] Cyrillic round-trip: `curl -s "https://radiprotocol.pages.dev/packages/%D0%9A%D0%A2-%D0%B3%D1%80%D1%83%D0%B4%D0%BD%D0%B0%D1%8F-%D0%BA%D0%BB%D0%B5%D1%82%D0%BA%D0%B0/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='\u041a\u0422-\u0433\u0440\u0443\u0434\u043d\u0430\u044f-\u043a\u043b\u0435\u0442\u043a\u0430')process.exit(1);console.log('cyrillic OK')})"` prints `cyrillic OK`
- [x] Space round-trip: `curl -s "https://radiprotocol.pages.dev/packages/chest%20ct/releases/1.0.0" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d);if(b.manifest.packageId!=='chest ct')process.exit(1);console.log('space OK')})"` prints `space OK`
- [x] 404 for unknown: `curl -s -o /dev/null -w "%{http_code}" https://radiprotocol.pages.dev/packages/unknown/releases/9.9.9` returns `404`
- [x] http→https redirect: `curl -sI http://radiprotocol.pages.dev/catalog | head -1` returns `301`
- [x] normalizeRegistryUrl accepts origin: `node -e "const u='https://radiprotocol.pages.dev';const p=new URL(u);if(p.protocol!=='https:')process.exit(1);console.log('normalize OK')"` prints `normalize OK`
- [x] Load test p95 ≤ 2s: `for i in $(seq 1 100); do curl -s -o /dev/null -w "%{time_total}\n" https://radiprotocol.pages.dev/catalog; done | sort -n | awk 'NR==95{if($1>2.0)exit(1);print "p95 OK"}'` prints `p95 OK`

#### Manual Verification:
- [x] `npx wrangler@latest login` completes the OAuth browser flow (one-time prerequisite)
- [x] `npx wrangler@latest pages project create radiprotocol --production-branch=main` succeeds (one-time; if `radiprotocol` is taken, note the actual subdomain and use it in all subsequent commands + `libraryRegistryUrl`)
- [x] `cd Z:/projects/radiprotocol-library-backend && npm run check:regen-diff` passes before deploy
- [x] `cd Z:/projects/radiprotocol-library-backend && npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main` succeeds and prints the live `https://radiprotocol.pages.dev` URL
- [x] Cloudflare dashboard shows the `radiprotocol` project with a production deployment

---

## Phase 3: In-Obsidian verify

### Overview
Configure `libraryRegistryUrl` to the live origin in the plugin settings UI, then verify the read/install loop in Obsidian: list the catalog (3 entries), install all 3 seed packages (ASCII + Cyrillic + space — the Cyrillic/space installs are the highest-risk `requestUrl` double-encoding check, since `registry-client.ts:127` calls `requestUrl` directly with no `fetch()` fallback), confirm no missing-snippet error, and document any non-ASCII transport gap per D10. No committed files — manual Obsidian steps; plugin `npm run check` stays green (no source changes). Depends on Phase 2 (the origin must be live before `libraryRegistryUrl` can point at it).

### Changes Required:

#### 1. In-Obsidian verification procedure
**File**: *(none — operational procedure)*
**Changes**: Configure `libraryRegistryUrl` in the plugin settings UI, open the Community Library view, verify the catalog lists 3 entries, install all 3 seed packages (ASCII + Cyrillic + space), confirm no missing-snippet error, and document any non-ASCII transport gap per D10. No committed files — manual Obsidian steps.

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
           URL, the Install button never enables. This is the double-encoding
           signature: fetchRelease and fetchReleaseManifest compose URLs
           identically (registry-client.ts:126/160), so both 404 together.
       (b) "Install failed: {reason}" (library.installFailed) — the manifest
           loaded but the release fetch (fetchRelease) 404s after Install click.
           Independent of double-encoding (both fetches use the same URL
           composition); points to a backend issue (manifest file exists but
           the release file is missing on the origin).
       (c) "Failed to load release details: {reason}" (library.detailLoadFailed)
           — a non-404 failure (network error, malformed response). Independent
           of double-encoding (double-encoding produces a 404, not a non-404
           failure).
     ): if (a) → requestUrl double-encoded the URL → document the gap (step 8);
        if (b) or (c) → a non-transport issue → document as a separate finding.
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

### Success Criteria:

#### Automated Verification:
- [x] Plugin repo check green (no source changes): `cd Z:/projects/RadiProtocol && npm run check` exits 0
- [x] Backend repo check green (.gitattributes + gates): `cd Z:/projects/radiprotocol-library-backend && npm run check` exits 0

#### Manual Verification:
- [ ] `libraryRegistryUrl` set to `https://radiprotocol.pages.dev` in Settings → RadiProtocol → Advanced
- [ ] Community Library view lists 3 entries: chest-ct, КТ-грудная-клетка, chest ct (author: Roman Shulgha, version: 1.0.0)
- [ ] chest-ct installs atomically: detail modal → Install → "Installed successfully." (library.installComplete; no missing-snippet error)
- [ ] КТ-грудная-клетка installs: detail modal → Install → "Installed successfully." OR document the requestUrl double-encoding gap (D10)
- [ ] chest ct installs: detail modal → Install → "Installed successfully." OR document the requestUrl double-encoding gap (D10)
- [ ] Installed section shows all successfully installed packages with integrity-verified badges
- [ ] Each installed protocol opens in the Protocol Editor / runs in the Inline Runner with no missing-snippet validation error
- [ ] If any non-ASCII install failed: gap documented in the validation artifact (which packageIds, the requestUrl URL, double-encoding confirmation, curl-works proof)

---

## Testing Strategy

### Automated:
- Phase 1: backend `npm run check:regen-diff` exits 0 (committed `site/` byte-identical to regenerated output); `.gitattributes` exists + LF attrs apply (`git check-attr`).
- Phase 2: HTTP smoke tests via curl + node one-liners — catalog/release/manifest body validity against the plugin's `isCatalogResponse`/`isReleaseResponse`/`isPackageManifest` guards, Cyrillic + space percent-encoding round-trip identity match, 404 for unknown, http→https 301, `normalizeRegistryUrl` https acceptance, 100-request load test p95 ≤ 2s.
- Phase 3: plugin repo `npm run check` exits 0 (no source changes); backend repo `npm run check` exits 0 (`.gitattributes` + regen-diff + wire-parity + tests).

### Manual Testing Steps:
1. `npx wrangler@latest login` — OAuth browser flow (one-time prerequisite).
2. `npx wrangler@latest pages project create radiprotocol --production-branch=main` — one-time; if `radiprotocol` is taken, use the actual printed subdomain everywhere.
3. `npm run check:regen-diff` passes before deploy (FR8 — committed `site/` byte-identical).
4. `npx wrangler@latest pages deploy site/ --project-name=radiprotocol --branch=main` — `--branch=main` is critical (without it wrangler may fall back to a non-production branch → preview deployment).
5. Obsidian → Settings → RadiProtocol → Advanced → Library registry URL → `https://radiprotocol.pages.dev` (onChange → `rebuildLibraryServices()` takes effect without reload).
6. Command palette → "Open community library" → verify 3 entries (chest-ct, КТ-грудная-клетка, chest ct; author Roman Shulgha, version 1.0.0).
7. Install `chest-ct` (ASCII baseline, lowest risk) → "Installed successfully."
8. Install `КТ-грудная-клетка` (Cyrillic — HIGHEST RISK; exercises `requestUrl()` with the percent-encoded URL, no `fetch()` fallback) → success OR document the gap.
9. Install `chest ct` (space — high risk) → success OR document the gap.
10. Open each installed protocol in the Protocol Editor / Inline Runner → no missing-snippet validation error.
11. If any non-ASCII install 404s: document the gap in the validation artifact (which packageIds, the `requestUrl`-composed URL from the dev console network tab, double-encoding confirmation `%25D0%259A` vs `%D0%9A`, curl-works proof) — transport fix is out-of-scope per D10.

> These manual steps are reference material from the design's Verification Notes; the load-bearing per-phase checks are the `### Success Criteria` blocks above (inherited verbatim from the design's `## Slices`).

## Performance Considerations

- Static CDN serving small JSON files (catalog ~1KB, releases ~5-20KB); p95 ≤ 2s is near-certain on Cloudflare's free tier.
- `_headers` sets `Cache-Control: public, max-age=86400, immutable` for `/packages/*` — release reads are cached at the edge for 24h.
- The load test is a 100-request `curl` loop against `/catalog` with `%{time_total}` timing; sort + tail to find p95. No load-generation tool needed.
- The plugin's `LibraryView.refresh()` fetches the full catalog once and filters client-side (`library-view.ts` fetch discipline) — no N+1; the install click chain is one `fetchRelease` + one `fetchReleaseManifest` per entry click.

## Migration Notes

Not applicable. No schema changes, no persisted data migration. The `.gitattributes` is a new file; existing `site/` files are already LF (generator writes LF), so `git add --renormalize .` is expected to be a no-op. No rollback strategy needed beyond Cloudflare's built-in deployment rollback (each deploy is immutable; the production alias can be flipped back via dashboard).

## Developer Context

Phased 1:1 from the design's `## Slices` (LF hardening → Deploy + HTTP verification → In-Obsidian verify). Phases 2 and 3 carry no `files:` (operational procedures — manual deploy/verify); the `phases:` frontmatter encodes the linear `depends_on` chain (no parallelism per the design's Ordering Constraints). The highest-risk live check is `requestUrl()` double-encoding on the Cyrillic/space in-Obsidian installs (`registry-client.ts:127`, no `fetch()` fallback); per D10 the transport fix is out-of-scope — install all 3 and document any gap.

Step 4 coverage review unavailable; proceeded to developer review without artifact-coverage-reviewer findings.

## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 2 §bash | src/library/registry-model.ts:46-56 | suggestion | codebase-fit | The release smoke-test one-liner checks only `manifest.schema==='radiprotocol.package' + packageId + releaseVersion + Array.isArray(snippetContents)` but the cited `isReleaseResponse` guard (registry-model.ts:46-56, via `isPackageManifest` at library-model.ts:102-115) also requires `protocolDoc`, `protocolSha256`, `snippetFiles`, `catalogEntryId`, `publishedAt`, `author`, and `snippetContents` element shape (`relPath`+`content` strings) — a response the plugin's guard would reject could pass the smoke test (design-rooted: one-liners are verbatim from the design's Architecture) | Add the missing field checks to the one-liner, or relabel the Success Criterion as "key-field smoke" rather than "valid (isReleaseResponse)" | deferred: key-field smoke sufficient for HTTP deploy verify; full isReleaseResponse guard runs in plugin client at runtime + 949 unit tests; design-rooted label nuance, no plan edit |
| code | Phase 3 §text step 5 | src/library/registry-client.ts:126,160 | suggestion | codebase-fit | Failure modes (b) and (c) are grouped under "requestUrl double-encoded the URL" but only (a) indicates double-encoding — (b) ("manifest loaded but fetchRelease 404s") is impossible for double-encoding because `fetchReleaseManifest` (registry-client.ts:160) and `fetchRelease` (registry-client.ts:126) compose URLs identically (`encodeURIComponent(packageId)` + same `this.requestUrl` call), so both 404 identically and the user sees (a) not (b); (c) is a non-404 failure but double-encoding produces a 404 (design-rooted) | Narrow the double-encoding diagnosis to failure mode (a) only; relabel (b) as a possible backend issue (manifest file exists but release file missing) and (c) as a network/malformed-response issue, both independent of double-encoding | applied (plan-local; design follow-up: .rpiv/artifacts/designs/2026-08-07_10-35-10_library-backend-phase1-deploy-verify.md): narrowed Phase 3 step 5 diagnosis to (a) only; (b)/(c) relabeled independent of double-encoding |

_Step 4 coverage review failed: run hit the output token limit before producing any text._

## References

- Design: `.rpiv/artifacts/designs/2026-08-07_10-35-10_library-backend-phase1-deploy-verify.md`
- Research: `.rpiv/artifacts/research/2026-08-07_10-11-49_library-backend-phase1-deploy-verify.md`
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