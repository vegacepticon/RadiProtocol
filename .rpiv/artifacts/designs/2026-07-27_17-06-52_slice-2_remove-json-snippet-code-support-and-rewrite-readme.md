---
date: 2026-07-27T17:06:52+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Remove JSON snippet code support and rewrite README"
source: .rpiv/artifacts/slices/2026-07-27_16-38-57_runner-cleanup-nodes-snippets-modal-ux.md
slice_n: 2
slice_title: "Remove JSON snippet code support and rewrite README"
depends_on: []
status: ready
tags: [design, slice]
---

# Design — Slice 2: Remove JSON snippet code support and rewrite README

## Approach

`JsonSnippet` is removed from the `Snippet` discriminated union so the README can truthfully state that snippets are `.md`-only (plain `MdSnippet` + front-matter `MdTemplateSnippet`). The decision is grounded in `src/snippets/snippet-model.ts:97` (`export type Snippet = JsonSnippet | MdSnippet | MdTemplateSnippet;`) and the extension-routing branches in `src/snippets/snippet-service.ts:124-141,180-197,225-237`.

**Migration policy (decided by user): silently stop loading.** `SnippetService.listFolder` skips any `.json` entry; `SnippetService.load` returns `null` for a `.json` path. No notice, no converter. Existing `.json` files in user vaults become invisible to the picker/manager and unresolvable at run time (runner renders the existing not-found state). This is the cleanest path to full type removal — no read-only editor arm, no migration module — and matches the slice scope ("rip out `JsonSnippet` from the `Snippet` kind union and every code path that routes on it").

Because `JsonSnippet` leaves the union, every callsite that narrows on `kind === 'json'` or imports `JsonSnippet`/`SnippetFile`/`renderSnippet` must be updated in the same slice to keep the build green. The blast radius extends beyond the slice map's `Draws on` list (which is targeted reading, not exhaustive scope) to the snippet editor, chip editor, fill-in modal, tree renderer, and runner snippet picker — all listed below. `MdTemplateSnippet` (the modern placeholder format) is untouched and becomes the sole placeholder-bearing variant; `renderMdTemplateSnippet` replaces `renderSnippet` as the rendering engine.

The README rewrite (en + ru, mirrored bilingual structure) removes the stale Canvas sections, the phantom "Convert Canvas protocol to .rp.json" command (confirmed absent in `src/main.ts:39-115`), the intro `.canvas` clause, and corrects the placeholder type list to the live `'free-text' | 'choice'` union (`src/snippets/snippet-model.ts:10-13`), then documents the two `.md` snippet formats.

## File Map

- `src/snippets/snippet-model.ts` — change — remove `JsonSnippet` interface, the `SnippetFile` alias, and `renderSnippet` (unused once the fill-in modal switches to `renderMdTemplateSnippet`); narrow `Snippet` to `MdSnippet | MdTemplateSnippet`. Keep `SnippetPlaceholder`, `MdSnippet`, `MdTemplateSnippet`, `renderMdTemplateSnippet`, `validatePlaceholders`, `slugifyLabel`.
- `src/snippets/snippet-service.ts` — change — drop the `JsonSnippet` import; in `listFolder`/`load`/`save` remove the `.json` branches (listFolder skips `.json` entries; `load` returns `null` for `.json` paths; `save` keeps only `md-template` and `md` arms); delete `sanitizeJson`; in `duplicateSnippet` drop the `kind === 'json'` arm and deep-copy placeholders for `md-template`; in `renameSnippet` fix the extension to `.md`; in `toSnippetRelativePath` narrow the strip regex to `.md`.
- `src/views/insert-snippet-modal.ts` — change — drop the `kind === 'json'` validation gate in `handleSelect`; in `renderSnippetForInsert` keep only the `md` and `md-template` arms.
- `src/views/snippet-tree-picker.ts` — change — simplify `fileGlyph()` to return `GLYPH_MD` for `.md` and the default glyph otherwise (drop the `.json`-specific branch); keep `GLYPH_FOLDER`/`GLYPH_MD` and a single default fallback glyph.
- `src/views/inline-runner-modal.ts` — change — in `handleSnippetFill` drop the `.json`-first resolution (load `.md` only, fall back to subdir scan for `.md`), drop both `kind === 'json'` validation gates, and remove the trailing json-with-placeholders fill arm; keep `md` and `md-template` arms.
- `src/views/snippet-editor-modal.ts` — change — narrow `draftKind` to `'md' | 'md-template'`; in `cloneSnippet` remove the `kind === 'json'` arm; in `handleSave`/`computeCandidatePath` remove the json arms (extension always `.md`); in `onOpen` edit-mode type label show "Markdown" only; the validation-banner gate keeps the `md-template` arm only. Existing `.json` files never reach the editor (`load` returns null), so no read-only/migrate path is added.
- `src/views/snippet-chip-editor.ts` — change — narrow `EditableTemplateSnippet` to `MdTemplateSnippet`; drop the `JsonSnippet` import.
- `src/views/snippet-fill-in-modal.ts` — change — narrow the `snippet` field and constructor parameter to `MdTemplateSnippet`; drop the `renderSnippet` import and use `renderMdTemplateSnippet` exclusively in the submit/preview path.
- `src/views/snippet-manager/tree-renderer.ts` — change — narrow `TreeNodeFile.snippetKind` to `'md' | 'md-template'`; in `iconForNode` drop the `file-json` branch (always `file-text` for files).
- `src/runner/render/render-snippet-picker.ts` — change — remove the `kind === 'json'` validation gate before `onSnippetReady`.
- `src/i18n/locales/en.json` — change — remove the now-unused `insertSnippet.cannotBeUsed` and `inlineRunner.snippetCannotBeUsed` keys.
- `src/i18n/locales/ru.json` — change — remove the same two keys.
- `README.md` — change — remove the intro `.canvas` clause and the "Existing `.canvas` protocols" section; remove the phantom "Convert Canvas protocol to .rp.json" command mention; correct the placeholder type list to "free text or choice"; rewrite the "Snippets" section to document the two `.md` formats (plain Markdown inserted verbatim; Markdown template with front-matter placeholders filled at run time); update the Setup step 3 wording from "JSON or Markdown" to "Markdown".
- `README.ru.md` — change — mirrored rewrite of the same sections in Russian.
- `src/__tests__/snippet-model.test.ts` — change — remove the `renderSnippet`/`SnippetFile` describe blocks (the function and alias are gone); keep `slugifyLabel` coverage.
- `src/__tests__/snippet-service.test.ts` — change — remove the `.json` list/load/save assertions and the `kind === 'json'`-typed fixtures; keep `.md` and `.md-template` coverage.
- `src/__tests__/snippet-service-validation.test.ts` — change — drop the `.json`-loaded validation cases (load no longer returns json); keep `validatePlaceholders` direct coverage for `md-template` legacy-type/invalid-choice detection.
- `src/__tests__/snippet-editor-modal.test.ts` — change — remove the `sampleJsonSnippet`/json-draft tests; keep `md` and `md-template` coverage.
- `src/__tests__/runner/render-snippet-picker.test.ts` — change — replace the `kind: 'json'` fixture with an `md-template` fixture (or remove the json-validation case now that the gate is gone).

## Key Interfaces

```ts
// src/snippets/snippet-model.ts — narrowed union, JsonSnippet/SnippetFile/renderSnippet removed
export type Snippet = MdSnippet | MdTemplateSnippet;

export function renderMdTemplateSnippet(
  snippet: MdTemplateSnippet,
  values: Record<string, string>,
): string;  // unchanged — now the sole render engine

// src/snippets/snippet-service.ts — .json no longer produced
class SnippetService {
  async listFolder(folderPath: string): Promise<{ folders: string[]; snippets: Snippet[] }>;
  //   .json entries skipped; snippets is MdSnippet | MdTemplateSnippet only
  async load(path: string): Promise<Snippet | null>;
  //   returns null for .json paths (and missing/unsafe as before)
  async save(snippet: Snippet): Promise<void>;
  //   Snippet is now MdSnippet | MdTemplateSnippet — no json arm, no sanitizeJson
  async duplicateSnippet(path: string): Promise<string>;
  //   deep-copies placeholders only for md-template
  async renameSnippet(oldPath: string, newBasename: string): Promise<string>;
  //   extension fixed to '.md'
}

// src/views/snippet-fill-in-modal.ts — md-template-only input
class SnippetFillInModal extends Modal {
  constructor(app: App, snippet: MdTemplateSnippet, t?: Translator);
  readonly result: Promise<string | null>;
}

// src/views/snippet-chip-editor.ts — md-template-only draft
type EditableTemplateSnippet = MdTemplateSnippet;
export function mountChipEditor(
  container: HTMLElement,
  draft: MdTemplateSnippet,
  onChange: () => void,
  options?: MountChipEditorOptions,
): ChipEditorHandle;

// src/views/snippet-editor-modal.ts — draftKind narrowed
type DraftKind = 'md' | 'md-template';
//   draft: MdSnippet | MdTemplateSnippet; cloneSnippet/handleSave drop the json arm

// src/views/snippet-manager/tree-renderer.ts — file node kind narrowed
interface TreeNodeFile {
  kind: 'file';
  path: string;
  name: string;
  snippetKind: 'md' | 'md-template';
}
```

## Integration Points

- `src/snippets/snippet-model.ts:97` — `Snippet` union narrowed to `MdSnippet | MdTemplateSnippet`; every consumer that branched on `kind === 'json'` is updated in this slice (list below). Couples to no sibling slice (Slice 2 has no deps).
- `src/snippets/snippet-service.ts:124-141` (`listFolder`) and `:180-197` (`load`) and `:225-237` (`save`) — `.json` branches removed; `load('.json')` now returns `null`, which the runner's not-found render path (`src/runner/render/render-snippet-fill.ts:42` `renderSnippetFillNotFound`) already handles.
- `src/views/inline-runner-modal.ts:1063-1075` — `.json`-first resolution collapsed to `.md`-only; the `:1004` and `:1094` `kind === 'json'` validation gates and the trailing json-with-placeholders arm (after `:1110`) are removed. The `md` and `md-template` arms above are retained verbatim.
- `src/views/insert-snippet-modal.ts:66` — the `kind === 'json'` gate is removed; `renderSnippetForInsert` (`:77`) keeps only `md`/`md-template`.
- `src/views/snippet-fill-in-modal.ts:273` — `renderSnippet` call replaced by `renderMdTemplateSnippet`; the `:29`/`:43` `JsonSnippet | MdTemplateSnippet` types narrow to `MdTemplateSnippet`.
- `src/views/snippet-editor-modal.ts:103`/`:192`/`:207`/`:291`/`:392`/`:544`/`:578`/`:606`/`:696` — all `draftKind === 'json'` and `cloneSnippet` json arms removed; `computeCandidatePath` extension fixed to `.md`.
- `src/views/snippet-chip-editor.ts:73` — `EditableTemplateSnippet` narrows to `MdTemplateSnippet`; `mountChipEditor` is called by `snippet-editor-modal.ts:393` only (the single chip-editor mount site).
- `src/views/snippet-manager/tree-renderer.ts:29`/`:46` — `snippetKind` narrows; `iconForNode` returns `file-text` for all files. `SnippetManagerView` builds `TreeNodeFile` from `SnippetService.listFolder` output, which is now json-free.
- `src/runner/render/render-snippet-picker.ts:113` — the `kind === 'json'` gate is removed; the picker hands only `md`/`md-template` to `options.onSnippetReady`.
- `src/views/snippet-tree-picker.ts:40-44` — `fileGlyph` simplified; the picker is consumed by `insert-snippet-modal.ts`, `inline-runner-modal.ts` (via `render-snippet-picker.ts`), and `snippet-manager-view.ts` — all unaffected by the glyph change.
- `src/i18n/locales/en.json:168,319` and `src/i18n/locales/ru.json:168,319` — `insertSnippet.cannotBeUsed` and `inlineRunner.snippetCannotBeUsed` removed (only the removed json gates used them). `snippetModel.legacyTypeError`/`invalidChoiceError` are retained (`validatePlaceholders` still guards `md-template` placeholders). `canvasParser.*` keys are left untouched (optional test-only cleanup is out of scope).
- `README.md:7,13,48,58,60,63-68,72-75` and `README.ru.md:7,13,48,58,60,63-68,72-75` — mirrored rewrites; the phantom "Convert Canvas protocol to .rp.json" command mention is removed (its absence confirmed at `src/main.ts:39-115`).

## Success Criteria

- [ ] `JsonSnippet`, `SnippetFile`, `renderSnippet`, and `sanitizeJson` no longer appear in `src/` (grep returns zero hits outside this design doc).
- [ ] `Snippet` union is `MdSnippet | MdTemplateSnippet`; `tsc` (npm run build type-check) passes with no `kind === 'json'`-related errors.
- [ ] `SnippetService.listFolder` skips `.json` files (a `.json` file in the snippet root produces no entry); `SnippetService.load('<root>/x.json')` returns `null`.
- [ ] `SnippetService.save` accepts only `MdSnippet`/`MdTemplateSnippet`; the `md-template` serialize and `md` raw-content paths still work.
- [ ] `SnippetEditorModal` create mode still defaults to `md-template`; edit mode opens `.md`/`.md-template` snippets and renders the chip editor / markdown textarea as before; opening a `.json` file is unreachable (manager no longer lists it).
- [ ] `SnippetFillInModal` accepts an `MdTemplateSnippet`, fills placeholders, and renders via `renderMdTemplateSnippet`; the runner and insert-snippet paths still produce rendered text.
- [ ] `InlineRunnerModal.handleSnippetFill` resolves a snippet by `.md` path only; a protocol referencing a `.json` snippet renders the existing not-found state (no json gate, no json fill arm).
- [ ] `render-snippet-picker.ts` no longer branches on `kind === 'json'`; a picker selection hands an `md`/`md-template` snippet to `onSnippetReady`.
- [ ] `snippet-tree-picker.ts` `fileGlyph` returns 📝 for `.md` and the default glyph otherwise (no 📄-for-`.json` branch).
- [ ] `TreeNodeFile.snippetKind` is `'md' | 'md-template'`; the snippet manager tree shows `file-text` for all snippet files.
- [ ] `insertSnippet.cannotBeUsed` and `inlineRunner.snippetCannotBeUsed` keys are absent from both locale files; no remaining code references them.
- [ ] `README.md` and `README.ru.md` contain no "Canvas" section, no "Convert Canvas protocol" command mention, no `.canvas` clause in the intro, no "JSON snippets" / "JSON or Markdown" wording; the placeholder list reads "free text or choice"; the Snippets section documents plain Markdown and Markdown template formats.
- [ ] `npm test` passes — updated snippet-model/snippet-service/snippet-service-validation/snippet-editor-modal/render-snippet-picker tests reflect the json-free shapes; no test references `JsonSnippet`/`SnippetFile`/`renderSnippet`/`kind: 'json'`.

## Notes / Deferred

- **Migration policy decided by user (this slice):** silently stop loading `.json` files — no notice, no converter. Existing `.json` snippets in user vaults become invisible/unusable; users recreate them as `.md` templates manually. No migration tooling is built.
- **`.json` → `.md` migration tooling** is deferred (and, per the user decision, not planned) — it would require keeping a read-only `JsonSnippet` shape inside a converter module, which contradicts the clean removal chosen here.
- **`canvasParser.*` i18n keys** are left in place — the slice map marks their cleanup optional and test-only; removing them is out of scope.
- **`snippetModel.legacyTypeError` / `invalidChoiceError`** are kept because `validatePlaceholders` still guards `MdTemplateSnippet` placeholders against legacy types and invalid choice configs at load time.
- **Snippet 1 coupling:** Slice 1 removes `protocolRunner.createSnippetFromSelection` and the `SnippetEditorModal` import from `inline-runner-modal.ts`. This slice does not touch that key; if Slice 1 lands first, its removal is independent. Neither slice edits the other's files.
- **Rename extension hardcoding:** `renameSnippet` will default the extension to `.md` for all snippets. A hypothetical non-`.md` snippet file would be renamed to `.md`, but since `load` returns `null` for non-`.md` after this slice, such files are already unreachable through the manager.