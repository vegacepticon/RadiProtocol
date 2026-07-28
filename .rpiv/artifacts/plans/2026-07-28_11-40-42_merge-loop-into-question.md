---
date: 2026-07-28T11:40:42+0300
author: Roman Shulgha
commit: 840487e
branch: main
repository: RadiProtocol
topic: "Merge Loop node type into Question via a loop toggle + explicit isLoopExit edge flag"
tags: [plan, graph, protocol, runner, render, editor, picker, i18n, migration]
status: ready
parent: ".rpiv/artifacts/designs/2026-07-28_09-09-24_merge-loop-into-question.md"
phase_count: 9
phases:
  - { n: 1, title: "Graph types + label utilities" }
  - { n: 2, title: "Parser + edge reconstruction" }
  - { n: 3, title: "Migration transform + store wiring" }
  - { n: 4, title: "Validator + test graph-construction" }
  - { n: 5, title: "Runner core" }
  - { n: 6, title: "Render loop picker" }
  - { n: 7, title: "Editor" }
  - { n: 8, title: "Node picker + i18n cleanup" }
  - { n: 9, title: "Cross-cutting tests + grep audit" }
last_updated: 2026-07-28T11:40:42+0300
last_updated_by: Roman Shulgha
---

# Merge Loop into Question Implementation Plan

## Overview

Fold the standalone `LoopNode` into `QuestionNode` through `loop?: boolean`, replace `+`-prefixed loop-exit labels with `isLoopExit?: boolean`, and migrate existing `.rp.json` documents losslessly on first read. This plan is a phased execution form of `.rpiv/artifacts/designs/2026-07-28_09-09-24_merge-loop-into-question.md`; its nine phases inherit the design's nine verified slices without recomposition.

## Desired End State

Authors create a Question, enable its Loop toggle, and see a loop badge on the canvas. Exit edges are marked through the existing edge checkbox and persist `isLoopExit: true`, independent of their user-facing labels. Runtime graphs expose looped Questions and explicit exit metadata; the runner reuses `AWAITING_LOOP_PICK`, `LoopContext`, quick-exit, nested-loop, stepBack, and redo behavior. Legacy standalone-loop documents migrate once inside `ProtocolDocumentStore.read()`, persist before return, and do not write again on a second read. Validator, editor, picker, renderer, fixtures, and tests contain no canonical standalone-loop or prefix-helper paths. Completion is verified by the phase-specific tests and the final `npm run check` plus exhaustive grep audit.

## What We're NOT Doing

- README/documentation updates; the non-load-bearing Loop mention remains out of scope.
- Changes to legacy `'loop-start'` / `'loop-end'` parsing or validator rejection.
- Changes to snippet, answer, text-block, or start node behavior.
- New runner states or changes to `LoopContext` shape.
- A `PROTOCOL_VERSION` bump or a general migration framework.
- Sidebar/RunnerView work; the runner remains inline-only.
- Snippet-reference synchronization changes.

## Phase 1: Graph types + label utilities

### Overview

Establish the canonical graph model by moving loop behavior onto Questions, moving exit semantics onto edges, and removing standalone-loop/prefix-label utilities.

### Changes Required:

#### 1. Graph model
**File**: `src/graph/graph-model.ts`
**Changes**: Remove the standalone `'loop'` kind, `LoopNode`, and its union member; add optional `QuestionNode.loop` and `RPEdge.isLoopExit`; refresh historical comments.

#### 2. Shared labels
**File**: `src/graph/node-label.ts`
**Changes**: Remove the standalone-loop label arm and delete `isLabeledEdge`, `isExitEdge`, and `stripExitPrefix`.

#### 3. Label tests
**File**: `src/__tests__/graph/node-label.test.ts`
**Changes**: Recast exhaustive node-label coverage for seven kinds and remove standalone-loop/prefix-helper tests.

**Implementation detail — `graph-model.ts` header:**
```typescript
// The standalone 'loop' kind was merged into 'question' via QuestionNode.loop
// (loop toggle). 'loop-start' / 'loop-end' remain as legacy parseable kinds
// (validator emits MIGRATE-01); LoopStartNode / LoopEndNode keep @deprecated JSDoc.
```

**Implementation detail — `RPNodeKind`:**
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

**Implementation detail — `QuestionNode`:**
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

Delete the entire `LoopNode` interface block.

**Implementation detail — `RPNode`:**
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

**Implementation detail — `RPEdge`:**
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

**Implementation detail — `node-label.ts`:**
```typescript
import type { RPNode } from './graph-model';
```

Delete the `nodeLabel` switch's `case 'loop'` arm and delete the exported `isLabeledEdge`, `isExitEdge`, and `stripExitPrefix` functions with their JSDoc. The file ends after `nodeLabel`; retain the other seven switch arms.

**Implementation detail — tests:** remove the standalone-loop node-label test and the three complete prefix-helper `describe` blocks. The retained header/import shape is:
```typescript
import { describe, it, expect } from 'vitest';
import { nodeLabel } from '../../graph/node-label';
import type { RPNode } from '../../graph/graph-model';

// ─────────────────────────────────────────────────────────────────────────────
// nodeLabel — all RPNodeKind arms (7 after the loop→question merge)
// ─────────────────────────────────────────────────────────────────────────────
```

### Success Criteria:

#### Automated Verification:
- [x] `node-label` test suite passes: `npx vitest run src/__tests__/graph/node-label.test.ts`
- [x] No `case 'loop'` in node-label.ts: `grep -n "case 'loop'" src/graph/node-label.ts` returns no matches
- [x] No prefix-helper exports: `grep -nE "export function (isLabeledEdge|isExitEdge|stripExitPrefix)" src/graph/node-label.ts` returns no matches
- [x] No `headerText` in node-label.ts: `grep -n "headerText" src/graph/node-label.ts` returns no matches
- [x] No `'loop'` union member in RPNodeKind: `grep -nE "^\s*\|\s*'loop'\s*;" src/graph/graph-model.ts` returns no matches (intentional comment/JSDoc references to the legacy `'loop'` kind are allowed)
- [x] Repo-wide `npm run check` is deferred to Slice 9 — intermediate slices intentionally leave downstream consumer imports dangling until each consumer slice rewires them

#### Manual Verification:
- [ ] `QuestionNode.loop` and `RPEdge.isLoopExit` are optional (`?:`) — callers that omit them still type-check
- [ ] `nodeLabel` switch exhaustive over the reduced `RPNodeKind` union (loop-start/loop-end retained as legacy)
- [ ] No stale comment references to a unified `'loop'` kind or "8 arms"

---

## Phase 2: Parser + edge reconstruction

### Overview

Carry the new optional booleans through serialized records and parser reconstruction while rejecting legacy standalone-loop kinds outside the migration seam.

### Changes Required:

#### 1. Protocol records
**File**: `src/protocol/protocol-document.ts`
**Changes**: Add `ProtocolEdgeRecord.isLoopExit` and update typed-field documentation from `headerText` to `loop`.

#### 2. Protocol parser
**File**: `src/protocol/protocol-document-parser.ts`
**Changes**: Add three-state optional-boolean parsing, parse `QuestionNode.loop`, copy `isLoopExit`, and remove standalone-loop kind support.

#### 3. Parser tests
**File**: `src/__tests__/protocol-document-parser.test.ts`
**Changes**: Cover looped Questions, true/false/absent/non-boolean values, explicit edge flags, and legacy-loop rejection.

**Implementation detail — `ProtocolEdgeRecord`:**
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

**Implementation detail — node fields JSDoc:**
```typescript
   * Typed node fields. Keys are camelCase without prefix:
   * - questionText, answerText, displayLabel, content, separator,
   *   loop, subfolderPath, snippetLabel, snippetSeparator, snippetPath.
```

**Implementation detail — parser imports:**
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

**Implementation detail — `VALID_KINDS`:**
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

**Implementation detail — optional boolean helper:**
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

**Implementation detail — Question parsing:**
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

Delete the standalone `case 'loop'` arm; retain `loop-start` and `loop-end`.

**Implementation detail — edge reconstruction:**
```typescript
      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNodeId,
        toNodeId: rawEdge.toNodeId,
        label: typeof rawEdge.label === 'string' ? rawEdge.label : undefined,
        isLoopExit: rawEdge.isLoopExit === true ? true : undefined,
      });
```

**Implementation detail — parser tests:**
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

  it('rejects legacy "loop" kind (migration is the sole bridge)', () => {
    const doc = docWithNodes([{ id: 'n1', kind: 'loop' as never, fields: { headerText: 'Legacy loop' } }]);
    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('loop');
  });
```

In the legacy-key test, recast `n4` as a Question with `radiprotocol_questionText` and `radiprotocol_loop: true`. Add this edge test in the edges/adjacency block:
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

### Success Criteria:

#### Automated Verification:
- [x] Parser test suite passes: `npx vitest run src/__tests__/protocol-document-parser.test.ts`
- [x] No `case 'loop'` production arm in parser: `grep -nE "case 'loop':" src/protocol/protocol-document-parser.ts` — any match must be `case 'loop-start':` or `case 'loop-end':` only
- [x] No `LoopNode` import in parser: `grep -n "LoopNode" src/protocol/protocol-document-parser.ts` returns no matches
- [x] No `'loop'` literal in VALID_KINDS: `grep -nE "^\s*'loop'," src/protocol/protocol-document-parser.ts` returns no matches
- [x] `getOptionalBoolean` defined: `grep -n "function getOptionalBoolean" src/protocol/protocol-document-parser.ts` returns a match
- [x] `isLoopExit` copied in edge reconstruction: `grep -n "isLoopExit" src/protocol/protocol-document-parser.ts` returns a match
- [x] `isLoopExit` present on ProtocolEdgeRecord: `grep -n "isLoopExit" src/protocol/protocol-document.ts` returns a match
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] `getOptionalBoolean` preserves `true`, `false`, and `undefined` (non-boolean → undefined); no truthiness coercion
- [ ] `case 'question'` reads `loop` via `getOptionalBoolean(fields, 'loop', 'radiprotocol_loop')` (modern key first, legacy `radiprotocol_loop` fallback)
- [ ] Edge reconstruction copies `isLoopExit` only when `=== true` (false/absent/non-boolean → undefined)
- [ ] Legacy `'loop'` kind is rejected with an `unknownKind`-style error (no parser compat arm)

---

## Phase 3: Migration transform + store wiring

### Overview

Add the pure, lossless, idempotent migration and persist canonical documents from the shared store read path before any consumer receives them.

### Changes Required:

#### 1. Pure migration
**File**: `src/protocol/protocol-document-migration.ts`
**Changes**: Add `migrateProtocolDocument`, scoped legacy-node and edge transforms, preservation spreads, and injected time.

#### 2. Store integration
**File**: `src/protocol/protocol-document-store.ts`
**Changes**: Run and persist migration inside `read()`; return `null` on transform or persistence failure.

#### 3. Inline runner migration preflight
**File**: `src/views/inline-runner-modal.ts`
**Changes**: Before the modal's raw vault read, call the shared `ProtocolDocumentStore.read()` migration seam and stop with the existing read-failure UX on `null`, ensuring direct inline execution cannot bypass migration.

#### 4. Inline runner migration integration test
**File**: `src/__tests__/views/inline-runner-modal.test.ts`
**Changes**: Open the inline runner against legacy raw content, assert the store migration preflight runs before the raw read/parser, and assert the parser receives canonical looped-Question content.

#### 5. Migration unit tests
**File**: `src/__tests__/protocol-document-migration.test.ts`
**Changes**: Cover discriminator/idempotency, node and edge transformation, defensive handling, and losslessness.

#### 6. Store migration tests
**File**: `src/__tests__/protocol-document-store.test.ts`
**Changes**: Cover first-read persistence, second-read no-op, failure behavior, and legacy update's two writes.

**Implementation detail — new pure migration module:**
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
    const headerTextValue = typeof fields['headerText'] === 'string'
      ? fields['headerText']
      : typeof fields['radiprotocol_headerText'] === 'string'
        ? fields['radiprotocol_headerText']
        : '';
    delete fields['headerText'];
    delete fields['radiprotocol_headerText'];
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

**Implementation detail — store import and `read()`:**
```typescript
import { migrateProtocolDocument } from './protocol-document-migration';
```
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

**Implementation detail — inline runner migration preflight:** insert after the `TFile` guard and before `app.vault.read(file)`:
```typescript
    // Every execution path must cross the store migration seam before parsing.
    // read() persists legacy standalone loops into canonical looped Questions;
    // the raw read below then observes that canonical on-disk document.
    const canonicalDoc = await this.plugin.protocolDocumentStore.read(protocolPath);
    if (canonicalDoc === null) {
      const reason = this.plugin.i18n.t('inlineRunner.couldNotReadProtocol', { path: protocolPath });
      console.warn('[RadiProtocol] InlineRunnerModal.open() failed:', reason);
      new Notice(reason);
      this.close();
      return;
    }
```

**Implementation detail — direct inline-open regression:** add to `inline-runner-modal.test.ts`. The store unit tests retain responsibility for the real transform; this view-level integration pins sequencing and canonical parser input.
```typescript
  it('migrates a legacy protocol before the direct inline raw read and parse', async () => {
    const { modal, app, plugin } = setupModal();
    const file = new (TFile as any)('test.canvas');
    app.vault.getAbstractFileByPath.mockReturnValue(file);

    const legacy = JSON.stringify({
      schema: 'radiprotocol.protocol', version: 1, id: 'legacy', title: 'Legacy',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ id: 'loop', kind: 'loop', x: 0, y: 0, width: 200, height: 60, fields: { headerText: 'Repeat?' } }],
      edges: [],
    });
    const canonical = JSON.stringify({
      schema: 'radiprotocol.protocol', version: 1, id: 'legacy', title: 'Legacy',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      nodes: [{ id: 'loop', kind: 'question', x: 0, y: 0, width: 200, height: 60, fields: { questionText: 'Repeat?', loop: true } }],
      edges: [],
    });
    let persisted = legacy;
    (plugin as any).protocolDocumentStore = {
      read: vi.fn(async () => {
        persisted = canonical;
        return JSON.parse(canonical);
      }),
    };
    app.vault.read.mockImplementation(async () => persisted);
    const parse = vi.fn((content: string) => {
      expect(content).toBe(canonical);
      expect(content).not.toContain('"kind":"loop"');
      return {
        success: true as const,
        graph: {
          canvasFilePath: 'test.canvas',
          nodes: new Map([['loop', { id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true, x: 0, y: 0, width: 200, height: 60 }]]),
          edges: [], adjacency: new Map([['loop', []]]), reverseAdjacency: new Map([['loop', []]]), startNodeId: 'loop',
        },
      };
    });
    (plugin as any).protocolDocumentParser = { parse };

    await modal.open();

    expect((plugin as any).protocolDocumentStore.read).toHaveBeenCalledWith('test.canvas');
    expect(parse).toHaveBeenCalledOnce();
  });
```

**Implementation detail — migration unit test file:**
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
  it('falls back to legacy radiprotocol_headerText and removes the legacy key', () => {
    const d = docWith([{ id: 'n-loop', kind: 'loop' as never, x: 0, y: 0, width: 250, height: 60, fields: { radiprotocol_headerText: 'Legacy prompt' } }]);
    const { doc } = migrateProtocolDocument(d, () => NOW);
    expect(doc.nodes[0]!.fields['questionText']).toBe('Legacy prompt');
    expect(doc.nodes[0]!.fields['radiprotocol_headerText']).toBeUndefined();
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

**Implementation detail — store migration tests:** add after the existing read tests:
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

### Success Criteria:

#### Automated Verification:
- [x] Migration + store + direct inline-open test suites pass: `npx vitest run src/__tests__/protocol-document-migration.test.ts src/__tests__/protocol-document-store.test.ts src/__tests__/views/inline-runner-modal.test.ts`
- [x] Direct inline execution crosses the migration seam before raw parsing: `grep -n "protocolDocumentStore.read" src/views/inline-runner-modal.ts` returns a match
- [x] Migration module is pure: `grep -n "from 'obsidian'" src/protocol/protocol-document-migration.ts` returns no matches
- [x] `migrateProtocolDocument` exported: `grep -n "export function migrateProtocolDocument" src/protocol/protocol-document-migration.ts` returns a match
- [x] Store read() calls migration: `grep -n "migrateProtocolDocument" src/protocol/protocol-document-store.ts` returns a match
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Idempotency: no legacy `kind === 'loop'` nodes → `{ changed: false }`, same reference, no write
- [ ] Legacy prompt migration prefers string `fields.headerText`, falls back to string `fields.radiprotocol_headerText`, and removes both legacy keys
- [ ] Edge reclassification scoped to captured legacy loop node IDs only (no global `+` scanning)
- [ ] Lossless: layered spreads preserve metadata/geometry/colors/text/viewport/layoutDirection/selfCheck/unknown extension fields
- [ ] Migration/persistence failure → `read()` returns `null` (load-failed UX)
- [ ] `update()` on a legacy doc: mutator sees the migrated doc; two sequential mutexed writes (migration, then edit)
- [ ] `node.kind` cast to `string | null` at the migration boundary (legacy wire kinds outside canonical RPNodeKind)

---

## Phase 4: Validator + test graph-construction

### Overview

Re-key validation and test graph construction to looped Questions and explicit exit flags, recast loop fixtures, and synchronize validator messages.

### Changes Required:

#### 1. Validator
**File**: `src/graph/graph-validator.ts`
**Changes**: Skip generic dead-end checks for looped Questions, partition explicit exit/body edges, and update cycle exemption.

#### 2. Validator tests
**File**: `src/__tests__/graph-validator.test.ts`
**Changes**: Recast loop invariants, multiple/empty exits, cycle checks, and zero-edge coverage around the merged model.

#### 3. Canvas parser helper
**File**: `src/__tests__/helpers/canvas-parser.ts`
**Changes**: Parse looped Questions and `radiprotocol_isLoopExit`; remove standalone-loop construction.

#### 4. Canvas fixtures
**File**: `src/__tests__/fixtures/unified-loop-*.canvas`
**Changes**: Recast standalone loops and `+` exits to looped Questions and explicit exit flags while preserving fixture topology and geometry.

#### 5. English validator locale
**File**: `src/i18n/locales/en.json`
**Changes**: Reword loop validation messages for the toggle/flag model and remove prefix-specific keys.

#### 6. Russian validator locale
**File**: `src/i18n/locales/ru.json`
**Changes**: Apply the synchronized validator-message changes.

**Implementation detail — validator import and dead-end pass:**
```typescript
import { nodeLabel as sharedNodeLabel } from './node-label';
```
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

**Implementation detail — loop invariants:**
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

**Implementation detail — cycle exemption:**
```typescript
          const passesViaLoopNode = cycleNodes.some(id => {
            const n = graph.nodes.get(id);
            return n?.kind === 'question' && n.loop === true;
          });
```

**Implementation detail — canvas parser helper:**
```typescript
import type {
  RPNode, RPNodeKind, RPEdge, ProtocolGraph, ParseResult,
  StartNode, QuestionNode, AnswerNode, TextBlockNode,
  LoopStartNode, LoopEndNode, SnippetNode,
} from '../../graph/graph-model';
```
```typescript
interface RawCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
  [key: string]: unknown;
}
```
```typescript
    const validKinds: RPNodeKind[] = [
      'start', 'question', 'answer',
      'text-block', 'loop-start', 'loop-end', 'snippet',
    ];
```
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
Delete the helper's standalone `case 'loop'` arm. Copy the edge flag during reconstruction:
```typescript
      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNode,
        toNodeId: rawEdge.toNode,
        label: rawEdge.label,
        isLoopExit: rawEdge['radiprotocol_isLoopExit'] === true ? true : undefined,
      });
```

**Implementation detail — fixture recast:** every `unified-loop-*.canvas` fixture converts `radiprotocol_nodeType: 'loop'` + `radiprotocol_headerText` to a Question with `radiprotocol_questionText` + `radiprotocol_loop: true`; each `+` exit loses the prefix and gains `radiprotocol_isLoopExit: true`; body edges, IDs, geometry, colors, and endpoints remain unchanged. Representative canonical fixture:
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
Repurpose `unified-loop-empty-plus.canvas` as an empty/absent-label explicit exit that validates; repurpose `unified-loop-legacy-vyhod.canvas` as a labeled body with no exit that emits `loopNoExit`. Leave `loop-body.canvas` and `loop-start.canvas` unchanged.

**Implementation detail — validator tests:** recast the existing loop block with these executable cases (legacy loop-start/loop-end migration tests remain unchanged):
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

The removed prefix-specific D-05 and D-08 tests are not retained. The zero-edge executable case is already included above.

**Implementation detail — English `graphValidator`:**
```json
  "graphValidator": {
    "legacyLoopNodes": "Canvas contains deprecated loop-start/loop-end nodes: {ids}. Rebuild the loop as a Question with the Loop toggle enabled, then mark an outgoing edge with “This edge exits the loop”; the remaining outgoing edges form the loop body.",
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
Remove `loopNoExitWithLegacy` and `loopExitNoLabel`.

**Implementation detail — Russian `graphValidator`:**
```json
  "graphValidator": {
    "legacyLoopNodes": "Канвас содержит устаревшие узлы loop-start/loop-end: {ids}. Пересоберите цикл как вопрос с включённым флажком «Цикл», затем пометьте одно исходящее ребро флажком «Эта связь выходит из цикла»; остальные исходящие рёбра образуют тело цикла.",
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
Remove the same two prefix-specific keys.

### Success Criteria:

#### Automated Verification:
- [x] Validator tests pass: `npx vitest run src/__tests__/graph-validator.test.ts`
- [x] No prefix-helper imports in validator: `grep -nE "isLabeledEdge|isExitEdge|stripExitPrefix" src/graph/graph-validator.ts` returns no matches
- [x] No `kind === 'loop'` in validator: `grep -n "kind === 'loop'" src/graph/graph-validator.ts` returns no matches
- [x] Validator loop pass keys on looped questions: `grep -n "node.kind !== 'question' || !node.loop" src/graph/graph-validator.ts` returns a match
- [x] No `LoopNode` import in canvas-parser helper: `grep -n "LoopNode" src/__tests__/helpers/canvas-parser.ts` returns no matches
- [x] No `'loop'` in canvas-parser validKinds: `grep -nE "'loop'," src/__tests__/helpers/canvas-parser.ts` returns no matches
- [x] No `loopNoExitWithLegacy` / `loopExitNoLabel` in either locale: `grep -rn "loopNoExitWithLegacy\|loopExitNoLabel" src/i18n/locales/` returns no matches
- [x] No bare `radiprotocol_nodeType: "loop"` in fixtures: `grep -rnE "radiprotocol_nodeType\":\s*\"loop\"" src/__tests__/fixtures/` returns no matches
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Dead-end check skips looped questions (`node.kind === 'question' && !node.loop`)
- [ ] Loop pass partitions via `edge.isLoopExit === true` (exit) vs `!edge.isLoopExit` (body); no `+`-prefix detection
- [ ] Cycle exemption keys on `n?.kind === 'question' && n.loop === true`
- [ ] en/ru validator messages synchronized (loopNoExit, loopNoBody, unintentionalCycle reworded; loopNoExitWithLegacy + loopExitNoLabel removed from both)
- [ ] Fixtures recast: loop nodes → looped questions; `+`-exit edges → stripped label + radiprotocol_isLoopExit: true
- [ ] 'loop-start'/'loop-end' legacy fixtures + legacyLoopNodes message unchanged

---

## Phase 5: Runner core

### Overview

Move loop entry/re-entry into the Question branch, classify exits structurally, and recast the existing runner regression suites without changing state topology.

### Changes Required:

#### 1. Runner FSM
**File**: `src/runner/protocol-runner.ts`
**Changes**: Branch `case 'question'` on `node.loop`, remove standalone-loop dispatch, and use `edge.isLoopExit` for branch choice and quick exit.

#### 2. Loop picker runner tests
**File**: `src/__tests__/runner/protocol-runner-loop-picker.test.ts`
**Changes**: Recast loop graphs and exit flags; preserve entry, re-entry, quick-exit, nested, serialization, stepBack, and redo coverage.

#### 3. File-bound snippet loop tests
**File**: `src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts`
**Changes**: Replace LoopNode factories with looped Questions and extend test edge tuples with explicit exit flags.

#### 4. Snippet auto-insert loop tests
**File**: `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`
**Changes**: Apply the same looped-Question and four-tuple edge recast.

Delete the `isExitEdge` import and classify exits directly.

**Implementation detail — `chooseLoopBranch`:**
```typescript
    if (edge.isLoopExit === true) {
      // RUN-03: pop frame (top-of-stack, nested-safe). Multiple isLoopExit edges
      // are allowed; the selected edge is the concrete exit branch.
      this.loopContextStack.pop();
    }
```

**Implementation detail — quick exit:**
```typescript
              const exitsToNext = this.graph.edges.some(
                e => e.fromNodeId === topLoop.loopNodeId && e.isLoopExit === true && e.toNodeId === next
              );
```

**Implementation detail — `advanceThrough` Question branch:**
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
Delete the complete standalone `case 'loop'` arm, retain legacy loop-start/loop-end runtime-error arms, and rewrite stale comments mentioning `isExitEdge`, the `+` convention, or standalone-loop dispatch.

**Implementation detail — loop picker runner graph:**
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
Apply the same shape transform to every graph in this suite; remove the `stripExitPrefix` import/test and use `loopOut.find(e => e.isLoopExit === true)` / `loopOut.find(e => !e.isLoopExit)` in regression guards.

**Implementation detail — redo round trip:**
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

**Implementation detail — shared test graph builders in both snippet suites:**
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
In the file-bound suite, replace each `['n-loop', 'n-end', '+exit']` with `['n-loop', 'n-end', 'exit', true]`. In the snippet auto-insert suite, replace `['loop', 'end', '+выход']` with `['loop', 'end', 'выход', true]`. Replace all `makeLoop` calls/imports with `makeLoopedQuestion`; loop-context ID assertions remain unchanged.

### Success Criteria:

#### Automated Verification:
- [x] Runner loop test suites pass: `npx vitest run src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`
- [x] No `isExitEdge` in runner: `grep -n "isExitEdge" src/runner/protocol-runner.ts` returns no matches
- [x] No `case 'loop'` arm: `grep -nE "case 'loop':" src/runner/protocol-runner.ts` returns no matches (only loop-start/loop-end)
- [x] `node.loop === true` present: `grep -n "node.loop === true" src/runner/protocol-runner.ts` returns a match
- [x] No `LoopNode`/`headerText`/`stripExitPrefix` in the three test files: `grep -rnE "LoopNode|headerText|stripExitPrefix" src/__tests__/runner/protocol-runner-loop-picker.test.ts src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns no matches
- [x] No `'+` prefix literals in the two snippet tests: `grep -rnE "'\+" src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns no matches
- [x] Exit tuples carry the 4th element: `grep -nE "'exit', true|'выход', true" src/__tests__/runner/protocol-runner-loop-body-file-bound-snippet.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts` returns matches
- [x] redo round-trip test present: `grep -n "runner.redo()" src/__tests__/runner/protocol-runner-loop-picker.test.ts` returns a match
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Looped question halts at AWAITING_LOOP_PICK (first entry pushes frame; B1 re-entry increments iteration); ordinary question halts at AT_NODE
- [ ] chooseLoopBranch pops frame only on edge.isLoopExit === true; quick-exit pops frame when body answer wired to an isLoopExit target
- [ ] stepBack restores AWAITING_LOOP_PICK; redo restores the loop stack (round-trip test)
- [ ] Nested-loop stack discipline preserved; no stale isExitEdge/`+`-prefix/case 'loop' comments in the runner

---

## Phase 6: Render loop picker

### Overview

Render the existing loop picker for looped Questions, using `questionText` and structural exit metadata while rejecting ordinary Questions.

### Changes Required:

#### 1. Picker renderer
**File**: `src/runner/render/render-loop-picker.ts`
**Changes**: Guard on Question + loop, render `questionText`, classify `isLoopExit`, and use verbatim exit labels.

#### 2. Picker render tests
**File**: `src/__tests__/runner/render-loop-picker.test.ts`
**Changes**: Recast graph helpers, edge flags, captions, error text, and ordinary-Question rejection coverage.

#### 3. Question render tests
**File**: `src/__tests__/runner/render-question.test.ts`
**Changes**: Remove obsolete LoopNode/headerText helper construction.

**Implementation detail — imports and guard:**
```typescript
import { nodeLabel } from '../../graph/node-label';
```
```typescript
  const node = graph.nodes.get(state.nodeId);
  if (node === undefined || node.kind !== 'question' || !node.loop) {
    host.renderError([`Looped question "${state.nodeId}" not found in graph.`]);
    return false;
  }
```

**Implementation detail — header:**
```typescript
  // Render the question text above the picker when non-empty.
  if (node.questionText !== '') {
    textZone.createEl('p', {
      text: node.questionText,
      cls: 'rp-loop-header-text',
    });
  }
```

**Implementation detail — buttons and captions:**
```typescript
  for (const edge of outgoing) {
    const exit = edge.isLoopExit === true;
    const target = graph.nodes.get(edge.toNodeId);
    const targetCaption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
    const accessibleTargetCaption = targetCaption.trim() !== '' ? targetCaption : edge.toNodeId;
    const caption = exit ? edge.label ?? '' : targetCaption;
    const btn = createButton(list, {
      cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
      text: caption,
      attr: caption === '' ? { 'aria-label': accessibleTargetCaption } : undefined,
    });
    host.bindClick(btn, () => {
      void host.onChooseLoopBranch(edge, exit);
    });
  }
```
The outgoing-edge filter and picker-list container remain unchanged; delete prefix-helper imports and rewrite stale `headerText`/prefix comments.

**Implementation detail — render tests:** recast the graph helper's `loop` node to `node('loop', 'question', { questionText: 'Repeat?', loop: true })`; use `{ label: 'finish', isLoopExit: true }` for the exit edge; assert `Repeat?`, `finish`, and callback booleans `(bodyEdge, false)` / `(exitEdge, true)`. Add an unlabeled-exit case asserting empty visible text but `aria-label` equal to the target's `nodeLabel` (falling back to target ID). Change missing-node errors to `Looped question "…" not found in graph.` Remove obsolete LoopNode/headerText spreads from both render test helpers.

Add the ordinary-Question negative control:
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

### Success Criteria:

#### Automated Verification:
- [x] Render test suites pass: `npx vitest run src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts`
- [x] No prefix-helper imports: `grep -nE "isExitEdge|stripExitPrefix" src/runner/render/render-loop-picker.ts` returns no matches
- [x] Looped-question guard: `grep -n "node.kind !== 'question' || !node.loop" src/runner/render/render-loop-picker.ts` returns a match
- [x] `questionText` header: `grep -n "node.questionText" src/runner/render/render-loop-picker.ts` returns a match
- [x] No `headerText` in render tests: `grep -n "headerText" src/__tests__/runner/render-loop-picker.test.ts src/__tests__/runner/render-question.test.ts` returns no matches
- [x] Ordinary-question rejection test present: `grep -n "no loop toggle" src/__tests__/runner/render-loop-picker.test.ts` returns a match
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Guard accepts a looped question and rejects an ordinary question / missing node
- [ ] Header renders `questionText`; exit buttons carry `rp-loop-exit-btn` + verbatim `edge.label`; body buttons carry `rp-loop-body-btn` + `nodeLabel(target)`
- [ ] `onChooseLoopBranch(edge, exit)` receives `exit = edge.isLoopExit === true`; no `stripExitPrefix` logic remains
- [ ] An exit edge with an empty caption retains empty visible text but receives a target-derived `aria-label`

---

## Phase 7: Editor

### Overview

Replace standalone Loop authoring with a Question toggle and badge, and persist exit state independently from edge labels while preserving prior save/reload fixes.

### Changes Required:

#### 1. Protocol editor
**File**: `src/views/protocol-editor-view.ts`
**Changes**: Remove Loop creation/default paths, add loop toggle and badge, rebind edge checkbox/save policy to `isLoopExit`, and delete prefix helpers.

#### 2. Editor styles
**File**: `src/styles/protocol-editor.css`
**Changes**: Remove standalone-loop choice/minimap styles and add loop-badge styling.

#### 3. Loop support styles
**File**: `src/styles/loop-support.css`
**Changes**: Keep picker styles and update stale prefix-convention commentary.

#### 4. Editor helper tests
**File**: `src/__tests__/protocol-editor-helpers.test.ts`
**Changes**: Recast label normalization/display policy and editable-kind assertions around looped Questions and explicit flags.

#### 5. Editor keyboard tests
**File**: `src/__tests__/views/protocol-editor-keyboard.test.ts`
**Changes**: Synchronize i18n mocks, editable-kind ordering, and loop-toggle authoring coverage.

#### 6. English editor locale
**File**: `src/i18n/locales/en.json`
**Changes**: Add loop toggle/badge strings and remove standalone-Loop editor labels.

#### 7. Russian editor locale
**File**: `src/i18n/locales/ru.json`
**Changes**: Apply synchronized editor locale changes.

**Implementation detail — editor kinds/defaults:**
```typescript
const NODE_KIND_DEFAULTS: Record<string, NodeKindDefault> = {
  start: { kind: 'start', fields: {}, color: 'rgba(76, 175, 80, 0.28)' },
  question: { kind: 'question', fields: { questionText: '' }, color: 'rgba(33, 150, 243, 0.24)' },
  answer: { kind: 'answer', fields: { answerText: '' }, color: 'rgba(255, 193, 7, 0.28)' },
  'text-block': { kind: 'text-block', fields: { content: '' }, color: 'rgba(255, 235, 59, 0.24)' },
  snippet: { kind: 'snippet', fields: {}, color: 'rgba(156, 39, 176, 0.24)' },
};
```
```typescript
const EDITABLE_NODE_KINDS: RPNodeKind[] = ['start', 'question', 'answer', 'snippet'];
```

**Implementation detail — label helpers:**
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

**Implementation detail — label display policy:**
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

**Implementation detail — canvas badge before the resize handle:**
```typescript
    if (node.kind === 'question' && node.fields['loop'] === true) {
      const badge = nodeEl.createDiv({ cls: 'rp-protocol-editor-node-loop-badge' });
      setIcon(badge, 'repeat');
      badge.setAttr('aria-label', this.plugin.i18n.t('protocolEditor.loopBadgeAriaLabel'));
    }
```

**Implementation detail — Question edit toggle:**
```typescript
    const addLoopToggle = (nodeRecord: ProtocolNodeRecord) => {
      const field = body.createDiv({ cls: 'rp-protocol-editor-modal-field rp-protocol-editor-checkbox-field' });
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
Delete `case 'loop'` and remove the `titleKind === 'loop' ? 'headerText'` title-key branch.

**Implementation detail — edge checkbox:**
```typescript
    exitCheckbox.checked = edge.isLoopExit === true;
    const syncExitVisibility = () => {
      const fromNode = nodes.find((node) => node.id === fromSelect.value);
      const isLoopSource = fromNode?.kind === 'question' && fromNode.fields['loop'] === true;
      exitField.style.display = isLoopSource ? '' : 'none';
      if (!isLoopSource) exitCheckbox.checked = false;
    };
```

**Implementation detail — edge save:**
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

**Implementation detail — editor CSS:** remove `.rp-protocol-editor-node-kind-choice[data-node-kind="loop"]` and `.rp-protocol-editor-minimap-node-loop`; add:
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
Keep all loop-picker classes in `loop-support.css`, changing only the comment:
```css
/* Exit button — marks an isLoopExit edge (the former +-prefix convention was
   replaced by the explicit edge.isLoopExit flag). */
```

**Implementation detail — helper and keyboard tests:** remove `isProtocolEditorLoopExitLabel` imports/assertions; represent loop sources as Questions with `fields: { loop: true }`; assert normalization only trims; carry `isLoopExit: true` separately in display-policy tests across question/answer/text-block targets; remove `nodeKindToken('loop')` and Loop entries in editable arrays. In keyboard tests, add `protocolEditor.loopToggleLabel` and `protocolEditor.loopBadgeAriaLabel` mocks, remove `headerTextLabel`, update editable order to `['start', 'question', 'answer', 'snippet']`, and recast creation coverage through the Question toggle.

**Implementation detail — English editor locale additions/removals:**
```json
    "loopToggleLabel": "Loop",
    "loopBadgeAriaLabel": "Loop question",
```
Delete `headerTextLabel`, `nodeKind.loop`, and `defaultNodeText.loop`; keep `loopExitLabel`.

**Implementation detail — Russian editor locale additions/removals:**
```json
    "loopToggleLabel": "Цикл",
    "loopBadgeAriaLabel": "Циклический вопрос",
```
Delete the synchronized standalone-Loop keys and keep `loopExitLabel`.

### Success Criteria:

#### Automated Verification:
- [x] Editor helper + keyboard tests pass: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] No `isProtocolEditorLoopExitLabel` in editor: `grep -n "isProtocolEditorLoopExitLabel" src/views/protocol-editor-view.ts` returns no matches
- [x] No `case 'loop':` arm in openEditModal: `grep -nE "case 'loop':" src/views/protocol-editor-view.ts` returns no matches (only loop-start/loop-end)
- [x] Loop toggle + badge present: `grep -n "addLoopToggle\|loop-badge" src/views/protocol-editor-view.ts` returns matches
- [x] No `nodeKindToken('loop')` in helper test: `grep -n "nodeKindToken('loop')" src/__tests__/protocol-editor-helpers.test.ts` returns no matches
- [x] No `'loop'` in helper-test editable-kinds arrays: `grep -nE "'loop'" src/__tests__/protocol-editor-helpers.test.ts` returns no matches
- [x] No stale `+-prefix exit` comment in loop-support.css: `grep -ni "+-prefix exit" src/styles/loop-support.css` returns no matches
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Loop removed from the creation grid; looped questions via Question edit-modal toggle; canvas badge on looped questions
- [ ] Edge-modal exit checkbox shown only for a looped-question source; state from `edge.isLoopExit`; saved as `isLoopExit` on the edge record (no `+` prefix)
- [ ] `shouldDisplayProtocolEditorEdgeLabel` preserves a looped-question exit label regardless of target kind (50a7fcb fix — covered by the helper-level display-policy test)
- [ ] Edge save still assigns `this.doc = updated` + reloads via `loadProtocol()` (0ff2587/f5850c0 fixes)
- [ ] en/ru synchronized: loopToggleLabel + loopBadgeAriaLabel added; headerTextLabel + nodeKind.loop + defaultNodeText.loop removed
- [ ] `nodeKindToken('loop')` assertion + `'loop'` in editable-kinds arrays removed from the helper test

---

## Phase 8: Node picker + i18n cleanup

### Overview

Remove standalone Loop from all startable-node picker surfaces while ensuring looped Questions remain ordinary Question options and locale keys stay synchronized.

### Changes Required:

#### 1. Node picker
**File**: `src/views/node-picker-modal.ts`
**Changes**: Remove Loop type/import/labels/order/branches and the `headerText` fallback.

#### 2. Node picker tests
**File**: `src/__tests__/node-picker-modal.test.ts`
**Changes**: Recast startable options, sort order, fallback, and legacy exclusions without a standalone Loop kind.

#### 3. Runner command tests
**File**: `src/__tests__/runner-commands.test.ts`
**Changes**: Assert a looped Question appears as a Question option rather than a Loop option.

#### 4. English picker locale
**File**: `src/i18n/locales/en.json`
**Changes**: Remove `nodePicker.loop`.

#### 5. Russian picker locale
**File**: `src/i18n/locales/ru.json`
**Changes**: Remove `nodePicker.loop` synchronously.

**Implementation detail — node-picker import and startable type:**
```typescript
import type { ProtocolGraph, QuestionNode, TextBlockNode, SnippetNode, RPNodeKind } from '../graph/graph-model';
```
```typescript
type StartableNodeKind = Extract<RPNodeKind, 'start' | 'question' | 'answer' | 'text-block' | 'snippet'>;
```

**Implementation detail — labels and ordering:**
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
Delete the standalone-loop branch from `buildNodeOptions`; looped Questions already use the Question branch. Remove `stringField(node, 'headerText')` from `buildStartableProtocolNodeOptions`. Rewrite comments to describe Question → text-block → snippet ordering and inclusion while retaining loop-start/loop-end legacy exclusions.

**Implementation detail — tests:** remove `LoopNode` and the `loop()` factory; use a looped Question in the four-option graph test; update kind sets, lengths, fallback assertions, group ordering, legacy exclusions, and `KIND_LABELS` key expectations to the five remaining startable kinds. In `runner-commands.test.ts`, recast the loop option as `kind: 'question', loop: true` and assert it is returned as a Question.

**Implementation detail — English picker block:**
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

**Implementation detail — Russian picker block:**
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
Delete `nodePicker.loop` from both locales.

### Success Criteria:

#### Automated Verification:
- [x] Node-picker + runner-commands tests pass: `npx vitest run src/__tests__/node-picker-modal.test.ts src/__tests__/runner-commands.test.ts`
- [x] No `LoopNode` import in node-picker: `grep -n "LoopNode" src/views/node-picker-modal.ts` returns no matches
- [x] No `'loop'` in StartableNodeKind/KIND_LABELS/KIND_ORDER: `grep -nE "'loop'" src/views/node-picker-modal.ts` returns no matches
- [x] No `headerText` in node-picker: `grep -n "headerText" src/views/node-picker-modal.ts` returns no matches
- [x] No stale standalone-loop JSDoc: `grep -niE "loop node|→ loop" src/views/node-picker-modal.ts` returns no matches (loop-start/loop-end legacy refs allowed)
- [x] No `nodePicker.loop` in locales: `grep -rn "loop" src/i18n/locales/en.json src/i18n/locales/ru.json` — no `nodePicker.loop` entry remains
- [x] No `LoopNode`/`headerText` in node-picker test: `grep -nE "LoopNode|headerText" src/__tests__/node-picker-modal.test.ts` returns no matches
- [x] Repo-wide `npm run check` deferred to Slice 9

#### Manual Verification:
- [ ] Looped questions appear as `question` options; standalone Loop option removed
- [ ] KIND_LABELS / KIND_LABEL_KEYS / KIND_ORDER exhaustive over the 5 remaining startable kinds
- [ ] buildStartableProtocolNodeOptions fallback chain no longer includes headerText
- [ ] 'loop-start'/'loop-end' still excluded; no stale standalone-loop JSDoc remains
- [ ] en/ru `nodePicker.loop` removed from both locales

---

## Phase 9: Cross-cutting tests + grep audit

### Overview

Recast remaining inline-runner tests, clean runner-state documentation, and certify the complete removal with the project gate and exhaustive source audit.

### Changes Required:

#### 1. Output-toolbar test
**File**: `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`
**Changes**: Replace fake Loop nodes with looped fake Questions while preserving toolbar-state assertions.

#### 2. File-bound loop view test
**File**: `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`
**Changes**: Recast LoopNode factory and edge tuples to looped Questions and explicit exit flags.

#### 3. Runner state comments
**File**: `src/runner/runner-state.ts`
**Changes**: Replace standalone-loop/headerText terminology with looped-Question/questionText wording; no state shape changes.

**Implementation detail — output-toolbar fake graph:**
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
Keep the `awaiting-loop-pick` case and all toolbar-absence assertions unchanged.

**Implementation detail — file-bound view graph:**
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
Replace both `['n-loop', 'n-end', '+exit']` tuples with `['n-loop', 'n-end', 'exit', true]`, use `makeLoopedQuestion`, and retain the single `rp-loop-body-btn` assertion.

**Implementation detail — runner-state comments:** make only these terminology changes; do not alter state fields:
- `AwaitingLoopPickState`: "runner paused at a looped question, presenting a picker".
- `nodeId`: "looped question id — host looks up questionText from graph".
- `ErrorState`: describe only real terminal cases: "unknown node, iteration cap exceeded, or unexpected legacy loop-start/loop-end node"; do not describe supported looped Questions as errors.

### Success Criteria:

#### Automated Verification:
- [x] The two cross-cutting view tests pass: `npx vitest run src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`
- [x] No `FakeLoopNode`/`kind: 'loop'`/`'+exit'` in either view test: `grep -rnE "FakeLoopNode|kind: 'loop'|'\+exit'" src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` returns no matches
- [x] 4-tuple builder + isLoopExit present in the loop-body test: `grep -n "isLoopExit" src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` returns matches
- [x] `runner-state.ts` has no `headerText` / "loop node" / "unified loop node" reference: `grep -nE "headerText|loop node|unified loop node" src/runner/runner-state.ts` returns no matches
- [x] **Exhaustive sweep audit (load-bearing)** across `src/`:
  - FORBIDDEN (no matches): `grep -rn "isExitEdge\|isLabeledEdge\|stripExitPrefix" src/`; `grep -rn "FakeLoopNode" src/`
  - `grep -rnE "case 'loop':" src/` — any match must be `case 'loop-start':` or `case 'loop-end':` only
  - `grep -rn "kind === 'loop'" src/` returns only `src/protocol/protocol-document-migration.ts` (the legacy discriminator)
  - `grep -rn "\bLoopNode\b" src/` returns only historical JSDoc in `src/graph/graph-model.ts` (no type imports/constructions/FakeLoopNode; `legacyLoopNodes` excluded by word boundary)
  - `grep -rn "headerText" src/` returns only: the migration module, migration tests, the parser legacy-`'loop'`-rejection fixture, and historical JSDoc in `graph-model.ts` — no canonical runtime `headerText` read/write
  - `'loop-start'`/`'loop-end'` legacy literals + `loop-start.canvas`/`loop-body.canvas` fixtures + test node IDs named `'loop'` are INTENTIONAL and allowed
- [x] **Project baseline**: `npm run check` passes (build + lint + tests + planning + consistency + agent-docs)

#### Manual Verification:
- [ ] output-toolbar `awaiting-loop-pick` case renders against a looped-question graph; toolbar-absence assertions unchanged
- [ ] loop-body-file-bound test: looped question + 4-tuple isLoopExit exit; single `rp-loop-body-btn` assertion holds
- [ ] `runner-state.ts` JSDoc references "looped question" / "questionText" (no "loop node" / "headerText")
- [ ] The grep audit certifies no stale standalone-loop / prefix-helper / canonical-headerText references survive outside the intentional migration/rejection/historical-JSDoc boundary

## Testing Strategy

### Automated:
- Run each phase's focused Vitest command and grep assertions before advancing.
- Run the final exhaustive source sweep in Phase 9.
- Run `npm run check` after all source, test, fixture, locale, CSS, planning, and guidance changes are integrated.

### Manual Testing Steps:
1. Open a legacy `.rp.json` containing a standalone Loop and verify it is rewritten once to a looped Question with clean exit labels and `isLoopExit: true`; reopen and verify no second write.
2. Create a Question, enable the Loop toggle, confirm the badge appears, and mark an outgoing edge as a loop exit without modifying its label.
3. Save and reopen exit edges targeting question, answer, and text-block nodes; verify exit captions and flags remain intact.
4. Run ordinary and looped Questions; verify picker rendering, body re-entry, user-driven exit, quick exit, nested loops, flat output, stepBack, and redo.
5. Validate zero-edge, no-exit, no-body, ordinary-cycle, and looped-cycle graphs and confirm only the intended messages appear.
6. Confirm looped Questions appear as Question options and no standalone Loop option remains in creation or start-node pickers.

## Performance Considerations

- The migration discriminator scans `doc.nodes` for `kind === 'loop'` on every `read()` — O(n) where n is the node count, additive to the existing full-document parse. No caching concern; `read()` already parses the whole document.
- The extra disk write occurs only on the first `read()` of a legacy document (idempotent thereafter). No N+1 risk; the transform is a single in-memory pass over nodes + edges.
- `update()` on a legacy document performs two sequential mutexed writes (migration, then edit). This is a one-time cost per legacy document; subsequent updates perform a single write. The `WriteMutex` is non-reentrant but `update()` does not hold it during `read()`, so there is no deadlock.

## Migration Notes

- Existing `.rp.json` documents with `kind: 'loop'` nodes and `+`-prefixed exit edges auto-migrate on first open; protocol version remains 1.
- The discriminator is exact legacy `kind === 'loop'`. Only outgoing `+`-prefixed edges of captured legacy loop IDs are reclassified.
- Layered spreads preserve metadata, node/edge identity and geometry, viewport/layout/self-check state, and unknown extension fields; only `updatedAt` is bumped.
- Migration is forward-only and overwrites the legacy file in place; repository history is the recovery path.
- Legacy `'loop'` is no longer parser-compatible; `ProtocolDocumentStore.read()` is the sole bridge. `'loop-start'` and `'loop-end'` remain parseable and validator-rejected.
- Historically partial documents without any legacy Loop nodes are not auto-healed; `+` labels remain ordinary text.

## Plan Review (Step 4)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 5._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Phase 3 §2 (`protocol-document-store.ts`) | `src/views/inline-runner-modal.ts:146` | blocker | actionability | The normal inline-run command reads the file directly through `app.vault.read()` and never calls `ProtocolDocumentStore.read()`, so a legacy `kind: 'loop'` document selected for direct execution bypasses migration and is rejected by the Phase 2 parser. | Add a Phase 3 subsection that invokes `protocolDocumentStore.read()` before the inline runner's raw read and tests direct inline opening of a legacy document. | applied (plan-local; design follow-up: added inline-runner migration preflight, integration test, and Phase 3 verification; update the parent design) |
| code | Phase 3 §1 (`protocol-document-migration.ts`) | `src/protocol/protocol-document-parser.ts:235` | concern | code-quality | The migration reads only `fields.headerText`, although the current parser accepts legacy `radiprotocol_headerText`, so accepted legacy documents using that key migrate with an empty `questionText`. | Fall back to `fields.radiprotocol_headerText` when `fields.headerText` is not a string and add a migration test. | applied (plan-local; design follow-up: added fallback/removal logic, regression test, and verification) |
| code | Phase 4 §5 (`en.json`) | `src/i18n/locales/en.json:287` | concern | code-quality | The retained `legacyLoopNodes` message instructs users to rebuild with a “unified loop node” and an exit label even though standalone Loop authoring and label-based exit semantics are removed. | Reword the message to instruct users to enable the Question loop toggle and mark an edge with the loop-exit checkbox. | applied (plan-local; design follow-up: reworded English legacy migration guidance) |
| code | Phase 4 §6 (`ru.json`) | `src/i18n/locales/ru.json:287` | concern | code-quality | The retained Russian `legacyLoopNodes` message still instructs users to create a `loop` node and use an «выход» label, which no longer produces canonical loop behavior. | Reword the Russian message to describe a looped Question and the explicit edge-exit checkbox. | applied (plan-local; design follow-up: synchronized Russian legacy migration guidance with English) |
| code | Phase 6 §1 (`render-loop-picker.ts`) | `src/utils/dom-helpers.ts:11` | concern | code-quality | An allowed unlabeled `isLoopExit` edge produces a button with `text: ''` and no `aria-label`, leaving the exit control without an accessible name. | Supply an `aria-label` derived from the target node label or target ID when the exit caption is empty. | applied (plan-local; design follow-up: added target-derived aria-label logic, test instruction, and manual verification) |
| code | Phase 7 §1 (`protocol-editor-view.ts`) | `src/styles/protocol-editor.css:407` | concern | codebase-fit | The proposed loop toggle uses `rp-protocol-editor-modal-checkbox-field`, but checkbox layout styles target `rp-protocol-editor-checkbox-field`, so the new checkbox receives the generic full-width input styling. | Use the existing `rp-protocol-editor-checkbox-field` class on the loop-toggle field. | applied (plan-local; design follow-up: switched the emitted toggle code to the existing checkbox class) |
| code | Phase 9 §3 (`runner-state.ts`) | `src/runner/runner-state.ts:99` | suggestion | code-quality | Replacing the stale error-state text with “looped question reached in Phase 2” remains inaccurate because Phase 5 makes looped Questions a supported runtime path rather than an error condition. | Remove that clause or describe only unexpected legacy `loop-start`/`loop-end` nodes. | applied (plan-local; design follow-up: limited ErrorState JSDoc to real terminal cases and unexpected legacy nodes) |

## Developer Context

## References

- Design: `.rpiv/artifacts/designs/2026-07-28_09-09-24_merge-loop-into-question.md`
- Research: `.rpiv/artifacts/research/2026-07-28_08-52-15_merge-loop-into-question.md`
- FRD: `.rpiv/artifacts/discover/2026-07-28_08-28-48_merge-loop-into-question.md`
- Prior related research: `.rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md`
- Precedent commits: `8185dbb`, `1dadc67`, `6229b6d`, `50a7fcb`, `f5850c0`, `0ff2587`, `478af29`
