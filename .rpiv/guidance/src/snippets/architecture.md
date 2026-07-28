# Snippets Layer Architecture

## Responsibility
Snippet data model (2 variants: Markdown, Markdown Template), Obsidian vault CRUD service, cross-protocol reference syncing, YAML front-matter parsing. Model (`snippet-model.ts`) + template parser (`md-template.ts`) are pure TypeScript (zero Obsidian imports). Service (`snippet-service.ts`) + ref-sync (`protocol-ref-sync.ts`) handle all vault I/O.

**JSON snippets are fully removed** (commit `b895736`). Never parsed/listed/loaded/saved. `legacy-json` exists only as an unsupported-format resolution status — legacy `.json` files left on disk are not insertable. Do NOT add JSON back to the `Snippet` union.

## Dependencies
- **i18n**: `Translator` + `defaultT` · **utils/write-mutex**: per-file-path serialization · **utils/vault-utils**: `ensureFolderPath`
- **protocol/protocol-document**: `isProtocolDocumentV1`, type (ref-sync cross-subsystem boundary)
- **obsidian** (service + ref-sync): `App`, `TFile`, `Vault`, `FileManager` · **settings**: `RadiProtocolSettings` (`snippetFolderPath`)

## Consumers
- **main.ts**: constructs `SnippetService` with `(app, settings, i18n.t.bind)`
- **views/snippet-manager-view**: orchestrates CRUD, triggers ref-sync on moves
- **views/snippet-tree-picker**: picker modal for inline runner + editor · **views/inline-runner-modal**: async snippet loading for fill-in
- **runner/render/render-snippet-picker**: snippet selection UI (type imports)

## Module Structure
```
src/snippets/
├── snippet-model.ts        # Pure types + validation + rendering (zero Obsidian imports)
├── snippet-service.ts      # Vault CRUD service (App + Settings + i18n injected)
├── protocol-ref-sync.ts    # Cross-protocol snippet reference rewriter (vault-wide)
└── md-template.ts          # YAML front-matter parser/serializer (zero Obsidian imports)
```

## Discriminated Union with `kind` Tag

```typescript
export type Snippet = MdSnippet | MdTemplateSnippet;

export interface MdSnippet {
  readonly kind: 'md';
  path: string;                   // vault-relative .md path — SOLE source of identity
  name: string;                   // display metadata, NOT identity
  content: string;                // raw Markdown, inserted verbatim
}

export interface MdTemplateSnippet {
  readonly kind: 'md-template';
  path: string;                   // identity
  name: string;
  template: string;               // body with {{id}} placeholders
  placeholders: SnippetPlaceholder[];
  validationError: string | null; // always present — null = valid. NOT string | undefined
  lang?: string; version?: number;
}
```

`path` is the sole source of identity. `validationError: string | null` forces every call-site to acknowledge it. Placeholder `type` is restricted to `'free-text' | 'choice'` (choice requires ≥1 option).

## ES6-Compatible Template Rendering

```typescript
export function renderMdTemplateSnippet(template, placeholders, values): string {
  let out = template;
  for (const p of placeholders) out = out.split('{{' + p.id + '}}').join(values[p.id] ?? ''); // NOT replaceAll() (ES6)
  return out;
}
```
Missing declared values become `''`; undeclared body tokens → `validateBodyTokens` error. Validation precedence: definition errors before body-token errors (`??`).

## Markdown Front-Matter (Strict Classification)

```typescript
function hasTemplateFrontmatter(text: string): boolean {
  return text.startsWith('---\n') && text.indexOf('\n---\n', 4) > 0; // LF delimiters, byte-zero start
}
// .md without frontmatter → kind 'md' (raw content). With → parseMarkdownTemplate().
```
Parser is a **deliberately limited subset** — top-level `key: value`, indented `placeholders`/`options` list. Not general YAML; unsupported lines ignored. Serializer guarantees a final newline.

## Path-Safety Guard (assertInsideRoot)

```typescript
private assertInsideRoot(path: string): string | null {
  // rejects absolute + explicit ./..; requires root + '/' boundary prefix; returns normalized | null
}
// Every public method calls this FIRST: read/list → silent null/empty; save/create/rename/move → throws
```

Extension-based CRUD routing: `listFolder`/`load`/`save` branch on `kind` (`.md` with front-matter → template parse/serialize; `.md` without → raw content; `.json` → never listed/loaded, only `resolveSnippet` → `legacy-json` status). `resolveSnippet()` returns discriminated `{ found } | { legacy-json } | { missing }` — prefers Markdown for extensionless refs; accepts a basename subfolder match only when exactly unique (ambiguity = missing).

## Cross-Document Reference Rewriting

```typescript
export async function rewriteProtocolSnippetRefs(app, mapping: Map<string,string>)
  : Promise<{ updated: string[]; skipped: Array<{path, reason}> }>
```
- Best-effort: one file's failure recorded in `skipped`, does NOT abort the loop. No-op early return on empty mapping; unchanged files NOT written (avoids mtime churn).
- Per-file `WriteMutex`; scans only `.rp.json`; validates V1 envelope; touches only `kind === 'snippet'` nodes; rewrites `fields.snippetPath` + `fields.subfolderPath`.
- Exact-match first, then longest `/`-bounded prefix (`startsWith(key + '/')` — never bare `startsWith(key)`).

## Architectural Boundaries
- **Pure model layer** (`snippet-model.ts`, `md-template.ts`): zero Obsidian imports, unit-testable. **Service layer** (`snippet-service.ts`): `import type { App }` — type-only, injected.
- **Path-as-identity**: `path` is sole source of truth. **Trash, not delete**: `delete()`/`deleteFolder()` use `fileManager.trashFile()`.
- **Move and ref-sync are NOT one transaction**: ref-sync is invoked by the orchestrating caller after a move; a mid-sync failure leaves references partially rewritten. **Cross-subsystem boundary**: `protocol-ref-sync.ts` is the only `snippets/` file importing from `../protocol/`.

<important if="you are adding a new snippet variant">
## Adding a New Snippet Kind
1. Define the interface in `snippet-model.ts` (`readonly kind`, `path`, `validationError: string | null` if validated)
2. Add to `Snippet` union type
3. Add Markdown detection/parsing + deterministic serialization in `md-template.ts`
4. Add extension routing in `snippet-service.ts` `listFolder`/`load`/`save`/`duplicateSnippet`
5. Add validation in `validatePlaceholders` if applicable
6. Update every `switch(snippet.kind)` in views + consumers
7. Update `protocol-ref-sync.ts` if the kind has path references
8. Keep the format Markdown-based — do NOT revive legacy JSON loading
</important>

<important if="you are writing or modifying tests for the snippets layer">
## Testing Conventions
- Pure modules (`snippet-model.ts`, `md-template.ts`): construct directly, no mocking
- Service tests: `makeVault()` + `makeApp()` mock factory, `vi.fn()` on vault methods
- Assert unsafe paths cause **zero** vault I/O (mock not called)
- Assert valid templates use `validationError: null`; invalid return a string
- Assert raw Markdown remains byte-for-byte unchanged
- Ref-sync tests: mock `app.vault.getFiles()` to return `.rp.json` files; verify exact, boundary-prefix, and longest-prefix rewrites; assert unchanged docs are NOT written
- Template rendering: use `split().join()` — never `replaceAll()` (ES6 compat)
- Use canonical `path` in fixtures, not display names
</important>