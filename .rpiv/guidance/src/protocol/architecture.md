# Protocol Layer Architecture

## Responsibility
`src/protocol/` is the boundary between canonical `.rp.json` documents and runtime `ProtocolGraph` values. The document model, parser, and migration are pure; the store and resolver are the Obsidian vault shell.

## Dependencies
- **`graph/`**: runtime node kinds, graph result types, and topology.
- **`i18n/Translator`**: injected parser diagnostics.
- **`utils/WriteMutex` and vault helpers**: serialized writes and parent-folder creation.
- **Obsidian**: `App`, `Vault`, `TFile`, and `TFolder` only in store/resolver modules.

## Consumers
`main.ts` wires the store/parser/resolver; views edit or execute documents; snippets rewrite references; library packages compose a document value and revalidate installed copies.

## Module Structure
```
protocol-document.ts          # V1 schema, factory, shallow envelope guard
protocol-document-parser.ts   # pure JSON/record → ProtocolGraph parser
protocol-document-migration.ts# pure, idempotent legacy-loop conversion
protocol-document-store.ts    # vault CRUD, migration persistence, mutex
protocol-file-resolver.ts     # normalized recursive .rp.json enumeration
```

## Versioned Envelope and Shallow Guard
```typescript
export const PROTOCOL_SCHEMA = 'radiprotocol.protocol' as const;
export const PROTOCOL_VERSION = 1 as const;
interface ProtocolDocumentV1 {
  schema: typeof PROTOCOL_SCHEMA; version: typeof PROTOCOL_VERSION;
  id: string; title: string; createdAt: string; updatedAt: string;
  nodes: ProtocolNodeRecord[]; edges: ProtocolEdgeRecord[];
}
function isProtocolDocumentV1(value: unknown): value is ProtocolDocumentV1 {
  // Envelope/arrays only; node semantics are downstream.
  return isRecord(value) && value.schema === PROTOCOL_SCHEMA
    && value.version === PROTOCOL_VERSION && typeof value.id === 'string'
    && Array.isArray(value.nodes) && Array.isArray(value.edges);
}
```
The factory seeds a Start record and duplicates editor defaults intentionally; protocol code must not import `views/`.

## Pure Parse and Migration Boundary
```typescript
class ProtocolDocumentParser {
  constructor(private readonly t: Translator = defaultT) {}
  parse(raw: string, filePath: string): ParseResult {
    let value: unknown;
    try { value = JSON.parse(raw); }
    catch { return { success: false, error: this.t('protocol.parseFailed') }; }
    if (!isProtocolDocumentV1(value)) return { success: false, error: this.t('protocol.invalidDocument') };
    return this.parseDocument(value, filePath); // skip untyped; collect recognized errors
  }
}
const { document, changed } = migrateProtocolDocument(value, now);
// Store persists changed legacy records before parsing.
```
The source catches JSON decoding only. Because the envelope guard is shallow, malformed nested array elements can still throw inside `parseDocument()`; do not promise total protection for arbitrary nested input. Modern field keys win over `radiprotocol_*` compatibility keys by checking `!== undefined`. Standalone loop records and prefixed exit labels are converted only by the pure migration; `loop-start`/`loop-end` remain parseable so validation can report migration-required data.

## Vault Store and Atomicity Boundary
```typescript
async write(path: string, document: ProtocolDocumentV1): Promise<void> {
  await this.mutex.runExclusive(path, async () => {
    await ensureFolderPath(this.app.vault, parentOf(path));
    await this.app.vault.adapter.write(path, JSON.stringify(document, null, 2) + '\n');
  });
}
async update(path: string, mutate: Mutator): Promise<ProtocolDocumentV1> {
  const next = mutate(await this.read(path)); // read is outside write lock
  await this.write(path, next);
  return next;
}
```
`read()` returns `null` for missing, malformed, or migration-persistence failure; writes propagate errors. `update()` bundles a caller’s document mutation into one write, but is not an atomic read-modify-write across concurrent callers.

## Normalize-Then-Walk Resolution
```typescript
function resolveProtocolDocumentFiles(vault: Vault, configured: string): TFile[] {
  const root = normalizeProtocolFolderPath(configured);
  if (root === '') return []; // empty setting disables selection
  const folder = vault.getAbstractFileByPath(root);
  return folder instanceof TFolder
    ? walk(folder).filter(file => file.path.endsWith('.rp.json'))
    : vault.getFiles().filter(file => file.path.startsWith(root + '/')
        && file.path.endsWith('.rp.json'));
}
```
The resolver normalizes separators and edge slashes, prefers a folder-child walk, and falls back to the vault index. It enumerates files only; parsing, migration, and graph validation happen later.

## Architectural Boundaries
- Do not import Obsidian into the document, parser, or migration modules.
- Do not put graph semantics in the shallow envelope guard.
- Store deletes use Obsidian trash; all vault writes go through a keyed mutex.
- `ProtocolDocumentV1` is composed as a value by library manifests, never extended.

<important if="you are adding a protocol field or node capability">
## Adding a Protocol Field
1. Choose document-level state versus `node.fields` and add the typed runtime property if needed.
2. Extract the canonical key in the parser; preserve explicit `false`, empty arrays, and empty strings.
3. Add a compatibility alias only for a real legacy document and use migration for structural rewrites.
4. Update graph validation, runner/render/view consumers, reference sync, locales, and tests as applicable.
5. Do not bump version for a genuinely optional backward-compatible field.
</important>

<important if="you are writing or modifying tests for the protocol layer">
- Test document/parser/migration directly with typed builders and deterministic clocks.
- Store tests use `makeVault()`/`makeApp()` and assert both returned values and persisted bytes/call counts.
- Cover canonical-first compatibility, collected parse errors, dangling-edge filtering, migration idempotence, resolver suffix/path behavior, and the known update race contract.
</important>
