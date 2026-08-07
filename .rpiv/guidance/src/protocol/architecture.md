# Protocol Layer Architecture

## Responsibility
On-disk document model for `.rp.json` protocol files: versioned schema, pure parser (V1 JSON → runtime `ProtocolGraph`), Obsidian vault CRUD store, path resolution. Document + parser are pure TypeScript (zero Obsidian imports, NFR-01). Only store + resolver touch the vault.

## Dependencies
- **graph/graph-model**: `ProtocolGraph`, `RPNode`, `ParseResult`, `RPNodeKind`
- **i18n**: `Translator` (injected, English `defaultT` fallback)
- **utils/write-mutex**: per-file-path write serialization · **utils/vault-utils**: `ensureFolderPath`
- **obsidian** (store + resolver only): `TFile`, `TFolder`, `App`, `Vault`

## Consumers
- **main.ts**: constructs + wires parser, store, resolver
- **views/protocol-editor-view**: holds `ProtocolDocumentV1`, mutates node/edge records via `store.update()`
- **views/inline-runner-modal**: read → parse → validate → start
- **views/node-picker-modal**: reads `ProtocolNodeRecord` for start-point choices
- **snippets/protocol-ref-sync**: rewrites `fields.snippetPath` / `fields.subfolderPath`
- **library/library-model**: `PackageManifest` composes a `ProtocolDocumentV1` as a value

## Module Structure
```
src/protocol/
├── protocol-document.ts         # Versioned schema (ProtocolDocumentV1, *Record), factory, type guard
├── protocol-document-parser.ts  # Pure parser: V1 JSON → ProtocolGraph (never throws)
├── protocol-document-store.ts   # Vault CRUD + WriteMutex (Obsidian-coupled)
└── protocol-file-resolver.ts    # Path normalization + recursive file walker (dual-strategy)
```

## Versioned Document Schema (Sentinel Fields)

```typescript
export const PROTOCOL_SCHEMA = 'radiprotocol.protocol' as const;
export const PROTOCOL_VERSION = 1 as const;

export interface ProtocolDocumentV1 {
  schema: typeof PROTOCOL_SCHEMA;     // exact-string sentinel
  version: typeof PROTOCOL_VERSION;    // exact-integer sentinel
  id: string; title: string; createdAt: string; updatedAt: string;
  nodes: ProtocolNodeRecord[]; edges: ProtocolEdgeRecord[];  // order-insensitive
  // optional: viewport, layoutDirection, selfCheckEnabled, selfCheckItems
}

export interface ProtocolNodeRecord {
  id: string;
  kind: RPNodeKind | null;            // null = untyped authoring intermediate, skipped by parser
  fields: Record<string, unknown>;   // per-kind extraction happens in parser
  x: number; y: number; width: number; height: number; color?: string; text?: string;
}
```

`isProtocolDocumentV1()` is a **shallow envelope guard** — checks schema + version sentinels + top-level field types only. Does NOT validate node IDs, kinds, field semantics, or edge references. `createEmptyProtocolDocument(id, title, now?, rootId?)` — injectable clock + ID seams; seeds one Start node with inlined editor defaults (no `views/` import).

## Pure Parser with ParseResult (Never Throws)

```typescript
export class ProtocolDocumentParser {
  constructor(private readonly t: Translator = defaultT) {}
  parse(jsonString: string, filePath: string): ParseResult { /* never throws */ }
}
// parseNode() returns: RPNode (valid) | null (skip untyped) | { parseError } (reject)
// All node errors collected, joined by "; ", returned at once.
// Legacy compat: getString(fields, 'questionText', fallback, 'radiprotocol_questionText')
//   — modern camelCase key wins; radiprotocol_* legacy key is one-way bridge.
```

Parser drops dangling edges (endpoints that didn't survive node parsing) and skips untyped nodes silently — semantic validation is downstream.

## Vault Store (CRUD + WriteMutex) — Atomicity Caveat

```typescript
export class ProtocolDocumentStore {
  async read(path): Promise<ProtocolDocumentV1 | null>   // null = missing/invalid, never throws
  async write(path, doc): Promise<void>                   // mutex + ensure parent + trailing newline
  async update(path, mutator: (doc | null) => ProtocolDocumentV1): Promise<ProtocolDocumentV1>
  async create(folder, title, id): Promise<{ file: TFile; doc: ProtocolDocumentV1 }>
  async list(folder): Promise<TFile[]>                    // recursive walk, dual-strategy
  async delete(path): Promise<void>                      // fileManager.trashFile (soft delete)
}
```

- `write()` uses `JSON.stringify(doc, null, 2) + '\n'` — pretty-printed, trailing newline for clean diffs.
- `create()` sanitizes title (`/`, \` → `-`) to prevent path injection.
- **KNOWN LIMITATION**: `update()` is NOT atomic. It calls unlocked `read()` then separately locked `write()`. Two concurrent `update()` calls on the same path can both read the same old document and overwrite each other. Per-path writes are serialized; the full read-modify-write cycle is not. For true atomicity, acquire the path lock around all three operations using unlocked internal helpers.

## File Resolver (Normalize-Then-Walk)

```typescript
export function normalizeProtocolFolderPath(input: string): string  // trim, \→/, strip leading/trailing /
export function resolveProtocolDocumentFiles(vault, configuredPath): TFile[]
// empty normalized folder → [] (disabled). store.list('') → scans whole vault.
// TFolder.children walk (fast) with vault.getFiles() + 'folder/' prefix fallback (test compat)
// matches by full '.rp.json' suffix (endsWith), NOT TFile.extension
```

## Architectural Boundaries
- **NO Obsidian imports in document + parser**: pure TypeScript, unit-testable without stubs.
- **NO `Result<T>` in stores**: stores return `null` for missing/invalid.
- **NO unqueued vault writes**: all writes through `WriteMutex.runExclusive()`.
- **Factory never imports views**: editor visual defaults are duplicated with a cross-reference comment.
- **Composability, not inheritance**: `library/library-model.ts` wraps `ProtocolDocumentV1` as a value, never extends it.

<important if="you are adding a new field to an existing node kind">
## Adding a New Field to a Node Kind
1. Add the field (with `?` for optionality) to the interface in `graph-model.ts`
2. In `protocol-document-parser.ts` `parseNode()` switch, add extraction: `getString(fields, 'newField', fallback, 'radiprotocol_newField')`
3. If the field references another resource (snippet path), add it to `protocol-ref-sync.ts` rewrite targets
4. Do NOT bump `PROTOCOL_VERSION` — adding optional fields is backward-compatible
</important>

<important if="you are writing or modifying tests for the protocol layer">
## Testing Conventions
- Pure modules (document, parser): construct directly, no mocking
- Store tests: `makeVault()` + `makeApp()` mock factory (see `__tests__/protocol-document-store.test.ts`); mock vault is in-memory `Record<string, string>`, `vi.fn()` on every method
- Verify both return values AND side effects on mock files
- Parser tests cover success paths AND error collection (multiple errors joined by `;`)
</important>
