---
date: 2026-07-28T09:09:24+0300
author: Roman Shulgha
commit: 840487e
branch: main
repository: RadiProtocol
topic: "Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag"
tags: [design, graph, protocol, runner, render, editor, picker, i18n, migration]
status: ready
parent: .rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md
last_updated: 2026-07-28T09:09:24+0300
last_updated_by: Roman Shulgha
---

# Design: Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag

## Summary
Fold the standalone `LoopNode` into `QuestionNode` via a `loop?: boolean` toggle, and replace the `+`-prefix exit-label convention with an explicit `edge.isLoopExit?: boolean` flag carried on both the serialized `ProtocolEdgeRecord` and the runtime `RPEdge`. A lossless, idempotent, one-time migration runs inside `ProtocolDocumentStore.read()` (pure transform module + persist via the existing `WriteMutex`-protected `write()`), so every read path — editor load, start-from-node, and the inline runner's later raw vault re-read — sees the canonical document. The runner FSM, picker render, validator, editor, and node picker are rewired to recognize loop behavior through `QuestionNode.loop` and exit behavior through `RPEdge.isLoopExit`; the `+`-prefix label helpers are removed entirely.

## Requirements
- Merge standalone `Loop` node kind into `Question` via `loop?: boolean`; `questionText` becomes the single prompt field; `LoopNode` and `headerText` are removed from the canonical runtime model.
- Replace `+`-prefix exit-edge labels with an explicit `isLoopExit?: boolean` on edges (serialized + runtime); migration strips the `+` prefix from legacy exit labels and sets the flag.
- Auto-migrate existing `.rp.json` documents on open: transform legacy `kind === 'loop'` nodes into `kind === 'question'` + `fields.loop = true` + `fields.questionText = headerText`, and reclassify their outgoing `+`-prefixed edges by stripping the prefix and setting `isLoopExit = true`. Persist the migrated document before returning from `read()`.
- Migration is lossless (preserve metadata, IDs, endpoints, geometry, colors, raw text, viewport, layout direction, and unknown extension fields), idempotent (second read does not write), and fail-safe (transform/persistence failure → `read()` returns `null`, matching existing load-failed UX).
- Remove standalone `loop` from the canonical `RPNodeKind`; the parser removes `'loop'` from `VALID_KINDS` (no parser compat arm — store migration is the sole legacy bridge, consistent with "no prefix fallback").
- Remove `isExitEdge` / `isLabeledEdge` / `stripExitPrefix` from `node-label.ts`; rewire all consumers to `edge.isLoopExit`.
- Authoring: remove the Loop entry from the node-creation grid; looped questions are created by adding a Question and enabling a loop toggle in its edit modal; a canvas badge marks looped questions.
- Validator: loop exit/body invariants key on `kind === 'question' && node.loop`; dead-end check skips looped questions; unintentional-cycle exemption keys on looped questions; remove prefix-specific branches (`loopNoExitWithLegacy`, `loopExitNoLabel`).
- Runner: `advanceThrough` `case 'question'` branches on `node.loop` (loop entry/re-entry/picker halt); remove `case 'loop'`; `chooseLoopBranch` and quick-exit check `edge.isLoopExit`.
- Render loop picker: guard on `question + loop`; render `questionText` as the header; exit classification via `edge.isLoopExit`; exit caption = `edge.label` verbatim (no prefix stripping).
- i18n: synchronized en + ru — remove standalone-Loop labels; add loop-toggle + badge strings; reword validator messages to reference the loop toggle + explicit exit flag.
- Test + fixture recasting is atomic with the type removal and capped by a grep audit certifying no stale `case 'loop'` / `kind === 'loop'` / `headerText` / prefix-helper literals remain (except intentional migration-boundary references).

## Current State Analysis
The current implementation has a standalone `LoopNode` (`src/graph/graph-model.ts:53-63`) storing its prompt in `headerText`, with loop exits derived exclusively from a leading `+` in the edge label (`src/graph/node-label.ts:65-101`). The runtime FSM is already reusable after loop entry: `AwaitingLoopPickState` stores only a node ID, `LoopContext` stores primitive frame data, and branch selection, re-entry, dead-end return, nested-loop behavior, stepBack, and redo are independent of `LoopNode.headerText` (`src/runner/runner-state.ts:43-58`, `src/graph/graph-model.ts:95-113`, `src/runner/protocol-runner.ts:243-361,763-879`).

The parser reconstructs edges explicitly (`src/protocol/protocol-document-parser.ts:105-138`), so a new edge flag must be copied where the runtime `RPEdge` is created. Optional booleans have three meaningful parser outcomes (true / false / absent) but no boolean helper exists yet (`src/protocol/protocol-document-parser.ts:38-55`). The V1 envelope guard is intentionally shallow and does not inspect node kinds (`src/protocol/protocol-document.ts:149-164`), so legacy `'loop'` records reach `read()` after `'loop'` is removed from `RPNodeKind`.

`ProtocolDocumentStore.read()` is the common seam for editor load and start-from-node selection; persisting there ensures the inline runner's later raw vault read sees the migrated document (`src/protocol/protocol-document-store.ts:34-49`, `src/views/protocol-editor-view.ts:561-580`, `src/main.ts:266-289`, `src/views/inline-runner-modal.ts:147-180`).

### Key Discoveries
- **Parallel test parse path**: `src/__tests__/helpers/canvas-parser.ts` is a test-only parser with its own `VALID_KINDS`, `case 'loop'` arm, and `LoopNode`/`LoopStartNode`/`LoopEndNode` construction; it builds runtime graphs from the `.canvas` fixtures and must be recast alongside the production parser. The `.canvas` fixtures (`src/__tests__/fixtures/unified-loop-*.canvas`, `loop-body.canvas`, `loop-start.canvas`) are parsed by this helper.
- **No on-read-migration precedent**: `ProtocolDocumentStore.read()` is pure today; no git-history precedent exists for a read-with-side-effect-write. Closest analog: `src/snippets/protocol-ref-sync.ts:64-100` (read-transform-write under `WriteMutex`, `mutated`-flag skip-on-noop). The design leans on `WriteMutex` + exact-shape idempotency discriminator + fallback-on-error + the existing store test seam.
- **`update()` double-write interaction**: `update()` (`protocol-document-store.ts:73-82`) calls `read()` (unmutexed) then `write()` (mutexed). With migration-in-`read()`, a first edit of a legacy document causes two sequential mutexed writes (migration, then edit) — not a deadlock (the mutex is non-reentrant but `update()` doesn't hold it during `read()`), not a race between the two (they're awaited sequentially).
- **`+`-prefix persistence bug history**: commits `0ff2587`, `50a7fcb`, `f5850c0` fixed three persistence bugs (discard `update()` return / strip `+`-labels when target wasn't a loop / stale DOM after save). The `isLoopExit` wiring must preserve all three corrections already live at `src/views/protocol-editor-view.ts:2077-2112`: assign `this.doc = updated`, preserve the flag regardless of target kind, reload via `loadProtocol()` after save.
- **Free-text-input excision lesson**: stale parser arms survived 25 days after type removal because the parallel `.rp.json` path was untested dead code. For `loop` (live in `.rp.json`), an incomplete sweep will actively misroute real documents — so the sweep + test recasting must be atomic and grep-audited across both parse paths, the writer (none — editor mutators inline `JSON.stringify`), validator, runner, picker, editor, inline runner, and tests.
- **`isLabeledEdge` has no other production consumer** beyond the loop-validation block (`src/graph/graph-model.ts` research finding; confirmed by integration scan) — safe to remove with the prefix convention.
- **Idempotency discriminator**: exact legacy `kind === 'loop'` node shape (not version, not prefix scanning). Capture legacy loop node IDs first; reclassify only their outgoing `+`-prefixed edges. The migration writes the whole document in one `write()` call, so the transform is atomic — partial-migrated state cannot arise from the migration itself.

## Scope

### Building
- Graph-layer type changes: `RPNodeKind` (remove `'loop'`), `QuestionNode.loop`, `RPEdge.isLoopExit`, remove `LoopNode`/`headerText`.
- `node-label.ts`: remove `case 'loop'` + `isExitEdge`/`isLabeledEdge`/`stripExitPrefix`.
- Parser: `getOptionalBoolean` helper; `loop` on `case 'question'`; `isLoopExit` copied through edge reconstruction; remove `'loop'` from `VALID_KINDS` + `case 'loop'`.
- Migration: new pure `protocol-document-migration.ts` + `ProtocolDocumentStore.read()` wiring (persist on change, failure → null).
- Validator: loop pass keyed on looped Question; dead-end skip; cycle exemption; remove prefix branches; reword messages.
- Runner: `case 'question'` loop branch; remove `case 'loop'`; `chooseLoopBranch` + quick-exit via `edge.isLoopExit`.
- Render loop picker: guard on `question+loop`; `questionText` header; `edge.isLoopExit` classification; verbatim exit label.
- Editor: remove Loop from grid/defaults; loop toggle in Question edit modal; canvas badge; edge-modal checkbox keyed on `fromNode.fields.loop` + `edge.isLoopExit`; remove `+`-prefix helpers; label-display policy via `isLoopExit`.
- Node picker: remove loop from `StartableNodeKind`/`KIND_LABELS`/`KIND_ORDER`/`KIND_LABEL_KEYS`/`buildNodeOptions`; drop `LoopNode` import + `headerText` fallback.
- i18n (en + ru): remove standalone-Loop labels; add toggle + badge strings; reword validator messages.
- Styles: remove `[data-node-kind="loop"]` choice selector; add loop-badge style; keep loop-picker button classes.
- Test + fixture recasting across all affected suites; canvas-parser helper recast; `.canvas` fixture recast; grep audit; `npm run check`.

### Not Building
- README/documentation updates (the `README.md:16` loop mention is out of scope — non-load-bearing).
- `'loop-start'` / `'loop-end'` legacy kinds remain parseable and rejected by the validator (MIGRATE-01) — untouched.
- Snippet / answer / text-block / start node kinds — untouched.
- No new runner state, no new `LoopContext` shape, no `PROTOCOL_VERSION` bump (adding optional fields + a one-time transform is backward-compatible).
- No sidebar/RunnerView (ADR-0001 inline-only runner unchanged).
- No snippet-ref-sync changes (loop nodes carry no snippet references).

## Decisions

### D-01: Migration transform in a pure module
**Ambiguity**: Should the lossless migration transform live in a new pure module or inline inside `ProtocolDocumentStore.read()`?
**Explored**: (A) New pure `src/protocol/protocol-document-migration.ts` — follows NFR-01 pure-vs-Obsidian split, unit-testable without Obsidian mocks, mirrors `protocol-ref-sync.ts:64-100` read-transform-write idiom. (B) Inline in `read()` — fewer files but couples pure transform logic to the Obsidian-dependent store.
**Decision**: (A) — new pure module `protocol-document-migration.ts` exporting `migrateProtocolDocument(doc) → { doc, changed }`; `read()` calls it and persists on `changed`. (Developer checkpoint — directional confirm approved.)

### D-02: Loop authoring UX — toggle + badge
**Ambiguity**: How does an author create and recognize a looped question after removing the standalone Loop node-kind button?
**Explored**: (A) Remove Loop from the creation grid (`EDITABLE_NODE_KINDS:256`, `NODE_KIND_DEFAULTS:252`); looped questions created by adding a Question and checking a loop toggle in its edit modal (`openEditModal case 'question':2348-2353`); a canvas badge marks looped questions (`renderNode:929-984`). (B) Keep a dedicated "Loop" creation-grid entry that pre-creates a Question with `loop: true`.
**Decision**: (A) — toggle + badge, per the research Developer Context. (Developer checkpoint — directional confirm approved.)

### D-03: Remove `+`-prefix helpers entirely
**Ambiguity**: Should `isExitEdge` / `isLabeledEdge` / `stripExitPrefix` (`node-label.ts:60-101`) be removed entirely or retained as a secondary detection alongside `edge.isLoopExit`?
**Explored**: (A) Full removal + rewire all consumers (validator `graph-validator.ts:123-149`, runner `protocol-runner.ts:265,750`, render `render-loop-picker.ts:49,52`, editor `protocol-editor-view.ts:273-284`) to `edge.isLoopExit`. (B) Retain as secondary detection — creates two sources of truth for exit-ness.
**Decision**: (A) — full removal. `isLabeledEdge` has no other production consumer. (Developer checkpoint — directional confirm approved.)

### D-04: Parser removes `'loop'` from VALID_KINDS (no compat arm)
**Ambiguity**: The research Architecture Insights say `'loop'` should "remain an accepted raw V1 wire literal at migration/parser boundaries", but its Developer Context says "migration is the only legacy bridge" and "no prefix fallback". These conflict: a parser `'loop'` compat arm would also have to detect `+`-prefixes on edges to mark `isLoopExit` (otherwise the converted looped Question has no exits), contradicting "no prefix fallback".
**Explored**: (A) Remove parser compat — parser removes `'loop'` from `VALID_KINDS` (`protocol-document-parser.ts:27-36,231-238`); store migration is the sole bridge. Every production entry point goes through `read()` first (`main.ts:266-289`, `protocol-editor-view.ts:561-580`), which migrates + persists before the inline runner's raw re-read (`inline-runner-modal.ts:147-180`). A direct parse of an unmigrated legacy file rejects with `unknownKind` — only reachable in tests, which use migrated fixtures. (B) Keep parser compat arm + `+`-edge detection — defense-in-depth but retains a prefix fallback, contradicting D-03.
**Decision**: (A) — remove parser compat. Consistent with D-03 ("no prefix fallback") and "migration is the only legacy bridge". (Developer checkpoint — genuine ambiguity resolved.)

### D-05: Migration failure policy — return null
**Decision**: A migration transform or persistence failure is treated as a load failure: `read()` logs and returns `null`, matching the existing `read()` contract and the load-failed UX at `protocol-editor-view.ts:568-576` and `main.ts:266-279`. Swallowing the write failure and returning an in-memory-migrated document would break the stated persistence invariant (the inline runner re-reads raw vault text and would see the still-legacy file). (Confirmed by codebase-analyzer; consistent with the research NFR "fallback-on-error leaves the document unmodified".)

### D-06: Optional boolean parser helper preserves three states
**Decision**: Add `getOptionalBoolean(obj, key, legacyKey?)` mirroring `getOptionalString`/`getSeparator` (`protocol-document-parser.ts:38-55`): obtain the raw value via `getCompatValue` (which tests `!== undefined`, so explicit `false` is preserved and suppresses the legacy fallback), return `v` when `typeof v === 'boolean'`, else `undefined`. This preserves `true`, `false`, and absence distinctly; truthiness coercion is forbidden.

### D-07: Validator skips deadEndQuestion for looped questions
**Decision**: The generic dead-end check (`graph-validator.ts:102-110`) skips `kind === 'question' && node.loop` — a zero-edge looped question receives the loop-specific "no exit / no body" errors, not both. The loop pass keys on `kind === 'question' && node.loop` (`graph-validator.ts:112-158`); the unintentional-cycle exemption (`graph-validator.ts:232-268`) keys on the same predicate. Prefix-specific branches (`loopNoExitWithLegacy`, `loopExitNoLabel`) are removed; `loopNoExit` and `loopNoBody` remain, reworded to reference the loop toggle + explicit exit flag.

### D-08: Exit-edge caption = edge label verbatim
**Decision**: After migration strips the `+` prefix and sets `isLoopExit`, an exit edge's label is already the clean caption. `renderLoopPicker` renders the exit caption as `edge.label` (verbatim) — no `stripExitPrefix`. Body-edge caption remains `nodeLabel(target)`. An exit edge with `isLoopExit: true` and an empty label renders an empty caption (same as any unlabeled edge); the removed `loopExitNoLabel` prefix-specific check has no semantic basis under explicit metadata.

## Architecture

### src/graph/graph-model.ts — MODIFY

Region A — file header comment (replaces the stale "Phase 43 D-01: unified 'loop' kind добавлен" lines):
```typescript
// The standalone 'loop' kind was merged into 'question' via QuestionNode.loop
// (loop toggle). 'loop-start' / 'loop-end' remain as legacy parseable kinds
// (validator emits MIGRATE-01); LoopStartNode / LoopEndNode keep @deprecated JSDoc.
```

Region B — `RPNodeKind` union (the `| 'loop';` member + its comment DELETED; legacy loop-start/loop-end retained):
```typescript
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'text-block'
  | 'loop-start'      // @deprecated Phase 43 D-03 — legacy parseable for migration-error (D-07)
  | 'loop-end'        // @deprecated Phase 43 D-03 — legacy parseable for migration-error (D-07)
  | 'snippet';
```

Region C — `QuestionNode` (add `loop?: boolean`):
```typescript
export interface QuestionNode extends RPNodeBase {
  kind: 'question';
  questionText: string;
  /**
   * Loop toggle. When `true`, this question behaves as a loop node: the runner
   * halts at a branch picker over its outgoing edges, supports nested re-entry,
   * and pops the loop frame on an `isLoopExit` edge. Absent or `false` = ordinary
   * question that halts at `at-node` awaiting `chooseAnswer`. Migrated from the
   * removed standalone `LoopNode` (legacy `headerText` → `questionText`,
   * `kind: 'loop'` → `kind: 'question'` + `loop: true`).
   */
  loop?: boolean;
}
```

Region D — the entire `LoopNode` interface block (with its Phase 43 D-02 JSDoc) is DELETED. No replacement.

Region E — `RPNode` union (the `| LoopNode;` member DELETED):
```typescript
export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | TextBlockNode
  | LoopStartNode     // @deprecated — legacy, см. interface JSDoc
  | LoopEndNode       // @deprecated — legacy, см. interface JSDoc
  | SnippetNode;      // Phase 29
```

Region F — `RPEdge` (add `isLoopExit?: boolean`):
```typescript
export interface RPEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  /**
   * Loop-exit flag. When `true`, traversing this edge pops the current loop frame
   * (runner, validator, and picker classify it as an exit). Absent or `false` =
   * body branch. Replaces the former `+`-prefix label convention; the one-time
   * migration strips the `+` prefix from legacy exit labels and sets this flag.
   */
  isLoopExit?: boolean;
}
```

### src/graph/node-label.ts — MODIFY

Region A — import (`RPEdge` dropped — unused after the predicate functions are removed):
```typescript
import type { RPNode } from './graph-model';
```

Region B — the `nodeLabel` switch's `case 'loop'` arm + its comment are DELETED. The preceding `case 'snippet'` block and the switch's closing brace remain. The remaining arms (start, question, answer, text-block, loop-start, loop-end, snippet) are exhaustive over the reduced `RPNodeKind` union. The module header comment (Phase 49 D-13 shared label extractor) is retained — it describes `nodeLabel` only and remains accurate.

Region C — the three exported functions `isLabeledEdge`, `isExitEdge`, and `stripExitPrefix` (together with ALL their JSDoc blocks) are DELETED. The file ends after the `nodeLabel` function's closing brace.

### src/protocol/protocol-document.ts — MODIFY

Region A — `ProtocolEdgeRecord` (add `isLoopExit?: boolean`):
```typescript
export interface ProtocolEdgeRecord {
  /** Unique edge ID within the document. */
  id: string;
  /** Source node ID. Must reference an existing node. */
  fromNodeId: string;
  /** Target node ID. Must reference an existing node. */
  toNodeId: string;
  /** Optional edge label (shown on connector in visual editor and runner). */
  label?: string;
  /**
   * Loop-exit flag. When `true`, traversing this edge pops the current loop frame.
   * Absent or `false` = body branch. Replaces the former `+`-prefix label
   * convention. The one-time migration sets this flag on legacy `+`-prefixed
   * outgoing edges of `kind: 'loop'` nodes (now migrated to looped questions).
   */
  isLoopExit?: boolean;
}
```

Region B — `ProtocolNodeRecord.fields` JSDoc (replace the `headerText` key with `loop`):
```typescript
   * Typed node fields. Keys are camelCase without prefix:
   * - questionText, answerText, displayLabel, content, separator,
   *   loop, subfolderPath, snippetLabel, snippetSeparator, snippetPath.
```

### src/protocol/protocol-document-parser.ts — MODIFY

Region A — type imports (remove `LoopNode,`):
```typescript
import type {
  RPNode,
  RPNodeKind,
  RPEdge,
  ProtocolGraph,
  ParseResult,
  StartNode,
  QuestionNode,
  AnswerNode,
  TextBlockNode,
  LoopStartNode,
  LoopEndNode,
  SnippetNode,
} from '../graph/graph-model';
```

Region B — `VALID_KINDS` (remove the `'loop',` entry; loop-start/loop-end retained):
```typescript
const VALID_KINDS: RPNodeKind[] = [
  'start',
  'question',
  'answer',
  'text-block',
  'snippet',
  'loop-start',
  'loop-end',
];
```

Region C — add `getOptionalBoolean` helper immediately after `getSeparator`:
```typescript
/**
 * Optional boolean with three distinct outcomes: `true`, `false`, and `undefined`
 * (absent or non-boolean input). Truthiness coercion is forbidden — it would
 * collapse explicit `false` into absence. `getCompatValue` tests `!== undefined`,
 * so an explicit `false` value suppresses the legacy-key fallback, matching the
 * semantics of `getOptionalString` / `getSeparator`.
 */
function getOptionalBoolean(obj: Record<string, unknown>, key: string, legacyKey?: string): boolean | undefined {
  const v = getCompatValue(obj, key, legacyKey);
  return typeof v === 'boolean' ? v : undefined;
}
```

Region D — `case 'question'` arm (add `loop`):
```typescript
      case 'question': {
        const node: QuestionNode = {
          ...base,
          kind: 'question',
          questionText: getString(fields, 'questionText', raw.text ?? '', 'radiprotocol_questionText'),
          loop: getOptionalBoolean(fields, 'loop', 'radiprotocol_loop'),
        };
        return node;
      }
```

Region E — the `case 'loop': { const node: LoopNode = { ...base, kind: 'loop', headerText: getString(fields, 'headerText', '', 'radiprotocol_headerText') }; return node; }` arm is DELETED. The `case 'loop-start'` and `case 'loop-end'` arms that follow it remain unchanged.

Region F — edge reconstruction (add `isLoopExit` copy):
```typescript
      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNodeId,
        toNodeId: rawEdge.toNodeId,
        label: typeof rawEdge.label === 'string' ? rawEdge.label : undefined,
        isLoopExit: rawEdge.isLoopExit === true ? true : undefined,
      });
```

### src/protocol/protocol-document-migration.ts — NEW

Pure, side-effect-free migration of legacy `.rp.json` documents to the canonical post-merge shape. Called by `ProtocolDocumentStore.read()`, which persists via the existing `write()`/`WriteMutex` path. Idempotent — no legacy `kind === 'loop'` nodes → `{ changed: false }`, same reference.

Compatibility-boundary note: `ProtocolNodeRecord.kind` is typed `RPNodeKind | null`, and `'loop'` is NO LONGER in canonical `RPNodeKind` (removed in the merge). Raw V1 JSON may still carry legacy `kind: 'loop'` records because the V1 envelope guard is intentionally shallow. This module casts `node.kind` to `string | null` for the legacy discriminator — this is the migration boundary, not the canonical layer.
```typescript
// src/protocol/protocol-document-migration.ts
import type { ProtocolDocumentV1, ProtocolNodeRecord, ProtocolEdgeRecord } from './protocol-document';

/** Strip the leading `+` control prefix from a legacy loop-exit edge label.
 *  Mirrors the former `stripExitPrefix` (node-label.ts, removed): outer trim,
 *  remove exactly one `+`, then strip whitespace immediately following it. */
function stripLegacyExitPrefix(label: string): string {
  return label.trim().slice(1).replace(/^\s+/, '');
}

/**
 * Migrate a legacy `.rp.json` document to the canonical post-merge shape.
 *
 * Transform (applied only when at least one node has exact legacy `kind === 'loop'`):
 *   - Each `kind: 'loop'` node → `kind: 'question'` with
 *     `fields.questionText = fields.headerText ?? ''`, `fields.loop = true`,
 *     and `fields.headerText` removed. All other node fields, geometry, color,
 *     text, and unknown extension fields are preserved.
 *   - Each outgoing edge of a legacy loop node whose label starts with `+`
 *     (after trim) → label stripped of the `+` prefix (empty result →
 *     `undefined`), `isLoopExit = true`. Edges from non-loop nodes are NEVER
 *     reclassified — only edges whose `fromNodeId` is a captured legacy loop
 *     node ID are touched, so unrelated user labels beginning with `+` are
 *     left intact.
 *   - `updatedAt` bumped to `now()` (injectable for tests; default
 *     `new Date().toISOString()`).
 *
 * Idempotent: if no node has legacy `kind === 'loop'`, returns
 * `{ doc, changed: false }` without allocating a new document (same reference).
 * Lossless: layered spreads (`...doc`, `...node`, `...node.fields`, `...edge`)
 * preserve metadata, IDs, endpoints, geometry, colors, raw text, viewport,
 * layout direction, self-check state, and unknown extension fields.
 */
export function migrateProtocolDocument(
  doc: ProtocolDocumentV1,
  now: () => string = () => new Date().toISOString(),
): { doc: ProtocolDocumentV1; changed: boolean } {
  const legacyLoopIds = new Set<string>();
  for (const node of doc.nodes) {
    if ((node.kind as string | null) === 'loop') legacyLoopIds.add(node.id);
  }
  if (legacyLoopIds.size === 0) {
    return { doc, changed: false };
  }

  const migratedNodes: ProtocolNodeRecord[] = doc.nodes.map((node) => {
    if ((node.kind as string | null) !== 'loop') return node;
    const fields =
      typeof node.fields === 'object' && node.fields !== null
        ? { ...(node.fields as Record<string, unknown>) }
        : {};
    const headerTextValue = typeof fields['headerText'] === 'string' ? fields['headerText'] : '';
    delete fields['headerText'];
    return {
      ...node,
      kind: 'question',
      fields: {
        ...fields,
        questionText: headerTextValue,
        loop: true,
      },
    };
  });

  const migratedEdges: ProtocolEdgeRecord[] = doc.edges.map((edge) => {
    if (!legacyLoopIds.has(edge.fromNodeId)) return edge;
    if (typeof edge.label !== 'string') return edge;
    const trimmed = edge.label.trim();
    if (!trimmed.startsWith('+')) return edge;
    const caption = stripLegacyExitPrefix(edge.label);
    return {
      ...edge,
      label: caption === '' ? undefined : caption,
      isLoopExit: true,
    };
  });

  return {
    doc: {
      ...doc,
      nodes: migratedNodes,
      edges: migratedEdges,
      updatedAt: now(),
    },
    changed: true,
  };
}
```

### src/protocol/protocol-document-store.ts — MODIFY

Region A — add import near the existing `./protocol-document` import:
```typescript
import { migrateProtocolDocument } from './protocol-document-migration';
```

Region B — `read()` method body (the existing try-block gains a migration step before returning; the whole migration+write stays inside the existing `try/catch` so a migration or persistence failure returns `null` per D-05):
```typescript
  async read(protocolPath: string): Promise<ProtocolDocumentV1 | null> {
    const exists = await this.app.vault.adapter.exists(protocolPath);
    if (!exists) return null;

    try {
      const raw = await this.app.vault.adapter.read(protocolPath);
      const parsed = JSON.parse(raw) as unknown;
      if (!isProtocolDocumentV1(parsed)) {
        console.warn(`[RadiProtocol] ProtocolDocumentStore.read: invalid schema in ${protocolPath}`);
        return null;
      }
      // One-time lossless migration of legacy `kind: 'loop'` nodes → looped
      // questions and `+`-prefix exit labels → `isLoopExit`. Persist the migrated
      // document before returning so the inline runner's later raw vault re-read
      // sees the canonical form. Idempotent — a document with no legacy loop
      // nodes triggers no write. Migration/persistence failure → return null
      // (load-failed UX), matching the existing read() contract.
      const { doc: migrated, changed } = migrateProtocolDocument(parsed);
      if (changed) {
        await this.write(protocolPath, migrated);
      }
      return migrated;
    } catch (err) {
      console.error(`[RadiProtocol] ProtocolDocumentStore.read failed for ${protocolPath}:`, err);
      return null;
    }
  }
```

### src/graph/graph-validator.ts — MODIFY

Region A — import (remove the prefix helpers; keep `nodeLabel`):
```typescript
import { nodeLabel as sharedNodeLabel } from './node-label';
```

Region B — dead-end check (skip looped questions — they get loop-specific errors instead):
```typescript
    // Check 5: Dead-end questions — question nodes with no outgoing edges.
    // A looped question (loop === true) is handled by the loop exit/body pass
    // below; it must NOT also receive the generic dead-end error.
    for (const [id, node] of graph.nodes) {
      if (node.kind === 'question' && !node.loop) {
        const outgoing = graph.adjacency.get(id);
        if (!outgoing || outgoing.length === 0) {
          errors.push(this.t('graphValidator.deadEndQuestion', { questionText: node.questionText || id }));
        }
      }
    }
```

Region C — loop exit/body pass (replaces the former LOOP-04 block; keys on looped questions; partitions via `edge.isLoopExit`; removes `loopNoExitWithLegacy` + `loopExitNoLabel`):
```typescript
    // Loop exit/body invariants for looped questions (loop === true).
    // Exit edges are identified by edge.isLoopExit === true (explicit metadata,
    // replacing the former `+`-prefix convention). Multiple exits are valid.
    for (const [id, node] of graph.nodes) {
      if (node.kind !== 'question' || !node.loop) continue;
      const outgoing = graph.edges.filter(e => e.fromNodeId === id);
      const exitEdges = outgoing.filter(e => e.isLoopExit === true);
      const bodyEdges = outgoing.filter(e => !e.isLoopExit);
      const label = this.nodeLabel(node);
      if (exitEdges.length === 0) {
        errors.push(this.t('graphValidator.loopNoExit', { label }));
      }
      if (bodyEdges.length === 0) {
        errors.push(this.t('graphValidator.loopNoBody', { label }));
      }
    }
```

Region D — unintentional-cycle exemption (keys on looped questions):
```typescript
          const passesViaLoopNode = cycleNodes.some(id => {
            const n = graph.nodes.get(id);
            return n?.kind === 'question' && n.loop === true;
          });
```

### src/runner/protocol-runner.ts — MODIFY

Region A — import (the `import { isExitEdge } from '../graph/node-label';` line is DELETED; exit-edge classification now reads `edge.isLoopExit` directly).

Region B — `chooseLoopBranch` dispatch (`isExitEdge(edge)` → `edge.isLoopExit === true`):
```typescript
    if (edge.isLoopExit === true) {
      // RUN-03: pop frame (top-of-stack, nested-safe). Multiple isLoopExit edges
      // are allowed; the selected edge is the concrete exit branch.
      this.loopContextStack.pop();
    }
```

Region C — quick-exit from loop body (`isExitEdge(e)` → `e.isLoopExit === true`):
```typescript
              const exitsToNext = this.graph.edges.some(
                e => e.fromNodeId === topLoop.loopNodeId && e.isLoopExit === true && e.toNodeId === next
              );
```

Region D — `advanceThrough` `case 'question'` arm (absorbs the former `case 'loop'` entry/re-entry logic, gated on `node.loop === true`):
```typescript
        case 'question': {
          if (node.loop === true) {
            // B1 re-entry guard — looped question re-entry via a body back-edge
            // or an inner-exit landing on the outer looped question. The top
            // frame already exists — increment iteration in-place and halt at
            // the picker WITHOUT pushing a second frame or a second undo entry.
            const top = this.loopContextStack[this.loopContextStack.length - 1];
            if (top !== undefined && top.loopNodeId === cursor) {
              top.iteration += 1;
              this.currentNodeId = cursor;
              this.runnerStatus = RUNNER_STATUS.AWAITING_LOOP_PICK;
              return;
            }
            // First-entry path — push undo snapshot + new frame + halt.
            this.undoStack.push({
              nodeId: cursor,
              textSnapshot: this.accumulator.snapshot(),
              loopContextStack: this.loopContextStack.map(f => ({ ...f })),
              restoreStatus: RUNNER_STATUS.AWAITING_LOOP_PICK,
            });
            this.loopContextStack.push({
              loopNodeId: cursor,
              iteration: 1,
              textBeforeLoop: this.accumulator.snapshot(),
            });
            this.currentNodeId = cursor;
            this.runnerStatus = RUNNER_STATUS.AWAITING_LOOP_PICK;
            return;
          }
          // Ordinary question — halt at at-node.
          this.currentNodeId = cursor;
          this.runnerStatus = RUNNER_STATUS.AT_NODE;
          return;
        }
```

Region E — the `case 'loop': { ... }` arm is DELETED in full (its B1 re-entry guard + first-entry path moved into `case 'question'`). `case 'loop-start':` / `case 'loop-end':` legacy runtime-error arms remain unchanged.

Region F — stale-comment cleanup: JSDoc/inline comments that referenced `isExitEdge`, the `+`-prefix dispatch convention, or `case 'loop'` are rewritten to reference `edge.isLoopExit` / the looped-question branch, so no literal `isExitEdge` remains in the file.

### src/runner/runner-state.ts — MODIFY

Stale-comment cleanup (three JSDoc/comment references to the standalone loop node → looped question; no state-shape change):
- Line ~46 (`AwaitingLoopPickState` JSDoc): "runner paused at a unified loop node, presenting a picker" → "runner paused at a looped question, presenting a picker".
- Line ~52 (the `nodeId` field comment): "loop node id — host looks up headerText from graph" → "looped question id — host looks up questionText from graph".
- Line ~106 (`ErrorState` JSDoc): "loop node reached in Phase 2" → "looped question reached in Phase 2".

### src/runner/render/render-loop-picker.ts — MODIFY

Region A — import (remove `isExitEdge` + `stripExitPrefix`; keep `nodeLabel`):
```typescript
import { nodeLabel } from '../../graph/node-label';
```

Region B — guard (looped question instead of standalone loop):
```typescript
  const node = graph.nodes.get(state.nodeId);
  if (node === undefined || node.kind !== 'question' || !node.loop) {
    host.renderError([`Looped question "${state.nodeId}" not found in graph.`]);
    return false;
  }
```

Region C — header (`questionText` instead of `headerText`):
```typescript
  // Render the question text above the picker when non-empty.
  if (node.questionText !== '') {
    textZone.createEl('p', {
      text: node.questionText,
      cls: 'rp-loop-header-text',
    });
  }
```

Region D — edge classification + exit caption (verbatim `edge.label`, no `stripExitPrefix`):
```typescript
  for (const edge of outgoing) {
    const exit = edge.isLoopExit === true;
    let caption: string;
    if (exit) {
      caption = edge.label ?? '';
    } else {
      const target = graph.nodes.get(edge.toNodeId);
      caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
    }
    const btn = createButton(list, {
      cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
      text: caption,
    });
    host.bindClick(btn, () => {
      void host.onChooseLoopBranch(edge, exit);
    });
  }
```
(The outgoing-edges filter and the `rp-loop-picker-list rp-stack-md` container are unchanged. Any comment referencing `headerText` / `+`-prefix / `isExitEdge` is rewritten.)

### src/views/protocol-editor-view.ts — MODIFY

Region A — `NODE_KIND_DEFAULTS` (remove the `loop:` entry):
```typescript
const NODE_KIND_DEFAULTS: Record<string, NodeKindDefault> = {
  start: { kind: 'start', fields: {}, color: 'rgba(76, 175, 80, 0.28)' },
  question: { kind: 'question', fields: { questionText: '' }, color: 'rgba(33, 150, 243, 0.24)' },
  answer: { kind: 'answer', fields: { answerText: '' }, color: 'rgba(255, 193, 7, 0.28)' },
  'text-block': { kind: 'text-block', fields: { content: '' }, color: 'rgba(255, 235, 59, 0.24)' },
  snippet: { kind: 'snippet', fields: {}, color: 'rgba(156, 39, 176, 0.24)' },
};
```

Region B — `EDITABLE_NODE_KINDS` (remove `'loop'`):
```typescript
const EDITABLE_NODE_KINDS: RPNodeKind[] = ['start', 'question', 'answer', 'snippet'];
```

Region C — edge-label helpers (drop the `+`-prefix convention; `isLoopExit` is persisted on the edge record, not in the label):
```typescript
export function normalizeProtocolEditorEdgeLabel(label: string): string | undefined {
  const trimmed = label.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function displayProtocolEditorEdgeLabel(label: string | undefined): string {
  return (label ?? '').trim();
}
// isProtocolEditorLoopExitLabel is DELETED (replaced by edge.isLoopExit === true).
```

Region D — `shouldDisplayProtocolEditorEdgeLabel` (loop-exit branch keyed on looped question + `isLoopExit`; preserves the 50a7fcb fix — exit label shown regardless of target kind):
```typescript
export function shouldDisplayProtocolEditorEdgeLabel(
  edge: ProtocolEdgeRecord,
  fromNode: ProtocolNodeRecord | undefined,
  toNode: ProtocolNodeRecord | undefined,
): boolean {
  if (toNode?.kind === 'answer' || toNode?.kind === 'snippet') {
    const effectiveLabel = deriveProtocolEditorEdgeLabel(toNode, edge.label);
    return effectiveLabel !== undefined && effectiveLabel.trim() !== '';
  }
  if (fromNode?.kind === 'question' && fromNode.fields['loop'] === true && edge.isLoopExit === true) {
    return true;
  }
  return false;
}
```

Region E — `renderNode` (add a loop badge for looped questions, before the resize handle):
```typescript
    if (node.kind === 'question' && node.fields['loop'] === true) {
      const badge = nodeEl.createDiv({ cls: 'rp-protocol-editor-node-loop-badge' });
      setIcon(badge, 'repeat');
      badge.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.loopBadgeAriaLabel'));
    }
```

Region F — `openEditModal`: add `addLoopToggle` helper; `case 'question'` calls it; `case 'loop'` arm DELETED; the `titleKey` ternary loses its `titleKind === 'loop' ? 'headerText'` branch:
```typescript
    const addLoopToggle = (nodeRecord: ProtocolNodeRecord) => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-modal-checkbox-field' });
      const label = field.createEl('label');
      const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
      input.checked = nodeRecord.fields['loop'] === true;
      label.createSpan({ text: t('protocolEditor.loopToggleLabel') });
      textControls.push({ key: 'loop', value: () => input.checked ? true : undefined });
    };
```
```typescript
      case 'question':
        addInput('questionText', t('protocolEditor.questionTextLabel'), node.fields['questionText'] ?? node.text, true);
        addLoopToggle(node);
        break;
```

Region G — edge modal exit checkbox (key on looped question + `edge.isLoopExit`):
```typescript
    exitCheckbox.checked = edge.isLoopExit === true;
    const syncExitVisibility = () => {
      const fromNode = nodes.find((node) => node.id === fromSelect.value);
      const isLoopSource = fromNode?.kind === 'question' && fromNode.fields['loop'] === true;
      exitField.style.display = isLoopSource ? '' : 'none';
      if (!isLoopSource) exitCheckbox.checked = false;
    };
```

Region H — edge modal save (persist `isLoopExit` on the edge record; drop `+`-prefix normalization; preserve the three persistence-bug fixes):
```typescript
      const typedLabel = normalizeProtocolEditorEdgeLabel(labelInput.value);
      const defaultLabel = defaultProtocolEditorEdgeLabelForTarget(selectedTarget);
      const nextIsLoopExit = exitCheckbox.checked ? true : undefined;
      const shouldDisplayLabel = shouldDisplayProtocolEditorEdgeLabel(
        { ...edge, fromNodeId: nextFrom, toNodeId: nextTo, label: typedLabel ?? defaultLabel, isLoopExit: nextIsLoopExit },
        selectedSource,
        selectedTarget,
      );
      const nextLabel = shouldDisplayLabel ? typedLabel ?? defaultLabel : undefined;
      // ... inside update() mutator ...
          const nodes = existing.nodes.map((candidate) => {
            if (candidate.id !== nextTo || candidate.kind !== 'snippet' || typedLabel === undefined || nextIsLoopExit === true) {
              return candidate;
            }
            return { ...candidate, text: typedLabel, fields: { ...candidate.fields, snippetLabel: typedLabel } };
          });
          const edges = existing.edges.map((candidate) => candidate.id === edge.id
            ? { ...candidate, fromNodeId: nextFrom, toNodeId: nextTo, label: nextLabel, isLoopExit: nextIsLoopExit }
            : candidate);
          return { ...existing, nodes, edges, viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
        });
        this.doc = updated;          // 0ff2587 fix preserved
        closeModal();
        new Notice(t('protocolEditor.edgeSaved'));
        void this.loadProtocol(this.protocolPath!);   // f5850c0 fix preserved
```
(The snippet-label sync suppression uses `nextIsLoopExit === true` instead of the former `isProtocolEditorLoopExitLabel(typedLabel)` — a loop-exit edge does not sync its label onto a snippet target.)

### src/views/node-picker-modal.ts — MODIFY

Region A — type import (remove `LoopNode`):
```typescript
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, RPNodeKind } from '../graph/graph-model';
```

Region B — `StartableNodeKind` (remove `'loop'`):
```typescript
type StartableNodeKind = Extract<RPNodeKind, 'start' | 'question' | 'answer' | 'text-block' | 'snippet'>;
```

Region C — `KIND_LABEL_KEYS` / `KIND_LABELS` / `KIND_ORDER` (remove `'loop'` entries; renumber):
```typescript
export const KIND_LABEL_KEYS: Record<NodeOption['kind'], string> = {
  'start': 'nodePicker.start',
  'question': 'nodePicker.question',
  'answer': 'nodePicker.answer',
  'text-block': 'nodePicker.textBlock',
  'snippet': 'nodePicker.snippet',
};

export const KIND_LABELS: Record<NodeOption['kind'], string> = {
  'start': defaultT('nodePicker.start'),
  'question': defaultT('nodePicker.question'),
  'answer': defaultT('nodePicker.answer'),
  'text-block': defaultT('nodePicker.textBlock'),
  'snippet': defaultT('nodePicker.snippet'),
};

const KIND_ORDER: Record<NodeOption['kind'], number> = {
  'start':      0,
  'question':   1,
  'answer':     2,
  'text-block': 3,
  'snippet':    4,
};
```

Region D — `buildNodeOptions` (the `} else if (node.kind === 'loop') { const l = node as LoopNode; options.push({ id, label: l.headerText || id, kind: 'loop' }) }` branch is DELETED — looped questions are already covered by the `node.kind === 'question'` branch). The `buildStartableProtocolNodeOptions` `stringField(node, 'headerText')` fallback is removed from the label chain.

Region E — stale-comment cleanup: the sort-order JSDoc (~line 47) becomes "question → text-block → snippet"; the `buildNodeOptions` JSDoc (~line 67) becomes "Includes question, text-block, and snippet nodes". No stale standalone-loop-as-a-kind reference remains; `loop-start`/`loop-end` legacy exclusion comments remain.

### src/i18n/locales/en.json — MODIFY

`graphValidator` block — reword loop messages + remove prefix-specific keys:
```json
  "graphValidator": {
    "legacyLoopNodes": "Canvas contains deprecated loop-start/loop-end nodes: {ids}. Rebuild the loop with a unified loop node: an «exit» label on one of the outgoing edges marks the exit branch; the rest form the loop body.",
    "loopNoExit": "Loop question \"{label}\" has no exit. Mark one outgoing edge as a loop exit (\"This edge exits the loop\").",
    "loopNoBody": "Loop question \"{label}\" has no body — add an outgoing edge that is not marked as a loop exit.",
    "snippetFileMissing": "Snippet node \"{label}\" references a missing file \"{relPath}\" — file not found in {folder}. Check the path or restore the file.",
    "noStartNode": "No start node found. Add a node with radiprotocol_nodeType = \"start\".",
    "multipleStartNodes": "Multiple start nodes found ({count}). Only one start node is allowed.",
    "unreachableNodes": "{count} unreachable node(s) found: {nodeList}. Connect these nodes to the protocol or remove them.",
    "deadEndQuestion": "Question \"{questionText}\" has no outgoing branches. Add at least one answer or snippet node connected from this question.",
    "unintentionalCycle": "Unintentional cycle detected: {cycleLabel}. Cycles must pass through a loop question. Remove the back-edge or enable the loop toggle on a question in the cycle."
  },
```
(`loopNoExitWithLegacy` and `loopExitNoLabel` DELETED from this block. `nodePicker.loop` removal is in Slice 8.)

`protocolEditor` block — add loop toggle/badge keys; remove standalone-Loop labels:
```json
    "loopToggleLabel": "Loop",
    "loopBadgeAriaLabel": "Loop question",
```
(`headerTextLabel`, `nodeKind.loop`, and `defaultNodeText.loop` DELETED from the protocolEditor block. `loopExitLabel` ("This edge exits the loop") UNCHANGED — still used by the edge-modal checkbox.)

`nodePicker` block — DELETE the standalone-Loop badge:
```json
  "nodePicker": {
    "start": "Start",
    "question": "Question",
    "answer": "Answer",
    "textBlock": "Text",
    "snippet": "Snippet",
    "rootSnippets": "(snippets root)",
    "searchPlaceholder": "Search nodes by label…"
  },
```
(`"loop": "Loop"` DELETED from the nodePicker block.)

### src/i18n/locales/ru.json — MODIFY

`graphValidator` block — synchronized reworded loop messages + removed prefix-specific keys:
```json
  "graphValidator": {
    "legacyLoopNodes": "Канвас содержит устаревшие узлы loop-start/loop-end: {ids}. Пересоберите цикл с единым узлом loop: метка «выход» на одном из исходящих рёбер обозначает ветвь выхода, остальные исходящие рёбра — тело цикла.",
    "loopNoExit": "Циклический вопрос \"{label}\" не имеет выхода. Пометьте одно исходящее ребро как выход из цикла («Эта связь выходит из цикла»).",
    "loopNoBody": "Циклический вопрос \"{label}\" не имеет тела — добавьте исходящее ребро, не помеченное как выход из цикла.",
    "snippetFileMissing": "Snippet-узел \"{label}\" ссылается на несуществующий файл \"{relPath}\" — файл не найден в {folder}. Проверьте путь или восстановите файл.",
    "noStartNode": "Стартовый узел не найден. Добавьте узел с radiprotocol_nodeType = \"start\".",
    "multipleStartNodes": "Обнаружено несколько стартовых узлов ({count}). Допускается только один стартовый узел.",
    "unreachableNodes": "Найдено недостижимых узлов: {count}: {nodeList}. Подключите эти узлы к протоколу или удалите их.",
    "deadEndQuestion": "Вопрос \"{questionText}\" не имеет исходящих ветвей. Добавьте хотя бы один ответный или сниппет-узел, подключённый к этому вопросу.",
    "unintentionalCycle": "Обнаружен непреднамеренный цикл: {cycleLabel}. Циклы должны проходить через циклический вопрос. Удалите обратное ребро или включите циклический режим на вопросе в цикле."
  },
```
(`loopNoExitWithLegacy` and `loopExitNoLabel` DELETED from this block.)

`protocolEditor` block — synchronized additions/removals:
```json
    "loopToggleLabel": "Цикл",
    "loopBadgeAriaLabel": "Циклический вопрос",
```
(`headerTextLabel`, `nodeKind.loop`, and `defaultNodeText.loop` DELETED from the protocolEditor block. `loopExitLabel` UNCHANGED.)

`nodePicker` block — DELETE the standalone-Loop badge (synchronized):
```json
  "nodePicker": {
    "start": "Старт",
    "question": "Вопрос",
    "answer": "Ответ",
    "textBlock": "Текст",
    "snippet": "Сниппет",
    "rootSnippets": "(корень сниппетов)",
    "searchPlaceholder": "Поиск узлов по названию…"
  },
```
(`"loop": "Цикл"` DELETED from the nodePicker block.)

### src/styles/protocol-editor.css — MODIFY

- Remove `.rp-protocol-editor-node-kind-choice[data-node-kind="loop"]` (no loop kind in the creation grid).
- Remove `.rp-protocol-editor-minimap-node-loop` (looped questions render as questions on the minimap).
- Add the loop-badge style:
```css
.rp-protocol-editor-node-loop-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 0.7;
}
```

### src/styles/loop-support.css — MODIFY

No functional CSS change — `.rp-loop-header-text`, `.rp-loop-picker-list`, `.rp-loop-body-btn`, `.rp-loop-exit-btn` remain in use by the looped-question picker. The stale comment at lines ~64-65 referencing the `+`-prefix exit is rewritten:
```css
/* Exit button — marks an isLoopExit edge (the former +-prefix convention was
   replaced by the explicit edge.isLoopExit flag). */
```

### src/__tests__/helpers/canvas-parser.ts — MODIFY

Region A — type imports (remove `LoopNode`):
```typescript
import type {
  RPNode, RPNodeKind, RPEdge, ProtocolGraph, ParseResult,
  StartNode, QuestionNode, AnswerNode, TextBlockNode,
  LoopStartNode, LoopEndNode, SnippetNode,
} from '../../graph/graph-model';
```

Region B — `RawCanvasEdge` interface gains an index signature (to admit `radiprotocol_isLoopExit`):
```typescript
interface RawCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
  [key: string]: unknown;
}
```

Region C — `validKinds` (remove `'loop'`):
```typescript
    const validKinds: RPNodeKind[] = [
      'start', 'question', 'answer',
      'text-block', 'loop-start', 'loop-end', 'snippet',
    ];
```

Region D — `case 'question'` arm (add `loop`):
```typescript
      case 'question': {
        const loopRaw = props['radiprotocol_loop'];
        const node: QuestionNode = {
          ...base,
          kind: 'question',
          questionText: getString(props, 'radiprotocol_questionText', raw.text ?? ''),
          loop: typeof loopRaw === 'boolean' ? loopRaw : undefined,
        };
        return node;
      }
```

Region E — the `case 'loop'` arm (the `LoopNode` construction block) is DELETED. `case 'loop-start'` / `case 'loop-end'` arms remain unchanged.

Region F — edge reconstruction (copy `isLoopExit` from `radiprotocol_isLoopExit`):
```typescript
      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNode,
        toNodeId: rawEdge.toNode,
        label: rawEdge.label,
        isLoopExit: rawEdge['radiprotocol_isLoopExit'] === true ? true : undefined,
      });
```

### src/__tests__/fixtures/unified-loop-*.canvas — MODIFY

Recast every `unified-loop-*.canvas` fixture from the legacy loop model to the merged model. Transform per fixture:
- Each loop node (`radiprotocol_nodeType: 'loop'` + `radiprotocol_headerText: H`) → `radiprotocol_nodeType: 'question'` + `radiprotocol_questionText: H` + `radiprotocol_loop: true`.
- Each `+`-prefixed exit edge (`label: '+caption'`) → `label: 'caption', radiprotocol_isLoopExit: true` (prefix stripped, flag set).
- Body edges (no `+` prefix) unchanged.
- Node IDs, geometry, colors, text, and edge ids/endpoints preserved.

Representative recast — `unified-loop-valid.canvas`:
```json
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start",       "x": 0,   "y": 0,   "width": 200, "height": 60, "radiprotocol_nodeType": "start" },
    { "id": "n-loop",  "type": "text", "text": "Lesion loop", "x": 0,   "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question", "radiprotocol_questionText": "Lesion loop", "radiprotocol_loop": true },
    { "id": "n-q1",    "type": "text", "text": "Size?",       "x": 260, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question", "radiprotocol_questionText": "Size?" },
    { "id": "n-a1",    "type": "text", "text": "1 cm",        "x": 520, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "answer",   "radiprotocol_answerText": "1 cm" },
    { "id": "n-end",   "type": "text", "text": "Done",        "x": 0,   "y": 240, "width": 200, "height": 60, "radiprotocol_nodeType": "text-block", "radiprotocol_content": "Done" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-loop" },
    { "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1" },
    { "id": "e3", "fromNode": "n-loop",  "toNode": "n-end", "label": "выход", "radiprotocol_isLoopExit": true },
    { "id": "e4", "fromNode": "n-q1",    "toNode": "n-a1" },
    { "id": "e5", "fromNode": "n-a1",    "toNode": "n-loop" }
  ]
}
```

Per-fixture outcome after recast:
- `unified-loop-valid.canvas`: looped question + isLoopExit exit + body → valid; cycle through the looped question is intentional.
- `unified-loop-missing-exit.canvas`: looped question, no isLoopExit edge → flags `loopNoExit`.
- `unified-loop-no-body.canvas`: looped question, only an isLoopExit edge, no body → flags `loopNoBody`.
- `unified-loop-duplicate-exit.canvas`: two isLoopExit edges → valid (multiple exits allowed).
- `unified-loop-labeled-body.canvas`: isLoopExit exit + labeled body edge → valid.
- `unified-loop-stray-body-label.canvas`: labeled body edge (no isLoopExit) + isLoopExit exit → valid.
- `unified-loop-long-body.canvas`: long body chain + isLoopExit exit → valid.
- `unified-loop-nested.canvas`: outer + inner looped questions, each with an isLoopExit exit → valid.
- `unified-loop-empty-plus.canvas` (REPURPOSED): former `+` empty-caption exit → isLoopExit edge with empty/absent label; validates cleanly (`loopExitNoLabel` removed — an exit edge with an empty label is allowed).
- `unified-loop-legacy-vyhod.canvas` (REPURPOSED): former legacy `выход` label (no `+`) → labeled body edge with no isLoopExit; the looped question has no exit → flags `loopNoExit`.

`loop-body.canvas` and `loop-start.canvas` (legacy `loop-start`/`loop-end`) are UNCHANGED — the `legacyLoopNodes` migration message still applies to them.

### src/__tests__/graph/node-label.test.ts — MODIFY

Region A — imports + section header (the "all 8 RPNodeKind arms" comment becomes "7 after the loop→question merge"; dropped symbols removed):
```typescript
import { describe, it, expect } from 'vitest';
import { nodeLabel } from '../../graph/node-label';
import type { RPNode } from '../../graph/graph-model';

// ─────────────────────────────────────────────────────────────────────────────
// nodeLabel — all RPNodeKind arms (7 after the loop→question merge)
// ─────────────────────────────────────────────────────────────────────────────
```

Region B — the `it('loop → headerText || id (Phase 43 D-11)', ...)` test block inside `describe('nodeLabel')` is DELETED.

Region C — the three `describe` blocks `isLabeledEdge (D-05 ...)`, `isExitEdge (D-10 ...)`, and `stripExitPrefix (D-09 ...)` are DELETED in full. The `describe('nodeLabel')` block (including the retained `loop-start`/`loop-end` deprecated-arm tests and the snippet tests) remains.

### src/__tests__/protocol-document-parser.test.ts — MODIFY

Region A — in the "parses legacy radiprotocol_* field keys" test, the `n4` loop node is recast to a looped question exercising the `radiprotocol_loop` legacy key:
```typescript
    }, {
      id: 'n4', kind: 'question',
      fields: { radiprotocol_questionText: 'Legacy loop?', radiprotocol_loop: true },
    }]);
```
and its assertion becomes:
```typescript
      expect((result.graph.nodes.get('n4') as any).questionText).toBe('Legacy loop?');
      expect((result.graph.nodes.get('n4') as any).loop).toBe(true);
```

Region B — the "parses unified loop node" test is replaced by a looped-question parse test:
```typescript
  it('parses a looped question with loop: true', () => {
    const doc = docWithNodes([{
      id: 'n1', kind: 'question',
      fields: { questionText: 'Repeat for each slice?', loop: true },
    }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      const node = result.graph.nodes.get('n1');
      expect(node!.kind).toBe('question');
      expect((node as any).questionText).toBe('Repeat for each slice?');
      expect((node as any).loop).toBe(true);
    }
  });
```

Region C — add a three-state boolean round-trip test after the looped-question test:
```typescript
  it('preserves loop flag three states: true, false, absent (non-boolean → undefined)', () => {
    const doc = docWithNodes([
      { id: 'n1', kind: 'question', fields: { questionText: 'Q1', loop: true } },
      { id: 'n2', kind: 'question', fields: { questionText: 'Q2', loop: false } },
      { id: 'n3', kind: 'question', fields: { questionText: 'Q3' } },
      { id: 'n4', kind: 'question', fields: { questionText: 'Q4', loop: 'true' } },
    ]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.graph.nodes.get('n1') as any).loop).toBe(true);
      expect((result.graph.nodes.get('n2') as any).loop).toBe(false);
      expect((result.graph.nodes.get('n3') as any).loop).toBeUndefined();
      expect((result.graph.nodes.get('n4') as any).loop).toBeUndefined();
    }
  });
```

Region D — add a legacy-`'loop'`-kind rejection test (mirrors the existing `free-text-input` rejection test):
```typescript
  it('rejects legacy "loop" kind (migration is the sole bridge)', () => {
    const doc = docWithNodes([{ id: 'n1', kind: 'loop' as never, fields: { headerText: 'Legacy loop' } }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('loop');
  });
```

Region E — in the "ProtocolDocumentParser — edges and adjacency" describe block, add an `isLoopExit` preservation test:
```typescript
  it('preserves edge isLoopExit flag', () => {
    const doc = validDoc({
      nodes: [
        { id: 'n-start', kind: 'start', x: 0, y: 0, width: 250, height: 60, fields: {} },
        { id: 'n-q', kind: 'question', x: 0, y: 100, width: 250, height: 60, fields: { questionText: 'Q?', loop: true } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'n-q', toNodeId: 'n-start', label: 'Done', isLoopExit: true },
        { id: 'e2', fromNodeId: 'n-q', toNodeId: 'n-start', label: 'Body' },
      ],
    });
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.graph.edges[0]!.isLoopExit).toBe(true);
      expect(result.graph.edges[1]!.isLoopExit).toBeUndefined();
    }
  });
```

### src/__tests__/protocol-document-migration.test.ts — NEW

Full unit-test suite for the pure transform. Covers discriminator + idempotency, node transform, edge transform, and losslessness.
```typescript
// src/__tests__/protocol-document-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateProtocolDocument } from '../protocol/protocol-document-migration';
import type { ProtocolDocumentV1 } from '../protocol/protocol-document';

const NOW = '2026-02-02T00:00:00.000Z';

function docWith(nodes: any[], edges: any[] = []): ProtocolDocumentV1 {
  return {
    schema: 'radiprotocol.protocol', version: 1, id: 'd1', title: 'T',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    nodes, edges,
  } as ProtocolDocumentV1;
}

describe('migrateProtocolDocument — discriminator + idempotency', () => {
  it('returns the same doc reference with changed:false when no legacy loop nodes', () => {
    const d = docWith([{ id: 'n1', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } }]);
    const result = migrateProtocolDocument(d, () => NOW);
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(d);
  });
  it('is idempotent — migrate(migrate(doc)) second call changed:false, same reference', () => {
    const d = docWith(
      [{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'Repeat?' } }],
      [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+Done' }],
    );
    const first = migrateProtocolDocument(d, () => NOW);
    expect(first.changed).toBe(true);
    const second = migrateProtocolDocument(first.doc, () => '2026-03-03T00:00:00.000Z');
    expect(second.changed).toBe(false);
    expect(second.doc).toBe(first.doc);
  });
});

describe('migrateProtocolDocument — node transform', () => {
  it('converts a legacy loop node to a looped question and preserves geometry/color/text', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 10, y: 20, width: 250, height: 60, color: 'rgba(233,30,99,0.24)', text: 'Repeat?', fields: { headerText: 'Repeat for each slice?' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    const node = doc.nodes[0]!;
    expect(node.kind).toBe('question');
    expect(node.fields['loop']).toBe(true);
    expect(node.fields['questionText']).toBe('Repeat for each slice?');
    expect(node.fields['headerText']).toBeUndefined();
    expect(node.x).toBe(10); expect(node.y).toBe(20);
    expect(node.color).toBe('rgba(233,30,99,0.24)'); expect(node.text).toBe('Repeat?');
  });
  it('preserves unrelated node fields', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H', startPointEnabled: true, customExt: 'keep' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['startPointEnabled']).toBe(true);
    expect(doc.nodes[0]!.fields['customExt']).toBe('keep');
  });
  it('non-string headerText normalizes to empty questionText', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 123 } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['questionText']).toBe('');
    expect(doc.nodes[0]!.fields['loop']).toBe(true);
  });
  it('non-object fields is handled defensively', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: 'not-an-object' as never }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.kind).toBe('question');
    expect(doc.nodes[0]!.fields['loop']).toBe(true);
    expect(doc.nodes[0]!.fields['questionText']).toBe('');
  });
  it('leaves non-loop nodes unchanged (changed:false)', () => {
    const d = docWith([
      { id: 'n1', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } },
      { id: 'n2', kind: 'answer', x: 0, y: 0, width: 250, height: 60, fields: { answerText: 'A' } },
    ]);
    const { doc, changed } = migrateProtocolDocument(d, () => NOW);
    expect(changed).toBe(false);
    expect(doc.nodes[0]!.kind).toBe('question');
    expect(doc.nodes[1]!.kind).toBe('answer');
  });
});

describe('migrateProtocolDocument — edge transform', () => {
  it('strips + prefix and sets isLoopExit on a legacy loop exit edge', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+выход' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('выход'); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('strips whitespace around and after the + prefix (nbsp)', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '  +\u00a0готово  ' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('готово'); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('empty + caption becomes undefined label with isLoopExit true', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBeUndefined(); expect(doc.edges[0]!.isLoopExit).toBe(true);
  });
  it('body edge (no + prefix) from a loop node is unchanged', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-body', label: 'Body' }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.label).toBe('Body'); expect(doc.edges[0]!.isLoopExit).toBeUndefined();
  });
  it('+-prefixed edge from a NON-loop node is NOT reclassified (no global + scanning)', () => {
    const d = docWith([{ id: 'n-q', kind: 'question', x: 0, y: 0, width: 250, height: 60, fields: { questionText: 'Q?' } }], [{ id: 'e1', fromNodeId: 'n-q', toNodeId: 'n-other', label: '+not-an-exit' }]);
    const { doc, changed } = migrateProtocolDocument(d, () => NOW);
    expect(changed).toBe(false);
    expect(doc.edges[0]!.label).toBe('+not-an-exit');
    expect(doc.edges[0]!.isLoopExit).toBeUndefined();
  });
  it('preserves edge ids/endpoints and unrelated edge fields', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }], [{ id: 'e1', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+Done', customExt: 'keep' }] as any[]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.edges[0]!.id).toBe('e1'); expect(doc.edges[0]!.fromNodeId).toBe('n-loop'); expect(doc.edges[0]!.toNodeId).toBe('n-next');
    expect((doc.edges[0] as any).customExt).toBe('keep');
  });
});

describe('migrateProtocolDocument — losslessness', () => {
  it('preserves document metadata, viewport, layoutDirection, selfCheck, unknown top-level fields, and bumps updatedAt', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { headerText: 'H' } }]);
    (d as any).viewport = { x: 1, y: 2, zoom: 0.5 };
    (d as any).layoutDirection = 'TB';
    (d as any).selfCheckEnabled = true;
    (d as any).selfCheckItems = ['item'];
    (d as any).unknownTopLevel = 'keep';
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.schema).toBe('radiprotocol.protocol'); expect(doc.version).toBe(1);
    expect(doc.id).toBe('d1'); expect(doc.title).toBe('T');
    expect(doc.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect((doc as any).viewport).toEqual({ x: 1, y: 2, zoom: 0.5 });
    expect((doc as any).layoutDirection).toBe('TB');
    expect((doc as any).selfCheckEnabled).toBe(true);
    expect((doc as any).selfCheckItems).toEqual(['item']);
    expect((doc as any).unknownTopLevel).toBe('keep');
    expect(doc.updatedAt).toBe(NOW);
  });
});
```

### src/__tests__/protocol-document-store.test.ts — MODIFY

Add a new `describe('ProtocolDocumentStore — migration on read', ...)` block after the existing `describe('ProtocolDocumentStore — read', ...)`:
```typescript
describe('ProtocolDocumentStore — migration on read', () => {
  function legacyLoopDoc(): ProtocolDocumentV1 {
    return {
      ...VALID_DOC,
      id: 'legacy-1',
      title: 'Legacy Loop Protocol',
      nodes: [
        { id: 'n-start', kind: 'start', x: 0, y: 0, width: 200, height: 80, fields: {} },
        { id: 'n-loop', kind: 'loop' as never, x: 0, y: 100, width: 250, height: 60, fields: { headerText: 'Repeat?' } },
        { id: 'n-next', kind: 'question', x: 0, y: 200, width: 250, height: 60, fields: { questionText: 'Done?' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop', toNodeId: 'n-next', label: '+Done' },
        { id: 'e3', fromNodeId: 'n-loop', toNodeId: 'n-start', label: 'Body' },
      ],
    } as ProtocolDocumentV1;
  }

  it('first read of a legacy loop document migrates + persists (write called once)', async () => {
    const { vault, files } = makeVault({
      files: { 'protocols/legacy.rp.json': JSON.stringify(legacyLoopDoc()) },
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/legacy.rp.json');
    expect(result).not.toBeNull();
    expect(vault.adapter.write).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(files['protocols/legacy.rp.json']!) as ProtocolDocumentV1;
    expect(persisted.nodes.find(n => n.id === 'n-loop')!.kind).toBe('question');
    expect(persisted.nodes.find(n => n.id === 'n-loop')!.fields['loop']).toBe(true);
    expect(persisted.nodes.find(n => n.id === 'n-loop')!.fields['questionText']).toBe('Repeat?');
    expect(persisted.nodes.find(n => n.id === 'n-loop')!.fields['headerText']).toBeUndefined();
    expect(persisted.edges.find(e => e.id === 'e2')!.label).toBe('Done');
    expect(persisted.edges.find(e => e.id === 'e2')!.isLoopExit).toBe(true);
    expect(persisted.edges.find(e => e.id === 'e3')!.isLoopExit).toBeUndefined();
    expect(result!.nodes.find(n => n.id === 'n-loop')!.kind).toBe('question');
  });

  it('second read does not write (idempotent)', async () => {
    const { vault } = makeVault({
      files: { 'protocols/legacy.rp.json': JSON.stringify(legacyLoopDoc()) },
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    await store.read('protocols/legacy.rp.json');
    expect(vault.adapter.write).toHaveBeenCalledTimes(1);
    await store.read('protocols/legacy.rp.json');
    expect(vault.adapter.write).toHaveBeenCalledTimes(1);
  });

  it('invalid schema does not write', async () => {
    const { vault } = makeVault({ files: { 'protocols/bad.rp.json': JSON.stringify({ schema: 'wrong', version: 1 }) } });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/bad.rp.json');
    expect(result).toBeNull();
    expect(vault.adapter.write).not.toHaveBeenCalled();
  });

  it('adapter read failure does not write', async () => {
    const { vault } = makeVault({ files: { 'protocols/x.rp.json': JSON.stringify(legacyLoopDoc()) } });
    vault.adapter.read.mockRejectedValueOnce(new Error('disk error'));
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/x.rp.json');
    expect(result).toBeNull();
    expect(vault.adapter.write).not.toHaveBeenCalled();
  });

  it('migration write failure returns null', async () => {
    const { vault } = makeVault({
      files: { 'protocols/legacy.rp.json': JSON.stringify(legacyLoopDoc()) },
      folders: ['protocols'],
    });
    vault.adapter.write.mockRejectedValueOnce(new Error('write error'));
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.read('protocols/legacy.rp.json');
    expect(result).toBeNull();
  });

  it('update on a legacy document receives the migrated doc and writes twice', async () => {
    const { vault, files } = makeVault({
      files: { 'protocols/legacy.rp.json': JSON.stringify(legacyLoopDoc()) },
      folders: ['protocols'],
    });
    const store = new ProtocolDocumentStore(makeApp(vault) as never);
    const result = await store.update('protocols/legacy.rp.json', (doc) => {
      expect(doc!.nodes.find(n => n.id === 'n-loop')!.kind).toBe('question');
      return { ...doc!, title: 'Edited' };
    });
    expect(result.title).toBe('Edited');
    expect(vault.adapter.write).toHaveBeenCalledTimes(2);
    const persisted = JSON.parse(files['protocols/legacy.rp.json']!) as ProtocolDocumentV1;
    expect(persisted.title).toBe('Edited');
    expect(persisted.nodes.find(n => n.id === 'n-loop')!.kind).toBe('question');
  });
});
```

### src/__tests__/graph-validator.test.ts — MODIFY

Recast the loop-related test block to the merged model + reworded messages. The former D-05 (`loopNoExitWithLegacy`) and D-08 (`loopExitNoLabel`) tests are removed (the prefix-specific branches no longer exist); their fixtures are repurposed as covered below. The legacy `loop-body.canvas` / `loop-start.canvas` MIGRATE-01 tests (loop-start/loop-end rejection) remain UNCHANGED.

Changed/recast test blocks (executable):
```typescript
  it('unified-loop-valid.canvas passes loop checks (looped question + isLoopExit exit + body)', () => {
    const graph = parseFixture('unified-loop-valid.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(false);
    expect(errors.some(e => e.includes('has no body'))).toBe(false);
    expect(errors.some(e => e.includes('deprecated loop-start/loop-end'))).toBe(false);
  });

  it('unified-loop-missing-exit.canvas flags loopNoExit (no isLoopExit edge)', () => {
    const graph = parseFixture('unified-loop-missing-exit.canvas');
    const errors = new GraphValidator().validate(graph);
    const noExit = errors.find(e => e.includes('has no exit'));
    expect(noExit).toBeDefined();
    expect(noExit).toContain('"Lesion loop"');
    expect(noExit).toContain('Mark one outgoing edge as a loop exit');
  });

  it('unified-loop-no-body.canvas flags loopNoBody (only an isLoopExit edge, no body)', () => {
    const graph = parseFixture('unified-loop-no-body.canvas');
    const errors = new GraphValidator().validate(graph);
    const noBody = errors.find(e => e.includes('has no body'));
    expect(noBody).toBeDefined();
    expect(noBody).toContain('"Lesion loop"');
  });

  it('unified-loop-duplicate-exit.canvas validates multiple isLoopExit edges', () => {
    const graph = parseFixture('unified-loop-duplicate-exit.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(false);
    expect(errors.some(e => e.includes('has no body'))).toBe(false);
  });

  it('unified-loop-labeled-body.canvas VALIDATES — labeled body edge + isLoopExit exit coexist', () => {
    const graph = parseFixture('unified-loop-labeled-body.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(false);
    expect(errors.some(e => e.includes('has no body'))).toBe(false);
  });

  it('unified-loop-stray-body-label.canvas VALIDATES — non-exit body label is allowed', () => {
    const graph = parseFixture('unified-loop-stray-body-label.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(false);
    expect(errors.some(e => e.includes('has no body'))).toBe(false);
  });

  it('unified-loop-empty-plus.canvas VALIDATES — isLoopExit edge with empty label is allowed (loopExitNoLabel removed)', () => {
    const graph = parseFixture('unified-loop-empty-plus.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no caption'))).toBe(false);
    expect(errors.some(e => e.includes('has no exit'))).toBe(false);
  });

  it('unified-loop-legacy-vyhod.canvas flags loopNoExit (labeled body edge, no isLoopExit)', () => {
    const graph = parseFixture('unified-loop-legacy-vyhod.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(true);
  });

  it('cycle through a looped question is NOT flagged as unintentional (D-09)', () => {
    const graph = parseFixture('unified-loop-valid.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.toLowerCase().includes('unintentional cycle'))).toBe(false);
  });

  it('cycle WITHOUT a looped question is still flagged (D-09 negative control)', () => {
    const graph = parseFixture('cycle.canvas');
    const errors = new GraphValidator().validate(graph);
    expect(errors.some(e => e.toLowerCase().includes('unintentional cycle'))).toBe(true);
    expect(errors.some(e => e.includes('loop question'))).toBe(true);
    expect(errors.some(e => e.includes('loop node'))).toBe(false);
  });

  it('looped question with zero outgoing edges flags loopNoExit + loopNoBody (not deadEndQuestion)', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'n-start', type: 'text', text: 'Start', x: 0, y: 0, width: 100, height: 60, radiprotocol_nodeType: 'start' },
        { id: 'n-loop', type: 'text', text: 'Empty loop', x: 200, y: 0, width: 100, height: 60, radiprotocol_nodeType: 'question', radiprotocol_questionText: 'Empty loop', radiprotocol_loop: true },
      ],
      edges: [ { id: 'e1', fromNode: 'n-start', toNode: 'n-loop' } ],
    });
    const result = new CanvasParser().parse(json, 'loop-zero-edges.canvas');
    expect(result.success).toBe(true);
    if (!result.success) return;
    const errors = new GraphValidator().validate(result.graph);
    expect(errors.some(e => e.includes('has no exit'))).toBe(true);
    expect(errors.some(e => e.includes('has no body'))).toBe(true);
    expect(errors.some(e => e.includes('has no outgoing branches'))).toBe(false);
  });
```

### src/__tests__/runner/protocol-runner-loop-picker.test.ts — MODIFY

Recast transform applied throughout: every loop fixture node `{ kind: 'loop', ..., headerText: 'H' }` → `{ kind: 'question', ..., questionText: 'H', loop: true }`; every `+`-prefixed exit edge → stripped label + `isLoopExit: true`; body edges unchanged. The `import { stripExitPrefix }` is DELETED and the D-09/D-11 `stripExitPrefix` wiring test is DELETED. D-10/D-14 regression guards switch from `+`-prefix detection to `edge.isLoopExit`.

`makeLoopGraph()` recast:
```typescript
  function makeLoopGraph(): ProtocolGraph {
    return {
      canvasFilePath: 'test:looped-question.canvas',
      nodes: new Map<string, RPNode>([
        ['n-start', { id: 'n-start', kind: 'start', x: 0, y: 0, width: 200, height: 60 }],
        ['n-loop',  { id: 'n-loop',  kind: 'question', x: 0, y: 120, width: 200, height: 60, questionText: 'Loop', loop: true }],
        ['n-body',  { id: 'n-body',  kind: 'text-block', x: 260, y: 120, width: 200, height: 60, content: 'Body' }],
        ['n-end',   { id: 'n-end',   kind: 'text-block', x: 0, y: 240, width: 200, height: 60, content: 'End' }],
      ]),
      edges: [
        { id: 'e1', fromNodeId: 'n-start', toNodeId: 'n-loop' },
        { id: 'e2', fromNodeId: 'n-loop',  toNodeId: 'n-body' },
        { id: 'e3', fromNodeId: 'n-loop',  toNodeId: 'n-end',  label: 'готово', isLoopExit: true },
        { id: 'e4', fromNodeId: 'n-body',  toNodeId: 'n-loop' },
      ],
      // adjacency / reverseAdjacency / startNodeId unchanged
    };
  }
```

D-10/D-14 guard predicates recast: `loopOut.find(e => e.isLoopExit === true)` (exit) and `loopOut.find(e => !e.isLoopExit)` (body). The RUN-QUICK-EXIT graph and nested/stepBack/serialization tests keep their assertions; only fixture shapes change per the transform.

NEW stepBack→redo round-trip test:
```typescript
  it('stepBack then redo restores AWAITING_LOOP_PICK and the loop stack on a looped question', () => {
    const runner = new ProtocolRunner();
    runner.start(makeLoopGraph());
    expect(runner.getState().status).toBe('awaiting-loop-pick');
    const before = runner.getSerializableState();
    expect(before?.loopContextStack.length).toBe(1);
    runner.stepBack();
    runner.redo();
    const after = runner.getState();
    expect(after.status).toBe('awaiting-loop-pick');
    const afterSer = runner.getSerializableState();
    expect(afterSer?.loopContextStack.length).toBe(1);
    expect(afterSer?.loopContextStack[0]?.iteration).toBe(before?.loopContextStack[0]?.iteration);
  });
```

### src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts — MODIFY

`makeLoop` → `makeLoopedQuestion` (LoopNode import removed, QuestionNode imported); `buildGraph` upgraded to a 4-tuple edge format carrying `isLoopExit`:
```typescript
function makeLoopedQuestion(id: string, questionText = 'iter'): QuestionNode {
  return { kind: 'question', id, questionText, loop: true, x: 0, y: 0, width: 100, height: 40 };
}

function buildGraph(
  nodes: RPNode[],
  edgeList: Array<[string, string, string?, boolean?]>,
  startNodeId: string,
): ProtocolGraph {
  // ... nodeMap construction unchanged ...
  const edges: RPEdge[] = edgeList.map(([from, to, label, isLoopExit], i) => ({
    id: `e-${i}`,
    fromNodeId: from,
    toNodeId: to,
    ...(label !== undefined ? { label } : {}),
    ...(isLoopExit === true ? { isLoopExit: true } : {}),
  }));
  // ... adjacency / reverseAdjacency / return unchanged ...
}
```
Exact `+`-prefix exit tuple call sites (lines 80, 115, 141): `['n-loop', 'n-end', '+exit']` → `['n-loop', 'n-end', 'exit', true]` (label stripped, 4th element `true`). `makeLoop('n-loop')` call sites → `makeLoopedQuestion('n-loop')`. `loopContextStack[0]?.loopNodeId === 'n-loop'` assertions unchanged.

### src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts — MODIFY

Same transform: `makeLoop` → `makeLoopedQuestion` (LoopNode import removed, QuestionNode imported); `buildGraph` upgraded to the 4-tuple `Array<[string, string, string?, boolean?]>` mapper with `...(isLoopExit === true ? { isLoopExit: true } : {})`. Exact `+`-prefix exit tuple call site (line 423): `['loop', 'end', '+выход']` → `['loop', 'end', 'выход', true]`. `loopContextStack[0]?.loopNodeId === 'loop'` assertions unchanged.

### src/__tests__/runner/render-loop-picker.test.ts — MODIFY

Region A — `node()` helper: remove the `...(kind === 'loop' ? { headerText: '' } : {})` spread (no loop kind). Other kind spreads (`loop-start`/`loop-end`/`question`/`answer`/`text-block`) remain.

Region B — `graph()` helper: loop node → looped question:
```typescript
  nodes.set('loop', node('loop', 'question', { questionText: 'Repeat?', loop: true }));
```

Region C — exit edge: `+`-prefix label → stripped label + `isLoopExit`:
```typescript
    const exitEdge = { id: 'e-exit', fromNodeId: 'loop', toNodeId: 'exit', label: 'finish', isLoopExit: true };
```

Region D — the “renders header + body/exit buttons” test assertions: header text === `'Repeat?'` (questionText); exit button text === `'finish'` (verbatim `edge.label`); `onChooseLoopBranch` nth-called `(bodyEdge, false)` + `(exitEdge, true)` — all unchanged expected values (the `exit` boolean now comes from `edge.isLoopExit === true`).

Region E — the error test: the missing-node `renderError` expectation changes from `['Loop node "missing" not found in graph.']` to `['Looped question "missing" not found in graph.']`; the null-graph expectation `['Internal error: graph not loaded.']` is unchanged.

NEW ordinary-question rejection test (inside `describe('shared loop picker renderer', ...)`):
```typescript
  it('returns false when the node is an ordinary question (no loop toggle)', () => {
    const textZone = new MockEl('text');
    const actionZone = new MockEl('actions');
    const renderError = vi.fn();
    const graphOrdinary: ProtocolGraph = {
      ...graph([]),
      nodes: new Map<string, RPNode>([
        ['loop', node('loop', 'question', { questionText: 'Ordinary?' })],
        ['body', node('body', 'answer', { answerText: 'Body answer', displayLabel: 'Body label' })],
        ['exit', node('exit', 'text-block', { content: 'Done' })],
      ]),
    };
    const state = { status: 'awaiting-loop-pick' as const, nodeId: 'loop', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 };
    const rendered = renderLoopPicker(asHtml(textZone), asHtml(actionZone), graphOrdinary, state, { bindClick: vi.fn(), renderError, onChooseLoopBranch: vi.fn() });
    expect(rendered).toBe(false);
    expect(renderError).toHaveBeenCalledWith(['Looped question "loop" not found in graph.']);
  });
```

### src/__tests__/runner/render-question.test.ts — MODIFY

Region A — `node()` helper: remove the `...(kind === 'loop' ? { headerText: '' } : {})` spread (no loop kind). The `loop-end` spread (`{ loopStartId: 'loop' }`) and other kind spreads remain, so the helper typechecks after `LoopNode` is gone.

### src/__tests__/protocol-editor-helpers.test.ts — MODIFY

- Remove `isProtocolEditorLoopExitLabel` from the import list; delete its assertions.
- `loopNodeA` / `loopNodeB` → looped questions: `{ id: 'loop-a', kind: 'question', x: 0, y: 0, width: 160, height: 80, text: 'Loop A', fields: { loop: true } }`.
- `normalizeProtocolEditorEdgeLabel` tests: now single-arg, no `+` prepend — `normalizeProtocolEditorEdgeLabel(' Exit ')` → `'Exit'`; `normalizeProtocolEditorEdgeLabel('   ')` → `undefined`. The "removes leading plus when loop exit is disabled" test is DELETED. The "normalizes loop exit labels with a leading plus" test is recast to assert plain trim + `displayProtocolEditorEdgeLabel(' Exit ')` === `'Exit'` (no `+` strip).
- `shouldDisplayProtocolEditorEdgeLabel` tests (the 50a7fcb display-policy guard): loop-exit edges carry `isLoopExit: true` + plain labels; `loopNodeA` is a looped question. Assertions: looped-question exit edge to question/answer/text-block target → `true` (isLoopExit: true); looped-question body edge (no isLoopExit) → `false`. The former `+Exit`/`+Выход`/`+Да`/`+Завершить` edges become `label: 'Exit'`/`'Выход'`/`'Да'`/`'Завершить'` + `isLoopExit: true`.
- `nodeKindToken('loop')` assertion DELETED (`'loop'` no longer in `RPNodeKind`).
- The editable-kinds arrays `['start', 'question', 'answer', 'text-block', 'loop', 'snippet']` → `['start', 'question', 'answer', 'text-block', 'snippet']` (in both the `nodeTitle` block and the `nodeKindToken` block).
- `defaultColorForProtocolEditorNodeKind('snippet')` assertion unchanged; `fieldsForProtocolEditorNodeKind('question')` → `{ questionText: '' }` unchanged (loop is an opt-in toggle, not a default field).

### src/__tests__/views/protocol-editor-keyboard.test.ts — MODIFY

- i18n mock: remove `'protocolEditor.headerTextLabel'`; ADD `'protocolEditor.loopToggleLabel': 'Loop'` + `'protocolEditor.loopBadgeAriaLabel': 'Loop question'` (where the mock covers protocolEditor keys).
- EDITABLE_NODE_KINDS order assertions (lines ~889, 898): `['start', 'question', 'answer', 'loop', 'snippet']` → `['start', 'question', 'answer', 'snippet']`.
- Any loop-node-creation test recast to create a looped question (Question node + `fields.loop: true`) and exercise the loop toggle in the edit modal.

### src/__tests__/node-picker-modal.test.ts — MODIFY

- Remove `LoopNode` from the type import; remove the `loop()` factory.
- "returns options for all 4 startable kinds": replace the loop node with a looped question (`{ ...baseNodeProps, id, kind: 'question', questionText, loop: true }`); `kindSet` = `new Set(['question', 'text-block', 'snippet'])`, `toHaveLength(4)`.
- "includes answer, start, question, text-block, snippet, loop": remove the loop node; `toHaveLength(5)`; kinds `['question', 'answer', 'start', 'text-block', 'snippet']`; remove the `toContain('loop')` assertion; loop-start/loop-end still excluded.
- "label falls back to id": remove the `loop('l-empty', '')` node + the `byKind['loop']` assertion.
- "sorts kind-groups": remove `loop('l1', 'mid header')`; expected order `['start', 'question', 'answer', 'text-block', 'snippet']`.
- "excludes legacy loop-start/loop-end": recast to `loopStart` + `loopEnd` + a looped question `question('l1', 'Unified')` (loop: true) → 1 option, kind `'question'`, label `'Unified'`.
- `KIND_LABELS` tests: `Object.keys(KIND_LABELS).sort()` → `['answer', 'question', 'snippet', 'start', 'text-block']`; remove `expect(KIND_LABELS.loop).toBe('Loop')`.

### src/__tests__/runner-commands.test.ts — MODIFY

- The "buildNodeOptions returns a loop option" test: recast — the loop node is gone; a looped question appears as a `question` option. Replace `kind: 'loop' as const` with a looped question (`kind: 'question'` + `loop: true`) and assert `o.kind === 'question'` (not `'loop'`). The `NodePickerModal` export test is unchanged.

### src/__tests__/views/inline-runner-modal-output-toolbar.test.ts — MODIFY

The fake loop node becomes a looped fake question (the renderLoopPicker guard now keys on `node.kind === 'question' && node.loop`):
```typescript
interface FakeQuestionNode { id: string; kind: 'question'; questionText: string; loop?: boolean }
// FakeLoopNode interface DELETED.

function makeFakeGraph(includeQuestion: boolean, includeLoop: boolean): {
  nodes: Map<string, FakeQuestionNode>;
  adjacency: Map<string, string[]>;
  edges: Array<{ fromNodeId: string; toNodeId: string; label: string }>;
} {
  const nodes = new Map<string, FakeQuestionNode>();
  if (includeQuestion) nodes.set('Q1', { id: 'Q1', kind: 'question', questionText: 'sample?' });
  if (includeLoop) nodes.set('L1', { id: 'L1', kind: 'question', questionText: '', loop: true });
  return { nodes, adjacency: new Map(), edges: [] };
}
```
The `awaiting-loop-pick` case (`{ label: 'status=awaiting-loop-pick', status: 'awaiting-loop-pick', extras: { nodeId: 'L1' }, graph: makeFakeGraph(false, true) }`) is unchanged — the graph now carries a looped question L1, and the render guard accepts it. The toolbar-absence assertions are unchanged.

### src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts — MODIFY

`makeLoop` → `makeLoopedQuestion`; `LoopNode` import → `QuestionNode` import; `buildGraph` upgraded to the 4-tuple edge format carrying `isLoopExit`:
```typescript
function makeLoopedQuestion(id: string, questionText = 'iter'): QuestionNode {
  return { kind: 'question', id, questionText, loop: true, x: 0, y: 0, width: 100, height: 40 };
}

function buildGraph(
  nodes: RPNode[],
  edgeList: Array<[string, string, string?, boolean?]>,
  startNodeId: string,
): ProtocolGraph {
  // ... nodeMap construction unchanged ...
  const edges: RPEdge[] = edgeList.map(([from, to, label, isLoopExit], i) => ({
    id: `e-${i}`,
    fromNodeId: from,
    toNodeId: to,
    ...(label !== undefined ? { label } : {}),
    ...(isLoopExit === true ? { isLoopExit: true } : {}),
  }));
  // ... adjacency / reverseAdjacency / return unchanged ...
}
```
The two `+exit` exit tuples (lines ~167, 211): `['n-loop', 'n-end', '+exit']` → `['n-loop', 'n-end', 'exit', true]` (label stripped, 4th element `true`). `makeLoop('n-loop', 'iter')` call sites (lines ~160, 204) → `makeLoopedQuestion('n-loop', 'iter')`. The single `rp-loop-body-btn` assertion holds (the exit edge is now `rp-loop-exit-btn`, so only one body button).

## Slices

### Slice 1: Graph types + label utilities

**Files**: `src/graph/graph-model.ts`, `src/graph/node-label.ts`, `src/__tests__/graph/node-label.test.ts`

#### Automated Verification:
- [ ] `node-label` test suite passes: `npx vitest run src/__tests__/graph/node-label.test.ts`
- [ ] No `case 'loop'` in node-label.ts: `grep -n "case 'loop'" src/graph/node-label.ts` returns no matches
- [ ] No prefix-helper exports: `grep -nE "export function (isLabeledEdge|isExitEdge|stripExitPrefix)" src/graph/node-label.ts` returns no matches
- [ ] No `headerText` in node-label.ts: `grep -n "headerText" src/graph/node-label.ts` returns no matches
- [ ] No `'loop'` union member in RPNodeKind: `grep -nE "^\s*\|\s*'loop'\s*;" src/graph/graph-model.ts` returns no matches (intentional comment/JSDoc references to the legacy `'loop'` kind are allowed)
- [ ] Repo-wide `npm run check` is deferred to Slice 9 — intermediate slices intentionally leave downstream consumer imports dangling until each consumer slice rewires them

#### Manual Verification:
- [ ] `QuestionNode.loop` and `RPEdge.isLoopExit` are optional (`?:`) — callers that omit them still type-check
- [ ] `nodeLabel` switch exhaustive over the reduced `RPNodeKind` union (loop-start/loop-end retained as legacy)
- [ ] No stale comment references to a unified `'loop'` kind or "8 arms"

### Slice 2: Parser + edge reconstruction

**Files**: `src/protocol/protocol-document.ts`, `src/protocol/protocol-document-parser.ts`, `src/__tests__/protocol-document-parser.test.ts`

#### Automated Verification:
- [ ] Parser test suite passes: `npx vitest run src/__tests__/protocol-document-parser.test.ts`
- [ ] No `case 'loop'` production arm in parser: `grep -nE "case 'loop':" src/protocol/protocol-document-parser.ts` — any match must be `case 'loop-start':` or `case 'loop-end':` only
- [ ] No `LoopNode` import in parser: `grep -n "LoopNode" src/protocol/protocol-document-parser.ts` returns no matches
- [ ] No `'loop'` literal in VALID_KINDS: `grep -nE "^\s*'loop'," src/protocol/protocol-document-parser.ts` returns no matches
- [ ] `getOptionalBoolean` defined: `grep -n "function getOptionalBoolean" src/protocol/protocol-document-parser.ts` returns a match
- [ ] `isLoopExit` copied in edge reconstruction: `grep -n "isLoopExit" src/protocol/protocol-document-parser.ts` returns a match
- [ ] `isLoopExit` present on ProtocolEdgeRecord: `grep -n "isLoopExit" src/protocol/protocol-document.ts` returns a match
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] `getOptionalBoolean` preserves `true`, `false`, and `undefined` (non-boolean → undefined); no truthiness coercion
- [ ] `case 'question'` reads `loop` via `getOptionalBoolean(fields, 'loop', 'radiprotocol_loop')` (modern key first, legacy `radiprotocol_loop` fallback)
- [ ] Edge reconstruction copies `isLoopExit` only when `=== true` (false/absent/non-boolean → undefined)
- [ ] Legacy `'loop'` kind is rejected with an `unknownKind`-style error (no parser compat arm)

### Slice 3: Migration transform + store wiring

**Files**: `src/protocol/protocol-document-migration.ts`, `src/protocol/protocol-document-store.ts`, `src/__tests__/protocol-document-migration.test.ts`, `src/__tests__/protocol-document-store.test.ts`

#### Automated Verification:
- [ ] Migration + store test suites pass: `npx vitest run src/__tests__/protocol-document-migration.test.ts src/__tests__/protocol-document-store.test.ts`
- [ ] Migration module is pure: `grep -n "from 'obsidian'" src/protocol/protocol-document-migration.ts` returns no matches
- [ ] `migrateProtocolDocument` exported: `grep -n "export function migrateProtocolDocument" src/protocol/protocol-document-migration.ts` returns a match
- [ ] Store read() calls migration: `grep -n "migrateProtocolDocument" src/protocol/protocol-document-store.ts` returns a match
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Idempotency: no legacy `kind === 'loop'` nodes → `{ changed: false }`, same reference, no write
- [ ] Edge reclassification scoped to captured legacy loop node IDs only (no global `+` scanning)
- [ ] Lossless: layered spreads preserve metadata/geometry/colors/text/viewport/layoutDirection/selfCheck/unknown extension fields
- [ ] Migration/persistence failure → `read()` returns `null` (load-failed UX)
- [ ] `update()` on a legacy doc: mutator sees the migrated doc; two sequential mutexed writes (migration, then edit)
- [ ] `node.kind` cast to `string | null` at the migration boundary (legacy wire kinds outside canonical RPNodeKind)

### Slice 4: Validator + test graph-construction

**Files**: `src/graph/graph-validator.ts`, `src/__tests__/graph-validator.test.ts`, `src/__tests__/helpers/canvas-parser.ts`, `src/__tests__/fixtures/unified-loop-*.canvas`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`

#### Automated Verification:
- [ ] Validator tests pass: `npx vitest run src/__tests__/graph-validator.test.ts`
- [ ] No prefix-helper imports in validator: `grep -nE "isLabeledEdge|isExitEdge|stripExitPrefix" src/graph/graph-validator.ts` returns no matches
- [ ] No `kind === 'loop'` in validator: `grep -n "kind === 'loop'" src/graph/graph-validator.ts` returns no matches
- [ ] Validator loop pass keys on looped questions: `grep -n "node.kind !== 'question' || !node.loop" src/graph/graph-validator.ts` returns a match
- [ ] No `LoopNode` import in canvas-parser helper: `grep -n "LoopNode" src/__tests__/helpers/canvas-parser.ts` returns no matches
- [ ] No `'loop'` in canvas-parser validKinds: `grep -nE "'loop'," src/__tests__/helpers/canvas-parser.ts` returns no matches
- [ ] No `loopNoExitWithLegacy` / `loopExitNoLabel` in either locale: `grep -rn "loopNoExitWithLegacy\|loopExitNoLabel" src/i18n/locales/` returns no matches
- [ ] No bare `radiprotocol_nodeType: "loop"` in fixtures: `grep -rnE "radiprotocol_nodeType\":\s*\"loop\"" src/__tests__/fixtures/` returns no matches
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Dead-end check skips looped questions (`node.kind === 'question' && !node.loop`)
- [ ] Loop pass partitions via `edge.isLoopExit === true` (exit) vs `!edge.isLoopExit` (body); no `+`-prefix detection
- [ ] Cycle exemption keys on `n?.kind === 'question' && n.loop === true`
- [ ] en/ru validator messages synchronized (loopNoExit, loopNoBody, unintentionalCycle reworded; loopNoExitWithLegacy + loopExitNoLabel removed from both)
- [ ] Fixtures recast: loop nodes → looped questions; `+`-exit edges → stripped label + radiprotocol_isLoopExit: true
- [ ] 'loop-start'/'loop-end' legacy fixtures + legacyLoopNodes message unchanged

### Slice 5: Runner core

**Files**: `src/runner/protocol-runner.ts`, `src/__tests__/runner/protocol-runner-loop-picker.test.ts`, `src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts`, `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`

#### Automated Verification:
- [ ] Runner loop test suites pass: `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`
- [ ] No `isExitEdge` in runner: `grep -n "isExitEdge" src/runner/protocol-runner.ts` returns no matches
- [ ] No `case 'loop'` arm: `grep -nE "case 'loop':" src/runner/protocol-runner.ts` returns no matches (only loop-start/loop-end)
- [ ] `node.loop === true` present: `grep -n "node.loop === true" src/runner/protocol-runner.ts` returns a match
- [ ] No `LoopNode`/`headerText`/`stripExitPrefix` in the three test files: `grep -rnE "LoopNode|headerText|stripExitPrefix" src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns no matches
- [ ] No `'+` prefix literals in the two snippet tests: `grep -rnE "'\+" src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns no matches
- [ ] Exit tuples carry the 4th element: `grep -nE "'exit', true|'выход', true" src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns matches
- [ ] redo round-trip test present: `grep -n "runner.redo()" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns a match
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Looped question halts at AWAITING_LOOP_PICK (first entry pushes frame; B1 re-entry increments iteration); ordinary question halts at AT_NODE
- [ ] chooseLoopBranch pops frame only on edge.isLoopExit === true; quick-exit pops frame when body answer wired to an isLoopExit target
- [ ] stepBack restores AWAITING_LOOP_PICK; redo restores the loop stack (round-trip test)
- [ ] Nested-loop stack discipline preserved; no stale isExitEdge/`+`-prefix/case 'loop' comments in the runner

### Slice 6: Render loop picker

**Files**: `src/runner/render/render-loop-picker.ts`, `src/__tests__/runner/render-loop-picker.test.ts`, `src/__tests__/runner/render-question.test.ts`

#### Automated Verification:
- [ ] Render test suites pass: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts`
- [ ] No prefix-helper imports: `grep -nE "isExitEdge|stripExitPrefix" src/runner/render/render-loop-picker.ts` returns no matches
- [ ] Looped-question guard: `grep -n "node.kind !== 'question' || !node.loop" src/runner/render/render-loop-picker.ts` returns a match
- [ ] `questionText` header: `grep -n "node.questionText" src/runner/render/render-loop-picker.ts` returns a match
- [ ] No `headerText` in render tests: `grep -n "headerText" src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts` returns no matches
- [ ] Ordinary-question rejection test present: `grep -n "no loop toggle" src/__tests__/runner/render-loop-picker.test.ts` returns a match
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Guard accepts a looped question and rejects an ordinary question / missing node
- [ ] Header renders `questionText`; exit buttons carry `rp-loop-exit-btn` + verbatim `edge.label`; body buttons carry `rp-loop-body-btn` + `nodeLabel(target)`
- [ ] `onChooseLoopBranch(edge, exit)` receives `exit = edge.isLoopExit === true`; no `stripExitPrefix` logic remains

### Slice 7: Editor

**Files**: `src/views/protocol-editor-view.ts`, `src/styles/protocol-editor.css`, `src/styles/loop-support.css`, `src/__tests__/protocol-editor-helpers.test.ts`, `src/__tests__/views/protocol-editor-keyboard.test.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`

#### Automated Verification:
- [ ] Editor helper + keyboard tests pass: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts`
- [ ] No `isProtocolEditorLoopExitLabel` in editor: `grep -n "isProtocolEditorLoopExitLabel" src/views/protocol-editor-view.ts` returns no matches
- [ ] No `case 'loop':` arm in openEditModal: `grep -nE "case 'loop':" src/views/protocol-editor-view.ts` returns no matches (only loop-start/loop-end)
- [ ] Loop toggle + badge present: `grep -n "addLoopToggle\|loop-badge" src/views/protocol-editor-view.ts` returns matches
- [ ] No `nodeKindToken('loop')` in helper test: `grep -n "nodeKindToken('loop')" src/__tests__/protocol-editor-helpers.test.ts` returns no matches
- [ ] No `'loop'` in helper-test editable-kinds arrays: `grep -nE "'loop'" src/__tests__/protocol-editor-helpers.test.ts` returns no matches
- [ ] No stale `+-prefix exit` comment in loop-support.css: `grep -ni "+-prefix exit" src/styles/loop-support.css` returns no matches
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Loop removed from the creation grid; looped questions via Question edit-modal toggle; canvas badge on looped questions
- [ ] Edge-modal exit checkbox shown only for a looped-question source; state from `edge.isLoopExit`; saved as `isLoopExit` on the edge record (no `+` prefix)
- [ ] `shouldDisplayProtocolEditorEdgeLabel` preserves a looped-question exit label regardless of target kind (50a7fcb fix — covered by the helper-level display-policy test)
- [ ] Edge save still assigns `this.doc = updated` + reloads via `loadProtocol()` (0ff2587/f5850c0 fixes)
- [ ] en/ru synchronized: loopToggleLabel + loopBadgeAriaLabel added; headerTextLabel + nodeKind.loop + defaultNodeText.loop removed
- [ ] `nodeKindToken('loop')` assertion + `'loop'` in editable-kinds arrays removed from the helper test

### Slice 8: Node picker + i18n cleanup

**Files**: `src/views/node-picker-modal.ts`, `src/__tests__/node-picker-modal.test.ts`, `src/__tests__/runner-commands.test.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`

#### Automated Verification:
- [ ] Node-picker + runner-commands tests pass: `npx vitest run src/__tests__/node-picker-modal.test.ts src/__tests__/runner-commands.test.ts`
- [ ] No `LoopNode` import in node-picker: `grep -n "LoopNode" src/views/node-picker-modal.ts` returns no matches
- [ ] No `'loop'` in StartableNodeKind/KIND_LABELS/KIND_ORDER: `grep -nE "'loop'" src/views/node-picker-modal.ts` returns no matches
- [ ] No `headerText` in node-picker: `grep -n "headerText" src/views/node-picker-modal.ts` returns no matches
- [ ] No stale standalone-loop JSDoc: `grep -niE "loop node|→ loop" src/views/node-picker-modal.ts` returns no matches (loop-start/loop-end legacy refs allowed)
- [ ] No `nodePicker.loop` in locales: `grep -rn "loop" src/i18n/locales/en.json src/i18n/locales/ru.json` — no `nodePicker.loop` entry remains
- [ ] No `LoopNode`/`headerText` in node-picker test: `grep -nE "LoopNode|headerText" src/__tests__/node-picker-modal.test.ts` returns no matches
- [ ] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Looped questions appear as `question` options; standalone Loop option removed
- [ ] KIND_LABELS / KIND_LABEL_KEYS / KIND_ORDER exhaustive over the 5 remaining startable kinds
- [ ] buildStartableProtocolNodeOptions fallback chain no longer includes headerText
- [ ] 'loop-start'/'loop-end' still excluded; no stale standalone-loop JSDoc remains
- [ ] en/ru `nodePicker.loop` removed from both locales

### Slice 9: Cross-cutting tests + grep audit

**Files**: `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`, `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`, `src/runner/runner-state.ts`

#### Automated Verification:
- [ ] The two cross-cutting view tests pass: `npx vitest run src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`
- [ ] No `FakeLoopNode`/`kind: 'loop'`/`'+exit'` in either view test: `grep -rnE "FakeLoopNode|kind: 'loop'|'\+exit'" src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` returns no matches
- [ ] 4-tuple builder + isLoopExit present in the loop-body test: `grep -n "isLoopExit" src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` returns matches
- [ ] `runner-state.ts` has no `headerText` / "loop node" / "unified loop node" reference: `grep -nE "headerText|loop node|unified loop node" src/runner/runner-state.ts` returns no matches
- [ ] **Exhaustive sweep audit (load-bearing)** across `src/`:
  - FORBIDDEN (no matches): `grep -rn "isExitEdge\|isLabeledEdge\|stripExitPrefix" src/`; `grep -rn "FakeLoopNode" src/`
  - `grep -rnE "case 'loop':" src/` — any match must be `case 'loop-start':` or `case 'loop-end':` only
  - `grep -rn "kind === 'loop'" src/` returns only `src/protocol/protocol-document-migration.ts` (the legacy discriminator)
  - `grep -rn "\bLoopNode\b" src/` returns only historical JSDoc in `src/graph/graph-model.ts` (no type imports/constructions/FakeLoopNode; `legacyLoopNodes` excluded by word boundary)
  - `grep -rn "headerText" src/` returns only: the migration module, migration tests, the parser legacy-`'loop'`-rejection fixture, and historical JSDoc in `graph-model.ts` — no canonical runtime `headerText` read/write
  - `'loop-start'`/`'loop-end'` legacy literals + `loop-start.canvas`/`loop-body.canvas` fixtures + test node IDs named `'loop'` are INTENTIONAL and allowed
- [ ] **Project baseline**: `npm run check` passes (build + lint + tests + planning + consistency + agent-docs)

#### Manual Verification:
- [ ] output-toolbar `awaiting-loop-pick` case renders against a looped-question graph; toolbar-absence assertions unchanged
- [ ] loop-body-file-bound test: looped question + 4-tuple isLoopExit exit; single `rp-loop-body-btn` assertion holds
- [ ] `runner-state.ts` JSDoc references "looped question" / "questionText" (no "loop node" / "headerText")
- [ ] The grep audit certifies no stale standalone-loop / prefix-helper / canonical-headerText references survive outside the intentional migration/rejection/historical-JSDoc boundary

## Desired End State

A looped question is authored and run as follows.

Authoring (`src/views/protocol-editor-view.ts`): a user adds a Question node, types its prompt text, and checks a "Loop" toggle in the edit modal; the canvas renders the question with a small loop badge and tooltip. The user draws an outgoing edge for the loop body and another for the exit, opens the exit edge's modal, and checks "This edge exits the loop" (the checkbox is shown because the source question has `loop: true`). Saving persists `fields.loop: true` on the question and `isLoopExit: true` on the exit edge — no `+` prefix anywhere.

Serialized shape (`protocol-document.ts` records):
```json
{
  "id": "n-loop", "kind": "question",
  "fields": { "questionText": "Repeat for each slice?" },
  "x": 0, "y": 0, "width": 250, "height": 60, "color": "rgba(33,150,243,0.24)"
}
```
```json
{ "id": "e-exit", "fromNodeId": "n-loop", "toNodeId": "n-next", "label": "Done", "isLoopExit": true }
```

Runtime (`graph-model.ts`): `graph.nodes.get('n-loop')` returns a `QuestionNode` with `kind: 'question'`, `questionText: 'Repeat for each slice?'`, `loop: true`; `graph.edges.find(e => e.id === 'e-exit').isLoopExit === true`.

Runner (`protocol-runner.ts`): on reaching the looped question, `advanceThrough` `case 'question'` sees `node.loop === true`, pushes a `LoopContext` frame, and halts at `AWAITING_LOOP_PICK` — exactly the current standalone-loop behavior. `renderLoopPicker` renders `questionText` as the header and one button per outgoing edge, classifying exits via `edge.isLoopExit`. `chooseLoopBranch(edgeId)` pops the frame on `edge.isLoopExit`; quick-exit and dead-end return behave unchanged. `stepBack`/`redo` restore `AWAITING_LOOP_PICK` and the loop stack unchanged.

Migration (`protocol-document-store.ts`): opening a legacy file with `kind: 'loop'` nodes migrates it once on `read()`, persists the canonical document, and returns it; a second `read()` writes nothing. The inline runner's later raw re-read sees the migrated file.

Validator (`graph-validator.ts`): a looped question with no `isLoopExit` edge emits `loopNoExit`; with no body edge emits `loopNoBody`; an ordinary question in a cycle emits `unintentionalCycle` while a looped question in the same topology does not.

## File Map
```
src/graph/graph-model.ts                              # MODIFY — remove 'loop'/LoopNode/headerText; add QuestionNode.loop + RPEdge.isLoopExit
src/graph/node-label.ts                               # MODIFY — remove case 'loop' + isExitEdge/isLabeledEdge/stripExitPrefix
src/protocol/protocol-document.ts                          # MODIFY — add ProtocolEdgeRecord.isLoopExit; fields JSDoc: headerText → loop
src/protocol/protocol-document-parser.ts             # MODIFY — getOptionalBoolean; loop on case 'question'; isLoopExit through edge reconstruction; remove 'loop' from VALID_KINDS
src/protocol/protocol-document-migration.ts           # NEW — pure migrateProtocolDocument(doc) → {doc, changed}
src/protocol/protocol-document-store.ts              # MODIFY — read() migrates + persists on change; failure → null
src/graph/graph-validator.ts                          # MODIFY — loop pass on question+loop; dead-end skip; cycle exemption; remove prefix branches
src/runner/protocol-runner.ts                         # MODIFY — case 'question' loop branch; remove case 'loop'; chooseLoopBranch/quick-exit via edge.isLoopExit
src/runner/render/render-loop-picker.ts              # MODIFY — guard question+loop; questionText header; isLoopExit classification; verbatim caption
src/views/protocol-editor-view.ts                    # MODIFY — remove Loop from grid; loop toggle; canvas badge; edge-modal isLoopExit; remove +helpers
src/views/node-picker-modal.ts                       # MODIFY — remove loop from startable kinds/labels/order; drop LoopNode import + headerText fallback
src/i18n/locales/en.json                             # MODIFY — remove standalone-Loop labels; add toggle/badge; reword validator messages
src/i18n/locales/ru.json                             # MODIFY — synchronized en changes
src/styles/protocol-editor.css                       # MODIFY — remove [data-node-kind="loop"] choice selector; add loop-badge style
src/styles/loop-support.css                          # MODIFY — keep picker button classes (used by looped questions)
src/__tests__/helpers/canvas-parser.ts               # MODIFY — recast case 'loop'→looped Question; read radiprotocol_loop/radiprotocol_isLoopExit
src/__tests__/fixtures/unified-loop-*.canvas         # MODIFY — recast loop fixtures to question+loop + isLoopExit edges
src/__tests__/graph/node-label.test.ts               # MODIFY — remove loop/headerText/prefix-helper tests
src/__tests__/protocol-document-parser.test.ts       # MODIFY — recast loop→question compat; boolean round-trip
src/__tests__/protocol-document-migration.test.ts    # NEW — migration transform unit tests
src/__tests__/protocol-document-store.test.ts        # MODIFY — first-read writes, second-read no-write, failure no-write, update-on-legacy
src/__tests__/graph-validator.test.ts                # MODIFY — recast fixtures around looped Questions + isLoopExit
src/__tests__/runner/protocol-runner-loop-picker.test.ts        # MODIFY — looped-question dispatch, re-entry, quick-exit, nested, stepBack, redo
src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts  # MODIFY — makeLoop → looped Question
src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts  # MODIFY — makeLoop → looped Question
src/__tests__/runner/render-loop-picker.test.ts      # MODIFY — looped-question guard, questionText header, isLoopExit styling, verbatim caption
src/__tests__/runner/render-question.test.ts         # MODIFY — remove loop headerText spread
src/__tests__/protocol-editor-helpers.test.ts        # MODIFY — isLoopExit flag persistence across target kinds
src/__tests__/views/protocol-editor-keyboard.test.ts # MODIFY — i18n mocks + EDITABLE_NODE_KINDS order
src/__tests__/node-picker-modal.test.ts              # MODIFY — remove loop from startable set
src/__tests__/runner-commands.test.ts                # MODIFY — remove loop option assertion
src/__tests__/views/inline-runner-modal-output-toolbar.test.ts   # MODIFY — FakeLoopNode → looped Question
src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts  # MODIFY — makeLoop → looped Question
```

## Ordering Constraints
- **Slice 1 (graph types) must precede every other slice** — all consumers depend on the new `QuestionNode.loop` / `RPEdge.isLoopExit` shape and the removal of `LoopNode`/`'loop'`.
- **Slice 2 (parser) must precede Slice 3 (migration)** — the migration transform operates on `ProtocolDocumentV1` records but its tests assert the canonical post-parse shape; the parser's `isLoopExit` reconstruction must exist first.
- **Slice 3 (migration + store) must precede Slice 4 (validator) conceptually** — but Slice 4's validator change does not import the migration module; the ordering keeps the migration bridge in place before recasting validator tests that assume canonical documents.
- **Slice 4 (validator + canvas-parser helper + fixtures) must precede Slices 5 and 6** — runner and render tests build graphs via the recast `helpers/canvas-parser.ts` and `.canvas` fixtures.
- **Slice 7 (editor) and Slice 8 (picker) are independent of each other** but both depend on Slice 1; they may be sequenced in either order.
- **Slice 9 (cross-cutting tests + grep audit) must be last** — it depends on all prior slices and certifies completeness.
- **i18n edits are spread across Slices 4, 7, 8** (validator messages, editor toggle/badge, picker key removal); the `en.json`/`ru.json` Architecture fences are rewritten cumulatively by each later slice that touches them.

## Verification Notes
- **Exhaustive sweep audit (load-bearing)**: after Slice 9, `grep -rn "case 'loop'" src/`, `grep -rn "kind === 'loop'" src/`, `grep -rn "headerText" src/`, `grep -rn "isExitEdge\|isLabeledEdge\|stripExitPrefix" src/`, `grep -rn "'loop'" src/` must return ONLY intentional references (the migration module's legacy discriminator, `'loop-start'`/`'loop-end'` legacy validator arms, comments). No surviving `case 'loop'` production arm, no `LoopNode` import, no `headerText` read/write outside the migration boundary.
- **Migration persistence**: store tests assert (a) first `read()` of a legacy doc calls `vault.adapter.write` exactly once and `files[path]` contains no `kind: 'loop'` + `fields.loop === true` + `fields.questionText` carries former `headerText` + eligible edges have `+` stripped + `isLoopExit: true`; (b) second `read()` does not call `write`; (c) invalid-schema / invalid-JSON / adapter-read-failure / adapter-write-failure → `read()` returns `null` and `write` is not called for the non-write failures; (d) `update()` on a legacy doc calls `write` twice (migration, then edit) and the mutator receives the migrated doc.
- **Save/reopen display-policy guard**: editor-helper tests assert `shouldDisplayProtocolEditorEdgeLabel` returns `true` for a looped-question exit edge (`isLoopExit: true`) to a question/answer/text-block target — the 50a7fcb display-policy fix. The edge-save production path preserves `this.doc = updated` + `loadProtocol()` (0ff2587/f5850c0) and persists `isLoopExit` regardless of target kind.
- **Runner behavior preservation**: runner tests assert looped-question dispatch (body re-entry increments iteration via the B1 guard; exit pops the frame), quick-exit through a body answer wired to an `isLoopExit` target, nested-loop stack discipline, `stepBack` restores `AWAITING_LOOP_PICK`, redo restores the loop stack — all on looped Questions, not `LoopNode`.
- **Render picker**: render tests assert the guard accepts a looped Question and rejects an ordinary question; the header renders `questionText`; exit buttons carry `rp-loop-exit-btn` and the verbatim `edge.label`; body buttons carry `rp-loop-body-btn` and `nodeLabel(target)`.
- **Validator**: a zero-edge looped question emits `loopNoExit` + `loopNoBody` but NOT `deadEndQuestion`; an ordinary question in a cycle emits `unintentionalCycle`; a looped question in the same topology does not.
- **Idempotency**: the migration discriminator is exact `kind === 'loop'`; a document whose nodes are all already migrated (no `kind: 'loop'`) triggers no write even if some edges still carry a literal `+` in a user-authored label (global `+` scanning is forbidden — only edges originating from captured legacy loop node IDs are reclassified).
- **Build gate**: `npm run check` passes (build + lint + tests + planning + consistency + agent-docs).

## Performance Considerations
- The migration discriminator scans `doc.nodes` for `kind === 'loop'` on every `read()` — O(n) where n is the node count, additive to the existing full-document parse. No caching concern; `read()` already parses the whole document.
- The extra disk write occurs only on the first `read()` of a legacy document (idempotent thereafter). No N+1 risk; the transform is a single in-memory pass over nodes + edges.
- `update()` on a legacy document performs two sequential mutexed writes (migration, then edit). This is a one-time cost per legacy document; subsequent updates perform a single write. The `WriteMutex` is non-reentrant but `update()` does not hold it during `read()`, so there is no deadlock.

## Migration Notes
- **Existing data**: `.rp.json` documents with `kind: 'loop'` nodes and `+`-prefixed exit edges are auto-migrated on first open. Version remains `1` (no `PROTOCOL_VERSION` bump — adding optional fields `loop` / `isLoopExit` and a one-time transform is backward-compatible).
- **Discriminator**: exact legacy `kind === 'loop'` node shape. Capture those node IDs; reclassify only their outgoing `+`-prefixed edges (strip the `+` + leading whitespace, set `isLoopExit: true`). Edges from non-loop nodes are never reclassified, even if their label begins with `+`.
- **Losslessness**: the transform preserves document metadata (`schema`/`version`/`id`/`title`/`createdAt`), node IDs/geometry/color/text, edge IDs/endpoints, viewport, layout direction, `selfCheckEnabled`/`selfCheckItems`, and unknown extension fields via layered spreads (`...doc`, `...node`, `...node.fields`, `...edge`). `updatedAt` is bumped to `new Date().toISOString()`.
- **Rollback**: none — the migration is forward-only. A migrated document cannot be reverted to `kind: 'loop'` (the canonical kind is removed). The pre-migration file is overwritten in place; users who keep git history can recover the legacy form from version control.
- **Backwards compatibility**: legacy `'loop'` is no longer in `RPNodeKind` and no longer in the parser's `VALID_KINDS`. The only bridge is `ProtocolDocumentStore.read()` migration. `'loop-start'`/`'loop-end'` legacy kinds remain parseable and are still rejected by the validator (MIGRATE-01) — unaffected.
- **Partial-migrated state**: cannot arise from the migration (the whole document is written in one atomic `write()`). A historically partial state (nodes migrated but some edges still carry `+`) is not auto-healed because the discriminator sees no `kind: 'loop'`; such edges keep their `+` label as ordinary user text and are not exits — acceptable since this state can only arise from manual editing outside the plugin.

## Pattern References
- `src/protocol/protocol-document-parser.ts:38-55` — typed optional-value helpers (`getOptionalString`, `getSeparator`, `getCompatValue`) to model `getOptionalBoolean` after.
- `src/protocol/protocol-document-parser.ts:192-209` — `case 'question'`/`case 'answer'` arms showing the helper call shape inside the typed object literal.
- `src/protocol/protocol-document-parser.ts:105-138` — edge reconstruction block; the `label` field is the exact optional serialized→runtime copy pattern to mirror for `isLoopExit`.
- `src/snippets/protocol-ref-sync.ts:64-100` — closest read-transform-write idiom: `mutated`-flag skip-on-noop + `JSON.stringify(parsed, null, 2) + '\n'` write.
- `src/views/protocol-editor-view.ts:2089-2108` — layered-spread lossless document mutation (`...existing`, `...candidate`, `...candidate.fields`) preserving unknown fields.
- `src/protocol/protocol-document.ts:151-168` — shallow `isProtocolDocumentV1` guard (admits legacy records).
- `src/i18n/locales/en.json:288` + `src/i18n/locales/ru.json:288` — synchronized `graphValidator.loopNoExit` key pair with `{label}` interpolation; model for new/reworded keys.

## Developer Context
**Q (directional confirm, D-01): Place the migration transform in a new pure module `src/protocol/protocol-document-migration.ts` (NFR-01 split, mirrors `protocol-ref-sync.ts:64-100`), or inline in `read()`?**
A: Follow pure-module split.

**Q (directional confirm, D-02): Remove Loop from the node-creation grid; looped questions via Question edit-modal toggle + canvas badge, or keep a dedicated Loop button?**
A: Follow toggle + badge.

**Q (directional confirm, D-03): Remove `isExitEdge`/`isLabeledEdge`/`stripExitPrefix` entirely and rewire all consumers to `edge.isLoopExit`, or keep a prefix fallback?**
A: Follow full removal.

**Q (genuine ambiguity, D-04): The research has tension between "accepted raw wire literal at parser boundary" and "migration is the only legacy bridge / no prefix fallback". Remove parser `'loop'` compat (sole bridge = store migration), or keep a parser compat arm (which requires retaining `+`-edge detection)?**
A: Remove parser compat (Recommended) — parser removes `'loop'` from `VALID_KINDS`; store migration is the sole bridge; consistent with "no prefix fallback".

## Design History
- Slice 1: Graph types + label utilities — approved as generated
- Slice 2: Parser + edge reconstruction — approved as generated
- Slice 3: Migration transform + store wiring — approved as generated
- Slice 4: Validator + test graph-construction — approved as generated
- Slice 5: Runner core — approved as generated
- Slice 6: Render loop picker — approved as generated
- Slice 7: Editor — approved as generated
- Slice 8: Node picker + i18n cleanup — approved as generated
- Slice 9: Cross-cutting tests + grep audit — approved as generated

## References
- Research artifact: `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`
- FRD: `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md`
- Prior related research: `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md`
- Precedent commits: `8185dbb` (free-text-input excision), `1dadc67`/`6229b6d` (stale parser/writer cleanup), `50a7fcb`/`f5850c0`/`0ff2587` (`+`-prefix persistence fixes), `478af29` (quick-exit).