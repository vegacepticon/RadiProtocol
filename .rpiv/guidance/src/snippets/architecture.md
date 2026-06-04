# Snippets Layer Architecture

## Responsibility
Snippet data model (3 variants: JSON, Markdown, Markdown Template), Obsidian vault CRUD service, cross-protocol reference syncing, and YAML front-matter parsing. The model (`snippet-model.ts`) and template parser (`md-template.ts`) are pure TypeScript (zero Obsidian imports). The service (`snippet-service.ts`) and ref-sync (`protocol-ref-sync.ts`) handle all vault I/O.

## Dependencies
- **i18n**: `Translator` + `defaultT` for localized error messages
- **utils/write-mutex**: Per-file-path write serialization
- **utils/vault-utils**: `ensureFolderPath` for safe folder creation
- **protocol/protocol-document**: `isProtocolDocumentV1`, type (ref-sync cross-subsystem boundary)
- **obsidian** (service + ref-sync): `App`, `TFile`, `Vault`, `FileManager`
- **settings**: `RadiProtocolSettings` (snippetFolderPath config)

## Consumers
- **main.ts**: Constructs `SnippetService` with `(app, settings, i18n.t.bind)`
- **views/snippet-manager-view.ts**: Orchestrates CRUD, triggers ref-sync on moves
- **views/snippet-tree-picker.ts**: Picker modal for inline runner
- **views/inline-runner-modal.ts**: Async snippet loading for fill-in
- **runner/render/render-snippet-picker.ts**: Snippet selection UI (type imports)

## Module Structure
```
src/snippets/
├── snippet-model.ts        # Pure types + validation + rendering (zero Obsidian imports)
├── snippet-service.ts      # Vault CRUD service (App + Settings injected)
├── protocol-ref-sync.ts    # Cross-protocol snippet reference rewriter (vault-wide mutation)
└── md-template.ts          # YAML front-matter parser/serializer (zero Obsidian imports)
```

## Discriminated Union with `kind` Tag

```typescript
export type Snippet = JsonSnippet | MdSnippet | MdTemplateSnippet;

export interface JsonSnippet {
  readonly kind: 'json';
  path: string;                   // vault-relative — sole source of identity
  name: string;
  template: string;               // {{id}} placeholder template
  placeholders: SnippetPlaceholder[];
  validationError: string | null; // always present — null = valid
  id?: string;                    // @deprecated — tolerated, ignored at runtime
}
```

- `validationError: string | null` (NOT `string | undefined`) forces every call-site to acknowledge it.
- `id` on `JsonSnippet` is `@deprecated` — identity is the `path` field (D-02).
- `template` uses `split('{' + '{' + id + '}' + '}').join(value)` — NOT `replaceAll()` (ES6 compat).

## Path-Safety Guard (assertInsideRoot)

```typescript
private assertInsideRoot(path: string): string | null {
  // Strips slashes, normalizes backslashes, rejects ../ traversal
  // Returns normalized path on success, null on rejection
}
// Every public method calls this FIRST
async load(path: string): Promise<Snippet | null> {
  const normalized = this.assertInsideRoot(path);
  if (normalized === null) return null;     // silent for reads
}
async save(snippet: Snippet): Promise<void> {
  const normalized = this.assertInsideRoot(snippet.path);
  if (normalized === null) throw new Error(...); // throws for writes
}
```

## Extension-Based CRUD Routing

`listFolder`/`load`/`save` branch on file extension and `kind`:
- `.json` → `JSON.parse` / `JSON.stringify` with `sanitizeJson()`
- `.md` with front-matter → `parseMarkdownTemplate` / `serializeMarkdownTemplate`
- `.md` without → raw content read/write

## Cross-Document Reference Rewriting

```typescript
export async function rewriteProtocolSnippetRefs(
  app: App,
  mapping: Map<string, string>,  // old path → new path
): Promise<ProtocolSyncResult>  // { updated: string[], skipped: Array<{path, reason}> }
```

- Best-effort: one file's failure recorded in `skipped`, does NOT abort the loop.
- No-op early return: unchanged files NOT written (avoids mtime churn).
- Per-file `WriteMutex` prevents concurrent-write races.
- Prefix matching uses `/` boundary: `startsWith(key + '/')` prevents partial-segment matches.

## Architectural Boundaries
- **Pure model layer** (`snippet-model.ts`, `md-template.ts`): zero Obsidian imports, fully unit-testable.
- **Service layer** (`snippet-service.ts`): `import type { App }` — type-only, injected via constructor.
- **Path-as-identity**: `path` is the sole source of truth. The `id` field is deprecated.
- **Trash, not delete**: `delete()` and `deleteFolder()` use `fileManager.trashFile()`.
- **Cross-subsystem boundary**: `protocol-ref-sync.ts` is the only file in `snippets/` that imports from `../protocol/`.

<important if="you are adding a new snippet variant">
## Adding a New Snippet Kind
1. Define the variant interface in `snippet-model.ts` (with `readonly kind: 'your-kind'`, `validationError: string | null`)
2. Add to `Snippet` union type
3. Add extension routing in `snippet-service.ts` `listFolder`/`load`/`save`
4. If using front-matter: add detection/parse/serialize in `md-template.ts`
5. Add validation in `validatePlaceholders` if applicable
6. Update any `switch(snippet.kind)` blocks in views
7. Update `protocol-ref-sync.ts` if the new kind has path references
</important>

<important if="you are writing or modifying tests for the snippets layer">
## Testing Conventions
- Pure modules (`snippet-model.ts`, `md-template.ts`): construct directly, no mocking
- Service tests: use `makeVault()` + `makeApp()` mock factory, `vi.fn()` on vault methods
- Ref-sync tests: mock `app.vault.getFiles()` to return `.rp.json` files, verify old→new rewriting
- Template rendering: use `split().join()` pattern — never `replaceAll()` (ES6 compat)
- The `id` field on `JsonSnippet` is deprecated — new tests should use `path` as identity
</important>