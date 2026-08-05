---
date: 2026-08-03T22:47:07+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Moderated community library"
tags: [research, codebase, library, snippets, protocol, installer, i18n, backend]
status: ready
last_updated: 2026-08-03T22:47:07+0300
last_updated_by: Roman Shulgha
---

# Research: Moderated Community Library

## Research Question
Add a dedicated plugin library view and in-plugin submission wizard backed by an official managed API, immutable signed package registry, and separate web moderation dashboard. Implement a dependency-aware transactional installer that stages protocol-plus-snippet bundles into versioned isolated namespaces, rewrites only imported root-relative references, verifies integrity and compatibility, and atomically commits or rolls back. (FRD Recommended Approach, `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md`.)

Scope decision (recorded here, not deferred): **Plugin client only.** The research skill is codebase-grounded; the backend has no codebase to analyze. The backend/dashboard is greenfield (Q10). A previous session declined to answer this scope question; the default is recorded per the research skill's "scope/focus" classification.

## Summary
The codebase has every pure building block an installer needs (closed `ProtocolDocumentV1` to wrap, pure `GraphValidator` with an injectable `snippetFileProbe` to reuse for staged validation, pure `applyMapping` for reference rewriting, `WriteMutex` + `ensureFolderPath` dialect to copy) but is missing the four load-bearing things the feature requires: a real cross-file transaction boundary, a traversal/absolute-path gate on imported references, a remote-cache persistence store, and any network/signature code. The transactional installer cannot reuse `ProtocolDocumentStore`/`SnippetService` as its transaction boundary — `update()` reads unmutexed then writes mutexed (`src/protocol/protocol-document-store.ts:84-98`) and the four `WriteMutex` instances in the repo are mutually unaware. The package/release manifest must WRAP `ProtocolDocumentV1` (not extend it) because `isProtocolDocumentV1` rejects extra sentinels. A prior community library was built and fully deleted (`2ccc66a`→`6657b8d`, ~2,500 lines added then 8,365 deleted) because it was wired only into `main.ts` + `snippet-manager-view.ts`, never into active workflows — the new one must be a first-class ItemView from day one. Backend and moderation dashboard are fully greenfield; type-sharing between plugin and backend is an open decision.

## Detailed Findings

### ProtocolDocumentV1 is closed/immutability-safe — manifest must wrap
`ProtocolDocumentV1` (`src/protocol/protocol-document.ts:23-57`) has no slot for identity/release/provenance/hashes/install metadata. `isProtocolDocumentV1` (`src/protocol/protocol-document.ts:163-183`) is a shallow envelope guard: checks `schema === 'radiprotocol.protocol'` (`:14`), `version === 1` (`:17`), string `id/title/createdAt/updatedAt`, and array `nodes/edges` — it rejects any object whose `schema`/`version` sentinels differ, so a manifest with its own `schema: 'radiprotocol.package'` fails the guard outright. The guard tolerates extra top-level keys (unknown fields round-trip through `ProtocolDocumentStore.write` at `src/protocol/protocol-document-store.ts:76` and survive migration at `src/protocol/protocol-document-migration.ts:33-37`), so extending `ProtocolDocumentV1` is tolerated by storage but cannot carry a distinct identity — provenance/hashes/signature would travel inside the authored `.rp.json` and be hashed as protocol content. Conclusion: wrap `ProtocolDocumentV1` as a value inside a separate manifest. Schema-version compatibility = binary equality against `PROTOCOL_VERSION = 1` (`src/protocol/protocol-document.ts:16-17`) + `ProtocolDocumentParser.parse()` succeeding (`src/protocol/protocol-document-parser.ts:104-114`). The schema-evolution strategy is NOT version bumps but optional fields + legacy-key fallbacks + content migration that leaves `doc.version` untouched (`src/protocol/protocol-document-migration.ts:85-93`).

### Dependency closure: two disjoint bindings on SnippetNode
A protocol references snippets only through `SnippetNode` (`src/graph/graph-model.ts:93-108`): `radiprotocol_snippetPath` (file-bound → exactly one `.md`, extension kept) and `subfolderPath` (directory-bound → the **entire recursive subtree** of `.md` files, hierarchy preserved). The two are mutually exclusive on write but not enforced by the validator (`src/__tests__/graph-validator.test.ts:406-418`); when both are present the file binding wins at runtime (`src/runner/protocol-runner.ts:879-887`). Absence of both = root binding. The validator only hard-checks the file-bound case (D-04, `src/graph/graph-validator.ts:139-150`); directory-bound closure is deliberately deferred to build/import time (comment `src/graph/graph-validator.ts:158`). `subfolderPath` is definitively recursive, proven by the picker: `SnippetTreePicker` drills unbounded depth (`src/views/snippet-tree-picker.ts:281-297`) and its search walks the whole subtree (`src/snippets/snippet-service.ts:342-365`). FRD req 6 means concretely: for `snippetPath` set → the single `.md` at that relative path (extension kept); for `subfolderPath` set → every `.md` in the recursive subtree with relative paths intact; for both absent → the entire snippet root (refuse or collect everything). Only `.md` files are ever selectable/loadable — `.json` resolves to a `legacy-json` unsupported status (`src/snippets/snippet-service.ts:582-594`).

### Transaction boundary gap — stores cannot be the transaction boundary
`ProtocolDocumentStore.update()` (`src/protocol/protocol-document-store.ts:84-98`) reads **unmutexed** (`:90` calls `read()` which never takes the lock and may even write as a side effect via migration at `:54`) then writes **mutexed** (`:92` → `write()` → `mutex.runExclusive` at `:68`). Two concurrent `update`s on the same path both read the same baseline then the second write clobbers the first. `WriteMutex` (`src/utils/write-mutex.ts:10-24`) is per-instance AND per-path — two instances keyed on the same path string get two different Mutex objects. Four mutually-unaware instances exist: `RadiProtocolPlugin.insertMutex` (`src/main.ts:34`), `ProtocolDocumentStore.mutex` (`src/protocol/protocol-document-store.ts:25`), `SnippetService.mutex` (`src/snippets/snippet-service.ts:57`), module-level `protocolMutex` (`src/snippets/protocol-ref-sync.ts:15`). They are `private readonly` — no caller can join another's lock domain. There is NO staging area, pre-commit verification, or rollback anywhere in `src/`. `ensureFolderPath` (`src/utils/vault-utils.ts:6-13`) is check-then-create, not atomic — two concurrent writes to different files in the same new folder both pass `exists=false` and the second `createFolder` throws. `SnippetService`'s delete uses `fileManager.trashFile` (preference-dependent, not deterministic) — unusable as a rollback primitive. Conclusion: the installer must build its own stage→verify→commit→rollback journal under a single shared coarse-grained lock (e.g. module-level `installMutex` keyed on `'library-install:'+packageId+'@'+version`), performing all transaction I/O directly via `app.vault`/`adapter` inside that lock — never through `store.write()`/`snippetService.save()` mid-transaction. The installed-package metadata manifest written LAST acts as the commit marker; its absence = incomplete install = rollback/cleanup trigger. Atomic commit is logical (verify-everything-before-first-write + manifest-as-commit-marker + replayable journal), not hardware-level, since Obsidian's `adapter.write` is single-file truncate+write with no cross-file primitive.

### Path-safety gap — installer must add its own traversal gate
`ProtocolDocumentParser.parseNode` case `'snippet'` (`src/protocol/protocol-document-parser.ts:252-261`) reads `radiprotocol_snippetPath` via `getOptionalString` (`src/protocol/protocol-document-parser.ts:47-50`) which only checks `typeof v === 'string' && v !== ''` — no normalization, no traversal/absolute/backslash rejection. `'../escape.md'`, `'/etc/x.md'`, `'a\\b.md'` all parse untouched. `GraphValidator` D-04 naively concatenates `${this.snippetFolderPath}/${relPath}` (`src/graph/graph-validator.ts:142`) — no containment check, just an existence probe on the literal string. The ONLY traversal guard in the repo is `SnippetService.assertInsideRoot` (`src/snippets/snippet-service.ts:75-96`): rejects `..`/`.` segments, leading `/` absolute, requires containment under root with `/` boundary — but it is `private`, does not reject backslashes, and is invoked ONLY by `SnippetService` I/O methods (never by ref-sync, never by the validator). The runtime loader is a second, separate gate: `SnippetService.load`/`resolveSnippet` re-check containment against the live `snippetFolderPath` (`src/snippets/snippet-service.ts:227-229,558-619`), so a traversal path yields `{ status: 'missing' }` at runtime even if D-04 passed. An installer must add a traversal/absolute-path/backslash gate at four chokepoints: before D-04 composition, before `applyMapping`, at staged-document write time, and rely on the runtime loader as the final backstop. `assertInsideRoot` semantics should be extracted/reused (the reference implementation to copy), but it is private today.

### Reference rewriting is non-atomic — wrap it in the transaction
`rewriteProtocolSnippetRefs` (`src/snippets/protocol-ref-sync.ts:37-110`) is vault-wide, best-effort, non-atomic: a mid-loop failure records to `skipped[]` and continues — earlier files are already committed, there is no journal/backup/rollback/two-phase-commit. Header comment `src/snippets/protocol-ref-sync.ts:23-29` is explicit: "Best-effort … does not abort the loop. Never throws." The reusable pure core is `applyMapping` (`src/snippets/protocol-ref-sync.ts:119-137`): exact match wins (`:123-125`), then `/`-boundary prefix match (`current.startsWith(key + '/')` at `:130`), longest prefix wins (`:131`), null = unchanged (`:134`), suffix preserved (`:136`). It is pure, deterministic, takes only `(current, mapping)` — trivially reusable, but never validates the resulting path. `toSnippetRelativePath` (`src/snippets/snippet-service.ts:41-46`) is the extension-stripping encoder (root → `''`, strips `.md` once case-insensitively, preserves `.json`); it is the "single source of truth" for the root-relative, extension-less reference format. **Caveat**: the production caller of `rewriteProtocolSnippetRefs` does NOT use `toSnippetRelativePath` — `snippet-manager-view.ts:742-745` builds the mapping with a local `toProtocolRelativePath` (`src/views/snippet-manager-view.ts:41-46`) that KEEPS the extension (comment at `:36-40` explicitly contrasts the two). The canonical stored reference format in `.rp.json` is extension-preserving; the two encoders disagree on `.md` paths. An installer must pick one canonical form for its mapping keys and match byte-for-byte against whatever is stored. The installer must wrap namespace rewriting inside its transaction (not copy the non-transactional behavior), and reuse `applyMapping`'s semantics scoped to `kind === 'snippet'` nodes of the imported protocol only.

### Staged validation is already pure/probe-driven
`GraphValidator` (`src/graph/graph-validator.ts:1-169`) is zero-Obsidian — the only imports are pure modules (`./graph-model`, `./node-label`, `../i18n`). The `snippetFileProbe?: (absPath: string) => boolean` DI seam (`src/graph/graph-validator.ts:14-22`) is the sole I/O seam; D-04 is gated on BOTH `snippetFileProbe` and `snippetFolderPath` being defined (`:137`). Production injects `(absPath) => this.app.vault.getAbstractFileByPath(absPath) !== null` with `snippetFolderPath: this.plugin.settings.snippetFolderPath` (`src/views/inline-runner-modal.ts:95-99`), the ONLY production `new GraphValidator` site, consumed as the pre-run gate at `:193`. An installer injects `(absPath) => stagedFileSet.has(absPath)` with `snippetFolderPath: stagedNamespaceRoot` and runs byte-identical validation against the staged tree before commit — zero changes to the validator. The D-04 test matrix (`src/__tests__/graph-validator.test.ts:339-466`) already uses fabricated probe maps (`makeProbe` at `:344-346`) structurally identical to a staged namespace; keys must equal `${stagedRoot}/${relPath}` verbatim. Reusable gates: schema check (`isProtocolDocumentV1`), graph checks (`validator.validate` — never throws, safe inside a transaction). Net-new gates with no current support: signature/hash verification, safe-path/traversal/absolute gate, supported-type/extension gate, manifest consistency/closure/version-pinning.

### Persistence dialects — remote-cache needs a new store
Two vault-I/O dialects. (a) `ProtocolDocumentStore` (`src/protocol/protocol-document-store.ts`): structured `.rp.json` CRUD, `null`-on-error, never throws, receives folder paths as per-call args (constructor takes only `App` at `:24-27`, holds NO settings), `JSON.stringify(doc,null,2)+'\n'` at `:76`, blind overwrite (no collision check). (b) `SnippetService` (`src/snippets/snippet-service.ts`): `.md` CRUD gated by `assertInsideRoot`, throws on unsafe write, holds the LIVE settings object (`main.ts:59` passes `this.settings`, mutated in place by the settings tab at `src/settings.ts:115` so root changes take effect without reconstruction). Remote-cache data (catalog fetch, offline snapshots, downloaded package bytes) belongs in a NEW dedicated store under a NEW storage root — NOT through `ProtocolDocumentStore` (a catalog snapshot is JSON but not `ProtocolDocumentV1`; `read` returns `null` at `:45-47`; if given `.rp.json` suffix it is misclassified as a user protocol, picked up by pickers and rewritten by ref-sync) and NOT through `SnippetService` (`assertInsideRoot` rejects outside-root, non-`.md` bytes are invisible to `listFolder`/`load` but still counted by `listFolderDescendants`/`searchSnippets`; if `.md` they surface as editable user snippets — wrong lifecycle for immutable cache). Follow the same dialect: `WriteMutex.runExclusive` + `ensureFolderPath` + pretty JSON. Installed-release records (user-owned pretty-JSON manifests) need a new manifest schema + store (or adapter-level writes) copying the `JSON.stringify(doc,null,2)+'\n'` convention; the manifest wraps `ProtocolDocumentV1`. Retry state (pending download/submit, backoff counters) is ephemeral plugin-private state → Obsidian `loadData()`/`saveData()` (`main.ts:41,149-150`, the `data.json` blob), parallel to existing ephemeral precedent (`snippetTreeExpandedPaths` `src/settings.ts:24`, `inlineRunnerPosition` `src/settings.ts:29`). FRD-15 requires retries to not mutate vault content unless a complete transaction succeeds — retry state is pre-transaction and must live outside the vault tree.

### Namespace derivation — no precedent exists
No versioned namespace code exists in the codebase (grep finds no `library|registry|catalog|install|namespace` in `src/`). The only version-like fields are schema versions, not path namespaces: `PROTOCOL_VERSION = 1` and `MdTemplateSnippet.version?: number` (`src/snippets/snippet-model.ts:56`). Suggested shape: `${root}/library/<slug(packageId)>/<immutableVersion>/...` where version is server-controlled immutable release tag, packageId slug is deterministically derived (precedent: `slugifyLabel` at `src/snippets/snippet-model.ts:126-133` — lowercase, trim, non-alphanumeric runs → `-`, strip edge dashes, Cyrillic preserved; note `normalizeSnippetBasename` at `src/views/snippet-editor-modal.ts:70-72` deliberately does NOT slugify). Collision-protection pattern to follow: the immutable version tag makes collisions structurally impossible between versions (side-by-side by construction, FRD-13); collision-check-and-throw BEFORE staging (verify local bytes against manifest hashes = idempotent reinstall, or abort) mirroring `renameSnippet` at `src/snippets/snippet-service.ts:419-421`, NOT `ProtocolDocumentStore.write`'s blind overwrite (`src/protocol/protocol-document-store.ts:67-80`) nor `SnippetService.save`'s blind overwrite (`src/snippets/snippet-service.ts:266-270`). User-configurable: the two storage roots (`snippetFolderPath` default `'Snippets'`, `protocolFolderPath` default `'Protocols'`, both editable in settings) + choice of which version to install. Server-controlled: bytes, version tags, hashes, signature, manifest, moderation/revocation state. Derived: package slug, namespace path, local-modification status (local bytes diffed against manifest hashes), the rewrite mapping itself (original root-relative reference → namespace-relative path, applied only to `kind === 'snippet'` nodes of the imported protocol).

### UI patterns to model LibraryView + submission wizard after
Five reusable patterns, all in `src/views/`. (1) `SnippetManagerView extends ItemView` (`src/views/snippet-manager-view.ts:50`): generation+mounted guard is the anti-blocking/anti-stale core — `refresh()` (`:225-253`) captures `generation = ++this.searchGeneration` BEFORE await (`:231`), checks `ownsRefresh(generation)` after every await (`:235,237,242,247`); `onClose` (`:185-202`) sets `mounted=false`, `searchGeneration++`, clears both timers, `contentEl.empty()`. Vault watchers via `registerEvent` (auto-detach) with `shouldHandle` slash-boundary filter (`:199-202`) + 120ms debounce (`:204-210`). `activateSnippetManagerView()` (`src/main.ts:217-228`): get-or-create leaf (`getLeavesOfType()[0] ?? getLeaf(false)`), `setViewState` only on creation, `revealLeaf` fire-and-forget. (2) `SnippetEditorModal` (`src/views/snippet-editor-modal.ts`): promise-returning Modal — discriminated-union result (`:31-34`), promise created in constructor (`:151-154`), `safeResolve` double-guard (`:644-649`) called as cancellation fallback in `onClose` (`:235-250`), unsaved-changes `close()` interception (`:252-261`) with 3-button ConfirmModal. Crucial extension point: `snippetServiceOverride` structural adapter slot (`:41-54`) explicitly documented for "non-vault snippet stores such as Library Admin" — the precedent for injecting a managed-API client so the wizard never imports the client directly. (3) `InlineRunnerModal` (`src/views/inline-runner-modal.ts`): exhaustive `switch (state.status)` dispatch (`:451-566`) with `default: const _exhaustive: never = state` sentinel (`:563-566`) — adding a state is a compile error until a case is added; progressbar with `role="progressbar"` + `aria-valuemin/max/now/label` updated from one source (`:331,403-411`). (4) `SnippetTreePicker` (`src/views/snippet-tree-picker.ts`): destroyable `mount()`/`unmount()` (`:125,175`) with state reset on mount, tracked-listener teardown (`addListener`/`removeAllListeners`/`removeListenersExceptSearch` `:194-231`), post-await mount guards (`:333-336,469-472`), `aria-live="polite"` span preserved across body re-renders (`:161-169`). (5) The one documented cross-layer exception: `src/runner/render/render-snippet-picker.ts:25` imports `SnippetTreePicker` from views — justified only because the widget is a rendering concern of a runner state, NOT domain logic. New library domain logic must live in a NEW `src/library/` lower layer (pure model + Obsidian-touching service/installer, mirroring `snippets/`' split), with `LibraryView`/wizard consuming it exactly as `SnippetManagerView` consumes `SnippetService`. Do NOT extend the exception to `src/library/` importing view components; if the installer needs a picker-like widget, host it in a plain `Modal` (`snippet-manager-view.ts:651-668` pattern: mount in `onOpen`, unmount+null in `onClose`).

### i18n surface — ~14 new key blocks, no parity gate
`Translator` is the pure function type `(key, params?, fallback?) => string` (`src/i18n/index.ts:10`); `defaultT` wraps an English-only `I18nService` (`src/i18n/index.ts:16-19`). Pure modules receive `Translator` via constructor defaulting to `defaultT` (`ProtocolDocumentParser` `src/protocol/protocol-document-parser.ts:89-92`, `SnippetService` `src/snippets/snippet-service.ts:61-65`, `GraphValidator` `src/graph/graph-validator.ts:25-34`, `ProtocolRunner` `src/runner/protocol-runner.ts:17,54-58`, `parseMarkdownTemplate` `src/snippets/md-template.ts:21-22`). Plugin views inject `this.plugin.i18n.t.bind(this.plugin.i18n)` (constructed at `src/main.ts:43-49`, injected at `:53,59,193,280`; bound alias `const t = this.plugin.i18n.t.bind(this.plugin.i18n)` in views). Key convention `componentName.stringName`. 24 top-level blocks exist today (identical set in en/ru: `settings`, `protocolEditor`, `donate`, `snippetEditor`, `insertSnippet`, `snippetTreePicker`, `snippetPicker`, `snippetManager`, `startFromNode`, `selfCheck`, `nodePicker`, `snippetChip`, `snippetModel`, `snippetService`, `canvasParser`, `parser`, `graphValidator`, `protocolRunner`, `inlineRunner`, `snippetPreview`, `snippetFillIn`, `confirm`, `command`). NO `catalog`/`library`/`protocolLibrary` block exists — the deleted library's i18n was fully removed (`6657b8d`); only an orphaned dead trio survives (`snippetManager.emptyStateTitle` "Snippet library is empty" at `en.json:221` + `emptyStateBody/Button`, unreferenced by any `src/**/*.ts`). Planned blocks confirmed absent: `catalog.*`, `item.*`, `auth.*`, `submission.status.*` (9 lifecycle states: draft/submitted/inReview/changesRequested/resubmitted/approved/published/rejected/withdrawn — server sends token codes, plugin renders via `t('submission.status.'+code)`), `submission.history.*`, `submission.review.*`, `integrity.*`, `install.*`, `offline.*`/`retry.*`, `report.*`, `revocation.*`, `upgrade.*`, `rollback.*`. Audit gate `scripts/audit-i18n-ui-text.mjs` flags hardcoded literals in `src/views` + `src/settings.ts` only (`:7`); runs via `npm run audit:i18n` (`package.json:18`), gates `check:release` (`package.json:20`) which runs ONLY on the release workflow (`.github/workflows/release.yml:31`), NOT in CI push/PR (`.github/workflows/ci.yml:28-39`) nor git hooks (`.githooks/pre-commit`, `.githooks/pre-push:11`). **No en/ru parity gate exists** — `check:consistency.mjs` never reads locale files; the runtime EN fallback (`src/i18n/i18n-service.ts:32-35`) silently masks missing RU keys. Adding keys to en.json without ru.json passes every gate today. Parity is enforced only by convention (`.rpiv/guidance/architecture.md:60-64`); both locale files MUST change in the same commit.

### Backend/dashboard is greenfield
`esbuild.config.mjs:100-123` single plugin entry (`src/main.ts` → `main.js`); `external` includes `obsidian`/`electron`/`@codemirror/*`/`@lezer/*` + Node builtins; no `fetch|requestUrl|signature|hmac|abort|XMLHttpRequest` in `src/` (only comments, a mock, and a locale string). The `requestUrl` test mock was deleted (`564ca9a`); `src/__mocks__/obsidian.ts:1-5` has no network stubs. No backend/server/api/packages/shared-types directory exists; no `workspaces` field in `package.json`; `tsconfig.json:33` includes only `src/**/*.ts` (`baseUrl: "src"`, `moduleResolution: "bundler"`, `resolveJsonModule: true`). Role (`author|moderator|admin`) + lifecycle types sharing is an open decision: (a) generated OpenAPI client — zero OpenAPI artifacts today, would need a codegen step + backend workspace hosting the spec; (b) hand-maintained shared-types module — requires npm workspaces + `tsc -b` project references (a build-config change, not existing capability); (c) duplicated types — cheapest, matches current zero-sharing posture, but no parity gate exists to catch drift (`scripts/check-consistency.mjs:76-88` demonstrates a phantom-reference scan pattern that could be extended). Test infra: `vitest.config.ts:4-9` aliases `obsidian` → `src/__mocks__/obsidian.ts`, `environment: 'node'`, `include: ['src/__tests__/**/*.test.ts']`. `makeVault()`/`makeApp()` factory (`src/__tests__/protocol-document-store.test.ts:16-96`) supplies the vault side; a network client would slot in as a constructor param or options member with `vi.fn()` stubs, mirroring `snippetFileProbe`/`Translator` injection. A backend workspace would need its own esbuild/vitest/tsconfig (current tools are hardwired to the plugin tree).

## Code References
- `src/protocol/protocol-document.ts:14-17` — `PROTOCOL_SCHEMA`/`PROTOCOL_VERSION` sentinels
- `src/protocol/protocol-document.ts:23-57` — `ProtocolDocumentV1` interface (no identity/release/provenance slot)
- `src/protocol/protocol-document.ts:68-126` — `ProtocolNodeRecord`/`ProtocolEdgeRecord` (open `fields: Record<string, unknown>`)
- `src/protocol/protocol-document.ts:134-162` — `createEmptyProtocolDocument` (seeds Start node, `layoutDirection: 'LR'`)
- `src/protocol/protocol-document.ts:163-183` — `isProtocolDocumentV1` shallow envelope guard (rejects non-matching sentinels, tolerates extra keys)
- `src/protocol/protocol-document-parser.ts:47-50` — `getOptionalString` (no traversal/absolute/backslash check)
- `src/protocol/protocol-document-parser.ts:89-92` — parser constructor Translator default
- `src/protocol/protocol-document-parser.ts:104-114` — `parse()` schema gate via `isProtocolDocumentV1`
- `src/protocol/protocol-document-parser.ts:252-261` — snippet node parsing (`snippetPath`/`subfolderPath` read verbatim)
- `src/protocol/protocol-document-migration.ts:33-37,85-93` — lossless migration, preserves unknown fields, never bumps `doc.version`
- `src/protocol/protocol-document-store.ts:24-32` — `ProtocolDocumentStore` constructor (App only, no settings)
- `src/protocol/protocol-document-store.ts:35-63` — `read()` (unmutexed, null-on-error, migrates + writes as side effect at `:54`)
- `src/protocol/protocol-document-store.ts:67-80` — `write()` (per-path mutex, `ensureFolderPath`, `JSON.stringify(doc,null,2)+'\n'`, blind overwrite)
- `src/protocol/protocol-document-store.ts:84-98` — `update()` (read unmutexed `:90` → mutator `:91` → write mutexed `:92` — lost-update gap)
- `src/protocol/protocol-document-store.ts:122-153` — `list()` recursive walk filtering `.rp.json`
- `src/protocol/protocol-file-resolver.ts:31-36` — `resolveProtocolDocumentFiles` (hard-filters `.rp.json`)
- `src/graph/graph-model.ts:93-108` — `SnippetNode` (two disjoint bindings, mutually exclusive on write)
- `src/graph/graph-validator.ts:14-34` — `GraphValidatorOptions` (`snippetFileProbe`/`snippetFolderPath`/`t` DI seam)
- `src/graph/graph-validator.ts:137-158` — D-04 missing-snippet check (naive concat `:142`, directory-bound exempt, deferred comment `:158`)
- `src/views/inline-runner-modal.ts:95-99` — sole production `GraphValidator` probe injection
- `src/views/inline-runner-modal.ts:193-199` — pre-run validation gate
- `src/__tests__/graph-validator.test.ts:339-466` — D-04 fabricated-probe test matrix
- `src/snippets/snippet-service.ts:41-46` — `toSnippetRelativePath` (extension-stripping encoder, root → `''`)
- `src/snippets/snippet-service.ts:55-96` — `SnippetService` (LIVE settings, private `assertInsideRoot`)
- `src/snippets/snippet-service.ts:227-233` — `load()` rejects non-`.md`
- `src/snippets/snippet-service.ts:251-279` — `save()` (blind overwrite)
- `src/snippets/snippet-service.ts:342-365` — `listFolderDescendants` (recursive `.md` subtree walk)
- `src/snippets/snippet-service.ts:419-421,448-450,488-490,527-529` — collision-check-and-throw pattern
- `src/snippets/snippet-service.ts:558-619` — `resolveSnippet` (runtime containment backstop)
- `src/snippets/snippet-model.ts:56,126-133` — `MdTemplateSnippet.version`, `slugifyLabel`
- `src/snippets/protocol-ref-sync.ts:15,23-29` — module-level `protocolMutex`, best-effort non-atomic header
- `src/snippets/protocol-ref-sync.ts:37-110` — `rewriteProtocolSnippetRefs` (vault-wide, `skipped[]`, no rollback)
- `src/snippets/protocol-ref-sync.ts:119-137` — `applyMapping` pure core (exact → `/`-boundary prefix → longest → null)
- `src/utils/write-mutex.ts:10-24` — `WriteMutex` (per-instance per-path, key is any string)
- `src/utils/vault-utils.ts:6-13` — `ensureFolderPath` (check-then-create, not atomic)
- `src/main.ts:34,54,59` — `insertMutex`, `ProtocolDocumentStore`, `SnippetService` construction
- `src/main.ts:41,149-150` — `loadData()`/`saveData()` (plugin data.json)
- `src/main.ts:217-228` — `activateSnippetManagerView` (get-or-create + setViewState-if-new + revealLeaf)
- `src/views/snippet-manager-view.ts:21,50` — view type + `ItemView` subclass
- `src/views/snippet-manager-view.ts:185-253` — `onClose` + `refresh()` + `ownsRefresh` generation guard
- `src/views/snippet-manager-view.ts:41-46,742-745` — `toProtocolRelativePath` (extension-preserving) vs `toSnippetRelativePath`
- `src/views/snippet-editor-modal.ts:31-54,151-154,644-649,252-261` — promise Modal, `safeResolve`, `snippetServiceOverride` adapter
- `src/views/inline-runner-modal.ts:451-566,331,403-411` — exhaustive state-machine + ARIA progressbar
- `src/views/snippet-tree-picker.ts:125,175,194-231,161-169` — mount/unmount, tracked listeners, aria-live span
- `src/runner/render/render-snippet-picker.ts:25,69-135` — the one cross-layer exception (widget reuse, not domain)
- `src/i18n/index.ts:10,16-19` — `Translator` type, `defaultT`
- `src/i18n/i18n-service.ts:27-44` — `t()` (EN fallback at `:32-35` masks parity gaps)
- `scripts/audit-i18n-ui-text.mjs:7,9-12` — audit gate (views + settings only)
- `package.json:18,20` — `audit:i18n`, `check:release`
- `esbuild.config.mjs:100-123` — single plugin entry
- `vitest.config.ts:4-9` — obsidian alias, node env
- `src/__tests__/protocol-document-store.test.ts:16-96` — `makeVault()`/`makeApp()` factory

## Integration Points

### Inbound References
- `src/main.ts:53,59,193,280` — plugin wires `ProtocolDocumentParser`, `SnippetService`, pickers with bound `i18n.t` (the wiring point a `LibraryView` + library service would attach at)
- `src/main.ts:67` — `registerView(SNIPPET_MANAGER_VIEW_TYPE, ...)` factory pattern a `LibraryView` follows
- `src/views/inline-runner-modal.ts:95-99,193` — `GraphValidator` probe injection + pre-run gate (the exact pattern an installer reuses with a staged probe)
- `src/views/snippet-manager-view.ts:736-761` — `syncProtocolRefs` calls `rewriteProtocolSnippetRefs` after snippet moves (the non-transactional rewriter an installer must NOT copy)
- `src/views/protocol-editor-view.ts:798,946,1944` — unawaited `void update(...)` call sites (concurrent-update risk the installer avoids by its own lock)

### Outbound Dependencies
- `src/protocol/protocol-document-store.ts:68,157` → `WriteMutex` + `ensureFolderPath` (the dialect bones a new library store copies)
- `src/snippets/snippet-service.ts:256,284,313,327,422,451,491,530` → `WriteMutex` per-path serialization (instance 3, disjoint from store instance 2)
- `src/snippets/protocol-ref-sync.ts:51,96` → module `protocolMutex` + raw `vault.modify` (instance 4, bypasses `read()` validation/migration)
- `src/graph/graph-validator.ts:142-143` → `snippetFileProbe` (the sole I/O seam an installer swaps for staged validation)
- `src/protocol/protocol-document-parser.ts:47-50,259` → `getOptionalString` (the single reader with no traversal gate — every snippet path/label field flows through it)

### Infrastructure Wiring
- `src/main.ts:34,54,59` — four mutually-unaware `WriteMutex` instances created at plugin load (the installer's 5th lock domain must be a new module-level singleton)
- `src/main.ts:41,149-150` — `loadData()`/`saveData()` (retry state destination, pre-transaction)
- `src/settings.ts:36,38,99-102,113-116` — `snippetFolderPath`/`protocolFolderPath` (the two user-configurable roots the namespace hangs off)
- `src/i18n/i18n-service.ts:9-12,32-35` — locale loading + EN-fallback (no parity gate; both locale files must change together)
- `package.json:18,20` + `.github/workflows/release.yml:31` — `audit:i18n` gates only the release workflow
- `scripts/check-consistency.mjs:76-88` — phantom-reference scan (could be extended to catch role/lifecycle drift if types are duplicated)

## Architecture Insights
1. **Wrap, don't extend.** `ProtocolDocumentV1` is closed by sentinels; the package/release manifest contains it as a value. `isProtocolDocumentV1` doubles as store-read guard, ref-sync schema gate, and the installer's staged-protocol compatibility gate — shape-only everywhere.
2. **Two separate safety gates, not one.** D-04 is an existence probe on a concatenated string (`graph-validator.ts:142-143`); the runtime loader is a containment check (`snippet-service.ts:227-229,558-619`). The validator does NOT reject traversal paths — it just probes them. An installer needs a containment gate at staging time; the runtime loader remains the final backstop after commit.
3. **Two encoders disagree on `.md`.** `toSnippetRelativePath` strips `.md`; `toProtocolRelativePath` keeps it. The stored `.rp.json` reference format is extension-preserving. An installer must pick one canonical form for its mapping keys and match byte-for-byte against stored documents.
4. **Atomic commit is logical, not physical.** Obsidian's `adapter.write` is single-file truncate+write with no cross-file primitive. "Atomic" = verify-everything-before-first-write + manifest-as-commit-marker (written LAST) + replayable journal + deterministic removal (not `trashFile`) of only-this-transaction paths on rollback.
5. **Pure/Probe-injection is the established DI pattern.** `GraphValidator.snippetFileProbe`, `Translator` constructor defaults, and `snippetServiceOverride` adapter are three instances of the same idea: keep pure/obsidian seams injectable so the same code runs against a live vault, a staged tree, or a test stub. The library network client should be injected the same way — never imported directly by a view.
6. **New lower layer, not view logic.** Library domain logic (package model, registry client, installer, transaction journal) belongs in a new `src/library/` lower layer mirroring `snippets/`' pure-model + Obsidian-service split; `LibraryView`/wizard are views consuming it. The `render-snippet-picker.ts` cross-layer exception is widget-only and must not be extended to domain access.
7. **No parity gate exists.** en/ru parity is convention-only; `audit:i18n` scans only views/settings and never opens the JSON locales. Both locale files MUST change in the same commit, and a new parity check is a candidate net-new gate.

## Precedents & Lessons
8 similar past changes analyzed.

### Precedent: The abandoned community library — added, grown, then fully deleted
**Commits**: `2ccc66a` (v1.14.0 template library MVP, 2026-05-03) → `4258647` (protocol library browser, 05-19) → `e884baf` (local admin mode, 05-21) → `1e9996c` (migrate to md-template, 05-26) → `e1d9b3a` (remove unused admin panel, 05-28) → `7e2918f` (disconnect subsystem, 06-02) → `6657b8d` (complete removal, 06-02)
**Blast radius**: ~2,500 lines added then 8,365 deleted across snippets/ (`library-service.ts`, `library-model.ts`, `library-browser-modal.ts`), protocol/ (`protocol-library-service.ts`, `protocol-library-browser-modal.ts`), views/ (`library-admin.ts` 589, `library-admin-modal.ts` 662, `library-admin/` 5 files), styles (`library-admin.css` 130, `snippet-manager.css` ~155), i18n (`library`+`protocolLibrary` ~131 keys ×2 locales), settings, main.ts wiring, esbuild config, tests/mocks. Only `md-template.ts` (197 lines) survived and is still imported today.
**Follow-up fixes** (network/install/path/i18n gotchas in 9 days):
- `9b4a886` (05-21) — create parent folder when installing library snippets
- `cb41717` (05-22) — nightly drift: 37 dead i18n keys ×2 locales, dead CSS; spawned `check-css-classes.mjs` + `audit-i18n-ui-text.mjs` gates
- `380fabe`/`4180d10` (05-22) — admin used git pull + reset-to-remote; shell-quoting bugs
- `4802750`/`4891e4e`/`667622e` (05-23) — slugify/transliterate Cyrillic directory names
- `e14c5c1` (05-29) — URL-encode Cyrillic snippet download paths (non-ASCII broke downloads)
- `fa3d478` (05-29) — inline CSS + fetch() fallback (bypass cascade + requestUrl re-encoding)
- `d9c9487` (05-29) — swap order: fetch() first, requestUrl fallback (requestUrl re-decodes/re-encodes URLs)
- `7231c9a` (05-29) — harden CSS button selectors against Obsidian `.mod-cta` override
- `c636747` (05-24) — bundle default library URLs, hide URL settings (config drift)

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md` (D2) — "abandoned attempt — no part of it is used by current Protocol Editor, snippet workflow, or plugin initialization"
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — removal was safe only because import/grep analysis ran first

**Takeaway**: The old library died of disconnection (UI wired but not integrated into workflows) plus 8+ network/path/i18n fixes in 9 days — the new one must be a first-class ItemView from day one with transactional install, path gates, and URL-encoding budgeted up front.

### Precedent: SNIP-01 ItemView+CRUD baseline + WriteMutex introduction
**Commit**: `9ce1c05` — "feat(05-01): implement WriteMutex, ensureFolderPath, SnippetService, add snippetFolderPath to settings" (2026-04-06)
**Blast radius**: 4 files, +157/−12 — `snippet-service.ts` (+121), `utils/write-mutex.ts` (+25), `utils/vault-utils.ts` (20), `settings.ts` (+3)
**Follow-up evolution** (path safety built incrementally): `146d740` listFolder path safety → `bba70bf` extract `assertInsideRoot` → `ab9f7ec` snippet discriminated union → `a871035` path-based ops + trash delete → `1d25985` basename-authoritative names → `61a4e30` createFolder/listFolderDescendants → `a837c89` move/rename + `toCanvasKey` → `b8c7e01` validatePlaceholders
**Takeaway**: Path safety and mutex semantics were discovered through 6+ follow-up commits after the baseline — copy the final `assertInsideRoot` pattern, don't repeat the incremental discovery.

### Precedent: protocol-ref-sync stabilization
**Commit**: `a61e97f` — "fix: stabilize minimap and sync moved snippet references" (2026-05-13); the only commit ever to touch `protocol-ref-sync.ts` (137 lines, unchanged since)
**Blast radius**: 18 files, +649/−1271 — `protocol-ref-sync.ts` +137, `canvas-ref-sync.ts` ±99, editor/view/picker/i18n/tests; deleted a 1,173-line `.bak` committed one day earlier
**Takeaway**: Reference rewriting is the exact mechanism the installer must re-implement transactionally — reuse `applyMapping`'s semantics, add rollback, never ship vault-wide best-effort mutation.

### Precedent: Loop-node merge into question toggle
**Commit**: `1dd1f78` — "feat: merge standalone loop node type into question via loop toggle and explicit isLoopExit edge flag" (2026-07-28)
**Blast radius**: ~50 files (largest in repo history) — graph/protocol/runner/views/i18n/20+ tests
**Follow-up**: same-day validation caught `restoreStatus` serialization gap in undo snapshots; no regression commits in 2 weeks
**Takeaway**: Format/state migration precedents — idempotency + fallback-on-error + editor-load-path placement + immediate snapshot regression tests. The installer's reference-rewrite and versioned-namespace migration should follow the same pattern.

### Precedent: JSON snippets removal
**Commit**: `b895736` — "feat: drop JSON snippets, deprecate Text block creation, seed Start node..." (2026-07-27)
**Blast radius**: 40 files, +1188/−1043 — every consumer (model, service, tree, editor, fill-in, insert, runner renders, 20+ tests)
**Takeaway**: Don't add a new content format or extend `ProtocolDocumentV1` — wrap it; expect a 40-file blast radius whenever snippet formats change.

### Composite Lessons
1. **No existing transaction boundary — build your own.** Store reads are unmutexed, writes mutexed (clobber race at `src/protocol/protocol-document-store.ts:84-98`); four mutex instances are mutually unaware; ref-sync is best-effort with `skipped[]` and no rollback. The installer needs a real stage→verify→commit→rollback journal under a cross-file lock.
2. **Path safety must be net-new, not assumed.** Parser reads `radiprotocol_snippetPath` verbatim (`src/protocol/protocol-document-parser.ts:259`), GraphValidator D-04 string-concatenates (`src/graph/graph-validator.ts:142`), `assertInsideRoot` is the only guard and isn't wired into either. History shows Cyrillic paths broke downloads (`e14c5c1`), admin needed transliteration slugify (`4891e4e`), installs needed parent-folder creation (`9b4a886`) — budget traversal gates, encoding, and mkdir-parents up front.
3. **Dead code kills features — integrate into active workflows from day one.** The old library was "wired but unused" and 8,365 lines were deleted 30 days after MVP. The new library must be a dedicated ItemView + command reachable from real workflows (model: `SnippetManagerView` generation guard, `activateSnippetManagerView` at `src/main.ts:217-228`).
4. **Network install is a bug magnet — plan for it.** In 9 days: requestUrl re-encoding (`d9c9487`), fetch fallback + inline CSS (`fa3d478`), URL-encoding (`e14c5c1`), parent folders (`9b4a886`), theme CSS override (`7231c9a`), git-pull shell quoting. Use fetch-first with fallback, pre-encode paths, inject a fetch/client abstraction for tests.
5. **i18n drift is guaranteed without gates.** 37 keys died in one night (`cb41717`); the library added ~131 keys ×2 locales that were all deleted. Both `en.json`/`ru.json` must change in the same commit; server should send token codes rendered via `t('submission.status.'+code)`; `audit-i18n-ui-text.mjs` + `check:consistency` are the existing gates, but neither enforces parity.
6. **Staged validation already exists as a pure function.** `GraphValidator` is zero-Obsidian with `snippetFileProbe` as the only I/O seam — inject `(absPath) => stagedFileSet.has(absPath)` for identical validation against staged trees. Package-level gates (signature/hash/safe-path/unsupported-file) are net-new.
7. **Never commit backup files or mix formats mid-feature.** A 1,173-line `.bak` lived in VCS for one day (`f0fdec9`→`a61e97f`); a mid-life format migration touched 17 files (`1e9996c`); JSON-snippet removal touched 40 (`b895736`). Keep `ProtocolDocumentV1` closed — wrap it in the package manifest.
8. **The old library's own lifecycle is the strongest warning.** 31 commits, 30 days, 8,365 deleted lines, FRD-documented as "abandoned attempt." The removal was only clean because it was preceded by import/grep verification — do the same verification before touching any shared component.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-08-03_21-33-50_moderated-community-library.md` — source FRD (31 decisions, full requirements, acceptance criteria, Recommended Approach used as research topic)
- `.rpiv/artifacts/discover/2026-06-02_11-55-28_cleanup-and-ux-fixes.md` — cleanup FRD documenting the abandoned library as "D2: abandoned attempt"
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — cleanup research (removal safe because import/grep analysis ran first)
- `.rpiv/artifacts/handoffs/2026-08-03_22-59-16_moderated-community-library-research.md` — prior research-session handoff (10 load-bearing findings, scope-decline checkpoint)

## Developer Context
**Q (discover: Primary audience): What problem should this library solve first, and who experiences it most acutely today?**
A: Library users

**Q (discover: Success outcome): For a library user, what outcome would make this feature successful in day-to-day use?**
A: Instant reuse

**Q (discover: Canonical snippet references): Keep the canonical root-relative snippet references rather than embed snippet content, or change the format?**
A: Keep references

**Q (discover: Missing-snippet validation): Keep the fail-fast rule and make library installs atomic, or relax validation?**
A: Keep fail-fast

**Q (discover: Release scope): Should the first complete feature scope include the entire community lifecycle, or intentionally defer part of it?**
A: Full lifecycle

**Q (discover: Service architecture): Which tradeoff should govern the submission and moderation backend: integrated user experience versus minimal infrastructure?**
A: Managed service

**Q (discover: Authentication boundary): Who should be required to sign in when using the managed library service?**
A: Submitters and reviewers

**Q (discover: Protocol dependency closure): When a submitted protocol references snippets, what dependency closure must its library package include?**
A: All referenced content

**Q (discover: Installation namespace): For existing-path conflicts, should downloads install into an isolated library namespace or merge into the user's current protocol/snippet folders?**
A: Isolated namespace

**Q (discover: Moderation roles): What role model should the first moderation system use?**
A: Author, moderator, admin

**Q (discover: Review lifecycle): Which review lifecycle should a protocol or snippet submission support?**
A: Full revision loop

**Q (discover: Publication gates): What must happen before a submission can be published?**
A: Automated plus human

**Q (discover: Catalog discovery): How should library users find suitable protocols and snippets?**
A: Search, filters, curated

**Q (discover: Item trust preview): What information should an item page show before download?**
A: Full trust preview

**Q (discover: Installed-version updates): Should installed library items update automatically or remain pinned until the user chooses an upgrade?**
A: Pinned, manual upgrade

**Q (discover: Contributor surface): Where should contributors prepare and send submissions?**
A: Inside plugin

**Q (discover: Moderation surface): Where should moderators and administrators review submissions?**
A: Web dashboard

**Q (discover: Sign-in method): Which sign-in method should the managed service use?**
A: Email magic link

**Q (discover: Catalog ownership): Should the library be one official centrally operated catalog or support user-configurable/self-hosted registries?**
A: Official catalog

**Q (discover: Patient-data enforcement): What privacy rule should apply to submitted protocol and snippet content?**
A: Warning only

**Q (discover: Package integrity): How strongly should downloaded package integrity and provenance be enforced?**
A: Signed immutable releases

**Q (discover: Offline behavior): What should happen when the library service is unavailable or the user is offline?**
A: Local use plus cache

**Q (discover: Accessibility baseline): What accessibility baseline should the plugin library and web moderation interfaces meet?**
A: WCAG 2.2 AA

**Q (discover: Performance target): What responsiveness target should define a user-friendly library experience under normal connectivity?**
A: Interactive under 2s

**Q (discover: Publication license): Under what license should published community protocols and snippets be distributed?**
A: CC BY 4.0

**Q (discover: Meaning of moderation): How should moderation be represented to users given that library content supports—but does not replace—clinical judgment?**
A: Quality review, not certification

**Q (discover: Locally modified upgrades): When upgrading an installed item that the user has edited locally, how should the library protect those changes?**
A: Install side by side

**Q (discover: Review of new versions): After an item is published, how should author updates reach the catalog?**
A: Review every version

**Q (discover: Post-publication moderation): Should the first moderation scope include reporting and emergency removal of already-published content?**
A: Reports and takedown

**Q (discover: Plugin library surface): Which plugin UI shape should balance discoverability with workspace footprint?**
A: Dedicated library view

**Q (scope — recorded default, prior session declined the checkpoint): Should the research scope cover plugin client only, plugin + backend research, or plugin + recover the deleted library?**
A: Plugin client only — the research skill is codebase-grounded; the backend has no codebase to analyze (no network/signature code in `src/`, `esbuild.config.mjs:100-123` single plugin entry). Recovering the deleted library is out of scope (it was abandoned and fully removed; its lessons are captured in Precedents & Lessons).

## Related Research
- `.rpiv/artifacts/research/2026-06-02_12-11-42_cleanup-and-ux-fixes.md` — cleanup research preceding the abandoned-library removal (removal-safe verification methodology)

## Open Questions
None deferred from the FRD. Open implementation decisions for `/skill:design` or `/skill:blueprint`:
1. **Type sharing between plugin and backend** (Q10): generated OpenAPI client vs hand-maintained shared-types module vs duplicated types. No existing capability gates parity; duplicated types is cheapest but drift-prone.
2. **Remote-cache store location** (Q3): a new dedicated store under a new storage root (e.g. plugin data dir or a `libraryFolderPath`) with its own suffix/guard, following the `WriteMutex` + `ensureFolderPath` + pretty-JSON dialect — NOT through `ProtocolDocumentStore`/`SnippetService`.
3. **Manifest schema**: the exact shape of the package/release manifest that wraps `ProtocolDocumentV1` (file hashes, author/review provenance, version metadata, signature) and the installed-release record shape.
4. **Reference rewrite canonical form** (Q5): extension-preserving (`toProtocolRelativePath`) vs extension-stripping (`toSnippetRelativePath`) for mapping keys — must match the stored `.rp.json` byte-for-byte.
5. **Cross-file lock granularity**: one coarse synthetic key per transaction (`'library-install:'+packageId+'@'+version`) vs finer-grained per-path keys (deadlock risk). Coarse is recommended in the findings.
6. **Rollback primitive**: deterministic `adapter.remove` of only-this-transaction paths (not `trashFile`); how to detect/recover an incomplete install (manifest-as-commit-marker absence).
7. **en/ru parity gate**: whether to add a net-new parity check (the existing `check:consistency.mjs` pattern could be extended) since no automated parity enforcement exists today.