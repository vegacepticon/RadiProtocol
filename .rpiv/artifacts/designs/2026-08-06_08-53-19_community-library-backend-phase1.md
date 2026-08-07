---
date: 2026-08-06T08:53:19+0300
author: Roman Shulgha
commit: 4c680bd
branch: main
repository: RadiProtocol
topic: "Community Library backend — Phase 1 (static registry on Cloudflare Pages)"
tags: [design, backend, library, registry, wire-types, seed, generator, cloudflare-pages, parity-gate, sha256, static-registry]
status: ready
parent: ".rpiv/artifacts/research/2026-08-06_08-19-22_community-library-backend.md"
last_updated: 2026-08-06T08:53:19+0300
last_updated_by: Roman Shulgha
---

# Design: Community Library backend — Phase 1 (static registry on Cloudflare Pages)

## Summary
The backend's Phase 1 is a new greenfield repo that duplicates the plugin's frozen wire types + hand-written guards byte-for-byte, deterministically generates a static JSON registry (catalog + releases + manifests) from a shared seed (Cyrillic + space packageIds), and serves it on Cloudflare Pages via `_redirects` 200-rewrites + a mandatory `404.html`. A probe-based cross-repo parity gate in backend CI (plugin checked out at a pinned rev) fails on wire-type drift. Phase 2 (Supabase stateful lifecycle + dashboard) is deferred to a fresh design after Phase 1 is live.

## Requirements
- Serve the plugin's three read routes over https: `GET /catalog` (`CatalogResponse`), `GET /packages/{id}/releases/{ver}` (`ReleaseResponse`), `GET /packages/{id}/releases/{ver}/manifest` (a `{ manifest: PackageManifest }` wrapper — the plugin's `fetchReleaseManifest` reads `body.manifest`, NOT a bare manifest). Bodies accepted by the plugin's `isCatalogResponse`/`isReleaseResponse`/`isPackageManifest` guards (FR1).
- Serve the three routes at extension-less paths via Cloudflare Pages `_redirects` 200-rewrite to `.json` files (FR2).
- URL-accept percent-encoded non-ASCII `packageId`/`version` path segments (precedent `e14c5c1`) and return identity-matching manifests; the plugin rejects identity mismatch (FR3).
- Phase-1 reads anonymous, no auth (FR4).
- `http://` rejected/redirected to `https://`; the plugin's `normalizeRegistryUrl` (https-only) accepts the configured origin (FR15).
- A release downloaded through the plugin installs atomically via the foundation installer (`library/<packageId>/<version>/`) and produces no missing-snippet validation error (Phase-1 AC).
- Catalog fetch p95 latency ≤ 2s under normal connectivity (FR14).
- Duplicated wire types + a cross-repo parity gate that FAILS on drift (schema sentinel or required-field shape) (FR16 / D6).
- The plugin repo stays untouched: the plugin's `npm run check` remains green with no plugin source changes required for the backend to serve it (FRD acceptance).
- With `libraryRegistryUrl` pointed at the Cloudflare Pages origin, opening the plugin's `LibraryView` lists the seeded catalog anonymously (Phase-1 AC).

## Current State Analysis
The shipped plugin client (`src/library/`) is frozen: 949/949 tests green, `DEFAULT_REGISTRY_URL = ''` (`registry-client.ts:22`) — it has no registry to talk to. The client is a pure, anonymous, https-only read client with three extension-less GET routes (`registry-client.ts:89-179`), per-segment `encodeURIComponent`, an identity check (`body.manifest.packageId === packageId && body.manifest.releaseVersion === version`), and never-throw semantics.

The read contract is frozen and IS the executable spec — the plugin's guards (`isCatalogResponse`/`isReleaseResponse`/`isPackageManifest`/`isCatalogEntry`/`isProtocolDocumentV1`) are the acceptance oracle. The backend converges to the plugin, never the reverse; drift is caught only by the cross-repo parity gate.

Integrity is behavioral, not structural: the wire guards check only `typeof === 'string'` for hash fields; the byte semantics are enforced only at install time. `protocolSha256` = SHA-256 hex of `JSON.stringify(protocolDoc, null, 2) + '\n'` (2-space pretty + single trailing `\n`, plugin key order); each `snippetFiles[i].sha256` = SHA-256 hex of the exact UTF-8 bytes of `snippetContents[i].content` (zero normalization); lowercase 64-char hex; `verifyIntegrity` is case-insensitive; no ed25519 field (D5).

The backend is GREENFIELD (a new separate repo); it has NO inbound code dependency from this repo today. The integration is purely contractual (HTTPS). The plugin's `libraryRegistryUrl` is the single client-configurable base URL; `RegistryClient.baseUrl` is `readonly`, captured once at construction — the read routes stay on ONE Cloudflare origin across both phases (inherited decision #1).

### Key Discoveries
- The gold seed is `makeBundle` (`src/__tests__/library/library-installer.test.ts:59-91`) — the only fixture that computes real SHA-256 hashes and is proven through the full install pipeline (guard + integrity + parser). The backend's seed models after it.
- `isOptionalAuthor` **rejects `null`** (`library-model.ts:162-166`); `isOptionalString` accepts `undefined` or string (`:169-171`). `isProtocolDocumentV1` is shallow — no node/edge element check, ignores `layoutDirection`/`selfCheckEnabled`/`viewport` (`protocol-document.ts:167-183`).
- **Key order matters** for `protocolSha256` — `JSON.stringify` emits keys in insertion order, so the backend must emit `protocolDoc` with the same key order as `createEmptyProtocolDocument` (`schema, version, id, title, createdAt, updatedAt, nodes, edges, layoutDirection`). Duplicate `createEmptyProtocolDocument` verbatim.
- Known-answer test vector: `sha256String('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'` (`integrity.test.ts:5`).
- `isPackageSnippetFile`/`isOptionalAuthor`/`isOptionalString` are **private** in the plugin — the parity gate probes the EXPORTED guards; the private helpers are covered transitively via the exported guards' recursion (e.g. probe `isPackageManifest` with `snippetFiles: [{relPath: 42}]` → rejected ⇒ `array-of object{relPath,sha256}`).
- Cloudflare Pages: without a top-level `404.html`, SPA fallback serves `200 + index.html` for unknown paths (client classifies `unavailable` not `not-found`); with `404.html` present, a missing rewritten asset falls through to a real 404; `_redirects` CANNOT emit 404 (only 200/301/302/307/308) — confirmed via Cloudflare docs (web research).
- `_redirects` source patterns match the **percent-encoded** request path (high-confidence but undocumented) → fixture files use **literal UTF-8 (decoded)** names (`packages/КТ-…/releases/1.0.0.json`); JSON carries decoded strings (identity check compares raw args). **Empirical test on deploy** (verification note).
- `_headers`: "Redirects execute before headers" — put `Cache-Control` on the destination path `/packages/*`; `immutable` affects browsers, not Cloudflare's CDN.
- Precedent (git history): generated JSON was never committed/gated here (new discipline — pin timestamps + regenerate-and-diff); the old git-push publish model was rejected within a week (don't reintroduce shell/git composition in Edge Functions); unpinned `main` ref was the norm (the pinned-rev gate is the fix); consistency-gate deletion once silently broke `npm run check` for 2 days (gates are load-bearing — wire into CI from day one).

## Scope

### Building
- New greenfield backend repo: duplicated wire types + hand-written guards + sentinel constants (`ProtocolDocumentV1`, `PackageManifest`, `CatalogEntry`, `PackageSnippetFile`, `CatalogResponse`, `ReleaseResponse`) + SHA-256 integrity helpers (mirror `integrity.ts`) + `createEmptyProtocolDocument`.
- Shared seed (Cyrillic + space `packageId`s; `protocolDoc`s via `createEmptyProtocolDocument` + snippet nodes; snippet files + contents; pinned timestamps).
- Deterministic static generator (computes `protocolSha256` + per-snippet SHA-256, emits `catalog.json` + release `.json` + manifest `.json`, asserts mutual consistency).
- Cloudflare Pages site config (`_redirects` 2 splat rules, top-level `404.html`, `_headers` immutable cache for `/packages/*`).
- Cross-repo parity gate (probe-based descriptor derivation + diff; backend CI checking out the plugin at a pinned rev).
- Contract tests (encoding/identity round-trip, 404 behavior, generated files pass both guard sets) + regenerate-and-diff gate + CI workflow.
- Repo scaffolding (`package.json`, `tsconfig.json`, `esbuild.config.mjs`).

### Not Building
- Phase 2 stateful backend: Supabase Auth (email magic link PKCE), Postgres schema (`profiles`/`packages`/`submissions`/`submission_events`/`releases`/`reports`/`revocations`/`audit_log`), RLS, 9-state submission lifecycle, automated submission gates, publication/revocation RPCs, Storage immutability, regen webhook, reports/triage.
- Moderation dashboard SPA (WCAG 2.2 AA).
- In-plugin submission/report/revocation UI (plugin-side follow-up; the foundation shipped browse + install only).
- Revocation-warning API shape (FR13; separate future API).
- ed25519 publisher signing + plugin-side signature verification (D5; deferred).
- OAuth providers (D4; deferred).
- Standalone-snippet packages (the contract wraps `ProtocolDocumentV1`; protocol-bundle only).
- Any plugin source change (the plugin repo stays untouched; `libraryRegistryUrl` is the only config).

## Decisions

### D1 — Scope: Phase 1 only (static registry)
**Ambiguity**: The research + FRD describe a two-phase backend; the developer wants "a fully functional version" but the FRD's D1 is "registry-first, then layer stateful" and the open questions (publish-webhook mechanism) are phase-2-specific.
**Explored**: (A) Phase 1 only — deliver the immediate "make the client functional" milestone at zero infra; Phase 2 fresh design after Phase 1 is live; matches "just me for now" (solo author publishes via the seed/generator). (B) Both phases, full — complete blueprint, ~15 slices, webhook mechanism chosen against un-validated assumptions. (C) Phase 1 + Phase 2 core — middle ground, defer the SPA.
**Decision**: **Phase 1 only**. Honors D1 phasing; Phase 2 open questions (publish-webhook mechanism) resolve empirically after Phase 1 is live; "just me for now" means the solo author publishes via the seed/generator and the submission/moderation lifecycle waits for contributors.

### D2 — Wire-type duplication: hand-written guards, byte-for-byte
**Ambiguity**: Mirror the plugin's hand-written guards (`typeof`/`===`/`Array.isArray`/`.every`) vs zod schemas that compile to equivalent validators. The parity gate probes accepted shape behaviorally, so either passes the gate.
**Explored**: (A) Hand-written — literal duplication, matches D6 "duplicated types" + "guards are the executable contract", zero new deps; risk: hand-duplication error caught by the parity gate. (B) zod — less duplication error, modern; trade-off: diverges in style, new dependency.
**Decision**: **Hand-written, byte-for-byte** (directional confirm: follow). Models after `library-model.ts:174-212`, `registry-model.ts:33-53`, `protocol-document.ts:167-183`. Re-declare sentinel constants (`'radiprotocol.package'`/1, `'radiprotocol.protocol'`/1, `'radiprotocol.catalog'`/1, `'radiprotocol.installed-record'`/1), all interfaces with identical field names/optionality/`readonly`, and the private helpers (`isPackageSnippetFile`, `isOptionalAuthor`, `isOptionalString`) which reject `null` for `author`/`summary`.

### D3 — Toolchain: TS + esbuild + zero-dep + fail/exit skeleton
**Decision**: The backend repo mirrors the plugin's lightweight stack — TypeScript + esbuild + zero-dependency Node scripts + the `errors`/`fail()`/`process.exit(1)` gate skeleton from `check-consistency.mjs:5-14,115-127` (directional confirm: follow). The parity gate reuses `check-consistency.mjs`'s skeleton; the generator + regen-diff are zero-dep Node scripts.

### D4 — JSON artifacts: commit-and-gate
**Ambiguity**: Commit deterministic generated JSON + regenerate-and-diff in CI vs generate-in-CI only (gitignore artifacts, run the generator in the Pages build).
**Explored**: (A) Commit-and-gate — auditability + byte-stable deploys + Cloudflare serves committed files directly (no build step); new discipline the repo hasn't done (precedent-locator). (B) Generate-in-CI — no committed artifacts; loses auditability, requires the generator in CI, no regenerate-and-diff on the committed tree.
**Decision**: **Commit-and-gate** (directional confirm: follow). Deterministic generator with pinned `serverTime`/`publishedAt`; committed `site/*.json`; CI regenerates + diffs against committed + fails on drift.

### D5 — Parity gate mechanism: probe-based (Option D)
**Ambiguity**: How to compare the duplicated wire types across repos. `flatKeys` (Check 7) is insufficient — the wire contract needs requiredness, literal sentinels, array-element shapes, open maps, unions, wrapper nesting.
**Explored**: (A) Hand-written descriptors on both sides, diffed — simplest; but the plugin-side copy is a second hand-written source that can itself drift from the guards (the gate's core failure mode). (D) Executable-contract probing — compile the plugin's guards at a pinned rev + probe both sides' guards behaviorally to derive a shape descriptor, diff; no hand-written drift; the probe self-verifies its seed (`assert guard(seed) === true`); matches "guards are the executable contract"; cost: a compile step + a probe harness. (E) Shared-fixture execution — run the shared seed + negatives through both sides' guards; pragmatic; only catches drift the fixtures exercise.
**Decision**: **Probe-based (Option D)**. Descriptor scope = the **guard**, not the interface — declared-but-unenforced fields (`layoutDirection`, `selfCheckEnabled`, `selfCheckItems`, `viewport`) are present in the probe seed so the harness probes them; the guard ignores them, so they derive as `{ required: false, kind: 'unknown' }` (the harness tests a non-typed value — e.g. a number for a string field, a non-boolean for a boolean field — to detect an ignored field) on BOTH sides → match. The probe harness builds seeds (from the backend's `createEmptyProtocolDocument` + the shared seed), probes each EXPORTED guard (private helpers covered transitively via the exported guards' recursion), derives a canonical shape descriptor, and diffs bidirectionally (Check 7 pattern). **Implemented kind taxonomy**: `object{open, fields[]}` | `array` | `array-of{element}` | `string` | `number` | `boolean` | `literal{value}` | `null` | `unknown`. Records = open objects with no constrained fields; nested objects are INLINED (no separate `$ref` kind — both sides inline identically from the same seed). Multi-value unions are NOT separately distinguished — no current guard enforces a union, and a future union-enforcing guard would derive as the seed's `literal` value (a documented limitation; extend the harness if/when a union is enforced). **Field order**: the descriptor's `fields` follow `Object.keys(seed)`; both sides use the SAME backend seed → the order is a consistency check, not a cross-repo order-drift detector. The `createEmptyProtocolDocument` key-order parity (which determines `protocolSha256` bytes) is enforced by **D2** (byte-for-byte duplication, Slice 1) + the Slice 1 manual key-order check, not by this gate.

### D6 — SHA-256: Web Crypto (mirror integrity.ts)
**Decision**: Mirror `src/library/integrity.ts` (Web Crypto `globalThis.crypto.subtle`, async, lowercase hex) for byte-identical output. `protocolSha256` = SHA-256 of `JSON.stringify(protocolDoc, null, 2) + '\n'` (plugin key order); snippet `sha256` = SHA-256 of the exact UTF-8 content bytes; both lowercase 64-char hex; `verifyIntegrity` case-insensitive. The known-answer test vector `sha256String('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'` validates the implementation. (Node 18+ has `globalThis.crypto.subtle`, so the generator runs in Node with the identical code.)

### D7 — Cloudflare Pages serving: 2 splat rules + 404.html + _headers
**Decision**: Two `_redirects` 200-rewrite rules: `/catalog /catalog.json 200` and `/packages/* /packages/:splat.json 200` (one splat covers both the release and manifest routes). A top-level `404.html` is mandatory (without it, SPA fallback serves `200 + index.html` for unknown release paths → client classifies `unavailable` not `not-found`; `_redirects` cannot emit 404). `_headers` sets `/packages/* Cache-Control: public, max-age=86400, immutable` (immutable release JSON; headers apply to the destination path since redirects execute before headers); `/catalog` keeps the default `must-revalidate`. Fixture files use literal UTF-8 (decoded) names so the percent-encoded request path resolves to them; JSON carries decoded strings (identity check). HTTPS: Always Use HTTPS (free); the client is https-only anyway.

### D8 — Static regen on publish (phase-2 hook, inherited)
**Decision** (inherited from research checkpoint #1): read routes stay static JSON on Cloudflare Pages across BOTH phases; a publish/revoke webhook regenerates `catalog.json` + release/manifest `.json` reusing the phase-1 generator + `_redirects`; the custom-domain `libraryRegistryUrl` never changes; Supabase (phase 2) serves only the stateful write API on `*.supabase.co`. The phase-1 generator is built to be reusable by the phase-2 webhook. (Phase 2 is out of scope for THIS design but the generator is forward-compatible.)

### D9 — Backend CI, plugin pinned (inherited)
**Decision** (inherited from research checkpoint #2): the parity gate runs in the backend repo's CI checking out the plugin at a pinned rev (`plugin-pin.txt`); the plugin repo keeps no cross-repo gate (its `npm run check` stays green/untouched). The plugin's shipped guards are the source of truth the backend converges to.

### D10 — Shared seed (inherited)
**Decision** (inherited from research checkpoint #3): one seed definition (packages incl. a Cyrillic `packageId` + one with a space; `protocolDoc`s built like `createEmptyProtocolDocument`; snippets + contents; real SHA-256 hashes; pinned timestamps) feeds the phase-1 generator AND doubles as contract-test data AND the phase-2 Supabase seed migration. Models after `makeBundle` (`src/__tests__/library/library-installer.test.ts:59-91`). Keep seeded `packageId`/`version` slash-free (a `%2F` would decode into a path separator).

### D11 — Integrity not authenticity (inherited D5)
**Decision** (inherited): SHA-256 now, ed25519 deferred. The manifest carries hashes + provenance and NO signature field. The UI never marks unsigned releases "trusted" (grep-enforced every phase). The backend's manifest has no ed25519 field.

## Architecture

### package.json — NEW
Repo manifest: scripts (`build`, `generate`, `check:wire-parity`, `check:regen-diff`, `test`), dev deps (`esbuild`, `vitest`, `typescript`, `@types/node`). Declares the full script surface up-front as the complete repo scaffold; `generate`/`build`/`check:wire-parity`/`check:regen-diff`/`check` are dormant until their owning slices (3/4/5) land (by-design — Success Criteria invoke only `typecheck`/`test`).

```json
{
  "name": "radiprotocol-library-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Phase-1 static registry backend for the RadiProtocol Community Library (served on Cloudflare Pages).",
  "scripts": {
    "typecheck": "tsc -noEmit -skipLibCheck",
    "build": "npm run typecheck && npm run build:generate",
    "build:generate": "node esbuild.config.mjs src/generator/generate.ts dist/generate.cjs",
    "generate": "npm run build:generate && node dist/generate.cjs",
    "check:wire-parity": "node scripts/check-wire-parity.mjs",
    "check:regen-diff": "node scripts/check-regen-diff.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run check:regen-diff && npm run check:wire-parity && npm test"
  },
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.0.0",
    "esbuild": "0.28.0",
    "typescript": "6.0.2",
    "vitest": "^4.1.2"
  }
}
```

### tsconfig.json — NEW
TypeScript config: Node target, strict, the wire-types/generator/gate compilation root. `lib: ["DOM","ES2022"]` supplies `SubtleCrypto`/`TextEncoder` for the duplicated `integrity.ts`; `noUncheckedIndexedAccess` supports the mirrored `bytes[i]!`.

```json
{
  "compilerOptions": {
    "ignoreDeprecations": "6.0",
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "strictNullChecks": true,
    "strictBindCallApply": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "useUnknownInCatchVariables": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "lib": ["DOM", "ES2022"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "__tests__/**/*.ts"]
}
```

### esbuild.config.mjs — NEW
Generic argv-driven TS→CJS bundler for the backend's Node scripts (the generator). The parity gate (Slice 4) uses esbuild's JS API directly to bundle the plugin's guard files.

```js
// Generic one-shot TS→CJS bundler for the backend's Node scripts (generator).
// Usage: node esbuild.config.mjs <entry.ts> <outfile.cjs>
// (The parity gate in Slice 4 uses esbuild's JS API directly to bundle the plugin's
// guard files; this config is for the generator build only.)
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const entry = process.argv[2];
const outfile = process.argv[3];
if (!entry || !outfile) {
  console.error('Usage: node esbuild.config.mjs <entry.ts> <outfile.cjs>');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outfile), { recursive: true });
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  logLevel: 'info',
  outfile,
});
if (result.errors.length > 0) process.exit(1);
```

### src/wire-types/protocol-document.ts — NEW
Duplicated `ProtocolDocumentV1` + `ProtocolNodeRecord` + `ProtocolEdgeRecord` + `isProtocolDocumentV1` + `createEmptyProtocolDocument` + sentinels (`PROTOCOL_SCHEMA`/`PROTOCOL_VERSION`) + `RPNodeKind` (re-declared inline; the guard does not check `kind`). Byte-for-byte mirror of `src/protocol/protocol-document.ts` (D2; D5 parity gate compares these). The `createEmptyProtocolDocument` key order is the hashed bytes for `protocolSha256`.

```typescript
// DUPLICATED from the plugin's src/protocol/protocol-document.ts (D2 — hand-written
// byte-for-byte; D5 — cross-repo parity gate compares these). Same sentinels, same
// interface field names/optionality, same createEmptyProtocolDocument key order (the
// hashed bytes for protocolSha256), same shallow isProtocolDocumentV1 guard. Zero Obsidian
// imports. The only adaptation: RPNodeKind is re-declared inline (the backend has no
// graph layer); the guard does not check `kind`, so this is type-only and wire-irrelevant.

/** Canonical schema identifier for RadiProtocol JSON files. */
export const PROTOCOL_SCHEMA = 'radiprotocol.protocol' as const;

/** Current on-disk schema version. Bump on breaking changes. */
export const PROTOCOL_VERSION = 1 as const;

/** Node kinds (duplicated from the plugin's src/graph/graph-model.ts:7-14). */
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'text-block'
  | 'loop-start'      // @deprecated — legacy parseable for migration-error
  | 'loop-end'        // @deprecated — legacy parseable for migration-error
  | 'snippet';

export interface ProtocolDocumentV1 {
  schema: typeof PROTOCOL_SCHEMA;
  version: typeof PROTOCOL_VERSION;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: ProtocolNodeRecord[];
  edges: ProtocolEdgeRecord[];
  selfCheckEnabled?: boolean;
  selfCheckItems?: string[];
  viewport?: { x: number; y: number; zoom: number };
  layoutDirection?: 'LR' | 'TB';
}

export interface ProtocolNodeRecord {
  id: string;
  kind: RPNodeKind | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text?: string;
  fields: Record<string, unknown>;
}

export interface ProtocolEdgeRecord {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  isLoopExit?: boolean;
}

export function createEmptyProtocolDocument(
  id: string,
  title: string,
  now = new Date(),
  startNodeId = `node-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
): ProtocolDocumentV1 {
  const iso = now.toISOString();
  return {
    schema: PROTOCOL_SCHEMA,
    version: PROTOCOL_VERSION,
    id,
    title,
    createdAt: iso,
    updatedAt: iso,
    nodes: [
      {
        id: startNodeId,
        kind: 'start',
        x: 0,
        y: 0,
        width: 200,
        height: 80,
        color: 'rgba(76, 175, 80, 0.28)',
        fields: {},
      },
    ],
    edges: [],
    layoutDirection: 'LR',
  };
}

export function isProtocolDocumentV1(value: unknown): value is ProtocolDocumentV1 {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as Record<string, unknown>;
  return (
    doc['schema'] === PROTOCOL_SCHEMA &&
    doc['version'] === PROTOCOL_VERSION &&
    typeof doc['id'] === 'string' &&
    typeof doc['title'] === 'string' &&
    typeof doc['createdAt'] === 'string' &&
    typeof doc['updatedAt'] === 'string' &&
    Array.isArray(doc['nodes']) &&
    Array.isArray(doc['edges'])
  );
}
```

### src/wire-types/library-model.ts — NEW
Duplicated `PackageManifest` + `CatalogEntry` + `PackageSnippetFile` + guards (`isPackageManifest`, `isCatalogEntry`, and the private helpers `isPackageSnippetFile`/`isOptionalAuthor`/`isOptionalString`) + `PACKAGE_MANIFEST_SCHEMA`/`VERSION`. Byte-for-byte mirror of `src/library/library-model.ts`. Client-only types (`CatalogSnapshot`, `InstalledRecord`, `ReleaseBundle`, `CatalogFetchResult`, `LibraryStoreError`) and their sentinels (`CATALOG_SNAPSHOT_*`, `INSTALLED_RECORD_*`) are NOT duplicated — they are not served on the wire; the parity gate (Slice 4) compares only the served types.

```typescript
// DUPLICATED from the plugin's src/library/library-model.ts (D2 — hand-written
// byte-for-byte; D5 — parity gate compares the served types). Mirror of the SERVED wire
// types + guards: PackageManifest, CatalogEntry, PackageSnippetFile + isPackageManifest/
// isCatalogEntry (and the private helpers isPackageSnippetFile/isOptionalAuthor/
// isOptionalString). Client-only types (CatalogSnapshot, InstalledRecord, ReleaseBundle,
// CatalogFetchResult, LibraryStoreError) are NOT duplicated — they are not served on the
// wire; the parity gate (Slice 4) compares only the served types.

import { isProtocolDocumentV1, type ProtocolDocumentV1 } from './protocol-document';

export const PACKAGE_MANIFEST_SCHEMA = 'radiprotocol.package' as const;
export const PACKAGE_MANIFEST_VERSION = 1 as const;

export interface PackageSnippetFile {
  relPath: string;
  sha256: string;
}

export interface PackageManifest {
  readonly schema: typeof PACKAGE_MANIFEST_SCHEMA;
  readonly version: typeof PACKAGE_MANIFEST_VERSION;
  packageId: string;
  releaseVersion: string;
  protocolDoc: ProtocolDocumentV1;
  protocolSha256: string;
  snippetFiles: PackageSnippetFile[];
  catalogEntryId: string;
  author?: { displayName: string };
  publishedAt: string;
}

export interface CatalogEntry {
  packageId: string;
  title: string;
  description: string;
  author: { displayName: string };
  latestVersion: string;
  categories: string[];
  updatedAt: string;
  summary?: string;
}

function isPackageSnippetFile(value: unknown): value is PackageSnippetFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return typeof f['relPath'] === 'string' && typeof f['sha256'] === 'string';
}

function isOptionalAuthor(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>)['displayName'] === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

export function isPackageManifest(value: unknown): value is PackageManifest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['schema'] === PACKAGE_MANIFEST_SCHEMA &&
    v['version'] === PACKAGE_MANIFEST_VERSION &&
    typeof v['packageId'] === 'string' &&
    typeof v['releaseVersion'] === 'string' &&
    isProtocolDocumentV1(v['protocolDoc']) &&
    typeof v['protocolSha256'] === 'string' &&
    Array.isArray(v['snippetFiles']) &&
    v['snippetFiles'].every((f) => isPackageSnippetFile(f)) &&
    typeof v['catalogEntryId'] === 'string' &&
    typeof v['publishedAt'] === 'string' &&
    isOptionalAuthor(v['author'])
  );
}

export function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const author = v['author'];
  const authorOk =
    typeof author === 'object' &&
    author !== null &&
    typeof (author as Record<string, unknown>)['displayName'] === 'string';
  return (
    typeof v['packageId'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['description'] === 'string' &&
    typeof v['latestVersion'] === 'string' &&
    Array.isArray(v['categories']) &&
    v['categories'].every((c) => typeof c === 'string') &&
    typeof v['updatedAt'] === 'string' &&
    isOptionalString(v['summary']) &&
    authorOk
  );
}
```

### src/wire-types/registry-model.ts — NEW
Duplicated `CatalogResponse` + `ReleaseResponse` + `isCatalogResponse` + `isReleaseResponse`. Byte-for-byte mirror of `src/library/registry-model.ts` (D2; D5 parity gate).

```typescript
// DUPLICATED from the plugin's src/library/registry-model.ts (D2 — hand-written
// byte-for-byte; D5 — parity gate). Mirror: CatalogResponse, ReleaseResponse +
// isCatalogResponse/isReleaseResponse. Zero Obsidian imports. (The plugin's
// ReleaseFetchResult/ReleaseManifestFetchResult are client-side result types, not served
// on the wire — not duplicated.)

import type { CatalogEntry, PackageManifest } from './library-model';
import { isCatalogEntry, isPackageManifest } from './library-model';

export interface CatalogResponse {
  entries: CatalogEntry[];
  serverTime: string;
}

export interface ReleaseResponse {
  manifest: PackageManifest;
  snippetContents: Array<{ relPath: string; content: string }>;
}

export function isCatalogResponse(value: unknown): value is CatalogResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['entries']) &&
    v['entries'].every((e) => isCatalogEntry(e)) &&
    typeof v['serverTime'] === 'string'
  );
}

export function isReleaseResponse(value: unknown): value is ReleaseResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isPackageManifest(v['manifest'])) return false;
  if (!Array.isArray(v['snippetContents'])) return false;
  return v['snippetContents'].every((s) => {
    if (typeof s !== 'object' || s === null) return false;
    const sc = s as Record<string, unknown>;
    return typeof sc['relPath'] === 'string' && typeof sc['content'] === 'string';
  });
}
```

### src/wire-types/integrity.ts — NEW
Duplicated `sha256String` + `toHex` + `verifyIntegrity` (Web Crypto `globalThis.crypto.subtle`, lowercase hex). Byte-for-byte mirror of `src/library/integrity.ts` (D6). NO signature field (D11).

```typescript
// DUPLICATED from the plugin's src/library/integrity.ts (D6 — SHA-256 byte-identical
// via Web Crypto globalThis.crypto.subtle, lowercase hex). Framed as INTEGRITY (detect
// byte corruption/tamper relative to a manifest hash), NOT authenticity — ed25519 is
// deferred (D11). The UI must never mark unsigned releases "trusted".

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (s === undefined) {
    throw new Error('[RadiProtocol] Web Crypto subtle.digest unavailable — cannot compute SHA-256');
  }
  return s;
}

export async function sha256String(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await subtle().digest('SHA-256', bytes);
  return toHex(digest as ArrayBuffer);
}

export async function verifyIntegrity(content: string, expectedSha256: string): Promise<boolean> {
  const actual = await sha256String(content);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}
```

### __tests__/wire-types.test.ts — NEW
Wire-type guard behavior: `isProtocolDocumentV1`/`isPackageManifest`/`isCatalogEntry` accept valid + reject bad sentinels/null-author/missing-author/non-array/bad-element (proves the duplication); the manifest-only `{manifest}` wrapper (extra keys tolerated); integrity known-answer SHA-256 vector + the `protocolSha256` canonical (`JSON.stringify(doc, null, 2) + '\n'`) contract.

```typescript
import { describe, it, expect } from 'vitest';
import {
  isPackageManifest, isCatalogEntry, PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  type PackageManifest, type CatalogEntry,
} from '../src/wire-types/library-model';
import {
  isCatalogResponse, isReleaseResponse, type CatalogResponse, type ReleaseResponse,
} from '../src/wire-types/registry-model';
import {
  isProtocolDocumentV1, createEmptyProtocolDocument,
} from '../src/wire-types/protocol-document';
import { sha256String, verifyIntegrity } from '../src/wire-types/integrity';

function validManifest(): PackageManifest {
  return {
    schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
    packageId: 'chest-ct', releaseVersion: '1.0.0',
    protocolDoc: createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'), 'node-seed'),
    protocolSha256: 'a'.repeat(64),
    snippetFiles: [{ relPath: 'lung.md', sha256: 'b'.repeat(64) }],
    catalogEntryId: 'chest-ct', publishedAt: '2026-01-01T00:00:00Z',
  };
}
function validCatalogEntry(): CatalogEntry {
  return { packageId: 'chest-ct', title: 'Chest CT', description: 'd', author: { displayName: 'X' }, latestVersion: '1.0.0', categories: ['radiology'], updatedAt: 't' };
}

describe('wire-types — isProtocolDocumentV1', () => {
  it('accepts a createEmptyProtocolDocument output', () => {
    expect(isProtocolDocumentV1(createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'n1'))).toBe(true);
  });
  it('rejects wrong schema sentinel', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'n1');
    expect(isProtocolDocumentV1({ ...doc, schema: 'wrong' })).toBe(false);
  });
  it('rejects wrong version', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'n1');
    expect(isProtocolDocumentV1({ ...doc, version: 2 })).toBe(false);
  });
  it('rejects non-array nodes', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'n1');
    expect(isProtocolDocumentV1({ ...doc, nodes: 'not-array' })).toBe(false);
  });
  it('is shallow — does NOT validate node kind (layoutDirection ignored)', () => {
    const doc = createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'n1');
    // @ts-expect-error — intentionally wrong kind to prove the guard ignores it
    doc.nodes[0]!.kind = 'bogus';
    expect(isProtocolDocumentV1(doc)).toBe(true);
  });
});

describe('wire-types — isPackageManifest', () => {
  it('accepts a valid manifest', () => {
    expect(isPackageManifest(validManifest())).toBe(true);
  });
  it('rejects wrong schema sentinel', () => {
    expect(isPackageManifest({ ...validManifest(), schema: 'wrong' })).toBe(false);
  });
  it('rejects null author (isOptionalAuthor rejects null)', () => {
    expect(isPackageManifest({ ...validManifest(), author: null })).toBe(false);
  });
  it('accepts absent author (optional)', () => {
    const { author, ...rest } = validManifest();
    expect(isPackageManifest(rest)).toBe(true);
  });
  it('rejects non-array snippetFiles', () => {
    expect(isPackageManifest({ ...validManifest(), snippetFiles: 'x' })).toBe(false);
  });
  it('rejects snippetFiles with bad element (relPath not string)', () => {
    expect(isPackageManifest({ ...validManifest(), snippetFiles: [{ relPath: 42, sha256: 'b'.repeat(64) }] })).toBe(false);
  });
});

describe('wire-types — isCatalogEntry (author REQUIRED)', () => {
  it('accepts a valid entry', () => {
    expect(isCatalogEntry(validCatalogEntry())).toBe(true);
  });
  it('rejects missing author (required, unlike manifest)', () => {
    const { author, ...rest } = validCatalogEntry();
    expect(isCatalogEntry(rest)).toBe(false);
  });
  it('rejects null summary (isOptionalString rejects null)', () => {
    expect(isCatalogEntry({ ...validCatalogEntry(), summary: null })).toBe(false);
  });
  it('rejects categories with non-string element', () => {
    expect(isCatalogEntry({ ...validCatalogEntry(), categories: ['ok', 42] })).toBe(false);
  });
});

describe('wire-types — isCatalogResponse / isReleaseResponse / {manifest} wrapper', () => {
  it('accepts a valid CatalogResponse', () => {
    const body: CatalogResponse = { entries: [validCatalogEntry()], serverTime: 't' };
    expect(isCatalogResponse(body)).toBe(true);
  });
  it('rejects CatalogResponse with non-array entries', () => {
    expect(isCatalogResponse({ entries: 'x', serverTime: 't' })).toBe(false);
  });
  it('accepts a valid ReleaseResponse', () => {
    const body: ReleaseResponse = { manifest: validManifest(), snippetContents: [{ relPath: 'lung.md', content: '# Lung' }] };
    expect(isReleaseResponse(body)).toBe(true);
  });
  it('accepts the manifest-only {manifest} wrapper — extra keys tolerated', () => {
    const wrapper = { manifest: validManifest() };
    expect(isPackageManifest(wrapper.manifest)).toBe(true);
  });
  it('rejects ReleaseResponse with bad snippetContents element', () => {
    expect(isReleaseResponse({ manifest: validManifest(), snippetContents: [{ relPath: 'lung.md' }] })).toBe(false);
  });
});

describe('wire-types — integrity (SHA-256, byte-identical to plugin)', () => {
  it('known-answer vector: sha256String("abc")', async () => {
    expect(await sha256String('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('produces lowercase 64-char hex', async () => {
    expect(await sha256String('hello')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('verifyIntegrity is case-insensitive and never throws on mismatch', async () => {
    expect(await verifyIntegrity('abc', 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD')).toBe(true);
    expect(await verifyIntegrity('abc', '0'.repeat(64))).toBe(false);
  });
  it('protocolSha256 contract: SHA-256 of JSON.stringify(doc, null, 2) + newline', async () => {
    const doc = createEmptyProtocolDocument('id-1', 'Chest CT', new Date('2026-01-01T00:00:00Z'), 'node-seed');
    const canonical = JSON.stringify(doc, null, 2) + '\n';
    const expected = await sha256String(canonical);
    expect(await verifyIntegrity(canonical, expected)).toBe(true);
  });
});
```

### src/seed/seed.ts — NEW
Shared seed definition: an array of seed packages (each with `packageId`, `releaseVersion`, `title`, `description`, `categories`, `author.displayName`, a `protocolDoc` built via `createEmptyProtocolDocument` + snippet nodes + edges, and `snippetFiles` + `snippetContents`). Includes a Cyrillic `packageId` (`КТ-грудная-клетка`) and one with a space (`chest ct`). Pinned timestamps (`createdAt`/`updatedAt`/`publishedAt`/`serverTime`) for byte-stable deploys. Exports a `SEED` constant + a `buildSeedReleases()` that computes real SHA-256 hashes via `sha256String`.

```typescript
// Shared seed definition (D10 — inherited decision #3): one seed feeds the phase-1
// generator, the parity-gate probe seeds, the contract tests, AND the future phase-2
// Supabase seed migration. Includes a Cyrillic packageId (КТ-грудная-клетка) + one with
// a space (chest ct) to exercise FR3 (percent-encoded non-ASCII path segments). Pinned
// timestamps for byte-stable deploys. Models after makeBundle (library-installer.test.ts:59-91).

import {
  createEmptyProtocolDocument,
  type ProtocolDocumentV1, type ProtocolNodeRecord, type ProtocolEdgeRecord,
} from '../wire-types/protocol-document';
import {
  PACKAGE_MANIFEST_SCHEMA, PACKAGE_MANIFEST_VERSION,
  type PackageManifest, type PackageSnippetFile, type CatalogEntry,
} from '../wire-types/library-model';
import { sha256String } from '../wire-types/integrity';

/** A snippet file declaration in the seed (relPath + content; the sha256 is computed). */
export interface SeedSnippetFile {
  relPath: string;
  content: string;
}

/** A snippet node wired into the protocol doc (binds a node to a snippet relPath). */
export interface SeedSnippetNode {
  nodeId: string;
  snippetPath: string; // matches a SeedSnippetFile.relPath
}

/** A seed package definition (deterministic; hashes computed by buildSeedReleases). */
export interface SeedPackage {
  packageId: string;       // slash-free; the seed includes a Cyrillic + a space id
  releaseVersion: string;
  title: string;
  description: string;
  categories: string[];
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  protocolId: string;
  startNodeId: string;
  snippetFiles: SeedSnippetFile[];
  snippetNodes: SeedSnippetNode[];
}

/** Pinned catalog serverTime for byte-stable catalog.json. */
export const SEED_SERVER_TIME = '2026-01-01T00:00:00.000Z';

/** The seed definition — the single source feeding the generator + parity probes + tests. */
export const SEED: SeedPackage[] = [
  {
    packageId: 'chest-ct',
    releaseVersion: '1.0.0',
    title: 'Chest CT Protocol',
    description: 'A starter chest CT reporting protocol.',
    categories: ['radiology', 'chest'],
    authorDisplayName: 'Roman Shulgha',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    protocolId: 'chest-ct-1',
    startNodeId: 'n-start-chest',
    snippetFiles: [{ relPath: 'lung-nodule.md', content: '# Lung nodule assessment\n\nDescribe location, size, and characteristics.\n' }],
    snippetNodes: [{ nodeId: 'n-snip-chest', snippetPath: 'lung-nodule.md' }],
  },
  {
    packageId: 'КТ-грудная-клетка', // Cyrillic — exercises FR3 percent-encoded path
    releaseVersion: '1.0.0',
    title: 'КТ грудной клетки',
    description: 'Протокол КТ грудной клетки (Cyrillic packageId round-trip).',
    categories: ['radiology', 'chest'],
    authorDisplayName: 'Roman Shulgha',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    protocolId: 'kt-chest-1',
    startNodeId: 'n-start-kt',
    snippetFiles: [{ relPath: 'заключение.md', content: '# Заключение\n\nОпишите findings.\n' }],
    snippetNodes: [{ nodeId: 'n-snip-kt', snippetPath: 'заключение.md' }],
  },
  {
    packageId: 'chest ct', // space — exercises FR3 percent-encoding (%20)
    releaseVersion: '1.0.0',
    title: 'Chest CT (space id)',
    description: 'A package whose id contains a space (exercises %20 encoding).',
    categories: ['radiology'],
    authorDisplayName: 'Roman Shulgha',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
    protocolId: 'chest-ct-space-1',
    startNodeId: 'n-start-space',
    snippetFiles: [{ relPath: 'findings.md', content: '# Findings\n\nDescribe findings here.\n' }],
    snippetNodes: [{ nodeId: 'n-snip-space', snippetPath: 'findings.md' }],
  },
];

export interface SeedRelease {
  manifest: PackageManifest;
  snippetContents: Array<{ relPath: string; content: string }>;
  catalogEntry: CatalogEntry;
}

/** Build the seed releases with real SHA-256 hashes computed from the exact bytes.
 *  Deterministic: given the same SEED, produces byte-identical output (pinned timestamps,
 *  explicit startNodeId — no Math.random). */
export async function buildSeedReleases(): Promise<SeedRelease[]> {
  const releases: SeedRelease[] = [];
  for (const pkg of SEED) {
    const protocolDoc = createEmptyProtocolDocument(pkg.protocolId, pkg.title, new Date(pkg.createdAt), pkg.startNodeId);
    const nodes: ProtocolNodeRecord[] = [...protocolDoc.nodes];
    const edges: ProtocolEdgeRecord[] = [];
    for (const sn of pkg.snippetNodes) {
      nodes.push({ id: sn.nodeId, kind: 'snippet', x: 0, y: 200, width: 100, height: 100, fields: { snippetPath: sn.snippetPath } });
      edges.push({ id: `e-${pkg.startNodeId}-${sn.nodeId}`, fromNodeId: pkg.startNodeId, toNodeId: sn.nodeId });
    }
    const doc: ProtocolDocumentV1 = { ...protocolDoc, nodes, edges };

    const protocolSha256 = await sha256String(JSON.stringify(doc, null, 2) + '\n');
    const snippetFiles: PackageSnippetFile[] = [];
    const snippetContents: Array<{ relPath: string; content: string }> = [];
    for (const f of pkg.snippetFiles) {
      const sha256 = await sha256String(f.content);
      snippetFiles.push({ relPath: f.relPath, sha256 });
      snippetContents.push({ relPath: f.relPath, content: f.content });
    }

    const manifest: PackageManifest = {
      schema: PACKAGE_MANIFEST_SCHEMA, version: PACKAGE_MANIFEST_VERSION,
      packageId: pkg.packageId, releaseVersion: pkg.releaseVersion,
      protocolDoc: doc, protocolSha256,
      snippetFiles, catalogEntryId: pkg.packageId,
      author: { displayName: pkg.authorDisplayName },
      publishedAt: pkg.publishedAt,
    };
    const catalogEntry: CatalogEntry = {
      packageId: pkg.packageId, title: pkg.title, description: pkg.description,
      author: { displayName: pkg.authorDisplayName },
      latestVersion: pkg.releaseVersion, categories: pkg.categories, updatedAt: pkg.updatedAt,
    };
    releases.push({ manifest, snippetContents, catalogEntry });
  }
  return releases;
}
```

### __tests__/seed.test.ts — NEW
Seed validity: each package's manifest passes `isPackageManifest`; `snippetContents` relPath set === `snippetFiles` relPath set; `catalogEntryId === packageId`; the Cyrillic + space `packageId`s are slash-free; `sha256String('abc')` known-answer vector.

```typescript
import { describe, it, expect } from 'vitest';
import { SEED, buildSeedReleases } from '../src/seed/seed';
import { isPackageManifest, isCatalogEntry } from '../src/wire-types/library-model';
import { sha256String } from '../src/wire-types/integrity';

describe('seed — definition invariants', () => {
  it('includes a Cyrillic packageId and one with a space (FR3)', () => {
    const ids = SEED.map((p) => p.packageId);
    expect(ids).toContain('КТ-грудная-клетка');
    expect(ids).toContain('chest ct');
  });
  it('all packageIds are slash-free (a %2F would decode into a path separator)', () => {
    for (const p of SEED) expect(p.packageId.includes('/')).toBe(false);
  });
  it('all releaseVersions are slash-free', () => {
    for (const p of SEED) expect(p.releaseVersion.includes('/')).toBe(false);
  });
  it('every snippet file relPath ends with .md and is traversal-safe', () => {
    for (const p of SEED) for (const f of p.snippetFiles) {
      expect(f.relPath.endsWith('.md')).toBe(true);
      expect(f.relPath.includes('..')).toBe(false);
      expect(f.relPath.startsWith('/')).toBe(false);
    }
  });
  it('every snippetNode snippetPath matches a snippetFile relPath', () => {
    for (const p of SEED) {
      const relPaths = new Set(p.snippetFiles.map((f) => f.relPath));
      for (const sn of p.snippetNodes) expect(relPaths.has(sn.snippetPath)).toBe(true);
    }
  });
});

describe('seed — buildSeedReleases', () => {
  it('produces one release per seed package', async () => {
    const releases = await buildSeedReleases();
    expect(releases).toHaveLength(SEED.length);
  });
  it('each manifest passes isPackageManifest', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) expect(isPackageManifest(r.manifest)).toBe(true);
  });
  it('each catalogEntry passes isCatalogEntry', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) expect(isCatalogEntry(r.catalogEntry)).toBe(true);
  });
  it('catalogEntryId === packageId (identity)', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) expect(r.manifest.catalogEntryId).toBe(r.manifest.packageId);
  });
  it('snippetContents relPath set === snippetFiles relPath set', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) {
      const contentPaths = new Set(r.snippetContents.map((s) => s.relPath));
      const filePaths = new Set(r.manifest.snippetFiles.map((f) => f.relPath));
      expect(contentPaths).toEqual(filePaths);
    }
  });
  it('protocolSha256 === SHA-256 of JSON.stringify(protocolDoc, null, 2) + newline', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) {
      const canonical = JSON.stringify(r.manifest.protocolDoc, null, 2) + '\n';
      expect(r.manifest.protocolSha256).toBe(await sha256String(canonical));
    }
  });
  it('each snippetFiles sha256 === SHA-256 of the matching content bytes', async () => {
    const releases = await buildSeedReleases();
    for (const r of releases) {
      const contentMap = new Map(r.snippetContents.map((s) => [s.relPath, s.content]));
      for (const f of r.manifest.snippetFiles) {
        expect(f.sha256).toBe(await sha256String(contentMap.get(f.relPath)!));
      }
    }
  });
  it('is deterministic — building twice produces byte-identical manifests', async () => {
    const a = await buildSeedReleases();
    const b = await buildSeedReleases();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('known-answer SHA-256 vector holds', async () => {
    expect(await sha256String('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
```

### src/generator/generate.ts — NEW
Deterministic generator: reads `buildSeedReleases()` (the shared seed — hashes already computed there), asserts mutual consistency + guard validity, and writes `site/catalog.json` (CatalogResponse) + `site/packages/<id>/releases/<ver>.json` (ReleaseResponse) + `site/packages/<id>/releases/<ver>/manifest.json` (`{manifest}` wrapper — NOT bare, NOT full release). File names use decoded `packageId`/`version` (literal UTF-8). Pinned `serverTime` for byte-stable `catalog.json`.

```typescript
// Deterministic static artifact generator (D4 — commit-and-gate). Reads the shared seed
// (buildSeedReleases is the source of truth — the hashes are already computed there),
// asserts mutual consistency + guard validity, and writes the three route artifacts under
// site/: catalog.json (CatalogResponse), per-release release .json (ReleaseResponse), and
// per-release manifest .json ({manifest} wrapper — NOT bare, NOT full release). File names
// use the decoded packageId/version (literal UTF-8) so Cloudflare Pages _redirects (which
// match the percent-encoded request path) resolve to them. Pinned serverTime for byte-stable
// catalog.json. D7 (Cloudflare Pages serving) consumes these via _redirects + 404.html + _headers.

import fs from 'fs';
import path from 'path';
import { buildSeedReleases, SEED_SERVER_TIME } from '../seed/seed';
import { isCatalogResponse, isReleaseResponse } from '../wire-types/registry-model';
import { isPackageManifest } from '../wire-types/library-model';

const SITE_DIR = 'site';

function assertCondition(cond: boolean, message: string): void {
  if (!cond) throw new Error(`[generator] ${message}`);
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** Generate the static site artifacts from the shared seed. Deterministic.
 *  @param outDir Output directory (default 'site'; tests pass a temp dir). */
export async function generate(outDir: string = SITE_DIR): Promise<void> {
  const releases = await buildSeedReleases();
  const entries = [];
  for (const r of releases) {
    const { manifest, snippetContents, catalogEntry } = r;
    // Mutual-consistency assertions (defense-in-depth; the seed already guarantees these).
    assertCondition(manifest.catalogEntryId === manifest.packageId, `catalogEntryId !== packageId for ${manifest.packageId}`);
    assertCondition(manifest.packageId === catalogEntry.packageId, `manifest.packageId !== catalogEntry.packageId for ${manifest.packageId}`);
    assertCondition(manifest.releaseVersion === catalogEntry.latestVersion, `releaseVersion !== latestVersion for ${manifest.packageId}`);
    const contentPaths = new Set(snippetContents.map((s) => s.relPath));
    const filePaths = new Set(manifest.snippetFiles.map((f) => f.relPath));
    assertCondition(contentPaths.size === filePaths.size && [...contentPaths].every((p) => filePaths.has(p)), `snippetContents/snippetFiles relPath mismatch for ${manifest.packageId}`);

    // Guard validation (the artifacts must pass the plugin's frozen guards).
    const releaseBody = { manifest, snippetContents };
    assertCondition(isReleaseResponse(releaseBody), `release body fails isReleaseResponse for ${manifest.packageId}`);
    assertCondition(isPackageManifest(manifest), `manifest fails isPackageManifest for ${manifest.packageId}`);
    const manifestOnlyBody = { manifest };

    // Write release .json: site/packages/<id>/releases/<ver>.json (ReleaseResponse).
    writeJson(path.join(outDir, 'packages', manifest.packageId, 'releases', `${manifest.releaseVersion}.json`), releaseBody);
    // Write manifest-only .json: site/packages/<id>/releases/<ver>/manifest.json ({manifest} wrapper).
    writeJson(path.join(outDir, 'packages', manifest.packageId, 'releases', manifest.releaseVersion, 'manifest.json'), manifestOnlyBody);

    entries.push(catalogEntry);
  }
  // Write catalog.json: { entries, serverTime } (CatalogResponse — NO wire sentinel; the client stamps it).
  const catalogBody = { entries, serverTime: SEED_SERVER_TIME };
  assertCondition(isCatalogResponse(catalogBody), 'catalog body fails isCatalogResponse');
  writeJson(path.join(outDir, 'catalog.json'), catalogBody);
}

// CLI entrypoint (runs only when invoked as the bundled script, not when imported by tests).
if (process.argv[1]?.endsWith('generate.cjs')) {
  generate().catch((e) => { console.error(e); process.exit(1); });
}
```

### __tests__/generate.test.ts — NEW
Generator output validity: every emitted file passes the backend's `isCatalogResponse`/`isReleaseResponse`/`isPackageManifest` (the `{manifest}` wrapper); identity === path === catalog entry; `snippetContents` relPath set === `snippetFiles` relPath set; `catalogEntryId === packageId`; running the generator twice produces byte-identical output (determinism — raw bytes across ALL files).

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generate } from '../src/generator/generate';
import { isCatalogResponse, isReleaseResponse } from '../src/wire-types/registry-model';
import { isPackageManifest } from '../src/wire-types/library-model';
import { buildSeedReleases, SEED_SERVER_TIME } from '../src/seed/seed';

let outDir: string;
beforeEach(() => { outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-')); });
afterEach(() => { fs.rmSync(outDir, { recursive: true, force: true }); });
function readJson(p: string): unknown { return JSON.parse(fs.readFileSync(p, 'utf8')); }

describe('generator — output validity', () => {
  it('writes site/catalog.json that passes isCatalogResponse', async () => {
    await generate(outDir);
    expect(isCatalogResponse(readJson(path.join(outDir, 'catalog.json')))).toBe(true);
  });
  it('writes one release .json + one manifest .json per seed package, all passing guards', async () => {
    const releases = await buildSeedReleases();
    await generate(outDir);
    for (const r of releases) {
      const releasePath = path.join(outDir, 'packages', r.manifest.packageId, 'releases', `${r.manifest.releaseVersion}.json`);
      const manifestPath = path.join(outDir, 'packages', r.manifest.packageId, 'releases', r.manifest.releaseVersion, 'manifest.json');
      expect(fs.existsSync(releasePath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(isReleaseResponse(readJson(releasePath))).toBe(true);
      expect(isPackageManifest((readJson(manifestPath) as { manifest: unknown }).manifest)).toBe(true);
    }
  });
  it('release manifest identity === path segments === catalog entry', async () => {
    const releases = await buildSeedReleases();
    await generate(outDir);
    const catalog = readJson(path.join(outDir, 'catalog.json')) as { entries: Array<{ packageId: string; latestVersion: string }> };
    for (const r of releases) {
      const releasePath = path.join(outDir, 'packages', r.manifest.packageId, 'releases', `${r.manifest.releaseVersion}.json`);
      const body = readJson(releasePath) as { manifest: { packageId: string; releaseVersion: string } };
      expect(body.manifest.packageId).toBe(r.manifest.packageId);
      expect(body.manifest.releaseVersion).toBe(r.manifest.releaseVersion);
      const entry = catalog.entries.find((e) => e.packageId === r.manifest.packageId);
      expect(entry).toBeDefined();
      expect(entry!.latestVersion).toBe(r.manifest.releaseVersion);
    }
  });
  it('catalog serverTime === SEED_SERVER_TIME (pinned, byte-stable)', async () => {
    await generate(outDir);
    const catalog = readJson(path.join(outDir, 'catalog.json')) as { serverTime: string };
    expect(catalog.serverTime).toBe(SEED_SERVER_TIME);
  });
  it('Cyrillic + space packageIds produce literal-UTF-8-named files (FR3)', async () => {
    await generate(outDir);
    expect(fs.existsSync(path.join(outDir, 'packages', 'КТ-грудная-клетка', 'releases', '1.0.0.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'packages', 'КТ-грудная-клетка', 'releases', '1.0.0', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'packages', 'chest ct', 'releases', '1.0.0.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'packages', 'chest ct', 'releases', '1.0.0', 'manifest.json'))).toBe(true);
  });
  it('the manifest-only route body is exactly { manifest } (NOT bare, NOT full release)', async () => {
    await generate(outDir);
    const manifestOnly = readJson(path.join(outDir, 'packages', 'chest-ct', 'releases', '1.0.0', 'manifest.json')) as Record<string, unknown>;
    expect(Object.keys(manifestOnly)).toEqual(['manifest']);
  });
  it('is deterministic — generating twice produces byte-identical files (raw bytes, ALL files)', async () => {
    await generate(outDir);
    const outDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
    try {
      await generate(outDir2);
      const walk = (dir: string): string[] => {
        const out: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) out.push(...walk(full));
          else out.push(full);
        }
        return out;
      };
      const files = walk(outDir);
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        const rel = path.relative(outDir, f);
        const f2 = path.join(outDir2, rel);
        expect(fs.existsSync(f2)).toBe(true);
        expect(fs.readFileSync(f, 'utf8')).toBe(fs.readFileSync(f2, 'utf8'));
      }
    } finally {
      fs.rmSync(outDir2, { recursive: true, force: true });
    }
  });
});
```

### site/_redirects — NEW
Two 200-rewrite rules (extension-less → `.json`): `/catalog /catalog.json 200` and `/packages/* /packages/:splat.json 200` (one splat covers both the release and manifest routes).

```
/catalog /catalog.json 200
/packages/* /packages/:splat.json 200
```

### site/404.html — NEW
Mandatory top-level 404 page (prevents SPA fallback from serving `200 + index.html` for unknown release paths — without it the client classifies `unavailable` not `not-found`). Minimal valid HTML.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>404 — Not Found</title>
</head>
<body>
<h1>404 — Not Found</h1>
<p>The requested library resource does not exist.</p>
</body>
</html>
```

### site/_headers — NEW
Immutable cache for release JSON: `/packages/* Cache-Control: public, max-age=86400, immutable`. (`/catalog` keeps the default `must-revalidate`.)

```
/packages/*
  Cache-Control: public, max-age=86400, immutable
```

> **Generated `site/*.json` are build outputs** (D4 — commit-and-gate): `site/catalog.json` + `site/packages/<id>/releases/<ver>.json` + `site/packages/<id>/releases/<ver>/manifest.json` are produced by `npm run generate` (the generator above) from the shared seed — deterministic, committed to the repo, and verified byte-identical by Slice 5's regen-diff gate. They are NOT hand-written Architecture files (the Architecture contains the generator that produces them).

### scripts/lib/probe-descriptor.mjs — NEW
Probe harness: derives a canonical shape descriptor from a guard function's BEHAVIOR (no hand-written descriptors) by probing a valid seed + targeted mutations — requiredness (delete-probe), literal vs string/number/boolean vs `unknown` (a field is `unknown` iff the guard accepts a non-typed value, i.e. it ignores the field), bare `array` (only `Array.isArray`) vs `array-of` (a `[null]` element is rejected) vs `unknown` (a non-array is accepted), nested-object recursion (inlined, no `$ref`), openness (an extra key is accepted). Seed self-check (`guard(seed) === true`). Implemented taxonomy: `object{open,fields[]}` | `array` | `array-of{element}` | `string` | `number` | `boolean` | `literal{value}` | `null` | `unknown`.

```js
// Probe harness (D5 — probe-based parity gate). Derives a canonical shape descriptor from a
// guard function's BEHAVIOR by probing it with a valid seed + targeted mutations. No
// hand-written descriptors: the harness derives the descriptor identically for the plugin's
// compiled guards (at the pinned rev) and the backend's own guards, so the diff catches
// real wire-type drift. The seed self-verifies (guard(seed) === true) so a stale seed fails
// loudly. Descriptor scope = the GUARD's behavior, not the interface (declared-but-unenforced
// fields derive as { required: false, kind: 'unknown' } — the guard ignores them — and match
// on both sides).
//
// Implemented kind taxonomy: object{open, fields[]} | array | array-of{element} | string |
// number | boolean | literal{value} | null | unknown. Records = open objects with no
// constrained fields; nested objects are inlined (no $ref kind); multi-value unions are not
// separately distinguished (no current guard enforces a union). Each field: { name, required, kind }.

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function getPath(obj, path) { let cur = obj; for (const p of path) cur = cur[p]; return cur; }
function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}

function probe(guard, seed, path, value) {
  const v = clone(seed);
  setPath(v, path, value);
  try { return guard(v) === true; } catch { return false; }
}

const EXTRA_KEY = '__probe_extra_key_xyz__';

function deriveObject(guard, seed, path) {
  const obj = getPath(seed, path);
  const fields = [];
  for (const field of Object.keys(obj)) {
    const fieldPath = [...path, field];
    const required = !probe(guard, seed, fieldPath, undefined);
    const kind = deriveKind(guard, seed, fieldPath);
    fields.push({ name: field, required, kind });
  }
  const open = probe(guard, seed, [...path, EXTRA_KEY], 'x');
  return { kind: 'object', open, fields };
}

function deriveKind(guard, seed, path) {
  const value = getPath(seed, path);
  if (value === null) {
    if (probe(guard, seed, path, 'not-null')) return { kind: 'unknown' }; // guard ignores the field
    return { kind: 'null' };
  }
  if (Array.isArray(value)) {
    if (probe(guard, seed, path, 'not-an-array')) return { kind: 'unknown' }; // guard ignores the field
    if (probe(guard, seed, path, [null])) return { kind: 'array' }; // bare array (only Array.isArray)
    const elem = value[0];
    if (elem !== null && typeof elem === 'object') {
      return { kind: 'array-of', element: deriveObject(guard, seed, [...path, 0]) };
    }
    return { kind: 'array-of', element: derivePrimitive(guard, seed, [...path, 0], elem) };
  }
  if (typeof value === 'object') {
    if (probe(guard, seed, path, 'not-an-object')) return { kind: 'unknown' }; // guard ignores the field
    return deriveObject(guard, seed, path);
  }
  return derivePrimitive(guard, seed, path, value);
}

function derivePrimitive(guard, seed, path, original) {
  if (typeof original === 'string') {
    if (!probe(guard, seed, path, '__probe_other_string__')) return { kind: 'literal', value: original };
    if (probe(guard, seed, path, 42)) return { kind: 'unknown' }; // guard ignores the field
    return { kind: 'string' };
  }
  if (typeof original === 'number') {
    if (!probe(guard, seed, path, original + 1)) return { kind: 'literal', value: original };
    if (probe(guard, seed, path, 'not-a-number')) return { kind: 'unknown' };
    return { kind: 'number' };
  }
  if (typeof original === 'boolean') {
    if (!probe(guard, seed, path, !original)) return { kind: 'literal', value: original };
    if (probe(guard, seed, path, 'not-a-boolean')) return { kind: 'unknown' }; // guard ignores the field
    return { kind: 'boolean' };
  }
  return { kind: 'unknown' };
}

/** Derive the shape descriptor for the object the guard accepts, from a valid seed.
 *  @param {(value: unknown) => boolean} guard
 *  @param {object} seed a value the guard accepts
 *  @param {string} name for error messages
 *  @returns {{ kind: 'object', open: boolean, fields: Array<{name:string, required:boolean, kind:unknown}> }} */
export function deriveDescriptor(guard, seed, name) {
  if (typeof guard !== 'function') throw new Error(`[${name}] guard is not a function`);
  if (typeof seed !== 'object' || seed === null) throw new Error(`[${name}] seed is not an object`);
  let accepted;
  try { accepted = guard(seed) === true; } catch (e) { throw new Error(`[${name}] guard threw on seed: ${e.message}`); }
  if (!accepted) throw new Error(`[${name}] seed is not accepted by the guard (stale seed)`);
  return deriveObject(guard, seed, []);
}
```

### scripts/check-wire-parity.mjs — NEW
Cross-repo parity gate: read `plugin-pin.txt`, verify the plugin checkout (`PLUGIN_REPO_PATH`, default `../RadiProtocol`) is at that rev, esbuild-bundle the plugin's 3 guard files + the backend's 3 guard files + the backend's seed, derive a shape descriptor from each of the 5 served guards' BEHAVIOR on BOTH sides (probe-descriptor.mjs) using the same enriched seeds, diff (`JSON.stringify(pluginDesc) !== JSON.stringify(backendDesc)` → `fail()`), `process.exit(1)`. Served-types only: `isCatalogSnapshot`/`isInstalledRecord` excluded. Reuses the `errors`/`fail()`/`info()` skeleton from `check-consistency.mjs`. The plugin repo is untouched (read-only).

```js
#!/usr/bin/env node
// Cross-repo wire-type parity gate (D5 — probe-based; D9 — backend CI, plugin pinned).
// Reads plugin-pin.txt, verifies the plugin checkout (PLUGIN_REPO_PATH, default ../RadiProtocol)
// is at that rev, esbuild-bundles the plugin's guard files + the backend's guard files + the
// backend's seed, derives a shape descriptor from each served guard's BEHAVIOR on BOTH sides,
// and diffs. Fails on any drift (missing guards or differing descriptors — sentinels,
// requiredness, array-element shapes, openness). Reuses the errors/fail()/exit skeleton from
// check-consistency.mjs. The plugin repo is untouched (read-only checkout).

import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';
import { deriveDescriptor } from './lib/probe-descriptor.mjs';

const errors = [];
function fail(message) { errors.push(`❌ ${message}`); }
function info(message) { console.log(`  ${message}`); }

// Served wire-type guards the gate compares. Client-only guards (isCatalogSnapshot,
// isInstalledRecord) are intentionally excluded — not served on the wire.
const GUARD_NAMES = ['isCatalogResponse', 'isReleaseResponse', 'isPackageManifest', 'isCatalogEntry', 'isProtocolDocumentV1'];

const require = createRequire(import.meta.url);

const pluginPin = readFileSync('plugin-pin.txt', 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))[0];
if (!pluginPin) { console.error('plugin-pin.txt is empty'); process.exit(1); }

const pluginRepoPath = process.env.PLUGIN_REPO_PATH ?? '../RadiProtocol';
if (!existsSync(path.join(pluginRepoPath, 'package.json'))) {
  fail(`plugin repo not found at ${pluginRepoPath} (set PLUGIN_REPO_PATH)`);
}

try {
  const pluginHead = execFileSync('git', ['-C', pluginRepoPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const pinnedHead = execFileSync('git', ['-C', pluginRepoPath, 'rev-parse', pluginPin], { encoding: 'utf8' }).trim();
  if (pluginHead !== pinnedHead) fail(`plugin checkout is at ${pluginHead} but plugin-pin.txt is ${pluginPin} (→ ${pinnedHead}); check out the pinned rev`);
  else info(`OK: plugin checkout at pinned rev ${pluginPin} (${pluginHead})`);
} catch (e) {
  fail(`could not verify plugin rev: ${e.message}`);
}

const tmps = [];
async function bundleModule(entryPath) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'parity-'));
  const outfile = path.join(tmp, 'bundle.cjs');
  await esbuild.build({ entryPoints: [entryPath], bundle: true, format: 'cjs', platform: 'node', target: 'es2022', outfile, logLevel: 'silent', write: true });
  tmps.push(tmp);
  return require(outfile);
}

async function loadGuards(guardFiles) {
  const guards = {};
  for (const f of guardFiles) {
    if (!existsSync(f)) { fail(`guard file not found: ${f}`); continue; }
    const mod = await bundleModule(f);
    for (const [k, v] of Object.entries(mod)) if (typeof v === 'function') guards[k] = v;
  }
  return guards;
}

try {
  console.log('\n▸ Bundling plugin + backend guards + seed…');
  const pluginGuards = await loadGuards([
    path.join(pluginRepoPath, 'src/library/registry-model.ts'),
    path.join(pluginRepoPath, 'src/library/library-model.ts'),
    path.join(pluginRepoPath, 'src/protocol/protocol-document.ts'),
  ]);
  const backendGuards = await loadGuards([
    'src/wire-types/registry-model.ts',
    'src/wire-types/library-model.ts',
    'src/wire-types/protocol-document.ts',
  ]);
  const seedMod = await bundleModule('src/seed/seed.ts');
  const releases = await seedMod.buildSeedReleases();
  const SEED_SERVER_TIME = seedMod.SEED_SERVER_TIME;
  const r0 = releases[0];
  // Probe seeds include optional declared fields (CatalogEntry.summary; ProtocolDocumentV1's
  // selfCheckEnabled/selfCheckItems/viewport) so the harness probes them — the guard ignores
  // them, so they derive as { required:false, kind:'unknown' } on both sides → match, AND a
  // future enforcement drift would change the descriptor → caught.
  const seeds = {
    isCatalogResponse: { entries: releases.map((r) => r.catalogEntry), serverTime: SEED_SERVER_TIME },
    isReleaseResponse: { manifest: r0.manifest, snippetContents: r0.snippetContents },
    isPackageManifest: r0.manifest,
    isCatalogEntry: { ...r0.catalogEntry, summary: 'A summary.' },
    isProtocolDocumentV1: {
      ...r0.manifest.protocolDoc,
      selfCheckEnabled: true,
      selfCheckItems: ['Confirm completion'],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };

  console.log('\n▸ Deriving descriptors (plugin vs backend)…');
  function deriveAll(guards) {
    const out = {};
    for (const name of GUARD_NAMES) {
      const guard = guards[name];
      if (typeof guard !== 'function') { fail(`${name} not exported on this side`); continue; }
      try { out[name] = deriveDescriptor(guard, seeds[name], name); }
      catch (e) { fail(e.message); }
    }
    return out;
  }
  const pluginDescs = deriveAll(pluginGuards);
  const backendDescs = deriveAll(backendGuards);

  console.log('\n▸ Diffing descriptors…');
  for (const name of GUARD_NAMES) {
    if (!pluginDescs[name] || !backendDescs[name]) continue;
    const a = JSON.stringify(pluginDescs[name]);
    const b = JSON.stringify(backendDescs[name]);
    if (a !== b) fail(`guard "${name}" descriptors differ:\n    plugin:  ${a}\n    backend: ${b}`);
    else info(`OK: ${name} descriptors match`);
  }
} catch (e) {
  fail(`parity gate error: ${e.message}`);
} finally {
  for (const t of tmps) rmSync(t, { recursive: true, force: true });
}

console.log('\n═══════════════════════════════════════════════');
if (errors.length > 0) {
  console.log(`❌ FAILED: ${errors.length} error(s)`);
  errors.forEach((e) => console.log(`  ${e}`));
  process.exit(1);
}
console.log('✅ wire-type parity holds (plugin ↔ backend)');
```

### plugin-pin.txt — NEW
The pinned plugin git revision (`4c680bdef5d9b485369bf246c09e21873cb41212`) the backend's parity gate verifies the plugin checkout is at. Updated deliberately when moving to a newer plugin rev (re-run `npm run check:wire-parity`, fix any drift, commit the new pin).

```
# The plugin git revision (RadiProtocol) this backend's wire types are parity-checked against.
# Update deliberately: check out the plugin at the new rev, run `npm run check:wire-parity`,
# fix any drift, then commit the new pin. The gate verifies the plugin checkout is at exactly this rev.
# Use a FULL SHA (not an abbreviated one) so actions/checkout's `ref:` reliably resolves a commit.
4c680bdef5d9b485369bf246c09e21873cb41212
```

### __tests__/contract.test.ts — NEW
End-to-end contract: (a) encoding/identity round-trip — a Cyrillic + a space `packageId` percent-encoded (`encodeURIComponent`) → `decodeURIComponent` round-trip is lossless (`decodedId === id`) → the literal-UTF-8-named fixture file exists + the returned `manifest.packageId`/`releaseVersion` equal the decoded request (FR3); (b) 404 behavior — an unknown release has NO generated `.json` (→ `_redirects` falls through) + `site/404.html`/`_redirects` are committed (the real-404 guard); (c) every generated file passes the BACKEND's duplicated guards (byte-for-byte == the plugin's; the parity gate (Slice 4) verifies the duplication in CI, so "passes the backend's guards" + "parity gate green" ⟺ "passes the plugin's guards" — the test does NOT redundantly re-bundle the plugin's guards).

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generate } from '../src/generator/generate';
import { isCatalogResponse, isReleaseResponse } from '../src/wire-types/registry-model';
import { isPackageManifest } from '../src/wire-types/library-model';
import { buildSeedReleases } from '../src/seed/seed';

let siteDir: string;
beforeEach(() => { siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-')); });
afterEach(() => { fs.rmSync(siteDir, { recursive: true, force: true }); });

describe('contract — the three read routes (simulated against the generated site/)', () => {
  it('GET /catalog → CatalogResponse passing isCatalogResponse', async () => {
    await generate(siteDir);
    const catalog = JSON.parse(fs.readFileSync(path.join(siteDir, 'catalog.json'), 'utf8'));
    expect(isCatalogResponse(catalog)).toBe(true);
  });

  it('GET /packages/{enc(id)}/releases/{enc(ver)} → ReleaseResponse; the encode→decode round-trip resolves to the literal-UTF-8 file + identity matches (FR3)', async () => {
    await generate(siteDir);
    const releases = await buildSeedReleases();
    for (const r of releases) {
      const id = r.manifest.packageId;
      const ver = r.manifest.releaseVersion;
      const encId = encodeURIComponent(id);
      const encVer = encodeURIComponent(ver);
      if (id !== 'chest-ct') expect(encId).not.toBe(id); // encoding non-trivial for Cyrillic + space
      const decodedId = decodeURIComponent(encId);
      const decodedVer = decodeURIComponent(encVer);
      expect(decodedId).toBe(id);   // the percent-encode → decode round-trip is lossless
      expect(decodedVer).toBe(ver);
      const releasePath = path.join(siteDir, 'packages', decodedId, 'releases', `${decodedVer}.json`);
      expect(fs.existsSync(releasePath)).toBe(true);
      const body = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
      expect(isReleaseResponse(body)).toBe(true);
      expect(body.manifest.packageId).toBe(id);
      expect(body.manifest.releaseVersion).toBe(ver);
    }
  });

  it('GET /packages/{enc(id)}/releases/{enc(ver)}/manifest → { manifest } wrapper; the encode→decode round-trip resolves to the literal-UTF-8 file + identity matches', async () => {
    await generate(siteDir);
    const releases = await buildSeedReleases();
    for (const r of releases) {
      const id = r.manifest.packageId;
      const ver = r.manifest.releaseVersion;
      const decodedId = decodeURIComponent(encodeURIComponent(id));
      const decodedVer = decodeURIComponent(encodeURIComponent(ver));
      expect(decodedId).toBe(id);   // the percent-encode → decode round-trip is lossless
      expect(decodedVer).toBe(ver);
      const manifestPath = path.join(siteDir, 'packages', decodedId, 'releases', decodedVer, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const body = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { manifest: unknown };
      expect(isPackageManifest(body.manifest)).toBe(true);
      expect((body.manifest as { packageId: string; releaseVersion: string }).packageId).toBe(id);
      expect((body.manifest as { packageId: string; releaseVersion: string }).releaseVersion).toBe(ver);
      expect(Object.keys(body)).toEqual(['manifest']); // the wrapper, NOT bare, NOT full release
    }
  });

  it('404 behavior: an unknown release has NO generated .json (→ _redirects falls through) + site/404.html + _redirects are committed', async () => {
    await generate(siteDir);
    expect(fs.existsSync(path.join(siteDir, 'packages', 'unknown', 'releases', '9.9.9.json'))).toBe(false);
    expect(fs.existsSync(path.join(siteDir, 'packages', 'unknown', 'releases', '9.9.9', 'manifest.json'))).toBe(false);
    expect(fs.existsSync('site/404.html')).toBe(true);
    expect(fs.existsSync('site/_redirects')).toBe(true);
  });

  it('every generated file passes the backend guards (== plugin guards, per the parity gate)', async () => {
    await generate(siteDir);
    const releases = await buildSeedReleases();
    const catalog = JSON.parse(fs.readFileSync(path.join(siteDir, 'catalog.json'), 'utf8'));
    expect(isCatalogResponse(catalog)).toBe(true);
    for (const r of releases) {
      const releaseBody = JSON.parse(fs.readFileSync(path.join(siteDir, 'packages', r.manifest.packageId, 'releases', `${r.manifest.releaseVersion}.json`), 'utf8'));
      expect(isReleaseResponse(releaseBody)).toBe(true);
      const manifestBody = JSON.parse(fs.readFileSync(path.join(siteDir, 'packages', r.manifest.packageId, 'releases', r.manifest.releaseVersion, 'manifest.json'), 'utf8'));
      expect(isPackageManifest(manifestBody.manifest)).toBe(true);
    }
  });
});
```

### scripts/check-regen-diff.mjs — NEW
Regenerate-and-diff gate: bundle the generator into a SEPARATE temp dir + run it into another temp dir (so the bundle isn't treated as a generated artifact), raw-BYTE diff (`Buffer.equals`) every generated file against the committed `site/`, EXCLUDING the hand-written static config (`_redirects`/`404.html`/`_headers`), `fail()` on any difference, `process.exit(1)`. Reuses the `errors`/`fail()` skeleton.

```js
#!/usr/bin/env node
// Regenerate-and-diff gate (D4 — commit-and-gate). Bundles the generator into a SEPARATE temp
// dir + runs it into another temp dir (so the bundle isn't treated as a generated artifact),
// walks the generated tree, and raw-BYTE diffs every generated file against the committed
// site/. The hand-written static config (_redirects / 404.html / _headers from Slice 3) is
// EXCLUDED. Fails on any difference. Reuses the errors/fail()/exit skeleton from check-consistency.mjs.

import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

const errors = [];
function fail(message) { errors.push(`❌ ${message}`); }
function info(message) { console.log(`  ${message}`); }
const require = createRequire(import.meta.url);

const SITE_DIR = 'site';
const STATIC_CONFIG = new Set(['_redirects', '_headers', '404.html']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let bundleDir = '';
let genDir = '';
try {
  bundleDir = mkdtempSync(path.join(tmpdir(), 'regen-bundle-'));
  genDir = mkdtempSync(path.join(tmpdir(), 'regen-gen-'));
  const bundleOut = path.join(bundleDir, 'generate.cjs');
  await esbuild.build({ entryPoints: ['src/generator/generate.ts'], bundle: true, format: 'cjs', platform: 'node', target: 'es2022', outfile: bundleOut, logLevel: 'silent', write: true });
  const generateMod = require(bundleOut); // CLI guard fires only for generate.cjs-named argv[1]; call generate() directly.
  await generateMod.generate(genDir);

  const genSet = new Map(walk(genDir).map((f) => [path.relative(genDir, f), f]));
  const committedSet = new Map((existsSync(SITE_DIR) ? walk(SITE_DIR) : []).map((f) => [path.relative(SITE_DIR, f), f]));

  for (const [rel] of genSet) if (!committedSet.has(rel)) fail(`generated file not committed: ${rel}`);
  for (const [rel] of committedSet) {
    if (STATIC_CONFIG.has(rel)) continue; // hand-written site config (Slice 3), not generated
    if (!genSet.has(rel)) fail(`committed file not regenerated (stale?): ${rel}`);
  }
  for (const [rel, genAbs] of genSet) {
    const comAbs = committedSet.get(rel);
    if (comAbs && !readFileSync(genAbs).equals(readFileSync(comAbs))) fail(`file differs from regenerated: ${rel}`);
  }
  if (errors.length === 0) info(`OK: site/ matches regenerated output (${genSet.size} generated files)`);
} catch (e) {
  fail(`regen-diff error: ${e.message}`);
} finally {
  if (bundleDir) rmSync(bundleDir, { recursive: true, force: true });
  if (genDir) rmSync(genDir, { recursive: true, force: true });
}

console.log('\n═══════════════════════════════════════════════');
if (errors.length > 0) {
  console.log(`❌ FAILED: ${errors.length} error(s)`);
  errors.forEach((e) => console.log(`  ${e}`));
  process.exit(1);
}
console.log('✅ site/ is byte-identical to the regenerated output');
```

### .github/workflows/ci.yml — NEW
Backend CI: checkout self → read `plugin-pin.txt` (full SHA) → checkout the plugin at the pinned rev (read-only, into `plugin-checkout/`) → `npm ci` (requires the committed `package-lock.json`) → typecheck → regen-diff → wire-parity (`PLUGIN_REPO_PATH=plugin-checkout`) → `npm test`. The plugin repo's CI is untouched.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout backend
        uses: actions/checkout@v5

      - name: Read the pinned plugin rev
        id: pin
        run: echo "pin=$(grep -v '^#' plugin-pin.txt | grep -v '^$' | head -1 | tr -d '[:space:]')" >> "$GITHUB_OUTPUT"

      - name: Checkout the plugin at the pinned rev (read-only; the plugin repo is untouched)
        uses: actions/checkout@v5
        with:
          # Set the PLUGIN_REPO repository variable to the plugin's GitHub slug (e.g. owner/RadiProtocol).
          repository: ${{ vars.PLUGIN_REPO || 'RadiProtocol/RadiProtocol' }}
          ref: ${{ steps.pin.outputs.pin }}
          path: plugin-checkout

      - name: Install
        run: npm ci  # requires a committed package-lock.json (generated by the developer's `npm install`)

      - name: Typecheck
        run: npm run typecheck

      - name: Regen-diff (site/ matches the generator output)
        run: npm run check:regen-diff

      - name: Wire-type parity (plugin ↔ backend, at the pinned rev)
        run: npm run check:wire-parity
        env:
          PLUGIN_REPO_PATH: plugin-checkout

      - name: Tests (seed + generator + contract)
        run: npm test
```

## Slices

### Slice 1: Repo scaffold + duplicated wire types + integrity

**Files**: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `src/wire-types/protocol-document.ts`, `src/wire-types/library-model.ts`, `src/wire-types/registry-model.ts`, `src/wire-types/integrity.ts`, `__tests__/wire-types.test.ts`

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Wire-type guard tests pass: `npx vitest run __tests__/wire-types.test.ts`
- [ ] Known-answer SHA-256 vector holds: `sha256String('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'` (asserted in __tests__/wire-types.test.ts)
- [ ] isPackageManifest rejects null author; isCatalogEntry rejects missing author (the required/optional asymmetry asserted in wire-types.test.ts)

#### Manual Verification:
- [ ] The duplicated `src/wire-types/protocol-document.ts` createEmptyProtocolDocument key order matches the plugin's `src/protocol/protocol-document.ts:131-165` (the hashed bytes for protocolSha256)
- [ ] No `obsidian` imports in `src/wire-types/`: `grep -r "obsidian" src/wire-types/` returns nothing
- [ ] The `PackageManifest` interface in `src/wire-types/library-model.ts` has no `signature`/`ed25519` field (D11 — visual inspection; the integrity.ts header COMMENT mentions "ed25519 deferred" which is the deferral note, not a field)

### Slice 2: Shared seed

**Files**: `src/seed/seed.ts`, `__tests__/seed.test.ts`

#### Automated Verification:
- [ ] Seed tests pass: `npx vitest run __tests__/seed.test.ts`
- [ ] Each seed manifest passes `isPackageManifest` + each catalogEntry passes `isCatalogEntry` (asserted in __tests__/seed.test.ts)
- [ ] `catalogEntryId === packageId` and `snippetContents` relPath set === `snippetFiles` relPath set (asserted)
- [ ] `protocolSha256 === SHA-256 of JSON.stringify(protocolDoc, null, 2) + '\n'` and each snippet sha256 matches its content bytes (asserted)
- [ ] `buildSeedReleases` is deterministic — building twice produces byte-identical output (asserted)

#### Manual Verification:
- [ ] The seed includes a Cyrillic `packageId` (`КТ-грудная-клетка`) + one with a space (`chest ct`) for FR3
- [ ] All `packageId`s and `releaseVersion`s are slash-free (a `%2F` would decode into a path separator)
- [ ] Pinned timestamps + explicit `startNodeId` (no `Math.random` in the seed path) → byte-stable deploys

### Slice 3: Deterministic generator + Cloudflare site config

**Files**: `src/generator/generate.ts`, `__tests__/generate.test.ts`, `site/_redirects`, `site/404.html`, `site/_headers`

#### Automated Verification:
- [ ] Generator tests pass: `npx vitest run __tests__/generate.test.ts`
- [ ] Every generated file passes the guards: `catalog.json` → `isCatalogResponse`; release `.json` → `isReleaseResponse`; manifest `.json` → `isPackageManifest` (asserted in generate.test.ts)
- [ ] Release manifest identity === path segments === catalog entry (asserted)
- [ ] Cyrillic + space packageIds produce literal-UTF-8-named files (asserted)
- [ ] The manifest-only route body is exactly `{ manifest }` (not bare, not full release) (asserted)
- [ ] Determinism: generating twice produces byte-identical files — raw bytes across ALL files (asserted)

#### Manual Verification:
- [ ] `site/_redirects` has exactly the 2 splat 200-rewrite rules (`/catalog /catalog.json 200`, `/packages/* /packages/:splat.json 200`)
- [ ] `site/404.html` exists at the project root (mandatory — without it Cloudflare serves 200+index.html for unknown release paths → client classifies `unavailable` not `not-found`)
- [ ] `site/_headers` sets `/packages/* Cache-Control: public, max-age=86400, immutable`
- [ ] `npm run generate` writes `site/catalog.json` + `site/packages/<id>/releases/<ver>.json` + `site/packages/<id>/releases/<ver>/manifest.json` with literal-UTF-8 names

### Slice 4: Cross-repo parity gate

**Files**: `scripts/lib/probe-descriptor.mjs`, `scripts/check-wire-parity.mjs`, `plugin-pin.txt`

#### Automated Verification:
- [ ] Parity gate passes (no drift): `npm run check:wire-parity` (with `PLUGIN_REPO_PATH` set to a plugin checkout at the pinned rev) → exit 0
- [ ] All 5 served guards are derived on both sides (`isCatalogResponse`, `isReleaseResponse`, `isPackageManifest`, `isCatalogEntry`, `isProtocolDocumentV1`) — `OK: <name> descriptors match` printed for each
- [ ] `plugin-pin.txt` parses to a single non-comment rev (`4c680bdef5d9b485369bf246c09e21873cb41212`)

#### Manual Verification:
- [ ] Parity gate FAILS on drift: deliberately change a backend guard (flip a sentinel or a required-field check) → `npm run check:wire-parity` exits 1; revert → exits 0
- [ ] `plugin-pin.txt` contains a valid plugin rev (`4c680bdef5d9b485369bf246c09e21873cb41212`) + the plugin checkout (`PLUGIN_REPO_PATH`) is at that rev
- [ ] The gate probes BOTH the plugin's compiled guards AND the backend's guards behaviorally (no hand-written descriptors — `deriveDescriptor` probes each guard's behavior)
- [ ] Client-only guards (`isCatalogSnapshot`, `isInstalledRecord`) are NOT in `GUARD_NAMES` (served types only)
- [ ] The plugin repo is untouched (the gate only reads the plugin's guard .ts files at the pinned rev; no plugin source change)

### Slice 5: Contract tests + regen-diff + CI

**Files**: `__tests__/contract.test.ts`, `scripts/check-regen-diff.mjs`, `.github/workflows/ci.yml`

#### Automated Verification:
- [ ] All tests pass: `npm test` (runs the seed + generator + contract test suites)
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Regen-diff passes: `npm run check:regen-diff` (`site/` byte-identical to the generator output)
- [ ] Parity gate passes: `PLUGIN_REPO_PATH=<plugin checkout> npm run check:wire-parity`
- [ ] Full check passes: `npm run check` (typecheck + regen-diff + wire-parity + test)
- [ ] Contract tests pass: `npx vitest run __tests__/contract.test.ts` (encoding/identity round-trip + 404 + every generated file passes the backend guards)

#### Manual Verification:
- [ ] The CI workflow checks out the plugin at the pinned rev (read-only, into `plugin-checkout/`) + runs typecheck + regen-diff + wire-parity + tests; the `PLUGIN_REPO` repository variable is set to the plugin's GitHub slug; `package-lock.json` is committed (generated by the developer's `npm install`)
- [ ] `PLUGIN_REPO_PATH` (local) points to a plugin checkout at the pinned rev (`4c680bdef5d9b485369bf246c09e21873cb41212`)
- [ ] Deploy-time empirical test: `curl -sI https://<origin>/packages/%D0%9A.../releases/1.0.0` serves the Cyrillic `.json` with 200 + JSON content-type (the `_redirects` percent-encoding resolution — undocumented, verified on deploy)
- [ ] Deployed 404: `curl -sI https://<origin>/packages/unknown/releases/9.9.9` → 404 (FR3 not-found)
- [ ] http→https: `curl -sI http://<origin>/catalog` is redirected/rejected to https; `normalizeRegistryUrl('https://<origin>')` accepts it (FR15)
- [ ] p95 latency ≤ 2s: a multi-sample load test (e.g. 100 requests, take the 95th-percentile elapsed: `for i in $(seq 1 100); do curl -s -o /dev/null -w '%{time_total}\n' https://<origin>/catalog; done | sort -n | awk 'NR==95'`) → ≤ 2s (FR14)
- [ ] A release downloaded through the plugin installs atomically via the foundation installer (no missing-snippet validation error) — Phase-1 installer AC (manual, in Obsidian)
- [ ] With `libraryRegistryUrl` set to the origin, the plugin's `LibraryView` lists the seeded catalog anonymously (no auth prompt) — Phase-1 LibraryView AC (manual, in Obsidian)
- [ ] The plugin repo is untouched: the plugin's `npm run check` stays green; `grep -r "libraryRegistryUrl\|DEFAULT_REGISTRY_URL" src/` in the plugin returns only existing client code

## Desired End State
A developer clones the backend repo, runs `npm run generate` → `site/` is populated with `catalog.json` + `packages/.../*.json`; `npm run check:regen-diff` confirms no drift; `npm run check:wire-parity` confirms wire-type parity with the pinned plugin rev; `npm test` passes.

```bash
# Build + generate + verify (local)
npm run build
npm run generate          # writes site/catalog.json + site/packages/.../*.json
npm run check:regen-diff  # regenerates + diffs against committed site/ → exit 0
npm run check:wire-parity # probes plugin guards (pinned rev) vs backend guards → exit 0
npm test                  # seed + generator + contract tests → green
```

Deploy: push the repo (or point Cloudflare Pages at it); `site/` is served at the custom domain; `_redirects` rewrites extension-less paths to `.json`; `404.html` makes unknown releases return 404; `_headers` makes release JSON immutable.

In Obsidian (the shipped, untouched plugin):
```typescript
// The user sets one advanced setting:
settings.libraryRegistryUrl = 'https://registry.example.com'; // the Cloudflare Pages custom domain
// Open LibraryView → lists the seeded catalog anonymously (no auth prompt).
// Click Install on "КТ-грудная-клетка @ 1.0.0" →
//   fetchRelease('КТ-грудная-клетка', '1.0.0') GETs /packages/%D0%9A.../releases/1.0.0
//   → 200 ReleaseResponse, manifest.packageId === 'КТ-грудная-клетка' (identity match)
//   → installs atomically to library/КТ-грудная-клетка/1.0.0/ with no missing-snippet error.
// An unknown release → 404 → not-found (because site/404.html exists, not SPA fallback).
```

CI: on PR, the backend CI checks out the plugin at the pinned rev, regenerates `site/` + diffs against committed (fail on drift), runs the probe-based parity gate (fail on wire-type drift), runs contract tests. The plugin repo's `npm run check` stays green/untouched.

## File Map
```
package.json                                    # NEW — repo manifest, scripts, dev deps
tsconfig.json                                   # NEW — TS config (Node, strict)
esbuild.config.mjs                              # NEW — generic argv-driven TS→CJS bundler (generator); parity gate uses esbuild JS API directly
src/wire-types/protocol-document.ts             # NEW — duplicated ProtocolDocumentV1 + isProtocolDocumentV1 + createEmptyProtocolDocument + sentinels
src/wire-types/library-model.ts                 # NEW — duplicated PackageManifest + CatalogEntry + guards + PACKAGE_MANIFEST sentinels (served types only)
src/wire-types/registry-model.ts                # NEW — duplicated CatalogResponse + ReleaseResponse + guards
src/wire-types/integrity.ts                     # NEW — duplicated sha256String + verifyIntegrity (Web Crypto)
__tests__/wire-types.test.ts                    # NEW — wire-type guard behavior (accept/reject) + integrity known-answer + protocolSha256 canonical contract
src/seed/seed.ts                                # NEW — shared seed (Cyrillic + space packageIds, pinned timestamps)
__tests__/seed.test.ts                          # NEW — seed validity (guards pass, hashes correct, mutual consistency)
src/generator/generate.ts                       # NEW — deterministic generator (computes hashes, emits catalog + releases + manifests, asserts consistency)
__tests__/generate.test.ts                       # NEW — generator output validity + determinism
site/_redirects                                 # NEW — 2 splat 200-rewrite rules (extension-less → .json)
site/404.html                                   # NEW — mandatory top-level 404 (prevents SPA fallback)
site/_headers                                   # NEW — immutable cache for /packages/*
# Generated build outputs (produced by `npm run generate`, committed, verified byte-identical by Slice 5's regen-diff — NOT hand-written):
site/catalog.json                              # GENERATED — CatalogResponse (entries + serverTime)
site/packages/<id>/releases/<ver>.json         # GENERATED — ReleaseResponse (manifest + snippetContents)
site/packages/<id>/releases/<ver>/manifest.json # GENERATED — {manifest} wrapper
package-lock.json                              # GENERATED — lockfile (committed; generated by the developer's `npm install`; required by CI's `npm ci`)
scripts/lib/probe-descriptor.mjs                # NEW — probe harness (derive shape descriptor from a guard behaviorally)
scripts/check-wire-parity.mjs                   # NEW — cross-repo parity gate (compile plugin guards at pinned rev, probe both sides, diff)
plugin-pin.txt                                  # NEW — pinned plugin rev
__tests__/contract.test.ts                      # NEW — encoding/identity round-trip + 404 + both-guard-sets contract
scripts/check-regen-diff.mjs                    # NEW — regenerate-and-diff gate
.github/workflows/ci.yml                        # NEW — backend CI (checkout self + plugin at pin + regen-diff + parity gate + tests)
```

## Ordering Constraints
- **Slice 1** (wire types + integrity) must come first — every other slice imports from it.
- **Slice 2** (seed) depends on Slice 1 (`createEmptyProtocolDocument`, `sha256String`, the guards).
- **Slice 3** (generator + site config) depends on Slice 1 + 2.
- **Slice 4** (parity gate) depends on Slice 1 + 2 (probe seeds); it does NOT depend on the generator. It is sequenced after Slice 3 for narrative order, but Slices 3 and 4 could run in parallel during implementation (both depend only on 1 + 2).
- **Slice 5** (contract tests + regen-diff + CI) depends on Slice 3 + 4; must come last — it wires everything into CI.
- No cross-slice file merges: every file belongs to exactly one slice (the CI workflow is written once, in Slice 5).

## Verification Notes
- **Generated files pass the plugin's guards**: import the plugin's compiled guards (via the parity-gate bundle) AND the backend's duplicated guards; assert `isCatalogResponse(catalog.json)`, `isReleaseResponse(release.json)`, `isPackageManifest(manifest-wrapper.manifest)` for every seeded package. (`__tests__/contract.test.ts`)
- **Encoding round-trip**: a Cyrillic + a space `packageId` percent-encoded in the request path resolves to the literal-UTF-8-named fixture file; the returned `manifest.packageId`/`releaseVersion` equal the decoded request (identity check passes). (`__tests__/contract.test.ts`)
- **404 behavior**: an unknown release path returns 404 (not 200+HTML) because `site/404.html` exists. Verify with `curl -sI https://<origin>/packages/unknown/releases/9.9.9` → 404. (manual + a contract-test simulation against the generated `site/`)
- **`_redirects` percent-encoding is UNDOCUMENTED** (web research) — empirical test on deploy: request `/packages/%D0%9A.../releases/1.0.0` and confirm it serves the Cyrillic-named `.json` with 200 + JSON content-type. If it fails, the seed's Cyrillic `packageId` cannot be served (FR3 violation) — fall back requires re-evaluation, not a silent workaround. (manual deploy-time verification; recorded as an open risk)
- **Byte-stability**: regenerate `site/` and `git diff --exit-code site/` is clean (pinned `serverTime`/`publishedAt`). (`scripts/check-regen-diff.mjs`)
- **Parity gate fails on drift**: deliberately change a sentinel or required field in the backend's guards and confirm `npm run check:wire-parity` exits 1; revert + confirm it exits 0. (a parity-gate self-test)
- **Known-answer SHA-256**: `sha256String('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`. (`__tests__/seed.test.ts`)
- **No plugin source changes**: the plugin repo's `npm run check` stays green; `grep -r "libraryRegistryUrl\|DEFAULT_REGISTRY_URL" src/` in the plugin returns only the existing client code (the backend is purely contractual). (manual — the plugin repo is untouched)
- **p95 latency ≤ 2s**: static CDN-cached JSON trivially meets this; verify with a multi-sample load test (e.g. 100 requests, take the 95th-percentile elapsed: `for i in $(seq 1 100); do curl -s -o /dev/null -w '%{time_total}\n' https://<origin>/catalog; done | sort -n | awk 'NR==95'`) → ≤ 2s. (manual deploy-time)
- **https-only**: `curl -sI http://<origin>/catalog` is redirected/rejected; `normalizeRegistryUrl('https://<origin>')` accepts it. (manual deploy-time)

## Performance Considerations
- The read path is static JSON on Cloudflare's CDN — p95 ≤ 2s is trivially met (CDN-cached, edge-served). `/packages/*` is immutable (`max-age=86400, immutable`); `/catalog` is `must-revalidate` (default).
- The generator runs in Node at build time (not request time) — performance is not request-critical. SHA-256 via Web Crypto is async but fast for the small seed.
- The parity gate compiles the plugin's guards (one esbuild bundle) + probes — runs in CI, not at request time. The probe suite is bounded (one seed per exported guard + targeted delete/value/element/keys probes).
- No N+1 risk: the generator emits all files in one pass; reads are static file lookups.
- Phase-2 consideration (out of scope): the publish webhook regen must assemble each release's bytes within Edge Function limits (2s CPU / 150s wall Free — confirmed fits); consider a per-package size cap at submit (research open question, deferred to the Phase 2 design).

## Migration Notes
- The backend is GREENFIELD (new repo) — no existing data to migrate.
- The seed doubles as the phase-2 Supabase seed migration (inherited decision #3): the same seed definition that feeds the phase-1 generator will feed the phase-2 Supabase seed migration. The generator is forward-compatible (D8: the phase-2 webhook reuses it).
- No plugin-side migration: the plugin repo is untouched; the user only sets `libraryRegistryUrl`.
- Rollback: the static JSON is committed; a bad deploy is reverted via git (Cloudflare Pages deploys from the repo). Phase 1 has no stateful side to roll back.

## Pattern References
- `src/library/library-model.ts:174-212` — `isPackageManifest`/`isCatalogEntry` (the hand-written guard pattern to duplicate)
- `src/library/registry-model.ts:33-53` — `isCatalogResponse`/`isReleaseResponse` (the wrapper guards)
- `src/protocol/protocol-document.ts:167-183` — `isProtocolDocumentV1` (shallow guard; the recursion target)
- `src/protocol/protocol-document.ts:131-165` — `createEmptyProtocolDocument` (the seed's `protocolDoc` builder; key order = hashed bytes)
- `src/library/integrity.ts:30-59` — `sha256String`/`verifyIntegrity` (the SHA-256 to mirror)
- `src/library/library-installer.ts:233-237` — protocol hash canonical serialization (`JSON.stringify(doc, null, 2) + '\n'`)
- `src/__tests__/library/library-installer.test.ts:59-91` — `makeBundle` (the gold seed: real hashes, full install pipeline)
- `scripts/check-consistency.mjs:5-14,95-113,115-127` — the gate skeleton (`errors`/`fail`/`exit` + Check 7 bidirectional diff + exit) the parity gate reuses
- Cloudflare Pages `_redirects`/`_headers`/`404.html` (https://developers.cloudflare.com/pages/configuration/redirects/, https://developers.cloudflare.com/pages/configuration/serving-pages/, https://developers.cloudflare.com/pages/configuration/headers/) — the serving config

## Developer Context

### Step 4 checkpoint (questions exactly as asked, with evidence)

**Directional confirm 1 (Toolchain)**: "The backend's shared-types + JSON generator + parity-gate scripts will mirror the plugin's lightweight stack — TypeScript + esbuild + zero-dependency Node scripts, reusing the `errors`/`fail()`/`process.exit(1)` gate skeleton from `scripts/check-consistency.mjs:5-14,115-127`." → **Follow plugin stack**.

**Directional confirm 2 (Validation)**: "Mirror the plugin's hand-written `typeof`/`===`/`Array.isArray`/`.every()` guards (`src/library/library-model.ts:174-212`, `registry-model.ts:33-53`) byte-for-byte, or use zod schemas?" → **Follow hand-written**.

**Directional confirm 3 (JSON deploy)**: "Committed deterministic JSON + regenerate-and-diff in CI, or generate-in-CI only?" → **Follow commit-and-gate**.

**Ambiguity 1 (Scope)**: "What should THIS design cover?" → **Phase 1 only (Recommended)**. Rationale: D1 phasing; Phase 2 open questions (publish-webhook mechanism) resolve empirically after Phase 1 is live; "just me for now" = solo author publishes via the seed/generator and the submission/moderation lifecycle waits for contributors.

**Ambiguity 2 (Parity gate)**: "Three mechanisms — which?" → **D — probe-based (Recommended)**. Rationale: no hand-written drift (both sides derived behaviorally); matches the FRD's "guards are the executable contract"; the probe self-verifies its seed; descriptor scope = the guard, not the interface (declared-but-unenforced fields like `layoutDirection` out of scope by construction).

### Step 6.3 micro-checkpoints

**Slice 1** (Repo scaffold + duplicated wire types + integrity) — approved as generated. Verifier (2 dispatches) confirmed the wire-type duplication is byte-faithful to the plugin (sentinels, interfaces, `readonly`, optionality, `null`-rejection, key order, RPNodeKind union). Three findings resolved: (a) added `build` script (= typecheck + build:generate) to match the skeleton prose; (b) fixed the skeleton's `library-model.ts` Architecture heading which had over-listed `CatalogSnapshot`/`INSTALLED_RECORD` sentinels — the code correctly omits client-only types (codebase-analyzer + research: only served types are duplicated); (c) **by-design, ratified**: `package.json` declares the full script surface up-front (`build:generate`/`check:wire-parity`/`check:regen-diff`/`check` reference Slice 3/4/5 files) — the complete-repo-scaffold pattern with dormant scripts until their owning slices land; Success Criteria invoke only `typecheck`/`test` (atomic); package.json stays in one slice (no cross-slice file merge). Decision header attribution corrected (wire duplication=D2, parity gate=D5, SHA-256=D6, no-sig=D11).

**Slice 2** (Shared seed) — approved as generated. Verifier confirmed: D10 (shared seed, models after `makeBundle`, real hashes, mutual consistency, determinism via pinned timestamps + explicit `startNodeId`); D6 (canonical `protocolSha256` over `JSON.stringify(doc, null, 2) + '\n'` with the `createEmptyProtocolDocument` key order preserved by the spread); the locked Slice 1 guards accept the seed's manifest/catalogEntry output; Success Criteria atomic (reference only `__tests__/seed.test.ts` + the seed; no generator/parity-gate/CI references); no forward-refs (imports only Slice 1's `../wire-types/*`). One Research WARNING fixed: the `makeBundle` pattern-reference path (`__tests__/library/library-installer.test.ts:60-91`) → `src/__tests__/library/library-installer.test.ts:59-91` (added `src/` prefix, corrected line).

**Slice 3** (Deterministic generator + Cloudflare site config) — approved as generated. Verifier confirmed: D7 (2 splat `_redirects` rules covering both routes via the multi-segment `:splat`; mandatory top-level `404.html` preventing SPA fallback; `_headers` immutable cache for `/packages/*`); FR1 (release body `{manifest, snippetContents}` + manifest-only `{manifest}` wrapper match `registry-client.ts:141,168-170`); FR3 (Cyrillic + space packageIds → literal-UTF-8 files); catalog `{entries, serverTime}` with NO wire sentinel (client stamps it); the CLI guard (`process.argv[1]?.endsWith('generate.cjs')`) does NOT fire under vitest; no forward-refs (imports only Slice 1+2). One by-design VIOLATION ratified: D4's "committed `site/*.json`" are BUILD OUTPUTS produced by `npm run generate` (the generator), committed, verified byte-identical by Slice 5's regen-diff — NOT hand-written Architecture files (added a clarifying note + File Map `GENERATED` entries). One WARNING fixed: the determinism test was strengthened from parsed-JSON-of-2-files to raw-bytes-across-all-files (walk the output tree + `readFileSync` equality).

**Slice 4** (Cross-repo parity gate) — approved as generated. Verifier (3 dispatches) confirmed the probe-based gate derives a shape descriptor from each served guard's BEHAVIOR (no hand-written descriptors) identically for the plugin's compiled guards (at the pinned rev) + the backend's guards, then diffs. Two real fixes applied: (a) enriched the `isCatalogEntry`/`isProtocolDocumentV1` probe seeds with declared-optional fields (`summary`, `selfCheckEnabled`, `selfCheckItems`, `viewport`) so the harness probes them; (b) completed the ignored-field detection across ALL kinds — a field derives `unknown` iff the guard accepts a non-typed value (added the non-typed test to the array/object/null/boolean/number branches, mirroring the string branch). Confirmed derivations: `isPackageManifest` schema/version→literal, packageId/releaseVersion/protocolSha256/catalogEntryId/publishedAt→string, protocolDoc→object, snippetFiles→array-of object, author→optional object, open; `isCatalogEntry` author→REQUIRED (asymmetry vs manifest's optional author), categories→array-of string, summary→optional string; `isProtocolDocumentV1` nodes/edges→bare array (Array.isArray only), layoutDirection/selfCheckEnabled/selfCheckItems/viewport→unknown (ignored); `isCatalogResponse`/`isReleaseResponse` inlined. By-design (documented in the updated D5 decision): implemented taxonomy `object|array|array-of|string|number|boolean|literal|null|unknown` (records=open-objects, nested inlined, no `$ref`, multi-value unions not distinguished — no current guard enforces one); field order is a consistency check (both sides use the backend seed) — `createEmptyProtocolDocument` key-order parity is a D2 byte-for-byte-duplication concern (Slice 1). D9 (pin verification, read-only plugin), served-types-only (`isCatalogSnapshot`/`isInstalledRecord` excluded), esbuild-bundles-plugin-guards-with-no-plugin-changes, + the `errors`/`fail()`/`exit(1)` skeleton (D3) all hold. The 3rd dispatch's `NOT FOUND` flags were dispatch artifacts (only the changed `probe-descriptor.mjs` was re-sent to the stateless verifier; `check-wire-parity.mjs`/`plugin-pin.txt` were verified clean in the 2nd dispatch).

**Slice 5** (Contract tests + regen-diff + CI — terminal) — approved as generated. Verifier (4 dispatches) confirmed: the contract test simulates the three read routes against the generated `site/` with an explicit encode→decode round-trip (`encodeURIComponent`→`decodeURIComponent`→`decodedId === id`→literal-UTF-8 file + identity) for BOTH the release + manifest routes (FR3), the `{manifest}` wrapper (exactly one key), 404 (no unknown `.json` + committed `site/404.html`/`_redirects`), + every generated file passing the backend's duplicated guards (the parity gate, Slice 4, covers plugin parity in CI — the test does NOT redundantly re-bundle the plugin's guards). The regen-diff gate bundles the generator into a SEPARATE temp dir + runs it into another (so the bundle isn't treated as a generated artifact), raw-`Buffer.equals` diffs every generated `.json` vs committed `site/`, EXCLUDING the static config (`_redirects`/`404.html`/`_headers`). The CI checks out self + reads `plugin-pin.txt` (FULL SHA — a short SHA isn't reliably resolved by `actions/checkout`'s `ref:`) + checks out the plugin at the pin (read-only, `plugin-checkout/`) + `npm ci` (committed `package-lock.json`) + typecheck + regen-diff + wire-parity (`PLUGIN_REPO_PATH=plugin-checkout`) + test. Fixes applied across the 4 rounds: D4 raw-byte `Buffer.equals` (was utf8 text); regen-diff separate bundle/gen dirs (was self-polluting `generate.cjs`); FR15/FR14/installer/LibraryView/deployed-404/plugin-untouched → deploy-time/plugin-side MANUAL (not automatable in backend CI); both-guard-sets description reconciled (backend guards + parity gate); encode→decode round-trip explicit in both routes; `package-lock.json` File Map (for `npm ci`); full-SHA pin; p95 → multi-sample (100 requests + 95th-percentile). The terminal slice carries the project-baseline checks (`npm run check` = typecheck + regen-diff + wire-parity + test).

## Design History
- Slice 1: repo scaffold + duplicated wire types + integrity — approved as generated (3 verifier findings: `build` script + skeleton CatalogSnapshot heading fixed; package.json full-script-surface forward-ref ratified as by-design)
- Slice 2: shared seed — approved as generated (1 verifier WARNING: makeBundle path reference fixed to `src/__tests__/library/library-installer.test.ts:59-91`)
- Slice 3: deterministic generator + Cloudflare site config — approved as generated (1 by-design VIOLATION: generated site/*.json are build outputs (D4), not Architecture code — ratified; 1 WARNING fixed: determinism test strengthened to raw-bytes-all-files)
- Slice 4: cross-repo parity gate — approved as generated (3 verifier dispatches; 2 real fixes: enriched probe seeds with declared-optional fields + completed ignored-field detection across all kinds; by-design taxonomy/union/key-order notes documented in D5)
- Slice 5: contract tests + regen-diff + CI — approved as generated (4 verifier dispatches; fixes: raw-byte Buffer.equals diff, separate bundle/gen dirs, deploy-time/plugin-side manual checks (FR15/FR14/installer/LibraryView/404/plugin-untouched), both-guard-sets reconciliation (backend guards + parity gate), explicit encode→decode round-trip in both routes, package-lock.json File Map, full-SHA pin, p95 multi-sample)

## References
- Research: `.rpiv/artifacts/research/2026-08-06_08-19-22_community-library-backend.md`
- Discover FRD: `.rpiv/artifacts/discover/2026-08-06_08-12-45_community-library-backend.md`
- Source FRD: `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md`
- Foundation plan: `.rpiv/artifacts/plans/2026-08-05_16-24-25_moderated-community-library.md`
- Foundation design: `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md`
- Foundation validation: `.rpiv/artifacts/validation/2026-08-05_19-24-00_moderated-community-library-foundation-read-install.md`
- Read contract: `src/library/registry-client.ts`, `src/library/registry-model.ts`, `src/library/library-model.ts`, `src/protocol/protocol-document.ts`, `src/library/integrity.ts`, `src/library/library-installer.ts`
- Parity gate extension point: `scripts/check-consistency.mjs`
- Cloudflare Pages docs: https://developers.cloudflare.com/pages/configuration/redirects/, https://developers.cloudflare.com/pages/configuration/serving-pages/, https://developers.cloudflare.com/pages/configuration/headers/, https://developers.cloudflare.com/pages/configuration/custom-domains/, https://developers.cloudflare.com/pages/platform/limits/
- Supabase (phase 2, deferred): https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys, https://supabase.com/docs/guides/functions/limits