---
date: 2026-08-06T08:12:45+0300
author: Roman Shulgha
commit: 4c680bd
branch: main
repository: RadiProtocol
topic: "Community Library backend (Supabase + Cloudflare Pages)"
tags: [intent, frd, library, backend, supabase, cloudflare-pages, registry, moderation]
status: ready
last_updated: 2026-08-06T08:12:45+0300
last_updated_by: Roman Shulgha
parent: ".rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md"
---

# FRD: Community Library Backend (Supabase + Cloudflare Pages)

## Summary
Build the backend of the Moderated Community Library in two phases. Phase 1 ships the plugin's already-shipped three read routes (`GET /catalog`, `GET /packages/{id}/releases/{ver}`, `GET /packages/{id}/releases/{ver}/manifest`) as static JSON on Cloudflare Pages (custom domain, `_redirects` extension-less rewrites) to validate the built client end-to-end at zero infra. Phase 2 layers Supabase (Auth + Postgres + Storage + Edge Functions) for the stateful submission, moderation, email-magic-link auth, reports/takedown, and immutable storage, plus a WCAG 2.2 AA moderation dashboard SPA on Cloudflare Pages. The backend lives in a new separate repo; wire types are duplicated plugin↔backend with a cross-repo parity gate. SHA-256 integrity is in scope now; ed25519 publisher signing is deferred.

## Problem & Intent
The developer's words (original discover input, verbatim):

> "I'd like to continue working on the Library. As I understand it, we've completed the client-side part, and now we need to build the backend to make everything work. I'd like to have a fully functional version. At the moment, I don't have a spare domain, so I'm wondering whether it's possible to implement the backend using GitHub Pages. If having a domain would make things easier, I'll arrange a new domain specifically for this project."

Stated intent (Step 2, verbatim): **"Just me for now"** — solo operation today; the audience comes later. Success = a working, deployable version the developer controls end-to-end before opening it to contributors. The client-side foundation (browse + atomic install) is already built and validated (949/949 tests, `npm run check` green), but it has no registry to talk to (`DEFAULT_REGISTRY_URL=''`). The remaining work is the backend that makes the library actually function, with a pragmatic hosting path that needs no new domain today and a clear upgrade path when the developer buys one.

## Goals
- Make the built plugin client functional end-to-end by standing up the registry it already knows how to talk to.
- Phase 1: serve the plugin's fixed read contract (three extension-less GET routes) as static JSON on Cloudflare Pages at zero infra cost, so the shipped `LibraryView` lists a real catalog and installs a real release with no client changes.
- Phase 2: provide the full stateful lifecycle — email-magic-link auth, author/moderator/admin roles, the 9-state submission lifecycle, automated + human publication gates, immutable Storage releases with SHA-256 manifests, reports, and revocation — backed by Supabase.
- Ship a WCAG 2.2 AA moderation dashboard SPA on Cloudflare Pages (custom domain) for moderators and administrators.
- Keep the shipped plugin client untouched: the backend must serve the exact read contract the plugin already implements.
- Preserve the source FRD's settled decisions (official catalog, CC BY 4.0, roles, 9-state lifecycle, automated+human gates, immutable releases, reports+takedown, WCAG 2.2 AA, 2s p95, quality-review-not-certification, warning-only PHI/PII).

## Non-Goals
- Reimplementing or restructuring the shipped plugin client (the foundation is done — 949 tests green; the plugin stays a pure client).
- GitHub Pages as a stateful backend (it cannot run auth/submission/moderation); rejected as a backend host. It could serve read-only static JSON, but Cloudflare Pages is chosen instead because it can do the extension-less rewrites GitHub Pages cannot.
- OAuth providers (GitHub/Google) in the first delivery — deferred until the audience grows (D4).
- Ed25519 publisher signing and plugin-side signature verification — deferred (D5); releases are integrity-hashed (SHA-256), not authenticity-signed.
- Restructuring this repo into a monorepo / npm workspaces — rejected for D6 (build-restructure risk to the shipped plugin).
- A shared npm package for wire types — rejected for D6 (plugin gains an external dependency it currently has none of).
- Automated PHI/PII detection in submitted content (inherited non-goal; a warning is the first privacy control).
- Federated, self-hosted, or user-configurable registries (inherited non-goal).
- Embedding snippet bodies inside `.rp.json` protocol documents (inherited non-goal).
- Changing the canonical root-relative snippet reference format (inherited non-goal).

## Functional Requirements
1. The backend SHALL serve the plugin's three read routes over https: `GET /catalog` (a `CatalogResponse`), `GET /packages/{id}/releases/{ver}` (a `ReleaseResponse`), and `GET /packages/{id}/releases/{ver}/manifest` (a `{ manifest: PackageManifest }` wrapper — the plugin's `fetchReleaseManifest` reads `body.manifest`, NOT a bare `PackageManifest`). Response bodies SHALL be accepted by the plugin's current `isCatalogResponse` and `isReleaseResponse` guards, and `body.manifest` SHALL pass `isPackageManifest` for the manifest-only route.
2. The static host SHALL serve the three routes at extension-less paths via Cloudflare Pages `_redirects` (200-rewrite) to `.json` files, so the plugin's `RegistryClient` — which requests the extension-less URLs — works with no client changes.
3. The backend SHALL URL-accept URL-encoded non-ASCII `packageId` and `version` path segments (precedent: `e14c5c1`) and SHALL return a manifest whose `packageId` / `releaseVersion` match the request; the plugin rejects identity mismatch (`src/library/registry-client.ts` `fetchRelease` / `fetchReleaseManifest`).
4. Phase-1 catalog and release reads SHALL be anonymous; no authentication SHALL be required for `GET /catalog`, `GET /packages/{id}/releases/{ver}`, or `.../manifest`.
5. The phase-2 backend SHALL provide email-magic-link authentication (Supabase Auth) for contributors, moderators, and administrators; browsers and downloaders SHALL NOT be required to authenticate.
6. The phase-2 backend SHALL enforce three roles — author, moderator, administrator: submission and moderation actions SHALL require the corresponding authenticated role; browsing and downloading SHALL remain anonymous.
7. The phase-2 backend SHALL support the nine submission states — draft, submitted, in review, changes requested, resubmitted, approved, published, rejected, withdrawn — with a visible, timestamped history of state transitions and reviewer feedback.
8. The phase-2 backend SHALL run automated submission gates that reject invalid protocol schemas, invalid graphs, missing dependencies, unsafe or escaping paths, unsupported file types, malformed metadata, and packages that fail SHA-256 integrity checks BEFORE human review.
9. The phase-2 backend SHALL provide a web moderation dashboard (SPA on Cloudflare Pages) with role-based queues and actions — reviewer comments, requested changes, approval, rejection, publication, and an auditable decision history.
10. Every published version SHALL be immutable; a new version of an existing item SHALL enter the same automated + human review pipeline and SHALL NOT mutate any prior published release.
11. Each published version SHALL carry a server-controlled manifest with file SHA-256 hashes, author and review provenance, and version metadata. (Ed25519 publisher signature is deferred — integrity, not authenticity; the manifest has no signature field in this delivery.)
12. Published releases SHALL be stored immutably (Supabase Storage) and SHALL be served identically on every fetch; revocation SHALL remove an item from new-download availability without breaking already-installed local copies.
13. Library users SHALL be able to report a published item; moderators SHALL triage reports; administrators SHALL be able to unpublish or revoke a release with an auditable reason. A revoked release SHALL disappear from `GET /catalog` and from the download and manifest endpoints, and the backend SHALL expose revocation metadata (revoked flag + reason) via the API for a future client to render. Surfacing revocation inside already-installed copies is a plugin-side follow-up (the foundation deferred revocation UI), not this backend delivery.
14. The backend SHALL serve catalog and release reads with p95 latency ≤ 2 seconds under normal connectivity.
15. The backend SHALL be reachable only over https; http SHALL be rejected or redirected.
16. The backend SHALL expose a contract-parity check that FAILS when the duplicated plugin and backend wire types drift (schema sentinels or required-field shape), extended from `scripts/check-consistency.mjs`.

## Non-Functional Requirements
- **Performance**: Catalog and release reads SHALL complete within 2 seconds at p95 under normal connectivity (inherited target). Any submission, moderation, or publication operation taking longer than 200 ms SHALL surface progress to the operator without blocking.
- **Security**: Email-magic-link auth for contributors, moderators, and administrators (D4); role-authorized accounts (author/moderator/admin). Published releases are immutable and carry SHA-256 file hashes (Ed25519 authenticity deferred — D5). All transport is https. Moderation actions are auditable. The submission flow warns against PHI/PII; automated PHI/PII detection is explicitly excluded (inherited).
- **UX / Accessibility**: The web moderation dashboard SHALL meet WCAG 2.2 AA — complete keyboard operation, visible focus, semantic labels, sufficient contrast, scalable text, and screen-reader announcements for status and errors. In-plugin browse and install flows are already built on the client side (foundation, 949 tests green); in-plugin submission, report, and revocation UI remain a separate client-side follow-up (the foundation plan explicitly deferred them).
- **Reliability**: Published releases are immutable and always servable. Revocation removes new-download availability but never breaks already-installed local copies (the plugin's offline-local + read-only-cache behavior is already implemented). The catalog is available anonymously without an auth dependency. Failed network actions are retryable; pinned versions do not change silently.

## Constraints & Assumptions
- One official centrally operated catalog (inherited); no federated or self-hosted registries in scope.
- The backend owns identity, catalog metadata, immutable package storage, moderation state, audit history, reports, and revocations (inherited). The plugin remains a pure Obsidian-local client and contributor; its read contract is fixed and the backend MUST serve it (P1).
- Phase 1 is static (Cloudflare Pages, zero infra); phase 2 is Supabase-managed (Auth + Postgres + Storage + Edge Functions). The full submission/moderation/reporting lifecycle remains the agreed destination — phasing is delivery order, not scope reduction.
- The custom domain is free on the static dashboard/catalog (Cloudflare Pages); a custom domain on the Supabase API needs Supabase Pro (~$25/mo) or the API stays on a free `*.supabase.co` subdomain. For "just me now": custom domain → dashboard/catalog, API on `*.supabase.co`.
- Wire types are duplicated plugin↔backend in a new separate backend repo; a cross-repo parity gate (extended `scripts/check-consistency.mjs`) catches drift (D6). The plugin build is NOT restructured.
- Protocol storage remains `ProtocolDocumentV1` `.rp.json`; snippet content remains `.md`; published community content uses CC BY 4.0 (inherited).
- Moderation assesses technical integrity, policy, presentation, and clarity — not clinical correctness certification (inherited). The radiologist remains responsible for clinical judgment.
- No automated PHI/PII detection; a prominent warning is the first privacy control (inherited).
- Assumption: the developer will purchase and configure a custom domain for the dashboard/catalog before phase-1 publication. The phase-1 static catalog can run on the default `*.pages.dev` subdomain until then.
- Assumption: the plugin's existing `libraryRegistryUrl` setting (`src/settings.ts`) is the only client configuration needed to point the built client at the backend.

## Acceptance Criteria

### Phase 1 (static registry on Cloudflare Pages)
- [ ] With `libraryRegistryUrl` (`src/settings.ts`) pointed at the Cloudflare Pages origin, opening the plugin's `LibraryView` lists the seeded catalog anonymously, with no authentication prompt.
- [ ] `GET <origin>/catalog` returns a JSON body accepted by the plugin's `isCatalogResponse` guard; `GET <origin>/packages/{id}/releases/{ver}` returns a body accepted by `isReleaseResponse` whose `manifest.packageId` / `releaseVersion` equal the request; `GET <origin>/packages/{id}/releases/{ver}/manifest` returns a `{ manifest: PackageManifest }` wrapper whose `body.manifest` passes `isPackageManifest` and whose `packageId` / `releaseVersion` match the request (the plugin's `fetchReleaseManifest` reads `body.manifest`).
- [ ] The three routes are reachable at extension-less paths via Cloudflare Pages `_redirects` (200-rewrite); `curl -sI https://<origin>/catalog` serves a JSON content type without a 404 or a redirect to a `.json` URL.
- [ ] A URL-encoded non-ASCII `packageId` / `version` (e.g. Cyrillic) round-trips: the returned manifest identity matches the decoded request and the plugin's `fetchRelease` / `fetchReleaseManifest` identity check passes.
- [ ] `http://<origin>/catalog` is rejected or redirected to `https://`; the plugin's `normalizeRegistryUrl` (https-only) accepts the configured origin.
- [ ] A release downloaded through the plugin installs atomically via the foundation installer (commits under `library/<packageId>/<version>/`) and the installed protocol produces no missing-snippet validation error.
- [ ] Under normal connectivity, catalog fetch p95 latency is ≤ 2 seconds, measured against a provisioned catalog fixture.

### Phase 2 (stateful Supabase backend + dashboard SPA)
- [ ] An email magic link signs in a contributor; a moderator and an administrator sign in the same way; an anonymous user can browse and download without sign-in.
- [ ] Submitting requires an authenticated author; moderation and admin actions require the corresponding role; anonymous attempts at those actions are refused.
- [ ] All nine submission states are reachable and recorded — draft → submitted → in review → (approved → published | rejected | changes requested → resubmitted → in review …) and withdrawn — and both author and reviewer can read the comments and the complete timestamped transition history for every transition, including rejection and withdrawal.
- [ ] A submission with an invalid schema, invalid graph, missing dependency, escaping path, unsupported file, malformed metadata, or SHA-256 mismatch is rejected by the automated gates before any human review queue.
- [ ] Publication is blocked until both automated and human review pass; publishing a new version re-enters the same pipeline and leaves the prior immutable release byte-for-byte unchanged.
- [ ] A published release is stored immutably in Supabase Storage; its server-controlled manifest carries SHA-256 file hashes, author/review provenance, and version metadata, with NO ed25519 signature field (integrity, not authenticity).
- [ ] A user can report a published item; moderators triage the report; an administrator can revoke it with an auditable reason; the revoked release disappears from `GET /catalog` and the download/manifest endpoints, and the API exposes revocation metadata (revoked flag + reason) for a future client to render.
- [ ] The moderation dashboard SPA (Cloudflare Pages) passes an automated WCAG 2.2 AA audit on the covered screens and is fully operable by keyboard + screen reader through review, approval, rejection, publication, and error-recovery flows.
- [ ] The cross-repo contract-parity check FAILS when a wire type (schema sentinel or required field) is deliberately diverged between the plugin and the backend, and PASSES when they match.
- [ ] The backend workspace's own `build` / `test` / `lint` exit 0; the plugin's `npm run check` remains green with no plugin source changes required for the backend to serve it.

## Recommended Approach
A new separate backend using Supabase (Auth + Postgres + Storage + Edge Functions) for the stateful submission/moderation/auth API, plus Cloudflare Pages (custom domain) for the phase-1 static catalog and the WCAG moderation dashboard SPA. Phase 1 ships the plugin's existing three read endpoints as static JSON on Cloudflare Pages (`_redirects` rewrites) to validate the built client end-to-end at zero infra; phase 2 layers Supabase for submission, moderation, email-magic-link auth, and immutable storage, with SHA-256 integrity now and ed25519 publisher signing deferred. Wire types are duplicated between the plugin and a new separate backend repo with a cross-repo parity gate.

## Decisions

### Operating context (intent)
**Question**: Who is the backend serving today, and what does success look like for the developer right now?
**Recommended**: n/a — `intent` question
**Chosen**: Just me for now — solo operation today; the audience comes later
**Rationale**: Stated intent; success = a working, deployable version the developer controls end-to-end before opening it to contributors.

### Keep the plugin's read contract (P1)
**Question**: Should the backend implement the plugin's existing three read routes verbatim, or negotiate a new contract?
**Recommended**: Keep the read contract
**Chosen**: Keep the read contract
**Rationale**: evidence: `src/library/registry-client.ts:84-167` — `fetchCatalog` / `fetchRelease` / `fetchReleaseManifest` are shipped, https-only, URL-encoded, identity-checked, never-throws; 949 tests green. Re-negotiating would break the shipped client.

### Separate backend workspace (P2)
**Question**: Should the backend live inside the Obsidian plugin tree or in its own workspace?
**Recommended**: Separate workspace
**Chosen**: Separate workspace
**Rationale**: The backend gets its own build/test/runtime outside the Obsidian plugin tree; the plugin stays a pure client. evidence: research "Backend/dashboard is greenfield"; foundation plan "Backend/server/API workspace — fully greenfield, out of scope."

### Backend delivery phasing (D1)
**Question**: Deliver the whole stateful backend at once, or phase it?
**Recommended**: Registry-first static, then layer stateful
**Chosen**: Registry-first static (Cloudflare Pages), then layer stateful submission/moderation/auth
**Rationale**: The client has `DEFAULT_REGISTRY_URL=''` and no registry to talk to (`src/library/registry-client.ts:23`); a static-catalog milestone validates the built client end-to-end at zero infra, is forward-compatible with phase 2 (same JSON contract), and matches the project's established phasing pattern. Full lifecycle remains the agreed destination.

### Phase-2 hosting (D2)
**Question**: Where should the stateful phase-2 backend run?
**Recommended**: Supabase + a custom domain
**Chosen**: Supabase managed backend (Auth + Postgres + Storage + Edge Functions) + a custom domain the user will buy
**Rationale**: Keeps the source FRD's email-magic-link + custom-WCAG-dashboard + managed-service decisions intact. Cost nuance: a custom domain on the static dashboard/catalog is free (Cloudflare Pages); a custom domain on the Supabase API needs Supabase Pro (~$25/mo) or the API stays on a free `*.supabase.co` subdomain. The free path for "just me now" is: custom domain → dashboard/catalog, API on `*.supabase.co`. The user explicitly rejected GitHub-as-backend ("maybe Supabase more good") and chose to get a domain.

### Static host (D3)
**Question**: Which static host serves the phase-1 catalog and the moderation dashboard SPA?
**Recommended**: Cloudflare Pages
**Chosen**: Cloudflare Pages
**Rationale**: Free, custom domain, and `_redirects` (200-rewrite) maps the extension-less plugin paths (`/catalog`, `/packages/{id}/releases/{ver}`, `.../manifest`) to `.json` files. GitHub Pages cannot do the extension-less JSON rewrites cleanly (the user's original GitHub Pages question is resolved: static catalog yes, stateful backend no).

### Auth (D4)
**Question**: Which sign-in methods should the phase-2 backend support?
**Recommended**: Email magic link only
**Chosen**: Email magic link only (Supabase Auth native; the source FRD decision)
**Rationale**: OAuth providers (GitHub/Google) deferred until the audience grows. "Just me for now" makes passwordless email the lowest-friction choice that still preserves the FRD's accountable-identity model.

### Signatures (D5)
**Question**: Should the backend produce cryptographically signed (ed25519) release manifests in the first delivery?
**Recommended**: Defer ed25519; SHA-256 now
**Chosen**: Defer ed25519 publisher signing; backend produces manifests with SHA-256 hashes; ed25519 + plugin verification deferred
**Rationale**: "Just me for now" removes the key-management ops burden. SHA-256 integrity (detect byte corruption/tamper relative to the manifest) is the current foundation behavior (`src/library/integrity.ts`); the foundation validation explicitly noted the UI must never mark unsigned releases as "trusted" (D11 "integrity not authenticity"). Releases remain immutable; authenticity is deferred.

### Wire-type sharing (D6)
**Question**: How should the backend and the plugin share the registry wire types (`CatalogResponse`, `ReleaseResponse`, `PackageManifest`)?
**Recommended**: Duplicated types + cross-repo parity gate
**Chosen**: Duplicated types + cross-repo parity gate
**Rationale**: The backend lives in a new separate repo and re-declares the wire types; `scripts/check-consistency.mjs` is extended into a cross-repo parity check that fails on type/schema drift. Optimizes: zero plugin-build restructure — the shipped 949-test build stays untouched; cheapest; matches the current zero-sharing posture (research Q10, foundation D12). Sacrifices: drift risk between the two type sets; the parity gate must be built.

## Open Questions
None — all backend interview branches resolved in this session (D1–D6). The source FRD's 31 decisions are inherited unchanged (official catalog, CC BY 4.0, roles, 9-state lifecycle, automated+human gates, immutable releases, reports+takedown, WCAG 2.2 AA, 2s p95, offline-local+cache, dedicated library view, isolated namespace, pinned versions, canonical snippet refs, fail-fast validation, etc.).

## Suggested Follow-ups
- Manual Obsidian-side testing of the client-side foundation is still pending (the validation report `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md` marked it pending) — related (the backend serves that foundation) but out of scope for this backend FRD; should be completed before phase-1 publication so the end-to-end install path is verified against a real catalog.
- Plugin-side submission, report, and revocation UI — the foundation shipped browse + install only; the in-plugin submission wizard, report flow, and revocation-warning rendering are a separate client-side follow-up (the foundation plan explicitly deferred them). The phase-2 backend exposes the API for these, but the UI is not part of this backend delivery.
- Standalone-snippet packages — the current fixed `PackageManifest` contract wraps a `ProtocolDocumentV1` (`protocolDoc` field, validated by `isProtocolDocumentV1` inside `isPackageManifest`) and is protocol-bundle-only; the inherited standalone-snippet goal (source FRD FR5) requires a future backward-compatible contract + client extension, not this backend delivery alone.
- Custom-domain purchase + DNS configuration is an operational prerequisite for D2/D3 (not a software decision); the phase-1 static catalog can run on the default `*.pages.dev` subdomain until the domain is ready.

## References
- Source FRD: `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` (31 inherited decisions)
- Foundation plan: `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md`
- Foundation validation: `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`
- Research: `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` (scope "Plugin client only")
- Read contract: `src/library/registry-client.ts` (`fetchCatalog`/`fetchRelease`/`fetchReleaseManifest`, `DEFAULT_REGISTRY_URL`, `normalizeRegistryUrl`), `src/library/registry-model.ts` (`CatalogResponse`, `ReleaseResponse`), `src/library/library-model.ts` (`PackageManifest`, `CatalogEntry`, `CatalogSnapshot`)
- Integrity: `src/library/integrity.ts` (SHA-256)
- Client override: `src/settings.ts` (`libraryRegistryUrl`)
- Resumed from handoff: `.rpiv/artifacts/handoffs/2026-08-05_22-45-38_community-library-backend-discover.md`