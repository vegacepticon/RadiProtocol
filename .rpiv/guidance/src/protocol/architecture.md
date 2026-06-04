# Protocol Layer Architecture

## Responsibility
On-disk document model for `.rp.json` protocol files: schema definition, pure parser (V1 JSON → runtime `ProtocolGraph`), Obsidian-vault CRUD store, and path resolution. The parser and document model are pure TypeScript (zero Obsidian imports, NFR-01). Only the store and resolver touch the vault.

## Dependencies
- **graph/graph-model**: Runtime types (`ProtocolGraph`, `RPNode`, `ParseResult`, `RPNodeKind`)
- **i18n**: Translator injection for parser error messages
- **utils/write-mutex**: Per-file-path write serialization
- **utils/vault-utils**: `ensureFolderPath` for safe folder creation
- **obsidian** (store + resolver only): `TFile`, `TFolder`, `App`, `Vault`

## Consumers
- **main.ts**: Constructs and wires parser, store, and resolver
- **views/protocol-editor-view.ts**: Holds `doc: ProtocolDocumentV1`, mutates node/edge records
- **views/node-picker-modal.ts**: Reads `ProtocolNodeRecord` for node selection
- **snippets/protocol-ref-sync.ts**: Cross-protocol snippet reference rewriting

## Module Structure
```
src/protocol/
├── protocol-document.ts         # On-disk schema (ProtocolDocumentV1, NodeRecord, EdgeRecord)
├── protocol-document-parser.ts  # Pure parser: V1 JSON → ProtocolGraph (never throws)
├── protocol-document-store.ts   # Vault CRUD + WriteMutex
└── protocol-file-resolver.ts    # Path normalization + recursive file walker (dual-strategy)
```

## Versioned Document Schema (Sentinel Fields)

```typescript
export const PROTOCOL_SCHEMA = 'radiprotocol.protocol' as const;
export const PROTOCOL_VERSION = 1 as const;

export interface ProtocolDocumentV1 {
  schema: typeof PROTOCOL_SCHEMA;    // sentinel — must equal exact string
  version: typeof PROTOCOL_VERSION;  // version — must equal integer
  id: string; title: string;
  nodes: ProtocolNodeRecord[];       // order-insensitive
  edges: ProtocolEdgeRecord[];       // order-insensitive
  // optional: viewport, layoutDirection, selfCheckEnabled, selfCheckItems
}

export interface ProtocolNodeRecord {
  id: string;
  kind: RPNodeKind | null;              // null = untyped authoring intermediate, skipped by parser
  fields: Record<string, unknown>;       // per-kind typed extraction happens in parser
  x: number; y: number; width: number; height: number;
  color?: string; text?: string;
}
```

- `isProtocolDocumentV1()` type guard checks schema + version sentinels, NOT per-node semantics.
- `createEmptyProtocolDocument(id, title, now = new Date())` — injectable clock for tests.

## Pure Parser with ParseResult (Never Throws)

```typescript
export class ProtocolDocumentParser {
  constructor(private readonly t: Translator = defaultT) {}  // injectable i18n

  parse(jsonString: string, filePath: string): ParseResult { /* never throws */ }
}

// Triple return from parseNode(): RPNode (valid) | null (skip untyped) | { parseError } (reject)
// All errors collected before returning — caller sees every problem at once
// Legacy compatibility: getString(fields, 'questionText', fallback, 'radiprotocol_questionText')
//   checks modern key first, then radiprotocol_* prefixed legacy key (one-way bridge)
```

## Vault Store (CRUD + WriteMutex)

```typescript
export class ProtocolDocumentStore {
  private readonly mutex = new WriteMutex(); // per-path serialized writes

  async read(path: string): Promise<ProtocolDocumentV1 | null>    // null = missing/invalid, never throws
  async write(path: string, doc: ProtocolDocumentV1): Promise<void> // mutex + ensure parent folder + trailing newline
  async update(path: string, mutator: (doc | null) => ProtocolDocumentV1): Promise<ProtocolDocumentV1>
  async create(folder: string, title: string, id: string): Promise<{ file: TFile; doc: ProtocolDocumentV1 }>
  async list(folder: string): Promise<TFile[]>                 // recursive walk, dual-strategy
  async delete(path: string): Promise<void>                    // fileManager.trashFile (soft delete)
}
```

- `write()` uses `JSON.stringify(doc, null, 2) + '\n'` — pretty-printed with trailing newline for clean diffs.
- `update()` is read-modify-write: mutator receives `ProtocolDocumentV1 | null`.
- `create()` sanitizes title (`/\` → `-`) to prevent path injection.
- `list()` has dual strategy: TFolder walk (fast) with `vault.getFiles()` fallback (test compatibility).

## Architectural Boundaries
- **NO Obsidian imports in document + parser**: Pure TypeScript, fully unit-testable without Obsidian stubs.
- **NO Result<T> in stores**: Stores return `null` for missing/invalid data.
- **NO unqueued DB ops**: All vault writes go through `WriteMutex.runExclusive()`.

<important if="you are adding a new field to an existing node kind">
## Adding a New Field to a Node Kind
1. Add the field (with `?` for optionality) to the interface in `graph-model.ts`
2. In `protocol-document-parser.ts`, add extraction in `parseNode()` switch case: `getString(fields, 'newField', fallback, 'radiprotocol_newField')`
3. If the field references another resource (like snippet path), add it to `protocol-ref-sync.ts`
4. Do NOT bump `PROTOCOL_VERSION` — adding optional fields is backward-compatible
</important>

<important if="you are writing or modifying tests for the protocol layer">
## Testing Conventions
- Pure modules (document, parser): construct directly, no mocking needed
- Store tests: use `makeVault()` + `makeApp()` mock factory (see `__tests__/protocol-document-store.test.ts`)
- Mock vault uses in-memory `Record<string, string>`, `vi.fn()` on every method
- Parser tests verify both success paths and error collection (multiple errors separated by `;`)
- Store tests verify both return values AND side effects on mock files
</important>