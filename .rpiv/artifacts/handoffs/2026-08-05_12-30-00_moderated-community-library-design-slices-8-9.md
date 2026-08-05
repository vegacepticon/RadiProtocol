---
date: 2026-08-05T12:30:00+0300
author: Roman Shulgha
commit: 4ad002c
branch: main
repository: RadiProtocol
topic: "Moderated community library — design (Slices 1-7 locked + verified, Slices 8-9 pending)"
tags: [design, library, read-only, integration, wiring, i18n, views, handoff]
status: in_progress
last_updated: 2026-08-05T12:30:00+0300
last_updated_by: Roman Shulgha
type: feature_development
---

# Handoff: Moderated community library — design (Slices 1-7 locked, Slices 8-9 next)

## Task(s)
Continuing `/skill:design` against the research artifact `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md` to produce a plan-ready design for the **foundation scope (read + install)** of a moderated community library. The design is decomposed into **9 vertical slices**; generation is slice-by-slice with a per-slice `slice-verifier` agent run + a developer micro-checkpoint before each slice is locked into the artifact.

This session resumed from `.rpiv/artifacts/handoffs/2026-08-05_10-16-18_moderated-community-library-design-slices-6-9.md` (which was paused with Slices 1-5 locked, Slice 6 at the start).

**Status at session start:** Slices 1-5 approved; Slices 6-9 pending.

**Status now (session end):**
- **Slice 6 (LibraryView ItemView + `library.*` i18n block)** — ✅ approved + written (4 slice-verifier rounds).
- **Slice 7 (item-detail + install-progress modals + `getReleaseManifest` + view wiring + 15 more i18n keys)** — ✅ approved + written (3 slice-verifier rounds).
- **Slices 8-9** — pending (NOT started). The developer declined to push Slice 8 in this (now-large) context and requested this handoff so a fresh session can do Slice 8 justice.

## Critical References
- **Design artifact (the living doc, source of truth):** `.rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md` — frontmatter still `status: in-progress`. Slices 1-7 Architecture fences + `## Slices` Success Criteria + Design History are filled; Slices 8-9 Architecture fences (lines 3918, 3922, 3926, 3930, 3934, 3938) are empty placeholders and Design History entries (lines 4202-4203) are `— pending`.
- Research artifact (input): `.rpiv/artifacts/research/2026-08-03_22-47-07_moderated-community-library.md`
- Design skill flow: `C:\Users\user\.pi\agent\npm\node_modules\@juicesharp\rpiv-pi\skills\design\SKILL.md` (Step 6 = slice generation; 6.1 generate, 6.2 slice-verifier, 6.3 micro-checkpoint, 6.4 lock into artifact)
- Prior handoff (resumed from): `.rpiv/artifacts/handoffs/2026-08-05_10-16-18_moderated-community-library-design-slices-6-9.md`

## Recent changes
All changes are inside the design artifact (NO source files were edited — design produces a document, not implementation). Repo still at commit `4ad002c` (only untracked `.rpiv/artifacts/` files).
- `## Architecture` — Slice 6 `src/views/library-view.ts` (filled: `LibraryView extends ItemView`, generation-guarded refresh, scoped watchers, client-side filter, ARIA) + `en.json`/`ru.json` (library.* 22-key block).
- `## Architecture` — Slice 7 `src/views/library-item-detail-modal.ts` (filled) + `src/views/library-install-progress-modal.ts` (filled) + `src/library/library-service.ts` (MERGED: + `PackageManifest` import, + `ReleaseManifestResult` type, + `getReleaseManifest` method) + `src/views/library-view.ts` (MERGED: + 2 modal imports, + renderCatalogEntry click/keyboard handlers, + `openDetail`/`openInstall` methods) + `en.json`/`ru.json` (library.* extended to 37 keys).
- `## Slices` Slice 6 + Slice 7: Success Criteria filled (Automated + Manual).
- `## Design History`: Slice 6 + Slice 7 entries flipped `pending` → `approved` (with verifier-round summaries).

## Learnings (carry forward — CRITICAL)
- **Artifact edit corruption (still applies):** When using the `edit` tool on the design artifact, `\u003c`/`\u003e`/`\u0026` escapes in `newText` decode correctly (this session: 0 corruption across all fences — verified after every edit with `awk '/^### <heading>/{f=1} f{print} f&&/^```$/{c++; if(c==2){f=0; exit}}' <artifact> | grep -cE "u003e|u003c|u0026"` = 0). ALWAYS re-read the persisted fence after every edit. The slice-verifier sees correctly-decoded code in its prompt and does NOT verify the persisted artifact — corruption is invisible to it.
- **edit tool "edits.0: must be object" / stringified-array errors:** the edit tool occasionally rejects a large multi-edit call with a serialization hiccup (the whole `edits` array gets stringified). Workaround: split into smaller batches (this session: 6 targeted merges, then 1 modal fence, then 1 modal fence, then 4 (JSON+criteria+history) — all succeeded). The 12-edit-in-one-call failed; splitting worked.
- **slice-verifier is extremely adversarial** (budget 2-5 rounds per slice; this session: S6=4, S7=3). Fix-and-re-dispatch on real findings; surface-and-proceed on by-design/pathological findings (ratify at the micro-checkpoint). NEVER proceed to 6.3 with a VIOLATION absent from the presentation.
- **"trusted" literal grep self-defeat (recurring):** the D11 automated criterion `grep -in "trusted" <file> returns nothing` is defeated if the code's COMMENTS contain the word "trusted" (e.g. `NEVER "trusted"`). Recurred in both S6 (comments) and S7 (comments). Fix: reword comments to "publisher authenticity" phrasing (avoid the literal "trusted"). ALWAYS grep the actual file before locking.
- **Self-defeating grep criteria (general):** any "grep X returns nothing" criterion is defeated if comments legitimately mention X. Prefer POSITIVE grep criteria (`grep -n "LIBRARY_INSTALLED_DIR" returns >= 3`) over negative ones, OR reword comments to avoid the literal.
- **Atomic install() emits no stage events (Slices 4-5 locked):** the install-progress modal uses an indeterminate ARIA progressbar (aria-valuenow OMITTED during installing per ARIA spec; set to 100 on complete / 0 on failed) + exhaustive `installing|complete|failed` dispatch with `default: { const _exhaustive: never }`. NO fake stage transitions. Reopening the installer to add a progress callback is OUT OF SCOPE (handoff: don't touch the installer).
- **getReleaseManifest fetches the full ReleaseBundle (manifest + snippetContents) and discards contents** — the locked Slice 2 registry API exposes only the full-release endpoint; there is NO manifest-only endpoint. `getReleaseManifest` trims to the manifest for display. **No vault write occurs before the user clicks Install** — the "trust preview before download [into the vault]" guarantee holds. A manifest-only endpoint would be a Slice 2 cascade + a backend assumption; DEFERRED. (Surface-and-proceed, ratified at the Slice 7 checkpoint.)
- **`detailIntegrity` (future tense) vs `integrityVerified` (past tense):** the detail modal is a PRE-install preview, so "Integrity will be verified on install" is honest; `integrityVerified` ("Integrity verified") is reserved for the POST-install installed list (Slice 6). The Verification Note (artifact ~line 3749) literally expects `integrityVerified` in the detail modal — that is SUPERSEDED by tense-correctness. (Surface-and-proceed, ratified.)
- **`.radi-library-*` CSS has no stylesheet in the File Map** — consistent with locked Slices 1-6 (all omit CSS); CSS is implementation-layer (build pipeline, stylelint-governed). The design specifies class-name conventions; styles ship during implement. (Surface-and-proceed, ratified.)
- **No source files were modified** this session — everything lives in the design artifact. Repo still at commit `4ad002c` (only untracked `.rpiv/artifacts/` files).
- **Scope discipline (unchanged):** foundation = read + install only. Do NOT implement submission wizard, auth, moderation, upgrades, ed25519 signature, reports/takedown. Manifest/service boundaries are forward-compatible but contain NO speculative fields. SHA-256 = integrity, NOT authenticity — UI never marks unsigned releases as "trusted" (only "integrity verified").
- **i18n parity gate:** the `library.*` block (now 37 keys) is in BOTH `en.json` AND `ru.json` (no automated parity gate exists today; Slice 9 adds one to `scripts/check-consistency.mjs`). User-authored content is never wrapped in `t()`.

## Slice 8 — design decisions ALREADY WORKED OUT (so the next session doesn't re-derive them)

**Slice 8: Existing-views read-only integration.** Files: `src/views/snippet-manager-view.ts` (MODIFY), `src/views/protocol-editor-view.ts` (MODIFY), `src/views/protocol-picker-modal.ts` (MODIFY). Runner pickers still discover library-managed protocols/snippets (do NOT exclude them — only render read-only + indicator).

### Key realization: `getInstalledRecord(packageId, version)` does NOT work from a path
The design's Slice 8 prose says "use `LibraryService.getInstalledRecord(packageId, version)` for the indicator lookup." **This does not work from a vault path**: the path is `${root}/library/<packageIdSlug>/<versionSlug>/...`, and `slugifyPackageId` is LOSSY (cannot reverse to the original packageId/version). `InstalledRecordStore.read(packageId, version)` keys by the ORIGINAL strings (it re-slugs internally). So the view cannot call `getInstalledRecord(slug, slug)`.

**Adaptation (use this):** use `LibraryService.listInstalled()` (returns all `InstalledRecord[]`, each carrying `protocolPath` + `snippetNamespace` — vault-relative paths) + a NEW pure path-matching helper to find the owning record. The indicator label = `record.packageId @ record.releaseVersion`.

### NEW pure helper to add (Slice 8 MODIFY-merge into `src/library/library-paths.ts` — additive)
```typescript
import type { InstalledRecord } from './library-model';

/** Find the installed record that owns a vault-relative path (Slice 8).
 *  Matches a protocol's `protocolPath` exactly, or a snippet's
 *  `snippetNamespace` (slash-boundary prefix). Returns the record (for the
 *  installed-package indicator) or null. Pure. */
export function findInstalledRecordForPath(records: readonly InstalledRecord[], path: string): InstalledRecord | null {
  for (const r of records) {
    if (r.protocolPath === path) return r;
    if (path === r.snippetNamespace || path.startsWith(r.snippetNamespace + '/')) return r;
  }
  return null;
}
```
This adds Slice 8's Files line to include `src/library/library-paths.ts` (MODIFY — additive helper). Like Slice 5/7's cross-slice merges.

### Read-only detection: `isLibraryManagedPath(path, root)` (Slice 1, already exported — NO record needed)
- Purely path-based: `path` under `${root}/library/` → managed → read-only. No fetch required.
- Use this for the read-only gating; use `findInstalledRecordForPath` only for the indicator label (packageId@version).

### Integration points (already read into context this session — re-read to confirm current line numbers)
- **`src/views/snippet-manager/tree-renderer.ts`** (the shared renderer used by SnippetManagerView): `renderNode` (line ~207) attaches click→openEditModal, contextmenu→openContextMenu, drag handlers, F2 rename — all UNCONDITIONALLY. `openContextMenu` (line ~337) builds edit/rename/move/delete/duplicate actions. For library-managed nodes: suppress click-to-edit, drag, rename, and the destructive context-menu actions; show an indicator badge (packageId@version). The `render(options)` method (line ~113) takes `folderTree`/`snippets`/... — add `installedRecords: InstalledRecord[]` to the options and store `this.installedRecords`. The renderer has `this.plugin` (for `settings.snippetFolderPath` + `i18n.t`); import `isLibraryManagedPath` + `findInstalledRecordForPath` from `../library/library-paths`. **SnippetManagerView** (`src/views/snippet-manager-view.ts`): add `private installedRecords: InstalledRecord[] = []`; in `refresh()` (or `loadModel`) fetch `this.installedRecords = await this.plugin.libraryService.listInstalled()` (best-effort, catch→[]); pass `installedRecords: this.installedRecords` to `treeRenderer.render({...})` (the existing renderTree() call). Also: the `openEditModal`/`handleDeleteSnippet`/`handleDeleteFolder`/`openMovePicker`/`duplicateSnippet` callbacks in the VIEW should guard: if `isLibraryManagedPath(path, snippetRoot)`, show a Notice "library-managed, read-only" and bail (defense-in-depth — the renderer already suppresses, but the view callbacks are the backstop).
- **`src/views/protocol-editor-view.ts`**: `loadProtocol(protocolPath)` (line 641) sets `this.protocolPath` (line 655). Add `private libraryReadOnly = false`; in loadProtocol, set `this.libraryReadOnly = isLibraryManagedPath(protocolPath, this.plugin.settings.protocolFolderPath)`. The save entry points are `protocolDocumentStore.update(this.protocolPath, ...)` at lines ~798, ~946, ~1374, ~1548 — guard each: `if (this.libraryReadOnly) { new Notice('library-managed, read-only'); return; }`. Show a banner/indicator with the packageId@version (fetch the record via `listInstalled()` + `findInstalledRecordForPath`, OR just show a generic "Library package (read-only)" banner to avoid an async fetch in loadProtocol — the record fetch can be best-effort). Read-only also disables node create/delete/drag edits (all route through the guarded update calls).
- **`src/views/protocol-picker-modal.ts`**: two SuggestModals. `renderSuggestion` (lines 36, 71) is SYNCHRONOUS — cannot fetch records there. The caller (which constructs the picker with `protocolFiles: TFile[]`) must ALSO pass `installedRecords: InstalledRecord[]` (new optional ctor param). In `renderSuggestion`, for an `existing` item, if `isLibraryManagedPath(item.file.path, protocolRoot)` → append an indicator suffix (e.g. ` — Library` or the packageId@version via `findInstalledRecordForPath`). `getSuggestions` still returns library-managed protocols (do NOT exclude — runner pickers discover them). The caller (where? grep for `new ProtocolPickerSuggestModal` / `new ProtocolEditorPickerModal` — likely in `main.ts` or a command handler) fetches `listInstalled()` before constructing. **NOTE:** if the caller is in `main.ts`, that's a Slice 9 concern — Slice 8 may need to thread the records through the caller; check where the pickers are constructed and whether passing records there touches `main.ts` (if so, add `main.ts` to Slice 8's Files OR defer the picker indicator to Slice 9 and do only the editor + snippet-manager in Slice 8). Decide at Slice 8 generation.

### i18n keys to add (Slice 8 — extend `library.*` block to ~42 keys, BOTH en + ru)
Reuse: `library.versionLabel`, `library.authorLabel` already exist. Add (suggested):
- `library.managedIndicator`: "{packageId} {version}" / "{packageId} {version}" (or a "Library" badge label)
- `library.managedBadge`: "Library" / "Библиотека"
- `library.readOnlyNotice`: "This item is part of an installed library package and is read-only." / "Этот элемент входит в состав установленного пакета библиотеки и доступен только для чтения."
- `library.managedEditBlocked`: "Library-managed protocols cannot be edited." / "Протоколами из библиотеки нельзя управлять."
Decide final keys at Slice 8 generation; keep en/ru parity.

### Slice 8 Success Criteria (draft — refine at 6.1)
- Automated: `npm run build`; `npm test`; en/ru library.* key parity; `grep -n "isLibraryManagedPath" src/views/snippet-manager-view.ts src/views/protocol-editor-view.ts src/views/protocol-picker-modal.ts` returns matches; `grep -n "libraryReadOnly" src/views/protocol-editor-view.ts` returns matches.
- Manual: library-managed snippets render read-only with an installed-package indicator in SnippetManagerView (not editable/deletable/movable); library-managed protocols render read-only + indicator in the protocol editor + picker; runner pickers still discover library-managed items.

## Slice 9 — plan (from the prior handoff, unchanged)
`src/main.ts` (register `LibraryView` via `registerView` + `addCommand` 'open-community-library' + `activateLibraryView()` modeled after `activateSnippetManagerView` at `src/main.ts:217-228`; construct `RegistryClient({ baseUrl: settings.libraryRegistryUrl || DEFAULT_REGISTRY_URL })` + `LibraryService`; call `await libraryService.recoverInterruptedInstalls()` on load), `src/settings.ts` (advanced `libraryRegistryUrl` override, empty → bundled default → "catalog unavailable"), `scripts/check-consistency.mjs` (net-new en/ru key-set parity gate — extend the phantom-reference scan pattern at `:76-88`; wire into `npm run check`). Also the `src/__mocks__/obsidian.ts` `requestUrl` stub (already in Slice 2). Verify the `## Slices` Slice 9 Success Criteria include the whole-repo `npm run check` gate. **Slice 9 also wires `this.libraryService` + `this.registryClient` onto `RadiProtocolPlugin`** (the forward reference Slices 6-7 depend on — `this.plugin.libraryService`).

## Action Items & Next Steps
1. **Resume at Slice 8** (existing-views read-only integration). Per the design skill's slice-by-slice flow: read the design artifact's empty fences for `snippet-manager-view.ts`/`protocol-editor-view.ts`/`protocol-picker-modal.ts` (lines 3918, 3922, 3926) + the `## Slices` Slice 8 Success Criteria + re-read the integration-point files (snippet-manager/tree-renderer.ts, snippet-manager-view.ts, protocol-editor-view.ts, protocol-picker-modal.ts) to confirm current line numbers. Generate the code (6.1) including the `findInstalledRecordForPath` helper in `library-paths.ts` (additive) + the 3 view MODIFYs + i18n keys. Dispatch `slice-verifier` (6.2), present condensed micro-checkpoint (6.3), on approval Edit the artifact's empty fences + fill the Slice 8 Success Criteria (6.4), re-read for unicode-escape corruption, then flip Design History Slice 8 `pending` → approved. **Decide at Slice 8 generation:** whether the protocol-picker indicator requires a `main.ts` change (picker construction site) — if yes, add `main.ts` to Slice 8's Files OR defer the picker indicator to Slice 9.
2. **Slice 9** (main.ts wiring + settings + parity gate) — see the plan above. Slice 9 wires `this.libraryService` + `this.registryClient` onto `RadiProtocolPlugin` (the forward ref Slices 6-7 use). Slice 9 Success Criteria must include the whole-repo `npm run check` gate.
3. **After all 9 slices are locked**, run the design skill's **Step 7** (verify all Architecture fences + `## Slices` Success Criteria filled — none empty; flip frontmatter `status: in-progress` → `status: ready`), then **Step 8** (present artifact; next step `/skill:plan .rpiv/artifacts/designs/2026-08-04_17-41-05_moderated-community-library.md`).
4. **Process choice for Slices 8-9:** the developer chose slice-by-slice (this session). Continue slice-by-slice (one `slice-verifier` round + one micro-checkpoint per slice) for Slice 8 and 9.

## Other Notes
- **Verifier rounds per slice so far:** S1=3, S2=4, S3=2(+reopen), S4=3, S5=2, S6=4, S7=3. Slice 8 (deep integration into 3 large existing files + a shared renderer) is expected to be the most contested UI slice — budget 3-5 rounds.
- **The `library.*` i18n block is now 37 keys** (S6 added 22, S7 added 15). Slice 8 will extend it further (~5 more keys). Slice 9 adds the parity gate that enforces it. When writing Slice 8's en/ru, REPLACE the full library block with the merged result (don't append) — per 6.4 rule 2.
- **Frontmatter `status` stays `in-progress`** until Step 7 (after Slice 9). Do NOT flip to `ready` mid-design.
- **The `__mocks__/obsidian.ts` `requestUrl` stub** was specified in Slice 2 (already written). Slice 9's `check-consistency.mjs` parity gate is the only NEW scripts/ change.
- **Test mock pattern (reuse for Slice 8 view tests if any):** `makeVault()` mock with `adapter.exists/read/write/list/remove` + `vault.createFolder`; `makeApp(vault) = ({ vault } as unknown)`. See `src/__tests__/library/library-installer.test.ts` for the canonical pattern. Slice 8 may not need new tests (it's view-layer integration; the design's Slice 8 has no test file in its Files line) — but `npm test` must still pass (existing suite unaffected).
- **CSS:** `.radi-library-*` classes (S6/S7) + any Slice 8 indicator classes have no stylesheet in the File Map (implementation-layer; consistent with Slices 1-7).
- **Key pattern-reference line numbers (re-confirm at Slice 8 generation, may have shifted):** `SnippetManagerView` refresh/generation-guard `snippet-manager-view.ts:185-253`; `SnippetManagerTreeRenderer.renderNode` `snippet-manager/tree-renderer.ts:207`; `ProtocolEditorView.loadProtocol` `protocol-editor-view.ts:641`; save entry points `protocol-editor-view.ts:798,946,1374,1548`; `ProtocolPickerSuggestModal.renderSuggestion` `protocol-picker-modal.ts:36`; `ProtocolEditorPickerModal.renderSuggestion` `protocol-picker-modal.ts:71`; `activateSnippetManagerView` `main.ts:217-228` (Slice 9 model).