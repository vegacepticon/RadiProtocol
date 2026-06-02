# Snippets Layer

## Responsibility
Snippet data model (JSON, Markdown, Markdown-template), vault CRUD with path-safety enforcement, external library fetch/install, and cross-protocol reference rewrite on move/rename.

## Dependencies
- **obsidian**: Vault I/O, `requestUrl`, `Notice`, `TFile`
- **protocol/protocol-document**: Protocol reference sync (`protocol-ref-sync.ts`)
- **write-mutex / vault-utils**: Per-path concurrency, folder creation
- **i18n**: Translator injection

## Consumers
- `views/` — snippet manager, editor, fill-in modal, tree picker, library browser
- `runner/render/render-snippet-picker.ts` — `SnippetService` type, `Snippet` union
- `__tests__/` — 12+ test files

## Module Structure
```
snippets/
├── snippet-model.ts         # Discriminated union (JsonSnippet | MdSnippet | MdTemplateSnippet)
├── snippet-service.ts       # Vault CRUD + path-safety gate + WriteMutex
├── md-template.ts           # Frontmatter parse/serialize for .md template snippets
├── protocol-ref-sync.ts     # Rewrite snippet refs in .rp.json files on move
├── library-model.ts         # Remote library index types (pure)
└── library-service.ts       # Remote fetch/install + manifest tracking
```

## Discriminated Union (`kind` discriminant)

```typescript
type Snippet = JsonSnippet | MdSnippet | MdTemplateSnippet;
interface JsonSnippet { readonly kind: 'json'; path: string; name: string;
  template: string; placeholders: SnippetPlaceholder[]; validationError: string | null; }
```

## Path-Safety Gate (Critical)

```typescript
// Called at the top of every public SnippetService method
private assertInsideRoot(path: string): string | null {
  // Rejects: '..', '.', absolute paths, paths outside settings.snippetFolderPath
  // Returns normalized safe path or null (callers handle gracefully)
}
```

## Per-Path WriteMutex

```typescript
// Every vault write/rename/delete wrapped in per-path mutex
this.mutex = new WriteMutex();
await this.mutex.runExclusive(normalizedPath, async () => {
  await ensureFolderPath(this.app.vault, parentFolder);
  // ... vault write ...
});
```

## Architectural Boundaries
- **NO Obsidian imports in `snippet-model.ts`**: Pure types + rendering functions (NFR-01)
- **NO vault.delete()**: Deletions route through `app.fileManager.trashFile()` for user trash preference
- **NO protocol ref sync on delete**: D-17 — deletions leave refs broken intentionally
- **NO `replaceAll`**: Template rendering uses `split({{token}}).join(value)` for ES2021 compatibility

<important if="you are adding a new snippet kind">
## Adding a New Snippet Kind
1. Add variant interface with `readonly kind:` literal in `snippet-model.ts`
2. Add to the `Snippet` union type
3. Add extension-based routing in `SnippetService.listFolder()` and `load()`
4. Add serialization arm in `SnippetService.save()`
5. Add render function or mark as non-renderable
6. Update exhaustive `switch (snippet.kind)` across codebase
</important>
