# Coding Conventions

**Analysis Date:** 2026-04-16

## Naming Patterns

**Files:**
- kebab-case for all TypeScript source files: `canvas-parser.ts`, `runner-state.ts`, `snippet-model.ts`
- kebab-case for CSS files: `runner-view.css`, `editor-panel.css`, `snippet-manager.css`
- PascalCase test file exception: `RunnerView.test.ts` (legacy; newer tests use kebab-case)
- Test files: `{module-name}.test.ts` in `src/__tests__/`
- Type declaration files: `{name}.d.ts` in `src/types/`

**Classes:**
- PascalCase: `CanvasParser`, `ProtocolRunner`, `SnippetService`, `WriteMutex`
- Obsidian views suffix with `View`: `RunnerView`, `EditorPanelView`, `SnippetManagerView`
- Obsidian modals suffix with `Modal`: `SnippetFillInModal`, `ResumeSessionModal`, `ConfirmModal`

**Interfaces and Types:**
- PascalCase with descriptive names: `ProtocolGraph`, `RunnerState`, `SnippetPlaceholder`
- Node types end with `Node`: `QuestionNode`, `AnswerNode`, `TextBlockNode`, `SnippetNode`
- State types end with `State`: `IdleState`, `AtNodeState`, `CompleteState`, `ErrorState`
- Options types end with `Options`: `ProtocolRunnerOptions`
- Settings interface: `RadiProtocolSettings`

**Constants:**
- SCREAMING_SNAKE_CASE for view type identifiers: `RUNNER_VIEW_TYPE`, `EDITOR_PANEL_VIEW_TYPE`, `SNIPPET_MANAGER_VIEW_TYPE`
- SCREAMING_SNAKE_CASE for configuration constants: `DEFAULT_SETTINGS`, `NODE_COLOR_MAP`
- SCREAMING_SNAKE_CASE for internal constants: `MIME_FILE`, `MIME_FOLDER`

**Functions:**
- camelCase: `loadGraph()`, `renderSnippet()`, `ensureFolderPath()`, `toCanvasKey()`
- Private methods camelCase: `advanceThrough()`, `transitionToError()`, `firstNeighbour()`
- Event callbacks use arrow functions inline

**Variables:**
- camelCase: `canvasFilePath`, `snippetFolderPath`, `loopContextStack`
- Private fields with no underscore prefix (TypeScript `private` keyword): `private graph`, `private currentNodeId`
- Exception: `_debounceTimer` uses underscore prefix for internal timer handles

## TypeScript Patterns

**Interfaces vs Types:**
- Use `interface` for object shapes that represent domain entities: `QuestionNode`, `ProtocolGraph`, `SnippetPlaceholder`
- Use `type` for unions, aliases, and computed types: `RPNode`, `RPNodeKind`, `RunnerState`, `ParseResult`, `Snippet`
- Use discriminated unions with `kind` or `status` field as discriminant:
  - `RPNode` discriminated on `kind: RPNodeKind`
  - `RunnerState` discriminated on `status: RunnerStatus`
  - `Snippet` discriminated on `kind: 'json' | 'md'`
  - `ParseResult` discriminated on `success: boolean`

**Discriminated union narrowing pattern:**
```typescript
// Callers narrow via switch or if-guard:
const state = runner.getState();
if (state.status !== 'at-node') return;
// state is now AtNodeState — access .currentNodeId safely
```

**Exhaustiveness checking:**
```typescript
default: {
  const _exhaustive: never = this.runnerStatus;
  void _exhaustive;
  return { status: 'error', message: 'Unknown runner status.' };
}
```

**Generics:**
- Used sparingly and only in utility code: `WriteMutex.runExclusive<T>(path, fn: () => Promise<T>): Promise<T>`
- Obsidian's `SuggestModal<T>` generic is extended in modal classes

**Nullability:**
- `strictNullChecks: true` is enforced in `tsconfig.json`
- `noUncheckedIndexedAccess: true` — array/map access returns `T | undefined`
- Pattern: always check `=== undefined` before accessing indexed results:
```typescript
const node = this.graph.nodes.get(cursor);
if (node === undefined) {
  this.transitionToError(`Node '${cursor}' not found in graph.`);
  return;
}
```

**Non-null assertion:**
- Use `!` only for constructor fields with guaranteed initialization: `settings!: RadiProtocolSettings`
- Never use `!` in runtime logic — prefer explicit undefined checks

**Type casting:**
- Minimize `as` casts. When unavoidable (Obsidian internal APIs), chain through `unknown`:
```typescript
const view = leaf.view as unknown as { canvas?: unknown };
```
- Use `as never` in test mocks to bypass strict typing on mock objects

**`readonly` modifier:**
- Use `readonly` on interface fields that must not be mutated: `readonly kind: 'json'`
- Use `private readonly` on class fields that are set once in constructor: `private readonly maxIterations`, `private readonly mutex`

## Code Style

**Formatting:**
- No `.prettierrc` — no Prettier. Formatting is manual/IDE-driven.
- 2-space indentation (inferred from all source files)
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line parameter lists and object literals

**Linting:**
- ESLint with flat config (`eslint.config.mjs`)
- TypeScript-eslint recommended rules
- `eslint-plugin-obsidianmd` for Obsidian-specific best practices
- Key enforced rules:
  - `@typescript-eslint/no-explicit-any: 'error'` — no `any` type allowed
  - `@typescript-eslint/no-floating-promises: 'error'` — all promises must be awaited or voided
  - `no-console: ['error', { allow: ['warn', 'error', 'debug'] }]` — `console.log()` is banned
  - `innerHTML` and `outerHTML` access is banned via `no-restricted-syntax` — use Obsidian `createEl()` helpers
  - `obsidianmd/ui/sentence-case: ['error', { enforceCamelCaseLower: true }]` — UI text must be sentence case

**Void-ing fire-and-forget promises:**
```typescript
// When calling async from sync context, prefix with void:
void this.activateRunnerView();
void this.openCanvas(path);
```

## Import Organization

**Order:**
1. `obsidian` framework imports (both value and type imports)
2. Local project imports — relative paths
3. No third-party libraries except `obsidian` and `async-mutex`

**Type-only imports:**
- Use `import type` for interfaces and types that have no runtime value:
```typescript
import type { WorkspaceLeaf } from 'obsidian';
import type { ProtocolGraph, LoopContext } from '../graph/graph-model';
import type { RunnerState, UndoEntry } from './runner-state';
```

**Path aliases:**
- `tsconfig.json` sets `"baseUrl": "src"` — but relative paths are used everywhere in practice
- Vitest config aliases `obsidian` to `src/__mocks__/obsidian.ts` for testing

**No barrel files:**
- Each module imports directly from source files, not through `index.ts` barrel files
- There are no `index.ts` files in the project

## Error Handling

**Parse errors — Result pattern:**
- `ParseResult = { success: true; graph } | { success: false; error: string }`
- Never throw on invalid input; return a typed error result

**Runner errors — state machine transition:**
- `transitionToError(message)` sets status to `'error'` and stores the message
- Callers check `state.status === 'error'` and surface `state.message` to UI

**Service/vault errors — try/catch with console.error + Notice:**
```typescript
try {
  await this.insertMutex.runExclusive(file.path, async () => { ... });
  new Notice(`Inserted into ${file.name}.`);
} catch (err) {
  console.error('[RadiProtocol] insertIntoCurrentNote failed:', err);
  new Notice(`Failed to insert into ${file.name}. See console for details.`);
}
```

**Guard clauses — early return on invalid state:**
```typescript
if (this.runnerStatus !== 'at-node') return;
if (this.graph === null || this.currentNodeId === null) return;
```

## Logging

**Framework:** `console.debug`, `console.error`, `console.warn` (console.log banned by ESLint)

**Patterns:**
- All log messages prefixed with `[RadiProtocol]`: `console.debug('[RadiProtocol] Plugin loaded')`
- `console.error` for operational failures with context: `console.error('[RadiProtocol] snippet-service rejected unsafe path:', path)`
- `console.debug` for lifecycle events: load, unload

## Comments

**File headers:**
- Every file starts with a comment line identifying the module path:
```typescript
// runner/protocol-runner.ts
// Pure module — zero Obsidian API imports (NFR-01)
```

**Phase/requirement traceability:**
- Comments reference requirement IDs throughout: `(NFR-01)`, `(D-03)`, `(LOOP-05)`, `(SESSION-01)`
- Phase tags mark when code was added: `// Phase 29`, `// Phase 31 D-08`
- CSS sections marked: `/* Phase N: description */`

**JSDoc:**
- Full JSDoc on all public methods of core classes (`ProtocolRunner`, `SnippetService`, `SessionService`)
- JSDoc includes preconditions, postconditions, and pitfall warnings
- `@deprecated` tag used for backwards-compat aliases: `@deprecated D-02: basename is source of truth`

**Inline comments:**
- Explain WHY, not WHAT: `// Pitfall 1: undo-before-mutate with returnToBranchList flag`
- Reference pitfalls from research docs: `// (Pitfall 3 — snapshot must come first)`

## Module Design

**Pure vs Obsidian-dependent split:**
- Pure modules (zero Obsidian imports) are annotated at file top: `// Pure module — zero Obsidian API imports (NFR-01)`
- Pure modules: `graph-model.ts`, `canvas-parser.ts`, `protocol-runner.ts`, `runner-state.ts`, `text-accumulator.ts`, `snippet-model.ts`, `write-mutex.ts`
- Obsidian-dependent modules: `main.ts`, all `views/*.ts`, `snippet-service.ts`, `session-service.ts`, `vault-utils.ts`
- This split enables unit testing pure modules without Obsidian runtime

**Exports:**
- Named exports for classes, constants, interfaces, and functions
- Single default export only for the plugin class in `src/main.ts`: `export default class RadiProtocolPlugin`
- View type constants exported alongside their view class: `export const RUNNER_VIEW_TYPE = 'radiprotocol-runner'`

**CSS architecture:**
- One CSS file per feature in `src/styles/`
- Build concatenates them via `CSS_FILES` list in `esbuild.config.mjs`
- Append-only per phase — never rewrite existing sections
- All selectors prefixed with `rp-`: `.rp-preview-textarea`, `.rp-editor-saved-indicator`, `.rp-placeholder-chip`

---

*Convention analysis: 2026-04-16*
