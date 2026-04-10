# Phase 1: Project Scaffold and Canvas Parsing Foundation - Research

**Researched:** 2026-04-05
**Domain:** Obsidian community plugin scaffold (TypeScript + esbuild), JSON Canvas parsing, graph validation, Vitest
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Dev vault path configured via a `.env` file (`.gitignored`) with `OBSIDIAN_DEV_VAULT_PATH=...`. `esbuild.config.mjs` reads this at build time using `dotenv` or manual `fs.readFileSync`. Each developer sets their own path; no vault path is committed to the repo.

**D-02:** `npm run dev` script builds with esbuild in watch mode and automatically copies `main.js` and `manifest.json` to `${OBSIDIAN_DEV_VAULT_PATH}/.obsidian/plugins/radiprotocol/` on each rebuild.

**D-03:** Canvas fixtures are committed as real `.canvas` JSON files in `src/__tests__/fixtures/` (e.g., `linear.canvas`, `branching.canvas`, `dead-end.canvas`, `cycle.canvas`). Vitest reads them with `fs.readFileSync`. This covers all six `GraphValidator` error classes plus valid protocol shapes.

**D-04:** Fixtures are minimal — 3–5 nodes each, with synthetic labels (`Q1`, `A1`, `Start`, etc.). No realistic radiology content in fixtures; that complexity belongs in the manual dev vault.

**D-05:** Scaffold the full `src/` directory structure upfront, matching ARCHITECTURE.md, with placeholder stub files for all 7-phase modules. Stub files export empty classes/interfaces so TypeScript compiles without errors from day one. Phases 2–7 fill in the stubs; Phase 1 implements only `src/graph/`.

**D-06:** Full structure: `src/main.ts`, `src/settings.ts`, `src/graph/` (canvas-parser, graph-model, graph-validator), `src/runner/` (stubs), `src/snippets/` (stubs), `src/sessions/` (stubs), `src/views/` (stubs), `src/utils/` (write-mutex, vault-utils).

**D-07:** `noUncheckedIndexedAccess` remains enabled (official scaffold default). Array index access and Map lookups return `T | undefined` — all callers must null-check. This is the correct approach for graph lookups where a node ID might be missing.

### Claude's Discretion

- Exact `dotenv` vs. manual `.env` parsing in `esbuild.config.mjs`
- Stub file content (empty class vs. `// TODO: Phase N` comment)
- ESLint flat config structure (the scaffold already provides a template)
- `manifest.json` and `versions.json` initial content (follow official scaffold defaults)
- `minAppVersion` value: use `"1.5.7"` per NFR-03

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARSE-01 | Parse any `.canvas` JSON file into a typed `ProtocolGraph` using `vault.read()` — never `require('fs')` | Canvas JSON format verified; `CanvasData` TypeScript types in `obsidian/canvas`; graph model design in ARCHITECTURE.md §2 |
| PARSE-02 | Recognise all 7 node kinds from `radiprotocol_nodeType` custom properties | Discriminated union model verified in ARCHITECTURE.md; JSON Canvas spec allows arbitrary extra keys |
| PARSE-03 | Silently skip plain canvas nodes lacking `radiprotocol_nodeType` | Parser `parseNode()` returns `null` for non-RP nodes; confirmed in ARCHITECTURE.md §2 |
| PARSE-04 | Store all RadiProtocol metadata using `radiprotocol_`-namespaced properties only | Namespace strategy verified in PITFALLS.md and ARCHITECTURE.md |
| PARSE-05 | Parse canvas file once at session start; build in-memory; never modify during session | Read-only architecture constraint established in PITFALLS.md and STACK.md |
| PARSE-06 | `CanvasParser` is a pure module with zero Obsidian API imports | Pure module pattern verified in ARCHITECTURE.md §1; enables Vitest testing without mocks |
| PARSE-07 | `GraphValidator` checks: exactly one start, reachability, unintentional cycles (3-color DFS), dead-ends, loop pairing, snippet references | Validation table in ARCHITECTURE.md §2; graph algorithm patterns in PITFALLS.md |
| PARSE-08 | All six validation errors reported in plain English before session opens | Error message strings are implementation detail; error classes are defined; no code exceptions |
| DEV-01 | Hot-reload: `npm run dev` builds with esbuild watch and copies to dev vault | esbuild watch + env-var copy pattern in STACK.md §5; dotenv v17.4.0 verified |
| DEV-02 | `eslint-plugin-obsidianmd` (all 27 rules) from first commit | All 27 rules listed and verified in STACK.md §7; v0.1.9 confirmed on npm |
| DEV-03 | Additional ESLint rules: `no-console`, `no-explicit-any`, `no-floating-promises`, `no-restricted-syntax` for innerHTML/outerHTML | Full ESLint config in STACK.md §7; rules and selectors verified |
| DEV-04 | Vitest configured for `src/graph/` (pure-logic directory), zero Obsidian API imports | Vitest config in STACK.md §4; vitest v4.1.2 verified on npm |
| DEV-05 | Test vault with representative `.canvas` files: linear, branching, dead-end, cycle | D-03/D-04 decisions specify fixture strategy; 4 fixture files cover all 6 error classes |
| NFR-01 | `graph/`, `runner/`, `snippets/`, `sessions/` have zero Obsidian API imports | Pure module isolation pattern from STACK.md §4; enforced by test runner failing if imports present |
| NFR-02 | `main.js` bundle stays within community plugin norms; no React | Plain DOM + Obsidian helpers confirmed for v1; no React |
| NFR-03 | `minAppVersion` set to `"1.5.7"` | Verified: `onExternalSettingsChange()` added in 1.5.7 per PITFALLS.md |
| NFR-04 | Plugin passes `eslint-plugin-obsidianmd` lint with zero warnings | Zero-warning policy from first commit; enforced via `npm run lint` |
| NFR-05 | All UI text uses sentence case | `ui/sentence-case` rule in `eslint-plugin-obsidianmd`; auto-fix available |
| NFR-06 | All command IDs omit plugin name prefix | `no-plugin-id-in-command-id` rule enforced by ESLint plugin |
| NFR-07 | No `require('fs')`, `require('path')`, or Node.js built-in imports | `no-restricted-syntax` or manual ESLint rule; use Obsidian Vault API exclusively |
| NFR-08 | Settings loaded with defaults guard: `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` | Pattern verified in PITFALLS.md and STACK.md §3 |
| NFR-09 | All async operations awaited or marked `void` | `@typescript-eslint/no-floating-promises` enforced via ESLint |
| NFR-10 | Repository includes `LICENSE` file (MIT); GitHub Issues enabled | Constraint from PITFALLS.md community submission section |
| NFR-11 | Plugin handles UTF-8 medical text correctly | Vault API handles UTF-8 natively; no Node.js `fs` bypass |

</phase_requirements>

---

## Summary

Phase 1 establishes the complete foundation: a working Obsidian plugin scaffold that compiles, installs, and loads — plus a fully-tested pure-logic graph engine (`CanvasParser` + `GraphValidator`) before any UI work begins. The phase splits cleanly into three parallel concerns: (1) the dev toolchain and project scaffold, (2) the graph model and canvas parser implementation, and (3) the Vitest infrastructure and test fixture authoring.

The official `obsidian-sample-plugin` scaffold is the single correct starting point. Its `package.json`, `tsconfig.json`, and `esbuild.config.mjs` are verified and should be used verbatim with targeted additions: a `.env`-based dev vault copy in `esbuild.config.mjs`, and `vitest` added to `devDependencies`. All required ESLint rules are already present in the current scaffold template or can be layered on top of `eslint-plugin-obsidianmd`.

The critical design constraint is that `CanvasParser` and `GraphValidator` are pure TypeScript modules with zero Obsidian API imports. They receive a JSON string and return typed data structures. This design makes them trivially testable with Vitest and completely independent of the Obsidian runtime. The canvas JSON format (JSON Canvas v1.0) needs no external parsing library — `JSON.parse` plus TypeScript interfaces is the complete approach.

**Primary recommendation:** Use the official scaffold verbatim, add `vitest` + `dotenv`, implement only `src/graph/` in Phase 1, stub everything else with empty-export files, and commit with ESLint green from the very first commit.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | 1.12.3 | Plugin runtime API types and helpers | Mandatory for any Obsidian plugin |
| esbuild | 0.28.0 | Bundler with watch mode | Official scaffold standard; fast, simple |
| typescript | 6.0.2 | Type checking and compilation | Official scaffold; required by Obsidian plugin template |
| vitest | 4.1.2 | Unit testing for pure engine modules | ESM-native, no mock needed for pure modules, simple config |
| eslint-plugin-obsidianmd | 0.1.9 | 27 Obsidian-specific lint rules | Required by DEV-02; in official scaffold template |
| typescript-eslint | 8.58.0 | TypeScript-aware ESLint rules | In official scaffold template |
| @eslint/js | 10.0.1 | ESLint recommended config | In official scaffold template |
| globals | 17.4.0 | Browser/Node global definitions for ESLint | In official scaffold template |
| jiti | 2.6.1 | Runtime TypeScript for ESLint config | In official scaffold template |

[VERIFIED: npm registry 2026-04-05]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.4.0 | Load `OBSIDIAN_DEV_VAULT_PATH` from `.env` in esbuild.config.mjs | Dev toolchain only; not bundled into plugin |

[VERIFIED: npm registry 2026-04-05]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | Jest requires ESM transform setup (`--experimental-vm-modules`); Vitest is natively ESM-compatible. Vitest wins for this stack. |
| dotenv | Manual `fs.readFileSync('.env')` parsing | Both work; dotenv is 1 dependency but avoids rolling a parser. Claude's discretion. |

**Installation:**
```bash
# Install official scaffold dependencies (from package.json)
npm install

# Add vitest and dotenv (not in scaffold by default)
npm install --save-dev vitest dotenv
```

**Version verification (confirmed 2026-04-05):**
```
obsidian:               1.12.3
esbuild:                0.28.0
typescript:             6.0.2
vitest:                 4.1.2
eslint-plugin-obsidianmd: 0.1.9
typescript-eslint:      8.58.0
@eslint/js:             10.0.1
globals:                17.4.0
jiti:                   2.6.1
dotenv:                 17.4.0
```

[VERIFIED: npm registry 2026-04-05]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main.ts                     # RadiProtocolPlugin — onload, onunload, command registration
├── settings.ts                 # RadiProtocolSettings interface, DEFAULT_SETTINGS, SettingsTab stub
│
├── graph/                      # IMPLEMENTED IN PHASE 1 — pure modules, no Obsidian imports
│   ├── canvas-parser.ts        # CanvasParser.parse(jsonString, filePath) → ProtocolGraph
│   ├── graph-model.ts          # All TypeScript types: ProtocolGraph, RPNode union, RPEdge
│   └── graph-validator.ts      # GraphValidator.validate(graph) → ValidationResult
│
├── runner/                     # STUB — Phase 2
│   ├── protocol-runner.ts
│   ├── runner-state.ts
│   └── text-accumulator.ts
│
├── snippets/                   # STUB — Phase 5
│   ├── snippet-service.ts
│   └── snippet-model.ts
│
├── sessions/                   # STUB — Phase 7
│   └── session-service.ts
│
├── views/                      # STUB — Phases 3+
│   ├── runner-view.ts
│   ├── editor-panel-view.ts
│   └── snippet-manager-view.ts
│
└── utils/                      # STUB skeleton — Phase 1 creates files, Phase 5+ fills them
    ├── write-mutex.ts
    └── vault-utils.ts

src/__tests__/
├── fixtures/
│   ├── linear.canvas           # start → question → answer → complete (valid)
│   ├── branching.canvas        # question with 2+ answer branches (valid)
│   ├── dead-end.canvas         # question with no outgoing answers (error)
│   └── cycle.canvas            # accidental cycle not through loop-end (error)
├── canvas-parser.test.ts
└── graph-validator.test.ts
```

[CITED: ARCHITECTURE.md §1 — module directory structure]

### Pattern 1: Pure Module (Zero Obsidian Imports)

**What:** `CanvasParser` and `GraphValidator` are plain TypeScript classes that receive and return plain data structures. They import nothing from `'obsidian'`. No `App`, no `TFile`, no `Vault`.

**When to use:** All engine code in `src/graph/`, `src/runner/`, `src/snippets/`, `src/sessions/`.

**Why it matters:** Enables full Vitest coverage without any Obsidian mock. The Obsidian-touching layer (reading files, registering commands) stays in `main.ts` and adapters.

```typescript
// Source: ARCHITECTURE.md §1
// CanvasParser is purely: string in, ProtocolGraph out
class CanvasParser {
  parse(jsonString: string, canvasFilePath: string): ParseResult {
    let raw: CanvasData;
    try {
      raw = JSON.parse(jsonString) as CanvasData;
    } catch {
      return { success: false, error: 'Invalid JSON in canvas file' };
    }
    // ... build nodes, adjacency maps, return ProtocolGraph
  }
}

// Caller in main.ts wires Obsidian API to pure module:
const raw = await this.app.vault.read(file); // Obsidian layer
const result = this.canvasParser.parse(raw, file.path); // pure layer
```

[CITED: ARCHITECTURE.md §1 — CanvasParser pure-module pattern]

### Pattern 2: Discriminated Union for Node Types

**What:** All 7 RadiProtocol node kinds use a discriminated union on the `kind` field. TypeScript's exhaustive narrowing ensures every node type is handled at compile time.

**When to use:** Throughout `graph-model.ts`, `canvas-parser.ts`, `graph-validator.ts`.

```typescript
// Source: ARCHITECTURE.md §2
type RPNodeKind =
  | 'start' | 'question' | 'answer' | 'free-text-input'
  | 'text-block' | 'loop-start' | 'loop-end';

interface RPNodeBase {
  id: string;
  kind: RPNodeKind;
  x: number; y: number; width: number; height: number;
  color?: string;
}

interface QuestionNode extends RPNodeBase { kind: 'question'; questionText: string; }
interface AnswerNode extends RPNodeBase   { kind: 'answer'; answerText: string; displayLabel?: string; }
// ... remaining 5 node types

type RPNode = StartNode | QuestionNode | AnswerNode
            | FreeTextInputNode | TextBlockNode | LoopStartNode | LoopEndNode;

// Exhaustive switch at compile time:
function handleNode(node: RPNode): void {
  switch (node.kind) {
    case 'question': // TypeScript knows node.questionText exists here
    case 'answer':   // TypeScript knows node.answerText exists here
    // ...
    default: { const _exhaustive: never = node; }
  }
}
```

[CITED: ARCHITECTURE.md §2 — node type discrimination]

### Pattern 3: `ProtocolGraph` — Map-Based Adjacency List

**What:** The parsed graph stores nodes in a `Map<string, RPNode>` for O(1) lookup by ID, plus separate forward and reverse adjacency maps. Edges are preserved as a flat array for metadata.

**When to use:** The canonical in-memory graph representation returned by `CanvasParser.parse()`.

```typescript
// Source: ARCHITECTURE.md §2
interface ProtocolGraph {
  canvasFilePath: string;
  nodes: Map<string, RPNode>;              // id → node (O(1) lookup)
  edges: RPEdge[];                         // flat list for metadata access
  adjacency: Map<string, string[]>;        // id → [outgoing neighbor ids]
  reverseAdjacency: Map<string, string[]>; // id → [incoming neighbor ids]
  startNodeId: string;
}
```

[CITED: ARCHITECTURE.md §2 — Map + adjacency list rationale]

### Pattern 4: Three-Color DFS for Cycle Detection

**What:** Graph validator uses white (unvisited) / gray (in current path) / black (fully processed) node coloring to distinguish intentional loop-end back-edges from accidental cycles.

**When to use:** `GraphValidator` — the "unintentional cycle" check (PARSE-07).

**Rule:** A back-edge to a gray node is an error UNLESS that back-edge passes through a `loop-end` node. All other back-edges are unintentional cycles.

```typescript
// Pseudocode — Source: PITFALLS.md graph traversal section + standard DFS algorithm
type Color = 'white' | 'gray' | 'black';

function detectCycles(graph: ProtocolGraph): string[] {
  const color = new Map<string, Color>();
  const errors: string[] = [];

  function dfs(nodeId: string): void {
    color.set(nodeId, 'gray');
    const neighbors = graph.adjacency.get(nodeId) ?? [];
    for (const neighborId of neighbors) {
      if (color.get(neighborId) === 'gray') {
        // back-edge: check if it routes through a loop-end node
        const neighborNode = graph.nodes.get(neighborId);
        if (!neighborNode || neighborNode.kind !== 'loop-end') {
          errors.push(`Cycle detected at node ${neighborId} — not through a loop-end node`);
        }
      } else if (color.get(neighborId) === 'white') {
        dfs(neighborId);
      }
    }
    color.set(nodeId, 'black');
  }

  for (const [id] of graph.nodes) {
    if (!color.has(id)) dfs(id);
  }
  return errors;
}
```

[CITED: PITFALLS.md — "Infinite Loops in Cyclic Protocol Graphs"; standard DFS algorithm]

### Pattern 5: esbuild.config.mjs Dev Vault Copy

**What:** The `esbuild.config.mjs` is extended to read `OBSIDIAN_DEV_VAULT_PATH` from `.env` and copy build output to the vault's plugin directory on every build.

**When to use:** Required from the first commit (D-01, D-02).

```javascript
// esbuild.config.mjs — extension for dev vault copy
// Source: STACK.md §5 — dev vault copy pattern [CITED: dev.to/lukasbach/...]
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config(); // loads .env

const vaultPath = process.env.OBSIDIAN_DEV_VAULT_PATH;
// In the esbuild onEnd callback (dev mode only):
if (isDev && vaultPath) {
  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'radiprotocol');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync('main.js', path.join(pluginDir, 'main.js'));
  fs.copyFileSync('manifest.json', path.join(pluginDir, 'manifest.json'));
  fs.writeFileSync(path.join(pluginDir, '.hotreload'), ''); // trigger pjeby/hot-reload
}
```

[CITED: STACK.md §5]

### Pattern 6: Settings Load with Null Guard

**What:** `loadData()` returns `null` on first install. Always merge loaded data with defaults before use.

**When to use:** In `main.ts` `onload()` — required from the very first commit (NFR-08).

```typescript
// Source: PITFALLS.md — Settings Persistence gotcha
const DEFAULT_SETTINGS: RadiProtocolSettings = {
  outputMode: 'clipboard',
  outputFolderPath: '',
  maxIterations: 50,
};

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  // ...
}
```

[CITED: PITFALLS.md §"Settings Persistence: data.json Gotchas"]

### Pattern 7: `onload()` defers activation to `onLayoutReady()`

**What:** Any code that opens views or accesses workspace layout must run inside `this.app.workspace.onLayoutReady()` callback.

**When to use:** `main.ts` `onload()` — prevents crashes during early plugin load.

```typescript
// Source: ARCHITECTURE.md §1
async onload() {
  await this.loadSettings();
  this.registerViews();
  this.registerCommands();
  this.app.workspace.onLayoutReady(() => {
    // Workspace is ready — safe to access leaves, views, etc.
  });
}
```

[CITED: ARCHITECTURE.md §1 — onLayoutReady pattern]

### Anti-Patterns to Avoid

- **`require('fs')` in any source file:** Use `app.vault.read()` exclusively. NFR-07, PITFALLS.md community review section.
- **`innerHTML` assignment anywhere:** Use `createEl()` / `sanitizeHTMLToDom()`. Caught by `no-restricted-syntax` ESLint rule.
- **`console.log()` in production code:** Use `console.debug()` during development. Caught by `no-console` rule.
- **Raw `addEventListener()` on DOM elements:** Use `this.registerDomEvent()`. Prevents listener leaks during hot-reload.
- **`workspace.activeLeaf`:** Deprecated. Use `workspace.getActiveViewOfType()`.
- **Importing `obsidian` from within `src/graph/`:** Breaks pure-module isolation, breaks Vitest.
- **Accessing `array[0]` without null check:** `noUncheckedIndexedAccess` is enabled; index access returns `T | undefined`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas JSON parsing | Custom parser | `JSON.parse()` + TypeScript interfaces from `obsidian/canvas` | JSON Canvas spec is a flat JSON structure; no grammar needed |
| Cycle detection in graph | Ad-hoc visited set | Three-color DFS (standard algorithm) | Two-state visited sets produce false positives on DAGs with shared nodes |
| Async file write safety | Custom promise chaining | `async-mutex` (Phase 5+) | Race conditions in concurrent async writes are subtle; battle-tested library handles edge cases |
| ESLint Obsidian rules | Custom AST rules | `eslint-plugin-obsidianmd` v0.1.9 | 27 verified rules covering review-rejection patterns; maintained by community |
| Plugin hot-reload | File-watcher script | `pjeby/hot-reload` Obsidian plugin | Handles partial-write timing; actively maintained (v0.3.0, Aug 2025) |

**Key insight:** The graph traversal is the only custom algorithmic code in this phase. Everything else — JSON parsing, linting, hot-reload, test running — has a well-maintained off-the-shelf solution.

---

## Common Pitfalls

### Pitfall 1: `noUncheckedIndexedAccess` Null Surprises

**What goes wrong:** Code like `graph.adjacency.get(nodeId)[0]` fails TypeScript because `Map.get()` returns `T | undefined` and `noUncheckedIndexedAccess` is enabled. Callers forget to null-check before array indexing.

**Why it happens:** The official scaffold enables `noUncheckedIndexedAccess`. This is correct for graph code where a missing node ID is a real runtime case, but surprises developers expecting Java/Python behavior.

**How to avoid:** Always null-check `Map.get()` results. Use the `??` operator or early returns. Pattern: `const neighbors = graph.adjacency.get(nodeId) ?? [];`.

**Warning signs:** TypeScript errors on `array[0]` or `map.get(key)!` (the `!` suppresses but hides real bugs).

### Pitfall 2: Canvas File Format — `raw.nodes` and `raw.edges` May Be Undefined

**What goes wrong:** A `.canvas` file with no nodes or no edges is valid JSON Canvas. `raw.nodes` and `raw.edges` can both be `undefined`. Iterating over them without a guard causes a runtime error.

**Why it happens:** The JSON Canvas v1.0 spec marks both `nodes` and `edges` as optional on `CanvasData`.

**How to avoid:** Always use `raw.nodes ?? []` and `raw.edges ?? []` in the parser.

**Warning signs:** "Cannot read properties of undefined (reading 'length')" in Vitest against minimal fixture files.

### Pitfall 3: Accessing `radiprotocol_*` Properties Requires Type Assertion

**What goes wrong:** The `obsidian/canvas` type definitions do not know about `radiprotocol_*` fields. Accessing `node.radiprotocol_nodeType` fails TypeScript because the field doesn't exist on the known type.

**Why it happens:** The TypeScript types for canvas nodes are closed structs.

**How to avoid:** Cast to `unknown` then to a wider type, or use `(node as Record<string, unknown>)['radiprotocol_nodeType']`. Do this once in the parser boundary; never spread `any` throughout the codebase. This is the one legitimate use of a type assertion in this codebase.

**Warning signs:** `@typescript-eslint/no-explicit-any` error on the property access.

### Pitfall 4: ESLint `no-floating-promises` Requires `parserOptions.project`

**What goes wrong:** The `@typescript-eslint/no-floating-promises` rule requires type-aware linting, which requires `parserOptions: { project: true }` in `eslint.config.mjs`. Without it, ESLint silently skips the rule or errors with "Parser Services not available."

**Why it happens:** Type-aware rules need access to the TypeScript project's type information, not just the AST.

**How to avoid:** Include `parserOptions: { project: true }` (or `project: './tsconfig.json'`) in the ESLint language options block. The scaffold template has this.

**Warning signs:** ESLint runs without errors but floating promises aren't caught; or ESLint throws "You have used a rule which requires type information."

### Pitfall 5: Hot-Reload Partial-Write Race

**What goes wrong:** esbuild writes `main.js` incrementally. The `pjeby/hot-reload` plugin detects the file modification mid-write and reloads a corrupt/partial `main.js`, causing cryptic JavaScript errors in the Obsidian console.

**Why it happens:** Hot-reload debounces 750ms but a large build can exceed this window.

**How to avoid:** For this plugin (no Svelte preprocessing), builds are fast and this should not occur. Monitor the Obsidian developer console during hot-reload. If seen, use esbuild's `onEnd` callback to touch a separate trigger file after the build completes.

**Warning signs:** Obsidian console shows "SyntaxError: Unexpected end of input" or similar JS parse error immediately after hot-reload.

### Pitfall 6: Vitest Cannot Import `obsidian` Module

**What goes wrong:** If any file in `src/graph/` imports from `'obsidian'`, Vitest will fail with "Cannot find module 'obsidian'" because the module doesn't exist outside Obsidian's runtime.

**Why it happens:** `'obsidian'` is an external provided by esbuild at bundle time, not a real Node.js module.

**How to avoid:** Enforce the pure module boundary strictly — zero Obsidian imports in `src/graph/`. The `vitest.config.ts` `include` pattern acts as a canary: if Vitest fails with a module-not-found error, an import leaked across the boundary.

**Warning signs:** `Error: Cannot find module 'obsidian'` in Vitest output.

### Pitfall 7: Cycle Detection Confuses Loop-End Back-Edges with Errors

**What goes wrong:** The three-color DFS marks a node gray during traversal. A back-edge to a gray node is normally a cycle. But loop-end → loop-start back-edges are intentional. Treating all back-edges as errors produces false positives on valid loop protocols.

**Why it happens:** Standard DFS cycle detection doesn't know about the loop-end convention.

**How to avoid:** Before reporting a back-edge as an error, check whether the source node is of kind `loop-end`. If it is, the cycle is intentional. Only report the error if the source is NOT a loop-end node.

**Warning signs:** Valid `.canvas` files with loop nodes fail validation in tests.

---

## Code Examples

Verified patterns from ARCHITECTURE.md and STACK.md (both verified against official sources):

### CanvasParser structure

```typescript
// Source: ARCHITECTURE.md §2 [CITED]
// src/graph/canvas-parser.ts
import type { CanvasData } from 'obsidian/canvas';
import type { ProtocolGraph, RPNode, RPEdge, RPNodeKind } from './graph-model';

export type ParseResult =
  | { success: true; graph: ProtocolGraph }
  | { success: false; error: string };

export class CanvasParser {
  parse(jsonString: string, canvasFilePath: string): ParseResult {
    let raw: CanvasData;
    try {
      raw = JSON.parse(jsonString) as CanvasData;
    } catch {
      return { success: false, error: 'Invalid JSON in canvas file' };
    }

    const nodes = new Map<string, RPNode>();
    const adjacency = new Map<string, string[]>();
    const reverseAdjacency = new Map<string, string[]>();
    const edges: RPEdge[] = [];

    for (const rawNode of raw.nodes ?? []) {
      const rpNode = this.parseNode(rawNode);
      if (rpNode === null) continue;      // skip plain canvas nodes
      nodes.set(rpNode.id, rpNode);
    }

    for (const rawEdge of raw.edges ?? []) {
      if (!nodes.has(rawEdge.fromNode) || !nodes.has(rawEdge.toNode)) continue;
      edges.push({
        id: rawEdge.id,
        fromNodeId: rawEdge.fromNode,
        toNodeId: rawEdge.toNode,
        label: rawEdge.label,
      });
      const fwd = adjacency.get(rawEdge.fromNode) ?? [];
      fwd.push(rawEdge.toNode);
      adjacency.set(rawEdge.fromNode, fwd);
      const rev = reverseAdjacency.get(rawEdge.toNode) ?? [];
      rev.push(rawEdge.fromNode);
      reverseAdjacency.set(rawEdge.toNode, rev);
    }

    const startNodes = [...nodes.values()].filter(n => n.kind === 'start');
    if (startNodes.length !== 1) {
      return {
        success: false,
        error: startNodes.length === 0
          ? 'No start node found — add a node with radiprotocol_nodeType: "start"'
          : `Multiple start nodes found (${startNodes.length}) — exactly one is required`,
      };
    }

    return {
      success: true,
      graph: {
        canvasFilePath,
        nodes,
        edges,
        adjacency,
        reverseAdjacency,
        startNodeId: startNodes[0]!.id,
      },
    };
  }

  private parseNode(raw: Record<string, unknown>): RPNode | null {
    const kind = raw['radiprotocol_nodeType'] as RPNodeKind | undefined;
    if (!kind) return null;
    // ... switch on kind, extract fields
  }
}
```

### Vitest configuration

```typescript
// vitest.config.ts — Source: STACK.md §4 [VERIFIED: vitest.dev]
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

### Canvas fixture format (minimal)

```json
// src/__tests__/fixtures/linear.canvas
// Source: JSON Canvas v1.0 spec [VERIFIED: jsoncanvas.org/spec/1.0/]
{
  "nodes": [
    {
      "id": "start-1",
      "type": "text", "text": "Start",
      "x": 0, "y": 0, "width": 120, "height": 60,
      "radiprotocol_nodeType": "start"
    },
    {
      "id": "q1",
      "type": "text", "text": "Q1",
      "x": 200, "y": 0, "width": 120, "height": 60,
      "radiprotocol_nodeType": "question",
      "radiprotocol_questionText": "Q1"
    },
    {
      "id": "a1",
      "type": "text", "text": "A1",
      "x": 400, "y": 0, "width": 120, "height": 60,
      "radiprotocol_nodeType": "answer",
      "radiprotocol_answerText": "Finding: A1"
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "start-1", "toNode": "q1" },
    { "id": "e2", "fromNode": "q1", "toNode": "a1" }
  ]
}
```

### ESLint flat config

```javascript
// eslint.config.mjs — Source: STACK.md §7 [VERIFIED: github.com/mProjectsCode/eslint-plugin-obsidianmd]
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  obsidianmd.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { project: true },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name="innerHTML"]',
          message: 'Use createEl() or sanitizeHTMLToDom() instead of innerHTML',
        },
        {
          selector: 'AssignmentExpression[left.property.name="outerHTML"]',
          message: 'Do not use outerHTML — use DOM API',
        },
      ],
    },
  },
);
```

### manifest.json (initial values)

```json
{
  "id": "radiprotocol",
  "name": "RadiProtocol",
  "version": "0.1.0",
  "minAppVersion": "1.5.7",
  "description": "Canvas-based radiology report protocol runner",
  "author": "Your Name",
  "authorUrl": "",
  "fundingUrl": "",
  "isDesktopOnly": true
}
```

[CITED: NFR-03 — minAppVersion 1.5.7; REQUIREMENTS.md constraints — desktop-only for v1]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for plugin tests | Vitest (ESM-native) | ~2023 | Eliminates `--experimental-vm-modules` setup friction |
| Manual `.env` parsing | `dotenv` library | N/A | Convenience; both valid |
| `jest-environment-obsidian` mock | No full mock — pure module isolation instead | 2023 (project abandoned) | Forces architectural discipline: pure engine code |
| `workspace.activeLeaf` | `workspace.getActiveViewOfType()` | Obsidian ~1.x | `activeLeaf` is deprecated |
| ESLint v8 flat config (legacy) | ESLint v9 flat config (`eslint.config.mjs`) | ESLint v9 (2024) | Official scaffold now uses flat config |

**Deprecated/outdated:**
- `jest-environment-obsidian`: Last commit May 2023, v0.0.1 — do not use. [VERIFIED: github.com/obsidian-community/jest-environment-obsidian]
- `workspace.activeLeaf`: Deprecated in Obsidian API — use `getActiveViewOfType()`.
- ESLint v8 legacy config (`.eslintrc.js`): Official scaffold now uses flat config (`eslint.config.mjs`) with `jiti`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dotenv` is the right choice over manual `.env` parsing in `esbuild.config.mjs` | Standard Stack, Pattern 5 | Low — Claude's discretion; both produce same result |
| A2 | `import type { CanvasData } from 'obsidian/canvas'` is the correct import path for canvas types | Code Examples | Low — verifiable by checking obsidian package's type declarations; if wrong, use `import type { CanvasData } from 'obsidian'` |
| A3 | `typescript` 6.0.2 is fully compatible with `noUncheckedIndexedAccess` + the Obsidian scaffold's specific tsconfig options | Standard Stack | Low — typescript 6.x is current; compatibility with the scaffold's tsconfig should be validated on first `tsc -noEmit` |

---

## Open Questions

1. **`import type { CanvasData } from 'obsidian/canvas'` vs `'obsidian'`**
   - What we know: ARCHITECTURE.md references `obsidian/canvas` as the import path. STACK.md references `obsidian-api/canvas.d.ts` on GitHub.
   - What's unclear: Whether the `obsidian` npm package exposes `obsidian/canvas` as a sub-path export, or if types must be imported from `obsidian` directly.
   - Recommendation: On first `npm install obsidian`, check `node_modules/obsidian/` for `canvas.d.ts`. If the sub-path isn't available, import canvas types from the main `'obsidian'` entry. The test for the pure module will fail if any import pulls in the obsidian runtime — that's the integration test.

2. **Fixture file reading in Vitest — `fs.readFileSync` path resolution**
   - What we know: D-03 specifies fixtures in `src/__tests__/fixtures/`; Vitest reads with `fs.readFileSync`.
   - What's unclear: Whether `fs.readFileSync` uses the project root as CWD or the test file's directory.
   - Recommendation: Use `path.join(__dirname, 'fixtures', 'linear.canvas')` (or `import.meta.dirname` for ESM) to ensure path resolution is portable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain, Vitest | Yes | v24.11.1 | — |
| npm | Package management | Yes | 11.12.1 | — |
| Git | Hot-reload trigger (`.git` dir), source control | Yes | 2.52.0 | — |
| Obsidian desktop | Manual dev verification, plugin loading | Not verified | — | Cannot test plugin load without it; manual step |

**Missing dependencies with no fallback:**
- Obsidian desktop: Required to verify success criteria #1 (plugin loads, ribbon icon appears). Must be installed manually by developer. Not installable via npm.

**Missing dependencies with fallback:**
- None.

**Note:** `pjeby/hot-reload` Obsidian plugin must be installed in the dev vault manually. It is not available on the community plugin list by design. The developer must clone `github.com/pjeby/hot-reload` into `DEV_VAULT/.obsidian/plugins/hot-reload/` and enable it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (Wave 0 gap — does not exist yet) |
| Quick run command | `npx vitest run src/__tests__` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | `CanvasParser.parse()` returns `ProtocolGraph` from valid canvas JSON | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | Wave 0 |
| PARSE-02 | All 7 node kinds are parsed from `radiprotocol_nodeType` | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | Wave 0 |
| PARSE-03 | Plain canvas nodes without `radiprotocol_nodeType` are silently skipped | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | Wave 0 |
| PARSE-06 | `CanvasParser` imports zero Obsidian modules (pure module) | unit (import check) | `npx vitest run` (fails if obsidian imported) | Wave 0 |
| PARSE-07 | `GraphValidator` catches all 6 error classes | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | Wave 0 |
| PARSE-08 | Validation errors are plain-language strings, not exceptions | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | Wave 0 |
| DEV-01 | `npm run dev` builds and copies to dev vault | manual smoke | N/A | manual |
| DEV-02 | ESLint runs with zero warnings/errors | lint | `npm run lint` | Wave 0 |
| DEV-03 | `no-console`, `no-explicit-any`, `no-floating-promises` rules active | lint | `npm run lint` | Wave 0 |
| DEV-04 | Vitest configured for `src/__tests__/` with node environment | unit (config) | `npx vitest run` | Wave 0 |
| DEV-05 | All 4 fixture `.canvas` files exist and parse | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | Wave 0 |
| NFR-01 | `src/graph/` files have no Obsidian imports | unit (build canary) | `npx vitest run` | Wave 0 |
| NFR-04 | Zero ESLint warnings | lint | `npm run lint` | Wave 0 |
| NFR-08 | Settings load uses `Object.assign({}, DEFAULT_SETTINGS, ...)` | code review | N/A | manual |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__`
- **Per wave merge:** `npx vitest run && npm run lint`
- **Phase gate:** Full suite green + `npm run lint` zero errors before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — test framework config (install: `npm install --save-dev vitest`)
- [ ] `src/__tests__/canvas-parser.test.ts` — covers PARSE-01, PARSE-02, PARSE-03, PARSE-06
- [ ] `src/__tests__/graph-validator.test.ts` — covers PARSE-07, PARSE-08
- [ ] `src/__tests__/fixtures/linear.canvas` — valid linear protocol fixture
- [ ] `src/__tests__/fixtures/branching.canvas` — valid branching protocol fixture
- [ ] `src/__tests__/fixtures/dead-end.canvas` — dead-end question error fixture
- [ ] `src/__tests__/fixtures/cycle.canvas` — unintentional cycle error fixture
- [ ] `package.json` `"test"` script: `"vitest run"` — for CI integration

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this plugin |
| V3 Session Management | No | No user sessions in Phase 1 |
| V4 Access Control | No | Single-user local vault |
| V5 Input Validation | Yes | `JSON.parse` with try/catch; type-checked deserialization in `CanvasParser` |
| V6 Cryptography | No | No encryption in Phase 1 |

### Known Threat Patterns for Phase 1 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `.canvas` JSON causing crash | Denial of Service | `JSON.parse` inside try/catch; `CanvasParser` returns `ParseResult` error, never throws |
| `radiprotocol_*` property injection (crafted canvas file) | Tampering | Type assertions immediately validated via `switch(kind)`; unknown `kind` values are silently skipped or returned as errors |
| `innerHTML` injection via node text content | Elevation of Privilege | Deferred to Phase 3 (UI); in Phase 1, no DOM rendering — `no-restricted-syntax` ESLint rule prevents accidental introduction |

---

## Sources

### Primary (HIGH confidence)

- `github.com/obsidianmd/obsidian-sample-plugin` — official scaffold: `package.json`, `tsconfig.json`, `esbuild.config.mjs` verified
- `npm registry` — all package versions verified 2026-04-05 via `npm view`
- `jsoncanvas.org/spec/1.0/` — complete JSON Canvas data model verified
- `github.com/mProjectsCode/eslint-plugin-obsidianmd` — all 27 rules verified
- `github.com/pjeby/hot-reload` — v0.3.0, August 2025, actively maintained
- `.planning/research/STACK.md` — project-specific verified research (2026-04-05)
- `.planning/research/ARCHITECTURE.md` — project-specific architecture decisions (2026-04-05)
- `.planning/research/PITFALLS.md` — project-specific pitfall catalogue (2026-04-05)

### Secondary (MEDIUM confidence)

- `deepwiki.com/obsidianmd/obsidian-api` — plugin development patterns, event system, ItemView docs
- `forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871` — ItemView activation pattern
- `dev.to/lukasbach/a-more-streamlined-development-workflow-for-obsidian-plugins` — dev vault copy pattern

### Tertiary (LOW confidence)

- None for Phase 1 scope. All key claims are verified or cited from authoritative sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-04-05
- Architecture (pure module pattern): HIGH — verified from ARCHITECTURE.md which cites official Obsidian API docs
- Graph model design: HIGH — verified from ARCHITECTURE.md canonical reference
- ESLint config: HIGH — verified from official `eslint-plugin-obsidianmd` GitHub
- Pitfalls: HIGH — sourced from PITFALLS.md (project research) + official Obsidian community sources

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable ecosystem; npm package versions may drift)
