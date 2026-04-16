# Testing Patterns

**Analysis Date:** 2026-04-16

## Test Framework

**Runner:**
- Vitest ^4.1.2
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (no Chai, no Jest)

**Run Commands:**
```bash
npm test              # Run all tests (vitest run)
npx vitest            # Watch mode (interactive)
npx vitest --coverage # Coverage (not configured — no coverage provider in devDependencies)
```

## Test File Organization

**Location:**
- All tests in `src/__tests__/` (centralized, not co-located)
- Subdirectory `src/__tests__/runner/` for runner-specific tests
- Test utilities in `src/__tests__/test-utils/`

**Naming:**
- `{module-name}.test.ts` — kebab-case matching source module name
- Examples: `canvas-parser.test.ts`, `snippet-service.test.ts`, `write-mutex.test.ts`
- Legacy exception: `RunnerView.test.ts` (PascalCase)

**Structure:**
```
src/__tests__/
├── fixtures/                          # .canvas JSON fixture files + snippet fixtures
│   ├── linear.canvas
│   ├── branching.canvas
│   ├── text-block.canvas
│   ├── snippet-node.canvas
│   ├── loop-body.canvas
│   └── snippets/                      # Snippet JSON fixtures
├── test-utils/
│   └── make-canvas-node.ts            # Canonical test helper for canvas node fixtures
├── runner/
│   ├── protocol-runner.test.ts        # Core runner state machine tests (982 lines)
│   ├── protocol-runner-session.test.ts # Session save/restore tests (348 lines)
│   └── text-accumulator.test.ts       # Text accumulator unit tests (82 lines)
├── canvas-parser.test.ts             # Canvas JSON parsing tests
├── graph-validator.test.ts           # Graph validation tests
├── snippet-service.test.ts           # Snippet CRUD tests (739 lines)
├── snippet-service-move.test.ts      # Snippet move/rename tests (486 lines)
├── snippet-editor-modal.test.ts      # Snippet editor UI tests (811 lines)
├── snippet-tree-view.test.ts         # Tree view rendering tests (540 lines)
├── snippet-tree-dnd.test.ts          # Drag-and-drop logic tests (636 lines)
├── snippet-tree-inline-rename.test.ts # Inline rename tests (520 lines)
├── snippet-vault-watcher.test.ts     # Vault watcher debounce tests (281 lines)
├── session-service.test.ts           # Session persistence tests (207 lines)
├── editor-panel.test.ts              # Editor panel view tests (69 lines)
├── regression.test.ts                # Regression smoke tests (138 lines)
└── ... (25 test files, ~7,400 lines total)
```

## Test Configuration

**Vitest config (`vitest.config.ts`):**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'src/__mocks__/obsidian.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,  // explicit imports required: import { describe, it, expect } from 'vitest'
  },
});
```

**Key decisions:**
- `globals: false` — every test file explicitly imports `describe`, `it`, `expect`, `vi`, `beforeEach`
- `environment: 'node'` — no jsdom; DOM elements are mocked manually
- `obsidian` module aliased to mock — all Obsidian API classes are stubbed in `src/__mocks__/obsidian.ts`

## Obsidian Mock

**Location:** `src/__mocks__/obsidian.ts`

**Mocked classes:**
- `ItemView` — minimal constructor with `contentEl` mock element
- `WorkspaceLeaf` — empty class
- `PluginSettingTab` — constructor + `containerEl`
- `Plugin` — empty `app` and `manifest`
- `Modal` — `contentEl`, `titleEl`, `open()`, `close()`
- `SuggestModal<T>` — generic stub with empty method implementations
- `Notice` — constructor no-op
- `Setting` — chainable builder mock (`setName`, `setDesc`, `addText`, `addDropdown`, `addButton`)
- `TFile` — simple `path` property

**Mock element factory:**
```typescript
function makeMockEl(): MockElement {
  const el: MockElement = {
    createEl: (_tag, _opts?) => makeMockEl(),
    createDiv: (_opts?) => makeMockEl(),
    empty: () => {},
    setText: (_text) => {},
    type: '',
    min: '',
  };
  return el;
}
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
  // Setup
  let instance: ModuleClass;
  beforeEach(() => {
    instance = new ModuleClass();
  });

  describe('methodName() — requirement ID', () => {
    it('describes specific behavior in plain English', () => {
      // Arrange → Act → Assert
      const result = instance.method();
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns observed:**
- Top-level `describe` matches the class/module name
- Nested `describe` groups by method or feature area
- Requirement IDs in describe strings: `'start() — linear protocol traversal (RUN-01, RUN-02)'`
- `beforeEach` for per-test instance creation
- `beforeAll` for expensive one-time setup (reading files)

**Narrowing after discriminated union checks:**
```typescript
const state = runner.getState();
expect(state.status).toBe('at-node');
if (state.status !== 'at-node') return;  // TypeScript narrowing guard
expect(state.currentNodeId).toBe('n-q1');
```

## Mocking

**Framework:** Vitest built-in `vi.fn()` and `vi.mock()`

**Obsidian module mock:**
```typescript
vi.mock('obsidian');  // Uses the alias from vitest.config.ts → src/__mocks__/obsidian.ts
```

**Vault mock factory pattern (used across multiple test files):**
```typescript
function makeVault(opts: MockVaultOptions = {}) {
  const files: Record<string, string> = { ...(opts.files ?? {}) };
  const folderSet = new Set(opts.folders ?? []);
  const vault = {
    adapter: {
      exists: vi.fn(async (p: string) => p in files || folderSet.has(p)),
      read: vi.fn(async (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }),
      write: vi.fn(async (p: string, data: string) => { files[p] = data; }),
      list: vi.fn(async (p: string) => { /* directory listing logic */ }),
    },
    create: vi.fn(),
    createFolder: vi.fn(),
    getAbstractFileByPath: vi.fn(),
    trash: vi.fn(),
    delete: vi.fn(),
  };
  return { vault, files, folderSet };
}
```

**App mock factory:**
```typescript
function makeAppMock(existsResult = false) {
  return { vault: makeVaultMock(existsResult) };
}
```

**What to mock:**
- Obsidian `App`, `Vault`, `WorkspaceLeaf` — always mocked (no Obsidian runtime in tests)
- File system operations via vault adapter mocks
- Timer/delay functions when testing debounce behavior

**What NOT to mock:**
- Pure modules (`CanvasParser`, `ProtocolRunner`, `TextAccumulator`, `renderSnippet`) — tested directly
- Graph model types — used as-is from source

## Fixtures and Factories

**Canvas fixtures:**
- `.canvas` JSON files in `src/__tests__/fixtures/`
- Each fixture is a minimal Obsidian canvas with radiprotocol_nodeType annotations
- Loaded via file system read in tests:
```typescript
const fixturesDir = path.join(__dirname, 'fixtures');
function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}
```

**Graph loading helper:**
```typescript
function loadGraph(name: string): ProtocolGraph {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}
```

**Canvas node factory (`src/__tests__/test-utils/make-canvas-node.ts`):**
```typescript
export function makeCanvasNode(
  type: RPNodeKind,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `node-${Math.random().toString(36).slice(2, 9)}`,
    type: 'text', x: 0, y: 0, width: 200, height: 60,
    radiprotocol_nodeType: type,
    color: NODE_COLOR_MAP[type],
    ...overrides,
  };
}
```

**Session fixture factory:**
```typescript
function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    version: 1, canvasFilePath: 'protocols/chest.canvas',
    canvasMtimeAtSave: 1700000000000, savedAt: 1700000001000,
    runnerStatus: 'at-node', currentNodeId: 'n-q1',
    accumulatedText: 'Liver',
    undoStack: [{ nodeId: 'n-start', textSnapshot: '', loopContextStack: [] }],
    loopContextStack: [], snippetId: null, snippetNodeId: null,
    ...overrides,
  };
}
```

**Inline canvas construction for edge cases:**
```typescript
function buildSnippetCanvas(extraProps: Record<string, unknown>): string {
  return JSON.stringify({
    nodes: [
      { id: 'n-start', type: 'text', text: 'Start', ... radiprotocol_nodeType: 'start' },
      { id: 'n-snippet1', type: 'text', text: 'Snippet', ... radiprotocol_nodeType: 'snippet', ...extraProps },
    ],
    edges: [{ id: 'e1', fromNode: 'n-start', toNode: 'n-snippet1' }],
  });
}
```

## Coverage

**Requirements:** No coverage threshold enforced. No coverage provider (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`) in `devDependencies`.

## Test Types

**Unit Tests (majority):**
- Pure state machine testing: `ProtocolRunner` start/chooseAnswer/enterFreeText/stepBack/chooseLoopAction
- Parser correctness: `CanvasParser` with fixture files
- Model logic: `renderSnippet`, `slugifyLabel`
- Utility functions: `WriteMutex`, `ensureFolderPath`, `toCanvasKey`
- Service CRUD: `SnippetService` with mocked vault

**Integration-style Tests:**
- Parser + Runner combined: load fixture → parse → run through protocol
- Session save/restore round-trip: serialize → restore → verify state matches
- Canvas ref sync: rename/move operations updating canvas files

**Regression Smoke Tests (`src/__tests__/regression.test.ts`):**
- Unique pattern: reads actual source files and CSS files from disk
- Asserts that specific CSS rules and TypeScript symbols still exist
- Guards against AI executor agents accidentally deleting code
- Example:
```typescript
it('has .rp-preview-textarea:hover rule pinning background to primary', () => {
  expect(css).toContain('.rp-preview-textarea:hover');
  expect(css).toContain('background: var(--background-primary)');
});
```

**E2E Tests:**
- Not used. No Playwright, Cypress, or Obsidian E2E harness.

## Common Patterns

**Async Testing:**
```typescript
it('serializes concurrent writes on the same path', async () => {
  const m = new WriteMutex();
  const order: number[] = [];
  const p1 = m.runExclusive('/test/file.json', async () => {
    await new Promise(r => setTimeout(r, 20));
    order.push(1);
  });
  const p2 = m.runExclusive('/test/file.json', async () => {
    order.push(2);
  });
  await Promise.all([p1, p2]);
  expect(order).toEqual([1, 2]);
});
```

**Error Testing (Result pattern, not exceptions):**
```typescript
it('returns error on invalid JSON, not a thrown exception (PARSE-06)', () => {
  const parser = new CanvasParser();
  const result = parser.parse('not valid json{{{', 'bad.canvas');
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(typeof result.error).toBe('string');
  expect(result.error.length).toBeGreaterThan(0);
});
```

**API surface existence tests:**
```typescript
it('has save(session) method', () => {
  expect(typeof svc.save).toBe('function');
});
```

**Module purity verification:**
```typescript
it('module can be imported without Obsidian runtime', () => {
  // If this test file loads, the import at the top succeeded in pure Node.js
  expect(typeof CanvasParser).toBe('function');
});
```

## Test Coverage Gaps

**Well-tested areas:**
- `ProtocolRunner` state machine — exhaustive (982 lines of tests)
- `CanvasParser` — fixture-based (169 lines)
- `SnippetService` — CRUD + move operations (1,225 lines combined)
- `SnippetEditorModal` — UI interactions (811 lines)
- Snippet tree view — rendering, DnD, inline rename (~1,700 lines combined)
- Session save/restore round-trip (348 lines)
- Graph validator (214 lines)

**Lightly tested areas:**
- `RunnerView` — only 27 lines; mostly an existence check
- `EditorPanelView` — only 69 lines; metadata and `loadNode` existence
- `SettingsTab` — only 23 lines
- `vault-utils.ts` — 27 lines (functional but minimal)

**Untested areas:**
- `src/views/runner-view.ts` — the largest view file; all rendering, canvas loading, session auto-save, snippet picker UI logic is untested
- `src/views/editor-panel-view.ts` — canvas node property editing, auto-save debounce, tab auto-switch
- `src/views/snippet-fill-in-modal.ts` — placeholder fill-in modal
- `src/views/canvas-selector-widget.ts` — protocol canvas file selector
- `src/views/canvas-switch-modal.ts` — canvas switching confirmation
- `src/views/confirm-modal.ts` — generic confirmation dialog
- `src/views/node-picker-modal.ts` — node selection modal
- `src/views/node-switch-guard-modal.ts` — unsaved changes guard
- `src/views/resume-session-modal.ts` — session resume prompt
- `src/canvas/canvas-live-editor.ts` — tested lightly (108 lines) but covers complex internal API interactions
- `src/main.ts` — plugin lifecycle, command registration, context menu integration

**Why views are untested:** Views depend heavily on Obsidian DOM APIs (`createEl`, `createDiv`, workspace manipulation). The mock in `src/__mocks__/obsidian.ts` provides minimal stubs but does not support full DOM rendering. Testing view rendering logic would require either a more complete mock or an E2E framework.

---

*Testing analysis: 2026-04-16*
