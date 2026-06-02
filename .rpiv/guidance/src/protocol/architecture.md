# Protocol Document Layer

## Responsibility
On-disk serialization and persistence for `.rp.json` protocol files. Owns the canonical schema, parsing (JSON string → `ProtocolGraph`), vault CRUD, file resolution, and remote library install.

## Dependencies
- **obsidian**: Vault I/O, `requestUrl`, `Notice`
- **graph-model**: Runtime types (`RPNode`, `RPNodeKind`, `ProtocolGraph`)
- **write-mutex / vault-utils**: Per-path concurrency, folder creation

## Consumers
- `main.ts` — wires parser, store, and library service
- `views/` — editor, library browser (types only)
- `snippets/` — protocol reference sync (`protocol-ref-sync.ts`)

## Module Structure
```
protocol/
├── protocol-document.ts          # Schema definition, type guard, factory
├── protocol-document-parser.ts   # Pure parser (JSON string → ParseResult)
├── protocol-document-store.ts    # Vault CRUD with WriteMutex
├── protocol-file-resolver.ts     # Stateless path resolution (Vault arg)
├── protocol-library-model.ts     # Remote library index types (pure)
└── protocol-library-service.ts   # Remote library fetch/install
```

## Versioned Document Schema

```typescript
// Factory + type guard — deterministic via optional `now: Date` parameter
export function createEmptyDocument(id: string, title: string, now = new Date()): DocumentV1 {
  return { schema: SCHEMA_ID, version: 1, id, title,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
    items: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
  };
}
```

## Pure Parser → Discriminated Result

```typescript
export type ParseResult =
  | { success: true; graph: ProtocolGraph }
  | { success: false; error: string };

// Never throws — errors are values
parser.parse(jsonString, filePath) // → ParseResult
```

## Mutex-Protected Vault Store

```typescript
// Per-path locking via WriteMutex; missing/corrupt files return null
store.read(path)           // → DocumentV1 | null
store.write(path, doc)     // → void (mutex-protected)
store.update(path, fn)     // → DocumentV1 (read-modify-write)
store.create(folder, title, id) // → { file, doc }
```

## Architectural Boundaries
- **NO Obsidian imports in model/parser files**: `protocol-document.ts` and `protocol-document-parser.ts` are pure — testable in Node.js
- **NO Result<T>**: Store returns `null` for missing/corrupt, never throws
- **NO unqueued vault writes**: Every write goes through `WriteMutex.runExclusive`

<important if="you are adding a new node kind to the parser">
## Adding a New Node Kind
1. Add kind string to `RPNodeKind` union in `graph-model.ts`
2. Add interface extending `RPNodeBase` with typed fields
3. Add `case` to `parseNode()` switch — use `getString()`/`getOptionalString()` for field extraction with legacy `radiprotocol_*` fallback
4. Add `case` to `nodeLabel()` in `graph/node-label.ts`
5. Write parser tests: modern fields, legacy fallback, missing optionals, unknown-kind rejection
</important>
